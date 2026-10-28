-- vidIQ (MCP server, read-only API key) joins the integration catalogue for new and existing workspaces.

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
    (ws, 'vidiq', 'vidIQ', 'YouTube research and channel data for the assistant and research agent.', 'red', 33),
    (ws, 'slack', 'Slack', 'Brings Slack messages and mentions into the Inbox.', 'violet', 40),
    (ws, 'youtube', 'YouTube', 'Pulls published videos and their views, likes and comments.', 'red', 50),
    (ws, 'buffer', 'Buffer', 'Pulls post analytics, comments and messages from your social channels.', 'blue', 51)
  on conflict (workspace_id, provider) do update
    set name = excluded.name, description = excluded.description, tone = excluded.tone, sort = excluded.sort;
end $$;

do $$
declare w uuid;
begin
  for w in select id from public.workspaces loop
    perform app.seed_integrations(w);
  end loop;
end $$;
