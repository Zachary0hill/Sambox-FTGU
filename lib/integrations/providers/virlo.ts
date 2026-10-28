import 'server-only';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { tool, jsonSchema, type ToolSet, type JSONSchema7 } from 'ai';
import type { ProviderModule } from './types';
import type { Config } from '../secrets';
import { resultText } from './vidiq';

// Virlo: short-form video intelligence for TikTok, YouTube Shorts and Instagram Reels. Docs used:
//   https://dev.virlo.ai/docs/quickstart.md   (base URL, bearer key virlo_tkn_..., GET /v1/account/balance is free)
//   https://dev.virlo.ai/docs/raw.md          (GET /v1/raw/:platform/search?q=, $0.01 per call, one normalized video schema)
//   https://dev.virlo.ai/docs/mcp.md          (MCP server, 68 tools, $0.01 to $2.50 per call, connecting is free)
// The research agent uses the REST raw search. The assistant gets allowlisted MCP tools as virlo_*. Tools that create,
// change or delete things on the Virlo account (agents, tracking, settings) are never offered, whatever the config says.

export const VIRLO_API = 'https://api.virlo.ai/v1';
export const VIRLO_MCP_URL = 'https://dev.virlo.ai/api/mcp/mcp';
export const DEFAULT_TOOLS = ['get_trends_digest', 'get_trending_videos', 'get_content_trends', 'get_trending_hooks', 'search_hashtags', 'get_trending_sounds', 'raw_search', 'raw_transcript'];
const BLOCKED = /^(create_|update_|delete_|set_|review_|track_|untrack_|collect_|refresh_|build_)|^(search_keywords|batch_lookup_creators)$/;
const PREFIX = 'virlo_';
const MAX_RESULT = 12000;

export type VirloPlatform = 'tiktok' | 'youtube' | 'instagram';
export type VirloVideo = {
  id?: string; platform?: string; url?: string; caption?: string | null; published_at?: string | null;
  author?: { handle?: string | null; display_name?: string | null };
  stats?: { views?: number | null; likes?: number | null; comments?: number | null; shares?: number | null };
};

const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

// Tool names the workspace picked (minus blocked ones), else the defaults.
export function virloToolNames(config: Config): string[] {
  const picked = String(config.tools || '').split(/[\s,]+/).map((t) => t.trim()).filter((t) => /^[\w.-]{1,64}$/.test(t) && !BLOCKED.test(t));
  return picked.length ? Array.from(new Set(picked)) : DEFAULT_TOOLS;
}

function explain(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/^(Virlo |Could not reach Virlo)/.test(m)) return m; // already explained
  if (/\b401\b|unauthori[sz]ed|invalid_api_key|invalid or inactive api key|missing authorization/i.test(m)) return 'Virlo rejected the API key. Create a new one at dev.virlo.ai/dashboard/api-keys.';
  if (/\b402\b|insufficient_credits|balance/i.test(m)) return 'Virlo balance is too low. Add funds at dev.virlo.ai/dashboard/billing.';
  if (/\b429\b|rate/i.test(m)) return 'Virlo is rate limiting requests. Try again in a minute.';
  if (/timeout|timed out|abort/i.test(m)) return 'Virlo took too long to answer.';
  if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(m)) return 'Could not reach Virlo.';
  return 'Virlo returned an error: ' + clip(m, 300);
}

async function get(apiKey: string, path: string, timeoutMs: number) {
  let res: Response;
  try {
    res = await fetch(VIRLO_API + path, { headers: { Authorization: 'Bearer ' + apiKey }, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new Error(err instanceof Error && err.name === 'TimeoutError' ? 'Virlo took too long to answer.' : 'Could not reach Virlo.');
  }
  const j = await res.json().catch(() => null);
  if (res.ok && j) return j;
  const e = j && typeof j.error === 'object' && j.error ? j.error : j || {};
  const msg = [e.code, e.message].filter((x) => typeof x === 'string').join(': ');
  throw new Error(explain(new Error(res.status + ' ' + (msg || 'HTTP error'))));
}

// Live keyword search on one platform, first page only ($0.01, charged even when empty). Shorts and Reels only.
export async function virloSearch(apiKey: string, platform: VirloPlatform, query: string, timeoutMs = 30000): Promise<VirloVideo[]> {
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return [];
  const j = await get(apiKey, '/raw/' + platform + '/search?q=' + encodeURIComponent(q), timeoutMs);
  return Array.isArray(j.data) ? (j.data as VirloVideo[]) : [];
}

export async function virloClient(apiKey: string, timeoutMs = 15000): Promise<MCPClient> {
  try {
    return await createMCPClient({
      transport: { type: 'http', url: VIRLO_MCP_URL, headers: { Authorization: 'Bearer ' + apiKey }, redirect: 'error' },
      clientName: 'ftgu-studio',
      initializationOptions: { timeout: timeoutMs },
    });
  } catch (err) {
    throw new Error(explain(err));
  }
}

// Virlo reports tool errors as normal replies with the error text inside, so isError and the text both count.
async function callVirlo(client: MCPClient, name: string, args: Record<string, unknown>, timeoutMs = 60000): Promise<string> {
  let res;
  try { res = await client.callTool({ name, arguments: args, options: { timeout: timeoutMs } }); }
  catch (err) { throw new Error(explain(err)); }
  const text = resultText(res as { content?: unknown; structuredContent?: unknown });
  if ((res as { isError?: boolean }).isError) throw new Error(explain(new Error(text || 'tool error')));
  return text;
}

// The allowlisted Virlo tools as assistant tools, named virlo_<tool>. Results are other people's public posts
// (captions, comments, transcripts), so they come back under `untrusted`. The caller closes the client.
export async function virloTools(client: MCPClient, config: Config): Promise<ToolSet> {
  const allow = new Set(virloToolNames(config));
  const listed = await client.listTools({ options: { timeout: 15000 } });
  const out: ToolSet = {};
  for (const def of listed.tools) {
    if (!allow.has(def.name) || BLOCKED.test(def.name) || def.annotations?.destructiveHint === true) continue;
    out[PREFIX + def.name] = tool({
      description: clip('Virlo (short-form video data, costs Virlo balance): ' + (def.description || def.name), 1000),
      inputSchema: jsonSchema((def.inputSchema || { type: 'object', properties: {} }) as JSONSchema7),
      execute: async (args) => {
        try {
          return { source: 'Virlo', untrusted: clip(await callVirlo(client, def.name, (args || {}) as Record<string, unknown>), MAX_RESULT) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Virlo call failed.' };
        }
      },
    });
  }
  return out;
}

const provider: ProviderModule = {
  // The free balance check proves the key (the MCP server only checks its prefix), then the tool list is read so a
  // config naming no real tools fails with the real names.
  async verify(secret, config) {
    if (!/^virlo_tkn_/.test(String(secret.apiKey || ''))) return 'Virlo API keys start with virlo_tkn_.';
    let client: MCPClient | null = null;
    try {
      await get(secret.apiKey, '/account/balance', 15000);
      if (!String(config.tools || '').trim()) return null;
      client = await virloClient(secret.apiKey);
      const names = (await client.listTools({ options: { timeout: 15000 } })).tools.map((t) => t.name);
      const picked = virloToolNames(config);
      if (picked.every((n) => !names.includes(n))) return 'None of these tools exist on Virlo: ' + picked.join(', ') + '. Available: ' + clip(names.filter((n) => !BLOCKED.test(n)).join(', '), 600);
      return null;
    } catch (err) {
      return explain(err);
    } finally {
      await client?.close().catch(() => {});
    }
  },
};

export default provider;
