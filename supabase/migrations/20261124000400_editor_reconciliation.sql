-- Finance records confirmed monthly terms separately from payout status and payment execution.
alter table public.workspace_settings
  add column editor_ledger_started_at timestamptz not null default now();

create table public.editor_monthly_terms (
  workspace_id uuid not null references public.workspaces on delete cascade,
  editor_id uuid not null,
  billing_month date not null check (extract(day from billing_month) = 1),
  included_units integer not null check (included_units >= 0),
  retainer_cents integer not null check (retainer_cents >= 0),
  overage_cents integer not null check (overage_cents >= 0),
  content_type_key text not null check (length(trim(content_type_key)) > 0),
  confirmed_by uuid not null default auth.uid(),
  confirmed_at timestamptz not null default now(),
  primary key (workspace_id, editor_id, billing_month)
);

-- Snapshot identity and display fields so renames, deletions and reassignment preserve the invoice trail.
create table public.editor_approval_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  project_id uuid not null,
  job_code text not null,
  project_title text not null,
  editor_id uuid,
  editor_name text,
  content_type_key text,
  approved_at timestamptz,
  billing_month date,
  timezone text,
  kind text not null check (kind in ('first','repeat','legacy')),
  check ((approved_at is null) = (kind = 'legacy')),
  check ((billing_month is null) = (kind = 'legacy'))
);
create unique index editor_first_approval on public.editor_approval_entries(workspace_id, project_id)
  where kind in ('first','legacy');
create index editor_monthly_approvals on public.editor_approval_entries(workspace_id, billing_month, approved_at, id);

-- Existing approvals lack an authoritative event time. Keep only a deduplication marker.
lock table public.project_edits in share row exclusive mode;
insert into public.editor_approval_entries(workspace_id,project_id,job_code,project_title,kind)
  select p.workspace_id,p.id,p.job_code,p.title,'legacy'
  from public.projects p join public.project_edits e on e.project_id=p.id where e.edit_status='approved';

create function app.record_editor_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  project public.projects%rowtype;
  zone text;
  credited_name text;
  type_key text;
  stamp timestamptz := statement_timestamp();
  month_start date;
  entry_kind text;
begin
  if new.edit_status is distinct from 'approved' then return new; end if;
  if tg_op='UPDATE' and old.edit_status='approved' then return new; end if;
  select * into strict project from public.projects where id=new.project_id;
  select coalesce((select timezone from public.workspace_settings where workspace_id=project.workspace_id),'America/Chicago') into zone;
  select full_name into credited_name from public.profiles where id=new.editor_id;
  select key into type_key from public.content_types where id=project.content_type_id;
  month_start := date_trunc('month',stamp at time zone zone)::date;
  -- Edits are serialized by their project's primary-key row.
  entry_kind := case when exists(select 1 from public.editor_approval_entries where workspace_id=project.workspace_id
                  and project_id=project.id and kind in ('first','legacy')) then 'repeat' else 'first' end;
  insert into public.editor_approval_entries(workspace_id,project_id,job_code,project_title,
    editor_id,editor_name,content_type_key,approved_at,billing_month,timezone,kind)
    values(project.workspace_id,project.id,project.job_code,project.title,new.editor_id,credited_name,
      type_key,stamp,month_start,zone,entry_kind);
  return new;
end $$;
revoke all on function app.record_editor_approval() from public, anon, authenticated;
create trigger record_editor_approval after insert or update of edit_status on public.project_edits
  for each row execute function app.record_editor_approval();

alter table public.payouts add unique(workspace_id,user_id,id);
create table public.editor_reconciliation_links (
  workspace_id uuid not null,
  editor_id uuid not null,
  billing_month date not null,
  payout_id uuid not null unique,
  invoice_url text not null check (invoice_url ~ '^https://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'),
  primary key(workspace_id,editor_id,billing_month),
  foreign key(workspace_id,editor_id,billing_month) references public.editor_monthly_terms on delete cascade,
  foreign key(workspace_id,editor_id,payout_id) references public.payouts(workspace_id,user_id,id) on delete cascade
);

alter table public.editor_monthly_terms enable row level security;
alter table public.editor_approval_entries enable row level security;
alter table public.editor_reconciliation_links enable row level security;
revoke all on public.editor_monthly_terms,public.editor_approval_entries,public.editor_reconciliation_links from anon,authenticated;
grant select on public.editor_monthly_terms,public.editor_approval_entries,public.editor_reconciliation_links to authenticated;
grant insert(workspace_id,editor_id,billing_month,included_units,retainer_cents,overage_cents,content_type_key) on public.editor_monthly_terms to authenticated;
grant insert,update on public.editor_reconciliation_links to authenticated;
create policy finance_read on public.editor_approval_entries for select to authenticated using (app.is_admin(workspace_id) and app.mfa_satisfied());
create policy finance_read on public.editor_monthly_terms for select to authenticated using (app.is_admin(workspace_id) and app.mfa_satisfied());
create policy finance_confirm on public.editor_monthly_terms for insert to authenticated with check (
  app.is_admin(workspace_id) and app.mfa_satisfied() and confirmed_by=auth.uid()
  and (exists (select 1 from public.workspace_members m where m.workspace_id=editor_monthly_terms.workspace_id and m.user_id=editor_id and m.role='editor')
    or exists (select 1 from public.editor_approval_entries e where e.workspace_id=editor_monthly_terms.workspace_id and e.editor_id=editor_monthly_terms.editor_id and e.billing_month=editor_monthly_terms.billing_month))
  and (content_type_key='*' or exists (select 1 from public.content_types t where t.workspace_id=editor_monthly_terms.workspace_id and t.key=content_type_key))
);
create policy finance_link on public.editor_reconciliation_links for all to authenticated
  using (app.is_admin(workspace_id) and app.mfa_satisfied())
  with check (app.is_admin(workspace_id) and app.mfa_satisfied()
    and exists (select 1 from public.payouts p where p.id=payout_id and p.role='editor'));
