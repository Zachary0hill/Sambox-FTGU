# Santos Studios completion release

November 10–11, 2026. Implements the functional fixes in `SANTOS_STUDIOS_AUDIT_2026-11-10.md` and preserves the existing ideas/research work plus main's activity-tracking release.

## Preservation

Implementation used the isolated `codex/santos-audit-completion` worktree. Commit `4b9db86` checkpoints the 47 pre-existing changed/untracked files; `49834a4` merges main `124302b`. The original checkout was not reset or overwritten. Original patch/archive and production function/assignment/layout snapshots are in `/Users/Mac/.codex/artifacts/santos-audit-completion/`.

Production reconciliation copied 12 unambiguous, active editor mappings into canonical assignment rows. Source custom fields/values remain as Legacy metadata; manual canonical values and custom statuses are never inferred or overwritten. Project count, custom-value count and email-outbox count remained unchanged across reconciliation (21 / 37 / 38, including the isolated QA project). No migration-generated assignment emails were queued.

## Delivered

- Canonical assignment reconciliation, reserved workflow labels and visible real workflow columns.
- Enrolled MFA enforced in API membership, restrictive table/storage policies and exposed definer RPCs. Existing tenant/role policies retained.
- Transactional comment/attachment finalization with retry identity; database-first deletion with durable checked storage cleanup; atomic brand/channel updates.
- Per-project comment/brief drafts, failed-upload Cancel, save failure retention, dirty script close protection, mobile menu/header, modal keyboard isolation and focus restoration.
- Durable automation effect claims; completed effects survive lost checkpoints; uncertain external effects stop for review; paused runs remain pending. Bounded digest retries and manager inclusion.
- Complete ideas/rules/research release, evidence-aware readiness, permission-aware conversions and true unscheduled content drafts with direct links.
- Serialized estimated research reservations including unresolved exposure, model pricing admission and bounded output, independent fallback admission, cancellation/attempt checks and atomic deduplicated draft commit.
- Paged large workspace collections and scoped project history; corrected invoice aging and content dates; clearer lifetime and project-video metrics; honest connector capability labels.
- Operations health endpoint/panel and worker timestamps; unknown API routes return JSON 404. Updated in-app release notes.

## Validation

- `node --test tests/*.test.cjs`: 129 passing, zero failures.
- Full ESLint and production Next build pass (only Babel large-source formatting notice).
- Disposable PostgreSQL 17.11 acceptance uses every application migration, with Auth/Storage/Vault/cron test scaffolding and no real scheduler/network execution. `tests/completion-db.sql` validates rollback, original preservation, comment idempotency/notifications, MFA AAL1/AAL2, manager permissions, content drafts, source gate, digest claim/retry, paused jobs, budget caps and stale/deduplicated research commits.
- Two actual concurrent budget transactions: exactly one 0.60 reservation admitted under a 1.00 daily cap; the other rejected.
- Built-app QA in a separate workspace/account: fresh password sign-in, comment draft retained after close and reload, one successful comment and activity, keyboard focus containment/restoration and status dropdown search/escape.
- Long job identifier Close right-edge measurements: 306/320, 361/375, 376/390, 754/768 pixels. Viewport restored after testing.
- Live disposable-account MFA test: enrolled AAL1 project reads returned no rows, RPC returned 403, protected API returned 403; AAL2 API returned 200. Disposable factor removed afterward.
- Production policy catalog: zero unguarded exposed definer RPCs; zero protected tables missing the restrictive MFA policy.

To reproduce database tests, create a **new disposable database** and run:

```sh
python3 tests/completion-bootstrap.py > /tmp/santos-completion-db.sql
psql -h /tmp -d YOUR_NEW_DISPOSABLE_DB -v ON_ERROR_STOP=1 -f /tmp/santos-completion-db.sql
psql -h /tmp -d YOUR_NEW_DISPOSABLE_DB -v ON_ERROR_STOP=1 -f tests/completion-db.sql
```

Do not run the bootstrap against an existing or production database.

## Boundaries

No real recipient email/reset, paid provider generation, social publication, customer approval, payment collection or payout was used as a test. Provider-facing operations are covered with controlled mocks and transactional acceptance; actual provider credentials/delivery remain operational setup. Unknown external automation outcomes deliberately require review instead of automatic replay. Niche research retains findings/drafted output for recovery, but a terminated in-flight provider call cannot be resumed or guaranteed unbilled.

Existing QA records were preserved. Configurable per-person capacity, native inbox replies, timecoded review, payment processing and a reviewed legacy-data cleanup are optional expansion work, not shipped features. Large collections are fully paged for correctness; server aggregation/virtualized loading remains a future scale optimization.

Deployment and final live verification are recorded below when complete.
