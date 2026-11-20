# Ideas & Research Refactor · build handoff

Generated 2026-11-19 from the Design canvas "Ideas & Research Refactor". One design artboard (`MainCompact.dc.html`), rendered in 7 states.
Target: SantosStudios, repo `Sambox-FTGU` (`/Users/Mac/dev/Sambox-FTGU`). Next.js 16.4, React 19.3, Supabase, inline styles through `css()`, page logic in `lib/studio/vals-ideas.js` (`ideasVals`), markup in `components/studio/StudioView.jsx`.

## What this is
The Ideas & Research page of the SantosStudios production board, rebuilt around a new editorial workflow: one board for manual and AI-generated ideas, where the column says what editorial decision comes next and a separate status on the card says whether an AI research run needs attention. The page has three parts that work as one: a one-row browsing toolbar, a Kanban board with collapsible columns, and an idea detail dialog that opens over the board. The one job it must do well: move an idea from capture to approved, with the next action always obvious.

## How to read this package
- START-HERE.md: the kickoff prompt.
- HANDOFF.md: this spec. Read fully before writing code.
- screenshots/: look at every PNG before building its screen. The picture is the source of truth when prose and picture disagree, except for the items listed under "Known design defects to fix in the build".
- html/: static HTML per state. Copy structure, spacing and inline values from here. Do not ship this HTML as is; it has no components, no data, no handlers.
- source/: the canvas sources. `MainCompact.dc.html` is the real design. The `State-*.dc.html` files are copies of it with a different default state and frame width, made only to render the screenshots. The `renderVals()` logic in `MainCompact.dc.html` is a working prototype of every interaction in this spec; read it when behaviour is unclear.
- tokens-candidates.json: every color, font, size and radius the artboard uses, with counts.
- spec/: `board-workflow.md` (the workflow this design implements), `board-cards-and-columns-spec.md` and `toolbar-and-filters-spec.md` (the written specs behind the design). HANDOFF.md wins where they differ.

The canvas also holds two older artboards (`Main.dc.html`, `IdeaModal.dc.html`). They are the previous version of this page and modal, superseded by this design, and are not in the package on purpose.

## Target stack and conventions
- Repo: `Sambox-FTGU`. Read `AGENTS.md` first: Next.js 16 has breaking changes; check `node_modules/next/dist/docs/` before touching routing or data APIs.
- The Ideas page is not a route file. It is `nav: 'ideas'` inside the Studio shell (`lib/studio/vals.js` builds `NAV`, calls `ideasVals(...)` and exposes `IV`; `components/studio/StudioView.jsx` renders it under `isIdeas`). Extend those. Do not create a new page, route or component tree for this.
- State lives in the Studio state object `s` and changes through `set({...})`. Existing keys for this page: `ideaOpen`, `ideaTab`, `ideaEdit`, `ideaConfirm`, `iStatus`, `iType`, `iBrand`, `iq`. Reuse them; add new keys only for new behaviour (collapsed lanes, toolbar menus, custom columns).
- Styling: inline style strings through `css()`, colors through the theme variables built in `lib/studio/vals.js` (`TK`, dark branch). No Tailwind classes on this page, no new UI library.
- Primitives to use, do not create parallels:
  - `components/studio/Prims.jsx`: `Popover` (every dropdown and popover), `MenuRow`, `MenuLabel`, `Divider`, `Field`, `Toggle` (Display card-field switches), `Segmented` (status tabs, view switcher, sort order), `Chip` (filter chips), `Dot`, `SwatchList` (column color), `Button`, `Icon`, `IC`.
  - `components/studio/FilterBar.jsx`: `FilterBy`, `RuleEditor`, `SortEditor`, `FilterChips`, `NoMatch`. The Filters popover and Sort popover in this design are a restyle of these, not new components.
  - `components/studio/FocusDialog.jsx` (`FocusDialog`, `useDialogFocus`): the idea detail dialog. It already traps focus.
  - `components/studio/AddColumn.jsx`: the project board's custom-column flow. Follow its data and permission pattern for "Add column" on this board.
  - `components/studio/IdeaConvert.jsx` and `CONVERT_TARGETS` in `lib/ideas/rules-shared.ts`: "Convert to project".
  - `components/studio/IdeaResearch.jsx`, `lib/ideas/research.ts`: research runs, retry and cancel.
  - `lib/ideas/gates.ts` (`gateChecklist`, `stageBlocker`): the ready-for-review checklist and every stage move. The database enforces the same gates through `app.idea_gate_missing`; never bypass it in the client.

## Screens and routes

| Artboard | Screen | Route or trigger | Kind | Frame | Files |
|---|---|---|---|---|---|
| State-Board-1440.dc.html | Board, default state | Studio `nav: 'ideas'` | page, fluid | 1440×1800 | screenshots/State-Board-1440.png · html/State-Board-1440.html |
| State-Board-1920.dc.html | Board at wide desktop | same | page, fluid | 1920×1800 | screenshots/State-Board-1920.png · html/State-Board-1920.html |
| State-Board-1024.dc.html | Board, compact toolbar | same | page, fluid | 1024×1800 | screenshots/State-Board-1024.png · html/State-Board-1024.html |
| State-Board-390.dc.html | Board, phone | same | phone page | 390×2400 | screenshots/State-Board-390.png · html/State-Board-390.html |
| State-Filters-1440.dc.html | Filters popover open, 2 filters active, board filtered | Filters button | page + popover | 1440×1800 | screenshots/State-Filters-1440.png · html/State-Filters-1440.html |
| MainCompact.dc.html | Idea detail dialog over the board (Streetwear idea, In Development) | click a card, `s.ideaOpen = <id>` | dialog | 1440×1800 | screenshots/MainCompact.png · html/MainCompact.html |
| State-Detail-390.dc.html | Idea detail on a phone | same | phone sheet | 390×2400 | screenshots/State-Detail-390.png · html/State-Detail-390.html |

States the screenshots do not show but the source implements (open `source/MainCompact.dc.html` and read the matching block): Views menu, Sort popover, Display popover, More menu (compact layouts), status dropdown, column options popover, collapsed lane, Add column naming field, review actions on a card in Ready for Review, Parked view, Research, Comments and History tabs of the dialog, approved idea in the dialog (score bars, cover, Convert to project).

## Design tokens
Design hex on the left, the existing dark-theme variable from `lib/studio/vals.js` (`TK`) on the right. Use the variable. Values marked "new" have no close match.

- Surfaces
  - Page background `#0C0D10` → `--page` (#000000). Visual difference is small; keep the existing token.
  - Lane (column) background `#0A0B0D` → `--panel` (#0E0F11).
  - Card surface `#101113` → `--surface` (#141518).
  - Controls (toolbar buttons, segmented track, inputs) `#14151A` → `--surface` (#141518).
  - Popovers and dialog `#16171C` / `#111217` → `--surface-2` (#18191C).
  - Dialog side panel and footer `#0E0F13` → `--panel`.
  - Selected row in menus `#1E2027` → `--hover` (#1E1F23).
- Borders
  - Control border `#262830` → `--border` (#2A2B30).
  - Card border `#23252C` → `--card-border` (#2A2B2F). Card hover `#33363F` → `--border-3` (#3A3B40).
  - Lane border and dividers `#1C1E24` / `#22242B` → `--line` (#1F2023).
  - Dashed drop target `#34363F` and dashed Add column `#34363F` → `--border-3`.
- Text
  - Primary `#F2F3F5` / titles `#F5F6F8` → `--ink` (#F4F4F5).
  - Secondary `#C9CDD4` → `--ink-3` (#B4B7BD). Smallest use: 12px labels.
  - Muted `#A3A8B3` → `--muted` (#9A9DA3). Smallest use: 12px (passes 4.5:1 on the lane background).
  - Faint `#6B7180` → `--faint` (#6E7177). Decorative only, never for text under 24px.
- Accent
  - Teal `#19E6D0` → the workspace accent (`--inv` / `--link` in the dark theme, derived from `accent`). Text on filled teal: `#06211E` → `--inv-ink`.
  - Filled teal is used only by: Capture idea (header), the dialog's primary action, Approve on review cards, the Display switch track. Everything else is outlined or neutral.
  - Teal tint for selected filter options and filter chips `#0F2A27` → new (accent at about 14% over surface). Derive it from the accent like `mix()` in `vals.js`.
- Stage colors (lane count, collapsed-lane count, dialog progress bar). These match the current `STAT_T` map:
  - Idea Inbox `#8A8F9A` → `--muted-2`.
  - In Development `#9B7BFF` → violet tone (`TONE.violet` solid, `--violet-ink` for text).
  - Ready for Review `#FFB020` → amber tone.
  - Approved `#3DDC84` → green tone.
  - On Hold `#5EB1EF` → new. Closest existing is `--blue-ink` (#9DB9FF); add a sky tone if the team wants On Hold distinct from blue.
  - Custom columns: user-picked from 8 swatches (Gray #8A8F9A, Violet #9B7BFF, Amber #FFB020, Green #3DDC84, Sky #5EB1EF, Red #F0503C, Orange #FF5A1F, Lilac #C084FC). Use `SwatchList` and the existing tone list instead if it covers these.
- Idea origin
  - Manual: text `#C9CDD4` on strip `#16171C` → `--ink-3` on `--surface-2`.
  - AI-generated: text `#C4B1FF` on strip `#1B1630` → `--violet-ink` on `--violet-soft`.
- Research run pills (text on background)
  - Queued `#C9CDD4` on `#22242B` → `--ink-3` on `--chip-2`.
  - Running `#8EC5FF` on `#12233A` → `--blue-ink` on `--blue-soft`, with a pulsing 6px dot.
  - Complete `#7CF0A8` on `#123222` → `--green-ink` on `--green-soft`.
  - Failed: no pill. A full-width row, text `#FFB4A8` / `#FF8A7A` on `#2A1412`, border `#4A211C` → `--red-ink` on `--red-soft`.
- Score and recommendation badge: high (75+) `#7CF0A8` on `#123222` (green); otherwise `#FFD27A` on `#33290F` → `--amber-ink` on `--amber-soft`.
- Cover notice: text `#E9D9AE` on `#15140F`, border `#3A3320`, icon `#FFB020` → `--amber-ink` on `--amber-soft`.
- Type
  - Display: Unbounded 700–800 for the page title (28px), lane counts (40px expanded, 18px collapsed), dialog title (22px), score number (30px). Check the shell already loads Unbounded (the FTGU wordmark uses it).
  - UI: Inter 500/600/700/800. Sizes in use: 11px (uppercase labels, pills), 12px, 13px (toolbar, menus, card meta), 14px, 15px (dialog fields), 16px (card titles, 21px line height). No weight below 500.
  - Uppercase labels: 11–13px, weight 700–800, letter-spacing 0.06–0.1em.
- Radii: 16px lanes, 12px cards and dialog field boxes, 18px dialog, 8px toolbar controls and buttons, 6–7px inner segmented buttons and menu rows, 999px pills, 50% avatars.
- Spacing: lane gap 10px, card gap 10px, lane list padding 10px, card padding 14px, toolbar gap 8px, toolbar group gap 8px, section gap 12px.
- Control heights: toolbar controls 36px (segmented: 36px outer, 28px inner buttons). Header actions 44px. Card footer row 28px; move button 28px; avatar 24px. Dialog buttons 36–40px. Every control is 44px under `(pointer: coarse)` on narrow screens.

## Component inventory

### IdeasHeader
- Purpose: page title block and page-level actions.
- Appears in: every state, top of content.
- Anatomy: left column `All brands ▾` (32px), H1 "Ideas & Research" (Unbounded 800, 28px), description "Capture manual and AI ideas, sharpen the pitch, approve the keepers." Right group, vertically centered against the left column: auto-research status pill ("Auto research off · 2 runs active", 44px), Automate, Rules, Run research (44px outlined), Capture idea (44px, filled teal, `C` key hint).
- Behaviour: "N runs active" counts ideas whose run state is `queued` or `running`. Header wraps: actions drop below the title at 1024 and stack in rows on phones (see screenshots).
- Built from: existing header in StudioView `isIdeas` section; restyle only.

### IdeasToolbar
- Purpose: browse the board: status, saved view, search, filters, sort, display fields, layout.
- Appears in: every board state. Reference: screenshots/State-Board-1440.png (row under the header), State-Board-1920.png, State-Board-1024.png, State-Board-390.png.
- Anatomy: one flex row, no wrap, two groups. Left group (grows): StatusTabs, ViewsMenu trigger, SearchField (flex 1 1 160px, min 120px, the only flexible element), Filters trigger. Right group (no shrink): Sort trigger, Display trigger, LayoutSwitcher, More trigger (compact layouts only).
- All controls 36px tall, 8px apart, 8px radius, 16px icons, labels on one line, content widths.
- States: see each part below. Breakpoint levels under "Responsive rules".

### StatusTabs (Segmented)
- Five buttons: All, Inbox, Development, Review, Approved, each with a count. Selected: white fill `--ink` with dark text. Counts follow active filters and search.
- Selecting a status shows only that lane on the board (lane keeps its normal width, max 380px).
- Compact form: a 36px dropdown button "All 18 ▾" listing the same five rows with counts and a check on the selected one.

### ViewsMenu (saved views)
- Trigger: 8px colored dot, view name, small teal dot when the current filters differ from the view (with sr-only "edited"), chevron.
- Menu (Popover, 272px): label "Saved views"; rows: All ideas (count), My ideas, AI-generated, Runs needing attention, Top scored, Stale 14d+, Parked (count); divider; Manage views.
- Picking a view applies its filter set (My ideas = owner You; AI-generated = origin AI; Runs needing attention = run Failed; Top scored = score 75+; Stale 14d+ = flag Stale; Parked = shows the Parked lane instead of the board, see BoardLane).
- Maps to the existing saved-view logic in `vals-ideas.js`; keep its counts where it computes them.

### SearchField
- 36px, magnifier icon, placeholder "Search ideas", sr-only label "Search ideas by title or hook", `/` key hint shown only when the viewport is at least 1600px wide. Filters title and hook, live. Focus: teal border.
- Maps to `s.iq`.

### FiltersPopover (restyled FilterBy + FilterChips)
- Trigger: funnel icon, "Filters", teal count badge (number of filter groups in use). While any filter is active the trigger gets a 1px teal border. Accessible name "Filters, 2 active".
- Popover (400px, right-aligned to the trigger): header "Filters" + "2 active"; then removable chips for every active group ("Idea origin AI-generated ×", "Score Unscored ×"; teal border on teal tint; × button named "Remove Idea origin filter"), or "No filters applied"; then the groups, scrolling at 400px max: Idea origin (Manual, AI-generated), Research run (Queued, Running, Complete, Failed, No run), Owner (You, John Santos, from the team list), Score (75+, 50 to 74, Under 50, Unscored), Flags (Missing cover, Has comments, Stale 14d+). Options are 32px toggle buttons with `aria-pressed`, a check when on, a color dot where the group has colors.
- Footer: Clear all (text button), Save as view (teal outline, disabled until filters differ from the current view), Done (neutral white fill, closes).
- Board, column counts, status counts, chips and badge update together on every toggle. Reference: State-Filters-1440.png.
- Empty result per lane: the dashed target reads "No matching ideas" and "Show 10 more" hides.

### SortPopover (restyled SortEditor)
- Trigger "Sort: Score ↓" (arrow flips with order); accessible name "Sort: Score, High to low".
- Popover (240px): "Sort by" rows Score, Created, Last updated, Title (check on current); order Segmented whose labels depend on the field (High to low / Low to high; Newest first / Oldest first; Recent first / Oldest first; A to Z / Z to A).
- Cards reorder inside each lane. Score sort puts unscored ideas last.

### DisplayPopover
- Trigger "Display" with sliders icon. Popover (300px): "Card fields", "8 of 8 shown", eight `Toggle` rows: Thumbnail, Idea origin, Research run, Brand, Research context, Score and recommendation, Comments, Owner. Each switch hides that part on every card. Persist per user.

### LayoutSwitcher (Segmented, icon only)
- Grid, Board, List, 28px icon buttons, named "Grid view", "Board view", "List view", `aria-pressed`. Selected: white fill, dark icon. Only Board is designed; Grid and List keep the current implementation.

### MoreMenu (compact layouts only)
- 36px icon button "More options" (⋯). Popover holds whatever the current width hid: Status list, Saved view list, Layout segmented with labels, Sort rows + order, Card fields switches. On phones it opens as a bottom sheet.

### CoverNotice
- Slim 40px bar under the toolbar: image icon, "11 ideas have no cover", Generate covers button (32px). Shown only when at least one idea in scope has no cover. After Generate: text becomes "Generating covers for 11 ideas", button replaced by a pulsing amber dot. Calls the existing cover endpoint (`app/api/ideas/cover`).

### BoardLane
- Purpose: one workflow column.
- Expanded: `flex: 1 1 0`, min-width 240px, max-width 380px, full board height, 16px radius, `--panel` background, 1px `--line` border. Header (76px min, padding 14/12/14/16): count (Unbounded 700, 40px, stage color, tabular), then a column with the uppercase name (13px, 800, 0.08em, ellipsis) and a one-line muted description (12px, ellipsis), then the add button (32px, `+`) on lanes that allow adding. One divider under the header. The card list below scrolls on its own; the header never scrolls.
- Hover controls: on hover or keyboard focus inside the lane, a small group appears in the header's top-right corner (8px from top; 52px from the right when the lane has an add button, otherwise 8px): Collapse (chevron down, "Collapse <name>") and Options (⋯, "Column options for <name>"). On touch devices only Options shows; Collapse lives in the options menu.
- Collapsed: a 44px-wide strip, full height, one button over the whole strip named "Expand <name>, <n> ideas": chevron right, count (Unbounded 700, 18px, stage color), name written vertically (11px, 800, uppercase). Cards can still be dropped on it.
- Options popover (232px): Name field (Enter renames), color swatches, Rename, Collapse, Delete (only for On Hold and user-added columns; first click turns it into "Confirm delete"; deleting moves its ideas to the lane on its left). Note line: workflow stages say "Workflow stage. Rename or recolor it here."; others say "Deleting moves its cards to <left lane>."
- Empty: a 64px dashed drop target right under the header, centered muted text: "Drop ideas here" (On Hold: "Drop paused ideas here"; filtering: "No matching ideas"). The rest of the lane stays empty and accepts drops over its full height.
- Drag over: lane border turns teal, list background gets a 4% teal tint, the dashed target border turns teal.
- Lanes in order: Idea Inbox ("Pick ideas to develop", add), In Development ("Sharpen the pitch", "Show 10 more" pager), Ready for Review ("Approve, return or park", add), Approved ("Hand off to scripting"), On Hold ("Paused until unblocked", collapsed by default), then user-added columns ("Custom column"). Parked view replaces all lanes with one "Parked" lane ("Maybe later ideas").

### AddColumnStrip
- Trailing 44px dashed strip after the last lane: `+` and "Add column" written vertically. Click: becomes a 200px box with a name field (focused), Add (check) and × (Cancel). Enter adds, Escape cancels. New column appears before the strip, expanded, empty, with the next color in the palette. Hidden while a single status or the Parked view is showing.

### IdeaCard
- Surface `--surface`, 1px `--card-border`, 12px radius, 10px gap between cards, whole card draggable and clickable (opens the dialog). The title is a real button (`data-open-id`), so keyboard users open it with Enter; a click on any other button inside the card does not open the dialog. While its dialog is open the card border is teal. While dragging, opacity 0.4.
- Two layouts, chosen from the data:
  - With media (`cover_path` set and Thumbnail field on): edge-to-edge thumbnail, 3:1 crop. Overlays: origin label top-left (dark translucent pill, 12px 700), run pill top-right (not for Failed), play button bottom-right (32px round) only when the media is playable video.
  - Without media: a 30px strip in the origin color: origin icon + "Manual" or "AI-generated" on the left, run pill on the right (Queued with clock icon, Running with pulsing dot, Complete with check).
- Body (14px padding, 6px gaps): hook kicker (12px 600 muted, in quotes) only when the hook is not already contained in the title; title (16px/21px, 600, -0.01em, two-line clamp); context line (13px muted, one line) such as "1.8M views · 3 sources", omitted when empty or equal to the title; failed-run row when the run failed (warning icon, "Research run failed", Retry button); footer.
- Footer (28px, 8px top margin): brand dot (brand kit color) + brand name (truncates) on the left; on the right: score/recommendation badge ("83", "58 · Park"; recommendation hidden once Approved), comment count when above 0 (named "1 comment"), owner avatar (24px, named "Owner: John Santos"), move button (28px, arrow, named "Move <title> to <next lane>") on Inbox and In Development only. The move button is invisible until card hover or focus-within; always visible on touch.
- Ready for Review cards replace the move button with a row of three 32px buttons: Approve (teal fill), Return (to In Development), Park.
- Parked cards show "Move back to In Development".
- "Unscored" never appears on a card; it lives in the dialog.

### IdeaDetailDialog (FocusDialog)
- Opens over the board with a 74% black scrim; board stays visible behind. 1120px max width, 18px radius, 40px from the top, scrolls with the page overlay. Reference: screenshots/MainCompact.png, State-Detail-390.png.
- Top bar (60px): stage dot + "Ideas & Research › <stage>", position "3 of 8" (order of visible cards across lanes), Previous and Next (disabled at the ends), Open as full page, Close (×, receives focus on open).
- Cover block only when the idea has media: 3:1, max 240px tall, "Play preview" (playable only) and "Replace cover" buttons bottom-right.
- Summary: hook kicker (when distinct), title (Unbounded 700, 22px), chips row (origin, research run with live dot, brand, owner avatar + name), four-step stage progress (Inbox, Development, Review, Approved; bars filled up to the current stage in its color; current label white); On Hold, Parked or a custom column show as an extra outlined chip after the bar.
- Tabs (44px, teal underline, ArrowLeft/ArrowRight move between them): Overview, Research (with run state as a small count label), Comments (count), History.
  - Overview: two editable fields side by side, "Who it is for" (`audience`, amber border while empty) and "Viewer walks away with" (`promise`); Hook (read only); Concept (`body`, placeholder text when empty).
  - Research: status bar ("Research is running", "Research run complete", "The last research run failed" on a red panel, "No research run yet") with Run research / Retry run / Run again (hidden while queued or running); editable "Question for research"; two stat boxes, Short-form views and Sources attached.
  - Comments: thread (avatar, name, time, text), empty text "No comments yet. Ask a question or leave a note for the owner.", composer with Post (Enter posts).
  - History: list of events with dot and time.
- Footer actions by lane (first button is the primary, teal fill; the rest outlined):
  - Idea Inbox: Start development; Send to review (disabled until the checklist passes).
  - In Development: Send to review (disabled until the checklist passes), with the hint "Add an audience to send" listing what is missing.
  - Ready for Review: Approve; Return to development; Park.
  - Approved: Convert to project (becomes disabled "Converted to project"); Put on hold.
  - On Hold, custom column: Resume development. Parked: Move back to In Development.
  - Close (text button) on the right.
- Side panel (300px min, `--panel`): Next step card (guidance text per lane from `spec/board-workflow.md`, then "Ready for review" with "2 of 3" and the checklist rows with checkbox visuals); Score (number + Strong/Fair/Weak chip, Impact/Confidence/Ease bars when ICE is set, "Research recommends: Park"; or "Not scored yet. A complete research run scores it." + Score manually); Details list (Stage, Idea origin, Research run, Brand, Owner, Priority, Platforms, Target window, Cover, Converted to; unset values muted).
- Every change in the dialog updates the board behind it immediately.

## Screen by screen

### Board (State-Board-1440, -1920, -1024, -390)
- Layout: Studio shell (sidebar 248px). Content padding 28/32/48. Header, then toolbar, then cover notice (12px gaps), then the board, which fills the remaining height of the viewport (min 560px). Lanes are a horizontal flex row that scrolls sideways when it does not fit; each lane's list scrolls vertically under its fixed header.
- Behaviour: drag a card between lanes or use its move button; every move goes through `stageBlocker`. Collapse and expand lanes; Add column; open a card.
- Data needed:
  - Lanes: stage key, label, description, color, count (all ideas in the stage for the brand scope, or the filtered count while filters or search are active), whether adding is allowed, collapsed flag (per user).
  - Cards: id, title, hook, origin (derived from `ideas.source`), run state (`ideas.run.state`), views and source count (derived, see Open questions), score (`scoreOf`: `research.score.total` or ICE average × 10), recommendation (derived from `rules.recommendation`), brand name and color (`brand_id` → brand kit), owner id, name and initial (`owner_id`), comment count, cover path and whether it is playable video, stage, on-hold flag, parked flag, custom column id.
  - Page: total ideas in scope, runs active, ideas missing a cover, saved views with counts.
- Edge states: empty lane (dashed target); filtered lane with no matches ("No matching ideas"); In Development pages at 5 cards with "Show N more"; failed run row; no brands yet (existing behaviour).

### Filters open (State-Filters-1440)
- Same board, filtered live: Inbox 0 shows "No matching ideas", In Development 3, Approved 1. Status tab counts change to 4/0/3/0/1. The Filters trigger shows "2" and a teal border. The views trigger shows the teal "edited" dot.

### Idea detail (MainCompact, State-Detail-390)
- Layout: dialog, two columns at desktop (main 560px+, side panel 300px+), stacked on phones (main, then side panel).
- Data needed: everything on the card plus `audience`, `promise`, `body`, `priority`, `platforms`, `target_window`, `ice` (impact, confidence, ease), `research` (sources, score, recommendation, question), `run`, comments with author and time, history events, `converted`, gate checklist for the next gated stage.
- Derived: position in visible order; checklist count; "N of 3"; primary action and its disabled state; "Strong/Fair/Weak" (75+ / 50 to 74 / below 50).
- Edge states: no cover (no cover block); unscored; no comments; no run; failed run (red panel + Retry).

## Interactions and motion
- Popovers and menus: open on click, focus moves to the first control inside, close on outside click (transparent scrim), on Escape (focus returns to the trigger) and on choosing a menu row. One open at a time.
- Dialog: opens on card click or title Enter; focus goes to Close; Escape, scrim click, × and Close all close it; focus returns to the card title that opened it. Previous/Next keep the dialog open and reset to the Overview tab.
- Hover-revealed controls (card move button, lane header controls) fade with `opacity` over 120ms; they stay reachable by keyboard (`:focus-within`) and are always visible on `(hover: none)`.
- Running research: 6–8px dot pulses (opacity 1 → 0.3, 1.4s, ease-in-out, infinite). Off under `prefers-reduced-motion`.
- Card hover: border to `--border-3`, 120ms. No card reordering under the cursor while a drag is in progress; drop puts the card at the top of the target lane, then the active sort applies.
- Blocked move: when `stageBlocker` returns a message, the card snaps back and the message shows (see Open questions for where).

## Responsive rules
The canvas measured these with the 248px sidebar and 32px content padding. Build them as container queries on the toolbar (`container-type: inline-size`) using the toolbar widths, so they hold if the shell changes.

| Toolbar width | Viewport (sidebar beside content) | Toolbar |
|---|---|---|
| 1088px and up | 1400px and up | Full row: status tabs, All ideas, search, Filters, Sort, Display, layout switcher |
| 842 to 1087px | 1154 to 1399px | Status tabs become the status dropdown |
| 678 to 841px | 990 to 1153px | Also: Sort and Display move into More (⋯) |
| under 678px | under 990px, and phones | Search, Filters and More only; status, saved view, layout, sort and display fields all live in More |

- The "/" key hint shows at 1600px viewport and up.
- Under 820px every popover opens as a bottom sheet (12px from the sides and bottom, max 72vh, scrolls).
- Under 640px content padding becomes 20/16/32.
- Board: lanes never shrink below 240px; the board scrolls sideways inside its own area (never the page). At 1440 the four working lanes fit with On Hold collapsed and the Add column strip; expanding On Hold makes the board scroll.
- Dialog under 640px: full screen, no radius, fields single column, breadcrumb text hidden (stage name stays).
- Header: actions wrap as a group below the title when they do not fit.

## Accessibility requirements
- Every control is a real `button`, `a` or `input` with a `label`. No clickable `div`s; the card's click-anywhere is a convenience layered on top of the title button.
- Icon-only controls have names: "Grid view", "Board view", "List view", "More options", "Previous idea", "Next idea", "Open idea as a full page", "Close idea details", "Collapse <lane>", "Expand <lane>, <n> ideas", "Column options for <lane>", "Remove <group> filter", "Move <title> to <lane>", "Retry research run for <title>", "Play preview of <title>", "Capture idea in Idea Inbox", "Add a finished pitch to Ready for Review", "Cancel adding a column".
- Toggle state: `aria-pressed` on status tabs, view switcher, filter options and sort rows; `role="switch"` + `aria-checked` on Display fields; `aria-expanded` + `aria-haspopup` on every menu trigger; `role="menuitemradio"` + `aria-checked` in Saved views and the status dropdown.
- Lanes are `section`s named "<lane>, <n> ideas"; their card lists are `role="list"`, cards `role="listitem"`.
- Dialog: `role="dialog"`, `aria-modal="true"`, labelled by the title; focus trapped (`FocusDialog`); tabs are `role="tab"` with `aria-selected` and `aria-controls`, panel `role="tabpanel"`; checklist rows expose ", done" or ", missing" to screen readers.
- Focus ring: 2px teal outline, 2px offset, on every focusable control; search and dialog fields show focus as a teal border.
- Contrast: body text at least 4.5:1 on its background, including 11–12px labels (`--muted` and up). `--faint` is never used for text.
- Touch: under `(pointer: coarse)` and 820px or narrower, toolbar controls and popover rows are 44px; card buttons are 44px under any coarse pointer.
- Moves must have a keyboard path: the card move button, the dialog actions and the review buttons cover every drag.

## Known design defects to fix in the build
These show in the screenshots; build the fix, not the picture.
1. At 1440 "READY FOR REVIEW" truncates to "READY FOR REV…" because the add button takes header width. Fix: when a lane is narrower than 280px, put the add button inside the hover control group instead of the header row (always visible on touch).
2. At 240–250px lanes the card footer truncates the brand name ("Co…") when a badge, avatar and move button are all present. Fix: give the brand a 72px minimum and collapse the move button's width until hover or focus.
3. At the same widths "Research run failed" wraps to two lines. Fix: use "Run failed" under 260px lane width.
4. On phones the dialog's main column stretches and leaves a large empty area before the footer (State-Detail-390.png). Fix: no vertical stretch (`align-content: flex-start`), and make the footer actions a sticky bottom bar on phones.
5. On phones the artboard stacks the full sidebar above the page (State-Board-390.png). That is the canvas, not the design: keep the Studio shell's existing mobile navigation.

## Open questions and assumptions
1. Stage names. Assumption: keep the `idea_stage` enum (`inbox, research, ready, approved`) and only relabel: research → "In Development", ready → "Ready for Review", "Inbox" → "Idea Inbox" on lanes ("Inbox" on tabs). `gates.ts` and `vals-ideas.js` use the old labels as keys (`ORDER`, `STAT_T`), and `stageBlocker` messages say "Can't move to Research yet"; add a label map and update those messages. If Zach wants the enum renamed instead, that is a migration plus `app.idea_gate_missing` changes.
2. On Hold storage. Assumption: a flag, like `archived_at`: add `ideas.on_hold_at timestamptz` (and `on_hold_by`). The idea keeps its stage and gates; the board shows it in the On Hold lane while the flag is set; Resume clears it. If it should be a real stage, add `on_hold` to the enum and decide its gates.
3. Parked storage. Assumption: `ideas.parked_at timestamptz`, excluded from the board and listed in the Parked saved view. Today "Park" exists only as a research recommendation (`rules.recommendation.park`). If parking should archive, reuse `archived_at` instead.
4. Custom columns. Assumption: a workspace-scoped table (`idea_board_columns`: id, workspace_id, label, color, position, created_by) plus `ideas.board_column_id`, mirroring the project board's custom columns (see `AddColumn.jsx` and the "who can edit" setting from commit 71fc9be). The idea keeps its stage. Who may add, rename, recolor and delete columns: assume admin and managers with `ideas:edit`.
5. Collapsed lanes. Assumption: per user per workspace in `localStorage` (`ftgu_ideas_board_collapsed:<workspace_id>`), default `{ on_hold: true }`, same pattern as ZZMEDIA-DASHBOARD's planning board. Move to a user preference row if the team wants it to follow them across devices.
6. Idea origin. Assumption: `source = 'research'` → AI-generated; `manual`, `import`, `url` → Manual. `chat` is unclear (assistant-created); assume AI-generated. Origin never changes when AI later researches a manual idea (per `spec/board-workflow.md`).
7. Research run states. Mapping: `queued` → Queued, `running` → Running, `done` → Complete, `failed` → Failed (red row + Retry, using the existing retry in `lib/ideas/research.ts`), `canceled` → treat as no run (no pill).
8. Ready-for-review checklist. The design shows hook, audience, sources (from the workflow doc). The app's real gates are rules-driven (`rules.required_fields_by_stage.ready`, keys notes, source, cover, score, research, pursue). Assumption: render `gateChecklist(idea, 'ready', rules)` and add two new required-field keys, `hook` and `audience`, to `REQUIRED_FIELDS` and to `app.idea_gate_missing`, so admins can pick them in Rules. Do not change existing workspaces' defaults without Zach's OK.
9. Context line "1.8M views · 3 sources". Assumption: views = the highest view count among research sources or findings from short-form search; sources = sources + refs + findings (same as the `source` gate). Confirm the field that carries view counts in `research.sources`.
10. Recommendation badge ("58 · Park"). Assumption: use the research result's recommendation when present; otherwise derive from `rules.recommendation` (at or above pursue → Pursue, below park → Park, between → no word). Show the word only before Approved.
11. Owner filter options. Assumption: "You" plus every member who owns at least one idea in scope.
12. Blocked moves. The design does not show the blocked state. Assumption: the card snaps back and the existing toast shows the `stageBlocker` message; in the dialog the primary button is disabled with the missing items as its hint (as designed).
13. Playable media. Assumption: a cover file with a video MIME type in `files` counts as playable. Image covers show no play control.
14. Dialog URL. Assumption: sync `ideaOpen` to `?idea=<id>` so a dialog can be linked and Back closes it. "Open idea as a full page" goes to the existing full idea view if there is one; otherwise hide the button.
15. "Score manually" opens the existing ICE editor. "Manage views" opens the existing saved-views management.

## Build order
1. Phase 1 · Board lanes and cards with real data. New lane headers (big count, name, description, divider), lane sizing and independent scrolling, the two card layouts, footer, failed-run row, review buttons, empty states, drag and move through `stageBlocker`, dialog not yet. Done when: at 1440 the page matches screenshots/State-Board-1440.png with live ideas from the FromTheGroundUp project, a drag from Inbox to In Development succeeds or shows the blocker, and every lane reaches the bottom of the viewport.
2. Phase 2 · Toolbar. Status tabs, saved views, search, Filters popover with chips, Sort popover, Display fields, layout switcher, cover notice, container-query levels. Done when: State-Filters-1440.png behaviour reproduces (counts, chips and badge update together) and the toolbar holds one row at 1440 and 1920 with no clipped labels, and the 1024 and 390 layouts match their screenshots.
3. Phase 3 · Idea detail dialog. FocusDialog shell, summary, progress, four tabs, side panel, stage actions, comments, history, previous/next, URL sync. Done when: opening the Streetwear-style idea (In Development, no audience) shows "2 of 3" and a disabled Send to review, typing an audience enables it, sending moves the card on the board behind, and Escape returns focus to that card.
4. Phase 4 · On Hold, Parked, custom columns, collapse. Migrations for open questions 2–4, Add column strip, options popover (rename, color, delete with confirm), collapsed lanes with persistence. Done when: On Hold starts collapsed, a card can be dropped on the collapsed strip, a new column can be added, renamed, recolored and deleted (its ideas move left), and collapse state survives a reload.
5. Phase 5 · Responsive and accessibility pass. Phones (bottom sheets, full-screen dialog with sticky actions, 44px targets), the five known defects, keyboard paths and names from "Accessibility requirements". Done when: 1920, 1440, 1024 and 390 match their screenshots apart from the listed defect fixes, and every action in this spec works without a mouse.
