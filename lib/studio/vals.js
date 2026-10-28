// Board, drawer, cell editor and app shell. Ported from the design's renderVals(); the role comes from
// the signed-in member, not a preview switcher, and every write goes through lib/studio/actions.js.
import { ideasVals } from './vals-ideas';
import { pagesVals } from './vals-pages';
import { adminVals } from './vals-admin';
import { recordVals, openers } from './vals-records';
import { withSyncPicker, syncPickVals } from './vals-sync';
import { TONE, DARKFILL, toneOf } from './tones';
import { popAlign, chipStyle } from './prims';
import { compileFormula, FORMULA_FUNCTIONS } from './formula';
import { pickMedia } from '../integrations/providers/buffer-post';
import { actionsOf, triggerOf, triggerText } from '../automations/catalog';
import {
  MONTHS, MONTH_NAMES, WEEKDAYS_LONG, UI_ROLE, DB_ROLES, FIELD_TYPE_L, startOfDay, isoOf, dateOfIso, dateOfLabel, relTime, labelOf, paletteColor, first, isImageFile,
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
  link: { label: 'URL', w: 176, kind: 'link' }
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
// Columns a role sees before choosing any in View. The full board has every field, so it starts on the essentials.
const DEF_COLS = { admin: ['project', 'job', 'channel', 'type', 'status', 'pub', 'link'] };
export const DEF_VIEWS = { admin: ['table', 'kanban', 'list', 'timeline', 'calendar'], editor: ['table', 'kanban', 'list', 'timeline'], sponsor: ['table', 'calendar'], designer: ['table', 'kanban', 'calendar'] };

// Column types for the Add a column modal and the header menu: [label, 16px icon path, 'b' basic | 'a' advanced].
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

export function computeVals({ s, set, D, A: rawA, me, now }) {
  const A = withSyncPicker(rawA, set);
  const settings = D.settings || {};
  const accent = settings.accent || '#16FFDE';
  const theme = s.theme || 'light';
  const dark = theme === 'dark';
  const density = s.density || 'Comfortable';
  const compact = density === 'Compact';
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

  const statusTone = {};
  D.statuses.forEach((x) => { statusTone[x.label] = TONE[x.color_token] ? x.color_token : 'gray'; });
  const PILL = {
    editStatus: { 'Assigned': 'amber', 'Editing': 'blue', 'Needs Revision': 'red', 'In Review': 'violet', 'Approved': 'green' },
    thumb: { 'Not Started': 'gray', 'In Design': 'amber', 'Needs Revision': 'red', 'In Review': 'violet', 'Done': 'green' },
    approval: { 'Pending': 'amber', 'Approved': 'green', 'Changes Requested': 'red' },
    status: statusTone
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
  // A built-in date on a row: the stored ISO day while the label still matches it (an optimistic edit changes only the
  // label until the reload), else the label read as the nearest date.
  const parseAt = (r, k) => {
    const iso = r && r.iso && r.iso[k];
    if (iso && labelOf(iso) === r[k]) { const d = dateOfIso(iso); return { m: d.getMonth(), d: d.getDate(), y: d.getFullYear(), date: d }; }
    return parse(r && r[k]);
  };
  const diAt = (r, k) => { const p = parseAt(r, k); if (!p) return null; return Math.round((startOfDay(p.date) - BASE) / 86400000); };
  // Workspace Settings > General > Week starts on (workspace_settings.week_start).
  const WEEK0 = settings.week_start === 'mon' ? 1 : 0;
  const lead = (y, m) => (new Date(y, m, 1).getDay() - WEEK0 + 7) % 7;
  const rotate = (list) => list.slice(WEEK0).concat(list.slice(0, WEEK0));
  const TODAY = Math.round((today - BASE) / 86400000);
  const linkFor = (r) => {
    if (r.linkUrl) return 'Open link';
    if (r.editStatus === 'In Review' || r.editStatus === 'Needs Revision' || r.status === 'Sponsor Review' || r.status === 'Scheduled') return 'Review draft';
    return '';
  };
  // Property settings from the Edit property sheet: custom columns keep them in custom_fields.config, built-in
  // columns in workspace_settings.column_config.
  const confOf = (k) => (COLS[k] ? (settings.column_config || {})[k] : (D.customFields.find((f) => f.id === k) || {}).config) || {};
  // Due colors (late red, today amber): on by default for the edit and thumbnail deadlines, as before.
  const DUE_DEFAULT = { editDue: true, thumbDue: true };
  const dueOn = (k) => { const c = confOf(k); return c.due_colors === undefined ? !!DUE_DEFAULT[k] : !!c.due_colors; };
  const isoDate = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  // Custom date values: "2026-10-28", "2026-10-28T14:30", or a range "start/end".
  const dateVal = (v) => {
    const parts = String(v || '').split('/');
    const one = (x) => { const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(x || ''); return m ? { d: new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)), time: !!m[4] } : null; };
    return { start: one(parts[0]), end: parts[1] ? one(parts[1]) : null };
  };
  const clock = (d) => { const h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };
  const showDateVal = (v, mode) => {
    const x = dateVal(v);
    const one = (p) => (p ? fmtDate(p.d, mode) + (p.time ? ', ' + clock(p.d) : '') : '');
    return x.start ? one(x.start) + (x.end ? ' → ' + one(x.end) : '') : '';
  };
  const dueOfDate = (d) => { if (!d) return 'normal'; const n = Math.round((startOfDay(d) - today) / 86400000); return n < 0 ? 'late' : n === 0 ? 'today' : 'normal'; };
  const fmtDate = (d, mode) => {
    if (!d) return '';
    if (mode === 'us') return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
    if (mode === 'iso') return isoOf(d);
    if (mode === 'full') return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    if (mode === 'relative') {
      const n = Math.round((startOfDay(d) - today) / 86400000);
      return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n > 0 ? 'In ' + n + ' days' : -n + ' days ago';
    }
    return MONTHS[d.getMonth()] + ' ' + d.getDate();
  };
  const DATE_FMT = ['short', 'full', 'us', 'iso', 'relative'];
  const dateChipStyle = (st) => 'padding: 5px 10px; border-radius: 999px; white-space: nowrap; font-size: 13px; font-variant-numeric: tabular-nums;' +
    (st === 'late' ? ' background: var(--red-soft); color: var(--red-ink); font-weight: 600;' : st === 'today' ? ' background: var(--amber-soft); color: var(--amber-ink); font-weight: 600;' : ' color: var(--ink-2b);');
  const NUM_FMT = [['number', 'Number'], ['comma', 'Number with commas'], ['usd', 'US Dollar'], ['eur', 'Euro'], ['percent', 'Percent']];
  const toNum = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(/[$€,%\s]/g, '')); return isNaN(n) ? null : n; };
  const fmtNum = (n, c) => {
    if (n == null) return '';
    const f = c.number_format || 'number';
    const money = f === 'usd' || f === 'eur';
    const dec = c.decimals == null ? null : c.decimals;
    const o = { minimumFractionDigits: dec == null ? (money ? 2 : 0) : dec, maximumFractionDigits: dec == null ? 2 : dec, useGrouping: f !== 'number' };
    if (money) { o.style = 'currency'; o.currency = f === 'usd' ? 'USD' : 'EUR'; }
    return n.toLocaleString('en-US', o) + (f === 'percent' ? '%' : '');
  };
  // A number cell: the value, or a bar or ring that reads it as a percent of 100.
  const numChips = (n, c) => {
    const txt = { text: fmtNum(n, c), style: 'font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink-2); white-space: nowrap;' };
    const pct = Math.max(0, Math.min(100, n || 0));
    if (c.show_as === 'bar') return [{ text: '', style: 'flex: 1; min-width: 32px; height: 6px; border-radius: 999px; background: linear-gradient(to right, var(--ink) ' + pct + '%, var(--line-3) ' + pct + '%);' }, Object.assign({}, txt, { style: txt.style + ' font-size: 12px;' })];
    if (c.show_as === 'ring') return [{ text: '', style: 'width: 18px; height: 18px; flex: none; border-radius: 999px; background: radial-gradient(closest-side, var(--surface) 62%, transparent 66% 100%), conic-gradient(var(--ink) ' + pct + '%, var(--line-3) 0);' }, Object.assign({}, txt, { style: txt.style + ' font-size: 12px;' })];
    return [txt];
  };
  const CALC = [['none', 'None'], ['sum', 'Sum'], ['avg', 'Average'], ['min', 'Min'], ['max', 'Max'], ['count', 'Count']];
  const dueState = (k, r) => {
    if (!dueOn(k)) return 'normal';
    const done = (k === 'editDue' && r.editStatus === 'Approved') || (k === 'thumbDue' && r.thumb === 'Done') || (k === 'pub' && r.status === 'Live');
    if (done) return 'normal';
    if (!COLS[k]) return dueOfDate(isoDate(r[k]));
    const n = diAt(r, k);
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
    if (isSponsorRole) return ((portal[r.id] || {}).comments || []).map((c) => ({ who: c.author_id === me.id ? 'You' : ((c.author_role === 'sponsor' || c.author_role === 'client') ? (D.directory.find((p) => p.id === c.author_id) || {}).account || c.author_label : c.author_label), roleTag: ROLE_TAG[c.author_role] || 'Team', time: relTime(c.created_at, now), text: c.body, internal: false, files: c.attachments || [] }));
    const att = (D.assets[r.id] || []).filter((a) => a.comment_id);
    return (D.comments[r.id] || []).map((c) => ({ id: c.id, raw: c, pending: !!c.pending, edited: !!c.updated_at && new Date(c.updated_at) - new Date(c.created_at) > 2000, who: c.author_id === me.id ? 'You' : D.authorLabel(c.author_id), roleTag: ROLE_TAG[(personOf(c.author_id) || {}).role] || 'Team', time: relTime(c.created_at, now), text: c.text || c.body, internal: c.internal, files: c.pending || att.filter((a) => a.comment_id === c.id) }));
  };
  // Super Admins can bring archived projects back onto the board (More menu) to restore or delete them.
  const showArchived = s.role === 'admin' && !!s.showArchived;
  const allRows = D.rows.filter((r) => showArchived || !r.archived).map((r) => Object.assign({}, r, { updates: r.commentCount }));
  const catalogRows = D.rows.filter((r) => r.archived && r.status === 'Live');
  const jobRow = {};
  allRows.forEach((r) => { jobRow[r.job] = r; });
  const openRow = (job) => () => set({ openJob: job, dTab: 'overview', draft: '', dInternal: false, menu: '' });
  const openJob = s.openJob || '';
  const roleFilter = (r) => !isSponsorRole || r.sponsor === acctName || r.channel === acctName;

  // Custom columns: each internal role sees the ones whose Visible to includes it (custom_fields.visible_roles).
  const customCols = isSponsorRole ? [] : D.customFields.filter((f) => f.on_board && (s.role === 'admin' || (f.visible_roles || []).indexOf(dbFor(s.role)) >= 0));
  // Custom values that store ids (Person, Relation) or objects (Files) show as names, and Formula columns compute per
  // row; r[id] is the display text (search, sort, cards) and r.cf[id] the value.
  const kindOf = (f) => (f ? (f.config || {}).kind || f.type : '');
  const nameById = {};
  D.directory.forEach((p) => { nameById[p.id] = p.name; });
  const titleById = {};
  D.rows.forEach((x) => { titleById[x.id] = x.title; });
  const listOf = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
  const formulaCols = customCols.filter((f) => kindOf(f) === 'formula');
  const compiled = {};
  formulaCols.forEach((f) => { compiled[f.id] = compileFormula((f.config || {}).formula || ''); });
  // prop("Column") for formulas: dates as Date, numbers as numbers, checkboxes as true or false, the rest as text.
  const propOf = (r) => (name) => {
    const k = Object.keys(COLS).find((x) => COLS[x].label === name);
    if (k) {
      if (k === 'project') return r.title;
      if (k === 'link') return r.linkUrl || '';
      if (COLS[k].kind === 'date') { const pd = parseAt(r, k); return pd ? pd.date : null; }
      return r[k] || '';
    }
    const f = D.customFields.find((x) => x.label === name);
    if (!f) return undefined;
    const raw = (r.cf || {})[f.id];
    if (kindOf(f) === 'formula') return null;
    if (f.type === 'number') return toNum(raw);
    if (f.type === 'date') return isoDate(raw);
    if (f.type === 'checkbox') return !!raw;
    return r[f.id] || '';
  };
  const showFormula = (v) => (v instanceof Date ? fmtDate(v, 'full') : typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v == null ? '' : String(v));
  allRows.forEach((r) => {
    const cf = Object.assign({}, r.cf);
    customCols.forEach((f) => {
      const kd = kindOf(f);
      // System columns: their values come from the project, never from a stored cell.
      if (kd === 'created_time') { cf[f.id] = r.createdAt || null; r[f.id] = r.createdAt ? new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; }
      else if (kd === 'last_edited_by') { cf[f.id] = r.lastEditedById || null; r[f.id] = r.lastEditedById ? nameById[r.lastEditedById] || 'Former member' : ''; }
      else if (kd === 'person') r[f.id] = listOf(cf[f.id]).map((id) => nameById[id] || 'Former member').join(', ');
      else if (kd === 'relation') r[f.id] = listOf(cf[f.id]).map((id) => titleById[id]).filter(Boolean).join(', ');
      else if (kd === 'files') r[f.id] = listOf(cf[f.id]).map((x) => x && x.name).filter(Boolean).join(', ');
      else if (kd === 'checkbox') r[f.id] = cf[f.id] ? 'Yes' : '';
    });
    formulaCols.forEach((f) => {
      const res = compiled[f.id].run(propOf(r), now);
      cf[f.id] = res.error ? null : res.value instanceof Date ? isoOf(res.value) : res.value;
      r[f.id] = res.error ? '' : showFormula(res.value);
      r.fx = Object.assign({}, r.fx, { [f.id]: res.error || '' });
    });
    r.cf = cf;
  });
  const roleCols = role.cols;
  const hk = (k) => s.role + ':' + k;
  // This member's own view of the board role and view kind (board_view_state): hidden columns, order, widths, frozen
  // and wrapped columns, sort and group by. Changes show at once from s.vs and save in the background.
  const vsKey = s.role + ':' + curView;
  const vsSaved = (D.viewStates || []).find((x) => x.board_role === dbFor(s.role) && x.view === curView);
  // A role's starting view ("Save for <role> view", role_board_config.view_state) applies until the member changes theirs.
  const roleView = ((cfgOf(dbFor(s.role)).view_state || {})[curView]) || null;
  const VS = (s.vs || {})[vsKey] || (vsSaved && vsSaved.state) || roleView || {};
  const setView = (patch) => set((p) => {
    const cur = (p.vs || {})[vsKey] || (vsSaved && vsSaved.state) || roleView || {};
    const next = Object.assign({}, cur, patch);
    A.saveView(dbFor(s.role), curView, next);
    return { vs: Object.assign({}, p.vs, { [vsKey]: next }) };
  });
  // Layout (Properties.dc.html D): row height falls back to the member's density preference.
  const ROWH = { compact: 40, default: 52, tall: 72 };
  const rowHeight = ROWH[VS.rowHeight] ? VS.rowHeight : compact ? 'compact' : 'default';
  const H = ROWH[rowHeight];
  const freezeFirst = VS.freezeFirst !== false || !!VS.frozen;
  const calcOn = VS.calcRow !== false;
  const OPEN_IN = [['side', 'Side sheet'], ['center', 'Center'], ['full', 'Full page']];
  // Kanban cards open in the centered modal (docs/design/project-card/CardDetail.dc.html) unless the view picks otherwise.
  const openIn = OPEN_IN.some((x) => x[0] === VS.openIn) ? VS.openIn : curView === 'kanban' ? 'center' : 'side';
  const hidden = VS.hidden || {};
  // hidden holds explicit picks (true or false); unpicked columns follow the role's default set. Custom columns start shown.
  const defCols = DEF_COLS[s.role];
  const defHid = (k) => k !== 'project' && !!defCols && !!COLS[k] && defCols.indexOf(k) < 0;
  const isHid = (k) => k !== 'project' && (hk(k) in hidden ? !!hidden[hk(k)] : defHid(k));
  const visKeys = roleCols.filter((k) => !isHid(k));
  const vis = {};
  visKeys.forEach((k) => { vis[k] = true; });
  const has = (k) => roleCols.indexOf(k) >= 0;

  // ---------- Filters and sorts (docs/design/database-components/FilterSort.dc.html) ----------
  // Simple rules (the chips) all apply; one advanced filter adds Where / And / Or rows and groups. Both, and the
  // sorts, save per member and view. Operators depend on the column's type.
  const FKIND = { title: 'text', text: 'text', mono: 'text', pill: 'select', dot: 'select', date: 'date', person: 'person', link: 'text' };
  const propKind = (k) => {
    const f = customCols.find((x) => x.id === k);
    if (f) {
      const kd = kindOf(f);
      return kd === 'select' || kd === 'multi_select' ? 'select' : kd === 'person' || kd === 'last_edited_by' ? 'person' : kd === 'created_time' ? 'date' : kd === 'number' ? 'number' : kd === 'date' ? 'date' : kd === 'checkbox' ? 'checkbox' : kd === 'files' || kd === 'relation' ? 'presence' : 'text';
    }
    if (k === 'channel' || k === 'sponsor') return 'select';
    return COLS[k] ? FKIND[COLS[k].kind] || 'text' : null;
  };
  const OPS = {
    text: [['contains', 'contains'], ['not_contains', 'does not contain'], ['is', 'is'], ['is_not', 'is not'], ['starts', 'starts with'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
    select: [['any', 'is'], ['none', 'is not'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
    person: [['any', 'is'], ['none', 'is not'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
    date: [['is', 'is'], ['before', 'is before'], ['after', 'is after'], ['on_before', 'is on or before'], ['on_after', 'is on or after'], ['within', 'is within'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
    number: [['eq', '='], ['neq', '≠'], ['gt', '>'], ['lt', '<'], ['gte', '≥'], ['lte', '≤'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
    checkbox: [['checked', 'is checked'], ['unchecked', 'is not checked']],
    presence: [['not_empty', 'is not empty'], ['empty', 'is empty']]
  };
  const NO_VALUE = ['empty', 'not_empty', 'checked', 'unchecked'];
  const DATE_REL = [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['yesterday', 'Yesterday'], ['week_ago', 'One week ago'], ['week_ahead', 'One week from now']];
  const WITHIN = [['past_week', 'Past week'], ['past_month', 'Past month'], ['next_week', 'Next week'], ['next_2_weeks', 'Next 2 weeks'], ['next_month', 'Next month']];
  const dayPlus = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
  const REL_DAYS = { today: 0, tomorrow: 1, yesterday: -1, week_ago: -7, week_ahead: 7 };
  const RANGE = { past_week: [-7, 0], past_month: [-30, 0], next_week: [0, 7], next_2_weeks: [0, 14], next_month: [0, 30] };
  const dateTarget = (v) => (!v ? null : v.rel === 'exact' ? isoDate(v.date) : REL_DAYS[v.rel] !== undefined ? dayPlus(REL_DAYS[v.rel]) : null);
  const meName = nameById[me.id] || me.fullName || me.name;
  // A row's value for filtering: a list for select and person columns, a day for dates, a number, true or false, or text.
  const valOf = (r, k, pk) => {
    const f = customCols.find((x) => x.id === k);
    const raw = f ? (r.cf || {})[k] : undefined;
    if (pk === 'select' || pk === 'person') return f ? listOf(raw).map(String) : (r[k] ? [r[k]] : []);
    if (pk === 'date') { if (f) return isoDate(raw); const pd = parseAt(r, k); return pd ? startOfDay(pd.date) : null; }
    if (pk === 'number') return toNum(f ? raw : r[k]);
    if (pk === 'checkbox') return !!raw;
    if (pk === 'presence') return listOf(raw).length > 0;
    return String(k === 'project' ? r.title : k === 'link' ? r.linkUrl || '' : r[k] || '');
  };
  // Rules still missing a value let every row through, as in Notion.
  const ruleOk = (r, rule) => {
    const pk = propKind(rule.key);
    if (!pk) return true;
    const op = rule.op, val = rule.value;
    const v = valOf(r, rule.key, pk);
    const blank = v == null || v === '' || v === false || (Array.isArray(v) && !v.length);
    if (op === 'empty') return blank;
    if (op === 'not_empty') return !blank;
    if (op === 'checked') return v === true;
    if (op === 'unchecked') return !v;
    if (pk === 'select' || pk === 'person') {
      const custom = customCols.some((f) => f.id === rule.key);
      const want = (Array.isArray(val) ? val : []).map((x) => (x === '__me' ? (custom ? me.id : meName) : x));
      if (!want.length) return true;
      const hit = v.some((x) => want.indexOf(x) >= 0);
      return op === 'none' ? !hit : hit;
    }
    if (pk === 'text') {
      const w = String(val || '').toLowerCase();
      if (!w) return true;
      const t = v.toLowerCase();
      return op === 'contains' ? t.includes(w) : op === 'not_contains' ? !t.includes(w) : op === 'is' ? t === w : op === 'is_not' ? t !== w : op === 'starts' ? t.startsWith(w) : true;
    }
    if (pk === 'number') {
      const n = toNum(val);
      if (n == null) return true;
      if (v == null) return op === 'neq';
      return op === 'eq' ? v === n : op === 'neq' ? v !== n : op === 'gt' ? v > n : op === 'lt' ? v < n : op === 'gte' ? v >= n : v <= n;
    }
    if (pk === 'date') {
      if (op === 'within') {
        const rg = val && RANGE[val.range];
        if (!rg) return true;
        return !!v && v >= dayPlus(rg[0]) && v <= dayPlus(rg[1]);
      }
      const t = dateTarget(val);
      if (!t) return true;
      if (!v) return false;
      const a = v.getTime(), b = t.getTime();
      return op === 'is' ? a === b : op === 'before' ? a < b : op === 'after' ? a > b : op === 'on_before' ? a <= b : a >= b;
    }
    return true;
  };
  const FL = VS.filter && Array.isArray(VS.filter.rules) ? VS.filter.rules.filter((x) => propKind(x.key)) : [];
  const ADV = VS.advanced && Array.isArray(VS.advanced.items) && VS.advanced.items.length ? VS.advanced : null;
  const groupOk = (r, items, join) => {
    const res = items.map((it) => (it.group ? groupOk(r, it.rules || [], it.join || 'and') : ruleOk(r, it)));
    return !res.length || (join === 'or' ? res.some(Boolean) : res.every(Boolean));
  };
  const advRules = ADV ? ADV.items.reduce((a, it) => a.concat(it.group ? it.rules || [] : [it]), []) : [];
  const rulesCount = FL.length + advRules.length;
  const ruledKeys = {};
  FL.concat(advRules).forEach((x) => { ruledKeys[x.key] = true; });
  const usePerson = !isSponsorRole && s.person !== 'All';
  const q = (s.q || '').trim().toLowerCase();
  const scoped = allRows.filter(roleFilter);
  const filtered = scoped.filter((r) =>
    (!q || r.title.toLowerCase().includes(q) || r.job.toLowerCase().includes(q)) &&
    (!usePerson || r.editor === s.person || r.designer === s.person) &&
    FL.every((rule) => ruleOk(r, rule)) &&
    (!ADV || groupOk(r, ADV.items, ADV.join || 'and')));

  // Sorts run in order, empty values last. Older saved views kept one sort in VS.sort; read those as one rule.
  const legacySort = (x) => {
    if (!x || x === 'default') return [];
    const m = /^col:(.+):(asc|desc)$/.exec(x);
    return m ? [{ key: m[1], dir: m[2] }] : [{ key: x === 'title' ? 'project' : x, dir: 'asc' }];
  };
  const SORTS = (Array.isArray(VS.sorts) ? VS.sorts : legacySort(VS.sort)).filter((x) => x && (COLS[x.key] ? has(x.key) : customCols.some((f) => f.id === x.key)));
  const STATUS_IDX = {};
  D.statuses.forEach((x, i) => { STATUS_IDX[x.label] = i; });
  const sortVal = (k, r) => {
    const cc = COLS[k] ? null : customCols.find((f) => f.id === k);
    const v = k === 'project' ? r.title : k === 'link' ? (r.linkUrl || '') : r[k];
    if (v === '' || v == null) return null;
    if (k === 'status') return STATUS_IDX[v] === undefined ? 999 : STATUS_IDX[v];
    if (COLS[k] && COLS[k].kind === 'date') return diAt(r, k);
    if (cc && cc.type === 'date') { const d = isoDate((r.cf || {})[k] || v); return d ? d.getTime() : null; }
    if (cc && cc.type === 'number') { const n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isNaN(n) ? null : n; }
    return String(v).toLowerCase();
  };
  const sorted = filtered.slice();
  if (SORTS.length) {
    sorted.sort((a, b) => {
      for (const so of SORTS) {
        const x = sortVal(so.key, a), y = sortVal(so.key, b);
        if (x === null && y === null) continue;
        if (x === null || y === null) return x === null ? 1 : -1;
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
        if (c) return so.dir === 'desc' ? -c : c;
      }
      return 0;
    });
  }

  const isAdmin = s.role === 'admin';
  // Column order: Project first, then the saved order. Columns the saved order doesn't know yet go last.
  const WID = VS.widths || {};
  const WRAP = Object.assign({}, VS.wrap || {});
  const ordIdx = {};
  (VS.order || []).forEach((k, i) => { ordIdx[k] = i; });
  const byOrder = (keys) => keys.map((k, i) => [k, ordIdx[k] === undefined ? 10000 + i : ordIdx[k]]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  // Every column key in display order, hidden ones included: what a reorder saves.
  const allKeys = (has('project') ? ['project'] : []).concat(byOrder(roleCols.filter((k) => k !== 'project').concat(customCols.map((cc) => cc.id))));
  if (VS.wrapAll) allKeys.forEach((k) => { WRAP[k] = true; });
  const colDef = (k) => {
    const cc = COLS[k] ? null : customCols.find((x) => x.id === k);
    const d = cc ? { key: k, label: cc.label, w: 168, kind: 'custom', ftype: cc.type, field: cc } : Object.assign({ key: k }, COLS[k]);
    if (WID[k]) d.w = WID[k];
    return d;
  };
  const cols = allKeys.filter((k) => !isHid(k)).map(colDef)
    .concat(isAdmin ? [{ key: '__add', label: '', w: 64, kind: 'add' }] : []);
  // Freeze: Project is always pinned; "Freeze up to here" pins every column through the chosen one.
  // Freeze first column off: nothing is pinned, Project scrolls with the rest.
  const frozenIdx = Math.max(0, VS.frozen ? cols.findIndex((c) => c.key === VS.frozen) : 0);
  const UNPIN = ' position: relative; left: auto; box-shadow: none;';
  const lefts = [];
  cols.reduce((a, c) => { lefts.push(a); return a + c.w; }, 0);
  const FROZEN_EDGE = ' box-shadow: 6px 0 10px -8px rgba(0,0,0,0.28);';
  const stickyAt = (i, header) => (i === 0 || i > frozenIdx) ? '' : ' position: sticky; left: ' + lefts[i] + 'px; z-index: ' + (header ? 2 : 1) + '; background: ' + (header ? 'var(--surface)' : 'inherit') + ';' + (i === frozenIdx ? FROZEN_EDGE : '');
  // Widths read a --cw-<key> variable first so a resize drag can preview without re-rendering the board.
  const cw = (c) => 'var(--cw-' + c.key + ', ' + c.w + 'px)';
  const gridCols = cols.map((c) => c.key === 'project' && frozenIdx === 0 ? 'minmax(' + cw(c) + ', 1fr)' : cw(c)).join(' ');
  const tableMin = cols.reduce((a, c) => a + c.w, 0) + 20;
  const gridStyle = 'display: grid; grid-template-columns: ' + gridCols + ';';
  const anyWrap = cols.some((c) => WRAP[c.key]);
  const base = (anyWrap ? 'min-height: ' : 'height: ') + H + 'px; box-sizing: border-box; border-bottom: 1px solid ' + line + '; border-right: 1px solid ' + colLine + '; display: flex; align-items: center; min-width: 0; font-size: var(--text-body-sm);';
  const addHeadStyle = (last) => 'height: 44px; box-sizing: border-box; border-bottom: 1px solid ' + line + '; border-right: 1px solid ' + colLine + '; display: flex; align-items: center; justify-content: center; padding: 0 12px; background: var(--surface);' + (last ? ' border-top-right-radius: 20px; border-right: 0;' : '');


  // Inline cell edit rights mirror the database rules (RLS, column guards, workflow settings).
  const CE = s.cellEdit || null;
  const CELL_EDIT = { editor: ['editStatus'].concat(settings.editors_change_status ? ['status'] : []), designer: ['thumb'], sponsor: [] };
  const canCell = (k, r) => {
    if (customCols.some((f) => f.id === k && (kindOf(f) === 'created_time' || kindOf(f) === 'last_edited_by'))) return false;
    if (s.role === 'admin') return k !== 'project' && k !== 'job';
    if ((CELL_EDIT[s.role] || []).indexOf(k) < 0) return false;
    if (settings.lock_after_live && r && r.status === 'Live') return false;
    if (k === 'editStatus') return can('edits', 'edit') && (!r || r.editorId === me.id);
    if (k === 'thumb') return can('thumbs', 'edit') && (!r || r.designerId === me.id);
    return true;
  };
  const STG = {};
  D.statuses.forEach((x) => { STG[x.label] = { in_production: 'prod', post_production: 'post', publishing: 'pub' }[x.stage]; });
  const colLabel = (k) => k === 'linkUrl' || k === 'link' ? 'URL' : (COLS[k] || customCols.find((x) => x.id === k) || { label: k }).label;
  const setField = (r, k, val, extra) => {
    const txt = val ? 'set ' + colLabel(k) + ' to ' + val : 'cleared ' + colLabel(k);
    set({ cellEdit: null, ceText: '' });
    A.setField(r, k, val, Object.assign({ text: txt + ' on', stage: STG[val] }, extra || {}));
  };
  const LINKS = (r) => r.linkUrl || '';
  // ---------- Select and Multi select options (docs/design/database-components/SelectEditor.dc.html) ----------
  // Options live in custom_fields.options; values store option labels. config.option_sort orders the lists.
  const OPT_PAL = ['coral', 'pink', 'violet', 'blue', 'green', 'amber', 'red', 'gray'];
  const SORT_L = { manual: 'Manual', alpha: 'Alphabetical', alpha_desc: 'Reverse alphabetical' };
  const isSelectField = (f) => !!f && (f.type === 'select' || f.type === 'multi_select');
  const optList = (f) => (Array.isArray(f.options) ? f.options : []).filter((o) => o && o.label);
  const sortModeOf = (f) => { const m = (f.config || {}).option_sort; return SORT_L[m] ? m : 'manual'; };
  const sortedOpts = (f) => {
    const l = optList(f).slice();
    const m = sortModeOf(f);
    if (m !== 'manual') { l.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })); if (m === 'alpha_desc') l.reverse(); }
    return l;
  };
  const labelsOf = (raw) => (raw == null || raw === '' ? [] : Array.isArray(raw) ? raw.map(String) : [String(raw)]);
  const optModel = (f) => {
    const all = sortedOpts(f);
    const counts = {};
    allRows.forEach((r) => labelsOf((r.cf || {})[f.id]).forEach((l) => { counts[l] = (counts[l] || 0) + 1; }));
    const used = optList(f).map((o) => o.color_token);
    // New options take the next color no option uses yet, then cycle.
    const nextTone = OPT_PAL.find((t) => used.indexOf(t) < 0) || OPT_PAL[optList(f).length % OPT_PAL.length];
    const mode = sortModeOf(f);
    return {
      fieldId: f.id, multi: f.type === 'multi_select', canEdit: isAdmin, nextTone: nextTone,
      sortMode: mode, sortLabel: SORT_L[mode], canDrag: isAdmin,
      sorts: Object.keys(SORT_L).map((k) => ({ id: k, label: SORT_L[k], on: mode === k, pick: () => A.setFieldConfig(f, { option_sort: k }) })),
      options: all.map((o) => ({ id: o.id, label: o.label, tone: toneOf(o.color_token), count: counts[o.label] || 0 })),
      create: (label) => A.createOption(f, label, nextTone),
      rename: (id, label) => A.renameOption(f, id, label),
      setColor: (id, tone) => A.saveOptions(f, optList(f).map((o) => (o.id === id ? Object.assign({}, o, { color_token: tone }) : o))),
      deleteOption: (id) => A.deleteOption(f, id),
      merge: (id, into) => A.mergeOption(f, id, into),
      // Moving an option saves the shown order as the manual order.
      move: (id, to) => {
        const it = all.find((o) => o.id === id);
        if (!it) return;
        const l = all.filter((o) => o.id !== id);
        l.splice(Math.max(0, Math.min(to, l.length)), 0, it);
        A.saveOptions(f, l.map((o, i) => Object.assign({}, o, { sort: (i + 1) * 100 })));
        if (mode !== 'manual') A.setFieldConfig(f, { option_sort: 'manual' });
      }
    };
  };

  // ---------- Status (docs/design/database-components/StatusEditor.dc.html) ----------
  // Groups are the three board stages. Built-in statuses keep their name and group (the database enforces it too).
  const STAGE_KEYS = [['in_production', 'prod'], ['post_production', 'post'], ['publishing', 'pub']];
  const STAGE_TITLE = { in_production: 'In Production', post_production: 'Post Production', publishing: 'Publishing' };
  const defaultStatus = D.statuses.find((x) => x.id === settings.default_status_id) || D.statuses[0] || {};
  const statusOpt = (x) => ({
    id: x.id, label: x.label, tone: statusTone[x.label] || 'gray', notify: !!x.notify_sponsor, editors: !!x.editors_can_set,
    system: !!x.is_system, isDefault: x.id === defaultStatus.id, stage: x.stage, stageLabel: STAGE_TITLE[x.stage],
    count: D.rows.filter((r) => r.statusId === x.id).length
  });
  const statusGroups = (list) => STAGE_KEYS.map((sk) => ({
    stage: sk[0], title: STAGE_TITLE[sk[0]], color: (STAGES.find((g) => g.id === sk[1]) || {}).color,
    opts: list.filter((x) => x.stage === sk[0]).map(statusOpt)
  }));
  const statusModel = () => {
    const st = (id) => D.statuses.find((x) => x.id === id);
    const used = D.statuses.map((x) => x.color_token);
    const nextTone = OPT_PAL.find((t) => used.indexOf(t) < 0) || 'gray';
    // Statuses in board order with one moved, then saved as the new sort.
    const reorder = (id, stage, to) => {
      const ids = [];
      STAGE_KEYS.forEach((sk) => {
        const g = D.statuses.filter((x) => x.stage === sk[0] && x.id !== id).map((x) => x.id);
        if (sk[0] === stage) g.splice(Math.max(0, Math.min(to, g.length)), 0, id);
        ids.push.apply(ids, g);
      });
      A.orderStatuses(ids);
    };
    return {
      groups: statusGroups(D.statuses).map((g) => Object.assign(g, { count: g.opts.length, add: (label) => A.createStatus(label, g.stage, nextTone) })),
      stages: STAGE_KEYS.map((sk) => ({ id: sk[0], label: STAGE_TITLE[sk[0]] })),
      all: D.statuses.map(statusOpt), defaultId: defaultStatus.id, defaultLabel: defaultStatus.label || '',
      setDefault: (id) => A.setDefaultStatus(id),
      rename: (id, label) => {
        const x = st(id), name = (label || '').trim();
        if (!x || x.is_system || !name || name === x.label) return;
        if (D.statuses.some((y) => y.id !== id && y.label.toLowerCase() === name.toLowerCase())) { A.toast('There is already a status named ' + name + '.'); return; }
        A.saveStatus(x, { label: name }, 'renamed the status ' + x.label + ' to');
      },
      setColor: (id, tone) => A.saveStatus(st(id), { color_token: tone }),
      setGroup: (id, stage) => {
        const x = st(id);
        if (!x || x.is_system || x.stage === stage) return;
        A.saveStatus(x, { stage: stage }, 'moved the status to ' + STAGE_TITLE[stage] + ':');
        reorder(id, stage, D.statuses.filter((y) => y.stage === stage).length);
      },
      toggleNotify: (id) => A.saveStatus(st(id), { notify_sponsor: !st(id).notify_sponsor }),
      toggleEditors: (id) => A.saveStatus(st(id), { editors_can_set: !st(id).editors_can_set }),
      deleteOption: (id) => { const x = st(id); if (x && !x.is_system) A.removeStatus(x); },
      move: (id, to) => { const x = st(id); if (x) reorder(id, x.stage, to); }
    };
  };
  // Show as, per member and view: block (the board's look), pill, checkbox (checked in Publishing) or stage bar.
  const SHOW = VS.show || {};
  const statusShow = ['pill', 'checkbox', 'bar'].indexOf(SHOW.status) >= 0 ? SHOW.status : 'block';

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
    } else if (c.key === 'status' && statusShow !== 'block') {
      const x = D.statuses.find((y) => y.label === v);
      const tn = statusTone[v] || 'gray';
      const lvl = x ? STAGE_KEYS.findIndex((sk) => sk[0] === x.stage) + 1 : 0;
      o.isChips = !!v;
      o.style = base + ' padding: 0 12px; gap: ' + (statusShow === 'bar' ? 4 : 8) + 'px; justify-content: ' + (statusShow === 'pill' ? 'center' : 'flex-start') + ';';
      const label = 'min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--ink-2b);';
      if (statusShow === 'pill') {
        o.chips = [{ text: v, style: chipStyle(tn, { dark: dark }), dot: 'width: 6px; height: 6px; flex: none; border-radius: 999px; background: currentColor;' }];
      } else if (statusShow === 'checkbox') {
        const on = lvl === 3;
        o.chips = [
          { text: on ? '✓' : '', style: 'width: 18px; height: 18px; flex: none; box-sizing: border-box; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--inv-ink); ' + (on ? 'background: var(--inv);' : 'border: 1.5px solid var(--border-strong);') },
          { text: v, style: label }
        ];
      } else {
        const seg = (i) => ({ text: '', style: 'width: 16px; flex: none; height: 6px; border-radius: 999px; background: ' + (i < lvl ? (dark ? DARKFILL[tn][0] : TONE[tn][2]) : 'var(--line-3)') + ';' });
        o.chips = [seg(0), seg(1), seg(2), { text: v, style: label + ' flex: 1; margin-left: 6px; font-size: 12px; font-weight: 600;' }];
      }
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
      const dfm = confOf(c.key).date_format;
      if (v && dfm && dfm !== 'short') { const pd = parseAt(r, c.key); if (pd) o.text = fmtDate(pd.date, dfm); }
      const extra = st === 'late' ? ' background: var(--red-soft); color: var(--red-ink); font-weight: 600;' : st === 'today' ? ' background: var(--amber-soft); color: var(--amber-ink); font-weight: 600;' : ' color: var(--ink-2b);';
      o.chipStyle = 'padding: 5px 10px; border-radius: 999px; white-space: nowrap; font-size: 13px; font-variant-numeric: tabular-nums;' + extra;
    } else if (c.kind === 'person') {
      o.isPerson = !!v;
      o.style = base + ' padding: 0 12px;';
      o.initials = v ? v.slice(0, 1) : '';
      o.avatarStyle = avatar(v, 26);
      if (SHOW[c.key] === 'avatar') o.text = '';
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
      o.editing = !!(cn && CE && !CE.src && CE.job === r.job && CE.key === c.key);
      o.exp = cn ? (o.editing ? 'true' : 'false') : 'false';
      o.haspop = cn ? 'dialog' : 'false';
      const pd = parseAt(r, c.key) || { m: today.getMonth(), y: today.getFullYear() };
      o.edit = cn ? () => set({ cellEdit: o.editing ? null : { job: r.job, key: c.key }, ceText: curV, ceMonth: pd.m, ceYear: pd.y, menu: '' })
        : (c.kind === 'link' && LINKS(r) ? () => window.open(LINKS(r), '_blank', 'noopener') : openRow(r.job));
      o.aria = (cn ? 'Edit ' : 'Open project to see ') + c.label + ' for ' + r.title + ', ' + (v || 'empty');
      o.plus = !v && cn;
      if (c.kind === 'custom' && isSelectField(c.field)) {
        // Soft pills, centered for Select. Chip widths are estimated to fit what fits, then a +N count.
        const labs = labelsOf((r.cf || {})[c.key]);
        const tone = {};
        optList(c.field).forEach((x) => { tone[x.label] = toneOf(x.color_token); });
        let room = c.w - 20;
        const fit = [];
        labs.forEach((l, i) => {
          const w = 22 + l.length * 6.3;
          const reserve = i < labs.length - 1 ? 40 : 0;
          if (fit.length === i && (i === 0 || room - w >= reserve)) { fit.push(l); room -= w + 6; }
        });
        o.isText = false;
        o.isChips = labs.length > 0;
        const variant = (c.field.config || {}).show_as === 'block' ? 'block' : 'pill';
        o.chips = fit.map((l) => ({ text: l, style: chipStyle(tone[l] || 'gray', { dark: dark, variant: variant }) }))
          .concat(labs.length > fit.length ? [{ text: '+' + (labs.length - fit.length), style: chipStyle('gray', { dark: dark }) }] : []);
        o.style = base + ' padding: 0 10px; gap: 6px; justify-content: ' + (c.field.type === 'select' ? 'center' : 'flex-start') + ';';
      } else if (c.kind === 'custom' && c.ftype === 'number') {
        const n = toNum((r.cf || {})[c.key] != null ? r.cf[c.key] : v);
        o.isText = false;
        o.isChips = n != null;
        o.chips = n != null ? numChips(n, c.field.config || {}) : [];
        o.style = base + ' padding: 0 12px; gap: 8px; justify-content: flex-end;';
      } else if (c.kind === 'custom' && c.ftype === 'date') {
        const d = isoDate((r.cf || {})[c.key] || v);
        o.isText = !d && !!v;
        o.isDate = !!d;
        o.text = d ? showDateVal((r.cf || {})[c.key] || v, confOf(c.key).date_format || 'short') : v;
        o.textStyle = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-3);';
        o.chipStyle = dateChipStyle(dueOn(c.key) ? dueOfDate(d) : 'normal');
        o.style = base + ' justify-content: center; padding: 0 8px;';
      } else if (c.kind === 'custom' && kindOf(c.field) !== 'text') {
        // Email, Phone, URL, Person, Files, Checkbox, Relation and Formula (CellEditors.dc.html cell states).
        const kd = kindOf(c.field);
        const raw = (r.cf || {})[c.key];
        const linkS = 'min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; color: var(--link); text-decoration: underline; text-underline-offset: 3px;';
        const plain = 'min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; color: var(--ink-2);';
        o.isText = false;
        o.style = base + ' padding: 0 12px; gap: 6px;';
        if (kd === 'email' || kd === 'url') o.chips = v ? [{ text: kd === 'url' ? v.replace(/^https?:\/\/(www\.)?/, '') : v, style: linkS }] : [];
        else if (kd === 'phone') o.chips = v ? [{ text: v, style: plain + ' font-variant-numeric: tabular-nums;' }] : [];
        else if (kd === 'formula') {
          const err = (r.fx || {})[c.key];
          o.chips = err ? [{ text: 'Error', style: 'font-size: 13px; font-weight: 600; color: var(--red-ink);' }] : v ? [{ text: v, style: plain + (typeof raw === 'number' ? ' margin-left: auto; font-weight: 600; font-variant-numeric: tabular-nums;' : '') }] : [];
          o.aria = (cn ? 'Edit ' : '') + c.label + ' for ' + r.title + ', ' + (err ? 'error: ' + err : v || 'empty');
        } else if (kd === 'person') {
          const ids = listOf(raw);
          o.chips = ids.slice(0, 3).map((id) => ({ text: (nameById[id] || '?').slice(0, 1), style: avatar(nameById[id], 24) + ' margin-right: -8px; box-shadow: 0 0 0 2px var(--surface);' }))
            .concat(ids.length === 1 ? [{ text: nameById[ids[0]] || 'Former member', style: plain + ' margin-left: 10px;' }] : ids.length > 3 ? [{ text: '+' + (ids.length - 3), style: plain + ' margin-left: 12px; font-size: 12px;' }] : ids.length ? [{ text: '', style: 'width: 8px;' }] : []);
        } else if (kd === 'files') {
          const items = listOf(raw);
          const first = items[0] || {};
          const prev = first.path && (D.previews || {})[first.path];
          o.chips = items.length ? [
            { text: '', style: 'width: 28px; height: 28px; flex: none; border-radius: 6px; background: ' + (prev ? 'center / cover no-repeat url("' + prev + '")' : 'var(--chip-2)') + ';' },
            { text: items.length === 1 ? first.name : items.length + ' files', style: plain + ' font-size: 13px;' }
          ] : [];
        } else if (kd === 'relation') {
          const ts = listOf(raw).map((id) => titleById[id]).filter(Boolean);
          o.chips = ts.slice(0, 2).map((t) => ({ text: t, style: chipStyle('gray', { dark: dark }) + ' max-width: 110px;' }))
            .concat(ts.length > 2 ? [{ text: '+' + (ts.length - 2), style: chipStyle('gray', { dark: dark }) }] : []);
        } else if (kd === 'checkbox') {
          const on = !!raw;
          o.chips = [{ text: on ? '✓' : '', style: 'width: 18px; height: 18px; flex: none; box-sizing: border-box; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--inv-ink); ' + (on ? 'background: var(--inv);' : 'background: var(--surface); border: 1.5px solid var(--border-strong);') }];
          o.style = base + ' padding: 0 12px; justify-content: center;';
          o.plus = false;
          o.haspop = 'false';
          o.aria = (cn ? 'Toggle ' : '') + c.label + ' for ' + r.title + ', ' + (on ? 'checked' : 'not checked');
          // Checkbox toggles on click, no editor.
          if (cn) o.edit = () => A.setCustomValue(r, c.field, on ? null : true);
        }
        o.isChips = !!(o.chips && o.chips.length);
      } else if (c.kind === 'custom') { o.isText = !!v; o.textStyle = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-3);'; o.style = base + ' padding: 0 12px;'; }
      o.btnStyle = 'position: relative; flex: 1 1 auto; align-self: stretch; display: flex; align-items: ' + (c.kind === 'pill' && !(c.key === 'status' && statusShow !== 'block') ? 'stretch' : 'center') + '; justify-content: inherit; gap: inherit; min-width: 0; padding: 0; margin: 0; border: 0; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; text-align: inherit; cursor: pointer;' + (o.editing ? ' outline: 2px solid var(--ink); outline-offset: -2px;' : '');
      const isDateCol = c.kind === 'date';
      o.popStyle = 'position: absolute; z-index: 1; top: calc(100% + 6px); ' + (colIdx >= cols.length - 5 ? 'right: 0;' : 'left: 0;') + ' width: ' + (isDateCol ? 296 : 272) + 'px; max-height: 380px; overflow-y: auto; box-sizing: border-box; padding: 8px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.18); text-align: left; font-size: 14px; font-weight: 500; color: var(--ink); cursor: default; white-space: normal;';
      o.style = (o.style || base) + ' position: relative;' + (o.editing ? ' z-index: 30;' : '');
    }
    if (!o.style) o.style = base;
    if (last) o.style += ' border-right: 0;';
    o.titleTextStyle = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    if (WRAP[c.key]) {
      // Wrapped columns let text run onto more lines; the row grows to fit (base uses min-height).
      const wrapIt = (st) => st && st.replace('text-overflow: ellipsis;', '').replace('white-space: nowrap;', 'white-space: normal; overflow-wrap: anywhere; padding: 8px 0;');
      o.titleTextStyle = wrapIt(o.titleTextStyle);
      o.textStyle = wrapIt(o.textStyle);
      o.linkStyle = wrapIt(o.linkStyle);
    }
    return o;
  };

  const C = role.card;
  const typeBlock = (v) => { const f = TYPEFILL[v]; return 'display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 0; font-size: 11.5px; font-weight: 700; letter-spacing: 0.01em; white-space: nowrap; background: ' + (f ? f[0] : 'var(--line-3)') + '; color: ' + (f ? f[1] : 'var(--ink-2)') + ';'; };
  const dateChip = (k, r) => {
    const st = dueState(k, r);
    const tone = st === 'late' ? 'background: var(--red-soft); color: var(--red-ink);' : st === 'today' ? 'background: var(--amber-soft); color: var(--amber-ink);' : 'background: var(--hover); color: var(--ink-2b);';
    return 'display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 9px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; ' + tone;
  };
  // Production pipeline (docs/design/project-card): Script, Film, Edit, Thumbnail, Sponsor approval when there is a
  // sponsor, Publish. The card's segment bar and the modal's stepper both read it. state: done, now, warn or todo.
  const STATUS_SEQ = D.statuses.filter((x) => x.is_system).map((x) => x.label);
  const STEP_TONE = { done: 'green', now: 'blue', warn: 'red' };
  const stepFill = (state) => STEP_TONE[state] ? (dark ? DARKFILL[STEP_TONE[state]][0] : TONE[STEP_TONE[state]][3]) : '';
  const stepsFor = (r) => {
    const si = Math.max(0, STATUS_SEQ.indexOf(r.status));
    const eS = r.editStatus || '', tS = r.thumb || '';
    const out = [];
    const step = (key, label, state, value, meta) => out.push({ key: key, label: label, state: state, value: value, meta: meta || '' });
    step('script', 'Script', si > 0 ? 'done' : 'now', si > 0 ? 'Locked' : 'In progress', '');
    step('film', 'Film', si > 1 ? 'done' : si === 1 ? 'now' : 'todo', si > 1 ? 'Wrapped' : si === 1 ? 'Filming' : 'Not started', r.film ? 'Film ' + r.film : 'No film date');
    if (has('editStatus')) step('edit', 'Edit', eS === 'Approved' ? 'done' : eS === 'Needs Revision' ? 'warn' : eS ? 'now' : 'todo', eS || 'Not assigned', [r.editor, r.editDue ? 'Due ' + r.editDue : ''].filter(Boolean).join('  ·  ') || 'No editor yet');
    if (has('thumb')) step('thumb', 'Thumbnail', tS === 'Done' ? 'done' : tS === 'Needs Revision' ? 'warn' : (tS === 'In Design' || tS === 'In Review') ? 'now' : 'todo', tS || 'Not assigned', [r.designer, r.thumbDue ? 'Due ' + r.thumbDue : ''].filter(Boolean).join('  ·  ') || 'No designer yet');
    if (r.sponsor && (has('approval') || isSponsorRole)) {
      const ap = r.approval || 'Pending';
      step('sponsor', 'Sponsor approval', ap === 'Approved' ? 'done' : ap === 'Changes Requested' ? 'warn' : r.status === 'Sponsor Review' ? 'now' : 'todo', ap, r.sponsor);
    }
    step('publish', 'Publish', r.status === 'Live' ? 'done' : r.status === 'Scheduled' ? 'now' : 'todo', r.status === 'Live' ? 'Live' : r.status === 'Scheduled' ? 'Scheduled' : 'Not scheduled', r.pub ? 'Pub ' + r.pub : '');
    return out;
  };
  const STEP_WORD = { done: 'done', now: 'in progress', warn: 'needs revision', todo: 'not started' };
  // Comments by other people since this person last opened the project's Comments (project_reads). Projects never
  // opened count the last three days only, so a first visit is not a wall of dots.
  const unreadFor = (r) => {
    if (isSponsorRole) return 0;
    const seen = (D.seen || {})[r.id];
    const since = seen ? new Date(seen) : new Date(now - 3 * 86400000);
    return (D.comments[r.id] || []).filter((c) => c.author_id !== me.id && new Date(c.created_at) > since).length;
  };
  const CARD_SOFT = (k, v) => { const t = softFor(k, v); const tn = k === 'type' ? TYPETONE[v] : (PILL[k] || {})[v]; return { bg: t ? t[0] : 'var(--chip)', ink: t ? t[1] : 'var(--ink-3)', dot: TONE[tn] ? (dark ? DARKFILL[tn][0] : TONE[tn][2]) : '#B0B0B0' }; };
  const FLAG = { red: 'background: var(--red-soft); color: var(--red-ink);', amber: 'background: var(--amber-soft); color: var(--amber-ink);', gray: 'background: var(--chip); color: var(--ink-3);' };
  const flagStyle = (tone) => 'display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; font-size: 12px; font-weight: 600; white-space: nowrap; ' + FLAG[tone];
  const stepDone = (k, r) => (k === 'film' && Math.max(0, STATUS_SEQ.indexOf(r.status)) > 1) || (k === 'editDue' && r.editStatus === 'Approved') || (k === 'thumbDue' && r.thumb === 'Done') || (k === 'pub' && r.status === 'Live');
  const showCovers = VS.covers !== false && !compact;
  const projectUrl = (r) => (typeof window !== 'undefined' ? window.location.origin : '') + '/projects?project=' + encodeURIComponent(r.job);
  const cardFor = (r) => {
    const showType = !!vis.type && !!TYPEFILL[r.type];
    // Status: the role's own column (status, editStatus or thumb) in its soft tone, no "Status:" prefix.
    const sk = C.bar;
    const sv = vis[sk] || sk === 'status' ? r[sk] : '';
    const so = sv ? CARD_SOFT(sk, sv) : null;
    // Flags only when someone has to act.
    const flags = [];
    if (!isSponsorRole) {
      if (sk !== 'editStatus' && has('editStatus') && r.editStatus === 'Needs Revision') flags.push({ text: 'Edit needs revision', tone: 'red', warn: true });
      if (sk !== 'thumb' && has('thumb') && r.thumb === 'Needs Revision') flags.push({ text: 'Thumbnail needs revision', tone: 'red', warn: true });
      if (r.sponsor && has('approval')) {
        if (r.approval === 'Changes Requested') flags.push({ text: r.sponsor + ' · Changes requested', tone: 'red', warn: true });
        else if (r.status === 'Sponsor Review' && (r.approval || 'Pending') === 'Pending') flags.push({ text: r.sponsor + ' · Pending', tone: 'amber' });
      }
    } else if (r.sponsor === acctName && r.status === 'Sponsor Review' && (r.approval || 'Pending') === 'Pending' && acct && acct.allow_approve) {
      flags.push({ text: 'Your approval needed', tone: 'amber' });
    }
    // Custom columns with Show on cards on.
    customCols.filter((f) => (f.config || {}).show_on_cards && r[f.id]).forEach((f) => {
      const raw = (r.cf || {})[f.id];
      const txt = f.type === 'number' ? fmtNum(toNum(raw != null ? raw : r[f.id]), f.config || {}) : f.type === 'date' && isoDate(r[f.id]) ? fmtDate(isoDate(r[f.id]), (f.config || {}).date_format || 'short') : r[f.id];
      flags.push({ text: f.label + ': ' + txt, tone: 'gray' });
    });
    const steps = isSponsorRole ? [] : stepsFor(r);
    const pipe = steps.map((x) => ({ style: 'flex: 1; height: 4px; border-radius: 2px; background: ' + (stepFill(x.state) || 'var(--track)') + ';' }));
    // The one date that matters next for this role: the first one not done yet, else the last.
    const dl = C.dates.filter((p) => vis[p[0]] && r[p[0]]);
    const nd = dl.find((p) => !stepDone(p[0], r)) || dl[dl.length - 1];
    let next = null;
    if (nd) {
      const st = dueState(nd[0], r);
      const n = diAt(r, nd[0]);
      const text = st === 'late' && n != null ? (TODAY - n) + 'd late' : st === 'today' ? 'Today' : n != null && n === TODAY + 1 && !stepDone(nd[0], r) ? 'Tomorrow' : r[nd[0]];
      next = { label: nd[1], text: text, title: nd[1] + ' ' + r[nd[0]], style: dateChip(nd[0], r) };
    }
    // List view rows keep the full badge and date set.
    const BADGE_LBL = { status: 'Status', editStatus: 'Edit', thumb: 'Thumb', approval: 'Sponsor' };
    const badges = C.badges.filter((k) => vis[k] && r[k]).map((k) => {
      const f = k === 'status' ? fillFor(k, r[k]) : (softFor(k, r[k]) || fillFor(k, r[k]));
      return { text: (BADGE_LBL[k] ? BADGE_LBL[k] + ': ' : '') + r[k], style: 'display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 0; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + (f ? f[0] : 'var(--line-3)') + '; color: ' + (f ? f[1] : 'var(--ink-2)') + ';' };
    });
    const dates = dl.map((p) => ({ label: p[1], text: r[p[0]], style: dateChip(p[0], r) }));
    const listPeople = C.people.filter((k) => vis[k] && r[k]).map((k) => ({ initials: r[k].slice(0, 1), style: avatar(r[k], 28) }));
    const avatars = isSponsorRole ? [] : C.people.filter((k) => vis[k]).map((k) => r[k]
      ? { initials: r[k].slice(0, 1), title: COLS[k].label + ': ' + r[k], style: avatar(r[k], 24) + ' font-size: 10.5px; box-shadow: 0 0 0 2px var(--surface);' }
      : { initials: '+', title: 'No ' + COLS[k].label.toLowerCase() + ' yet', style: 'width: 24px; height: 24px; border-radius: 999px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: var(--faint); background: var(--surface); box-shadow: inset 0 0 0 1.5px var(--border-2);' });
    const peopleNames = C.people.filter((k) => vis[k]).map((k) => COLS[k].label + ': ' + (r[k] || 'unassigned')).join(', ');
    const nCm = r.updates || 0;
    const unread = nCm ? unreadFor(r) : 0;
    const files = isSponsorRole ? [] : (D.assets[r.id] || []).filter((a) => !a.comment_id);
    const checks = isSponsorRole ? [] : (D.checklist || {})[r.id] || [];
    const ckDone = checks.filter((x) => x.done_at).length;
    const lt = vis.link ? linkFor(r) : '';
    const thumbs = showCovers && !isSponsorRole ? files.filter((a) => a.kind === 'thumbnail' && isImageFile(a) && (D.previews || {})[a.storage_path]) : [];
    const cover = thumbs.length ? (D.previews || {})[thumbs[thumbs.length - 1].storage_path] : '';
    const sel = r.job === openJob;
    const menuOpen = s.cardMenu === r.job;
    const closeMenu = () => set({ cardMenu: '' });
    const menu = [{ label: 'Open', hint: '↵', pick: () => { closeMenu(); openRow(r.job)(); } }, { label: 'Copy link', pick: () => { closeMenu(); A.copyText(projectUrl(r), 'Link copied.'); } }];
    if (isAdmin && !r.archived) {
      const si = Math.max(0, STATUS_SEQ.indexOf(r.status));
      let ni = si + 1;
      if (STATUS_SEQ[ni] === 'Sponsor Review' && !r.sponsor) ni++;
      const nx = STATUS_SEQ[ni];
      if (nx) menu.push({ label: 'Move to ' + nx, pick: () => { closeMenu(); A.applyPatch(r, { status: nx }, { text: 'moved Status to ' + nx, stage: STG[nx], event: 'status' }); } });
      menu.push({ label: 'Archive', danger: true, sep: true, pick: () => { closeMenu(); A.archiveProject(r, true); } });
    }
    const counts = [];
    if (nCm) counts.push({ key: 'cm', icon: 'M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z', text: String(nCm), hot: unread > 0, title: nCm + (nCm === 1 ? ' comment' : ' comments') + (unread ? ', ' + unread + ' new' : '') });
    if (files.length) counts.push({ key: 'fl', icon: 'M13 7.5l-5.25 5.25a3 3 0 0 1-4.25-4.25L9 3a2 2 0 0 1 2.83 2.83L6.5 11.17a1 1 0 0 1-1.42-1.42L10 4.83', text: String(files.length), title: files.length + (files.length === 1 ? ' file' : ' files') });
    if (checks.length) counts.push({ key: 'ck', icon: 'M3 2.5h10a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5zM5 8l2 2 4-4', text: ckDone + '/' + checks.length, done: ckDone === checks.length, title: ckDone + ' of ' + checks.length + ' checklist steps done' });
    const countStyle = (c) => 'display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; color: ' + (c.hot ? 'var(--ink)' : c.done ? 'var(--green-ink)' : 'var(--muted-2)') + ';';
    const live = r.status === 'Live';
    const canDrag = !!dropField && !isSponsorRole && canCell(dropField, r);
    const dragging = s.dragJob === r.job;
    return {
      open: openRow(r.job),
      draggable: canDrag,
      onDragStart: (e) => { if (!canDrag) return; if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.job); } set({ dragJob: r.job, cardMenu: '' }); },
      onDragEnd: () => set({ dragJob: '', dragOver: '' }),
      key: r.job,
      cardStyle: 'position: relative; background: ' + (live ? 'var(--surface-2)' : 'var(--surface)') + '; border: 1px solid ' + (sel ? 'var(--ink)' : 'var(--line-4)') + '; border-radius: 18px; box-shadow: ' + (sel ? '0 0 0 1px var(--ink)' : '0 1px 2px rgba(0,0,0,0.04)') + '; padding: ' + (compact ? '10px 12px' : '12px 14px') + '; display: flex; flex-direction: column; gap: ' + (compact ? 8 : 10) + 'px;' + (menuOpen ? ' z-index: 6;' : '') + (canDrag ? ' cursor: grab;' : '') + (dragging ? ' opacity: 0.45;' : ''),
      rowCls: 'row fb-lrow' + (sel ? ' row-on' : ''),
      title: r.title, titleStyle: 'margin: 0; font-size: ' + (compact ? 14 : 15) + 'px; font-weight: 600; line-height: 1.35; letter-spacing: -0.005em; color: ' + (live ? 'var(--ink-3)' : 'var(--ink)') + '; display: -webkit-box; -webkit-line-clamp: ' + (compact ? 1 : 2) + '; -webkit-box-orient: vertical; overflow: hidden;',
      updates: nCm, hasUpdates: nCm > 0,
      hasType: showType, typeText: r.type, typeStyle: typeBlock(r.type),
      job: isSponsorRole ? '' : r.job,
      hasStatus: !!sv, statusText: sv, statusStyle: so ? 'display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + so.bg + '; color: ' + so.ink + ';' : '',
      statusDot: so ? 'width: 7px; height: 7px; border-radius: 999px; flex: none; background: ' + so.dot + ';' : '',
      flags: flags.map((f) => ({ text: f.text, warn: !!f.warn, style: flagStyle(f.tone) })),
      hasFlags: !!sv || flags.length > 0,
      pipe: pipe, hasPipe: pipe.length > 0,
      pipeLabel: steps.map((x) => x.label + ' ' + STEP_WORD[x.state]).join(', '),
      avatars: avatars, hasAvatars: avatars.length > 0, people: listPeople, peopleText: peopleNames, badges: badges, dates: dates,
      counts: counts.map((c) => Object.assign(c, { style: countStyle(c) })),
      next: next, hasNext: !!next,
      hasLink: !!lt, linkText: lt, href: r.linkUrl || undefined,
      linkStyle: 'position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 6px; min-width: 0; color: var(--link); font-size: 12.5px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
      hasFoot: avatars.length > 0 || counts.length > 0 || !!next || !!lt,
      cover: cover, hasCover: !!cover,
      hasMenu: !isSponsorRole, menuOpen: menuOpen, menu: menu,
      toggleMenu: (e) => { if (e && e.stopPropagation) e.stopPropagation(); set({ cardMenu: menuOpen ? '' : r.job }); },
      closeMenu: closeMenu, menuLabel: 'Actions for ' + r.title,
      onKey: (e) => { if (e.key === 'Escape' && menuOpen) { e.stopPropagation(); closeMenu(); } },
      barStyle: 'width: 4px; height: 28px; flex: none; background: ' + (showType ? TYPEFILL[r.type][0] : ((fillFor(C.bar, r[C.bar]) || ['#B0B0B0'])[0])) + ';'
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
    { id: 'status', label: 'Status', field: 'status' },
    { id: 'type', label: 'Content Type', field: 'type' },
    { id: 'channel', label: 'Channel', field: 'channel' },
    { id: 'editor', label: 'Editor', field: 'editor' },
    { id: 'none', label: 'None', field: null }
  ].filter((o) => !o.field || has(o.field));
  const gb = gbOpts.find((o) => o.id === VS.groupBy) ? VS.groupBy : 'stage';
  let defs;
  if (gb === 'stage') defs = STAGES;
  else if (gb === 'type') defs = Object.keys(TYPEFILL).map((k) => ({ id: k, title: k, color: TYPEFILL[k][0] }));
  else if (gb === 'status') defs = D.statuses.map((x) => ({ id: x.label, title: x.label, color: TONE[statusTone[x.label]][2] }));
  else if (gb === 'channel') defs = D.channels.map((x, i) => ({ id: x.name, title: x.name, color: x.color || ['#F08A5D', '#E0567F', '#A66BD6'][i % 3] }));
  else if (gb === 'none') defs = [{ id: 'all', title: 'All projects', color: 'var(--muted-2)' }];
  else defs = editorNames.map((n) => ({ id: n, title: n, color: PEOPLE[n] || '#5F5F5F' })).concat([{ id: 'Unassigned', title: 'Unassigned', color: '#B0B0B0' }]);
  const keyOf = (r) => gb === 'none' ? 'all' : gb === 'stage' ? r.g : gb === 'type' ? r.type : gb === 'status' ? r.status : gb === 'channel' ? r.channel : (r.editor || 'Unassigned');

  const DAYS = 61, DW = 24, LW = 300;
  const canEdit = s.role === 'admin';
  const scopeName = isSponsorRole ? acctName : s.role === 'editor' ? 'your edits' : s.role === 'designer' ? 'your designs' : 'this view';
  const filtersOn = !!q || usePerson || rulesCount > 0;
  const todayLine = 'position: absolute; top: 0; bottom: 0; left: ' + (TODAY * DW + DW / 2 - 1) + 'px; width: 2px; background: #E0567F; opacity: 0.85;';
  const laneStyle = 'position: relative; height: 44px; border-bottom: 1px solid var(--line); background-image: repeating-linear-gradient(to right, transparent 0, transparent ' + (7 * DW - 1) + 'px, var(--line) ' + (7 * DW - 1) + 'px, var(--line) ' + (7 * DW) + 'px);';

  const tlItem = (r) => {
    const end = diAt(r, 'pub');
    const start = diAt(r, 'film');
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

  // ---------- Column headers: states and the header menu (docs/design/database-components/HeaderMenu.dc.html) ----------
  // Schema actions (rename, change type, insert, duplicate, delete) are Super Admin only and apply to custom columns.
  // View actions save to this member's own view. Sponsors get plain headers.
  const TYPE_ICON = {};
  CTYPES.forEach((t) => { TYPE_ICON[t[0]] = t[1]; });
  const FIELD_TYPES = Object.keys(FIELD_TYPE_L).map((k) => FIELD_TYPE_L[k]);
  const KIND_TYPE = { title: 'Text', text: 'Text', mono: 'Text', date: 'Date', person: 'Person', dot: 'Status', link: 'URL', pill: 'Status' };
  const KEY_TYPE = { type: 'Select', channel: 'Select', sponsor: 'Relation' };
  const typeOfCol = (c) => c.kind === 'custom' ? (FIELD_TYPE_L[c.ftype] || 'Text') : (KEY_TYPE[c.key] || KIND_TYPE[c.kind] || 'Text');
  const GROUP_OF = { type: 'type', status: 'status', channel: 'channel', editor: 'editor' };
  const WRAPS = { title: true, text: true, mono: true, custom: true, link: true };
  const CM = s.colMenu || null;
  const flashCol = (id) => { set({ newCol: id }); setTimeout(() => set((p) => (p.newCol === id ? { newCol: '' } : {})), 2600); };
  // Puts a column next to another in this member's order (Project stays first).
  const placeAt = (id, anchor, side) => {
    const arr = allKeys.filter((k) => k !== id && k !== 'project');
    let at = anchor === 'project' ? 0 : arr.indexOf(anchor) + (side === 'right' ? 1 : 0);
    if (at < 0) at = arr.length;
    arr.splice(at, 0, id);
    setView({ order: arr });
  };
  // A new column flashes and scrolls into view in each stage table.
  const showNewCol = (id) => {
    set({ newCol: id });
    requestAnimationFrame(() => {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.querySelectorAll('[data-col="' + id + '"]').forEach((el) => el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest', inline: 'center' }));
    });
    setTimeout(() => set((p) => (p.newCol === id ? { newCol: '' } : {})), 2600);
  };
  const STATUS_SEED = [['Not started', 'gray'], ['In progress', 'blue'], ['Done', 'green']];
  const seedOptions = (type) => type === 'Status' ? STATUS_SEED.map((x, i) => ({ id: crypto.randomUUID(), label: x[0], color_token: x[1], sort: (i + 1) * 10 })) : [];
  // Header + quick add (AddColumn.dc.html C): creates with defaults, then opens Edit property for the new column.
  const QA_SUGGEST = [['Status', 'Most used'], ['Date', ''], ['Person', '']];
  const quickFor = (gid) => (s.quickAdd !== gid ? null : {
    suggested: QA_SUGGEST.map((x) => ({ label: x[0], hint: x[1], icon: TYPE_ICON[x[0]] })),
    all: CTYPES.map((t) => ({ label: t[0], icon: t[1] })),
    hiddenCount: allKeys.filter((k) => isHid(k)).length,
    showHidden: () => set({ quickAdd: null, menu: 'cols' }),
    close: () => set({ quickAdd: null }),
    create: (type, name) => {
      set({ quickAdd: null });
      A.addField({ label: (name || '').trim() || type, type: type, onBoard: true, options: seedOptions(type) })
        .then((id) => { if (!id) return; showNewCol(id); set({ propSheet: { key: id, g: gid } }); });
    }
  });
  // ---------- Filter and sort UI models ----------
  const ruleId = () => Math.random().toString(36).slice(2, 10);
  const propLabel = (k) => (COLS[k] ? COLS[k].label : (customCols.find((x) => x.id === k) || {}).label || k);
  const propIcon = (k) => TYPE_ICON[typeOfCol(colDef(k))] || TYPE_ICON.Text;
  const PROPS = allKeys.filter((k) => propKind(k)).map((k) => ({ key: k, label: propLabel(k), icon: propIcon(k) }));
  const optionsFor = (k) => {
    const f = customCols.find((x) => x.id === k);
    if (f) {
      if (isSelectField(f)) return optList(f).map((o) => ({ id: o.label, label: o.label, tone: toneOf(o.color_token) }));
      if (kindOf(f) === 'person') return [{ id: '__me', label: 'Me' }].concat(D.directory.filter((x) => x.status === 'active' && ['super_admin', 'editor', 'designer'].indexOf(x.role) >= 0).map((x) => ({ id: x.id, label: x.name })));
      return [];
    }
    if (k === 'status') return D.statuses.map((x) => ({ id: x.label, label: x.label, tone: statusTone[x.label] || 'gray', variant: 'block' }));
    if (k === 'type') return D.types.map((x) => ({ id: x.label, label: x.label, tone: toneOf(x.color_token) }));
    if (k === 'channel') return D.channels.map((x) => ({ id: x.name, label: x.name }));
    if (k === 'sponsor') return D.accounts.filter((a) => a.type === 'sponsor').map((a) => ({ id: a.name, label: a.name }));
    if (PILL[k]) return Object.keys(PILL[k]).map((v) => ({ id: v, label: v, tone: PILL[k][v] }));
    if (COLS[k] && COLS[k].kind === 'dot') return Object.keys(DOT).map((v) => ({ id: v, label: v }));
    if (k === 'editor' || k === 'designer') return [{ id: '__me', label: 'Me' }].concat((k === 'editor' ? editorNames : designerNames).map((n) => ({ id: n, label: n })));
    return [];
  };
  const defaultValue = (pk, op) => (pk === 'select' || pk === 'person' ? [] : pk === 'date' ? (op === 'within' ? { range: 'next_week' } : { rel: 'today' }) : '');
  const newRule = (k) => { const pk = propKind(k); const op = OPS[pk][0][0]; return { id: ruleId(), key: k, op: op, value: defaultValue(pk, op) }; };
  const opLabelOf = (rule) => ((OPS[propKind(rule.key)] || []).find((x) => x[0] === rule.op) || ['', ''])[1];
  // "Status: Filming, Editing", "Pub Date: is before Today".
  const summaryOf = (rule) => {
    const pk = propKind(rule.key), op = rule.op, v = rule.value;
    if (NO_VALUE.indexOf(op) >= 0) return opLabelOf(rule);
    if (pk === 'select' || pk === 'person') {
      const names = (Array.isArray(v) ? v : []).map((id) => (optionsFor(rule.key).find((o) => o.id === id) || { label: id }).label);
      return names.length ? (op === 'none' ? 'not ' : '') + names.join(', ') : 'Any';
    }
    if (pk === 'date') {
      if (op === 'within') return 'within ' + (((WITHIN.find((x) => x[0] === (v || {}).range)) || ['', ''])[1]).toLowerCase();
      const lbl = v && v.rel === 'exact' ? fmtDate(isoDate(v.date), 'short') : ((DATE_REL.find((x) => x[0] === (v || {}).rel)) || ['', 'Today'])[1];
      return opLabelOf(rule) + ' ' + lbl;
    }
    return v === '' || v == null ? 'Any' : opLabelOf(rule) + ' ' + (pk === 'text' ? '"' + v + '"' : v);
  };
  const setFilter = (rules) => setView({ filter: { rules: rules } });
  const setAdv = (adv) => setView({ advanced: adv });
  const setSorts = (list) => setView({ sorts: list, sort: undefined });
  const toggleIn2 = (list, id) => { const l = Array.isArray(list) ? list : []; return l.indexOf(id) >= 0 ? l.filter((x) => x !== id) : l.concat([id]); };
  // One rule's editor: operator, then a value control for its type. upd(patch) saves, remove() deletes.
  const ruleModel = (rule, upd, remove, extra) => {
    const pk = propKind(rule.key);
    const v = rule.value;
    const sum = summaryOf(rule), ol = opLabelOf(rule);
    // The value alone, for the advanced filter's value cell, which sits next to its own operator cell.
    const valueLabel = rule.op === 'within' ? ((WITHIN.find((x) => x[0] === (v || {}).range)) || ['', 'Any'])[1]
      : rule.op === 'none' && sum.indexOf('not ') === 0 ? sum.slice(4)
      : sum.indexOf(ol + ' ') === 0 ? sum.slice(ol.length + 1) : sum;
    return Object.assign({
      id: rule.id, key: rule.key, label: propLabel(rule.key), icon: propIcon(rule.key), kind: pk, op: rule.op, opLabel: ol,
      summary: sum, valueLabel: valueLabel, needsValue: NO_VALUE.indexOf(rule.op) < 0,
      ops: OPS[pk].map((x) => ({ id: x[0], label: x[1], on: x[0] === rule.op, pick: () => upd({ op: x[0], value: (x[0] === 'within') !== (rule.op === 'within') || !v ? defaultValue(pk, x[0]) : v }) })),
      options: optionsFor(rule.key).map((o) => Object.assign({}, o, { on: Array.isArray(v) && v.indexOf(o.id) >= 0, toggle: () => upd({ value: toggleIn2(v, o.id) }) })),
      text: typeof v === 'string' ? v : '', setText: (t) => upd({ value: t }),
      date: pk !== 'date' ? null : {
        within: rule.op === 'within',
        rels: DATE_REL.map((x) => ({ id: x[0], label: x[1], on: !!v && v.rel === x[0], pick: () => upd({ value: { rel: x[0] } }) })),
        ranges: WITHIN.map((x) => ({ id: x[0], label: x[1], on: !!v && v.range === x[0], pick: () => upd({ value: { range: x[0] } }) })),
        exact: v && v.rel === 'exact' ? v.date : '', setExact: (iso) => upd({ value: iso ? { rel: 'exact', date: iso } : { rel: 'today' } })
      },
      props: PROPS.map((p2) => Object.assign({}, p2, { on: p2.key === rule.key, pick: () => { const nr = newRule(p2.key); upd({ key: p2.key, op: nr.op, value: nr.value }); } })),
      remove: remove
    }, extra || {});
  };
  const openRuleFor = (k) => {
    const ex = FL.find((x) => x.key === k);
    if (ex) { set({ menu: 'rule:' + ex.id }); return; }
    const nr = newRule(k);
    setFilter(FL.concat([nr]));
    set({ menu: 'rule:' + nr.id });
  };
  // Advanced filter: rows and one level of groups. Each change saves the whole block.
  const advItems = ADV ? ADV.items : [];
  const advJoin = ADV ? ADV.join || 'and' : 'and';
  const saveAdv = (items, join) => setAdv(items.length ? { join: join || advJoin, items: items } : null);
  const mapIn = (items, id, fn) => items.map((it) => (it.group ? Object.assign({}, it, { rules: mapIn(it.rules || [], id, fn) }) : it.id === id ? fn(it) : it))
    .filter((it) => it && (!it.group || (it.rules || []).length));
  const JOIN_L = { and: 'And', or: 'Or' };
  const advRow = (rule, i, join, setJoin) => ruleModel(rule, (patch) => saveAdv(mapIn(advItems, rule.id, (x) => Object.assign({}, x, patch))), () => saveAdv(mapIn(advItems, rule.id, () => null)), {
    joinLabel: i === 0 ? 'Where' : JOIN_L[join], canJoin: i === 1, setJoin: setJoin, open: s.menu === 'advanced' ? (s.advPart || '') : '',
    duplicate: () => saveAdv(mapIn(advItems, rule.id, (x) => x).reduce((a, it) => a.concat(it.id === rule.id ? [it, Object.assign({}, it, { id: ruleId() })] : [it.group ? Object.assign({}, it, { rules: it.rules.reduce((b, rr) => b.concat(rr.id === rule.id ? [rr, Object.assign({}, rr, { id: ruleId() })] : [rr]), []) }) : it]), []))
  });
  const advModel = !ADV ? null : {
    rows: advItems.map((it, i) => (it.group ? {
      group: true, id: it.id, joinLabel: i === 0 ? 'Where' : JOIN_L[advJoin], canJoin: i === 1, setJoin: (j) => saveAdv(advItems, j),
      rows: (it.rules || []).map((rl, j) => advRow(rl, j, it.join || 'and', (jj) => saveAdv(advItems.map((x) => (x.id === it.id ? Object.assign({}, x, { join: jj }) : x))))),
      addRule: () => saveAdv(advItems.map((x) => (x.id === it.id ? Object.assign({}, x, { rules: x.rules.concat([newRule(PROPS[0].key)]) }) : x))),
      remove: () => saveAdv(advItems.filter((x) => x.id !== it.id))
    } : advRow(it, i, advJoin, (j) => saveAdv(advItems, j)))),
    addRule: () => saveAdv(advItems.concat([newRule(PROPS[0].key)])),
    addGroup: () => saveAdv(advItems.concat([{ id: ruleId(), group: true, join: 'and', rules: [newRule(PROPS[0].key)] }])),
    clear: () => { setAdv(null); set({ menu: '' }); }
  };
  const sortModel = {
    items: SORTS.map((x, i) => ({
      key: x.key, label: propLabel(x.key), icon: propIcon(x.key), dir: x.dir, dirLabel: x.dir === 'asc' ? 'Ascending' : 'Descending',
      setDir: (d) => setSorts(SORTS.map((y, j) => (j === i ? { key: y.key, dir: d } : y))),
      props: PROPS.filter((p2) => p2.key === x.key || !SORTS.some((y) => y.key === p2.key)).map((p2) => Object.assign({}, p2, { on: p2.key === x.key, pick: () => setSorts(SORTS.map((y, j) => (j === i ? { key: p2.key, dir: y.dir } : y))) })),
      remove: () => setSorts(SORTS.filter((_, j) => j !== i))
    })),
    canAdd: PROPS.some((p2) => !SORTS.some((y) => y.key === p2.key)),
    add: () => { const p2 = PROPS.find((x) => !SORTS.some((y) => y.key === x.key)); if (p2) setSorts(SORTS.concat([{ key: p2.key, dir: 'asc' }])); },
    move: (from, to) => { const l = SORTS.slice(); const it = l.splice(from, 1)[0]; l.splice(Math.max(0, Math.min(to, l.length)), 0, it); setSorts(l); },
    clear: () => { setSorts([]); set({ menu: '' }); },
    label: !SORTS.length ? '' : SORTS.length === 1 ? propLabel(SORTS[0].key) : SORTS.length + ' sorts',
    dir: SORTS.length === 1 ? SORTS[0].dir : ''
  };
  const roleLabel = (ROLES.find((x) => x.id === s.role) || {}).label || '';
  const roleSorts = roleView && Array.isArray(roleView.sorts) ? roleView.sorts : [];
  const viewChanged = JSON.stringify([FL, ADV, SORTS]) !== JSON.stringify([((roleView || {}).filter || {}).rules || [], (roleView || {}).advanced || null, roleSorts]);
  const menuOf = (id) => s.menu === id;
  const fx = {
    show: rulesCount > 0 || SORTS.length > 0,
    rules: FL.map((rule) => ruleModel(rule, (patch) => setFilter(FL.map((x) => (x.id === rule.id ? Object.assign({}, x, patch) : x))),
      () => { setFilter(FL.filter((x) => x.id !== rule.id)); set({ menu: '' }); }, {
        open: menuOf('rule:' + rule.id), toggle: () => set({ menu: menuOf('rule:' + rule.id) ? '' : 'rule:' + rule.id }),
        toAdvanced: () => { setView({ filter: { rules: FL.filter((x) => x.id !== rule.id) }, advanced: { join: advJoin, items: advItems.concat([rule]) } }); set({ menu: 'advanced' }); }
      })),
    props: PROPS.map((p2) => Object.assign({}, p2, { pick: () => { const nr = newRule(p2.key); setFilter(FL.concat([nr])); set({ menu: 'rule:' + nr.id }); } })),
    addOpen: menuOf('addfilter'), toggleAdd: () => set({ menu: menuOf('addfilter') ? '' : 'addfilter' }),
    addAdvanced: () => { saveAdv(advItems.concat([newRule(PROPS[0].key)])); set({ menu: 'advanced' }); },
    adv: advModel, advCount: advRules.length, advOpen: menuOf('advanced'), toggleAdv: () => set({ menu: menuOf('advanced') ? '' : 'advanced' }),
    sort: sortModel, sortChipOpen: menuOf('sortchip'), toggleSortChip: () => set({ menu: menuOf('sortchip') ? '' : 'sortchip' }),
    closeMenu: () => set({ menu: '' }),
    canReset: viewChanged, reset: () => { setView({ filter: (roleView || {}).filter || null, advanced: (roleView || {}).advanced || null, sorts: roleSorts }); set({ menu: '' }); },
    clearAll: () => { setView({ filter: null, advanced: null }); set({ menu: '', q: '', person: 'All' }); },
    editFilters: () => set({ menu: FL.length ? 'rule:' + FL[0].id : ADV ? 'advanced' : 'addfilter' }),
    canSave: me.dbRole === 'super_admin', saveLabel: 'Save for ' + roleLabel + ' view',
    save: () => A.saveRoleView(s.role, curView, Object.assign({}, VS, { sort: undefined }), roleLabel)
  };

  let pickAllFor = () => null;
  const headFor = (gid, G) => cols.map((c, i) => {
    const last = i === cols.length - 1;
    if (c.kind === 'add') {
      return { label: '', col: c.key, isAdd: true, isLabel: false, style: addHeadStyle(last) + (s.quickAdd === gid ? ' position: relative; z-index: 40;' : ''),
        quickOpen: s.quickAdd === gid, quick: quickFor(gid), onAdd: () => set({ quickAdd: s.quickAdd === gid ? null : gid, menu: '', colMenu: null }) };
    }
    const interactive = !isSponsorRole;
    const open = interactive && !!(CM && CM.g === gid && CM.key === c.key);
    const isCustom = c.kind === 'custom';
    const f = c.field || null;
    const tLabel = typeOfCol(c);
    const gbId = GROUP_OF[c.key];
    const canGroup = !!gbId && gbOpts.some((o) => o.id === gbId);
    const so = SORTS.find((x) => x.key === c.key);
    const sortDir = so ? so.dir : '';
    const close = () => set({ colMenu: null });
    // The header sets one sort; picking the active one again clears it.
    const sortTo = (dir) => () => { close(); setSorts(sortDir === dir && SORTS.length === 1 ? [] : [{ key: c.key, dir: dir }]); };
    const insert = (side) => () => {
      close();
      A.addField({ label: 'Text', type: 'Text', onBoard: true }).then((id) => { if (!id) return; placeAt(id, c.key, side); flashCol(id); set({ colMenu: { g: gid, key: id } }); });
    };
    return {
      label: c.label, col: c.key, isAdd: false, isLabel: true, interactive: interactive, cls: c.key === s.newCol ? 'fb-colnew' : undefined,
      pickAll: c.kind === 'title' ? pickAllFor(gid, G) : null,
      style: 'position: relative; height: 44px; box-sizing: border-box; border-bottom: 1px solid ' + line + '; border-right: 1px solid ' + colLine + '; display: flex; align-items: stretch; padding: 0; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2); white-space: nowrap; background: var(--surface);' +
        (i === 0 ? (freezeFirst ? ' position: sticky; left: 0; z-index: 2;' + (frozenIdx === 0 ? FROZEN_EDGE : '') : '') + ' border-top-left-radius: 20px;' : stickyAt(i, true)) +
        (last ? ' border-top-right-radius: 20px; border-right: 0;' : '') + (open ? ' z-index: 40;' : ''),
      btnStyle: 'position: relative; flex: 1; min-width: 0; display: flex; align-items: center; justify-content: ' + (i === 0 ? 'flex-start' : 'center') + '; gap: 6px; margin: 0; padding: 0 12px 0 ' + (i === 0 ? (isAdmin ? 10 : 20) : 12) + 'px; border: 0; border-radius: inherit; background: ' + (open ? 'var(--hover)' : 'transparent') + '; color: inherit; font: inherit; letter-spacing: normal; cursor: ' + (interactive ? 'pointer' : 'default') + ';' + (open ? ' box-shadow: inset 0 0 0 2px var(--ink); color: var(--ink);' : ''),
      icon: TYPE_ICON[tLabel] || TYPE_ICON.Text, typeLabel: tLabel, open: open,
      toggle: () => set({ colMenu: open ? null : { g: gid, key: c.key }, cellEdit: null, menu: '' }), close: close,
      align: popAlign(i, cols.length), sortDir: sortDir, filtered: !!ruledKeys[c.key], frozen: i > 0 && i === frozenIdx,
      draggable: interactive && i > 0, onMove: (target, side) => placeAt(c.key, target, side),
      canResize: interactive, width: c.w,
      onResize: (w) => setView({ widths: Object.assign({}, WID, { [c.key]: w == null ? undefined : Math.round(Math.max(80, Math.min(640, w))) }) }),
      menu: !interactive ? null : {
        canRename: isAdmin && isCustom, rename: (v) => { if (f) A.renameField(f, v); },
        options: isAdmin && isSelectField(f) ? optModel(f) : null,
        canEditProperty: isAdmin, editProperty: () => set({ colMenu: null, propSheet: { key: c.key, g: gid } }),
        showAs: c.key === 'status' && !isAdmin ? { value: statusShow, options: [{ id: 'block', label: 'Block' }, { id: 'pill', label: 'Pill' }, { id: 'checkbox', label: 'Checkbox' }, { id: 'bar', label: 'Stage bar' }], set: (v) => setView({ show: Object.assign({}, SHOW, { status: v }) }) } : null,
        canChangeType: isAdmin && isCustom,
        types: FIELD_TYPES.map((t) => ({ label: t, icon: TYPE_ICON[t], on: t === tLabel, pick: () => { close(); A.changeFieldType(f, t); } })),
        canFilter: !!propKind(c.key), filter: () => { set({ colMenu: null }); openRuleFor(c.key); },
        sortDir: sortDir, sortAsc: sortTo('asc'), sortDesc: sortTo('desc'),
        canGroup: canGroup, grouped: canGroup && gb === gbId, groupLabel: 'Group by ' + c.label,
        group: () => { close(); setView({ groupBy: gb === gbId ? 'stage' : gbId }); },
        canFreeze: i > 0, frozen: i > 0 && i === frozenIdx, freeze: () => { close(); setView(frozenIdx === i ? { frozen: null } : { frozen: c.key, freezeFirst: true }); },
        canHide: c.key !== 'project', hide: () => { close(); setView({ hidden: Object.assign({}, hidden, { [hk(c.key)]: true }) }); },
        canWrap: !!WRAPS[c.kind], wrapped: !!WRAP[c.key], wrap: () => setView({ wrap: Object.assign({}, WRAP, { [c.key]: !WRAP[c.key] }), wrapAll: false }),
        canInsertLeft: isAdmin && i > 0, canInsertRight: isAdmin, insertLeft: insert('left'), insertRight: insert('right'),
        canDuplicate: isAdmin && isCustom,
        duplicate: () => { close(); A.duplicateField(f).then((id) => { if (!id) return; placeAt(id, c.key, 'right'); flashCol(id); set({ colMenu: { g: gid, key: id } }); }); },
        canDelete: isAdmin && isCustom, askDelete: () => set({ colMenu: null, colDelete: c.key })
      }
    };
  });

  // ---------- Edit property sheet (docs/design/database-components/EditProperty.dc.html) ----------
  // Same shell for every column: name, type, the type's settings, display, who sees it, then duplicate and delete.
  // Super Admin only. Built-in columns keep their name and type; their settings live in workspace_settings.column_config.
  const STATUS_SHOW = [{ id: 'block', label: 'Block' }, { id: 'pill', label: 'Pill' }, { id: 'checkbox', label: 'Checkbox' }, { id: 'bar', label: 'Stage bar' }];
  const ROLE_IDS = ['admin', 'editor', 'designer', 'sponsor'];
  const ROLE_NAME = { admin: 'Super Admin', editor: 'Editor', designer: 'Designer', sponsor: 'Sponsor' };
  // Built-in columns the sponsor portal can fill in; the rest stay off for sponsors.
  const PORTAL_COLS = ['project', 'channel', 'type', 'status', 'film', 'pub', 'sponsor', 'approval', 'link'];
  const PS = isAdmin && s.propSheet && (COLS[s.propSheet.key] || customCols.some((x) => x.id === s.propSheet.key)) ? s.propSheet : null;
  let sheet = { open: false };
  if (PS) {
    const c = colDef(PS.key);
    const f = c.field || null;
    const conf = confOf(c.key);
    const tLabel = typeOfCol(c);
    const setConf = (patch) => (f ? A.setFieldConfig(f, patch) : A.setColumnConfig(c.key, patch));
    const close = () => set({ propSheet: null });
    const kind = c.key === 'status' ? 'status' : isSelectField(f) ? 'select' : f && f.type === 'number' ? 'number' : tLabel === 'Date' && (f || c.kind === 'date') ? 'date' : c.kind === 'person' ? 'person' : 'other';
    const sample = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
    const roles = ROLE_IDS.map((rid) => {
      const R = ROLES.find((x) => x.id === rid) || { cols: [] };
      const on = rid === 'admin' || (f ? (f.visible_roles || []).some((x) => DB_ROLES[rid].indexOf(x) >= 0) : R.cols.indexOf(c.key) >= 0);
      const locked = rid === 'admin' || c.key === 'project' || (!f && rid === 'sponsor' && PORTAL_COLS.indexOf(c.key) < 0);
      return {
        id: rid, label: ROLE_NAME[rid], on: on, locked: locked,
        note: rid === 'admin' ? 'Super Admins see every column' : locked && rid === 'sponsor' ? 'The sponsor portal does not share this column' : '',
        toggle: () => {
          if (locked) return;
          if (f) {
            const cur = ROLE_IDS.filter((x) => x !== 'admin' && (f.visible_roles || []).some((y) => DB_ROLES[x].indexOf(y) >= 0));
            A.setFieldRoles(f, on ? cur.filter((x) => x !== rid) : cur.concat([rid]));
          } else A.setRoleColumns(rid, on ? R.cols.filter((k) => k !== c.key) : R.cols.concat([c.key]), (on ? 'hid ' : 'showed ') + c.label + ' for', ROLE_NAME[rid]);
        }
      };
    });
    const numFmt = conf.number_format || 'number';
    sheet = {
      open: true, key: c.key, name: c.label, icon: TYPE_ICON[tLabel] || TYPE_ICON.Text, typeLabel: tLabel, isCustom: !!f, kind: kind,
      canRename: !!f, rename: (v) => { if (f) A.renameField(f, v); },
      canChangeType: !!f, types: FIELD_TYPES.map((t) => ({ label: t, icon: TYPE_ICON[t], on: t === tLabel, pick: () => A.changeFieldType(f, t) })),
      options: kind === 'select' ? optModel(f) : null,
      selectShow: kind === 'select' ? { value: conf.show_as === 'block' ? 'block' : 'pill', options: [{ id: 'pill', label: 'Pill' }, { id: 'block', label: 'Block' }], set: (v) => setConf({ show_as: v }) } : null,
      status: kind === 'status' ? statusModel() : null,
      statusShow: kind === 'status' ? { value: statusShow, options: STATUS_SHOW, set: (v) => setView({ show: Object.assign({}, SHOW, { status: v }) }) } : null,
      number: kind !== 'number' ? null : {
        formatLabel: (NUM_FMT.find((x) => x[0] === numFmt) || NUM_FMT[0])[1],
        formats: NUM_FMT.map((x) => ({ id: x[0], label: x[1], on: x[0] === numFmt, pick: () => setConf({ number_format: x[0] }) })),
        decLabel: conf.decimals == null ? 'Auto' : String(conf.decimals),
        dec: (d) => { const cur = conf.decimals == null ? (numFmt === 'usd' || numFmt === 'eur' ? 2 : 0) : conf.decimals; setConf({ decimals: Math.max(0, Math.min(4, cur + d)) }); },
        show: { value: conf.show_as === 'bar' || conf.show_as === 'ring' ? conf.show_as : 'number', options: [{ id: 'number', label: 'Number' }, { id: 'bar', label: 'Bar' }, { id: 'ring', label: 'Ring' }], set: (v) => setConf({ show_as: v }) },
        preview: numChips(numFmt === 'percent' || conf.show_as === 'bar' || conf.show_as === 'ring' ? 45 : 4500, conf),
        footerLabel: (CALC.find((x) => x[0] === (conf.footer || 'none')) || CALC[0])[1],
        footers: CALC.map((x) => ({ id: x[0], label: x[1], on: x[0] === (conf.footer || 'none'), pick: () => setConf({ footer: x[0] }) }))
      },
      date: kind !== 'date' ? null : {
        formatLabel: fmtDate(sample(5), conf.date_format || 'short'),
        formats: DATE_FMT.map((id) => ({ id: id, label: fmtDate(sample(5), id), on: id === (conf.date_format || 'short'), pick: () => setConf({ date_format: id }) })),
        due: dueOn(c.key), toggleDue: () => setConf({ due_colors: !dueOn(c.key) }),
        preview: [[5, 'normal'], [0, 'today'], [-4, 'late']].map((x) => ({ text: fmtDate(sample(x[0]), conf.date_format || 'short'), style: dateChipStyle(dueOn(c.key) ? x[1] : 'normal') }))
      },
      person: kind !== 'person' ? null : {
        show: { value: SHOW[c.key] === 'avatar' ? 'avatar' : 'name', options: [{ id: 'name', label: 'Avatar + name' }, { id: 'avatar', label: 'Avatar' }], set: (v) => setView({ show: Object.assign({}, SHOW, { [c.key]: v }) }) },
        name: (c.key === 'designer' ? designerNames : editorNames)[0] || me.fullName || 'Team member'
      },
      cards: f ? { on: !!conf.show_on_cards, toggle: () => setConf({ show_on_cards: !conf.show_on_cards }) } : null,
      roles: roles,
      canDuplicate: !!f, duplicate: () => { close(); A.duplicateField(f).then((id) => { if (id) { placeAt(id, c.key, 'right'); flashCol(id); } }); },
      canDelete: !!f, askDelete: () => set({ propSheet: null, colDelete: c.key }),
      close: close, back: () => set({ propSheet: null, colMenu: { g: PS.g, key: c.key } })
    };
    if (sheet.person) {
      sheet.person.initials = sheet.person.name.slice(0, 1);
      sheet.person.avatarStyle = avatar(sheet.person.name, 24);
    }
  }

  // Footer totals for custom number columns (Edit property > Footer total), one row under each group's table.
  const calcOf = (c) => (c.kind === 'custom' && c.ftype === 'number' ? (c.field.config || {}).footer || 'none' : 'none');
  const hasCalc = calcOn && cols.some((c) => calcOf(c) !== 'none');
  const calcFor = (rs) => cols.map((c, i) => {
    const kind = calcOf(c);
    const cell = 'min-height: 40px; box-sizing: border-box; border-bottom: 1px solid ' + line + '; border-right: 1px solid ' + colLine + '; display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding: 0 12px; font-size: 12px; color: var(--muted-2); white-space: nowrap; background: var(--surface-2);' +
      (i === 0 ? (freezeFirst ? ' position: sticky; left: 0; z-index: 1;' : '') : stickyAt(i, false).replace('background: inherit;', 'background: var(--surface-2);')) + (i === cols.length - 1 ? ' border-right: 0;' : '');
    if (kind === 'none') return { label: '', value: '', style: cell };
    const ns = rs.map((r) => toNum((r.cf || {})[c.key] != null ? r.cf[c.key] : r[c.key])).filter((n) => n != null);
    const cf = c.field.config || {};
    const val = kind === 'count' ? String(ns.length) : kind === 'sum' && !ns.length ? fmtNum(0, cf) : !ns.length ? '' : fmtNum(kind === 'sum' ? ns.reduce((a, b) => a + b, 0) : kind === 'avg' ? ns.reduce((a, b) => a + b, 0) / ns.length : kind === 'min' ? Math.min.apply(null, ns) : Math.max.apply(null, ns), cf);
    return { label: (CALC.find((x) => x[0] === kind) || ['', ''])[1], value: val, style: cell };
  });

  const closed = s.closed || {};
  // Group settings (Properties.dc.html C). Empty groups hide by default except for Stage, as before.
  const hideEmpty = VS.hideEmpty === undefined ? gb !== 'stage' : !!VS.hideEmpty;
  const showCounts = VS.showCounts !== false;
  const colorHeads = !!VS.colorHeads;
  const GROUP_ORDERS = [['manual', 'Manual'], ['az', 'A to Z'], ['za', 'Z to A'], ['count', 'Most projects first']];
  const groupOrder = GROUP_ORDERS.some((x) => x[0] === VS.groupOrder) ? VS.groupOrder : 'manual';
  const firstStatusOf = (gid) => {
    if (gb === 'stage') { const x = D.statuses.find((y) => STG[y.label] === gid); return x ? x.label : ''; }
    if (gb === 'status') return gid;
    return '';
  };
  // Kanban drag and drop: Stage and Status set the status, Type, Channel and Editor set that field.
  const dropField = gb === 'stage' || gb === 'status' ? 'status' : gb === 'none' ? '' : gb;
  const dropVal = (gid) => dropField === 'status' ? firstStatusOf(gid) : dropField === 'editor' && gid === 'Unassigned' ? '' : gid;
  const dragRow = s.dragJob ? jobRow[s.dragJob] || null : null;
  const openNew = (preset) => () => set(Object.assign({ npOpen: true, npErr: '', npTitle: '', npJob: '', npFilm: '', npPub: '', npStatus: '', npType: '', npChannel: '', npSponsor: '', npTemplate: '', npPromote: '', npCreated: null, menu: '' }, preset || {}));
  // Table checkboxes (Super Admin). s.picked holds project ids; shift-click picks the range from the last one in the
  // group. Only rows the board is showing count, so a filter never hides what a bulk action touches.
  const picked = isAdmin ? (s.picked || {}) : {};
  const pickedRows = sorted.filter((r) => picked[r.id]);
  const setPicked = (ids, on, anchor) => {
    const next = Object.assign({}, picked);
    ids.forEach((id) => { if (on) next[id] = true; else delete next[id]; });
    set(Object.assign({ picked: next, bulkConfirm: false }, anchor !== undefined ? { pickAnchor: anchor } : null));
  };
  const pickFor = (r, rs) => !isAdmin ? null : {
    on: !!picked[r.id], aria: 'Select ' + r.title,
    toggle: (e) => {
      const on = !picked[r.id];
      const a = rs.findIndex((x) => x.id === s.pickAnchor), b = rs.findIndex((x) => x.id === r.id);
      if (e && e.shiftKey && a >= 0 && b >= 0) setPicked(rs.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.id), on, r.id);
      else setPicked([r.id], on, r.id);
    }
  };
  pickAllFor = (gid, G) => {
    if (!isAdmin) return null;
    const rs = sorted.filter((r) => keyOf(r) === gid);
    const n = rs.filter((r) => picked[r.id]).length;
    return { on: rs.length > 0 && n === rs.length, mixed: n > 0 && n < rs.length, disabled: !rs.length, aria: 'Select every project in ' + (G ? G.title : 'this group'),
      toggle: () => setPicked(rs.map((r) => r.id), n < rs.length) };
  };
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
      dotStyle: 'width: 10px; height: 10px; border-radius: 999px; flex: none; background: ' + G.color + '; box-shadow: 0 0 0 4px color-mix(in srgb, ' + G.color + ' 15%, transparent);',
      showCount: showCounts, headTint: colorHeads ? ' padding: 4px 12px 4px 4px; border-radius: 12px; background: color-mix(in srgb, ' + G.color + ' 14%, transparent);' : '',
      closedK: !open, showLabel: 'Show ' + rs.length + (rs.length === 1 ? ' project' : ' projects'),
      showSlot: !!dragRow && s.dragOver === G.id && keyOf(dragRow) !== G.id,
      onDragOver: (e) => {
        if (!dragRow || keyOf(dragRow) === G.id || !dropVal(G.id) && dropField !== 'editor') return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        if (s.dragOver !== G.id) set({ dragOver: G.id });
      },
      onDragLeave: (e) => { if (s.dragOver === G.id && !(e.currentTarget.contains && e.currentTarget.contains(e.relatedTarget))) set({ dragOver: '' }); },
      onDrop: (e) => {
        e.preventDefault();
        const r = dragRow;
        set({ dragJob: '', dragOver: '' });
        if (!r || keyOf(r) === G.id) return;
        setField(r, dropField, dropVal(G.id), dropField === 'status' ? { event: 'status' } : undefined);
      },
      kanStyle: (s.dragOver === G.id && dragRow && keyOf(dragRow) !== G.id ? 'outline: 2px solid var(--ink); outline-offset: -2px; ' : '') + 'flex: ' + (open ? '1 1 320px' : '0 0 260px') + '; min-width: ' + (open ? '300px' : '260px') + '; max-width: 520px; box-sizing: border-box; background: var(--panel); border: 1px solid var(--line-2); border-top: 3px solid ' + G.color + '; border-radius: 24px; padding: 10px; display: flex; flex-direction: column; gap: 10px;',
      gridStyle: gridStyle, head: headFor(G.id, G), calc: calcFor(rs), hasCalc: hasCalc && rs.length > 0,
      rows: rs.map((r) => ({ cls: r.job === openJob || picked[r.id] ? 'row row-on' : 'row', gridStyle: gridStyle, cells: cols.map((c, i) => {
        const o = cellFor(c, r, i === cols.length - 1, i);
        if (o.isTitle) o.pick = pickFor(r, rs);
        if (i === 0 && !freezeFirst) o.style += UNPIN;
        else if (i === 0 && frozenIdx > 0) o.style += ' box-shadow: none;';
        else if (i > 0 && i <= frozenIdx) o.style += stickyAt(i, false) + (o.editing ? ' z-index: 30;' : '');
        return Object.assign(o, c.key === s.newCol ? { cls: 'fb-colnew' } : null);
      }) })),
      cards: rs.map(cardFor),
      items: rs.map(tlItem),
      isEmpty: rs.length === 0,
      emptyText: filtersOn ? 'No projects match the current filters in this group.' : isSponsorRole && !acct ? 'Your portal access is turned off. Ask the studio to turn it back on.' : 'Nothing in this stage for ' + scopeName + '.',
      noMatch: rulesCount > 0 && rs.length === 0, noMatchText: (rulesCount === 1 ? '1 rule' : rulesCount + ' rules') + ' active in ' + G.title + '.',
      canEdit: canEdit
    };
  });
  if (hideEmpty) groups = groups.filter((g) => g.count > 0);
  if (groupOrder !== 'manual') {
    groups = groups.slice().sort((a, b) => groupOrder === 'count' ? b.count - a.count || a.title.localeCompare(b.title)
      : (groupOrder === 'za' ? -1 : 1) * a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
  }

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

  const added = s.added || {};
  const addedPeople = Object.keys(added).filter((k) => added[k]);
  const rolePeople = (s.role === 'editor' ? editorNames : s.role === 'designer' ? designerNames : editorNames.concat(designerNames)).concat(addedPeople.filter((p) => editorNames.concat(designerNames).indexOf(p) < 0));
  const personItems = [item('Everyone', s.person === 'All', () => set({ person: 'All', menu: '' }), scoped.length)]
    .concat(rolePeople.map((p) => item(p, s.person === p, () => set({ person: p, menu: '' }), scoped.filter((r) => r.editor === p || r.designer === p).length)));
  // ---------- View panels (Properties.dc.html): properties, column presets, group, layout ----------
  const allColKeys = roleCols.concat(customCols.map((cc) => cc.id));
  const colIcon = (k) => TYPE_ICON[typeOfCol(colDef(k))] || TYPE_ICON.Text;
  const shownKeys = allKeys.filter((k) => !isHid(k));
  const setHidden = (keys, on) => { const h = Object.assign({}, hidden); keys.forEach((k) => { h[hk(k)] = on; }); setView({ hidden: h }); };
  const propsModel = {
    shown: shownKeys.map((k) => ({ key: k, label: propLabel(k), icon: colIcon(k), locked: k === 'project', hide: () => setHidden([k], true) })),
    hidden: allKeys.filter((k) => isHid(k)).map((k) => ({ key: k, label: propLabel(k), icon: colIcon(k), show: () => setHidden([k], false) })),
    hideAll: () => setHidden(allColKeys.filter((k) => k !== 'project'), true),
    showAll: () => setHidden(allColKeys, false),
    // Dragging in "Shown in table": shown columns take the new order, hidden ones follow in theirs. Project stays first.
    move: (key, to) => {
      const arr = shownKeys.filter((k) => k !== 'project' && k !== key);
      arr.splice(Math.min(Math.max(0, to), arr.length), 0, key);
      setView({ order: arr.concat(allKeys.filter((k) => k !== 'project' && isHid(k))) });
    },
    canNew: isAdmin, addNew: () => set({ menu: '', modal: 'column', newColName: '', colStep: '', colMenu: null })
  };
  // Column presets (Super Admin view). Built-ins show and hide the role's own columns; custom columns keep theirs.
  // Saved presets (workspace_settings.column_presets) keep the shown columns and their order.
  const PRESETS = (defCols ? [['Essentials', defCols]] : []).concat([['All fields', null], ['Production', ['job', 'channel', 'type', 'film', 'status']], ['Post', ['job', 'editor', 'editStatus', 'editDue', 'designer', 'thumb', 'thumbDue', 'status']], ['Publishing', ['type', 'pub', 'approval', 'status', 'clipping', 'newsletter', 'community', 'distribute', 'link']], ['Sponsor', ['channel', 'sponsor', 'approval', 'status', 'pub', 'link']]]);
  const savedPresets = Array.isArray(D.settings && D.settings.column_presets) ? D.settings.column_presets.filter((x) => x && x.id && Array.isArray(x.columns)) : [];
  const presetKeys = roleCols.filter((k) => k !== 'project');
  const nCols = (n) => n + (n === 1 ? ' column' : ' columns');
  const builtIn = PRESETS.map((p) => {
    const keep = p[1];
    return {
      id: 'b:' + p[0], label: p[0], custom: false, count: nCols(roleCols.filter((k) => k === 'project' || !keep || keep.indexOf(k) >= 0).length),
      on: presetKeys.every((k) => (keep ? keep.indexOf(k) >= 0 : true) === !isHid(k)),
      pick: () => { const h = Object.assign({}, hidden); presetKeys.forEach((k) => { h[hk(k)] = !!keep && keep.indexOf(k) < 0; }); setView({ hidden: h }); }
    };
  });
  const custom = savedPresets.map((p) => {
    const keys = p.columns.filter((k) => allColKeys.indexOf(k) >= 0);
    return {
      id: p.id, label: p.name, custom: true, count: nCols(keys.length + (keys.indexOf('project') < 0 && has('project') ? 1 : 0)),
      on: allColKeys.every((k) => k === 'project' || (keys.indexOf(k) >= 0) === !isHid(k)),
      pick: () => {
        const h = Object.assign({}, hidden);
        allColKeys.forEach((k) => { if (k !== 'project') h[hk(k)] = keys.indexOf(k) < 0; });
        const rest = allKeys.filter((k) => k !== 'project' && keys.indexOf(k) < 0);
        setView({ hidden: h, order: keys.filter((k) => k !== 'project').concat(rest) });
      },
      remove: () => A.saveColumnPresets(savedPresets.filter((x) => x.id !== p.id), 'deleted the column preset', p.name)
    };
  });
  const presetItems = builtIn.concat(custom);
  const presetOn = presetItems.find((x) => x.on);
  // Set default per role: writes the preset's hidden set into that role's starting table view.
  const roleDefaults = ROLES.map((R) => {
    const rKeys = R.cols.filter((k) => k !== 'project');
    const list = PRESETS.filter((p) => p[0] !== 'Essentials' || DEF_COLS[R.id]).map((p) => [p[0], p[0] === 'Essentials' ? DEF_COLS[R.id] : p[1]])
      .concat(savedPresets.map((p) => [p.name, p.columns]))
      .filter((p) => !p[1] || rKeys.some((k) => p[1].indexOf(k) >= 0));
    const mapOf = (keep) => { const h = {}; rKeys.forEach((k) => { h[R.id + ':' + k] = !!keep && keep.indexOf(k) < 0; }); return h; };
    const cur = ((cfgOf(dbFor(R.id)).view_state || {}).table || {}).hidden;
    const matches = (keep) => !!cur && rKeys.every((k) => !!cur[R.id + ':' + k] === (!!keep && keep.indexOf(k) < 0));
    const hit = list.find((p) => matches(p[1]));
    const curLabel = !cur ? (DEF_COLS[R.id] ? 'Essentials' : 'All fields') : hit ? hit[0] : 'Custom';
    return {
      id: R.id, label: R.label, current: curLabel,
      presets: list.map((p) => ({
        id: p[0], label: p[0], on: p[0] === curLabel,
        pick: () => A.patchRoleView(R.id, 'table', { hidden: mapOf(p[1]) }, R.label, R.label + ' now starts with the ' + p[0] + ' columns. People who changed their own view keep theirs.')
      }))
    };
  });
  const presetsModel = {
    show: s.role === 'admin', items: presetItems, current: presetOn ? presetOn.label : 'Custom',
    canManage: me.dbRole === 'super_admin',
    save: (name) => {
      const n = (name || '').trim();
      if (!n) return;
      const id = 'p' + Math.random().toString(36).slice(2, 9);
      A.saveColumnPresets(savedPresets.concat([{ id: id, name: n, columns: shownKeys.slice() }]), 'saved the column preset', n);
    },
    roles: roleDefaults
  };
  const hiddenCount = allColKeys.filter((k) => isHid(k)).length;
  const colsChanged = allColKeys.some((k) => isHid(k) !== defHid(k));
  const GB_ICON = { stage: 'M2.5 4h11v3h-11zM2.5 9h11v3h-11z', status: TYPE_ICON.Status, type: TYPE_ICON.Select, channel: TYPE_ICON.Select, editor: TYPE_ICON.Person, none: 'M3.5 3.5l9 9M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11z' };
  const groupModel = {
    options: gbOpts.map((o) => ({ id: o.id, label: o.label, icon: GB_ICON[o.id], on: gb === o.id, pick: () => setView({ groupBy: o.id }) })),
    hideEmpty: hideEmpty, setHideEmpty: (v) => setView({ hideEmpty: v }),
    showCounts: showCounts, setShowCounts: (v) => setView({ showCounts: v }),
    colorHeads: colorHeads, setColorHeads: (v) => setView({ colorHeads: v }),
    order: groupOrder, orderLabel: (GROUP_ORDERS.find((x) => x[0] === groupOrder) || GROUP_ORDERS[0])[1],
    orders: GROUP_ORDERS.map((x) => ({ id: x[0], label: x[1], on: x[0] === groupOrder, pick: () => setView({ groupOrder: x[0] }) }))
  };
  const layoutModel = {
    rowHeight: rowHeight, rowHeights: [{ id: 'compact', label: 'Compact' }, { id: 'default', label: 'Default' }, { id: 'tall', label: 'Tall' }], setRowHeight: (v) => setView({ rowHeight: v }),
    openIn: openIn, openIns: OPEN_IN.map((x) => ({ id: x[0], label: x[1] })), setOpenIn: (v) => setView({ openIn: v }),
    freeze: freezeFirst, setFreeze: (v) => setView(v ? { freezeFirst: true } : { freezeFirst: false, frozen: null }),
    wrapAll: !!VS.wrapAll, setWrapAll: (v) => setView(v ? { wrapAll: true } : { wrapAll: false, wrap: {} }),
    calc: calcOn, setCalc: (v) => setView({ calcRow: v })
  };
  const archivedN = D.rows.filter((r) => r.archived).length;
  const archiveItems = s.role === 'admin' ? [item('Show archived projects (' + archivedN + ')', showArchived, () => set({ showArchived: !showArchived, menu: '' }))] : [];

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

  // Step 1 picks a type; step 2 (AddColumn.jsx) collects its settings before the column exists.
  const ctItem = (t) => ({ label: t[0], icon: t[1], pick: () => set({ colStep: t[0] }) });
  const CT_DESC = {
    Text: 'Plain text in each cell.', Number: 'Numbers, money or percents.', Select: 'One option per cell.', 'Multi select': 'Several options per cell.',
    Status: 'Progress through a few set states.', Date: 'A date, a range or a date and time.', Person: 'Team members on the project.',
    'Files & media': 'Files and links to them.', Checkbox: 'Done or not done.', URL: 'A link.', Email: 'An email address.', Phone: 'A phone number.',
    Relation: 'Links to other projects.', Formula: 'Calculated from other columns.', 'Created time': 'When the project was created.', 'Last edited by': 'Who changed the project last.'
  };
  const ctKind = (type) => type === 'Select' || type === 'Multi select' || type === 'Status' ? 'select' : type === 'Number' ? 'number' : type === 'Date' ? 'date'
    : type === 'Person' ? 'person' : type === 'Checkbox' ? 'checkbox' : type === 'Formula' ? 'formula' : 'plain';
  const colStep = isAdmin && s.modal === 'column' && s.colStep && CTYPES.some((t) => t[0] === s.colStep) ? s.colStep : '';
  const sampleDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
  const addCol = !colStep ? null : {
    type: colStep, icon: TYPE_ICON[colStep], desc: CT_DESC[colStep] || '', kind: ctKind(colStep), multi: colStep === 'Multi select',
    name: (s.newColName || '').trim() || colStep, seed: seedOptions(colStep), palette: OPT_PAL,
    sorts: Object.keys(SORT_L).map((k) => ({ id: k, label: SORT_L[k] })),
    numFormats: NUM_FMT.map((x) => ({ id: x[0], label: x[1] })), calcs: CALC.map((x) => ({ id: x[0], label: x[1] })),
    dateFormats: DATE_FMT.map((id) => ({ id: id, label: fmtDate(sampleDay, id) })),
    roles: ROLE_IDS.map((rid) => ({ id: rid, label: ROLE_NAME[rid], locked: rid === 'admin' })),
    checkFormula: (src) => compileFormula(src),
    back: () => set({ colStep: '' }),
    close: () => set({ modal: '', colStep: '', newColName: '' }),
    create: (d) => {
      set({ modal: '', colStep: '', newColName: '' });
      A.addField({ label: (d.name || '').trim() || colStep, type: colStep, onBoard: true, options: d.options, config: d.config, roles: d.roles })
        .then((id) => { if (id) showNewCol(id); });
    }
  };
  const colTypesBasic = CTYPES.filter((t) => t[2] === 'b').map(ctItem);
  const colTypesAdv = CTYPES.filter((t) => t[2] === 'a').map(ctItem);
  const allGroupKeys = {};
  groups.forEach((g) => { allGroupKeys[gb + ':' + g.id] = true; });

  const toolStyle = (on) => 'min-height: 40px; padding: 0 12px; border: 0; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap; font-size: 14px; ' + (on ? 'font-weight: 600; color: var(--ink); background: var(--chip-2);' : 'font-weight: 500; color: var(--ink-4); background: transparent;');
  const tool = {
    person: toolStyle(s.menu === 'person' || usePerson),
    filter: toolStyle(s.menu === 'filter' || rulesCount > 0),
    sort: toolStyle(s.menu === 'sort' || SORTS.length > 0),
    cols: toolStyle(s.menu === 'cols' || colsChanged),
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
  const startDow = lead(calY, calM);
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
      const pr = parseAt(r, p[0]);
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
    // "+N more" expands the day in place so every event stays reachable; Show less folds it back.
    const openDay = inM && s.calDay === calY + '-' + calM + '-' + n;
    days.push({
      num: String(dt.getDate()),
      events: openDay ? evs : evs.slice(0, 3),
      hasMore: evs.length > 3,
      moreText: openDay ? 'Show less' : '+' + (evs.length - 3) + ' more',
      moreLabel: openDay ? 'Show fewer events on ' + MONTH_NAMES[calM] + ' ' + n : 'Show all ' + evs.length + ' events on ' + MONTH_NAMES[calM] + ' ' + n,
      toggleMore: () => set({ calDay: openDay ? '' : calY + '-' + calM + '-' + n }),
      style: 'min-height: 120px; box-sizing: border-box; padding: 8px; display: flex; flex-direction: column; gap: 4px; min-width: 0; border-bottom: 1px solid var(--col-line);' + ((i % 7) === 6 ? '' : ' border-right: 1px solid var(--col-line);') + (inM ? ' background: var(--surface);' : ' background: var(--surface-2);'),
      numStyle: 'align-self: flex-start; min-width: 26px; height: 26px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; ' + (isToday ? 'background: var(--inv); color: var(--inv-ink);' : (inM ? 'color: var(--ink-2);' : 'color: var(--faint);'))
    });
  }
  const legend = [{ label: 'Pub: publishing date', style: 'width: 12px; height: 12px; background: ' + (vis.type ? '#FF6A3D' : '#22844C') + ';' }];
  if (EV.length > 1) legend.push({ label: EV[0][1] + ': ' + COLS[EV[0][0]].label.toLowerCase(), style: 'width: 12px; height: 12px; background: var(--chip); border: 1px solid var(--border-3); box-sizing: border-box;' });
  const cal = {
    label: MONTH_NAMES[calM] + ' ' + calY,
    weekdays: rotate(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
    days: days,
    legend: legend
  };
  const shiftMonth = (y, m, d) => { const x = new Date(y, m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; };


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
    // The Edit property sheet keeps its own lane on the right, so the column being edited stays in view.
    (sheet.open ? ' padding-right: ' + (320 + 16) + 'px;' : '') +
    ' color-scheme: ' + (dark ? 'dark' : 'light') + '; min-height: 100vh; background: var(--page); font-family: var(--font-main); color: var(--ink); -webkit-font-smoothing: antialiased; display: flex; flex-direction: column; box-sizing: border-box;';

  const NAV_BY = { admin: ['daily', 'projects', 'ideas', 'brand', 'alerts', 'content', 'perf'], editor: ['projects', 'brand', 'alerts'], designer: ['projects', 'ideas', 'brand', 'alerts'], sponsor: ['projects', 'ideas', 'brand', 'alerts'] };
  const PAGE_IDS = ['daily', 'alerts', 'content', 'perf', 'brand', 'settings', 'ideas'];
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
    { id: 'perf', label: 'Performance', icon: 'M3 3v16a2 2 0 0 0 2 2h16M7 16l4-4 3 3 6-6M15 9h5v5', dots: '' },
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
    { id: 'updates', label: 'What\u2019s New', icon: 'M12 3l1.9 5.8 5.8 1.9-5.8 1.9L12 18.4l-1.9-5.8-5.8-1.9 5.8-1.9zM19 3v4M21 5h-4', dots: '' },
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
      aria: n.label + (n.count ? ', ' + n.count + (n.id === 'pm' ? ' need attention' : ' new') : ''),
      // Workload's count is open work, not news, so it shows as a filled ink pill.
      badgeStyle: n.id === 'pm' && s.panel && n.count ? badge(n.count).replace('background: var(--chip-2); color: var(--ink-2)', 'background: var(--inv); color: var(--inv-ink)') : badge(n.count),
      cls: on ? 'fb-ni-on' : 'fb-ni',
      current: on ? 'page' : 'false',
      pick: () => set({ nav: n.id, openJob: '' }),
      style: on ? navOn : navOff,
      mstyle: 'flex: none; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 12px; cursor: pointer; ' + (on ? 'background: var(--chip-2); color: var(--ink);' : 'background: transparent; color: var(--ink-4);')
    };
  };
  const navItems = NAVR.map(mkNav);
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
    views: viewsFor(i.role, i.views), status: 'Invited', lastActive: i.resent_at ? 'Resent ' + relTime(i.resent_at, now) : 'Invited ' + labelOf(i.created_at), resent: !!i.resent_at, raw: i
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
      // Resend stays available (expired links, bounced mail); only an in-flight send blocks a second click.
      if (st === 'Invited') { const busy = s.resendBusy === m.id; acts.push({ label: busy ? 'Sending…' : 'Resend invite', aria: 'Resend invite to ' + m.name, style: smBtn + (busy ? ' color: var(--muted-2);' : ''), pick: () => { if (busy) return; set({ resendBusy: m.id }); A.resendInvite(m.raw).then(() => set({ resendBusy: '' })); } }); }
      if (st === 'Invited') acts.push({ label: 'Copy link', aria: 'Copy invite link for ' + m.name, style: smBtn, pick: () => A.copyInviteLink(m.raw) });
      if (st === 'Active' && (m.dbRole === 'editor' || m.dbRole === 'designer')) acts.push({ label: 'Make Super Admin', aria: 'Make ' + m.name + ' a Super Admin', style: smBtn, pick: () => A.setMemberRole(m.raw, 'super_admin', 'made', m.name, 'a Super Admin') });
      if (st === 'Active' && m.dbRole === 'super_admin') acts.push({ label: 'Make Editor', aria: 'Change ' + m.name + ' from Super Admin to Editor', style: smBtn, pick: () => A.setMemberRole(m.raw, 'editor', 'changed', m.name, 'to Editor') });
      // Edit access: user type (within internal or within external roles) and board views.
      if (st === 'Active' && !m.isInvite) acts.push({ label: 'Edit access', aria: 'Edit access for ' + m.name, style: smBtn, pick: () => set({ rec: { kind: 'member', id: m.id, draft: { role: m.dbRole, views: m.raw.views && m.raw.views.length ? m.raw.views.slice() : [] }, err: '', busy: false } }) });
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
  const AV = isAdmin ? adminVals({ s: s, set: set, dark: dark, TONE: TONE, DARKFILL: DARKFILL, GRAYB: GRAYB, toolStyle: toolStyle, allRows: allRows, catalogRows: catalogRows, ROLES: ROLES, COLS: COLS, PILL: PILL, fillFor: fillFor, dueState: dueState, TYPEFILL: TYPEFILL, avatar: avatar, members: members, page: adminPage, di: di, TODAY: TODAY, DEF_VIEWS: DEF_VIEWS, roleBlock: roleBlock, actColor: actColor, openAddUser: openAddUser, D: D, A: A, me: me, now: now, nameOf: D.nameOf, openRec: openers({ D: D, set: set, settings: settings }) })
    : adminVals({ s: s, set: set, dark: dark, TONE: TONE, DARKFILL: DARKFILL, GRAYB: GRAYB, toolStyle: toolStyle, allRows: [], catalogRows: [], ROLES: ROLES, COLS: COLS, PILL: PILL, fillFor: fillFor, dueState: dueState, TYPEFILL: TYPEFILL, avatar: avatar, members: [], page: '', di: di, TODAY: TODAY, DEF_VIEWS: DEF_VIEWS, roleBlock: roleBlock, actColor: actColor, openAddUser: () => {}, D: D, A: A, me: me, now: now, nameOf: D.nameOf, openRec: openers({ D: D, set: set, settings: settings }) });
  const adminOn = ADMIN_DEF.some((n) => n.id === curNav.id);
  // Super Admins see the Admin group expanded until they collapse it
  const adminShown = !s.panel || adminOn || (s.adminOpen === undefined ? isAdmin : !!s.adminOpen);
  const viewN = (usePerson ? 1 : 0) + (rulesCount ? 1 : 0) + (SORTS.length ? 1 : 0) + (colsChanged ? 1 : 0) + (gb !== 'stage' ? 1 : 0);
  const adminNav = ADMIN_DEF.map((n) => mkNav(Object.assign({}, n, { count: AV.badges[n.id] || 0 })));
  const stageOf = (st) => STG[st] || 'prod';
  const hardBlock = (f, h) => 'display: inline-flex; align-items: center; height: ' + h + 'px; padding: 0 10px; border-radius: 0; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + (f ? f[0] : 'var(--chip)') + '; color: ' + (f ? f[1] : 'var(--ink-3)') + ';';
  const btnPrimary = 'min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); cursor: pointer;';
  const noop = () => {};
  let dr = { job: '', title: '', stage: '', stageDot: '', jobStyle: '', posText: '', metaLine: '', typeBlock: null, tabs: [], tabId: '', steps: [], rail: [], assets: [], comments: [], history: [], isOverview: false, isAssets: false, isComments: false, isHistory: false, canUpload: false, uploadLabel: '', assetsEmpty: false, noComments: false, commentNote: '', placeholder: '', draft: '', showInternal: false, internalOn: false, canComment: false, onDraft: noop, post: noop, toggleInternal: noop, prev: noop, next: noop, upload: noop };
  const cur = openJob ? allRows.find((r) => r.job === openJob) : null;
  // Leaving a project's Comments (closing the modal or stepping to another project) marks them seen for the card's dot.
  const leaveComments = () => { if (cur && s.dTab === 'comments' && !isSponsorRole) A.markSeen(cur); };
  const closeDrawer = () => { leaveComments(); set({ openJob: '', draft: '', fileConfirm: '', dDrag: false, dMore: false, dBrief: null, cellEdit: s.cellEdit && s.cellEdit.src ? null : s.cellEdit }); };
  if (cur) {
    const r = cur;
    const applyOv = (patch, text, extra) => A.applyPatch(r, patch, Object.assign({ text: text, stage: patch.status ? stageOf(patch.status) : undefined }, extra || {}));
    const idx = sorted.findIndex((x) => x.job === r.job);
    const n = sorted.length;
    const go = (d) => () => { if (!n) return; const i = idx < 0 ? 0 : (idx + d + n) % n; leaveComments(); set({ openJob: sorted[i].job, draft: '', fileConfirm: '', dTitle: null, dBrief: null, dMore: false }); };
    const G = STAGES.find((x) => x.id === r.g) || STAGES[0];
    const si = Math.max(0, STATUS_SEQ.indexOf(r.status));
    const eS = r.editStatus || '';
    const tS = r.thumb || '';
    const isSponsor = isSponsorRole;

    const typeBlock = TYPEFILL[r.type] && (has('type') || isSponsor) ? { text: r.type, style: hardBlock(TYPEFILL[r.type], 26) } : null;

    // Tab ids stay overview / comments / assets / history so links from notifications keep working.
    const TAB_ICON = {
      overview: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
      comments: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z',
      assets: 'M21.4 11.1 12.2 20.3a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5',
      history: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2'
    };
    const TABS = [['overview', 'Overview'], ['comments', 'Comments'], ['assets', 'Files']].concat(isSponsor ? [] : [['history', 'Activity']]);
    const dTab = TABS.find((t) => t[0] === s.dTab) ? s.dTab : 'overview';
    const comments = cmtFor(r);

    // Horizontal pipeline under the header (CardDetail.dc.html), same steps and colors as the card's segment bar.
    const steps = stepsFor(r).map((x, i, all) => {
      const fill = stepFill(x.state);
      const ring = x.state === 'now' ? ' box-shadow: 0 0 0 4px var(--blue-soft);' : x.state === 'warn' ? ' box-shadow: 0 0 0 4px var(--red-soft);' : '';
      return {
        label: x.label, value: x.value, meta: x.meta, current: x.state === 'now' ? 'step' : undefined,
        last: i === all.length - 1,
        marker: 'position: relative; z-index: 1; width: 14px; height: 14px; box-sizing: border-box; flex: none; ' + (fill ? 'background: ' + fill + '; border: 2px solid ' + fill + ';' + ring : 'background: var(--surface); border: 2px solid var(--border-strong);'),
        line: 'position: absolute; top: 6px; left: 20px; right: 4px; height: 2px; background: ' + (x.state === 'done' ? fill : 'var(--track)') + ';',
        valueStyle: 'font-size: 14px; font-weight: 600; color: ' + (x.state === 'now' ? 'var(--blue-ink)' : x.state === 'warn' ? 'var(--red-ink)' : 'var(--ink)') + '; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
      };
    });

    // Properties rail: grouped fields, each click-to-edit through the board's cell editors (cellEdit with src 'dr').
    const relDay = (k) => {
      const n = diAt(r, k);
      if (n == null) return '';
      const d = n - TODAY;
      return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d < 0 ? (-d) + 'd ago' : 'in ' + d + ' days';
    };
    const ceOpen = CE && CE.job === r.job && CE.src ? CE : null;
    const editCell = (k, src) => () => {
      const curV = k === 'link' ? (r.linkUrl || '') : (r[k] || '');
      const pd = parseAt(r, k) || { m: today.getMonth(), y: today.getFullYear() };
      const on = ceOpen && ceOpen.key === k && ceOpen.src === src;
      set({ cellEdit: on ? null : { job: r.job, key: k, src: src }, ceText: curV, ceMonth: pd.m, ceYear: pd.y, menu: '', dMore: false });
    };
    const propVal = (k) => {
      const c = COLS[k];
      const v = k === 'link' ? linkFor(r) : (r[k] || '');
      const can = !isSponsor && k !== 'job' && canCell(k, r);
      const o = {
        key: k, label: c.label, text: v, isText: false, isBlock: false, isDate: false, isPerson: false, isDot: false, isLink: false, isEmpty: !v,
        emptyText: !can ? (c.kind === 'person' ? 'Unassigned' : 'Not set') : c.kind === 'person' ? 'Assign' : k === 'link' ? 'Add a link' : c.kind === 'date' ? 'Set date' : 'Add',
        href: r.linkUrl || undefined, can: can, open: can ? editCell(k, 'dr') : undefined, isOpen: !!(ceOpen && ceOpen.key === k && ceOpen.src === 'dr'),
        aria: (can ? 'Edit ' : '') + c.label + ', ' + (v || 'empty'), rel: ''
      };
      if (!v) return o;
      if (c.kind === 'pill') {
        const so = CARD_SOFT(k, v);
        o.isBlock = true;
        o.blockStyle = k === 'type' ? hardBlock(TYPEFILL[v], 22) : 'display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + so.bg + '; color: ' + so.ink + ';';
      } else if (c.kind === 'date') {
        o.isDate = true;
        const st = dueState(k, r);
        o.rel = relDay(k);
        o.relStyle = 'font-size: 12px; color: ' + (st === 'late' ? 'var(--red-ink)' : 'var(--muted-2)') + ';';
        o.chipStyle = 'display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border-radius: 999px; font-size: 12.5px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; ' + (st === 'late' ? 'background: var(--red-soft); color: var(--red-ink);' : st === 'today' ? 'background: var(--amber-soft); color: var(--amber-ink);' : 'background: var(--hover); color: var(--ink-2b);');
      }
      else if (c.kind === 'person') { o.isPerson = true; o.initials = v.slice(0, 1); o.avatarStyle = avatar(v, 22) + ' font-size: 10px;'; }
      else if (c.kind === 'dot') { o.isDot = true; o.dotStyle = 'width: 8px; height: 8px; border-radius: 999px; flex: none; background: ' + (DOT[v] || '#C4C4C4') + ';'; }
      else if (c.kind === 'link') { o.isLink = true; o.linkStyle = 'position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 6px; min-width: 0; color: var(--link); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'; }
      else { o.isText = true; o.textStyle = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;' + (c.kind === 'mono' ? ' font-variant-numeric: tabular-nums; letter-spacing: 0.02em; font-weight: 600;' : ''); }
      return o;
    };
    // Pub before the edit is due is worth a warning next to the date.
    const pubN = diAt(r, 'pub'), editN = diAt(r, 'editDue');
    const pubEarly = has('editDue') && pubN != null && editN != null && pubN < editN && r.editStatus !== 'Approved' && r.status !== 'Live';
    const customProp = (f) => {
      const raw = (r.cf || {})[f.id];
      const v = r[f.id] || '';
      const txt = !v ? '' : f.type === 'number' ? fmtNum(toNum(raw != null ? raw : v), f.config || {}) : f.type === 'date' && isoDate(v) ? fmtDate(isoDate(v), (f.config || {}).date_format || 'short') : f.type === 'checkbox' ? (raw ? 'Yes' : '') : v;
      const can = !isSponsor && canCell(f.id, r);
      return {
        key: f.id, label: f.label, text: txt, isText: !!txt, textStyle: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;', isEmpty: !txt,
        emptyText: can ? 'Add' : 'Not set', can: can, open: can ? editCell(f.id, 'dr') : undefined, isOpen: !!(ceOpen && ceOpen.key === f.id && ceOpen.src === 'dr'),
        aria: (can ? 'Edit ' : '') + f.label + ', ' + (txt || 'empty'), rel: ''
      };
    };
    const RAIL = [['Details', ['status', 'type', 'channel', 'job']], ['Team', ['editor', 'editStatus', 'designer', 'thumb']], ['Dates', ['film', 'thumbDue', 'editDue', 'pub']], ['Sponsor', ['sponsor', 'approval']], ['Publishing', ['link'].concat(r.g === 'pub' ? ['clipping', 'newsletter', 'community', 'distribute'] : [])]];
    const rail = RAIL.map((p) => ({ title: p[0], fields: p[1].filter((k) => has(k) || (isSponsor && (k === 'status' || k === 'pub' || k === 'link'))).map(propVal) }))
      .filter((g) => g.fields.length && (g.title !== 'Sponsor' || r.sponsor || isAdmin));
    rail.forEach((g) => g.fields.forEach((f) => { if (f.key === 'pub' && pubEarly) { f.rel = 'before edit due'; f.relStyle = 'font-size: 12px; font-weight: 600; color: var(--red-ink);'; } }));
    const extra = isSponsor ? [] : customCols.filter((f) => kindOf(f) !== 'created_time' && kindOf(f) !== 'last_edited_by').map(customProp);
    if (extra.length) rail.push({ title: 'More properties', fields: extra });

    // ---------- Files ----------
    const extOf = (a) => { const m = /\.([A-Za-z0-9]+)$/.exec(a.name || a.storage_path || ''); return m ? m[1].toLowerCase() : ''; };
    const TYPES = {
      image: ['IMG', '#2F8F5B', 'Image'], video: ['VID', '#7B5CD6', 'Video'], pdf: ['PDF', '#D6453D', 'PDF'], doc: ['DOC', '#2B6CD8', 'Document'],
      slides: ['PPT', '#D9692B', 'Slides'], md: ['MD', '#3A3B40', 'Markdown'], file: ['FILE', '#6B6B6B', 'File']
    };
    const typeOf = (a) => {
      const e = extOf(a), mt = a.mime_type || '';
      if (isImageFile(a)) return 'image';
      if (/^video\//.test(mt) || /^(mp4|mov|m4v|webm|avi|mkv)$/.test(e)) return 'video';
      if (mt === 'application/pdf' || e === 'pdf') return 'pdf';
      if (/^(ppt|pptx|key|odp)$/.test(e) || /presentation|powerpoint/.test(mt)) return 'slides';
      if (/^(md|markdown)$/.test(e) || mt === 'text/markdown') return 'md';
      if (/^(doc|docx|rtf|odt|pages|txt)$/.test(e) || /msword|wordprocessing|opendocument\.text|^text\//.test(mt)) return 'doc';
      return 'file';
    };
    const badgeFor = (t, h) => 'display: inline-flex; align-items: center; justify-content: center; height: ' + h + 'px; min-width: ' + (h + 10) + 'px; padding: 0 6px; box-sizing: border-box; border-radius: 6px; flex: none; font-size: ' + (h > 24 ? 13 : 10) + 'px; font-weight: 800; letter-spacing: 0.04em; color: #FFFFFF; background: ' + TYPES[t][1] + ';';
    const sizeText = (n) => !n ? '' : n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
    const previews = isSponsor ? ((portal[r.id] || {}).previews || {}) : (D.previews || {});
    const previewOf = (a) => a.url || (a.storage_path && previews[a.storage_path]) || '';
    const KIND_L = { script: 'Script', raw_footage: 'Raw footage', draft: 'Edit', thumbnail: 'Thumbnail', final: 'Final', other: 'File' };
    const KIND_ORDER = { script: 0, raw_footage: 1, draft: 2, thumbnail: 3, final: 4, other: 5 };
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
      return (a.uploaded_by === me.id ? 'You' : D.nameOf(a.uploaded_by) || 'Someone') + '  ·  ' + relTime(a.created_at, now);
    };
    const visible = rawAssets.filter(showAsset).slice().sort((a, b) => (KIND_ORDER[a.kind] ?? 5) - (KIND_ORDER[b.kind] ?? 5) || (b.version || 0) - (a.version || 0) || (a.created_at < b.created_at ? 1 : -1));
    const FILTERS = [['all', 'All'], ['image', 'Images'], ['docs', 'Documents'], ['video', 'Video']];
    const fKind = FILTERS.find((f) => f[0] === s.dFileKind) ? s.dFileKind : 'all';
    const inKind = (a) => fKind === 'all' || (fKind === 'docs' ? ['pdf', 'doc', 'slides', 'md', 'file'].includes(typeOf(a)) : typeOf(a) === fKind);
    const fq = (s.dFileQ || '').trim().toLowerCase();
    const shown = visible.filter((a) => inKind(a) && (!fq || (a.name || '').toLowerCase().includes(fq)));
    const fileView = s.dFileView === 'list' ? 'list' : 'grid';
    const canDelAsset = (a) => !isSponsor && (a.uploaded_by === me.id || can('assets', 'delete'));
    const assets = shown.map((a, i) => {
      const t = typeOf(a);
      const name = isSponsor && a.kind === 'draft' ? 'Draft for review' : a.name;
      const url = t === 'image' ? previewOf(a) : '';
      const confirm = s.fileConfirm === a.id;
      return {
        key: a.id || String(i), name: name, meta: assetMeta(a), size: sizeText(a.size_bytes),
        source: a.comment_id ? 'Comment' : KIND_L[a.kind] || 'File',
        sourceIcon: a.comment_id ? TAB_ICON.comments : TAB_ICON.assets,
        typeLabel: TYPES[t][0], typeName: TYPES[t][2], badgeSm: badgeFor(t, 20), badgeLg: badgeFor(t, 30),
        hasPreview: !!url, preview: url, noPreview: !url,
        version: a.kind === 'draft' ? 'V' + (a.version || 1) : '', hasVersion: a.kind === 'draft',
        open: (e) => { if (e && e.preventDefault) e.preventDefault(); A.openAsset(a, r); },
        download: () => A.downloadAsset(a),
        canDelete: canDelAsset(a) && !!a.id, confirm: confirm,
        delLabel: confirm ? 'Confirm remove' : 'Remove',
        del: () => { if (confirm) { set({ fileConfirm: '' }); A.removeAsset(a, r); } else set({ fileConfirm: a.id }); },
        aria: 'Open ' + name,
        rowStyle: 'display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 10px 14px; box-sizing: border-box;' + (i ? ' border-top: 1px solid var(--line);' : '')
      };
    });
    const ACCEPT_DOCS = '.pdf,.md,.markdown,.txt,.doc,.docx,.rtf,.odt,.ppt,.pptx,.key,.odp,application/pdf,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const ACCEPT_ALL = 'image/*,video/*,' + ACCEPT_DOCS;
    const canUpload = !isSponsor && can('assets', 'create');
    const roleUpload = s.role === 'editor' ? ['draft', 'Upload cut', 'video/*'] : s.role === 'designer' ? ['thumbnail', 'Upload thumbnail', 'image/*'] : null;
    const toolBtn = (on) => 'min-height: 36px; padding: 0 12px; border: 1px solid ' + (on ? 'var(--ink)' : 'var(--border)') + '; border-radius: 10px; background: ' + (on ? 'var(--inv)' : 'var(--surface)') + '; color: ' + (on ? 'var(--inv-ink)' : 'var(--ink-3)') + '; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;';
    const viewBtn = (on) => 'width: 36px; height: 34px; border: 0; border-radius: 8px; background: ' + (on ? 'var(--surface)' : 'transparent') + '; color: ' + (on ? 'var(--ink)' : 'var(--muted)') + '; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;' + (on ? ' box-shadow: 0 1px 2px rgba(0,0,0,0.12);' : '');

    // ---------- Comments ----------
    const cmtAvatar = (w, size) => 'width: ' + size + 'px; height: ' + size + 'px; border-radius: 999px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: ' + (size > 30 ? 13 : 12) + 'px; font-weight: 700; color: #FFFFFF; background: ' + actColor(w) + ';';
    const myTag = ROLE_TAG[me.dbRole] || '';
    const commentRows = comments.map((c) => {
      const files = (c.files || []).map((a, i) => ({ a: a, t: typeOf(a), i: i }));
      const imgs = files.filter((f) => f.t === 'image');
      const docs = files.filter((f) => f.t !== 'image');
      const openF = (a) => () => { if (a.storage_path) A.openAsset(a, r); else if (a.url) window.open(a.url, '_blank', 'noopener'); };
      // Edit your own comment (comments edit permission); delete your own, or any as a Super Admin (cm_delete policy).
      const editing = !!c.id && s.cmEdit && s.cmEdit.id === c.id;
      const confirmDel = !!c.id && s.cmDel === c.id;
      const mine = c.who === 'You';
      return {
        id: c.id || '', edited: !!c.edited, editing: editing, editText: editing ? s.cmEdit.text : '',
        canEdit: !isSponsor && !c.pending && mine && can('comments', 'edit'), canDelete: !isSponsor && !c.pending && (mine || isAdmin),
        startEdit: () => set({ cmEdit: { id: c.id, text: c.text || '' }, cmDel: '' }), onEdit: (e) => set({ cmEdit: { id: c.id, text: e && e.target ? e.target.value : '' } }),
        saveEdit: () => { const t = (s.cmEdit.text || '').trim(); if (!t && !(c.files || []).length) return; set({ cmEdit: null }); A.editComment(r, c.raw, t); },
        cancelEdit: () => set({ cmEdit: null }),
        onEditKey: (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); set({ cmEdit: null }); } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); const t = (s.cmEdit.text || '').trim(); if (t) { set({ cmEdit: null }); A.editComment(r, c.raw, t); } } },
        delLabel: confirmDel ? 'Confirm delete' : 'Delete', del: () => { if (!confirmDel) return set({ cmDel: c.id }); set({ cmDel: '' }); A.deleteComment(r, c.raw); },
        who: c.who === 'You' ? (me.name || 'You') : c.who, isYou: c.who === 'You', time: c.time, text: c.text, hasText: !!(c.text || '').trim(),
        roleTag: c.who === 'You' ? myTag : c.roleTag,
        internal: !isSponsor && !!c.internal,
        initials: (c.who === 'You' ? (me.name || 'Y') : c.who).slice(0, 1).toUpperCase(), avatarStyle: cmtAvatar(c.who, 36),
        bubble: 'display: flex; flex-direction: column; gap: 8px; min-width: 0; max-width: 100%; padding: 12px 14px; box-sizing: border-box; border-radius: 4px 16px 16px 16px; background: ' + (!isSponsor && c.internal ? 'var(--surface-2)' : 'var(--hover)') + '; border: 1px solid ' + (!isSponsor && c.internal ? 'var(--line-3)' : 'transparent') + ';',
        images: imgs.map((f) => ({ key: f.i, name: f.a.name, url: previewOf(f.a), has: !!previewOf(f.a), open: openF(f.a) })),
        hasImages: imgs.length > 0,
        imgGrid: 'display: grid; grid-template-columns: repeat(' + Math.min(imgs.length, 3) + ', minmax(0, ' + (imgs.length === 1 ? '360px' : '1fr') + ')); gap: 6px;',
        files: docs.map((f) => ({ key: f.i, name: f.a.name, size: sizeText(f.a.size_bytes), label: TYPES[f.t][0], badge: badgeFor(f.t, 22), open: openF(f.a) })),
        hasFiles: docs.length > 0
      };
    });
    const canComment = isSponsor ? !!(acct && acct.allow_comment) : can('comments', 'create');
    const canAttach = canComment && canUpload;
    const pend = s.dFilesFor === r.id ? (s.dFiles || []) : [];
    const addPending = (files) => set((prev) => {
      const base = prev.dFilesFor === r.id ? (prev.dFiles || []) : [];
      return { dFilesFor: r.id, dFiles: base.concat(files.map((f) => ({ file: f, url: /^image\//.test(f.type) ? URL.createObjectURL(f) : '' }))) };
    });
    const pending = pend.map((p, i) => {
      const t = typeOf({ name: p.file.name, mime_type: p.file.type });
      return {
        key: i, name: p.file.name, size: sizeText(p.file.size), isImage: !!p.url, url: p.url, notImage: !p.url, label: TYPES[t][0], badge: badgeFor(t, 22),
        remove: () => { if (p.url) URL.revokeObjectURL(p.url); set({ dFiles: pend.filter((x) => x !== p) }); }
      };
    });
    const draftText = (s.draft || '').trim();
    const canPost = canComment && (!!draftText || (!isSponsor && pend.length > 0));
    const post = () => {
      if (!canPost) return;
      set({ draft: '', dFiles: [] });
      A.postComment(r, draftText, !isSponsor && !!s.dInternal, pend);
    };

    // Drag files onto the panel: Comments attaches them to the next comment, other tabs upload to Files.
    const dropOn = canUpload && dTab !== 'history';
    const onDragOver = (e) => {
      if (!dropOn || !e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault();
      if (!s.dDrag) set({ dDrag: true });
    };
    const onDragLeave = (e) => { if (s.dDrag && !(e.currentTarget.contains && e.currentTarget.contains(e.relatedTarget))) set({ dDrag: false }); };
    const onDrop = (e) => {
      if (!dropOn) return;
      e.preventDefault();
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      set({ dDrag: false });
      if (!files.length) return;
      if (dTab === 'comments') { if (canAttach) addPending(files); }
      else { A.uploadFiles(r, 'other', files); if (dTab !== 'assets') set({ dTab: 'assets' }); }
    };

    const tabs = TABS.map((t) => {
      const on = t[0] === dTab;
      const cnt = t[0] === 'comments' ? comments.length : t[0] === 'assets' ? visible.length : 0;
      return {
        id: 'dtab-' + t[0], label: t[1], selected: on ? 'true' : 'false', icon: TAB_ICON[t[0]],
        hasCount: cnt > 0, count: String(cnt), badge: GRAYB,
        pick: () => { if (t[0] !== dTab && (t[0] === 'comments' || dTab === 'comments') && !isSponsor) A.markSeen(r); set({ dTab: t[0], fileConfirm: '', dMore: false }); },
        style: 'min-height: 46px; padding: 0 4px; border: 0; border-bottom: 2px solid ' + (on ? 'var(--ink)' : 'transparent') + '; background: transparent; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap; font-size: 14px; font-weight: ' + (on ? '700' : '500') + '; color: ' + (on ? 'var(--ink)' : 'var(--muted)') + ';'
      };
    });

    const histRaw = D.activity.filter((l) => l.project_id === r.id).map((l) => ({ who: l.actor_id === me.id ? 'You' : (l.actor_label || 'Automation'), text: l.action.replace(/\s(on|for)$/, ''), time: relTime(l.created_at, now), fresh: now - new Date(l.created_at) < FRESH }))
      .concat([{ who: r.createdBy && r.createdBy === me.id ? 'You' : (r.createdBy && D.nameOf(r.createdBy)) || 'Someone', text: 'created the project', time: r.createdAt ? relTime(r.createdAt, now) : 'Earlier', fresh: false }]);
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
        acts.push({ label: 'Move to ' + nx, primary: true, pick: () => applyOv({ status: nx }, 'moved Status to ' + nx, { event: 'status', external: !!(D.statuses.find((x) => x.label === nx) || {}).notify_sponsor }) });
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
    if (s.role === 'admin') {
      const confirmDel = s.projConfirm === r.id;
      if (r.archived) {
        acts.length = 0;
        foot = 'Archived. Restore it to put it back on the board.';
        acts.push({ label: confirmDel ? 'Confirm permanent delete' : 'Delete permanently', danger: true, confirm: confirmDel,
          pick: () => { if (confirmDel) { set({ projConfirm: '', openJob: '' }); A.deleteProject(r); } else set({ projConfirm: r.id }); } });
        acts.push({ label: 'Restore', primary: true, pick: () => { set({ projConfirm: '' }); A.archiveProject(r, false); } });
      } else {
        acts.unshift({ label: 'Archive', pick: () => { set({ openJob: '' }); A.archiveProject(r, true); } });
      }
    }

    // Checklist from the project's template (project_checklist). The team ticks steps; Super Admins add and remove them.
    const checks = isSponsor ? [] : ((D.checklist || {})[r.id] || []).slice().sort((a, b) => a.sort - b.sort);
    const nDone = checks.filter((x) => x.done_at).length;
    const addCk = () => { const t = (s.ckDraft || '').trim(); if (!t) return; set({ ckDraft: '' }); A.addCheck(r, t); };
    const checklist = {
      show: !isSponsor, has: checks.length > 0, empty: checks.length === 0,
      progress: nDone + ' of ' + checks.length + ' done',
      bar: 'display: block; height: 100%; width: ' + (checks.length ? Math.round(nDone / checks.length * 100) : 0) + '%; background: ' + (nDone === checks.length && checks.length ? 'var(--green-ink, #22844C)' : 'var(--ink)') + '; transition: width .2s ease;',
      items: checks.map((x) => ({
        id: x.id, label: x.label, done: x.done_at ? 'true' : 'false', toggle: () => A.toggleCheck(r, x),
        by: x.done_at ? (D.nameOf(x.done_by) || 'Someone') + '  ·  ' + relTime(x.done_at, now) : '',
        labelStyle: 'font-size: 14px; line-height: 1.35; color: ' + (x.done_at ? 'var(--muted)' : 'var(--ink)') + ';' + (x.done_at ? ' text-decoration: line-through;' : ''),
        canRemove: isAdmin, remove: () => A.removeCheck(r, x), removeLabel: 'Remove step ' + x.label
      })),
      canAdd: isAdmin, draft: s.ckDraft || '', onDraft: (e) => set({ ckDraft: e && e.target ? e.target.value : '' }), add: addCk,
      onKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); addCk(); } },
      templates: isAdmin && !checks.length ? D.templates.filter((t) => (t.steps || []).length).map((t) => ({ label: 'Use ' + t.name, pick: () => A.applyTemplate(r, t) })) : [],
      emptyText: isAdmin ? 'No checklist yet. Start one from a template or add steps.' : 'No checklist on this project.'
    };

    // Social post for Buffer (project_publish): caption, channels and timing, sent by a Publish to Buffer workflow.
    // Typing stays in s.pubDraft until the field loses focus, so realtime reloads never overwrite it.
    const pub = Object.assign({ caption: '', buffer_channel_ids: [], schedule: 'queue', post_time: '09:00', youtube_title: '' }, (D.publish || {})[r.id] || {});
    const bufOn = (D.integrations || []).some((g) => g.provider === 'buffer' && g.status === 'connected');
    const bufCh = ((D.buffer || {}).channels || []);
    const chLabel = (id) => { const c = bufCh.find((x) => x.channel_id === id); return c ? (c.display_name || c.name) + ' · ' + c.service : 'Removed channel'; };
    const canPub = !isSponsor && (isAdmin || can('projects', 'edit'));
    const pDraft = (s.pubDraft && s.pubDraft.id === r.id) ? s.pubDraft : null;
    const pText = (k) => (pDraft && pDraft[k] !== undefined ? pDraft[k] : pub[k] || '');
    const pEdit = (k) => (e) => set({ pubDraft: Object.assign({}, pDraft || { id: r.id }, { [k]: e && e.target ? e.target.value : '' }) });
    const pSave = (k) => () => { if (!pDraft || pDraft[k] === undefined) return; const v = pDraft[k]; set({ pubDraft: null }); if (v !== (pub[k] || '')) A.savePublish(r, { [k]: v }); };
    const picked = pub.buffer_channel_ids || [];
    const file = pickMedia(D.assets[r.id] || []);
    const flows = (D.automations || []).filter((a) => a.enabled && !a.is_draft && actionsOf(a.actions).some((x) => x.key === 'buffer_publish'));
    const flowText = flows.map((a) => { const t = triggerOf(a.trigger); return triggerText(t.key, t.value); });
    const sentRows = ((D.bufferPubs || {})[r.id] || []);
    const SCHED = [['queue', 'Buffer queue'], ['now', 'Right away'], ['date', 'Publishing date']];
    const chip = (on) => 'min-height: 36px; padding: 0 12px; border: 1px solid ' + (on ? 'var(--ink)' : 'var(--border)') + '; border-radius: 999px; background: ' + (on ? 'var(--inv)' : 'var(--surface)') + '; color: ' + (on ? 'var(--inv-ink)' : 'var(--ink-3)') + '; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: ' + (canPub ? 'pointer' : 'default') + '; white-space: nowrap;';
    const publish = {
      show: !isSponsor && (bufOn || bufCh.length > 0 || sentRows.length > 0), canEdit: canPub, readOnly: !canPub,
      caption: pText('caption'), onCaption: pEdit('caption'), saveCaption: pSave('caption'),
      channels: bufCh.filter((c) => !c.is_disconnected || picked.includes(c.channel_id)).map((c) => {
        const on = picked.includes(c.channel_id);
        return {
          id: c.channel_id, label: (c.display_name || c.name) + ' · ' + c.service + (c.is_locked ? ' (locked)' : c.is_disconnected ? ' (disconnected)' : ''),
          on: on ? 'true' : 'false', style: chip(on),
          toggle: () => { if (canPub) A.savePublish(r, { buffer_channel_ids: on ? picked.filter((x) => x !== c.channel_id) : picked.concat([c.channel_id]) }); }
        };
      }),
      noChannels: bufCh.length ? '' : bufOn ? 'No Buffer channels yet. Run Sync now on Content > Social to pull them in.' : 'Connect Buffer in Workspace Settings > Integrations, then sync to pull in its channels.',
      schedules: SCHED.map((x) => ({ label: x[1], on: pub.schedule === x[0] ? 'true' : 'false', style: chip(pub.schedule === x[0]), pick: () => { if (canPub && pub.schedule !== x[0]) A.savePublish(r, { schedule: x[0] }); } })),
      isDate: pub.schedule === 'date', time: String(pText('post_time')).slice(0, 5), onTime: (e) => { const v = e && e.target ? e.target.value : ''; if (canPub && v) A.savePublish(r, { post_time: v }); },
      dateNote: r.pub ? 'Posts on ' + r.pub + ' at this time, in the workspace timezone.' : 'Set a Publishing date on the project first.',
      showYt: picked.some((id) => (bufCh.find((x) => x.channel_id === id) || {}).service === 'youtube'),
      ytTitle: pText('youtube_title'), ytPlaceholder: r.title, onYt: pEdit('youtube_title'), saveYt: pSave('youtube_title'),
      fileText: file ? 'Posts the ' + (file.mediaKind === 'video' ? 'video' : 'image') + ' "' + file.name + '"' + (file.kind === 'draft' ? ' (latest cut, V' + (file.version || 1) + ')' : ' (Final)') + '.'
        : 'No video or image in Files yet. Upload the cut, or the post goes out as text where the network allows it.',
      whenText: flowText.length ? 'Sends when: ' + flowText.join('; ') + '.' : 'No live workflow publishes to Buffer yet. Add one in Automations with the action Publish to Buffer, for example Status becomes Ready.',
      history: sentRows.filter((x) => x.status !== 'cleared').map((x) => ({
        id: x.id, ok: x.status === 'created', text: chLabel(x.channel_id) + ': ' + (x.status === 'created' ? (x.due_at ? 'scheduled for ' + new Date(x.due_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'sent to Buffer') : 'failed'),
        sub: x.status === 'created' ? relTime(x.created_at, now) : (x.error || '') + '  ·  ' + relTime(x.created_at, now),
        textStyle: 'font-size: 13px; font-weight: 600; color: ' + (x.status === 'created' ? 'var(--ink)' : 'var(--red-ink)') + ';',
        canClear: isAdmin && x.status === 'created', clear: () => A.clearPublication(r, Object.assign({}, x, { channelLabel: chLabel(x.channel_id) })),
        clearLabel: 'Allow posting to ' + chLabel(x.channel_id) + ' again'
      })),
    };

    // Click the title to rename the project in place: Enter or leaving the field saves, Escape puts it back.
    const canRename = isAdmin;
    const tEdit = s.dTitle && s.dTitle.id === r.id ? s.dTitle : null;
    const saveTitle = () => {
      if (!tEdit) return;
      const t = String(tEdit.text || '').trim();
      set({ dTitle: null });
      if (t && t !== r.title) A.setField(r, 'title', t, { text: 'renamed ' + r.title + ' to ' + t + ' on' });
    };
    const titleEdit = {
      can: canRename, editing: !!tEdit, text: tEdit ? tEdit.text : r.title,
      start: () => { if (canRename) set({ dTitle: { id: r.id, text: r.title } }); },
      onText: (e) => set({ dTitle: { id: r.id, text: e && e.target ? e.target.value : '' } }),
      onKey: (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveTitle(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); set({ dTitle: null }); }
      },
      save: saveTitle, aria: 'Rename ' + r.title
    };

    // Brief: the hook, angle and notes (projects.brief). Super Admins edit in place; leaving the field or Cmd+Enter saves.
    const bEdit = s.dBrief && s.dBrief.id === r.id ? s.dBrief : null;
    const saveBrief = () => {
      if (!bEdit) return;
      const t = String(bEdit.text || '');
      set({ dBrief: null });
      if (t.trim() !== (r.brief || '').trim()) A.setField(r, 'brief', t, { text: 'updated the brief on' });
    };
    const brief = {
      show: !isSponsor && (isAdmin || !!r.brief), can: isAdmin, editing: !!bEdit, text: r.brief || '', has: !!r.brief, draft: bEdit ? bEdit.text : '',
      start: () => { if (isAdmin) set({ dBrief: { id: r.id, text: r.brief || '' }, cellEdit: null }); },
      onDraft: (e) => set({ dBrief: { id: r.id, text: e && e.target ? e.target.value : '' } }),
      onKey: (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); set({ dBrief: null }); }
        else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveBrief(); }
      },
      save: saveBrief, placeholder: 'Hook, angle, B-roll, anything the team should know.',
      emptyText: 'Add the hook, angle and notes for the team.'
    };

    // Latest three files on Overview; See all opens the Files tab.
    const latest = visible.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 3).map((a) => {
      const t = typeOf(a);
      const url = t === 'image' ? previewOf(a) : '';
      return {
        key: a.id || a.storage_path || a.name, name: isSponsor && a.kind === 'draft' ? 'Draft for review' : a.name, meta: assetMeta(a),
        hasPreview: !!url, preview: url, typeLabel: TYPES[t][0], badge: badgeFor(t, 30),
        open: (e) => { if (e && e.preventDefault) e.preventDefault(); A.openAsset(a, r); }
      };
    });
    const filesPeek = {
      show: latest.length > 0 || canUpload, items: latest, count: visible.length,
      more: visible.length > 3 ? 'See all ' + visible.length : '', seeAll: () => set({ dTab: 'assets', fileConfirm: '' })
    };

    // Next step: the role's main action up front in the rail; Archive and permanent delete live in the More menu.
    const isMoreAct = (a) => a.label === 'Archive' || !!a.danger;
    const primary = acts.find((a) => a.primary && !isMoreAct(a));
    const others = acts.filter((a) => !a.primary && !isMoreAct(a));
    const nextCard = {
      show: !!primary || others.length > 0 || !!foot,
      has: !!primary, label: primary ? primary.label : '', pick: primary ? primary.pick : noop,
      others: others.map((a) => ({ label: a.label, pick: a.pick })),
      note: foot
    };
    const closeMore = () => set({ dMore: false });
    const more = {
      open: !!s.dMore, toggle: () => set({ dMore: !s.dMore, cellEdit: null }), close: closeMore,
      items: [{ label: 'Copy link', pick: () => { closeMore(); A.copyText(projectUrl(r), 'Link copied.'); } }]
        .concat(acts.filter(isMoreAct).map((a) => ({ label: a.label, danger: !!a.danger || a.label === 'Archive', pick: () => { if (!a.confirm && !a.danger) closeMore(); a.pick(); } })))
    };
    const so = r.status ? CARD_SOFT('status', r.status) : null;
    const headStatus = {
      show: !!r.status, text: r.status, can: !isSponsor && canCell('status', r),
      isOpen: !!(ceOpen && ceOpen.key === 'status' && ceOpen.src === 'drh'), open: editCell('status', 'drh'),
      style: 'display: inline-flex; align-items: center; gap: 7px; height: 26px; padding: 0 8px 0 10px; border: 0; font-family: inherit; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + (so ? so.bg : 'var(--chip)') + '; color: ' + (so ? so.ink : 'var(--ink-3)') + ';',
      dot: 'width: 7px; height: 7px; border-radius: 999px; flex: none; background: ' + (so ? so.dot : '#B0B0B0') + ';'
    };
    const split = openIn !== 'side' || !!s.dWide;

    dr = {
      checklist: checklist,
      titleEdit: titleEdit, brief: brief, filesPeek: filesPeek, nextStep: nextCard, more: more, headStatus: headStatus,
      typeBlock: typeBlock, split: split, rail: rail,
      bodyStyle: split ? 'flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 360px;' : 'flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;',
      copyLink: () => A.copyText(projectUrl(r), 'Link copied.'),
      publish: publish,
      job: r.job, title: r.title, stage: G.title, posText: idx >= 0 ? (idx + 1) + ' of ' + n : '',
      stageDot: 'width: 8px; height: 8px; border-radius: 999px; flex: none; background: ' + G.color + ';',
      jobStyle: 'display: inline-flex; align-items: center; height: 28px; padding: 0 10px; border-radius: 0; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 700; letter-spacing: 0.04em; font-variant-numeric: tabular-nums;',
      metaLine: [r.channel, r.pub ? 'Pub ' + r.pub : '', r.mondayItemId ? 'Linked to monday' : ''].filter(Boolean).join('  ·  '),
      tabs: tabs, tabId: 'dtab-' + dTab,
      isOverview: dTab === 'overview', isAssets: dTab === 'assets', isComments: dTab === 'comments', isHistory: dTab === 'history',
      steps: steps,
      assets: assets, assetsEmpty: visible.length === 0, noMatch: visible.length > 0 && assets.length === 0,
      fileCount: visible.length ? 'Showing ' + assets.length + ' of ' + visible.length + (visible.length === 1 ? ' file' : ' files') : '',
      isGrid: fileView === 'grid', isList: fileView === 'list', hasFiles: assets.length > 0,
      gridOn: fileView === 'grid' ? 'true' : 'false', listOn: fileView === 'list' ? 'true' : 'false',
      gridBtn: viewBtn(fileView === 'grid'), listBtn: viewBtn(fileView === 'list'),
      setGrid: () => set({ dFileView: 'grid' }), setList: () => set({ dFileView: 'list' }),
      fileQ: s.dFileQ || '', onFileQ: (e) => set({ dFileQ: e && e.target ? e.target.value : '' }),
      filters: FILTERS.map((f) => ({ label: f[1], on: f[0] === fKind ? 'true' : 'false', style: toolBtn(f[0] === fKind), pick: () => set({ dFileKind: f[0] }) })),
      canUpload: canUpload, upload: () => A.pickAndUpload(r, 'other', ACCEPT_ALL),
      hasRoleUpload: canUpload && !!roleUpload, roleUploadLabel: roleUpload ? roleUpload[1] : '',
      roleUpload: () => roleUpload && A.pickAndUpload(r, roleUpload[0], roleUpload[2]),
      emptyFiles: canUpload ? 'Drop files here or use Add file. Images, PDF, Markdown, Word and PowerPoint files all work.' : 'Files appear here as the project moves through production.',
      dropOn: dropOn, dragging: !!s.dDrag && dropOn, onDragOver: onDragOver, onDragLeave: onDragLeave, onDrop: onDrop,
      dropText: dTab === 'comments' ? 'Drop to attach to your comment' : 'Drop to add to Files',
      comments: commentRows, noComments: commentRows.length === 0,
      commentNote: isSponsor ? 'Your comments go to the production team.' : 'Internal comments stay hidden from the client view.',
      placeholder: !canComment ? 'Comments are turned off for your account' : isSponsor ? 'Message the production team' : 'Write a comment. Cmd+Enter to post',
      draft: s.draft || '', canComment: canComment, canPost: canPost, postStyle: btnPrimary + ' opacity: ' + (canPost ? '1' : '0.45') + ';',
      onDraft: (e) => set({ draft: e && e.target ? e.target.value : '' }),
      onDraftKey: (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post(); } },
      post: post,
      asName: (me.name || 'You') + (myTag ? '  ·  ' + myTag : ''), asInitial: (me.name || 'Y').slice(0, 1).toUpperCase(), asAvatar: cmtAvatar('You', 32),
      canAttach: canAttach, attach: () => A.pickFiles(ACCEPT_ALL, true, addPending),
      pending: pending, hasPending: pending.length > 0,
      wide: !!s.dWide, wideLabel: s.dWide ? 'Narrow panel' : 'Widen panel', toggleWide: () => set({ dWide: !s.dWide }),
      wideIcon: s.dWide ? 'M14 10l7-7M20 10h-6V4M10 14l-7 7M4 14h6v6' : 'M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7',
      // Open rows in (Layout): side sheet, centered, or full page.
      panelStyle: (openIn === 'center'
        ? 'position: fixed; z-index: 45; top: 50%; left: 50%; right: auto; bottom: auto; transform: translate(-50%, -50%); margin: 0; width: ' + (s.dWide ? 'min(1320px, calc(100vw - 48px))' : 'min(1120px, calc(100vw - 48px))') + '; height: min(88vh, 900px); max-height: calc(100vh - 48px); border: 1px solid var(--line-4); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.24);'
        : openIn === 'full'
          ? 'position: fixed; z-index: 45; inset: 0; margin: 0; width: 100vw; height: 100vh; max-width: 100vw; max-height: 100vh; border: 0;'
          : 'position: fixed; z-index: 45; top: 0; right: 0; bottom: 0; left: auto; margin: 0; width: ' + (s.dWide ? 'min(1240px, 100vw)' : 'min(820px, 100vw)') + '; height: 100vh; max-height: 100vh; border: 0; border-left: 1px solid var(--line-4); box-shadow: -24px 0 80px rgba(0,0,0,0.18);') +
        ' box-sizing: border-box; padding: 0; background: var(--surface); color: var(--ink); font-family: var(--font-main); display: flex; flex-direction: column; overflow: hidden; transition: width .18s ease;',
      canWiden: openIn !== 'full',
      showInternal: !isSponsor, internalOn: !!s.dInternal, toggleInternal: () => set({ dInternal: !s.dInternal }),
      history: history,
      // Escape closes the More menu, then an open field editor, then the modal. Pickers handle their own Escape first.
      onKey: (e) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        e.preventDefault();
        if (s.dMore) set({ dMore: false });
        else if (CE && CE.src) set({ cellEdit: null, ceText: '' });
        else closeDrawer();
      },
      prev: go(-1), next: go(1)
    };
  }

  // ---------- Inline cell editor ----------
  // ---------- Cell editors (docs/design/database-components/CellEditors.dc.html) ----------
  // One popover per type: Text, Number, Date, Person, URL / Email / Phone, Files, Relation, Formula. Custom columns
  // save through setCustomValue; the built-in date, person and URL columns through setField as before.
  const editorModel = (r, k, close) => {
    const f = customCols.find((x) => x.id === k) || null;
    const bk = (COLS[k] || {}).kind;
    const kd = f ? kindOf(f) : k === 'link' ? 'url' : bk === 'date' ? 'date' : bk === 'person' ? 'person' : '';
    if (!kd || kd === 'select' || kd === 'multi_select' || kd === 'checkbox') return null;
    const conf = f ? f.config || {} : confOf(k);
    const raw = f ? (r.cf || {})[k] : null;
    const base = { type: kd, label: colLabel(k), project: r.title, close: close, align: popAlign(cols.findIndex((c) => c.key === k), cols.length) };
    const saveCustom = (val) => { A.setCustomValue(r, f, val); close(); };
    if (kd === 'text') return Object.assign(base, { value: r[k] || '', save: (t) => saveCustom(t.trim() ? t : null) });
    if (kd === 'number') {
      const fm = conf.number_format || 'number';
      return Object.assign(base, {
        value: raw == null ? '' : String(raw), prefix: fm === 'usd' ? '$' : fm === 'eur' ? '€' : '', suffix: fm === 'percent' ? '%' : '',
        preview: (t) => { const n = toNum(t); return t.trim() && n == null ? '' : n == null ? 'Empty' : 'Shows as ' + fmtNum(n, conf); },
        save: (t) => { const n = toNum(t); if (t.trim() && n == null) return 'Enter a number.'; saveCustom(n); return ''; }
      });
    }
    if (kd === 'date') {
      // Built-in dates are calendar days (setField with the board label and ISO day); custom dates also take a time
      // and an end date when the column has them on.
      const cur = f ? dateVal(raw) : (() => { const pd = parseAt(r, k); return { start: pd ? { d: pd.date, time: false } : null, end: null }; })();
      const iso = (p2) => (p2 ? isoOf(p2.d) : '');
      const hm = (p2) => (p2 && p2.time ? String(p2.d.getHours()).padStart(2, '0') + ':' + String(p2.d.getMinutes()).padStart(2, '0') : '');
      let tz = '';
      try { tz = new Intl.DateTimeFormat('en-US', { timeZone: settings.timezone || 'America/Chicago', timeZoneName: 'longGeneric' }).formatToParts(today).find((x) => x.type === 'timeZoneName').value; } catch { tz = settings.timezone || ''; }
      return Object.assign(base, {
        builtIn: !f, canConfig: !!f && isAdmin, endOn: !!conf.end_date, timeOn: !!conf.include_time, tz: tz, today: isoOf(today), weekStart: WEEK0,
        start: iso(cur.start), startTime: hm(cur.start), end: iso(cur.end), endTime: hm(cur.end),
        toggleEnd: () => A.setFieldConfig(f, { end_date: !conf.end_date }), toggleTime: () => A.setFieldConfig(f, { include_time: !conf.include_time }),
        show: (isoDay) => (isoDay ? fmtDate(isoDate(isoDay), 'full') : ''),
        // Typed dates: 2026-10-28, Oct 28, 10/28/2026 or anything the browser reads as a date.
        parse: (t) => { const x = (t || '').trim(); if (!x) return ''; const d = isoDate(x) || dateOfLabel(x, today) || (isNaN(Date.parse(x)) ? null : new Date(Date.parse(x))); return d ? isoOf(d) : null; },
        save: (v) => {
          if (!f) {
            if (!v.start) { setField(r, k, ''); return; }
            const d = isoDate(v.start);
            setField(r, k, MONTHS[d.getMonth()] + ' ' + d.getDate(), { iso: v.start });
            return;
          }
          if (!v.start) { saveCustom(null); return; }
          const one = (day, t) => day + (conf.include_time && t ? 'T' + t : '');
          A.setCustomValue(r, f, one(v.start, v.startTime) + (conf.end_date && v.end ? '/' + one(v.end, v.endTime) : ''));
          if (!v.keepOpen) close();
        }
      });
    }
    if (kd === 'person') {
      const one = !f || conf.person_limit === 1;
      const pool = f ? D.directory.filter((x) => x.status === 'active' && ['super_admin', 'editor', 'designer'].indexOf(x.role) >= 0).map((x) => ({ id: x.id, name: x.name, meta: ROLE_TAG[x.role] || '' }))
        : (k === 'designer' ? designerNames : editorNames).map((n) => ({ id: n, name: n, meta: (k === 'designer' ? 'Designer' : 'Editor') + ' · ' + allRows.filter((x) => x[k] === n && x.status !== 'Live').length + ' active' }));
      const value = f ? listOf(raw) : (r[k] ? [r[k]] : []);
      const set1 = (ids) => { if (f) A.setCustomValue(r, f, ids.length ? ids : null); else setField(r, k, ids[0] || ''); };
      return Object.assign(base, {
        multi: !one, group: f ? 'Team' : k === 'designer' ? 'Designers' : 'Editors',
        people: pool.map((x) => ({ id: x.id, name: x.name, meta: x.meta, initials: x.name.split(' ').map((w) => w[0]).join('').slice(0, 2), avatar: avatar(x.name, 28), chipAvatar: avatar(x.name, 20) + ' font-size: 9px;' })),
        value: value,
        pick: (id) => { if (one) { set1(value[0] === id ? [] : [id]); if (f) close(); } else set1(value.indexOf(id) >= 0 ? value.filter((x) => x !== id) : value.concat([id])); },
        remove: (id) => set1(value.filter((x) => x !== id)),
        canInvite: isAdmin, invite: () => { close(); set({ nav: 'team' }); openAddUser(); }
      });
    }
    if (kd === 'url' || kd === 'email' || kd === 'phone') {
      const cur = f ? (r[k] || '') : (r.linkUrl || '');
      const save = (t) => { const x = (t || '').trim(); if (f) saveCustom(x || null); else setField(r, 'linkUrl', x); };
      return Object.assign(base, {
        kind: kd, value: cur, save: save, remove: () => save(''),
        note: kd === 'url' ? 'Paste replaces. Open uses the saved link.' : kd === 'email' ? 'Open starts an email.' : 'Open starts a call on this device.'
      });
    }
    if (kd === 'files') {
      const items = listOf(raw).filter((x) => x && (x.asset_id || x.url));
      const size = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : (b || 0) + ' B');
      return Object.assign(base, {
        items: items.map((x) => ({ item: x, name: x.name || x.url, meta: x.url ? x.url.replace(/^https?:\/\//, '') : size(x.size), preview: x.path ? (D.previews || {})[x.path] || '' : '' })),
        upload: (files) => A.uploadFieldFiles(r, f, files),
        pick: () => A.pickFiles('', true, (fs) => A.uploadFieldFiles(r, f, fs)),
        embed: (url) => { const u = (url || '').trim(); if (!u) return; const href = /^https?:\/\//.test(u) ? u : 'https://' + u; A.setCustomValue(r, f, listOf(raw).concat([{ url: href, name: href.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] }])); },
        remove: (x) => A.removeFieldFile(r, f, x), open: (x) => A.openFieldFile(r, x)
      });
    }
    if (kd === 'relation') {
      const ids = listOf(raw);
      return Object.assign(base, {
        count: ids.length,
        items: allRows.filter((x) => x.id !== r.id && !x.archived).map((x) => ({ id: x.id, name: x.title, status: x.status, statusStyle: chipStyle(statusTone[x.status] || 'gray', { dark: dark, variant: 'block' }), on: ids.indexOf(x.id) >= 0 })),
        toggle: (id) => A.setCustomValue(r, f, ids.indexOf(id) >= 0 ? ids.filter((x) => x !== id) : ids.concat([id]))
      });
    }
    if (kd === 'formula') {
      const props = Object.keys(COLS).filter((x) => has(x)).map((x) => COLS[x].label).concat(customCols.filter((x) => x.id !== f.id).map((x) => x.label));
      return Object.assign(base, {
        canEdit: isAdmin, expr: conf.formula || '', props: props, fns: FORMULA_FUNCTIONS,
        evaluate: (src) => { const res = compileFormula(src).run(propOf(r), now); return res.error ? { error: res.error } : { value: showFormula(res.value) }; },
        save: (src) => { if ((src || '') !== (conf.formula || '')) A.setFieldConfig(f, { formula: src }); close(); }
      });
    }
    return null;
  };
  let ce = { label: '', project: '', editor: null, isPicker: false, picker: null, isStatusPicker: false, status: null, isList: false, isDate: false, isText: false, opts: [], hasClear: false, clear: () => {}, clearLabel: '', clearStyle: '', onKey: () => {}, cal: { label: '', weekdays: [], days: [], prev: () => {}, next: () => {} }, quick: [], quickStyle: '', navBtn: '', text: '', placeholder: '', onText: () => {}, onTextKey: () => {}, save: () => {}, hasOpen: false, openText: '', openStyle: '', openHref: '' };
  const ceRow = CE ? allRows.find((x) => x.job === CE.job) : null;
  if (ceRow && canCell(CE.key, ceRow)) {
    const r = ceRow, k = CE.key;
    const curV = k === 'link' ? (r.linkUrl || '') : (r[k] || '');
    const close = () => set({ cellEdit: null, ceText: '' });
    const kind = (COLS[k] || {}).kind || 'custom';
    const ed = editorModel(r, k, close);
    ce.label = colLabel(k);
    ce.project = r.title;
    ce.onKey = (e) => { if (e && e.key === 'Escape') { if (e.preventDefault) e.preventDefault(); close(); } };
    const optStyle = (on) => 'min-height: 40px; width: 100%; box-sizing: border-box; padding: 0 8px; border: 0; border-radius: 10px; display: flex; align-items: center; gap: 10px; text-align: left; cursor: pointer; white-space: nowrap; letter-spacing: normal; font-size: 14px; color: var(--ink); font-weight: ' + (on ? '600' : '500') + '; background: ' + (on ? 'var(--hover)' : 'transparent') + ';';
    const checkS = (on) => 'width: 16px; height: 16px; flex: none; display: inline-flex; color: var(--ink); opacity: ' + (on ? '1' : '0') + ';';
    const mkOpt = (label, sw, swText, meta) => ({ label: label, sel: label === curV ? 'true' : 'false', pick: () => label === curV ? close() : setField(r, k, label), style: optStyle(label === curV), check: checkS(label === curV), swStyle: sw, swText: swText || '', meta: meta || '' });
    const tileS = 'width: 22px; height: 22px; flex: none; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-2); font-size: 10px; font-weight: 700;';
    const ini2 = (v) => v.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    if (ed) {
      ce.editor = ed;
    } else if (k === 'status') {
      // Editors only see the statuses they may set (project_statuses.editors_can_set).
      const allowed = isAdmin ? D.statuses : D.statuses.filter((x) => x.editors_can_set);
      ce.isStatusPicker = true;
      ce.status = {
        label: ce.label, project: r.title, value: curV, close: close, canManage: isAdmin,
        align: popAlign(cols.findIndex((c) => c.key === k), cols.length),
        groups: statusGroups(allowed).filter((g) => g.opts.length),
        pick: (label) => (label === curV ? close() : setField(r, k, label))
      };
    } else if (kind === 'pill') {
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
      // Super Admins can create the sponsor or channel right here; it is set on the project once it exists.
      if (isAdmin) {
        const qa = s.qa && s.qa.key === 'ce' ? s.qa : { name: '', busy: false, err: '' };
        const go = () => {
          const name = (qa.name || '').trim();
          if (!name || qa.busy) return;
          const hit = vals.find((v) => v.toLowerCase() === name.toLowerCase());
          if (hit) { set({ qa: null }); return setField(r, k, hit); }
          set({ qa: { key: 'ce', name: name, busy: true, err: '' } });
          (k === 'sponsor' ? A.quickAddAccount(name, 'sponsor').then((a) => a.name) : A.addChannel(name).then(() => name))
            .then((v) => { set({ qa: null }); setField(r, k, v); })
            .catch((err) => set({ qa: { key: 'ce', name: name, busy: false, err: err.message } }));
        };
        ce.add = {
          label: k === 'sponsor' ? 'Add sponsor' : 'Add channel', placeholder: k === 'sponsor' ? 'New sponsor name' : 'New channel name',
          name: qa.name, busy: !!qa.busy, err: qa.err || '',
          onName: (e) => set({ qa: { key: 'ce', name: e.target.value, busy: false, err: '' } }),
          onKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(); } },
          go: go
        };
      }
    } else if (kind === 'date') {
      ce.isDate = true;
      const m = s.ceMonth == null ? today.getMonth() : s.ceMonth;
      const y = s.ceYear == null ? today.getFullYear() : s.ceYear;
      const sd = lead(y, m), dmn = new Date(y, m + 1, 0).getDate();
      const cp = curV === r[k] ? parseAt(r, k) : parse(curV);
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
      ce.cal = { label: MONTH_NAMES[m] + ' ' + y, weekdays: rotate(['S', 'M', 'T', 'W', 'T', 'F', 'S']), days: dys, prev: () => { const x = shiftMonth(y, m, -1); set({ ceMonth: x.m, ceYear: x.y }); }, next: () => { const x = shiftMonth(y, m, 1); set({ ceMonth: x.m, ceYear: x.y }); } };
      ce.quick = [['Today', 0], ['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map((x) => { const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + x[1]); return { label: x[0], pick: () => setField(r, k, MONTHS[dt.getMonth()] + ' ' + dt.getDate(), { iso: isoOf(dt) }) }; });
      ce.quickStyle = 'min-height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--ink-2); font-size: 12px; font-weight: 600; cursor: pointer;';
      ce.navBtn = 'width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';
      ce.hasClear = !!curV;
      ce.clearLabel = 'Clear date';
    } else if (isSelectField(customCols.find((x) => x.id === k))) {
      const f = customCols.find((x) => x.id === k);
      const m = optModel(f);
      const cur = labelsOf((r.cf || {})[k]);
      const pick = (label) => {
        if (m.multi) A.setCustomValue(r, f, cur.indexOf(label) >= 0 ? cur.filter((x) => x !== label) : cur.concat([label]));
        else { if (cur[0] !== label) A.setCustomValue(r, f, label); close(); }
      };
      ce.isPicker = true;
      ce.picker = Object.assign({}, m, {
        label: ce.label, project: r.title, value: cur, close: close,
        align: popAlign(cols.findIndex((c) => c.key === k), cols.length),
        pick: pick,
        createPick: (label) => { const o = m.create(label); if (o) pick(o.label); },
        remove: (label) => A.setCustomValue(r, f, m.multi ? cur.filter((x) => x !== label) : null),
        clear: () => { A.setCustomValue(r, f, null); close(); }
      });
    } else {
      ce.isText = true;
      const fk = k === 'link' ? 'linkUrl' : k;
      ce.text = s.ceText == null ? curV : s.ceText;
      ce.placeholder = k === 'link' ? 'Paste a draft or YouTube URL' : 'Type a value';
      ce.onText = (e) => set({ ceText: e && e.target ? e.target.value : '' });
      const save = (val) => setField(r, fk, String(val == null ? (s.ceText || '') : val).trim());
      ce.save = () => save();
      ce.onTextKey = (e) => { if (e && e.key === 'Enter') { if (e.preventDefault) e.preventDefault(); save(e.target ? e.target.value : null); } else if (e && e.key === 'Escape') { if (e.preventDefault) e.preventDefault(); close(); } };
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
  // Editors opened from the project modal's header or properties rail anchor under the row and open to the right.
  ce.src = CE && CE.src ? CE.src : '';
  if (ce.src) [ce.editor, ce.status, ce.picker].forEach((x) => { if (x) x.align = 'left'; });

  // ---------- New project (app addition, styled like the design's Add account dialog) ----------
  const np = {
    open: !!s.npOpen,
    close: () => set({ npOpen: false, npErr: '', npPromote: '', npCreated: null }),
    title: s.npTitle || '', job: s.npJob || '', film: s.npFilm || '', pub: s.npPub || '',
    onTitle: (e) => set({ npTitle: e.target.value }), onJob: (e) => set({ npJob: e.target.value.toUpperCase() }),
    onFilm: (iso) => set({ npFilm: iso }), onPub: (iso) => set({ npPub: iso }),
    // Scrolling the dialog would leave a viewport-fixed list behind, so it closes instead.
    onScroll: () => { if ((s.ddOpen || '').startsWith('np')) set({ ddOpen: '' }); },
    dialog: 'top: 0; right: 0; bottom: 0; left: 0; height: fit-content; margin: auto; transform: none; width: 600px;',
    // Quick add for the Channel list. Channels are admin-only in RLS, so others get a hint instead.
    ch: {
      canAdd: isAdmin, name: s.npNewCh || '', busy: !!s.npChBusy, err: s.npChErr || '',
      onName: (e) => set({ npNewCh: e.target.value, npChErr: '' }),
      onKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); np.ch.add(); } },
      add: () => {
        const name = (s.npNewCh || '').trim();
        if (!name || s.npChBusy) return;
        if (D.channels.some((c) => c.name.toLowerCase() === name.toLowerCase())) return set({ npChannel: D.channels.find((c) => c.name.toLowerCase() === name.toLowerCase()).name, npNewCh: '', ddOpen: '' });
        set({ npChBusy: true, npChErr: '' });
        A.addChannel(name).then(() => set({ npChannel: name, npNewCh: '', npChBusy: false, ddOpen: '' }))
          .catch((err) => set({ npChBusy: false, npChErr: err.message }));
      }
    },
    err: s.npErr || '', hasErr: !!s.npErr,
    busy: !!s.npBusy, createLabel: s.npBusy ? 'Creating…' : s.npCreated ? 'Link idea' : 'Create project',
    create: () => {
      if (s.npBusy) return;
      const idea = s.npPromote ? D.ideas.find((x) => x.id === s.npPromote) : null;
      const finish = (j) => set({ npOpen: false, npErr: '', npPromote: '', npCreated: null, openJob: j, dTab: 'overview', nav: idea ? 'projects' : s.nav });
      // Promote to project: the project and the idea link are two writes. If the link fails, Create retries the link on
      // the project already made instead of making a second one.
      const link = (id, j) => (idea ? A.promoteIdea(idea, id).then((ok) => (ok ? finish(j)
        : set({ npCreated: { id: id, job: j }, npErr: 'Project ' + j + ' was created, but the idea did not link to it. Press Link idea to try again.' }))) : finish(j));
      if (s.npCreated) { set({ npBusy: true }); return link(s.npCreated.id, s.npCreated.job).finally(() => set({ npBusy: false })); }
      const title = (s.npTitle || '').trim();
      const job = (s.npJob || '').trim();
      if (!title) return set({ npErr: 'Give the project a title.' });
      if (!job) return set({ npErr: 'Enter a job number.' });
      if (D.rows.some((x) => x.job.toLowerCase() === job.toLowerCase())) return set({ npErr: 'That job number is already in use.' });
      const tpl = D.templates.find((t) => t.id === s.npTemplate) || null;
      const typeLabel = s.npType || (tpl ? (D.types.find((t) => t.id === tpl.content_type_id) || {}).label : '') || (D.types[0] || {}).label;
      set({ npBusy: true });
      A.createProject({
        title: title, job: job,
        channel: s.npChannel || (D.channels[0] || {}).name, type: typeLabel, status: s.npStatus || defaultStatus.label,
        film: s.npFilm || null, pub: s.npPub || null, sponsor: s.npSponsor || '', template: tpl
      }).then((created) => {
        if (!created) return;
        return link(created, job);
      })
        .catch((err) => set({ npErr: err.message }))
        .finally(() => set({ npBusy: false }));
    }
  };

  const ddOpenKey = s.ddOpen || '';
  // float: the list is fixed to the viewport (from the button's rect) so a scrolling dialog can't clip it, and flips up near the bottom.
  const mkDD = (key, list, onChange, variant, label, align, more) => {
    const isOpen = ddOpenKey === key;
    const L = list || [];
    const curO = L.find((o) => o.on) || L[0] || { label: '' };
    const field = variant === 'field';
    const M = more || {};
    const r = M.float && isOpen ? s.ddRect : null;
    let pop = 'position: absolute; z-index: 1; top: calc(100% + 6px); ' + (align === 'right' ? 'right: 0;' : 'left: 0;') + ' min-width: 100%; max-height: 300px;';
    if (r) {
      const below = r.vh - r.bottom - 16, above = r.top - 16, up = below < 220 && above > below;
      pop = 'position: fixed; z-index: 70; left: ' + r.left + 'px; min-width: ' + r.width + 'px; ' + (up ? 'bottom: ' + (r.vh - r.top + 6) : 'top: ' + (r.bottom + 6)) + 'px; max-height: ' + Math.min(300, Math.max(140, (up ? above : below) - 6)) + 'px;';
    }
    const empty = !curO.label;
    // more.add = { label, placeholder, run(name) -> Promise<value> }: a "create it here" row under the list. The new
    // value is picked as soon as it exists. State lives in s.qa, one dropdown at a time.
    const qa = s.qa && s.qa.key === key ? s.qa : { name: '', busy: false, err: '' };
    const go = () => {
      const name = (qa.name || '').trim();
      if (!name || qa.busy) return;
      set({ qa: { key: key, name: name, busy: true, err: '' } });
      Promise.resolve(M.add.run(name))
        .then((v) => { set({ qa: null, ddOpen: '' }); onChange({ target: { value: v } }); })
        .catch((err) => set({ qa: { key: key, name: name, busy: false, err: (err && err.message) || String(err) } }));
    };
    const add = M.add ? {
      label: M.add.label, placeholder: M.add.placeholder, name: qa.name, busy: !!qa.busy, err: qa.err || '',
      onName: (e) => set({ qa: { key: key, name: e.target.value, busy: false, err: '' } }),
      onKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } },
      go: go
    } : null;
    return {
      add: add,
      open: isOpen, exp: isOpen ? 'true' : 'false', value: empty ? (M.placeholder || '') : curO.label, label: label, aria: label + ': ' + (curO.label || M.placeholder || 'none'),
      valueStyle: 'flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;' + (empty ? ' color: var(--faint, #8A8A8A); font-weight: 400;' : ''),
      empty: !L.length,
      wrap: 'position: relative;' + (field ? ' width: 100%;' : '') + (isOpen ? ' z-index: 60;' : ''),
      toggle: (e) => {
        const b = M.float && !isOpen && e && e.currentTarget ? e.currentTarget.getBoundingClientRect() : null;
        set(b ? { ddOpen: key, ddRect: { top: b.top, bottom: b.bottom, left: b.left, width: b.width, vh: window.innerHeight } } : { ddOpen: isOpen ? '' : key });
      },
      close: () => set({ ddOpen: '' }),
      onKey: (e) => { if (e && e.key === 'Escape' && isOpen) set({ ddOpen: '' }); },
      btn: 'position: relative; z-index: 2; display: flex; align-items: center; gap: 8px; box-sizing: border-box; cursor: pointer; text-align: left; letter-spacing: normal; font-size: 14px; font-weight: 500; color: var(--ink); border-radius: 12px; border: 1px solid ' + (isOpen ? 'var(--ink)' : 'var(--border)') + '; ' + (field ? 'width: 100%; min-height: 44px; padding: 0 12px 0 14px; background: var(--surface-2);' : 'min-width: 150px; min-height: 40px; padding: 0 10px 0 12px; background: var(--surface);'),
      chev: 'flex: none; color: var(--muted-2); transition: transform .15s ease; transform: rotate(' + (isOpen ? '180' : '0') + 'deg);',
      pop: pop + ' width: max-content; max-width: 340px; overflow-y: auto; box-sizing: border-box; padding: 6px; display: flex; flex-direction: column; gap: 2px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.14);',
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
  dd.autoRet = mkDD('autoRet', AV.adm.retOpts, AV.adm.onRet, 'compact', 'Run history', 'right');
  dd.wsTz = mkDD('wsTz', AV.adm.ws.tzs, AV.adm.ws.onTz, 'field', 'Time zone', 'left');
  dd.wsView = mkDD('wsView', AV.adm.ws.views, AV.adm.ws.onView, 'field', 'Default board view', 'left');
  dd.wsNewStage = mkDD('wsNewStage', AV.adm.ws.stages, AV.adm.ws.onNewStage, 'field', 'Stage', 'left');
  dd.wsNewFtype = mkDD('wsNewFtype', AV.adm.ws.ftypes, AV.adm.ws.onNewFType, 'field', 'Type', 'left');
  dd.ctChannel = mkDD('ctChannel', PV.ct.channels, PV.ct.onChannel, 'compact', 'Channel', 'right');
  Object.keys(IV.ids.dds).forEach((k) => { const x = IV.ids.dds[k]; dd[k] = mkDD(k, x[0], x[1], x[2], x[3], x[4], x[5]); });
  Object.keys(PV.ct.dds || {}).forEach((k) => { const x = PV.ct.dds[k]; dd[k] = mkDD(k, x[0], x[1], x[2], x[3], x[4], x[5]); });
  dd.pfView = mkDD('pfView', PV.pf.views, PV.pf.onView, 'compact', 'Default board view', 'right');
  dd.nuAcct = mkDD('nuAcct', D.accounts.map((a) => ({ value: a.id, label: a.name + (a.type === 'client' ? ' (client)' : ' (sponsor)'), on: a.id === nuAcctId })), (e) => set({ nuAcct: e.target.value }), 'field', 'Account', 'left');
  dd.acct = mkDD('acct', me.accounts.map((a) => ({ value: a.id, label: a.name, on: !!acct && a.id === acct.id })), (e) => A.switchAccount(e.target.value), 'field', 'Account', 'left');
  const tplName = (t) => t.name + ' · ' + ((D.types.find((x) => x.id === t.content_type_id) || {}).label || '');
  dd.npTemplate = mkDD('npTemplate', [{ value: '', label: 'No template', on: !s.npTemplate }].concat(D.templates.map((t) => ({ value: t.id, label: tplName(t), on: s.npTemplate === t.id }))), (e) => {
    const t = D.templates.find((x) => x.id === e.target.value);
    set({ npTemplate: e.target.value, npType: t ? ((D.types.find((x) => x.id === t.content_type_id) || {}).label || '') : s.npType });
  }, 'field', 'Template', 'left', { float: true });
  dd.npChannel = mkDD('npChannel', opts(D.channels.map((x) => [x.name, x.name]), s.npChannel || (D.channels[0] || {}).name), (e) => set({ npChannel: e.target.value }), 'field', 'Channel', 'left', { float: true, placeholder: 'Select a channel' });
  dd.npType = mkDD('npType', opts(D.types.map((x) => [x.label, x.label]), s.npType || (D.types[0] || {}).label), (e) => set({ npType: e.target.value }), 'field', 'Content type', 'left', { float: true, placeholder: 'Select a type' });
  dd.npStatus = mkDD('npStatus', opts(D.statuses.map((x) => [x.label, x.label]), s.npStatus || defaultStatus.label), (e) => set({ npStatus: e.target.value }), 'field', 'Status', 'left', { float: true, placeholder: 'Select a status' });
  dd.npSponsor = mkDD('npSponsor', opts([['', 'No sponsor']].concat(D.accounts.filter((a) => a.type === 'sponsor').map((a) => [a.name, a.name])), s.npSponsor || ''), (e) => set({ npSponsor: e.target.value }), 'field', 'Sponsor', 'left',
    { float: true, placeholder: 'No sponsor', add: isAdmin ? { label: 'Add sponsor', placeholder: 'New sponsor name', run: (name) => A.quickAddAccount(name, 'sponsor').then((a) => a.name) } : null });

  const months = (d) => MONTH_NAMES[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  return {
    dd: dd, weekStart: WEEK0,
    rec: recordVals({ s: s, set: set, D: D, A: A }),
    ce: ce, np: np,
    closeCell: () => set({ cellEdit: null, ceText: '' }),
    drPop: 'position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; width: 296px; max-height: 380px; overflow-y: auto; box-sizing: border-box; padding: 8px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.18); text-align: left; font-size: 14px; font-weight: 500; color: var(--ink); cursor: default; white-space: normal;',
    tableFade: tableMin > 1100, tableScroll: 'position: relative; overflow-x: auto; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; padding-bottom: ' + (CE && groups.filter((g) => g.open && g.rows.length).slice(-1).some((g) => g.rows.some((x) => x.cells.some((y) => y.editing))) ? 420 : 8) + 'px;',
    drawerOpen: !!cur,
    dr: dr,
    closeDrawer: closeDrawer,
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
    chat: PV.chat, pg: PV.pg, inbox: PV.nt, lib: PV.ct, perf: PV.perf, br: PV.br, pf: PV.pf,
    openSettings: () => set({ nav: 'settings', openJob: '' }),
    acctCurrent: s.nav === 'settings' ? 'page' : 'false',
    acctInitial: (me.name || '?').slice(0, 1).toUpperCase(),
    hasAcctSwitch: isSponsorRole && me.accounts.length > 1,
    adm: AV.adm, ap: AV.ap, ui: AV.ui, wn: isAdmin ? AV.wn : { open: false },
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
    navLabel: s.panel ? 'min-width: 0; overflow: hidden; text-overflow: ellipsis;' : 'display: none;',
    sideStyle: 'flex: none; width: ' + (s.panel ? 284 : 76) + 'px; box-sizing: border-box; border-right: 1px solid var(--line); border-radius: 28px 0 0 28px; background: var(--surface-2); transition: width .18s ease;',
    sideHead: 'display: flex; align-items: center; gap: 12px; box-sizing: border-box; ' + (s.panel ? 'padding: 20px 10px 20px 18px;' : 'flex-direction: column; padding: 18px 0 14px;'),
    collapseBtn: 'width: 36px; height: 36px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;',
    collapseChev: s.panel ? 'M10 15l-3-3 3-3' : 'M8 9l3 3-3 3',
    acctStyle: s.nav === 'settings' ? navOn : navOff,
    panelClosed: !s.panel,
    rootStyle: rootStyle,
    // Fixed dark tile so the off-white FTGU logo reads in every theme and accent.
    tileStyle: 'width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: #111111;',
    panelOpen: !!s.panel,
    panelPressed: s.panel ? 'true' : 'false',
    panelToggleLabel: s.panel ? 'Collapse sidebar' : 'Expand sidebar',
    togglePanel: () => { set({ panel: !s.panel }); A.savePrefs({ panel: !s.panel }); },
    wsName: D.ws.name, wsSub: isSponsorRole ? (acctName || 'Client portal') : 'Production board',
    todayFull: months(today), todayLong: WEEKDAYS_LONG[today.getDay()] + ', ' + MONTH_NAMES[today.getMonth()] + ' ' + today.getDate(),
    dark: dark,
    sheet: sheet,
    colDel: (() => {
      const f = s.colDelete ? customCols.find((x) => x.id === s.colDelete) : null;
      return { open: !!f, title: f ? 'Delete ' + f.label + '?' : '', cancel: () => set({ colDelete: '' }), confirm: () => { set({ colDelete: '' }); if (f) A.deleteField(f); } };
    })(),
    toast: s.toast || '', hasToast: !!s.toast,
    hasToastAction: !!(s.toast && s.toastAction), toastActionLabel: s.toastAction ? s.toastAction.label : '',
    toastAct: () => { const a = s.toastAction; set({ toast: '', toastAction: null }); if (a && a.run) a.run(); },
    newProject: openNew({}),

    pipeline: pipeline,
    onSearch: (e) => set({ q: e && e.target ? e.target.value : '' }),
    groups: groups,
    canEdit: canEdit && can('projects', 'create'),
    readOnly: isSponsorRole,
    tableWrapStyle: 'min-width: ' + tableMin + 'px;',

    vbtn: vbtn, vpick: vpick, vp: vp, vshow: vshow,
    syncPick: syncPickVals({ s: s, set: set, A: A }),
    bulk: curView !== 'table' || !pickedRows.length ? null : (() => {
      const n = pickedRows.length;
      const word = n === 1 ? 'project' : 'projects';
      const allArchived = pickedRows.every((r) => r.archived);
      const clear = () => set({ picked: {}, pickAnchor: '', bulkConfirm: false });
      return {
        countText: n + ' selected', canSelectAll: n < sorted.length, selectAllText: 'Select all ' + sorted.length,
        selectAll: () => setPicked(sorted.map((r) => r.id), true), clear: clear,
        archiveText: allArchived ? 'Restore' : 'Archive',
        archive: () => { clear(); A.archiveProjects(pickedRows, !allArchived); },
        confirm: !!s.bulkConfirm, askDelete: () => set({ bulkConfirm: true }), cancelDelete: () => set({ bulkConfirm: false }),
        confirmText: 'Permanently delete ' + n + ' ' + word + '? Files, comments and history go too. This cannot be undone.',
        deleteText: 'Delete ' + n + ' ' + word,
        del: () => { const rows = pickedRows; clear(); A.deleteProjects(rows); }
      };
    })(),
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
    closeModal: () => set({ modal: '', colStep: '' }),
    addCol: addCol,
    onModalSearch: (e) => set({ mq: e && e.target ? e.target.value : '' }),
    dirList: dirList,
    dirEmpty: dirList.length === 0,
    inviteFromModal: () => { set({ modal: '' }); if (isAdmin) { set({ nav: 'team' }); openAddUser(); } else A.toast('Ask a Super Admin to invite new people.'); },
    onColName: (e) => set({ newColName: e && e.target ? e.target.value : '' }),
    colName: s.newColName || '',
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

    filterActive: rulesCount > 0, filterCount: rulesCount, fx: fx,
    sortActive: SORTS.length > 0, sortLabel: fx.sort.label,
    vp: { props: propsModel, presets: presetsModel, group: groupModel, layout: layoutModel },
    viewOpen: !!s.viewBar, viewExp: s.viewBar ? 'true' : 'false', toggleViewBar: () => set({ viewBar: !s.viewBar, menu: '' }),
    viewBtn: toolStyle(!!s.viewBar || viewN > 0), viewActive: viewN > 0, viewCount: String(viewN),
    viewChev: 'transition: transform 160ms ease; transform: rotate(' + (s.viewBar ? '180' : '0') + 'deg);', colsActive: colsChanged, hiddenText: hiddenCount + ' hidden',
    groupLabel: (gbOpts.find((o) => o.id === gb) || gbOpts[0]).label,
    archiveItems: archiveItems, hasArchiveItems: archiveItems.length > 0,
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
