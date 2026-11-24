-- A revision is always a draft. Applying one replaces the definition of the existing live
-- workflow in a transaction, preserving the trigger identity and run history.
alter table public.automations
  add column revision_source_id uuid,
  add column revision_baseline jsonb,
  add column revision_applied_at timestamptz,
  add constraint automation_revision_draft check (revision_source_id is null or is_draft);

create function app.workflow_definition(a public.automations) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('flow',a.flow,'trigger',a.trigger,'actions',a.actions,'conditions',a.conditions,
                            'category',a.category,'name',a.name,'enabled',a.enabled,'is_draft',a.is_draft)
$$;
create function app.guard_workflow_revision() returns trigger language plpgsql set search_path='' as $$
declare source public.automations;
begin
  if tg_op='INSERT' then
    new.revision_baseline := null;
    new.revision_applied_at := null;
    if new.revision_source_id is not null then
      select * into source from public.automations where id=new.revision_source_id and workspace_id=new.workspace_id
        and enabled and not is_draft for share;
      if not found then raise exception 'Choose a live workflow in this studio to revise.'; end if;
      new.revision_baseline := app.workflow_definition(source);
    end if;
  else
    if old.revision_source_id is distinct from new.revision_source_id or old.revision_baseline is distinct from new.revision_baseline
       or (old.revision_source_id is not null and (old.workspace_id<>new.workspace_id or old.revision_applied_at is not null))
       or (old.revision_applied_at is distinct from new.revision_applied_at and current_user in ('authenticated','anon')) then
      raise exception 'The workflow revision origin and applied record are read-only.';
    end if;
  end if;
  return new;
end $$;
create trigger guard_workflow_revision before insert or update on public.automations
  for each row execute function app.guard_workflow_revision();

create function public.apply_workflow_revision(p_revision uuid,p_expected_flow jsonb,p_changes jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare draft public.automations; source public.automations;
begin
  select * into draft from public.automations where id=p_revision and app.is_admin(workspace_id)
    and app.mfa_satisfied() and revision_source_id is not null for update;
  if not found then raise exception 'This revision is unavailable.' using errcode='42501'; end if;
  select * into source from public.automations where id=draft.revision_source_id and workspace_id=draft.workspace_id for update;
  if not found then raise exception 'The original workflow was deleted. Create a new draft.'; end if;
  if draft.revision_applied_at is not null then return source.id; end if;
  if draft.flow is distinct from p_expected_flow then raise exception 'This draft changed. Reload and review it again.'; end if;
  if app.workflow_definition(source) is distinct from draft.revision_baseline then
    raise exception 'The live workflow changed. Start a revision from its current version.';
  end if;
  if p_changes#>>'{flow,kind}' is distinct from 'automation' or p_changes#>>'{flow,lastTest,ok}' is distinct from 'true' then
    raise exception 'Test this automation before applying its revision.';
  end if;
  if exists(select 1 from public.automation_runs where automation_id=source.id and not is_test and status in ('queued','running','waiting','retry')) then
    raise exception 'The live workflow has unfinished runs. Let them finish before applying this revision.';
  end if;
  update public.automations set flow=p_changes->'flow',"trigger"=p_changes->'trigger',actions=p_changes->'actions',
    category=p_changes->>'category',when_text=p_changes->>'when_text',then_text=p_changes->>'then_text',app=p_changes->>'app',
    revision_applied_at=clock_timestamp() where id=draft.id returning * into draft;
  update public.automations set flow=draft.flow, "trigger"=draft."trigger", actions=draft.actions, category=draft.category,
    when_text=draft.when_text, then_text=draft.then_text, app=draft.app, updated_at=clock_timestamp()
    where id=source.id;
  return source.id;
end $$;
revoke all on function public.apply_workflow_revision(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.apply_workflow_revision(uuid,jsonb,jsonb) to authenticated;
