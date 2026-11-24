-- Baselines establish the review queues going forward. They never invent an approval time.
create table public.production_edit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  occurred_at timestamptz not null default clock_timestamp(),
  editor_id uuid references public.profiles on delete set null,
  edit_status public.edit_status,
  active boolean not null,
  entered_approved boolean not null default false,
  baseline boolean not null default false
);
create index production_edit_latest on public.production_edit_events
  (workspace_id, project_id, occurred_at desc, id desc);
create index production_edit_approvals on public.production_edit_events
  (workspace_id, occurred_at) where entered_approved;

create table public.production_digest_deliveries (
  workspace_id uuid not null references public.workspaces on delete cascade,
  channel text not null,
  reporting_date date not null,
  cutoff timestamptz not null,
  run_id uuid references public.automation_runs on delete set null,
  status text not null check (status in ('sending', 'sent')),
  slack_ts text,
  primary key(workspace_id, channel, reporting_date),
  check ((status = 'sent') = (slack_ts is not null))
);
alter table public.production_edit_events enable row level security;
alter table public.production_digest_deliveries enable row level security;
revoke all on public.production_edit_events, public.production_digest_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.production_digest_deliveries to service_role;

create function app.capture_digest_edit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
  approved boolean := false;
begin
  if tg_table_name = 'projects' then
    pid := new.id;
  elsif tg_op = 'DELETE' then
    pid := old.project_id;
  else
    pid := new.project_id;
    if tg_op = 'UPDATE' and new.edit_status is not distinct from old.edit_status
        and new.editor_id is not distinct from old.editor_id then return null; end if;
    approved := new.edit_status = 'approved' and (tg_op = 'INSERT' or old.edit_status is distinct from new.edit_status);
  end if;
  insert into public.production_edit_events (workspace_id,project_id,editor_id,edit_status,active,entered_approved)
    select p.workspace_id,p.id,e.editor_id,e.edit_status,p.archived_at is null,coalesce(approved,false)
    from public.projects p left join public.project_edits e on e.project_id=p.id where p.id=pid;
  return null;
end;
$$;
revoke all on function app.capture_digest_edit() from public, anon, authenticated;
create trigger digest_on_edit after insert or delete or update of edit_status, editor_id on public.project_edits
  for each row execute function app.capture_digest_edit();
create trigger digest_on_archive after update of archived_at on public.projects
  for each row when (old.archived_at is distinct from new.archived_at) execute function app.capture_digest_edit();

insert into public.production_edit_events(workspace_id,project_id,editor_id,edit_status,active,baseline)
  select p.workspace_id,p.id,e.editor_id,e.edit_status,p.archived_at is null,true
  from public.project_edits e join public.projects p on p.id=e.project_id;

-- Use a scalar JSON result to avoid truncating the snapshot at PostgREST's default row limit.
create function public.production_digest_rows(p_ws uuid, p_start timestamptz, p_cutoff timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with latest as (
    select distinct on (project_id) project_id,editor_id,edit_status,active
    from public.production_edit_events where workspace_id=p_ws and occurred_at <= p_cutoff
    order by project_id,occurred_at desc,id desc
  ), approved as (
    select distinct on (project_id) project_id,editor_id from public.production_edit_events
    where workspace_id=p_ws and entered_approved and active and occurred_at > p_start and occurred_at <= p_cutoff
    order by project_id,occurred_at desc,id desc
  ), records as (
    select 'completed' as bucket,project_id,editor_id from approved
    union all
    select edit_status::text,project_id,editor_id from latest where active and edit_status in ('in_review','needs_revision')
  )
  select coalesce(jsonb_agg(jsonb_build_object('bucket', r.bucket, 'job', p.job_code, 'title', p.title,
         'editor', coalesce(nullif(pr.full_name,''),nullif(pr.email,''),'Unassigned')) order by p.title,p.id),'[]'::jsonb)
  from records r join public.projects p on p.id=r.project_id and p.workspace_id=p_ws
  left join public.profiles pr on pr.id=r.editor_id;
$$;
revoke all on function public.production_digest_rows(uuid,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.production_digest_rows(uuid,timestamptz,timestamptz) to service_role;
