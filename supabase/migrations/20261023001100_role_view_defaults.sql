-- "Save for <role> view" (database components handoff, data model change 4; step 7 toolbar).
-- A Super Admin can save the board view they are looking at as the starting view for a role: filters, advanced
-- filter, sorts, group by, hidden columns, order, widths, frozen and wrapped columns, Show as. Members of that role
-- start from it until they change their own view, which then lives in board_view_state as before.
--
-- view_state shape, keyed by view kind:
--   { "table": { "filter": {...}, "advanced": {...}, "sorts": [...], "groupBy": "stage", "hidden": {...}, ... }, ... }
-- Members read it under the existing role_board_config policies; Super Admins (settings:edit) write it.

alter table public.role_board_config
  add column if not exists view_state jsonb not null default '{}'::jsonb check (jsonb_typeof(view_state) = 'object');

comment on column public.role_board_config.view_state is
  'Starting board view per view kind (filters, advanced filter, sorts, group by, columns) saved with "Save for <role> view". Members start from it until they change their own view (board_view_state).';
