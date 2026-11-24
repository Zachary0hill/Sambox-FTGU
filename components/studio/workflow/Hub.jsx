'use client';
// Automation Management hub (handoff/santos-workflow-builder-handoff-2026-11-17, Santos-Hub): the alert banner, the
// stat strip, tabs for Workflows, Templates, Run history, Approvals and Connectors, and the workflow cards with a
// live preview of each flow. Reads the same data the board loads (D.automations, D.automationRuns, D.integrations)
// and saves through the existing actions (A.updateAutomation, A.saveFlow, A.retryRun, A.deleteAutomation).
// Tab, status and search live in the board state (s.autoTab, s.autoSt, s.autoQ) and in the URL (Studio.jsx).
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { Popover, MenuRow, IC as PIC } from '../Prims';
import { providerById } from '@/lib/integrations/registry';
import { isGraph, graphOf, stepCount } from '@/lib/automations/graph';
import { T, KIND, R, H, SHADOW, FONT, WF_CSS, dotGrid } from '@/lib/workflow/theme';
import { AGENT_SHORT, STATUS, RUN_STATUS, HUB, TEMPLATES } from '@/lib/workflow/copy';
import { workflowOf, workflowOfTemplate, graphFromTemplate, previewOf, reasonOf } from '@/lib/workflow/graph';
import { workflowConnections } from '@/lib/workflow/authoring';
import { runState, runMs, tookText } from '@/lib/workflow/runs';
import { approvalsOf, span } from '@/lib/workflow/approvals';

const CHEV = 'm9 18 6-6-6-6';
const Svg = ({ d, size = 12, sw = 2.2, color = 'currentColor' }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d={d} /></svg>
);
const srOnly = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;';
const btn = (kind, h = 42) => 'height: ' + h + 'px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 14px; border-radius: ' + R.small + 'px; font-weight: 600; font-size: 14px; text-decoration: none; white-space: nowrap; ' +
  (kind === 'primary' ? 'background: ' + T.accent + '; color: ' + T.accentInk + '; border: 1px solid ' + T.accent + ';'
    : kind === 'danger' ? 'background: ' + T.surface + '; color: ' + T.error + '; border: 1px solid ' + T.errorLine + ';'
      : 'background: ' + T.surface + '; color: ' + T.ink + '; border: 1px solid ' + T.inputLine + ';');
const dashed = 'border: 1.5px dashed ' + T.pillOn + '; border-radius: ' + R.card + 'px; padding: 40px; text-align: center; color: ' + T.muted + '; font-size: 14px;';

// ---------- Dates, in plain words ----------
const timeOf = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const dayOf = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
function dayWord(d, now) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()), b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((a - b) / 86400000);
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : '';
}
const whenText = (iso, now) => { const d = new Date(iso), w = dayWord(d, now); return w ? w + ', ' + timeOf(d) : dayOf(d); };
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
// Monday 00:00 local time (handoff assumption 9).
const weekStart = (now) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
const RUN_TONE = { passed: [T.live, T.liveBg], failed: [T.error, T.errorBg], retry: [T.warnInk, T.warnBg], waiting: [T.warnInk, T.warnBg], running: [T.varInk, T.varBg], skipped: [T.sub, T.count] };

// ---------- FlowPreview: step chips joined by connector lines ----------
function FlowPreview({ steps }) {
  const chips = previewOf(steps);
  return chips.map((c, i) => {
    const k = KIND[c.kind];
    return (
      <Fragment key={c.id + i}>
        {i ? <span aria-hidden="true" style={css('width: 1.5px; height: 8px; flex: none; background: ' + T.wire + ';')} /> : null}
        {k ? (
          <span style={css('display: flex; align-items: center; gap: 8px; max-width: calc(100% - 24px); height: ' + H.chip + 'px; flex: none; padding: 0 11px 0 3px; background: ' + T.surface + '; border: 1px solid ' + T.chipLine + '; border-radius: ' + R.chip + 'px; box-shadow: ' + SHADOW.chip + '; color: ' + T.ink + '; font-size: 12px; font-weight: 600; white-space: nowrap;')}>
            <span style={css('width: 22px; height: 22px; flex: none; border-radius: ' + R.tile + 'px; background: ' + k.bg + '; display: flex; align-items: center; justify-content: center;')}><Svg d={k.icon} color={k.ink} /></span>
            <span style={css('overflow: hidden; text-overflow: ellipsis;')}>{c.text}</span>
          </span>
        ) : <span style={css('flex: none; font-size: 11px; font-weight: 600; color: ' + T.muted + ';')}>{c.text}</span>}
        {c.br ? (
          <span style={css('display: flex; gap: 16px; margin-top: 7px; flex: none; font-size: 11px; font-weight: 600; white-space: nowrap;')}>
            <span style={css('display: flex; align-items: center; gap: 4px; color: ' + T.live + ';')}><Svg d="M20 6 9 17l-5-5" size={11} sw={3} />{c.br.yes}</span>
            <span style={css('display: flex; align-items: center; gap: 4px; color: ' + T.muted + ';')}><Svg d="M18 6 6 18M6 6l12 12" size={10} sw={3} />{c.br.no}</span>
          </span>
        ) : null}
      </Fragment>
    );
  });
}
const previewBox = (h) => 'position: relative; height: ' + h + 'px; display: flex; flex-direction: column; align-items: center; justify-content: center; ' + dotGrid + ' border-bottom: 1px solid ' + T.line + '; text-decoration: none; overflow: hidden;';

function Switch({ on, label, busy, onToggle }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={busy} onClick={onToggle}
      style={css('width: 56px; height: ' + H.touch + 'px; flex: none; background: transparent; border: 0; padding: 0; display: flex; align-items: center; justify-content: center;')}>
      <span style={css('width: 44px; height: 26px; border-radius: 999px; background: ' + (on ? T.live : T.pillOn) + '; position: relative; display: block; transition: background .15s ease;')}>
        <span style={css('position: absolute; top: 3px; left: ' + (on ? 21 : 3) + 'px; width: 20px; height: 20px; border-radius: 999px; background: ' + T.knob + '; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: left .15s ease;')} />
      </span>
    </button>
  );
}

// ---------- WorkflowCard ----------
function WorkflowCard({ w, now, open, onToggle, onDelete }) {
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState(false);
  const tone = w.status === 'live' ? T.live : w.status === 'draft' ? T.warn : T.off;
  const meta = w.raw?.revision_applied_at ? 'Revision applied to the live workflow' : !w.runs ? (w.mapKind === 'process' ? 'Process map, never runs' : 'Idea sketch, never runs')
    : w.status === 'live' ? (w.lastRunAt ? 'Last run ' + whenText(w.lastRunAt, now) : 'Has not run yet')
      : w.status === 'off' ? (w.updatedAt ? 'Off since ' + dayOf(new Date(w.updatedAt)) : 'Turned off') : reasonOf(w.fixes);
  const href = '/admin/automations?flow=' + encodeURIComponent(w.raw?.revision_applied_at ? w.raw.revision_source_id : w.id);
  const go = (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); open(w.id); };
  return (
    <article className="wf-c" style={css('border: 1px solid ' + T.border + '; border-radius: ' + R.card + 'px; background: ' + T.surface + '; display: flex; flex-direction: column; min-width: 0;')}>
      <a href={href} onClick={go} aria-label={'Open ' + w.name} style={css(previewBox(248) + ' border-radius: ' + (R.card - 1) + 'px ' + (R.card - 1) + 'px 0 0;')}>
        {w.fromAgent ? (
          <span style={css('position: absolute; top: 10px; right: 10px; display: flex; align-items: center; gap: 5px; background: ' + KIND.ai.bg + '; color: ' + KIND.ai.ink + '; border-radius: 999px; padding: 3px 9px; font-size: 11px; font-weight: 700;')}><Svg d={KIND.ai.icon} size={11} />{AGENT_SHORT}</span>
        ) : null}
        <FlowPreview steps={w.steps} />
      </a>
      <div style={css('padding: 10px 8px 10px 14px; display: flex; align-items: center; gap: 4px;')}>
        <div style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;')}>
          <a href={href} onClick={go} style={css('color: ' + T.ink + '; text-decoration: none; font-weight: 700; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>{w.name}</a>
          <div style={css('display: flex; align-items: center; gap: 8px; font-size: 13px; color: ' + T.muted + '; white-space: nowrap; overflow: hidden;')}>
            <span style={css('display: flex; align-items: center; gap: 5px; color: ' + tone + '; font-weight: 600;')}><span aria-hidden="true" style={css('width: 7px; height: 7px; border-radius: 999px; background: ' + tone + ';')} />{STATUS[w.status]}</span>
            <span style={css('overflow: hidden; text-overflow: ellipsis;')}>{meta}</span>
          </div>
        </div>
        <div style={css('position: relative; flex: none;')}>
          <button type="button" className="wf-h" aria-label={'More for ' + w.name} aria-haspopup="menu" aria-expanded={menu} onClick={() => { setMenu(!menu); setAsk(false); }}
            style={css('width: 36px; height: ' + H.touch + 'px; border: 0; border-radius: ' + R.small + 'px; background: transparent; color: ' + T.muted + '; display: flex; align-items: center; justify-content: center;')}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </button>
          {menu ? (
            <Popover label={'More for ' + w.name} role="menu" align="right" width={200} pad={6} top="auto; bottom: calc(100% + 6px)" onClose={() => setMenu(false)}>
              <MenuRow role="menuitem" icon={PIC.chevR} label="Open in builder" onClick={() => { setMenu(false); open(w.id); }} />
              <MenuRow role="menuitem" icon={PIC.trash} danger label={ask ? 'Confirm delete' : 'Delete'} onClick={() => { if (!ask) return setAsk(true); setMenu(false); onDelete(w); }} />
            </Popover>
          ) : null}
        </div>
        {!w.runs ? null : w.status === 'draft' ? (
          <a href={href} onClick={go} className="wf-k" style={css('height: ' + H.touch + 'px; flex: none; margin-right: 6px; border-radius: ' + R.small + 'px; padding: 0 14px; display: flex; align-items: center; background: ' + T.accent + '; color: ' + T.accentInk + '; text-decoration: none; font-weight: 600; font-size: 13px;')}>{HUB.setUp}</a>
        ) : w.raw?.revision_applied_at ? null : <Switch on={w.status === 'live'} label={w.name + ' on or off'} onToggle={() => onToggle(w)} />}
      </div>
    </article>
  );
}

function TemplateCard({ tp, busy, onUse }) {
  return (
    <article style={css('border: 1px solid ' + T.border + '; border-radius: ' + R.card + 'px; background: ' + T.surface + '; overflow: hidden; display: flex; flex-direction: column; min-width: 0;')}>
      <div aria-hidden="true" style={css(previewBox(200))}><FlowPreview steps={tp.preview.steps} /></div>
      <div style={css('padding: 10px 8px 12px 14px; display: flex; flex-direction: column; gap: 4px;')}>
        <div style={css('display: flex; align-items: center; gap: 8px;')}>
          <h3 style={css('flex: 1; min-width: 0; margin: 0; font-weight: 700; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>{tp.name}</h3>
          <button type="button" className="wf-k" disabled={busy} aria-label={'Use the ' + tp.name + ' template'} onClick={() => onUse(tp)}
            style={css('height: ' + H.touch + 'px; flex: none; margin-right: 6px; border: 0; border-radius: ' + R.small + 'px; padding: 0 14px; background: ' + T.accent + '; color: ' + T.accentInk + '; font-weight: 600; font-size: 13px;' + (busy ? ' opacity: .6;' : ''))}>{busy ? 'Adding…' : HUB.use}</button>
        </div>
        <p style={css('margin: 0; font-size: 13px; color: ' + T.ink3 + '; line-height: 1.45; padding-right: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;')}>{tp.desc}</p>
        <p style={css('margin: 0; font-size: 12px; color: ' + T.muted + ';')}>Needs {tp.needs.join(', ')}</p>
      </div>
    </article>
  );
}

// ---------- The hub ----------
export default function WorkflowHub({ D, A, s, set }) {
  const now = useMemo(() => new Date(), [D.automations, D.automationRuns]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const timer = useRef(null);
  const say = (text) => { setToast(text); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 4000); };
  useEffect(() => () => clearTimeout(timer.current), []);

  const TABS = ['workflows', 'templates', 'runs', 'approvals', 'connectors', 'settings'];
  const tab = TABS.includes(s.autoTab) ? s.autoTab : 'workflows';
  const FILTERS = ['all', 'live', 'off', 'draft', 'assistant'];
  const filter = FILTERS.includes(s.autoSt) ? s.autoSt : 'all';
  const q = (s.autoQ || '').trim().toLowerCase();
  const autoSet = (D.settings || {}).automation || {};

  const connected = useMemo(() => workflowConnections(D), [D]);
  const flows = useMemo(() => (D.automations || []).map((a) => ({ ...workflowOf(a, connected), raw: a })), [D.automations, connected]);
  const templates = useMemo(() => TEMPLATES.map((tp) => ({ ...tp, preview: workflowOfTemplate(tp) })), []);
  const inFilter = (w, f) => f === 'all' || (f === 'assistant' ? w.fromAgent : w.status === f);
  const count = (f) => flows.filter((w) => inFilter(w, f)).length;
  const words = (w) => (w.name + ' ' + w.steps.map((x) => x.title + ' ' + x.chip + (x.br ? ' ' + x.br.yesLabel + ' ' + x.br.noLabel : '')).join(' ')).toLowerCase();
  const shown = flows.filter((w) => inFilter(w, filter) && (!q || words(w).includes(q)));

  // Runs
  const allRuns = D.automationRuns || [];
  const realRuns = allRuns.filter((r) => !r.is_test);
  const monday = weekStart(now);
  const week = realRuns.filter((r) => new Date(r.created_at) >= monday);
  const failedWeek = week.filter((r) => r.status === 'failed').length;
  const nameOf = {}, totalOf = {};
  (D.automations || []).forEach((a) => { nameOf[a.id] = a.name; totalOf[a.id] = isGraph(a.flow) ? stepCount(graphOf(a)) : (Array.isArray(a.actions) ? a.actions.length : 0); });
  const rf = ['all', 'passed', 'failed', 'test'].includes(s.runSt) ? s.runSt : 'all';
  const runIn = (r, k) => (k === 'all' ? true : k === 'test' ? !!r.is_test : !r.is_test && runState(r) === k);
  const runs = allRuns.filter((r) => runIn(r, rf));

  // Connectors: every integration, and which workflows need it.
  const conns = (D.integrations || []).map((g) => {
    const usedBy = flows.filter((w) => w.needs.includes(g.provider));
    const state = g.status === 'connected' ? (g.last_error ? 'error' : 'connected') : 'not_connected';
    return { key: g.provider, name: g.name, state, usedBy, managed: !!providerById(g.provider) };
  });
  const connectedN = conns.filter((c) => c.state === 'connected').length;
  // Connect and Manage open the app on the Connectors page (workflow/Connectors.jsx).
  const goConnect = (provider) => set({ autoConn: provider });
  const appr = approvalsOf(D);
  const decide = async (a, decision) => {
    if (busy) return;
    setBusy(a.id);
    const ok = await A.decideApproval(a.id, decision);
    setBusy('');
    if (ok) say(decision === 'approve' ? 'Approved. ' + a.workflow + ' continues.' : 'Rejected. The run stopped.');
  };

  // The one blocking issue: the unconnected app the most live or draft workflows wait on.
  const alertHit = conns.filter((c) => c.state !== 'connected' && c.usedBy.some((w) => w.status !== 'off')).sort((x, y) => y.usedBy.length - x.usedBy.length)[0];
  const alertIds = new Set(alertHit ? alertHit.usedBy.map((w) => w.id) : []);
  const alertFails = realRuns.filter((r) => alertIds.has(r.automation_id) && r.status === 'failed' && now - new Date(r.created_at) < 86400000);
  const alert = alertHit ? { ...alertHit, failed: alertFails.length, failedRun: alertFails.length ? alertFails[0].id : '' } : null;

  const open = (id) => {
    const row = (D.automations || []).find(a => a.id === id);
    set({ flowOpen:row?.revision_applied_at ? row.revision_source_id : id });
  };
  const pickTab = (k, more) => set({ autoTab: k, ...(more || {}) });
  const toggle = async (w) => {
    if (w.raw.revision_applied_at) { open(w.id); return; }
    const on = w.status === 'live';
    // Turning on a workflow that is not ready goes to the builder's Review and turn on instead (handoff Rule 3).
    // The same goes for one with no passing test since its last edit (Rule 4), or one that sends outside the team (Rule 5).
    if (!on && (w.raw.revision_source_id || w.fixes.length || !(w.lastTest && w.lastTest.ok) || w.sendsOut)) { set({ flowOpen: w.id, flowReview: true }); return; }
    const ok = await A.updateAutomation(w.raw, { enabled: !on, is_draft: false, updated_at: new Date().toISOString() }, (on ? 'turned off' : 'turned on') + ' the automation');
    if (ok) say(w.name + (on ? ' is off' : ' is live'));
  };
  const useTemplate = async (tp) => {
    if (busy) return;
    setBusy(tp.id);
    const row = await A.saveFlow(null, graphFromTemplate(tp), { name: tp.name, category: tp.category });
    setBusy('');
    if (row) set({ flowOpen: row.id });
  };
  const remove = (w) => { A.deleteAutomation(w.raw); say(w.name + ' was deleted'); };

  const stats = [
    { label: 'Live workflows', value: count('live'), sub: count('draft') + (count('draft') === 1 ? ' draft, ' : ' drafts, ') + count('off') + ' off', go: () => pickTab('workflows', { autoSt: 'live' }) },
    { label: 'Runs this week', value: week.length, sub: week.filter((r) => r.status === 'done').length + ' passed', go: () => pickTab('runs', { runSt: 'all' }) },
    { label: 'Failed this week', value: failedWeek, sub: failedWeek ? 'View failed runs' : 'Nothing failed', red: failedWeek > 0, go: () => pickTab('runs', { runSt: failedWeek ? 'failed' : 'all' }) },
    { label: 'Waiting on approval', value: appr.length, sub: appr.length ? 'Review the queue' : 'Queue is clear', go: () => pickTab('approvals') },
  ];
  const tabs = [['workflows', flows.length], ['templates', templates.length], ['runs', realRuns.length], ['approvals', appr.length], ['connectors', connectedN + ' of ' + conns.length], ['settings', null]];
  const tabKey = (e) => {
    const i = TABS.indexOf(tab), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = TABS[(i + d + TABS.length) % TABS.length];
    pickTab(next);
    requestAnimationFrame(() => { const el = document.getElementById('wf-tab-' + next); if (el) el.focus(); });
  };
  const pill = (on) => 'height: 38px; padding: 0 12px; border-radius: 999px; background: ' + (on ? T.count : T.surface) + '; color: ' + T.ink + '; border: 1px solid ' + (on ? T.pillOn : T.line) + '; font-weight: ' + (on ? 600 : 500) + '; font-size: 14px; display: flex; align-items: center; gap: 8px;';
  const pillCount = 'background: ' + T.countIn + '; border-radius: 999px; padding: 1px 7px; font-size: 12px; font-weight: 600;';
  const tplGrid = (list) => <div className="wf-grid">{list.map((tp) => <TemplateCard key={tp.id} tp={tp} busy={busy === tp.id} onUse={useTemplate} />)}</div>;

  return (
    <div className="wf" style={css('display: flex; flex-direction: column; gap: 24px; min-width: 0; color: ' + T.ink + ';')}>
      <style>{WF_CSS}</style>

      {alert ? (
        <div role="alert" style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 14px 12px 16px; border-radius: ' + R.card + 'px; background: ' + T.errorBg + '; border: 1px solid ' + T.errorLine + ';')}>
          <span aria-hidden="true" style={css('width: 8px; height: 8px; flex: none; border-radius: 999px; background: ' + T.error + ';')} />
          <span style={css('flex: 1 1 320px; font-size: 14px; line-height: 1.5; color: ' + T.errorInk + ';')}>
            <span style={css('font-weight: 700;')}>{alert.name} is not connected.</span>{' '}
            {alert.usedBy.length} {alert.usedBy.length === 1 ? 'workflow uses' : 'workflows use'} it{alert.failed ? ' and ' + alert.failed + (alert.failed === 1 ? ' run' : ' runs') + ' failed in the last day' : ''}.
          </span>
          {alert.failed ? <button type="button" className="wf-h" onClick={() => set({ autoRun: alert.failedRun })} style={css(btn('ghost'))}>View failed run</button> : null}
          <button type="button" className="wf-k" onClick={() => goConnect(alert.key)} style={css(btn('primary'))}>Connect {alert.name}</button>
        </div>
      ) : null}
      {autoSet.paused ? (
        <div role="status" style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 14px 12px 16px; border-radius: ' + R.card + 'px; background: ' + T.warnBg + '; color: ' + T.warnInk + ';')}>
          <span style={css('flex: 1 1 240px; font-size: 14px; font-weight: 600;')}>{HUB.paused}</span>
          <button type="button" className="wf-h" onClick={() => A.updateSettings({ automation: { ...autoSet, paused: false } }, 'resumed', 'all automations')} style={css(btn('ghost'))}>Resume all</button>
        </div>
      ) : null}

      <div className="wf-stats">
        {stats.map((st) => (
          <button key={st.label} type="button" className="wf-c" onClick={st.go} style={css('text-align: left; background: ' + T.surface + '; border: 1px solid ' + T.border + '; border-radius: ' + R.card + 'px; padding: 18px 20px; display: flex; flex-direction: column; gap: 6px; color: ' + T.ink + ';')}>
            <span style={css('font-size: 13px; font-weight: 500; color: ' + T.sub + ';')}>{st.label}</span>
            <span style={css('font-family: ' + FONT.display + '; font-weight: 900; font-size: 30px; line-height: 1.2; font-variant-numeric: tabular-nums; color: ' + (st.red ? T.error : T.ink) + ';')}>{st.value}</span>
            <span style={css('display: flex; align-items: center; gap: 6px; font-size: 13px; color: ' + T.muted + ';')}>{st.sub}<Svg d={CHEV} sw={2.4} /></span>
          </button>
        ))}
      </div>

      <div className="wf-cq"><div className="wf-bar" style={css('border-bottom: 1px solid ' + T.border + ';')}>
        <div role="tablist" aria-label="Automation sections" onKeyDown={tabKey}>
          {tabs.map(([k, n]) => {
            const on = tab === k, hot = k === 'approvals' && n > 0;
            return (
              <button key={k} type="button" role="tab" id={'wf-tab-' + k} aria-selected={on} aria-controls="wf-panel" tabIndex={on ? 0 : -1} onClick={() => pickTab(k)}
                style={css('height: 46px; padding: 0 10px; margin-bottom: -1px; background: transparent; border: 0; border-bottom: 2px solid ' + (on ? T.ink : 'transparent') + '; color: ' + (on ? T.ink : T.sub) + '; font-weight: ' + (on ? 600 : 500) + '; font-size: 15px; display: flex; flex: none; align-items: center; gap: 8px; white-space: nowrap;')}>
                {HUB.tabs[k]}
                {n === null ? null : <span style={css('background: ' + (hot ? T.accent : T.count) + '; color: ' + (hot ? T.accentInk : T.countInk) + '; border-radius: 999px; padding: 2px 8px; font-size: 12px; font-weight: 600;')}>{n}</span>}
              </button>
            );
          })}
        </div>
        {tab === 'workflows' ? (
          <>
            <label htmlFor="wf-q" style={css(srOnly)}>{HUB.search}</label>
            <input id="wf-q" type="search" value={s.autoQ || ''} onChange={(e) => set({ autoQ: e.target.value })} placeholder={HUB.search}
              style={css('height: 42px; border-radius: ' + R.control + 'px; background: ' + T.ground2 + '; border: 1px solid ' + T.line + '; padding: 0 14px; font-family: inherit; font-size: 14px; color: ' + T.ink + '; margin-bottom: 6px;')} />
          </>
        ) : null}
      </div></div>

      <div id="wf-panel" role="tabpanel" aria-labelledby={'wf-tab-' + tab} style={css('display: flex; flex-direction: column; gap: 20px; min-width: 0;' + (tab === 'settings' ? ' display: none;' : ''))}>
        {tab === 'workflows' ? (
          <>
            <div role="group" aria-label="Workflow status" style={css('display: flex; flex-wrap: wrap; gap: 6px; align-items: center;')}>
              <span style={css('font-size: 14px; color: ' + T.sub + '; margin-right: 4px;')}>Status</span>
              {FILTERS.map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => set({ autoSt: f })} style={css(pill(filter === f))}>{HUB.filters[f]}<span style={css(pillCount)}>{count(f)}</span></button>
              ))}
            </div>
            {shown.length ? (
              <div className="wf-grid">{shown.map((w) => <WorkflowCard key={w.id} w={w} now={now} open={open} onToggle={toggle} onDelete={remove} />)}</div>
            ) : flows.length ? (
              <div style={css(dashed)}>{HUB.none}{' '}<button type="button" className="wf-l" onClick={() => set({ autoSt: 'all', autoQ: '' })} style={css('padding: 0; border: 0; background: transparent; font: inherit; font-weight: 600; color: ' + T.link + '; text-decoration: underline;')}>{HUB.clear}</button></div>
            ) : <div style={css(dashed)}>{HUB.noWorkflows}</div>}
            <div style={css('margin-top: 8px;')}>
              <h2 style={css('margin: 0; font-family: ' + FONT.display + '; font-weight: 900; font-size: 20px;')}>{HUB.templatesTitle}</h2>
              <p style={css('margin: 4px 0 0; font-size: 14px; color: ' + T.sub + ';')}>{HUB.templatesSub}</p>
            </div>
            {tplGrid(flows.length ? templates.slice(0, 3) : templates)}
          </>
        ) : null}

        {tab === 'templates' ? tplGrid(templates) : null}

        {tab === 'runs' ? (
          <>
            <div role="group" aria-label="Run result" style={css('display: flex; flex-wrap: wrap; gap: 6px; align-items: center;')}>
              {[['all', 'All'], ['passed', 'Passed'], ['failed', 'Failed'], ['test', 'Tests']].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={rf === k} onClick={() => set({ runSt: k })} style={css(pill(rf === k))}>{l}<span style={css(pillCount)}>{allRuns.filter((r) => runIn(r, k)).length}</span></button>
              ))}
            </div>
            {runs.length ? (
              <div style={css('overflow-x: auto; border: 1px solid ' + T.border + '; border-radius: ' + R.card + 'px;')}>
                <table style={css('width: 100%; min-width: 760px; border-collapse: collapse; font-size: 14px;')}>
                  <thead>
                    <tr style={css('text-align: left; font-size: 13px; color: ' + T.sub + '; background: ' + T.ground + ';')}>
                      {['Workflow', 'Started', 'Time', 'Steps', 'Result'].map((h) => <th key={h} scope="col" style={css('padding: 12px 16px; font-weight: 600;')}>{h}</th>)}
                      <th scope="col" style={css('padding: 12px 16px;')}><span style={css(srOnly)}>Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.slice(0, s.runMore ? 150 : 40).map((r) => {
                      const st = runState(r), tone = RUN_TONE[st], out = r.output || {}, steps = out.steps || [];
                      const total = Math.max(steps.length, totalOf[r.automation_id] || 0);
                      const note = (out.project && out.project.title) || (out.idea && out.idea.title) || (st === 'failed' ? r.error : '') || out.trigger || '';
                      return (
                        <Fragment key={r.id}>
                          <tr style={css('border-top: 1px solid ' + T.line + ';')}>
                            <td style={css('padding: 12px 16px; font-weight: 600;')}>
                              <a href={'/admin/automations/runs/' + r.id} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); set({ autoRun: r.id }); }} style={css('color: ' + T.ink + '; text-decoration: none;')}>{nameOf[r.automation_id] || 'Deleted workflow'}</a>{r.is_test ? <span style={css('margin-left: 8px; font-size: 12px; font-weight: 600; color: ' + T.muted + ';')}>Test</span> : null}
                              {note ? <div style={css('font-weight: 400; font-size: 13px; color: ' + (st === 'failed' && !out.project ? T.error : T.muted) + '; margin-top: 2px;')}>{note}</div> : null}
                            </td>
                            <td style={css('padding: 12px 16px; color: ' + T.ink2 + '; white-space: nowrap;')}>{cap(whenText(r.created_at, now))}</td>
                            <td style={css('padding: 12px 16px; color: ' + T.ink2 + '; white-space: nowrap;')}>{tookText(runMs(r)) || '–'}</td>
                            <td style={css('padding: 12px 16px; color: ' + T.ink2 + '; white-space: nowrap;')}>{total ? steps.filter((x) => x.ok).length + ' of ' + total : '–'}</td>
                            <td style={css('padding: 12px 16px;')}><span style={css('background: ' + tone[1] + '; color: ' + tone[0] + '; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; white-space: nowrap;')}>{RUN_STATUS[st]}</span></td>
                            <td style={css('padding: 8px 16px;')}>
                              <div style={css('display: flex; gap: 8px; justify-content: flex-end;')}>
                                {r.status === 'failed' && !r.is_test ? <button type="button" className="wf-h" onClick={() => A.retryRun(r)} style={css(btn('ghost', 38) + ' font-size: 13px;')}>Retry</button> : null}
                                <button type="button" className="wf-h" aria-label={'View run of ' + (nameOf[r.automation_id] || 'deleted workflow')} onClick={() => set({ autoRun: r.id })} style={css(btn('ghost', 38) + ' font-size: 13px;')}>View run</button>
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div style={css(dashed)}>{HUB.noRuns}</div>}
            {runs.length > 40 && !s.runMore ? <button type="button" className="wf-h" onClick={() => set({ runMore: true })} style={css(btn('ghost') + ' align-self: flex-start;')}>Show more runs</button> : null}
          </>
        ) : null}

        {tab === 'approvals' ? (
          <div style={css('display: flex; flex-direction: column; gap: 12px;')}>
            {appr.map((a) => (
              <article key={a.id} style={css('border: 1px solid ' + T.border + '; border-radius: ' + R.card + 'px; background: ' + T.surface + '; padding: 18px; display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start;')}>
                <div style={css('flex: 1 1 380px; display: flex; flex-direction: column; gap: 8px; min-width: 0;')}>
                  <div style={css('display: flex; gap: 10px; flex-wrap: wrap; align-items: center;')}>
                    <span style={css('background: ' + T.warnBg + '; color: ' + T.warnInk + '; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 600;')}>Waiting on you</span>
                    <span style={css('font-size: 13px; color: ' + T.muted + ';')}>{a.workflow} · {span(now - new Date(a.waitingSince))} ago</span>
                  </div>
                  <a href={'/admin/automations/approvals/' + a.id} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); set({ autoAppr: a.id }); }} style={css('font-weight: 700; font-size: 16px; color: ' + T.ink + '; text-decoration: none; overflow-wrap: anywhere;')}>{a.title}</a>
                  <div style={css('background: ' + T.ground2 + '; border-radius: 12px; padding: 12px 14px; font-size: 14px; line-height: 1.55; color: ' + T.ink2 + '; white-space: pre-line; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;')}>{(a.draft && a.draft.body) || a.reason}</div>
                </div>
                <div style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
                  <button type="button" className="wf-k" disabled={busy === a.id} onClick={() => decide(a, 'approve')} style={css(btn('primary') + ' padding: 0 16px;')}>{a.draft ? 'Approve and send' : 'Approve'}</button>
                  <button type="button" className="wf-h" onClick={() => set({ autoAppr: a.id })} style={css(btn('ghost') + ' padding: 0 16px;')}>Review and edit</button>
                  <button type="button" className="wf-h" disabled={busy === a.id} onClick={() => decide(a, 'reject')} style={css(btn('danger') + ' padding: 0 16px;')}>Reject</button>
                </div>
              </article>
            ))}
            {!appr.length ? <div style={css(dashed)}>{HUB.noApprovals}</div> : null}
          </div>
        ) : null}

        {tab === 'connectors' ? (
          <div style={css('display: flex; flex-direction: column; gap: 14px;')}>
            <div style={css('display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px;')}>
              <span style={css('font-size: 14px; color: ' + T.sub + ';')}>{HUB.connectorsNote}</span>
              <button type="button" className="wf-h" onClick={() => set({ autoConn: true })} style={css(btn('ghost'))}>{HUB.manageConnectors}<Svg d={CHEV} sw={2.4} /></button>
            </div>
            <div style={css('display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px;')}>
              {conns.map((c) => {
                const tone = c.state === 'connected' ? T.live : c.state === 'error' ? T.error : T.muted;
                return (
                  <article key={c.key} style={css('border: 1px solid ' + T.border + '; border-radius: ' + R.card + 'px; background: ' + T.surface + '; padding: 16px; display: flex; flex-direction: column; gap: 10px;')}>
                    <div style={css('display: flex; justify-content: space-between; align-items: center; gap: 8px;')}>
                      <h3 style={css('margin: 0; font-weight: 700; font-size: 16px;')}><a href={'/admin/automations/connectors?app=' + encodeURIComponent(c.key)} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); goConnect(c.key); }} style={css('color: ' + T.ink + '; text-decoration: none;')}>{c.name}</a></h3>
                      <span style={css('display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; color: ' + tone + ';')}><span aria-hidden="true" style={css('width: 8px; height: 8px; border-radius: 999px; background: ' + (c.state === 'not_connected' ? T.pillOn : tone) + ';')} />{c.state === 'connected' ? 'Connected' : c.state === 'error' ? 'Needs attention' : 'Not connected'}</span>
                    </div>
                    <div style={css('font-size: 13px; color: ' + T.muted + ';')}>{c.usedBy.length ? 'Used by ' + c.usedBy.length + (c.usedBy.length === 1 ? ' workflow' : ' workflows') : 'Not in use'}</div>
                    {c.managed ? (
                      <button type="button" className={c.state === 'connected' ? 'wf-h' : 'wf-k'} aria-label={(c.state === 'connected' ? 'Manage ' : c.state === 'error' ? 'Reconnect ' : 'Connect ') + c.name} onClick={() => goConnect(c.key)} style={css(btn(c.state === 'connected' ? 'ghost' : 'primary', H.secondary))}>{c.state === 'connected' ? 'Manage' : c.state === 'error' ? 'Reconnect' : 'Connect'}</button>
                    ) : <span style={css('height: ' + H.secondary + 'px; display: flex; align-items: center; font-size: 13px; color: ' + T.muted + ';')}>Coming soon</span>}
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div aria-live="polite" style={css('position: fixed; left: 50%; bottom: 24px; z-index: 60; transform: translateX(-50%); max-width: calc(100vw - 32px);')}>
        {toast ? (
          <div style={css('display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 16px; border-radius: ' + R.control + 'px; background: ' + T.accent + '; color: ' + T.accentInk + '; font-size: 14px; font-weight: 500; box-shadow: ' + SHADOW.toast + ';')}>
            <span>{toast}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setToast('')} style={css('width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: inherit; display: flex; align-items: center; justify-content: center;')}><Svg d="M18 6 6 18M6 6l12 12" size={14} /></button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
