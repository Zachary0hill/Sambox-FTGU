-- Functions get EXECUTE for PUBLIC by default. Only signed-in members call the board RPCs.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

grant execute on function public.directory(), public.my_context(), public.touch_presence(),
  public.log_activity(public.log_category, text, text, uuid, uuid, text, text, boolean, text, uuid),
  public.save_permissions(jsonb), public.invite_member(text, text, public.user_role, public.view_kind[], uuid),
  public.portal_projects(uuid), public.portal_comments(uuid, uuid), public.portal_assets(uuid, uuid),
  public.portal_add_comment(uuid, uuid, text), public.portal_decide_sponsorship(uuid, public.approval_status, text)
to authenticated;
grant execute on all functions in schema app to authenticated;
revoke execute on function app.seed_workspace(uuid), app.accept_invitations_for(uuid, text) from authenticated;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema app revoke execute on functions from public;
