// Estimated AI prices in USD. Text models: per 1M tokens (in = uncached input, cacheRead / cacheWrite = prompt cache,
// out = output, reasoning included). Image models: per image. Used by the AI usage page to turn logged tokens into a
// cost estimate. A Super Admin can override any model on that page (workspace_settings.ai_prices), which wins over
// these defaults. Models with no default and no override show as "no price set" rather than a made-up number.
//
// Claude list prices are Anthropic's first-party API rates (cached 2026-10-06). Cache writes are priced at 1.25x input
// (5 minute cache). Prices for other providers change often, so they are left for the Super Admin to fill in from
// the provider's pricing page.

export type Price = { in?: number; out?: number; cacheRead?: number; cacheWrite?: number; image?: number };
export type PriceSource = 'default' | 'custom' | 'none';

const claude = (inp: number, out: number, cacheRead = inp * 0.1): Price => ({ in: inp, out, cacheRead, cacheWrite: inp * 1.25 });

// Longest matching prefix wins, so dated or suffixed IDs (claude-sonnet-4-6-20260101) still match.
const DEFAULTS: Record<string, Price> = {
  'anthropic:claude-fable-5-1': claude(10, 50, 0.25),
  'anthropic:claude-fable-5': claude(10, 50),
  'anthropic:claude-mythos-5-1': claude(10, 50, 0.25),
  'anthropic:claude-opus-5-5': claude(4, 20, 0.2),
  'anthropic:claude-opus-5': claude(5, 25),
  'anthropic:claude-opus-4-8': claude(5, 25),
  'anthropic:claude-opus-4-7': claude(5, 25),
  'anthropic:claude-opus-4-6': claude(5, 25),
  'anthropic:claude-sonnet-5-5': claude(2, 10, 0.2),
  'anthropic:claude-sonnet-5': claude(2, 10),
  'anthropic:claude-sonnet-4-6': claude(3, 15),
  'anthropic:claude-haiku-5-5': claude(0.1, 0.5),
  'anthropic:claude-haiku-4-5': claude(1, 5),
};

export const priceKey = (provider: string, model: string) => provider + ':' + model;

function lookup(table: Record<string, Price>, key: string): Price | null {
  if (table[key]) return table[key];
  let best = '';
  for (const k of Object.keys(table)) if (key.startsWith(k + '-') && k.length > best.length) best = k;
  return best ? table[best] : null;
}

export function priceFor(provider: string, model: string, overrides: Record<string, Price> = {}): { price: Price | null; source: PriceSource } {
  const key = priceKey(provider, model);
  if (overrides[key]) return { price: overrides[key], source: 'custom' };
  const d = lookup(DEFAULTS, key);
  return d ? { price: d, source: 'default' } : { price: null, source: 'none' };
}

export type UsageTotals = { input: number; cacheRead: number; cacheWrite: number; output: number; images: number };

// Null when the model has no price, so totals can say "plus N calls without a price" instead of undercounting silently.
export function costOf(u: UsageTotals, price: Price | null): number | null {
  if (!price) return null;
  const tokens = u.input + u.cacheRead + u.cacheWrite + u.output;
  const textPriced = price.in != null || price.out != null;
  if (tokens && !textPriced) return null;
  if (u.images && price.image == null) return null;
  const m = 1_000_000;
  return (u.input * (price.in || 0)) / m
    + (u.cacheRead * (price.cacheRead ?? price.in ?? 0)) / m
    + (u.cacheWrite * (price.cacheWrite ?? price.in ?? 0)) / m
    + (u.output * (price.out || 0)) / m
    + u.images * (price.image || 0);
}

// Cleans a price object from the request body: finite, non-negative numbers only, capped to stay sane.
export function cleanPrice(raw: unknown): Price | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Price = {};
  for (const k of ['in', 'out', 'cacheRead', 'cacheWrite', 'image'] as const) {
    if (o[k] === '' || o[k] == null) continue;
    const n = Number(o[k]);
    if (!Number.isFinite(n) || n < 0 || n > 10000) return null;
    out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}
