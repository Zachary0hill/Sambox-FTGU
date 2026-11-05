import { NextResponse, type NextRequest } from 'next/server';
import { safeAuthNext } from '@/lib/auth/safe-next';
import { supabaseServer } from '@/lib/supabase/server';

// Magic links, signup confirmations and password resets land here with a one-time code.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  // Railway's internal request URL can be localhost:8080; email callbacks must return to the public origin.
  const origin = new URL(process.env.APP_BASE_URL || url.origin).origin;
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  const safeNext = safeAuthNext(next);
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, origin));
  }
  return NextResponse.redirect(new URL('/login?error=link', origin));
}
