-- Email notifications. Triggers queue one row per recipient in email_outbox when someone is assigned, a revision is
-- requested, a review or sponsor approval is requested, or one is decided. queue_deadline_reminders() adds edit and
-- thumbnail deadlines due tomorrow (workspace time) and posts the matching in-app Deadline notification.
-- Only the server reads the outbox (secret key): /api/notifications/send claims rows, checks the person's and the
-- workspace's email settings at send time, and sends through Resend. The actor never gets an email about their own change.

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Settings key, matching workspace_settings.notify_defaults '<event>:email'.
  event text not null check (event in ('assigned', 'revision', 'approval', 'due')),
  -- What happened, for the template: edit_assigned, thumb_assigned, edit_revision, thumb_revision, sponsor_changes,
  -- edit_review, thumb_review, edit_approved, thumb_approved, sponsor_requested, sponsor_approved, edit_due, thumb_due.
  kind text not null,
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  -- Deadline reminders only: one per deadline, person and date.
  dedupe_key text unique,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'skipped', 'failed')),
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz
);

create index email_outbox_pending on public.email_outbox (created_at) where status in ('queued', 'sending');

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

-- ---------- Queueing ----------
-- Queues one email for an active member. Skips the person who made the change. True when a row was added.
create or replace function app.queue_email(ws uuid, uid uuid, p_event text, p_kind text, p uuid, p_data jsonb default '{}'::jsonb, p_key text default null)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if uid is null or uid = auth.uid() then return false; end if;
  if not exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = uid and m.status = 'active') then
    return false;
  end if;
  insert into public.email_outbox (workspace_id, user_id, event, kind, project_id, actor_id, data, dedupe_key)
  values (ws, uid, p_event, p_kind, p, auth.uid(), coalesce(p_data, '{}'::jsonb), p_key)
  on conflict (dedupe_key) do nothing;
  return found;
end $$;

create or replace function app.queue_email_admins(ws uuid, p_event text, p_kind text, p uuid, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  for uid in select m.user_id from public.workspace_members m where m.workspace_id = ws and m.role = 'super_admin' and m.status = 'active' loop
    perform app.queue_email(ws, uid, p_event, p_kind, p, p_data);
  end loop;
end $$;

-- Workspace of a project that is still on the board, or null for archived projects.
create or replace function app.open_project_ws(p uuid)
returns uuid
language sql stable security definer set search_path = '' as $$
  select workspace_id from public.projects where id = p and archived_at is null
$$;

-- ---------- Triggers ----------
create or replace function app.email_on_edit()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := app.open_project_ws(new.project_id);
  old_editor uuid := case when tg_op = 'UPDATE' then old.editor_id end;
  old_status public.edit_status := case when tg_op = 'UPDATE' then old.edit_status end;
begin
  if ws is null then return new; end if;
  if new.editor_id is not null and new.editor_id is distinct from old_editor then
    perform app.queue_email(ws, new.editor_id, 'assigned', 'edit_assigned', new.project_id, jsonb_build_object('due', new.edit_due));
  end if;
  if new.edit_status is distinct from old_status then
    if new.edit_status = 'needs_revision' then
      perform app.queue_email(ws, new.editor_id, 'revision', 'edit_revision', new.project_id, jsonb_build_object('due', new.edit_due));
    elsif new.edit_status = 'in_review' then
      perform app.queue_email_admins(ws, 'approval', 'edit_review', new.project_id, jsonb_build_object('person', new.editor_id, 'version', new.draft_version));
    elsif new.edit_status = 'approved' then
      perform app.queue_email(ws, new.editor_id, 'approval', 'edit_approved', new.project_id);
    end if;
  end if;
  return new;
end $$;

create trigger email_on_edit after insert or update of editor_id, edit_status on public.project_edits
for each row execute function app.email_on_edit();

create or replace function app.email_on_thumb()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := app.open_project_ws(new.project_id);
  old_designer uuid := case when tg_op = 'UPDATE' then old.designer_id end;
  old_status public.thumb_status := case when tg_op = 'UPDATE' then old.thumb_status end;
begin
  if ws is null then return new; end if;
  if new.designer_id is not null and new.designer_id is distinct from old_designer then
    perform app.queue_email(ws, new.designer_id, 'assigned', 'thumb_assigned', new.project_id, jsonb_build_object('due', new.thumb_due));
  end if;
  if new.thumb_status is distinct from old_status then
    if new.thumb_status = 'needs_revision' then
      perform app.queue_email(ws, new.designer_id, 'revision', 'thumb_revision', new.project_id, jsonb_build_object('due', new.thumb_due));
    elsif new.thumb_status = 'in_review' then
      perform app.queue_email_admins(ws, 'approval', 'thumb_review', new.project_id, jsonb_build_object('person', new.designer_id));
    elsif new.thumb_status = 'done' then
      perform app.queue_email(ws, new.designer_id, 'approval', 'thumb_approved', new.project_id);
    end if;
  end if;
  return new;
end $$;

create trigger email_on_thumb after insert or update of designer_id, thumb_status on public.project_thumbnails
for each row execute function app.email_on_thumb();

-- A sponsor's decision goes to the Super Admins. Changes requested also go to the project's editor as a revision.
create or replace function app.email_on_sponsorship()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := app.open_project_ws(new.project_id);
  d jsonb;
  ed uuid;
begin
  if ws is null or new.approval_status is not distinct from old.approval_status or new.approval_status = 'pending' then return new; end if;
  d := jsonb_build_object('account', (select a.name from public.accounts a where a.id = new.account_id), 'note', new.decision_note);
  if new.approval_status = 'approved' then
    perform app.queue_email_admins(ws, 'approval', 'sponsor_approved', new.project_id, d);
  else
    perform app.queue_email_admins(ws, 'approval', 'sponsor_changes', new.project_id, d);
    select e.editor_id into ed from public.project_edits e where e.project_id = new.project_id;
    perform app.queue_email(ws, ed, 'revision', 'sponsor_changes', new.project_id, d);
  end if;
  return new;
end $$;

create trigger email_on_sponsorship after update of approval_status on public.sponsorships
for each row execute function app.email_on_sponsorship();

-- Moving a project to Sponsor Review asks each pending sponsor's approvers (portal on, approvals allowed).
create or replace function app.email_on_sponsor_review()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.archived_at is not null or new.status_id is not distinct from old.status_id
     or app.status_label(new.status_id) <> 'Sponsor Review' then
    return new;
  end if;
  for r in
    select am.user_id, a.name from public.sponsorships s
    join public.accounts a on a.id = s.account_id and a.allow_portal and a.allow_approve
    join public.account_members am on am.account_id = a.id
    where s.project_id = new.id and s.approval_status = 'pending'
  loop
    perform app.queue_email(new.workspace_id, r.user_id, 'approval', 'sponsor_requested', new.id, jsonb_build_object('account', r.name));
  end loop;
  return new;
end $$;

create trigger email_on_sponsor_review after update of status_id on public.projects
for each row execute function app.email_on_sponsor_review();

-- ---------- Deadline reminders ----------
-- Edits and thumbnails due tomorrow in the workspace's time zone that are not finished, on projects that are not Live
-- or archived. Safe to run as often as you like: each deadline is reminded once per person and date.
create or replace function public.queue_deadline_reminders(p_ws uuid default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in
    select p.workspace_id ws, p.id pid, p.title, 'edit' what, e.editor_id uid, e.edit_due due
    from public.project_edits e
    join public.projects p on p.id = e.project_id
    join public.workspace_settings s on s.workspace_id = p.workspace_id
    where (p_ws is null or p.workspace_id = p_ws) and p.archived_at is null and e.editor_id is not null
      and e.edit_status is distinct from 'approved'
      and e.edit_due = (now() at time zone s.timezone)::date + 1
      and app.status_label(p.status_id) <> 'Live'
    union all
    select p.workspace_id, p.id, p.title, 'thumb', t.designer_id, t.thumb_due
    from public.project_thumbnails t
    join public.projects p on p.id = t.project_id
    join public.workspace_settings s on s.workspace_id = p.workspace_id
    where (p_ws is null or p.workspace_id = p_ws) and p.archived_at is null and t.designer_id is not null
      and t.thumb_status is distinct from 'done'
      and t.thumb_due = (now() at time zone s.timezone)::date + 1
      and app.status_label(p.status_id) <> 'Live'
  loop
    if app.queue_email(r.ws, r.uid, 'due', r.what || '_due', r.pid, jsonb_build_object('due', r.due),
                       'due:' || r.what || ':' || r.pid || ':' || r.uid || ':' || r.due) then
      insert into public.notifications (workspace_id, user_id, event, actor_label, text, target_label, project_id)
      values (r.ws, r.uid, 'deadline', 'Automation', case r.what when 'edit' then 'Your edit is due tomorrow on' else 'Your thumbnail is due tomorrow on' end, r.title, r.pid);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Claims up to p_limit queued emails (and ones stuck sending for 10 minutes) for one send run.
create or replace function public.claim_email_outbox(p_ws uuid default null, p_limit int default 50)
returns setof public.email_outbox
language sql security definer set search_path = '' as $$
  update public.email_outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
  where o.id in (
    select x.id from public.email_outbox x
    where (p_ws is null or x.workspace_id = p_ws)
      and (x.status = 'queued' or (x.status = 'sending' and x.claimed_at < now() - interval '10 minutes'))
    order by x.created_at
    limit p_limit
    for update skip locked
  )
  returning o.*
$$;

revoke execute on function app.queue_email(uuid, uuid, text, text, uuid, jsonb, text), app.queue_email_admins(uuid, text, text, uuid, jsonb),
  app.open_project_ws(uuid), public.queue_deadline_reminders(uuid), public.claim_email_outbox(uuid, int)
from public, anon, authenticated;
grant execute on function public.queue_deadline_reminders(uuid), public.claim_email_outbox(uuid, int) to service_role;
