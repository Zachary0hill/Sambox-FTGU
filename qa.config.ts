// zz-qa: the testing bot that visits every Studio page, sweeps buttons in safe
// mode and writes a report to qa-report/. Run it from this folder:
//   node ../ZZMEDIAHUB/zz-qa/bin/zz-qa.js run
// The login lives in .env.test (gitignored): QA_EMAIL / QA_PASSWORD for the
// zz-qa super_admin that scripts/create-qa-user.mjs makes.

import { defineConfig } from 'zz-qa';

// Mirrors NAV_PATH in components/studio/Studio.jsx (not imported: it's a client component).
const PAGES: [id: string, path: string, label: string][] = [
  ['projects', '/projects', 'Projects'],
  ['daily', '/daily', 'Daily'],
  ['ideas', '/ideas', 'Ideas'],
  ['brand', '/brand', 'Brand'],
  ['inbox', '/inbox', 'Inbox'],
  ['content', '/content', 'Content'],
  ['settings', '/settings', 'Settings'],
  ['team', '/admin/users', 'Admin › Team'],
  ['roles', '/admin/roles', 'Admin › Roles'],
  ['workload', '/admin/workload', 'Admin › Workload'],
  ['clients', '/admin/clients', 'Admin › Clients'],
  ['finance', '/admin/finance', 'Admin › Finance'],
  ['automations', '/admin/automations', 'Admin › Automations'],
  ['logs', '/admin/logs', 'Admin › Logs'],
  ['workspace', '/admin/workspace', 'Admin › Workspace'],
];

export default defineConfig({
  name: 'FTGU Studio',
  app: { start: 'npm run dev -- --port 4200', port: 4200, readyPath: '/login' },
  login: async (page, env) => {
    if (!env.QA_EMAIL || !env.QA_PASSWORD) throw new Error('.env.test needs QA_EMAIL and QA_PASSWORD (node scripts/create-qa-user.mjs).');
    await page.goto('/login');
    await page.getByLabel('Email').fill(env.QA_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(env.QA_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 });
  },
  pages: PAGES.map(([id, path, label]) => ({ id, path, label })),
  viewports: ['desktop', 'mobile'],
  themes: ['light'],
  safeMode: {
    allowWrites: [
      'POST /auth/v1/token', // Supabase session refresh
      'POST /storage/v1/object/sign/*', // signed file URLs: a read sent as POST
      // Read-only (stable) RPCs the board loads with.
      'POST /rest/v1/rpc/my_context',
      'POST /rest/v1/rpc/directory',
      'POST /rest/v1/rpc/portal_projects',
      'POST /rest/v1/rpc/portal_comments',
      'POST /rest/v1/rpc/portal_assets',
    ],
    skipLabels: [/invite/i, /\bsync\b/i, /export/i, /\bsave\b/i, /approve/i, /reject/i, /\brun\b/i, /retry/i, /buffer/i, /generate/i],
  },
  sweep: {
    chromeSelectors: ['nav', 'header', 'aside'],
  },
  concurrency: 3,
});
