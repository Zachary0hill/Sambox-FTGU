/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./planning-workflow.test.cjs');

function fixture({ failedTable, concurrentStatus = false } = {}) {
  const run = { id: 'run', automation_id: 'auto', workspace_id: 'ws', project_id: 'project', status: 'running', attempts: 1, is_test: false, output: {} };
  const project = { id: 'project', workspace_id: 'ws', title: 'Video', job_code: 'V1', status_id: 'ready' };
  const tables = {
    automations: [{ id: 'auto', workspace_id: 'ws', name: 'Move ready', enabled: true, is_draft: false, trigger: { key: 'status' }, actions: [{ key: 'status_next' }] }],
    workspace_settings: [{ workspace_id: 'ws', automation: { failAlert: false }, require_sponsor_approval: true, lock_after_live: true }],
    workspaces: [{ id: 'ws', name: 'Test' }], projects: [project], automation_runs: [run],
    project_statuses: [{ id: 'ready', workspace_id: 'ws', label: 'Ready' }, { id: 'scheduled', workspace_id: 'ws', label: 'Scheduled' }],
    sponsorships: [], automation_effects: [], activity_log: [],
  };
  function from(table) {
    let patch, operation = 'read'; const filters = [];
    const q = {
      select: () => q, eq: (k, v) => { filters.push(x => x[k] === v); return q; },
      neq: (k, v) => { filters.push(x => x[k] !== v); return q; },
      order: () => q, limit: () => q,
      update: p => { operation = 'update'; patch = p; if (table === 'projects' && concurrentStatus) project.status_id = 'manual'; return q; },
      insert: p => { operation = 'insert'; patch = p; return q; }, delete: () => { operation = 'delete'; return q; },
      single: async () => execute(true), maybeSingle: async () => execute(true), then: fn => Promise.resolve(execute()).then(fn),
    };
    function execute(single = false) {
      if (table === failedTable) return { data: null, error: { message: 'Database unavailable' } };
      const rows = tables[table] || [];
      const found = rows.filter(r => filters.every(f => f(r)));
      if (operation === 'update') found.forEach(r => Object.assign(r, patch));
      if (operation === 'insert') rows.push(patch);
      if (operation === 'delete') found.forEach(r => rows.splice(rows.indexOf(r), 1));
      return { data: single ? found[0] ? { ...found[0] } : null : found.map(r => ({ ...r })), error: null };
    }
    return q;
  }
  const { runAutomations } = loader({
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ from, rpc: async name => ({ data: name === 'claim_automation_runs' ? [run] : 0 }) }) },
    '@/lib/integrations/secrets': {}, '@/lib/integrations/providers/slack': {}, '@/lib/integrations/providers/n8n': {},
    '@/lib/integrations/buffer-publish': {}, '@/lib/email/send': {},
  })('lib/automations/run.ts');
  return { run, project, tables, execute: () => runAutomations({ workspaceId: 'ws', baseUrl: 'https://example.test' }) };
}

test('automation settings failures leave claimed work recoverable without running actions', async () => {
  const f = fixture({ failedTable: 'workspace_settings' });
  await assert.rejects(f.execute(), /settings could not be loaded/);
  assert.equal(f.project.status_id, 'ready');
  assert.equal(f.run.status, 'running');
  assert.equal(f.tables.automation_effects.length, 0);
});

test('status automation fails closed when sponsor approval cannot be checked', async () => {
  const f = fixture({ failedTable: 'sponsorships' });
  await f.execute();
  assert.equal(f.project.status_id, 'ready');
  assert.equal(f.run.status, 'retry');
  assert.match(f.run.error, /approval could not be checked/);
  assert.equal(f.tables.activity_log.length, 0);
});

test('status automation does not claim a successful move after a concurrent manual change', async () => {
  const f = fixture({ concurrentStatus: true });
  await f.execute();
  assert.equal(f.project.status_id, 'manual');
  assert.equal(f.run.status, 'failed');
  assert.match(f.run.error, /changed status/);
  assert.equal(f.tables.activity_log.length, 0);
});

test('status automation records a successful guarded move', async () => {
  const f = fixture();
  await f.execute();
  assert.equal(f.project.status_id, 'scheduled');
  assert.equal(f.run.status, 'done');
  assert.equal(f.tables.activity_log.length, 1);
});
