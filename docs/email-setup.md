# Email setup guide

How to get invite and notification emails reaching real people, locally and on Amplify.

## How email works here

| Email | Sent by | Configured in |
|---|---|---|
| User invites (Users > Add user, Resend invite) | Resend, from our server | `RESEND_API_KEY`, `EMAIL_FROM` |
| Notifications (assigned, revision, review, deadline) | Resend, from our server | Same, plus `CRON_SECRET` and a scheduler |
| Invoices and reminders | Resend, from our server | Same |
| Sign-in email link, forgot password, email change | Supabase Auth | Supabase dashboard (SMTP, URLs, templates) |

For invites, Supabase only mints the one-time token (`generateLink` with the secret key). It never sends the email.
Resend sends a link to `/auth/setup?token_hash=...`, where the person sets a password.

## 1. Verify a sending domain in Resend

1. Sign in at [resend.com](https://resend.com) > **Domains** > **Add domain**. Use a subdomain you control, for
   example `mail.yourdomain.com`.
2. Add the DNS records Resend shows (SPF/MX on `send.`, DKIM `resend._domainkey`, and optionally DMARC) at your DNS
   host.
3. Click **Verify** and wait until the domain shows **Verified**.

Until this is done, the sender stays `onboarding@resend.dev`, which only delivers to the email on your Resend
account. Super Admin pages show a warning while that is the case (`GET /api/email/health`).

## 2. Create a Resend API key

Resend > **API Keys** > **Create API key**, permission **Sending access**, limited to the domain from step 1. Copy it
once; Resend won't show it again.

## 3. Local environment (`.env.local`)

```bash
RESEND_API_KEY=re_...
EMAIL_FROM="FTGU Studio <studio@mail.yourdomain.com>"
SUPABASE_SECRET_KEY=sb_secret_...
APP_BASE_URL=http://localhost:3000
CRON_SECRET=any-long-random-string
```

- `EMAIL_FROM` must be on the verified domain. Quote it, because of the space and angle brackets.
- `APP_BASE_URL` is the origin used in email links. Without it, links use the address the request came from.
- Restart `next dev` after changing env.

## 4. Production environment (Amplify)

Amplify console > the app > **Hosting > Environment variables**. Add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Supabase secret key |
| `RESEND_API_KEY` | Key from step 2 |
| `EMAIL_FROM` | `FTGU Studio <studio@mail.yourdomain.com>` (no extra quotes; `amplify.yml` adds them) |
| `APP_BASE_URL` | The live `https://` origin, no trailing slash |
| `CRON_SECRET` | Long random string |

`amplify.yml` writes these into `.env.production` at build time, so **redeploy** after changing any of them.

## 5. Schedule notification sending

Notification emails wait in `email_outbox` until `/api/notifications/send` runs. The board triggers it when someone
is signed in; for everything else (deadline reminders, monday sync changes), call it every 15 minutes:

```bash
curl -X POST https://your-live-domain/api/notifications/send -H "Authorization: Bearer $CRON_SECRET"
```

Any scheduler works: EventBridge Scheduler, Supabase `pg_cron` with `pg_net`, or a cron service. Automations use the
same pattern at `/api/automations/run` every 5 minutes.

## 6. Supabase Auth emails (sign-in link, forgot password)

These don't go through our code. In the Supabase dashboard:

1. **Authentication > URL Configuration:** set **Site URL** to the live origin and add it (and
   `http://localhost:3000/**`) to **Redirect URLs**.
2. **Authentication > Emails > SMTP Settings:** turn on custom SMTP. To reuse Resend:
   - Host `smtp.resend.com`, port `465`
   - Username `resend`, password = a Resend API key
   - Sender email on the verified domain, sender name `FTGU Studio`
3. Without custom SMTP, Supabase's built-in sender is rate limited to a few emails an hour and is meant for testing only.

## 7. Test it

1. As a Super Admin, open **Users** and confirm there is no test-sender warning.
2. **Add user** with an address you can read that is *not* your Resend account email.
3. Check the toast. On failure it shows Resend's error, the invite is still saved, and **Copy invite link** works as a
   fallback.
4. Open the email, follow the link to `/auth/setup`, set a password, and confirm the new user has the right role.
5. In Resend > **Emails**, confirm the send shows **Delivered**.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Only you receive invites | `EMAIL_FROM` is still `@resend.dev`, or the domain isn't verified |
| Toast: `RESEND_API_KEY is not set.` | Env missing, or Amplify not redeployed after adding it |
| Resend error about the domain | `EMAIL_FROM` domain doesn't match the verified domain |
| Link points to the wrong site | `APP_BASE_URL` missing or wrong |
| "This link has expired or was already used" | Token used or expired; use **Resend invite** |
| Invite fails before sending | `SUPABASE_SECRET_KEY` missing on the server |
| Forgot password email never arrives | Supabase SMTP (step 6), not Resend config |
| Notifications only send while someone is on the board | No scheduler calling `/api/notifications/send` (step 5) |

## Delivery tracking and team welcome rollout (November 5, 2026)

The onboarding release adds migration `20261105000100_member_onboarding_delivery.sql`.
Apply it before deploying the new invitation code. It adds delivery attempts/events, an admin-only latest-delivery
view, server-only reservation/event RPCs, and member welcome progress. It enrolls only newly inserted editor/designer
memberships automatically; existing members can open **Settings → Getting started**. Completion and dismissal are
stored per workspace membership, independently from invitation acceptance.

The hosting instructions above describe the earlier Amplify setup. Confirm the application's actual hosting target
before changing environment variables; the rollout itself is platform-independent. No production configuration was
changed as part of local implementation.

Configure a Resend webhook pointing to `https://<canonical-dashboard-domain>/api/webhooks/resend` and set its signing
secret as `RESEND_WEBHOOK_SECRET` in that application's server environment. Enable `email.sent`, `email.delivered`,
`email.delivery_delayed`, `email.failed`, `email.suppressed`, `email.bounced`, and `email.complained` events. The endpoint
verifies the signature using the raw request body and deduplicates by provider event ID. It stores message IDs, event
IDs, event timestamps, and state only, not email bodies or authentication links. A sending-only API key is sufficient
for signature verification; delivery still requires a configured verified sender.

Users now shows membership status separately from email status:

| Email state | Meaning |
|---|---|
| Unknown | No tracked send exists, or the tracking schema is unavailable. Historical sends are not backfilled as delivered. |
| Send pending | Attempt reserved; completion is not yet known. Check Resend before retrying an interrupted send. |
| Submitted | Resend accepted the message. This is not delivery confirmation. |
| Delayed | Provider reported a delivery delay. |
| Delivered | A signed provider event confirmed delivery; it does not establish that the recipient read the email. |
| Failed / Bounced / Spam | Explicit submission or provider failure. Investigate before deliberately resending. |

**Send access email** is available for active editors/designers even when their invitation was already accepted.
It preserves their role and membership. Deactivated members must be deliberately reactivated through existing access
management first. Resend requests have a database-enforced 60-second cooldown per workspace/email. Failed attempts are
retained; bounce events never trigger automatic resends. The `resent_at` timestamp advances only after submission.

Invitation expiry is independent from the Supabase authentication token lifetime. Users displays expired invitations
as **Expired**; resending renews the invitation window, while Supabase controls the new email token's lifetime.
Copied fallback links are renewed before copying. Unconfirmed accounts continue into password setup even when a
replacement email uses a magic-link token.

After migration and deployment, verify both roles with explicitly designated test inboxes: new invitation, failed-send
recovery, resend, delivered event, first login, welcome completion, sign-out/password login, and password reset. Check
Supabase SMTP separately. Local mock tests do not prove real inbox delivery. No test emails are automatically sent by
the repository tests.
