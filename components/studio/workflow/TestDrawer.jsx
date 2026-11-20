'use client';
// Test run drawer (handoff TestRunDrawer): floats over the bottom of the canvas while a test runs and after. One row
// per card, in order, with what the step would do and its state; the run stops at the first broken step and offers
// "Fix step". Nothing is sent: the runner describes each step on the newest project (lib/automations/run.ts
// testAutomation).
// test: { phase: 'wait' | 'play' | 'done', rows: [{ id, n, title, out, final: 'ok' | 'fail' | '' }], shown, error }
import { css } from '@/lib/studio/css';
import { T, R } from '@/lib/workflow/theme';
import { Svg, ICON, btn } from './ui';

// A row's state on screen: rows before `shown` have their result, the row at `shown` is running, the rest wait.
export const rowState = (test, i) => (!test ? '' : i < test.shown ? test.rows[i].final || 'wait' : i === test.shown && test.phase !== 'done' ? 'run' : 'wait');
const LABEL = { ok: 'Passed', fail: 'Failed', run: 'Running', wait: 'Waiting' };
const TONE = { ok: T.live, fail: T.error, run: T.varInk, wait: T.muted };

export default function TestDrawer({ test, onFix, onAgain, onClose }) {
  const failed = test.rows.findIndex((r, i) => rowState(test, i) === 'fail');
  const done = test.phase === 'done';
  const head = !done ? 'Running test…' : failed >= 0 ? 'Stopped at ' + (test.rows[failed].n === 'T' ? 'the trigger' : 'step ' + test.rows[failed].n) : test.error ? 'Test could not finish' : 'Test passed';
  const dot = !done ? T.varInk : failed >= 0 || test.error ? T.error : T.live;
  return (
    <section aria-label="Test run" className="wf-drawer" style={css('position: absolute; left: 12px; right: 64px; bottom: 12px; z-index: 8; background: ' + T.surface + '; border: 1px solid ' + T.inputLine + '; border-radius: ' + R.card + 'px; box-shadow: 0 12px 32px rgba(0,0,0,.12); max-height: 300px; display: flex; flex-direction: column; overflow: hidden;')}>
      <div style={css('display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid ' + T.line + '; flex-wrap: wrap;')}>
        <span aria-hidden="true" className={done ? '' : 'wf-pulse'} style={css('width: 10px; height: 10px; flex: none; border-radius: 999px; background: ' + dot + ';')} />
        <span role="status" aria-live="polite" style={css('font-weight: 700; font-size: 15px;')}>{head}</span>
        <span style={css('font-size: 13px; color: ' + T.muted + ';')}>Sample data, nothing is sent</span>
        <span style={css('flex: 1;')} />
        {done && failed >= 0 ? <button type="button" className="wf-k" onClick={() => onFix(test.rows[failed].id)} style={css(btn('primary', 36) + ' padding: 0 12px; font-size: 13px;')}>Fix step</button> : null}
        <button type="button" className="wf-h" disabled={!done} onClick={onAgain} style={css(btn('ghost', 36) + ' padding: 0 12px; font-size: 13px;' + (done ? '' : ' opacity: .5; cursor: default;'))}>Run again</button>
        <button type="button" className="wf-h" aria-label="Close test run" onClick={onClose} style={css('width: 36px; height: 36px; flex: none; border: 0; border-radius: 10px; background: transparent; color: ' + T.ink + '; display: flex; align-items: center; justify-content: center;')}><Svg d={ICON.close} size={15} /></button>
      </div>
      <div className="wf-sc" style={css('overflow: auto;')}>
        {test.error && done ? <p role="alert" style={css('margin: 0; padding: 10px 14px; font-size: 13px; color: ' + T.error + '; border-bottom: 1px solid ' + T.line + ';')}>{test.error}</p> : null}
        {test.rows.map((r, i) => {
          const st = rowState(test, i);
          return (
            <div key={r.id} style={css('display: grid; grid-template-columns: 28px minmax(0, 1fr) 80px; gap: 10px; align-items: center; padding: 8px 14px; border-bottom: 1px solid ' + T.line + '; font-size: 13px;')}>
              <span style={css('font-weight: 600; color: ' + T.muted + ';')}>{r.n}</span>
              <span style={css('min-width: 0; overflow-wrap: anywhere;')}><span style={css('font-weight: 600;')}>{r.title}</span>{' '}<span style={css('font-size: 12px; color: ' + (st === 'fail' ? T.error : T.muted) + ';')}>{st === 'ok' || st === 'fail' ? r.out : ''}</span></span>
              <span className={st === 'run' ? 'wf-pulse' : ''} style={css('font-weight: 600; font-size: 12px; text-align: right; color: ' + TONE[st] + ';')}>{LABEL[st]}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
