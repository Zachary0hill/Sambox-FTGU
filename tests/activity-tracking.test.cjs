const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(resolve(__dirname, '../lib/activity-tracking.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function setup() {
  let now = 100000, nextId = 1, calls = 0;
  const timers = new Map(), listeners = new Map();
  const addEventListener = (name, fn) => listeners.set(name, fn);
  const removeEventListener = (name) => listeners.delete(name);
  const document = { visibilityState: 'visible', hasFocus: () => true, addEventListener, removeEventListener };
  const window = { addEventListener, removeEventListener };
  const exports = {};
  runInNewContext(source, { exports, document, window, Date: { now: () => now }, Promise,
    setTimeout: (fn, delay) => { const id = nextId++; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
  });
  const stop = exports.startActivityTracking(async () => { calls++; });
  return { document, stop, count: () => calls, listeners,
    emit: (name, trusted = true) => listeners.get(name)?.({ isTrusted: trusted }),
    tick: async (ms) => { now += ms; for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); } await Promise.resolve(); },
  };
}
test('records a visible visit once, with no idle heartbeat', async () => {
  const h = setup(); await h.tick(0); assert.equal(h.count(), 1);
  await h.tick(600000); assert.equal(h.count(), 1); h.stop();
});
test('throttles real interaction but delivers a trailing update', async () => {
  const h = setup(); await h.tick(0);
  for (let i = 0; i < 20; i++) h.emit('pointermove');
  await h.tick(59000); assert.equal(h.count(), 1);
  await h.tick(1000); assert.equal(h.count(), 2);
  await h.tick(60000); assert.equal(h.count(), 2); h.stop();
});
test('hidden or unfocused tabs discard queued activity', async () => {
  const h = setup(); await h.tick(0); h.emit('keydown');
  h.document.visibilityState = 'hidden'; h.emit('visibilitychange');
  h.emit('pointermove'); await h.tick(120000); assert.equal(h.count(), 1);
  h.document.visibilityState = 'visible'; h.document.hasFocus = () => false;
  h.emit('visibilitychange'); await h.tick(60000); assert.equal(h.count(), 1);
  h.document.hasFocus = () => true; h.emit('focus'); await h.tick(0); assert.equal(h.count(), 2); h.stop();
});
test('scripted events and cleanup do not report activity', async () => {
  const h = setup(); await h.tick(0); await h.tick(120000);
  h.emit('pointerdown', false); await h.tick(0); assert.equal(h.count(), 1);
  h.emit('keydown'); h.stop(); await h.tick(120000); assert.equal(h.count(), 1);
  assert.equal(h.listeners.size, 0);
});
