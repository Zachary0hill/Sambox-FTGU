/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader, fixture } = require('./planning-workflow.test.cjs');

const idea = (id, status, extra) => ({
  id, title: id, brand: 'Brand', brandId: 'b', type: 'Idea', stage: status === 'Archived' ? 'Research' : status, status,
  by: 'Tester', byId: 'user', date: '', hook: '', body: [], tags: [], refs: [], findings: [], at: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
  format: '', pillar: '', audience: '', promise: '', platforms: [], ice: [null, null, null], priority: 3, effort: '', ownerId: 'user', owner: 'Tester',
  window: '', sponsorId: '', source: 'manual', researchRunId: '', projectId: '', script: null, coverMode: 'hook', coverPath: '', coverUrl: '', focal: [50, 50],
  highlight: '#FFE14D', hookPos: 'bottom', comments: [], hist: [], ...extra,
});

function ideas(open, layout) {
  const f = fixture('admin');
  const writes = [];
  f.A = new Proxy({ ideaHistory: () => [], loadPreviews: () => {}, updateIdea: (i, p, text) => { writes.push({ id: i.id, p, text }); return Promise.resolve(true); } }, { get: (t, k) => t[k] || (() => {}) });
  f.D.brands = [{ id: 'b', name: 'Brand', kind: 'channel' }];
  f.D.rows = [{ id: 'proj', job: 'IDEA-1', title: 'Project' }];
  f.D.ideas = [idea('in', 'Inbox'), idea('re', 'Research'), idea('rd', 'Ready'), idea('ap', 'Approved'), idea('li', 'Approved', { projectId: 'proj' }), idea('ar', 'Archived')];
  Object.assign(f.s, { nav: 'ideas', iLayout: layout || 'board', ideaOpen: open || '' });
  const { computeVals } = loader()('lib/studio/vals.js');
  const view = computeVals(f);
  const ids = Object.values(view).find((v) => v && v.cols && v.views) || view.ids;
  return { ids, writes, detail: ids.sel };
}

test('the board has the four stages in order and archived ideas leave it', () => {
  const { ids } = ideas();
  assert.deepEqual(ids.cols.map((c) => c.label), ['Inbox', 'Research', 'Ready', 'Approved']);
  assert.deepEqual(ids.cols.map((c) => c.items.length), [1, 1, 1, 2]);
});

test('each stage offers the next step, and Approve only appears at Ready', () => {
  assert.equal(ideas('in').detail.cta, 'Move to Research');
  assert.equal(ideas('in').detail.hasBack, false);
  assert.equal(ideas('re').detail.cta, 'Move to Ready');
  assert.equal(ideas('rd').detail.cta, 'Approve');
  assert.equal(ideas('ap').detail.cta, 'Convert');
  assert.equal(ideas('li').detail.cta, 'Open project');
});

test('Request changes moves back one stage, not to the start', () => {
  const ready = ideas('rd'); ready.detail.back();
  assert.equal(ready.writes[0].p.status, 'Research');
  const research = ideas('re'); research.detail.back();
  assert.equal(research.writes[0].p.status, 'Inbox');
});

function actions(update) {
  const { makeActions } = loader()('lib/studio/actions.js');
  const sb = { from: () => ({ update: (db) => { update(db); return { eq: async () => ({ error: null }) }; }, insert: async () => ({ error: null }) }), storage: { from: () => ({}) }, auth: {} };
  const D = { ideas: [], ws: { id: 'ws' } };
  return makeActions({ sb, getD: () => D, setD: () => {}, getMe: () => ({ id: 'user', name: 'Tester', perms: new Set() }), toast: () => {}, reload: async () => {}, reloadPortal: async () => {}, switchAccount: () => {} });
}

test('archiving writes only the flag, so the idea keeps its stage', async () => {
  let db; await actions((v) => { db = v; }).updateIdea({ id: 'x', title: 'x' }, { status: 'Archived' }, '');
  assert.ok(db.archived_at); assert.equal('stage' in db, false); assert.equal('status' in db, false);
});

test('a stage move clears the flag and writes the database stage', async () => {
  let db; await actions((v) => { db = v; }).updateIdea({ id: 'x', title: 'x' }, { status: 'Ready' }, '');
  assert.deepEqual(db, { archived_at: null, stage: 'ready' });
});
