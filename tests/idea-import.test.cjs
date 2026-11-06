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
const { parseIdeaDocument, IDEA_TEMPLATE, validateImportIdea, decodeImportFile } = load('lib/ideas/import-document.js');
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
  for (const raw of ['', 'x'.repeat(250001), '{bad', 'ordinary prose without headings', '[]', JSON.stringify(Array.from({ length: 101 }, () => ({ title: 'One' })))]) assert.throws(() => parseIdeaDocument(raw, brands));
  // Per-idea problems are flagged on that idea rather than rejecting the document.
  const unsafe = parseIdeaDocument(JSON.stringify({ title: 'One', references: ['javascript:alert(1)', 'https://ok.example'] }), brands).ideas[0];
  assert.deepEqual(unsafe.refs, ['https://ok.example']); assert.match(unsafe.warnings[0], /not an http/);
  const long = parseIdeaDocument(JSON.stringify([{ title: 'One', body: 'x'.repeat(30001) }, { title: 'Two' }]), brands).ideas;
  assert.equal(long[0].body.length, 30001); assert.match(long[0].error, /Content is 30,001 characters/); assert.equal(long[1].error, '');
  assert.throws(() => parseIdeaDocument(JSON.stringify([{ title: 'Fine' }, { title: 'Bad', hook: 5 }]), brands), /Idea 2 “Bad”: Hook must be text/);
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
  await assert.rejects(saveIdeaImport({ ...input, ideas: [ideas[0], { ...ideas[1], hook: 'x'.repeat(25) }] }), err => err.permanent && /^Idea 2 “A studio tour in 60 seconds”: Cover hook/.test(err.message));
  db.setFail(true); await assert.rejects(saveIdeaImport(input), err => err.permanent && /permission to add ideas/.test(err.message));
  assert.equal(db.records.size, 0);
});

test('long spoken hooks stay in the content instead of failing the import', () => {
  const raw = 'Client: POD HUT\n## Idea 1: Cost myth\nDescription: Walk the floor.\nHook: PEOPLE THINK STARTING A CLOTHING BRAND COSTS $80K\n### Script\nTalk.\n## Idea 2: Pizza\nHook: OUR PRINTS ARE SO REAL';
  const { ideas } = parseIdeaDocument(raw, brands);
  assert.equal(ideas[0].hook, '');
  assert.match(ideas[0].hookWarning, /24-character/);
  assert.match(ideas[0].body, /COSTS \$80K/);
  assert.equal(ideas[1].hook, 'OUR PRINTS ARE SO REAL');
  assert.equal(ideas[1].hookWarning, '');
  const json = parseIdeaDocument(JSON.stringify({ title: 'One', description: 'Body', hook: 'A HOOK THAT IS FAR TOO LONG FOR A COVER' }), brands).ideas[0];
  assert.equal(json.hook, '');
  assert.match(json.body, /Hook: A HOOK THAT IS FAR TOO LONG/);
  assert.throws(() => validateImportIdea({ ...ideas[1], hook: 'x'.repeat(25) }), /hook/);
});

test('plain-text "Idea N:" lines split ideas when the document has no Markdown headings', () => {
  const raw = 'POD HUT Shoot List\nClient: POD HUT\nIdea 1: First\nDescription: One https://example.com/a\nScript\nSay it.\nTitle options\n\n* Option A\n* Option B\n\nThumbnail direction\nBold text.\nIdea 2: Second\nDescription: Two';
  const { ideas } = parseIdeaDocument(raw, brands);
  assert.deepEqual(ideas.map(i => i.title), ['First', 'Second']);
  assert.equal(ideas[0].brandId, 'pod');
  assert.deepEqual(ideas[0].titleOptions, ['Option A', 'Option B']);
  assert.equal(ideas[0].thumbnailBrief, 'Bold text.');
  // A heading-based document is not re-split by an "Idea 2:" mention inside its content.
  assert.equal(parseIdeaDocument('## One\nIdea 2: see the other video\n## Two\nBody', brands).ideas.length, 2);
});

test('oversized fields are fitted per idea without losing text, and documents still import', () => {
  const ok = 'Client: POD HUT\n## Idea 1: Fine\nDescription: ok\n';
  const many = parseIdeaDocument(ok + '## Idea 2: Options\n### Title options\n' + Array.from({ length: 15 }, (_, i) => '- Option ' + i).join('\n'), brands).ideas[1];
  assert.equal(many.titleOptions.length, 12); assert.match(many.body, /Option 14/); assert.equal(many.error, '');
  const note = parseIdeaDocument(ok + '## Idea 2: Note\nTitle options:\n' + 'A long note about the title. '.repeat(12), brands).ideas[1];
  assert.deepEqual(note.titleOptions, []); assert.match(note.warnings[0], /over 300/); assert.equal(note.error, '');
  const links = parseIdeaDocument(ok + '## Idea 2: Links\n' + Array.from({ length: 35 }, (_, i) => 'https://example.com/' + i).join('\n'), brands).ideas[1];
  assert.equal(links.refs.length, 30); assert.match(links.body, /example.com\/34/); assert.equal(links.error, '');
  const title = parseIdeaDocument('Idea 1: ' + 'Long title words '.repeat(25) + '\nDescription: x\nIdea 2: Short', brands).ideas[0];
  assert.ok(title.title.length <= 300 && title.title.endsWith('…')); assert.match(title.body, /Full title:/); assert.equal(title.error, '');
  const shared = parseIdeaDocument('Client: POD HUT\n' + 'Shared brief line. '.repeat(1700) + '\n' + '## One\nBody\n## Two\nBody', brands).ideas;
  assert.ok(shared.every(i => !i.error && i.body.length <= 30000 && i.brandId === 'pod')); assert.match(shared[0].warnings[0], /shared notes/);
  const transcript = parseIdeaDocument(ok + '## Idea 2: Transcript\n' + 'word '.repeat(7000), brands).ideas;
  assert.equal(transcript[0].error, ''); assert.match(transcript[1].error, /Content is 3\d,\d{3} characters/);
  assert.deepEqual(parseIdeaDocument(ok + '## Idea 2: Bold\nReference: **https://instagram.com/x**, and _https://a.example/b_.', brands).ideas[1].refs, ['https://instagram.com/x', 'https://a.example/b']);
});

test('uploaded files decode from UTF-8, UTF-16 and Windows-1252', () => {
  const doc = 'Client: POD HUT\n## Idea 1: Café “quotes”\nBody';
  const utf16 = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(doc, 'utf16le')]);
  assert.equal(decodeImportFile(utf16), doc);
  assert.equal(decodeImportFile(Buffer.from(doc, 'utf16le')), doc);
  assert.equal(decodeImportFile(Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(doc)])), doc);
  assert.equal(decodeImportFile(Buffer.from([0x43, 0x61, 0x66, 0xE9, 0x20, 0x93, 0x71, 0x94])), 'Café “q”');
  assert.equal(parseIdeaDocument(decodeImportFile(utf16), brands).ideas[0].title, 'Café “quotes”');
});
