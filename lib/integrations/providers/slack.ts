import 'server-only';
// Slack -> Inbox. Pull with conversations.history, push with the Events API (app/api/webhooks/slack).
// Docs used:
//   https://docs.slack.dev/apis/web-api/                     calling methods, Bearer token, ok/error, form vs JSON bodies
//   https://docs.slack.dev/apis/web-api/rate-limits          tiers, HTTP 429 + Retry-After, cursor pagination
//   https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps  (internal apps keep Tier 3)
//   https://docs.slack.dev/reference/methods/auth.test
//   https://docs.slack.dev/reference/methods/users.conversations
//   https://docs.slack.dev/reference/methods/conversations.info
//   https://docs.slack.dev/reference/methods/conversations.history
//   https://docs.slack.dev/reference/methods/users.info
//   https://docs.slack.dev/reference/methods/chat.getPermalink
//   https://docs.slack.dev/reference/methods/chat.postMessage
//   https://docs.slack.dev/apis/events-api/                  envelope, 3-second ack, retries
//   https://docs.slack.dev/reference/events/url_verification
//   https://docs.slack.dev/reference/events/message  (+ /message_changed, /message_deleted)
//   https://docs.slack.dev/reference/events/app_mention
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getIntegration, connectedWorkspaces, markChecked, type Secret, type Config } from '../secrets';
import type { ProviderModule } from './types';
import {
  signatureOk, isPersonMessage, toRow, plainText, mentionedIds, kindOf, externalId, WINDOW_SECONDS,
  type SlackMessage, type SlackUser, type InboxRow,
} from './slack-utils';

const API = 'https://slack.com/api/';
const BACKFILL_DAYS = 7;
const FIRST_MAX = 100; // messages per channel on the first sync
const RUN_MAX = 300; // messages per channel on later syncs
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HINT: Record<string, string> = {
  invalid_auth: 'the bot token was rejected', not_authed: 'no bot token was sent', token_revoked: 'the bot token was revoked',
  token_expired: 'the bot token expired', account_inactive: 'the app or workspace was deactivated',
  not_in_channel: 'the bot is not in that channel', channel_not_found: 'channel not found', ratelimited: 'Slack rate limit hit, try again in a minute',
};

class SlackError extends Error {
  constructor(public code: string, needed?: string) {
    super(code === 'missing_scope' ? 'the Slack app is missing the ' + (needed || 'required') + ' scope; add it and reinstall the app' : (HINT[code] || code));
  }
}

type Params = Record<string, string | number | boolean | undefined>;

// One Web API call. Reads go as form-encoded POSTs, chat.postMessage as JSON; the token is always in the header.
// On HTTP 429 waits Retry-After seconds and tries again, up to three times.
async function call<T = Record<string, unknown>>(token: string, method: string, params: Params = {}, json = false): Promise<T> {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + method, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': json ? 'application/json; charset=utf-8' : 'application/x-www-form-urlencoded' },
      body: json ? JSON.stringify(clean) : new URLSearchParams(clean).toString(),
    });
    if (res.status === 429) {
      if (attempt >= 3) throw new SlackError('ratelimited');
      await sleep(Math.min(Number(res.headers.get('retry-after')) || 5, 60) * 1000);
      continue;
    }
    const body = await res.json().catch(() => null);
    if (!body) throw new SlackError('HTTP ' + res.status);
    if (!body.ok) throw new SlackError(body.error || 'unknown_error', body.needed);
    return body as T;
  }
}

// Runs fn over items with at most n calls in flight.
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

type Team = { teamId: string; botUserId: string };

// Team and bot user IDs live in integrations.config: the webhook maps events to a workspace by team ID, and
// mentions are spotted by the bot's user ID. Refreshed on every sync and whenever they are missing.
async function ensureTeam(ws: string, token: string, config: Config, force = false): Promise<Team> {
  if (!force && config.teamId && config.botUserId) return { teamId: String(config.teamId), botUserId: String(config.botUserId) };
  const r = await call<{ team_id: string; user_id: string; team: string; url: string }>(token, 'auth.test');
  const next = { teamId: r.team_id, botUserId: r.user_id, teamName: r.team, teamUrl: r.url };
  if (config.teamId !== next.teamId || config.botUserId !== next.botUserId || config.teamName !== next.teamName) {
    const admin = supabaseAdmin();
    const cur = await admin.from('integrations').select('config').eq('workspace_id', ws).eq('provider', 'slack').maybeSingle();
    await admin.from('integrations').update({ config: { ...((cur.data && cur.data.config) || {}), ...next } }).eq('workspace_id', ws).eq('provider', 'slack');
  }
  Object.assign(config, next);
  return { teamId: next.teamId, botUserId: next.botUserId };
}

// users.info lookups, cached for one run.
function userCache(token: string) {
  const seen = new Map<string, Promise<SlackUser | null>>();
  const names: Record<string, string> = {};
  const get = (id: string) => {
    if (!seen.has(id)) {
      seen.set(id, call<{ user: { name?: string; real_name?: string; profile?: Record<string, string> } }>(token, 'users.info', { user: id })
        .then(({ user: u }) => {
          const p = u.profile || {};
          const name = p.display_name || u.real_name || p.real_name || u.name || 'Slack user';
          names[id] = name;
          return { name, avatar: p.image_72 || p.image_48 || null };
        })
        .catch(() => null));
    }
    return seen.get(id)!;
  };
  return { get, names };
}

const permalink = (token: string, channel: string, ts: string) =>
  call<{ permalink: string }>(token, 'chat.getPermalink', { channel, message_ts: ts }).then((r) => r.permalink).catch(() => null);

async function rowFor(token: string, users: ReturnType<typeof userCache>, ws: string, channelId: string, channelLabel: string, m: SlackMessage, botUserId: string, mention = false) {
  const [user, url] = await Promise.all([
    m.user ? users.get(m.user) : null, permalink(token, channelId, m.ts), Promise.all(mentionedIds(m.text || '').map(users.get)),
  ]);
  return toRow({ workspaceId: ws, channelId, channelLabel, m, user, names: users.names, url, botUserId, mention });
}

async function upsert(rows: InboxRow[]) {
  const admin = supabaseAdmin();
  for (let i = 0; i < rows.length; i += 200) {
    const res = await admin.from('inbox_items').upsert(rows.slice(i, i + 200), { onConflict: 'workspace_id,source,external_id' });
    if (res.error) throw new Error(res.error.message);
  }
}

type Chan = { id: string; name: string; label: string };

// Channels the bot is a member of (public and private).
async function myChannels(token: string): Promise<Chan[]> {
  const out: Chan[] = [];
  let cursor: string | undefined;
  do {
    const r = await call<{ channels: { id: string; name?: string }[]; response_metadata?: { next_cursor?: string } }>(token, 'users.conversations', {
      types: 'public_channel,private_channel', exclude_archived: true, limit: 200, cursor,
    });
    r.channels.forEach((c) => out.push({ id: c.id, name: c.name || c.id, label: '#' + (c.name || c.id) }));
    cursor = (r.response_metadata && r.response_metadata.next_cursor) || undefined;
  } while (cursor);
  return out;
}

const watchList = (config: Config) => String(config.channels || '').split(/[\s,]+/).map((x) => x.replace(/^#/, '')).filter(Boolean);

// config.channels holds IDs (names work too); blank means every channel the bot is in.
async function watchedChannels(token: string, config: Config): Promise<Chan[]> {
  const mine = await myChannels(token);
  const want = watchList(config);
  if (!want.length) return mine;
  return want.map((w) => mine.find((c) => c.id === w || c.name === w) || { id: w, name: w, label: '#' + w });
}

async function sync(ws: string, secret: Secret, config: Config) {
  const token = secret.botToken;
  const team = await ensureTeam(ws, token, config, true);
  const channels = await watchedChannels(token, config);
  if (!channels.length) return { summary: 'The bot is not in any channels yet. Invite it with /invite in Slack, then sync again.' };
  const admin = supabaseAdmin();
  const users = userCache(token);
  let added = 0;
  const skipped: string[] = [];
  for (const ch of channels) {
    const last = await admin.from('inbox_items').select('external_id').eq('workspace_id', ws).eq('source', 'slack')
      .eq('channel_id', ch.id).is('thread_id', null).order('occurred_at', { ascending: false }).limit(1).maybeSingle();
    const lastTs = last.data ? String(last.data.external_id).split(':')[1] : null;
    const oldest = lastTs || String(Math.floor(Date.now() / 1000) - BACKFILL_DAYS * 86400);
    const max = lastTs ? RUN_MAX : FIRST_MAX;
    const msgs: SlackMessage[] = [];
    let cursor: string | undefined;
    try {
      do {
        const r = await call<{ messages: SlackMessage[]; has_more?: boolean; response_metadata?: { next_cursor?: string } }>(token, 'conversations.history', {
          channel: ch.id, oldest, limit: 200, cursor,
        });
        msgs.push(...r.messages);
        cursor = r.has_more ? (r.response_metadata && r.response_metadata.next_cursor) || undefined : undefined;
      } while (cursor && msgs.length < max);
    } catch (err) {
      if (err instanceof SlackError && ['not_in_channel', 'channel_not_found', 'is_archived'].includes(err.code)) { skipped.push(ch.label); continue; }
      throw err;
    }
    // Newest first, so the cap keeps the most recent messages.
    const keep = msgs.filter((m) => m.ts !== lastTs && isPersonMessage(m, team.botUserId)).slice(0, max);
    const rows = await pool(keep, 4, (m) => rowFor(token, users, ws, ch.id, ch.label, m, team.botUserId));
    await upsert(rows);
    added += rows.length;
  }
  const watched = channels.length - skipped.length;
  let summary = added + ' new message' + (added === 1 ? '' : 's') + ' from ' + watched + ' channel' + (watched === 1 ? '' : 's') + '.';
  if (skipped.length) summary += ' Invite the bot to ' + skipped.join(', ') + ' to include ' + (skipped.length === 1 ? 'it' : 'them') + '.';
  return { summary };
}

const provider: ProviderModule = {
  async verify(secret) {
    const token = secret.botToken || '';
    if (!token.startsWith('xoxb-')) return 'use the bot token from OAuth & Permissions; it starts with xoxb-.';
    if (secret.signingSecret && !/^[A-Za-z0-9]{16,}$/.test(secret.signingSecret)) return 'the signing secret looks wrong; copy it from Basic Information > App Credentials.';
    const r = await call<{ bot_id?: string }>(token, 'auth.test');
    return r.bot_id ? null : 'this token is not a bot token.';
  },
  sync,
};

export default provider;

// ---------- Events API ----------

export type SlackEnvelope = {
  type?: string; challenge?: string; team_id?: string; event_id?: string;
  event?: SlackMessage & { channel?: string; deleted_ts?: string; message?: SlackMessage };
};

type Hit = { ws: string; secret: Secret; config: Config };

// Which connected workspaces this signed request belongs to: the signature must verify with that workspace's
// signing secret, and the team must match the one stored at sync time (re-checked once when it differs, in case
// the token was replaced).
export async function workspacesFor(raw: string, timestamp: string | null, signature: string | null, teamId?: string): Promise<Hit[]> {
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - Number(timestamp)) > WINDOW_SECONDS) return [];
  const out: Hit[] = [];
  for (const ws of await connectedWorkspaces('slack')) {
    const conn = await getIntegration(ws, 'slack').catch(() => null);
    if (!conn || !conn.secret.signingSecret || !signatureOk(conn.secret.signingSecret, timestamp, raw, signature)) continue;
    let ok = !teamId || !conn.config.teamId || conn.config.teamId === teamId;
    if (!ok) ok = (await ensureTeam(ws, conn.secret.botToken, conn.config, true).catch(() => null))?.teamId === teamId;
    if (ok) out.push({ ws, secret: conn.secret, config: conn.config });
  }
  return out;
}

// Stores one message, app_mention, edit or delete. Plain channel messages respect the watch list; mentions of the
// bot and direct messages always come through.
export async function handleEvent({ ws, secret, config }: Hit, env: SlackEnvelope) {
  const e = env.event;
  if (!e || !e.channel) return;
  const token = secret.botToken;
  const admin = supabaseAdmin();
  try {
    if (e.type === 'message' && e.subtype === 'message_deleted') {
      if (e.deleted_ts) await admin.from('inbox_items').delete().eq('workspace_id', ws).eq('source', 'slack').eq('external_id', externalId(e.channel, e.deleted_ts));
      return;
    }
    const team = await ensureTeam(ws, token, config);
    const users = userCache(token);
    if (e.type === 'message' && e.subtype === 'message_changed') {
      const m = e.message;
      if (!m || !m.ts) return;
      await Promise.all(mentionedIds(m.text || '').map(users.get));
      const text = plainText(m.text || '', users.names);
      const kind = kindOf({ ...m, channel_type: e.channel_type }, team.botUserId);
      const cur = await admin.from('inbox_items').select('meta').eq('workspace_id', ws).eq('source', 'slack').eq('external_id', externalId(e.channel, m.ts)).maybeSingle();
      if (!cur.data) return;
      await admin.from('inbox_items').update({ text, kind, meta: { ...(cur.data.meta || {}), edited: true }, updated_at: new Date().toISOString() })
        .eq('workspace_id', ws).eq('source', 'slack').eq('external_id', externalId(e.channel, m.ts));
      return;
    }
    const mention = e.type === 'app_mention';
    if ((e.type !== 'message' && !mention) || !isPersonMessage(e, team.botUserId)) return;
    const dm = e.channel_type === 'im';
    let chan = { name: e.channel, label: 'Direct message' };
    if (!dm) {
      const info = await call<{ channel: { name?: string } }>(token, 'conversations.info', { channel: e.channel }).catch(() => null);
      const name = (info && info.channel.name) || e.channel;
      chan = { name, label: '#' + name };
    }
    const want = watchList(config);
    const isMention = mention || kindOf(e, team.botUserId) === 'mention';
    if (!dm && !isMention && want.length && !want.includes(e.channel) && !want.includes(chan.name)) return;
    await upsert([await rowFor(token, users, ws, e.channel, chan.label, e, team.botUserId, mention)]);
  } catch (err) {
    await markChecked(ws, 'slack', 'Slack event ' + (env.event_id || '') + ' failed: ' + (err instanceof Error ? err.message : String(err)));
  }
}

// Posts a plain message as the bot; the bot must be in the channel (or have chat:write.public).
export async function postSlackMessage(ws: string, channel: string, text: string) {
  const conn = await getIntegration(ws, 'slack');
  if (!conn) throw new Error('Slack is not connected.');
  const r = await call<{ channel: string; ts: string }>(conn.secret.botToken, 'chat.postMessage', { channel, text }, true);
  return { channel: r.channel, ts: r.ts };
}

// Alerts (automations, notifications): to the Alerts channel from Settings, @mentioning the person when Slack finds
// their email (users:read.email). With no Alerts channel the bot messages the person directly.
export async function postSlackAlert(ws: string, text: string, email?: string | null) {
  const conn = await getIntegration(ws, 'slack');
  if (!conn) throw new Error('Slack is not connected.');
  const token = conn.secret.botToken;
  let userId = '';
  if (email) {
    userId = await call<{ user: { id: string } }>(token, 'users.lookupByEmail', { email }).then((r) => r.user.id).catch(() => '');
  }
  const channel = String(conn.config.alertChannel || '').trim() || userId;
  if (!channel) throw new Error('Add an Alerts channel to the Slack integration in Workspace Settings.');
  const body = userId && channel !== userId ? '<@' + userId + '> ' + text : text;
  const r = await call<{ channel: string; ts: string }>(token, 'chat.postMessage', { channel, text: body }, true);
  return { channel: r.channel, ts: r.ts };
}
