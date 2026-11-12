-- A durable effect journal. An interrupted external effect is held for review, never blindly replayed.
create table public.automation_effects (
 run_id uuid not null references public.automation_runs(id) on delete cascade,
 step_id text not null, status text not null check(status in ('started','done','uncertain')),
 detail text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(run_id,step_id)
);
alter table public.automation_effects enable row level security;
revoke all on public.automation_effects from public,anon,authenticated;
grant all on public.automation_effects to service_role;
alter table public.digest_log add column attempts integer not null default 1,
 add column attempted_at timestamptz not null default now();
create or replace function public.claim_digest(p_user uuid,p_day date) returns boolean
language plpgsql security definer set search_path='' as $$
declare claimed boolean;
begin
 insert into public.digest_log(user_id,day,status,attempts,attempted_at) values(p_user,p_day,'sending',1,now())
 on conflict(user_id,day) do update set status='sending',attempts=public.digest_log.attempts+1,attempted_at=now(),error=null
 where public.digest_log.status in ('failed','sending') and public.digest_log.attempts<3
 and public.digest_log.attempted_at < now()-interval '20 minutes'
 returning true into claimed;
 return coalesce(claimed,false);
end $$;
revoke all on function public.claim_digest(uuid,date) from public,anon,authenticated;
grant execute on function public.claim_digest(uuid,date) to service_role;

create or replace function public.claim_automation_runs(p_ws uuid default null, p_limit int default 25)
returns setof public.automation_runs
language sql security definer set search_path = '' as $$
  update public.automation_runs r set status = 'running', attempts = r.attempts + 1, started_at = now()
  where r.id in (
    select x.id from public.automation_runs x
    where (p_ws is null or x.workspace_id = p_ws)
      and not coalesce((select (s.automation->>'paused')::boolean from public.workspace_settings s where s.workspace_id=x.workspace_id),false)
      and (x.status = 'queued' or (x.status = 'retry' and x.next_attempt_at <= now())
        or (x.status = 'running' and x.started_at < now() - interval '10 minutes'))
    order by x.created_at
    limit p_limit
    for update skip locked
  )
  returning r.*
$$;

