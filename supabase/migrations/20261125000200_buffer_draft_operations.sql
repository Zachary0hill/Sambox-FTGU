-- Snapshots survive file deletion. Existing handoffs have unknown submitted versions.
alter table public.buffer_publications
  add column draft_submission jsonb,
  add column draft_update_hold jsonb,
  add column draft_update_media_paths text[] not null default array[]::text[],
  add column draft_version_reviews jsonb not null default '[]'::jsonb;

-- Worker and board read the same eligibility projection. Keep the private source path server-side.
create view app.buffer_draft_inputs as
select p.id as project_id, p.workspace_id, p.archived_at, st.stage='publishing' and lower(st.label)='scheduled' as scheduled,
  b.id as brand_id, b.name as brand_name, e.edit_status='approved' as edit_approved,
  f.id as asset_id, f.version as asset_version, f.created_at as asset_created_at, f.name as asset_name, f.storage_path,
  coalesce(pub.caption,'') as caption, coalesce(nullif(pub.youtube_title,''),p.title) as title
from public.projects p
left join public.project_statuses st on st.id=p.status_id and st.workspace_id=p.workspace_id
left join public.project_publish pub on pub.project_id=p.id
left join public.project_edits e on e.project_id=p.id
left join public.channels ch on ch.id=p.channel_id and ch.workspace_id=p.workspace_id
left join public.brand_kits b on b.id=pub.draft_brand_id and b.workspace_id=p.workspace_id and (
  (b.kind='channel' and b.channel_id=ch.id and ch.owner_account_id is not distinct from b.account_id)
  or (b.kind='sponsor' and exists(select 1 from public.sponsorships sp join public.accounts a on a.id=sp.account_id
    where sp.project_id=p.id and a.id=b.account_id and a.type='sponsor' and a.workspace_id=p.workspace_id)))
left join public.project_assets f on f.id=pub.draft_asset_id and f.project_id=p.id and f.kind='final' and f.comment_id is null
  and f.storage_path like p.workspace_id::text||'/'||p.id::text||'/%' and f.storage_path !~ '(^|/)[.]{1,2}(/|$)'
  and (f.mime_type like 'video/%' or f.storage_path ~* '[.](mp4|mov|m4v|webm)$');
revoke all on app.buffer_draft_inputs from public, anon, authenticated;

create function public.buffer_draft_readiness(p_workspace uuid)
returns table(project_id uuid,brand_id uuid,edit_approved boolean,asset_id uuid,asset_version integer,asset_name text,
              asset_created_at timestamptz,connected boolean,workflow_live boolean)
language sql stable security definer set search_path='' as $$
  select i.project_id,i.brand_id,coalesce(i.edit_approved,false),i.asset_id,i.asset_version,i.asset_name,i.asset_created_at,
    exists(select 1 from public.integrations x where x.workspace_id=p_workspace and x.provider='buffer' and x.status='connected'),
    exists(select 1 from public.automations a where a.workspace_id=p_workspace and a.enabled and not a.is_draft
      and a.trigger->>'key'='publishing_scheduled' and a.actions @> '[{"key":"buffer_draft"}]')
      and not exists(select 1 from public.workspace_settings s where s.workspace_id=p_workspace and s.automation->>'paused'='true')
  from app.buffer_draft_inputs i where i.workspace_id=p_workspace and i.archived_at is null and app.mfa_satisfied()
    and app.is_internal(p_workspace) and app.has_project_access(i.project_id)
$$;
revoke all on function public.buffer_draft_readiness(uuid) from public,anon;
grant execute on function public.buffer_draft_readiness(uuid) to authenticated;

create or replace function public.prepare_buffer_draft(p_workspace uuid,p_project uuid,p_channel text default null,p_run uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  i app.buffer_draft_inputs; c public.buffer_channels; claim public.buffer_publications; destinations jsonb; snapshot jsonb;
begin
  perform 1 from public.projects where id=p_project and workspace_id=p_workspace for share;
  perform 1 from public.project_publish where project_id=p_project for share;
  select * into i from app.buffer_draft_inputs where project_id=p_project and workspace_id=p_workspace;
  if not found or i.archived_at is not null then return jsonb_build_object('error','Open an active project to create a Buffer draft.'); end if;
  if p_channel is not null and i.scheduled is not true then return jsonb_build_object('error','Move the project to Scheduled in Publishing before creating a Buffer draft.'); end if;
  if i.brand_id is null then return jsonb_build_object('error','Select a Buffer draft brand linked to this project’s client channel or sponsor in Social post.'); end if;
  if i.edit_approved is not true then return jsonb_build_object('error','Approve the edit before handing it to Buffer.'); end if;
  if i.asset_id is null then return jsonb_build_object('error','Choose the approved Final video under Social post → Buffer drafts.'); end if;
  if p_channel is null then
    select jsonb_agg(jsonb_build_object('id',channel_id,'label',coalesce(nullif(display_name,''),name)||' ('||service||')') order by channel_id)
      into destinations from public.buffer_channels where workspace_id=p_workspace and draft_brand_id=i.brand_id;
    if destinations is null then return jsonb_build_object('error','Map a Buffer channel to '||i.brand_name||' under Social post → Buffer drafts.'); end if;
    return jsonb_build_object('channels',destinations,'file',i.asset_name,'brand',i.brand_name);
  end if;
  select * into c from public.buffer_channels where workspace_id=p_workspace and channel_id=p_channel and draft_brand_id=i.brand_id for share;
  if not found then return jsonb_build_object('error','The brand mapping changed. Review the Buffer channels before retrying.'); end if;
  select * into claim from public.buffer_publications where project_id=p_project and channel_id=p_channel and status like 'draft_%';
  if found and claim.status <> 'draft_failed' then return jsonb_build_object('status',claim.status,'postId',claim.buffer_post_id); end if;
  if c.is_locked or c.is_disconnected then return jsonb_build_object('error','Reconnect or unlock this channel in Buffer and sync it before retrying.'); end if;
  snapshot:=jsonb_build_object('id',i.asset_id,'name',i.asset_name,'version',i.asset_version,'createdAt',i.asset_created_at,
    'brandId',i.brand_id,'brand',i.brand_name,'destination',coalesce(nullif(c.display_name,''),c.name));
  insert into public.buffer_publications(workspace_id,project_id,channel_id,service,status,run_id,draft_submission)
    values(p_workspace,p_project,p_channel,c.service,'draft_pending',p_run,snapshot)
    on conflict(project_id,channel_id) where status in ('draft_pending','draft_failed','draft_review','draft_created')
    do update set status='draft_pending',run_id=excluded.run_id,error=null,media_removed_at=null,created_at=now(),draft_submission=excluded.draft_submission
      where buffer_publications.status='draft_failed'
    returning * into claim;
  if not found then
    select * into claim from public.buffer_publications where project_id=p_project and channel_id=p_channel and status like 'draft_%';
    return jsonb_build_object('status',claim.status,'postId',claim.buffer_post_id);
  end if;
  return jsonb_build_object('claim',claim.id,'sourcePath',i.storage_path,'name',i.asset_name,'service',c.service,'text',i.caption,'title',i.title);
end $$;

create function public.review_buffer_draft_version(p_publication uuid,p_asset uuid,p_decision text,p_expected_reviews integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.buffer_publications; i app.buffer_draft_inputs; last_review jsonb; effective jsonb; review jsonb; token uuid; path text;
begin
  select * into b from public.buffer_publications where id=p_publication for update;
  if not found or not app.mfa_satisfied() or not app.is_internal(b.workspace_id) or not app.has_project_access(b.project_id)
    or not (app.is_admin(b.workspace_id) or app.has_perm(b.workspace_id,'projects','edit')) then
    raise exception 'You cannot review this Buffer draft' using errcode='42501'; end if;
  if p_decision is null or p_decision not in ('keep','updated_in_buffer','replace') or b.status<>'draft_created' or b.buffer_post_id is null then
    raise exception 'Review requires a confirmed Buffer draft and a version decision'; end if;
  last_review:=b.draft_version_reviews->-1;
  if last_review->>'assetId'=p_asset::text and ((last_review->>'decision')=p_decision or (p_decision='replace' and last_review->>'decision'='replaced')) then
    return jsonb_build_object('done',true,'post',b.buffer_post_id); end if;
  if p_expected_reviews is distinct from jsonb_array_length(b.draft_version_reviews) then raise exception 'Another review was saved. Refresh the queue.'; end if;
  select * into i from app.buffer_draft_inputs where project_id=b.project_id and workspace_id=b.workspace_id;
  if i.archived_at is not null or i.edit_approved is not true or i.asset_id is null or i.asset_id is distinct from p_asset
    or i.brand_id is null or not exists(select 1 from public.buffer_channels c where c.workspace_id=b.workspace_id
      and c.channel_id=b.channel_id and c.draft_brand_id=i.brand_id)
    or exists(select 1 from public.buffer_posts p where p.workspace_id=b.workspace_id and p.post_id=b.buffer_post_id and p.sent_at is not null)
    then raise exception 'The approved Final, brand destination, or post status changed. Refresh the queue.'; end if;
  if b.draft_update_hold is not null and (p_decision='replace' or (b.draft_update_hold->>'state'='pending' and
      (b.draft_update_hold->>'at')::timestamptz > now()-interval '10 minutes')) then
    raise exception 'The previous update needs verification in Buffer before another media update'; end if;
  select v into effective from jsonb_array_elements(b.draft_version_reviews) with ordinality x(v,ord)
    where v->>'decision' in ('updated_in_buffer','replaced') order by ord desc limit 1;
  if effective is null then effective:=b.draft_submission; end if;
  if effective is not null and (p_asset::text=coalesce(effective->>'assetId',effective->>'id') or
      (i.asset_version,i.asset_created_at) <= ((effective->>'version')::integer,(effective->>'createdAt')::timestamptz)) then
    raise exception 'Select a newer approved Final before recording a decision'; end if;
  review:=jsonb_build_object('decision',p_decision,'assetId',i.asset_id,'name',i.asset_name,'version',i.asset_version,'createdAt',i.asset_created_at,
    'actor',auth.uid(),'at',now(),'postId',b.buffer_post_id);
  if p_decision='replace' then
    if effective is null or (effective->>'decision'='updated_in_buffer') then
      raise exception 'The submitted media cannot be verified. Update the existing draft in Buffer.'; end if;
    token:=gen_random_uuid();
    path:=b.workspace_id::text||'/'||b.project_id::text||'/'||token::text||'.'||coalesce(substring(i.storage_path from '[.]([[:alnum:]]{2,5})$'),'mp4');
    update public.buffer_publications set draft_update_hold=review||jsonb_build_object('token',token,'state','pending','mediaPath',path),
      draft_update_media_paths=array_append(draft_update_media_paths,path)
      where id=b.id;
    return jsonb_build_object('token',token,'workspace',b.workspace_id,'channel',b.channel_id,'post',b.buffer_post_id,
      'expectedPath',coalesce(effective->>'mediaPath',b.media_path),'sourcePath',i.storage_path,'mediaPath',path);
  end if;
  update public.buffer_publications set draft_version_reviews=draft_version_reviews||jsonb_build_array(review),
    draft_update_hold=null where id=b.id;
  return jsonb_build_object('done',true);
end $$;
revoke all on function public.review_buffer_draft_version(uuid,uuid,text,integer) from public,anon;
grant execute on function public.review_buffer_draft_version(uuid,uuid,text,integer) to authenticated;

-- Only the worker records the provider outcome. Unknown outcomes keep their reservation and media.
create function public.finish_buffer_media_edit(p_publication uuid,p_token uuid,p_state text,p_detail text)
returns void language plpgsql security definer set search_path='' as $$
declare b public.buffer_publications; h jsonb;
begin
  select * into b from public.buffer_publications where id=p_publication for update;
  h:=b.draft_update_hold;
  if h is null or h->>'token' is distinct from p_token::text or h->>'state'<>'pending' then raise exception 'Media reservation changed'; end if;
  if p_state='done' then
    update public.buffer_publications set draft_version_reviews=draft_version_reviews||jsonb_build_array(
      (h-'token'-'state')||jsonb_build_object('decision','replaced','at',now())),draft_update_hold=null where id=b.id;
  elsif p_state='review' then
    update public.buffer_publications set draft_update_hold=h||jsonb_build_object('state','review','error',left(p_detail,700)) where id=b.id;
  elsif p_state='failed' then
    update public.buffer_publications set draft_update_hold=null,draft_update_media_paths=array_remove(draft_update_media_paths,h->>'mediaPath') where id=b.id;
  else raise exception 'Unknown media update outcome'; end if;
end $$;
revoke all on function public.finish_buffer_media_edit(uuid,uuid,text,text) from public,authenticated,anon;
grant execute on function public.finish_buffer_media_edit(uuid,uuid,text,text) to service_role;

create function public.sent_buffer_edit_media(p_workspace uuid) returns table(id uuid,paths text[]) language sql stable security definer set search_path='' as $$
  select b.id,b.draft_update_media_paths from public.buffer_publications b join public.buffer_posts p
    on p.workspace_id=b.workspace_id and p.post_id=b.buffer_post_id and p.sent_at is not null
  where b.workspace_id=p_workspace and cardinality(b.draft_update_media_paths)>0 limit 200
$$;
revoke all on function public.sent_buffer_edit_media(uuid) from public,authenticated,anon;
grant execute on function public.sent_buffer_edit_media(uuid) to service_role;
