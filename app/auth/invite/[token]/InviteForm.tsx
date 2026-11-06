'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { css } from '@/lib/studio/css';
import { Shell, Steps, Notice, Skeleton, Arrow, Success, PasswordFields, LABEL, INPUT, H1, BTN_PRIMARY, BTN_GHOST, TEXT_LINK } from '@/app/auth/ui';

// Shared invite link landing page (/auth/invite/<token>). On load it asks /api/invites/accept to describe the invite
// (workspace, role, who sent it, a masked email hint) so the page can say what it is before anyone types, and show a
// clear state for expired or already-used links. Step one checks the typed email against the invitation; step two
// sets a password, which creates the account and applies the invite, then signs in with it.

type Peek = { state: 'open' | 'expired' | 'accepted'; workspace: string; role: string; account: string; inviter: string; emailHint: string; expiresAt: string };
type Verified = { name: string; workspace: string; role: string; account: string };

// Role chips use the same tones as the invite email so the link and the inbox match.
const ROLE_COPY: Record<string, { label: string; bg: string; fg: string; body: string; perks: string[] }> = {
  super_admin: { label: 'Super Admin', bg: '#111111', fg: '#FFFFFF', body: 'You will manage projects, people and workspace settings.', perks: ['Every project and view', 'Invite and manage people', 'Workspace settings'] },
  manager: { label: 'Manager', bg: '#E4F4E8', fg: '#185B2C', body: 'You will plan projects, assign work and keep clients up to date.', perks: ['Plan and assign projects', 'Review cuts and thumbnails', 'Client and sponsor updates'] },
  editor: { label: 'Editor', bg: '#2F5BD3', fg: '#FFFFFF', body: 'You will see the edits assigned to you, upload cuts and move them through review.', perks: ['Your edit queue with due dates', 'Upload cuts as versions', 'Review notes in your Inbox'] },
  designer: { label: 'Designer', bg: '#7A45C4', fg: '#FFFFFF', body: 'You will see the thumbnails assigned to you, upload options and pitch ideas.', perks: ['Your thumbnail queue', 'Upload options side by side', 'Pitch ideas to the team'] },
  sponsor: { label: 'Sponsor', bg: '#9A6A00', fg: '#FFFFFF', body: 'You will follow {account} projects, review drafts and approve videos before they publish.', perks: ['Every {account} project and its stage', 'Review drafts before they go live', 'Approve or request changes'] },
  client: { label: 'Client', bg: '#9A6A00', fg: '#FFFFFF', body: 'You will follow {account} projects, review drafts and share feedback with the team.', perks: ['Every {account} project and its stage', 'Publish dates at a glance', 'Share feedback with the team'] },
};

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

export default function InviteForm({ token }: { token: string }) {
  const sb = supabaseBrowser();
  const [peek, setPeek] = useState<Peek | null | 'loading' | 'invalid'>('loading');
  const [email, setEmail] = useState('');
  const [verified, setVerified] = useState<Verified | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<'' | 'opening' | 'signin'>('');

  async function post(body: Record<string, string>) {
    const res = await fetch('/api/invites/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...body }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  useEffect(() => {
    let active = true;
    post({}).then((d) => { if (active) setPeek(d as Peek); }).catch(() => { if (active) setPeek('invalid'); });
    return () => { active = false; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (verified && password.length < 8) return setErr('Use at least 8 characters.');
    if (verified && password !== confirm) return setErr('The passwords do not match.');
    setBusy(true);
    try {
      if (!verified) {
        const data = await post({ email: email.trim() });
        setVerified({ name: data.name || '', workspace: data.workspace || '', role: data.role || '', account: data.account || '' });
        setBusy(false);
        return;
      }
      await post({ email: email.trim(), password });
      setDone('opening');
      const s = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (s.error) { setDone('signin'); setBusy(false); return; }
      window.location.href = window.location.origin + '/';
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const info = peek && typeof peek === 'object' ? peek : null;
  const roleKey = verified?.role || info?.role || '';
  const role = ROLE_COPY[roleKey] || null;
  const account = verified?.account || info?.account || '';
  const workspace = verified?.workspace || info?.workspace || '';
  const first = verified?.name ? verified.name.split(' ')[0] : '';
  const fill = (s: string) => s.replace('{account}', account || 'your');

  // Full-card states that need no form: still loading, bad link, used link, expired link, and the success screen.
  if (peek === 'loading') {
    return (
      <Shell workspace="">
        <div aria-busy="true" aria-live="polite" style={css('display: flex; flex-direction: column; gap: 12px')}>
          <Skeleton w="60%" h={28} /><Skeleton w="90%" h={14} /><Skeleton w="100%" h={64} r={16} /><Skeleton w="100%" h={44} r={12} />
          <span style={css('position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);')}>Checking your invite…</span>
        </div>
      </Shell>
    );
  }
  if (peek === 'invalid' || !info) {
    return (
      <Shell workspace="">
        <Notice tone="red" title="This invite link is not valid" body="The link may have been copied incompletely, or it has been replaced. Ask whoever invited you to send a fresh one." />
        <Link href="/login" style={css(BTN_GHOST)}>Go to sign in</Link>
      </Shell>
    );
  }
  if (info.state === 'accepted') {
    return (
      <Shell workspace={workspace}>
        <Notice tone="green" title="This invite is already in use" body={'An account for ' + (info.emailHint || 'this invite') + ' is set up. Sign in with that email and your password.'} />
        <Link href="/login" style={css(BTN_PRIMARY)}>Sign in<Arrow /></Link>
        <Link href="/auth/setup?type=recovery" style={css(TEXT_LINK + ' align-self: center;')}>Forgot your password?</Link>
      </Shell>
    );
  }
  if (info.state === 'expired') {
    return (
      <Shell workspace={workspace}>
        <Notice tone="amber" title="This invite has expired" body={'Invite links work for 14 days. Ask ' + (info.inviter || 'whoever invited you') + ' to copy a fresh link from Users, or resend your invite email.'} />
        <Link href="/login" style={css(BTN_GHOST)}>Already have an account? Sign in</Link>
      </Shell>
    );
  }
  if (done) return <Shell workspace={workspace}><Success first={first} workspace={workspace} mode={done} /></Shell>;

  const left = daysLeft(info.expiresAt);
  const pwOk = password.length >= 8;
  const matchOk = confirm.length > 0 && password === confirm;

  return (
    <Shell workspace={workspace} as="form" onSubmit={submit}>
      <Steps current={verified ? 2 : 1} />
      <div style={css('display: flex; flex-direction: column; gap: 8px')}>
        <h1 style={css(H1)}>
          {verified ? (first ? 'Welcome, ' + first : 'Create your password') : workspace ? 'Join ' + workspace : 'Accept your invite'}
        </h1>
        <p style={css('margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted);')}>
          {verified
            ? 'Choose a password to finish joining' + (workspace ? ' ' + workspace : ' the board') + '. You will use it with this email to sign in.'
            : (info.inviter ? info.inviter + ' invited you' : 'You have been invited') + ' to the ' + (workspace || 'SantosStudios') + ' production board' + (role ? ' as ' + (/^[aeiou]/i.test(role.label) ? 'an ' : 'a ') + role.label.toLowerCase() : '') + '.'}
        </p>
      </div>

      {role ? (
        <div style={css('display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--line-4);')}>
          <div style={css('display: flex; gap: 10px; align-items: center; flex-wrap: wrap')}>
            <span style={css('display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: ' + role.bg + '; color: ' + role.fg + ';')}>{role.label}</span>
            {account ? <span style={css('font-size: 13px; font-weight: 600; color: var(--ink-2);')}>{account}</span> : null}
          </div>
          <ul style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px;')}>
            {role.perks.map((p) => (
              <li key={p} style={css('display: flex; gap: 8px; align-items: flex-start; font-size: 13px; line-height: 1.45; color: var(--ink-2);')}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={css('flex: none; margin-top: 2px; color: var(--green-ink);')}><path d="M20 6 9 17l-5-5" /></svg>
                <span>{fill(p)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={css('display: flex; flex-direction: column; gap: 6px')}>
        <div style={css('display: flex; justify-content: space-between; align-items: baseline; gap: 8px;')}>
          <label htmlFor="inv-email" style={css(LABEL)}>Email</label>
          {!verified && info.emailHint ? <span style={css('font-size: 12px; color: var(--muted-2);')}>Invited as {info.emailHint}</span> : null}
        </div>
        <input id="inv-email" type="email" required autoComplete="email" placeholder="name@company.com" value={email} readOnly={!!verified} autoFocus={!verified}
          onChange={(e) => setEmail(e.target.value)} style={css(INPUT + (verified ? ' color: var(--muted);' : ''))} />
        {verified ? (
          <button type="button" onClick={() => { setVerified(null); setPassword(''); setConfirm(''); setErr(''); }} style={css('align-self: flex-start; padding: 0; border: 0; background: transparent; cursor: pointer; ' + TEXT_LINK)}>Use a different email</button>
        ) : (
          <p style={css('margin: 0; font-size: 12px; line-height: 1.45; color: var(--muted-2);')}>Use the exact address your invite was sent to. The link alone does not grant access.</p>
        )}
      </div>

      {verified ? <PasswordFields id="inv" password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} autoFocus /> : null}

      {err ? <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600;')}>{err}</p> : null}

      <button type="submit" disabled={busy || (!!verified && !(pwOk && matchOk))} style={css(BTN_PRIMARY + ' opacity: ' + (busy || (verified && !(pwOk && matchOk)) ? '0.6' : '1') + ';')}>
        {busy ? (verified ? 'Creating your account…' : 'Checking…') : verified ? 'Set password and open the board' : 'Continue'}
        {!busy ? <Arrow /> : null}
      </button>

      <div style={css('display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;')}>
        <Link href="/login" style={css(TEXT_LINK)}>Already have an account? Sign in</Link>
        {left <= 3 ? <span style={css('font-size: 12px; font-weight: 600; color: var(--amber-ink);')}>{left === 0 ? 'Expires today' : 'Expires in ' + left + ' day' + (left === 1 ? '' : 's')}</span> : <span style={css('font-size: 12px; color: var(--faint);')}>Link valid for {left} days</span>}
      </div>
    </Shell>
  );
}
