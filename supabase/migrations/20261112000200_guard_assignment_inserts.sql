-- Close an assignment gap: guard_edit_columns / guard_thumb_columns only ran BEFORE UPDATE, so an editor (edits:create)
-- or designer (thumbs:create) could INSERT the first project_edits / project_thumbnails row for a project that had
-- none, naming any member and any due date, which also queued that member an assignment email.
-- Now, when someone who cannot manage edits/thumbs (anyone but Super Admins and permitted managers) creates the row,
-- it may name only themselves or nobody, and may not set a due date. Setting a status on an unassigned project,
-- which is what the board does for them, keeps working. Service-role jobs (no auth.uid()) are unaffected.

create or replace function app.guard_edit_insert()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  if (select auth.uid()) is null then return new; end if;
  ws := app.project_ws(new.project_id);
  if app.can_manage(ws, 'edits', 'edit') then return new; end if;
  if (new.editor_id is not null and new.editor_id <> (select auth.uid())) or new.edit_due is not null then
    raise exception 'Only a Super Admin can assign editors or set edit due dates' using errcode = '42501';
  end if;
  if app.setting(ws, 'lock_after_live') and app.project_is_live(new.project_id) then
    raise exception 'Live projects are locked. Ask a Super Admin to make changes.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function app.guard_edit_insert() from public, anon, authenticated;

create or replace function app.guard_thumb_insert()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  if (select auth.uid()) is null then return new; end if;
  ws := app.project_ws(new.project_id);
  if app.can_manage(ws, 'thumbs', 'edit') then return new; end if;
  if (new.designer_id is not null and new.designer_id <> (select auth.uid())) or new.thumb_due is not null then
    raise exception 'Only a Super Admin can assign designers or set thumbnail due dates' using errcode = '42501';
  end if;
  if app.setting(ws, 'lock_after_live') and app.project_is_live(new.project_id) then
    raise exception 'Live projects are locked. Ask a Super Admin to make changes.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function app.guard_thumb_insert() from public, anon, authenticated;

drop trigger if exists guard_edit_insert on public.project_edits;
create trigger guard_edit_insert before insert on public.project_edits
  for each row execute function app.guard_edit_insert();

drop trigger if exists guard_thumb_insert on public.project_thumbnails;
create trigger guard_thumb_insert before insert on public.project_thumbnails
  for each row execute function app.guard_thumb_insert();
