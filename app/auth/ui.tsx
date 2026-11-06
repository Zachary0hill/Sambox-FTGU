'use client';
import NextImage from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { css } from '@/lib/studio/css';

// Shared chrome for the sign up pages (/auth/invite and /auth/setup): the light-theme tokens, the card, the three-step
// progress strip, status notices and the small form helpers, so both entry points look and behave the same.

export const TOKENS = '--page: #EBEBEB; --surface: #FFFFFF; --surface-2: #FAFAFA; --ink: #111111; --ink-2: #2A2A2A; --muted: #666666; --muted-2: #707070; --faint: #8A8A8A; --border: #E6E6E6; --line-4: #ECECEC; --inv: #111111; --inv-ink: #FFFFFF; --red-soft: #FDE8E5; --red-ink: #9B1C13; --green-soft: #E6F5EC; --green-ink: #1B653B; --amber-soft: #FFF4D6; --amber-ink: #6B4A00;';
export const LABEL = 'margin: 0; font-size: 13px; font-weight: 600; color: var(--ink-2);';
export const INPUT = 'width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-size: 14px; color: var(--ink);';
export const BTN = 'display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 14px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none;';
export const BTN_PRIMARY = BTN + ' border: 0; background: var(--inv); color: var(--inv-ink);';
export const BTN_GHOST = BTN + ' border: 1px solid var(--border); background: var(--surface); color: var(--ink);';
export const TEXT_LINK = 'font-size: 13px; font-weight: 600; color: var(--muted); text-decoration: underline; text-underline-offset: 3px;';
export const H1 = 'margin: 0; font-family: var(--font-title); font-size: var(--text-h3); font-weight: var(--weight-black); line-height: 1.15; letter-spacing: -0.03em;';

// 0 none, 1 meets the minimum, 2 longer or has a symbol, 3 long with upper case and a digit.
export function passwordStrength(pw: string) {
  if (pw.length < 8) return 0;
  if (pw.length >= 12 && /[A-Z]/.test(pw) && /[0-9]/.test(pw)) return 3;
  if (pw.length >= 10 || /[^a-zA-Z0-9]/.test(pw)) return 2;
  return 1;
}

// Password field pair with the show/hide switch, a strength strip and live requirement checks.
export function PasswordFields({ id, password, confirm, onPassword, onConfirm, autoFocus }: { id: string; password: string; confirm: string; onPassword: (v: string) => void; onConfirm: (v: string) => void; autoFocus?: boolean }) {
  const [shown, setShown] = useState(false);
  const pwOk = password.length >= 8;
  const matchOk = confirm.length > 0 && password === confirm;
  const strength = passwordStrength(password);
  const ids = id + '-pw ' + id + '-pw2';
  return (
    <>
      <div style={css('display: flex; flex-direction: column; gap: 6px')}>
        <label htmlFor={id + '-pw'} style={css(LABEL)}>Password</label>
        <div style={css('position: relative')}>
          <input id={id + '-pw'} type={shown ? 'text' : 'password'} required minLength={8} autoComplete="new-password" autoFocus={autoFocus} value={password} onChange={(e) => onPassword(e.target.value)} aria-describedby={id + '-pw-help'} style={css(INPUT + ' padding-right: 48px;')} />
          <EyeToggle shown={shown} toggle={() => setShown((v) => !v)} controls={ids} />
        </div>
        <div aria-hidden="true" style={css('display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 2px;')}>
          {[1, 2, 3].map((n) => <span key={n} style={css('height: 4px; border-radius: 2px; background: ' + (strength >= n ? (strength === 1 ? 'var(--amber-ink)' : 'var(--green-ink)') : 'var(--line-4)') + '; transition: background 160ms;')} />)}
        </div>
        <ul id={id + '-pw-help'} style={css('margin: 2px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px;')}>
          <Check ok={pwOk} text="At least 8 characters" />
          <Check ok={matchOk} text="Both passwords match" />
          {strength === 3 ? <Check ok text="Strong password" /> : null}
        </ul>
      </div>
      <div style={css('display: flex; flex-direction: column; gap: 6px')}>
        <label htmlFor={id + '-pw2'} style={css(LABEL)}>Confirm password</label>
        <div style={css('position: relative')}>
          <input id={id + '-pw2'} type={shown ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => onConfirm(e.target.value)} style={css(INPUT + ' padding-right: 48px;')} />
          <EyeToggle shown={shown} toggle={() => setShown((v) => !v)} controls={ids} />
        </div>
      </div>
    </>
  );
}

// Shown once the account exists: a check mark, then either the redirect message or a sign in button.
export function Success({ first, workspace, mode }: { first: string; workspace: string; mode: 'opening' | 'signin' }) {
  return (
    <>
      <Steps current={3} />
      <div style={css('display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 8px 0;')}>
        <span aria-hidden="true" style={css('width: 56px; height: 56px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--green-soft); color: var(--green-ink);')}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <h1 style={css(H1)}>You&apos;re in{first ? ', ' + first : ''}</h1>
        <p role="status" style={css('margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted);')}>
          {mode === 'opening' ? 'Your account is ready. Opening ' + (workspace || 'the board') + '…' : 'Your account is ready, but we could not sign you in automatically. Sign in with your email and the password you just set.'}
        </p>
      </div>
      {mode === 'signin' ? <Link href="/login" style={css(BTN_PRIMARY)}>Sign in<Arrow /></Link> : null}
    </>
  );
}

// Card and page chrome shared by every state so the page never jumps between them.
export function Shell({ children, workspace, as = 'div', onSubmit }: { children: React.ReactNode; workspace: string; as?: 'div' | 'form'; onSubmit?: (e: React.FormEvent) => void }) {
  const Tag = as;
  return (
    <main style={css(TOKENS + ' min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: var(--page); font-family: var(--font-main); color: var(--ink);')}>
      <Tag onSubmit={onSubmit} style={css('position: relative; width: 460px; max-width: 100%; box-sizing: border-box; padding: 28px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 28px; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 24px 60px rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 18px;')}>
        <div style={css('display: flex; align-items: center; gap: 12px')}>
          <span aria-hidden="true" style={css('width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: #111111;')}>
            <NextImage src="/ftgu-logo.png" alt="" width={24} height={18} style={css('display: block; width: 24px; height: auto')} />
          </span>
          <div style={css('display: flex; flex-direction: column; gap: 2px')}>
            <p style={css('margin: 0; font-family: var(--font-title); font-size: 15px; font-weight: var(--weight-black); line-height: 1.25; letter-spacing: -0.01em;')}>{workspace || 'SantosStudios'}</p>
            <p style={css('margin: 0; font-size: 13px; line-height: 1.3; color: var(--muted-2);')}>Production board</p>
          </div>
        </div>
        {children}
      </Tag>
    </main>
  );
}

const STEPS = ['Confirm email', 'Create password', 'Open the board'];
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label={'Step ' + current + ' of 3'} style={css('margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;')}>
      {STEPS.map((s, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'now' : 'next';
        return (
          <li key={s} aria-current={state === 'now' ? 'step' : undefined} style={css('display: flex; flex-direction: column; gap: 6px; min-width: 0;')}>
            <span aria-hidden="true" style={css('height: 4px; border-radius: 2px; background: ' + (state === 'next' ? 'var(--line-4)' : 'var(--inv)') + ';')} />
            <span style={css('font-size: 11px; font-weight: 600; letter-spacing: 0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ' + (state === 'now' ? 'var(--ink)' : state === 'done' ? 'var(--muted)' : 'var(--faint)') + ';')}>
              {state === 'done' ? '✓ ' : ''}{s}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Notice({ tone, title, body }: { tone: 'red' | 'green' | 'amber'; title: string; body: string }) {
  const bg = tone === 'red' ? 'var(--red-soft)' : tone === 'green' ? 'var(--green-soft)' : 'var(--amber-soft)';
  const fg = tone === 'red' ? 'var(--red-ink)' : tone === 'green' ? 'var(--green-ink)' : 'var(--amber-ink)';
  return (
    <div role="status" style={css('display: flex; flex-direction: column; gap: 8px')}>
      <span aria-hidden="true" style={css('width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: ' + bg + '; color: ' + fg + ';')}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {tone === 'green' ? <path d="M20 6 9 17l-5-5" /> : tone === 'amber' ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>}
        </svg>
      </span>
      <h1 style={css('margin: 4px 0 0; font-family: var(--font-title); font-size: var(--text-h3); font-weight: var(--weight-black); line-height: 1.15; letter-spacing: -0.03em;')}>{title}</h1>
      <p style={css('margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted);')}>{body}</p>
    </div>
  );
}

export function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li style={css('display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: ' + (ok ? 'var(--green-ink)' : 'var(--muted-2)') + ';')}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{ok ? <path d="M20 6 9 17l-5-5" /> : <circle cx="12" cy="12" r="8" />}</svg>
      <span>{text}</span>
    </li>
  );
}

export function Skeleton({ w, h, r = 8 }: { w: string; h: number; r?: number }) {
  return <span aria-hidden="true" style={css('display: block; width: ' + w + '; height: ' + h + 'px; border-radius: ' + r + 'px; background: var(--line-4);')} />;
}

export function Arrow() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>;
}

// Same show/hide control as the sign in and setup pages. One switch reveals both fields so they can be compared.
export function EyeToggle({ shown, toggle, controls }: { shown: boolean; toggle: () => void; controls: string }) {
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
