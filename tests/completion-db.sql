\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(v boolean,m text) returns void language plpgsql as $$begin if not coalesce(v,false) then raise exception 'FAIL: %',m; end if; end$$;
create function pg_temp.err(q text) returns text language plpgsql as $$begin execute q; return ''; exception when others then return sqlstate; end$$;
select pg_temp.ok((select editor_id='10000000-0000-0000-0000-000000000002' from project_edits where project_id='30000000-0000-0000-0000-000000000001'),'missing canonical row filled');
select pg_temp.ok((select editor_id='10000000-0000-0000-0000-000000000004' from project_edits where project_id='30000000-0000-0000-0000-000000000002'),'manual assignment preserved');
select pg_temp.ok(not exists(select 1 from project_edits where project_id='30000000-0000-0000-0000-000000000003'),'ambiguous assignment held');
select pg_temp.ok((select count(*)=3 from project_field_values),'original values preserved');
select pg_temp.ok((select count(*)=0 from email_outbox),'no historical assignment email');
select pg_temp.ok((select count(*)=3 from assignment_reconciliation),'every mapping logged');
select pg_temp.ok(pg_temp.err($q$insert into custom_fields(workspace_id,label,type) values('20000000-0000-0000-0000-000000000001','Editor Status','select')$q$)='23514','reserved aliases refused');
-- Atomic comment finalization and retry: no partial rows/notification on malformed attachment.
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
set request.jwt.claims='{"role":"authenticated","aal":"aal1"}';
select pg_temp.ok(pg_temp.err($q$select finalize_project_comment('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Keep this draft',true,'[{"path":"wrong/path","name":"x"}]')$q$)<>'','invalid attachment fails');
select pg_temp.ok(not exists(select 1 from comments where id='50000000-0000-0000-0000-000000000001'),'failed comment rolled back');
select finalize_project_comment('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Keep this draft',true,'[{"path":"20000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001/comments/50000000-0000-0000-0000-000000000001/file.txt","name":"file.txt","mime":"text/plain","size":5}]');
select finalize_project_comment('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Keep this draft',true,'[]');
select pg_temp.ok((select count(*)=1 from comments where id='50000000-0000-0000-0000-000000000001'),'retry produces one comment');
select pg_temp.ok((select count(*)=1 from activity_log where project_id='30000000-0000-0000-0000-000000000001' and action='commented on'),'one comment activity');
reset role;
select pg_temp.ok((select count(*)>0 from notifications where project_id='30000000-0000-0000-0000-000000000001' and event='comment'),'comment notifications retained');
set role authenticated;
delete from comments where id='50000000-0000-0000-0000-000000000001';
select pg_temp.ok((select count(*)=1 from project_assets where project_id='30000000-0000-0000-0000-000000000001' and comment_id is null),'deleting comment preserves file');
-- Failed mixed deletion rolls the whole mutation back; successful deletion queues cleanup.
select pg_temp.ok(pg_temp.err($q$select delete_project_records(array['30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000099']::uuid[])$q$)='42501','mixed delete fails');
select pg_temp.ok(exists(select 1 from projects where id='30000000-0000-0000-0000-000000000001'),'failed delete preserves project');
reset role;
select pg_temp.ok(not exists(select 1 from storage_cleanup),'failed delete preserves cleanup queue');
-- MFA enforced for tables and definer RPCs, preserves unenrolled users and enrolled AAL2.
insert into auth.mfa_factors(user_id,status,factor_type) values('10000000-0000-0000-0000-000000000001','verified','totp');
set role authenticated;
select pg_temp.ok((select count(*)=0 from projects),'AAL1 enrolled user cannot read');
select pg_temp.ok(pg_temp.err('select public.my_context()')='42501','AAL1 cannot bypass through RPC');
set request.jwt.claims='{"role":"authenticated","aal":"aal2"}';
select pg_temp.ok((select count(*)=3 from projects),'AAL2 can read');
select pg_temp.ok(public.my_context() is not null,'AAL2 RPC permitted');
select delete_project_records(array['30000000-0000-0000-0000-000000000001']::uuid[]);
reset role;
select pg_temp.ok((select count(*)=1 from storage_cleanup),'committed delete queues cleanup');
-- Brand details and channel rename are atomic.
insert into channels(id,workspace_id,name) values('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','QA brand');
insert into brand_kits(id,workspace_id,name,kind,channel_id) values('60000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','QA brand','channel','60000000-0000-0000-0000-000000000001');
set role authenticated;
select save_brand_details('60000000-0000-0000-0000-000000000002','{"name":"Renamed QA"}');
select pg_temp.ok((select name='Renamed QA' from channels where id='60000000-0000-0000-0000-000000000001'),'channel renamed with brand');
reset role;
-- Restricted manager can convert task with approval permission but cannot create a project.
update role_permissions set allowed=false where workspace_id='20000000-0000-0000-0000-000000000001' and role='manager' and resource='projects' and action='create';
insert into ideas(id,workspace_id,brand_id,title,author_id,stage,body,research) values('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','Evidence idea','10000000-0000-0000-0000-000000000003','ready','{"Notes"}','{"sources":[{"url":"https://example.test"}]}');
insert into ideas_rules(workspace_id,rules) values('20000000-0000-0000-0000-000000000001','{"required_fields_by_stage":{"ready":["source"]}}') on conflict(workspace_id) do update set rules=excluded.rules;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
set request.jwt.claims='{"role":"authenticated","aal":"aal1"}';
set role authenticated;
select convert_idea('70000000-0000-0000-0000-000000000001','task');
select convert_idea('70000000-0000-0000-0000-000000000001','social');
select pg_temp.ok((select status='draft' and published_on is null from content_entries where title='Evidence idea'),'social handoff is an unscheduled draft');
select pg_temp.ok(pg_temp.err($q$select approve_idea_project('70000000-0000-0000-0000-000000000001')$q$)='42501','project create permission enforced');
reset role;
reset request.jwt.claim.sub;
set request.jwt.claims='{"role":"service_role"}';
-- Digest retries are bounded, sent records never reclaimed.
select pg_temp.ok(claim_digest('10000000-0000-0000-0000-000000000003',current_date),'digest first claim');
select pg_temp.ok(not claim_digest('10000000-0000-0000-0000-000000000003',current_date),'digest concurrent claim refused');
update digest_log set status='failed',attempted_at=now()-interval '30 minutes';
select pg_temp.ok(claim_digest('10000000-0000-0000-0000-000000000003',current_date),'failed digest retry');
update digest_log set status='sent',attempted_at=now()-interval '30 minutes';
select pg_temp.ok(not claim_digest('10000000-0000-0000-0000-000000000003',current_date),'sent digest not replayed');
-- Paused jobs keep their pending state and resume once.
insert into automations(id,workspace_id,name,trigger,actions,enabled,is_draft) values('80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','QA automation','{}','[]',true,false);
insert into automation_runs(id,automation_id,workspace_id,status,next_attempt_at) values('80000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','retry',now());
update workspace_settings set automation='{"paused":true}' where workspace_id='20000000-0000-0000-0000-000000000001';
select pg_temp.ok((select count(*)=0 from claim_automation_runs('20000000-0000-0000-0000-000000000001')),'paused run not claimed');
select pg_temp.ok((select status='retry' from automation_runs where id='80000000-0000-0000-0000-000000000002'),'paused run preserved');
update workspace_settings set automation='{"paused":false}' where workspace_id='20000000-0000-0000-0000-000000000001';
select pg_temp.ok((select count(*)=1 from claim_automation_runs('20000000-0000-0000-0000-000000000001')),'resume claims pending run');
-- Reservations retained when outcome unknown, per-run caps checked before calls.
select reserve_research_spend('20000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','test','model',0.3,0.5,1);
select pg_temp.ok(pg_temp.err($q$select reserve_research_spend('20000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','test','model',0.3,0.5,1)$q$)<>'','run cap prevents second call');
update research_spend set created_at=now()-interval '1 day';
select pg_temp.ok(pg_temp.err($q$select reserve_research_spend('20000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','test','model',0.8,1,1)$q$)<>'','unresolved exposure survives midnight');
-- Durable research commit rejects stale attempts, saves once, and returns the same IDs on retry.
insert into research_runs(id,workspace_id,brand_id,created_by,status,attempt_id) values('90000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','running','90000000-0000-0000-0000-000000000011');
select pg_temp.ok(pg_temp.err($q$select commit_research_ideas('90000000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000099','[]')$q$)<>'','stale research attempt refused');
select commit_research_ideas('90000000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000011','[{"id":"90000000-0000-0000-0000-000000000012","title":"Durable draft","hook":"A hook","body":["Outline"],"tags":[],"refs":[],"findings":[]}]');
select commit_research_ideas('90000000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000011','[]');
select pg_temp.ok((select count(*)=1 from ideas where research_run_id='90000000-0000-0000-0000-000000000010'),'research retry inserts once');
select pg_temp.ok((select status='done' and cardinality(idea_ids)=1 and jsonb_array_length(draft_payload)=1 from research_runs where id='90000000-0000-0000-0000-000000000010'),'research output committed atomically');
rollback;
select 'Completion database acceptance passed' result;
