// Admin pages (Super Admin only). Ported from the design's adminVals(); reads and writes the admin tables.
import { relTime, dayGroup, labelOf, STAGE_L, STAGE_V, DEAL_L, INVOICE_L, PAYOUT_L, FIELD_TYPE_L, UI_ROLE } from './model';
import { PROVIDERS, GROUPS, AI_PROVIDERS, providerById } from '../integrations/registry';
import { actionById } from '../automations/catalog';
import { isGraph, compile as compileFlow, nodeCount } from '../automations/graph';
import { RELEASES } from './releases';

const SRC = { web: 'Web app', automation: 'Automation', portal: 'Client portal', mobile: 'Mobile', api: 'API' };

// Model lists in flight, per provider, so re-renders while a list loads do not ask again.
const modelsPending = {};
const modelsTimer = {};

export function adminVals(c) {
  const s = c.s, set = c.set, dark = c.dark, TONE = c.TONE, DARKFILL = c.DARKFILL, GRAYB = c.GRAYB, toolStyle = c.toolStyle;
  const allRows = c.allRows, ROLES = c.ROLES, COLS = c.COLS, fillFor = c.fillFor, dueState = c.dueState;
  const TYPEFILL = c.TYPEFILL, avatar = c.avatar, members = c.members, page = c.page;
  const di = c.di, TODAY = c.TODAY, DEF_VIEWS = c.DEF_VIEWS, roleBlock = c.roleBlock, actColor = c.actColor;
  const D = c.D, A = c.A, me = c.me, now = c.now, openRec = c.openRec;
  const openProject = (job) => () => set({ nav: 'projects', openJob: job, dTab: 'overview', draft: '', menu: '' });
  const solid = (tn) => dark ? DARKFILL[tn] : [TONE[tn][3], '#FFFFFF'];
  const hardBlock = (f, h) => 'display: inline-flex; align-items: center; height: ' + (h || 26) + 'px; padding: 0 10px; border-radius: 0; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + (f ? f[0] : 'var(--chip)') + '; color: ' + (f ? f[1] : 'var(--ink-3)') + ';';
  const sw = (on) => ({
    on: on ? 'true' : 'false',
    track: 'position: relative; display: block; width: 40px; height: 24px; border-radius: 999px; background: ' + (on ? 'var(--inv)' : 'var(--border-strong)') + '; transition: background .15s ease;',
    knob: 'position: absolute; top: 3px; left: ' + (on ? '19px' : '3px') + '; width: 18px; height: 18px; border-radius: 999px; background: ' + (on ? 'var(--inv-ink)' : 'var(--surface)') + '; transition: left .15s ease;'
  });
  const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  const tab = (label, count, on, pick) => ({ label: label, count: String(count), badge: GRAYB, pressed: on ? 'true' : 'false', pick: pick, style: toolStyle(on) });
  const initials = (n) => String(n).split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const tile = (tn) => { const f = solid(tn); return 'width: 36px; height: 36px; flex: none; border-radius: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: ' + f[0] + '; color: ' + f[1] + ';'; };
  const subRed = 'font-size: 12px; font-weight: 600; color: var(--red-ink);';
  const subMuted = 'font-size: 12px; color: var(--muted-2);';
  const stat = (label, value, sub, red) => ({ label: label, value: String(value), sub: sub || '', subStyle: red ? subRed : subMuted });
  const SINK = () => {};
  const settings = D.settings || {};

  const ui = {
    btnPrimary: 'min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); display: inline-flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap;',
    btnGhost: 'min-height: 44px; padding: 0 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--ink); display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; white-space: nowrap;',
    btnDanger: 'min-height: 44px; padding: 0 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--red-ink); cursor: pointer; white-space: nowrap;',
    ghostSm: 'min-height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; color: var(--ink-3); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;',
    iconBtn: 'width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;',
    stat: 'display: flex; flex-direction: column; gap: 6px; padding: 18px 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface);',
    panel: 'display: flex; flex-direction: column; gap: 16px; padding: 20px; box-sizing: border-box; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); min-width: 0;',
    h2: 'margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em; color: var(--ink);',
    h3: 'margin: 0; font-family: var(--font-title); font-size: var(--text-h6); font-weight: var(--weight-black); letter-spacing: -0.01em; color: var(--ink);',
    countPill: GRAYB,
    search: 'width: 100%; min-height: 40px; box-sizing: border-box; padding: 0 14px 0 38px; border: 1px solid transparent; border-radius: 12px; background: var(--chip); font-size: var(--text-body-sm); color: var(--ink);',
    swBtn: 'width: 52px; height: 44px; flex: none; border: 0; padding: 0; background: transparent; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;',
    cellBtn: 'flex: 1; min-width: 0; min-height: 44px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 2px; padding: 0; border: 0; background: transparent; text-align: left; cursor: pointer; letter-spacing: normal; line-height: 1.3;',
    dialog: 'position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; width: 520px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); overflow-y: auto; box-sizing: border-box; background: var(--surface); border: 1px solid var(--line-4); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.20); padding: 24px; color: var(--ink); font-family: var(--font-main);',
    whenTag: hardBlock(solid('blue'), 20) + ' font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 0 6px;',
    thenTag: hardBlock(solid('green'), 20) + ' font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 0 6px;'
  };
  ui.btnGhostStart = ui.btnGhost + ' align-self: flex-start;';

  // ---------- Users ----------
  const userStats = [
    stat('Members', members.length, 'Across every user type'),
    stat('Active', members.filter((m) => m.status === 'Active').length, members.filter((m) => m.raw && m.raw.last_active_at && new Date(m.raw.last_active_at) >= new Date(now.getFullYear(), now.getMonth(), 1)).length + ' signed in this month'),
    stat('Pending invites', members.filter((m) => m.status === 'Invited').length, 'Waiting to accept'),
    stat('Deactivated', members.filter((m) => m.status === 'Deactivated').length, 'Access paused, history kept')
  ];

  // ---------- Roles & Permissions ----------
  const RES = [
    ['projects', 'Projects', 'Board items and their fields'],
    ['edits', 'Edits', 'Cuts, versions and editor status'],
    ['thumbs', 'Thumbnails', 'Concepts, finals and design status'],
    ['approvals', 'Sponsor approvals', 'Approve or request changes'],
    ['comments', 'Comments', 'Threads on projects'],
    ['assets', 'Files and assets', 'Footage, drafts and uploads'],
    ['finance', 'Finance', 'Budgets, payments and payouts'],
    ['users', 'Users', 'Invite and manage people'],
    ['automations', 'Automations', 'Rules, triggers and integrations'],
    ['settings', 'Workspace settings', 'Statuses, fields and templates']
  ];
  const ACTS = [['view', 'View'], ['create', 'Create'], ['edit', 'Edit'], ['approve', 'Approve'], ['delete', 'Delete']];
  const NA = { approvals: ['create'], comments: ['approve'], assets: ['approve'], users: ['approve'], automations: ['approve'], settings: ['create', 'approve', 'delete'] };
  // The Finance, Users, Automations and Workspace Settings pages, and New project, are Super Admin screens, so these
  // grants could not reach anyone else. They show as Super Admin only instead of a box that does nothing.
  const ADMIN_ONLY = { finance: true, users: true, automations: true, settings: true };
  const adminOnly = (r, a) => !!ADMIN_ONLY[r] || (r === 'projects' && (a === 'create' || a === 'delete'));
  const isNa = (r, a) => (NA[r] || []).indexOf(a) >= 0;
  const permKey = (role, r, a) => role + ':' + r + ':' + a;
  const saved = {};
  D.rolePerms.filter((p) => p.allowed && p.role !== 'client').forEach((p) => { saved[permKey(UI_ROLE[p.role], p.resource, p.action)] = true; });
  const draft = Object.assign({}, saved, s.permDraft || {});
  const permDirty = Object.keys(draft).some((k) => !!draft[k] !== !!saved[k]);
  const pRole = s.permRole || 'editor';
  const pr = ROLES.find((x) => x.id === pRole) || ROLES[1];
  const roleOrder = ['editor', 'designer', 'sponsor', 'admin'];
  const roleTabs = roleOrder.map((id) => {
    const R = ROLES.find((x) => x.id === id);
    return tab(R.label, members.filter((m) => m.type === id).length, pRole === id, () => set({ permRole: id }));
  });
  const locked = pRole === 'admin';
  const PERM_COLS = 'display: grid; grid-template-columns: minmax(240px, 1fr) repeat(5, 104px); align-items: center;';
  const permRows = RES.map((r) => ({
    label: r[1], desc: r[2],
    cells: ACTS.map((a) => {
      const na = isNa(r[0], a[0]) || (!locked && adminOnly(r[0], a[0]));
      const k = permKey(pRole, r[0], a[0]);
      const on = !!draft[k];
      return {
        isNa: na, isLocked: !na && locked, isBox: !na && !locked, on: on,
        aria: na && !isNa(r[0], a[0]) ? r[1] + ' ' + a[1].toLowerCase() + ' is Super Admin only' : pr.label + ' can ' + a[1].toLowerCase() + ' ' + r[1].toLowerCase(),
        pick: () => set({ permDraft: Object.assign({}, s.permDraft || {}, { [k]: !on }) })
      };
    })
  }));
  const savePerm = () => {
    const map = { editor: [], designer: [], sponsor: [] };
    Object.keys(draft).filter((k) => draft[k]).forEach((k) => { const [role, r, a] = k.split(':'); if (map[role] && !isNa(r, a) && !adminOnly(r, a)) map[role].push([r, a]); });
    map.client = map.sponsor.filter((p) => !(p[0] === 'approvals' && p[1] === 'approve'));
    A.savePermissions(map).then(() => set({ permDraft: {} }));
  };
  const cfgOf = (rid) => D.roleConfigs.find((x) => x.role === (rid === 'admin' ? 'super_admin' : rid)) || {};
  const curViews = cfgOf(pRole).views || DEF_VIEWS[pRole];
  const VIEW_LIST = [['table', 'Table'], ['kanban', 'Kanban'], ['list', 'List'], ['timeline', 'Timeline'], ['calendar', 'Calendar']];
  const roleViews = VIEW_LIST.map((v) => {
    const on = curViews.indexOf(v[0]) >= 0;
    return {
      label: v[1], on: on, isBox: !locked, isLocked: locked,
      pick: () => {
        const next = on ? curViews.filter((x) => x !== v[0]) : VIEW_LIST.map((x) => x[0]).filter((x) => x === v[0] || curViews.indexOf(x) >= 0);
        if (!next.length) return A.toast('Each user type needs at least one view.');
        A.setRoleViews(pRole, next, (on ? 'removed ' : 'added ') + v[1] + ' view for', pr.label);
      },
      style: 'display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; box-sizing: border-box; border: 1px solid ' + (on ? 'var(--ink)' : 'var(--border)') + '; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--ink);'
    };
  });
  const roleFields = pr.cols.map((k) => ({ label: COLS[k].label }));

  // ---------- Workload ----------
  const statusList = D.statuses.map((x) => ({ id: x.id, label: x.label, stage: STAGE_L[x.stage], custom: !x.is_system }));
  const STATUS_BASE = D.statuses.filter((x) => x.is_system).map((x) => x.label);
  const open = allRows.filter((r) => r.status !== 'Live');
  const attn = [];
  const RT = { red: solid('red'), amber: solid('amber'), violet: solid('violet') };
  open.forEach((r) => {
    const si = STATUS_BASE.indexOf(r.status);
    if (dueState('editDue', r) === 'late') attn.push({ r: r, reason: 'Late edit', tn: 'red', due: 'Edit due ' + r.editDue, w: 0 });
    if (dueState('thumbDue', r) === 'late') attn.push({ r: r, reason: 'Late thumbnail', tn: 'red', due: 'Thumb due ' + r.thumbDue, w: 0 });
    if (si >= 1 && si <= 3 && !r.editor) attn.push({ r: r, reason: 'No editor', tn: 'amber', due: 'Pub ' + r.pub, w: 1 });
    if (si >= 1 && !r.designer) attn.push({ r: r, reason: 'No designer', tn: 'amber', due: 'Pub ' + r.pub, w: 1 });
    if (r.status === 'Sponsor Review' && r.approval === 'Pending') attn.push({ r: r, reason: 'Sponsor pending', tn: 'violet', due: 'Pub ' + r.pub, w: 2 });
  });
  attn.sort((a, b) => a.w - b.w);
  const attention = attn.map((a) => ({
    reason: a.reason, title: a.r.title, due: a.due, aria: 'Open ' + a.r.title,
    reasonStyle: hardBlock(RT[a.tn], 24) + ' min-width: 112px; justify-content: center; flex: none;',
    dueStyle: 'flex: none; font-size: 12px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; color: ' + (a.tn === 'red' ? 'var(--red-ink)' : 'var(--muted)') + ';',
    open: openProject(a.r.job)
  }));
  const CAP = 5;
  const WL = members.filter((m) => !m.isInvite && m.status === 'Active' && (m.type === 'editor' || m.type === 'designer'))
    .map((m) => m.type === 'editor' ? [m.id, m.first, 'Editor', 'editorId', 'editStatus', 'Approved', 'editDue'] : [m.id, m.first, 'Designer', 'designerId', 'thumb', 'Done', 'thumbDue']);
  const workload = WL.map((w) => {
    const mine = allRows.filter((r) => r[w[3]] === w[0] && r[w[4]] !== w[5]);
    const late = mine.filter((r) => dueState(w[6], r) === 'late').length;
    const upcoming = mine.map((r) => ({ t: r[w[6]], n: di(r[w[6]]) })).filter((x) => x.n !== null && x.n >= TODAY).sort((a, b) => a.n - b.n);
    const pct = Math.min(1, mine.length / CAP);
    const tone = mine.length >= CAP ? 'red' : mine.length >= 3 ? 'amber' : 'blue';
    return {
      name: w[1], role: w[2], initials: w[1].slice(0, 1), avatarStyle: avatar(w[1], 32),
      active: String(mine.length), late: String(late),
      lateStyle: late ? hardBlock(solid('red'), 24) + ' padding: 0 8px; font-variant-numeric: tabular-nums;' : 'font-size: 14px; color: var(--muted-2); font-variant-numeric: tabular-nums;',
      next: upcoming.length ? upcoming[0].t : 'None',
      barStyle: 'display: block; height: 8px; width: ' + Math.round(pct * 100) + '%; background: ' + solid(tone)[0] + ';',
      loadText: mine.length + ' of ' + CAP
    };
  });
  // min-width keeps the columns whole on phones; the table scrolls sideways instead of the page.
  const WL_COLS = 'display: grid; grid-template-columns: minmax(150px, 1.4fr) 64px 64px 84px minmax(110px, 1fr); align-items: center; min-width: 472px;';
  const flow = statusList.map((x, i) => {
    const f = x.custom ? solid('gray') : fillFor('status', x.label);
    return { label: x.label, stage: x.stage, style: hardBlock(f, 30) + ' font-size: 13px; padding: 0 12px;', hasArrow: i < statusList.length - 1 };
  });
  const wf = {
    editDays: settings.edit_days ?? 10, thumbDays: settings.thumb_days ?? 2,
    requireSponsor: !!settings.require_sponsor_approval, lockLive: !!settings.lock_after_live,
    editorStatus: !!settings.editors_change_status, autoDistribute: !!settings.auto_distribution
  };
  const WF_COL = { requireSponsor: 'require_sponsor_approval', lockLive: 'lock_after_live', editorStatus: 'editors_change_status', autoDistribute: 'auto_distribution' };
  const deadlines = [
    { id: 'wf-edit', label: 'Edit due after film date', value: String(s.wfEdit ?? wf.editDays), onChange: (e) => { const v = Number(e && e.target ? e.target.value : 0) || 0; set({ wfEdit: v }); A.updateSettings({ edit_days: v }); } },
    { id: 'wf-thumb', label: 'Thumbnail due before publish', value: String(s.wfThumb ?? wf.thumbDays), onChange: (e) => { const v = Number(e && e.target ? e.target.value : 0) || 0; set({ wfThumb: v }); A.updateSettings({ thumb_days: v }); } }
  ];
  const RULES = [
    ['requireSponsor', 'Require sponsor approval', 'Sponsored projects cannot move to Scheduled until approved.'],
    ['lockLive', 'Lock projects after Live', 'Only Super Admins can edit a published project.'],
    ['editorStatus', 'Editors can change Status', 'Otherwise editors only change Editor Status.'],
    ['autoDistribute', 'Create distribution tasks', 'Add clipping, newsletter and community tasks on Live.']
  ];
  const rules = RULES.map((r) => Object.assign({ label: r[1], desc: r[2], toggle: () => A.updateSettings({ [WF_COL[r[0]]]: !wf[r[0]] }, (wf[r[0]] ? 'turned off ' : 'turned on ') + 'the rule', r[1]) }, sw(wf[r[0]])));
  const pmStats = [
    stat('Active projects', open.length, allRows.length + ' total on the board'),
    stat('Late deadlines', attn.filter((a) => a.tn === 'red').length, 'Edits and thumbnails past due', attn.some((a) => a.tn === 'red')),
    stat('Unassigned', attn.filter((a) => a.tn === 'amber').length, 'Missing an editor or designer'),
    stat('Awaiting sponsor', allRows.filter((r) => r.approval === 'Pending').length, 'Approvals still open')
  ];

  // ---------- Clients & Sponsors ----------
  const acctAll = D.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, contact: a.contact_email || '', raw: a }));
  const accessOf = (a) => ({ portal: !!a.raw.allow_portal, drafts: !!a.raw.allow_drafts, comment: !!a.raw.allow_comment, approve: !!a.raw.allow_approve });
  // Status comes from what happened, not the column's default: portal switched off, someone signed in, an invite is
  // waiting, or nobody has been invited yet.
  const pendingInv = (a) => (D.invitations || []).some((x) => x.account_id === a.id);
  const portalOf = (a) => {
    if (!a.raw.allow_portal) return 'Off';
    if (a.raw.portal_status === 'active') return 'Active';
    return pendingInv(a) ? 'Invited' : 'Not invited';
  };
  const projOf = (a) => allRows.filter((r) => r.sponsor === a.name || r.channel === a.name);
  const aTab = s.acctTab || 'all';
  const aq = (s.acctQ || '').trim().toLowerCase();
  const acctShown = acctAll.filter((a) => (aTab === 'all' || a.type === aTab) && (!aq || a.name.toLowerCase().includes(aq) || a.contact.toLowerCase().includes(aq)));
  const selA = acctShown.find((a) => a.name === s.acctSel) || acctShown[0] || null;
  const PORTAL_TONE = { Active: 'green', Invited: 'amber', 'Not invited': 'gray', Off: 'gray' };
  const typeTone = (t) => t === 'client' ? 'blue' : 'amber';
  const typeLabel = (t) => t === 'client' ? 'Client' : 'Sponsor';
  const ACCT_COLS = 'display: grid; grid-template-columns: minmax(240px, 1.6fr) 120px 110px 120px; align-items: center;';
  const accounts = acctShown.map((a) => {
    const n = projOf(a).length;
    const on = selA && selA.name === a.name;
    return {
      name: a.name, contact: a.contact, initials: initials(a.name),
      cls: on ? 'row row-on' : 'row', pressed: on ? 'true' : 'false',
      pick: () => set({ acctSel: a.name }),
      tileStyle: 'width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 700;',
      typeLabel: typeLabel(a.type), typeStyle: hardBlock(solid(typeTone(a.type)), 26),
      projectsText: n + (n === 1 ? ' project' : ' projects'),
      portal: portalOf(a), portalStyle: hardBlock(solid(PORTAL_TONE[portalOf(a)]), 26)
    };
  });
  let acct = { edit: { on: false, types: [] }, name: '', contact: '', contactText: '', initials: '', tileStyle: '', typeLabel: '', typeStyle: '', projects: [], noProjects: true, access: [], canResend: false, resend: SINK, remove: SINK };
  if (selA) {
    const ax = accessOf(selA);
    const COL = { portal: 'allow_portal', drafts: 'allow_drafts', comment: 'allow_comment', approve: 'allow_approve' };
    const setAx = (k, label) => () => A.updateAccount(selA.raw, { [COL[k]]: !ax[k] }, (ax[k] ? 'turned off ' : 'turned on ') + label.toLowerCase() + ' for');
    const ACCESS = [['portal', 'Portal access', 'Can sign in to the client portal'], ['drafts', 'View drafts', 'Sees review links before publish'], ['comment', 'Comment', 'Can reply on their projects']];
    if (selA.type === 'sponsor') ACCESS.push(['approve', 'Approve deliverables', 'Can approve or request changes']);
    const confirm = s.acctConfirm === selA.id;
    const startEdit = () => set({ acctEdit: selA.id, aeName: selA.name, aeEmail: selA.contact, aeType: selA.type, aeErr: '', aeConfirm: false });
    const aeType = s.aeType || selA.type;
    const unowns = selA.type === 'client' && aeType === 'sponsor';
    const saveEdit = () => {
      if (s.aeBusy) return;
      const name = (s.aeName || '').trim();
      const email = (s.aeEmail || '').trim().toLowerCase();
      if (!name) return set({ aeErr: 'Enter an account name.' });
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return set({ aeErr: 'Enter a valid contact email.' });
      if (acctAll.some((a) => a.id !== selA.id && a.name.toLowerCase() === name.toLowerCase())) return set({ aeErr: 'That name is taken.' });
      if (unowns && !s.aeConfirm) return set({ aeConfirm: true, aeErr: '' });
      set({ aeBusy: true, aeErr: '' });
      A.saveAccountDetails(selA.raw, { name: name, contact_email: email, type: aeType })
        .then(() => set({ aeBusy: false, acctEdit: '', acctSel: name }))
        .catch((err) => set({ aeBusy: false, aeErr: err.message }));
    };
    const segStyle = (on) => 'flex: 1; min-height: 40px; padding: 0 12px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; ' + (on ? 'border: 1.5px solid var(--ink); background: var(--surface); color: var(--ink);' : 'border: 1.5px solid var(--border); background: var(--surface-2); color: var(--ink-3);');
    const edit = {
      on: s.acctEdit === selA.id, start: startEdit, cancel: () => set({ acctEdit: '', aeErr: '', aeConfirm: false }), save: saveEdit,
      name: s.aeName || '', email: s.aeEmail || '',
      onName: (e) => set({ aeName: e && e.target ? e.target.value : '', aeErr: '' }),
      onEmail: (e) => set({ aeEmail: e && e.target ? e.target.value : '', aeErr: '' }),
      types: [['client', 'Client'], ['sponsor', 'Sponsor']].map((t) => ({ label: t[1], pressed: aeType === t[0] ? 'true' : 'false', pick: () => set({ aeType: t[0], aeConfirm: false, aeErr: '' }), style: segStyle(aeType === t[0]) })),
      typeNote: unowns ? 'The ' + selA.name + ' channel will no longer belong to this account. Its projects stay on the board.' : selA.type === 'sponsor' && aeType === 'client' ? 'A client owns the channel named after it. One is created if it does not exist.' : '',
      err: s.aeErr || '', hasErr: !!s.aeErr,
      saveLabel: s.aeBusy ? 'Saving…' : unowns && s.aeConfirm ? 'Confirm change' : 'Save'
    };
    const noEmail = !selA.contact;
    acct = {
      edit: edit,
      name: selA.name, contact: selA.contact, initials: initials(selA.name),
      tileStyle: 'width: 48px; height: 48px; flex: none; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-2); font-size: 14px; font-weight: 700;',
      typeLabel: typeLabel(selA.type), typeStyle: hardBlock(solid(typeTone(selA.type)), 26),
      projects: projOf(selA).map((r) => ({ title: r.title, status: r.status, statusStyle: hardBlock(fillFor('status', r.status), 24) + ' flex: none;', aria: 'Open ' + r.title, open: openProject(r.job) })),
      noProjects: projOf(selA).length === 0,
      access: ACCESS.map((x) => Object.assign({ label: x[1], desc: x[2], toggle: setAx(x[0], x[1]) }, sw(!!ax[x[0]]))),
      contactText: selA.contact || 'No contact email',
      canResend: portalOf(selA) === 'Invited' || portalOf(selA) === 'Not invited',
      resendLabel: noEmail ? 'Add contact email' : s.portalBusy === selA.id ? 'Sending…' : pendingInv(selA) ? 'Resend portal invite' : 'Send portal invite',
      resend: () => {
        if (noEmail) return startEdit();
        if (s.portalBusy) return;
        set({ portalBusy: selA.id });
        A.invitePortalContact(selA.raw).then(() => set({ portalBusy: '' }));
      },
      removeLabel: confirm ? 'Confirm remove' : 'Remove account',
      remove: () => { if (!confirm) return set({ acctConfirm: selA.id }); set({ acctSel: '', acctConfirm: '' }); A.removeAccount(selA.raw); }
    };
  }
  const naType = s.naType || 'sponsor';
  const acctTypes = [['client', 'Client', 'Owns a channel. Sees every project on it.'], ['sponsor', 'Sponsor', 'Linked to sponsored projects only.']].map((t) => {
    const on = naType === t[0];
    return {
      label: t[1], blurb: t[2], on: on, pick: () => set({ naType: t[0], acctErr: '' }),
      radioStyle: 'width: 18px; height: 18px; flex: none; margin-top: 2px; box-sizing: border-box; border-radius: 999px; background: var(--surface); ' + (on ? 'border: 5px solid var(--ink);' : 'border: 1.5px solid var(--border-strong);'),
      style: 'position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 14px; box-sizing: border-box; border-radius: 14px; cursor: pointer; background: ' + (on ? 'var(--surface)' : 'var(--surface-2)') + '; ' + (on ? 'border: 1.5px solid var(--ink); box-shadow: 0 0 0 3px var(--chip-2);' : 'border: 1.5px solid var(--border);')
    };
  });
  const addAcct = () => {
    const name = (s.naName || '').trim();
    const email = (s.naEmail || '').trim();
    if (!name) return set({ acctErr: 'Enter an account name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return set({ acctErr: 'Enter a valid contact email.' });
    if (acctAll.some((a) => a.name.toLowerCase() === name.toLowerCase())) return set({ acctErr: 'That account already exists.' });
    const invite = s.naInvite !== false;
    A.addAccount({ name: name, type: naType, contact_email: email }).then((a) => {
      set({ acctModal: false, acctSel: name, acctTab: 'all', acctQ: '', naName: '', naEmail: '', acctErr: '' });
      if (invite && a) { set({ portalBusy: a.id }); A.invitePortalContact(a).then(() => set({ portalBusy: '' })); }
    }).catch((err) => set({ acctErr: err.message }));
  };
  const clientStats = [
    stat('Clients', acctAll.filter((a) => a.type === 'client').length, 'Channel owners'),
    stat('Sponsors', acctAll.filter((a) => a.type === 'sponsor').length, 'Brand partners'),
    stat('Portal active', acctAll.filter((a) => portalOf(a) === 'Active').length, acctAll.filter((a) => portalOf(a) === 'Invited').length + ' invites pending'),
    stat('Linked projects', allRows.filter((r) => r.sponsor || D.channels.some((x) => x.name === r.channel && x.owner_account_id)).length, 'Sponsored or client channel')
  ];

  // ---------- Finance ----------
  const rowOfId = {};
  allRows.concat(c.catalogRows).forEach((r) => { rowOfId[r.id] = r; });
  const acctName = (id) => (D.accounts.find((a) => a.id === id) || {}).name || '';
  const FIN_TONE = { 'Paid': 'green', 'Invoiced': 'blue', 'Contracted': 'gray', 'Overdue': 'red', 'Draft': 'gray', 'Scheduled': 'violet', 'Pending approval': 'amber', 'Reminder sent': 'amber' };
  const cellBase = 'display: flex; align-items: center; gap: 10px; min-width: 0; padding: 0 16px; box-sizing: border-box; height: 100%;';
  const cell = (o, align) => Object.assign({ isText: false, isSub: false, isBlock: false, isPerson: false, isBar: false, isAction: false, text: '', sub: '' }, o, { style: cellBase + (align === 'r' ? ' justify-content: flex-end;' : '') });
  const T = (text, align, strong) => cell({ isText: true, text: text, textStyle: 'font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; color: ' + (strong ? 'var(--ink)' : 'var(--ink-3)') + ';' + (strong ? ' font-weight: 600;' : '') }, align);
  const Sb = (text, sub) => cell({ isSub: true, text: text, sub: sub });
  const B = (text) => cell({ isBlock: true, text: text, blockStyle: hardBlock(solid(FIN_TONE[text] || 'gray'), 26) });
  const P = (name, sub) => cell({ isPerson: true, text: name, sub: sub, initials: name.slice(0, 1), avatarStyle: avatar(name, 30) });
  const BAR = (pct) => cell({ isBar: true, text: Math.round(pct * 100) + '%', barStyle: 'display: block; height: 8px; width: ' + Math.min(100, Math.round(pct * 100)) + '%; background: ' + solid(pct > 1 ? 'red' : pct > 0.85 ? 'amber' : 'green')[0] + ';', barTextStyle: 'width: 44px; text-align: right; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; color: ' + (pct > 1 ? 'var(--red-ink)' : 'var(--muted)') + ';' });
  const ACT = (label, pick, aria, more) => cell(label ? { isAction: true, text: label, pick: pick, aria: aria, btnStyle: ui.ghostSm + ' border: 1px solid var(--border);', more: more || [] } : { more: more || [] }, 'r');
  // Each row's Edit opens its record dialog; Send invoice and Send reminder email through the server (Resend).
  const EDIT = (label, pick) => ({ text: 'Edit', aria: 'Edit ' + label, pick: pick, btnStyle: ui.ghostSm });
  const sendInv = (id, reminder) => () => { set({ finBusy: id }); A.sendInvoice(id, reminder).then((r) => { set({ finBusy: '' }); if (!r.sent) A.toast('The email did not send: ' + r.error); }); };
  const setFin = (table, id, status, text, target) => () => A.setFinStatus(table, id, status, text, target);
  const fTab = s.finTab || 'budgets';
  const budgetRows = D.budgets.map((x) => ({ job: (rowOfId[x.project_id] || {}).job || '', b: x.budget_cents / 100, sp: x.spent_cents / 100, r: rowOfId[x.project_id] || {}, raw: x }))
    .sort((a, b) => (a.r.createdAt || '') < (b.r.createdAt || '') ? -1 : 1);
  const deals = D.deals.map((d) => ({ id: d.id, sponsor: acctName(d.account_id), title: (rowOfId[d.project_id] || {}).title || '', amt: d.amount_cents / 100, st: DEAL_L[d.status], due: labelOf(d.due_date), raw: d }));
  const invs = D.invoices.map((d) => ({ id: d.id, client: acctName(d.account_id), no: d.number, period: d.description, amt: d.amount_cents / 100, st: INVOICE_L[d.status], due: labelOf(d.due_date), raw: d,
    sent: d.delivery_error ? 'Send failed' : d.reminded_at ? 'Reminded ' + relTime(d.reminded_at, now) : d.sent_at ? 'Emailed ' + relTime(d.sent_at, now) : '' }));
  const pays = D.payouts.map((d) => ({ id: d.id, who: c.nameOf(d.user_id), role: d.role === 'designer' ? 'Designer' : 'Editor', items: d.description, amt: d.amount_cents / 100, st: PAYOUT_L[d.status], date: labelOf(d.pay_date), raw: d }));
  const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
  let fin;
  const totalCell = (text, align) => ({ text: text, style: 'display: flex; align-items: center; padding: 0 16px; font-size: 14px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap;' + (align === 'r' ? ' justify-content: flex-end;' : '') });
  if (fTab === 'budgets') {
    const tb = sum(budgetRows, (x) => x.b), ts = sum(budgetRows, (x) => x.sp);
    fin = {
      label: 'Project budgets', grid: 'minmax(260px, 2fr) 140px 110px 110px 110px minmax(160px, 1fr)', min: 1000,
      head: [['Project'], ['Type'], ['Budget', 'r'], ['Spent', 'r'], ['Remaining', 'r'], ['Used']],
      rows: budgetRows.map((x) => ({ edit: EDIT('budget for ' + (x.r.title || x.job), () => openRec.budget(x.raw)), cells: [Sb(x.r.title || x.job, x.job), cell({ isBlock: true, text: x.r.type || '', blockStyle: hardBlock(TYPEFILL[x.r.type], 26) }), T(money(x.b), 'r'), T(money(x.sp), 'r'), T(money(x.b - x.sp), 'r', x.b - x.sp < 0), BAR(x.b ? x.sp / x.b : 0)] })),
      total: [totalCell('Total'), totalCell(''), totalCell(money(tb), 'r'), totalCell(money(ts), 'r'), totalCell(money(tb - ts), 'r'), totalCell((tb ? Math.round(ts / tb * 100) : 0) + '% used')],
      csv: [['Project', 'Job', 'Type', 'Budget', 'Spent', 'Remaining']].concat(budgetRows.map((x) => [x.r.title || '', x.job, x.r.type || '', x.b, x.sp, x.b - x.sp]))
    };
  } else if (fTab === 'sponsor') {
    fin = {
      label: 'Sponsor revenue', grid: 'minmax(280px, 2fr) 120px 150px 100px 150px', min: 860,
      head: [['Sponsor and project'], ['Deal value', 'r'], ['Status'], ['Due'], ['', 'r', 'Actions']],
      rows: deals.map((d) => ({ edit: EDIT('deal with ' + d.sponsor, () => openRec.deal(d.raw)), cells: [Sb(d.sponsor, d.title), T(money(d.amt), 'r', true), B(d.st), T(d.due), (d.st === 'Invoiced' || d.st === 'Overdue') ? ACT('Mark paid', setFin('deals', d.id, 'paid', 'recorded the sponsor payment received from', d.sponsor), 'Record payment received from ' + d.sponsor) : ACT('')] })),
      total: [totalCell('Total booked'), totalCell(money(sum(deals, (d) => d.amt)), 'r'), totalCell(money(sum(deals.filter((d) => d.st === 'Paid'), (d) => d.amt)) + ' paid'), totalCell(''), totalCell('', 'r')],
      csv: [['Sponsor', 'Project', 'Deal value', 'Status', 'Due']].concat(deals.map((d) => [d.sponsor, d.title, d.amt, d.st, d.due]))
    };
  } else if (fTab === 'client') {
    fin = {
      label: 'Client payments', grid: 'minmax(220px, 1.4fr) minmax(180px, 1.2fr) 110px 150px 90px 170px', min: 960,
      head: [['Client and invoice'], ['Period'], ['Amount', 'r'], ['Status'], ['Due'], ['', 'r', 'Actions']],
      rows: invs.map((d) => ({ edit: EDIT('invoice ' + d.no, () => openRec.invoice(d.raw)), cells: [Sb(d.client, d.no + (d.sent ? '  ·  ' + d.sent : '')), T(d.period), T(money(d.amt), 'r', true), B(d.st), T(d.due),
        s.finBusy === d.id ? ACT('Sending…', SINK, 'Sending')
          : d.st === 'Overdue' || d.st === 'Invoiced' || d.st === 'Reminder sent' ? ACT('Send reminder', sendInv(d.id, true), 'Email a payment reminder for ' + d.no)
          : d.st === 'Draft' ? ACT('Send invoice', sendInv(d.id, false), 'Email ' + d.no + ' to the client') : ACT('')] })),
      total: [totalCell('Total'), totalCell(''), totalCell(money(sum(invs, (d) => d.amt)), 'r'), totalCell(money(sum(invs.filter((d) => d.st === 'Paid'), (d) => d.amt)) + ' received'), totalCell(''), totalCell('', 'r')],
      csv: [['Client', 'Invoice', 'Period', 'Amount', 'Status', 'Due']].concat(invs.map((d) => [d.client, d.no, d.period, d.amt, d.st, d.due]))
    };
  } else {
    fin = {
      label: 'Contractor payouts', grid: 'minmax(200px, 1.3fr) minmax(160px, 1fr) 110px 160px 100px 130px', min: 900,
      head: [['Contractor'], ['Work'], ['Amount', 'r'], ['Status'], ['Pay date'], ['', 'r', 'Actions']],
      rows: pays.map((d) => ({ edit: EDIT('payout for ' + d.who, () => openRec.payout(d.raw)), cells: [P(d.who, d.role), T(d.items), T(money(d.amt), 'r', true), B(d.st), T(d.date),
        d.st === 'Pending approval' ? ACT('Approve', setFin('payouts', d.id, 'scheduled', 'approved and scheduled the payout for', d.who), 'Approve and schedule the payout for ' + d.who + '. No money moves from here.')
          : d.st === 'Scheduled' ? ACT('Mark paid', setFin('payouts', d.id, 'paid', 'recorded the payout as paid to', d.who), 'Record that you paid ' + d.who + ' outside FTGU') : ACT('')] })),
      total: [totalCell('Total'), totalCell(''), totalCell(money(sum(pays, (d) => d.amt)), 'r'), totalCell(money(sum(pays.filter((d) => d.st !== 'Paid'), (d) => d.amt)) + ' due'), totalCell(''), totalCell('', 'r')],
      csv: [['Contractor', 'Role', 'Work', 'Amount', 'Status', 'Pay date']].concat(pays.map((d) => [d.who, d.role, d.items, d.amt, d.st, d.date]))
    };
  }
  // Every finance table ends with an Edit column, and the page header adds a record of the open tab.
  fin.grid += ' 72px';
  fin.min += 72;
  fin.head = fin.head.concat([['', 'r', 'Edit']]);
  fin.rows = fin.rows.map((x) => Object.assign({}, x, { cells: x.cells.concat([cell({ isAction: true, text: x.edit.text, pick: x.edit.pick, aria: x.edit.aria, btnStyle: x.edit.btnStyle }, 'r')]) }));
  fin.total = fin.total.concat([totalCell('', 'r')]);
  const FIN_NEW = { budgets: ['Add budget', () => openRec.budget(null)], sponsor: ['Add deal', () => openRec.deal(null)], client: ['New invoice', () => openRec.invoice(null)], payouts: ['Add payout', () => openRec.payout(null)] };
  fin.empty = fin.rows.length === 0;
  fin.emptyText = { budgets: 'No project budgets yet. Add one to track spend against it.', sponsor: 'No sponsor deals yet. Add a deal when a sponsor signs.', client: 'No invoices yet. Create one, then send it by email.', payouts: 'No contractor payouts yet. Add what you owe an editor or designer.' }[fTab];
  const fgrid = 'display: grid; grid-template-columns: ' + fin.grid + '; align-items: stretch;';
  fin.head = fin.head.map((h) => ({ label: h[0], srLabel: h[0] ? '' : h[2] || 'Actions', style: 'display: flex; align-items: center; padding: 0 16px; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2); white-space: nowrap;' + (h[1] === 'r' ? ' justify-content: flex-end;' : '') }));
  fin.wrapStyle = 'min-width: ' + fin.min + 'px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); overflow: hidden;';
  fin.headStyle = fgrid + ' min-height: 44px; border-bottom: 1px solid var(--line);';
  fin.rowStyle = fgrid + ' min-height: 60px; border-bottom: 1px solid var(--line);';
  fin.totalStyle = fgrid + ' min-height: 52px; background: var(--surface-2);';
  const finTabs = [['budgets', 'Project budgets', budgetRows.length], ['sponsor', 'Sponsor revenue', deals.length], ['client', 'Client payments', invs.length], ['payouts', 'Contractor payouts', pays.length]].map((t) => tab(t[1], t[2], fTab === t[0], () => set({ finTab: t[0] })));
  const overdueClient = sum(invs.filter((d) => d.st === 'Overdue' || d.st === 'Reminder sent'), (d) => d.amt);
  const finStats = [
    stat('Budget committed', money(sum(budgetRows, (x) => x.b)), money(sum(budgetRows, (x) => x.sp)) + ' spent so far'),
    stat('Sponsor revenue', money(sum(deals, (d) => d.amt)), money(sum(deals.filter((d) => d.st === 'Paid'), (d) => d.amt)) + ' collected'),
    stat('Client payments', money(sum(invs.filter((d) => d.st === 'Paid'), (d) => d.amt)), overdueClient ? money(overdueClient) + ' overdue' : 'Nothing overdue', !!overdueClient),
    stat('Payouts due', money(sum(pays.filter((d) => d.st !== 'Paid'), (d) => d.amt)), pays.filter((d) => d.st === 'Pending approval').length + ' awaiting approval')
  ];

  // ---------- Automations ----------
  const autoSet = Object.assign({ paused: false, retry: true, failAlert: true, sandbox: false, retention: '90' }, settings.automation || {});
  const autoList = D.automations.map((a) => ({
    id: a.id, cat: a.category, name: a.name, when: a.when_text, then: a.then_text, runs: a.run_count,
    last: a.last_run_at ? relTime(a.last_run_at, now) : 'Never run', on: a.enabled, draft: a.is_draft, app: a.app, raw: a,
    // Flows from the flow builder keep a graph in flow (lib/automations/graph.ts); older rows keep preview columns.
    ...(isGraph(a.flow)
      ? { kind: a.flow.kind || 'automation', tags: a.flow.tags || [], flow: compileFlow(a.flow).cols, steps: nodeCount(a.flow) }
      : { kind: 'automation', tags: [], flow: Array.isArray(a.flow) ? a.flow : null, steps: (Array.isArray(a.flow) ? a.flow : []).reduce((x, col) => x + col.length, 0) })
  }));
  const isDraftA = (a) => !!a.draft;
  const isOnA = (a) => !!a.on;
  const KIND_L = { process: 'Process', idea: 'Idea' };
  const statusA = (a) => KIND_L[a.kind] || (isDraftA(a) ? 'Draft' : (isOnA(a) && !autoSet.paused) ? 'Live' : 'Paused');
  const NODE = { t: [solid('amber')[0], 'var(--amber-soft)'], c: [solid('violet')[0], 'var(--violet-soft)'], a: [solid('green')[0], 'var(--green-soft)'] };
  const layoutFlow = (flowIn) => {
    const flow = Array.isArray(flowIn) && flowIn.length ? flowIn : [['t'], ['a']];
    const n = flow.length, nodes = [], cols = [];
    flow.forEach((col, i) => {
      const x = (i + 0.5) / n * 100;
      const pts = [];
      col.forEach((k, j) => {
        const y = 75 + (j - (col.length - 1) / 2) * 34;
        pts.push(y);
        nodes.push({ style: k === 'c'
          ? 'position: absolute; left: calc(' + x.toFixed(2) + '% - 9px); top: ' + (y - 9) + 'px; width: 18px; height: 18px; box-sizing: border-box; transform: rotate(45deg); border: 1.5px solid ' + NODE.c[0] + '; background: ' + NODE.c[1] + ';'
          : 'position: absolute; left: calc(' + x.toFixed(2) + '% - 24px); top: ' + (y - 11) + 'px; width: 48px; height: 22px; box-sizing: border-box; border-radius: 6px; border: 1.5px solid ' + NODE[k][0] + '; background: ' + NODE[k][1] + ';' });
      });
      cols.push({ x: x * 10, ys: pts });
    });
    let d = '';
    for (let i = 0; i < cols.length - 1; i++) {
      const A0 = cols[i], Bc = cols[i + 1], x1 = A0.x + 70, x2 = Bc.x - 70, xm = (x1 + x2) / 2;
      A0.ys.forEach((y1) => Bc.ys.forEach((y2) => { d += 'M' + x1.toFixed(0) + ' ' + y1 + ' C' + xm.toFixed(0) + ' ' + y1 + ' ' + xm.toFixed(0) + ' ' + y2 + ' ' + x2.toFixed(0) + ' ' + y2 + ' '; }));
    }
    return { nodes: nodes, path: d.trim() || 'M0 0' };
  };
  const aq2 = (s.autoQ || '').trim().toLowerCase();
  const aSt = s.autoSt || 'all';
  const autoShown = autoList.filter((a) => (aSt === 'all' || statusA(a) === aSt) && (!aq2 || (a.name + ' ' + a.when + ' ' + a.then + ' ' + a.app + ' ' + a.tags.map((t) => t.label).join(' ')).toLowerCase().includes(aq2)));
  const chipBase = 'position: absolute; top: 12px; display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; box-sizing: border-box; border-radius: 8px; background: var(--surface); border: 1px solid var(--line-4); font-size: 12px; font-weight: 600; color: var(--ink-2);';
  const wfCard = (a) => {
    const st = statusA(a);
    const on = isOnA(a) && !isDraftA(a);
    const L = layoutFlow(a.flow);
    const runnable = a.kind === 'automation';
    const confirming = s.autoConfirm === a.id;
    return Object.assign({
      name: a.name, when: a.when.charAt(0).toUpperCase() + a.when.slice(1), then: a.then, app: a.app, last: a.last,
      steps: a.steps + (a.steps === 1 ? ' step' : ' steps') + (runnable ? '  ·  ' + a.runs + (a.runs === 1 ? ' run' : ' runs') : ''),
      nodes: L.nodes, path: L.path, kindLabel: KIND_L[a.kind] || 'Automation', runnable: runnable,
      tagText: a.tags.length ? a.tags.slice(0, 3).map((t) => t.label).join(', ') + (a.tags.length > 3 ? ' +' + (a.tags.length - 3) : '') : '',
      chipL: chipBase + ' left: 12px;', chipR: chipBase + ' right: 12px; color: var(--ink-3); font-weight: 500;',
      status: st, statusStyle: st === 'Live' ? hardBlock(solid('green'), 24) : st === 'Draft' ? hardBlock(['transparent', 'var(--muted)'], 24) + ' box-shadow: inset 0 0 0 1px var(--border-strong);'
        : st === 'Process' ? hardBlock(['var(--violet-soft)', 'var(--violet-ink)'], 24) : st === 'Idea' ? hardBlock(['var(--amber-soft)', 'var(--amber-ink)'], 24) : hardBlock(['var(--chip-2)', 'var(--ink-3)'], 24),
      cardStyle: 'display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); overflow: hidden;' + (st === 'Paused' ? ' opacity: 0.88;' : ''),
      titleStyle: 'flex: 1; min-width: 0; margin: 0; font-size: 16px; font-weight: 600; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink);',
      aria: a.name + (st === 'Draft' ? ', draft. Turn on to publish' : on ? ', on' : ', off'),
      toggle: () => { set({ autoConfirm: '' }); A.updateAutomation(a.raw, { enabled: !on, is_draft: false }, (on ? 'turned off' : isDraftA(a) ? 'published' : 'turned on') + ' the automation'); },
      confirming: confirming, notConfirming: !confirming,
      delAria: confirming ? 'Confirm delete ' + a.name : 'Delete ' + a.name,
      delStyle: 'height: 40px; min-width: 40px; flex: none; padding: 0 ' + (confirming ? '10px' : '0') + '; border: 0; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; ' + (confirming ? 'background: var(--red-soft); color: var(--red-ink);' : 'background: transparent; color: var(--muted-2);'),
      del: () => { if (confirming) { set({ autoConfirm: '' }); A.deleteAutomation(a.raw); } else set({ autoConfirm: a.id }); },
      edit: () => set({ flowOpen: a.id, autoConfirm: '' }), editAria: 'Open ' + a.name + ' in the flow builder'
    }, sw(on));
  };
  const SECS = [
    ['production', 'Production', 'Alerts and setup while projects move', 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z', 'blue'],
    ['sponsor', 'Sponsors & clients', 'Review links, approvals and reminders', 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'amber'],
    ['publishing', 'Publishing & distribution', 'Scheduling and post-publish tasks', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM10 8l6 4-6 4z', 'violet'],
    ['custom', 'Custom', 'Workflows you built', 'M13 2 3 14h9l-1 8 10-12h-9l1-8z', 'green']
  ];
  const wfSections = SECS.map((x) => {
    const items = autoShown.filter((a) => (a.cat || 'custom') === x[0]).map(wfCard);
    return { hid: 'wf-' + x[0], title: x[1], desc: x[2], icon: x[3], countText: String(items.length), count: items.length,
      tileStyle: 'width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--' + x[4] + '-soft); color: var(--' + x[4] + '-ink);', items: items };
  }).filter((x) => x.count > 0);
  const autos = autoList.map(wfCard);
  // app: keys are managed in Workspace Settings > Integrations, so connectors here link there instead of toggling.
  const integrations = D.integrations.map((g) => {
    const on = g.status === 'connected';
    const used = autoList.filter((a) => a.app === g.name).length;
    const managed = !!providerById(g.provider);
    return {
      name: g.name, desc: providerById(g.provider)?.description || (g.provider === 'buffer' ? 'Pulls sent posts and analytics from your social channels. Comments and DMs stay in Buffer.' : g.description), initials: g.name.slice(0, 1), tileStyle: tile(g.tone || 'blue'),
      usedBy: used ? 'Used by ' + used + ' workflow' + (used === 1 ? '' : 's') : 'Not used yet',
      status: on && g.last_error ? 'Needs attention' : on ? 'Connected' : 'Not connected',
      statusStyle: hardBlock(on && g.last_error ? solid('red') : on ? solid('green') : null, 24),
      btn: managed ? (on ? 'Manage in Settings' : 'Connect in Settings') : 'Coming soon', aria: (managed ? 'Manage ' : 'Not available yet: ') + g.name,
      btnStyle: managed ? (on ? ui.btnGhost : ui.btnPrimary + ' justify-content: center;') : ui.btnGhost + ' opacity: 0.55; cursor: default;',
      toggle: managed ? () => set({ nav: 'workspace', wsTab: 'integ', integFocus: g.provider }) : SINK
    };
  });

  // ---------- Integrations (Workspace Settings) ----------
  // app: Super Admin pastes keys here. Secrets go to the server and Vault; the page only ever sees config.keyHint.
  const integRow = {};
  D.integrations.forEach((g) => { integRow[g.provider] = g; });
  const drafts = s.integDraft || {};
  const busy = s.integBusy || '';
  const aiPick = settings.ai_provider || '';
  const liveAi = AI_PROVIDERS.filter((id) => integRow[id] && integRow[id].status === 'connected');
  const aiActive = liveAi.indexOf(aiPick) >= 0 ? aiPick : (liveAi[0] || '');
  // app: AI model fields are a dropdown of the models the key can use. The list comes from the provider with the
  // pasted key (once it looks complete) or the saved one, and is fetched again when the key changes.
  const modelLists = s.integModels || {};
  const setModels = (pid, src, entry) => set((cur) => {
    const all = Object.assign({}, cur.integModels || {});
    if (entry.status !== 'loading' && (!all[pid] || all[pid].src !== src)) return {};
    all[pid] = Object.assign({ src: src, list: [] }, entry);
    return { integModels: all };
  });
  const queueModels = (pid, src) => {
    if (modelsPending[pid] === src) return;
    modelsPending[pid] = src;
    clearTimeout(modelsTimer[pid]);
    modelsTimer[pid] = setTimeout(() => {
      setModels(pid, src, { status: 'loading' });
      A.listModels(pid, src === 'saved' ? '' : src)
        .then((list) => setModels(pid, src, { status: 'ok', list: list }))
        .catch((e) => setModels(pid, src, { status: 'error', error: (e && e.message) || 'Could not load the models.' }))
        .then(() => { if (modelsPending[pid] === src) delete modelsPending[pid]; });
    }, 400);
  };
  const integCard = (p) => {
    const g = integRow[p.id] || { provider: p.id, name: p.name, description: '', tone: 'blue', status: 'disconnected', config: {} };
    const cfg = g.config || {};
    const on = g.status === 'connected';
    const err = (s.integErrors || {})[p.id] || (on && g.last_error ? g.last_error : '');
    const dr = drafts[p.id] || {};
    const setDraft = (k) => (e) => { const v = e && e.target ? e.target.value : ''; set((cur) => { const all = Object.assign({}, cur.integDraft || {}); all[p.id] = Object.assign({}, all[p.id] || {}, { [k]: v }); return { integDraft: all }; }); };
    const pastedKey = String(dr.apiKey || '').trim();
    const modelSrc = pastedKey.length >= 20 ? pastedKey : on ? 'saved' : '';
    const ml = modelLists[p.id] && modelLists[p.id].src === modelSrc ? modelLists[p.id] : null;
    // Only while Workspace > Integrations is open: these values are built on every page, and the list is a provider call.
    const integOpen = s.nav === 'workspace' && s.wsTab === 'integ';
    if (integOpen && modelSrc && !ml && p.fields.some((f) => f.choices === 'models')) queueModels(p.id, modelSrc);
    const fields = p.fields.map((f) => {
      const saved = f.secret ? '' : (cfg[f.key] != null ? String(cfg[f.key]) : '');
      const available = ml?.status === 'ok' ? ml.list : [];
      const suggested = f.choices === 'models' && !on && !saved && available.length ? available[0].id : f.defaultValue || '';
      const value = dr[f.key] !== undefined ? dr[f.key] : (f.secret ? '' : (saved || suggested));
      const field = {
        id: 'ig-' + p.id + '-' + f.key, label: f.label + (f.optional ? ' (optional)' : ''), type: f.secret ? 'password' : 'text',
        value: value,
        placeholder: f.secret && on ? 'Saved. Paste a new value to replace it' : (f.placeholder || ''),
        help: f.help || '', hasHelp: !!f.help, onInput: setDraft(f.key), auto: f.secret ? 'off' : 'on', isSelect: false, options: []
      };
      if (f.choices !== 'models') return field;
      const list = ml && ml.status === 'ok' ? ml.list : [];
      const options = list.map((o) => ({ value: o.id, label: o.label }));
      if (value && !list.some((o) => o.id === value)) options.unshift({ value: value, label: list.length ? value + ' (not available for this key)' : value });
      field.isSelect = true;
      field.options = options;
      field.help = !modelSrc ? 'Paste an API key to choose from the models it can use.'
        : !ml || ml.status === 'loading' ? 'Loading the models this key can use…'
        : ml.status === 'error' ? 'Could not load the models: ' + ml.error
        : !list.length ? 'This key has no models to choose from.' : f.help || '';
      field.hasHelp = !!field.help;
      return field;
    });
    const save = () => {
      const out = {};
      p.fields.forEach((f) => { const v = dr[f.key]; if (v !== undefined) out[f.key] = v; else if (!f.secret) out[f.key] = fields.find((field) => field.id === 'ig-' + p.id + '-' + f.key)?.value || ''; });
      set({ integBusy: p.id });
      A.saveIntegration(g, out).then((result) => set((cur) => {
        const all = Object.assign({}, cur.integDraft || {}), lists = Object.assign({}, cur.integModels || {});
        const errors = Object.assign({}, cur.integErrors || {});
        if (result === true) { delete all[p.id]; delete lists[p.id]; delete errors[p.id]; }
        else errors[p.id] = result?.error || 'Could not connect. Try again.';
        return { integBusy: '', integDraft: all, integModels: lists, integErrors: errors };
      }));
    };
    const isAi = AI_PROVIDERS.indexOf(p.id) >= 0;
    const isBusy = !!busy;
    const checked = g.last_synced_at ? 'Synced ' + relTime(g.last_synced_at, now) : g.last_checked_at ? 'Checked ' + relTime(g.last_checked_at, now) : '';
    return {
      id: p.id, name: p.name, desc: p.description || (p.id === 'buffer' ? 'Pulls sent posts and analytics from your social channels. Comments and DMs stay in Buffer.' : g.description), initials: p.name.slice(0, 1), tileStyle: tile(g.tone || 'blue'),
      setupNote: p.setupNote || '', credentialLabel: p.credentialLabel || 'Get a key', disabled: isBusy,
      status: on && g.last_error ? 'Needs attention' : on ? 'Connected' : 'Not connected',
      statusStyle: hardBlock(on && g.last_error ? solid('red') : on ? solid('green') : null, 24),
      keyNote: on ? ['Credential ending ' + (cfg.keyHint || '····'), checked].filter(Boolean).join('  ·  ') : 'No credentials saved',
      err: err, hasErr: !!err,
      fields: fields,
      saveLabel: busy === p.id ? 'Checking…' : on ? 'Save and test' : 'Save and connect', save: isBusy ? SINK : save, saveAria: (on ? 'Save ' : 'Connect ') + p.name,
      canDisconnect: on, disconnect: () => {
        set({ integBusy: p.id + ':disconnect' });
        A.disconnectIntegration(g).finally(() => set((cur) => {
          const errors = Object.assign({}, cur.integErrors || {}); delete errors[p.id];
          return { integBusy: '', integErrors: errors };
        }));
      }, disconnectAria: 'Disconnect ' + p.name,
      canSync: on && !!p.canSync, sync: () => { set({ integBusy: p.id + ':sync' }); A.syncIntegration(g).then(() => set({ integBusy: '' })); },
      syncLabel: busy === p.id + ':sync' ? 'Syncing…' : 'Sync now', syncAria: 'Sync ' + p.name + ' now',
      docs: p.docs, keyUrl: p.keyUrl,
      isAi: isAi && on, aiOn: aiActive === p.id ? 'true' : 'false', aiLabel: aiActive === p.id ? 'Used by the assistant' : 'Use for the assistant',
      aiPick: () => A.updateSettings({ ai_provider: p.id }, 'set the assistant model to', p.name),
      aiStyle: 'min-height: 36px; padding: 0 12px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; align-self: flex-start; ' + (aiActive === p.id ? 'background: var(--inv); color: var(--inv-ink); border: 1px solid var(--ink);' : 'background: var(--surface); color: var(--ink-3); border: 1px solid var(--border);')
    };
  };
  const integGroups = GROUPS.map((gr) => ({ id: gr[0], title: gr[1], desc: gr[2], hid: 'ig-h-' + gr[0], cards: PROVIDERS.filter((p) => p.group === gr[0]).map(integCard) }));
  const managedN = PROVIDERS.filter((p) => integRow[p.id] && integRow[p.id].status === 'connected').length;
  const CH = [['app', 'In-app'], ['email', 'Email'], ['slack', 'Slack']];
  const EVENTS = [['assigned', 'Assigned to a project', 'app,email,slack'], ['revision', 'Revision requested', 'app,email,slack'], ['status', 'Status changes on my projects', 'app,slack'], ['comment', 'New comment or mention', 'app'], ['due', 'Deadline in 24 hours', 'app,email,slack'], ['approval', 'Reviews and approvals', 'app,email']];
  // app: email goes out for these events only (lib/email/notifications.ts); the rest show no email box.
  const EMAIL_EVENTS = ['assigned', 'revision', 'due', 'approval'];
  const ntf = settings.notify_defaults || {};
  const NT_COLS = 'display: grid; grid-template-columns: minmax(220px, 1fr) repeat(3, 96px); align-items: center;';
  const notif = EVENTS.map((e) => ({
    label: e[1],
    cells: CH.map((ch) => {
      const k = e[0] + ':' + ch[0];
      if (ch[0] === 'email' && EMAIL_EVENTS.indexOf(e[0]) < 0) return { na: true, on: false, aria: e[1] + ' by ' + ch[1] + ': not available', pick: SINK };
      const on = ntf[k] === undefined ? e[2].split(',').indexOf(ch[0]) >= 0 : !!ntf[k];
      return { na: false, on: on, aria: e[1] + ' by ' + ch[1], pick: () => A.updateSettings({ notify_defaults: Object.assign({}, ntf, { [k]: !on }) }) };
    })
  }));
  const ntHead = CH.map((ch) => ({ label: ch[1], style: 'padding: 0 16px; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2); text-align: center;' }));
  const autoTab = s.autoTab || 'workflows';
  // ---------- Run history ----------
  const STEP_L = { task: 'Task', delay: 'Time delay', split: 'Split' };
  const RUN_T = { done: ['Done', 'green'], test: ['Test', 'blue'], retry: ['Retrying', 'amber'], running: ['Running', 'amber'], queued: ['Queued', 'gray'], failed: ['Failed', 'red'], skipped: ['Skipped', 'gray'] };
  const autoName = {};
  D.automations.forEach((a) => { autoName[a.id] = a.name; });
  const projOfId = {};
  allRows.concat(c.catalogRows).forEach((r) => { projOfId[r.id] = r; });
  const rq = s.runSt || 'all';
  const runList = (D.automationRuns || []).filter((r) => rq === 'all' || r.status === rq || (rq === 'failed' && r.status === 'retry'));
  const runs = runList.slice(0, s.runMore ? 150 : 40).map((r) => {
    // A flow parked on a time delay is a retry with output.waiting (lib/automations/run.ts).
    const t = r.status === 'retry' && r.output && r.output.waiting ? ['Waiting', 'blue'] : RUN_T[r.status] || [r.status, 'gray'];
    const out = r.output || {};
    const p = r.project_id ? projOfId[r.project_id] : null;
    const steps = (out.steps || []).map((x) => ({ text: (x.ok ? '✓ ' : '✕ ') + ((actionById(x.action) || {}).label || STEP_L[x.action] || x.action) + ': ' + x.detail, style: 'font-size: 13px; line-height: 1.45; color: ' + (x.ok ? 'var(--ink-3)' : 'var(--red-ink)') + ';' }));
    return {
      id: r.id, name: autoName[r.automation_id] || 'Deleted workflow', status: t[0], statusStyle: hardBlock(solid(t[1]), 24),
      trigger: out.trigger || r.trigger_key || '', project: p ? p.job + '  ·  ' + p.title : '', hasProject: !!p, openProject: p ? openProject(p.job) : SINK,
      when: relTime(r.created_at, now), tries: r.attempts > 1 ? r.attempts + ' tries' : '',
      steps: steps, error: r.error || '', hasError: !!r.error && !steps.some((x) => x.text.indexOf('✕') === 0),
      next: r.status === 'retry' && r.next_attempt_at ? (r.output && r.output.waiting ? 'Continues at ' : 'Next try at ') + new Date(r.next_attempt_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
      canRetry: r.status === 'failed', retry: () => A.retryRun(r)
    };
  });
  const runTabs = [['all', 'All'], ['done', 'Done'], ['failed', 'Failed'], ['test', 'Tests'], ['skipped', 'Skipped']].map((x) => tab(x[1], x[0] === 'all' ? (D.automationRuns || []).length : (D.automationRuns || []).filter((r) => r.status === x[0] || (x[0] === 'failed' && r.status === 'retry')).length, rq === x[0], () => set({ runSt: x[0] })));
  const connectedN = integrations.filter((g) => g.status === 'Connected').length;
  const wfTabs = [['workflows', 'Workflows', String(autoList.length)], ['runs', 'Run history', String((D.automationRuns || []).filter((r) => !r.is_test).length)], ['connectors', 'Connectors', connectedN + ' of ' + integrations.length], ['settings', 'Settings', '']].map((x) => {
    const on = autoTab === x[0];
    return { id: 'atab-' + x[0], label: x[1], count: x[2], hasCount: !!x[2], selected: on ? 'true' : 'false', pick: () => set({ autoTab: x[0], autoConfirm: '' }),
      style: 'min-height: 48px; padding: 0 2px; border: 0; border-bottom: 2px solid ' + (on ? 'var(--ink)' : 'transparent') + '; background: transparent; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap; font-size: 15px; color: ' + (on ? 'var(--ink)' : 'var(--muted)') + ';' };
  });
  const wfStatus = [['all', 'All'], ['Live', 'Live'], ['Paused', 'Paused'], ['Draft', 'Draft'], ['Process', 'Processes'], ['Idea', 'Ideas']].filter((x) => !KIND_L[x[0].toLowerCase()] || autoList.some((a) => statusA(a) === x[0])).map((x) => tab(x[1], x[0] === 'all' ? autoList.length : autoList.filter((a) => statusA(a) === x[0]).length, aSt === x[0], () => set({ autoSt: x[0] })));
  const setAS = (k, label) => () => A.updateSettings({ automation: Object.assign({}, autoSet, { [k]: !autoSet[k] }) }, (autoSet[k] ? 'turned off ' : 'turned on ') + label.toLowerCase(), 'Automation settings');
  const runSettings = [['paused', 'Pause all automations', 'Nothing queues or runs until you resume'], ['retry', 'Retry failed runs', 'Three tries over 15 minutes, without repeating steps that worked'], ['failAlert', 'Alert on failures', 'Super Admins get an in-app alert and an email, plus Slack when connected'], ['sandbox', 'Test mode for new workflows', 'New workflows start as drafts; Test run shows what they would do']]
    .map((x) => Object.assign({ label: x[1], desc: x[2], toggle: setAS(x[0], x[1]) }, sw(!!autoSet[x[0]])));
  const autoRet = String(autoSet.retention || '90');
  const weekRuns = (D.automationRuns || []).filter((r) => !r.is_test && new Date(r.created_at) >= new Date(now.getTime() - 7 * 86400000));
  const autoStats = [
    stat('Live workflows', autoList.filter((a) => statusA(a) === 'Live').length, autoSet.paused ? 'All paused' : autoList.filter((a) => statusA(a) === 'Draft').length + ' drafts', !!autoSet.paused),
    stat('Runs this week', weekRuns.filter((r) => r.status === 'done').length, weekRuns.filter((r) => r.status === 'queued' || r.status === 'running' || r.status === 'retry').length + ' waiting'),
    stat('Failed this week', weekRuns.filter((r) => r.status === 'failed').length, weekRuns.some((r) => r.status === 'failed') ? 'See Run history' : 'Nothing failed', weekRuns.some((r) => r.status === 'failed'))
  ];

  // ---------- Activity Log ----------
  const CAT = { project: ['Project change', 'blue'], idea: ['Idea', 'coral'], approval: ['Approval', 'green'], deletion: ['Deletion', 'red'], admin: ['Admin', 'violet'], access: ['Access', 'amber'] };
  const seenLog = new Set();
  const logs = D.activity.concat(D.olderActivity || []).filter((l) => (seenLog.has(l.id) ? false : (seenLog.add(l.id), true))).map((l) => {
    const g = dayGroup(l.created_at, now);
    const t = new Date(l.created_at);
    return {
      g: g, time: g === 'today' ? relTime(l.created_at, now) : g === 'yesterday' ? t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : labelOf(l.created_at),
      who: l.actor_id && l.actor_id === me.id ? 'You' : (l.actor_label || 'Automation'), cat: l.category, text: l.action, target: l.target_label, src: SRC[l.source] || 'Web app', at: l.created_at
    };
  });
  const lCat = s.logCat || 'all';
  const lq = (s.logQ || '').trim().toLowerCase();
  const logShown = logs.filter((l) => (lCat === 'all' || l.cat === lCat) && (!lq || (l.who + ' ' + l.text + ' ' + l.target).toLowerCase().includes(lq)));
  const logTabs = [['all', 'All', null]].concat(Object.keys(CAT).map((k) => [k, CAT[k][0], CAT[k][1]])).map((t) => Object.assign(tab(t[1], t[0] === 'all' ? logs.length : logs.filter((l) => l.cat === t[0]).length, lCat === t[0], () => set({ logCat: t[0] })), {
    swatch: t[2] ? 'width: 10px; height: 10px; flex: none; background: ' + solid(t[2])[0] + ';' : 'display: none;'
  }));
  const LOG_COLS = 'display: grid; grid-template-columns: 110px minmax(160px, 0.9fr) 150px minmax(300px, 2.6fr) 110px; align-items: center;';
  const logGroups = [['today', 'Today'], ['yesterday', 'Yesterday'], ['earlier', 'Earlier']].map((g) => {
    const items = logShown.filter((l) => l.g === g[0]);
    return {
      title: g[1], countText: String(items.length), count: items.length,
      items: items.map((l, i) => ({
        time: l.time, who: l.who, text: l.text, target: l.target, source: l.src,
        initials: l.who.slice(0, 1),
        avatarStyle: 'width: 28px; height: 28px; border-radius: 999px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #FFFFFF; background: ' + (l.who === 'Automation' ? '#3A3B40' : actColor(l.who)) + ';',
        cat: CAT[l.cat][0], catStyle: hardBlock(solid(CAT[l.cat][1]), 24),
        rowStyle: LOG_COLS + ' min-height: 56px;' + (i ? ' border-top: 1px solid var(--line);' : '')
      }))
    };
  }).filter((g) => g.count > 0);
  const logCsv = [['When', 'Who', 'Category', 'Action', 'Target', 'Source']].concat(logShown.map((l) => [l.at, l.who, CAT[l.cat][0], l.text, l.target, l.src]));

  // ---------- What's New ----------
  // The newest release pops up once per Super Admin; s.relSeen covers the moment before prefs save.
  const latest = RELEASES[0];
  const lastSeen = s.relSeen || (me.prefs || {}).lastRelease || '';
  const unseen = !!latest && latest.id !== lastSeen;
  const relDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const markSeen = () => { if (!latest) return; set({ relSeen: latest.id }); A.savePrefs({ lastRelease: latest.id }); };
  const releases = RELEASES.map((r, i) => ({ id: r.id, title: r.title, date: relDate(r.date), items: r.items, latest: i === 0 }));
  const wn = {
    open: unseen && page !== 'updates', title: latest ? latest.title : '', date: latest ? relDate(latest.date) : '', items: latest ? latest.items : [],
    close: markSeen,
    onKey: (e) => { if (e.key === 'Escape') markSeen(); },
    viewAll: () => { markSeen(); set({ nav: 'updates', openJob: '', menu: '' }); }
  };
  // Opening the log counts as reading the newest release.
  if (unseen && page === 'updates') setTimeout(markSeen, 0);

  // ---------- Workspace ----------
  const ws = Object.assign({ name: D.ws.name, tz: settings.timezone || 'America/Chicago', view: settings.default_view || 'table', week: settings.week_start || 'sun' }, s.ws || {});
  const setWs = (patch) => set({ ws: Object.assign({}, ws, patch), wsDirty: true });
  const wsTab = s.wsTab || 'general';
  const wsTabs = [['general', 'General'], ['statuses', 'Project statuses'], ['fields', 'Custom fields'], ['templates', 'Templates'], ['integ', 'Integrations']].map((t) => {
    const on = wsTab === t[0];
    return { label: t[1], current: on ? 'page' : 'false', pick: () => set({ wsTab: t[0] }), style: 'min-height: 44px; width: 100%; padding: 0 12px; border: 0; border-radius: 12px; text-align: left; cursor: pointer; font-size: 14px; ' + (on ? 'font-weight: 600; background: var(--chip-2); color: var(--ink);' : 'font-weight: 500; background: transparent; color: var(--ink-4);') };
  });
  const opt = (list, cur) => list.map((o) => ({ value: o[0], label: o[1], on: o[0] === cur }));
  const STAGES3 = [['In Production', 'In Production'], ['Post Production', 'Post Production'], ['Publishing', 'Publishing']];
  const newStage = s.newStage || 'Post Production';
  const statuses = statusList.map((x, i) => {
    const f = x.custom ? solid('gray') : fillFor('status', x.label);
    const used = allRows.concat(c.catalogRows).filter((r) => r.status === x.label).length;
    return {
      n: String(i + 1), label: x.label, stage: x.stage, style: hardBlock(f, 28),
      used: used + (used === 1 ? ' project' : ' projects'),
      canRemove: x.custom, aria: 'Remove status ' + x.label,
      remove: () => used ? A.toast('Move the ' + used + ' project' + (used === 1 ? '' : 's') + ' off ' + x.label + ' first.') : A.removeStatus(x)
    };
  });
  const addStatus = () => {
    const nm = (s.newStatus || '').trim();
    if (!nm || statusList.some((x) => x.label.toLowerCase() === nm.toLowerCase())) return;
    set({ newStatus: '' });
    A.addStatus(nm, STAGE_V[newStage], statusList.length + 1);
  };
  const RLAB = { admin: 'Super Admin', editor: 'Editor', designer: 'Designer', sponsor: 'Sponsor' };
  const toUi = (roles) => Array.from(new Set((roles || []).map((r) => UI_ROLE[r])));
  const fields = D.customFields.map((f) => {
    const cur = toUi(f.visible_roles);
    return {
      label: f.label, type: FIELD_TYPE_L[f.type] || 'Text', aria: 'Remove field ' + f.label,
      remove: () => A.removeField(f),
      board: Object.assign({ aria: f.label + (f.on_board ? ' is on the board' : ' is off the board'), toggle: () => A.setFieldOnBoard(f, !f.on_board) }, sw(!!f.on_board)),
      roles: ['admin', 'editor', 'designer', 'sponsor'].map((rid) => {
        const on = cur.indexOf(rid) >= 0;
        return {
          label: RLAB[rid], pressed: on ? 'true' : 'false', aria: RLAB[rid] + (on ? ' can see ' : ' cannot see ') + f.label,
          pick: () => { if (rid === 'admin') return; A.setFieldRoles(f, on ? cur.filter((x) => x !== rid) : cur.concat([rid])); },
          style: 'min-height: 32px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; ' + (on ? 'background: var(--inv); color: var(--inv-ink); border: 1px solid var(--ink);' : 'background: var(--surface); color: var(--ink-3); border: 1px solid var(--border);')
        };
      })
    };
  });
  const FTYPES = ['Text', 'Number', 'Select', 'Date', 'Person', 'URL', 'Checkbox'];
  const newFType = s.newFType || 'Text';
  const addField = () => {
    const nm = (s.newField || '').trim();
    if (!nm) return;
    set({ newField: '' });
    A.addField({ label: nm, type: newFType, onBoard: true });
  };
  const typeLabelOf = (id) => (D.types.find((t) => t.id === id) || {}).label || '';
  const templates = D.templates.map((t) => {
    const team = [c.nameOf(t.default_editor_id), c.nameOf(t.default_designer_id)].filter(Boolean).join(', ') || 'Not set';
    const type = typeLabelOf(t.content_type_id);
    return {
      type: type || 'Any type', name: t.name, typeStyle: hardBlock(TYPEFILL[type], 26) + ' align-self: flex-start;',
      facts: [{ label: 'Checklist', value: (t.steps || []).length + ' steps' }, { label: 'Edit due', value: 'Film + ' + wf.editDays + ' days' }, { label: 'Thumbnail due', value: 'Pub minus ' + wf.thumbDays + ' days' }, { label: 'Default team', value: team }],
      edit: () => openRec.template(t), editAria: 'Edit template ' + t.name
    };
  });
  const saveWs = () => A.saveWorkspace(ws).then(() => set({ wsDirty: false, ws: null }));
  const VIEW_LIST2 = [['table', 'Table'], ['kanban', 'Kanban'], ['list', 'List'], ['timeline', 'Timeline'], ['calendar', 'Calendar']];
  const wsObj = {
    name: ws.name, onName: (e) => setWs({ name: e && e.target ? e.target.value : '' }),
    tzs: opt([['America/Chicago', 'Central Time (Chicago)'], ['America/New_York', 'Eastern Time (New York)'], ['America/Los_Angeles', 'Pacific Time (Los Angeles)'], ['Europe/London', 'London']], ws.tz),
    onTz: (e) => setWs({ tz: e && e.target ? e.target.value : ws.tz }),
    views: opt(VIEW_LIST2, ws.view), onView: (e) => setWs({ view: e && e.target ? e.target.value : ws.view }),
    weeks: [['sun', 'Sunday'], ['mon', 'Monday']].map((w) => ({ label: w[1], on: ws.week === w[0] ? 'true' : 'false', pick: () => setWs({ week: w[0] }), style: 'min-height: 36px; padding: 0 14px; border: 0; border-radius: 10px; cursor: pointer; font-size: 13px; ' + (ws.week === w[0] ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06);' : 'background: transparent; color: var(--muted);') })),
    statuses: statuses, newStatus: s.newStatus || '', onNewStatus: (e) => set({ newStatus: e && e.target ? e.target.value : '' }),
    stages: opt(STAGES3, newStage), onNewStage: (e) => set({ newStage: e && e.target ? e.target.value : newStage }), addStatus: addStatus,
    fields: fields, newField: s.newField || '', onNewField: (e) => set({ newField: e && e.target ? e.target.value : '' }),
    ftypes: FTYPES.map((t) => ({ value: t, label: t, on: t === newFType })), onNewFType: (e) => set({ newFType: e && e.target ? e.target.value : 'Text' }), addField: addField,
    templates: templates,
    integNote: managedN + ' of ' + PROVIDERS.length + ' integrations connected. Keys are stored encrypted and only Super Admins can add, replace or remove them.',
    integGroups: integGroups,
    goAuto: () => set({ nav: 'auto' })
  };

  // ---------- Page header ----------
  const PAGES = {
    team: { title: 'User Management', desc: 'Invite, deactivate and remove editors, designers, sponsors and clients.', primary: 'Add user', plus: true, pick: c.openAddUser, stats: userStats },
    roles: { title: 'Roles & Permissions', desc: 'Control what each user type can view, create, edit, approve and delete.', primary: permDirty ? 'Save changes' : '', pick: savePerm, ghost: permDirty ? 'Discard' : '', ghostPick: () => set({ permDraft: {} }), note: permDirty ? 'Unsaved changes' : 'All changes saved', noteOn: permDirty },
    pm: { title: 'Workload', desc: 'Assignments, deadlines, statuses and workflow rules across every project.', ghost: 'Open board', ghostPick: () => set({ nav: 'projects' }), stats: pmStats },
    clients: { title: 'Clients & Sponsors', desc: 'Accounts, the projects linked to them, and what each one can access.', primary: 'Add account', plus: true, pick: () => set({ acctModal: true, naName: '', naEmail: '', naType: 'sponsor', naInvite: true, acctErr: '' }), stats: clientStats },
    finance: { title: 'Financial Management', desc: 'Project budgets, client payments, sponsor revenue and contractor payouts.', ghost: 'Export CSV', ghostPick: () => A.exportCsv(fin.csv, fin.label), primary: FIN_NEW[fTab][0], plus: true, pick: FIN_NEW[fTab][1], stats: finStats },
    auto: { title: 'Automation Management', desc: 'Workflows first. Connectors, run history and run settings live in their own tabs.', primary: 'New flow', plus: true, pick: () => set({ flowOpen: 'new' }), stats: autoStats },
    updates: { title: 'What\u2019s New', desc: 'What changed in each update to FTGU Studio, newest first.' },
    logs: { title: 'Activity Log', desc: 'User actions, project changes, approvals, deletions and admin changes.', ghost: 'Export CSV', ghostPick: () => A.exportCsv(logCsv, 'Activity log') },
    workspace: { title: 'Workspace Settings', desc: 'Global settings, project statuses, custom fields, templates and integrations.', primary: s.wsDirty ? 'Save changes' : wsTab === 'templates' ? 'New template' : '', plus: !s.wsDirty && wsTab === 'templates', pick: s.wsDirty ? saveWs : () => openRec.template(null), note: s.wsDirty ? 'Unsaved changes' : 'All changes saved', noteOn: !!s.wsDirty }
  };
  const P0 = PAGES[page] || PAGES.team;
  const ap = {
    title: P0.title, desc: P0.desc,
    hasTag: !!P0.tag, tag: P0.tag || '', tagStyle: 'display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 999px; background: var(--chip-2); color: var(--ink-3); font-size: 12px; font-weight: 600;',
    hasNote: !!P0.note, note: P0.note || '', noteStyle: 'font-size: 13px; font-weight: 600; color: ' + (P0.noteOn ? 'var(--amber-ink)' : 'var(--muted-2)') + ';',
    hasGhost: !!P0.ghost, ghost: P0.ghost || '', ghostPick: P0.ghostPick || SINK,
    hasPrimary: !!P0.primary, primary: P0.primary || '', plus: !!P0.plus, primaryPick: P0.pick || SINK
  };

  const adm = {
    isUsers: page === 'team', isRoles: page === 'roles', isPM: page === 'pm', isClients: page === 'clients', isFinance: page === 'finance', isAuto: page === 'auto', isLogs: page === 'logs', isUpdates: page === 'updates', isWorkspace: page === 'workspace',
    hasStats: !!(P0.stats && P0.stats.length), stats: P0.stats || [],
    roleTabs: roleTabs, roleLabel: pr.label, roleBlock: roleBlock(pRole) + ' height: 30px; font-size: 13px;', roleDesc: pr.desc,
    roleMembers: members.filter((m) => m.type === pRole).length + ' members',
    permNote: locked ? 'Super Admin always has full access.' : 'Changes apply to every ' + pr.label + ' after you save.',
    permHead: ACTS.map((a) => ({ label: a[1], style: 'padding: 0 8px; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2); text-align: center;' })),
    permHeadStyle: PERM_COLS + ' min-height: 44px;',
    permRowStyle: PERM_COLS + ' min-height: 60px; border-top: 1px solid var(--line);',
    permRows: permRows, roleViews: roleViews, roleFields: roleFields,
    roleFieldNote: roleFields.length + ' of ' + ROLES[0].cols.length + ' board fields are visible to this user type.',
    attention: attention, attnCount: String(attention.length), attnEmpty: attention.length === 0,
    workload: workload, wlGrid: WL_COLS, wlRow: WL_COLS + ' min-height: 60px; border-bottom: 1px solid var(--line);',
    flow: flow, deadlines: deadlines, rules: rules,
    acctTabs: [['all', 'All', acctAll.length], ['client', 'Clients', acctAll.filter((a) => a.type === 'client').length], ['sponsor', 'Sponsors', acctAll.filter((a) => a.type === 'sponsor').length]].map((t) => tab(t[1], t[2], aTab === t[0], () => set({ acctTab: t[0] }))),
    onAcctSearch: (e) => set({ acctQ: e && e.target ? e.target.value : '' }),
    accounts: accounts, acctEmpty: accounts.length === 0, acctGrid: ACCT_COLS, acctRow: ACCT_COLS + ' min-height: 64px; border-top: 1px solid var(--line);',
    hasAcct: !!selA, acct: acct,
    acctModal: !!s.acctModal, closeAcct: () => set({ acctModal: false, acctErr: '' }),
    onAcctName: (e) => set({ naName: e && e.target ? e.target.value : '' }),
    onAcctEmail: (e) => set({ naEmail: e && e.target ? e.target.value : '' }),
    naInvite: s.naInvite !== false, onNaInvite: () => set({ naInvite: s.naInvite === false }),
    acctTypes: acctTypes, addAcct: addAcct, acctErr: s.acctErr || '', hasAcctErr: !!s.acctErr,
    finTabs: finTabs, fin: fin,
    autos: autos, autoCount: String(autos.length), integrations: integrations,
    wfTabs: wfTabs, isWfTab: autoTab === 'workflows', isConnTab: autoTab === 'connectors', isSetTab: autoTab === 'settings', isRunTab: autoTab === 'runs',
    runs: runs, runTabs: runTabs, runsEmpty: runs.length === 0, runsMore: !s.runMore && runList.length > 40, showMoreRuns: () => set({ runMore: true }),
    runsNote: 'Runs older than ' + autoRet + ' days are removed (Settings > Run history). Failed runs retry ' + (autoSet.retry ? 'twice, 5 and 10 minutes later' : 'never; Retry failed runs is off') + '.',
    onWfSearch: (e) => set({ autoQ: e && e.target ? e.target.value : '' }),
    wfStatus: wfStatus, allPaused: !!autoSet.paused, resumeAll: () => A.updateSettings({ automation: Object.assign({}, autoSet, { paused: false }) }, 'resumed', 'all automations'),
    wfSections: wfSections, wfEmpty: wfSections.length === 0,
    connNote: connectedN + ' of ' + integrations.length + ' connectors are connected. Open a connector to add credentials, test access or review its available features.',
    runSettings: runSettings,
    retOpts: [['30', '30 days'], ['90', '90 days'], ['365', '1 year']].map((o) => ({ value: o[0], label: o[1], on: o[0] === autoRet })),
    onRet: (e) => { const v = e && e.target ? e.target.value : '90'; A.updateSettings({ automation: Object.assign({}, autoSet, { retention: v }) }, 'changed run history retention to', v + ' days'); },
    notif: notif, ntHead: ntHead, ntGrid: NT_COLS, ntRow: NT_COLS + ' min-height: 52px; border-top: 1px solid var(--line);',
    logTabs: logTabs, logGroups: logGroups, logEmpty: logGroups.length === 0,
    logCount: 'Showing ' + logs.length + ' entries' + (D.activityEnd ? ', the whole history.' : '. Older entries load on request and are included in Export CSV.'),
    canLoadOlder: !D.activityEnd && D.activity.length >= 400, loadOlder: () => { set({ logBusy: true }); A.loadOlderActivity().then(() => set({ logBusy: false })); }, logBusy: !!s.logBusy,
    onLogSearch: (e) => set({ logQ: e && e.target ? e.target.value : '' }),
    releases: releases,
    wsTabs: wsTabs, ws: wsObj,
    wsGeneral: wsTab === 'general', wsStatuses: wsTab === 'statuses', wsFields: wsTab === 'fields', wsTemplates: wsTab === 'templates', wsInteg: wsTab === 'integ'
  };
  return {
    adm: adm, ap: ap, ui: ui, wn: wn,
    badges: { team: members.filter((m) => m.status === 'Invited').length, pm: attention.length, updates: unseen ? 1 : 0 }
  };
}
