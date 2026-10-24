'use client';
// app: Add a column (database components step 9, docs/design/database-components/AddColumn.dc.html).
// Step 2 of the modal collects a type's settings before the column exists; QuickAdd is the header + popover.
// Models come from `addCol` and the header cell's `quick` in lib/studio/vals.js. The modal scrolls, so step 2's
// pickers open inline under their button rather than as popovers.
import { useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { Popover, MenuRow, MenuLabel, Divider, Field, Segmented, Chip, Button, SwatchList, Icon, IC } from './Prims';
import { useOptionDrag, DragHandle } from './SelectPicker';
import { dotOf } from '@/lib/studio/tones';

const sec = 'margin: 0; font-size: 13px; font-weight: 600; color: var(--ink);';
const pickBtn = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; height: 40px; padding: 0 12px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); font-size: 14px; font-weight: 500; color: var(--ink); cursor: pointer;';
const panel = 'display: flex; flex-direction: column; gap: 2px; padding: 4px; border: 1px solid var(--line-4); border-radius: 12px; background: var(--surface); max-height: 220px; overflow-y: auto;';
const iconBtn = 'width: 28px; height: 28px; flex: none; padding: 0; border: 0; border-radius: 8px; background: transparent; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';
const sortOf = (list, mode) => (mode === 'manual' ? list : list.slice().sort((a, b) => (mode === 'alpha_desc' ? -1 : 1) * a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })));

// A labeled button that opens its choices inline. `open`/`onOpen` let one picker open at a time.
function Pick({ label, value, open, onOpen, children }) {
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px; min-width: 0')}>
      <span style={css(sec)}>{label}</span>
      <button type="button" aria-expanded={open} onClick={onOpen} style={css(pickBtn)}>
        <span style={css('min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{value}</span>
        <Icon d={IC.chevD} size={14} style="flex: none; color: var(--ink-3)" />
      </button>
      {open ? <div style={css(panel)}>{children}</div> : null}
    </div>
  );
}

// B. Step 2: name, the type's settings, Visible to, then Create column.
export function AddColumnStep2({ m, dark }) {
  const [name, setName] = useState(m.name);
  const [opts, setOpts] = useState(m.seed);
  const [optSort, setOptSort] = useState('manual');
  const [showAs, setShowAs] = useState('pill');
  const [def, setDef] = useState(m.multi ? [] : '');
  const [numFmt, setNumFmt] = useState('number');
  const [calc, setCalc] = useState('none');
  const [dateFmt, setDateFmt] = useState('short');
  const [endDate, setEndDate] = useState(false);
  const [incTime, setIncTime] = useState(false);
  const [limit, setLimit] = useState('many');
  const [checked, setChecked] = useState(false);
  const [formula, setFormula] = useState('');
  const [roles, setRoles] = useState(['admin']);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState('');
  const listRef = useRef(null);
  const toggle = (k) => setOpen(open === k ? '' : k);
  const shown = sortOf(opts, optSort);
  const { handle, lineEl } = useOptionDrag(listRef, (id, to) => {
    const rest = opts.filter((o) => o.id !== id);
    rest.splice(to, 0, opts.find((o) => o.id === id));
    setOpts(rest);
  });
  const addOpt = () => {
    const label = draft.trim();
    if (!label) return;
    if (!opts.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
      setOpts(opts.concat([{ id: crypto.randomUUID(), label: label, color_token: m.palette[opts.length % m.palette.length] }]));
    }
    setDraft('');
  };
  const removeOpt = (o) => {
    setOpts(opts.filter((x) => x.id !== o.id));
    if (m.multi) setDef(def.filter((x) => x !== o.label)); else if (def === o.label) setDef('');
  };
  const recolor = (o, tn) => setOpts(opts.map((x) => (x.id === o.id ? { ...x, color_token: tn } : x)));
  const check = m.kind === 'formula' && formula.trim() ? m.checkFormula(formula) : null;
  const labelOf = (list, id) => (list.find((x) => x.id === id) || list[0]).label;
  const create = () => {
    const config = {};
    let options;
    if (m.kind === 'select') {
      options = opts.map((o, i) => ({ id: o.id, label: o.label, color_token: o.color_token, sort: (i + 1) * 100 }));
      Object.assign(config, { option_sort: optSort, show_as: showAs });
      if (m.multi ? def.length : def) config.default_value = def;
    } else if (m.kind === 'number') Object.assign(config, { number_format: numFmt }, calc !== 'none' ? { footer: calc } : {});
    else if (m.kind === 'date') Object.assign(config, { date_format: dateFmt, end_date: endDate, include_time: incTime });
    else if (m.kind === 'person' && limit === 'one') config.person_limit = 1;
    else if (m.kind === 'checkbox' && checked) config.default_value = true;
    else if (m.kind === 'formula' && formula.trim()) config.formula = formula.trim();
    m.create({ name: name, options: options, config: config, roles: roles.filter((r) => r !== 'admin') });
  };
  const defLabel = m.multi ? (def.length ? def.join(', ') : 'None') : def || 'None';
  return (
    <form onSubmit={(e) => { e.preventDefault(); create(); }} style={css('display: flex; flex-direction: column; gap: 18px')}>
      <div style={css('display: flex; align-items: center; gap: 12px')}>
        <button type="button" aria-label="Back to types" onClick={m.back} style={css('width: 44px; height: 44px; flex: none; border: 0; border-radius: 12px; background: var(--hover); color: var(--ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
          <Icon d={IC.back} />
        </button>
        <div style={css('display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0')}>
          <h2 id="column-modal-title" style={css('margin: 0; font-family: var(--font-title); font-size: 22px; font-weight: var(--weight-black); letter-spacing: -0.01em')}>New {m.type} column</h2>
          <p style={css('margin: 0; font-size: 13px; color: var(--muted)')}>{m.desc}</p>
        </div>
        <button type="button" aria-label="Close" onClick={m.close} style={css('width: 44px; height: 44px; flex: none; border: 0; border-radius: 12px; background: var(--hover); color: var(--ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
          <Icon d={IC.x} />
        </button>
      </div>

      <Field size="lg" label="Column name" value={name} data-autofocus="" autoFocus onChange={(e) => setName(e.target.value)} />

      {m.kind === 'select' ? (
        <>
          <div style={css('display: flex; flex-direction: column; gap: 6px')}>
            <div style={css('display: flex; align-items: center; justify-content: space-between')}>
              <span style={css(sec)}>Options</span>
              <button type="button" aria-expanded={open === 'sort'} onClick={() => toggle('sort')}
                style={css('display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; font-size: 13px; font-weight: 600; color: var(--ink-3); cursor: pointer')}>
                Sort: {labelOf(m.sorts, optSort)}<Icon d={IC.chevD} size={14} />
              </button>
            </div>
            {open === 'sort' ? (
              <div style={css(panel)}>
                {m.sorts.map((x) => <MenuRow key={x.id} label={x.label} checked={x.id === optSort} onClick={() => { setOptSort(x.id); setOpen(''); }} />)}
              </div>
            ) : null}
            <div ref={listRef} style={css('position: relative; display: flex; flex-direction: column; border: 1px solid var(--line-4); border-radius: 14px; padding: 4px')}>
              {shown.map((o) => (
                <div key={o.id} data-opt={o.id} style={css('display: flex; flex-direction: column')}>
                  <div style={css('display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 8px; border-radius: 10px')}>
                    {optSort === 'manual' ? <DragHandle props={handle(o.id)} /> : <span style={css('width: 16px; flex: none')}></span>}
                    <span style={css('flex: 1; min-width: 0; display: flex')}><Chip tone={o.color_token} dark={dark}>{o.label}</Chip></span>
                    <button type="button" aria-label={'Color for ' + o.label} aria-expanded={open === 'color:' + o.id} onClick={() => toggle('color:' + o.id)} style={css(iconBtn)}>
                      <span aria-hidden="true" style={css('width: 14px; height: 14px; border-radius: 999px; background: ' + dotOf(o.color_token, dark) + ';')}></span>
                    </button>
                    <button type="button" className="fb-ni" aria-label={'Remove ' + o.label} onClick={() => removeOpt(o)} style={css(iconBtn + ' color: var(--muted-2);')}>
                      <Icon d={IC.x} size={14} />
                    </button>
                  </div>
                  {open === 'color:' + o.id ? (
                    <div style={css('padding: 0 8px 6px 32px')}>
                      <SwatchList layout="grid" label={'Color for ' + o.label} value={o.color_token} dark={dark} onChange={(tn) => { recolor(o, tn); setOpen(''); }} />
                    </div>
                  ) : null}
                </div>
              ))}
              {lineEl}
              <label style={css('display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 8px')}>
                <Icon d={IC.plus} style="flex: none; color: var(--muted-2)" />
                <span style={css('position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)')}>Add an option</span>
                <input type="text" value={draft} placeholder="Add an option, press Enter" onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOpt(); } }}
                  style={css('flex: 1; min-width: 0; border: 0; background: transparent; font-size: 14px; color: var(--ink); outline: none')} />
              </label>
            </div>
          </div>
          <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start')}>
            <Segmented caption="Display as" label="Display as" options={[{ id: 'pill', label: 'Pill' }, { id: 'block', label: 'Block' }]} value={showAs} onChange={setShowAs} />
            <Pick label="Default value" value={defLabel} open={open === 'def'} onOpen={() => toggle('def')}>
              {!m.multi ? <MenuRow label="None" checked={!def} onClick={() => { setDef(''); setOpen(''); }} /> : null}
              {shown.map((o) => (
                <MenuRow key={o.id} checked={m.multi ? def.indexOf(o.label) >= 0 : def === o.label}
                  onClick={() => { if (m.multi) setDef(def.indexOf(o.label) >= 0 ? def.filter((x) => x !== o.label) : def.concat([o.label])); else { setDef(o.label); setOpen(''); } }}>
                  <span style={css('flex: 1; min-width: 0; display: flex')}><Chip tone={o.color_token} dark={dark}>{o.label}</Chip></span>
                </MenuRow>
              ))}
              {!shown.length ? <p style={css('margin: 0; padding: 8px 10px; font-size: 13px; color: var(--muted-2)')}>Add an option first.</p> : null}
            </Pick>
          </div>
          <p style={css('margin: -8px 0 0; font-size: 12px; color: var(--muted-2)')}>The default fills in on new projects.</p>
        </>
      ) : null}

      {m.kind === 'number' ? (
        <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start')}>
          <Pick label="Number format" value={labelOf(m.numFormats, numFmt)} open={open === 'fmt'} onOpen={() => toggle('fmt')}>
            {m.numFormats.map((x) => <MenuRow key={x.id} label={x.label} checked={x.id === numFmt} onClick={() => { setNumFmt(x.id); setOpen(''); }} />)}
          </Pick>
          <Pick label="Calculate" value={labelOf(m.calcs, calc)} open={open === 'calc'} onOpen={() => toggle('calc')}>
            {m.calcs.map((x) => <MenuRow key={x.id} label={x.label} checked={x.id === calc} onClick={() => { setCalc(x.id); setOpen(''); }} />)}
          </Pick>
        </div>
      ) : null}

      {m.kind === 'date' ? (
        <div style={css('display: flex; flex-direction: column; gap: 6px')}>
          <Pick label="Date format" value={labelOf(m.dateFormats, dateFmt)} open={open === 'dfmt'} onOpen={() => toggle('dfmt')}>
            {m.dateFormats.map((x) => <MenuRow key={x.id} label={x.label} checked={x.id === dateFmt} onClick={() => { setDateFmt(x.id); setOpen(''); }} />)}
          </Pick>
          <MenuRow label="Include end date" toggle={endDate} onClick={() => setEndDate(!endDate)} />
          <MenuRow label="Include time" toggle={incTime} onClick={() => setIncTime(!incTime)} />
        </div>
      ) : null}

      {m.kind === 'person' ? (
        <Segmented caption="People per cell" label="People per cell" options={[{ id: 'one', label: 'One person' }, { id: 'many', label: 'Several people' }]} value={limit} onChange={setLimit} />
      ) : null}

      {m.kind === 'checkbox' ? (
        <div style={css('display: flex; flex-direction: column; gap: 2px')}>
          <MenuRow label="Checked by default" toggle={checked} onClick={() => setChecked(!checked)} />
          <p style={css('margin: 0; padding: 0 10px; font-size: 12px; color: var(--muted-2)')}>The default fills in on new projects.</p>
        </div>
      ) : null}

      {m.kind === 'formula' ? (
        <div style={css('display: flex; flex-direction: column; gap: 6px')}>
          <Field multiline mono rows={3} label="Formula" placeholder={'dateBetween(prop("Publishing Date"), today(), "days")'} value={formula} onChange={(e) => setFormula(e.target.value)} />
          <p role="status" style={css('margin: 0; font-size: 12px; color: ' + (check && !check.ok ? 'var(--red-ink)' : 'var(--muted-2)'))}>
            {!check ? 'You can also add the formula later.' : check.ok ? 'Formula looks good.' : check.error}
          </p>
        </div>
      ) : null}

      <div style={css('display: flex; flex-direction: column; gap: 8px')}>
        <span style={css(sec)}>Visible to</span>
        <div role="group" aria-label="Visible to" style={css('display: flex; flex-wrap: wrap; gap: 6px')}>
          {m.roles.map((r) => {
            const on = roles.indexOf(r.id) >= 0;
            return (
              <button key={r.id} type="button" aria-pressed={on} disabled={r.locked} title={r.locked ? 'Super Admins see every column' : undefined}
                onClick={() => setRoles(on ? roles.filter((x) => x !== r.id) : roles.concat([r.id]))}
                style={css('height: 36px; padding: 0 12px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: ' + (r.locked ? 'default' : 'pointer') + '; ' +
                  (on ? 'border: 1px solid var(--inv); background: var(--inv); color: var(--inv-ink);' : 'border: 1px solid var(--border-2); background: var(--surface); color: var(--ink-2b);') + (r.locked ? ' opacity: 0.7;' : ''))}>
                {on ? '✓ ' : ''}{r.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={css('display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px')}>
        <Button kind="ghost" h={44} onClick={m.close}>Cancel</Button>
        <Button kind="primary" h={44} type="submit" disabled={check ? !check.ok : false}>Create column</Button>
      </div>
    </form>
  );
}

// C. Quick add from the header +. Type to filter; Enter creates with the top match, or names the column when no
// type matches. Opens Edit property for the new column.
export function QuickAdd({ q }) {
  const [text, setText] = useState('');
  const lq = text.trim().toLowerCase();
  const matches = lq ? q.all.filter((t) => t.label.toLowerCase().includes(lq)) : [];
  const naming = !!lq && !matches.length;
  const top = lq ? (matches[0] || q.suggested[0]) : q.suggested[0];
  const make = (t) => q.create(t.label, naming ? text : '');
  return (
    <Popover label="Add a column" onClose={q.close} align="right" width={300} maxH={460}>
      <div style={css('margin-bottom: 4px')}>
        <Field size="sm" label="Search property types" hideLabel icon={IC.search} placeholder="Search or name the column" value={text} data-autofocus=""
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); make(top); } }} />
      </div>
      {lq && !naming ? (
        <>
          <MenuLabel>Types</MenuLabel>
          {matches.map((t, i) => <MenuRow key={t.label} icon={t.icon} label={t.label} active={i === 0} onClick={() => make(t)} />)}
        </>
      ) : (
        <>
          {naming ? <MenuLabel>{'Create "' + text.trim() + '" as'}</MenuLabel> : <MenuLabel>Suggested</MenuLabel>}
          {q.suggested.map((t, i) => <MenuRow key={t.label} icon={t.icon} label={t.label} meta={naming ? '' : t.hint} active={i === 0} onClick={() => make(t)} />)}
          <MenuLabel>All types</MenuLabel>
          {q.all.filter((t) => !q.suggested.some((x) => x.label === t.label)).map((t) => <MenuRow key={t.label} icon={t.icon} label={t.label} onClick={() => make(t)} />)}
        </>
      )}
      {q.hiddenCount ? (
        <>
          <Divider />
          <MenuRow icon={'M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8zM8 6a2 2 0 1 0 0 4a2 2 0 1 0 0-4z'} label="Show a hidden column" meta={q.hiddenCount + ' hidden'} onClick={q.showHidden} />
        </>
      ) : null}
    </Popover>
  );
}
