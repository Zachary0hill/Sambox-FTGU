-- Dev Notes screenshots: a note can carry up to four images, pasted, dropped or picked while logging it. Files live in
-- the private dev-note-shots bucket under <workspace>/<note>/ and are read with signed URLs; the note row keeps the
-- list in one jsonb column ([{path, w, h}]) so the dock's single select and realtime payload stay unchanged.
-- Access mirrors dev_notes: only active Super Admins of the workspace read, upload or remove.

alter table public.dev_notes
  add column if not exists attachments jsonb not null default '[]'::jsonb
    check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 4);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dev-note-shots', 'dev-note-shots', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do nothing;

create policy dev_note_shots_read on storage.objects for select to authenticated
  using (bucket_id = 'dev-note-shots' and app.is_admin(((storage.foldername(name))[1])::uuid));

create policy dev_note_shots_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dev-note-shots'
    and app.is_admin(((storage.foldername(name))[1])::uuid)
    and exists (select 1 from public.dev_notes n
                where n.id = ((storage.foldername(objects.name))[2])::uuid
                  and n.workspace_id = ((storage.foldername(objects.name))[1])::uuid));

create policy dev_note_shots_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dev-note-shots' and app.is_admin(((storage.foldername(name))[1])::uuid));
