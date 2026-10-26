# Dev Notes dock

A floating, draggable card that lets Super Admins jot down development notes while they use the app. Press **N** anywhere on the board and the dock appears in the bottom-right corner. Type a note, press Enter, and it is saved with the page you were on and who wrote it. Every Super Admin in the workspace sees the same list.

The same dock exists in ZZMEDIA-DASHBOARD and parish-agent-dashboard. This document explains the FTGU Studio version, then shows how to lift it out into a package you can drop into any Next.js app.

---

## 1. What it is

Think of it as a shared sticky-note pad for the people building and running the product. It replaces the "I noticed a bug on the clients page, remind me later" message in Slack with a one-keystroke capture that is already tagged with context.

| Feature | Detail |
| --- | --- |
| Open / close | Bare `n` toggles it. Cmd/Ctrl/Alt + N are left to the browser. Typing inside an input, textarea, select or contenteditable never triggers it. Open `<dialog>` elements also block it. Esc closes. |
| Categories | **Idea** (amber), **Enhance** (violet), **Bug** (red). The last used category is remembered in localStorage. Clicking the colored dot on a saved note cycles its category. |
| Auto tagging | Each note stores `page_path` (pathname + search + hash) and `created_by` / `created_by_email`. The row shows "Idea · zach · /admin/clients". |
| Resolve | Click the circle to mark done. The row fades out of the open list; **Show done** brings resolved notes back, struck through. Click again to reopen. |
| Delete | Trash icon appears on hover. |
| Drag | Grab the header strip and move it anywhere. Snaps to the viewport margin when dropped near an edge. Position persists in localStorage. Double-click the header to reset to the default corner. With the grip focused, arrow keys nudge (Shift for larger steps). Esc during a drag cancels and springs back. |
| Live updates | Supabase Realtime on the `dev_notes` table: when another admin adds or resolves a note, the list refreshes. |
| Access | Only members whose role is `super_admin`. Enforced in the UI (the component is not mounted for other roles) **and** in Postgres with RLS, so a non-admin cannot read or write rows even with the API. |

---

## 2. How it works in FTGU Studio

### Files

| File | Role |
| --- | --- |
| `components/studio/DevNotes.jsx` | The whole feature: hotkey owner, drag hook, card UI, Supabase reads and writes. |
| `components/studio/Studio.jsx` | Decides whether to mount it (`me.uiRole === 'admin'`) and passes the Supabase client, the current member and the workspace id. |
| `components/studio/StudioView.jsx` | Renders `{V.devNotes}` inside the board root so the card inherits the theme CSS variables. |
| `app/globals.css` | Hover and drag states (`.fb-devnotes`, `.fb-devnote`, `html[data-floating-drag]`). |
| `supabase/migrations/20261023000700_dev_notes.sql` | Table, index, RLS policies, `updated_at` trigger, realtime publication. |

### Data model

```sql
create table public.dev_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content text not null check (length(content) between 1 and 2000),
  category text not null default 'idea' check (category in ('idea', 'enhancement', 'bug')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  page_path text,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

RLS is one line per verb, all using the existing helper `app.is_admin(workspace_id)`:

```sql
create policy dev_notes_select on public.dev_notes for select to authenticated
  using ((select app.is_admin(workspace_id)));
create policy dev_notes_insert on public.dev_notes for insert to authenticated
  with check ((select app.is_admin(workspace_id)) and created_by = (select auth.uid()));
```

`sort_order` keeps new notes at the top: a new note takes `min(sort_order) - 1`. Within equal `sort_order`, newest first.

### Component structure

`DevNotes.jsx` exports one default component and contains three pieces:

```
DevNotes            owns the "n" hotkey and the open/closed state; renders nothing while closed
└── DevNotesCard    the visible dock: data loading, optimistic writes, realtime, Esc, the UI
    └── useDrag     drag-to-move hook for the absolutely positioned shell
```

**DevNotes (hotkey owner).** One `keydown` listener on `document`. It checks the key, the modifiers, `event.repeat`, the event target's tag, and whether a `<dialog open>` exists. If all pass it calls `preventDefault()` and toggles state. Because the card only mounts when open, the card's data fetch runs fresh every time it opens.

**DevNotesCard (data and UI).**

- On mount: load the last category from localStorage, focus the input, fetch notes for the workspace.
- Subscribe to a Realtime channel filtered to `workspace_id=eq.<id>`; changes debounce 250 ms and refetch quietly (no spinner).
- All writes are **optimistic**: update local state first, then call Supabase, and roll back with a short error banner if the call fails. Adding inserts a temporary row with a `tmp-` id that is swapped for the server row on success.
- Resolving fades the row for 300 ms and then removes it from the list unless **Show done** is on.
- The input stops `keydown` propagation so `n` and Esc typed in the box never reach the global listeners. Esc in the box clears the text first, then closes on a second press.

**useDrag (movement).** The card is an absolutely positioned shell inside a `position: fixed; inset: 0; pointer-events: none` layer. The shell has `pointer-events: auto`, so the rest of the page stays clickable around the card.

1. `pointerdown` on the header records the pointer, the card's current rect, and captures the pointer. Clicks on buttons, inputs or anything with `data-no-drag` are ignored.
2. `pointermove` does nothing until the pointer travels 4 px, so a plain click never nudges the card. Past the threshold it pins the shell to `left/top`, sets `data-dragging="true"`, and adds `data-floating-drag` to `<html>` (which forces a grabbing cursor and disables text selection page-wide).
3. Each frame (one `requestAnimationFrame` at a time) it clamps the target to the viewport minus a 24 px margin and applies `transform: translate3d(...)`. Only the compositor runs, so it stays smooth over blurred or heavy backgrounds.
4. `pointerup` bakes the translate into `left/top` and clears the transform in the same synchronous step, so nothing jumps. If within 16 px of an edge it glides to the margin with a 160 ms ease. The position is saved to localStorage.
5. Esc mid-drag (captured on `window` with `stopImmediatePropagation`) cancels and glides back to the start. Double-click resets to the default corner and clears the saved position.

Theming comes entirely from the CSS variables the board already sets on its root (`--surface`, `--ink`, `--muted`, `--line-3`, `--amber-soft`, and so on). That is why the card is rendered inside the board root rather than portaled to `document.body`: a portal would land outside the element that defines those variables.

---

## 3. Turning it into a reusable component

The FTGU version is deliberately self-contained in one file, but it hardcodes four things: the Supabase client, the table and workspace column, the role check, and the FTGU theme variables. A reusable version separates **what the dock looks like and how it moves** from **where notes are stored and who may see them**.

### 3.1 Target shape

```
packages/dev-notes/
├── package.json
├── src/
│   ├── index.ts              public exports
│   ├── DevNotesDock.tsx      hotkey + card (UI only)
│   ├── useFloatingCardDrag.ts
│   ├── types.ts              DevNote, Category, DevNotesStore
│   ├── stores/
│   │   ├── supabase.ts       store backed by a Supabase table
│   │   └── rest.ts           store backed by /api/dev-notes (ZZMEDIA / Parish style)
│   └── theme.css             default tokens, overridable
└── README.md
```

Usage in any app becomes:

```tsx
import { DevNotesDock, createSupabaseStore } from '@zz/dev-notes';

const store = createSupabaseStore({ client: supabaseBrowser(), scope: { workspace_id: ws } });

export function Overlays({ isSuperAdmin }) {
  if (!isSuperAdmin) return null;
  return <DevNotesDock store={store} author={{ id: me.id, email: me.email }} hotkey="n" />;
}
```

### 3.2 Step by step

**Step 1. Define the data contract.** Move the row type and a store interface into `types.ts`. The dock talks only to this interface.

```ts
export type Category = 'idea' | 'enhancement' | 'bug';

export type DevNote = {
  id: string;
  content: string;
  category: Category;
  priority: 'low' | 'medium' | 'high';
  page_path: string | null;
  is_resolved: boolean;
  sort_order: number;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
};

export type DevNotesStore = {
  list(): Promise<DevNote[]>;
  add(input: { content: string; category: Category; page_path: string | null; sort_order: number }): Promise<DevNote>;
  update(id: string, patch: Partial<Pick<DevNote, 'content' | 'category' | 'priority' | 'is_resolved'>>): Promise<void>;
  remove(id: string): Promise<void>;
  /** Optional. Call `onChange` when another client changes the list; return an unsubscribe. */
  subscribe?(onChange: () => void): () => void;
};
```

**Step 2. Extract the drag hook.** `useDrag` inside `DevNotes.jsx` is already a pure hook. Move it to `useFloatingCardDrag.ts`, give it an options object (`cardRef`, `open`, `storageKey`, `width`, `margin`, `snapDistance`, `fallbackHeight`, `nudgeStep`) and return `{ positionStyle, isDragging, handleProps, gripKeyDown, resetPosition }`. The Parish repo already has this exact file in TypeScript at `src/components/dev-notes/useFloatingCardDrag.ts`; copy it as the starting point. The hook has no knowledge of notes, so it is also reusable for any other floating card (quick to-dos, a timer, a help widget).

**Step 3. Make the card UI store-agnostic.** In `DevNotesDock.tsx`, replace every direct Supabase call with the store:

| Today (FTGU) | Reusable |
| --- | --- |
| `sb.from('dev_notes').select(...).eq('workspace_id', ws)` | `store.list()` |
| `sb.from('dev_notes').insert(row).select().single()` | `store.add(input)` |
| `sb.from('dev_notes').update({...}).eq('id', id)` | `store.update(id, patch)` |
| `sb.from('dev_notes').delete().eq('id', id)` | `store.remove(id)` |
| `sb.channel(...).on('postgres_changes', ...)` | `store.subscribe?.(refetch)` |

Keep the optimistic update and rollback logic in the card; it is the same for every backend. Accept `author` as a prop instead of reading `me`, and compute `page_path` with a `getPagePath` prop that defaults to `pathname + search + hash` so hash-routed apps and query-routed apps both work.

**Step 4. Write the stores.**

*Supabase store* (what FTGU uses). Takes a client, a table name (default `dev_notes`) and an optional `scope` object such as `{ workspace_id }` that is both filtered on reads and merged into inserts. `subscribe` opens a Realtime channel filtered to the scope.

*REST store* (what ZZMEDIA and Parish use). Takes a base URL (default `/api/dev-notes`) and an optional fetch wrapper for auth headers. GET / POST / PATCH / DELETE map one-to-one onto the interface. No `subscribe`, so the card simply refetches when opened.

Both stores are about 40 lines each. An app picks the one that matches how it already talks to its database.

**Step 5. Theme through CSS variables with defaults.** The card should use its own namespaced variables and fall back to sensible values:

```css
.dn-card {
  background: var(--dn-surface, var(--surface, #fff));
  color: var(--dn-ink, var(--ink, #111));
  border-color: var(--dn-line, var(--line-3, #e5e5e5));
}
```

The first fallback lets a host app that already has `--surface` and `--ink` (FTGU) get the right look with zero config. The second fallback makes the card usable in an app with no design tokens at all. For Tailwind hosts (ZZMEDIA, Parish) set the `--dn-*` variables once in `globals.css` from the Tailwind palette.

Ship the drag and hover rules (`html[data-floating-drag]`, `.dn-row:hover .dn-delete`) in `theme.css` and import it from the package entry so no host has to copy CSS.

**Step 6. Decide where it mounts.** Export two components:

- `DevNotesDock` renders in place. Use it when the host has a themed root element the card must sit inside (FTGU).
- `DevNotesPortal` wraps the dock in `createPortal(..., document.body)` and copies a `themeVars` prop onto the portal wrapper. Use it when the host has global tokens or Tailwind (ZZMEDIA, Parish).

Both share the hotkey logic, which should also be a hook, `useHotkeyToggle(key, options)`, so a host can bind the dock to its own command palette instead.

**Step 7. Keep authorization in the host.** The package must not decide who is an admin. The host renders the dock only for allowed users, and the host's backend (RLS policies, or the API route's role check) enforces it. Put this in the README in bold: rendering the component is not a security boundary.

### 3.3 Migration kit

Include the SQL in the package under `sql/` in two flavours, since apps differ in how they scope notes:

- `dev_notes_scoped.sql` with a `workspace_id` column and `is_admin(workspace_id)` RLS (FTGU).
- `dev_notes_global.sql` with no scope column and no policies, read only through a service-role API route (ZZMEDIA, Parish).

Each file is idempotent (`create table if not exists`, `create policy ... ` guarded by a `do $$ ... $$` block) so it can be run in the Supabase SQL editor or applied with the MCP.

### 3.4 Publishing

- Build with `tsup` to ESM with `"use client"` preserved on the component entry (`banner: { js: '"use client";' }`).
- Mark `react`, `react-dom` and `@supabase/supabase-js` as peer dependencies; the REST store needs none of them.
- Version the SQL alongside the code. A `CHANGELOG.md` entry for any column change tells each host which migration to run.
- Private registry or a `packages/` workspace in a monorepo both work. If the three dashboards stay in separate repos, a GitHub Packages scope such as `@zzmedia/dev-notes` is the least friction.

### 3.5 Checklist for a new host app

1. Run the matching SQL file.
2. Install the package and import `@zzmedia/dev-notes/theme.css` once.
3. Create a store (`createSupabaseStore` or `createRestStore`).
4. Mount `<DevNotesDock>` or `<DevNotesPortal>` behind the host's admin check.
5. Optionally set `--dn-*` variables for brand colors.
6. Press `n`.
