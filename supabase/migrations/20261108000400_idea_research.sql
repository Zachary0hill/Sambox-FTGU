-- Per-idea research: the spend ledger gains a stored cost and a run link, the gates can read research results, and
-- a scheduler picks up queued runs and auto-research every minute.
alter table public.ai_usage
  add column if not exists cost_usd numeric(10,4) check (cost_usd is null or cost_usd >= 0),
  add column if not exists run_id uuid;
alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check check (feature in ('assistant','research','cover','script','competitor','other'));
create index if not exists ai_usage_spend on public.ai_usage (workspace_id, created_at desc) where cost_usd is not null;

-- Labels must match REQUIRED_FIELDS in lib/ideas/rules-shared.ts. A research score, when present, replaces the ICE average.
create or replace function app.idea_gate_missing(i public.ideas, p_stage text) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
  need jsonb;
  field text;
  pursue numeric;
  total numeric;
  missing text[] := '{}';
begin
  select rules into r from public.ideas_rules where workspace_id = i.workspace_id;
  need := coalesce(r->'required_fields_by_stage'->p_stage, case when p_stage = 'ready' then '["notes"]'::jsonb else '[]'::jsonb end);
  pursue := coalesce((r->'recommendation'->>'pursue')::numeric, 70);
  total := coalesce((i.research->'score'->>'total')::numeric,
    case when i.impact is not null and i.confidence is not null and i.ease is not null then (i.impact + i.confidence + i.ease) / 3.0 * 10 end);
  for field in select jsonb_array_elements_text(need) loop
    if field = 'notes' and not exists (select 1 from unnest(i.body) b where trim(b) <> '') then
      missing := array_append(missing, 'Notes written');
    elsif field = 'source' and cardinality(i.refs) = 0 and jsonb_array_length(i.findings) = 0 then
      missing := array_append(missing, 'At least one source');
    elsif field = 'cover' and i.cover_path is null then
      missing := array_append(missing, 'Cover image set');
    elsif field = 'score' and (total is null or total < pursue) then
      missing := array_append(missing, 'Score at the Pursue threshold');
    elsif field = 'research' and i.research is null then
      missing := array_append(missing, 'Research finished');
    elsif field = 'pursue' and (i.research->'score'->>'total' is null or (i.research->'score'->>'total')::numeric < pursue) then
      missing := array_append(missing, 'Research says Pursue');
    end if;
  end loop;
  return missing;
end $$;

select cron.schedule('ftgu-idea-research', '* * * * *', $$select app.cron_call('/api/ideas/research/tick')$$);
