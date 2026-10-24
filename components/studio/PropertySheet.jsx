'use client';
// app: Edit property side sheet (database components step 5, docs/design/database-components/EditProperty.dc.html).
// One shell for every column: name, type, the type's own block, display, Visible to, then duplicate and delete.
// The model is `sheet` from lib/studio/vals.js. Menus that pick a value open beside the sheet, to its left.
import { useEffect, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { srOnly } from '@/lib/studio/prims';
import { Popover, MenuRow, MenuLabel, Divider, Field, Segmented, Icon, IC } from './Prims';
import { OptionsBlock, OptionMenu, SortMenu } from './SelectPicker';
import { StatusOptionsBlock, StatusOptionMenu, DefaultStatusMenu } from './StatusEditor';

const PI = {
  swap: 'M3 5.5h10M10.5 3l2.5 2.5L10.5 8M13 10.5H3M5.5 8L3 10.5 5.5 13',
  dollar: 'M8 2v12M11 4.5H6.75a2 2 0 0 0 0 4h2.5a2 2 0 0 1 0 4H4.5',
  dec: 'M3 12h.01M6 4h3v8M12 4h-1.5v8',
  sum: 'M12 3H4l4.5 5L4 13h8',
  date: 'M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3',
  color: 'M8 2.5l6 10.5H2z',
  card: 'M2.5 3.5h11v9h-11zM5 6.5h6M5 9h3.5',
  dup: 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3',
  warn: 'M8 2.5l6 10.5H2zM8 6.5v3M8 11.5h.01'
};
const SHEET_W = 320;
// Side menus sit left of the sheet, level with its upper rows.
const SIDE = { align: 'right', x: SHEET_W + 8, top: '56px' };
const iconBtn = 'width: 32px; height: 32px; flex: none; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';

function ChoiceMenu({ label, items, onClose, note }) {
  return (
    <Popover label={label} onClose={onClose} scrim={false} width={250} maxH={520} {...SIDE}>
      <MenuLabel>{label}</MenuLabel>
      {items.map((it) => <MenuRow key={it.id || it.label} icon={it.icon} label={it.label} checked={it.on} onClick={() => { it.pick(); onClose(); }} />)}
      {note ? (
        <div style={css('display: flex; gap: 8px; margin-top: 6px; padding: 10px; border-radius: 10px; background: var(--amber-soft); color: var(--amber-ink)')}>
          <Icon d={PI.warn} style="flex: none; margin-top: 1px" />
          <p style={css('margin: 0; font-size: 12px; line-height: 1.45')}>{note}</p>
        </div>
      ) : null}
    </Popover>
  );
}

function Preview({ children }) {
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px; margin: 4px 8px 6px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line)')}>
      <span style={css('font-size: 11px; font-weight: 600; color: var(--muted-2)')}>Preview</span>
      <div style={css('display: flex; align-items: center; gap: 8px; min-height: 24px')}>{children}</div>
    </div>
  );
}

function SegRow({ caption, model }) {
  return (
    <div style={css('padding: 4px 8px 8px')}>
      <Segmented label={caption} caption={caption} size="sm" options={model.options} value={model.value} onChange={model.set} />
    </div>
  );
}

// A row that only shows a value (built-in columns keep their type).
function StaticRow({ icon, label, value }) {
  return (
    <div style={css('display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 0 10px; font-size: 14px; font-weight: 500; color: var(--ink)')}>
      <Icon d={icon} style="flex: none; color: var(--ink-3)" />
      <span style={css('flex: 1')}>{label}</span>
      <span style={css('font-size: 13px; color: var(--muted-2)')}>{value}</span>
    </div>
  );
}

export default function PropertySheet({ p, dark }) {
  const [name, setName] = useState(p.name);
  const [sub, setSub] = useState('');
  const saved = useRef(false);
  const ref = useRef(null);
  useEffect(() => {
    // The name field when it can be edited, else the first button.
    const el = ref.current && (ref.current.querySelector('input:not(:disabled)') || ref.current.querySelector('button'));
    if (el) el.focus({ preventScroll: true });
  }, []);
  const commit = () => { if (p.canRename && !saved.current && name.trim() && name.trim() !== p.name) { saved.current = true; p.rename(name); } };
  const close = () => { commit(); p.close(); };
  const back = () => { commit(); p.back(); };
  const toggle = (id) => setSub(sub === id ? '' : id);
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (sub) setSub(''); else close();
  };
  const opt = p.options && sub.indexOf('opt:') === 0 ? p.options.options.find((o) => 'opt:' + o.id === sub) : null;
  const st = p.status && sub.indexOf('st:') === 0 ? p.status.all.find((o) => 'st:' + o.id === sub) : null;
  const num = p.number, dt = p.date, ps = p.person;

  return (
    <aside ref={ref} aria-label={'Edit property ' + p.name} onKeyDown={onKey}
      style={css('position: fixed; z-index: 45; top: 16px; right: 16px; bottom: 16px; width: ' + SHEET_W + 'px; max-width: calc(100vw - 32px); box-sizing: border-box; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line-4); border-radius: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 24px 60px rgba(0,0,0,0.12); color: var(--ink)')}>
      <div style={css('flex: 1; min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 2px')}>
        <div style={css('display: flex; align-items: center; gap: 6px; min-height: 40px; margin-bottom: 6px')}>
          <button type="button" className="fb-ni" aria-label="Back to the column menu" onClick={back} style={css(iconBtn)}><Icon d={IC.back} /></button>
          <h2 style={css('margin: 0; flex: 1; font-size: 15px; font-weight: 700')}>Edit property</h2>
          <button type="button" className="fb-ni" aria-label="Close" onClick={close} style={css(iconBtn)}><Icon d={IC.x} /></button>
        </div>
        <div style={css('display: flex; gap: 6px; margin-bottom: 8px')}>
          <span aria-hidden="true" style={css('width: 40px; height: 40px; flex: none; box-sizing: border-box; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); display: inline-flex; align-items: center; justify-content: center')}><Icon d={p.icon} /></span>
          <div style={css('flex: 1; min-width: 0')}>
            <Field label="Property name" hideLabel strong value={name} disabled={!p.canRename} title={p.canRename ? undefined : 'Built-in columns keep their name'}
              onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
          </div>
        </div>

        {p.canChangeType
          ? <MenuRow h={38} icon={PI.swap} label="Type" meta={p.typeLabel} sub active={sub === 'type'} aria-expanded={sub === 'type'} onClick={() => toggle('type')} />
          : <StaticRow icon={PI.swap} label="Type" value={p.typeLabel + ', built in'} />}

        {p.options ? (
          <>
            <OptionsBlock p={p.options} dark={dark} sub={sub} onSub={setSub} />
            <Divider />
            <SegRow caption="Show as" model={p.selectShow} />
          </>
        ) : null}

        {p.status ? (
          <>
            <StatusOptionsBlock p={p.status} dark={dark} sub={sub} onSub={setSub} />
            <Divider />
            <SegRow caption="Show as, in this view" model={p.statusShow} />
          </>
        ) : null}

        {num ? (
          <>
            <MenuRow h={38} icon={PI.dollar} label="Format" meta={num.formatLabel} sub active={sub === 'format'} aria-expanded={sub === 'format'} onClick={() => toggle('format')} />
            <div style={css('display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 0 10px')}>
              <Icon d={PI.dec} style="flex: none; color: var(--ink-3)" />
              <span id="ps-dec" style={css('flex: 1; font-size: 14px; font-weight: 500')}>Decimals</span>
              <div role="group" aria-labelledby="ps-dec" style={css('display: flex; align-items: center; border: 1px solid var(--border); border-radius: 10px; overflow: hidden')}>
                <button type="button" aria-label="Fewer decimals" onClick={() => num.dec(-1)} style={css('width: 28px; height: 28px; border: 0; background: var(--panel); color: var(--ink); font-size: 15px; cursor: pointer')}>−</button>
                <span aria-live="polite" style={css('min-width: 36px; text-align: center; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums')}>{num.decLabel}</span>
                <button type="button" aria-label="More decimals" onClick={() => num.dec(1)} style={css('width: 28px; height: 28px; border: 0; background: var(--panel); color: var(--ink); font-size: 15px; cursor: pointer')}>+</button>
              </div>
            </div>
            <SegRow caption="Show as" model={num.show} />
            {num.show.value !== 'number' ? <p style={css('margin: 0; padding: 0 10px 4px; font-size: 12px; color: var(--muted-2)')}>Bar and Ring read the value as a percent of 100.</p> : null}
            <Preview>
              <span style={css('flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 8px')}>
                {num.preview.map((x, i) => <span key={i} style={css(x.style)}>{x.text}</span>)}
              </span>
            </Preview>
            <MenuRow h={38} icon={PI.sum} label="Footer total" meta={num.footerLabel} sub active={sub === 'footer'} aria-expanded={sub === 'footer'} onClick={() => toggle('footer')} />
          </>
        ) : null}

        {dt ? (
          <>
            <MenuRow h={38} icon={PI.date} label="Date format" meta={dt.formatLabel} sub active={sub === 'datefmt'} aria-expanded={sub === 'datefmt'} onClick={() => toggle('datefmt')} />
            <MenuLabel>Due states</MenuLabel>
            <MenuRow h={38} icon={PI.color} label="Late red, today amber" toggle={dt.due} onClick={dt.toggleDue} />
            <Preview>{dt.preview.map((x, i) => <span key={i} style={css(x.style)}>{x.text}</span>)}</Preview>
          </>
        ) : null}

        {ps ? (
          <>
            <SegRow caption="Show as, in this view" model={ps.show} />
            <Preview>
              <span aria-hidden="true" style={css(ps.avatarStyle)}>{ps.initials}</span>
              {ps.show.value === 'name' ? <span style={css('font-size: 14px; color: var(--ink-2b)')}>{ps.name}</span> : <span style={css(srOnly)}>{ps.name}</span>}
            </Preview>
          </>
        ) : null}

        {p.cards ? (
          <>
            <Divider />
            <MenuRow h={38} icon={PI.card} label="Show on cards" toggle={p.cards.on} onClick={p.cards.toggle} />
          </>
        ) : null}

        <MenuLabel>Visible to</MenuLabel>
        <div role="group" aria-label="Visible to" style={css('display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 8px 6px')}>
          {p.roles.map((r) => (
            <button key={r.id} type="button" aria-pressed={r.on} disabled={r.locked} title={r.note || undefined} onClick={r.toggle}
              style={css('height: 30px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: ' + (r.locked ? 'default' : 'pointer') + '; ' +
                (r.on ? 'border: 1px solid var(--inv); background: var(--inv); color: var(--inv-ink);' : 'border: 1px solid var(--border-2); background: var(--surface); color: var(--ink-2b);') + (r.locked ? ' opacity: 0.6;' : ''))}>
              {r.on ? '✓ ' : ''}{r.label}
            </button>
          ))}
        </div>

        {p.canDuplicate || p.canDelete ? (
          <>
            <Divider />
            {p.canDuplicate ? <MenuRow h={38} icon={PI.dup} label="Duplicate property" onClick={() => { commit(); p.duplicate(); }} /> : null}
            {p.canDelete ? <MenuRow h={38} icon={IC.trash} danger label="Delete property" onClick={p.askDelete} /> : null}
          </>
        ) : null}
      </div>

      {sub === 'type' ? (
        <ChoiceMenu label="Change type" onClose={() => setSub('')}
          items={p.types.map((t) => ({ label: t.label, icon: t.icon, on: t.on, pick: t.pick }))}
          note="Switching to Select keeps each value as an option. Number, Date and Checkbox clear values that do not convert. Person and Files start empty." />
      ) : null}
      {num && sub === 'format' ? <ChoiceMenu label="Number format" items={num.formats} onClose={() => setSub('')} /> : null}
      {num && sub === 'footer' ? <ChoiceMenu label="Footer total" items={num.footers} onClose={() => setSub('')} /> : null}
      {dt && sub === 'datefmt' ? <ChoiceMenu label="Date format" items={dt.formats} onClose={() => setSub('')} /> : null}
      {p.options && sub === 'sort' ? <SortMenu p={p.options} {...SIDE} onClose={() => setSub('')} /> : null}
      {opt ? <OptionMenu key={sub} o={opt} p={p.options} dark={dark} {...SIDE} onClose={() => setSub('')} /> : null}
      {st ? <StatusOptionMenu key={sub} o={st} p={p.status} dark={dark} {...SIDE} onClose={() => setSub('')} /> : null}
      {p.status && sub === 'default' ? <DefaultStatusMenu p={p.status} dark={dark} {...SIDE} onClose={() => setSub('')} /> : null}
    </aside>
  );
}
