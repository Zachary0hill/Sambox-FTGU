import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { buildMessageEmail } from '@/lib/email/message-template';
import { getIntegration } from '@/lib/integrations/secrets';
import { postSlackAlert } from '@/lib/integrations/providers/slack';
import { postN8n } from '@/lib/integrations/providers/n8n';
import { publishProjectToBuffer, PublishSetupError } from '@/lib/integrations/buffer-publish';
import { actionById, actionsOf, triggerOf, triggerText } from './catalog';
import { isGraph, graphOf, fillTokens, delayText, FIELDS, type Node, type Crit } from './graph';

// The automation runner. Database triggers queue automation_runs rows when a live workflow's trigger fires; each tick
// (the board after a change, and a scheduler with CRON_SECRET) queues scheduled triggers, claims due runs, performs
// their actions with the secret key, and records the outcome on the run:
//   done     every action worked; output lists what each one did
//   retry    an action failed and Retry failed runs is on: tried again 5 and 10 minutes later (three tries in all)
//   failed   out of tries, or a failure retrying cannot fix (no editor assigned, not connected)
//   skipped  the workflow was turned off or deleted, or Pause all automations is on
//   test     a Test run: actions described, nothing sent or changed
// Actions that already worked are not repeated on a retry (output.done), so a retry never double-posts.
//
// Flows built in the flow builder (lib/automations/graph.ts) walk their graph instead: a split takes the first path
// whose criteria match the project (remembered in output.paths, so a resumed run keeps its path), a delay parks the
// run as retry with output.waiting until it is due, and a task adds a To-Do. output.done then lists node ids.
// Processes and ideas never run.

type Run = {
  id: string; automation_id: string; workspace_id: string; project_id: string | null; trigger_key: string | null; status: string;
  payload: Record<string, unknown> | null; output: Output | null; attempts: number; is_test: boolean;
};
// waitClaims: claims spent resuming from delays since the last manual retry; tries leave them out.
type Output = { done?: string[]; steps?: Step[]; waited?: string[]; waitClaims?: number; paths?: Record<string, string>; waiting?: boolean };
type Step = { id?: string; action: string; ok: boolean; detail: string };
type Automation = { id: string; workspace_id: string; name: string; enabled: boolean; is_draft: boolean; trigger: Record<string, string>; actions: unknown; flow: unknown; run_count: number };
type Settings = { workspace_id: string; automation: { paused?: boolean; retry?: boolean; failAlert?: boolean } | null; timezone: string };
type Project = {
  id: string; workspace_id: string; title: string; job_code: string; status_id: string; publish_date: string | null; archived_at: string | null;
  channel_id: string | null; content_type_id: string | null;
};
// What splits check and tokens fill: the project's people, sponsor and channel.
type Facts = {
  channel: string; sponsorId: string | null; sponsor: string; approval: string; editorId: string | null; editor: string; editStatus: string;
  designerId: string | null; designer: string;
};

const MAX_TRIES = 3;
const RETRY_MIN = 5;

// A failure that trying again cannot fix.
class Permanent extends Error {}

export type RunSummary = { scheduled: number; done: number; retried: number; waiting: number; failed: number; skipped: number; pruned: number };

export async function runAutomations(opts: { workspaceId: string | null; baseUrl: string; limit?: number }): Promise<RunSummary> {
  const admin = supabaseAdmin();
  const out: RunSummary = { scheduled: 0, done: 0, retried: 0, waiting: 0, failed: 0, skipped: 0, pruned: 0 };
  const sched = await admin.rpc('queue_scheduled_automations', { p_ws: opts.workspaceId });
  if (sched.error) throw new Error(sched.error.message);
  out.scheduled = Number(sched.data) || 0;

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

// A Test run: the workflow's actions on a sample project (the most recently created), described but not performed.
// flow: the builder's unsaved graph, so testing never has to save (and change) a live automation first.
export async function testAutomation(workspaceId: string, automationId: string, baseUrl: string, flow?: unknown) {
  const admin = supabaseAdmin();
  const p = await admin.from('projects').select('id').eq('workspace_id', workspaceId).is('archived_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  const a = await admin.from('automations').select('*').eq('id', automationId).eq('workspace_id', workspaceId).maybeSingle();
  if (a.error || !a.data) throw new Error('That workflow was not found.');
  const draft = isGraph(flow) ? graphOf({ flow }) : null;
  const t = draft ? { key: draft.trigger.key, value: draft.trigger.value } : triggerOf(a.data.trigger as Record<string, string>);
  const ins = await admin.from('automation_runs').insert({
    automation_id: automationId, workspace_id: workspaceId, project_id: p.data ? p.data.id : null, trigger_key: t.key,
    status: 'running', is_test: true, attempts: 1, payload: { value: t.value, sample: true },
  }).select('*').single();
  if (ins.error) throw new Error(ins.error.message);
  await executeRun(ins.data as Run, baseUrl, draft);
  const done = await admin.from('automation_runs').select('*').eq('id', ins.data.id).single();
  return done.data;
}

async function executeRun(r: Run, baseUrl: string, draft?: ReturnType<typeof graphOf> | null): Promise<'done' | 'test' | 'retry' | 'waiting' | 'failed' | 'skipped'> {
  const admin = supabaseAdmin();
  const finish = async (status: string, patch: Record<string, unknown>) => {
    const res = await admin.from('automation_runs').update({ status, finished_at: status === 'retry' ? null : new Date().toISOString(), ...patch }).eq('id', r.id);
    if (res.error) console.warn('automation_runs', res.error.message);
  };
  const [aRes, sRes, wRes] = await Promise.all([
    admin.from('automations').select('*').eq('id', r.automation_id).maybeSingle(),
    admin.from('workspace_settings').select('workspace_id, automation, timezone').eq('workspace_id', r.workspace_id).maybeSingle(),
    admin.from('workspaces').select('name').eq('id', r.workspace_id).maybeSingle(),
  ]);
  const a = aRes.data as Automation | null;
  const st = (sRes.data as Settings | null) || { workspace_id: r.workspace_id, automation: {}, timezone: 'America/Chicago' };
  const auto = st.automation || {};
  const workspace = (wRes.data && wRes.data.name) || 'FTGU Studio';
  if (!a) { await finish('skipped', { error: 'The workflow was deleted.' }); return 'skipped'; }
  if (!r.is_test && (auto.paused || !a.enabled || a.is_draft)) {
    await finish('skipped', { error: auto.paused ? 'Pause all automations is on.' : 'The workflow is turned off.' });
    return 'skipped';
  }

  const graph = draft || (isGraph(a.flow) ? graphOf(a) : null);
  if (graph && graph.kind !== 'automation') { await finish('skipped', { error: 'Processes and ideas do not run.' }); return 'skipped'; }

  const p = r.project_id ? ((await admin.from('projects').select('id, workspace_id, title, job_code, status_id, publish_date, archived_at, channel_id, content_type_id').eq('id', r.project_id).maybeSingle()).data as Project | null) : null;
  const statuses = ((await admin.from('project_statuses').select('id, label, sort').eq('workspace_id', r.workspace_id).order('sort')).data || []) as { id: string; label: string; sort: number }[];
  const statusName = (id: string | null | undefined) => (statuses.find((x) => x.id === id) || { label: '' }).label;
  const trig = graph && r.is_test ? { key: graph.trigger.key, value: graph.trigger.value } : triggerOf(a.trigger);
  const why = triggerText(trig.key, trig.value);
  const link = p ? baseUrl.replace(/\/+$/, '') + '/projects?project=' + encodeURIComponent(p.job_code) : baseUrl.replace(/\/+$/, '') + '/projects';
  const subject = p ? p.title + ' (' + p.job_code + ')' : 'no project';
  // Splits and tokens read the project's people, sponsor and channel; older workflows use neither.
  const facts = p && graph ? await factsOf(p) : null;
  const tokens: Record<string, string> = {
    'project.title': p ? p.title : '', 'project.job': p ? p.job_code : '', 'project.status': p ? statusName(p.status_id) : '',
    'project.channel': facts ? facts.channel : '', 'project.publish_date': p && p.publish_date ? p.publish_date : '', 'project.link': link,
    'project.sponsor': facts ? facts.sponsor : '', 'project.editor': facts ? facts.editor : '', 'project.designer': facts ? facts.designer : '',
    trigger: why, 'flow.name': a.name, 'workspace.name': workspace,
  };
  const ctx: Ctx = { r, a, p, statuses, statusName, why, link, subject, workspace, test: r.is_test, tokens };

  const prev = r.output || {};
  const prior = prev.done || [];
  const steps: Step[] = (prev.steps || []).filter((x) => prior.includes(x.id || x.action));
  const done = prior.slice();
  const waited = (prev.waited || []).slice();
  const paths = { ...(prev.paths || {}) };
  let failure: Error | null = null;
  let waitMs = 0;
  // One step: runs once, recorded under id (node id for flows, action key for older workflows).
  const step = async (id: string, action: string, fn: () => Promise<string>) => {
    if (done.includes(id)) return true;
    try {
      steps.push({ id, action, ok: true, detail: await fn() });
      done.push(id);
      return true;
    } catch (err) {
      failure = err instanceof Error ? err : new Error(String(err));
      steps.push({ id, action, ok: false, detail: failure.message });
      return false;
    }
  };
  const walkSteps = async (list: Node[]): Promise<boolean> => {
    for (const n of list) {
      if (n.type === 'note') continue;
      if (n.type === 'split') {
        const all = n.paths || [];
        let pick = all.find((x) => x.id === paths[n.id]);
        if (!pick) {
          pick = all.find((x, i) => i < all.length - 1 && x.when.length > 0 && x.when.every((c) => matches(c, p, facts, statusName))) || all[all.length - 1];
          if (!pick) continue;
          paths[n.id] = pick.id;
          steps.push({ id: n.id, action: 'split', ok: true, detail: (n.name || 'Split') + ': took ' + pick.name + '.' });
          done.push(n.id);
        }
        if (!(await walkSteps(pick.steps))) return false;
        continue;
      }
      if (n.type === 'delay') {
        if (done.includes(n.id)) continue;
        const ms = (Number(n.amount) || 0) * (n.unit === 'minutes' ? 60000 : n.unit === 'hours' ? 3600000 : 86400000);
        const text = delayText(n);
        if (!r.is_test && ms > 0 && !waited.includes(n.id)) { waited.push(n.id); waitMs = ms; return false; }
        await step(n.id, 'delay', async () => (r.is_test ? 'Would ' + text.toLowerCase() + '.' : text.replace(/^Wait/, 'Waited') + '.'));
        continue;
      }
      if (n.type === 'task') {
        if (!(await step(n.id, 'task', () => addTask(n, ctx)))) return false;
        continue;
      }
      if (n.type === 'action' && n.key) {
        const key = n.key;
        if (!(await step(n.id, key, () => perform(key, n.message || '', ctx)))) return false;
      }
    }
    return true;
  };
  if (graph) await walkSteps(graph.steps);
  else for (const act of actionsOf(a.actions)) if (!(await step(act.key, act.key, () => perform(act.key, act.message, ctx)))) break;
  const waitClaims = prev.waitClaims || 0;
  const output: Output & Record<string, unknown> = { done, steps, waited, waitClaims, paths, trigger: why, project: p ? { id: p.id, job: p.job_code, title: p.title } : null };

  // A delay: park the run until it is due. The claim counts it as a try, so tries below leave delays out.
  if (waitMs && !failure) {
    await finish('retry', { output: { ...output, waiting: true, waitClaims: waitClaims + 1 }, error: null, next_attempt_at: new Date(Date.now() + waitMs).toISOString() });
    return 'waiting';
  }

  if (!failure) {
    await finish(r.is_test ? 'test' : 'done', { output, error: null, next_attempt_at: null });
    if (!r.is_test) await admin.from('automations').update({ run_count: (a.run_count || 0) + 1, last_run_at: new Date().toISOString() }).eq('id', a.id);
    return r.is_test ? 'test' : 'done';
  }
  const fail: Error = failure;
  const tries = r.attempts - waitClaims;
  const retry = !r.is_test && auto.retry !== false && !(fail instanceof Permanent) && tries < MAX_TRIES;
  if (retry) {
    await finish('retry', { output, error: fail.message, next_attempt_at: new Date(Date.now() + RETRY_MIN * Math.max(1, tries) * 60000).toISOString() });
    return 'retry';
  }
  await finish('failed', { output, error: fail.message, next_attempt_at: null });
  if (!r.is_test && auto.failAlert !== false) await alertFailure(ctx, fail.message);
  return 'failed';
}

type Ctx = {
  r: Run; a: Automation; p: Project | null; statuses: { id: string; label: string; sort: number }[]; statusName: (id: string | null | undefined) => string;
  why: string; link: string; subject: string; workspace: string; test: boolean; tokens: Record<string, string>;
};

async function factsOf(p: Project): Promise<Facts> {
  const admin = supabaseAdmin();
  const [ch, sp, ed, th] = await Promise.all([
    p.channel_id ? admin.from('channels').select('name').eq('id', p.channel_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('sponsorships').select('account_id, approval_status').eq('project_id', p.id).limit(1).maybeSingle(),
    admin.from('project_edits').select('editor_id, edit_status').eq('project_id', p.id).maybeSingle(),
    admin.from('project_thumbnails').select('designer_id').eq('project_id', p.id).maybeSingle(),
  ]);
  const s = sp.data as { account_id: string; approval_status: string } | null;
  const e = ed.data as { editor_id: string | null; edit_status: string | null } | null;
  const t = th.data as { designer_id: string | null } | null;
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
    designerId: t ? t.designer_id : null, designer: nameOf(t && t.designer_id),
  };
}

// One split criterion against the project. Without a project nothing matches, so the run takes Everyone else.
function matches(c: Crit, p: Project | null, f: Facts | null, statusName: (id: string | null | undefined) => string) {
  if (!p || !f || !FIELDS.some((x) => x.key === c.field)) return false;
  const v: Record<string, string | null> = {
    status: statusName(p.status_id), channel: p.channel_id, type: p.content_type_id, sponsor: f.sponsorId, approval: f.approval || null,
    editor: f.editorId, edit_status: f.editStatus || null, designer: f.designerId, publish_date: p.publish_date,
  };
  const have = v[c.field];
  if (c.op === 'set') return !!have;
  if (c.op === 'empty') return !have;
  const same = (have || '').toLowerCase() === (c.value || '').toLowerCase();
  return c.op === 'is' ? same : !same;
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
  if (ins.error) throw new Error(ins.error.message);
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
  const res = await supabaseAdmin().from('activity_log').insert({
    workspace_id: ctx.r.workspace_id, actor_label: 'Automation', category: 'project', action, target_type: ctx.p ? 'project' : 'automation',
    target_id: ctx.p ? ctx.p.id : ctx.a.id, target_label: ctx.p ? ctx.p.title : ctx.a.name, project_id: ctx.p ? ctx.p.id : null, source: 'automation',
  });
  if (res.error) console.warn('activity_log', res.error.message);
}

async function perform(key: string, message: string, ctx: Ctx): Promise<string> {
  const admin = supabaseAdmin();
  const def = actionById(key);
  if (!def) throw new Permanent('Unknown action ' + key + '.');
  const { p, a } = ctx;
  const note = fillTokens(message || '', ctx.tokens).trim();

  if (key === 'slack_admin') {
    const text = '*' + a.name + '*: ' + ctx.why + (p ? ' on ' + ctx.subject : '') + (note ? '\n' + note : '') + '\n' + ctx.link;
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
    const s = (await admin.from('workspace_settings').select('require_sponsor_approval, lock_after_live').eq('workspace_id', p.workspace_id).maybeSingle()).data as { require_sponsor_approval: boolean; lock_after_live: boolean } | null;
    if (s && s.lock_after_live && ctx.statusName(p.status_id) === 'Live') throw new Permanent('Live projects are locked.');
    if (s && s.require_sponsor_approval && (next.label === 'Scheduled' || next.label === 'Live')) {
      const sp = await admin.from('sponsorships').select('id').eq('project_id', p.id).neq('approval_status', 'approved');
      if ((sp.data || []).length) throw new Permanent('Sponsor approval is required before ' + ctx.subject + ' can move to ' + next.label + '.');
    }
    if (ctx.test) return 'Would move ' + ctx.subject + ' from ' + ctx.statusName(p.status_id) + ' to ' + next.label + '.';
    const up = await admin.from('projects').update({ status_id: next.id }).eq('id', p.id).eq('status_id', p.status_id);
    if (up.error) throw new Error(up.error.message);
    await logAutomation(ctx, 'moved Status to ' + next.label + ' on');
    return 'Moved Status from ' + ctx.statusName(p.status_id) + ' to ' + next.label + '.';
  }

  if (key === 'todo_admin') {
    const people = await admins(ctx.r.workspace_id);
    if (!people.length) throw new Permanent('There is no active Super Admin.');
    const text = (note || a.name) + (p ? ': ' + p.title + ' (' + p.job_code + ')' : '');
    if (ctx.test) return 'Would add the To-Do "' + text + '" for ' + people.length + ' Super Admin' + (people.length === 1 ? '' : 's') + '.';
    const ins = await admin.from('tasks').insert(people.map((x) => ({ workspace_id: ctx.r.workspace_id, owner_id: x.id, text, priority: 'high', project_id: p ? p.id : null })));
    if (ins.error) throw new Error(ins.error.message);
    return 'Added the To-Do "' + text + '" for ' + people.length + ' Super Admin' + (people.length === 1 ? '' : 's') + '.';
  }

  if (key === 'webhook_n8n') {
    const conn = await getIntegration(ctx.r.workspace_id, 'n8n');
    const body = {
      type: ctx.test ? 'test' : 'automation', at: new Date().toISOString(),
      automation: { id: a.id, name: a.name }, trigger: { key: ctx.r.trigger_key, text: ctx.why, ...(ctx.r.payload || {}) },
      project: p ? { id: p.id, job: p.job_code, title: p.title, status: ctx.statusName(p.status_id), publish_date: p.publish_date, link: ctx.link } : null,
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
    if (res.failed.length) throw res.retry ? new Error(res.detail) : new Permanent(res.detail);
    if (!ctx.test) await logAutomation(ctx, 'published to Buffer');
    return res.detail;
  }
  throw new Permanent('Unknown action ' + key + '.');
}

// Alert on failures: an in-app notification for each Super Admin, an email, and Slack when it is connected.
async function alertFailure(ctx: Ctx, error: string) {
  const admin = supabaseAdmin();
  const people = await admins(ctx.r.workspace_id);
  const text = 'automation "' + ctx.a.name + '" failed on';
  if (people.length) {
    const ins = await admin.from('notifications').insert(people.map((x) => ({
      workspace_id: ctx.r.workspace_id, user_id: x.id, event: 'automation', actor_label: 'Automation', text, target_label: ctx.p ? ctx.p.title : ctx.a.name, quote: error, project_id: ctx.p ? ctx.p.id : null,
    })));
    if (ins.error) console.warn('notifications', ins.error.message);
  }
  for (const x of people) {
    if (!x.email) continue;
    const tpl = buildMessageEmail({
      workspace: ctx.workspace, tone: { label: 'Automation failed', bg: '#C42B2F' }, subject: 'Automation failed: ' + ctx.a.name,
      heading: 'An automation failed', lead: '"' + ctx.a.name + '" (' + ctx.why + ') could not finish' + (ctx.p ? ' on ' + ctx.subject : '') + '.',
      note: error, cta: { label: 'Open Automations', url: ctx.link.replace(/\/projects.*$/, '/admin/automations') },
      fine: 'You get this email because Alert on failures is on in Automations > Settings.',
    });
    const res = await sendEmail({ to: x.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    if (!res.sent) console.warn('automation alert email', res.error);
  }
  if (await getIntegration(ctx.r.workspace_id, 'slack').catch(() => null)) {
    await postSlackAlert(ctx.r.workspace_id, ':warning: Automation *' + ctx.a.name + '* failed' + (ctx.p ? ' on ' + ctx.subject : '') + ': ' + error).catch((e) => console.warn('slack alert', e));
  }
}
