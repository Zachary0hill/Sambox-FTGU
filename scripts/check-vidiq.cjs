// Offline regression checks: node --test scripts/check-vidiq.cjs
// Only the MCP boundary is mocked; no credentials or paid provider calls are used.
/* eslint-disable @typescript-eslint/no-require-imports -- Load the real TypeScript modules with an offline MCP client. */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
let definitions, calls, closed, listError;
const client = {
  listTools: async () => { if (listError) throw listError; return { tools: definitions }; },
  callTool: async (request) => {
    calls.push(request);
    return { content: [{ type: 'text', text: JSON.stringify({ videos: [{ title: 'Example outlier', videoId: 'abcdefghijk' }] }) }] };
  },
  close: async () => { closed++; },
};
function loadTs(relative) {
  const filename = path.join(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (name) => {
    if (name === 'server-only') return {};
    if (name === '@ai-sdk/mcp') return { createMCPClient: async () => client };
    if (/providers\/(apify|browserbase|firecrawl|virlo)$/.test(name)) return {};
    if (name.startsWith('@/')) return loadTs(name.slice(2) + '.ts');
    if (name.startsWith('.')) return loadTs(path.relative(root, path.resolve(path.dirname(filename), name)) + '.ts');
    return Module.prototype.require.call(mod, name);
  };
  cache.set(filename, mod);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
  return mod.exports;
}
const ORIGINAL_CALL = client.callTool;
const { default: provider, vidiqTools, vidiqToolNames, DEFAULT_TOOLS } = loadTs('lib/integrations/providers/vidiq.ts');
const { runSource } = loadTs('lib/research/sources.ts');
const definition = (name, destructiveHint = false) => ({
  name, inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  annotations: { destructiveHint },
});
beforeEach(() => {
  definitions = ['vidiq_keyword_research', 'vidiq_outliers', 'vidiq_trending_videos', 'vidiq_subscriber_insights', 'vidiq_video_transcript'].map((name) => definition(name));
  calls = []; closed = 0; listError = null;
});

test('default connection accepts the prefixed catalog shown in the failure without spending credits', async () => {
  assert.equal(await provider.verify({ apiKey: 'offline-test' }, {}), null);
  assert.equal(calls.length, 0);
  assert.equal(closed, 1);
  assert.ok(DEFAULT_TOOLS.every((name) => name.startsWith('vidiq_')));
});
test('old saved names and canonical names resolve to the same deduplicated selection', async () => {
  const config = { tools: 'outliers, vidiq_outliers, video_transcript' };
  assert.deepEqual(vidiqToolNames(config), ['vidiq_outliers', 'vidiq_video_transcript']);
  assert.equal(await provider.verify({ apiKey: 'offline-test' }, config), null);
  assert.deepEqual(Object.keys(await vidiqTools(client, config)), ['vidiq_outliers', 'vidiq_video_transcript']);
});
test('assistant exposes one prefix, keeps the allowlist and calls the exact advertised tool', async () => {
  definitions.push(definition('vidiq_channel_stats'));
  const tools = await vidiqTools(client, {});
  assert.equal(tools.vidiq_vidiq_outliers, undefined);
  assert.equal(tools.vidiq_channel_stats, undefined);
  const result = await tools.vidiq_outliers.execute({ query: 'woodworking' });
  assert.equal(calls[0].name, 'vidiq_outliers');
  assert.deepEqual(calls[0].arguments, { query: 'woodworking' });
  assert.equal(result.source, 'vidIQ');
  assert.match(result.untrusted, /Example outlier/);
});
test('unknown or destructive-only selections cannot produce a connected state', async () => {
  definitions.push(definition('vidiq_delete_video', true));
  for (const tools of ['does_not_exist', 'delete_video']) {
    assert.match(await provider.verify({ apiKey: 'offline-test' }, { tools }), /None of these tools exist/);
    assert.deepEqual(await vidiqTools(client, { tools }), {});
  }
  assert.equal(calls.length, 0);
});
test('legacy unprefixed server catalogs still call the advertised name', async () => {
  definitions = [definition('outliers')];
  assert.equal(await provider.verify({ apiKey: 'offline-test' }, {}), null);
  const tools = await vidiqTools(client, {});
  await tools.vidiq_outliers.execute({ query: 'woodworking' });
  assert.equal(calls[0].name, 'outliers');
});
test('verification closes the client on a catalog failure', async () => {
  listError = new Error('401 Unauthorized');
  assert.match(await provider.verify({ apiKey: 'offline-test' }, {}), /rejected the API key/);
  assert.equal(closed, 1);
});
test('research discovers and calls prefixed outliers and normalizes its results', async () => {
  const findings = await runSource('vidiq', { vidiq: { secret: { apiKey: 'offline-test' }, config: {} } }, {
    topics: ['woodworking'], deadline: Date.now() + 120000, cancelled: async () => false,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'vidiq_outliers');
  assert.deepEqual(calls[0].arguments, { query: 'woodworking' });
  assert.equal(findings[0].title, 'Example outlier');
  assert.equal(findings[0].source, 'vidiq');
  assert.equal(closed, 1);
});

// The live server (Nov 2026) answers as {"answer": "<markdown>"} with video IDs in backticks and no watch links.
const LIVE_ANSWER = JSON.stringify({ answer: [
  'Found 2 breakout long-form videos for "woodworking".', '',
  '### 1. I built a $40 workbench', '- **Channel:** Shop_Notes · 22.2K subscribers · US · channelId `UCSdlDtyIkMl8lIf0tL9fxEg`',
  '- **Performance:** 11.5K views · 1.8x breakout · 9.9 views/hour · 1.0% engagement', '- **Details:** published 2026-09-14 (1 month ago) · 1:36',
  '- **Video:** videoId `eccZT0iZ6Qs` · thumbnail https://i.ytimg.com/vi/eccZT0iZ6Qs/maxresdefault.jpg', '',
  '### 2. Hand tools only', '- **Channel:** Derrek Pearson · 3.6K subscribers · channelId `UC9ZcCMe4RziTRYRjM1UM5kQ`',
  '- **Performance:** 3.9K views · 33x breakout · 1.2 views/hour · 2.7% engagement', '- **Details:** published 2026-06-25 (4 months ago) · 31:43',
  '- **Video:** videoId `DQey3nyfWRw` · thumbnail https://i.ytimg.com/vi/DQey3nyfWRw/maxresdefault.jpg', '- **Trend categories:** full_episode',
].join('\n'), _credits: { used: 5 } });
test('research reads videos out of the live markdown answer', async () => {
  definitions = [{ name: 'vidiq_outliers', inputSchema: { type: 'object', properties: { keyword: { type: 'string' }, seedVideoId: { type: 'string' } } }, annotations: {} }];
  client.callTool = async (request) => { calls.push(request); return { content: [{ type: 'text', text: LIVE_ANSWER }] }; };
  try {
    const findings = await runSource('vidiq', { vidiq: { secret: { apiKey: 'offline-test' }, config: {} } }, {
      topics: ['woodworking'], deadline: Date.now() + 120000, cancelled: async () => false,
    });
    assert.deepEqual(calls[0].arguments, { keyword: 'woodworking' });
    assert.equal(findings.length, 2);
    assert.deepEqual(findings[0], {
      source: 'vidiq', topic: 'woodworking', title: 'I built a $40 workbench', url: 'https://www.youtube.com/watch?v=eccZT0iZ6Qs',
      author: 'Shop_Notes', views: 11500, date: '2026-09-14', thumb: 'https://i.ytimg.com/vi/eccZT0iZ6Qs/maxresdefault.jpg', snippet: 'Outlier score 1.8x',
    });
    assert.equal(findings[1].views, 3900);
    assert.equal(findings[1].snippet, 'Outlier score 33x');
  } finally {
    client.callTool = ORIGINAL_CALL;
  }
});
