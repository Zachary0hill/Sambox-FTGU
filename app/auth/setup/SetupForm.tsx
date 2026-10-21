'use client';
import { useEffect, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import Link from 'next/link';
import { css } from '@/lib/studio/css';

// Invite landing page. The one-time token from the email is verified only when the person submits,
// so email link scanners that open the URL cannot use it up. Password resets land here too (type 'recovery'):
// /auth/callback has already signed them in, so there is no token and only the new password is saved. Opened
// without that session (signed out, or from the sign in page's "Forgot password?"), it asks for the email instead
// and sends the reset link.
export default function SetupForm({ tokenHash, type }: { tokenHash: string; type: EmailOtpType }) {
  const sb = supabaseBrowser();
  const signIn = type === 'magiclink';
  const reset = type === 'recovery';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  // Reset only: null while checking, then whether the reset link signed this browser in.
  const [hasSession, setHasSession] = useState<boolean | null>(reset ? null : true);
  const requesting = reset && hasSession === false;

  useEffect(() => {
    if (!reset) return;
    sb.auth.getSession().then((res: { data: { session: unknown } }) => setHasSession(!!res.data.session));
  }, [reset, sb]);

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
      if (!reset) {
        const v = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
        if (v.error) throw new Error(/expired|invalid/i.test(v.error.message) ? 'This link has expired or was already used. Ask whoever invited you to resend it.' : v.error.message);
      }
      if (!signIn) {
        const u = await sb.auth.updateUser({ password });
        if (u.error && reset && /session/i.test(u.error.message)) { setHasSession(false); throw new Error('This reset link has expired. Enter your email to get a new one.'); }
        if (u.error) throw u.error;
      }
      window.location.href = window.location.origin + (reset ? '/settings' : '/');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const label = 'margin: 0; font-size: 13px; font-weight: 600; color: var(--ink-2);';
  const input = 'width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-size: 14px; color: var(--ink);';

  return (
    <main style={css('--page: #EBEBEB; --surface: #FFFFFF; --surface-2: #FAFAFA; --ink: #111111; --ink-2: #2A2A2A; --muted: #666666; --muted-2: #707070; --faint: #8A8A8A; --border: #E6E6E6; --line-4: #ECECEC; --inv: #111111; --inv-ink: #FFFFFF; --red-soft: #FDE8E5; --red-ink: #9B1C13; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: var(--page); font-family: var(--font-main); color: var(--ink);')}>
      <form onSubmit={submit} style={css('width: 440px; max-width: 100%; box-sizing: border-box; padding: 28px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 28px; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 24px 60px rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 18px;')}>
        <div style={css('display: flex; align-items: center; gap: 12px')}>
          <span aria-hidden="true" style={css('width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: #111111;')}>
            <img src="/ftgu-logo.png" alt="" width={24} height={18} style={css('display: block; width: 24px; height: auto')} />
          </span>
          <div style={css('display: flex; flex-direction: column; gap: 2px')}>
            <p style={css('margin: 0; font-family: var(--font-title); font-size: 15px; font-weight: var(--weight-black); line-height: 1.25; letter-spacing: -0.01em;')}>FTGU Studio</p>
            <p style={css('margin: 0; font-size: 13px; line-height: 1.3; color: var(--muted-2);')}>Production board</p>
          </div>
        </div>
        <div style={css('display: flex; flex-direction: column; gap: 8px')}>
          <h1 style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h3); font-weight: var(--weight-black); line-height: 1.15; letter-spacing: -0.03em;')}>
            {signIn ? 'You have been added' : requesting ? 'Reset your password' : reset ? 'Choose a new password' : 'Set your password'}
          </h1>
          <p style={css('margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted);')}>
            {signIn ? 'Continue to open the board with your account.' : requesting ? 'Enter the email you sign in with and we will send you a link to choose a new password.' : reset ? 'Enter a new password for your account. You will use it with your email to sign in.' : 'Choose a password to finish accepting your invite. You will use it with this email to sign in.'}
          </p>
        </div>
        {!tokenHash && !reset ? (
          <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600;')}>This link is missing its token. Open the button in your invite email again.</p>
        ) : null}
        {requesting ? (
          <div style={css('display: flex; flex-direction: column; gap: 6px')}>
            <label htmlFor="su-email" style={css(label)}>Email</label>
            <input id="su-email" type="email" required autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => { setEmail(e.target.value); setSent(false); }} style={css(input)} />
          </div>
        ) : null}
        {sent ? (
          <p role="status" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: #E6F5EC; color: #1B653B; font-size: 13px; font-weight: 600;')}>If that email has an account, a reset link is on its way. Open it in this browser.</p>
        ) : null}
        {!signIn && !requesting ? (
          <>
            <div style={css('display: flex; flex-direction: column; gap: 6px')}>
              <label htmlFor="su-pw" style={css(label)}>Password</label>
              <div style={css('position: relative')}>
                <input id="su-pw" type={showPw ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} style={css(input + ' padding-right: 48px;')} />
                <EyeToggle shown={showPw} toggle={() => setShowPw((v) => !v)} controls="su-pw su-pw2" />
              </div>
            </div>
            <div style={css('display: flex; flex-direction: column; gap: 6px')}>
              <label htmlFor="su-pw2" style={css(label)}>Confirm password</label>
              <div style={css('position: relative')}>
                <input id="su-pw2" type={showPw ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={css(input + ' padding-right: 48px;')} />
                <EyeToggle shown={showPw} toggle={() => setShowPw((v) => !v)} controls="su-pw su-pw2" />
              </div>
            </div>
          </>
        ) : null}
        {err ? <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600;')}>{err}</p> : null}
        <button type="submit" disabled={busy || hasSession === null || (!tokenHash && !reset)} style={css('min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); cursor: pointer; opacity: ' + (busy || hasSession === null || (!tokenHash && !reset) ? '0.6' : '1') + ';')}>
          {signIn ? 'Continue to the board' : requesting ? (sent ? 'Send again' : 'Email me a reset link') : reset ? 'Save new password' : 'Set password and continue'}
        </button>
        {reset ? (
          <Link href="/login" style={css('align-self: center; font-size: 13px; font-weight: 600; color: var(--muted); text-decoration: underline; text-underline-offset: 3px;')}>Back to sign in</Link>
        ) : null}
      </form>
    </main>
  );
}

// Same show/hide control as the sign in page. One switch reveals both fields so they can be compared.
function EyeToggle({ shown, toggle, controls }: { shown: boolean; toggle: () => void; controls: string }) {
  return (
    <button type="button" onClick={toggle} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} aria-controls={controls} style={css('position: absolute; top: 50%; right: 6px; transform: translateY(-50%); width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 10px; background: transparent; color: var(--muted); cursor: pointer;')}>
      {shown ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
      )}
    </button>
  );
}
