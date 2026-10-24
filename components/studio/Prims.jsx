'use client';
// app: shared primitives for the column system (docs/design/database-components, step 1).
// Styles live in lib/studio/prims.js; hover and focus states in the .fb-mr / .fb-field / .fb-sw rules in globals.css.
import { useEffect, useId, useRef } from 'react';
import { css } from '@/lib/studio/css';
import { OPTION_COLORS } from '@/lib/studio/tones';
import {
  popStyle, scrimStyle, rowStyle, rowIconStyle, rowLabelStyle, rowMetaStyle, chevStyle, labelStyle, labelActionStyle, iconBtnStyle, dividerStyle,
  fieldStyle, inputStyle, textareaStyle, fieldAddonStyle, fieldLabelStyle, toggleStyle, segStyle, segBtnStyle, chipStyle, chipTextStyle, chipRemoveStyle,
  dotStyle, swatchStyle, swatchGridStyle, btnStyle,
} from '@/lib/studio/prims';

export { popAlign } from '@/lib/studio/prims';

// 16px grid, 1.5 stroke, from the comps.
export const IC = {
  search: 'M7 2.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9zM10.5 10.5L13.5 13.5',
  check: 'M3.5 8.5l3 3 6-7',
  chevR: 'M6 4l4 4-4 4',
  chevD: 'M4 6l4 4 4-4',
  x: 'M4 4l8 8M12 4l-8 8',
  plus: 'M8 3v10M3 8h10',
  back: 'M13 8H3M7 4L3 8l4 4',
  drag: 'M6 4h.01M6 8h.01M6 12h.01M10 4h.01M10 8h.01M10 12h.01',
  more: 'M3.5 8h.01M8 8h.01M12.5 8h.01',
  trash: 'M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 9h6.6l.7-9'
};

export function Icon({ d, size = 16, sw = 1.5, style }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={css(style || 'flex: none')}>
      <path d={d}></path>
    </svg>
  );
}

const ROW_SEL = '[data-row]:not(:disabled)';

// Popover: sits under its anchor (the anchor needs position: relative, and a z-index while open).
// Focuses the first field or row on open. Esc closes and returns focus; arrows, Home and End move between rows.
// scrim: a click outside closes it (default when onClose is set). A submenu passes false so its menu stays clickable.
export function Popover({ label, role = 'dialog', onClose, scrim, align, width, pad, top, maxH, x, autoFocus = true, children }) {
  const ref = useRef(null);
  const back = useRef(null);
  useEffect(() => {
    // Keep the first opener: a second run (React StrictMode in development) would find the popover's own field.
    const a = document.activeElement;
    if (!back.current && !(ref.current && ref.current.contains(a))) back.current = a;
    if (!autoFocus || !ref.current) return;
    const el = ref.current.querySelector('[data-autofocus], input, textarea, ' + ROW_SEL);
    if (!el) return;
    el.focus({ preventScroll: true });
    // A prefilled name field opens selected, ready to type over.
    if (el.tagName === 'INPUT' && el.value && el.hasAttribute('data-autofocus')) el.select();
  }, [autoFocus]);
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (onClose) onClose();
      if (back.current && back.current.focus && document.contains(back.current)) back.current.focus({ preventScroll: true });
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) < 0) return;
    const t = e.target;
    if (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && (e.key === 'Home' || e.key === 'End'))) return;
    // Only this popover's rows, not those of a submenu nested inside it.
    const rows = Array.from(ref.current.querySelectorAll(ROW_SEL)).filter((r) => r.closest('[data-pop]') === ref.current);
    if (!rows.length) return;
    const i = rows.indexOf(t.closest('[data-row]'));
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1
      : e.key === 'ArrowDown' ? (i < 0 ? 0 : (i + 1) % rows.length) : (i <= 0 ? rows.length - 1 : i - 1);
    e.preventDefault(); e.stopPropagation();
    rows[n].focus();
  };
  return (
    <>
      {onClose && scrim !== false ? <button type="button" tabIndex={-1} aria-label="Close" onClick={onClose} style={css(scrimStyle)}></button> : null}
      <div ref={ref} data-pop="" role={role} aria-label={label} onKeyDown={onKey} style={css(popStyle({ align, width, pad, top, maxH, x }))}>
        {children}
      </div>
    </>
  );
}

// Menu row. With `toggle` the whole row is the switch; `checked` adds the selected check; `sub` a submenu chevron.
export function MenuRow({ icon, label, meta, sub, checked, toggle, danger, disabled, active, h, onClick, children, ...rest }) {
  const isSwitch = toggle !== undefined;
  const sw = isSwitch ? toggleStyle(!!toggle, 'sm', disabled) : null;
  return (
    <button type="button" data-row="" className="fb-mr" disabled={disabled} onClick={onClick} {...rest}
      role={isSwitch ? 'switch' : rest.role} aria-checked={isSwitch ? !!toggle : rest['aria-checked']}
      style={css(rowStyle({ h, danger, disabled, active: active || checked }))}>
      {icon ? <Icon d={icon} style={rowIconStyle(danger, disabled)} /> : null}
      {children || <span style={css(rowLabelStyle)}>{label}</span>}
      {meta ? <span style={css(rowMetaStyle)}>{meta}</span> : null}
      {isSwitch ? <span aria-hidden="true" style={css(sw.track)}><span style={css(sw.knob)}></span></span> : null}
      {checked ? <Icon d={IC.check} sw={1.75} style="flex: none; color: var(--ink)" /> : null}
      {sub ? <Icon d={IC.chevR} size={14} style={chevStyle} /> : null}
    </button>
  );
}

// Section label, with an optional text action ("Hide all") or add button.
export function MenuLabel({ children, id, actionText, onAction, addLabel, onAdd }) {
  return (
    <div style={css(labelStyle)}>
      <span id={id}>{children}</span>
      {actionText ? <button type="button" className="fb-ni" onClick={onAction} style={css(labelActionStyle)}>{actionText}</button> : null}
      {addLabel ? <button type="button" className="fb-ni" aria-label={addLabel} onClick={onAdd} style={css(iconBtnStyle(24))}><Icon d={IC.plus} size={14} /></button> : null}
    </div>
  );
}

export function Divider() {
  return <div role="separator" style={css(dividerStyle)}></div>;
}

// Field: 40px default ('sm' 36 for menu search, 'lg' 48 for modals). `chips` render before the input, as in the multi select picker.
export function Field({ id, label, hideLabel, size = 'md', icon, prefix, suffix, chips, multiline, rows = 3, align, strong, mono, inputRef, ...input }) {
  const auto = useId();
  const fid = id || auto;
  const own = useRef(null);
  const ref = inputRef || own;
  const focus = (e) => { if (e.target === e.currentTarget && ref.current) { e.preventDefault(); ref.current.focus(); } };
  const Tag = multiline ? 'textarea' : 'input';
  const st = multiline ? textareaStyle({ size, align, strong, mono }) : inputStyle({ size, align, strong, mono });
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px; min-width: 0')}>
      {label && !hideLabel ? <label htmlFor={fid} style={css(fieldLabelStyle)}>{label}</label> : null}
      <div className="fb-field" onMouseDown={focus} style={css(fieldStyle({ size, multi: multiline, chips: !!chips }))}>
        {icon ? <Icon d={icon} style="flex: none; color: var(--muted-2)" /> : null}
        {prefix ? <span aria-hidden="true" style={css(fieldAddonStyle)}>{prefix}</span> : null}
        {chips}
        <Tag ref={ref} id={fid} aria-label={label && hideLabel ? label : undefined} rows={multiline ? rows : undefined}
          type={multiline ? undefined : (input.type || 'text')} {...input} style={css(st)} />
        {suffix ? <span style={css(fieldAddonStyle)}>{suffix}</span> : null}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label, size = 'sm', disabled }) {
  const t = toggleStyle(!!on, size, disabled);
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} disabled={disabled} className="fb-sw" onClick={() => onChange && onChange(!on)} style={css(t.track)}>
      <span style={css(t.knob)}></span>
    </button>
  );
}

// Segmented control. Options are strings or { id, label }. Left and right arrows move the selection.
export function Segmented({ label, caption, options, value, onChange, size = 'md' }) {
  const opts = options.map((o) => (typeof o === 'string' ? { id: o, label: o } : o));
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = Math.max(0, opts.findIndex((o) => o.id === value));
    const n = (i + (e.key === 'ArrowRight' ? 1 : opts.length - 1)) % opts.length;
    e.preventDefault();
    if (onChange) onChange(opts[n].id);
    const btns = e.currentTarget.querySelectorAll('button');
    if (btns[n]) btns[n].focus();
  };
  const group = (
    <div role="group" aria-label={label} onKeyDown={onKey} style={css(segStyle(size))}>
      {opts.map((o) => (
        <button key={o.id} type="button" className="fb-seg" aria-pressed={o.id === value} onClick={() => onChange && onChange(o.id)} style={css(segBtnStyle(o.id === value, size))}>{o.label}</button>
      ))}
    </div>
  );
  if (!caption) return group;
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px')}>
      <span style={css('font-size: 13px; font-weight: 500; color: var(--ink-2b)')}>{caption}</span>
      {group}
    </div>
  );
}

// Option chip. variant: 'pill' (Select), 'block' (Status in menus), 'cell' (full-bleed Status cell).
export function Chip({ tone, dark, variant = 'pill', onRemove, removeLabel, children }) {
  return (
    <span style={css(chipStyle(tone, { dark, variant, removable: !!onRemove }))}>
      <span style={css(chipTextStyle)}>{children}</span>
      {onRemove ? (
        <button type="button" tabIndex={-1} className="fb-chipx" aria-label={removeLabel || 'Remove ' + children} onMouseDown={(e) => e.preventDefault()} onClick={onRemove} style={css(chipRemoveStyle)}>
          <Icon d={IC.x} size={10} sw={2} />
        </button>
      ) : null}
    </span>
  );
}

export function Dot({ tone, dark, size }) {
  return <span aria-hidden="true" style={css(dotStyle(tone, dark, size))}></span>;
}

// Color picker over the eight color_token values. layout 'list' (Select options) or 'grid' (Status options).
export function SwatchList({ value, onChange, dark, layout = 'list', label = 'Colors' }) {
  if (layout === 'grid') {
    return (
      <>
        <MenuLabel>{label}</MenuLabel>
        <div role="group" aria-label={label} style={css(swatchGridStyle)}>
          {OPTION_COLORS.map(([k, name]) => (
            <button key={k} type="button" className="fb-swatch" aria-label={name} aria-pressed={k === value} onClick={() => onChange && onChange(k)} style={css(swatchStyle(k, { dark, layout, on: k === value }))}>
              {k === value ? <Icon d={IC.check} size={14} sw={2.2} /> : null}
            </button>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <MenuLabel>{label}</MenuLabel>
      {OPTION_COLORS.map(([k, name]) => (
        <MenuRow key={k} h={32} checked={k === value} aria-pressed={k === value} onClick={() => onChange && onChange(k)}>
          <span aria-hidden="true" style={css(swatchStyle(k, { dark }))}></span>
          <span style={css(rowLabelStyle)}>{name}</span>
        </MenuRow>
      ))}
    </>
  );
}

// kind: primary, secondary, ghost, danger (soft), dangerSolid (delete confirm).
export function Button({ kind = 'primary', dark, h, children, ...rest }) {
  return <button type="button" {...rest} style={css(btnStyle(kind, { dark, h }))}>{children}</button>;
}
