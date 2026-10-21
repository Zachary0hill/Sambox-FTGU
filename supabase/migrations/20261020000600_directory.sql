-- Sponsors and clients read only their own profile row. Everyone gets first names through directory().

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (app.shares_workspace(id) and exists (
    select 1 from public.workspace_members m
    where m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('super_admin', 'editor', 'designer'))));

create or replace function public.directory()
returns table (id uuid, name text, full_name text, role public.user_role, status public.member_status, color_index smallint, account text)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(nullif(split_part(p.full_name, ' ', 1), ''), split_part(p.email, '@', 1)), p.full_name, m.role, m.status, p.color_index,
    (select a.name from public.account_members am join public.accounts a on a.id = am.account_id
     where am.user_id = p.id and a.workspace_id = m.workspace_id order by a.name limit 1)
  from public.workspace_members m
  join public.profiles p on p.id = m.user_id
  where m.workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid()) and status = 'active')
$$;

grant execute on function public.directory() to authenticated;
revoke execute on function public.directory() from anon;
