import { NextResponse } from 'next/server';
import { queueWebhookRun, runAutomations } from '@/lib/automations/run';
import { baseUrlFor } from '@/lib/email/invite';

export const maxDuration = 60;

// Webhook trigger (the builder's Trigger setup > Webhook). A workflow's address carries its own token; with "Require a
// secret key" on, the request must also send that key in the x-workflow-key header. A live workflow queues one run
// and the runner picks it up straight away. A draft, or a body with { "test": true }, only reports that the address
// works. An optional "project" (job code or id) in the body gives project steps something to act on.
export async function POST(request: Request, ctx: RouteContext<'/api/webhooks/automations/[token]'>) {
  const { token } = await ctx.params;
  if (!/^[a-z0-9]{16,64}$/i.test(token)) return NextResponse.json({ error: 'Unknown address.' }, { status: 404 });
  const raw = await request.json().catch(() => ({}));
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  if (new URL(request.url).searchParams.get('test') === '1') body.test = true;
  const res = await queueWebhookRun(token, request.headers.get('x-workflow-key'), body);
  if (res.status !== 200) return NextResponse.json({ error: res.error }, { status: res.status });
  if (res.queued) await runAutomations({ workspaceId: res.workspaceId, baseUrl: baseUrlFor(request), limit: 10 }).catch((err) => console.warn('webhook run', err));
  return NextResponse.json({
    ok: true, workflow: res.workflow, live: res.live, queued: res.queued,
    message: res.queued ? 'Run started.' : res.live ? 'Test received. Nothing ran.' : 'Received. The workflow is not live, so nothing ran.',
  });
}
