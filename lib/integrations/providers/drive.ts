import 'server-only';
import type { ProviderModule } from './types';
import { googleAccessToken, googleApiError } from './google-oauth';

// https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
// A read-only probe; saving credentials never creates folders or uploads files.
const provider: ProviderModule = {
  async verify(secret) {
    const { token, scopes } = await googleAccessToken(secret);
    if (!scopes.some((s) => s === 'https://www.googleapis.com/auth/drive.file' || s === 'https://www.googleapis.com/auth/drive')) {
      return 'Authorize Google Drive with the drive.file scope and replace the refresh token.';
    }
    const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id)', {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return googleApiError(res.status, 'Google Drive');
    const body = await res.json().catch(() => null);
    return Array.isArray(body?.files) ? null : 'Google Drive returned an unexpected response. Try again.';
  },
};
export default provider;
