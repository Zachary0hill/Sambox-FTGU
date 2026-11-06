'use client';
import { useEffect, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import Link from 'next/link';
import { css } from '@/lib/studio/css';
import { Shell, Steps, Success, PasswordFields, Arrow, LABEL, INPUT, H1, BTN_PRIMARY, TEXT_LINK } from '@/app/auth/ui';

// Invite landing page. The one-time token from the email is verified only when the person submits,
// so email link scanners that open the URL cannot use it up. Password resets land here too (type 'recovery'):
// /auth/callback has already signed them in, so there is no token and only the new password is saved. Opened
// without that session (signed out, or from the sign in page's "Forgot password?"), it asks for the email instead
// and sends the reset link.
export default function SetupForm({ tokenHash, type, passwordSetup = false }: { tokenHash: string; type: EmailOtpType; passwordSetup?: boolean }) {
  const sb = supabaseBrowser();
  const signIn = type === 'magiclink' && !passwordSetup;
  const reset = type === 'recovery';
  const invite = !signIn && !reset;
  const [verified, setVerified] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(invite);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  // Reset only: null while checking, then whether the reset link signed this browser in.
  const [hasSession, setHasSession] = useState<boolean | null>(reset ? null : true);
  const requesting = reset && hasSession === false;
  const missingSetup = !tokenHash && !reset && !verified && !checkingSetup;
  const submitDisabled = busy || checkingSetup || hasSession === null || missingSetup;

  useEffect(() => {
    if (!reset) return;
    sb.auth.getSession().then((res: { data: { session: unknown } }) => setHasSession(!!res.data.session));
  }, [reset, sb]);

  useEffect(() => {
    if (!invite) return;
    let active = true;
    setupRequest({ action: 'resume', tokenHash }).then((data) => {
      if (active) setVerified(data.verified === true);
    }).catch(() => {
      // Verification on submit can still recover after a transient resume failure.
    }).finally(() => { if (active) setCheckingSetup(false); });
    return () => { active = false; };
  }, [invite, tokenHash]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (requesting) {
      setBusy(true);
      const redirectTo = window.location.origin + '/auth/callback?next=' + encodeURIComponent('/auth/setup?type=recovery');
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      setBusy(false);
      if (error) return setErr(error.message);
      return setSent(true);
    }
    if (!signIn && password.length < 8) return setErr('Use at least 8 characters.');
    if (!signIn && password !== confirm) return setErr('The passwords do not match.');
    setBusy(true);
    try {
      if (invite) {
        // A separate response persists the verified context before password saving can fail.
        if (!verified) {
          await setupRequest({ action: 'verify', tokenHash, tokenType: type });
          setVerified(true);
          window.history.replaceState(null, '', '/auth/setup');
        }
        await setupRequest({ action: 'password', tokenHash, password });
      } else if (!reset) {
        const v = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
        if (v.error) throw new Error(/expired|invalid/i.test(v.error.message) ? 'This link has expired or was already used. Ask whoever invited you to resend it.' : v.error.message);
      }
      if (reset) {
        const u = await sb.auth.updateUser({ password });
        if (u.error && reset && /session/i.test(u.error.message)) { setHasSession(false); throw new Error('This reset link has expired. Enter your email to get a new one.'); }
        if (u.error) throw u.error;
      }
      if (invite) setDone(true);
      window.location.href = window.location.origin + (reset ? '/settings' : '/');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const pwReady = signIn || requesting || (password.length >= 8 && password === confirm);
  if (done) return <Shell workspace=""><Success first="" workspace="" mode="opening" /></Shell>;

  return (
    <Shell workspace="" as="form" onSubmit={submit}>
        {invite ? <Steps current={2} /> : null}
        <div style={css('display: flex; flex-direction: column; gap: 8px')}>
          <h1 style={css(H1)}>
            {signIn ? 'You have been added' : requesting ? 'Reset your password' : reset ? 'Choose a new password' : 'Set your password'}
          </h1>
          <p style={css('margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted);')}>
            {signIn ? 'Continue to open the board with your account.' : requesting ? 'Enter the email you sign in with and we will send you a link to choose a new password.' : reset ? 'Enter a new password for your account. You will use it with your email to sign in.' : 'Choose a password to finish accepting your invite. You will use it with this email to sign in.'}
          </p>
        </div>
        {missingSetup ? (
          <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600;')}>Open your invite email to begin. If you already started setup, use password recovery to finish.</p>
        ) : null}
        {requesting ? (
          <div style={css('display: flex; flex-direction: column; gap: 6px')}>
            <label htmlFor="su-email" style={css(LABEL)}>Email</label>
            <input id="su-email" type="email" required autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => { setEmail(e.target.value); setSent(false); }} style={css(INPUT)} />
          </div>
        ) : null}
        {sent ? (
          <p role="status" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: #E6F5EC; color: #1B653B; font-size: 13px; font-weight: 600;')}>If that email has an account, a reset link is on its way. Open it in this browser.</p>
        ) : null}
        {!signIn && !requesting ? <PasswordFields id="su" password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} autoFocus={invite} /> : null}
        {err ? <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600;')}>{err}</p> : null}
        <button type="submit" disabled={submitDisabled || !pwReady} style={css(BTN_PRIMARY + ' opacity: ' + (submitDisabled || !pwReady ? '0.6' : '1') + ';')}>
          {busy ? (invite ? 'Creating your account…' : 'Working…') : signIn ? 'Continue to the board' : requesting ? (sent ? 'Send again' : 'Email me a reset link') : reset ? 'Save new password' : 'Set password and open the board'}
          {!busy ? <Arrow /> : null}
        </button>
        {invite && (err || missingSetup) ? (
          <Link href="/auth/setup?type=recovery" style={css('font-size: 13px; color: var(--ink); text-decoration: underline;')}>Recover your password</Link>
        ) : null}
        {reset || invite ? (
          <Link href="/login" style={css(TEXT_LINK + ' align-self: center;')}>Back to sign in</Link>
        ) : null}
    </Shell>
  );
}

async function setupRequest(body: Record<string, string>) {
  const response = await fetch('/api/auth/setup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not finish setup. Please try again.');
  return data;
}
