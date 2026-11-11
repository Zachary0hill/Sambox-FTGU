-- DB mutation and cleanup intent commit together. No original file is removed before its record is deleted.
create table public.storage_cleanup (
 id uuid primary key default gen_random_uuid(), bucket text not null, path text not null,
 workspace_id uuid not null, created_at timestamptz not null default now(),
 attempts int not null default 0, error text, completed_at timestamptz,
 unique(bucket,path)
);
alter table public.storage_cleanup enable row level security;
revoke all on public.storage_cleanup from public,anon,authenticated;
grant all on public.storage_cleanup to service_role;
create function app.queue_asset_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
declare w uuid;
begin
 if old.storage_path !~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/' then return old; end if;
 w := coalesce(app.project_ws(old.project_id), nullif(split_part(old.storage_path,'/',1),'')::uuid);
 if old.storage_path not like w::text||'/'||old.project_id::text||'/%' then return old; end if;
 if old.storage_path is not null and w is not null then
 insert into public.storage_cleanup(bucket,path,workspace_id) values('project-assets',old.storage_path,w) on conflict(bucket,path) do update set completed_at=null,attempts=0,error=null;
 end if;
 return old;
end $$;
create trigger asset_cleanup before delete on public.project_assets for each row execute function app.queue_asset_cleanup();
create function app.queue_brand_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
declare asset jsonb;
begin
 for asset in select * from jsonb_array_elements(old.assets) loop
 if asset->>'path' like old.workspace_id::text||'/'||old.id::text||'/%' then
 insert into public.storage_cleanup(bucket,path,workspace_id) values('brand-assets',asset->>'path',old.workspace_id) on conflict(bucket,path) do update set completed_at=null,attempts=0,error=null;
 end if;
 end loop;
 return old;
end $$;
create trigger brand_cleanup before delete on public.brand_kits for each row execute function app.queue_brand_cleanup();
-- Removing a comment preserves its already uploaded files, as the Files UI promises.
alter table public.project_assets drop constraint if exists project_assets_comment_id_fkey;
alter table public.project_assets add constraint project_assets_comment_id_fkey foreign key(comment_id) references public.comments(id) on delete set null;

-- Invoker privileges preserve existing RLS/column guards. One transaction for text + attachments; stable ID for retry.
create function public.finalize_project_comment(p_id uuid,p_project uuid,p_body text,p_internal boolean,p_files jsonb default '[]')
returns uuid language plpgsql security invoker set search_path='' as $$
declare f jsonb; c public.comments; w uuid;
begin
 w := app.project_ws(p_project);
 if auth.uid() is null or not app.has_project_access(p_project) then raise exception 'Project unavailable' using errcode='42501'; end if;
 select * into c from public.comments where id=p_id;
 if found then
   if c.author_id<>auth.uid() or c.project_id<>p_project or c.body<>p_body or c.internal<>p_internal then raise exception 'Comment retry does not match'; end if;
   return p_id;
 end if;
 if jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files)>20 then raise exception 'Invalid attachments'; end if;
 insert into public.comments(id,project_id,author_id,body,internal) values(p_id,p_project,auth.uid(),p_body,p_internal);
 for f in select * from jsonb_array_elements(p_files) loop
   if f->>'path' not like w::text||'/'||p_project::text||'/comments/'||p_id::text||'/%' then raise exception 'Invalid attachment path'; end if;
   insert into public.project_assets(project_id,kind,name,storage_path,uploaded_by,comment_id,mime_type,size_bytes,external_visible)
   values(p_project,'other',f->>'name',f->>'path',auth.uid(),p_id,f->>'mime',(f->>'size')::bigint,not p_internal);
 end loop;
 perform public.log_activity(p_category=>'project',p_action=>'commented on',p_target_label=>(select title from public.projects where id=p_project),p_project=>p_project,p_event=>'comment',p_quote=>p_body,p_external=>not p_internal);
 return p_id;
end $$;
revoke all on function public.finalize_project_comment(uuid,uuid,text,boolean,jsonb) from public,anon;
grant execute on function public.finalize_project_comment(uuid,uuid,text,boolean,jsonb) to authenticated;

create function public.save_brand_details(p_id uuid,p_patch jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare b public.brand_kits; n public.brand_kits;
begin
 select * into b from public.brand_kits where id=p_id for update;
 if not found then raise exception 'Brand unavailable'; end if;
 n := jsonb_populate_record(b,p_patch);
 update public.brand_kits set name=n.name,color=n.color,colors=n.colors,fonts=n.fonts,tone=n.tone,dos=n.dos,donts=n.donts,sections=n.sections,socials=n.socials,voice_prompt=n.voice_prompt,account_id=n.account_id where id=p_id;
 if not found then raise exception 'Brand update denied' using errcode='42501'; end if;
 if b.channel_id is not null and b.name<>n.name then
 update public.channels set name=n.name where id=b.channel_id;
 if not found then raise exception 'Channel rename denied' using errcode='42501'; end if;
 end if;
end $$;
revoke all on function public.save_brand_details(uuid,jsonb) from public,anon;
grant execute on function public.save_brand_details(uuid,jsonb) to authenticated;
create function public.delete_project_records(p_ids uuid[]) returns int language plpgsql security invoker set search_path='' as $$
declare n int;
begin
 if cardinality(p_ids)=0 or cardinality(p_ids)>500 then raise exception 'Choose 1–500 projects'; end if;
 delete from public.projects where id=any(p_ids);
 get diagnostics n=row_count;
 if n<>(select count(distinct x) from unnest(p_ids) x) then raise exception 'Some projects are unavailable or deletion is not allowed' using errcode='42501'; end if;
 return n;
end $$;
revoke all on function public.delete_project_records(uuid[]) from public,anon;
grant execute on function public.delete_project_records(uuid[]) to authenticated;
