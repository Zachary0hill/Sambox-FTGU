-- Portal access by person. An account has a named contact, one sponsor or client can belong to several accounts, and
-- removing someone from the workspace also removes their account access, so a later invite cannot bring it back.

alter table public.accounts add column if not exists contact_name text not null default '';

create or replace function public.invite_member(
  p_email text, p_name text, p_role public.user_role, p_views public.view_kind[], p_account uuid default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid; uid uuid := (select auth.uid()); existing uuid;
  ex_role public.user_role; ex_status public.member_status;
  portal_role boolean := p_role in ('sponsor', 'client');
begin
  select workspace_id into ws from public.workspace_members
  where user_id = uid and status = 'active' and role = 'super_admin' order by created_at limit 1;
  if ws is null then raise exception 'Only a Super Admin can invite people' using errcode = '42501'; end if;
  if portal_role and p_account is null then
    raise exception 'Choose an account for a sponsor or client' using errcode = 'P0001';
  end if;
  if p_account is not null and not exists (select 1 from public.accounts where id = p_account and workspace_id = ws) then
    raise exception 'That account is not in this workspace' using errcode = 'P0001';
  end if;

  select id into existing from public.profiles where lower(email) = lower(p_email);
  if existing is not null then
    select role, status into ex_role, ex_status from public.workspace_members where workspace_id = ws and user_id = existing;
  end if;

  if ex_role is not null then
    -- Already a member: a sponsor or client can join another account. Anyone else is already on the team.
    if ex_role not in ('sponsor', 'client') or not portal_role then
      raise exception 'That email is already on the team' using errcode = 'P0001';
    end if;
    if ex_status <> 'active' then
      raise exception 'That person is deactivated. Reactivate them in Users first' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.account_members where account_id = p_account and user_id = existing) then
      raise exception 'That person already has access to this account' using errcode = 'P0001';
    end if;
    insert into public.account_members (account_id, user_id) values (p_account, existing);
    update public.accounts set portal_status = 'active' where id = p_account;
    return 'added';
  end if;

  -- One pending invite per person, except a sponsor or client invited to several accounts at once.
  if exists (select 1 from public.invitations i
             where i.workspace_id = ws and lower(i.email) = lower(p_email) and i.accepted_at is null
               and (i.account_id is not distinct from p_account or not portal_role or i.role not in ('sponsor', 'client'))) then
    raise exception 'That email already has a pending invite' using errcode = 'P0001';
  end if;

  if existing is not null then
    insert into public.workspace_members (workspace_id, user_id, role, status, views, invited_by)
    values (ws, existing, p_role, 'active', p_views, uid);
    if p_account is not null then
      insert into public.account_members (account_id, user_id) values (p_account, existing) on conflict do nothing;
      update public.accounts set portal_status = 'active' where id = p_account;
    end if;
    return 'added';
  end if;

  insert into public.invitations (workspace_id, email, full_name, role, views, account_id, invited_by)
  values (ws, lower(p_email), coalesce(p_name, ''), p_role, p_views, p_account, uid);
  return 'invited';
end $$;

create or replace function app.drop_account_access()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.account_members am
  using public.accounts a
  where am.account_id = a.id and a.workspace_id = old.workspace_id and am.user_id = old.user_id;
  return old;
end $$;

revoke execute on function app.drop_account_access() from public, anon, authenticated;

drop trigger if exists on_member_removed on public.workspace_members;
create trigger on_member_removed after delete on public.workspace_members
for each row execute function app.drop_account_access();

delete from public.account_members am
using public.accounts a
where am.account_id = a.id
  and not exists (select 1 from public.workspace_members m where m.workspace_id = a.workspace_id and m.user_id = am.user_id);
