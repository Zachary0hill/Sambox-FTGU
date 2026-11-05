/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node test harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => name === 'server-only' ? {} : mocks[name] || require(name), mod, mod.exports);
  return mod.exports;
}
const { assignedToMember, memberQueuePatch } = load('lib/studio/member-queue.js');
test('personal queue uses the correct role and stable identity, even with duplicate names', () => {
  const row = { editor: 'Sam', designer: 'Sam', editorId: 'editor-a', designerId: 'designer-b' };
  assert.equal(assignedToMember(row, 'editor', 'editor-a'), true);
  assert.equal(assignedToMember(row, 'editor', 'designer-b'), false);
  assert.equal(assignedToMember(row, 'designer', 'designer-b'), true);
  assert.equal(assignedToMember(row, 'designer', 'editor-a'), false);
  assert.equal(assignedToMember({}, 'editor', undefined), false);
  assert.equal(assignedToMember(row, 'client', 'editor-a'), false);
});
test('queue entry clears obstructing filters without mutating saved preferences', () => {
  const saved = { filter: { rules: ['old'] }, advanced: { items: ['old'] }, widths: { project: 250 }, hideEmpty: true };
  const state = { vs: { 'editor:list': { sorts: [] } }, person: 'Someone else', q: 'old', unreadOnly: true };
  const patch = memberQueuePatch(state, 'editor:table', saved);
  assert.equal(patch.person, '__me'); assert.equal(patch.nav, 'projects'); assert.equal(patch.q, ''); assert.equal(patch.unreadOnly, false);
  assert.equal(patch.vs['editor:table'].filter, null); assert.equal(patch.vs['editor:table'].advanced, null);
  assert.deepEqual(saved.filter.rules, ['old']); assert.deepEqual(patch.vs['editor:table'].widths, { project: 250 });
  assert.deepEqual(patch.vs['editor:list'], state.vs['editor:list']);
});
test('readiness distinguishes missing diagnostics permission from an unverified domain and redacts failures', async () => {
  const keys = ['APP_BASE_URL','EMAIL_FROM','RESEND_API_KEY']; const old = Object.fromEntries(keys.map(k => [k,process.env[k]]));
  try {
    process.env.APP_BASE_URL = 'https://studio.example'; process.env.EMAIL_FROM = 'Studio <onboarding@studio.example>'; process.env.RESEND_API_KEY = 'private-test-key';
    let result = { error: { message: 'private-provider-detail' } };
    const { emailReadiness } = load('lib/email/readiness.ts', {
      './send': { emailHealth: () => ({ configured: true, sandboxSender: false, webhookConfigured: true }) },
      resend: { Resend: class { domains = { list: async () => result }; } },
    });
    const unknown = await emailReadiness(); assert.equal(unknown.domainStatus, 'unknown'); assert.equal(unknown.canonicalUrl, 'https://studio.example');
    assert.doesNotMatch(JSON.stringify(unknown), /private-/);
    result = { data: { data: [{ name:'studio.example',status:'verified',capabilities:{sending:'enabled'} }], has_more:false } };
    assert.equal((await emailReadiness()).domainStatus, 'verified');
    result.data.data[0].status = 'pending'; assert.equal((await emailReadiness()).domainStatus, 'unverified');
    result = { data: { data: [], has_more: true } }; assert.equal((await emailReadiness()).domainStatus, 'unknown');
    for (const url of ['http://studio.example','https://studio.example/old','https://user:secret@studio.example','https://studio.example?token=secret']) {
      process.env.APP_BASE_URL=url; assert.equal((await emailReadiness()).canonicalUrl,null);
    }
  } finally { for (const k of keys) if (old[k] === undefined) delete process.env[k]; else process.env[k]=old[k]; }
});

test('authentication destinations reject external, protocol-relative and backslash redirects', () => {
  const { safeAuthNext } = load('lib/auth/safe-next.ts');
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/\tevil.example', 'javascript:alert(1)', null]) assert.equal(safeAuthNext(value), '/');
  assert.equal(safeAuthNext('/auth/setup?type=recovery'), '/auth/setup?type=recovery');
  assert.equal(safeAuthNext('/projects?view=table'), '/projects?view=table');
});

test('callback uses the public origin behind Railway and preserves recovery destination', async () => {
  const old = process.env.APP_BASE_URL; process.env.APP_BASE_URL = 'https://studio.example';
  try {
    const { safeAuthNext } = load('lib/auth/safe-next.ts');
    const { GET } = load('app/auth/callback/route.ts', {
      'next/server': { NextResponse: { redirect: (url) => Response.redirect(url) } },
      '@/lib/auth/safe-next': { safeAuthNext },
      '@/lib/supabase/server': { supabaseServer: async () => ({ auth: { exchangeCodeForSession: async () => ({ error: null }) } }) },
    });
    const response = await GET(new Request('http://localhost:8080/auth/callback?code=test&next=%2Fauth%2Fsetup%3Ftype%3Drecovery'));
    assert.equal(response.headers.get('location'), 'https://studio.example/auth/setup?type=recovery');
    const malicious = await GET(new Request('http://localhost:8080/auth/callback?code=test&next=%2F%5Cevil.example'));
    assert.equal(malicious.headers.get('location'), 'https://studio.example/');
    const missing = await GET(new Request('http://localhost:8080/auth/callback'));
    assert.equal(missing.headers.get('location'), 'https://studio.example/login?error=link');
  } finally { if (old === undefined) delete process.env.APP_BASE_URL; else process.env.APP_BASE_URL = old; }
});
