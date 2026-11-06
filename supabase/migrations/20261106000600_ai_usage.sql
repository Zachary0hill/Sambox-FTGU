-- AI usage: one row per model call (Daily assistant answer, research draft, idea cover image) so Super Admins can
-- see requests, tokens and estimated cost in Workspace Settings > AI usage. Rows are written by the server with the
-- secret-key client only (no insert policy); only active Super Admins of the workspace read them.
-- Cost is not stored: the page prices tokens at read time from lib/ai/pricing.ts plus the workspace's own price
-- overrides (workspace_settings.ai_prices), so fixing a price corrects past rows too.

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  feature text not null default 'other' check (feature in ('assistant','research','cover','other')),
  provider text not null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  reasoning_tokens integer not null default 0 check (reasoning_tokens >= 0),
  images integer not null default 0 check (images >= 0),
  ok boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.ai_usage is 'One row per AI model call. input_tokens excludes cache reads and writes. Written by the server; Super Admins read.';

create index if not exists ai_usage_ws_created on public.ai_usage (workspace_id, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_read on public.ai_usage;
create policy ai_usage_read on public.ai_usage for select to authenticated
  using ((select app.is_admin(workspace_id)));

revoke all on public.ai_usage from anon;
revoke insert, update, delete, truncate on public.ai_usage from authenticated;
grant select on public.ai_usage to authenticated;

-- Per-model price overrides set on the AI usage page: {"<provider>:<model>": {"in": 2, "out": 10, "cacheRead": 0.2, "cacheWrite": 2.5, "image": 0.04}}
-- in USD per 1M tokens (image: USD per image).
alter table public.workspace_settings
  add column if not exists ai_prices jsonb not null default '{}'::jsonb check (jsonb_typeof(ai_prices) = 'object');
