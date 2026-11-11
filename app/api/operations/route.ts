import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
export async function GET() {
  const member = await getMember();
  if (!isSuperAdmin(member)) return deny('Only a Super Admin can view operations.');
  const admin = supabaseAdmin(), ws = member.ctx.workspace_id;
  const count = (table: string, states: string[]) => admin.from(table).select('*', { count: 'exact', head: true }).eq('workspace_id', ws).in('status', states);
  const [health, automation, email, cleanup, research, conflicts, connections, oldest, ideaResearch] = await Promise.all([
    admin.from('worker_health').select('*').in('scope', ['scheduler', ws]),
    count('automation_runs', ['failed']), count('email_outbox', ['failed']),
    admin.from('storage_cleanup').select('*', { count: 'exact', head: true }).eq('workspace_id', ws).is('completed_at', null),
    count('research_runs', ['failed']),
    admin.from('assignment_reconciliation').select('*', { count: 'exact', head: true }).eq('workspace_id', ws).not('result', 'in', '(reconciled,already_matches)'),
    admin.from('integrations').select('provider,name,status,last_synced_at,last_checked_at,last_error').eq('workspace_id', ws).order('sort'),
    admin.from('automation_runs').select('created_at').eq('workspace_id', ws).in('status', ['queued','retry']).order('created_at').limit(1).maybeSingle(),
    admin.from('ideas').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).filter('run->>state', 'eq', 'failed'),
  ]);
  const bad = [health,automation,email,cleanup,research,conflicts,connections,oldest,ideaResearch].find(x=>x.error);
  if (bad?.error) return deny('Operations status could not load. Try Refresh.', 503);
  return NextResponse.json({ workers: health.data, connections: connections.data, oldestQueued: oldest.data?.created_at || null,
    counts: { automation: automation.count, email: email.count, cleanup: cleanup.count, research: (research.count || 0) + (ideaResearch.count || 0), assignments: conflicts.count } }, { headers: { 'Cache-Control': 'no-store' } });
}
