import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AI_PROVIDERS, providerById, type ProviderId } from '@/lib/integrations/registry';

// Daily assistant preferences a Super Admin sets in AI settings, kept in workspace_settings.assistant (jsonb).
// mode: the default answer style for new chats ('fast' answers right away, 'think' reasons first and shows it).
// instructions: extra guidance added to the system prompt for every member.
export type AssistantMode = 'fast' | 'think';
export type AssistantPrefs = { mode: AssistantMode; instructions: string };

export const MAX_INSTRUCTIONS = 4000;

export function readPrefs(settings: Record<string, unknown> | null | undefined): AssistantPrefs {
  const a = (settings && typeof settings.assistant === 'object' && settings.assistant) || {};
  const o = a as Record<string, unknown>;
  return {
    mode: o.mode === 'think' ? 'think' : 'fast',
    instructions: typeof o.instructions === 'string' ? o.instructions.slice(0, MAX_INSTRUCTIONS) : '',
  };
}

export type AiProviderState = {
  id: ProviderId; name: string; connected: boolean; model: string; keyHint: string | null; keyUrl: string; error: string | null;
};

// Every AI provider with its connection state and saved model. Never includes a key.
export async function aiProviders(workspaceId: string): Promise<AiProviderState[]> {
  const { data } = await supabaseAdmin().from('integrations').select('provider, status, config, last_error')
    .eq('workspace_id', workspaceId).in('provider', AI_PROVIDERS);
  const rows = new Map((data || []).map((r) => [r.provider as string, r]));
  return AI_PROVIDERS.map((id) => {
    const def = providerById(id)!;
    const r = rows.get(id);
    const cfg = ((r && r.config) || {}) as Record<string, unknown>;
    const fallback = def.fields.find((f) => f.key === 'model')?.defaultValue || '';
    return {
      id, name: def.name, connected: !!r && r.status === 'connected', model: String(cfg.model || '') || fallback,
      keyHint: typeof cfg.keyHint === 'string' ? cfg.keyHint : null, keyUrl: def.keyUrl || def.docs || '', error: (r && r.last_error) || null,
    };
  });
}
