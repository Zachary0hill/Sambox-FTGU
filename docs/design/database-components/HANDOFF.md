# Database components: implementation handoff

Source of truth for the Notion-style column system in the FTGU Studio board.
The `.dc.html` files in this folder are static design comps. Read them for layout, spacing, states and copy.
Do not ship them. Rebuild each component in the existing board code.

## Files

| File | What it specifies |
|---|---|
| `Main.dc.html` | Tokens: option colors, chip styles, menu anatomy, inputs, type icons |
| `AddColumn.dc.html` | Add a column modal (step 1 type, step 2 configure), header + quick add popover |
| `HeaderMenu.dc.html` | Header cell states, header menu, change type submenu, delete confirm, role permissions |
| `SelectEditor.dc.html` | Select and multi select picker, create from search, option menu, option sort, cell states, keys |
| `StatusEditor.dc.html` | Status picker grouped by stage, status options config, option menu, show-as variants |
| `EditProperty.dc.html` | Edit property side sheet for Select, Number, Date, Person |
| `CellEditors.dc.html` | Text, Number, Date, Person, URL, Files, Checkbox/Email/Phone, Relation, Formula |
| `FilterSort.dc.html` | Toolbar, filter chips, filter by, rule editor, date operators, sort, advanced filter, empty state |
| `Properties.dc.html` | Properties visibility and order, column presets, group by, layout settings |

Each `.dc.html` has its markup inside `<x-dc>` and its data in the `renderVals()` script at the bottom. Lists (menu rows, options, tones) live in that script.

## Tokens

Use the existing CSS variables from `lib/studio/vals.js` (TK object). Do not add hex values to components.

| Use | Variable |
|---|---|
| Popover | `--surface`, 1px `--line-4`, radius 16, padding 8, shadow `0 16px 48px rgba(0,0,0,0.18)` |
| Menu row | 34 to 36px tall, radius 10, 16px stroke icon, 14px / 500 |
| Row hover / selected | `--hover` |
| Focus ring, open cell | 2px `--ink` |
| Section label | 12px / 600 `--muted-2` |
| Field | 40px, radius 12, `--panel` bg, 1px `--border`, focused 2px `--ink` |
| Primary button | `--inv` bg, `--inv-ink` text, radius 12, 40 to 44px |
| Danger text | `--red-ink` style, comp uses #C42B2F |
| Option colors | existing `TONE` map: soft pill = `[0]` bg + `[1]` ink, solid block = `[3]` |
| Titles | `--font-title` (Montserrat 900) |

Option color names must stay the `color_token` values: gray, coral, pink, violet, blue, green, amber, red. Dark mode reuses `DARKFILL` and the dark TK set.

## Mapping to current code

| Component | Current location |
|---|---|
| Column type list and icons | `CTYPES` in `lib/studio/vals.js` |
| Add a column modal | `V.colTypesBasic` / `V.colTypesAdv` render in `components/studio/StudioView.jsx` (around line 5518) |
| Create column | `addField` in `lib/studio/actions.js` |
| Cell popover | `o.popStyle`, `o.editing` in the cell builder in `vals.js` |
| Status options | `project_statuses` table (label, stage, sort, color_token) |
| Content type options | `content_types` table |
| Column presets | `PRESETS` in `vals.js` |
| Group by | `gb` keys in `vals.js`: stage, type, status, channel, editor |
| Role columns | `role_board_config` table |

## Data model changes needed

1. `custom_fields.options` (jsonb): store `[{ id, label, color_token, sort }]` for Select and Multi select.
2. `custom_fields` new jsonb column `config` for per-type settings: number format and decimals, date format, include end date, include time, due coloring, reminder, person limit, show as (pill or block), required, show on cards, default value.
3. `project_statuses`: add `notify_sponsor boolean default false` and `editors_can_set boolean default false`. Groups stay the three stages. Seed `notify_sponsor = true` for Sponsor Review, Scheduled, Live to match the current `external` flag in `vals.js`.
4. View state per user (filters, sorts, hidden columns, group by, row height): store per user per view, with a Super Admin action "Save for <role> view" that writes `role_board_config`.
5. Keep `visible_roles` and `editable_roles` as the access source. The "Visible to" chips write `visible_roles`.

## Build order

1. Shared primitives: Popover, MenuRow, MenuLabel, Divider, Field, Toggle, Segmented, Chip (pill, block), Swatch list.
2. Header cell states and header menu (rename, change type, sort, filter, group, hide, freeze, wrap, insert, duplicate, delete with confirm).
3. Select and Multi select picker with create, option menu, color, reorder.
4. Status picker and status options editor.
5. Edit property side sheet (shared shell, per-type middle block).
6. Remaining cell editors.
7. Filter chips, filter by, rule editor, sort, advanced filter.
8. Properties panel, presets, group by, layout.
9. Add a column step 2 and header quick add.

## Rules

- Real `<button>`, `<input>`, `<label>`. Icon-only buttons get `aria-label`. Switches use `role="switch"` and `aria-checked`.
- Keyboard: arrows move, Enter picks or creates, Backspace removes last chip, Tab next cell, Esc closes.
- Popovers flip to the right edge for the last 5 columns (current `colIdx >= cols.length - 5` rule).
- Schema actions (rename, change type, options, insert, duplicate, delete) are Super Admin only. View actions save to the viewer's own view. Sponsor gets no header menu.
- Sample names, people, fees and dates in the comps are placeholders.
- No em dashes in UI copy.
