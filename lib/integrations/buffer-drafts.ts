import 'server-only';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getIntegration } from './secrets';
import { createBufferPost, BufferPostRejected } from './providers/buffer';
import { buildPostInput, publicMediaPath } from './providers/buffer-post';
import { PublishSetupError } from './buffer-publish';

type Project = { id: string; workspace_id: string };
type Options = { test: boolean; runId: string | null };
type Destination = { id: string; label: string };
type Result = { detail: string; failed?: boolean; retry?: boolean };

const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);

export async function draftProjectToBuffer(p: Project, opts: Options): Promise<Result> {
  const admin = supabaseAdmin();
  const prepare = async (channel: string | null) => {
    const { data, error } = await admin.rpc('prepare_buffer_draft', {
      p_workspace: p.workspace_id, p_project: p.id, p_channel: channel, p_run: opts.runId,
    });
    if (error) throw new Error(error.message);
    if (data.error) throw new PublishSetupError(data.error);
    return data;
  };
  const plan = await prepare(null);
  const channels = plan.channels as Destination[];
  if (opts.test) return { detail: 'Would create editable Buffer drafts for ' + plan.brand + ' using ' + plan.file + ' on ' + channels.map(c => c.label).join(', ') + '.' };
  const conn = await getIntegration(p.workspace_id, 'buffer');
  if (!conn) throw new PublishSetupError('Connect Buffer under Workspace Settings → Integrations.');
  async function send(channel: Destination): Promise<Result> {
    let row;
    try { row = await prepare(channel.id); }
    catch (e) { return { detail: errorText(e), failed: true, retry: !(e instanceof PublishSetupError) }; }
    if (!row.claim) {
      if (row.status === 'draft_created') return { detail: 'Draft ' + row.postId + ' already exists.' };
      return { detail: 'A previous handoff needs verification in Buffer before sending again.', failed: true };
    }
    const path = publicMediaPath(p.workspace_id, p.id, row.name, randomUUID());
    const media = admin.storage.from('buffer-media');
    const record = async (patch: Record<string, unknown>) => {
      const saved = await admin.from('buffer_publications').update(patch).eq('id', row.claim).eq('status', 'draft_pending').select('id').single();
      if (saved.error) throw new Error(saved.error.message);
    };
    const built = buildPostInput({ channelId: channel.id, service: row.service, text: row.text, title: row.title,
      media: { url: media.getPublicUrl(path).data.publicUrl, kind: 'video' }, schedule: { mode: 'queue' } });
    if ('error' in built) {
      await record({ status: 'draft_failed', error: built.error });
      return { detail: built.error, failed: true };
    }
    await record({ media_path: path });
    let dispatched = false;
    try {
      const copy = await admin.storage.from('project-assets').copy(row.sourcePath, path, { destinationBucket: 'buffer-media' });
      if (copy.error) throw new Error('Could not copy the Final video: ' + copy.error.message);
      dispatched = true;
      const post = await createBufferPost(conn!.secret.apiKey, { ...built.input, saveToDraft: true });
      const confirmed = post.status === 'draft';
      const detail = confirmed ? 'Created draft ' + post.id + '.' : 'Buffer returned ' + (post.status || 'an unknown status') + ' for post ' + post.id + '. Check it in Buffer.';
      await record({ status: confirmed ? 'draft_created' : 'draft_review', buffer_post_id: post.id, error: confirmed ? null : detail });
      return { detail, failed: !confirmed };
    } catch (e) {
      const definiteFailure = !dispatched || e instanceof BufferPostRejected;
      let detail = errorText(e);
      if (definiteFailure) {
        const removed = await media.remove([path]);
        if (!removed.error) {
          await record({ status: 'draft_failed', error: detail, media_path: null });
          return { detail, failed: true, retry: true };
        }
        detail += ' Media cleanup requires review.';
      } else detail += ' Check Buffer Drafts before retrying.';
      await record({ status: 'draft_review', error: detail });
      return { detail, failed: true };
    }
  }
  const results: Result[] = [];
  for (const c of channels) {
    try {
      const result = await send(c);
      results.push({ ...result, detail: c.label + ' — ' + result.detail });
    } catch (e) {
      // The channel reservation remains held if the database loses our confirmation.
      results.push({ failed: true, detail: c.label + ' — ' + errorText(e) + '. Check the project and Buffer Drafts.' });
    }
  }
  return { detail: results.map(r => r.detail).join(' '), failed: results.some(r => r.failed), retry: results.some(r => r.retry) };
}
