/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node test harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createHmac } = require('node:crypto');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => name === 'server-only' ? {} : mocks[name] || require(name), mod, mod.exports);
  return mod.exports;
}
const opts = { workspaceId: 'ws', actorId: 'admin', email: 'test@example.test', name: 'Test', role: 'editor', workspace: 'Studio', inviter: 'Admin', baseUrl: 'https://studio.example' };
function deliveryFixture({ cooldown = false, errorCode = '', confirmed = true, sendFails = false, recordFails = false } = {}) {
  const calls = []; let sent = 0; let generates = 0;
  const admin = {
    rpc: async (name, args) => { calls.push([name,args]); return name === 'reserve_invite_delivery' ? { data: 'attempt', error: cooldown ? { message: 'Wait 60 seconds' } : null } : { error: recordFails ? { message: 'db unavailable' } : null }; },
    from: () => ({ update: (args) => { calls.push(['update',args]); return { eq: () => ({ eq: async () => ({}) }) }; } }),
    auth: { admin: { generateLink: async (args) => {
      calls.push(['generate',args]); generates++;
      if (errorCode && generates === 1) return { error: { code: errorCode, message: 'Authentication error' } };
      return { data: { user: { email_confirmed_at: confirmed ? '2026-01-01' : null }, properties: { hashed_token: 'private-token', verification_type: args.type } } };
    } } },
  };
  const mod = load('lib/email/invite.ts', {
    '@/lib/supabase/admin': { supabaseAdmin: () => admin },
    './send': { sendEmail: async () => { sent++; return sendFails ? { sent: false, error: 'Provider error' } : { sent: true, id: 'provider-id' }; } },
    './invite-template': { buildInviteEmail: () => ({ subject: 'Invite', html: 'Email', text: 'Email' }) },
  });
  return { deliver: () => mod.deliverInvite(opts), calls, sent: () => sent };
}
test('cooldown prevents token generation and email submission', async () => {
  const f = deliveryFixture({ cooldown: true }); await assert.rejects(f.deliver(), /Wait 60/);
  assert.equal(f.sent(), 0); assert.equal(f.calls.length, 1);
});
test('only existing-account errors fall back, and unconfirmed accounts still get password setup', async () => {
  const failure = deliveryFixture({ errorCode: 'unexpected_failure' });
  await assert.rejects(failure.deliver()); assert.equal(failure.sent(), 0);
  assert.equal(failure.calls.filter(([n]) => n === 'generate').length, 1);
  const existing = deliveryFixture({ errorCode: 'email_exists', confirmed: false });
  const result = await existing.deliver();
  assert.equal(result.existingUser, false);
  assert.equal(new URL(result.link).searchParams.get('type'), 'magiclink');
  assert.equal(new URL(result.link).searchParams.get('setup'), 'password');
  assert.equal(existing.sent(), 1);
});
test('submission failures persist safe summaries; accepted mail is not labeled failed when recording fails', async () => {
  const failed = deliveryFixture({ sendFails: true }); await failed.deliver();
  const finish = failed.calls.find(([n]) => n === 'finish_invite_delivery')[1];
  assert.equal(finish.p_provider, null); assert.ok(finish.p_error); assert.equal(JSON.stringify(finish).includes('private-token'), false);
  const recording = deliveryFixture({ recordFails: true }); await assert.rejects(recording.deliver(), /provider before retrying/);
  assert.equal(recording.sent(), 1); assert.equal(recording.calls.some(([n]) => n === 'update'), false);
});

test('welcome automatically enrolls only new eligible members and respects role capabilities', () => {
  const Welcome = load('components/studio/MemberWelcome.jsx').default;
  const base = { sb: {}, ctx: { role: 'editor', user_id: 'editor', workspace_name: 'Studio', perms: [['edits','edit'],['assets','create']] }, D: { rows: [], myMembership: { onboarding_required: true }, brands: [] }, nav: 'projects', children: React.createElement('p', null, 'Dashboard') };
  const markup = renderToStaticMarkup(React.createElement(Welcome, base));
  assert.match(markup, /Your account is ready/); assert.match(markup, /upload a cut/);
  const designer = renderToStaticMarkup(React.createElement(Welcome, { ...base, ctx: { ...base.ctx, role: 'designer', perms: [] } }));
  assert.match(designer, /view-only for work status/); assert.match(designer, /does not include uploads/);
  const existing = renderToStaticMarkup(React.createElement(Welcome, { ...base, D: { ...base.D, myMembership: { onboarding_required: false } }, nav: 'settings' }));
  assert.match(existing, /Getting started as/); assert.match(existing, /Dashboard/); assert.doesNotMatch(existing, /Your account is ready/);
  const completed = renderToStaticMarkup(React.createElement(Welcome, { ...base, D: { ...base.D, myMembership: { onboarding_required: true, onboarding_completed_at: 'now' } } }));
  assert.equal(completed, '<p>Dashboard</p>');
});

test('Resend webhook rejects bad signatures and records only authenticated supported events', async () => {
  const secretBytes = Buffer.from('local-test-webhook-secret-only');
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_' + secretBytes.toString('base64');
  const writes = [];
  const { POST } = load('app/api/webhooks/resend/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc: async (name, args) => { writes.push([name,args]); return {}; } }) },
  });
  const payload = JSON.stringify({ type: 'email.delivered', created_at: new Date().toISOString(), data: { email_id: 'msg-1' } });
  const stamp = String(Math.floor(Date.now()/1000)); const id = 'evt-test';
  const signature = 'v1,' + createHmac('sha256',secretBytes).update(`${id}.${stamp}.${payload}`).digest('base64');
  const req = (sig) => new Request('https://studio.example/api/webhooks/resend', { method: 'POST', headers: { 'svix-id': id, 'svix-timestamp': stamp, 'svix-signature': sig }, body: payload });
  assert.equal((await POST(req('invalid'))).status, 400); assert.equal(writes.length, 0);
  assert.equal((await POST(req(signature))).status, 200); assert.equal(writes[0][1].p_status, 'delivered');
});

test('active-member access endpoint rejects non-admin and deactivated recipients without sending', async () => {
  let role = 'editor'; let sent = 0;
  const { POST } = load('app/api/invites/access/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/supabase/server': { supabaseServer: async () => ({ rpc: async () => ({ data: { role, workspace_id: 'ws' } }), from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'editor', status: 'deactivated' } }) }) }) }) }) }) },
    '@/lib/email/invite': { deliverInvite: async () => { sent++; }, baseUrlFor: () => '' },
  });
  const req = () => new Request('https://studio.example/api/invites/access', { method: 'POST', body: JSON.stringify({ userId: 'member' }) });
  assert.equal((await POST(req())).status, 403);
  role = 'super_admin'; assert.equal((await POST(req())).status, 400); assert.equal(sent, 0);
});
