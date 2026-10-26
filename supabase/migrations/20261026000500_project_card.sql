-- Project card + detail modal (docs/design/project-card/HANDOFF.md).
-- brief: the project's hook, angle and notes, edited inline on the modal's Overview.
-- project_reads: when each person last opened a project's Comments, so cards can show a dot for unread comments.

alter table public.projects add column if not exists brief text check (brief is null or length(brief) <= 20000);

create table if not exists public.project_reads (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_reads_user on public.project_reads (user_id);

alter table public.project_reads enable row level security;

revoke all on public.project_reads from anon;
revoke truncate on public.project_reads from authenticated;
grant select, insert, update, delete on public.project_reads to authenticated;

-- Read state is per person: you only see and write your own rows, on projects you can open.
create policy project_reads_select on public.project_reads for select to authenticated
  using (user_id = (select auth.uid()));
create policy project_reads_insert on public.project_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and app.is_internal(app.project_ws(project_id)) and app.has_project_access(project_id));
create policy project_reads_update on public.project_reads for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy project_reads_delete on public.project_reads for delete to authenticated
  using (user_id = (select auth.uid()));
