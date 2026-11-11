import { NextResponse } from 'next/server';
import { deny, isCron } from '@/lib/integrations/auth';
import { researchTick } from '@/lib/ideas/research';

export const maxDuration = 300;

// Called every minute by pg_cron (ftgu-idea-research).
export async function POST(request: Request) {
  if (!isCron(request)) return deny('Not allowed.', 401);
  return NextResponse.json(await researchTick());
}
