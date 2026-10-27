// Offline regression checks against the real provider modules and connect/disconnect route.
// Run: node --test scripts/check-integrations.cjs
// All network and Vault calls are replaced below; this never uses workspace credentials.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the real TypeScript routes with offline boundary mocks. */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const load = Module._load;
let connected, role, rpcCalls, requests, failure, unavailable;
const session = {
  from: () => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { config: { retained: 'keep' } } }) };
    return query;
  },
  rpc: async (name, args) => {
    rpcCalls.push({ name, args });
    if (name === 'set_integration_secret') connected = {
      secret: args.p_secret || connected.secret,
      config: { ...args.p_config, keyHint: args.p_hint || connected?.config.keyHint },
    };
    if (name === 'clear_integration_secret') connected = null;
    return { error: null };
  },
};
const auth = {
  getMember: async () => role ? { ctx: { role, workspace_id: 'workspace-a' }, supabase: session } : null,
  isSuperAdmin: (m) => m?.ctx.role === 'super_admin',
  deny: (error, status = 403) => Response.json({ error }, { status }),
};
Module._load = function (name, parent, isMain) {
  if (name === 'server-only') return {};
  const absolute = name.startsWith('@/') ? path.join(root, name.slice(2))
    : name.startsWith('.') ? path.resolve(path.dirname(parent.filename), name) : name;
  if (absolute === path.join(root, 'lib/integrations/auth')) return auth;
  if (absolute === path.join(root, 'lib/integrations/secrets')) return {
    getIntegration: async () => { if (unavailable) throw new Error('Vault unavailable'); return connected && structuredClone(connected); },
    markChecked: async (...args) => rpcCalls.push({ name: 'markChecked', args }),
  };
  return load.call(this, name.startsWith('@/') ? absolute : name, parent, isMain);
};
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const { PROVIDERS } = require('../lib/integrations/registry.ts');
const { MODULES } = require('../lib/integrations/providers/index.ts');
const route = require('../app/api/integrations/[provider]/route.ts');
const channel = 'UC' + 'a'.repeat(22);
const fieldsFor = (def) => Object.fromEntries(def.fields.filter((f) => !f.optional).map((f) => [f.key, ({
  model: 'test-chat-model', boardId: '123456', projectId: 'project-1', botToken: 'xoxb-test-bot-token',
  channelIds: channel, webhookUrl: 'https://n8n.example.test/webhook/check',
})[f.key] || 'test-credential-' + f.key]));
const save = (id, fields) => route.POST(new Request('https://studio.example.test/api/integrations/' + id, {
  method: 'POST', body: JSON.stringify({ fields }), headers: { 'content-type': 'application/json' },
}), { params: Promise.resolve({ provider: id }) });

beforeEach(() => {
  connected = null; role = 'super_admin'; rpcCalls = []; requests = []; failure = null; unavailable = false;
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (failure) return failure(url, options);
    const u = new URL(url);
    if (u.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'refreshed-test-token',
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.metadata' });
    if (u.hostname === 'www.googleapis.com' && u.pathname === '/drive/v3/files') return Response.json({ files: [] });
    if (u.hostname === 'gmail.googleapis.com') return Response.json({ emailAddress: 'qa@example.test' });
    if (u.hostname === 'api.frame.io') return Response.json({ data: [{ id: 'frame-account' }] });
    if (u.hostname === 'api.anthropic.com') return Response.json({ id: 'test-chat-model' });
    if (u.hostname === 'api.openai.com') return Response.json({ id: 'test-chat-model' });
    if (u.hostname === 'generativelanguage.googleapis.com') return Response.json({ supportedGenerationMethods: ['generateContent'] });
    if (u.hostname === 'api.monday.com') return Response.json({ data: { boards: [{ id: '123456', name: 'QA',
      columns: [{ id: 'status', title: 'Status', type: 'status', settings: { labels: [{ id: 1, label: 'Done' }] } }] }] } });
    if (u.hostname === 'api.apify.com') return Response.json({ data: { id: 'test-user' } });
    if (u.hostname === 'api.browserbase.com') return Response.json({ id: 'project-1' });
    if (u.hostname === 'api.firecrawl.dev') return Response.json({ success: true, data: { remainingCredits: 10 } });
    if (u.hostname === 'slack.com') return Response.json({ ok: true, bot_id: 'bot-1' });
    if (u.hostname === 'www.googleapis.com' && u.pathname === '/youtube/v3/channels') return Response.json({
      items: [{ id: channel, snippet: { title: 'QA' }, contentDetails: { relatedPlaylists: { uploads: 'playlist-1' } } }] });
    if (u.hostname === 'api.buffer.com') return Response.json({ data: { account: { organizations: [{ id: 'org-1' }] } } });
    if (u.hostname === 'n8n.example.test') return new Response('accepted');
    throw new Error('Unexpected outbound URL: ' + u.origin + u.pathname);
  };
});

test('all 14 visible connectors have a module, credential fields and matching sync support', () => {
  assert.equal(PROVIDERS.length, 14);
  assert.equal(new Set(PROVIDERS.map((p) => p.id)).size, 14);
  for (const def of PROVIDERS) {
    assert.equal(typeof MODULES[def.id]?.verify, 'function', def.id);
    assert.ok(def.fields.some((f) => f.secret && !f.optional), def.id);
    assert.equal(!!def.canSync, !!MODULES[def.id].sync, def.id);
  }
});

for (const def of PROVIDERS) {
  test(def.name + ': verifies before saving, keeps secrets out of config and response', async () => {
    const fields = fieldsFor(def);
    const res = await save(def.id, fields);
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    assert.ok(requests.length > 0);
    const write = rpcCalls.find((r) => r.name === 'set_integration_secret');
    assert.ok(write);
    assert.equal(write.args.p_workspace, 'workspace-a');
    assert.equal(write.args.p_config.retained, 'keep');
    const payload = JSON.stringify({ config: write.args.p_config, response: await res.json() });
    for (const f of def.fields.filter((f) => f.secret && fields[f.key])) {
      assert.equal(write.args.p_secret[f.key], fields[f.key]);
      assert.ok(!payload.includes(fields[f.key]));
    }
  });
  test(def.name + ': missing credentials never connect', async () => {
    const res = await save(def.id, {});
    assert.equal(res.status, 400);
    assert.equal(requests.length, 0);
    assert.equal(rpcCalls.length, 0);
  });
  test(def.name + ': rejected credentials never overwrite a saved connection', async () => {
    const fields = fieldsFor(def);
    assert.equal((await save(def.id, fields)).status, 200);
    const prior = structuredClone(connected);
    rpcCalls = [];
    failure = () => Response.json({ ok: false, error: 'invalid_auth', errors: [{ message: 'invalid_auth' }] }, { status: 401 });
    const res = await save(def.id, fields);
    assert.equal(res.status, 400);
    assert.deepEqual(connected, prior);
    assert.equal(rpcCalls.length, 0);
  });
  test(def.name + ': blank secret fields keep saved credentials', async () => {
    assert.equal((await save(def.id, fieldsFor(def))).status, 200);
    const prior = structuredClone(connected.secret);
    rpcCalls = [];
    assert.equal((await save(def.id, Object.fromEntries(def.fields.filter((f) => f.secret).map((f) => [f.key, ''])))).status, 200);
    assert.deepEqual(connected.secret, prior);
    assert.equal(rpcCalls.find((r) => r.name === 'set_integration_secret').args.p_secret, null);
  });
  test(def.name + ': disconnect clears the Vault reference via the authorized RPC', async () => {
    assert.equal((await save(def.id, fieldsFor(def))).status, 200);
    const res = await route.DELETE(new Request('https://studio.example.test'), { params: Promise.resolve({ provider: def.id }) });
    assert.equal(res.status, 200);
    assert.equal(connected, null);
    assert.ok(rpcCalls.some((r) => r.name === 'clear_integration_secret' && r.args.p_provider === def.id));
  });
}

test('members and anonymous callers cannot save or disconnect any provider', async () => {
  for (const r of [null, 'editor', 'designer', 'client', 'sponsor']) {
    role = r;
    for (const def of PROVIDERS) {
      assert.equal((await save(def.id, fieldsFor(def))).status, 403);
      assert.equal((await route.DELETE(new Request('https://studio.example.test'), { params: Promise.resolve({ provider: def.id }) })).status, 403);
    }
  }
  assert.equal(requests.length, 0);
  assert.equal(rpcCalls.length, 0);
});
test('Vault failures stop the request instead of silently treating credentials as missing', async () => {
  unavailable = true;
  assert.equal((await save('openai', fieldsFor(PROVIDERS.find((p) => p.id === 'openai')))).status, 503);
  assert.equal(requests.length, 0);
});
test('provider errors cannot echo submitted secrets to the browser', async () => {
  const key = 'secret-key-that-must-not-appear';
  failure = () => Response.json({ error: { message: 'Rejected ' + key } }, { status: 400 });
  const res = await save('openai', { apiKey: key, model: 'test-chat-model' });
  assert.equal(res.status, 400);
  const body = await res.text();
  assert.ok(!body.includes(key));
  assert.ok(body.includes('[redacted]'));
});
test('Google credentials refresh on the server, carry scopes and never persist access tokens', async () => {
  const def = PROVIDERS.find((p) => p.id === 'drive');
  assert.equal((await save('drive', fieldsFor(def))).status, 200);
  const refresh = requests[0];
  assert.equal(refresh.url, 'https://oauth2.googleapis.com/token');
  assert.equal(refresh.options.body.get('grant_type'), 'refresh_token');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer refreshed-test-token');
  assert.ok(!JSON.stringify(connected).includes('refreshed-test-token'));
});
test('Google read-only or unrelated grants cannot masquerade as a ready connection', async () => {
  failure = () => Response.json({ access_token: 'test-token', scope: 'https://www.googleapis.com/auth/drive.readonly' });
  for (const id of ['drive', 'gmail']) {
    assert.equal((await save(id, fieldsFor(PROVIDERS.find((p) => p.id === id)))).status, 400);
  }
  assert.equal(rpcCalls.length, 0);
});
test('Frame.io rejects HTML, empty accounts and expired tokens', async () => {
  const fields = fieldsFor(PROVIDERS.find((p) => p.id === 'frame'));
  for (const response of [new Response('<html>error</html>'), Response.json({ data: [] }), Response.json({}, { status: 401 })]) {
    failure = () => response.clone();
    assert.equal((await save('frame', fields)).status, 400);
  }
  assert.equal(rpcCalls.length, 0);
});
test('Firecrawl accepts only its documented missing-usage 404, rejects generic 404/HTML', async () => {
  const fields = fieldsFor(PROVIDERS.find((p) => p.id === 'firecrawl'));
  for (const response of [new Response('Not Found', { status: 404 }), new Response('<html>error</html>'), Response.json({ success: false })]) {
    failure = () => response.clone();
    assert.equal((await save('firecrawl', fields)).status, 400);
  }
  failure = () => Response.json({ success: false, error: 'Could not find credit usage information' }, { status: 404 });
  assert.equal((await save('firecrawl', fields)).status, 200);
});
