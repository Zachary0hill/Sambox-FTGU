# Santos Studios functionality and UX audit

Audit date: November 10, 2026 (America/Chicago). Scope: production workflows, completion gaps, failure recovery, and desktop/mobile UX.

The application is substantially implemented. The immediate priority is making existing workflows consistent and dependable, especially assignments, mobile project controls, recovery after failures, and the partially released ideas/research system. A broad redesign or another large feature set is not the next requirement.

## Evidence and limits

- Inspected the authenticated live Super Admin UI: Users, Ideas and an idea detail, Projects and a project detail, Finance, Automations, Performance, Workload, Daily, Inbox, Content, Brand, Clients & Sponsors, and Account Settings. Inspected Content and project detail at 390 × 844; restored the browser viewport afterward.
- Traced the current local UI, action handlers, APIs, database migrations, worker implementations, and role restrictions. Delegated the section traces using the dashboard-section-audit skill.
- Read production Railway deployment/logs and Supabase migration, scheduler, response, assignment, and policy metadata. No customer messages, paid generation, publication, account changes, project edits, migrations, or deployments were deliberately initiated. Normal app navigation may update activity/presence and invoke its normal background behavior.
- Local Node suite: **107/107 pass**. Full ESLint: **pass** (Babel size notice for StudioView.jsx). TypeScript `--noEmit --incremental false`: **pass**. These checks cover the current checkout, not the exact deployed build. No new production build was needed for this read-only audit.
- Current live deployment: `af684a4a-e04d-40ad-ab64-860fa7c450b5`, source commit [`124302ba3e40b182e9fd62bbbb2db194c6371bf5`](https://github.com/Zachary0hill/Sambox-FTGU/commit/124302ba3e40b182e9fd62bbbb2db194c6371bf5), created November 10 at 5:47 PM Central. Local HEAD is `7bea861`, with substantial pre-existing uncommitted ideas/research work. This checkout is **not** a clean representation of the deployed release.
- Live browser captured no console warnings/errors during the checked navigation. The sampled 63 deployment HTTP records had no 5xx. Neither proves workflow correctness: the research tick below illustrates a false-positive HTTP success.
- Role-specific acceptance for Manager, Editor, Designer, Client and Sponsor, real recipient email/reset delivery, actual publishing, destructive recovery, and restart/failure injection were not executed. Code-backed findings are labeled separately from live reproductions.

## Fix first

### 1. P1 — Board assignments can be decorative instead of real — LIVE CONFIRMED

“Pizza Print” shows Himanshu in the board's Editor column, but its drawer's Team → Editor is empty; More properties contains a second Editor field. Workload reports no editor and shows Himanshu using **0 of 5 slots**. A production query confirms the canonical `project_edits.editor_id` is null while a custom person field named Editor is populated. **12 projects** in the database have a populated custom Editor with no canonical editor assignment.

Custom-field creation/rename permits system labels. Those values save only to `project_field_values`; actual assignment, member queues, workload and assignment emails use canonical editor/designer IDs. Consequently the board can look assigned while the operational workflow remains unassigned. Custom status fields can cause the same confusion with review stages.

Fix: inventory colliding labels and values; prepare a reviewed mapping into actual workflow fields, preserve existing canonical assignments and source values, flag conflicts, then prevent ambiguous new labels or provide explicit workflow-field binding. Do not blindly overwrite assignments or send a burst of migration-generated emails.

Acceptance: board, drawer, Workload and the editor's queue agree for the same project; subsequent intentional assignment/status changes produce the expected access and single notification.

Sources: [field creation](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:1343), [custom persistence](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:1514), [canonical assignment](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:90), [queue ownership](/Users/Mac/dev/Sambox-FTGU/lib/studio/member-queue.js:2), [assignment email trigger](/Users/Mac/dev/Sambox-FTGU/supabase/migrations/20261023000200_email_notifications.sql:77).

### 2. P1 — Finish the ideas/research release as one coherent system — LIVE RELEASE GAP

All five November 8 ideas migrations are already recorded in production, and `ftgu-idea-research` runs every minute against `/api/ideas/research/tick`. However that endpoint's source file is absent from the deployed GitHub commit. The inspected live Ideas UI still shows the older Draft/In Review/Approved/In production flow, without the local rules/research/conversion controls.

Railway records HTTP 200 for the tick. The database HTTP response history shows **15 HTML documents in a 15-minute sample**, alongside valid JSON results from automation/notification workers. The missing route and matching minute cadence strongly indicate the research cron is hitting the catch-all page rather than executing a worker. Treat this as a failed job despite status 200; the sampled response table does not itself retain the request path.

Fix: reconcile deployed code, applied schema and scheduled routes; finish and release the compatible research UI/API/worker together. Add endpoint/content-type/result validation, reject unknown `/api/*` paths instead of rendering the app, and expose last successful worker execution. Preserve the newer activity-tracking release when reconciling this older local checkout.

Acceptance: research tick returns the expected JSON contract, a controlled queued job advances to a terminal state, UI reflects results, and restart/retry does not duplicate generation or charges.

Sources: [local worker route](/Users/Mac/dev/Sambox-FTGU/app/api/ideas/research/tick/route.ts:1), [cron registration](/Users/Mac/dev/Sambox-FTGU/supabase/migrations/20261108000400_idea_research.sql:44), [catch-all page](/Users/Mac/dev/Sambox-FTGU/app/[[...slug]]/page.tsx:1).

### 3. P1 — Keep project Close and navigation controls on-screen on phones — LIVE REPRODUCED

At 390 × 844, opening Pizza Print pushes the Close button to **x=443–477**, beyond the 390px viewport. Its long generated job ID occupies the header row and displaces controls. The screenshot also shows the header clipped on the right. This makes a routine project visit difficult to exit on a phone.

Fix: constrain/truncate the job identifier, allow metadata to shrink or wrap, and reserve space for Close. Keep previous/next and secondary controls in a responsive arrangement. Consider a short readable display job code while preserving the full identifier internally.

Acceptance: long-ID and long-title projects retain a visible, tappable Close at 320, 375, 390 and 768px; both orientations work. Source: [project header](/Users/Mac/dev/Sambox-FTGU/components/studio/ProjectModal.jsx:676).

### 4. P1 — Enforce enrolled MFA at the data/API boundary — CODE + POLICY REVIEW

Authenticator enrollment/challenge exists, but the checked-in assurance-level check is in the Studio browser shell. API membership authentication and database membership helpers do not enforce AAL2. A production policy scan found no direct AAL2/assurance expressions. This is a code-backed bypass concern, not a performed live exploit or a complete security assessment.

Fix: shared server and database enforcement for users with an enrolled factor, with deliberate setup/recovery exceptions. Verify direct AAL1 requests cannot read or mutate protected data until the challenge succeeds. Sources: [client challenge](/Users/Mac/dev/Sambox-FTGU/components/studio/Studio.jsx:76), [API membership](/Users/Mac/dev/Sambox-FTGU/lib/integrations/auth.ts:18), [RLS helper](/Users/Mac/dev/Sambox-FTGU/supabase/migrations/20261020000200_helpers_rls.sql:6).

### 5. P1 — Make destructive and automated operations recoverable — CODE VERIFIED

- **Project deletion removes stored files before confirming database deletion.** A rejected database operation can leave a surviving project whose files are gone. Storage failures are also ignored. Use a durable server-side deletion/cleanup process with accurate completion reporting. [Deletion paths](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:1801).
- **Automation effects can repeat after a worker crash.** Completed steps remain in memory until a later run write; a reclaimed run can send email/Slack or create tasks again. Persist effect identity/checkpoints and use provider/database idempotency. [Execution](/Users/Mac/dev/Sambox-FTGU/lib/automations/run.ts:143).
- **Pause all drops waiting work.** The worker claims paused queued/delayed runs and marks them terminal `skipped`; resume cannot continue them. Hold work while paused, reserving cancellation for a separate explicit action. [Pause handling](/Users/Mac/dev/Sambox-FTGU/lib/automations/run.ts:109).

Acceptance: simulated DB/storage failures preserve recoverable state; killing and resuming a workflow yields exactly one effect per step; pausing a delayed workflow preserves its remaining work.

## Finish before the next full rollout

| Priority | Area | Finding and finishing work | Evidence |
|---|---|---|---|
| P1 for new research release | AI costs | Limits use estimated costs without reservations or bounded output, fallback prices are not rechecked, and niche-research costs can be absent from the spend ledger. Make budget enforcement complete and concurrency-safe; otherwise label it an estimate. | [spend guard](/Users/Mac/dev/Sambox-FTGU/lib/ai/spend.ts:26), [research call](/Users/Mac/dev/Sambox-FTGU/lib/ideas/research.ts:111), [niche usage](/Users/Mac/dev/Sambox-FTGU/lib/research/run.ts:192) |
| P2 | Draft recovery | Comment composer clears before success; attachment finalization can leave partial records. Brand Save closes before persistence. Closing an idea discards dirty script changes. Preserve drafts, show inline errors, and make comment/attachment finalization idempotent. | [comment submit](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:2272), [attachment finalize](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:204), [brand save](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:1050), [script close](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:1063) |
| P2 | Upload recovery | A failed upload holds its project/kind slot but offers Retry without Cancel. Let users cancel/release permanently failed work and upload a replacement. | [task state](/Users/Mac/dev/Sambox-FTGU/lib/studio/uploads.js:17), [upload controls](/Users/Mac/dev/Sambox-FTGU/components/studio/UploadStatus.jsx:20) |
| P2 | Finance accuracy | Overdue totals count reminder-sent invoices irrespective of due date and miss past-due sent invoices. Derive aging from unpaid state + due date; keep delivery status separate. Clear Sending in a finally block after network failure. | [aging totals](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:1058), [send shortcut](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:991) |
| P2 | Notifications | Managers can enable a daily digest but the sender excludes them; portal roles also see the unsupported option. Failed digests cannot retry that day because their unique daily claim remains. Include supported roles and implement bounded retry. | [recipient filter](/Users/Mac/dev/Sambox-FTGU/lib/email/notifications.ts:178), [daily claim](/Users/Mac/dev/Sambox-FTGU/lib/email/notifications.ts:188) |
| P2, local release | Idea readiness | Research saves evidence in `research.sources`, while the source gate only counts `refs`/legacy `findings`. A successful research result can remain blocked. Align UI and SQL checks. | [source gate](/Users/Mac/dev/Sambox-FTGU/lib/ideas/gates.ts:12) |
| P2 | Manager consistency | Idea owner options omit other managers. Approval UI unnecessarily requires project-create permission for task/social conversion. Manager client listings consider only the first account channel. Use permission-aware eligible members/targets and all account channels. | [owner options](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:314), [approval gate](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:151), [client channels](/Users/Mac/dev/Sambox-FTGU/components/studio/ManagerClients.jsx:27) |
| P2, local release | Social handoff | Idea conversion creates a content card marked scheduled without a publish date or Buffer queue entry. Add a genuine draft → review → channel/date → schedule flow, or call it Content draft. Link directly to the created task/card. | [conversion SQL](/Users/Mac/dev/Sambox-FTGU/supabase/migrations/20261108000300_idea_gates.sql:159) |
| P2 | Completeness/performance | Workspace projects/comments/assets load without pagination; newer rows can disappear at API limits. Project Activity only sees the latest 400 workspace events; automation history/stats cap at 150 runs, research at 30, providers at 1,000. Add scoped detail reads, cursor pagination, server totals and explicit coverage. Current missing project records were not proven. | [workspace loader](/Users/Mac/dev/Sambox-FTGU/lib/studio/load.js:61), [project history](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:2323) |
| P2 | Keyboard UX | Project/new-project dialogs use open/aria-modal without modal focus isolation/restoration. Reuse existing FlowBuilder focus handling or native showModal, including compatibility with dropdown portals. | [project dialog](/Users/Mac/dev/Sambox-FTGU/components/studio/ProjectModal.jsx:663), [new project](/Users/Mac/dev/Sambox-FTGU/components/studio/StudioView.jsx:82) |
| P2 | Content dates | Content still rebuilds dates from year-less labels and subtracts 365, despite canonical dates elsewhere. Preserve ISO dates through sorting/filtering. | [date reconstruction](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:554) |

## Section completion map

FUNCTIONAL means real data and action paths exist; it does not certify every failure/role scenario. PARTIAL identifies a core handoff or operational gap. No major inspected navigation section is merely a static placeholder.

| Section | Status | What exists / what remains |
|---|---|---|
| Daily | FUNCTIONAL | Assistant, history, project context and attention items. Make metrics consistent with Content/Performance: Daily currently shows audience reach 0 for its video-only scope while Performance has Buffer reach. Explain scope prominently. |
| Projects: Table/Kanban/List | FUNCTIONAL with critical defects | Real editing, filtering, grouping, bulk actions and saved views. Fix canonical assignments, mobile header and mutation recovery first. |
| Calendar/Timeline | FUNCTIONAL | Canonical board dates and calendar overflow expansion are built. Historical/date boundary acceptance still useful. |
| Project scripts, comments, files, tasks | FUNCTIONAL; history PARTIAL | Script links, real comments/edit/delete, sharing, resumable uploads and checklists. Finish draft preservation, failed-upload cancel, safe attachment commit and paged history. |
| Ideas | FUNCTIONAL live; next workflow PARTIAL release | Import, briefs, scripts, review and project handoff exist live. New stages/rules/per-idea research/conversion require release reconciliation and fixes above. |
| Research | PARTIAL operationally | Existing niche research has results/retry/redraft but runs in Next after() and lacks checkpoint resume. New per-idea queue has a local implementation but its deployed worker is missing. |
| Brand | FUNCTIONAL | Logos/files, voice, colors, fonts and social links. Retain failed-save drafts; populate actual brand kits where currently empty. |
| Clients & Sponsors | FUNCTIONAL implementation | Accounts, project links, portal permissions and invitations. Live portal active count is 0; real client/sponsor acceptance is still required before calling portal operations ready. |
| Inbox | FUNCTIONAL notifications; incoming-message scope | Notifications, activity and source links exist. No unified reply workflow; build one only if replying inside Santos is required. |
| Content | FUNCTIONAL library; publishing handoff PARTIAL | Live Buffer content is populated (723 entries observed); manual entries and distribution tracking exist. Canonical project scheduling and new social conversion need truthful external-publish status. |
| Performance | FUNCTIONAL cohort analytics | Live Buffer metrics/filtering/export. Measures lifetime reach of posts published in a date range, not reach earned during that range. Preserve historical data on disconnect and clarify KPI wording. |
| Users / Roles / onboarding | FUNCTIONAL implementation | Real invites, membership/access, views and welcome flows. Complete role-by-role acceptance and real inbox/reset verification; fix manager inconsistencies. |
| Workload | FUNCTIONAL with data issue | Real assignment/deadline/capacity controls, templates and workflow rules. Fix canonical assignments; configurable per-person capacity is useful (currently five slots each). |
| Finance | FUNCTIONAL basic bookkeeping | Four CRUD tabs, real invoice/reminder sends and CSV. Fix aging/recovery. Payment collection and actual payout transfers are external, not missing implementations of the bookkeeping buttons. |
| Automations | FUNCTIONAL executor; reliability PARTIAL | Builder, triggers, delays, retries, run history and scheduler exist. Live workspace shows two drafts and zero live workflows, so configuration/acceptance remains separate from building the engine. |
| Settings / integrations | FUNCTIONAL core; selected connectors PARTIAL | Real preferences and supported-provider sync. Drive/Gmail/Frame.io verify credentials but lack folder/upload, mailbox, and timecoded-review workflows respectively. Label capability honestly. |
| Activity / What's New | FUNCTIONAL implementation | Logs/export/load-more and release information exist. Project-specific history needs its own pagination; keep release documentation aligned with actual deployments. |

## Final enhancements worth adding

1. **Operations readiness screen:** last real worker result, failed/oldest queued jobs, email failures, connector freshness/token expiry, and missing setup with direct fix links. A green Connected or HTTP 200 badge is insufficient.
2. **Consistent drafts and save feedback:** saving/saved/error states, retry without retyping, dirty-navigation protection, and per-project comment drafts.
3. **Clear workflow fields:** recognizable assignment/status controls, readable job codes, and an explanation when custom metadata does not drive workflow automation.
4. **Better mobile navigation:** the current compact navigation is a long horizontal row of icons; add a labeled menu or grouped overflow. Preserve the usable mobile Details tab and stacked Content cards.
5. **Data hygiene tools:** live test/QA records are visible in the main board and affect attention/capacity. Offer an explicit test/archive filter and a reviewed cleanup list; do not infer authorization to delete existing records.
6. **Actionable empty states and metrics:** show the next setup action; label unavailable versus zero metrics and lifetime-cohort versus period performance. Buffer-imported YouTube content already exists even though the direct YouTube connector is disconnected; make that distinction understandable.

Competitor ingestion, campaigns, richer outcome learning, native timecoded review, embedded inbox replies, and payment processing are expansion choices. They should not delay repairing the current production loop unless explicitly required by the studio.

## Recommended completion order and release checks

| Order | Work package | Required outcome |
|---|---|---|
| 1 | Canonical assignment reconciliation + mobile header | Existing assignments agree everywhere; phone users can open and close every project. Preserve manual decisions and report conflicts. |
| 2 | MFA boundaries + deletion/comment/upload/automation recovery | Direct access honors MFA; failure injection loses no original media/drafts; retries produce one intended effect; pause/resume preserves work. |
| 3 | Complete coherent ideas/research release | Current main changes preserved; deployed API/UI/schema align; budget/source checks work; one controlled research-to-project/task/draft flow succeeds. |
| 4 | Notification/finance/manager correctness | Manager digest works, failed sends recover, aging is date-correct, role options match permissions. |
| 5 | Pagination, history, analytics labels and operations visibility | Records remain reachable beyond caps; totals state their coverage; worker errors cannot masquerade as success. |
| 6 | End-to-end qualification | Manager imports and plans → canonical assignee sees queue → editor uploads → review/revision → client approval if enabled → explicit scheduling/publishing → measured result. Include fresh login/reset, mobile, expired connection, interrupted upload and worker restart. |

This audit changes only documentation. It does not implement, commit, deploy, or certify the fixes above.
