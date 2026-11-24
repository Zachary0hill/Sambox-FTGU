import { getMember, deny } from '@/lib/integrations/auth';
import { getIntegration } from '@/lib/integrations/secrets';
import { inspectBufferDraft, replaceBufferDraftMedia, BufferPostRejected } from '@/lib/integrations/providers/buffer';
import { supabaseAdmin } from '@/lib/supabase/admin';

const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
export async function POST(request: Request) {
  const member = await getMember();
  if (!member) return deny('Sign in to update draft media.', 401);
  const body = await request.json().catch(() => null);
  if (!uuid.test(body?.publication || '') || !uuid.test(body?.asset || '') || !Number.isInteger(body.expectedReviews)) return deny('Select a draft and Final version.', 400);
  const { data: job, error } = await member.supabase.rpc('review_buffer_draft_version', { p_publication: body.publication, p_asset: body.asset,
    p_decision: 'replace', p_expected_reviews: body.expectedReviews });
  if (error) return deny(error.message, error.code === '42501' ? 403 : 409);
  if (job.done) return Response.json({ postId: job.post, status: 'draft', alreadyApplied: true });
  const admin = supabaseAdmin();
  const media = admin.storage.from('buffer-media');
  const finish = async (state: string, detail: string) => {
    const r = await admin.rpc('finish_buffer_media_edit', { p_publication: body.publication, p_token: job.token, p_state: state, p_detail: detail });
    if (r.error) throw new Error('Could not save the provider outcome. Check the draft in Buffer.');
  };
  let dispatched = false, copied = false;
  try {
    const conn = await getIntegration(job.workspace, 'buffer');
    if (!conn || !job.expectedPath) throw new Error('Connect Buffer and verify the submitted media in the existing draft.');
    const copy = await admin.storage.from('project-assets').copy(job.sourcePath, job.mediaPath, { destinationBucket: 'buffer-media' });
    if (copy.error) throw new Error(copy.error.message);
    copied = true;
    const post = await inspectBufferDraft(conn.secret.apiKey, job.post);
    const expected = media.getPublicUrl(job.expectedPath).data.publicUrl;
    if (post?.id !== job.post || post.channelId !== job.channel || post.status !== 'draft' || post.assets?.length !== 1 || post.assets[0].source !== expected) {
      throw new Error('The Buffer post, draft status, or media has changed. Review the existing post in Buffer.');
    }
    dispatched = true;
    const replacementUrl = media.getPublicUrl(job.mediaPath).data.publicUrl;
    const result = await replaceBufferDraftMedia(conn.secret.apiKey, job.post, replacementUrl);
    if (result.id !== job.post || result.channelId !== job.channel || result.status !== 'draft') throw new Error('The post changed during the update. Verify the result in Buffer.');
    if (result.assets?.length !== 1 || result.assets[0].source !== replacementUrl) throw new Error('Buffer has not confirmed the selected Final video. Verify its media in Buffer.');
    await finish('done', '');
    return Response.json({ postId: result.id, status: result.status });
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Buffer media update failed.';
    let held = dispatched && !(e instanceof BufferPostRejected);
    if (!held && copied) held = !!(await media.remove([job.mediaPath])).error;
    try { await finish(held ? 'review' : 'failed', detail); }
    catch (err) { return deny(err instanceof Error ? err.message : 'Verify the draft in Buffer.', 503); }
    return deny(detail, 409);
  }
}
