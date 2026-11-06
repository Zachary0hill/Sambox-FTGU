import { NextResponse } from 'next/server';
import { getMember, deny } from '@/lib/integrations/auth';
import { generateScript, ScriptError, type Beat } from '@/lib/ideas/script';

// Drafts a script for an idea with the workspace's text model. The beats come back for review on the idea's Script
// tab; the member saves them from there (ideas.script, on their own session). See lib/ideas/script.
export const maxDuration = 120;

export async function POST(request: Request) {
  const m = await getMember();
  if (!m) return deny('Sign in to write scripts.', 401);
  if (m.ctx.role === 'editor') return deny('Editors cannot draft idea scripts.');
  const body = await request.json().catch(() => ({}));
  const ideaId = typeof body?.ideaId === 'string' && /^[0-9a-f-]{36}$/i.test(body.ideaId) ? body.ideaId : '';
  if (!ideaId) return deny('Which idea?', 400);
  const length = body?.length === 'short' || body?.length === 'standard' || body?.length === 'long' ? body.length : '';
  const current: Beat[] = Array.isArray(body?.current) ? body.current.slice(0, 120).map((b: Partial<Beat>) => ({ time: String(b?.time || '').slice(0, 8), label: String(b?.label || '').slice(0, 80), text: String(b?.text || '').slice(0, 6000) })).filter((b: Beat) => b.text) : [];
  try {
    const out = await generateScript({ ideaId, member: m, notes: String(body?.notes || '').slice(0, 2000), length, current });
    return NextResponse.json(out);
  } catch (err) {
    const e = err as ScriptError;
    return deny(e.message || 'The script could not be drafted.', e instanceof ScriptError ? e.status : 502);
  }
}
