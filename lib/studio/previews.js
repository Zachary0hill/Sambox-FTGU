// Link previews for reference URLs: title, site, author and a thumbnail. YouTube thumbnails come from the video ID
// at once; everything else is fetched once per URL from /api/unfurl and kept for the life of the page.
const cache = new Map(); // url -> preview | null (null: nothing found)
const pending = new Set();

export const isHttp = (u) => /^https?:\/\//i.test(String(u || '').trim());
export const previewKnown = (u) => cache.has(String(u || '').trim());
export const isPending = (u) => pending.has(String(u || '').trim());
export const markPending = (u, on) => { if (on) pending.add(u); else pending.delete(u); };
export const remember = (u, p) => cache.set(u, p || null);

// Video ID for YouTube watch, short and shorts links.
export function youtubeId(u) {
  try {
    const x = new URL(String(u).trim());
    const h = x.hostname.replace(/^www\.|^m\./, '');
    if (h === 'youtu.be') return (x.pathname.split('/')[1] || '').slice(0, 11) || '';
    if (h === 'youtube.com' || h === 'music.youtube.com') {
      const v = x.searchParams.get('v');
      if (v) return v.slice(0, 11);
      const m = x.pathname.match(/^\/(shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
      return m ? m[2] : '';
    }
  } catch { /* not a URL */ }
  return '';
}

const SITE = [[/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube', 'video'], [/(^|\.)tiktok\.com$/, 'TikTok', 'video'], [/(^|\.)instagram\.com$/, 'Instagram', 'video'],
  [/(^|\.)vimeo\.com$/, 'Vimeo', 'video'], [/(^|\.)facebook\.com$|^fb\.watch$/, 'Facebook', 'video'], [/(^|\.)x\.com$|(^|\.)twitter\.com$/, 'X', 'link'],
  [/(^|\.)docs\.google\.com$/, 'Google Docs', 'doc'], [/(^|\.)notion\.so$|(^|\.)notion\.site$/, 'Notion', 'doc'], [/(^|\.)reddit\.com$/, 'Reddit', 'link']];

// What is known about a URL without asking the server: the site name, its kind and (YouTube only) a thumbnail.
export function localPreview(u) {
  let host = '';
  try { host = new URL(String(u).trim()).hostname.replace(/^www\./, ''); } catch { return null; }
  const s = SITE.find((x) => x[0].test(host));
  const yt = youtubeId(u);
  return { url: String(u).trim(), site: s ? s[1] : host, kind: yt ? 'video' : s ? s[2] : 'link', host,
    image: yt ? 'https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg' : '', title: '', author: '', description: '' };
}

// The best preview for a URL: the fetched one, filled in with what the URL itself says.
export function previewOf(u) {
  const key = String(u || '').trim();
  const local = localPreview(key);
  if (!local) return null;
  const got = cache.get(key);
  if (!got) return local;
  return Object.assign({}, local, got, { image: got.image || local.image, site: got.site || local.site, kind: got.kind === 'video' || local.kind === 'video' ? 'video' : got.kind || local.kind });
}
