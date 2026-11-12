import 'server-only';
import type { LanguageModelUsage } from 'ai';
import { usageRow } from './usage';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cleanPrice, costOf, priceFor, type Price } from '@/lib/ai/pricing';

// Spend guard for research: what a step will cost, whether it is allowed, and what today has cost so far. Costs are
// estimates. Admission reserves each call before contacting a provider.
// Unknown prices fail closed; estimates are not a promise about provider billing.
export type Caps = { run_cost_cap_usd: number; daily_cost_cap_usd: number };

export async function priceOverrides(workspaceId: string): Promise<Record<string, Price>> {
  const { data } = await supabaseAdmin().from('workspace_settings').select('ai_prices').eq('workspace_id', workspaceId).maybeSingle();
  const out: Record<string, Price> = {};
  for (const [k, v] of Object.entries((data?.ai_prices || {}) as Record<string, unknown>)) {
    const price = cleanPrice(v);
    if (price) out[k] = price;
  }
  return out;
}

export function modelCostUsd(provider: string, model: string, tokens: { input: number; output: number }, overrides: Record<string, Price>): number {
  const { price } = priceFor(provider, model, overrides);
  const usage = { input: tokens.input, cacheRead: 0, cacheWrite: 0, output: tokens.output, images: 0 };
  if (!price || price.in == null || price.out == null) throw new Error('Set input and output prices for ' + provider + ':' + model + ' in AI usage before running research.');
  return costOf(usage, price)!;
}

export async function spentTodayUsd(workspaceId: string): Promise<number> {
  const midnight = new Date(); midnight.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabaseAdmin().from('ai_usage').select('cost_usd').eq('workspace_id', workspaceId)
    .gte('created_at', midnight.toISOString()).not('cost_usd', 'is', null).limit(20000);
  if (error) throw new Error('Could not check today\'s research spend.');
  return (data || []).reduce((sum, r) => sum + Number(r.cost_usd || 0), 0);
}

// Null when the step may run, otherwise the reason it may not.
export async function refuseSpend(workspaceId: string, caps: Caps, nextUsd: number, spentThisRunUsd: number): Promise<string | null> {
  if (spentThisRunUsd + nextUsd > caps.run_cost_cap_usd) return 'This run would pass the $' + caps.run_cost_cap_usd.toFixed(2) + ' per-run limit in Rules.';
  if ((await spentTodayUsd(workspaceId)) + nextUsd > caps.daily_cost_cap_usd) return 'Today\'s research spend has reached the $' + caps.daily_cost_cap_usd.toFixed(2) + ' daily limit in Rules.';
  return null;
}

// Reserve before every paid attempt, including fallbacks. A timeout keeps the reservation counted.
export async function reserveSpend(workspaceId: string, runId: string, caps: Caps, provider: string, model: string, usd: number) {
  const { data, error } = await supabaseAdmin().rpc('reserve_research_spend', {
    p_ws: workspaceId, p_run: runId, p_provider: provider, p_model: model, p_usd: usd,
    p_run_cap: caps.run_cost_cap_usd, p_day_cap: caps.daily_cost_cap_usd,
  });
  if (error || !data) throw new Error(error?.message || 'Could not reserve research budget.');
  return async (actualUsd: number) => {
    const settled = await supabaseAdmin().from('research_spend').update({ charged_usd: actualUsd, settled_at: new Date().toISOString() }).eq('id', data);
    if (settled.error) throw new Error('Could not record research cost; the reservation remains counted.');
  };
}
// UTF-8 bytes are a conservative input token allowance; include structured-output/instruction overhead.
export function modelAllowance(provider: string, model: string, text: string, output: number, prices: Record<string, Price>) {
  const { price } = priceFor(provider, model, prices);
  if (!price || price.in == null || price.out == null) throw new Error('Set input and output prices for ' + provider + ':' + model + ' in AI usage before running research.');
  return ((Buffer.byteLength(text, 'utf8') + 4096) * Math.max(price.in, price.cacheWrite || 0) + output * price.out) / 1000000;
}

export function modelUsageCost(provider: string, model: string, usage: LanguageModelUsage, overrides: Record<string, Price>) {
  const row = usageRow({ workspaceId: '', feature: 'research', provider, model, usage });
  const { price } = priceFor(provider, model, overrides);
  if (!price || price.in == null || price.out == null) throw new Error('Set this model’s input and output prices in AI usage.');
  return costOf({ input: row.input_tokens, output: row.output_tokens, cacheRead: row.cache_read_tokens, cacheWrite: row.cache_write_tokens, images: 0 }, price)!;
}
