\set ON_ERROR_STOP on
begin;
do $$
declare
  ws uuid := '20000000-0000-0000-0000-000000000001'; p uuid:=gen_random_uuid();
  client_a uuid:=gen_random_uuid(); client_b uuid:=gen_random_uuid(); ch uuid:=gen_random_uuid();
  kit_a uuid:=gen_random_uuid(); kit_b uuid:=gen_random_uuid(); final_video uuid:=gen_random_uuid();
  scheduled uuid; editing uuid; workflow uuid:=gen_random_uuid(); result jsonb; claim_id uuid;
begin
  select id into strict scheduled from public.project_statuses where workspace_id=ws and label='Scheduled';
  select id into strict editing from public.project_statuses where workspace_id=ws and label='Editing';
  insert into public.accounts(id,workspace_id,name,type) values(client_a,ws,'Draft client A','client'),(client_b,ws,'Draft client B','client');
  insert into public.channels(id,workspace_id,name,owner_account_id) values(ch,ws,'Draft client channel',client_a);
  insert into public.brand_kits(id,workspace_id,name,kind,channel_id,account_id)
    values(kit_a,ws,'Draft brand A','channel',ch,client_a),(kit_b,ws,'Draft brand B','channel',ch,client_b);
  insert into public.automations(id,workspace_id,name,enabled,is_draft,trigger,actions)
    values(workflow,ws,'Buffer draft QA',true,false,'{"key":"publishing_scheduled"}','[{"key":"buffer_draft"}]');
  insert into public.projects(id,workspace_id,title,job_code,status_id,channel_id) values(p,ws,'Buffer QA','BUF-QA',editing,ch);
  insert into public.project_edits(project_id,edit_status) values(p,'approved') on conflict(project_id) do update set edit_status='approved';
  insert into public.project_assets(id,project_id,name,kind,storage_path,mime_type)
    values(final_video,p,'cut.mp4','draft',ws||'/'||p||'/final/cut.mp4','video/mp4');
  insert into public.project_publish(project_id,draft_brand_id,draft_asset_id) values(p,kit_a,final_video);
  insert into public.buffer_channels(workspace_id,channel_id,organization_id,name,service,draft_brand_id)
    values(ws,'remote-a','org','A','youtube',kit_a),(ws,'remote-b','org','B','youtube',kit_b);
  result:=public.prepare_buffer_draft(ws,p);
  if coalesce(result->>'error','') not like '%Final%' then raise exception 'Draft cut accepted'; end if;
  update public.project_edits set edit_status='in_review' where project_id=p;
  if coalesce(public.prepare_buffer_draft(ws,p)->>'error','') not like '%Approve the edit%' then raise exception 'Unapproved edit accepted'; end if;
  update public.project_edits set edit_status='approved' where project_id=p;
  update public.project_assets set kind='final' where id=final_video;
  result:=public.prepare_buffer_draft(ws,p);
  if result->'channels'->0->>'id' is distinct from 'remote-a' or jsonb_array_length(result->'channels')<>1 then raise exception 'Wrong brand in preview: %',result; end if;
  if not (public.prepare_buffer_draft(ws,p,'remote-a') ? 'error') then raise exception 'Unscheduled handoff'; end if;
  update public.projects set status_id=scheduled where id=p;
  if (select count(*) from public.automation_runs where automation_id=workflow)<>1 then raise exception 'Status change did not enqueue exactly once'; end if;
  if not (public.prepare_buffer_draft(ws,p,'remote-b') ? 'error') then raise exception 'Other destination accepted'; end if;
  update public.project_publish set draft_brand_id=kit_b where project_id=p;
  if not (public.prepare_buffer_draft(ws,p,'remote-b') ? 'error') then raise exception 'Wrong client sharing studio channel accepted'; end if;
  update public.project_publish set draft_brand_id=kit_a where project_id=p;
  claim_id:=(public.prepare_buffer_draft(ws,p,'remote-a')->>'claim')::uuid;
  if claim_id is null or public.prepare_buffer_draft(ws,p,'remote-a')->>'status' is distinct from 'draft_pending' then raise exception 'Concurrent handoff not held'; end if;
  update public.buffer_publications set status='draft_failed' where id=claim_id;
  if (public.prepare_buffer_draft(ws,p,'remote-a')->>'claim')::uuid is distinct from claim_id then raise exception 'Definite rejection not recoverable'; end if;
  update public.buffer_publications set status='draft_created', buffer_post_id='post-a', media_path='copy.mp4' where id=claim_id;
  update public.projects set status_id=editing where id=p;
  update public.projects set status_id=scheduled where id=p;
  if public.prepare_buffer_draft(ws,p,'remote-a')->>'postId' is distinct from 'post-a' then raise exception 'Status toggles duplicate draft'; end if;
  if exists(select 1 from public.sent_buffer_draft_media(ws) where id=claim_id) then raise exception 'Unscheduled draft lost media'; end if;
  insert into public.buffer_posts(workspace_id,channel_id,organization_id,post_id,sent_at) values(ws,'remote-a','org','post-a',now());
  if not exists(select 1 from public.sent_buffer_draft_media(ws) where id=claim_id) then raise exception 'Published draft media never released'; end if;
  if has_function_privilege('authenticated','public.prepare_buffer_draft(uuid,uuid,text,uuid)','execute') then raise exception 'Member can reserve draft'; end if;
end $$;
rollback;
