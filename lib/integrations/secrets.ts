import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ProviderId } from './registry';

export type Secret = Record<string, string>;
export type Config = Record<string, unknown>;
export type Connection = { secret: Secret; config: Config };

// The decrypted key and non-secret config for a connected integration, or null when it is not connected.
// Server only: the secret never goes back to the browser.
export async function getIntegration(workspaceId: string, provider: ProviderId): Promise<Connection | null> {
  const admin = supabaseAdmin();
  const [sec, row] = await Promise.all([
    admin.rpc('integration_secret', { p_workspace: workspaceId, p_provider: provider }),
    admin.from('integrations').select('config, status').eq('workspace_id', workspaceId).eq('provider', provider).maybeSingle(),
  ]);
  if (sec.error) throw new Error(sec.error.message);
  if (row.error) throw new Error(row.error.message);
  if (!sec.data || !row.data || row.data.status !== 'connected') return null;
  return { secret: sec.data as Secret, config: (row.data.config || {}) as Config };
}

// Workspaces where this provider is connected. Used by scheduled syncs.
export async function connectedWorkspaces(provider: ProviderId): Promise<string[]> {
  const { data, error } = await supabaseAdmin().from('integrations').select('workspace_id').eq('provider', provider).eq('status', 'connected');
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.workspace_id as string);
}

// Records the outcome of a verify or sync call. `error` null means it worked.
export async function markChecked(workspaceId: string, provider: ProviderId, error: string | null, synced = false) {
  const res = await supabaseAdmin().rpc('mark_integration_checked', {
    p_workspace: workspaceId, p_provider: provider, p_error: error, p_synced: synced,
  });
  if (res.error) console.warn('mark_integration_checked', res.error.message);
}

// Which AI provider the assistant uses: the workspace's choice if connected, else the first connected one.
export async function assistantProvider(workspaceId: string): Promise<ProviderId | null> {
  const admin = supabaseAdmin();
  const [st, rows] = await Promise.all([
    admin.from('workspace_settings').select('ai_provider').eq('workspace_id', workspaceId).maybeSingle(),
    admin.from('integrations').select('provider').eq('workspace_id', workspaceId).eq('status', 'connected').in('provider', ['anthropic', 'openai', 'gemini']).order('sort'),
  ]);
  const live = (rows.data || []).map((r) => r.provider as ProviderId);
  const pick = st.data?.ai_provider as ProviderId | null | undefined;
  return pick && live.includes(pick) ? pick : live[0] || null;
}
