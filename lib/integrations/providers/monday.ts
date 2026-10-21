import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Secret, Config } from '../secrets';
import type { ProviderModule } from './types';
import { parseStatusMap, statusLabels, toMondayLabel, planItem, type Item, type Project, type Status, type Label } from './monday-map';

// monday.com GraphQL API. Docs used:
// https://developer.monday.com/api-reference/docs/authentication (raw token in Authorization, POST /v2)
// https://developer.monday.com/api-reference/docs/api-versioning (API-Version header, YYYY-MM)
// https://developer.monday.com/api-reference/docs/rate-limits and /docs/errors (complexity budget, retry_in_seconds, Retry-After)
// https://developer.monday.com/api-reference/reference/items-page and /reference/next-items-page (cursor paging, max 500, 60 min cursors)
// https://developer.monday.com/api-reference/reference/items (items(ids), max 100, exclude_nonactive)
// https://developer.monday.com/api-reference/reference/columns (columns(types), settings JSON, change_column_value)
// https://developer.monday.com/api-reference/reference/status (StatusValue label, settings.labels)
// https://developer.monday.com/api-reference/reference/webhooks (create_webhook, webhooks, delete_webhook, challenge, payloads)

const API = 'https://api.monday.com/v2';
const VERSION = '2026-07';
const PAGE = 250;

type Gql = { data?: Record<string, unknown>; errors?: { message: string; extensions?: { code?: string; retry_in_seconds?: number } }[]; error_message?: string };

async function gql<T = Record<string, unknown>>(token: string, query: string, variables: Record<string, unknown> = {}, tries = 3): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': VERSION },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as Gql;
  const err = body.errors && body.errors[0];
  const wait = Number((err && err.extensions && err.extensions.retry_in_seconds) || res.headers.get('retry-after') || 0);
  if ((res.status === 429 || (err && /BUDGET_EXHAUSTED|RATE_LIMIT|Rate Limit|Minute limit/i.test((err.extensions && err.extensions.code) || err.message)))
      && tries > 1 && wait > 0 && wait <= 30) {
    await new Promise((r) => setTimeout(r, wait * 1000));
    return gql<T>(token, query, variables, tries - 1);
  }
  if (res.status === 401) throw new Error('monday did not accept the API token.');
  if (err) throw new Error(err.message);
  if (!res.ok || !body.data) throw new Error(body.error_message || 'monday returned HTTP ' + res.status + '.');
  return body.data as T;
}

type Column = { id: string; title: string; type: string; settings: unknown };
type Board = { id: string; name: string; columns: Column[] };
type Ctx = { token: string; boardId: string; column: Column; labels: Label[]; jobColumnId: string };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

// The board and its status column, or a message the Super Admin can act on.
async function boardContext(secret: Secret, config: Config): Promise<Ctx> {
  const token = str(secret.apiToken);
  const boardId = str(config.boardId);
  if (!token) throw new Error('Add an API token.');
  if (!/^\d+$/.test(boardId)) throw new Error('The board ID is the number in the board URL.');
  const data = await gql<{ boards: Board[] }>(token,
    'query ($b: [ID!]) { boards(ids: $b) { id name columns { id title type settings } } }', { b: [boardId] });
  const board = data.boards && data.boards[0];
  if (!board) throw new Error('Board ' + boardId + ' was not found, or this token cannot read it.');
  const want = str(config.statusColumnId);
  const column = want ? board.columns.find((c) => c.id === want) : board.columns.find((c) => c.type === 'status');
  if (!column) throw new Error(want ? 'No column with ID "' + want + '" on ' + board.name + '.' : board.name + ' has no status column.');
  if (column.type !== 'status') throw new Error('Column "' + column.title + '" is not a status column.');
  const jobColumnId = str(config.jobColumnId);
  if (jobColumnId && !board.columns.some((c) => c.id === jobColumnId)) throw new Error('No column with ID "' + jobColumnId + '" on ' + board.name + '.');
  return { token, boardId, column, labels: statusLabels(column.settings), jobColumnId };
}

type RawItem = { id: string; name: string; column_values: { id: string; text: string | null; label?: string | null }[] };
const ITEM_FIELDS = 'id name column_values(ids: $cols) { id text ... on StatusValue { label } }';
const colsOf = (c: Ctx) => [c.column.id].concat(c.jobColumnId ? [c.jobColumnId] : []);
const toItem = (c: Ctx, r: RawItem): Item => {
  const cv = (id: string) => r.column_values.find((v) => v.id === id);
  const st = cv(c.column.id);
  return { id: String(r.id), name: r.name || '', status: str(st ? st.label || st.text : ''), job: c.jobColumnId ? str((cv(c.jobColumnId) || {}).text) : '' };
};

async function allItems(c: Ctx): Promise<Item[]> {
  const first = await gql<{ boards: { items_page: { cursor: string | null; items: RawItem[] } }[] }>(c.token,
    `query ($b: [ID!], $cols: [String!], $n: Int!) { boards(ids: $b) { items_page(limit: $n) { cursor items { ${ITEM_FIELDS} } } } }`,
    { b: [c.boardId], cols: colsOf(c), n: PAGE });
  let page = first.boards[0] ? first.boards[0].items_page : { cursor: null, items: [] };
  const out = page.items.map((r) => toItem(c, r));
  while (page.cursor) {
    const next = await gql<{ next_items_page: { cursor: string | null; items: RawItem[] } }>(c.token,
      `query ($cur: String!, $cols: [String!], $n: Int!) { next_items_page(cursor: $cur, limit: $n) { cursor items { ${ITEM_FIELDS} } } }`,
      { cur: page.cursor, cols: colsOf(c), n: PAGE });
    page = next.next_items_page;
    out.push(...page.items.map((r) => toItem(c, r)));
  }
  return out;
}

async function itemsById(c: Ctx, ids: string[]): Promise<Item[]> {
  const out: Item[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const d = await gql<{ items: (RawItem & { board: { id: string } | null })[] }>(c.token,
      `query ($ids: [ID!], $cols: [String!]) { items(ids: $ids, limit: 100, exclude_nonactive: true) { board { id } ${ITEM_FIELDS} } }`,
      { ids: ids.slice(i, i + 100), cols: colsOf(c) });
    out.push(...(d.items || []).filter((r) => r.board && String(r.board.id) === c.boardId).map((r) => toItem(c, r)));
  }
  return out;
}

const count = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);

// Writes monday items into the workspace's projects with the secret-key client. Idempotent: linked projects only
// change when monday differs. Projects are never deleted.
async function applyItems(ws: string, config: Config, items: Item[], full: boolean): Promise<string> {
  const admin = supabaseAdmin();
  const [stRes, prRes, setRes, spRes] = await Promise.all([
    admin.from('project_statuses').select('id, label').eq('workspace_id', ws).order('sort'),
    admin.from('projects').select('id, title, job_code, status_id, monday_item_id').eq('workspace_id', ws),
    admin.from('workspace_settings').select('require_sponsor_approval').eq('workspace_id', ws).maybeSingle(),
    admin.from('sponsorships').select('project_id, approval_status, projects!inner(workspace_id)').eq('projects.workspace_id', ws).neq('approval_status', 'approved'),
  ]);
  for (const r of [stRes, prRes, setRes, spRes]) if (r.error) throw new Error(r.error.message);
  const statuses = (stRes.data || []) as Status[];
  const projects = (prRes.data || []) as Project[];
  if (!statuses.length) throw new Error('Add a project status in Settings before syncing.');
  const needsApproval = !!(setRes.data && setRes.data.require_sponsor_approval);
  const pending = new Set((spRes.data || []).map((s) => s.project_id as string));
  const pairs = parseStatusMap(config.statusMap);

  const byItem = new Map(projects.filter((p) => p.monday_item_id).map((p) => [p.monday_item_id as string, p]));
  const byJob = new Map(projects.map((p) => [p.job_code.toLowerCase(), p]));
  const unmatched = new Map<string, number>();
  const creates: Record<string, unknown>[] = [];
  const createdNames: string[] = [];
  const logs: Record<string, unknown>[] = [];
  const held: string[] = [];
  let updated = 0, same = 0, failed = 0;
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const { plan, unmatched: um } = planItem(item, byItem, byJob, pairs, statuses);
    if (um) unmatched.set(um, (unmatched.get(um) || 0) + 1);
    if (plan.kind === 'same') { same++; continue; }
    if (plan.kind === 'create') {
      const title = item.name.trim() || 'Untitled monday item';
      creates.push({ workspace_id: ws, job_code: plan.jobCode, title, status_id: plan.status.id, monday_item_id: item.id });
      byJob.set(plan.jobCode.toLowerCase(), { id: '', title, job_code: plan.jobCode, status_id: plan.status.id, monday_item_id: item.id });
      createdNames.push(title);
      continue;
    }
    const { project, patch, diff } = plan;
    const to = diff.status ? diff.status.to : '';
    if (patch.status_id && needsApproval && (to === 'Scheduled' || to === 'Live') && pending.has(project.id)) {
      delete patch.status_id; delete diff.status;
      held.push(project.title);
      if (plan.kind === 'update' && !Object.keys(patch).length) { same++; continue; }
    }
    const res = await admin.from('projects').update(patch).eq('id', project.id);
    if (res.error) { failed++; console.warn('monday sync', project.id, res.error.message); continue; }
    project.monday_item_id = item.id;
    byItem.set(item.id, project);
    updated++;
    const fields = Object.keys(diff);
    logs.push({
      workspace_id: ws, actor_label: 'monday.com', category: 'project', source: 'api', target_type: 'project',
      target_id: project.id, project_id: project.id, target_label: patch.title || project.title, diff,
      action: plan.kind === 'link' ? 'linked to monday' + (fields.length ? ' and updated ' + fields.join(' and ') : '') + ' on' : 'updated ' + fields.join(' and ') + ' on',
    });
  }

  let created = 0;
  if (creates.length) {
    const res = await admin.from('projects').upsert(creates, { onConflict: 'workspace_id,monday_item_id', ignoreDuplicates: true }).select('id, title');
    if (res.error) throw new Error(res.error.message);
    created = (res.data || []).length;
    for (const p of res.data || []) {
      logs.push({ workspace_id: ws, actor_label: 'monday.com', category: 'project', source: 'api', target_type: 'project',
        target_id: p.id, project_id: p.id, target_label: p.title, action: 'created the project from monday' });
    }
  }
  if (logs.length) {
    const res = await admin.from('activity_log').insert(logs);
    if (res.error) console.warn('monday activity log', res.error.message);
  }

  const parts = [count(items.length, 'item') + ': ' + [count(created, 'new project'), updated + ' updated', same + ' unchanged'].join(', ') + '.'];
  if (failed) parts.push(count(failed, 'project') + ' could not be updated.');
  if (unmatched.size) parts.push('No board status for ' + [...unmatched].map(([l, n]) => '"' + l + '" (' + n + ')').join(', ') + '. Add them to the status mapping.');
  if (held.length) parts.push('Waiting on sponsor approval: ' + held.slice(0, 3).join(', ') + (held.length > 3 ? ' and ' + (held.length - 3) + ' more' : '') + '.');
  if (full) {
    const gone = projects.filter((p) => p.monday_item_id && !seen.has(p.monday_item_id));
    if (gone.length) parts.push(count(gone.length, 'linked project') + ' no longer on the board: ' + gone.slice(0, 3).map((p) => p.title).join(', ') + (gone.length > 3 ? '…' : '') + '. Left as is.');
  }
  return parts.join(' ');
}

// ---------- Webhooks ----------
// monday only signs webhooks created with an app's OAuth token, not a personal token, so the URL carries a
// per-workspace HMAC instead. The handler also never trusts the payload: it re-reads the item from the API.
const hookSecret = () => process.env.MONDAY_WEBHOOK_SECRET || process.env.SUPABASE_SECRET_KEY || '';
export const webhookToken = (ws: string) => createHmac('sha256', hookSecret()).update('monday:' + ws).digest('base64url');
export function webhookTokenOk(ws: string, t: string) {
  if (!hookSecret() || !t) return false;
  const a = Buffer.from(webhookToken(ws)), b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b);
}

function publicBase(): string | null {
  const raw = process.env.APP_BASE_URL || '';
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || /^(localhost|127\.|0\.0\.0\.0|\[::1\])|\.local(host)?$/.test(u.hostname)) return null;
    return u.origin;
  } catch { return null; }
}

// config.webhooks keeps the subscription IDs and a hash of what they were made for (URL, board, status column), so
// the URL token is never readable from config.
type Hooks = { key: string; ids: string[] };

// Subscribes the board to status, name and new item events once APP_BASE_URL is public. Re-creates them when the
// board, status column or URL changes. Returns a note for the sync summary.
async function ensureWebhooks(ws: string, c: Ctx, config: Config): Promise<string> {
  const base = publicBase();
  if (!base) return 'Real-time updates start once APP_BASE_URL is a public https URL.';
  const url = base + '/api/webhooks/monday?ws=' + ws + '&t=' + webhookToken(ws);
  const key = createHash('sha256').update([url, c.boardId, c.column.id].join('|')).digest('base64url').slice(0, 24);
  const prev = (config.webhooks || null) as Hooks | null;
  const live = await gql<{ webhooks: { id: string }[] }>(c.token, 'query ($b: ID!) { webhooks(board_id: $b) { id } }', { b: c.boardId });
  const liveIds = new Set((live.webhooks || []).map((w) => String(w.id)));
  if (prev && prev.key === key && prev.ids.length && prev.ids.every((id) => liveIds.has(id))) {
    return 'Real-time updates on.';
  }
  for (const id of prev ? prev.ids : []) {
    await gql(c.token, 'mutation ($id: ID!) { delete_webhook(id: $id) { id } }', { id }).catch(() => null);
  }
  const create = 'mutation ($b: ID!, $u: String!, $e: WebhookEventType!, $c: JSON) { create_webhook(board_id: $b, url: $u, event: $e, config: $c) { id } }';
  const ids: string[] = [];
  const events: [string, string | null][] = [
    ['change_status_column_value', JSON.stringify({ columnId: c.column.id, columnValue: { $any$: true } })],
    ['change_name', null],
    ['create_item', null],
  ];
  for (const [e, cfg] of events) {
    const d = await gql<{ create_webhook: { id: string } }>(c.token, create, { b: c.boardId, u: url, e, c: cfg });
    ids.push(String(d.create_webhook.id));
  }
  const hooks: Hooks = { key, ids };
  // Re-read config so a Settings save made during the sync is kept; only the webhooks key changes.
  const admin = supabaseAdmin();
  const cur = await admin.from('integrations').select('config').eq('workspace_id', ws).eq('provider', 'monday').maybeSingle();
  const res = await admin.from('integrations').update({ config: { ...((cur.data && cur.data.config) || {}), webhooks: hooks } })
    .eq('workspace_id', ws).eq('provider', 'monday');
  if (res.error) console.warn('monday webhooks config', res.error.message);
  return 'Real-time updates on.';
}

// ---------- Entry points ----------
// Webhook: re-read the named items and apply them.
export async function pullItems(ws: string, secret: Secret, config: Config, ids: string[]) {
  const c = await boardContext(secret, config);
  const items = await itemsById(c, ids);
  return items.length ? applyItems(ws, config, items, false) : 'Nothing to update.';
}

// Dashboard status change -> the linked item's status column. Returns null on success or a message.
export async function pushStatus(secret: Secret, config: Config, itemId: string, boardLabel: string): Promise<string | null> {
  const c = await boardContext(secret, config);
  const target = toMondayLabel(boardLabel, parseStatusMap(config.statusMap), c.labels);
  if (!target) return 'monday has no "' + boardLabel + '" label on ' + c.column.title + '. Add it in monday or to the status mapping.';
  const cur = await gql<{ items: { column_values: { label?: string | null }[] }[] }>(c.token,
    'query ($ids: [ID!], $cols: [String!]) { items(ids: $ids) { column_values(ids: $cols) { ... on StatusValue { label } } } }',
    { ids: [itemId], cols: [c.column.id] });
  const now = cur.items && cur.items[0];
  if (!now) return 'The linked monday item was not found.';
  if (now.column_values[0] && now.column_values[0].label === target.label) return null;
  await gql(c.token,
    'mutation ($b: ID!, $i: ID!, $col: String!, $v: JSON!) { change_column_value(board_id: $b, item_id: $i, column_id: $col, value: $v) { id } }',
    { b: c.boardId, i: itemId, col: c.column.id, v: JSON.stringify({ label: target.label }) });
  return null;
}

const provider: ProviderModule = {
  async verify(secret, config) {
    try {
      const c = await boardContext(secret, config);
      if (!c.labels.length) return 'Column "' + c.column.title + '" has no labels.';
      const pairs = parseStatusMap(config.statusMap);
      const missing = pairs.filter((p) => !c.labels.some((l) => l.label.trim().toLowerCase() === p.monday.toLowerCase()));
      if (missing.length) return 'Status mapping names labels monday does not have: ' + missing.map((p) => p.monday).join(', ') + '.';
      if (str(config.statusMap) && !pairs.length) return 'Write the status mapping as monday label=board status, separated by commas.';
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },
  async sync(ws, secret, config) {
    const c = await boardContext(secret, config);
    const summary = await applyItems(ws, config, await allItems(c), true);
    const hooks = await ensureWebhooks(ws, c, config).catch((err) => 'Real-time updates not set up: ' + (err instanceof Error ? err.message : String(err)));
    return { summary: summary + ' ' + hooks };
  },
};

export default provider;
