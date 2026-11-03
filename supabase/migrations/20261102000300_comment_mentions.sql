-- @mentions in project comments. The composer inserts "@Full Name"; a trigger reads the body and stores who that
-- resolves to in comments.mentions, so the column can't be set by hand and a mention only ever reaches someone who can
-- read that comment. Newly mentioned people get an in-app notification and an email (event 'mention').

alter table public.comments add column if not exists mentions uuid[] not null default '{}';

-- The name a mention is written with. lib/studio/vals.js builds the same label for the chips.
create or replace function app.mention_label(p public.profiles)
returns text
language sql stable set search_path = '' as $$
  select coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1))
$$;

-- Could this person read a comment on this project? Mirrors has_project_access and cm_select for someone other than
-- the caller. Sponsors and clients only ever see comments that are not internal (portal_comments).
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
      or (m.role in ('editor', 'designer')
        and exists (select 1 from public.role_permissions rp
          where rp.workspace_id = pr.workspace_id and rp.role = m.role and rp.resource = 'comments' and rp.action = 'view' and rp.allowed)
        and (rc.scope = 'all'
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

-- Who the @ picker offers on a project. external people can only be reached by a comment that is not internal.
create or replace function public.mention_candidates(p uuid)
returns table (id uuid, label text, role public.user_role, account text, external boolean)
language sql stable security definer set search_path = '' as $$
  select pf.id, app.mention_label(pf), m.role,
    (select a.name from public.account_members am join public.accounts a on a.id = am.account_id
     where am.user_id = pf.id and a.workspace_id = m.workspace_id order by a.name limit 1),
    m.role in ('sponsor', 'client')
  from public.projects pr
  join public.workspace_members m on m.workspace_id = pr.workspace_id and m.status = 'active'
  join public.profiles pf on pf.id = m.user_id
  where pr.id = p and pf.id <> (select auth.uid())
    and app.is_internal(pr.workspace_id) and app.has_perm(pr.workspace_id, 'comments', 'create') and app.has_project_access(p)
    and app.can_mention(p, pf.id, false)
  order by m.role in ('sponsor', 'client'), 2
$$;
revoke execute on function public.mention_candidates(uuid) from public, anon;
grant execute on function public.mention_candidates(uuid) to authenticated;

-- Runs on every write, so comments.mentions always comes from the body. Not preceded or followed by a letter or number:
-- an email address is not a mention, and @Sam Hill does not match @Sam Hillary.
create or replace function app.comment_mentions()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.mentions := '{}';
  if position('@' in new.body) = 0 then return new; end if;
  select coalesce(array_agg(pf.id), '{}') into new.mentions
  from public.projects pr
  join public.workspace_members m on m.workspace_id = pr.workspace_id and m.status = 'active'
  join public.profiles pf on pf.id = m.user_id
  where pr.id = new.project_id and pf.id is distinct from new.author_id
    and new.body ~* ('(^|[^[:alnum:]])@' || regexp_replace(app.mention_label(pf), '([^[:alnum:][:space:]])', '\\\1', 'g') || '($|[^[:alnum:]])')
    and app.can_mention(new.project_id, pf.id, new.internal);
  return new;
end $$;
drop trigger if exists comment_mentions on public.comments;
create trigger comment_mentions before insert or update on public.comments
for each row execute function app.comment_mentions();

-- One notification and one email per newly mentioned person. An edit only reaches people it adds.
create or replace function app.notify_comment_mentions()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := app.open_project_ws(new.project_id);
  who text;
  ttl text;
  uid uuid;
begin
  if ws is null then return new; end if;
  select coalesce(nullif(split_part(full_name, ' ', 1), ''), split_part(email, '@', 1)) into who from public.profiles where id = new.author_id;
  select title into ttl from public.projects where id = new.project_id;
  for uid in
    select x from unnest(new.mentions) x
    where tg_op = 'INSERT' or not (x = any (old.mentions))
  loop
    insert into public.notifications (workspace_id, user_id, event, actor_id, actor_label, text, target_label, quote, project_id)
    values (ws, uid, 'mention', new.author_id, coalesce(who, ''), 'mentioned you on', coalesce(ttl, ''), new.body, new.project_id);
    perform app.queue_email(ws, uid, 'mention', 'comment_mention', new.project_id, jsonb_build_object('note', left(new.body, 600)));
  end loop;
  return new;
end $$;
drop trigger if exists notify_comment_mentions on public.comments;
create trigger notify_comment_mentions after insert or update on public.comments
for each row execute function app.notify_comment_mentions();

alter table public.email_outbox drop constraint if exists email_outbox_event_check;
alter table public.email_outbox add constraint email_outbox_event_check check (event in ('assigned', 'revision', 'approval', 'due', 'mention'));

-- Mentions get their own row in the notification matrix: on for the app, email and Slack unless turned off.
create or replace function app.notify_key(ev text)
returns text
language sql immutable set search_path = '' as $$
  select case ev when 'assign' then 'assigned' when 'deadline' then 'due' when 'status' then 'status'
    when 'comment' then 'comment' when 'approval' then 'approval' when 'revision' then 'revision' when 'mention' then 'mention' else null end
$$;

create or replace function app.notify_on(ws uuid, ev text, ch text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (s.notify_defaults ->> (app.notify_key(ev) || ':' || ch))::boolean from public.workspace_settings s where s.workspace_id = ws),
    case ch
      when 'app' then true
      when 'slack' then app.notify_key(ev) in ('assigned', 'revision', 'status', 'due', 'mention')
      else false end,
    true)
$$;

-- Same as before, plus: someone mentioned in a comment gets the mention, not a second "commented on" for it.
-- log_activity adds the comment notifications just after the insert that added the mention.
create or replace function app.route_notification()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event = 'comment' and exists (
    select 1 from public.notifications n
    where n.user_id = new.user_id and n.project_id = new.project_id and n.event = 'mention'
      and n.quote is not distinct from new.quote and n.created_at > now() - interval '2 minutes') then
    return null;
  end if;
  if app.notify_key(new.event) is not null
     and app.notify_on(new.workspace_id, new.event, 'slack')
     and exists (select 1 from public.integrations g where g.workspace_id = new.workspace_id and g.provider = 'slack' and g.status = 'connected')
     and exists (select 1 from public.profiles p where p.id = new.user_id and coalesce((p.prefs -> 'myN' ->> 'slack')::boolean, false)) then
    insert into public.notify_outbox (workspace_id, user_id, channel, event, actor_label, text, target_label, quote, project_id)
    values (new.workspace_id, new.user_id, 'slack', new.event, new.actor_label, new.text, new.target_label, new.quote, new.project_id);
  end if;
  if app.notify_key(new.event) is not null and not app.notify_on(new.workspace_id, new.event, 'app') then
    return null;
  end if;
  return new;
end $$;

revoke execute on function app.mention_label(public.profiles), app.can_mention(uuid, uuid, boolean), app.comment_mentions(), app.notify_comment_mentions() from public, anon, authenticated;
