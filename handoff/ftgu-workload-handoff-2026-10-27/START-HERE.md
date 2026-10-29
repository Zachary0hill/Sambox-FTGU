# Build: FTGU Workload

You are implementing a finished UI design for the Admin > Workload page in this repo (Sambox-FTGU). The design is final. Match it. Do not redesign it.

## Read in this order
1. HANDOFF.md fully.
2. screenshots/Main.png. Look at the whole page before writing code.
3. html/Main.html for structure, spacing and inline values.
4. source/Main.dc.html `renderVals()` for the interaction logic (issue rules, filters, chart math, assignment, undo).
5. tokens-candidates.json when you map colors to CSS variables.

## Target
Next.js 16, React 19, Supabase, inline `css()` styles with existing CSS variables. View model in `lib/studio/vals-admin.js` (Workload block), render in `components/studio/StudioView.jsx` (`V.adm.isPM` block), writes through `lib/studio/actions.js` (`setField`, `updateSettings`). Reuse `components/studio/Prims.jsx`. Do not add a UI or chart library.

## Rules
- The screenshot is the source of truth when text and picture disagree.
- Map design hex values to existing variables first (`--ink`, `--surface`, `--line`, `--red-soft`...). Add new tokens only where HANDOFF.md marks a value as new.
- Every component gets the states listed in HANDOFF.md § Component inventory, including empty, loading and error.
- Under 720px: sidebar hidden, single column, tables scroll inside their card, the page never scrolls sideways.
- Real elements for accessibility: button, a, input with label. Never a clickable div.
- All names, titles, sponsors and numbers in the design are sample data. Wire everything to Supabase.

## Start with Phase 1
View model and top of page: shared page state, issue rules and loads in vals-admin. Render Header, UndoBanner, MetricTiles (no sparklines), Needs attention with the inline AssignPicker writing through `A.setField`. Done when assigning an editor from Needs attention writes `project_edits.editor_id`, the item disappears, counts and loads update, and Undo restores the previous editor.
Stop after Phase 1 and report: what was built, what tokens were added, what in the design could not be matched and why. Then continue phase by phase.

## When something is unclear
Check HANDOFF.md § Open questions and assumptions first. If still unclear, make the smallest reasonable choice, note it in your report, keep going.
