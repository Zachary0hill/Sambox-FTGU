# 5. Plain-language workflow authoring

Own the assistant entry point and editable graph generation. Resolve supported instructions to the shared catalog. Integrate keys buffer_draft, publishing_scheduled and slack_production_digest from handoffs 01 and 02. Preserve unrelated work in shared builder files. Test persistence, preview, manual setup and activation boundaries.

## Scope and acceptance

The daily digest uses a schedule such as `daily@09:00` with an IANA timezone. Its action stores the Slack channel ID in `message`. Buffer resolves channels from the approved project's brand mapping. Use these contracts in draft descriptions, show the setup still required, and reuse the builder's controls.

- Replace the assistant placeholder with a prompt that produces an **editable draft** in the existing visual builder. Translate the request into supported triggers, conditions, and actions. Display unresolved choices such as a missing Slack channel.
- Use the existing graph validator, test drawer, and activation controls. Opening, editing, or previewing a generated draft should have no external effects.
- **Acceptance:** “Create a Buffer draft when a project reaches Scheduled in Publishing” opens a reviewable workflow with the correct action and a channel mapping. It survives save and reload, previews its behavior, and runs only after activation. An unsupported instruction shows which step requires manual setup.
- **Start in:** `components/studio/FlowBuilder.jsx`, `components/studio/workflow/TestDrawer.jsx`, `lib/automations/graph.ts`, and `lib/automations/catalog.ts`.

## Delivery

Read AGENTS.md and the relevant installed Next.js guide before editing code. Work in this shared checkout. Run focused local checks with Node 22. Append your implementation, verification results, limitations and open owner decisions to COMPLETION.md under your numbered heading. Leave deployment, external messages, provider writes, real payment changes and historical cleanup outside this build.
