import { NextResponse } from 'next/server';
import { getMember, isCron, deny } from '@/lib/integrations/auth';
import { sendQueuedEmails } from '@/lib/email/notifications';
import { baseUrlFor } from '@/lib/email/invite';

export const maxDuration = 60;

// Sends queued notification emails and queues tomorrow's deadline reminders. The board calls this after a change and
// when it loads, for the member's own workspace; a scheduler with CRON_SECRET covers every workspace, so reminders
// and emails from server-side changes (monday sync) go out even when nobody has the board open.
export async function POST(request: Request) {
  let workspaceId: string | null = null;
  if (!isCron(request)) {
    const m = await getMember();
    if (!m) return deny('Sign in first.', 401);
    workspaceId = m.ctx.workspace_id;
  }
  try {
    return NextResponse.json(await sendQueuedEmails({ workspaceId, baseUrl: baseUrlFor(request) }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// Vercel Cron calls with GET. Only the scheduler may use it.
export async function GET(request: Request) {
  if (!isCron(request)) return deny('Scheduled sends need CRON_SECRET.', 401);
  return POST(request);
}
