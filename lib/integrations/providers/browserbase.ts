import 'server-only';
import { chromium, type Page } from 'playwright-core';
import type { ProviderModule } from './types';

// Browserbase REST API v1 plus Playwright over CDP. Docs used:
// https://docs.browserbase.com/reference/api/get-a-project (GET /v1/projects/{id}, header X-BB-API-Key)
// https://docs.browserbase.com/reference/api/create-a-session (POST /v1/sessions: projectId, timeout 60-21600 s)
// https://docs.browserbase.com/reference/api/update-a-session (POST /v1/sessions/{id} { status: 'REQUEST_RELEASE' })
// https://docs.browserbase.com/introduction/playwright (chromium.connectOverCDP(connectUrl), contexts()[0].pages()[0])

const API = 'https://api.browserbase.com/v1';

export type BrowserbaseSession = { id: string; connectUrl: string; status: string };

async function call<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init, headers: { 'x-bb-api-key': apiKey, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error('Browserbase: ' + ((body && (body.message || body.error)) || 'HTTP ' + res.status));
  return body as T;
}

export function createSession(apiKey: string, projectId: string, timeoutSecs: number) {
  return call<BrowserbaseSession>(apiKey, '/sessions', {
    method: 'POST', body: JSON.stringify({ projectId, timeout: Math.max(60, Math.min(21600, Math.round(timeoutSecs))), keepAlive: false }),
  });
}

export async function releaseSession(apiKey: string, sessionId: string) {
  await call(apiKey, '/sessions/' + sessionId, { method: 'POST', body: JSON.stringify({ status: 'REQUEST_RELEASE' }) }).catch(() => null);
}

// Opens a cloud browser, hands `fn` a page, and always closes the browser and releases the session.
// The session timeout is a backstop in case cleanup never runs.
export async function withBrowser<T>(
  secret: Record<string, string>, config: Record<string, unknown>, timeoutSecs: number,
  fn: (page: Page, sessionId: string) => Promise<T>,
): Promise<T> {
  const projectId = String(config.projectId || '');
  if (!secret.apiKey || !projectId) throw new Error('Browserbase needs an API key and project ID.');
  const session = await createSession(secret.apiKey, projectId, timeoutSecs);
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null = null;
  try {
    // Playwright's error text can include connectUrl, which carries a signing key; never pass it on.
    browser = await chromium.connectOverCDP(session.connectUrl, { timeout: 30000 }).catch(() => {
      throw new Error('Could not connect to the Browserbase browser.');
    });
    const context = browser.contexts()[0] || (await browser.newContext());
    const page = context.pages()[0] || (await context.newPage());
    return await fn(page, session.id);
  } finally {
    if (browser) await browser.close().catch(() => null);
    await releaseSession(secret.apiKey, session.id);
  }
}

const provider: ProviderModule = {
  async verify(secret, config) {
    const projectId = String(config.projectId || '');
    if (!secret.apiKey) return 'Add the API key.';
    if (!projectId) return 'Add the project ID.';
    const res = await fetch(API + '/projects/' + encodeURIComponent(projectId), { headers: { 'x-bb-api-key': secret.apiKey }, signal: AbortSignal.timeout(15000) });
    if (res.status === 401 || res.status === 403) return 'The API key is not valid.';
    if (res.status === 404) return 'No project with that ID for this key.';
    if (!res.ok) return 'Browserbase answered HTTP ' + res.status + '.';
    return null;
  },
};

export default provider;
