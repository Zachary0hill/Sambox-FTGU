# Santos Studios full application audit — November 17, 2026

Scope: all 17 dashboard navigation sections, supporting API routes, authentication/invitations, Supabase authorization and migrations, file lifecycle, research/automation workflows, dependencies, and desktop/mobile rendering. This is a source-and-test audit, not a claim that every possible defect or external integration has been exercised.

Changes are local and uncommitted. No production migration or deployment was performed. Existing content and manual decisions were preserved. Paid generation, email delivery, social publication, payment settlement and destructive production actions were not used as tests.

## Confirmed defects fixed

| Area | Finding | Correction |
| --- | --- | --- |
| Invitations / identity | Existing invitation recipients were resolved through editable `profiles.email`; profile email updates were not bound to Auth identity. | Resolve existing recipients using confirmed `auth.users` addresses; guard profile identity fields, synchronize verified account email changes, reconcile profile email copies. Pending unconfirmed accounts still receive membership only on confirmation. Preserve MFA and tenant/role checks. |
| Invite acceptance | Existing profile matches could be used without checking the Auth account's actual email. | Verify the Auth email before any password/confirmation update. |
| Previews and cover downloads | Hostname filtering did not constrain DNS answers or redirect destinations; cover reads buffered an unlimited response before checking size. | Shared HTTP reader validates addresses in the connection lookup, rejects private/reserved/mapped addresses and credentials, rechecks redirects, and bounds response bytes and total time. Relative preview images resolve against the final URL; malformed numeric HTML entities no longer discard the preview. |
| AI preparation | Read access was sufficient to start paid script/cover work, even when the eventual edit was prohibited. | Check matching idea-edit permissions and ownership before model calls or downloads. |
| Research accounting | Automated research supplied the string `automation` to UUID actor columns. | System-triggered work records a null user actor. |
| Research cancellation | A stale cancellation could overwrite a completed run or newer retry; failed writes were reported as success. | Compare status and attempt identity atomically, retain completed/newer work, and surface database failures. |
| Automation status changes | Failed settings/approval reads could be treated as permissive; a zero-row concurrent update was logged as success. | Stop on unavailable checks and verify the status update returned a row before recording success. |
| Custom file fields | A failed field save was swallowed, so attachment deletion could continue and uploads could falsely announce success. | Return save outcomes and stop downstream deletion/success reporting when the reference save fails. |
| Brand files | Storage deletion ran before metadata persistence and ignored storage failure. | Save metadata first, check the affected row, queue durable cleanup transactionally, preserve newer assets, and report deferred cleanup. |
| Content cards | Banner or reload failure after initial insertion lost the new card ID; retry inserted another card. | Retain the committed ID before fallible downstream work and validate banners before insertion. |
| Record dialogs | Keyboard focus escaped the dialog; Ctrl/Cmd+Enter ignored busy state or called an absent save handler. | Reuse focus containment/restoration and guard shortcut submission. |
| Mobile Roles / Workload | Populated tables allowed absolutely positioned accessibility text to expand the entire page beyond 390px. | Establish positioning boundaries on the existing horizontal table scrollers; preserve accessible labels and table scrolling. |
| Dependencies | Next.js 16.4.2 and a transitive minimatch version had published security fixes. | Upgrade Next.js and eslint-config-next to 16.4.6; pin affected minimatch versions to 11.0.9. |

Main implementation: `app/globals.css`, `app/api/unfurl/route.ts`, `lib/http/public-resource.ts`, `lib/ideas/permissions.ts`, `lib/ideas/{cover,script,research}.ts`, `lib/research/run.ts`, `lib/automations/run.ts`, `lib/studio/{actions,vals-pages}.js`, `components/studio/RecordDialog.jsx`, and `app/api/invites/accept/route.ts`.

Required deployment migrations, in order:

1. `supabase/migrations/20261117000300_brand_asset_cleanup.sql`
2. `supabase/migrations/20261117000400_auth_email_identity.sql`

The identity migration updates profile contact copies from Auth; it does not change Auth emails, existing memberships, roles or passwords. Existing membership provenance was not investigated or retroactively changed.

## Section coverage

“Functional” means a real read/write backing was traced and rendering was exercised; it does not certify external-provider delivery. “Partial” identifies a core limitation already documented in the product scope. There are no placeholder-only navigation sections in this audit.

| Section | Classification | Backing and limits |
| --- | --- | --- |
| Projects | Functional | Project rows, canonical assignments, comments, assets, workflow statuses, custom fields; `lib/studio/actions.js`, `load.js`, `vals.js`. |
| Daily | Functional | Tasks and assistant status/tool routes; paid assistant requests not exercised. |
| Ideas | Functional | Import, stages/rules, scripts/covers, research and conversion; `lib/ideas`, corresponding APIs/components and migrations. |
| Brand | Functional | Brand kits/assets, channel links and atomic details save; cleanup acceptance added. |
| Inbox | Partial | Real notifications/integration messages and read state; native Slack/Buffer replies are not implemented. |
| Content | Functional | Real content entries and connected channel data; failed-save retries now preserve identity. |
| Performance | Functional | Real connected/manual metrics and project snapshots; native YouTube Analytics retention/impressions remain unavailable. |
| Settings | Functional | Profile, notification preferences, onboarding and MFA; identity and dialog boundaries reviewed. |
| Team | Functional | Membership, invitations, onboarding/access routes and database rules. Real invitation email sending not tested. |
| Roles | Functional | Permission and role-layout storage with RLS enforcement; editor/manager preparation access checked. |
| Workload | Functional | Canonical assignments and workflow rules; per-person configurable capacity remains outside current implementation. |
| Clients & Sponsors | Functional | Accounts, contacts, memberships and scoped portal backing; no real customer approval sent. |
| Finance | Functional | Budget/deal/invoice/payout records and invoice-send route; settlement/transfers remain manual by design. |
| Automations | Functional | Workflow definitions, run/effect journals and workers; failed checks and competing status updates now stop safely. |
| Logs | Functional | Real activity/error data and pagination; `load.js` and admin view logic. |
| Updates | Functional | Intentional release-history content from `lib/studio/releases.js`. |
| Workspace | Functional | Integration configuration, templates, branding and Operations health; connected-provider operations not executed. |

## Verification

- Initial baseline: 143 test executions passed.
- Final regression suite: 193 test executions passed, zero failures. Some existing suites import a shared test-bearing harness, so this count includes repeated baseline cases.
- Production Next.js 16.4.6 build passed using Node 22 (the repository's declared runtime). The host's default Node 20 is older than the declared engine and was not used for final qualification.
- Standalone Chromium rendering: actual StudioView/computeVals for all 17 navigation IDs at 1440px and 390px, with populated mock projects, members and permission rows in standards mode; 34 renders, expected headings, no JS exceptions or page-wide overflow.
- Standalone Chromium dialog behavior: focus containment and restoration, busy/missing-save shortcut handling, mobile fit and absence of JS exceptions.
- Disposable PostgreSQL: all application migrations applied from scratch with Auth/Storage/Vault/cron scaffolding; scheduler/network execution disabled. Existing completion acceptance plus new identity and brand-cleanup suites pass transactionally. No production database mutation.
- Local database catalog: zero exposed public SECURITY DEFINER RPCs missing the MFA guard; zero public RLS tables missing the restrictive MFA policy.
- Production dependency audit: zero known vulnerabilities. Full dependency audit retains one high-severity development-only picomatch advisory with no published patch. Do not feed untrusted glob patterns into lint tooling. See [picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
- Next.js patch rationale: [root-parameter cache disclosure advisory](https://github.com/advisories/GHSA-mfr8-8qww-v76h) and [nested-cache disclosure advisory](https://github.com/advisories/GHSA-vc7v-qv4w-wrv8). The audit did not establish that this app used the affected cache pattern; the vulnerable dependency was updated regardless.

- Full ESLint passed. The only output beyond the command was Babel's existing large-source formatting notice.
- Authenticated browser pass against the locally built app using the existing QA account and its real visible data: all 17 routes visited at both sizes, no JavaScript exceptions. All application mutation requests (jobs, notifications, activity, workload snapshots and preferences) were blocked. Three historical QA thumbnail paths returned `Object not found`; records and storage were preserved. Real-data mobile overflow on Roles and Workload was corrected by positioning the existing table scroll containers; the rebuilt app confirms both pages have a 390px document width at a 390px viewport, with no JavaScript errors. Reverting only the new CSS also reproduces both failures in the populated browser regression.
- Evidence and private screenshots: `/Users/Mac/.codex/artifacts/santos-audit-2026-11-17/`. Screenshots were kept outside Git because they contain workspace content.

## Reproduce

Use Node 22, then run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build`, and `node --test tests/*.test.cjs`. Browser fixtures: `node tests/record-dialog-browser.cjs` and `node tests/studio-pages-browser.cjs` (Google Chrome installed, or set `CHROME_PATH`).

For database tests, create a new disposable database, generate SQL with `python3 tests/completion-bootstrap.py`, load it with `psql -v ON_ERROR_STOP=1`, then run `tests/completion-db.sql`, `tests/auth-email-identity-db.sql`, and `tests/brand-asset-cleanup-db.sql`. Never apply the bootstrap to an existing or production database.
