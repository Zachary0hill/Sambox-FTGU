/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS test harness. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

// Local production build with mocked setup responses: no accounts, emails, or live auth mutations.
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage();
    let verified = false;
    let verifies = 0;
    let saves = 0;
    let tokenType = '';
    await page.route('**/api/auth/setup', async (route) => {
      const body = route.request().postDataJSON();
      if (body.action === 'resume') return route.fulfill({ json: { verified } });
      if (body.action === 'verify') { tokenType = body.tokenType; verified = true; verifies++; return route.fulfill({ json: { verified: true } }); }
      saves++;
      return route.fulfill({ status: 400, json: { error: 'Password rejected by policy' } });
    });
    await page.goto('http://localhost:3107/auth/setup?token_hash=fake-test-token&type=invite');
    await page.locator('#su-pw').fill('test-password');
    await page.locator('#su-pw2').fill('test-password');
    await page.getByRole('button', { name: 'Set password and continue' }).click();
    await page.getByRole('alert').filter({ hasText: 'Password rejected' }).waitFor();
    assert.equal(verifies, 1);
    assert.equal(new URL(page.url()).search, '');
    await page.getByRole('button', { name: 'Set password and continue' }).click();
    await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
    assert.equal(verifies, 1);
    assert.equal(saves, 2);
    await page.reload();
    await page.locator('#su-pw').fill('test-password');
    await page.locator('#su-pw2').fill('test-password');
    await page.getByRole('button', { name: 'Set password and continue' }).click();
    await page.getByRole('alert').filter({ hasText: 'Password rejected' }).waitFor();
    assert.equal(verifies, 1);
    assert.equal(saves, 3);
    await page.getByRole('link', { name: 'Recover your password' }).waitFor();
    verified = false;
    await page.goto('http://localhost:3107/auth/setup?token_hash=fake-replacement&type=magiclink&setup=password');
    await page.locator('#su-pw').fill('test-password');
    await page.locator('#su-pw2').fill('test-password');
    await page.getByRole('button', { name: 'Set password and continue' }).click();
    await page.getByRole('alert').filter({ hasText: 'Password rejected' }).waitFor();
    assert.equal(tokenType, 'magiclink');
    assert.equal(verifies, 2);
    console.log('PASS: password retry, sanitized URL, refresh resume, recovery link; one token verification across three saves, and replacement magic-link password setup.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
