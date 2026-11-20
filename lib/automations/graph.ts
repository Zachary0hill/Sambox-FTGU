// The flow builder's graph (components/studio/FlowBuilder.jsx), shared with the runner (lib/automations/run.ts).
// A flow lives in automations.flow as { v: 2, kind, tags, trigger, steps }. Older rows keep flow as preview columns
// ([['t'], ['a']]) with the real work in trigger and actions; graphOf() turns those into a graph on open.
//
//   kind       automation  runs when its trigger fires (trigger keys from catalog.ts)
//              process     a documented process: manual tasks, notes and the actions it would take; never runs
//              idea        a brainstorm on the same canvas; never runs
//   steps      a tree: action, task, note and delay nodes in order; a split holds paths, each with its own steps.
//              Profiles of work (a project) take the first path whose criteria all match; the last path is
//              "Everyone else".
//   tags       links to dashboard data (projects, ideas, clients, people, statuses, channels, brands) and connector
//              data (connectors, YouTube videos, Buffer channels), on the flow and on any node.
//
// Messages can carry data tokens, {{project.title}} and friends, filled in when the step runs (fillTokens).

import { actionById, actionsOf, triggerOf, triggerText, hasNoProject, ACTIONS } from './catalog';

export type Kind = 'automation' | 'process' | 'idea';
export type TagType = 'project' | 'idea' | 'client' | 'person' | 'status' | 'channel' | 'brand' | 'connector' | 'video' | 'buffer';
export type Tag = { type: TagType; id: string; label: string };
export type Crit = { field: string; op: 'is' | 'is_not' | 'set' | 'empty'; value: string };
// A path is taken when its rules match: all of `when` (or any of them with match 'any'), or every rule of one of
// the `or` groups.
export type Path = { id: string; name: string; when: Crit[]; match?: 'all' | 'any'; or?: Crit[][]; steps: Node[] };
export type Node = {
  id: string; type: 'action' | 'task' | 'note' | 'delay' | 'split' | 'data' | 'ai' | 'approval'; tags: Tag[];
  key?: string; message?: string;                       // action
  title?: string; note?: string; owner?: string;        // task, note (owner: a member's user id)
  amount?: number; unit?: 'minutes' | 'hours' | 'days'; // delay
  name?: string; paths?: Path[];                        // split
  timeoutHours?: number;                                // approval: hours until it rejects itself (0: never)
};
// filters: "Only when" rules checked against the run's project before any step. tz: a schedule's timezone.
// secret: a webhook's optional key (the x-workflow-key header).
export type Trigger = { key: string; value: string; text: string; tags: Tag[]; filters?: Crit[]; tz?: string; secret?: string };
// Optional extras the workflow builder keeps with the graph (lib/workflow/graph.js): description, owner, per-workflow
// run settings, the last test result, whether Studio Assistant drafted it, and the template it started from.
export type GraphExtras = { description?: string; owner?: string; settings?: Record<string, unknown>; lastTest?: unknown; byAgent?: boolean; template?: string };
export type Graph = { v: 2; kind: Kind; tags: Tag[]; trigger: Trigger; steps: Node[] } & GraphExtras;

export const KINDS: [Kind, string, string][] = [
  ['automation', 'Automation', 'Runs on its own when the trigger fires'],
  ['process', 'Process', 'Maps a process step by step; nothing runs'],
  ['idea', 'Idea', 'A sketch to think through; nothing runs'],
];

export const TAG_TYPES: Record<TagType, { label: string; tone: string }> = {
  project: { label: 'Projects', tone: 'blue' }, idea: { label: 'Ideas', tone: 'amber' }, client: { label: 'Clients & sponsors', tone: 'coral' },
  person: { label: 'Team', tone: 'violet' }, status: { label: 'Statuses', tone: 'green' }, channel: { label: 'Channels', tone: 'pink' },
  brand: { label: 'Brands', tone: 'pink' }, connector: { label: 'Connectors', tone: 'blue' }, video: { label: 'YouTube videos', tone: 'red' },
  buffer: { label: 'Buffer channels', tone: 'violet' },
};

// Split criteria, checked against the run's project. Values come from the dashboard (ids, or labels for statuses).
export const FIELDS: { key: string; label: string; source?: 'status' | 'channel' | 'type' | 'client' | 'person' | 'approval' | 'edit_status'; ops: Crit['op'][] }[] = [
  { key: 'status', label: 'Status', source: 'status', ops: ['is', 'is_not'] },
  { key: 'channel', label: 'Channel', source: 'channel', ops: ['is', 'is_not'] },
  { key: 'type', label: 'Content type', source: 'type', ops: ['is', 'is_not'] },
  { key: 'sponsor', label: 'Sponsor', source: 'client', ops: ['is', 'is_not', 'set', 'empty'] },
  { key: 'approval', label: 'Sponsor approval', source: 'approval', ops: ['is', 'is_not'] },
  { key: 'editor', label: 'Editor', source: 'person', ops: ['is', 'is_not', 'set', 'empty'] },
  { key: 'edit_status', label: 'Editor status', source: 'edit_status', ops: ['is', 'is_not'] },
  { key: 'designer', label: 'Designer', source: 'person', ops: ['is', 'is_not', 'set', 'empty'] },
  { key: 'publish_date', label: 'Publishing date', ops: ['set', 'empty'] },
];
export const OPS: Record<Crit['op'], string> = { is: 'is', is_not: 'is not', set: 'is set', empty: 'is empty' };

// Data tokens for messages. The runner fills them from the run (lib/automations/run.ts).
export const TOKENS: [string, string][] = [
  ['project.title', 'Project title'], ['project.job', 'Job #'], ['project.status', 'Status'], ['project.channel', 'Channel'],
  ['project.publish_date', 'Publishing date'], ['project.link', 'Project link'], ['project.sponsor', 'Sponsor'],
  ['project.editor', 'Editor'], ['project.designer', 'Designer'], ['trigger', 'What happened'], ['flow.name', 'Flow name'], ['workspace.name', 'Workspace'],
];

// What rules check: one value per FIELDS key (ids, or the label for a status), null when the project has none.
export type RuleValues = Record<string, string | null | undefined>;
export function matchCrit(c: Crit, v: RuleValues | null) {
  if (!v || !FIELDS.some((x) => x.key === c.field)) return false;
  const have = v[c.field];
  if (c.op === 'set') return !!have;
  if (c.op === 'empty') return !have;
  const same = String(have || '').toLowerCase() === String(c.value || '').toLowerCase();
  return c.op === 'is' ? same : !same;
}
const matchGroup = (rules: Crit[], any: boolean, v: RuleValues | null) => rules.length > 0 && (any ? rules.some((c) => matchCrit(c, v)) : rules.every((c) => matchCrit(c, v)));
export const matchPath = (p: Path, v: RuleValues | null) => matchGroup(p.when || [], p.match === 'any', v) || (p.or || []).some((grp) => matchGroup(grp, false, v));
export const matchFilters = (filters: Crit[] | undefined, v: RuleValues | null) => !filters || !filters.length || filters.every((c) => matchCrit(c, v));
export const critDone = (c: Crit) => !!c.field && (c.op === 'set' || c.op === 'empty' || !!c.value);

export function fillTokens(text: string, data: Record<string, string | null | undefined>) {
  return (text || '').replace(/\{\{\s*([a-z_.]+)(?:\s*\|\s*default:\s*'([^']*)')?\s*\}\}/gi, (_, k: string, dflt?: string) => {
    const v = data[k.toLowerCase()];
    return v == null || v === '' ? dflt || '' : String(v);
  });
}

let seq = 0;
export const newId = (p = 'n') => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);

// Run settings a new workflow starts with (handoff assumption 5): 1 retry, 5 minutes apart, alert the Super Admins,
// turn off after 3 failures in a row. A workflow saved before the builder has none and keeps the workspace rules.
export const NEW_SETTINGS = { retries: 1, retryWait: '5m', alert: ['admins'], autoOffAfter: 3, oneAtATime: false, perHour: 0 };

export function emptyGraph(kind: Kind = 'automation', tags: Tag[] = []): Graph {
  return { v: 2, kind, tags, settings: { ...NEW_SETTINGS }, trigger: { key: kind === 'automation' ? '' : 'manual', value: '', text: '', tags: [] }, steps: [] };
}

export const isGraph = (flow: unknown): flow is Graph => !!flow && typeof flow === 'object' && !Array.isArray(flow) && (flow as Graph).v === 2;

// The graph for a saved row: its own, or one built from a workflow saved before the builder.
export function graphOf(row: { flow?: unknown; trigger?: unknown; actions?: unknown } | null | undefined): Graph {
  if (row && isGraph(row.flow)) {
    const g = row.flow;
    const extras: GraphExtras = {};
    (['description', 'owner', 'settings', 'lastTest', 'byAgent', 'template'] as const).forEach((k) => { if (g[k] !== undefined) (extras as Record<string, unknown>)[k] = g[k]; });
    return { v: 2, kind: g.kind || 'automation', tags: g.tags || [], trigger: Object.assign({ key: '', value: '', text: '', tags: [] }, g.trigger), steps: g.steps || [], ...extras };
  }
  // Converted steps keep their action key as id, the same key older runs list in output.done, so a run waiting to
  // retry when the workflow is first saved in the builder does not repeat a step that already worked.
  const t = triggerOf((row && row.trigger) as { key?: string; value?: string; label?: string });
  const seen: Record<string, number> = {};
  return {
    v: 2, kind: 'automation', tags: [], trigger: { key: t.key, value: t.value, text: '', tags: [] },
    steps: actionsOf(row && row.actions).map((a) => {
      seen[a.key] = (seen[a.key] || 0) + 1;
      return { id: seen[a.key] === 1 ? a.key : a.key + ':' + seen[a.key], type: 'action' as const, key: a.key, message: a.message, tags: [] };
    }),
  };
}

export function walk(steps: Node[], fn: (n: Node, depth: number) => void, depth = 0) {
  for (const n of steps) {
    fn(n, depth);
    if (n.type === 'split') for (const p of n.paths || []) walk(p.steps, fn, depth + 1);
  }
}

// Steps below the trigger.
export function stepCount(g: Graph) {
  let n = 0;
  walk(g.steps, () => { n++; });
  return n;
}
export const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);
// "Wait 1 day", "Wait 3 hours".
export const delayText = (n: Node) => 'Wait ' + plural(Number(n.amount) || 0, (n.unit || 'days').replace(/s$/, ''));

// What the row stores besides the graph: the runner's trigger, the card's summary, and preview columns for the
// workflow card thumbnail (t trigger, a step, c split path).
export function compile(g: Graph, statusLabel?: (v: string) => string) {
  const acts: { key: string; label: string; message: string }[] = [];
  const apps = new Set<string>();
  const said: string[] = []; // the card's "Then …": actions and tasks in order
  walk(g.steps, (n) => {
    if (n.type === 'task') said.push('Task: ' + (n.title || 'untitled'));
    if (n.type !== 'action' || !n.key) return;
    const def = actionById(n.key);
    if (!def) return;
    acts.push({ key: n.key, label: def.label, message: n.message || '' });
    said.push(def.label);
    apps.add(def.app);
  });
  const cols: string[][] = [['t']];
  const lay = (steps: Node[]) => {
    for (const n of steps) {
      if (n.type === 'split') { cols.push((n.paths || []).map(() => 'c')); return; }
      cols.push(['a']);
    }
  };
  lay(g.steps);
  const runs = g.kind === 'automation';
  const when = runs ? (g.trigger.key ? triggerText(g.trigger.key, g.trigger.value, statusLabel) : 'No trigger yet') : (g.trigger.text || (g.kind === 'process' ? 'Started by hand' : 'An idea'));
  const then = said.length ? said.join(', then ') : stepCount(g) ? plural(stepCount(g), 'step') : 'nothing yet';
  return {
    trigger: runs ? { key: g.trigger.key, value: g.trigger.value, label: when, ...(g.trigger.tz ? { tz: g.trigger.tz } : {}), ...(g.trigger.key === 'webhook' && g.trigger.secret ? { secret: g.trigger.secret } : {}) }
      : { key: 'manual', value: '', label: when },
    actions: runs ? acts : [],
    when_text: when.charAt(0).toLowerCase() + when.slice(1), then_text: then,
    app: runs ? Array.from(apps)[0] || 'Board' : g.kind === 'process' ? 'Process' : 'Idea',
    cols: cols.slice(0, 8),
  };
}

// Problems the builder flags in its Alerts panel; warnings block turning an automation on. Processes and ideas never
// run, so they only get gentle notes about unfinished cards. connected: provider keys with a working connection.
const STEP_NAME: Record<string, string> = { ai: 'Assistant', data: 'Board data' };
// data 'get_project' is a no-op at run time: the runner already loads the run's project for every step.
// An approval step runs: it parks the run until a Super Admin approves or rejects (lib/automations/run.ts).
export const cannotRunYet = (n: Node) => n.type === 'ai' || (n.type === 'data' && (n.key || 'get_project') !== 'get_project');
export function issuesOf(g: Graph, connected: Record<string, boolean>) {
  const out: { id: string; level: 'warn' | 'info'; title: string; body: string }[] = [];
  const runs = g.kind === 'automation';
  const warn = runs ? 'warn' as const : 'info' as const;
  if (runs && !g.trigger.key) out.push({ id: 'trigger', level: 'warn', title: 'Pick a trigger', body: 'An automation needs a trigger before it can turn on.' });
  if (runs && (g.trigger.filters || []).some((c) => !critDone(c))) out.push({ id: 'trigger', level: 'warn', title: 'Finish the trigger filter', body: 'An Only when rule has no value picked.' });
  if (runs && hasNoProject(g.trigger.key) && (g.trigger.filters || []).length) out.push({ id: 'trigger', level: 'warn', title: 'Remove the trigger filters', body: 'Schedules and webhooks run without a project, so Only when rules can never match.' });
  const noProject = runs && hasNoProject(g.trigger.key);
  let work = 0;
  walk(g.steps, (n) => {
    if (n.type === 'action' || n.type === 'task' || n.type === 'ai' || n.type === 'approval') work++;
    // Step types the runner cannot run yet (lib/automations/run.ts stops on them), so a flow with one stays a draft.
    if (runs && cannotRunYet(n)) out.push({ id: n.id, level: 'warn', title: (n.title || STEP_NAME[n.type]) + ' is not available yet', body: STEP_NAME[n.type] + ' steps cannot run yet. Remove the step or keep this workflow as a draft.' });
    if (n.type === 'action') {
      const def = n.key ? actionById(n.key) : null;
      if (!def) out.push({ id: n.id, level: warn, title: 'Choose an action', body: 'This step has no action yet.' });
      else if (noProject && def.scope !== 'any') out.push({ id: n.id, level: 'warn', title: '"' + def.label + '" needs a project', body: 'A schedule or webhook starts a run with no project, so this step has nothing to act on. Use a step that does not need one, such as a Slack message or a To-Do.' });
      else if (runs && def.needs && !connected[def.needs]) out.push({ id: n.id, level: 'warn', title: 'Connect ' + def.app, body: '"' + def.label + '" needs ' + def.app + ' connected in Workspace Settings > Integrations.' });
    }
    if (n.type === 'split') (n.paths || []).slice(0, -1).forEach((p) => {
      if (!p.when.length) out.push({ id: p.id, level: warn, title: 'Add a rule to ' + p.name, body: p.name + ' has no rule yet, so nothing takes that path.' });
      else if (p.when.concat(...(p.or || [])).some((c) => !critDone(c))) out.push({ id: p.id, level: warn, title: 'Finish the rule for ' + p.name, body: p.name + ' has a rule with no value picked.' });
    });
    if (n.type === 'delay' && runs && !(Number(n.amount) > 0)) out.push({ id: n.id, level: 'info', title: 'Set the wait', body: 'A wait of 0 does nothing.' });
    if (n.type === 'task' && !n.title) out.push({ id: n.id, level: 'info', title: 'Name the task', body: 'Give this task a short title.' });
  });
  if (runs && !work) out.push({ id: 'end', level: 'warn', title: 'Add a step', body: 'Add an action or a task, or nothing happens when the trigger fires.' });
  return out;
}

export const ACTION_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Messages', keys: ['slack_admin', 'email_editor', 'email_designer'] },
  { label: 'Board', keys: ['status_next', 'todo_admin'] },
  { label: 'Connectors', keys: ACTIONS.filter((a) => a.key === 'webhook_n8n' || a.key === 'buffer_publish').map((a) => a.key) },
];
