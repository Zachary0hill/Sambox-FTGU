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
  -- Keep the Studio team directory's existing last-active display in sync.
  update public.workspace_members set last_active_at = now()
    where user_id = auth.uid() and workspace_id = p_workspace_id and status = 'active'
      and (last_active_at is null or last_active_at < now() - interval '30 seconds');
end;
$$;
