import 'server-only';
import type { LanguageModelUsage } from 'ai';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Logs one AI model call to public.ai_usage for the AI usage page. Never throws and never blocks a reply: a missing
// table (migration 20261106000600 not run yet) or a failed insert is only warned about.

export type UsageFeature = 'assistant' | 'research' | 'cover' | 'script' | 'other';

export type UsageEntry = {
  workspaceId: string;
  userId?: string | null;
  feature: UsageFeature;
  provider: string;
  model: string;
  usage?: Partial<LanguageModelUsage> | null;
  images?: number;
  ok?: boolean;
};

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

export function usageRow(e: UsageEntry) {
  const u = e.usage || {};
  const cacheRead = n(u.inputTokenDetails?.cacheReadTokens);
  const cacheWrite = n(u.inputTokenDetails?.cacheWriteTokens);
  const noCache = u.inputTokenDetails?.noCacheTokens;
  // inputTokens includes cache reads and writes; store the uncached part so each column is priced once.
  const input = noCache != null ? n(noCache) : Math.max(0, n(u.inputTokens) - cacheRead - cacheWrite);
  return {
    workspace_id: e.workspaceId,
    user_id: e.userId || null,
    feature: e.feature,
    provider: e.provider.slice(0, 40),
    model: (e.model || 'unknown').slice(0, 120),
    input_tokens: input,
    cache_read_tokens: cacheRead,
    cache_write_tokens: cacheWrite,
    output_tokens: n(u.outputTokens),
    reasoning_tokens: n(u.outputTokenDetails?.reasoningTokens),
    images: n(e.images),
    ok: e.ok !== false,
  };
}

export async function recordUsage(e: UsageEntry): Promise<void> {
  try {
    const row = usageRow(e);
    // A failed call that billed nothing is not worth a row.
    if (!row.ok && !row.input_tokens && !row.output_tokens && !row.cache_read_tokens && !row.images) return;
    const { error } = await supabaseAdmin().from('ai_usage').insert(row);
    if (error) console.warn('ai usage', error.message);
  } catch (err) {
    console.warn('ai usage', err instanceof Error ? err.message : err);
  }
}
