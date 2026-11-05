/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS test harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => mocks[name] || require(name), mod, mod.exports);
  return mod.exports;
}
const context = load('lib/auth/setup-context.ts');

test('setup proof expires and rejects tampering, wrong keys, users, sessions, and invite tokens', () => {
  const value = context.signSetupContext('user-a', 'session-a', 'invite-a', 'secret', 1000);
  const parsed = context.readSetupContext(value, 'secret', 2000);
  assert.ok(context.matchesSetupContext(parsed, 'user-a', 'session-a', 'invite-a'));
  assert.ok(context.matchesSetupContext(parsed, 'user-a', 'session-a'));
  assert.equal(context.matchesSetupContext(parsed, 'user-b', 'session-a'), false);
  assert.equal(context.matchesSetupContext(parsed, 'user-a', 'session-b'), false);
  assert.equal(context.matchesSetupContext(parsed, 'user-a', 'session-a', 'invite-b'), false);
  assert.equal(context.readSetupContext(value, 'wrong', 2000), null);
  assert.equal(context.readSetupContext(value + 'x', 'secret', 2000), null);
  assert.equal(context.readSetupContext(value, 'secret', 1000 + context.SETUP_TTL * 1000), null);
  assert.equal(context.readSetupContext('malformed', 'secret'), null);
});

function fixture() {
  const jar = new Map();
  let session = null;
  let verifyCalls = 0;
  let updateCalls = 0;
  let rejectPassword = true;
  const sb = { auth: {
    getClaims: async () => ({ data: { claims: session } }),
    getUser: async () => ({ data: { user: session ? { id: session.sub } : null } }),
    verifyOtp: async () => {
      verifyCalls++;
      if (verifyCalls > 1) return { error: { message: 'Token already consumed' }, data: {} };
      session = { sub: 'invited-user', session_id: 'invite-session' };
      return { data: { user: { id: session.sub }, session: {} } };
    },
    updateUser: async () => {
      updateCalls++;
      return rejectPassword ? { error: { message: 'Password rejected by policy' } } : { error: null };
    },
  } };
  const { POST } = load('app/api/auth/setup/route.ts', {
    'next/headers': { cookies: async () => ({ get: (key) => jar.get(key), set: (key, value, options) => { if (options.maxAge === 0) jar.delete(key); else jar.set(key, { value }); } }) },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/supabase/server': { supabaseServer: async () => sb },
    '@/lib/auth/setup-context': context,
  });
  return {
    send: (body, origin = 'https://studio.example') => POST(new Request('https://studio.example/api/auth/setup', {
      method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })),
    setSession: (value) => { session = value; },
    acceptPassword: () => { rejectPassword = false; },
    counts: () => ({ verifyCalls, updateCalls }),
  };
}

process.env.SUPABASE_SECRET_KEY = 'test-secret-only';
process.env.APP_BASE_URL = 'https://studio.example';

test('page resume does not consume a token; rejected password retries and refresh resume use the verified session', async () => {
  const f = fixture();
  assert.deepEqual(await (await f.send({ action: 'resume', tokenHash: 'token' })).json(), { verified: false });
  assert.equal(f.counts().verifyCalls, 0);
  assert.equal((await f.send({ action: 'verify', tokenHash: 'token' })).status, 200);
  assert.equal((await f.send({ action: 'password', tokenHash: 'token', password: 'test-password' })).status, 400);
  // A refreshed browser has no email token in its URL, but keeps the signed HTTP-only context.
  assert.deepEqual(await (await f.send({ action: 'resume' })).json(), { verified: true });
  f.acceptPassword();
  assert.equal((await f.send({ action: 'password', password: 'test-password' })).status, 200);
  assert.deepEqual(f.counts(), { verifyCalls: 1, updateCalls: 2 });
  assert.deepEqual(await (await f.send({ action: 'resume' })).json(), { verified: false });
  assert.equal((await f.send({ action: 'password', password: 'test-password' })).status, 401);
});

test('ordinary sessions, account switches, mismatched tokens, and cross-origin requests cannot save passwords', async () => {
  const f = fixture();
  f.setSession({ sub: 'other-user', session_id: 'other-session' });
  assert.equal((await f.send({ action: 'password', password: 'test-password' })).status, 401);
  assert.equal((await f.send({ action: 'verify', tokenHash: 'token' }, 'https://elsewhere.example')).status, 403);
  assert.equal(f.counts().verifyCalls, 0);
  await f.send({ action: 'verify', tokenHash: 'token' });
  assert.equal((await f.send({ action: 'password', tokenHash: 'wrong', password: 'test-password' })).status, 401);
  f.setSession({ sub: 'other-user', session_id: 'other-session' });
  assert.deepEqual(await (await f.send({ action: 'resume' })).json(), { verified: false });
  assert.equal((await f.send({ action: 'password', password: 'test-password' })).status, 401);
  assert.equal(f.counts().updateCalls, 0);
});
