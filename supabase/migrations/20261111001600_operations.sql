create table public.worker_health (
 job text not null, scope text not null, started_at timestamptz, finished_at timestamptz,
 last_success_at timestamptz, status text not null, error text, primary key(job,scope)
);
alter table public.worker_health enable row level security;
revoke all on public.worker_health from public,anon,authenticated;
grant all on public.worker_health to service_role;
