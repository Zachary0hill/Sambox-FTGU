-- Per-user board view state (database components handoff, data model change 4). Each member keeps their own
-- column order, widths, hidden columns, frozen column, wrapped columns, sort and group by for each board role and
-- view. board_role is the board being looked at: a Super Admin previewing the Editor board saves under 'editor'.
-- Role defaults stay in role_board_config; nothing here changes what a role is allowed to see.
--
-- state shape:
--   { "order": [col keys], "widths": { key: px }, "hidden": { "role:key": bool }, "frozen": key | null,
--     "wrap": { key: true }, "sort": "default" | "<sort id>" | "col:<key>:asc|desc", "groupBy": "stage" | ... }

create table if not exists public.board_view_state (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  board_role public.user_role not null,
  view public.view_kind not null default 'table',
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id, board_role, view)
);

alter table public.board_view_state enable row level security;

-- Members read and write only their own rows.
create policy bvs_select on public.board_view_state for select to authenticated
  using (user_id = (select auth.uid()) and (select app.is_member(workspace_id)));
create policy bvs_insert on public.board_view_state for insert to authenticated
  with check (user_id = (select auth.uid()) and (select app.is_member(workspace_id)));
create policy bvs_update on public.board_view_state for update to authenticated
  using (user_id = (select auth.uid()) and (select app.is_member(workspace_id)))
  with check (user_id = (select auth.uid()) and (select app.is_member(workspace_id)));
create policy bvs_delete on public.board_view_state for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger set_updated_at before update on public.board_view_state
  for each row execute function extensions.moddatetime(updated_at);
