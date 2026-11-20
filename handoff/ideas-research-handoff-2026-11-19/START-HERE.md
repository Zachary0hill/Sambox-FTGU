# Build: Ideas & Research Refactor

You are implementing a finished UI design for the SantosStudios Ideas & Research page. The design is final. Match it; do not redesign it.

## Read in this order
1. HANDOFF.md fully.
2. Every file in screenshots/. Open each PNG and look at it before building that screen.
3. html/State-Board-1440.html for structure and spacing values. Then html/MainCompact.html (idea detail dialog) and the other html/ files as you reach each state.
4. tokens-candidates.json when you map colors to the theme variables.
5. spec/board-workflow.md for the workflow rules behind the lanes and checklist. The other spec/ files only if HANDOFF.md points you there.

## Target
Repo `Sambox-FTGU` (Next.js 16, React 19, Supabase). Read AGENTS.md first. The page lives inside the Studio shell: logic in `lib/studio/vals-ideas.js` (`ideasVals`), markup in `components/studio/StudioView.jsx` under `isIdeas`. Reuse the primitives named in HANDOFF.md § Target stack and conventions (`Prims.jsx`, `FilterBar.jsx`, `FocusDialog.jsx`, `AddColumn.jsx`, `IdeaConvert.jsx`, `gates.ts`). Do not add a new UI library or a new page.

## Rules
- The screenshot is the source of truth when text and picture disagree, except the items in HANDOFF.md § Known design defects to fix in the build.
- Same tokens everywhere: map design hex values to the dark theme variables in `lib/studio/vals.js` (`TK`) as HANDOFF.md § Design tokens lists. Add a token only where it says "new".
- Every component gets the states listed in HANDOFF.md § Component inventory, including empty, filtered-empty, failed, loading and disabled.
- Phone screenshots define behaviour under 820px: bottom sheets, full-screen dialog, Search + Filters + More toolbar.
- Real elements for accessibility: button, a, input with label. Never a clickable div.
- Every stage change goes through `stageBlocker` and the database gate. Never bypass `app.idea_gate_missing`.
- Keep copy as written on the artboards.

## Start with Phase 1
Board lanes and cards with real data: new lane headers, lane sizing and scrolling, both card layouts, footer, failed-run row, review buttons, empty states, drag and move through `stageBlocker`. Done when the page at 1440 matches screenshots/State-Board-1440.png with live ideas, a drag from Inbox to In Development succeeds or shows the blocker, and every lane reaches the bottom of the viewport.
Stop after Phase 1 and report: what was built, which tokens were added, what in the design could not be matched and why. Then continue phase by phase.

## When something is unclear
Check HANDOFF.md § Open questions and assumptions first. Phase 4 needs migrations (On Hold, Parked, custom columns): show the migration SQL and wait for approval before applying it. Otherwise make the smallest reasonable choice, note it in your report, keep going.
