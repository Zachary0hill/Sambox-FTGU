/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser verification, no app test routes. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const modules = new Map();
function bundle(file) {
  if (modules.has(file)) return file;
  modules.set(file, '');
  let code = fs.readFileSync(file, 'utf8');
  if (!file.includes('node_modules')) code = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const refs = {};
  for (const match of code.matchAll(/require\(['"]([^'"]+)['"]\)/g)) refs[match[1]] = bundle(require.resolve(match[1], { paths: [path.dirname(file)] }));
  modules.set(file, `function(module,exports){const require=name=>load(${JSON.stringify(refs)}[name]);${code}\n}`);
  return file;
}
const file = bundle(path.resolve('components/studio/IdeaImport.jsx'));
const react = bundle(require.resolve('react'));
const client = bundle(require.resolve('react-dom/client'));
const script = `const process={env:{NODE_ENV:'production'}};const mods={${[...modules].map(([id,fn])=>JSON.stringify(id)+':'+fn).join(',')}};const cache={};function load(id){if(!cache[id]){cache[id]={exports:{}};mods[id](cache[id],cache[id].exports);}return cache[id].exports;}
const React=load(${JSON.stringify(react)});const root=load(${JSON.stringify(client)}).createRoot(document.getElementById('root'));const Import=load(${JSON.stringify(file)}).default;
window.saves=[];window.fail=true;window.completions=0;
root.render(React.createElement(Import,{brands:[{id:'pod',name:'POD HUT'},{id:'other',name:'Other Client'}],onImport:async ideas=>{window.saves.push(ideas);if(window.fail)throw new Error('Offline');return {created:ideas.length,skipped:0};},onComplete:()=>window.completions++}));`;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<html><head><style>:root{--surface:white;--surface-2:#f4f4f4;--ink:#111;--border:#ddd;--inv:#111;--inv-ink:white;--red-ink:#900}body{font:14px system-ui}dialog::backdrop{background:#0006}label{display:grid;gap:6px}</style></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({ content: script });
    await page.getByRole('button', { name: 'Import ideas', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Markdown template' }).click();
    assert.equal((await downloadPromise).suggestedFilename(), 'idea-import-template.md');
    await page.getByLabel('Upload document').setInputFiles({ name: 'shoot.md', mimeType: 'text/markdown', buffer: Buffer.from('# Shoot list\nClient: POD HUT\n## First idea\nDescription: Film a studio tour.\nReference: https://example.com/one\n## Second idea\nClient: Missing\nDescription: Film a microphone demo.') });
    await page.getByRole('button', { name: 'Preview ideas' }).click();
    assert.equal(await page.getByLabel('Client 1', { exact: true }).inputValue(), 'pod');
    assert.equal(await page.getByLabel('Client 2', { exact: true }).inputValue(), '');
    assert.equal(await page.getByRole('button', { name: 'Import 2 drafts' }).isDisabled(), true);
    assert.equal(await page.evaluate(() => window.saves.length), 0);
    await page.getByLabel('Client for unassigned ideas').selectOption('other');
    await page.getByRole('button', { name: 'Apply to unassigned' }).click();
    assert.equal(await page.getByLabel('Client 1', { exact: true }).inputValue(), 'pod');
    assert.equal(await page.getByLabel('Client 2', { exact: true }).inputValue(), 'other');
    await page.getByLabel('Title 1', { exact: true }).fill('Reviewed first idea');
    await page.getByRole('article', { name: 'Idea 1', exact: true }).getByText('Review content and references (1)').click();
    assert.match(await page.getByLabel('Content 1', { exact: true }).inputValue(), /studio tour/);
    assert.equal(await page.getByLabel('References 1', { exact: true }).inputValue(), 'https://example.com/one');
    assert.equal(await page.evaluate(() => document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth), true);
    if (process.env.IMPORT_SCREENSHOT) await page.screenshot({ path: process.env.IMPORT_SCREENSHOT });
    await page.getByRole('button', { name: 'Import 2 drafts' }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('Title 1', { exact: true }).isDisabled(), true);
    await page.evaluate(() => { window.fail = false; });
    await page.getByRole('button', { name: 'Retry import' }).click();
    await page.getByRole('heading', { name: '2 ideas imported' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.saves.map(rows => rows.map(r => [r.title, r.brandId]))), [[['Reviewed first idea','pod'],['Second idea','other']],[['Reviewed first idea','pod'],['Second idea','other']]]);
    assert.equal(await page.evaluate(() => window.completions), 1);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.getByRole('button', { name: 'Import ideas', exact: true }).click();
    await page.getByLabel('Or paste your document').fill('## One\nClient: POD HUT\nText\n## Two\nClient: POD HUT\nText');
    await page.getByRole('button', { name: 'Preview ideas' }).click();
    await page.getByLabel('Import idea 2', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Import 1 drafts' }).click();
    await page.getByRole('heading', { name: '1 idea imported' }).waitFor();
    assert.equal(await page.evaluate(() => window.saves.at(-1).length), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: upload, paste, template download, mobile fit, preview before writes, client mapping, field editing, selection, failed save/retry, completion, no browser errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
