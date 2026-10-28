import 'server-only';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { tool, jsonSchema, type ToolSet, type JSONSchema7 } from 'ai';
import type { ProviderModule } from './types';
import type { Config } from '../secrets';

// vidIQ's hosted MCP server: YouTube research and channel analytics without a YouTube API key. Docs used:
//   https://vidiq.com/mcp/                                       (server URL, read-only API keys, 5 credits per research call)
//   https://mcp.vidiq.com/.well-known/oauth-protected-resource   (bearer_methods_supported: header)
// API keys from app.vidiq.com/account/settings/mcp are read-only, so the server rejects write tools for this
// connection anyway. Only the tools in config.tools (or DEFAULT_TOOLS) are offered to the model: each call spends
// vidIQ credits, and all 52 tools would crowd the prompt.

export const VIDIQ_URL = 'https://mcp.vidiq.com/mcp';
export const DEFAULT_TOOLS = ['keyword_research', 'outliers', 'trending_videos', 'subscriber_insights', 'video_transcript', 'generate_titles'];
const PREFIX = 'vidiq_';
const MAX_RESULT = 12000;

const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

// Tool names the workspace picked, else the defaults.
export function vidiqToolNames(config: Config): string[] {
  const picked = String(config.tools || '').split(/[\s,]+/).map((t) => t.trim()).filter((t) => /^[\w.-]{1,64}$/.test(t));
  return picked.length ? Array.from(new Set(picked)) : DEFAULT_TOOLS;
}

function explain(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/^(vidIQ |Could not reach vidIQ)/.test(m)) return m; // already explained
  if (/\b401\b|unauthori[sz]ed|missing authorization|invalid.*(key|token)/i.test(m)) return 'vidIQ rejected the API key. Create a new one at app.vidiq.com/account/settings/mcp.';
  if (/\b402\b|credit/i.test(m)) return 'vidIQ is out of credits for this billing period.';
  if (/\b429\b|rate/i.test(m)) return 'vidIQ is rate limiting requests. Try again in a minute.';
  if (/timeout|timed out|abort/i.test(m)) return 'vidIQ took too long to answer.';
  if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(m)) return 'Could not reach vidIQ.';
  return 'vidIQ returned an error: ' + clip(m, 300);
}

export async function vidiqClient(apiKey: string, timeoutMs = 15000): Promise<MCPClient> {
  try {
    return await createMCPClient({
      transport: { type: 'http', url: VIDIQ_URL, headers: { Authorization: 'Bearer ' + apiKey }, redirect: 'error' },
      clientName: 'ftgu-studio',
      initializationOptions: { timeout: timeoutMs },
    });
  } catch (err) {
    throw new Error(explain(err));
  }
}

// MCP content blocks as one text string. Structured results win over text when the server sends both.
export function resultText(res: { content?: unknown; structuredContent?: unknown }): string {
  if (res.structuredContent && typeof res.structuredContent === 'object') return JSON.stringify(res.structuredContent);
  const blocks = Array.isArray(res.content) ? (res.content as { type?: string; text?: string }[]) : [];
  return blocks.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
}

// Calls one vidIQ tool and returns its text. Throws a readable message on failure.
export async function callVidiq(client: MCPClient, name: string, args: Record<string, unknown>, timeoutMs = 60000): Promise<string> {
  let res;
  try { res = await client.callTool({ name, arguments: args, options: { timeout: timeoutMs } }); }
  catch (err) { throw new Error(explain(err)); }
  const text = resultText(res as { content?: unknown; structuredContent?: unknown });
  if ((res as { isError?: boolean }).isError) throw new Error(explain(new Error(text || 'tool error')));
  return text;
}

// The allowlisted vidIQ tools as assistant tools, named vidiq_<tool>. Results are other people's public YouTube text
// (titles, descriptions, transcripts), so they come back under `untrusted`. The caller closes the client.
export async function vidiqTools(client: MCPClient, config: Config): Promise<ToolSet> {
  const allow = new Set(vidiqToolNames(config));
  const listed = await client.listTools({ options: { timeout: 15000 } });
  const out: ToolSet = {};
  for (const def of listed.tools) {
    if (!allow.has(def.name) || def.annotations?.destructiveHint === true) continue;
    out[PREFIX + def.name] = tool({
      description: clip('vidIQ (YouTube data, costs vidIQ credits): ' + (def.description || def.name), 1000),
      inputSchema: jsonSchema((def.inputSchema || { type: 'object', properties: {} }) as JSONSchema7),
      execute: async (args) => {
        try {
          return { source: 'vidIQ', untrusted: clip(await callVidiq(client, def.name, (args || {}) as Record<string, unknown>), MAX_RESULT) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'vidIQ call failed.' };
        }
      },
    });
  }
  return out;
}

const provider: ProviderModule = {
  // Connects and lists tools (free, no credits). Fails when none of the picked tool names exist, listing the real ones.
  async verify(secret, config) {
    let client: MCPClient | null = null;
    try {
      client = await vidiqClient(secret.apiKey);
      const names = (await client.listTools({ options: { timeout: 15000 } })).tools.map((t) => t.name);
      const picked = vidiqToolNames(config);
      const unknown = picked.filter((n) => !names.includes(n));
      if (unknown.length === picked.length) return 'None of these tools exist on vidIQ: ' + unknown.join(', ') + '. Available: ' + clip(names.join(', '), 600);
      return null;
    } catch (err) {
      return explain(err);
    } finally {
      await client?.close().catch(() => {});
    }
  },
};

export default provider;
