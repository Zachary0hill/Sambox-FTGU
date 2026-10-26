'use client';
// app: one dialog for creating and editing records that have no design comp of their own: project templates, finance
// records (budgets, sponsor deals, invoices, payouts) and automation workflows. The spec comes from
// lib/studio/vals-records.js; this file only lays it out in the house dialog style.
import { Fragment, useEffect, useRef } from 'react';
import { css } from '@/lib/studio/css';

const LABEL = 'margin: 0; font-size: 13px; font-weight: 600; color: var(--ink-2);';
const INPUT = 'width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-family: inherit; font-size: 14px; color: var(--ink);';
const AREA = 'width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-family: inherit; font-size: 14px; line-height: 1.5; color: var(--ink); resize: vertical;';
const HELP = 'margin: 0; font-size: 12px; line-height: 1.45; color: var(--muted-2);';
const BTN = 'min-height: 44px; padding: 0 18px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;';
const KIND = {
  primary: BTN + ' border: 0; background: var(--inv); color: var(--inv-ink);',
  ghost: BTN + ' border: 1px solid var(--border); background: var(--surface); color: var(--ink);',
  danger: BTN + ' border: 1px solid var(--border); background: var(--surface); color: var(--red-ink);',
  quiet: BTN + ' border: 0; background: transparent; color: var(--ink-3);',
};
const SMALL = 'width: 36px; height: 36px; flex: none; padding: 0; border: 0; border-radius: 10px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';

function Chev({ d }) {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d}></path></svg>;
}

// An ordered list of short text steps (template checklists).
function StepList({ f, base, onChange }) {
  const list = Array.isArray(f.value) ? f.value : [];
  const set = (next) => onChange(f.key, next);
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px')}>
      <ol style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px')}>
        {list.map((v, i) => (
          <li key={i} style={css('display: flex; align-items: center; gap: 6px')}>
            <span aria-hidden="true" style={css('width: 24px; flex: none; font-size: 12px; font-weight: 600; color: var(--muted-2); text-align: right; font-variant-numeric: tabular-nums')}>{i + 1}</span>
            <input id={i === 0 ? base : undefined} type="text" aria-label={f.label + ' ' + (i + 1)} value={v} onChange={(e) => set(list.map((x, k) => (k === i ? e.target.value : x)))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); set(list.slice(0, i + 1).concat([''], list.slice(i + 1))); setTimeout(() => { const el = document.querySelectorAll('[data-step-list="' + base + '"] input')[i + 1]; if (el) el.focus(); }, 0); } }}
              style={css(INPUT + ' min-height: 40px;')} data-step-input="1" />
            <button type="button" className="fb-ni" aria-label={'Move step ' + (i + 1) + ' up'} disabled={i === 0} onClick={() => { const n = list.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; set(n); }} style={css(SMALL + (i === 0 ? ' opacity: 0.35; cursor: default;' : ''))}><Chev d="M4 10l4-4 4 4" /></button>
            <button type="button" className="fb-ni" aria-label={'Move step ' + (i + 1) + ' down'} disabled={i === list.length - 1} onClick={() => { const n = list.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; set(n); }} style={css(SMALL + (i === list.length - 1 ? ' opacity: 0.35; cursor: default;' : ''))}><Chev d="M4 6l4 4 4-4" /></button>
            <button type="button" className="fb-ni" aria-label={'Remove step ' + (i + 1)} onClick={() => set(list.filter((x, k) => k !== i))} style={css(SMALL)}><Chev d="M4 4l8 8M12 4l-8 8" /></button>
          </li>
        ))}
      </ol>
      {!list.length ? <p style={css(HELP)}>No steps yet.</p> : null}
      <button type="button" onClick={() => set(list.concat(['']))} style={css(KIND.ghost + ' align-self: flex-start; min-height: 36px; font-size: 13px;')}>Add step</button>
    </div>
  );
}

function FieldRow({ f, d }) {
  const id = 'rec-' + d.id + '-' + f.key;
  const help = f.help ? <p id={id + '-h'} style={css(HELP)}>{f.help}</p> : null;
  const desc = f.help ? id + '-h' : undefined;
  let input;
  if (f.type === 'select') {
    input = (
      <div style={css('position: relative')}>
        <select id={id} value={f.value ?? ''} aria-describedby={desc} disabled={!!f.disabled} onChange={(e) => d.onChange(f.key, e.target.value)} style={css(INPUT + ' appearance: none; -webkit-appearance: none; padding-right: 40px; cursor: pointer;' + (f.disabled ? ' opacity: 0.6;' : ''))}>
          {(f.options || []).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
        </select>
        <span aria-hidden="true" style={css('position: absolute; right: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--muted-2); display: inline-flex')}><Chev d="M4 6l4 4 4-4" /></span>
      </div>
    );
  } else if (f.type === 'textarea') {
    input = <textarea id={id} rows={f.rows || 3} value={f.value ?? ''} placeholder={f.placeholder || ''} aria-describedby={desc} onChange={(e) => d.onChange(f.key, e.target.value)} style={css(AREA)} />;
  } else if (f.type === 'steps') {
    input = <div data-step-list={id}><StepList f={f} base={id} onChange={d.onChange} /></div>;
  } else if (f.type === 'checks') {
    const list = Array.isArray(f.value) ? f.value : [];
    input = (
      <div id={id} role="group" aria-label={f.label} aria-describedby={desc} style={css('display: flex; flex-wrap: wrap; gap: 8px')}>
        {(f.options || []).map((o) => {
          const on = list.indexOf(o[0]) >= 0;
          return (
            <button key={o[0]} type="button" aria-pressed={on ? 'true' : 'false'} onClick={() => d.onChange(f.key, on ? list.filter((x) => x !== o[0]) : list.concat([o[0]]))}
              style={css('min-height: 38px; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; ' + (on ? 'border: 1px solid var(--ink); background: var(--inv); color: var(--inv-ink);' : 'border: 1px solid var(--border); background: var(--surface); color: var(--ink-3);'))}>{o[1]}</button>
          );
        })}
      </div>
    );
  } else if (f.type === 'image') {
    // eslint-disable-next-line @next/next/no-img-element -- a data URL QR code from Supabase Auth
    input = <img id={id} src={f.value} alt={f.alt || ''} width={f.size || 180} height={f.size || 180} style={css('display: block; padding: 10px; border-radius: 14px; background: #FFFFFF; border: 1px solid var(--line)')} />;
  } else if (f.type === 'info') {
    input = <p id={id} style={css('margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); font-size: 13px; line-height: 1.5; color: ' + (f.tone === 'red' ? 'var(--red-ink)' : 'var(--ink-3)') + '; white-space: pre-line')}>{f.value}</p>;
  } else {
    input = (
      <div style={css('position: relative; display: flex; align-items: center')}>
        {f.prefix ? <span aria-hidden="true" style={css('position: absolute; left: 14px; font-size: 14px; color: var(--muted-2)')}>{f.prefix}</span> : null}
        <input id={id} type={f.type || 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} min={f.min} step={f.step} autoComplete="off" value={f.value ?? ''} placeholder={f.placeholder || ''} aria-describedby={desc}
          onChange={(e) => d.onChange(f.key, e.target.value)} style={css(INPUT + (f.prefix ? ' padding-left: 28px;' : ''))} />
      </div>
    );
  }
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px; min-width: 0;' + (f.half ? ' flex: 1 1 200px;' : ' flex: 1 1 100%;'))}>
      {f.type === 'info' || f.type === 'image' || f.type === 'checks' ? <span style={css(LABEL)}>{f.label}</span> : <label htmlFor={f.type === 'steps' ? id : id} style={css(LABEL)}>{f.label}</label>}
      {input}
      {help}
    </div>
  );
}

export default function RecordDialog({ d }) {
  const box = useRef(null);
  useEffect(() => {
    const el = box.current && box.current.querySelector('input, select, textarea');
    if (el) el.focus();
  }, [d.id]);
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); d.close(); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); d.save(); }
  };
  return (
    <>
      <button type="button" aria-label="Close dialog" onClick={d.close} style={css('position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default')}></button>
      <dialog open aria-modal="true" aria-labelledby={'rec-' + d.id + '-title'} onKeyDown={onKey} ref={box}
        style={css('position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; width: ' + (d.width || 560) + 'px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); overflow-y: auto; box-sizing: border-box; background: var(--surface); border: 1px solid var(--line-4); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.20); padding: 24px; color: var(--ink); font-family: var(--font-main);')}>
        <div style={css('display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px')}>
          <div>
            <h2 id={'rec-' + d.id + '-title'} style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em')}>{d.title}</h2>
            {d.desc ? <p style={css('margin: 6px 0 0; font-size: var(--text-body-sm); line-height: 1.5; color: var(--muted)')}>{d.desc}</p> : null}
          </div>
          <button type="button" className="fb-ni" aria-label="Close" onClick={d.close} style={css('width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;')}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
          </button>
        </div>
        <div style={css('display: flex; flex-wrap: wrap; gap: 16px')}>
          {(d.fields || []).filter((f) => !f.hidden).map((f) => <Fragment key={f.key}><FieldRow f={f} d={d} /></Fragment>)}
        </div>
        {d.err ? <p role="alert" style={css('margin: 16px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600; line-height: 1.45')}>{d.err}</p> : null}
        {d.note ? <p role="status" style={css('margin: 16px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--surface-2); color: var(--ink-3); font-size: 13px; line-height: 1.5; white-space: pre-line')}>{d.note}</p> : null}
        <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 24px')}>
          {d.remove ? <button type="button" onClick={d.remove.pick} disabled={!!d.busy} style={css(KIND.danger + (d.remove.confirm ? ' background: var(--red-soft); border-color: transparent;' : ''))}>{d.remove.label}</button> : null}
          {(d.extra || []).map((x) => <button key={x.label} type="button" onClick={x.pick} disabled={!!d.busy || !!x.disabled} style={css(KIND[x.kind || 'ghost'] + (x.disabled ? ' opacity: 0.5; cursor: default;' : ''))}>{x.label}</button>)}
          <span style={css('flex: 1')}></span>
          <button type="button" className="fb-ni" onClick={d.close} style={css(KIND.quiet)}>Cancel</button>
          {d.save ? <button type="button" onClick={d.save} disabled={!!d.busy} style={css(KIND.primary + (d.busy ? ' opacity: 0.6;' : ''))}>{d.busy ? d.busyLabel || 'Saving…' : d.saveLabel || 'Save'}</button> : null}
        </div>
      </dialog>
    </>
  );
}
