# Live onboarding workflow verification — 2026-11-05

Production: https://santosstudios.online, deployed commit `d6895d1861cc97fcac683b6326e7c18dd942d8ac`.

## Scope and isolation

Tests used authenticated Supabase clients for the authorized editor and designer pilot accounts against production storage and database policies. The service client created only isolated fixtures; role-session clients performed uploads, status changes, downloads, and comments. Temporary test sessions were signed out locally without changing passwords or invalidating other sessions.

A separate workspace (`7a142d7c-f0c1-46cf-8a41-118a4f1ca705`) and project (`511db38c-2c96-4b5e-ab51-35b67e30d032`, job `QA-ONBOARD-1105`) prevented notifications to production admins. The third authorized pilot account was reviewer in that workspace only; its original client role remained unchanged.

## Results

| Check | Editor | Designer |
| --- | --- | --- |
| Actual storage upload and identical download | MP4, 2,302 bytes | PNG, 628 bytes |
| Submit for review | Passed | Passed |
| Reviewer requests revision | Passed | Passed |
| Replacement upload and resubmission | Draft v2 retained alongside v1 | Second concept retained; current design uses version 1 for thumbnails |
| Reviewer approval | Approved | Done |
| Read revision comments and reply | Passed | Passed |
| Reviewer signed preview URLs | Both drafts returned HTTP 200 | Both designs returned HTTP 200 |
| Unauthorized deadline edit | Denied | Denied |

Anonymous download was denied. The tiny synthetic files validate storage and access, not large-upload resilience or video playback performance. Revision-note read/reply checks were performed after the status-cycle checks; this was not a timed browser interaction recording.

The deployed `POST /api/notifications/send` returned HTTP 200 with `sent: 10`, `failed: 0`, `skipped: 0`, `held: 0`. Only this fixture had queued mail before dispatch. All 10 outbox rows became sent.

Resend's delivery dashboard showed all 10 as Delivered:

- Editor: assignment, revision, approval — all three also confirmed in Gmail Inbox.
- Designer: assignment, revision, approval — provider delivery confirmed; Inbox/Spam placement remains unverified because this inbox is not connected.
- Reviewer: two edit-review and two thumbnail-review messages — all four confirmed in Gmail Inbox. Edit messages identify v1 and v2.

Provider acceptance, delivery, and inbox placement are distinct evidence. Notification outbox rows currently do not retain Resend message IDs; provider delivery was verified directly in Resend. Rapidly queued notifications arrived out of workflow order, so recipients should use current project state as authoritative.

## Cleanup

The test project was archived, all four uploaded test objects were removed, and temporary pilot workspace memberships were removed. Archived evidence remains in the isolated workspace under the existing QA admin only. Main-workspace roles, assignments, and projects were preserved.

Local private evidence is under `qa-report/onboarding-release-2026-11-05/`: `workflow-results.json`, `workflow-access-results.json`, and `workflow-outbox.json`. No auth tokens or passwords are included in those evidence files. Delivery screenshot: `/Users/Mac/.codex/visualizations/2026/11/05/01a1acf4-b500-73a0-809d-7058110477ac/workflow-emails-delivered.png`.

## Open at the end of the initial API run

- Exercise browser file-picker, preview, submission/revision controls, and email-to-project navigation for both roles. These tests used live authenticated APIs, not those controls. The isolated workspace is secondary to the pilots' primary workspace, so its email links were not used as navigation acceptance evidence.
- Designer confirms notification Inbox/Spam placement.
- Recipient completes password reset and subsequent login.
- Mobile/cross-device and representative large-file upload checks.

No application code changed in the initial API run. The subsequent browser follow-up below includes deployed fixes.


## Browser follow-up and fixes — 2026-11-05

Deployed application commit `6af1bae0f5d04978c007be76bd3c371132864fca`; Railway deployment `e623b734-be32-4345-980b-22808b880937` succeeded. Notification-order migration was applied separately before the application release.

Disposable existing simulator accounts were temporarily added as editor/designer to the isolated workspace. Their production-workspace memberships remained deactivated. The authorized reviewer account had access only to synthetic QA data in this additional workspace; its real client membership was preserved. No real user's password was changed. The test project was `QA-BROWSER-1105` (`b651c508-e5e9-41c2-aa74-512d091a814f`).

### Verified in the production browser

For **both editor and designer**:

- Mobile (390×844) welcome identifies the correct role and one assignment; Open my queue works.
- Start editing/design, open Files, upload actual MP4/PNG through the file chooser, submit for review.
- Preview opens a signed file URL: PNG rendered orange and MP4 rendered/played its one-second blue test clip.
- Reviewer revision requests and notes were applied using an authenticated reviewer API client; member browser displayed Needs Revision and the comments.
- Reply to revision notes, upload a second file on desktop, and resubmit through the role-specific button. Editor v1 is marked Superseded and v2 is In Review. Designer retains both concept files.
- Reload/deep-link navigation opens the correct project with comments and approved/done status. Final approvals were set through the API; this does not claim reviewer-button UI coverage.
- Table, Kanban, List, Timeline, and Calendar render on desktop and phone-width views. Mobile document width did not exceed viewport width.
- Account → Settings → Getting started reopens the correct guide. Completion and dismissal timestamps persisted for both memberships.

### Defects fixed during acceptance

1. Outbox UPDATE RETURNING did not preserve selection order. Claims now return creation/enqueue order, serialize claim transactions, and exclude recipients with an active batch. Retrying/held messages defer later messages for that recipient. Database finish errors halt the batch.
2. Compact navigation omitted Account Settings. Added a 44px Account control using the existing settings action.
3. Signed-out notification links dropped query parameters. Proxy now preserves project and tab in the login destination; a regression test covers this case.

Ordering regression: three same-timestamp fixture emails had queue orders 24, 25, 26, and were sent in that order at 21:22:52.834, 21:22:53.555, 21:22:54.340 UTC. Live dispatch returned sent=3, failed=0. This guarantees application submission order under the tested queue cases, not Gmail arrival/display order.

Validation: 19 Node tests, Next production build/types, focused lint (no errors; existing StudioView warnings), and rollback SQL for ordered ties, overlapping claims, batch boundaries, and stale recovery.

Screenshots are in the existing visualization directory: `editor-mobile-welcome.png`, `designer-mobile-welcome.png`, `editor-desktop-resubmitted.png`, `designer-desktop-resubmitted.png`, `designer-mobile-submitted.png`, `editor-mobile-account-fixed.png`, `designer-mobile-account-fixed.png`.

### Remaining external acceptance

- Physical iOS/Android device behavior and representative large uploads/network interruption recovery; this run used a desktop browser with a phone-width viewport and small synthetic files.
- The designer pilot recipient confirms Inbox versus Spam, and a real recipient completes password recovery and subsequent login. Password entry remains with the recipient.

Final production verification: a signed-out browser visiting `/projects?project=QA-BROWSER-1105&tab=comments` reached `/login?next=%2Fprojects%3Fproject%3DQA-BROWSER-1105%26tab%3Dcomments`. Existing-user password entry was not performed in this check.

Browser fixture cleanup: project archived, four storage objects removed, temporary memberships removed, and both simulator accounts' sessions globally revoked. Original pilot roles remain active editor/designer/client. Private one-time sign-in link file was removed; non-secret results remain in `qa-report/onboarding-release-2026-11-05/browser-live-results.json`. The isolated workspace retains only the existing QA admin and archived evidence. Viewport override was reset.
