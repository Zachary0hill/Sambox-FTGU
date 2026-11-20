import { importBrief } from '../ideas/import-brief';
// Ideas & Research. Ported from docs/design/ideas-research (Main, NewIdea, IdeaDetail, IdeaEdit); data comes from the ideas tables.
import { relTime, MONTH_NAMES, MONTHS } from './model';
import { SOURCES, LIMITS, RESEARCH_PROVIDERS, defaultTopics } from '../research/catalog';
import { previewOf } from './previews';
import { scriptBeats, hasSavedScript, cleanBeat, readTime } from './script';
import { COVER_HIGHLIGHTS as HIGHLIGHTS, CONVERT_TARGETS, normalizeIdeasRules } from '../ideas/rules-shared';
import { gateChecklist, stageBlocker } from '../ideas/gates';
import { isActiveRun, overrideScore, recommendationFor } from '../ideas/research-shared';
import { ideaSearch } from '../ideas/search';
import { markUnsavedEdit } from './idea-cover';

const COVER_STYLES = [['photo', 'Photo'], ['bold', 'Bold graphic'], ['illustration', 'Illustration'], ['minimal', 'Minimal']];

const SOURCE_LOGO = { youtube: 'youtube', youtube_browser: 'youtube', vidiq: 'youtube', tiktok: 'tiktok' };
const EFFORTS = ['Small', 'Medium', 'Large'];
const ORDER = ['Inbox', 'Research', 'Ready', 'Approved'];
const ICE_DEF = [['Impact', 'How much it moves views, leads or sales'], ['Confidence', 'How sure you are it lands, backed by data'], ['Ease', 'How cheap it is to shoot and edit']];
const DAY = 86400000;
let toastTimer = null;
// Ideas being saved from the editor, so a double click or a held Cmd+S never sends the same save twice.
const savingIdeas = new Set();
// Esc on an inline field in the idea dialog drops the draft: the blur it causes must not save.
let inlineCancel = false;

const val = (e) => (e && e.target ? e.target.value : '');
// On the 0 to 100 scale. A research score, when present, replaces the manual ICE average.
const iceTotal = (ice) => (ice && ice.every((n) => n != null) ? Math.round(((ice[0] + ice[1] + ice[2]) / 3) * 10) : null);
const scoreOf = (i) => (i.research && i.research.score ? i.research.score.total : iceTotal(i.ice));
const fmtScore = (n) => (n == null ? '–' : String(Math.round(n)));
const splitHook = (h) => { const w = String(h || '').trim().split(/\s+/); return [w[0] || '', w.slice(1).join(' ')]; };
// The banner shows the typed hook, or the whole title when there is none.
const hookOf = (i) => (i.hook || String(i.title || '').trim());
const tagList = (txt) => String(txt || '').split(/[\s,]+/).filter(Boolean).map((g) => (g.charAt(0) === '#' ? g : '#' + g).toLowerCase());
const paras = (txt) => String(txt || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const windowLabel = (iso, short) => { if (!iso) return ''; const [y, m] = String(iso).split('-').map(Number); return (short ? MONTHS : MONTH_NAMES)[m - 1] + ' ' + y; };
const isUrl = (r) => /^https?:\/\//i.test(String(r || '').trim());
const hostOf = (r) => { try { return new URL(r).hostname.replace(/^www\./, ''); } catch { return ''; } };

const LENGTHS = [['short', 'Short', 'Under 90s'], ['standard', 'Standard', '5 to 8 min'], ['long', 'Long', '10 to 15 min']];

export function ideasVals(c) {
  const s = c.s, set = c.set, dark = c.dark, TONE = c.TONE, DARKFILL = c.DARKFILL, actColor = c.actColor;
  const auth = c.authBrands, role = s.role, brandTile = c.brandTile, D = c.D, A = c.A, me = c.me;
  const rules = D.ideaRules || normalizeIdeasRules(null);
  const TYPES = rules.allowed_types, FORMATS = rules.formats, PLATFORMS = rules.platforms, PILLARS = rules.pillars;
  const pursueAt = rules.recommendation.pursue, parkAt = rules.recommendation.park;
  const canResearchIdea = (i) => i.status !== 'Archived' && (role === 'admin' || (role === 'manager' && me.perms.has('ideas:edit')) || (role === 'designer' && rules.designers_can_research && i.byId === me.id));
  // A value removed from Rules stays selectable on the ideas that already use it.
  const withCurrent = (list, cur) => (!cur || list.indexOf(cur) >= 0 ? list : list.concat([cur]));
  const solid = (tn) => dark ? DARKFILL[tn] : [TONE[tn][3], '#FFFFFF'];
  const hardBlock = (f, h) => 'display: inline-flex; align-items: center; flex: none; height: ' + (h || 26) + 'px; padding: 0 10px; border-radius: 0; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + (f ? f[0] : 'var(--chip)') + '; color: ' + (f ? f[1] : 'var(--ink-3)') + ';';
  const TYPE_T = { 'Idea': 'blue', 'Script': 'amber', 'Research': 'coral' };
  const STAT_T = { 'Inbox': null, 'Research': 'violet', 'Ready': 'amber', 'Approved': 'green', 'Archived': null };
  const typeBlock = (t, h) => hardBlock(solid(TYPE_T[t] || 'gray'), h || 24);
  const statusBlock = (st, h) => st === 'Archived' ? hardBlock(['var(--chip)', 'var(--muted)'], h || 24) : hardBlock(STAT_T[st] ? solid(STAT_T[st]) : null, h || 24);
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
  const canEditI = (i) => role === 'admin' || (role === 'manager' && me.perms.has('ideas:edit')) || (role === 'sponsor' && auth.indexOf(i.brand) >= 0) || (role === 'designer' && i.byId === me.id);
  // Covers are generated by OpenAI or Gemini; Claude only writes text.
  const imgAiOn = (D.integrations || []).some((g) => (g.provider === 'openai' || g.provider === 'gemini') && g.status === 'connected');
  // Scripts are written by any connected text model (the same ones the assistant and research use).
  const textAiOn = (D.integrations || []).some((g) => ['anthropic', 'openai', 'gemini', 'xai'].indexOf(g.provider) >= 0 && g.status === 'connected');
  const canCreate = role !== 'editor' && auth.length > 0 && (role !== 'manager' || me.perms.has('ideas:create'));
  const BCOL = {};
  D.brands.forEach((b) => { BCOL[b.name] = b.color; });
  const brandOf = (name) => D.brands.find((b) => b.name === name) || null;
  const lumH = (h) => { const x = String(h || '#5F5F5F').replace('#', ''); const v = [0, 2, 4].map((k) => parseInt(x.substr(k, 2), 16) / 255).map((u) => u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ini = (b) => String(b || '').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  // Research findings carried on an idea: the best number it was drafted from, for the card and the References tab.
  const kFmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n);
  const findingStat = (f) => f.views != null ? kFmt(f.views) + ' views' : f.upvotes != null ? kFmt(f.upvotes) + ' upvotes' : f.likes != null ? kFmt(f.likes) + ' likes' : f.comments != null ? kFmt(f.comments) + ' comments' : '';
  const topStat = (i) => {
    const fs = (i.findings || []).filter((f) => f && findingStat(f));
    if (!fs.length) return '';
    const best = fs.slice().sort((a, b) => (b.views || b.upvotes || b.likes || 0) - (a.views || a.upvotes || a.likes || 0))[0];
    const src = SOURCES.find((x) => x.id === best.source);
    return findingStat(best) + (src ? ' on ' + src.label : '') + (fs.length > 1 ? '  ·  ' + fs.length + ' sources' : '');
  };
  const DOT = { 'Inbox': 'var(--border-strong)', 'Research': solid('violet')[0], 'Ready': solid('amber')[0], 'Approved': solid('green')[0], 'Archived': 'var(--faint)' };
  const dotS = (c2, size) => 'width: ' + (size || 8) + 'px; height: ' + (size || 8) + 'px; flex: none; border-radius: 999px; background: ' + c2 + ';';
  const scoreTone = (n) => n == null ? ['var(--chip)', 'var(--muted)'] : n >= pursueAt ? [TONE.green[0], TONE.green[1]] : n >= parkAt ? [TONE.amber[0], TONE.amber[1]] : ['var(--chip)', 'var(--ink-3)'];
  const scoreTag = (n) => n == null ? 'Not scored' : n >= pursueAt ? 'Strong' : n >= parkAt ? 'Promising' : 'Needs work';
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
  // Every banner is a 3:1 strip: card (gallery), board, mini (list), detail, edit and preview (New idea). The image is
  // not cropped on disk; the focal point picks which band of it shows, so the editor matches every card exactly.
  const banner = (b, size) => {
    // No cover yet: the strongest thumbnail from the idea's research stands in.
    const evidence = !b.coverPath && !b.coverUrl ? (b.findings || []).filter((f) => f && f.thumb).sort((x, y) => (y.views || y.upvotes || y.likes || 0) - (x.views || x.upvotes || x.likes || 0))[0] : null;
    const clean = (u) => String(u || '').replace(/["\\)]/g, '');
    const own = b.coverMode !== 'hook' && !!b.coverUrl;
    const pic = own ? clean(b.coverUrl) : evidence ? clean(evidence.thumb) : '';
    const small = own && b.coverThumb ? clean(b.coverThumb) : '';
    const img = !!pic;
    const bg = BCOL[b.brand] || '#5F5F5F';
    const ink = img ? '#FFFFFF' : lumH(bg) > 0.4 ? '#111111' : '#FFFFFF';
    const focal = b.focal || [50, 50];
    const showHook = size !== 'mini' && (b.coverMode !== 'image' || !img);
    // Text over a photo gets a black gradient behind it, rising from the edge the hook sits on.
    const scrim = !img || !showHook ? ''
      : b.hookPos === 'top' ? 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 75%), '
      : b.hookPos === 'center' ? 'linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), '
      : 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 75%), ';
    // Small banners load the resized copy; the editor paints the full file over it, so it is sharp once it lands.
    const at = ' ' + focal[0] + '% ' + focal[1] + '% / cover no-repeat';
    const layers = size === 'edit' && small && small !== pic ? 'url("' + pic + '")' + at + ', #222222 url("' + small + '")' + at : '#222222 url("' + (small || pic) + '")' + at;
    const fill = img ? 'background: ' + scrim + layers + ';' : 'background: ' + bg + ';';
    const pos = b.hookPos === 'center' ? 'align-items: center; justify-content: center; text-align: center;' : b.hookPos === 'top' ? 'align-items: flex-start;' : 'align-items: flex-end;';
    const arch = b.status === 'Archived' ? ' filter: grayscale(1); opacity: 0.7;' : '';
    const top = b.hookPos === 'top';
    const box = {
      // The gallery and preview badges sit in the top row, so a bottom hook gets the full width; a top hook clears them.
      card: 'aspect-ratio: 3 / 1; padding: ' + (top ? '46px 16px 12px' : '12px 16px 14px') + '; border-radius: 16px;',
      preview: 'aspect-ratio: 3 / 1; padding: ' + (top ? '46px 16px 12px' : '12px 16px 14px') + '; border-radius: 16px;',
      board: 'aspect-ratio: 3 / 1; padding: 10px 12px;',
      mini: 'width: 72px; height: 24px; flex: none; border-radius: 6px;',
      detail: 'width: 216px; height: 72px; flex: none; border-radius: 12px; padding: 8px 10px;' + (top ? ' padding-right: 44px;' : ''),
      // The hint and the close button sit along the top edge.
      edit: 'aspect-ratio: 3 / 1; padding: ' + (top ? 'clamp(56px, 7vw, 76px)' : 'clamp(14px, 2.6vw, 28px)') + ' clamp(16px, 3vw, 32px) clamp(14px, 2.6vw, 28px);'
    }[size];
    const text = String(b.hook || 'Your hook').trim();
    // Short hooks stay big; a full title steps the size down so it fits, and the line clamp is the backstop.
    const k = text.length <= 16 ? 1 : text.length <= 28 ? 0.86 : text.length <= 44 ? 0.74 : 0.62;
    const base = { card: '22px', preview: '21px', board: '14px', detail: '13px', edit: 'clamp(18px, 4.6vw, 52px)' }[size] || '0';
    const fs = k === 1 ? base : 'calc(' + base + ' * ' + k + ')';
    const lines = { card: 3, preview: 3, board: 2, detail: 2, edit: 3 }[size] || 2;
    const hk = splitHook(text);
    const hl = b.highlight || '#FFE14D';
    return {
      style: 'position: relative; display: flex; box-sizing: border-box; overflow: hidden; color: ' + ink + '; ' + fill + ' ' + pos + ' ' + box + arch,
      showHook: showHook,
      hookStyle: 'position: relative; max-width: ' + (size === 'board' ? '86%' : size === 'detail' ? '100%' : size === 'edit' ? '76%' : '92%') + '; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ' + lines + '; overflow: hidden; text-wrap: balance; font-family: var(--font-title); font-weight: 900; font-size: ' + fs + '; line-height: 1.08; letter-spacing: -0.03em; text-transform: uppercase; pointer-events: none;' + (img ? ' text-shadow: 0 2px 12px rgba(0,0,0,0.35);' : ''),
      hiStyle: hl === 'none' ? '' : 'padding: 0 ' + (size === 'board' || size === 'detail' ? 4 : 6) + 'px; background: ' + hl + '; color: #111111; text-shadow: none; -webkit-box-decoration-break: clone; box-decoration-break: clone;',
      hookHi: hk[0], hookRest: hk[1], isImg: img
    };
  };

  // ---------- Main page: status, saved views, filters, sort, layout (handoff/ideas-research-handoff-2026-11-19) ----------
  // Status tabs pick one stage; a saved view is a filter preset; the Filters popover edits the live filter set.
  const search = ideaSearch(s.iq || '');
  const clearedSearch = { iq: '', iSearchSort: null, iPage: {} };
  const changeSearch = (e) => {
    const iq = val(e);
    set({ iq, iPage: {}, iSearchSort: s.iSearchSort && ideaSearch(iq) ? s.iSearchSort : null });
  };
  const fBrand = auth.indexOf(s.iBrand) >= 0 ? s.iBrand : 'all';
  // The recommendation for any scored idea, research or ICE (Pursue at or above pursue, Park at or above park).
  const recOf = (i) => (i.score != null ? recommendationFor(i.score, rules.recommendation) : '');
  const REC_NAME = { pursue: 'Pursue', park: 'Park', drop: 'Drop' };
  const sourcesOf = (i) => (i.research ? i.research.sources.length : (i.findings || []).length || i.refs.length);
  const prefs = me.prefs || {};
  const layout = ['gallery', 'board', 'list'].indexOf(s.iLayout || prefs.ideaLayout) >= 0 ? s.iLayout || prefs.ideaLayout : 'board';
  const savedViews = s.iViews !== undefined ? s.iViews : (Array.isArray(prefs.ideaViews) ? prefs.ideaViews : []);
  const live = (i) => i.status !== 'Archived';
  // An approved idea that became something is the record of it, so it no longer moves.
  const locked = (i) => i.status === 'Approved' && (!!i.projectId || (i.converted || []).length > 0);
  const canApproveI = (i) => canEditI(i) && (role !== 'manager' || me.perms.has('ideas:approve'));
  const canAddContent = role === 'admin' || me.perms.has('projects:edit');
  const convertOptions = (i) => CONVERT_TARGETS.filter((t) => rules.conversion_targets.includes(t.key) && (t.key !== 'project' || (!i.projectId && (role !== 'manager' || me.perms.has('projects:create')))) && (t.key !== 'social' || canAddContent));
  const runConvert = async (i, kind) => {
    if (s.ideaApproving) return;
    set({ ideaApproving: true, ideaConvert: '' });
    try {
      if (kind === 'project') {
        const { project, warning } = await A.approveIdea(i);
        // Close the originating detail so its focus trap releases the confirmation button.
        set((current) => current.ideaOpen === i.id && !current.ideaEdit ? { ideaOpen: '', ideaGate: null, iDlgMenu: '' } : {});
        const open = project.canOpen ? { label: 'Open project', run: () => set({ ideaOpen: '', nav: 'projects', openJob: project.job, dTab: 'overview', menu: '' }) } : undefined;
        if (warning) return A.toast(warning, { label: 'Retry asset transfer', run: () => runConvert(i, 'project') });
        A.toast(project.created === false
          ? (project.package?.coverPath ? 'The idea’s cover is in Project Files.' : '“' + i.title + '” is linked to its project.')
          : '“' + i.title + '” was approved and added to In Production on the Projects page.', open);
      } else await A.convertIdea(i, kind);
    } catch (e) { A.toast(e.message); }
    finally { set({ ideaApproving: false }); }
  };
  const startConvert = (i) => {
    const options = convertOptions(i);
    if (options.length === 1) return runConvert(i, options[0].key);
    if (!options.length) return A.toast('No approval targets are available. Check Rules and project creation permissions.');
    set({ ideaConvert: i.id });
  };
  const approveToProduction = (i) => (convertOptions(i).some((t) => t.key === 'project') ? runConvert(i, 'project') : startConvert(i));

  // Idea origin (who first proposed it), research run state and score band, as the cards and the filters name them.
  // Origin never changes when research later runs on a manual idea.
  const originOf = (i) => (i.source === 'research' || i.source === 'chat' ? 'ai' : 'manual');
  const RUN_KEY = { queued: 'queued', running: 'running', done: 'complete', failed: 'failed' };
  const runOf = (i) => (i.run && RUN_KEY[i.run.state]) || 'none';
  // Score bands follow the Rules thresholds (Pursue and Park), so the board, filters and Top scored agree with Rules.
  const bandOf = (n) => (n == null ? 'none' : n >= pursueAt ? 'high' : n >= parkAt ? 'mid' : 'low');
  const isStale = (i) => live(i) && !locked(i) && i.days >= 14;
  const FLAG_TEST = { nocover: (i) => !i.coverPath, comments: (i) => i.comments.length > 0, stale: isStale };
  const GROUP_VAL = { origin: originOf, run: runOf, owner: (i) => i.ownerId, score: (i) => bandOf(i.score) };
  const EMPTY_F = { origin: [], run: [], owner: [], score: [], flags: [] };
  const normF = (f) => { const o = {}; Object.keys(EMPTY_F).forEach((k) => { o[k] = Array.isArray(f && f[k]) ? f[k].slice().sort() : []; }); return o; };
  // Saved views from before the redesign kept single-value filters; carry over the ones that still exist.
  const legacyF = (v) => { const f = v.filters || {}; return normF({ owner: f.owner && f.owner !== 'all' ? [f.owner] : [], score: f.score === 'high' || f.score === 'good' ? ['high'] : f.score === 'none' ? ['none'] : [] }); };
  const passF = (i, f) => Object.keys(EMPTY_F).every((k) => !f[k].length || (k === 'flags' ? f.flags.some((x) => FLAG_TEST[x] && FLAG_TEST[x](i)) : f[k].indexOf(GROUP_VAL[k](i)) >= 0));
  // Parked keeps "maybe later" ideas off the board (ideas.parked_at); Archived lists archived ideas. Both keep their stage.
  const PRESETS = [
    ['active', 'All ideas', {}, 'var(--ink-3)'], ['mine', 'My ideas', { owner: [me.id] }, solid('blue')[0]],
    ['ai', 'AI-generated', { origin: ['ai'] }, solid('violet')[0]], ['attention', 'Runs needing attention', { run: ['failed'] }, solid('red')[0]],
    ['top', 'Top scored', { score: ['high'] }, solid('green')[0]], ['stale', 'Stale 14d+', { flags: ['stale'] }, solid('amber')[0]],
    ['parked', 'Parked', {}, 'var(--muted-2)'], ['archived', 'Archived', {}, 'var(--faint)']
  ];
  // Views and stage tabs from the previous toolbar, kept in saved preferences and old links.
  const LEGACY_VIEW = { stage_inbox: ['active', 'Inbox'], review: ['active', 'Research'], stage_ready: ['active', 'Ready'], ready: ['active', 'Ready'], stage_approved: ['active', 'Approved'], research: ['ai', ''], archived: ['archived', ''] };
  const lv = LEGACY_VIEW[s.iView];
  const viewKey = lv ? lv[0] : PRESETS.some((p) => p[0] === s.iView) || (/^saved:\d+$/.test(s.iView || '') && savedViews[Number(s.iView.slice(6))]) ? s.iView : 'active';
  const stageSel = ORDER.indexOf(s.iStage) >= 0 ? s.iStage : lv && lv[1] ? lv[1] : 'all';
  const userView = /^saved:/.test(viewKey) ? savedViews[Number(viewKey.slice(6))] : null;
  const preset = PRESETS.find((p) => p[0] === viewKey) || PRESETS[0];
  const viewF = userView ? (userView.f ? normF(userView.f) : legacyF(userView)) : normF(preset[2]);
  const iF = s.iF ? normF(s.iF) : viewF;
  // Parked and Archived replace the board with one list lane.
  const offBoard = viewKey === 'archived' ? 'archived' : viewKey === 'parked' || (!!userView && !!userView.parked) ? 'parked' : '';
  const parked = !!offBoard;
  const edited = JSON.stringify(iF) !== JSON.stringify(viewF);
  const nFilters = Object.keys(iF).filter((k) => iF[k].length).length;

  // Show ideas from a research run narrows every layout to that run's ideas until the filters are reset.
  const runRow = s.iRun ? (D.researchRuns || []).find((r) => r.id === s.iRun) : null;
  const runIds = runRow ? runRow.idea_ids || [] : null;
  const relevance = new Map();
  const inScope = (i) => {
    if ((runIds && !runIds.includes(i.id)) || (fBrand !== 'all' && i.brand !== fBrand)) return false;
    if (!search) return true;
    const score = search(i);
    if (score) relevance.set(i.id, score);
    return score > 0;
  };
  const scope = visible.filter(inScope);
  const isParked = (i) => live(i) && !!i.parkedAt;
  const onBoard = (i) => live(i) && !i.parkedAt;
  const pool = scope.filter(offBoard === 'archived' ? (i) => !live(i) : offBoard === 'parked' ? isParked : onBoard);
  const filtered = pool.filter((i) => passF(i, iF));
  const filtering = !!search || nFilters > 0 || !!runIds;
  // Side lanes (On Hold and custom columns, public.idea_board_columns). An idea in one keeps its stage.
  const SIDE = (D.ideaLanes || []).slice().sort((a, b) => a.position - b.position);
  const sideOf = (i) => (i.boardColumnId && onBoard(i) ? SIDE.find((c) => c.id === i.boardColumnId) || null : null);
  // Archived ideas keep their last stage, so the status tabs still split the Archived list. A status tab shows that
  // stage's lane, so ideas sitting in a side lane are not in it.
  const stageOf = (i) => (live(i) ? i.status : i.stage);
  const inStage = (i) => stageSel === 'all' || (stageOf(i) === stageSel && !sideOf(i));

  const byScore = (a, b) => (b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score);
  const COLUMN_SORT = {
    'col:title': (a, b) => a.title.localeCompare(b.title), 'col:type': (a, b) => a.type.localeCompare(b.type), 'col:stage': (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status),
    'col:rec': (a, b) => recOf(a).localeCompare(recOf(b)), 'col:owner': (a, b) => a.owner.localeCompare(b.owner), 'col:sources': (a, b) => sourcesOf(b) - sourcesOf(a), 'col:comments': (a, b) => b.comments.length - a.comments.length, 'col:brand': (a, b) => a.brand.localeCompare(b.brand),
    'col:priority': (a, b) => (a.priority - b.priority) || byScore(a, b)
  };
  // Sort: field plus order. Score sorts put unscored ideas last either way.
  const SORTS = [['score', 'Score', ['High to low', 'Low to high']], ['created', 'Created', ['Newest first', 'Oldest first']], ['updated', 'Last updated', ['Recent first', 'Oldest first']], ['title', 'Title', ['A to Z', 'Z to A']]];
  const LEGACY_SORT = { newest: ['created', 'desc'], recent: ['updated', 'desc'], stale: ['updated', 'asc'], priority: ['col:priority', 'asc'] };
  const rawSort = s.iSort || 'score';
  const browseSort = COLUMN_SORT[rawSort] ? rawSort : LEGACY_SORT[rawSort] ? LEGACY_SORT[rawSort][0] : SORTS.some((x) => x[0] === rawSort) ? rawSort : 'score';
  const defaultDir = (field) => field === 'title' ? 'asc' : 'desc';
  const browseDir = s.iSortDir === 'asc' || s.iSortDir === 'desc' ? s.iSortDir : LEGACY_SORT[rawSort]?.[1] || defaultDir(browseSort);
  const { field: sort, dir: sortDir } = search
    ? s.iSearchSort || { field: 'relevance', dir: '' }
    : { field: browseSort, dir: browseDir };
  const pickSort = (field, dir = defaultDir(field)) => set(search
    ? { iSearchSort: field === 'relevance' ? null : { field, dir } }
    : { iSort: field, iSortDir: dir });
  const orderField = sort === 'relevance' ? browseSort : sort;
  const orderDir = sort === 'relevance' ? browseDir : sortDir;
  const dirN = orderDir === 'desc' ? 1 : -1;
  const byField = COLUMN_SORT[orderField] ? COLUMN_SORT[orderField]
    : orderField === 'created' ? (a, b) => dirN * String(b.at).localeCompare(String(a.at))
    : orderField === 'updated' ? (a, b) => dirN * String(b.updatedAt).localeCompare(String(a.updatedAt))
    : orderField === 'title' ? (a, b) => -dirN * a.title.localeCompare(b.title)
    : (a, b) => ((a.score == null) - (b.score == null)) || (a.score != null && b.score != null ? dirN * (b.score - a.score) : 0) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  const sorter = sort === 'relevance' ? (a, b) => relevance.get(b.id) - relevance.get(a.id) || byField(a, b) : byField;
  const shown = filtered.filter(inStage).sort(sorter);
  // Group by applies to the list layout. Saved per user.
  const groupBy = layout === 'list' ? (s.iGroup !== undefined ? s.iGroup : prefs.ideaGroup || 'none') : 'none';
  const open = (i) => () => set({ ideaOpen: i.id, ideaEdit: null, ideaConfirm: '', ideaDraft: '', ideaTab: 'overview', ddOpen: '', ideaGate: null, iHistKind: 'all', iHistWho: 'all', iMenu: '', iDlgMenu: '', iDlgField: '', ideaInline: null });

  // ---------- Fields: which properties the cards show, or which columns the list has. Saved per layout. ----------
  const FIELD_LABEL = { stage: 'Stage', brand: 'Brand', type: 'Type', format: 'Format', priority: 'Priority', score: 'Score', rec: 'Recommendation', owner: 'Owner', sources: 'Sources', comments: 'Comments', updated: 'Updated' };
  const FIELD_KEYS = {
    gallery: ['priority', 'stage', 'brand', 'format', 'type', 'owner', 'score', 'rec', 'sources', 'comments', 'updated'],
    board: ['type', 'brand', 'format', 'priority', 'owner', 'score', 'rec', 'sources', 'comments', 'updated'],
    list: ['brand', 'type', 'stage', 'priority', 'score', 'rec', 'owner', 'sources', 'comments', 'updated']
  };
  const FIELD_DEFAULT = {
    gallery: ['priority', 'stage', 'brand', 'format', 'score', 'rec'],
    board: ['type', 'brand', 'format', 'score', 'comments', 'owner'],
    list: ['brand', 'type', 'stage', 'score', 'rec', 'owner', 'sources', 'updated']
  };
  const fieldPrefs = s.iFields !== undefined ? s.iFields : (prefs.ideaFields && typeof prefs.ideaFields === 'object' ? prefs.ideaFields : {});
  const fieldsFor = (l) => (Array.isArray(fieldPrefs[l]) ? fieldPrefs[l] : FIELD_DEFAULT[l]).filter((k) => FIELD_KEYS[l].indexOf(k) >= 0);
  const F = {};
  fieldsFor(layout).forEach((k) => { F[k] = true; });
  const saveFields = (list) => { const next = Object.assign({}, fieldPrefs, { [layout]: list }); set({ iFields: next }); A.savePrefs({ ideaFields: next }); };
  const isDefaultFields = fieldsFor(layout).slice().sort().join() === FIELD_DEFAULT[layout].slice().sort().join();
  const fieldsPanel = {
    open: !!s.iFieldsOpen, exp: s.iFieldsOpen ? 'true' : 'false', toggle: () => set({ iFieldsOpen: !s.iFieldsOpen, ddOpen: '' }),
    title: layout === 'list' ? 'Columns' : 'Show on cards',
    items: FIELD_KEYS[layout].map((k) => ({
      key: k, id: 'if-' + k, label: FIELD_LABEL[k], on: !!F[k],
      flip: () => saveFields(F[k] ? fieldsFor(layout).filter((x) => x !== k) : FIELD_KEYS[layout].filter((x) => F[x] || x === k))
    })),
    canReset: !isDefaultFields, reset: () => saveFields(FIELD_DEFAULT[layout].slice())
  };

  // ---------- Selection (gallery and list): the bulk bar acts on checked ideas that are still in view ----------
  const selectable = layout !== 'board';
  const selIds = selectable ? (s.iSel || []).filter((id) => shown.some((i) => i.id === id)) : [];
  const isSel = (id) => selIds.indexOf(id) >= 0;
  // The ideas in the order the page draws them, so Shift+click and the drag box can take a run of them.
  const selOrder = () => (groups ? groups.reduce((a, g) => a.concat(g.collapsed ? [] : g.rows.map((r) => r.id)), []) : shown.map((i) => i.id));
  const setSel = (list, more) => set(Object.assign({ iSel: list, iBulkAsk: '', iToast: null }, more || {}));
  const clearSel = (more) => set(Object.assign({ iSel: [], iSelAnchor: '', iBulkAsk: '' }, more || {}));
  // Shift+click checks every idea between the last one clicked and this one. A plain click toggles one and becomes
  // the point the next Shift+click runs from.
  const toggleSel = (id, e) => {
    const ne = e && (e.nativeEvent || e);
    if (ne && ne.shiftKey && s.iSelAnchor && s.iSelAnchor !== id) {
      const order = selOrder(), a = order.indexOf(s.iSelAnchor), b = order.indexOf(id);
      if (a >= 0 && b >= 0) return setSel(selIds.concat(order.slice(Math.min(a, b), Math.max(a, b) + 1).filter((x) => !isSel(x))));
    }
    setSel(isSel(id) ? selIds.filter((x) => x !== id) : selIds.concat([id]), { iSelAnchor: id });
  };

  // Toast with Undo for board moves.
  // Bulk changes touch several ideas at once, so their Undo stays up longer than a single move's.
  const showToast = (t) => { set({ iToast: t }); clearTimeout(toastTimer); toastTimer = setTimeout(() => set({ iToast: null }), t.items ? 20000 : 6000); };
  // Where an idea sits now, so Undo can put it back in one write.
  const placeOf = (i) => ({ status: live(i) ? i.status : 'Archived', boardColumnId: i.boardColumnId || '', parkedAt: i.parkedAt || '' });
  const whereLabel = (i) => (i.parkedAt ? 'Parked' : sideOf(i) ? sideOf(i).label : laneOf(i.status).label);
  const guard = (i) => {
    if (!canEditI(i)) { A.toast(role === 'designer' ? 'Only the creator or a Super Admin can move this idea.' : 'You cannot move this idea.'); return false; }
    if (locked(i)) { A.toast('This idea is linked to a project. Archive it from the idea instead.'); return false; }
    return true;
  };
  // The toast and its Undo show once the write lands; a failed write puts the card back (updateIdea reverts it).
  const write = (i, patch, text, done) => {
    const back = placeOf(i), backText = 'moved the idea back to ' + whereLabel(i);
    A.updateIdea(i, patch, text).then((ok) => { if (ok) showToast({ text: '"' + i.title + '" ' + done, id: i.id, back: back, backText: backText }); });
  };
  // Targets: a stage key, a side lane ('lane:<id>') or 'Parked'. Every stage change goes through stageBlocker.
  const move = (id, to) => {
    const i = visible.find((x) => x.id === id);
    set({ iDrag: '', iOver: '' });
    if (!i) return;
    if (to === 'Parked') return park(i);
    if (/^lane:/.test(to)) return toSide(i, to.slice(5));
    if (i.status === to && !sideOf(i)) return;
    if (to === 'Approved' && role === 'manager' && !me.perms.has('ideas:approve')) return A.toast('Approval needs idea approval permission.');
    if (!guard(i)) return;
    if (i.status === to) return write(i, { boardColumnId: '' }, 'moved the idea back to ' + laneOf(to).label, 'moved to ' + laneOf(to).label);
    const blocked = stageBlocker(i, i.status, to, rules);
    if (to === 'Approved') {
      if (i.status !== 'Ready') return A.toast('Send this idea to review before approving it.');
      if (blocked) return A.toast(blocked);
      return approveToProduction(i);
    }
    if (blocked) return A.toast(blocked);
    write(i, { status: to, boardColumnId: '' }, 'moved Stage to ' + laneOf(to).label, 'moved to ' + laneOf(to).label);
  };
  const toSide = (i, laneId) => {
    const c = SIDE.find((x) => x.id === laneId);
    if (!c || i.boardColumnId === laneId || !guard(i)) return;
    write(i, { boardColumnId: laneId, parkedAt: '' }, 'moved the idea to ' + c.label, 'moved to ' + c.label);
  };
  const park = (i) => { if (i.parkedAt || !guard(i)) return; write(i, { parkedAt: new Date().toISOString(), boardColumnId: '' }, 'parked the idea', 'parked'); };
  // Parked ideas go back to In Development through the stage gates.
  const restore = (i) => {
    if (!guard(i)) return;
    const blocked = stageBlocker(i, i.status, 'Research', rules);
    if (blocked) return A.toast(blocked);
    write(i, { parkedAt: '', boardColumnId: '', status: 'Research' }, 'moved the idea back to In Development', 'moved back to In Development');
  };
  const unarchive = (i) => {
    if (!canEditI(i)) return;
    const to = i.stage || 'Inbox';
    A.updateIdea(i, { status: to }, 'restored the idea').then((ok) => { if (ok) A.toast('Restored "' + i.title + '" to ' + laneOf(to).label + '.'); });
  };
  const undo = () => {
    const t = s.iToast;
    set({ iToast: null });
    if (!t) return;
    // Bulk toasts carry each idea's way back; ideas that share one are put back in a single write.
    if (t.items) {
      const groups = {};
      t.items.forEach((it) => { const k = JSON.stringify(it.back); (groups[k] = groups[k] || { back: it.back, text: it.text, list: [] }).list.push(it.id); });
      Object.keys(groups).forEach((k) => {
        const g = groups[k];
        A.updateIdeas(D.ideas.filter((x) => g.list.indexOf(x.id) >= 0), g.back, g.text);
      });
      return;
    }
    const i = D.ideas.find((x) => x.id === t.id);
    if (i && t.back) A.updateIdea(i, t.back, t.backText).then((ok) => { if (ok) A.toast('Put "' + i.title + '" back where it was.'); });
  };
  // ---------- Board: the four workflow stages, then side lanes (handoff § BoardLane, IdeaCard, AddColumnStrip) ----------
  // The idea_stage enum keeps its keys (Inbox, Research, Ready, Approved); the page shows the workflow names.
  const NEXT = { 'Inbox': 'Research', 'Research': 'Ready', 'Ready': 'Approved' };
  const dropId = (e) => s.iDrag || (e && e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
  const LANES = [
    { key: 'Inbox', label: 'Idea Inbox', tab: 'Inbox', desc: 'Pick ideas to develop', color: 'var(--muted-2)' },
    { key: 'Research', label: 'In Development', tab: 'Development', desc: 'Sharpen the pitch', color: solid('violet')[0] },
    { key: 'Ready', label: 'Ready for Review', tab: 'Review', desc: 'Approve, return or park', color: solid('amber')[0] },
    { key: 'Approved', label: 'Approved', tab: 'Approved', desc: 'Hand off to production', color: solid('green')[0] }
  ];
  const OFF_LANES = {
    parked: { key: 'Parked', label: 'Parked', tab: 'Parked', desc: 'Maybe later ideas', color: 'var(--muted-2)' },
    archived: { key: 'Archived', label: 'Archived', tab: 'Archived', desc: 'Restore one to work on it again', color: 'var(--faint)' }
  };
  const toneColor = (tn) => (tn === 'gray' ? 'var(--muted-2)' : solid(tn)[0]);
  const sideLane = (c) => ({ key: 'lane:' + c.id, id: c.id, kind: c.kind, label: c.label, tab: c.label, tone: c.color, color: toneColor(c.color), desc: c.kind === 'hold' ? 'Paused until unblocked' : 'Custom column' });
  const laneOf = (k) => {
    const side = /^lane:/.test(k) ? SIDE.find((c) => 'lane:' + c.id === k) : null;
    return LANES.find((l) => l.key === k) || (side ? sideLane(side) : k === 'Archived' ? OFF_LANES.archived : k === 'Parked' ? OFF_LANES.parked : { key: k, label: k, color: 'var(--muted-2)' });
  };
  // Side lanes are managed by Super Admins and managers with ideas:edit (the idea_board_columns policies).
  const canManageLanes = role === 'admin' || (role === 'manager' && me.perms.has('ideas:edit'));
  const LANE_TONES = ['gray', 'violet', 'amber', 'green', 'blue', 'red', 'coral', 'pink'];
  // Collapsed lanes, per user per workspace in this browser (Open question 5).
  const SHUT_KEY = 'ftgu_ideas_board_collapsed:' + ((D.ws && D.ws.id) || 'default');
  const readShut = () => { try { const v = JSON.parse(window.localStorage.getItem(SHUT_KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
  const shut = s.iLaneShut !== undefined ? s.iLaneShut : (typeof window === 'undefined' ? {} : readShut());
  const setShut = (k, on) => {
    const next = Object.assign({}, shut, { [k]: on });
    set({ iLaneShut: next, iLaneMenu: '' });
    try { window.localStorage.setItem(SHUT_KEY, JSON.stringify(next)); } catch { /* storage off */ }
  };
  const viewsOf = (i) => Math.max(0, ...(i.findings || []).map((f) => Number(f && f.views) || 0), ...((i.research && i.research.sources) || []).map((x) => Number(x && x.views) || 0));
  // Display: which parts every board card shows. Saved per user.
  const CARD_FIELDS = [['thumb', 'Thumbnail'], ['origin', 'Idea origin'], ['run', 'Research run'], ['brand', 'Brand'], ['context', 'Research context'], ['score', 'Score and recommendation'], ['comments', 'Comments'], ['owner', 'Owner']];
  const cardHidden = s.iCardHidden !== undefined ? s.iCardHidden : (Array.isArray(prefs.ideaCardHidden) ? prefs.ideaCardHidden : []);
  const CF = {};
  CARD_FIELDS.forEach((f) => { CF[f[0]] = cardHidden.indexOf(f[0]) < 0; });
  const RUN_PILL = { queued: ['Queued', 'var(--chip-2)', 'var(--ink-3)'], running: ['Running', 'var(--blue-soft)', 'var(--blue-ink)'], complete: ['Complete', 'var(--green-soft)', 'var(--green-ink)'] };
  const PAGE = 5;
  const pages = s.iPage || {};
  const boardCard = (i, lane) => {
    const ce = canEditI(i) && !locked(i);
    const inStageLane = ORDER.indexOf(lane) >= 0;
    const nx = inStageLane ? NEXT[lane] : '';
    const rk = runOf(i);
    const raw = (D.ideas.find((x) => x.id === i.id) || {}).hook || '';
    const ctx = [viewsOf(i) ? kFmt(viewsOf(i)) + ' views' : '', sourcesOf(i) ? sourcesOf(i) + (sourcesOf(i) === 1 ? ' source' : ' sources') : ''].filter(Boolean).join(' · ');
    const rec = live(i) && i.status !== 'Approved' ? REC_NAME[recOf(i)] || '' : '';
    const ownerName = who(i.ownerId, i.owner) === 'You' ? me.name : i.owner;
    const review = lane === 'Ready' && ce;
    const media = CF.thumb && !!i.coverUrl;
    return {
      id: i.id, title: i.title, open: open(i), isOpen: s.ideaOpen === i.id,
      media: media, mediaStyle: media ? 'background: #222222 url("' + String(i.coverThumb || i.coverUrl).replace(/["\\)]/g, '') + '") ' + (i.focal || [50, 50])[0] + '% ' + (i.focal || [50, 50])[1] + '% / cover no-repeat;' : '',
      showOrigin: CF.origin, ai: originOf(i) === 'ai', originLabel: originOf(i) === 'ai' ? 'AI-generated' : 'Manual',
      run: CF.run && RUN_PILL[rk] ? { key: rk, label: RUN_PILL[rk][0], style: 'background: ' + RUN_PILL[rk][1] + '; color: ' + RUN_PILL[rk][2] + ';' } : null,
      showStrip: !media && (CF.origin || (CF.run && !!RUN_PILL[rk])),
      kicker: raw && i.title.toLowerCase().indexOf(raw.toLowerCase()) < 0 ? '“' + raw + '”' : '',
      context: CF.context && ctx && ctx !== i.title ? ctx : '',
      failed: rk === 'failed', retry: rk === 'failed' && canResearchIdea(i) ? () => A.runIdeaResearch(i) : null, retryLabel: 'Retry research run for ' + i.title,
      brand: CF.brand ? i.brand : '', brandColor: BCOL[i.brand] || 'var(--muted-2)',
      score: CF.score && i.score != null ? fmtScore(i.score) + (rec ? ' · ' + rec : '') : '',
      scoreStyle: i.score != null && i.score >= pursueAt ? 'background: var(--green-soft); color: var(--green-ink);' : 'background: var(--amber-soft); color: var(--amber-ink);',
      scoreLabel: i.score != null ? 'Score ' + fmtScore(i.score) + (rec ? ', research recommends ' + rec : '') : '',
      comments: CF.comments && i.comments.length ? String(i.comments.length) : '', commentsLabel: i.comments.length + (i.comments.length === 1 ? ' comment' : ' comments'),
      owner: CF.owner ? ini(ownerName) || '?' : '', ownerLabel: 'Owner: ' + (ownerName || 'Unassigned'),
      canDrag: ce && (inStageLane || /^lane:/.test(lane)), canMove: ce && !!nx && nx !== 'Approved', moveLabel: nx ? 'Move ' + i.title + ' to ' + laneOf(nx).label : '', move: () => { if (nx) move(i.id, nx); },
      review: review, canApprove: review && canApproveI(i), approve: () => move(i.id, 'Approved'), ret: () => move(i.id, 'Research'), park: () => move(i.id, 'Parked'),
      approveLabel: 'Approve ' + i.title, returnLabel: 'Return ' + i.title + ' to In Development', parkLabel: 'Park ' + i.title,
      unpark: lane === 'Parked' && canEditI(i) ? () => restore(i) : lane === 'Archived' && canEditI(i) ? () => unarchive(i) : null,
      unparkText: lane === 'Archived' ? 'Restore to ' + laneOf(i.stage || 'Inbox').label : 'Move back to In Development',
      unparkLabel: lane === 'Archived' ? 'Restore ' + i.title + ' to ' + laneOf(i.stage || 'Inbox').label : 'Move ' + i.title + ' back to In Development',
      dragging: s.iDrag === i.id,
      dragStart: (e) => { if (!ce || !(inStageLane || /^lane:/.test(lane))) { e.preventDefault(); return; } if (e.dataTransfer) { e.dataTransfer.setData('text/plain', i.id); e.dataTransfer.effectAllowed = 'move'; } set({ iDrag: i.id, iToast: null }); },
      lane: lane
    };
  };
  const fullBoard = !offBoard && stageSel === 'all';
  const laneList = offBoard ? [OFF_LANES[offBoard]] : fullBoard ? LANES.concat(SIDE.map(sideLane)) : LANES.filter((l) => l.key === stageSel);
  const boardOrder = [];
  const closeLaneMenu = () => set({ iLaneMenu: '', iLaneDel: '', iLaneName: null });
  const lanes = laneList.map((l, n) => {
    const items = filtered.filter((i) => (offBoard ? inStage(i) : l.id ? !!sideOf(i) && sideOf(i).id === l.id : !sideOf(i) && i.status === l.key)).sort(sorter);
    const limit = pages[l.key] || PAGE;
    const more = Math.max(0, items.length - limit);
    const over = s.iOver === l.key && !!s.iDrag;
    // On Hold starts collapsed until the person opens it (handoff § BoardLane, Open question 5).
    const isShut = laneList.length > 1 && (shut[l.key] !== undefined ? !!shut[l.key] : l.kind === 'hold');
    const left = l.id ? laneList.slice(0, n).reverse().find((x) => x.id) : null;
    const editing = s.iLaneName && s.iLaneName.id === l.id;
    const saveName = () => {
      const v = String(editing ? s.iLaneName.value : l.label).trim().slice(0, 40);
      set({ iLaneName: null });
      if (v && v !== l.label) A.updateIdeaLane(l.id, { label: v });
    };
    items.forEach((i) => boardOrder.push(i));
    return {
      key: l.key, label: l.label, desc: l.desc, color: l.color, count: String(items.length), kind: l.kind || (offBoard ? 'list' : 'stage'),
      aria: l.label + ', ' + items.length + (items.length === 1 ? ' idea' : ' ideas'),
      canAdd: canCreate && l.key === 'Inbox', addLabel: 'Capture idea in Idea Inbox',
      empty: items.length === 0, emptyText: filtering ? 'No matching ideas' : l.kind === 'hold' ? 'Drop paused ideas here' : 'Drop ideas here',
      cards: items.slice(0, limit).map((i) => boardCard(i, l.key)),
      more: more ? 'Show ' + Math.min(10, more) + ' more' : '', showMore: () => set({ iPage: Object.assign({}, pages, { [l.key]: limit + 10 }) }),
      over: over, shut: isShut, canShut: laneList.length > 1,
      collapse: () => setShut(l.key, true), expand: () => setShut(l.key, false),
      expandLabel: 'Expand ' + l.label + ', ' + items.length + (items.length === 1 ? ' idea' : ' ideas'), collapseLabel: 'Collapse ' + l.label,
      optionsLabel: 'Column options for ' + l.label, menuOpen: s.iLaneMenu === l.key,
      toggleMenu: () => set({ iLaneMenu: s.iLaneMenu === l.key ? '' : l.key, iLaneDel: '', iLaneName: null, iMenu: '' }), closeMenu: closeLaneMenu,
      // Side lanes: rename, recolour and delete (two clicks). Workflow stages keep the names their gates use.
      canEdit: !!l.id && canManageLanes,
      name: editing ? s.iLaneName.value : l.label, nameId: 'lane-name-' + (l.id || l.key),
      onName: (e) => set({ iLaneName: { id: l.id, value: val(e) } }), saveName: saveName,
      onNameKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } },
      tone: l.tone || '', pickTone: (tn) => { if (tn !== l.tone) A.updateIdeaLane(l.id, { color: tn }); },
      deleting: s.iLaneDel === l.id, del: () => { if (s.iLaneDel !== l.id) return set({ iLaneDel: l.id }); closeLaneMenu(); A.deleteIdeaLane(l.id); },
      note: offBoard === 'parked' ? 'Parked ideas leave the board. Move one back to keep working on it.'
        : offBoard === 'archived' ? 'Archived ideas are hidden from the board. Restore one to work on it again.'
        : !l.id ? 'Workflow stage. Its name and gates come from the Ideas rules.'
        : 'Deleting moves its cards to ' + (left ? left.label : 'their stage lanes') + '.',
      onOver: (e) => { if (offBoard) return; e.preventDefault(); if (s.iOver !== l.key) set({ iOver: l.key }); },
      onLeave: (e) => { if (e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return; if (s.iOver === l.key) set({ iOver: '' }); },
      onDrop: (e) => { e.preventDefault(); if (offBoard) return; const id = dropId(e); if (id) move(id, l.key); }
    };
  });
  // Add column: a dashed strip after the last lane that turns into a name field (handoff § AddColumnStrip).
  const addCol = fullBoard && canManageLanes ? (() => {
    const name = s.iAddColName || '';
    const cancel = () => set({ iAddCol: false, iAddColName: '' });
    const add = () => {
      const v = name.trim().slice(0, 40);
      if (!v) return;
      cancel();
      A.createIdeaLane(v, LANE_TONES[SIDE.length % LANE_TONES.length]);
    };
    return {
      open: !!s.iAddCol, name: name, start: () => set({ iAddCol: true, iAddColName: '', iLaneMenu: '', iMenu: '' }),
      onName: (e) => set({ iAddColName: val(e) }), add: add, cancel: cancel, canAdd: !!name.trim(),
      onKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } }
    };
  })() : null;
  const cards = shown.map((i) => {
    const bn = banner(i, 'card');
    const mini = banner(i, 'mini');
    const arch = i.status === 'Archived';
    return {
      title: i.title, brand: i.brand, status: i.status, format: i.format, type: i.type, owner: who(i.ownerId, i.owner), updated: relTime(i.updatedAt),
      aria: 'Open idea: ' + i.title + ', ' + i.status, open: open(i),
      id: i.id, f: F, selected: isSel(i.id), isOpen: s.ideaOpen === i.id, toggleSel: (e) => toggleSel(i.id, e), selLabel: 'Select ' + i.title, nComments: String(i.comments.length),
      metaText: [F.brand ? i.brand : '', F.format ? i.format : '', F.type ? i.type : '', F.owner ? who(i.ownerId, i.owner) : '', F.sources && sourcesOf(i) ? sourcesOf(i) + (sourcesOf(i) === 1 ? ' source' : ' sources') : '', F.comments && i.comments.length ? i.comments.length + (i.comments.length === 1 ? ' comment' : ' comments') : '', F.updated ? 'Updated ' + relTime(i.updatedAt) : ''].filter(Boolean),
      showRec: !!F.rec && !!recOf(i), showScore: !!F.score && !(F.rec && recOf(i)),
      cellStage: 'iCellStage_' + i.id, cellType: 'iCellType_' + i.id, cellOwner: 'iCellOwner_' + i.id,
      canStage: canEditI(i) && !locked(i) && !arch, canCell: canEditI(i) && !arch, typeDot: dotS(solid(TYPE_T[i.type] || 'gray')[0]),
      pri: 'P' + i.priority, priStyle: priS(i.priority), fromResearch: i.source === 'research', isImg: bn.isImg,
      thumbStyle: bn.style, hookStyle: bn.hookStyle, hiStyle: bn.hiStyle, hookHi: bn.hookHi, hookRest: bn.hookRest, showHook: bn.showHook,
      badge: i.score != null ? fmtScore(i.score) + ' of 100' : topStat(i) || (sourcesOf(i) ? sourcesOf(i) + (sourcesOf(i) === 1 ? ' source' : ' sources') : i.type + '  ·  ' + i.comments.length + (i.comments.length === 1 ? ' comment' : ' comments')),
      hookLine: (D.ideas.find((x) => x.id === i.id) || {}).hook || '', rec: REC_NAME[recOf(i)] || '', recStyle: tagPill(i.score), sources: String(sourcesOf(i)),
      acts: [{ label: 'Open', pick: open(i) }].concat(
        canResearchIdea(i) && !isActiveRun(i.run) ? [{ label: 'Run research', pick: () => A.runIdeaResearch(i) }] : [],
        canEditI(i) && !arch ? [{ label: s.iArchiveAsk === i.id ? 'Confirm archive' : 'Archive', pick: () => { if (s.iArchiveAsk === i.id) { set({ iArchiveAsk: '' }); A.updateIdea(i, { status: 'Archived' }, 'archived the idea'); } else set({ iArchiveAsk: i.id }); } }] : []),
      initials: ini(i.brand),
      avatarStyle: 'width: 40px; height: 40px; flex: none; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 700;',
      titleStyle: 'font-size: 16px; font-weight: 600; line-height: 1.35; color: ' + (arch ? 'var(--muted)' : 'var(--ink)') + '; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;',
      dot: dotS(DOT[i.status]), score: fmtScore(i.score), scoreStyle: scorePill(i.score), smallScoreStyle: scorePill(i.score, true), typeStyle: typeTag(i.type),
      miniThumb: mini.style
    };
  });
  const nShown = shown.length;
  const pillars = PILLARS.concat(visible.map((i) => i.pillar).filter((p) => p && PILLARS.indexOf(p) < 0).filter((p, k, a) => a.indexOf(p) === k).sort());

  // ---------- Grouped list (Monday's grouped table): collapsible groups with a summary row each ----------
  const GROUP_KEY = {
    stage: (i) => i.status, pillar: (i) => i.pillar || 'No pillar', owner: (i) => who(i.ownerId, i.owner) || 'No owner',
    brand: (i) => i.brand, type: (i) => i.type, rec: (i) => REC_NAME[recOf(i)] || 'Not scored'
  };
  const GROUP_ORDER = { stage: ORDER.concat(['Archived']), rec: ['Pursue', 'Park', 'Drop', 'Not scored'], pillar: pillars.concat(['No pillar']), type: TYPES };
  const REC_COLOR = { 'Pursue': solid('green')[0], 'Park': solid('amber')[0], 'Drop': solid('red')[0], 'Not scored': 'var(--border-strong)' };
  const PALETTE = ['blue', 'violet', 'coral', 'green', 'amber', 'pink', 'red'].map((t) => solid(t)[0]);
  const collapsed = s.iCollapsed || [];
  const groups = groupBy !== 'none' && GROUP_KEY[groupBy] ? (() => {
    const by = new Map();
    shown.forEach((i, n) => { const k = GROUP_KEY[groupBy](i); if (!by.has(k)) by.set(k, []); by.get(k).push(n); });
    const order = GROUP_ORDER[groupBy] || [];
    const keys = Array.from(by.keys()).sort((a, b) => {
      const x = order.indexOf(a), y = order.indexOf(b);
      if (x >= 0 || y >= 0) return (x < 0 ? 999 : x) - (y < 0 ? 999 : y);
      return a === 'You' ? -1 : b === 'You' ? 1 : String(a).localeCompare(String(b));
    });
    return keys.map((k, n) => {
      const idx = by.get(k), items = idx.map((x) => shown[x]);
      const ck = groupBy + ':' + k, isCollapsed = collapsed.indexOf(ck) >= 0;
      const color = groupBy === 'stage' ? DOT[k] || 'var(--border-strong)' : groupBy === 'rec' ? REC_COLOR[k] : PALETTE[n % PALETTE.length];
      const scores = items.map((i) => i.score).filter((x) => x != null);
      const inSel = items.filter((i) => isSel(i.id)).length;
      return {
        key: ck, label: k, count: String(items.length), color: color, collapsed: isCollapsed,
        toggleLabel: (isCollapsed ? 'Expand ' : 'Collapse ') + k,
        toggle: () => set({ iCollapsed: isCollapsed ? collapsed.filter((x) => x !== ck) : collapsed.concat([ck]) }),
        bar: 'width: 4px; height: 20px; flex: none; border-radius: 2px; background: ' + color + ';',
        edge: 'box-shadow: inset 4px 0 0 ' + color + ';',
        rows: idx.map((x) => cards[x]),
        allSel: inSel === items.length, someSel: inSel > 0 && inSel < items.length, selLabel: 'Select every idea in ' + k,
        toggleSel: () => {
          const ids = items.map((i) => i.id);
          setSel(inSel === items.length ? selIds.filter((x) => ids.indexOf(x) < 0) : selIds.concat(ids.filter((x) => selIds.indexOf(x) < 0)));
        },
        stageMix: ORDER.concat(['Archived']).map((st) => [st, items.filter((i) => i.status === st).length]).filter((x) => x[1] > 0)
          .map((x) => ({ key: x[0], title: x[0] + ': ' + x[1], style: 'flex: ' + x[1] + ' 1 0; min-width: 4px; height: 100%; background: ' + (DOT[x[0]] || 'var(--border-strong)') + ';' })),
        stageMixLabel: ORDER.concat(['Archived']).map((st) => [st, items.filter((i) => i.status === st).length]).filter((x) => x[1] > 0).map((x) => x[1] + ' ' + x[0]).join(', '),
        avgScore: scores.length ? String(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)) : '–',
        avgStyle: scorePill(scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, true),
        pursue: items.filter((i) => recOf(i) === 'pursue').length ? items.filter((i) => recOf(i) === 'pursue').length + ' pursue' : '',
        sources: String(items.reduce((a, i) => a + sourcesOf(i), 0)), comments: String(items.reduce((a, i) => a + i.comments.length, 0))
      };
    });
  })() : null;

  // ---------- Shared pickers ----------
  const people = (D.directory || []).filter((p) => p.status === 'active' && (['super_admin', 'manager', 'designer'].includes(p.role) || p.id === me.id));
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
  // Super Admins can add a sponsor straight from Sponsor fit: it makes the sponsor account and its brand kit.
  const addSponsor = role === 'admin' ? { label: 'Add sponsor', placeholder: 'New sponsor name', run: (name) => A.quickAddAccount(name, 'sponsor').then((a) => {
    if (!a.kitId) throw new Error(a.name + ' has no sponsor brand kit yet. Add one from Brand.');
    return a.kitId;
  }) } : null;
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
    // Large pictures are shrunk to 1920 px before they upload (lib/studio/idea-cover).
    if (f.size > 25 * 1024 * 1024) return { err: 'That image is over 25 MB. Pick a smaller one.' };
    let url = '';
    try { url = URL.createObjectURL(f); } catch { url = ''; }
    return { file: f, url: url, name: f.name };
  };
  const fileOf = (e) => (e && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) || (e && e.target && e.target.files && e.target.files[0]) || null;
  const brandImages = (brandName) => ((brandOf(brandName) || {}).assets || []).filter((a) => a && a.path && /\.(jpe?g|png|webp|gif|avif)$/i.test(a.name || a.path));

  // ---------- Idea detail ----------
  const sel = visible.find((i) => i.id === s.ideaOpen) || null;
  const ed = sel && s.ideaEdit && s.ideaEdit.id === sel.id ? s.ideaEdit : null;
  let detail = null, edit = null, histWhoOpts = null, histWhoCur = 'all';
  if (sel && !ed) {
    const i = sel;
    const ce = canEditI(i);
    const arch = i.status === 'Archived';
    const ix = ORDER.indexOf(i.status);
    const commit = (p, text) => { set({ ideaConfirm: '', ideaGate: null }); A.updateIdea(i, p, text); };
    const refuse = (text) => set({ ideaGate: { id: i.id, text: text } });
    const advance = (to) => {
      const blocked = stageBlocker(i, i.status, to, rules);
      if (blocked) return refuse(blocked);
      commit({ status: to, boardColumnId: '' }, 'moved the idea to ' + laneOf(to).label);
    };
    const tryApprove = () => {
      if (i.status !== 'Ready') return refuse('Move this idea to Ready before approving it.');
      const blocked = stageBlocker(i, i.status, 'Approved', rules);
      if (blocked) return refuse(blocked);
      set({ ideaGate: null });
      return approveToProduction(i);
    };
    const shownLines = new Set(i.hist.map((h) => h.at + h.text));
    const olderLines = A.ideaHistory(i.id).filter((h) => !shownLines.has(h.at + h.text)).map((h) => ({ who: who(h.whoId, h.who), text: h.text, time: relTime(h.at), at: h.at }));
    const history = i.hist.concat(olderLines).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const project = i.projectId ? (D.rows || []).find((r) => r.id === i.projectId) || null : null;
    const startEdit = (extra) => set({ ideaEdit: {
      aiOpen: false, aiStyle: 'photo', aiPrompt: '', aiBusy: false, ...(extra && typeof extra === 'object' && !extra.target ? extra : {}),
      id: i.id, title: i.title, brandId: i.brandId, titleOptions: (i.titleOptions || []).join('\n'), thumbnailBrief: i.thumbnailBrief || '', hook: D.ideas.find((x) => x.id === i.id).hook || '',
      type: i.type, pillar: i.pillar, audience: i.audience, promise: i.promise, body: i.body.join('\n\n'), tags: i.tags.slice(), tagDraft: '',
      refs: i.refs.length ? i.refs.slice() : [''], ice: i.ice.map((n) => (n == null ? 5 : n)), iceSet: i.score != null,
      ownerId: i.ownerId || me.id, priority: i.priority, format: i.format, platforms: i.platforms.slice(), effort: i.effort, window: i.window, sponsorId: i.sponsorId,
      coverMode: i.coverMode, coverUrl: i.coverUrl, coverPath: i.coverPath, focal: i.focal.slice(), highlight: i.highlight, hookPos: i.hookPos,
      file: null, drag: false, err: '', confirmClose: false
    }, ddOpen: '' });
    const canApprove = canApproveI(i);
    const approve = () => runConvert(i, 'project');
    let cta = null, back = null;
    if (ce && !arch) {
      const requestChanges = { label: 'Request changes', pick: () => {
        const t = (s.ideaDraft || '').trim();
        commit({ status: ORDER[ix - 1] }, 'requested changes');
        if (t) { set({ ideaDraft: '' }); A.commentIdea(i, t); }
      } };
      if (i.status === 'Inbox') cta = { label: 'Move to Research', pick: () => advance('Research') };
      else if (i.status === 'Research') {
        cta = { label: 'Move to Ready', pick: () => advance('Ready') };
        if (canApprove) back = requestChanges;
      } else if (i.status === 'Ready' && canApprove) {
        cta = { label: s.ideaApproving ? 'Approving…' : 'Approve', pick: tryApprove };
        back = requestChanges;
      } else if (i.status === 'Approved' && !locked(i) && canApprove) {
        cta = { label: s.ideaApproving ? 'Approving…' : 'Convert', pick: () => startConvert(i) };
      }
    }
    if (i.projectId && project) cta = { label: 'Open project', pick: () => set({ ideaOpen: '', nav: 'projects', openJob: project.job, dTab: 'overview' }) };
    const steps = ORDER.map((k, n) => {
      const done = !arch && n < ix, on = !arch && n === ix;
      return {
        label: k, num: done ? '✓' : String(n + 1), current: on ? 'step' : undefined,
        pick: ce && !arch && !locked(i) && !on ? () => { if (k === 'Approved') { if (canApprove) tryApprove(); else refuse('You cannot approve this idea.'); } else if (n < ix) commit({ status: k }, 'moved the idea back to ' + k); else advance(k); } : null,
        style: 'flex: 1 1 120px; min-width: 0; display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 12px; border-radius: 12px; font-size: 13px; font-weight: 600; overflow: hidden; ' + (on ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgba(17,17,17,0.12);' : done ? 'color: ' + TONE.green[1] + ';' : 'color: var(--muted);'),
        dotStyle: 'width: 22px; height: 22px; flex: none; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; ' + (done ? 'background: ' + solid('green')[0] + '; color: ' + solid('green')[1] + ';' : on ? 'background: var(--inv); color: var(--inv-ink);' : 'background: var(--chip-2); color: var(--ink-3);'),
        labelStyle: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
      };
    });
    const beats = scriptBeats(i);
    // ---------- Script tab: read, edit beats in place, or draft with AI ----------
    // s.ideaScript holds the working copy {id, beats, dirty, busy, err, aiOpen, notes, length, source, model}. Nothing
    // is written until Save; Generate replaces the working copy and leaves it for review.
    const sc = s.ideaScript && s.ideaScript.id === i.id ? s.ideaScript : null;
    const scSet = (p) => set({ ideaScript: Object.assign({}, sc || { id: i.id, beats: [], dirty: false, busy: false, err: '', aiOpen: false, notes: '', length: '', source: 'manual', model: '' }, p) });
    const canScript = ce && !arch;
    const legacy = !hasSavedScript(i) && beats.length > 0;
    const blankBeat = () => ({ time: '', label: '', text: '' });
    const startScript = (extra) => scSet(Object.assign({ beats: beats.length ? beats.map((b) => Object.assign({}, b)) : [blankBeat()], dirty: false, err: '', source: hasSavedScript(i) ? i.script.source || 'manual' : 'manual', model: hasSavedScript(i) ? i.script.model || '' : '' }, extra || {}));
    const setBeats = (list) => scSet({ beats: list, dirty: true, err: '' });
    const saveScript = async () => {
      if (!sc || sc.busy) return;
      const list = sc.beats.map(cleanBeat).filter((b) => b.text);
      if (!list.length) return scSet({ err: 'Write at least one beat, or discard the draft.' });
      scSet({ busy: true, err: '' });
      const ok = await A.updateIdea(i, { script: { beats: list, source: sc.source || 'manual', model: sc.model || '', updatedAt: new Date().toISOString() } }, sc.source === 'ai' ? 'saved an AI-drafted script' : 'updated the script');
      if (ok) { set({ ideaScript: null }); A.toast('Script saved.'); } else scSet({ busy: false, err: 'The script was not saved. Check the message above and try again.' });
    };
    const generate = async () => {
      if (!sc || sc.busy) return;
      scSet({ busy: true, err: '' });
      try {
        const res = await fetch('/api/ideas/script', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ideaId: i.id, notes: sc.notes || '', length: sc.length || '', current: sc.beats.map(cleanBeat).filter((b) => b.text) }) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || 'The script could not be drafted (' + res.status + ').');
        scSet({ busy: false, aiOpen: false, beats: out.beats, dirty: true, source: 'ai', model: out.model || '' });
        A.toast('Draft ready from ' + (out.model || 'the model') + '. Review the beats, then save.');
      } catch (err) { scSet({ busy: false, err: err.message }); }
    };
    const scriptBtn = (primary) => 'display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px; border-radius: 10px; font-size: 13px; font-weight: 600; letter-spacing: normal; cursor: pointer; white-space: nowrap; ' + (primary ? 'border: 0; background: var(--inv); color: var(--inv-ink);' : 'border: 1px solid var(--border); background: var(--surface); color: var(--ink);');
    const scriptField = 'box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); font-family: inherit; font-size: 14px; line-height: 1.5; color: var(--ink);';
    const scBeats = sc ? sc.beats : [];
    const script = {
      editing: !!sc, busy: !!(sc && sc.busy), dirty: !!(sc && sc.dirty), err: sc ? sc.err || '' : '', hasErr: !!(sc && sc.err),
      canEdit: canScript, canAi: canScript && textAiOn, aiOff: canScript && !textAiOn,
      // Read mode
      empty: beats.length === 0, legacy: legacy,
      summary: beats.length ? beats.length + (beats.length === 1 ? ' beat' : ' beats') + (readTime(beats) ? '  ·  about ' + readTime(beats) + ' spoken' : '') : '',
      source: hasSavedScript(i) ? (i.script.source === 'ai' ? 'Drafted with ' + (i.script.model || 'AI') : 'Written by hand') + (i.script.updatedAt ? '  ·  ' + relTime(i.script.updatedAt) : '') : legacy ? 'Read from the description. Edit the script to keep it as its own script.' : '',
      edit: () => startScript(), editLabel: beats.length ? 'Edit script' : 'Write script',
      ai: () => startScript({ aiOpen: true }), aiLabel: beats.length ? 'Rewrite with AI' : 'Draft with AI',
      btn: scriptBtn(false), btnP: scriptBtn(true),
      // Edit mode
      beats: scBeats.map((b, n) => ({
        key: n, num: String(n + 1), time: b.time || '', label: b.label || '', text: b.text || '',
        timeLabel: 'Beat ' + (n + 1) + ' start time', labelLabel: 'Beat ' + (n + 1) + ' name', textLabel: 'Beat ' + (n + 1) + ' script',
        onTime: (e) => { const v = scBeats.slice(); v[n] = Object.assign({}, v[n], { time: val(e).replace(/[^\d:]/g, '').slice(0, 8) }); setBeats(v); },
        onLabel: (e) => { const v = scBeats.slice(); v[n] = Object.assign({}, v[n], { label: val(e).slice(0, 80) }); setBeats(v); },
        onText: (e) => { const v = scBeats.slice(); v[n] = Object.assign({}, v[n], { text: val(e).slice(0, 6000) }); setBeats(v); },
        canUp: n > 0, canDown: n < scBeats.length - 1,
        up: () => { if (n === 0) return; const v = scBeats.slice(); [v[n - 1], v[n]] = [v[n], v[n - 1]]; setBeats(v); },
        down: () => { if (n >= scBeats.length - 1) return; const v = scBeats.slice(); [v[n], v[n + 1]] = [v[n + 1], v[n]]; setBeats(v); },
        addBelow: () => { const v = scBeats.slice(); v.splice(n + 1, 0, blankBeat()); setBeats(v); },
        remove: () => { const v = scBeats.filter((x, k) => k !== n); setBeats(v.length ? v : [blankBeat()]); },
        placeholder: n === 0 ? 'The hook. First line out of your mouth, and what is on screen [in brackets].' : 'What is said here, plus any b-roll or on-screen notes [in brackets].',
        labelHint: ['Cold open', 'The problem', 'Why it matters', 'The fix', 'Proof', 'Call to action'][n] || 'Beat ' + (n + 1)
      })),
      addBeat: () => setBeats(scBeats.concat([blankBeat()])),
      draftSummary: scBeats.filter((b) => (b.text || '').trim()).length + (scBeats.filter((b) => (b.text || '').trim()).length === 1 ? ' beat' : ' beats') + (readTime(scBeats) ? '  ·  about ' + readTime(scBeats) + ' spoken' : ''),
      draftSource: sc && sc.source === 'ai' ? 'AI draft from ' + (sc.model || 'the model') + ', not saved yet' : sc && sc.dirty ? 'Unsaved changes' : '',
      save: saveScript, saveLabel: sc && sc.busy && !sc.aiOpen ? 'Saving…' : 'Save script', canSave: !!(sc && sc.dirty && !sc.busy),
      saveStyle: scriptBtn(true) + ' opacity: ' + (sc && sc.dirty && !sc.busy ? '1' : '0.45') + ';',
      discard: () => set({ ideaScript: null }), discardLabel: sc && sc.dirty ? 'Discard changes' : 'Done',
      field: scriptField, timeField: scriptField + ' width: 72px; text-align: center; font-variant-numeric: tabular-nums;', labelField: scriptField + ' flex: 1 1 160px; min-width: 0; font-weight: 700;',
      textField: scriptField + ' width: 100%; min-height: 84px; resize: vertical;',
      iconBtn: 'width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink-3); cursor: pointer;',
      // AI panel
      aiOpen: !!(sc && sc.aiOpen), openAi: () => scSet({ aiOpen: true, err: '' }), closeAi: () => scSet({ aiOpen: false }),
      aiTitle: scBeats.some((b) => (b.text || '').trim()) ? 'Rewrite this script with AI' : 'Draft the script with AI',
      aiHint: 'Uses the title, hook, angle, description, references and the brand voice. The draft lands here for review; nothing is saved until you save it.',
      notes: sc ? sc.notes || '' : '', onNotes: (e) => scSet({ notes: val(e).slice(0, 2000) }),
      lengths: LENGTHS.map((l) => ({ label: l[1], hint: l[2], pressed: sc && sc.length === l[0] ? 'true' : 'false', pick: () => scSet({ length: sc && sc.length === l[0] ? '' : l[0] }),
        style: 'flex: 1 1 120px; display: flex; flex-direction: column; gap: 2px; min-height: 48px; padding: 8px 12px; box-sizing: border-box; border-radius: 12px; text-align: left; letter-spacing: normal; color: var(--ink); cursor: pointer; ' + (sc && sc.length === l[0] ? 'background: var(--surface); border: 1.5px solid var(--ink);' : 'background: var(--surface-2); border: 1px solid var(--border);') })),
      lengthHint: 'Leave the length unpicked to match the idea’s format.',
      generate: generate, generateLabel: sc && sc.busy ? 'Writing…' : 'Generate draft',
      generateStyle: scriptBtn(true) + (sc && sc.busy ? ' opacity: 0.6;' : '')
    };
    const run = i.researchRunId ? (D.researchRuns || []).find((r) => r.id === i.researchRunId) : null;
    const findingByUrl = {};
    (i.findings || []).forEach((f) => { if (f && f.url) findingByUrl[f.url] = f; });
    // Titles and thumbnails for reference links arrive once per URL; the page re-renders when they do.
    A.loadPreviews(i.refs);
    const canCover = ce && !arch;
    const refs = i.refs.map((r) => {
      const u = isUrl(r), h = u ? hostOf(r) : '';
      const f = findingByUrl[r.trim()];
      const pv = u ? previewOf(r) : null;
      const image = (pv && pv.image) || (f && f.thumb) || '';
      const kind = pv && pv.kind === 'video' ? 'video' : f && /youtube|tiktok|vidiq/.test(f.source || '') ? 'video' : pv ? pv.kind : 'note';
      const visual = { image: image, hasImage: !!image, isVideo: kind === 'video', site: pv ? pv.site : '', author: (pv && pv.author) || (f && f.author) || '',
        imgStyle: 'width: 100%; height: 100%; object-fit: cover; display: block;',
        useCover: canCover && image ? () => { A.coverFromUrl(i, image).then((r2) => { if (r2) A.toast('Cover set from the reference.'); }); } : null, useCoverLabel: 'Use as cover' };
      if (f) {
        const src = SOURCES.find((x) => x.id === f.source) || { label: f.source };
        return Object.assign({ title: f.title || (pv && pv.title) || r, meta: [src.label, findingStat(f), f.author ? 'by ' + f.author : ''].filter(Boolean).join('  ·  '), href: r.trim(), isLink: true,
          thumb: 'width: 72px; height: 44px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: ' + TONE.coral[0] + '; color: ' + TONE.coral[1] + ';', thumbText: String(src.label || '').slice(0, 8) }, visual);
      }
      const niceUrl = u ? r.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').slice(0, 80) : r;
      const metaBits = u ? [pv && pv.site && pv.site !== h ? pv.site : h, visual.author ? 'by ' + visual.author : '', kind === 'video' ? 'Video' : kind === 'doc' ? 'Document' : 'Link'] : ['Note'];
      return Object.assign({ title: (pv && pv.title) || niceUrl, meta: metaBits.filter(Boolean).join('  ·  '), href: u ? r.trim() : undefined, isLink: u,
        thumb: 'width: 72px; height: 44px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; ' + (u ? 'background: var(--chip-2); color: var(--ink-3);' : 'background: ' + TONE.amber[0] + '; color: ' + TONE.amber[1] + ';'), thumbText: u ? (h.split('.')[0] || 'link').slice(0, 8) : 'Note' }, visual);
    });
    if (run) refs.push({ title: 'Research run: ' + ((run.inputs || {}).topics || []).join(', ') + ', ' + (run.finding_count || 0) + ' findings', meta: 'Research  ·  ' + relTime(run.created_at), href: undefined, isLink: false, thumb: 'width: 72px; height: 44px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: ' + TONE.coral[0] + '; color: ' + TONE.coral[1] + ';', thumbText: 'Run' });
    const runTag = i.run && (i.run.state === 'running' || i.run.state === 'queued' || i.run.state === 'failed') ? i.run.state : '';
    const TABS = [['overview', 'Overview', ''], ['research', 'Research', runTag || (i.research && i.research.score ? String(i.research.score.total) : '')], ['script', 'Script', beats.length ? String(beats.length) : ''], ['refs', 'References', refs.length ? String(refs.length) : ''], ['comments', 'Comments', i.comments.length ? String(i.comments.length) : ''], ['history', 'History', history.length ? String(history.length) : '']];
    // History filters (Monday's activity log): by kind of change and by person.
    // Stage is checked before research, so "moved Stage to Research" counts as a stage change.
    const kindOf = (h) => (/comment/i.test(h.text) ? 'comments' : /\bstage\b|archiv|restor|approv|promot|convert|added to/i.test(h.text) ? 'stage' : /research|score/i.test(h.text) ? 'research' : 'edits');
    const HIST_KINDS = [['all', 'All'], ['stage', 'Stage'], ['edits', 'Edits'], ['research', 'Research'], ['comments', 'Comments']];
    const hKind = HIST_KINDS.some((k) => k[0] === s.iHistKind) ? s.iHistKind : 'all';
    const histPeople = history.map((h) => h.who).filter((w, k, a) => w && a.indexOf(w) === k).sort((a, b) => (a === 'You' ? -1 : b === 'You' ? 1 : a.localeCompare(b)));
    const hWho = histPeople.indexOf(s.iHistWho) >= 0 ? s.iHistWho : 'all';
    const histShown = history.filter((h) => (hKind === 'all' || kindOf(h) === hKind) && (hWho === 'all' || h.who === hWho));
    const histChips = HIST_KINDS.map((k) => {
      const n = k[0] === 'all' ? history.length : history.filter((h) => kindOf(h) === k[0]).length;
      return { key: k[0], label: k[1], count: String(n), pressed: hKind === k[0] ? 'true' : 'false', pick: () => set({ iHistKind: k[0] }),
        style: 'display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; box-sizing: border-box; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 500; letter-spacing: normal; white-space: nowrap; ' + (hKind === k[0] ? 'background: var(--chip-2); border: 1.5px solid var(--ink); color: var(--ink);' : 'background: transparent; border: 1px solid var(--border); color: var(--ink-3);') };
    });
    histWhoOpts = [['all', 'Everyone']].concat(histPeople.map((w) => [w, w]));
    histWhoCur = hWho;
    // Previous and next follow the order of the current view (J and K do the same).
    // In a grouped list the order is the groups as shown, skipping collapsed ones.
    const navList = layout === 'board' ? boardOrder : groups ? groups.filter((g) => !g.collapsed).flatMap((g) => g.rows) : shown;
    const at = navList.findIndex((x) => x.id === i.id);
    const fullView = s.ideaFull !== undefined ? !!s.ideaFull : !!prefs.ideaFull;
    const step = (d) => (at < 0 || !navList[at + d] ? null : () => set({ ideaOpen: navList[at + d].id, ideaEdit: null, ideaConfirm: '', ideaDraft: '', ideaGate: null, ddOpen: '', ideaTab: 'overview', ideaInline: null, iDlgMenu: '', iDlgField: '' }));
    const tab = TABS.some((t) => t[0] === s.ideaTab) ? s.ideaTab : 'overview';
    const btnG = 'display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; letter-spacing: normal; cursor: pointer;';
    const acts = [];
    if (ce && !arch) acts.push({ label: 'Edit', icon: 'edit', style: btnG, pick: startEdit });
    if (canApprove && !arch && i.status === 'Approved' && locked(i)) {
      convertOptions(i).forEach((t) => acts.push({
        label: t.key === 'project' ? 'Add to In Production' : 'Create ' + t.label.toLowerCase(),
        pick: () => { set({ iDlgMenu: '' }); return runConvert(i, t.key); }
      }));
    }
    if (project && i.coverPath && canApprove && !arch && !(D.assets[i.projectId] || []).some((a) => a.source_idea_id === i.id)) {
      acts.push({ label: 'Retry asset transfer', pick: approve });
    }
    if (canCreate && auth.indexOf(i.brand) >= 0) acts.push({ label: 'Duplicate', icon: 'copy', style: btnG, pick: () => {
      const brand = brandOf(i.brand);
      A.createIdea({ titleOptions: i.titleOptions || [], thumbnailBrief: i.thumbnailBrief || '', title: i.title + ' (copy)', brandId: brand.id, type: i.type, body: i.body, hook: D.ideas.find((x) => x.id === i.id).hook || '', tags: i.tags, refs: i.refs, format: i.format, pillar: i.pillar, audience: i.audience, promise: i.promise, platforms: i.platforms, ice: i.score != null ? i.ice : undefined, priority: i.priority, effort: i.effort, window: i.window, sponsorId: i.sponsorId, coverMode: i.coverPath ? 'hook' : i.coverMode, highlight: i.highlight, hookPos: i.hookPos })
        .then((id) => { if (id) { set({ ideaOpen: id, ideaTab: 'overview' }); A.toast('Duplicated. The copy starts in Inbox.'); } }).catch((err) => A.toast(err.message));
    } });
    // Place the idea off the stage lanes: On Hold, Parked, or Archived (two clicks).
    const holdLane = SIDE.find((c) => c.kind === 'hold') || null;
    if (ce && !arch && !locked(i) && holdLane && i.boardColumnId !== holdLane.id) acts.push({ label: 'Put on hold', icon: 'archive', style: btnG, pick: () => { set({ iDlgMenu: '' }); toSide(i, holdLane.id); } });
    if (ce && !arch && !locked(i) && !i.parkedAt) acts.push({ label: 'Park', icon: 'archive', style: btnG, pick: () => { set({ iDlgMenu: '' }); park(i); } });
    if (ce && !arch) { const asking = s.ideaConfirm === 'archive:' + i.id; acts.push({ label: asking ? 'Confirm archive' : 'Archive', icon: 'archive', style: btnG, pick: () => { if (asking) { set({ iDlgMenu: '' }); commit({ status: 'Archived' }, 'archived the idea'); } else set({ ideaConfirm: 'archive:' + i.id }); } }); }
    if (ce && arch) acts.push({ label: 'Restore to ' + laneOf(i.stage || 'Inbox').label, icon: 'restore', style: btnG, pick: () => { set({ iDlgMenu: '' }); commit({ status: i.stage || 'Inbox' }, 'restored the idea'); } });
    if ((role === 'admin' || (role === 'manager' && me.perms.has('ideas:delete'))) && arch) {
      const confirm = s.ideaConfirm === i.id;
      acts.push({ label: confirm ? 'Confirm permanent delete' : 'Delete permanently', icon: 'trash', style: btnG + ' color: var(--red-ink);' + (confirm ? ' background: var(--red-soft); border-color: transparent;' : ''),
        pick: () => { if (confirm) { set({ ideaConfirm: '', ideaOpen: '' }); A.deleteIdea(i); } else set({ ideaConfirm: i.id }); } });
    }
    const note = !ce ? (role === 'designer' ? 'You can comment here. Only the creator or a Super Admin can edit this idea.' : 'You can comment here. Editing is limited for this idea.') : arch ? 'Archived ideas are hidden from the default views. Restore to edit again.' : '';
    const bn = banner(i, 'detail');
    const ready = gateChecklist(i, 'ready', rules).map((x) => [x.label, x.on]);
    const scored = i.research && i.research.score ? i.research.score : null;
    const canScore = canEditI(i) && !arch;
    const REC_LABEL = { pursue: 'Pursue', park: 'Park', drop: 'Drop' };
    const runInfo = i.run;
    const runSecs = runInfo && runInfo.started_at && runInfo.finished_at ? Math.max(1, Math.round((Date.parse(runInfo.finished_at) - Date.parse(runInfo.started_at)) / 1000)) : null;
    const runLine = !runInfo ? 'No research yet.' : runInfo.state === 'queued' ? 'Queued. It starts within a minute.' : runInfo.state === 'running' ? 'Researching…' : runInfo.state === 'canceled' ? 'Canceled.' : runInfo.state === 'failed' ? 'Failed.'
      : ['Done', runInfo.model, runInfo.cost_usd != null ? 'about $' + Number(runInfo.cost_usd).toFixed(3) : '', runSecs != null ? runSecs + 's' : ''].filter(Boolean).join('  ·  ');
    const rec = scored ? REC_LABEL[recommendationFor(scored.total, rules.recommendation)] : '';
    const researchTab = {
      status: runLine, error: runInfo && runInfo.state === 'failed' ? runInfo.error || 'The run failed.' : '', active: isActiveRun(runInfo), canRun: canResearchIdea(i),
      runLabel: i.research ? 'Re-run' : 'Run research', onRun: () => A.runIdeaResearch(i), onCancel: () => A.cancelIdeaResearch(i),
      result: !i.research ? null : {
        summary: i.research.summary, findings: i.research.findings, nextSteps: i.research.next_steps, recommendation: rec,
        why: scored ? 'Scored ' + scored.total + ' of 100. Pursue starts at ' + rules.recommendation.pursue + ' and Park at ' + rules.recommendation.park + '.' + (scored.overridden ? ' Adjusted by hand from ' + scored.ai_total + '.' : '') : '',
        rows: scored ? Object.entries(scored.by).map(([key, v]) => ({ key: key, label: v.label, score: v.score, weight: v.weight, reason: v.reason })) : [],
        sources: i.research.sources.map((x) => ({ title: x.title, url: x.url, domain: hostOf(x.url), snippet: x.snippet })),
      },
    };
    const KIND_LABEL = Object.fromEntries(CONVERT_TARGETS.map((t) => [t.key, t.label]));
    const canNav = role === 'admin' || role === 'manager';
    const conversions = (i.converted || []).map((x) => ({
      text: (KIND_LABEL[x.kind] || 'Item') + ': ' + x.label,
      open: x.kind === 'project' ? (project && project.id === x.id ? () => set({ ideaOpen: '', nav: 'projects', openJob: project.job, dTab: 'overview' }) : null)
        : !canNav ? null : () => set({ ideaOpen: '', nav: x.kind === 'social' ? 'content' : 'daily', targetContent: x.kind === 'social' ? x.id : '', targetTask: x.kind === 'task' ? x.id : '', todos: x.kind === 'task' })
    }));
    const hasDraft = !!(s.ideaDraft || '').trim();
    const post = () => { const t = (s.ideaDraft || '').trim(); if (!t) return; set({ ideaDraft: '' }); A.commentIdea(i, t); };
    // ---------- Idea detail dialog (handoff § IdeaDetailDialog) ----------
    const side = sideOf(i), parkedNow = isParked(i);
    const lane = laneOf(arch ? 'Archived' : parkedNow ? 'Parked' : side ? 'lane:' + side.id : i.status);
    const rawHook = (D.ideas.find((x) => x.id === i.id) || {}).hook || '';
    const rk = runOf(i);
    const RUN_NAME = { queued: 'Queued', running: 'Running', complete: 'Complete', failed: 'Failed', none: 'No run yet' };
    const missingFor = (to) => {
      const from = ORDER.indexOf(i.status), at = ORDER.indexOf(to);
      const list = [];
      if (from < 1 && at >= 1) gateChecklist(i, 'research', rules).forEach((c) => { if (!c.on) list.push(c.label); });
      if (at >= 2) gateChecklist(i, 'ready', rules).forEach((c) => { if (!c.on && list.indexOf(c.label) < 0) list.push(c.label); });
      return list;
    };
    const hintFor = (to) => { const m = missingFor(to); return m.length ? 'Still needed: ' + m.join(', ') : ''; };
    const foot = [];
    const fbtn = (label, pick, primary, extra) => Object.assign({ label: label, pick: pick, primary: !!primary, disabled: false, hint: '' }, extra || {});
    if (ce && arch) foot.push(fbtn('Restore to ' + laneOf(i.stage || 'Inbox').label, () => { set({ ideaGate: null }); unarchive(i); }, true));
    else if (ce && parkedNow) foot.push(fbtn('Move back to In Development', () => { set({ ideaGate: null }); restore(i); }, true));
    else if (ce && side && !locked(i)) {
      // A side lane pauses the idea at its stage; resuming returns it to the workflow.
      if (i.status === 'Inbox') foot.push(fbtn('Resume development', () => advance('Research'), true, { disabled: !!missingFor('Research').length, hint: hintFor('Research') }));
      else if (i.status === 'Research') foot.push(fbtn('Resume development', () => move(i.id, 'Research'), true));
      else foot.push(fbtn('Back to ' + laneOf(i.status).label, () => move(i.id, i.status), true));
    } else if (ce && !locked(i)) {
      if (i.status === 'Inbox') {
        foot.push(fbtn('Start development', () => advance('Research'), true, { disabled: !!missingFor('Research').length, hint: hintFor('Research') }));
        foot.push(fbtn('Send to review', () => advance('Ready'), false, { disabled: !!missingFor('Ready').length }));
      } else if (i.status === 'Research') {
        foot.push(fbtn('Send to review', () => advance('Ready'), true, { disabled: !!missingFor('Ready').length, hint: hintFor('Ready') }));
      } else if (i.status === 'Ready') {
        if (canApprove) foot.push(fbtn(s.ideaApproving ? 'Approving…' : 'Approve', tryApprove, true, { disabled: !!s.ideaApproving }));
        foot.push(fbtn('Return to development', () => commit({ status: 'Research', boardColumnId: '' }, 'returned the idea to In Development'), !canApprove));
        foot.push(fbtn('Park', () => park(i)));
      } else if (i.status === 'Approved') {
        if (canApprove && convertOptions(i).length) foot.push(fbtn(s.ideaApproving ? 'Converting…' : convertOptions(i).length === 1 && convertOptions(i)[0].key === 'project' ? 'Convert to project' : 'Convert', () => startConvert(i), true, { disabled: !!s.ideaApproving }));
        if (holdLane) foot.push(fbtn('Put on hold', () => toSide(i, holdLane.id)));
      }
    }
    if (i.projectId && project) foot.unshift(fbtn('Open project', () => set({ ideaOpen: '', nav: 'projects', openJob: project.job, dTab: 'overview' }), true));
    else if (i.projectId) foot.unshift(fbtn('Converted to project', () => {}, true, { disabled: true }));
    // Only one primary: the first.
    foot.forEach((b, n) => { if (n > 0) b.primary = false; });
    const NEXT_TEXT = {
      Inbox: 'Choose to develop it, request research, or send a clear pitch straight to review.',
      Research: 'Sharpen the hook and audience, or give research one specific question. Send it to review when the pitch is ready.',
      Ready: 'Approve it, return it to development with a question, or park it for later.',
      Approved: 'Hand the pitch and its research to scripting or production.',
      Parked: 'Parked for later. Move it back to development to pick it up.',
      Archived: 'Archived. Restore it to work on it again.'
    };
    const nextText = arch ? NEXT_TEXT.Archived : parkedNow ? NEXT_TEXT.Parked : side ? (side.kind === 'hold' ? 'Paused. Resume development once it is unblocked.' : 'In ' + side.label + '. Move it back to a workflow stage to keep going.') : NEXT_TEXT[i.status] || '';
    const band = i.score == null ? '' : i.score >= pursueAt ? 'Strong' : i.score >= parkAt ? 'Fair' : 'Weak';
    const bandStyle = i.score == null ? '' : i.score >= pursueAt ? 'background: var(--green-soft); color: var(--green-ink);' : i.score >= parkAt ? 'background: var(--amber-soft); color: var(--amber-ink);' : 'background: var(--red-soft); color: var(--red-ink);';
    const stIx = arch ? ORDER.indexOf(i.stage) : ix;
    const ownerName = who(i.ownerId, i.owner) === 'You' ? me.name : i.owner;
    // Inline fields save when they lose focus; the draft lives in s.ideaInline so typing stays local until then.
    const inl = s.ideaInline && s.ideaInline.id === i.id ? s.ideaInline : { id: i.id };
    const inlineField = (key, label, placeholder, multi, o) => {
      o = o || {};
      const cur = o.cur !== undefined ? o.cur : key === 'body' ? i.body.join('\n\n') : i[key] || '';
      const v = inl[key] !== undefined ? inl[key] : cur;
      const clip = (t) => { const one = multi ? t : t.replace(/\s*\n\s*/g, ' '); return o.max ? one.slice(0, o.max) : one; };
      return {
        key: key, id: 'idf-' + key, label: label, value: v, placeholder: placeholder, multi: !!multi, empty: !String(v).trim(), canEdit: ce && !arch,
        max: o.max || undefined, count: o.max ? String(v).length + '/' + o.max : '',
        onChange: (e) => set({ ideaInline: Object.assign({}, inl, { [key]: clip(val(e)) }) }),
        onBlur: () => {
          if (inl[key] === undefined) return;
          const next = String(inl[key]);
          const rest = Object.assign({}, inl); delete rest[key];
          set({ ideaInline: rest });
          if (inlineCancel || next.trim() === String(cur).trim()) return;
          if (o.required && !next.trim()) return A.toast(label + ' cannot be empty.');
          A.updateIdea(i, key === 'body' ? { body: paras(next) } : { [key]: next.trim() }, 'edited ' + label);
        }
      };
    };
    // A dropped or picked image becomes the cover at once: it shows on every card while it uploads in the background.
    const dropCover = canCover ? (file) => {
      const r = takeImage(file);
      if (!r) return;
      if (r.url) { try { URL.revokeObjectURL(r.url); } catch { /* nothing to free */ } }
      if (r.err) return A.toast(r.err);
      A.setIdeaCover(i, r.file);
      A.toast('Cover updated. It is uploading in the background.');
    } : null;
    const bnE = banner(i, 'edit');
    const setProp = (p, text) => A.updateIdea(i, p, text);
    const detailRows = [
      ['Stage', laneOf(arch ? i.stage || 'Inbox' : i.status).label, true]].concat(arch || parkedNow || side ? [['Board', lane.label, true]] : [], [['Idea origin', originOf(i) === 'ai' ? 'AI-generated' : 'Manual', true], ['Research run', RUN_NAME[rk], rk !== 'none'],
      ['Brand', i.brand || 'No brand', !!i.brand], ['Owner', ownerName || 'Unassigned', !!ownerName, 'idOwner'], ['Priority', i.priority ? 'P' + i.priority : 'Not set', !!i.priority, 'idPri'],
      ['Format', i.format || 'Not set', !!i.format, 'idFormat'],
      ['Platforms', i.platforms.length ? i.platforms.join(', ') : 'None picked', i.platforms.length > 0, 'platforms'], ['Effort', i.effort || 'Not set', !!i.effort, 'idEffort'],
      ['Target window', windowLabel(i.window) || 'No window yet', !!i.window, 'idWindow'], ['Sponsor fit', sponsorName(i.sponsorId) || 'None', !!sponsorName(i.sponsorId), 'idSponsor'],
      ['Cover', i.coverPath ? 'Set' : 'Missing', !!i.coverPath]
    ]);
    const platOpen = s.iDlgField === 'platforms:' + i.id;
    const dlg = {
      laneLabel: lane.label, laneColor: lane.color, kicker: rawHook && i.title.toLowerCase().indexOf(rawHook.toLowerCase()) < 0 ? '“' + rawHook + '”' : '', hook: rawHook || 'No hook yet', hookSet: !!rawHook,
      // The resized copy (already cached from the card) shows at once; the full file paints over it when it lands.
      cover: i.coverUrl ? 'background: ' + [i.coverUrl, i.coverThumb].filter((u, k, a) => u && a.indexOf(u) === k).map((u) => 'url("' + String(u).replace(/["\\)]/g, '') + '") ' + i.focal[0] + '% ' + i.focal[1] + '% / cover no-repeat').join(', ') + ' #222222;' : '',
      ai: originOf(i) === 'ai', originLabel: originOf(i) === 'ai' ? 'AI-generated' : 'Manual',
      run: rk !== 'none' ? { key: rk, label: rk === 'running' ? 'Research running' : rk === 'queued' ? 'Research queued' : rk === 'complete' ? 'Research complete' : 'Research failed',
        style: rk === 'running' ? 'background: var(--blue-soft); color: var(--blue-ink);' : rk === 'complete' ? 'background: var(--green-soft); color: var(--green-ink);' : rk === 'failed' ? 'background: var(--red-soft); color: var(--red-ink);' : 'background: var(--chip-2); color: var(--ink-3);' } : null,
      brandColor: BCOL[i.brand] || 'var(--muted-2)', ownerName: ownerName || 'Unassigned', ownerIni: ini(ownerName) || '?',
      progress: LANES.map((l, n) => ({ key: l.key, label: l.tab, on: stIx >= 0 && n <= stIx, current: n === stIx && !arch, color: l.color })),
      extraChip: arch ? 'Archived' : parkedNow ? 'Parked' : side ? side.label : '',
      inline: [inlineField('audience', 'Who it is for', 'Name the audience'), inlineField('promise', 'Viewer walks away with', 'Add the takeaway')],
      titleField: inlineField('title', 'Title', 'Untitled idea', false, { required: true, max: 200 }),
      hookField: inlineField('hook', 'Hook', 'No hook yet. Up to 24 characters for the banner.', false, { cur: rawHook, max: 24 }),
      // No image yet: the brand color banner the cards show stands in, so the drop target is always there.
      dlgBanner: { style: bnE.style, showHook: bnE.showHook, hookStyle: bnE.hookStyle, hiStyle: bnE.hiStyle, hookHi: bnE.hookHi, hookRest: bnE.hookRest },
      dropCover: dropCover, editBanner: canCover ? () => startEdit() : null, coverBusy: !!(A.ideaCoverUploading && A.ideaCoverUploading(i.id)),
      // The banner buttons keep clear of a hook drawn on the brand color: top right unless the hook sits at the top.
      ctlTop: !i.coverUrl && bnE.showHook && i.hookPos !== 'top',
      platOpen: platOpen, togglePlat: () => set({ iDlgField: platOpen ? '' : 'platforms:' + i.id, ddOpen: '' }), closePlat: () => set({ iDlgField: '' }),
      platOpts: PLATFORMS.concat(i.platforms.filter((p) => PLATFORMS.indexOf(p) < 0)).map((p) => ({ label: p, on: i.platforms.indexOf(p) >= 0, pick: () => setProp({ platforms: toggle(i.platforms, p) }, 'changed Platforms') })),
      concept: inlineField('body', 'Concept', 'No concept notes yet. Add the angle, the format and what makes it worth making.', true),
      foot: foot, gate: s.ideaGate && s.ideaGate.id === i.id ? s.ideaGate.text : '',
      nextText: nextText,
      showChecklist: !arch && !parkedNow && (i.status === 'Inbox' || i.status === 'Research') && ready.length > 0,
      band: band, bandStyle: bandStyle, recWord: scored || i.score != null ? REC_NAME[recOf(i)] || '' : '',
      details: detailRows.map((r) => ({ label: r[0], value: r[1], set: r[2], pick: ce && !arch && r[3] ? r[3] : '' })),
      canEditIdea: ce && !arch, edit: () => startEdit(), scoreManually: canScore ? () => startEdit() : null,
      menuOpen: s.iDlgMenu === i.id, toggleMenu: () => set({ iDlgMenu: s.iDlgMenu === i.id ? '' : i.id }), closeMenu: () => set({ iDlgMenu: '', ideaConfirm: '' }),
      researchState: rk, runCount: rk === 'running' ? 'running' : rk === 'queued' ? 'queued' : rk === 'failed' ? 'failed' : '',
      stats: { views: viewsOf(i) ? kFmt(viewsOf(i)) : '–', sources: String(sourcesOf(i)) },
      tabKeys: ['overview', 'research', 'script', 'refs', 'comments', 'history']
    };
    Object.assign(researchTab, { state: rk, views: viewsOf(i) ? kFmt(viewsOf(i)) : '–', sourceCount: String(sourcesOf(i)), retryLabel: rk === 'failed' ? 'Retry run' : i.research ? 'Run again' : 'Run research' });
    detail = {
      bannerStyle: bn.style, showHook: bn.showHook, hookStyle: bn.hookStyle, hiStyle: bn.hiStyle, hookHi: bn.hookHi, hookRest: bn.hookRest,
      pri: 'P' + i.priority, isImg: bn.isImg, canCover: canCover, changeCover: () => startEdit(), canGenCover: canCover && imgAiOn, genCover: () => startEdit({ aiOpen: true }),
      visualRefs: refs.filter((r) => r.hasImage), plainRefs: refs.filter((r) => !r.hasImage),
      brand: i.brand, brandInitials: ini(i.brand), brandTile: brandTile(28),
      type: i.type, typeStyle: typeBlock(i.type, 24), status: i.status, statusStyle: statusBlock(i.status, 24),
      meta: [i.format, i.pillar].filter(Boolean), metaStyle: softBlock,
      title: i.title,
      byline: 'Created by ' + (i.byId === me.id ? 'you' : i.by) + ' on ' + i.date + '  ·  Updated ' + relTime(i.updatedAt),
      titleOptions: i.titleOptions || [], thumbnailBrief: i.thumbnailBrief || '',
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
      isOverview: tab === 'overview', isComments: tab === 'comments', isResearch: tab === 'research', research: researchTab, isScript: tab === 'script', isRefs: tab === 'refs', isHistory: tab === 'history',
      histChips: histChips, histShown: histShown, histEmpty: histShown.length === 0, histFiltered: hKind !== 'all' || hWho !== 'all',
      clearHist: () => set({ iHistKind: 'all', iHistWho: 'all' }),
      full: fullView, fullLabel: fullView ? 'Show as side panel' : 'Expand to full view',
      toggleFull: () => { set({ ideaFull: !fullView }); A.savePrefs({ ideaFull: !fullView }); },
      prev: step(-1), next: step(1), pos: at >= 0 ? (at + 1) + ' of ' + navList.length : '',
      hasAngle: !!(i.audience || i.promise), audience: i.audience || 'Not set yet', promise: i.promise || 'Not set yet',
      audStyle: 'font-size: 15px; font-weight: 600; line-height: 1.4; color: ' + (i.audience ? 'var(--ink)' : 'var(--muted)') + ';',
      promStyle: 'font-size: 15px; font-weight: 600; line-height: 1.4; color: ' + (i.promise ? 'var(--ink)' : 'var(--muted)') + ';',
      paras: i.body, noBody: i.body.length === 0, tags: i.tags,
      beats: beats, noBeats: beats.length === 0, script: script, refs: refs, noRefs: refs.length === 0, history: history,
      comments: i.comments.map((cm) => ({ who: cm.who, time: cm.time, text: cm.text, initials: cm.who.slice(0, 1).toUpperCase(), avatarStyle: 'width: 32px; height: 32px; flex: none; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #FFFFFF; background: ' + actColor(cm.who) + ';' })),
      noComments: i.comments.length === 0, canComment: !arch,
      draft: s.ideaDraft || '', onDraft: (e) => set({ ideaDraft: val(e) }), post: post,
      onDraftKey: (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post(); } },
      postStyle: 'flex: none; min-height: 42px; padding: 0 16px; border: 0; border-radius: 12px; background: var(--inv); color: var(--inv-ink); font-size: 14px; font-weight: 600; letter-spacing: normal; cursor: pointer; opacity: ' + (hasDraft ? '1' : '0.45') + ';',
      score: fmtScore(i.score), scoreTag: scored ? REC_LABEL[recommendationFor(scored.total, rules.recommendation)] : scoreTag(i.score), scoreTagStyle: tagPill(i.score), scored: i.score != null,
      scoreHeading: scored ? 'Score' : 'ICE score', scoreRows: scored ? Object.entries(scored.by).map(([key, v]) => ({ key: key, label: v.label, score: v.score })) : null, scoreOverridden: !!(scored && scored.overridden),
      canScore: canScore, onScore: (key, value) => commit({ research: overrideScore(i.research, key, value) }, 'adjusted the score'),
      clearScore: canScore && (scored || iceTotal(i.ice) != null) ? () => commit(Object.assign({ ice: [null, null, null] }, scored ? { research: Object.assign({}, i.research, { score: null }) } : {}), 'cleared the score') : null,
      iceBars: scored ? [] : ICE_DEF.map((k, n) => ({ label: k[0], value: i.ice[n] == null ? '–' : String(i.ice[n]), bar: 'display: block; width: ' + ((i.ice[n] || 0) * 10) + '%; height: 100%; border-radius: 999px; background: var(--ink);' })),
      owner: who(i.ownerId, i.owner), ownerIni: ini(who(i.ownerId, i.owner) === 'You' ? me.name : i.owner) || '?',
      priFlat: priFlat(i.priority), effort: i.effort || 'Not set', effortSet: !!i.effort,
      platforms: i.platforms, noPlatforms: i.platforms.length === 0,
      window: windowLabel(i.window) || 'No window yet', windowSet: !!i.window,
      sponsor: sponsorName(i.sponsorId) || 'None', sponsorSet: !!sponsorName(i.sponsorId),
      source: i.source === 'research' ? 'Research run' : 'Manual',
      conversions: conversions, noConversions: conversions.length === 0,
      addConversion: i.status === 'Approved' && locked(i) && canApprove && convertOptions(i).length ? () => startConvert(i) : null,
      gateError: s.ideaGate && s.ideaGate.id === i.id ? s.ideaGate.text : '',
      ready: checks(ready), readyLabel: ready.filter((r) => r[1]).length + ' of ' + ready.length
    };
    Object.assign(detail, dlg);
  }

  // ---------- Edit view ----------
  if (sel && ed) {
    const i = sel;
    const upd = (p) => set({ ideaEdit: Object.assign({}, ed, { confirmClose: false, err: '' }, p) });
    const orig = { brandId: i.brandId, titleOptions: (i.titleOptions || []).join('\n'), thumbnailBrief: i.thumbnailBrief || '', title: i.title, hook: D.ideas.find((x) => x.id === i.id).hook || '', type: i.type, pillar: i.pillar, audience: i.audience, promise: i.promise, body: i.body.join('\n\n'), tags: i.tags, refs: i.refs, ice: i.score != null ? i.ice : null, ownerId: i.ownerId || me.id, priority: i.priority, format: i.format, platforms: i.platforms, effort: i.effort, window: i.window, sponsorId: i.sponsorId, coverMode: i.coverMode, coverGone: false, focal: i.focal, highlight: i.highlight, hookPos: i.hookPos };
    const draftRefs = ed.refs.map((r) => r.trim()).filter(Boolean);
    const now2 = { brandId: ed.brandId, titleOptions: ed.titleOptions, thumbnailBrief: ed.thumbnailBrief, title: ed.title, hook: ed.hook, type: ed.type, pillar: ed.pillar, audience: ed.audience, promise: ed.promise, body: paras(ed.body).join('\n\n'), tags: ed.tags, refs: draftRefs, ice: ed.iceSet ? ed.ice : null, ownerId: ed.ownerId, priority: ed.priority, format: ed.format, platforms: ed.platforms, effort: ed.effort, window: ed.window, sponsorId: ed.sponsorId, coverMode: ed.coverMode, coverGone: !ed.file && !ed.coverPath && !!i.coverPath, focal: ed.focal, highlight: ed.highlight, hookPos: ed.hookPos };
    const dirty = !!ed.file || JSON.stringify(orig) !== JSON.stringify(now2);
    const close = () => set({ ideaEdit: null });
    // Esc, the X and the backdrop close at once when nothing changed. With changes they ask first, and asking again
    // never throws the work away: only Discard changes does. Esc on the question goes back to editing.
    const requestClose = () => { if (!dirty) close(); else if (!ed.confirmClose) set({ ideaEdit: Object.assign({}, ed, { confirmClose: true }) }); };
    // The X and the backdrop leave the idea altogether when nothing changed, as they do on the details view.
    const closeAll = () => { if (!dirty) set({ ideaEdit: null, ideaOpen: '', ideaConfirm: '' }); else requestClose(); };
    const eSide = sideOf(i), eLane = laneOf(i.status === 'Archived' ? 'Archived' : isParked(i) ? 'Parked' : eSide ? 'lane:' + eSide.id : i.status);
    const keepEditing = () => upd({});
    const patchEd = (p) => set((prev) => (prev.ideaEdit && prev.ideaEdit.id === i.id ? { ideaEdit: Object.assign({}, prev.ideaEdit, p) } : {}));
    // Saves the text first (one write, so it is quick), then lets the cover upload in the background: every card
    // already shows the new picture, and a failed upload offers Retry. stay (Cmd/Ctrl+S) keeps the editor open;
    // the Save button closes it. Typing during the save is kept.
    const save = async (stay) => {
      stay = stay === true;
      if (ed.busy || savingIdeas.has(i.id)) return;
      if (!dirty) { if (!stay) close(); return; }
      const title = (ed.title || '').trim();
      if (!title) return upd({ err: 'Give the idea a title.' });
      savingIdeas.add(i.id);
      const file = ed.file;
      patchEd({ busy: true, err: '', confirmClose: false });
      const p = { brandId: ed.brandId, brand: (D.brands.find(b => b.id === ed.brandId) || {}).name, titleOptions: (ed.titleOptions || '').split('\n').map(t => t.trim()).filter(Boolean), thumbnailBrief: ed.thumbnailBrief || '', title: title, hook: (ed.hook || '').trim(), type: ed.type, pillar: ed.pillar, audience: (ed.audience || '').trim(), promise: (ed.promise || '').trim(),
        body: paras(ed.body), tags: ed.tags, refs: draftRefs, ownerId: ed.ownerId, priority: ed.priority, format: ed.format, platforms: ed.platforms, effort: ed.effort,
        window: ed.window, sponsorId: ed.sponsorId, coverMode: ed.coverMode, focal: ed.focal, highlight: ed.highlight, hookPos: ed.hookPos };
      if (ed.iceSet) p.ice = ed.ice;
      else if (i.ice.some((n) => n != null)) p.ice = [null, null, null];
      if (!file && !ed.coverPath && i.coverPath) p.coverPath = '';
      if (file) A.stageCover(i.id, file);
      let ok = false;
      try { ok = await A.updateIdea(i, p, 'edited the idea'); } finally { savingIdeas.delete(i.id); }
      if (!ok) {
        if (file) A.unstageCover(i.id);
        return patchEd({ busy: false, err: 'Your changes were not saved. Check the message above and try again.' });
      }
      if (file) A.setIdeaCover(Object.assign({}, i, p), file, { coverMode: ed.coverMode === 'hook' ? 'both' : ed.coverMode, focal: ed.focal });
      if (stay) {
        set((prev) => (prev.ideaEdit && prev.ideaEdit.id === i.id ? { ideaEdit: Object.assign({}, prev.ideaEdit, { busy: false, savedAt: Date.now(), file: prev.ideaEdit.file === file ? null : prev.ideaEdit.file }) } : {}));
        return;
      }
      close();
      A.toast(file ? 'Changes saved. The new cover is uploading.' : 'Changes saved.');
    };
    const take = (e) => {
      const f = fileOf(e);
      const r = takeImage(f);
      if (!r) return upd({ drag: false });
      if (r.err) return upd({ drag: false, err: r.err });
      upd({ file: r.file, coverUrl: r.url, drag: false, coverMode: ed.coverMode === 'hook' ? 'both' : ed.coverMode, focal: [50, 50] });
    };
    const bn = banner(Object.assign({}, i, { hook: ed.hook || hookOf(Object.assign({}, i, { hook: '', title: ed.title })), coverMode: ed.coverMode, coverUrl: ed.coverUrl, coverThumb: ed.coverUrl === i.coverUrl ? i.coverThumb : '', focal: ed.focal, highlight: ed.highlight, hookPos: ed.hookPos, status: 'Inbox' }), 'edit');
    const hasImg = !!ed.coverUrl;
    const coverBusy = A.ideaCoverUploading(i.id);
    const addTag = () => { const v = String(ed.tagDraft || '').trim().replace(/^#?/, '#').toLowerCase(); if (v.length > 1 && ed.tags.indexOf(v) < 0) upd({ tags: ed.tags.concat([v]), tagDraft: '' }); else upd({ tagDraft: '' }); };
        const sc = ed.iceSet ? iceTotal(ed.ice) : null;
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
      hint: hasImg ? 'Click to set the focal point  ·  drop an image to replace' : 'Drop an image to add a cover',
      laneLabel: eLane.label, laneColor: eLane.color, closeAll: closeAll, canSave: dirty && !ed.busy,
      removeImg: () => upd({ file: null, coverUrl: '', coverPath: '', coverMode: 'hook' }),
      covers: [['hook', 'Brand color'], ['image', 'Image'], ['both', 'Image + hook']].map((x) => ({ label: x[1], pressed: ed.coverMode === x[0] ? 'true' : 'false', style: seg(ed.coverMode === x[0], true), pick: () => upd({ coverMode: x[0] }) })),
      // AI cover: the server generates from the title, hook and angle, stores the file and saves it to the idea at once.
      aiOpen: !!ed.aiOpen, aiOn: imgAiOn, aiBusy: !!ed.aiBusy, toggleAi: () => upd({ aiOpen: !ed.aiOpen }),
      aiPressed: ed.aiOpen ? 'true' : 'false',
      aiSetup: imgAiOn ? '' : 'Connect OpenAI or Gemini in Integrations to generate covers. Claude only writes text.',
      aiStyles: COVER_STYLES.map((x) => ({ label: x[1], pressed: ed.aiStyle === x[0] ? 'true' : 'false', style: seg(ed.aiStyle === x[0], true), pick: () => upd({ aiStyle: x[0] }) })),
      aiPrompt: ed.aiPrompt || '', onAiPrompt: (e) => upd({ aiPrompt: val(e).slice(0, 400) }),
      aiLabel: ed.aiBusy ? 'Generating…' : hasImg ? 'Generate a new cover' : 'Generate cover',
      aiHint: ed.aiBusy ? 'Usually 10 to 30 seconds. The idea title, hook and angle shape the image; text is left off so the hook stays readable.' : 'Generated covers save to the idea right away, with the focal point reset to the middle.',
      aiStyle: 'min-height: 40px; padding: 0 16px; border: 0; border-radius: 12px; background: var(--inv); color: var(--inv-ink); font-size: 13px; font-weight: 600; cursor: ' + (ed.aiBusy || !imgAiOn ? 'default' : 'pointer') + '; opacity: ' + (ed.aiBusy || !imgAiOn ? '0.6' : '1') + ';',
      generate: () => {
        if (ed.aiBusy || !imgAiOn) return;
        upd({ aiBusy: true, aiErr: '' });
        A.generateCover(i, { style: ed.aiStyle || 'photo', prompt: (ed.aiPrompt || '').trim() }).then((r) => {
          const ok = r && !r.error;
          set((prev) => prev.ideaEdit && prev.ideaEdit.id === i.id ? { ideaEdit: Object.assign({}, prev.ideaEdit, { aiBusy: false, aiErr: ok ? '' : (r && r.error) || 'The cover could not be made.' }, ok ? { file: null, coverUrl: r.url, coverPath: r.path, coverMode: r.coverMode || (prev.ideaEdit.coverMode === 'hook' ? 'both' : prev.ideaEdit.coverMode), focal: [50, 50] } : {}) } : {});
          if (ok) A.toast('Cover generated' + (r.model ? ' with ' + r.model : '') + '.');
        });
      },
      aiErr: ed.aiErr || '', hasAiErr: !!ed.aiErr,
      highlights: HIGHLIGHTS.map((h) => ({ label: h[1], pressed: ed.highlight === h[0] ? 'true' : 'false', pick: () => upd({ highlight: h[0] }),
        style: 'width: 32px; height: 32px; flex: none; padding: 0; border-radius: 999px; cursor: pointer; ' + (h[0] === 'none' ? 'background: repeating-linear-gradient(135deg, #FFFFFF 0 4px, #E0E0E0 4px 8px);' : 'background: ' + h[0] + ';') + (ed.highlight === h[0] ? ' border: 2px solid var(--ink); box-shadow: inset 0 0 0 2px var(--surface);' : ' border: 1px solid var(--border-strong);') })),
      positions: [['bottom', 'Bottom'], ['center', 'Center'], ['top', 'Top']].map((x) => ({ label: x[1], pressed: ed.hookPos === x[0] ? 'true' : 'false', style: seg(ed.hookPos === x[0], true), pick: () => upd({ hookPos: x[0] }) })),
      brand: i.brand, brandInitials: ini(i.brand), brandTile: brandTile(28), status: i.status, statusStyle: statusBlock(i.status, 24),
      planning: { value: ed, onChange: upd, brands: D.brands.filter(b => auth.includes(b.name)), brand: ed.brandId, onBrand: brandId => upd({ brandId }) },
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
      platforms: PLATFORMS.concat(ed.platforms.filter((p) => PLATFORMS.indexOf(p) < 0)).map((p) => { const on = ed.platforms.indexOf(p) >= 0; return { label: p, on: on, pressed: on ? 'true' : 'false', style: chip(on, 36), pick: () => upd({ platforms: toggle(ed.platforms, p) }) }; }),
      dirty: dirty, confirmClose: !!ed.confirmClose, err: ed.err || '', hasErr: !!ed.err,
      dirtyDot: dotS(ed.busy || coverBusy ? 'var(--muted)' : dirty ? TONE.amber[3] : ed.savedAt ? solid('green')[0] : 'var(--border-strong)'),
      dirtyLabel: ed.busy ? 'Saving…' : ed.confirmClose ? 'You have unsaved changes. Save them before closing?' : dirty ? 'Unsaved changes' : coverBusy ? 'Saved. Uploading the cover…' : ed.savedAt ? 'All changes saved' : 'No changes',
      save: save, saveInPlace: () => save(true), saveLabel: ed.busy ? 'Saving…' : ed.confirmClose ? 'Save and close' : 'Save changes',
      saveStyle: 'min-height: 44px; padding: 0 20px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); font-size: 14px; font-weight: 600; letter-spacing: normal; cursor: pointer; opacity: ' + (dirty && !ed.busy ? '1' : '0.5') + ';',
      requestClose: requestClose, discard: close, keepEditing: keepEditing,
      onKey: (e) => { if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(true); } }
    };
  }

  // Closing or reloading the tab asks first while this edit has unsaved changes.
  markUnsavedEdit(!!(edit && edit.dirty));

  // ---------- New idea ----------
  const NI0 = { titleOptions: '', thumbnailBrief: '', importText: '', mode: 'quick', cover: 'hook', file: null, url: '', fileName: '', drag: false, title: '', hook: '', brand: '', type: TYPES[0], body: '',
    audience: '', pillar: '', promise: '', format: '', platforms: [], ice: [5, 5, 5], iceSet: false, priority: 3, effort: '', ownerId: '', window: '', sponsorId: '',
    tags: '', refs: [''], runId: '', another: false, err: '', busy: false, pickOpen: false };
  const ni = Object.assign({}, NI0, s.ni || {});
  const niBrand = auth.indexOf(ni.brand) >= 0 ? ni.brand : (fBrand !== 'all' ? fBrand : auth.length === 1 ? auth[0] : '');
  const nset = (p) => set({ ni: Object.assign({}, ni, { err: '' }, p) });
  const full = ni.mode === 'full';
  const niImg = ni.cover !== 'hook' && !!ni.url;
  const niScore = full && ni.iceSet ? iceTotal(ni.ice) : null;
  const niTake = (e) => {
    const r = takeImage(fileOf(e));
    if (!r) return nset({ drag: false });
    if (r.err) return nset({ drag: false, err: r.err });
    nset({ file: r.file, url: r.url, fileName: r.name, drag: false, cover: ni.cover === 'hook' ? 'both' : ni.cover, pickOpen: false });
  };
  const closeNew = () => set({ ideaModal: false, ni: null });
  // A link pasted as the title becomes the first reference; its page title fills in once the preview lands.
  const pastedLink = ni.link || '';
  if (pastedLink) A.loadPreviews([pastedLink]);
  const linkPreview = pastedLink ? previewOf(pastedLink) : null;
  const niTitle = pastedLink && ni.title === pastedLink && linkPreview && linkPreview.title ? linkPreview.title : ni.title || '';
  const create = () => {
    if (ni.busy) return;
    const title = niTitle.trim();
    if (!title) return nset({ err: 'Give the idea a title.' });
    if (auth.indexOf(niBrand) < 0) return nset({ err: 'Choose a brand before saving this idea.' });
    const brand = brandOf(niBrand);
    const input = { titleOptions: (ni.titleOptions || '').split('\n').map(t => t.trim()).filter(Boolean), thumbnailBrief: ni.thumbnailBrief || '', title: title, brandId: brand.id, type: ni.type, body: paras(ni.body), hook: (ni.hook || '').trim(), cover: niImg ? ni.file : null, coverMode: niImg ? ni.cover : 'hook', highlight: rules.cover.highlight, hookPos: rules.cover.hook_position };
    if (full) Object.assign(input, {
      audience: ni.audience.trim(), pillar: ni.pillar, promise: ni.promise.trim(), format: ni.format, platforms: ni.platforms,
      priority: ni.priority, effort: ni.effort, ownerId: ni.ownerId || me.id, window: ni.window, sponsorId: ni.sponsorId,
      tags: tagList(ni.tags), refs: ni.refs.map((r) => r.trim()).filter(Boolean), researchRunId: ni.runId
    }, ni.iceSet ? { ice: ni.ice } : {});
    if (pastedLink) input.refs = [pastedLink].concat((input.refs || []).filter((r) => r !== pastedLink));
    nset({ busy: true });
    A.createIdea(input).then((id) => {
      if (!id) return nset({ busy: false });
      if (ni.another) {
        set({ ni: Object.assign({}, NI0, { mode: ni.mode, brand: niBrand, type: ni.type, another: true, cover: 'hook' }) });
        A.toast('Created "' + title + '". Add the next one.');
        setTimeout(() => { const el = document.getElementById('ni-title'); if (el) el.focus(); }, 0);
      } else set({ ...clearedSearch, ideaModal: false, ni: null, ideaOpen: id, ideaTab: 'overview', iView: 'active', iStage: 'all', iF: null });
    }).catch((err) => nset({ busy: false, err: err.message }));
  };
  const niChecks = [['Title', !!ni.title.trim()], ['Banner hook', !!ni.hook.trim()], ['Cover image', niImg], ['Audience', !!ni.audience.trim()],
    ['Viewer takeaway', !!ni.promise.trim()], ['Platforms', ni.platforms.length > 0], ['Content', !!ni.body.trim()], ['References', ni.refs.some((r) => r.trim())]];
  const niDone = niChecks.filter((x) => x[1]).length;
  const nb = banner({ brand: niBrand, hook: ni.hook || ni.title || 'Your hook', coverMode: ni.cover, coverUrl: ni.url, focal: [50, 50], highlight: rules.cover.highlight, hookPos: rules.cover.hook_position }, 'preview');
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
    planning: { value: ni, onChange: nset, imported: ni.importText, onImportText: importText => nset({ importText }), onImport: () => { try { nset(importBrief(ni.importText)); } catch (e) { nset({ err: e.message }); } } },
    title: niTitle, onTitle: (e) => nset({ title: val(e) }),
    onTitlePaste: (e) => {
      const text = (e.clipboardData ? e.clipboardData.getData('text') : '').trim();
      if (niTitle.trim() || !isUrl(text) || /\s/.test(text)) return;
      e.preventDefault();
      nset({ title: text, link: text });
    },
    hasLink: !!pastedLink, linkLabel: hostOf(pastedLink), clearLink: () => nset({ link: '', title: ni.title === pastedLink ? '' : ni.title }),
    hook: ni.hook, hookCount: ni.hook.length + '/24', onHook: (e) => nset({ hook: val(e).slice(0, 24) }),
    showBrand: auth.length > 1,
    types: TYPES.map((t) => ({ label: t, hint: TYPE_HINT[t], pressed: ni.type === t ? 'true' : 'false', pick: () => nset({ type: t }),
      sw: 'width: 10px; height: 28px; flex: none; background: ' + solid(TYPE_T[t] || 'gray')[0] + ';',
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

  // ---------- Bulk bar ----------
  const selItems = shown.filter((i) => isSel(i.id));
  const nameOf = (id) => (id === me.id ? me.name : ((D.directory || []).find((p) => p.id === id) || {}).full_name || ((D.directory || []).find((p) => p.id === id) || {}).name || 'Someone');
  const plural = (n) => n + (n === 1 ? ' idea' : ' ideas');
  const skipNote = (skip) => (skip.length ? ' Skipped ' + skip.length + ': ' + skip[0] + (skip.length > 1 ? ', and more.' : '.') : '');
  // Splits the selection into ideas the change applies to and named reasons for the rest.
  const triage = (why) => {
    const go = [], skip = [];
    selItems.forEach((i) => { const r = why(i); if (r === null) return; if (r) skip.push('"' + i.title + '" ' + r); else go.push(i); });
    return [go, skip];
  };
  const bulkWrite = async (go, skip, patch, text, back, msg) => {
    clearSel({ ddOpen: '' });
    const done = await A.updateIdeas(go, patch, text);
    if (!done) return;
    const changed = go.filter((i) => done.indexOf(i.id) >= 0);
    const missed = go.length - changed.length;
    showToast({ text: msg(changed.length) + (missed ? ' ' + missed + ' could not be changed.' : '') + skipNote(skip), items: changed.map((i) => Object.assign({ id: i.id }, back(i))) });
  };
  const STAGE_MOVES = ['Inbox', 'Research', 'Ready'];
  const bulkMove = (to) => {
    const [go, skip] = triage((i) => (i.status === to ? null : i.status === 'Archived' ? 'is archived' : !canEditI(i) ? 'is not yours to move' : locked(i) ? 'is linked to a project' : stageBlocker(i, i.status, to, rules) || ''));
    if (!go.length) return A.toast(skip.length ? 'Nothing moved.' + skipNote(skip) : 'Those ideas are already in ' + to + '.');
    bulkWrite(go, skip, { status: to }, 'moved Stage to ' + to, (i) => ({ back: { status: i.status }, text: 'moved Stage back to ' + i.status }), (n) => 'Moved ' + plural(n) + ' to ' + to + '.');
  };
  const bulkOwner = (id) => {
    const name = nameOf(id);
    const [go, skip] = triage((i) => (i.ownerId === id ? null : i.status === 'Archived' ? 'is archived' : !canEditI(i) ? 'is not yours to edit' : ''));
    if (!go.length) return A.toast(skip.length ? 'Nothing changed.' + skipNote(skip) : 'Those ideas already belong to ' + (id === me.id ? 'you' : name) + '.');
    bulkWrite(go, skip, { ownerId: id, owner: name }, 'changed Owner to ' + name, (i) => ({ back: { ownerId: i.ownerId || '', owner: i.owner }, text: 'changed Owner back to ' + i.owner }), (n) => 'Gave ' + plural(n) + ' to ' + (id === me.id ? 'you' : name) + '.');
  };
  const [archGo, archSkip] = triage((i) => (i.status === 'Archived' ? null : !canEditI(i) ? 'is not yours to archive' : ''));
  const [resGo] = triage((i) => (canResearchIdea(i) && !isActiveRun(i.run) ? '' : null));
  const ask = s.iBulkAsk || '';
  const bulk = selIds.length ? {
    count: String(selIds.length), label: selIds.length === 1 ? 'idea selected' : 'ideas selected',
    clear: () => clearSel({ ddOpen: '' }),
    canSelectAll: selIds.length < shown.length, selectAllLabel: 'Select all ' + shown.length, selectAll: () => setSel(shown.map((i) => i.id)),
    asking: !!ask, askText: ask === 'archive' ? 'Archive ' + plural(archGo.length) + '?' : ask === 'research' ? 'Run research on ' + plural(resGo.length) + '?' : '',
    askNote: ask === 'archive' ? 'History is kept. You can undo this.' : ask === 'research' ? 'Runs start one after another.' : '',
    askGo: ask === 'archive' ? 'Archive' : 'Run research', askDanger: ask === 'archive',
    canArchive: archGo.length > 0, archiveLabel: ask === 'archive' ? 'Archive ' + plural(archGo.length) + '?' : 'Archive', archiveAsking: ask === 'archive',
    archive: () => {
      if (ask !== 'archive') return set({ iBulkAsk: 'archive' });
      bulkWrite(archGo, archSkip, { status: 'Archived' }, 'archived the idea', (i) => ({ back: { status: i.status }, text: 'restored the idea' }), (n) => 'Archived ' + plural(n) + '. History is kept.');
    },
    canResearch: resGo.length > 0, researchLabel: ask === 'research' ? 'Research ' + plural(resGo.length) + '?' : 'Run research', researchAsking: ask === 'research',
    research: async () => {
      if (ask !== 'research') return set({ iBulkAsk: 'research' });
      clearSel();
      let ok = 0;
      // One at a time so spend caps are checked against each run in turn.
      for (const i of resGo) { if (await A.runIdeaResearch(i)) ok += 1; }
      if (ok) A.toast('Research started on ' + plural(ok) + '.');
    },
    cancelAsk: () => set({ iBulkAsk: '' })
  } : null;

  // Custom dropdowns (vals.js turns each into a mkDD): [list, onChange, variant, label, align, more].
  const dds = {
    ideaBrand: [opt([['all', 'All brands']].concat(auth.map((b) => [b, b])), fBrand), (e) => set({ iBrand: val(e) || 'all' }), 'compact', 'Brand', 'left'],
    niBrand: [opt([['', 'Choose a brand']].concat(auth), niBrand), (e) => nset({ brand: val(e), runId: '' }), 'field', 'Brand', 'left', { float: true }],
    niPillar: [pillarOpts(ni.pillar), (e) => nset({ pillar: val(e) }), 'field', 'Content pillar', 'left', { float: true }],
    niOwner: [ownerOpts(ni.ownerId || me.id), (e) => nset({ ownerId: val(e) }), 'field', 'Owner', 'left', { float: true }],
    niWindow: [windowOpts(ni.window), (e) => nset({ window: val(e) }), 'field', 'Target publish window', 'left', { float: true }],
    niSponsor: [sponsorOpts(ni.sponsorId), (e) => nset({ sponsorId: val(e) }), 'field', 'Sponsor fit', 'left', { float: true, add: addSponsor }],
    niRun: [opt([['', 'No research run']].concat(runsForBrand.map((r) => [r.id, runLabel(r)])), ni.runId), (e) => nset({ runId: val(e) }), 'field', 'Research run', 'left', { float: true }]
  };
  if (histWhoOpts) dds.ideaHistWho = [opt(histWhoOpts, histWhoCur), (e) => set({ iHistWho: val(e) || 'all' }), 'compact', 'Person', 'left', { float: true }];
  if (bulk) {
    dds.ideaBulkStage = [opt(STAGE_MOVES.map((k) => [k, k]), ''), (e) => bulkMove(val(e)), 'compact', 'Move selected ideas to', 'left', { float: true, prompt: 'Move to' }];
    dds.ideaBulkOwner = [opt(people.map((p) => [p.id, p.id === me.id ? 'You' : p.full_name || p.name]), ''), (e) => bulkOwner(val(e)), 'compact', 'Give selected ideas to', 'left', { float: true, prompt: 'Owner' }];
  }
  // List cells edit in place: Stage goes through the same gates and Undo as a board move.
  if (layout === 'list') shown.forEach((i) => {
    if (i.status === 'Archived' || !canEditI(i)) return;
    if (!locked(i)) dds['iCellStage_' + i.id] = [opt(ORDER.map((k) => [k, k]), i.status), (e) => move(i.id, val(e)), 'cell', 'Stage of ' + i.title, 'left', { float: true }];
    dds['iCellType_' + i.id] = [opt(withCurrent(TYPES, i.type), i.type), (e) => { const v = val(e); if (v && v !== i.type) A.updateIdea(i, { type: v }, 'changed Type to ' + v); }, 'cell', 'Type of ' + i.title, 'left', { float: true }];
    dds['iCellOwner_' + i.id] = [ownerOpts(i.ownerId), (e) => { const v = val(e); if (v && v !== i.ownerId) A.updateIdea(i, { ownerId: v, owner: nameOf(v) }, 'changed Owner to ' + nameOf(v)); }, 'cell', 'Owner of ' + i.title, 'left', { float: true }];
  });
  if (ed) {
    const upd = (p) => set({ ideaEdit: Object.assign({}, ed, { confirmClose: false }, p) });
    Object.assign(dds, {
      ieType: [opt(withCurrent(TYPES, ed.type), ed.type), (e) => upd({ type: val(e) }), 'field', 'Type', 'left', { float: true, bg: 'var(--surface)' }],
      iePillar: [pillarOpts(ed.pillar), (e) => upd({ pillar: val(e) }), 'field', 'Content pillar', 'left', { float: true, bg: 'var(--surface)' }],
      ieOwner: [ownerOpts(ed.ownerId), (e) => upd({ ownerId: val(e) }), 'field', 'Owner', 'left', { float: true, bg: 'var(--surface)' }],
      ieFormat: [opt([['', 'Not set']].concat(withCurrent(FORMATS, ed.format).map((f) => [f, f])), ed.format || ''), (e) => upd({ format: val(e) }), 'field', 'Format', 'left', { float: true, bg: 'var(--surface)' }],
      ieEffort: [opt([['', 'Not set']].concat(EFFORTS.map((f) => [f, f])), ed.effort || ''), (e) => upd({ effort: val(e) }), 'field', 'Effort', 'left', { float: true, bg: 'var(--surface)' }],
      ieWindow: [windowOpts(ed.window), (e) => upd({ window: val(e) }), 'field', 'Window', 'right', { float: true, bg: 'var(--surface)' }],
      ieSponsor: [sponsorOpts(ed.sponsorId), (e) => upd({ sponsorId: val(e) }), 'field', 'Sponsor fit', 'left', { float: true, add: addSponsor, bg: 'var(--surface)' }]
    });
  }
  // Details rows on the idea dialog edit in place; each pick saves at once.
  if (sel && !ed && canEditI(sel) && sel.status !== 'Archived') {
    const i = sel;
    const put = (p, text) => A.updateIdea(i, p, text);
    const row = (list, onPick, label, dim) => [list, onPick, 'cell', label, 'right', { float: true, dim: !!dim }];
    Object.assign(dds, {
      idOwner: row(ownerOpts(i.ownerId), (e) => { const v = val(e); if (v && v !== i.ownerId) put({ ownerId: v, owner: nameOf(v) }, 'changed Owner to ' + nameOf(v)); }, 'Owner'),
      idPri: row(opt([[1, 'P1'], [2, 'P2'], [3, 'P3']], i.priority), (e) => { const v = Number(val(e)); if (v && v !== i.priority) put({ priority: v }, 'changed Priority to P' + v); }, 'Priority'),
      idFormat: row(opt([['', 'Not set']].concat(withCurrent(FORMATS, i.format).map((f) => [f, f])), i.format || ''), (e) => { const v = val(e); if (v !== (i.format || '')) put({ format: v }, v ? 'changed Format to ' + v : 'cleared the Format'); }, 'Format', !i.format),
      idEffort: row(opt([['', 'Not set']].concat(EFFORTS.map((f) => [f, f])), i.effort || ''), (e) => { const v = val(e); if (v !== (i.effort || '')) put({ effort: v }, v ? 'changed Effort to ' + v : 'cleared the Effort'); }, 'Effort', !i.effort),
      idWindow: row(windowOpts(i.window), (e) => { const v = val(e); if (v !== (i.window || '')) put({ window: v }, v ? 'changed the Target window to ' + windowLabel(v) : 'cleared the Target window'); }, 'Target window', !i.window),
      idSponsor: row(sponsorOpts(i.sponsorId), (e) => { const v = val(e); if (v !== (i.sponsorId || '')) put({ sponsorId: v }, v ? 'changed Sponsor fit to ' + sponsorName(v) : 'cleared the Sponsor fit'); }, 'Sponsor fit', !i.sponsorId)
    });
  }

  // Keyboard: C captures, / searches, J and K step through the cards, Esc closes the top idea dialog, Cmd/Ctrl+Enter creates,
  // Cmd/Ctrl+S saves an edit. N is Dev Notes everywhere.
  const hotkey = (e) => {
    if (s.nav !== 'ideas' || !e) return false;
    const mod = e.metaKey || e.ctrlKey;
    const take = (fn) => { e.preventDefault(); fn(); return true; };
    // The import dialog sits on top of the capture form and handles its own Esc.
    if (e.key === 'Escape' && !s.ideaConvert && !document.querySelector('dialog[aria-labelledby="idea-import-title"][open]')) {
      if (s.ddOpen || s.iSaveOpen || s.iFieldsOpen || s.iMenu || s.iLaneMenu || s.iDlgMenu || s.iDlgField) return take(() => set({ ddOpen: '', iSaveOpen: false, iFieldsOpen: false, iMenu: '', iLaneMenu: '', iDlgMenu: '', iDlgField: '' }));
      // Esc while typing in an inline field throws the draft away and keeps the dialog open.
      if (detail && s.ideaInline && Object.keys(s.ideaInline).some((k) => k !== 'id')) return take(() => {
        inlineCancel = true;
        try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } finally { inlineCancel = false; }
        set({ ideaInline: null });
      });
      if (edit) return take(edit.confirmClose ? edit.keepEditing : edit.requestClose);
      if (detail) return take(() => set({ ideaOpen: '', ideaConfirm: '' }));
      if (s.ideaModal) return take(closeNew);
      if (s.iBulkAsk) return take(() => set({ iBulkAsk: '' }));
      if (selIds.length) return take(() => clearSel());
      return false;
    }
    if (s.ideaModal && mod && e.key === 'Enter') return take(create);
    if (edit && mod && (e.key === 's' || e.key === 'S')) return take(edit.saveInPlace);
    const typing = e.target && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable);
    // With the side panel open, J and K step to the next and previous idea in the view.
    if (detail && !edit && !mod && !e.altKey && !typing && !s.ideaModal && (e.key === 'j' || e.key === 'k')) {
      const go = e.key === 'j' ? detail.next : detail.prev;
      return go ? take(go) : false;
    }
    const k = String(e.key).toLowerCase();
    // Cmd/Ctrl+A checks every idea in the view.
    if (mod && k === 'a' && selectable && shown.length && !e.altKey && !e.shiftKey && !typing && !s.ideaModal && !detail && !edit && !document.querySelector('dialog[open]')) return take(() => setSel(shown.map((i) => i.id)));
    if (mod || e.altKey || typing || s.ideaModal || detail || edit || document.querySelector('dialog[open]')) return false;
    if (k === 'c' && canCreate) return take(() => openNew());
    if (k === '/') return take(() => { const box = document.getElementById('idea-search'); if (box) box.focus(); });
    // X checks the focused card or row, as in the bulk bar.
    if (k === 'x' && selectable) {
      const el = document.activeElement && document.activeElement.closest ? document.activeElement.closest('[data-idea-id]') : null;
      if (el) return take(() => toggleSel(el.getAttribute('data-idea-id')));
    }
    if (k === 'j' || k === 'k') return take(() => {
      const list = Array.from(document.querySelectorAll('button[aria-label^="Open idea:"], [data-idea-card]'));
      if (!list.length) return;
      const at = list.indexOf(document.activeElement);
      const next = at < 0 ? 0 : Math.max(0, Math.min(list.length - 1, at + (k === 'j' ? 1 : -1)));
      list[next].focus();
    });
    return false;
  };

  // ---------- Research agent ----------
  // app: Super Admin runs the research agent. Keys stay on the server; the page sees connected status and run progress.
  const integOn = {};
  (D.integrations || []).forEach((g) => { integOn[g.provider] = g.status === 'connected'; });
  const aiOn = !!(integOn.anthropic || integOn.openai || integOn.gemini || integOn.xai);
  const canResearch = role === 'admin' && aiOn && RESEARCH_PROVIDERS.some((p) => integOn[p]) && D.brands.length > 0;
  // `empty` is a finished run with no findings: amber, with the run's note saying why, not red.
  const RS_TONE = { queued: null, running: 'amber', done: 'green', empty: 'amber', failed: 'red', cancelled: null, skipped: null };
  const RS_LABEL = { queued: 'Queued', running: 'Running', done: 'Done', empty: 'No findings', failed: 'Failed', cancelled: 'Cancelled', skipped: 'Skipped' };
  const runState = (r) => r.status === 'done' && !(r.finding_count > 0) ? 'empty' : r.status;
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
        logo: SOURCE_LOGO[id] || '', label: def.label, via: def.viaName, state: RS_LABEL[st] || st, stateStyle: rsBlock(st),
        detail: p.error ? p.error : p.count != null ? p.count + (p.count === 1 ? ' finding' : ' findings') : '',
        detailStyle: 'font-size: 13px; line-height: 1.4; color: ' + (st === 'failed' ? 'var(--red-ink)' : 'var(--muted)') + ';'
      };
    });
    return {
      id: r.id, active: active, done: r.status === 'done', empty: runState(r) === 'empty', dismissed: !!r.dismissed_at, brand: b ? b.name : 'Deleted brand', brandName: b ? b.name : '',
      status: RS_LABEL[runState(r)] || r.status, statusStyle: rsBlock(runState(r)), note: r.note || '', hasNote: !!r.note, noteStyle: 'background: ' + TONE.amber[0] + '; color: ' + TONE.amber[1] + ';',
      topics: (inp.topics || []).join(', '), when: relTime(r.created_at),
      summary: (r.finding_count || 0) + (r.finding_count === 1 ? ' finding' : ' findings') + '  ·  ' + nIdeas + (nIdeas === 1 ? ' idea' : ' ideas'),
      sources: srcRows, hasError: !!r.error && r.status !== 'cancelled', error: r.error || '', ideaIds: r.idea_ids || [],
      canRedraft: r.status === 'failed' && !!r.saved_finding && !!b,
      canRetry: (r.status === 'failed' || r.status === 'cancelled' || runState(r) === 'empty') && !!b,
      retryInput: { brandId: r.brand_id, topics: (inp.topics || []).join(', '), sources: inp.sources || Object.keys(src), count: inp.count || LIMITS.defaultIdeas }
    };
  });
  const showIdeas = (r) => () => set({ ...clearedSearch, rsOpen: false, rsHide: r.id, iView: 'active', iF: null, iStage: 'all', iRun: r.ideaIds.length > 1 ? r.id : '', iType: 'all', iFormat: 'all', iPillar: 'all', iBrand: 'all', ideaOpen: r.ideaIds.length === 1 ? r.ideaIds[0] : '' });
  const latest = runs[0] || null;
  const panelRun = latest && (latest.active || (!latest.dismissed && s.rsHide !== latest.id)) && role === 'admin' ? latest : null;
  const runView = (r) => Object.assign({}, r, {
    cancel: () => A.cancelResearch(r.id),
    redraft: () => A.redraftResearch(r.id),
    show: showIdeas(r), canShow: r.done && r.ideaIds.length > 0,
    dismiss: () => { set({ rsHide: r.id }); if (!r.dismissed) A.dismissResearch(r.id); }, canDismiss: !r.active,
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
    setupText: !aiOn ? 'Connect Claude, OpenAI or Gemini to draft ideas, plus at least one source (Apify, Browserbase, Firecrawl, vidIQ or Virlo).'
      : !RESEARCH_PROVIDERS.some((p) => integOn[p]) ? 'Connect at least one source (Apify, Browserbase, Firecrawl, vidIQ or Virlo) to gather findings.' : 'Add a brand on the Brand page first.',
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
        logo: SOURCE_LOGO[x.id] || '', label: x.label, sub: ok ? x.desc + ' (' + x.viaName + ')' : x.viaName + ' is not connected', disabled: !ok, pressed: on ? 'true' : 'false',
        style: box(on) + (ok ? '' : ' opacity: 0.55; cursor: not-allowed;'), tickStyle: tick(on),
        pick: () => { if (ok) set({ rsSources: Object.assign({}, rsSel, { [x.id]: !on }) }); }
      };
    }),
    counts: [3, 5, 10].map((n) => ({ label: String(n), pressed: rsCount === n ? 'true' : 'false', style: pill(rsCount === n), pick: () => set({ rsCount: n }) })),
    start: startRs, busy: !!s.rsBusy, startLabel: s.rsBusy ? 'Starting…' : 'Run research',
    note: 'Runs are capped at about 5 minutes, ' + LIMITS.perTopic + ' results per topic per source, and $0.50 per Apify run. Ideas are saved to Inbox for review.',
    err: s.rsErr || '', hasErr: !!s.rsErr,
    hasPanel: !!panelRun, panel: panelRun ? runView(panelRun) : runView({ id: '', active: false, done: false, empty: false, brand: '', brandName: '', status: '', statusStyle: '', topics: '', when: '', summary: '', sources: [], hasError: false, error: '', note: '', hasNote: false, noteStyle: '', ideaIds: [] }),
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
      : sp.status === 'Done' ? sp.summary + ' from ' + named + '.' + (sp.hasNote ? ' ' + sp.note : '')
      : sp.empty ? 'No findings from ' + named + '. ' + sp.note
      : sp.status + (sp.hasError ? ': ' + sp.error : '.'),
    active: sp.active, max: String(srcTotal + 1), now: String(drafting ? srcTotal : srcDone),
    bar: 'width: ' + (srcTotal ? Math.round((drafting ? srcTotal + 0.5 : srcDone) / (srcTotal + 1) * 100) : 0) + '%; height: 100%; border-radius: 999px; background: var(--ink); transition: width 0.3s ease;',
    expanded: !!s.rsExpand, viewLabel: s.rsExpand ? 'Hide run' : 'View run', toggle: () => set({ rsExpand: !s.rsExpand }),
    iconStyle: 'width: 36px; height: 36px; flex: none; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: ' + TONE.coral[0] + '; color: ' + TONE.coral[1] + ';'
  };

  const ideaByTitle = {};
  visible.forEach((i) => { ideaByTitle[i.title] = i.id; });
  const t = s.iToast;
  const convertTarget = s.ideaConvert ? visible.find((i) => i.id === s.ideaConvert) || null : null;
  // ---------- Toolbar (handoff § IdeasToolbar): one popover open at a time in s.iMenu ----------
  const menu = s.iMenu || '';
  const closeMenu = () => set({ iMenu: '', iSaveOpen: false, iSaveName: '', iViewsManage: false });
  const toggleMenu = (k) => set({ iMenu: menu === k ? '' : k, iSaveOpen: false, iSaveName: '', iViewsManage: false, ddOpen: '', iLaneMenu: '' });
  const setF = (next) => set({ iF: normF(next) });
  const pickView = (key, v) => set({ iView: key, iF: null, iMenu: '', iViewsManage: false, iPage: {}, ...(v && v.sort ? { iSort: v.sort, iSortDir: v.dir || '', iSearchSort: null } : {}), ...(v && v.stage ? { iStage: v.stage } : {}) });
  const countIn = (stage) => filtered.filter((i) => stage === 'all' || (stageOf(i) === stage && !sideOf(i))).length;
  const STATUS = [['all', 'All']].concat(LANES.map((l) => [l.key, l.tab]));
  const ownerIds = [me.id].concat(scope.map((i) => i.ownerId).filter((id, k, a) => id && id !== me.id && a.indexOf(id) === k));
  const nameOf0 = (id) => (id === me.id ? 'You' : ((D.directory || []).find((p) => p.id === id) || {}).full_name || ((D.directory || []).find((p) => p.id === id) || {}).name || (D.ideas.find((i) => i.ownerId === id) || {}).owner || 'Someone');
  const FGROUPS = [
    ['origin', 'Idea origin', [['manual', 'Manual'], ['ai', 'AI-generated', solid('violet')[0]]]],
    ['run', 'Research run', [['queued', 'Queued', 'var(--muted-2)'], ['running', 'Running', solid('blue')[0]], ['complete', 'Complete', solid('green')[0]], ['failed', 'Failed', solid('red')[0]], ['none', 'No run']]],
    ['owner', 'Owner', ownerIds.map((id) => [id, nameOf0(id)])],
    ['score', 'Score', [['high', pursueAt + '+', solid('green')[0]], ['mid', parkAt + ' to ' + (pursueAt - 1), solid('amber')[0]], ['low', 'Under ' + parkAt, solid('red')[0]], ['none', 'Unscored', 'var(--muted-2)']]],
    ['flags', 'Flags', [['nocover', 'Missing cover'], ['comments', 'Has comments'], ['stale', 'Stale 14d+']]]
  ];
  const optName = (g, v) => ((FGROUPS.find((x) => x[0] === g) || [0, 0, []])[2].find((o) => o[0] === v) || [v, g === 'owner' ? nameOf0(v) : v])[1];
  const sortDef = SORTS.find((x) => x[0] === sort);
  const viewName = userView ? userView.name : preset[1];
  const saveAsView = () => {
    const name = String(s.iSaveName || '').trim();
    if (!name) return;
    const savableSort = SORTS.some((x) => x[0] === orderField);
    const next = savedViews.filter((v) => v.name !== name).concat([{ name: name, f: iF, parked: offBoard === 'parked' || undefined, sort: savableSort ? orderField : undefined, dir: savableSort ? orderDir : undefined, stage: stageSel !== 'all' ? stageSel : undefined }]);
    set({ iViews: next, iView: 'saved:' + next.findIndex((v) => v.name === name), iF: null, iSaveOpen: false, iSaveName: '' });
    A.savePrefs({ ideaViews: next });
  };
  const LAYOUTS = [['gallery', 'Grid'], ['board', 'Board'], ['list', 'List']];
  const tb = {
    menu: menu, toggle: toggleMenu, close: closeMenu,
    status: {
      value: stageSel, label: (STATUS.find((x) => x[0] === stageSel) || STATUS[0])[1], count: String(countIn(stageSel)),
      options: STATUS.map((x) => ({ key: x[0], label: x[1], count: String(countIn(x[0])), on: stageSel === x[0], pick: () => set({ iStage: x[0], iMenu: '', iPage: {} }) }))
    },
    views: {
      name: viewName, color: userView ? 'var(--link)' : preset[3], edited: edited,
      rows: PRESETS.map((p) => ({ key: p[0], label: p[1], color: p[3], on: viewKey === p[0],
        count: String(p[0] === 'parked' ? scope.filter(isParked).length : p[0] === 'archived' ? scope.filter((i) => !live(i)).length : scope.filter((i) => onBoard(i) && passF(i, normF(p[2]))).length),
        pick: () => pickView(p[0]) })),
      saved: savedViews.map((v, n) => ({ key: 'saved:' + n, label: v.name, on: viewKey === 'saved:' + n, pick: () => pickView('saved:' + n, v),
        removeLabel: 'Remove saved view ' + v.name,
        remove: () => { const next = savedViews.filter((x, k) => k !== n); set({ iViews: next, ...(viewKey === 'saved:' + n ? { iView: 'active', iF: null } : /^saved:/.test(viewKey) && Number(viewKey.slice(6)) > n ? { iView: 'saved:' + (Number(viewKey.slice(6)) - 1) } : {}) }); A.savePrefs({ ideaViews: next }); } })),
      managing: !!s.iViewsManage, manage: () => set({ iViewsManage: !s.iViewsManage })
    },
    search: {
      value: s.iq || '', onChange: changeSearch, clear: () => set(clearedSearch),
      resultText: search ? nShown + (nShown === 1 ? ' matching idea' : ' matching ideas') : '',
      noMatches: !!search && nShown === 0 && visible.length > 0
    },
    filters: {
      count: nFilters, label: nFilters ? 'Filters, ' + nFilters + ' active' : 'Filters',
      chips: FGROUPS.filter((g) => iF[g[0]].length).map((g) => ({ key: g[0], group: g[1], value: iF[g[0]].map((v) => optName(g[0], v)).join(', '),
        removeLabel: 'Remove ' + g[1] + ' filter', remove: () => setF(Object.assign({}, iF, { [g[0]]: [] })) })),
      groups: FGROUPS.map((g) => ({ key: g[0], label: g[1], id: 'iff-' + g[0],
        options: g[2].map((o) => { const on = iF[g[0]].indexOf(o[0]) >= 0; return { key: o[0], label: o[1], dot: o[2] || '', on: on,
          toggle: () => setF(Object.assign({}, iF, { [g[0]]: on ? iF[g[0]].filter((x) => x !== o[0]) : iF[g[0]].concat([o[0]]) })) }; }) })),
      clearAll: () => setF(EMPTY_F), canSave: edited, saving: !!s.iSaveOpen, startSave: () => set({ iSaveOpen: true, iSaveName: '' }),
      saveName: s.iSaveName || '', onSaveName: (e) => set({ iSaveName: val(e) }), save: saveAsView,
      onSaveKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); saveAsView(); } },
      cancelSave: () => set({ iSaveOpen: false, iSaveName: '' }), done: closeMenu
    },
    sort: {
      field: sort === 'relevance' ? 'Relevance' : sortDef ? sortDef[1] : 'Column',
      down: sortDir === 'desc', label: 'Sort: ' + (sort === 'relevance' ? 'Relevance' : sortDef ? sortDef[1] + ', ' + sortDef[2][sortDir === defaultDir(sort) ? 0 : 1] : 'list column'),
      rows: (search ? [['relevance', 'Relevance'], ...SORTS] : SORTS).map((x) => ({ key: x[0], label: x[1], on: sort === x[0], pick: () => pickSort(x[0]) })),
      dir: sortDir, dirs: sort === 'relevance' ? [] : (sortDef || SORTS[0])[2].map((label, n) => ({ id: n === 0 ? defaultDir(sort) : sort === 'title' ? 'desc' : 'asc', label })),
      pickDir: (dir) => pickSort(sortDef ? sort : 'score', dir)
    },
    display: layout === 'board' ? {
      title: 'Card fields', meta: CARD_FIELDS.filter((f) => CF[f[0]]).length + ' of ' + CARD_FIELDS.length + ' shown',
      items: CARD_FIELDS.map((f) => ({ key: f[0], label: f[1], on: CF[f[0]], flip: () => { const next = CF[f[0]] ? cardHidden.concat([f[0]]) : cardHidden.filter((x) => x !== f[0]); set({ iCardHidden: next }); A.savePrefs({ ideaCardHidden: next }); } })),
      groups: null
    } : {
      title: fieldsPanel.title, meta: fieldsPanel.items.filter((f) => f.on).length + ' of ' + fieldsPanel.items.length + ' shown',
      items: fieldsPanel.items, reset: fieldsPanel.canReset ? fieldsPanel.reset : null,
      groups: layout === 'list' ? [['none', 'No grouping'], ['stage', 'Stage'], ['pillar', 'Pillar'], ['owner', 'Owner'], ['brand', 'Brand'], ['type', 'Type'], ['rec', 'Recommendation']]
        .map((g) => ({ key: g[0], label: g[1], on: groupBy === g[0], pick: () => { set({ iGroup: g[0] }); A.savePrefs({ ideaGroup: g[0] }); } })) : null
    },
    layouts: LAYOUTS.map((l) => ({ key: l[0], label: l[1], name: l[1] + ' view', on: layout === l[0], pick: () => { set({ iLayout: l[0], iMenu: '' }); A.savePrefs({ ideaLayout: l[0] }); } })),
    layout: layout
  };
  // Header pill: auto research and the runs in flight; cover notice under the toolbar.
  const runsActive = scope.filter((i) => isActiveRun(i.run)).length;
  const coverMissing = scope.filter((i) => onBoard(i) && !i.coverPath).length;
  const coversStarted = s.iCoversAt && Date.now() - s.iCoversAt < 5 * 60000;
  const coverNotice = role === 'admin' && imgAiOn && (coverMissing > 0 || s.coverFillBusy) ? {
    text: coversStarted || s.coverFillBusy ? 'Generating covers for ' + coverMissing + (coverMissing === 1 ? ' idea' : ' ideas') : coverMissing + (coverMissing === 1 ? ' idea has no cover' : ' ideas have no cover'),
    busy: !!(coversStarted || s.coverFillBusy),
    run: () => { if (s.coverFillBusy) return; set({ coverFillBusy: true }); A.backfillCovers().then((n) => set({ coverFillBusy: false, iCoversAt: n ? Date.now() : 0 })); }
  } : null;
  const board = {
    lanes: lanes, parked: parked, single: laneList.length === 1, add: () => openNew(), addCol: addCol, dark: dark,
  };

  const ids = {
    rs: rs, dds: dds, hotkey: hotkey,
    tb: tb, board: board, coverNotice: coverNotice,
    autoResearch: 'Auto research ' + (rules.auto_research ? 'on' : 'off'), runsActive: runsActive ? runsActive + (runsActive === 1 ? ' run active' : ' runs active') : '', canOpenRules: role === 'admin' && me.dbRole === 'super_admin',
    listHeads: [['Idea', 'col:title', ''], ['Brand', 'col:brand', 'brand'], ['Type', 'col:type', 'type'], ['Stage', 'col:stage', 'stage'], ['Priority', 'col:priority', 'priority'], ['Score', 'score', 'score'], ['Recommendation', 'col:rec', 'rec'], ['Owner', 'col:owner', 'owner'], ['Sources', 'col:sources', 'sources'], ['Comments', 'col:comments', 'comments'], ['Updated', 'updated', 'updated']]
      .filter((h) => !h[2] || F[h[2]]).map((h) => ({ label: h[0], on: sort === h[1], sort: () => pickSort(h[1]) })),
    f: F, fields: fieldsPanel, bulk: bulk, selecting: selIds.length > 0,
    // The drag box (IdeaMarquee) writes the selection as it grows; the last idea it took is where Shift+click runs from.
    selectable: selectable, selIds: selIds, setSel: (list) => setSel(list, list.length ? { iSelAnchor: list[list.length - 1] } : { iSelAnchor: '' }),
    canGroup: layout === 'list', groups: groups, colSpan: 1 + ['', 'brand', 'type', 'stage', 'priority', 'score', 'rec', 'owner', 'sources', 'comments', 'updated'].filter((k) => !k || F[k]).length,
    allSel: shown.length > 0 && selIds.length === shown.length, someSel: selIds.length > 0 && selIds.length < shown.length,
    toggleAll: () => (selIds.length === shown.length ? clearSel() : setSel(shown.map((i) => i.id))),
    showBrandFilter: auth.length > 1, cards: cards,
    isGallery: layout === 'gallery' && shown.length > 0, isList: layout === 'list' && shown.length > 0, isBoard: layout === 'board' && visible.length > 0,
    isEmpty: layout !== 'board' && shown.length === 0 && visible.length > 0,
    noIdeas: visible.length === 0,
    summary: nShown + (nShown === 1 ? ' idea' : ' ideas') + (runRow ? ' from one research run (' + relTime(runRow.created_at) + ').' : '.'),
    reset: () => set({ ...clearedSearch, iView: 'active', iStage: 'all', iF: null, iRun: '', iBrand: 'all' }),
    hasRun: !!runRow, clearRun: () => set({ iRun: '' }),
    // Super Admin: one click draws a cover for every active idea without one (new ideas get theirs automatically).
    missingCovers: role === 'admin' && imgAiOn && !s.coverFillBusy ? D.ideas.filter((i) => !i.coverPath && i.status !== 'Archived').length : 0,
    fillBusy: !!s.coverFillBusy, fillLabel: s.coverFillBusy ? 'Starting…' : 'Generate missing covers',
    fillCovers: () => { if (s.coverFillBusy) return; set({ coverFillBusy: true }); A.backfillCovers().then(() => set({ coverFillBusy: false })); },
    dragEnd: () => set({ iDrag: '', iOver: '' }),
    hasToast: !!t, toast: t ? t.text : '', undo: undo,
    emptyText: !auth.length ? (role === 'admin' ? 'Every idea belongs to a brand. Add a brand on the Brand page, then come back to add ideas.' : 'No brands yet. Ideas show up once a brand is set up.') : 'No ideas for your brands yet.',
    canCreate: canCreate, addDraft: () => openNew(),
    convert: convertTarget ? { title: convertTarget.title, close: () => set({ ideaConvert: '' }), options: convertOptions(convertTarget).map((t) => ({ label: t.label, help: t.help, pick: () => runConvert(convertTarget, t.key) })) } : null,
    rulesProps: role === 'admin' && me.dbRole === 'super_admin' ? { rules: rules, onSave: A.saveIdeaRules } : null,
    // Ideas > Automate (components/studio/IdeaAutomations.jsx): idea automations live in Automations, which is admin only.
    autoProps: role === 'admin' ? {
      automations: D.automations || [], runs: D.automationRuns || [],
      connected: Object.fromEntries((D.integrations || []).map((g) => [g.provider, g.status === 'connected'])),
      sandbox: !!((D.settings || {}).automation || {}).sandbox, paused: !!((D.settings || {}).automation || {}).paused,
      onCreate: A.createAutomation, onUpdate: A.updateAutomation, onDelete: A.deleteAutomation, onTest: (id) => A.testAutomation(id),
      openRuns: () => set({ nav: 'auto', autoTab: 'runs', ideaOpen: '' }), ago: (iso) => relTime(iso)
    } : null,
    importProps: { brands: D.brands.filter(b => auth.includes(b.name)), onImport: A.importIdeas, onComplete: () => set({ ...clearedSearch, iView: 'active', iStage: 'Inbox', iF: null, iBrand: 'all', iRun: '', ideaModal: false, ni: null }) },
    hasSel: !!detail && !s.ideaModal, sel: detail || {}, hasEdit: !!edit && !s.ideaModal, edit: edit || {},
    closeIdea: () => { if (s.ideaScript?.dirty && !window.confirm('Discard unsaved script changes?')) return; set({ ideaOpen: '', ideaEdit: null, ideaScript: null, ideaConfirm: '', ddOpen: '', iDlgField: '', ideaInline: null }); },
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
