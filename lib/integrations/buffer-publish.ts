import 'server-only';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getIntegration } from './secrets';
import { createBufferPost } from './providers/buffer';
import { buildPostInput, pickMedia, publicMediaPath, zonedIso, type AssetRow, type Media } from './providers/buffer-post';

// Publish to Buffer, run by the automation action of that name. Reads the project's social post (project_publish),
// copies its cut to the public buffer-media bucket, and creates one Buffer post per chosen channel. Every outcome is
// recorded in buffer_publications; a channel that already has a live post for this project is skipped, so retries
// and a second trip through the trigger status never double-post.

const MEDIA_BUCKET = 'buffer-media';
const SOURCE_BUCKET = 'project-assets';

type Publish = { caption: string; buffer_channel_ids: string[]; schedule: 'queue' | 'now' | 'date'; post_time: string; youtube_title: string };
type Channel = { channel_id: string; service: string; name: string; display_name: string | null; is_disconnected: boolean; is_locked: boolean };
type Project = { id: string; workspace_id: string; title: string; publish_date: string | null };

// A failure that trying again cannot fix (nothing chosen, not connected). The runner marks these failed at once.
export class PublishSetupError extends Error {}

// failed lists every channel that did not post; retry is true when one of them might work on a later try
// (Buffer refused or could not be reached), false when only setup problems failed (no video, channel locked).
export type PublishResult = { detail: string; failed: string[]; retry: boolean };

const label = (c: Channel) => (c.display_name || c.name || c.channel_id) + ' (' + c.service + ')';

export async function publishProjectToBuffer(p: Project, opts: { runId: string | null; test: boolean }): Promise<PublishResult> {
  const admin = supabaseAdmin();
  const ws = p.workspace_id;
  const [pubRes, chRes, assetRes, sentRes, setRes] = await Promise.all([
    admin.from('project_publish').select('*').eq('project_id', p.id).maybeSingle(),
    admin.from('buffer_channels').select('channel_id, service, name, display_name, is_disconnected, is_locked').eq('workspace_id', ws),
    admin.from('project_assets').select('id, kind, name, storage_path, mime_type, version, created_at, comment_id').eq('project_id', p.id),
    admin.from('buffer_publications').select('channel_id, created_at').eq('project_id', p.id).eq('status', 'created'),
    admin.from('workspace_settings').select('timezone').eq('workspace_id', ws).maybeSingle(),
  ]);
  for (const r of [pubRes, chRes, assetRes, sentRes]) if (r.error) throw new Error(r.error.message);
  const pub = pubRes.data as Publish | null;
  if (!pub || !pub.buffer_channel_ids.length) throw new PublishSetupError('No Buffer channels are chosen for ' + p.title + '. Pick them under Social post in the project.');

  const conn = await getIntegration(ws, 'buffer');
  if (!conn && !opts.test) throw new PublishSetupError('Buffer is not connected.');
  const channels = (chRes.data || []) as Channel[];
  const sent = new Map(((sentRes.data || []) as { channel_id: string; created_at: string }[]).map((x) => [x.channel_id, x.created_at]));
  const tz = (setRes.data && (setRes.data as { timezone: string }).timezone) || 'America/Chicago';
  const dueAt = pub.schedule === 'date' && p.publish_date ? zonedIso(p.publish_date, pub.post_time, tz) : null;
  const file = pickMedia((assetRes.data || []) as AssetRow[]);

  const lines: string[] = [];
  const failed: string[] = [];
  let retry = false;
  const todo = pub.buffer_channel_ids.map((id) => channels.find((c) => c.channel_id === id) || null);
  if (todo.some((c) => !c)) lines.push('Skipped a channel that is no longer in Buffer.');
  const live = todo.filter((c): c is Channel => !!c);
  const fresh = live.filter((c) => {
    if (!sent.has(c.channel_id)) return true;
    lines.push(label(c) + ': already sent to Buffer, skipped.');
    return false;
  });

  if (opts.test) {
    const what = file ? 'the ' + file.mediaKind + ' "' + file.name + '"' : 'no file';
    const when = pub.schedule === 'now' ? 'right away' : pub.schedule === 'date' ? (dueAt ? 'at ' + dueAt : 'on the Publishing date (none set yet)') : 'to the Buffer queue';
    return { detail: 'Would post ' + what + ' ' + when + ' on ' + (fresh.map(label).join(', ') || 'no new channels') + '.' + (conn ? '' : ' Buffer is not connected yet.'), failed: [], retry: false };
  }
  if (!fresh.length) return { detail: lines.join(' ') || 'Nothing new to post.', failed: [], retry: false };

  // One public copy of the file for every channel in this run.
  let media: Media | null = null;
  let mediaPath: string | null = null;
  if (file && file.storage_path) {
    mediaPath = publicMediaPath(ws, p.id, file.name || file.storage_path, randomUUID());
    const cp = await admin.storage.from(SOURCE_BUCKET).copy(file.storage_path, mediaPath, { destinationBucket: MEDIA_BUCKET });
    if (cp.error) throw new Error('Could not prepare ' + file.name + ' for Buffer: ' + cp.error.message);
    media = { url: admin.storage.from(MEDIA_BUCKET).getPublicUrl(mediaPath).data.publicUrl, kind: file.mediaKind };
  }

  let usedMedia = false;
  for (const c of fresh) {
    const record = async (row: Record<string, unknown>) => {
      const ins = await admin.from('buffer_publications').insert({ workspace_id: ws, project_id: p.id, channel_id: c.channel_id, service: c.service, run_id: opts.runId, ...row });
      if (ins.error) console.warn('buffer_publications', ins.error.message);
    };
    if (c.is_disconnected || c.is_locked) {
      const why = label(c) + (c.is_locked ? ' is locked on your Buffer plan.' : ' is disconnected in Buffer. Reconnect it there.');
      failed.push(why); lines.push(why);
      await record({ status: 'failed', error: why });
      continue;
    }
    const built = buildPostInput({
      channelId: c.channel_id, service: c.service, text: pub.caption, media, title: pub.youtube_title || p.title,
      schedule: { mode: pub.schedule, dueAt },
    });
    if ('error' in built) {
      failed.push(label(c) + ': ' + built.error); lines.push(label(c) + ': ' + built.error);
      await record({ status: 'failed', error: built.error });
      continue;
    }
    try {
      const post = await createBufferPost(conn!.secret.apiKey, built.input);
      usedMedia = usedMedia || !!media;
      await record({ status: 'created', buffer_post_id: post.id, due_at: post.dueAt, media_path: media ? mediaPath : null });
      lines.push(label(c) + ': ' + (post.dueAt ? 'scheduled for ' + post.dueAt : 'sent to Buffer') + '.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push(label(c) + ': ' + msg); lines.push(label(c) + ': ' + msg);
      retry = true;
      await record({ status: 'failed', error: msg });
    }
  }
  // No post kept the copy: remove it now rather than leave a public file behind.
  if (mediaPath && !usedMedia) await admin.storage.from(MEDIA_BUCKET).remove([mediaPath]);
  return { detail: lines.join(' '), failed, retry };
}

// Public copies are only needed until the network has the post. Removes those whose post Buffer reports sent
// (buffer_posts, from the sync), and any older than 60 days. Run after each Buffer sync.
export async function cleanupBufferMedia(ws: string): Promise<number> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from('buffer_publications').select('id, buffer_post_id, media_path, created_at')
    .eq('workspace_id', ws).not('media_path', 'is', null).is('media_removed_at', null).limit(500);
  if (error || !data || !data.length) return 0;
  const ids = data.map((x) => x.buffer_post_id).filter(Boolean) as string[];
  const sent = ids.length ? await admin.from('buffer_posts').select('post_id').eq('workspace_id', ws).in('post_id', ids).not('sent_at', 'is', null) : { data: [] };
  const sentIds = new Set(((sent.data || []) as { post_id: string }[]).map((x) => x.post_id));
  const old = Date.now() - 60 * 86400000;
  const rows = data.filter((x) => (x.buffer_post_id && sentIds.has(x.buffer_post_id)) || Date.parse(x.created_at) < old);
  // Rows from one run share a file: remove a file only when every row using it is done.
  const pending = new Set(data.filter((x) => !rows.includes(x)).map((x) => x.media_path));
  const paths = [...new Set(rows.map((x) => x.media_path as string))].filter((x) => !pending.has(x));
  if (!rows.length) return 0;
  if (paths.length) {
    const rm = await admin.storage.from(MEDIA_BUCKET).remove(paths);
    if (rm.error) { console.warn('buffer-media cleanup', rm.error.message); return 0; }
  }
  const done = rows.filter((x) => !pending.has(x.media_path)).map((x) => x.id);
  if (done.length) await admin.from('buffer_publications').update({ media_removed_at: new Date().toISOString() }).in('id', done);
  return paths.length;
}
