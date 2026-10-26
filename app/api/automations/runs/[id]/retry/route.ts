import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { runAutomations } from '@/lib/automations/run';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { baseUrlFor } from '@/lib/email/invite';

// Retry a failed run now (Super Admin). Actions that already worked on it are not repeated.
export async function POST(request: Request, ctx: RouteContext<'/api/automations/runs/[id]/retry'>) {
  const { id } = await ctx.params;
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can retry automation runs.');
  const ws = m.ctx.workspace_id;
  const admin = supabaseAdmin();
  const res = await admin.from('automation_runs').update({ status: 'queued', attempts: 0, next_attempt_at: null, error: null })
    .eq('id', id).eq('workspace_id', ws).eq('status', 'failed').select('id');
  if (res.error) return deny(res.error.message, 400);
  if (!(res.data || []).length) return deny('Only failed runs can be retried.', 400);
  try {
    return NextResponse.json(await runAutomations({ workspaceId: ws, baseUrl: baseUrlFor(request) }));
  } catch (err) {
    return deny(err instanceof Error ? err.message : String(err), 500);
  }
}
