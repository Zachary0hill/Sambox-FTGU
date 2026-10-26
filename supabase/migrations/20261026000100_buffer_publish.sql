-- Publish to Buffer. A project's social post (caption, Buffer channels, when to post) lives in project_publish and is
-- edited in the project drawer. The "Publish to Buffer" automation action (lib/automations/run.ts) sends it when the
-- workflow's trigger fires, for example "Status becomes Ready": one Buffer post per chosen channel, recorded in
-- buffer_publications so a retry or a second trip through the same status never posts a channel twice.
--
-- Buffer's API takes media as a public URL that must stay live until the post goes out, and project-assets is private
-- with expiring signed URLs. So the runner copies the cut to the public buffer-media bucket under a random folder and
-- removes that copy once Buffer reports the post sent (or after 60 days).
-- Every change is additive, so the current production build keeps working while this is applied.

-- ---------- 1. A project's social post ----------
create table if not exists public.project_publish (
  project_id uuid primary key references public.projects(id) on delete cascade,
  caption text not null default '',
  buffer_channel_ids text[] not null default '{}',
  -- queue: Buffer's next free slot. now: share immediately. date: the project's Publishing date at post_time,
  -- in the workspace timezone.
  schedule text not null default 'queue' check (schedule in ('queue', 'now', 'date')),
  post_time time not null default '09:00',
  -- YouTube needs a title; empty means the project title.
  youtube_title text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.project_publish enable row level security;

-- The team reads it on projects they can open; Super Admins and people who can edit projects write it.
create policy ppub_select on public.project_publish for select to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_project_access(project_id));
create policy ppub_insert on public.project_publish for insert to authenticated
  with check (app.is_internal(app.project_ws(project_id)) and app.has_project_access(project_id)
    and (app.is_admin(app.project_ws(project_id)) or app.has_perm(app.project_ws(project_id), 'projects', 'edit')));
create policy ppub_update on public.project_publish for update to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_project_access(project_id)
    and (app.is_admin(app.project_ws(project_id)) or app.has_perm(app.project_ws(project_id), 'projects', 'edit')));
revoke all on public.project_publish from anon;

create or replace function app.publish_touch()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists publish_touch on public.project_publish;
create trigger publish_touch before insert or update on public.project_publish
for each row execute function app.publish_touch();

-- ---------- 2. What was sent to Buffer ----------
create table if not exists public.buffer_publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  channel_id text not null,
  service text not null default '',
  -- created: Buffer accepted the post. failed: Buffer or this app refused it (error says why).
  -- cleared: a Super Admin allowed this channel to be posted again.
  status text not null check (status in ('created', 'failed', 'cleared')),
  buffer_post_id text,
  due_at timestamptz,
  error text,
  media_path text,
  media_removed_at timestamptz,
  run_id uuid references public.automation_runs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists buffer_publications_project on public.buffer_publications (project_id, created_at desc);
create index if not exists buffer_publications_media on public.buffer_publications (workspace_id) where media_path is not null and media_removed_at is null;
-- One live post per project and channel.
create unique index if not exists buffer_publications_once on public.buffer_publications (project_id, channel_id) where status = 'created';
alter table public.buffer_publications enable row level security;

create policy bpub_select on public.buffer_publications for select to authenticated
  using (app.is_internal(workspace_id) and app.has_project_access(project_id));
-- A Super Admin clears a sent row to allow that channel again; everything else is written with the secret key.
create policy bpub_update on public.buffer_publications for update to authenticated
  using (app.is_admin(workspace_id)) with check (app.is_admin(workspace_id) and status = 'cleared');
revoke all on public.buffer_publications from anon;
revoke insert, update, delete, truncate on public.buffer_publications from authenticated;
grant select, update (status) on public.buffer_publications to authenticated;

-- ---------- 3. Public media for Buffer ----------
-- Public read by URL only: no policies, so nobody can list the bucket, and only the secret key writes to it.
insert into storage.buckets (id, name, public) values ('buffer-media', 'buffer-media', true)
on conflict (id) do update set public = true;

-- ---------- 4. Live updates in the drawer ----------
do $$
declare t text;
begin
  foreach t in array array['project_publish', 'buffer_publications'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
