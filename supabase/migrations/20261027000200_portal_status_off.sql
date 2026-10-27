-- Portal status tells the truth: new accounts start 'off' (not invited), and only a pending invitation makes one 'invited'.

alter table public.accounts alter column portal_status set default 'off';

-- Accounts marked 'invited' that never had an invitation go back to 'off'.
update public.accounts a set portal_status = 'off'
where a.portal_status = 'invited'
  and not exists (select 1 from public.invitations i where i.account_id = a.id and i.accepted_at is null);

-- Accepting an invite activates the account whether it was 'invited' or still 'off'.
create or replace function app.accept_invitations_for(uid uuid, mail text)
returns void
language plpgsql security definer set search_path = '' as $$
declare inv record;
begin
  for inv in
    select * from public.invitations
    where lower(email) = lower(mail) and accepted_at is null and expires_at > now()
  loop
    insert into public.workspace_members (workspace_id, user_id, role, status, views, invited_by, last_active_at)
    values (inv.workspace_id, uid, inv.role, 'active', inv.views, inv.invited_by, now())
    on conflict (workspace_id, user_id) do update
      set role = excluded.role, status = 'active', views = coalesce(excluded.views, public.workspace_members.views);
    if inv.account_id is not null then
      insert into public.account_members (account_id, user_id) values (inv.account_id, uid) on conflict do nothing;
      update public.accounts set portal_status = 'active' where id = inv.account_id and portal_status <> 'active';
    end if;
    if inv.full_name <> '' then
      update public.profiles set full_name = inv.full_name
      where id = uid and (full_name = '' or full_name = split_part(mail, '@', 1));
    end if;
    update public.invitations set accepted_at = now() where id = inv.id;
    insert into public.activity_log (workspace_id, actor_id, actor_label, category, action, target_label)
    select inv.workspace_id, uid, coalesce(nullif(split_part(p.full_name, ' ', 1), ''), mail), 'access', 'accepted the invite as',
      case inv.role when 'super_admin' then 'Super Admin' when 'editor' then 'Editor' when 'designer' then 'Designer' else 'Sponsor / Client' end
    from public.profiles p where p.id = uid;
  end loop;
end $$;
