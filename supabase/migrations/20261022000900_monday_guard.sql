-- The monday link guard also covers INSERT: only a Super Admin or the server (auth.uid() is null) can create a project
-- that is already linked to a monday item, since status changes on linked projects are pushed to monday.

create or replace function app.guard_monday_link()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or app.is_admin(new.workspace_id) then return new; end if;
  if tg_op = 'INSERT' then
    if new.monday_item_id is not null then
      raise exception 'Only a Super Admin can link a project to monday' using errcode = '42501';
    end if;
  elsif new.monday_item_id is distinct from old.monday_item_id then
    raise exception 'Only a Super Admin can change a project''s monday link' using errcode = '42501';
  end if;
  return new;
end $$;

revoke execute on function app.guard_monday_link() from public, anon, authenticated;

drop trigger if exists guard_monday_link on public.projects;
create trigger guard_monday_link before insert or update of monday_item_id on public.projects
for each row execute function app.guard_monday_link();
