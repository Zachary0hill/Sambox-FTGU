import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ProviderModule } from './types';
import type { Secret, Config } from '../secrets';
import { videoIdOf, durationSeconds, channelRefsOf, chunk, countOf, type ChannelRef } from './youtube-parse';

// YouTube Data API v3 with an API key (public data only). Docs used:
//   https://developers.google.com/youtube/v3/docs/channels/list        (id, forHandle with or without @, forUsername)
//   https://developers.google.com/youtube/v3/docs/channels             (contentDetails.relatedPlaylists.uploads)
//   https://developers.google.com/youtube/v3/docs/playlistItems/list   (playlistId, maxResults 0-50, pageToken)
//   https://developers.google.com/youtube/v3/docs/playlistItems        (contentDetails.videoId)
//   https://developers.google.com/youtube/v3/docs/videos/list          (id: comma separated list)
//   https://developers.google.com/youtube/v3/docs/videos               (duration, statistics, thumbnails, liveBroadcastContent)
//   https://developers.google.com/youtube/v3/docs/errors               (quotaExceeded, channelNotFound, playlistNotFound)
//   https://developers.google.com/youtube/v3/determine_quota_cost      (10,000 units/day; costs below)
//   https://google.aip.dev/193 and Google.Api.ErrorReason              (error.details[].reason: API_KEY_INVALID, SERVICE_DISABLED, ...)
//
// Quota: channels.list, playlistItems.list and videos.list cost 1 unit per call (every page counts). A sync costs
// about 1 (channel IDs, up to 50) + 1 per @handle + up to 4 per channel (200 uploads, 50 a page) + 1 per 50 videos.
// search.list is not used: it has its own 100-calls-a-day bucket and is not needed with the uploads playlist.

const API = 'https://www.googleapis.com/youtube/v3/';
const BACKFILL = 200;

type Json = Record<string, unknown>;
type Channel = { id: string; title: string; uploads: string; ref: ChannelRef };

class YouTubeError extends Error {
  constructor(message: string, readonly status: number, readonly reasons: string[]) { super(message); }
}

const has = (reasons: string[], ...any: string[]) => any.some((r) => reasons.includes(r));

// A message the Super Admin can act on, from the documented error reasons (legacy errors[].reason and ErrorInfo).
function explain(status: number, body: Json | null): YouTubeError {
  const err = (body && (body.error as Json)) || {};
  const list = [...((err.errors as Json[]) || []), ...((err.details as Json[]) || [])];
  const reasons = list.map((e) => String(e.reason || '')).filter(Boolean);
  const raw = String(err.message || '');
  let msg: string;
  if (has(reasons, 'API_KEY_INVALID', 'keyInvalid', 'keyExpired') || /API key (not valid|expired)/i.test(raw))
    msg = 'The API key is not valid or has expired. Copy it again from Google Cloud > APIs & Services > Credentials.';
  else if (has(reasons, 'SERVICE_DISABLED', 'accessNotConfigured'))
    msg = 'YouTube Data API v3 is not enabled in the Google Cloud project that owns this key. Enable it under APIs & Services > Library, wait a few minutes, then save again.';
  else if (has(reasons, 'API_KEY_SERVICE_BLOCKED'))
    msg = 'This key\'s API restrictions do not include YouTube Data API v3. Add it under the key\'s API restrictions in Google Cloud.';
  else if (has(reasons, 'API_KEY_HTTP_REFERRER_BLOCKED'))
    msg = 'This key is restricted to websites. The sync runs on the server and sends no referrer, so set Application restrictions to None or IP addresses.';
  else if (has(reasons, 'API_KEY_IP_ADDRESS_BLOCKED'))
    msg = 'This key\'s IP address restrictions block this server. Add the server\'s IP address or set Application restrictions to None.';
  else if (has(reasons, 'API_KEY_ANDROID_APP_BLOCKED', 'API_KEY_IOS_APP_BLOCKED'))
    msg = 'This key is restricted to mobile apps. Use a key without app restrictions.';
  else if (has(reasons, 'quotaExceeded', 'dailyLimitExceeded', 'RATE_LIMIT_EXCEEDED', 'RESOURCE_QUOTA_EXCEEDED'))
    msg = 'The Google Cloud project\'s YouTube quota is used up for today (10,000 units by default). Try again after it resets.';
  else if (has(reasons, 'BILLING_DISABLED'))
    msg = 'Billing is disabled on the Google Cloud project that owns this key.';
  else if (has(reasons, 'CONSUMER_SUSPENDED'))
    msg = 'The Google Cloud project that owns this key is suspended.';
  else
    msg = 'YouTube returned ' + status + (raw ? ': ' + raw : '.');
  return new YouTubeError(msg, status, reasons);
}

async function call(path: string, params: Record<string, string>, key: string): Promise<Json> {
  const url = new URL(path, API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('key', key);
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  } catch (err) {
    throw new YouTubeError('Could not reach YouTube: ' + (err instanceof Error ? err.message : String(err)), 0, []);
  }
  const body = (await res.json().catch(() => null)) as Json | null;
  if (!res.ok) throw explain(res.status, body);
  return body || {};
}

const label = (r: ChannelRef) => (r.kind === 'id' ? r.value : r.input);

// channels.list for every configured channel: IDs 50 at a time, handles and legacy usernames one call each.
async function resolveChannels(key: string, refs: ChannelRef[]): Promise<{ channels: Channel[]; missing: string[]; units: number }> {
  const channels: Channel[] = [];
  const missing: string[] = [];
  let units = 0;
  const take = (item: Json, ref: ChannelRef) => {
    const sn = (item.snippet as Json) || {};
    const rp = (((item.contentDetails as Json) || {}).relatedPlaylists as Json) || {};
    if (!channels.some((c) => c.id === item.id))
      channels.push({ id: String(item.id), title: String(sn.title || ''), uploads: String(rp.uploads || ''), ref });
  };
  const ids = refs.filter((r) => r.kind === 'id');
  for (const group of chunk(ids, 50)) {
    units++;
    let items: Json[] = [];
    try {
      const out = await call('channels', { part: 'snippet,contentDetails', id: group.map((r) => r.value).join(','), maxResults: '50' }, key);
      items = (out.items as Json[]) || [];
    } catch (err) {
      if (!(err instanceof YouTubeError && has(err.reasons, 'channelNotFound'))) throw err;
    }
    group.forEach((r) => {
      const it = items.find((x) => x.id === r.value);
      if (it) take(it, r); else missing.push(label(r));
    });
  }
  for (const r of refs.filter((x) => x.kind !== 'id')) {
    units++;
    let items: Json[] = [];
    try {
      const out = await call('channels', { part: 'snippet,contentDetails', [r.kind === 'handle' ? 'forHandle' : 'forUsername']: r.value }, key);
      items = (out.items as Json[]) || [];
    } catch (err) {
      if (!(err instanceof YouTubeError && has(err.reasons, 'channelNotFound'))) throw err;
    }
    if (items[0]) take(items[0], r); else missing.push(label(r));
  }
  return { channels, missing, units };
}

const missingText = (missing: string[]) =>
  'No YouTube channel found for ' + missing.join(', ') + '. Check the channel ID (YouTube Studio > Settings > Channel > Advanced settings) or @handle.';

async function channelsFor(key: string, config: Config) {
  if (!key) throw new Error('Add the API key.');
  const { refs, error } = channelRefsOf(config.channelIds);
  if (error) throw new Error(error);
  const out = await resolveChannels(key, refs);
  if (out.missing.length) throw new Error(missingText(out.missing));
  return out;
}

// Recent upload IDs from a channel's uploads playlist, newest first in practice (the docs do not state an order).
// Stops at the backfill cap, or after a page whose videos are all already stored.
async function uploads(key: string, ch: Channel, known: Set<string>): Promise<{ ids: string[]; units: number }> {
  const ids: string[] = [];
  let units = 0, pageToken = '';
  while (ch.uploads && ids.length < BACKFILL) {
    units++;
    let out: Json;
    try {
      out = await call('playlistItems', { part: 'contentDetails', playlistId: ch.uploads, maxResults: '50', ...(pageToken ? { pageToken } : {}) }, key);
    } catch (err) {
      // A channel with no public uploads has no listable uploads playlist.
      if (err instanceof YouTubeError && has(err.reasons, 'playlistNotFound')) break;
      throw err;
    }
    const page = ((out.items as Json[]) || []).map((it) => String(((it.contentDetails as Json) || {}).videoId || '')).filter(Boolean);
    page.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    pageToken = String(out.nextPageToken || '');
    if (!pageToken || !page.length || (known.size && page.every((id) => known.has(id)))) break;
  }
  return { ids: ids.slice(0, BACKFILL), units };
}

const thumbOf = (t: Json | undefined) => {
  const pick = ['maxres', 'standard', 'high', 'medium', 'default'].map((k) => (t && (t[k] as Json)) || null).find((x) => x && x.url);
  return pick ? String(pick.url) : null;
};

// Every row of a table for this workspace, paging past PostgREST's row limit.
async function selectAll<T>(table: string, columns: string, ws: string): Promise<T[]> {
  const admin = supabaseAdmin();
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(columns).eq('workspace_id', ws).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data || []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

const provider: ProviderModule = {
  // One channels.list call (plus one per @handle) proves the key works, the API is enabled and every channel exists.
  async verify(secret: Secret, config: Config) {
    try {
      await channelsFor(secret.apiKey, config);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },

  async sync(ws: string, secret: Secret, config: Config) {
    const key = secret.apiKey;
    const admin = supabaseAdmin();
    const { channels, units: u0 } = await channelsFor(key, config);
    let units = u0;
    const chIds = channels.map((c) => c.id);

    const stored = await selectAll<{ video_id: string; channel_id: string }>('youtube_videos', 'video_id, channel_id', ws);
    const want = new Set<string>();
    let added = 0;
    for (const ch of channels) {
      const known = new Set(stored.filter((v) => v.channel_id === ch.id).map((v) => v.video_id));
      const up = await uploads(key, ch, known);
      units += up.units;
      known.forEach((id) => want.add(id));
      up.ids.forEach((id) => { if (!known.has(id)) added++; want.add(id); });
    }

    // Board projects by video ID: projects.youtube_video_id first, else the ID in link_url. Active projects win.
    const projects = await selectAll<{ id: string; link_url: string | null; youtube_video_id: string | null; archived_at: string | null }>(
      'projects', 'id, link_url, youtube_video_id, archived_at', ws);
    const projectOf = new Map<string, string>();
    projects.slice().sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at)).forEach((p) => {
      const vid = videoIdOf(p.youtube_video_id) || videoIdOf(p.link_url);
      if (vid && !projectOf.has(vid)) projectOf.set(vid, p.id);
    });

    const now = new Date().toISOString();
    const rows: Json[] = [];
    for (const group of chunk([...want], 50)) {
      units++;
      const out = await call('videos', { part: 'snippet,statistics,contentDetails', id: group.join(',') }, key);
      ((out.items as Json[]) || []).forEach((v) => {
        const sn = (v.snippet as Json) || {}, stc = (v.statistics as Json) || {}, cd = (v.contentDetails as Json) || {};
        rows.push({
          workspace_id: ws, video_id: String(v.id), channel_id: String(sn.channelId || ''), channel_title: String(sn.channelTitle || ''),
          title: String(sn.title || ''), description: String(sn.description || '').slice(0, 300),
          published_at: sn.publishedAt || null, thumbnail_url: thumbOf(sn.thumbnails as Json),
          duration_seconds: durationSeconds(String(cd.duration || '')),
          views: countOf(stc.viewCount) ?? 0, likes: countOf(stc.likeCount), comments: countOf(stc.commentCount),
          live_status: ['live', 'upcoming'].includes(String(sn.liveBroadcastContent)) ? sn.liveBroadcastContent : 'none',
          project_id: projectOf.get(String(v.id)) || null, synced_at: now,
        });
      });
    }

    for (const part of chunk(rows, 500)) {
      const { error } = await admin.from('youtube_videos').upsert(part, { onConflict: 'workspace_id,video_id' });
      if (error) throw new Error(error.message);
    }
    // Stored videos YouTube no longer returns (deleted or made private), and channels taken out of Settings.
    const got = new Set(rows.map((r) => String(r.video_id)));
    const gone = [...want].filter((id) => !got.has(id));
    for (const part of chunk(gone, 200)) {
      const { error } = await admin.from('youtube_videos').delete().eq('workspace_id', ws).in('video_id', part);
      if (error) throw new Error(error.message);
    }
    if (chIds.length) {
      const { error } = await admin.from('youtube_videos').delete().eq('workspace_id', ws).not('channel_id', 'in', '(' + chIds.join(',') + ')');
      if (error) throw new Error(error.message);
    }

    // Metric snapshots for matched projects when views or likes moved. Retention and impressions need YouTube
    // Analytics (OAuth), so they carry over from the latest snapshot, which is 0 unless someone entered them.
    const matched = rows.filter((r) => r.project_id);
    const latest = new Map<string, Json>();
    for (const part of chunk([...new Set(matched.map((r) => String(r.project_id)))], 100)) {
      const { data, error } = await admin.from('content_metrics').select('project_id, views, likes, retention_pct, impressions')
        .in('project_id', part).order('captured_at', { ascending: false });
      if (error) throw new Error(error.message);
      (data || []).forEach((m) => { if (!latest.has(m.project_id)) latest.set(m.project_id, m); });
    }
    const snaps: Json[] = [];
    matched.forEach((r) => {
      const prev = latest.get(String(r.project_id));
      const likes = Number(r.likes ?? 0);
      if (prev && Number(prev.views) === Number(r.views) && Number(prev.likes) === likes) return;
      snaps.push({ project_id: r.project_id, captured_at: now, views: r.views, likes, retention_pct: prev ? prev.retention_pct : 0, impressions: prev ? prev.impressions : 0 });
    });
    for (const part of chunk(snaps, 500)) {
      const { error } = await admin.from('content_metrics').insert(part);
      if (error) throw new Error(error.message);
    }

    const n = (x: number, one: string, many: string) => x.toLocaleString('en-US') + ' ' + (x === 1 ? one : many);
    return {
      summary: 'Synced ' + n(rows.length, 'video', 'videos') + ' from ' + n(channels.length, 'channel', 'channels') + ' (' + added + ' new, '
        + matched.length + ' matched to projects). Used about ' + units + ' of 10,000 daily quota units.',
    };
  },
};

export default provider;
