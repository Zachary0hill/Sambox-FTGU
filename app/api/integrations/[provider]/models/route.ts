import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { getIntegration } from '@/lib/integrations/secrets';
import { providerById } from '@/lib/integrations/registry';
import { MODULES } from '@/lib/integrations/providers';

// Super Admin lists the models a key can use, for the Model dropdown. A key pasted but not yet saved is sent in the
// body and used for this call only; otherwise the saved key is used. Nothing is stored.
export async function POST(request: Request, ctx: RouteContext<'/api/integrations/[provider]/models'>) {
  const { provider } = await ctx.params;
  const def = providerById(provider);
  const mod = def ? MODULES[def.id] : null;
  if (!def || !mod || !mod.listModels) return deny('This integration has no models to list.', 404);
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can manage integrations.');

  const body = await request.json().catch(() => ({}));
  const pasted = body && typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const saved = pasted ? null : await getIntegration(m.ctx.workspace_id, def.id).catch(() => null);
  const apiKey = pasted || (saved && saved.secret.apiKey) || '';
  if (!apiKey) return deny('Add an API key to see the models.', 400);

  try {
    const models = await mod.listModels({ apiKey });
    return NextResponse.json({ models });
  } catch (err) {
    return deny(err instanceof Error ? err.message : String(err), 400);
  }
}
