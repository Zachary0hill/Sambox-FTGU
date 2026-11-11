import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { providerById } from '@/lib/integrations/registry';
import { costOf, priceFor, priceKey, cleanPrice, type Price, type UsageTotals } from '@/lib/ai/pricing';

// Workspace Settings > AI usage. Super Admin only.
// GET ?range=7d|30d|90d|month returns requests, tokens and estimated cost for the range, by day, model, feature and
// member. Rows are read on the member's session (ai_usage_read: Super Admins of the workspace).
// PUT {provider, model, price} saves a price override for one model (price null removes it).

const RANGES: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
const MAX_ROWS = 50000;
const PAGE = 1000;

type Row = {
  user_id: string | null; feature: string; provider: string; model: string; created_at: string; ok: boolean;
  input_tokens: number; cache_read_tokens: number; cache_write_tokens: number; output_tokens: number; reasoning_tokens: number; images: number; cost_usd: number | null;
};

type Bucket = UsageTotals & { requests: number; failed: number; reasoning: number; cost: number; unpriced: number };
const empty = (): Bucket => ({ requests: 0, failed: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0, images: 0, cost: 0, unpriced: 0 });

function add(b: Bucket, r: Row, cost: number | null) {
  b.requests++;
  if (!r.ok) b.failed++;
  b.input += r.input_tokens; b.cacheRead += r.cache_read_tokens; b.cacheWrite += r.cache_write_tokens;
  b.output += r.output_tokens; b.reasoning += r.reasoning_tokens; b.images += r.images;
  if (cost == null) b.unpriced++; else b.cost += cost;
}

function dayKey(iso: string, fmt: Intl.DateTimeFormat) { return fmt.format(new Date(iso)); }

function readOverrides(v: unknown): Record<string, Price> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, Price> = {};
  for (const [k, p] of Object.entries(v as Record<string, unknown>)) { const c = cleanPrice(p); if (c) out[k] = c; }
  return out;
}

export async function GET(request: Request) {
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can see AI usage.');
  const ws = m.ctx.workspace_id;
  const range = new URL(request.url).searchParams.get('range') || '30d';

  const st = await m.supabase.from('workspace_settings').select('*').eq('workspace_id', ws).maybeSingle();
  const settings = (st.data || {}) as Record<string, unknown>;
  let tz = String(settings.timezone || 'America/Chicago');
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); } catch { tz = 'UTC'; }
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const overrides = readOverrides(settings.ai_prices);

  // Day keys for the whole range (oldest first) so quiet days show as zero.
  const today = dayKey(new Date().toISOString(), fmt);
  const days: string[] = [];
  if (range === 'month') {
    const [y, mo] = today.split('-').map(Number);
    for (let d = 1; ; d++) { const k = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'); days.push(k); if (k === today) break; if (d > 31) break; }
  } else {
    const n = RANGES[range] || 30;
    for (let i = n - 1; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86400000).toISOString(), fmt));
  }
  // A day of margin on each side covers the time zone offset; rows are then filtered by their local day.
  const since = new Date(new Date(days[0] + 'T00:00:00Z').getTime() - 86400000).toISOString();
  const first = days[0];

  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await m.supabase.from('ai_usage')
      .select('user_id, feature, provider, model, created_at, ok, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, reasoning_tokens, images, cost_usd')
      .eq('workspace_id', ws).gte('created_at', since).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (error) {
      if (/ai_usage|does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({ ready: false, error: 'AI usage needs the latest database migration (ai_usage). Ask whoever deploys the board to run it.' }, { headers: { 'Cache-Control': 'no-store' } });
      }
      return deny(error.message, 500);
    }
    rows.push(...((data || []) as Row[]));
    if (!data || data.length < PAGE) break;
  }

  const total = empty();
  const byDay = new Map(days.map((d) => [d, empty()]));
  const byModel = new Map<string, Bucket & { provider: string; model: string }>();
  const byFeature = new Map<string, Bucket>();
  const byUser = new Map<string, Bucket>();
  for (const r of rows) {
    const day = dayKey(r.created_at, fmt);
    if (day < first || !byDay.has(day)) continue;
    const { price } = priceFor(r.provider, r.model, overrides);
    // Web searches and scrapers have no tokens to price, so their cost is stored on the row.
    const flatFee = r.cost_usd != null && !r.input_tokens && !r.output_tokens && !r.images;
    const cost = flatFee ? Number(r.cost_usd) : costOf({ input: r.input_tokens, cacheRead: r.cache_read_tokens, cacheWrite: r.cache_write_tokens, output: r.output_tokens, images: r.images }, price);
    add(total, r, cost);
    add(byDay.get(day)!, r, cost);
    const mk = priceKey(r.provider, r.model);
    if (!byModel.has(mk)) byModel.set(mk, { ...empty(), provider: r.provider, model: r.model });
    add(byModel.get(mk)!, r, cost);
    if (!byFeature.has(r.feature)) byFeature.set(r.feature, empty());
    add(byFeature.get(r.feature)!, r, cost);
    const uk = r.user_id || '';
    if (!byUser.has(uk)) byUser.set(uk, empty());
    add(byUser.get(uk)!, r, cost);
  }

  const ids = [...byUser.keys()].filter(Boolean);
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabaseAdmin().from('profiles').select('id, full_name, email').in('id', ids);
    (data || []).forEach((p) => names.set(p.id as string, String(p.full_name || p.email || 'Member')));
  }

  const configured = await m.supabase.from('integrations').select('provider,config').eq('workspace_id',ws).eq('status','connected').in('provider',['anthropic','openai','gemini','xai']);
  const candidates: {provider:string;model:string;image?:boolean}[] = Object.keys(overrides).map(key=>({provider:key.slice(0,key.indexOf(':')),model:key.slice(key.indexOf(':')+1),image:overrides[key].image != null}));
  for(const c of configured.data || []) {
    const def=providerById(c.provider);
    const model=String(c.config?.model || def?.fields.find(x=>x.key==='model')?.defaultValue || '');
    if(model)candidates.push({provider:c.provider,model});
    const images=c.provider==='openai'?['gpt-image-2','gpt-image-1.5','gpt-image-1']:c.provider==='gemini'?['gemini-3.1-flash-image-preview','gemini-2.5-flash-image']:[];
    for(const model of images)candidates.push({provider:c.provider,model,image:true});
  }
  for(const c of candidates) {const key=priceKey(c.provider,c.model);if(!byModel.has(key))byModel.set(key,{...empty(),provider:c.provider,model:c.model});}
  const models = [...byModel.entries()].map(([key, b]) => {
    const { price, source } = priceFor(b.provider, b.model, overrides);
    return { key, ...b, imageModel: candidates.some(c=>c.image && priceKey(c.provider,c.model)===key), providerName: (providerById(b.provider) || { name: b.provider }).name, price, priceSource: source };
  }).sort((a, b) => b.cost - a.cost || b.requests - a.requests);

  return NextResponse.json({
    ready: true, range, timezone: tz, truncated: rows.length >= MAX_ROWS,
    total,
    days: days.map((d) => ({ day: d, ...byDay.get(d)! })),
    models,
    features: [...byFeature.entries()].map(([feature, b]) => ({ feature, ...b })).sort((a, b) => b.cost - a.cost || b.requests - a.requests),
    members: [...byUser.entries()].map(([id, b]) => ({ id, name: id ? names.get(id) || 'Former member' : 'Automations', ...b })).sort((a, b) => b.cost - a.cost || b.requests - a.requests),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can change AI prices.');
  const ws = m.ctx.workspace_id;
  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return deny('Send a JSON object.', 400);
  const b = raw as Record<string, unknown>;
  const provider = typeof b.provider === 'string' ? b.provider.trim() : '';
  const model = typeof b.model === 'string' ? b.model.trim() : '';
  if (!/^[\w-]{1,40}$/.test(provider) || !/^[\w.:/@-]{1,120}$/.test(model)) return deny('Pick a model to price.', 400);
  const price = b.price == null ? null : cleanPrice(b.price);
  if (b.price != null && !price) return deny('Prices must be numbers of 0 or more.', 400);

  const cur = await m.supabase.from('workspace_settings').select('*').eq('workspace_id', ws).maybeSingle();
  const row = (cur.data || {}) as Record<string, unknown>;
  if (!('ai_prices' in row)) return deny('Saving prices needs the latest database migration (ai_usage). Ask whoever deploys the board to run it.', 409);
  const next = readOverrides(row.ai_prices);
  const key = priceKey(provider, model);
  if (price) next[key] = price; else delete next[key];

  const res = await m.supabase.from('workspace_settings').update({ ai_prices: next }).eq('workspace_id', ws);
  if (res.error) return deny(res.error.message, 400);
  await m.supabase.rpc('log_activity', {
    p_category: 'admin', p_action: price ? 'set an AI model price' : 'reset an AI model price', p_target_label: model,
    p_project: null, p_idea: null, p_event: null, p_quote: null, p_external: false,
  });
  return NextResponse.json({ ok: true });
}
