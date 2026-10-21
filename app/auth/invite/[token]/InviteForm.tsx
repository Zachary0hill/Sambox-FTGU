'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { css } from '@/lib/studio/css';

// Shared invite link landing page. Step one checks the typed email against the invitation (/api/invites/accept);
// step two sets a password, which creates the account and applies the invite, then signs in with it.
export default function InviteForm({ token }: { token: string }) {
  const sb = supabaseBrowser();
  const [email, setEmail] = useState('');
  const [verified, setVerified] = useState<{ name: string; workspace: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function post(body: Record<string, string>) {
    const res = await fetch('/api/invites/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, email: email.trim(), ...body }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (verified && password.length < 8) return setErr('Use at least 8 characters.');
    if (verified && password !== confirm) return setErr('The passwords do not match.');
    setBusy(true);
    try {
      if (!verified) {
        const data = await post({});
        setVerified({ name: data.name || '', workspace: data.workspace || '' });
        setBusy(false);
        return;
      }
      await post({ password });
      const s = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (s.error) throw new Error('Your account is ready, but signing in failed: ' + s.error.message);
      window.location.href = window.location.origin + '/';
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const label = 'margin: 0; font-size: 13px; font-weight: 600; color: var(--ink-2);';
  const input = 'width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-size: 14px; color: var(--ink);';
  const first = verified && verified.name ? verified.name.split(' ')[0] : '';

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
            {verified ? (first ? 'Welcome, ' + first : 'Set your password') : 'Accept your invite'}
          </h1>
          <p style={css('margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted);')}>
            {verified
              ? 'Choose a password to join' + (verified.workspace ? ' ' + verified.workspace : ' the board') + '. You will use it with this email to sign in.'
              : 'Enter the email address you were invited with to continue.'}
          </p>
        </div>
        <div style={css('display: flex; flex-direction: column; gap: 6px')}>
          <label htmlFor="inv-email" style={css(label)}>Email</label>
          <input id="inv-email" type="email" required autoComplete="email" placeholder="name@company.com" value={email} readOnly={!!verified}
            onChange={(e) => setEmail(e.target.value)} style={css(input + (verified ? ' color: var(--muted);' : ''))} />
          {verified ? (
            <button type="button" onClick={() => { setVerified(null); setPassword(''); setConfirm(''); setErr(''); }} style={css('align-self: flex-start; padding: 0; border: 0; background: transparent; font-size: 13px; font-weight: 600; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; cursor: pointer;')}>Use a different email</button>
          ) : null}
        </div>
        {verified ? (
          <>
            <div style={css('display: flex; flex-direction: column; gap: 6px')}>
              <label htmlFor="inv-pw" style={css(label)}>Password</label>
              <div style={css('position: relative')}>
                <input id="inv-pw" type={showPw ? 'text' : 'password'} required minLength={8} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} style={css(input + ' padding-right: 48px;')} />
                <EyeToggle shown={showPw} toggle={() => setShowPw((v) => !v)} controls="inv-pw inv-pw2" />
              </div>
            </div>
            <div style={css('display: flex; flex-direction: column; gap: 6px')}>
              <label htmlFor="inv-pw2" style={css(label)}>Confirm password</label>
              <div style={css('position: relative')}>
                <input id="inv-pw2" type={showPw ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={css(input + ' padding-right: 48px;')} />
                <EyeToggle shown={showPw} toggle={() => setShowPw((v) => !v)} controls="inv-pw inv-pw2" />
              </div>
            </div>
          </>
        ) : null}
        {err ? <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600;')}>{err}</p> : null}
        <button type="submit" disabled={busy} style={css('min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); cursor: pointer; opacity: ' + (busy ? '0.6' : '1') + ';')}>
          {verified ? 'Set password and continue' : 'Continue'}
        </button>
        <Link href="/login" style={css('align-self: center; font-size: 13px; font-weight: 600; color: var(--muted); text-decoration: underline; text-underline-offset: 3px;')}>Already have an account? Sign in</Link>
      </form>
    </main>
  );
}

// Same show/hide control as the sign in and setup pages. One switch reveals both fields so they can be compared.
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
