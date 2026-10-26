# Project card + detail modal: build spec

Source designs (open in a browser):

- `ProjectCard.dc.html`: kanban card on the board, anatomy, and every state (minimal, hover, quick menu, selected, dragging, overdue, role views, compact)
- `CardDetail.dc.html`: detail modal (header, pipeline stepper, tabs, properties rail, mobile sheet)

These are design references, not drop-in code. Port into the existing pattern: style strings and handlers in
`lib/studio/vals.js` (`cardFor()` for the card, the `dr` object for the modal), markup in
`components/studio/StudioView.jsx` (the `V.isKanban` block and the `V.drawerOpen` block), writes in `lib/studio/actions.js`.
Keep the current tokens (`--ink`, `--surface`, `--line-4`, TONE, TYPEFILL, `solid()`).

## What changes on the card (vs. today)

| Today | New |
|---|---|
| Type block and `Status: Filming` block are both solid fills | Type stays solid (TYPEFILL). Status becomes the soft tone with a dot (`TONE[t][0]` bg, `[1]` ink, `[2]` dot), no `Status:` prefix |
| `Edit: …` / `Thumb: …` badges always shown | Only shown as **flags** when someone has to act: `Needs Revision` (red soft), sponsor `Pending` / `Changes Requested` (amber / red). Everything else lives in the pipeline |
| No progress signal | **Pipeline bar**: one 4px segment per step, same steps and states as the drawer's `steps[]` (`done` `#22844C`, `now` `#2F5BD3`, `warn` `#C42B2F`, todo `var(--track)`). Needs an `aria-label` summarising the steps |
| Footer divider always drawn, even when empty | Footer only when it has people, counts, a date or a live link |
| Comments count top right | Moves to the footer with files and checklist counts. Red dot when the viewer has unread comments on it. Zero counts hidden |
| Every date in `role.card.dates` | One date: the next one that matters for the role (first not-done of film → editDue → thumbDue → pub). Late shows `Nd late` |
| Job # not shown | Job # in faint tabular figures next to the type |
| No card actions | `⋯` button (hover / focus only) opens a quick menu: Open, Change status, Assign editor, Move to next stage, Copy link, Duplicate, Archive |
| — | Optional **cover**: latest image file of kind `thumbnail` (16:9, `margin: 0 -6px`). Hidden in Compact density. Behind a View option “Show covers” (default on) |

Card container keeps today's `cardStyle` (18px radius, `--line-4` border, `.fb-card` hover). Add to globals:
`.fb-card:hover { box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06) }` and the `.fb-more` opacity reveal
(`.fb-card:hover .fb-more, .fb-card:focus-within .fb-more { opacity: 1 }`).

### Role behaviour (driven by `role.card`)

- Super Admin: status = `status`, people = editor + designer, date = next of film / pub.
- Editor: status shows `editStatus`, date = `editDue`. Designer: `thumb`, `thumbDue`.
- Sponsor: no job #, people, pipeline or `⋯`. Flag “Your approval needed” when `status === 'Sponsor Review'` and `approval` is Pending.

### Interactions

- Whole card is the click target (existing `.fb-stretch` title button). `Enter` opens, `⋯`/`Shift+F10` opens the menu.
- Drag: lifted card `transform: rotate(2deg)` + `0 24px 48px rgba(0,0,0,.18)`; dashed 92px slot (`--border-strong`) where it lands. Drop into another stage calls the existing stage move.
- Selected (its modal open): `border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink)` (already `sel` in `cardFor`).

### New fields `cardFor()` needs

`job`, `statusSoft` (style), `flags[]`, `pipe[]` (`{ state }` from the same logic as the drawer stepper — extract it into a
shared `stepsFor(r)`), `counts` (`comments`, `unread`, `files`, `checklist` `{ done, total }`), `next` (one date chip),
`cover` (signed URL or null), `menu[]`, `hasFoot`.

## Detail modal

Replaces the side drawer as the **default** for Kanban (`openIn` stays user-switchable: side / center / full; set the Kanban
view's default to `center`). Same `dr` data, new layout:

1. **Header**: job chip, stage crumb, `n of N`, prev / next (`J` / `K`), copy link, open as full page, `⋯`, close (`Esc`).
   Title is the existing inline rename. Under it: type block, **status dropdown** (soft tone, opens the existing StatusEditor
   / select picker), then `channel · Pub date · Linked to monday`.
2. **Pipeline stepper**, horizontal, full width under the header (the drawer's `steps[]`, same markers). Current step gets
   `aria-current="step"`.
3. **Body** = main column + 360px **properties rail**.
   - Main: tabs Overview / Comments / Files / Activity (ids unchanged so notification links still work).
     Overview = Brief, Checklist, Latest files (3 + “See all”), and the existing Publish block when the project is in Publishing.
     The comment composer only shows on the Comments tab, pinned under the thread.
   - Rail: **Next step** card (primary button = the drawer's first `primary` action, with one line saying what it does),
     then grouped properties: Details, Team (person + their own status block), Dates (chip + relative text; warn when Pub
     is before Edit due), Sponsor, Publishing, More properties (custom columns + Add property for admins), created / edited meta.
     Each row is click-to-edit using the existing cell editors (`editorModel`); read-only rows don't get the hover fill.
4. **Mobile (< 860px)**: full-screen sheet, stepper scrolls sideways, rail stacks above the tabs, hide position / full-page / copy-link.

Dialog: `width: min(1120px, 100vw - 48px)`, `height: min(88vh, 900px)`, 24px radius, scrim `rgba(17,17,17,.36)`,
enter animation `.18s cubic-bezier(.2,.8,.2,1)` (none under reduced motion). Focus goes to the title on open and returns to
the card on close.

## Data model

- **Brief** is new: `alter table projects add column brief text;` (markdown, edited inline, saved on blur). Everything else on
  the card and modal already exists (`project_checklist`, assets, comments, history).
- Unread comment dot needs a per-user last-seen marker: reuse notifications if a comment notification exists for the viewer,
  otherwise add `project_reads (project_id, user_id, seen_at)`.
