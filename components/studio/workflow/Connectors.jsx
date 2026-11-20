'use client';
// Connectors (handoff Santos-Connectors), at /admin/automations/connectors: the apps automations sign in to. The list
// on the left with what uses each one and its status; on the right the selected app: what breaks while it is not
// connected, Connect, what it can do, which workflows use it and its recent activity.
// Connect opens the app's own setup in Workspace Settings > Integrations (the existing sign-in flow), with a pill to
// come back; once the app is connected this page points at the failed run or waiting approval to pick up next.
import { useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { ACTIONS, actionById } from '@/lib/automations/catalog';
import { providerById } from '@/lib/integrations/registry';
import { T, R, FONT, WF_CSS } from '@/lib/workflow/theme';
import { STEP_COPY } from '@/lib/workflow/copy';
import { workflowOf } from '@/lib/workflow/graph';
import { approvalsOf } from '@/lib/workflow/approvals';
import { Svg, ICON, MiniSeg, btn, useModal } from './ui';

const STATE = { connected: ['Connected', T.live, T.liveBg], error: ['Needs attention', T.error, T.errorBg], not_connected: ['Not connected', T.sub, T.count] };
const dayTime = (iso) => {
  const d = new Date(iso), now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  return (days === 0 ? 'Today' : days === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

// The connectors with what uses them. Shared with the hub's Connectors tab.
export function connectorsOf(D) {
  const connected = Object.fromEntries((D.integrations || []).map((g) => [g.provider, g.status === 'connected']));
  const flows = (D.automations || []).map((a) => workflowOf(a, connected));
  return (D.integrations || []).map((g) => {
    const usedBy = flows.filter((w) => w.needs.includes(g.provider));
    return {
      key: g.provider, name: g.name, state: g.status === 'connected' ? (g.last_error ? 'error' : 'connected') : 'not_connected', lastError: g.last_error || '',
      usedBy, blocking: g.status !== 'connected' && usedBy.some((w) => w.status !== 'off'), managed: !!providerById(g.provider),
      about: (providerById(g.provider) || {}).description || g.description || '',
    };
  // Apps a workflow is waiting on first, then the ones in use, then the rest in their usual order.
  }).map((c, i) => ({ c, i })).sort((x, y) => (Number(y.c.blocking) - Number(x.c.blocking)) || (Number(y.c.usedBy.length > 0) - Number(x.c.usedBy.length > 0)) || (x.i - y.i)).map((x) => x.c);
}

// The pill shown in Workspace Settings after "Connect": back to the connector that sent you there.
export function ConnectorsReturn({ D, app, set }) {
  const g = (D.integrations || []).find((x) => x.provider === app);
  return (
    <div role="region" aria-label="Back to Connectors" style={css('position: fixed; z-index: 55; left: 50%; bottom: 20px; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; padding: 6px; max-width: calc(100vw - 32px); border-radius: 14px; background: var(--inv); color: var(--inv-ink); box-shadow: 0 12px 40px rgba(0,0,0,.25); font-family: var(--font-main);')}>
      <button type="button" onClick={() => set({ nav: 'auto', autoConn: app, connReturn: '', connJust: app })} style={css('min-height: 38px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer;')}><Svg d={ICON.back} size={16} />Back to Connectors{g ? ' · ' + g.name : ''}</button>
      <button type="button" aria-label="Dismiss" onClick={() => set({ connReturn: '' })} style={css('width: 34px; height: 34px; border: 0; border-radius: 10px; background: transparent; color: inherit; display: flex; align-items: center; justify-content: center; cursor: pointer;')}><Svg d={ICON.close} size={16} /></button>
    </div>
  );
}

export default function Connectors({ D, s, set }) {
  const root = useRef(null);
  useModal(root, 'button[data-back]');
  const [only, setOnly] = useState('all');
  const all = connectorsOf(D);
  const shown = all.filter((c) => only === 'all' || c.state !== 'connected');
  const cur = all.find((c) => c.key === s.autoConn) || shown.find((c) => c.blocking) || shown[0] || all[0] || null;
  const back = () => set({ autoConn: '', connJust: '', autoTab: 'connectors' });
  const blocking = all.filter((c) => c.blocking).length;

  // What the selected app has done lately: the steps that used it, newest first.
  const names = {};
  (D.automations || []).forEach((a) => { names[a.id] = a.name; });
  const activity = [];
  if (cur) (D.automationRuns || []).forEach((r) => {
    if (r.is_test) return;
    ((r.output || {}).steps || []).forEach((x) => {
      if ((actionById(x.action) || {}).needs !== cur.key) return;
      activity.push({ at: x.at || r.finished_at || r.created_at, runId: r.id, ok: x.ok, text: (names[r.automation_id] || 'Deleted workflow') + (x.ok ? ': ' + x.detail : ' failed: ' + x.detail) });
    });
  });
  activity.sort((x, y) => new Date(y.at) - new Date(x.at));
  const can = cur ? ACTIONS.filter((a) => a.needs === cur.key).map((a) => (STEP_COPY[a.key] || {}).title || a.label) : [];
  // After connecting: what to pick up next on the workflows that use this app.
  const ids = new Set(cur ? cur.usedBy.map((w) => w.id) : []);
  const failed = (D.automationRuns || []).find((r) => !r.is_test && r.status === 'failed' && ids.has(r.automation_id));
  const waiting = approvalsOf(D).find((x) => ids.has(x.workflowId));
  const st = cur ? STATE[cur.state] : null;
  const tile = (name, size) => <span aria-hidden="true" style={css('width: ' + size + 'px; height: ' + size + 'px; flex: none; border-radius: ' + Math.round(size * 0.24) + 'px; background: ' + T.accent + '; color: ' + T.accentInk + '; display: flex; align-items: center; justify-content: center; font-family: ' + FONT.display + '; font-weight: 900; font-size: ' + Math.round(size * 0.4) + 'px;')}>{String(name || '?').slice(0, 1).toUpperCase()}</span>;
  const h3 = 'margin: 0 0 4px; font-size: 15px; font-weight: 700;';
  const line = 'display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid ' + T.line + '; font-size: 15px;';

  return (
    <div ref={root} className="wf wf-page" role="dialog" aria-modal="true" aria-label="Connectors" onKeyDown={(e) => { if (e.key === 'Escape') back(); }}
      style={css('position: fixed; inset: 0; z-index: 56; overflow-y: auto; background: ' + T.page + '; color: ' + T.ink + '; font-family: ' + FONT.body + '; padding: 14px;')}>
      <style>{WF_CSS + `
        .wf-conn-grid { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 16px; align-items: start; }
        .wf-kv { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
        @media (max-width: 900px) { .wf-page { padding: 0 !important; } .wf-pad { border-radius: 0 !important; padding: 24px 16px 48px !important; } .wf-conn-grid, .wf-kv { grid-template-columns: minmax(0, 1fr); } .wf-page button { min-height: 40px; } }
      `}</style>
      <div className="wf-pad" style={css('min-height: calc(100vh - 28px); background: ' + T.surface + '; border-radius: ' + R.frame + 'px; padding: 28px 32px 40px; display: flex; flex-direction: column; gap: 18px;')}>
        <div><button type="button" data-back="" className="wf-h" onClick={back} style={css('height: 42px; display: flex; align-items: center; gap: 6px; padding: 0 12px 0 8px; border: 0; border-radius: 10px; background: transparent; color: ' + T.ink + '; font-weight: 600; font-size: 14px;')}><Svg d={ICON.back} size={16} />Automations</button></div>
        <div style={css('display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px;')}>
          <div>
            <h1 style={css('margin: 0; font-family: ' + FONT.display + '; font-weight: 900; font-size: 36px; line-height: 1.1; letter-spacing: -.02em;')}>Connectors</h1>
            <p aria-live="polite" style={css('margin: 8px 0 0; font-size: 15px; color: ' + T.sub + ';')}>{all.filter((c) => c.state === 'connected').length} of {all.length} connected{blocking ? ' · ' + blocking + ' blocking a workflow' : ''}</p>
          </div>
          <MiniSeg label="Show" h={38} value={only} onChange={setOnly} options={[['all', 'All'], ['attention', 'Needs attention']]} />
        </div>

        <div className="wf-conn-grid">
          <section aria-label="Apps" style={css('border: 1px solid ' + T.border + '; border-radius: 16px; padding: 8px; min-width: 0;')}>
            {shown.map((c) => {
              const on = cur && c.key === cur.key, t2 = STATE[c.state];
              return (
                <button key={c.key} type="button" aria-pressed={on} onClick={() => set({ autoConn: c.key, connJust: '' })} style={css('width: 100%; text-align: left; display: flex; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 12px; background: ' + (on ? T.varBg : T.surface) + '; border: 1.5px solid ' + (on ? T.ring : 'transparent') + '; color: ' + T.ink + '; margin-bottom: 2px;')}>
                  {tile(c.name, 36)}
                  <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px;')}><span style={css('font-weight: 600; font-size: 15px;')}>{c.name}</span><span style={css('font-size: 13px; color: ' + T.muted + ';')}>{c.usedBy.length ? 'Used by ' + c.usedBy.length + (c.usedBy.length === 1 ? ' workflow' : ' workflows') : 'Not in use'}</span></span>
                  <span style={css('display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; color: ' + t2[1] + ';')}><span aria-hidden="true" style={css('width: 8px; height: 8px; border-radius: 999px; background: ' + (c.state === 'not_connected' ? T.pillOn : t2[1]) + ';')} />{t2[0]}</span>
                </button>
              );
            })}
            {!shown.length ? <div style={css('padding: 28px 16px; text-align: center; font-size: 14px; color: ' + T.muted + ';')}>Nothing needs attention. Every app is connected.</div> : null}
          </section>

          {cur ? (
            <section aria-label={cur.name} style={css('border: 1px solid ' + T.border + '; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 20px; min-width: 0;')}>
              <div style={css('display: flex; align-items: center; gap: 16px;')}>
                {tile(cur.name, 56)}
                <div style={css('flex: 1; min-width: 0;')}><h2 style={css('margin: 0; font-size: 24px; font-weight: 700; line-height: 1.2;')}>{cur.name}</h2><div style={css('font-size: 14px; color: ' + T.muted + '; margin-top: 2px;')}>{st[0]}</div></div>
                <span style={css('background: ' + st[2] + '; color: ' + st[1] + '; border-radius: 999px; padding: 4px 11px; font-size: 13px; font-weight: 600; white-space: nowrap;')}>{st[0]}</span>
              </div>
              {s.connJust === cur.key && cur.state === 'connected' ? (
                <div role="status" style={css('background: ' + T.liveBg + '; border-radius: 14px; padding: 14px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px;')}>
                  <span style={css('flex: 1 1 260px; font-size: 15px; line-height: 1.5; color: ' + T.ink2 + ';')}><strong>{cur.name} is connected.</strong> {failed ? 'A run failed while it was not. Open it and retry the failed step.' : waiting ? 'An approval is waiting on a workflow that uses it.' : 'Its steps can run now.'}</span>
                  {failed ? <button type="button" className="wf-k" onClick={() => set({ autoConn: '', connJust: '', autoRun: failed.id })} style={css(btn('primary'))}>View failed run</button>
                    : waiting ? <button type="button" className="wf-k" onClick={() => set({ autoConn: '', connJust: '', autoAppr: waiting.id })} style={css(btn('primary'))}>Open approval</button> : null}
                </div>
              ) : null}
              {cur.state !== 'connected' && cur.usedBy.length ? <div style={css('background: ' + T.warnBg + '; border-radius: 14px; padding: 14px 16px; font-size: 15px; line-height: 1.5; color: ' + T.warnInk + ';')}>{cur.usedBy.length} {cur.usedBy.length === 1 ? 'workflow uses' : 'workflows use'} {cur.name}. {cur.usedBy.length === 1 ? 'It fails' : 'They fail'} at {cur.usedBy.length === 1 ? 'its' : 'their'} {cur.name} step until you {cur.state === 'error' ? 'fix the connection' : 'connect it'}.</div> : null}
              {cur.state === 'error' && cur.lastError ? <div role="alert" style={css('background: ' + T.errorBg + '; border-radius: 14px; padding: 14px 16px; font-size: 14px; line-height: 1.5; color: ' + T.errorInk + '; overflow-wrap: anywhere;')}>{cur.lastError}</div> : null}
              <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 12px;')}>
                {cur.managed ? <button type="button" className={cur.state === 'connected' ? 'wf-h' : 'wf-k'} onClick={() => set({ autoConn: '', connJust: '', connReturn: cur.key, nav: 'workspace', wsTab: 'integ', integFocus: cur.key, integExpanded: cur.key })} style={css(btn(cur.state === 'connected' ? 'ghost' : 'primary', 46) + ' padding: 0 18px; font-size: 15px;')}>{cur.state === 'connected' ? 'Manage ' : cur.state === 'error' ? 'Reconnect ' : 'Connect '}{cur.name}</button>
                  : <span style={css('font-size: 14px; color: ' + T.muted + ';')}>Connecting {cur.name} is not available yet.</span>}
                {cur.managed ? <span style={css('font-size: 13px; color: ' + T.muted + ';')}>Opens its setup in Workspace Settings. A pill there brings you back.</span> : null}
              </div>
              <div className="wf-kv">
                <div style={css('min-width: 0;')}>
                  <h3 style={css(h3)}>What it can do</h3>
                  {can.map((x) => <div key={x} style={css(line)}><Svg d={ICON.check} size={14} sw={2.6} color={T.live} />{x}</div>)}
                  {!can.length ? <p style={css('margin: 0; padding: 10px 0; font-size: 14px; line-height: 1.5; color: ' + T.muted + ';')}>{cur.about || 'No automation steps use this app yet.'}</p> : cur.about ? <p style={css('margin: 0; padding: 10px 0 0; font-size: 13px; line-height: 1.5; color: ' + T.muted + ';')}>{cur.about}</p> : null}
                </div>
                <div style={css('min-width: 0;')}>
                  <h3 style={css(h3)}>Used by</h3>
                  {cur.usedBy.map((w) => <button key={w.id} type="button" className="wf-h" onClick={() => set({ autoConn: '', connJust: '', flowOpen: w.id })} style={css(line + ' width: 100%; justify-content: space-between; border-top: 0; border-left: 0; border-right: 0; background: transparent; color: ' + T.ink + '; text-align: left; font-family: inherit;')}><span style={css('min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{w.name}</span><Svg d={ICON.chev} size={14} color={T.muted} /></button>)}
                  {!cur.usedBy.length ? <p style={css('margin: 0; padding: 10px 0; font-size: 14px; color: ' + T.muted + ';')}>No workflow uses it yet.</p> : null}
                </div>
              </div>
              <div>
                <h3 style={css(h3)}>Recent activity</h3>
                {activity.slice(0, 6).map((x, i) => (
                  <button key={i} type="button" className="wf-h" onClick={() => set({ autoConn: '', connJust: '', autoRun: x.runId })} style={css('width: 100%; display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 12px; padding: 10px 0; border: 0; border-bottom: 1px solid ' + T.line + '; background: transparent; text-align: left; font-family: inherit; font-size: 15px;')}>
                    <span style={css('color: ' + T.muted + ';')}>{dayTime(x.at)}</span><span style={css('overflow-wrap: anywhere; color: ' + (x.ok ? T.ink2 : T.error) + ';')}>{x.text}</span>
                  </button>
                ))}
                {!activity.length ? <p style={css('margin: 0; padding: 10px 0; font-size: 14px; color: ' + T.muted + ';')}>Nothing yet. Steps that use {cur.name} show here once a workflow runs.</p> : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
