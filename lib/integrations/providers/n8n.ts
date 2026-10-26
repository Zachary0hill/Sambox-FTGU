import 'server-only';
import type { ProviderModule } from './types';
import type { Secret, Config } from '../secrets';

// n8n: the workspace pastes a Webhook node's Production URL. Automations ("Send a webhook to n8n") POST JSON to it.
// Docs used: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/ (production URL answers only
// while the workflow is active; Header Auth checks a header name and value).

// Posts one JSON body. Returns the status and the first part of the reply for the run record.
export async function postN8n(secret: Secret, config: Config, body: unknown): Promise<{ status: number; reply: string }> {
  const url = String(secret.webhookUrl || '');
  if (!/^https:\/\//i.test(url)) throw new Error('The n8n webhook URL must start with https://.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret.headerValue) headers[String(config.headerName || '') || 'X-FTGU-Secret'] = secret.headerValue;
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  } catch (err) {
    throw new Error(err instanceof Error && err.name === 'TimeoutError' ? 'n8n took more than 15 seconds to answer.' : 'Could not reach the n8n webhook.');
  }
  const reply = (await res.text().catch(() => '')).slice(0, 500);
  if (res.status === 404) throw new Error('n8n answered 404. Activate the workflow so its Production URL listens.');
  if (!res.ok) throw new Error('n8n answered ' + res.status + (reply ? ': ' + reply.slice(0, 160) : '.'));
  return { status: res.status, reply };
}

const provider: ProviderModule = {
  // A ping the workflow can ignore (type: "ping"). A 2xx means the webhook is live.
  async verify(secret, config) {
    try {
      await postN8n(secret, config, { type: 'ping', source: 'FTGU Studio', at: new Date().toISOString() });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },
};

export default provider;
