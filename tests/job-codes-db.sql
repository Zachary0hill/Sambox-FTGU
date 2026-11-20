\set ON_ERROR_STOP on
-- Run against a disposable database built by tests/completion-bootstrap.py.
begin;
create function pg_temp.ok(value boolean, message text) returns void
language plpgsql as $$ begin if not coalesce(value, false) then raise exception 'FAIL: %', message; end if; end $$;

\set ws '20000000-0000-0000-0000-000000000001'
\set admin '10000000-0000-0000-0000-000000000001'
\set channel '92000000-0000-0000-0000-000000000001'
\set brand '92000000-0000-0000-0000-000000000002'
\set sponsor '92000000-0000-0000-0000-000000000003'
\set sponsor_brand '92000000-0000-0000-0000-000000000004'

-- The same names tests/job-code.test.cjs checks against jobAbbrev.
select pg_temp.ok(app.job_abbrev(name) = code, 'abbreviates ' || name || ' as ' || code || ', got ' || app.job_abbrev(name))
  from (values ('Completeful','CMP'), ('POD HUT','POD'), ('JohnXSantos','JXS'), ('Completeful Brand','CB'), ('HTSLEGOODS','HTS'),
    ('ZZMEDIA','ZZM'), ('The Print Lab','PL'), ('Acme','ACME'), ('Aeiou','AEI'), ('  ',''), ('Über Café 9','BER')) as t(name, code);
select pg_temp.ok(app.job_abbrev(null) = '', 'a missing name has no code');

insert into public.channels(id, workspace_id, name) values (:'channel', :'ws', 'POD HUT');
insert into public.accounts(id, workspace_id, name, type) values (:'sponsor', :'ws', 'Completeful', 'sponsor');
insert into public.brand_kits(id, workspace_id, name, kind, channel_id, account_id) values
  (:'brand', :'ws', 'POD HUT', 'channel', :'channel', null),
  (:'sponsor_brand', :'ws', 'Completeful', 'sponsor', null, :'sponsor');
insert into public.ideas(id, workspace_id, brand_id, title, author_id, stage, body, format) values
  ('92000000-0000-0000-0000-000000000011', :'ws', :'brand', 'Long one', :'admin', 'ready', array['x'], 'long_form'),
  ('92000000-0000-0000-0000-000000000012', :'ws', :'brand', 'Long two', :'admin', 'ready', array['x'], 'long_form'),
  ('92000000-0000-0000-0000-000000000013', :'ws', :'brand', 'Reel one', :'admin', 'ready', array['x'], 'reel'),
  ('92000000-0000-0000-0000-000000000014', :'ws', :'sponsor_brand', 'Sponsor reel', :'admin', 'ready', array['x'], 'reel');
-- A number typed by hand in the same series is counted, whatever its case or padding.
insert into public.projects(workspace_id, job_code, title, status_id)
  select :'ws', 'pod-lf04', 'Typed by hand', id from public.project_statuses where workspace_id = :'ws' limit 1;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","aal":"aal1"}';
select set_config('request.jwt.claim.sub', :'admin', true);
select pg_temp.ok(public.approve_idea_project('92000000-0000-0000-0000-000000000011')->>'job' = 'POD-LF5', 'long form continues the channel series');
select pg_temp.ok(public.approve_idea_project('92000000-0000-0000-0000-000000000012')->>'job' = 'POD-LF6', 'the next approval takes the next number');
select pg_temp.ok(public.approve_idea_project('92000000-0000-0000-0000-000000000013')->>'job' = 'POD-RLS1', 'reels count on their own');
select pg_temp.ok(public.approve_idea_project('92000000-0000-0000-0000-000000000014')->>'job' = 'CMP-RLS1', 'a sponsor brand without a channel uses the sponsor');
select pg_temp.ok(public.approve_idea_project('92000000-0000-0000-0000-000000000011')->>'job' = 'POD-LF5', 'a retry keeps the number');
select pg_temp.ok(not has_function_privilege('authenticated', 'app.next_job_code(uuid,text,text,text)', 'execute'), 'the generator is not callable from the API');
rollback;
