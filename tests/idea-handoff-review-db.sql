\set ON_ERROR_STOP on
-- Run on the disposable completion-bootstrap database after the idea handoff review migration.
begin;
create function pg_temp.ok(value boolean,message text) returns void language plpgsql as $$
begin if value is not true then raise exception '%', message; end if; end $$;
create function pg_temp.rejected(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then return true; end $$;
\set workspace '20000000-0000-0000-0000-000000000001'
\set admin '10000000-0000-0000-0000-000000000001'
\set editor '10000000-0000-0000-0000-000000000002'
\set idea 'a50c5300-0000-4000-8000-000000000002'
\set orphan 'a50c5300-0000-4000-8000-000000000003'
insert into public.brand_kits(workspace_id,name,kind) values(:'workspace','QA review brand','channel') returning id as brand \gset
insert into public.ideas(id,workspace_id,brand_id,title,author_id,stage,body,refs,script,research) values
(:'idea',:'workspace',:'brand','QA preview',:'admin','ready',array['Shoot on location'],array['https://example.test/drive'],'{"beats":[{"label":"Outro","text":"Wrap up"}]}','{"summary":"Evidence"}'),
(:'orphan',:'workspace',:'brand','Orphan',:'admin','approved',array['Keep'], '{}',null,null);
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","aal":"aal1"}';
select set_config('request.jwt.claim.sub',:'admin',true);
select public.preview_idea_project(:'idea') as preview \gset
select pg_temp.ok(not exists(select from public.projects where title='QA preview')
 and (select stage='ready' and project_id is null and archived_at is null from public.ideas where id=:'idea'), 'preview changed the board');
update public.ideas set title='QA revised preview' where id=:'idea';
select pg_temp.ok(pg_temp.rejected(format('select public.confirm_idea_project(%L,%L)',:'idea',(:'preview'::jsonb)->>'reviewKey')), 'obsolete preview created a project');
select public.preview_idea_project(:'idea') as preview \gset
select public.confirm_idea_project(:'idea',(:'preview'::jsonb)->>'reviewKey')->>'id' as project \gset
select pg_temp.ok((select idea_package-'approvedAt'=(:'preview'::jsonb)->'package' and brief=(:'preview'::jsonb)->>'brief'
 and title=(:'preview'::jsonb)#>>'{destination,title}' from public.projects where id=:'project'), 'editor package differed from preview');
select pg_temp.ok(public.confirm_idea_project(:'idea',(:'preview'::jsonb)->>'reviewKey')->>'id'=:'project','confirmation replay created another project');
update public.ideas set archived_at=null where id=:'idea';
select pg_temp.ok(public.review_historical_handoffs(:'workspace') @> jsonb_build_array(jsonb_build_object('id',:'idea','group','eligible'),jsonb_build_object('id',:'orphan','group','missing')),'review classification is wrong');
select pg_temp.ok(pg_temp.rejected(format('select public.archive_historical_handoffs(%L,%L)',:'workspace',jsonb_build_object(:'idea',:'project',:'orphan',:'project'))),'ineligible mixed batch accepted');
select pg_temp.ok((select archived_at is null from public.ideas where id=:'idea'), 'ineligible batch partially committed');
update public.projects set idea_package=jsonb_set(idea_package,'{ideaId}',to_jsonb(:'orphan'::text)) where id=:'project';
select pg_temp.ok(public.review_historical_handoffs(:'workspace') @> jsonb_build_array(jsonb_build_object('id',:'idea','group','review')),'mismatched snapshot was not flagged');
select pg_temp.ok(pg_temp.rejected(format('select public.archive_historical_handoffs(%L,%L)',:'workspace',jsonb_build_object(:'idea',:'project'))),'stale snapshot passed write revalidation');
update public.projects set idea_package=jsonb_set(idea_package,'{ideaId}',to_jsonb(:'idea'::text)) where id=:'project';
select pg_temp.ok(public.archive_historical_handoffs(:'workspace',jsonb_build_object(:'idea',:'project'))=1,'confirmed selection was not archived');
select pg_temp.ok(public.archive_historical_handoffs(:'workspace',jsonb_build_object(:'idea',:'project'))=0,'replay did not skip archived selection');
select pg_temp.ok((select count(*)=1 from public.activity_log where idea_id=:'idea' and project_id=:'project' and actor_id=:'admin' and action='archived a reviewed historical handoff'),'archive audit is missing or duplicated');
select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.ok(pg_temp.rejected(format('select public.review_historical_handoffs(%L)',:'workspace')),'editor could review');
select pg_temp.ok(pg_temp.rejected(format('select public.preview_idea_project(%L)',:'orphan')),'editor could preview');
select pg_temp.ok(pg_temp.rejected(format('select public.archive_historical_handoffs(%L,%L)',:'workspace',jsonb_build_object(:'idea',:'project'))),'editor could archive');
select set_config('request.jwt.claim.sub',:'admin',true);
select pg_temp.ok(pg_temp.rejected(format('select public.review_historical_handoffs(%L)',gen_random_uuid())),'foreign workspace visible');
rollback;
