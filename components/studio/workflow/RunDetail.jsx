'use client';
// Run detail (handoff Santos-Run), at /admin/automations/runs/<run id>: what one run did. The steps on the left with
// their state and time, the run log under them, and the selected step on the right: what went wrong with its fix,
// then what the step received and returned. Retry failed step resumes the run where it stopped; Retry from start
// begins a new run. While a run is going the page refreshes every 3 seconds.
import { useEffect, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { T, KIND, R, FONT, WF_CSS } from '@/lib/workflow/theme';
import { RUN_STATUS } from '@/lib/workflow/copy';
import { runView, runMs, tookText, isActive } from '@/lib/workflow/runs';
import { Svg, ICON, KindTile, btn, useModal } from './ui';

const TONE = { passed: [T.live, T.liveBg], failed: [T.error, T.errorBg], retry: [T.warnInk, T.warnBg], waiting: [T.warnInk, T.warnBg], running: [T.varInk, T.varBg], skipped: [T.sub, T.count] };
const STEP = { ok: ['Passed', T.live, T.liveBg, ICON.check], fail: ['Failed', T.error, T.errorBg, ICON.close], run: ['Running', T.varInk, T.varBg, ICON.play], wait: ['Waiting', T.sub, T.count, ICON.clock], hold: ['Waiting', T.warnInk, T.warnBg, ICON.clock], skip: ['Not run', T.sub, T.count, 'M5 12h14'] };
const dayTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (days === 0 ? 'Today' : days === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) + ', ' + t;
};
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '');
const pill = (fg, bg) => 'flex: none; background: ' + bg + '; color: ' + fg + '; border-radius: 999px; padding: 4px 11px; font-size: 13px; font-weight: 600; white-space: nowrap;';

export default function RunDetail({ D, A, runId, set }) {
  const root = useRef(null);
  useModal(root, 'button[data-back]');
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState('');
  const r = (D.automationRuns || []).find((x) => x.id === runId) || null;
  const a = r ? (D.automations || []).find((x) => x.id === r.automation_id) || null : null;
  const active = !!r && isActive(r);
  // A run that is still going: look again every 3 seconds, and stop once it has finished.
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => { A.reload(); }, 3000);
    return () => clearInterval(t);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => set({ autoRun: '', autoTab: 'runs' });
  const frame = (children) => (
    <div ref={root} className="wf wf-page" role="dialog" aria-modal="true" aria-label="Run detail" onKeyDown={(e) => { if (e.key === 'Escape' && !(e.target instanceof Element && e.target.closest('input, textarea, select'))) back(); }}
      style={css('position: fixed; inset: 0; z-index: 56; overflow-y: auto; background: ' + T.page + '; color: ' + T.ink + '; font-family: ' + FONT.body + '; padding: 14px;')}>
      <style>{WF_CSS + `
        .wf-pulse { animation: wf-pulse 1s ease-in-out infinite; }
        .wf-run-grid { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 16px; align-items: start; }
        .wf-kv { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
        @media (max-width: 900px) { .wf-page { padding: 0 !important; } .wf-pad { border-radius: 0 !important; padding: 24px 16px 48px !important; } .wf-run-grid, .wf-kv { grid-template-columns: minmax(0, 1fr); } .wf-page button { min-height: 40px; } }
      `}</style>
      <div className="wf-pad" style={css('min-height: calc(100vh - 28px); background: ' + T.surface + '; border-radius: ' + R.frame + 'px; padding: 28px 32px 40px; display: flex; flex-direction: column; gap: 22px;')}>{children}</div>
    </div>
  );
  const backLink = <button type="button" data-back="" className="wf-h" onClick={back} style={css('height: 42px; display: flex; align-items: center; gap: 6px; padding: 0 12px 0 8px; border: 0; border-radius: 10px; background: transparent; color: ' + T.ink + '; font-weight: 600; font-size: 14px;')}><Svg d={ICON.back} size={16} />Automations</button>;

  if (!r) return frame(
    <>
      <div style={css('display: flex; align-items: center; gap: 10px;')}>{backLink}</div>
      <div style={css('border: 1.5px dashed ' + T.pillOn + '; border-radius: 16px; padding: 40px; text-align: center; color: ' + T.muted + '; font-size: 14px;')}>This run is not in Run history any more. Runs are removed after the time set in Automations &gt; Settings.</div>
    </>
  );

  const v = runView(r, a);
  const name = a ? a.name : 'Deleted workflow';
  const cur = v.rows.find((x) => x.id === picked) || v.rows.find((x) => x.state === 'fail') || v.rows.find((x) => x.state === 'run' || x.state === 'hold') || v.rows[v.rows.length - 1];
  const no = v.rows.indexOf(cur);
  const tone = TONE[v.state] || TONE.skipped;
  const st = STEP[cur.state];
  const connect = cur.state === 'fail' && cur.needs && /not connected|connect /i.test(cur.error) ? cur.needs : '';
  const appName = (key) => ((D.integrations || []).find((g) => g.provider === key) || {}).name || cur.app || key;
  const retry = async (from) => {
    if (busy) return;
    setBusy(from || 'step');
    const out = await A.retryRun(r, from);
    setBusy('');
    if (from === 'start' && out && out.runId) { setPicked(''); set({ autoRun: out.runId }); }
  };
  const canRetry = r.status === 'failed' && !r.is_test;
  const canRestart = !r.is_test && !!a && ['failed', 'done', 'skipped'].includes(r.status);
  const stat = (k, val) => <div style={css('border: 1px solid ' + T.border + '; border-radius: 14px; padding: 12px 16px;')}><div style={css('font-size: 13px; color: ' + T.muted + ';')}>{k}</div><div style={css('font-size: 16px; font-weight: 700; margin-top: 2px; white-space: nowrap;')}>{val}</div></div>;
  const kv = (list) => list.map((x, i) => <div key={i} style={css('display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid ' + T.line + '; font-size: 14px;')}><span style={css('flex: none; color: ' + T.muted + ';')}>{x[0]}</span><span style={css('text-align: right; font-weight: 600; overflow-wrap: anywhere;')}>{x[1]}</span></div>);

  return frame(
    <>
      <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px;')}>
        {backLink}
        <span style={css('font-size: 14px; color: ' + T.muted + ';')}>Automations / Run history / {name}</span>
        <span style={css('flex: 1;')} />
        {a ? <button type="button" className="wf-h" onClick={() => set({ autoRun: '', flowOpen: a.id })} style={css(btn('ghost'))}>Open workflow</button> : null}
        {canRestart ? <button type="button" className="wf-h" disabled={!!busy} onClick={() => retry('start')} style={css(btn('ghost'))}>{busy === 'start' ? 'Starting…' : 'Retry from start'}</button> : null}
        {canRetry ? <button type="button" className="wf-k" disabled={!!busy} onClick={() => retry()} style={css(btn('primary') + ' padding: 0 16px;')}>{busy === 'step' ? 'Retrying…' : 'Retry failed step'}</button> : null}
      </div>

      <div style={css('display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; justify-content: space-between;')}>
        <div style={css('display: flex; flex-direction: column; gap: 10px; min-width: 0;')}>
          <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
            <span role="status" aria-live="polite" className={active ? 'wf-pulse' : ''} style={css(pill(tone[0], tone[1]))}>{r.is_test ? 'Test ' + RUN_STATUS[v.state].toLowerCase() : RUN_STATUS[v.state]}</span>
            <span style={css('font-size: 14px; color: ' + T.muted + '; overflow-wrap: anywhere;')}>{v.summary}</span>
          </div>
          <h1 style={css('margin: 0; font-family: ' + FONT.display + '; font-weight: 900; font-size: 36px; line-height: 1.1; letter-spacing: -.02em; overflow-wrap: anywhere;')}>{name}</h1>
        </div>
        <div style={css('display: flex; gap: 12px; flex-wrap: wrap;')}>
          {stat('Started', dayTime(r.started_at || r.created_at))}
          {stat('Took', active ? 'Still running' : v.state === 'waiting' ? 'Waiting' : tookText(runMs(r), true) || 'Not recorded')}
          {stat('Steps', v.passed + ' of ' + v.total + ' passed')}
        </div>
      </div>

      <div className="wf-run-grid">
        <section aria-label="Steps" style={css('border: 1px solid ' + T.border + '; border-radius: 16px; padding: 8px; min-width: 0;')}>
          {v.rows.map((x) => {
            const s2 = STEP[x.state], on = x === cur;
            return (
              <button key={x.id} type="button" aria-pressed={on} onClick={() => setPicked(x.id)} style={css('width: 100%; text-align: left; display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 12px; background: ' + (on ? T.varBg : T.surface) + '; border: 1.5px solid ' + (on ? T.ring : 'transparent') + '; color: ' + T.ink + '; margin-bottom: 4px;')}>
                <span role="img" aria-label={s2[0]} className={x.state === 'run' ? 'wf-pulse' : ''} style={css('width: 30px; height: 30px; flex: none; border-radius: 999px; background: ' + s2[2] + '; color: ' + s2[1] + '; display: flex; align-items: center; justify-content: center;')}><Svg d={s2[3]} size={14} sw={2.4} /></span>
                <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;')}><span style={css('font-weight: 600; font-size: 15px; overflow-wrap: anywhere;')}>{x.title}</span><span style={css('font-size: 13px; color: ' + T.muted + ';')}>{x.app}</span></span>
                <span style={css('font-size: 13px; color: ' + T.muted + '; white-space: nowrap;')}>{x.ms != null ? tookText(x.ms) : ''}</span>
              </button>
            );
          })}
          <div style={css('border-top: 1px solid ' + T.line + '; margin-top: 6px; padding: 14px 12px 6px; display: flex; flex-direction: column; gap: 10px;')}>
            <h2 style={css('margin: 0; font-size: 14px; font-weight: 700;')}>Run log</h2>
            {v.log.map((ln, i) => <div key={i} style={css('display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 10px; font-size: 13px;')}><span style={css('color: ' + T.muted + ';')}>{clock(ln.at)}</span><span style={css('overflow-wrap: anywhere; color: ' + (ln.level === 'error' ? T.error : T.ink2) + ';')}>{ln.text}</span></div>)}
          </div>
        </section>

        <section aria-label="Step detail" style={css('border: 1px solid ' + T.border + '; border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 20px; min-width: 0;')}>
          <div style={css('display: flex; align-items: center; gap: 14px;')}>
            <KindTile kind={cur.kind} size={46} />
            <div style={css('flex: 1; min-width: 0;')}>
              <div style={css('font-size: 13px; font-weight: 600; color: ' + (KIND[cur.kind] || KIND.action).ink + ';')}>{[no ? 'Step ' + no : '', cur.kindLabel, cur.app === cur.kindLabel ? '' : cur.app].filter(Boolean).join(' · ')}</div>
              <h2 style={css('margin: 2px 0 0; font-size: 22px; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere;')}>{cur.title}</h2>
            </div>
            <span style={css(pill(st[1], st[2]))}>{st[0]}</span>
          </div>
          {cur.state === 'fail' ? (
            <div role="alert" style={css('background: ' + T.errorBg + '; border-radius: 14px; padding: 16px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center;')}>
              <div style={css('flex: 1 1 320px; display: flex; flex-direction: column; gap: 4px; min-width: 0;')}><div style={css('font-weight: 700; font-size: 15px; color: ' + T.error + ';')}>What went wrong</div><div style={css('font-size: 15px; line-height: 1.5; color: ' + T.errorInk + '; overflow-wrap: anywhere;')}>{cur.error}</div></div>
              {connect ? <button type="button" className="wf-k" onClick={() => set({ autoRun: '', autoConn: connect })} style={css(btn('primary'))}>Connect {appName(connect)}</button>
                : a ? <button type="button" className="wf-k" onClick={() => set({ autoRun: '', flowOpen: a.id })} style={css(btn('primary'))}>Open workflow</button> : null}
              {canRetry ? <button type="button" className="wf-h" disabled={!!busy} onClick={() => retry()} style={css(btn('ghost'))}>Retry this step</button> : null}
            </div>
          ) : null}
          {cur.state === 'skip' && cur.error ? <div style={css('background: ' + T.ground2 + '; border-radius: 14px; padding: 16px; font-size: 15px; line-height: 1.5; color: ' + T.ink2 + ';')}>{cur.error}</div> : null}
          {cur.state === 'hold' && cur.approval ? (
            <div style={css('background: ' + T.warnBg + '; border-radius: 14px; padding: 16px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center;')}>
              <div style={css('flex: 1 1 280px; font-size: 15px; line-height: 1.5; color: ' + T.warnInk + ';')}>The run is waiting here for a Super Admin to approve. Nothing after this step happens until then.</div>
              <button type="button" className="wf-k" onClick={() => set({ autoRun: '', autoAppr: r.id })} style={css(btn('primary'))}>Open approval</button>
            </div>
          ) : cur.state === 'hold' ? <div style={css('background: ' + T.warnBg + '; border-radius: 14px; padding: 16px; font-size: 15px; line-height: 1.5; color: ' + T.warnInk + ';')}>The run is waiting here{r.next_attempt_at ? ' until ' + dayTime(r.next_attempt_at).replace(/^./, (c) => c.toLowerCase()) : ''}, then carries on by itself.</div> : null}
          <div className="wf-kv">
            <div style={css('display: flex; flex-direction: column; min-width: 0;')}>
              <h3 style={css('margin: 0 0 4px; font-size: 14px; font-weight: 700;')}>Received</h3>
              {cur.received.length ? kv(cur.received) : <div style={css('padding: 10px 0; font-size: 14px; color: ' + T.muted + ';')}>{cur.id === 'trigger' ? 'Nothing. The trigger starts the run.' : 'Nothing recorded for this step.'}</div>}
            </div>
            <div style={css('display: flex; flex-direction: column; min-width: 0;')}>
              <h3 style={css('margin: 0 0 4px; font-size: 14px; font-weight: 700;')}>Returned</h3>
              {cur.returned ? kv(cur.returned) : <div style={css('padding: 10px 0; font-size: 14px; color: ' + T.muted + ';')}>{cur.state === 'fail' ? 'Nothing returned. The step stopped before it finished.' : cur.state === 'ok' ? 'Nothing recorded for this step.' : 'Nothing yet. The step has not run.'}</div>}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
