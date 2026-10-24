'use client';
// app: view-level panels (database components step 8, docs/design/database-components/Properties.dc.html):
// Properties (what shows and in what order), column presets, group and layout. Models come from `vp` in
// lib/studio/vals.js. Like the filter and sort editors, these close through the board's menu backdrop and on Esc.
import { useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { Popover, MenuRow, MenuLabel, Divider, Field, Segmented, Button, Icon, IC } from './Prims';
import { useOptionDrag, DragHandle } from './SelectPicker';

const VI = {
  preset: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  eye: 'M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8zM8 6a2 2 0 1 0 0 4a2 2 0 1 0 0-4z',
  eyeOff: 'M2 2l12 12M6.6 6.6a2 2 0 0 0 2.8 2.8M4.2 4.7C2.6 5.8 1.5 8 1.5 8s2.5 4.5 6.5 4.5c1.3 0 2.4-.4 3.3-1M7 3.6c.3 0 .7-.1 1-.1 4 0 6.5 4.5 6.5 4.5s-.5.9-1.4 2',
  lock: 'M4 7.5h8v6H4zM5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5',
  sliders: 'M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7M11 3v3M5 10v3'
};
const propRow = 'display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 6px; border-radius: 10px;';
const eyeBtn = 'width: 28px; height: 28px; flex: none; padding: 0; border: 0; border-radius: 8px; background: transparent; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';
const nameS = 'flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 500;';

// B. Column presets, then saving one and the per-role defaults. A sub-view of the Properties panel.
function PresetsView({ pr, view, setView }) {
  const [name, setName] = useState('');
  const role = view.indexOf('role:') === 0 ? pr.roles.find((r) => r.id === view.slice(5)) : null;
  if (role) {
    return (
      <>
        <MenuRow icon={IC.back} label={role.label} onClick={() => setView('roles')} />
        <Divider />
        <p style={css('margin: 0; padding: 4px 10px 6px; font-size: 12px; line-height: 1.45; color: var(--muted-2)')}>Members of this role start with these columns until they change their own view.</p>
        {role.presets.map((p) => <MenuRow key={p.id} label={p.label} checked={p.on} onClick={() => { p.pick(); setView('roles'); }} />)}
      </>
    );
  }
  if (view === 'roles') {
    return (
      <>
        <MenuRow icon={IC.back} label="Set default per role" onClick={() => setView('presets')} />
        <Divider />
        {pr.roles.map((r) => <MenuRow key={r.id} label={r.label} meta={r.current} sub onClick={() => setView('role:' + r.id)} />)}
      </>
    );
  }
  const save = () => { if (!name.trim()) return; pr.save(name); setName(''); setView('presets'); };
  return (
    <>
      <MenuRow icon={IC.back} label="Column preset" onClick={() => setView('')} />
      <Divider />
      {pr.items.map((p) => (
        <div key={p.id} style={css('display: flex; align-items: center; gap: 2px')}>
          <MenuRow h={44} checked={p.on} onClick={p.pick} aria-pressed={p.on}>
            <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column')}>
              <span style={css('font-size: 14px; font-weight: 500; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{p.label}</span>
              <span style={css('font-size: 12px; font-weight: 400; color: var(--muted-2)')}>{p.count}</span>
            </span>
          </MenuRow>
          {p.custom && pr.canManage ? (
            <button type="button" className="fb-ni" aria-label={'Delete preset ' + p.label} onClick={p.remove} style={css(eyeBtn + ' color: var(--muted-2);')}>
              <Icon d={IC.trash} size={14} />
            </button>
          ) : null}
        </div>
      ))}
      {pr.canManage ? (
        <>
          <Divider />
          {view === 'save' ? (
            <form onSubmit={(e) => { e.preventDefault(); save(); }} style={css('display: flex; flex-direction: column; gap: 8px; padding: 4px 2px')}>
              <Field size="sm" label="Preset name" placeholder="Preset name" value={name} data-autofocus="" autoFocus onChange={(e) => setName(e.target.value)} />
              <div style={css('display: flex; gap: 6px; justify-content: flex-end')}>
                <Button kind="ghost" h={34} onClick={() => { setName(''); setView('presets'); }}>Cancel</Button>
                <Button kind="primary" h={34} type="submit" disabled={!name.trim()}>Save preset</Button>
              </div>
            </form>
          ) : <MenuRow icon={IC.plus} label="Save current as preset" onClick={() => setView('save')} />}
          <MenuRow icon={VI.sliders} label="Set default per role" sub onClick={() => setView('roles')} />
        </>
      ) : null}
    </>
  );
}

// A. Properties: search, preset, shown (drag to reorder, Project locked) and hidden, then New property.
export function PropertiesPanel({ vp, onClose }) {
  const p = vp.props, pr = vp.presets;
  const [q, setQ] = useState('');
  const [view, setView] = useState('');
  const listRef = useRef(null);
  const { handle, lineEl } = useOptionDrag(listRef, (key, to) => p.move(key, to));
  const lq = q.trim().toLowerCase();
  const hit = (x) => !lq || x.label.toLowerCase().includes(lq);
  const shown = p.shown.filter(hit), hidden = p.hidden.filter(hit);
  return (
    <Popover label={view ? 'Column preset' : 'Properties'} onClose={onClose} scrim={false} width={view ? 260 : 320} maxH={520}>
      {view ? <PresetsView pr={pr} view={view} setView={setView} /> : (
        <>
          <div style={css('margin-bottom: 4px')}>
            <Field size="sm" label="Search properties" hideLabel icon={IC.search} placeholder="Search properties" value={q} data-autofocus="" onChange={(e) => setQ(e.target.value)} />
          </div>
          {pr.show ? <MenuRow icon={VI.preset} label="Column preset" meta={pr.current} sub onClick={() => setView('presets')} /> : null}
          <MenuLabel actionText={shown.some((x) => !x.locked) ? 'Hide all' : ''} onAction={p.hideAll}>Shown in table</MenuLabel>
          <div ref={listRef} style={css('position: relative; display: flex; flex-direction: column; gap: 2px')}>
            {shown.map((x) => (
              <div key={x.key} data-opt={x.locked ? undefined : x.key} style={css(propRow)}>
                {x.locked || lq ? <span style={css('width: 16px; flex: none')}></span> : <DragHandle props={handle(x.key)} />}
                <Icon d={x.icon} style="flex: none; color: var(--ink-3)" />
                <span style={css(nameS + ' color: var(--ink);')}>{x.label}</span>
                {x.locked ? (
                  <span role="img" aria-label="Always shown" title="Always shown" style={css(eyeBtn + ' cursor: default; color: var(--muted-2);')}><Icon d={VI.lock} /></span>
                ) : (
                  <button type="button" className="fb-ni" aria-label={'Hide ' + x.label} onClick={x.hide} style={css(eyeBtn + ' color: var(--ink);')}><Icon d={VI.eye} /></button>
                )}
              </div>
            ))}
            {lineEl}
          </div>
          {hidden.length ? (
            <>
              <MenuLabel actionText="Show all" onAction={p.showAll}>Hidden in this view</MenuLabel>
              {hidden.map((x) => (
                <div key={x.key} style={css(propRow)}>
                  <span style={css('width: 16px; flex: none')}></span>
                  <Icon d={x.icon} style="flex: none; color: var(--muted-2)" />
                  <span style={css(nameS + ' color: var(--ink-3);')}>{x.label}</span>
                  <button type="button" className="fb-ni" aria-label={'Show ' + x.label} onClick={x.show} style={css(eyeBtn + ' color: var(--muted-2);')}><Icon d={VI.eyeOff} /></button>
                </div>
              ))}
            </>
          ) : null}
          {lq && !shown.length && !hidden.length ? <p style={css('margin: 0; padding: 8px 10px; font-size: 13px; color: var(--muted-2)')}>No properties match.</p> : null}
          {p.canNew ? (
            <>
              <Divider />
              <MenuRow icon={IC.plus} label="New property" onClick={p.addNew} />
            </>
          ) : null}
        </>
      )}
    </Popover>
  );
}

// C. Group: group by, the group switches and group order.
export function GroupPanel({ g, onClose }) {
  const [view, setView] = useState('');
  return (
    <Popover label="Group" onClose={onClose} scrim={false} width={290} maxH={520}>
      {view === 'order' ? (
        <>
          <MenuRow icon={IC.back} label="Group order" onClick={() => setView('')} />
          <Divider />
          {g.orders.map((o) => <MenuRow key={o.id} label={o.label} checked={o.on} onClick={() => { o.pick(); setView(''); }} />)}
        </>
      ) : (
        <>
          <MenuLabel>Group by</MenuLabel>
          {g.options.map((o) => <MenuRow key={o.id} icon={o.icon} label={o.label} checked={o.on} aria-pressed={o.on} onClick={o.pick} />)}
          <Divider />
          <MenuRow label="Collapse empty groups" toggle={g.hideEmpty} onClick={() => g.setHideEmpty(!g.hideEmpty)} />
          <MenuRow label="Show counts" toggle={g.showCounts} onClick={() => g.setShowCounts(!g.showCounts)} />
          <MenuRow label="Color group headers" toggle={g.colorHeads} onClick={() => g.setColorHeads(!g.colorHeads)} />
          <MenuRow label="Group order" meta={g.orderLabel} sub onClick={() => setView('order')} />
        </>
      )}
    </Popover>
  );
}

// D. Layout: row height, where rows open, and the table switches. The board's archive and group shortcuts follow.
export function LayoutPanel({ l, archive, collapseAll, expandAll, onClose }) {
  return (
    <Popover label="Layout" onClose={onClose} scrim={false} align="right" width={300} pad={12} maxH={560}>
      <div style={css('display: flex; flex-direction: column; gap: 12px; padding-bottom: 4px')}>
        <Segmented caption="Row height" label="Row height" options={l.rowHeights} value={l.rowHeight} onChange={l.setRowHeight} />
        <Segmented caption="Open rows in" label="Open rows in" options={l.openIns} value={l.openIn} onChange={l.setOpenIn} />
      </div>
      <Divider />
      <MenuRow h={32} label="Freeze first column" toggle={l.freeze} onClick={() => l.setFreeze(!l.freeze)} />
      <MenuRow h={32} label="Wrap all cells" toggle={l.wrapAll} onClick={() => l.setWrapAll(!l.wrapAll)} />
      <MenuRow h={32} label="Show calculation row" toggle={l.calc} onClick={() => l.setCalc(!l.calc)} />
      {archive && archive.length ? (
        <>
          <Divider />
          <MenuLabel>Archive</MenuLabel>
          {archive.map((it) => <MenuRow key={it.label} label={it.label} checked={it.on} aria-pressed={it.on} onClick={it.pick} />)}
        </>
      ) : null}
      <Divider />
      <MenuLabel>Groups</MenuLabel>
      <MenuRow label="Collapse all groups" onClick={collapseAll} />
      <MenuRow label="Expand all groups" onClick={expandAll} />
    </Popover>
  );
}
