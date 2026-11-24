'use client';
// Small shared parts for the workflow builder screens: icons, the kind tile, the pill segmented control, button styles
// and the modal layer hook. Colors and sizes come from lib/workflow/theme.js.
import { useEffect, useRef } from 'react';
import { css } from '@/lib/studio/css';
import { T, KIND, R } from '@/lib/workflow/theme';

export const ICON = {
  back: 'm15 18-6-6 6-6', chev: 'm9 18 6-6-6-6', close: 'M18 6 6 18M6 6l12 12', plus: 'M12 5v14M5 12h14', check: 'M20 6 9 17l-5-5',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2', settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  play: 'M6 4l14 8-14 8V4z', warn: 'M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2', bolt: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  fit: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M19 12l-7 7-7-7', trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
};
export const Svg = ({ d, size = 16, sw = 2, color = 'currentColor' }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d={d} /></svg>
);
export const srOnly = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;';

// Kind icon tile: 30px in the library, 38px on canvas cards, 42px in the inspector.
export function KindTile({ kind, size = 30 }) {
  const k = KIND[kind] || KIND.action;
  return (
    <span style={css('width: ' + size + 'px; height: ' + size + 'px; flex: none; border-radius: ' + Math.round(size * 0.29) + 'px; background: ' + k.bg + '; display: flex; align-items: center; justify-content: center;')}>
      <Svg d={k.icon} size={Math.round(size * 0.47)} sw={2.2} color={k.ink} />
    </span>
  );
}

export const btn = (kind, h = 42) => 'height: ' + h + 'px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 14px; border-radius: ' + (h >= 42 ? R.control : R.small) + 'px; font-weight: 600; font-size: 14px; white-space: nowrap; text-decoration: none; ' +
  (kind === 'primary' ? 'background: ' + T.accent + '; color: ' + T.accentInk + '; border: 1px solid ' + T.accent + ';'
    : kind === 'danger' ? 'background: ' + T.surface + '; color: ' + T.error + '; border: 1px solid ' + T.errorLine + ';'
      : kind === 'quiet' ? 'background: ' + T.ground2 + '; color: ' + T.ink + '; border: 1px solid ' + T.border + ';'
        : 'background: ' + T.surface + '; color: ' + T.ink + '; border: 1px solid ' + T.inputLine + ';');
export const inputStyle = 'width: 100%; min-height: 44px; padding: 0 12px; border-radius: ' + R.control + 'px; background: ' + T.surface + '; border: 1.5px solid ' + T.chipLine + '; color: ' + T.ink + '; font-family: inherit; font-size: 14px;';
export const labelStyle = 'font-size: 14px; font-weight: 600; color: ' + T.ink + ';';

// Pill segmented control (status, All/Any, Preview/Edit): one choice, arrow keys move it.
export function Seg({ label, options, value, onChange, h = 42 }) {
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = Math.max(0, options.findIndex((o) => o[0] === value));
    const n = (i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length;
    onChange(options[n][0]);
    const b = e.currentTarget.querySelectorAll('button')[n];
    if (b) b.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} style={css('display: flex; flex: none; background: ' + T.surface + '; border: 1px solid ' + T.inputLine + '; border-radius: 999px; padding: 3px; height: ' + h + 'px;')}>
      {options.map((o) => {
        const on = o[0] === value;
        return (
          <button key={o[0]} type="button" role="radio" aria-checked={on} tabIndex={on || (!options.some((x) => x[0] === value) && o === options[0]) ? 0 : -1} onClick={() => onChange(o[0])}
            style={css('padding: 0 14px; border-radius: 999px; background: ' + (on ? T.accent : 'transparent') + '; color: ' + (on ? T.accentInk : T.ink2) + '; border: 0; font-weight: 600; font-size: 13px;')}>{o[1]}</button>
        );
      })}
    </div>
  );
}

// Modal layers: everything outside the layer is inert while it is open, focus moves in on open and goes back where
// it was on close.
export function useModal(ref, focusSel) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const before = document.activeElement;
    const off = [];
    for (let n = el; n.parentElement && n !== document.body; n = n.parentElement) {
      for (const sib of n.parentElement.children) {
        if (sib !== n && !sib.hasAttribute('inert') && sib.tagName !== 'SCRIPT' && sib.tagName !== 'STYLE') { sib.setAttribute('inert', ''); off.push(sib); }
      }
    }
    const first = (focusSel && el.querySelector(focusSel)) || el.querySelector('button, input, select, textarea');
    if (first && !el.contains(document.activeElement)) first.focus({ preventScroll: true });
    return () => {
      off.forEach((x) => x.removeAttribute('inert'));
      if (before && typeof before.focus === 'function' && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---------- Dialog pattern (Settings, Trigger setup, Condition builder) ----------
// A centered dialog over the dimmed builder: eyebrow and display title, close x, a scrolling body, and a footer with
// the change state on the left ("No changes", "Unsaved changes", "Saved"), then Cancel (Back to builder once there is
// nothing unsaved) and the primary Save.
export function Dialog({ id, eyebrow, title, width = 720, headerExtra, state, saveLabel, onSave, saveOff, onClose, children, bodyStyle, actionOnly }) {
  const layer = useRef(null);
  useModal(layer);
  const dirty = state === 'dirty';
  return (
    <div ref={layer} className="wf-dlg" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={css('position: fixed; inset: 0; z-index: 72; background: rgba(17,17,17,.32); display: flex; justify-content: center; align-items: flex-start; padding: 48px 16px; overflow-y: auto;')}>
      <div role="dialog" aria-modal="true" aria-labelledby={id + '-t'} className="wf-pop wf-dlg-box" style={css('width: ' + width + 'px; max-width: 100%; max-height: calc(100vh - 96px); background: ' + T.surface + '; border-radius: 20px; box-shadow: 0 24px 64px rgba(0,0,0,.2); display: flex; flex-direction: column; overflow: hidden; color: ' + T.ink + ';')}>
        <div style={css('display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 20px 24px; border-bottom: 1px solid ' + T.line + '; flex-wrap: wrap;')}>
          <div style={css('min-width: 0;')}>
            <div style={css('font-size: 13px; color: ' + T.muted + ';')}>{eyebrow}</div>
            <h1 id={id + '-t'} style={css('margin: 2px 0 0; font-family: var(--font-title); font-weight: 900; font-size: 24px; line-height: 1.2; letter-spacing: -.02em; overflow-wrap: anywhere;')}>{title}</h1>
          </div>
          <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
            {headerExtra}
            <button type="button" className="wf-h" aria-label="Close" onClick={onClose} style={css('width: 40px; height: 40px; flex: none; border: 0; border-radius: 10px; background: transparent; color: ' + T.ink + '; display: flex; align-items: center; justify-content: center;')}><Svg d={ICON.close} size={18} /></button>
          </div>
        </div>
        <div className="wf-sc" style={css('flex: 1; min-height: 0; overflow: auto;' + (bodyStyle || ''))}>{children}</div>
        <div style={css('display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 16px 24px; border-top: 1px solid ' + T.line + '; background: ' + T.ground + ';')}>
          <span aria-live="polite" style={css('font-size: 13px; color: ' + T.muted + '; margin-right: auto; font-weight: 500;')}>{actionOnly ? '' : state === 'saved' ? 'Saved' : dirty ? 'Unsaved changes' : 'No changes'}</span>
          <button type="button" className="wf-h" onClick={onClose} style={css(btn('ghost', 44) + ' padding: 0 16px;')}>{actionOnly ? 'Back to workflow' : dirty ? 'Cancel' : 'Back to builder'}</button>
          <button type="button" className="wf-k" disabled={!dirty || saveOff} onClick={onSave} style={css(btn('primary', 44) + ' padding: 0 18px;' + (!dirty || saveOff ? ' opacity: .45; cursor: default;' : ''))}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Grey segmented control with a white selected segment (Wait between tries, All/Any, minutes, AM/PM, trigger type).
export function MiniSeg({ label, options, value, onChange, h = 36, role = 'radiogroup' }) {
  const tab = role === 'tablist';
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = Math.max(0, options.findIndex((o) => o[0] === value));
    const n = (i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length;
    onChange(options[n][0]);
    const b = e.currentTarget.querySelectorAll('button')[n];
    if (b) b.focus();
  };
  return (
    <div role={role} aria-label={label} onKeyDown={onKey} style={css('display: flex; flex: none; background: ' + T.count + '; border-radius: 12px; padding: 4px;')}>
      {options.map((o) => {
        const on = o[0] === value;
        return (
          <button key={o[0]} type="button" role={tab ? 'tab' : 'radio'} aria-selected={tab ? on : undefined} aria-checked={tab ? undefined : on} tabIndex={on ? 0 : -1} onClick={() => onChange(o[0])}
            style={css('height: ' + h + 'px; display: flex; align-items: center; gap: 7px; padding: 0 12px; border-radius: 9px; background: ' + (on ? T.surface : 'transparent') + '; color: ' + (on ? T.ink : T.sub) + '; box-shadow: ' + (on ? '0 1px 2px rgba(0,0,0,.08)' : 'none') + '; border: 0; font-size: ' + (h >= 38 ? 14 : 13) + 'px; font-weight: 600; white-space: nowrap;')}>{o[2] ? <Svg d={o[2]} size={15} /> : null}{o[1]}</button>
        );
      })}
    </div>
  );
}

export function Switch({ on, label, onChange, tone }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} style={css('width: 56px; height: 44px; flex: none; background: transparent; border: 0; padding: 0; display: flex; align-items: center; justify-content: center;')}>
      <span style={css('width: 44px; height: 26px; border-radius: 999px; background: ' + (on ? tone || T.accent : T.pillOn) + '; position: relative; display: block; transition: background .15s ease;')}>
        <span style={css('position: absolute; top: 3px; left: ' + (on ? 21 : 3) + 'px; width: 20px; height: 20px; border-radius: 999px; background: ' + T.knob + '; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: left .15s ease;')} />
      </span>
    </button>
  );
}

export function Stepper({ text, width = 72, h = 42, onLess, onMore, lessLabel, moreLabel, lessOff, moreOff, big }) {
  const b = (side) => 'width: ' + h + 'px; height: ' + h + 'px; border-radius: ' + (side === 'l' ? '12px 0 0 12px' : '0 12px 12px 0') + '; background: transparent; border: 0; color: ' + T.ink + '; font-size: 18px;';
  return (
    <div style={css('display: flex; align-items: center; flex: none; border: 1px solid ' + T.inputLine + '; border-radius: 12px;')}>
      <button type="button" className="wf-h" aria-label={lessLabel} disabled={lessOff} onClick={onLess} style={css(b('l') + (lessOff ? ' opacity: .35;' : ''))}>−</button>
      <span aria-live="polite" style={css('width: ' + width + 'px; text-align: center; font-weight: ' + (big ? 900 : 600) + '; font-size: ' + (big ? 24 : 15) + 'px;' + (big ? ' font-family: var(--font-title);' : ''))}>{text}</span>
      <button type="button" className="wf-h" aria-label={moreLabel} disabled={moreOff} onClick={onMore} style={css(b('r') + (moreOff ? ' opacity: .35;' : ''))}>+</button>
    </div>
  );
}

// A native select drawn as a pill: tone 'var' is the blue field chip, otherwise a white outlined pill.
export function PillSelect({ label, value, onChange, options, tone, placeholder }) {
  return (
    <span style={css('position: relative; display: inline-flex; flex: none; max-width: 100%;')}>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        style={css('height: 44px; max-width: 100%; appearance: none; -webkit-appearance: none; padding: 0 30px 0 12px; border-radius: 999px; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; ' + (tone === 'var' ? 'background: ' + T.varBg + '; border: 1px solid transparent; color: ' + T.varInk + ';' : 'background: ' + T.surface + '; border: 1px solid ' + T.inputLine + '; color: ' + T.ink + ';'))}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
      </select>
      <span aria-hidden="true" style={css('position: absolute; right: 11px; top: 50%; transform: translateY(-50%) rotate(90deg); pointer-events: none; display: flex; color: ' + (tone === 'var' ? T.varInk : T.ink) + ';')}><Svg d={ICON.chev} size={12} sw={2.4} /></span>
    </span>
  );
}
