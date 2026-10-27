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

import { actionById, actionsOf, triggerOf, triggerText, ACTIONS } from './catalog';

export type Kind = 'automation' | 'process' | 'idea';
export type TagType = 'project' | 'idea' | 'client' | 'person' | 'status' | 'channel' | 'brand' | 'connector' | 'video' | 'buffer';
export type Tag = { type: TagType; id: string; label: string };
export type Crit = { field: string; op: 'is' | 'is_not' | 'set' | 'empty'; value: string };
export type Path = { id: string; name: string; when: Crit[]; steps: Node[] };
export type Node = {
  id: string; type: 'action' | 'task' | 'note' | 'delay' | 'split'; tags: Tag[];
  key?: string; message?: string;                       // action
  title?: string; note?: string; owner?: string;        // task, note (owner: a member's user id)
  amount?: number; unit?: 'minutes' | 'hours' | 'days'; // delay
  name?: string; paths?: Path[];                        // split
};
export type Trigger = { key: string; value: string; text: string; tags: Tag[] };
export type Graph = { v: 2; kind: Kind; tags: Tag[]; trigger: Trigger; steps: Node[] };

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

export function fillTokens(text: string, data: Record<string, string | null | undefined>) {
  return (text || '').replace(/\{\{\s*([a-z_.]+)(?:\s*\|\s*default:\s*'([^']*)')?\s*\}\}/gi, (_, k: string, dflt?: string) => {
    const v = data[k.toLowerCase()];
    return v == null || v === '' ? dflt || '' : String(v);
  });
}

let seq = 0;
export const newId = (p = 'n') => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);

export function emptyGraph(kind: Kind = 'automation', tags: Tag[] = []): Graph {
  return { v: 2, kind, tags, trigger: { key: kind === 'automation' ? '' : 'manual', value: '', text: '', tags: [] }, steps: [] };
}

export const isGraph = (flow: unknown): flow is Graph => !!flow && typeof flow === 'object' && !Array.isArray(flow) && (flow as Graph).v === 2;

// The graph for a saved row: its own, or one built from a workflow saved before the builder.
export function graphOf(row: { flow?: unknown; trigger?: unknown; actions?: unknown } | null | undefined): Graph {
  if (row && isGraph(row.flow)) {
    const g = row.flow;
    return { v: 2, kind: g.kind || 'automation', tags: g.tags || [], trigger: Object.assign({ key: '', value: '', text: '', tags: [] }, g.trigger), steps: g.steps || [] };
  }
  const t = triggerOf((row && row.trigger) as { key?: string; value?: string; label?: string });
  return {
    v: 2, kind: 'automation', tags: [], trigger: { key: t.key, value: t.value, text: '', tags: [] },
    steps: actionsOf(row && row.actions).map((a) => ({ id: newId(), type: 'action' as const, key: a.key, message: a.message, tags: [] })),
  };
}

export function walk(steps: Node[], fn: (n: Node, depth: number) => void, depth = 0) {
  for (const n of steps) {
    fn(n, depth);
    if (n.type === 'split') for (const p of n.paths || []) walk(p.steps, fn, depth + 1);
  }
}

export function nodeCount(g: Graph) {
  let n = 1;
  walk(g.steps, () => { n++; });
  return n;
}

// What the row stores besides the graph: the runner's trigger, the card's summary, and preview columns for the
// workflow card thumbnail (t trigger, a step, c split path).
export function compile(g: Graph, statusLabel?: (v: string) => string) {
  const acts: { key: string; label: string; message: string }[] = [];
  const apps = new Set<string>();
  walk(g.steps, (n) => {
    if (n.type !== 'action' || !n.key) return;
    const def = actionById(n.key);
    if (!def) return;
    acts.push({ key: n.key, label: def.label, message: n.message || '' });
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
  const then = acts.length ? acts.map((a) => a.label).join(', then ') : nodeCount(g) - 1 + ' step' + (nodeCount(g) === 2 ? '' : 's');
  return {
    trigger: runs ? { key: g.trigger.key, value: g.trigger.value, label: when } : { key: 'manual', value: '', label: when },
    actions: runs ? acts : [],
    when_text: when.charAt(0).toLowerCase() + when.slice(1), then_text: then,
    app: runs ? Array.from(apps)[0] || 'Board' : g.kind === 'process' ? 'Process' : 'Idea',
    cols: cols.slice(0, 8),
  };
}

// Problems the builder flags in its Alerts panel. connected: provider keys with a working connection.
export function issuesOf(g: Graph, connected: Record<string, boolean>) {
  const out: { id: string; level: 'warn' | 'info'; title: string; body: string }[] = [];
  if (g.kind === 'automation' && !g.trigger.key) out.push({ id: 'trigger', level: 'warn', title: 'Pick a trigger', body: 'An automation needs a trigger before it can turn on.' });
  let actions = 0;
  walk(g.steps, (n) => {
    if (n.type === 'action') {
      const def = n.key ? actionById(n.key) : null;
      actions++;
      if (!def) out.push({ id: n.id, level: 'warn', title: 'Choose an action', body: 'This step has no action yet.' });
      else if (def.needs && !connected[def.needs]) out.push({ id: n.id, level: 'warn', title: 'Connect ' + def.app, body: '"' + def.label + '" needs ' + def.app + ' connected in Workspace Settings > Integrations.' });
    }
    if (n.type === 'split') (n.paths || []).slice(0, -1).forEach((p) => {
      if (!p.when.length) out.push({ id: p.id, level: 'warn', title: 'Add path criteria', body: p.name + ' has no criteria, so everything goes down it.' });
    });
    if (n.type === 'task' && !n.title) out.push({ id: n.id, level: 'info', title: 'Name the task', body: 'Give this task a short title.' });
  });
  if (g.kind === 'automation' && !actions) out.push({ id: 'end', level: 'info', title: 'Add an action', body: 'Nothing happens yet when the trigger fires.' });
  return out;
}

export const ACTION_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Messages', keys: ['slack_admin', 'email_editor', 'email_designer'] },
  { label: 'Board', keys: ['status_next', 'todo_admin'] },
  { label: 'Connectors', keys: ACTIONS.filter((a) => a.key === 'webhook_n8n' || a.key === 'buffer_publish').map((a) => a.key) },
];
