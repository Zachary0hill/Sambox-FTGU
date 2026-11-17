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
  for (const match of code.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
    const name = match[1];
    const target = name.startsWith('@/') ? path.resolve(name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
    const resolved = target && [target, target + '.js', target + '.jsx', target + '.ts'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
    refs[name] = bundle(resolved || require.resolve(name, { paths: [path.dirname(file)] }));
  }
  modules.set(file, `function(module,exports){const require=name=>load(${JSON.stringify(refs)}[name]);${code}\n}`);
  return file;
}
const file = bundle(path.resolve('components/studio/RecordDialog.jsx'));
const react = bundle(require.resolve('react'));
const client = bundle(require.resolve('react-dom/client'));
const script = `const process={env:{NODE_ENV:'production'}};const mods={${[...modules].map(([id,fn])=>JSON.stringify(id)+':'+fn).join(',')}};const cache={};function load(id){if(!cache[id]){cache[id]={exports:{}};mods[id](cache[id],cache[id].exports);}return cache[id].exports;}
const React=load(${JSON.stringify(react)});const root=load(${JSON.stringify(client)}).createRoot(document.getElementById('root'));const Dialog=load(${JSON.stringify(file)}).default;
window.saves=0;
function App(){const [open,setOpen]=React.useState(false);const [busy,setBusy]=React.useState(false);const [info,setInfo]=React.useState(false);
window.reset=()=>{setBusy(false);setInfo(true);};
return React.createElement(React.Fragment,null,
React.createElement('main',null,React.createElement('button',{onClick:()=>setOpen(true)},'Open record'),React.createElement('button',null,'Background action')),
open?React.createElement(Dialog,{d:{id:'audit',title:'Audit record',fields:[{key:'name',label:'Name',value:'Draft'}],onChange:()=>{},close:()=>setOpen(false),busy,save:info?undefined:()=>{window.saves++;setBusy(true);}}}):null);}
root.render(React.createElement(App));`;
(async () => {
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<!doctype html><html><head><style>:root{--surface:white;--surface-2:#f4f4f4;--ink:#111;--border:#ddd;--inv:#111;--inv-ink:white}body{font:14px system-ui}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({content:script});
  await page.getByRole('button',{name:'Open record',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByLabel('Name',{exact:true}).evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.locator('main').evaluate(el=>el.inert),true);
  for(let i=0;i<10;i++){await page.keyboard.press(i%2?'Shift+Tab':'Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog')),true);}
  await page.keyboard.press('Control+Enter');
  await page.getByRole('button',{name:'Saving…',exact:true}).waitFor();
  await page.keyboard.press('Control+Enter');
  assert.equal(await page.evaluate(()=>window.saves),1);
  await page.evaluate(()=>window.reset());
  await page.getByRole('button',{name:'Saving…',exact:true}).waitFor({state:'detached'});
  await page.keyboard.press('Control+Enter');
  assert.equal(await page.evaluate(()=>window.saves),1);
  assert.equal(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.getByRole('button',{name:'Open record',exact:true}).evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: RecordDialog initial focus, inert background, Tab containment, busy keyboard save guard, optional save, mobile fit, Escape and focus restoration.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
