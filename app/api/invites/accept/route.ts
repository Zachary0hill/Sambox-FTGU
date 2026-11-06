import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Shareable invite links (/auth/invite/<token>). The token is the invitation's random token_hash, so holding the
// link is not enough: the person must also type the email the Super Admin invited. Called by the invite page:
// with { token } alone to describe the invite (workspace, role, who sent it, a masked email hint) so the page can
// show context and expired/used states before anyone types; with { token, email } to check the email; then with
// { token, email, password } to create the account. Confirming the account's email fires the auth.users trigger,
// which accepts the invitation (role, views, account access).

// "zach@example.com" -> "z•••@example.com": enough to recognise the inbox, not enough to learn the address.
const maskEmail = (email: string) => {
  const at = email.indexOf('@');
  if (at <= 0) return '';
  return email[0] + '•••' + email.slice(at);
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const peek = !email && !password;
  if (!token) return NextResponse.json({ error: 'This invite link is not valid. Ask whoever invited you for a new one.' }, { status: 404 });
  if (!email && !peek) return NextResponse.json({ error: 'Enter the email your invite was sent to.' }, { status: 400 });

  const admin = supabaseAdmin();
  const inv = await admin.from('invitations')
    .select('id, email, full_name, role, accepted_at, expires_at, invited_by, workspaces(name), accounts(name)')
    .eq('token_hash', token).maybeSingle();
  if (inv.error || !inv.data) return NextResponse.json({ error: 'This invite link is not valid. Ask whoever invited you for a new one.' }, { status: 404 });

  const ws = inv.data.workspaces as unknown as { name: string } | null;
  const acct = inv.data.accounts as unknown as { name: string } | null;
  const accepted = !!inv.data.accepted_at;
  const expired = new Date(inv.data.expires_at).getTime() <= Date.now();

  if (peek) {
    let inviter = '';
    if (inv.data.invited_by) {
      const p = await admin.from('profiles').select('full_name').eq('id', inv.data.invited_by).maybeSingle();
      inviter = p.data?.full_name || '';
    }
    return NextResponse.json({
      ok: true, state: accepted ? 'accepted' : expired ? 'expired' : 'open',
      workspace: ws ? ws.name : '', role: inv.data.role, account: acct ? acct.name : '', inviter,
      emailHint: maskEmail(inv.data.email), expiresAt: inv.data.expires_at,
    });
  }

  if (accepted) return NextResponse.json({ error: 'This invite was already accepted. Sign in with your email and password.' }, { status: 409 });
  if (expired) return NextResponse.json({ error: 'This invite has expired. Ask whoever invited you to copy a fresh link.' }, { status: 410 });
  if (inv.data.email.toLowerCase() !== email) return NextResponse.json({ error: 'That email does not match this invite. Use the email you were invited with.' }, { status: 403 });

  if (!password) return NextResponse.json({ ok: true, name: inv.data.full_name, workspace: ws ? ws.name : '', role: inv.data.role, account: acct ? acct.name : '' });
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
