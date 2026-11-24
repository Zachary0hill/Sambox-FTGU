# Editor reconciliation enhancements

## 1. Reuse last month’s terms

Prefill from the prior calendar month, show a side-by-side comparison and highlight edits. Require explicit confirmation for the target editor/month; test missing prior terms and a year boundary.

## 2. Decide billing exceptions

Offer Finance a queue for reapprovals, editor changes and missing terms. Record a reasoned decision with actor and date; show how the decision affects individual credited items and the total without duplicate credits.

## 3. Save month-end statements

Save immutable dated snapshots of line items, rates, totals, payout and invoice reference, with downloadable CSV. Later corrections should identify the affected job(s), delta, reason, and statement version. Use explicit operator approval for changes; do not invent a production billing policy.

## Delivery and verification

Implement through the dashboard’s normal entry points on the shared branch. Read AGENTS.md and the relevant installed Next.js guides first. Scope shared-file edits to this feature. Use new migration prefix 202611250004 and Node 22. Test with disposable data, including role boundaries, retries and existing records where relevant. Update your numbered enhancement heading in [the shared completion log](../COMPLETION.md) with results for all three items, exact checks and any limits. Leave live workspaces and external accounts untouched.
