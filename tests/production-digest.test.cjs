/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./planning-workflow.test.cjs');

class SlackError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function fixture({ issue, connected = true } = {}) {
  const deliveries = [];
  const calls = [];
  let mode = issue;
  const db = {
    rpc: async () => ({ data: [{bucket:'in_review', title:'Cut <@U123>', job:'VID 3', editor:'R&D'}] }),
    from: () => {
      let matches = {}, patch, op;
      function execute() {
        const row = deliveries.find((r) => Object.entries(matches).every(([k,v]) => r[k] === v));
        if (op === 'update' && row) Object.assign(row, patch);
        if (op === 'delete' && row) deliveries.splice(deliveries.indexOf(row), 1);
        return { data: row || null };
      }
      const query = {
        select: () => query, match: (m) => { matches = {...matches,...m}; return query; },
        eq: (k,v) => { matches[k]=v; return query; },
        delete: () => { op='delete'; return query; }, update: (p) => { op='update'; patch=p; return query; },
        single: async () => execute(), maybeSingle: async () => execute(), then: (fn) => Promise.resolve(execute()).then(fn),
        insert: async (r) => {
          if (deliveries.some((x) => x.workspace_id===r.workspace_id && x.channel===r.channel && x.reporting_date===r.reporting_date)) return { error:{code:'23505'} };
          deliveries.push({...r}); return {};
        },
      };
      return query;
    },
  };
  const load = loader({
    '@/lib/supabase/admin': { supabaseAdmin: () => db },
    '@/lib/integrations/secrets': { getIntegration: async () => connected ? {secret:{botToken:'mock'}} : null },
    '@/lib/integrations/providers/slack': { SlackError, postSlackDigest: async (...args) => {
      calls.push(args);
      if (mode instanceof Error) throw mode;
      return '123.456';
    } },
  });
  const {deliverProductionDigest} = load('lib/automations/production-digest.ts');
  const send = (overrides) => deliverProductionDigest({
    workspaceId:'ws', runId:'a', channel:'C1234', rule:'daily@09:00', timezone:'America/Chicago',
    slot:'2026-11-23T15:00:00Z', baseUrl:'https://example.test', preview:false, ...overrides,
  });
  return { send, calls, deliveries, clearIssue: () => { mode = null; } };
}
test('a successful digest is sent once per workspace, channel and reporting date across overlapping runs', async () => {
  const f = fixture();
  await Promise.allSettled([f.send(),f.send({runId:'b'})]);
  assert.match(await f.send({runId:'b'}),/Already sent/);
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0][1],'C1234');
  assert.match(JSON.stringify(f.calls[0][3]),/VID%203\|Open> Cut &lt;@U123&gt; — R&amp;D/);
  assert.equal(f.deliveries[0].reporting_date,'2026-11-23');
});
test('preview and disconnected integration make no provider writes', async () => {
  const f = fixture({connected:false});
  assert.match(await f.send({preview:true}),/Connect Slack/);
  await assert.rejects(f.send(),/Reconnect Slack/);
  assert.equal(f.deliveries.length,0);
  assert.equal(f.calls.length,0);
});
test('explicit channel rejection releases the date, an ambiguous send holds it', async () => {
  const refused = fixture({issue:new SlackError('not_in_channel')});
  await assert.rejects(refused.send(),/not_in_channel/);
  refused.clearIssue();
  await refused.send();
  assert.equal(refused.deliveries[0].status,'sent');
  const lost = fixture({issue:new Error('timeout')});
  await assert.rejects(lost.send(),/timeout/);
  await assert.rejects(lost.send({runId:'b'}),/unconfirmed/);
  assert.equal(lost.calls.length,1);
});
test('daily local morning cutoff stays at 09:00 across both DST changes', () => {
  const {lastSlot} = loader()('lib/automations/schedule.ts');
  for (const iso of ['2026-03-08T14:00:00Z','2026-11-01T15:00:00Z']) {
    const cut = Date.parse(iso);
    assert.equal(lastSlot('daily@09:00','America/Chicago',cut), cut);
    const start = lastSlot('daily@09:00','America/Chicago',cut-1);
    assert.equal((cut-start)/3600000, iso.includes('03-08') ? 23 : 25);
  }
});
