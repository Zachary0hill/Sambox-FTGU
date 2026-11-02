-- Dismissing a finished research run hides its banner on Ideas & Research for every Super Admin, across reloads.
-- Before this the dismissal lived only in page state and the banner came back on the next visit.

alter table public.research_runs
  add column if not exists dismissed_at timestamptz;
