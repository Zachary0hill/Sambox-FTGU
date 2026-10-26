import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { buildMessageEmail } from '@/lib/email/message-template';
import { getIntegration } from '@/lib/integrations/secrets';
import { postSlackAlert } from '@/lib/integrations/providers/slack';
import { postN8n } from '@/lib/integrations/providers/n8n';
import { publishProjectToBuffer, PublishSetupError } from '@/lib/integrations/buffer-publish';
import { actionById, actionsOf, triggerOf, triggerText } from './catalog';

// The automation runner. Database triggers queue automation_runs rows when a live workflow's trigger fires; each tick
// (the board after a change, and a scheduler with CRON_SECRET) queues scheduled triggers, claims due runs, performs
// their actions with the secret key, and records the outcome on the run:
//   done     every action worked; output lists what each one did
//   retry    an action failed and Retry failed runs is on: tried again 5 and 10 minutes later (three tries in all)
//   failed   out of tries, or a failure retrying cannot fix (no editor assigned, not connected)
//   skipped  the workflow was turned off or deleted, or Pause all automations is on
//   test     a Test run: actions described, nothing sent or changed
// Actions that already worked are not repeated on a retry (output.done), so a retry never double-posts.

type Run = {
  id: string; automation_id: string; workspace_id: string; project_id: string | null; trigger_key: string | null; status: string;
  payload: Record<string, unknown> | null; output: { done?: string[]; steps?: Step[] } | null; attempts: number; is_test: boolean;
};
type Step = { action: string; ok: boolean; detail: string };
type Automation = { id: string; workspace_id: string; name: string; enabled: boolean; is_draft: boolean; trigger: Record<string, string>; actions: unknown; run_count: number };
type Settings = { workspace_id: string; automation: { paused?: boolean; retry?: boolean; failAlert?: boolean } | null; timezone: string };
type Project = { id: string; workspace_id: string; title: string; job_code: string; status_id: string; publish_date: string | null; archived_at: string | null };

const MAX_TRIES = 3;
const RETRY_MIN = 5;

// A failure that trying again cannot fix.
class Permanent extends Error {}

export type RunSummary = { scheduled: number; done: number; retried: number; failed: number; skipped: number; pruned: number };

export async function runAutomations(opts: { workspaceId: string | null; baseUrl: string; limit?: number }): Promise<RunSummary> {
  const admin = supabaseAdmin();
  const out: RunSummary = { scheduled: 0, done: 0, retried: 0, failed: 0, skipped: 0, pruned: 0 };
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
export async function testAutomation(workspaceId: string, automationId: string, baseUrl: string) {
  const admin = supabaseAdmin();
  const p = await admin.from('projects').select('id').eq('workspace_id', workspaceId).is('archived_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  const a = await admin.from('automations').select('*').eq('id', automationId).eq('workspace_id', workspaceId).maybeSingle();
  if (a.error || !a.data) throw new Error('That workflow was not found.');
  const t = triggerOf(a.data.trigger as Record<string, string>);
  const ins = await admin.from('automation_runs').insert({
    automation_id: automationId, workspace_id: workspaceId, project_id: p.data ? p.data.id : null, trigger_key: t.key,
    status: 'running', is_test: true, attempts: 1, payload: { value: t.value, sample: true },
  }).select('*').single();
  if (ins.error) throw new Error(ins.error.message);
  await executeRun(ins.data as Run, baseUrl);
  const done = await admin.from('automation_runs').select('*').eq('id', ins.data.id).single();
  return done.data;
}

async function executeRun(r: Run, baseUrl: string): Promise<'done' | 'test' | 'retry' | 'failed' | 'skipped'> {
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

  const p = r.project_id ? ((await admin.from('projects').select('id, workspace_id, title, job_code, status_id, publish_date, archived_at').eq('id', r.project_id).maybeSingle()).data as Project | null) : null;
  const statuses = ((await admin.from('project_statuses').select('id, label, sort').eq('workspace_id', r.workspace_id).order('sort')).data || []) as { id: string; label: string; sort: number }[];
  const statusName = (id: string | null | undefined) => (statuses.find((x) => x.id === id) || { label: '' }).label;
  const trig = triggerOf(a.trigger);
  const why = triggerText(trig.key, trig.value);
  const link = p ? baseUrl.replace(/\/+$/, '') + '/projects?project=' + encodeURIComponent(p.job_code) : baseUrl.replace(/\/+$/, '') + '/projects';
  const subject = p ? p.title + ' (' + p.job_code + ')' : 'no project';
  const ctx: Ctx = { r, a, p, statuses, statusName, why, link, subject, workspace, test: r.is_test };

  const prior = (r.output && r.output.done) || [];
  const steps: Step[] = ((r.output && r.output.steps) || []).filter((x) => prior.includes(x.action));
  const done = prior.slice();
  let failure: Error | null = null;
  for (const act of actionsOf(a.actions)) {
    if (done.includes(act.key)) continue;
    try {
      const detail = await perform(act.key, act.message, ctx);
      steps.push({ action: act.key, ok: true, detail });
      done.push(act.key);
    } catch (err) {
      failure = err instanceof Error ? err : new Error(String(err));
      steps.push({ action: act.key, ok: false, detail: failure.message });
      break;
    }
  }
  const output = { done, steps, trigger: why, project: p ? { id: p.id, job: p.job_code, title: p.title } : null };

  if (!failure) {
    await finish(r.is_test ? 'test' : 'done', { output, error: null, next_attempt_at: null });
    if (!r.is_test) await admin.from('automations').update({ run_count: (a.run_count || 0) + 1, last_run_at: new Date().toISOString() }).eq('id', a.id);
    return r.is_test ? 'test' : 'done';
  }
  const retry = !r.is_test && auto.retry !== false && !(failure instanceof Permanent) && r.attempts < MAX_TRIES;
  if (retry) {
    await finish('retry', { output, error: failure.message, next_attempt_at: new Date(Date.now() + RETRY_MIN * r.attempts * 60000).toISOString() });
    return 'retry';
  }
  await finish('failed', { output, error: failure.message, next_attempt_at: null });
  if (!r.is_test && auto.failAlert !== false) await alertFailure(ctx, failure.message);
  return 'failed';
}

type Ctx = {
  r: Run; a: Automation; p: Project | null; statuses: { id: string; label: string; sort: number }[]; statusName: (id: string | null | undefined) => string;
  why: string; link: string; subject: string; workspace: string; test: boolean;
};

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
  const note = (message || '').trim();

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
