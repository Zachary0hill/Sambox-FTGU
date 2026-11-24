\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(value boolean,message text) returns void language plpgsql as $$
begin if not coalesce(value,false) then raise exception 'FAIL: %',message; end if; end $$;
\set ws '20000000-0000-0000-0000-000000000001'
\set ed1 '10000000-0000-0000-0000-000000000002'
\set ed2 '10000000-0000-0000-0000-000000000004'
\set admin '10000000-0000-0000-0000-000000000001'
\set proj '30000000-0000-0000-0000-000000000001'
select date_trunc('month',now() at time zone 'America/Chicago')::date as month \gset
update public.project_edits set editor_id=:'ed1',edit_status='approved' where project_id=:'proj';
update public.project_edits set editor_id=:'ed2' where project_id=:'proj';
update public.project_edits set edit_status='needs_revision' where project_id=:'proj';
update public.project_edits set edit_status='approved' where project_id=:'proj';
select pg_temp.ok(count(*)=3 and count(*) filter (where kind='reassigned' and previous_editor_id=:'ed1')=1,
  'standalone editor change and reapproval are distinct review events') from public.editor_billing_lines where project_id=:'proj';
select pg_temp.ok(bool_and(missing_terms),'missing terms are visible before an operator confirms them')
  from public.editor_billing_lines where project_id=:'proj';
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","aal":"aal1"}';
select set_config('request.jwt.claim.sub',:'admin',true);
insert into public.editor_monthly_terms(workspace_id,editor_id,billing_month,included_units,retainer_cents,overage_cents,content_type_key)
  values(:'ws',:'ed1',:'month',0,10000,1250,'*'),(:'ws',:'ed2',:'month',0,12000,1500,'*');
select public.preview_editor_statement(:'ws',:'ed1',:'month')::text as doc \gset
select pg_temp.ok((:'doc'::jsonb->>'total_cents')::bigint=11250,'statement preview uses integer cents and the original credit');
select pg_temp.ok(public.save_editor_statement(:'ws',:'ed1',:'month',0,:'doc'::jsonb,'Approved initial report')=1,'save immutable baseline');
select pg_temp.ok(public.save_editor_statement(:'ws',:'ed1',:'month',0,:'doc'::jsonb,'Approved initial report')=1,'safe save retry');
select id as reassignment from public.editor_approval_entries where project_id=:'proj' and kind='reassigned' \gset
select public.decide_editor_credit(:'reassignment','credit',:'ed2','Finance confirmed handoff',0) as answer \gset
select pg_temp.ok(public.decide_editor_credit(:'reassignment','credit',:'ed2','Finance confirmed handoff',0)=:'answer','credit retry is idempotent');
select pg_temp.ok(count(*)=1 and bool_and(statement_editor_id=:'ed2'),'exactly one credited line after transfer')
  from public.editor_billing_lines where project_id=:'proj' and billing_reason='Counted';
select pg_temp.ok(count(*)=1 and bool_and(decided_by=:'admin') and bool_and(decided_at is not null),'decision has the operator and timestamp')
  from public.editor_credit_decisions where project_id=:'proj';
select public.preview_editor_statement(:'ws',:'ed1',:'month')::text as correction \gset
select pg_temp.ok(public.save_editor_statement(:'ws',:'ed1',:'month',1,:'correction'::jsonb,'QA-1 credited to the new editor')=2,'create correction');
select pg_temp.ok(delta_cents=-1250 and affected_jobs=array['QA-1'] and (document->>'total_cents')::bigint=10000,'correction has job, amount, delta and prior version')
  from public.editor_month_statements where editor_id=:'ed1' and version=2;
select pg_temp.ok(document=:'doc'::jsonb,'first version preserves original line items and rates') from public.editor_month_statements where editor_id=:'ed1' and version=1;
select pg_temp.ok(not has_table_privilege('authenticated','public.editor_month_statements','update') and
  not has_table_privilege('authenticated','public.editor_credit_decisions','insert'),'audit records allow only guarded RPC writes');
do $$ declare entry uuid; begin
  select id into entry from public.editor_billing_lines where kind='reassigned' limit 1;
  begin perform public.decide_editor_credit(entry,'exclude',null,'stale answer',0); raise exception 'stale decision accepted'; exception when raise_exception then
    if sqlerrm not like 'Credit has changed%' then raise; end if; end;
  begin perform public.save_editor_statement('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',
      date_trunc('month',now() at time zone 'America/Chicago')::date,2,'{}','forged total'); raise exception 'forged snapshot accepted'; exception when raise_exception then
    if sqlerrm not like 'The report changed%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',:'ed2',true);
select pg_temp.ok(count(*)=0,'editors cannot read immutable finance records') from public.editor_month_statements;
select pg_temp.ok(public.preview_editor_statement(:'ws',:'ed1',:'month') is null,'editors cannot preview other editors’ payments');
do $$ begin
  begin perform public.save_editor_statement('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004',current_date,0,'{}','test');
    raise exception 'editor could create a statement'; exception when insufficient_privilege then null; end;
end $$;
rollback;
