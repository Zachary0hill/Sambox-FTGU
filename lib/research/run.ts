import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getIntegration, assistantProvider } from '@/lib/integrations/secrets';
import { abortRun } from '@/lib/integrations/providers/apify';
import { workspaceModel } from '@/lib/ai/model';
import type { Member } from '@/lib/integrations/auth';
import { LIMITS, SOURCES, defaultTopics, parseTopics, sourceById, type SourceId } from './catalog';
import { dedupe, type Finding, type IdeaDraft } from './normalize';
import { runSource, type Conns } from './sources';
import { draftIdeas, type BrandBrief } from './draft';

export type SourceState = { state: 'queued' | 'running' | 'done' | 'failed' | 'skipped' | 'cancelled'; count?: number; error?: string };
export type RunInputs = { brandId: string; topics: string[]; sources: SourceId[]; count: number };
type Row = { id: string; workspace_id: string; status: string; created_by: string | null; actor_run_ids: string[] };

const msg = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 400);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// What the workspace can run right now. Keys stay on the server; only booleans leave this module.
export async function availability(ws: string) {
  const [ai, apify, browserbase, firecrawl] = await Promise.all([
    assistantProvider(ws), getIntegration(ws, 'apify'), getIntegration(ws, 'browserbase'), getIntegration(ws, 'firecrawl'),
  ]);
  return { ai: !!ai, conns: { apify, browserbase, firecrawl } as Conns };
}

// Runs left as queued or running after the route's time limit died with their function. Mark them failed.
export async function expireStale(ws: string) {
  const cutoff = new Date(Date.now() - (LIMITS.runSecs + 90) * 1000).toISOString();
  await supabaseAdmin().from('research_runs')
    .update({ status: 'failed', error: 'The run stopped before it finished.', finished_at: new Date().toISOString() })
    .eq('workspace_id', ws).in('status', ['queued', 'running']).lt('created_at', cutoff);
}

// Validates the request and creates the run row on the Super Admin's own session (RLS checks it).
export async function createRun(m: Member, body: Record<string, unknown>) {
  const ws = m.ctx.workspace_id;
  const brandId = typeof body.brandId === 'string' ? body.brandId : '';
  const { data: brand } = await m.supabase.from('brand_kits').select('id, name, tone, sections').eq('id', brandId).eq('workspace_id', ws).maybeSingle();
  if (!brand) return { error: 'Pick a brand.', status: 400 };

  const { ai, conns } = await availability(ws);
  if (!ai) return { error: 'Connect an AI model in Workspace Settings > Integrations first.', status: 400 };
  if (!conns.apify && !conns.browserbase && !conns.firecrawl) return { error: 'Connect Apify, Browserbase or Firecrawl in Workspace Settings > Integrations first.', status: 400 };

  const asked = Array.isArray(body.sources) ? body.sources.map(String).filter((s) => sourceById(s)) as SourceId[] : [];
  if (!asked.length) return { error: 'Pick at least one source.', status: 400 };
  const runnable = asked.filter((s) => conns[sourceById(s)!.via as keyof Conns]);
  if (!runnable.length) return { error: 'None of those sources are connected.', status: 400 };

  const topics = parseTopics(typeof body.topics === 'string' && body.topics.trim() ? body.topics : defaultTopics(brand));
  if (!topics.length) return { error: 'Add a niche or a few seed topics.', status: 400 };
  const count = Math.max(1, Math.min(LIMITS.maxIdeas, Math.round(Number(body.count) || LIMITS.defaultIdeas)));

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
  const ws = m.ctx.workspace_id;
  let inputs: RunInputs = { brandId: '', topics: [], sources: [], count: 0 };
  const progress: Record<string, SourceState> = {};
  const actorRuns: string[] = [];
  let chain: Promise<unknown> = Promise.resolve();
  const save = (patch: Record<string, unknown> = {}) => {
    chain = chain.then(() => admin.from('research_runs').update({ sources: progress, actor_run_ids: actorRuns, ...patch }).eq('id', runId)).catch(() => null);
    return chain;
  };
  let cancelSeen = false, cancelAt = 0;
  const cancelled = async () => {
    if (cancelSeen || Date.now() - cancelAt < 4000) return cancelSeen;
    cancelAt = Date.now();
    const { data } = await admin.from('research_runs').select('status').eq('id', runId).single();
    cancelSeen = !!data && data.status === 'cancelled';
    return cancelSeen;
  };
  const fail = async (error: string) => {
    await save();
    if (!(await cancelled())) await admin.from('research_runs').update({ status: 'failed', error, finished_at: new Date().toISOString() }).eq('id', runId);
  };

  try {
    const { data: cur } = await admin.from('research_runs').select('inputs, sources').eq('id', runId).single();
    if (!cur) return;
    inputs = cur.inputs as RunInputs;
    Object.assign(progress, cur.sources || {});
    await save({ status: 'running', started_at: new Date().toISOString() });

    const { conns } = await availability(ws);
    const deadline = t0 + LIMITS.sourceSecs * 1000;
    const todo = inputs.sources.filter((s) => progress[s] && progress[s].state === 'queued');
    const results = await Promise.all(todo.map(async (id) => {
      const via = SOURCES.find((s) => s.id === id)!.via as keyof Conns;
      if (!conns[via]) { progress[id] = { state: 'skipped', error: 'Not connected.' }; await save(); return [] as Omit<Finding, 'id'>[]; }
      progress[id] = { state: 'running' };
      await save();
      try {
        const drafts = await Promise.race([
          runSource(id, conns, {
            topics: inputs.topics, deadline, cancelled,
            onActorRun: async (rid) => { actorRuns.push(rid); await save(); },
          }),
          sleep(deadline - Date.now() + 20000).then(() => { throw new Error('Took too long and was stopped.'); }),
        ]);
        progress[id] = { state: (await cancelled()) ? 'cancelled' : 'done', count: drafts.length };
        await save();
        return drafts;
      } catch (err) {
        progress[id] = { state: 'failed', error: msg(err) };
        await save();
        return [];
      }
    }));
    if (await cancelled()) return;

    const { data: brand } = await admin.from('brand_kits').select('name, tone, dos, donts, sections').eq('id', inputs.brandId).single();
    const { data: prior } = await admin.from('ideas').select('title, refs').eq('brand_id', inputs.brandId).order('created_at', { ascending: false }).limit(200);
    const findings = dedupe(results.flat(), { usedUrls: (prior || []).flatMap((i) => i.refs || []), max: LIMITS.maxFindings });
    await save({ finding_count: findings.length });
    if (!findings.length) {
      const failed = Object.entries(progress).filter(([, v]) => v.state === 'failed').map(([k, v]) => sourceById(k)!.label + ': ' + v.error);
      return fail(failed.length ? 'No findings. ' + failed.join(' ') : 'The sources returned nothing new for these topics.');
    }

    const wm = await workspaceModel(ws);
    if (!wm) return fail('No AI model is connected.');
    const left = LIMITS.runSecs * 1000 - (Date.now() - t0) - 15000;
    const ideas = await draftIdeas(wm.model, {
      brand: brief(brand), topics: inputs.topics, findings, count: inputs.count,
      existing: (prior || []).map((i) => i.title).slice(0, 80), timeoutMs: Math.max(30000, left),
    });
    if (await cancelled()) return;
    if (!ideas.length) return fail('The model did not return ideas tied to the findings. Try again or add topics.');

    const ids = await saveIdeas(m, runId, inputs.brandId, ideas, (brand && brand.name) || '');
    await save({ status: 'done', idea_ids: ids, finished_at: new Date().toISOString(), error: null });
  } catch (err) {
    await fail(msg(err));
  }
}

function brief(b: Record<string, unknown> | null): BrandBrief {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
  const secs = Array.isArray(b && b.sections) ? (b!.sections as unknown[]) : [];
  return {
    name: String((b && b.name) || ''), tone: arr(b && b.tone), dos: arr(b && b.dos), donts: arr(b && b.donts),
    sections: secs.map((s) => (Array.isArray(s) ? String(s[0] || '') + (Array.isArray(s[1]) && s[1].length ? ': ' + s[1].join(', ') : '') : String(s || ''))).filter(Boolean).slice(0, 8),
  };
}

// Saves drafts as Research ideas on the member's session (ideas_insert: author is the caller, brand visible, not an
// editor) and logs them like the app does. Falls back to the secret-key client if the session expired mid-run.
async function saveIdeas(m: Member, runId: string, brandId: string, ideas: IdeaDraft[], brandName: string): Promise<string[]> {
  const ws = m.ctx.workspace_id, uid = m.ctx.user_id;
  const rows = ideas.map((i) => ({
    workspace_id: ws, brand_id: brandId, type: 'research', status: 'draft', title: i.title, hook: i.hook,
    body: i.body, tags: i.tags, refs: i.refs, author_id: uid, source: 'research', research_run_id: runId,
  }));
  const mine = await m.supabase.from('ideas').insert(rows).select('id, title');
  if (!mine.error && mine.data) {
    for (const r of mine.data) {
      await m.supabase.rpc('log_activity', {
        p_category: 'idea', p_action: 'added the idea from research', p_target_label: r.title,
        p_project: null, p_idea: r.id, p_event: null, p_quote: null, p_external: false,
      });
    }
    await m.supabase.rpc('log_activity', {
      p_category: 'idea', p_action: 'ran research and added ' + mine.data.length + (mine.data.length === 1 ? ' idea for' : ' ideas for'),
      p_target_label: brandName, p_project: null, p_idea: mine.data[0].id, p_event: 'idea', p_quote: null, p_external: false,
    });
    return mine.data.map((r) => r.id as string);
  }
  const admin = supabaseAdmin();
  const res = await admin.from('ideas').insert(rows).select('id, title');
  if (res.error || !res.data) throw new Error('Could not save ideas: ' + (res.error || mine.error)!.message);
  const label = (m.ctx.profile && (String(m.ctx.profile.full_name || '').split(' ')[0] || m.ctx.profile.email)) || '';
  await admin.from('activity_log').insert(res.data.map((r) => ({
    workspace_id: ws, actor_id: uid, actor_label: label, category: 'idea', action: 'added the idea from research',
    target_type: 'idea', target_id: r.id, target_label: r.title, idea_id: r.id, source: 'api',
  })));
  return res.data.map((r) => r.id as string);
}
