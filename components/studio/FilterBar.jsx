'use client';
// app: filters and sorts (database components step 7, docs/design/database-components/FilterSort.dc.html):
// Filter by, the rule editor, the chips row under the toolbar, the sort editor, the advanced filter and the
// no-matches state. Models come from `fx` in lib/studio/vals.js. Toolbar popovers close through the board's own
// menu backdrop, so these pass scrim={false} and close on Esc.
import { useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { Popover, MenuRow, Divider, Field, Chip, Button, Icon, IC } from './Prims';
import { useOptionDrag, DragHandle } from './SelectPicker';

const FI = {
  filter: 'M2.5 4h11M4.5 8h7M6.5 12h3',
  up: 'M8 13V3M4 7l4-4 4 4',
  down: 'M8 3v10M4 9l4 4 4-4',
  adv: 'M2.5 4h7M12.5 4h1M2.5 11.5h1M6.5 11.5h7M11 2.5v3M5 10v3'
};
const box = (on) => 'width: 16px; height: 16px; flex: none; box-sizing: border-box; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; color: var(--inv-ink); ' +
  (on ? 'background: var(--inv); border: 0;' : 'background: var(--surface); border: 1.5px solid var(--border-strong);');
const pick = 'display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 6px; border: 0; border-radius: 6px; background: var(--chip); font-size: 13px; font-weight: 500; color: var(--ink-2b); cursor: pointer;';

// B. Filter by: every property, then the advanced filter.
export function FilterBy({ fx, onClose }) {
  const [q, setQ] = useState('');
  const lq = q.trim().toLowerCase();
  const props = fx.props.filter((p) => !lq || p.label.toLowerCase().includes(lq));
  return (
    <Popover label="Filter by" onClose={onClose} scrim={false} width={250} maxH={460}>
      <div style={css('margin-bottom: 4px')}>
        <Field size="sm" label="Filter by" hideLabel placeholder="Filter by…" value={q} data-autofocus="" onChange={(e) => setQ(e.target.value)} />
      </div>
      {props.map((p) => <MenuRow key={p.key} icon={p.icon} label={p.label} onClick={p.pick} />)}
      {!props.length ? <p style={css('margin: 0; padding: 8px 10px; font-size: 13px; color: var(--muted-2)')}>No properties match.</p> : null}
      <Divider />
      <MenuRow icon={IC.plus} label="Add advanced filter" onClick={fx.addAdvanced} />
    </Popover>
  );
}

// The value part of a rule: options with checkboxes, a text or number field, or date choices.
function ValueEditor({ r, dark }) {
  const [q, setQ] = useState('');
  if (!r.needsValue) return <p style={css('margin: 0; padding: 6px 10px; font-size: 13px; color: var(--muted-2)')}>No value needed.</p>;
  if (r.kind === 'select' || r.kind === 'person') {
    const lq = q.trim().toLowerCase();
    const opts = r.options.filter((o) => !lq || o.label.toLowerCase().includes(lq));
    return (
      <>
        <div style={css('margin-bottom: 4px')}>
          <Field size="sm" label={'Search ' + r.label} hideLabel placeholder={r.kind === 'person' ? 'Search people…' : 'Select one or more options…'} value={q} data-autofocus="" onChange={(e) => setQ(e.target.value)} />
        </div>
        {opts.map((o) => (
          <MenuRow key={o.id} h={34} aria-pressed={o.on} onClick={o.toggle}>
            <span aria-hidden="true" style={css(box(o.on))}>{o.on ? <Icon d={IC.check} size={12} sw={2.4} /> : null}</span>
            <span style={css('flex: 1; min-width: 0; display: flex')}>
              {o.tone ? <Chip tone={o.tone} dark={dark} variant={o.variant || 'pill'}>{o.label}</Chip> : <span style={css('overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{o.label}</span>}
            </span>
          </MenuRow>
        ))}
        {!opts.length ? <p style={css('margin: 0; padding: 8px 10px; font-size: 13px; color: var(--muted-2)')}>No options.</p> : null}
      </>
    );
  }
  if (r.kind === 'date') {
    if (r.date.within) return <>{r.date.ranges.map((x) => <MenuRow key={x.id} label={x.label} checked={x.on} onClick={x.pick} />)}</>;
    return (
      <>
        {r.date.rels.map((x) => <MenuRow key={x.id} label={x.label} checked={x.on} onClick={x.pick} />)}
        <label style={css('display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 0 10px; font-size: 14px; font-weight: 500; color: var(--ink)')}>
          <span style={css('flex: 1')}>Exact date</span>
          <input type="date" value={r.date.exact} onChange={(e) => r.date.setExact(e.target.value)}
            style={css('height: 32px; padding: 0 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); color: var(--ink); font-size: 13px')} />
        </label>
      </>
    );
  }
  return (
    <div style={css('padding: 2px 2px 4px')}>
      <Field size="sm" label={r.label + ' value'} hideLabel placeholder={r.kind === 'number' ? 'Type a number' : 'Type a value'} value={r.text} data-autofocus=""
        inputMode={r.kind === 'number' ? 'decimal' : undefined} onChange={(e) => r.setText(e.target.value)} />
    </div>
  );
}

// C / D. Rule editor: property, operator, more menu, then the value.
export function RuleEditor({ r, dark, onClose }) {
  const [view, setView] = useState('value');
  return (
    <Popover label={r.label + ' filter'} onClose={onClose} scrim={false} width={290} maxH={480}>
      <div style={css('display: flex; align-items: center; gap: 4px; padding: 2px 4px 6px')}>
        <span style={css('font-size: 13px; font-weight: 600; color: var(--ink)')}>{r.label}</span>
        <button type="button" aria-expanded={view === 'ops'} onClick={() => setView(view === 'ops' ? 'value' : 'ops')} style={css(pick)}>
          {r.opLabel}<Icon d={IC.chevD} size={12} />
        </button>
        <span style={css('flex: 1')}></span>
        <button type="button" className="fb-ni" aria-label="Rule options" aria-expanded={view === 'more'} onClick={() => setView(view === 'more' ? 'value' : 'more')}
          style={css('width: 28px; height: 28px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
          <Icon d={IC.more} size={14} sw={2.2} />
        </button>
      </div>
      {view === 'ops' ? r.ops.map((o) => <MenuRow key={o.id} label={o.label} checked={o.on} onClick={() => { o.pick(); setView('value'); }} />) : null}
      {view === 'more' ? (
        <>
          <MenuRow icon={IC.trash} danger label="Delete filter" onClick={r.remove} />
          {r.toAdvanced ? <MenuRow icon={FI.adv} label="Add to advanced filter" onClick={r.toAdvanced} /> : null}
        </>
      ) : null}
      {view === 'value' ? <ValueEditor r={r} dark={dark} /> : null}
    </Popover>
  );
}

// E. Sort: drag to reorder, property, direction, remove.
export function SortEditor({ sort, onClose }) {
  const [view, setView] = useState('');
  const listRef = useRef(null);
  const { handle, lineEl } = useOptionDrag(listRef, (from, to) => sort.move(Number(from), to));
  const pickIdx = view.indexOf('prop:') === 0 ? Number(view.slice(5)) : -1;
  const field = 'display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer;';
  return (
    <Popover label="Sort" onClose={onClose} scrim={false} width={380} maxH={460}>
      {pickIdx >= 0 && sort.items[pickIdx] ? (
        <>
          <MenuRow icon={IC.back} label="Sort by" onClick={() => setView('')} />
          <Divider />
          {sort.items[pickIdx].props.map((p) => <MenuRow key={p.key} icon={p.icon} label={p.label} checked={p.on} onClick={() => { p.pick(); setView(''); }} />)}
        </>
      ) : (
        <>
          {!sort.items.length ? <p style={css('margin: 0; padding: 8px 10px; font-size: 13px; color: var(--muted-2)')}>No sorts. Projects keep board order.</p> : null}
          <div ref={listRef} style={css('position: relative; display: flex; flex-direction: column; gap: 2px')}>
            {sort.items.map((x, i) => (
              <div key={x.key} data-opt={String(i)} style={css('display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 4px')}>
                <DragHandle props={handle(String(i))} />
                <button type="button" aria-label={'Sort by ' + x.label + '. Change property'} onClick={() => setView('prop:' + i)} style={css(field + ' flex: 1; min-width: 0;')}>
                  <Icon d={x.icon} size={14} style="flex: none; color: var(--ink-3)" />
                  <span style={css('flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{x.label}</span>
                  <Icon d={IC.chevD} size={12} style="flex: none; color: var(--ink-3)" />
                </button>
                <button type="button" aria-label={x.dirLabel + '. Switch direction'} onClick={() => x.setDir(x.dir === 'asc' ? 'desc' : 'asc')} style={css(field + ' flex: none;')}>
                  <Icon d={x.dir === 'asc' ? FI.up : FI.down} size={14} style="flex: none; color: var(--ink-3)" />{x.dirLabel}
                </button>
                <button type="button" className="fb-ni" aria-label={'Remove sort by ' + x.label} onClick={x.remove}
                  style={css('width: 30px; height: 30px; flex: none; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
                  <Icon d={IC.x} size={14} />
                </button>
              </div>
            ))}
            {lineEl}
          </div>
          <Divider />
          {sort.canAdd ? <MenuRow icon={IC.plus} label="Add sort" onClick={sort.add} /> : null}
          {sort.items.length ? <MenuRow icon={IC.trash} danger label="Delete sort" onClick={sort.clear} /> : null}
        </>
      )}
    </Popover>
  );
}

// F. Advanced filter: Where / And / Or rows, one level of groups. A row's property, operator or value opens below it.
function AdvRow({ r, dark, part, setPart, indent }) {
  const cell = 'display: flex; align-items: center; gap: 6px; height: 34px; min-width: 0; padding: 0 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); font-size: 13px; font-weight: 500; color: var(--ink); cursor: pointer;';
  const open = part.indexOf(r.id + ':') === 0 ? part.slice(r.id.length + 1) : '';
  const toggle = (p) => setPart(open === p ? '' : r.id + ':' + p);
  const joinS = 'font-size: 13px; font-weight: 600; ';
  return (
    <div style={css('display: flex; flex-direction: column; gap: 4px; padding-left: ' + (indent ? 12 : 0) + 'px')}>
      <div style={css('display: grid; grid-template-columns: 72px minmax(0, 170px) minmax(0, 140px) minmax(0, 1fr) 30px; gap: 6px; align-items: center')}>
        {r.canJoin ? (
          <button type="button" aria-label={'Join rules with ' + r.joinLabel + '. Switch'} onClick={() => r.setJoin(r.joinLabel === 'And' ? 'or' : 'and')}
            style={css(joinS + 'height: 30px; border: 0; border-radius: 8px; cursor: pointer; ' + (r.joinLabel === 'Or' ? 'background: var(--violet-soft); color: var(--violet-ink);' : 'background: var(--chip); color: var(--ink);'))}>{r.joinLabel}</button>
        ) : <span style={css(joinS + 'color: var(--ink-3); padding-left: 4px')}>{r.joinLabel}</span>}
        <button type="button" aria-expanded={open === 'prop'} onClick={() => toggle('prop')} style={css(cell)}>
          <span style={css('flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{r.label}</span><Icon d={IC.chevD} size={12} style="flex: none" />
        </button>
        <button type="button" aria-expanded={open === 'op'} onClick={() => toggle('op')} style={css(cell)}>
          <span style={css('flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{r.opLabel}</span><Icon d={IC.chevD} size={12} style="flex: none" />
        </button>
        {r.needsValue ? (
          <button type="button" aria-expanded={open === 'value'} onClick={() => toggle('value')} style={css(cell)}>
            <span style={css('flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{r.valueLabel}</span><Icon d={IC.chevD} size={12} style="flex: none" />
          </button>
        ) : <span></span>}
        <button type="button" className="fb-ni" aria-label="Rule options" aria-expanded={open === 'more'} onClick={() => toggle('more')}
          style={css('width: 30px; height: 30px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
          <Icon d={IC.more} size={14} sw={2.2} />
        </button>
      </div>
      {open ? (
        <div style={css('margin-left: 78px; padding: 6px; border: 1px solid var(--line-4); border-radius: 12px; background: var(--surface); display: flex; flex-direction: column; gap: 2px; max-height: 260px; overflow-y: auto')}>
          {open === 'prop' ? r.props.map((p) => <MenuRow key={p.key} icon={p.icon} label={p.label} checked={p.on} onClick={() => { p.pick(); setPart(''); }} />) : null}
          {open === 'op' ? r.ops.map((o) => <MenuRow key={o.id} label={o.label} checked={o.on} onClick={() => { o.pick(); setPart(''); }} />) : null}
          {open === 'value' ? <ValueEditor r={r} dark={dark} /> : null}
          {open === 'more' ? (
            <>
              <MenuRow icon={IC.trash} danger label="Delete rule" onClick={() => { setPart(''); r.remove(); }} />
              <MenuRow icon={FI.adv} label="Duplicate rule" onClick={() => { setPart(''); r.duplicate(); }} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AdvancedEditor({ adv, dark, onClose }) {
  const [part, setPart] = useState('');
  const act = 'display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; font-size: 14px; font-weight: 500; cursor: pointer;';
  return (
    <Popover label="Advanced filter" onClose={onClose} scrim={false} width={720} pad={12} maxH={520}>
      <div style={css('display: flex; flex-direction: column; gap: 6px')}>
        {adv.rows.map((row) => (row.group ? (
          <div key={row.id} style={css('display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 6px; align-items: start')}>
            {row.canJoin ? (
              <button type="button" onClick={() => row.setJoin(row.joinLabel === 'And' ? 'or' : 'and')} style={css('height: 30px; margin-top: 8px; border: 0; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; background: var(--chip); color: var(--ink)')}>{row.joinLabel}</button>
            ) : <span style={css('padding: 14px 0 0 4px; font-size: 13px; font-weight: 600; color: var(--ink-3)')}>{row.joinLabel}</span>}
            <div role="group" aria-label="Filter group" style={css('display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2)')}>
              {row.rows.map((r) => <AdvRow key={r.id} r={r} dark={dark} part={part} setPart={setPart} />)}
              <div style={css('display: flex; gap: 6px')}>
                <button type="button" className="fb-ni" onClick={row.addRule} style={css(act + ' color: var(--ink)')}><Icon d={IC.plus} size={14} />Add rule to group</button>
                <span style={css('flex: 1')}></span>
                <button type="button" className="fb-ni" onClick={row.remove} style={css(act + ' color: var(--red-ink)')}>Delete group</button>
              </div>
            </div>
          </div>
        ) : <AdvRow key={row.id} r={row} dark={dark} part={part} setPart={setPart} />))}
      </div>
      <div style={css('height: 1px; background: var(--line); margin: 10px 0 6px')}></div>
      <div style={css('display: flex; gap: 6px')}>
        <button type="button" className="fb-ni" onClick={adv.addRule} style={css(act + ' color: var(--ink)')}><Icon d={IC.plus} size={14} />Add rule</button>
        <button type="button" className="fb-ni" onClick={adv.addGroup} style={css(act + ' color: var(--ink)')}><Icon d={IC.plus} size={14} />Add group</button>
        <span style={css('flex: 1')}></span>
        <button type="button" className="fb-ni" onClick={adv.clear} style={css(act + ' color: var(--red-ink)')}>Delete filter</button>
      </div>
    </Popover>
  );
}

// A. The row under the toolbar: rule chips, + Filter, the sort chip, Reset and Save for <role> view.
export function FilterChips({ fx, dark }) {
  const chip = (on) => 'display: inline-flex; align-items: center; gap: 6px; max-width: 320px; height: 32px; padding: 0 10px; border: 1px solid ' + (on ? 'var(--ink)' : 'var(--ink)') + '; border-radius: 999px; background: var(--surface); font-size: 13px; color: var(--ink); cursor: pointer; white-space: nowrap;';
  return (
    <div style={css('position: relative; z-index: 24; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid var(--line)')}>
      {fx.rules.map((r) => (
        <div key={r.id} style={css('position: relative')}>
          <button type="button" aria-expanded={r.open} onClick={r.toggle} style={css(chip(r.open))}>
            <Icon d={r.icon} size={14} />
            <span style={css('font-weight: 600')}>{r.label + ':'}</span>
            <span style={css('min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--ink-3)')}>{r.summary}</span>
            <Icon d={IC.chevD} size={12} />
          </button>
          {r.open ? <RuleEditor r={r} dark={dark} onClose={fx.closeMenu} /> : null}
        </div>
      ))}
      {fx.adv ? (
        <div style={css('position: relative')}>
          <button type="button" aria-expanded={fx.advOpen} onClick={fx.toggleAdv} style={css(chip(fx.advOpen))}>
            <Icon d={FI.filter} size={14} /><span style={css('font-weight: 600')}>{fx.advCount === 1 ? '1 rule' : fx.advCount + ' rules'}</span><Icon d={IC.chevD} size={12} />
          </button>
          {fx.advOpen ? <AdvancedEditor adv={fx.adv} dark={dark} onClose={fx.closeMenu} /> : null}
        </div>
      ) : null}
      <div style={css('position: relative')}>
        <button type="button" aria-expanded={fx.addOpen} onClick={fx.toggleAdd}
          style={css('display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border: 1px dashed var(--border-strong); border-radius: 999px; background: transparent; font-size: 13px; font-weight: 600; color: var(--ink-3); cursor: pointer')}>
          <Icon d={IC.plus} size={12} sw={1.75} />Filter
        </button>
        {fx.addOpen ? <FilterBy fx={fx} onClose={fx.closeMenu} /> : null}
      </div>
      {fx.sort.items.length ? (
        <>
          <span aria-hidden="true" style={css('width: 1px; height: 20px; background: var(--border); margin: 0 4px')}></span>
          <div style={css('position: relative')}>
            <button type="button" aria-expanded={fx.sortChipOpen} onClick={fx.toggleSortChip} style={css(chip(fx.sortChipOpen))}>
              {fx.sort.dir ? <Icon d={fx.sort.dir === 'asc' ? FI.up : FI.down} size={14} /> : null}
              <span style={css('font-weight: 600')}>{fx.sort.label}</span>
              <Icon d={IC.chevD} size={12} />
            </button>
            {fx.sortChipOpen ? <SortEditor sort={fx.sort} onClose={fx.closeMenu} /> : null}
          </div>
        </>
      ) : null}
      <span style={css('flex: 1')}></span>
      {fx.canReset ? <button type="button" className="fb-ni" onClick={fx.reset} style={css('height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; font-size: 13px; font-weight: 600; color: var(--ink-3); cursor: pointer')}>Reset</button> : null}
      {fx.canSave ? <Button kind="secondary" h={32} onClick={fx.save}>{fx.saveLabel}</Button> : null}
    </div>
  );
}

// G. A group with nothing left after the filters.
export function NoMatch({ text, fx }) {
  return (
    <div style={css('padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; border-bottom: 1px solid var(--line)')}>
      <span aria-hidden="true" style={css('width: 48px; height: 48px; border-radius: 14px; background: var(--chip); color: var(--ink); display: inline-flex; align-items: center; justify-content: center')}><Icon d={FI.filter} size={20} /></span>
      <p style={css('margin: 0; font-size: 16px; font-weight: 700; color: var(--ink)')}>No projects match these filters</p>
      <p style={css('margin: 0; max-width: 300px; font-size: 14px; line-height: 1.5; color: var(--ink-3)')}>{text}</p>
      <div style={css('display: flex; gap: 8px')}>
        <Button kind="secondary" onClick={fx.editFilters}>Edit filters</Button>
        <Button onClick={fx.clearAll}>Clear all</Button>
      </div>
    </div>
  );
}
