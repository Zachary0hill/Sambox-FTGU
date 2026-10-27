# Connector quality check — October 27, 2026

Delivery: local implementation. Not committed, pushed or deployed by this task. Existing unrelated project-card and release-note edits are preserved.

## Findings and repairs

Production was inspected while signed in at Workspace Settings > Integrations. It displayed **1 of 11** integrations connected (OpenAI), while Automations displayed 14 connector cards. Google Drive, Gmail and Frame.io were absent from the credential registry and had no server connection handlers.

All 14 now have credential forms and authenticated provider verification through the same Super Admin-only save/disconnect routes. Secret fields use password inputs and go into the existing Supabase Vault RPC, never into `integrations.config` or response JSON. Existing seeded provider IDs (`drive`, `gmail`, `frame`) are reused; no database migration is required.

Additional repairs:

- Rejected replacement credentials leave the saved connection and its health unchanged.
- A failed save displays its error on the relevant card and preserves the draft for correction.
- Vault/database read failures stop the save instead of silently treating the connection as missing.
- Credential values echoed in connection errors are redacted before returning to the browser.
- Save, disconnect and sync controls are disabled during an operation.
- Connector links open and focus the matching settings card.
- New AI connections suggest a model from the authenticated model list after it loads.
- Connection health is visible on both surfaces; connection status no longer claims a workflow is live.
- Buffer descriptions now correctly exclude comments and direct messages.
- Firecrawl accepts only its documented missing-credit-usage 404 as a successful credential probe.
- Slack requests have a 15-second network timeout (provider rate-limit retries remain separate).
- Node 22+ is declared in `package.json`, with `.nvmrc` set to 22. The installed Supabase library fails to initialize under the local Node 20 runtime because native WebSocket is unavailable. Build success alone did not reveal this.

## Credential requirements and boundaries

| Connector | What can be entered | Connection check | Feature boundary |
|---|---|---|---|
| Google Drive | OAuth client ID, client secret, refresh token | Refresh token exchange, writable Drive scope, files list | Connection ready; automatic project folder creation and uploads are not implemented. |
| Gmail | OAuth client ID, client secret, refresh token | Refresh token exchange, send scope, Gmail profile | Connection ready; existing sponsor/invoice email remains on the existing delivery service. |
| Frame.io | V4 OAuth access token | V4 account access | Connection ready; replace expiring token manually. Automatic token renewal and timecoded review import are not implemented. Legacy V2 tokens are not accepted. |
| n8n | Production webhook URL; optional header name/value | Sends a `type: ping` POST | Workflow must be active. Saving can execute the destination workflow; have it ignore ping events. This connects a webhook, not the n8n management API. |
| Claude | API key and selected model | Retrieve model | Does not prove inference quota, billing or tool behavior. |
| OpenAI | API key and selected model | Retrieve model | Does not prove inference quota, billing or tool behavior. |
| Gemini | API key and selected model | Retrieve text-capable model | Does not prove inference quota, billing or tool behavior. |
| monday.com | API token, board ID; optional column IDs and mapping | Board, status column and mapping | Project sync has a separate Sync now action. |
| Apify | API token | Current user | Does not launch or charge for an actor run during connection. |
| Browserbase | API key and project ID | Project access | Does not launch a paid browser session during connection. |
| Firecrawl | API key | Credit usage | Does not scrape or spend search credits during connection. |
| Slack | Bot token; optional signing secret, channels and alert channel | Bot identity | Actual inbox/alert behavior additionally needs channel access, scopes and, for pushed events, a public configured event endpoint. |
| YouTube | API key and channel IDs/@handles | Resolve channels | Reads public metrics. Private analytics/retention requires a separate OAuth integration. |
| Buffer | API key | Account organizations | Reads sent posts/metrics and supports existing publishing flows; the API exposes no inbox comments or DMs. |

## Google setup

API keys cannot authorize private Drive or Gmail access. The implementation accepts refresh credentials for a Google OAuth client you control; it does not add a one-click browser OAuth callback flow.

1. In [Google Cloud credentials](https://console.cloud.google.com/apis/credentials), configure the consent screen and create an OAuth Web application client. Enable Drive API and/or Gmail API in that project. If the consent screen is in testing, add the intended account as a test user.
2. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI for that client.
3. Open [Google OAuth Playground](https://developers.google.com/oauthplayground/). In its settings, enable **Use your own OAuth credentials** and enter this client's ID and secret. Request offline access and account consent.
4. Authorize the appropriate scopes:
   - Drive: `https://www.googleapis.com/auth/drive.file`.
   - Gmail: `https://www.googleapis.com/auth/gmail.send` and `https://www.googleapis.com/auth/gmail.metadata`.
5. Exchange the authorization code for tokens. Copy the refresh token into the matching Studio form, together with the same client ID and secret. Do not paste an access token into the refresh-token field.
6. Save and connect. The server obtains a fresh access token, validates permissions, and performs a read-only API probe before storing credentials.

Drive's `drive.file` grant covers files created/opened with this application; it does not grant access to all pre-existing footage. Google testing-mode grants and revoked credentials may expire; authorize again if the refresh grant stops working. Broader scopes may require Google verification. See [Google offline access](https://developers.google.com/identity/protocols/oauth2/web-server#offline).

## Frame.io setup

Use the [Frame.io V4 quick start](https://developer.frame.io/platform/v4/docs/quick-start) and [Adobe Developer Console](https://developer.adobe.com/console/) to create the appropriate application credentials and generate an OAuth access token for the account. Paste that token in Studio. The server checks `/v4/accounts`; an empty account list or expired token cannot be saved as connected. This version stores an access token only and does not implement an Adobe authorization redirect or refresh flow.

## Verification

- `node --test scripts/check-integrations.cjs`: **78 passed**, zero failed. Uses the real route and provider code with mocked network, session and Vault boundaries. Covers each of the 14 providers: valid save, missing input, rejected credentials, blank-field preservation, disconnect; also role denial, Vault failure, error redaction, Google scopes and token exchange, Frame.io response handling and Firecrawl 404 handling.
- TypeScript: passed.
- Scoped ESLint: zero errors; eight existing Next `<img>` warnings in StudioView.
- Production build: passed on Node 22, including TypeScript and static generation. The earlier Node 20 build also passed but emitted Supabase deprecation warnings; runtime validation exposed the missing native WebSocket.
- Actual third-party credentials were not added, replaced or disconnected during this task. Apart from OpenAI's existing model list loading in production, live provider authentication, sync/publishing, billing/quota and OAuth account authorization still need real credential acceptance checks.
- The local preview uses the existing QA account against the configured workspace; test connections are not saved to that workspace.
- Chrome on the Node 22 local production build: **14 credential cards and 20 password fields** rendered; Google Drive's empty submit showed a persistent inline missing-credential error, kept the provider disconnected, and unlocked the form afterward. All 14 Automations cards displayed enabled connection links, with no Coming soon placeholders. The Frame.io link was exercised and scrolled to and focused its own form. OpenAI's existing saved key populated the model list on both production and the local build. Screenshot evidence: `qa-report/connector-settings-2026-10-27.jpg` (gitignored).

After deployment, add real credentials in Settings > Integrations, confirm the successful state survives a reload, and run one intended feature per connector. A green connection badge establishes the credential probe only; it does not establish scheduler operation or downstream workflow delivery.
