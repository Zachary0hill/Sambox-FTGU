import 'server-only';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogle } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { getIntegration, assistantProvider } from '@/lib/integrations/secrets';
import { providerById, type ProviderId } from '@/lib/integrations/registry';

export type WorkspaceModel = { provider: ProviderId; modelId: string; model: LanguageModel };

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

export function buildModel(provider: ProviderId, apiKey: string, modelId: string): WorkspaceModel | null {
  if (provider === 'anthropic') return { provider, modelId, model: createAnthropic({ apiKey })(modelId) };
  if (provider === 'openai') return { provider, modelId, model: createOpenAI({ apiKey })(modelId) };
  if (provider === 'gemini') return { provider, modelId, model: createGoogle({ apiKey })(modelId) };
  return null;
}
