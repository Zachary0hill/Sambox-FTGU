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

## Enhancement implementation and verification

The enhancement round starts from local commit `cea33ba`. The six briefs below cover the 18 requested changes.

### 01 · Daily Slack digest enhancements

[Handoff](enhancements/01-slack-digest.md)

The digest step now previews a selected workday in its configured timezone. The preview shows the outgoing Slack blocks, expandable project lists and the earliest available edit history. New deliveries retain a snapshot of the message and project lists. Older deliveries show a reconstruction notice. The preview uses a read-only Super Admin endpoint scoped to the signed-in studio.

The channel picker searches joined channels by name across Slack API pages and saves the channel ID. It shows the next local cutoff, retains older IDs and identifies inaccessible destinations or disconnected Slack. Review and revision queues show the timestamp of the current queue entry, ordered oldest first. A reassignment retains the original entry time. Items already waiting when tracking started appear first with their age marked unknown.

- PostgreSQL 17 applied `20261125000100_digest_preview.sql` to a clone of the completed first-round schema. Both `tests/production-digest-preview-db.sql` and `tests/production-digest-db.sql` passed. They cover reassignment, re-entry, sorting, unknown baseline ages, historical coverage, workspace isolation and privileges.
- Node 22 passed 25 checks with `node --test tests/production-digest.test.cjs tests/automation-status.test.cjs`. The tests compare the actual worker payload with the preview and confirmed snapshot, exercise retries, enforce member scope, and check legacy schedule timezone and date selection. Focused ESLint and TypeScript passed.
- Chrome opened the digest inspector in a local authenticated studio. It searched a two-page simulated Slack channel list, saved and reloaded the second channel, expanded both completed projects at the selected UTC cutoff and displayed a warning for a pre-tracking date. Additional browser checks preserved the saved ID when the bot could no longer see the channel or Slack was disconnected. Live Slack and John's workday reconciliation remain pending.

### 02 · Buffer draft operations enhancements

[Handoff](enhancements/02-buffer-drafts.md)

- **Readiness.** Projects table and Kanban cards show readiness before the move to Scheduled. The worker and dashboard share the database checks for the project brand, approved edit and selected Final. The board also identifies missing or unusable destinations, a disconnected connector and an inactive workflow. Each reason opens its project control or the relevant workspace setting.
- **Gerald’s queue.** Projects → Buffer draft queue shows visible projects, clients, original Final versions, destinations, draft IDs and per-channel outcomes. Needs attention includes partial failures, held requests and newer approved Finals. Each project opens directly from its row.
- **Version review.** The first reservation captures the submitted Final. An operator may keep it, explicitly replace its media, or acknowledge a manual update in Buffer. Older handoffs display “Version not recorded”. The guided path handles those records. An update reads the remote post and checks its draft status, channel and expected media before sending only the post ID and ordered video asset. Replays reuse the recorded decision. An uncertain reply holds the reservation. Buffer exposes no atomic draft-status condition, so a concurrent remote change between reading and editing remains possible. A changed response requires verification. [Buffer GraphQL reference](https://developers.buffer.com/reference.md) · [Media contract](https://developers.buffer.com/guides/hosting-media.html)
- **Checks.** Fresh PostgreSQL 17 passed `tests/buffer-draft-db.sql` and `tests/buffer-draft-operations-db.sql` after migration `20261125000200_buffer_draft_operations.sql`. These cover shared-client isolation, assigned/unassigned membership, snapshots, concurrent claims, definite and ambiguous outcomes, version decisions and media retention. Node 22 passed 23 tests across `tests/buffer-media-update.test.cjs` and `tests/buffer-drafts.test.cjs`, including the shared harness. Focused ESLint and TypeScript passed.
- **Browser.** Chrome verified the legacy version label, manual acknowledgement, Needs attention and project Final-control focus. A second fixture drove a confirmed V1 → V2 replacement through the queue, authenticated PostgREST and simulated Buffer/storage. The edit preserved post ID, caption and draft status. Both original and verified versions survived reload. The integration owner independently verified the same behavior on the production build. Live acceptance with Gerald and the actual Buffer account remains open.

### 03 · Idea handoff and archive enhancements

[Handoff](enhancements/03-idea-archiving.md)

1. Project approval now previews the destination, full production brief, shoot notes, script beats, research summary and reference links. The preview and commit share the database package builder. Confirmation checks that the reviewed material and destination still match before it allocates a job number. Existing cover-transfer retries continue to use the linked project.
2. Archived ideas can be found by the linked job number, project title and client in Board, Grid and List. Each result links to the project the current user can access. Existing stage, view and brand filters apply.
3. Super Admins can open **Review historical handoffs** on Ideas & Research to inspect eligible approvals, missing project links and mismatched snapshots. Selection and confirmation are separate steps. The database locks and rechecks each selected idea and project, commits the batch together and logs each archive once with the actor and both record IDs.

On a disposable PostgreSQL 17 database, `tests/idea-handoff-review-db.sql` verified read-only preview, stale confirmation, snapshot parity, idempotent approval, access restrictions, historical classification, rollback and audit. The original production handoff and job-code SQL suites also passed. Node 22 passed all 44 tests across `idea-stages.test.cjs` and `idea-research.test.cjs`. Scoped ESLint and TypeScript passed.

Authenticated Chrome checks on the local disposable workspace verified a preview cancellation with zero new projects, confirmation with one linked project, explicit historical confirmation with the orphan preserved, and archived search by job, client and title. Both the source idea and linked project opened. Historical production records still require the studio’s selection.

### 04 · Editor reconciliation enhancements

[Handoff](enhancements/04-editor-payments.md)

Implemented and verified all three enhancements in Finance → Contractor payouts.

1. Monthly terms prefill from the immediately preceding calendar month. The form shows the prior and proposed values side by side, highlights changed fields, and requires confirmation for the selected month. A missing prior contract leaves the inputs empty.
2. The billing exception queue includes reapprovals, editor reassignments and approvals awaiting contract terms. A Super Admin can keep the existing credit, credit one event to one covered editor, or exclude the job. The ledger retains the actor, date and reason. The report enforces a single credited event per job across editors and months.
3. Month-end statements capture the job-level ledger, effective terms, totals and linked payout/invoice as approved. Corrections record a new version, affected jobs, reason, actor, date and amount change. Each version has its own CSV. A stale preview prompts a fresh review.

Seven Node 22 finance tests, both PostgreSQL 17 finance suites, scoped ESLint and the 34 desktop/mobile studio page checks passed. The SQL tests exercised transfers, missing terms, retries, stale decisions, forged totals, immutable versions and Finance permissions. In the local authenticated browser, December inherited November’s terms, a retainer edit was highlighted, and January inherited the explicitly confirmed December amount. A synthetic November statement saved at $125.50. An operator excluded QA-2 with a reason, then approved version 2 at $100.00. The CSV identified QA-2 and the −$25.50 change. The original CSV downloaded identically after the correction. Reopening the month showed both saved versions and suppressed an unchanged correction. The linked synthetic payout remained pending approval at $125.50. Production invoice reconciliation and billing decisions remain with the studio.


### 05 · Workflow authoring enhancements

[Handoff](enhancements/05-workflow-authoring.md)

The builder now asks separate trigger and recipient questions for ambiguous readiness notifications. Project statuses come from the studio. Recipient choices include supported role actions, active members and the connected Slack destination. Selecting an answer edits the graph immediately. Other unresolved clauses remain visible and block activation.

**Compare samples** runs two selected, active projects through the server preview. It explains status, publishing stage, due date or sponsor approval as applicable, checks trigger filters and reports the actual brand and channel for a matching Buffer handoff. An expected skip stops before actions and counts as a successful preview operation. At least one matching, successful sample is still required for activation. Schedule, webhook, idea and comment triggers retain their existing test paths because project state alone cannot establish those events.

Live workflows now offer **Create revision**. Assistant drafts created from a live workflow also retain its identity and baseline. Activation review compares triggers, timing, recipients and actions, and calls out proposed public publishing. Applying the revision keeps the original workflow ID and run history. The transaction rejects stale originals and unfinished live runs, and repeat application returns the same ID. Draft revisions cannot become a second live trigger.

- Node 22 passed all 39 checks across the workflow-authoring, automation-status and production-digest suites. Scoped ESLint, TypeScript and whitespace checks passed.
- PostgreSQL 17 applied the migration on the disposable first-round schema. `tests/workflow-revisions-db.sql` passed for origin capture, role isolation, bypass prevention, retry, stale sibling and single live identity.
- Chrome on the local Next.js app and PostgREST resolved “Notify the team when a video is ready” to Editor status · In Review and Email the assigned editor, then reloaded the saved choices. The two-project preview showed a brand-routed editable Buffer draft for a matched Scheduled project and a trigger skip for a Scripting project. Both run rows had test status, zero Buffer publications and zero recorded external effects. Chrome also applied a revision, showed the draft-to-public warning and disabled activation after the original changed. A local webhook probe with a draft revision sharing the live address reached its original workflow and queued zero runs.

### 06 · Dev Note decisions and acceptance enhancements

[Handoff](enhancements/06-dev-notes.md)

1. **Decision inbox.** Open Dev Notes → Decision inbox to review the six questions, supporting evidence and suggested answers. A Super Admin explicitly links each topic to a real workspace note and assigns an active reviewer who can already read it. A unique text match preselects the original note. Ambiguous matches require selection. The reviewer can choose a suggested answer or write one. Every saved decision records the actor, time and revision.
2. **Try it.** Each question names the intended role and opens the relevant dashboard screen. Project decisions can link to a specific workspace project. Links use the viewer's current role, permissions and visible projects. Missing or inaccessible projects fall back to the permitted screen. A viewer without the required action permission sees why the link is unavailable.
3. **Delivery and acceptance.** An assigned review starts at Needs decision. The reviewer answers, a Super Admin marks it Ready to try, and the reviewer records an example or comment to mark it Accepted. Reopening requires a reason and preserves the earlier answer and sign-off. Legacy Open and Resolved remain independent. Existing notes receive no automatic decision or acceptance.

PostgreSQL 17 passed `tests/dev-note-decisions-db.sql` on an isolated migrated database, covering eligibility, reviewer-only actions, concurrent revision checks, idempotent request IDs, required acceptance text, retained history, restricted reads and legacy resolution. Node 22 passed all nine checks in the decision-target suite and its shared harness. Scoped ESLint passed.

In Chromium at 1440px and 390px, all six decision topics were available to a Super Admin. A synthetic editor-authored note went through assignment, free-text answer, admin readiness and editor acceptance in separate sessions. The editor saw only their decision and could not invoke the Super Admin column action. Four attributed history entries persisted while the source stayed open. A second test saved a suggested answer and opened the selected project's drawer from the mobile Try it link. Production assignment to John and actual owner acceptance remain open.

### Combined enhancement verification

All six handoffs were exercised together on the local dashboard with synthetic studio data. Six agents worked in overlapping batches of up to three.

| Check | Result |
| --- | --- |
| Automated regression | All 283 Node tests passed. Chrome rendered 17 studio pages at both 1440 px and 390 px, with zero reported errors or horizontal overflow across the 34 checks. Repository-wide ESLint, TypeScript and the Next.js production build passed. |
| Database upgrade | All six enhancement migrations applied in order on fresh PostgreSQL 17 using the repository’s Supabase bootstrap. All 18 selected SQL suites passed with the final schema, including one suite per enhancement section and the cross-section regression. |
| One project across six sections | The [integration test](../../../tests/dashboard-handoff-integration-db.sql) previewed and approved the same editor package, linked the resulting project to an open Dev Note, applied a workflow revision to its existing live ID, and checked Buffer readiness against that project’s brand and Final. A historical Slack cutoff retained the original review state. The approved job appeared once in the digest and earned one editor credit. Reapproval preserved the saved $120 statement. |
| Authenticated production-build checks | Chrome reopened the historical idea review, the saved editor statement and its correction, a named Slack channel and its workday preview, Gerald’s submitted and replacement video versions, and the six Dev Note topics on desktop and mobile. A Manager’s mobile view kept private Finance and Slack administration restricted. The workflow builder preserved a clarified recipient and blocked activation of a stale draft that would have changed draft creation to public publishing. |
| Provider and concurrency checks | A confirmed Buffer media edit preserved the remote fixture’s caption, destination, post ID and draft state. The dashboard verifies the returned media source and holds an ambiguous response for manual review. Two concurrent PostgreSQL transactions trying to apply sibling workflow revisions produced one successful update, one stale rejection and one live workflow. |

Slack, Buffer and storage responses were simulated locally. Deployment, production migrations, Gerald’s live Buffer check, real invoice reconciliation and John’s acceptance remain pending.
