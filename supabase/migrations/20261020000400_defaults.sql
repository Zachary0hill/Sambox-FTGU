-- Workspace defaults, and invitations accepted only once the email is confirmed.

create or replace function app.handle_new_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, full_name, email)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)), coalesce(new.email, ''))
    on conflict (id) do nothing;
  end if;
  if new.email_confirmed_at is not null and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    perform app.accept_invitations_for(new.id, coalesce(new.email, ''));
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function app.handle_new_user();
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
for each row execute function app.handle_new_user();

create or replace function app.seed_workspace(ws uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  all_cols text[] := array['project','job','channel','type','film','editor','editStatus','editDue','designer','thumb','thumbDue',
    'sponsor','approval','status','pub','clipping','newsletter','community','distribute','link'];
  r public.user_role;
begin
  insert into public.workspace_settings (workspace_id) values (ws) on conflict do nothing;

  insert into public.project_statuses (workspace_id, label, stage, sort, color_token, is_system) values
    (ws, 'Scripting', 'in_production', 1, 'gray', true),
    (ws, 'Filming', 'in_production', 2, 'coral', true),
    (ws, 'Editing', 'post_production', 3, 'blue', true),
    (ws, 'Sponsor Review', 'post_production', 4, 'violet', true),
    (ws, 'Scheduled', 'publishing', 5, 'pink', true),
    (ws, 'Live', 'publishing', 6, 'green', true)
  on conflict do nothing;

  insert into public.content_types (workspace_id, key, label, color_token, sort) values
    (ws, 'youtube_video', 'YouTube Video', 'coral', 1),
    (ws, 'youtube_live', 'YouTube Live', 'pink', 2),
    (ws, 'shortform', 'Shortform', 'violet', 3)
  on conflict do nothing;

  insert into public.role_board_config (workspace_id, role, columns, views, default_view, scope, card) values
    (ws, 'super_admin', all_cols, '{table,kanban,list,timeline,calendar}', 'table', 'all',
      '{"badges":["status","editStatus","thumb"],"dates":[["film","Film"],["pub","Pub"]],"people":["editor","designer"],"bar":"status"}'),
    (ws, 'editor', array['project','job','channel','type','editor','editStatus','editDue','pub','link'], '{table,kanban,list,timeline}', 'table', 'assigned',
      '{"badges":["editStatus"],"dates":[["editDue","Edit due"],["pub","Pub"]],"people":["editor"],"bar":"editStatus"}'),
    (ws, 'designer', array['project','job','channel','type','designer','thumb','thumbDue','pub'], '{table,kanban,calendar}', 'table', 'assigned',
      '{"badges":["thumb"],"dates":[["thumbDue","Thumb due"],["pub","Pub"]],"people":["designer"],"bar":"thumb"}'),
    (ws, 'sponsor', array['project','status','pub','link'], '{table,calendar}', 'table', 'assigned',
      '{"badges":["status"],"dates":[["pub","Pub"]],"people":[],"bar":"status"}'),
    (ws, 'client', array['project','status','pub','link'], '{table,calendar}', 'table', 'assigned',
      '{"badges":["status"],"dates":[["pub","Pub"]],"people":[],"bar":"status"}')
  on conflict do nothing;

  insert into public.role_permissions (workspace_id, role, resource, action, allowed)
  select ws, x.role::public.user_role, x.res::public.perm_resource, x.act::public.perm_action, true
  from (values
    ('editor','projects','view'), ('editor','edits','view'), ('editor','edits','create'), ('editor','edits','edit'),
    ('editor','thumbs','view'), ('editor','comments','view'), ('editor','comments','create'), ('editor','comments','edit'),
    ('editor','assets','view'), ('editor','assets','create'),
    ('designer','projects','view'), ('designer','thumbs','view'), ('designer','thumbs','create'), ('designer','thumbs','edit'),
    ('designer','comments','view'), ('designer','comments','create'), ('designer','comments','edit'),
    ('designer','assets','view'), ('designer','assets','create'),
    ('sponsor','projects','view'), ('sponsor','edits','view'), ('sponsor','approvals','view'), ('sponsor','approvals','approve'),
    ('sponsor','comments','view'), ('sponsor','comments','create'), ('sponsor','assets','view'),
    ('client','projects','view'), ('client','edits','view'), ('client','approvals','view'),
    ('client','comments','view'), ('client','comments','create'), ('client','assets','view')
  ) as x(role, res, act)
  on conflict do nothing;

  insert into public.custom_fields (workspace_id, label, type, visible_roles, editable_roles, on_board, sort) values
    (ws, 'Sponsor deliverables', 'text', '{super_admin,sponsor,client}', '{super_admin}', false, 1),
    (ws, 'Video length', 'number', '{super_admin,editor}', '{super_admin,editor}', false, 2),
    (ws, 'Script doc', 'url', '{super_admin,editor,designer}', '{super_admin}', false, 3);

  insert into public.templates (workspace_id, content_type_id, name, steps)
  select ws, ct.id, t.name, to_jsonb(t.steps)
  from (values
    ('youtube_video', 'Longform episode', array['Brief','Script draft','Script review','Shot list','Book studio','Film','Raw footage upload',
      'Rough cut','Edit review','Final cut','Thumbnail concepts','Thumbnail final','Sponsor review','Schedule']),
    ('shortform', 'Shorts batch', array['Hook list','Script','Film','Cut','Captions','Cover frame','Review','Schedule']),
    ('youtube_live', 'Live stream', array['Run of show','Guest booking','Overlay design','Tech check','Sponsor read',
      'Go live','Clip highlights','Thumbnail','Upload replay','Distribute'])
  ) as t(key, name, steps)
  join public.content_types ct on ct.workspace_id = ws and ct.key = t.key;

  insert into public.integrations (workspace_id, provider, name, description, tone, status, sort) values
    (ws, 'slack', 'Slack', 'Posts alerts and approvals to your channels.', 'violet', 'disconnected', 1),
    (ws, 'drive', 'Google Drive', 'Creates project folders and stores raw footage.', 'green', 'disconnected', 2),
    (ws, 'youtube', 'YouTube', 'Pulls publish status and live links.', 'red', 'disconnected', 3),
    (ws, 'gmail', 'Gmail', 'Sends sponsor review links and invoices.', 'blue', 'disconnected', 4),
    (ws, 'frame', 'Frame.io', 'Timecoded review on edit drafts.', 'blue', 'disconnected', 5),
    (ws, 'n8n', 'n8n', 'Custom webhooks for any other workflow.', 'coral', 'disconnected', 6)
  on conflict do nothing;
end $$;

revoke execute on function app.seed_workspace(uuid) from public, anon, authenticated;
