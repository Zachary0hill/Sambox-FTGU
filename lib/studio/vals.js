// Board, drawer, cell editor and app shell. Ported from the design's renderVals(); the role comes from
// the signed-in member, not a preview switcher, and every write goes through lib/studio/actions.js.
import { ideasVals } from './vals-ideas';
import { pagesVals } from './vals-pages';
import { adminVals } from './vals-admin';
import {
  MONTHS, MONTH_NAMES, WEEKDAYS_LONG, UI_ROLE, startOfDay, isoOf, dateOfLabel, relTime, labelOf, paletteColor, first,
} from './model';

export const COLS = {
  project: { label: 'Project', w: 340, kind: 'title' },
  job: { label: 'Job #', w: 108, kind: 'mono' },
  channel: { label: 'Channel', w: 144, kind: 'text' },
  type: { label: 'Content Type', w: 156, kind: 'pill' },
  film: { label: 'Film Date', w: 128, kind: 'date' },
  editor: { label: 'Editor', w: 144, kind: 'person' },
  editStatus: { label: 'Editor Status', w: 168, kind: 'pill' },
  editDue: { label: 'Edit Deadline', w: 124, kind: 'date' },
  designer: { label: 'Designer', w: 132, kind: 'person' },
  thumb: { label: 'Thumbnail', w: 168, kind: 'pill' },
  thumbDue: { label: 'Thumb Due', w: 116, kind: 'date' },
  sponsor: { label: 'Sponsor', w: 116, kind: 'text' },
  approval: { label: 'Sponsor Approval', w: 156, kind: 'pill' },
  status: { label: 'Status', w: 164, kind: 'pill' },
  pub: { label: 'Publishing Date', w: 140, kind: 'date' },
  clipping: { label: 'Clipping', w: 116, kind: 'dot' },
  newsletter: { label: 'Newsletter', w: 120, kind: 'dot' },
  community: { label: 'YT Community', w: 128, kind: 'dot' },
  distribute: { label: 'Distribute', w: 116, kind: 'dot' },
  link: { label: 'Link', w: 176, kind: 'link' }
};

const ROLE_META = {
  admin: { label: 'Super Admin', title: 'Full board', desc: 'Every field across production, edits, design, sponsors and distribution.',
    cols: Object.keys(COLS), card: { badges: ['status', 'editStatus', 'thumb'], dates: [['film', 'Film'], ['pub', 'Pub']], people: ['editor', 'designer'], bar: 'status' } },
  editor: { label: 'Editor', title: 'Edit queue', desc: 'Longform and shortform in one place, with the channel each edit is for. Status changes sync to the main board.',
    cols: ['project', 'job', 'channel', 'type', 'editor', 'editStatus', 'editDue', 'pub', 'link'], card: { badges: ['editStatus'], dates: [['editDue', 'Edit due'], ['pub', 'Pub']], people: ['editor'], bar: 'editStatus' } },
  sponsor: { label: 'Sponsor / Client', title: 'Account view', desc: 'View only. Project, status, publishing date and the draft or live link for the selected account.',
    cols: ['project', 'status', 'pub', 'link'], card: { badges: ['status'], dates: [['pub', 'Pub']], people: [], bar: 'status' } },
  designer: { label: 'Designer', title: 'Design queue', desc: 'Project details, thumbnail status and due dates.',
    cols: ['project', 'job', 'channel', 'type', 'designer', 'thumb', 'thumbDue', 'pub'], card: { badges: ['thumb'], dates: [['thumbDue', 'Thumb due'], ['pub', 'Pub']], people: ['designer'], bar: 'thumb' } }
};
export const DEF_VIEWS = { admin: ['table', 'kanban', 'list', 'timeline', 'calendar'], editor: ['table', 'kanban', 'list', 'timeline'], sponsor: ['table', 'calendar'], designer: ['table', 'kanban', 'calendar'] };

export function computeVals({ s, set, D, A, me, now }) {
  const settings = D.settings || {};
  const accent = settings.accent || '#16FFDE';
  const theme = s.theme || 'light';
  const dark = theme === 'dark';
  const density = s.density || 'Comfortable';
  const compact = density === 'Compact';
  const H = compact ? 40 : 52;
  const line = 'var(--line)';
  const colLine = 'var(--col-line)';
  const today = startOfDay(now);
  const cfgOf = (dbRole) => D.roleConfigs.find((r) => r.role === dbRole) || {};
  const dbFor = (id) => id === 'admin' ? 'super_admin' : id === 'sponsor' ? (me.uiRole === 'sponsor' ? me.dbRole : 'sponsor') : id;
  const ROLES = ['admin', 'editor', 'sponsor', 'designer'].map((id) => {
    const cf = cfgOf(dbFor(id));
    const M = ROLE_META[id];
    return { id: id, label: M.label, title: M.title, desc: M.desc, cols: (cf.columns && cf.columns.length ? cf.columns : M.cols).filter((k) => COLS[k]), card: Object.assign({}, M.card, cf.card || {}) };
  });
  const role = ROLES.find((x) => x.id === s.role) || ROLES[0];
  const allowedViews = (me.views && me.views.length ? me.views : (cfgOf(me.dbRole).views || DEF_VIEWS[s.role]));
  const curView = allowedViews.indexOf(s.view) >= 0 ? s.view : allowedViews[0] || 'table';
  const can = (res, act) => me.dbRole === 'super_admin' || me.perms.has(res + ':' + act);
  const acct = D.account;
  const acctName = acct ? acct.name : '';

  const TONE = {
    coral: ['var(--coral-soft)', 'var(--coral-ink)', '#F08A5D', '#C2532A'],
    pink: ['var(--pink-soft)', 'var(--pink-ink)', '#E0567F', '#B8335F'],
    violet: ['var(--violet-soft)', 'var(--violet-ink)', '#A66BD6', '#7A45C4'],
    blue: ['var(--blue-soft)', 'var(--blue-ink)', '#4C7CF0', '#2F5BD3'],
    green: ['var(--green-soft)', 'var(--green-ink)', '#3DB46D', '#22844C'],
    amber: ['var(--amber-soft)', 'var(--amber-ink)', '#E0A526', '#9A6A00'],
    red: ['var(--red-soft)', 'var(--red-ink)', '#E5484D', '#C42B2F'],
    gray: ['var(--chip)', 'var(--ink-3)', '#B0B0B0', '#6B6B6B']
  };
  const statusTone = {};
  D.statuses.forEach((x) => { statusTone[x.label] = TONE[x.color_token] ? x.color_token : 'gray'; });
  const PILL = {
    editStatus: { 'Assigned': 'amber', 'Editing': 'blue', 'Needs Revision': 'red', 'In Review': 'violet', 'Approved': 'green' },
    thumb: { 'Not Started': 'gray', 'In Design': 'amber', 'Needs Revision': 'red', 'In Review': 'violet', 'Done': 'green' },
    approval: { 'Pending': 'amber', 'Approved': 'green', 'Changes Requested': 'red' },
    status: statusTone
  };
  const DARKFILL = {
    coral: ['#FF8A5B', '#1A0A04'], pink: ['#F0457A', '#1A0510'], violet: ['#9B7BFF', '#120A2B'], blue: ['#5B8BFF', '#050B1F'],
    green: ['#3FCF73', '#04150A'], amber: ['#F5B83D', '#1A1000'], red: ['#F0524F', '#1A0504'], gray: ['#2C2D32', '#D4D4D8']
  };
  const TYPE_COLOR = { coral: ['#FF6A3D', '#1A0A04'], pink: ['#FF3F8E', '#1A0510'], violet: ['#9B7BFF', '#120A2B'] };
  const TYPEFILL = {};
  D.types.forEach((t) => { TYPEFILL[t.label] = TYPE_COLOR[t.color_token] || ['#6B6B6B', '#FFFFFF']; });
  const TYPETONE = {};
  D.types.forEach((t) => { TYPETONE[t.label] = t.color_token; });
  const softFor = (key, v) => { const t = TONE[key === 'type' ? TYPETONE[v] : (PILL[key] || {})[v]]; return t ? [t[0], t[1]] : null; };
  const fillFor = (key, v) => {
    if (key === 'type') return TYPEFILL[v] || null;
    const tn = (PILL[key] || {})[v];
    const t = TONE[tn];
    if (!t) return null;
    return dark ? DARKFILL[tn].slice() : [t[3], '#FFFFFF'];
  };
  const DOT = dark
    ? { 'Done': '#3FCF73', 'Drafted': '#5B8BFF', 'Ongoing': '#F5B83D', 'Not Yet': '#4A4C52' }
    : { 'Done': '#3DB46D', 'Drafted': '#4C7CF0', 'Ongoing': '#E0A526', 'Not Yet': '#C4C4C4' };
  const PEOPLE = {};
  D.directory.forEach((p) => { if (PEOPLE[p.name] === undefined) PEOPLE[p.name] = paletteColor(p.color_index, dark); });
  const nameToId = {};
  D.directory.forEach((p) => { if (!nameToId[p.name]) nameToId[p.name] = p.id; });
  const BASE = new Date(today.getFullYear(), today.getMonth(), 1);
  const parse = (t) => { const d = dateOfLabel(t, today); return d ? { m: d.getMonth(), d: d.getDate(), y: d.getFullYear(), date: d } : null; };
  const di = (t) => { const p = parse(t); if (!p) return null; return Math.round((startOfDay(p.date) - BASE) / 86400000); };
  const TODAY = Math.round((today - BASE) / 86400000);
  const linkFor = (r) => {
    if (r.linkUrl) return 'Open link';
    if (r.status === 'Live') return 'Watch on YouTube';
    if (r.editStatus === 'In Review' || r.editStatus === 'Needs Revision' || r.status === 'Sponsor Review' || r.status === 'Scheduled') return 'Review draft';
    return '';
  };
  const dueState = (k, r) => {
    const tracked = k === 'editDue' || k === 'thumbDue';
    if (!tracked) return 'normal';
    const done = (k === 'editDue' && r.editStatus === 'Approved') || (k === 'thumbDue' && r.thumb === 'Done');
    const n = di(r[k]);
    if (done || n === null) return 'normal';
    if (n < TODAY) return 'late';
    if (n === TODAY) return 'today';
    return 'normal';
  };
  const avatar = (name, size) => 'width: ' + size + 'px; height: ' + size + 'px; border-radius: 999px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #FFFFFF; background: ' + (PEOPLE[name] || '#5F5F5F') + ';';
  const actColor = (w) => w === 'You' ? '#2A2A2A' : (PEOPLE[w] || '#5F5F5F');
  const ROLE_TAG = { super_admin: 'Super Admin', editor: 'Editor', designer: 'Designer', sponsor: 'Client', client: 'Client' };
  const personOf = (id) => D.people[id] || null;

  // Comments: internal users read the table, sponsors and clients the portal RPC.
  const isSponsorRole = s.role === 'sponsor';
  const portal = (D.portalDetail || {});
  const cmtFor = (r) => {
    if (isSponsorRole) return ((portal[r.id] || {}).comments || []).map((c) => ({ who: c.author_id === me.id ? 'You' : ((c.author_role === 'sponsor' || c.author_role === 'client') ? (D.directory.find((p) => p.id === c.author_id) || {}).account || c.author_label : c.author_label), roleTag: ROLE_TAG[c.author_role] || 'Team', time: relTime(c.created_at, now), text: c.body, internal: false }));
    return (D.comments[r.id] || []).map((c) => ({ who: c.author_id === me.id ? 'You' : D.authorLabel(c.author_id), roleTag: ROLE_TAG[(personOf(c.author_id) || {}).role] || 'Team', time: relTime(c.created_at, now), text: c.text || c.body, internal: c.internal }));
  };
  const allRows = D.rows.filter((r) => !r.archived).map((r) => Object.assign({}, r, { updates: r.commentCount }));
  const catalogRows = D.rows.filter((r) => r.archived && r.status === 'Live');
  const jobRow = {};
  allRows.forEach((r) => { jobRow[r.job] = r; });
  const openRow = (job) => () => set({ openJob: job, dTab: 'overview', draft: '', dInternal: false, menu: '' });
  const openJob = s.openJob || '';
  const roleFilter = (r) => !isSponsorRole || r.sponsor === acctName || r.channel === acctName;

  const customCols = s.role === 'admin' ? D.customFields.filter((f) => f.on_board) : [];
  const roleCols = role.cols;
  const hk = (k) => s.role + ':' + k;
  const hidden = s.hidden || {};
  const visKeys = roleCols.filter((k) => k === 'project' || !hidden[hk(k)]);
  const vis = {};
  visKeys.forEach((k) => { vis[k] = true; });
  const has = (k) => roleCols.indexOf(k) >= 0;

  const anyOn = (m) => Object.keys(m || {}).some((k) => m[k]);
  const ftype = s.ftype || {}, fchannel = s.fchannel || {}, fstatus = s.fstatus || {};
  const useType = has('type') && anyOn(ftype);
  const useChannel = has('channel') && anyOn(fchannel);
  const useStatus = has('status') && anyOn(fstatus);
  const usePerson = !isSponsorRole && s.person !== 'All';
  const q = (s.q || '').trim().toLowerCase();
  const scoped = allRows.filter(roleFilter);
  const filtered = scoped.filter((r) =>
    (!q || r.title.toLowerCase().includes(q) || r.job.toLowerCase().includes(q)) &&
    (!usePerson || r.editor === s.person || r.designer === s.person) &&
    (!useType || ftype[r.type]) &&
    (!useChannel || fchannel[r.channel]) &&
    (!useStatus || fstatus[r.status]));

  const sortOpts = [
    { id: 'default', label: 'Board order', key: null },
    { id: 'pub', label: 'Publishing date', key: 'pub' },
    { id: 'film', label: 'Film date', key: 'film' },
    { id: 'editDue', label: 'Edit deadline', key: 'editDue' },
    { id: 'thumbDue', label: 'Thumbnail due', key: 'thumbDue' },
    { id: 'title', label: 'Title A to Z', key: 'project' }
  ].filter((o) => !o.key || has(o.key));
  const sortId = sortOpts.find((o) => o.id === s.sort) ? s.sort : 'default';
  const sorted = filtered.slice();
  if (sortId === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortId !== 'default') sorted.sort((a, b) => { const x = di(a[sortId]); const y = di(b[sortId]); return (x === null ? 9999 : x) - (y === null ? 9999 : y); });

  const isAdmin = s.role === 'admin';
  const cols = visKeys.map((k) => Object.assign({ key: k }, COLS[k]))
    .concat(customCols.map((cc) => ({ key: cc.id, label: cc.label, w: 168, kind: 'custom', ftype: cc.type })))
    .concat(isAdmin ? [{ key: '__add', label: '', w: 64, kind: 'add' }] : []);
  const gridCols = cols.map((c) => c.key === 'project' ? 'minmax(' + c.w + 'px, 1fr)' : c.w + 'px').join(' ');
  const tableMin = cols.reduce((a, c) => a + c.w, 0) + 20;
  const gridStyle = 'display: grid; grid-template-columns: ' + gridCols + ';';
  const base = 'height: ' + H + 'px; box-sizing: border-box; border-bottom: 1px solid ' + line + '; border-right: 1px solid ' + colLine + '; display: flex; align-items: center; min-width: 0; font-size: var(--text-body-sm);';
  const head = cols.map((c, i) => ({
    label: c.label,
    isAdd: c.kind === 'add',
    isLabel: c.kind !== 'add',
    onAdd: () => set({ modal: 'column', menu: '', newColName: '' }),
    style: 'height: 44px; box-sizing: border-box; border-bottom: 1px solid ' + line + '; border-right: 1px solid ' + colLine + '; display: flex; align-items: center; padding: 0 12px; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2); white-space: nowrap; background: var(--surface);' +
      (i === 0 ? ' justify-content: flex-start; padding-left: 20px; position: sticky; left: 0; z-index: 2; border-top-left-radius: 20px; box-shadow: 6px 0 10px -8px rgba(0,0,0,0.28);' : ' justify-content: center;') +
      (i === cols.length - 1 ? ' border-top-right-radius: 20px; border-right: 0;' : '')
  }));

  // Inline cell edit rights mirror the database rules (RLS, column guards, workflow settings).
  const CE = s.cellEdit || null;
  const CELL_EDIT = { editor: ['editStatus'].concat(settings.editors_change_status ? ['status'] : []), designer: ['thumb'], sponsor: [] };
  const canCell = (k, r) => {
    if (s.role === 'admin') return k !== 'project' && k !== 'job';
    if ((CELL_EDIT[s.role] || []).indexOf(k) < 0) return false;
    if (settings.lock_after_live && r && r.status === 'Live') return false;
    if (k === 'editStatus') return can('edits', 'edit') && (!r || r.editorId === me.id);
    if (k === 'thumb') return can('thumbs', 'edit') && (!r || r.designerId === me.id);
    return true;
  };
  const STG = {};
  D.statuses.forEach((x) => { STG[x.label] = { in_production: 'prod', post_production: 'post', publishing: 'pub' }[x.stage]; });
  const colLabel = (k) => k === 'linkUrl' || k === 'link' ? 'Link' : (COLS[k] || customCols.find((x) => x.id === k) || { label: k }).label;
  const setField = (r, k, val, extra) => {
    const txt = val ? 'set ' + colLabel(k) + ' to ' + val : 'cleared ' + colLabel(k);
    set({ cellEdit: null, ceText: '' });
    A.setField(r, k, val, Object.assign({ text: txt + ' on', stage: STG[val] }, extra || {}));
  };
  const LINKS = (r) => r.linkUrl || '';
  const cellFor = (c, r, last, colIdx) => {
    const v = c.key === 'link' ? linkFor(r) : c.key === 'project' ? r.title : (r[c.key] || '');
    const o = { text: v, isTitle: false, isText: false, isPill: false, isDate: false, isPerson: false, isDot: false, isLink: false, hasUpdates: false, updates: r.updates || 0 };
    if (c.kind === 'title') {
      o.isTitle = true;
      o.open = openRow(r.job);
      o.hasUpdates = (r.updates || 0) > 0;
      o.style = base + ' padding: 0 12px 0 20px; gap: 10px; position: sticky; left: 0; z-index: 1; background: inherit; box-shadow: 6px 0 10px -8px rgba(0,0,0,0.28);';
    } else if (c.kind === 'text' || c.kind === 'mono') {
      o.isText = !!v;
      o.style = base + ' padding: 0 12px;' + (c.kind === 'mono' ? ' justify-content: center;' : '');
      o.textStyle = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' + (c.kind === 'mono' ? ' font-variant-numeric: tabular-nums; letter-spacing: 0.02em; font-weight: 600; color: var(--ink-2b); font-size: 13px;' : ' color: var(--ink-3);');
    } else if (c.kind === 'pill') {
      const f = fillFor(c.key, v);
      o.isPill = true;
      o.text = f ? v : '';
      o.style = base + ' padding: 0; align-items: stretch;';
      const sf = softFor(c.key, v);
      o.pillStyle = c.key === 'status'
        ? 'flex: 1; display: flex; align-items: center; justify-content: center; padding: 0 10px; border-radius: 0; white-space: nowrap; overflow: hidden; font-size: 13px; font-weight: 600; color: ' + (f ? f[1] : '#FFFFFF') + '; background: ' + (f ? f[0] : 'var(--line-3)') + ';'
        : (f && sf ? 'margin: auto; display: inline-flex; align-items: center; height: 26px; max-width: calc(100% - 16px); padding: 0 10px; box-sizing: border-box; border-radius: 999px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 600; color: ' + sf[1] + '; background: ' + sf[0] + ';' : 'flex: 1;');
    } else if (c.kind === 'date') {
      o.isDate = !!v;
      o.style = base + ' justify-content: center; padding: 0 8px;';
      const st = dueState(c.key, r);
      const extra = st === 'late' ? ' background: var(--red-soft); color: var(--red-ink); font-weight: 600;' : st === 'today' ? ' background: var(--amber-soft); color: var(--amber-ink); font-weight: 600;' : ' color: var(--ink-2b);';
      o.chipStyle = 'padding: 5px 10px; border-radius: 999px; white-space: nowrap; font-size: 13px; font-variant-numeric: tabular-nums;' + extra;
    } else if (c.kind === 'person') {
      o.isPerson = !!v;
      o.style = base + ' padding: 0 12px;';
      o.initials = v ? v.slice(0, 1) : '';
      o.avatarStyle = avatar(v, 26);
    } else if (c.kind === 'dot') {
      o.isDot = !!v;
      o.style = base + ' padding: 0 12px; gap: 8px;';
      o.dotStyle = 'width: 8px; height: 8px; border-radius: 999px; flex: none; background: ' + (DOT[v] || '#C4C4C4') + ';';
    } else if (c.kind === 'link') {
      o.isLink = !!v;
      o.style = base + ' padding: 0 12px;';
      o.linkStyle = 'display: inline-flex; align-items: center; gap: 6px; color: var(--link); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap;';
    }
    if (c.kind !== 'title' && c.kind !== 'add') {
      const cn = canCell(c.key, r);
      const curV = c.key === 'link' ? (r.linkUrl || '') : (r[c.key] || '');
      o.isCellBtn = true;
      o.editing = !!(cn && CE && CE.job === r.job && CE.key === c.key);
      o.exp = cn ? (o.editing ? 'true' : 'false') : 'false';
      o.haspop = cn ? 'dialog' : 'false';
      const pd = parse(r[c.key]) || { m: today.getMonth(), y: today.getFullYear() };
      o.edit = cn ? () => set({ cellEdit: o.editing ? null : { job: r.job, key: c.key }, ceText: curV, ceMonth: pd.m, ceYear: pd.y, menu: '' })
        : (c.kind === 'link' && LINKS(r) ? () => window.open(LINKS(r), '_blank', 'noopener') : openRow(r.job));
      o.aria = (cn ? 'Edit ' : 'Open project to see ') + c.label + ' for ' + r.title + ', ' + (v || 'empty');
      o.plus = !v && cn;
      if (c.kind === 'custom') { o.isText = !!v; o.textStyle = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-3);'; o.style = base + ' padding: 0 12px;'; }
      o.btnStyle = 'position: relative; flex: 1 1 auto; align-self: stretch; display: flex; align-items: ' + (c.kind === 'pill' ? 'stretch' : 'center') + '; justify-content: inherit; gap: inherit; min-width: 0; padding: 0; margin: 0; border: 0; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; text-align: inherit; cursor: pointer;' + (o.editing ? ' outline: 2px solid var(--ink); outline-offset: -2px;' : '');
      const isDateCol = c.kind === 'date';
      o.popStyle = 'position: absolute; z-index: 1; top: calc(100% + 6px); ' + (colIdx >= cols.length - 5 ? 'right: 0;' : 'left: 0;') + ' width: ' + (isDateCol ? 296 : 272) + 'px; max-height: 380px; overflow-y: auto; box-sizing: border-box; padding: 8px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.18); text-align: left; font-size: 14px; font-weight: 500; color: var(--ink); cursor: default; white-space: normal;';
      o.style = (o.style || base) + ' position: relative;' + (o.editing ? ' z-index: 30;' : '');
    }
    if (!o.style) o.style = base;
    if (last) o.style += ' border-right: 0;';
    return o;
  };

  const C = role.card;
  const typeBlock = (v) => { const f = TYPEFILL[v]; return 'display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 0; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + (f ? f[0] : 'var(--line-3)') + '; color: ' + (f ? f[1] : 'var(--ink-2)') + ';'; };
  const dateChip = (k, r) => {
    const st = dueState(k, r);
    const tone = st === 'late' ? 'background: var(--red-soft); color: var(--red-ink);' : st === 'today' ? 'background: var(--amber-soft); color: var(--amber-ink);' : 'background: var(--hover); color: var(--ink-2b);';
    return 'display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; ' + tone;
  };
  const BADGE_LBL = { status: 'Status', editStatus: 'Edit', thumb: 'Thumb', approval: 'Sponsor' };
  const cardFor = (r) => {
    const showType = !!vis.type && !!TYPEFILL[r.type];
    const badges = C.badges.filter((k) => vis[k] && r[k]).map((k) => {
      const f = k === 'status' ? fillFor(k, r[k]) : (softFor(k, r[k]) || fillFor(k, r[k]));
      return { text: (BADGE_LBL[k] ? BADGE_LBL[k] + ': ' : '') + r[k], style: 'display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 0; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + (f ? f[0] : 'var(--line-3)') + '; color: ' + (f ? f[1] : 'var(--ink-2)') + ';' };
    });
    const dates = C.dates.filter((p) => vis[p[0]] && r[p[0]]).map((p) => ({ label: p[1], text: r[p[0]], style: dateChip(p[0], r) }));
    const people = C.people.filter((k) => vis[k] && r[k]).map((k) => ({ initials: r[k].slice(0, 1), style: avatar(r[k], 28) }));
    const peopleNames = C.people.filter((k) => vis[k] && r[k]).map((k) => COLS[k].label + ': ' + r[k]).join(', ');
    const lt = vis.link ? linkFor(r) : '';
    const barFill = showType ? TYPEFILL[r.type][0] : ((fillFor(C.bar, r[C.bar]) || ['#B0B0B0'])[0]);
    const sel = r.job === openJob;
    return {
      open: openRow(r.job),
      cardStyle: 'position: relative; background: var(--surface); border: 1px solid ' + (sel ? 'var(--ink)' : 'var(--line-4)') + '; border-radius: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); padding: 14px; display: flex; flex-direction: column; gap: 10px;',
      rowCls: 'row fb-lrow' + (sel ? ' row-on' : ''),
      title: r.title, updates: r.updates || 0, hasUpdates: (r.updates || 0) > 0,
      hasType: showType, typeText: r.type, typeStyle: typeBlock(r.type),
      badges: badges, hasBadges: badges.length > 0, dates: dates, people: people, peopleText: peopleNames,
      hasLink: !!lt, linkText: lt, href: r.linkUrl || undefined,
      linkStyle: 'display: inline-flex; align-items: center; gap: 6px; color: var(--link); font-size: 13px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap;',
      barStyle: 'width: 4px; height: 28px; flex: none; background: ' + barFill + ';'
    };
  };

  const STAGES = [
    { id: 'prod', title: 'In Production', color: '#F08A5D' },
    { id: 'post', title: 'Post Production', color: '#E0567F' },
    { id: 'pub', title: 'Publishing', color: '#A66BD6' }
  ];
  const editorNames = D.directory.filter((p) => p.role === 'editor' && p.status === 'active').map((p) => p.name);
  const designerNames = D.directory.filter((p) => p.role === 'designer' && p.status === 'active').map((p) => p.name);
  const gbOpts = [
    { id: 'stage', label: 'Stage', field: null },
    { id: 'type', label: 'Content Type', field: 'type' },
    { id: 'status', label: 'Status', field: 'status' },
    { id: 'channel', label: 'Channel', field: 'channel' },
    { id: 'editor', label: 'Editor', field: 'editor' }
  ].filter((o) => !o.field || has(o.field));
  const gb = gbOpts.find((o) => o.id === s.groupBy) ? s.groupBy : 'stage';
  let defs;
  if (gb === 'stage') defs = STAGES;
  else if (gb === 'type') defs = Object.keys(TYPEFILL).map((k) => ({ id: k, title: k, color: TYPEFILL[k][0] }));
  else if (gb === 'status') defs = D.statuses.map((x) => ({ id: x.label, title: x.label, color: TONE[statusTone[x.label]][2] }));
  else if (gb === 'channel') defs = D.channels.map((x, i) => ({ id: x.name, title: x.name, color: x.color || ['#F08A5D', '#E0567F', '#A66BD6'][i % 3] }));
  else defs = editorNames.map((n) => ({ id: n, title: n, color: PEOPLE[n] || '#5F5F5F' })).concat([{ id: 'Unassigned', title: 'Unassigned', color: '#B0B0B0' }]);
  const keyOf = (r) => gb === 'stage' ? r.g : gb === 'type' ? r.type : gb === 'status' ? r.status : gb === 'channel' ? r.channel : (r.editor || 'Unassigned');

  const DAYS = 61, DW = 24, LW = 300;
  const canEdit = s.role === 'admin';
  const scopeName = isSponsorRole ? acctName : s.role === 'editor' ? 'your edits' : s.role === 'designer' ? 'your designs' : 'this view';
  const filtersOn = !!q || usePerson || useType || useChannel || useStatus;
  const todayLine = 'position: absolute; top: 0; bottom: 0; left: ' + (TODAY * DW + DW / 2 - 1) + 'px; width: 2px; background: #E0567F; opacity: 0.85;';
  const laneStyle = 'position: relative; height: 44px; border-bottom: 1px solid var(--line); background-image: repeating-linear-gradient(to right, transparent 0, transparent ' + (7 * DW - 1) + 'px, var(--line) ' + (7 * DW - 1) + 'px, var(--line) ' + (7 * DW) + 'px);';

  const tlItem = (r) => {
    const end = di(r.pub);
    const start = di(r.film);
    const o = { title: r.title, open: openRow(r.job), laneStyle: laneStyle, todayStyle: todayLine, isBar: false, isMile: false };
    if (end === null) return o;
    if (isSponsorRole || start === null) {
      const x = Math.max(0, Math.min(DAYS - 1, end));
      const f = fillFor('status', r.status) || ['#6B6B6B'];
      o.isMile = true;
      o.mileStyle = 'position: absolute; top: 15px; left: ' + (x * DW + DW / 2 - 7) + 'px; width: 14px; height: 14px; transform: rotate(45deg); background: ' + f[0] + ';';
      o.mileLabelStyle = 'position: absolute; top: 12px; left: ' + (x * DW + DW / 2 + 14) + 'px; font-size: 12px; font-weight: 600; color: var(--ink-2); white-space: nowrap;';
      o.mileText = 'Pub ' + r.pub + '  ·  ' + r.status;
      return o;
    }
    const a = Math.max(0, Math.min(start, end));
    const b = Math.min(DAYS - 1, Math.max(start, end));
    const tf = vis.type ? TYPEFILL[r.type] : null;
    const f = tf || fillFor(C.bar, r[C.bar]) || ['#6B6B6B', '#FFFFFF'];
    o.isBar = true;
    o.barText = r[C.bar] || r.status;
    o.barStyle = 'position: absolute; top: 8px; height: 28px; left: ' + (a * DW) + 'px; width: ' + (Math.max(1, b - a + 1) * DW) + 'px; box-sizing: border-box; padding: 0 8px; border-radius: 0; background: ' + f[0] + '; color: ' + f[1] + '; font-size: 12px; font-weight: 600; line-height: 28px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    return o;
  };

  const closed = s.closed || {};
  const firstStatusOf = (gid) => {
    if (gb === 'stage') { const x = D.statuses.find((y) => STG[y.label] === gid); return x ? x.label : ''; }
    if (gb === 'status') return gid;
    return '';
  };
  const openNew = (preset) => () => set(Object.assign({ npOpen: true, npErr: '', npTitle: '', npJob: '', npFilm: '', npPub: '', npStatus: '', npType: '', npChannel: '', npSponsor: '', npTemplate: '', menu: '' }, preset || {}));
  let groups = defs.map((G) => {
    const rs = sorted.filter((r) => keyOf(r) === G.id);
    const ck = gb + ':' + G.id;
    const open = closed[ck] === undefined ? !(s.role === 'editor' && gb === 'stage' && G.id === 'pub') : !closed[ck];
    const preset = {};
    if (firstStatusOf(G.id)) preset.npStatus = firstStatusOf(G.id);
    if (gb === 'type') preset.npType = G.id;
    if (gb === 'channel') preset.npChannel = G.id;
    return {
      id: G.id, title: G.title, count: rs.length,
      countText: String(rs.length),
      open: open, expanded: open ? 'true' : 'false',
      toggleLabel: (open ? 'Collapse ' : 'Expand ') + G.title,
      addLabel: 'Add project to ' + G.title,
      add: openNew(preset),
      toggle: () => set({ closed: Object.assign({}, closed, { [ck]: open }) }),
      chevStyle: 'transition: transform 160ms ease; transform: rotate(' + (open ? '0' : '-90') + 'deg);',
      dotStyle: 'width: 10px; height: 10px; border-radius: 999px; flex: none; background: ' + G.color + '; box-shadow: 0 0 0 4px ' + G.color + '26;',
      closedK: !open, showLabel: 'Show ' + rs.length + (rs.length === 1 ? ' project' : ' projects'),
      kanStyle: 'flex: ' + (open ? '1 1 320px' : '0 0 260px') + '; min-width: ' + (open ? '300px' : '260px') + '; max-width: 520px; box-sizing: border-box; background: var(--panel); border: 1px solid var(--line-2); border-top: 3px solid ' + G.color + '; border-radius: 24px; padding: 10px; display: flex; flex-direction: column; gap: 10px;',
      gridStyle: gridStyle, head: head,
      rows: rs.map((r) => ({ cls: r.job === openJob ? 'row row-on' : 'row', gridStyle: gridStyle, cells: cols.map((c, i) => cellFor(c, r, i === cols.length - 1, i)) })),
      cards: rs.map(cardFor),
      items: rs.map(tlItem),
      isEmpty: rs.length === 0,
      emptyText: filtersOn ? 'No projects match the current filters in this group.' : 'Nothing in this stage for ' + scopeName + '.',
      canEdit: canEdit
    };
  });
  if (gb !== 'stage') groups = groups.filter((g) => g.count > 0);

  const GRAD = dark ? 'linear-gradient(90deg, #FF8A5B 0%, #F0457A 55%, #B08CFF 100%)' : 'linear-gradient(90deg, #F4A26B 0%, #E35D85 55%, #A274DB 100%)';
  const stageCounts = STAGES.map((G) => sorted.filter((r) => r.g === G.id).length);
  const totalVisible = Math.max(1, sorted.length);
  let acc = 0;
  const pipeline = STAGES.map((G, i) => {
    const n = stageCounts[i];
    const startPct = (acc / totalVisible) * 100;
    acc += n;
    const span = n / totalVisible;
    return {
      label: G.title, count: n,
      barStyle: 'flex: ' + (n || 0.0001) + ' 1 0; min-width: ' + (n ? '12px' : '0') + '; height: 10px; border-radius: 999px; background-image: ' + GRAD + '; background-size: ' + (span > 0 ? (100 / span) : 100) + '% 100%; background-position: ' + (span < 1 ? (startPct / (100 - span * 100)) * 100 : 0) + '% 0;' + (n ? '' : ' display: none;'),
      dotStyle: 'width: 8px; height: 8px; border-radius: 999px; flex: none; background: ' + G.color + ';'
    };
  });

  const VIEWS = ['table', 'kanban', 'list', 'timeline', 'calendar'];
  const vbtn = {}, vpick = {}, vp = {}, vshow = {};
  VIEWS.forEach((v) => {
    const on = curView === v;
    vp[v] = on ? 'true' : 'false';
    vshow[v] = allowedViews.indexOf(v) >= 0;
    vpick[v] = () => set({ view: v, menu: '' });
    vbtn[v] = 'min-height: 44px; padding: 0 14px; border: 0; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap;' +
      (on ? ' background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06);' : ' background: transparent; color: var(--muted);');
  });

  const MENUS = ['person', 'filter', 'sort', 'cols', 'group', 'activity', 'more'];
  const menus = {}, ex = {}, open = {};
  MENUS.forEach((m) => {
    menus[m] = s.menu === m;
    ex[m] = s.menu === m ? 'true' : 'false';
    open[m] = () => set({ menu: s.menu === m ? '' : m });
  });
  const itemStyle = (on) => 'min-height: 44px; width: 100%; box-sizing: border-box; padding: 0 10px; border: 0; border-radius: 10px; display: flex; align-items: center; gap: 10px; text-align: left; cursor: pointer; color: var(--ink); font-size: 14px; font-weight: 500; background: ' + (on ? 'var(--hover)' : 'transparent') + ';';
  const checkStyle = (on) => 'width: 16px; height: 16px; flex: none; display: inline-flex; color: var(--ink); opacity: ' + (on ? '1' : '0') + ';';
  const item = (label, on, pick, meta, swatch) => ({ label: label, on: !!on, pressed: on ? 'true' : 'false', pick: pick, style: itemStyle(on), checkStyle: checkStyle(on), meta: meta === undefined ? '' : meta, swatch: swatch || 'display: none;', cbStyle: 'width: 18px; height: 18px; margin: 0; flex: none; accent-color: var(--ink); cursor: pointer;' });
  const swatch = (c) => 'width: 12px; height: 12px; flex: none; border-radius: 0; background: ' + c + ';';
  const toggleIn = (field, key) => () => set({ [field]: Object.assign({}, s[field] || {}, { [key]: !(s[field] || {})[key] }) });

  const added = s.added || {};
  const addedPeople = Object.keys(added).filter((k) => added[k]);
  const rolePeople = (s.role === 'editor' ? editorNames : s.role === 'designer' ? designerNames : editorNames.concat(designerNames)).concat(addedPeople.filter((p) => editorNames.concat(designerNames).indexOf(p) < 0));
  const personItems = [item('Everyone', s.person === 'All', () => set({ person: 'All', menu: '' }), scoped.length)]
    .concat(rolePeople.map((p) => item(p, s.person === p, () => set({ person: p, menu: '' }), scoped.filter((r) => r.editor === p || r.designer === p).length)));
  const typeItems = Object.keys(TYPEFILL).map((t) => item(t, !!ftype[t], toggleIn('ftype', t), scoped.filter((r) => r.type === t).length, swatch(TYPEFILL[t][0])));
  const channelItems = D.channels.map((x) => x.name).map((t) => item(t, !!fchannel[t], toggleIn('fchannel', t), scoped.filter((r) => r.channel === t).length));
  const statusItems = D.statuses.map((x) => x.label).map((t) => item(t, !!fstatus[t], toggleIn('fstatus', t), scoped.filter((r) => r.status === t).length, swatch(TONE[statusTone[t]][3])));
  const filterCount = (has('type') ? Object.keys(ftype).filter((k) => ftype[k]).length : 0) + (has('channel') ? Object.keys(fchannel).filter((k) => fchannel[k]).length : 0) + (has('status') ? Object.keys(fstatus).filter((k) => fstatus[k]).length : 0);
  const sortItems = sortOpts.map((o) => item(o.label, sortId === o.id, () => set({ sort: o.id, menu: '' })));
  const colItems = roleCols.filter((k) => k !== 'project').map((k) => item(COLS[k].label, !hidden[hk(k)], () => set({ hidden: Object.assign({}, hidden, { [hk(k)]: !hidden[hk(k)] }) })));
  const PRESETS = [['All fields', null], ['Production', ['job', 'channel', 'type', 'film', 'status']], ['Post', ['job', 'editor', 'editStatus', 'editDue', 'designer', 'thumb', 'thumbDue', 'status']], ['Publishing', ['type', 'pub', 'approval', 'status', 'clipping', 'newsletter', 'community', 'distribute', 'link']], ['Sponsor', ['channel', 'sponsor', 'approval', 'status', 'pub', 'link']]];
  const presetKeys = roleCols.filter((k) => k !== 'project');
  const colPresets = s.role !== 'admin' ? [] : PRESETS.map((p) => {
    const keep = p[1];
    const on = presetKeys.every((k) => (keep ? keep.indexOf(k) >= 0 : true) === !hidden[hk(k)]);
    return {
      label: p[0], pressed: on ? 'true' : 'false',
      pick: () => { const h = Object.assign({}, hidden); presetKeys.forEach((k) => { if (!keep || keep.indexOf(k) >= 0) delete h[hk(k)]; else h[hk(k)] = true; }); set({ hidden: h }); },
      style: 'min-height: 36px; padding: 0 12px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; ' + (on ? 'background: var(--inv); color: var(--inv-ink); border: 1px solid var(--inv);' : 'background: var(--surface); color: var(--ink-2); border: 1px solid var(--border);')
    };
  });
  const hiddenCount = roleCols.filter((k) => k !== 'project' && hidden[hk(k)]).length;
  const groupItems = gbOpts.map((o) => item(o.label, gb === o.id, () => set({ groupBy: o.id, menu: '' })));
  const densityItems = ['Comfortable', 'Compact'].map((d) => item(d + ' rows', density === d, () => { set({ density: d, menu: '' }); A.savePrefs({ density: d }); }));

  // Board activity menu: recent changes on the projects in view.
  const scopedId = {};
  scoped.forEach((r) => { scopedId[r.id] = true; });
  const rowById = {};
  allRows.forEach((r) => { rowById[r.id] = r; });
  const FRESH = 90 * 60000;
  const projActs = D.activity.filter((l) => l.project_id && (l.category === 'project' || l.category === 'approval'));
  const ACT = projActs.filter((l) => scopedId[l.project_id]).slice(0, 7).map((l) => ({
    who: l.actor_id === me.id ? 'You' : (l.actor_label || 'Automation'), action: l.action, target: l.target_label || (rowById[l.project_id] || {}).title || '',
    time: relTime(l.created_at, now), fresh: now - new Date(l.created_at) < FRESH, projectId: l.project_id
  }));
  const activityItems = ACT.map((a) => ({
    who: a.who, action: a.action, target: a.target, time: a.time,
    open: openRow((rowById[a.projectId] || {}).job || ''),
    initials: a.who.slice(0, 1),
    avatarStyle: 'width: 28px; height: 28px; border-radius: 999px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #FFFFFF; background: ' + (a.who === 'Automation' ? '#3A3B40' : actColor(a.who)) + ';',
    dotStyle: 'width: 8px; height: 8px; margin-top: 6px; border-radius: 999px; flex: none; background: ' + (a.fresh ? '#E0567F' : 'transparent') + ';'
  }));
  const freshCount = ACT.filter((a) => a.fresh).length;

  // "Add person to view": everyone else on the team.
  const DIRECTORY = D.directory.filter((p) => p.id !== me.id && p.status === 'active' && rolePeople.indexOf(p.name) < 0 || added[p.name])
    .filter((p) => p.id !== me.id).map((p) => ({ name: p.name, role: ROLE_TAG[p.role] === 'Client' ? (p.role === 'client' ? 'Client' : 'Sponsor') : ROLE_TAG[p.role] }));
  const mq = (s.mq || '').trim().toLowerCase();
  const dirMatches = DIRECTORY.filter((u) => !mq || u.name.toLowerCase().includes(mq) || u.role.toLowerCase().includes(mq));
  const dirList = dirMatches.map((u, i) => {
    const on = !!added[u.name];
    return {
      name: u.name, role: u.role,
      initials: u.name.split(' ').map((x) => x.slice(0, 1)).join(''),
      avatarStyle: 'width: 36px; height: 36px; border-radius: 999px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #FFFFFF; background: ' + (PEOPLE[u.name] || '#5F5F5F') + ';',
      rowStyle: 'display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 14px;' + (i ? ' border-top: 1px solid var(--line);' : ''),
      pressed: on ? 'true' : 'false',
      aria: (on ? 'Remove ' : 'Add ') + u.name,
      btnLabel: on ? 'Added' : 'Add',
      toggle: () => set({ added: Object.assign({}, added, { [u.name]: !on }) }),
      btnStyle: 'min-height: 40px; min-width: 76px; padding: 0 14px; border-radius: 12px; cursor: pointer; ' + (on ? 'background: var(--inv); color: var(--inv-ink); border: 1px solid var(--ink);' : 'background: var(--surface); color: var(--ink); border: 1px solid var(--border);')
    };
  });

  const CTYPES = [
    ['Text', 'M3 4.5h10M3 8h10M3 11.5h6', 'b'],
    ['Number', 'M6 2.5l-1.5 11M11.5 2.5L10 13.5M2.5 6h11M2 10h11', 'b'],
    ['Select', 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM5.5 7l2.5 2.5L10.5 7', 'b'],
    ['Multi select', 'M6 4.5h7.5M6 8h7.5M6 11.5h7.5M2.75 4.5h.01M2.75 8h.01M2.75 11.5h.01', 'b'],
    ['Status', 'M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M3.8 12.2l1.4-1.4M10.8 5.2l1.4-1.4', 'b'],
    ['Date', 'M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3', 'b'],
    ['Person', 'M8 3.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5zM3.5 13.5c.8-2.3 2.5-3.5 4.5-3.5s3.7 1.2 4.5 3.5', 'b'],
    ['Files & media', 'M13 7.5l-5.25 5.25a3 3 0 0 1-4.25-4.25L9 3a2 2 0 0 1 2.83 2.83L6.5 11.17a1 1 0 0 1-1.42-1.42L10 4.83', 'b'],
    ['Checkbox', 'M2.5 2.5h11v11h-11zM5 8l2 2 4-4', 'b'],
    ['URL', 'M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.75.75M9 7a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5l.75-.75', 'b'],
    ['Email', 'M2.5 4h11v8h-11zM2.5 4.5L8 9l5.5-4.5', 'b'],
    ['Phone', 'M4 2.5h2l1 3-1.5 1a7 7 0 0 0 4 4l1-1.5 3 1v2a1.5 1.5 0 0 1-1.5 1.5A10 10 0 0 1 2.5 4 1.5 1.5 0 0 1 4 2.5z', 'b'],
    ['Relation', 'M5 11l6-6M6 5h5v5', 'a'],
    ['Formula', 'M12 3H4l4.5 5L4 13h8', 'a'],
    ['Created time', 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM8 5v3l2 1.5', 'a'],
    ['Last edited by', 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM8 5.5a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 1 0 0-3.5zM5 12c.6-1.3 1.7-2 3-2s2.4.7 3 2', 'a']
  ];
  const ctItem = (t) => ({
    label: t[0], icon: t[1],
    pick: () => { const label = (s.newColName || '').trim() || t[0]; set({ modal: '', newColName: '' }); A.addField({ label: label, type: t[0], onBoard: true }); }
  });
  const colTypesBasic = CTYPES.filter((t) => t[2] === 'b').map(ctItem);
  const colTypesAdv = CTYPES.filter((t) => t[2] === 'a').map(ctItem);
  const allGroupKeys = {};
  groups.forEach((g) => { allGroupKeys[gb + ':' + g.id] = true; });

  const toolStyle = (on) => 'min-height: 40px; padding: 0 12px; border: 0; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap; font-size: 14px; ' + (on ? 'font-weight: 600; color: var(--ink); background: var(--chip-2);' : 'font-weight: 500; color: var(--ink-4); background: transparent;');
  const tool = {
    person: toolStyle(s.menu === 'person' || usePerson),
    filter: toolStyle(s.menu === 'filter' || filterCount > 0),
    sort: toolStyle(s.menu === 'sort' || sortId !== 'default'),
    cols: toolStyle(s.menu === 'cols' || hiddenCount > 0),
    group: toolStyle(s.menu === 'group'),
    todos: toolStyle(s.todos),
    activity: toolStyle(s.menu === 'activity'),
    moreBtn: toolStyle(s.menu === 'more') + ' width: 40px; padding: 0; justify-content: center;'
  };
  const popBase = 'position: absolute; top: calc(100% + 8px); z-index: 30; width: 264px; max-width: calc(100vw - 48px); max-height: 440px; overflow-y: auto; box-sizing: border-box; background: var(--surface); border: 1px solid var(--line-4); border-radius: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.12); padding: 8px; display: flex; flex-direction: column; gap: 2px;';

  const PR_L = { high: 'High', med: 'Med', low: 'Low' };
  const tasksDef = D.tasks.map((t) => ({ id: t.id, text: t.text, pr: PR_L[t.priority] || 'Med', done: !!t.done_at, raw: t }));
  const pending = tasksDef.filter((t) => !t.done).length;
  const PR = { High: ['var(--red-soft)', 'var(--red-ink)'], Med: ['var(--blue-soft)', 'var(--blue-ink)'], Low: ['var(--chip)', 'var(--ink-3)'] };
  const tasks = tasksDef.map((t) => {
    const d = t.done;
    return {
      text: t.text, pr: t.pr, pressed: d ? 'true' : 'false', aria: (d ? 'Mark not done: ' : 'Mark done: ') + t.text,
      toggle: () => A.toggleTask(t.raw),
      boxStyle: 'width: 22px; height: 22px; box-sizing: border-box; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; color: var(--inv-ink); ' + (d ? 'background: var(--inv); border: 0;' : 'background: var(--surface); border: 1.5px solid var(--border-strong);'),
      checkStyle: 'opacity: ' + (d ? '1' : '0') + ';',
      textStyle: 'flex: 1; min-width: 0; font-size: var(--text-body-sm); ' + (d ? 'color: var(--faint); text-decoration: line-through;' : 'color: var(--ink);'),
      prStyle: 'display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 0; font-size: 12px; font-weight: 600; background: ' + PR[t.pr][0] + '; color: ' + PR[t.pr][1] + ';'
    };
  });

  const ticks = [];
  const nextM = new Date(BASE.getFullYear(), BASE.getMonth() + 1, 1);
  const firstLen = Math.round((nextM - BASE) / 86400000);
  [[0, MONTH_NAMES[BASE.getMonth()]], [firstLen, MONTH_NAMES[nextM.getMonth()]]].forEach((p) => ticks.push({ label: p[1], style: 'position: absolute; top: 8px; left: ' + (p[0] * DW + 8) + 'px; font-size: 12px; font-weight: 700; color: var(--ink); white-space: nowrap;' }));
  for (let i = 0; i < DAYS; i++) {
    const dt = new Date(BASE.getFullYear(), BASE.getMonth(), 1 + i);
    const wk = dt.getDay() === 0 || dt.getDay() === 6;
    const isT = i === TODAY;
    ticks.push({ label: String(dt.getDate()), style: 'position: absolute; top: 30px; left: ' + (i * DW) + 'px; width: ' + DW + 'px; height: 20px; line-height: 20px; text-align: center; font-size: 11px; font-variant-numeric: tabular-nums; border-radius: 999px; ' + (isT ? 'background: #E0567F; color: #FFFFFF; font-weight: 700;' : (wk ? 'color: var(--faint);' : 'color: var(--ink-4);')) });
  }
  const tlEnd = new Date(BASE.getFullYear(), BASE.getMonth(), DAYS);
  const tl = {
    wrapStyle: 'min-width: ' + (LW + DAYS * DW) + 'px;',
    rowGrid: 'display: grid; grid-template-columns: ' + LW + 'px ' + (DAYS * DW) + 'px;',
    groupRow: 'background: var(--surface-2); border-bottom: 1px solid var(--line);',
    ticks: ticks,
    groups: groups.filter((g) => g.count > 0)
  };
  const tlTitle = MONTH_NAMES[BASE.getMonth()] + ' to ' + MONTH_NAMES[nextM.getMonth()] + ' ' + tlEnd.getFullYear();
  const tlNote = isSponsorRole ? 'Diamonds mark publishing dates.' : 'Bars run from film date to publishing date.';

  const calY = s.calYear == null ? today.getFullYear() : s.calYear;
  const calM = s.calMonth == null ? today.getMonth() : s.calMonth;
  const startDow = new Date(calY, calM, 1).getDay();
  const dim = new Date(calY, calM + 1, 0).getDate();
  const EV = ({
    admin: [['film', 'Film'], ['pub', 'Pub']],
    editor: [['editDue', 'Edit due'], ['pub', 'Pub']],
    designer: [['thumbDue', 'Thumb due'], ['pub', 'Pub']],
    sponsor: [['pub', 'Pub']]
  }[s.role] || [['pub', 'Pub']]).filter((p) => vis[p[0]] || p[0] === 'pub');
  const events = {};
  sorted.forEach((r) => {
    EV.forEach((p) => {
      const pr = parse(r[p[0]]);
      if (!pr || pr.m !== calM || pr.y !== calY) return;
      const isPub = p[0] === 'pub';
      let st;
      if (isPub) {
        const f = (vis.type ? TYPEFILL[r.type] : null) || fillFor('status', r.status) || ['#6B6B6B', '#FFFFFF'];
        st = 'background: ' + f[0] + '; color: ' + f[1] + ';';
      } else {
        const ds = dueState(p[0], r);
        st = ds === 'late' ? 'background: var(--red-soft); color: var(--red-ink);' : ds === 'today' ? 'background: var(--amber-soft); color: var(--amber-ink);' : 'background: var(--chip); color: var(--ink-2);';
      }
      (events[pr.d] = events[pr.d] || []).push({ label: p[1] + ': ' + r.title, open: openRow(r.job), style: 'display: block; width: 100%; min-height: 24px; box-sizing: border-box; border: 0; text-align: left; cursor: pointer; font-family: inherit; letter-spacing: normal; font-size: 11.5px; font-weight: 600; line-height: 1.3; padding: 4px 6px; border-radius: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ' + st + (r.job === openJob ? ' outline: 2px solid var(--ink); outline-offset: -2px;' : '') });
    });
  });
  const days = [];
  for (let i = 0; i < 42; i++) {
    const n = i - startDow + 1;
    const inM = n >= 1 && n <= dim;
    const dt = new Date(calY, calM, n);
    const isToday = calY === today.getFullYear() && calM === today.getMonth() && n === today.getDate();
    const evs = inM ? (events[n] || []) : [];
    days.push({
      num: String(dt.getDate()),
      events: evs.slice(0, 3),
      hasMore: evs.length > 3,
      moreText: '+' + (evs.length - 3) + ' more',
      style: 'min-height: 120px; box-sizing: border-box; padding: 8px; display: flex; flex-direction: column; gap: 4px; min-width: 0; border-bottom: 1px solid var(--col-line);' + ((i % 7) === 6 ? '' : ' border-right: 1px solid var(--col-line);') + (inM ? ' background: var(--surface);' : ' background: var(--surface-2);'),
      numStyle: 'align-self: flex-start; min-width: 26px; height: 26px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; ' + (isToday ? 'background: var(--inv); color: var(--inv-ink);' : (inM ? 'color: var(--ink-2);' : 'color: var(--faint);'))
    });
  }
  const legend = [{ label: 'Pub: publishing date', style: 'width: 12px; height: 12px; background: ' + (vis.type ? '#FF6A3D' : '#22844C') + ';' }];
  if (EV.length > 1) legend.push({ label: EV[0][1] + ': ' + COLS[EV[0][0]].label.toLowerCase(), style: 'width: 12px; height: 12px; background: var(--chip); border: 1px solid var(--border-3); box-sizing: border-box;' });
  const cal = {
    label: MONTH_NAMES[calM] + ' ' + calY,
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    days: days,
    legend: legend
  };
  const shiftMonth = (y, m, d) => { const x = new Date(y, m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; };

  const sortLabelMap = {};
  sortOpts.forEach((o) => { sortLabelMap[o.id] = o.label; });

  const hexRgb = (h) => { let x = String(h || '').replace('#', ''); if (x.length === 3) x = x.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(x.substr(i, 2), 16) || 0); };
  const lin = (v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const mix = (rgb, t, k) => '#' + rgb.map((v, i) => Math.round(v + (t[i] - v) * k).toString(16).padStart(2, '0')).join('');
  const aRgb = hexRgb(accent);
  const aLum = 0.2126 * lin(aRgb[0]) + 0.7152 * lin(aRgb[1]) + 0.0722 * lin(aRgb[2]);
  const bright = aLum > 0.18;
  const TK = dark ? {
    page: '#000000', surface: '#141518', 'surface-2': '#18191C', panel: '#0E0F11', hover: '#1E1F23', chip: '#1E1F23', 'chip-2': '#232428', track: '#0E0F11',
    line: '#1F2023', 'line-2': '#1F2023', 'line-3': '#26272B', 'line-4': '#2A2B30', 'col-line': '#232428',
    border: '#2A2B30', 'border-2': '#2A2B30', 'border-3': '#3A3B40', 'border-strong': '#4A4C52',
    ink: '#F4F4F5', 'ink-2': '#E4E4E7', 'ink-2b': '#D4D4D8', 'ink-3': '#B4B7BD', 'ink-4': '#A8ABB1', muted: '#9A9DA3', 'muted-2': '#8E9197', faint: '#6E7177',
    inv: bright ? accent : '#F4F4F5', 'inv-ink': bright ? mix(aRgb, [0, 0, 0], 0.86) : '#111214', 'inv-faint': bright ? mix(aRgb, [0, 0, 0], 0.62) : '#4A4C52',
    link: bright ? accent : '#5EEAD4', 'link-hover': '#99F6E4',
    'red-soft': 'rgba(240,82,79,0.16)', 'red-ink': '#FF8F8C', 'amber-soft': 'rgba(245,184,61,0.16)', 'amber-ink': '#F7CC6E',
    'green-soft': 'rgba(63,207,115,0.15)', 'green-ink': '#6EE59A', 'pink-soft': 'rgba(240,69,122,0.15)', 'pink-ink': '#FF8DB0',
    'blue-soft': 'rgba(91,139,255,0.16)', 'blue-ink': '#9DB9FF', 'coral-soft': 'rgba(255,138,91,0.16)', 'coral-ink': '#FFAB8A',
    'violet-soft': 'rgba(155,123,255,0.16)', 'violet-ink': '#B9A3FF',
    'card-border': '#2A2B2F', 'card-shadow': 'inset 0 1px 0 rgba(255,255,255,0.04), 0 30px 80px rgba(0,0,0,0.6)'
  } : {
    page: '#EBEBEB', surface: '#FFFFFF', 'surface-2': '#FAFAFA', panel: '#F6F6F6', hover: '#F3F3F3', chip: '#F1F1F1', 'chip-2': '#EEEEEE', track: '#F0F0F0',
    line: '#F0F0F0', 'line-2': '#EFEFEF', 'line-3': '#EDEDED', 'line-4': '#ECECEC', 'col-line': '#EAEAEA',
    border: '#E6E6E6', 'border-2': '#DCDCDC', 'border-3': '#DADADA', 'border-strong': '#BDBDBD',
    ink: '#111111', 'ink-2': '#2A2A2A', 'ink-2b': '#3A3A3A', 'ink-3': '#4A4A4A', 'ink-4': '#5F5F5F', muted: '#666666', 'muted-2': '#707070', faint: '#8A8A8A',
    inv: '#111111', 'inv-ink': '#FFFFFF', 'inv-faint': '#CFCFCF',
    link: bright ? mix(aRgb, [0, 0, 0], 0.6) : accent, 'link-hover': bright ? mix(aRgb, [0, 0, 0], 0.72) : mix(aRgb, [0, 0, 0], 0.25),
    'red-soft': '#FDE8E5', 'red-ink': '#9B1C13', 'amber-soft': '#FFF4D9', 'amber-ink': '#774F00',
    'green-soft': '#E6F5EC', 'green-ink': '#1B653B', 'pink-soft': '#FCE8EF', 'pink-ink': '#99224B',
    'blue-soft': '#E9F0FE', 'blue-ink': '#1E46A8', 'coral-soft': '#FDEDE5', 'coral-ink': '#933612',
    'violet-soft': '#F2EBFB', 'violet-ink': '#5B2A9E',
    'card-border': 'transparent', 'card-shadow': '0 1px 2px rgba(0,0,0,0.04), 0 24px 60px rgba(0,0,0,0.06)'
  };
  const rootStyle = Object.keys(TK).map((k) => '--' + k + ': ' + TK[k] + ';').join(' ') +
    ' color-scheme: ' + (dark ? 'dark' : 'light') + '; min-height: 100vh; background: var(--page); font-family: var(--font-main); color: var(--ink); -webkit-font-smoothing: antialiased; display: flex; flex-direction: column; box-sizing: border-box;';

  const NAV_BY = { admin: ['daily', 'projects', 'ideas', 'brand', 'alerts', 'content'], editor: ['projects', 'brand', 'alerts'], designer: ['projects', 'ideas', 'brand', 'alerts'], sponsor: ['projects', 'ideas', 'brand', 'alerts'] };
  const PAGE_IDS = ['daily', 'alerts', 'content', 'brand', 'settings', 'ideas'];
  const allowedNav = NAV_BY[s.role].concat(['settings']);
  const userPage = PAGE_IDS.indexOf(s.nav) >= 0 && allowedNav.indexOf(s.nav) >= 0 ? s.nav : '';
  const allBrandNames = D.brands.map((b) => b.name);
  const authBrands = isSponsorRole
    ? D.brands.filter((b) => (acct && b.account_id === acct.id) || D.channels.some((x) => x.id === b.channel_id && acct && x.owner_account_id === acct.id)).map((b) => b.name)
    : allBrandNames;
  const brandTile = (size) => 'width: ' + size + 'px; height: ' + size + 'px; flex: none; border-radius: ' + (size > 40 ? 12 : size > 30 ? 10 : 8) + 'px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-2); font-size: ' + (size > 40 ? 14 : 11) + 'px; font-weight: 700;';
  const metricOf = {};
  D.metrics.forEach((m) => { if (!metricOf[m.project_id]) metricOf[m.project_id] = m; });
  const IV = ideasVals({ s: s, set: set, dark: dark, TONE: TONE, DARKFILL: DARKFILL, toolStyle: toolStyle, actColor: actColor, authBrands: authBrands, brandTile: brandTile, D: D, A: A, me: me });
  const PV = pagesVals({ s: s, set: set, dark: dark, TONE: TONE, DARKFILL: DARKFILL, toolStyle: toolStyle, avatar: avatar, actColor: actColor, TYPEFILL: TYPEFILL, fillFor: fillFor, dueState: dueState, di: di, TODAY: TODAY, scoped: scoped, allRows: allRows, catalogRows: catalogRows, metricOf: metricOf, STAGES: STAGES, ROLES: ROLES, page: userPage, accent: accent, scopeName: scopeName, tasks: tasksDef, theme: theme, density: density, ideas: IV, authBrands: authBrands, brandTile: brandTile, D: D, A: A, me: me, now: now, acctName: acctName, allowedViews: allowedViews });
  const NAV = [
    { id: 'daily', label: 'Daily', icon: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', dots: '' },
    { id: 'projects', label: 'Projects', icon: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2zM8 10v4M12 10v2M16 10v6', dots: '' },
    { id: 'content', label: 'Content', icon: 'M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3zM6.2 5.3l3.1 3.9M12.4 3.4l3.1 4M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', dots: '' },
    { id: 'brand', label: 'Brand', icon: 'M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2.5a2 2 0 0 0-1.5 3.3c.5.6.3 2.7-2 2.7z', dots: 'M7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01M17 11.5h.01' },
    { id: 'settings', label: 'Settings', icon: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', dots: '' }
  ];
  const navBase = 'position: relative; display: flex; align-items: center; gap: 12px; min-height: 44px; box-sizing: border-box; border: 0; border-radius: 12px; font-size: 16px; text-align: left; white-space: nowrap; cursor: pointer; ' +
    (s.panel ? 'width: 100%; padding: 0 12px;' : 'width: 48px; padding: 0; justify-content: center; align-self: center;');
  const navOff = navBase + ' font-weight: 500; background: transparent; color: var(--ink-4);';
  const navOn = navBase + ' font-weight: 600; background: var(--chip-2); color: var(--ink);';
  const badge = (n) => !n ? 'display: none;' : (s.panel
    ? 'margin-left: auto; min-width: 24px; height: 24px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;'
    : 'position: absolute; top: 9px; right: 9px; width: 8px; height: 8px; border-radius: 999px; background: #E5484D; font-size: 0; overflow: hidden;');
  NAV.splice(1, 0, { id: 'alerts', label: 'Notifications', icon: 'M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326', dots: '', count: PV.unread });
  const ADMIN_DEF = isAdmin ? [
    { id: 'team', label: 'Users', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', dots: '' },
    { id: 'roles', label: 'Roles & Permissions', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4', dots: '' },
    { id: 'pm', label: 'Workload', icon: 'M3 3h18v18H3zM8 7v7M12 7v4M16 7v10', dots: '' },
    { id: 'clients', label: 'Clients & Sponsors', icon: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', dots: '' },
    { id: 'finance', label: 'Finance', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', dots: '' },
    { id: 'auto', label: 'Automations', icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z', dots: '' },
    { id: 'logs', label: 'Activity Log', icon: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3', dots: '' },
    { id: 'workspace', label: 'Workspace Settings', icon: NAV[NAV.length - 1].icon, dots: '' }
  ] : [];
  if (isAdmin) NAV.splice(NAV.findIndex((n) => n.id === 'settings'), 1);
  NAV.push({ id: 'ideas', label: 'Ideas & Research', icon: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z', dots: '' });
  const NAV_LABEL = { alerts: 'Inbox' };
  if (isSponsorRole) { NAV_LABEL.projects = 'My Projects'; NAV_LABEL.brand = 'My Brand'; }
  const NAVR = NAV_BY[s.role].map((id) => { const n = NAV.find((x) => x.id === id); return Object.assign({}, n, { label: NAV_LABEL[id] || n.label }); });
  const curNav = NAVR.concat(ADMIN_DEF).find((n) => n.id === s.nav) || (userPage ? { id: userPage } : NAVR.find((n) => n.id === 'projects'));
  const mkNav = (n) => {
    const on = n.id === curNav.id;
    return {
      label: n.label, icon: n.icon, dots: n.dots,
      count: n.count ? String(n.count) : '',
      aria: n.label + (n.count ? ', ' + n.count + ' new' : ''),
      badgeStyle: badge(n.count),
      cls: on ? 'fb-ni-on' : 'fb-ni',
      current: on ? 'page' : 'false',
      pick: () => set({ nav: n.id, openJob: '' }),
      style: on ? navOn : navOff,
      mstyle: 'flex: none; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 12px; cursor: pointer; ' + (on ? 'background: var(--chip-2); color: var(--ink);' : 'background: transparent; color: var(--ink-4);')
    };
  };
  const navItems = NAVR.map(mkNav);
  const clientChannel = D.channels.find((x) => x.owner_account_id && (!isSponsorRole || x.name === acctName)) || null;
  const SAVED = [
    { id: 'short', label: 'Shortform', icon: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2', f: { ftype: { 'Shortform': true } }, test: (r) => r.type === 'Shortform', need: 'type' },
    { id: 'sponsor', label: 'Sponsor review', icon: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', f: { fstatus: { 'Sponsor Review': true } }, test: (r) => r.status === 'Sponsor Review', need: 'status' },
    clientChannel ? { id: 'client', label: clientChannel.name + ' channel', icon: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', f: { fchannel: { [clientChannel.name]: true } }, test: (r) => r.channel === clientChannel.name, need: 'channel' } : null,
    { id: 'live', label: 'Live', icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM10 8l6 4-6 4z', f: { fstatus: { 'Live': true } }, test: (r) => r.status === 'Live', need: 'status' }
  ].filter((v) => v && has(v.need));
  const sameMap = (a, b) => { const ka = Object.keys(a || {}).filter((k) => a[k]); const kb = Object.keys(b || {}).filter((k) => b[k]); return ka.length === kb.length && ka.every((k) => b[k]); };
  const savedViews = SAVED.map((v) => {
    const want = Object.assign({ ftype: {}, fchannel: {}, fstatus: {} }, v.f);
    const on = sameMap(ftype, want.ftype) && sameMap(fchannel, want.fchannel) && sameMap(fstatus, want.fstatus);
    const n = scoped.filter(v.test).length;
    return {
      label: v.label, icon: v.icon, dots: '',
      count: n ? String(n) : '',
      aria: v.label + ', ' + n + (n === 1 ? ' project' : ' projects'),
      badgeStyle: s.panel ? badge(n) : 'display: none;',
      cls: on ? 'fb-ni-on' : 'fb-ni',
      pressed: on ? 'true' : 'false',
      pick: () => set(on ? { ftype: {}, fchannel: {}, fstatus: {} } : Object.assign({ ftype: {}, fchannel: {}, fstatus: {}, menu: '', nav: 'projects' }, v.f)),
      style: on ? navOn : navOff
    };
  });

  const adminPage = isAdmin && ADMIN_DEF.some((n) => n.id === s.nav) ? s.nav : '';
  const TEAM_ROLES = ROLES.map((r) => ({ id: r.id, label: r.label, desc: r.desc }));
  const VIEW_LIST = [['table', 'Table'], ['kanban', 'Kanban'], ['list', 'List'], ['timeline', 'Timeline'], ['calendar', 'Calendar']];
  const ROLE_TONE = { editor: 'blue', sponsor: 'amber', designer: 'violet' };
  const roleBlock = (rid) => {
    let bg = 'var(--inv)'; let fg = 'var(--inv-ink)';
    if (rid !== 'admin') { const tn = ROLE_TONE[rid]; bg = dark ? DARKFILL[tn][0] : TONE[tn][3]; fg = dark ? DARKFILL[tn][1] : '#FFFFFF'; }
    return 'display: inline-flex; align-items: center; height: 28px; padding: 0 10px; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + bg + '; color: ' + fg + ';';
  };
  const STATUS_L = { active: 'Active', invited: 'Invited', deactivated: 'Deactivated' };
  const viewsFor = (dbRole, v) => v && v.length ? v : (cfgOf(dbRole).views || DEF_VIEWS[UI_ROLE[dbRole]]);
  const members = D.members.map((m) => ({
    id: m.user_id, name: m.person.full_name || m.person.name || 'Unnamed', first: m.person.name || first(m.person.full_name), email: (D.profileEmail || {})[m.user_id] || '',
    type: UI_ROLE[m.role], dbRole: m.role, views: viewsFor(m.role, m.views), status: STATUS_L[m.status] || 'Active', owner: m.is_owner,
    lastActive: m.user_id === me.id ? 'Now' : m.status === 'deactivated' ? 'Deactivated ' + relTime(m.updated_at, now) : (m.last_active_at ? relTime(m.last_active_at, now) : 'Never'), raw: m
  })).concat(D.invitations.map((i) => ({
    id: 'inv:' + i.id, isInvite: true, name: i.full_name || i.email, first: first(i.full_name) || i.email, email: i.email, type: UI_ROLE[i.role], dbRole: i.role,
    views: viewsFor(i.role, i.views), status: 'Invited', lastActive: 'Invited ' + labelOf(i.created_at), resent: !!i.resent_at, raw: i
  })));
  const tq = (s.teamQ || '').trim().toLowerCase();
  const tTab = s.teamTab || 'all';
  const GRAYB = 'display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;';
  const teamTabs = [{ id: 'all', label: 'All' }].concat(TEAM_ROLES).map((r) => {
    const on = tTab === r.id;
    const n = r.id === 'all' ? members.length : members.filter((m) => m.type === r.id).length;
    return { label: r.label, count: String(n), badge: GRAYB, pressed: on ? 'true' : 'false', pick: () => set({ teamTab: r.id }), style: toolStyle(on) };
  });
  const shownMembers = members.filter((m) => (tTab === 'all' || m.type === tTab) && (!tq || m.name.toLowerCase().includes(tq) || m.email.toLowerCase().includes(tq)));
  const STATUS_TONE = { Active: 'green', Invited: 'amber', Deactivated: 'gray' };
  const smBtn = 'min-height: 36px; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; color: var(--ink-3);';
  const teamRows = shownMembers.map((m) => {
    const st = m.status;
    const tn = STATUS_TONE[st] || 'gray';
    const f = dark ? DARKFILL[tn] : (tn === 'gray' ? ['var(--chip-2)', 'var(--ink-3)'] : [TONE[tn][3], '#FFFFFF']);
    const off = st === 'Deactivated';
    const self = m.id === me.id;
    const acts = [];
    if (!m.owner && !self) {
      const confirm = s.memberConfirm === m.id;
      if (st === 'Invited') acts.push({ label: m.resent ? 'Invite sent' : 'Resend invite', aria: 'Resend invite to ' + m.name, style: smBtn + (m.resent ? ' color: var(--muted-2);' : ''), pick: () => { if (!m.resent) A.resendInvite(m.raw); } });
      if (st === 'Active') acts.push({ label: 'Deactivate', aria: 'Deactivate ' + m.name, style: smBtn, pick: () => A.setMemberStatus(m.raw, 'deactivated', 'deactivated', m.name) });
      if (off) acts.push({ label: 'Reactivate', aria: 'Reactivate ' + m.name, style: smBtn, pick: () => A.setMemberStatus(m.raw, 'active', 'reactivated', m.name) });
      acts.push({ label: confirm ? 'Confirm remove' : 'Remove', aria: 'Remove ' + m.name, style: smBtn + ' color: var(--red-ink);' + (confirm ? ' background: var(--red-soft);' : ''), pick: () => { if (!confirm) return set({ memberConfirm: m.id }); set({ memberConfirm: '' }); A.removeMember(m); } });
    }
    return {
      displayName: m.name + (self ? ' (you)' : ''),
      email: m.email,
      initials: m.name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      avatarStyle: off || m.isInvite ? 'width: 36px; height: 36px; border-radius: 999px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: var(--chip-2); color: var(--muted);' : avatar(m.first, 36).replace('font-size: 11px', 'font-size: 12px'),
      nameStyle: 'font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ' + (off ? 'var(--muted)' : 'var(--ink)') + ';',
      typeLabel: m.dbRole === 'client' ? 'Client' : (TEAM_ROLES.find((r) => r.id === m.type) || {}).label,
      typeStyle: roleBlock(m.type),
      views: VIEW_LIST.filter((v) => m.views.indexOf(v[0]) >= 0).map((v) => ({ label: v[1] })),
      status: st,
      statusStyle: 'display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 0; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + f[0] + '; color: ' + f[1] + ';',
      lastActive: m.lastActive || 'Never',
      actions: acts,
      isOwner: !!m.owner
    };
  });
  const TEAMCOLS = 'display: grid; grid-template-columns: minmax(240px, 2fr) 150px minmax(240px, 2fr) 120px 130px 230px; align-items: center;';
  const nuType = s.nuType || 'editor';
  const nuViews = s.nuViews || (cfgOf(dbFor(nuType)).views || DEF_VIEWS[nuType]);
  const ROLE_META2 = {
    admin: { blurb: 'Full board, Team page and every setting.', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
    editor: { blurb: 'Edit queue across longform and shortform.', icon: 'm22 8-6 4 6 4V8zM2 6h14v12H2z' },
    sponsor: { blurb: 'View only. Status, dates and links for their account.', icon: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z' },
    designer: { blurb: 'Thumbnails, design status and due dates.', icon: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586M11 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' }
  };
  const roleFillPair = (rid) => rid === 'admin' ? ['var(--inv)', 'var(--inv-ink)'] : (dark ? DARKFILL[ROLE_TONE[rid]] : [TONE[ROLE_TONE[rid]][3], '#FFFFFF']);
  const nuTypes = TEAM_ROLES.map((r) => {
    const on = r.id === nuType;
    const fp = roleFillPair(r.id);
    return {
      label: r.label, blurb: ROLE_META2[r.id].blurb, icon: ROLE_META2[r.id].icon, on: on,
      pick: () => set({ nuType: r.id, nuViews: null, nuErr: '' }),
      tileStyle: 'width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: ' + fp[0] + '; color: ' + fp[1] + ';',
      radioStyle: 'width: 18px; height: 18px; flex: none; margin-top: 2px; box-sizing: border-box; border-radius: 999px; background: var(--surface); ' + (on ? 'border: 5px solid var(--ink);' : 'border: 1.5px solid var(--border-strong);'),
      style: 'position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 14px; box-sizing: border-box; border-radius: 14px; cursor: pointer; background: ' + (on ? 'var(--surface)' : 'var(--surface-2)') + '; ' +
        (on ? 'border: 1.5px solid var(--ink); box-shadow: 0 0 0 3px var(--chip-2);' : 'border: 1.5px solid var(--border);')
    };
  });
  const nuViewItems = VIEW_LIST.map((v) => {
    const on = nuViews.indexOf(v[0]) >= 0;
    return { label: v[1], on: on,
      pick: () => set({ nuErr: '', nuViews: on ? nuViews.filter((x) => x !== v[0]) : VIEW_LIST.map((x) => x[0]).filter((x) => x === v[0] || nuViews.indexOf(x) >= 0) }),
      style: 'display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; box-sizing: border-box; border: 1px solid ' + (on ? 'var(--ink)' : 'var(--border)') + '; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--ink);' };
  });
  const nuAcctId = s.nuAcct && D.accounts.some((a) => a.id === s.nuAcct) ? s.nuAcct : ((D.accounts[0] || {}).id || '');
  const addMember = () => {
    const name = (s.nuName || '').trim();
    const email = (s.nuEmail || '').trim();
    if (!name) return set({ nuErr: 'Enter a name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return set({ nuErr: 'Enter a valid email address.' });
    if (members.some((m) => m.email.toLowerCase() === email.toLowerCase())) return set({ nuErr: 'That email is already on the team.' });
    if (!nuViews.length) return set({ nuErr: 'Pick at least one view.' });
    const a = nuType === 'sponsor' ? D.accounts.find((x) => x.id === nuAcctId) : null;
    if (nuType === 'sponsor' && !a) return set({ nuErr: 'Add a client or sponsor account first.' });
    const dbRole = nuType === 'admin' ? 'super_admin' : nuType === 'sponsor' ? (a.type === 'client' ? 'client' : 'sponsor') : nuType;
    A.inviteMember({ email: email, name: name, role: dbRole, views: nuViews, accountId: a ? a.id : null, roleLabel: (TEAM_ROLES.find((r) => r.id === nuType) || {}).label })
      .then(() => set({ teamModal: false, nuName: '', nuEmail: '', nuType: '', nuViews: null, nuErr: '', teamTab: 'all', teamQ: '' }))
      .catch((err) => set({ nuErr: err.message }));
  };

  const openAddUser = () => set({ teamModal: true, nuName: '', nuEmail: '', nuType: 'editor', nuViews: null, nuErr: '', nuAcct: '' });
  const AV = isAdmin ? adminVals({ s: s, set: set, dark: dark, TONE: TONE, DARKFILL: DARKFILL, GRAYB: GRAYB, toolStyle: toolStyle, allRows: allRows, catalogRows: catalogRows, ROLES: ROLES, COLS: COLS, PILL: PILL, fillFor: fillFor, dueState: dueState, TYPEFILL: TYPEFILL, avatar: avatar, members: members, page: adminPage, di: di, TODAY: TODAY, DEF_VIEWS: DEF_VIEWS, roleBlock: roleBlock, actColor: actColor, openAddUser: openAddUser, D: D, A: A, me: me, now: now, nameOf: D.nameOf })
    : adminVals({ s: s, set: set, dark: dark, TONE: TONE, DARKFILL: DARKFILL, GRAYB: GRAYB, toolStyle: toolStyle, allRows: [], catalogRows: [], ROLES: ROLES, COLS: COLS, PILL: PILL, fillFor: fillFor, dueState: dueState, TYPEFILL: TYPEFILL, avatar: avatar, members: [], page: '', di: di, TODAY: TODAY, DEF_VIEWS: DEF_VIEWS, roleBlock: roleBlock, actColor: actColor, openAddUser: () => {}, D: D, A: A, me: me, now: now, nameOf: D.nameOf });
  const adminOn = ADMIN_DEF.some((n) => n.id === curNav.id);
  const adminShown = !s.panel || adminOn || !!s.adminOpen;
  const viewN = (usePerson ? 1 : 0) + (useType ? 1 : 0) + (useChannel ? 1 : 0) + (useStatus ? 1 : 0) + (s.sort && s.sort !== 'default' ? 1 : 0) + (hiddenCount > 0 ? 1 : 0) + (gb !== 'stage' ? 1 : 0);
  const adminNav = ADMIN_DEF.map((n) => mkNav(Object.assign({}, n, { count: AV.badges[n.id] || 0 })));
  const STATUS_SEQ = D.statuses.filter((x) => x.is_system).map((x) => x.label);
  const stageOf = (st) => STG[st] || 'prod';
  const solid = (tn) => dark ? DARKFILL[tn] : [TONE[tn][3], '#FFFFFF'];
  const hardBlock = (f, h) => 'display: inline-flex; align-items: center; height: ' + h + 'px; padding: 0 10px; border-radius: 0; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + (f ? f[0] : 'var(--chip)') + '; color: ' + (f ? f[1] : 'var(--ink-3)') + ';';
  const btnPrimary = 'min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); cursor: pointer;';
  const btnGhost = 'min-height: 44px; padding: 0 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--ink); cursor: pointer;';
  const noop = () => {};
  let dr = { job: '', title: '', stage: '', stageDot: '', jobStyle: '', posText: '', metaLine: '', blocks: [], tabs: [], tabId: '', steps: [], sections: [], assets: [], comments: [], history: [], actions: [], footNote: '', isOverview: false, isAssets: false, isComments: false, isHistory: false, notComments: true, canUpload: false, uploadLabel: '', assetsEmpty: false, noComments: false, commentNote: '', placeholder: '', draft: '', showInternal: false, internalOn: false, canComment: false, onDraft: noop, post: noop, toggleInternal: noop, prev: noop, next: noop, upload: noop };
  const cur = openJob ? allRows.find((r) => r.job === openJob) : null;
  if (cur) {
    const r = cur;
    const applyOv = (patch, text, extra) => A.applyPatch(r, patch, Object.assign({ text: text, stage: patch.status ? stageOf(patch.status) : undefined }, extra || {}));
    const idx = sorted.findIndex((x) => x.job === r.job);
    const n = sorted.length;
    const go = (d) => () => { if (!n) return; const i = idx < 0 ? 0 : (idx + d + n) % n; set({ openJob: sorted[i].job, draft: '' }); };
    const G = STAGES.find((x) => x.id === r.g) || STAGES[0];
    const si = Math.max(0, STATUS_SEQ.indexOf(r.status));
    const eS = r.editStatus || '';
    const tS = r.thumb || '';
    const isSponsor = isSponsorRole;

    const blocks = [];
    if (TYPEFILL[r.type] && (has('type') || isSponsor)) blocks.push({ text: r.type, style: hardBlock(TYPEFILL[r.type], 26) });
    blocks.push({ text: r.status, style: hardBlock(fillFor('status', r.status), 26) });

    const TABS = [['overview', 'Overview'], ['assets', 'Assets'], ['comments', 'Comments']].concat(isSponsor ? [] : [['history', 'History']]);
    const dTab = TABS.find((t) => t[0] === s.dTab) ? s.dTab : 'overview';
    const comments = cmtFor(r);
    const tabs = TABS.map((t) => {
      const on = t[0] === dTab;
      const cnt = t[0] === 'comments' ? comments.length : 0;
      return {
        id: 'dtab-' + t[0], label: t[1], selected: on ? 'true' : 'false',
        hasCount: cnt > 0, count: String(cnt), badge: GRAYB,
        pick: () => set({ dTab: t[0] }),
        style: 'min-height: 44px; padding: 0 2px; border: 0; border-bottom: 2px solid ' + (on ? 'var(--ink)' : 'transparent') + '; background: transparent; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap; color: ' + (on ? 'var(--ink)' : 'var(--muted)') + ';'
      };
    });

    const steps = [];
    const step = (label, state, value, meta) => {
      const fill = state === 'done' ? solid('green') : state === 'warn' ? solid('red') : state === 'now' ? solid('blue') : null;
      steps.push({
        label: label, value: value, meta: meta || '',
        marker: 'width: 14px; height: 14px; box-sizing: border-box; border-radius: 0; flex: none; ' + (fill ? 'background: ' + fill[0] + ';' + (state === 'now' ? ' box-shadow: 0 0 0 4px var(--chip-2);' : '') : 'background: var(--surface); border: 2px solid var(--border-strong);'),
        valueStyle: hardBlock(fill, 24)
      });
    };
    step('Script', si > 0 ? 'done' : 'now', si > 0 ? 'Locked' : 'In progress', '');
    step('Film', si > 1 ? 'done' : si === 1 ? 'now' : 'todo', si > 1 ? 'Wrapped' : si === 1 ? 'Filming' : 'Not started', r.film ? 'Film ' + r.film : 'No film date');
    if (has('editStatus')) step('Edit', eS === 'Approved' ? 'done' : eS === 'Needs Revision' ? 'warn' : eS ? 'now' : 'todo', eS || 'Not assigned', [r.editor, r.editDue ? 'Due ' + r.editDue : ''].filter(Boolean).join('  ·  ') || 'No editor yet');
    if (has('thumb')) step('Thumbnail', tS === 'Done' ? 'done' : tS === 'Needs Revision' ? 'warn' : (tS === 'In Design' || tS === 'In Review') ? 'now' : 'todo', tS || 'Not assigned', [r.designer, r.thumbDue ? 'Due ' + r.thumbDue : ''].filter(Boolean).join('  ·  ') || 'No designer yet');
    if (r.sponsor && (has('approval') || isSponsor)) {
      const ap = r.approval || 'Pending';
      step('Sponsor approval', ap === 'Approved' ? 'done' : ap === 'Changes Requested' ? 'warn' : r.status === 'Sponsor Review' ? 'now' : 'todo', ap, r.sponsor);
    }
    step('Publish', r.status === 'Live' ? 'done' : r.status === 'Scheduled' ? 'now' : 'todo', r.status === 'Live' ? 'Live' : r.status === 'Scheduled' ? 'Scheduled' : 'Not scheduled', r.pub ? 'Pub ' + r.pub : '');

    const SECT = [['Production', ['job', 'channel', 'type', 'film']], ['Edit', ['editor', 'editStatus', 'editDue']], ['Design', ['designer', 'thumb', 'thumbDue']], ['Sponsor', ['sponsor', 'approval']], ['Publishing', ['status', 'pub', 'link']], ['Distribution', ['clipping', 'newsletter', 'community', 'distribute']]];
    const fieldVal = (k) => {
      const c = COLS[k];
      const v = k === 'link' ? linkFor(r) : (r[k] || '');
      const o = { label: c.label, text: v, isText: false, isBlock: false, isDate: false, isPerson: false, isDot: false, isLink: false, isEmpty: !v, emptyText: c.kind === 'person' ? 'Unassigned' : 'Not set', href: r.linkUrl || undefined };
      if (!v) return o;
      if (c.kind === 'pill') { o.isBlock = true; o.blockStyle = hardBlock(fillFor(k, v), 26); }
      else if (c.kind === 'date') {
        o.isDate = true;
        const st = dueState(k, r);
        o.chipStyle = 'display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; ' + (st === 'late' ? 'background: var(--red-soft); color: var(--red-ink);' : st === 'today' ? 'background: var(--amber-soft); color: var(--amber-ink);' : 'background: var(--hover); color: var(--ink-2b);');
      }
      else if (c.kind === 'person') { o.isPerson = true; o.initials = v.slice(0, 1); o.avatarStyle = avatar(v, 26); }
      else if (c.kind === 'dot') { o.isDot = true; o.dotStyle = 'width: 8px; height: 8px; border-radius: 999px; flex: none; background: ' + (DOT[v] || '#C4C4C4') + ';'; }
      else if (c.kind === 'link') { o.isLink = true; o.linkStyle = 'display: inline-flex; align-items: center; gap: 6px; color: var(--link); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap;'; }
      else { o.isText = true; o.textStyle = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;' + (c.kind === 'mono' ? ' font-variant-numeric: tabular-nums; letter-spacing: 0.02em; font-weight: 600;' : ''); }
      return o;
    };
    const sections = SECT.map((p) => ({ title: p[0], fields: p[1].filter(has).map(fieldVal) }))
      .filter((sec) => sec.fields.length && (sec.title !== 'Distribution' || r.g === 'pub'));

    const ICON = {
      doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
      folder: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z',
      video: 'm22 8-6 4 6 4V8zM2 6h14v12H2z',
      image: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
      play: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM10 8l6 4-6 4z'
    };
    const KIND = { script: ['doc', 'Open', 0], raw_footage: ['folder', 'Open', 1], draft: ['video', 'Review', 2], thumbnail: ['image', 'Open', 3], final: ['play', 'Watch', 4], other: ['doc', 'Open', 5] };
    const rawAssets = isSponsor ? ((portal[r.id] || {}).assets || []) : (D.assets[r.id] || []);
    const showAsset = (a) => {
      if (isSponsor) return true;
      if (a.kind === 'draft') return s.role === 'admin' || s.role === 'editor';
      if (a.kind === 'thumbnail') return s.role === 'admin' || s.role === 'designer';
      if (a.kind === 'script') return s.role !== 'designer';
      return true;
    };
    const maxV = rawAssets.filter((a) => a.kind === 'draft').reduce((m, a) => Math.max(m, a.version || 1), 0);
    const assetMeta = (a) => {
      if (isSponsor) return a.kind === 'draft' ? 'Latest cut' : a.kind === 'final' ? 'Live since ' + r.pub : 'Shared ' + relTime(a.created_at, now);
      if (a.kind === 'script') return a.storage_path ? 'Uploaded ' + relTime(a.created_at, now) : (si > 0 ? 'Locked for film day' : 'Draft in progress');
      if (a.kind === 'raw_footage') return r.film ? 'Filmed ' + r.film : 'Uploaded ' + relTime(a.created_at, now);
      if (a.kind === 'draft') return (r.editor || 'Editor') + '  ·  ' + ((a.version || 1) === maxV ? (eS || 'Draft') : 'Superseded');
      if (a.kind === 'thumbnail') return (r.designer || 'Designer') + '  ·  ' + (tS || 'Concept');
      if (a.kind === 'final') return 'Live since ' + r.pub;
      return D.nameOf(a.uploaded_by) + '  ·  ' + relTime(a.created_at, now);
    };
    const A2 = rawAssets.filter(showAsset).slice().sort((a, b) => (KIND[a.kind] || KIND.other)[2] - (KIND[b.kind] || KIND.other)[2] || (b.version || 0) - (a.version || 0));
    const assets = A2.map((a, i) => {
      const k = KIND[a.kind] || KIND.other;
      const name = isSponsor && a.kind === 'draft' ? 'Draft for review' : a.name;
      return {
        name: name, meta: assetMeta(a), action: k[1], icon: ICON[k[0]], aria: k[1] + ' ' + name,
        open: (e) => { if (e && e.preventDefault) e.preventDefault(); A.openAsset(a, r); },
        rowStyle: 'display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 10px 16px; box-sizing: border-box;' + (i ? ' border-top: 1px solid var(--line);' : '')
      };
    });

    const cmtAvatar = (w, size) => 'width: ' + size + 'px; height: ' + size + 'px; border-radius: 999px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #FFFFFF; background: ' + actColor(w) + ';';
    const commentRows = comments.map((c) => ({
      who: c.who, time: c.time, text: c.text, roleTag: c.who === 'You' ? (ROLE_TAG[me.dbRole] || '') : c.roleTag,
      internal: !isSponsor && !!c.internal,
      initials: c.who.slice(0, 1), avatarStyle: cmtAvatar(c.who, 32)
    }));
    const canComment = isSponsor ? !!(acct && acct.allow_comment) : can('comments', 'create');
    const post = () => {
      const t = (s.draft || '').trim();
      if (!t || !canComment) return;
      set({ draft: '' });
      A.postComment(r, t, !isSponsor && !!s.dInternal);
    };

    const histRaw = D.activity.filter((l) => l.project_id === r.id).map((l) => ({ who: l.actor_id === me.id ? 'You' : (l.actor_label || 'Automation'), text: l.action.replace(/\s(on|for)$/, ''), time: relTime(l.created_at, now), fresh: now - new Date(l.created_at) < FRESH }))
      .concat([{ who: r.createdBy && r.createdBy === me.id ? 'You' : 'Team', text: 'created the project', time: r.createdAt ? relTime(r.createdAt, now) : 'Earlier', fresh: false }]);
    const history = histRaw.map((h) => ({
      who: h.who, text: h.text, time: h.time, initials: h.who.slice(0, 1), avatarStyle: cmtAvatar(h.who, 28),
      dotStyle: 'width: 8px; height: 8px; margin-top: 6px; border-radius: 999px; flex: none; background: ' + (h.fresh ? '#E0567F' : 'transparent') + ';'
    }));

    const acts = [];
    let foot = 'Nothing waiting on you.';
    const locked = settings.lock_after_live && r.status === 'Live' && s.role !== 'admin';
    if (s.role === 'admin') {
      if (eS === 'In Review') acts.push({ label: 'Approve edit', primary: false, pick: () => applyOv({ editStatus: 'Approved' }, 'approved the edit', { event: 'status' }) });
      if (tS === 'In Review') acts.push({ label: 'Approve thumbnail', primary: false, pick: () => applyOv({ thumb: 'Done' }, 'approved the thumbnail', { event: 'status' }) });
      if (si < STATUS_SEQ.length - 1) {
        let ni = si + 1;
        if (STATUS_SEQ[ni] === 'Sponsor Review' && !r.sponsor) ni++;
        const nx = STATUS_SEQ[ni];
        acts.push({ label: 'Move to ' + nx, primary: true, pick: () => applyOv({ status: nx }, 'moved Status to ' + nx, { event: 'status', external: nx === 'Scheduled' || nx === 'Live' || nx === 'Sponsor Review' }) });
        foot = 'Status changes sync to every role view.';
      } else foot = 'Live. Track distribution in Overview.';
    } else if (locked) {
      foot = 'Live projects are locked. Ask a Super Admin to make changes.';
    } else if (s.role === 'editor') {
      const mine = r.editorId === me.id && can('edits', 'edit');
      if (mine && eS === 'Assigned') acts.push({ label: 'Start editing', primary: true, pick: () => applyOv({ editStatus: 'Editing' }, 'moved Editor Status to Editing', { event: 'status' }) });
      else if (mine && eS === 'Editing') acts.push({ label: 'Submit for review', primary: true, pick: () => applyOv({ editStatus: 'In Review' }, 'submitted the edit for review', { event: 'status' }) });
      else if (mine && eS === 'Needs Revision') acts.push({ label: 'Submit revision', primary: true, pick: () => applyOv({ editStatus: 'In Review' }, 'submitted a revised edit', { event: 'status' }) });
      else if (eS === 'In Review') foot = 'Edit is waiting on review.';
      else if (eS === 'Approved') foot = 'Edit approved.';
    } else if (s.role === 'designer') {
      const mine = r.designerId === me.id && can('thumbs', 'edit');
      if (mine && tS === 'Not Started') acts.push({ label: 'Start design', primary: true, pick: () => applyOv({ thumb: 'In Design' }, 'started the thumbnail', { event: 'status' }) });
      else if (mine && (tS === 'In Design' || tS === 'Needs Revision')) acts.push({ label: 'Submit thumbnail', primary: true, pick: () => applyOv({ thumb: 'In Review' }, 'submitted the thumbnail for review', { event: 'status' }) });
      else if (tS === 'In Review') foot = 'Thumbnail is waiting on review.';
      else if (tS === 'Done') foot = 'Thumbnail approved.';
    } else {
      const mine = r.sponsor && r.sponsor === acctName;
      const canApprove = mine && acct && acct.allow_approve && r.sponsorshipId;
      if (canApprove && r.approval === 'Pending') {
        acts.push({ label: 'Request changes', primary: false, pick: () => A.decide(r, 'changes_requested', (s.draft || '').trim()) });
        acts.push({ label: 'Approve', primary: true, pick: () => A.decide(r, 'approved', '') });
        foot = 'Your approval is needed.';
      } else if (mine && r.approval === 'Pending') foot = 'Approval is pending. Your account can view and comment.';
      else if (mine && r.approval === 'Approved') foot = 'You approved this project.';
      else if (mine && r.approval === 'Changes Requested') foot = 'Changes requested. The team replies in Comments.';
      else foot = 'View only.';
    }
    if (acts.length && s.role !== 'admin' && s.role !== 'sponsor') foot = '';

    const uploadKind = s.role === 'editor' ? 'draft' : s.role === 'designer' ? 'thumbnail' : 'other';
    dr = {
      job: r.job, title: r.title, stage: G.title, posText: idx >= 0 ? (idx + 1) + ' of ' + n : '',
      stageDot: 'width: 8px; height: 8px; border-radius: 999px; flex: none; background: ' + G.color + ';',
      jobStyle: 'display: inline-flex; align-items: center; height: 28px; padding: 0 10px; border-radius: 0; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 700; letter-spacing: 0.04em; font-variant-numeric: tabular-nums;',
      metaLine: [r.channel, r.pub ? 'Pub ' + r.pub : ''].filter(Boolean).join('  ·  '),
      blocks: blocks, tabs: tabs, tabId: 'dtab-' + dTab,
      isOverview: dTab === 'overview', isAssets: dTab === 'assets', isComments: dTab === 'comments', isHistory: dTab === 'history', notComments: dTab !== 'comments',
      steps: steps, sections: sections,
      assets: assets, assetsEmpty: assets.length === 0,
      canUpload: !isSponsor && can('assets', 'create'), uploadLabel: s.role === 'editor' ? 'Upload cut' : s.role === 'designer' ? 'Upload thumbnail' : 'Upload file',
      upload: () => A.pickAndUpload(r, uploadKind),
      comments: commentRows, noComments: commentRows.length === 0,
      commentNote: isSponsor ? 'Your comments go to the production team.' : 'Internal comments stay hidden from the client view.',
      placeholder: !canComment ? 'Comments are turned off for your account' : isSponsor ? 'Message the production team' : 'Write a comment',
      draft: s.draft || '', canComment: canComment,
      onDraft: (e) => set({ draft: e && e.target ? e.target.value : '' }),
      post: post,
      showInternal: !isSponsor, internalOn: !!s.dInternal, toggleInternal: () => set({ dInternal: !s.dInternal }),
      history: history,
      actions: acts.map((a) => ({ label: a.label, pick: a.pick, style: a.primary ? btnPrimary : btnGhost })),
      footNote: foot,
      prev: go(-1), next: go(1)
    };
  }

  // ---------- Inline cell editor ----------
  let ce = { label: '', project: '', isList: false, isDate: false, isText: false, opts: [], hasClear: false, clear: () => {}, clearLabel: '', clearStyle: '', onKey: () => {}, cal: { label: '', weekdays: [], days: [], prev: () => {}, next: () => {} }, quick: [], quickStyle: '', navBtn: '', text: '', placeholder: '', onText: () => {}, onTextKey: () => {}, save: () => {}, hasOpen: false, openText: '', openStyle: '', openHref: '' };
  const ceRow = CE ? allRows.find((x) => x.job === CE.job) : null;
  if (ceRow && canCell(CE.key, ceRow)) {
    const r = ceRow, k = CE.key;
    const curV = k === 'link' ? (r.linkUrl || '') : (r[k] || '');
    const close = () => set({ cellEdit: null, ceText: '' });
    const kind = (COLS[k] || {}).kind || 'custom';
    ce.label = colLabel(k);
    ce.project = r.title;
    ce.onKey = (e) => { if (e && e.key === 'Escape') close(); };
    const optStyle = (on) => 'min-height: 40px; width: 100%; box-sizing: border-box; padding: 0 8px; border: 0; border-radius: 10px; display: flex; align-items: center; gap: 10px; text-align: left; cursor: pointer; white-space: nowrap; letter-spacing: normal; font-size: 14px; color: var(--ink); font-weight: ' + (on ? '600' : '500') + '; background: ' + (on ? 'var(--hover)' : 'transparent') + ';';
    const checkS = (on) => 'width: 16px; height: 16px; flex: none; display: inline-flex; color: var(--ink); opacity: ' + (on ? '1' : '0') + ';';
    const mkOpt = (label, sw, swText, meta) => ({ label: label, sel: label === curV ? 'true' : 'false', pick: () => label === curV ? close() : setField(r, k, label), style: optStyle(label === curV), check: checkS(label === curV), swStyle: sw, swText: swText || '', meta: meta || '' });
    const tileS = 'width: 22px; height: 22px; flex: none; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-2); font-size: 10px; font-weight: 700;';
    const ini2 = (v) => v.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    if (kind === 'pill') {
      const vals = k === 'type' ? Object.keys(TYPEFILL) : k === 'status' ? D.statuses.map((x) => x.label) : Object.keys(PILL[k]);
      ce.isList = true;
      ce.opts = vals.map((v) => { const f = fillFor(k, v); return mkOpt(v, 'width: 14px; height: 14px; flex: none; background: ' + (f ? f[0] : 'var(--chip)') + ';', '', allRows.filter((x) => x[k] === v).length + ''); });
      ce.hasClear = !!curV && k !== 'type' && k !== 'status' && !(k === 'approval');
      ce.clearLabel = 'Clear ' + ce.label;
    } else if (kind === 'person') {
      const ppl = k === 'editor' ? editorNames : designerNames;
      ce.isList = true;
      ce.opts = ppl.map((p) => mkOpt(p, avatar(p, 24), p.slice(0, 1), allRows.filter((x) => x[k] === p && x.status !== 'Live').length + ' active'));
      ce.hasClear = !!curV;
      ce.clearLabel = 'Unassign';
    } else if (kind === 'dot') {
      ce.isList = true;
      ce.opts = ['Not Yet', 'Drafted', 'Ongoing', 'Done'].map((v) => mkOpt(v, 'width: 10px; height: 10px; flex: none; margin: 0 6px; border-radius: 999px; background: ' + (DOT[v] || '#C4C4C4') + ';'));
      ce.hasClear = !!curV;
      ce.clearLabel = 'Clear';
    } else if (k === 'channel' || k === 'sponsor') {
      const vals = k === 'channel' ? D.channels.map((x) => x.name) : D.accounts.filter((a) => a.type === 'sponsor').map((a) => a.name);
      ce.isList = true;
      ce.opts = vals.map((v) => mkOpt(v, tileS, ini2(v), allRows.filter((x) => x[k] === v).length + ''));
      ce.hasClear = k === 'sponsor' && !!curV;
      ce.clearLabel = 'No sponsor';
    } else if (kind === 'date') {
      ce.isDate = true;
      const m = s.ceMonth == null ? today.getMonth() : s.ceMonth;
      const y = s.ceYear == null ? today.getFullYear() : s.ceYear;
      const sd = new Date(y, m, 1).getDay(), dmn = new Date(y, m + 1, 0).getDate();
      const cp = parse(curV);
      const cells = Math.ceil((sd + dmn) / 7) * 7;
      const dys = [];
      for (let i = 0; i < cells; i++) {
        const nn = i - sd + 1;
        if (nn < 1 || nn > dmn) { dys.push({ isDay: false, isBlank: true, num: '', aria: '', pressed: 'false', pick: () => {}, style: '' }); continue; }
        const sel = cp && cp.m === m && cp.d === nn && cp.y === y;
        const isTd = y === today.getFullYear() && m === today.getMonth() && nn === today.getDate();
        const dt = new Date(y, m, nn);
        dys.push({
          isDay: true, isBlank: false, num: String(nn), aria: MONTH_NAMES[m] + ' ' + nn + (isTd ? ', today' : ''), pressed: sel ? 'true' : 'false',
          pick: () => setField(r, k, MONTHS[m] + ' ' + nn, { iso: isoOf(dt) }),
          style: 'width: 36px; height: 36px; border: 0; border-radius: 10px; font-size: 13px; font-variant-numeric: tabular-nums; letter-spacing: normal; cursor: pointer; ' + (sel ? 'background: var(--inv); color: var(--inv-ink); font-weight: 700;' : isTd ? 'background: transparent; color: var(--ink); font-weight: 700; box-shadow: inset 0 0 0 1.5px var(--ink);' : 'background: transparent; color: var(--ink-2); font-weight: 500;')
        });
      }
      ce.cal = { label: MONTH_NAMES[m] + ' ' + y, weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], days: dys, prev: () => { const x = shiftMonth(y, m, -1); set({ ceMonth: x.m, ceYear: x.y }); }, next: () => { const x = shiftMonth(y, m, 1); set({ ceMonth: x.m, ceYear: x.y }); } };
      ce.quick = [['Today', 0], ['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map((x) => { const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + x[1]); return { label: x[0], pick: () => setField(r, k, MONTHS[dt.getMonth()] + ' ' + dt.getDate(), { iso: isoOf(dt) }) }; });
      ce.quickStyle = 'min-height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--ink-2); font-size: 12px; font-weight: 600; cursor: pointer;';
      ce.navBtn = 'width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';
      ce.hasClear = !!curV;
      ce.clearLabel = 'Clear date';
    } else {
      ce.isText = true;
      const fk = k === 'link' ? 'linkUrl' : k;
      ce.text = s.ceText == null ? curV : s.ceText;
      ce.placeholder = k === 'link' ? 'Paste a draft or YouTube URL' : 'Type a value';
      ce.onText = (e) => set({ ceText: e && e.target ? e.target.value : '' });
      const save = (val) => setField(r, fk, String(val == null ? (s.ceText || '') : val).trim());
      ce.save = () => save();
      ce.onTextKey = (e) => { if (e && e.key === 'Enter') { if (e.preventDefault) e.preventDefault(); save(e.target ? e.target.value : null); } else if (e && e.key === 'Escape') close(); };
      const lt = k === 'link' ? linkFor(r) : '';
      ce.hasOpen = !!lt && !!r.linkUrl;
      ce.openText = lt;
      ce.openHref = r.linkUrl || '';
      ce.openStyle = 'display: inline-flex; align-items: center; gap: 6px; min-height: 36px; color: var(--link); font-size: 14px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px;';
      ce.hasClear = !!curV;
      ce.clearLabel = k === 'link' ? 'Remove link' : 'Clear';
    }
    ce.clear = () => setField(r, k === 'link' ? 'linkUrl' : k, '');
    ce.clearStyle = 'min-height: 36px; width: 100%; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; color: var(--red-ink); font-size: 13px; font-weight: 600; text-align: left; cursor: pointer;';
  }

  // ---------- New project (app addition, styled like the design's Add account dialog) ----------
  const np = {
    open: !!s.npOpen,
    close: () => set({ npOpen: false, npErr: '' }),
    title: s.npTitle || '', job: s.npJob || '', film: s.npFilm || '', pub: s.npPub || '',
    onTitle: (e) => set({ npTitle: e.target.value }), onJob: (e) => set({ npJob: e.target.value.toUpperCase() }),
    onFilm: (e) => set({ npFilm: e.target.value }), onPub: (e) => set({ npPub: e.target.value }),
    err: s.npErr || '', hasErr: !!s.npErr,
    create: () => {
      const title = (s.npTitle || '').trim();
      const job = (s.npJob || '').trim();
      if (!title) return set({ npErr: 'Give the project a title.' });
      if (!job) return set({ npErr: 'Enter a job number.' });
      if (D.rows.some((x) => x.job.toLowerCase() === job.toLowerCase())) return set({ npErr: 'That job number is already in use.' });
      const tpl = D.templates.find((t) => t.id === s.npTemplate) || null;
      const typeLabel = s.npType || (tpl ? (D.types.find((t) => t.id === tpl.content_type_id) || {}).label : '') || (D.types[0] || {}).label;
      A.createProject({
        title: title, job: job,
        channel: s.npChannel || (D.channels[0] || {}).name, type: typeLabel, status: s.npStatus || (D.statuses[0] || {}).label,
        film: s.npFilm || null, pub: s.npPub || null, sponsor: s.npSponsor || '', template: tpl
      }).then((created) => { if (created) set({ npOpen: false, npErr: '', openJob: job, dTab: 'overview' }); })
        .catch((err) => set({ npErr: err.message }));
    }
  };

  const ddOpenKey = s.ddOpen || '';
  const mkDD = (key, list, onChange, variant, label, align) => {
    const isOpen = ddOpenKey === key;
    const L = list || [];
    const curO = L.find((o) => o.on) || L[0] || { label: '' };
    const field = variant === 'field';
    return {
      open: isOpen, exp: isOpen ? 'true' : 'false', value: curO.label, label: label, aria: label + ': ' + curO.label,
      wrap: 'position: relative;' + (field ? ' width: 100%;' : '') + (isOpen ? ' z-index: 60;' : ''),
      toggle: () => set({ ddOpen: isOpen ? '' : key }), close: () => set({ ddOpen: '' }),
      onKey: (e) => { if (e && e.key === 'Escape' && isOpen) set({ ddOpen: '' }); },
      btn: 'position: relative; z-index: 2; display: flex; align-items: center; gap: 8px; box-sizing: border-box; cursor: pointer; text-align: left; letter-spacing: normal; font-size: 14px; font-weight: 500; color: var(--ink); border-radius: 12px; border: 1px solid ' + (isOpen ? 'var(--ink)' : 'var(--border)') + '; ' + (field ? 'width: 100%; min-height: 44px; padding: 0 12px 0 14px; background: var(--surface-2);' : 'min-width: 150px; min-height: 40px; padding: 0 10px 0 12px; background: var(--surface);'),
      chev: 'flex: none; color: var(--muted-2); transition: transform .15s ease; transform: rotate(' + (isOpen ? '180' : '0') + 'deg);',
      pop: 'position: absolute; z-index: 1; top: calc(100% + 6px); ' + (align === 'right' ? 'right: 0;' : 'left: 0;') + ' min-width: 100%; width: max-content; max-width: 340px; max-height: 300px; overflow-y: auto; box-sizing: border-box; padding: 6px; display: flex; flex-direction: column; gap: 2px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.14);',
      items: L.map((o) => ({
        label: o.label, sel: o.on ? 'true' : 'false',
        pick: () => { set({ ddOpen: '' }); onChange({ target: { value: o.value } }); },
        style: 'min-height: 40px; width: 100%; box-sizing: border-box; padding: 0 12px 0 8px; border: 0; border-radius: 10px; display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer; white-space: nowrap; letter-spacing: normal; font-size: 14px; color: var(--ink); font-weight: ' + (o.on ? '600' : '500') + '; background: ' + (o.on ? 'var(--hover)' : 'transparent') + ';',
        check: 'width: 16px; height: 16px; flex: none; display: inline-flex; color: var(--ink); opacity: ' + (o.on ? '1' : '0') + ';'
      }))
    };
  };
  const opts = (list, cur2) => list.map((v) => ({ value: v[0], label: v[1], on: v[0] === cur2 }));
  const dd = {};
  dd.autoWhen = mkDD('autoWhen', AV.adm.triggers, AV.adm.onAutoWhen, 'field', 'When', 'left');
  dd.autoRet = mkDD('autoRet', AV.adm.retOpts, AV.adm.onRet, 'compact', 'Run history', 'right');
  dd.autoThen = mkDD('autoThen', AV.adm.outcomes, AV.adm.onAutoThen, 'field', 'Then', 'left');
  dd.wsTz = mkDD('wsTz', AV.adm.ws.tzs, AV.adm.ws.onTz, 'field', 'Time zone', 'left');
  dd.wsView = mkDD('wsView', AV.adm.ws.views, AV.adm.ws.onView, 'field', 'Default board view', 'left');
  dd.wsNewStage = mkDD('wsNewStage', AV.adm.ws.stages, AV.adm.ws.onNewStage, 'field', 'Stage', 'left');
  dd.wsNewFtype = mkDD('wsNewFtype', AV.adm.ws.ftypes, AV.adm.ws.onNewFType, 'field', 'Type', 'left');
  dd.ctChannel = mkDD('ctChannel', PV.ct.channels, PV.ct.onChannel, 'compact', 'Channel', 'right');
  dd.ideaBrand = mkDD('ideaBrand', IV.ids.brandOpts, IV.ids.onBrand, 'compact', 'Brand', 'right');
  dd.ideaType = mkDD('ideaType', IV.ids.typeOpts2, IV.ids.onType, 'compact', 'Type', 'right');
  dd.ideaSetStatus = mkDD('ideaSetStatus', IV.ids.sel.statusOpts, IV.ids.sel.onStatus, 'compact', 'Status', 'right');
  dd.ideaEditType = mkDD('ideaEditType', IV.ids.sel.typeOpts, IV.ids.sel.onEditType, 'field', 'Type', 'left');
  dd.niBrand = mkDD('niBrand', IV.ids.newBrandOpts, IV.ids.onNewBrand, 'field', 'Brand', 'left');
  dd.niType = mkDD('niType', IV.ids.newTypeOpts, IV.ids.onNewType, 'field', 'Type', 'left');
  dd.pfView = mkDD('pfView', PV.pf.views, PV.pf.onView, 'compact', 'Default board view', 'right');
  dd.nuAcct = mkDD('nuAcct', D.accounts.map((a) => ({ value: a.id, label: a.name + (a.type === 'client' ? ' (client)' : ' (sponsor)'), on: a.id === nuAcctId })), (e) => set({ nuAcct: e.target.value }), 'field', 'Account', 'left');
  dd.acct = mkDD('acct', me.accounts.map((a) => ({ value: a.id, label: a.name, on: !!acct && a.id === acct.id })), (e) => A.switchAccount(e.target.value), 'field', 'Account', 'left');
  const tplName = (t) => t.name + ' · ' + ((D.types.find((x) => x.id === t.content_type_id) || {}).label || '');
  dd.npTemplate = mkDD('npTemplate', [{ value: '', label: 'No template', on: !s.npTemplate }].concat(D.templates.map((t) => ({ value: t.id, label: tplName(t), on: s.npTemplate === t.id }))), (e) => {
    const t = D.templates.find((x) => x.id === e.target.value);
    set({ npTemplate: e.target.value, npType: t ? ((D.types.find((x) => x.id === t.content_type_id) || {}).label || '') : s.npType });
  }, 'field', 'Template', 'left');
  dd.npChannel = mkDD('npChannel', opts(D.channels.map((x) => [x.name, x.name]), s.npChannel || (D.channels[0] || {}).name), (e) => set({ npChannel: e.target.value }), 'field', 'Channel', 'left');
  dd.npType = mkDD('npType', opts(D.types.map((x) => [x.label, x.label]), s.npType || (D.types[0] || {}).label), (e) => set({ npType: e.target.value }), 'field', 'Content type', 'left');
  dd.npStatus = mkDD('npStatus', opts(D.statuses.map((x) => [x.label, x.label]), s.npStatus || (D.statuses[0] || {}).label), (e) => set({ npStatus: e.target.value }), 'field', 'Status', 'left');
  dd.npSponsor = mkDD('npSponsor', opts([['', 'No sponsor']].concat(D.accounts.filter((a) => a.type === 'sponsor').map((a) => [a.name, a.name])), s.npSponsor || ''), (e) => set({ npSponsor: e.target.value }), 'field', 'Sponsor', 'left');

  const months = (d) => MONTH_NAMES[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  return {
    dd: dd,
    ce: ce, np: np,
    closeCell: () => set({ cellEdit: null, ceText: '' }),
    tableFade: tableMin > 1100, tableScroll: 'overflow-x: auto; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; padding-bottom: ' + (CE && groups.filter((g) => g.open && g.rows.length).slice(-1).some((g) => g.rows.some((x) => x.cells.some((y) => y.editing))) ? 420 : 8) + 'px;',
    drawerOpen: !!cur,
    dr: dr,
    closeDrawer: () => set({ openJob: '', draft: '' }),
    dIconBtn: 'width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;',
    dH3: 'margin: 0; font-family: var(--font-title); font-size: var(--text-h6); font-weight: var(--weight-black); letter-spacing: -0.01em; color: var(--ink);',
    dTile: 'width: 40px; height: 40px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-3);',
    dLink: 'flex: none; display: inline-flex; align-items: center; min-height: 40px; padding: 0 12px; border-radius: 10px; color: var(--link); font-size: 13px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px;',
    internalPill: 'display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 999px; background: var(--chip-2); color: var(--ink-3); font-size: 11px; font-weight: 600;',
    titleBtn: 'flex: 1; min-width: 0; align-self: stretch; display: flex; align-items: center; padding: 0; border: 0; background: transparent; color: var(--ink); font-size: var(--text-body-sm); font-weight: 600; letter-spacing: normal; line-height: 1.3; text-align: left; cursor: pointer;',
    cardTitleBtn: 'display: block; width: 100%; padding: 0; border: 0; background: transparent; color: var(--ink); font-size: 15px; font-weight: 600; letter-spacing: normal; line-height: 1.35; text-align: left; cursor: pointer;',
    listTitleBtn: 'flex: 1 1 260px; min-width: 0; min-height: 40px; display: flex; align-items: center; padding: 0; border: 0; background: transparent; color: var(--ink); font-size: var(--text-body-sm); font-weight: 600; letter-spacing: normal; line-height: 1.35; text-align: left; cursor: pointer;',
    showAdmin: !!adminPage,
    showBoard: !adminPage && !userPage,
    isDaily: userPage === 'daily',
    showPage: !!userPage && userPage !== 'daily',
    ids: IV.ids, boardTitle: isSponsorRole ? 'My Projects' : 'Projects',
    chat: PV.chat, pg: PV.pg, inbox: PV.nt, lib: PV.ct, br: PV.br, pf: PV.pf,
    openSettings: () => set({ nav: 'settings', openJob: '' }),
    acctCurrent: s.nav === 'settings' ? 'page' : 'false',
    acctInitial: (me.name || '?').slice(0, 1).toUpperCase(),
    hasAcctSwitch: isSponsorRole && me.accounts.length > 1,
    adm: AV.adm, ap: AV.ap, ui: AV.ui,
    adminNav: adminNav, adminShown: adminShown, adminExp: adminShown ? 'true' : 'false',
    toggleAdmin: () => set({ adminOpen: !adminShown }),
    adminChev: 'transition: transform 160ms ease; transform: rotate(' + (adminShown ? '180' : '0') + 'deg);', hasAdminNav: adminNav.length > 0,
    teamTabs: teamTabs,
    teamRows: teamRows,
    teamEmpty: teamRows.length === 0,
    onTeamSearch: (e) => set({ teamQ: e && e.target ? e.target.value : '' }),
    teamHeadStyle: TEAMCOLS + ' min-height: 44px;',
    teamRowStyle: TEAMCOLS + ' min-height: 68px; border-top: 1px solid var(--line);',
    thStyle: 'padding: 0 16px; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2);',
    viewChip: 'display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border-radius: 999px; background: var(--chip-2); color: var(--ink-3); font-size: 12px; font-weight: 600;',
    teamModal: !!s.teamModal,
    openAddUser: openAddUser,
    closeAddUser: () => set({ teamModal: false, nuErr: '' }),
    onNuName: (e) => set({ nuName: e && e.target ? e.target.value : '' }),
    onNuEmail: (e) => set({ nuEmail: e && e.target ? e.target.value : '' }),
    nuTypes: nuTypes, nuIsExternal: nuType === 'sponsor',
    nuViewItems: nuViewItems,
    nuErr: s.nuErr || '',
    hasNuErr: !!s.nuErr,
    addMember: addMember,
    fieldLabel: 'margin: 0; font-size: 13px; font-weight: 600; color: var(--ink-2);',
    fieldInput: 'width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-size: 14px; color: var(--ink);',
    navItems: navItems,
    savedViews: savedViews,
    navLabel: s.panel ? 'min-width: 0; overflow: hidden; text-overflow: ellipsis;' : 'display: none;',
    sideStyle: 'flex: none; width: ' + (s.panel ? 284 : 76) + 'px; box-sizing: border-box; border-right: 1px solid var(--line); border-radius: 28px 0 0 28px; background: var(--surface-2); transition: width .18s ease;',
    sideHead: 'display: flex; align-items: center; gap: 12px; box-sizing: border-box; ' + (s.panel ? 'padding: 20px 10px 20px 18px;' : 'flex-direction: column; padding: 18px 0 14px;'),
    collapseBtn: 'width: 36px; height: 36px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;',
    collapseChev: s.panel ? 'M10 15l-3-3 3-3' : 'M8 9l3 3-3 3',
    acctStyle: s.nav === 'settings' ? navOn : navOff,
    panelClosed: !s.panel,
    rootStyle: rootStyle,
    tileStyle: 'width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--inv); color: var(--inv-ink);',
    panelOpen: !!s.panel,
    panelPressed: s.panel ? 'true' : 'false',
    panelToggleLabel: s.panel ? 'Collapse sidebar' : 'Expand sidebar',
    togglePanel: () => { set({ panel: !s.panel }); A.savePrefs({ panel: !s.panel }); },
    wsName: D.ws.name, wsSub: isSponsorRole ? (acctName || 'Client portal') : 'Production board',
    todayFull: months(today), todayLong: WEEKDAYS_LONG[today.getDay()] + ', ' + MONTH_NAMES[today.getMonth()] + ' ' + today.getDate(),
    toast: s.toast || '', hasToast: !!s.toast,
    share: () => { try { navigator.clipboard.writeText(window.location.href); } catch (e) {} A.toast('Link copied'); },
    newProject: openNew({}),

    pipeline: pipeline,
    onSearch: (e) => set({ q: e && e.target ? e.target.value : '' }),
    groups: groups,
    canEdit: canEdit && can('projects', 'create'),
    readOnly: isSponsorRole,
    tableWrapStyle: 'min-width: ' + tableMin + 'px;',

    vbtn: vbtn, vpick: vpick, vp: vp, vshow: vshow,
    isTable: curView === 'table', isKanban: curView === 'kanban', isList: curView === 'list', isTimeline: curView === 'timeline', isCalendar: curView === 'calendar',

    menus: menus, ex: ex, open: open, tool: tool,
    menuOpen: !!s.menu,
    closeMenu: () => set({ menu: '' }),
    popStyle: popBase + ' left: 0;',
    popStyleRight: popBase + ' right: 0;',
    popStyleActivity: popBase + ' right: 0; width: 360px;',
    addItem: itemStyle(false) + ' color: var(--ink); font-weight: 600;',
    openPersonModal: () => set({ menu: '', modal: 'person', mq: '' }),
    modalOpen: !!s.modal,
    isPersonModal: s.modal === 'person',
    isColumnModal: s.modal === 'column',
    modalTitleId: s.modal === 'column' ? 'column-modal-title' : 'person-modal-title',
    closeModal: () => set({ modal: '' }),
    onModalSearch: (e) => set({ mq: e && e.target ? e.target.value : '' }),
    dirList: dirList,
    dirEmpty: dirList.length === 0,
    inviteFromModal: () => { set({ modal: '' }); if (isAdmin) { set({ nav: 'team' }); openAddUser(); } else A.toast('Ask a Super Admin to invite new people.'); },
    onColName: (e) => set({ newColName: e && e.target ? e.target.value : '' }),
    colTypesBasic: colTypesBasic,
    colTypesAdv: colTypesAdv,
    ctStyle: 'min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border: 0; border-radius: 12px; background: transparent; text-align: left; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--ink);',
    secStyle: 'margin: 0; padding: 8px 10px 4px; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2);',
    plainItem: itemStyle(false) + ' padding-left: 36px;',
    countBadge: 'display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;',

    showPerson: !isSponsorRole,
    personItems: personItems,
    personActive: usePerson,
    personName: s.person,

    hasTypeF: has('type'), hasChannelF: has('channel'), hasStatusF: has('status'),
    typeItems: typeItems, channelItems: channelItems, statusItems: statusItems,
    filterActive: filterCount > 0, filterCount: filterCount,
    clearFilters: () => set({ ftype: {}, fchannel: {}, fstatus: {}, person: 'All' }),

    sortItems: sortItems, sortActive: sortId !== 'default', sortLabel: sortLabelMap[sortId],
    colItems: colItems, colPresets: colPresets, hasPresets: colPresets.length > 0,
    viewOpen: !!s.viewBar, viewExp: s.viewBar ? 'true' : 'false', toggleViewBar: () => set({ viewBar: !s.viewBar, menu: '' }),
    viewBtn: toolStyle(!!s.viewBar || viewN > 0), viewActive: viewN > 0, viewCount: String(viewN),
    viewChev: 'transition: transform 160ms ease; transform: rotate(' + (s.viewBar ? '180' : '0') + 'deg);', colsActive: hiddenCount > 0, hiddenText: hiddenCount + ' hidden',
    showAllCols: () => { const h = Object.assign({}, hidden); roleCols.forEach((k) => { delete h[hk(k)]; }); set({ hidden: h }); },
    groupItems: groupItems, groupLabel: (gbOpts.find((o) => o.id === gb) || gbOpts[0]).label,
    densityItems: densityItems,
    collapseAll: () => set({ closed: Object.assign({}, closed, allGroupKeys), menu: '' }),
    expandAll: () => { const c2 = Object.assign({}, closed); Object.keys(allGroupKeys).forEach((k) => { delete c2[k]; }); set({ closed: c2, menu: '' }); },
    viewAllActivity: (e) => { if (e && e.preventDefault) e.preventDefault(); set({ menu: '', nav: isAdmin ? 'logs' : 'alerts', naTab: 'activity' }); },

    showTodos: !isSponsorRole,
    toggleTodos: () => set({ todos: !s.todos, menu: '' }),
    todosPressed: s.todos ? 'true' : 'false',
    todosOpen: s.todos && !isSponsorRole,
    todoBadge: 'display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;',
    pendingCount: pending,
    pendingText: pending + ' pending',
    tasks: tasks,
    newTask: s.newTask || '', onNewTask: (e) => set({ newTask: e.target.value }),
    addTask: (e) => { if (e && e.key && e.key !== 'Enter') return; const t = (s.newTask || '').trim(); if (!t) return; set({ newTask: '' }); A.addTask(t); },

    showActivity: !isSponsorRole,
    activityItems: activityItems,
    noActivity: activityItems.length === 0,
    activityCount: freshCount,
    activityBadge: 'display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;',

    tl: tl, tlNote: tlNote, tlTitle: tlTitle,
    cal: cal,
    prevMonth: () => { const x = shiftMonth(calY, calM, -1); set({ calMonth: x.m, calYear: x.y }); },
    nextMonth: () => { const x = shiftMonth(calY, calM, 1); set({ calMonth: x.m, calYear: x.y }); },
    goToday: () => set({ calMonth: today.getMonth(), calYear: today.getFullYear() })
  };
}
