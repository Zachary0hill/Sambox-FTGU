create or replace function app.idea_project_handoff(p_idea uuid, preview boolean, expected_review text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.ideas; b public.brand_kits; p public.projects; st uuid; ct public.content_types;
  role public.user_role; sponsor_account uuid; brief_text text; package jsonb; research_links text; job_owner text; destination jsonb; review_key text;
begin
  perform app.require_verified_session();
  if preview then
    select * into i from public.ideas where id=p_idea;
  else
    select * into i from public.ideas where id=p_idea for update;
  end if;
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
    if not found or not (app.has_project_access(p.id) or coalesce(p.idea_package->>'ideaId'=i.id::text,false)) then raise exception 'Linked project is unavailable' using errcode='42501'; end if;
    if preview then raise exception 'This idea already has a project. Open the linked project to inspect it.'; end if;
    return jsonb_build_object('id',p.id,'job',p.job_code,'workspaceId',p.workspace_id,'package',case when p.idea_package->>'ideaId'=i.id::text then p.idea_package end,
      'created',false,'canOpen',app.has_project_access(p.id));
  end if;
  if i.archived_at is not null or i.stage = 'inbox' then
    raise exception 'Move the idea to Ready before approving it';
  end if;
  select * into b from public.brand_kits where id=i.brand_id and workspace_id=i.workspace_id;
  -- A client is attached by its owned channel. A sponsor brand uses its own account;
  -- a channel brand can also carry the sponsor selected under Sponsor fit.
  if b.kind='channel' and b.account_id is not null and not exists (
    select 1 from public.channels where id=b.channel_id and workspace_id=i.workspace_id and owner_account_id=b.account_id
  ) then
    raise exception 'Link the idea''s client brand to its owned channel before approving';
  end if;
  if b.kind='sponsor' or i.sponsor_id is not null then
    select a.id into sponsor_account
      from public.brand_kits kit
      join public.accounts a on a.id=kit.account_id and a.workspace_id=kit.workspace_id and a.type='sponsor'
      where kit.id=case when b.kind='sponsor' then b.id else i.sponsor_id end
        and kit.workspace_id=i.workspace_id and kit.kind='sponsor';
    if sponsor_account is null then
      raise exception 'Link the selected sponsor brand to a sponsor account before approving';
    end if;
  end if;
  select id into st from public.project_statuses where workspace_id=i.workspace_id and stage='in_production' order by sort, id limit 1;
  if st is null then raise exception 'Add an In Production status before approving ideas'; end if;
  select * into ct from public.content_types where workspace_id=i.workspace_id
    and key=case when i.format in ('short','reel','podcast_clip') then 'shortform' when i.format='livestream' then 'youtube_live' else 'youtube_video' end limit 1;
  select string_agg(url, E'\n' order by url) into research_links
    from (
      select distinct source->>'url' as url
        from jsonb_array_elements(
          case when jsonb_typeof(i.research->'sources')='array' then i.research->'sources' else '[]'::jsonb end
          || case when jsonb_typeof(i.findings)='array' then i.findings else '[]'::jsonb end
        ) as source
        where source->>'url' ~* '^https?://' and length(source->>'url') <= 2000
          and not exists (select 1 from unnest(i.refs) ref where ref=source->>'url')
        order by url limit 10
    ) as links;
  package := jsonb_build_object('body',i.body,'hook',i.hook,'audience',i.audience,'promise',i.promise,'ideaId',i.id,'brand',b.name,'titleOptions',i.title_options,
    'thumbnailBrief',i.thumbnail_brief,'coverPath',i.cover_path,'references',i.refs,
    'script',i.script,'research',i.research,'findings',i.findings,'approvedAt',now());
  brief_text := concat_ws(E'\n\n', 'Approved idea: '||i.title, 'Brand: '||b.name,
    case when i.hook is not null then 'Hook: '||i.hook end,
    case when cardinality(i.title_options)>0 then 'Title options:'||E'\n'||array_to_string(i.title_options,E'\n') end,
    case when i.thumbnail_brief<>'' then 'Thumbnail direction:'||E'\n'||i.thumbnail_brief end,
    case when i.audience is not null then 'Audience: '||i.audience end,
    case when i.promise is not null then 'Viewer takeaway: '||i.promise end,
    array_to_string(i.body,E'\n\n'),
    case when cardinality(i.refs)>0 then 'References:'||E'\n'||array_to_string(i.refs,E'\n') end);
  -- The original brief and its limits still apply. The snapshot retains the full research.
  if length(brief_text) < 100000 and (nullif(btrim(i.research->>'summary'),'') is not null or research_links is not null) then
    brief_text := left(concat_ws(E'\n\n',brief_text,
      case when nullif(btrim(i.research->>'summary'),'') is not null then 'Research summary:'||E'\n'||left(i.research->>'summary',2000) end,
      case when research_links is not null then 'Research sources:'||E'\n'||research_links end
    ), 100000);
  end if;
  if preview or expected_review is not null then
    select jsonb_build_object('title',i.title,'client',a.name,'channel',c.name,'sponsor',
      (select name from public.accounts where id=sponsor_account), 'status',s.label, 'contentType',ct.label,
      'channelId',b.channel_id,'clientId',a.id,'sponsorId',sponsor_account,'statusId',st,'contentTypeId',ct.id)
      into destination from public.project_statuses s
      left join public.channels c on c.id=b.channel_id and c.workspace_id=i.workspace_id
      left join public.accounts a on a.id=c.owner_account_id and a.workspace_id=i.workspace_id
      where s.id=st;
    review_key := md5(jsonb_build_array(destination, package - 'approvedAt', brief_text)::text);
    if preview then
      return jsonb_build_object('destination',destination,'package',package - 'approvedAt','brief',brief_text,'reviewKey',review_key);
    end if;
    if expected_review is distinct from review_key then
      raise exception 'The idea or destination changed. Preview the editor package again before confirming.';
    end if;
  end if;
  -- The job number is named after the channel the video is for, else the sponsor, else the brand.
  job_owner := coalesce((select name from public.channels where id=b.channel_id),
    (select name from public.accounts where id=sponsor_account), b.name);
  insert into public.projects(workspace_id,job_code,title,channel_id,content_type_id,status_id,created_by,brief,idea_package)
    values(i.workspace_id,app.next_job_code(i.workspace_id,job_owner,ct.key,ct.label),i.title,b.channel_id,ct.id,st,auth.uid(),brief_text,package)
    returning * into p;
  if sponsor_account is not null then
    insert into public.sponsorships(project_id,account_id) values(p.id,sponsor_account);
  end if;
  update public.ideas set stage='approved',project_id=p.id,board_column_id=null,parked_at=null,
    approved_at=coalesce(approved_at,now()),approved_by=coalesce(approved_by,auth.uid()),
    converted=converted||jsonb_build_array(jsonb_build_object('kind','project','id',p.id,'label',p.title,'created_at',now()))
    where id=i.id;
  -- Complete the stage transition first so the Ready gate and Approved automations still run.
  -- Both writes commit with the project, sponsorship and production snapshot.
  update public.ideas set archived_at=now() where id=i.id;
  perform public.log_activity(p_category => 'idea', p_action => 'approved and created the project', p_target_label => i.title, p_idea => i.id);
  return jsonb_build_object('id',p.id,'job',p.job_code,'workspaceId',p.workspace_id,'package',package,
    'created',true,'canOpen',app.has_project_access(p.id));
end $$;
revoke all on function app.idea_project_handoff(uuid,boolean,text) from public,anon,authenticated;

create or replace function public.approve_idea_project(p_idea uuid) returns jsonb
language sql security definer set search_path='' as $$ select app.idea_project_handoff(p_idea,false,null) $$;
create function public.preview_idea_project(p_idea uuid) returns jsonb
language sql stable security definer set search_path='' as $$ select app.idea_project_handoff(p_idea,true,null) $$;
create function public.confirm_idea_project(p_idea uuid,p_review text) returns jsonb
language sql security definer set search_path='' as $$ select app.idea_project_handoff(p_idea,false,coalesce(p_review,'')) $$;
revoke all on function public.preview_idea_project(uuid), public.confirm_idea_project(uuid,text) from public,anon;
grant execute on function public.preview_idea_project(uuid), public.confirm_idea_project(uuid,text) to authenticated;

-- Use the same classification for listing and locked revalidation.
create function app.archive_handoff_group(i public.ideas, p public.projects) returns text
language sql immutable set search_path='' as $$
  select case when p.id is null then 'missing'
              when (p.idea_package->>'ideaId') is distinct from i.id::text then 'review'
              else 'eligible' end
$$;
revoke all on function app.archive_handoff_group(public.ideas,public.projects) from public,anon,authenticated;

create function public.review_historical_handoffs(p_workspace uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform app.require_verified_session();
  if not app.is_admin(p_workspace) then raise exception 'Super Admin access required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'approvedAt',i.approved_at,
    'brand',b.name,'projectId',p.id,'projectTitle',p.title,'job',p.job_code,'group',app.archive_handoff_group(i,p),
    'snapshotSource',p.idea_package->>'ideaId') order by i.title,i.id),'[]'::jsonb)
    from public.ideas i left join public.projects p on p.id=i.project_id and p.workspace_id=p_workspace
    left join public.brand_kits b on b.id=i.brand_id and b.workspace_id=p_workspace
    where i.workspace_id=p_workspace and i.stage='approved' and i.archived_at is null);
end $$;

create function public.archive_historical_handoffs(p_workspace uuid, p_selected jsonb) returns int
language plpgsql security definer set search_path='' as $$
declare item record; i public.ideas; p public.projects; total int := 0;
begin
  perform app.require_verified_session();
  if not app.is_admin(p_workspace) then raise exception 'Super Admin access required' using errcode='42501'; end if;
  if jsonb_typeof(p_selected) is distinct from 'object' or p_selected='{}'::jsonb then
    raise exception 'Select eligible handoffs to archive';
  end if;
  for item in select * from jsonb_each_text(p_selected) order by key loop
    select * into i from public.ideas where id=item.key::uuid and workspace_id=p_workspace for update;
    if not found or i.stage <> 'approved' or i.project_id is distinct from item.value::uuid then
      raise exception 'A selected handoff changed. Refresh the review before confirming.';
    end if;
    select * into p from public.projects where id=i.project_id and workspace_id=p_workspace for share;
    if app.archive_handoff_group(i,p) <> 'eligible' then
      raise exception 'A selected handoff is ineligible. Refresh the review before confirming.';
    end if;
    if i.archived_at is not null then continue; end if;
    update public.ideas set archived_at=now() where id=i.id;
    perform public.log_activity(p_category=>'idea',p_action=>'archived a reviewed historical handoff',
      p_target_label=>i.title, p_idea=>i.id, p_project=>p.id);
    total := total + 1;
  end loop;
  return total;
end $$;
revoke all on function public.review_historical_handoffs(uuid),public.archive_historical_handoffs(uuid,jsonb) from public,anon;
grant execute on function public.review_historical_handoffs(uuid),public.archive_historical_handoffs(uuid,jsonb) to authenticated;
