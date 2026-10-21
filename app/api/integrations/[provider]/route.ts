import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { getIntegration, markChecked } from '@/lib/integrations/secrets';
import { providerById } from '@/lib/integrations/registry';
import { MODULES } from '@/lib/integrations/providers';

// Super Admin saves a provider's key and settings. Secret fields left blank keep the saved value, so changing a
// board ID does not need the key pasted again. The key is checked with a live call before anything is stored.
export async function POST(request: Request, ctx: RouteContext<'/api/integrations/[provider]'>) {
  const { provider } = await ctx.params;
  const def = providerById(provider);
  if (!def) return deny('Unknown integration.', 404);
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can connect integrations.');
  const ws = m.ctx.workspace_id;

  const body = await request.json().catch(() => ({}));
  const input: Record<string, unknown> = body && body.fields && typeof body.fields === 'object' ? body.fields : {};
  const val = (k: string) => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');

  // A disconnected row has no secret but keeps its config (e.g. monday's webhook IDs), so reconnecting keeps it.
  const saved = await getIntegration(ws, def.id).catch(() => null);
  const row = saved ? null : await m.supabase.from('integrations').select('config').eq('workspace_id', ws).eq('provider', def.id).maybeSingle();
  const secret: Record<string, string> = { ...(saved ? saved.secret : {}) };
  const config: Record<string, unknown> = { ...(saved ? saved.config : (row && row.data && row.data.config) || {}) };
  delete config.keyHint;
  let changedSecret = !saved;
  for (const f of def.fields) {
    const v = val(f.key);
    if (f.secret) {
      if (v) { secret[f.key] = v; changedSecret = true; }
    } else if (f.key in input) {
      config[f.key] = v || f.defaultValue || '';
    } else if (config[f.key] === undefined && f.defaultValue) {
      config[f.key] = f.defaultValue;
    }
  }
  const missing = def.fields.filter((f) => !f.optional && !(f.secret ? secret[f.key] : config[f.key]));
  if (missing.length) return deny('Add ' + missing.map((f) => f.label.toLowerCase()).join(' and ') + ' to connect ' + def.name + '.', 400);

  const problem = await MODULES[def.id].verify(secret, config).catch((err) => (err instanceof Error ? err.message : String(err)));
  if (problem) {
    if (saved) await markChecked(ws, def.id, problem);
    return deny(def.name + ' rejected the key: ' + problem, 400);
  }

  const first = def.fields.find((f) => f.secret);
  const hint = first && secret[first.key] ? secret[first.key].slice(-4) : null;
  const res = await m.supabase.rpc('set_integration_secret', {
    p_workspace: ws, p_provider: def.id, p_secret: changedSecret ? secret : null, p_hint: changedSecret ? hint : null, p_config: config,
  });
  if (res.error) return deny(res.error.message, 400);
  await markChecked(ws, def.id, null);
  await m.supabase.rpc('log_activity', {
    p_category: 'admin', p_action: saved ? 'updated the integration' : 'connected', p_target_label: def.name,
    p_project: null, p_idea: null, p_event: null, p_quote: null, p_external: false,
  });
  return NextResponse.json({ ok: true });
}

// Super Admin disconnects: the Vault secret is deleted, config other than the key hint is kept.
export async function DELETE(_request: Request, ctx: RouteContext<'/api/integrations/[provider]'>) {
  const { provider } = await ctx.params;
  const def = providerById(provider);
  if (!def) return deny('Unknown integration.', 404);
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can disconnect integrations.');
  const res = await m.supabase.rpc('clear_integration_secret', { p_workspace: m.ctx.workspace_id, p_provider: def.id });
  if (res.error) return deny(res.error.message, 400);
  await m.supabase.rpc('log_activity', {
    p_category: 'admin', p_action: 'disconnected', p_target_label: def.name,
    p_project: null, p_idea: null, p_event: null, p_quote: null, p_external: false,
  });
  return NextResponse.json({ ok: true });
}
