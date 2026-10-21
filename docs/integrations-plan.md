# Integrations plan

Super Admin connects third-party services from **Workspace Settings > Integrations** (`/admin/workspace`, Integrations
tab). Keys are stored in Supabase Vault, never in table columns, never sent back to the browser, and only Super Admins
can add, replace or remove them. Everyone else sees status only; the features those keys power (assistant, synced
metrics, Slack messages in the Inbox) work for every role within their normal RLS scope.

## What we are connecting

| # | Service | Key(s) the Super Admin enters | Powers | Page |
|---|---|---|---|---|
| 1 | OpenAI, Google Gemini, Anthropic Claude | API key per provider, model per provider, which provider the assistant uses | AI Daily assistant: answers questions about projects, ideas, deadlines; creates projects and ideas; plans | Daily |
| 2 | monday.com | Personal API token, board ID, status column mapping | Two-way sync of projects and status columns | Projects, Settings |
| 3 | Apify, Browserbase | Apify API token; Browserbase API key + project ID | Research agent that finds content ideas for a brand's niche and saves them as Research ideas | Ideas & Research |
| 4 | Slack | Bot token (`xoxb-`), signing secret, channels to watch | Slack messages and mentions appear in the Inbox | Inbox |
| 5 | YouTube Data API | API key, channel ID(s) | Published videos with views, likes, comments, duration, thumbnails | Content |
| 6 | Buffer | Buffer API key | Post analytics, comments and messages pulled into the dashboard | Content, Inbox |
| 7 | Firecrawl | API key | Web search, scrape and crawl tools for the AI assistant and research agent | Daily, Ideas |

## Decisions (defaults, change any of them)

- **Secrets in Supabase Vault.** `integrations.vault_secret_id` already exists. A Super Admin-only RPC writes the secret
  JSON to Vault; a `service_role`-only RPC reads it back on the server. The browser only ever sees `config.keyHint`
  (last 4 characters).
- **Server routes do all third-party calls.** Route handlers under `app/api/` check the caller with `my_context`, read
  the key with the secret-key client, call the provider, then write results with the caller's session where RLS allows,
  or the secret-key client for system writes (synced metrics, Slack messages).
- **AI layer: Vercel AI SDK.** One tool-calling loop works across OpenAI, Gemini and Claude (`ai`, `@ai-sdk/openai`,
  `@ai-sdk/google`, `@ai-sdk/anthropic`). Each provider card holds a model ID; the workspace picks which provider the
  assistant uses.
- **Assistant writes run as the member.** "Create a project" and "add an idea" tools run on the member's own Supabase
  session, so an editor's assistant cannot do anything the editor could not do by hand.
- **No SDKs for the others.** monday (GraphQL), Slack Web API, YouTube Data API v3, Buffer, Apify, Browserbase and
  Firecrawl are called with `fetch` against their documented REST/GraphQL endpoints. The exception is
  `playwright-core`, which Browserbase sessions need for CDP.
- **Syncs: on demand first, cron-ready.** Every sync is a route handler with a "Sync now" button in Settings. The same
  handlers accept `Authorization: Bearer $CRON_SECRET` so a Vercel Cron or pg_cron job can call them later.
- **Webhooks where the provider pushes.** Slack Events API (`/api/webhooks/slack`, signing-secret verified) and monday
  webhooks (`/api/webhooks/monday`, challenge handshake) need a public URL, so they work once deployed. On localhost the
  pull sync covers the same data.
- **YouTube API key limits.** An API key reads public data: views, likes, comment count, publish date, duration.
  Retention and impressions need YouTube Analytics with OAuth, which is out of scope here. Those columns stay at 0
  until OAuth is added.

## Architecture

```
Workspace Settings > Integrations (Super Admin)
        │  POST /api/integrations/[provider]          save key + config, verify with a live call
        │  DELETE /api/integrations/[provider]        disconnect, delete the Vault secret
        │  POST /api/integrations/[provider]/sync     pull now (monday, Slack, YouTube, Buffer)
        ▼
public.set_integration_secret()  ──►  vault.secrets       (Super Admin session, checked in SQL)
public.integration_secret()      ◄──  server only          (service_role grant only)

lib/integrations/
  registry.ts        provider catalogue: name, group, fields, docs links
  secrets.ts         getIntegration(ws, provider) -> { secret, config } on the server
  auth.ts            requireMember(), requireSuperAdmin() from my_context
  providers/<id>.ts  verify() plus that provider's API client
lib/ai/
  model.ts           workspace's chosen provider + key -> AI SDK model
  tools.ts           assistant tools (board read, create project, add idea, Firecrawl)
```

## Database (migration `20261022000100_integrations.sql`)

- `integrations`: add `last_checked_at`, `last_error`, `last_synced_at`. Writes become Super Admin only
  (`app.is_admin`), reads stay on `automations:view`.
- Seed rows for the new providers: `openai`, `gemini`, `anthropic`, `monday`, `apify`, `browserbase`, `buffer`,
  `firecrawl` (Slack and YouTube rows exist). New workspaces get them through `app.seed_workspace`.
- `workspace_settings.ai_provider` (`openai` | `gemini` | `anthropic` | null).
- RPCs: `set_integration_secret`, `clear_integration_secret` (Super Admin), `integration_secret` (service_role only),
  `mark_integration_checked` (server writes check results).
- Per-feature tables come with each workstream's own migration (see below).

## Workstreams

Each workstream is one subagent. Every agent reads the official API docs online before writing calls and cites the
pages it used at the top of its provider file.

### 0. Foundation (done first, by the lead)
Migration above, `lib/integrations/*`, `lib/ai/model.ts`, the three API routes, and the Integrations tab UI: one card
per provider grouped by purpose, password fields for secrets, key hint, Save & test, Disconnect, Sync now, last
check/error, docs link. The Automations > Connectors tab shows status and links to Settings instead of toggling.

### A. AI assistant + Firecrawl tools (Daily)
- `POST /api/assistant` streams a reply for a thread; stores user and assistant turns in `ai_messages`.
- System prompt carries the member's role and today's date; tools read the board within the member's RLS scope.
- Tools: `search_projects`, `get_project`, `list_ideas`, `create_project`, `add_idea`, `plan_week`,
  `web_search` / `scrape_url` (Firecrawl, only when connected).
- Daily page renders stored assistant replies; the rule-based replies stay as the fallback when no AI key is connected.

### B. monday.com sync (Projects)
- GraphQL `https://api.monday.com/v2`, `API-Version` header, token in `Authorization`.
- Settings: board picker and a map of monday status labels to board statuses.
- Pull: monday items -> projects (match on stored `monday_item_id`). Push: project status changes -> `change_column_value`.
- Table: `projects.monday_item_id`, `integration_links` if more than one board.

### C. Research agent (Ideas & Research)
- "Research" button on the Ideas page: pick a brand, give a niche or seed topics.
- Apify actors (YouTube/TikTok/Reddit/Google search scrapers, chosen from the Apify Store docs) gather what is trending;
  Browserbase browses pages that need a real browser; Firecrawl scrapes articles when connected.
- The workspace's AI model turns findings into idea drafts (title, hook, body, refs) saved as `type = 'research'`.
- Table: `research_runs` (status, inputs, actor run IDs, results, error) so long runs survive a page reload.

### D. Slack -> Inbox
- Pull: `conversations.history` for watched channels; push: Events API `message` / `app_mention`.
- Messages land in `inbox_items` (source `slack`, channel, author, text, permalink, ts) and show in the Inbox as a
  Slack tab next to Notifications and Activity.
- Optional: post board alerts to Slack with `chat.postMessage` (feeds the existing "Notify Super Admin in Slack" automation outcome).

### E. YouTube -> Content
- `search.list` / `playlistItems.list` on the channel's uploads playlist, then `videos.list` (`snippet,statistics,contentDetails`).
- Upsert into `youtube_videos`; match to projects by `link_url` video ID and write `content_metrics` snapshots.
- Content page shows posted videos with thumbnail, views, likes, comments, duration, and a link.

### F. Buffer -> Content + Inbox (after D and E land)
- Verify against Buffer's current developer docs what the API key can read (channels, posts, analytics, comments).
- Post analytics on the Content page; comments and messages into `inbox_items` (source `buffer`).
- Anything the API does not expose is listed in the README as a gap rather than faked.

## Order

1. Foundation (lead) - everything else depends on its tables, RPCs and helpers.
2. A, B, C, D, E in parallel subagents. File ownership keeps them apart; shared files (`vals-pages.js`,
   `StudioView.jsx`, `load.js`, `actions.js`) are edited only inside each agent's own page section.
3. F after D and E, since it extends their Content and Inbox surfaces.
4. Lead review: typecheck, lint, build, apply migrations, run the app, check each page as Super Admin and as an editor.

## Out of scope for this pass

- OAuth flows (YouTube Analytics retention, Slack app install via OAuth). Keys are pasted in by the Super Admin.
- Billing / usage caps per provider beyond each provider's own limits.
- The other existing connector rows (Google Drive, Gmail, Frame.io, n8n) keep their current config-only behaviour.

## Status (2026-10-21)

All seven workstreams are built and their migrations (`20261022000100` to `0900`) are applied to `mupwdvcpymlrnrsnmqfo`.
Typecheck, lint and `next build` pass. No live provider call has run yet: every integration needs its real key pasted
in Settings and a "Save and connect" to prove it end to end.

Changes from the plan, found while building:

- **Assistant writes are proposals.** After the security review, `create_project` and `add_idea` return a card; the
  project or idea is created only when the member clicks its button. `scrape_url` only opens URLs from the user's own
  messages or earlier search results, text written by other people reaches the model marked untrusted, and each
  member gets 30 messages an hour.
- **Buffer has no comments or DMs.** Buffer's GraphQL API exposes channels, sent posts and post metrics only, so
  Buffer shows on Content > Social and nothing from Buffer reaches the Inbox yet.
- **Slack threads.** Thread replies arrive through live events only; the pull sync reads top-level messages.
- **Hardening.** Integration rows cannot be inserted already connected, `integration_secret` only returns the Vault
  secret named for that workspace and provider, and only a Super Admin or the server can link a project to monday.
- **Scheduling.** `/api/integrations/<id>/sync` accepts GET or POST with `Authorization: Bearer $CRON_SECRET`; no
  schedule is configured yet.
