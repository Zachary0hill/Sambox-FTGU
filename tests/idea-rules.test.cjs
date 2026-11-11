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
  const count = (ids) => ids.views.find((v) => v.label === 'Top scored').count;
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
  assert.equal(stageBlocker({ body: [], refs: [] }, 'Inbox', 'Research', rules), "Can't move to Research yet. Still needed: At least one source.");
  assert.equal(stageBlocker({ body: [], refs: ['x'] }, 'Inbox', 'Ready', rules), "Can't move to Ready yet. Still needed: Notes written, Cover image set.");
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

function browse(s2, ideasOver) {
  const f = fixture('admin');
  f.A = new Proxy({ ideaHistory: () => [], loadPreviews: () => {} }, { get: (t, k) => t[k] || (() => {}) });
  f.D.brands = [{ id: 'b', name: 'Brand', kind: 'channel' }];
  f.D.ideaRules = shared().normalizeIdeasRules(null);
  const base = { brand: 'Brand', brandId: 'b', type: 'Idea', by: 'T', byId: 'user', date: '', hook: 'Hook', body: [], tags: [], refs: [], findings: [], at: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z', format: '', pillar: '', audience: '', promise: '', platforms: [], ice: [null, null, null], priority: 3, effort: '', ownerId: 'user', owner: 'T', window: '', sponsorId: '', source: 'manual', researchRunId: '', projectId: '', script: null, coverMode: 'hook', coverPath: '', coverUrl: '', focal: [50, 50], highlight: '#FFE14D', hookPos: 'bottom', comments: [], hist: [], converted: [], run: null, research: null };
  f.D.ideas = ideasOver.map((x) => ({ ...base, stage: x.status, ...x }));
  Object.assign(f.s, { nav: 'ideas', iLayout: 'list' }, s2);
  return loader()('lib/studio/vals.js').computeVals(f).ids;
}
const scoredResearch = (total) => ({ summary: 's', findings: [], next_steps: [], generated_at: '', sources: [{ title: 'A', url: 'https://a.com', snippet: '' }], score: { total, ai_total: total, overridden: false, by: {} } });
const sample = [
  { id: 'a', title: 'A', status: 'Inbox', platforms: ['TikTok'], ownerId: 'u1', owner: 'One' },
  { id: 'b', title: 'B', status: 'Ready', research: scoredResearch(82), at: '2026-11-05T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  { id: 'c', title: 'C', status: 'Archived' },
];

test('stage tabs count each stage and archived ideas stay out of them', () => {
  const ids = browse({}, sample);
  assert.deepEqual(ids.tabs.map((t) => [t.label, t.count]), [['All', '2'], ['Inbox', '1'], ['Research', '0'], ['Ready', '1'], ['Approved', '0']]);
  assert.deepEqual(ids.stats.slice(0, 4).map((c) => c.value), ['1', '0', '1', '0']);
  assert.ok(!ids.views.some((v) => v.label === 'Archived'));
});

test('platform, owner, score and recommendation filters narrow the list', () => {
  const titles = (s2) => browse(s2, sample).cards.map((c) => c.title);
  assert.deepEqual(titles({ iPlatform: 'TikTok' }), ['A']);
  assert.deepEqual(titles({ iOwner: 'u1' }), ['A']);
  assert.deepEqual(titles({ iScore: 'high' }), ['B']);
  assert.deepEqual(titles({ iScore: 'none' }), ['A']);
  assert.deepEqual(titles({ iRec: 'pursue' }), ['B']);
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
