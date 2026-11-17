-- Run only against the disposable completion-bootstrap database; all rows roll back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(v boolean,m text) returns void language plpgsql as $$
begin if not coalesce(v,false) then raise exception 'FAIL: %',m; end if; end $$;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
set request.jwt.claims='{"role":"authenticated","aal":"aal2"}';
insert into brand_kits(id,workspace_id,name,kind,assets) values (
 '60000000-0000-0000-0000-000000000099',
 '20000000-0000-0000-0000-000000000001','Cleanup acceptance','sponsor',
 '[{"path":"20000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000099/keep.png"},
   {"path":"20000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000099/remove.png"},
   {"path":"other-workspace/other-brand/retain.png"}]'
);
savepoint before_removal;
update brand_kits set assets='[{"path":"20000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000099/keep.png"}]'
where id='60000000-0000-0000-0000-000000000099';
select pg_temp.ok((select count(*)=1 from storage_cleanup where bucket='brand-assets' and path like '%/60000000-0000-0000-0000-000000000099/%'),'only removed owned path queued');
select pg_temp.ok(not exists(select 1 from storage_cleanup where path='other-workspace/other-brand/retain.png'),'foreign path never queued');
rollback to before_removal;
select pg_temp.ok(not exists(select 1 from storage_cleanup where path like '%/60000000-0000-0000-0000-000000000099/%'),'metadata rollback also rolls back cleanup');
update brand_kits set assets='[{"path":"20000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000099/keep.png"}]'
where id='60000000-0000-0000-0000-000000000099';
update brand_kits set assets=assets where id='60000000-0000-0000-0000-000000000099';
select pg_temp.ok((select count(*)=1 from storage_cleanup where bucket='brand-assets' and path like '%/60000000-0000-0000-0000-000000000099/%'),'retained asset does not queue on unchanged update');
delete from brand_kits where id='60000000-0000-0000-0000-000000000099';
select pg_temp.ok((select count(*)=2 from storage_cleanup where bucket='brand-assets' and path like '%/60000000-0000-0000-0000-000000000099/%'),'brand delete still queues remaining owned files');
rollback;
