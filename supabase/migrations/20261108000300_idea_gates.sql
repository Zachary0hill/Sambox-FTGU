-- An idea already on Approved can gain a project later, which an old client must read as In production.
create or replace function app.sync_idea_stage() returns trigger
language plpgsql set search_path = '' as $$
declare
  stage_led boolean;
  stage_status public.idea_status;
begin
  if tg_op = 'INSERT' then
    stage_led := new.stage <> 'inbox' or new.archived_at is not null;
  else
    if new.stage is not distinct from old.stage and new.archived_at is not distinct from old.archived_at
       and new.status is not distinct from old.status and new.project_id is not distinct from old.project_id then
      return new;
    end if;
    stage_led := new.stage is distinct from old.stage or new.archived_at is distinct from old.archived_at
      or (new.project_id is distinct from old.project_id and new.status is not distinct from old.status);
  end if;

  if stage_led then
    stage_status := case
      when new.stage = 'inbox' then 'draft'
      when new.stage in ('research','ready') then 'in_review'
      when new.project_id is not null then 'in_production'
      else 'approved'
    end;
    if new.archived_at is not null then
      new.status := 'archived';
      new.prev_status := stage_status;
    else
      new.status := stage_status;
      new.prev_status := null;
    end if;
  elsif new.status = 'archived' then
    new.archived_at := coalesce(new.archived_at, now());
    new.stage := (case
      when new.prev_status = 'in_review' then 'research'
      when new.prev_status in ('approved','in_production') then 'approved'
      when new.prev_status = 'draft' then 'inbox'
      else new.stage::text
    end)::public.idea_stage;
  else
    new.archived_at := null;
    new.stage := (case
      when new.status = 'draft' then 'inbox'
      when new.status = 'in_review' then 'research'
      else 'approved'
    end)::public.idea_stage;
  end if;
  return new;
end $$;

-- Stage gates from Rules, enforced on every write path, plus converting an approved idea to a task or a social post.
-- Labels here must match REQUIRED_FIELDS in lib/ideas/rules-shared.ts; tests/idea-gates-db.sql checks the wording.
create or replace function app.idea_gate_missing(i public.ideas, p_stage text) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
  need jsonb;
  field text;
  pursue numeric;
  missing text[] := '{}';
begin
  select rules into r from public.ideas_rules where workspace_id = i.workspace_id;
  need := coalesce(r->'required_fields_by_stage'->p_stage, case when p_stage = 'ready' then '["notes"]'::jsonb else '[]'::jsonb end);
  pursue := coalesce((r->'recommendation'->>'pursue')::numeric, 70);
  for field in select jsonb_array_elements_text(need) loop
    if field = 'notes' and not exists (select 1 from unnest(i.body) b where trim(b) <> '') then
      missing := array_append(missing, 'Notes written');
    elsif field = 'source' and cardinality(i.refs) = 0 and jsonb_array_length(i.findings) = 0 then
      missing := array_append(missing, 'At least one source');
    elsif field = 'cover' and i.cover_path is null then
      missing := array_append(missing, 'Cover image set');
    elsif field = 'score' and (i.impact is null or i.confidence is null or i.ease is null
        or (i.impact + i.confidence + i.ease) / 3.0 * 10 < pursue) then
      missing := array_append(missing, 'Score at the Pursue threshold');
    end if;
  end loop;
  return missing;
end $$;

-- Moving forward checks every gate passed on the way. Entering Approved also re-checks Ready, because the gate may
-- have changed since the idea got there. Moving back and archiving are always allowed.
create or replace function app.gate_idea_stage() returns trigger
language plpgsql set search_path = '' as $$
declare
  stages text[] := array['inbox','research','ready','approved'];
  from_at int;
  to_at int;
  missing text[];
begin
  if new.stage is not distinct from old.stage or new.archived_at is not null then
    return new;
  end if;
  from_at := array_position(stages, old.stage::text);
  to_at := array_position(stages, new.stage::text);
  if to_at <= from_at then
    return new;
  end if;
  if from_at < 2 and to_at >= 2 then
    missing := app.idea_gate_missing(new, 'research');
    if cardinality(missing) > 0 then
      raise exception 'Can''t move to Research yet. Still needed: %.', array_to_string(missing, ', ') using errcode = '23514';
    end if;
  end if;
  if to_at >= 3 then
    missing := app.idea_gate_missing(new, 'ready');
    if cardinality(missing) > 0 then
      if to_at = 4 then
        raise exception 'Can''t approve yet. Still needed: %.', array_to_string(missing, ', ') using errcode = '23514';
      end if;
      raise exception 'Can''t move to Ready yet. Still needed: %.', array_to_string(missing, ', ') using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- Named to run after the stage sync, so a write to the old status column is gated too.
create trigger a2_gate_idea_stage before update on public.ideas
  for each row execute function app.gate_idea_stage();

-- Projects go through approve_idea_project. This covers the other targets, and an idea can convert many times.
create or replace function public.convert_idea(p_idea uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i public.ideas;
  b public.brand_kits;
  role public.user_role;
  targets jsonb;
  created uuid;
  target_platform text;
begin
  if p_kind not in ('task','social') then
    raise exception 'Choose what to create' using errcode = '22023';
  end if;
  select * into i from public.ideas where id = p_idea for update;
  if not found or auth.uid() is null or not app.can_see_idea(i.id) then
    raise exception 'Idea not available' using errcode = '42501';
  end if;
  role := app.member_role(i.workspace_id);
  if not (app.is_admin(i.workspace_id)
    or (role = 'manager' and app.has_perm(i.workspace_id, 'ideas', 'approve'))
    or (role = 'designer' and i.author_id = auth.uid())
    or role in ('sponsor','client')) then
    raise exception 'You cannot approve this idea' using errcode = '42501';
  end if;
  if p_kind = 'social' and not (app.is_admin(i.workspace_id) or app.has_perm(i.workspace_id, 'projects', 'edit')) then
    raise exception 'You cannot add to Content' using errcode = '42501';
  end if;
  select coalesce(rules->'conversion_targets', '["project","task","social"]'::jsonb) into targets from public.ideas_rules where workspace_id = i.workspace_id;
  if targets is not null and not targets ? p_kind then
    raise exception 'That target is turned off in Rules';
  end if;
  if i.archived_at is not null or i.stage not in ('ready','approved') then
    raise exception 'Move the idea to Ready before approving it';
  end if;

  if p_kind = 'task' then
    insert into public.tasks(workspace_id, owner_id, text)
      values (i.workspace_id, coalesce(i.owner_id, i.author_id), i.title)
      returning id into created;
  else
    select * into b from public.brand_kits where id = i.brand_id and workspace_id = i.workspace_id;
    target_platform := case lower(coalesce(i.platforms[1], ''))
      when 'youtube' then 'youtube' when 'shorts' then 'youtube' when 'instagram' then 'instagram' when 'tiktok' then 'tiktok'
      when 'facebook' then 'facebook' when 'linkedin' then 'linkedin' when 'x' then 'x' when 'threads' then 'threads' else 'other' end;
    insert into public.content_entries(workspace_id, title, platform, status, channel_id, hook, notes, created_by)
      values (i.workspace_id, i.title, target_platform, 'scheduled', b.channel_id, left(coalesce(i.hook, ''), 24),
        array_to_string(i.body, E'\n\n'), auth.uid())
      returning id into created;
  end if;

  update public.ideas set stage = 'approved', approved_at = coalesce(approved_at, now()), approved_by = coalesce(approved_by, auth.uid()),
    converted = converted || jsonb_build_array(jsonb_build_object('kind', p_kind, 'id', created, 'label', i.title, 'created_at', now()))
    where id = i.id;
  perform public.log_activity(p_category => 'idea',
    p_action => case when p_kind = 'task' then 'approved and created a task' else 'approved and created a social post' end,
    p_target_label => i.title, p_idea => i.id);
  return jsonb_build_object('kind', p_kind, 'id', created, 'workspaceId', i.workspace_id, 'coverPath', i.cover_path, 'hasHook', coalesce(i.hook, '') <> '');
end $$;
revoke all on function public.convert_idea(uuid, text) from public, anon;
grant execute on function public.convert_idea(uuid, text) to authenticated;
