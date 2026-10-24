// Style strings for the column system primitives (docs/design/database-components/Main.dc.html).
// Strings, not objects, so the board's vals can reuse them; components/studio/Prims.jsx renders them.
// Colors come from the TK variables and the TONE / DARKFILL tables only.
import { TONE, toneOf, solid, dotOf } from './tones';

export const POP_SHADOW = '0 16px 48px rgba(0,0,0,0.18)';

// Popovers in the last five columns open toward the left so they stay on screen.
export const popAlign = (colIdx, colCount) => (colIdx >= colCount - 5 ? 'right' : 'left');

// x shifts the panel sideways from the anchor edge, as a submenu beside its menu.
export const popStyle = ({ align = 'left', width = 280, pad = 8, top = 'calc(100% + 6px)', maxH = 440, x = 0 } = {}) =>
  'position: absolute; z-index: 1; top: ' + top + '; ' + (align === 'right' ? 'right: ' : 'left: ') + (typeof x === 'number' ? x + 'px' : x) + ';' +
  ' width: ' + (typeof width === 'number' ? width + 'px' : width) + '; max-width: calc(100vw - 32px); max-height: ' + maxH + 'px; overflow-y: auto; box-sizing: border-box;' +
  ' padding: ' + pad + 'px; display: flex; flex-direction: column; gap: 2px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 16px;' +
  ' box-shadow: ' + POP_SHADOW + '; text-align: left; font-size: 14px; font-weight: 500; color: var(--ink); cursor: default; white-space: normal;';
export const scrimStyle = 'position: fixed; inset: 0; z-index: 0; border: 0; padding: 0; background: transparent; cursor: default;';

// Menu row: 34 to 36px, radius 10, 16px icon, 14 / 500. Hover and keyboard focus come from .fb-mr in globals.css.
export const rowStyle = ({ h = 34, danger = false, disabled = false, active = false } = {}) =>
  'display: flex; align-items: center; gap: 10px; width: 100%; min-height: ' + h + 'px; flex: none; padding: 0 10px; box-sizing: border-box; border: 0; border-radius: 10px;' +
  ' background: ' + (active ? 'var(--hover)' : 'transparent') + '; font-size: 14px; font-weight: 500; letter-spacing: normal; line-height: 1.3; text-align: left;' +
  ' color: ' + (disabled ? 'var(--faint)' : danger ? 'var(--red-ink)' : 'var(--ink)') + '; cursor: ' + (disabled ? 'default' : 'pointer') + ';';
export const rowIconStyle = (danger, disabled) => 'flex: none; color: ' + (disabled ? 'var(--faint)' : danger ? 'var(--red-ink)' : 'var(--ink-3)') + ';';
export const rowLabelStyle = 'flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
export const rowMetaStyle = 'flex: none; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 500; color: var(--muted-2);';
export const chevStyle = 'flex: none; color: var(--muted-2);';

export const labelStyle = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; padding: 8px 10px 4px; font-size: 12px; font-weight: 600; color: var(--muted-2);';
export const labelActionStyle = 'height: 24px; padding: 0 6px; border: 0; border-radius: 6px; background: transparent; font-size: 12px; font-weight: 600; color: var(--link); cursor: pointer;';
export const iconBtnStyle = (size = 28) => 'width: ' + size + 'px; height: ' + size + 'px; flex: none; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';
export const dividerStyle = 'height: 1px; flex: none; margin: 4px 0; background: var(--line);';

// Field: --panel fill and 1px --border; focus turns it into a 2px --ink ring (.fb-field:focus-within).
const FIELD = { sm: [36, 10, 10], md: [40, 12, 12], lg: [48, 14, 14] };
export const fieldStyle = ({ size = 'md', multi = false, chips = false } = {}) => {
  const f = FIELD[size] || FIELD.md;
  return 'display: flex; align-items: ' + (multi ? 'flex-start' : 'center') + '; gap: ' + (chips ? 6 : 8) + 'px;' + (chips ? ' flex-wrap: wrap;' : '') +
    ' min-height: ' + f[0] + 'px; box-sizing: border-box; padding: ' + (chips || multi ? '6px 8px' : '0 ' + f[2] + 'px') + '; border: 1px solid var(--border); border-radius: ' + f[1] + 'px;' +
    ' background: var(--panel); color: var(--ink); cursor: text;';
};
export const inputStyle = ({ size = 'md', align = 'left', strong = false, mono = false } = {}) =>
  'flex: 1; min-width: ' + (size === 'sm' ? 60 : 80) + 'px; margin: 0; padding: 0; border: 0; background: transparent; outline: none; color: var(--ink);' +
  ' font-size: ' + (size === 'lg' ? 15 : 14) + 'px; font-weight: ' + (strong ? 600 : 400) + '; line-height: 1.45; text-align: ' + align + ';' +
  (align === 'right' ? ' font-variant-numeric: tabular-nums;' : '') + (mono ? ' font-family: ui-monospace, Menlo, monospace; font-size: 13px;' : '');
export const textareaStyle = (opts) => inputStyle(opts) + ' resize: none; padding: 4px 4px; min-height: 60px;';
export const fieldAddonStyle = 'flex: none; display: inline-flex; color: var(--muted-2); font-size: 15px; font-weight: 600;';
export const fieldLabelStyle = 'font-size: 12px; font-weight: 600; color: var(--muted-2);';
export const srOnly = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;';

// Switch: 30x18 in menus and sheets, 36x22 in forms.
const SW = { sm: [30, 18, 14], md: [36, 22, 18] };
export const toggleStyle = (on, size = 'sm', disabled = false) => {
  const d = SW[size] || SW.sm;
  return {
    track: 'width: ' + d[0] + 'px; height: ' + d[1] + 'px; flex: none; padding: 2px; box-sizing: border-box; border: 0; border-radius: 999px; display: inline-flex; align-items: center;' +
      ' justify-content: ' + (on ? 'flex-end' : 'flex-start') + '; background: ' + (on ? 'var(--inv)' : 'var(--border-strong)') + '; transition: background .15s ease;' +
      ' cursor: ' + (disabled ? 'default' : 'pointer') + ';' + (disabled ? ' opacity: 0.5;' : ''),
    knob: 'width: ' + d[2] + 'px; height: ' + d[2] + 'px; flex: none; border-radius: 999px; background: ' + (on ? 'var(--inv-ink)' : 'var(--surface)') + '; box-shadow: 0 1px 2px rgba(0,0,0,0.12);'
  };
};

// Segmented control: --chip track, the pressed option lifts onto --surface.
const SEG = { sm: [30, 10, 8], md: [32, 12, 9], lg: [34, 12, 9] };
export const segStyle = (size = 'md') => 'display: flex; padding: 3px; gap: 2px; border-radius: ' + (SEG[size] || SEG.md)[1] + 'px; background: var(--chip);';
export const segBtnStyle = (on, size = 'md') => {
  const d = SEG[size] || SEG.md;
  return 'flex: 1; min-width: 0; height: ' + d[0] + 'px; padding: 0 8px; border: 0; border-radius: ' + d[2] + 'px; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; ' +
    (on ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.08);' : 'background: transparent; color: var(--ink-3);');
};

// Chips. pill: soft Select / Multi select option. block: solid status option in menus. cell: full-bleed status cell.
export const chipStyle = (tn, { dark = false, variant = 'pill', removable = false } = {}) => {
  const k = toneOf(tn);
  if (variant === 'cell') {
    const f = solid(k, dark);
    return 'flex: 1; align-self: stretch; display: flex; align-items: center; justify-content: center; min-width: 0; padding: 0 10px; border-radius: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; font-weight: 600; background: ' + f[0] + '; color: ' + f[1] + ';';
  }
  const base = 'display: inline-flex; align-items: center; gap: 4px; flex: none; max-width: 100%; height: 24px; box-sizing: border-box; padding: 0 ' + (removable ? '6px 0 10px' : '10px') + '; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 600; line-height: 1;';
  if (variant === 'block') { const f = solid(k, dark); return base + ' border-radius: 4px; background: ' + f[0] + '; color: ' + f[1] + ';'; }
  return base + ' border-radius: 999px; background: ' + TONE[k][0] + '; color: ' + TONE[k][1] + ';';
};
export const chipTextStyle = 'min-width: 0; overflow: hidden; text-overflow: ellipsis;';
export const chipRemoveStyle = 'width: 16px; height: 16px; flex: none; padding: 0; border: 0; border-radius: 999px; background: transparent; color: inherit; display: inline-flex; align-items: center; justify-content: center; opacity: 0.75; cursor: pointer;';
export const dotStyle = (tn, dark, size = 8) => 'width: ' + size + 'px; height: ' + size + 'px; flex: none; border-radius: 999px; background: ' + dotOf(tn, dark) + ';';

// Swatches. list: 18px soft square with a dot-color edge (Select option menu). grid: solid tiles (Status option menu).
export const swatchStyle = (tn, { dark = false, layout = 'list', on = false } = {}) => {
  const k = toneOf(tn);
  if (layout === 'grid') {
    const f = solid(k, dark);
    return 'height: 32px; min-width: 0; padding: 0; border: 0; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; background: ' + f[0] + '; color: ' + f[1] + ';' +
      (on ? ' box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--ink);' : '');
  }
  return 'width: 18px; height: 18px; flex: none; box-sizing: border-box; border-radius: 6px; background: ' + TONE[k][0] + '; border: 1px solid ' + dotOf(k, dark) + ';';
};
export const swatchGridStyle = 'display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; padding: 4px 10px 8px;';

// Buttons: 40 to 44px, radius 12.
export const btnStyle = (kind = 'primary', { dark = false, h = 40 } = {}) => {
  const fill = {
    primary: 'background: var(--inv); color: var(--inv-ink);',
    secondary: 'background: var(--chip); color: var(--ink);',
    ghost: 'background: transparent; color: var(--ink);',
    danger: 'background: var(--red-soft); color: var(--red-ink);',
    dangerSolid: (() => { const f = solid('red', dark); return 'background: ' + f[0] + '; color: ' + f[1] + ';'; })()
  }[kind] || '';
  return 'display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex: none; height: ' + h + 'px; padding: 0 ' + (h >= 44 ? 18 : 16) + 'px; border: 0; border-radius: 12px; font-size: 14px; font-weight: 600; white-space: nowrap; cursor: pointer; ' + fill;
};
