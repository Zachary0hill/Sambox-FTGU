-- Additive tracking: membership, email delivery, and welcome completion are independent.
create table public.invite_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  purpose text not null check (purpose in ('invite','access')),
  status text not null default 'queued' check (status in ('queued','submitted','delayed','delivered','failed','bounced','complained')),
  provider_id text unique,
  error_summary text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);
create index invite_deliveries_recipient on public.invite_deliveries(workspace_id, email, created_at desc);
alter table public.invite_deliveries enable row level security;
create policy delivery_admin_read on public.invite_deliveries for select to authenticated using (app.is_admin(workspace_id));
grant select on public.invite_deliveries to authenticated;
grant all on public.invite_deliveries to service_role;

create table public.invite_delivery_events (
  event_id text primary key,
  provider_id text not null,
  status text not null check (status in ('submitted','delayed','delivered','failed','bounced','complained')),
  occurred_at timestamptz not null
);
create index invite_delivery_events_provider on public.invite_delivery_events(provider_id);
alter table public.invite_delivery_events enable row level security;
grant all on public.invite_delivery_events to service_role;

create function public.reserve_invite_delivery(p_ws uuid, p_email text, p_actor uuid, p_purpose text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text || ':' || lower(p_email), 0));
  if not exists (select 1 from public.workspace_members where workspace_id = p_ws and user_id = p_actor and status = 'active' and role = 'super_admin') then
    raise exception 'Only an active Super Admin can send access emails';
  end if;
  if exists (select 1 from public.invite_deliveries where workspace_id = p_ws and email = lower(p_email) and created_at > now() - interval '60 seconds') then
    raise exception 'Wait 60 seconds before sending another access email';
  end if;
  insert into public.invite_deliveries(workspace_id, email, actor_id, purpose)
  values(p_ws, lower(p_email), p_actor, p_purpose) returning id into result;
  return result;
end $$;

-- Reconcile both event-before-response and response-before-event races. Terminal failures outrank delivery.
create function public.reconcile_invite_delivery(p_provider text)
returns void language plpgsql security definer set search_path = '' as $$
declare newest text;
begin
  perform pg_advisory_xact_lock(hashtextextended('delivery:' || p_provider, 0));
  select status into newest from public.invite_delivery_events where provider_id = p_provider
  order by case status when 'complained' then 6 when 'bounced' then 5 when 'failed' then 4 when 'delivered' then 3 when 'delayed' then 2 else 1 end desc, occurred_at desc limit 1;
  if newest is not null then
    update public.invite_deliveries set status = newest, updated_at = now() where provider_id = p_provider;
  end if;
end $$;

create function public.finish_invite_delivery(p_id uuid, p_provider text, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_provider is not null then perform pg_advisory_xact_lock(hashtextextended('delivery:' || p_provider, 0)); end if;
  update public.invite_deliveries set provider_id = p_provider,
    status = case when p_provider is null then 'failed' else 'submitted' end,
    submitted_at = case when p_provider is null then null else now() end,
    error_summary = p_error, updated_at = now() where id = p_id;
  if p_provider is not null then perform public.reconcile_invite_delivery(p_provider); end if;
end $$;

create function public.record_invite_delivery_event(p_event text, p_provider text, p_status text, p_time timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('delivery:' || p_provider, 0));
  insert into public.invite_delivery_events values(p_event, p_provider, p_status, p_time) on conflict do nothing;
  perform public.reconcile_invite_delivery(p_provider);
end $$;
revoke all on function public.reserve_invite_delivery(uuid,text,uuid,text), public.finish_invite_delivery(uuid,text,text), public.record_invite_delivery_event(text,text,text,timestamptz), public.reconcile_invite_delivery(text) from public, anon, authenticated;
grant execute on function public.reserve_invite_delivery(uuid,text,uuid,text), public.finish_invite_delivery(uuid,text,text), public.record_invite_delivery_event(text,text,text,timestamptz) to service_role;

-- Existing members opt in; new editor/designer memberships are enrolled after migration.
alter table public.workspace_members add column onboarding_required boolean not null default false;
alter table public.workspace_members add column onboarding_version integer not null default 1;
alter table public.workspace_members add column onboarding_completed_at timestamptz;
alter table public.workspace_members add column onboarding_dismissed_at timestamptz;
create function app.enroll_member_onboarding() returns trigger language plpgsql set search_path = '' as $$
begin
  new.onboarding_required := new.role in ('editor','designer');
  return new;
end $$;
create trigger enroll_member_onboarding before insert on public.workspace_members for each row execute function app.enroll_member_onboarding();

create function public.save_my_onboarding(p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.workspace_members where user_id = auth.uid() and status = 'active' order by created_at limit 1;
  if p_action not in ('complete','dismiss','reopen') then raise exception 'Invalid onboarding action'; end if;
  update public.workspace_members set
    onboarding_completed_at = case when p_action = 'complete' then now() else onboarding_completed_at end,
    onboarding_dismissed_at = case when p_action = 'dismiss' then now() when p_action = 'reopen' then null else onboarding_dismissed_at end
  where workspace_id = ws and user_id = auth.uid() and status = 'active' and role in ('editor','designer');
end $$;
revoke all on function public.save_my_onboarding(text) from public, anon;
grant execute on function public.save_my_onboarding(text) to authenticated;

create view public.invite_delivery_latest with (security_invoker = true) as
select distinct on (workspace_id, email) * from public.invite_deliveries order by workspace_id, email, created_at desc;
grant select on public.invite_delivery_latest to authenticated;

revoke all on function app.enroll_member_onboarding() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.invite_deliveries;
  end if;
end $$;
