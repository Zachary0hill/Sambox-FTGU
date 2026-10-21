-- Messages from connected tools (Slack now, Buffer next) shown in the Inbox's Messages mode. Internal members
-- (Super Admin, editors, designers) read them; sponsors and clients never do. Only the server writes items, with
-- the secret key. Read state is per person: a row in inbox_reads means that person has read that item.

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null check (source in ('slack', 'buffer')),
  -- message | mention | dm for Slack; comment | message for Buffer.
  kind text not null default 'message',
  -- The source's own ID, unique per workspace and source. Slack: '<channel>:<ts>'.
  external_id text not null,
  channel_id text,
  channel_label text not null default '',
  -- Parent thread or post the item replies to; null for top-level items.
  thread_id text,
  author_name text not null default '',
  author_avatar_url text,
  text text not null default '',
  url text,
  occurred_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source, external_id)
);

create index if not exists inbox_items_ws_time on public.inbox_items (workspace_id, occurred_at desc);
create index if not exists inbox_items_channel_time on public.inbox_items (workspace_id, source, channel_id, occurred_at desc);

create table if not exists public.inbox_reads (
  item_id uuid not null references public.inbox_items(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index if not exists inbox_reads_user on public.inbox_reads (user_id);

alter table public.inbox_items enable row level security;
alter table public.inbox_reads enable row level security;

revoke all on public.inbox_items from anon;
revoke all on public.inbox_reads from anon;
revoke insert, update, delete, truncate on public.inbox_items from authenticated;
revoke update, truncate on public.inbox_reads from authenticated;
grant select on public.inbox_items to authenticated;
grant select, insert, delete on public.inbox_reads to authenticated;

create policy inbox_select on public.inbox_items for select to authenticated
  using ((select app.is_internal(workspace_id)));

create policy inbox_reads_select on public.inbox_reads for select to authenticated
  using (user_id = (select auth.uid()));
create policy inbox_reads_insert on public.inbox_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.inbox_items i where i.id = item_id and app.is_internal(i.workspace_id)));
create policy inbox_reads_delete on public.inbox_reads for delete to authenticated
  using (user_id = (select auth.uid()));

-- New messages show up live; RLS still decides who hears about them.
alter publication supabase_realtime add table public.inbox_items;
