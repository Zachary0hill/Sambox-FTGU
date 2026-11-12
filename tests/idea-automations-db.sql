\set ON_ERROR_STOP on
-- Idea automations (supabase/migrations/20261111010000_idea_automations.sql). Run in a disposable database built by
-- tests/completion-bootstrap.py, as the superuser:
--   python3 tests/completion-bootstrap.py > /tmp/boot.sql && createdb t && psql -d t -f /tmp/boot.sql && psql -d t -f tests/idea-automations-db.sql
create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'FAIL: %',msg; end if; end $$;
create function pg_temp.runs(k text) returns int language sql as $$ select count(*)::int from public.automation_runs where trigger_key = k $$;

\set ws '''20000000-0000-0000-0000-000000000001'''
\set idea '''00000000-0000-8000-8000-0000000000a1'''
insert into public.brand_kits (id, workspace_id, name, kind) values ('00000000-0000-8000-8000-0000000000b1', :ws, 'Auto brand', 'channel');
insert into public.automations (workspace_id, name, trigger, actions, enabled, is_draft) values
  (:ws, 'On capture', '{"key":"idea_created"}', '[{"key":"todo_admin"}]', true, false),
  (:ws, 'Into research', '{"key":"idea_stage","value":"research"}', '[{"key":"idea_research"}]', true, false),
  (:ws, 'Scored 70', '{"key":"idea_scored","value":"70"}', '[{"key":"idea_email_owner"}]', true, false),
  (:ws, 'Quiet 14', '{"key":"idea_stale","value":"14"}', '[{"key":"idea_todo_owner"}]', true, false),
  (:ws, 'Turned off', '{"key":"idea_created"}', '[{"key":"todo_admin"}]', false, false),
  (:ws, 'Project status', '{"key":"status"}', '[{"key":"todo_admin"}]', true, false);

-- Capture queues the enabled idea_created workflow once, on the idea, with no project
insert into public.ideas (id, workspace_id, brand_id, title, author_id, body, platforms)
values (:idea, :ws, '00000000-0000-8000-8000-0000000000b1', 'Automated idea', '10000000-0000-0000-0000-000000000001', '{}', '{}');
select pg_temp.assert(pg_temp.runs('idea_created') = 1, 'capture queues one run (the disabled workflow is skipped)');
select pg_temp.assert((select idea_id = :idea and project_id is null and status = 'queued' from public.automation_runs where trigger_key = 'idea_created'), 'the run is on the idea');

-- Stage: only the matching value fires, and moving back does not
update public.ideas set stage = 'research' where id = :idea;
select pg_temp.assert(pg_temp.runs('idea_stage') = 1, 'moving to Research fires the Research workflow');
select pg_temp.assert((select payload ->> 'from' = 'inbox' and payload ->> 'to' = 'research' from public.automation_runs where trigger_key = 'idea_stage'), 'payload has from and to');
update public.ideas set stage = 'inbox' where id = :idea;
select pg_temp.assert(pg_temp.runs('idea_stage') = 1, 'moving back to Inbox fires nothing');

-- Score: fires once when it first reaches 70, not while it stays above, and again after dropping below and crossing
update public.ideas set research = '{"score":{"total":65}}' where id = :idea;
select pg_temp.assert(pg_temp.runs('idea_scored') = 0, '65 is below 70');
update public.ideas set research = '{"score":{"total":72}}' where id = :idea;
select pg_temp.assert(pg_temp.runs('idea_scored') = 1, 'reaching 72 fires');
update public.ideas set research = '{"score":{"total":80}}' where id = :idea;
select pg_temp.assert(pg_temp.runs('idea_scored') = 1, 'staying above 70 does not fire again');
update public.ideas set research = '{"score":{"total":60}}' where id = :idea;
update public.ideas set research = '{"score":{"total":71}}' where id = :idea;
select pg_temp.assert(pg_temp.runs('idea_scored') = 2, 'crossing again fires again');

-- Stale: queued once per quiet spell, deduped across ticks
set session_replication_role = replica;
update public.ideas set updated_at = now() - interval '20 days' where id = :idea;
set session_replication_role = origin;
select public.queue_scheduled_idea_automations(:ws);
select public.queue_scheduled_idea_automations(:ws);
select pg_temp.assert(pg_temp.runs('idea_stale') = 1, 'a quiet idea is reminded once');
select pg_temp.assert((select payload ->> 'days' = '14' from public.automation_runs where trigger_key = 'idea_stale'), 'payload names the days');

-- Pause all automations stops queuing; archived ideas never fire
update public.workspace_settings set automation = jsonb_build_object('paused', true) where workspace_id = :ws;
update public.ideas set stage = 'research' where id = :idea;
select pg_temp.assert(pg_temp.runs('idea_stage') = 1, 'paused queues nothing');
update public.workspace_settings set automation = '{}'::jsonb where workspace_id = :ws;
update public.ideas set stage = 'inbox' where id = :idea;
update public.ideas set archived_at = now() where id = :idea;
update public.ideas set stage = 'research' where id = :idea;
select pg_temp.assert(pg_temp.runs('idea_stage') = 1, 'archived ideas do not fire');

-- Project workflows never see idea events
select pg_temp.assert(pg_temp.runs('status') = 0, 'project triggers are untouched');
\echo idea-automations-db: all assertions passed
