'use client';
// app: cell editors (database components step 6, docs/design/database-components/CellEditors.dc.html).
// One popover per type, anchored under the cell, with the same header: column name left, project right.
// Text-like types save on Enter (Text on Cmd or Ctrl + Enter); pickers save on click. Models come from editorModel()
// in lib/studio/vals.js.
import { useId, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { Popover, MenuRow, MenuLabel, Divider, Field, Button, Toggle, Icon, IC } from './Prims';

const EI = {
  open: 'M9 2.5h4.5V7M13.5 2.5L7 9M11.5 9.5v4h-9v-9h4',
  copy: 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3',
  mail: 'M2.5 4h11v8h-11zM2.5 4.5L8 9l5.5-4.5',
  upload: 'M8 10V2.5M5 5.5l3-3 3 3M2.5 10v3.5h11V10',
  doc: 'M3.5 2.5h6l3 3v8h-9z',
  prev: 'M10 4L6 8l4 4'
};
const WIDTH = { text: 320, number: 300, date: 300, person: 300, url: 320, email: 320, phone: 300, files: 320, relation: 320, formula: 360 };
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const dayOf = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const addDays = (iso, n) => { const d = dayOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

function Head({ e, right }) {
  return (
    <div style={css('display: flex; justify-content: space-between; gap: 10px; font-size: 12px; font-weight: 600; color: var(--ink)')}>
      <span style={css('white-space: nowrap')}>{e.label}</span>
      <span style={css('min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted-2)')}>{right || e.project}</span>
    </div>
  );
}
function Actions({ hint, error, onCancel, onSave, saveLabel }) {
  return (
    <div style={css('display: flex; align-items: center; gap: 8px')}>
      <span role={error ? 'alert' : undefined} style={css('flex: 1; min-width: 0; font-size: 12px; ' + (error ? 'color: var(--red-ink); font-weight: 600;' : 'color: var(--muted-2);'))}>{error || hint}</span>
      {onCancel ? <Button kind="ghost" onClick={onCancel}>Cancel</Button> : null}
      <Button onClick={onSave}>{saveLabel || 'Save'}</Button>
    </div>
  );
}
// The editor body gets 12px padding and 10px gaps, as in the comp.
function Shell({ e, children, pad = 12 }) {
  return (
    <Popover label={'Edit ' + e.label + ' for ' + e.project} onClose={e.close} align={e.align} width={WIDTH[e.type] || 300} pad={pad} maxH={560}>
      <div style={css('display: flex; flex-direction: column; gap: 10px')}>{children}</div>
    </Popover>
  );
}

function TextEditor({ e }) {
  const [v, setV] = useState(e.value);
  return (
    <Shell e={e}>
      <Head e={e} />
      <Field multiline rows={3} label={e.label} hideLabel placeholder="Type a value" value={v} data-autofocus=""
        onChange={(x) => setV(x.target.value)} onKeyDown={(x) => { if (x.key === 'Enter' && (x.metaKey || x.ctrlKey)) { x.preventDefault(); e.save(v); } }} />
      <Actions hint={(MAC ? '⌘' : 'Ctrl') + ' Enter saves'} onCancel={e.close} onSave={() => e.save(v)} />
    </Shell>
  );
}

function NumberEditor({ e }) {
  const [v, setV] = useState(e.value);
  const [err, setErr] = useState('');
  const save = () => setErr(e.save(v) || '');
  return (
    <Shell e={e}>
      <Head e={e} />
      <Field label={e.label} hideLabel size="lg" align="right" strong inputMode="decimal" value={v} data-autofocus="" prefix={e.prefix || null} suffix={e.suffix || null}
        onChange={(x) => { setV(x.target.value); setErr(''); }} onKeyDown={(x) => { if (x.key === 'Enter') { x.preventDefault(); save(); } }} />
      <Actions hint={e.preview(v)} error={err} onCancel={e.close} onSave={save} />
    </Shell>
  );
}

function Calendar({ month, setMonth, start, end, today, onPick }) {
  const y = month[0], m = month[1];
  const lead = new Date(y, m, 1).getDay();
  const n = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= n; d++) cells.push(isoOf(new Date(y, m, d)));
  const shift = (k) => { const x = new Date(y, m + k, 1); setMonth([x.getFullYear(), x.getMonth()]); };
  const nav = 'width: 32px; height: 32px; border: 0; border-radius: 8px; background: var(--chip); color: var(--ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';
  return (
    <>
      <div style={css('display: flex; align-items: center; justify-content: space-between; padding: 0 2px')}>
        <span style={css('font-size: 14px; font-weight: 700')}>{MONTH[m] + ' ' + y}</span>
        <div style={css('display: flex; gap: 4px')}>
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} style={css(nav)}><Icon d={EI.prev} size={14} /></button>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} style={css(nav)}><Icon d={IC.chevR} size={14} /></button>
        </div>
      </div>
      <div role="group" aria-label={MONTH[m] + ' ' + y} style={css('display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px')}>
        {DOW.map((d) => <span key={d} aria-hidden="true" style={css('height: 28px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--muted-2)')}>{d}</span>)}
        {cells.map((iso, i) => {
          if (!iso) return <span key={'b' + i}></span>;
          const sel = iso === start || iso === end;
          const inRange = start && end && iso > start && iso < end;
          const isToday = iso === today;
          return (
            <button key={iso} type="button" aria-label={MONTH[m] + ' ' + Number(iso.slice(8)) + (isToday ? ', today' : '')} aria-pressed={sel} onClick={() => onPick(iso)}
              style={css('height: 36px; border: 0; border-radius: 10px; font-size: 13px; font-variant-numeric: tabular-nums; cursor: pointer; ' +
                (sel ? 'background: var(--inv); color: var(--inv-ink); font-weight: 700;' : inRange ? 'background: var(--hover); color: var(--ink); font-weight: 500;' :
                  isToday ? 'background: var(--surface); color: var(--ink); font-weight: 700; box-shadow: inset 0 0 0 1.5px var(--ink);' : 'background: transparent; color: var(--ink-2); font-weight: 500;'))}>
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
    </>
  );
}

function DateEditor({ e }) {
  const [v, setV] = useState({ start: e.start, startTime: e.startTime, end: e.end, endTime: e.endTime });
  const [txt, setTxt] = useState(e.show(e.start));
  const [err, setErr] = useState('');
  const [picking, setPicking] = useState('start');
  const first = dayOf(e.start || e.today);
  const [month, setMonth] = useState([first.getFullYear(), first.getMonth()]);
  const range = e.endOn && !e.builtIn;
  const time = e.timeOn && !e.builtIn;
  const commit = (next, keepOpen) => { setV(next); setTxt(e.show(next.start)); e.save(Object.assign({}, next, { keepOpen: keepOpen })); };
  const pick = (iso) => {
    if (range && picking === 'end' && v.start) {
      const a = iso < v.start ? iso : v.start, b = iso < v.start ? v.start : iso;
      setPicking('start');
      commit(Object.assign({}, v, { start: a, end: b }), false);
    } else if (range) {
      setPicking('end');
      commit(Object.assign({}, v, { start: iso, end: '' }), true);
    } else commit(Object.assign({}, v, { start: iso }), !!time);
  };
  const typed = () => {
    const iso = e.parse(txt);
    if (iso === null) { setErr('That date was not recognized.'); return; }
    setErr('');
    const d = dayOf(iso);
    if (d) setMonth([d.getFullYear(), d.getMonth()]);
    commit(Object.assign({}, v, { start: iso }), true);
  };
  const quick = [['Today', e.today], ['Tomorrow', addDays(e.today, 1)], ['Next Mon', addDays(e.today, ((8 - dayOf(e.today).getDay()) % 7) || 7)], ['+1 week', addDays(e.today, 7)]];
  const timeInput = (key, label) => (
    <label style={css('display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--muted-2)')}>{label}
      <input type="time" value={v[key]} onChange={(x) => setV(Object.assign({}, v, { [key]: x.target.value }))} onBlur={() => commit(v, true)}
        style={css('height: 32px; padding: 0 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); color: var(--ink); font-size: 13px')} />
    </label>
  );
  return (
    <Shell e={e}>
      <Head e={e} />
      <Field label="Date" hideLabel strong value={txt} placeholder="Type a date" data-autofocus=""
        onChange={(x) => { setTxt(x.target.value); setErr(''); }} onKeyDown={(x) => { if (x.key === 'Enter') { x.preventDefault(); typed(); } }} />
      {err ? <span role="alert" style={css('font-size: 12px; font-weight: 600; color: var(--red-ink)')}>{err}</span> : null}
      {range ? <span style={css('font-size: 12px; color: var(--muted-2)')}>{picking === 'end' ? 'Pick the end date' : v.end ? 'Ends ' + e.show(v.end) : 'Pick a start date, then an end date'}</span> : null}
      {time ? <div style={css('display: flex; gap: 12px; flex-wrap: wrap')}>{timeInput('startTime', 'Start time')}{range && v.end ? timeInput('endTime', 'End time') : null}</div> : null}
      <div style={css('display: flex; gap: 6px; flex-wrap: wrap')}>
        {quick.map((q) => (
          <button key={q[0]} type="button" className="fb-ni" onClick={() => { setMonth([dayOf(q[1]).getFullYear(), dayOf(q[1]).getMonth()]); pick(q[1]); }}
            style={css('height: 30px; padding: 0 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--ink-2b); font-size: 12px; font-weight: 600; cursor: pointer')}>{q[0]}</button>
        ))}
      </div>
      <Calendar month={month} setMonth={setMonth} start={v.start} end={range ? v.end : ''} today={e.today} onPick={pick} />
      {e.canConfig ? (
        <>
          <div style={css('height: 1px; background: var(--line)')}></div>
          <div style={css('display: flex; flex-direction: column; gap: 2px')}>
            <div style={css('display: flex; align-items: center; min-height: 36px; padding: 0 4px')}><span style={css('flex: 1; font-size: 14px; font-weight: 500')}>End date</span><Toggle on={e.endOn} label="End date" onChange={e.toggleEnd} /></div>
            <div style={css('display: flex; align-items: center; min-height: 36px; padding: 0 4px')}><span style={css('flex: 1; font-size: 14px; font-weight: 500')}>Include time</span><Toggle on={e.timeOn} label="Include time" onChange={e.toggleTime} /></div>
          </div>
        </>
      ) : null}
      <div style={css('display: flex; justify-content: space-between; align-items: center')}>
        <Button kind="secondary" h={36} onClick={() => commit({ start: '', startTime: '', end: '', endTime: '' }, false)}>Clear</Button>
        <span style={css('font-size: 12px; color: var(--muted-2)')}>{e.tz}</span>
      </div>
    </Shell>
  );
}

function PersonEditor({ e }) {
  const [q, setQ] = useState('');
  const [act, setAct] = useState(0);
  const listId = useId();
  const lq = q.trim().toLowerCase();
  const shown = e.people.filter((x) => !lq || x.name.toLowerCase().includes(lq));
  const cur = Math.min(act, shown.length - 1);
  const byId = (id) => e.people.find((x) => x.id === id) || { id, name: 'Former member', initials: '?', chipAvatar: '' };
  const onKey = (x) => {
    if ((x.key === 'ArrowDown' || x.key === 'ArrowUp') && shown.length) { x.preventDefault(); x.stopPropagation(); setAct((cur + (x.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length); }
    else if (x.key === 'Enter' && shown[cur]) { x.preventDefault(); e.pick(shown[cur].id); setQ(''); }
    else if (x.key === 'Backspace' && !q && e.value.length) { x.preventDefault(); e.remove(e.value[e.value.length - 1]); }
  };
  return (
    <Popover label={'Edit ' + e.label + ' for ' + e.project} onClose={e.close} align={e.align} width={WIDTH.person} maxH={520}>
      <Field size="sm" label="Search people" hideLabel placeholder={e.value.length && !e.multi ? 'Replace with…' : 'Search people'} value={q} data-autofocus=""
        onChange={(x) => { setQ(x.target.value); setAct(0); }} onKeyDown={onKey}
        role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={cur >= 0 ? listId + '-' + cur : undefined}
        chips={e.value.length ? e.value.map((id) => {
          const p = byId(id);
          return (
            <span key={id} style={css('display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 4px 0 3px; border-radius: 999px; background: var(--chip); font-size: 13px; font-weight: 600; color: var(--ink)')}>
              <span aria-hidden="true" style={css(p.chipAvatar)}>{p.initials}</span>{p.name}
              <button type="button" tabIndex={-1} aria-label={'Remove ' + p.name} onMouseDown={(x) => x.preventDefault()} onClick={() => e.remove(id)}
                style={css('width: 18px; height: 18px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><Icon d={IC.x} size={10} sw={2} /></button>
            </span>
          );
        }) : null} />
      <MenuLabel>{e.group}</MenuLabel>
      <div id={listId} role="listbox" aria-label={e.group} aria-multiselectable={e.multi || undefined} style={css('display: flex; flex-direction: column; gap: 2px')}>
        {shown.map((p, i) => {
          const on = e.value.indexOf(p.id) >= 0;
          return (
            <div key={p.id} id={listId + '-' + i} role="option" aria-selected={on} onMouseMove={() => { if (act !== i) setAct(i); }} onClick={() => { e.pick(p.id); setQ(''); }}
              style={css('display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 10px; border-radius: 10px; cursor: pointer; background: ' + (i === cur ? 'var(--hover)' : 'transparent') + ';')}>
              <span aria-hidden="true" style={css(p.avatar)}>{p.initials}</span>
              <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column')}>
                <span style={css('font-size: 14px; font-weight: 500; color: var(--ink)')}>{p.name}</span>
                {p.meta ? <span style={css('font-size: 12px; color: var(--muted-2)')}>{p.meta}</span> : null}
              </span>
              {on ? <Icon d={IC.check} sw={1.75} style="flex: none; color: var(--ink)" /> : null}
            </div>
          );
        })}
        {!shown.length ? <p style={css('margin: 0; padding: 8px 10px; font-size: 13px; color: var(--muted-2)')}>No one matches.</p> : null}
      </div>
      {e.canInvite ? <><Divider /><MenuRow icon={EI.mail} label="Invite by email" onClick={e.invite} /></> : null}
    </Popover>
  );
}

// URL, Email and Phone: the value, then Open, Copy and Remove.
function LinkEditor({ e }) {
  const [v, setV] = useState(e.value);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const href = () => {
    const x = v.trim();
    if (!x) return '';
    if (e.kind === 'email') return 'mailto:' + x;
    if (e.kind === 'phone') return 'tel:' + x.replace(/[^0-9+]/g, '');
    return /^https?:\/\//i.test(x) ? x : 'https://' + x;
  };
  const save = () => {
    const x = v.trim();
    if (x && e.kind === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) { setErr('Check the email address.'); return; }
    if (x && e.kind === 'url' && /\s/.test(x)) { setErr('Links cannot contain spaces.'); return; }
    e.save(x);
  };
  const btn = (danger) => 'display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; border: 0; border-radius: 10px; background: var(--chip); font-size: 13px; font-weight: 600; cursor: pointer; color: ' + (danger ? 'var(--red-ink)' : 'var(--ink)') + ';';
  return (
    <Shell e={e}>
      <Head e={e} />
      <Field label={e.label} hideLabel type={e.kind === 'email' ? 'email' : e.kind === 'phone' ? 'tel' : 'url'} value={v} data-autofocus=""
        placeholder={e.kind === 'email' ? 'name@example.com' : e.kind === 'phone' ? 'Phone number' : 'Paste a link'}
        onChange={(x) => { setV(x.target.value); setErr(''); }} onKeyDown={(x) => { if (x.key === 'Enter') { x.preventDefault(); save(); } }} />
      {err ? <span role="alert" style={css('font-size: 12px; font-weight: 600; color: var(--red-ink)')}>{err}</span> : null}
      <div style={css('display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px')}>
        <button type="button" className="fb-ni" disabled={!v.trim()} onClick={() => window.open(href(), e.kind === 'url' ? '_blank' : '_self', 'noopener')} style={css(btn(false))}><Icon d={EI.open} size={14} />Open</button>
        <button type="button" className="fb-ni" disabled={!v.trim()} onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(v.trim()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} style={css(btn(false))}><Icon d={EI.copy} size={14} />{copied ? 'Copied' : 'Copy'}</button>
        <button type="button" className="fb-ni" disabled={!e.value} onClick={e.remove} style={css(btn(true))}><Icon d={IC.trash} size={14} />Remove</button>
      </div>
      <Actions hint={e.note} onSave={save} />
    </Shell>
  );
}

function FilesEditor({ e }) {
  const [tab, setTab] = useState('upload');
  const [url, setUrl] = useState('');
  const [over, setOver] = useState(false);
  const tabS = (on) => 'height: 34px; padding: 0 10px; border: 0; border-bottom: 2px solid ' + (on ? 'var(--ink)' : 'transparent') + '; background: transparent; font-size: 13px; font-weight: 600; cursor: pointer; color: ' + (on ? 'var(--ink)' : 'var(--muted-2)') + ';';
  return (
    <Shell e={e}>
      <Head e={e} />
      <div role="tablist" aria-label="Add files" style={css('display: flex; gap: 4px; border-bottom: 1px solid var(--line)')}>
        <button type="button" role="tab" aria-selected={tab === 'upload'} onClick={() => setTab('upload')} style={css(tabS(tab === 'upload'))}>Upload</button>
        <button type="button" role="tab" aria-selected={tab === 'embed'} onClick={() => setTab('embed')} style={css(tabS(tab === 'embed'))}>Embed link</button>
      </div>
      {tab === 'upload' ? (
        <button type="button" data-autofocus="" onClick={e.pick}
          onDragOver={(x) => { x.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(x) => { x.preventDefault(); setOver(false); e.upload(x.dataTransfer.files); }}
          style={css('display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px; border: 1.5px dashed ' + (over ? 'var(--ink)' : 'var(--border-strong)') + '; border-radius: 12px; background: ' + (over ? 'var(--hover)' : 'var(--surface-2)') + '; cursor: pointer')}>
          <Icon d={EI.upload} size={20} style="color: var(--ink-3)" />
          <span style={css('font-size: 14px; font-weight: 600; color: var(--ink)')}>Drop files or click to upload</span>
          <span style={css('font-size: 12px; color: var(--muted-2)')}>Images, video, PDFs and documents</span>
        </button>
      ) : (
        <div style={css('display: flex; gap: 6px; align-items: flex-end')}>
          <div style={css('flex: 1; min-width: 0')}>
            <Field size="sm" label="Link to embed" hideLabel type="url" placeholder="Paste a link" value={url} data-autofocus=""
              onChange={(x) => setUrl(x.target.value)} onKeyDown={(x) => { if (x.key === 'Enter') { x.preventDefault(); e.embed(url); setUrl(''); } }} />
          </div>
          <Button h={36} onClick={() => { e.embed(url); setUrl(''); }}>Add</Button>
        </div>
      )}
      {e.items.length ? (
        <div style={css('display: flex; flex-direction: column; gap: 2px')}>
          {e.items.map((x, i) => (
            <div key={i} style={css('display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 4px; border-radius: 10px')}>
              <span aria-hidden="true" style={css('width: 32px; height: 32px; flex: none; border-radius: 6px; background: ' + (x.preview ? 'center / cover no-repeat url("' + x.preview + '")' : 'var(--chip-2)') + '; display: inline-flex; align-items: center; justify-content: center; color: var(--ink-3)')}>{x.preview ? null : <Icon d={EI.doc} size={14} />}</span>
              <button type="button" className="fb-ni" onClick={() => e.open(x.item)} style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 4px; border: 0; border-radius: 8px; background: transparent; text-align: left; cursor: pointer')}>
                <span style={css('max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; color: var(--ink)')}>{x.name}</span>
                <span style={css('font-size: 12px; font-weight: 400; color: var(--muted-2)')}>{x.meta}</span>
              </button>
              <button type="button" className="fb-ni" aria-label={'Remove ' + x.name} onClick={() => e.remove(x.item)} style={css('width: 28px; height: 28px; flex: none; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><Icon d={IC.x} size={14} /></button>
            </div>
          ))}
        </div>
      ) : null}
    </Shell>
  );
}

function RelationEditor({ e }) {
  const [q, setQ] = useState('');
  const lq = q.trim().toLowerCase();
  const shown = e.items.filter((x) => !lq || x.name.toLowerCase().includes(lq));
  return (
    <Popover label={'Edit ' + e.label + ' for ' + e.project} onClose={e.close} align={e.align} width={WIDTH.relation} maxH={520}>
      <div style={css('display: flex; justify-content: space-between; padding: 6px 10px 8px; font-size: 12px; font-weight: 600')}>
        <span>Link to Projects</span><span style={css('color: var(--muted-2)')}>{e.count + ' linked'}</span>
      </div>
      <Field size="sm" icon={IC.search} label="Search projects" hideLabel placeholder="Search projects" value={q} data-autofocus="" onChange={(x) => setQ(x.target.value)} />
      <div style={css('height: 4px; flex: none')}></div>
      {shown.map((x) => (
        <MenuRow key={x.id} h={38} aria-pressed={x.on} checked={x.on} onClick={() => e.toggle(x.id)}>
          <Icon d={EI.doc} style="flex: none; color: var(--ink-3)" />
          <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{x.name}</span>
          {x.status ? <span style={css(x.statusStyle + ' height: 22px; font-size: 11px; padding: 0 8px;')}>{x.status}</span> : null}
        </MenuRow>
      ))}
      {!shown.length ? <p style={css('margin: 0; padding: 8px 10px; font-size: 13px; color: var(--muted-2)')}>No projects match.</p> : null}
    </Popover>
  );
}

function FormulaEditor({ e }) {
  const [src, setSrc] = useState(e.expr);
  const ref = useRef(null);
  const res = e.evaluate(src);
  // Inserts at the cursor, so a property or function lands where the person is typing.
  const insert = (t) => {
    const el = ref.current;
    if (!el || !e.canEdit) return;
    const a = el.selectionStart == null ? src.length : el.selectionStart, b = el.selectionEnd == null ? src.length : el.selectionEnd;
    const next = src.slice(0, a) + t + src.slice(b);
    setSrc(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + t.length, a + t.length); });
  };
  const listBtn = 'height: 30px; padding: 0 6px; border: 0; border-radius: 8px; background: transparent; font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--ink); text-align: left; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
  return (
    <Shell e={e}>
      <Head e={e} right="Formula" />
      <Field multiline rows={2} mono label="Formula" hideLabel inputRef={ref} value={src} readOnly={!e.canEdit} data-autofocus=""
        placeholder='dateBetween(prop("Publishing Date"), now(), "days")' onChange={(x) => setSrc(x.target.value)}
        onKeyDown={(x) => { if (x.key === 'Enter' && (x.metaKey || x.ctrlKey)) { x.preventDefault(); e.save(src); } }} />
      {e.canEdit ? (
        <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
          <div style={css('display: flex; flex-direction: column; gap: 2px; min-width: 0; max-height: 160px; overflow-y: auto')}>
            <span style={css('padding: 2px 6px; font-size: 12px; font-weight: 600; color: var(--muted-2)')}>Properties</span>
            {e.props.map((p) => <button key={p} type="button" className="fb-ni" onClick={() => insert('prop("' + p + '")')} style={css(listBtn)}>{p}</button>)}
          </div>
          <div style={css('display: flex; flex-direction: column; gap: 2px; min-width: 0; max-height: 160px; overflow-y: auto')}>
            <span style={css('padding: 2px 6px; font-size: 12px; font-weight: 600; color: var(--muted-2)')}>Functions</span>
            {e.fns.map((f) => <button key={f} type="button" className="fb-ni" title={f} onClick={() => insert(f.slice(0, f.indexOf('(') + 1))} style={css(listBtn)}>{f.slice(0, f.indexOf('(')) + '()'}</button>)}
          </div>
        </div>
      ) : null}
      <div role="status" style={css('display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; background: ' + (res.error ? 'var(--red-soft)' : 'var(--green-soft)') + '; color: ' + (res.error ? 'var(--red-ink)' : 'var(--green-ink)'))}>
        <span style={css('flex: 1; min-width: 0; font-size: 13px; font-weight: 600')}>{res.error ? res.error : 'Result for ' + e.project}</span>
        {res.error ? null : <span style={css('font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums')}>{res.value === '' ? 'Empty' : res.value}</span>}
      </div>
      <div style={css('display: flex; justify-content: flex-end')}>
        <Button onClick={() => (e.canEdit ? e.save(src) : e.close())}>Done</Button>
      </div>
    </Shell>
  );
}

export default function CellEditor({ e, dark }) {
  if (e.type === 'text') return <TextEditor e={e} />;
  if (e.type === 'number') return <NumberEditor e={e} />;
  if (e.type === 'date') return <DateEditor e={e} />;
  if (e.type === 'person') return <PersonEditor e={e} dark={dark} />;
  if (e.type === 'url' || e.type === 'email' || e.type === 'phone') return <LinkEditor e={e} />;
  if (e.type === 'files') return <FilesEditor e={e} />;
  if (e.type === 'relation') return <RelationEditor e={e} dark={dark} />;
  if (e.type === 'formula') return <FormulaEditor e={e} />;
  return null;
}

