/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./planning-workflow.test.cjs');

function fixture(role, perms = [], author = 'other') {
  const calls = { models: 0, downloads: 0, writes: 0 };
  const idea = { id: 'idea', author_id: author, workspace_id: 'ws', brand_id: 'brand', title: 'Idea', body: [], cover_path: null, cover_mode: 'image' };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: idea }) };
  const member = { ctx: { role, user_id: 'user', workspace_id: 'ws', perms }, supabase: { from: () => query } };
  const unexpected = () => { calls.writes++; throw new Error('Unexpected storage write'); };
  const load = loader({
    '@/lib/ai/model': { workspaceModels: async () => { calls.models++; return []; } },
    '@/lib/ai/spend': {}, '@/lib/ai/usage': {},
    '@/lib/integrations/secrets': {},
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ storage: { from: unexpected } }) },
    '@/lib/http/public-resource': { fetchPublicResource: async () => { calls.downloads++; throw new Error('Download stopped'); } },
    ai: {}, '@ai-sdk/openai': {}, '@ai-sdk/google': {},
  });
  return { calls, member, script: load('lib/ideas/script.ts').generateScript, cover: load('lib/ideas/cover.ts').makeIdeaCover };
}

test('read-only managers, non-author designers and editors cannot start idea generation or cover downloads', async () => {
  for (const role of ['manager', 'designer', 'editor']) {
    const f = fixture(role);
    await assert.rejects(f.script({ member: f.member, ideaId: 'idea', notes: '', length: '', current: [] }), e => e.status === 403);
    for (const mode of ['url', 'generate']) {
      await assert.rejects(f.cover({ member: f.member, ideaId: 'idea', ws: 'ws', mode, url: 'https://example.com/image.png' }), e => e.status === 403);
    }
    assert.deepEqual(f.calls, { models: 0, downloads: 0, writes: 0 });
  }
});

test('authorized idea writers reach generation availability checks', async () => {
  for (const [role, perms, author] of [
    ['super_admin', [], 'other'], ['manager', [['ideas', 'edit']], 'other'],
    ['designer', [], 'user'], ['client', [], 'other'], ['sponsor', [], 'other'],
  ]) {
    const f = fixture(role, perms, author);
    await assert.rejects(f.script({ member: f.member, ideaId: 'idea', notes: '', length: '', current: [] }), e => e.status === 409);
    assert.equal(f.calls.models, 1);
    await assert.rejects(f.cover({ member: f.member, ideaId: 'idea', ws: 'ws', mode: 'url', url: 'https://example.com/image.png' }), /Download stopped/);
    assert.equal(f.calls.downloads, 1);
    assert.equal(f.calls.writes, 0);
  }
});
