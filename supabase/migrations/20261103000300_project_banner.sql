-- Project banners: the image chosen for a project's kanban card and modal cover. Stored as a project file of its own
-- kind so it stays out of the Files tab and wins over the thumbnail the card would otherwise pick.
alter table public.project_assets drop constraint project_assets_kind_check;
alter table public.project_assets add constraint project_assets_kind_check
  check (kind in ('script','raw_footage','draft','thumbnail','final','other','banner'));
