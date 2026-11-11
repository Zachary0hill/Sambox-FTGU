-- Only authenticated dashboard interactions can update the caller's own row.
-- The server clock owns timestamps. Existing sign-ins/opens are not backfilled as activity.
create table public.dashboard_user_activity (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_active_at timestamptz not null,
  primary key (workspace_id, user_id)
);
alter table public.dashboard_user_activity enable row level security;
revoke all on public.dashboard_user_activity from public, anon, authenticated;
grant select on public.dashboard_user_activity to service_role;

create or replace function public.record_dashboard_activity(p_workspace_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.workspace_members where user_id = auth.uid() and workspace_id = p_workspace_id and status = 'active') then
    raise exception 'Active workspace membership required' using errcode = '42501';
  end if;
  insert into public.dashboard_user_activity (workspace_id, user_id, last_active_at) values (p_workspace_id, auth.uid(), now())
  on conflict (workspace_id, user_id) do update set last_active_at = excluded.last_active_at
  where public.dashboard_user_activity.last_active_at < now() - interval '30 seconds';
end;
$$;
revoke all on function public.record_dashboard_activity(uuid) from public, anon;
grant execute on function public.record_dashboard_activity(uuid) to authenticated;

-- Used only by the ZZMEDIA server via the existing encrypted project connection.
create or replace function public.get_dashboard_user_activity(p_workspace_id uuid default null)
returns table (user_id uuid, email text, display_name text, role text,
  last_active_at timestamptz, last_sign_in_at timestamptz, last_opened_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, coalesce(p.full_name, '')::text, m.role::text,
    a.last_active_at, u.last_sign_in_at, m.last_active_at as last_opened_at
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = u.id
  left join public.dashboard_user_activity a on a.user_id = u.id and a.workspace_id = m.workspace_id
  where m.workspace_id = p_workspace_id and m.status = 'active'
    and (u.banned_until is null or u.banned_until <= now())
  order by a.last_active_at desc nulls last, u.email
$$;
revoke all on function public.get_dashboard_user_activity(uuid) from public, anon, authenticated;
grant execute on function public.get_dashboard_user_activity(uuid) to service_role;
