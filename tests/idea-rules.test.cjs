/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader, fixture } = require('./planning-workflow.test.cjs');

const shared = () => loader()('lib/ideas/rules-shared.ts');

test('a save trims lists, removes repeats and keeps the order typed', () => {
  const out = shared().validateIdeasRules({ formats: [' Short ', 'short', '', 'Vertical doc'] });
  assert.equal(out.ok, true);
  assert.deepEqual(out.rules.formats, ['Short', 'Vertical doc']);
});

test('a save reports each problem in plain words', () => {
  const { validateIdeasRules } = shared();
  assert.match(validateIdeasRules({ allowed_types: ['', ' '] }).errors[0], /at least one/);
  assert.match(validateIdeasRules({ recommendation: { pursue: 40, park: 45 } }).errors[0], /higher than/);
  assert.match(validateIdeasRules({ recommendation: { pursue: 140, park: 45 } }).errors[0], /0 to 100/);
  assert.match(validateIdeasRules({ cover: { highlight: 'red', hook_position: 'bottom' } }).errors[0], /from the list/);
  assert.match(validateIdeasRules({ pillars: ['x'.repeat(61)] }).errors[0], /longer than 60/);
});

test('a stored value that no longer validates resets only itself', () => {
  const out = shared().normalizeIdeasRules({ pillars: ['Mine'], recommendation: { pursue: 'high', park: 1 }, cover: 'bad' });
  assert.deepEqual(out.pillars, ['Mine']);
  assert.equal(out.recommendation.pursue, 70);
  assert.equal(out.cover.highlight, '#FFE14D');
  assert.deepEqual(shared().normalizeIdeasRules(null).allowed_types, ['Idea', 'Script', 'Research']);
});

function page(role, rules, ice) {
  const f = fixture(role);
  f.A = new Proxy({ ideaHistory: () => [], loadPreviews: () => {} }, { get: (t, k) => t[k] || (() => {}) });
  f.D.brands = [{ id: 'b', name: 'Brand', kind: 'channel' }];
  f.D.ideaRules = shared().normalizeIdeasRules(rules);
  f.D.ideas = [{ id: 'a', title: 'A', brand: 'Brand', brandId: 'b', type: 'Old type', stage: 'Inbox', status: 'Inbox', by: 'T', byId: 'user', date: '', hook: '', body: [], tags: [], refs: [], findings: [], at: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', format: '', pillar: '', audience: '', promise: '', platforms: [], ice: ice || [null, null, null], priority: 3, effort: '', ownerId: 'user', owner: 'T', window: '', sponsorId: '', source: 'manual', researchRunId: '', projectId: '', script: null, coverMode: 'hook', coverPath: '', coverUrl: '', focal: [50, 50], highlight: '#FFE14D', hookPos: 'bottom', comments: [], hist: [] }];
  Object.assign(f.s, { nav: 'ideas', iLayout: 'gallery', ideaModal: true });
  return loader()('lib/studio/vals.js').computeVals(f).ids;
}

test('the capture form reads its lists from Rules', () => {
  const ids = page('admin', { allowed_types: ['Video', 'Short'], formats: ['Vertical doc'], platforms: ['Threads'] });
  assert.deepEqual(ids.ni.types.map((t) => t.label), ['Video', 'Short']);
  assert.deepEqual(ids.ni.formats.map((t) => t.label), ['Vertical doc']);
  assert.deepEqual(ids.ni.platforms.map((t) => t.label), ['Threads']);
});

test('score labels and Top scored follow the Rules thresholds', () => {
  const count = (ids) => ids.tb.views.rows.find((v) => v.label === 'Top scored').count;
  assert.equal(count(page('admin', { recommendation: { pursue: 80, park: 45 } }, [7, 7, 7])), '0');
  assert.equal(count(page('admin', { recommendation: { pursue: 70, park: 45 } }, [7, 7, 7])), '1');
});

test('only a Super Admin gets the Rules drawer', () => {
  assert.ok(page('admin').rulesProps);
  assert.equal(page('manager').rulesProps, null);
});

const gates = () => loader()('lib/ideas/gates.ts');
const rulesWith = (ready, research) => shared().normalizeIdeasRules({ required_fields_by_stage: { research: research || [], ready } });

test('the checklist ticks each Ready requirement live', () => {
  const list = gates().gateChecklist({ body: ['Notes'], refs: [], findings: [] }, 'ready', rulesWith(['notes', 'source']));
  assert.deepEqual(list, [{ label: 'Notes written', on: true }, { label: 'At least one source', on: false }]);
});

test('a forward move names everything missing and checks each stage passed', () => {
  const { stageBlocker } = gates();
  const rules = rulesWith(['notes', 'cover'], ['source']);
  assert.equal(stageBlocker({ body: [], refs: [] }, 'Inbox', 'Research', rules), "Can't move to In Development yet. Still needed: At least one source.");
  assert.equal(stageBlocker({ body: [], refs: ['x'] }, 'Inbox', 'Ready', rules), "Can't send to review yet. Still needed: Notes written, Cover image set.");
  assert.equal(stageBlocker({ body: ['n'], refs: ['x'], coverPath: 'p' }, 'Inbox', 'Ready', rules), '');
});

test('moving back and approving follow the same rules as the database', () => {
  const { stageBlocker } = gates();
  const rules = rulesWith(['notes']);
  assert.equal(stageBlocker({ body: [] }, 'Ready', 'Inbox', rules), '');
  assert.equal(stageBlocker({ body: [] }, 'Ready', 'Approved', rules), "Can't approve yet. Still needed: Notes written.");
});

test('the score gate uses the Pursue threshold', () => {
  const { stageBlocker } = gates();
  const rules = shared().normalizeIdeasRules({ required_fields_by_stage: { research: [], ready: ['score'] }, recommendation: { pursue: 70, park: 45 } });
  assert.notEqual(stageBlocker({ ice: [7, 7, 6] }, 'Research', 'Ready', rules), '');
  assert.equal(stageBlocker({ ice: [7, 7, 7] }, 'Research', 'Ready', rules), '');
  assert.notEqual(stageBlocker({ ice: [7, null, 7] }, 'Research', 'Ready', rules), '');
});

test('unknown gate fields and an empty target list are refused', () => {
  const { validateIdeasRules } = shared();
  assert.equal(validateIdeasRules({ required_fields_by_stage: { research: ['nope'], ready: [] } }).ok, false);
  assert.equal(validateIdeasRules({ conversion_targets: [] }).ok, false);
});

function browse(s2, ideasOver, lanes, role) {
  const f = fixture(role || 'admin');
  f.D.ideaLanes = lanes || [];
  f.A = new Proxy({ ideaHistory: () => [], loadPreviews: () => {} }, { get: (t, k) => t[k] || (() => {}) });
  f.D.brands = [{ id: 'b', name: 'Brand', kind: 'channel' }];
  f.D.ideaRules = shared().normalizeIdeasRules(null);
  const base = { brand: 'Brand', brandId: 'b', type: 'Idea', by: 'T', byId: 'user', date: '', hook: 'Hook', body: [], tags: [], refs: [], findings: [], at: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z', format: '', pillar: '', audience: '', promise: '', platforms: [], ice: [null, null, null], priority: 3, effort: '', ownerId: 'user', owner: 'T', window: '', sponsorId: '', source: 'manual', researchRunId: '', projectId: '', script: null, coverMode: 'hook', coverPath: '', coverUrl: '', focal: [50, 50], highlight: '#FFE14D', hookPos: 'bottom', comments: [], hist: [], converted: [], run: null, research: null };
  f.D.ideas = ideasOver.map((x) => ({ ...base, stage: x.status, ...x }));
  Object.assign(f.s, { nav: 'ideas', iLayout: 'list' }, s2);
  const writes = [];
  f.A = new Proxy({ ideaHistory: () => [], loadPreviews: () => {}, updateIdea: (i, p, text) => { writes.push({ id: i.id, p, text }); return Promise.resolve(true); } }, { get: (t, k) => t[k] || (() => {}) });
  const ids = loader()('lib/studio/vals.js').computeVals(f).ids;
  ids.writes = writes;
  return ids;
}
const scoredResearch = (total) => ({ summary: 's', findings: [], next_steps: [], generated_at: '', sources: [{ title: 'A', url: 'https://a.com', snippet: '' }], score: { total, ai_total: total, overridden: false, by: {} } });
const sample = [
  { id: 'a', title: 'A', status: 'Inbox', platforms: ['TikTok'], ownerId: 'u1', owner: 'One' },
  { id: 'b', title: 'B', status: 'Ready', research: scoredResearch(82), at: '2026-11-05T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  { id: 'c', title: 'C', status: 'Archived' },
];

test('status tabs count each stage and archived ideas stay out of them', () => {
  const ids = browse({}, sample);
  assert.deepEqual(ids.tb.status.options.map((t) => [t.label, t.count]), [['All', '2'], ['Inbox', '1'], ['Development', '0'], ['Review', '1'], ['Approved', '0']]);
  assert.equal(ids.tb.views.rows.find((v) => v.label === 'Archived').count, '1');
  assert.equal(ids.tb.views.rows.find((v) => v.label === 'Parked').count, '0');
});

test('origin, owner, score and run filters narrow the list, and Parked lists archived ideas', () => {
  const titles = (s2) => browse(s2, sample).cards.map((c) => c.title);
  assert.deepEqual(titles({ iF: { owner: ['u1'] } }), ['A']);
  assert.deepEqual(titles({ iF: { score: ['high'] } }), ['B']);
  assert.deepEqual(titles({ iF: { score: ['none'] } }), ['A']);
  assert.deepEqual(titles({ iF: { score: ['high', 'none'] }, iSort: 'title' }), ['A', 'B']);
  assert.deepEqual(titles({ iF: { origin: ['ai'] } }), []);
  assert.deepEqual(titles({ iF: { run: ['none'] }, iSort: 'title' }), ['A', 'B']);
  assert.deepEqual(titles({ iView: 'archived' }), ['C']);
  assert.deepEqual(titles({ iView: 'parked' }), []);
  const tb = browse({ iF: { score: ['high'] } }, sample).tb;
  assert.equal(tb.filters.count, 1);
  assert.deepEqual(tb.filters.chips.map((c) => [c.group, c.value]), [['Score', '70+']]);
  assert.equal(tb.views.edited, true);
});

test('the board puts each idea in its workflow lane', () => {
  const ids = browse({ iLayout: 'board' }, sample);
  assert.deepEqual(ids.board.lanes.map((l) => [l.label, l.count]), [['Idea Inbox', '1'], ['In Development', '0'], ['Ready for Review', '1'], ['Approved', '0']]);
  const review = ids.board.lanes[2].cards[0];
  assert.equal(review.review, true);
  assert.equal(review.score, '82 · Pursue');
  assert.equal(ids.board.lanes[0].cards[0].moveLabel, 'Move A to In Development');
});

test('sort offers Newest and Stale first, and cards carry the recommendation', () => {
  assert.deepEqual(browse({ iSort: 'newest' }, sample).cards.map((c) => c.title), ['B', 'A']);
  assert.deepEqual(browse({ iSort: 'stale' }, sample).cards.map((c) => c.title), ['B', 'A']);
  const card = browse({ iSort: 'col:title' }, sample).cards[1];
  assert.equal(card.rec, 'Pursue');
  assert.equal(card.badge, '82 of 100');
  assert.equal(card.sources, '1');
});

test('card actions offer research and ask before archiving', () => {
  const card = browse({ iSort: 'col:title' }, sample).cards[0];
  assert.deepEqual(card.acts.map((a) => a.label), ['Open', 'Run research', 'Archive']);
  assert.equal(browse({ iSort: 'col:title', iArchiveAsk: 'a' }, sample).cards[0].acts[2].label, 'Confirm archive');
});

test('C captures, slash searches, and typing in a field is left alone', () => {
  const ev = (key, target = { tagName: 'DIV' }) => ({ key, target, preventDefault() {} });
  global.document = { querySelector: () => null, getElementById: () => ({ focus() { this.hit = true; } }), querySelectorAll: () => [] };
  const f = fixture('admin');
  f.A = new Proxy({ ideaHistory: () => [], loadPreviews: () => {} }, { get: (t, k) => t[k] || (() => {}) });
  f.D.brands = [{ id: 'b', name: 'Brand', kind: 'channel' }];
  let patch; f.set = (p) => { patch = p; };
  f.s.nav = 'ideas';
  const ids = loader()('lib/studio/vals.js').computeVals(f).ids;
  assert.equal(ids.hotkey(ev('c')), true);
  assert.equal(patch.ideaModal, true);
  assert.equal(ids.hotkey(ev('/')), true);
  patch = null;
  assert.equal(ids.hotkey(ev('c', { tagName: 'INPUT' })), false);
  assert.equal(patch, null);
  delete global.document;
});

const lanes = [{ id: 'h', kind: 'hold', label: 'On Hold', color: 'blue', position: 0 }, { id: 'k', kind: 'custom', label: 'Shoot list', color: 'violet', position: 1 }];
const laned = sample.concat([
  { id: 'd', title: 'D', status: 'Research', boardColumnId: 'h' },
  { id: 'e', title: 'E', status: 'Inbox', parkedAt: '2026-11-18T00:00:00Z' },
]);

test('side lanes follow the stages, On Hold starts collapsed, and an idea in one leaves its stage lane', () => {
  const ids = browse({ iLayout: 'board' }, laned, lanes);
  assert.deepEqual(ids.board.lanes.map((l) => [l.label, l.count, l.shut]), [['Idea Inbox', '1', false], ['In Development', '0', false], ['Ready for Review', '1', false], ['Approved', '0', false], ['On Hold', '1', true], ['Shoot list', '0', false]]);
  assert.deepEqual(ids.tb.status.options.map((t) => t.count), ['3', '1', '0', '1', '0']);
  assert.equal(ids.tb.views.rows.find((v) => v.label === 'Parked').count, '1');
  assert.ok(ids.board.addCol, 'a Super Admin can add a column');
  assert.equal(ids.board.lanes[5].note, 'Deleting moves its cards to On Hold.');
  assert.equal(ids.board.lanes[4].note, 'Deleting moves its cards to their stage lanes.');
  assert.equal(browse({ iLayout: 'board' }, laned, lanes, 'editor').board.addCol, null);
});

test('moves place ideas in side lanes, Parked, or back on a stage, each with an Undo', () => {
  const ids = browse({ iLayout: 'board' }, laned, lanes);
  ids.board.lanes[0].onDrop({ preventDefault() {}, dataTransfer: { getData: () => 'a' } });
  ids.board.lanes[5].onDrop({ preventDefault() {}, dataTransfer: { getData: () => 'a' } });
  ids.board.lanes[1].onDrop({ preventDefault() {}, dataTransfer: { getData: () => 'd' } });
  ids.board.lanes[2].cards[0].park();
  assert.deepEqual(ids.writes.map((w) => [w.id, w.p]), [
    ['a', { boardColumnId: 'k', parkedAt: '' }],
    ['d', { boardColumnId: '' }],
    ['b', { parkedAt: ids.writes[2].p.parkedAt, boardColumnId: '' }],
  ]);
  assert.ok(ids.writes[2].p.parkedAt, 'parking stamps the time');
});

test('a parked idea moves back to In Development, and an idea on hold resumes from the dialog', () => {
  const parked = browse({ iLayout: 'board', iView: 'parked' }, laned, lanes);
  assert.deepEqual(parked.board.lanes.map((l) => [l.label, l.count]), [['Parked', '1']]);
  parked.board.lanes[0].cards[0].unpark();
  assert.deepEqual(parked.writes[0].p, { parkedAt: '', boardColumnId: '', status: 'Research' });
  const held = browse({ iLayout: 'board', ideaOpen: 'd' }, laned, lanes);
  assert.equal(held.sel.laneLabel, 'On Hold');
  assert.equal(held.sel.extraChip, 'On Hold');
  assert.deepEqual(held.sel.foot.map((b) => b.label), ['Resume development']);
  assert.deepEqual(held.sel.actions.map((a) => a.label), ['Edit', 'Duplicate', 'Park', 'Archive']);
});
