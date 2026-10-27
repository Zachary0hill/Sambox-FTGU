-- Social links on each brand kit: a list of [platform, url] pairs edited from Edit brand on the Brand page.
-- Writes go through brand_kits' existing update policy.

alter table public.brand_kits
  add column if not exists socials jsonb not null default '[]'::jsonb check (jsonb_typeof(socials) = 'array');
