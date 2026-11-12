-- Preserve normal idea defaults for partial recovered draft payloads.
create or replace function public.commit_research_ideas(p_run uuid,p_attempt uuid,p_rows jsonb,p_note text default null) returns uuid[]
language plpgsql security definer set search_path='' as $$
declare r public.research_runs; ids uuid[]; row jsonb; label text;
begin
 select * into r from public.research_runs where id=p_run for update;
 if not found or r.attempt_id is distinct from p_attempt then raise exception 'Research attempt was replaced'; end if;
 if r.status='done' then return r.idea_ids; end if;
 if r.status<>'running' then raise exception 'Research is no longer running'; end if;
 if not exists(select 1 from public.workspace_members where workspace_id=r.workspace_id and user_id=r.created_by and role='super_admin' and status='active') then raise exception 'Research owner no longer has access'; end if;
 if not exists(select 1 from public.brand_kits where id=r.brand_id and workspace_id=r.workspace_id) then raise exception 'Research brand is unavailable'; end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>30 then raise exception 'Invalid idea drafts'; end if;
 select coalesce(nullif(full_name,''),email) into label from public.profiles where id=r.created_by;
 for row in select * from jsonb_array_elements(p_rows) loop
 insert into public.ideas(id,workspace_id,brand_id,type,stage,title,hook,body,tags,refs,findings,author_id,source,research_run_id,cover_highlight,hook_position)
 values((row->>'id')::uuid,r.workspace_id,r.brand_id,'research','inbox',row->>'title',row->>'hook',
 array(select jsonb_array_elements_text(row->'body')),array(select jsonb_array_elements_text(row->'tags')),array(select jsonb_array_elements_text(row->'refs')),
 coalesce(row->'findings','[]'),r.created_by,'research',r.id,coalesce(row->>'cover_highlight','#FFE14D'),coalesce(row->>'hook_position','bottom'))
 on conflict(id) do nothing;
 if found then
 insert into public.activity_log(workspace_id,actor_id,actor_label,category,action,target_type,target_id,target_label,idea_id,source)
 values(r.workspace_id,r.created_by,coalesce(label,''),'idea','added the idea from research','idea',(row->>'id')::uuid,row->>'title',(row->>'id')::uuid,'api');
 end if;
 ids:=array_append(ids,(row->>'id')::uuid);
 end loop;
 update public.research_runs set status='done',idea_ids=ids,draft_payload=p_rows,note=p_note,finished_at=now(),error=null where id=p_run;
 return ids;
end $$;
revoke all on function public.commit_research_ideas(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_research_ideas(uuid,uuid,jsonb,text) to service_role;
