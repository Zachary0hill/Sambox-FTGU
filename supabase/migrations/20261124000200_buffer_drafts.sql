-- Buffer draft destinations are explicitly assigned to one brand kit. A project's private, approved
-- Final video and brand are independent of the choices used by the existing Publish to Buffer action.
alter table public.buffer_channels add column draft_brand_id uuid references public.brand_kits(id) on delete set null;
grant update (draft_brand_id) on public.buffer_channels to authenticated;
create policy buffer_draft_mapping_admin on public.buffer_channels for update to authenticated
  using (app.is_admin(workspace_id))
  with check (app.is_admin(workspace_id) and (draft_brand_id is null or exists (
    select 1 from public.brand_kits b where b.id = draft_brand_id and b.workspace_id = buffer_channels.workspace_id
  )));
alter table public.project_publish
  add column draft_brand_id uuid references public.brand_kits(id) on delete set null,
  add column draft_asset_id uuid references public.project_assets(id) on delete set null;

alter table public.buffer_publications drop constraint buffer_publications_status_check,
  add constraint buffer_publications_status_check check (status in
    ('created','failed','cleared','draft_pending','draft_failed','draft_review','draft_created'));
create unique index buffer_draft_once on public.buffer_publications(project_id,channel_id)
  where status in ('draft_pending','draft_failed','draft_review','draft_created');
-- Clearing an ordinary publication must never release a draft reservation.
alter policy bpub_update on public.buffer_publications using (app.is_admin(workspace_id) and status='created');

create function app.queue_publishing_scheduled() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.archived_at is null and (tg_op='INSERT' or old.status_id is distinct from new.status_id)
    and exists(select 1 from public.project_statuses where id=new.status_id and workspace_id=new.workspace_id
      and stage='publishing' and lower(label)='scheduled') then
    perform app.queue_automation(new.workspace_id,'publishing_scheduled',null,new.id,jsonb_build_object('to','Scheduled'));
  end if;
  return new;
end $$;
revoke all on function app.queue_publishing_scheduled() from public, anon, authenticated;
create trigger queue_publishing_scheduled after insert or update of status_id on public.projects
  for each row execute function app.queue_publishing_scheduled();

-- A read with no channel previews the routing. Before each provider request the worker repeats
-- the checks and reserves precisely one channel. Only a *definite* previous failure can be retried.
create function public.prepare_buffer_draft(p_workspace uuid,p_project uuid,p_channel text default null,p_run uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  p public.projects; pub public.project_publish; b public.brand_kits; f public.project_assets;
  c public.buffer_channels; claim public.buffer_publications; destinations jsonb;
begin
  select * into p from public.projects where id=p_project and workspace_id=p_workspace for share;
  if not found or p.archived_at is not null then return jsonb_build_object('error','Open an active project to create a Buffer draft.'); end if;
  if p_channel is not null and not exists(select 1 from public.project_statuses s
    where s.id=p.status_id and s.workspace_id=p_workspace and s.stage='publishing' and lower(s.label)='scheduled') then
    return jsonb_build_object('error','Move the project to Scheduled in Publishing before creating a Buffer draft.');
  end if;
  select * into pub from public.project_publish where project_id=p.id for share;
  select * into b from public.brand_kits where id=pub.draft_brand_id and workspace_id=p_workspace for share;
  if not found or not coalesce((
    (b.kind='channel' and b.channel_id=p.channel_id and exists(select 1 from public.channels ch
      where ch.id=p.channel_id and ch.workspace_id=p_workspace and ch.owner_account_id is not distinct from b.account_id))
    or (b.kind='sponsor' and exists(select 1 from public.sponsorships sp join public.accounts a on a.id=sp.account_id
      where sp.project_id=p.id and a.id=b.account_id and a.type='sponsor' and a.workspace_id=p_workspace))
  ),false) then
    return jsonb_build_object('error','Select a Buffer draft brand linked to this project’s client channel or sponsor in Social post.');
  end if;
  if not exists(select 1 from public.project_edits where project_id=p.id and edit_status='approved') then
    return jsonb_build_object('error','Approve the edit before handing it to Buffer.');
  end if;
  select * into f from public.project_assets where id=pub.draft_asset_id and project_id=p.id and kind='final'
    and comment_id is null and storage_path like p_workspace::text||'/'||p.id::text||'/%'
    and storage_path !~ '(^|/)[.]{1,2}(/|$)' and (mime_type like 'video/%' or storage_path ~* '[.](mp4|mov|m4v|webm)$') for share;
  if not found then return jsonb_build_object('error','Choose the approved Final video under Social post → Buffer drafts.'); end if;
  if p_channel is null then
    select jsonb_agg(jsonb_build_object('id',channel_id,'label',coalesce(nullif(display_name,''),name)||' ('||service||')') order by channel_id)
      into destinations from public.buffer_channels where workspace_id=p_workspace and draft_brand_id=b.id;
    if destinations is null then return jsonb_build_object('error','Map a Buffer channel to '||b.name||' under Social post → Buffer drafts.'); end if;
    return jsonb_build_object('channels',destinations,'file',f.name,'brand',b.name);
  end if;
  select * into c from public.buffer_channels where workspace_id=p_workspace and channel_id=p_channel and draft_brand_id=b.id for share;
  if not found then return jsonb_build_object('error','The brand mapping changed. Review the Buffer channels before retrying.'); end if;
  select * into claim from public.buffer_publications where project_id=p_project and channel_id=p_channel and status like 'draft_%';
  if found and claim.status <> 'draft_failed' then return jsonb_build_object('status',claim.status,'postId',claim.buffer_post_id); end if;
  if c.is_locked or c.is_disconnected then return jsonb_build_object('error','Reconnect or unlock this channel in Buffer and sync it before retrying.'); end if;
  insert into public.buffer_publications(workspace_id,project_id,channel_id,service,status,run_id)
    values(p_workspace,p_project,p_channel,c.service,'draft_pending',p_run)
    on conflict(project_id,channel_id) where status in ('draft_pending','draft_failed','draft_review','draft_created')
    do update set status='draft_pending',run_id=excluded.run_id,error=null,media_removed_at=null,created_at=now()
      where buffer_publications.status='draft_failed'
    returning * into claim;
  if not found then
    select * into claim from public.buffer_publications where project_id=p_project and channel_id=p_channel and status like 'draft_%';
    return jsonb_build_object('status',claim.status,'postId',claim.buffer_post_id);
  end if;
  return jsonb_build_object('claim',claim.id,'sourcePath',f.storage_path,'name',f.name,'service',c.service,'text',pub.caption,'title',coalesce(nullif(pub.youtube_title,''),p.title));
end $$;
revoke all on function public.prepare_buffer_draft(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.prepare_buffer_draft(uuid,uuid,text,uuid) to service_role;

create function public.sent_buffer_draft_media(p_workspace uuid) returns table(id uuid,media_path text)
language sql stable security definer set search_path='' as $$
  select b.id,b.media_path from public.buffer_publications b
  join public.buffer_posts p on p.workspace_id=b.workspace_id and p.post_id=b.buffer_post_id and p.sent_at is not null
  where b.workspace_id=p_workspace and b.status in ('draft_created','draft_review') and b.media_path is not null and b.media_removed_at is null
  limit 500
$$;
revoke all on function public.sent_buffer_draft_media(uuid) from public,anon,authenticated;
grant execute on function public.sent_buffer_draft_media(uuid) to service_role;
