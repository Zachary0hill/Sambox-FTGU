-- Serialize budget admission per workspace; uncertain calls retain their full reservation.
create table public.research_spend (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), run_id uuid not null,
 provider text not null, model text not null, reserved_usd numeric not null check(reserved_usd>=0),
 charged_usd numeric check(charged_usd>=0), created_at timestamptz not null default now(), settled_at timestamptz
);
create index research_spend_day on public.research_spend(workspace_id,created_at);
alter table public.research_spend enable row level security;
revoke all on public.research_spend from public,anon,authenticated;
grant all on public.research_spend to service_role;
create function public.reserve_research_spend(p_ws uuid,p_run uuid,p_provider text,p_model text,p_usd numeric,p_run_cap numeric,p_day_cap numeric) returns uuid
language plpgsql security definer set search_path='' as $$
declare daily numeric; running numeric; result uuid;
begin
 if p_usd is null or p_usd<0 or p_usd>1000 or p_run_cap<=0 or p_day_cap<=0 then raise exception 'Invalid spend reservation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_ws::text,7341));
 select coalesce(sum(coalesce(charged_usd,reserved_usd)),0) into daily from public.research_spend where workspace_id=p_ws and (settled_at is null or created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
 select daily+coalesce(sum(u.cost_usd),0) into daily from public.ai_usage u where u.workspace_id=p_ws and u.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
 and not exists(select 1 from public.research_spend s where s.workspace_id=p_ws and s.run_id=u.run_id);
 select coalesce(sum(coalesce(charged_usd,reserved_usd)),0) into running from public.research_spend where workspace_id=p_ws and run_id=p_run;
 if daily+p_usd>p_day_cap then raise exception 'Daily estimated research budget reached. Review Rules and usage.'; end if;
 if running+p_usd>p_run_cap then raise exception 'Per-run estimated research budget reached. Review Rules and usage.'; end if;
 insert into public.research_spend(workspace_id,run_id,provider,model,reserved_usd) values(p_ws,p_run,p_provider,p_model,p_usd) returning id into result;
 return result;
end $$;
revoke all on function public.reserve_research_spend(uuid,uuid,text,text,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.reserve_research_spend(uuid,uuid,text,text,numeric,numeric,numeric) to service_role;

alter table public.research_runs add column attempt_id uuid, add column draft_payload jsonb;

-- Commit the exact drafted payload under the claimed attempt lock. A canceled/replaced worker cannot insert ideas.
create function public.commit_research_ideas(p_run uuid,p_attempt uuid,p_rows jsonb,p_note text default null) returns uuid[]
language plpgsql security definer set search_path='' as $$
declare r public.research_runs; ids uuid[]; row jsonb; label text;
begin
 select * into r from public.research_runs where id=p_run for update;
 if not found or r.attempt_id is distinct from p_attempt then raise exception 'Research attempt was replaced'; end if;
 if r.status='done' then return r.idea_ids; end if;
 if r.status<>'running' then raise exception 'Research is no longer running'; end if;
 if not exists(select 1 from public.workspace_members where workspace_id=r.workspace_id and user_id=r.created_by and role='super_admin' and status='active') then raise exception 'Research owner no longer has access'; end if;
 if not exists(select 1 from public.brand_kits where id=r.brand_id and workspace_id=r.workspace_id) then raise exception 'Research brand is unavailable'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>30 then raise exception 'Invalid idea drafts'; end if;
 select coalesce(nullif(full_name,''),email) into label from public.profiles where id=r.created_by;
 for row in select * from jsonb_array_elements(p_rows) loop
 insert into public.ideas(id,workspace_id,brand_id,type,stage,title,hook,body,tags,refs,findings,author_id,source,research_run_id,cover_highlight,hook_position)
 values((row->>'id')::uuid,r.workspace_id,r.brand_id,'research','inbox',row->>'title',row->>'hook',
 array(select jsonb_array_elements_text(row->'body')),array(select jsonb_array_elements_text(row->'tags')),array(select jsonb_array_elements_text(row->'refs')),
 coalesce(row->'findings','[]'),r.created_by,'research',r.id,row->>'cover_highlight',row->>'hook_position')
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
