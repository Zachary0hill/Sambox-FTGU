\set ON_ERROR_STOP on
-- Run against a disposable database built by tests/completion-bootstrap.py.
begin;
create function pg_temp.ok(value boolean, message text) returns void
language plpgsql as $$ begin if not coalesce(value, false) then raise exception 'FAIL: %', message; end if; end $$;
create function pg_temp.approval_error(idea_id uuid) returns text
language plpgsql as $$ begin perform public.approve_idea_project(idea_id); return ''; exception when others then return sqlstate; end $$;

\set ws '20000000-0000-0000-0000-000000000001'
\set admin '10000000-0000-0000-0000-000000000001'
\set client '91000000-0000-0000-0000-000000000001'
\set sponsor '91000000-0000-0000-0000-000000000002'
\set channel '91000000-0000-0000-0000-000000000003'
\set client_brand '91000000-0000-0000-0000-000000000004'
\set sponsor_brand '91000000-0000-0000-0000-000000000005'
\set idea '91000000-0000-0000-0000-000000000006'
\set sponsored_idea '91000000-0000-0000-0000-000000000007'

insert into public.accounts(id, workspace_id, name, type) values
  (:'client', :'ws', 'Production client', 'client'),
  (:'sponsor', :'ws', 'Production sponsor', 'sponsor');
insert into public.channels(id, workspace_id, name, owner_account_id)
  values (:'channel', :'ws', 'Production client', :'client');
insert into public.brand_kits(id, workspace_id, name, kind, channel_id, account_id) values
  (:'client_brand', :'ws', 'Production client', 'channel', :'channel', :'client'),
  (:'sponsor_brand', :'ws', 'Production sponsor', 'sponsor', null, :'sponsor');
insert into public.ideas(id, workspace_id, brand_id, title, author_id, stage, body, sponsor_id, refs, script, research, findings) values
  (:'idea', :'ws', :'client_brand', 'QA production handoff', :'admin', 'ready', array['Concept notes'], :'sponsor_brand',
    array['https://example.test/manual'], '{"beats":[{"time":"0:12","label":"Intro","text":"A saved script beat"}]}',
    '{"summary":"Research summary text","sources":[{"url":"https://example.test/research"}]}',
    '[{"url":"https://example.test/finding"}]'),
  (:'sponsored_idea', :'ws', :'sponsor_brand', 'QA sponsor brand handoff', :'admin', 'ready', array['Sponsor concept'], null,
    '{}', null, null, '[]');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","aal":"aal1"}';
select set_config('request.jwt.claim.sub', :'admin', true);
select pg_temp.ok((public.approve_idea_project(:'idea')->>'created')::boolean, 'first approval creates the project');
select pg_temp.ok((public.approve_idea_project(:'idea')->>'canOpen')::boolean, 'approving admin can open the project');
select pg_temp.ok(not (public.approve_idea_project(:'idea')->>'created')::boolean, 'retry returns the existing project');
select pg_temp.ok((
  select st.stage='in_production' and c.owner_account_id=:'client' and sp.account_id=:'sponsor'
    and p.brief like '%https://example.test/manual%' and p.brief like '%https://example.test/research%'
    and p.brief like '%https://example.test/finding%' and p.brief like '%Research summary text%'
    and p.idea_package->'script'->'beats'->0->>'text'='A saved script beat'
    and p.idea_package->'research'->>'summary'='Research summary text'
  from public.ideas i
  join public.projects p on p.id=i.project_id
  join public.project_statuses st on st.id=p.status_id
  join public.channels c on c.id=p.channel_id
  join public.sponsorships sp on sp.project_id=p.id
  where i.id=:'idea' and i.stage='approved' and jsonb_array_length(i.converted)=1
), 'project carries client, sponsor, research and script into In Production');
select pg_temp.ok((select count(*)=1 from public.projects where title='QA production handoff'), 'only one project on retry');

select public.approve_idea_project(:'sponsored_idea');
select pg_temp.ok((
  select sp.account_id=:'sponsor'
  from public.ideas i join public.sponsorships sp on sp.project_id=i.project_id
  where i.id=:'sponsored_idea'
), 'a sponsor brand carries its own account without Sponsor fit');
reset role;
insert into auth.mfa_factors(user_id, factor_type, status) values (:'admin', 'totp', 'verified');
set local role authenticated;
select pg_temp.ok(pg_temp.approval_error(:'idea')='42501', 'approval and retry require verified MFA for enrolled users');
rollback;
