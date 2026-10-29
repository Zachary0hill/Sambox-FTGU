# FTGU Workload · build handoff

Generated 2026-10-27 from the Design canvas "FTGU Workload" (1 artboard).
Target: Sambox-FTGU repo. Next.js 16 App Router, React 19, Supabase, Tailwind v4 (theme and utilities only, no preflight). Styling is inline style strings through the existing `css()` helper and CSS variables, view models built in `lib/studio/vals-admin.js`, rendered in `components/studio/StudioView.jsx`.

## What this is
The redesigned Admin > Workload page of FTGU Studio, visible to Super Admins only. It replaces the current Workload section (the `V.adm.isPM` block in `StudioView.jsx`). Its one job: show the admin, in one scroll, what is late, what is unassigned, who has room, and let them fix assignments without leaving the page.

## How to read this package
- START-HERE.md: the kickoff prompt.
- HANDOFF.md: this spec. Read fully before writing code.
- screenshots/Main.png: the full page at 1440 wide. Look at it before building. The picture is the source of truth when prose and picture disagree.
- html/Main.html: static HTML of the artboard with every loop expanded. Copy structure, spacing and inline values from here. Do not ship it; it has no components, data or handlers.
- source/Main.dc.html: the canvas source. Its `renderVals()` holds the full interaction logic (filters, issue rules, chart math, assignment, undo). Read it as executable pseudo code for the view model.
- tokens-candidates.json: every color, font, size and radius used, with counts.

All project titles, people, sponsors, dwell times and 8 week trend values in the design are sample data. Wire every number to real data.

## Target stack and conventions
- Repo: `Sambox-FTGU` (pnpm, Node 22).
- View model: extend the existing Workload block in `lib/studio/vals-admin.js` (search `// ---------- Workload ----------`). It already computes `attention`, `workload`, `flow`, `deadlines`, `rules`, `pmStats`. Keep that file as the single place where page values are derived. Return new keys on `V.adm`.
- Render: `components/studio/StudioView.jsx`, the `V.adm.isPM ? (...)` block. Replace its contents with the new layout.
- Writes: `lib/studio/actions.js`. Use what exists, do not add parallel writers:
  - Assign editor or designer: `A.setField(row, 'editor' | 'designer', name)` (maps to `project_edits.editor_id` / `project_thumbnails.designer_id`).
  - Settings and rules: `A.updateSettings(patch, text, target)` with `edit_days`, `thumb_days`, `require_sponsor_approval`, `lock_after_live`, `editors_change_status`, `auto_distribution`.
  - Toasts: `A.toast`. Open a project: existing `openProject(job)`.
- Existing helpers in vals-admin / vals to reuse: `hardBlock(solid(tone), h)` for status blocks, `fillFor('status', label)` for status colors, `avatar(name, size)`, `stat()`, `sw()` for switches, `dueState(key, row)` for late/today, `di()` for date offsets, `TODAY`.
- Primitives in `components/studio/Prims.jsx`: `Icon`, `Popover`, `MenuRow`, `Segmented`, `Toggle`, `Chip`, `Dot`, `Button`, `Field`. Use these. Do not create parallels.
- Existing CSS hooks in `app/globals.css` (`.row`, `.fb-card`, `.fb-pcard`, `.fb-th`, focus rings). Add new classes there with a `fb-wl-` prefix, matching the `wl-` hover rules in the artboard helmet.
- Fonts already loaded in `app/layout.tsx`: Inter 400 to 700, Montserrat 900. Use `var(--font-main)` and `var(--font-title)`.

## Screens and routes

| Artboard | Screen | Route or trigger | Kind | Frame | Files |
|---|---|---|---|---|---|
| Main.dc.html | Admin > Workload | sidebar Workload (`nav: 'workload'`, `V.adm.isPM`) | page, fluid | 1440×3400 (renders 3561 tall) | screenshots/Main.png · html/Main.html |

## Design tokens
Map hex values to the existing variables. Values with no variable today are marked new.

- Surfaces: page `#EBEBEB` = `--page` · card `#FFFFFF` = `--surface` · sidebar and table header `#FAFAFA` = `--surface-2` · segmented control track `#F4F4F4` (new, or `--hover`) · bar track `#F0F0F0` = `--track` · empty heat cell and hover `#F2F2F2` = `--hover`.
- Borders: card `1px #E6E6E6` = `--border` · row divider `1px #EFEFEF` = `--line` · tile hover `#BDBDBD` = `--border-strong` · selected tile `2px #111111` = `--ink`.
- Text: primary `#111111` (`--ink`) · secondary `#2A2A2A` (`--ink-2`) · body muted `#666666` (`--muted`), used at 12px and up · labels `#707070` (`--muted-2`) at 11px · faint `#8A8A8A` (`--faint`) only for axis ticks and zero values.
- Soft states: red `#FDE8E5`/`#9B1C13` (`--red-soft`/`--red-ink`) · amber `#FCF1DC`/`#7A4E00` (`--amber-soft`/`--amber-ink`) · green `#E6F5EC`/`#1B653B` (`--green-soft`/`--green-ink`) · highlight row `#FFF6E0` (new).
- Status blocks (white text, 4px radius, 600 weight): Scripting `#5F5F5F` · Filming `#B9461F` · Editing `#2F5BD8` · Sponsor Review `#7A3FD0` · Scheduled `#B8264F` · Live `#1E7A3C`. In code use `fillFor('status', label)` so workspace color edits flow through. Filming in the design is darkened from the current coral to pass 4.5:1 with white; check the existing token and darken it if it fails.
- Issue blocks: late `#C42B1C` · unassigned and due today `#9A6500` · sponsor `#7A3FD0`. Use `solid('red' | 'amber' | 'violet')`.
- Chart series: Thumbnail `#F2A93B` · Edit `#2F5BD8` · Publish `#111111`. Heat scale for due per day: 0 `#F2F2F2` · 1 `#C9D6FA` text `#1D3A8A` · 2 `#7F9CF0` text `#0D1E52` · 3+ `#2F5BD8` text white · late `#C42B1C` text white. All new.
- Type: Montserrat 900 for page title (38px, 30px under 720), section titles (18px), big numbers (34px tiles, 30px status cards, 26px utilization, 22px team stats). Inter for everything else: 15px body and nav, 14px row titles 600, 13px secondary, 12px meta and table headers 600, 11px chart axis and labels 600 to 700. Numbers use `font-variant-numeric: tabular-nums`.
- Radii: cards 16 · tiles 16 · status cards 14 · buttons, inputs, segmented 12 · segmented items, chips 9 to 10 · heat cells 6 · status blocks 4 · bars 3 to 7 · app frame 20.
- Spacing: page padding 36/40/64, 20 under 720 with 16 sides · section gap 20 · grid gaps 12 (tiles), 16 (two column row), 10 (status cards) · card padding 18 to 20.
- Control heights: buttons and inputs 44 · row actions 36 · chips 34 to 36 · nav rows 44 · table rows min 60 · heat cells 26 (inside a 44 tall row) · switch 46×28.

## Component inventory

### WorkloadHeader
- Purpose: page title and top actions.
- Anatomy: lock icon + "Admin · Super Admin only" · H1 "Workload" · description · right: date pill (today, long form), "Open board" ghost link (goes to `nav: 'projects'`), "Assign open work" primary (sets focus to Unassigned and scrolls to `#attention`).
- States: hover on ghost `#F2F2F2`, primary `#2A2A2A`. Focus ring 2px ink, offset 2.
- Built from: `Button` kinds primary and ghost.
- Reference: top of Main.png.

### UndoBanner
- Purpose: confirm an assignment and allow undo.
- Anatomy: dark bar `#111` with green check, text `"<Name> is now the editor on "<Title>""`, Undo outline button, dismiss icon button.
- Behaviour: appears after any assignment from this page. Undo writes the previous value back with `setField`. One level of undo. `role="status"`.
- Built from: new, or reuse the toast system if it supports an action.

### MetricTile (x5)
- Purpose: headline numbers that also act as filters.
- Anatomy: label + color dot · big number + sparkline (96×34, area fill at ~10% of the line color, end dot) · delta vs last week + subtext.
- Tiles: Active projects (ink) · Due in 7 days (blue) · Late deadlines (red) · Unassigned (amber) · Awaiting sponsor (violet).
- Props: label, value, history[8], color, badWhenUp, focusId.
- States: default 1px border · hover border `#BDBDBD` · pressed (selected filter) 2px ink border, padding reduced by 1px so nothing shifts · `aria-pressed`.
- Delta color: neutral metrics always muted. For late, unassigned, sponsor: up is `--red-ink`, down is `--green-ink`, zero shows "Flat".
- Built from: extend `stat()`; sparkline is new (inline SVG polyline).

### AttentionList
- Purpose: everything blocking delivery, sorted by severity.
- Anatomy: title + count pill · segmented tabs All / Deadlines / Unassigned / Sponsor with counts · rows: issue block (118px min, centered) · title (ellipsis) + meta line (status · editor / designer, or status · sponsor) · due text · action.
- Issue rules (extend the existing ones in vals-admin):
  - Late edit / Late thumbnail: due date past and not done (red, weight 0).
  - Edit due today / Thumb due today: new, amber, weight 1.
  - No editor: status index 1 to 3 and no editor (amber, weight 2).
  - No designer: status index 1 or later and no designer (amber, weight 2).
  - Sponsor pending: only when `require_sponsor_approval` is on (violet, weight 3).
  - Sort by weight, then publish date.
- Actions: Late and Today rows "Open" (open the project, see Open questions 3) · Unassigned rows "Assign" toggles an inline AssignPicker under the row, label becomes "Close" with inverted style · Sponsor rows "Nudge", becomes disabled green "Nudged" and the meta line appends "reminder sent".
- States: row hover `#FAFAFA` · empty state: green check circle, "All clear", "Nothing in this filter needs you right now." · loading: skeleton rows at 64px.
- Built from: `Segmented` for tabs, `Button` for actions.

### AssignPicker
- Purpose: pick an editor or designer inline, with capacity visible.
- Anatomy: label `Assign editor to "<Title>"` · option buttons (52px): avatar 30 · name · 44×5 load bar + "n of CAP" · "At capacity" red tag when full · Cancel text button (table version only).
- Behaviour: options are active members of that role, sorted by current load ascending. Full people stay selectable but get a red-tinted border `#F2C7C1`. Picking writes immediately, closes the picker, shows UndoBanner. Only one picker open on the page at a time.
- Bar color: blue under CAP-1, amber at CAP-1, red at CAP.
- Built from: new, used in AttentionList and AssignmentsTable.

### DueChart (Due next 14 days)
- Purpose: deadline load per day for the next 14 days.
- Anatomy: title + summary line · legend toggle chips (Thumbnail, Edit, Publish) · red overdue banner listing past-due titles · y axis ticks 0 to max(4, peak) · 14 columns, stacked segments with 3px gaps, 5px radius, one segment per series per day · x labels weekday letter + date, today and selected bold · detail panel listing the selected day's items (swatch, type, title, person or status).
- Behaviour: hover, focus or click a column selects that day (default today). Legend chips hide or show a series and rescale. Weekend columns tinted `#FAFAFA`, selected `#EFEFEF`.
- States: day with nothing: "Nothing due this day." · no overdue: banner hidden.
- Accessibility: each column is a `button` with `aria-label="Thu, Oct 29: 3 deadlines"` and `aria-pressed`.
- Built from: new. Plain divs, no chart library.

### PipelineCard
- Purpose: where projects sit and which status is slow.
- Anatomy: title + summary ("14 open projects · Sponsor Review is running over target") · stage totals In Production / Post Production / Publishing · 14px stacked bar of open projects by status (non-selected segments fade to 25% when a status filter is on) · status cards grid.
- StatusCard: status block + "Slow" tag when avg dwell > target · count + "projects" · "Avg 8.5d here" / "Target 10d" · 6px dwell bar (ink, red when over) · stage label. Live card is disabled, `#FAFAFA` bg, shows "live this month".
- Behaviour: clicking a status card toggles the status filter on AssignmentsTable.
- Data: see Open questions 1 and 2 (dwell and targets).

### TeamCapacity
- Purpose: who has room and when their work lands.
- Anatomy: title + description · role segmented All / Editors / Designers · summary row: utilization ring (68px, 10px stroke; blue under 60%, amber 60 to 84%, red 85%+) · Slots in use · At capacity · Open slots · heat legend · table (scrolls sideways under 960px).
- Columns: Person (avatar 32, name, role; button) · Load (CAP slots 14px tall, each colored by its project's status, `title` = project and status; overflow slots get a red ring) + "n/CAP" (red at CAP) · Active · Late (red block when >0) · Next due · 15 cell strip: Late, then today + 13 days.
- Behaviour: clicking a person toggles the person filter on AssignmentsTable and tints the row `#F4F4F4`. Clicking a cell opens a detail panel under the table ("Marcus · Thu, Oct 29", items with status block, title, what is due). Sorted by load, highest first.
- Active count rule: editor = projects where they are editor and edit status is not Approved. Designer = designer and thumb status not Done. Same as current code.

### AssignmentsTable
- Purpose: every open project with its people and dates, filterable.
- Toolbar: search field with search icon (44px) · "Only issues" checkbox (default off; the static render shows it checked, that is a render artifact) · active filter chips (Focus, Status, Person, Search) each removable, plus "Clear all".
- Columns: Project (title 600 + "Sponsored · film Oct 15" or "Film Oct 12") · Status block · Editor (avatar 26 + name, or Assign) · Designer · Edit due · Thumb due · Publish · Sponsor (name + approval pill: Pending amber, Approved green, Not sent gray).
- Due cells: late red-soft pill · today amber-soft pill · done green-soft "Done" · else plain.
- Assign button: dashed. Amber filled when the slot counts as an issue, quiet gray when the status does not require it yet (Scripting).
- Rows with a red issue get a 3px red inset bar on the left. A row opened from AttentionList gets `#FFF6E0`.
- Sort: publish date ascending.
- States: empty "No projects match" + "Clear a filter to see more of the board." · loading skeleton rows.
- Fix vs design: the Sponsor cell clips long names ("Northline Lumbe"). Add ellipsis.

### WorkflowSettings
- Purpose: status order and deadline rules. Same data as today, restyled.
- Anatomy: status chain (blocks with a count badge at 22% white, arrows, stage under each) · Deadline defaults: two stepper rows (label, hint "Moves the edit date on 10 open projects", minus button, value, plus button, "days") · Rules: four rows with switches.
- Stepper limits: edit 1 to 30, thumbnail 0 to 14.
- Switch: `role="switch"`, `aria-checked`, 46×28, ink when on, `#D4D4D4` off, 20px knob. Use `Toggle` from Prims if it matches.

### Sidebar and mobile bar
- Already exists in the app. Only change: Workload nav badge shows the attention count in a filled ink pill.

## Screen by screen

### Admin > Workload
- Layout (max-width 1240, centered):
  1. Header.
  2. UndoBanner (conditional).
  3. Five MetricTiles, `repeat(auto-fit, minmax(188px, 1fr))`.
  4. Two column row, `repeat(auto-fit, minmax(min(100%, 460px), 1fr))`: AttentionList (`id="attention"`) left, DueChart right, top aligned.
  5. PipelineCard, full width.
  6. TeamCapacity, full width.
  7. AssignmentsTable (`id="assignments"`), full width.
  8. WorkflowSettings, full width.
- Shared page state (one place in the view model): `focus` (all | week | late | unassigned | sponsor), `status`, `person`, `roleView`, `q`, `issuesOnly`, `picker` (one open picker key), `day`, `hiddenSeries`, `cell`, `last` (undo), `nudged`, `highlight`.
- Filter wiring: tiles and attention tabs share `focus`. Status cards set `status`. Team rows set `person`. All of them filter AssignmentsTable. Focus `week` shows projects with any edit, thumbnail or publish date in the next 7 days.
- Data needed:
  - Projects (non archived, status not Live): id, job_code, title, status label + stage + sort, film_date, publish_date. Edits: editor_id, edit_status, edit_due. Thumbnails: designer_id, thumb_status, thumb_due. Sponsorships: account name, approval_status.
  - Members: active workspace members with type editor or designer, first name, avatar color.
  - Settings: edit_days, thumb_days, the four rule booleans.
  - Live this month: count of projects with status Live and publish_date in the current month (derived).
  - KPI history: 8 weekly values per tile (derived, see Open questions 4).
  - Avg days in status and per status target (derived and new, Open questions 1 and 2).
  - Derived on the client: issues, loads, utilization = slots used / (people × CAP), open slots = sum of max(0, CAP minus load), due per day per person, due per day per series.
- Edge states: no editors or designers: TeamCapacity shows an empty row "No editors or designers yet" with a link to Users. No open projects: tiles show 0, chart shows empty columns, table empty state.

## Interactions and motion
- Bars, slots, segments and switch knobs transition width, height, background and transform at 0.25s ease. Under `prefers-reduced-motion: reduce`, no transitions.
- Hover: tiles and chips darken border, rows tint `#FAFAFA`, chart columns `#F4F4F4`, heat cells get a 2px ink ring.
- Assignments apply optimistically. On write failure, revert and toast the error.
- Never reorder rows under the cursor while a picker is open. Close the picker, then re-sort.

## Responsive rules
- Under 720px: sidebar hidden, mobile top bar shown (existing `.fb-side` / `.fb-mobile` rules), page padding 20/16/40, H1 30px.
- Tile grid, two column row and status cards use auto-fit, so they collapse to one column on phones.
- TeamCapacity table (min 960) and AssignmentsTable (min 1060) scroll sideways inside their card. The page never scrolls sideways.
- At 1440 the status cards wrap the Live card to a second row (5 per row). Acceptable. If Zach prefers one row, use 6 columns at 1280px and up.

## Accessibility requirements
- Every control is a real `button`, `a` or `input` with a label. Icon-only buttons have `aria-label`.
- Tiles, status cards, legend chips, team rows, chart columns and heat cells expose `aria-pressed`. Tabs use `role="tablist"` / `role="tab"` / `aria-selected`.
- Chart columns and heat cells have spoken labels: "Marcus, Thu, Oct 29: 1 item".
- The utilization ring is `role="img"` with "Team utilization 57 percent".
- UndoBanner is `role="status"`. Stepper value is `aria-live="polite"`.
- Focus ring: 2px `#111` outline, 2px offset, on every interactive element.
- Contrast: all text 4.5:1 or better. `#8A8A8A` only on axis ticks and zero values at 11px, which is decorative duplication of spoken labels.
- Touch targets 44px for every control except heat cells (26px inside 44px rows) and chart columns (full column height).

## Open questions and assumptions
1. Avg days in status. No status history table exists. Assumption: derive from `activity_log` status change entries (`diff`) for projects that left each status in the last 90 days. If those entries do not carry the status change, add a `project_status_events` table written by a trigger on `projects.status_id`, and show "Not enough data" until it fills.
2. Per status dwell targets (5, 5, 10, 3, 4 days in the design). Assumption: new `dwell_target_days` int column on `project_statuses`, editable later in Workspace Settings. If unwanted, hide the target line and the Slow tag.
3. "Open" on late items. Design scrolls to the table row and highlights it. Current app calls `openProject(job)`. Assumption: keep `openProject(job)` and also set `highlight` so the row is marked when the drawer closes.
4. Sparkline history. Assumption: compute weekly values from current data plus `activity_log` where possible. If too costly, ship tiles without sparklines in Phase 1 and add a nightly `workload_snapshots` table later.
5. Changing deadline defaults. Design copy says it moves dates on open projects. Current code only saves the setting. Assumption: on change, recompute `edit_due` / `thumb_due` only for open projects whose stored date still equals the old formula, log one activity entry, and toast the count. If Zach wants settings to affect new projects only, change the hint copy to "Applies to new projects".
6. Nudge sponsor. No endpoint exists. Assumption: insert a notification for the sponsor account contacts and send through the existing email path, rate limited to once per 24h per project. Persist "Nudged" from that record, not local state.
7. Capacity. Design uses 5 per person (current `CAP = 5`, exposed as a canvas tweak). Assumption: keep 5, consider a `capacity` setting per member later.
8. Person avatar colors in the design are arbitrary. Use the existing `avatar()` helper.
9. Due today rows are new attention items. If Zach finds them noisy, gate them behind the Deadlines tab only.

## Build order
1. Phase 1 · View model and top of page: rebuild the Workload block in vals-admin with shared page state, issue rules, loads; render Header, UndoBanner, MetricTiles (no sparklines), AttentionList with AssignPicker writing through `A.setField`. Done when: assigning an editor from Needs attention writes `project_edits.editor_id`, the item disappears, tile counts and loads update, Undo restores the previous editor.
2. Phase 2 · DueChart and TeamCapacity with the heat strip and cell details, role filter, person filter. Done when: chart totals match a SQL count of open due dates in the next 14 days and a person click filters the table.
3. Phase 3 · AssignmentsTable with search, Only issues, filter chips, inline AssignPicker, due cell states. Done when: every tile, tab, status card and person row filter produces the expected rows and chips clear them.
4. Phase 4 · PipelineCard and WorkflowSettings: stage totals, stacked bar, status cards with dwell (after Open question 1 is settled), steppers and switches wired to `updateSettings`. Done when: toggling "Require sponsor approval" removes sponsor items and the tile subtext changes.
5. Phase 5 · Sparklines, Nudge, responsive pass at 390, 768, 1280, 1440, reduced motion. Done when: no horizontal page scroll at 390 and all controls reachable by keyboard in visual order.
