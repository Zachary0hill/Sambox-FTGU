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
Dev test logins for every role are listed at the top of `supabase/seed.sql`. Remove them before launch.

## How it fits together

| Path | What it holds |
|---|---|
| `supabase/migrations/` | Schema, RLS, helper functions, guard and workflow triggers, portal RPCs, defaults |
| `supabase/seed.sql` | Dev data mirroring the prototype (projects, people, sponsors, ideas, finance, inbox) |
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

## Invites

Users > Add user saves an invitation. The person signs up at `/login` ("New here") with that email; once the
email is confirmed, the invite is applied (role, views, client or sponsor account). Invite emails are not sent
yet: that needs SMTP or an Edge Function with the secret key.

## Not built yet

- Automation runner (pg_cron + pgmq + Edge Function), integration OAuth, YouTube metrics sync. The
  Automations and Connectors pages store configuration only.
- The Daily assistant answers from board data with the design's rule-based replies, not an LLM.
- Two-step sign in is saved as a preference; TOTP enrollment is not wired.
- Brand kit and template editing, pgTAP and Playwright suites, Vercel deployment.
