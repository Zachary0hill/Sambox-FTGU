-- Status options (database components handoff, step 4; data model change 3).
--
-- notify_sponsor: setting this status logs to the sponsor portal (log_activity p_external). Until now the board did
--   that for Sponsor Review, Scheduled and Live by name, so those start on.
-- editors_can_set: editors may move a project to this status, where the workspace lets editors change status at all
--   (workspace_settings.editors_change_status, unchanged). Every existing status starts on so nothing an editor can
--   do today stops working; statuses added from now on start off.
-- workspace_settings.default_status_id: the status new projects start in ("Default for new projects"). Empty means
--   the first status by sort, as before.
--
-- Built-in statuses (is_system) keep their name and group and cannot be deleted: triggers and emails look up Live,
-- Scheduled and Sponsor Review by label, and the project drawer steps through the built-in statuses in order.

alter table public.project_statuses
  add column if not exists notify_sponsor boolean not null default false,
  add column if not exists editors_can_set boolean not null default false;

update public.project_statuses set notify_sponsor = true where is_system and label in ('Sponsor Review', 'Scheduled', 'Live');
update public.project_statuses set editors_can_set = true;

alter table public.workspace_settings
  add column if not exists default_status_id uuid references public.project_statuses(id) on delete set null;

create or replace function app.guard_status()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- New workspaces' built-in statuses start like the existing ones.
    if new.is_system then
      new.editors_can_set := true;
      new.notify_sponsor := new.label in ('Sponsor Review', 'Scheduled', 'Live');
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- A workspace being deleted takes its statuses with it.
    if old.is_system and exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
      raise exception 'Built-in statuses cannot be deleted.' using errcode = '42501';
    end if;
    return old;
  end if;
  if new.is_system is distinct from old.is_system then
    raise exception 'A status cannot become or stop being built in.' using errcode = '42501';
  end if;
  if old.is_system and (new.label, new.stage) is distinct from (old.label, old.stage) then
    raise exception 'Built-in statuses keep their name and group.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_status on public.project_statuses;
create trigger guard_status before insert or update or delete on public.project_statuses
for each row execute function app.guard_status();

-- Same as before, plus: editors can only move a project to a status marked editors_can_set.
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
    if new.status_id is distinct from old.status_id
       and not coalesce((select st.editors_can_set from public.project_statuses st where st.id = new.status_id), false) then
      raise exception 'Editors cannot move projects to %. Ask a Super Admin.', app.status_label(new.status_id) using errcode = '42501';
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

revoke execute on function app.guard_status() from public, anon;
