-- RETURNING from UPDATE has no ordering guarantee. Preserve enqueue order for
-- equal transaction timestamps, and keep concurrent dispatchers from claiming
-- another batch for a recipient who already has an in-flight batch.
alter table public.email_outbox add column queue_order bigint generated always as identity;
create index email_outbox_recipient_pending on public.email_outbox(user_id, created_at, queue_order)
  where status in ('queued', 'sending');

create or replace function public.claim_email_outbox(p_ws uuid default null, p_limit int default 50)
returns setof public.email_outbox
language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize only the short claim transaction, never network sends.
  if not pg_try_advisory_xact_lock(524193, 1) then return; end if;
  return query
  with candidates as (
    select x.id from public.email_outbox x
    where (p_ws is null or x.workspace_id = p_ws)
      and (x.status = 'queued' or (x.status = 'sending' and x.claimed_at < now() - interval '10 minutes'))
      and not exists (
        select 1 from public.email_outbox busy
        where busy.user_id = x.user_id and busy.status = 'sending'
          and busy.claimed_at >= now() - interval '10 minutes'
      )
      -- A scoped request must not overtake an older queued email in another workspace.
      and not exists (
        select 1 from public.email_outbox older
        where older.user_id = x.user_id and older.status in ('queued','sending')
          and older.workspace_id <> x.workspace_id
          and (older.created_at, older.queue_order) < (x.created_at, x.queue_order)
          and p_ws is not null
      )
    order by x.created_at, x.queue_order
    limit greatest(0, least(p_limit, 100))
    for update of x skip locked
  ), claimed as (
    update public.email_outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
    where o.id in (select id from candidates)
    returning o.*
  )
  select * from claimed order by created_at, queue_order;
end $$;
revoke execute on function public.claim_email_outbox(uuid, int) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(uuid, int) to service_role;
