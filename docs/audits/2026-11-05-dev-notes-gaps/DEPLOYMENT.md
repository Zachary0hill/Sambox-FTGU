# Deployment and live verification — 2026-11-05

Production: https://santosstudios.online

- GitHub main: `6be1de63f0cfb2889a79058895d4ce502953f048`
- Railway deployment: `394b1d0c-c934-4981-8af1-c302a63047be`, status SUCCESS; ready at 23:25:56 UTC.
- Exact released source tree: `982fb30eac1004f1b4e8805e931f631b7d4b5953`.
- Release isolated in `/tmp/sambox-dev-notes-release` to exclude unrelated onboarding edits in the shared checkout. Git push encountered server `commit_refs_rules` errors; the identical tree and commit were published through GitHub APIs, then main was advanced without force or changing branch protections.
- The original shared checkout remains unchanged apart from task implementation and this verification documentation. Do not deploy its unrelated edits wholesale.

## Applied migrations

Supabase project `mupwdvcpymlrnrsnmqfo`:

| Source migration | Recorded production version |
| --- | --- |
| 20261106000100_manager_role.sql | 20261105232211 |
| 20261106000200_manager_permissions.sql | 20261105232217 |
| 20261106000300_idea_production_package.sql | 20261105232220 |
| 20261106000400_grok_integration.sql | 20261105232224 |

No onboarding migration 005 was applied.

## Validation

The isolated release passed all 31 Node tests and the production build. Earlier focused lint and PostgreSQL permission/transaction/concurrency checks also passed; see README.

[Live test results](live-verification.json) record 11 successful checks against the deployed application and production Supabase. Tests used disposable Manager and Editor users in an isolated temporary workspace, real authenticated sessions, deployed HTTP approval handlers, database RLS and storage. They covered:

- Manager login, transactional account/channel/brand create and rename, and denied portal enablement.
- Anonymous and Editor approval denial.
- Concurrent approvals creating one project with the selected brand, complete script, title options, thumbnail brief and snapshot.
- Missing-cover warning followed by successful retry, identical image bytes and no duplicate project/file.
- Manager project edits, denied administration/credentials access, tenant isolation and immediate permission revocation.
- Grok seeded as disconnected.

All disposable users, workspace records and storage objects were removed. A follow-up production query found zero matching test workspaces.

Authenticated live browser checks confirmed:

- Projects load; Manager appears in the configurable permissions matrix.
- New ideas require explicit brand selection in a multi-brand workspace.
- Pasted JSON previews full content, title options and thumbnail direction while ignoring imported brand/status. Attempting Save without a brand produces the expected validation message; the unsaved test was cancelled.
- Existing ideas expose the Brand / client selector and planning fields. The Municipal idea was opened and closed without saving.
- Approved backlog exposes Create project. No real backlog item was promoted.
- The N shortcut opens Dev Notes, not New idea.
- Grok integration exposes the API key/model setup and remains disconnected.

Browser console: no captured errors. Railway verification window returned 56 HTTP entries with no 5xx responses. Runtime logs showed normal startup only; the shell command `$ next start` is labelled stderr/error by Railway but was followed by successful readiness, not an application failure.

## Remaining external acceptance

- Live Grok generation requires an xAI API key and accessible model; no paid Grok request was made.
- Municipal idea `56abca60-4f33-477a-9eaa-64dc8fc549de` remains unchanged pending confirmation of its intended brand.
- Real recipient email delivery and password-reset-then-login were not exercised. Previously deployed auth fixes were not changed in this release.
- No existing person was assigned Manager, and no Dev Notes item was marked complete.
