/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => load(path.resolve(path.dirname(file), name + '.js')), mod, mod.exports);
  return mod.exports;
}
const { parseIdeaDocument, IDEA_TEMPLATE, validateImportIdea } = load('lib/ideas/import-document.js');
const { saveIdeaImport } = load('lib/ideas/import-save.js');
const brands = [{ id: 'pod', name: 'POD HUT' }, { id: 'other', name: 'Other Client' }];

test('template becomes two separate ideas with brand, references and production planning', () => {
  const { ideas } = parseIdeaDocument(IDEA_TEMPLATE, brands);
  assert.equal(ideas.length, 2);
  assert.equal(ideas[0].title, 'Why your podcast sounds different');
  assert.equal(ideas[0].brandId, 'pod');
  assert.equal(ideas[0].hook, 'BETTER SOUND');
  assert.equal(ideas[0].refs[0], 'https://www.youtube.com/watch?v=example');
  assert.equal(ideas[0].titleOptions.length, 2);
  assert.match(ideas[0].thumbnailBrief, /Before-and-after/);
  assert.match(ideas[0].body, /before-and-after sound/);
  assert.doesNotMatch(ideas[0].body, /Walk through/);
  assert.equal(ideas[1].brandId, 'pod');
});

test('frontmatter, bold labels and per-idea clients resolve without guessing unknown clients', () => {
  const { ideas } = parseIdeaDocument('---\nclient: "Podhut"\n---\n# Shoot list\n## First\nDescription: One\n## Second\n**Client:** Other Client\nDescription: Two\n## Third\nClient: Missing\nDescription: Three', brands);
  assert.deepEqual(ideas.map(i => i.brandId), ['pod', 'other', '']);
  assert.match(ideas[2].brandWarning, /not found/);
  assert.equal(parseIdeaDocument('Client: **POD HUT**\n## One\nBody', brands).ideas[0].brandId, 'pod');
  assert.equal(parseIdeaDocument('**Client:** POD HUT\n## One\nBody', brands).ideas[0].brandId, 'pod');
  const ambiguous = parseIdeaDocument('Client: Podhut\n## One\nBody', [...brands, { id: 'duplicate', name: 'Podhut' }]);
  assert.equal(ambiguous.ideas[0].brandId, '');
});

test('document name suggests a client but incidental script mentions never select one', () => {
  assert.equal(parseIdeaDocument('## One\nBody', brands, 'podhut-shoot-list-nov5.md').ideas[0].brandId, 'pod');
  assert.equal(parseIdeaDocument('## One\nVisit POD HUT today.', brands).ideas[0].brandId, '');
  assert.equal(parseIdeaDocument('## One\nBody', brands, 'podhutters-shoot.md').ideas[0].brandId, '');
  assert.equal(parseIdeaDocument('Client: Unknown\n## One\nBody', brands, 'podhut.md').ideas[0].brandId, '');
});

test('fenced code and field subheadings stay in their original idea; links preserve balanced parentheses', () => {
  const raw = '# List\n## First\n### Description\nSome content\n```md\n## Fake idea\nClient: Other Client\n```\n### References\n[Source](https://example.com/a_(b))\nhttps://example.com/two.\n## Second\nBody';
  const { ideas } = parseIdeaDocument(raw, brands);
  assert.equal(ideas.length, 2);
  assert.deepEqual(ideas[0].refs, ['https://example.com/a_(b)', 'https://example.com/two']);
  assert.match(ideas[0].body, /## Fake idea/);
  assert.equal(ideas[0].brandId, '');
});

test('numbered headings split beneath category headings and preserve shared context', () => {
  const { ideas } = parseIdeaDocument('# POD HUT shoot\nShoot on Friday.\n## Tutorials\n### 1. First\nText\n### 2. Second\nMore', brands);
  assert.deepEqual(ideas.map(i => i.title), ['First', 'Second']);
  assert.match(ideas[0].body, /Shoot on Friday/);
});

test('JSON lists map description and references while ignoring supplied IDs, authors and status', () => {
  const raw = JSON.stringify({ client: 'POD HUT', ideas: [{ title: 'First', description: 'Full description', references: ['https://example.com'], id: 'evil', author_id: 'evil', status: 'approved' }, { title: 'Second', client: 'Other Client', script: ['A', 'B'] }] });
  const { ideas } = parseIdeaDocument(raw, brands);
  assert.equal(ideas[0].body, 'Full description');
  assert.equal(ideas[1].body, 'A\n\nB');
  assert.equal(ideas[0].status, undefined);
  assert.equal(ideas[0].id, undefined);
  assert.equal(ideas[1].brandId, 'other');
  assert.equal(parseIdeaDocument('```json\n' + raw + '\n```', brands).ideas.length, 2);
  const combined = parseIdeaDocument(JSON.stringify({ title: 'Both', description: 'The premise', script: 'The full script' }), brands).ideas[0];
  assert.match(combined.body, /The premise/); assert.match(combined.body, /The full script/);
});

test('malformed, excessive and unsafe content fails visibly without truncating scripts', () => {
  for (const raw of ['', 'x'.repeat(250001), '{bad', 'ordinary prose without headings', '[]', JSON.stringify(Array.from({ length: 101 }, () => ({ title: 'One' }))), JSON.stringify({ title: 'One', references: ['javascript:alert(1)'] }), JSON.stringify({ title: 'One', body: 'x'.repeat(30001) })]) assert.throws(() => parseIdeaDocument(raw, brands));
  const body = 'x'.repeat(28000);
  assert.equal(parseIdeaDocument(JSON.stringify({ title: 'One', body }), brands).ideas[0].body, body);
  assert.throws(() => validateImportIdea({ ...parseIdeaDocument('## One\nBody').ideas[0], refs: ['invalid'] }), /valid http/);
});

function database() {
  const records = new Map();
  const calls = [];
  let fail = false;
  let lostResponse = false;
  return { records, calls, setFail: v => { fail = v; }, loseResponse: () => { lostResponse = true; }, sb: { from: table => ({ upsert: (rows, options) => ({ select: async columns => {
    calls.push({ table, rows, options, columns });
    if (fail) return { error: { message: 'permission denied' } };
    const inserted = rows.filter(r => !records.has(r.id));
    inserted.forEach(r => records.set(r.id, r));
    if (lostResponse) { lostResponse = false; throw new Error('response lost'); }
    return { data: inserted.map(r => ({ id: r.id })) };
  } }) }) } };
}

test('one atomic batch saves drafts and a repeat upload leaves existing edits intact', async () => {
  const db = database();
  const ideas = parseIdeaDocument(IDEA_TEMPLATE, brands).ideas;
  const input = { sb: db.sb, workspaceId: 'ws', userId: 'me', brands, ideas };
  assert.deepEqual(await saveIdeaImport(input), { created: 2, skipped: 0 });
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].options.ignoreDuplicates, true);
  const first = [...db.records.values()][0];
  assert.equal(first.status, 'draft'); assert.equal(first.author_id, 'me');
  assert.match(first.id, /^[0-9a-f-]{14}8[0-9a-f]{3}-[89ab]/);
  first.title = 'Manual edit';
  assert.deepEqual(await saveIdeaImport({ ...input, userId: 'another-user' }), { created: 0, skipped: 2 });
  assert.equal(db.records.get(first.id).title, 'Manual edit');
  assert.deepEqual(await saveIdeaImport({ ...input, workspaceId: 'another-workspace' }), { created: 2, skipped: 0 });
});

test('lost response retries are idempotent and duplicate entries within a document are skipped', async () => {
  const db = database(); const idea = parseIdeaDocument(IDEA_TEMPLATE, brands).ideas[0];
  const input = { sb: db.sb, workspaceId: 'ws', userId: 'me', brands, ideas: [idea, idea] };
  db.loseResponse(); await assert.rejects(saveIdeaImport(input), /response lost/);
  assert.equal(db.records.size, 1);
  assert.deepEqual(await saveIdeaImport(input), { created: 0, skipped: 2 });
});

test('bad client or invalid item prevents the batch from being sent; permission errors are surfaced', async () => {
  const db = database(); const ideas = parseIdeaDocument(IDEA_TEMPLATE, brands).ideas;
  const input = { sb: db.sb, workspaceId: 'ws', userId: 'me', brands, ideas };
  await assert.rejects(saveIdeaImport({ ...input, ideas: [ideas[0], { ...ideas[1], brandId: 'foreign' }] }), /available client/);
  assert.equal(db.calls.length, 0);
  db.setFail(true); await assert.rejects(saveIdeaImport(input), /permission denied/);
  assert.equal(db.records.size, 0);
});
