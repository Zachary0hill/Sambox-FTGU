alter table public.content_entries drop constraint content_entries_status_check;
alter table public.content_entries add constraint content_entries_status_check check(status in ('draft','published','scheduled'));
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
    elsif field = 'source' and cardinality(i.refs) = 0 and jsonb_array_length(i.findings) = 0 and jsonb_array_length(coalesce(i.research->'sources','[]'::jsonb)) = 0 then
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
      values (i.workspace_id, i.title, target_platform, 'draft', b.channel_id, left(coalesce(i.hook, ''), 24),
        array_to_string(i.body, E'\n\n'), auth.uid())
      returning id into created;
  end if;

  update public.ideas set stage = 'approved', approved_at = coalesce(approved_at, now()), approved_by = coalesce(approved_by, auth.uid()),
    converted = converted || jsonb_build_array(jsonb_build_object('kind', p_kind, 'id', created, 'label', i.title, 'created_at', now()))
    where id = i.id;
  perform public.log_activity(p_category => 'idea',
    p_action => case when p_kind = 'task' then 'approved and created a task' else 'approved and created a content draft' end,
    p_target_label => i.title, p_idea => i.id);
  return jsonb_build_object('kind', p_kind, 'id', created, 'workspaceId', i.workspace_id, 'coverPath', i.cover_path, 'hasHook', coalesce(i.hook, '') <> '');
end $$;
revoke all on function public.convert_idea(uuid, text) from public, anon;
grant execute on function public.convert_idea(uuid, text) to authenticated;

create or replace function app.guard_idea_brand() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.workspace_id <> old.workspace_id then
    raise exception 'Ideas cannot move between workspaces' using errcode = '42501';
  end if;
  if not exists(select 1 from public.brand_kits where id=new.brand_id and workspace_id=new.workspace_id) then
    raise exception 'Choose a brand in this workspace' using errcode = '23514';
  end if;
  if auth.uid() is not null and not app.can_see_brand(new.brand_id) then
    raise exception 'You cannot use that brand' using errcode = '42501';
  end if;
  if new.project_id is not null and not exists(select 1 from public.projects where id=new.project_id and workspace_id=new.workspace_id) then raise exception 'The linked project must belong to this workspace' using errcode='23514'; end if;
  if auth.uid() is not null and app.member_role(new.workspace_id)='manager'
     and new.status in ('approved','in_production') and (tg_op='INSERT' or new.status is distinct from old.status)
     and not app.has_perm(new.workspace_id,'ideas','approve') then
    raise exception 'Idea approval is not permitted' using errcode='42501';
  end if;
  if cardinality(new.title_options)>12 or length(new.thumbnail_brief)>12000
     or exists(select 1 from unnest(new.title_options) t where length(t)>300) then
    raise exception 'Use up to 12 titles of 300 characters and a thumbnail brief of 12000 characters';
  end if;
  return new;
end $$;
