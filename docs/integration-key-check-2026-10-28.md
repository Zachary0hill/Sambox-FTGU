# Integration credential check — October 28, 2026

Checked the workspace database configured by this checkout and called the real provider verification functions for every stored integration credential. Provider keys stayed in process memory and were sent only to their provider's verification endpoint. No credentials, connection settings, health timestamps, sync data, posts, or messages were changed.

| Integration | Live result |
| --- | --- |
| Apify | Passed: authenticated current-user lookup. |
| Buffer | Passed: authenticated account/organization GraphQL query. |
| OpenAI | Passed: authenticated lookup of the workspace's configured model. |
| Claude | No saved credential. |
| Gemini | No saved credential. |
| Browserbase | No saved credential. |
| Firecrawl | No saved credential. |
| Google Drive | No saved credential. |
| Gmail | No saved credential. |
| Frame.io | No saved credential. |
| monday.com | No saved credential; board settings alone are present. |
| n8n | No saved credential. |
| Slack | No saved credential. |
| YouTube | No saved credential. |
| vidIQ | No saved credential at audit time. |
| Virlo | No saved credential. |

These results establish the three saved keys' verification access. They do not establish inference billing/quota, publishing, sync, or scheduled execution. Unsaved form drafts are not present in Vault and were not tested.

## Connector checks

The original offline suite had stale assumptions: 14 connectors instead of 16, no MCP handshake/catalog fixtures for vidIQ, and a Virlo test key without its required prefix. Updated the fixtures to exercise the real SDK handshake and connection route for both newer providers. Added route checks for canonical/legacy vidIQ names, valid Virlo selections, and unknown tool rejection without overwriting saved credentials.

The published [Virlo MCP tool catalog](https://dev.virlo.ai/docs/mcp) lists all eight configured default names without a provider prefix, consistent with the implementation. Its [free balance endpoint](https://dev.virlo.ai/docs/quickstart) is used to validate authentication; MCP initialization alone only checks the key prefix.

Validation: `node --test scripts/check-integrations.cjs scripts/check-vidiq.cjs` passes 96 checks with no failures, covering all 16 connection routes plus the vidIQ assistant/research regression. Scoped ESLint and whitespace checks pass. Offline checks use synthetic credentials and mocked network/Vault boundaries.

At audit completion, the fixes and test-fixture updates were local only. The subsequent release request covers the vidIQ connection, assistant/research tool-name fixes, regression checks, and this report. Production build and all 96 regression checks passed before release.
