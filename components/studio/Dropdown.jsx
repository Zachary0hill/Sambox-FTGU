'use client';
// app: single-choice dropdown for forms, in place of a native select. Options can carry an icon and a note.
// The menu is portaled to the studio root and placed with position: fixed, so a scrolling or transformed dialog
// cannot clip it; it opens upward when there is no room below. Keys: up and down move, Home and End jump,
// Enter or Space picks, a letter jumps to the next match, Tab and Esc close. searchable adds a filter box for long
// lists; typing then filters, and Enter picks the highlighted row.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { css } from '@/lib/studio/css';
import { popStyle, rowStyle, rowLabelStyle, rowMetaStyle, scrimStyle, fieldLabelStyle } from '@/lib/studio/prims';
import { Icon, IC } from './Prims';

const MENU_MAX = 420;
const GAP = 6;

export default function Dropdown({ id, label, hideLabel, value, options, onChange, display, placeholder = 'Select', minMenuWidth = 220, size = 40, disabled, searchable, searchLabel = 'Search' }) {
  const auto = useId();
  const fid = id || auto;
  const btn = useRef(null);
  const menu = useRef(null);
  const search = useRef(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(0);
  const [pos, setPos] = useState(null);
  const [root, setRoot] = useState(null);
  const [q, setQ] = useState('');
  const current = options.find((o) => o.value === value) || null;
  const shown = display || current;
  const needle = q.trim().toLowerCase();
  const list = searchable && needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;

  const place = () => {
    const r = btn.current.getBoundingClientRect();
    const h = menu.current ? menu.current.offsetHeight : MENU_MAX;
    const width = Math.min(Math.max(r.width, minMenuWidth), window.innerWidth - 16);
    const below = window.innerHeight - r.bottom - GAP - 8;
    const up = below < h && r.top - GAP - 8 > below;
    setPos({
      width,
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      top: up ? Math.max(8, r.top - GAP - h) : r.bottom + GAP,
      maxH: Math.min(MENU_MAX, Math.max(160, (up ? r.top : window.innerHeight - r.bottom) - GAP - 8))
    });
  };
  const close = (refocus) => {
    setOpen(false);
    setPos(null);
    if (refocus !== false && btn.current) btn.current.focus({ preventScroll: true });
  };
  const show = () => {
    setQ('');
    setAct(Math.max(0, options.indexOf(current)));
    setRoot(btn.current.closest('[data-studio-root]') || document.body);
    setOpen(true);
  };
  const choose = (o) => {
    if (o.value !== value) onChange(o.value);
    close();
  };

  // Placed once the hidden menu is in the page, so the flip uses its real height.
  // Filtering changes that height, so an upward menu stays attached to its button.
  useLayoutEffect(() => { if (open) place(); }, [open, q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const onScroll = (e) => { if (!menu.current || !menu.current.contains(e.target)) close(false); };
    const onResize = () => close(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize); };
  }, [open]);
  // Waits for placement: a menu that is still hidden cannot take focus.
  const placed = !!pos;
  useEffect(() => { const el = search.current || menu.current; if (open && placed && el) el.focus({ preventScroll: true }); }, [open, placed]);
  useEffect(() => {
    const row = open && menu.current ? menu.current.querySelector('[data-active]') : null;
    if (row) row.scrollIntoView({ block: 'nearest' });
  }, [open, act]);

  const onMenuKey = (e) => {
    const n = list.length;
    // In the filter box, characters and the caret keys belong to the text.
    if (searchable && (e.key.length === 1 || e.key === 'Home' || e.key === 'End')) return;
    if (e.key === 'ArrowDown') { if (n) setAct((act + 1) % n); }
    else if (e.key === 'ArrowUp') { if (n) setAct((act - 1 + n) % n); }
    else if (e.key === 'Home') setAct(0);
    else if (e.key === 'End') setAct(n - 1);
    else if (e.key === 'Enter' || e.key === ' ') { if (list[act]) choose(list[act]); }
    else if (e.key === 'Escape' || e.key === 'Tab') close();
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      const now = e.timeStamp;
      const text = (now - typed.current.at < 600 ? typed.current.text : '') + e.key.toLowerCase();
      typed.current = { text, at: now };
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(text));
      if (hit >= 0) setAct(hit);
    } else return;
    e.preventDefault();
    // Keeps Esc and the arrows from reaching the dialog around the dropdown.
    e.stopPropagation();
  };
  const onBtnKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(); }
  };

  const listId = fid + '-list';
  const listProps = { id: listId, role: 'listbox', 'aria-label': label };
  const rows = list.map((o, i) => (
    <div key={o.value} id={listId + '-' + i} role="option" aria-selected={o.value === value} data-active={i === act ? '' : undefined}
      onMouseMove={() => { if (act !== i) setAct(i); }} onClick={() => choose(o)} style={css(rowStyle({ active: i === act }))}>
      {o.icon ? o.icon : null}
      <span style={css(rowLabelStyle)}>{o.label}</span>
      {o.note ? <span style={css(rowMetaStyle)}>{o.note}</span> : null}
      {o.value === value ? <Icon d={IC.check} sw={1.75} style="flex: none; color: var(--ink)" /> : null}
    </div>
  ));
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px; min-width: 0')}>
      {label && !hideLabel ? <label htmlFor={fid} style={css(fieldLabelStyle)}>{label}</label> : null}
      <button ref={btn} id={fid} type="button" className="fb-dd" aria-label={label && hideLabel ? label : undefined} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} disabled={disabled}
        onClick={() => (open ? close() : show())} onKeyDown={onBtnKey}
        style={css('display: flex; align-items: center; gap: 8px; width: 100%; height: ' + size + 'px; box-sizing: border-box; padding: 0 10px 0 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); font-size: 14px; font-weight: 400; letter-spacing: normal; text-align: left; cursor: ' + (disabled ? 'default' : 'pointer') + '; color: ' + (shown ? 'var(--ink)' : 'var(--faint)') + (disabled ? '; opacity: 0.6' : ''))}>
        {shown && shown.icon ? shown.icon : null}
        <span style={css(rowLabelStyle)}>{shown ? shown.label : placeholder}</span>
        {shown && shown.note ? <span style={css(rowMetaStyle)}>{shown.note}</span> : null}
        <Icon d={IC.chevD} size={14} sw={1.75} style={'flex: none; color: var(--muted-2); transition: transform .12s ease; transform: rotate(' + (open ? 180 : 0) + 'deg)'} />
      </button>
      {open && root ? createPortal(
        <>
          <button type="button" tabIndex={-1} aria-label="Close" onClick={() => close()} style={css(scrimStyle + ' position: fixed; z-index: 60;')}></button>
          <div data-modal-portal="" ref={menu} {...(searchable ? {} : listProps)} tabIndex={-1} aria-activedescendant={searchable ? undefined : listId + '-' + act} onKeyDown={onMenuKey} className="fb-pop"
            style={css(popStyle({ width: pos ? pos.width : minMenuWidth, maxH: pos ? pos.maxH : MENU_MAX, top: (pos ? pos.top : 0) + 'px', x: pos ? pos.left : 0 }) + ' position: fixed; z-index: 61; outline: none;' + (searchable ? ' overflow: hidden;' : '') + (pos ? '' : ' visibility: hidden;'))}>
            {searchable ? (
              <>
                <div style={css('display: flex; align-items: center; flex: none; gap: 8px; height: 40px; margin: -8px -8px 6px; padding: 0 14px; border-bottom: 1px solid var(--line); color: var(--muted-2)')}>
                  <Icon d={IC.search} sw={1.5} style="flex: none" />
                  <input ref={search} type="text" role="combobox" aria-expanded="true" aria-controls={listId} aria-label={searchLabel} aria-activedescendant={list.length ? listId + '-' + act : undefined} autoComplete="off" spellCheck="false" placeholder={searchLabel} value={q}
                    onChange={(e) => { setQ(e.target.value); setAct(0); }} style={css('flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; outline: none; background: transparent; font-size: 14px; font-weight: 400; color: var(--ink)')} />
                </div>
                <div {...listProps} style={css('flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 2px; overflow-y: auto')}>
                  {rows}
                  {list.length ? null : <p style={css('margin: 0; padding: 10px; font-size: 13px; font-weight: 400; color: var(--muted-2)')}>No matches</p>}
                </div>
              </>
            ) : rows}
          </div>
        </>, root) : null}
    </div>
  );
}
