-- Integration keys live in Supabase Vault. Only a Super Admin can write or remove them, and only the server
-- (service_role) can read them back. The browser sees status, non-secret config and config.keyHint only.

alter table public.integrations
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_error text,
  add column if not exists last_synced_at timestamptz;

alter table public.workspace_settings
  add column if not exists ai_provider text check (ai_provider in ('openai','gemini','anthropic'));

-- Reads stay on automations:view (status only). Writes are Super Admin only.
drop policy if exists auto_insert on public.integrations;
drop policy if exists auto_update on public.integrations;
drop policy if exists auto_delete on public.integrations;
create policy integ_insert on public.integrations for insert to authenticated with check ((select app.is_admin(workspace_id)));
create policy integ_update on public.integrations for update to authenticated using ((select app.is_admin(workspace_id)));
create policy integ_delete on public.integrations for delete to authenticated using ((select app.is_admin(workspace_id)));

-- Status, vault_secret_id and connected_by change only through the RPCs below.
create or replace function app.guard_integration()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and current_setting('app.integration_rpc', true) is distinct from 'on'
     and (new.status is distinct from old.status or new.vault_secret_id is distinct from old.vault_secret_id
          or new.connected_by is distinct from old.connected_by) then
    raise exception 'Connect and disconnect integrations from Workspace Settings' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_integration on public.integrations;
create trigger guard_integration before update on public.integrations
for each row execute function app.guard_integration();

-- ---------- Catalogue ----------
create or replace function app.seed_integrations(ws uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.integrations (workspace_id, provider, name, description, tone, sort) values
    (ws, 'anthropic', 'Claude', 'Anthropic models for the Daily assistant and research agent.', 'coral', 10),
    (ws, 'openai', 'OpenAI', 'GPT models for the Daily assistant and research agent.', 'green', 11),
    (ws, 'gemini', 'Gemini', 'Google Gemini models for the Daily assistant and research agent.', 'blue', 12),
    (ws, 'monday', 'monday.com', 'Syncs projects and status columns with a monday board.', 'amber', 20),
    (ws, 'apify', 'Apify', 'Runs scrapers that find trending content for a brand''s niche.', 'green', 30),
    (ws, 'browserbase', 'Browserbase', 'Cloud browsers the research agent uses for pages that need one.', 'violet', 31),
    (ws, 'firecrawl', 'Firecrawl', 'Web search and scraping tools for the assistant and research agent.', 'coral', 32),
    (ws, 'slack', 'Slack', 'Brings Slack messages and mentions into the Inbox.', 'violet', 40),
    (ws, 'youtube', 'YouTube', 'Pulls published videos and their views, likes and comments.', 'red', 50),
    (ws, 'buffer', 'Buffer', 'Pulls post analytics, comments and messages from your social channels.', 'blue', 51)
  on conflict (workspace_id, provider) do update
    set name = excluded.name, description = excluded.description, tone = excluded.tone, sort = excluded.sort;
end $$;

revoke execute on function app.seed_integrations(uuid) from public, anon, authenticated;

create or replace function app.seed_integrations_trigger()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.seed_integrations(new.id);
  return new;
end $$;

drop trigger if exists seed_integrations on public.workspaces;
create trigger seed_integrations after insert on public.workspaces
for each row execute function app.seed_integrations_trigger();

do $$
declare w uuid;
begin
  for w in select id from public.workspaces loop
    perform app.seed_integrations(w);
  end loop;
end $$;

-- ---------- Secrets ----------
-- Saves the provider's secret JSON (e.g. {"apiKey": "..."}) to Vault and marks the integration connected.
-- Runs on the Super Admin's own session; the check is here, not in the caller.
create or replace function public.set_integration_secret(p_workspace uuid, p_provider text, p_secret jsonb, p_hint text, p_config jsonb default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  cur public.integrations;
  sid uuid;
begin
  if not app.is_admin(p_workspace) then
    raise exception 'Only a Super Admin can connect integrations' using errcode = '42501';
  end if;
  select * into cur from public.integrations where workspace_id = p_workspace and provider = p_provider for update;
  if not found then
    raise exception 'Unknown integration %', p_provider using errcode = 'P0002';
  end if;
  if p_secret is not null then
    select id into sid from vault.secrets
     where id = cur.vault_secret_id or name = 'integration:' || p_workspace || ':' || p_provider
     order by (id = cur.vault_secret_id) desc nulls last limit 1;
    if sid is not null then
      perform vault.update_secret(sid, p_secret::text);
    else
      sid := vault.create_secret(p_secret::text, 'integration:' || p_workspace || ':' || p_provider, p_provider || ' key for workspace ' || p_workspace);
    end if;
  else
    sid := cur.vault_secret_id;
  end if;
  if sid is null then
    raise exception 'Add a key before saving %', cur.name using errcode = '22023';
  end if;
  perform set_config('app.integration_rpc', 'on', true);
  update public.integrations
     set vault_secret_id = sid, status = 'connected', connected_by = (select auth.uid()),
         config = (coalesce(p_config, config) - 'keyHint')
                  || jsonb_strip_nulls(jsonb_build_object('keyHint', coalesce(to_jsonb(p_hint), cur.config -> 'keyHint'))),
         last_error = null
   where workspace_id = p_workspace and provider = p_provider;
  perform set_config('app.integration_rpc', 'off', true);
end $$;

create or replace function public.clear_integration_secret(p_workspace uuid, p_provider text)
returns void
language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  if not app.is_admin(p_workspace) then
    raise exception 'Only a Super Admin can disconnect integrations' using errcode = '42501';
  end if;
  select vault_secret_id into sid from public.integrations where workspace_id = p_workspace and provider = p_provider for update;
  perform set_config('app.integration_rpc', 'on', true);
  update public.integrations
     set vault_secret_id = null, status = 'disconnected', connected_by = null, config = config - 'keyHint',
         last_error = null, last_checked_at = null
   where workspace_id = p_workspace and provider = p_provider;
  perform set_config('app.integration_rpc', 'off', true);
  if sid is not null then
    delete from vault.secrets where id = sid;
  end if;
end $$;

revoke execute on function public.set_integration_secret(uuid, text, jsonb, text, jsonb) from public, anon;
revoke execute on function public.clear_integration_secret(uuid, text) from public, anon;
grant execute on function public.set_integration_secret(uuid, text, jsonb, text, jsonb) to authenticated;
grant execute on function public.clear_integration_secret(uuid, text) to authenticated;

-- Server only: the decrypted secret JSON, or null when the integration is not connected.
create or replace function public.integration_secret(p_workspace uuid, p_provider text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select ds.decrypted_secret::jsonb
  from public.integrations i
  join vault.decrypted_secrets ds on ds.id = i.vault_secret_id
  where i.workspace_id = p_workspace and i.provider = p_provider and i.status = 'connected'
$$;

revoke execute on function public.integration_secret(uuid, text) from public, anon, authenticated;
grant execute on function public.integration_secret(uuid, text) to service_role;

-- Server only: record the outcome of a verify or sync call.
create or replace function public.mark_integration_checked(p_workspace uuid, p_provider text, p_error text default null, p_synced boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.integrations
     set last_checked_at = now(), last_error = p_error,
         last_synced_at = case when p_synced and p_error is null then now() else last_synced_at end
   where workspace_id = p_workspace and provider = p_provider;
end $$;

revoke execute on function public.mark_integration_checked(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.mark_integration_checked(uuid, text, text, boolean) to service_role;
