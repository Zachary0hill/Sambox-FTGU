\set ON_ERROR_STOP on
-- Transactional acceptance against the seeded completion-bootstrap database.
begin;
create function pg_temp.ok(value boolean, message text) returns void
language plpgsql as $$ begin if not coalesce(value,false) then raise exception 'FAIL: %',message; end if; end $$;
\set ws '20000000-0000-0000-0000-000000000001'
\set editor '10000000-0000-0000-0000-000000000002'
\set other '10000000-0000-0000-0000-000000000004'
\set admin '10000000-0000-0000-0000-000000000001'
\set proj '30000000-0000-0000-0000-000000000001'
\set payout '86000000-0000-0000-0000-000000000001'
select date_trunc('month',now() at time zone 'America/Chicago')::date as month \gset
update public.project_edits set edit_status='approved' where project_id=:'proj';
update public.project_edits set edit_status='approved' where project_id=:'proj';
update public.project_edits set edit_status='needs_revision', editor_id=:'other' where project_id=:'proj';
update public.project_edits set edit_status='approved' where project_id=:'proj';
select pg_temp.ok(count(*)=2 and count(*) filter (where kind='first' and editor_id=:'editor')=1
  and count(*) filter (where kind='repeat' and editor_id=:'other')=1,'single credit before reassignment, reapproval and retry')
  from public.editor_approval_entries where project_id=:'proj' and billing_month=:'month' and kind in ('first','repeat');
insert into public.payouts(id,workspace_id,user_id,role,description) values(:'payout',:'ws',:'editor','editor','Invoice');
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","aal":"aal1"}';
select set_config('request.jwt.claim.sub', :'admin', true);
insert into public.editor_monthly_terms(workspace_id,editor_id,billing_month,included_units,retainer_cents,overage_cents,content_type_key)
  values(:'ws',:'editor',:'month',10,10000,1250,'*');
select pg_temp.ok(confirmed_by=:'admin' and retainer_cents=10000,'authenticated admin confirms month-specific terms')
  from public.editor_monthly_terms where editor_id=:'editor';
insert into public.editor_reconciliation_links(workspace_id,editor_id,billing_month,payout_id,invoice_url)
  values(:'ws',:'editor',:'month',:'payout','https://example.test/invoice');
insert into public.editor_reconciliation_links(workspace_id,editor_id,billing_month,payout_id,invoice_url)
  values(:'ws',:'editor',:'month',:'payout','https://example.test/correction')
  on conflict (workspace_id,editor_id,billing_month) do update set invoice_url=excluded.invoice_url;
select pg_temp.ok(count(*)=1,'payout link updates idempotently') from public.editor_reconciliation_links;
select pg_temp.ok(status='pending_approval' and amount_cents=0,'linking an invoice preserves payout amount and status')
  from public.payouts where id=:'payout';
insert into public.editor_monthly_terms(workspace_id,editor_id,billing_month,included_units,retainer_cents,overage_cents,content_type_key)
  values(:'ws',:'other',:'month',0,100,0,'*');
do $$ begin
  begin
    update public.editor_reconciliation_links set editor_id='10000000-0000-0000-0000-000000000004';
    raise exception 'linked payout accepted a different editor';
  exception when foreign_key_violation then null; end;
end $$;
select pg_temp.ok(not has_table_privilege('authenticated','public.editor_approval_entries','insert')
  and not has_table_privilege('authenticated','public.editor_monthly_terms','update'),'users cannot fabricate approvals or change confirmed monthly rates');
select set_config('request.jwt.claim.sub', :'editor', true);
select pg_temp.ok(count(*)=0,'editor cannot read private approval accounting') from public.editor_approval_entries;
select pg_temp.ok(count(*)=0,'editor cannot read contract rates') from public.editor_monthly_terms;
select pg_temp.ok(count(*)=0,'editor cannot read payout or invoice links') from public.editor_reconciliation_links;
rollback;
