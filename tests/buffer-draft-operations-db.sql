\set ON_ERROR_STOP on
begin;
do $$
declare
  ws uuid:='20000000-0000-0000-0000-000000000001'; admin_id uuid:='10000000-0000-0000-0000-000000000001';
  p uuid:='30000000-0000-0000-0000-000000000001'; ch uuid:=gen_random_uuid(); brand uuid:=gen_random_uuid();
  remote text:='qa-media'; a1 uuid:=gen_random_uuid(); a2 uuid:=gen_random_uuid(); a3 uuid:=gen_random_uuid(); publication uuid;
  readrow record; job jsonb; result jsonb; denied boolean:=false;
begin
  insert into public.channels(id,workspace_id,name) values(ch,ws,'QA media');
  insert into public.brand_kits(id,workspace_id,name,kind,channel_id) values(brand,ws,'QA media','channel',ch);
  insert into public.buffer_channels(workspace_id,channel_id,organization_id,name,service,draft_brand_id) values(ws,remote,'org','Channel A','youtube',brand);
  update public.projects set channel_id=ch,status_id=(select id from public.project_statuses where workspace_id=ws and label='Scheduled') where id=p;
  insert into public.project_edits(project_id,edit_status) values(p,'approved') on conflict(project_id) do update set edit_status='approved';
  insert into public.project_assets(id,project_id,name,kind,storage_path,version,mime_type)
    select id,p,'Final '||v,'final',ws||'/'||p||'/final/V'||v||'.mp4',v,'video/mp4'
    from (values(a1,1),(a2,2),(a3,3)) f(id,v);
  insert into public.project_publish(project_id,draft_brand_id,draft_asset_id) values(p,brand,a1)
    on conflict(project_id) do update set draft_brand_id=brand,draft_asset_id=a1;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  select * into strict readrow from public.buffer_draft_readiness(ws) where project_id=p;
  if readrow.asset_id<>a1 or readrow.brand_id<>brand or readrow.edit_approved is not true then raise exception 'Incorrect readiness'; end if;
  publication:=(public.prepare_buffer_draft(ws,p,remote)->>'claim')::uuid;
  if publication is null then raise exception 'Claim failed'; end if;
  update public.buffer_publications set status='draft_created',buffer_post_id='existing-qa',media_path='old-copy'
    where id=publication;
  if (select draft_submission->>'id' from public.buffer_publications where id=publication) is distinct from a1::text then raise exception 'Lost original asset'; end if;
  update public.project_publish set draft_asset_id=a2 where project_id=p;
  perform public.review_buffer_draft_version(publication,a2,'keep',0);
  perform public.review_buffer_draft_version(publication,a2,'keep',0);
  job:=public.review_buffer_draft_version(publication,a2,'replace',1);
  if job->>'expectedPath' is distinct from 'old-copy' then raise exception 'Original media not carried into replacement'; end if;
  begin perform public.review_buffer_draft_version(publication,a2,'replace',1); exception when others then denied:=true; end;
  if not denied then raise exception 'Concurrent replace accepted'; end if;
  perform public.finish_buffer_media_edit(publication,(job->>'token')::uuid,'done',null);
  if (select jsonb_array_length(draft_version_reviews)<>2 or draft_version_reviews->-1->>'decision'<>'replaced' or buffer_post_id<>'existing-qa' or status<>'draft_created'
      or draft_submission->>'id'<>a1::text from public.buffer_publications where id=publication) then raise exception 'Original identity or version history lost'; end if;
  if public.review_buffer_draft_version(publication,a2,'replace',1)->>'done' is distinct from 'true' then raise exception 'Successful replacement retry lost'; end if;
  update public.project_publish set draft_asset_id=a3 where project_id=p;
  job:=public.review_buffer_draft_version(publication,a3,'replace',2);
  perform public.finish_buffer_media_edit(publication,(job->>'token')::uuid,'review','Lost response');
  denied:=false;
  begin perform public.review_buffer_draft_version(publication,a3,'replace',2); exception when others then denied:=true; end;
  if not denied then raise exception 'Ambiguous provider result replayed'; end if;
  perform public.review_buffer_draft_version(publication,a3,'updated_in_buffer',2);
  update public.project_edits set editor_id='10000000-0000-0000-0000-000000000002' where project_id=p;
  update public.role_board_config set scope='assigned' where workspace_id=ws and role='editor';
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
  if not exists(select 1 from public.buffer_draft_readiness(ws) where project_id=p) then raise exception 'Assigned editor cannot see their project'; end if;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  update public.project_edits set editor_id='10000000-0000-0000-0000-000000000004' where project_id=p;
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
  if exists(select 1 from public.buffer_draft_readiness(ws) where project_id=p) then raise exception 'Unassigned editor can see handoff'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if exists(select 1 from public.buffer_draft_readiness(ws)) then raise exception 'Other user can see readiness'; end if;
  denied:=false;
  begin perform public.review_buffer_draft_version(publication,a3,'keep',3); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Unauthorized draft version decision'; end if;
  if has_function_privilege('authenticated','public.finish_buffer_media_edit(uuid,uuid,text,text)','execute') then raise exception 'Member can forge worker outcome'; end if;
  insert into public.buffer_posts(workspace_id,channel_id,organization_id,post_id,sent_at) values(ws,remote,'org','existing-qa',now());
  if not exists(select 1 from public.sent_buffer_edit_media(ws) where id=publication and cardinality(paths)=2) then raise exception 'Edited media vanished before sent cleanup'; end if;
end $$;
rollback;
