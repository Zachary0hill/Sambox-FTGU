-- Access control lives here. The app never decides who sees a row.

grant usage on schema app to authenticated, anon;

-- ---------- Helper functions ----------
create or replace function app.member_role(ws uuid)
returns public.user_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create or replace function app.is_internal(ws uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.member_role(ws) in ('super_admin','editor','designer'), false)
$$;

create or replace function app.is_admin(ws uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.member_role(ws) = 'super_admin', false)
$$;

create or replace function app.is_member(ws uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select app.member_role(ws) is not null
$$;

create or replace function app.has_perm(ws uuid, res public.perm_resource, act public.perm_action)
returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when app.member_role(ws) is null then false
    when app.member_role(ws) = 'super_admin' then true
    else exists (
      select 1 from public.role_permissions rp
      where rp.workspace_id = ws and rp.role = app.member_role(ws)
        and rp.resource = res and rp.action = act and rp.allowed)
  end
$$;

create or replace function app.project_ws(p uuid)
returns uuid
language sql stable security definer set search_path = '' as $$
  select workspace_id from public.projects where id = p
$$;

create or replace function app.setting(ws uuid, k text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((to_jsonb(s) ->> k)::boolean, false) from public.workspace_settings s where s.workspace_id = ws
$$;

create or replace function app.my_account_ids()
returns setof uuid
language sql stable security definer set search_path = '' as $$
  select a.id from public.account_members am
  join public.accounts a on a.id = am.account_id and a.allow_portal
  where am.user_id = (select auth.uid())
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
      m.role = 'super_admin'
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
      m.role = 'super_admin'
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

create or replace function app.can_see_idea(i uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ideas x where x.id = i and app.can_see_brand(x.brand_id))
$$;

create or replace function app.shares_workspace(other uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members a
    join public.workspace_members b on b.workspace_id = a.workspace_id
    where a.user_id = (select auth.uid()) and a.status = 'active' and b.user_id = other)
$$;

grant execute on all functions in schema app to authenticated;

-- ---------- Enable RLS ----------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Tenancy ----------
create policy ws_select on public.workspaces for select to authenticated using ((select app.is_member(id)));
create policy ws_update on public.workspaces for update to authenticated using ((select app.is_admin(id)));

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or app.shares_workspace(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy wm_select on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_internal(workspace_id)));
create policy wm_insert on public.workspace_members for insert to authenticated
  with check ((select app.has_perm(workspace_id, 'users', 'create')));
create policy wm_update on public.workspace_members for update to authenticated
  using ((select app.has_perm(workspace_id, 'users', 'edit')));
create policy wm_delete on public.workspace_members for delete to authenticated
  using ((select app.has_perm(workspace_id, 'users', 'delete')));

create policy inv_select on public.invitations for select to authenticated using ((select app.has_perm(workspace_id, 'users', 'view')));
create policy inv_insert on public.invitations for insert to authenticated with check ((select app.has_perm(workspace_id, 'users', 'create')));
create policy inv_update on public.invitations for update to authenticated using ((select app.has_perm(workspace_id, 'users', 'edit')));
create policy inv_delete on public.invitations for delete to authenticated using ((select app.has_perm(workspace_id, 'users', 'delete')));

create policy acct_select on public.accounts for select to authenticated
  using ((select app.is_internal(workspace_id)) or id in (select app.my_account_ids()));
create policy acct_insert on public.accounts for insert to authenticated with check ((select app.is_admin(workspace_id)));
create policy acct_update on public.accounts for update to authenticated using ((select app.is_admin(workspace_id)));
create policy acct_delete on public.accounts for delete to authenticated using ((select app.is_admin(workspace_id)));

create policy am_select on public.account_members for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.accounts a where a.id = account_id and app.is_admin(a.workspace_id)));
create policy am_write on public.account_members for all to authenticated
  using (exists (select 1 from public.accounts a where a.id = account_id and app.is_admin(a.workspace_id)))
  with check (exists (select 1 from public.accounts a where a.id = account_id and app.is_admin(a.workspace_id)));

create policy ch_select on public.channels for select to authenticated using ((select app.is_member(workspace_id)));
create policy ch_write on public.channels for all to authenticated
  using ((select app.is_admin(workspace_id))) with check ((select app.is_admin(workspace_id)));

-- ---------- Configuration: any member reads, settings:edit writes ----------
do $$
declare t text;
begin
  foreach t in array array['role_permissions','role_board_config','project_statuses','content_types','custom_fields','templates','workspace_settings'] loop
    execute format('create policy cfg_select on public.%I for select to authenticated using ((select app.is_member(workspace_id)))', t);
    execute format('create policy cfg_insert on public.%I for insert to authenticated with check ((select app.has_perm(workspace_id, ''settings'', ''edit'')))', t);
    execute format('create policy cfg_update on public.%I for update to authenticated using ((select app.has_perm(workspace_id, ''settings'', ''edit'')))', t);
    execute format('create policy cfg_delete on public.%I for delete to authenticated using ((select app.has_perm(workspace_id, ''settings'', ''edit'')))', t);
  end loop;
end $$;

-- ---------- Production ----------
create policy pr_select on public.projects for select to authenticated
  using ((select app.is_internal(workspace_id)) and app.has_project_access(id));
create policy pr_insert on public.projects for insert to authenticated
  with check ((select app.has_perm(workspace_id, 'projects', 'create')));
create policy pr_update on public.projects for update to authenticated
  using ((select app.is_admin(workspace_id))
    or ((select app.member_role(workspace_id)) = 'editor' and (select app.setting(workspace_id, 'editors_change_status')) and app.has_project_access(id)));
create policy pr_delete on public.projects for delete to authenticated
  using ((select app.has_perm(workspace_id, 'projects', 'delete')));

create policy pe_select on public.project_edits for select to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_perm(app.project_ws(project_id), 'edits', 'view') and app.has_project_access(project_id));
create policy pe_insert on public.project_edits for insert to authenticated
  with check (app.is_admin(app.project_ws(project_id))
    or (app.has_perm(app.project_ws(project_id), 'edits', 'create') and app.has_project_access(project_id)));
create policy pe_update on public.project_edits for update to authenticated
  using (app.is_admin(app.project_ws(project_id))
    or (editor_id = (select auth.uid()) and app.has_perm(app.project_ws(project_id), 'edits', 'edit')));
create policy pe_delete on public.project_edits for delete to authenticated using (app.is_admin(app.project_ws(project_id)));

create policy pt_select on public.project_thumbnails for select to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_perm(app.project_ws(project_id), 'thumbs', 'view') and app.has_project_access(project_id));
create policy pt_insert on public.project_thumbnails for insert to authenticated
  with check (app.is_admin(app.project_ws(project_id))
    or (app.has_perm(app.project_ws(project_id), 'thumbs', 'create') and app.has_project_access(project_id)));
create policy pt_update on public.project_thumbnails for update to authenticated
  using (app.is_admin(app.project_ws(project_id))
    or (designer_id = (select auth.uid()) and app.has_perm(app.project_ws(project_id), 'thumbs', 'edit')));
create policy pt_delete on public.project_thumbnails for delete to authenticated using (app.is_admin(app.project_ws(project_id)));

create policy sp_select on public.sponsorships for select to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_perm(app.project_ws(project_id), 'approvals', 'view') and app.has_project_access(project_id));
create policy sp_write on public.sponsorships for all to authenticated
  using (app.is_admin(app.project_ws(project_id))) with check (app.is_admin(app.project_ws(project_id)));

create policy dt_select on public.distribution_tasks for select to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_project_access(project_id));
create policy dt_write on public.distribution_tasks for all to authenticated
  using (app.is_admin(app.project_ws(project_id))) with check (app.is_admin(app.project_ws(project_id)));

create policy fv_select on public.project_field_values for select to authenticated
  using (app.has_project_access(project_id) and exists (
    select 1 from public.custom_fields f where f.id = field_id and app.member_role(f.workspace_id) = any (f.visible_roles)));
create policy fv_insert on public.project_field_values for insert to authenticated
  with check (app.has_project_access(project_id) and exists (
    select 1 from public.custom_fields f where f.id = field_id and app.member_role(f.workspace_id) = any (f.editable_roles)));
create policy fv_update on public.project_field_values for update to authenticated
  using (app.has_project_access(project_id) and exists (
    select 1 from public.custom_fields f where f.id = field_id and app.member_role(f.workspace_id) = any (f.editable_roles)));
create policy fv_delete on public.project_field_values for delete to authenticated using (app.is_admin(app.project_ws(project_id)));

create policy cm_select on public.comments for select to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_perm(app.project_ws(project_id), 'comments', 'view') and app.has_project_access(project_id));
create policy cm_insert on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and app.is_internal(app.project_ws(project_id))
    and app.has_perm(app.project_ws(project_id), 'comments', 'create') and app.has_project_access(project_id));
create policy cm_update on public.comments for update to authenticated
  using (author_id = (select auth.uid()) and app.has_perm(app.project_ws(project_id), 'comments', 'edit'));
create policy cm_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or app.is_admin(app.project_ws(project_id)));

create policy pa_select on public.project_assets for select to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_perm(app.project_ws(project_id), 'assets', 'view') and app.has_project_access(project_id));
create policy pa_insert on public.project_assets for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and app.has_perm(app.project_ws(project_id), 'assets', 'create') and app.has_project_access(project_id));
create policy pa_update on public.project_assets for update to authenticated
  using (uploaded_by = (select auth.uid()) or app.is_admin(app.project_ws(project_id)));
create policy pa_delete on public.project_assets for delete to authenticated
  using (uploaded_by = (select auth.uid()) or app.has_perm(app.project_ws(project_id), 'assets', 'delete'));

-- ---------- Personal rows ----------
create policy tasks_own on public.tasks for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and (select app.is_member(workspace_id)));
create policy threads_own on public.ai_threads for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select app.is_member(workspace_id)));
create policy msgs_own on public.ai_messages for all to authenticated
  using (exists (select 1 from public.ai_threads t where t.id = thread_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.ai_threads t where t.id = thread_id and t.user_id = (select auth.uid())));
create policy notif_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notif_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- Brands and ideas ----------
create policy bk_select on public.brand_kits for select to authenticated using (app.can_see_brand(id));
create policy bk_write on public.brand_kits for all to authenticated
  using ((select app.is_admin(workspace_id))) with check ((select app.is_admin(workspace_id)));

create policy ideas_select on public.ideas for select to authenticated using (app.can_see_brand(brand_id));
create policy ideas_insert on public.ideas for insert to authenticated
  with check (author_id = (select auth.uid()) and app.can_see_brand(brand_id)
    and (select app.member_role(workspace_id)) <> 'editor');
create policy ideas_update on public.ideas for update to authenticated
  using ((select app.is_admin(workspace_id))
    or (author_id = (select auth.uid()) and (select app.member_role(workspace_id)) = 'designer')
    or ((select app.member_role(workspace_id)) in ('sponsor','client') and exists (
          select 1 from public.brand_kits bk where bk.id = brand_id
          and (bk.account_id in (select app.my_account_ids())
            or exists (select 1 from public.channels c where c.id = bk.channel_id and c.owner_account_id in (select app.my_account_ids()))))));
create policy ideas_delete on public.ideas for delete to authenticated using ((select app.is_admin(workspace_id)));

create policy ic_select on public.idea_comments for select to authenticated using (app.can_see_idea(idea_id));
create policy ic_insert on public.idea_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and app.can_see_idea(idea_id));
create policy ic_delete on public.idea_comments for delete to authenticated
  using (author_id = (select auth.uid()) or exists (select 1 from public.ideas i where i.id = idea_id and app.is_admin(i.workspace_id)));

create policy metrics_select on public.content_metrics for select to authenticated
  using (app.is_internal(app.project_ws(project_id)) and app.has_project_access(project_id));
create policy metrics_write on public.content_metrics for all to authenticated
  using (app.is_admin(app.project_ws(project_id))) with check (app.is_admin(app.project_ws(project_id)));

-- ---------- Finance ----------
create policy pf_select on public.project_finance for select to authenticated using (app.has_perm(app.project_ws(project_id), 'finance', 'view'));
create policy pf_insert on public.project_finance for insert to authenticated with check (app.has_perm(app.project_ws(project_id), 'finance', 'create'));
create policy pf_update on public.project_finance for update to authenticated using (app.has_perm(app.project_ws(project_id), 'finance', 'edit'));
create policy pf_delete on public.project_finance for delete to authenticated using (app.has_perm(app.project_ws(project_id), 'finance', 'delete'));

do $$
declare t text;
begin
  foreach t in array array['deals','invoices','payouts'] loop
    execute format('create policy fin_select on public.%I for select to authenticated using ((select app.has_perm(workspace_id, ''finance'', ''view'')))', t);
    execute format('create policy fin_insert on public.%I for insert to authenticated with check ((select app.has_perm(workspace_id, ''finance'', ''create'')))', t);
    execute format('create policy fin_update on public.%I for update to authenticated using ((select app.has_perm(workspace_id, ''finance'', ''edit'')))', t);
    execute format('create policy fin_delete on public.%I for delete to authenticated using ((select app.has_perm(workspace_id, ''finance'', ''delete'')))', t);
  end loop;
  foreach t in array array['integrations','automations'] loop
    execute format('create policy auto_select on public.%I for select to authenticated using ((select app.has_perm(workspace_id, ''automations'', ''view'')))', t);
    execute format('create policy auto_insert on public.%I for insert to authenticated with check ((select app.has_perm(workspace_id, ''automations'', ''create'')))', t);
    execute format('create policy auto_update on public.%I for update to authenticated using ((select app.has_perm(workspace_id, ''automations'', ''edit'')))', t);
    execute format('create policy auto_delete on public.%I for delete to authenticated using ((select app.has_perm(workspace_id, ''automations'', ''delete'')))', t);
  end loop;
end $$;

create policy runs_select on public.automation_runs for select to authenticated
  using (exists (select 1 from public.automations a where a.id = automation_id and app.has_perm(a.workspace_id, 'automations', 'view')));

-- ---------- Activity log: append only through public.log_activity ----------
create policy log_select on public.activity_log for select to authenticated
  using ((select app.is_admin(workspace_id))
    or (idea_id is not null and app.can_see_idea(idea_id))
    or (project_id is not null and category in ('project','approval') and app.has_project_access(project_id)
        and ((select app.is_internal(workspace_id)) or external_visible)));
