-- Run with a privileged database connection. ALL fixtures and queued notifications roll back.
-- No provider requests, storage uploads, or permanent user changes are made.
begin;
set local statement_timeout = '30s';
create temporary table onboarding_fixture as select gen_random_uuid() ws, gen_random_uuid() editor, gen_random_uuid() designer, gen_random_uuid() project, gen_random_uuid() other_project;
grant select on onboarding_fixture to authenticated;
insert into auth.users(id,email,raw_user_meta_data) select editor,'editor-'||editor||'@onboarding.invalid','{}'::jsonb from onboarding_fixture union all select designer,'designer-'||designer||'@onboarding.invalid','{}'::jsonb from onboarding_fixture;
insert into public.profiles(id,email) select id,email from auth.users where id in (select editor from onboarding_fixture union all select designer from onboarding_fixture) on conflict (id) do nothing;
insert into public.workspaces(id,name,slug) select ws,'Rollback onboarding test','onboarding-'||ws from onboarding_fixture;
select app.seed_workspace(ws) from onboarding_fixture;
insert into public.workspace_members(workspace_id,user_id,role) select ws,editor,'editor'::public.user_role from onboarding_fixture union all select ws,designer,'designer'::public.user_role from onboarding_fixture;
update public.role_board_config set scope='assigned' where workspace_id=(select ws from onboarding_fixture) and role in ('editor','designer');
insert into public.projects(id,workspace_id,job_code,title,status_id) select project,ws,'QA-1','Assigned test',(select id from public.project_statuses where workspace_id=f.ws limit 1) from onboarding_fixture f union all select other_project,ws,'QA-2','Unassigned test',(select id from public.project_statuses where workspace_id=f.ws limit 1) from onboarding_fixture f;
insert into public.project_edits(project_id,editor_id,edit_status) select project,editor,'assigned' from onboarding_fixture on conflict(project_id) do update set editor_id=excluded.editor_id,edit_status=excluded.edit_status;
insert into public.project_thumbnails(project_id,designer_id,thumb_status) select project,designer,'not_started' from onboarding_fixture on conflict(project_id) do update set designer_id=excluded.designer_id,thumb_status=excluded.thumb_status;
select set_config('request.jwt.claim.sub',editor::text,true) from onboarding_fixture;
set local role authenticated;
do $$ declare f record; n int; begin
 select * into f from onboarding_fixture;
 if not app.has_project_access(f.project) or app.has_project_access(f.other_project) then raise exception 'Editor assignment visibility failed'; end if;
 update public.project_edits set edit_status='in_review',review_url='https://example.invalid/cut' where project_id=f.project;
 get diagnostics n=row_count; if n<>1 then raise exception 'Editor review update failed'; end if;
 insert into public.project_assets(project_id,kind,name,external_url,uploaded_by) values(f.project,'draft','Test cut','https://example.invalid/cut',f.editor);
 begin update public.project_edits set edit_due=current_date where project_id=f.project; raise exception 'Editor changed deadline'; exception when insufficient_privilege then null; end;
 begin update public.project_edits set editor_id=f.designer where project_id=f.project; raise exception 'Editor reassigned work'; exception when insufficient_privilege then null; end;
 if app.has_perm(f.ws,'users','edit') or app.has_perm(f.ws,'finance','view') then raise exception 'Editor privilege leak'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',designer::text,true) from onboarding_fixture;
set local role authenticated;
do $$ declare f record; n int; begin
 select * into f from onboarding_fixture;
 if not app.has_project_access(f.project) or app.has_project_access(f.other_project) then raise exception 'Designer assignment visibility failed'; end if;
 update public.project_thumbnails set thumb_status='in_review' where project_id=f.project;
 get diagnostics n=row_count; if n<>1 then raise exception 'Designer review update failed'; end if;
 insert into public.project_assets(project_id,kind,name,external_url,uploaded_by) values(f.project,'thumbnail','Test thumbnail','https://example.invalid/thumb',f.designer);
 begin update public.project_thumbnails set thumb_due=current_date where project_id=f.project; raise exception 'Designer changed deadline'; exception when insufficient_privilege then null; end;
 begin update public.project_thumbnails set designer_id=f.editor where project_id=f.project; raise exception 'Designer reassigned work'; exception when insufficient_privilege then null; end;
 if app.has_perm(f.ws,'users','edit') or app.has_perm(f.ws,'finance','view') then raise exception 'Designer privilege leak'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
-- Acceptance must ignore expired and canceled invitations and never replay accepted invitations.
delete from public.workspace_members where workspace_id=(select ws from onboarding_fixture);
insert into public.invitations(workspace_id,email,role,expires_at) select ws,p.email,'editor',now()-interval '1 day' from onboarding_fixture f join public.profiles p on p.id=f.editor;
select app.accept_invitations_for(editor,p.email) from onboarding_fixture f join public.profiles p on p.id=f.editor;
do $$ begin if exists(select 1 from public.workspace_members where workspace_id=(select ws from onboarding_fixture)) then raise exception 'Expired invite activated'; end if; end $$;
delete from public.invitations where workspace_id=(select ws from onboarding_fixture);
select app.accept_invitations_for(editor,p.email) from onboarding_fixture f join public.profiles p on p.id=f.editor;
do $$ begin if exists(select 1 from public.workspace_members where workspace_id=(select ws from onboarding_fixture)) then raise exception 'Canceled invite activated'; end if; end $$;
insert into public.invitations(workspace_id,email,role) select ws,p.email,'editor' from onboarding_fixture f join public.profiles p on p.id=f.editor;
select app.accept_invitations_for(editor,p.email) from onboarding_fixture f join public.profiles p on p.id=f.editor;
update public.workspace_members set status='deactivated' where workspace_id=(select ws from onboarding_fixture);
select app.accept_invitations_for(editor,p.email) from onboarding_fixture f join public.profiles p on p.id=f.editor;
select set_config('request.jwt.claim.sub',editor::text,true) from onboarding_fixture;
set local role authenticated;
do $$ declare f record; begin select * into f from onboarding_fixture; if app.has_project_access(f.project) or app.is_member(f.ws) then raise exception 'Deactivated member regained access'; end if; end $$;
reset role;
-- Shared sponsor/client acceptance and removal must retain account scoping.
select set_config('request.jwt.claim.sub','',true);
delete from public.workspace_members where workspace_id=(select ws from onboarding_fixture);
insert into public.accounts(workspace_id,name,type) select ws,'Portal fixture','client' from onboarding_fixture;
insert into public.invitations(workspace_id,email,role,account_id)
select f.ws,p.email,'client',a.id from onboarding_fixture f join public.profiles p on p.id=f.designer join public.accounts a on a.workspace_id=f.ws;
select app.accept_invitations_for(designer,p.email) from onboarding_fixture f join public.profiles p on p.id=f.designer;
do $$ begin
 if not exists(select 1 from public.account_members am join onboarding_fixture f on am.user_id=f.designer join public.accounts a on a.id=am.account_id and a.workspace_id=f.ws) then raise exception 'Client acceptance lost account access'; end if;
end $$;
delete from public.workspace_members where workspace_id=(select ws from onboarding_fixture);
do $$ begin
 if exists(select 1 from public.account_members am join public.accounts a on a.id=am.account_id where a.workspace_id=(select ws from onboarding_fixture)) then raise exception 'Removed portal member retained access'; end if;
end $$;
rollback;
select 'PASS: assigned visibility, review updates, asset metadata, denied deadlines/reassignment/admin/finance, expired/canceled links, deactivation and accepted-invite replay, client acceptance/removal; all fixtures rolled back' as result;
