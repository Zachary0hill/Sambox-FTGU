import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from './send';
import { buildNotificationEmail, type NotificationKind } from './notification-template';

type OutboxRow = {
  id: string; workspace_id: string; user_id: string; event: string; kind: NotificationKind; project_id: string | null;
  actor_id: string | null; data: { due?: string; person?: string; account?: string; note?: string; version?: number };
  attempts: number; created_at: string;
};
type Profile = { id: string; full_name: string; email: string; prefs: { myN?: { email?: boolean } } | null };

// Every event emails by default. A Super Admin turns one off for the workspace in Automations > Settings
// (notify_defaults '<event>:email' = false); a person turns all of theirs off in Settings (prefs.myN.email = false).
const MAX_ATTEMPTS = 3;
const STALE_MS = 48 * 3600 * 1000;
// Resend allows 2 requests a second by default.
const GAP_MS = 550;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dateLabel = (iso?: string | null) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return DAYS[dt.getUTCDay()] + ', ' + MONTHS[m - 1] + ' ' + d;
};
const firstName = (p?: Profile) => (p ? (p.full_name || '').trim().split(' ')[0] || p.email.split('@')[0] : '');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SendSummary = { reminders: number; sent: number; skipped: number; failed: number };

// Queues tomorrow's deadline reminders, then sends what is waiting in email_outbox: one workspace for a member's
// request, every workspace for the scheduler.
export async function sendQueuedEmails(opts: { workspaceId: string | null; baseUrl: string; limit?: number }): Promise<SendSummary> {
  const admin = supabaseAdmin();
  const base = opts.baseUrl.replace(/\/+$/, '');
  const out: SendSummary = { reminders: 0, sent: 0, skipped: 0, failed: 0 };

  const rem = await admin.rpc('queue_deadline_reminders', { p_ws: opts.workspaceId });
  if (rem.error) throw new Error(rem.error.message);
  out.reminders = Number(rem.data) || 0;

  const claim = await admin.rpc('claim_email_outbox', { p_ws: opts.workspaceId, p_limit: opts.limit ?? 40 });
  if (claim.error) throw new Error(claim.error.message);
  const rows = (claim.data || []) as OutboxRow[];
  if (!rows.length) return out;

  const uniq = (a: (string | null | undefined)[]) => Array.from(new Set(a.filter((x): x is string => !!x)));
  const wsIds = uniq(rows.map((r) => r.workspace_id));
  const userIds = uniq(rows.flatMap((r) => [r.user_id, r.actor_id, r.data && r.data.person]));
  const projectIds = uniq(rows.map((r) => r.project_id));
  const [profiles, members, workspaces, settings, projects] = await Promise.all([
    admin.from('profiles').select('id, full_name, email, prefs').in('id', userIds),
    admin.from('workspace_members').select('workspace_id, user_id, status').in('workspace_id', wsIds).in('user_id', uniq(rows.map((r) => r.user_id))),
    admin.from('workspaces').select('id, name').in('id', wsIds),
    admin.from('workspace_settings').select('workspace_id, notify_defaults').in('workspace_id', wsIds),
    projectIds.length ? admin.from('projects').select('id, title, job_code, publish_date, archived_at').in('id', projectIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const failed = [profiles, members, workspaces, settings, projects].find((r) => r.error);
  if (failed && failed.error) throw new Error(failed.error.message);
  const profileOf = new Map((profiles.data as Profile[]).map((p) => [p.id, p]));
  const activeMember = new Set((members.data || []).filter((m) => m.status === 'active').map((m) => m.workspace_id + ':' + m.user_id));
  const wsName = new Map((workspaces.data || []).map((w) => [w.id, w.name as string]));
  const defaults = new Map((settings.data || []).map((s) => [s.workspace_id, (s.notify_defaults || {}) as Record<string, boolean>]));
  const projectOf = new Map((projects.data || []).map((p) => [p.id, p]));

  const finish = (id: string, status: 'sent' | 'skipped' | 'failed' | 'queued', error: string | null) =>
    admin.from('email_outbox').update({ status, error, sent_at: status === 'sent' ? new Date().toISOString() : null }).eq('id', id);

  let first = true;
  for (const r of rows) {
    const to = profileOf.get(r.user_id);
    const p = r.project_id ? projectOf.get(r.project_id) : null;
    const skip =
      Date.now() - new Date(r.created_at).getTime() > STALE_MS ? 'Older than 48 hours'
      : !to || !to.email ? 'No email address'
      : !activeMember.has(r.workspace_id + ':' + r.user_id) ? 'Not an active member'
      : to.prefs && to.prefs.myN && to.prefs.myN.email === false ? 'Turned off in their Settings'
      : (defaults.get(r.workspace_id) || {})[r.event + ':email'] === false ? 'Turned off for the workspace'
      : !p || p.archived_at ? 'Project archived or deleted'
      : '';
    if (skip) { await finish(r.id, 'skipped', skip); out.skipped++; continue; }

    const d = r.data || {};
    const tpl = buildNotificationEmail({
      kind: r.kind, name: to!.full_name, workspace: wsName.get(r.workspace_id) || 'FTGU Studio',
      actor: firstName(profileOf.get(r.actor_id || '')) || 'The team', person: firstName(profileOf.get(d.person || '')) || undefined,
      account: d.account, note: d.note || undefined, version: d.version,
      project: { title: p!.title, job: p!.job_code, due: dateLabel(d.due), publish: dateLabel(p!.publish_date) },
      link: base + '/projects?project=' + encodeURIComponent(p!.job_code), settingsLink: base + '/settings',
    });
    if (!first) await wait(GAP_MS);
    first = false;
    const res = await sendEmail({ to: to!.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    if (res.sent) { await finish(r.id, 'sent', null); out.sent++; continue; }
    console.error('Notification email failed for', to!.email, '-', res.error);
    await finish(r.id, r.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued', res.error);
    out.failed++;
  }
  return out;
}
