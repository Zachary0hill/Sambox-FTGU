// Pure helpers for the YouTube sync: no network, no server-only imports, so they can be tested on their own.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const YT_HOST = /(^|\.)(youtube\.com|youtube-nocookie\.com)$/i;

// The 11-character video ID in any YouTube link a project might hold: watch?v=, youtu.be/, shorts/, live/, embed/,
// v/, e/, m. and music. hosts, youtube-nocookie.com, or a bare ID. Null when the text is not a YouTube video link.
export function videoIdOf(input: string | null | undefined): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (VIDEO_ID.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') id = parts[0] || null;
  else if (YT_HOST.test(host)) {
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (['shorts', 'live', 'embed', 'v', 'e'].includes(parts[0])) id = parts[1] || null;
    else if (parts[0] === 'attribution_link') {
      const u = url.searchParams.get('u');
      return u ? videoIdOf('https://www.youtube.com' + u) : null;
    }
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

// ISO 8601 duration from contentDetails.duration (PT15M33S, PT1H2M, P1DT2H3M4S, P0D) to whole seconds.
export function durationSeconds(iso: string | null | undefined): number {
  const m = String(iso || '').match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return 0;
  const [w, d, h, min, s] = m.slice(1).map((x) => (x ? Number(x) : 0));
  return Math.round(w * 604800 + d * 86400 + h * 3600 + min * 60 + s);
}

export type ChannelRef = { kind: 'id' | 'handle' | 'username'; value: string; input: string };

// One entry of the Channel IDs field: a UC... ID, an @handle, or a channel URL (/channel/UC..., /@handle, /user/name).
export function channelRefOf(input: string): ChannelRef | string {
  const raw = input.trim();
  if (CHANNEL_ID.test(raw)) return { kind: 'id', value: raw, input: raw };
  if (/^@[^\s/?#]+$/.test(raw)) return { kind: 'handle', value: raw, input: raw };
  if (/youtube\.com\//i.test(raw)) {
    let url: URL | null = null;
    try { url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { url = null; }
    const parts = url ? url.pathname.split('/').filter(Boolean).map(decodeURIComponent) : [];
    if (parts[0] === 'channel' && parts[1] && CHANNEL_ID.test(parts[1])) return { kind: 'id', value: parts[1], input: raw };
    if (parts[0] && parts[0].startsWith('@')) return { kind: 'handle', value: parts[0], input: raw };
    if (parts[0] === 'user' && parts[1]) return { kind: 'username', value: parts[1], input: raw };
    if (parts[0] === 'c') return '"' + raw + '" is a custom URL, which the API cannot look up. Use the channel ID (UC...) or @handle instead.';
  }
  return '"' + raw + '" is not a channel ID (UC...) or @handle.';
}

export function channelRefsOf(value: unknown): { refs: ChannelRef[]; error: string | null } {
  const items = String(value || '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
  const refs: ChannelRef[] = [];
  for (const it of items) {
    const r = channelRefOf(it);
    if (typeof r === 'string') return { refs: [], error: r };
    if (!refs.some((x) => x.kind === r.kind && x.value.toLowerCase() === r.value.toLowerCase())) refs.push(r);
  }
  return { refs, error: refs.length ? null : 'Add at least one channel ID (UC...) or @handle.' };
}

export const chunk = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

// statistics counts arrive as strings and can be missing (hidden likes, comments turned off). Missing stays null.
export const countOf = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
