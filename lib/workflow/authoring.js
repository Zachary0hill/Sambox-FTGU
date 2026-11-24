// Translate complete clauses to the existing builder graph. Unrecognized clauses stay visible and
// block activation. This runs locally and has no access to a connector or the workflow runner.
import { ACTIONS, TRIGGERS, actionsFor, triggerById } from '../automations/catalog';
import { emptyGraph, newId, webhookToken, FIELDS } from '../automations/graph';
import { ruleString } from '../automations/schedule';

const clean = value => String(value || '').trim().replace(/^[,;:\s]+|[,;:.!?\s]+$/g, '').replace(/\s+/g, ' ');
const norm = value => clean(value).toLowerCase();
const choice = (list, text) => list.find(([id, label]) => norm(label) === norm(text) || norm(id) === norm(text))?.[0];

// Status trigger values are workspace labels; editor/idea statuses use the catalog's stored keys.
function eventTrigger(clause, D) {
  const exact = TRIGGERS.find(t => !t.values && !t.mode && norm(t.label) === norm(clause));
  if (exact) return { key: exact.key };
  if (/^(?:(?:a|the) project\s+)?(?:reaches|enters|moves (?:in)?to|is|becomes)\s+(?:(?:the )?scheduled(?: status)?\s+(?:in|under)\s+(?:the )?publishing(?: stage)?|publishing\s*(?:→|>|:)\s*scheduled)$/i.test(clause)) return { key: 'publishing_scheduled' };
  if (/^(?:an? |the )?idea (?:is (?:created|captured)|arrives)$/i.test(clause)) return { key: 'idea_created' };
  if (/^(?:a |the )?(?:webhook|webhook request) (?:arrives|is received)$/i.test(clause)) return { key: 'webhook', value: webhookToken() };
  const fields = [
    ['edit_status', /^(?:the |an? )?(?:edit(?:or)?(?: status)?) (?:is|becomes|reaches|moves to) (.+)$/i],
    ['thumb_status', /^(?:the |a )?thumbnail(?: status)? (?:is|becomes|reaches|moves to) (.+)$/i],
    ['approval', /^(?:the )?sponsor approval (?:is|becomes|reaches) (.+)$/i],
    ['idea_stage', /^(?:an? |the )?idea(?: stage)? (?:is|becomes|reaches|moves to) (.+)$/i],
    ['status', /^(?:a |the )?(?:project(?: status)?|status) (?:is|becomes|reaches|enters|moves to) (.+)$/i],
  ];
  for (const [key, pattern] of fields) {
    const match = clause.match(pattern);
    if (!match) continue;
    const values = key === 'status' ? (D.statuses || []).map(s => [s.label, s.label]) : triggerById(key).values;
    const value = choice(values, match[1]);
    if (value) return { key, value };
  }
  return { key: '', text: clause };
}

function schedule(clause, D) {
  const match = clause.match(/^(every day|daily|weekdays)(?: at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/i);
  if (!match) return null;
  const hour = Number(match[2]), minute = Number(match[3] || 0);
  const valid = !!match[2] && hour <= (match[4] ? 12 : 23) && (!match[4] || hour >= 1) && minute < 60;
  return { key: 'schedule', tz: D.settings?.timezone || '', value: valid ? ruleString({
    freq: norm(match[1]) === 'weekdays' ? 'weekdays' : 'daily', hour: match[4] ? hour % 12 + (norm(match[4]) === 'pm' ? 12 : 0) : hour, minute,
  }) : '' };
}

function actionNode(text, trigger) {
  const base = { id: newId(), tags: [] };
  const exact = ACTIONS.find(a => norm(a.label) === norm(text));
  const digest = text.match(/^(?:(?:send|post|deliver|create) (?:a |the )?)?(?:(?:production|studio) (?:digest|summary|report) (?:in|to|on|via) slack|slack (?:production|studio) (?:digest|summary|report))(?: (?:to |in )?(?:channel )?(#[-\w]+|[CG][A-Z0-9]+))?$/i);
  const alternatives = [
    ['buffer_draft', /^(?:create|make|save|prepare) (?:an? )?(?:editable )?(?:buffer draft(?: post)?|draft(?: post)? (?:in|on|for) buffer)$/i],
    ['email_editor', /^email (?:the |an? )?(?:assigned )?editor$/i],
    ['email_designer', /^email (?:the |an? )?(?:assigned )?designer$/i],
    ['slack_admin', /^(?:notify|message) (?:the |a )?super admin (?:in|on|via) slack$/i],
    ['todo_admin', /^create (?:a )?(?:to-do|task) for (?:the |a )?super admin$/i],
  ];
  const key = exact?.key || (digest ? 'slack_production_digest' : alternatives.find(([, re]) => re.test(text))?.[0]);
  if (key && (!trigger || actionsFor(trigger).some(a => a.key === key))) {
    const channel = digest?.[1] || '';
    return { ...base, type: 'action', key, message: channel.startsWith('#') ? '' : channel };
  }
  const delay = text.match(/^wait (\d+) (minutes?|hours?|days?)$/i);
  if (delay && Number(delay[1]) > 0 && Number(delay[1]) <= 365) return { ...base, type: 'delay', amount: Number(delay[1]), unit: norm(delay[2]).replace(/s?$/, 's') };
  if (/^(?:wait for|request|require) (?:super admin |an? )?approval$/i.test(text)) return { ...base, type: 'approval', title: 'Approval', timeoutHours: 0 };
  return { ...base, type: 'action', key: '', title: 'Manual setup', note: text };
}

function condition(text, D) {
  const m = text.match(/^(?:the )?(.+?) (is not|is|equals) (.+)$/i);
  const field = m && FIELDS.find(f => norm(f.label) === norm(m[1]));
  if (field) {
    const name = norm(m[3]);
    const op = name === 'set' || name === 'assigned' ? 'set' : name === 'empty' || name === 'unassigned' ? 'empty' : '';
    if (op && norm(m[2]) === 'is' && field.ops.includes(op)) return { field: field.key, op, value: '' };
    const values = {
      status: (D.statuses || []).map(x => [x.label, x.label]), channel: (D.channels || []).map(x => [x.id, x.name]),
      type: (D.types || []).map(x => [x.id, x.label]), client: (D.accounts || []).map(x => [x.id, x.name]),
      person: (D.members || []).filter(x => x.status === 'active').map(x => [x.user_id, x.person?.full_name || x.person?.name]),
      edit_status: triggerById('edit_status').values, approval: triggerById('approval').values,
    };
    const candidates = (values[field.source] || []).filter(([id,label]) => norm(id) === name || norm(label) === name);
    if (candidates.length === 1 && field.ops.includes('is')) return { field: field.key, op: norm(m[2]) === 'is not' ? 'is_not' : 'is', value: candidates[0][0] };
  }
  return { field: '', op: 'is', value: '' };
}

export function draftWorkflow(request, D) {
  const graph = emptyGraph();
  graph.byAgent = true;
  graph.description = request.trim();
  let words = clean(request).replace(/^please\s+/i, '');
  const filter = words.match(/\s+(?:only (?:if|when)|provided that|if)\s+(.+)$/i);
  if (filter) words = clean(words.slice(0, filter.index));
  const event = words.match(/^(?:when|whenever|once|after)\s+(.+?)(?:\s*[,;]\s*(?:then )?|\s+then\s+|\s+(?=(?:create|send|email|notify|wait|make|save|post)\b))(.+)$/i);
  const trailing = !event && words.match(/^(.*?)\s+(?:when|whenever|once|after)\s+(.+)$/i);
  const time = !event && !trailing && /(?:^|\s)(?:every day|daily|weekdays)(?: at \d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i.exec(words);
  let action = words;
  if (event || trailing) {
    const start = clean(event ? event[1] : trailing[2]);
    Object.assign(graph.trigger, schedule(start, D) || eventTrigger(start, D));
    action = clean(event ? event[2] : trailing[1]);
  } else if (time) {
    action = clean(words.slice(0, time.index) + ' ' + words.slice(time.index + time[0].length));
    let rule = clean(time[0]);
    const clock = !/ at /i.test(rule) && action.match(/\s+at (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/i);
    if (clock) {
      rule += ' at ' + clock[1];
      action = clean(action.slice(0, clock.index));
    }
    Object.assign(graph.trigger, schedule(rule, D));
  }
  if (filter) graph.trigger.filters = [condition(clean(filter[1]), D)];
  graph.steps = action.split(/\s*(?:[,;]\s*(?:and )?then\s+|\s+and then\s+|\s+then\s+|\s+and\s+|\n+)\s*/i)
    .filter(Boolean).map(clause => actionNode(clean(clause), graph.trigger.key));
  return graph;
}

export function workflowConnections(D) {
  return {
    ...Object.fromEntries((D.integrations || []).map(x => [x.provider, x.status === 'connected'])),
    bufferDraftMapping: !!D.buffer?.channels?.some(c => c.draft_brand_id),
  };
}
