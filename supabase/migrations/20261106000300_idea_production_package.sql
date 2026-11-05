alter table public.ideas
  add column title_options text[] not null default '{}',
  add column thumbnail_brief text not null default '';
alter table public.projects add column idea_package jsonb;
alter table public.projects drop constraint if exists projects_brief_check;
alter table public.projects add constraint projects_brief_check check(brief is null or length(brief)<=100000);
alter table public.project_assets add column source_idea_id uuid;
create unique index project_idea_cover_once on public.project_assets(project_id, source_idea_id)
  where source_idea_id is not null;

-- A changed brand must remain in the same workspace and within the editor's access.
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
     and not (app.has_perm(new.workspace_id,'ideas','approve') and app.has_perm(new.workspace_id,'projects','create')) then
    raise exception 'Idea approval is not permitted' using errcode='42501';
  end if;
  if cardinality(new.title_options)>12 or length(new.thumbnail_brief)>12000
     or exists(select 1 from unnest(new.title_options) t where length(t)>300) then
    raise exception 'Use up to 12 titles of 300 characters and a thumbnail brief of 12000 characters';
  end if;
  return new;
end $$;
create trigger guard_idea_brand before insert or update on public.ideas
  for each row execute function app.guard_idea_brand();

-- The row lock makes retries and simultaneous approvals return the same project.
-- Only the narrow idea handoff runs with elevated rights; the caller must already
-- have permission to approve this idea. No caller-supplied tenant/path/project IDs.
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
  if i.status not in ('in_review','approved') then
    raise exception 'Send the idea for review before approving it';
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
  update public.ideas set status='in_production',prev_status='approved',project_id=p.id where id=i.id;
  perform public.log_activity(p_category => 'idea', p_action => 'approved and created the project', p_target_label => i.title, p_idea => i.id);
  return jsonb_build_object('id',p.id,'job',p.job_code,'workspaceId',p.workspace_id,'package',package);
end $$;
revoke all on function public.approve_idea_project(uuid) from public,anon;
grant execute on function public.approve_idea_project(uuid) to authenticated;
