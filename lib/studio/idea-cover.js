// Idea covers in the browser: shrink a picked image before it uploads, make a small local preview, sign the stored
// cover at two sizes, and remember covers still uploading so a reload in the meantime keeps showing the new picture.

// The stored cover keeps YouTube's 1920 px; anything larger only slows the upload and every later view.
const FULL_MAX = 1920;
const THUMB_MAX = 720;
// Cards, the board and the gallery show a resized copy made by Supabase Storage ('contain' keeps the whole picture,
// so the focal point still crops it on the page). The detail header and the editor paint the full file over it.
const THUMB_TRANSFORM = { width: THUMB_MAX, height: THUMB_MAX, resize: 'contain', quality: 70 };
const PASS_THROUGH = /^image\/(gif|svg\+xml)$/i;

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* the <img> decoder below handles the rest */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

function draw(src, max) {
  const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d');
  // JPEG has no transparency; see-through pixels take the banner's own backdrop color.
  g.fillStyle = '#222222';
  g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const jpeg = (canvas, quality) => new Promise((done) => canvas.toBlob((b) => done(b), 'image/jpeg', quality));

// Returns { file, thumb }: file is the picture to upload (a 1920 px JPEG when that is smaller than the original),
// thumb a local object URL of a 720 px copy for instant previews ('' when the image could not be read).
// GIFs and SVGs pass through untouched so animation and vectors survive.
export async function prepareCover(file) {
  if (!file || PASS_THROUGH.test(file.type || '')) return { file, thumb: '' };
  let src;
  try { src = await decode(file); } catch { return { file, thumb: '' }; }
  try {
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    let out = file;
    if (Math.max(w, h) > FULL_MAX || !/^image\/jpe?g$/i.test(file.type || '') || file.size > 1.5 * 1024 * 1024) {
      const b = await jpeg(draw(src, FULL_MAX), 0.86);
      if (b && b.size < file.size) out = new File([b], String(file.name || 'cover').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    }
    const t = await jpeg(draw(src, THUMB_MAX), 0.72);
    return { file: out, thumb: t ? URL.createObjectURL(t) : '' };
  } finally { if (src && src.close) src.close(); }
}

// Signed URLs for idea covers, full size and thumbnail, cached for 50 of their 60 minutes so reloads reuse the same
// URL and the browser cache. Thumbnails are signed one file at a time (Supabase has no batch call for resized
// images); a failed one is left out and the card falls back to the full file.
const cache = new Map();
const fresh = (k, now) => cache.get(k) && now - cache.get(k).at < 50 * 60 * 1000;
export async function signIdeaCovers(sb, paths) {
  const now = Date.now();
  const all = [...new Set(paths.filter(Boolean))];
  const bucket = sb.storage.from('idea-covers');
  const needFull = all.filter((p) => !fresh('full:' + p, now));
  const needThumb = all.filter((p) => !fresh('thumb:' + p, now));
  await Promise.all([
    needFull.length ? bucket.createSignedUrls(needFull, 3600).then((res) => {
      if (res.error) console.warn('idea-covers', res.error.message);
      (res.data || []).forEach((x) => { if (x.signedUrl) cache.set('full:' + x.path, { url: x.signedUrl, at: now }); });
    }) : null,
    ...needThumb.map((p) => bucket.createSignedUrl(p, 3600, { transform: THUMB_TRANSFORM }).then((res) => {
      if (res.error) console.warn('idea-cover thumbs', res.error.message);
      else if (res.data && res.data.signedUrl) cache.set('thumb:' + p, { url: res.data.signedUrl, at: now });
    })),
  ]);
  const pick = (kind) => Object.fromEntries(all.filter((p) => cache.get(kind + ':' + p)).map((p) => [p, cache.get(kind + ':' + p).url]));
  return { full: pick('full'), thumb: pick('thumb') };
}

// Covers picked on this page and not yet confirmed by a signed thumbnail: ideaId -> { url, thumb, uploading }.
// The loader shows these instead of what the database says, so the card never flips back to the old picture.
const held = new Map();
export const heldCover = (id) => held.get(id) || null;
export function holdCover(id, cover) { held.set(id, cover); return cover; }
export function releaseCover(id, cover) {
  if (held.get(id) !== cover) return;
  held.delete(id);
  setTimeout(() => { [cover.url, cover.thumb].forEach((u) => { if (u && u.startsWith('blob:')) URL.revokeObjectURL(u); }); }, 2000);
}
export const coverUploading = (id) => !!(held.get(id) && held.get(id).uploading);

// Resolves once the image has downloaded (or failed, or 10 seconds passed), so a swap never shows a blank banner.
export const preload = (url) => new Promise((done) => {
  if (!url) return done();
  const img = new Image();
  const t = setTimeout(done, 10000);
  img.onload = img.onerror = () => { clearTimeout(t); done(); };
  img.src = url;
});

// Leaving the page asks first while an idea edit is unsaved or a cover is still uploading.
let unsavedEdit = false;
export const markUnsavedEdit = (v) => { unsavedEdit = !!v; };
if (typeof window !== 'undefined') {
  // One listener per page; a hot-reloaded copy of this module replaces the old one.
  if (window.__ideaCoverGuard) window.removeEventListener('beforeunload', window.__ideaCoverGuard);
  window.__ideaCoverGuard = (e) => {
    if (!unsavedEdit && ![...held.values()].some((c) => c.uploading)) return;
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', window.__ideaCoverGuard);
}
