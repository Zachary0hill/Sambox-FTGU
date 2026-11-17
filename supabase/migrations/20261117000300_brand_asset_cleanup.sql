-- Individual brand-file removal needs the same durable cleanup as deleting a brand.
-- Only paths removed from the committed metadata are enqueued; retained/reordered
-- assets and paths outside this brand are never cleanup candidates.
create or replace function app.queue_brand_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
declare asset jsonb;
begin
  for asset in select * from jsonb_array_elements(old.assets) loop
    if asset->>'path' like old.workspace_id::text||'/'||old.id::text||'/%'
      and (tg_op = 'DELETE' or not exists (
        select 1 from jsonb_array_elements(new.assets) kept
        where kept->>'path' = asset->>'path'
      )) then
      insert into public.storage_cleanup(bucket,path,workspace_id)
      values('brand-assets',asset->>'path',old.workspace_id)
      on conflict(bucket,path) do update set completed_at=null,attempts=0,error=null;
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger brand_asset_cleanup after update of assets on public.brand_kits
for each row execute function app.queue_brand_cleanup();
