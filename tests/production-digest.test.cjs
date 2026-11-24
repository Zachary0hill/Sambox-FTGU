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
    rpc: async () => ({ data: { rows: [{bucket:'in_review', title:'Cut <@U123>', job:'VID 3', editor:'R&D'}], history_start:null } }),
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
  const {deliverProductionDigest,previewDigest} = load('lib/automations/production-digest.ts');
  const send = (overrides) => deliverProductionDigest({
    workspaceId:'ws', runId:'a', channel:'C1234', rule:'daily@09:00', timezone:'America/Chicago',
    slot:'2026-11-23T15:00:00Z', baseUrl:'https://example.test', preview:false, ...overrides,
  });
  const preview = (date, rule='daily@09:00') => previewDigest('ws','https://example.test',rule,'America/Chicago',date,'C1234');
  return { send, calls, deliveries, preview, clearIssue: () => { mode = null; } };
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

test('workday preview uses the worker message and receipt and cannot reserve or send', async () => {
  const f=fixture();
  const before=await f.preview('2026-11-23');
  assert.equal(f.calls.length,0);
  assert.equal(f.deliveries.length,0);
  await f.send();
  const after=await f.preview('2026-11-23');
  assert.deepEqual(before.message, after.message);
  assert.deepEqual(after.message.blocks, f.calls[0][3]);
  assert.equal(after.delivery,'Confirmed Slack message');
  assert.equal(f.calls.length,1);
  assert.equal(f.deliveries.length,1);
  await assert.rejects(f.preview('2026-11-22','weekdays@09:00'),/on the configured schedule/);
  await assert.rejects(f.preview('9999-01-01'),/already passed/);
});
test('digest preview and joined-channel reads require a Super Admin and obtain workspace from the session', async () => {
  const logs = [];
  let member = null;
  const route = loader({
    '@/lib/integrations/auth': { getMember: async () => member, isSuperAdmin: m=>m?.ctx.role==='super_admin', deny: (error,status=403)=>Response.json({error},{status}) },
    '@/lib/email/invite': {baseUrlFor: ()=>'https://example.test'},
    '@/lib/automations/production-digest': { previewDigest: async ws=>{logs.push(ws);return {};} },
    '@/lib/integrations/providers/slack': { digestChannels: async ws=>{logs.push(ws);return {};} },
  })('app/api/automations/production-digest/route.ts');
  for (const view of ['channels','preview']) {
    const request=new Request('https://example.test/api/automations/production-digest?workspace_id=other&view='+view);
    for (const role of [null,'editor','manager','client']) {
      member = role && {ctx:{role,workspace_id:'mine'}};
      assert.equal((await route.GET(request)).status,403);
    }
    member={ctx:{role:'super_admin',workspace_id:'mine'}};
    assert.equal((await route.GET(request)).status,200);
  }
  assert.deepEqual(logs,['mine','mine']);
});
test('opening a pre-builder schedule retains its saved timezone for the reader and next delivery',()=>{
  const {graphOf}=loader()('lib/automations/graph.ts');
  const {slotOnDate} = loader()('lib/automations/schedule.ts');
  const t=graphOf({trigger:{key:'schedule',value:'weekdays@09:00',tz:'Pacific/Auckland'}}).trigger;
  assert.equal(t.tz,'Pacific/Auckland');
  assert.equal(new Date(slotOnDate(t.value,t.tz,'2026-11-23')).toISOString(),'2026-11-22T20:00:00.000Z');
  assert.equal(slotOnDate(t.value,t.tz,'2026-11-22'),null);
});
