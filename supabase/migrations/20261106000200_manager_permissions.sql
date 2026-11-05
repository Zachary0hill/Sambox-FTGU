-- Manager is an internal operator; app.is_admin deliberately stays unchanged.
create or replace function app.can_manage(ws uuid, res public.perm_resource, act public.perm_action)
returns boolean language sql stable security definer set search_path='' as $$
 select app.is_admin(ws) or (app.member_role(ws)='manager' and app.has_perm(ws,res,act))
$$;


create or replace function app.has_perm(ws uuid, res public.perm_resource, act public.perm_action)
returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when app.member_role(ws) is null then false
    when app.member_role(ws) = 'super_admin' then true
    when app.member_role(ws) = 'manager' and res in ('users','settings','automations','finance') then false
    else exists (
      select 1 from public.role_permissions rp
      where rp.workspace_id = ws and rp.role = app.member_role(ws)
        and rp.resource = res and rp.action = act and rp.allowed)
  end
$$;

create or replace function app.is_internal(ws uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.member_role(ws) in ('super_admin','manager','editor','designer'), false)
$$;

create or replace function app.has_project_access(p uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.projects pr
    join public.workspace_members m
      on m.workspace_id = pr.workspace_id and m.user_id = (select auth.uid()) and m.status = 'active'
    left join public.role_board_config rc on rc.workspace_id = pr.workspace_id and rc.role = m.role
    where pr.id = p and (
      m.role = 'super_admin' or (m.role='manager' and app.has_perm(pr.workspace_id,'projects','view'))
      or (m.role = 'editor' and (rc.scope = 'all' or exists (
            select 1 from public.project_edits e where e.project_id = pr.id and e.editor_id = m.user_id)))
      or (m.role = 'designer' and (rc.scope = 'all' or exists (
            select 1 from public.project_thumbnails t where t.project_id = pr.id and t.designer_id = m.user_id)))
      or (m.role in ('sponsor','client') and pr.archived_at is null and (
            exists (select 1 from public.channels c
                    where c.id = pr.channel_id and c.owner_account_id in (select app.my_account_ids()))
            or exists (select 1 from public.sponsorships s
                    where s.project_id = pr.id and s.account_id in (select app.my_account_ids()))))
    )
  )
$$;

create or replace function app.can_see_brand(b uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.brand_kits bk
    join public.workspace_members m
      on m.workspace_id = bk.workspace_id and m.user_id = (select auth.uid()) and m.status = 'active'
    where bk.id = b and (
      m.role = 'super_admin' or (m.role='manager' and app.has_perm(bk.workspace_id,'brands','view'))
      or (m.role in ('editor','designer') and exists (
            select 1 from public.projects pr
            where pr.workspace_id = bk.workspace_id and pr.archived_at is null
              and ((bk.channel_id is not null and pr.channel_id = bk.channel_id)
                or (bk.account_id is not null and exists (
                      select 1 from public.sponsorships s where s.project_id = pr.id and s.account_id = bk.account_id)))
              and app.has_project_access(pr.id)))
      or (m.role in ('sponsor','client') and (
            bk.account_id in (select app.my_account_ids())
            or exists (select 1 from public.channels c
                       where c.id = bk.channel_id and c.owner_account_id in (select app.my_account_ids()))))
    )
  )
$$;

create or replace function app.guard_project()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare st_new text;
begin
  if (select auth.uid()) is null then return new; end if;
  if not app.can_manage(new.workspace_id,'projects','edit') then
    if (new.title, new.job_code, new.channel_id, new.content_type_id, new.film_date, new.publish_date, new.link_url, new.archived_at, new.template_id)
       is distinct from
       (old.title, old.job_code, old.channel_id, old.content_type_id, old.film_date, old.publish_date, old.link_url, old.archived_at, old.template_id) then
      raise exception 'Only a Super Admin can change these project fields' using errcode = '42501';
    end if;
    if app.setting(new.workspace_id, 'lock_after_live') and app.status_label(old.status_id) = 'Live' then
      raise exception 'Live projects are locked. Ask a Super Admin to make changes.' using errcode = '42501';
    end if;
    if new.status_id is distinct from old.status_id
       and not coalesce((select st.editors_can_set from public.project_statuses st where st.id = new.status_id), false) then
      raise exception 'Editors cannot move projects to %. Ask a Super Admin.', app.status_label(new.status_id) using errcode = '42501';
    end if;
  end if;
  if new.status_id is distinct from old.status_id and app.setting(new.workspace_id, 'require_sponsor_approval') then
    st_new := app.status_label(new.status_id);
    if st_new in ('Scheduled', 'Live') and exists (
      select 1 from public.sponsorships s where s.project_id = new.id and s.approval_status <> 'approved') then
      raise exception 'Sponsor approval is required before this project can move to %', st_new using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create or replace function app.guard_edit_columns()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  if (select auth.uid()) is null then return new; end if;
  ws := app.project_ws(new.project_id);
  if app.can_manage(ws,'edits','edit') then return new; end if;
  if (new.editor_id, new.edit_due) is distinct from (old.editor_id, old.edit_due) then
    raise exception 'Editors change edit status, draft version and review link only' using errcode = '42501';
  end if;
  if app.setting(ws, 'lock_after_live') and app.project_is_live(new.project_id) then
    raise exception 'Live projects are locked. Ask a Super Admin to make changes.' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function app.guard_thumb_columns()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  if (select auth.uid()) is null then return new; end if;
  ws := app.project_ws(new.project_id);
  if app.can_manage(ws,'thumbs','edit') then return new; end if;
  if (new.designer_id, new.thumb_due) is distinct from (old.designer_id, old.thumb_due) then
    raise exception 'Designers change thumbnail status and final file only' using errcode = '42501';
  end if;
  if app.setting(ws, 'lock_after_live') and app.project_is_live(new.project_id) then
    raise exception 'Live projects are locked. Ask a Super Admin to make changes.' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function app.seed_manager(ws uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 insert into public.role_board_config(workspace_id,role,columns,views,default_view,scope,card)
 values(ws,'manager',array['project','job','channel','type','film','editor','editStatus','editDue','designer','thumb','thumbDue','sponsor','approval','status','pub','link'],
 '{table,kanban,list,timeline,calendar}','table','all','{"badges":["status","editStatus","thumb"],"people":["editor","designer"],"bar":"status"}') on conflict do nothing;
 insert into public.role_permissions(workspace_id,role,resource,action,allowed)
 select ws,'manager',r::public.perm_resource,a::public.perm_action,true
 from unnest(array['projects','edits','thumbs','comments','assets','ideas','clients','brands']) r
 cross join unnest(array['view','create','edit']) a on conflict do nothing;
 insert into public.role_permissions(workspace_id,role,resource,action,allowed) values(ws,'manager','ideas','approve',true),(ws,'manager','approvals','view',true) on conflict do nothing;
end $$;
select app.seed_manager(id) from public.workspaces;
create or replace function app.seed_manager_workspace() returns trigger
language plpgsql security definer set search_path='' as $$ begin perform app.seed_manager(new.id); return new; end $$;
create trigger seed_manager_workspace after insert on public.workspaces for each row execute function app.seed_manager_workspace();
revoke all on function app.seed_manager(uuid), app.seed_manager_workspace() from public,anon,authenticated;
grant execute on function app.can_manage(uuid,public.perm_resource,public.perm_action) to authenticated;

-- Operational account editing never grants portal access or changes its scope.
create or replace function app.guard_manager_account() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and app.member_role(new.workspace_id)='manager' then
   if tg_op='INSERT' then
     new.allow_portal:=false; new.portal_status:='off';
   elsif new.workspace_id<>old.workspace_id or
     (new.allow_portal,new.allow_drafts,new.allow_comment,new.allow_approve,new.portal_status,new.type)
       is distinct from (old.allow_portal,old.allow_drafts,old.allow_comment,old.allow_approve,old.portal_status,old.type) then
     raise exception 'Only a Super Admin can change portal access or account type' using errcode='42501';
   end if;
 end if;
 return new;
end $$;
create trigger guard_manager_account before insert or update on public.accounts for each row execute function app.guard_manager_account();

-- Reject references to another workspace, even if the UUID is known.
create or replace function app.guard_manager_project_tenant() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.workspace_id<>old.workspace_id then raise exception 'Projects cannot move between workspaces' using errcode='42501'; end if;
 if (new.channel_id is not null and not exists(select 1 from public.channels where id=new.channel_id and workspace_id=new.workspace_id))
 or (new.status_id is not null and not exists(select 1 from public.project_statuses where id=new.status_id and workspace_id=new.workspace_id))
 or (new.content_type_id is not null and not exists(select 1 from public.content_types where id=new.content_type_id and workspace_id=new.workspace_id))
 or (new.template_id is not null and not exists(select 1 from public.templates where id=new.template_id and workspace_id=new.workspace_id)) then
   raise exception 'Project references must belong to this workspace' using errcode='23514';
 end if;
 return new;
end $$;
create trigger guard_manager_project_tenant before insert or update on public.projects for each row execute function app.guard_manager_project_tenant();

insert into public.role_permissions(workspace_id,role,resource,action,allowed)
select id,'manager','approvals','view',true from public.workspaces on conflict do nothing;
create policy manager_sponsor_insert on public.sponsorships for insert to authenticated
with check(app.can_manage(app.project_ws(project_id),'projects','edit') and exists(select 1 from public.accounts a where a.id=account_id and a.workspace_id=app.project_ws(project_id)));
-- Assignment may change; a Manager cannot approve a sponsor's deliverables.
create policy manager_sponsor_update on public.sponsorships for update to authenticated
using(app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'projects','edit'))
with check(app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'projects','edit') and exists(select 1 from public.accounts a where a.id=account_id and a.workspace_id=app.project_ws(project_id)));
create or replace function app.guard_manager_sponsorship() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and app.member_role(app.project_ws(new.project_id))='manager' then
   if new.approval_status<>'pending' or new.decided_at is not null or new.decided_by is not null then
     raise exception 'Sponsor approval belongs to the sponsor or a Super Admin' using errcode='42501';
   end if;
 end if;
 return new;
end $$;
create trigger guard_manager_sponsorship before insert or update on public.sponsorships for each row execute function app.guard_manager_sponsorship();


create policy manager_insert on public.projects for insert to authenticated with check ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'projects','create')));

create policy manager_update on public.projects for update to authenticated using ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'projects','edit'))) with check ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'projects','edit')));

create policy manager_delete on public.projects for delete to authenticated using ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'projects','delete')));

create policy manager_insert on public.accounts for insert to authenticated with check ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'clients','create')));

create policy manager_update on public.accounts for update to authenticated using ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'clients','edit'))) with check ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'clients','edit')));

create policy manager_delete on public.accounts for delete to authenticated using ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'clients','delete')));

create policy manager_insert on public.brand_kits for insert to authenticated with check ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'brands','create')));

create policy manager_update on public.brand_kits for update to authenticated using ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'brands','edit'))) with check ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'brands','edit')));

create policy manager_delete on public.brand_kits for delete to authenticated using ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'brands','delete')));

create policy manager_insert on public.channels for insert to authenticated with check ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'clients','create')));

create policy manager_update on public.channels for update to authenticated using ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'clients','edit'))) with check ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'clients','edit')));

create policy manager_delete on public.channels for delete to authenticated using ((app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'clients','delete')));

create policy manager_insert on public.project_edits for insert to authenticated with check ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'edits','create')));

create policy manager_update on public.project_edits for update to authenticated using ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'edits','edit'))) with check ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'edits','edit')));

create policy manager_delete on public.project_edits for delete to authenticated using ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'edits','delete')));

create policy manager_insert on public.project_thumbnails for insert to authenticated with check ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'thumbs','create')));

create policy manager_update on public.project_thumbnails for update to authenticated using ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'thumbs','edit'))) with check ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'thumbs','edit')));

create policy manager_delete on public.project_thumbnails for delete to authenticated using ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'thumbs','delete')));

create policy manager_insert on public.project_checklist for insert to authenticated with check ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'projects','create')));

create policy manager_update on public.project_checklist for update to authenticated using ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'projects','edit'))) with check ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'projects','edit')));

create policy manager_delete on public.project_checklist for delete to authenticated using ((app.member_role(app.project_ws(project_id))='manager' and app.has_perm(app.project_ws(project_id),'projects','delete')));

alter policy ideas_select on public.ideas using (app.can_see_brand(brand_id) and (app.member_role(workspace_id)<>'manager' or app.has_perm(workspace_id,'ideas','view')));

alter policy ideas_insert on public.ideas with check (author_id=auth.uid() and app.can_see_brand(brand_id) and app.member_role(workspace_id)<>'editor' and (app.member_role(workspace_id)<>'manager' or app.has_perm(workspace_id,'ideas','create')));

create policy manager_update on public.ideas for update to authenticated using (app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'ideas','edit')) with check (app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'ideas','edit'));

create policy manager_delete on public.ideas for delete to authenticated using (app.member_role(workspace_id)='manager' and app.has_perm(workspace_id,'ideas','delete'));


-- View grants also govern indirect access through comments and cover storage.
create or replace function app.can_see_idea(i uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ideas x where x.id=i and app.can_see_brand(x.brand_id)
   and (app.member_role(x.workspace_id)<>'manager' or app.has_perm(x.workspace_id,'ideas','view')))
$$;
alter policy acct_select on public.accounts using (
 (app.is_internal(workspace_id) and (app.member_role(workspace_id)<>'manager' or app.has_perm(workspace_id,'clients','view')))
 or id in (select app.my_account_ids()));

create or replace function app.guard_manager_brand_tenant() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.workspace_id<>old.workspace_id then raise exception 'Brands cannot move between workspaces' using errcode='42501'; end if;
 if (new.account_id is not null and not exists(select 1 from public.accounts where id=new.account_id and workspace_id=new.workspace_id))
 or (new.channel_id is not null and not exists(select 1 from public.channels where id=new.channel_id and workspace_id=new.workspace_id)) then
  raise exception 'Brand references must belong to this workspace' using errcode='23514';
 end if;
 return new;
end $$;
create trigger guard_manager_brand_tenant before insert or update on public.brand_kits for each row execute function app.guard_manager_brand_tenant();

-- Account, channel and brand changes commit together. Managing contact details
-- does not issue invitations, change account type, or enable portal access.
create or replace function public.manager_save_account(p_workspace uuid, p_name text, p_type public.account_type,
 p_account uuid default null, p_email text default '', p_contact text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.accounts; ch uuid; kit uuid; old_name text;
begin
 if auth.uid() is null or app.member_role(p_workspace)<>'manager'
 or not app.has_perm(p_workspace,'clients',case when p_account is null then 'create'::public.perm_action else 'edit'::public.perm_action end)
 or not app.has_perm(p_workspace,'clients','view') then raise exception 'Account management is not permitted' using errcode='42501'; end if;
 p_name:=trim(p_name);
 if p_name is null or length(p_name) not between 1 and 200 or length(p_email)>320 or length(p_contact)>200 then raise exception 'Check the account name and contact details' using errcode='23514'; end if;
 if p_account is null then
  if exists(select 1 from public.brand_kits where workspace_id=p_workspace and lower(name)=lower(p_name))
    or exists(select 1 from public.channels where workspace_id=p_workspace and lower(name)=lower(p_name)) then
    raise exception 'A brand or channel already uses that name. Ask a Super Admin to link the existing records.' using errcode='23505';
  end if;
  insert into public.accounts(workspace_id,name,type,contact_email,contact_name,allow_portal,portal_status,allow_approve)
   values(p_workspace,p_name,p_type,p_email,p_contact,false,'off',p_type='sponsor') returning * into a;
  if p_type='client' then
   insert into public.channels(workspace_id,name,owner_account_id,sort) values(p_workspace,p_name,a.id,100) returning id into ch;
  end if;
  insert into public.brand_kits(workspace_id,name,kind,channel_id,account_id)
   values(p_workspace,p_name,case when p_type='client' then 'channel'::public.brand_kind else 'sponsor'::public.brand_kind end,ch,a.id) returning id into kit;
 else
  select * into a from public.accounts where id=p_account and workspace_id=p_workspace for update;
  if not found then raise exception 'Account not available' using errcode='42501'; end if;
  if p_type<>a.type then raise exception 'Only a Super Admin can change account type' using errcode='42501'; end if;
  old_name:=a.name;
  update public.accounts set name=p_name,contact_email=p_email,contact_name=p_contact where id=a.id returning * into a;
  update public.channels set name=p_name where owner_account_id=a.id and name=old_name;
  update public.brand_kits set name=p_name where account_id=a.id and name=old_name;
  select id into kit from public.brand_kits where account_id=a.id limit 1;
 end if;
 return to_jsonb(a)||jsonb_build_object('kitId',kit);
end $$;
revoke all on function public.manager_save_account(uuid,text,public.account_type,uuid,text,text) from public,anon;
grant execute on function public.manager_save_account(uuid,text,public.account_type,uuid,text,text) to authenticated;

create or replace function app.guard_manager_channel_tenant() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.workspace_id<>old.workspace_id then raise exception 'Channels cannot move between workspaces' using errcode='42501'; end if;
 if new.owner_account_id is not null and not exists(select 1 from public.accounts where id=new.owner_account_id and workspace_id=new.workspace_id) then
  raise exception 'Channel owner must belong to this workspace' using errcode='23514';
 end if;
 return new;
end $$;
create trigger guard_manager_channel_tenant before insert or update on public.channels for each row execute function app.guard_manager_channel_tenant();
