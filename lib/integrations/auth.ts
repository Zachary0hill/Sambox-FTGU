import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export type MemberContext = {
  user_id: string;
  workspace_id: string;
  workspace_name: string;
  role: 'super_admin' | 'editor' | 'designer' | 'sponsor' | 'client';
  is_owner: boolean;
  profile: { full_name?: string; email?: string } | null;
};

export type Member = { supabase: Awaited<ReturnType<typeof supabaseServer>>; ctx: MemberContext };

// The signed-in member and their session client, or null when signed out or not an active member.
export async function getMember(): Promise<Member | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('my_context');
  return data ? { supabase, ctx: data as MemberContext } : null;
}

export const isSuperAdmin = (m: Member | null): m is Member => !!m && m.ctx.role === 'super_admin';

export const deny = (error: string, status = 403) => NextResponse.json({ error }, { status });

// Scheduled callers (Vercel Cron, pg_cron) send `Authorization: Bearer $CRON_SECRET`.
export function isCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get('authorization') || '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
