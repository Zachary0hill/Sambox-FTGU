-- Completes the workflows the audit of 2026-10-25 found unfinished:
--   1. Template checklists become per-project checklist rows.
--   2. "Last edited by" columns read who last changed a project (project_last_edit).
--   3. The Automations > Settings > Notifications matrix is enforced: In-app off drops the notification, Slack on queues
--      an alert in notify_outbox for people who turned Slack alerts on in their Settings.
--   4. Automations run: triggers queue automation_runs rows, /api/automations/run claims and executes them with retries.
--   5. Invoices keep their delivery receipt or error.
-- Every change is additive, so the current production build keeps working while this is applied.

-- ---------- 1. Project checklists (from templates) ----------
create table if not exists public.project_checklist (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  sort int not null default 0,
  done_at timestamptz,
  done_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_checklist_project on public.project_checklist (project_id, sort);
alter table public.project_checklist enable row level security;

-- The team sees and ticks the checklist of projects they can open; Super Admins add, rename and remove steps.
create policy pcl_select on public.project_checklist for select to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_project_access(project_id));
create policy pcl_insert on public.project_checklist for insert to authenticated
  with check (app.is_internal(app.project_ws(project_id)) and app.has_project_access(project_id)
    and (app.is_admin(app.project_ws(project_id)) or app.has_perm(app.project_ws(project_id), 'projects', 'create')));
create policy pcl_update on public.project_checklist for update to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_project_access(project_id));
create policy pcl_delete on public.project_checklist for delete to authenticated
  using (app.is_admin(app.project_ws(project_id)));

-- Ticking a step records who did it; nobody else's name can be written.
create or replace function app.checklist_done_by()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.done_at is not null and (tg_op = 'INSERT' or old.done_at is null) then new.done_by := auth.uid(); end if;
  if new.done_at is null then new.done_by := null; end if;
  return new;
end $$;
create trigger checklist_done_by before insert or update on public.project_checklist
for each row execute function app.checklist_done_by();

-- ---------- 2. Last edited by ----------
create table if not exists public.project_last_edit (
  project_id uuid primary key references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  edited_at timestamptz not null default now()
);
alter table public.project_last_edit enable row level security;
create policy ple_select on public.project_last_edit for select to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_project_access(project_id));
revoke insert, update, delete on public.project_last_edit from anon, authenticated;

-- Any write to a project or its production rows records the signed-in person. Server jobs (monday sync, automations)
-- have no auth.uid() and leave the last editor as it was.
create or replace function app.touch_last_edit()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare p uuid; uid uuid := auth.uid();
begin
  if uid is null then return coalesce(new, old); end if;
  if tg_table_name = 'projects' then p := coalesce(new.id, old.id); else p := coalesce(new.project_id, old.project_id); end if;
  if tg_op = 'DELETE' and tg_table_name = 'projects' then return old; end if;
  insert into public.project_last_edit (project_id, user_id, edited_at) values (p, uid, now())
  on conflict (project_id) do update set user_id = excluded.user_id, edited_at = excluded.edited_at;
  return coalesce(new, old);
exception when foreign_key_violation then
  -- The project was deleted in the same statement.
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['projects','project_edits','project_thumbnails','project_field_values','sponsorships','distribution_tasks'] loop
    execute format('drop trigger if exists touch_last_edit on public.%I', t);
    execute format('create trigger touch_last_edit after insert or update on public.%I for each row execute function app.touch_last_edit()', t);
  end loop;
  foreach t in array array['project_field_values','sponsorships','distribution_tasks'] loop
    execute format('drop trigger if exists touch_last_edit_del on public.%I', t);
    execute format('create trigger touch_last_edit_del after delete on public.%I for each row execute function app.touch_last_edit()', t);
  end loop;
end $$;

-- ---------- 3. Notification matrix ----------
-- notifications.event to the matrix key in workspace_settings.notify_defaults ('<key>:app' / '<key>:slack').
create or replace function app.notify_key(ev text)
returns text
language sql immutable set search_path = '' as $$
  select case ev when 'assign' then 'assigned' when 'deadline' then 'due' when 'status' then 'status'
    when 'comment' then 'comment' when 'approval' then 'approval' when 'revision' then 'revision' else null end
$$;

-- Matrix defaults, as the Automations > Settings > Notifications page shows them.
create or replace function app.notify_on(ws uuid, ev text, ch text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (s.notify_defaults ->> (app.notify_key(ev) || ':' || ch))::boolean from public.workspace_settings s where s.workspace_id = ws),
    case ch
      when 'app' then true
      when 'slack' then app.notify_key(ev) in ('assigned', 'revision', 'status', 'due')
      else false end,
    true)
$$;

-- Slack alerts and the daily digest are sent by /api/notifications/send (server only).
create table if not exists public.notify_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('slack')),
  event text not null,
  actor_label text not null default '',
  text text not null default '',
  target_label text not null default '',
  quote text,
  project_id uuid references public.projects(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'skipped', 'failed')),
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz
);
create index if not exists notify_outbox_pending on public.notify_outbox (created_at) where status in ('queued', 'sending');
alter table public.notify_outbox enable row level security;
revoke all on public.notify_outbox from anon, authenticated;

-- In-app off for an event drops its notification for everyone. Slack on queues an alert for each person who turned
-- Slack alerts on (profiles.prefs.myN.slack), while Slack is connected.
create or replace function app.route_notification()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if app.notify_key(new.event) is not null
     and app.notify_on(new.workspace_id, new.event, 'slack')
     and exists (select 1 from public.integrations g where g.workspace_id = new.workspace_id and g.provider = 'slack' and g.status = 'connected')
     and exists (select 1 from public.profiles p where p.id = new.user_id and coalesce((p.prefs -> 'myN' ->> 'slack')::boolean, false)) then
    insert into public.notify_outbox (workspace_id, user_id, channel, event, actor_label, text, target_label, quote, project_id)
    values (new.workspace_id, new.user_id, 'slack', new.event, new.actor_label, new.text, new.target_label, new.quote, new.project_id);
  end if;
  if app.notify_key(new.event) is not null and not app.notify_on(new.workspace_id, new.event, 'app') then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists route_notification on public.notifications;
create trigger route_notification before insert on public.notifications
for each row execute function app.route_notification();

create or replace function public.claim_notify_outbox(p_ws uuid default null, p_limit int default 50)
returns setof public.notify_outbox
language sql security definer set search_path = '' as $$
  update public.notify_outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
  where o.id in (
    select x.id from public.notify_outbox x
    where (p_ws is null or x.workspace_id = p_ws)
      and (x.status = 'queued' or (x.status = 'sending' and x.claimed_at < now() - interval '10 minutes'))
    order by x.created_at
    limit p_limit
    for update skip locked
  )
  returning o.*
$$;

-- One digest per person and local day.
create table if not exists public.digest_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  status text not null default 'sent',
  error text,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.digest_log enable row level security;
revoke all on public.digest_log from anon, authenticated;

-- ---------- 4. Automation runs ----------
alter table public.automation_runs
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists trigger_key text,
  add column if not exists dedupe_key text,
  add column if not exists attempts int not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists output jsonb,
  add column if not exists is_test boolean not null default false,
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();
create unique index if not exists automation_runs_dedupe on public.automation_runs (dedupe_key);
create index if not exists automation_runs_pending on public.automation_runs (created_at) where status in ('queued', 'retry', 'running');
create index if not exists automation_runs_ws on public.automation_runs (workspace_id, created_at desc);
update public.automation_runs r set workspace_id = a.workspace_id from public.automations a where a.id = r.automation_id and r.workspace_id is null;

-- Workflows saved before structured triggers carry only labels; give them keys the runner understands.
update public.automations set "trigger" = "trigger" || (case "trigger" ->> 'label'
    when 'Status becomes Filming' then '{"key":"status","value":"Filming"}'
    when 'Editor Status becomes Needs Revision' then '{"key":"edit_status","value":"needs_revision"}'
    when 'Thumbnail becomes In Review' then '{"key":"thumb_status","value":"in_review"}'
    when 'Sponsor Approval becomes Approved' then '{"key":"approval","value":"approved"}'
    when 'A comment mentions Super Admin' then '{"key":"mention_admin"}'
    when 'Publishing date is 3 days away' then '{"key":"publish_soon","value":"3"}'
  end)::jsonb
where "trigger" ->> 'key' is null and "trigger" ->> 'label' in ('Status becomes Filming', 'Editor Status becomes Needs Revision',
  'Thumbnail becomes In Review', 'Sponsor Approval becomes Approved', 'A comment mentions Super Admin', 'Publishing date is 3 days away');
update public.automations a set actions = (
  select coalesce(jsonb_agg(x || coalesce((case x ->> 'label'
      when 'Notify Super Admin in Slack' then '{"key":"slack_admin"}'
      when 'Email the assigned editor' then '{"key":"email_editor"}'
      when 'Email the assigned designer' then '{"key":"email_designer"}'
      when 'Move Status to the next step' then '{"key":"status_next"}'
      when 'Create a To-Do for Super Admin' then '{"key":"todo_admin"}'
      when 'Send a webhook to n8n' then '{"key":"webhook_n8n"}'
    end)::jsonb, '{}'::jsonb)), '[]'::jsonb)
  from jsonb_array_elements(a.actions) x)
where jsonb_typeof(a.actions) = 'array' and exists (select 1 from jsonb_array_elements(a.actions) x where x ->> 'key' is null);

-- Queues one run per live workflow whose trigger matches. Nothing queues while Pause all automations is on.
create or replace function app.queue_automation(ws uuid, p_key text, p_value text, p uuid, p_payload jsonb default '{}'::jsonb, p_dedupe text default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; a record;
begin
  if ws is null then return 0; end if;
  if coalesce((select (s.automation ->> 'paused')::boolean from public.workspace_settings s where s.workspace_id = ws), false) then return 0; end if;
  for a in
    select x.id from public.automations x
    where x.workspace_id = ws and x.enabled and not x.is_draft and x."trigger" ->> 'key' = p_key
      and (coalesce(x."trigger" ->> 'value', '') = '' or lower(x."trigger" ->> 'value') = lower(coalesce(p_value, '')))
  loop
    insert into public.automation_runs (automation_id, workspace_id, project_id, trigger_key, status, payload, dedupe_key, actor_id, started_at)
    values (a.id, ws, p, p_key, 'queued', coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('value', p_value),
      case when p_dedupe is null then null else a.id || ':' || p_dedupe end, auth.uid(), now())
    on conflict (dedupe_key) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

create or replace function app.auto_on_project()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status_id is distinct from old.status_id and new.archived_at is null then
    perform app.queue_automation(new.workspace_id, 'status', app.status_label(new.status_id), new.id,
      jsonb_build_object('from', app.status_label(old.status_id), 'to', app.status_label(new.status_id)));
  end if;
  return new;
end $$;
drop trigger if exists auto_on_project on public.projects;
create trigger auto_on_project after update of status_id on public.projects
for each row execute function app.auto_on_project();

create or replace function app.auto_on_production()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare ws uuid := app.open_project_ws(new.project_id); v text; was text;
begin
  if ws is null then return new; end if;
  if tg_table_name = 'project_edits' then
    v := new.edit_status::text; was := case when tg_op = 'UPDATE' then old.edit_status::text end;
    if v is distinct from was then perform app.queue_automation(ws, 'edit_status', v, new.project_id, jsonb_build_object('from', was, 'to', v)); end if;
  elsif tg_table_name = 'project_thumbnails' then
    v := new.thumb_status::text; was := case when tg_op = 'UPDATE' then old.thumb_status::text end;
    if v is distinct from was then perform app.queue_automation(ws, 'thumb_status', v, new.project_id, jsonb_build_object('from', was, 'to', v)); end if;
  elsif tg_table_name = 'sponsorships' then
    v := new.approval_status::text; was := case when tg_op = 'UPDATE' then old.approval_status::text end;
    if v is distinct from was then perform app.queue_automation(ws, 'approval', v, new.project_id, jsonb_build_object('from', was, 'to', v, 'account', new.account_id)); end if;
  end if;
  return new;
end $$;
drop trigger if exists auto_on_edit on public.project_edits;
create trigger auto_on_edit after insert or update of edit_status on public.project_edits for each row execute function app.auto_on_production();
drop trigger if exists auto_on_thumb on public.project_thumbnails;
create trigger auto_on_thumb after insert or update of thumb_status on public.project_thumbnails for each row execute function app.auto_on_production();
drop trigger if exists auto_on_sponsorship on public.sponsorships;
create trigger auto_on_sponsorship after insert or update of approval_status on public.sponsorships for each row execute function app.auto_on_production();

-- "@admin", "@super admin" or "@<first name of a Super Admin>" in a comment.
create or replace function app.auto_on_comment()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare ws uuid := app.open_project_ws(new.project_id);
begin
  if ws is null then return new; end if;
  if new.body ~* '@(super ?admin|admin)\M' or exists (
    select 1 from public.workspace_members m join public.profiles p on p.id = m.user_id
    where m.workspace_id = ws and m.role = 'super_admin' and m.status = 'active'
      and nullif(split_part(p.full_name, ' ', 1), '') is not null
      and position(lower('@' || split_part(p.full_name, ' ', 1)) in lower(new.body)) > 0) then
    perform app.queue_automation(ws, 'mention_admin', null, new.project_id, jsonb_build_object('comment', new.id, 'quote', left(new.body, 280)));
  end if;
  return new;
end $$;
drop trigger if exists auto_on_comment on public.comments;
create trigger auto_on_comment after insert on public.comments for each row execute function app.auto_on_comment();

-- Scheduled triggers (Publishing date is N days away), evaluated on every runner tick; one run per project and date.
create or replace function public.queue_scheduled_automations(p_ws uuid default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; r record;
begin
  for r in
    select a.workspace_id, p.id as pid, p.title, p.publish_date, coalesce(nullif(a."trigger" ->> 'value', ''), '3')::int as days
    from public.automations a
    join public.workspace_settings s on s.workspace_id = a.workspace_id
    join public.projects p on p.workspace_id = a.workspace_id and p.archived_at is null and p.publish_date is not null
    where (p_ws is null or a.workspace_id = p_ws) and a.enabled and not a.is_draft and a."trigger" ->> 'key' = 'publish_soon'
      and p.publish_date = (now() at time zone s.timezone)::date + coalesce(nullif(a."trigger" ->> 'value', ''), '3')::int
      and app.status_label(p.status_id) <> 'Live'
  loop
    n := n + app.queue_automation(r.workspace_id, 'publish_soon', r.days::text, r.pid,
      jsonb_build_object('publish_date', r.publish_date), 'pub:' || r.pid || ':' || r.publish_date);
  end loop;
  return n;
end $$;

-- Claims runs that are queued, due for a retry, or stuck running for 10 minutes.
create or replace function public.claim_automation_runs(p_ws uuid default null, p_limit int default 25)
returns setof public.automation_runs
language sql security definer set search_path = '' as $$
  update public.automation_runs r set status = 'running', attempts = r.attempts + 1, started_at = now()
  where r.id in (
    select x.id from public.automation_runs x
    where (p_ws is null or x.workspace_id = p_ws)
      and (x.status = 'queued' or (x.status = 'retry' and x.next_attempt_at <= now())
        or (x.status = 'running' and x.started_at < now() - interval '10 minutes'))
    order by x.created_at
    limit p_limit
    for update skip locked
  )
  returning r.*
$$;

-- Run history retention (Automations > Settings > Run history).
create or replace function public.prune_automation_runs(p_ws uuid default null)
returns int
language sql security definer set search_path = '' as $$
  with gone as (
    delete from public.automation_runs r
    using public.workspace_settings s
    where s.workspace_id = r.workspace_id and (p_ws is null or r.workspace_id = p_ws)
      and r.status in ('done', 'failed', 'skipped', 'test')
      and r.created_at < now() - make_interval(days => coalesce(nullif(s.automation ->> 'retention', '')::int, 90))
    returning 1)
  select count(*)::int from gone
$$;

-- ---------- 5. Invoice delivery ----------
alter table public.invoices
  add column if not exists contact_email text,
  add column if not exists payment_url text,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists sent_at timestamptz,
  add column if not exists reminded_at timestamptz,
  add column if not exists delivery_id text,
  add column if not exists delivery_error text;
alter table public.deals add column if not exists note text not null default '';

-- ---------- Grants and realtime ----------
revoke execute on function app.queue_automation(uuid, text, text, uuid, jsonb, text), app.touch_last_edit(), app.route_notification(),
  app.notify_on(uuid, text, text), app.auto_on_project(), app.auto_on_production(), app.auto_on_comment(), app.checklist_done_by(),
  public.claim_notify_outbox(uuid, int), public.queue_scheduled_automations(uuid), public.claim_automation_runs(uuid, int), public.prune_automation_runs(uuid)
from public, anon, authenticated;
grant execute on function public.claim_notify_outbox(uuid, int), public.queue_scheduled_automations(uuid), public.claim_automation_runs(uuid, int),
  public.prune_automation_runs(uuid) to service_role;

do $$
declare t text;
begin
  foreach t in array array['project_checklist', 'project_last_edit', 'idea_comments', 'automation_runs'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
