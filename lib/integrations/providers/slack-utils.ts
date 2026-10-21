// Pure Slack helpers (no I/O), kept apart so they can be tested on their own.
// Docs:
//   https://docs.slack.dev/authentication/verifying-requests-from-slack  (v0 signature, 5-minute window)
//   https://docs.slack.dev/messaging/formatting-message-text             (<@U..>, <#C..|name>, <url|label>, escaping)
//   https://docs.slack.dev/reference/events/message                      (subtypes, hidden, channel_type)
import { createHmac, timingSafeEqual } from 'node:crypto';

export type SlackMessage = {
  type?: string; subtype?: string; ts: string; user?: string; bot_id?: string; text?: string;
  thread_ts?: string; reply_count?: number; channel_type?: string; hidden?: boolean;
  edited?: { user?: string; ts?: string }; files?: { name?: string; title?: string }[];
};

export type SlackUser = { name: string; avatar: string | null };

export type InboxRow = {
  workspace_id: string; source: 'slack'; kind: string; external_id: string; channel_id: string; channel_label: string;
  thread_id: string | null; author_name: string; author_avatar_url: string | null; text: string; url: string | null;
  occurred_at: string; meta: Record<string, unknown>; updated_at: string;
};

export const WINDOW_SECONDS = 60 * 5;

// X-Slack-Signature is 'v0=' + hex HMAC-SHA256 of 'v0:<timestamp>:<raw body>' keyed by the signing secret.
export function signatureOk(signingSecret: string, timestamp: string | null, rawBody: string, signature: string | null, nowSeconds = Date.now() / 1000) {
  if (!signingSecret || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > WINDOW_SECONDS) return false;
  const want = Buffer.from('v0=' + createHmac('sha256', signingSecret).update('v0:' + timestamp + ':' + rawBody).digest('hex'));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}

export const externalId = (channel: string, ts: string) => channel + ':' + ts;
export const tsToIso = (ts: string) => new Date(Math.round(parseFloat(ts) * 1000)).toISOString();

// Subtypes that are someone actually saying something. Everything else (joins, topic changes, bot posts) is skipped.
const SAYS = new Set(['thread_broadcast', 'file_share', 'me_message']);
export const isPersonMessage = (m: SlackMessage, botUserId?: string) =>
  !!m.ts && !m.hidden && !m.bot_id && !!m.user && m.user !== botUserId && (!m.subtype || SAYS.has(m.subtype));

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Slack's encoded text to readable plain text. `names` maps user IDs already looked up to display names.
export function plainText(text: string, names: Record<string, string> = {}) {
  return unescape(String(text || '').replace(/<([^>]+)>/g, (_all, inner: string) => {
    const [target, label] = inner.split('|');
    if (target.startsWith('@')) return '@' + (label || names[target.slice(1)] || target.slice(1));
    if (target.startsWith('#')) return '#' + (label || target.slice(1));
    if (target.startsWith('!subteam^')) return label || '@group';
    if (target.startsWith('!date^')) return label || '';
    if (target.startsWith('!')) return '@' + target.slice(1);
    if (target.startsWith('mailto:')) return label || target.slice(7);
    return label || target;
  })).trim();
}

export const mentionedIds = (text: string) => Array.from(String(text || '').matchAll(/<@([A-Z0-9]+)(?:\|[^>]*)?>/g), (m) => m[1]);

export function kindOf(m: SlackMessage, botUserId?: string, forceMention = false) {
  if (m.channel_type === 'im') return 'dm';
  if (forceMention || (botUserId && mentionedIds(m.text || '').includes(botUserId))) return 'mention';
  return 'message';
}

export function toRow(p: {
  workspaceId: string; channelId: string; channelLabel: string; m: SlackMessage; user: SlackUser | null;
  names: Record<string, string>; url: string | null; botUserId?: string; mention?: boolean;
}): InboxRow {
  const m = p.m;
  const files = (m.files || []).map((f) => f.title || f.name).filter(Boolean);
  const text = plainText(m.text || '', p.names) || (files.length ? 'Shared ' + files.join(', ') : '');
  const reply = !!m.thread_ts && m.thread_ts !== m.ts;
  return {
    workspace_id: p.workspaceId, source: 'slack', kind: kindOf(m, p.botUserId, p.mention), external_id: externalId(p.channelId, m.ts),
    channel_id: p.channelId, channel_label: p.channelLabel + (reply ? ' · thread' : ''),
    thread_id: reply ? externalId(p.channelId, m.thread_ts!) : null,
    author_name: p.user ? p.user.name : 'Slack user', author_avatar_url: p.user ? p.user.avatar : null,
    text: text.slice(0, 4000), url: p.url, occurred_at: tsToIso(m.ts),
    meta: { ts: m.ts, user: m.user || null, thread_ts: m.thread_ts || null, reply_count: m.reply_count || 0, edited: !!m.edited },
    updated_at: new Date().toISOString(),
  };
}
