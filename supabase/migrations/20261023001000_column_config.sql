-- Property settings for the board's built-in columns (database components handoff, step 5: Edit property).
-- Custom columns keep theirs in custom_fields.config; built-in columns (Publishing Date, Edit Deadline, Editor...)
-- have no row of their own, so their settings live here, keyed by column key:
--   { "pub": { "date_format": "full" | "short" | "us" | "iso" | "relative", "due_colors": true }, ... }
-- Super Admins edit it under the existing workspace_settings policies (settings:edit).

alter table public.workspace_settings
  add column if not exists column_config jsonb not null default '{}'::jsonb check (jsonb_typeof(column_config) = 'object');

comment on column public.workspace_settings.column_config is
  'Edit property settings for built-in board columns, keyed by column key: date_format (full | short | us | iso | relative), due_colors (bool).';
