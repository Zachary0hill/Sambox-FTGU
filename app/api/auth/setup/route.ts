import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { matchesSetupContext, readSetupContext, SETUP_COOKIE, SETUP_TTL, signSetupContext } from '@/lib/auth/setup-context';

const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/auth/setup' };
const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Resume only inspects a signed context. The email token is consumed exclusively by an explicit verify request.
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const expectedOrigin = process.env.APP_BASE_URL ? new URL(process.env.APP_BASE_URL).origin : new URL(request.url).origin;
  if (origin !== expectedOrigin) return reply({ error: 'Open setup on the dashboard website and try again.' }, 403);
  const body = await request.json().catch(() => null);
  if (!body || !['resume', 'verify', 'password'].includes(body.action)) return reply({ error: 'Invalid setup request.' }, 400);
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return reply({ error: 'Account setup is unavailable. Please contact your team.' }, 503);
  const token = typeof body.tokenHash === 'string' ? body.tokenHash : '';
  const sb = await supabaseServer();
  const store = await cookies();
  const ctx = readSetupContext(store.get(SETUP_COOKIE)?.value || '', secret);
  const { data: claimsData } = await sb.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === 'string' ? claims.sub : '';
  const sessionId = typeof claims?.session_id === 'string' ? claims.session_id : '';
  const matches = matchesSetupContext(ctx, userId, sessionId, token);
  if (body.action === 'resume') return reply({ verified: matches });
  if (body.action === 'verify') {
    if (matches) return reply({ verified: true });
    if (!token) return reply({ error: 'Open your invite email to begin setup.' }, 400);
    const result = await sb.auth.verifyOtp({ token_hash: token, type: body.tokenType === 'magiclink' ? 'magiclink' : 'invite' });
    if (result.error || !result.data.session || !result.data.user) {
      return reply({ error: 'This invite link is expired or already used. If you started setup, use password recovery. Otherwise ask your team for a fresh invite.' }, 400);
    }
    const verified = await sb.auth.getClaims();
    const sid = verified.data?.claims?.session_id;
    if (typeof sid !== 'string') return reply({ error: 'Could not resume setup. Use password recovery to finish your account.' }, 400);
    store.set(SETUP_COOKIE, signSetupContext(result.data.user.id, sid, token, secret), { ...cookieOptions, maxAge: SETUP_TTL });
    return reply({ verified: true });
  }
  // An ordinary session alone never authorizes this password-setup endpoint.
  if (!matches) return reply({ error: 'Your setup session has ended. Use password recovery to finish setting your password.' }, 401);
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError || userData.user?.id !== ctx?.userId) return reply({ error: 'Sign in again or use password recovery to continue.' }, 401);
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) return reply({ error: 'Use at least 8 characters.' }, 400);
  const updated = await sb.auth.updateUser({ password });
  if (updated.error) return reply({ error: updated.error.message }, 400);
  store.set(SETUP_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return reply({ ok: true });
}
