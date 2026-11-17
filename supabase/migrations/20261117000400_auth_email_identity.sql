-- Authentication owns email identity. Editable profile fields must never choose invite recipients.
create or replace function app.guard_profile_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare verified_email text;
begin
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception 'Profile identity cannot be changed' using errcode = '42501';
  end if;
  select coalesce(email, '') into verified_email from auth.users where id = new.id;
  if not found or new.email is distinct from verified_email then
    raise exception 'Change your email through account authentication' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function app.guard_profile_identity() from public, anon, authenticated;
create trigger guard_profile_identity before insert or update of id, email on public.profiles
for each row execute function app.guard_profile_identity();

create or replace function app.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end $$;
revoke all on function app.sync_profile_email() from public, anon, authenticated;
create trigger sync_profile_email after update of email on auth.users
for each row when (old.email is distinct from new.email) execute function app.sync_profile_email();

-- Reconcile the display/contact copy without changing any auth identity or membership.
update public.profiles p set email = coalesce(u.email, '') from auth.users u
where p.id = u.id and p.email is distinct from coalesce(u.email, '');

create or replace function public.invite_member(
  p_email text, p_name text, p_role public.user_role, p_views public.view_kind[], p_account uuid default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid; uid uuid := (select auth.uid()); existing uuid;
  ex_role public.user_role; ex_status public.member_status;
  portal_role boolean := p_role in ('sponsor', 'client');
begin
  perform app.require_verified_session();
  p_email := lower(btrim(p_email));
  if p_email is null or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;
  select workspace_id into ws from public.workspace_members
  where user_id = uid and status = 'active' and role = 'super_admin' order by created_at limit 1;
  if ws is null then raise exception 'Only a Super Admin can invite people' using errcode = '42501'; end if;
  if portal_role and p_account is null then
    raise exception 'Choose an account for a sponsor or client' using errcode = 'P0001';
  end if;
  if p_account is not null and not exists (select 1 from public.accounts where id = p_account and workspace_id = ws) then
    raise exception 'That account is not in this workspace' using errcode = 'P0001';
  end if;

  select id into existing from auth.users where lower(email) = p_email and email_confirmed_at is not null;
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

