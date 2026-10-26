import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, isCron, deny } from '@/lib/integrations/auth';
import { getIntegration, connectedWorkspaces, markChecked } from '@/lib/integrations/secrets';
import { providerById } from '@/lib/integrations/registry';
import { MODULES } from '@/lib/integrations/providers';
import { cleanupBufferMedia } from '@/lib/integrations/buffer-publish';

export const maxDuration = 300;

// Pull now. A Super Admin syncs their own workspace from Settings; a scheduled caller with CRON_SECRET syncs every
// workspace that has this provider connected.
export async function POST(request: Request, ctx: RouteContext<'/api/integrations/[provider]/sync'>) {
  const { provider } = await ctx.params;
  const def = providerById(provider);
  const mod = def ? MODULES[def.id] : null;
  if (!def || !mod || !mod.sync) return deny('This integration has nothing to sync.', 404);

  let workspaces: string[];
  if (isCron(request)) {
    workspaces = await connectedWorkspaces(def.id);
  } else {
    const m = await getMember();
    if (!isSuperAdmin(m)) return deny('Only a Super Admin can run a sync.');
    workspaces = [m.ctx.workspace_id];
  }

  const results: { workspaceId: string; summary?: string; error?: string }[] = [];
  for (const ws of workspaces) {
    try {
      const conn = await getIntegration(ws, def.id);
      if (!conn) { results.push({ workspaceId: ws, error: def.name + ' is not connected.' }); continue; }
      const r = await mod.sync(ws, conn.secret, conn.config);
      // Sent posts no longer need their public media copy (lib/integrations/buffer-publish.ts).
      if (def.id === 'buffer') await cleanupBufferMedia(ws).catch((e) => console.warn('buffer-media cleanup', e));
      await markChecked(ws, def.id, null, true);
      results.push({ workspaceId: ws, summary: r.summary });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markChecked(ws, def.id, msg);
      results.push({ workspaceId: ws, error: msg });
    }
  }
  const one = results.length === 1 ? results[0] : null;
  if (one && one.error) return NextResponse.json({ error: one.error }, { status: 502 });
  return NextResponse.json(one ? { summary: one.summary } : { results });
}

// Vercel Cron calls with GET. Only the scheduler may use it.
export async function GET(request: Request, ctx: RouteContext<'/api/integrations/[provider]/sync'>) {
  if (!isCron(request)) return deny('Scheduled syncs need CRON_SECRET.', 401);
  return POST(request, ctx);
}
