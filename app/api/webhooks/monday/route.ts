import { NextResponse } from 'next/server';
import { getIntegration } from '@/lib/integrations/secrets';
import { pullItems, webhookTokenOk } from '@/lib/integrations/providers/monday';

// monday board events (status change, rename, new item), subscribed by the Settings sync once APP_BASE_URL is
// public. Docs: https://developer.monday.com/api-reference/reference/webhooks
// The URL carries ?ws=<workspace>&t=<HMAC of the workspace>. The payload is only a hint: the item is re-read from the
// monday API with the workspace's key before anything is written.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const q = new URL(request.url).searchParams;
  const ws = q.get('ws') || '';
  if (!UUID.test(ws) || !webhookTokenOk(ws, q.get('t') || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  if (typeof body.challenge === 'string') return NextResponse.json({ challenge: body.challenge });

  const ev = body.event || {};
  const itemId = ev.pulseId != null ? String(ev.pulseId) : '';
  if (!/^\d+$/.test(itemId) || ev.parentItemId) return NextResponse.json({ ok: true });

  const conn = await getIntegration(ws, 'monday').catch(() => null);
  if (!conn || String(ev.boardId) !== String(conn.config.boardId || '')) return NextResponse.json({ ok: true });

  try {
    const summary = await pullItems(ws, conn.secret, conn.config, [itemId]);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    // A 5xx makes monday retry once a minute for 30 minutes.
    console.warn('monday webhook', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Sync failed.' }, { status: 500 });
  }
}
