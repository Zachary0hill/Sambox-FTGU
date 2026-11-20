// A stored automation run (automation_runs, written by lib/automations/run.ts) as the Run in the data contract: its
// state, one row per step with what it received and returned, and the run log. Shared by the hub's Run history tab
// and the run detail page.
import { actionById, actionsOf, triggerOf, triggerText } from '../automations/catalog';
import { isGraph, graphOf } from '../automations/graph';
import { TRIGGER_COPY, VAR_LABEL } from './copy';
import { stepOf } from './graph';

// Stored status → the neutral state. A run parked on a delay is a retry with output.waiting.
export const isWaiting = (r) => r.status === 'retry' && !!(r.output && r.output.waiting);
export const runState = (r) => (r.status === 'done' ? 'passed' : r.status === 'failed' ? 'failed' : isWaiting(r) ? 'waiting' : r.status === 'retry' ? 'retry' : r.status === 'skipped' ? 'skipped' : r.status === 'test' ? 'passed' : 'running');
export const isActive = (r) => r.status === 'queued' || r.status === 'running' || (r.status === 'retry' && !isWaiting(r));

export const tookText = (ms, long) => {
  if (ms == null || ms < 0 || Number.isNaN(ms)) return '';
  if (ms < 60000) { const s = (ms / 1000).toFixed(1); return long ? s + (s === '1.0' ? ' second' : ' seconds') : s + 's'; }
  const m = Math.round(ms / 60000);
  return long ? m + (m === 1 ? ' minute' : ' minutes') : m + ' min';
};
export const runMs = (r) => (r.finished_at && r.started_at ? new Date(r.finished_at) - new Date(r.started_at) : null);

const STEP_L = { task: 'Task', delay: 'Wait', split: 'Branch', data: 'Board data', filter: 'Only when' };
// A message template in plain words: typed text with each data chip by its name.
const plain = (text) => String(text || '').replace(/\{\{\s*([a-z_.]+)(?:\s*\|[^}]*)?\}\}/gi, (_, k) => '[' + (VAR_LABEL[k.toLowerCase()] || k) + ']').trim();

// a: the run's automations row, or null when the workflow was deleted.
export function runView(r, a) {
  const out = r.output || {};
  const recs = out.steps || [];
  const used = new Set();
  const rec = (id) => { const x = recs.find((y) => (y.id || y.action) === id); if (x) used.add(x); return x || null; };
  const state = runState(r);
  const over = !isActive(r) && state !== 'waiting';
  const subject = out.project ? out.project.title + (out.project.job ? ' (' + out.project.job + ')' : '') : out.idea ? out.idea.title : '';
  const trig = a ? (isGraph(a.flow) ? graphOf(a).trigger : triggerOf(a.trigger)) : { key: r.trigger_key || '', value: '' };
  const tKey = trig.key || r.trigger_key || '';

  // The steps this run walks: the graph's, following the branch paths it took; or the actions of an older workflow.
  const plan = [];
  if (a && isGraph(a.flow)) {
    const walk = (list) => list.forEach((n) => {
      if (n.type === 'note') return;
      plan.push(n);
      if (n.type === 'split') { const p = (n.paths || []).find((x) => x.id === (out.paths || {})[n.id]); if (p) walk(p.steps); }
    });
    walk(graphOf(a).steps);
  } else if (a) {
    const seen = {};
    actionsOf(a.actions).forEach((x) => { seen[x.key] = (seen[x.key] || 0) + 1; plan.push({ id: seen[x.key] === 1 ? x.key : x.key + ':' + seen[x.key], type: 'action', key: x.key, message: x.message, tags: [] }); });
  }

  const filter = rec('trigger');
  const rows = [{
    id: 'trigger', kind: 'trigger', kindLabel: 'Trigger', title: (TRIGGER_COPY[tKey] || [triggerText(tKey, '') || 'Trigger'])[0], app: tKey === 'schedule' ? 'Schedule' : tKey === 'webhook' ? 'Webhook' : 'Board',
    state: state === 'skipped' && !recs.some((x) => x.id !== 'trigger') ? 'skip' : 'ok', ms: null, needs: '',
    error: state === 'skipped' ? r.error || 'The run was skipped.' : '',
    received: [], returned: [['What happened', out.trigger || triggerText(tKey, trig.value)]].concat(subject ? [[out.idea ? 'Idea' : 'Project', subject]] : [], filter ? [['Only when', filter.detail]] : []),
  }];
  let stopped = false;
  plan.forEach((n) => {
    const v = stepOf(n);
    const x = rec(n.id);
    const def = n.type === 'action' ? actionById(n.key) : null;
    const given = (x && x.received) || [].concat(subject ? [[out.idea ? 'Idea' : 'Project', subject]] : [], n.message && def && def.message ? [[def.message, plain(n.message)]] : [], n.type === 'task' && n.title ? [['Task', plain(n.title)]] : []);
    // A step with no record: passed over silently by an older runner if a later step ran, else not reached.
    const later = !x && plan.slice(plan.indexOf(n) + 1).some((m) => recs.some((y) => (y.id || y.action) === m.id));
    let st = x ? (x.ok ? 'ok' : 'fail') : later || (over && state === 'passed') ? 'ok' : over ? 'skip' : stopped ? 'wait' : r.status === 'running' ? 'run' : 'wait';
    if (!x && !later && !over) stopped = true;
    // A parked run: the step it is parked on is on hold (a delay, or an approval waiting for a Super Admin).
    const askHere = !!(out.approval && out.approval.stepId === n.id);
    if (state === 'waiting' && !x && st !== 'ok') st = (askHere || (!out.approval && (out.waited || []).includes(n.id))) && !rows.some((y) => y.state === 'hold') ? 'hold' : 'wait';
    rows.push({
      id: n.id, kind: v.kind, kindLabel: v.kindLabel, title: v.title, app: v.app, needs: v.needs, state: st, ms: x && x.ms != null ? x.ms : null,
      error: x && !x.ok ? x.detail : '', received: given, returned: x && x.ok ? [['Result', x.detail]] : null, approval: askHere && st === 'hold',
    });
  });
  // Records for steps the workflow no longer has (it was edited or deleted since the run).
  recs.filter((x) => !used.has(x)).forEach((x, i) => {
    rows.push({ id: (x.id || x.action) + ':' + i, kind: 'action', kindLabel: 'Step', title: (actionById(x.action) || {}).label || STEP_L[x.action] || 'Step', app: (actionById(x.action) || {}).app || '', needs: (actionById(x.action) || {}).needs || '',
      state: x.ok ? 'ok' : 'fail', ms: x.ms != null ? x.ms : null, error: x.ok ? '' : x.detail, received: x.received || [], returned: x.ok ? [['Result', x.detail]] : null });
  });

  // The stored log; runs from before it was recorded get one rebuilt from what the run kept.
  const log = Array.isArray(out.log) && out.log.length ? out.log : [
    { at: r.created_at, text: 'Queued: ' + (out.trigger || triggerText(tKey, trig.value)) + (subject ? ' on ' + subject : '') },
    ...recs.map((x) => ({ at: x.at || '', text: x.detail, ...(x.ok ? {} : { level: 'error' }) })),
    ...(r.finished_at ? [{ at: r.finished_at, text: state === 'passed' ? 'Run finished.' : state === 'failed' ? 'Run failed' + (r.error && !recs.some((x) => !x.ok) ? ': ' + r.error : '.') : 'Run skipped' + (r.error ? ': ' + r.error : '.'), ...(state === 'failed' ? { level: 'error' } : {}) }] : []),
  ];
  return {
    state, rows, log, subject, passed: rows.filter((x) => x.state === 'ok').length, total: rows.length,
    summary: (subject ? subject + ': ' : '') + (out.trigger || triggerText(tKey, trig.value)), error: r.error || '',
    failedId: (rows.find((x) => x.state === 'fail') || {}).id || '',
  };
}
