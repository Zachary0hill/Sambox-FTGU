import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cleanPrice, costOf, priceFor, type Price } from '@/lib/ai/pricing';

// Spend guard for research: what a step will cost, whether it is allowed, and what today has cost so far. Costs are
// estimates. A model with no price set is charged at a high default, so a missing price can never slip past the caps.
const UNPRICED: Price = { in: 3, out: 15, cacheRead: 3, cacheWrite: 3 };
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
  return costOf(usage, price) ?? costOf(usage, UNPRICED) ?? 0;
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
