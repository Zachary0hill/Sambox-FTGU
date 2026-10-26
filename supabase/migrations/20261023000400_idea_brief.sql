-- Ideas & Research brief: angle, ICE score, planning fields, cover image and banner settings on each idea, plus an
-- In production stage for ideas promoted to a project. Existing ideas keep working: every new column is nullable
-- or has a default, and the existing ideas policies cover the new columns.

alter type public.idea_status add value if not exists 'in_production' before 'archived';

alter table public.ideas
  add column if not exists format text check (format in ('long_form','short','reel','livestream','podcast_clip')),
  add column if not exists pillar text,
  add column if not exists audience text,
  add column if not exists promise text,
  add column if not exists platforms text[] not null default '{}',
  add column if not exists impact smallint check (impact between 1 and 10),
  add column if not exists confidence smallint check (confidence between 1 and 10),
  add column if not exists ease smallint check (ease between 1 and 10),
  add column if not exists priority smallint not null default 3 check (priority between 1 and 3),
  add column if not exists effort text check (effort in ('s','m','l')),
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  -- First day of the target month.
  add column if not exists target_window date check (target_window is null or extract(day from target_window) = 1),
  -- A sponsor brand kit (kind = 'sponsor'); the app only offers sponsor kits.
  add column if not exists sponsor_id uuid references public.brand_kits(id) on delete set null,
  add column if not exists source text not null default 'manual' check (source in ('manual','research')),
  add column if not exists research_run_id uuid references public.research_runs(id) on delete set null,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists cover_mode text not null default 'hook' check (cover_mode in ('hook','image','both')),
  -- Storage path in the idea-covers bucket: <workspace_id>/<idea_id>/<file>.
  add column if not exists cover_path text,
  add column if not exists cover_focal_x smallint not null default 50 check (cover_focal_x between 0 and 100),
  add column if not exists cover_focal_y smallint not null default 50 check (cover_focal_y between 0 and 100),
  add column if not exists cover_highlight text not null default '#FFE14D',
  add column if not exists hook_position text not null default 'bottom' check (hook_position in ('bottom','center','top'));

-- Owner defaults to the author. Ideas saved by a research run are marked as research.
update public.ideas set owner_id = author_id where owner_id is null;
update public.ideas i set source = 'research', research_run_id = r.id
  from public.research_runs r where i.id = any (r.idea_ids) and i.source = 'manual';

create or replace function app.idea_owner_default() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_id is null then new.owner_id := new.author_id; end if;
  return new;
end $$;
drop trigger if exists ideas_owner_default on public.ideas;
create trigger ideas_owner_default before insert on public.ideas for each row execute function app.idea_owner_default();

create index if not exists ideas_owner_idx on public.ideas (owner_id);
create index if not exists ideas_sponsor_idx on public.ideas (sponsor_id);
create index if not exists ideas_research_run_idx on public.ideas (research_run_id);
create index if not exists ideas_project_idx on public.ideas (project_id);

-- Cover images. Anyone who can see the idea can read its cover; anyone who can add ideas for the brand can upload;
-- the uploader or a Super Admin can remove one.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('idea-covers', 'idea-covers', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do nothing;

create policy idea_covers_read on storage.objects for select to authenticated
  using (bucket_id = 'idea-covers' and app.can_see_idea(((storage.foldername(name))[2])::uuid));

create policy idea_covers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'idea-covers'
    and (select app.member_role(((storage.foldername(name))[1])::uuid)) <> 'editor'
    and exists (select 1 from public.ideas i
                where i.id = ((storage.foldername(objects.name))[2])::uuid
                  and i.workspace_id = ((storage.foldername(objects.name))[1])::uuid
                  and app.can_see_brand(i.brand_id)));

create policy idea_covers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'idea-covers' and (owner_id = (select auth.uid())::text
    or app.is_admin(((storage.foldername(name))[1])::uuid)));

-- Ideas changed by someone else show up without a refresh.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ideas') then
    alter publication supabase_realtime add table public.ideas;
  end if;
end $$;
