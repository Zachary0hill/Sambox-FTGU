/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./planning-workflow.test.cjs');

function fixture() {
  const rows = new Map(), calls = [], copies = [], removed = [];
  const from = () => ({
    update(patch) {
      let id;
      const q = {
        eq(key, value) { if (key === 'id') id = value; return q; },
        select: () => q,
        single: () => {
          const row = rows.get(id);
          if (!row || row.status !== 'draft_pending') return { error: { message: 'lost claim' } };
          Object.assign(row, patch); return { data: { id } };
        },
      };
      return q;
    },
  });
  const admin = {
    from,
    rpc: async (_name, args) => {
      assert.equal(args.p_workspace, 'studio');
      const id = args.p_channel;
      if (!id) return { data: { brand: 'Client A', file: 'final.mp4', channels: ['A1','A2'].map(id => ({ id, label: id })) } };
      if (rows.has(id) && rows.get(id).status !== 'draft_failed') return { data: { status: rows.get(id).status, postId: rows.get(id).buffer_post_id } };
      rows.set(id, { status: 'draft_pending' });
      return { data: { claim: id, sourcePath: 'studio/project/approved.mp4', name: 'final.mp4', service: 'youtube', text: 'Caption', title: 'Title' } };
    },
    storage: { from: () => ({
      copy: async path => { copies.push(path); return {}; },
      remove: async paths => { removed.push(...paths); return {}; },
      getPublicUrl: path => ({ data: { publicUrl: 'https://media.example/' + path } }),
    }) },
  };
  const load = loader({ '@/lib/supabase/admin': { supabaseAdmin: () => admin }, './secrets': { getIntegration: () => ({ secret: { apiKey: 'fixture' } }) } });
  const { draftProjectToBuffer } = load('lib/integrations/buffer-drafts.ts');
  return { rows, calls, copies, removed, run: test => draftProjectToBuffer({ id: 'project', workspace_id: 'studio' }, { test, runId: 'run' }) };
}

test('preview has no effects and retry sends only the definitively rejected channel', async t => {
  const f = fixture();
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { query, variables: { input } } = JSON.parse(options.body);
    assert.match(query, /post \{ id status/);
    assert.equal(input.saveToDraft, true); assert.equal(input.mode, 'addToQueue');
    assert.equal(input.dueAt, undefined); assert.equal(input.assets.length, 1);
    assert.deepEqual(Object.keys(input.assets[0]), ['video']);
    assert.match(input.assets[0].video.url, /^https:\/\/media[.]example\/studio\/project\//);
    f.calls.push(input.channelId);
    const post = input.channelId === 'A2' && f.calls.length === 2
      ? { __typename: 'InvalidInputError', message: 'Temporarily rejected' }
      : { __typename: 'PostActionSuccess', post: { id: 'post-' + input.channelId, status: 'draft' } };
    return Response.json({ data: { createPost: post } });
  });
  assert.match((await f.run(true)).detail, /Client A.*final.mp4.*A1, A2/);
  assert.equal(f.rows.size + f.calls.length + f.copies.length, 0);
  assert.equal((await f.run(false)).retry, true);
  assert.equal((await f.run(false)).failed, false);
  assert.equal((await f.run(false)).failed, false);
  assert.deepEqual(f.calls, ['A1','A2','A2']);
  assert.equal(f.copies.length, 3); assert.equal(f.removed.length, 1);
  assert.equal(f.rows.get('A2').buffer_post_id, 'post-A2');
});

test('unexpected returned status and a lost provider response hold their reservations', async t => {
  const f = fixture();
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { variables: { input } } = JSON.parse(options.body);
    f.calls.push(input.channelId);
    if (input.channelId === 'A2') throw new Error('Connection lost');
    return Response.json({ data: { createPost: { __typename: 'PostActionSuccess', post: { id: 'inspect-me', status: 'scheduled' } } } });
  });
  assert.equal((await f.run(false)).failed, true);
  assert.equal(f.rows.get('A1').buffer_post_id, 'inspect-me');
  assert.equal(f.rows.get('A2').status, 'draft_review');
  assert.equal((await f.run(false)).retry, false);
  assert.deepEqual(f.calls, ['A1','A2']);
  assert.equal(f.removed.length, 0);
});
