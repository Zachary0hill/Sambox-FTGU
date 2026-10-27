'use client';
// The board talks to an imperative data layer (Supabase client, realtime, optimistic writes). Actions read the
// latest data and member through refs at event time, which the React Compiler lint rules cannot see.
/* eslint-disable react-hooks/refs, react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StudioView from './StudioView';
import DevNotes from './DevNotes';
import { supabaseBrowser } from '@/lib/supabase/client';
import { loadContext, loadWorkspace, loadPortalDetail } from '@/lib/studio/load';
import { makeActions } from '@/lib/studio/actions';
import { computeVals } from '@/lib/studio/vals';
import { UI_ROLE, first } from '@/lib/studio/model';
import { css } from '@/lib/studio/css';

const NAV_PATH = {
  daily: '/daily', projects: '/projects', ideas: '/ideas', brand: '/brand', alerts: '/inbox', content: '/content', settings: '/settings',
  team: '/admin/users', roles: '/admin/roles', pm: '/admin/workload', clients: '/admin/clients', finance: '/admin/finance',
  auto: '/admin/automations', logs: '/admin/logs', workspace: '/admin/workspace',
};
const PATH_NAV = Object.fromEntries(Object.entries(NAV_PATH).map(([k, v]) => [v, k]));
const ACCT_KEY = 'ftgu.account';

export function navFromPath(path) {
  return PATH_NAV[path.replace(/\/+$/, '')] || 'projects';
}

const readAcct = () => { try { return window.localStorage.getItem(ACCT_KEY) || ''; } catch { return ''; } };
const initialUi = (c, data, path, project) => {
  const prefs = (c.profile && c.profile.prefs) || {};
  const settings = data.settings || {};
  return {
    role: UI_ROLE[c.role], nav: navFromPath(path || '/'), openJob: project || '', dTab: 'overview',
    panel: prefs.panel === undefined ? true : !!prefs.panel, theme: prefs.theme || settings.default_theme || 'light',
    density: prefs.density || 'Comfortable', view: prefs.view || settings.default_view || 'table',
    person: 'All', ftype: {}, fchannel: {}, fstatus: {}, sort: 'default', hidden: {}, groupBy: 'stage', closed: {},
    q: '', menu: '', todos: false, added: {}, modal: '', mq: '', newColName: '',
  };
};
const writeAcct = (id) => { try { window.localStorage.setItem(ACCT_KEY, id); } catch { /* storage off */ } };

export default function Studio({ initialPath, initialProject }) {
  const sb = supabaseBrowser();
  const [ctx, setCtx] = useState(null);
  const [D, setDState] = useState(null);
  const [error, setError] = useState('');
  // Two-step sign in: the session is aal1 but the person has a verified authenticator, so ask for a code first.
  const [mfa, setMfa] = useState(null);
  const [s, setS] = useState(null);
  const dRef = useRef(null);
  const meRef = useRef(null);
  const loading = useRef(false);
  const again = useRef(false);

  const setD = useCallback((fn) => setDState((prev) => { const next = typeof fn === 'function' ? fn(prev) : fn; dRef.current = next; return next; }), []);
  const set = useCallback((o) => setS((prev) => ({ ...prev, ...(typeof o === 'function' ? o(prev) : o) })), []);

  const toastTimer = useRef(null);
  // An action ({ label, run, ms }) adds a button, such as Undo, and keeps the toast up for ms (default 10 seconds).
  const toast = useCallback((msg, action) => {
    set({ toast: msg, toastAction: action || null });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => set({ toast: '', toastAction: null }), action ? (action.ms || 10000) : 4200);
  }, [set]);

  const reload = useCallback(async () => {
    if (loading.current) { again.current = true; return; }
    loading.current = true;
    try {
      const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.data && aal.data.nextLevel === 'aal2' && aal.data.currentLevel !== 'aal2') {
        setMfa((m) => m || { code: '', err: '', busy: false });
        return;
      }
      setMfa(null);
      const c = await loadContext(sb);
      if (!c) { setError('no-access'); return; }
      // Keep the same object when nothing changed: the realtime channel and other effects key on ctx, and a new
      // object on every reload re-subscribed, which reloaded again (4-5 full loads per page visit).
      setCtx((prev) => (prev && JSON.stringify(prev) === JSON.stringify(c) ? prev : c));
      const data = await loadWorkspace(sb, c, readAcct());
      // Older Activity Log pages loaded on demand survive the reload (the loader reads the newest 400).
      setD((prev) => ({ ...data, portalDetail: prev ? prev.portalDetail : {}, olderActivity: prev ? prev.olderActivity || [] : [], activityEnd: prev ? !!prev.activityEnd : false }));
      setS((prev) => prev || initialUi(c, data, initialPath, initialProject));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      loading.current = false;
      if (again.current) { again.current = false; reload(); }
    }
  }, [sb, setD, initialPath, initialProject]);

  const reloadPortal = useCallback(async (projectId) => {
    const d = dRef.current;
    if (!d || !d.account) return;
    try {
      const detail = await loadPortalDetail(sb, projectId, d.account.id);
      setD((prev) => ({ ...prev, portalDetail: { ...prev.portalDetail, [projectId]: detail } }));
    } catch (err) { toast(err.message); }
  }, [sb, setD, toast]);

  const switchAccount = useCallback((id) => { writeAcct(id); set({ openJob: '' }); reload(); }, [reload, set]);

  useEffect(() => { reload(); sb.rpc('touch_presence'); }, [reload, sb]);

  // Keep the URL in step with the page and the open project.
  useEffect(() => {
    if (!s) return;
    const url = (NAV_PATH[s.nav] || '/projects') + (s.openJob ? '?project=' + encodeURIComponent(s.openJob) : '');
    if (window.location.pathname + window.location.search !== url) window.history.pushState({ nav: s.nav, openJob: s.openJob }, '', url);
  }, [s && s.nav, s && s.openJob]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search).get('project') || '';
      set({ nav: navFromPath(window.location.pathname), openJob: p });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [set]);

  // Sponsor and client drawers fetch comments and files through the portal RPCs.
  const openId = s && D && s.openJob ? (D.rows.find((r) => r.job === s.openJob) || {}).id : null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state updates after the response
    if (openId && ctx && UI_ROLE[ctx.role] === 'sponsor') reloadPortal(openId);
  }, [openId, ctx, reloadPortal]);

  // Realtime: RLS applies per subscriber, so each person only hears about rows they can read. Keyed on the workspace
  // and user, not the ctx object, so a reload that changes the profile does not re-subscribe (and reload again).
  const rtWs = ctx ? ctx.workspace_id : '';
  const rtUser = ctx ? ctx.user_id : '';
  useEffect(() => {
    if (!rtWs) return;
    let t = null;
    const bump = () => { clearTimeout(t); t = setTimeout(() => reload(), 350); };
    const ch = sb.channel('board-' + rtWs);
    ['projects', 'project_edits', 'project_thumbnails', 'sponsorships', 'comments', 'project_assets', 'distribution_tasks', 'inbox_items', 'research_runs',
      'ideas', 'idea_comments', 'project_checklist', 'project_last_edit', 'automation_runs', 'project_publish', 'buffer_publications', 'content_entries'].forEach((table) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, bump));
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + rtUser }, bump);
    // If the realtime connection drops, poll every 45 seconds while the tab is visible, and catch up when the tab
    // comes back or the network returns.
    let live = false;
    ch.subscribe((status) => { const was = live; live = status === 'SUBSCRIBED'; if (live && !was) bump(); });
    const poll = setInterval(() => { if (!live && document.visibilityState === 'visible') reload(); }, 45000);
    const wake = () => { if (document.visibilityState === 'visible') bump(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      clearTimeout(t); clearInterval(poll); sb.removeChannel(ch);
      document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake);
    };
  }, [rtWs, rtUser, sb, reload]);

  // While a research run is going, check on it every 20 seconds. GET /api/research also marks runs that died with their
  // server process as failed, so an interrupted run never looks stuck, and progress shows even if realtime drops.
  const rsActive = !!(D && ctx && UI_ROLE[ctx.role] === 'admin' && (D.researchRuns || []).some((r) => r.status === 'queued' || r.status === 'running'));
  useEffect(() => {
    if (!rsActive) return;
    const t = setInterval(() => { fetch('/api/research', { cache: 'no-store' }).catch(() => {}).finally(() => reload()); }, 20000);
    return () => clearInterval(t);
  }, [rsActive, reload]);

  // Desktop push (Settings > My notifications): a system notification for each new notification while the board is
  // open, when the browser allowed it and quiet hours are not on. Notifications from before this visit stay silent.
  const pushSeen = useRef(null);
  useEffect(() => {
    if (!D || !ctx) return;
    const list = D.notifications || [];
    if (!pushSeen.current) { pushSeen.current = new Set(list.map((n) => n.id)); return; }
    const fresh = list.filter((n) => !pushSeen.current.has(n.id) && !n.read_at);
    list.forEach((n) => pushSeen.current.add(n.id));
    const myN = ((meRef.current && meRef.current.prefs) || {}).myN || {};
    const h = new Date().getHours();
    if (!fresh.length || !myN.push || (myN.quiet && (h >= 19 || h < 8)) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    fresh.slice(0, 3).forEach((n) => {
      try {
        const note = new Notification([n.actor_label, n.text].filter(Boolean).join(' '), { body: n.target_label + (n.quote ? '\n' + n.quote : ''), tag: n.id, icon: '/icon.png' });
        const row = n.project_id ? (D.rows || []).find((r) => r.id === n.project_id) : null;
        note.onclick = () => { window.focus(); set({ nav: row ? 'projects' : 'alerts', openJob: row ? row.job : '' }); note.close(); };
      } catch { /* some browsers only allow notifications from a service worker */ }
    });
  }, [D, ctx, set]);

  // Page shortcuts (Ideas & Research: N, Esc, Cmd/Ctrl+Enter, Cmd/Ctrl+S). The handler comes from the latest render and
  // returns true when it used the key. Capture phase, so on the Ideas page N opens New idea before the Dev Notes hotkey.
  const hotkey = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (hotkey.current && hotkey.current(e)) e.stopPropagation(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  useEffect(() => {
    if (s && s.theme) document.body.dataset.theme = s.theme;
  }, [s && s.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = useMemo(() => {
    if (!ctx) return null;
    const p = ctx.profile || {};
    const m = {
      id: ctx.user_id, name: first(p.full_name) || (p.email || '').split('@')[0], fullName: p.full_name || '', email: p.email || '',
      dbRole: ctx.role, uiRole: UI_ROLE[ctx.role], isOwner: !!ctx.is_owner, prefs: p.prefs || {},
      perms: new Set((ctx.perms || []).map((x) => x[0] + ':' + x[1])), accounts: ctx.accounts || [], views: ctx.views || null,
    };
    return m;
  }, [ctx]);
  useEffect(() => { meRef.current = me; }, [me]);

  const A = useMemo(() => makeActions({
    sb, getD: () => dRef.current, setD, getMe: () => meRef.current, toast, reload, reloadPortal, switchAccount,
  }), [sb, setD, toast, reload, reloadPortal, switchAccount]);

  // Once per visit: send emails still waiting and queue tomorrow's deadline reminders.
  const mailed = useRef(false);
  useEffect(() => {
    if (ctx && !mailed.current) { mailed.current = true; A.sendEmails(); }
  }, [ctx, A]);

  if (mfa) return <MfaGate state={mfa} setState={setMfa} sb={sb} onDone={() => { setMfa(null); reload(); }} />;
  if (error === 'no-access') return <Gate title="No workspace access yet" body="Your account is signed in but is not an active member of a workspace. Ask a Super Admin to invite this email, then sign in again." action={() => A.signOut('local')} actionLabel="Sign out" />;
  if (error) return <Gate title="Could not load the board" body={error} action={() => { setError(''); reload(); }} actionLabel="Try again" />;
  if (!ctx || !D || !s || !me) return <Loading />;

  const V = computeVals({ s, set, D, A, me, now: new Date() });
  hotkey.current = V.ids && V.ids.hotkey;
  // Dev Notes dock (press N), Super Admins only. Rendered inside the board root so it picks up the theme tokens.
  V.devNotes = me.uiRole === 'admin' ? <DevNotes sb={sb} me={me} workspaceId={ctx.workspace_id} /> : null;
  return <StudioView V={V} />;
}

function Shell({ children }) {
  return (
    <div style={css('--page: #EBEBEB; --surface: #FFFFFF; --ink: #111111; --muted: #666666; --line: #F0F0F0; --inv: #111111; --inv-ink: #FFFFFF; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: var(--page); font-family: var(--font-main); color: var(--ink);')}>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <Shell>
      <p role="status" style={css('margin: 0; font-size: 14px; font-weight: 600; color: var(--muted);')}>Loading the board…</p>
    </Shell>
  );
}

// The second step of signing in: a 6-digit code from the authenticator app.
function MfaGate({ state, setState, sb, onDone }) {
  const submit = async (e) => {
    e.preventDefault();
    if (state.busy) return;
    setState({ ...state, busy: true, err: '' });
    const f = await sb.auth.mfa.listFactors();
    const factor = f.data && (f.data.totp || []).find((x) => x.status === 'verified');
    if (!factor) { setState({ ...state, busy: false, err: 'No authenticator is set up for this account.' }); return; }
    const res = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: state.code.replace(/\s+/g, '') });
    if (res.error) { setState({ ...state, busy: false, code: '', err: res.error.message || 'That code did not work. Try the newest one.' }); return; }
    onDone();
  };
  return (
    <Shell>
      <form onSubmit={submit} style={css('width: 400px; max-width: 100%; box-sizing: border-box; padding: 28px; background: var(--surface); border-radius: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 24px 60px rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 14px;')}>
        <h1 style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em;')}>Two-step sign in</h1>
        <p style={css('margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted);')}>Enter the 6-digit code from your authenticator app.</p>
        <label htmlFor="mfa-code" style={css('font-size: 13px; font-weight: 600;')}>Code</label>
        <input id="mfa-code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={state.code} onChange={(e) => setState({ ...state, code: e.target.value, err: '' })}
          style={css('min-height: 48px; padding: 0 14px; border: 1px solid #D4D4D4; border-radius: 12px; font-size: 20px; letter-spacing: 0.3em; font-variant-numeric: tabular-nums;')} />
        {state.err ? <p role="alert" style={css('margin: 0; font-size: 13px; font-weight: 600; color: #B42318;')}>{state.err}</p> : null}
        <button type="submit" disabled={state.busy || state.code.replace(/\s+/g, '').length < 6} style={css('min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); cursor: pointer;' + (state.busy ? ' opacity: 0.6;' : ''))}>{state.busy ? 'Checking…' : 'Verify'}</button>
        <button type="button" onClick={async () => { await sb.auth.signOut({ scope: 'local' }); window.location.href = window.location.origin + '/login'; }} style={css('min-height: 40px; border: 0; background: transparent; color: var(--muted); cursor: pointer;')}>Sign out</button>
      </form>
    </Shell>
  );
}

function Gate({ title, body, action, actionLabel }) {
  return (
    <Shell>
      <section style={css('width: 440px; max-width: 100%; box-sizing: border-box; padding: 28px; background: var(--surface); border-radius: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 24px 60px rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 12px;')}>
        <h1 style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em;')}>{title}</h1>
        <p style={css('margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted);')}>{body}</p>
        <button type="button" onClick={action} style={css('align-self: flex-start; min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); cursor: pointer;')}>{actionLabel}</button>
      </section>
    </Shell>
  );
}
