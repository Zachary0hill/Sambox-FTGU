-- Preserve the exact rendered message for subsequent previews of confirmed sends.
alter table public.production_digest_deliveries add column snapshot jsonb;
create index production_edit_workspace_time on public.production_edit_events(workspace_id, occurred_at);

create function public.production_digest_snapshot(p_ws uuid, p_start timestamptz, p_cutoff timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with board as (
    select * from jsonb_to_recordset(public.production_digest_rows(p_ws,p_start,p_cutoff))
      as r(bucket text, job text, title text, editor text)
  ), aged as (
    select b.*, case when not entry.baseline then entry.occurred_at end as queue_since
    from board b
    join public.projects p on p.workspace_id=p_ws and p.job_code=b.job
    left join lateral (
      select e.occurred_at, e.id from public.production_edit_events e
      where e.workspace_id=p_ws and e.project_id=p.id and e.occurred_at<=p_cutoff
        and b.bucket <> 'completed' and (not e.active or e.edit_status::text is distinct from b.bucket)
      order by e.occurred_at desc,e.id desc limit 1
    ) prior on true
    left join lateral (
      select e.occurred_at, e.baseline from public.production_edit_events e
      where e.workspace_id=p_ws and e.project_id=p.id and e.occurred_at<=p_cutoff
        and b.bucket <> 'completed' and e.active and e.edit_status::text=b.bucket
        and (prior.id is null or (e.occurred_at,e.id)>(prior.occurred_at,prior.id))
      order by e.occurred_at,e.id limit 1
    ) entry on true
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(a) order by a.queue_since nulls first, a.title, a.job) from aged a),'[]'::jsonb),
    'history_start',(select min(occurred_at) from public.production_edit_events where workspace_id=p_ws)
  );
$$;
revoke all on function public.production_digest_snapshot(uuid,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.production_digest_snapshot(uuid,timestamptz,timestamptz) to service_role;
