import 'server-only';
import type { ProviderModule } from './types';

// Apify REST API v2, called with fetch. Docs used:
// https://docs.apify.com/api/v2 (auth: `Authorization: Bearer <token>`, /v2/actors/ prefix, `username~actor` IDs)
// https://docs.apify.com/api/v2/users-me-get
// https://docs.apify.com/api/v2/act-runs-post (timeout, memory, maxItems, maxTotalChargeUsd, waitForFinish <= 60)
// https://docs.apify.com/api/v2/actor-run-get
// https://docs.apify.com/api/v2/actor-run-abort-post
// https://docs.apify.com/api/v2/dataset-items-get

const API = 'https://api.apify.com/v2';
const DONE = ['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'];

export type ApifyRun = { id: string; status: string; defaultDatasetId: string; statusMessage?: string; usageTotalUsd?: number };
export type ApifyLimits = { timeoutSecs: number; maxItems: number; maxTotalChargeUsd: number; memoryMbytes?: number };

async function call<T>(token: string, path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const res = await fetch(API + path, {
    ...init, signal,
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body && body.error && body.error.message ? body.error.message : 'HTTP ' + res.status;
    throw new Error('Apify: ' + msg);
  }
  return body as T;
}

// Starts an actor run with hard caps on run time, charged items and total spend. Returns at once.
export async function startActor(token: string, actorId: string, input: unknown, lim: ApifyLimits): Promise<ApifyRun> {
  const q = new URLSearchParams({
    timeout: String(lim.timeoutSecs), maxItems: String(lim.maxItems), maxTotalChargeUsd: String(lim.maxTotalChargeUsd),
  });
  if (lim.memoryMbytes) q.set('memory', String(lim.memoryMbytes));
  const out = await call<{ data: ApifyRun }>(token, '/actors/' + actorId + '/runs?' + q, { method: 'POST', body: JSON.stringify(input) });
  return out.data;
}

export async function getRun(token: string, runId: string, waitSecs = 0, signal?: AbortSignal): Promise<ApifyRun> {
  const out = await call<{ data: ApifyRun }>(token, '/actor-runs/' + runId + '?waitForFinish=' + Math.min(60, Math.max(0, waitSecs)), {}, signal);
  return out.data;
}

export async function abortRun(token: string, runId: string): Promise<void> {
  await call(token, '/actor-runs/' + runId + '/abort', { method: 'POST' }).catch(() => null);
}

export async function datasetItems<T = Record<string, unknown>>(token: string, datasetId: string, limit: number): Promise<T[]> {
  const out = await call<T[]>(token, '/datasets/' + datasetId + '/items?clean=true&format=json&limit=' + limit);
  return Array.isArray(out) ? out : [];
}

// Runs an actor to completion (or until `deadline`), then reads up to `lim.maxItems` items from its dataset.
// A run still going at the deadline is aborted and whatever it saved so far is returned.
// `onStart` gets the run ID as soon as Apify accepts the run, so callers can record it or abort it.
export async function runActor<T = Record<string, unknown>>(
  token: string, actorId: string, input: unknown, lim: ApifyLimits,
  opts: { deadline: number; onStart?: (runId: string) => void | Promise<void>; cancelled?: () => Promise<boolean> },
): Promise<{ run: ApifyRun; items: T[] }> {
  let run = await startActor(token, actorId, input, lim);
  if (opts.onStart) await opts.onStart(run.id);
  while (!DONE.includes(run.status)) {
    const left = Math.floor((opts.deadline - Date.now()) / 1000);
    if (left <= 2 || (opts.cancelled && (await opts.cancelled()))) {
      await abortRun(token, run.id);
      run = { ...run, status: 'ABORTED' };
      break;
    }
    run = await getRun(token, run.id, Math.min(30, left - 1));
  }
  const items = run.defaultDatasetId ? await datasetItems<T>(token, run.defaultDatasetId, lim.maxItems) : [];
  if (run.status !== 'SUCCEEDED' && !items.length) {
    const why = run.status === 'FAILED' ? await failureReason(token, run.id) : '';
    throw new Error('Apify run ' + run.status.toLowerCase() + (run.statusMessage ? ': ' + run.statusMessage : '') + (why ? ' (' + why + ')' : '') + '.');
  }
  return { run, items };
}

// The actor's own explanation of a failed run, from the tail of its log: the first ERROR line, with the actor's
// input-validation detail when it printed one (e.g. which field it rejected). Empty when the log is unavailable.
// https://docs.apify.com/api/v2/log-get
async function failureReason(token: string, runId: string): Promise<string> {
  try {
    const res = await fetch(API + '/logs/' + runId + '?stream=0', { headers: { authorization: 'Bearer ' + token } });
    if (!res.ok) return '';
    const lines = (await res.text()).split('\n').map((l) => l.replace(/^\S+\s+/, '').trim()).filter(Boolean);
    const errs = lines.filter((l) => /^(ERROR|Error:|.*\bError\b.*(input|field|must|required|invalid))/i.test(l));
    const detail = lines.find((l) => /^\s*(Field|Property|Input)\b.*(must|invalid|required|is not)/i.test(l));
    const pick = [errs[0], detail].filter((x): x is string => !!x).join(' ').replace(/\s+/g, ' ');
    return pick.slice(0, 240);
  } catch {
    return '';
  }
}

const provider: ProviderModule = {
  async verify(secret) {
    if (!secret.apiToken) return 'Add the API token.';
    const res = await fetch(API + '/users/me', { headers: { authorization: 'Bearer ' + secret.apiToken }, signal: AbortSignal.timeout(15000) });
    if (res.status === 401) return 'The API token is not valid.';
    if (!res.ok) return 'Apify answered HTTP ' + res.status + '.';
    return null;
  },
};

export default provider;
