'use client';
import { useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { UI_ROLE, labelOf } from '@/lib/studio/model';
import { css } from '@/lib/studio/css';

// First-sign-in guide for editors, designers, sponsors and clients. It is a full page (not a modal) so no board controls
// sit behind it, and it uses the board's theme tokens (rootStyle) so it matches light and dark mode.

// Clients share the sponsor portal; only the wording differs.
export function welcomeKind(role) {
  if (role === 'client') return 'client';
  const ui = UI_ROLE[role];
  return ui === 'editor' || ui === 'designer' || ui === 'sponsor' ? ui : '';
}

const ICON = {
  queue: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  status: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  idea: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  approve: 'M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  brand: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  swap: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
};

const DAY = 86400000;
const dayOf = (iso) => { if (!iso) return null; const t = Date.parse(iso + (iso.length === 10 ? 'T00:00:00' : '')); return Number.isNaN(t) ? null : Math.floor(t / DAY); };

// Everything role-specific lives here so the layout below stays the same for every role.
function guideFor({ kind, ctx, D, can }) {
  const today = Math.floor(Date.now() / DAY);
  const soon = (iso) => { const d = dayOf(iso); return d !== null && d >= today && d <= today + 7; };
  const rows = (D.rows || []).filter((r) => !r.archived);
  const brands = (D.brands || []).length > 0;

  if (kind === 'editor' || kind === 'designer') {
    const editor = kind === 'editor';
    const mine = rows.filter((r) => (editor ? r.editorId : r.designerId) === ctx.user_id);
    const open = mine.filter((r) => (editor ? r.editStatus !== 'Approved' : r.thumb !== 'Done'));
    const due = open.filter((r) => soon(editor ? r.iso?.editDue : r.iso?.thumbDue)).length;
    const fix = mine.filter((r) => (editor ? r.editStatus : r.thumb) === 'Needs Revision').length;
    const noun = editor ? 'edit' : 'thumbnail';
    // The first few things to open: revisions first, then by due date, so the list reads as a to-do list.
    const dueOf = (r) => dayOf(editor ? r.iso?.editDue : r.iso?.thumbDue);
    const items = open.slice().sort((a, b) => {
      const ra = (editor ? a.editStatus : a.thumb) === 'Needs Revision', rb = (editor ? b.editStatus : b.thumb) === 'Needs Revision';
      if (ra !== rb) return ra ? -1 : 1;
      return (dueOf(a) ?? Infinity) - (dueOf(b) ?? Infinity);
    }).slice(0, 3).map((r) => {
      const d = dueOf(r); const st = editor ? r.editStatus : r.thumb;
      return { id: r.id, job: r.job, title: r.title || r.job || 'Untitled project', meta: st || '', when: d === null ? '' : d < today ? 'Overdue' : d === today ? 'Due today' : 'Due ' + (editor ? r.editDue : r.thumbDue), tone: st === 'Needs Revision' || (d !== null && d < today) ? 'red' : d !== null && d <= today + 7 ? 'amber' : '' };
    });
    const steps = [
      { icon: 'queue', title: 'Find your ' + noun + ' queue', body: 'Projects opens filtered to work assigned to you, with due dates up front. If it looks empty, clear the filters.' },
      can('assets', 'create')
        ? { icon: 'upload', title: editor ? 'Upload your cuts' : 'Upload thumbnails', body: editor ? 'Open a project and add your draft in Files. Each upload is saved as a new version so nothing gets overwritten.' : 'Open a project and add thumbnail options in Files so the team can compare them side by side.' }
        : { icon: 'upload', title: 'Delivering files', body: 'Your access does not include uploads yet. Ask your Super Admin how to hand off files.', muted: true },
      can(editor ? 'edits' : 'thumbs', 'edit')
        ? { icon: 'status', title: 'Keep your status current', body: editor ? 'Move to Editing when you start and In Review when a draft is ready. Notes come back as Needs Revision.' : 'Move to In Design when you start and In Review when options are ready. Notes come back as Needs Revision.' }
        : { icon: 'status', title: 'Status is view only', body: 'You can see where each ' + noun + ' stands. Ask your Super Admin if you need to change status yourself.', muted: true },
      editor
        ? { icon: 'inbox', title: 'Watch your Inbox', body: 'Mentions, review notes and deadline changes on your projects land in Inbox.' }
        : { icon: 'idea', title: 'Pitch ideas', body: 'Add concepts to the Ideas board. The team reviews them and approved ideas become projects.' },
    ];
    return {
      role: editor ? 'Editor' : 'Designer',
      lead: open.length
        ? 'You have ' + open.length + ' ' + noun + (open.length === 1 ? '' : 's') + ' in progress. Here is how work moves through the board.'
        : 'Your account is ready. Your first ' + noun + ' will show up here as soon as it is assigned.',
      stats: [
        { label: 'Assigned to you', value: open.length },
        { label: 'Due in 7 days', value: due, tone: due ? 'amber' : '' },
        { label: 'Needs revision', value: fix, tone: fix ? 'red' : '' },
      ],
      steps,
      items, itemsTitle: 'Start here',
      primary: { label: 'Open my ' + noun + ' queue', go: 'queue' },
      secondary: brands ? { label: 'Brand resources', go: 'brand' } : null,
    };
  }

  // Sponsors and clients see a read-mostly portal for their account(s).
  const acct = D.account || ctx.accounts?.[0] || {};
  const name = acct.name || 'your';
  const pending = rows.filter((r) => r.status === 'Sponsor Review' && (r.approval || 'Pending') === 'Pending').length;
  const live = rows.filter((r) => r.g === 'pub').length;
  const who = kind === 'client' ? 'Client' : 'Sponsor';
  const waiting = (r) => r.status === 'Sponsor Review' && (r.approval || 'Pending') === 'Pending';
  const items = rows.slice().sort((a, b) => {
    if (waiting(a) !== waiting(b)) return waiting(a) ? -1 : 1;
    return (dayOf(a.iso?.pub) ?? Infinity) - (dayOf(b.iso?.pub) ?? Infinity);
  }).slice(0, 3).map((r) => {
    const d = dayOf(r.iso?.pub);
    return { id: r.id, job: r.job, title: r.title || r.job || 'Untitled project', meta: r.status || '', when: waiting(r) ? (acct.allow_approve ? 'Needs your review' : 'In review') : d === null ? '' : d < today ? 'Published' : 'Publishes ' + labelOf(r.iso.pub), tone: waiting(r) ? 'amber' : r.g === 'pub' ? 'green' : '' };
  });
  const steps = [
    { icon: 'eye', title: 'Follow every project', body: 'Projects lists each ' + name + ' video with its stage, film date and publish date.' + (acct.allow_drafts ? ' Draft cuts are shared with you as they are ready.' : '') },
    acct.allow_approve
      ? { icon: 'approve', title: 'Approve or request changes', body: 'When a project reaches Sponsor Review, open it to approve or ask for changes. Approved projects can be scheduled.' }
      : { icon: 'approve', title: 'Approvals', body: 'The production team handles sign off for this account. You still see each step as it happens.', muted: true },
    acct.allow_comment
      ? { icon: 'chat', title: 'Share feedback', body: 'Comment on a project to send notes straight to the production team.' }
      : { icon: 'inbox', title: 'Stay updated', body: 'Inbox collects updates on your projects and ideas.' },
    { icon: 'idea', title: 'Ideas and brand', body: 'Ideas shows concepts planned for your brand. Brand keeps your logos, colors and guidelines in one place.' },
  ];
  if ((ctx.accounts || []).length > 1) steps.push({ icon: 'swap', title: 'Switch accounts', body: 'You have access to ' + ctx.accounts.length + ' accounts. Use the account switcher in the sidebar to move between them.' });
  return {
    role: who,
    lead: 'This is your view of ' + (acct.name ? acct.name + ' projects' : 'your projects') + ' with ' + (ctx.workspace_name || 'the studio') + ': what is in production, what needs your sign off, and what is live.',
    stats: [
      { label: 'Projects', value: rows.length },
      { label: 'Awaiting your review', value: pending, tone: pending ? 'amber' : '' },
      { label: 'Publishing or live', value: live, tone: live ? 'green' : '' },
    ],
    steps,
    items, itemsTitle: pending ? 'Waiting on you' : 'Your projects',
    primary: pending && acct.allow_approve
      ? { label: 'Review ' + pending + ' pending approval' + (pending === 1 ? '' : 's'), go: 'projects' }
      : { label: 'View my projects', go: 'projects' },
    secondary: { label: 'See ideas', go: 'ideas' },
  };
}

function Icon({ d, size = 18 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

export default function MemberWelcome({ children, sb, ctx, D, set, reload, openMyQueue, rootStyle, manual, onManualClose }) {
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const heading = useRef(null);
  const kind = welcomeKind(ctx.role);
  const progress = D.myMembership;
  const automatic = !!kind && progress?.onboarding_required && !progress.onboarding_completed_at && !progress.onboarding_dismissed_at && !closed;
  const open = !!kind && (manual || automatic);

  // Move focus to the heading so screen readers announce the guide, and start at the top of the page.
  useEffect(() => {
    if (!open) return;
    window.scrollTo(0, 0);
    heading.current?.focus();
  }, [open]);

  if (!open) return children;

  const can = (resource, action) => (ctx.perms || []).some(([r, a]) => r === resource && a === action);
  const g = guideFor({ kind, ctx, D, can });
  const first = (ctx.profile?.full_name || '').trim().split(/\s+/)[0];

  async function finish(action, go, job) {
    if (busy) return;
    // Reopened from Settings: closing it again does not need to record anything.
    if (manual && action === 'dismiss') { onManualClose?.(); return; }
    setBusy(go || action); setError('');
    try {
      // Supabase RPC builders are PromiseLike, not Promises: await them instead of calling .catch().
      const result = await sb.rpc('save_my_onboarding', { p_action: action });
      if (result.error) throw result.error;
      setClosed(true);
      onManualClose?.();
      if (go === 'queue' && openMyQueue) openMyQueue();
      else if (go) set({ nav: go, openJob: job || '' });
      await reload();
    } catch {
      setError('Could not save your progress. Check your connection and try again.');
    } finally {
      setBusy('');
    }
  }

  const tone = { amber: 'var(--amber-soft); color: var(--amber-ink)', red: 'var(--red-soft); color: var(--red-ink)', green: 'var(--green-soft); color: var(--green-ink)' };
  const btn = 'display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; ';
  const btnPrimary = btn + 'border: 0; background: var(--inv); color: var(--inv-ink);';
  const btnGhost = btn + 'border: 1px solid var(--border); background: var(--surface); color: var(--ink);';
  const btnText = btn + 'border: 0; background: transparent; color: var(--muted); padding: 0 12px;';
  const dim = busy ? ' opacity: 0.6; cursor: progress;' : '';

  return (
    <main aria-labelledby="member-welcome-title" style={css((rootStyle || '') + ' padding: 40px 16px; align-items: center; justify-content: center;')}>
      <section className="fb-float" style={css('width: 100%; max-width: 720px; box-sizing: border-box; padding: clamp(20px, 5vw, 36px); border-radius: 28px; background: var(--surface); border: 1px solid var(--card-border); box-shadow: var(--card-shadow); display: flex; flex-direction: column; gap: 28px;')}>
        <header style={css('display: flex; flex-direction: column; gap: 16px')}>
          <div style={css('display: flex; align-items: center; gap: 12px; flex-wrap: wrap')}>
            <span aria-hidden="true" style={css('width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: #111111;')}>
              <NextImage src="/ftgu-logo.png" alt="" width={24} height={18} style={css('display: block; width: 24px; height: auto')} />
            </span>
            <span style={css('font-size: 14px; font-weight: 600; color: var(--ink-2)')}>{ctx.workspace_name || 'SantosStudios'}</span>
            <span style={css('display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 600;')}>{g.role}</span>
          </div>
          <div style={css('display: flex; flex-direction: column; gap: 8px')}>
            <h1 id="member-welcome-title" ref={heading} tabIndex={-1} style={css('margin: 0; outline: none; font-family: var(--font-title); font-size: clamp(26px, 5vw, var(--text-h1)); font-weight: var(--weight-black); line-height: 1.1; letter-spacing: -0.03em; color: var(--ink)')}>
              Welcome{first ? ', ' + first : ''}
            </h1>
            <p style={css('margin: 0; max-width: 56ch; font-size: 15px; line-height: 1.55; color: var(--muted)')}>{g.lead}</p>
          </div>
        </header>

        <dl style={css('margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 10px')}>
          {g.stats.map((st) => (
            <div key={st.label} style={css('display: flex; flex-direction: column-reverse; gap: 4px; padding: 14px 16px; border-radius: 16px; background: ' + (st.tone ? tone[st.tone] : 'var(--surface-2); color: var(--ink)') + ';')}>
              <dt style={css('font-size: 13px; font-weight: 600; opacity: 0.8')}>{st.label}</dt>
              <dd style={css('margin: 0; font-family: var(--font-title); font-size: 28px; font-weight: var(--weight-black); line-height: 1; font-variant-numeric: tabular-nums;')}>{st.value}</dd>
            </div>
          ))}
        </dl>

        {g.items && g.items.length ? (
          <div style={css('display: flex; flex-direction: column; gap: 12px')}>
            <h2 style={css('margin: 0; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; color: var(--muted-2)')}>{g.itemsTitle}</h2>
            <ul style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;')}>
              {g.items.map((it) => (
                <li key={it.id || it.title}>
                  <button type="button" disabled={!!busy} onClick={() => finish('complete', 'projects', it.job)} style={css('width: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--line-4); border-radius: 14px; background: var(--surface); color: var(--ink); text-align: left; cursor: pointer; font: inherit;' + dim)}>
                    <span style={css('display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;')}>
                      <span style={css('font-size: 14px; font-weight: 600; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>{it.title}</span>
                      {it.meta ? <span style={css('font-size: 12px; color: var(--muted);')}>{it.meta}</span> : null}
                    </span>
                    {it.when ? <span style={css('flex: none; display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: ' + (it.tone ? tone[it.tone] : 'var(--chip-2); color: var(--ink-2)') + ';')}>{it.when}</span> : null}
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css('flex: none; color: var(--faint)')}><path d="M6 3l5 5-5 5" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div style={css('display: flex; flex-direction: column; gap: 12px')}>
          <h2 style={css('margin: 0; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; color: var(--muted-2)')}>How it works</h2>
          <ol style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; border: 1px solid var(--line-4); border-radius: 18px; overflow: hidden;')}>
            {g.steps.map((st, i) => (
              <li key={st.title} style={css('display: flex; align-items: flex-start; gap: 14px; padding: 16px; ' + (i ? 'border-top: 1px solid var(--line-4);' : ''))}>
                <span aria-hidden="true" style={css('position: relative; width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: ' + (st.muted ? 'var(--surface-2)' : 'var(--chip)') + '; color: ' + (st.muted ? 'var(--muted)' : 'var(--ink)') + ';')}>
                  <Icon d={ICON[st.icon]} />
                </span>
                <span style={css('display: flex; flex-direction: column; gap: 4px; min-width: 0')}>
                  <span style={css('font-size: 15px; font-weight: 600; line-height: 1.3; color: ' + (st.muted ? 'var(--muted)' : 'var(--ink)'))}>
                    <span style={css('color: var(--faint); font-variant-numeric: tabular-nums; margin-right: 6px')}>{i + 1}.</span>{st.title}
                  </span>
                  <span style={css('font-size: 14px; line-height: 1.5; color: var(--muted)')}>{st.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {error ? <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600;')}>{error}</p> : null}

        <footer style={css('display: flex; flex-direction: column; gap: 14px')}>
          <div style={css('display: flex; gap: 10px; flex-wrap: wrap; align-items: center')}>
            <button type="button" disabled={!!busy} onClick={() => finish('complete', g.primary.go)} style={css(btnPrimary + dim)}>
              {busy === g.primary.go ? 'Opening…' : g.primary.label}
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
            </button>
            {g.secondary ? <button type="button" disabled={!!busy} onClick={() => finish('complete', g.secondary.go)} style={css(btnGhost + dim)}>{busy === g.secondary.go ? 'Opening…' : g.secondary.label}</button> : null}
            <button type="button" disabled={!!busy} onClick={() => finish('dismiss')} style={css(btnText + dim + ' margin-left: auto;')}>{busy === 'dismiss' ? 'Saving…' : manual ? 'Close' : 'Skip for now'}</button>
          </div>
          <p style={css('margin: 0; font-size: 13px; color: var(--muted-2)')}>You can reopen this guide any time from Settings.</p>
        </footer>
      </section>
    </main>
  );
}
