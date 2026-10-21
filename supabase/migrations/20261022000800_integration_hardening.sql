-- The connect guard also covers INSERT, so a row cannot be deleted and re-inserted pointing at another Vault secret,
-- and integration_secret only returns the secret named for that workspace and provider.

create or replace function app.guard_integration()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or current_setting('app.integration_rpc', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'disconnected' or new.vault_secret_id is not null or new.connected_by is not null then
      raise exception 'Connect integrations from Workspace Settings' using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status or new.vault_secret_id is distinct from old.vault_secret_id
        or new.connected_by is distinct from old.connected_by then
    raise exception 'Connect and disconnect integrations from Workspace Settings' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_integration on public.integrations;
create trigger guard_integration before insert or update on public.integrations
for each row execute function app.guard_integration();

create or replace function public.integration_secret(p_workspace uuid, p_provider text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select ds.decrypted_secret::jsonb
  from public.integrations i
  join vault.decrypted_secrets ds on ds.id = i.vault_secret_id
  where i.workspace_id = p_workspace and i.provider = p_provider and i.status = 'connected'
    and ds.name = 'integration:' || p_workspace || ':' || p_provider
$$;

revoke execute on function public.integration_secret(uuid, text) from public, anon, authenticated;
grant execute on function public.integration_secret(uuid, text) to service_role;
