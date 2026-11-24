-- Run after the full schema bootstrap, in a disposable database.
\set ON_ERROR_STOP on
begin;
\set ws '20000000-0000-0000-0000-000000000001'
\set src 'ac750000-0000-4000-a000-000000000001'
\set rev 'ac750000-0000-4000-a000-000000000002'
\set stale 'ac750000-0000-4000-a000-000000000003'
insert into public.automations(id,workspace_id,name,trigger,actions) values
  (:'src',:'ws','Original','{"key":"status","value":"Ready"}','[{"key":"buffer_draft"}]');
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","aal":"aal1"}';
set local request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
insert into public.automations(id,workspace_id,name,is_draft,revision_source_id,flow) values
  (:'rev',:'ws','My revision',true,:'src','{"kind":"automation","lastTest":{"ok":true}}'),
  (:'stale',:'ws','Sibling revision',true,:'src','{"kind":"automation","lastTest":{"ok":true}}');
create function pg_temp.ok(b boolean,msg text) returns void language plpgsql as $$ begin if not coalesce(b,false) then raise exception '%',msg;end if;end $$;
create function pg_temp.activate(id uuid) returns uuid language sql as $$
  select public.apply_workflow_revision(id,'{"kind":"automation","lastTest":{"ok":true}}',
    '{"name":"Reviewed","category":"custom","app":"Buffer","when_text":"on schedule","then_text":"publish","flow":{"kind":"automation","lastTest":{"ok":true}},"trigger":{"key":"publishing_scheduled"},"actions":[{"key":"buffer_publish"}]}') $$;
create function pg_temp.rejected(id uuid) returns boolean language plpgsql as $$
begin perform pg_temp.activate(id);return false;exception when others then return true;end $$;
create function pg_temp.shortcut_denied(id uuid) returns boolean language plpgsql as $$
begin update public.automations a set is_draft=false where a.id=$1;return false;exception when check_violation then return true;end $$;
select pg_temp.ok((select revision_baseline->'actions'->0->>'key'='buffer_draft' from public.automations where id=:'rev'),'stored origin snapshot');
select pg_temp.ok(pg_temp.shortcut_denied(:'rev'),'draft shortcut must fail');
set local request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
select pg_temp.ok(pg_temp.rejected(:'rev'),'editor cannot activate a revision');
set local request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select pg_temp.ok(pg_temp.activate(:'rev')=:'src','existing identity retained');
select pg_temp.ok(pg_temp.activate(:'rev')=:'src','retry returns original identity');
select pg_temp.ok(pg_temp.rejected(:'stale'),'concurrent sibling revision must be stale');
select pg_temp.ok((select count(*)=1 from public.automations where id in (:'src',:'rev',:'stale') and enabled and not is_draft),'one live trigger');
select pg_temp.ok((select actions->0->>'key'='buffer_publish' and name='Original' from public.automations where id=:'src'),'expected live action');
rollback;
