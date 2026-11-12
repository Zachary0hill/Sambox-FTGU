/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
// Idea automations: the catalog keeps idea and project actions apart, and the runner performs idea actions on the
// run's idea (lib/automations/run.ts performIdea). Database triggers are covered by tests/idea-automations-db.sql.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./planning-workflow.test.cjs');

test('actions fit their trigger: idea triggers get idea actions, project triggers never do', () => {
  const { actionsFor, scopeOf, projectTriggers, ideaTriggers } = loader()('lib/automations/catalog.ts');
  const idea = actionsFor('idea_stage').map((a) => a.key);
  const project = actionsFor('status').map((a) => a.key);
  assert.equal(scopeOf('idea_scored'), 'idea');
  assert.equal(scopeOf('status'), 'project');
  for (const k of ['idea_research', 'idea_stage_next', 'idea_email_owner', 'idea_todo_owner', 'slack_admin', 'todo_admin', 'webhook_n8n']) assert.ok(idea.includes(k), k);
  for (const k of ['email_editor', 'status_next', 'buffer_publish']) assert.ok(!idea.includes(k), k);
  assert.ok(project.every((k) => !k.startsWith('idea_')));
  assert.ok(projectTriggers().every((t) => t.scope !== 'idea'));
  assert.deepEqual(ideaTriggers().map((t) => t.key), ['idea_created', 'idea_stage', 'idea_scored', 'idea_stale']);
});

function ideaFixture({ action, stage = 'inbox', owner = 'owner', gateError = null }) {
  const run = { id: 'run', automation_id: 'auto', workspace_id: 'ws', project_id: null, idea_id: 'idea', trigger_key: 'idea_stage', status: 'running', attempts: 1, is_test: false, output: {}, payload: { value: stage } };
  const tables = {
    automations: [{ id: 'auto', workspace_id: 'ws', name: 'Idea flow', enabled: true, is_draft: false, trigger: { key: 'idea_stage', value: stage }, actions: [{ key: action, message: 'Look at this' }], run_count: 0 }],
    workspace_settings: [{ workspace_id: 'ws', automation: { failAlert: false, retry: true } }], workspaces: [{ id: 'ws', name: 'Test' }],
    automation_runs: [run], automation_effects: [], project_statuses: [], tasks: [], activity_log: [],
    ideas: [{ id: 'idea', workspace_id: 'ws', title: 'Big idea', stage, owner_id: owner, author_id: 'author', archived_at: null, research: { score: { total: 82 } } }],
    workspace_members: [{ workspace_id: 'ws', user_id: 'owner', role: 'designer', status: 'active' }],
    profiles: [{ id: 'owner', full_name: 'Olive Owner', email: 'owner@example.test' }],
  };
  function from(t) {
    const filters = []; let op = 'read', payload;
    const q = {
      select: () => q, eq: (k, v) => { filters.push([k, v]); return q; }, in: (k, v) => { filters.push([k, v]); return q; }, order: () => q, limit: () => q,
      insert: (p) => { op = 'insert'; payload = p; return q; }, update: (p) => { op = 'update'; payload = p; return q; }, delete: () => { op = 'delete'; return q; },
      single: () => Promise.resolve(exec(true)), maybeSingle: () => Promise.resolve(exec(true)), then: (f) => Promise.resolve(exec()).then(f),
    };
    function exec(single = false) {
      const all = tables[t] || [];
      const matching = all.filter((x) => filters.every(([k, v]) => (Array.isArray(v) ? v.includes(x[k]) : x[k] === v)));
      if (op === 'update' && t === 'ideas' && gateError) return { data: null, error: gateError };
      if (op === 'insert') all.push(...(Array.isArray(payload) ? payload : [payload]));
      if (op === 'update') matching.forEach((x) => Object.assign(x, payload));
      if (op === 'delete') matching.forEach((x) => all.splice(all.indexOf(x), 1));
      return { data: single ? matching[0] || null : matching, error: null };
    }
    return q;
  }
  const admin = { from, rpc: async (name) => ({ data: name === 'claim_automation_runs' ? [run] : 0, error: null }) };
  const emails = [];
  const { runAutomations } = loader({
    '@/lib/supabase/admin': { supabaseAdmin: () => admin }, '@/lib/integrations/secrets': { getIntegration: async () => null },
    '@/lib/integrations/providers/slack': {}, '@/lib/integrations/providers/n8n': {}, '@/lib/integrations/buffer-publish': {},
    '@/lib/email/send': { sendEmail: async (m) => { emails.push(m); return { sent: true, id: 'mail-1' }; } },
  })('lib/automations/run.ts');
  return { run, tables, emails, execute: () => runAutomations({ workspaceId: 'ws', baseUrl: 'https://example.test/' }) };
}

test('To-Do for the idea owner lands on the owner and the run records the idea', async () => {
  const f = ideaFixture({ action: 'idea_todo_owner' });
  await f.execute();
  assert.equal(f.run.status, 'done');
  assert.equal(f.tables.tasks.length, 1);
  assert.equal(f.tables.tasks[0].owner_id, 'owner');
  assert.equal(f.tables.tasks[0].text, 'Look at this: Big idea');
  assert.deepEqual(f.run.output.idea, { id: 'idea', title: 'Big idea' });
});

test('email to the idea owner links to the idea and shows its score', async () => {
  const f = ideaFixture({ action: 'idea_email_owner' });
  await f.execute();
  assert.equal(f.run.status, 'done');
  assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].to, 'owner@example.test');
  assert.match(f.emails[0].html, /ideas\?idea=idea/);
  assert.match(f.emails[0].text, /82 of 100/);
});

test('next stage moves Inbox to Research and logs it on the idea', async () => {
  const f = ideaFixture({ action: 'idea_stage_next' });
  await f.execute();
  assert.equal(f.run.status, 'done');
  assert.equal(f.tables.ideas[0].stage, 'research');
  assert.equal(f.tables.activity_log[0].idea_id, 'idea');
  assert.equal(f.tables.activity_log[0].action, 'moved Stage to Research on');
});

test('next stage stops at Ready, because approval needs a person', async () => {
  const f = ideaFixture({ action: 'idea_stage_next', stage: 'ready' });
  await f.execute();
  assert.equal(f.run.status, 'failed');
  assert.match(f.run.error, /needs a person/);
  assert.equal(f.tables.ideas[0].stage, 'ready');
});

test('a stage gate refusal fails the run with the gate message instead of retrying', async () => {
  const f = ideaFixture({ action: 'idea_stage_next', gateError: { code: '23514', message: "Can't move to Research yet. Still needed: Notes written." } });
  await f.execute();
  assert.equal(f.run.status, 'failed');
  assert.match(f.run.error, /Still needed: Notes written/);
});

test('an owner who left the workspace fails the run with a named reason', async () => {
  const f = ideaFixture({ action: 'idea_todo_owner', owner: 'gone' });
  f.tables.ideas[0].author_id = null;
  await f.execute();
  assert.equal(f.run.status, 'failed');
  assert.match(f.run.error, /no longer an active member/);
  assert.equal(f.tables.tasks.length, 0);
});
