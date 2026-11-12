-- Dev Notes for the whole team: managers, editors and designers can log notes (with screenshots) from the dock too.
-- Super Admins keep the shared backlog exactly as before: they see, edit, resolve and delete every note.
-- Everyone else sees only the notes they wrote, and can change, re-categorise or delete one only while it is open.
-- Resolving stays with Super Admins: an author can never set is_resolved, resolved_at or resolved_by.
-- Screenshots follow the note: an author reads, uploads and removes files only under their own notes' folders
-- (<workspace>/<note>/ in dev-note-shots). Sponsors and clients still never reach the table or the bucket.

-- Storage paths arrive as text. These helpers compare as text so a malformed path segment simply does not match
-- (a uuid cast in a policy could raise, and Postgres does not promise to evaluate a guard before it).

-- The signed-in internal member wrote this note (open or resolved): what an author may read.
create or replace function app.wrote_dev_note(note text, ws text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.dev_notes n
    where n.id::text = note and n.workspace_id::text = ws
      and n.created_by = (select auth.uid()) and app.is_internal(n.workspace_id))
$$;
revoke all on function app.wrote_dev_note(text, text) from public, anon;
grant execute on function app.wrote_dev_note(text, text) to authenticated, service_role;

-- The signed-in internal member wrote this note and it is still open: what an author may change.
create or replace function app.owns_open_dev_note(note text, ws text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.dev_notes n
    where n.id::text = note and n.workspace_id::text = ws and not n.is_resolved
      and n.created_by = (select auth.uid()) and app.is_internal(n.workspace_id))
$$;
revoke all on function app.owns_open_dev_note(text, text) from public, anon;
grant execute on function app.owns_open_dev_note(text, text) to authenticated, service_role;

drop policy if exists dev_notes_select on public.dev_notes;
drop policy if exists dev_notes_insert on public.dev_notes;
drop policy if exists dev_notes_update on public.dev_notes;
drop policy if exists dev_notes_delete on public.dev_notes;

create policy dev_notes_select on public.dev_notes for select to authenticated
  using ((select app.is_admin(workspace_id))
    or (created_by = (select auth.uid()) and (select app.is_internal(workspace_id))));

create policy dev_notes_insert on public.dev_notes for insert to authenticated
  with check ((select app.is_internal(workspace_id)) and created_by = (select auth.uid())
    and ((select app.is_admin(workspace_id)) or (not is_resolved and resolved_at is null and resolved_by is null)));

create policy dev_notes_update on public.dev_notes for update to authenticated
  using ((select app.is_admin(workspace_id))
    or (created_by = (select auth.uid()) and not is_resolved and (select app.is_internal(workspace_id))))
  with check ((select app.is_admin(workspace_id))
    or (created_by = (select auth.uid()) and not is_resolved and resolved_at is null and resolved_by is null
        and (select app.is_internal(workspace_id))));

create policy dev_notes_delete on public.dev_notes for delete to authenticated
  using ((select app.is_admin(workspace_id))
    or (created_by = (select auth.uid()) and not is_resolved and (select app.is_internal(workspace_id))));

-- Screenshots: the admin branches are unchanged from 20261103000400; the author branches are new.
drop policy if exists dev_note_shots_read on storage.objects;
drop policy if exists dev_note_shots_insert on storage.objects;
drop policy if exists dev_note_shots_delete on storage.objects;

create policy dev_note_shots_read on storage.objects for select to authenticated
  using (bucket_id = 'dev-note-shots' and (
    app.wrote_dev_note((storage.foldername(name))[2], (storage.foldername(name))[1])
    or app.is_admin(((storage.foldername(name))[1])::uuid)));

create policy dev_note_shots_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dev-note-shots' and (
    app.owns_open_dev_note((storage.foldername(name))[2], (storage.foldername(name))[1])
    or (app.is_admin(((storage.foldername(name))[1])::uuid)
        and exists (select 1 from public.dev_notes n
                    where n.id::text = (storage.foldername(objects.name))[2]
                      and n.workspace_id::text = (storage.foldername(objects.name))[1]))));

create policy dev_note_shots_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dev-note-shots' and (
    app.owns_open_dev_note((storage.foldername(name))[2], (storage.foldername(name))[1])
    or app.is_admin(((storage.foldername(name))[1])::uuid)));
