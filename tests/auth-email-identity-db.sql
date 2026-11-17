\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(v boolean,m text) returns void language plpgsql as $$begin if not coalesce(v,false) then raise exception 'FAIL: %',m; end if; end$$;
create function pg_temp.err(q text) returns text language plpgsql as $$begin execute q; return ''; exception when others then return sqlstate; end$$;
insert into auth.users(id,email,email_confirmed_at) values
('a1000000-0000-0000-0000-000000000001','identity-member@example.test',now()),
('a1000000-0000-0000-0000-000000000002','identity-recipient@example.test',now()),
('a1000000-0000-0000-0000-000000000003','identity-unconfirmed@example.test',null);
set role authenticated;
set request.jwt.claim.sub='a1000000-0000-0000-0000-000000000001';
set request.jwt.claims='{"role":"authenticated","aal":"aal1"}';
select pg_temp.ok(pg_temp.err($q$update profiles set email='identity-recipient@example.test' where id='a1000000-0000-0000-0000-000000000001'$q$)='42501','profile email cannot change authentication identity');
update profiles set full_name='Updated display name' where id='a1000000-0000-0000-0000-000000000001';
select pg_temp.ok((select full_name='Updated display name' from profiles where id='a1000000-0000-0000-0000-000000000001'),'ordinary profile edits preserved');
reset role;
update auth.users set email='identity-updated@example.test' where id='a1000000-0000-0000-0000-000000000001';
select pg_temp.ok((select email='identity-updated@example.test' from profiles where id='a1000000-0000-0000-0000-000000000001'),'auth email changes synchronize profile contact address');
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select pg_temp.ok(invite_member(' IDENTITY-RECIPIENT@EXAMPLE.TEST ','Recipient','designer',null,null)='added','confirmed auth recipient is added');
select pg_temp.ok((select role='designer' from workspace_members where workspace_id='20000000-0000-0000-0000-000000000001' and user_id='a1000000-0000-0000-0000-000000000002'),'membership assigned to authenticated identity');
select pg_temp.ok(not exists(select 1 from workspace_members where workspace_id='20000000-0000-0000-0000-000000000001' and user_id='a1000000-0000-0000-0000-000000000001'),'other account never receives recipient membership');
select pg_temp.ok(invite_member('identity-unconfirmed@example.test','Pending','editor',null,null)='invited','unconfirmed identity waits for email verification');
select pg_temp.ok(not exists(select 1 from workspace_members where workspace_id='20000000-0000-0000-0000-000000000001' and user_id='a1000000-0000-0000-0000-000000000003'),'unconfirmed recipient has no membership');
reset role;
update auth.users set email_confirmed_at=now() where id='a1000000-0000-0000-0000-000000000003';
select pg_temp.ok((select role='editor' from workspace_members where workspace_id='20000000-0000-0000-0000-000000000001' and user_id='a1000000-0000-0000-0000-000000000003'),'verification still applies pending invitation');
insert into auth.mfa_factors(user_id,status,factor_type) values('10000000-0000-0000-0000-000000000001','verified','totp');
set role authenticated;
select pg_temp.ok(pg_temp.err($q$select invite_member('identity-new@example.test','New','editor',null,null)$q$)='42501','updated invite RPC preserves MFA guard');
set request.jwt.claims='{"role":"authenticated","aal":"aal2"}';
select pg_temp.ok(invite_member('identity-new@example.test','New','editor',null,null)='invited','AAL2 verified administrator can invite');
rollback;
select 'Authentication email identity acceptance passed' result;
