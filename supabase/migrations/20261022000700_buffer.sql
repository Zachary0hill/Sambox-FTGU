-- Buffer -> Content page (Social view). Channels and sent posts with Buffer's normalized post metrics, pulled with a
-- personal API key by /api/integrations/buffer/sync and written with the secret key only (no write policies here).
-- Internal members (Super Admin, editors, designers) read them; sponsors and clients do not.
-- Buffer's API has no query for comments or direct messages, so nothing from Buffer lands in inbox_items yet.

create table public.buffer_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id text not null,
  organization_id text not null,
  organization_name text not null default '',
  service text not null default '',
  channel_type text not null default '',
  name text not null default '',
  display_name text,
  avatar_url text,
  external_link text,
  is_disconnected boolean not null default false,
  is_locked boolean not null default false,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, channel_id)
);

comment on column public.buffer_channels.service is 'Buffer Service enum: instagram, tiktok, linkedin, twitter, facebook, youtube, threads, ...';
comment on column public.buffer_channels.name is 'Handle or username on the network';

create table public.buffer_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id text not null,
  channel_id text not null,
  organization_id text not null,
  service text not null default '',
  text text not null default '',
  thumbnail_url text,
  external_link text,
  sent_at timestamptz,
  due_at timestamptz,
  -- Buffer's normalized metrics. Null when the network has not reported that metric for the post (not zero).
  impressions bigint,
  reach bigint,
  views bigint,
  reactions bigint,
  comments bigint,
  shares bigint,
  reposts bigint,
  saves bigint,
  clicks bigint,
  engagement_rate numeric(7,2),
  metrics jsonb not null default '[]'::jsonb,
  metrics_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, post_id)
);

comment on column public.buffer_posts.text is 'First 500 characters';
comment on column public.buffer_posts.metrics is 'Every PostMetric Buffer returned: [{type, name, value, unit}]';
comment on column public.buffer_posts.engagement_rate is 'Percentage, 0-100';
comment on column public.buffer_posts.metrics_updated_at is 'When Buffer last pulled metrics from the network (daily)';

create index buffer_posts_ws_sent on public.buffer_posts (workspace_id, sent_at desc);
create index buffer_posts_ws_channel on public.buffer_posts (workspace_id, channel_id, sent_at desc);

alter table public.buffer_channels enable row level security;
alter table public.buffer_posts enable row level security;

create policy buffer_channels_select on public.buffer_channels for select to authenticated
  using ((select app.is_internal(workspace_id)));
create policy buffer_posts_select on public.buffer_posts for select to authenticated
  using ((select app.is_internal(workspace_id)));

revoke all on public.buffer_channels from anon;
revoke all on public.buffer_posts from anon;
revoke insert, update, delete, truncate on public.buffer_channels from authenticated;
revoke insert, update, delete, truncate on public.buffer_posts from authenticated;
grant select on public.buffer_channels to authenticated;
grant select on public.buffer_posts to authenticated;
