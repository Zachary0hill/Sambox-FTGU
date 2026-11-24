-- Run on the disposable completion database with completion-fixtures.sql and the digest migration applied.
begin;
do $$
declare
  ws uuid := '20000000-0000-0000-0000-000000000001';
  editing uuid := '30000000-0000-0000-0000-000000000001';
  review uuid := '30000000-0000-0000-0000-000000000002';
  start_at timestamptz := clock_timestamp();
  cutoff timestamptz;
  rows jsonb;
begin
  update public.project_edits set edit_status='approved' where project_id=editing;
  update public.project_edits set edit_status='in_review' where project_id=editing;
  update public.project_edits set edit_status='approved' where project_id=editing;
  update public.project_edits set edit_status='in_review' where project_id=review;
  update public.project_edits set edit_status='needs_revision' where project_id=review;
  cutoff := clock_timestamp();
  update public.project_edits set edit_status='in_review' where project_id=review;
  rows := public.production_digest_rows(ws,start_at,cutoff);
  if jsonb_array_length(rows) <> 2
    or not rows @> '[{"bucket":"completed","job":"QA-1","editor":"completion-editor"},{"bucket":"needs_revision","job":"QA-2","editor":"completion-editor2"}]'
  then raise exception 'Unexpected as-of queues: %',rows; end if;

  if public.production_digest_rows(ws,cutoff,clock_timestamp()) <> '[{"job":"QA-2","title":"Completion 2","bucket":"in_review","editor":"completion-editor2"}]'::jsonb
  then raise exception 'An approval carried over to the next window or the review queue was missed'; end if;
  update public.projects set archived_at=now() where id=review;
  if public.production_digest_rows(ws,cutoff,clock_timestamp()) <> '[]' then raise exception 'Archived project leaked into the queue'; end if;
  if public.production_digest_rows(gen_random_uuid(),start_at,cutoff) <> '[]' then raise exception 'Workspace isolation failed'; end if;
  if has_function_privilege('authenticated','public.production_digest_rows(uuid,timestamptz,timestamptz)','EXECUTE')
    or has_table_privilege('authenticated','public.production_digest_deliveries','INSERT') then raise exception 'Client has runner privileges'; end if;
end $$;
rollback;
