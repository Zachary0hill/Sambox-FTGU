// Ideas & Research. Ported from docs/design/ideas-research (Main, NewIdea, IdeaDetail, IdeaEdit); data comes from the ideas tables.
import { relTime, MONTH_NAMES, MONTHS } from './model';
import { SOURCES, LIMITS, RESEARCH_PROVIDERS, defaultTopics } from '../research/catalog';

const FORMATS = ['Long-form', 'Short', 'Reel', 'Livestream', 'Podcast clip'];
const PLATFORMS = ['YouTube', 'Shorts', 'TikTok', 'Instagram', 'Facebook'];
const PILLARS = ['Education', 'Behind the scenes', 'Product', 'Story', 'Trend'];
const EFFORTS = ['Small', 'Medium', 'Large'];
const TYPES = ['Idea', 'Script', 'Research'];
const ORDER = ['Draft', 'In Review', 'Approved', 'In production'];
const HIGHLIGHTS = [['#FFE14D', 'Yellow highlight'], ['#FFFFFF', 'White highlight'], ['#16FFDE', 'Mint highlight'], ['none', 'No highlight']];
const ICE_DEF = [['Impact', 'How much it moves views, leads or sales'], ['Confidence', 'How sure you are it lands, backed by data'], ['Ease', 'How cheap it is to shoot and edit']];
const DAY = 86400000;
let toastTimer = null;

const val = (e) => (e && e.target ? e.target.value : '');
const scoreOf = (i) => (i.ice && i.ice.every((n) => n != null) ? (i.ice[0] + i.ice[1] + i.ice[2]) / 3 : null);
const fmtScore = (n) => (n == null ? '–' : n.toFixed(1));
const splitHook = (h) => { const w = String(h || '').trim().split(/\s+/); return [w[0] || '', w.slice(1).join(' ')]; };
const hookOf = (i) => (i.hook || String(i.title || '').split(' ').slice(0, 3).join(' '));
const tagList = (txt) => String(txt || '').split(/[\s,]+/).filter(Boolean).map((g) => (g.charAt(0) === '#' ? g : '#' + g).toLowerCase());
const paras = (txt) => String(txt || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const windowLabel = (iso, short) => { if (!iso) return ''; const [y, m] = String(iso).split('-').map(Number); return (short ? MONTHS : MONTH_NAMES)[m - 1] + ' ' + y; };
const isUrl = (r) => /^https?:\/\//i.test(String(r || '').trim());
const hostOf = (r) => { try { return new URL(r).hostname.replace(/^www\./, ''); } catch { return ''; } };
const typing = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

// Script beats from the body: "0:20 The problem: text", "Cold open: text", or a plain paragraph.
const beatsOf = (body) => body.map((p, n) => {
  let m = p.match(/^(\d{1,2}:\d{2})\s+([^:]{1,48}?)\s*[:–—-]\s+([\s\S]+)$/);
  if (m) return { time: m[1], label: m[2], text: m[3] };
  m = p.match(/^([^:\n]{2,40}):\s+([\s\S]+)$/);
  if (m && !isUrl(p)) return { time: '', label: m[1], text: m[2] };
  return { time: '', label: 'Beat ' + (n + 1), text: p };
});

export function ideasVals(c) {
  const s = c.s, set = c.set, dark = c.dark, TONE = c.TONE, DARKFILL = c.DARKFILL, actColor = c.actColor;
  const auth = c.authBrands, role = s.role, brandTile = c.brandTile, D = c.D, A = c.A, me = c.me;
  const solid = (tn) => dark ? DARKFILL[tn] : [TONE[tn][3], '#FFFFFF'];
  const hardBlock = (f, h) => 'display: inline-flex; align-items: center; flex: none; height: ' + (h || 26) + 'px; padding: 0 10px; border-radius: 0; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + (f ? f[0] : 'var(--chip)') + '; color: ' + (f ? f[1] : 'var(--ink-3)') + ';';
  const TYPE_T = { 'Idea': 'blue', 'Script': 'amber', 'Research': 'coral' };
  const STAT_T = { 'Draft': null, 'In Review': 'violet', 'Approved': 'green', 'In production': null, 'Archived': null };
  const typeBlock = (t, h) => hardBlock(solid(TYPE_T[t] || 'gray'), h || 24);
  const statusBlock = (st, h) => st === 'Archived' ? hardBlock(['var(--chip)', 'var(--muted)'], h || 24) : st === 'In production' ? hardBlock(['var(--inv)', 'var(--inv-ink)'], h || 24) : hardBlock(STAT_T[st] ? solid(STAT_T[st]) : null, h || 24);
  const softBlock = 'display: inline-flex; align-items: center; height: 24px; padding: 0 10px; background: var(--chip); color: var(--ink-3); font-size: 12px; font-weight: 600; white-space: nowrap;';
  const who = (id, label) => (id && id === me.id ? 'You' : label);
  const nowMs = Date.now();

  const all = D.ideas.map((i) => Object.assign({}, i, {
    hook: hookOf(i), score: scoreOf(i),
    days: Math.floor((nowMs - new Date(i.updatedAt || i.at || nowMs).getTime()) / DAY),
    comments: i.comments.map((cm) => ({ who: who(cm.whoId, cm.who), time: relTime(cm.at), text: cm.text })),
    hist: i.hist.map((h) => ({ who: who(h.whoId, h.who), text: h.text, time: relTime(h.at), at: h.at }))
  }));
  const visible = all.filter((i) => auth.indexOf(i.brand) >= 0);
  const canEditI = (i) => role === 'admin' || (role === 'sponsor' && auth.indexOf(i.brand) >= 0) || (role === 'designer' && i.byId === me.id);
  const canCreate = role !== 'editor' && auth.length > 0;
  const BCOL = {};
  D.brands.forEach((b) => { BCOL[b.name] = b.color; });
  const brandOf = (name) => D.brands.find((b) => b.name === name) || null;
  const lumH = (h) => { const x = String(h || '#5F5F5F').replace('#', ''); const v = [0, 2, 4].map((k) => parseInt(x.substr(k, 2), 16) / 255).map((u) => u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ini = (b) => String(b || '').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const DOT = { 'Draft': 'var(--border-strong)', 'In Review': solid('violet')[0], 'Approved': solid('green')[0], 'In production': 'var(--ink)', 'Archived': 'var(--faint)' };
  const dotS = (c2, size) => 'width: ' + (size || 8) + 'px; height: ' + (size || 8) + 'px; flex: none; border-radius: 999px; background: ' + c2 + ';';
  const scoreTone = (n) => n == null ? ['var(--chip)', 'var(--muted)'] : n >= 7.5 ? [TONE.green[0], TONE.green[1]] : n >= 6.5 ? [TONE.amber[0], TONE.amber[1]] : ['var(--chip)', 'var(--ink-3)'];
  const scoreTag = (n) => n == null ? 'Not scored' : n >= 7.5 ? 'Strong' : n >= 6.5 ? 'Promising' : 'Needs work';
  const scorePill = (n, small) => { const t = scoreTone(n); return 'flex: none; display: inline-flex; align-items: center; height: ' + (small ? 24 : 28) + 'px; padding: 0 ' + (small ? 8 : 10) + 'px; border-radius: 8px; background: ' + t[0] + '; color: ' + t[1] + '; font-size: ' + (small ? 12 : 13) + 'px; font-weight: 700; font-variant-numeric: tabular-nums;'; };
  const tagPill = (n) => { const t = scoreTone(n); return 'display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; background: ' + t[0] + '; color: ' + t[1] + '; font-size: 12px; font-weight: 700;'; };
  const priS = (p, h) => 'display: inline-flex; align-items: center; flex: none; height: ' + (h || 24) + 'px; padding: 0 8px; border-radius: 7px; font-size: ' + (h > 24 ? 12 : 11) + 'px; font-weight: 700; ' + (p === 1 ? 'background: #111111; color: #FFFFFF;' : 'background: rgba(255,255,255,0.92); color: #111111;');
  const priFlat = (p) => 'display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 7px; font-size: 12px; font-weight: 700; ' + (p === 1 ? 'background: var(--inv); color: var(--inv-ink);' : 'background: var(--chip-2); color: var(--ink-2);');
  const typeTag = (t) => 'display: inline-flex; align-items: center; height: 22px; padding: 0 8px; font-size: 11px; font-weight: 600; white-space: nowrap; background: ' + solid(TYPE_T[t] || 'gray')[0] + '; color: ' + solid(TYPE_T[t] || 'gray')[1] + ';';
  const pill = (on) => 'display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; box-sizing: border-box; border-radius: 999px; cursor: pointer; white-space: nowrap; font-size: 14px; font-weight: 500; letter-spacing: normal; ' + (on ? 'background: var(--chip-2); border: 1.5px solid var(--ink); color: var(--ink);' : 'background: transparent; border: 1px solid var(--border); color: var(--ink-3);');
  const chip = (on, h) => 'display: inline-flex; align-items: center; gap: 6px; min-height: ' + (h || 40) + 'px; padding: 0 ' + (h ? 12 : 14) + 'px; box-sizing: border-box; border-radius: 999px; font-size: ' + (h ? 13 : 14) + 'px; font-weight: 500; letter-spacing: normal; cursor: pointer; ' + (on ? 'background: var(--inv); border: 1px solid var(--inv); color: var(--inv-ink);' : 'background: var(--surface); border: 1px solid var(--border); color: var(--ink-3);');
  const seg = (on, grow) => (grow ? 'flex: 1 1 auto; ' : '') + 'min-height: 38px; padding: 0 14px; border: 0; border-radius: 11px; font-size: 13px; font-weight: 600; letter-spacing: normal; white-space: nowrap; cursor: pointer; ' + (on ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgba(17,17,17,0.12);' : 'background: transparent; color: var(--muted);');
  const checkBox = (on) => 'width: 16px; height: 16px; flex: none; box-sizing: border-box; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; color: #FFFFFF; ' + (on ? 'background: ' + solid('green')[0] + ';' : 'border: 1.5px solid var(--border-strong);');
  const checks = (list) => list.map((x) => ({ label: x[0], on: !!x[1], sr: x[1] ? ', done' : ', missing', color: x[1] ? 'var(--ink)' : 'var(--muted)', box: checkBox(!!x[1]) }));
  const opt = (list, cur) => list.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1], on: o[0] === cur } : { value: o, label: o, on: o === cur }));

  // Banner: brand color + hook, image only, or image + hook. An image style without an image falls back to the brand color.
  // size: card (gallery 16:9), board (76px strip), mini (list), modal (detail and edit), preview (New idea).
  const banner = (b, size) => {
    const img = b.coverMode !== 'hook' && !!b.coverUrl;
    const bg = BCOL[b.brand] || '#5F5F5F';
    const ink = img ? '#FFFFFF' : lumH(bg) > 0.4 ? '#111111' : '#FFFFFF';
    const focal = b.focal || [50, 50];
    const fill = img ? 'background: #222222 url("' + b.coverUrl + '") ' + focal[0] + '% ' + focal[1] + '% / cover no-repeat;' : 'background: ' + bg + ';';
    const pos = b.hookPos === 'center' ? 'align-items: center; justify-content: center; text-align: center;' : b.hookPos === 'top' ? 'align-items: flex-start;' : 'align-items: flex-end;';
    const arch = b.status === 'Archived' ? ' filter: grayscale(1); opacity: 0.7;' : '';
    const box = {
      // Bottom hooks sit above the comment badge; top hooks clear the priority chip.
      card: 'aspect-ratio: 16 / 9; padding: ' + (b.hookPos === 'top' ? '48px 18px 18px' : '18px 18px 48px') + '; border-radius: 16px;',
      preview: 'aspect-ratio: 16 / 9; padding: ' + (b.hookPos === 'top' ? '48px 18px 18px' : '18px 18px 48px') + '; border-radius: 16px;',
      board: 'height: 76px; padding: 10px 12px;',
      mini: 'width: 56px; height: 32px; flex: none; border-radius: 6px;',
      modal: 'height: clamp(220px, 34vw, 300px); padding: 28px 32px;' + (b.hookPos === 'top' ? ' padding-top: 76px;' : ''),
      edit: 'height: clamp(240px, 38vw, 340px); padding: 28px 32px;' + (b.hookPos === 'top' ? ' padding-top: 76px;' : '')
    }[size];
    const fs = { card: '28px', preview: '26px', board: '16px', modal: 'clamp(28px, 5.2vw, 52px)', edit: 'clamp(28px, 5.2vw, 52px)' }[size] || '0';
    const hk = splitHook(b.hook || 'Your hook');
    const hl = b.highlight || '#FFE14D';
    return {
      style: 'position: relative; display: flex; box-sizing: border-box; overflow: hidden; color: ' + ink + '; ' + fill + ' ' + pos + ' ' + box + arch,
      showHook: size !== 'mini' && (b.coverMode !== 'image' || !img),
      hookStyle: 'position: relative; max-width: ' + (size === 'board' ? '86%' : size === 'modal' || size === 'edit' ? '72%' : '78%') + '; font-family: var(--font-title); font-weight: 900; font-size: ' + fs + '; line-height: 1.05; letter-spacing: -0.03em; text-transform: uppercase; pointer-events: none;' + (img ? ' text-shadow: 0 2px 12px rgba(0,0,0,0.35);' : ''),
      hiStyle: hl === 'none' ? '' : 'padding: 0 ' + (size === 'board' ? 4 : 6) + 'px; background: ' + hl + '; color: #111111; text-shadow: none; -webkit-box-decoration-break: clone; box-decoration-break: clone;',
      hookHi: hk[0], hookRest: hk[1], isImg: img
    };
  };

  // ---------- Main page: smart views, filters, sort, layout ----------
  const q = (s.iq || '').trim().toLowerCase();
  const fBrand = auth.indexOf(s.iBrand) >= 0 ? s.iBrand : 'all';
  const fType = s.iType || 'all', fFormat = s.iFormat || 'all', fPillar = s.iPillar || 'all';
  const sort = s.iSort || 'score';
  const prefs = me.prefs || {};
  const layout = s.iLayout || prefs.ideaLayout || 'gallery';
  const savedViews = s.iViews !== undefined ? s.iViews : (Array.isArray(prefs.ideaViews) ? prefs.ideaViews : []);
  const live = (i) => i.status !== 'Archived';
  const VIEWS = [
    ['active', 'All active', (i) => live(i), 'var(--ink)'],
    ['mine', 'My ideas', (i) => live(i) && (i.ownerId === me.id || i.byId === me.id), 'var(--ink)'],
    ['review', 'Needs review', (i) => i.status === 'In Review', DOT['In Review']],
    ['ready', 'Ready to produce', (i) => i.status === 'Approved', DOT['Approved']],
    ['top', 'Top scored', (i) => live(i) && i.score != null && i.score >= 7.5, TONE.amber[3]],
    ['stale', 'Stale 14d+', (i) => live(i) && i.status !== 'In production' && i.days >= 14, TONE.red[3]],
    ['research', 'From research', (i) => live(i) && i.source === 'research', TONE.coral[3]],
    ['archived', 'Archived', (i) => i.status === 'Archived', 'var(--faint)']
  ];
  const cur = VIEWS.find((v) => v[0] === s.iView) || VIEWS[0];
  // Show ideas from a research run narrows every layout to that run's ideas until the filters are reset.
  const runRow = s.iRun ? (D.researchRuns || []).find((r) => r.id === s.iRun) : null;
  const runIds = runRow ? runRow.idea_ids || [] : null;
  const match = (i) => (!runIds || runIds.indexOf(i.id) >= 0) && (fBrand === 'all' || i.brand === fBrand) && (fType === 'all' || i.type === fType) &&
    (fFormat === 'all' || i.format === fFormat) && (fPillar === 'all' || i.pillar === fPillar) &&
    (!q || [i.title, i.hook, i.brand, i.pillar, i.format, i.audience, i.body.join(' '), i.tags.join(' ')].join(' ').toLowerCase().indexOf(q) >= 0);
  const base = visible.filter(match);
  const byScore = (a, b) => (b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score);
  const sorter = sort === 'recent' ? (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))
    : sort === 'priority' ? (a, b) => (a.priority - b.priority) || byScore(a, b) : (a, b) => byScore(a, b) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  const shown = base.filter(cur[2]).sort(sorter);
  const filtersNow = { brand: fBrand, type: fType, format: fFormat, pillar: fPillar };
  const sameView = (v) => v.view === cur[0] && v.sort === sort && v.layout === layout && ['brand', 'type', 'format', 'pillar'].every((k) => (v.filters || {})[k] === filtersNow[k]);
  const views = VIEWS.map((v) => ({
    label: v[1], count: String(base.filter(v[2]).length), pressed: cur[0] === v[0] ? 'true' : 'false', style: pill(cur[0] === v[0]),
    dot: dotS(v[3]), pick: () => set({ iView: v[0], iRun: '' })
  }));
  const saved = savedViews.map((v, n) => ({
    label: v.name, pressed: sameView(v) ? 'true' : 'false', style: pill(sameView(v)) + ' padding: 0; gap: 0; overflow: hidden;',
    pick: () => set({ iView: v.view, iSort: v.sort, iLayout: v.layout, iBrand: (v.filters || {}).brand || 'all', iType: (v.filters || {}).type || 'all', iFormat: (v.filters || {}).format || 'all', iPillar: (v.filters || {}).pillar || 'all' }),
    removeLabel: 'Remove saved view ' + v.name,
    remove: () => { const next = savedViews.filter((x, k) => k !== n); set({ iViews: next }); A.savePrefs({ ideaViews: next }); }
  }));
  const saveView = () => {
    const name = String(s.iSaveName || '').trim();
    if (!name) return;
    const next = savedViews.filter((v) => v.name !== name).concat([{ name: name, view: cur[0], filters: filtersNow, sort: sort, layout: layout }]);
    set({ iViews: next, iSaveOpen: false, iSaveName: '' });
    A.savePrefs({ ideaViews: next });
  };
  const layouts = [['gallery', 'Gallery'], ['board', 'Board'], ['list', 'List']].map((l) => ({
    label: l[1], pressed: layout === l[0] ? 'true' : 'false', isGallery: l[0] === 'gallery', isBoard: l[0] === 'board', isList: l[0] === 'list',
    pick: () => { set({ iLayout: l[0] }); A.savePrefs({ ideaLayout: l[0] }); },
    style: 'width: 40px; height: 38px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 11px; cursor: pointer; ' + (layout === l[0] ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgba(17,17,17,0.12);' : 'background: transparent; color: var(--muted);')
  }));
  const open = (i) => () => set({ ideaOpen: i.id, ideaEdit: null, ideaConfirm: '', ideaDraft: '', ideaTab: 'overview', ddOpen: '' });

  // Toast with Undo for board moves.
  const showToast = (t) => { set({ iToast: t }); clearTimeout(toastTimer); toastTimer = setTimeout(() => set({ iToast: null }), 6000); };
  const move = (id, to) => {
    const i = visible.find((x) => x.id === id);
    set({ iDrag: '', iOver: '' });
    if (!i || i.status === to) return;
    if (!canEditI(i)) return A.toast(role === 'designer' ? 'Only the creator or a Super Admin can move this idea.' : 'You cannot move this idea.');
    if (i.status === 'In production') return A.toast('This idea is linked to a project. Archive it from the idea instead.');
    if (to === 'In production') return A.toast('Promote an Approved idea to a project to start production.');
    const arch = to === 'Archived';
    // The toast and its Undo show once the write lands; a failed write puts the card back (updateIdea reverts it).
    A.updateIdea(i, arch ? { status: to, prev: i.status } : { status: to }, arch ? 'archived the idea' : 'moved Status to ' + to).then((ok) => {
      if (ok) showToast({ text: '"' + i.title + '" ' + (arch ? 'archived' : 'moved to ' + to), id: i.id, from: i.status, prev: i.prev || '' });
    });
  };
  const undo = () => {
    const t = s.iToast;
    set({ iToast: null });
    if (!t) return;
    const i = D.ideas.find((x) => x.id === t.id);
    if (i) A.updateIdea(i, { status: t.from, prev: t.prev }, 'moved Status back to ' + t.from).then((ok) => { if (ok) A.toast('Moved "' + i.title + '" back to ' + t.from + '.'); });
  };
  const NEXT = { 'Draft': 'In Review', 'In Review': 'Approved' };
  const dropId = (e) => s.iDrag || (e && e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
  const boardSet = base.filter(cur[2]);
  const BOARD = cur[0] === 'archived' ? ['Archived'] : ['Draft', 'In Review', 'Approved', 'In production'];
  const cols = BOARD.filter((k) => k !== 'In production' || boardSet.some((i) => i.status === k)).map((k) => {
    const items = boardSet.filter((i) => i.status === k).sort(sorter);
    const over = s.iOver === k && !!s.iDrag;
    return {
      label: k, count: String(items.length), addLabel: 'Add idea to ' + k, empty: items.length === 0, canAdd: canCreate && k === 'Draft',
      dot: dotS(DOT[k]),
      style: 'display: flex; flex-direction: column; gap: 10px; min-height: 420px; min-width: 0; box-sizing: border-box; padding: 10px; border-radius: 20px; transition: background 0.12s ease, border-color 0.12s ease; ' + (over ? 'background: var(--hover); border: 2px dashed var(--ink);' : 'background: var(--surface-2); border: 2px solid var(--line);'),
      over: (e) => { e.preventDefault(); if (s.iOver !== k) set({ iOver: k }); },
      drop: (e) => { e.preventDefault(); const id = dropId(e); if (id) move(id, k); },
      items: items.map((i) => {
        const bn = banner(i, 'board');
        const nx = NEXT[i.status];
        // In production ideas belong to their project; they move from the idea (Open project), not by dragging.
        const ce = canEditI(i) && i.status !== 'In production' && i.status !== 'Archived';
        return {
          title: i.title, brand: i.brand, format: i.format, type: i.type, comments: String(i.comments.length), open: open(i),
          hookHi: bn.hookHi, hookRest: bn.hookRest, thumbStyle: bn.style, hookStyle: bn.hookStyle, hiStyle: bn.hiStyle, showHook: bn.showHook,
          score: fmtScore(i.score), scoreStyle: scorePill(i.score, true), typeStyle: typeTag(i.type),
          ownerIni: ini(who(i.ownerId, i.owner) === 'You' ? me.name : i.owner) || '?', ownerLabel: 'Owner ' + who(i.ownerId, i.owner),
          canDrag: ce ? 'true' : 'false', canMove: ce && !!nx, moveLabel: nx ? 'Move ' + i.title + ' to ' + nx : '', move: () => { if (nx) move(i.id, nx); },
          style: 'display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); overflow: hidden; transition: opacity 0.12s ease, transform 0.12s ease; cursor: ' + (ce ? 'grab' : 'default') + '; ' + (s.iDrag === i.id ? 'opacity: 0.4; transform: rotate(-1deg);' : 'box-shadow: 0 1px 2px rgba(17,17,17,0.04);'),
          dragStart: (e) => { if (!ce) { e.preventDefault(); return; } if (e.dataTransfer) { e.dataTransfer.setData('text/plain', i.id); e.dataTransfer.effectAllowed = 'move'; } set({ iDrag: i.id, iToast: null }); }
        };
      })
    };
  });
  const archOn = s.iOver === 'Archived' && !!s.iDrag;
  const cards = shown.map((i) => {
    const bn = banner(i, 'card');
    const mini = banner(i, 'mini');
    const arch = i.status === 'Archived';
    return {
      title: i.title, brand: i.brand, status: i.status, format: i.format, type: i.type, owner: who(i.ownerId, i.owner), updated: relTime(i.updatedAt),
      aria: 'Open idea: ' + i.title + ', ' + i.status, open: open(i),
      pri: 'P' + i.priority, priStyle: priS(i.priority), fromResearch: i.source === 'research', isImg: bn.isImg,
      thumbStyle: bn.style, hookStyle: bn.hookStyle, hiStyle: bn.hiStyle, hookHi: bn.hookHi, hookRest: bn.hookRest, showHook: bn.showHook,
      badge: i.type + '  ·  ' + i.comments.length + (i.comments.length === 1 ? ' comment' : ' comments'),
      initials: ini(i.brand),
      avatarStyle: 'width: 40px; height: 40px; flex: none; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 700;',
      titleStyle: 'font-size: 16px; font-weight: 600; line-height: 1.35; color: ' + (arch ? 'var(--muted)' : 'var(--ink)') + '; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;',
      dot: dotS(DOT[i.status]), score: fmtScore(i.score), scoreStyle: scorePill(i.score), smallScoreStyle: scorePill(i.score, true), typeStyle: typeTag(i.type),
      miniThumb: mini.style
    };
  });
  const nShown = layout === 'board' ? boardSet.length : shown.length;
  const pillars = PILLARS.concat(visible.map((i) => i.pillar).filter((p) => p && PILLARS.indexOf(p) < 0).filter((p, k, a) => a.indexOf(p) === k).sort());

  // ---------- Shared pickers ----------
  const people = (D.directory || []).filter((p) => p.status === 'active' && (p.role === 'super_admin' || p.role === 'designer' || p.id === me.id));
  const ownerOpts = (cur2) => {
    const list = people.map((p) => [p.id, p.id === me.id ? 'You' : p.full_name || p.name]);
    if (cur2 && !list.some((o) => o[0] === cur2)) list.push([cur2, (D.directory || []).find((p) => p.id === cur2) ? D.directory.find((p) => p.id === cur2).name : 'Someone else']);
    if (!list.some((o) => o[0] === me.id)) list.unshift([me.id, 'You']);
    return opt(list, cur2 || me.id);
  };
  const today = new Date();
  const monthIso = (k) => { const d = new Date(today.getFullYear(), today.getMonth() + k, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };
  const windowOpts = (cur2) => {
    const list = [['', 'No window yet']].concat([0, 1, 2, 3, 4, 5].map((k) => [monthIso(k), (k === 0 ? 'This month, ' : '') + windowLabel(monthIso(k))]));
    if (cur2 && !list.some((o) => o[0] === cur2)) list.push([cur2, windowLabel(cur2)]);
    return opt(list, cur2 || '');
  };
  const sponsors = D.brands.filter((b) => b.kind === 'sponsor');
  const sponsorOpts = (cur2) => opt([['', 'None']].concat(sponsors.map((b) => [b.id, b.name])), cur2 || '');
  const sponsorName = (id) => (sponsors.find((b) => b.id === id) || {}).name || '';
  const pillarOpts = (cur2) => opt([['', 'No pillar']].concat(pillars.concat(cur2 && pillars.indexOf(cur2) < 0 ? [cur2] : []).map((p) => [p, p])), cur2 || '');
  const brandById0 = {};
  D.brands.forEach((b) => { brandById0[b.id] = b; });
  const runLabel = (r) => (brandById0[r.brand_id] ? brandById0[r.brand_id].name + ': ' : '') + ((r.inputs || {}).topics || []).join(', ').slice(0, 60) + '  ·  ' + relTime(r.created_at);
  const runsDone = (D.researchRuns || []).filter((r) => r.status === 'done');
  const toggle = (list, v) => (list.indexOf(v) >= 0 ? list.filter((x) => x !== v) : list.concat([v]));
  // Reads a dropped or picked image; returns { file, url, name } or an error message.
  const takeImage = (f) => {
    if (!f) return null;
    if (!/^image\//.test(f.type || '')) return { err: 'Covers must be an image (JPG, PNG or WebP).' };
    if (f.size > 10 * 1024 * 1024) return { err: 'That image is over 10 MB. Pick a smaller one.' };
    let url = '';
    try { url = URL.createObjectURL(f); } catch { url = ''; }
    return { file: f, url: url, name: f.name };
  };
  const fileOf = (e) => (e && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) || (e && e.target && e.target.files && e.target.files[0]) || null;
  const brandImages = (brandName) => ((brandOf(brandName) || {}).assets || []).filter((a) => a && a.path && /\.(jpe?g|png|webp|gif|avif)$/i.test(a.name || a.path));

  // ---------- Idea detail ----------
  const sel = visible.find((i) => i.id === s.ideaOpen) || null;
  const ed = sel && s.ideaEdit && s.ideaEdit.id === sel.id ? s.ideaEdit : null;
  let detail = null, edit = null;
  if (sel && !ed) {
    const i = sel;
    const ce = canEditI(i);
    const arch = i.status === 'Archived';
    const ix = ORDER.indexOf(i.status);
    const commit = (p, text) => { set({ ideaConfirm: '' }); A.updateIdea(i, p, text); };
    const project = i.projectId ? (D.rows || []).find((r) => r.id === i.projectId) || null : null;
    const startEdit = () => set({ ideaEdit: {
      id: i.id, title: i.title, hook: D.ideas.find((x) => x.id === i.id).hook || '',
      type: i.type, pillar: i.pillar, audience: i.audience, promise: i.promise, body: i.body.join('\n\n'), tags: i.tags.slice(), tagDraft: '',
      refs: i.refs.length ? i.refs.slice() : [''], ice: i.ice.map((n) => (n == null ? 5 : n)), iceSet: i.score != null,
      ownerId: i.ownerId || me.id, priority: i.priority, format: i.format, platforms: i.platforms.slice(), effort: i.effort, window: i.window, sponsorId: i.sponsorId,
      coverMode: i.coverMode, coverUrl: i.coverUrl, coverPath: i.coverPath, focal: i.focal.slice(), highlight: i.highlight, hookPos: i.hookPos,
      file: null, drag: false, err: '', confirmClose: false
    }, ddOpen: '' });
    const canApprove = ce;
    let cta = null, back = null;
    if (ce && !arch) {
      if (i.status === 'Draft') cta = { label: 'Send for review', pick: () => commit({ status: 'In Review' }, 'sent the idea for review') };
      else if (i.status === 'In Review' && canApprove) {
        cta = { label: 'Approve', pick: () => commit({ status: 'Approved' }, 'approved the idea') };
        back = { label: 'Request changes', pick: () => {
          const t = (s.ideaDraft || '').trim();
          commit({ status: 'Draft' }, 'requested changes');
          if (t) { set({ ideaDraft: '' }); A.commentIdea(i, t); }
        } };
      } else if (i.status === 'Approved' && role === 'admin') {
        const ch = brandOf(i.brand) && brandOf(i.brand).channel_id ? (D.channels || []).find((x) => x.id === brandOf(i.brand).channel_id) : null;
        // The sponsor fit carries over when its brand is linked to a sponsor account.
        const spAcct = (D.accounts || []).find((a) => a.id === ((D.brands.find((b) => b.id === i.sponsorId) || {}).account_id));
        cta = { label: 'Promote to project', pick: () => set({ npOpen: true, npErr: '', npCreated: null, npTitle: i.title, npJob: '', npFilm: '', npPub: '', npStatus: '', npType: '', npChannel: ch ? ch.name : '', npSponsor: spAcct ? spAcct.name : '', npTemplate: '', npPromote: i.id, menu: '', ideaOpen: '' }) };
      }
    }
    if (i.status === 'In production' && project) cta = { label: 'Open project', pick: () => set({ ideaOpen: '', nav: 'projects', openJob: project.job, dTab: 'overview' }) };
    const steps = ORDER.map((k, n) => {
      const done = !arch && n < ix, on = !arch && n === ix;
      return {
        label: k, num: done ? '✓' : String(n + 1), current: on ? 'step' : undefined,
        style: 'flex: 1 1 120px; min-width: 0; display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border-radius: 12px; font-size: 13px; font-weight: 600; overflow: hidden; ' + (on ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgba(17,17,17,0.12);' : done ? 'color: ' + TONE.green[1] + ';' : 'color: var(--muted);'),
        dotStyle: 'width: 22px; height: 22px; flex: none; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; ' + (done ? 'background: ' + solid('green')[0] + '; color: ' + solid('green')[1] + ';' : on ? 'background: var(--inv); color: var(--inv-ink);' : 'background: var(--chip-2); color: var(--ink-3);'),
        labelStyle: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
      };
    });
    const beats = beatsOf(i.body);
    const run = i.researchRunId ? (D.researchRuns || []).find((r) => r.id === i.researchRunId) : null;
    const refs = i.refs.map((r) => {
      const u = isUrl(r), h = u ? hostOf(r) : '';
      return { title: u ? (r.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').slice(0, 80)) : r, meta: u ? h + '  ·  Link' : 'Note', href: u ? r.trim() : undefined, isLink: u,
        thumb: 'width: 72px; height: 44px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; ' + (u ? 'background: var(--chip-2); color: var(--ink-3);' : 'background: ' + TONE.amber[0] + '; color: ' + TONE.amber[1] + ';'), thumbText: u ? (h.split('.')[0] || 'link').slice(0, 8) : 'Note' };
    });
    if (run) refs.push({ title: 'Research run: ' + ((run.inputs || {}).topics || []).join(', ') + ', ' + (run.finding_count || 0) + ' findings', meta: 'Research  ·  ' + relTime(run.created_at), href: undefined, isLink: false, thumb: 'width: 72px; height: 44px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: ' + TONE.coral[0] + '; color: ' + TONE.coral[1] + ';', thumbText: 'Run' });
    const TABS = [['overview', 'Overview', ''], ['script', 'Script', beats.length ? beats.length + (beats.length === 1 ? ' beat' : ' beats') : ''], ['refs', 'References', refs.length ? String(refs.length) : ''], ['history', 'History', String(i.hist.length)]];
    const tab = TABS.some((t) => t[0] === s.ideaTab) ? s.ideaTab : 'overview';
    const btnG = 'display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--ink); font-size: 14px; font-weight: 600; letter-spacing: normal; cursor: pointer;';
    const acts = [];
    if (ce && !arch) acts.push({ label: 'Edit', icon: 'edit', style: btnG, pick: startEdit });
    if (canCreate && auth.indexOf(i.brand) >= 0) acts.push({ label: 'Duplicate', icon: 'copy', style: btnG, pick: () => {
      const brand = brandOf(i.brand);
      A.createIdea({ title: i.title + ' (copy)', brandId: brand.id, type: i.type, body: i.body, hook: D.ideas.find((x) => x.id === i.id).hook || '', tags: i.tags, refs: i.refs, format: i.format, pillar: i.pillar, audience: i.audience, promise: i.promise, platforms: i.platforms, ice: i.score != null ? i.ice : undefined, priority: i.priority, effort: i.effort, window: i.window, sponsorId: i.sponsorId, coverMode: i.coverPath ? 'hook' : i.coverMode, highlight: i.highlight, hookPos: i.hookPos })
        .then((id) => { if (id) { set({ ideaOpen: id, ideaTab: 'overview' }); A.toast('Duplicated. The copy starts as a Draft.'); } }).catch((err) => A.toast(err.message));
    } });
    if (ce && !arch) acts.push({ label: 'Archive', icon: 'archive', style: btnG, pick: () => commit({ status: 'Archived', prev: i.status }, 'archived the idea') });
    if (ce && arch) acts.push({ label: 'Restore', icon: 'restore', style: btnG, pick: () => commit({ status: i.prev || 'Draft', prev: '' }, 'restored the idea') });
    if (role === 'admin' && arch) {
      const confirm = s.ideaConfirm === i.id;
      acts.push({ label: confirm ? 'Confirm permanent delete' : 'Delete permanently', icon: 'trash', style: btnG + ' color: var(--red-ink);' + (confirm ? ' background: var(--red-soft); border-color: transparent;' : ''),
        pick: () => { if (confirm) { set({ ideaConfirm: '', ideaOpen: '' }); A.deleteIdea(i); } else set({ ideaConfirm: i.id }); } });
    }
    const note = !ce ? (role === 'designer' ? 'You can comment here. Only the creator or a Super Admin can edit this idea.' : 'You can comment here. Editing is limited for this idea.') : arch ? 'Archived ideas are hidden from the default views. Restore to edit again.' : '';
    const bn = banner(i, 'modal');
    const ready = [['Cover image set', !!i.coverPath], ['Angle and takeaway defined', !!(i.audience && i.promise)], ['Script drafted', i.body.length > 0], ['References added', i.refs.length > 0 || !!run], ['Approved', ix >= 2]];
    const hasDraft = !!(s.ideaDraft || '').trim();
    const post = () => { const t = (s.ideaDraft || '').trim(); if (!t) return; set({ ideaDraft: '' }); A.commentIdea(i, t); };
    detail = {
      bannerStyle: bn.style, showHook: bn.showHook, hookStyle: bn.hookStyle, hiStyle: bn.hiStyle, hookHi: bn.hookHi, hookRest: bn.hookRest,
      pri: 'P' + i.priority, priStyle: priS(i.priority, 28), isImg: bn.isImg, canCover: ce && !arch, changeCover: startEdit,
      brand: i.brand, brandInitials: ini(i.brand), brandTile: brandTile(28),
      type: i.type, typeStyle: typeBlock(i.type, 24), status: i.status, statusStyle: statusBlock(i.status, 24),
      meta: [i.format, i.pillar].filter(Boolean), metaStyle: softBlock,
      title: i.title,
      byline: 'Created by ' + (i.byId === me.id ? 'you' : i.by) + ' on ' + i.date + '  ·  Updated ' + relTime(i.updatedAt),
      actions: acts, hasNote: !!note, note: note,
      steps: steps, showStepper: !arch, hasCta: !!cta, cta: cta ? cta.label : '', advance: cta ? cta.pick : () => {},
      hasBack: !!back, backLabel: back ? back.label : '', back: back ? back.pick : () => {},
      tabs: TABS.map((t) => ({ label: t[1], count: t[2], id: 'idt-' + t[0], panel: 'idp-' + t[0], selected: tab === t[0] ? 'true' : 'false', tabIndex: tab === t[0] ? '0' : '-1', pick: () => set({ ideaTab: t[0] }),
        style: 'display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 14px; border: 0; border-bottom: 2px solid ' + (tab === t[0] ? 'var(--ink)' : 'transparent') + '; margin-bottom: -1px; background: transparent; font-size: 14px; letter-spacing: normal; font-weight: ' + (tab === t[0] ? '700' : '500') + '; color: ' + (tab === t[0] ? 'var(--ink)' : 'var(--muted)') + '; cursor: pointer; white-space: nowrap;' })),
      onTabKey: (e) => {
        const k = TABS.map((t) => t[0]), n = k.indexOf(tab);
        const to = e.key === 'ArrowRight' ? k[(n + 1) % k.length] : e.key === 'ArrowLeft' ? k[(n + k.length - 1) % k.length] : null;
        if (!to) return;
        e.preventDefault(); set({ ideaTab: to });
        setTimeout(() => { const el = document.getElementById('idt-' + to); if (el) el.focus(); }, 0);
      },
      isOverview: tab === 'overview', isScript: tab === 'script', isRefs: tab === 'refs', isHistory: tab === 'history',
      hasAngle: !!(i.audience || i.promise), audience: i.audience || 'Not set yet', promise: i.promise || 'Not set yet',
      audStyle: 'font-size: 15px; font-weight: 600; line-height: 1.4; color: ' + (i.audience ? 'var(--ink)' : 'var(--muted)') + ';',
      promStyle: 'font-size: 15px; font-weight: 600; line-height: 1.4; color: ' + (i.promise ? 'var(--ink)' : 'var(--muted)') + ';',
      paras: i.body, noBody: i.body.length === 0, tags: i.tags,
      beats: beats, noBeats: beats.length === 0, refs: refs, noRefs: refs.length === 0, history: i.hist,
      comments: i.comments.map((cm) => ({ who: cm.who, time: cm.time, text: cm.text, initials: cm.who.slice(0, 1).toUpperCase(), avatarStyle: 'width: 32px; height: 32px; flex: none; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #FFFFFF; background: ' + actColor(cm.who) + ';' })),
      noComments: i.comments.length === 0, canComment: !arch,
      draft: s.ideaDraft || '', onDraft: (e) => set({ ideaDraft: val(e) }), post: post,
      onDraftKey: (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post(); } },
      postStyle: 'flex: none; min-height: 48px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); font-size: 14px; font-weight: 600; letter-spacing: normal; cursor: pointer; opacity: ' + (hasDraft ? '1' : '0.45') + ';',
      score: fmtScore(i.score), scoreTag: scoreTag(i.score), scoreTagStyle: tagPill(i.score), scored: i.score != null,
      iceBars: ICE_DEF.map((k, n) => ({ label: k[0], value: i.ice[n] == null ? '–' : String(i.ice[n]), bar: 'display: block; width: ' + ((i.ice[n] || 0) * 10) + '%; height: 100%; border-radius: 999px; background: var(--ink);' })),
      owner: who(i.ownerId, i.owner), ownerIni: ini(who(i.ownerId, i.owner) === 'You' ? me.name : i.owner) || '?',
      priFlat: priFlat(i.priority), effort: i.effort || 'Not set', effortSet: !!i.effort,
      platforms: i.platforms, noPlatforms: i.platforms.length === 0,
      window: windowLabel(i.window) || 'No window yet', windowSet: !!i.window,
      sponsor: sponsorName(i.sponsorId) || 'None', sponsorSet: !!sponsorName(i.sponsorId),
      source: i.source === 'research' ? 'Research run' : 'Manual',
      project: project ? project.job + '  ·  ' + project.title : i.projectId ? 'Linked project' : 'Not promoted yet', projectSet: !!i.projectId,
      ready: checks(ready), readyLabel: ready.filter((r) => r[1]).length + ' of ' + ready.length
    };
  }

  // ---------- Edit view ----------
  if (sel && ed) {
    const i = sel;
    const upd = (p) => set({ ideaEdit: Object.assign({}, ed, { confirmClose: false, err: '' }, p) });
    const orig = { title: i.title, hook: D.ideas.find((x) => x.id === i.id).hook || '', type: i.type, pillar: i.pillar, audience: i.audience, promise: i.promise, body: i.body.join('\n\n'), tags: i.tags, refs: i.refs, ice: i.score != null ? i.ice : null, ownerId: i.ownerId || me.id, priority: i.priority, format: i.format, platforms: i.platforms, effort: i.effort, window: i.window, sponsorId: i.sponsorId, coverMode: i.coverMode, coverPath: i.coverPath, focal: i.focal, highlight: i.highlight, hookPos: i.hookPos };
    const draftRefs = ed.refs.map((r) => r.trim()).filter(Boolean);
    const now2 = { title: ed.title, hook: ed.hook, type: ed.type, pillar: ed.pillar, audience: ed.audience, promise: ed.promise, body: paras(ed.body).join('\n\n'), tags: ed.tags, refs: draftRefs, ice: ed.iceSet ? ed.ice : null, ownerId: ed.ownerId, priority: ed.priority, format: ed.format, platforms: ed.platforms, effort: ed.effort, window: ed.window, sponsorId: ed.sponsorId, coverMode: ed.coverMode, coverPath: ed.coverPath, focal: ed.focal, highlight: ed.highlight, hookPos: ed.hookPos };
    const dirty = !!ed.file || JSON.stringify(orig) !== JSON.stringify(now2);
    const close = () => set({ ideaEdit: null });
    const requestClose = () => { if (dirty && !ed.confirmClose) set({ ideaEdit: Object.assign({}, ed, { confirmClose: true }) }); else close(); };
    const save = async () => {
      if (!dirty || ed.busy) return;
      const title = (ed.title || '').trim();
      if (!title) return upd({ err: 'Give the idea a title.' });
      set({ ideaEdit: Object.assign({}, ed, { busy: true }) });
      const p = { title: title, hook: (ed.hook || '').trim(), type: ed.type, pillar: ed.pillar, audience: (ed.audience || '').trim(), promise: (ed.promise || '').trim(),
        body: paras(ed.body), tags: ed.tags, refs: draftRefs, ownerId: ed.ownerId, priority: ed.priority, format: ed.format, platforms: ed.platforms, effort: ed.effort,
        window: ed.window, sponsorId: ed.sponsorId, coverMode: ed.coverMode, focal: ed.focal, highlight: ed.highlight, hookPos: ed.hookPos };
      if (ed.iceSet) p.ice = ed.ice;
      else if (i.ice.some((n) => n != null)) p.ice = [null, null, null];
      if (!ed.file && ed.coverPath !== i.coverPath) p.coverPath = ed.coverPath;
      const ok = await A.updateIdea(i, p, 'edited the idea');
      if (!ok) return set({ ideaEdit: Object.assign({}, ed, { busy: false, err: 'Your changes were not saved. Check the message above and try again.' }) });
      if (ed.file) {
        const path = await A.setIdeaCover(Object.assign({}, i, p), ed.file, { coverMode: ed.coverMode === 'hook' ? 'both' : ed.coverMode, focal: ed.focal });
        if (!path) return set({ ideaEdit: Object.assign({}, ed, { busy: false, err: 'Your text changes were saved, but the cover image did not upload. Try Save again to retry the cover.' }) });
      }
      set({ ideaEdit: null });
      A.toast('Changes saved.');
    };
    const take = (e) => {
      const f = fileOf(e);
      const r = takeImage(f);
      if (!r) return upd({ drag: false });
      if (r.err) return upd({ drag: false, err: r.err });
      upd({ file: r.file, coverUrl: r.url, drag: false, coverMode: ed.coverMode === 'hook' ? 'both' : ed.coverMode, focal: [50, 50] });
    };
    const bn = banner(Object.assign({}, i, { hook: ed.hook || hookOf(Object.assign({}, i, { hook: '', title: ed.title })), coverMode: ed.coverMode, coverUrl: ed.coverUrl, focal: ed.focal, highlight: ed.highlight, hookPos: ed.hookPos, status: 'Draft' }), 'edit');
    const hasImg = !!ed.coverUrl;
    const addTag = () => { const v = String(ed.tagDraft || '').trim().replace(/^#?/, '#').toLowerCase(); if (v.length > 1 && ed.tags.indexOf(v) < 0) upd({ tags: ed.tags.concat([v]), tagDraft: '' }); else upd({ tagDraft: '' }); };
    const sc = ed.iceSet ? (ed.ice[0] + ed.ice[1] + ed.ice[2]) / 3 : null;
    edit = {
      bannerStyle: bn.style + ' cursor: ' + (hasImg ? 'crosshair' : 'default') + ';', showHook: bn.showHook, hookStyle: bn.hookStyle, hiStyle: bn.hiStyle, hookHi: bn.hookHi, hookRest: bn.hookRest,
      drag: !!ed.drag, hasImg: hasImg,
      onDragOver: (e) => { e.preventDefault(); if (!ed.drag) upd({ drag: true }); },
      onDragLeave: () => upd({ drag: false }), onDrop: (e) => { e.preventDefault(); take(e); }, onFile: (e) => { take(e); if (e.target) e.target.value = ''; },
      setFocal: (e) => { if (!hasImg) return; const r = e.currentTarget.getBoundingClientRect(); upd({ focal: [Math.max(0, Math.min(100, Math.round((e.clientX - r.left) / r.width * 100))), Math.max(0, Math.min(100, Math.round((e.clientY - r.top) / r.height * 100)))] }); },
      onFocalKey: (e) => {
        if (!hasImg) return;
        const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key];
        if (!d) return;
        e.preventDefault(); upd({ focal: [Math.max(0, Math.min(100, ed.focal[0] + d[0])), Math.max(0, Math.min(100, ed.focal[1] + d[1]))] });
      },
      focalLabel: hasImg ? 'Focal point ' + ed.focal[0] + '% across, ' + ed.focal[1] + '% down. Click the banner or use the arrow keys to move it.' : 'Add an image to set a focal point.',
      focalStyle: hasImg && ed.coverMode !== 'hook' ? 'position: absolute; left: ' + ed.focal[0] + '%; top: ' + ed.focal[1] + '%; width: 28px; height: 28px; margin: -14px 0 0 -14px; box-sizing: border-box; border: 2px solid #FFFFFF; border-radius: 999px; box-shadow: 0 0 0 2px rgba(17,17,17,0.5); pointer-events: none;' : 'display: none;',
      hint: hasImg ? 'Editing banner  ·  click to set the focal point, drop an image to replace' : 'Editing banner  ·  drop an image to add a cover',
      removeImg: () => upd({ file: null, coverUrl: '', coverPath: '', coverMode: 'hook' }),
      covers: [['hook', 'Brand color'], ['image', 'Image'], ['both', 'Image + hook']].map((x) => ({ label: x[1], pressed: ed.coverMode === x[0] ? 'true' : 'false', style: seg(ed.coverMode === x[0], true), pick: () => upd({ coverMode: x[0] }) })),
      highlights: HIGHLIGHTS.map((h) => ({ label: h[1], pressed: ed.highlight === h[0] ? 'true' : 'false', pick: () => upd({ highlight: h[0] }),
        style: 'width: 32px; height: 32px; flex: none; padding: 0; border-radius: 999px; cursor: pointer; ' + (h[0] === 'none' ? 'background: repeating-linear-gradient(135deg, #FFFFFF 0 4px, #E0E0E0 4px 8px);' : 'background: ' + h[0] + ';') + (ed.highlight === h[0] ? ' border: 2px solid var(--ink); box-shadow: inset 0 0 0 2px var(--surface);' : ' border: 1px solid var(--border-strong);') })),
      positions: [['bottom', 'Bottom'], ['center', 'Center'], ['top', 'Top']].map((x) => ({ label: x[1], pressed: ed.hookPos === x[0] ? 'true' : 'false', style: seg(ed.hookPos === x[0], true), pick: () => upd({ hookPos: x[0] }) })),
      brand: i.brand, brandInitials: ini(i.brand), brandTile: brandTile(28), status: i.status, statusStyle: statusBlock(i.status, 24),
      title: ed.title, onTitle: (e) => upd({ title: val(e) }),
      hook: ed.hook, hookCount: String(ed.hook || '').length + '/24', onHook: (e) => upd({ hook: val(e).slice(0, 24) }),
      hookPlaceholder: hookOf(Object.assign({}, i, { hook: '', title: ed.title })),
      audience: ed.audience, onAudience: (e) => upd({ audience: val(e) }), promise: ed.promise, onPromise: (e) => upd({ promise: val(e) }),
      body: ed.body, onBody: (e) => upd({ body: val(e) }),
      tags: ed.tags.map((t) => ({ label: t, removeLabel: 'Remove tag ' + t, remove: () => upd({ tags: ed.tags.filter((x) => x !== t) }) })),
      tagDraft: ed.tagDraft, onTagDraft: (e) => upd({ tagDraft: val(e) }),
      onTagKey: (e) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
        else if (e.key === 'Backspace' && !ed.tagDraft && ed.tags.length) upd({ tags: ed.tags.slice(0, -1) });
      },
      refs: ed.refs.map((r, n) => ({ id: 'ie-ref-' + n, label: 'Reference link ' + (n + 1), removeLabel: 'Remove reference ' + (n + 1), value: r,
        onChange: (e) => { const v = ed.refs.slice(); v[n] = val(e); upd({ refs: v }); }, remove: () => upd({ refs: ed.refs.length > 1 ? ed.refs.filter((x, k) => k !== n) : [''] }) })),
      addRef: () => upd({ refs: ed.refs.concat(['']) }),
      iceScore: fmtScore(sc), iceSet: !!ed.iceSet,
      ice: ICE_DEF.map((k, n) => ({ id: 'ie-ice-' + n, label: k[0], value: String(ed.ice[n]), onChange: (e) => { const v = ed.ice.slice(); v[n] = Number(val(e)); upd({ ice: v, iceSet: true }); } })),
      clearIce: () => upd({ iceSet: false }),
      pris: [1, 2, 3].map((p) => ({ label: 'P' + p, pressed: ed.priority === p ? 'true' : 'false', style: seg(ed.priority === p, true), pick: () => upd({ priority: p }) })),
      platforms: PLATFORMS.map((p) => { const on = ed.platforms.indexOf(p) >= 0; return { label: p, on: on, pressed: on ? 'true' : 'false', style: chip(on, 36), pick: () => upd({ platforms: toggle(ed.platforms, p) }) }; }),
      dirty: dirty, confirmClose: !!ed.confirmClose, err: ed.err || '', hasErr: !!ed.err,
      dirtyDot: dotS(ed.busy ? 'var(--muted)' : dirty ? TONE.amber[3] : 'var(--border-strong)'),
      dirtyLabel: ed.busy ? 'Saving…' : ed.confirmClose ? 'You have unsaved changes. Discard them?' : dirty ? 'Unsaved changes' : 'No changes',
      save: save, saveLabel: ed.busy ? 'Saving…' : 'Save changes',
      saveStyle: 'min-height: 44px; padding: 0 20px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); font-size: 14px; font-weight: 600; letter-spacing: normal; cursor: pointer; opacity: ' + (dirty && !ed.busy ? '1' : '0.5') + ';',
      requestClose: requestClose, discard: close, keepEditing: () => upd({}),
      onKey: (e) => { if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(); } }
    };
  }

  // ---------- New idea ----------
  const NI0 = { mode: 'quick', cover: 'hook', file: null, url: '', fileName: '', drag: false, title: '', hook: '', brand: '', type: 'Idea', body: '',
    audience: '', pillar: '', promise: '', format: '', platforms: [], ice: [5, 5, 5], iceSet: false, priority: 3, effort: '', ownerId: '', window: '', sponsorId: '',
    tags: '', refs: [''], runId: '', another: false, err: '', busy: false, pickOpen: false };
  const ni = Object.assign({}, NI0, s.ni || {});
  const niBrand = auth.indexOf(ni.brand) >= 0 ? ni.brand : (fBrand !== 'all' ? fBrand : auth[0]);
  const nset = (p) => set({ ni: Object.assign({}, ni, { err: '' }, p) });
  const full = ni.mode === 'full';
  const niImg = ni.cover !== 'hook' && !!ni.url;
  const niScore = full && ni.iceSet ? (ni.ice[0] + ni.ice[1] + ni.ice[2]) / 3 : null;
  const niTake = (e) => {
    const r = takeImage(fileOf(e));
    if (!r) return nset({ drag: false });
    if (r.err) return nset({ drag: false, err: r.err });
    nset({ file: r.file, url: r.url, fileName: r.name, drag: false, cover: ni.cover === 'hook' ? 'both' : ni.cover, pickOpen: false });
  };
  const closeNew = () => set({ ideaModal: false, ni: null });
  const create = () => {
    if (ni.busy) return;
    const title = (ni.title || '').trim();
    if (!title) return nset({ err: 'Give the idea a title.' });
    if (auth.indexOf(niBrand) < 0) return nset({ err: 'You cannot add ideas for that brand.' });
    const brand = brandOf(niBrand);
    const input = { title: title, brandId: brand.id, type: ni.type, body: paras(ni.body), hook: (ni.hook || '').trim(), cover: niImg ? ni.file : null, coverMode: niImg ? ni.cover : 'hook' };
    if (full) Object.assign(input, {
      audience: ni.audience.trim(), pillar: ni.pillar, promise: ni.promise.trim(), format: ni.format, platforms: ni.platforms,
      priority: ni.priority, effort: ni.effort, ownerId: ni.ownerId || me.id, window: ni.window, sponsorId: ni.sponsorId,
      tags: tagList(ni.tags), refs: ni.refs.map((r) => r.trim()).filter(Boolean), researchRunId: ni.runId
    }, ni.iceSet ? { ice: ni.ice } : {});
    nset({ busy: true });
    A.createIdea(input).then((id) => {
      if (!id) return nset({ busy: false });
      if (ni.another) {
        set({ ni: Object.assign({}, NI0, { mode: ni.mode, brand: niBrand, type: ni.type, another: true, cover: 'hook' }) });
        A.toast('Created "' + title + '". Add the next one.');
        setTimeout(() => { const el = document.getElementById('ni-title'); if (el) el.focus(); }, 0);
      } else set({ ideaModal: false, ni: null, ideaOpen: id, ideaTab: 'overview', iView: 'active', iq: '' });
    }).catch((err) => nset({ busy: false, err: err.message }));
  };
  const niChecks = [['Title', !!ni.title.trim()], ['Banner hook', !!ni.hook.trim()], ['Cover image', niImg], ['Audience', !!ni.audience.trim()],
    ['Viewer takeaway', !!ni.promise.trim()], ['Platforms', ni.platforms.length > 0], ['Content', !!ni.body.trim()], ['References', ni.refs.some((r) => r.trim())]];
  const niDone = niChecks.filter((x) => x[1]).length;
  const nb = banner({ brand: niBrand, hook: ni.hook || 'Your hook', coverMode: ni.cover, coverUrl: ni.url, focal: [50, 50], highlight: '#FFE14D', hookPos: 'bottom' }, 'preview');
  const TYPE_HINT = { 'Idea': 'A seed. One line is enough.', 'Script': 'Draft script or outline.', 'Research': 'Findings and sources.' };
  const runsForBrand = runsDone.filter((r) => !brandOf(niBrand) || r.brand_id === brandOf(niBrand).id);
  const newIdea = {
    modes: [['quick', 'Quick capture'], ['full', 'Full brief']].map((m) => ({ label: m[1], pressed: ni.mode === m[0] ? 'true' : 'false', style: seg(ni.mode === m[0]), pick: () => nset({ mode: m[0] }) })),
    isFull: full,
    covers: [['hook', 'Brand color + hook'], ['image', 'Image only'], ['both', 'Image + hook']].map((x) => ({ label: x[1], pressed: ni.cover === x[0] ? 'true' : 'false', style: chip(ni.cover === x[0]), pick: () => nset({ cover: x[0] }) })),
    showDrop: ni.cover !== 'hook' && !ni.url, hasImg: ni.cover !== 'hook' && !!ni.url,
    dropTitle: ni.drag ? 'Drop to set the banner' : 'Drag an image here',
    dropStyle: 'display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px 16px; border-radius: 18px; text-align: center; transition: background 0.12s ease, border-color 0.12s ease; ' + (ni.drag ? 'background: var(--hover); border: 2px dashed var(--ink);' : 'background: var(--surface-2); border: 2px dashed var(--border-strong);'),
    onDragOver: (e) => { e.preventDefault(); if (!ni.drag) nset({ drag: true }); },
    onDragLeave: () => nset({ drag: false }), onDrop: (e) => { e.preventDefault(); niTake(e); }, onFile: (e) => { niTake(e); if (e.target) e.target.value = ''; },
    removeImg: () => nset({ file: null, url: '', fileName: '' }),
    fileName: ni.fileName, fileThumb: 'width: 80px; height: 45px; flex: none; border-radius: 8px; background: ' + (ni.url ? 'url("' + ni.url + '") center / cover' : 'var(--chip)') + ';',
    canPick: brandImages(niBrand).length > 0, pickOpen: !!ni.pickOpen, togglePick: () => nset({ pickOpen: !ni.pickOpen }),
    brandFiles: brandImages(niBrand).map((a) => ({ label: a.name || a.path.split('/').pop(), pick: () => {
      nset({ pickOpen: false, busy: true });
      A.brandFileAsFile(a).then((f) => { const r = takeImage(f); set({ ni: Object.assign({}, ni, { busy: false, pickOpen: false, err: r && r.err ? r.err : '' }, r && !r.err ? { file: r.file, url: r.url, fileName: r.name, cover: ni.cover === 'hook' ? 'both' : ni.cover } : {}) }); })
        .catch((err) => set({ ni: Object.assign({}, ni, { busy: false, err: err.message }) }));
    } })),
    title: ni.title, onTitle: (e) => nset({ title: val(e) }),
    hook: ni.hook, hookCount: ni.hook.length + '/24', onHook: (e) => nset({ hook: val(e).slice(0, 24) }),
    showBrand: auth.length > 1,
    types: TYPES.map((t) => ({ label: t, hint: TYPE_HINT[t], pressed: ni.type === t ? 'true' : 'false', pick: () => nset({ type: t }),
      sw: 'width: 10px; height: 28px; flex: none; background: ' + solid(TYPE_T[t])[0] + ';',
      style: 'flex: 1 1 160px; display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 14px; box-sizing: border-box; border-radius: 14px; text-align: left; letter-spacing: normal; color: var(--ink); cursor: pointer; ' + (ni.type === t ? 'background: var(--surface); border: 1.5px solid var(--ink);' : 'background: var(--surface-2); border: 1px solid var(--border);') })),
    body: ni.body, onBody: (e) => nset({ body: val(e) }),
    audience: ni.audience, onAudience: (e) => nset({ audience: val(e) }), promise: ni.promise, onPromise: (e) => nset({ promise: val(e) }),
    formats: FORMATS.map((f) => ({ label: f, pressed: ni.format === f ? 'true' : 'false', style: chip(ni.format === f), pick: () => nset({ format: ni.format === f ? '' : f }) })),
    platforms: PLATFORMS.map((p) => { const on = ni.platforms.indexOf(p) >= 0; return { label: p, on: on, pressed: on ? 'true' : 'false', style: chip(on), pick: () => nset({ platforms: toggle(ni.platforms, p) }) }; }),
    ice: ICE_DEF.map((k, n) => ({ id: 'ni-ice-' + n, hintId: 'ni-ice-h-' + n, label: k[0], hint: k[1], value: String(ni.ice[n]), onChange: (e) => { const v = ni.ice.slice(); v[n] = Number(val(e)); nset({ ice: v, iceSet: true }); } })),
    iceScore: ni.iceSet ? fmtScore(niScore) : '–', iceTag: ni.iceSet ? scoreTag(niScore) : 'Move a slider to score', iceTagStyle: tagPill(niScore),
    pris: [1, 2, 3].map((p) => ({ label: 'P' + p, pressed: ni.priority === p ? 'true' : 'false', style: seg(ni.priority === p), pick: () => nset({ priority: p }) })),
    efforts: EFFORTS.map((p) => ({ label: p, pressed: ni.effort === p ? 'true' : 'false', style: seg(ni.effort === p), pick: () => nset({ effort: ni.effort === p ? '' : p }) })),
    tags: ni.tags, onTags: (e) => nset({ tags: val(e) }),
    refs: ni.refs.map((r, n) => ({ id: 'ni-ref-' + n, label: 'Reference link ' + (n + 1), removeLabel: 'Remove reference ' + (n + 1), value: r,
      onChange: (e) => { const v = ni.refs.slice(); v[n] = val(e); nset({ refs: v }); }, remove: () => nset({ refs: ni.refs.length > 1 ? ni.refs.filter((x, k) => k !== n) : [''] }) })),
    addRef: () => nset({ refs: ni.refs.concat(['']) }),
    canRun: role === 'admin' && runsForBrand.length > 0,
    another: !!ni.another, onAnother: (e) => nset({ another: !!(e && e.target && e.target.checked) }),
    thumbStyle: nb.style, showHook: nb.showHook, hookStyle: nb.hookStyle, hiStyle: nb.hiStyle, hookHi: nb.hookHi, hookRest: nb.hookRest,
    type: ni.type, pri: 'P' + ni.priority, priStyle: 'position: absolute; top: 12px; left: 12px; ' + priS(ni.priority),
    ini: ini(niBrand), previewTitle: ni.title.trim() || 'Untitled idea', brand: niBrand, format: ni.format, scorePill: scorePill(niScore), score: fmtScore(niScore),
    doneN: String(niDone), doneMax: String(niChecks.length), doneLabel: niDone + ' of ' + niChecks.length,
    doneBar: 'width: ' + Math.round(niDone / niChecks.length * 100) + '%; height: 100%; border-radius: 999px; background: var(--ink); transition: width 0.2s ease;',
    checks: checks(niChecks),
    create: create, createLabel: ni.busy ? 'Creating…' : 'Create idea', busy: !!ni.busy, close: closeNew,
    err: ni.err || '', hasErr: !!ni.err,
    onKey: (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); create(); } }
  };
  const openNew = (preset) => set({ ideaModal: true, ideaOpen: '', ni: Object.assign({}, NI0, preset || {}), ddOpen: '' });

  // Custom dropdowns (vals.js turns each into a mkDD): [list, onChange, variant, label, align, more].
  const dds = {
    ideaBrand: [opt([['all', 'All brands']].concat(auth.map((b) => [b, b])), fBrand), (e) => set({ iBrand: val(e) || 'all' }), 'compact', 'Brand', 'left'],
    ideaType: [opt([['all', 'All types']].concat(TYPES.map((t) => [t, t])), fType), (e) => set({ iType: val(e) || 'all' }), 'compact', 'Type', 'left'],
    ideaFormat: [opt([['all', 'All formats']].concat(FORMATS.map((t) => [t, t])), fFormat), (e) => set({ iFormat: val(e) || 'all' }), 'compact', 'Format', 'left'],
    ideaPillar: [opt([['all', 'All pillars']].concat(pillars.map((t) => [t, t])), fPillar), (e) => set({ iPillar: val(e) || 'all' }), 'compact', 'Pillar', 'left'],
    ideaSort: [opt([['score', 'Top score'], ['recent', 'Recently updated'], ['priority', 'Priority']], sort), (e) => set({ iSort: val(e) || 'score' }), 'compact', 'Sort', 'right'],
    niBrand: [opt(auth, niBrand), (e) => nset({ brand: val(e), runId: '' }), 'field', 'Brand', 'left', { float: true }],
    niPillar: [pillarOpts(ni.pillar), (e) => nset({ pillar: val(e) }), 'field', 'Content pillar', 'left', { float: true }],
    niOwner: [ownerOpts(ni.ownerId || me.id), (e) => nset({ ownerId: val(e) }), 'field', 'Owner', 'left', { float: true }],
    niWindow: [windowOpts(ni.window), (e) => nset({ window: val(e) }), 'field', 'Target publish window', 'left', { float: true }],
    niSponsor: [sponsorOpts(ni.sponsorId), (e) => nset({ sponsorId: val(e) }), 'field', 'Sponsor fit', 'left', { float: true }],
    niRun: [opt([['', 'No research run']].concat(runsForBrand.map((r) => [r.id, runLabel(r)])), ni.runId), (e) => nset({ runId: val(e) }), 'field', 'Research run', 'left', { float: true }]
  };
  if (ed) {
    const upd = (p) => set({ ideaEdit: Object.assign({}, ed, { confirmClose: false }, p) });
    Object.assign(dds, {
      ieType: [opt(TYPES, ed.type), (e) => upd({ type: val(e) }), 'field', 'Type', 'left', { float: true }],
      iePillar: [pillarOpts(ed.pillar), (e) => upd({ pillar: val(e) }), 'field', 'Content pillar', 'left', { float: true }],
      ieOwner: [ownerOpts(ed.ownerId), (e) => upd({ ownerId: val(e) }), 'field', 'Owner', 'left', { float: true }],
      ieFormat: [opt([['', 'Not set']].concat(FORMATS.map((f) => [f, f])), ed.format || ''), (e) => upd({ format: val(e) }), 'field', 'Format', 'left', { float: true }],
      ieEffort: [opt([['', 'Not set']].concat(EFFORTS.map((f) => [f, f])), ed.effort || ''), (e) => upd({ effort: val(e) }), 'field', 'Effort', 'left', { float: true }],
      ieWindow: [windowOpts(ed.window), (e) => upd({ window: val(e) }), 'field', 'Window', 'right', { float: true }],
      ieSponsor: [sponsorOpts(ed.sponsorId), (e) => upd({ sponsorId: val(e) }), 'field', 'Sponsor fit', 'left', { float: true }]
    });
  }

  // Keyboard: N opens New idea, Esc closes the top idea dialog, Cmd/Ctrl+Enter creates, Cmd/Ctrl+S saves an edit.
  const hotkey = (e) => {
    if (s.nav !== 'ideas' || !e) return false;
    const mod = e.metaKey || e.ctrlKey;
    const take = (fn) => { e.preventDefault(); fn(); return true; };
    if (e.key === 'Escape') {
      if (s.ddOpen || s.iSaveOpen) return take(() => set({ ddOpen: '', iSaveOpen: false }));
      if (edit) return take(edit.requestClose);
      if (detail) return take(() => set({ ideaOpen: '', ideaConfirm: '' }));
      if (s.ideaModal) return take(closeNew);
      return false;
    }
    if (s.ideaModal && mod && e.key === 'Enter') return take(create);
    if (edit && mod && (e.key === 's' || e.key === 'S')) return take(edit.save);
    if (!mod && !e.altKey && !e.repeat && (e.key === 'n' || e.key === 'N') && !typing(e.target) && canCreate && !s.ideaModal && !sel && !s.rsOpen && !s.npOpen) return take(() => openNew());
    return false;
  };

  // ---------- Research agent ----------
  // app: Super Admin runs the research agent. Keys stay on the server; the page sees connected status and run progress.
  const integOn = {};
  (D.integrations || []).forEach((g) => { integOn[g.provider] = g.status === 'connected'; });
  const aiOn = !!(integOn.anthropic || integOn.openai || integOn.gemini);
  const canResearch = role === 'admin' && aiOn && RESEARCH_PROVIDERS.some((p) => integOn[p]) && D.brands.length > 0;
  const RS_TONE = { queued: null, running: 'amber', done: 'green', failed: 'red', cancelled: null, skipped: null };
  const RS_LABEL = { queued: 'Queued', running: 'Running', done: 'Done', failed: 'Failed', cancelled: 'Cancelled', skipped: 'Skipped' };
  const rsBlock = (st) => hardBlock(RS_TONE[st] ? solid(RS_TONE[st]) : null, 24);
  const brandById = {};
  D.brands.forEach((b) => { brandById[b.id] = b; });
  const rsBrand = D.brands.find((b) => b.id === s.rsBrand) || D.brands.find((b) => auth.indexOf(b.name) >= 0) || D.brands[0] || null;
  const rsTopics = s.rsTopics !== undefined ? s.rsTopics : defaultTopics(rsBrand);
  const rsSel = s.rsSources || {};
  const srcOn = (x) => !!integOn[x.via];
  const srcPicked = (x) => srcOn(x) && (rsSel[x.id] !== undefined ? rsSel[x.id] : x.id !== 'tiktok');
  const rsCount = s.rsCount || LIMITS.defaultIdeas;
  const box = (on) => 'display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px 12px; box-sizing: border-box; border-radius: 12px; text-align: left; letter-spacing: normal; line-height: 1.35; font-weight: 400; ' + (on ? 'background: var(--chip-2); border: 1.5px solid var(--ink); color: var(--ink); cursor: pointer;' : 'background: transparent; border: 1px solid var(--border); color: var(--ink-3); cursor: pointer;');
  const tick = (on) => 'width: 18px; height: 18px; flex: none; margin-top: 1px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 12px; font-weight: 700; ' + (on ? 'background: var(--inv); color: var(--inv-ink);' : 'border: 1.5px solid var(--border-strong); color: transparent;');
  const runs = (D.researchRuns || []).map((r) => {
    const b = brandById[r.brand_id];
    const inp = r.inputs || {};
    const src = r.sources || {};
    const active = r.status === 'queued' || r.status === 'running';
    const nIdeas = (r.idea_ids || []).length;
    const srcRows = (inp.sources || Object.keys(src)).map((id) => {
      const def = SOURCES.find((x) => x.id === id) || { label: id, viaName: '' };
      const p = src[id] || { state: 'queued' };
      const st = p.state || 'queued';
      return {
        label: def.label, via: def.viaName, state: RS_LABEL[st] || st, stateStyle: rsBlock(st),
        detail: p.error ? p.error : p.count != null ? p.count + (p.count === 1 ? ' finding' : ' findings') : '',
        detailStyle: 'font-size: 13px; line-height: 1.4; color: ' + (st === 'failed' ? 'var(--red-ink)' : 'var(--muted)') + ';'
      };
    });
    return {
      id: r.id, active: active, done: r.status === 'done', brand: b ? b.name : 'Deleted brand', brandName: b ? b.name : '',
      status: RS_LABEL[r.status] || r.status, statusStyle: rsBlock(r.status),
      topics: (inp.topics || []).join(', '), when: relTime(r.created_at),
      summary: (r.finding_count || 0) + (r.finding_count === 1 ? ' finding' : ' findings') + '  ·  ' + nIdeas + (nIdeas === 1 ? ' idea' : ' ideas'),
      sources: srcRows, hasError: !!r.error && r.status !== 'cancelled', error: r.error || '', ideaIds: r.idea_ids || [],
      canRetry: (r.status === 'failed' || r.status === 'cancelled') && !!b,
      retryInput: { brandId: r.brand_id, topics: (inp.topics || []).join(', '), sources: inp.sources || Object.keys(src), count: inp.count || LIMITS.defaultIdeas }
    };
  });
  const showIdeas = (r) => () => set({ rsOpen: false, rsHide: r.id, iView: 'active', iRun: r.ideaIds.length > 1 ? r.id : '', iType: 'all', iFormat: 'all', iPillar: 'all', iBrand: 'all', iq: '', ideaOpen: r.ideaIds.length === 1 ? r.ideaIds[0] : '' });
  const latest = runs[0] || null;
  const panelRun = latest && (latest.active || s.rsHide !== latest.id) && role === 'admin' ? latest : null;
  const runView = (r) => Object.assign({}, r, {
    cancel: () => A.cancelResearch(r.id),
    show: showIdeas(r), canShow: r.done && r.ideaIds.length > 0,
    dismiss: () => set({ rsHide: r.id }), canDismiss: !r.active,
    retry: () => { if (!r.retryInput) return; set({ rsBusy: true, rsErr: '' }); A.startResearch(r.retryInput).then(() => set({ rsBusy: false, rsHide: '' })).catch((err) => set({ rsBusy: false, rsErr: err.message })); }
  });
  const startRs = () => {
    if (!rsBrand) return set({ rsErr: 'Pick a brand.' });
    const picked = SOURCES.filter(srcPicked).map((x) => x.id);
    if (!picked.length) return set({ rsErr: 'Pick at least one connected source.' });
    if (!String(rsTopics || '').trim()) return set({ rsErr: 'Add a niche or a few seed topics.' });
    set({ rsBusy: true, rsErr: '' });
    A.startResearch({ brandId: rsBrand.id, topics: rsTopics, sources: picked, count: rsCount })
      .then(() => set({ rsBusy: false, rsOpen: false, rsHide: '' }))
      .catch((err) => set({ rsBusy: false, rsErr: err.message }));
  };
  const rs = {
    open: !!s.rsOpen && role === 'admin',
    ready: canResearch,
    setupText: !aiOn ? 'Connect Claude, OpenAI or Gemini to draft ideas, plus at least one source (Apify, Browserbase or Firecrawl).'
      : !RESEARCH_PROVIDERS.some((p) => integOn[p]) ? 'Connect at least one source (Apify, Browserbase or Firecrawl) to gather findings.' : 'Add a brand on the Brand page first.',
    setup: () => set({ rsOpen: false, nav: D.brands.length ? 'workspace' : 'brand', wsTab: 'integ' }),
    close: () => set({ rsOpen: false, rsErr: '' }),
    brands: D.brands.filter((b) => role === 'admin' || auth.indexOf(b.name) >= 0).map((b) => {
      const on = !!rsBrand && b.id === rsBrand.id;
      return { label: b.name, pressed: on ? 'true' : 'false', style: pill(on), pick: () => set({ rsBrand: b.id, rsTopics: undefined, rsErr: '' }) };
    }),
    topics: rsTopics,
    onTopics: (e) => set({ rsTopics: e && e.target ? e.target.value : '' }),
    topicsHelp: 'Up to ' + LIMITS.maxTopics + ' topics, separated by commas. Each source searches every topic.',
    sources: SOURCES.map((x) => {
      const ok = srcOn(x), on = srcPicked(x);
      return {
        label: x.label, sub: ok ? x.desc + ' (' + x.viaName + ')' : x.viaName + ' is not connected', disabled: !ok, pressed: on ? 'true' : 'false',
        style: box(on) + (ok ? '' : ' opacity: 0.55; cursor: not-allowed;'), tickStyle: tick(on),
        pick: () => { if (ok) set({ rsSources: Object.assign({}, rsSel, { [x.id]: !on }) }); }
      };
    }),
    counts: [3, 5, 10].map((n) => ({ label: String(n), pressed: rsCount === n ? 'true' : 'false', style: pill(rsCount === n), pick: () => set({ rsCount: n }) })),
    start: startRs, busy: !!s.rsBusy, startLabel: s.rsBusy ? 'Starting…' : 'Run research',
    note: 'Runs are capped at about 5 minutes, ' + LIMITS.perTopic + ' results per topic per source, and $0.50 per Apify run. Ideas are saved as Research drafts for review.',
    err: s.rsErr || '', hasErr: !!s.rsErr,
    hasPanel: !!panelRun, panel: panelRun ? runView(panelRun) : runView({ id: '', active: false, done: false, brand: '', brandName: '', status: '', statusStyle: '', topics: '', when: '', summary: '', sources: [], hasError: false, error: '', ideaIds: [] }),
    recent: runs.slice(0, s.rsAll ? 30 : 6).map(runView), hasRecent: runs.length > 0,
    hasMoreRuns: !s.rsAll && runs.length > 6, showAllRuns: () => set({ rsAll: true })
  };
  // Research strip: the latest run, compact, with the source detail behind View run.
  const sp = rs.panel;
  const srcTotal = sp.sources.length, srcDone = sp.sources.filter((x) => ['Done', 'Failed', 'Skipped', 'Cancelled'].indexOf(x.state) >= 0).length;
  const drafting = sp.active && srcTotal > 0 && srcDone === srcTotal;
  const srcNames = sp.sources.map((x) => x.label);
  const named = srcNames.length > 1 ? srcNames.slice(0, -1).join(', ') + ' and ' + srcNames[srcNames.length - 1] : srcNames.join('');
  rs.strip = {
    title: 'Research run for ' + sp.brand,
    text: sp.active
      ? (drafting ? sp.summary.split('  ·  ')[0] + ' from ' + named + '. Drafting ideas.' : 'Searching ' + named + '. ' + srcDone + ' of ' + srcTotal + ' sources done.')
      : sp.status === 'Done' ? sp.summary + ' from ' + named + '.' : sp.status + (sp.hasError ? ': ' + sp.error : '.'),
    active: sp.active, max: String(srcTotal + 1), now: String(drafting ? srcTotal : srcDone),
    bar: 'width: ' + (srcTotal ? Math.round((drafting ? srcTotal + 0.5 : srcDone) / (srcTotal + 1) * 100) : 0) + '%; height: 100%; border-radius: 999px; background: var(--ink); transition: width 0.3s ease;',
    expanded: !!s.rsExpand, viewLabel: s.rsExpand ? 'Hide run' : 'View run', toggle: () => set({ rsExpand: !s.rsExpand }),
    iconStyle: 'width: 36px; height: 36px; flex: none; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: ' + TONE.coral[0] + '; color: ' + TONE.coral[1] + ';'
  };

  const ideaByTitle = {};
  visible.forEach((i) => { ideaByTitle[i.title] = i.id; });
  const t = s.iToast;
  const ids = {
    rs: rs, dds: dds, hotkey: hotkey,
    q: s.iq || '', onSearch: (e) => set({ iq: val(e) }), clearSearch: () => set({ iq: '' }),
    views: views, saved: saved, hasSaved: saved.length > 0,
    saveOpen: !!s.iSaveOpen, toggleSave: () => set({ iSaveOpen: !s.iSaveOpen, iSaveName: '' }), saveName: s.iSaveName || '',
    onSaveName: (e) => set({ iSaveName: val(e) }), saveView: saveView,
    onSaveKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); saveView(); } else if (e.key === 'Escape') set({ iSaveOpen: false }); },
    showBrandFilter: auth.length > 1, layouts: layouts,
    isGallery: layout === 'gallery' && shown.length > 0, isList: layout === 'list' && shown.length > 0, isBoard: layout === 'board' && visible.length > 0,
    isEmpty: layout !== 'board' && shown.length === 0 && visible.length > 0,
    noIdeas: visible.length === 0,
    summary: nShown + (nShown === 1 ? ' idea' : ' ideas') + (runRow ? ' from one research run (' + relTime(runRow.created_at) + ').' : layout === 'board' ? ' on the board. Drag a card between columns, or use its arrow button, to change its status.' : ' in ' + cur[1] + '.'),
    reset: () => set({ iq: '', iView: 'active', iRun: '', iBrand: 'all', iType: 'all', iFormat: 'all', iPillar: 'all' }),
    hasRun: !!runRow, clearRun: () => set({ iRun: '' }),
    cards: cards, cols: cols,
    dragEnd: () => set({ iDrag: '', iOver: '' }),
    archOver: (e) => { e.preventDefault(); if (s.iOver !== 'Archived') set({ iOver: 'Archived' }); },
    archDrop: (e) => { e.preventDefault(); const id = dropId(e); if (id) move(id, 'Archived'); },
    archStyle: 'display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 64px; padding: 0 16px; box-sizing: border-box; border-radius: 16px; font-size: 14px; font-weight: 500; text-align: center; transition: background 0.12s ease; ' + (archOn ? 'background: var(--red-soft); border: 2px dashed var(--red-ink); color: var(--red-ink);' : 'background: transparent; border: 2px dashed var(--border-2); color: var(--muted);'),
    hasToast: !!t, toast: t ? t.text : '', undo: undo,
    emptyText: !auth.length ? (role === 'admin' ? 'Every idea belongs to a brand. Add a brand on the Brand page, then come back to add ideas.' : 'No brands yet. Ideas show up once a brand is set up.') : 'No ideas for your brands yet.',
    canCreate: canCreate, addDraft: () => openNew(),
    hasSel: !!detail && !s.ideaModal, sel: detail || {}, hasEdit: !!edit && !s.ideaModal, edit: edit || {},
    closeIdea: () => set({ ideaOpen: '', ideaEdit: null, ideaConfirm: '', ddOpen: '' }),
    textarea: 'width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-family: inherit; font-size: 14px; line-height: 1.5; color: var(--ink); resize: vertical;',
    modal: !!s.ideaModal, ni: newIdea,
    legend: 'padding: 0; margin: 0 0 12px; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted);'
  };
  return {
    ids: ids, visible: visible, ideaByTitle: ideaByTitle, canCreate: canCreate,
    openNew: () => openNew(),
    canResearch: role === 'admin', openResearch: () => set({ rsOpen: true, rsErr: '', ideaOpen: '', ideaModal: false })
  };
}
