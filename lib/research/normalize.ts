// Turns raw items from each source into one Finding shape, and dedupes them. Pure functions, no I/O.
import type { SourceId } from './catalog';

export type Finding = {
  id: string;
  source: SourceId;
  topic: string;
  title: string;
  url: string;
  snippet?: string;
  author?: string;
  views?: number;
  likes?: number;
  comments?: number;
  upvotes?: number;
  date?: string;
};

type Raw = Record<string, unknown>;
type Draft = Omit<Finding, 'id'>;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return undefined;
  const m = v.replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return undefined;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase() as 'K' | 'M' | 'B'] || 1;
  const n = parseFloat(m[1]) * mult;
  return Number.isFinite(n) ? Math.round(n) : undefined;
};
const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);
const get = (o: Raw, path: string): unknown => {
  if (path in o) return o[path];
  return path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Raw)[k] : undefined), o);
};
const firstLine = (t: string) => t.split('\n').map((x) => x.trim()).find(Boolean) || '';

// streamers/youtube-scraper dataset items
export function fromYoutube(items: Raw[], topic: string): Draft[] {
  return items.map((i) => ({
    source: 'youtube' as const, topic, title: str(i.title), url: str(i.url),
    snippet: clip(str(i.text), 240) || undefined, author: str(i.channelName) || undefined,
    views: num(i.viewCount), likes: num(i.likes), comments: num(i.commentsCount), date: str(i.date) || undefined,
  }));
}

// clockworks/tiktok-scraper dataset items (nested or dot-flattened keys)
export function fromTiktok(items: Raw[], topic: string): Draft[] {
  return items.map((i) => {
    const text = str(i.text);
    return {
      source: 'tiktok' as const, topic, title: clip(firstLine(text), 140), url: str(i.webVideoUrl),
      snippet: text.length > 140 ? clip(text, 240) : undefined, author: str(get(i, 'authorMeta.name')) || undefined,
      views: num(i.playCount), likes: num(i.diggCount), comments: num(i.commentCount), date: str(i.createTimeISO) || undefined,
    };
  });
}

// trudax/reddit-scraper-lite dataset items; only posts
export function fromReddit(items: Raw[], topic: string): Draft[] {
  return items.filter((i) => !i.dataType || i.dataType === 'post').map((i) => ({
    source: 'reddit' as const, topic, title: str(i.title), url: str(i.url),
    snippet: clip(str(i.body), 240) || undefined, author: str(i.communityName) || undefined,
    upvotes: num(i.upVotes), comments: num(i.numberOfComments), date: str(i.createdAt) || undefined,
  }));
}

// apify/google-search-scraper: one item per results page, organic results inside
export function fromGoogle(items: Raw[], topicOf: (term: string) => string): Draft[] {
  const out: Draft[] = [];
  items.forEach((page) => {
    const term = str(get(page, 'searchQuery.term'));
    const organic = Array.isArray(page.organicResults) ? (page.organicResults as Raw[]) : [];
    organic.forEach((r) => out.push({
      source: 'google', topic: topicOf(term), title: str(r.title), url: str(r.url), snippet: clip(str(r.description), 240) || undefined,
    }));
  });
  return out;
}

// Video entries pulled from a YouTube results page (ytInitialData videoRenderer objects)
export function fromYoutubePage(items: Raw[], topic: string): Draft[] {
  return items.map((i) => ({
    source: 'youtube_browser' as const, topic, title: str(i.title), url: str(i.url),
    author: str(i.channel) || undefined, views: num(i.views), date: str(i.published) || undefined,
  }));
}

// Firecrawl search hits
export function fromWeb(items: { url: string; title: string; description: string; markdown?: string }[], topic: string): Draft[] {
  return items.map((i) => ({
    source: 'web' as const, topic, title: str(i.title) || str(i.url), url: str(i.url),
    snippet: clip(str(i.description) || str(i.markdown).replace(/\s+/g, ' '), 300) || undefined,
  }));
}

// vidIQ outliers results. The MCP tool returns JSON as text with no published schema, so this walks the result for
// objects that look like videos (a title plus a video ID or watch URL) and reads the common count field names.
export function fromVidiq(text: string, topic: string): Draft[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return []; }
  const out: Draft[] = [];
  const seen = new Set<string>();
  const pick = (o: Raw, ...keys: string[]) => keys.map((k) => get(o, k)).find((v) => v != null && v !== '');
  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 8 || out.length >= 50) return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
    const o = node as Raw;
    const title = str(pick(o, 'title', 'videoTitle', 'video_title', 'name'));
    const id = str(pick(o, 'videoId', 'video_id', 'id'));
    const link = str(pick(o, 'url', 'link', 'videoUrl', 'video_url'));
    const url = /youtu\.?be/.test(link) ? link : /^[\w-]{11}$/.test(id) ? 'https://www.youtube.com/watch?v=' + id : '';
    if (title && url) {
      if (!seen.has(url)) {
        seen.add(url);
        const score = num(pick(o, 'outlierScore', 'outlier_score', 'multiplier', 'score'));
        out.push({
          source: 'vidiq', topic, title: clip(title, 200), url,
          author: str(pick(o, 'channelTitle', 'channel_title', 'channelName', 'channel_name', 'channel.title', 'channel')) || undefined,
          views: num(pick(o, 'views', 'viewCount', 'view_count', 'statistics.viewCount')),
          likes: num(pick(o, 'likes', 'likeCount', 'like_count')),
          comments: num(pick(o, 'comments', 'commentCount', 'comment_count')),
          date: str(pick(o, 'publishedAt', 'published_at', 'publishDate', 'published')).slice(0, 10) || undefined,
          snippet: score ? 'Outlier score ' + score + 'x' : undefined,
        });
      }
      return;
    }
    for (const k in o) walk(o[k], depth + 1);
  };
  walk(data, 0);
  return out;
}

// Virlo raw search videos (same schema on TikTok, YouTube Shorts and Instagram Reels; counts are numbers or null).
export function fromVirlo(items: Raw[], topic: string): Draft[] {
  return items.filter((i) => str(i.url)).map((i) => {
    const author = (i.author || {}) as Raw;
    const stats = (i.stats || {}) as Raw;
    const caption = str(i.caption);
    const platform = { tiktok: 'TikTok', youtube: 'YouTube Shorts', instagram: 'Instagram' }[str(i.platform)] || '';
    return {
      source: 'virlo' as const, topic, url: str(i.url),
      title: clip(firstLine(caption) || platform + ' video', 200),
      snippet: caption.length > 200 || caption.includes('\n') ? clip([platform, caption.replace(/\s+/g, ' ')].filter(Boolean).join(': '), 400) : platform || undefined,
      author: str(author.handle) ? '@' + str(author.handle) : str(author.display_name) || undefined,
      views: num(stats.views), likes: num(stats.likes), comments: num(stats.comments),
      date: str(i.published_at).slice(0, 10) || undefined,
    };
  });
}

// Canonical form for comparing URLs: lowercase host without www, no hash, no tracking params, no trailing slash.
// YouTube watch URLs keep only v=.
export function urlKey(raw: string): string {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return '';
    const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return 'youtube.com/watch?v=' + u.pathname.slice(1);
    let q = '';
    if (host === 'youtube.com' && u.pathname === '/watch') q = '?v=' + (u.searchParams.get('v') || '');
    else {
      const keep = [...u.searchParams.entries()].filter(([k]) => !/^(utm_|fbclid|gclid|si$|ref$|feature$)/i.test(k));
      if (keep.length) q = '?' + new URLSearchParams(keep).toString();
    }
    return host + u.pathname.replace(/\/+$/, '') + q;
  } catch {
    return '';
  }
}

const titleKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (t: string) => new Set(titleKey(t).split(' ').filter((w) => w.length > 2));

// Share of words two titles have in common (Jaccard), 0..1.
export function titleOverlap(a: string, b: string): number {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((w) => { if (B.has(w)) n++; });
  return n / (A.size + B.size - n);
}

const score = (f: Draft) => (f.views || 0) + (f.likes || 0) * 20 + (f.upvotes || 0) * 50 + (f.comments || 0) * 30;

// Drops empty, duplicate and already-used findings, keeps the strongest `max`, and numbers them f1..fN.
// A source keeps its best items even when another source is louder, so every source is represented.
export function dedupe(drafts: Draft[], opts: { usedUrls?: Iterable<string>; max: number }): Finding[] {
  const used = new Set([...(opts.usedUrls || [])].map(urlKey).filter(Boolean));
  const seenUrl = new Set<string>(), seenTitle = new Set<string>();
  const clean: Draft[] = [];
  for (const d of drafts) {
    const k = urlKey(d.url);
    const t = titleKey(d.title);
    if (!k || !t || used.has(k) || seenUrl.has(k) || seenTitle.has(t)) continue;
    seenUrl.add(k); seenTitle.add(t);
    clean.push({ ...d, title: clip(d.title, 200) });
  }
  const bySource = new Map<string, Draft[]>();
  clean.forEach((d) => { const l = bySource.get(d.source) || []; l.push(d); bySource.set(d.source, l); });
  bySource.forEach((l) => l.sort((a, b) => score(b) - score(a)));
  // Round-robin across sources, strongest first.
  const out: Draft[] = [];
  const lists = [...bySource.values()];
  for (let i = 0; out.length < opts.max && lists.some((l) => i < l.length); i++) {
    lists.forEach((l) => { if (i < l.length && out.length < opts.max) out.push(l[i]); });
  }
  return out.map((d, i) => ({ id: 'f' + (i + 1), ...d }));
}

const fmt = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n));

// One line per finding for the model prompt.
export function findingLine(f: Finding): string {
  const m = [
    f.views != null ? fmt(f.views) + ' views' : '', f.likes != null ? fmt(f.likes) + ' likes' : '',
    f.upvotes != null ? fmt(f.upvotes) + ' upvotes' : '', f.comments != null ? fmt(f.comments) + ' comments' : '',
    f.date ? (/^\d{4}-\d\d-\d\dT/.test(f.date) ? f.date.slice(0, 10) : f.date) : '', f.author || '',
  ].filter(Boolean).join(', ');
  return '[' + f.id + '] (' + f.source + ', topic: ' + f.topic + ') ' + f.title + (m ? ' — ' + m : '') + (f.snippet ? '\n    ' + f.snippet.replace(/\s+/g, ' ') : '');
}

export type RawIdea = { title: string; hook: string; points: string[]; tags: string[]; sources: string[] };
export type IdeaDraft = { title: string; hook: string; body: string[]; tags: string[]; refs: string[] };

// Keeps only model ideas that cite real findings, maps those IDs to URLs, cleans tags, and drops repeats of
// existing ideas, so every saved idea links back to something the sources actually returned.
export function groundIdeas(raw: RawIdea[], findings: Finding[], existing: string[], count: number): IdeaDraft[] {
  const byId = new Map(findings.map((f) => [f.id.toLowerCase(), f]));
  const out: IdeaDraft[] = [];
  for (const i of raw) {
    const cited = (i.sources || []).map((s) => byId.get(String(s).trim().replace(/^\[|\]$/g, '').toLowerCase()));
    const refs = [...new Set(cited.filter((f): f is Finding => !!f).map((f) => f.url))];
    const title = String(i.title || '').trim().slice(0, 200);
    if (!title || !refs.length) continue;
    if (existing.concat(out.map((o) => o.title)).some((t) => titleOverlap(t, title) >= 0.7)) continue;
    out.push({
      title,
      hook: String(i.hook || '').trim().split(/\s+/).slice(0, 8).join(' ') || title.split(' ').slice(0, 4).join(' '),
      body: (i.points || []).map((p) => String(p).trim()).filter(Boolean).slice(0, 8),
      tags: [...new Set((i.tags || []).map((t) => '#' + String(t).toLowerCase().replace(/^#+/, '').replace(/[^a-z0-9]+/g, '')).filter((t) => t.length > 1))].slice(0, 4),
      refs: refs.slice(0, 6),
    });
    if (out.length >= count) break;
  }
  return out;
}
