-- Manual content cards on the Content page: anything published or scheduled that no sync brings in (a TikTok, an
-- Instagram reel, a video on a channel that is not connected). They sit in the same grid as board projects and synced
-- YouTube videos, filter by content type and channel, and count toward the page's totals. Stats are typed in by hand.
-- Internal members read them; Super Admins and people who can edit projects add, edit and delete them.

create table if not exists public.content_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  platform text not null default 'youtube'
    check (platform in ('youtube', 'instagram', 'tiktok', 'facebook', 'linkedin', 'x', 'threads', 'other')),
  status text not null default 'published' check (status in ('published', 'scheduled')),
  published_on date,
  content_type_id uuid references public.content_types(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  url text check (url is null or url ~* '^https?://'),
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~* '^https://'),
  -- Null means not entered, which the page shows as a dash rather than zero.
  views bigint check (views is null or views >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_entries_ws on public.content_entries (workspace_id, published_on desc);
alter table public.content_entries enable row level security;

create policy ce_select on public.content_entries for select to authenticated
  using ((select app.is_internal(workspace_id)));
create policy ce_insert on public.content_entries for insert to authenticated
  with check ((select app.is_internal(workspace_id)) and ((select app.is_admin(workspace_id)) or (select app.has_perm(workspace_id, 'projects', 'edit'))));
create policy ce_update on public.content_entries for update to authenticated
  using ((select app.is_internal(workspace_id)) and ((select app.is_admin(workspace_id)) or (select app.has_perm(workspace_id, 'projects', 'edit'))));
create policy ce_delete on public.content_entries for delete to authenticated
  using ((select app.is_internal(workspace_id)) and ((select app.is_admin(workspace_id)) or (select app.has_perm(workspace_id, 'projects', 'edit'))));
revoke all on public.content_entries from anon;

create or replace function app.content_entry_touch()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists content_entry_touch on public.content_entries;
create trigger content_entry_touch before update on public.content_entries
for each row execute function app.content_entry_touch();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_entries') then
    alter publication supabase_realtime add table public.content_entries;
  end if;
end $$;
