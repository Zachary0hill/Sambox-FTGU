import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { buildMessageEmail } from '@/lib/email/message-template';
import { getIntegration } from '@/lib/integrations/secrets';
import { postSlackAlert } from '@/lib/integrations/providers/slack';
import { postN8n } from '@/lib/integrations/providers/n8n';
import { publishProjectToBuffer, PublishSetupError } from '@/lib/integrations/buffer-publish';
import { actionById, actionsOf, scopeOf, triggerOf, triggerText } from './catalog';
import { comparableTrigger, previewMatch } from '@/lib/workflow/review';
import { isGraph, graphOf, fillTokens, delayText, cannotRunYet, matchPath, matchFilters, type Node, type RuleValues } from './graph';
import { lastSlot } from './schedule';
import { deliverProductionDigest, DigestSetupError, DigestRetryError } from './production-digest';

// The automation runner. Database triggers queue automation_runs rows when a live workflow's trigger fires; each tick
// (the board after a change, and a scheduler with CRON_SECRET) queues scheduled triggers, claims due runs, performs
// their actions with the secret key, and records the outcome on the run:
//   done     every action worked; output lists what each one did
//   retry    an action failed and Retry failed runs is on: tried again 5 and 10 minutes later (three tries in all)
//   failed   out of tries, or a failure retrying cannot fix (no editor assigned, not connected)
//   skipped  the workflow was turned off or deleted, or Pause all automations is on
//   test     a Test run: actions described, nothing sent or changed
// Completed effects are journaled. Ambiguous external outcomes require review; definite DB failures may retry.
//
// Flows built in the flow builder (lib/automations/graph.ts) walk their graph instead: a split takes the first path
// whose criteria match the project (remembered in output.paths, so a resumed run keeps its path), a delay parks the
// run as retry with output.waiting until it is due, and a task adds a To-Do. output.done then lists node ids.
// Processes and ideas never run.
//
// Idea workflows (catalog scope 'idea') run on runs with idea_id: their actions read the idea (title, stage, owner,
// score) instead of a project, and their tokens are idea.*. They are simple workflows, never flow-builder graphs.

type Run = {
  id: string; automation_id: string; workspace_id: string; project_id: string | null; idea_id?: string | null; trigger_key: string | null; status: string;
  payload: Record<string, unknown> | null; output: Output | null; attempts: number; is_test: boolean;
};
// waitClaims: claims spent resuming from delays since the last manual retry; tries leave them out.
// log: what happened, in order, with times (the run detail page's Run log).
type Output = { done?: string[]; steps?: Step[]; waited?: string[]; waitClaims?: number; paths?: Record<string, string>; waiting?: boolean; log?: LogLine[];
  approval?: PendingApproval | null; approvals?: Record<string, Decision>; overrides?: Record<string, string> };
// at and ms: when the step finished and how long it took. received: what it was given, as label and value pairs.
type Step = { id?: string; action: string; ok: boolean; detail: string; at?: string; ms?: number; received?: [string, string][] };
type LogLine = { at: string; text: string; level?: 'error' };
// An approval step waiting on a Super Admin (output.approval), and the decisions made (output.approvals by step id).
// draft: what the step after the approval will send; an edited body is kept in output.overrides by that step's id.
export type PendingApproval = {
  stepId: string; title: string; askedAt: string; expiresAt: string | null; reason: string; after: string;
  draft: { stepId: string; to: string; subject: string; body: string } | null; context: [string, string][];
};
type Decision = { decision: 'approved' | 'rejected'; by: string; byId: string; at: string };
const RECIPIENT: Record<string, string> = {
  buffer_draft: 'The Buffer draft channels mapped to the project’s brand',
  slack_admin: 'Super Admin Slack channel', todo_admin: 'Super Admins, in their Inbox', webhook_n8n: 'Your n8n workflow', buffer_publish: 'The Buffer channels chosen on the project',
  idea_email_owner: 'The idea owner', idea_todo_owner: 'The idea owner, in their Inbox',
};
type Automation = { id: string; workspace_id: string; name: string; enabled: boolean; is_draft: boolean; trigger: Record<string, string>; actions: unknown; flow: unknown; run_count: number; updated_at?: string };
// Per-workflow run settings (the builder's Workflow settings, stored in the graph). A workflow without them keeps
// the workspace rules: three tries 5 and 10 minutes apart, then an alert to the Super Admins.
type FlowSettings = { retries?: number; retryWait?: string; alert?: string[]; autoOffAfter?: number; oneAtATime?: boolean; perHour?: number };
const WAIT_MIN: Record<string, number> = { '1m': 1, '5m': 5, '15m': 15 };
type Settings = { workspace_id: string; automation: { paused?: boolean; retry?: boolean; failAlert?: boolean } | null; timezone: string };
type Project = {
  id: string; workspace_id: string; title: string; job_code: string; status_id: string; publish_date: string | null; archived_at: string | null;
  channel_id: string | null; content_type_id: string | null;
};
type Idea = { id: string; workspace_id: string; title: string; stage: string; owner_id: string | null; author_id: string | null; archived_at: string | null; approved_at: string | null; project_id: string | null; research: { score?: { total?: number } | null } | null };
const STAGE_LABEL: Record<string, string> = { inbox: 'Inbox', research: 'Research', ready: 'Ready', approved: 'Approved' };
const NEXT_STAGE: Record<string, string> = { inbox: 'research', research: 'ready' };
// What splits check and tokens fill: the project's people, sponsor and channel.
type Facts = {
  channel: string; sponsorId: string | null; sponsor: string; approval: string; editorId: string | null; editor: string; editStatus: string;
  designerId: string | null; designer: string; thumbStatus: string;
};

const MAX_TRIES = 3;
const RETRY_MIN = 5;

// A failure that trying again cannot fix.
class Permanent extends Error {}
class Uncertain extends Permanent {}
class SafeRetry extends Error {}

export type RunSummary = { scheduled: number; done: number; retried: number; waiting: number; failed: number; skipped: number; pruned: number };

export async function runAutomations(opts: { workspaceId: string | null; baseUrl: string; limit?: number }): Promise<RunSummary> {
  const admin = supabaseAdmin();
  const out: RunSummary = { scheduled: 0, done: 0, retried: 0, waiting: 0, failed: 0, skipped: 0, pruned: 0 };
  const sched = await admin.rpc('queue_scheduled_automations', { p_ws: opts.workspaceId });
  if (sched.error) throw new Error(sched.error.message);
  out.scheduled = Number(sched.data) || 0;
  // Idea reminders (idea_stale). A database without the idea automations migration has no such function: skip, don't fail the tick.
  const ideaSched = await admin.rpc('queue_scheduled_idea_automations', { p_ws: opts.workspaceId });
  if (ideaSched.error && ideaSched.error.code !== 'PGRST202') throw new Error(ideaSched.error.message);
  out.scheduled += Number(ideaSched.data) || 0;

  out.scheduled += await queueSchedules(opts.workspaceId);

  const claim = await admin.rpc('claim_automation_runs', { p_ws: opts.workspaceId, p_limit: opts.limit ?? 25 });
  if (claim.error) throw new Error(claim.error.message);
  const runs = (claim.data || []) as Run[];
  for (const r of runs) {
    const res = await executeRun(r, opts.baseUrl);
    out[res === 'done' || res === 'test' ? 'done' : res === 'retry' ? 'retried' : res]++;
  }
  const pr = await admin.rpc('prune_automation_runs', { p_ws: opts.workspaceId });
  if (!pr.error) out.pruned = Number(pr.data) || 0;
  return out;
}

// Schedule triggers (schedule.ts): one run for the latest slot that has passed since the workflow last changed, once
// (the dedupe key is the slot). Nothing queues while Pause all automations is on.
async function queueSchedules(workspaceId: string | null) {
  const admin = supabaseAdmin();
  let q = admin.from('automations').select('id, workspace_id, trigger, updated_at').eq('enabled', true).eq('is_draft', false).eq('trigger->>key', 'schedule');
  if (workspaceId) q = q.eq('workspace_id', workspaceId);
  const list = await q;
  if (list.error || !list.data || !list.data.length) return 0;
  const wsIds = Array.from(new Set(list.data.map((a) => a.workspace_id as string)));
  const st = await admin.from('workspace_settings').select('workspace_id, automation, timezone').in('workspace_id', wsIds);
  const byWs: Record<string, Settings> = {};
  ((st.data || []) as Settings[]).forEach((x) => { byWs[x.workspace_id] = x; });
  let n = 0;
  for (const a of list.data) {
    const set = byWs[a.workspace_id as string];
    if (set && set.automation && set.automation.paused) continue;
    const trig = (a.trigger || {}) as Record<string, string>;
    const timezone = trig.tz || (set && set.timezone) || 'America/Chicago';
    const slot = lastSlot(trig.value || '', timezone);
    // Only slots since the workflow was last saved or turned on, and no older than a day.
    if (!slot || slot <= new Date(a.updated_at as string).getTime() || Date.now() - slot > 86400000) continue;
    const ins = await admin.from('automation_runs').insert({
      automation_id: a.id, workspace_id: a.workspace_id, trigger_key: 'schedule', status: 'queued',
      payload: { value: trig.value, timezone, slot: new Date(slot).toISOString() }, dedupe_key: a.id + ':sched:' + slot,
    });
    if (!ins.error) n++;
    else if (ins.error.code !== '23505') console.warn('schedule', ins.error.message);
  }
  return n;
}

// Webhook triggers (app/api/webhooks/automations/[token]): queues one run for the live workflow with this address.
// project: an optional job code or project id from the request body, so project steps have something to act on.
export async function queueWebhookRun(token: string, key: string | null, body: Record<string, unknown>) {
  const admin = supabaseAdmin();
  const found = await admin.from('automations').select('id, workspace_id, name, enabled, is_draft, trigger').eq('trigger->>key', 'webhook').eq('trigger->>value', token).is('revision_source_id',null).maybeSingle();
  if (found.error || !found.data) return { status: 404 as const, error: 'No workflow uses this address. Save the trigger, then try again.' };
  const a = found.data;
  const secret = ((a.trigger || {}) as Record<string, string>).secret || '';
  if (secret && key !== secret) return { status: 401 as const, error: 'This workflow needs its secret key in the x-workflow-key header.' };
  const live = a.enabled && !a.is_draft;
  if (body.test === true || !live) return { status: 200 as const, workflow: a.name as string, live, queued: false, workspaceId: a.workspace_id as string };
  let projectId: string | null = null;
  const ref = typeof body.project === 'string' ? body.project.trim() : '';
  if (ref) {
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    const pr = await admin.from('projects').select('id').eq('workspace_id', a.workspace_id).eq(isId ? 'id' : 'job_code', ref).maybeSingle();
    projectId = pr.data ? (pr.data.id as string) : null;
  }
  const ins = await admin.from('automation_runs').insert({ automation_id: a.id, workspace_id: a.workspace_id, project_id: projectId, trigger_key: 'webhook', status: 'queued', payload: { body: JSON.parse(JSON.stringify(body).slice(0, 8000) || '{}') } });
  if (ins.error) return { status: 500 as const, error: 'The run could not be queued.' };
  return { status: 200 as const, workflow: a.name as string, live, queued: true, workspaceId: a.workspace_id as string };
}

// A Test run: the workflow's actions on a sample project (the most recently created), described but not performed.
// flow: the builder's unsaved graph, so testing never has to save (and change) a live automation first.
export async function testAutomation(workspaceId: string, automationId: string, baseUrl: string, flow?: unknown, projectId?: string) {
  const admin = supabaseAdmin();
  const a = await admin.from('automations').select('*').eq('id', automationId).eq('workspace_id', workspaceId).maybeSingle();
  if (a.error || !a.data) throw new Error('That workflow was not found.');
  const draft = isGraph(flow) ? graphOf({ flow }) : null;
  const t = draft ? { key: draft.trigger.key, value: draft.trigger.value } : triggerOf(a.data.trigger as Record<string, string>);
  // Idea workflows test on the most recently changed live idea; project workflows on the newest project.
  const onIdea = scopeOf(t.key) === 'idea';
  let projects = admin.from('projects').select('id').eq('workspace_id', workspaceId).is('archived_at', null);
  if (projectId) projects = projects.eq('id', projectId);
  const sample = onIdea
    ? await admin.from('ideas').select('id').eq('workspace_id', workspaceId).is('archived_at', null).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    : await projects.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (sample.error) throw new Error('Could not load the preview sample: ' + sample.error.message);
  if (!onIdea && (projectId || comparableTrigger(t.key)) && !sample.data) throw new Error('Choose an active preview project in this workspace.');
  const ins = await admin.from('automation_runs').insert({
    automation_id: automationId, workspace_id: workspaceId, project_id: !onIdea && sample.data ? sample.data.id : null,
    ...(onIdea ? { idea_id: sample.data ? sample.data.id : null } : {}), trigger_key: t.key,
    status: 'running', is_test: true, attempts: 1, payload: { value: t.value, sample: true, checkProject: !onIdea && comparableTrigger(t.key) },
  }).select('*').single();
  if (ins.error) throw new SafeRetry(ins.error.message);
  try {
    await executeRun(ins.data as Run, baseUrl, draft);
  } catch (error) {
    await admin.from('automation_runs').update({status:'failed',finished_at:new Date().toISOString(),error:error instanceof Error ? error.message : String(error)}).eq('id',ins.data.id);
    throw error;
  }
  const done = await admin.from('automation_runs').select('*').eq('id', ins.data.id).single();
  return done.data;
}

async function executeRun(r: Run, baseUrl: string, draft?: ReturnType<typeof graphOf> | null): Promise<'done' | 'test' | 'retry' | 'waiting' | 'failed' | 'skipped'> {
  const admin = supabaseAdmin();
  const finish = async (status: string, patch: Record<string, unknown>) => {
    const res = await admin.from('automation_runs').update({ status, finished_at: status === 'retry' ? null : new Date().toISOString(), ...patch }).eq('id', r.id);
    if (res.error) throw new Error('Could not save automation progress: ' + res.error.message);
  };
  const [aRes, sRes, wRes] = await Promise.all([
    admin.from('automations').select('*').eq('id', r.automation_id).maybeSingle(),
    admin.from('workspace_settings').select('workspace_id, automation, timezone').eq('workspace_id', r.workspace_id).maybeSingle(),
    admin.from('workspaces').select('name').eq('id', r.workspace_id).maybeSingle(),
  ]);
  if (aRes.error || sRes.error || wRes.error) throw new Error('Automation settings could not be loaded.');
  const a = aRes.data as Automation | null;
  const st = (sRes.data as Settings | null) || { workspace_id: r.workspace_id, automation: {}, timezone: 'America/Chicago' };
  const auto = st.automation || {};
  const workspace = (wRes.data && wRes.data.name) || 'SantosStudios';
  if (!a) { await finish('skipped', { error: 'The workflow was deleted.' }); return 'skipped'; }
  if (!r.is_test && auto.paused) {
    await finish('retry', { next_attempt_at: new Date(Date.now() + 60000).toISOString(), attempts: Math.max(0, r.attempts - 1), error: null });
    return 'waiting';
  }
  if (!r.is_test && (!a.enabled || a.is_draft)) {
    await finish('skipped', { error: auto.paused ? 'Pause all automations is on.' : 'The workflow is turned off.' });
    return 'skipped';
  }

  const graph = draft || (isGraph(a.flow) ? graphOf(a) : null);
  if (graph && graph.kind !== 'automation') { await finish('skipped', { error: 'Processes and ideas do not run.' }); return 'skipped'; }

  const fs: FlowSettings | null = graph && graph.settings ? (graph.settings as FlowSettings) : null;
  // Run limits (Workflow settings): wait in line behind a run of the same workflow, or for the hour's allowance.
  if (!r.is_test && fs && (fs.oneAtATime || (fs.perHour || 0) > 0)) {
    const hold = async (minutes: number) => { await finish('retry', { next_attempt_at: new Date(Date.now() + minutes * 60000).toISOString(), attempts: Math.max(0, r.attempts - 1), error: null }); return 'waiting' as const; };
    if (fs.oneAtATime) {
      const busy = await admin.from('automation_runs').select('id', { count: 'exact', head: true }).eq('automation_id', a.id).eq('status', 'running').eq('is_test', false).neq('id', r.id);
      if ((busy.count || 0) > 0) return hold(1);
    }
    if ((fs.perHour || 0) > 0) {
      const hour = await admin.from('automation_runs').select('id', { count: 'exact', head: true }).eq('automation_id', a.id).eq('is_test', false).in('status', ['done', 'failed']).gte('finished_at', new Date(Date.now() - 3600000).toISOString());
      if ((hour.count || 0) >= (fs.perHour || 0)) return hold(10);
    }
  }

  const idea = r.idea_id ? ((await admin.from('ideas').select('id, workspace_id, title, stage, owner_id, author_id, archived_at, approved_at, project_id, research').eq('id', r.idea_id).maybeSingle()).data as Idea | null) : null;
  const p = r.project_id ? ((await admin.from('projects').select('id, workspace_id, title, job_code, status_id, publish_date, archived_at, channel_id, content_type_id').eq('id', r.project_id).maybeSingle()).data as Project | null) : null;
  const statuses = ((await admin.from('project_statuses').select('id, label, sort, stage').eq('workspace_id', r.workspace_id).order('sort')).data || []) as { id: string; label: string; sort: number; stage?: string }[];
  const statusName = (id: string | null | undefined) => (statuses.find((x) => x.id === id) || { label: '' }).label;
  const trig = graph && r.is_test ? { key: graph.trigger.key, value: graph.trigger.value } : triggerOf(a.trigger);
  const why = triggerText(trig.key, trig.value, statusName);
  const base = baseUrl.replace(/\/+$/, '');
  const onIdea = scopeOf(trig.key) === 'idea';
  const link = idea ? base + '/ideas?idea=' + encodeURIComponent(idea.id) : onIdea ? base + '/ideas' : p ? base + '/projects?project=' + encodeURIComponent(p.job_code) : base + '/projects';
  const subject = idea ? '"' + idea.title + '"' : onIdea ? 'no idea' : p ? p.title + ' (' + p.job_code + ')' : 'no project';
  const score = idea && idea.research && idea.research.score && idea.research.score.total != null ? String(Math.round(Number(idea.research.score.total))) : '';
  // Splits and tokens read the project's people, sponsor and channel; older workflows use neither.
  const facts = p && graph ? await factsOf(p) : null;
  const tokens: Record<string, string> = {
    'project.title': p ? p.title : '', 'project.job': p ? p.job_code : '', 'project.status': p ? statusName(p.status_id) : '',
    'project.channel': facts ? facts.channel : '', 'project.publish_date': p && p.publish_date ? p.publish_date : '', 'project.link': link,
    'project.sponsor': facts ? facts.sponsor : '', 'project.editor': facts ? facts.editor : '', 'project.designer': facts ? facts.designer : '',
    trigger: why, 'flow.name': a.name, 'workspace.name': workspace,
    'idea.title': idea ? idea.title : '', 'idea.stage': idea ? STAGE_LABEL[idea.stage] || idea.stage : '', 'idea.score': score, 'idea.link': idea ? link : '',
  };
  const ctx: Ctx = { r, a, p, idea, onIdea, statuses, statusName, why, link, base, subject, workspace, test: r.is_test, tokens,
    scheduleRule: String(r.payload?.value || trig.value),
    timezone: String(r.payload?.timezone || graph?.trigger.tz || a.trigger?.tz || st.timezone || 'America/Chicago'),
  };
  const values = valuesOf(p, facts, statusName);
  // The trigger's "Only when" rules: a run whose project does not fit them stops before any step.
  const filters = graph ? graph.trigger.filters : undefined;
  const strictSample = r.is_test && r.payload?.checkProject && graph;
  const sponsorStates = strictSample && p && trig.key === 'approval' ? await admin.from('sponsorships').select('approval_status').eq('project_id',p.id) : null;
  if (sponsorStates?.error) throw new Error('Could not load the sample’s sponsor approvals.');
  const checks = strictSample ? previewMatch(graph!.trigger, values,
    statuses.find(s => s.id === p?.status_id)?.stage, st.timezone || 'America/Chicago', new Date(), sponsorStates?.data?.map(s=>String(s.approval_status))) : null;
  if (checks && (!p || p.archived_at || p.workspace_id!==r.workspace_id)) throw new Error('The preview project is no longer available.');
  if (checks && checks.some(check => !check.matches)) {
    await finish('test', { error: null, output: { sampleSkipped:true, checks, steps:[], project:p && { id:p.id,job:p.job_code,title:p.title } } });
    return 'test';
  }
  if (!r.is_test && filters && filters.length && !matchFilters(filters, values)) {
    await finish('skipped', { error: 'The trigger’s Only when rules did not match' + (p ? ' ' + p.title : '') + '.', output: { trigger: why, project: p ? { id: p.id, job: p.job_code, title: p.title } : null } });
    return 'skipped';
  }

  const prev = r.output || {};
  const prior = prev.done || [];
  const steps: Step[] = (prev.steps || []).filter((x) => prior.includes(x.id || x.action));
  const done = prior.slice();
  const waited = (prev.waited || []).slice();
  const paths = { ...(prev.paths || {}) };
  let failure: Error | null = null;
  let waitMs = 0;
  let ask: PendingApproval | null = null; // an approval step the run stops at
  let rejected = '';                      // why the run stops for good at an approval step
  const decisions = prev.approvals || {};
  const overrides = prev.overrides || {};
  const log: LogLine[] = (prev.log || []).slice(-150);
  const note = (text: string, level?: 'error') => { log.push({ at: new Date().toISOString(), text, ...(level ? { level } : {}) }); };
  note((r.is_test ? 'Test started' : r.attempts > 1 ? 'Try ' + r.attempts + ' started' : 'Run started') + ': ' + why + (p || idea ? ' on ' + subject : ''));
  // One step: runs once, recorded under id (node id for flows, action key for older workflows).
  const step = async (id: string, action: string, fn: () => Promise<string>, received?: [string, string][]) => {
    if (done.includes(id)) return true;
    const t0 = Date.now();
    const stamp = () => ({ at: new Date().toISOString(), ms: Date.now() - t0, ...(received && received.length ? { received } : {}) });
    try {
      if (!r.is_test) {
        const claim = await admin.from('automation_effects').insert({ run_id: r.id, step_id: id, status: 'started' });
        if (claim.error) {
          if (claim.error.code !== '23505') throw new Permanent('Could not reserve this step: ' + claim.error.message);
          const priorEffect = await admin.from('automation_effects').select('status,detail').eq('run_id', r.id).eq('step_id', id).single();
          if (priorEffect.error || priorEffect.data?.status !== 'done') throw new Uncertain('This step may already have taken effect. Check the destination before creating a new run; automatic replay is held to prevent duplicates.');
          steps.push({ id, action, ok: true, detail: priorEffect.data.detail || 'Completed previously.', ...stamp() });
          done.push(id);
          return true;
        }
      }
      const detail = await fn();
      if (!r.is_test) {
        const saved = await admin.from('automation_effects').update({ status: 'done', detail, updated_at: new Date().toISOString() }).eq('run_id', r.id).eq('step_id', id);
        if (saved.error) throw new Uncertain('The action ran, but its confirmation could not be saved. Check the destination before retrying.');
      }
      steps.push({ id, action, ok: true, detail, ...stamp() });
      note(detail);
      done.push(id);
      const checkpoint = await admin.from('automation_runs').update({ output: { ...prev, done, steps, waited, paths, log } }).eq('id', r.id);
      if (checkpoint.error) throw new Uncertain('The action completed but the run checkpoint could not be saved.');
      return true;
    } catch (err) {
      failure = err instanceof Error ? err : new Error(String(err));
      if (!r.is_test && (err instanceof SafeRetry || (err instanceof Permanent && !(err instanceof Uncertain)))) {
        const released = await admin.from('automation_effects').delete().eq('run_id', r.id).eq('step_id', id).eq('status', 'started');
        if (released.error) failure = new Permanent('Step reservation could not be released. Check its destination before retrying.');
      } else if (!r.is_test) {
        await admin.from('automation_effects').update({ status: 'uncertain', detail: failure.message, updated_at: new Date().toISOString() }).eq('run_id', r.id).eq('step_id', id).eq('status', 'started');
        failure = new Permanent(failure.message + ' Check this step’s destination before starting a replacement run.');
      }
      steps.push({ id, action, ok: false, detail: failure.message, ...stamp() });
      note(failure.message, 'error');
      return false;
    }
  };
  const walkSteps = async (list: Node[]): Promise<boolean> => {
    for (const [i, n] of list.entries()) {
      if (n.type === 'note') continue;
      // An approval step parks the run until a Super Admin decides (app/api/automations/approvals/[id]). Approved:
      // carry on. Rejected, or nobody decided in time: the run stops and nothing after it happens.
      if (n.type === 'approval') {
        if (done.includes(n.id)) continue;
        if (r.is_test) { if (!(await step(n.id, 'approval', async () => 'Would pause here until a Super Admin approves.'))) return false; continue; }
        const dec = decisions[n.id];
        if (dec && dec.decision === 'approved') { if (!(await step(n.id, 'approval', async () => 'Approved by ' + dec.by + '.'))) return false; continue; }
        const pending = prev.approval && prev.approval.stepId === n.id ? prev.approval : null;
        if (dec && dec.decision === 'rejected') rejected = 'Rejected by ' + dec.by + ', so the run stopped.';
        else if (pending && pending.expiresAt && Date.parse(pending.expiresAt) <= Date.now()) rejected = 'Nobody approved "' + (n.title || 'Approval') + '" in time, so the run stopped.';
        else ask = pending || approvalFor(n, list.slice(i + 1), ctx, facts);
        if (rejected) { steps.push({ id: n.id, action: 'approval', ok: false, detail: rejected, at: new Date().toISOString(), ms: 0 }); note(rejected, 'error'); }
        return false;
      }
      if (cannotRunYet(n)) {
        if (!(await step(n.id, n.type, async () => { throw new Permanent((n.title || 'This step') + ' cannot run yet. Remove it or keep the workflow as a draft.'); }))) return false;
        continue;
      }
      if (n.type === 'data') {
        if (!(await step(n.id, 'data', async () => (p ? (r.is_test ? 'Would load ' : 'Loaded ') + p.title + ' (' + p.job_code + ').' : 'There is no project on this run.')))) return false;
        continue;
      }
      if (n.type === 'split') {
        const all = n.paths || [];
        let pick = all.find((x) => x.id === paths[n.id]);
        if (!pick) {
          pick = all.find((x, i) => i < all.length - 1 && matchPath(x, values)) || all[all.length - 1];
          if (!pick) continue;
          paths[n.id] = pick.id;
          steps.push({ id: n.id, action: 'split', ok: true, detail: (n.name || 'Branch') + ': took ' + pick.name + '.', at: new Date().toISOString(), ms: 0 });
          note((n.name || 'Branch') + ': took ' + pick.name + '.');
          done.push(n.id);
          const saved = await admin.from('automation_runs').update({ output: { ...prev, done, steps, waited, paths, log } }).eq('id', r.id);
          if (saved.error) throw new Permanent('Could not save the chosen workflow branch.');
        }
        if (!(await walkSteps(pick.steps))) return false;
        continue;
      }
      if (n.type === 'delay') {
        if (done.includes(n.id)) continue;
        const ms = (Number(n.amount) || 0) * (n.unit === 'minutes' ? 60000 : n.unit === 'hours' ? 3600000 : 86400000);
        const text = delayText(n);
        if (!r.is_test && ms > 0 && !waited.includes(n.id)) { waited.push(n.id); waitMs = ms; note('Waiting: ' + text.replace(/^Wait /, '') + '.'); return false; }
        await step(n.id, 'delay', async () => (r.is_test ? 'Would ' + text.toLowerCase() + '.' : text.replace(/^Wait/, 'Waited') + '.'));
        continue;
      }
      if (n.type === 'task') {
        if (!(await step(n.id, 'task', () => addTask(n, ctx), [['Task', fillTokens(n.title || a.name, tokens)], ...(n.note ? [['Notes', fillTokens(n.note, tokens)] as [string, string]] : [])]))) return false;
        continue;
      }
      if (n.type === 'action' && n.key) {
        const key = n.key;
        // An approver may have edited what this step sends (output.overrides).
        const message = overrides[n.id] != null ? overrides[n.id] : n.message || '';
        if (!(await step(n.id, key, () => perform(key, message, ctx), [[onIdea ? 'Idea' : 'Project', subject], ...(message ? [['Message', fillTokens(message, tokens)] as [string, string]] : [])]))) return false;
      }
    }
    return true;
  };
  if (graph && r.is_test && filters && filters.length) steps.push({ id: 'trigger', action: 'filter', ok: true, detail: matchFilters(filters, values) ? 'The Only when rules match this project.' : 'The Only when rules do not match this project, so a real run would stop here. The steps below show what would happen if they did.' });
  if (graph) await walkSteps(graph.steps);
  else for (const act of actionsOf(a.actions)) if (!(await step(act.key, act.key, () => perform(act.key, act.message, ctx)))) break;
  const waitClaims = prev.waitClaims || 0;
  const output: Output & Record<string, unknown> = { ...(checks ? {checks} : {}), done, steps, waited, waitClaims, paths, log, approvals: decisions, overrides, trigger: why, project: p ? { id: p.id, job: p.job_code, title: p.title } : null,
    ...(onIdea ? { idea: idea ? { id: idea.id, title: idea.title } : null } : {}) };

  // An approval: park the run until someone decides, or until it times out. Super Admins are told once.
  if (ask && !failure) {
    const asked: PendingApproval = ask;
    const fresh = !prev.approval || prev.approval.stepId !== asked.stepId;
    if (fresh) note('Waiting for approval: ' + asked.title + '.');
    await finish('retry', { output: { ...output, waiting: true, approval: asked, waitClaims: waitClaims + 1 }, error: null, next_attempt_at: asked.expiresAt || new Date(Date.now() + 14 * 86400000).toISOString() });
    if (fresh) await notifyApproval(ctx, asked);
    return 'waiting';
  }
  if (rejected && !failure) {
    await finish('skipped', { output: { ...output, approval: null }, error: rejected, next_attempt_at: null });
    return 'skipped';
  }

  // A delay: park the run until it is due. The claim counts it as a try, so tries below leave delays out.
  if (waitMs && !failure) {
    await finish('retry', { output: { ...output, waiting: true, waitClaims: waitClaims + 1 }, error: null, next_attempt_at: new Date(Date.now() + waitMs).toISOString() });
    return 'waiting';
  }

  if (!failure) {
    note(r.is_test ? 'Test finished. Nothing was sent.' : 'Run finished.');
    await finish(r.is_test ? 'test' : 'done', { output, error: null, next_attempt_at: null });
    if (!r.is_test) await admin.from('automations').update({ run_count: (a.run_count || 0) + 1, last_run_at: new Date().toISOString() }).eq('id', a.id);
    return r.is_test ? 'test' : 'done';
  }
  const fail: Error = failure;
  const tries = r.attempts - waitClaims;
  const maxTries = fs && fs.retries != null ? 1 + Math.max(0, Math.min(5, Number(fs.retries) || 0)) : MAX_TRIES;
  const waitMin = fs && fs.retryWait ? WAIT_MIN[fs.retryWait] || RETRY_MIN : RETRY_MIN * Math.max(1, tries);
  const retry = !r.is_test && auto.retry !== false && !(fail instanceof Permanent) && tries < maxTries;
  if (retry) {
    note('Will try again in ' + waitMin + (waitMin === 1 ? ' minute.' : ' minutes.'));
    await finish('retry', { output, error: fail.message, next_attempt_at: new Date(Date.now() + waitMin * 60000).toISOString() });
    return 'retry';
  }
  note(r.is_test ? 'Test stopped.' : 'Run failed' + (tries > 1 ? ' after ' + tries + ' tries.' : '.'), 'error');
  await finish('failed', { output, error: fail.message, next_attempt_at: null });
  if (r.is_test) return 'failed';
  // Auto-pause: this many failed runs in a row turns the workflow off.
  const limit = fs ? Math.max(0, Number(fs.autoOffAfter) || 0) : 0;
  let turnedOff = false;
  if (limit > 0) {
    const recent = await admin.from('automation_runs').select('status').eq('automation_id', a.id).eq('is_test', false).in('status', ['done', 'failed']).order('created_at', { ascending: false }).limit(limit);
    if (!recent.error && (recent.data || []).length >= limit && (recent.data || []).every((x) => x.status === 'failed')) {
      const off = await admin.from('automations').update({ enabled: false }).eq('id', a.id);
      turnedOff = !off.error;
      if (turnedOff) await logAutomation(ctx, 'turned off "' + a.name + '" after ' + limit + ' failed runs in a row');
    }
  }
  if (auto.failAlert !== false) {
    await alertFailure(ctx, fail.message + (turnedOff ? ' The workflow was turned off after ' + limit + ' failed runs in a row.' : ''), fs && fs.alert ? fs.alert : null, graph && graph.owner ? graph.owner : null);
    note('Failure alert sent.');
    await admin.from('automation_runs').update({ output }).eq('id', r.id);
  }
  return 'failed';
}

// What a Super Admin is asked to approve: the step after the approval, with its message filled in for this run.
function approvalFor(n: Node, rest: Node[], ctx: Ctx, facts: Facts | null): PendingApproval {
  const next = rest.find((x) => x.type === 'action' || x.type === 'task') || null;
  const def = next && next.type === 'action' && next.key ? actionById(next.key) : null;
  const hours = n.timeoutHours == null ? 24 : Math.max(0, Number(n.timeoutHours) || 0);
  const label = next ? (next.title || (def ? def.label : next.type === 'task' ? 'Add a task' : 'the next step')) : '';
  const to = !next ? '' : next.type === 'task' ? 'The task owner, on their Daily page'
    : next.key === 'email_editor' ? (facts && facts.editor) || 'The assigned editor' : next.key === 'email_designer' ? (facts && facts.designer) || 'The assigned designer' : RECIPIENT[next.key || ''] || (def ? def.app : '');
  const t = ctx.tokens;
  const context = ([['Project', t['project.title']], ['Job', t['project.job']], ['Stage', t['project.status']], ['Sponsor', t['project.sponsor']], ['Editor', t['project.editor']], ['Designer', t['project.designer']],
    ['Channel', t['project.channel']], ['Publish date', t['project.publish_date']], ['Idea', t['idea.title']], ['Idea stage', t['idea.stage']]] as [string, string][]).filter((x) => !!x[1]);
  return {
    stepId: n.id, title: n.title || 'Approval', askedAt: new Date().toISOString(), expiresAt: hours ? new Date(Date.now() + hours * 3600000).toISOString() : null,
    reason: n.note || (def && def.key === 'buffer_publish' ? 'The next step posts publicly. Anything that leaves the studio waits for a Super Admin.' : 'This workflow pauses here until a Super Admin signs off.'),
    after: next ? label + (def && def.app ? ' through ' + def.app : '') : 'The workflow carries on',
    draft: next ? { stepId: next.id, to, subject: label + (ctx.p ? ': ' + ctx.p.title : ctx.idea ? ': ' + ctx.idea.title : ''), body: fillTokens(next.type === 'task' ? next.note || next.title || '' : next.message || '', t) } : null,
    context,
  };
}

async function notifyApproval(ctx: Ctx, ask: PendingApproval) {
  const admin = supabaseAdmin();
  const people = await admins(ctx.r.workspace_id);
  if (!people.length) return;
  const ins = await admin.from('notifications').insert(people.map((x) => ({
    workspace_id: ctx.r.workspace_id, user_id: x.id, event: 'automation', actor_label: 'Automation', text: 'automation "' + ctx.a.name + '" is waiting for your approval on',
    target_label: ctx.p ? ctx.p.title : ctx.idea ? ctx.idea.title : ctx.a.name, quote: ask.title + (ask.after ? '. After you approve: ' + ask.after + '.' : ''), project_id: ctx.p ? ctx.p.id : null,
  })));
  if (ins.error) console.warn('notifications', ins.error.message);
}

// A Super Admin's decision on a waiting approval. The run is queued again and the runner carries on (approved) or
// stops it (rejected). body: an edited message for the step the approval covers.
export async function decideApproval(workspaceId: string, runId: string, who: { id: string; name: string }, decision: 'approve' | 'reject', body?: string) {
  const admin = supabaseAdmin();
  const cur = await admin.from('automation_runs').select('id, status, output').eq('id', runId).eq('workspace_id', workspaceId).maybeSingle();
  if (cur.error || !cur.data) return { status: 404 as const, error: 'That approval was not found.' };
  const out = (cur.data.output || {}) as Output;
  const ask = out.approval;
  if (cur.data.status !== 'retry' || !ask) return { status: 409 as const, error: 'This approval was already decided, or the run has moved on.' };
  const next: Output = {
    ...out, waiting: false, approval: null,
    approvals: { ...(out.approvals || {}), [ask.stepId]: { decision: decision === 'approve' ? 'approved' : 'rejected', by: who.name, byId: who.id, at: new Date().toISOString() } },
    overrides: decision === 'approve' && ask.draft && typeof body === 'string' && body !== ask.draft.body ? { ...(out.overrides || {}), [ask.draft.stepId]: body } : out.overrides,
    log: (out.log || []).concat([{ at: new Date().toISOString(), text: (decision === 'approve' ? 'Approved by ' : 'Rejected by ') + who.name + '.' }]),
  };
  // Only a run still waiting on this approval moves: two Super Admins deciding at once cannot both win.
  const res = await admin.from('automation_runs').update({ status: 'queued', next_attempt_at: null, output: next }).eq('id', runId).eq('workspace_id', workspaceId).eq('status', 'retry').select('id');
  if (res.error) return { status: 500 as const, error: res.error.message };
  if (!(res.data || []).length) return { status: 409 as const, error: 'This approval was already decided.' };
  return { status: 200 as const };
}

type Ctx = {
  scheduleRule: string; timezone: string;
  r: Run; a: Automation; p: Project | null; idea: Idea | null; onIdea: boolean; statuses: { id: string; label: string; sort: number }[]; statusName: (id: string | null | undefined) => string;
  why: string; link: string; base: string; subject: string; workspace: string; test: boolean; tokens: Record<string, string>;
};

async function factsOf(p: Project): Promise<Facts> {
  const admin = supabaseAdmin();
  const [ch, sp, ed, th] = await Promise.all([
    p.channel_id ? admin.from('channels').select('name').eq('id', p.channel_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('sponsorships').select('account_id, approval_status').eq('project_id', p.id).limit(1).maybeSingle(),
    admin.from('project_edits').select('editor_id, edit_status').eq('project_id', p.id).maybeSingle(),
    admin.from('project_thumbnails').select('designer_id, thumb_status').eq('project_id', p.id).maybeSingle(),
  ]);
  const s = sp.data as { account_id: string; approval_status: string } | null;
  const e = ed.data as { editor_id: string | null; edit_status: string | null } | null;
  const t = th.data as { designer_id: string | null; thumb_status: string | null } | null;
  const ids = [e && e.editor_id, t && t.designer_id].filter(Boolean) as string[];
  const [acct, people] = await Promise.all([
    s ? admin.from('accounts').select('name').eq('id', s.account_id).maybeSingle() : Promise.resolve({ data: null }),
    ids.length ? admin.from('profiles').select('id, full_name, email').in('id', ids) : Promise.resolve({ data: [] }),
  ]);
  const nameOf = (id: string | null | undefined) => {
    const x = ((people.data || []) as { id: string; full_name: string; email: string }[]).find((y) => y.id === id);
    return x ? x.full_name || x.email : '';
  };
  return {
    channel: ((ch.data || {}) as { name?: string }).name || '', sponsorId: s ? s.account_id : null, sponsor: ((acct.data || {}) as { name?: string }).name || '',
    approval: s ? s.approval_status : '', editorId: e ? e.editor_id : null, editor: nameOf(e && e.editor_id), editStatus: (e && e.edit_status) || '',
    designerId: t ? t.designer_id : null, designer: nameOf(t && t.designer_id), thumbStatus:t?.thumb_status || '',
  };
}

// What rules check on the run's project (graph.ts matchCrit). Without a project nothing matches, so a branch takes
// its last path and a filtered trigger does not run.
function valuesOf(p: Project | null, f: Facts | null, statusName: (id: string | null | undefined) => string): RuleValues | null {
  if (!p || !f) return null;
  return {
    status: statusName(p.status_id), channel: p.channel_id, type: p.content_type_id, sponsor: f.sponsorId, approval: f.approval || null,
    editor: f.editorId, edit_status: f.editStatus || null, thumb_status:f.thumbStatus || null, designer: f.designerId, publish_date: p.publish_date,
  };
}

// A task step: a To-Do for its owner, or for every Super Admin when it has none.
async function addTask(n: Node, ctx: Ctx): Promise<string> {
  const admin = supabaseAdmin();
  const note = fillTokens(n.note || '', ctx.tokens).trim();
  const text = (fillTokens(n.title || ctx.a.name, ctx.tokens) + (ctx.p ? ': ' + ctx.p.title + ' (' + ctx.p.job_code + ')' : '') + (note ? ' — ' + note : '')).slice(0, 500);
  let owners: string[] = [];
  if (n.owner) {
    const m = await admin.from('workspace_members').select('user_id').eq('workspace_id', ctx.r.workspace_id).eq('user_id', n.owner).eq('status', 'active').maybeSingle();
    if (m.data) owners = [n.owner];
  }
  if (!owners.length) owners = (await admins(ctx.r.workspace_id)).map((x) => x.id);
  if (!owners.length) throw new Permanent('There is nobody to give the task to.');
  if (ctx.test) return 'Would add the task "' + text + '" for ' + owners.length + ' ' + (owners.length === 1 ? 'person' : 'people') + '.';
  const ins = await admin.from('tasks').insert(owners.map((o) => ({ workspace_id: ctx.r.workspace_id, owner_id: o, text, priority: 'med', project_id: ctx.p ? ctx.p.id : null })));
  if (ins.error) throw new SafeRetry(ins.error.message);
  return 'Added the task "' + text + '" for ' + owners.length + ' ' + (owners.length === 1 ? 'person' : 'people') + '.';
}

async function admins(ws: string) {
  const admin = supabaseAdmin();
  const m = await admin.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('role', 'super_admin').eq('status', 'active');
  const ids = (m.data || []).map((x) => x.user_id as string);
  if (!ids.length) return [];
  const p = await admin.from('profiles').select('id, full_name, email').in('id', ids);
  return (p.data || []) as { id: string; full_name: string; email: string }[];
}

async function logAutomation(ctx: Ctx, action: string) {
  const row: Record<string, string | null> = ctx.idea
    ? { workspace_id: ctx.r.workspace_id, actor_label: 'Automation', category: 'idea', action, target_type: 'idea', target_id: ctx.idea.id, target_label: ctx.idea.title, idea_id: ctx.idea.id, source: 'automation' }
    : { workspace_id: ctx.r.workspace_id, actor_label: 'Automation', category: 'project', action, target_type: ctx.p ? 'project' : 'automation',
      target_id: ctx.p ? ctx.p.id : ctx.a.id, target_label: ctx.p ? ctx.p.title : ctx.a.name, project_id: ctx.p ? ctx.p.id : null, source: 'automation' };
  const res = await supabaseAdmin().from('activity_log').insert(row);
  if (res.error) console.warn('activity_log', res.error.message);
}

async function perform(key: string, message: string, ctx: Ctx): Promise<string> {
  const admin = supabaseAdmin();
  const def = actionById(key);
  if (!def) throw new Permanent('Unknown action ' + key + '.');
  const { p, a } = ctx;
  const note = fillTokens(message || '', ctx.tokens).trim();

  if (key === 'slack_production_digest') {
    if (ctx.r.trigger_key !== 'schedule') throw new Permanent('Choose a schedule for the production digest.');
    try {
      return await deliverProductionDigest({
        workspaceId: ctx.r.workspace_id, runId: ctx.r.id, channel: message.trim(), rule: ctx.scheduleRule,
        timezone: ctx.timezone, slot: ctx.r.payload?.slot, baseUrl: ctx.base, preview: ctx.test,
      });
    } catch (err) {
      if (err instanceof DigestSetupError) throw new Permanent(err.message);
      if (err instanceof DigestRetryError) throw new SafeRetry(err.message);
      throw err;
    }
  }

  if (key === 'slack_admin') {
    const text = '*' + a.name + '*: ' + ctx.why + (p || ctx.idea ? ' on ' + ctx.subject : '') + (note ? '\n' + note : '') + '\n' + ctx.link;
    if (ctx.test) {
      const conn = await getIntegration(ctx.r.workspace_id, 'slack').catch(() => null);
      return conn ? 'Would post to Slack: ' + text.split('\n')[0] : 'Would post to Slack, but Slack is not connected yet.';
    }
    if (!(await getIntegration(ctx.r.workspace_id, 'slack'))) throw new Permanent('Slack is not connected.');
    const sent = await postSlackAlert(ctx.r.workspace_id, text);
    return 'Posted to Slack (' + sent.channel + ').';
  }

  if (key === 'email_editor' || key === 'email_designer') {
    const editor = key === 'email_editor';
    if (!p) throw new Permanent('This run has no project, so there is nobody to email.');
    const row = editor
      ? await admin.from('project_edits').select('editor_id').eq('project_id', p.id).maybeSingle()
      : await admin.from('project_thumbnails').select('designer_id').eq('project_id', p.id).maybeSingle();
    const uid = row.data ? (editor ? (row.data as { editor_id: string | null }).editor_id : (row.data as { designer_id: string | null }).designer_id) : null;
    if (!uid) throw new Permanent('No ' + (editor ? 'editor' : 'designer') + ' is assigned to ' + ctx.subject + '.');
    const prof = (await admin.from('profiles').select('full_name, email').eq('id', uid).maybeSingle()).data as { full_name: string; email: string } | null;
    if (!prof || !prof.email) throw new Permanent('The assigned ' + (editor ? 'editor' : 'designer') + ' has no email address.');
    if (ctx.test) return 'Would email ' + prof.email + ' about ' + ctx.subject + '.';
    const tpl = buildMessageEmail({
      workspace: ctx.workspace, tone: { label: 'Automation', bg: '#2F5BD3' }, subject: a.name + ': ' + p.title,
      heading: a.name, lead: ctx.why + ' on ' + p.title + '.', note: note || undefined,
      cards: [{ title: p.title, rows: [['Job', p.job_code], ['Status', ctx.statusName(p.status_id)]] }],
      cta: { label: 'Open the project', url: ctx.link },
      fine: 'A ' + ctx.workspace + ' automation sent this email because you are the assigned ' + (editor ? 'editor' : 'designer') + '.',
    });
    const res = await sendEmail({ to: prof.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    if (!res.sent) throw new Error('Email to ' + prof.email + ' did not send: ' + res.error);
    return 'Emailed ' + prof.email + ' (Resend ' + res.id + ').';
  }

  if (key === 'status_next') {
    if (!p) throw new Permanent('This run has no project to move.');
    const i = ctx.statuses.findIndex((x) => x.id === p.status_id);
    const next = i >= 0 ? ctx.statuses[i + 1] : null;
    if (!next) throw new Permanent(ctx.subject + ' is already on the last status.');
    // The service key skips the database guards, so the runner checks the same workflow rules itself.
    const settings = await admin.from('workspace_settings').select('require_sponsor_approval, lock_after_live').eq('workspace_id', p.workspace_id).maybeSingle();
    if (settings.error || !settings.data) throw new SafeRetry('Workflow rules could not be loaded.');
    const s = settings.data as { require_sponsor_approval: boolean; lock_after_live: boolean };
    if (s && s.lock_after_live && ctx.statusName(p.status_id) === 'Live') throw new Permanent('Live projects are locked.');
    if (s && s.require_sponsor_approval && (next.label === 'Scheduled' || next.label === 'Live')) {
      const sp = await admin.from('sponsorships').select('id').eq('project_id', p.id).neq('approval_status', 'approved');
      if (sp.error) throw new SafeRetry('Sponsor approval could not be checked.');
      if ((sp.data || []).length) throw new Permanent('Sponsor approval is required before ' + ctx.subject + ' can move to ' + next.label + '.');
    }
    if (ctx.test) return 'Would move ' + ctx.subject + ' from ' + ctx.statusName(p.status_id) + ' to ' + next.label + '.';
    const up = await admin.from('projects').update({ status_id: next.id }).eq('id', p.id).eq('status_id', p.status_id).select('id').maybeSingle();
    if (up.error) throw new SafeRetry(up.error.message);
    if (!up.data) throw new Permanent(ctx.subject + ' changed status before the automation could move it.');
    await logAutomation(ctx, 'moved Status to ' + next.label + ' on');
    return 'Moved Status from ' + ctx.statusName(p.status_id) + ' to ' + next.label + '.';
  }

  if (key === 'todo_admin') {
    const people = await admins(ctx.r.workspace_id);
    if (!people.length) throw new Permanent('There is no active Super Admin.');
    const text = (note || a.name) + (p ? ': ' + p.title + ' (' + p.job_code + ')' : ctx.idea ? ': ' + ctx.idea.title : '');
    if (ctx.test) return 'Would add the To-Do "' + text + '" for ' + people.length + ' Super Admin' + (people.length === 1 ? '' : 's') + '.';
    const ins = await admin.from('tasks').insert(people.map((x) => ({ workspace_id: ctx.r.workspace_id, owner_id: x.id, text, priority: 'high', project_id: p ? p.id : null })));
    if (ins.error) throw new SafeRetry(ins.error.message);
    return 'Added the To-Do "' + text + '" for ' + people.length + ' Super Admin' + (people.length === 1 ? '' : 's') + '.';
  }

  if (key === 'webhook_n8n') {
    const conn = await getIntegration(ctx.r.workspace_id, 'n8n');
    const body = {
      type: ctx.test ? 'test' : 'automation', at: new Date().toISOString(),
      automation: { id: a.id, name: a.name }, trigger: { key: ctx.r.trigger_key, text: ctx.why, ...(ctx.r.payload || {}) },
      project: p ? { id: p.id, job: p.job_code, title: p.title, status: ctx.statusName(p.status_id), publish_date: p.publish_date, link: ctx.link } : null,
      ...(ctx.onIdea ? { idea: ctx.idea ? { id: ctx.idea.id, title: ctx.idea.title, stage: ctx.idea.stage, score: ctx.tokens['idea.score'] || null, link: ctx.link } : null } : {}),
      run: ctx.r.id,
    };
    if (!conn) {
      if (ctx.test) return 'Would POST the run to n8n, but n8n is not connected yet.';
      throw new Permanent('n8n is not connected.');
    }
    if (ctx.test) return 'Would POST to the n8n webhook: ' + JSON.stringify(body).slice(0, 160) + '…';
    const res = await postN8n(conn.secret, conn.config, body);
    return 'n8n answered ' + res.status + (res.reply ? ': ' + res.reply.slice(0, 120) : '.');
  }
  if (key === 'buffer_draft') {
    if (!p || p.workspace_id !== ctx.r.workspace_id) throw new Permanent('Select a project in this workspace to create a Buffer draft.');
    const { draftProjectToBuffer } = await import('@/lib/integrations/buffer-drafts');
    let res;
    try {
      res = await draftProjectToBuffer(p, { runId: ctx.test ? null : ctx.r.id, test: ctx.test });
    } catch (e) {
      if (e instanceof PublishSetupError) throw new Permanent(e.message);
      throw new SafeRetry(e instanceof Error ? e.message : String(e));
    }
    if (res.retry) throw new SafeRetry(res.detail);
    if (res.failed) throw new Permanent(res.detail);
    return res.detail;
  }
  if (key === 'buffer_publish') {
    if (!p) throw new Permanent('This run has no project to publish.');
    let res;
    try {
      res = await publishProjectToBuffer(p, { runId: ctx.test ? null : ctx.r.id, test: ctx.test });
    } catch (err) {
      if (err instanceof PublishSetupError) throw new Permanent(err.message);
      throw err;
    }
    // Channels that posted are recorded and skipped on a retry, so only the failed ones are tried again.
    if (res.failed.length) throw new Uncertain(res.detail);
    if (!ctx.test) await logAutomation(ctx, 'published to Buffer');
    return res.detail;
  }
  if (key.startsWith('idea_')) return performIdea(key, note, ctx);
  throw new Permanent('Unknown action ' + key + '.');
}

// Actions on the run's idea.
async function performIdea(key: string, note: string, ctx: Ctx): Promise<string> {
  const admin = supabaseAdmin();
  const i = ctx.idea;
  if (!i) throw new Permanent('This run has no idea' + (ctx.onIdea ? ' (it was deleted).' : '; idea actions only fit idea triggers.'));
  if (i.archived_at && !ctx.test) {
    // Approval and auto-archive commit together. The queued Approved event may still notify its owner.
    const approvalNotice = (key === 'idea_email_owner' || key === 'idea_todo_owner')
      && ctx.r.trigger_key === 'idea_stage' && ctx.r.payload?.to === 'approved'
      && i.stage === 'approved' && i.project_id && i.approved_at === i.archived_at;
    if (!approvalNotice) throw new Permanent(ctx.subject + ' is archived.');
  }
  const stage = STAGE_LABEL[i.stage] || i.stage;

  if (key === 'idea_research') {
    if (ctx.test) return 'Would queue research on ' + ctx.subject + '.';
    const { queueIdeaResearchFor } = await import('@/lib/ideas/research');
    const out = await queueIdeaResearchFor(i.id, 'automation');
    if ('runId' in out) { await logAutomation(ctx, 'queued research on'); return 'Queued research on ' + ctx.subject + '. It starts within a couple of minutes.'; }
    if (out.skipped) return out.error + ' Nothing new was queued.';
    throw new Permanent(out.error);
  }

  if (key === 'idea_stage_next') {
    const next = NEXT_STAGE[i.stage];
    if (!next) throw new Permanent(i.stage === 'ready' ? ctx.subject + ' is Ready. Approving it needs a person to choose what it becomes.' : ctx.subject + ' is already ' + stage + '.');
    if (ctx.test) return 'Would move ' + ctx.subject + ' from ' + stage + ' to ' + STAGE_LABEL[next] + '.';
    // The stage gate (app.gate_idea_stage) checks the move for every writer, the service key included.
    const up = await admin.from('ideas').update({ stage: next }).eq('id', i.id).eq('stage', i.stage).select('id').maybeSingle();
    if (up.error) { if (up.error.code === '23514') throw new Permanent(up.error.message); throw new SafeRetry(up.error.message); }
    if (!up.data) throw new Permanent(ctx.subject + ' changed stage before the automation could move it.');
    await logAutomation(ctx, 'moved Stage to ' + STAGE_LABEL[next] + ' on');
    return 'Moved ' + ctx.subject + ' from ' + stage + ' to ' + STAGE_LABEL[next] + '.';
  }

  const uid = i.owner_id || i.author_id;
  if (!uid) throw new Permanent(ctx.subject + ' has no owner.');
  const m = await admin.from('workspace_members').select('user_id').eq('workspace_id', ctx.r.workspace_id).eq('user_id', uid).eq('status', 'active').maybeSingle();
  if (!m.data) throw new Permanent('The owner of ' + ctx.subject + ' is no longer an active member.');
  const prof = (await admin.from('profiles').select('full_name, email').eq('id', uid).maybeSingle()).data as { full_name: string; email: string } | null;
  const who = prof ? prof.full_name || prof.email : 'the owner';

  if (key === 'idea_todo_owner') {
    const text = ((note || ctx.a.name) + ': ' + i.title).slice(0, 500);
    if (ctx.test) return 'Would add the To-Do "' + text + '" for ' + who + '.';
    const ins = await admin.from('tasks').insert({ workspace_id: ctx.r.workspace_id, owner_id: uid, text, priority: 'med', project_id: null });
    if (ins.error) throw new SafeRetry(ins.error.message);
    return 'Added the To-Do "' + text + '" for ' + who + '.';
  }

  if (key === 'idea_email_owner') {
    if (!prof || !prof.email) throw new Permanent('The owner of ' + ctx.subject + ' has no email address.');
    if (ctx.test) return 'Would email ' + prof.email + ' about ' + ctx.subject + '.';
    const tpl = buildMessageEmail({
      workspace: ctx.workspace, tone: { label: 'Automation', bg: '#2F5BD3' }, subject: ctx.a.name + ': ' + i.title,
      heading: ctx.a.name, lead: ctx.why + ': ' + i.title + '.', note: note || undefined,
      cards: [{ title: i.title, rows: [['Stage', stage]].concat(ctx.tokens['idea.score'] ? [['Score', ctx.tokens['idea.score'] + ' of 100']] : []) as [string, string][] }],
      cta: { label: 'Open the idea', url: ctx.link },
      fine: 'A ' + ctx.workspace + ' automation sent this email because you own this idea.',
    });
    const res = await sendEmail({ to: prof.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    if (!res.sent) throw new Error('Email to ' + prof.email + ' did not send: ' + res.error);
    return 'Emailed ' + prof.email + ' (Resend ' + res.id + ').';
  }
  throw new Permanent('Unknown action ' + key + '.');
}

// Alert on failures: an in-app notification for each Super Admin, an email, and Slack when it is connected.
// alert: the workflow's "Then alert" choices ('admins', 'owner', 'slack'); null keeps the workspace rule (the Super
// Admins, plus Slack when it is connected).
async function alertFailure(ctx: Ctx, error: string, alert: string[] | null = null, ownerId: string | null = null) {
  const admin = supabaseAdmin();
  const want = (k: string) => !alert || alert.includes(k);
  let people = want('admins') ? await admins(ctx.r.workspace_id) : [];
  if (alert && alert.includes('owner') && ownerId && !people.some((x) => x.id === ownerId)) {
    const o = await admin.from('profiles').select('id, full_name, email').eq('id', ownerId).maybeSingle();
    if (o.data) people = people.concat([o.data as { id: string; full_name: string; email: string }]);
  }
  const text = 'automation "' + ctx.a.name + '" failed on';
  if (people.length) {
    const ins = await admin.from('notifications').insert(people.map((x) => ({
      workspace_id: ctx.r.workspace_id, user_id: x.id, event: 'automation', actor_label: 'Automation', text, target_label: ctx.p ? ctx.p.title : ctx.idea ? ctx.idea.title : ctx.a.name, quote: error, project_id: ctx.p ? ctx.p.id : null,
    })));
    if (ins.error) console.warn('notifications', ins.error.message);
  }
  for (const x of people) {
    if (!x.email) continue;
    const tpl = buildMessageEmail({
      workspace: ctx.workspace, tone: { label: 'Automation failed', bg: '#C42B2F' }, subject: 'Automation failed: ' + ctx.a.name,
      heading: 'An automation failed', lead: '"' + ctx.a.name + '" (' + ctx.why + ') could not finish' + (ctx.p ? ' on ' + ctx.subject : '') + '.',
      note: error, cta: { label: 'Open Automations', url: ctx.base + '/admin/automations' },
      fine: 'You get this email because Alert on failures is on in Automations > Settings.',
    });
    const res = await sendEmail({ to: x.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    if (!res.sent) console.warn('automation alert email', res.error);
  }
  if (want('slack') && await getIntegration(ctx.r.workspace_id, 'slack').catch(() => null)) {
    await postSlackAlert(ctx.r.workspace_id, ':warning: Automation *' + ctx.a.name + '* failed' + (ctx.p ? ' on ' + ctx.subject : '') + ': ' + error).catch((e) => console.warn('slack alert', e));
  }
}
