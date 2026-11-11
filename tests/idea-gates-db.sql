\set ON_ERROR_STOP on
-- Run last, after idea-rules-db.sql, in a disposable database only.
create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'FAIL: %',msg; end if; end $$;
\ir ../supabase/migrations/20261108000300_idea_gates.sql
grant select,insert,update,delete on public.tasks, public.content_entries to authenticated;
delete from public.ideas_rules;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return ''; exception when others then return sqlerrm; end $$;
create function pg_temp.idea(n int) returns uuid language sql as $$ select ('00000000-0000-8000-8000-0000000000c'||n)::uuid $$;
create function pg_temp.mv(n int, s text) returns text language sql as $$ select pg_temp.err(format('update public.ideas set stage=%L where id=%L', s, pg_temp.idea(n))) $$;
insert into public.ideas(id,workspace_id,brand_id,title,author_id,body,hook,platforms) values
 (pg_temp.idea(1),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000031','Empty idea','00000000-0000-0000-0000-000000000011','{}',null,'{}'),
 (pg_temp.idea(2),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000031','Full idea','00000000-0000-0000-0000-000000000011','{"Some notes"}','A hook well over twenty four chars','{"TikTok"}');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000011';

-- Default gate: nothing to enter Research, notes to enter Ready
select pg_temp.assert(pg_temp.mv(1,'research')='','research has no default gate');
select pg_temp.assert(pg_temp.mv(1,'ready')='Can''t move to Ready yet. Still needed: Notes written.','ready names the missing item');
select pg_temp.assert((select stage='research' from public.ideas where id=pg_temp.idea(1)),'blocked move changes nothing');
select pg_temp.assert(pg_temp.err(format('update public.ideas set status=%L where id=%L','approved',pg_temp.idea(1))) like 'Can''t approve yet. Still needed: Notes written.','a write to the old column is gated too');

-- Skipping a stage checks every gate on the way
select pg_temp.assert(pg_temp.err(format('select public.approve_idea_project(%L)',pg_temp.idea(1))) like 'Can''t approve yet%','approve runs the Ready gate');
select pg_temp.assert((select count(*)=0 from public.projects where title='Empty idea'),'a blocked approval rolls the project back');

-- Backward and archive are always allowed
select pg_temp.assert(pg_temp.mv(1,'inbox')='','moving back is allowed');
select pg_temp.assert(pg_temp.err(format('update public.ideas set archived_at=now() where id=%L',pg_temp.idea(1)))='','archiving is allowed');
update public.ideas set archived_at=null where id=pg_temp.idea(1);

-- Rules change the gates, and every missing item is named
reset role;
insert into public.ideas_rules(workspace_id,rules) values('00000000-0000-0000-0000-000000000001','{"required_fields_by_stage":{"research":["source"],"ready":["notes","cover","score"]},"recommendation":{"pursue":70,"park":45}}');
set role authenticated;
select pg_temp.assert(pg_temp.mv(1,'research')='Can''t move to Research yet. Still needed: At least one source.','research gate from Rules');
update public.ideas set refs='{"https://example.com"}' where id=pg_temp.idea(1);
select pg_temp.assert(pg_temp.mv(1,'ready')='Can''t move to Ready yet. Still needed: Notes written, Cover image set, Score at the Pursue threshold.','each missing item is named');
update public.ideas set body='{"Now with notes"}',cover_path='x/y/z.png',impact=7,confidence=7,ease=6 where id=pg_temp.idea(1);
select pg_temp.assert(pg_temp.mv(1,'ready') like '%Score at the Pursue threshold.','score below the threshold fails');
update public.ideas set ease=7 where id=pg_temp.idea(1);
select pg_temp.assert(pg_temp.mv(1,'ready')='','score at the threshold passes');
reset role;
delete from public.ideas_rules;
set role authenticated;

-- Converting
select pg_temp.assert(pg_temp.err(format('select public.convert_idea(%L,%L)',pg_temp.idea(2),'task'))='Move the idea to Ready before approving it','inbox cannot convert');
update public.ideas set stage='research' where id=pg_temp.idea(2);
update public.ideas set stage='ready' where id=pg_temp.idea(2);
select public.convert_idea(pg_temp.idea(2),'task');
select pg_temp.assert((select stage='approved' and approved_by='00000000-0000-0000-0000-000000000011' and jsonb_array_length(converted)=1 and converted->0->>'kind'='task' from public.ideas where id=pg_temp.idea(2)),'task conversion approves and records');
select pg_temp.assert((select count(*)=1 and min(owner_id::text)='00000000-0000-0000-0000-000000000011' from public.tasks where text='Full idea'),'task belongs to the owner');
select public.convert_idea(pg_temp.idea(2),'social');
select pg_temp.assert((select jsonb_array_length(converted)=2 and status='approved' from public.ideas where id=pg_temp.idea(2)),'an idea converts many times');
select pg_temp.assert((select count(*)=1 and min(platform)='tiktok' and min(status)='scheduled' and min(notes)='Some notes' and min(length(hook))=24 from public.content_entries where title='Full idea'),'social post carries the brief');
select pg_temp.assert((select id is not null from public.projects limit 1),'projects still exist');
select public.approve_idea_project(pg_temp.idea(2));
select pg_temp.assert((select jsonb_array_length(converted)=3 and project_id is not null and status='in_production' from public.ideas where id=pg_temp.idea(2)),'project can follow other conversions');

-- Roles
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000013';
select pg_temp.assert(pg_temp.err(format('select public.convert_idea(%L,%L)',pg_temp.idea(2),'task')) in ('You cannot approve this idea','Idea not available'),'editor cannot convert');
reset role;
select pg_temp.assert(pg_temp.err(format('select public.convert_idea(%L,%L)',pg_temp.idea(2),'email')) like 'Choose what%','unknown target refused');
-- Research results feed the gates
create schema if not exists cron;
create or replace function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';
\ir ../supabase/migrations/20261108000400_idea_research.sql
grant select on public.ai_usage to authenticated;
insert into public.ideas(id,workspace_id,brand_id,title,author_id,body) values (pg_temp.idea(3),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000031','Researched','00000000-0000-0000-0000-000000000011','{"Notes"}');
insert into public.ideas_rules(workspace_id,rules) values('00000000-0000-0000-0000-000000000001','{"required_fields_by_stage":{"research":[],"ready":["research","pursue"]},"recommendation":{"pursue":70,"park":45}}');
select pg_temp.assert(pg_temp.mv(3,'ready')='Can''t move to Ready yet. Still needed: Research finished, Research says Pursue.','research gates name what is missing');
update public.ideas set research='{"summary":"s","score":{"total":60}}' where id=pg_temp.idea(3);
select pg_temp.assert(pg_temp.mv(3,'ready')='Can''t move to Ready yet. Still needed: Research says Pursue.','a low score is not Pursue');
update public.ideas set research='{"summary":"s","score":{"total":70}}' where id=pg_temp.idea(3);
select pg_temp.assert(pg_temp.mv(3,'ready')='','a Pursue score passes');
update public.ideas_rules set rules='{"required_fields_by_stage":{"research":[],"ready":["score"]},"recommendation":{"pursue":80,"park":45}}';
update public.ideas set stage='inbox' where id=pg_temp.idea(3);
select pg_temp.assert(pg_temp.mv(3,'ready') like '%Score at the Pursue threshold.','the research score is used over ICE');
delete from public.ideas_rules;

-- Server jobs use the secret-key role, which has no access to the app schema
\ir ../supabase/migrations/20261108000500_idea_gate_definer.sql
do $$ begin if not exists(select from pg_roles where rolname='service_role') then create role service_role; end if; end $$;
revoke usage on schema app from service_role;
grant usage on schema public to service_role;
grant select,update on public.ideas to service_role;
update public.ideas set stage='inbox' where id=pg_temp.idea(3);
set role service_role;
update public.ideas set stage='research' where id=pg_temp.idea(3);
reset role;
select pg_temp.assert((select stage='research' from public.ideas where id=pg_temp.idea(3)),'a server job can move an idea');
select 'idea gates db: pass';
