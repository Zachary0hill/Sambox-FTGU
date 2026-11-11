/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./planning-workflow.test.cjs');

const shared = () => loader()('lib/ideas/research-shared.ts');
const criteria = [{ key: 'demand', label: 'Demand', weight: 5 }, { key: 'ease', label: 'Ease', weight: 0 }];

test('the total is the weighted average, and weight 0 leaves a criterion out', () => {
  const { weightedTotal } = shared();
  assert.equal(weightedTotal([{ score: 8, weight: 5 }, { score: 2, weight: 0 }]), 80);
  assert.equal(weightedTotal([{ score: 10, weight: 4 }, { score: 5, weight: 1 }]), 90);
  assert.equal(weightedTotal([{ score: 6, weight: 0 }, { score: 8, weight: 0 }]), 70);
});

test('the recommendation comes from the total and Rules', () => {
  const { recommendationFor } = shared();
  const t = { pursue: 70, park: 45 };
  assert.deepEqual([recommendationFor(70, t), recommendationFor(45, t), recommendationFor(44, t)], ['pursue', 'park', 'drop']);
});

test('parsing clamps scores, fills gaps and keeps only fetched sources', () => {
  const { parseResearchOutput, pickSources } = shared();
  const sources = pickSources([], [{ url: 'https://a.com/x', title: 'A' }, { url: 'https://b.com', title: 'B' }], 6);
  const out = parseResearchOutput({ summary: 'Sum', findings: ['F [S1]'], scores: [{ key: 'demand', score: 14, reason: 'High' }], next_steps: ['Do'], sources_used: ['S2', 'https://evil.example'] }, { sources, criteria, now: 'then' });
  assert.equal(out.score.by.demand.score, 10);
  assert.equal(out.score.by.ease.score, 5);
  assert.match(out.score.by.ease.reason, /No evidence/);
  assert.equal(out.score.total, 100);
  assert.deepEqual(out.sources.map((s) => s.url), ['https://b.com']);
});

test('an answer with no summary fails the run instead of saving blanks', () => {
  assert.throws(() => shared().parseResearchOutput({ findings: [] }, { sources: [], criteria }), /no summary/);
});

test('the idea\'s own links come first and repeats are dropped', () => {
  const list = shared().pickSources(['https://mine.com/a/'], [{ url: 'https://mine.com/a?x=1' }, { url: 'https://other.com' }, { url: 'ftp://no' }], 6);
  assert.deepEqual(list.map((s) => [s.ref, s.url]), [['S1', 'https://mine.com/a/'], ['S2', 'https://other.com']]);
});

test('a slider change recalculates the total and marks it', () => {
  const { overrideScore } = shared();
  const research = { summary: 's', findings: [], sources: [], next_steps: [], generated_at: '', score: { total: 50, ai_total: 50, overridden: false, by: { a: { label: 'A', score: 5, weight: 1, reason: '' }, b: { label: 'B', score: 5, weight: 1, reason: '' } } } };
  const out = overrideScore(research, 'a', 9);
  assert.equal(out.score.total, 70);
  assert.equal(out.score.ai_total, 50);
  assert.equal(out.score.overridden, true);
  assert.equal(research.score.overridden, false);
});

test('the brief fills placeholders and its first line is the search', () => {
  const { fillBrief, searchQueryFromBrief } = shared();
  const brief = fillBrief('{title} {type}\nFor {brand}: {notes}', { title: 'Gym merch', type: 'Script', notes: '', brand: 'ZZ' });
  assert.equal(brief, 'Gym merch script\nFor ZZ: none');
  assert.equal(searchQueryFromBrief(brief), 'Gym merch script');
});

// ---------- The worker, against an in-memory idea ----------
function harness(over = {}) {
  const idea = { id: 'i', workspace_id: 'w', brand_id: 'b', title: 'T', idea_type: 'Idea', body: ['n'], refs: [], stage: 'inbox', research: null,
    run: { id: 'r1', state: 'queued', queued_at: new Date().toISOString(), by: 'u' }, ...over.idea };
  const calls = { search: 0, model: 0, usage: [], reservations: [], options: [] };
  const matches = (f) => f.every(([col, op, val]) => {
    const got = col === 'run->>id' ? idea.run && idea.run.id : col === 'run->>state' ? idea.run && idea.run.state : idea[col];
    return op === 'in' ? val.replace(/[()]/g, '').split(',').includes(got) : got === val;
  });
  const builder = (table) => {
    let patch = null;
    const f = [];
    const finish = () => {
      if (table !== 'ideas') return { data: null, error: null };
      if (!matches(f)) return { data: null, error: null };
      if (patch) Object.assign(idea, patch);
      return { data: { ...idea }, error: null };
    };
    const b = {
      select: () => b, update: (p) => { patch = p; return b; }, insert: async () => ({ error: null }),
      eq: (c, v) => { f.push([c, 'eq', v]); return b; }, filter: (c, op, v) => { f.push([c, op, v]); return b; },
      maybeSingle: async () => finish(), then: (ok) => ok(finish()),
    };
    return b;
  };
  const generate = over.generate || (async () => ({ output: { summary: 'S', findings: [], scores: [], next_steps: [], sources_used: [] }, totalUsage: { inputTokens: 10, outputTokens: 10 } }));
  const mod = loader({
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ from: builder }) },
    '@/lib/integrations/secrets': { getIntegration: async () => ({ secret: { apiKey: 'k' } }) },
    '@/lib/integrations/providers/firecrawl': { firecrawlSearch: async () => { calls.search++; if(over.cancelSearch)idea.run.state='canceled'; return [{ url: 'https://x.com', title: 'X' }]; } },
    '@/lib/ai/model': { workspaceModels: async () => [{ provider: 'anthropic', modelId: 'm', model: {} }], withFallback: async (models, fn) => ({ result: await fn(models[0]), used: models[0], skipped: [] }) },
    '@/lib/ai/usage': { recordUsage: async (e) => { calls.usage.push(e); } },
    '@/lib/ai/spend': { priceOverrides: async () => ({}), modelUsageCost: () => 0.02, modelAllowance: () => 0.03, reserveSpend: async (...args) => { calls.reservations.push(args); if(over.reserveError)throw new Error(over.reserveError); return async () => {}; }, refuseSpend: over.refuse || (async () => null) },
    ai: { generateText: async (a) => { calls.model++; calls.options.push(a); return generate(a, idea); }, Output: { object: (x) => x } },
  })('lib/ideas/research.ts');
  return { idea, calls, mod };
}

test('a claimed run saves research, cost and moves the idea out of Inbox', async () => {
  const { idea, calls, mod } = harness();
  await mod.processIdeaResearch('i', 'r1');
  assert.equal(idea.run.state, 'done');
  assert.equal(idea.research.summary, 'S');
  assert.equal(idea.run.cost_usd, 0.03);
  assert.equal(idea.stage, 'research');
  assert.deepEqual(calls.usage.map((u) => u.provider), ['firecrawl', 'anthropic']);
});

test('a research run does not move an idea past Research', async () => {
  const { idea, mod } = harness({ idea: { stage: 'ready' } });
  await mod.processIdeaResearch('i', 'r1');
  assert.equal(idea.stage, 'ready');
});

test('a run that is not the one queued does nothing', async () => {
  const { idea, calls, mod } = harness();
  await mod.processIdeaResearch('i', 'old-run');
  assert.equal(calls.search + calls.model, 0);
  assert.equal(idea.run.state, 'queued');
});

test('calling the worker twice does the work once', async () => {
  const { calls, mod } = harness();
  await Promise.all([mod.processIdeaResearch('i', 'r1'), mod.processIdeaResearch('i', 'r1')]);
  assert.equal(calls.model, 1);
});

test('a stale worker cannot overwrite a newer run', async () => {
  const { idea, mod } = harness({ generate: async (a, row) => { row.run = { id: 'r2', state: 'running' }; return { output: { summary: 'Old', scores: [] }, totalUsage: {} }; } });
  await mod.processIdeaResearch('i', 'r1');
  assert.equal(idea.run.id, 'r2');
  assert.equal(idea.run.state, 'running');
  assert.equal(idea.research, null);
});

test('hitting a cap fails the run with the reason and calls no model', async () => {
  const { idea, calls, mod } = harness({ refuse: async () => 'Today\'s research spend has reached the limit.' });
  await mod.processIdeaResearch('i', 'r1');
  assert.equal(idea.run.state, 'failed');
  assert.match(idea.run.error, /reached the limit/);
  assert.equal(calls.model, 0);
});

test('a model failure is written to the run', async () => {
  const { idea, mod } = harness({ generate: async () => { throw new Error('Provider down'); } });
  await mod.processIdeaResearch('i', 'r1');
  assert.equal(idea.run.state, 'failed');
  assert.equal(idea.run.error, 'Provider down');
});

test('a reservation failure starts no paid search', async()=>{
 const {idea,calls,mod}=harness({reserveError:'Budget already reserved'});
 await mod.processIdeaResearch('i','r1');
 assert.equal(calls.search,0);assert.equal(calls.model,0);assert.match(idea.run.error,/Budget/);
});
test('cancellation during search prevents the next model call',async()=>{
 const {idea,calls,mod}=harness({cancelSearch:true});await mod.processIdeaResearch('i','r1');
 assert.equal(calls.search,1);assert.equal(calls.model,0);assert.equal(idea.run.state,'canceled');
});
test('paid model attempts reserve first and have bounded output without SDK retries',async()=>{
 const {calls,mod}=harness();await mod.processIdeaResearch('i','r1');
 assert.equal(calls.reservations.length,2);assert.equal(calls.options[0].maxRetries,0);assert.equal(calls.options[0].maxOutputTokens,1500);
});
