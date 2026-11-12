-- Idea automations: the Automations engine runs on ideas too (lib/automations/catalog.ts, scope 'idea').
-- A run for an idea carries idea_id instead of project_id. Triggers:
--   idea_created  an idea is inserted
--   idea_stage    an idea's stage changes (value: inbox, research, ready, approved)
--   idea_scored   research scores an idea at or above the workflow's number, once per crossing
--   idea_stale    an idea has not changed for N days (queued by public.queue_scheduled_idea_automations each tick)

alter table public.automation_runs add column if not exists idea_id uuid references public.ideas(id) on delete cascade;
create index if not exists automation_runs_idea_idx on public.automation_runs (idea_id) where idea_id is not null;

-- Queues one run per live workflow on this trigger. A workflow with no value matches every value. With p_new set the
-- trigger is a threshold: a workflow fires when the score reaches its number and the previous score was below it.
-- Nothing queues while Pause all automations is on, as for projects.
create or replace function app.queue_idea_automation(ws uuid, p_key text, p_value text, p_idea uuid,
  p_payload jsonb default '{}'::jsonb, p_dedupe text default null, p_new numeric default null, p_old numeric default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; a record; v text;
begin
  if ws is null or p_idea is null then return 0; end if;
  if coalesce((select (s.automation ->> 'paused')::boolean from public.workspace_settings s where s.workspace_id = ws), false) then return 0; end if;
  for a in
    select x.id, coalesce(x."trigger" ->> 'value', '') as tv from public.automations x
    where x.workspace_id = ws and x.enabled and not x.is_draft and x."trigger" ->> 'key' = p_key
  loop
    if p_new is not null then
      if a.tv !~ '^[0-9]+(\.[0-9]+)?$' then continue; end if;
      if not (p_new >= a.tv::numeric and (p_old is null or p_old < a.tv::numeric)) then continue; end if;
      v := a.tv;
    else
      if a.tv <> '' and lower(a.tv) <> lower(coalesce(p_value, '')) then continue; end if;
      v := p_value;
    end if;
    insert into public.automation_runs (automation_id, workspace_id, idea_id, trigger_key, status, payload, dedupe_key, actor_id, started_at)
    values (a.id, ws, p_idea, p_key, 'queued', coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('value', v),
      case when p_dedupe is null then null else a.id || ':' || p_dedupe end, auth.uid(), now())
    on conflict (dedupe_key) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- A research score, or null when the idea has none (or it is not a number).
create or replace function app.idea_score(r jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case when (r #>> '{score,total}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (r #>> '{score,total}')::numeric end
$$;

create or replace function app.auto_on_idea()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare was numeric; now_score numeric;
begin
  if tg_op = 'INSERT' then
    if new.archived_at is null then
      perform app.queue_idea_automation(new.workspace_id, 'idea_created', null, new.id, jsonb_build_object('stage', new.stage::text));
    end if;
    return new;
  end if;
  if new.archived_at is not null then return new; end if;
  if new.stage is distinct from old.stage then
    perform app.queue_idea_automation(new.workspace_id, 'idea_stage', new.stage::text, new.id,
      jsonb_build_object('from', old.stage::text, 'to', new.stage::text));
  end if;
  now_score := app.idea_score(new.research);
  was := app.idea_score(old.research);
  if now_score is not null and now_score is distinct from was then
    perform app.queue_idea_automation(new.workspace_id, 'idea_scored', null, new.id,
      jsonb_build_object('score', now_score, 'was', was), null, now_score, was);
  end if;
  return new;
end $$;

-- AFTER, so it only sees stage changes the gate (a2_gate_idea_stage, BEFORE) let through.
drop trigger if exists auto_on_idea on public.ideas;
create trigger auto_on_idea after insert or update of stage, research on public.ideas
for each row execute function app.auto_on_idea();

-- idea_stale: every live, unapproved idea untouched for the workflow's days. Deduped on the idea's last change, so an
-- idea is reminded once per quiet spell and again only after it changes and goes quiet again.
create or replace function public.queue_scheduled_idea_automations(p_ws uuid default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; r record;
begin
  for r in
    select distinct a.workspace_id, (a."trigger" ->> 'value') as days, i.id as iid, i.updated_at
    from public.automations a
    join public.ideas i on i.workspace_id = a.workspace_id
    where (p_ws is null or a.workspace_id = p_ws) and a.enabled and not a.is_draft
      and a."trigger" ->> 'key' = 'idea_stale' and coalesce(a."trigger" ->> 'value', '') ~ '^[0-9]+$'
      and i.archived_at is null and i.stage <> 'approved'
      and i.updated_at < now() - make_interval(days => (a."trigger" ->> 'value')::int)
  loop
    n := n + app.queue_idea_automation(r.workspace_id, 'idea_stale', r.days, r.iid,
      jsonb_build_object('days', r.days::int, 'since', r.updated_at), 'stale:' || r.iid || ':' || floor(extract(epoch from r.updated_at))::bigint);
  end loop;
  return n;
end $$;

revoke execute on function app.queue_idea_automation(uuid, text, text, uuid, jsonb, text, numeric, numeric), app.auto_on_idea(),
  public.queue_scheduled_idea_automations(uuid) from public, anon, authenticated;
grant execute on function public.queue_scheduled_idea_automations(uuid) to service_role;
