import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizeIdeasRules } from '@/lib/ideas/rules-shared';
import { refuseSpend, reserveSpend, priceOverrides, modelAllowance, modelUsageCost } from '@/lib/ai/spend';
import { getIntegration, assistantProvider } from '@/lib/integrations/secrets';
import { abortRun } from '@/lib/integrations/providers/apify';
import { workspaceModels, withFallback, providerName } from '@/lib/ai/model';
import type { Member } from '@/lib/integrations/auth';
import { LIMITS, SOURCES, defaultTopics, parseTopics, sourceById, type SourceId } from './catalog';
import { dedupe, type Finding, type IdeaDraft } from './normalize';
import { runSource, type Conns } from './sources';
import { draftIdeas, draftPrompt, DRAFT_INSTRUCTIONS, DRAFT_OUTPUT_TOKENS, type BrandBrief } from './draft';
import { coverNewIdeas } from '@/lib/ideas/cover';
import { recordUsage } from '@/lib/ai/usage';

export type SourceState = { state: 'queued' | 'running' | 'done' | 'failed' | 'skipped' | 'cancelled'; count?: number; error?: string };
export type RunInputs = { brandId: string; topics: string[]; sources: SourceId[]; count: number };
type Row = { id: string; workspace_id: string; status: string; created_by: string | null; actor_run_ids: string[] };

const msg = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 400);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// What the workspace can run right now. Keys stay on the server; only booleans leave this module.
export async function availability(ws: string) {
  const [ai, apify, browserbase, firecrawl, vidiq, virlo] = await Promise.all([
    assistantProvider(ws), getIntegration(ws, 'apify'), getIntegration(ws, 'browserbase'), getIntegration(ws, 'firecrawl'), getIntegration(ws, 'vidiq'), getIntegration(ws, 'virlo'),
  ]);
  return { ai: !!ai, conns: { apify, browserbase, firecrawl, vidiq, virlo } as Conns };
}

// Runs left as queued or running after the route's time limit died with their function. Mark them failed.
// Goes by the last update, not created_at, because a redraft runs again on an older row.
export async function expireStale(ws: string) {
  const cutoff = new Date(Date.now() - (LIMITS.runSecs + 90) * 1000).toISOString();
  await supabaseAdmin().from('research_runs')
    .update({ status: 'failed', error: 'The run stopped before it finished.', finished_at: new Date().toISOString() })
    .eq('workspace_id', ws).in('status', ['queued', 'running']).lt('updated_at', cutoff);
}

// Validates the request and creates the run row on the Super Admin's own session (RLS checks it).
export async function createRun(m: Member, body: Record<string, unknown>) {
  const ws = m.ctx.workspace_id;
  const brandId = typeof body.brandId === 'string' ? body.brandId : '';
  const { data: brand } = await m.supabase.from('brand_kits').select('id, name, tone, sections').eq('id', brandId).eq('workspace_id', ws).maybeSingle();
  if (!brand) return { error: 'Pick a brand.', status: 400 };

  const { ai, conns } = await availability(ws);
  if (!ai) return { error: 'Connect an AI model in Workspace Settings > Integrations first.', status: 400 };
  if (!conns.apify && !conns.browserbase && !conns.firecrawl && !conns.vidiq && !conns.virlo) return { error: 'Connect Apify, Browserbase, Firecrawl, vidIQ or Virlo in Workspace Settings > Integrations first.', status: 400 };

  const asked = Array.isArray(body.sources) ? body.sources.map(String).filter((s) => sourceById(s)) as SourceId[] : [];
  if (!asked.length) return { error: 'Pick at least one source.', status: 400 };
  const runnable = asked.filter((s) => conns[sourceById(s)!.via as keyof Conns]);
  if (!runnable.length) return { error: 'None of those sources are connected.', status: 400 };

  const topics = parseTopics(typeof body.topics === 'string' && body.topics.trim() ? body.topics : defaultTopics(brand));
  if (!topics.length) return { error: 'Add a niche or a few seed topics.', status: 400 };
  const count = Math.max(1, Math.min(LIMITS.maxIdeas, Math.round(Number(body.count) || LIMITS.defaultIdeas)));

  const { data: rulesRow } = await m.supabase.from('ideas_rules').select('rules').eq('workspace_id', ws).maybeSingle();
  const refused = await refuseSpend(ws, { ...normalizeIdeasRules(rulesRow?.rules), run_cost_cap_usd: Infinity }, 0, 0);
  if (refused) return { error: refused, status: 429 };

  await expireStale(ws);
  const { data: busy } = await m.supabase.from('research_runs').select('id').eq('workspace_id', ws).in('status', ['queued', 'running']).limit(1);
  if (busy && busy.length) return { error: 'A research run is already going. Wait for it or cancel it.', status: 409 };

  const sources: Record<string, SourceState> = {};
  asked.forEach((s) => { sources[s] = runnable.includes(s) ? { state: 'queued' } : { state: 'skipped', error: sourceById(s)!.viaName + ' is not connected.' }; });
  const inputs: RunInputs = { brandId, topics, sources: asked, count };
  const { data, error } = await m.supabase.from('research_runs')
    .insert({ workspace_id: ws, brand_id: brandId, created_by: m.ctx.user_id, inputs, sources, status: 'queued' })
    .select('id').single();
  if (error || !data) return { error: error ? error.message : 'Could not start the run.', status: 400 };
  return { id: data.id as string, brandName: brand.name as string };
}

// Puts a failed run back in the queue to draft from its saved findings. The sources are not called again.
export async function startRedraft(m: Member, runId: string) {
  const ws = m.ctx.workspace_id;
  const { data: run } = await m.supabase.from('research_runs').select('id, status, brand_id, saved_finding:findings->0->>id').eq('id', runId).eq('workspace_id', ws).maybeSingle();
  if (!run) return { error: 'No such run.', status: 404 };
  if (run.status !== 'failed' || !run.saved_finding) return { error: 'This run has no saved findings to draft from.', status: 409 };
  if (!run.brand_id) return { error: 'The brand for this run was deleted.', status: 400 };
  if (!(await assistantProvider(ws))) return { error: 'Connect an AI model in Workspace Settings > Integrations first.', status: 400 };

  await expireStale(ws);
  const { data: busy } = await m.supabase.from('research_runs').select('id').eq('workspace_id', ws).in('status', ['queued', 'running']).limit(1);
  if (busy && busy.length) return { error: 'A research run is already going. Wait for it or cancel it.', status: 409 };

  const { data: queued, error } = await m.supabase.from('research_runs')
    .update({ status: 'queued', error: null, note: null, finished_at: null, dismissed_at: null })
    .eq('id', runId).eq('status', 'failed').select('id');
  if (error || !queued || !queued.length) return { error: error ? error.message : 'Could not start the draft.', status: 400 };
  return { id: runId };
}

// Cancels a run: marks it cancelled and aborts any Apify actor runs it started.
export async function cancelRun(ws: string, runId: string) {
  const admin = supabaseAdmin();
  const { data: row } = await admin.from('research_runs').select('id, workspace_id, status, created_by, actor_run_ids').eq('id', runId).eq('workspace_id', ws).maybeSingle<Row>();
  if (!row) return false;
  if (row.status === 'queued' || row.status === 'running') {
    await admin.from('research_runs').update({ status: 'cancelled', error: 'Cancelled.', finished_at: new Date().toISOString() }).eq('id', runId);
    const apify = row.actor_run_ids.length ? await getIntegration(ws, 'apify') : null;
    if (apify) await Promise.all(row.actor_run_ids.map((id) => abortRun(apify.secret.apiToken, id)));
  }
  return true;
}

// The run itself, after the response has gone out. Progress goes to research_runs through the secret-key client;
// ideas are written on the Super Admin's session so the ideas RLS and activity log apply as if added by hand.
export async function executeRun(runId: string, m: Member) {
  const admin = supabaseAdmin();
  const t0 = Date.now();
  const attemptId = randomUUID();
  const gathered: Omit<Finding, 'id'>[] = [];
  const ws = m.ctx.workspace_id;
  let inputs: RunInputs = { brandId: '', topics: [], sources: [], count: 0 };
  const progress: Record<string, SourceState> = {};
  const actorRuns: string[] = [];
  let chain: Promise<unknown> = Promise.resolve();
  const save = (patch: Record<string, unknown> = {}) => {
    const snapshot = { sources: structuredClone(progress), actor_run_ids: [...actorRuns], ...patch };
    chain = chain.then(async () => {
      const result = await admin.from('research_runs').update(snapshot).eq('id', runId).eq('workspace_id', ws).eq('status', 'running').eq('attempt_id', attemptId).select('id').maybeSingle();
      if (result.error || !result.data) throw new Error('Research ownership changed or progress could not be saved.');
    });
    return chain;
  };
  let cancelSeen = false, cancelAt = 0;
  const cancelled = async () => {
    if (cancelSeen || Date.now() - cancelAt < 4000) return cancelSeen;
    cancelAt = Date.now();
    const { data } = await admin.from('research_runs').select('status,attempt_id').eq('id', runId).single();
    cancelSeen = !data || data.status !== 'running' || data.attempt_id !== attemptId;
    return cancelSeen;
  };
  const fail = async (error: string) => {
    await chain.catch(() => {});
    const result = await admin.from('research_runs').update({ status: 'failed', error, finished_at: new Date().toISOString() }).eq('id', runId).eq('workspace_id', ws).eq('status', 'running').eq('attempt_id', attemptId);
    if (result.error) console.error('Research failure could not be saved', result.error.message);
  };

  try {
    const { data: cur } = await admin.from('research_runs').update({ status: 'running', attempt_id: attemptId, started_at: new Date().toISOString() }).eq('id', runId).eq('workspace_id', ws).eq('status', 'queued').select('inputs, sources, findings, draft_payload').maybeSingle();
    if (!cur) return;
    inputs = cur.inputs as RunInputs;
    Object.assign(progress, cur.sources || {});
    // A redraft already has findings and no queued sources, so gathering below does nothing.
    const saved = Array.isArray(cur.findings) && cur.findings.length ? cur.findings as Finding[] : null;
    await save({ status: 'running', started_at: new Date().toISOString() });

    const { conns } = await availability(ws);
    const rulesRow = await admin.from('ideas_rules').select('rules').eq('workspace_id', ws).maybeSingle();
    const caps = normalizeIdeasRules(rulesRow.data?.rules);
    const prices = await priceOverrides(ws);
    const deadline = t0 + LIMITS.sourceSecs * 1000;
    if (saved) gathered.push(...saved);
    const todo = inputs.sources.filter((s) => progress[s] && progress[s].state === 'queued');
    const results = await Promise.all(todo.map(async (id) => {
      const via = SOURCES.find((s) => s.id === id)!.via as keyof Conns;
      if (!conns[via]) { progress[id] = { state: 'skipped', error: 'Not connected.' }; await save(); return [] as Omit<Finding, 'id'>[]; }
      progress[id] = { state: 'running' };
      await save();
      try {
        const configured = Number(conns[via]?.config.researchAllowanceUsd);
        const allowance = via === 'apify' ? 0.5 : via === 'firecrawl' ? inputs.topics.length * 0.01 : via === 'virlo' ? inputs.topics.length * 0.03 : configured;
        if (!Number.isFinite(allowance) || allowance <= 0) throw new Error('Set the estimated per-source research allowance in ' + via + ' integration settings first.');
        const settle = await reserveSpend(ws, runId, caps, via, id, allowance);
        let measured = 0;
        const drafts = await Promise.race([
          runSource(id, conns, {
            topics: inputs.topics, deadline, cancelled,
            onActorRun: async (rid) => { actorRuns.push(rid); await save(); },
            onSpend: (_provider, _model, usd) => { measured += usd; },
          }),
          sleep(deadline - Date.now() + 20000).then(() => { throw new Error('Took too long and was stopped.'); }),
        ]);
        const charged = via === 'apify' && measured > 0 ? measured : allowance;
        await settle(charged);
        await recordUsage({ workspaceId: ws, userId: m.ctx.user_id, feature: 'research', provider: via, model: id, costUsd: charged, runId });
        progress[id] = { state: (await cancelled()) ? 'cancelled' : 'done', count: drafts.length };
        gathered.push(...drafts);
        await save({ findings: dedupe(gathered, { max: LIMITS.maxFindings }) });
        return drafts;
      } catch (err) {
        progress[id] = { state: 'failed', error: msg(err) };
        await save();
        return [];
      }
    }));
    if (await cancelled()) return;

    const { data: brand } = await admin.from('brand_kits').select('name, voice_prompt, tone, dos, donts, sections').eq('id', inputs.brandId).single();
    const { data: prior } = await admin.from('ideas').select('title, refs').eq('brand_id', inputs.brandId).order('created_at', { ascending: false }).limit(200);
    const findings = dedupe([...(saved || []), ...results.flat()], { usedUrls: (prior || []).flatMap((i) => i.refs || []), max: LIMITS.maxFindings });
    await save({ finding_count: findings.length, findings: findings.length ? findings : null });
    if (!findings.length) {
      // Every source that ran failed: that is a failed run. Sources that ran and found nothing new is a finished run
      // with nothing to show, so it reads amber (note) rather than red (error).
      const ran = Object.values(progress).filter((v) => v.state === 'done' || v.state === 'failed');
      const failed = Object.entries(progress).filter(([, v]) => v.state === 'failed').map(([k, v]) => sourceById(k)!.label + ': ' + v.error);
      if (ran.length && failed.length === ran.length) return fail('No findings. ' + failed.join(' '));
      const note = (failed.length ? failed.join(' ') + ' The other sources returned nothing new for these topics.' : 'The sources returned nothing new for these topics.') + ' Try broader topics or another source.';
      return save({ status: 'done', note, error: null, finished_at: new Date().toISOString() });
    }

    const models = await workspaceModels(ws);
    if (!models.length) return fail('No AI model is connected.');
    const left = LIMITS.runSecs * 1000 - (Date.now() - t0) - 15000;
    const draftArgs = {
      brand: brief(brand), topics: inputs.topics, findings, count: inputs.count,
      existing: (prior || []).map((i) => i.title).slice(0, 80), timeoutMs: Math.max(30000, Math.min(left, 120000)),
    };
    const drafted = cur.draft_payload ? { result: cur.draft_payload as IdeaDraft[], used: models[0], skipped: [] } : await withFallback(models, async (wm) => {
      cancelAt = 0; if (await cancelled()) throw new Error('Research was canceled or replaced.');
      const settle = await reserveSpend(ws, runId, caps, wm.provider, wm.modelId, modelAllowance(wm.provider, wm.modelId, draftPrompt(draftArgs) + DRAFT_INSTRUCTIONS, DRAFT_OUTPUT_TOKENS, prices));
      return draftIdeas(wm.model, { ...draftArgs, onUsage: async (usage) => {
        const costUsd = modelUsageCost(wm.provider, wm.modelId, usage, prices);
        await settle(costUsd);
        await recordUsage({ workspaceId: ws, userId: m.ctx.user_id, feature: 'research', provider: wm.provider, model: wm.modelId, usage, costUsd, runId });
      } });
    });
    const ideas = drafted.result;
    const note = drafted.skipped.length
      ? 'Drafted with ' + providerName(drafted.used.provider) + ' because ' + drafted.skipped.map((x) => providerName(x.provider) + ' failed (' + x.error + ')').join(' and ') + '.'
      : null;
    if (await cancelled()) return;
    if (!ideas.length) return fail('The model did not return ideas tied to the findings. Try again or add topics.');

    await save({ draft_payload: ideas });
    cancelAt = 0; if (await cancelled()) return;
    const ids = await saveIdeas(m, runId, attemptId, inputs.brandId, ideas, note);
    // Every drafted idea gets a cover from the image model, in what is left of the run's time. The run is already
    // done above, so a slow or broke image provider never fails it.
    await coverNewIdeas(ids, ws, m, Math.max(20000, LIMITS.runSecs * 1000 - (Date.now() - t0) - 5000), runId);
  } catch (err) {
    await fail(msg(err));
  }
}

function brief(b: Record<string, unknown> | null): BrandBrief {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
  const secs = Array.isArray(b && b.sections) ? (b!.sections as unknown[]) : [];
  return {
    name: String((b && b.name) || ''), voicePrompt: String((b && b.voice_prompt) || '').trim().slice(0, 6000), tone: arr(b && b.tone), dos: arr(b && b.dos), donts: arr(b && b.donts),
    sections: secs.map((s) => (Array.isArray(s) ? String(s[0] || '') + (Array.isArray(s[1]) && s[1].length ? ': ' + s[1].join(', ') : '') : String(s || ''))).filter(Boolean).slice(0, 8),
  };
}

// Saves drafts as Research ideas in Inbox on the member's session
// (ideas_insert: author is the caller, brand visible, not an editor) and logs them like the app does. Falls back to the secret-key client if the session expired mid-run.
async function saveIdeas(m: Member, runId: string, attemptId: string, brandId: string, ideas: IdeaDraft[], note: string | null): Promise<string[]> {
  const ws = m.ctx.workspace_id, uid = m.ctx.user_id;
  const { data: rulesRow } = await m.supabase.from('ideas_rules').select('rules').eq('workspace_id', ws).maybeSingle();
  const cover = normalizeIdeasRules(rulesRow?.rules).cover;
  const rows = ideas.map((i, index) => ({
    id: stableIdeaId(runId, index),
    cover_highlight: cover.highlight, hook_position: cover.hook_position,
    workspace_id: ws, brand_id: brandId, type: 'research', stage: 'inbox', title: i.title, hook: i.hook,
    body: i.body, tags: i.tags, refs: i.refs, findings: i.findings, author_id: uid, source: 'research', research_run_id: runId,
  }));
  const result = await supabaseAdmin().rpc('commit_research_ideas', { p_run: runId, p_attempt: attemptId, p_rows: rows, p_note: note });
  if (result.error || !result.data) throw new Error('Could not save ideas: ' + (result.error?.message || 'No result.'));
  return result.data as string[];
}

function stableIdeaId(runId: string, index: number) {
  const h = createHash('sha256').update(runId + ':' + index).digest('hex');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);
}
