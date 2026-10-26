-- Content cards get the same banner as ideas: brand color + hook, image only, or image + hook. The image lives in the
-- private content-covers bucket under <workspace>/<entry>/, read with signed URLs like idea covers.

alter table public.content_entries
  add column if not exists hook text not null default '' check (length(hook) <= 24),
  add column if not exists cover_mode text not null default 'hook' check (cover_mode in ('hook', 'image', 'both')),
  add column if not exists cover_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-covers', 'content-covers', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do nothing;

-- Internal members read covers in their workspace; Super Admins and people who can edit projects upload and remove
-- them, only into a card that exists in that workspace.
create policy content_covers_read on storage.objects for select to authenticated
  using (bucket_id = 'content-covers' and app.is_internal(((storage.foldername(name))[1])::uuid));

create policy content_covers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'content-covers'
    and (app.is_admin(((storage.foldername(name))[1])::uuid) or app.has_perm(((storage.foldername(name))[1])::uuid, 'projects', 'edit'))
    and exists (select 1 from public.content_entries e
                where e.id = ((storage.foldername(objects.name))[2])::uuid
                  and e.workspace_id = ((storage.foldername(objects.name))[1])::uuid));

create policy content_covers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'content-covers'
    and (app.is_admin(((storage.foldername(name))[1])::uuid) or app.has_perm(((storage.foldername(name))[1])::uuid, 'projects', 'edit')));
