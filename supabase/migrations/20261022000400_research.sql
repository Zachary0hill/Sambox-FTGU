-- Research agent runs (Ideas & Research). A Super Admin starts a run; the server gathers findings from Apify,
-- Browserbase and Firecrawl, asks the workspace's AI model for idea drafts, and saves them as Research ideas.
-- The row keeps progress so a long run survives a page reload. Progress writes come from the server's secret-key
-- client; Super Admins read the rows (and get realtime updates) through RLS.

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brand_kits(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  inputs jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','done','failed','cancelled')),
  sources jsonb not null default '{}'::jsonb,
  actor_run_ids text[] not null default '{}',
  finding_count integer not null default 0,
  idea_ids uuid[] not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index research_runs_ws_created on public.research_runs (workspace_id, created_at desc);
create index on public.research_runs (brand_id);
create index on public.research_runs (created_by);

create trigger set_updated_at before update on public.research_runs
for each row execute function extensions.moddatetime(updated_at);

alter table public.research_runs enable row level security;

create policy rr_select on public.research_runs for select to authenticated
  using ((select app.is_admin(workspace_id)));
create policy rr_insert on public.research_runs for insert to authenticated
  with check ((select app.is_admin(workspace_id)) and created_by = (select auth.uid()));
create policy rr_update on public.research_runs for update to authenticated
  using ((select app.is_admin(workspace_id))) with check ((select app.is_admin(workspace_id)));
create policy rr_delete on public.research_runs for delete to authenticated
  using ((select app.is_admin(workspace_id)));

alter publication supabase_realtime add table public.research_runs;
