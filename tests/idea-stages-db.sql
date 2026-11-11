\set ON_ERROR_STOP on
-- Run after planning-db-bootstrap.sql, before planning-db.sql, in a disposable database only.
-- Seeds ideas in every old status, applies the stage migration, then proves the backfill and the sync trigger.
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'FAIL: %',msg; end if; end $$;

insert into auth.users(id,email) values ('00000000-0000-8000-8000-000000000091','stages@example.test');
insert into public.workspaces(id,name,slug) values ('00000000-0000-8000-8000-000000000092','Stages QA','stages-qa');
select app.seed_workspace('00000000-0000-8000-8000-000000000092');
insert into public.channels(id,workspace_id,name) values ('00000000-0000-8000-8000-000000000093','00000000-0000-8000-8000-000000000092','Stages client');
insert into public.brand_kits(id,workspace_id,name,kind,channel_id) values ('00000000-0000-8000-8000-000000000094','00000000-0000-8000-8000-000000000092','Stages client','channel','00000000-0000-8000-8000-000000000093');
insert into public.projects(id,workspace_id,job_code,title,channel_id,status_id)
  select '00000000-0000-8000-8000-000000000095','00000000-0000-8000-8000-000000000092','IDEA-STAGES','Linked project','00000000-0000-8000-8000-000000000093',id
  from public.project_statuses where workspace_id='00000000-0000-8000-8000-000000000092' order by sort limit 1;

insert into public.ideas(id,workspace_id,brand_id,title,author_id,status,prev_status,project_id) values
 ('00000000-0000-8000-8000-0000000000a1','00000000-0000-8000-8000-000000000092','00000000-0000-8000-8000-000000000094','Draft','00000000-0000-8000-8000-000000000091','draft',null,null),
 ('00000000-0000-8000-8000-0000000000a2','00000000-0000-8000-8000-000000000092','00000000-0000-8000-8000-000000000094','Review','00000000-0000-8000-8000-000000000091','in_review',null,null),
 ('00000000-0000-8000-8000-0000000000a3','00000000-0000-8000-8000-000000000092','00000000-0000-8000-8000-000000000094','Approved','00000000-0000-8000-8000-000000000091','approved',null,null),
 ('00000000-0000-8000-8000-0000000000a4','00000000-0000-8000-8000-000000000092','00000000-0000-8000-8000-000000000094','Production','00000000-0000-8000-8000-000000000091','in_production','approved','00000000-0000-8000-8000-000000000095'),
 ('00000000-0000-8000-8000-0000000000a5','00000000-0000-8000-8000-000000000092','00000000-0000-8000-8000-000000000094','Archived review','00000000-0000-8000-8000-000000000091','archived','in_review',null),
 ('00000000-0000-8000-8000-0000000000a6','00000000-0000-8000-8000-000000000092','00000000-0000-8000-8000-000000000094','Archived none','00000000-0000-8000-8000-000000000091','archived',null,null);

alter table public.ideas disable trigger set_updated_at;
update public.ideas set updated_at='2026-10-01T00:00:00Z' where workspace_id='00000000-0000-8000-8000-000000000092';
alter table public.ideas enable trigger set_updated_at;

\ir ../supabase/migrations/20261108000100_idea_stages.sql

create function pg_temp.st(n int) returns text language sql as $$ select stage::text||'/'||status::text||'/'||(archived_at is not null)::text from public.ideas where id=('00000000-0000-8000-8000-0000000000a'||n)::uuid $$;

-- Backfill
select pg_temp.assert(pg_temp.st(1)='inbox/draft/false','draft becomes inbox');
select pg_temp.assert(pg_temp.st(2)='research/in_review/false','in review becomes research');
select pg_temp.assert(pg_temp.st(3)='approved/approved/false','approved stays approved');
select pg_temp.assert(pg_temp.st(4)='approved/in_production/false','in production becomes approved');
select pg_temp.assert(pg_temp.st(5)='research/archived/true','archived keeps its stage');
select pg_temp.assert(pg_temp.st(6)='inbox/archived/true','archived with no history falls back to inbox');
select pg_temp.assert((select count(*)=6 from public.ideas where workspace_id='00000000-0000-8000-8000-000000000092' and updated_at='2026-10-01T00:00:00Z'),'backfill does not touch updated_at');
select pg_temp.assert((select converted->0->>'kind'='project' and converted->0->>'id'='00000000-0000-8000-8000-000000000095' and jsonb_array_length(converted)=1 from public.ideas where title='Production'),'linked project recorded in converted');
select pg_temp.assert((select converted='[]'::jsonb from public.ideas where title='Draft'),'unlinked idea has no conversions');

-- New client writes stage and archived_at
update public.ideas set stage='ready' where title='Review';
select pg_temp.assert(pg_temp.st(2)='ready/in_review/false','ready reads as in review for old clients');
update public.ideas set archived_at=now() where title='Review';
select pg_temp.assert(pg_temp.st(2)='ready/archived/true','archiving keeps the stage');
select pg_temp.assert((select prev_status='in_review' from public.ideas where title='Review'),'old clients can still restore');
update public.ideas set archived_at=null where title='Review';
select pg_temp.assert(pg_temp.st(2)='ready/in_review/false','restore returns to the same stage');
update public.ideas set stage='inbox' where title='Review';
select pg_temp.assert(pg_temp.st(2)='inbox/draft/false','moving back is allowed');

-- Old client writes status and prev_status
update public.ideas set status='in_review' where title='Draft';
select pg_temp.assert(pg_temp.st(1)='research/in_review/false','old forward move sets the stage');
update public.ideas set status='archived',prev_status='in_review' where title='Draft';
select pg_temp.assert(pg_temp.st(1)='research/archived/true','old archive sets the flag');
update public.ideas set status='in_review',prev_status=null where title='Draft';
select pg_temp.assert(pg_temp.st(1)='research/in_review/false','old restore clears the flag');

-- Unrelated edits and inserts from both sides
update public.ideas set title='Draft edited' where title='Draft';
select pg_temp.assert(pg_temp.st(1)='research/in_review/false','title edit leaves the stage alone');
insert into public.ideas(id,workspace_id,brand_id,title,author_id,status) values ('00000000-0000-8000-8000-0000000000a7','00000000-0000-8000-8000-000000000092','00000000-0000-8000-8000-000000000094','Old insert','00000000-0000-8000-8000-000000000091','in_review');
select pg_temp.assert(pg_temp.st(7)='research/in_review/false','old insert maps to a stage');
insert into public.ideas(id,workspace_id,brand_id,title,author_id,stage) values ('00000000-0000-8000-8000-0000000000a8','00000000-0000-8000-8000-000000000092','00000000-0000-8000-8000-000000000094','New insert','00000000-0000-8000-8000-000000000091','research');
select pg_temp.assert(pg_temp.st(8)='research/in_review/false','new insert maps to a status');
insert into public.ideas(id,workspace_id,brand_id,title,author_id) values ('00000000-0000-8000-8000-0000000000a9','00000000-0000-8000-8000-000000000092','00000000-0000-8000-8000-000000000094','Default insert','00000000-0000-8000-8000-000000000091');
select pg_temp.assert(pg_temp.st(9)='inbox/draft/false','a bare insert lands in inbox');
-- planning-db.sql counts workspaces, so leave none behind.
delete from public.workspaces where id='00000000-0000-8000-8000-000000000092';
select 'idea stages db: pass';
