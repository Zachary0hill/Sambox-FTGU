import { NextResponse, after } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { coverNewIdeas, imageModelConnected } from '@/lib/ideas/cover';

// Super Admin: a cover for every active idea that has none. Answers at once with the count and draws them after the
// response, newest ideas first, inside this route's time limit. Ideas still missing a cover can be sent again.
export const maxDuration = 300;

export async function POST() {
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can generate covers for every idea.');
  const ws = m.ctx.workspace_id;
  if (!(await imageModelConnected(ws))) return deny('Connect OpenAI or Gemini in Integrations to generate covers. Claude does not make images.', 409);
  const { data, error } = await m.supabase.from('ideas').select('id').eq('workspace_id', ws).is('cover_path', null).is('archived_at', null).order('created_at', { ascending: false }).limit(60);
  if (error) return deny(error.message, 500);
  const ids = (data || []).map((r) => r.id as string);
  if (ids.length) after(() => coverNewIdeas(ids, ws, m, 280000));
  return NextResponse.json({ count: ids.length });
}
