# FTGU Studio: buttons, configuration, and unfinished sections

Audit date: October 25, 2026 (America/Chicago).

Live app: [FTGU Studio](https://sambox-ftgu-production.up.railway.app/projects).

## Scope and confidence

Reviewed all 15 signed-in navigation destinations, their tabs and relevant dialogs, the shared board/drawer, local action handlers, API routes, integration implementations, and database migrations. Inspected the live app using the existing Super Admin session. Reloaded production to confirm that its older UI was not just an open-tab artifact.

This is a comprehensive inventory of problems found in the inspected UI and source, not a claim that every production write or every role has passed an end-to-end test. No invitations, invoices, provider jobs, uploads, approvals, deletes, or payment actions were submitted. Other roles were reviewed in code, not by signing in as those users. Production secrets, migration state, scheduled jobs, and actual email delivery were not inspected.

The local checkout is at `64fd8c8` plus substantial pre-existing uncommitted work. Production visibly differs from both parts of that checkout. Local implementations and local-only bugs are labeled separately below. No application code or existing work was changed by this audit.

Labels:

- **FIX:** code must change; adding credentials will not solve it.
- **CONFIGURE:** a real handler exists, but setup/data/service access is needed.
- **DEPLOY:** implementation exists locally but was not visible in the inspected production UI.
- **VERIFY:** implementation exists; actual production execution/delivery remains unproven.
- **FUNCTIONAL:** substantive data/handlers exist; this does not certify every live write.
- **PARTIAL:** substantive implementation exists, with a missing or broken core capability.
- **PLACEHOLDER:** the advertised behavior is not implemented.

Repeated controls are grouped by function. For example, “Edit template” applies to every template card; a matrix row applies to each named event. Counts of rows should not be interpreted as counts of individual DOM buttons.

## Executive findings

1. **Automations is a configuration UI without a workflow runner.** Creating/enabling a workflow does not perform its selected action.
2. **Finance has displays and status updates, but no record-entry workflow or actual invoice/reminder delivery.** “Send invoice” and “Send reminder” only change database status and activity history.
3. **Templates cannot be managed.** All three live “Edit template” buttons are dead, and the promised template checklists do not become project tasks.
4. **Several notification/security switches save preferences only.** Daily digest, outbound Slack alerts, desktop push, quiet hours, and authenticator sign-in have no implementation behind their promises.
5. **Only OpenAI is connected in the live workspace.** The remaining nine supported integrations are disconnected. Google Drive, Gmail, Frame.io, and n8n are additional unimplemented connectors.
6. **Production is behind the local UI.** It shows the older project Assets/History drawer and simple Ideas screen. The newer Files drawer, rich Ideas workflow, and notification settings are not present in the inspected live build.
7. **Project setup is incomplete.** The live New project dialog says “No channels yet”; both existing projects lack a channel. Workload also reports missing assignments. These are configuration/data gaps, not missing pages.

## 1. Buttons and switches requiring implementation or repair

### Existing admin and account controls

| ID | Location / exact control | Current behavior and required completion | Evidence |
|---|---|---|---|
| B01 | Workspace Settings → Templates → **Edit template** | **FIX, live-confirmed dead button.** Clicking a card's button leaves the screen unchanged; JSX has no handler. Build the editor, validation, save, and reload behavior. All three live templates are affected. | [Button without handler](/Users/Mac/dev/Sambox-FTGU/components/studio/StudioView.jsx:1861) |
| B02 | Clients & Sponsors → **Resend portal invite** | **FIX.** Only writes “resent the portal invite” to Activity Log. It neither creates an invitation nor sends email. Connect it to the real invitation path with the correct account, role, and recipient. Do not treat an activity entry as delivery. | [Log-only action](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:239) |
| B03 | Users → **Resend invite**, then **Invite sent** | **FIX.** The first resend calls a real server route. Once `resent_at` exists, the UI suppresses all subsequent resends, including after a delivery failure or expiration. Allow retry/resend with a temporary busy state. Existing pending invites were visible live; no resend was attempted. | [Permanent resend gate](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:1692), [server timestamp](/Users/Mac/dev/Sambox-FTGU/app/api/invites/resend/route.ts:17) |
| B04 | Finance → Client payments → **Send invoice** | **FIX.** Sets status to `sent` and logs the action. No invoice generation, email, payment link, or billing-provider send occurs. Implement delivery and preserve provider receipt/error state. Currently no live invoice records exist, so this action was traced in code. | [Invoice action](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:314), [status-only write](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:583) |
| B05 | Finance → Client payments → **Send reminder** | **FIX.** Sets `reminder_sent` and logs the action, without sending a reminder. Needs a real recipient/template/delivery path and error handling. | [Same action path](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:314) |
| B06 | Automations → **New automation / Create automation** | **FIX.** Saves descriptive trigger/action records. There is no executor to consume them. Build an event/schedule runner, structured action parameters, execution records, and failure handling. | [Definition creation](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:539), [record insertion](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:604) |
| B07 | Automations → workflow **On/Off** and draft-to-live control | **FIX.** Updates enabled/draft flags and displayed Live/Paused status. No workflow runs as a result. Wire these flags to the executor. | [Display status](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:350), [toggle persistence](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:590) |
| B08 | Automations → Settings → **Pause all automations / Resume all** | **FIX.** Saves a preference and changes the display. No runner exists to pause or resume. | [Run settings](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:556) |
| B09 | Automations → Settings → **Retry failed runs** | **FIX.** The claimed “Three tries over 15 minutes” has no execution/retry implementation. | [Preference-only setting](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:557) |
| B10 | Automations → Settings → **Alert on failures** | **FIX.** No automation-failure detection or Slack/email alert delivery consumes this setting. | [Preference-only setting](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:557) |
| B11 | Automations → Settings → **Test mode for new workflows** | **FIX.** No sample-data execution or sandbox run exists. | [Preference-only setting](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:557) |
| B12 | Automations → Settings → **Run history** retention dropdown | **FIX.** Stores a retention preference. No execution history UI or retention cleanup implements it. | [Retention model](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:559) |
| B13 | Automations → Settings → Notifications → every **Slack** checkbox | **FIX.** Preferences persist, but outbound notification delivery does not consume them. Live events shown: Assigned, Status changes, New comment or mention, Deadline, Approval requested. Local code additionally has Revision requested. | [Notification matrix](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:523) |
| B14 | Same matrix → every **In-app** checkbox | **FIX.** Saves switches, but database notification creation does not consult the matrix. Turning off a box does not implement the promised suppression. Applies to the same live/local event lists as B13. | [Saved matrix](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:535), [notification generation](/Users/Mac/dev/Sambox-FTGU/supabase/migrations/20261020000300_triggers_rpcs.sql:218) |
| B15 | Live matrix → **Status changes by Email / New comment or mention by Email** | **FIX/DEPLOY.** These email choices appear in production, but the local sender only supports assignment, revision, deadline, and review/approval events. The newer local matrix marks unsupported email choices unavailable. Deploy the corrected contract or implement the missing email events. | [Supported email choices](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:525), [email sender](/Users/Mac/dev/Sambox-FTGU/lib/email/notifications.ts:75) |
| B16 | Automations → Connectors → **Not available yet / Coming soon: Google Drive** | **FIX / PLACEHOLDER.** No managed provider or project-folder/raw-footage integration. Button deliberately does nothing. | [Placeholder action](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:413) |
| B17 | Same → **Gmail** | **FIX / PLACEHOLDER.** No Gmail connection/send implementation. Existing Resend notification/invitation email is a separate capability. | [Placeholder action](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:413) |
| B18 | Same → **Frame.io** | **FIX / PLACEHOLDER.** No timecoded review connection or workflow. | [Placeholder action](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:413) |
| B19 | Same → **n8n** | **FIX / PLACEHOLDER.** No configured n8n connector or working automation webhook action. | [Placeholder action](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:413) |
| B20 | Workspace Settings → General → **Week starts on Monday**, then save | **FIX.** The setting persists, but project calendar headings and offsets stay Sunday-first. Honor `week_start` when constructing both. | [Settings save](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:660), [hardcoded calendar](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:1506), [headings](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:1551) |
| B21 | Workspace Settings → Custom fields → **Add field**, then visibility switches | **FIX.** Fields created here have `on_board:false`; board/drawer use only board-enabled custom fields. No activation path was found. Add an “Add to board” path or use the same creation flow as board Add column. Visibility switches alone cannot repair this. | [Creation call](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:640), [board filter](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:220) |
| B22 | Roles & Permissions → admin-area grants and **Save permissions** | **FIX / limited permission contract.** Permission records save, but admin navigation/rendering is hardcoded to Super Admin. Granting an editor Finance/Users/Automations/Workspace access does not expose those sections. Either make those grants effective consistently or mark unsupported cells unavailable. Similar project-create grants are restricted by the UI's admin-only creation gate. | [Admin-only navigation](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:1622), [admin page gate](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:1653), [creation gate](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:826) |

### Personal settings and shared controls

All five switches below were visible live. They currently save profile preferences, not the stated behavior.

| ID | Location / exact control | Required completion | Evidence |
|---|---|---|---|
| B23 | Account settings → **Daily email digest** | **FIX.** Build the 8 AM digest, recipient opt-in, timezone handling, scheduler, and actual send path. | [Notification preferences](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:864) |
| B24 | Account settings → **Slack alerts** | **FIX.** Build outbound mentions/status alerts with destination mapping and opt-out handling. Incoming Slack sync does not implement this switch. | [Notification preferences](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:864) |
| B25 | Account settings → **Desktop push** | **FIX.** Implement browser notification permission and delivery while open; add a subscription/service worker if background push is intended. | [Notification preferences](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:864) |
| B26 | Account settings → **Quiet hours** | **FIX.** Apply after-7-PM suppression/defer rules to actual notification delivery using the member/workspace timezone. | [Notification preferences](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:864) |
| B27 | Account settings → Security → **Two-step sign in** | **FIX, high priority.** A saved `mfa` boolean does not enroll or enforce an authenticator. Implement enrollment, code verification, sign-in challenge, and factor management. The current switch does not establish two-factor protection. | [Boolean-only action](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:865), [preferences write](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:470) |
| B28 | Brand → **Copy color**; live Projects → **Share** | **FIX, reliability.** Both can announce success without awaiting clipboard success. Share produced “Link copied” live, but clipboard contents were not inspected. Await success and show a copy fallback/error. Share is removed in the current dirty UI, so preserve an intentional product decision when deploying. | [Copy color](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:820); Share exists in `HEAD:lib/studio/vals.js:2505`, absent from current working file |
| B29 | Personal settings / saved board preferences → automatic save | **FIX, reliability.** Some preference/view-state save errors are logged only to console while the UI says changes save automatically. Surface failed persistence and retain a retryable state. | [Preference save](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:470), [board-state save](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:940) |

### Local column and Ideas controls: repair before deployment

The following are established from local source. The richer Ideas controls were not present on the live screen inspected; do not mistake these for reproduced production bugs.

| ID | Location / control | Current behavior and required completion | Evidence |
|---|---|---|---|
| B30 | Projects → Add column → **Created time → Create column** | **FIX.** Creates an ordinary editable date field; no system-kind marker or population from project creation time is implemented. Bind it to the immutable timestamp and render read-only. | [Type mapping](/Users/Mac/dev/Sambox-FTGU/lib/studio/model.js:22), [described behavior](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:1427), [field creation](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:748) |
| B31 | Same → **Last edited by → Create column** | **FIX.** Creates an ordinary person field; no last-editor tracking populates it. Add authoritative attribution and read-only system-column handling. | [Type mapping](/Users/Mac/dev/Sambox-FTGU/lib/studio/model.js:22), [field configuration](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:748) |
| B32 | Ideas → Board → **Needs review / Ready to produce / Archived** | **FIX.** Board filtering bypasses these selected smart-view predicates and always excludes archived ideas. Archived can show active cards. Apply the selected view consistently in Gallery, List, and Board. | [View predicates](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:120), [board bypass](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:186) |
| B33 | Ideas → **Board** layout | **FIX.** In-production ideas count toward board totals but there is no column/card for them. Add an appropriate column or exclude them consistently with a visible handoff to Projects. | [Only three columns](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:187) |
| B34 | Ideas → Edit → **Clear score**, then **Save changes** | **FIX.** Clears local preview but omits score fields from the save, leaving previous scores stored. Explicitly persist cleared/null scores. | [Save patch](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:403), [Clear score](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:459), [database mapping](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:329) |
| B35 | Research run → **Show ideas / Show new ideas** | **FIX.** A multi-idea run opens the brand's research ideas rather than filtering to that run. Use the selected run ID/idea IDs. Single-idea runs open their one idea correctly. | [Run navigation](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:656) |
| B36 | Ideas → Edit → **Save changes** | **FIX, reliability.** Closes the editor even after a failed update, losing the draft. A cover-upload failure can also be followed by a text-save success message. Keep the editor/draft and show the precise outcome until all requested work succeeds. | [Save sequence](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:398), [cover failure return](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:397) |
| B37 | Ideas → **Promote to project → Create project** | **FIX, reliability.** Project creation and idea linking are separate; linking is not awaited before closing. Failed linking can leave an unlinked project and make retry create another project. Make promotion atomic or explicitly recoverable. | [Unawaited promotion](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:2357), [link update](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:429) |
| B38 | Ideas → move/Archive and **Undo** | **FIX, reliability.** Success/Undo can appear before persistence completes. Show confirmed success after the write, and restore the previous state on failure. | [Optimistic move flow](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:167) |

## 2. Configuration-dependent buttons and current live state

The live Integrations page reports **1 of 10 connected**. Automations reports **1 of 14** because it also counts the four placeholder connectors. “Connected” is a saved connection status, not proof that generation, imports, or email delivery were successfully exercised during this audit.

| ID | Button / feature | Live state | What must be configured or verified |
|---|---|---|---|
| C01 | **Connect Claude**, model selector, **Use for assistant** | Not connected | Anthropic API key, accessible model, and usable account quota. Optional alternative to the already selected OpenAI provider. |
| C02 | **Save OpenAI**, model selector, **Used by the assistant**, Daily **Send message** and quick actions | Connected; selected model `gpt-6-luna` | Connection exists. Verify real chat/tool generation and credits. No model call was submitted in this audit. |
| C03 | **Connect Gemini**, model selector, **Use for assistant** | Not connected | Google API key, accessible text-generation model, quota. Optional alternative AI provider. |
| C04 | **Connect monday.com / Sync now** | Not connected | API token and Board ID; status/job columns and mapping as needed. Initial sync; public HTTPS `APP_BASE_URL` and webhook signing configuration for inbound live updates. Current push path updates linked status, not all project fields. |
| C05 | **Connect Apify** and research source selections | Not connected | API token, actor access, credits. Enables configured YouTube/TikTok/Reddit/Google research actors. |
| C06 | **Connect Browserbase** and research YouTube search | Not connected | API key, matching Project ID, available browser sessions. |
| C07 | **Connect Firecrawl**, research Web articles, assistant web search/read | Not connected | API key and credits. Enables web gathering; does not itself supply an AI model. |
| C08 | **Connect Slack / Sync now / Open Integrations** in Inbox | Not connected | Installed Slack app/bot token, scopes, bot membership/channel selection. Signing secret and Slack Events URL/subscriptions for live messages and replies. Inbound setup does not enable the missing outbound-alert features. |
| C09 | **Connect YouTube / Sync now**, Content Videos | Not connected; zero imported videos | Enable YouTube Data API v3, use a server-compatible API key, add channel IDs/@handles, run initial sync. Match project video URLs for project metrics. Public API-key integration does not enable retention/impressions or publishing. |
| C10 | **Connect Buffer / Sync now**, Content Social | Not connected; zero imported posts | Buffer personal API key and connected channels, then initial sync. Connector reads sent posts/metrics. Does not publish/schedule posts or import conversations. |
| C11 | **Run research** | Not shown on live Ideas screen; no research source connected | Super Admin + brand + selected AI + at least one of Apify/Browserbase/Firecrawl. All three source services are not required. Deploy the intended Ideas UI and verify a bounded real run. |
| C12 | Users **Add user / Send invite / first Resend invite** | Real routes exist; two pending invitations visible | Server `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, verified `EMAIL_FROM`, correct `APP_BASE_URL`; valid role/account/view selection. Check actual delivery and acceptance separately. B03 still requires a code fix. |
| C13 | Sign-in **Email link / Forgot password**, Settings **Change** password, profile email change | Implementation exists; delivery not exercised | Supabase Auth email/SMTP, allowed redirect URLs, production site URL, templates, email confirmation/recovery flow. These use Auth configuration separately from Resend invitations. |
| C14 | Assignment/revision/approval/deadline emails; local **Email alerts** switch and supported workspace Email boxes | Built locally; absent/newer UI elements not visible live | Notification migrations/outbox, Resend sender/key, server secret, public link base. Configure an actual external scheduled call to `/api/notifications/send` with `CRON_SECRET` for unattended delivery; README recommends every 15 minutes. Verify a provider receipt and recipient delivery. |
| C15 | Automatic integration refresh | Manual sync endpoints exist; actual production scheduler unverified | Schedule `/api/integrations/{provider}/sync` for monday, Slack, YouTube, Buffer using `CRON_SECRET`, at suitable provider/quota intervals. Repository documentation says schedules were not configured; an out-of-repo Railway job could exist and was not checked. |
| C16 | Project **Upload file / Add file / Upload cut / Upload thumbnail / Attach / Open / Download** | Older Assets UI visible; uploads not exercised | Private `project-assets` bucket, migrations/policies, role permissions, file metadata, working signed URLs. Newer document/attachment UI needs deployment. |
| C17 | Brand **Upload / Download**, local idea-cover upload/brand-file selection | Brand file entries visible; operations not exercised | `brand-assets` and `idea-covers` buckets/policies, migrations, storage limits, signed URLs. Keep original media intact. |
| C18 | New project → Channel → **Add channel** | **No channels yet** live | Add actual production channel(s) and assign the two projects. A channel brand can also establish a channel. This is workspace setup, not a dead Add channel button. |
| C19 | Project assignment/status/review controls | Workload reports unassigned projects | Assign editor/designer, due dates, and actual review URLs/files. Populate sponsor/client mappings and approvers where applicable. These controls have real writes and role guards. |
| C20 | **Dictate** | Browser speech implementation exists; not exercised | A browser supporting SpeechRecognition and microphone permission. No audio was recorded. |

Configuration evidence: [provider registry and required fields](/Users/Mac/dev/Sambox-FTGU/lib/integrations/registry.ts:42), [real integration routes](/Users/Mac/dev/Sambox-FTGU/app/api/integrations/[provider]/route.ts:28), [sync route](/Users/Mac/dev/Sambox-FTGU/app/api/integrations/[provider]/sync/route.ts:11), [environment example](/Users/Mac/dev/Sambox-FTGU/.env.example:1), [scheduler documentation](/Users/Mac/dev/Sambox-FTGU/docs/integrations-plan.md:154), [notification endpoint](/Users/Mac/dev/Sambox-FTGU/app/api/notifications/send/route.ts:8).

## 3. Every existing navigation section: built versus unfinished

| Section | Classification | Built | Unfinished / blocked |
|---|---|---|---|
| **Daily** `/daily` | FUNCTIONAL; provider execution to verify | Chat history, new chat, search, quick prompts, board summaries, proposal confirmation handlers, browser dictation. OpenAI selected live. | Web search requires Firecrawl. Audience data requires imports. Real AI generation/tool execution not tested. |
| **Projects** `/projects` | PARTIAL | Real board, five layouts, filters/sort/group/properties, custom columns, To-Dos, project drawer, workflow status actions, archive/restore, sharing in live build. | No channels configured; projects missing assignments. B20–B22, B30–B31. No title/job-number edit surface after creation; those cells open the project and action writer has no corresponding edit branch. Newer Files features need deployment. |
| **Ideas & Research** `/ideas` | PARTIAL; substantial local work | Production has simple idea capture, type/brand/status filters, detail, edit/archive/status/comment/history. Local version adds rich briefs/covers, views, board, scoring, references, review/promotion and research controls. | Local B32–B38. Research sources disconnected. Collaboration/research recovery and brief handoff gaps below. New design not live. |
| **Brand** `/brand` | PARTIAL; substantial implementation | Brand creation/edit, logos/files, colors/fonts/voice/rules, references, downloads are implemented. Live has populated sponsor kits and real file controls. | New sponsor brand's “No account / link later” option has no later account selector in Edit brand. Add account reassignment; B28 clipboard handling. No channel brands configured live. |
| **Inbox** `/inbox` | PARTIAL / inbound setup needed | Notifications, Activity, Messages, unread filters, mark read/all read, source/project links. Real activity visible live. | Slack disconnected. No in-app reply composer. Buffer conversations unavailable in current connector. Notification preference enforcement incomplete (B13–B15). |
| **Content** `/content` | PARTIAL / imports unconfigured | Videos/Social tabs, filters, links, public video metrics, sent-post metrics, connect/sync actions. | YouTube/Buffer disconnected. Advanced YouTube Analytics, publish/schedule actions, and social history pagination absent. Empty screens are not mock pages. |
| **Users** `/admin/users` | PARTIAL | Real invitations, copy link, role promotion/demotion, deactivate/reactivate/remove; self/owner protections. | Repeat resend bug B03. Full arbitrary existing-user role/view/account editing UI is not provided; current role-change shortcuts are Make Super Admin/Make Editor. Actual invite delivery unverified. |
| **Roles & Permissions** `/admin/roles` | PARTIAL | Permission matrix persistence, role view defaults, visible-field summaries. | Some advertised grants cannot affect the role-hardcoded UI (B22). Comment edit/delete grants have no matching comment-management controls; asset-edit grants lack metadata-edit UI. Visible fields here are informational; board property sheets provide actual visibility controls. |
| **Workload** `/admin/workload` | FUNCTIONAL; configuration needed | Real workload/attention lists, project navigation, deadline defaults and database-backed workflow rules. | Two projects reported unassigned live. Capacity is fixed at five items per person; no capacity editor. Fixed capacity is a limitation, not a dead control. |
| **Clients & Sponsors** `/admin/clients` | PARTIAL | Account add/remove, account selection, linked projects, portal/draft/comment/approval access switches. | Portal invite button is log-only (B02). Creating an account does not itself invite its contact; use Users → Add user with the account. Existing live accounts show invited but no linked projects. |
| **Finance** `/admin/finance` | PARTIAL | Four table views: Project budgets, Sponsor revenue, Client payments, Contractor payouts; totals, CSV, some bookkeeping status updates. | No create/edit record forms for budgets/deals/invoices/payouts. No invoice document/send/reminder delivery, payment collection, payout transfer, reconciliation, or connected finance provider. B04–B05. All four views empty live. |
| **Automations** `/admin/automations` | PARTIAL UI; execution PLACEHOLDER | Definition create/delete, filters, enabled flags, connector navigation, saved run/notification settings. | No runner, usable structured action configuration, existing-workflow editor, real execution history, retry/failure/test/retention behavior. B06–B19. Zero workflows live. |
| **Activity Log** `/admin/logs` | FUNCTIONAL; bounded history | Database activity, categories/search, CSV and project navigation. | Loader caps history at 400 entries; no full-history pagination. Export should not be represented as an unlimited audit archive. |
| **Workspace Settings** `/admin/workspace` | PARTIAL | General settings, project statuses, field metadata, template cards, ten managed integration forms. | Template management/checklists, week-start effect, settings-created field activation. B01, B20–B21. Unsupported connectors exist in Automations rather than managed settings. |
| **Account settings** `/settings` | PARTIAL | Profile, email change, theme/density/default view, password reset, local/global sign out; newer local email-alert opt-out. | Five preference-only features B23–B27. New Email alerts UI not visible live. B29 save-error reporting. |

Supporting sources: [navigation and role gates](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:1594), [project write branches](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:47), [brand creation/account promise](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:712), [brand editor](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:745), [finance models](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:252), [loader limits](/Users/Mac/dev/Sambox-FTGU/lib/studio/load.js:53).

## 4. Missing feature buildouts within those sections

These are section-level gaps, including workflows for which there is not yet a button to click.

### Automations

The six available outcome choices are all metadata-only until a runner is built:

1. Notify Super Admin in Slack.
2. Email the assigned editor.
3. Email the assigned designer.
4. Move Status to the next step.
5. Create a To-Do for Super Admin.
6. Send a webhook to n8n.

The UI also offers triggers for Filming, revision, thumbnail review, sponsor approval, an admin mention, and a publishing-date deadline. These require event/schedule evaluation and explicit parameters. Existing **database workflow rules in Workload are separate and implemented**, including distribution tasks on Live; do not replace or misclassify them as missing automation execution. [Automation choices](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:539), [distribution trigger](/Users/Mac/dev/Sambox-FTGU/supabase/migrations/20261020000300_triggers_rpcs.sql:129).

### Finance and templates

- Finance needs creation/editing of budgets, sponsor deals, invoices, and payouts before users can populate its empty tables from the app. “Approve payout” changes bookkeeping status to Scheduled; “Mark paid” records a manual status, with no transfer. Preserve that distinction in labels and confirmation text. [Status writer](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:583).
- Templates need create/edit/duplicate/delete and an actual per-project checklist model/UI. Cards display 8/10/14 “steps” live, but creation does not materialize those steps. Project creation currently applies template reference and optional default assignees/deadlines using workspace offsets. [Template cards](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-admin.js:647), [project creation](/Users/Mac/dev/Sambox-FTGU/lib/studio/actions.js:1195).

### Ideas, research, and collaboration

- **Brief handoff:** promotion passes title/channel and links the idea. It does not transfer audience, promise, script/body, references, owner, priority, format, timing, or sponsor into a production brief. Provide a linked brief or explicit field transfer. [Promotion defaults](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:299), [creation payload](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:2353).
- **Realtime collaboration:** subscriptions omit `ideas` and `idea_comments`. Teammate changes may require reload or an unrelated subscribed event. Include the tables and a reconnect/polling recovery strategy. [Subscriptions](/Users/Mac/dev/Sambox-FTGU/components/studio/Studio.jsx:116).
- **Durable research execution:** jobs run inside Next `after()`; saved run IDs/progress exist, but interrupted server processes do not resume work. Stale-run cleanup occurs only on research requests, and Studio has no polling fallback. Add durable execution/recovery before claiming restart-safe jobs. [Route](/Users/Mac/dev/Sambox-FTGU/app/api/research/route.ts:17), [stale handling](/Users/Mac/dev/Sambox-FTGU/lib/research/run.ts:27).
- **Research history/evidence:** only the latest eight runs load and six display in the modal; no all-runs/retry/evidence drilldown. Raw gathered findings are transient. Source links and summaries are saved, but they do not replace inspection of the original run. [Run load limit](/Users/Mac/dev/Sambox-FTGU/lib/studio/load.js:113), [modal runs](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:697), [execution/results](/Users/Mac/dev/Sambox-FTGU/lib/research/run.ts:145).
- **Research setup/disconnected state:** the modal/history is hidden when required AI/source connectivity is lost. Keep history accessible and show a direct setup CTA. [Availability gate](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-ideas.js:615).
- **Script tab:** the local tab renders beats from the same idea body; it is not a separate script editor/versioning workflow. Decide whether editing the shared body fulfills the intended script workflow before advertising a dedicated script workspace.

### Content, Inbox, files, and analytics

- **YouTube retention/impressions:** OAuth YouTube Analytics is not built. Public-data sync retains/defaults these fields rather than fetching real Analytics measurements. Do not present default zeros as measured performance. [Provider snapshot](/Users/Mac/dev/Sambox-FTGU/lib/integrations/providers/youtube.ts:246).
- **Publishing:** neither the YouTube nor Buffer connector implements uploading/scheduling/publishing from FTGU. Project Scheduled/Live statuses and imported sent posts do not publish content externally. [Buffer sent-post query](/Users/Mac/dev/Sambox-FTGU/lib/integrations/providers/buffer.ts:93).
- **Social history:** filtered Buffer posts are cut to 100 in the UI without Load more/pagination. [Display cap](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:614).
- **Unified replies:** Inbox is an incoming aggregator with mark-read and source-app links. It has no reply composer. Buffer comments/mentions/DMs are not available through this connector; connecting its key will not fill those conversations. [Inbox rows](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals-pages.js:450), [Buffer limitation](/Users/Mac/dev/Sambox-FTGU/lib/integrations/providers/buffer.ts:21).
- **Project comment management:** comments can be posted, but there is no edit/delete comment surface even where the permissions matrix offers those grants. Local attachments/files provide useful file handling; native timecoded media review remains the unbuilt Frame.io scope. [Comment rendering model](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:1922).
- **Long-range dates:** built-in film/publish/deadline dates are displayed as month/day and reparsed as the nearest year for calendar/timeline calculations. Historical/far-future dates can land in the wrong year. Keep canonical ISO dates for calculations. [Date conversion](/Users/Mac/dev/Sambox-FTGU/lib/studio/model.js:35), [calendar parser](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:123).
- **Calendar overflow:** only three events per day render; “+N more” is informational text, without an expand/day-detail action. Add a day drilldown so every event is reachable. [Three-event slice](/Users/Mac/dev/Sambox-FTGU/lib/studio/vals.js:1540).

There are **no dedicated Analytics or Help navigation sections** in this app. Analytics are embedded in Daily/Content, and guidance exists in the Daily assistant. Separate pages would be new product scope, not repairs to broken existing pages. No separate global Asset Library exists; assets live in Brand and project drawers.

## 5. Local work not visible in production

These are deployment gaps observed from the live UI, not claims that the local work is release-ready or that its database migrations are deployed.

| Feature | Production inspected | Local checkout |
|---|---|---|
| Project drawer | Overview / Assets / Comments / History; basic Upload file; no Widen control | Overview / Comments / Files / Activity; Widen panel; file grid/list, search/type filters, document handling, attachment previews and drag/drop. Much of this already exists in local HEAD; production is older. |
| Ideas workspace | Simple search, brand/type/status chips and idea cards | Rich Gallery/List/Board, smart/saved views, full briefs, scored prioritization, richer review/promotion, cover controls and structured references. Significant pre-existing uncommitted work. |
| Idea detail | Basic edit/archive/status/comments/history | Overview / Script / References / History with structured brief metadata, covers, review controls and richer editor. |
| Notification preferences | Four personal notification switches; no Email alerts opt-out; older five-event matrix includes unsupported email choices | Email alerts opt-out; explicit revision event; supported/unsupported email boxes differentiated. These differences are largely already in HEAD. |
| Dev Notes | No dock visible in the inspected live app | Super Admin Dev Notes component, hotkey, and an untracked migration/documentation. |
| Share | Visible live; announces Link copied | Exists in local HEAD but is removed by the current uncommitted UI. Confirm the intended result before releasing the dirty UI. |

Review and apply the required migrations, then validate the chosen release in Railway. A commit or a successful build alone will not prove that the live site serves these features.

## 6. Existing controls that should not be mistaken for unfinished work

- Project layouts, view/filter/sort/group/property controls, column schema actions, statuses, custom values, To-Do completion/addition, activity links, drawer navigation, workflow advancement and approvals have real handlers. Read-only fields and role-based restrictions are intentional in many places.
- **Share** is a URL-copy action in production, not a public-access grant or invitation dialog. Its label could be clearer; no missing permission grant should be inferred from that button alone.
- Workload's sponsor approval requirement, post-Live lock, editor status rule, deadline defaults, and distribution task creation have actual backend consumers.
- User invitation email routes, role changes, deactivate/reactivate/remove, account access toggles, profile/auth actions, and exports have implementations. They still require validation of the actual write/delivery outcome.
- Brand editing and uploads are implemented. The README's old “Brand kit ... editing” not-built claim is stale and should be updated.
- Ideas capture/edit/comment/archive/review, covers, saved views and research are substantial implementations locally. The listed defects and release gap do not make the whole section a placeholder.
- Ten integration providers have real verification/secret-storage handlers. **Manage** buttons in Automations intentionally navigate to Workspace Settings; they are not supposed to connect directly.
- Empty tables or “No messages yet” alone are not proof of an unbuilt section. Live Content is empty because import services are disconnected; Finance additionally lacks entry controls.

## 7. Recommended completion order and acceptance checks

| Priority | Work package | Acceptance evidence |
|---|---|---|
| 1 | Correct misleading actions: two-step switch, invoice/reminder sends, portal invites, dead template editor | Two-step requires a real challenge; emails have provider-confirmed receipts/errors; portal invite creates the right account membership; every template edit persists after reload. |
| 2 | Finish automation execution and action configuration | One saved trigger produces its intended durable action; run history links input/output; retries do not duplicate effects; pause/test/retention settings demonstrably change execution. |
| 3 | Finish Finance and Templates data entry | A user can create/edit each finance record type, generate/send a real invoice, and instantiate/complete a template checklist without database-console intervention. |
| 4 | Configure actual studio data and required providers | Channels and assignees exist; YouTube/Buffer/Slack sync imports real records; research runs with one configured source; optional alternative AI providers are only connected if needed. |
| 5 | Deploy the intended local UI after repairing its listed defects | Railway serves the newer Files and Ideas screens after a fresh load; migrations/storage policies match; rich-idea saves, cleared scores, filtered boards, promotion and file handling pass real role-based flows. |
| 6 | Complete notifications and unattended operation | Supported preferences suppress/send the right channels; no-user-online deadline/sync jobs execute; digest/quiet-hours behavior is checked in the intended timezone. |
| 7 | Close secondary workflow gaps | Role grants match reachable controls, system columns populate correctly, history/day-overflow pagination exists, canonical dates retain their year, research survives interruption and has usable history. |

Release recovery: preserve the current dirty work, choose a reviewed commit rather than deploying an arbitrary mixed checkout, record the previous Railway deployment, use backward-compatible migrations, and validate the chosen build before replacing it. No release, configuration change, or repair was performed as part of this audit.

