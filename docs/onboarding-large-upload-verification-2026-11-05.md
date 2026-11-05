# Large uploads and reviewer UI verification — 2026-11-05

## Failures found

- A valid 215 MiB, two-minute 1080p MP4 was rejected by production Storage: HTTP 400 with `EntityTooLarge` / statusCode 413. Project storage inherited the global 50 MB limit.
- Upload status was a transient toast and disappeared while transfer continued; no progress, retry, or duplicate-transfer guard was available.
- Reviewer action bar had approval buttons but no direct edit/thumbnail revision buttons; revisions required the status dropdown.
- Welcome assignment counts included archived projects.
- A prolonged outage let a background refresh replace the board with an error gate, hiding upload recovery. Cached board content and upload recovery now remain visible, with a refresh warning; reconnect reloads automatically.
- The drawer truncated actions to two buttons, hiding revisions. All available actions now wrap on narrow screens.

## Changes

- `project-assets` now has an explicit 1 GiB cap. The global setting is 1074 MB to accommodate that cap. Previously inherited `brand-assets` and `buffer-media` buckets are explicitly capped at 50,000,000 bytes; existing 10 MiB cover/screenshot limits remain unchanged. No plan upgrade was needed.
- Transfers use authenticated TUS uploads with 6 MiB chunks and the direct Storage hostname, following [Supabase's resumable upload guidance](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).
- Persistent upload progress, automatic network retries, manual retry after exhaustion, and same-project/section duplicate protection. Retry retains the transport offset in the current tab.
- Asset metadata is saved only after transfer completion; retrying metadata uses the same asset ID and does not resend bytes. Draft-version update failures are checked.
- An unload warning protects active uploads. The UI explicitly asks users to keep the tab open. Full page reload/close does not preserve the selected File; reselecting starts a new transfer. Partial TUS sessions expire on the provider's normal schedule.
- Dedicated Request edit revision / Request thumbnail revision actions; archived work excluded from welcome counts.

## Fixtures

Isolated QA workspace `7a142d7c-f0c1-46cf-8a41-118a4f1ca705`, project `25a105b3-76a3-4d6a-8810-c470946a685d` (`QA-LARGE-1105`). Disposable editor, designer, and reviewer simulator accounts only; no real team alerts or password changes.

Files: valid 1920×1080 H.264 MP4 (120 seconds, about 215 MiB), and valid 3000×2000 PNG (18,007,538 bytes). Synthetic content has realistic transfer sizes but is not a real client deliverable.

## Validation

24 Node tests pass; production build/types and focused lint pass. Live deployments `4778a3f`, `ffc90d7`, and `a372524` succeeded. Final application deployment: Railway `77d44cd5-a711-441f-802c-4768ecd759f6`. Focused lint has only existing image warnings in ProjectModal.

## Editor interruption result

The live browser uploaded the 225,289,896-byte MP4 in 6 MiB chunks. Network was disconnected after 31,457,280 bytes. Automatic retries exhausted, then the visible Retry upload action resumed with HTTP 200 reporting that same offset and subsequent HTTP 204 chunk acknowledgements through 225,289,896. Exactly one asset row was created, only after completion. A downloaded copy matched the original SHA-256: `166f55a507226a0fbc2b0b26120975a02cd4b0f157680450593784afb2277cbe`. The editor clicked Submit for review and the status changed to In Review.

## Designer interruption and reviewer results

- A valid 18,007,538-byte PNG uploaded through the designer file picker over a throttled connection. The connection was cut mid-transfer; the board stayed available and the persistent Retry button appeared after automatic retries exhausted. Manual retry resumed and completed. No thumbnail asset existed during the incomplete transfer; exactly one existed after completion.
- Downloaded PNG SHA-256 matched the original: `86fcf49245b8f405fde7787f0bbcb3b8b8d000480e4219c4684296e6ce46e253`.
- Reviewer posted feedback, clicked Request edit revision and Request thumbnail revision. Both member screens received Needs Revision. Editor clicked Submit revision; designer clicked Submit thumbnail again. Reviewer clicked Approve edit and Approve thumbnail. Database states were `approved` and `done`; both persisted after browser reload and at 390×844.
- This increment tests revision/resubmission buttons using the same large artifacts. Replacement-file revision cycles were separately verified in the preceding workflow report.
- All four review actions were visible together after removing the two-action truncation. Toolbar actions now wrap.
- A separate blocked-REST background-refresh test confirmed the fixed warning (“Could not refresh. Showing the last loaded board.”) alongside cached project content. Removing the block and clicking Try again cleared the warning without a page reload.
- Ten assignment/review/revision/approval outbox rows reached `sent`; a follow-up dispatch returned HTTP 200 with zero failures or remaining sends. These simulator results are send evidence, not real-inbox placement evidence.

## Scope and remaining acceptance

The application accepts project files up to 1 GiB; this run exercised 215 MiB video and 17 MiB image files, not a full 1 GiB boundary transfer. Interrupted transfers resume while the same tab remains open. Closing/reloading the page requires reselecting the file and starts a fresh upload. Physical iOS/Android file pickers and recipient-controlled password recovery/Inbox placement remain unverified here.

Screenshots are in `/Users/Mac/.codex/visualizations/2026/11/05/01a1acf4-b500-73a0-809d-7058110477ac/`: `large-upload-resumed.png`, `designer-offline-recovery.png`, `board-refresh-recovery-fixed.png`, `reviewer-all-actions.png`, and `reviewer-approved-mobile.png`.

## Cleanup

The test project was archived, both synthetic storage objects removed, original QA administrator restored, temporary editor/designer/reviewer memberships removed, and all three simulator sessions globally revoked. Private one-time links were deleted. Original real editor, designer, and client memberships were preserved. Local large synthetic fixtures were deleted after recording size and SHA-256 evidence.
