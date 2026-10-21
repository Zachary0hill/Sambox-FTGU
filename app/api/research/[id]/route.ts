import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { cancelRun, expireStale } from '@/lib/research/run';

// One run's status, for polling.
export async function GET(_request: Request, ctx: RouteContext<'/api/research/[id]'>) {
  const { id } = await ctx.params;
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can see research runs.');
  await expireStale(m.ctx.workspace_id);
  const { data } = await m.supabase.from('research_runs').select('*').eq('id', id).maybeSingle();
  if (!data) return deny('No such run.', 404);
  return NextResponse.json({ run: data });
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
