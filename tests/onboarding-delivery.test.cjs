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
  const model = load('lib/studio/model.js');
  const mocks = { '@/lib/studio/model': model, '@/lib/studio/css': load('lib/studio/css.js'), 'next/image': { __esModule: true, default: () => null } };
  const Welcome = load('components/studio/MemberWelcome.jsx', mocks).default;
  const render = (props) => renderToStaticMarkup(React.createElement(Welcome, props));
  const base = { sb: {}, ctx: { role: 'editor', user_id: 'editor', workspace_name: 'Studio', profile: { full_name: 'Ana Reyes' }, perms: [['edits','edit'],['assets','create']], accounts: [] }, D: { rows: [], myMembership: { onboarding_required: true }, brands: [] }, children: React.createElement('p', null, 'Dashboard') };
  const markup = render(base);
  assert.match(markup, /Welcome, Ana/); assert.match(markup, /Your first edit will show up/); assert.match(markup, /Upload your cuts/); assert.match(markup, /Open my edit queue/);
  const editorWork = render({ ...base, D: { ...base.D, rows: [{ editorId: 'editor', editStatus: 'Needs Revision', iso: {} }, { editorId: 'editor', editStatus: 'Approved', iso: {} }, { editorId: 'other', editStatus: 'Editing', iso: {} }] } });
  assert.match(editorWork, /You have 1 edit in progress/);
  const designer = render({ ...base, ctx: { ...base.ctx, role: 'designer', perms: [] } });
  assert.match(designer, /Status is view only/); assert.match(designer, /does not include uploads/); assert.match(designer, /Pitch ideas/);
  const acct = { id: 'a', name: 'Acme', allow_approve: true, allow_comment: true, allow_drafts: false };
  const sponsorD = { ...base.D, account: acct, rows: [{ status: 'Sponsor Review', approval: 'Pending', g: 'post' }, { status: 'Live', approval: 'Approved', g: 'pub' }] };
  const sponsor = render({ ...base, ctx: { ...base.ctx, role: 'sponsor', perms: [], accounts: [acct] }, D: sponsorD });
  assert.match(sponsor, />Sponsor</); assert.match(sponsor, /Acme projects with Studio/); assert.match(sponsor, /Review 1 pending approval</); assert.match(sponsor, /Approve or request changes/); assert.doesNotMatch(sponsor, /Switch accounts/);
  const client = render({ ...base, ctx: { ...base.ctx, role: 'client', perms: [], accounts: [{ ...acct, allow_approve: false, allow_comment: false }, { id: 'b', name: 'Beta' }] }, D: { ...sponsorD, account: { ...acct, allow_approve: false, allow_comment: false } } });
  assert.match(client, />Client</); assert.match(client, /handles sign off/); assert.match(client, /View my projects/); assert.match(client, /access to 2 accounts/);
  const admin = render({ ...base, ctx: { ...base.ctx, role: 'super_admin' } });
  assert.equal(admin, '<p>Dashboard</p>');
  const existing = render({ ...base, D: { ...base.D, myMembership: { onboarding_required: false } } });
  assert.equal(existing, '<p>Dashboard</p>');
  const reopened = render({ ...base, D: { ...base.D, myMembership: { onboarding_required: false } }, manual: true });
  assert.match(reopened, /How it works/); assert.match(reopened, />Close</);
  const completed = render({ ...base, D: { ...base.D, myMembership: { onboarding_required: true, onboarding_completed_at: 'now' } } });
  assert.equal(completed, '<p>Dashboard</p>');
  assert.equal(model.UI_ROLE.client, 'sponsor');
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

test('welcome lists concrete projects to open first, revisions and approvals ahead of the rest', () => {
  const model = load('lib/studio/model.js');
  const mocks = { '@/lib/studio/model': model, '@/lib/studio/css': load('lib/studio/css.js'), 'next/image': { __esModule: true, default: () => null } };
  const Welcome = load('components/studio/MemberWelcome.jsx', mocks).default;
  const render = (props) => renderToStaticMarkup(React.createElement(Welcome, props));
  const ctx = { role: 'editor', user_id: 'editor', workspace_name: 'Studio', profile: { full_name: 'Ana Reyes' }, perms: [], accounts: [] };
  const rows = [
    { id: '1', job: 'J1', title: 'Later cut', editorId: 'editor', editStatus: 'Editing', iso: { editDue: '2999-01-02' }, editDue: 'Jan 2' },
    { id: '2', job: 'J2', title: 'Fix me', editorId: 'editor', editStatus: 'Needs Revision', iso: {} },
    { id: '3', job: 'J3', title: 'Not mine', editorId: 'other', editStatus: 'Editing', iso: {} },
  ];
  const editor = render({ sb: {}, ctx, D: { rows, myMembership: { onboarding_required: true }, brands: [] }, children: null });
  assert.match(editor, /Start here/); assert.ok(editor.indexOf('Fix me') < editor.indexOf('Later cut')); assert.doesNotMatch(editor, /Not mine/); assert.match(editor, /Due Jan 2/);
  const acct = { id: 'a', name: 'Acme', allow_approve: true };
  const sponsorRows = [{ id: '4', job: 'J4', title: 'Live one', status: 'Live', g: 'pub', iso: { pub: '2020-01-01' } }, { id: '5', job: 'J5', title: 'Sign off', status: 'Sponsor Review', approval: 'Pending', g: 'post', iso: {} }];
  const sponsor = render({ sb: {}, ctx: { ...ctx, role: 'sponsor', accounts: [acct] }, D: { rows: sponsorRows, account: acct, myMembership: { onboarding_required: true }, brands: [] }, children: null });
  assert.match(sponsor, /Waiting on you/); assert.match(sponsor, /Needs your review/); assert.ok(sponsor.indexOf('Sign off') < sponsor.indexOf('Live one'));
});

test('invite link peek describes the invite without the email and reports used or expired links', async () => {
  const inv = { id: 'i', email: 'ana@example.test', full_name: 'Ana Reyes', role: 'editor', accepted_at: null, expires_at: new Date(Date.now() + 3 * 86400000).toISOString(), invited_by: 'admin', workspaces: { name: 'Studio' }, accounts: null };
  const admin = { from: (table) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'invitations' ? inv : { full_name: 'Sam Admin' } }) }) }) }) };
  const { POST } = load('app/api/invites/accept/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/supabase/admin': { supabaseAdmin: () => admin },
  });
  const call = async (body) => { const r = await POST(new Request('https://studio.example/api/invites/accept', { method: 'POST', body: JSON.stringify(body) })); return { status: r.status, data: await r.json() }; };
  const peek = await call({ token: 't' });
  assert.equal(peek.status, 200); assert.equal(peek.data.state, 'open'); assert.equal(peek.data.inviter, 'Sam Admin'); assert.equal(peek.data.emailHint, 'a•••@example.test'); assert.equal(JSON.stringify(peek.data).includes('ana@'), false);
  assert.equal((await call({ token: 't', email: 'wrong@example.test' })).status, 403);
  assert.equal((await call({ token: 't', email: 'Ana@Example.test' })).data.name, 'Ana Reyes');
  inv.expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal((await call({ token: 't' })).data.state, 'expired'); assert.equal((await call({ token: 't', email: 'ana@example.test' })).status, 410);
  inv.accepted_at = 'now';
  assert.equal((await call({ token: 't' })).data.state, 'accepted');
  assert.equal((await call({})).status, 404);
});
