-- Dev Notes: the "press N anywhere" floating dock for Super Admins. A shared development backlog per workspace:
-- ideas, enhancements and bugs jotted down while browsing, each tagged with the page path it was logged from and
-- who wrote it. Every Super Admin in the workspace sees, resolves and deletes the same list. Other roles never see
-- the table: RLS lets only active Super Admins in.

create table if not exists public.dev_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content text not null check (length(content) between 1 and 2000),
  category text not null default 'idea' check (category in ('idea', 'enhancement', 'bug')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  page_path text check (page_path is null or length(page_path) <= 512),
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The dock's list: open notes first, newest first, within a workspace.
create index if not exists dev_notes_ws_open_idx on public.dev_notes (workspace_id, is_resolved, sort_order, created_at desc);

alter table public.dev_notes enable row level security;

create policy dev_notes_select on public.dev_notes for select to authenticated
  using ((select app.is_admin(workspace_id)));
create policy dev_notes_insert on public.dev_notes for insert to authenticated
  with check ((select app.is_admin(workspace_id)) and created_by = (select auth.uid()));
create policy dev_notes_update on public.dev_notes for update to authenticated
  using ((select app.is_admin(workspace_id)))
  with check ((select app.is_admin(workspace_id)));
create policy dev_notes_delete on public.dev_notes for delete to authenticated
  using ((select app.is_admin(workspace_id)));

create trigger set_updated_at before update on public.dev_notes
  for each row execute function extensions.moddatetime(updated_at);

-- The dock refreshes live when another Super Admin adds or resolves a note.
alter publication supabase_realtime add table public.dev_notes;
