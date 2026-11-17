/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./planning-workflow.test.cjs');

function fixture({ concurrent, failRead = false, failWrite = false } = {}) {
  const row = { id: 'run', workspace_id: 'ws', status: 'running', attempt_id: 'attempt-1', actor_run_ids: ['actor-1'] };
  const aborted = [];
  function from() {
    let patch;
    const filters = [];
    const q = {
      select: () => q,
      eq: (k, v) => { filters.push([k, v]); return q; },
      is: (k, v) => { filters.push([k, v]); return q; },
      update: p => { patch = p; if (concurrent) Object.assign(row, concurrent); return q; },
      maybeSingle: async () => {
        if (patch ? failWrite : failRead) return { error: { message: 'Database unavailable' }, data: null };
        if (!filters.every(([k, v]) => row[k] === v)) return { data: null, error: null };
        if (patch) Object.assign(row, patch);
        return { data: { ...row, actor_run_ids: [...row.actor_run_ids] }, error: null };
      },
    };
    return q;
  }
  const { cancelRun } = loader({
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ from }) },
    '@/lib/ai/spend': {}, '@/lib/ai/usage': {}, '@/lib/ai/model': {}, '@/lib/ideas/cover': {},
    '@/lib/integrations/secrets': { getIntegration: async () => ({ secret: { apiToken: 'test' } }) },
    '@/lib/integrations/providers/apify': { abortRun: async (_token, id) => aborted.push(id) },
    './sources': {}, './draft': {},
  })('lib/research/run.ts');
  return { row, aborted, cancel: () => cancelRun('ws', 'run') };
}

test('research cancellation preserves a concurrent completion', async () => {
  const f = fixture({ concurrent: { status: 'done' } });
  assert.equal(await f.cancel(), true);
  assert.equal(f.row.status, 'done');
  assert.deepEqual(f.aborted, []);
});

test('research cancellation preserves a newer attempt and asks the caller to retry', async () => {
  const f = fixture({ concurrent: { attempt_id: 'attempt-2' } });
  await assert.rejects(f.cancel(), /changed while cancelling/);
  assert.equal(f.row.status, 'running');
  assert.deepEqual(f.aborted, []);
});

test('research cancellation aborts actor IDs from the successfully cancelled row', async () => {
  const f = fixture({ concurrent: { actor_run_ids: ['actor-1', 'actor-2'] } });
  assert.equal(await f.cancel(), true);
  assert.equal(f.row.status, 'cancelled');
  assert.deepEqual(f.aborted, ['actor-1', 'actor-2']);
});

test('research cancellation does not report database errors as success', async () => {
  for (const options of [{ failRead: true }, { failWrite: true }]) {
    const f = fixture(options);
    await assert.rejects(f.cancel(), /could not be/);
    assert.equal(f.row.status, 'running');
    assert.deepEqual(f.aborted, []);
  }
});
