import { NextResponse, after } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { createRun, executeRun, expireStale, availability } from '@/lib/research/run';

// The run continues after the response (see `after`), so this limit covers the whole run. The pipeline stops itself
// at LIMITS.runSecs (285 s), under this.
export const maxDuration = 300;

// Super Admin starts a research run for one brand. Responds with the run ID at once; progress lands in
// research_runs, which the Ideas page reads (realtime) or polls through GET /api/research/[id].
export async function POST(request: Request) {
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can run research.');
  const body = await request.json().catch(() => ({}));
  const out = await createRun(m, body && typeof body === 'object' ? body : {});
  if ('error' in out) return deny(out.error || 'Could not start the run.', out.status);
  after(() => executeRun(out.id, m));
  return NextResponse.json({ id: out.id });
}

// What research can use right now, plus the latest runs. No keys, only connected flags.
export async function GET() {
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can see research runs.');
  const ws = m.ctx.workspace_id;
  await expireStale(ws);
  const [{ ai, conns }, runs] = await Promise.all([
    availability(ws),
    m.supabase.from('research_runs').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(10),
  ]);
  return NextResponse.json({
    connected: { ai, apify: !!conns.apify, browserbase: !!conns.browserbase, firecrawl: !!conns.firecrawl },
    runs: runs.data || [],
  });
}
