import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from './send';
import { buildNotificationEmail, type NotificationKind } from './notification-template';
import { buildMessageEmail } from './message-template';
import { postSlackAlert } from '@/lib/integrations/providers/slack';

type OutboxRow = {
  id: string; workspace_id: string; user_id: string; event: string; kind: NotificationKind; project_id: string | null;
  actor_id: string | null; data: { due?: string; person?: string; account?: string; note?: string; version?: number };
  attempts: number; created_at: string;
};
type MyN = { email?: boolean; digest?: boolean; slack?: boolean; quiet?: boolean };
type Profile = { id: string; full_name: string; email: string; timezone: string | null; prefs: { myN?: MyN } | null };

// Every event emails by default. A Super Admin turns one off for the workspace in Automations > Settings
// (notify_defaults '<event>:email' = false); a person turns all of theirs off in Settings (prefs.myN.email = false).
// Quiet hours (prefs.myN.quiet) hold emails and Slack alerts from 7 PM to 8 AM in the person's time zone; they go
// out on the first send after 8 AM. In-app notifications are not held.
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

// The hour (0 to 23) in a time zone, for quiet hours and the 8 AM digest.
export function localParts(tz: string | null | undefined, at = new Date()) {
  let zone = tz || 'America/Chicago';
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); } catch { zone = 'America/Chicago'; }
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const part = (t: string) => (f.formatToParts(at).find((x) => x.type === t) || { value: '0' }).value;
  return { day: part('year') + '-' + part('month') + '-' + part('day'), hour: Number(part('hour')) % 24 };
}
const quietNow = (p?: Profile) => !!(p && p.prefs && p.prefs.myN && p.prefs.myN.quiet) && (() => { const h = localParts(p.timezone).hour; return h >= 19 || h < 8; })();

export type SendSummary = { reminders: number; sent: number; skipped: number; failed: number; held: number; slack: number; digests: number };

// Queues tomorrow's deadline reminders, then sends what is waiting in email_outbox: one workspace for a member's
// request, every workspace for the scheduler.
export async function sendQueuedEmails(opts: { workspaceId: string | null; baseUrl: string; limit?: number }): Promise<SendSummary> {
  const admin = supabaseAdmin();
  const base = opts.baseUrl.replace(/\/+$/, '');
  const out: SendSummary = { reminders: 0, sent: 0, skipped: 0, failed: 0, held: 0, slack: 0, digests: 0 };

  const rem = await admin.rpc('queue_deadline_reminders', { p_ws: opts.workspaceId });
  if (rem.error) throw new Error(rem.error.message);
  out.reminders = Number(rem.data) || 0;

  const claim = await admin.rpc('claim_email_outbox', { p_ws: opts.workspaceId, p_limit: opts.limit ?? 40 });
  if (claim.error) throw new Error(claim.error.message);
  const rows = (claim.data || []) as OutboxRow[];
  await sendSlackAlerts(opts.workspaceId, base, out);
  await sendDigests(opts.workspaceId, base, out);
  if (!rows.length) return out;

  const uniq = (a: (string | null | undefined)[]) => Array.from(new Set(a.filter((x): x is string => !!x)));
  const wsIds = uniq(rows.map((r) => r.workspace_id));
  const userIds = uniq(rows.flatMap((r) => [r.user_id, r.actor_id, r.data && r.data.person]));
  const projectIds = uniq(rows.map((r) => r.project_id));
  const [profiles, members, workspaces, settings, projects] = await Promise.all([
    admin.from('profiles').select('id, full_name, email, timezone, prefs').in('id', userIds),
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
    // Quiet hours: back to the queue without using up a try.
    if (quietNow(to)) { await admin.from('email_outbox').update({ status: 'queued', attempts: Math.max(0, r.attempts - 1) }).eq('id', r.id); out.held++; continue; }

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

// ---------- Slack alerts ----------
// notify_outbox rows come from the route_notification trigger: an in-app notification whose event has Slack on in
// Automations > Settings, for someone who turned Slack alerts on in their Settings.
type SlackRow = { id: string; workspace_id: string; user_id: string; event: string; actor_label: string; text: string; target_label: string; quote: string | null; project_id: string | null; attempts: number; created_at: string };

async function sendSlackAlerts(workspaceId: string | null, base: string, out: SendSummary) {
  const admin = supabaseAdmin();
  const claim = await admin.rpc('claim_notify_outbox', { p_ws: workspaceId, p_limit: 40 });
  if (claim.error) { console.warn('claim_notify_outbox', claim.error.message); return; }
  const rows = (claim.data || []) as SlackRow[];
  if (!rows.length) return;
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const pids = Array.from(new Set(rows.map((r) => r.project_id).filter((x): x is string => !!x)));
  const [profiles, projects] = await Promise.all([
    admin.from('profiles').select('id, full_name, email, timezone, prefs').in('id', ids),
    pids.length ? admin.from('projects').select('id, job_code').in('id', pids) : Promise.resolve({ data: [], error: null }),
  ]);
  const prof = new Map(((profiles.data || []) as Profile[]).map((p) => [p.id, p]));
  const job = new Map(((projects.data || []) as { id: string; job_code: string }[]).map((p) => [p.id, p.job_code]));
  const finish = (id: string, status: string, error: string | null) =>
    admin.from('notify_outbox').update({ status, error, sent_at: status === 'sent' ? new Date().toISOString() : null }).eq('id', id);
  for (const r of rows) {
    const p = prof.get(r.user_id);
    if (Date.now() - new Date(r.created_at).getTime() > STALE_MS) { await finish(r.id, 'skipped', 'Older than 48 hours'); continue; }
    if (!p || !(p.prefs && p.prefs.myN && p.prefs.myN.slack)) { await finish(r.id, 'skipped', 'Slack alerts turned off in their Settings'); continue; }
    if (quietNow(p)) { await admin.from('notify_outbox').update({ status: 'queued', attempts: Math.max(0, r.attempts - 1) }).eq('id', r.id); out.held++; continue; }
    const link = r.project_id && job.get(r.project_id) ? base + '/projects?project=' + encodeURIComponent(job.get(r.project_id)!) : base + '/inbox';
    const text = [r.actor_label, r.text, r.target_label].filter(Boolean).join(' ') + (r.quote ? '\n> ' + r.quote.slice(0, 300) : '') + '\n' + link;
    try {
      await postSlackAlert(r.workspace_id, text, p.email);
      await finish(r.id, 'sent', null);
      out.slack++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await finish(r.id, r.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued', msg);
    }
  }
}

// ---------- Daily digest ----------
// From 8 AM in the person's time zone, once a day (digest_log), for everyone who turned the digest on: unread
// notifications from the last day and their deadlines and publish dates for the coming week.
async function sendDigests(workspaceId: string | null, base: string, out: SendSummary) {
  const admin = supabaseAdmin();
  let mq = admin.from('workspace_members').select('workspace_id, user_id, role').eq('status', 'active').in('role', ['super_admin', 'editor', 'designer']);
  if (workspaceId) mq = mq.eq('workspace_id', workspaceId);
  const members = (await mq).data || [];
  if (!members.length) return;
  const profiles = ((await admin.from('profiles').select('id, full_name, email, timezone, prefs').in('id', members.map((m) => m.user_id))).data || []) as Profile[];
  const want = profiles.filter((p) => p.email && p.prefs && p.prefs.myN && p.prefs.myN.digest);
  for (const p of want) {
    const { day, hour } = localParts(p.timezone);
    if (hour < 8) continue;
    const m = members.find((x) => x.user_id === p.id)!;
    const claim = await admin.from('digest_log').insert({ user_id: p.id, day, status: 'sending' });
    if (claim.error) continue; // already sent (or being sent) today
    const ws = m.workspace_id as string;
    const since = new Date(Date.now() - 86400000).toISOString();
    const inWeek = (iso: string | null) => !!iso && iso >= day && iso <= addDays(day, 7);
    const [wsRes, nRes, eRes, tRes, pRes] = await Promise.all([
      admin.from('workspaces').select('name').eq('id', ws).maybeSingle(),
      admin.from('notifications').select('actor_label, text, target_label').eq('user_id', p.id).eq('workspace_id', ws).is('read_at', null).gte('created_at', since).order('created_at', { ascending: false }).limit(8),
      admin.from('project_edits').select('project_id, edit_due, edit_status').eq('editor_id', p.id),
      admin.from('project_thumbnails').select('project_id, thumb_due, thumb_status').eq('designer_id', p.id),
      admin.from('projects').select('id, title, job_code, publish_date').eq('workspace_id', ws).is('archived_at', null),
    ]);
    const proj = new Map(((pRes.data || []) as { id: string; title: string; job_code: string; publish_date: string | null }[]).map((x) => [x.id, x]));
    const due: [string, string][] = [];
    ((eRes.data || []) as { project_id: string; edit_due: string | null; edit_status: string | null }[]).forEach((e) => {
      const x = proj.get(e.project_id);
      if (x && e.edit_status !== 'approved' && inWeek(e.edit_due)) due.push([dateLabel(e.edit_due), 'Edit: ' + x.title + ' (' + x.job_code + ')']);
    });
    ((tRes.data || []) as { project_id: string; thumb_due: string | null; thumb_status: string | null }[]).forEach((t) => {
      const x = proj.get(t.project_id);
      if (x && t.thumb_status !== 'done' && inWeek(t.thumb_due)) due.push([dateLabel(t.thumb_due), 'Thumbnail: ' + x.title + ' (' + x.job_code + ')']);
    });
    const publishing: [string, string][] = m.role === 'super_admin'
      ? Array.from(proj.values()).filter((x) => inWeek(x.publish_date)).sort((a, b) => String(a.publish_date).localeCompare(String(b.publish_date))).slice(0, 10).map((x) => [dateLabel(x.publish_date), x.title + ' (' + x.job_code + ')'])
      : [];
    const unread = ((nRes.data || []) as { actor_label: string; text: string; target_label: string }[]).map((n) => ['', [n.actor_label, n.text, n.target_label].filter(Boolean).join(' ')] as [string, string]);
    const workspace = (wsRes.data && wsRes.data.name) || 'FTGU Studio';
    const cards = [
      { title: 'Due this week', rows: due.length ? due.sort() : [['', 'Nothing due in the next 7 days.'] as [string, string]] },
      ...(publishing.length ? [{ title: 'Publishing this week', rows: publishing }] : []),
      ...(unread.length ? [{ title: 'Unread since yesterday', rows: unread }] : []),
    ];
    const tpl = buildMessageEmail({
      workspace, tone: { label: 'Daily digest', bg: '#111111' }, subject: workspace + ' digest for ' + dateLabel(day),
      heading: 'Good morning, ' + (firstName(p) || 'there'), lead: due.length + (due.length === 1 ? ' deadline' : ' deadlines') + ' this week and ' + unread.length + ' unread ' + (unread.length === 1 ? 'update' : 'updates') + '.',
      cards, cta: { label: 'Open the board', url: base + '/projects' },
      fine: 'You get this digest because Daily email digest is on in your Settings.', fineLink: { label: 'Settings', url: base + '/settings' },
    });
    const res = await sendEmail({ to: p.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    await admin.from('digest_log').update({ status: res.sent ? 'sent' : 'failed', error: res.sent ? null : res.error }).eq('user_id', p.id).eq('day', day);
    if (res.sent) out.digests++;
    else console.error('Digest email failed for', p.email, '-', res.error);
  }
}

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};
