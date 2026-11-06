/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
// AI usage: token rows are split so cache tokens are priced once, and costs come from defaults or overrides.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => (name === 'server-only' ? {} : mocks[name] || require(name)), mod, mod.exports);
  return mod.exports;
}

const pricing = load('lib/ai/pricing.ts');
const usage = load('lib/ai/usage.ts', { '@/lib/supabase/admin': { supabaseAdmin: () => ({}) } });

test('usage rows keep cache tokens out of input', () => {
  const row = usage.usageRow({ workspaceId: 'w', feature: 'assistant', provider: 'anthropic', model: 'claude-sonnet-5-5',
    usage: { inputTokens: 1000, inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: 600, cacheWriteTokens: 100 }, outputTokens: 50, outputTokenDetails: { reasoningTokens: 20 } } });
  assert.equal(row.input_tokens, 300);
  assert.equal(row.cache_read_tokens, 600);
  assert.equal(row.cache_write_tokens, 100);
  assert.equal(row.output_tokens, 50);
  assert.equal(row.reasoning_tokens, 20);
});

test('claude defaults price by longest prefix, overrides win, unknown models stay unpriced', () => {
  const p = pricing.priceFor('anthropic', 'claude-sonnet-5-5');
  assert.equal(p.source, 'default');
  assert.equal(pricing.costOf({ input: 1e6, cacheRead: 1e6, cacheWrite: 0, output: 1e6, images: 0 }, p.price), 2 + 0.2 + 10);
  assert.equal(pricing.priceFor('anthropic', 'claude-sonnet-5-20260101').price.in, 2);
  assert.equal(pricing.priceFor('openai', 'gpt-6.1-sol').source, 'none');
  const o = pricing.priceFor('openai', 'gpt-image-2', { 'openai:gpt-image-2': { image: 0.04 } });
  assert.equal(o.source, 'custom');
  assert.equal(pricing.costOf({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0, images: 3 }, o.price), 0.12);
  assert.equal(pricing.costOf({ input: 10, cacheRead: 0, cacheWrite: 0, output: 0, images: 0 }, o.price), null);
});

test('price input is cleaned', () => {
  assert.deepEqual(pricing.cleanPrice({ in: '2', out: 10, cacheRead: '' }), { in: 2, out: 10 });
  assert.equal(pricing.cleanPrice({ in: -1 }), null);
  assert.equal(pricing.cleanPrice({}), null);
});
