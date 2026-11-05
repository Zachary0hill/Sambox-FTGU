/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local browser test. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
// Bundle the actual component and installed React locally; no external requests or test route in the app.
const modules = new Map();
function bundle(file, source) {
  if (modules.has(file)) return file;
  modules.set(file, '');
  let code = source || fs.readFileSync(file, 'utf8');
  const refs = {};
  for (const match of code.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
    refs[match[1]] = bundle(require.resolve(match[1], { paths: [path.dirname(file)] }));
  }
  modules.set(file, `function(module,exports){const require=(name)=>load(${JSON.stringify(refs)}[name]);${code}\n}`);
  return file;
}
const file = path.resolve('components/studio/MemberWelcome.jsx');
bundle(file, ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText);
const react = bundle(require.resolve('react'));
const client = bundle(require.resolve('react-dom/client'));
const script = `const process={env:{NODE_ENV:'production'}};const mods={${[...modules].map(([id,fn])=>JSON.stringify(id)+':'+fn).join(',')}};const cache={};function load(id){if(!cache[id]){cache[id]={exports:{}};mods[id](cache[id],cache[id].exports);}return cache[id].exports;}
const React=load(${JSON.stringify(react)});const root=load(${JSON.stringify(client)}).createRoot(document.getElementById('root'));const Welcome=load(${JSON.stringify(file)}).default;
window.progress={onboarding_required:true};window.fail=false;window.saves=[];
function Harness(){const [rev,refresh]=React.useState(0);const [nav,setNav]=React.useState('projects');return React.createElement(Welcome,{key:window.instance||0,sb:{rpc:async(name,args)=>{window.saves.push(args.p_action);if(window.fail)return {error:true};if(args.p_action==='complete')window.progress.onboarding_completed_at='now';else window.progress.onboarding_dismissed_at='now';return {}; }},ctx:{role:window.role||'editor',user_id:'me',workspace_name:'Test studio',profile:{full_name:'Test Member'},perms:[['assets','create'],['edits','edit'],['thumbs','edit']]},D:{rows:[],brands:[],myMembership:window.progress},nav,set:(patch)=>setNav(patch.nav),reload:async()=>refresh(rev+1)},React.createElement('div',null,React.createElement('p',null,'Dashboard'),React.createElement('button',{onClick:()=>setNav('settings')},'Settings')));}
window.render=()=>root.render(React.createElement(Harness));window.render();`;
(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.setContent('<html><body style="margin:0"><div id="root"></div></body></html>');
    await page.addScriptTag({content:script});
    await page.getByRole('heading',{name:'Welcome, Test Member'}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.evaluate(()=>window.fail=true);
    await page.getByRole('button',{name:'Open my queue'}).click();
    await page.getByRole('alert').waitFor();
    await page.evaluate(()=>window.fail=false);
    await page.getByRole('button',{name:'Open my queue'}).click();
    await page.getByText('Dashboard',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.getByRole('button',{name:'Getting started as an editor'}).click();
    await page.getByRole('heading',{name:'Welcome, Test Member'}).waitFor();
    await page.getByRole('button',{name:'Skip for now'}).click();
    await page.getByText('Dashboard',{exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.saves),['complete','complete','dismiss']);
    await page.evaluate(()=>{window.progress={onboarding_required:true};window.role='designer';window.instance=1;window.render();});
    await page.getByRole('heading',{name:'Welcome, Test Member'}).waitFor();
    await page.getByText('Open a project to upload a thumbnail for your team.').waitFor();
    await page.getByRole('button',{name:'Skip for now'}).click();
    await page.getByText('Dashboard',{exact:true}).waitFor();
    await page.evaluate(()=>{window.instance=2;window.render();});
    await page.getByText('Dashboard',{exact:true}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'Welcome, Test Member'}).count(),0);
    console.log('PASS: mobile width, save failure/retry, completion, settings reopen, designer content, dismissal across remount.');
  }finally{await browser.close();}
})().catch((e)=>{console.error(e);process.exitCode=1;});
