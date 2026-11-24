-- Preserve the job-number allocator, session checks, row lock and idempotent project lookup.
create or replace function public.approve_idea_project(p_idea uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.ideas; b public.brand_kits; p public.projects; st uuid; ct public.content_types;
  role public.user_role; sponsor_account uuid; brief_text text; package jsonb; research_links text; job_owner text;
begin
  perform app.require_verified_session();
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
