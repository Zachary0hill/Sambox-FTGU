import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { testAutomation } from '@/lib/automations/run';
import { baseUrlFor } from '@/lib/email/invite';

// Test run (Super Admin): the workflow's actions against the newest project, described without sending or changing
// anything. The result is saved as a run with status "test". The flow builder sends its unsaved graph as { flow }.
export async function POST(request: Request, ctx: RouteContext<'/api/automations/[id]/test'>) {
  const { id } = await ctx.params;
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can test automations.');
  try {
    const body = (await request.json().catch(() => ({}))) as { flow?: unknown };
    const run = await testAutomation(m.ctx.workspace_id, id, baseUrlFor(request), body.flow);
    return NextResponse.json({ run });
  } catch (err) {
    return deny(err instanceof Error ? err.message : String(err), 400);
  }
}
