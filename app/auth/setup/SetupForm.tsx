'use client';
import { useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import { css } from '@/lib/studio/css';

// Invite landing page. The one-time token from the email is verified only when the person submits,
// so email link scanners that open the URL cannot use it up.
export default function SetupForm({ tokenHash, type }: { tokenHash: string; type: EmailOtpType }) {
  const sb = supabaseBrowser();
  const signIn = type === 'magiclink';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!signIn && password.length < 8) return setErr('Use at least 8 characters.');
    if (!signIn && password !== confirm) return setErr('The passwords do not match.');
    setBusy(true);
    try {
      const v = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
      if (v.error) throw new Error(/expired|invalid/i.test(v.error.message) ? 'This link has expired or was already used. Ask whoever invited you to resend it.' : v.error.message);
      if (!signIn) {
        const u = await sb.auth.updateUser({ password });
        if (u.error) throw u.error;
      }
      window.location.href = window.location.origin + '/';
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
          <span aria-hidden="true" style={css('width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--inv); color: var(--inv-ink);')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18zM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4" /></svg>
          </span>
          <div style={css('display: flex; flex-direction: column; gap: 2px')}>
            <p style={css('margin: 0; font-size: 15px; font-weight: 700; line-height: 1.25; letter-spacing: -0.01em;')}>YouTube Studio</p>
            <p style={css('margin: 0; font-size: 13px; line-height: 1.3; color: var(--muted-2);')}>Production board</p>
          </div>
        </div>
        <div style={css('display: flex; flex-direction: column; gap: 8px')}>
          <h1 style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h3); font-weight: var(--weight-black); line-height: 1.15; letter-spacing: -0.03em;')}>
            {signIn ? 'You have been added' : 'Set your password'}
          </h1>
          <p style={css('margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted);')}>
            {signIn ? 'Continue to open the board with your account.' : 'Choose a password to finish accepting your invite. You will use it with this email to sign in.'}
          </p>
        </div>
        {!tokenHash ? (
          <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600;')}>This link is missing its token. Open the button in your invite email again.</p>
        ) : null}
        {!signIn ? (
          <>
            <div style={css('display: flex; flex-direction: column; gap: 6px')}>
              <label htmlFor="su-pw" style={css(label)}>Password</label>
              <input id="su-pw" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} style={css(input)} />
            </div>
            <div style={css('display: flex; flex-direction: column; gap: 6px')}>
              <label htmlFor="su-pw2" style={css(label)}>Confirm password</label>
              <input id="su-pw2" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={css(input)} />
            </div>
          </>
        ) : null}
        {err ? <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600;')}>{err}</p> : null}
        <button type="submit" disabled={busy || !tokenHash} style={css('min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); cursor: pointer; opacity: ' + (busy || !tokenHash ? '0.6' : '1') + ';')}>
          {signIn ? 'Continue to the board' : 'Set password and continue'}
        </button>
      </form>
    </main>
  );
}
