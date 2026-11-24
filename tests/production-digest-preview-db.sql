-- Fixture follows the disposable completion database's three QA projects.
begin;
do $$
declare
  ws uuid := '20000000-0000-0000-0000-000000000001';
  a uuid := '30000000-0000-0000-0000-000000000001';
  b uuid := '30000000-0000-0000-0000-000000000002';
  c uuid := '30000000-0000-0000-0000-000000000003';
  snap jsonb;
begin
  insert into public.production_edit_events(workspace_id,project_id,occurred_at,edit_status,active,baseline)
  values (ws,a,'2025-11-01T09:00Z','in_review',true,true),
    (ws,b,'2025-11-02T09:00Z','in_review',true,false),
    (ws,c,'2025-11-01T10:00Z','in_review',true,false),
    (ws,c,'2025-11-02T11:00Z','needs_revision',true,false),
    (ws,c,'2025-11-05T09:00Z','in_review',true,false);
  insert into public.production_edit_events(workspace_id,project_id,occurred_at,edit_status,active,editor_id)
    values(ws,b,'2025-11-03T09:00Z','in_review',true,'10000000-0000-0000-0000-000000000004');
  snap := public.production_digest_snapshot(ws,'2025-11-05T09:00Z','2025-11-06T09:00Z');
  if jsonb_array_length(snap->'rows')<>3 or (snap->>'history_start')::timestamptz<>'2025-11-01T09:00Z'::timestamptz
      or snap#>>'{rows,0,job}'<>'QA-1' or snap#>>'{rows,0,queue_since}' is not null
      or snap#>>'{rows,1,job}'<>'QA-2' or (snap#>>'{rows,1,queue_since}')::timestamptz<>'2025-11-02T09:00Z'::timestamptz
      or snap#>>'{rows,1,editor}'<>'completion-editor2' or (snap#>>'{rows,2,queue_since}')::timestamptz<>'2025-11-05T09:00Z'::timestamptz
     then raise exception 'Wrong queue ages or order: %', snap; end if;
  snap := public.production_digest_snapshot(ws,'2025-10-30','2025-10-31');
  if snap->'rows'<>'[]'::jsonb or snap->>'history_start' is null then raise exception 'Missing historical warning data'; end if;
  if has_function_privilege('authenticated','public.production_digest_snapshot(uuid,timestamptz,timestamptz)','EXECUTE') then raise exception 'Exposed digest aggregate'; end if;
end $$;
rollback;
