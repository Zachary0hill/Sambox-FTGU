alter table public.workspace_settings drop constraint if exists workspace_settings_ai_provider_check;
alter table public.workspace_settings add constraint workspace_settings_ai_provider_check
  check(ai_provider in ('openai','gemini','anthropic','xai'));
insert into public.integrations(workspace_id,provider,name,description,tone,sort)
select id,'xai','Grok','xAI models for the Daily assistant and research agent.','gray',35
from public.workspaces on conflict(workspace_id,provider) do nothing;
create or replace function app.seed_grok_workspace() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.integrations(workspace_id,provider,name,description,tone,sort)
 values(new.id,'xai','Grok','xAI models for the Daily assistant and research agent.','gray',35)
 on conflict(workspace_id,provider) do nothing;
 return new;
end $$;
create trigger seed_grok_workspace after insert on public.workspaces for each row execute function app.seed_grok_workspace();
revoke all on function app.seed_grok_workspace() from public,anon,authenticated;
