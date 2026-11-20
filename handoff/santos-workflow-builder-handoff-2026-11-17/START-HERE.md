# Build: Workflow Builder, SantosStudios

You are implementing a finished UI design in Sambox-FTGU. The design is final. Match it; do not redesign it. This upgrades the existing workflow feature in this repo. Do not build a parallel one.

## Read in this order
1. HANDOFF.md fully.
2. Every file in screenshots/. Open each PNG and look at it before building that screen. Main.png is the shared contract, not a screen.
3. html/Santos-Hub.html for structure and spacing values. Then the other html/ files as you reach each screen.
4. source/Santos-Builder.dc.html and source/Santos-Hub.dc.html for modal and drawer states that have no screenshot.
5. tokens-candidates.json when you set up tokens.

## Target
Next.js 16 App Router, React 19, plain JSX (no TypeScript), Tailwind 4, Supabase. Reuse the existing components and primitives named in HANDOFF.md § Target stack and conventions. Do not add a new UI library.

## Rules
- The screenshot is the source of truth when text and picture disagree.
- Same tokens everywhere: map design values to existing tokens first, add new tokens only where none exists.
- Every component gets the states listed in HANDOFF.md § Component inventory, including empty, loading and error.
- Under 900px follow HANDOFF.md § Responsive rules. No phone artboards exist.
- Real elements for accessibility: button, a, input with label. Never a clickable div.
- Keep copy as written on the artboards. Sample records are placeholders; use real data.
- Never show raw variable paths or cron strings in the UI. Named chips and plain words only.

## Start with Phase 1
Theme token file, copy file, graph types and adapter from the existing stored flow, then the Hub with real workflows. Done when the hub lists real workflows with correct previews, switches persist, counts are real, and the page matches Santos-Hub.png at 1440 and under 900px.
Stop after Phase 1 and report: what was built, what tokens were added, what in the design could not be matched and why. Then continue phase by phase.

## When something is unclear
Check HANDOFF.md § Open questions and assumptions first. If still unclear, make the smallest reasonable choice, note it in your report, keep going.
