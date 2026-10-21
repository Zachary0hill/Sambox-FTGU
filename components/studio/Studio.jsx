'use client';
// The board talks to an imperative data layer (Supabase client, realtime, optimistic writes). Actions read the
// latest data and member through refs at event time, which the React Compiler lint rules cannot see.
/* eslint-disable react-hooks/refs, react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StudioView from './StudioView';
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
  const [s, setS] = useState(null);
  const dRef = useRef(null);
  const meRef = useRef(null);
  const loading = useRef(false);
  const again = useRef(false);

  const setD = useCallback((fn) => setDState((prev) => { const next = typeof fn === 'function' ? fn(prev) : fn; dRef.current = next; return next; }), []);
  const set = useCallback((o) => setS((prev) => ({ ...prev, ...(typeof o === 'function' ? o(prev) : o) })), []);

  const toastTimer = useRef(null);
  const toast = useCallback((msg) => {
    set({ toast: msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => set({ toast: '' }), 4200);
  }, [set]);

  const reload = useCallback(async () => {
    if (loading.current) { again.current = true; return; }
    loading.current = true;
    try {
      const c = await loadContext(sb);
      if (!c) { setError('no-access'); return; }
      setCtx(c);
      const data = await loadWorkspace(sb, c, readAcct());
      setD((prev) => ({ ...data, portalDetail: prev ? prev.portalDetail : {} }));
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

  // Realtime: RLS applies per subscriber, so each person only hears about rows they can read.
  useEffect(() => {
    if (!ctx) return;
    let t = null;
    const bump = () => { clearTimeout(t); t = setTimeout(() => reload(), 350); };
    const ch = sb.channel('board-' + ctx.workspace_id);
    ['projects', 'project_edits', 'project_thumbnails', 'sponsorships', 'comments', 'distribution_tasks', 'inbox_items', 'research_runs'].forEach((table) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, bump));
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + ctx.user_id }, bump);
    ch.subscribe();
    return () => { clearTimeout(t); sb.removeChannel(ch); };
  }, [ctx, sb, reload]);

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

  if (error === 'no-access') return <Gate title="No workspace access yet" body="Your account is signed in but is not an active member of a workspace. Ask a Super Admin to invite this email, then sign in again." action={() => A.signOut('local')} actionLabel="Sign out" />;
  if (error) return <Gate title="Could not load the board" body={error} action={() => { setError(''); reload(); }} actionLabel="Try again" />;
  if (!ctx || !D || !s || !me) return <Loading />;

  const V = computeVals({ s, set, D, A, me, now: new Date() });
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
