'use client';
// app: board column header, its menu and the delete confirm (database components step 2,
// docs/design/database-components/HeaderMenu.dc.html). Data and actions come from headFor() in lib/studio/vals.js.
import { useEffect, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { srOnly } from '@/lib/studio/prims';
import { Popover, MenuRow, MenuLabel, Divider, Field, Segmented, Icon, IC, Button } from './Prims';
import { OptionsBlock, OptionMenu, SortMenu } from './SelectPicker';

const HI = {
  sliders: 'M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7M11 3v3M5 10v3',
  swap: 'M3 5.5h10M10.5 3l2.5 2.5L10.5 8M13 10.5H3M5.5 8L3 10.5 5.5 13',
  filter: 'M2.5 4h11M4.5 8h7M6.5 12h3',
  up: 'M8 13V3M4 7l4-4 4 4',
  down: 'M8 3v10M4 9l4 4 4-4',
  group: 'M2.5 4h11v3h-11zM2.5 9h11v3h-11z',
  pin: 'M8 10v4M5 2.5h6M6 2.5v4l-2 3h8l-2-3v-4',
  hide: 'M2 2l12 12M6.6 6.6a2 2 0 0 0 2.8 2.8M4.2 4.7C2.6 5.8 1.5 8 1.5 8s2.5 4.5 6.5 4.5c1.3 0 2.4-.4 3.3-1M7 3.6c.3 0 .7-.1 1-.1 4 0 6.5 4.5 6.5 4.5s-.5.9-1.4 2',
  wrap: 'M2.5 4h11M2.5 8h9a2 2 0 0 1 0 4H8M9.5 10.5L8 12l1.5 1.5M2.5 12h3',
  insL: 'M9 2.5h4.5v11H9zM6 8H2M4 6l-2 2 2 2',
  insR: 'M2.5 2.5H7v11H2.5zM10 8h4M12 6l2 2-2 2',
  dup: 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3',
  warn: 'M8 2.5l6 10.5H2zM8 6.5v3M8 11.5h.01'
};
const MENU_W = 280;
const TYPE_NOTE = 'Switching to Select keeps each value as an option. Number, Date and Checkbox clear values that do not convert. Person and Files start empty.';

// Header states: default, hover (more button and resize edge), open (2px ink ring), sorted, filtered, frozen, dragging.
export default function HeaderCell({ h, dark }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const skipClick = useRef(false);
  const rs = useRef(null);
  const [ghost, setGhost] = useState(null);

  // Drop target: the header under the pointer, and which side of its midline. Nothing lands left of Project.
  const dropAt = (x) => {
    const cells = Array.from(ref.current.parentElement.querySelectorAll(':scope > [data-col]')).filter((el) => el.dataset.col !== '__add');
    let hit = cells.find((el) => { const r = el.getBoundingClientRect(); return x >= r.left && x < r.right; });
    if (!hit) hit = x < cells[0].getBoundingClientRect().left ? cells[0] : cells[cells.length - 1];
    const r = hit.getBoundingClientRect();
    const side = hit.dataset.col === 'project' || x >= r.left + r.width / 2 ? 'right' : 'left';
    return { key: hit.dataset.col, side, lineX: side === 'left' ? r.left : r.right, top: r.top, height: r.height };
  };
  // Capture on press, so a fast drag keeps reporting here even once the pointer is over another header.
  const onDown = (e) => {
    if (!h.draggable || e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, on: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!d.on) {
      if (Math.abs(e.clientX - d.x) < 5 && Math.abs(e.clientY - d.y) < 5) return;
      d.on = true;
    }
    setGhost(Object.assign({ x: e.clientX, y: e.clientY }, dropAt(e.clientX)));
  };
  const onUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.on) return;
    // The click that ends a drag should not open the menu.
    skipClick.current = true;
    setTimeout(() => { skipClick.current = false; }, 0);
    setGhost(null);
    const t = dropAt(e.clientX);
    if (t.key !== h.col) h.onMove(t.key, t.side);
  };
  const onCancel = () => { drag.current = null; setGhost(null); };
  const onClick = () => { if (skipClick.current) { skipClick.current = false; return; } h.toggle(); };

  // Resize previews through the table's --cw-<key> variable, then saves once on release.
  const cwVar = '--cw-' + h.col;
  const table = () => ref.current && ref.current.closest('[data-table]');
  // After the saved width has rendered; a timer rather than requestAnimationFrame, which stalls in background tabs.
  const clearVar = () => setTimeout(() => { const t = table(); if (t) t.style.removeProperty(cwVar); }, 60);
  const onRsDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    rs.current = { x: e.clientX, w: ref.current.getBoundingClientRect().width, cur: null };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onRsMove = (e) => {
    const r = rs.current;
    if (!r) return;
    r.cur = Math.max(80, Math.min(640, r.w + e.clientX - r.x));
    const t = table();
    if (t) t.style.setProperty(cwVar, r.cur + 'px');
  };
  const onRsUp = () => {
    const r = rs.current;
    rs.current = null;
    if (!r || r.cur == null) return;
    h.onResize(r.cur);
    clearVar();
  };
  const onRsKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    h.onResize(h.width + (e.key === 'ArrowRight' ? 16 : -16));
  };

  const iconTone = 'flex: none; color: ' + (h.open ? 'var(--ink)' : 'var(--muted-2)');
  const inner = (
    <>
      <Icon d={h.icon} size={14} style={iconTone} />
      <span style={css('min-width: 0; overflow: hidden; text-overflow: ellipsis')}>{h.label}</span>
      {h.sortDir ? <><Icon d={h.sortDir === 'asc' ? HI.up : HI.down} size={14} sw={1.75} style="flex: none; color: var(--ink)" /><span style={css(srOnly)}>{h.sortDir === 'asc' ? ', sorted ascending' : ', sorted descending'}</span></> : null}
      {h.filtered ? <><Icon d={HI.filter} size={14} sw={1.75} style="flex: none; color: var(--ink)" /><span style={css(srOnly)}>, filtered</span></> : null}
      {h.frozen ? <><Icon d={HI.pin} size={14} sw={1.75} style="flex: none; color: var(--ink)" /><span style={css(srOnly)}>, frozen</span></> : null}
    </>
  );

  return (
    <div ref={ref} className={'fb-th' + (h.cls ? ' ' + h.cls : '')} data-col={h.col} style={css(h.style)}>
      {h.interactive ? (
        <button type="button" className="fb-th-btn" aria-haspopup="dialog" aria-expanded={h.open} onClick={onClick}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} style={css(h.btnStyle + (ghost ? ' opacity: 0.45;' : ''))}>
          {inner}
          <span aria-hidden="true" className="fb-th-more" style={css('position: absolute; top: 50%; right: 4px; width: 24px; height: 24px; margin-top: -12px; border-radius: 6px; background: var(--chip-2); color: var(--ink); display: inline-flex; align-items: center; justify-content: center;' + (h.open ? ' opacity: 1;' : ''))}>
            <Icon d={IC.more} size={14} sw={2.2} />
          </span>
        </button>
      ) : <div style={css(h.btnStyle)}>{inner}</div>}
      {h.canResize ? (
        <div role="separator" aria-orientation="vertical" aria-label={'Resize ' + h.label} aria-valuenow={h.width} aria-valuemin={80} aria-valuemax={640} tabIndex={0}
          className="fb-th-rs" onPointerDown={onRsDown} onPointerMove={onRsMove} onPointerUp={onRsUp} onDoubleClick={() => h.onResize(null)} onKeyDown={onRsKey}
          style={css('position: absolute; top: 0; right: -4px; bottom: 0; width: 8px; z-index: 3; cursor: col-resize; touch-action: none;')}></div>
      ) : null}
      {h.open ? <HeaderMenu h={h} dark={dark} /> : null}
      {ghost ? (
        <>
          <div aria-hidden="true" style={css('position: fixed; z-index: 90; pointer-events: none; left: ' + (ghost.x - 70) + 'px; top: ' + (ghost.y - 22) + 'px; width: 140px; height: 44px; box-sizing: border-box; padding: 0 10px; display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--surface); border: 1px solid var(--ink); transform: rotate(-2deg); box-shadow: 0 12px 28px rgba(0,0,0,0.18); font-size: 12px; font-weight: 600; color: var(--ink-3); white-space: nowrap; overflow: hidden;')}>
            <Icon d={h.icon} size={14} style="flex: none; color: var(--muted-2)" />
            <span style={css('overflow: hidden; text-overflow: ellipsis')}>{h.label}</span>
          </div>
          <div aria-hidden="true" style={css('position: fixed; z-index: 89; pointer-events: none; width: 2px; background: var(--ink); left: ' + (ghost.lineX - 1) + 'px; top: ' + ghost.top + 'px; height: ' + ghost.height + 'px;')}></div>
        </>
      ) : null}
    </div>
  );
}

function HeaderMenu({ h, dark }) {
  const m = h.menu;
  const [name, setName] = useState(h.label);
  const [sub, setSub] = useState('');
  const renamed = useRef(false);
  // Rename saves once: on Enter, on close, or before any other action in the menu.
  const commit = () => { if (m.canRename && !renamed.current) { renamed.current = true; m.rename(name); } };
  const close = () => { commit(); h.close(); };
  const act = (fn) => { commit(); fn(); };
  const toggleSub = () => setSub(sub === 'type' ? '' : 'type');
  const schema = m.canInsertRight || m.canDuplicate || m.canDelete;
  const W = MENU_W;
  return (
    <>
      <Popover label={h.label + ' column menu'} onClose={close} align={h.align} width={W} maxH={560}>
        {m.canRename ? (
          <div style={css('display: flex; gap: 6px; margin-bottom: 4px')}>
            <button type="button" className="fb-ni" aria-label={'Column type: ' + h.typeLabel + '. Change type'} aria-expanded={sub === 'type'} onClick={toggleSub}
              style={css('width: 36px; height: 36px; flex: none; padding: 0; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); color: var(--ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
              <Icon d={h.icon} />
            </button>
            <div style={css('flex: 1; min-width: 0')}>
              <Field size="sm" label="Column name" hideLabel strong value={name} data-autofocus=""
                onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); close(); } }} />
            </div>
          </div>
        ) : (
          <div style={css('display: flex; align-items: center; gap: 8px; padding: 6px 10px 8px; font-size: 13px; font-weight: 600; color: var(--ink)')}>
            <Icon d={h.icon} style="flex: none; color: var(--ink-3)" />
            <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{h.label}</span>
            <span style={css('font-size: 12px; font-weight: 500; color: var(--muted-2)')}>{h.typeLabel}</span>
          </div>
        )}
        {m.canEditProperty ? <MenuRow icon={HI.sliders} label="Edit property" onClick={() => act(m.editProperty)} /> : null}
        {m.canEditProperty && !m.canChangeType ? <Divider /> : null}
        {m.canChangeType ? <><MenuRow icon={HI.swap} label="Change type" meta={h.typeLabel} sub active={sub === 'type'} aria-expanded={sub === 'type'} onClick={toggleSub} /><Divider /></> : null}
        {m.options ? <><OptionsBlock p={m.options} dark={dark} sub={sub} onSub={setSub} /><Divider /></> : null}
        {m.showAs ? (
          <div style={css('padding: 4px 8px 8px')}>
            <Segmented label="Show as" caption="Show as" size="sm" options={m.showAs.options} value={m.showAs.value} onChange={m.showAs.set} />
          </div>
        ) : null}
        {m.canFilter ? <MenuRow icon={HI.filter} label="Filter" onClick={() => act(m.filter)} /> : null}
        <MenuRow icon={HI.up} label="Sort ascending" checked={m.sortDir === 'asc'} onClick={() => act(m.sortAsc)} />
        <MenuRow icon={HI.down} label="Sort descending" checked={m.sortDir === 'desc'} onClick={() => act(m.sortDesc)} />
        {m.canGroup ? <MenuRow icon={HI.group} label={m.groupLabel} checked={m.grouped} onClick={() => act(m.group)} /> : null}
        <Divider />
        {m.canFreeze ? <MenuRow icon={HI.pin} label={m.frozen ? 'Unfreeze columns' : 'Freeze up to here'} onClick={() => act(m.freeze)} /> : null}
        {m.canHide ? <MenuRow icon={HI.hide} label="Hide in this view" onClick={() => act(m.hide)} /> : null}
        {m.canWrap ? <MenuRow icon={HI.wrap} label="Wrap text" toggle={m.wrapped} onClick={m.wrap} /> : null}
        {schema ? <Divider /> : null}
        {m.canInsertLeft ? <MenuRow icon={HI.insL} label="Insert left" onClick={() => act(m.insertLeft)} /> : null}
        {m.canInsertRight ? <MenuRow icon={HI.insR} label="Insert right" onClick={() => act(m.insertRight)} /> : null}
        {m.canDuplicate ? <MenuRow icon={HI.dup} label="Duplicate property" onClick={() => act(m.duplicate)} /> : null}
        {m.canDelete ? <MenuRow icon={IC.trash} label="Delete property" danger onClick={() => act(m.askDelete)} /> : null}
      </Popover>
      {m.options && sub === 'sort' ? <SortMenu p={m.options} align={h.align} x={MENU_W + 6} onClose={() => setSub('')} /> : null}
      {m.options && sub.indexOf('opt:') === 0 && m.options.options.some((o) => 'opt:' + o.id === sub) ? (
        <OptionMenu key={sub} o={m.options.options.find((o) => 'opt:' + o.id === sub)} p={m.options} dark={dark} align={h.align} x={MENU_W + 6} onClose={() => setSub('')} />
      ) : null}
      {sub === 'type' ? (
        <Popover label="Change type" onClose={() => setSub('')} scrim={false} align={h.align} x={W + 6} width={250} maxH={560}>
          <MenuLabel>Change type</MenuLabel>
          {m.types.map((t) => <MenuRow key={t.label} icon={t.icon} label={t.label} checked={t.on} onClick={() => act(t.pick)} />)}
          <div style={css('display: flex; gap: 8px; margin-top: 6px; padding: 10px; border-radius: 10px; background: var(--amber-soft); color: var(--amber-ink)')}>
            <Icon d={HI.warn} style="flex: none; margin-top: 1px" />
            <p style={css('margin: 0; font-size: 12px; line-height: 1.45')}>{TYPE_NOTE}</p>
          </div>
        </Popover>
      ) : null}
    </>
  );
}

// Delete confirm. The delete runs at once; the toast that follows carries Undo for 10 seconds.
export function DeleteColumnDialog({ d, dark }) {
  const cancelRef = useRef(null);
  useEffect(() => { if (cancelRef.current) cancelRef.current.focus(); }, []);
  return (
    <>
      <button type="button" aria-label="Close dialog" onClick={d.cancel} style={css('position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default')}></button>
      <div role="alertdialog" aria-modal="true" aria-labelledby="coldel-t" aria-describedby="coldel-b" onKeyDown={(e) => { if (e.key === 'Escape') d.cancel(); }}
        style={css('position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 380px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; display: flex; flex-direction: column; gap: 14px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 24px; box-shadow: 0 24px 60px rgba(0,0,0,0.12); color: var(--ink)')}>
        <span aria-hidden="true" style={css('width: 44px; height: 44px; border-radius: 12px; background: var(--red-soft); color: var(--red-ink); display: inline-flex; align-items: center; justify-content: center')}><Icon d={IC.trash} size={18} /></span>
        <h2 id="coldel-t" style={css('margin: 0; font-family: var(--font-title); font-weight: var(--weight-black); font-size: 22px; letter-spacing: -0.01em')}>{d.title}</h2>
        <p id="coldel-b" style={css('margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink-3)')}>The column and every value in it leave all views and role views. You can undo for 10 seconds.</p>
        <div style={css('display: flex; justify-content: flex-end; gap: 8px')}>
          <Button kind="secondary" h={44} ref={cancelRef} onClick={d.cancel}>Cancel</Button>
          <Button kind="dangerSolid" dark={dark} h={44} onClick={d.confirm}>Delete column</Button>
        </div>
      </div>
    </>
  );
}
