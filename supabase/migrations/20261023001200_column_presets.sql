-- Saved column presets (database components handoff, step 8: Properties.dc.html B, "Save current as preset").
-- The built-in presets (Essentials, All fields, Production, Post, Publishing, Sponsor) stay in code. A Super Admin can
-- save the columns shown right now, in their order, as a named preset for the whole workspace:
--   [ { "id": "p1x2y3z", "name": "Launch week", "columns": ["project", "job", "status", "pub"] }, ... ]
-- Members read it with the rest of workspace_settings; Super Admins (settings:edit) write it under the existing policies.

alter table public.workspace_settings
  add column if not exists column_presets jsonb not null default '[]'::jsonb check (jsonb_typeof(column_presets) = 'array');

comment on column public.workspace_settings.column_presets is
  'Saved board column presets: [{ id, name, columns: [column keys in order] }]. Built-in presets live in code.';
