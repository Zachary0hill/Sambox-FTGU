# Editor and Designer Email Onboarding — Build Plan

Date: November 5, 2026
Status: Core release deployed and live-verified; readiness follow-up adds explicit personal queues, configuration diagnostics, real-inbox checks, and authentication callback fixes. Recipient-controlled acceptance remains tracked below.

## Outcome

A Super Admin can invite an editor or designer by email, see whether delivery and account setup succeeded, recover a failed invitation, and know when the person has reached the correct dashboard. New members understand their role and what to do even when no work has been assigned.

This plan follows a source review of the invitation routes, authentication forms, member management UI, and database migrations. The original findings below are historical. Current release evidence and remaining acceptance items are recorded at the end of this document.

## Existing behavior to preserve

- Super Admins invite members from Users with name, email, role, and allowed board views.
- Resend sends invitation emails; Supabase generates authentication tokens.
- New users set a password. Existing users can use a sign-in link.
- Email tokens are verified on form submission, not page load, to avoid consumption by link scanners.
- Pending invitations support resend, copied fallback links, and removal.
- Editor and designer project visibility defaults to assigned work, with configurable role scope.
- Database permissions restrict updates; UI hiding alone is not an authorization boundary.
- Editors upload cuts and submit edits for review; designers upload thumbnails and submit designs for review.
- Password reset and sign-in emails use Supabase Auth configuration, separately from application invite delivery.

## Scope and boundaries

Implement recovery, delivery visibility, onboarding guidance, configuration diagnostics, and focused tests. Preserve existing accounts, assignments, role settings, and sponsor/client behavior on shared routes. Do not grant broader access to make onboarding easier.

Bulk invitations, automatic assignments, new approval workflows, and a general product-tour system are outside this release. Existing-account membership may continue to become active immediately; clearly distinguish membership access from email delivery and onboarding completion.

Before implementation, read the relevant installed Next.js guides under `node_modules/next/dist/docs/`, as required by AGENTS.md. Confirm the production hosting target and applied migrations rather than assuming the older Amplify setup guide is current.

## Phase 1 — Recoverable authentication and password setup

Priority: P1. Complete before expanding the welcome experience.

### Problem

`SetupForm` verifies the one-time token and then saves the password. If password saving fails, retrying verifies an already-used token. Email confirmation can also mark the invitation accepted before password setup succeeds, removing the pending-invite resend action.

### Build

- Model setup as explicit states: token awaiting verification, verified session, password pending, complete, and recoverable failure.
- After successful verification, retry password saving using the verified session without re-verifying the token.
- Support refresh during incomplete setup through a server-validated setup context tied to the authenticated user. Do not infer setup ownership solely from an arbitrary existing browser session or client flags.
- Keep invite, existing-user sign-in, and password-recovery flows distinct. Never change another signed-in user's password when an invite belongs to a different identity.
- Provide useful recovery for expired tokens, lost sessions, and password-policy rejection. Offer sign-in or password reset where appropriate instead of always directing users to resend an already-accepted invitation.
- Constrain token types and return destinations. Remove sensitive authentication parameters from browser history after successful exchange where feasible; never persist tokens in delivery records or logs.
- Confirm the backend transition that applies membership. Keep “email confirmed,” “membership active,” and “onboarding completed” separate rather than changing `accepted_at` to imply all three.

### Acceptance criteria

- A rejected password or transient save failure can be corrected without a new invite while the verified session remains valid.
- Refreshing an incomplete flow either resumes safely or provides a working recovery path.
- Opening an email URL without submitting does not consume its token.
- Used, expired, canceled, and wrong-session links never grant unintended workspace access.
- A completed user can sign out and sign back in using their new password.

Primary files: `app/auth/setup/SetupForm.tsx`, `app/auth/setup/page.tsx`, `app/auth/callback/route.ts`, `app/api/invites/accept/route.ts`, and authentication-related migrations.

## Phase 2 — Delivery records and reliable resend

Priority: P1. Depends on the recovery contract in Phase 1.

### Problems

- Existing accounts become active immediately and have no pending invitation to resend if delivery fails.
- Failed and expired invitations appear as “Invited.” Delivery errors are primarily transient toast messages.
- Resend timestamps update before sending succeeds.
- `deliverInvite` falls back to a magic link for any invite-generation error, not just a confirmed existing-account condition.

### Build

- Add an append-only delivery-attempt table linked to workspace and recipient, with optional invitation/member references. It must support both new-user invites and existing-member access emails.
- Record purpose, actor, attempt time, provider message ID, submission result, delivery events, and a safe error summary. Do not store authentication URLs, tokens, API keys, or raw provider payloads containing sensitive data.
- Track membership and delivery separately. Display pending/expired/accepted access state alongside queued/submitted/delivered/failed/bounced delivery state. Historical attempts without evidence remain “Unknown,” not “Delivered.”
- Persist provider acceptance before showing “Email sent.” Reserve “Delivered” for a verified provider delivery event; it does not prove the recipient read the email.
- Add a Super Admin action to send a fresh access email to an existing active editor/designer. Derive email and role from trusted records; do not let this endpoint alter permissions or reactivate deactivated users.
- Keep pending-invite resend, but record attempted and successful send times separately. Define invitation renewal separately from token expiry; the 14-day invitation window does not guarantee a 14-day Supabase email token.
- Only use an existing-user fallback for a verified existing-account condition. Preserve unrelated authentication-service errors for diagnosis.
- Add authenticated authorization checks, workspace scoping, resend cooldowns, and duplicate-request protection on the server. Disable repeated submission in the UI while a request is in flight.
- Add a signature-verified Resend webhook for delivery/bounce/failure events. Deduplicate events and handle out-of-order arrivals without incorrectly reversing delivery state. Do not automatically resend bounced mail.
- Ensure cancellation and deletion semantics remain correct. Delivery history must not resurrect access, and late webhook events must not recreate canceled invitations.
- Keep Copy link available for pending invitations. Report renewal failures accurately and test that canceled links cannot activate membership.

### Acceptance criteria

- Failed sends remain visible after reload with a clear retry action.
- An existing member whose email failed can receive a fresh sign-in email without removal or role changes.
- Expired invitations are visibly expired, with a working renewal action.
- Repeated clicks do not create multiple uncontrolled sends.
- Invalid webhook signatures and cross-workspace resend requests are rejected.
- Duplicate or delayed provider events produce consistent status.

Primary files: `lib/email/invite.ts`, `lib/email/send.ts`, `app/api/invites/route.ts`, `app/api/invites/resend/route.ts`, `lib/studio/actions.js`, `lib/studio/load.js`, `lib/studio/vals.js`; new migration and webhook/access-email routes.

## Phase 3 — Role-specific first login

Priority: P2. Depends on reliable setup completion.

### Build

- Add a short welcome experience showing workspace, member name, role, and the next action.
- For editors, explain assigned edits, draft uploads, review submission, and revisions. For designers, explain assigned designs, thumbnail uploads, review submission, and revisions.
- Use actual workspace permissions and enabled views when presenting instructions. Do not promise actions that administrators disabled.
- Link directly to the member's queue and available brand resources.
- When no work is assigned, show “Your account is ready. Your team will assign work here,” with a practical contact instruction using available workspace information.
- Distinguish no assignments from filters hiding existing work and from missing workspace access.
- Persist completion per user/workspace and onboarding version, separately from invitation acceptance. Allow dismissal and reopening from Help or Settings.
- Avoid forcing the new welcome experience on every existing user. Roll out automatically to new editor/designer members and make it available voluntarily to current members.
- Show admins a truthful “Has not visited” or “Onboarding incomplete” indicator where reliable data supports it; do not equate an email open with dashboard use.

### Acceptance criteria

- Each role receives accurate guidance and lands in its own allowed dashboard.
- A new user with zero assignments understands that setup succeeded.
- Welcome completion survives refresh and a second device sign-in.
- The experience works on mobile and with keyboard navigation, accessible labels, focus handling, and readable errors.
- No changes to assignment visibility, financial access, administrator access, or existing role defaults occur as a side effect.

Primary files: `components/studio/Studio.jsx`, `lib/studio/vals.js`, `lib/studio/load.js`, relevant Settings/Help UI, and a migration for onboarding progress.

## Phase 4 — Production email readiness and operational guidance

Priority: P1 for delivery prerequisites; P2 for richer diagnostics. Read-only configuration checks can begin alongside Phase 1.

### Build

- Validate the canonical production `APP_BASE_URL`, HTTPS, sender address, API credentials, and verified sending-domain status using provider capabilities available to the deployed key.
- Report “Configured but unverified” when permissions prevent domain verification; missing diagnostics permission must not be described as failed delivery.
- Keep health endpoints Super Admin-only and redact secrets and provider internals.
- Check Supabase Site URL, allowed redirects, SMTP configuration, and templates separately from Resend application sends.
- Verify actual Supabase token lifetime and password policy; align UI wording with those settings.
- Update `docs/email-setup.md` for the confirmed deployment platform, current brand, configuration ownership, recovery steps, and delivery-status meanings.
- Document that assignment/revision notifications need the notification dispatcher and scheduler. Verify those independently from direct invite emails.
- Provide an explicit test-email action or documented test procedure targeting a designated test inbox. Do not send to real collaborators during implementation without an explicit send instruction.

### Acceptance criteria

- Admins can distinguish missing configuration, an unverified diagnostic, provider submission failure, bounce, and confirmed delivery.
- Invite and recovery links use the correct production domain.
- Application invites and Supabase password-reset emails both pass designated-inbox tests.
- Operational documentation reflects the verified hosting/configuration state.

## Verification matrix

| Scenario | Required result |
|---|---|
| Brand-new editor and designer | Email → safe setup → correct queue → password login succeeds |
| Existing account added to workspace | Access email opens the correct workspace; failed send remains retryable |
| Resend before first acceptance | Supported new-user path completes without accidentally skipping needed password setup |
| Password rejection after verification | Same verified user can retry without consuming the token again |
| Refresh or lost session during setup | Resume safely or offer working recovery |
| Expired, used, or canceled link | Clear guidance; no unintended membership activation |
| Wrong account already signed in | No password or membership change to the wrong identity |
| Provider failure and bounce | Persistent accurate state; deliberate retry only |
| Duplicate request/webhook | Idempotent behavior and consistent status |
| Non-admin or different workspace request | Server/database deny the operation |
| No assignments versus active filters | Distinct, helpful empty states |
| Editor/design capability boundaries | Own permitted updates succeed; forbidden assignments, due dates, and admin operations fail |
| Deactivated or removed member | Access remains denied; resend does not restore it |
| Sponsor/client regression | Shared invitation and recovery flows continue to work |
| Forgot password and later login | Correct redirect and successful recovery through Supabase mail |

Use focused unit tests for state transitions and delivery handling, database integration tests for authorization, and browser tests for the complete setup path. Add a minimal test runner only if the repository still has no applicable harness. Run lint, TypeScript checks, and the production build. Read-only page checks or mocked provider success do not count as inbox delivery or live acceptance.

## Implementation sequence and release

1. Confirm current schema, installed framework guidance, deployment target, and available test harness. Capture baseline behavior with dedicated test identities.
2. Implement and verify recoverable password setup.
3. Apply additive delivery schema and authorization policies; implement resend/access-email and webhook handling.
4. Connect durable delivery state to Users, preserving existing membership behavior.
5. Implement the versioned editor/designer welcome and empty states.
6. Complete diagnostics and update email setup documentation.
7. Run the verification matrix locally or in staging, including role authorization and shared portal regressions.
8. Apply compatible production migrations, deploy the application, configure webhook delivery, and run authorized designated-inbox acceptance tests for both roles.
9. Record local, CI, staging, and production results separately with commit, migration versions, and outstanding limitations.

Use additive migrations and backward-compatible readers during rollout. Roll back application changes without deleting memberships or delivery history. New welcome UI should be independently disableable if needed. Leave historical invitations intact; do not backfill successful delivery or completed onboarding without evidence.

## Definition of done

- [x] Password setup survives recoverable failures and refresh without identity confusion.
- [x] New and existing users have reliable email recovery/resend paths.
- [x] Admins see persistent, accurate delivery and expiration status.
- [x] Editors and designers receive useful first-login guidance and empty states.
- [x] Permissions remain enforced by server/database checks.
- [ ] Production invite and recovery email configuration is verified.
- [ ] Both roles pass designated-inbox, first-login, assignment, and subsequent-login tests.
- [x] Documentation and verification evidence distinguish implemented behavior from live proof.


## Implementation log — November 5, 2026

First slice implemented locally:

- Added `/api/auth/setup` with explicit resume, verification, and password-save operations.
- Resume never consumes an email token. Password retries reuse a signed, HTTP-only, one-hour setup context tied to the verified user, authentication session, and invite-token digest.
- Password save requires both that setup context and a valid matching Supabase user. Ordinary sessions, changed identities, different invite tokens, expired contexts, and cross-origin requests are rejected.
- Setup removes authentication parameters from the visible URL after verification, supports refresh via the setup cookie, and exposes password-recovery guidance after failure.
- Successful password saving clears the setup context. No database migration is required for this slice.

Verification: three Node tests cover proof expiry/tampering, endpoint retry/resume behavior, and identity/origin rejection. A local Chrome test with mocked setup responses passed three password-save attempts across retry and refresh with a single token verification. TypeScript and the production build passed; focused application lint had no errors and one existing logo-image warning. The final full repository lint run passed with 0 errors and 20 warnings.

Run with Node 22 or newer:

```sh
node --test tests/invite-setup.test.cjs
pnpm build
pnpm exec next start -p 3107
# In a separate terminal, with Google Chrome installed at the default macOS path:
node tests/invite-setup-browser.cjs
```

The browser check mocks the setup endpoint; it does not prove live Supabase acceptance, real email delivery, or production cookie behavior. End-to-end new-user acceptance, canceled/expired invites, and production configuration still require verification. At the end of that first slice, delivery persistence/resend expansion, role welcome, and readiness diagnostics remained pending; see the following implementation log for subsequent work. No production deployment, email sends, or membership changes were performed in this slice.

## Implementation log — delivery, resend, and welcome

Implemented locally after the initial recovery slice:

- Added persistent delivery attempts, minimal signed-webhook events, and an admin-only latest-attempt view. Status survives reload and is separate from membership state. Realtime delivery updates are published when the Supabase realtime publication exists.
- Added transactional per-recipient cooldowns and conservative reconciliation for duplicate/out-of-order events, including delivery events arriving before the send response is saved.
- Added **Send access email** for active editor/designer members, including those with accepted invitations. The server derives identity/role from the workspace member, rejects deactivated and out-of-workspace recipients, and does not change access.
- Displayed expired invitations, persistent email state, and welcome progress in Users. Resend timestamps now reflect successful submission; copying a fallback link stops if renewal fails. Invitation submission has an in-flight UI guard.
- Limited authentication fallback to existing-account errors. Unconfirmed users still receive password setup when replacement links use magic-link verification.
- Added a role-specific full-page welcome, permission-aware upload/review instructions, no-assignment guidance, queue/available-brand-resource actions, persisted completion/dismissal, and reopening from Settings. Existing memberships are not automatically enrolled.
- Added a missing-webhook diagnostic and deployment/configuration instructions in `docs/email-setup.md`.

Verification includes Node tests for delivery handling, real SDK signature verification, authorization rejection, and role welcome rendering; a disposable local PostgreSQL migration test for cooldowns, workspace authorization, RLS, ordering/deduplication, and persisted welcome progress; and a mobile-width Chrome component test for save failure/retry, completion, reopening, designer content, and dismissal across remount. The browser uses the actual component with mocked persistence, not a live Supabase account.

Additional test commands:

```sh
node --test tests/invite-setup.test.cjs tests/onboarding-delivery.test.cjs
node tests/welcome-browser.cjs
# Only against a fresh disposable local PostgreSQL database (creates fixture schemas/roles):
psql "$ONBOARDING_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/onboarding-db.sql
```

### Historical release prerequisites (resolved in the production release except noted acceptance checks)

1. Apply `20261105000100_member_onboarding_delivery.sql` to the target database before deploying the application.
2. Configure the signed Resend webhook and `RESEND_WEBHOOK_SECRET`; confirm sender/domain, canonical URL, and Supabase SMTP/redirect settings on the actual hosting target.
3. Run designated-inbox acceptance for editor and designer, including subsequent password login and password recovery. Verify cancellation, removed-member access, and sponsor/client regressions against the actual deployed auth/database configuration.
4. Confirm CI and live verification separately. No production migrations, deploys, or emails have been performed by this implementation.

At the end of local implementation, Phase 4 provider-domain verification and live operational checks remained pending. See the current readiness log below. The presence of an API key or webhook secret is configuration evidence only, not proof of domain readiness or delivery.

Final local checks for this increment: production build/TypeScript passed; full lint passed with 0 errors and 20 warnings; all 9 Node tests passed; isolated PostgreSQL migration checks passed; mobile welcome browser checks passed; production-build setup browser regression passed, including replacement magic-link password setup. The local test servers/database were stopped after verification.

## Current readiness follow-up — November 5, 2026

Completed production release: migration `20261105195804`, signed Resend webhook, canonical Railway APP_BASE_URL, invite/resend/cooldown, both role welcomes, saved completion/dismissal, and subsequent password login (disposable simulator accounts). Initial release `90b5690`; welcome fix `5bc0199`.

Follow-up implementation:
- Explicit Assigned to me queue matches the role's assignment by user ID. Welcome entry clears obstructing search/unread/view filters for the visit without overwriting saved view preferences.
- Admin email diagnostics distinguish verified, unverified, and unavailable domain verification, validate the canonical HTTPS origin, and identify Supabase Auth as a separate verification path.
- Authentication return paths reject external/protocol-relative/backslash destinations. Railway callbacks use the configured public origin.
- Production SQL rollback tests verify role boundaries, review updates, asset metadata, expired/canceled invitation handling, deactivation/replay denial, and client acceptance/removal without lasting fixtures or messages.
- Real Gmail inbox checks confirmed editor access and Supabase reset delivery with SPF/DKIM/DMARC passing. Designer invitation has provider delivery confirmation.
- Supabase Site URL and redirect allowlist were corrected after finding localhost recovery redirects. A replacement email contains the canonical callback.
- Notification scheduler and Vault URL verified; recent idle dispatch HTTP responses are 200 with no failures.
- Email operations guide now identifies Railway and separates provider delivery, inbox placement, authentication, and notification evidence.

Remaining recipient-controlled or full-workflow acceptance:
- [x] Designer accepted the invitation, set a password, and completed welcome onboarding (2026-11-05 20:40 UTC).
- [ ] Designer recipient confirms Inbox/Spam placement for invitation and workflow notifications.
- [ ] Recipient completes password recovery and subsequent login; existing passwords are never changed by unattended testing.
- [x] Authenticated production API checks: real MP4/PNG storage uploads and byte-identical downloads, review → revision → replacement upload → resubmission → approval for both roles, revision comments/replies, reviewer signed previews, and denied anonymous downloads/deadline changes.
- [x] Deployed notification dispatcher: 10/10 sends, all Delivered in Resend; editor and reviewer Gmail Inbox placement verified.
- [x] Production browser file-picker uploads, previews, review submissions, revision comments, replacement uploads, resubmissions, and authenticated email-to-project destinations for both roles.
- [x] Desktop and 390×844 responsive browser checks: welcome, assigned queue, all five layouts, Settings reopening/dismissal, persisted progress. Mobile Account navigation repaired.
- [x] Signed-out notification destinations preserve project and comments-tab query parameters through the login redirect.
- [x] Live responsive mobile browser acceptance at 390×844 for both roles.
- [ ] Physical iOS/Android and representative large-file uploads; responsive browser checks do not exercise device-specific pickers or network interruptions.

These are acceptance checks, not evidence of a known remaining implementation failure. Do not label the entire original verification matrix complete solely from delivery events or rollback SQL tests.

Production email OTP lifetime was inspected in Supabase: 3,600 seconds. Invitation record expiry is separate. No password-policy setting was changed.


### Live workflow verification — 2026-11-05 20:51 UTC

See [the workflow verification report](onboarding-workflow-verification-2026-11-05.md) for scope, evidence, cleanup, and remaining acceptance. No application code or deployment changed in this verification run.


### Ordering and browser follow-up — 2026-11-05

- `fc7d85f`: ordered outbox claims, deterministic ties, overlapping recipient batch protection, and retry deferral; production migration applied.
- `133b7c9`: Account Settings stays reachable in compact mobile navigation.
- `6af1bae`: signed-out project email links retain their full destination through login.
- 19 automated tests passed; production build and focused lint passed (existing StudioView warnings remain). Production rollback SQL verifies equal timestamps, batch boundaries, in-flight exclusion, and stale-claim recovery.
- Same-timestamp live regression sent assignment → revision → approval in order at 21:22:52.834, 21:22:53.555, and 21:22:54.340 UTC. Mailbox delivery/display order is controlled downstream and cannot be guaranteed by the sender.
- Desktop and mobile browser workflow evidence is recorded in the linked verification report. Recipient password-reset completion and designer Inbox/Spam confirmation remain recipient-controlled checks.
