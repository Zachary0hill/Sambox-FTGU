import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { runAutomations } from '@/lib/automations/run';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { baseUrlFor } from '@/lib/email/invite';

// Retry a run (Super Admin).
//   default            the failed run resumes at the step that failed; steps that already worked are not repeated
//   { from: 'start' }  a new run of the same workflow on the same project, from the first step; returns its runId
export async function POST(request: Request, ctx: RouteContext<'/api/automations/runs/[id]/retry'>) {
  const { id } = await ctx.params;
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can retry automation runs.');
  const ws = m.ctx.workspace_id;
  const admin = supabaseAdmin();
  const body = (await request.json().catch(() => ({}))) as { from?: string };
  let runId = id;
  if (body.from === 'start') {
    const old = await admin.from('automation_runs').select('automation_id, project_id, idea_id, trigger_key, payload, status, is_test').eq('id', id).eq('workspace_id', ws).maybeSingle();
    if (old.error || !old.data) return deny('That run was not found.', 404);
    if (old.data.is_test) return deny('Test runs are started from the builder.', 400);
    if (!['failed', 'done', 'skipped'].includes(old.data.status)) return deny('This run is still going. Wait for it to finish first.', 400);
    const ins = await admin.from('automation_runs').insert({
      automation_id: old.data.automation_id, workspace_id: ws, project_id: old.data.project_id, ...(old.data.idea_id ? { idea_id: old.data.idea_id } : {}), trigger_key: old.data.trigger_key,
      status: 'queued', payload: { ...((old.data.payload as Record<string, unknown>) || {}), retryOf: id },
    }).select('id').single();
    if (ins.error) return deny(ins.error.message, 400);
    runId = ins.data.id as string;
  } else {
    // Tries start over, so do the delay claims the runner leaves out of them (lib/automations/run.ts).
    const cur = await admin.from('automation_runs').select('output').eq('id', id).eq('workspace_id', ws).maybeSingle();
    const output = cur.data && cur.data.output ? { ...(cur.data.output as Record<string, unknown>), waitClaims: 0 } : null;
    const res = await admin.from('automation_runs').update({ status: 'queued', attempts: 0, next_attempt_at: null, error: null, ...(output ? { output } : {}) })
      .eq('id', id).eq('workspace_id', ws).eq('status', 'failed').select('id');
    if (res.error) return deny(res.error.message, 400);
    if (!(res.data || []).length) return deny('Only failed runs can be retried.', 400);
  }
  try {
    return NextResponse.json({ ...(await runAutomations({ workspaceId: ws, baseUrl: baseUrlFor(request) })), runId });
  } catch (err) {
    return deny(err instanceof Error ? err.message : String(err), 500);
  }
}
