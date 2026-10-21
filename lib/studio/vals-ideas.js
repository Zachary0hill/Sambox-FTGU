// Ideas & Research. Ported from the design's ideasVals(); data comes from the ideas tables.
import { relTime } from './model';

export function ideasVals(c) {
  const s = c.s, set = c.set, dark = c.dark, TONE = c.TONE, DARKFILL = c.DARKFILL, actColor = c.actColor;
  const auth = c.authBrands, role = s.role, brandTile = c.brandTile, D = c.D, A = c.A, me = c.me;
  const solid = (tn) => dark ? DARKFILL[tn] : [TONE[tn][3], '#FFFFFF'];
  const hardBlock = (f, h) => 'display: inline-flex; align-items: center; flex: none; height: ' + (h || 26) + 'px; padding: 0 10px; border-radius: 0; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + (f ? f[0] : 'var(--chip)') + '; color: ' + (f ? f[1] : 'var(--ink-3)') + ';';
  const TYPE_T = { 'Idea': 'blue', 'Script': 'amber', 'Research': 'coral' };
  const STAT_T = { 'Draft': null, 'In Review': 'violet', 'Approved': 'green', 'Archived': null };
  const typeBlock = (t, h) => hardBlock(solid(TYPE_T[t] || 'gray'), h || 24);
  const statusBlock = (st, h) => st === 'Archived' ? hardBlock(['var(--chip)', 'var(--muted)'], h || 24) : hardBlock(STAT_T[st] ? solid(STAT_T[st]) : null, h || 24);
  const who = (id, label) => (id && id === me.id ? 'You' : label);

  const all = D.ideas.map((i) => Object.assign({}, i, {
    hook: i.hook || i.title.split(' ').slice(0, 3).join(' '),
    comments: i.comments.map((cm) => ({ who: who(cm.whoId, cm.who), time: relTime(cm.at), text: cm.text })),
    hist: i.hist.map((h) => ({ who: who(h.whoId, h.who), text: h.text, time: relTime(h.at), at: h.at }))
  }));
  const visible = all.filter((i) => auth.indexOf(i.brand) >= 0);
  const canEditI = (i) => role === 'admin' || (role === 'sponsor' && auth.indexOf(i.brand) >= 0) || (role === 'designer' && i.byId === me.id);
  const canCreate = role !== 'editor' && auth.length > 0;
  const commit = (i, p, text) => {
    set({ ideaEdit: null, ideaConfirm: '' });
    A.updateIdea(i, p, text);
  };
  const BCOL = {};
  D.brands.forEach((b) => { BCOL[b.name] = b.color; });
  const lumH = (h) => { const x = h.replace('#', ''); const v = [0, 2, 4].map((k) => parseInt(x.substr(k, 2), 16) / 255).map((u) => u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const q = (s.iq || '').trim().toLowerCase();
  const fType = s.iType || 'all', fBrand = auth.indexOf(s.iBrand) >= 0 ? s.iBrand : 'all', fStat = s.iStatus || 'active', fTag = s.iTag || '';
  const statOk = (i, st) => st === 'all' ? true : st === 'active' ? i.status !== 'Archived' : i.status === st;
  const base = visible.filter((i) => (fType === 'all' || i.type === fType) && (fBrand === 'all' || i.brand === fBrand) &&
    (!q || (i.title + ' ' + i.body.join(' ') + ' ' + i.tags.join(' ') + ' ' + i.brand).toLowerCase().includes(q)));
  const shown = base.filter((i) => statOk(i, fStat) && (!fTag || i.tags.indexOf(fTag) >= 0));
  const sel = visible.find((i) => i.id === s.ideaOpen) || null;
  const DOT = { 'Draft': 'var(--border-strong)', 'In Review': solid('violet')[0], 'Approved': solid('green')[0], 'Archived': 'var(--faint)' };
  const thumbOf = (i, modal) => {
    const bg = BCOL[i.brand] || '#5F5F5F';
    const ink = lumH(bg) > 0.4 ? '#111111' : '#FFFFFF';
    const words = String(i.hook).split(' ');
    const arch = i.status === 'Archived';
    return {
      style: 'position: relative; display: flex; align-items: flex-end; box-sizing: border-box; overflow: hidden; background: ' + bg + '; color: ' + ink + ';' + (modal ? ' height: 240px; padding: 24px 28px;' : ' aspect-ratio: 16 / 9; padding: 18px; border-radius: 16px;') + (arch ? ' filter: grayscale(1); opacity: 0.7;' : ''),
      hookStyle: 'max-width: 74%; font-family: var(--font-title); font-weight: 900; font-size: ' + (modal ? 46 : 30) + 'px; line-height: 1.04; letter-spacing: -0.03em; text-transform: uppercase;',
      hookHi: words[0], hookRest: words.slice(1).join(' '),
      hookHiStyle: 'padding: 0 6px; background: #FFE14D; color: #111111; -webkit-box-decoration-break: clone; box-decoration-break: clone;'
    };
  };
  const ini = (b) => b.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const cards = shown.map((i) => {
    const th = thumbOf(i, false);
    const arch = i.status === 'Archived';
    return {
      title: i.title, brand: i.brand, status: i.status, tags: i.tags.slice(0, 3),
      aria: 'Open idea: ' + i.title + ', ' + i.status,
      open: () => set({ ideaOpen: i.id, ideaEdit: null, ideaConfirm: '', ideaDraft: '', ddOpen: '' }),
      thumbStyle: th.style, hookStyle: th.hookStyle, hookHi: th.hookHi, hookRest: th.hookRest, hookHiStyle: th.hookHiStyle,
      badge: i.type + '  ·  ' + i.comments.length + (i.comments.length === 1 ? ' comment' : ' comments'),
      badgeStyle: 'position: absolute; right: 12px; bottom: 12px; display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 8px; background: rgba(17,17,17,0.76); color: #FFFFFF; font-family: var(--font-main); font-size: 12px; font-weight: 600; white-space: nowrap;',
      initials: ini(i.brand),
      avatarStyle: 'width: 40px; height: 40px; flex: none; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-2); font-size: 13px; font-weight: 700;',
      titleStyle: 'font-size: 16px; font-weight: 600; line-height: 1.35; color: ' + (arch ? 'var(--muted)' : 'var(--ink)') + '; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;',
      dot: 'width: 8px; height: 8px; flex: none; border-radius: 999px; background: ' + DOT[i.status] + ';'
    };
  });
  const pill = (on) => 'display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; box-sizing: border-box; border-radius: 999px; cursor: pointer; white-space: nowrap; font-size: 14px; font-weight: 500; letter-spacing: normal; ' + (on ? 'background: var(--chip-2); border: 1.5px solid var(--ink); color: var(--ink);' : 'background: transparent; border: 1px solid var(--border); color: var(--ink-3);');
  const statusChips = [['active', 'All'], ['Draft', 'Draft'], ['In Review', 'In Review'], ['Approved', 'Approved'], ['Archived', 'Archived']].map((x) => {
    const on = fStat === x[0];
    return { label: x[1], count: String(base.filter((i) => statOk(i, x[0])).length), pressed: on ? 'true' : 'false', pick: () => set({ iStatus: x[0] }), style: pill(on),
      dot: 'width: 8px; height: 8px; flex: none; border-radius: 999px; background: ' + (x[0] === 'active' ? 'var(--ink)' : DOT[x[0]]) + ';',
      countStyle: 'font-size: 12px; font-weight: 600; color: var(--muted-2); font-variant-numeric: tabular-nums;' };
  });
  const tagN = {};
  base.filter((i) => statOk(i, fStat)).forEach((i) => i.tags.forEach((g) => { tagN[g] = (tagN[g] || 0) + 1; }));
  let tagSet = Object.keys(tagN).sort((a, b) => (tagN[b] - tagN[a]) || a.localeCompare(b)).slice(0, 10);
  if (fTag && tagSet.indexOf(fTag) < 0) tagSet = [fTag].concat(tagSet.slice(0, 9));
  const tagChips = tagSet.map((g) => ({ label: g, pressed: fTag === g ? 'true' : 'false', pick: () => set({ iTag: fTag === g ? '' : g }), style: pill(fTag === g) }));
  const opt = (list, cur) => list.map((o) => ({ value: o[0], label: o[1], on: o[0] === cur }));
  let selObj = { bannerStyle: '', hookStyle: '', hookHi: '', hookRest: '', hookHiStyle: '', tags: [], editTags: '', onEditTags: () => {}, brand: '', brandInitials: '', brandTile: '', type: '', typeStyle: '', status: '', statusStyle: '', title: '', byline: '', paras: [], refs: [], hasRefs: false, isView: true, isEdit: false, canStatus: false, statusOpts: [], onStatus: () => {}, actions: [], hasNote: false, note: '', editTitle: '', editBody: '', typeOpts: [], onEditTitle: () => {}, onEditType: () => {}, onEditBody: () => {}, cancelEdit: () => {}, saveEdit: () => {}, comments: [], noComments: true, canComment: false, draft: '', onDraft: () => {}, post: () => {}, history: [] };
  if (sel) {
    const i = sel;
    const ce = canEditI(i);
    const arch = i.status === 'Archived';
    const ed = s.ideaEdit && s.ideaEdit.id === i.id ? s.ideaEdit : null;
    const btnG = 'min-height: 40px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--ink); font-size: 14px; cursor: pointer;';
    const btnD = 'min-height: 40px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--red-ink); font-size: 14px; cursor: pointer;';
    const acts = [];
    if (ce && !arch) acts.push({ label: 'Edit', style: btnG, pick: () => set({ ideaEdit: { id: i.id, title: i.title, type: i.type, body: i.body.join('\n\n'), tags: i.tags.join(' ') } }) });
    if (ce && !arch) acts.push({ label: 'Archive', style: btnG, pick: () => commit(i, { status: 'Archived', prev: i.status }, 'archived the idea') });
    if (ce && arch) acts.push({ label: 'Restore', style: btnG, pick: () => commit(i, { status: i.prev || 'Draft', prev: '' }, 'restored the idea') });
    if (role === 'admin' && arch) {
      const confirm = s.ideaConfirm === i.id;
      acts.push({ label: confirm ? 'Confirm permanent delete' : 'Delete permanently', style: confirm ? btnD + ' background: var(--red-soft); border-color: transparent; font-weight: 600;' : btnD,
        pick: () => { if (confirm) { set({ ideaConfirm: '', ideaOpen: '' }); A.deleteIdea(i); } else set({ ideaConfirm: i.id }); } });
    }
    const note = !ce ? (role === 'designer' ? 'You can comment here. Only the creator or a Super Admin can edit this idea.' : 'You can comment here. Editing is limited for this idea.') : arch ? 'Archived ideas are hidden from the default list. Restore to edit again.' : '';
    const th2 = thumbOf(i, true);
    selObj = {
      bannerStyle: th2.style, hookStyle: th2.hookStyle, hookHi: th2.hookHi, hookRest: th2.hookRest, hookHiStyle: th2.hookHiStyle,
      tags: i.tags, editTags: ed ? ed.tags : '',
      onEditTags: (e) => set({ ideaEdit: Object.assign({}, ed, { tags: e && e.target ? e.target.value : '' }) }),
      brand: i.brand, brandInitials: ini(i.brand), brandTile: brandTile(28),
      type: i.type, typeStyle: typeBlock(i.type, 24), status: i.status, statusStyle: statusBlock(i.status, 24),
      title: i.title, byline: 'Created by ' + (i.byId === me.id && role !== 'admin' ? 'you' : i.by) + ' on ' + i.date + (i.comments.length ? '  ·  ' + i.comments.length + ' comments' : ''),
      paras: i.body, refs: i.refs || [], hasRefs: (i.refs || []).length > 0,
      isView: !ed, isEdit: !!ed,
      canStatus: ce && !arch,
      statusOpts: opt([['Draft', 'Draft'], ['In Review', 'In Review'], ['Approved', 'Approved']], i.status),
      onStatus: (e) => { const v = e && e.target ? e.target.value : i.status; if (v !== i.status) commit(i, { status: v }, 'moved Status to ' + v); },
      actions: acts, hasNote: !!note, note: note,
      editTitle: ed ? ed.title : '', editBody: ed ? ed.body : '',
      typeOpts: opt([['Idea', 'Idea'], ['Script', 'Script'], ['Research', 'Research']], ed ? ed.type : i.type),
      onEditTitle: (e) => set({ ideaEdit: Object.assign({}, ed, { title: e && e.target ? e.target.value : '' }) }),
      onEditType: (e) => set({ ideaEdit: Object.assign({}, ed, { type: e && e.target ? e.target.value : i.type }) }),
      onEditBody: (e) => set({ ideaEdit: Object.assign({}, ed, { body: e && e.target ? e.target.value : '' }) }),
      cancelEdit: () => set({ ideaEdit: null }),
      saveEdit: () => { if (!ed) return; const title = (ed.title || '').trim() || i.title; commit(i, { title: title, type: ed.type, tags: String(ed.tags || '').split(/[\s,]+/).filter(Boolean).map((g) => g.charAt(0) === '#' ? g.toLowerCase() : '#' + g.toLowerCase()), body: String(ed.body || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean) }, 'edited the idea'); },
      comments: i.comments.map((cm) => ({ who: cm.who, time: cm.time, text: cm.text, initials: cm.who.slice(0, 1), avatarStyle: 'width: 28px; height: 28px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #FFFFFF; background: ' + actColor(cm.who) + ';' })),
      noComments: i.comments.length === 0,
      canComment: !arch,
      draft: s.ideaDraft || '',
      onDraft: (e) => set({ ideaDraft: e && e.target ? e.target.value : '' }),
      post: () => {
        const t = (s.ideaDraft || '').trim();
        if (!t) return;
        set({ ideaDraft: '' });
        A.commentIdea(i, t);
      },
      history: i.hist.map((h) => ({ who: h.who, text: h.text, time: h.time }))
    };
  }
  const niBrand = auth.indexOf(s.niBrand) >= 0 ? s.niBrand : auth[0];
  const niType = s.niType || 'Idea';
  const create = () => {
    const title = (s.niTitle || '').trim();
    if (!title) return set({ niErr: 'Give the idea a title.' });
    if (auth.indexOf(niBrand) < 0) return set({ niErr: 'You cannot add ideas for that brand.' });
    const brand = D.brands.find((b) => b.name === niBrand);
    const body = String(s.niBody || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    A.createIdea({ title: title, brandId: brand.id, type: niType, body: body.length ? body : ['No content yet.'] }).then((id) => {
      if (id) set({ ideaModal: false, ideaOpen: id, iStatus: 'active', iType: 'all', iBrand: 'all', iq: '', niTitle: '', niBody: '', niErr: '' });
    }).catch((err) => set({ niErr: err.message }));
  };
  const ids = {
    onSearch: (e) => set({ iq: e && e.target ? e.target.value : '' }),
    statusChips: statusChips, tagChips: tagChips, cards: cards,
    typeOpts2: opt([['all', 'All types'], ['Idea', 'Ideas'], ['Script', 'Scripts'], ['Research', 'Research']], fType),
    onType: (e) => set({ iType: e && e.target ? e.target.value : 'all' }),
    closeIdea: () => set({ ideaOpen: '', ideaEdit: null, ideaConfirm: '', ddOpen: '' }),
    showBrandFilter: auth.length > 1,
    brandOpts: [['all', 'All brands']].concat(auth.map((b) => [b, b])).map((o) => ({ value: o[0], label: o[1], on: o[0] === fBrand })),
    onBrand: (e) => set({ iBrand: e && e.target ? e.target.value : 'all' }),
    empty: cards.length === 0,
    emptyText: visible.length ? 'No ideas match these filters.' : 'No ideas for your brands yet.',
    hasSel: !!sel && !s.ideaModal, sel: selObj,
    textarea: 'width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-family: inherit; font-size: 14px; line-height: 1.5; color: var(--ink); resize: vertical;',
    modal: !!s.ideaModal,
    closeNew: () => set({ ideaModal: false, niErr: '' }),
    onNewTitle: (e) => set({ niTitle: e && e.target ? e.target.value : '' }),
    onNewBody: (e) => set({ niBody: e && e.target ? e.target.value : '' }),
    onNewBrand: (e) => set({ niBrand: e && e.target ? e.target.value : niBrand }),
    onNewType: (e) => set({ niType: e && e.target ? e.target.value : 'Idea' }),
    newBrandOpts: auth.map((b) => ({ value: b, label: b, on: b === niBrand })),
    newTypeOpts: opt([['Idea', 'Idea'], ['Script', 'Script'], ['Research', 'Research']], niType),
    create: create, err: s.niErr || '', hasErr: !!s.niErr
  };
  const ideaByTitle = {};
  visible.forEach((i) => { ideaByTitle[i.title] = i.id; });
  return {
    ids: ids, visible: visible, ideaByTitle: ideaByTitle, canCreate: canCreate,
    openNew: () => set({ ideaModal: true, niTitle: '', niBody: '', niErr: '', niBrand: '', niType: 'Idea' })
  };
}
