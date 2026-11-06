# Idea document import — deployed and verified

Deployed November 6, 2026 to [Santos Studios](https://santosstudios.online/ideas).

- Commit: [`67cbb8a0355487911381fa10514c6f5190d7d721`](https://github.com/Zachary0hill/Sambox-FTGU/commit/67cbb8a0355487911381fa10514c6f5190d7d721), on `main`.
- Railway deployment: `5c2ee75b-aa4f-4bb1-8e3e-ae2a21186994`, SUCCESS at 04:08:46 America/Chicago.
- Released source tree: `4928321571aefc738d939bc2cf03fd524a9cb33e`.
- Release checkout: `/private/tmp/santos-idea-import-release`, branch `codex/idea-document-import`.
- Scope: the importer, three integration points, regression tests and usage documentation. Unrelated onboarding/auth and AI-usage work in the shared checkout was excluded and preserved. No database migration was required.

## Release validation

The isolated release passed 41 Node tests, focused ESLint, the actual component's headless Chrome flow, and the Next.js production build on Node 22. The larger shared checkout's earlier 44-test count also included three unrelated AI-usage tests; those files were not part of this release.

## Live verification

[Machine-readable results](live-verification.json) record nine successful checks between 04:08:57 and 04:09:11 America/Chicago. A disposable workspace and temporary Manager/Editor accounts were used with real production authentication, database writes, RLS and the deployed approval endpoint.

1. Manager login and Ideas & Research expose **Import ideas**.
2. Uploading Markdown splits two ideas, matches `Podhut` to `POD HUT`, and blocks saving until an unmatched client is resolved. Previewing writes no ideas. The dialog fits desktop and mobile widths.
3. Import persists two drafts with independent client assignments, full script content, reference URLs, title alternatives and thumbnail direction.
4. Imported cards remain visible after reloading the live board.
5. Re-uploading the original document skips both duplicates and preserves a manual title edit.
6. Pasted Markdown supports title edits in the preview and imports only selected ideas.
7. The live UI sends an imported draft for review, then **Approve & create project** creates the project and transfers its client, complete script, references and planning fields.
8. Production RLS denies Editor creation and immediately denies a Manager whose creation permission is revoked.
9. No browser JavaScript errors or HTTP 5xx responses were captured.

The final Railway check reported SUCCESS and 46 HTTP log entries in the verification window, with zero 5xx responses. Runtime logs showed normal startup and readiness. Railway labels the `$ next start` command as stderr/error; the process subsequently became ready without an application exception.

All generated workspace records, ideas, the project and test users were removed. Follow-up queries confirmed zero remaining test workspace, idea and project rows. No real client ideas were imported, edited or approved.

Global notification and automation queue-drain requests were suppressed in the test browser to avoid processing unrelated pending work. The import and approval services were not mocked. Notification delivery was not part of acceptance. John's original linked file was unavailable; the live test used representative structured Markdown.

## Screenshots

- [Desktop preview](live-preview-desktop.png)
- [Mobile preview](live-preview-mobile.png)
- [Import success](live-import-success.png)
- [Project handoff](live-project-handoff.png)
