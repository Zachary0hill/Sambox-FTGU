import { NextResponse } from 'next/server';
import { getMember, isCron, deny } from '@/lib/integrations/auth';
import { runAutomations } from '@/lib/automations/run';
import { baseUrlFor } from '@/lib/email/invite';

export const maxDuration = 60;

// One runner tick: queues scheduled triggers, then performs queued and due-for-retry automation runs. The board calls
// it after a change, for the member's own workspace; a scheduler with CRON_SECRET covers every workspace (every 5
// minutes keeps retries on their 5 and 10 minute schedule).
export async function POST(request: Request) {
  let workspaceId: string | null = null;
  if (!isCron(request)) {
    const m = await getMember();
    if (!m) return deny('Sign in first.', 401);
    workspaceId = m.ctx.workspace_id;
  }
  try {
    return NextResponse.json(await runAutomations({ workspaceId, baseUrl: baseUrlFor(request) }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isCron(request)) return deny('Scheduled runs need CRON_SECRET.', 401);
  return POST(request);
}
