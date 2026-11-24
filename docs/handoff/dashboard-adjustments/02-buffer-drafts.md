# 2. Buffer drafts for Gerald

Own draft handoff, client channel configuration, workflow trigger, project result and provider handling. Use action buffer_draft and dedicated trigger publishing_scheduled. Use migration prefix 202611240002. Preserve existing Buffer publishing and isolate draft idempotency. Keep edits to shared catalog and runner narrowly scoped.

## Scope and acceptance

- Add a distinct **Create Buffer draft** action. Trigger it when a project enters the Publishing stage with the Scheduled status. Check the project’s approved final asset and configured brand-to-channel mapping. A missing asset or mapping should identify what the operator must fix.
- Use the existing Buffer connector and media handling. Call `createPost` with `saveToDraft: true`, verify the returned draft status, and store the Buffer post ID per project and channel. The current media picker can fall back to a draft cut, so the handoff needs an explicit final-asset check. [Buffer’s draft example](https://developers.buffer.com/examples/create-draft-post.html)
- Keep the result visible on the project. Gerald owns caption review and scheduling in Buffer. A retry or status toggle should reuse an existing handoff. If a channel fails, retry only that channel.
- **Acceptance:** One approved video moved into Scheduled produces one editable item in the intended Buffer Drafts tab. The publishing queue stays unchanged until Gerald schedules it. A second client’s channel receives nothing.
- **Start in:** `lib/integrations/buffer-publish.ts`, `lib/integrations/providers/buffer-post.ts`, `lib/automations/catalog.ts`, `lib/automations/run.ts`, and `buffer_publications`.

## Delivery

Read AGENTS.md and the relevant installed Next.js guide before editing code. Work in this shared checkout. Run focused local checks with Node 22. Append your implementation, verification results, limitations and open owner decisions to COMPLETION.md under your numbered heading. Leave deployment, external messages, provider writes, real payment changes and historical cleanup outside this build.
