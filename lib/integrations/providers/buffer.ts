import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ProviderModule } from './types';
import type { Secret } from '../secrets';
import { channelRow, postRow, rateLeft, waitText, chunk } from './buffer-parse';

// Buffer GraphQL API with a personal API key (the legacy REST API at api.bufferapp.com/1 is closed). Docs used:
//   https://developers.buffer.com/guides/getting-started.md    endpoint https://api.buffer.com, always POST, what a key can do
//   https://developers.buffer.com/guides/authentication.md     Authorization: Bearer <key>, key covers every org on the account
//   https://developers.buffer.com/guides/building-apps.md      personal key vs app client
//   https://developers.buffer.com/guides/post-metrics.md       Post.metrics / metricsUpdatedAt, personal key only, daily refresh
//   https://developers.buffer.com/guides/api-limits.md         100 / 15 min, 250-500 / day, 3,000-15,000 / 30 days; 429 + Retry-After; RateLimit headers
//   https://developers.buffer.com/guides/pagination.md         first / after, pageInfo.hasNextPage / endCursor
//   https://developers.buffer.com/guides/efficient-api-usage.md  combine top-level fields, first: 100 on posts, filters
//   https://developers.buffer.com/guides/error-handling.md     errors[].extensions.code: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, RATE_LIMIT_EXCEEDED
//   https://developers.buffer.com/examples/get-organizations.md, get-channels.md, get-posts-with-metrics.md
//   https://developers.buffer.com/reference.md                 Account, Organization, Channel, Post, PostMetric, PostMetricType, Service,
//                                                              PostsInput / PostsFiltersInput / PostSortInput, Asset
//   https://developers.buffer.com/guides/rest-migration.md     legacy REST -> GraphQL
//
// Not readable with the API (reference.md, checked 2026-10-21): there is no query for comments, mentions or direct
// messages. The schema only describes them as channel capabilities (ChannelConfiguration.engagement,
// EngagementType comment/mention, Feature directMessage); the root Query has account, channel(s), posts, post,
// aggregatedPostMetrics, ideas, tags and similar, and nothing that lists engagements. So no inbox_items come from
// Buffer until Buffer adds one.
//
// Budget: a sync makes 1 call for the account plus 1 per organization (channels and the first 100 posts together)
// plus 1 per extra page of 100 posts. The Free plan allows 250 calls a day per key, so a sync stays well under it.

const API = 'https://api.buffer.com';
const PAGE = 100;
const FIRST_MAX = 300; // posts per organization on the first sync
const RUN_MAX = 500; // posts per organization on later syncs; stops at the first page with nothing new
const MAX_CALLS = 25;
const RESERVE = 5; // leave this many calls in the window for the Buffer app and other tools on the same key

type Json = Record<string, unknown>;

class BufferError extends Error {
  constructor(message: string, readonly code = '') { super(message); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function explain(status: number, body: Json | null, retryAfter: number): BufferError {
  const e = ((body && (body.errors as Json[])) || [])[0] || {};
  const ext = (e.extensions as Json) || {};
  const code = String(ext.code || (status === 401 ? 'UNAUTHORIZED' : status === 429 ? 'RATE_LIMIT_EXCEEDED' : ''));
  const raw = String(e.message || '');
  if (code === 'UNAUTHORIZED') return new BufferError('Buffer rejected the API key. Create a new one in Buffer under Settings > API and paste it here.', code);
  if (code === 'FORBIDDEN') return new BufferError('This key cannot read that Buffer organization' + (raw ? ': ' + raw : '.'), code);
  if (code === 'RATE_LIMIT_EXCEEDED')
    return new BufferError('Buffer\'s API limit for this key is used up' + (ext.window ? ' (' + ext.window + ' window)' : '') + '. Try again in ' + waitText(retryAfter || 900) + '.', code);
  if (/complexity|depth|aliases|tokens/i.test(raw)) return new BufferError('Buffer refused the query as too large: ' + raw, 'QUERY_LIMIT');
  return new BufferError('Buffer returned ' + (status || 'an error') + (raw ? ': ' + raw : '.'), code);
}

// One GraphQL call. On a 429 with a short Retry-After it waits and tries again (twice at most); a long one fails
// with the wait time. Returns `data` and the requests left in the tightest rate-limit window.
async function gql<T = Json>(key: string, query: string, variables: Json = {}): Promise<{ data: T; left: number | null }> {
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(API, {
        method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(30000),
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
    } catch (err) {
      throw new BufferError('Could not reach Buffer: ' + (err instanceof Error ? err.message : String(err)));
    }
    const body = (await res.json().catch(() => null)) as Json | null;
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    if (res.status === 429 && attempt < 3 && retryAfter > 0 && retryAfter <= 30) {
      await sleep((retryAfter + Math.random() * 2) * 1000);
      continue;
    }
    if (!res.ok || !body || (Array.isArray(body.errors) && body.errors.length && !body.data)) throw explain(res.status, body, retryAfter);
    const rl = rateLeft(res.headers.get('ratelimit'));
    return { data: body.data as T, left: rl ? rl.left : null };
  }
}

const ORGS = `query FtguOrgs { account { id organizations { id name } } }`;

const POST_FIELDS = `fragment FtguPost on Post {
  id text channelId channelService status sentAt dueAt externalLink
  assets { thumbnail }
  metrics { type name value unit }
  metricsUpdatedAt
}`;

const ORG_PAGE = `query FtguOrg($org: OrganizationId!, $first: Int) {
  channels(input: { organizationId: $org }) { id name displayName service type avatar externalLink isDisconnected isLocked }
  posts(first: $first, input: { organizationId: $org, filter: { status: [sent] }, sort: [{ field: createdAt, direction: desc }] }) {
    edges { node { ...FtguPost } }
    pageInfo { hasNextPage endCursor }
  }
}
${POST_FIELDS}`;

const POSTS_PAGE = `query FtguPosts($org: OrganizationId!, $first: Int, $after: String) {
  posts(first: $first, after: $after, input: { organizationId: $org, filter: { status: [sent] }, sort: [{ field: createdAt, direction: desc }] }) {
    edges { node { ...FtguPost } }
    pageInfo { hasNextPage endCursor }
  }
}
${POST_FIELDS}`;

// createPost answers with PostActionSuccess or one of the MutationError types (NotFoundError, InvalidInputError,
// LimitReachedError, ...); all of them carry `message`. https://developers.buffer.com/types/PostActionPayload.md
const CREATE_POST = `mutation FtguCreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id status dueAt externalLink } }
    ... on MutationError { message }
  }
}`;

export type CreatedPost = { id: string; status: string; dueAt: string | null; externalLink: string | null };

// Creates one post. A MutationError comes back as a thrown BufferError with Buffer's own message.
export async function createBufferPost(key: string, input: Json): Promise<CreatedPost> {
  const { data } = await gql<{ createPost: Json }>(key, CREATE_POST, { input });
  const r = (data && data.createPost) || {};
  const post = r.post as Json | undefined;
  if (r.__typename !== 'PostActionSuccess' || !post || !post.id) {
    throw new BufferError('Buffer did not create the post: ' + String(r.message || r.__typename || 'no answer') + '.', String(r.__typename || ''));
  }
  return { id: String(post.id), status: String(post.status || ''), dueAt: (post.dueAt as string) || null, externalLink: (post.externalLink as string) || null };
}

type Org = { id: string; name: string };
type PostsPage = { edges: { node: Json }[] | null; pageInfo: { hasNextPage: boolean; endCursor: string | null } };

async function organizations(key: string): Promise<{ orgs: Org[]; left: number | null }> {
  if (!key) throw new BufferError('Add the API key.');
  const { data, left } = await gql<{ account: { organizations: Org[] } }>(key, ORGS);
  const orgs = (data.account && data.account.organizations) || [];
  if (!orgs.length) throw new BufferError('This Buffer account has no organizations. Connect a channel in Buffer first.');
  return { orgs, left };
}

async function selectIds(table: string, column: string, ws: string): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin().from(table).select(column).eq('workspace_id', ws).range(from, from + 999);
    if (error) throw new Error(error.message);
    (data || []).forEach((r) => out.push(String((r as unknown as Json)[column])));
    if (!data || data.length < 1000) return out;
  }
}

const provider: ProviderModule = {
  // account { organizations } is the cheapest authenticated read and proves the key can see at least one org.
  async verify(secret: Secret) {
    try {
      await organizations(secret.apiKey);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },

  async sync(ws: string, secret: Secret) {
    const key = secret.apiKey;
    const admin = supabaseAdmin();
    const now = new Date().toISOString();
    const start = await organizations(key);
    const orgs = start.orgs;
    let left = start.left;
    let calls = 1;
    let stopped = '';
    const known = new Set(await selectIds('buffer_posts', 'post_id', ws));
    const first = known.size === 0;
    const channels: Json[] = [];
    const posts: Json[] = [];
    const seenOrgs: string[] = [];

    for (const org of orgs) {
      if (calls >= MAX_CALLS || (left !== null && left <= RESERVE)) { stopped = 'Stopped early to stay inside Buffer\'s API limit; sync again later for the rest.'; break; }
      const page1 = await gql<{ channels: Json[]; posts: PostsPage }>(key, ORG_PAGE, { org: org.id, first: PAGE });
      calls++; left = page1.left;
      seenOrgs.push(org.id);
      (page1.data.channels || []).forEach((c) => channels.push(channelRow(ws, org, c, now)));
      let page = page1.data.posts;
      let got = 0;
      const max = first ? FIRST_MAX : RUN_MAX;
      for (;;) {
        const nodes = (page.edges || []).map((e) => e.node).filter((n) => n && n.id);
        nodes.forEach((n) => posts.push(postRow(ws, org.id, n, now)));
        got += nodes.length;
        // Later syncs re-read the newest page for fresh metrics, then page back only while there are new posts.
        const fresh = nodes.some((n) => !known.has(String(n.id)));
        if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor || got >= max || (!first && !fresh)) break;
        if (calls >= MAX_CALLS || (left !== null && left <= RESERVE)) { stopped = 'Stopped early to stay inside Buffer\'s API limit; sync again later for older posts.'; break; }
        const next = await gql<{ posts: PostsPage }>(key, POSTS_PAGE, { org: org.id, first: PAGE, after: page.pageInfo.endCursor });
        calls++; left = next.left;
        page = next.data.posts;
      }
    }

    for (const part of chunk(channels, 500)) {
      const { error } = await admin.from('buffer_channels').upsert(part, { onConflict: 'workspace_id,channel_id' });
      if (error) throw new Error(error.message);
    }
    const uniq = new Map<string, Json>();
    posts.forEach((p) => uniq.set(String(p.post_id), p));
    const rows = [...uniq.values()];
    for (const part of chunk(rows, 500)) {
      const { error } = await admin.from('buffer_posts').upsert(part, { onConflict: 'workspace_id,post_id' });
      if (error) throw new Error(error.message);
    }

    // Channels removed from Buffer, and their posts. Only when every organization was read this run.
    if (!stopped && seenOrgs.length === orgs.length) {
      const live = channels.map((c) => String(c.channel_id));
      for (const t of ['buffer_channels', 'buffer_posts']) {
        let q = admin.from(t).delete().eq('workspace_id', ws);
        if (live.length) q = q.not('channel_id', 'in', '(' + live.map((id) => '"' + id.replace(/"/g, '') + '"').join(',') + ')');
        const { error } = await q;
        if (error) throw new Error(error.message);
      }
    }

    const added = rows.filter((r) => !known.has(String(r.post_id))).length;
    const withM = rows.filter((r) => Array.isArray(r.metrics) && (r.metrics as unknown[]).length).length;
    const n = (x: number, one: string, many: string) => x.toLocaleString('en-US') + ' ' + (x === 1 ? one : many);
    const summary = 'Synced ' + n(channels.length, 'channel', 'channels') + ' and ' + n(rows.length, 'sent post', 'sent posts') + ' (' + added + ' new, '
      + withM + ' with metrics). Used ' + n(calls, 'API call', 'API calls') + (left !== null ? ', ' + left + ' left in the tightest window' : '') + '.'
      + (stopped ? ' ' + stopped : '');
    return { summary };
  },
};

export default provider;
