-- Finance can review credit without changing the production editor or the underlying approval.
alter table public.editor_approval_entries drop constraint editor_approval_entries_kind_check;
alter table public.editor_approval_entries add check (kind in ('first','repeat','legacy','reassigned'));
alter table public.editor_approval_entries add column previous_editor_id uuid;

create function app.record_billing_reassignment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists (select from public.editor_approval_entries where project_id=new.project_id and kind in ('first','legacy')) then return new; end if;
  -- A simultaneous transition into Approved already has a repeat approval entry.
  if new.edit_status='approved' and old.edit_status is distinct from 'approved' then return new; end if;
  insert into public.editor_approval_entries(workspace_id,project_id,job_code,project_title,editor_id,previous_editor_id,
    editor_name,content_type_key,approved_at,billing_month,timezone,kind)
  select p.workspace_id,p.id,p.job_code,p.title,new.editor_id,old.editor_id,pr.full_name,ct.key,statement_timestamp(),
    date_trunc('month',statement_timestamp() at time zone coalesce(s.timezone,'America/Chicago'))::date,
    coalesce(s.timezone,'America/Chicago'),'reassigned'
  from public.projects p left join public.workspace_settings s on s.workspace_id=p.workspace_id
    left join public.profiles pr on pr.id=new.editor_id left join public.content_types ct on ct.id=p.content_type_id
  where p.id=new.project_id;
  return new;
end $$;
revoke all on function app.record_billing_reassignment() from public,anon,authenticated;
create trigger finance_editor_change after update of editor_id on public.project_edits for each row
  when (old.editor_id is distinct from new.editor_id) execute function app.record_billing_reassignment();

create table public.editor_credit_decisions (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  project_id uuid not null,
  reviewed_entry uuid not null references public.editor_approval_entries,
  billing_month date not null,
  choice text not null check (choice in ('retain','credit','exclude')),
  credited_entry uuid references public.editor_approval_entries,
  credited_editor uuid,
  reason text not null check (length(trim(reason)) between 1 and 2000),
  decided_by uuid not null,
  actor_name text not null,
  decided_at timestamptz not null default now()
);
create index editor_credit_project on public.editor_credit_decisions(workspace_id,project_id,id desc);
create index editor_credit_entry on public.editor_credit_decisions(reviewed_entry,id desc);
create index editor_credit_month on public.editor_credit_decisions(workspace_id,billing_month,id);
alter table public.editor_credit_decisions enable row level security;
revoke all on public.editor_credit_decisions from public,anon,authenticated;
grant select on public.editor_credit_decisions to authenticated;
create policy finance_decisions_read on public.editor_credit_decisions for select to authenticated
  using (app.is_admin(workspace_id) and app.mfa_satisfied());

create function public.decide_editor_credit(p_entry uuid,p_choice text,p_editor uuid,p_reason text,p_expected_decision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare
  e public.editor_approval_entries%rowtype;
  last_answer public.editor_credit_decisions%rowtype;
  credit_entry uuid;
  credit_editor uuid;
  answer bigint;
begin
  perform app.require_verified_session();
  select * into e from public.editor_approval_entries where id=p_entry and kind <> 'legacy';
  if auth.uid() is null or not coalesce(app.is_admin(e.workspace_id),false) then raise exception 'Finance access required' using errcode='42501'; end if;
  if p_choice is null or p_choice not in ('retain','credit','exclude') or nullif(btrim(p_reason),'') is null then
    raise exception 'Choose a billing decision and enter its reason'; end if;
  perform pg_advisory_xact_lock(hashtextextended(e.project_id::text,0));
  select * into last_answer from public.editor_credit_decisions where project_id=e.project_id and workspace_id=e.workspace_id order by id desc limit 1;
  if last_answer.reviewed_entry=e.id and last_answer.choice=p_choice and last_answer.reason=btrim(p_reason)
    and last_answer.decided_by=auth.uid() and (p_choice<>'credit' or last_answer.credited_editor=p_editor) then return last_answer.id; end if;
  if coalesce(last_answer.id,0) is distinct from p_expected_decision then raise exception 'Credit has changed. Refresh before deciding.'; end if;
  if p_choice='credit' then
    if not exists(select 1 from public.editor_monthly_terms t where t.workspace_id=e.workspace_id and t.editor_id=p_editor
      and t.billing_month=e.billing_month and (t.content_type_key='*' or t.content_type_key=e.content_type_key)) then
      raise exception 'Confirm covering contract terms for the credited editor and month first'; end if;
    credit_entry:=e.id; credit_editor:=p_editor;
  elsif p_choice='retain' then
    if last_answer.id is not null then credit_entry:=last_answer.credited_entry; credit_editor:=last_answer.credited_editor;
    else select id,editor_id into credit_entry,credit_editor from public.editor_approval_entries
      where workspace_id=e.workspace_id and project_id=e.project_id and kind='first'; end if;
  end if;
  insert into public.editor_credit_decisions(workspace_id,project_id,reviewed_entry,billing_month,choice,
    credited_entry,credited_editor,reason,decided_by,actor_name)
    values(e.workspace_id,e.project_id,e.id,e.billing_month,p_choice,credit_entry,credit_editor,btrim(p_reason),
      auth.uid(),coalesce((select nullif(full_name,'') from public.profiles where id=auth.uid()),auth.uid()::text))
    returning id into answer;
  return answer;
end $$;
revoke all on function public.decide_editor_credit(uuid,text,uuid,text,bigint) from public,anon;
grant execute on function public.decide_editor_credit(uuid,text,uuid,text,bigint) to authenticated;

-- One winning event per project across every editor and billing month. Reports and saved statements use this view.
create view public.editor_billing_lines with (security_invoker=true) as
select r.*,case when not r.is_winner then
    case when r.latest_decision_id is not null then 'No credit · Finance decision'
         when r.kind='reassigned' then 'Editor changed · review only' else 'Reapproval · review only' end
  when r.statement_editor_id is null then 'Missing editor'
  when t.editor_id is null then 'Awaiting contract terms'
  when t.content_type_key <> '*' and t.content_type_key is distinct from r.content_type_key then 'Outside contract'
  else 'Counted' end as billing_reason,
  t.editor_id is null as missing_terms
from (
  select e.*,d.id as latest_decision_id,review.id as reviewed_decision_id,
    case when d.id is null then e.kind='first' else coalesce(d.credited_entry=e.id,false) end as is_winner,
    case when d.credited_entry=e.id then d.credited_editor else e.editor_id end as statement_editor_id,
    d.reason as project_decision_reason
  from public.editor_approval_entries e
  left join lateral (select * from public.editor_credit_decisions dd where dd.workspace_id=e.workspace_id and dd.project_id=e.project_id order by dd.id desc limit 1) d on true
  left join lateral (select dd.id from public.editor_credit_decisions dd where dd.reviewed_entry=e.id order by dd.id desc limit 1) review on true
  where e.kind <> 'legacy'
) r left join public.editor_monthly_terms t on t.workspace_id=r.workspace_id and t.editor_id=r.statement_editor_id and t.billing_month=r.billing_month;
revoke all on public.editor_billing_lines from public,anon,authenticated;
grant select on public.editor_billing_lines to authenticated;

create table public.editor_month_statements (
  workspace_id uuid not null references public.workspaces on delete cascade,
  editor_id uuid not null,
  billing_month date not null,
  version integer not null check(version>0),
  saved_at timestamptz not null default now(),
  saved_by uuid not null,
  actor_name text not null,
  reason text not null,
  delta_cents bigint not null,
  affected_jobs text[] not null,
  document jsonb not null,
  primary key(workspace_id,editor_id,billing_month,version)
);
alter table public.editor_month_statements enable row level security;
revoke all on public.editor_month_statements from public,anon,authenticated;
grant select on public.editor_month_statements to authenticated;
create policy finance_statements_read on public.editor_month_statements for select to authenticated
  using (app.is_admin(workspace_id) and app.mfa_satisfied());

create function public.preview_editor_statement(p_workspace uuid,p_editor uuid,p_month date)
returns jsonb language sql stable security invoker set search_path='' as $$
  with lines as (
    select id,project_id,job_code,project_title,kind,approved_at,timezone,content_type_key,
      editor_id,statement_editor_id,billing_reason,project_decision_reason,latest_decision_id
    from public.editor_billing_lines where workspace_id=p_workspace and statement_editor_id=p_editor and billing_month=p_month
  ), items as (
    select coalesce(jsonb_agg(to_jsonb(lines) order by approved_at,id),'[]') as rows,
      count(*) filter(where billing_reason='Counted') as units from lines
  )
  select jsonb_build_object('terms',to_jsonb(t),'items',i.rows,'units',i.units,'included',least(i.units,t.included_units),
    'overage',greatest(i.units-t.included_units,0),'overage_cents',greatest(i.units-t.included_units,0)*t.overage_cents,
    'total_cents',t.retainer_cents+greatest(i.units-t.included_units,0)*t.overage_cents,
    'payout',case when p.id is null then null else jsonb_build_object('id',p.id,'description',p.description,
      'amount_cents',p.amount_cents,'status',p.status,'pay_date',p.pay_date,'invoice_url',l.invoice_url) end)
  from public.editor_monthly_terms t cross join items i
  left join public.editor_reconciliation_links l on l.workspace_id=t.workspace_id and l.editor_id=t.editor_id and l.billing_month=t.billing_month
  left join public.payouts p on p.id=l.payout_id
  where t.workspace_id=p_workspace and t.editor_id=p_editor and t.billing_month=p_month
$$;
revoke all on function public.preview_editor_statement(uuid,uuid,date) from public,anon;
grant execute on function public.preview_editor_statement(uuid,uuid,date) to authenticated;

create function public.save_editor_statement(p_workspace uuid,p_editor uuid,p_month date,p_version integer,p_document jsonb,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare
  latest public.editor_month_statements%rowtype;
  doc jsonb;
  jobs text[];
  next_version integer;
begin
  perform app.require_verified_session();
  if auth.uid() is null or not coalesce(app.is_admin(p_workspace),false) then raise exception 'Finance access required' using errcode='42501'; end if;
  if nullif(trim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'Enter a statement reason (up to 2000 characters)'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace::text||p_editor::text||p_month::text,1));
  select * into latest from public.editor_month_statements where workspace_id=p_workspace and editor_id=p_editor and billing_month=p_month order by version desc limit 1;
  if latest.document=p_document and latest.version in (p_version,p_version+1) then return latest.version; end if;
  if coalesce(latest.version,0) is distinct from p_version then raise exception 'Another version was saved. Review the current statement.'; end if;
  select public.preview_editor_statement(p_workspace,p_editor,p_month) into doc;
  if doc is null then raise exception 'Confirm monthly contract terms first'; end if;
  if doc is distinct from p_document then raise exception 'The report changed. Refresh and review the statement again.'; end if;
  select coalesce(array_agg(distinct coalesce(a.item->>'job_code',b.item->>'job_code') order by coalesce(a.item->>'job_code',b.item->>'job_code')),'{}')
    into jobs from jsonb_array_elements(doc->'items') a(item)
    full join jsonb_array_elements(coalesce(latest.document->'items','[]')) b(item) on a.item->>'id'=b.item->>'id'
    where a.item is distinct from b.item;
  next_version:=coalesce(latest.version,0)+1;
  insert into public.editor_month_statements(workspace_id,editor_id,billing_month,version,saved_by,actor_name,reason,delta_cents,affected_jobs,document)
    values(p_workspace,p_editor,p_month,next_version,auth.uid(),coalesce((select nullif(full_name,'') from public.profiles where id=auth.uid()),auth.uid()::text),
      trim(p_reason),(doc->>'total_cents')::bigint-coalesce((latest.document->>'total_cents')::bigint,0),jobs,doc);
  return next_version;
end $$;
revoke all on function public.save_editor_statement(uuid,uuid,date,integer,jsonb,text) from public,anon;
grant execute on function public.save_editor_statement(uuid,uuid,date,integer,jsonb,text) to authenticated;
