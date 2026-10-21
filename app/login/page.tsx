'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { css } from '@/lib/studio/css';

type Mode = 'password' | 'link' | 'signup';

// Sign in, styled with the board's light tokens (same card and field styles as the design's dialogs).
export default function LoginPage() {
  const sb = supabaseBrowser();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
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
      if (mode === 'link') {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
        if (error) throw error;
        setMsg({ tone: 'ok', text: 'Check your inbox for a sign in link.' });
      } else {
        const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, data: { full_name: name } } });
        if (error) throw error;
        setMsg({ tone: 'ok', text: 'Check your inbox to confirm your email. Your invite is applied once you confirm.' });
      }
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
          <span aria-hidden="true" style={css('width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--inv); color: var(--inv-ink);')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18zM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4" /></svg>
          </span>
          <div style={css('display: flex; flex-direction: column; gap: 2px')}>
            <p style={css('margin: 0; font-size: 15px; font-weight: 700; line-height: 1.25; letter-spacing: -0.01em;')}>YouTube Studio</p>
            <p style={css('margin: 0; font-size: 13px; line-height: 1.3; color: var(--muted-2);')}>Production board</p>
          </div>
        </div>
        <h1 style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h3); font-weight: var(--weight-black); line-height: 1.15; letter-spacing: -0.03em;')}>
          {mode === 'signup' ? 'Accept your invite' : 'Sign in'}
        </h1>
        <div role="tablist" aria-label="Sign in method" style={css('display: flex; gap: 4px; padding: 4px; background: var(--track); border-radius: 14px')}>
          <button type="button" role="tab" aria-selected={mode === 'password'} onClick={() => setMode('password')} style={css(seg(mode === 'password'))}>Password</button>
          <button type="button" role="tab" aria-selected={mode === 'link'} onClick={() => setMode('link')} style={css(seg(mode === 'link'))}>Email link</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')} style={css(seg(mode === 'signup'))}>New here</button>
        </div>
        {mode === 'signup' ? (
          <div style={css('display: flex; flex-direction: column; gap: 6px')}>
            <label htmlFor="li-name" style={css(label)}>Full name</label>
            <input id="li-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} style={css(input)} />
          </div>
        ) : null}
        <div style={css('display: flex; flex-direction: column; gap: 6px')}>
          <label htmlFor="li-email" style={css(label)}>Email</label>
          <input id="li-email" type="email" required autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} style={css(input)} />
        </div>
        {mode !== 'link' ? (
          <div style={css('display: flex; flex-direction: column; gap: 6px')}>
            <label htmlFor="li-pw" style={css(label)}>Password</label>
            <input id="li-pw" type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} style={css(input)} />
          </div>
        ) : null}
        {mode === 'signup' ? <p style={css('margin: 0; font-size: 13px; color: var(--muted);')}>Use the email your invite was sent to. Access matches the user type a Super Admin picked.</p> : null}
        {msg ? (
          <p role={msg.tone === 'err' ? 'alert' : 'status'} style={css('margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; ' + (msg.tone === 'err' ? 'background: var(--red-soft); color: var(--red-ink);' : 'background: var(--green-soft); color: var(--green-ink);'))}>{msg.text}</p>
        ) : null}
        <button type="submit" disabled={busy} style={css('min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); cursor: pointer; opacity: ' + (busy ? '0.6' : '1') + ';')}>
          {mode === 'password' ? 'Sign in' : mode === 'link' ? 'Email me a link' : 'Create account'}
        </button>
      </form>
    </main>
  );
}
