-- Editors/designers automatically receive every project layout. Layout availability
-- does not change project visibility, role permissions, assignments, or data access.
update public.role_board_config
set views = '{table,kanban,list,timeline,calendar}'
where role in ('editor', 'designer');

-- Apply the requested all-view rollout to existing members and pending invitations,
-- including Table-only pilot invitations. Inherit the role instead of freezing a copy.
update public.workspace_members set views = null where role in ('editor', 'designer');
update public.invitations set views = null
where role in ('editor', 'designer') and accepted_at is null;

-- Keep future workspace defaults consistent with this rollout.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('app.seed_workspace(uuid)'::regprocedure);
  definition := replace(definition, '''{table,kanban,list,timeline}''', '''{table,kanban,list,timeline,calendar}''');
  definition := replace(definition, '''{table,kanban,calendar}''', '''{table,kanban,list,timeline,calendar}''');
  execute definition;
end $$;
