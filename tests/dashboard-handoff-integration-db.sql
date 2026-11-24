\set ON_ERROR_STOP on
-- Run on the disposable completion-bootstrap schema. Reuses one idea, edit and job throughout.
begin;
create function pg_temp.check_that(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%', message; end if; end $$;
\set ws '20000000-0000-0000-0000-000000000001'
\set admin '10000000-0000-0000-0000-000000000001'
insert into auth.users(id,email) values(gen_random_uuid(),'dashboard-handoff-editor@example.test') returning id as editor \gset
insert into public.workspace_members(workspace_id,user_id,role,status) values(:'ws',:'editor','editor','active');
select clock_timestamp() as started \gset
insert into public.accounts(workspace_id,name,type) values (:'ws','Integration client','client') returning id as client \gset
insert into public.channels(workspace_id,name,owner_account_id) values (:'ws','Integration studio channel',:'client') returning id as channel \gset
insert into public.brand_kits(workspace_id,name,kind,channel_id,account_id)
  values (:'ws','Integration brand','channel',:'channel',:'client') returning id as brand \gset
insert into public.ideas(workspace_id,brand_id,title,author_id,stage,format,body,refs,script)
  values(:'ws',:'brand','Integration delivery',:'admin','ready','short',array['Shoot notes'],array['https://example.test/ref'],
         '{"beats":[{"time":"0:01","label":"Intro","text":"Integration script"}]}') returning id as idea \gset
set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin', true);
set local request.jwt.claims = '{"role":"authenticated","aal":"aal1"}';
select public.preview_idea_project(:'idea') as handoff \gset
select pg_temp.check_that(project_id is null and archived_at is null,'Package preview changed the source idea')
from public.ideas where id=:'idea';
select (public.confirm_idea_project(:'idea',:'handoff'::jsonb->>'reviewKey')->>'id')::uuid as project \gset
reset role;
select job_code as job from public.projects where id=:'project' \gset
select pg_temp.check_that(idea_package - 'approvedAt' = :'handoff'::jsonb->'package','Editor received a different package than the operator previewed')
from public.projects where id=:'project';
select pg_temp.check_that(archived_at is not null and project_id=:'project','Idea no longer points to its production handoff')
from public.ideas where id=:'idea';
insert into public.project_edits(project_id,editor_id,edit_status) values(:'project',:'editor','in_review')
on conflict(project_id) do update set editor_id=excluded.editor_id, edit_status=excluded.edit_status;
select clock_timestamp() as reviewed \gset
update public.project_edits set edit_status='approved' where project_id=:'project';
insert into public.project_assets(project_id,name,kind,version,storage_path,mime_type)
  values(:'project','short-v1.mp4','final',1,:'ws'||'/'||:'project'||'/short-v1.mp4','video/mp4') returning id as asset \gset
insert into public.buffer_channels(workspace_id,channel_id,organization_id,name,service,draft_brand_id)
  values(:'ws','integration-destination','fixture','Client draft destination','instagram',:'brand');
insert into public.project_publish(project_id,draft_brand_id,draft_asset_id) values(:'project',:'brand',:'asset');
set local role authenticated;
insert into public.dev_notes(workspace_id,content,created_by,page_path)
  values(:'ws','Review the numbering of this handoff',:'admin','/projects') returning id as note \gset
select pg_temp.check_that((public.record_dev_note_decision(:'note',0,gen_random_uuid(),'assign','','job_codes',:'admin',:'project')).project_id=:'project',
  'Dev Notes lost its link to the newly handed-off project');
select pg_temp.check_that(not is_resolved,'Assigning a review must leave the original Dev Note open') from public.dev_notes where id=:'note';
insert into public.automations(workspace_id,name,trigger,actions)
  values(:'ws','Integration schedule','{"key":"publishing_scheduled"}','[{"key":"todo_admin"}]') returning id as live \gset
\set draft_flow '{"kind":"automation","trigger":{"key":"publishing_scheduled"},"steps":[{"id":"step","type":"action","key":"buffer_draft"}],"lastTest":{"ok":true}}'
insert into public.automations(workspace_id,name,is_draft,revision_source_id,flow)
  values(:'ws','Integration schedule revision',true,:'live',:'draft_flow') returning id as revision \gset
select pg_temp.check_that(public.apply_workflow_revision(:'revision',:'draft_flow',
  jsonb_build_object('flow',:'draft_flow'::jsonb,'trigger',:'draft_flow'::jsonb->'trigger','actions','[{"key":"buffer_draft"}]'::jsonb,
    'category','publishing','when_text','When Scheduled','then_text','Create draft','app','Buffer'))=:'live',
  'Applying a draft revision changed the live automation identity');
select pg_temp.check_that(count(*)=1,'Board readiness lost the approved Final on the linked project')
from public.buffer_draft_readiness(:'ws') where project_id=:'project' and asset_id=:'asset' and brand_id=:'brand' and edit_approved and workflow_live;
reset role;
select pg_temp.check_that(public.prepare_buffer_draft(:'ws',:'project')->'channels' @> '[{"id":"integration-destination"}]',
   'Project made by idea approval cannot be routed to its own brand');
select pg_temp.check_that(public.production_digest_rows(:'ws',:'started',:'reviewed') @> jsonb_build_array(jsonb_build_object('bucket','in_review','job',:'job')),
   'Prior cutoff lost review after the edit was approved');
select pg_temp.check_that(public.production_digest_rows(:'ws',:'reviewed',clock_timestamp()) @> jsonb_build_array(jsonb_build_object('bucket','completed','job',:'job')),
   'Approval is missing from the next reporting window');
select pg_temp.check_that(count(*)=1,'Approval must credit one billable short to its editor')
from public.editor_approval_entries where workspace_id=:'ws' and project_id=:'project' and editor_id=:'editor' and kind='first' and content_type_key='shortform';
select pg_temp.check_that((public.production_digest_snapshot(:'ws',:'started',:'reviewed')->'rows') @>
  jsonb_build_array(jsonb_build_object('bucket','in_review','job',:'job')),
  'Time-selected digest preview missed the same job');
select pg_temp.check_that(count(*)=1,'Billing exception queue must retain the approved project while its terms are missing')
from public.editor_billing_lines where project_id=:'project' and statement_editor_id=:'editor' and missing_terms and is_winner;
select pg_temp.check_that(count(*)=0,'Preview created a Buffer draft') from public.buffer_publications where project_id=:'project';
select billing_month as month from public.editor_approval_entries where project_id=:'project' and kind='first' \gset
set local role authenticated;
insert into public.editor_monthly_terms(workspace_id,editor_id,billing_month,included_units,retainer_cents,overage_cents,content_type_key)
  values(:'ws',:'editor',:'month',0,10000,2000,'shortform');
select public.preview_editor_statement(:'ws',:'editor',:'month') as document \gset
select pg_temp.check_that((:'document'::jsonb->>'total_cents')::bigint=12000,'Statement should contain retainer plus one short');
select pg_temp.check_that(public.save_editor_statement(:'ws',:'editor',:'month',0,:'document'::jsonb,'Checked the approved delivery')=1,'Initial statement version missing');
reset role;
update public.project_edits set edit_status='needs_revision' where project_id=:'project';
update public.project_edits set edit_status='approved' where project_id=:'project';
select id as repeat from public.editor_approval_entries where project_id=:'project' and kind='repeat' \gset
set local role authenticated;
select public.decide_editor_credit(:'repeat','retain',null,'Reapproval of the same delivery',0);
select pg_temp.check_that((public.preview_editor_statement(:'ws',:'editor',:'month')->>'total_cents')::bigint=12000,'Reapproval doubled the charge');
select pg_temp.check_that(document=:'document'::jsonb,'An approval change modified an already saved statement')
from public.editor_month_statements where workspace_id=:'ws' and editor_id=:'editor' and billing_month=:'month' and version=1;
reset role;
select pg_temp.check_that(count(*)=1,'Digest counted the same approved video twice')
from jsonb_array_elements(public.production_digest_snapshot(:'ws',:'started',clock_timestamp())->'rows') as x
where x->>'bucket'='completed' and x->>'job'=:'job';
rollback;
