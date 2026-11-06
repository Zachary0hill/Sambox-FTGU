-- The first sign in guide now covers sponsors and clients as well as editors and designers.
-- New memberships in any of these roles are enrolled; existing members can still open the guide from Settings.
create or replace function app.enroll_member_onboarding() returns trigger language plpgsql set search_path = '' as $$
begin
  new.onboarding_required := new.role in ('editor','designer','sponsor','client');
  return new;
end $$;

create or replace function public.save_my_onboarding(p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.workspace_members where user_id = auth.uid() and status = 'active' order by created_at limit 1;
  if p_action not in ('complete','dismiss','reopen') then raise exception 'Invalid onboarding action'; end if;
  update public.workspace_members set
    onboarding_completed_at = case when p_action = 'complete' then now() else onboarding_completed_at end,
    onboarding_dismissed_at = case when p_action = 'dismiss' then now() when p_action = 'reopen' then null else onboarding_dismissed_at end
  where workspace_id = ws and user_id = auth.uid() and status = 'active' and role in ('editor','designer','sponsor','client');
end $$;
revoke all on function public.save_my_onboarding(text) from public, anon;
grant execute on function public.save_my_onboarding(text) to authenticated;
