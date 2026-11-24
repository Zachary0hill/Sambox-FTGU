import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getIntegration } from '@/lib/integrations/secrets';
import { postSlackDigest, SlackError, type DigestBlock } from '@/lib/integrations/providers/slack';
import { validDigestChannel } from './catalog';
import { lastSlot } from './schedule';

export class DigestSetupError extends Error {}
export class DigestRetryError extends Error {}

type Row = { bucket: string; job: string; title: string; editor: string };
const GROUPS = [['completed', 'Completed'], ['in_review', 'Ready for review'], ['needs_revision', 'Needs revision']] as const;
const escapeSlack = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\r\n]/g, ' ');

export function digestMessage(rows: Row[], baseUrl: string, start: number, cutoff: number, timezone: string) {
  const local = new Intl.DateTimeFormat('en-US', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' });
  const header = 'Production digest · ' + local.format(start) + ' – ' + local.format(cutoff) + ' (' + timezone + ')';
  const blocks: DigestBlock[] = [];
  const section = (text: string) => blocks.push({ type: 'section', text: { type: 'mrkdwn', text, verbatim: true } });
  section('*' + header + '*');
  const counts = [];
  for (const [key, label] of GROUPS) {
    const items = rows.filter((r) => r.bucket === key);
    counts.push(label + ' ' + items.length);
    let body = '*' + label + ' (' + items.length + ')*';
    for (const row of items) {
      const url = baseUrl + '/projects?project=' + encodeURIComponent(row.job);
      const line = '• <' + url + '|Open> ' + escapeSlack(row.title) + ' — ' + escapeSlack(row.editor);
      if (line.length > 3000) throw new DigestSetupError('A project title or editor name exceeds the Slack section limit.');
      if (body.length + line.length + 1 > 3000) { section(body); body = line; }
      else body += '\n' + line;
    }
    section(body);
  }
  if (blocks.length > 50) throw new DigestSetupError('The digest exceeds Slack’s 50-section limit for one message.');
  return { text: header + '. ' + counts.join(', ') + '.', blocks };
}

type Options = {
  workspaceId: string; runId: string; channel: string; rule: string; timezone: string; slot: unknown; baseUrl: string; preview: boolean;
};

export async function deliverProductionDigest({ workspaceId, runId, channel, rule, timezone, slot, baseUrl, preview }: Options) {
  if (!validDigestChannel(channel)) throw new DigestSetupError('Enter the Slack channel ID from channel details.');
  const cutoff = preview ? lastSlot(rule, timezone) : Date.parse(String(slot || ''));
  if (!cutoff || !Number.isFinite(cutoff)) throw new DigestSetupError('The digest needs a scheduled reporting cutoff.');
  const start = lastSlot(rule, timezone, cutoff - 1);
  if (!start) throw new DigestSetupError('Choose a valid reporting schedule.');
  const reportingDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(cutoff);
  const db = supabaseAdmin();
  const identity = { workspace_id: workspaceId, channel, reporting_date: reportingDate };
  const priorDelivery = async () => {
    const prior = await db.from('production_digest_deliveries').select('status,slack_ts').match(identity).maybeSingle();
    if (prior.error) throw new DigestRetryError('Could not read the delivery history: ' + prior.error.message);
    if (prior.data?.status === 'sent') return 'Already sent the ' + reportingDate + ' production digest to ' + channel + ' (' + prior.data.slack_ts + ').';
    if (prior.data) throw new DigestSetupError('Delivery to ' + channel + ' is in progress or unconfirmed. Check that channel before replaying.');
    return null;
  };
  if (!preview) {
    const previous = await priorDelivery();
    if (previous) return previous;
  }
  const snapshot = await db.rpc('production_digest_rows', {
    p_ws: workspaceId, p_start: new Date(start).toISOString(), p_cutoff: new Date(cutoff).toISOString(),
  });
  if (snapshot.error) throw new DigestRetryError('Could not load production queues: ' + snapshot.error.message);
  const message = digestMessage(snapshot.data || [], baseUrl, start, cutoff, timezone);
  const slack = await getIntegration(workspaceId, 'slack').catch((error: Error) => {
    throw new DigestRetryError('Could not read the Slack connection: ' + error.message);
  });
  if (preview) return 'Would send to ' + channel + '. ' + message.text + (slack ? '' : ' Connect Slack in Workspace Settings first.');
  if (!slack) throw new DigestSetupError('Reconnect Slack in Workspace Settings to send the production digest.');
  const reserved = await db.from('production_digest_deliveries').insert({ ...identity, cutoff: new Date(cutoff).toISOString(), run_id: runId, status: 'sending' });
  if (reserved.error) {
    if (reserved.error.code === '23505') {
      const previous = await priorDelivery();
      if (previous) return previous;
    }
    throw new DigestRetryError('Could not reserve the production digest: ' + reserved.error.message);
  }
  let ts: string;
  try {
    ts = await postSlackDigest(slack.secret.botToken, channel, message.text, message.blocks);
  } catch (err) {
    // Timeouts and Slack's internal errors can follow a successful write. Leave that date claimed.
    const rejected = ['invalid_auth', 'not_authed', 'token_revoked', 'token_expired', 'account_inactive', 'missing_scope', 'not_in_channel', 'channel_not_found', 'is_archived', 'ratelimited', 'invalid_blocks'];
    if (!(err instanceof SlackError) || !rejected.includes(err.code)) throw err;
    const released = await db.from('production_digest_deliveries').delete().match(identity).eq('run_id', runId).eq('status', 'sending');
    if (released.error) throw new Error('Slack rejected the digest and the reservation could not be released.');
    if (err.code === 'ratelimited') throw new DigestRetryError(err.message);
    throw new DigestSetupError('Slack rejected the digest: ' + err.message);
  }
  const confirmed = await db.from('production_digest_deliveries').update({ status: 'sent', slack_ts: ts })
    .match(identity).eq('run_id', runId).eq('status', 'sending').select('slack_ts').single();
  if (confirmed.error) throw new Error('Slack accepted the digest, but its confirmation could not be saved.');
  return 'Posted to ' + channel + ' (' + ts + '). ' + message.text;
}
