-- Managers could not be @mentioned: app.can_mention was written before the manager role existed, so a manager never
-- showed in the @ picker and "@Their Name" in a comment resolved to nobody (no notification, no email).
-- A manager reads a project's comments when the role has projects:view and comments:view, the same test
-- has_project_access and cm_select apply to the caller.
create or replace function app.can_mention(p uuid, uid uuid, is_internal boolean)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.projects pr
    join public.workspace_members m on m.workspace_id = pr.workspace_id and m.user_id = uid and m.status = 'active'
    left join public.role_board_config rc on rc.workspace_id = pr.workspace_id and rc.role = m.role
    where pr.id = p and (
      m.role = 'super_admin'
      or (m.role in ('manager', 'editor', 'designer')
        and exists (select 1 from public.role_permissions rp
          where rp.workspace_id = pr.workspace_id and rp.role = m.role and rp.resource = 'comments' and rp.action = 'view' and rp.allowed)
        and ((m.role = 'manager' and exists (select 1 from public.role_permissions rp
            where rp.workspace_id = pr.workspace_id and rp.role = m.role and rp.resource = 'projects' and rp.action = 'view' and rp.allowed))
          or (m.role in ('editor', 'designer') and rc.scope = 'all')
          or (m.role = 'editor' and exists (select 1 from public.project_edits e where e.project_id = pr.id and e.editor_id = uid))
          or (m.role = 'designer' and exists (select 1 from public.project_thumbnails t where t.project_id = pr.id and t.designer_id = uid))))
      or (m.role in ('sponsor', 'client') and not is_internal and pr.archived_at is null and exists (
        select 1 from public.account_members am
        join public.accounts a on a.id = am.account_id and a.allow_portal and a.workspace_id = pr.workspace_id
        left join public.channels c on c.id = pr.channel_id
        where am.user_id = uid and (c.owner_account_id = a.id
          or exists (select 1 from public.sponsorships s where s.project_id = pr.id and s.account_id = a.id))))
    ))
$$;
revoke execute on function app.can_mention(uuid, uuid, boolean) from public, anon, authenticated;
