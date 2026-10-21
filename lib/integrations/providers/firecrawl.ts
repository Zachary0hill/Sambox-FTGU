import 'server-only';
import type { ProviderModule } from './types';

// Docs used:
//   https://docs.firecrawl.dev/api-reference/endpoint/search (POST /v2/search, data.web[])
//   https://docs.firecrawl.dev/api-reference/endpoint/scrape (POST /v2/scrape, data.markdown + data.metadata)
//   https://docs.firecrawl.dev/api-reference/endpoint/credit-usage (GET /v2/team/credit-usage, used to verify a key)

export type FirecrawlHit = { url: string; title: string; description: string; markdown?: string };
export type FirecrawlPage = { url: string; title: string; markdown: string };

const API = 'https://api.firecrawl.dev/v2';

async function call(apiKey: string, path: string, body: unknown | null, timeoutMs: number) {
  let res: Response;
  try {
    res = await fetch(API + path, {
      method: body === null ? 'GET' : 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, ...(body === null ? {} : { 'Content-Type': 'application/json' }) },
      body: body === null ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new Error(err instanceof Error && err.name === 'TimeoutError' ? 'Firecrawl took too long to answer.' : 'Could not reach Firecrawl.');
  }
  const j = await res.json().catch(() => null);
  if (res.ok && j && j.success !== false) return j;
  const msg = j && typeof j.error === 'string' ? j.error : '';
  if (res.status === 401) throw new Error('Firecrawl rejected the API key.');
  if (res.status === 402) throw new Error('Firecrawl is out of credits.' + (msg ? ' ' + msg : ''));
  if (res.status === 429) throw new Error('Firecrawl rate limit reached. Try again in a minute.');
  if (res.status === 408) throw new Error('Firecrawl timed out on this request.');
  throw new Error(msg || 'Firecrawl returned HTTP ' + res.status + '.');
}

// Web search. With `scrape`, each hit also carries the page as markdown (costs more credits).
export async function firecrawlSearch(apiKey: string, query: string, opts: { limit?: number; scrape?: boolean } = {}): Promise<FirecrawlHit[]> {
  const q = String(query || '').trim().slice(0, 500);
  if (!q) return [];
  const limit = Math.min(Math.max(Math.round(opts.limit || 5), 1), 20);
  const j = await call(apiKey, '/search', {
    query: q, limit, sources: [{ type: 'web' }], ignoreInvalidURLs: true,
    timeout: opts.scrape ? 60000 : 30000,
    ...(opts.scrape ? { scrapeOptions: { formats: [{ type: 'markdown' }], onlyMainContent: true } } : {}),
  }, opts.scrape ? 75000 : 40000);
  const web: Record<string, unknown>[] = j.data && Array.isArray(j.data.web) ? j.data.web : [];
  return web.filter((w) => typeof w.url === 'string').map((w) => {
    const meta = (w.metadata || {}) as Record<string, unknown>;
    const hit: FirecrawlHit = {
      url: String(w.url),
      title: String(w.title || meta.title || ''),
      description: String(w.description || meta.description || ''),
    };
    if (typeof w.markdown === 'string') hit.markdown = w.markdown;
    return hit;
  });
}

// One page as clean markdown (main content only).
export async function firecrawlScrape(apiKey: string, url: string): Promise<FirecrawlPage> {
  let u: URL;
  try { u = new URL(String(url || '').trim()); } catch { throw new Error('That is not a valid URL.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http and https pages can be read.');
  const j = await call(apiKey, '/scrape', { url: u.toString(), formats: [{ type: 'markdown' }], onlyMainContent: true, timeout: 45000 }, 60000);
  const d = j.data || {};
  const meta = d.metadata || {};
  if (meta.error || (typeof meta.statusCode === 'number' && meta.statusCode >= 400)) {
    throw new Error('The page could not be read' + (meta.statusCode ? ' (HTTP ' + meta.statusCode + ')' : '') + '.');
  }
  return { url: String(meta.url || meta.sourceURL || u.toString()), title: String(meta.title || ''), markdown: String(d.markdown || '') };
}

// Credit usage is a read-only call that needs a valid key. A 404 there means no usage record yet, not a bad key.
const provider: ProviderModule = {
  async verify(secret) {
    const res = await fetch(API + '/team/credit-usage', {
      headers: { Authorization: 'Bearer ' + secret.apiKey }, signal: AbortSignal.timeout(15000),
    });
    if (res.ok || res.status === 404) return null;
    if (res.status === 401 || res.status === 403) return 'The API key was not accepted.';
    const j = await res.json().catch(() => null);
    return (j && typeof j.error === 'string' && j.error) || 'Firecrawl returned HTTP ' + res.status + '.';
  },
};

export default provider;
