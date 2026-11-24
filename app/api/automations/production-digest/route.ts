import { deny, getMember, isSuperAdmin } from '@/lib/integrations/auth';
import { digestChannels } from '@/lib/integrations/providers/slack';
import { previewDigest } from '@/lib/automations/production-digest';
import { baseUrlFor } from '@/lib/email/invite';

export async function GET(request: Request) {
  const member = await getMember();
  if (!isSuperAdmin(member)) return deny('Only a Super Admin can inspect digest workflows.');
  const ws = member.ctx.workspace_id;
  const params = new URL(request.url).searchParams;
  try {
    if (params.get('view') === 'channels') return Response.json(await digestChannels(ws));
    if (params.get('view') !== 'preview') return deny('Choose a digest preview or channel list.', 400);
    const value = await previewDigest(ws, baseUrlFor(request), params.get('rule') || '', params.get('timezone') || 'UTC',
      params.get('date') || '', params.get('channel') || '');
    return Response.json(value, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return deny(error instanceof Error ? error.message : 'The digest could not be loaded.', 400);
  }
}
