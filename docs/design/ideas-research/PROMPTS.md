# Claude Code prompts

Setup:

1. Unzip into `Sambox-FTGU/docs/design/ideas-research/`
2. Commit or stash current work
3. `git checkout -b ideas-research-refactor`
4. `cd ~/dev/Sambox-FTGU && claude`

Run one phase per prompt. Review in the browser before the next.

## Phase 1: database and actions

```
Read docs/design/ideas-research/HANDOFF.md and supabase/migrations/20261020000100_schema.sql.
Write a new migration that adds the idea brief columns from the "Data model changes" table to public.ideas.
Extend createIdea and updateIdea in lib/studio/actions.js and the idea mapping in lib/studio/load.js to read and write the new fields.
Existing ideas must load with defaults. Do not change any UI yet. Show me the migration before applying it.
```

## Phase 2: main page

```
Read docs/design/ideas-research/HANDOFF.md and docs/design/ideas-research/Main.dc.html.
The .dc.html file is a design reference: its markup and renderVals() logic show the target UI.
Port it into the existing pattern: style strings and handlers in lib/studio/vals-ideas.js, markup in components/studio/StudioView.jsx.
Build: smart views with counts, Brand/Type/Format/Pillar filters, sort, the Gallery/Board/List switch, board drag and drop with optimistic updateIdea and an Undo toast, the archive drop strip, the research run strip on the existing realtime subscription.
Keep the current tokens and TONE palette. Keep the role rules in canEditI.
```

## Phase 3: new idea modal and cover upload

```
Read docs/design/ideas-research/HANDOFF.md and docs/design/ideas-research/NewIdea.dc.html.
Replace the current New idea modal with this design: Quick capture / Full brief switch, banner dropzone, ICE sliders, live preview card, brief strength checklist, Cmd/Ctrl Enter to submit.
Upload covers to the project-assets bucket under ideas/<idea_id>/ following the existing upload code in actions.js.
```

## Phase 4: detail and edit

```
Read docs/design/ideas-research/HANDOFF.md, IdeaDetail.dc.html and IdeaEdit.dc.html in the same folder.
Replace the idea detail modal and edit view with these designs: status stepper with stage-based actions, Promote to project, tabs, properties panel, banner editor with focal point and highlight color, tag chips, unsaved-changes footer with Cmd/Ctrl S.
Run pnpm build and lint when done.
```

## Rules

- Approve the migration before it runs against the FromTheGroundUp Supabase project.
- If a screen drifts from the design, tell Claude Code to compare against that screen's .dc.html file and fix it.
