import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { decideApproval, runAutomations } from '@/lib/automations/run';
import { baseUrlFor } from '@/lib/email/invite';

export const maxDuration = 60;

// Approve or reject a waiting approval step (Super Admin). The id is the run's: a run waits on one approval at a
// time. Body: { decision: 'approve' | 'reject', body?: an edited message for the step the approval covers }.
// Approved runs carry on straight away; rejected runs stop and nothing after the approval happens.
export async function POST(request: Request, ctx: RouteContext<'/api/automations/approvals/[id]'>) {
  const { id } = await ctx.params;
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can approve automation steps.');
  const body = (await request.json().catch(() => ({}))) as { decision?: string; body?: string };
  if (body.decision !== 'approve' && body.decision !== 'reject') return deny('Send a decision: approve or reject.', 400);
  const who = { id: m.ctx.user_id, name: (m.ctx.profile && (m.ctx.profile.full_name || m.ctx.profile.email)) || 'a Super Admin' };
  const res = await decideApproval(m.ctx.workspace_id, id, who, body.decision, typeof body.body === 'string' ? body.body.slice(0, 8000) : undefined);
  if (res.status !== 200) return deny(res.error, res.status);
  try {
    return NextResponse.json({ ok: true, ...(await runAutomations({ workspaceId: m.ctx.workspace_id, baseUrl: baseUrlFor(request) })) });
  } catch (err) {
    return deny(err instanceof Error ? err.message : String(err), 500);
  }
}
