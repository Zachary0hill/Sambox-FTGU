import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { AI_PROVIDERS, type ProviderId } from '@/lib/integrations/registry';
import { aiProviders, readPrefs, MAX_INSTRUCTIONS } from '@/lib/ai/settings';

// AI settings behind the gear on the Daily page. Any member can read which models are connected (never a key);
// only a Super Admin can change the default provider, default answer mode and workspace instructions. Keys and each
// provider's model are saved through /api/integrations/[provider], which checks the key with a live call first.

export async function GET() {
  const m = await getMember();
  if (!m) return deny('Sign in to see AI settings.', 401);
  const ws = m.ctx.workspace_id;
  const [providers, st] = await Promise.all([
    aiProviders(ws),
    m.supabase.from('workspace_settings').select('*').eq('workspace_id', ws).maybeSingle(),
  ]);
  const row = (st.data || {}) as Record<string, unknown>;
  const live = providers.filter((p) => p.connected).map((p) => p.id);
  const pick = row.ai_provider as ProviderId | null | undefined;
  const admin = isSuperAdmin(m);
  return NextResponse.json({
    admin,
    providers: admin ? providers : providers.map((p) => ({ ...p, keyHint: null, error: null })),
    provider: pick && live.includes(pick) ? pick : live[0] || null,
    ...readPrefs(row),
    // False until the workspace_settings.assistant column exists (migration 20261026000600).
    prefsReady: 'assistant' in row,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can change AI settings.');
  const ws = m.ctx.workspace_id;
  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return deny('Send a JSON object.', 400);
  const b = raw as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if ('provider' in b) {
    if (b.provider !== null && !AI_PROVIDERS.includes(b.provider as ProviderId)) return deny('Unknown AI provider.', 400);
    patch.ai_provider = b.provider;
  }
  if ('mode' in b || 'instructions' in b) {
    const cur = await m.supabase.from('workspace_settings').select('*').eq('workspace_id', ws).maybeSingle();
    const row = (cur.data || {}) as Record<string, unknown>;
    if (!('assistant' in row)) return deny('Saving the answer mode and instructions needs the latest database migration (assistant settings). Ask whoever deploys the board to run it.', 409);
    const prev = readPrefs(row);
    const instructions = 'instructions' in b ? String(b.instructions ?? '').trim() : prev.instructions;
    if (instructions.length > MAX_INSTRUCTIONS) return deny('Keep instructions under ' + MAX_INSTRUCTIONS + ' characters.', 400);
    patch.assistant = { mode: 'mode' in b ? (b.mode === 'think' ? 'think' : 'fast') : prev.mode, instructions };
  }
  if (!Object.keys(patch).length) return deny('Nothing to save.', 400);

  const res = await m.supabase.from('workspace_settings').update(patch).eq('workspace_id', ws);
  if (res.error) return deny(res.error.message, 400);
  await m.supabase.rpc('log_activity', {
    p_category: 'admin', p_action: 'updated the AI settings', p_target_label: 'Daily assistant',
    p_project: null, p_idea: null, p_event: null, p_quote: null, p_external: false,
  });
  return NextResponse.json({ ok: true });
}
