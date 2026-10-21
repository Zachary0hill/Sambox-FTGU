-- monday.com sync: each project can be linked to one item on the workspace's monday board. Syncs and webhooks write
-- with the secret-key client (auth.uid() is null); members only see the link.

alter table public.projects add column if not exists monday_item_id text;

alter table public.projects drop constraint if exists projects_monday_item_key;
alter table public.projects add constraint projects_monday_item_key unique (workspace_id, monday_item_id);

-- Only a Super Admin (or the server) can link or unlink a project. Editors may update projects they can change the
-- status of, so the column needs its own guard.
create or replace function app.guard_monday_link()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and new.monday_item_id is distinct from old.monday_item_id
     and not app.is_admin(new.workspace_id) then
    raise exception 'Only a Super Admin can change a project''s monday link' using errcode = '42501';
  end if;
  return new;
end $$;

revoke execute on function app.guard_monday_link() from public, anon, authenticated;

drop trigger if exists guard_monday_link on public.projects;
create trigger guard_monday_link before update of monday_item_id on public.projects
for each row execute function app.guard_monday_link();
