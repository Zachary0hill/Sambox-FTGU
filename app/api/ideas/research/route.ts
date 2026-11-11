import { NextResponse, after } from 'next/server';
import { getMember, deny } from '@/lib/integrations/auth';
import { cancelIdeaResearch, processIdeaResearch, queueIdeaResearch } from '@/lib/ideas/research';

// The run continues after the response, so this limit covers one search and one model call.
export const maxDuration = 300;

const ideaIdFrom = async (request: Request) => {
  const body = await request.json().catch(() => null);
  return body && /^[0-9a-f-]{36}$/i.test(body.ideaId || '') ? String(body.ideaId) : '';
};

// Queues research for one idea and starts it right away. The scheduler picks it up if this start is lost.
export async function POST(request: Request) {
  const m = await getMember();
  if (!m) return deny('Sign in to run research.', 401);
  const ideaId = await ideaIdFrom(request);
  if (!ideaId) return deny('Choose an idea.', 400);
  const out = await queueIdeaResearch(m, ideaId);
  if ('error' in out) return deny(out.error, out.status);
  after(() => processIdeaResearch(ideaId, out.runId));
  return NextResponse.json({ runId: out.runId });
}

export async function DELETE(request: Request) {
  const m = await getMember();
  if (!m) return deny('Sign in first.', 401);
  const ideaId = await ideaIdFrom(request);
  if (!ideaId) return deny('Choose an idea.', 400);
  const failed = await cancelIdeaResearch(m, ideaId);
  return failed ? deny(failed.error, failed.status) : NextResponse.json({ ok: true });
}
