import 'server-only';
import type { Secret } from '../secrets';

// https://developers.google.com/identity/protocols/oauth2/web-server#offline
// Only the refresh credentials are persisted in Vault. Access tokens stay on the server.
export async function googleAccessToken(secret: Secret): Promise<{ token: string; scopes: string[] }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: secret.clientId, client_secret: secret.clientSecret,
      refresh_token: secret.refreshToken, grant_type: 'refresh_token',
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || typeof body.access_token !== 'string' || !body.access_token) {
    if (body?.error === 'invalid_grant') throw new Error('Google authorization expired or was revoked. Authorize again and replace the refresh token.');
    if (body?.error === 'invalid_client') throw new Error('Google rejected the OAuth client ID or client secret. Use the client that issued this refresh token.');
    throw new Error('Google could not refresh access (HTTP ' + res.status + '). Check the client credentials and refresh token.');
  }
  return { token: body.access_token, scopes: typeof body.scope === 'string' ? body.scope.split(/\s+/) : [] };
}

export function googleApiError(status: number, service: string): string {
  if (status === 401) return service + ' rejected the refreshed token. Authorize the Google account again.';
  if (status === 403) return 'Enable the ' + service + ' API in your Google Cloud project and grant the required OAuth scopes.';
  if (status === 429) return service + ' quota is temporarily exhausted. Try again later.';
  return service + ' returned HTTP ' + status + '.';
}
