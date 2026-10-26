-- Daily assistant preferences set from AI settings on the Daily page: the default answer mode ('fast' or 'think')
-- and extra instructions added to the assistant's system prompt. Writes go through workspace_settings' existing
-- Super Admin update policy.

alter table public.workspace_settings
  add column if not exists assistant jsonb not null default '{}'::jsonb check (jsonb_typeof(assistant) = 'object');
