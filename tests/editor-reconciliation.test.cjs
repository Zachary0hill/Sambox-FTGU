/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { billingMonth, editorStatement } = require('../lib/studio/editor-reconciliation.js');

const terms = { included_units: 2, retainer_cents: 10000, overage_cents: 1250, content_type_key: 'short' };
const entry = (id, changes = {}) => ({ id, project_id: id, editor_id: 'Himanshu', kind: 'first', content_type_key: 'short', ...changes });
const report = (lines, contract = terms) => editorStatement(lines, 'Himanshu', contract);
test('November closes at local midnight, including the UTC month boundary', () => {
  assert.equal(billingMonth('2026-12-01T05:59:59Z','America/Chicago'), '2026-11');
  assert.equal(billingMonth('2026-12-01T06:00:00Z','America/Chicago'), '2026-12');
});
test('exact allowance owes the retainer and one extra short adds one overage', () => {
  assert.deepEqual(report([entry('a'),entry('b')]).amounts, { units: 2, included: 2, overage: 0, overageAmount: 0, total: 10000 });
  assert.deepEqual(report([entry('a'),entry('b'),entry('c')]).amounts, { units: 3, included: 2, overage: 1, overageAmount: 1250, total: 11250 });
});
test('reapproval after revision remains visible, excludes other editors and out-of-contract units', () => {
  const result = report([entry('a'),entry('again', { project_id: 'a', kind: 'repeat' }),entry('b', { editor_id: 'other' }),entry('c', { content_type_key: 'long' })]);
  assert.equal(result.amounts.units, 1);
  assert.deepEqual(result.lines.map(x => x.reason), ['Counted','Reapproval · review only','Outside contract']);
});
test('missing terms or editor leave the total unresolved', () => {
  assert.equal(report([entry('a')], null).amounts, null);
  assert.equal(editorStatement([entry('a', { editor_id: null })], null, null).lines[0].reason, 'Missing editor');
});
