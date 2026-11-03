-- Sponsors and clients get every board view, and follow the views set for their role in Roles & Permissions.
--
-- Invites used to copy the role's views onto each person, and that copy beat the role setting, so a later change in
-- Roles & Permissions never reached them. Copies of the old default are cleared; anyone given other views by hand
-- through Edit access keeps them.

update public.role_board_config
set views = '{table,kanban,list,timeline,calendar}'
where role in ('sponsor', 'client');

update public.workspace_members
set views = null
where role in ('sponsor', 'client') and views = '{table,calendar}';

update public.invitations
set views = null
where role in ('sponsor', 'client') and accepted_at is null and views = '{table,calendar}';

-- New workspaces start the same way. Only the sponsor and client rows use exactly these views.
do $$
begin
  execute replace(
    pg_get_functiondef('app.seed_workspace(uuid)'::regprocedure),
    '''{table,calendar}''',
    '''{table,kanban,list,timeline,calendar}'''
  );
end $$;
