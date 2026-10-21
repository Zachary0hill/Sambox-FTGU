import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Shareable invite links (/auth/invite/<token>). The token is the invitation's random token_hash, so holding the
// link is not enough: the person must also type the email the Super Admin invited. Called twice by the invite page:
// with { token, email } to check the email, then with { token, email, password } to create the account. Confirming
// the account's email fires the auth.users trigger, which accepts the invitation (role, views, account access).
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!token || !email) return NextResponse.json({ error: 'Enter the email your invite was sent to.' }, { status: 400 });

  const admin = supabaseAdmin();
  const inv = await admin.from('invitations')
    .select('id, email, full_name, accepted_at, expires_at, workspaces(name)')
    .eq('token_hash', token).maybeSingle();
  if (inv.error || !inv.data) return NextResponse.json({ error: 'This invite link is not valid. Ask whoever invited you for a new one.' }, { status: 404 });
  if (inv.data.accepted_at) return NextResponse.json({ error: 'This invite was already accepted. Sign in with your email and password.' }, { status: 409 });
  if (new Date(inv.data.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: 'This invite has expired. Ask whoever invited you to copy a fresh link.' }, { status: 410 });
  if (inv.data.email.toLowerCase() !== email) return NextResponse.json({ error: 'That email does not match this invite. Use the email you were invited with.' }, { status: 403 });

  const ws = inv.data.workspaces as unknown as { name: string } | null;
  if (!password) return NextResponse.json({ ok: true, name: inv.data.full_name, workspace: ws ? ws.name : '' });
  if (password.length < 8) return NextResponse.json({ error: 'Use at least 8 characters.' }, { status: 400 });

  // An emailed invite (deliverInvite) already created an unconfirmed auth user for this email: finish that one.
  const prof = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  const meta = { full_name: inv.data.full_name };
  if (prof.data) {
    const u = await admin.auth.admin.getUserById(prof.data.id);
    if (u.error) return NextResponse.json({ error: u.error.message }, { status: 400 });
    if (u.data.user.email_confirmed_at) return NextResponse.json({ error: 'This email already has an account. Sign in with it instead.' }, { status: 409 });
    const up = await admin.auth.admin.updateUserById(prof.data.id, { password, email_confirm: true, user_metadata: meta });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });
  } else {
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
    if (made.error) return NextResponse.json({ error: made.error.message }, { status: 400 });
  }

  const done = await admin.from('invitations').select('accepted_at').eq('id', inv.data.id).maybeSingle();
  if (!done.data || !done.data.accepted_at) return NextResponse.json({ error: 'Your account was created but the invite could not be applied. Ask whoever invited you to check it.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
