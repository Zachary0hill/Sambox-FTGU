'use client';
// Review and turn on (handoff ReviewChecklist): four checks, each with a link to its fix. Turn on stays locked until
// all four pass.
// checks: [{ ok, label, detail, fixLabel, fix, ack?: { on, label, set } }]
import { useRef } from 'react';
import { css } from '@/lib/studio/css';
import { T, FONT, SHADOW } from '@/lib/workflow/theme';
import { Svg, ICON, btn, useModal } from './ui';

export default function ReviewModal({ name, checks, paused, busy, onTurnOn, onClose, children, revision }) {
  const layer = useRef(null);
  useModal(layer, 'button[data-first]');
  const left = checks.filter((c) => !c.ok).length;
  const ready = left === 0;
  return (
    <div ref={layer} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={css('position: fixed; inset: 0; z-index: 75; background: rgba(17,17,17,.36); display: flex; justify-content: center; align-items: flex-start; padding: 72px 16px 16px; overflow-y: auto;')}>
      <div role="dialog" aria-modal="true" aria-labelledby="wf-rv-t" className="wf-pop" style={css('width: 600px; max-width: 100%; background: ' + T.surface + '; border-radius: 20px; box-shadow: ' + SHADOW.modal + '; display: flex; flex-direction: column; overflow: hidden; color: ' + T.ink + ';')}>
        <div style={css('display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 18px 20px; border-bottom: 1px solid ' + T.line + ';')}>
          <div style={css('min-width: 0;')}>
            <div style={css('font-size: 13px; color: ' + T.muted + ';')}>Review · {name}</div>
            <h2 id="wf-rv-t" aria-live="polite" style={css('margin: 2px 0 0; font-family: ' + FONT.display + '; font-weight: 900; font-size: 20px;')}>{ready ? 'Ready to turn on' : left + (left === 1 ? ' thing' : ' things') + ' left before it can turn on'}</h2>
          </div>
          <button type="button" className="wf-h" aria-label="Close" onClick={onClose} style={css('width: 40px; height: 40px; flex: none; border: 0; border-radius: 10px; background: transparent; color: ' + T.ink + '; display: flex; align-items: center; justify-content: center;')}><Svg d={ICON.close} size={18} /></button>
        </div>
        {children}
        <ul style={css('margin: 0; padding: 6px 20px; list-style: none;')}>
          {checks.map((c, i) => (
            <li key={i} style={css('display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 12px 0; border-bottom: 1px solid ' + T.line + ';')}>
              <span role="img" aria-label={c.ok ? 'Done' : 'To do'} style={css('width: 32px; height: 32px; flex: none; border-radius: 999px; background: ' + (c.ok ? T.liveBg : T.warnBg) + '; color: ' + (c.ok ? T.live : T.warnInk) + '; display: flex; align-items: center; justify-content: center;')}><Svg d={c.ok ? ICON.check : 'M12 7v6M12 17h.01'} size={15} sw={2.6} /></span>
              <div style={css('flex: 1 1 220px; min-width: 0;')}>
                <div style={css('font-weight: 600; font-size: 15px;')}>{c.label}</div>
                <div style={css('font-size: 13px; color: ' + T.muted + '; margin-top: 2px; overflow-wrap: anywhere;')}>{c.detail}</div>
                {c.ack ? (
                  <label style={css('display: flex; align-items: center; gap: 8px; min-height: 40px; margin-top: 4px; font-size: 14px; font-weight: 600; cursor: pointer;')}>
                    <input type="checkbox" checked={c.ack.on} onChange={(e) => c.ack.set(e.target.checked)} style={css('width: 18px; height: 18px; margin: 0; accent-color: ' + T.ink + ';')} />{c.ack.label}
                  </label>
                ) : null}
              </div>
              {!c.ok && c.fix ? <button type="button" className="wf-h" onClick={c.fix} style={css(btn('ghost', 38) + ' flex: none; padding: 0 12px; font-size: 13px;')}>{c.fixLabel}</button> : null}
            </li>
          ))}
        </ul>
        <div style={css('display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 16px 20px; border-top: 1px solid ' + T.line + '; background: ' + T.ground + '; flex-wrap: wrap;')}>
          <span style={css('flex: 1 1 200px; font-size: 13px; line-height: 1.45; color: ' + (paused ? T.warnInk : T.muted) + ';')}>{paused ? 'Pause all automations is on, so nothing runs until you resume.' : ready ? 'Once it is on, it runs each time its trigger fires.' : 'Finish the items above to turn it on.'}</span>
          <button type="button" data-first="" className="wf-h" onClick={onClose} style={css(btn('ghost', 44) + ' padding: 0 16px;')}>Keep editing</button>
          <button type="button" className={ready ? 'wf-k' : ''} disabled={!ready || busy} aria-disabled={!ready} onClick={onTurnOn}
            style={css('height: 44px; padding: 0 16px; border-radius: 12px; font-weight: 600; font-size: 14px; ' + (ready ? 'background: ' + T.accent + '; color: ' + T.accentInk + '; border: 1px solid ' + T.accent + ';' : 'background: ' + T.count + '; color: ' + T.muted + '; border: 1px solid ' + T.line + '; cursor: not-allowed;'))}>{busy ? 'Saving…' : revision ? 'Apply to live workflow' : 'Turn on'}</button>
        </div>
      </div>
    </div>
  );
}
