-- Brand files: logos and downloads for each brand kit. Paths are <workspace_id>/<brand_id>/<kind>/<file>.
-- Anyone who can see the brand can read its files; Super Admins upload and remove them.

insert into storage.buckets (id, name, public) values ('brand-assets', 'brand-assets', false)
on conflict (id) do nothing;

create policy brand_assets_read on storage.objects for select to authenticated
  using (bucket_id = 'brand-assets' and app.can_see_brand(((storage.foldername(name))[2])::uuid));

create policy brand_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets'
    and app.is_admin(((storage.foldername(name))[1])::uuid)
    -- objects.name, not name: inside this subquery a bare name would resolve to brand_kits.name.
    and exists (select 1 from public.brand_kits bk
                where bk.id = ((storage.foldername(objects.name))[2])::uuid
                  and bk.workspace_id = ((storage.foldername(objects.name))[1])::uuid));

create policy brand_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and app.is_admin(((storage.foldername(name))[1])::uuid));
