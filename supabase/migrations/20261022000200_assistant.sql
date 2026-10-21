-- Daily assistant: assistant replies record which model answered and which tools it used.
-- Additive only. ai_messages keeps its existing msgs_own policy (members read and write their own threads).

alter table public.ai_messages
  add column if not exists meta jsonb not null default '{}'::jsonb;

comment on column public.ai_messages.meta is 'Assistant replies: {provider, model, tools[]}. Empty for user turns.';
