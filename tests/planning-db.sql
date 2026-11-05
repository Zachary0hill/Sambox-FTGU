\set ON_ERROR_STOP on
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'FAIL: %',msg; end if; end $$;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000011','admin@example.test'),
 ('00000000-0000-0000-0000-000000000012','manager@example.test'),
 ('00000000-0000-0000-0000-000000000013','editor@example.test');
insert into public.workspaces(id,name,slug) values
 ('00000000-0000-0000-0000-000000000001','Planning QA','planning-qa'),
 ('00000000-0000-0000-0000-000000000002','Other QA','other-qa');
select app.seed_workspace(id) from public.workspaces;
insert into public.workspace_members(workspace_id,user_id,role,status) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','super_admin','active'),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','manager','active'),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000013','editor','active');
insert into public.channels(id,workspace_id,name) values
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001','Right client'),
 ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001','Other client'),
 ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000002','Foreign client');
insert into public.brand_kits(id,workspace_id,name,kind,channel_id) values
 ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000001','Right client','channel','00000000-0000-0000-0000-000000000021'),
 ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000001','Other client','channel','00000000-0000-0000-0000-000000000022'),
 ('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000002','Foreign client','channel','00000000-0000-0000-0000-000000000023');
insert into public.ideas(id,workspace_id,brand_id,title,author_id,status,title_options,thumbnail_brief,body,cover_path) values
 ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000032','Planning idea','00000000-0000-0000-0000-000000000012','in_review','{"Title A","Title B"}','Split screen concept','{"Full script"}','00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000041/cover.png'),
 ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000033','Foreign idea','00000000-0000-0000-0000-000000000011','in_review','{}','','{}',null);
select pg_temp.assert((select count(*)=2 from public.integrations where provider='xai'),'Grok seeded for new workspaces');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000012';
select pg_temp.assert(app.is_internal('00000000-0000-0000-0000-000000000001'),'manager is internal');
select pg_temp.assert(not app.is_admin('00000000-0000-0000-0000-000000000001'),'manager is not admin');
select pg_temp.assert(not app.has_perm('00000000-0000-0000-0000-000000000001','settings','edit'),'manager cannot change settings');
select pg_temp.assert((select count(*)=0 from public.ideas where id='00000000-0000-0000-0000-000000000042'),'foreign ideas hidden');
update public.ideas set brand_id='00000000-0000-0000-0000-000000000031' where id='00000000-0000-0000-0000-000000000041';
select public.approve_idea_project('00000000-0000-0000-0000-000000000041');
select public.approve_idea_project('00000000-0000-0000-0000-000000000041');
select pg_temp.assert((select count(*)=1 from public.projects),'approval retries create one project');
select pg_temp.assert((select channel_id='00000000-0000-0000-0000-000000000021' from public.projects),'correct brand channel carried');
select pg_temp.assert((select brief like '%Title A%' and brief like '%Split screen concept%' and brief like '%Full script%' from public.projects),'full production brief carried');
select pg_temp.assert((select idea_package->>'brand'='Right client' from public.projects),'brand snapshot');
select pg_temp.assert((select status='in_production' and project_id is not null from public.ideas where id='00000000-0000-0000-0000-000000000041'),'idea linked in production');
update public.projects set title='Manager updated';
select pg_temp.assert((select title='Manager updated' from public.projects),'manager edits projects');
insert into public.project_edits(project_id,editor_id,edit_status) select id,'00000000-0000-0000-0000-000000000013','assigned' from public.projects;
update public.project_edits set edit_due=current_date+1;
select pg_temp.assert((select edit_due=current_date+1 from public.project_edits),'manager sets edit deadline');
insert into public.accounts(id,workspace_id,name,type) values('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000001','New client','client');
select pg_temp.assert((select not allow_portal from public.accounts where id='00000000-0000-0000-0000-000000000051'),'new client does not grant portal access');
do $$ begin
 begin update public.accounts set allow_portal=true where id='00000000-0000-0000-0000-000000000051'; raise exception 'FAIL: portal access changed'; exception when insufficient_privilege then null; end;
 begin perform public.approve_idea_project('00000000-0000-0000-0000-000000000042'); raise exception 'FAIL: approved foreign idea'; exception when insufficient_privilege then null; end;
 begin update public.ideas set brand_id='00000000-0000-0000-0000-000000000033'; raise exception 'FAIL: foreign brand accepted'; exception when check_violation then null; end;
 begin update public.projects set channel_id='00000000-0000-0000-0000-000000000023'; raise exception 'FAIL: foreign channel accepted'; exception when check_violation then null; end;
end $$;
select public.manager_save_account('00000000-0000-0000-0000-000000000001','Atomic client','client');
select pg_temp.assert((select count(*)=1 from public.brand_kits where name='Atomic client' and channel_id is not null and account_id is not null),'client brand and channel created');
select public.manager_save_account('00000000-0000-0000-0000-000000000001','Renamed client','client',(select id from public.accounts where name='Atomic client'),'contact@example.test','Contact');
select pg_temp.assert((select count(*)=1 from public.channels where name='Renamed client'),'rename carries channel');
select pg_temp.assert((select count(*)=1 from public.brand_kits where name='Renamed client'),'rename carries brand');
do $$ begin
 begin perform public.manager_save_account('00000000-0000-0000-0000-000000000001','Right client','client'); raise exception 'FAIL: conflicting account created'; exception when unique_violation then null; end;
end $$;
select pg_temp.assert((select count(*)=0 from public.accounts where name='Right client'),'conflict leaves no partial account');
update public.workspace_members set role='super_admin' where user_id=auth.uid();
select pg_temp.assert((select role='manager' from public.workspace_members where user_id=auth.uid()),'manager cannot promote self');
update public.workspace_settings set accent='#123456';
select pg_temp.assert((select accent<>'#123456' from public.workspace_settings where workspace_id='00000000-0000-0000-0000-000000000001'),'settings unchanged');
reset role;
update public.role_permissions set allowed=false where role='manager' and resource='projects' and action='edit';
-- Even an accidental database grant cannot turn Manager into an admin.
insert into public.role_permissions(workspace_id,role,resource,action,allowed) values('00000000-0000-0000-0000-000000000001','manager','users','edit',true);
set role authenticated;
select pg_temp.assert(not app.has_perm('00000000-0000-0000-0000-000000000001','users','edit'),'restricted grants ignored');
update public.projects set title='Should not save';
select pg_temp.assert((select title='Manager updated' from public.projects),'revoked edit permission enforced');
reset role;
update public.role_permissions set allowed=false where role='manager' and resource in ('ideas','clients') and action='view';
set role authenticated;
select pg_temp.assert(not app.can_see_idea('00000000-0000-0000-0000-000000000041'),'revoked idea view blocks indirect access');
select pg_temp.assert((select count(*)=0 from public.accounts),'revoked clients view hides accounts');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000013';
do $$ begin
 begin perform public.approve_idea_project('00000000-0000-0000-0000-000000000041'); raise exception 'FAIL: editor approval'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'Planning and Manager database checks passed' as result;
