-- Preserve source metadata and record every decision. Do not infer status from custom status labels.
create table public.assignment_reconciliation (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, project_id uuid not null,
 field_id uuid not null, original_label text not null, original_value jsonb, canonical_before uuid,
 canonical_after uuid, result text not null, created_at timestamptz not null default now()
);
alter table public.assignment_reconciliation enable row level security;
create policy reconciliation_read on public.assignment_reconciliation for select to authenticated using(app.is_admin(workspace_id));
revoke all on public.assignment_reconciliation from anon,authenticated;
grant select on public.assignment_reconciliation to authenticated;
grant all on public.assignment_reconciliation to service_role;
-- Narrowly suppress historical assignment email triggers within this transaction and table lock.
lock table public.project_edits,public.project_thumbnails in share row exclusive mode;
alter table public.project_edits disable trigger email_on_edit;
alter table public.project_thumbnails disable trigger email_on_thumb;
do $$ declare x record; candidate uuid; existing uuid; outcome text; duplicates int; begin
 for x in select f.id field_id,f.label,f.type,p.id project_id,p.workspace_id,v.value
 from public.custom_fields f join public.project_field_values v on v.field_id=f.id join public.projects p on p.id=v.project_id
 where lower(trim(f.label)) in ('editor','designer') and v.value is not null and v.value<>'null'::jsonb
 loop
 candidate:=null; existing:=null; outcome:='needs_review';
 if lower(trim(x.label))='editor' then select editor_id into existing from public.project_edits where project_id=x.project_id;
 else select designer_id into existing from public.project_thumbnails where project_id=x.project_id; end if;
 select count(*) into duplicates from public.custom_fields f join public.project_field_values v on v.field_id=f.id
 where v.project_id=x.project_id and lower(trim(f.label))=lower(trim(x.label)) and v.value is not null and v.value<>'null'::jsonb;
 if x.type='person' and jsonb_typeof(x.value)='array' and jsonb_array_length(x.value)=1
 and (x.value->>0) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and duplicates=1 then
 candidate:=(x.value->>0)::uuid;
 if not exists(select 1 from public.workspace_members where workspace_id=x.workspace_id and user_id=candidate and status='active'
 and role=case when lower(trim(x.label))='editor' then 'editor'::public.user_role else 'designer'::public.user_role end) then candidate:=null; end if;
 end if;
 if candidate is not null then
 if existing is null then
 if lower(trim(x.label))='editor' then
 insert into public.project_edits(project_id,editor_id) values(x.project_id,candidate) on conflict(project_id) do update set editor_id=excluded.editor_id where public.project_edits.editor_id is null;
 else insert into public.project_thumbnails(project_id,designer_id) values(x.project_id,candidate) on conflict(project_id) do update set designer_id=excluded.designer_id where public.project_thumbnails.designer_id is null; end if;
 if found then outcome:='reconciled'; else outcome:='missing_workflow_row'; end if;
 elsif existing=candidate then outcome:='already_matches'; else outcome:='conflict_preserved'; end if;
 end if;
 insert into public.assignment_reconciliation(workspace_id,project_id,field_id,original_label,original_value,canonical_before,canonical_after,result)
 values(x.workspace_id,x.project_id,x.field_id,x.label,x.value,existing,case when outcome='reconciled' then candidate else existing end,outcome);
 end loop;
end $$;
alter table public.project_edits enable trigger email_on_edit;
alter table public.project_thumbnails enable trigger email_on_thumb;
-- Preserve the fields and all saved filter references. Their new labels make their metadata-only meaning explicit.
update public.custom_fields set label='Legacy '||label,config=config||jsonb_build_object('legacy_workflow_field',lower(trim(label)))
 where lower(trim(label)) in ('editor','designer','status','edit status','editor status','thumbnail status','thumbnail');
-- Reveal actual workflow controls while preserving every other personal layout/filter choice.
update public.board_view_state set state=jsonb_set(state,'{hidden}',coalesce(state->'hidden','{}'::jsonb)||'{"admin:editor":false,"admin:designer":false,"admin:editStatus":false,"admin:thumb":false}'::jsonb)
 where board_role='super_admin';
create function app.reserve_workflow_field_names() returns trigger language plpgsql set search_path='' as $$
begin
 if lower(trim(new.label)) in ('editor','designer','status','edit status','editor status','thumbnail status','thumbnail') then
 raise exception 'This is a workflow field. Show the existing workflow column in Properties, or choose a distinct metadata label.' using errcode='23514';
 end if;
 return new;
end $$;
create trigger reserved_workflow_names before insert or update of label on public.custom_fields for each row execute function app.reserve_workflow_field_names();
