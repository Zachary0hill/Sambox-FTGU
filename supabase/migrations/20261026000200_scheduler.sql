-- Scheduler: pg_cron calls the app's scheduled endpoints with pg_net (README "Schedules").
--   every 5 minutes   POST /api/automations/run        retries and "N days away" triggers
--   every 15 minutes  POST /api/notifications/send     emails, Slack alerts, deadline reminders, the 8 AM digest
--   hourly            POST /api/integrations/<provider>/sync for monday, Slack, YouTube and Buffer, staggered
--                     10 minutes apart so no two long syncs overlap
-- The routes accept `Authorization: Bearer $CRON_SECRET` and then cover every workspace; a sync skips workspaces
-- where that provider is not connected.
--
-- The URL and secret live in Vault, not here: create them once per project (values from the Railway service):
--   select vault.create_secret('<APP_BASE_URL>', 'app_base_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- Until both exist, each tick logs a warning and does nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function app.cron_call(p_path text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare base text; secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if coalesce(base, '') = '' or coalesce(secret, '') = '' then
    raise warning 'cron_call %: app_base_url or cron_secret is missing from Vault', p_path;
    return null;
  end if;
  -- pg_net sends in the background; the long timeout only keeps the response row for a slow sync.
  return net.http_post(
    url := rtrim(base, '/') || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 290000
  );
end $$;
revoke execute on function app.cron_call(text) from public, anon, authenticated;

-- cron.schedule replaces a job with the same name, so this file can run again safely.
select cron.schedule('ftgu-automations', '*/5 * * * *', $$select app.cron_call('/api/automations/run')$$);
select cron.schedule('ftgu-notifications', '*/15 * * * *', $$select app.cron_call('/api/notifications/send')$$);
select cron.schedule('ftgu-sync-monday', '7 * * * *', $$select app.cron_call('/api/integrations/monday/sync')$$);
select cron.schedule('ftgu-sync-slack', '17 * * * *', $$select app.cron_call('/api/integrations/slack/sync')$$);
select cron.schedule('ftgu-sync-youtube', '27 * * * *', $$select app.cron_call('/api/integrations/youtube/sync')$$);
select cron.schedule('ftgu-sync-buffer', '37 * * * *', $$select app.cron_call('/api/integrations/buffer/sync')$$);
-- pg_cron keeps every run's details forever; keep a week.
select cron.schedule('ftgu-cron-cleanup', '30 3 * * *', $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
