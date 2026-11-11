import 'server-only';
import { randomUUID } from 'node:crypto';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { Member } from '@/lib/integrations/auth';
import { getIntegration } from '@/lib/integrations/secrets';
import { firecrawlSearch } from '@/lib/integrations/providers/firecrawl';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { workspaceModels, withFallback } from '@/lib/ai/model';
import { recordUsage } from '@/lib/ai/usage';
import { modelUsageCost, modelAllowance, priceOverrides, refuseSpend, reserveSpend } from '@/lib/ai/spend';
import { normalizeIdeasRules, type IdeasRules } from './rules-shared';
import { RESEARCH_INSTRUCTIONS, fillBrief, isActiveRun, parseResearchOutput, parseRun, pickSources, researchPrompt, searchQueryFromBrief, type IdeaRun } from './research-shared';

// Firecrawl search, estimated at about 2 credits per 10 results on the paid plans.
const SEARCH_USD = 0.01;
const ANSWER_TOKENS = 1500;
const STALE_MS = 5 * 60 * 1000;
const RETRY_QUEUED_MS = 60 * 1000;
const TICK_LIMIT = 3;

const schema = z.object({
  summary: z.string(),
  findings: z.array(z.string()),
  scores: z.array(z.object({ key: z.string(), score: z.number(), reason: z.string() })),
  next_steps: z.array(z.string()),
  sources_used: z.array(z.string()),
});

async function rulesFor(workspaceId: string): Promise<IdeasRules> {
  const { data } = await supabaseAdmin().from('ideas_rules').select('rules').eq('workspace_id', workspaceId).maybeSingle();
  return normalizeIdeasRules(data?.rules);
}

function mayResearch(m: Member, rules: IdeasRules, authorId: string): boolean {
  if (m.ctx.role === 'super_admin') return true;
  if (m.ctx.role === 'manager') {
    const perms = (m.ctx as unknown as { perms?: [string, string][] }).perms || [];
    return perms.some((p) => p[0] === 'ideas' && p[1] === 'edit');
  }
  return m.ctx.role === 'designer' && rules.designers_can_research && authorId === m.ctx.user_id;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 500);

// Puts one idea on the queue. The caller must be able to see the idea, and the run must fit under today's limit.
export async function queueIdeaResearch(m: Member, ideaId: string): Promise<{ runId: string } | { error: string; status: number }> {
  const { data: idea } = await m.supabase.from('ideas').select('id, workspace_id, author_id, run, archived_at').eq('id', ideaId).maybeSingle();
  if (!idea) return { error: 'Idea not available.', status: 404 };
  if (idea.archived_at) return { error: 'Restore this idea before running research.', status: 400 };
  const rules = await rulesFor(idea.workspace_id);
  if (!mayResearch(m, rules, idea.author_id)) return { error: 'You cannot run research on this idea.', status: 403 };
  if (isActiveRun(parseRun(idea.run))) return { error: 'Research is already running on this idea.', status: 409 };
  const refused = await refuseSpend(idea.workspace_id, rules, SEARCH_USD, 0);
  if (refused) return { error: refused, status: 429 };
  const run: IdeaRun = { id: randomUUID(), state: 'queued', queued_at: new Date().toISOString(), by: m.ctx.user_id };
  let admission = supabaseAdmin().from('ideas').update({ run }).eq('id', ideaId);
  admission = idea.run == null ? admission.is('run', null) : admission.eq('run', JSON.stringify(idea.run));
  const { data: admitted, error } = await admission.select('id').maybeSingle();
  if (!error && !admitted) return { error: 'Another research request changed this idea. Refresh and try again.', status: 409 };
  if (error) return { error: 'The run could not be queued.', status: 500 };
  return { runId: run.id! };
}

export async function cancelIdeaResearch(m: Member, ideaId: string): Promise<{ error: string; status: number } | null> {
  const { data: idea } = await m.supabase.from('ideas').select('author_id, workspace_id, run').eq('id', ideaId).maybeSingle();
  if (!idea) return { error: 'Idea not available.', status: 404 };
  if (!mayResearch(m, await rulesFor(idea.workspace_id), idea.author_id)) return { error: 'You cannot cancel this run.', status: 403 };
  const run = parseRun(idea.run);
  if (!run || !isActiveRun(run)) return null;
  await finishRun(ideaId, run, { state: 'canceled' });
  return null;
}

// Writes the run's end state only if it is still the run on the idea, so a stale worker can never overwrite a newer one.
async function finishRun(ideaId: string, run: IdeaRun, patch: Partial<IdeaRun>, extra: Record<string, unknown> = {}) {
  const next = { ...run, ...patch, finished_at: new Date().toISOString() };
  return supabaseAdmin().from('ideas').update({ run: next, ...extra }).eq('id', ideaId).filter('run->>id', 'eq', run.id!).filter('run->>state', 'in', '(queued,running)').select('id').maybeSingle();
}

// The whole run for one idea. Safe to call twice: only the caller that claims the queued run does any work.
export async function processIdeaResearch(ideaId: string, runId: string): Promise<void> {
  const admin = supabaseAdmin();
  const { data: row } = await admin.from('ideas').select('run').eq('id', ideaId).maybeSingle();
  const queued = row && parseRun(row.run);
  if (!queued || queued.id !== runId || queued.state !== 'queued') return;
  const running: IdeaRun = { ...queued, state: 'running', started_at: new Date().toISOString() };
  const { data: idea } = await admin.from('ideas').update({ run: running }).eq('id', ideaId).filter('run->>id', 'eq', runId).filter('run->>state', 'eq', 'queued')
    .select('id, workspace_id, brand_id, title, idea_type, body, refs, stage').maybeSingle();
  if (!idea) return;

  const ws: string = idea.workspace_id;
  const userId = queued.by && queued.by !== 'auto' ? queued.by : null;
  let spent = 0;
  try {
    const rules = await rulesFor(ws);
    const firecrawl = await getIntegration(ws, 'firecrawl');
    if (!firecrawl) throw new Error('Connect Firecrawl to run idea research.');
    const models = await workspaceModels(ws);
    if (!models.length) throw new Error('No AI model is connected.');
    const { data: brand } = await admin.from('brand_kits').select('name, voice_prompt').eq('id', idea.brand_id).maybeSingle();

    const brief = fillBrief(rules.research_brief, { title: idea.title, type: idea.idea_type, notes: (idea.body || []).join(' '), brand: brand?.name || '' });
    const query = searchQueryFromBrief(brief);
    const refusedSearch = await refuseSpend(ws, rules, SEARCH_USD, spent);
    if (refusedSearch) throw new Error(refusedSearch);
    const settleSearch = await reserveSpend(ws, runId, rules, 'firecrawl', 'search', SEARCH_USD);
    const hits = await firecrawlSearch(firecrawl.secret.apiKey, query, { limit: rules.max_sources });
    await settleSearch(SEARCH_USD);
    spent += SEARCH_USD;
    await recordUsage({ workspaceId: ws, userId, feature: 'research', provider: 'firecrawl', model: 'search', costUsd: SEARCH_USD, runId });

    const sources = pickSources((idea.refs || []).filter((r: string) => /^https?:\/\//i.test(r)), hits, rules.max_sources);
    const prompt = researchPrompt({ brief, sources, criteria: rules.scoring, voice: brand?.voice_prompt || '' });
    const prices = await priceOverrides(ws);
    const drafted = await withFallback(models, async (wm) => {
      const active = await admin.from('ideas').select('id').eq('id', ideaId).filter('run->>id', 'eq', runId).filter('run->>state', 'eq', 'running').maybeSingle();
      if (active.error || !active.data) throw new Error('Research was canceled or replaced.');
      const settle = await reserveSpend(ws, runId, rules, wm.provider, wm.modelId, modelAllowance(wm.provider, wm.modelId, prompt + RESEARCH_INSTRUCTIONS, ANSWER_TOKENS, prices));
      const res = await generateText({ model: wm.model, instructions: RESEARCH_INSTRUCTIONS, prompt, output: Output.object({ schema }), maxRetries: 0, maxOutputTokens: ANSWER_TOKENS, timeout: 120000 });
      const costUsd = modelUsageCost(wm.provider, wm.modelId, res.totalUsage, prices);
      await settle(costUsd);
      await recordUsage({ workspaceId: ws, userId, feature: 'research', provider: wm.provider, model: wm.modelId, usage: res.totalUsage, costUsd, runId });
      return { output: res.output, costUsd };
    });
    spent += drafted.result.costUsd;

    const research = parseResearchOutput(drafted.result.output, { sources, criteria: rules.scoring, model: drafted.used.modelId, query });
    const saved = await finishRun(ideaId, running, { state: 'done', model: drafted.used.modelId, cost_usd: Math.round(spent * 10000) / 10000 }, { research });
    if (!saved.data) return;
    await admin.from('activity_log').insert({
      workspace_id: ws, actor_id: userId, actor_label: 'Research', category: 'idea', action: 'finished research', target_type: 'idea', target_id: ideaId, target_label: idea.title, idea_id: ideaId, source: 'api',
    });
    // Research never moves an idea past Research. If a gate on Research refuses the move, the idea simply stays in Inbox.
    if (idea.stage === 'inbox') {
      const moved = await admin.from('ideas').update({ stage: 'research' }).eq('id', ideaId).eq('stage', 'inbox');
      if (moved.error && moved.error.code !== '23514') console.warn('idea research stage move', moved.error.message);
    }
  } catch (err) {
    await finishRun(ideaId, running, { state: 'failed', error: message(err), cost_usd: Math.round(spent * 10000) / 10000 });
  }
}

// Every minute: fails runs a dead worker left behind, retries queued runs nothing picked up, and serves auto-research.
export async function researchTick(): Promise<{ processed: number; expired: number }> {
  const admin = supabaseAdmin();
  const now = Date.now();
  const { data: live } = await admin.from('ideas').select('id, run').filter('run->>state', 'in', '(queued,running)').limit(50);
  let expired = 0;
  const retry: { id: string; runId: string }[] = [];
  for (const row of live || []) {
    const run = parseRun(row.run);
    if (!run) continue;
    if (run.state === 'running' && now - Date.parse(run.started_at || '') > STALE_MS) {
      await finishRun(row.id, run, { state: 'failed', error: 'The run stopped responding and timed out.' });
      expired++;
    } else if (run.state === 'queued' && now - Date.parse(run.queued_at || '') > RETRY_QUEUED_MS && run.id) {
      retry.push({ id: row.id, runId: run.id });
    }
  }

  const { data: auto } = await admin.from('ideas_rules').select('workspace_id, rules').filter('rules->>auto_research', 'eq', 'true');
  for (const row of auto || []) {
    if (retry.length >= TICK_LIMIT) break;
    const rules = normalizeIdeasRules(row.rules);
    if (!rules.auto_research_since) continue;
    const { data: fresh } = await admin.from('ideas').select('id').eq('workspace_id', row.workspace_id).is('run', null).is('archived_at', null).eq('stage', 'inbox')
      .gte('created_at', rules.auto_research_since).order('created_at').limit(TICK_LIMIT - retry.length);
    for (const idea of fresh || []) {
      if (await refuseSpend(row.workspace_id, rules, SEARCH_USD, 0)) break;
      const run: IdeaRun = { id: randomUUID(), state: 'queued', queued_at: new Date().toISOString(), by: 'auto' };
      const { data: set } = await admin.from('ideas').update({ run }).eq('id', idea.id).is('run', null).select('id').maybeSingle();
      if (set) retry.push({ id: idea.id, runId: run.id! });
    }
  }

  const batch = retry.slice(0, TICK_LIMIT);
  await Promise.all(batch.map((r) => processIdeaResearch(r.id, r.runId)));
  return { processed: batch.length, expired };
}
