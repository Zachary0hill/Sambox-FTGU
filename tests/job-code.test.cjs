/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./planning-workflow.test.cjs');

const jobCode = () => loader()('lib/studio/job-code.js');
// tests/job-codes-db.sql checks the same names against app.job_abbrev.
const NAMES = [['Completeful', 'CMP'], ['POD HUT', 'POD'], ['JohnXSantos', 'JXS'], ['Completeful Brand', 'CB'], ['HTSLEGOODS', 'HTS'],
  ['ZZMEDIA', 'ZZM'], ['The Print Lab', 'PL'], ['Acme', 'ACME'], ['Aeiou', 'AEI'], ['  ', ''], ['Über Café 9', 'BER']];

test('a client name shortens to a code people can say', () => {
  const { jobAbbrev } = jobCode();
  NAMES.forEach(([name, code]) => assert.equal(jobAbbrev(name), code, name));
  assert.equal(jobAbbrev(null), '');
});

test('job numbers count up per client and content type', () => {
  const { smartJob } = jobCode();
  const reel = { key: 'shortform', label: 'Shortform' }, long = { key: 'youtube_video', label: 'YouTube Video' };
  assert.equal(smartJob('Completeful', reel, []), 'CMP-RLS1');
  assert.equal(smartJob('POD HUT', long, ['POD-LF1', 'pod-lf2', 'POD-RLS9', 'IDEA-0ea33709', 'POD-LF2B']), 'POD-LF3');
  assert.equal(smartJob('POD HUT', { key: 'youtube_live', label: 'YouTube Live' }, ['POD-LF4']), 'POD-LIVE1');
  assert.equal(smartJob('Completeful', { key: 'podcast', label: 'Podcast Episode' }, []), 'CMP-PE1');
  assert.equal(smartJob('Completeful', null, ['CMP-PJ1']), 'CMP-PJ2');
  assert.equal(smartJob('', long, []), 'GEN-LF1');
});
