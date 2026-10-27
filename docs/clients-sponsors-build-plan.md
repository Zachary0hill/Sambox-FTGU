# Clients & Sponsors: build plan

Goal: an admin can add a client or sponsor, link its projects, send a portal invite that actually arrives, and see an honest status from "Not invited" through to "Active".

## What's already there

- Tables: `accounts`, `account_members`, `sponsorships`, `invitations` ([schema](../supabase/migrations/20261020000100_schema.sql))
- Invite route `POST /api/invites` → the `invite_member` function → `deliverInvite` (Resend)
- When someone accepts an invite, their account changes from `invited` to `active` ([triggers](../supabase/migrations/20261020000300_triggers_rpcs.sql))
- Portal functions: `portal_projects`, `portal_comments`, `portal_assets`, `portal_add_comment`, `portal_decide_sponsorship`
- The page UI: list, filters, stats, access toggles, Send/Resend invite, Remove ([vals-admin.js](../lib/studio/vals-admin.js), [actions.js](../lib/studio/actions.js))

## Gaps found

| # | Gap | Effect | Where |
|---|-----|--------|-------|
| G1 | The contact email can only be entered in the Add account dialog | Accounts created from **Brand** have no email, and "Send portal invite" only shows "Add a contact email first" with nowhere to add it | `addBrand` ~actions.js:1421; panel in vals-admin.js:238 |
| G2 | The Portal badge shows **Invited** when no invite exists | A new account defaults to `invited`, and Brand-created accounts are `off` + `allow_portal=true`, which `portalOf` turns into "Invited" | vals-admin.js:208, actions.js:692/1422 |
| G3 | Projects can't be linked from the account panel | Admins have to open each project and set Sponsor | panel "Projects" section |
| G4 | Project counts match by name (`r.sponsor === a.name`) | Renaming breaks the link | vals-admin.js:209 |
| G5 | Nothing warns when the email sender is Resend's test sender (`@resend.dev`) | Invites silently go nowhere | `lib/email/send.ts` |
| G6 | The account name and type can't be edited after creation | Typos mean deleting the account and adding it again | panel header |

## Phase 0: Configuration (no code, do first)

1. **Resend:** verify a sending domain (add its DNS records), then set `EMAIL_FROM="FTGU Studio <studio@yourdomain.com>"` in `.env.local` and in production.
2. **Amplify env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL` (the live origin), `CRON_SECRET`.
3. **Supabase Auth → URL Configuration:** set Site URL to the live domain; add `<domain>/auth/callback` and `<domain>/auth/invite/*` to the redirect allow-list.
4. **Roles & Permissions:** set the board views for the Sponsor and Client roles (the fallback is table only).
5. **Workflow settings:** decide on "Require sponsor approval"; tick "Notify sponsor" on the Sponsor Review status (and any others the portal should report).

Done when: a test invite to an outside address arrives, and the link signs the person in on the live domain.

## Phase 1: Unblock invites (G1, G2)

1. **Editable account details in the panel**
   - Make the name, contact email and type inline-editable under the header (the existing `updateAccount` already accepts any patch).
   - Validate the email with the same regex as `addAccount`, and keep names unique (catch the `unique (workspace_id, name)` violation and show "That name is taken").
   - Changing type from sponsor to client creates the owned channel and brand kit, the same as `addAccount`. Changing from client to sponsor needs a confirmation and leaves the channel unowned.
2. **Honest portal status**
   - Work out the label from the data, not just the `portal_status` column:
     - `allow_portal = false` → **Off**
     - an `account_members` row exists, or `portal_status = 'active'` → **Active**
     - a pending `invitations` row for the account → **Invited**
     - otherwise → **Not invited** (gray)
   - Migration: change the default to `portal_status default 'off'`, and backfill `invited` to `off` wherever no invitation row exists for the account.
   - Update the "invites pending" stat to count real pending invitations.
3. **Add account dialog:** add a "Send portal invite now" checkbox (on by default) that calls `invitePortalContact` after the insert.

Done when: an account created from Brand shows "Not invited", you can add an email in the panel, and Send flips it to Invited.

## Phase 2: Link projects from the account (G3, G4)

1. **Link by id:** have `projOf` match on `sponsorAccountId === a.id`, plus channels where `owner_account_id === a.id`, instead of by name.
2. **"Link project" control** in the panel's Projects section (sponsors only):
   - A searchable dropdown of projects that don't have a sponsorship with this account.
   - Inserts a `sponsorships` row and logs "linked … to".
   - Each linked row gets an unlink (×) that deletes the sponsorship, with a confirmation if `approval_status` is not `pending`.
3. **Clients:** show "Projects on the <channel> channel" with a link to the board filtered by that channel. No per-project linking.
4. **Per-sponsorship detail** on each linked row: approval badge (Pending / Approved / Changes requested) and a deliverables preview, so admins can see what's awaiting the sponsor.

Done when: you can link and unlink a sponsor and its projects without leaving the page, and the counts survive a rename.

## Phase 3: Email health (G5)

1. Add `GET /api/email/health` (Super Admin only), returning `{ configured, sandboxSender }`. `sandboxSender` is true when `EMAIL_FROM` ends in `@resend.dev`.
2. On Clients & Sponsors and Users, show a banner when it's sandboxed: "Invite emails only reach the Resend account owner until a sending domain is verified." Point it at the Copy link fallback.
3. After sending, if `emailSent=false`, the toast shows the Resend error, and the row offers **Copy invite link**.

## Phase 4: QA

- **Signed in as Super Admin:**
  - Add a sponsor, link 2 projects, send the invite, then check that the badge reads Invited and the stats update.
  - Rename the account and check the projects stay linked.
  - Turn off Portal access and check the badge reads Off and the Send button hides.
- **Signed in as the sponsor:**
  - Accept the invite, then check the account turns Active and the portal shows only those 2 projects.
  - Comments and approvals work only when their toggles are on; turning them off hides the actions.
- **Signed in as a client:** sees every project on their channel and no approval controls.
- Run the `zz-qa` pass on `/admin/clients` at desktop and mobile widths.

## Order and size

| Phase | Size | Depends on |
|-------|------|-----------|
| 0 Config | ~1 hr (DNS can take time to update) | — |
| 1 Unblock invites | M (UI + 1 migration) | — |
| 2 Project linking | M | 1 (uses the editable panel layout) |
| 3 Email health | S | — |
| 4 QA | S | 0–3 |

Phases 0, 1 and 3 can run in parallel. Phase 2 comes after Phase 1.
