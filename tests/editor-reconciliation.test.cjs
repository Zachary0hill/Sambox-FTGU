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

test('contract reuse uses the immediately previous calendar month across years', () => {
  const { priorBillingMonth } = require('../lib/studio/editor-reconciliation.js');
  assert.equal(priorBillingMonth('2027-01'), '2026-12');
  assert.equal(priorBillingMonth('2026-11'), '2026-10');
});
test('a Finance transfer credits only the selected editor and uses the server billing decision', () => {
  const lines = [entry('a', { statement_editor_id: 'Himanshu', billing_reason: 'No credit · Finance decision' }),
    entry('b', { kind: 'repeat', project_id: 'a', statement_editor_id: 'other', billing_reason: 'Counted' })];
  assert.equal(report(lines).amounts.units, 0);
  assert.equal(editorStatement(lines, 'other', terms).amounts.units, 1);
});
test('statement CSV preserves saved cents, version, invoice, and text-safe project titles', () => {
  const { statementCsv } = require('../lib/studio/editor-reconciliation.js');
  const rows = statementCsv({ billing_month:'2026-11-01',editor_id:'editor',version:2,reason:'reassigned',affected_jobs:['QA-1'],delta_cents:-1250,
    document: { terms,units:1,included:1,overage:0,overage_cents:0,total_cents:10000,payout:{invoice_url:'https://example.test/reference'},
      items:[{ job_code:'QA-1',project_title:'=unsafe()' }] } });
  assert.equal(rows.find(r=>r[0]==='Version')[1],2);
  assert.equal(rows.find(r=>r[0]==='Version delta (USD cents)')[1],-1250);
  assert.equal(rows.find(r=>r[0]==='Invoice')[1],'https://example.test/reference');
  assert.equal(rows.at(-1)[2],"'=unsafe()");
});
