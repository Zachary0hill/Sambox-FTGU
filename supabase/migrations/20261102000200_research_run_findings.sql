-- A run keeps its findings until ideas are saved, so a drafting failure (no AI credits, a provider outage) can be drafted
-- again without paying the sources twice. Cleared on success: saved ideas carry the findings they cite (ideas.findings).
alter table public.research_runs add column if not exists findings jsonb;
