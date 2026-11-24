/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./planning-workflow.test.cjs');

const load = loader();
const { draftWorkflow, workflowConnections } = load('lib/workflow/authoring.js');
const { graphOf, compile, issuesOf } = load('lib/automations/graph.ts');
const workspace = { settings: { timezone: 'America/Chicago' }, statuses: [{label: 'Filming'}], integrations: [
  {provider: 'buffer', status: 'connected'}, {provider: 'slack', status: 'connected'},
], buffer: {channels: [{draft_brand_id: 'brand-id'}]}, channels: [{id: 'channel-id', name: 'Santos'}] };
const warnings = (graph, data = workspace) => issuesOf(graph, workflowConnections(data)).filter(x => x.level === 'warn');
const request = 'Create a Buffer draft when a project reaches Scheduled in Publishing';

test('Buffer instructions compile to the draft handoff and survive a stored graph round trip', () => {
  const draft = draftWorkflow(request, workspace);
  assert.equal(draft.byAgent, true);
  assert.equal(draft.lastTest, undefined);
  const restored = graphOf({flow:JSON.parse(JSON.stringify(draft))});
  assert.deepEqual(restored, draft);
  const compiled = compile(restored);
  assert.equal(compiled.trigger.key, 'publishing_scheduled');
  assert.deepEqual(compiled.actions.map(a => a.key), ['buffer_draft']);
  assert.deepEqual(warnings(restored), []);
  assert.match(warnings(restored, {...workspace,buffer:{channels:[]}})[0].body, /map a Buffer channel/i);
});

test('both schedule word orders map the digest to the shared cutoff and explicit channel', () => {
  for (const prompt of ['Every day at 9am, send a production digest to Slack channel C123',
    'Send a daily Slack production digest to channel C123 at 9 am']) {
    const draft = draftWorkflow(prompt, workspace);
    assert.equal(draft.trigger.value, 'daily@09:00');
    assert.equal(draft.trigger.tz,'America/Chicago');
    assert.equal(draft.steps[0].key, 'slack_production_digest');
    assert.equal(draft.steps[0].message, 'C123');
    assert.deepEqual(warnings(draft), []);
  }
  const draft = draftWorkflow('Send a daily Slack production digest to #editors', workspace);
  assert.equal(draft.trigger.value,'');
  assert.equal(draft.steps[0].message,'');
  assert.deepEqual(warnings(draft).map(w => w.title), ['Choose a delivery time','Choose a Slack channel']);
});

test('catalog statuses, a real workspace channel and ordered actions become editable graph nodes', () => {
  const draft = draftWorkflow('When a project reaches Filming, email the editor then wait 2 hours then email the designer only if channel is Santos.', workspace);
  assert.equal(draft.trigger.key, 'status');
  assert.equal(draft.trigger.value, 'Filming');
  assert.deepEqual(draft.trigger.filters, [{field:'channel',op:'is',value:'channel-id'}]);
  assert.deepEqual(draft.steps.map(n => n.key || n.type), ['email_editor','delay','email_designer']);
  assert.equal(draft.steps[1].amount, 2);
  assert.equal(draft.steps[1].unit, 'hours');
  assert.deepEqual(warnings(draft), []);
});

test('unknown actions, conditions, negation and unrecognized triggers remain blocked after reload', () => {
  const unknownAction = draftWorkflow('When a project reaches Filming, email the editor and buy a billboard',workspace);
  assert.match(warnings(graphOf({flow:unknownAction}))[0].body,/buy a billboard/);
  assert.ok(warnings(draftWorkflow(request + ' only if the invoice is paid',workspace)).some(w => w.id === 'trigger'));
  assert.ok(warnings(draftWorkflow('Do not ' + request,workspace)).some(w => w.title === 'Manual setup required'));
  assert.ok(warnings(draftWorkflow('Email the editor when Elon arrives',workspace)).some(w => w.body.includes('Elon arrives')));
  const webhook = draftWorkflow('When a webhook arrives, create a task for the super admin', workspace);
  assert.match(webhook.trigger.value, /^[0-9a-f]{32}$/);
});
