-- Free-text voice prompt on each brand kit: the brand's voice, rules and style written as one prompt instead of
-- (or alongside) tone words, do's and don'ts. The assistant and the research agent pass it through verbatim.
-- Edited from Edit brand on the Brand page; writes go through brand_kits' existing update policy.

alter table public.brand_kits
  add column if not exists voice_prompt text not null default '' check (length(voice_prompt) <= 6000);
