# Dev Notes workflow fixes — local verification

Implemented on `codex/dev-notes-workflow-gaps`, based on `cc86d92f9694f5a4e5622505d332f7228cdd07fa`. This work has not been applied to production or deployed. No production ideas, accounts, roles, or Dev Notes completion statuses were changed.

## Delivered

- Manager role with its own navigation and configurable production permissions. Super Admin remains the only administrative role. Database permission checks deny Manager access to users, settings, automations and finance even if an erroneous grant is saved. Managers can manage project fields, assignments, dates, edits, thumbnails, ideas and clients according to their grants.
- Manager Clients & Sponsors view: create accounts, edit contact details, and assign projects. Account/channel/brand creation and renaming use a single database transaction. These operations do not invite users or enable portal access.
- Explicit idea brand selection when multiple brands are available, plus brand editing. AI proposals reject ambiguous brand matches instead of taking the first match.
- Title alternatives and thumbnail direction in idea creation, editing, duplicate and AI proposals. Plain text or one JSON brief can be pasted from Claude/Grok, previewed and edited before Save. Imported brand/status values never select a client or approve work. Long scripts are preserved; oversized bounded fields fail visibly instead of silently truncating.
- Approval creates and links one production project with the original working title, correct brand channel/sponsor, complete brief, alternatives, references, thumbnail direction, and an approval snapshot. Row locking makes concurrent/repeated approvals return the same project. Existing approved ideas offer Create project.
- The approved cover is copied to project Files as a thumbnail concept. Project/brief creation is atomic; storage transfer is retryable. A copy failure leaves a clear warning and a retry action without creating a second project. Linked source covers are retained for retries.
- Grok integration setup using an xAI API key, language-model discovery, and the OpenAI-compatible chat adapter. Connected Grok models participate in the assistant/research provider selection and fallback chain. Pasting a brief does not require an API key.

## Validation

- Node 22: `node --test tests/*.test.cjs` — 31 tests passed, including seven new workflow tests.
- `pnpm build` — production build and TypeScript passed after final UI changes.
- Focused ESLint on all changed implementation files passed; final follow-up lint on subsequently changed files passed.
- PostgreSQL 17 disposable local database: `tests/planning-db-bootstrap.sql` then `tests/planning-db.sql` passed. Checks cover role isolation, revocable permissions, forbidden tenant references, account creation/rename, no partial account on conflict, correct approval channel/brief/snapshot and repeat approval.
- Two separate concurrent PostgreSQL sessions approved the same new idea and returned the same project ID.
- Browser inspection of actual React-rendered fixtures verified planning fields, Manager client navigation and the permissions matrix. This caught and fixed a duplicate Inbox section on the Clients view. This was fixture verification, not an authenticated live end-to-end test.
- SQL harness includes the owning base schema/RLS/triggers and relevant idea schema, plus minimal Supabase auth/storage scaffolding. It is not a complete local Supabase stack or a replay of every historical migration.

## Rollout and remaining user input

Apply these four migrations in order before deploying the application. The enum migration must commit before the policies that use the enum values:

1. `20261106000100_manager_role.sql`
2. `20261106000200_manager_permissions.sql`
3. `20261106000300_idea_production_package.sql`
4. `20261106000400_grok_integration.sql`

Then smoke-test an actual Manager session, one approved idea with a cover, and client account editing. No existing member is automatically made a Manager. No approved backlog is automatically promoted.

- Grok still needs an xAI API key and accessible model selected in Integrations; no paid/live Grok request was made. API reference: https://docs.x.ai/developers/rest-api-reference/inference/models
- The Municipal idea (`56abca60-4f33-477a-9eaa-64dc8fc549de`) was left unchanged pending confirmation of its intended brand.
- Recipient-side password reset followed by login remains a live acceptance check from the initial review. The already-deployed auth fixes were not altered by this task.
- Separate onboarding work appeared in the shared checkout during implementation, including migration `20261106000500_onboarding_all_roles.sql`; it was preserved and is outside this task's four-migration verification scope. Review the shared checkout before staging or deploying it wholesale.
