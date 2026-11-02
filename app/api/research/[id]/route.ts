import { NextResponse, after } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { cancelRun, executeRun, expireStale, startRedraft } from '@/lib/research/run';
import { RUN_COLUMNS } from '@/lib/research/catalog';

// A redraft continues after the response (see `after`), so this limit covers it. The pipeline stops itself first.
export const maxDuration = 300;

// One run's status, for polling.
export async function GET(_request: Request, ctx: RouteContext<'/api/research/[id]'>) {
  const { id } = await ctx.params;
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can see research runs.');
  await expireStale(m.ctx.workspace_id);
  const { data } = await m.supabase.from('research_runs').select(RUN_COLUMNS).eq('id', id).maybeSingle();
  if (!data) return deny('No such run.', 404);
  return NextResponse.json({ run: data });
}

// Drafts ideas again from a failed run's saved findings. Responds at once; progress lands on the run row.
export async function POST(_request: Request, ctx: RouteContext<'/api/research/[id]'>) {
  const { id } = await ctx.params;
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can run research.');
  const out = await startRedraft(m, id);
  if ('error' in out) return deny(out.error || 'Could not start the draft.', out.status);
  after(() => executeRun(out.id, m));
  return NextResponse.json({ id: out.id });
}

// Cancels a queued or running run (the row is kept as history). Any Apify actor runs it started are aborted.
export async function DELETE(_request: Request, ctx: RouteContext<'/api/research/[id]'>) {
  const { id } = await ctx.params;
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can cancel research.');
  const ok = await cancelRun(m.ctx.workspace_id, id);
  if (!ok) return deny('No such run.', 404);
  return NextResponse.json({ ok: true });
}
