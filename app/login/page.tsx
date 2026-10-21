'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { css } from '@/lib/studio/css';

// Invite only: new people join through the /auth/setup link in their invite email, so there's no sign up here.
type Mode = 'password' | 'link';

// Sign in, styled with the board's light tokens (same card and field styles as the design's dialogs).
export default function LoginPage() {
  const sb = supabaseBrowser();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'err' | 'ok'; text: string } | null>(null);

  const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') || '/' : '/';
  const redirectTo = typeof window !== 'undefined' ? window.location.origin + '/auth/callback?next=' + encodeURIComponent(next) : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'password') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = next;
        return;
      }
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
      if (error) throw error;
      setMsg({ tone: 'ok', text: 'Check your inbox for a sign in link.' });
    } catch (err) {
      setMsg({ tone: 'err', text: err instanceof Error ? err.message : 'Could not sign in.' });
    } finally {
      setBusy(false);
    }
  }

  const label = 'margin: 0; font-size: 13px; font-weight: 600; color: var(--ink-2);';
  const input = 'width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-size: 14px; color: var(--ink);';
  const seg = (on: boolean) => 'flex: 1; min-height: 36px; padding: 0 12px; border: 0; border-radius: 10px; cursor: pointer; font-size: 13px; ' + (on ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06);' : 'background: transparent; color: var(--muted);');

  return (
    <main style={css('--page: #EBEBEB; --surface: #FFFFFF; --surface-2: #FAFAFA; --track: #F0F0F0; --ink: #111111; --ink-2: #2A2A2A; --muted: #666666; --muted-2: #707070; --faint: #8A8A8A; --border: #E6E6E6; --line-4: #ECECEC; --inv: #111111; --inv-ink: #FFFFFF; --red-soft: #FDE8E5; --red-ink: #9B1C13; --green-soft: #E6F5EC; --green-ink: #1B653B; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: var(--page); font-family: var(--font-main); color: var(--ink);')}>
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
        <h1 style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h3); font-weight: var(--weight-black); line-height: 1.15; letter-spacing: -0.03em;')}>
          Sign in
        </h1>
        <div role="tablist" aria-label="Sign in method" style={css('display: flex; gap: 4px; padding: 4px; background: var(--track); border-radius: 14px')}>
          <button type="button" role="tab" aria-selected={mode === 'password'} onClick={() => setMode('password')} style={css(seg(mode === 'password'))}>Password</button>
          <button type="button" role="tab" aria-selected={mode === 'link'} onClick={() => setMode('link')} style={css(seg(mode === 'link'))}>Email link</button>
        </div>
        <div style={css('display: flex; flex-direction: column; gap: 6px')}>
          <label htmlFor="li-email" style={css(label)}>Email</label>
          <input id="li-email" type="email" required autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} style={css(input)} />
        </div>
        {mode === 'password' ? (
          <div style={css('display: flex; flex-direction: column; gap: 6px')}>
            <label htmlFor="li-pw" style={css(label)}>Password</label>
            <div style={css('position: relative')}>
              <input id="li-pw" type={showPw ? 'text' : 'password'} required minLength={8} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={css(input + ' padding-right: 48px;')} />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} aria-controls="li-pw" style={css('position: absolute; top: 50%; right: 6px; transform: translateY(-50%); width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 10px; background: transparent; color: var(--muted); cursor: pointer;')}>
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>
        ) : null}
        {mode === 'link' ? <p style={css('margin: 0; font-size: 13px; color: var(--muted);')}>FTGU Studio is invite only. Use the email your invite was sent to.</p> : null}
        {msg ? (
          <p role={msg.tone === 'err' ? 'alert' : 'status'} style={css('margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; ' + (msg.tone === 'err' ? 'background: var(--red-soft); color: var(--red-ink);' : 'background: var(--green-soft); color: var(--green-ink);'))}>{msg.text}</p>
        ) : null}
        <button type="submit" disabled={busy} style={css('min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); cursor: pointer; opacity: ' + (busy ? '0.6' : '1') + ';')}>
          {mode === 'password' ? 'Sign in' : 'Email me a link'}
        </button>
      </form>
    </main>
  );
}
