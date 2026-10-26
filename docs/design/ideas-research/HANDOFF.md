# Ideas & Research refactor: build spec

Source designs (open in a browser to read the markup and the `renderVals()` logic):

- `Main.dc.html`: page shell, smart views, toolbar, Gallery / Board / List, board drag and drop
- `NewIdea.dc.html`: New idea modal (Quick capture / Full brief, banner dropzone, ICE, live preview)
- `IdeaDetail.dc.html`: Idea detail modal (status stepper, tabs, discussion, properties panel)
- `IdeaEdit.dc.html`: Edit view (banner editor, all fields editable, unsaved-changes footer)

These are design references, not drop-in code. Port them into the existing pattern:
style strings and handlers in `lib/studio/vals-ideas.js`, markup in `components/studio/StudioView.jsx`,
writes in `lib/studio/actions.js`. Keep the current tokens (`--ink`, `--surface`, `--border`, `--font-title`, TONE palette).

## Data model changes

New migration `supabase/migrations/<timestamp>_idea_brief.sql` on `public.ideas`:

| Column | Type | Default |
|---|---|---|
| format | text check in ('long_form','short','reel','livestream','podcast_clip') | null |
| pillar | text | null |
| audience | text | null |
| promise | text | null |
| platforms | text[] | '{}' |
| impact, confidence, ease | smallint check 1 to 10 | null |
| priority | smallint check 1 to 3 | 3 |
| effort | text check in ('s','m','l') | null |
| owner_id | uuid references profiles(id) on delete set null | author_id |
| target_window | date (first day of month) | null |
| sponsor_id | uuid references the existing sponsor table | null |
| source | text check in ('manual','research') | 'manual' |
| research_run_id | uuid references research_runs(id) on delete set null | null |
| project_id | uuid references projects(id) on delete set null | null |
| cover_mode | text check in ('hook','image','both') | 'hook' |
| cover_path | text (storage path) | null |
| cover_focal_x, cover_focal_y | smallint 0 to 100 | 50 |
| cover_highlight | text | '#FFE14D' |
| hook_position | text check in ('bottom','center','top') | 'bottom' |

Add `'in_production'` to `idea_status` if promotion should show as a stage.
ICE score is computed client side: `(impact + confidence + ease) / 3`, one decimal.
RLS: existing ideas policies cover the new columns. Research runs should set `source = 'research'` and `research_run_id`.

## Cover images

- Storage: reuse the `project-assets` bucket under `ideas/<idea_id>/cover.<ext>`, or a new `idea-covers` bucket with the same RLS shape.
- Upload on drop, on file pick or from brand files. Show the local object URL right away, swap to a signed URL after upload.
- Render: `background: url(...) <fx>% <fy>% / cover`. Click on the banner in edit sets the focal point.
- Accept image/* only, max 10 MB, 16:9 recommended.

## Main page

- Smart views (replace the status chips): All active, My ideas, Needs review, Ready to produce, Top scored (ICE 7.5+), Stale 14d+ (updated_at), From research, Archived. Counts respect search.
- Save view: persist `{ name, view, filters, sort, layout }` per user (new `saved_views` table or a profile jsonb column).
- Filters: Brand, Type, Format, Pillar. Sort: Top score, Recently updated, Priority.
- Layout switch Gallery / Board / List, remembered per user.
- Board: columns Draft, In Review, Approved plus an archive drop strip. HTML5 drag and drop, optimistic `updateIdea` with history text, toast with Undo. Arrow button on each card moves one stage (keyboard path).
- Research run strip: shows the latest `research_runs` row in `queued` or `running` via the existing realtime subscription.
- `N` opens New idea (ignore when focus is in an input).

## New idea modal

- Quick capture: title, banner hook (24 chars), brand, type, content.
- Full brief adds: audience, pillar, promise, format, platforms, ICE sliders, priority, effort, owner, target window, sponsor fit, tags, reference links, attach research run.
- Banner: style switch plus dropzone. Live preview card on the right, brief strength checklist.
- Create another after this one keeps the modal open. Cmd/Ctrl Enter submits.
- Extend `createIdea` to take the new fields.

## Idea detail

- Banner with Change cover (opens edit).
- Status stepper Draft, In Review, Approved, In production. Primary button by stage: Send for review, Approve plus Request changes, Promote to project (creates a project and sets `project_id`).
- Tabs: Overview (audience, promise, body, tags), Script (beats parsed from body), References (refs as link cards), History.
- Discussion uses the existing comments.
- Properties panel: ICE breakdown, owner, priority, effort, platforms, window, sponsor, source, project, Ready to produce checklist.
- Role rules stay as `canEditI` in vals-ideas.js. Editors see no Approve.

## Edit view

- Banner toolbar: replace image, style, highlight color, hook position. Drop on the banner replaces the cover, click sets the focal point.
- All brief fields editable. Tag chips with Enter to add.
- Footer: unsaved changes state, Discard, Save changes, Cmd/Ctrl S.
- Warn before closing with unsaved changes.

## Acceptance

- `pnpm build` and lint pass.
- Existing ideas without the new fields render with defaults.
- Works at 390 px wide: sidebar stacks, toolbar wraps, list view scrolls horizontally.
- All controls are real buttons, inputs and links with labels. Focus rings visible.
