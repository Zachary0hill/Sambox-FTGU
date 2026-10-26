// Pure helpers for publishing to Buffer: no network, no server-only imports, so they can be tested on their own.
// Docs used (checked 2026-10-26):
//   https://developers.buffer.com/guides/posts-and-scheduling.md   createPost, ShareMode addToQueue / shareNow / customScheduled + dueAt
//   https://developers.buffer.com/guides/hosting-media.md          assets are public URLs that must stay live until the post goes out
//   https://developers.buffer.com/types/PostInputMetaData.md       per-network metadata; Instagram needs type + shouldShareToFeed,
//                                                                  Facebook needs type, YouTube needs title + categoryId on create,
//                                                                  Pinterest needs boardServiceId
//   https://developers.buffer.com/types/VideoAssetInput.md         video thumbnailUrl is rejected; leave it out

type Json = Record<string, unknown>;

export type Media = { url: string; kind: 'video' | 'image' };
export type Schedule = { mode: 'queue' | 'now' | 'date'; dueAt?: string | null };
export type PostDraft = { channelId: string; service: string; text: string; media: Media | null; title: string; schedule: Schedule };

const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

// What a file can be posted as, from its MIME type or extension. Null for anything Buffer cannot take as a post asset.
export function mediaKind(f: { mime_type?: string | null; name?: string | null; storage_path?: string | null }): Media['kind'] | null {
  const mt = f.mime_type || '';
  const name = f.storage_path || f.name || '';
  if (/^video\//.test(mt) || VIDEO_EXT.test(name)) return 'video';
  if (/^image\/(png|jpe?g|gif|webp)$/.test(mt) || IMAGE_EXT.test(name)) return 'image';
  return null;
}

// The file to post: the newest Final video, else the newest edit (highest version), else the newest Final image.
// Only files in storage count, since Buffer fetches the media itself.
export type AssetRow = {
  id: string; kind: string; name: string; storage_path: string | null; mime_type?: string | null; version?: number | null; created_at: string; comment_id?: string | null;
};
export function pickMedia(assets: AssetRow[]): (AssetRow & { mediaKind: Media['kind'] }) | null {
  const stored = assets.filter((a) => a.storage_path && !a.comment_id);
  const newest = (xs: AssetRow[]) => xs.slice().sort((a, b) => (b.version || 0) - (a.version || 0) || (a.created_at < b.created_at ? 1 : -1))[0] || null;
  const of = (kind: string, mk: Media['kind']) => newest(stored.filter((a) => a.kind === kind && mediaKind(a) === mk));
  const hit = (a: AssetRow | null, mk: Media['kind']) => (a ? { ...a, mediaKind: mk } : null);
  return hit(of('final', 'video'), 'video') || hit(of('draft', 'video'), 'video') || hit(of('final', 'image'), 'image');
}

// Networks that cannot post without media, and the ones Buffer's API cannot post to from here.
const NEEDS_MEDIA: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', pinterest: 'Pinterest' };
const NEEDS_VIDEO: Record<string, string> = { youtube: 'YouTube' };
const UNSUPPORTED: Record<string, string> = {
  pinterest: 'Pinterest pins need a board, which this form does not ask for yet. Post this one in Buffer.',
  googlebusiness: 'Google Business posts are not supported from here yet. Post this one in Buffer.',
  startPage: 'Start Page is not a posting channel.',
  whatsapp: 'Buffer cannot post to WhatsApp through its API.',
};

// YouTube's "People & Blogs" category: Buffer requires a category on create, and this one fits most creator uploads.
export const YOUTUBE_CATEGORY = '22';

// The createPost input for one channel, or the reason it cannot be posted. Reasons are written for the Super Admin.
export function buildPostInput(d: PostDraft): { input: Json } | { error: string } {
  const svc = d.service;
  if (UNSUPPORTED[svc]) return { error: UNSUPPORTED[svc] };
  if (NEEDS_VIDEO[svc] && (!d.media || d.media.kind !== 'video')) return { error: NEEDS_VIDEO[svc] + ' needs a video. Upload the cut to the project\'s Files first.' };
  if (NEEDS_MEDIA[svc] && !d.media) return { error: NEEDS_MEDIA[svc] + ' needs a video or image. Upload the cut to the project\'s Files first.' };
  const text = d.text.trim();
  if (!text && !d.media) return { error: 'Add a caption or a file to post.' };
  if (d.schedule.mode === 'date' && !d.schedule.dueAt) return { error: 'Set a Publishing date, or post to the Buffer queue instead.' };
  if (d.schedule.mode === 'date' && d.schedule.dueAt && Date.parse(d.schedule.dueAt) <= Date.now()) return { error: 'The publishing time has passed. Change the date, or post to the Buffer queue instead.' };

  const video = !!d.media && d.media.kind === 'video';
  const meta: Json = {};
  if (svc === 'instagram') meta.instagram = { type: video ? 'reel' : 'post', shouldShareToFeed: true };
  if (svc === 'facebook') meta.facebook = { type: video ? 'reel' : 'post' };
  if (svc === 'youtube') meta.youtube = { title: (d.title.trim() || text.split('\n')[0] || 'Untitled').slice(0, 100), categoryId: YOUTUBE_CATEGORY };

  const input: Json = {
    channelId: d.channelId,
    text,
    schedulingType: 'automatic',
    mode: d.schedule.mode === 'now' ? 'shareNow' : d.schedule.mode === 'date' ? 'customScheduled' : 'addToQueue',
    assets: d.media ? [d.media.kind === 'video' ? { video: { url: d.media.url } } : { image: { url: d.media.url } }] : [],
    source: 'ftgu-studio',
  };
  if (d.schedule.mode === 'date' && d.schedule.dueAt) input.dueAt = new Date(d.schedule.dueAt).toISOString();
  if (Object.keys(meta).length) input.metadata = meta;
  return { input };
}

// A publishing date (YYYY-MM-DD) at a wall-clock time (HH:MM) in an IANA timezone, as a UTC ISO string.
export function zonedIso(date: string, time: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
  const t = /^(\d{1,2}):(\d{2})/.exec(time || '09:00');
  if (!m || !t) return null;
  const want = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  // The zone's offset at that moment, read back through Intl; twice so a DST change between guesses settles.
  let guess = want;
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    guess += want - shown;
  }
  return new Date(guess).toISOString();
}

// Buffer's media must be public and permanent, so each posted file is copied to the public buffer-media bucket under
// an unguessable folder. The name keeps its extension, which networks use to sniff the type.
export function publicMediaPath(ws: string, projectId: string, name: string, rand: string) {
  const ext = (/\.([A-Za-z0-9]{2,5})$/.exec(name) || ['', 'bin'])[1].toLowerCase();
  return ws + '/' + projectId + '/' + rand + '.' + ext;
}
