import 'server-only';
import type { ProviderModule } from './types';

// https://developer.frame.io/platform/v4/docs/quick-start (GET /v4/accounts, OAuth Bearer token)
const provider: ProviderModule = {
  async verify(secret) {
    const res = await fetch('https://api.frame.io/v4/accounts', {
      headers: { Authorization: 'Bearer ' + secret.accessToken },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (res.status === 401) return 'The Frame.io V4 access token is invalid or expired. Generate a fresh OAuth token in Adobe Developer Console.';
    if (res.status === 403) return 'This token cannot access Frame.io V4. Check the Adobe app permissions and Frame.io account access.';
    if (!res.ok) return 'Frame.io returned HTTP ' + res.status + '.';
    const body = await res.json().catch(() => null);
    if (!Array.isArray(body?.data)) return 'Frame.io returned an unexpected response. Check that this is a V4 account.';
    return body.data.some((account: { id?: string }) => account?.id) ? null : 'This token has no accessible Frame.io accounts. Grant the app access in Adobe and try again.';
  },
};
export default provider;
