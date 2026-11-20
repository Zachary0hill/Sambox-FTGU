// The workflow graph the builder screens read (handoff HANDOFF.md § Data contract), and the adapter that builds it
// from a stored automation row. The row keeps its own shape (automations.flow is lib/automations/graph.ts Graph v2,
// or preview columns on rows from before the builder); nothing here writes. Shapes, as JSDoc instead of TypeScript:
//
// @typedef {{ id: string, name: string, description: string, owner: string, status: 'live'|'off'|'draft', runs: boolean,
//   fromAgent: boolean, trigger: Trigger, steps: Step[], settings: Settings, lastTest: object|null, updatedAt: string,
//   lastRunAt: string|null, fixes: Fix[], apps: string[], needs: string[] }} Workflow
// @typedef {{ type: 'schedule'|'event'|'webhook', key: string, value: string, filters: Filter[], schedule?: { rule: string, tz: string } }} Trigger
// @typedef {{ field: string, op: string, value: string }} Filter
// @typedef {{ id: string, kind: 'trigger'|'data'|'action'|'logic'|'ai'|'human', kindLabel: string, title: string, chip: string,
//   desc: string, app: string, needs: string, outward: boolean, fields: Field[], br?: { yes: Step[], no: Step[], yesLabel: string, noLabel: string } }} Step
// @typedef {{ label: string, value: string, vars: VarRef[], required: boolean }} Field
// @typedef {{ id: string, label: string, fromStepId: string }} VarRef   rendered as a named chip, never as a raw path
// @typedef {{ retries: number, retryWait: '1m'|'5m'|'15m', alert: string[], autoOffAfter: number, approvalTimeoutHours: number }} Settings
// @typedef {{ id: string, title: string, body: string }} Fix
import { actionById, triggerText } from '../automations/catalog';
import { graphOf, issuesOf, delayText, newId, NEW_SETTINGS } from '../automations/graph';
import { KIND_LABEL, STEP_COPY, NODE_COPY, TRIGGER_COPY, VAR_LABEL, triggerChip } from './copy';

export const DEFAULT_SETTINGS = { retries: 1, retryWait: '5m', alert: [], autoOffAfter: 3, approvalTimeoutHours: 24 };

// A message as typed text plus its data chips, in order (open question 2: chips sit after the text).
export function fieldOf(label, text, required) {
  const vars = [];
  const value = String(text || '').replace(/\{\{\s*([a-z_.]+)(?:\s*\|[^}]*)?\}\}/gi, (_, k) => {
    const id = k.toLowerCase();
    vars.push({ id, label: VAR_LABEL[id] || id.split('.').pop().replace(/_/g, ' '), fromStepId: id.startsWith('project.') || id.startsWith('idea.') ? 'trigger' : '' });
    return '';
  }).replace(/\s{2,}/g, ' ').trim();
  return { label, value, vars, required: !!required };
}

// One stored node (lib/automations/graph.ts Node) as a Step.
export function stepOf(n) {
  const base = { id: n.id, fields: [], outward: false, needs: '', app: '' };
  if (n.type === 'action') {
    const def = n.key ? actionById(n.key) : null;
    const c = STEP_COPY[n.key] || { kind: 'action', title: (def && def.label) || 'Choose an action', chip: (def && def.label) || 'Choose an action', desc: '' };
    return { ...base, kind: c.kind, kindLabel: KIND_LABEL[c.kind], title: n.title || c.title, chip: n.title || c.chip, desc: c.desc, app: def ? def.app : '',
      needs: (def && def.needs) || '', outward: !!c.outward, fields: def && def.message ? [fieldOf(def.message, n.message, false)] : [] };
  }
  const c = NODE_COPY[n.type] || NODE_COPY.note;
  const step = { ...base, kind: c.kind, kindLabel: c.label || KIND_LABEL[c.kind], title: n.title || n.name || c.title, chip: n.title || n.name || c.title, desc: n.note || c.desc, app: c.kind === 'logic' ? 'Logic' : c.kind === 'ai' ? 'Assistant' : c.kind === 'human' ? 'Team' : 'Board' };
  if (n.type === 'delay') { step.title = delayText(n); step.chip = step.title; }
  if (n.type === 'split') {
    const paths = n.paths || [];
    const yes = paths[0], no = paths.length > 1 ? paths[paths.length - 1] : null;
    const lane = (p) => (p && p.steps && p.steps.length ? stepOf(p.steps[0]).chip : 'Continue');
    step.br = { yes: yes ? yes.steps.map(stepOf) : [], no: no ? no.steps.map(stepOf) : [], yesLabel: lane(yes), noLabel: lane(no) };
  }
  return step;
}

// The draft line under a card's name: the first thing in the way of turning it on, in plain words.
export function reasonOf(fixes) {
  const f = fixes[0];
  if (!f) return 'Ready to test';
  if (f.id === 'trigger') return 'Needs a trigger';
  if (f.id === 'end') return 'Needs a step';
  const m = /^Connect (.+)$/.exec(f.title);
  if (m) return m[1] + ' not connected';
  return f.title;
}

// row: an automations row. connected: { slack: true, … } by provider key.
export function workflowOf(row, connected = {}) {
  const g = graphOf(row);
  const runs = g.kind === 'automation';
  const t = g.trigger;
  const steps = [{
    id: 'trigger', kind: 'trigger', kindLabel: KIND_LABEL.trigger, fields: [], outward: false, needs: '', app: 'Board',
    title: runs ? (t.key ? (TRIGGER_COPY[t.key] || [triggerText(t.key, '')])[0] : 'Pick a trigger') : (t.text || 'Started by hand'),
    chip: runs ? (t.key ? triggerChip(t.key, t.value) : t.text || 'Pick a trigger') : (t.text || 'Started by hand'),
    desc: runs && t.key ? (TRIGGER_COPY[t.key] || ['', ''])[1] : '',
  }].concat(g.steps.map(stepOf));
  const fixes = issuesOf(g, connected).filter((x) => x.level === 'warn').map((x) => ({ id: x.id, title: x.title, body: x.body }));
  const apps = [], needs = [];
  let sendsOut = false;
  const visit = (list) => list.forEach((s) => {
    if (s.app && !apps.includes(s.app)) apps.push(s.app);
    if (s.needs && !needs.includes(s.needs)) needs.push(s.needs);
    if (s.outward) sendsOut = true;
    if (s.br) { visit(s.br.yes); visit(s.br.no); }
  });
  visit(steps);
  return {
    id: row.id, name: row.name, description: g.description || '', owner: g.owner || '', runs, mapKind: runs ? '' : g.kind,
    status: !runs ? 'off' : row.is_draft ? 'draft' : row.enabled ? 'live' : 'off',
    fromAgent: !!g.byAgent,
    trigger: { type: 'event', key: t.key, value: t.value, filters: t.key && t.value ? [{ field: t.key, op: 'is', value: t.value }] : [] },
    steps, settings: { ...DEFAULT_SETTINGS, ...(g.settings || {}) }, lastTest: g.lastTest || null,
    updatedAt: row.updated_at || row.created_at || '', lastRunAt: row.last_run_at || null, fixes, apps, needs, sendsOut,
  };
}

// Preview chips for a card: up to `max`, compressing the middle of a long flow rather than scrolling.
export function previewOf(steps, max = 7) {
  const chips = steps.map((s) => ({ id: s.id, kind: s.kind, text: s.chip, br: s.br ? { yes: s.br.yesLabel, no: s.br.noLabel } : null }));
  if (chips.length <= max) return chips;
  const head = Math.ceil((max - 1) / 2), tail = max - 1 - head;
  return chips.slice(0, head).concat([{ id: 'more', kind: 'more', text: (chips.length - head - tail) + ' more steps', br: null }], chips.slice(chips.length - tail));
}

// A stored graph (lib/automations/graph.ts) for a template, with fresh ids, ready for A.saveFlow.
export function graphFromTemplate(tp) {
  const node = (n) => {
    const out = { tags: [], ...n, id: newId() };
    if (n.type === 'split') out.paths = (n.paths || []).map((p) => ({ ...p, id: newId('p'), steps: (p.steps || []).map(node) }));
    return out;
  };
  return { v: 2, kind: 'automation', tags: [], template: tp.id, description: tp.desc, settings: { ...NEW_SETTINGS },
    trigger: { key: tp.trigger.key, value: tp.trigger.value || '', text: tp.trigger.text || '', tags: [] }, steps: tp.steps.map(node) };
}
// The same template as a Workflow for its preview (never saved).
export function workflowOfTemplate(tp) {
  const w = workflowOf({ id: tp.id, name: tp.name, flow: graphFromTemplate(tp), is_draft: true, enabled: false });
  if (tp.chip) w.steps[0].chip = tp.chip;
  return w;
}

// Small schema check for the API boundary and saves: returns a list of problems, empty when the graph is sound.
const NODE_TYPES = ['action', 'task', 'note', 'delay', 'split', 'data', 'ai', 'approval'];
export function checkGraph(g) {
  const bad = [];
  if (!g || typeof g !== 'object' || g.v !== 2) return ['Not a workflow graph.'];
  if (!['automation', 'process', 'idea'].includes(g.kind)) bad.push('Unknown kind.');
  if (!g.trigger || typeof g.trigger.key !== 'string') bad.push('The trigger is missing.');
  const seen = new Set();
  const visit = (list, where) => {
    if (!Array.isArray(list)) { bad.push(where + ' has no step list.'); return; }
    list.forEach((n) => {
      if (!n || typeof n.id !== 'string' || !n.id) { bad.push('A step in ' + where + ' has no id.'); return; }
      if (seen.has(n.id)) bad.push('Step id ' + n.id + ' is used twice.');
      seen.add(n.id);
      if (!NODE_TYPES.includes(n.type)) bad.push('Step ' + n.id + ' has an unknown type.');
      if (n.type === 'split') (n.paths || []).forEach((p) => visit(p.steps, 'path ' + (p.name || p.id)));
    });
  };
  visit(g.steps, 'the workflow');
  return bad;
}

// What rules check, from a board row (lib/studio/load.js), in the same keys the runner uses (lib/automations/run.ts
// valuesOf): ids for people, channel, type and sponsor; the label for a status; the stored key for an approval or
// editor status. Lets the builder say which projects a trigger or a branch rule matches right now.
const keyOf = (label) => String(label || '').trim().toLowerCase().replace(/\s+/g, '_') || null;
export const rowValues = (r) => (r ? {
  status: r.status || null, channel: r.channelId || null, type: r.typeId || null, sponsor: r.sponsorAccountId || null, approval: keyOf(r.approval),
  editor: r.editorId || null, edit_status: keyOf(r.editStatus), designer: r.designerId || null, publish_date: r.pub || null, thumb_status: keyOf(r.thumb),
} : null);
// Whether a row is in the state an event trigger fires on (its own value), for "would match now".
export function rowFitsTrigger(r, key, value) {
  const v = rowValues(r);
  if (!v || !value) return !!v;
  const field = { status: 'status', edit_status: 'edit_status', thumb_status: 'thumb_status', approval: 'approval' }[key];
  return !field || String(v[field] || '').toLowerCase() === String(value).toLowerCase();
}
