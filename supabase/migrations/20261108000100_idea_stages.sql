-- Ideas move to the four spec stages: inbox, research, ready, approved. Archived becomes a flag, so an
-- idea keeps its stage while archived. In production is no longer an idea state: it is read from the
-- linked project. `status` and `prev_status` stay in sync through the trigger below so a client that
-- has not reloaded keeps working; a later migration drops them.
create type public.idea_stage as enum ('inbox','research','ready','approved');

alter table public.ideas
  add column stage public.idea_stage not null default 'inbox',
  add column archived_at timestamptz,
  add column converted jsonb not null default '[]'::jsonb check (jsonb_typeof(converted) = 'array'),
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles(id) on delete set null,
  add column run jsonb,
  add column research jsonb,
  add column files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  -- Row-level enforcement ships with the competitor tables. Nothing sets this yet.
  add column restricted boolean not null default false;

alter table public.ideas drop constraint if exists ideas_source_check;
alter table public.ideas add constraint ideas_source_check check (source in ('manual','research','chat','import','url'));

-- The backfill must not look like a member edit, or every idea would lose its Updated and Stale position.
alter table public.ideas disable trigger set_updated_at;

update public.ideas set
  stage = (case
    when status = 'draft' then 'inbox'
    when status = 'in_review' then 'research'
    when status in ('approved','in_production') then 'approved'
    when prev_status = 'in_review' then 'research'
    when prev_status in ('approved','in_production') then 'approved'
    else 'inbox'
  end)::public.idea_stage,
  archived_at = case when status = 'archived' then updated_at end;

update public.ideas i set converted = jsonb_build_array(jsonb_build_object(
    'kind', 'project', 'id', p.id, 'label', p.title, 'created_at', p.created_at))
  from public.projects p
  where p.id = i.project_id;

update public.ideas i set approved_at = l.created_at, approved_by = l.actor_id
  from (
    select distinct on (idea_id) idea_id, created_at, actor_id
    from public.activity_log
    where idea_id is not null and action = 'approved and created the project'
    order by idea_id, created_at desc
  ) l
  where l.idea_id = i.id and i.stage = 'approved';

alter table public.ideas enable trigger set_updated_at;

-- Keeps the old and new columns in step. Whichever side the writer changed wins, and the new columns win
-- if both changed. Named to run before guard_idea_brand, which still reads `status`.
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
       and new.status is not distinct from old.status then
      return new;
    end if;
    stage_led := new.stage is distinct from old.stage or new.archived_at is distinct from old.archived_at;
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

create trigger a0_sync_idea_stage before insert or update on public.ideas
  for each row execute function app.sync_idea_stage();

-- Same handoff as before, now ending on Approved and recording what the idea became. Inbox and archived
-- ideas are refused. Research stays allowed until the Ready gate ships, so an open tab can still approve.
create or replace function public.approve_idea_project(p_idea uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.ideas; b public.brand_kits; p public.projects; st uuid; ct uuid;
  role public.user_role; brief_text text; package jsonb;
begin
  select * into i from public.ideas where id=p_idea for update;
  if not found or auth.uid() is null or not app.can_see_idea(i.id) then
    raise exception 'Idea not available' using errcode='42501';
  end if;
  role := app.member_role(i.workspace_id);
  if not (app.is_admin(i.workspace_id)
    or (role='manager' and app.has_perm(i.workspace_id,'ideas','approve') and app.has_perm(i.workspace_id,'projects','create'))
    or (role='designer' and i.author_id=auth.uid())
    or role in ('sponsor','client')) then
    raise exception 'You cannot approve this idea' using errcode='42501';
  end if;
  if i.project_id is not null then
    select * into p from public.projects where id=i.project_id and workspace_id=i.workspace_id;
    if not found or not (app.has_project_access(p.id) or p.idea_package->>'ideaId'=i.id::text) then raise exception 'Linked project is unavailable' using errcode='42501'; end if;
    return jsonb_build_object('id',p.id,'job',p.job_code,'workspaceId',p.workspace_id,'package',p.idea_package);
  end if;
  if i.archived_at is not null or i.stage = 'inbox' then
    raise exception 'Move the idea to Ready before approving it';
  end if;
  select * into b from public.brand_kits where id=i.brand_id and workspace_id=i.workspace_id;
  select id into st from public.project_statuses where workspace_id=i.workspace_id and stage='in_production' order by sort limit 1;
  if st is null then raise exception 'Add an In Production status before approving ideas'; end if;
  select id into ct from public.content_types where workspace_id=i.workspace_id
    and key=case when i.format in ('short','reel','podcast_clip') then 'shortform' when i.format='livestream' then 'youtube_live' else 'youtube_video' end limit 1;
  package := jsonb_build_object('body',i.body,'hook',i.hook,'audience',i.audience,'promise',i.promise,'ideaId',i.id,'brand',b.name,'titleOptions',i.title_options,
    'thumbnailBrief',i.thumbnail_brief,'coverPath',i.cover_path,'references',i.refs,'approvedAt',now());
  brief_text := concat_ws(E'\n\n', 'Approved idea: '||i.title, 'Brand: '||b.name,
    case when i.hook is not null then 'Hook: '||i.hook end,
    case when cardinality(i.title_options)>0 then 'Title options:'||E'\n'||array_to_string(i.title_options,E'\n') end,
    case when i.thumbnail_brief<>'' then 'Thumbnail direction:'||E'\n'||i.thumbnail_brief end,
    case when i.audience is not null then 'Audience: '||i.audience end,
    case when i.promise is not null then 'Viewer takeaway: '||i.promise end,
    array_to_string(i.body,E'\n\n'),
    case when cardinality(i.refs)>0 then 'References:'||E'\n'||array_to_string(i.refs,E'\n') end);
  insert into public.projects(workspace_id,job_code,title,channel_id,content_type_id,status_id,created_by,brief,idea_package)
    values(i.workspace_id,'IDEA-'||replace(i.id::text,'-',''),i.title,b.channel_id,ct,st,auth.uid(),brief_text,package)
    returning * into p;
  if b.kind='sponsor' and b.account_id is not null then
    insert into public.sponsorships(project_id,account_id) values(p.id,b.account_id);
  elsif i.sponsor_id is not null then
    insert into public.sponsorships(project_id,account_id)
      select p.id,account_id from public.brand_kits where id=i.sponsor_id and workspace_id=i.workspace_id and kind='sponsor' and account_id is not null;
  end if;
  update public.ideas set stage='approved',project_id=p.id,approved_at=now(),approved_by=auth.uid(),
    converted=converted||jsonb_build_array(jsonb_build_object('kind','project','id',p.id,'label',p.title,'created_at',now()))
    where id=i.id;
  perform public.log_activity(p_category => 'idea', p_action => 'approved and created the project', p_target_label => i.title, p_idea => i.id);
  return jsonb_build_object('id',p.id,'job',p.job_code,'workspaceId',p.workspace_id,'package',package);
end $$;
