-- Workload page (Admin > Workload).
-- 1. project_statuses.dwell_target_days: how long a project should sit in each status. The Pipeline card marks a
--    status Slow when its average stay runs over this. Null hides the target.
-- 2. project_status_events: one row per stay in a status, written by a trigger on projects.status_id, so the page can
--    show the average days a project spends in each status. Stays that ended in the last 90 days feed the average.
-- 3. sponsorships.nudged_at + nudge_sponsor(): Nudge on a pending sponsor approval emails the account's approvers
--    and posts an in-app notification, at most once per 24 hours per project.

-- ---------- Dwell targets ----------
alter table public.project_statuses
  add column if not exists dwell_target_days int check (dwell_target_days is null or dwell_target_days between 1 and 90);

update public.project_statuses set dwell_target_days = case label
  when 'Scripting' then 5 when 'Filming' then 5 when 'Editing' then 10 when 'Sponsor Review' then 3 when 'Scheduled' then 4
end
where is_system and dwell_target_days is null and label in ('Scripting', 'Filming', 'Editing', 'Sponsor Review', 'Scheduled');

-- ---------- Status history ----------
create table if not exists public.project_status_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status_id uuid not null references public.project_statuses(id) on delete cascade,
  entered_at timestamptz not null default now(),
  left_at timestamptz,
  -- True for stays that were open when this table was created and whose start was not in the activity log.
  estimated boolean not null default false
);
create index if not exists project_status_events_open on public.project_status_events (project_id) where left_at is null;
create index if not exists project_status_events_ws on public.project_status_events (workspace_id, left_at desc);

alter table public.project_status_events enable row level security;
create policy pse_select on public.project_status_events for select to authenticated
  using ((select app.is_admin(workspace_id)));
revoke all on public.project_status_events from anon;
revoke insert, update, delete on public.project_status_events from authenticated;

create or replace function app.track_status()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status_id is not distinct from old.status_id then return new; end if;
  update public.project_status_events set left_at = now() where project_id = new.id and left_at is null;
  insert into public.project_status_events (workspace_id, project_id, status_id) values (new.workspace_id, new.id, new.status_id);
  return new;
end $$;

drop trigger if exists track_status on public.projects;
create trigger track_status after insert or update of status_id on public.projects
for each row execute function app.track_status();

-- Open stays for projects already on the board. The start is the latest "moved Status to <label>" entry in the
-- activity log when there is one, otherwise now (marked estimated).
insert into public.project_status_events (workspace_id, project_id, status_id, entered_at, estimated)
select p.workspace_id, p.id, p.status_id,
  coalesce(l.at, now()), l.at is null
from public.projects p
join public.project_statuses st on st.id = p.status_id
left join lateral (
  select max(a.created_at) at from public.activity_log a
  where a.project_id = p.id and a.action like 'moved Status to ' || st.label || '%'
) l on true
where not exists (select 1 from public.project_status_events e where e.project_id = p.id);

-- ---------- Sponsor nudge ----------
alter table public.sponsorships add column if not exists nudged_at timestamptz;

-- Emails each approver on the project's pending sponsorship (portal on, approvals allowed) and posts an in-app
-- notification. Super Admins only, once per 24 hours per project. Returns how many people were reminded.
create or replace function public.nudge_sponsor(p_project uuid)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := app.open_project_ws(p_project);
  sp record;
  r record;
  n int := 0;
  t text;
begin
  if ws is null or not app.is_admin(ws) then raise exception 'Only a Super Admin can nudge a sponsor.'; end if;
  select s.id, s.account_id, s.nudged_at, a.name into sp
  from public.sponsorships s join public.accounts a on a.id = s.account_id
  where s.project_id = p_project and s.approval_status = 'pending'
  order by s.created_at limit 1;
  if sp.id is null then raise exception 'This project has no pending sponsor approval.'; end if;
  if sp.nudged_at is not null and sp.nudged_at > now() - interval '24 hours' then
    raise exception 'A reminder already went out in the last 24 hours.';
  end if;
  select title into t from public.projects where id = p_project;
  for r in
    select am.user_id from public.accounts a
    join public.account_members am on am.account_id = a.id
    where a.id = sp.account_id and a.allow_portal and a.allow_approve
  loop
    if app.queue_email(ws, r.user_id, 'approval', 'sponsor_reminder', p_project, jsonb_build_object('account', sp.name),
                       'nudge:' || sp.id || ':' || r.user_id || ':' || current_date) then
      insert into public.notifications (workspace_id, user_id, event, actor_id, actor_label, text, target_label, project_id)
      values (ws, r.user_id, 'approval', auth.uid(), coalesce((select split_part(p.full_name, ' ', 1) from public.profiles p where p.id = auth.uid()), ''),
              'is waiting on your approval for', t, p_project);
      n := n + 1;
    end if;
  end loop;
  if n = 0 then
    raise exception 'Nobody at % can approve in the portal yet. Turn on portal access and approvals in Clients & Sponsors.', sp.name;
  end if;
  update public.sponsorships set nudged_at = now() where id = sp.id;
  return n;
end $$;

revoke all on function public.nudge_sponsor(uuid) from public, anon;
grant execute on function public.nudge_sponsor(uuid) to authenticated;

-- ---------- Weekly trend ----------
-- One row per workspace and day with the five Workload tile numbers, written when a Super Admin opens the page
-- (the same rules the page uses, so the trend matches the tiles). The tile sparklines read the last eight weeks.
create table if not exists public.workload_snapshots (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  day date not null,
  active int not null default 0,
  due_week int not null default 0,
  late int not null default 0,
  unassigned int not null default 0,
  sponsor int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, day)
);
alter table public.workload_snapshots enable row level security;
create policy ws_snap_select on public.workload_snapshots for select to authenticated using ((select app.is_admin(workspace_id)));
create policy ws_snap_insert on public.workload_snapshots for insert to authenticated with check ((select app.is_admin(workspace_id)));
create policy ws_snap_update on public.workload_snapshots for update to authenticated using ((select app.is_admin(workspace_id)));
revoke all on public.workload_snapshots from anon;
