-- A workspace can have any number of Super Admins. Only a Super Admin can grant or take away the role,
-- so a role given users:create or users:edit cannot promote itself. Invites accepted at sign up run without a
-- session (auth.uid() is null) and were already checked by invite_member.

create or replace function app.protect_super_admin()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if new.role = 'super_admin' and uid is not null and not app.is_admin(new.workspace_id) then
      raise exception 'Only a Super Admin can add another Super Admin' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.is_owner and (tg_op = 'DELETE' or new.status <> 'active' or new.role <> 'super_admin') then
    raise exception 'The workspace owner cannot be removed, demoted or deactivated' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (old.role = 'super_admin') <> (new.role = 'super_admin')
     and uid is not null and not app.is_admin(old.workspace_id) then
    raise exception 'Only a Super Admin can change who is a Super Admin' using errcode = '42501';
  end if;
  if old.role = 'super_admin' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'super_admin' or new.status <> 'active')
     and not exists (
       select 1 from public.workspace_members m
       where m.workspace_id = old.workspace_id and m.role = 'super_admin' and m.status = 'active' and m.user_id <> old.user_id) then
    raise exception 'A workspace needs at least one active Super Admin' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists protect_super_admin on public.workspace_members;
create trigger protect_super_admin before insert or update or delete on public.workspace_members
for each row execute function app.protect_super_admin();
