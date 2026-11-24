# Dev Note decisions and acceptance enhancements

## 1. Give John a decision inbox

Each decision has a clear question, relevant evidence, choices or a written answer, and a durable record of who answered and when. Make the six known decisions usable without relying on synthetic production IDs.

## 2. Attach contextual Try it links

Show the intended role and deep-link to the relevant dashboard screen, project or filter. Enforce existing role access and safely handle missing/deleted references and mobile navigation.

## 3. Separate delivery and acceptance

Support Needs decision, Ready to try and Accepted plus a recorded acceptance comment/example. Keep implementation progress distinct from owner sign-off, preserve existing notes/history and legacy status compatibility. No automatic acceptance of the six original notes.

## Delivery and verification

Implement through the dashboard’s normal entry points on the shared branch. Read AGENTS.md and the relevant installed Next.js guides first. Scope shared-file edits to this feature. Use new migration prefix 202611250006 and Node 22. Test with disposable data, including role boundaries, retries and existing records where relevant. Update your numbered enhancement heading in [the shared completion log](../COMPLETION.md) with results for all three items, exact checks and any limits. Leave live workspaces and external accounts untouched.
