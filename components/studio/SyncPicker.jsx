'use client';
// app: what a manual integration sync brings over (lib/studio/vals-sync.js). One checklist per group from the
// provider's preview; Sync sends the checked ids.
import { useEffect } from 'react';
import { css } from '@/lib/studio/css';
import { PickBox } from './Prims';

const BTN = 'min-height: 44px; padding: 0 16px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer;';

export default function SyncPicker({ p }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) p.close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);
  return (
    <>
      <button type="button" aria-label="Close" onClick={p.close} style={css('position: fixed; inset: 0; z-index: 90; border: 0; background: rgba(17,17,17,0.45); cursor: default')}></button>
      <dialog open aria-modal="true" aria-labelledby="sync-pick-title" style={css('position: fixed; z-index: 91; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; width: 600px; max-width: calc(100vw - 32px); max-height: calc(100vh - 48px); display: flex; flex-direction: column; box-sizing: border-box; padding: 0; background: var(--surface); border: 1px solid var(--line-4); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.28); color: var(--ink); font-family: var(--font-main)')}>
        <div style={css('padding: 20px 24px 12px; border-bottom: 1px solid var(--line)')}>
          <h2 id="sync-pick-title" style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h5); font-weight: var(--weight-black); letter-spacing: -0.01em')}>{p.title}</h2>
          <p style={css('margin: 4px 0 0; font-size: 14px; color: var(--muted)')}>Pick what comes over this time. Unchecked items stay as they are.</p>
          {p.showSearch ? (
            <input type="search" value={p.q} onChange={(e) => p.setQ(e.target.value)} placeholder="Search" aria-label="Search items"
              style={css('margin-top: 12px; width: 100%; height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border-2); border-radius: 10px; background: var(--surface); color: var(--ink); font: inherit; font-size: 14px')} />
          ) : null}
        </div>
        <div style={css('flex: 1; min-height: 120px; overflow-y: auto; padding: 8px 24px 16px')}>
          {p.loading ? <p role="status" style={css('margin: 24px 0; font-size: 14px; color: var(--muted)')}>Reading what is there…</p> : null}
          {p.error ? (
            <div role="alert" style={css('margin: 16px 0; display: flex; align-items: center; gap: 12px; font-size: 14px; color: var(--ink-2)')}>
              <span style={css('flex: 1')}>{p.error}</span>
              <button type="button" onClick={p.retry} style={css(BTN + ' border: 1px solid var(--border-2); background: transparent; color: var(--ink)')}>Try again</button>
            </div>
          ) : null}
          {p.groups.map((g) => (
            <section key={g.id} aria-label={g.label} style={css('padding-top: 12px')}>
              <div style={css('display: flex; align-items: center; gap: 8px; min-height: 36px')}>
                <PickBox p={g.all} style="margin-left: -6px;" />
                <h3 style={css('margin: 0; font-size: 14px; font-weight: 700')}>{g.label}</h3>
                <span style={css('font-size: 12px; font-weight: 600; color: var(--muted-2); font-variant-numeric: tabular-nums')}>{g.countText}</span>
              </div>
              {g.hint ? <p style={css('margin: 0 0 6px 26px; font-size: 12.5px; color: var(--muted)')}>{g.hint}</p> : null}
              {g.empty ? <p style={css('margin: 4px 0 0 26px; font-size: 13px; color: var(--muted)')}>{g.emptyText}</p> : null}
              <ul style={css('list-style: none; margin: 0; padding: 0')}>
                {g.items.map((it) => (
                  <li key={it.id} style={css('display: flex; align-items: center; gap: 8px; min-height: 40px; border-top: 1px solid var(--line)')}>
                    <PickBox p={it.pick} style="margin-left: -6px;" />
                    <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 500')}>{it.label}</span>
                    {it.note ? <span style={css('flex: none; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--muted-2)')}>{it.note}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div style={css('display: flex; justify-content: flex-end; gap: 8px; padding: 16px 24px; border-top: 1px solid var(--line)')}>
          <button type="button" onClick={p.close} style={css(BTN + ' border: 1px solid var(--border-2); background: transparent; color: var(--ink)')}>Cancel</button>
          <button type="button" onClick={p.sync} disabled={!p.canSync} style={css(BTN + ' border: 0; background: var(--inv); color: var(--inv-ink);' + (p.canSync ? '' : ' opacity: 0.4; cursor: default;'))}>{p.syncText}</button>
        </div>
      </dialog>
    </>
  );
}
