import { NextResponse } from 'next/server';
import { getMember, deny } from '@/lib/integrations/auth';

// Link previews for reference URLs on ideas: title, site, author and a thumbnail. Video sites answer through their
// oEmbed endpoints (no keys); everything else comes from the page's Open Graph tags. Previews are public metadata,
// so one in-memory cache serves every workspace for six hours.
export const maxDuration = 30;

export type Preview = { url: string; kind: 'video' | 'image' | 'doc' | 'link'; site: string; title: string; description: string; image: string; author: string };

const TTL = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; p: Preview | null }>();
const UA = 'Mozilla/5.0 (compatible; FTGU-Studio/1.0; +https://ftgu.studio) link-preview';

const blockedHost = (h: string) => /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(h) || /^\[?[0-9a-f:.]+\]?$/i.test(h);

function cleanUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:' || blockedHost(u.hostname) || u.username || u.password) return null;
    return u;
  } catch { return null; }
}

async function get(url: string, accept: string, maxBytes: number): Promise<{ status: number; type: string; text: string } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept, 'accept-language': 'en' }, redirect: 'follow', signal: ctrl.signal });
    const type = res.headers.get('content-type') || '';
    const reader = res.body?.getReader();
    if (!reader) return { status: res.status, type, text: '' };
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value); size += value.length;
      if (size >= maxBytes) { reader.cancel().catch(() => {}); break; }
    }
    return { status: res.status, type, text: new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks)) };
  } catch { return null; } finally { clearTimeout(t); }
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'", apos: "'", nbsp: ' ' };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|#x27|apos|nbsp);/g, (_, k: string) => ENT[k] || _)
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();

// First <meta> whose property or name is one of `keys`, in page order of the keys given.
function meta(html: string, keys: string[]): string {
  for (const k of keys) {
    const re = new RegExp('<meta\\s+[^>]*?(?:property|name)\\s*=\\s*["\']' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\'][^>]*>', 'i');
    const tag = html.match(re);
    if (!tag) continue;
    const c = tag[0].match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const v = c ? decode(c[1] ?? c[2] ?? '') : '';
    if (v) return v;
  }
  return '';
}

const absolute = (src: string, base: string) => { try { return src ? new URL(src, base).href : ''; } catch { return ''; } };

async function oembed(endpoint: string, u: URL, site: string): Promise<Preview | null> {
  const r = await get(endpoint + encodeURIComponent(u.href), 'application/json', 64 * 1024);
  if (!r || r.status !== 200) return null;
  try {
    const j = JSON.parse(r.text) as Record<string, unknown>;
    const s = (k: string) => (typeof j[k] === 'string' ? (j[k] as string).trim() : '');
    return { url: u.href, kind: 'video', site, title: s('title'), description: '', image: s('thumbnail_url'), author: s('author_name') };
  } catch { return null; }
}

const YT = /(^|\.)youtube\.com$|^youtu\.be$/i, TT = /(^|\.)tiktok\.com$/i, VM = /(^|\.)vimeo\.com$/i;

async function unfurl(u: URL): Promise<Preview | null> {
  const h = u.hostname.replace(/^www\./, '');
  if (YT.test(h)) return oembed('https://www.youtube.com/oembed?format=json&url=', u, 'YouTube');
  if (TT.test(h)) return oembed('https://www.tiktok.com/oembed?url=', u, 'TikTok');
  if (VM.test(h)) return oembed('https://vimeo.com/api/oembed.json?url=', u, 'Vimeo');
  const r = await get(u.href, 'text/html,application/xhtml+xml', 512 * 1024);
  if (!r || r.status >= 400 || !/html/i.test(r.type)) return null;
  const html = r.text;
  const title = meta(html, ['og:title', 'twitter:title']) || decode((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [, ''])[1] || '');
  const image = absolute(meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']), u.href);
  const type = meta(html, ['og:type']).toLowerCase();
  const video = /^video/.test(type) || !!meta(html, ['og:video', 'og:video:url', 'twitter:player']);
  return {
    url: u.href, kind: video ? 'video' : /^article|^website/.test(type) || !image ? 'link' : 'image', site: meta(html, ['og:site_name']) || h,
    title: title.slice(0, 200), description: meta(html, ['og:description', 'description', 'twitter:description']).slice(0, 300), image, author: meta(html, ['author', 'article:author', 'twitter:creator']).slice(0, 80),
  };
}

// Any signed-in member: previews for up to 20 URLs, keyed by the URL as sent. Missing keys had nothing usable.
export async function POST(request: Request) {
  const m = await getMember();
  if (!m) return deny('Sign in to load previews.', 401);
  const body = await request.json().catch(() => ({}));
  const urls: unknown[] = Array.isArray(body?.urls) ? body.urls.slice(0, 20) : [];
  const now = Date.now();
  const out: Record<string, Preview> = {};
  await Promise.all(urls.map(async (raw) => {
    const u = cleanUrl(raw);
    if (!u) return;
    const key = u.href;
    let hit = cache.get(key);
    if (!hit || now - hit.at > TTL) {
      hit = { at: now, p: await unfurl(u).catch(() => null) };
      cache.set(key, hit);
      if (cache.size > 5000) cache.delete(cache.keys().next().value as string);
    }
    if (hit.p && (hit.p.title || hit.p.image)) out[String(raw).trim()] = hit.p;
  }));
  return NextResponse.json({ previews: out });
}
