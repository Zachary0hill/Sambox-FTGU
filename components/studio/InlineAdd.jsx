// "Create it here" row under a picker list: a name field and an Add button (mkDD's add model, or the cell editor's).
import { css } from '@/lib/studio/css';

export default function InlineAdd({ a, flush }) {
  if (!a) return null;
  const off = a.busy || !(a.name || '').trim();
  return (
    <div role="group" aria-label={a.label} style={css('display: flex; flex-direction: column; gap: 6px; margin-top: 4px; padding: 8px 4px 2px; border-top: ' + (flush ? '0' : '1px solid var(--line-4)'))}>
      <div style={css('display: flex; gap: 6px')}>
        <input type="text" autoComplete="off" aria-label={a.placeholder} placeholder={a.placeholder} value={a.name} onChange={a.onName} onKeyDown={a.onKey}
          style={css('flex: 1; min-width: 0; min-height: 36px; box-sizing: border-box; padding: 0 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 13px; color: var(--ink)')} />
        <button type="button" onClick={a.go} disabled={off}
          style={css('flex: none; display: inline-flex; align-items: center; gap: 4px; min-height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--inv); color: var(--inv-ink); font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; opacity: ' + (off ? '0.5' : '1'))}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"></path></svg>
          {a.busy ? 'Adding' : a.label}
        </button>
      </div>
      {a.err ? <p role="alert" style={css('margin: 0; font-size: 12px; font-weight: 600; color: var(--red-ink)')}>{a.err}</p> : null}
    </div>
  );
}
