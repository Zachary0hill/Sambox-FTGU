/* eslint-disable @typescript-eslint/no-require-imports -- Standalone route regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
test('invite acceptance verifies auth email before updating an existing account', async () => {
  let updates = 0;
  const admin = {
    from(table) {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === 'invitations'
        ? { id: 'invite', email: 'recipient@example.test', full_name: 'Recipient', role: 'editor', expires_at: '2099-01-01' }
        : { id: 'stale-profile' } }) };
      return q;
    },
    auth: { admin: {
      getUserById: async () => ({ data: { user: { email: 'different@example.test', email_confirmed_at: null } } }),
      updateUserById: async () => { updates++; return {}; },
    } },
  };
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('app/api/invites/accept/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name === 'next/server' ? { NextResponse: { json: Response.json } } : { supabaseAdmin: () => admin }, mod, mod.exports);
  const response = await mod.exports.POST(new Request('https://studio.test/api/invites/accept', { method: 'POST', body: JSON.stringify({ token: 'invite-token', email: 'recipient@example.test', password: 'Example-password-123!' }) }));
  assert.equal(response.status, 409);
  assert.equal(updates, 0);
});
