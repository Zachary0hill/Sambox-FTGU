import { NextResponse } from 'next/server';
import { getMember, deny } from '@/lib/integrations/auth';
import { getIntegration, markChecked } from '@/lib/integrations/secrets';
import { pushStatus } from '@/lib/integrations/providers/monday';

// Same project and status pushed within this window is dropped, so repeated calls cannot burn the monday budget.
// Per server instance, which is enough to stop bursts.
const COOLDOWN_MS = 3000;
const recent = new Map<string, { status: string; at: number }>();

// After a member changes a project's status on the board, copy it to the linked monday item. The project is read on
// the member's own session, so they can only push projects RLS lets them see; the push always sends the saved status.
export async function POST(request: Request) {
  const m = await getMember();
  if (!m) return deny('Sign in first.', 401);
  const body = await request.json().catch(() => ({}));
  const id = body && typeof body.projectId === 'string' ? body.projectId : '';
  if (!id) return deny('Missing project.', 400);

  const { data: p } = await m.supabase.from('projects').select('workspace_id, monday_item_id, status_id').eq('id', id).maybeSingle();
  if (!p) return deny('Project not found.', 404);
  if (!p.monday_item_id) return NextResponse.json({ skipped: 'not linked' });

  const now = Date.now();
  const last = recent.get(id);
  if (last && last.status === p.status_id && now - last.at < COOLDOWN_MS) return NextResponse.json({ skipped: 'just pushed' });
  recent.set(id, { status: p.status_id, at: now });
  if (recent.size > 500) for (const [k, v] of recent) if (now - v.at >= COOLDOWN_MS) recent.delete(k);

  const { data: st } = await m.supabase.from('project_statuses').select('label').eq('id', p.status_id).maybeSingle();
  const conn = await getIntegration(p.workspace_id, 'monday').catch(() => null);
  if (!conn || !st) return NextResponse.json({ skipped: 'monday not connected' });

  const problem = await pushStatus(conn.secret, conn.config, p.monday_item_id, st.label)
    .catch((err) => (err instanceof Error ? err.message : String(err)));
  if (problem) {
    await markChecked(p.workspace_id, 'monday', problem);
    return NextResponse.json({ error: problem }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
