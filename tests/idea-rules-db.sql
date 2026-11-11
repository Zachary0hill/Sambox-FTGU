\set ON_ERROR_STOP on
-- Run last, after planning-db-bootstrap.sql, idea-stages-db.sql, planning-db.sql and idea-import-db.sql, in a disposable database only.
create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'FAIL: %',msg; end if; end $$;
insert into public.ideas(id,workspace_id,brand_id,title,author_id,type,format) values
 ('00000000-0000-8000-8000-0000000000b1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000032','Backfill script','00000000-0000-0000-0000-000000000011','script','short');
\ir ../supabase/migrations/20261108000200_ideas_rules.sql
grant select,insert,update,delete on public.ideas_rules to authenticated;

select pg_temp.assert((select idea_type='Script' from public.ideas where title='Backfill script'),'existing type backfilled');
insert into public.ideas(id,workspace_id,brand_id,title,author_id,type) values ('00000000-0000-8000-8000-0000000000b2','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000032','Old type insert','00000000-0000-0000-0000-000000000011','research');
select pg_temp.assert((select idea_type='Research' from public.ideas where title='Old type insert'),'old insert sets idea_type');
insert into public.ideas(id,workspace_id,brand_id,title,author_id,idea_type,format) values ('00000000-0000-8000-8000-0000000000b3','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000032','New type insert','00000000-0000-0000-0000-000000000011','Sponsor spot','Vertical doc');
select pg_temp.assert((select idea_type='Sponsor spot' and type='idea' and format='Vertical doc' from public.ideas where title='New type insert'),'custom type and format are accepted');
update public.ideas set idea_type='Script' where title='New type insert';
select pg_temp.assert((select type='script' from public.ideas where title='New type insert'),'new type write syncs the old column');
update public.ideas set type='research' where title='New type insert';
select pg_temp.assert((select idea_type='Research' from public.ideas where title='New type insert'),'old type write syncs the new column');
update public.ideas set title='Renamed' where title='Backfill script';
select pg_temp.assert((select idea_type='Script' and type='script' from public.ideas where title='Renamed'),'unrelated edit leaves the type alone');

create function pg_temp.denied(sql text) returns boolean language plpgsql as $$ begin execute sql; return false; exception when insufficient_privilege then return true; end $$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000012';
select pg_temp.assert(pg_temp.denied($q$insert into public.ideas_rules(workspace_id,rules) values('00000000-0000-0000-0000-000000000001','{"pillars":["Nope"]}')$q$),'manager cannot create Rules');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000011';
insert into public.ideas_rules(workspace_id,rules) values('00000000-0000-0000-0000-000000000001','{"pillars":["Mine"]}');
update public.ideas_rules set rules='{"pillars":["Updated"]}' where workspace_id='00000000-0000-0000-0000-000000000001';
select pg_temp.assert((select rules->'pillars'->>0='Updated' from public.ideas_rules),'Super Admin saves Rules');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000012';
select pg_temp.assert((select count(*)=1 from public.ideas_rules),'manager reads Rules');
update public.ideas_rules set rules='{"pillars":["Hacked"]}';
select pg_temp.assert((select rules->'pillars'->>0='Updated' from public.ideas_rules),'manager update changes nothing');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000013';
select pg_temp.assert((select count(*)=1 from public.ideas_rules),'editor reads Rules');
delete from public.ideas_rules;
select pg_temp.assert((select count(*)=1 from public.ideas_rules),'nobody can delete Rules');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000099';
select pg_temp.assert((select count(*)=0 from public.ideas_rules),'a non-member reads nothing');
reset role;
select 'idea rules db: pass';
