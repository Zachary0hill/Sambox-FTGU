/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function fixture({ failCell = false, failBrand = false, failStorage = false } = {}) {
  const file = { asset_id: 'asset', path: 'workspace/brand/file.png', name: 'file.png' };
  const other = { path: 'workspace/brand/other.png', name: 'other.png' };
  const row = { id: 'project', title: 'Project', cf: { field: [file] } };
  const field = { id: 'field', label: 'Files' };
  const brand = { id: 'brand', name: 'Brand', assets: [file] };
  let data = { ws: { id: 'workspace' }, rows: [row], brands: [{ ...brand, assets: [file, other] }] };
  const calls = [], notices = [];
  const sb = {
    from(table) {
      const query = {
        upsert(value) { calls.push([table, 'upsert', value]); return query; },
        update(value) { calls.push([table, 'update', value]); return query; },
        delete() { calls.push([table, 'delete']); return query; },
        eq() { return query; }, select() { return query; }, single() { return query; },
        then(resolve, reject) {
          const error = (table === 'project_field_values' && failCell) || (table === 'brand_kits' && failBrand);
          return Promise.resolve(error ? { error: { message: 'Save denied' } } : { data: { id: 'saved' } }).then(resolve, reject);
        },
      };
      return query;
    },
    rpc: async () => ({ data: null }),
    storage: { from: (bucket) => ({ remove: async (paths) => {
      calls.push([bucket, 'remove', paths]);
      return failStorage ? { error: { message: 'Storage offline' } } : {};
    } }) },
  };
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('lib/studio/actions.js', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(() => ({}), mod, mod.exports);
  const actions = mod.exports.makeActions({ sb, getD: () => data, setD: fn => { data = fn(data); },
    getMe: () => ({ id: 'user' }), toast: message => notices.push(message), reload: async () => {} });
  return { actions, row, field, file, other, brand, calls, notices, recover: () => { failCell = false; } };
}

test('a failed file-cell save preserves the asset row and stored file', async () => {
  const f = fixture({ failCell: true });
  await f.actions.removeFieldFile(f.row, f.field, f.file);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], 'project_field_values');
  assert.deepEqual(f.notices, ['Save denied']);
});

test('file-cell deletion saves the cell before deleting asset metadata and bytes', async () => {
  const f = fixture();
  await f.actions.removeFieldFile(f.row, f.field, f.file);
  assert.deepEqual(f.calls.map(x => x.slice(0, 2)), [
    ['project_field_values', 'upsert'], ['project_assets', 'delete'], ['project-assets', 'remove'],
  ]);
});

test('a failed queued cell write does not poison later saves', async () => {
  const f = fixture({ failCell: true });
  assert.equal(await f.actions.setCustomValue(f.row, f.field, [f.file]), false);
  f.recover();
  assert.equal(await f.actions.setCustomValue(f.row, f.field, [f.file]), true);
});

test('a failed brand metadata save never removes the original file', async () => {
  const f = fixture({ failBrand: true });
  await f.actions.removeBrandFile(f.brand, f.file);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].slice(0, 2), ['brand_kits', 'update']);
});

test('brand removal uses the current asset list and saves it before deleting bytes', async () => {
  const f = fixture();
  await f.actions.removeBrandFile(f.brand, f.file);
  assert.deepEqual(f.calls.map(x => x.slice(0, 2)), [['brand_kits', 'update'], ['brand-assets', 'remove']]);
  assert.deepEqual(f.calls[0][2].assets, [f.other]);
});

test('brand storage failure explains that durable cleanup will retry', async () => {
  const f = fixture({ failStorage: true });
  await f.actions.removeBrandFile(f.brand, f.file);
  assert.match(f.notices[0], /cleanup will retry/);
});
