# Project card + modal: nice-to-have features

Follow-ups to the kanban card and project modal (see `HANDOFF.md`, `ProjectCard.dc.html`, `CardDetail.dc.html`).
None of these block anything. Each builds on code that already shipped in `8270714`.

---

## 1. Card display settings per view

Let each person choose what a Kanban card shows, the same way columns are chosen for the table.

**Why**
- Editors care about their deadline and revisions, while sponsors care about status and publish date. Today `role.card` decides that for the whole role.
- The code already reads a `VS.covers` flag, but nothing in the UI sets it.

**What**
- A new "Card" section in the View menu (Kanban only) with:
  - On/off toggles for Cover, Pipeline, People, Counts and Job #.
  - A "Date shown" picker: next date (default), Film, Edit due, Thumb due or Pub.
  - "Show on cards" for custom columns. The flag already exists on the field config; this surfaces it here.
- A small live preview card at the top of the section.

**Where**
- `lib/studio/vals.js`:
  - `cardFor()` reads `VS.card = { cover, pipe, people, counts, job, date }`.
  - The defaults stay what `role.card` gives today.
- `components/studio/ViewPanels.jsx`: the new section, saved through the existing `setView()` / `A.saveView()`.
- No migration is needed: the board's view state is already stored per member and view.

**Done when**
- Toggling a setting updates the board right away and survives a reload.
- Role defaults are unchanged for anyone who never opens the setting.

**Size:** small (about a day)

---

## 2. Unread-aware comments and @mentions

Turn the unread dot into a full "what's new for me" loop.

**Why**
- `project_reads` now records when each person last opened a project's Comments, but only the card's dot uses it.
- The comment trigger already queues the `mention_admin` automation on @-mentions of admins, but nobody else can be mentioned or notified.

**What**
- **In the thread:** a "New since your last visit" divider above the first unread comment, using `project_reads.seen_at`.
- **On the board:** an "Unread" quick filter next to the search (projects with unread comments for me) and a count in the Projects nav item.
- **@mentions in the composer:**
  - Typing `@` suggests team members and sponsor contacts on the project.
  - Mentions render as chips in the comment.
  - A mention notifies that person through the existing email notification path (`/api/notifications/send`) and puts the project in their Unread filter even if they never commented.
- **Read state edge cases:**
  - Mark the project seen when the modal opens straight onto Comments from a notification link. Today only switching tabs, stepping to another project or closing the modal marks it seen.
  - Mark the project seen when you post a comment.

**Where**
- `lib/studio/vals.js`: `commentRows` (divider), the filter rules, and `unreadFor()`.
- `components/studio/StudioView.jsx`: the composer gets a mention picker. Reuse the person rows from `CellEditor`.
- `lib/studio/actions.js`: `postComment()` sends the mention list. Add a `mentions uuid[]` column on `comments` in a new migration.
- `supabase/migrations`: extend `app.auto_on_comment()` to queue a notification per mentioned member.

**Done when**
- A mentioned teammate gets an email.
- The project shows in their Unread filter.
- The divider sits above the first comment they haven't seen, and clears after they leave Comments.

**Size:** medium (2 to 3 days)

---

## 3. Keyboard moves and quick actions on the board

Make everything you can do with the mouse on the board doable from the keyboard, and faster for power users.

**Why**
- Dragging between columns only works with a mouse or trackpad. Keyboard and screen-reader users have no way to move a card to any column; the menu's "Move to next status" only goes one step.
- `HANDOFF.md` lists J / K for previous / next project in the modal, but that shortcut wasn't built.

**What**
- **On a focused card:**
  - `Enter` opens it.
  - `Shift + ←/→` moves it to the previous / next column, with a live-region announcement ("Moved to Post Production").
  - `.` opens the quick menu.
  - A "Move to…" submenu in the quick menu lists every column for the current grouping (stage, status, type, channel, editor).
- **In the modal:**
  - `J` / `K` steps through projects.
  - `C` jumps to Comments and focuses the composer.
  - `E` edits the title.
  - `Esc` already closes it.
- **Shortcut help:** a `?` overlay lists the shortcuts for the board and the modal.
- **Drag polish:** a custom drag image so the lifted card shows the 2° tilt from the design, instead of the browser's flat ghost.

**Where**
- `lib/studio/vals.js`:
  - `cardFor()` gets an `onKey` for the move keys, reusing `dropField` / `dropVal`.
  - The menu gets `moveTargets` built from `defs`.
  - `dr.onKey` gets the J / K / C / E shortcuts.
- `components/studio/StudioView.jsx`:
  - The card's `tabIndex` and the submenu.
  - An `aria-live` region.
  - The `?` overlay.
- No database changes.

**Done when**
- A card can go from In Production to Publishing using only the keyboard, and a screen reader announces each move.
- Shortcuts never fire while typing in a field.

**Size:** small to medium (1 to 2 days)
