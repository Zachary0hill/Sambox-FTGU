# Workflow authoring enhancements

## 1. Clarify ambiguous instructions

Offer actual studio choices for ambiguous prompts such as “Notify the team when a video is ready,” show which trigger or action each choice resolves, and update the editable graph immediately. Unsupported/remaining choices still block activation.

## 2. Preview matching and nonmatching projects

Test two operator-selected sample projects side by side, explain why each matches or skips, including trigger, filters and brand routing. Use the real preview rules, never dispatch and never count an expected skip as an execution failure. Keep live activation requirements meaningful.

## 3. Review a revision against the live workflow

Persist the origin of drafts created from a live workflow. Before activation show trigger, timing, recipients and action changes, highlighting a draft-to-public-publish change. Preserve the live workflow until explicitly activated; avoid accidental duplicate live runs when replacing it and handle stale originals.

## Delivery and verification

Implement through the dashboard’s normal entry points on the shared branch. Read AGENTS.md and the relevant installed Next.js guides first. Scope shared-file edits to this feature. Use new migration prefix 202611250005 and Node 22. Test with disposable data, including role boundaries, retries and existing records where relevant. Update your numbered enhancement heading in [the shared completion log](../COMPLETION.md) with results for all three items, exact checks and any limits. Leave live workspaces and external accounts untouched.
