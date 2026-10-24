'use client';
// app: Status picker and status options (database components step 4, docs/design/database-components/StatusEditor.dc.html).
// Status is a Select with fixed groups: the three board stages. Models come from statusGroups() / statusModel() in
// lib/studio/vals.js. Built-in statuses keep their name and group.
import { useId, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { Popover, MenuRow, MenuLabel, Divider, Field, Chip, SwatchList, Icon, IC } from './Prims';
import { useOptionDrag, DragHandle } from './SelectPicker';

const SI = {
  bell: 'M4 11.5V7a4 4 0 0 1 8 0v4.5l1 1H3zM6.5 14h3',
  group: 'M2.5 4h11v3h-11zM2.5 9h11v3h-11z',
  lock: 'M4 7.5h8v6H4zM5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5'
};
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const groupDot = (color) => 'width: 8px; height: 8px; flex: none; border-radius: 999px; background: ' + color + ';';
const badge = 'height: 22px; flex: none; padding: 0 8px; border-radius: 999px; display: inline-flex; align-items: center; font-size: 11px; font-weight: 600; ';

function Bell() {
  return <span role="img" aria-label="Notifies sponsor" style={css('flex: none; display: inline-flex; color: var(--muted-2)')}><Icon d={SI.bell} size={14} /></span>;
}

// Cell picker: search, statuses grouped by stage, a bell on statuses that notify the sponsor, a check on the current one.
export default function StatusPicker({ p, dark }) {
  const [q, setQ] = useState('');
  const [act, setAct] = useState(null);
  const [origin] = useState(() => (typeof document === 'undefined' ? null : document.activeElement));
  const listId = useId();
  const lq = q.trim().toLowerCase();
  const groups = p.groups.map((g) => Object.assign({}, g, { opts: g.opts.filter((o) => !lq || o.label.toLowerCase().includes(lq)) })).filter((g) => g.opts.length);
  const flat = groups.reduce((a, g) => a.concat(g.opts), []);
  // Where each group starts in the flat list, for keyboard positions.
  const starts = groups.reduce((a, g, gi) => a.concat([gi ? a[gi - 1] + groups[gi - 1].opts.length : 0]), []);
  const curIdx = flat.findIndex((o) => o.label === p.value);
  const cur = flat.length ? Math.max(0, Math.min(act == null ? (lq ? 0 : Math.max(0, curIdx)) : act, flat.length - 1)) : -1;
  const nextCell = (back) => {
    const cells = Array.from(document.querySelectorAll('.fb-cell'));
    const n = cells[cells.indexOf(origin) + (back ? -1 : 1)];
    p.close();
    if (n) setTimeout(() => n.focus(), 0);
  };
  const onKey = (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && flat.length) {
      e.preventDefault();
      e.stopPropagation();
      setAct((cur + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[cur]) p.pick(flat[cur].label);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      nextCell(e.shiftKey);
    }
  };
  return (
    <Popover label={p.label + ' options'} onClose={p.close} align={p.align} width={300}>
      <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 4px 6px 8px; font-size: 12px; font-weight: 600; color: var(--muted-2)')}>
        <span style={css('white-space: nowrap')}>{p.label}</span>
        <span style={css('min-width: 0; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{p.project}</span>
      </div>
      <Field size="sm" icon={IC.search} label="Search statuses" hideLabel placeholder="Search statuses" data-autofocus=""
        value={q} onChange={(e) => { setQ(e.target.value); setAct(null); }} onKeyDown={onKey}
        role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={cur >= 0 ? listId + '-' + cur : undefined} />
      <div id={listId} role="listbox" aria-label={p.label} style={css('display: flex; flex-direction: column; gap: 2px')}>
        {groups.map((g, gi) => (
          <div key={g.stage} role="group" aria-label={g.title} style={css('display: flex; flex-direction: column; gap: 2px')}>
            <div style={css('display: flex; align-items: center; gap: 8px; padding: 10px 10px 4px')}>
              <span aria-hidden="true" style={css(groupDot(g.color))}></span>
              <span style={css('font-size: 12px; font-weight: 600; color: var(--muted-2)')}>{g.title}</span>
            </div>
            {g.opts.map((o, oi) => {
              const idx = starts[gi] + oi;
              const on = o.label === p.value;
              return (
                <div key={o.id} id={listId + '-' + idx} role="option" aria-selected={on} onMouseMove={() => { if (act !== idx) setAct(idx); }} onClick={() => p.pick(o.label)}
                  style={css('display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 0 10px; border-radius: 10px; cursor: pointer; background: ' + (idx === cur ? 'var(--hover)' : 'transparent') + ';')}>
                  <Chip tone={o.tone} dark={dark} variant="block">{o.label}</Chip>
                  <span style={css('flex: 1')}></span>
                  {o.notify ? <Bell /> : null}
                  {on ? <Icon d={IC.check} sw={1.75} style="flex: none; color: var(--ink)" /> : null}
                </div>
              );
            })}
          </div>
        ))}
        {!flat.length ? <p style={css('margin: 0; padding: 8px 10px; font-size: 13px; color: var(--muted-2)')}>No statuses match.</p> : null}
      </div>
    </Popover>
  );
}

// One stage in the options editor: header with count and add, then its statuses (drag to reorder within the stage).
function StatusGroup({ g, p, dark, sub, onSub }) {
  const listRef = useRef(null);
  const { handle, lineEl } = useOptionDrag(listRef, p.move);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const add = () => { if (draft.trim() && g.add(draft)) { setDraft(''); setAdding(false); } };
  return (
    <>
      <div style={css('display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 6px 0 10px; margin-top: 4px')}>
        <span aria-hidden="true" style={css(groupDot(g.color))}></span>
        <span style={css('flex: 1; font-size: 13px; font-weight: 700; color: var(--ink)')}>{g.title}</span>
        <span style={css('font-size: 12px; color: var(--muted-2)')}>{plural(g.count, 'option', 'options')}</span>
        <button type="button" className="fb-ni" aria-label={'Add option to ' + g.title} aria-expanded={adding} onClick={() => setAdding(!adding)}
          style={css('width: 28px; height: 28px; flex: none; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
          <Icon d={IC.plus} size={14} />
        </button>
      </div>
      {adding ? (
        <div style={css('margin: 0 2px 4px')}>
          <Field size="sm" label={'New status in ' + g.title} hideLabel placeholder="Name the status, press Enter" value={draft} autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); add(); } else if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); } }} />
        </div>
      ) : null}
      <div ref={listRef} style={css('position: relative; display: flex; flex-direction: column; gap: 2px')}>
        {g.opts.map((o) => (
          <div key={o.id} data-opt={o.id} style={css('display: flex; align-items: center; gap: 4px; padding-left: 6px; border-radius: 10px')}>
            <DragHandle props={handle(o.id)} />
            <MenuRow h={40} active={sub === 'st:' + o.id} aria-label={'Edit ' + o.label} aria-expanded={sub === 'st:' + o.id} onClick={() => onSub(sub === 'st:' + o.id ? '' : 'st:' + o.id)}>
              <span style={css('flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px')}>
                <Chip tone={o.tone} dark={dark} variant="block">{o.label}</Chip>
                {o.isDefault ? <span style={css(badge + 'background: var(--chip); color: var(--ink-3)')}>Default</span> : null}
                {o.notify ? <Bell /> : null}
              </span>
              <Icon d={IC.more} size={14} sw={2.2} style="flex: none; color: var(--ink)" />
            </MenuRow>
          </div>
        ))}
        {lineEl}
      </div>
    </>
  );
}

// Header menu block for the Status column (Super Admin): every stage with its statuses, and the default for new projects.
export function StatusOptionsBlock({ p, dark, sub, onSub }) {
  return (
    <>
      <MenuLabel>Status options</MenuLabel>
      {p.groups.map((g) => <StatusGroup key={g.stage} g={g} p={p} dark={dark} sub={sub} onSub={onSub} />)}
      <Divider />
      <MenuRow label="Default for new projects" meta={p.defaultLabel} sub active={sub === 'default'} aria-expanded={sub === 'default'} onClick={() => onSub(sub === 'default' ? '' : 'default')} />
    </>
  );
}

export function DefaultStatusMenu({ p, dark, align, x, top, onClose }) {
  return (
    <Popover label="Default for new projects" onClose={onClose} scrim={false} align={align} x={x} top={top} width={240} maxH={520}>
      <MenuLabel>New projects start in</MenuLabel>
      {p.all.map((o) => (
        <MenuRow key={o.id} checked={o.id === p.defaultId} onClick={() => { p.setDefault(o.id); onClose(); }}>
          <span style={css('flex: 1; min-width: 0; display: flex')}><Chip tone={o.tone} dark={dark} variant="block">{o.label}</Chip></span>
        </MenuRow>
      ))}
    </Popover>
  );
}

// Status option menu: name, group, notify sponsor, editors can set, color, delete.
export function StatusOptionMenu({ o, p, dark, align, x, top, onClose }) {
  const [name, setName] = useState(o.label);
  const [view, setView] = useState('main');
  const saved = useRef(false);
  const commit = () => { if (!o.system && !saved.current && name.trim() && name.trim() !== o.label) { saved.current = true; p.rename(o.id, name); } };
  const close = () => { commit(); onClose(); };
  return (
    <Popover label={'Status ' + o.label} onClose={close} scrim={false} align={align} x={x} top={top} width={280} maxH={560}>
      <Field size="sm" label="Status name" hideLabel strong value={name} data-autofocus="" disabled={o.system}
        onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); close(); } }} />
      {o.system ? <p style={css('margin: 0; padding: 6px 10px 2px; font-size: 12px; line-height: 1.45; color: var(--muted-2)')}>Built-in status. Its name and group stay fixed.</p> : null}
      <div style={css('height: 4px; flex: none')}></div>
      {view === 'group' ? (
        <>
          <MenuRow icon={IC.back} label="Group" onClick={() => setView('main')} />
          <Divider />
          {p.stages.map((sg) => <MenuRow key={sg.id} label={sg.label} checked={sg.id === o.stage} onClick={() => { p.setGroup(o.id, sg.id); setView('main'); }} />)}
        </>
      ) : (
        <>
          <MenuRow icon={SI.group} label="Group" meta={o.system ? o.stageLabel + ', fixed' : o.stageLabel} sub={!o.system} disabled={o.system} onClick={() => setView('group')} />
          <MenuRow icon={SI.bell} label="Notify sponsor" toggle={o.notify} onClick={() => p.toggleNotify(o.id)} />
          <MenuRow icon={SI.lock} label="Editors can set this" toggle={o.editors} onClick={() => p.toggleEditors(o.id)} />
          <Divider />
          <SwatchList layout="grid" value={o.tone} dark={dark} onChange={(t) => p.setColor(o.id, t)} />
          {!o.system ? (
            <>
              <Divider />
              <MenuRow icon={IC.trash} danger label="Delete" disabled={o.count > 0} meta={o.count ? 'Used in ' + plural(o.count, 'project', 'projects') : ''}
                title={o.count ? 'Move these projects to another status first.' : undefined} onClick={() => { onClose(); p.deleteOption(o.id); }} />
            </>
          ) : null}
        </>
      )}
    </Popover>
  );
}
