import 'server-only';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogle } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { getIntegration, assistantProvider } from '@/lib/integrations/secrets';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { providerById, type ProviderId } from '@/lib/integrations/registry';

export type WorkspaceModel = { provider: ProviderId; modelId: string; model: LanguageModel };

const AI: ProviderId[] = ['anthropic', 'openai', 'gemini', 'xai'];
const defaultModel = (id: ProviderId) => providerById(id)?.fields.find((f) => f.key === 'model')?.defaultValue || '';

// The language model the workspace's assistant and research agent use, built from the Super Admin's key.
// Null when no AI provider is connected. `modelId` picks another model on the same key (the Daily model picker).
export async function workspaceModel(workspaceId: string, prefer?: ProviderId, modelId?: string): Promise<WorkspaceModel | null> {
  const provider = prefer || (await assistantProvider(workspaceId));
  if (!provider) return null;
  const conn = await getIntegration(workspaceId, provider);
  if (!conn) return null;
  return buildModel(provider, conn.secret.apiKey, modelId || String(conn.config.model || '') || defaultModel(provider));
}

// Every connected AI provider's model, the workspace default first. Used to fall back when the default is out of
// credits or rejects its key.
export async function workspaceModels(workspaceId: string, prefer?: ProviderId): Promise<WorkspaceModel[]> {
  const first = prefer || (await assistantProvider(workspaceId));
  const { data } = await supabaseAdmin().from('integrations').select('provider').eq('workspace_id', workspaceId).eq('status', 'connected').in('provider', AI).order('sort');
  const order = [first, ...(data || []).map((r) => r.provider as ProviderId)].filter((p, i, a): p is ProviderId => !!p && a.indexOf(p) === i);
  const out: WorkspaceModel[] = [];
  for (const p of order) {
    const conn = await getIntegration(workspaceId, p).catch(() => null);
    const m = conn && buildModel(p, conn.secret.apiKey, String(conn.config.model || '') || defaultModel(p));
    if (m) out.push(m);
  }
  return out;
}

// True for errors another provider could get past: no credits, a rejected key, rate limits, provider outages.
// Bad prompts, schema failures and timeouts are not retried elsewhere.
export function providerDown(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number; message?: string; cause?: unknown; lastError?: unknown } | null;
  if (!e) return false;
  if (e.lastError && providerDown(e.lastError)) return true;
  if (e.cause && e.cause !== err && providerDown(e.cause)) return true;
  const code = Number(e.statusCode || e.status || 0);
  if ([401, 402, 403, 429, 500, 502, 503, 529].includes(code)) return true;
  return /insufficient[_ ]quota|quota|billing|credit|balance|exceeded your current|invalid.*(api[_ ]?key|x-api-key)|incorrect api key|unauthori[sz]ed|authentication|rate.?limit|overloaded|service unavailable/i.test(String(e.message || ''));
}

export type Fallback<T> = { result: T; used: WorkspaceModel; skipped: { provider: ProviderId; error: string }[] };

// Runs `fn` on each model in turn until one succeeds. Only provider-side failures move on to the next model.
export async function withFallback<T>(models: WorkspaceModel[], fn: (m: WorkspaceModel) => Promise<T>): Promise<Fallback<T>> {
  const skipped: Fallback<T>['skipped'] = [];
  for (let i = 0; i < models.length; i++) {
    try {
      return { result: await fn(models[i]), used: models[i], skipped };
    } catch (err) {
      if (i === models.length - 1 || !providerDown(err)) throw err;
      skipped.push({ provider: models[i].provider, error: (err instanceof Error ? err.message : String(err)).slice(0, 200) });
    }
  }
  throw new Error('No AI model is connected.');
}

export const providerName = (id: ProviderId) => (providerById(id) || { name: id }).name;

export function buildModel(provider: ProviderId, apiKey: string, modelId: string): WorkspaceModel | null {
  if (provider === 'xai') return { provider, modelId, model: createOpenAI({ apiKey, baseURL: 'https://api.x.ai/v1', name: 'xai' }).chat(modelId) };
  if (provider === 'anthropic') return { provider, modelId, model: createAnthropic({ apiKey })(modelId) };
  if (provider === 'openai') return { provider, modelId, model: createOpenAI({ apiKey })(modelId) };
  if (provider === 'gemini') return { provider, modelId, model: createGoogle({ apiKey })(modelId) };
  return null;
}
