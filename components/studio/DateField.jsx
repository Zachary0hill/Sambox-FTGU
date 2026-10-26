'use client';
// app: calendar date field for dialogs, in place of the browser's native date input.
// Value is an ISO day ("2026-10-22") or ''. The panel is fixed to the viewport so a scrolling dialog can't clip it.
import { useEffect, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const PANEL_H = 360;

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const shown = (d) => MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate() + ', ' + d.getFullYear();

export default function DateField({ id, value, onChange, placeholder = 'Pick a date', weekStart = 0 }) {
  const sel = parse(value);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [focus, setFocus] = useState(() => sel || new Date());
  const btnRef = useRef(null);
  const gridRef = useRef(null);

  const close = (refocus) => { setOpen(false); if (refocus && btnRef.current) btnRef.current.focus(); };

  function toggle() {
    if (open) return close(false);
    const b = btnRef.current.getBoundingClientRect();
    setRect({ top: b.top, bottom: b.bottom, left: b.left, width: b.width, vh: window.innerHeight, vw: window.innerWidth });
    setFocus(sel || new Date());
    setOpen(true);
  }

  // Any scroll or resize would detach the fixed panel from its field, so close it.
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (gridRef.current && gridRef.current.contains(e.target)) return; setOpen(false); };
    window.addEventListener('scroll', off, true);
    window.addEventListener('resize', off);
    return () => { window.removeEventListener('scroll', off, true); window.removeEventListener('resize', off); };
  }, [open]);

  // Keep keyboard focus on the focused day as it moves.
  useEffect(() => {
    if (!open || !gridRef.current) return;
    const el = gridRef.current.querySelector('[data-day="' + isoOf(focus) + '"]');
    if (el) el.focus();
  }, [open, focus]);

  const pick = (d) => { onChange(isoOf(d)); close(true); };
  const move = (days) => setFocus((f) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + days));
  const moveMonth = (n) => setFocus((f) => { const last = new Date(f.getFullYear(), f.getMonth() + n + 1, 0).getDate(); return new Date(f.getFullYear(), f.getMonth() + n, Math.min(f.getDate(), last)); });

  function onKey(e) {
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(true); }
    if (k === 'Tab') return;
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (map[k]) { e.preventDefault(); return move(map[k]); }
    if (k === 'PageUp' || k === 'PageDown') { e.preventDefault(); return moveMonth(k === 'PageUp' ? -1 : 1); }
    if (k === 'Home') { e.preventDefault(); return move(-((focus.getDay() - weekStart + 7) % 7)); }
    if (k === 'End') { e.preventDefault(); return move(6 - ((focus.getDay() - weekStart + 7) % 7)); }
  }

  const today = new Date();
  const todayIso = isoOf(today);
  const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
  // weekStart 1 starts weeks on Monday (Workspace Settings > General).
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - ((first.getDay() - weekStart + 7) % 7));
  const dow = DOW.slice(weekStart).concat(DOW.slice(0, weekStart));
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));

  let panel = '';
  if (rect) {
    const below = rect.vh - rect.bottom - 16, up = below < PANEL_H && rect.top - 16 > below;
    const w = Math.max(296, Math.min(rect.width, 340));
    const left = Math.max(16, Math.min(rect.left, rect.vw - w - 16));
    panel = 'position: fixed; z-index: 70; left: ' + left + 'px; width: ' + w + 'px; ' + (up ? 'bottom: ' + (rect.vh - rect.top + 6) : 'top: ' + (rect.bottom + 6)) + 'px; box-sizing: border-box; padding: 12px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.14); color: var(--ink); font-family: var(--font-main);';
  }
  const navBtn = 'width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 10px; background: transparent; color: var(--ink); cursor: pointer;';
  const footBtn = 'min-height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; font-size: 13px; font-weight: 600; cursor: pointer;';
  const monthLabel = MONTHS[focus.getMonth()] + ' ' + focus.getFullYear();

  return (
    <div style={css('position: relative; width: 100%;' + (open ? ' z-index: 60;' : ''))}>
      <button ref={btnRef} id={id} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={toggle} style={css('position: relative; z-index: 2; width: 100%; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 14px; border-radius: 12px; border: 1px solid ' + (open ? 'var(--ink)' : 'var(--border)') + '; background: var(--surface-2); cursor: pointer; text-align: left; font-size: 14px; font-weight: 500; color: var(--ink);')}>
        <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' + (sel ? '' : ' color: var(--faint, #8A8A8A); font-weight: 400;'))}>{sel ? shown(sel) : placeholder}</span>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css('flex: none; color: var(--muted-2);')}><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>
      </button>
      {open ? (
        <>
          <button type="button" tabIndex="-1" aria-label="Close calendar" onClick={() => close(false)} style={css('position: fixed; inset: 0; z-index: 69; border: 0; background: transparent; cursor: default')}></button>
          <div role="dialog" aria-modal="false" aria-label={'Choose date, ' + monthLabel} onKeyDown={onKey} style={css(panel)}>
            <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;')}>
              <button type="button" className="fb-ni" aria-label="Previous month" onClick={() => moveMonth(-1)} style={css(navBtn)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M10 4L6 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>
              <p aria-live="polite" style={css('margin: 0; font-size: 14px; font-weight: 700;')}>{monthLabel}</p>
              <button type="button" className="fb-ni" aria-label="Next month" onClick={() => moveMonth(1)} style={css(navBtn)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>
            </div>
            <div ref={gridRef} role="grid" aria-label={monthLabel} style={css('display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;')}>
              {dow.map((d) => <span key={d} role="columnheader" style={css('height: 28px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: var(--muted);')}>{d}</span>)}
              {days.map((d) => {
                const iso = isoOf(d);
                const inMonth = d.getMonth() === focus.getMonth();
                const isSel = !!sel && iso === isoOf(sel);
                const isToday = iso === todayIso;
                const isFocus = iso === isoOf(focus);
                return (
                  <button key={iso} type="button" role="gridcell" data-day={iso} tabIndex={isFocus ? 0 : -1} aria-selected={isSel} aria-current={isToday ? 'date' : undefined} aria-label={shown(d)} onClick={() => pick(d)} className={isSel ? undefined : 'mitem'}
                    style={css('height: 36px; padding: 0; border: 0; border-radius: 10px; cursor: pointer; font-size: 13px; font-variant-numeric: tabular-nums; ' + (isSel ? 'background: var(--inv); color: var(--inv-ink); font-weight: 700;' : 'background: transparent; font-weight: ' + (isToday ? '700' : '500') + '; color: ' + (inMonth ? 'var(--ink)' : 'var(--faint, #8A8A8A)') + ';' + (isToday ? ' box-shadow: inset 0 0 0 1px var(--border);' : '')))}>
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div style={css('display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line-4);')}>
              <button type="button" className="fb-ni" onClick={() => { onChange(''); close(true); }} disabled={!sel} style={css(footBtn + ' color: var(--red-ink, #9B1C13);' + (sel ? '' : ' opacity: 0.4; cursor: default;'))}>Clear</button>
              <button type="button" className="fb-ni" onClick={() => pick(today)} style={css(footBtn + ' color: var(--ink);')}>Today</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
