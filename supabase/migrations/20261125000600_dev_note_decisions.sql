-- One append-only review history per original Dev Note. Legacy resolution remains independent.
create table public.dev_note_decision_events (
  note_id uuid not null references public.dev_notes(id) on delete cascade,
  revision integer not null check (revision > 0),
  request_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  topic text not null check (topic in ('mentions','revisions','job_codes','duplicates','ideas_nav','manager_import')),
  reviewer_id uuid not null,
  project_id uuid,
  action text not null check (action in ('assign','answer','ready','accept','reopen')),
  state text not null check (state in ('needs_decision','ready_to_try','accepted')),
  comment text not null check (length(comment) <= 2000),
  actor_id uuid not null,
  actor_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (note_id,revision),
  unique (note_id,request_id)
);
create index dev_note_decisions_workspace on public.dev_note_decision_events(workspace_id,note_id,revision desc);
alter table public.dev_note_decision_events enable row level security;
revoke all on public.dev_note_decision_events from public,anon,authenticated;
grant select on public.dev_note_decision_events to authenticated;
create policy decision_read on public.dev_note_decision_events for select to authenticated using (
  app.mfa_satisfied() and exists (select 1 from public.dev_notes n where n.id=note_id)
);
create function public.record_dev_note_decision(
  p_note uuid, p_revision integer, p_request uuid, p_action text, p_comment text default '',
  p_topic text default null, p_reviewer uuid default null, p_project uuid default null
) returns public.dev_note_decision_events
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  n public.dev_notes;
  prev public.dev_note_decision_events;
  event public.dev_note_decision_events;
  admin boolean;
  message text := btrim(coalesce(p_comment,''));
begin
  if uid is null or not app.mfa_satisfied() then raise insufficient_privilege; end if;
  select * into n from public.dev_notes where id=p_note for update;
  admin := app.is_admin(n.workspace_id);
  if n.id is null or not coalesce(admin or (n.created_by=uid and app.is_internal(n.workspace_id)),false) then raise insufficient_privilege; end if;
  select * into event from public.dev_note_decision_events where note_id=p_note and request_id=p_request;
  if found then
    if event.actor_id<>uid or event.action is distinct from p_action or event.comment<>message
       or (p_action='assign' and (event.topic is distinct from p_topic or event.reviewer_id is distinct from p_reviewer or event.project_id is distinct from p_project))
       then raise exception 'This request already belongs to another decision.'; end if;
    return event;
  end if;
  select * into prev from public.dev_note_decision_events where note_id=p_note order by revision desc limit 1;
  if p_revision is distinct from coalesce(prev.revision,0) then raise exception 'This decision changed. Refresh it before trying again.'; end if;
  if p_request is null or p_action is null or p_action not in ('assign','answer','ready','accept','reopen') or length(message)>2000 then raise exception 'Invalid decision request.'; end if;
  if prev.note_id is null and p_action<>'assign' then raise exception 'Assign the decision first.'; end if;
  event := prev;
  event.state := coalesce(prev.state,'needs_decision');
  if p_action='assign' then
    if not admin then raise insufficient_privilege; end if;
    if prev.state='accepted' then raise exception 'Reopen the decision before changing its assignment.'; end if;
    if prev.topic is not null and p_topic is distinct from prev.topic then raise exception 'This note already has a decision topic.'; end if;
    if not exists (select 1 from public.workspace_members m where m.workspace_id=n.workspace_id and m.user_id=p_reviewer and m.status='active'
        and (m.role='super_admin' or (m.role in ('manager','editor','designer') and m.user_id=n.created_by))) then raise exception 'Choose an active reviewer with access to this note.'; end if;
    if p_project is not null and not exists (select 1 from public.projects p where p.id=p_project and p.workspace_id=n.workspace_id and p.archived_at is null) then raise exception 'Choose an active project from this workspace.'; end if;
    event.topic := p_topic; event.reviewer_id := p_reviewer; event.project_id := p_project; event.state := 'needs_decision';
  elsif p_action='answer' then
    if uid<>prev.reviewer_id then raise insufficient_privilege; end if;
    if prev.state<>'needs_decision' or message='' then raise exception 'A decision needs a written answer or a selected choice.'; end if;
  elsif p_action='ready' then
    if not admin then raise insufficient_privilege; end if;
    if prev.state<>'needs_decision' or prev.action<>'answer' then raise exception 'Record the assigned reviewer’s answer before marking this ready.'; end if;
    event.state := 'ready_to_try';
  elsif p_action='accept' then
    if uid<>prev.reviewer_id then raise insufficient_privilege; end if;
    if prev.state<>'ready_to_try' or message='' then raise exception 'Try the change and enter an acceptance comment or example.'; end if;
    event.state := 'accepted';
  else
    if not admin and uid<>prev.reviewer_id then raise insufficient_privilege; end if;
    if prev.state='needs_decision' or message='' then raise exception 'Give a reason for reopening this decision.'; end if;
    event.state := 'needs_decision';
  end if;
  insert into public.dev_note_decision_events(note_id,revision,request_id,workspace_id,topic,reviewer_id,project_id,action,state,comment,actor_id,actor_name)
    values(n.id,p_revision+1,p_request,n.workspace_id,event.topic,event.reviewer_id,event.project_id,p_action,event.state,message,uid,
      coalesce((select coalesce(nullif(full_name,''),email) from public.profiles where id=uid),'Team member'))
    returning * into event;
  return event;
end $$;
revoke all on function public.record_dev_note_decision(uuid,integer,uuid,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.record_dev_note_decision(uuid,integer,uuid,text,text,text,uuid,uuid) to authenticated;
alter publication supabase_realtime add table public.dev_note_decision_events;
