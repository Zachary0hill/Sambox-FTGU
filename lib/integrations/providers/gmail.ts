import 'server-only';
import type { ProviderModule } from './types';
import { googleAccessToken, googleApiError } from './google-oauth';

// https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/getProfile
// Verify identity and granted send permission without sending an email.
const provider: ProviderModule = {
  async verify(secret) {
    const { token, scopes } = await googleAccessToken(secret);
    if (!scopes.some((s) => ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify', 'https://mail.google.com/'].includes(s))) {
      return 'Authorize Gmail with gmail.send and gmail.metadata scopes and replace the refresh token.';
    }
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return googleApiError(res.status, 'Gmail');
    const body = await res.json().catch(() => null);
    return typeof body?.emailAddress === 'string' && body.emailAddress ? null : 'Gmail returned an unexpected profile. Try again.';
  },
};
export default provider;
