-- YouTube -> Content page. Public data for the workspace's channels, pulled with an API key by
-- /api/integrations/youtube/sync and written with the secret key only (no write policies here).

create table public.youtube_videos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  video_id text not null,
  channel_id text not null,
  channel_title text not null default '',
  title text not null default '',
  description text not null default '',
  published_at timestamptz,
  thumbnail_url text,
  duration_seconds int not null default 0,
  views bigint not null default 0,
  likes bigint,
  comments bigint,
  live_status text not null default 'none' check (live_status in ('none','live','upcoming')),
  project_id uuid references public.projects(id) on delete set null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, video_id)
);

comment on column public.youtube_videos.channel_id is 'YouTube channel ID (UC...), matches channels.youtube_channel_id';
comment on column public.youtube_videos.description is 'First 300 characters';
comment on column public.youtube_videos.likes is 'Null when YouTube does not return it (likes hidden)';
comment on column public.youtube_videos.comments is 'Null when YouTube does not return it (comments off)';
comment on column public.youtube_videos.project_id is 'Board project whose youtube_video_id or link_url points at this video';

create index youtube_videos_ws_published on public.youtube_videos (workspace_id, published_at desc);
create index youtube_videos_project on public.youtube_videos (project_id);

alter table public.youtube_videos enable row level security;

-- Internal members read every synced video. Sponsors and clients read only videos of projects they can access.
create policy yt_select on public.youtube_videos for select to authenticated
  using ((select app.is_internal(workspace_id)) or (project_id is not null and app.has_project_access(project_id)));

revoke all on public.youtube_videos from anon;
revoke insert, update, delete, truncate on public.youtube_videos from authenticated;
grant select on public.youtube_videos to authenticated;
