# FTGU Production Board

Project content management dashboard for the FTGU YouTube studio. The UI is the "YouTube Studio Unified Board"
design canvas, rebuilt on Next.js and the Supabase project `FromTheGroundUp` (`mupwdvcpymlrnrsnmqfo`).
Each user type (Super Admin, Editor, Designer, Sponsor / Client) gets its own nav, board columns, views and
capabilities, decided by the signed-in member's role. There is no preview switcher.

## Run it

```bash
pnpm install
pnpm dev
```

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`).
There is no demo data. Every page reads the live workspace, and pages with nothing saved yet show an empty state.
New people join through Users > Add user (see Invites below).

## How it fits together

| Path | What it holds |
|---|---|
| `supabase/migrations/` | Schema, RLS, helper functions, guard and workflow triggers, portal RPCs, defaults |
| `components/studio/StudioView.jsx` | The design markup, converted mechanically to JSX. Hand edits are marked `app:` |
| `lib/studio/vals*.js` | The design's view logic, ported to live data |
| `lib/studio/load.js` | Reads everything the member may see. Sponsors and clients read through `portal_*` RPCs |
| `lib/studio/actions.js` | Every write. Runs with the member's session, so RLS and triggers decide what sticks |
| `components/studio/Studio.jsx` | Client shell: session context, URL sync, realtime refresh, toasts |
| `proxy.ts` | Refreshes the Supabase session and sends signed-out visitors to `/login` |

Access control lives in Postgres. The UI mirrors the rules for usability only:

- Editors and designers see only projects they are assigned to (`role_board_config.scope`).
- Column guards stop editors and designers from changing anything but their own status fields.
- Sponsors and clients never read base tables; they get their account's projects, external comments and
  shared files through `portal_projects`, `portal_comments`, `portal_assets`, and decide approvals with
  `portal_decide_sponsorship`.
- Workflow rules from the Workload page (sponsor approval before Scheduled, lock after Live, editors may
  change Status, distribution tasks on Live) are enforced by triggers.
- Roles & Permissions writes `role_permissions`, which RLS reads through `app.has_perm()`.
- A workspace can have any number of Super Admins. Invite someone as Super Admin, or use Make Super Admin on an
  active editor or designer in Users. Only a Super Admin can grant or remove the role, the workspace owner cannot be
  demoted, and the last active Super Admin cannot be removed (`protect_super_admin` trigger).

## Invites

Users > Add user and Resend invite call `/api/invites` and `/api/invites/resend`, the same pattern as
ZZMEDIA-DASHBOARD:

1. The invitation row is saved through `invite_member` on the admin's own session, so RLS checks it.
2. The Supabase admin API mints a one-time token (`generateLink`, type `invite`, or `magiclink` for people who
   already have an account). This needs `SUPABASE_SECRET_KEY` on the server.
3. Resend emails a link to `/auth/setup?token_hash=...`, built from the token hash, never Supabase's own
   action link, so email link scanners cannot use the token up. Template: `lib/email/invite-template.ts`.
4. On `/auth/setup` the person sets a password. Verifying the token confirms their email, and the
   `on_auth_user_confirmed` trigger applies the invite (role, views, client or sponsor account).

Server env: `RESEND_API_KEY`, `EMAIL_FROM` (a sender on a domain verified in Resend; `onboarding@resend.dev`
only delivers to the Resend account owner), `SUPABASE_SECRET_KEY`, and optionally `APP_BASE_URL` for the link.
If the email fails, the invite is still saved and the toast shows Resend's error.

## Email notifications

Database triggers queue emails in `email_outbox` (`supabase/migrations/20261023000200_email_notifications.sql`), one
per recipient, and never for the person who made the change:

| Event | Who gets it |
|---|---|
| Assigned (editor or designer set) | The person assigned |
| Revision (Editor Status or Thumbnail becomes Needs Revision, or a sponsor requests changes) | The editor or designer |
| Review and approval (edit or thumbnail In Review; project moves to Sponsor Review; sponsor decides; edit Approved or thumbnail Done) | Super Admins for reviews and sponsor decisions, the sponsor's approvers for Sponsor Review, the editor or designer when theirs is approved |
| Deadline (edit or thumbnail due tomorrow in the workspace time zone, not finished, project not Live) | The editor or designer, plus an in-app Deadline notification |

`POST /api/notifications/send` (`lib/email/notifications.ts`) queues tomorrow's deadline reminders, then sends what is
waiting through Resend with `lib/email/notification-template.ts`. The board calls it after a change and once per
visit, for the member's own workspace. A scheduler sending `Authorization: Bearer $CRON_SECRET` (POST, or GET for
Vercel Cron) covers every workspace, so reminders and changes made by monday sync go out with nobody signed in: run
it every 15 minutes. Emails older than 48 hours are skipped, failed sends are retried up to 3 times, and each row
keeps its status and error.

People turn their emails off in Settings > My notifications (Email alerts). A Super Admin turns an event off for the
whole workspace in Automations > Settings > Notifications (the Email column). Same env as invites: `RESEND_API_KEY`,
`EMAIL_FROM` on a verified domain, `SUPABASE_SECRET_KEY`, and `APP_BASE_URL` for the links.

## Project files and comments

The project drawer has Overview, Comments, Files and Activity tabs (Widen panel makes it wider). Files and comment
attachments live in the `project-assets` bucket under `<workspace>/<project>/<kind>/` and as `project_assets` rows that
keep the file's `mime_type` and `size_bytes`.

- Files shows every file the role may see as a grid (image previews, type badges for PDF, Word, PowerPoint and
  Markdown) or a list, with search and an All / Images / Documents / Video filter. Add file takes images, video, PDF,
  Markdown, Word and PowerPoint; editors and designers also keep Upload cut and Upload thumbnail. Files dropped on the
  drawer upload. Remove deletes the row and the stored file (the uploader, or anyone with assets delete).
- Comments show the author's name and role. Attach (or drop files on the Comments tab) adds images and documents to
  the next comment; they are saved with `comment_id` and also appear in Files. Attachments on a comment the client can
  see are shared (`external_visible`), and `portal_comments` returns them so sponsors and clients see them too.
- Image previews use signed URLs made at load time (`lib/studio/load.js`), reused for 50 minutes.

## Integrations

Only a Super Admin connects integrations, in Workspace Settings > Integrations. The plan and decisions are in
`docs/integrations-plan.md`.

- Keys go to Supabase Vault through `set_integration_secret`, which checks `app.is_admin` itself. They are never
  stored in table columns or sent back to the browser, which only sees `config.keyHint` (last 4 characters). Only the
  server reads keys (`integration_secret` is granted to `service_role` alone), and each key is checked with a live
  call before it is saved. Disconnect deletes the Vault secret.
- Status and keys change only through those RPCs (`guard_integration` trigger), so the Automations > Connectors tab
  links to Settings instead of toggling.
- Provider code lives in `lib/integrations/providers/<id>.ts` (`verify`, optional `sync`). Every sync is
  `POST /api/integrations/<id>/sync`: the Settings "Sync now" button, or a scheduler sending
  `Authorization: Bearer $CRON_SECRET` to sync every workspace with that provider connected.
- `proxy.ts` lets `/api/*` skip the sign-in redirect; every route authenticates its caller itself.

| Integration | Where it shows | Notes |
|---|---|---|
| Claude, OpenAI, Gemini | Daily | The assistant (`/api/assistant`, AI SDK tool calling) runs its tools on the member's own session, so answers and writes stay within their RLS scope. It searches projects and ideas, plans, answers help questions, and creates projects and ideas after the user confirms. Pick the model per provider and which provider answers. Without a model, Daily keeps the rule-based replies. |
| Firecrawl | Daily, Ideas | Web search and page reading for the assistant and the research agent. |
| monday.com | Projects | Personal API token and board ID; optional status column, status mapping (`monday label=board status`) and job number column. Sync now pulls items into projects (matched by link, then job number), never deletes, and lists unmatched statuses and missing items. Board status changes push to the linked item. With a public `APP_BASE_URL`, Sync now also subscribes monday webhooks (`/api/webhooks/monday`) so monday edits arrive live. |
| Apify, Browserbase | Ideas & Research | Research button (Super Admin): pick a brand, topics, sources and how many ideas. Capped Apify actors (YouTube, TikTok, Reddit, Google), a Browserbase browser on YouTube search, and Firecrawl search gather findings; the workspace's AI model drafts ideas grounded in them, saved as Research drafts with source links. Runs live in `research_runs`, survive a reload and can be cancelled. Needs an AI provider plus at least one source. |
| Slack | Inbox > Messages | Create a Slack app, add bot scopes `channels:read`, `groups:read`, `channels:history`, `groups:history`, `users:read`, `app_mentions:read` (plus `im:history` for DMs, `chat:write` for future alerts), install it, and paste the bot token (`xoxb-`) and signing secret. Invite the bot to channels, then Sync now (first sync: 7 days, 100 messages per channel). For live messages once deployed, enable Event Subscriptions with Request URL `https://<domain>/api/webhooks/slack` and bot events `message.channels`, `message.groups`, `app_mention` (and `message.im`). Messages are visible to Super Admins, editors and designers only. |
| YouTube | Content > Videos | A Google Cloud API key with YouTube Data API v3 enabled (Application restrictions: None or IP addresses) and channel IDs or @handles. Pulls the 200 most recent uploads, then only new ones, with views, likes, comments, duration and thumbnails. Projects whose link matches a video get a metrics snapshot. About 1 quota unit per 50 videos. Retention and impressions need YouTube Analytics OAuth and are not pulled. |
| Buffer | Content > Social | A personal API key (Buffer Settings > API). Pulls channels and sent posts with Buffer's daily post metrics. Buffer's API has no query for comments, mentions or DMs, so none reach the Inbox; `inbox_items` already accepts `source = 'buffer'` for when it does. A sync uses 2 to 6 of the key's API calls (Free plan: 250 a day). **Publishing:** fill in a project's Social post (caption, Buffer channels, queue / right away / Publishing date at a time) in the drawer, and add a workflow with the action Publish to Buffer, for example Status becomes Ready. It posts the newest Final video, else the latest cut, else a Final image, copied to the public `buffer-media` bucket because Buffer fetches media by URL when the post goes out; the copy is removed after Buffer reports the post sent. Each channel posts once per project (`buffer_publications`); a Super Admin can allow it again from the drawer. Instagram, TikTok and YouTube need a video or image (YouTube a video); Pinterest and Google Business are not supported from here. |

Server env: `CRON_SECRET` for scheduled syncs, optional `MONDAY_WEBHOOK_SECRET` (signs monday webhook URLs; falls back
to `SUPABASE_SECRET_KEY`), and `APP_BASE_URL` as a public https URL for monday webhooks.

## Automations

Automations > New automation (or Edit on a workflow card) saves a structured trigger and up to two actions
(`lib/automations/catalog.ts`). Database triggers queue an `automation_runs` row when a live workflow's trigger fires
(status, Editor Status, Thumbnail, Sponsor Approval, a comment that @mentions a Super Admin), and every runner tick also
queues "Publishing date is N days away". `POST /api/automations/run` (`lib/automations/run.ts`) claims due runs and
performs them with the secret key:

| Action | What happens |
|---|---|
| Notify Super Admin in Slack | Posts to the Slack integration's Alerts channel (needs `chat:write`) |
| Email the assigned editor / designer | Emails them through Resend; fails without retrying when nobody is assigned |
| Move Status to the next step | Moves the project one status on, checking sponsor approval and the Live lock itself |
| Create a To-Do for Super Admin | Adds a high-priority To-Do for every active Super Admin |
| Send a webhook to n8n | POSTs the run as JSON to the n8n integration's webhook URL |

Runs keep their input, each step's result and any error (Automations > Run history). Pause all automations stops
queueing and running; Retry failed runs tries twice more, 5 and 10 minutes later, without repeating steps that already
worked; Alert on failures sends Super Admins an in-app alert, an email and (when connected) a Slack message; Test mode
saves new workflows as drafts so Test run can show what they would do first; Run history removes finished runs after
the chosen number of days. The Workload page's workflow rules are separate and run in the database.

## Notifications

The Automations > Settings > Notifications matrix is enforced: In-app off drops that event's notifications (the
`route_notification` trigger), Slack on posts alerts for people who turned Slack alerts on in their Settings (through
`notify_outbox`), and the Email column gates `email_outbox`. In Settings > My notifications, Daily email digest sends
deadlines, publish dates and unread updates from 8 AM in the person's time zone (once a day, `digest_log`), Desktop
push asks the browser for permission and shows system notifications while the board is open, and Quiet hours hold
email and Slack alerts from 7 PM to 8 AM. Two-step sign in enrolls a Supabase Auth TOTP factor; once verified, the
board asks for a code whenever the session has not passed it yet.

## Finance

Finance > Add budget / Add deal / New invoice / Add payout, and Edit on every row, create and change records. Send
invoice and Send reminder email the invoice to its billing contact through Resend (with an optional payment link) and
keep the Resend id or the error on the invoice. Payments are collected outside FTGU: Mark paid and Approve record what
happened, they do not move money.

## Templates

Workspace Settings > Templates creates, edits, duplicates and deletes templates. A project made from a template gets
its steps as a checklist in the drawer's Overview (`project_checklist`); the team ticks steps, Super Admins add and
remove them, and older projects can start one from a template.

## Schedules

Nothing runs on a timer by itself. Point a scheduler (Railway cron, Vercel Cron, pg_cron with pg_net) at these with
`Authorization: Bearer $CRON_SECRET`:

| Endpoint | Suggested interval |
|---|---|
| `POST /api/automations/run` | Every 5 minutes (retries and "N days away" triggers) |
| `POST /api/notifications/send` | Every 15 minutes (emails, Slack alerts, deadline reminders, the 8 AM digest) |
| `POST /api/integrations/<provider>/sync` | Hourly for monday, Slack, YouTube and Buffer, within each provider's quota |

The board also calls the first two after each change and on load, so a workspace with people signed in keeps moving
without the scheduler; unattended reminders, digests and retries need it.

Production runs these with pg_cron + pg_net in Supabase (`supabase/migrations/20261026000200_scheduler.sql`): automations
every 5 minutes, notifications every 15, and the monday, Slack, YouTube and Buffer syncs hourly at :07, :17, :27 and :37.
The jobs read the app URL and `CRON_SECRET` from Vault (`app_base_url`, `cron_secret`); if `CRON_SECRET` changes on
Railway, update the Vault entry too or every tick gets a 401 (`select * from net._http_response` shows them).

## Not built yet

- Google Drive, Gmail and Frame.io connectors (they need OAuth apps), YouTube Analytics retention and impressions,
  uploading straight to YouTube (Buffer can post to a connected YouTube channel), and replying to Slack or Buffer from the Inbox.
- Payment collection and payout transfers (Finance records them; a billing provider would move the money).
- Background desktop push (needs a service worker and push subscription); today's push works while the board is open.
- Research runs still execute inside the request's `after()`; an interrupted run is marked failed (and can be run
  again from the Research dialog) rather than resumed.
- pgTAP and Playwright suites.
