# Workflow Builder, SantosStudios · build handoff

Generated 2026-11-17 from the Design canvas "Workflow Builder · Three Brands" (9 artboards in this package: the shared spec plus 8 SantosStudios screens).
Target: Next.js 16 App Router, React 19, plain JSX (no TypeScript), Tailwind 4, Supabase. Repo: Sambox-FTGU.

## What this is
A visual workflow builder for SantosStudios: a hub that lists automations with a live mini preview of each flow, a top to bottom canvas where a person builds a flow from a trigger and steps, and the supporting screens (run detail, settings, trigger setup, condition builder, connectors, approvals). The one job it must do well: let a non-technical admin build a flow, see exactly what is broken, test it on sample data, and turn it on only when it is safe.

The same feature ships in all three apps (Parish Tactical Hub, SantosStudios, ZZMEDIA Dashboard) with the same data model and rules. Only tokens, type, shapes and copy change. Main.png shows the shared contract.

## How to read this package
- START-HERE.md: the kickoff prompt.
- HANDOFF.md: this spec. Read fully before writing code.
- screenshots/: look at every PNG before building its screen. The picture is the source of truth when prose and picture disagree. Main.png is the shared spec board, not a screen.
- html/: static HTML per artboard, default state only. Copy structure, spacing and inline values from here. Do not ship this HTML as is; it has no components, no data, no handlers.
- source/: the canvas sources (`.dc.html`). The modal states not visible in screenshots (New workflow, Step finder, Test run drawer, Review and turn on, Ask Studio Assistant, toasts) live here. Read the markup inside `sc-if` blocks named `mAdd`, `mAi`, `mReview`, `runView`, `hasToast`, `peek` in Santos-Builder.dc.html and `modal`, `mBlank`, `mTpl`, `mAi`, `hasPrompt` in Santos-Hub.dc.html. The `renderVals()` method shows the sample data shapes.
- tokens-candidates.json: every color, font, size and radius the artboards use, with counts.
- spec/: not included. HANDOFF.md is the spec.

## Target stack and conventions
Next.js 16 App Router, React 19, plain JSX (no TypeScript), Tailwind 4, Supabase.

Upgrade the existing automation feature. Do not start a parallel one.

- `components/studio/FlowBuilder.jsx`: `CreateFlowDialog` (becomes NewWorkflowModal), `FlowBuilder({D, A, row, onClose, goConnect, review})` (builder shell; keep the prop contract, add what this spec needs), `FlowLayer` (canvas layer). ACTION keys `slack_admin, email_editor, email_designer, status_next, todo_admin, webhook_n8n, buffer_publish` stay the action ids behind the step library.
- `components/studio/IdeaAutomations.jsx`: existing automations list. Becomes the hub cards or feeds them.
- Primitives in `components/studio/Prims.jsx` with styles in `lib/studio/prims.js`: Icon, Popover, MenuRow, Field, Toggle, Segmented, Chip, Dot, Button. Use these, do not create parallels. Toggle is the workflow switch. Segmented is every segmented control (status, Schedule/Event/Webhook, All/Any, Preview/Edit). Chip is the variable chip. Dot is the status dot.
- API: `app/api/automations/[id]`, `app/api/automations/run`, `app/api/automations/runs`. Run history and RunDetail read `automation_runs`.
- Existing docs: `handoff/` and `docs/design/`. This package lands next to them.
- Plain JSX: keep new files `.jsx`. Validate the graph shape at the API boundary with a small schema helper rather than adding TypeScript.

### Data contract
One graph shape, identical in all three apps. Store it in the existing workflow record.

```
workflow { id, name, description, owner, status: 'live' | 'off' | 'draft', trigger: Trigger, steps: Step[], settings: Settings, lastTest?: TestResult, updatedAt }
Trigger  { type: 'schedule' | 'event' | 'webhook', key, filters: Filter[], schedule?: { rule, tz } }
Step     { id, kind: 'trigger' | 'data' | 'action' | 'logic' | 'ai' | 'human', title, app, outward: boolean, br?: { yes: Step[], no: Step[], yesLabel, noLabel }, fields: Field[] }
Field    { label, value, vars: VarRef[], required: boolean }
VarRef   { id, label, fromStepId }        // rendered as a named chip, never as raw {{path}}
Settings { retries: number, retryWait: '1m' | '5m' | '15m', alert: string[], autoOffAfter: number, approvalTimeoutHours: number }
Run      { id, workflowId, status: 'passed' | 'failed' | 'running' | 'waiting', startedAt, tookMs, trigger summary, steps: RunStep[], log: LogLine[] }
RunStep  { stepId, status, tookMs, received: KV[], returned: KV[] | null, error?: { what, fix: 'connect' | 'retry' | 'edit' } }
Approval { id, runId, workflowId, stepId, draft: { to, subject, body }, context: KV[], reason, after, waitingSince, expiresAt }
Connector { key, name, status: 'connected' | 'not_connected' | 'expired', usedBy: workflowId[], can: string[], activity: LogLine[] }
```

Status words on screen are Live · Off · Draft. Store the neutral values above and map in a copy file.

### Rules the UI enforces (from Main.png)
1. One trigger per workflow. Picking a new trigger replaces it.
2. A step with an empty required field or an unconnected app shows a fix badge. The top bar shows the total as "N to fix".
3. Picking the Live state while not ready opens the Review and turn on checklist instead of switching.
4. Any edit clears the last test result. Turning on needs a fresh passing test.
5. Steps that reach people outside the team carry an outward badge and need an approval step before them.
6. Brand lives in one theme token file and one copy file (agent name Studio Assistant, status words, step library, trigger list). Feature code stays shared in shape with the other two apps.

## Screens and routes
| Artboard | Screen | Route or trigger | Kind | Frame | Files |
|---|---|---|---|---|---|
| Main.dc.html | Shared spec board | reference only | component sheet | 1440×1100 | screenshots/Main.png · html/Main.html |
| Santos-Hub.dc.html | Automation Management hub | existing admin automations route | page, fluid | 1440×1100 | screenshots/Santos-Hub.png · html/Santos-Hub.html |
| Santos-Builder.dc.html | Workflow builder | existing FlowBuilder mount | page, fluid | 1440×900 | screenshots/Santos-Builder.png · html/Santos-Builder.html |
| Santos-Run.dc.html | Run detail | <automations route>/runs/[runId] (new) | page, fluid | 1440×900 | screenshots/Santos-Run.png · html/Santos-Run.html |
| Santos-Settings.dc.html | Workflow settings | builder ?panel=settings | dialog | 1440×900 | screenshots/Santos-Settings.png · html/Santos-Settings.html |
| Santos-Trigger.dc.html | Trigger setup | builder ?panel=trigger | dialog | 1440×900 | screenshots/Santos-Trigger.png · html/Santos-Trigger.html |
| Santos-Condition.dc.html | Condition builder | builder ?panel=condition&step=<id> | dialog | 1440×900 | screenshots/Santos-Condition.png · html/Santos-Condition.html |
| Santos-Connectors.dc.html | Connectors | <automations route>/connectors (new) | page, fluid | 1440×900 | screenshots/Santos-Connectors.png · html/Santos-Connectors.html |
| Santos-Approval.dc.html | Approval detail | <automations route>/approvals/[id] (new) | page, fluid | 1440×900 | screenshots/Santos-Approval.png · html/Santos-Approval.html |

Screen flow (every screen links back to the hub or builder):
- Hub to Builder: card click, Set up, Use template, New workflow. Hub to Run detail: Runs tab row, View failed run, failed-run alert. Hub to Approval detail: Approvals tab row, Review the queue. Hub to Connectors: Connectors tab, alert banner Connect button. Stat cards switch tabs.
- Builder to Hub: back. Builder to Run detail: Runs. Builder to Settings: Settings. Trigger card inspector to Trigger setup. Branch card inspector to Condition builder. Approval card inspector to Approval detail. Unconnected step to Connectors (Manage all connectors).
- Run detail to Hub: back. To Builder: Open workflow. Failed step fix button to Connectors.
- Settings, Trigger, Condition close to Builder. The secondary button reads Cancel until a save, then Back to builder.
- Connectors to Hub: back. Used by rows to Builder.
- Approval detail to Hub: back. Open workflow to Builder. Approve or Reject shows a status line, then loads the next item.

## Design tokens
- Page ground `#EBEBEB`. App frame `#FFF`, radius 20, margin 14. Panels `#FFF`. Subtle grounds `#FAFAFA`, `#F5F5F5`, hover `#F0F0F0`.
- Borders `#E6E6E6` (cards), `#E3E3E3` (canvas cards, chips), `#EDEDED` (dividers), `#DADADA` (inputs, round buttons), `#CFCFCF` (hover).
- Canvas: `#FAFAFA` with `radial-gradient(#DEDEDE 1px, transparent 1px)` at 16px.
- Text primary `#111`, secondary `#333` / `#444` / `#555`, muted `#666` (min 12px), placeholder `#8A8A8A`.
- Accent is ink: buttons `#111`, hover `#2B2B2B`, text `#FFF`. Links `#2F5BEA`, hover `#1E3FB0`. Variable chips `#2449C7` on `#EAF0FF`, selected ring `#2F5BEA`. Focus ring `2px solid #111`, offset 2px.
- Status: Live `#1F7A45` on `#E6F5EC`. Draft and warning `#8A5A00` / `#7A5300` on `#FFF4D6`. Error `#B42318` on a pale red ground with a pink border (alert banner). Off: grey dot `#666`.
- Step kinds (30px tile, radius 9): trigger `#8A5A00` on `#FFF4D6` label Trigger, data `#2449C7` on `#EAF0FF` label Board, action `#1F7A45` on `#E6F5EC` label Action, logic `#B4470E` on `#FFEDE1` label Logic, ai `#5B3FC4` on `#F0EBFF` label Assistant, human `#444` on `#F1F1F1` label Approval.
- Type: Montserrat 800 to 900 for page and modal titles. Inter 400 to 700 for everything else. Sentence case labels. Sizes used: 38, 32, 30, 24, 22, 18, 17, 16, 15, 14 (base), 13, 12, 11.
- Radii: 999 (pills, segmented, switches, chips in filters), 16 (workflow cards, canvas cards, modals), 12 (buttons, inputs, stat cards), 9 to 10 (preview chips, icon tiles), 20 (app frame).
- Spacing steps: 2, 4, 6, 8, 10, 12, 16, 20. Card padding 14px 16px on canvas, 18px 20px on stat cards.
- Shadows: cards `0 1px 2px rgba(0,0,0,.04)`, hover `0 4px 16px rgba(0,0,0,.06)`, modals larger and soft.
- Control heights: primary 46, secondary 40, segmented 36, inputs 44, preview chips 28, plus button 34.
- Map to `lib/studio/prims.js` values first. Add a value only where none matches.

## Component inventory
Names below are the target component names. "Built from" says what to reuse.

### WorkflowShell
- Purpose: app chrome around the hub, run detail, connectors and approval pages.
- Appears in: Santos-Hub (sidebar plus main), Santos-Run, Santos-Connectors, Santos-Approval (back link plus breadcrumb row).
- Anatomy: Hub sits inside the white app frame with the studio sidebar (Daily, Projects, Ideas & Research, Inbox, Content, Admin group). Eyebrow reads Admin · Super Admin only. Tab is Run history, not Runs. Status filter adds From Assistant.
- States: sidebar hidden under 900px, main padding becomes 24px 16px 48px.
- Built from: existing app sidebar and topbar.

### StatCard
- Purpose: one number with a link line. Clicking switches the hub tab.
- Appears in: Santos-Hub stat strip, four cards: Live workflows, Runs this week, Failed this week, Waiting on approval.
- Anatomy: label, big number (failed count in error color when above 0), link line with chevron.
- States: default, hover (border to hover color), focus ring.
- Built from: existing KPI or metric card primitive.

### AlertBanner
- Purpose: one blocking issue across workflows, with up to two actions.
- Appears in: Santos-Hub top ("Slack is not connected. 3 workflows use it and 1 run failed yesterday."), Inspector and Connectors detail in warning tone.
- Variants: error (hub), warning (inspector, connectors detail). Actions: secondary (View failed run), primary (Connect).
- States: hidden when nothing is blocking.

### HubTabs, StatusFilter, Search
- Tabs: Workflows, Templates, Runs (Santos: Run history), Approvals, Connectors. Each carries a count. Approvals count is filled when above 0. Connectors shows "N of M".
- StatusFilter: All, Live, Off, Draft, From Assistant, each with a count. Single select.
- Search: filters cards by name and step titles.
- Empty: "No workflows match" line with a Clear filters link (`noneShown` in source).

### WorkflowCard
- Purpose: one workflow, preview first.
- Appears in: Santos-Hub grid, 3 columns at 1440.
- Anatomy: FlowPreview region (248px tall, dot grid), footer with bold title (16px, weight 700), status dot plus status word plus last run line, then a switch for Live/Off or a primary "Set up" button for drafts. Agent-made drafts carry a "Studio Assistant" tag top right of the preview.
- States: hover (border tint), focus, draft (Set up instead of switch, reason line such as "Slack not connected" or "Needs a trigger"), off (grey dot, "Off since <date>").
- No boxes inside boxes. The preview is a flat region, the footer is plain text on the card ground.

### FlowPreview
- Purpose: a readable mini map of the flow.
- Anatomy: vertical stack of step chips joined by 1px connector lines. Branch steps show two labeled lanes under them (check plus yes label, cross plus no label) and continue the main line.
- Chip: 28px tall, padding 0 11px 0 3px, `#FFF`, 1px `#E3E3E3`, radius 9, shadow `0 1px 2px rgba(0,0,0,.05)`, 22px icon tile radius 6 in kind ground. Weight 600, 12px.
- Long flows: show up to 7 chips, compress the middle rather than scrolling.
- Variable values and schedules never show raw. "Publish in 2 days", not a cron string.

### TemplateCard
- Same preview region as WorkflowCard. Footer: bold title, primary "Use" button, two-line description (clamped), "Needs <apps>" line.

### BuilderTopBar
- Anatomy left to right: back link, workflow name (bold), status segmented control (Live · Off · Draft), fix count pill ("1 to fix", warning tone), save state text (Saved, Saving, Unsaved), then Runs, Settings, Ask Studio Assistant, Test run, Save, and the primary Review and turn on.
- States: fix count hidden at 0. Review and turn on disabled styling is not used; it opens the checklist which shows what is left.

### StepLibrary (left panel)
- Tabs: Steps, Overview. Search field. Help line: "Click to add at the end. Use + on the canvas to add between steps."
- Groups by kind (Trigger, then data, action, logic, AI, approval) with icon tile, bold title, one-line description.
- Overview tab: workflow name, description, counts, last test (`lOver` in source).

### FlowCanvas
- Dot-grid ground, cards centered in one column, 1px connector lines, round plus buttons between cards (34px).
- Floating zoom stack bottom right: plus, percent, minus, fit. Floating count pill bottom left: "5 steps · 1 to fix".
- Keep reactflow or the existing canvas engine; disable free dragging so the column layout holds.

### StepCard
- Size and style: 380px wide, `#FFF`, 1px `#E3E3E3`, radius 16, shadow `0 1px 2px rgba(0,0,0,.04)`, padding 14px 16px, gap 10. Selected: border `#2F5BEA`.
- Anatomy: kind icon tile, eyebrow "Step N · Kind" in kind color (trigger reads "Trigger"), bold title (17px), one-line description, app tag at the bottom.
- Branch variant: two lanes inside the card, "If yes" with the yes action in success tone, "If no" with the no action in neutral tone.
- Badges: fix (warning tone, "Fix"), outward ("Outward"), connect needed (`needConn`).
- Run states during a test: waiting, running (pulse), ok (check), failed (cross plus jump-to-fix). See `n.isWait`, `n.isRun`, `n.isOk`, `n.isFail`.
- States: default, hover, selected, focus.

### StepFinder (modal)
- Opens from a plus button. Search, kind chips, "Suggested after <previous step>" list, full list, empty state "No steps match" (`noResults`).

### Inspector (right panel)
- Header: kind tile, eyebrow "Step N · Kind", bold title, app name.
- Connector alert in warning tone with a full-width primary "Connect <app>" and a "Manage all connectors" link when the app is not connected.
- Fields: label, red asterisk for required, input that holds typed text plus VarChips. Required and empty shows an error line under the field (`f.miss`).
- "Add data to <focused field>" chip list. Clicking a chip inserts it into the focused field.
- Sample output row with Show toggle (`peek`). Footer: Duplicate, Delete (error tone outline). Trigger cards replace this body with a summary and an "Edit trigger" button to Trigger setup. Branch cards get "Edit condition". Approval cards get "Open approval".

### VarChip
- Named chip for a variable ("Editor in Slack", "Fix list", "Lead name"). Removable with an x inside the field. Never shows the underlying path.

### TestRunDrawer
- Bottom drawer from Test run. Runs each step on sample data, live status on every card, stops at the first broken step with "Jump to fix". Banner: "Nothing is sent." Pass state sets lastTest.

### ReviewChecklist (modal)
- Four checks: trigger set, every step set up, test passed, outward steps covered by approval. Each row links to the fix. Turn on button stays locked until all pass.

### AskAgent (modal)
- Prompt field, starter chips, Draft steps button. Result drops drafted steps on the canvas as unchecked cards to review. Name: Ask Studio Assistant.

### NewWorkflowModal
- Three starts: Blank (pick a trigger), From template, Describe it to Studio Assistant.

### RunDetail
- See § Screen by screen.

### SettingsModal, TriggerModal, ConditionModal
- Centered dialogs over a dimmed builder. Header eyebrow (workflow or step), display-font title, close x. Footer: change state text left ("No changes", "Unsaved changes", "Saved"), secondary Cancel or Back to builder, primary Save.

### ConnectorList and ConnectorDetail
- See § Screen by screen.

### ApprovalDetail
- See § Screen by screen.

### Small parts
- Switch: Live on and off. Real `button role="switch" aria-checked`.
- StatusPill and StatusDot: Live · Off · Draft plus Failed, Waiting on you, Connected, Not connected, Expired.
- Segmented: status, Schedule/Event/Webhook, All/Any, Preview/Edit, All/Needs attention.
- PrimaryButton: 46px, padding 0 20px, radius 12, `#111`, text `#FFF`, weight 600, 15px. Hover `#2B2B2B`.
- Toast: bottom center, one line, auto-dismiss (`hasToast`).

## Screen by screen

### Hub (Santos-Hub)
- Layout: sidebar, then main column. Eyebrow, display title, subtitle, New workflow (primary) top right. AlertBanner. Stat strip (4 columns). Tabs row with search right. Status filter row. Card grid, 3 columns. "Start from a template" heading with a line under it, then template grid, 3 columns.
- Behaviour: switch toggles Live/Off in place and persists. If the workflow is not ready, toggling on opens ReviewChecklist in the builder instead. Tabs and filter sync to the URL (`?tab=runs&status=live`). Stat cards switch tabs.
- Other tabs (drawn in source, default screenshot shows Workflows): Templates (template grid), Runs (table: workflow, trigger summary, result, took, when; failed rows in error tone, row opens RunDetail), Approvals (list with title, workflow, waiting time, Review button; empty "All clear"), Connectors (compact list with Connect buttons).
- Data needed: workflows (id, name, status, steps for preview, lastRunAt, draft reason, createdBy agent flag), counts by status, runs this week (total, passed, failed), approvals waiting, connectors (key, status, usedBy count), blocking alert (derived: first not-connected connector used by a live or draft workflow, plus failed runs in last 24h on it), templates (name, description, preview steps, needed apps).
- Edge states: no workflows (template grid becomes the main content with "Start from a template"), filter with no results, no alert.

### Builder (Santos-Builder)
- Layout: BuilderTopBar full width. Three columns below: StepLibrary (about 300px), FlowCanvas (flex), Inspector (about 340px). Panels are rounded or square per brand, separated from the canvas by a gutter.
- Behaviour: click a card to select and fill the Inspector. Plus opens StepFinder at that position. Library click appends at the end. Edits autosave (existing debounce) and clear lastTest. Fix count updates live. Status control follows Rule 3.
- Top bar must stay on one row at 1440 and 1280.
- Builder top bar wraps Review and turn on onto a second row at 1440. Ship it on one row: shorten Ask Assistant to an icon plus label at 13px or move Run history and Settings into an overflow Popover below 1280.
- Data needed: full workflow graph, connector statuses for apps used, variable catalog per step (derived from upstream steps' outputs), sample output per step, lastTest.
- Edge states: new workflow with only "Pick a trigger" card, all fixed (fix pill hidden), test running, test failed.

### Run detail (Santos-Run)
- Layout: back link plus breadcrumb, actions right (Open workflow, Retry from start, primary Retry failed step). Status pill plus trigger summary line, display title (workflow name). Three stat boxes right: Started, Took, Steps "2 of 3 passed". Left column (about 360px): step list with status icon, title, app, duration; selected step outlined. Run log under it with timestamps, failing line in error tone. Right: selected step detail with eyebrow, title, status pill, "What went wrong" box (error tone) with fix action and "Retry this step", then Received and Returned key-value columns.
- Behaviour: selecting a step swaps the detail. Fix action opens Connectors. Retry calls the existing run endpoint with a from-step parameter.
- Data needed: Run and RunStep shapes above. Derived: "N of M passed", total duration.
- Edge states: passed run (no error box, Returned filled), running (pulse on current step, auto-refresh every few seconds), waiting on approval (link to ApprovalDetail).

### Settings (Santos-Settings)
- Layout: centered modal about 720px. Summary box at top that reads the current policy in one sentence ("If a run fails, it retries 1 time, 5 minutes apart, then alerts <owner>. 3 failures in a row turns the workflow off."). General: Name, Owner (person chips), What it does (textarea). When a run fails: Retry stepper, Wait between tries segmented (1, 5, 15 min), Then alert (multi-select chips), auto turn off threshold. Footer as in the modal pattern.
- The modal body scrolls. The screenshot cuts at "Then alert"; html/Santos-Settings.html has the full content.
- Behaviour: summary sentence updates as values change. An alert channel that is not connected shows a link to Connectors.
- Data needed: Settings shape, owner list, alert channels with connection status.

### Trigger setup (Santos-Trigger)
- Layout: wide modal. Header with segmented Schedule, Event, Webhook. Left: "When this happens" grid of trigger options (2 columns, icon, bold title, one line), "Only when" filter rows (field select chip, operator select, value input, remove), "Add a filter". Right panel: Summary in display type ("When <trigger> and <filter>"), "Last 3 matches" from real data.
- Schedule tab: plain-language picker (every day, weekdays, before a date), shown as words, stored as a rule. Never show a cron string.
- Webhook tab: copyable URL from the existing webhook route, test ping status.
- Data needed: trigger catalog for this brand, filterable fields per trigger, last 3 matching records (derived query).

### Condition builder (Santos-Condition)
- Layout: wide modal. Left: "Take the Yes path when", All/Any segmented, rule rows (field chip, operator, value, valid check, remove), Add a rule, Add an Or group, live verdict banner in success tone ("<last record> takes the Yes path: <label>") with the sample record line. Right: Paths mini map on dot grid with Yes and No lanes and plus buttons.
- Data needed: fields available at this step (upstream variables), last record for the live verdict, the branch's yes and no step lists.

### Connectors (Santos-Connectors)
- Layout: back link, display title, summary "3 of 7 connected · 2 blocking a workflow", All/Needs attention segmented right. Left list (about 360px): app tile, name, "Used by N workflows" or "Not in use", status dot plus word. Right detail: tile, name, status pill, warning box naming impact, primary Connect, What it can do list, Used by list with chevrons, Recent activity with failures in error tone.
- Behaviour: Connect starts the existing auth flow for that app. After a connect, show a next-step banner that links back to the failed run or waiting approval.
- Data needed: Connector shape. Derived: blocking count (not connected or expired and used by at least one non-off workflow).

### Approval detail (Santos-Approval)
- Layout: back link, "Approvals" crumb, "1 of N waiting" pill, Open workflow right. Status pill "Waiting on you", meta line (workflow, waiting time, auto-reject countdown). Display title. Preview/Edit segmented right. Left: draft card with "Drafted by Studio Assistant" tag, To (recipient chip), Subject, body. Right: "The project" key-value panel and "Why this needs you" panel with the after-approve action. Sticky bottom bar: "Nothing sends until you approve.", Reject (error outline), primary Approve and send.
- Behaviour: Edit switches the draft to editable fields. Approve or Reject writes the decision, shows a status line, then loads the next waiting item. Empty queue shows "All clear" with a back link.
- Data needed: Approval shape, related record context, queue position.

## Interactions and motion
- Hover: background or border shift only, no movement. Values in § Design tokens and in each html file's style block.
- Focus: visible ring on every button, link, input and textarea (see tokens).
- Running step: opacity pulse 1s ease-in-out infinite (`@keyframes` 100% to 40% to 100%). Under `prefers-reduced-motion: reduce`, show a static running icon instead.
- Modals: fade and scale from 98% over about 150ms. Drawer: slide up about 200ms. Respect reduced motion.
- Cards never reorder under the cursor. Autosave never moves focus.
- Toasts auto-dismiss after about 4s and can be closed.

## Responsive rules
- One breakpoint is drawn: 900px. Under it the sidebar hides, main padding is 24px 16px 48px, the builder stacks Library, Canvas (min height 620px) and Inspector vertically, and the root height becomes auto.
- Hub grid: 3 columns at 1440, 2 at about 1100, 1 under 720.
- Modals under 720: full-width sheets, side panels (Summary, Paths) move under the form.
- No phone artboards exist. Treat the builder as desktop-first; on phones show the hub, run detail, approval detail and connectors fully, and the builder in read and light-edit mode.

## Accessibility requirements
- Every control is a real button, link, input, select or textarea with a visible label or aria-label. No clickable divs. Cards that open something are links or buttons.
- Switches: `role="switch"` with `aria-checked` and the workflow name in the label.
- Segmented controls: radio group semantics with arrow-key movement.
- Modals: focus trap, Escape closes, focus returns to the opener, `aria-labelledby` on the title.
- Canvas: step cards in DOM order matching visual order, Tab moves card to card, Enter selects, plus buttons labeled "Add step after <title>".
- Fix count and test status changes announce through an `aria-live="polite"` region.
- Required fields: `aria-required`, error text tied with `aria-describedby`.
- Contrast: body text 4.5:1 minimum against its ground. Muted text stays at or above its listed minimum size.
- Touch targets 40px minimum on any device under 900px.

## Open questions and assumptions
1. Modal and drawer states (New workflow, Step finder, Test run, Review and turn on, Ask Studio Assistant, toasts) have no screenshot. Assumption: build them from the `sc-if` blocks in source/. If a detail is missing, use the modal pattern in § Component inventory.
2. Variable chips sit after the typed text in fields, not inline mid-sentence. Assumption: chips render after text (a field value is text plus an ordered chip list). If inline placement is required, it needs a rich text field; raise it before Phase 2.
3. Sample data (projects, leads, orders, people, dates) is placeholder. Replace with real records from the existing tables.
4. Schedules are shown in plain words. Assumption: store a rule (cron or RRULE) plus timezone, render through one formatter. Never show the stored rule.
5. Retry policy defaults: 1 retry, 5 minutes apart, alert the owner, auto turn off after 3 failures in a row. Assumption: per-workflow, editable in Settings.
6. Approval auto-reject window ("auto-rejects in 23 hours"). Assumption: 24h default per workflow. If none exists in the backend, show no countdown.
7. Connector list and auth. Assumption: each connector maps to an existing auth or secrets route. Where none exists, show the connector as Not connected with the Connect button opening a short "coming soon" note, and list it in the Phase report.
8. Test runs use sample data. Assumption: the last real trigger match, or the step's sample output when no match exists. Test runs never send.
9. Counts in the stat strip are "this week" (Monday start, local time).
10. Run detail polling. Assumption: refresh every 3s while a run is running, stop when finished.
11. Builder top bar overflow. The design shows the primary action wrapping to a second row at 1440. Assumption: that wrap is a defect, not intent. Build it on one row as described in § Screen by screen, Builder.

## Build order
1. Phase 1 · Theme token file, copy file (Studio Assistant, status words, step library, triggers), graph types and the adapter from the existing stored flow to the graph shape, then the Hub with real workflows. Done when: the hub lists real workflows with correct FlowPreview chips, switches persist through the existing save path, counts are real, and the page matches Santos-Hub.png at 1440 and collapses correctly under 900px.
2. Phase 2 · Builder: top bar, StepLibrary, FlowCanvas with StepCards and plus buttons, StepFinder, Inspector with fields and VarChips, fix count. Done when: adding, editing, duplicating and deleting steps persists, fix badges and count are accurate, and the page matches Santos-Builder.png.
3. Phase 3 · Trigger setup, Condition builder, Settings modals. Done when: each saves, Cancel becomes Back to builder after a save, schedules show as words, and the live verdict and last 3 matches read real data.
4. Phase 4 · Test run drawer and Review and turn on. Done when: a test runs on sample data with live card states, stops at the first failure with Jump to fix, any edit clears the result, and Live stays locked until all four checks pass.
5. Phase 5 · Run detail and the Runs tab. Done when: failed runs show what went wrong, retry from step and from start work, and the run log matches the stored events.
6. Phase 6 · Connectors page and Approval detail with the Approvals tab. Done when: connecting an app clears its fix badges and the hub alert, and approve or reject writes the decision and advances the queue.
7. Phase 7 · Ask Studio Assistant, New workflow modal, templates, responsive and accessibility pass. Done when: the agent drafts steps onto the canvas as unchecked cards, and every item in § Accessibility requirements passes.
