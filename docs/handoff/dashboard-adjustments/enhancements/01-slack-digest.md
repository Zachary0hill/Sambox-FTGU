# Daily Slack digest enhancements

## 1. Preview a workday

Pick a reporting date on the configured schedule in studio time. Show the exact outgoing message and expandable project lists for each group at that cutoff, using the delivery logic and history. Opening preview must never send. Explain missing historical coverage.

## 2. Choose a channel by name

Search channels the bot has joined and persist the Slack channel ID. Show the selected destination and next delivery in local time. Preserve saved IDs and handle inaccessible channels, no connection and pagination.

## 3. Age the queues

Show when each item entered its current review/revision queue. Sort oldest first in Slack and the preview. Reassignment must not reset the age. Do not invent a date for pre-tracking history.

## Delivery and verification

Implement through the dashboard’s normal entry points on the shared branch. Read AGENTS.md and the relevant installed Next.js guides first. Scope shared-file edits to this feature. Use new migration prefix 202611250001 and Node 22. Test with disposable data, including role boundaries, retries and existing records where relevant. Update your numbered enhancement heading in [the shared completion log](../COMPLETION.md) with results for all three items, exact checks and any limits. Leave live workspaces and external accounts untouched.
