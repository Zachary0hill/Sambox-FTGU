-- Triggers (signup, column guards, workflow rules) and RPCs (activity, portal, admin).

-- ---------- Signup and invitations ----------
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
      update public.accounts set portal_status = 'active' where id = inv.account_id and portal_status = 'invited';
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

create or replace function app.handle_new_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)), coalesce(new.email, ''))
  on conflict (id) do nothing;
  perform app.accept_invitations_for(new.id, coalesce(new.email, ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function app.handle_new_user();

-- ---------- Column guards and workflow rules ----------
create or replace function app.status_label(s uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select label from public.project_statuses where id = s
$$;

create or replace function app.project_is_live(p uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select app.status_label(status_id) = 'Live' from public.projects where id = p), false)
$$;

create or replace function app.guard_project()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare st_new text;
begin
  if (select auth.uid()) is null then return new; end if;
  if not app.is_admin(new.workspace_id) then
    if (new.title, new.job_code, new.channel_id, new.content_type_id, new.film_date, new.publish_date, new.link_url, new.archived_at, new.template_id)
       is distinct from
       (old.title, old.job_code, old.channel_id, old.content_type_id, old.film_date, old.publish_date, old.link_url, old.archived_at, old.template_id) then
      raise exception 'Only a Super Admin can change these project fields' using errcode = '42501';
    end if;
    if app.setting(new.workspace_id, 'lock_after_live') and app.status_label(old.status_id) = 'Live' then
      raise exception 'Live projects are locked. Ask a Super Admin to make changes.' using errcode = '42501';
    end if;
  end if;
  if new.status_id is distinct from old.status_id and app.setting(new.workspace_id, 'require_sponsor_approval') then
    st_new := app.status_label(new.status_id);
    if st_new in ('Scheduled', 'Live') and exists (
      select 1 from public.sponsorships s where s.project_id = new.id and s.approval_status <> 'approved') then
      raise exception 'Sponsor approval is required before this project can move to %', st_new using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger guard_project before update on public.projects
for each row execute function app.guard_project();

create or replace function app.guard_edit_columns()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  if (select auth.uid()) is null then return new; end if;
  ws := app.project_ws(new.project_id);
  if app.is_admin(ws) then return new; end if;
  if (new.editor_id, new.edit_due) is distinct from (old.editor_id, old.edit_due) then
    raise exception 'Editors change edit status, draft version and review link only' using errcode = '42501';
  end if;
  if app.setting(ws, 'lock_after_live') and app.project_is_live(new.project_id) then
    raise exception 'Live projects are locked. Ask a Super Admin to make changes.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger guard_edit_columns before update on public.project_edits
for each row execute function app.guard_edit_columns();

create or replace function app.guard_thumb_columns()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  if (select auth.uid()) is null then return new; end if;
  ws := app.project_ws(new.project_id);
  if app.is_admin(ws) then return new; end if;
  if (new.designer_id, new.thumb_due) is distinct from (old.designer_id, old.thumb_due) then
    raise exception 'Designers change thumbnail status and final file only' using errcode = '42501';
  end if;
  if app.setting(ws, 'lock_after_live') and app.project_is_live(new.project_id) then
    raise exception 'Live projects are locked. Ask a Super Admin to make changes.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger guard_thumb_columns before update on public.project_thumbnails
for each row execute function app.guard_thumb_columns();

create or replace function app.after_project_status()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status_id is distinct from old.status_id and app.status_label(new.status_id) = 'Live'
     and app.setting(new.workspace_id, 'auto_distribution') then
    insert into public.distribution_tasks (project_id, kind)
    select new.id, k from unnest(enum_range(null::public.dist_kind)) k
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger after_project_status after update of status_id on public.projects
for each row execute function app.after_project_status();

create or replace function app.protect_super_admin()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.is_owner and (tg_op = 'DELETE' or new.status <> 'active' or new.role <> 'super_admin') then
    raise exception 'The workspace owner cannot be removed, demoted or deactivated' using errcode = '42501';
  end if;
  if old.role = 'super_admin' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'super_admin' or new.status <> 'active')
     and not exists (
       select 1 from public.workspace_members m
       where m.workspace_id = old.workspace_id and m.role = 'super_admin' and m.status = 'active' and m.user_id <> old.user_id) then
    raise exception 'A workspace needs at least one active Super Admin' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger protect_super_admin before update or delete on public.workspace_members
for each row execute function app.protect_super_admin();

-- ---------- Activity log and notifications ----------
create or replace function public.log_activity(
  p_category public.log_category,
  p_action text,
  p_target_label text default '',
  p_project uuid default null,
  p_idea uuid default null,
  p_event text default null,
  p_quote text default null,
  p_external boolean default false,
  p_target_type text default null,
  p_target_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  ws uuid;
  me_role public.user_role;
  me_label text;
  ext boolean;
  new_id uuid;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_project is not null then
    select workspace_id into ws from public.projects where id = p_project;
  elsif p_idea is not null then
    select workspace_id into ws from public.ideas where id = p_idea;
  else
    select workspace_id into ws from public.workspace_members
    where user_id = uid and status = 'active' order by created_at limit 1;
  end if;
  me_role := app.member_role(ws);
  if me_role is null then raise exception 'Not a member of this workspace' using errcode = '42501'; end if;
  if p_project is not null and not app.has_project_access(p_project) then
    raise exception 'No access to this project' using errcode = '42501';
  end if;
  if p_idea is not null and not app.can_see_idea(p_idea) then
    raise exception 'No access to this idea' using errcode = '42501';
  end if;
  if p_category in ('admin', 'access') and me_role <> 'super_admin' then
    raise exception 'Only a Super Admin can log admin activity' using errcode = '42501';
  end if;
  ext := me_role in ('sponsor', 'client');
  select coalesce(nullif(split_part(full_name, ' ', 1), ''), email) into me_label from public.profiles where id = uid;

  insert into public.activity_log (workspace_id, actor_id, actor_label, category, action, target_type, target_id,
    target_label, project_id, idea_id, source, external_visible)
  values (ws, uid, coalesce(me_label, ''), p_category, p_action,
    coalesce(p_target_type, case when p_project is not null then 'project' when p_idea is not null then 'idea' end),
    coalesce(p_target_id, p_project, p_idea), coalesce(p_target_label, ''), p_project, p_idea,
    case when ext then 'portal' else 'web' end, ext or p_external)
  returning id into new_id;

  if p_event is not null then
    insert into public.notifications (workspace_id, user_id, event, actor_id, actor_label, text, target_label, quote, project_id, idea_id)
    select ws, r.rid, p_event, uid, coalesce(me_label, ''), p_action, coalesce(p_target_label, ''), p_quote, p_project, p_idea
    from (
      select m.user_id as rid from public.workspace_members m
        where m.workspace_id = ws and m.status = 'active' and m.role = 'super_admin'
      union select e.editor_id from public.project_edits e where e.project_id = p_project
      union select t.designer_id from public.project_thumbnails t where t.project_id = p_project
      union select am.user_id from public.account_members am
        join public.accounts a on a.id = am.account_id and a.allow_portal
        where (ext or p_external) and p_project is not null and (
          a.id in (select s.account_id from public.sponsorships s where s.project_id = p_project)
          or a.id in (select c.owner_account_id from public.projects pr join public.channels c on c.id = pr.channel_id where pr.id = p_project))
      union select i.author_id from public.ideas i where i.id = p_idea
      union select am.user_id from public.ideas i
        join public.brand_kits bk on bk.id = i.brand_id
        join public.account_members am on am.account_id = bk.account_id
          or am.account_id = (select c.owner_account_id from public.channels c where c.id = bk.channel_id)
        where i.id = p_idea
    ) r
    where r.rid is not null and r.rid <> uid
      and exists (select 1 from public.workspace_members m2 where m2.workspace_id = ws and m2.user_id = r.rid and m2.status = 'active');
  end if;
  return new_id;
end $$;

-- ---------- Context ----------
create or replace function public.my_context()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', m.user_id,
    'workspace_id', m.workspace_id,
    'workspace_name', w.name,
    'role', m.role,
    'is_owner', m.is_owner,
    'views', m.views,
    'profile', to_jsonb(p),
    'accounts', (
      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'type', a.type,
        'allow_drafts', a.allow_drafts, 'allow_comment', a.allow_comment, 'allow_approve', a.allow_approve) order by a.name), '[]'::jsonb)
      from public.account_members am join public.accounts a on a.id = am.account_id and a.allow_portal
      where am.user_id = m.user_id and a.workspace_id = m.workspace_id),
    'perms', (
      select coalesce(jsonb_agg(jsonb_build_array(rp.resource, rp.action)), '[]'::jsonb)
      from public.role_permissions rp where rp.workspace_id = m.workspace_id and rp.role = m.role and rp.allowed),
    'board', (select to_jsonb(rc) from public.role_board_config rc where rc.workspace_id = m.workspace_id and rc.role = m.role)
  )
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  left join public.profiles p on p.id = m.user_id
  where m.user_id = (select auth.uid()) and m.status = 'active'
  order by m.created_at
  limit 1
$$;

create or replace function public.touch_presence()
returns void
language sql security definer set search_path = '' as $$
  update public.workspace_members set last_active_at = now()
  where user_id = (select auth.uid()) and status = 'active'
$$;

-- ---------- Admin RPCs ----------
create or replace function public.save_permissions(p_map jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare ws uuid; r text;
begin
  select workspace_id into ws from public.workspace_members
  where user_id = (select auth.uid()) and status = 'active' and role = 'super_admin' order by created_at limit 1;
  if ws is null then raise exception 'Only a Super Admin can change permissions' using errcode = '42501'; end if;
  for r in select jsonb_object_keys(p_map) loop
    if r = 'super_admin' then continue; end if;
    delete from public.role_permissions where workspace_id = ws and role = r::public.user_role;
    insert into public.role_permissions (workspace_id, role, resource, action, allowed)
    select ws, r::public.user_role, (x ->> 0)::public.perm_resource, (x ->> 1)::public.perm_action, true
    from jsonb_array_elements(p_map -> r) x
    on conflict do nothing;
  end loop;
end $$;

create or replace function public.invite_member(
  p_email text, p_name text, p_role public.user_role, p_views public.view_kind[], p_account uuid default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare ws uuid; uid uuid := (select auth.uid()); existing uuid;
begin
  select workspace_id into ws from public.workspace_members
  where user_id = uid and status = 'active' and role = 'super_admin' order by created_at limit 1;
  if ws is null then raise exception 'Only a Super Admin can invite people' using errcode = '42501'; end if;
  select id into existing from public.profiles where lower(email) = lower(p_email);
  if existing is not null and exists (select 1 from public.workspace_members where workspace_id = ws and user_id = existing) then
    raise exception 'That email is already on the team' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.invitations where workspace_id = ws and lower(email) = lower(p_email) and accepted_at is null) then
    raise exception 'That email already has a pending invite' using errcode = 'P0001';
  end if;
  if existing is not null then
    insert into public.workspace_members (workspace_id, user_id, role, status, views, invited_by)
    values (ws, existing, p_role, 'active', p_views, uid);
    if p_account is not null then
      insert into public.account_members (account_id, user_id) values (p_account, existing) on conflict do nothing;
    end if;
    return 'added';
  end if;
  insert into public.invitations (workspace_id, email, full_name, role, views, account_id, invited_by)
  values (ws, lower(p_email), coalesce(p_name, ''), p_role, p_views, p_account, uid);
  return 'invited';
end $$;

-- ---------- Sponsor and client portal ----------
create or replace function app.portal_can(acct uuid, p uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.accounts a
    join public.account_members am on am.account_id = a.id and am.user_id = (select auth.uid())
    join public.workspace_members m on m.workspace_id = a.workspace_id and m.user_id = am.user_id and m.status = 'active'
    join public.projects pr on pr.id = p and pr.workspace_id = a.workspace_id and pr.archived_at is null
    left join public.channels c on c.id = pr.channel_id
    where a.id = acct and a.allow_portal
      and (c.owner_account_id = a.id or exists (
        select 1 from public.sponsorships s where s.project_id = pr.id and s.account_id = a.id)))
$$;

create or replace function public.portal_projects(acct uuid)
returns table (
  id uuid, job_code text, title text, status text, stage public.stage, status_sort int,
  film_date date, publish_date date, link_url text, channel text, content_type text,
  sponsorship_id uuid, approval public.approval_status, sponsor text, deliverables text, comment_count int
)
language sql stable security definer set search_path = '' as $$
  select pr.id, pr.job_code, pr.title, st.label, st.stage, st.sort, pr.film_date, pr.publish_date,
         case when a.allow_drafts or st.label = 'Live' then pr.link_url end,
         c.name, ct.label, s.id, s.approval_status, case when s.id is not null then a.name end, s.deliverables,
         (select count(*)::int from public.comments cm where cm.project_id = pr.id and not cm.internal)
  from public.accounts a
  join public.account_members am on am.account_id = a.id and am.user_id = (select auth.uid())
  join public.workspace_members m on m.workspace_id = a.workspace_id and m.user_id = am.user_id and m.status = 'active'
  join public.projects pr on pr.workspace_id = a.workspace_id
  join public.project_statuses st on st.id = pr.status_id
  left join public.channels c on c.id = pr.channel_id
  left join public.content_types ct on ct.id = pr.content_type_id
  left join public.sponsorships s on s.project_id = pr.id and s.account_id = a.id
  where a.id = acct and a.allow_portal and pr.archived_at is null
    and (c.owner_account_id = a.id or s.id is not null)
$$;

create or replace function public.portal_comments(p uuid, acct uuid)
returns table (id uuid, author_id uuid, author_label text, author_role public.user_role, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select cm.id, cm.author_id, coalesce(nullif(split_part(pf.full_name, ' ', 1), ''), 'Team'), wm.role, cm.body, cm.created_at
  from public.comments cm
  join public.projects pr on pr.id = cm.project_id
  left join public.profiles pf on pf.id = cm.author_id
  left join public.workspace_members wm on wm.workspace_id = pr.workspace_id and wm.user_id = cm.author_id
  where cm.project_id = p and not cm.internal and app.portal_can(acct, p)
  order by cm.created_at
$$;

create or replace function public.portal_assets(p uuid, acct uuid)
returns table (id uuid, kind text, name text, storage_path text, external_url text, version int, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select pa.id, pa.kind, pa.name, pa.storage_path, pa.external_url, pa.version, pa.created_at
  from public.project_assets pa
  join public.accounts a on a.id = acct
  where pa.project_id = p and pa.external_visible and (a.allow_drafts or pa.kind = 'final') and app.portal_can(acct, p)
  order by pa.created_at desc
$$;

create or replace function public.portal_add_comment(p uuid, acct uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; ttl text;
begin
  if not app.portal_can(acct, p) then raise exception 'No access to this project' using errcode = '42501'; end if;
  if not exists (select 1 from public.accounts where id = acct and allow_comment) then
    raise exception 'Comments are turned off for this account' using errcode = '42501';
  end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'Write a comment first' using errcode = 'P0001'; end if;
  insert into public.comments (project_id, author_id, body, internal)
  values (p, (select auth.uid()), trim(p_body), false) returning id into new_id;
  select title into ttl from public.projects where id = p;
  perform public.log_activity('project', 'left a comment on', ttl, p, null, 'comment', trim(p_body), true);
  return new_id;
end $$;

create or replace function public.portal_decide_sponsorship(p_sponsorship uuid, p_decision public.approval_status, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare s record; ttl text;
begin
  select sp.*, a.allow_approve, a.allow_portal into s
  from public.sponsorships sp join public.accounts a on a.id = sp.account_id
  where sp.id = p_sponsorship;
  if s.id is null or not exists (
    select 1 from public.account_members am where am.account_id = s.account_id and am.user_id = (select auth.uid())) then
    raise exception 'No access to this sponsorship' using errcode = '42501';
  end if;
  if not s.allow_portal or not s.allow_approve then
    raise exception 'Approvals are turned off for this account' using errcode = '42501';
  end if;
  if p_decision = 'pending' then raise exception 'Pick approve or request changes' using errcode = 'P0001'; end if;
  update public.sponsorships
  set approval_status = p_decision, decided_by = (select auth.uid()), decided_at = now(), decision_note = p_note
  where id = p_sponsorship;
  select title into ttl from public.projects where id = s.project_id;
  perform public.log_activity('approval',
    case when p_decision = 'approved' then 'approved' else 'requested changes on' end,
    ttl, s.project_id, null, 'approval', p_note, true);
end $$;

revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values ('project-assets', 'project-assets', false)
on conflict (id) do nothing;

create policy assets_read on storage.objects for select to authenticated
  using (bucket_id = 'project-assets' and (
    (app.is_internal(app.project_ws(((storage.foldername(name))[2])::uuid)) and app.has_project_access(((storage.foldername(name))[2])::uuid))
    or exists (select 1 from public.project_assets pa
               where pa.storage_path = name and pa.external_visible and app.has_project_access(pa.project_id))));

create policy assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'project-assets'
    and app.is_internal(app.project_ws(((storage.foldername(name))[2])::uuid))
    and app.has_project_access(((storage.foldername(name))[2])::uuid)
    and app.has_perm(app.project_ws(((storage.foldername(name))[2])::uuid), 'assets', 'create'));

create policy assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-assets' and (owner_id = (select auth.uid())::text
    or app.is_admin(app.project_ws(((storage.foldername(name))[2])::uuid))));

-- ---------- Realtime ----------
alter publication supabase_realtime add table
  public.projects, public.project_edits, public.project_thumbnails, public.sponsorships,
  public.comments, public.notifications, public.distribution_tasks;
