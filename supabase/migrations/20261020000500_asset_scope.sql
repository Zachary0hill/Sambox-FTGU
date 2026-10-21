-- Scripts stay with the team that writes and cuts them: designers do not see them.

drop policy if exists pa_select on public.project_assets;
create policy pa_select on public.project_assets for select to authenticated
  using (app.is_internal(app.project_ws(project_id))
    and app.has_perm(app.project_ws(project_id), 'assets', 'view')
    and app.has_project_access(project_id)
    and not (kind = 'script' and app.member_role(app.project_ws(project_id)) = 'designer'));
