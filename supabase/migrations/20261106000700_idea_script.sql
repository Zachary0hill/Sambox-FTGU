-- Scripts live on the idea as their own field: ideas.script holds {beats: [{time, label, text}], source: 'manual'|'ai',
-- model, updatedAt}. Ideas written before this read their beats out of the body paragraphs until a script is saved.
-- The AI usage page gets a 'script' feature for generated drafts.
alter table public.ideas add column if not exists script jsonb;
alter table public.ideas drop constraint if exists ideas_script_check;
alter table public.ideas add constraint ideas_script_check check (
  script is null or (jsonb_typeof(script) = 'object' and jsonb_typeof(script->'beats') = 'array'
    and jsonb_array_length(script->'beats') <= 120 and pg_column_size(script) <= 200000));

alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check check (feature in ('assistant','research','cover','script','other'));
