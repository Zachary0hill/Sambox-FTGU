'use client';
// A message field that holds typed text and data chips (handoff VarChip). The stored value is the runner's own
// format, text with {{project.title}} tokens (lib/automations/graph.ts fillTokens), but a token never shows: each one
// renders as a named chip that can be removed, and "Add data" inserts a chip where the cursor is.
// The editor is uncontrolled (contentEditable): it is filled when the field mounts and reads back on every input.
import { useEffect, useRef } from 'react';
import { css } from '@/lib/studio/css';
import { T, R } from '@/lib/workflow/theme';
import { VAR_LABEL } from '@/lib/workflow/copy';

const labelOf = (id) => VAR_LABEL[id] || id.split('.').pop().replace(/_/g, ' ');
const TOKEN = /\{\{\s*([a-z_.]+)((?:\s*\|[^}]*)?)\}\}/gi;

function chipEl(id, raw) {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.dataset.var = id;
  chip.dataset.raw = raw || '{{' + id + '}}';
  chip.className = 'wf-var';
  chip.textContent = labelOf(id);
  const x = document.createElement('button');
  x.type = 'button';
  x.tabIndex = -1;
  x.setAttribute('aria-label', 'Remove ' + labelOf(id));
  x.textContent = '×';
  chip.appendChild(x);
  return chip;
}
function fill(el, value) {
  el.textContent = '';
  const text = String(value || '');
  let at = 0;
  text.replace(TOKEN, (m, id, _opt, i) => {
    if (i > at) el.appendChild(document.createTextNode(text.slice(at, i)));
    el.appendChild(chipEl(id.toLowerCase(), m));
    at = i + m.length;
    return m;
  });
  if (at < text.length) el.appendChild(document.createTextNode(text.slice(at)));
}
function read(el) {
  let out = '';
  const walk = (node) => node.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.nodeValue;
    else if (n.dataset && n.dataset.var) out += n.dataset.raw;
    else if (n.tagName === 'BR') out += '\n';
    else { if (n.tagName === 'DIV' && out && !out.endsWith('\n')) out += '\n'; walk(n); }
  });
  walk(el);
  return out.replace(/ /g, ' ');
}

// insert: { token, n } from the builder's "Add data" chips; a new n puts that chip at the cursor (or at the end when
// the field has no cursor).
export default function RichField({ id, label, required, value, onChange, onFocus, focused, placeholder, error, insert, rows = 1 }) {
  const ref = useRef(null);
  const last = useRef(null);
  const seen = useRef(insert ? insert.n : 0);
  // Fill on mount and when the value changes from outside (another step selected, undo); never while typing.
  useEffect(() => {
    const el = ref.current;
    if (!el || value === last.current) return;
    fill(el, value);
    last.current = value;
  }, [value]);
  const emit = () => { const v = read(ref.current); last.current = v; onChange(v); };
  useEffect(() => {
    const el = ref.current;
    if (!insert || insert.n === seen.current || !el) return;
    seen.current = insert.n;
    const sel = window.getSelection();
    let range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || !el.contains(range.commonAncestorContainer)) { range = document.createRange(); range.selectNodeContents(el); range.collapse(false); }
    range.deleteContents();
    const space = document.createTextNode('\u00a0');
    range.insertNode(space);
    range.insertNode(chipEl(insert.token));
    range.setStartAfter(space); range.collapse(true);
    sel.removeAllRanges(); sel.addRange(range);
    el.focus();
    emit();
  }, [insert]); // eslint-disable-line react-hooks/exhaustive-deps
  const empty = !String(value || '').trim();
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
      <span id={id + '-l'} style={css('font-size: 14px; font-weight: 600; color: ' + T.ink + ';')}>{label}{required ? <span aria-hidden="true" style={css('color: ' + T.error + ';')}> *</span> : null}</span>
      <div style={css('position: relative;')}>
        <div ref={ref} id={id} role="textbox" aria-multiline="true" aria-labelledby={id + '-l'} aria-required={required ? 'true' : undefined} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? id + '-e' : undefined}
          contentEditable suppressContentEditableWarning spellCheck onInput={emit} onFocus={onFocus}
          onClick={(e) => { if (e.target.tagName === 'BUTTON' && e.target.parentElement.dataset.var) { e.target.parentElement.remove(); emit(); } }}
          onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
          className="wf-rich" style={css('min-height: ' + Math.max(44, rows * 22 + 22) + 'px; padding: 9px 12px; border-radius: ' + R.control + 'px; background: ' + T.surface + '; border: 1.5px solid ' + (error ? T.error : focused ? T.ring : T.chipLine) + '; color: ' + T.ink + '; font-size: 14px; line-height: 1.9; white-space: pre-wrap; overflow-wrap: anywhere; cursor: text;')} />
        {empty && placeholder ? <span aria-hidden="true" style={css('position: absolute; left: 13px; top: 12px; right: 13px; font-size: 14px; color: ' + T.placeholder + '; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>{placeholder}</span> : null}
      </div>
      {error ? <span id={id + '-e'} style={css('font-size: 13px; color: ' + T.error + ';')}>{error}</span> : null}
    </div>
  );
}

// Chip styles for the editor; rendered once by the builder inside its .wf root.
export const RICH_CSS = [
  '.wf-rich:focus-visible { outline: none; }',
  '.wf-var { display: inline-flex; align-items: center; gap: 2px; height: 26px; margin: 0 2px; padding: 0 2px 0 10px; border-radius: 999px; background: ' + T.varBg + '; color: ' + T.varInk + '; font-size: 13px; font-weight: 600; line-height: 1; white-space: nowrap; vertical-align: middle; user-select: none; }',
  '.wf-var button { width: 22px; height: 22px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: inherit; font-size: 15px; line-height: 1; cursor: pointer; }',
  '.wf-var button:hover { background: rgba(0,0,0,.08); }',
].join('\n');
