// Creates (or resets) the super_admin login zz-qa uses and writes it to
// .env.test (gitignored). Safe to re-run: an existing user gets a fresh
// password and the membership is upserted. Prints the email, never the password.
// Talks to Supabase's REST endpoints with fetch, so it needs no extra packages.
//
//   node scripts/create-qa-user.mjs [email]

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const email = (process.argv[2] ?? 'zz-qa@example.com').trim().toLowerCase();

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const secretKey = env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error('.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');
  process.exit(1);
}

async function call(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function findUser() {
  for (let page = 1; page < 50; page++) {
    const data = await call('GET', `/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = data.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === email);
    if (hit || users.length < 200) return hit ?? null;
  }
  return null;
}

const workspaces = await call('GET', '/rest/v1/workspaces?select=id,name');
if (workspaces.length !== 1) {
  console.error(`Expected one workspace, found ${workspaces.length}.`);
  process.exit(1);
}
const workspace = workspaces[0];

const password = randomBytes(24).toString('base64url');

let user = await findUser();
if (user) {
  await call('PUT', `/auth/v1/admin/users/${user.id}`, { password, email_confirm: true });
  console.log(`Reset the password for existing user ${email}.`);
} else {
  user = await call('POST', '/auth/v1/admin/users', { email, password, email_confirm: true, user_metadata: { full_name: 'zz-qa bot' } });
  console.log(`Created ${email}.`);
}

await call(
  'POST',
  '/rest/v1/workspace_members?on_conflict=workspace_id,user_id',
  { workspace_id: workspace.id, user_id: user.id, role: 'super_admin', status: 'active' },
  { Prefer: 'resolution=merge-duplicates,return=minimal' },
);

const kept = existsSync('.env.test')
  ? readFileSync('.env.test', 'utf8').split(/\r?\n/).filter((l) => l && !/^\s*QA_(EMAIL|PASSWORD)\s*=/.test(l))
  : ['# QA login for zz-qa. Gitignored; never commit it.'];
writeFileSync('.env.test', [...kept, `QA_EMAIL=${email}`, `QA_PASSWORD=${password}`, ''].join('\n'), { mode: 0o600 });
console.log(`super_admin in ${workspace.name}. Login written to .env.test (user id ${user.id}).`);
