/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function setup(failure) {
  let inserts = 0, savedId = null, fail = true;
  const sb = { from: () => {
    const q = { insert: () => { inserts++; return q; }, update: () => q, eq: () => q, select: () => q,
      single: async () => ({ data: { id: 'saved-card' } }), then: resolve => Promise.resolve({}).then(resolve) };
    return q;
  }, rpc: async () => ({}), storage: { from: () => ({ upload: async () => {
    assert.equal(savedId, 'saved-card', 'identity is recorded before starting the upload');
    return fail && failure === 'upload' ? { error: { message: 'offline' } } : {};
  }, remove: async () => ({}) }) } };
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('lib/studio/actions.js', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(() => ({}), mod, mod.exports);
  const actions = mod.exports.makeActions({ sb, getD: () => ({ ws: { id: 'workspace' } }),
    reload: async () => { if (fail && failure === 'reload') throw new Error('reload offline'); } });
  return { save: (file = { type: 'image/png', size: 20, name: 'image.png' }) => actions.saveContentEntry(savedId, { title: 'Card' }, { file }, null, id => { savedId = id; }),
    recover: () => { fail = false; }, count: () => inserts };
}
for (const failure of ['upload', 'reload']) test(`content retry after ${failure} failure updates the original card`, async () => {
  const f = setup(failure);
  await assert.rejects(f.save(), /offline/);
  f.recover();
  assert.equal(await f.save(), 'saved-card');
  assert.equal(f.count(), 1);
});
test('invalid content banner is rejected before any card is created', async () => {
  const f = setup('upload');
  await assert.rejects(f.save({ type: 'application/pdf', size: 10 }), /image file/);
  assert.equal(f.count(), 0);
});
