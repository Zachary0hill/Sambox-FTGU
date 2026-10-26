'use client';
// Dev Notes: the floating "press N anywhere" dock for Super Admins. A shared development backlog for the workspace:
// jot down an idea, enhancement or bug while browsing and it is tagged with the page you were on. Drag the header to
// move it (position is remembered), double-click the header to reset, arrow keys nudge when the grip is focused,
// Esc closes. Ported from the ZZMEDIA and Parish dashboards; rows live in dev_notes behind RLS (Super Admins only).
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';

const CATS = {
  idea: { label: 'Idea', soft: 'var(--amber-soft)', ink: 'var(--amber-ink)', dot: '#E0A526', placeholder: 'Jot down an idea or new tool…' },
  enhancement: { label: 'Enhance', soft: 'var(--violet-soft)', ink: 'var(--violet-ink)', dot: '#9B7BFF', placeholder: 'Note something to improve…' },
  bug: { label: 'Bug', soft: 'var(--red-soft)', ink: 'var(--red-ink)', dot: '#E5484D', placeholder: 'Log a broken button or bug…' },
};
const CAT_ORDER = ['idea', 'enhancement', 'bug'];
const POS_KEY = 'ftgu.devNotes.pos';
const CAT_KEY = 'ftgu.devNotes.cat';
const WIDTH = 380;
const MARGIN = 24;
const FALLBACK_H = 320;
const DRAG_THRESHOLD = 4;
const SNAP = 16;
const EASE = 'left 160ms cubic-bezier(0.2, 0.8, 0.2, 1), top 160ms cubic-bezier(0.2, 0.8, 0.2, 1)';

const sortNotes = (list) => list.slice().sort((a, b) => (a.sort_order - b.sort_order) || (new Date(b.created_at) - new Date(a.created_at)));
const authorOf = (n) => (n.created_by_email || '').split('@')[0] || '';
const pagePath = () => (typeof window === 'undefined' ? '' : window.location.pathname + window.location.search + window.location.hash);
const readJson = (k) => { try { return JSON.parse(window.localStorage.getItem(k) || 'null'); } catch { return null; } };
const writeJson = (k, v) => { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const isInteractive = (t) => t instanceof Element && !!t.closest('button, a, input, textarea, select, [contenteditable="true"], [data-no-drag]');

const P = (d, extra) => <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css(extra)}><path d={d} /></svg>;
const I = {
  terminal: 'M4 17l6-6-6-6M12 19h8',
  close: 'M18 6L6 18M6 6l12 12',
  circle: 'M12 2a10 10 0 100 20 10 10 0 000-20z',
  check: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  trash: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2',
  enter: 'M9 10l-5 5 5 5M20 4v7a4 4 0 01-4 4H4',
  bulb: 'M15 14c.2-1 .7-1.7 1.5-2.5A6 6 0 106.5 11.5c.8.8 1.3 1.5 1.5 2.5M9 18h6M10 22h4',
  sparkle: 'M9.9 2.1l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4L3.9 8.1l4.4-1.6zM19 14l.9 2.1 2.1.9-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z',
  bug: 'M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6zM12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M17.47 9c1.93-.2 3.53-1.9 3.53-4M22 13h-4M20.97 21c0-2.1-1.6-3.9-3.8-4',
};
const CAT_ICON = { idea: I.bulb, enhancement: I.sparkle, bug: I.bug };

// ── Drag: translate3d while moving, then bake into left/top on release. See the Parish useFloatingCardDrag. ──
function useDrag(cardRef, open) {
  const [pos, setPos] = useState(null); // null = default corner (bottom right)
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const timer = useRef(0);

  const height = () => (cardRef.current && cardRef.current.offsetHeight) || FALLBACK_H;
  const clamp = (p, h = height()) => ({
    x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN)),
    y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
  });
  const snap = (p) => {
    const maxX = Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN), maxY = Math.max(MARGIN, window.innerHeight - height() - MARGIN);
    let { x, y } = p;
    if (Math.abs(x - MARGIN) <= SNAP) x = MARGIN; else if (Math.abs(x - maxX) <= SNAP) x = maxX;
    if (Math.abs(y - MARGIN) <= SNAP) y = MARGIN; else if (Math.abs(y - maxY) <= SNAP) y = maxY;
    return { x, y };
  };
  const lock = (on) => { if (on) document.documentElement.dataset.floatingDrag = 'true'; else delete document.documentElement.dataset.floatingDrag; };
  const mark = (on) => { const el = cardRef.current; if (!el) return; if (on) el.dataset.dragging = 'true'; else delete el.dataset.dragging; };

  const glideTo = (next) => {
    const el = cardRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.transition = 'none'; el.style.left = r.left + 'px'; el.style.top = r.top + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = '';
      void el.offsetWidth;
      el.style.transition = EASE; el.style.left = next.x + 'px'; el.style.top = next.y + 'px';
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { if (cardRef.current) cardRef.current.style.transition = ''; }, 200);
    }
    setPos(next); writeJson(POS_KEY, next);
  };

  useEffect(() => { const saved = readJson(POS_KEY); if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) setPos(clamp(saved)); }, []);
  useEffect(() => {
    if (!open) return;
    const onResize = () => setPos((c) => (c ? clamp(c) : c));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);
  useEffect(() => () => { if (drag.current && drag.current.active) lock(false); if (drag.current && drag.current.raf) cancelAnimationFrame(drag.current.raf); drag.current = null; window.clearTimeout(timer.current); }, []);

  const finish = (handle, pointerId, cancelled) => {
    const d = drag.current;
    if (!d || d.pointerId !== pointerId) return;
    if (d.raf) cancelAnimationFrame(d.raf);
    drag.current = null;
    try { if (handle) handle.releasePointerCapture(pointerId); } catch { /* released */ }
    if (!d.active) return;
    const el = cardRef.current;
    lock(false); mark(false); setDragging(false);
    if (!el) return;
    if (cancelled) { el.style.willChange = ''; glideTo({ x: d.baseX, y: d.baseY }); return; }
    const landed = { x: d.lastX, y: d.lastY };
    el.style.transition = 'none'; el.style.left = landed.x + 'px'; el.style.top = landed.y + 'px'; el.style.transform = ''; el.style.willChange = '';
    const s = snap(landed);
    if (s.x !== landed.x || s.y !== landed.y) glideTo(s);
    else { el.style.transition = ''; setPos(landed); writeJson(POS_KEY, landed); }
  };

  useEffect(() => {
    if (!dragging) return;
    const onKey = (e) => { if (e.key !== 'Escape' || !drag.current) return; e.preventDefault(); e.stopImmediatePropagation(); finish(null, drag.current.pointerId, true); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dragging]);

  const onPointerDown = (e) => {
    if ((e.button !== 0 && e.pointerType === 'mouse') || isInteractive(e.target)) return;
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    window.clearTimeout(timer.current); el.style.transition = 'none';
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, baseX: r.left, baseY: r.top, pendingX: e.clientX, pendingY: e.clientY, lastX: r.left, lastY: r.top, raf: 0, active: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault();
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    d.pendingX = e.clientX; d.pendingY = e.clientY;
    if (!d.active) {
      if (Math.hypot(d.pendingX - d.startX, d.pendingY - d.startY) < DRAG_THRESHOLD) return;
      const el = cardRef.current; if (!el) return;
      el.style.left = d.baseX + 'px'; el.style.top = d.baseY + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.willChange = 'transform';
      d.active = true; lock(true); mark(true); setDragging(true);
    }
    if (d.raf) return;
    d.raf = requestAnimationFrame(() => {
      const dd = drag.current, el = cardRef.current;
      if (!dd || !el) return;
      dd.raf = 0;
      const c = clamp({ x: dd.baseX + (dd.pendingX - dd.startX), y: dd.baseY + (dd.pendingY - dd.startY) }, el.offsetHeight || FALLBACK_H);
      dd.lastX = c.x; dd.lastY = c.y;
      el.style.transform = 'translate3d(' + (c.x - dd.baseX) + 'px, ' + (c.y - dd.baseY) + 'px, 0)';
    });
  };
  const reset = () => {
    const el = cardRef.current;
    window.clearTimeout(timer.current);
    if (el) {
      const target = { x: Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN), y: Math.max(MARGIN, window.innerHeight - (el.offsetHeight || FALLBACK_H) - MARGIN) };
      const r = el.getBoundingClientRect();
      el.style.transition = 'none'; el.style.left = r.left + 'px'; el.style.top = r.top + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = '';
      void el.offsetWidth;
      el.style.transition = EASE; el.style.left = target.x + 'px'; el.style.top = target.y + 'px';
      timer.current = window.setTimeout(() => {
        const n = cardRef.current; if (!n) return;
        n.style.transition = ''; n.style.left = ''; n.style.top = ''; n.style.right = MARGIN + 'px'; n.style.bottom = MARGIN + 'px';
        setPos(null);
      }, 200);
    } else setPos(null);
    writeJson(POS_KEY, null);
  };
  const onKeyDown = (e) => {
    if (isInteractive(e.target)) return;
    const step = 8 * (e.shiftKey ? 4 : 1);
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const next = clamp({ x: r.left + dx, y: r.top + dy });
    el.style.transition = 'none'; el.style.left = next.x + 'px'; el.style.top = next.y + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = '';
    setPos(next); writeJson(POS_KEY, next);
  };

  return {
    dragging,
    positionStyle: pos ? 'left: ' + pos.x + 'px; top: ' + pos.y + 'px;' : 'right: ' + MARGIN + 'px; bottom: ' + MARGIN + 'px;',
    handleProps: {
      onPointerDown, onPointerMove,
      onPointerUp: (e) => finish(e.currentTarget, e.pointerId, false),
      onPointerCancel: (e) => finish(e.currentTarget, e.pointerId, true),
      onLostPointerCapture: (e) => finish(e.currentTarget, e.pointerId, true),
      onDoubleClick: (e) => { if (isInteractive(e.target)) return; e.preventDefault(); reset(); },
    },
    gripKeyDown: onKeyDown,
  };
}

// ── Hotkey owner: bare "n" toggles the dock. Cmd/Ctrl/Alt+N stay with the browser, typing never triggers it. ──
export default function DevNotes({ sb, me, workspaceId }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  if (!open) return null;
  return <DevNotesCard sb={sb} me={me} workspaceId={workspaceId} onClose={() => setOpen(false)} />;
}

function DevNotesCard({ sb, me, workspaceId, onClose }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [fading, setFading] = useState(() => new Set());
  const [showDone, setShowDone] = useState(false);
  const [cat, setCat] = useState('idea');
  const [value, setValue] = useState('');
  const cardRef = useRef(null);
  const inputRef = useRef(null);
  const { dragging, positionStyle, handleProps, gripKeyDown } = useDrag(cardRef, true);

  useEffect(() => { const saved = readJson(CAT_KEY); if (CATS[saved]) setCat(saved); }, []);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const flash = (msg) => { setActionError(msg); window.setTimeout(() => setActionError((c) => (c === msg ? '' : c)), 3500); };
  const unfade = (id) => setFading((c) => { const s = new Set(c); s.delete(id); return s; });

  const fetchNotes = useCallback(async (quiet) => {
    if (!quiet) { setLoading(true); setLoadError(''); }
    const res = await sb.from('dev_notes').select('*').eq('workspace_id', workspaceId).order('sort_order').order('created_at', { ascending: false }).limit(1000);
    if (res.error) { if (!quiet) { setNotes([]); setLoadError(res.error.message); } }
    else { setNotes(sortNotes(res.data || [])); setFading(new Set()); }
    setLoading(false);
  }, [sb, workspaceId]);

  useEffect(() => { fetchNotes(false); }, [fetchNotes]);

  // Live refresh when another Super Admin changes the list.
  useEffect(() => {
    let t = 0;
    const ch = sb.channel('dev-notes-' + workspaceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_notes', filter: 'workspace_id=eq.' + workspaceId }, () => { clearTimeout(t); t = setTimeout(() => fetchNotes(true), 250); })
      .subscribe();
    return () => { clearTimeout(t); sb.removeChannel(ch); };
  }, [sb, workspaceId, fetchNotes]);

  // Esc closes, unless a drag owns it (the drag hook stops propagation on its own capture listener).
  useEffect(() => {
    if (dragging) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragging, onClose]);

  const pickCat = (c) => { setCat(c); writeJson(CAT_KEY, c); if (inputRef.current) inputRef.current.focus(); };

  const add = async () => {
    const content = value.trim();
    if (!content) return;
    setValue('');
    if (inputRef.current) inputRef.current.focus();
    const path = pagePath() || null;
    const tempId = 'tmp-' + Date.now();
    const top = notes.length ? Math.min(...notes.map((n) => n.sort_order)) : 1;
    const row = { workspace_id: workspaceId, content: content.slice(0, 2000), category: cat, priority: 'medium', page_path: path ? path.slice(0, 512) : null, sort_order: top - 1, created_by: me.id, created_by_email: me.email || null };
    setNotes((c) => sortNotes([{ ...row, id: tempId, is_resolved: false, created_at: new Date().toISOString() }, ...c]));
    const res = await sb.from('dev_notes').insert(row).select().single();
    if (res.error) { flash('Could not save that note: ' + res.error.message); setNotes((c) => c.filter((n) => n.id !== tempId)); }
    else setNotes((c) => sortNotes(c.map((n) => (n.id === tempId ? res.data : n))));
  };

  const resolve = async (note) => {
    const next = !note.is_resolved;
    const prev = notes;
    if (next) { setFading((c) => new Set(c).add(note.id)); setNotes((c) => c.map((n) => (n.id === note.id ? { ...n, is_resolved: true } : n))); }
    else setNotes((c) => sortNotes(c.map((n) => (n.id === note.id ? { ...n, is_resolved: false } : n))));
    const res = await sb.from('dev_notes').update({ is_resolved: next, resolved_at: next ? new Date().toISOString() : null, resolved_by: next ? me.id : null }).eq('id', note.id);
    if (res.error) { flash('Could not update that note'); setNotes(prev); unfade(note.id); return; }
    if (next && !showDone) window.setTimeout(() => { setNotes((c) => c.filter((n) => n.id !== note.id)); unfade(note.id); }, 300);
    else unfade(note.id);
  };

  const cycleCat = async (note) => {
    const nextCat = CAT_ORDER[(CAT_ORDER.indexOf(note.category) + 1) % CAT_ORDER.length];
    setNotes((c) => c.map((n) => (n.id === note.id ? { ...n, category: nextCat } : n)));
    const res = await sb.from('dev_notes').update({ category: nextCat }).eq('id', note.id);
    if (res.error) { flash('Could not change category'); setNotes((c) => c.map((n) => (n.id === note.id ? { ...n, category: note.category } : n))); }
  };

  const remove = async (id) => {
    const prev = notes;
    setNotes((c) => c.filter((n) => n.id !== id));
    const res = await sb.from('dev_notes').delete().eq('id', id);
    if (res.error) { flash('Could not delete that note'); setNotes(prev); }
  };

  const visible = useMemo(() => notes.filter((n) => showDone || !n.is_resolved), [notes, showDone]);
  const openCount = notes.filter((n) => !n.is_resolved).length;
  const meta = CATS[cat];

  const chipStyle = (on, c) => 'display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; ' +
    (on ? 'background: ' + c.soft + '; color: ' + c.ink + '; border: 1px solid ' + c.dot + '55;' : 'background: var(--surface-2); color: var(--muted); border: 1px solid var(--line-4);');
  const iconBtn = 'display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex: none; border: 0; border-radius: 8px; background: transparent; color: var(--muted); cursor: pointer;';

  return (
    <div data-dev-notes="" style={css('position: fixed; inset: 0; z-index: 90; pointer-events: none;')}>
      <div ref={cardRef} className="fb-devnotes" style={css('position: absolute; width: ' + WIDTH + 'px; max-width: calc(100vw - 32px); pointer-events: auto; ' + positionStyle)}>
        <div role="dialog" aria-label="Dev notes" className="fb-float" style={css('display: flex; flex-direction: column; max-height: min(72vh, 600px); border: 1px solid var(--line-4); border-radius: 18px; background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.22); overflow: hidden; font-family: var(--font-main);')}>
          {/* Header: the whole strip is the drag handle; buttons opt out. */}
          <div {...handleProps} title="Drag to move · double-click to reset" style={css('display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 8px; border-bottom: 1px solid var(--line-3); cursor: grab; user-select: none; touch-action: none; background: var(--surface-2);')}>
            <span role="button" tabIndex={0} onKeyDown={gripKeyDown} aria-label="Move Dev Notes. Arrow keys nudge, Shift for larger steps, double-click resets." style={css('display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 24px; border-radius: 6px; color: var(--faint);')}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.8" /><circle cx="15" cy="5" r="1.8" /><circle cx="9" cy="12" r="1.8" /><circle cx="15" cy="12" r="1.8" /><circle cx="9" cy="19" r="1.8" /><circle cx="15" cy="19" r="1.8" /></svg>
            </span>
            <span style={css('display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: none; border-radius: 10px; background: var(--inv); color: var(--inv-ink);')}>{P(I.terminal)}</span>
            <div style={css('flex: 1; min-width: 0;')}>
              <h2 style={css('margin: 0; font-size: 14px; font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>Dev Notes</h2>
              <p style={css('margin: 0; font-size: 11px; line-height: 1.3; color: var(--muted);')}>{openCount === 0 ? 'All clear' : openCount + ' open'}</p>
            </div>
            <button type="button" className="fb-ni" onClick={() => setShowDone((v) => { if (!v) fetchNotes(true); return !v; })} style={css('min-height: 32px; padding: 0 10px; border: 0; border-radius: 8px; font-size: 11.5px; font-weight: 600; cursor: pointer; ' + (showDone ? 'background: var(--chip); color: var(--ink);' : 'background: transparent; color: var(--muted);'))}>{showDone ? 'Hide done' : 'Show done'}</button>
            <button type="button" className="fb-ni" aria-label="Close dev notes" onClick={onClose} style={css(iconBtn)}>{P(I.close)}</button>
          </div>

          {/* Category chips */}
          <div style={css('display: flex; align-items: center; gap: 6px; padding: 12px 12px 6px;')}>
            {CAT_ORDER.map((c) => (
              <button key={c} type="button" aria-pressed={cat === c} onClick={() => pickCat(c)} style={css(chipStyle(cat === c, CATS[c]))}>
                {P(CAT_ICON[c], 'width: 12px; height: 12px')}{CATS[c].label}
              </button>
            ))}
          </div>

          {/* Quick add */}
          <form onSubmit={(e) => { e.preventDefault(); add(); }} style={css('margin: 0 12px 8px; display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 0 8px 0 12px; box-sizing: border-box; border: 1px solid ' + (value ? meta.dot + '99' : 'var(--border)') + '; border-radius: 12px; background: var(--surface-2);')}>
            <span aria-hidden="true" style={css('width: 8px; height: 8px; flex: none; border-radius: 999px; background: ' + meta.dot + ';')} />
            <input ref={inputRef} type="text" value={value} aria-label="Log a dev note" placeholder={meta.placeholder} autoComplete="off"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { if (value) setValue(''); else onClose(); } }}
              style={css('flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font-size: 13px; color: var(--ink); padding: 0;')} />
            {value.trim() ? (
              <button type="submit" style={css('display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0 10px; border: 0; border-radius: 8px; background: var(--inv); color: var(--inv-ink); font-size: 11.5px; font-weight: 700; cursor: pointer;')}>Log {P(I.enter, 'width: 12px; height: 12px')}</button>
            ) : (
              <kbd style={css('display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 6px; border: 1px solid var(--line-4); border-radius: 6px; background: var(--chip); color: var(--faint); font-family: var(--font-main); font-size: 10.5px; font-weight: 600;')}>{P(I.enter, 'width: 11px; height: 11px')} Enter</kbd>
            )}
          </form>

          {actionError ? <p role="alert" style={css('margin: 0 12px 8px; padding: 6px 10px; border-radius: 8px; background: var(--red-soft); color: var(--red-ink); font-size: 12px; font-weight: 600;')}>{actionError}</p> : null}

          {/* List */}
          <div style={css('flex: 1; min-height: 120px; overflow-y: auto; padding: 0 12px 12px; display: flex; flex-direction: column; gap: 6px;')}>
            {loading ? (
              <p role="status" style={css('margin: 0; padding: 36px 0; text-align: center; font-size: 12.5px; color: var(--muted);')}>Loading…</p>
            ) : loadError ? (
              <div style={css('padding: 28px 8px; text-align: center;')}>
                <p style={css('margin: 0; font-size: 13.5px; font-weight: 600;')}>Could not load dev notes</p>
                <p style={css('margin: 4px 0 12px; font-size: 12px; color: var(--muted);')}>{loadError}</p>
                <button type="button" onClick={() => fetchNotes(false)} style={css('min-height: 32px; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--ink); font-size: 12px; cursor: pointer;')}>Retry</button>
              </div>
            ) : visible.length === 0 ? (
              <div style={css('padding: 32px 16px; text-align: center;')}>
                <span style={css('display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; background: var(--chip); color: var(--muted); margin-bottom: 10px;')}>{P(I.terminal, 'width: 22px; height: 22px')}</span>
                <p style={css('margin: 0; font-size: 13.5px; font-weight: 600;')}>No dev notes</p>
                <p style={css('margin: 4px auto 0; max-width: 240px; font-size: 12px; line-height: 1.45; color: var(--muted);')}>Spot something to fix or improve? Jot it down above. It is tagged with the page you are on and shared with every Super Admin.</p>
              </div>
            ) : visible.map((n) => {
              const c = CATS[n.category] || CATS.idea;
              const author = authorOf(n);
              return (
                <div key={n.id} className="fb-devnote" style={css('position: relative; display: flex; align-items: stretch; overflow: hidden; border: 1px solid var(--line-3); border-radius: 12px; background: var(--surface-2); transition: opacity .3s ease;' + (fading.has(n.id) ? ' opacity: 0.4; pointer-events: none;' : ''))}>
                  <span aria-hidden="true" style={css('width: 3px; flex: none; background: ' + c.dot + ';')} />
                  <div style={css('flex: 1; min-width: 0; display: flex; align-items: flex-start; gap: 10px; padding: 9px 8px 9px 10px;')}>
                    <button type="button" aria-label={n.is_resolved ? 'Reopen note' : 'Mark as resolved'} onClick={() => resolve(n)} style={css('flex: none; margin-top: 1px; padding: 0; border: 0; background: transparent; cursor: pointer; color: ' + (n.is_resolved ? 'var(--green-ink)' : 'var(--faint)') + ';')}>{P(n.is_resolved ? I.check : I.circle)}</button>
                    <div style={css('flex: 1; min-width: 0;')}>
                      <div style={css('display: flex; align-items: flex-start; gap: 8px;')}>
                        <button type="button" aria-label={c.label + ' category, click to change'} title={c.label + ' · click to change'} onClick={() => cycleCat(n)} style={css('flex: none; width: 8px; height: 8px; margin-top: 6px; padding: 0; border: 0; border-radius: 999px; cursor: pointer; background: ' + c.dot + ';')} />
                        <p style={css('flex: 1; min-width: 0; margin: 0; font-size: 12.5px; font-weight: 500; line-height: 1.4; overflow-wrap: anywhere; ' + (n.is_resolved ? 'color: var(--muted); text-decoration: line-through;' : ''))}>{n.content}</p>
                        <button type="button" className="fb-devnote-x" aria-label="Delete note" onClick={() => remove(n.id)} style={css('flex: none; padding: 2px; border: 0; background: transparent; cursor: pointer; color: var(--faint); opacity: 0;')}>{P(I.trash, 'width: 13px; height: 13px')}</button>
                      </div>
                      <div style={css('display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 10.5px; color: var(--muted); min-width: 0;')}>
                        <span style={css('font-weight: 700; color: ' + c.ink + ';')}>{c.label}</span>
                        {author ? <><span style={css('color: var(--faint);')}>·</span><span style={css('flex: none;')}>{author}</span></> : null}
                        {n.page_path ? <><span style={css('color: var(--faint);')}>·</span><span style={css('overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')} title={n.page_path}>{n.page_path}</span></> : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
