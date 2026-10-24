'use client';
// app: Select and Multi select picker, option menu and the header's option list (database components step 3,
// docs/design/database-components/SelectEditor.dc.html). The option model comes from optModel() in lib/studio/vals.js.
import { useId, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { Popover, MenuRow, MenuLabel, Divider, Field, Chip, SwatchList, Icon, IC } from './Prims';

export const PICK_W = 300;
const OI = {
  merge: 'M4 2.5v3a3 3 0 0 0 3 3h5M10 6.5l2 2-2 2M4 13.5v-5',
  sort: 'M5 3v10M5 13l-2.5-2.5M5 13l2.5-2.5M11 13V3M11 3L8.5 5.5M11 3l2.5 2.5'
};
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

// Drag to reorder an option list by its handles. The handle captures the pointer; rows carry data-opt.
// Returns props for each handle and the drop line to draw inside the (position: relative) list.
export function useOptionDrag(listRef, onMove) {
  const drag = useRef(null);
  const [line, setLine] = useState(null);
  const targetAt = (y, id) => {
    const rows = Array.from(listRef.current.querySelectorAll('[data-opt]'));
    const others = rows.filter((el) => el.dataset.opt !== id);
    const to = others.filter((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 < y; }).length;
    const box = listRef.current.getBoundingClientRect();
    const ref = others[to] || others[others.length - 1];
    const rr = ref ? ref.getBoundingClientRect() : box;
    return { to, top: (others[to] ? rr.top : rr.bottom) - box.top - 1 };
  };
  const handle = (id) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id, moved: false };
    },
    onPointerMove: (e) => {
      if (!drag.current) return;
      drag.current.moved = true;
      setLine(targetAt(e.clientY, drag.current.id));
    },
    onPointerUp: (e) => {
      const d = drag.current;
      const t = d && d.moved ? targetAt(e.clientY, d.id) : null;
      drag.current = null;
      setLine(null);
      if (t) onMove(d.id, t.to);
    },
    onPointerCancel: () => { drag.current = null; setLine(null); },
    onClick: (e) => e.stopPropagation()
  });
  const lineEl = line ? <div aria-hidden="true" style={css('position: absolute; left: 6px; right: 6px; height: 2px; border-radius: 2px; background: var(--ink); pointer-events: none; top: ' + line.top + 'px')}></div> : null;
  return { handle, lineEl };
}

export function DragHandle({ props, strong }) {
  return (
    <span aria-hidden="true" {...props} style={css('flex: none; display: inline-flex; cursor: grab; touch-action: none; color: ' + (strong ? 'var(--muted-2)' : 'var(--border-strong)'))}>
      <Icon d={IC.drag} sw={2} />
    </span>
  );
}

const box = (on) => 'width: 16px; height: 16px; flex: none; box-sizing: border-box; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; color: var(--inv-ink); ' +
  (on ? 'background: var(--inv); border: 0;' : 'background: var(--surface); border: 1.5px solid var(--border-strong);');

// Cell picker. Select picks and closes; Multi select toggles and stays open. The input searches and creates.
// Keys: up and down move, Enter picks or creates, Backspace removes the last chip, Tab goes to the next cell,
// Alt with up or down moves the highlighted option, Esc closes.
export default function SelectPicker({ p, dark }) {
  const [q, setQ] = useState('');
  const [act, setAct] = useState(null);
  const [menu, setMenu] = useState('');
  const [origin] = useState(() => (typeof document === 'undefined' ? null : document.activeElement));
  const listRef = useRef(null);
  const listId = useId();
  const { handle, lineEl } = useOptionDrag(listRef, p.move);

  const query = q.trim();
  const lq = query.toLowerCase();
  // Close matches: either text contains the other, or a typed word starts a word of the option.
  const words = lq.split(/\s+/).filter((w) => w.length > 1);
  const close = (l) => l.includes(lq) || lq.includes(l) || words.some((w) => l.split(/\s+/).some((x) => x.startsWith(w)));
  const shown = p.options.filter((o) => !lq || close(o.label.toLowerCase()));
  const exact = p.options.find((o) => o.label.toLowerCase() === lq);
  const canCreate = p.canEdit && !!query && !exact;
  const count = shown.length + (canCreate ? 1 : 0);
  // Highlight: the exact match, else the Create row, else the first option.
  const auto = exact ? shown.indexOf(exact) : canCreate ? shown.length : 0;
  const cur = count ? Math.max(0, Math.min(act == null ? auto : act, count - 1)) : -1;
  const canDrag = p.canDrag && !query;

  const choose = (i) => {
    setMenu('');
    if (i === shown.length && canCreate) p.createPick(query);
    else if (shown[i]) p.pick(shown[i].label);
    else return;
    setQ('');
    setAct(null);
  };
  const nextCell = (back) => {
    const cells = Array.from(document.querySelectorAll('.fb-cell'));
    const n = cells[cells.indexOf(origin) + (back ? -1 : 1)];
    p.close();
    if (n) setTimeout(() => n.focus(), 0);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      if (e.altKey && canDrag && shown[cur]) {
        const to = Math.max(0, Math.min(shown.length - 1, cur + d));
        p.move(shown[cur].id, to);
        setAct(to);
      } else if (count) setAct((cur + d + count) % count);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(cur);
    } else if (e.key === 'Backspace' && !q && p.value.length) {
      e.preventDefault();
      p.remove(p.value[p.value.length - 1]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      nextCell(e.shiftKey);
    }
  };

  const optById = (id) => p.options.find((o) => o.id === id);
  const sectionText = query ? (shown.length ? plural(shown.length, 'close match', 'close matches') : 'No matches')
    : p.multi ? 'Select one or more' : p.canEdit ? 'Select an option or create one' : 'Select an option';
  const rowStyle = (on) => 'display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 6px 0 8px; border-radius: 10px; cursor: pointer; background: ' + (on ? 'var(--hover)' : 'transparent') + ';';

  return (
    <>
      <Popover label={p.label + ' options'} onClose={p.close} align={p.align} width={PICK_W}>
        <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 4px 6px 8px; font-size: 12px; font-weight: 600; color: var(--muted-2)')}>
          <span style={css('white-space: nowrap')}>{p.label}</span>
          <span style={css('min-width: 0; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{p.project}</span>
        </div>
        <Field size="sm" label={p.multi ? 'Search or create options' : 'Search or create an option'} hideLabel data-autofocus=""
          placeholder={p.value.length ? (p.multi ? 'Add more' : '') : p.canEdit ? 'Search or create' : 'Search'}
          value={q} onChange={(e) => { setQ(e.target.value); setAct(null); }} onKeyDown={onKey}
          role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={cur >= 0 ? listId + '-' + cur : undefined}
          chips={p.value.length ? p.value.map((l) => {
            const o = p.options.find((x) => x.label === l);
            return <Chip key={l} tone={o ? o.tone : 'gray'} dark={dark} onRemove={() => p.remove(l)}>{l}</Chip>;
          }) : null} />
        <MenuLabel>{sectionText}</MenuLabel>
        <div ref={listRef} id={listId} role="listbox" aria-label={p.label} aria-multiselectable={p.multi || undefined} style={css('position: relative; display: flex; flex-direction: column; gap: 2px')}>
          {shown.map((o, i) => {
            const on = p.value.indexOf(o.label) >= 0;
            return (
              <div key={o.id} id={listId + '-' + i} role="option" aria-selected={on} data-opt={o.id} data-active={i === cur ? '' : undefined} className="fb-opt"
                onMouseMove={() => { if (act !== i) setAct(i); }} onClick={() => choose(i)} style={css(rowStyle(i === cur))}>
                {canDrag ? <DragHandle props={handle(o.id)} strong={i === cur} /> : null}
                {p.multi ? <span aria-hidden="true" style={css(box(on))}>{on ? <Icon d={IC.check} size={12} sw={2.4} /> : null}</span> : null}
                <span style={css('flex: 1; min-width: 0; display: flex')}><Chip tone={o.tone} dark={dark}>{o.label}</Chip></span>
                {p.canEdit ? (
                  <button type="button" className="fb-opt-more" aria-label={'Edit option ' + o.label} aria-expanded={menu === o.id}
                    onClick={(e) => { e.stopPropagation(); setMenu(menu === o.id ? '' : o.id); }}
                    style={css('width: 28px; height: 28px; flex: none; padding: 0; border: 0; border-radius: 8px; background: var(--chip-2); color: var(--ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;' + (menu === o.id ? ' opacity: 1;' : ''))}>
                    <Icon d={IC.more} size={14} sw={2.2} />
                  </button>
                ) : null}
              </div>
            );
          })}
          {canCreate ? (
            <div id={listId + '-' + shown.length} role="option" aria-selected="false" data-active={cur === shown.length ? '' : undefined}
              onMouseMove={() => { if (act !== shown.length) setAct(shown.length); }} onClick={() => choose(shown.length)}
              style={css(rowStyle(cur === shown.length) + ' min-height: 40px; padding: 0 10px; font-size: 14px; font-weight: 500; color: var(--ink);')}>
              <span>Create</span>
              <span style={css('min-width: 0; display: flex')}><Chip tone={p.nextTone} dark={dark}>{query}</Chip></span>
              <span style={css('margin-left: auto; font-size: 12px; font-weight: 600; color: var(--muted-2)')}>Enter</span>
            </div>
          ) : null}
          {lineEl}
        </div>
        {canCreate ? <p style={css('margin: 0; padding: 6px 10px 4px; font-size: 12px; line-height: 1.45; color: var(--muted-2)')}>New options get the next unused color. Change it from the option menu.</p> : null}
        {!p.options.length && !canCreate ? <p style={css('margin: 0; padding: 4px 10px 8px; font-size: 13px; color: var(--muted-2)')}>No options yet.</p> : null}
        {p.multi ? (
          <>
            <Divider />
            <p style={css('margin: 0; padding: 4px 10px; font-size: 12px; color: var(--muted-2)')}>Backspace removes the last chip</p>
          </>
        ) : p.value.length ? (
          <>
            <Divider />
            <MenuRow icon={IC.x} label="Clear selection" onClick={p.clear} />
          </>
        ) : null}
      </Popover>
      {menu && optById(menu) ? <OptionMenu key={menu} o={optById(menu)} p={p} dark={dark} align={p.align} x={PICK_W + 6} onClose={() => setMenu('')} /> : null}
    </>
  );
}

// Option menu: rename, merge into another option, delete (asks again when rows use it), color.
export function OptionMenu({ o, p, dark, align, x, top, onClose }) {
  const [name, setName] = useState(o.label);
  const [view, setView] = useState('main');
  const [confirm, setConfirm] = useState(false);
  const saved = useRef(false);
  const commit = () => { if (!saved.current && name.trim() && name.trim() !== o.label) { saved.current = true; p.rename(o.id, name); } };
  const close = () => { commit(); onClose(); };
  const others = p.options.filter((x) => x.id !== o.id);
  const del = () => {
    if (o.count && !confirm) { setConfirm(true); return; }
    onClose();
    p.deleteOption(o.id);
  };
  return (
    <Popover label={'Option ' + o.label} onClose={close} scrim={false} align={align} x={x} top={top} width={240} maxH={520}>
      <Field size="sm" label="Option name" hideLabel strong value={name} data-autofocus=""
        onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); close(); } }} />
      <div style={css('height: 4px; flex: none')}></div>
      {view === 'merge' ? (
        <>
          <MenuRow icon={IC.back} label={'Merge ' + o.label + ' into'} onClick={() => setView('main')} />
          <Divider />
          {others.map((x2) => (
            <MenuRow key={x2.id} onClick={() => { onClose(); p.merge(o.id, x2.id); }}>
              <span style={css('flex: 1; min-width: 0; display: flex')}><Chip tone={x2.tone} dark={dark}>{x2.label}</Chip></span>
              <span style={css('font-size: 12px; color: var(--muted-2)')}>{plural(x2.count, 'row', 'rows')}</span>
            </MenuRow>
          ))}
        </>
      ) : (
        <>
          {others.length ? <MenuRow icon={OI.merge} label="Merge into…" sub onClick={() => setView('merge')} /> : null}
          <MenuRow icon={IC.trash} danger active={confirm} label={confirm ? 'Delete from ' + plural(o.count, 'row', 'rows') + '?' : 'Delete'}
            meta={confirm ? 'Click again' : o.count ? 'Used in ' + plural(o.count, 'row', 'rows') : ''} onClick={del} />
          <Divider />
          <SwatchList value={o.tone} dark={dark} onChange={(t) => p.setColor(o.id, t)} />
        </>
      )}
    </Popover>
  );
}

// Header menu block for Select and Multi select columns: option sort, add an option, and the option list.
// onSub opens 'sort' or 'opt:<id>' beside the header menu; the parent renders those with SortMenu and OptionMenu.
export function OptionsBlock({ p, dark, sub, onSub }) {
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const { handle, lineEl } = useOptionDrag(listRef, p.move);
  const add = () => { if (draft.trim()) { p.create(draft); setDraft(''); } };
  return (
    <>
      <MenuRow icon={OI.sort} label="Sort" meta={p.sortLabel} sub active={sub === 'sort'} aria-expanded={sub === 'sort'} onClick={() => onSub(sub === 'sort' ? '' : 'sort')} />
      <MenuLabel>Options</MenuLabel>
      <div style={css('margin: 0 2px 4px')}>
        <Field size="sm" label="New option" hideLabel placeholder="Type a new option…" value={draft}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); add(); } }} />
      </div>
      <div ref={listRef} style={css('position: relative; display: flex; flex-direction: column; gap: 2px')}>
        {p.options.map((o) => (
          <div key={o.id} data-opt={o.id} style={css('display: flex; align-items: center; gap: 4px; padding-left: 6px; border-radius: 10px')}>
            <DragHandle props={handle(o.id)} />
            <MenuRow h={36} active={sub === 'opt:' + o.id} aria-label={'Edit option ' + o.label} aria-expanded={sub === 'opt:' + o.id} sub onClick={() => onSub(sub === 'opt:' + o.id ? '' : 'opt:' + o.id)}>
              <span style={css('flex: 1; min-width: 0; display: flex')}><Chip tone={o.tone} dark={dark}>{o.label}</Chip></span>
            </MenuRow>
          </div>
        ))}
        {lineEl}
      </div>
    </>
  );
}

export function SortMenu({ p, align, x, top, onClose }) {
  return (
    <Popover label="Sort options" onClose={onClose} scrim={false} align={align} x={x} top={top} width={220}>
      {p.sorts.map((so) => <MenuRow key={so.id} label={so.label} checked={so.on} onClick={() => { so.pick(); onClose(); }} />)}
    </Popover>
  );
}
