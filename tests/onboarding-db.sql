\set ON_ERROR_STOP on
-- Isolated PostgreSQL fixture; run only in a disposable local database.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema app;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.workspaces(id uuid primary key);
create table public.profiles(id uuid primary key);
create table public.workspace_members(workspace_id uuid references workspaces, user_id uuid references profiles, role text, status text, created_at timestamptz default now(), primary key(workspace_id,user_id));
create function app.is_admin(ws uuid) returns boolean language sql stable security definer as $$ select exists(select 1 from public.workspace_members where workspace_id=ws and user_id=auth.uid() and role='super_admin' and status='active') $$;
grant usage on schema app, auth to authenticated;
insert into workspaces values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into profiles values ('00000000-0000-0000-0000-000000000011'), ('00000000-0000-0000-0000-000000000012'), ('00000000-0000-0000-0000-000000000013');
insert into workspace_members(workspace_id,user_id,role,status) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','super_admin','active'), ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','editor','active');
\ir ../supabase/migrations/20261105000100_member_onboarding_delivery.sql
insert into workspace_members(workspace_id,user_id,role,status) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000013','designer','active');
do $$
declare attempt uuid;
begin
  if (select onboarding_required from workspace_members where user_id='00000000-0000-0000-0000-000000000012') then raise exception 'Existing editor forced into welcome'; end if;
  if not (select onboarding_required from workspace_members where user_id='00000000-0000-0000-0000-000000000013') then raise exception 'New designer not enrolled'; end if;
  attempt := public.reserve_invite_delivery('00000000-0000-0000-0000-000000000001','person@example.test','00000000-0000-0000-0000-000000000011','invite');
  begin
    perform public.reserve_invite_delivery('00000000-0000-0000-0000-000000000001','PERSON@example.test','00000000-0000-0000-0000-000000000011','invite');
    raise exception 'Cooldown failed';
  exception when raise_exception then if sqlerrm not like 'Wait 60%' then raise; end if; end;
  begin
    perform public.reserve_invite_delivery('00000000-0000-0000-0000-000000000002','person@example.test','00000000-0000-0000-0000-000000000011','invite');
    raise exception 'Workspace check failed';
  exception when raise_exception then if sqlerrm not like 'Only an active%' then raise; end if; end;
  perform public.record_invite_delivery_event('evt-delivered','provider-1','delivered',now());
  perform public.finish_invite_delivery(attempt,'provider-1',null);
  if (select status from invite_deliveries where id=attempt) <> 'delivered' then raise exception 'Early webhook lost'; end if;
  perform public.record_invite_delivery_event('evt-sent','provider-1','submitted',now()+interval '1 minute');
  if (select status from invite_deliveries where id=attempt) <> 'delivered' then raise exception 'Late sent event reversed delivered'; end if;
  perform public.record_invite_delivery_event('evt-bounce','provider-1','bounced',now());
  perform public.record_invite_delivery_event('evt-bounce','provider-1','bounced',now());
  if (select status from invite_deliveries where id=attempt) <> 'bounced' then raise exception 'Bounce lost'; end if;
  if (select count(*) from invite_delivery_events where event_id='evt-bounce') <> 1 then raise exception 'Duplicate event'; end if;
  if has_function_privilege('authenticated','public.finish_invite_delivery(uuid,text,text)','execute') then raise exception 'Member can forge delivery'; end if;
  if has_function_privilege('anon','public.reserve_invite_delivery(uuid,text,uuid,text)','execute') then raise exception 'Anon can send'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000013',false);
do $$ begin
  if (select count(*) from invite_deliveries) <> 0 then raise exception 'Designer can read delivery records'; end if;
  perform public.save_my_onboarding('complete');
end $$;
reset role;
do $$ begin
  if (select onboarding_completed_at is null from workspace_members where user_id='00000000-0000-0000-0000-000000000013') then raise exception 'Completion not persisted'; end if;
  if (select onboarding_completed_at is not null from workspace_members where user_id='00000000-0000-0000-0000-000000000012') then raise exception 'Changed other member'; end if;
end $$;
select 'PASS: migration, cooldown, workspace authorization, RLS, event ordering/deduplication, and welcome persistence' as result;
