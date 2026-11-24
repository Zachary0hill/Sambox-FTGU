# Dashboard adjustments completion log

Source: SantosStudios dashboard adjustment plan, November 23, 2026. Each assignee records implementation, checks and open decisions below. The integration review covers the combined checkout.

| Handoff | Acceptance evidence to record |
|---|---|
| [Daily Slack digest](01-slack-digest.md) | Reconcile a sample board at cutoff, then retry a confirmed send. |
| [Buffer drafts](02-buffer-drafts.md) | Create one editable draft per intended channel and leave the publishing queue intact. |
| [Idea archiving](03-idea-archiving.md) | Verify linked content, retries and recovery from a failed handoff. |
| [Editor reconciliation](04-editor-payments.md) | Trace monthly line items, allowance boundaries and repeat approvals to payout and invoice. |
| [Workflow authoring](05-workflow-authoring.md) | Save, reload, preview and activate a generated workflow in a test workspace. |
| [Six Dev Notes](06-dev-notes.md) | Record the evidence and the decision needed from John for each note. |

## 01 slack-digest

Implemented the scheduled **Send production digest to Slack** action, channel-ID field, graph checks, and selectable schedule timezone. The reporting window opens immediately after the previous scheduled cutoff and includes the current cutoff. Completion counts distinct projects that entered Approved while active. Review and revision show the editor queues at cutoff, including when the scheduler runs late. Entries include the project link, title and editor.

Migration `20261124000100_production_digest.sql` starts status history with a snapshot of existing queues. Approval tracking begins at migration time. Each workspace, channel and local reporting date has one delivery reservation. The runner records Slack’s receipt, skips confirmed deliveries on replay, releases an explicit channel rejection, and holds an ambiguous result for review.

Local evidence: PostgreSQL 17 applied the migration against the disposable pre-change schema. `tests/production-digest-db.sql` passed repeated approvals, queue transitions on either side of cutoff, archival, workspace isolation and runner privileges. Node 22 digest and automation status suites passed 22 tests including their shared harness. A mocked Slack send produced one call across competing runs and a retry. DST, rejected and uncertain sends, and read-only preview passed. Focused ESLint and TypeScript checks passed.

John still needs to confirm the completion definition, destination channel, timezone and cutoff. A connected Slack workspace and reconciliation against a real workday remain release checks.

## 02 buffer-drafts

Implemented **Scheduled in Publishing → Create Buffer draft**. Project → Social post lets the team select the project’s brand and approved Final video. Super Admins map synced Buffer channels to that brand. The worker checks project ownership or sponsorship, edit approval, Final asset identity and path, current publishing status, and destination mapping before dispatch. The project shows each draft’s Buffer post ID or handoff error. Gerald retains caption review and scheduling in Buffer.

Migration `20261124000200_buffer_drafts.sql` gives each project and channel a separate draft reservation. Confirmed drafts survive retries and status toggles. Definite failures can retry per channel. An ambiguous response holds the reservation for verification. Draft media remains available until sync confirms the post was sent.

Local evidence: PostgreSQL 17 passed `tests/buffer-draft-db.sql`, including two clients sharing a studio channel, approved-file gating, trigger enqueueing, retry, status toggles and media retention. Node 22 passed both provider-boundary regressions in `tests/buffer-drafts.test.cjs` (nine tests with the shared harness). The mocked Buffer endpoint verified the draft mutation and zero writes during preview. A repeat after a partial rejection touched only the rejected destination. Focused ESLint and TypeScript passed.

Gerald still needs to confirm each brand’s destination, approve the intended final asset and verify an editable draft in the live Buffer Drafts tab. No provider call was made against a real account. The mutation follows [Buffer’s draft example](https://developers.buffer.com/examples/create-draft-post.html).

## 03 idea-archiving

Project approval now archives the source in the same transaction that saves the project, sponsorship and production package. It preserves the Approved stage, job number and project link. Required-field checks and Approved workflow events run before the archive write. The dashboard links to the created project and tells the operator where to find the idea. A cover transfer can be retried from Archived after reloading.

The assigned editor can read the approval script, full research summary and clickable reference URLs from the project. Shoot notes are preserved in the brief. Existing linked approvals return their original project on replay. The [historical preview](03-idea-archiving.md#read-only-historical-preview) lists candidates, missing links and snapshot discrepancies by workspace.

PostgreSQL 17 passed the updated production handoff and job-code suites on a disposable database, including a gate failure after the project insert, read access as the assigned editor and repeat approval. Two concurrent connections returned the same project ID and exactly one reported creation. The preview distinguished a linked historical approval from an orphan in seeded data. Node 22 passed 40 focused tests across idea stages, automations and access, including post-archive cover recovery and approval notifications. Focused ESLint passed.

John’s decision on historical cleanup is pending. The migration applies prospectively and the preview was exercised only with local test data.

## 04 editor-payments

Implemented locally. Finance → Contractor payouts now contains the monthly editor report. Workload opens the report, and Users → Payment terms opens it with the selected editor. The approval ledger preserves the original job, title, content type, editor, timestamp and workspace-local month. The report shows covered and excluded projects, included units used, overage, retainer and total in cents. Approved terms apply to one editor and one calendar month. A Super Admin can link an existing payout and external invoice and see the difference between the payout and report.

- Four calculation tests passed, covering the November timezone boundary, exact allowance, one over, reapproval, reassignment, excluded types and missing terms. All 37 related Node regression tests passed, as did the existing 34 desktop/mobile studio page checks.
- The PostgreSQL 17 transactional test passed on an isolated database. It checked approval retries, revision and reassignment history, immutable terms, workspace/editor-bound payout links, role visibility and an unchanged payout status after linking.
- In Chromium against the disposable Next.js/PostgREST studio, a Super Admin opened an editor from Users, confirmed November terms, inspected both approvals and verified one count. The report showed $100.00 retainer plus $25.50 overage, linked a $125.50 synthetic payout to a test invoice URL, and showed a $0.00 difference. Workload reopened the persisted report and link. Switching months retained the selected editor at a 390px viewport. The test payout remained pending approval.
- John’s confirmation is still needed for actual rates, covered video types, approval/credit rules, handling of later editor changes, and post-close corrections. The UI requires explicit confirmation before computing a monthly amount. First tracked approval gets the proposed credit, and repeat approvals are listed for review. Existing approved projects receive deduplication markers only. Months predating or overlapping ledger startup show a historical coverage warning. Himanshu’s real November invoice is pending owner reconciliation.

## 05 workflow-authoring

- Implemented **Describe the workflow** in New flow and **Ask Assistant** in the canvas. Both produce editable builder graphs with the original request stored in the description. Using the assistant from a populated or live workflow creates a separate draft.
- The local translator recognizes catalog actions, production handoffs, workspace status changes, schedules, ordered steps and project filters. Unsupported action clauses are preserved on editable manual-setup cards. Unknown triggers, unresolved conditions, digest settings and missing Buffer routing block activation. Requests outside the supported phrasing need manual setup. Draft generation has no model or connector cost.
- The builder and hub use the same readiness checks. The Buffer inspector shows configured brand/channel mappings. Review identifies the destination for Slack digests and Buffer drafts. Live execution still requires explicit activation.
- **Verification** — 22 of 22 Node 22 checks passed in the authoring and digest suites, including catalog compilation, save-format round trips, channel mappings, unresolved instructions, studio timezone, delays and filters. Scoped ESLint and TypeScript passed. The integration owner verified a generated Buffer workflow saved, reloaded, previewed and activated through Chrome in the disposable workspace.

## 06 dev-notes

[Six Dev Notes and decision record](06-dev-notes.md) contains local evidence and the decision still needed from John for each note. PostgreSQL 17 verified permission-scoped mentions, editor revision and resubmission, client/content-type numbering, an independently editable custom-column copy, and a Manager-created client and linked project with the reviewed script. Chrome verified the Super Admin and Manager navigation at 1440px and 390px. The browser import fixture verified paste, review, client mapping and retry.

The four focused Node suites passed 40 checks. The existing job-code and production-handoff database suites also passed. All six original notes await owner confirmation. The team still needs John's preferred number format, duplication scope, Daily placement and notification expectations, and a real Manager example to establish whether additional Grok automation is needed.

## Integration review

The integration owner reviewed all six handoffs against the November 23 plan and verified them together on the local `codex/santos-dashboard-adjustments` branch. The four migrations are prospective. Live configuration and owner sign-off are still pending.

| Combined check | Result |
|---|---|
| Application build and regression suite | Next.js production build and TypeScript passed on Node 22. Full ESLint passed. All 249 Node tests passed with zero skipped. |
| Database | The application schema and four new migrations applied in order to a fresh PostgreSQL 17 database using the repository's Supabase bootstrap. Eleven SQL suites passed, covering all four new migrations, permissions, idea workflows and job numbers. Production cron and provider services were outside the fixture. |
| Dashboard | All 34 desktop and mobile studio page checks passed. The major workflow checks below used Chrome against the local Next.js app and PostgREST with a synthetic member session. |
| Slack and Buffer | The real worker processed scheduled and status-triggered runs against the local database with simulated provider responses. Two digest workflows targeting the same channel and reporting date produced one confirmed send for two distinct approved projects. A Buffer status toggle and a later generated workflow both reused the original draft ID. One draft request reached the simulated provider. |
| Workflow authoring | The requested Buffer sentence produced a disabled draft. It survived reload, previewed the fixture's brand, Final video and channel, and activated through the normal review screen. Integration fixes made the destination explicit and added a selectable Buffer preview project. With a newer, unconfigured project present, preview still chose the configured project. A preview request for another workspace's project was rejected. |
| Ideas | Two simultaneous requests to the approval API returned the same job and only one created it. The source disappeared from the active board, appeared under Archived, and the linked project displayed the saved script and research link. |
| Finance and Dev Notes | Reviewed the traced $125.50 synthetic payout and invoice comparison, and verified the payout remained pending approval. The six-note decision record identifies what the team verified locally and what John still needs to decide. |

Production acceptance requires John's digest settings and billing rules, Gerald's confirmation in Buffer, and a real invoice reconciliation. John also owns the historical archive decision and acceptance of the six original Dev Notes. No production migration, real Slack send, Buffer draft, payment or Dev Note closure was performed during this build.
