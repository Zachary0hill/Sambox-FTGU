# 1. Daily Slack production digest

Own the digest action, scheduling behavior, delivery history and setup. Use the action key slack_production_digest. Use migration prefix 202611240001. Coordinate shared catalog and runner edits by changing only digest-related lines. Make the channel, timezone and delivery time operator-configurable. Define the reporting window clearly and protect retries, including uncertain deliveries.

## Scope and acceptance

- Reconnect Slack in SantosStudios and select the target update channel. Reuse the studio scheduler and Slack provider. The current action addresses a Super Admin. The digest needs the team’s chosen channel.
- Agree on what **completed** means. Proposed rule: count distinct videos whose edit reached Approved during the reporting period. For **ready for review** and **needs revision**, show the current editor status at the cutoff. For each entry, include the title, editor, and project link.
- Compute the reporting window in the studio’s timezone. Key each delivery by workspace, channel, and reporting date. Record the result and show connection or delivery failures in run history.
- **Acceptance:** For a sample day, reconcile all three groups against the board. An edit moving from review to revision appears in its current queue. A retry after a successful send produces one Slack message total.
- **Start in:** `lib/automations/catalog.ts`, `lib/automations/schedule.ts`, `lib/automations/run.ts`, and `lib/integrations/providers/slack.ts`.

## Delivery

Read AGENTS.md and the relevant installed Next.js guide before editing code. Work in this shared checkout. Run focused local checks with Node 22. Append your implementation, verification results, limitations and open owner decisions to COMPLETION.md under your numbered heading. Leave deployment, external messages, provider writes, real payment changes and historical cleanup outside this build.
