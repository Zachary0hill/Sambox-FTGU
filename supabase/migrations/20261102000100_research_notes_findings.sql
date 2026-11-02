-- A run can finish with nothing to show (no findings, or the model fell back to another provider): `note` explains
-- it without marking the run failed. Research ideas keep the findings they were drafted from for review.
alter table public.research_runs add column if not exists note text;
alter table public.ideas add column if not exists findings jsonb not null default '[]'::jsonb;
