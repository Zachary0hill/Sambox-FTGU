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

function ideas(open, layout, setup = () => {}) {
  const f = fixture('admin');
  const writes = [];
  f.A = new Proxy({ ideaHistory: () => [], loadPreviews: () => {}, updateIdea: (i, p, text) => { writes.push({ id: i.id, p, text }); return Promise.resolve(true); } }, { get: (t, k) => t[k] || (() => {}) });
  f.D.brands = [{ id: 'b', name: 'Brand', kind: 'channel' }];
  f.D.rows = [{ id: 'proj', job: 'IDEA-1', title: 'Project' }];
  f.D.ideas = [idea('in', 'Inbox'), idea('re', 'Research'), idea('rd', 'Ready'), idea('ap', 'Approved'), idea('li', 'Approved', { projectId: 'proj' }), idea('ar', 'Archived')];
  Object.assign(f.s, { nav: 'ideas', iLayout: layout || 'board', ideaOpen: open || '' });
  setup(f);
  const { computeVals } = loader()('lib/studio/vals.js');
  const view = computeVals(f);
  const ids = view.ids;
  return { ids, writes, detail: ids.sel, refresh: () => computeVals(f).ids };
}

test('the board has the four stages in order and archived ideas leave it', () => {
  const { ids } = ideas();
  assert.deepEqual(ids.board.lanes.map((c) => c.label), ['Idea Inbox', 'In Development', 'Ready for Review', 'Approved']);
  assert.deepEqual(ids.board.lanes.map((c) => c.cards.length), [1, 1, 1, 2]);
});

test('the detail footer offers the lane\'s next step first', () => {
  assert.deepEqual(ideas('in').detail.foot.map((b) => b.label), ['Start development', 'Send to review']);
  assert.deepEqual(ideas('re').detail.foot.map((b) => b.label), ['Send to review']);
  assert.deepEqual(ideas('rd').detail.foot.map((b) => [b.label, b.primary]), [['Approve', true], ['Return to development', false], ['Park', false]]);
  assert.deepEqual(ideas('li').detail.foot.map((b) => b.label), ['Open project']);
  assert.deepEqual(ideas('ar').detail.foot.map((b) => b.label), ['Restore to In Development']);
  assert.equal(ideas('re').detail.laneLabel, 'In Development');
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

test('Approve hands off to In Production and opens the project only from the confirmation', async () => {
  const calls = [];
  let state, notice;
  const { detail, refresh } = ideas('rd', 'board', (f) => {
    f.D.ideas.find((i) => i.id === 'rd').body = ['Ready to film'];
    state = f.s;
    f.set = (patch) => Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
    f.A.previewIdea = async () => ({reviewKey: 'reviewed-package'});
    f.A.approveIdea = async (i, key) => {
      assert.equal(key, 'reviewed-package');
      calls.push(i.id);
      return { project: { created: true, job: 'IDEA-1', canOpen: true } };
    };
    f.A.toast = (message, action) => { notice = { message, action }; };
  });
  await detail.foot[0].pick();
  assert.deepEqual(calls, []);
  await refresh().handoff.confirm();
  assert.deepEqual(calls, ['rd']);
  assert.equal(state.nav, 'ideas');
  assert.equal(state.ideaOpen, '');
  assert.match(notice.message, /approved and added to In Production/);
  assert.match(notice.message, /source idea is in Archived/);
  assert.equal(notice.action.label, 'Open project');
  notice.action.run();
  assert.equal(state.nav, 'projects');
  assert.equal(state.openJob, 'IDEA-1');
});

test('an archived handoff keeps the project and cover recovery action available', () => {
  const { detail } = ideas('li', 'board', f => {
    Object.assign(f.D.ideas.find(i => i.id === 'li'), { status: 'Archived', stage: 'Approved', coverPath: 'original.png' });
    f.s.iView = 'archived';
  });
  assert.equal(detail.cta, 'Open project');
  assert.ok(detail.actions.some(a => a.label === 'Retry asset transfer'));
});

test('archived job and client search use only accessible linked projects across layouts', () => {
  for (const layout of ['board','gallery','list']) {
    const view = (query, hidden) => ideas('', layout, f => {
      Object.assign(f.D.ideas.find(i => i.id === 'li'), {status: 'Archived', stage: 'Approved'});
      f.D.channels = [{id: 'channel', owner_account_id: 'account'}];
      f.D.accounts = [{id: 'account', name: 'Editorial Client'}];
      f.D.rows = hidden ? [] : [{id: 'proj', job: 'CMP-RLS8', title: 'Renamed project', channelId: 'channel', approval: 'Pending', sponsorshipId: null}];
      Object.assign(f.s, {iView: 'archived', iStage: 'Approved', iq: query});
    }).ids;
    for (const query of ['CMP-RLS8','Editorial Client','Renamed project']) {
      const ids = view(query, false);
      const cards = layout === 'board' ? ids.board.lanes.flatMap(l => l.cards) : ids.cards;
      assert.deepEqual(cards.map(c => c.id), ['li']);
      assert.equal(cards[0].archiveProject.job, 'CMP-RLS8');
    }
    assert.equal(view('CMP-RLS8', true).cards.length, 0);
  }
});

function actions(update) {
  const { makeActions } = loader()('lib/studio/actions.js');
  const sb = { from: () => ({ update: (db) => ({ eq: async () => { await update(db); return { error: null }; } }), insert: async () => ({ error: null }) }), storage: { from: () => ({}) }, auth: {} };
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

test('approval waits for a pending sponsor edit before taking a project snapshot', async () => {
  const originalFetch = global.fetch;
  let finishSave, requested = false;
  const saving = new Promise((resolve) => { finishSave = resolve; });
  const A = actions(async (patch) => {
    assert.equal(patch.sponsor_id, 'sponsor-kit');
    await saving;
  });
  try {
    global.fetch = async () => {
      requested = true;
      return Response.json({ project: { job: 'IDEA-1' } });
    };
    const ready = { id: 'x', title: 'Test', status: 'Ready' };
    const write = A.updateIdea(ready, { sponsorId: 'sponsor-kit' });
    const approve = A.approveIdea(ready);
    await new Promise(setImmediate);
    assert.equal(requested, false);
    finishSave();
    assert.equal(await write, true);
    assert.equal((await approve).project.job, 'IDEA-1');
  } finally {
    global.fetch = originalFetch;
  }
});
