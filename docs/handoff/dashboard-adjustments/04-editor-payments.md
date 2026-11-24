# 4. Editor payments by month

Own monthly reconciliation, effective contract terms, editor access, payout/invoice linkage and Finance/Workload navigation. Use migration prefix 202611240004. Keep unresolved billing policy visible, avoid silently assigning historical approvals or applying unconfirmed rates, and never initiate a payment.

## Scope and acceptance

- Extend the existing editor-rate task. Use the report discussed on November 17 as the entry point between Finance and Workload. Keep per-editor contract terms accessible from the editor record.
- Record the billable project, credited editor, approval timestamp, and rate terms effective for that work. Group by approval month in the studio timezone. Decide with John how to handle reapproval, an editor change, or a correction after month close.
- Show the approved video list alongside included units, overage units, retainer, overage amount, and total owed. Flag missing rates or allowances for review. Link the resulting reconciliation to the existing payout and external Payoneer invoice.
- **Acceptance:** John can select Himanshu and November, trace each counted short to its approval, and reconcile the total to the invoice. Test exactly at the allowance, one unit over, and a video revised and approved twice.
- **Start in:** existing Finance contractor payouts in `lib/studio/vals-admin.js`, payout editing in `lib/studio/vals-records.js`, `components/studio/Workload.jsx`, and the existing `payouts` table.

## Delivery

Read AGENTS.md and the relevant installed Next.js guide before editing code. Work in this shared checkout. Run focused local checks with Node 22. Append your implementation, verification results, limitations and open owner decisions to COMPLETION.md under your numbered heading. Leave deployment, external messages, provider writes, real payment changes and historical cleanup outside this build.
