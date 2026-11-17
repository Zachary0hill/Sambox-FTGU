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
    if (name === 'next/image' || name === 'next/link') {
      const react = bundle(require.resolve('react'));
      modules.set(name, `function(module){module.exports={default:(p)=>load(${JSON.stringify(react)}).createElement('${name === 'next/image' ? 'img' : 'a'}',p)};}`);
      refs[name] = name; continue;
    }
    if (name === 'tus-js-client') { modules.set(name, 'function(module){module.exports={Upload:class {}};}'); refs[name]=name; continue; }

    const target = name.startsWith('@/') ? path.resolve(name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
    const resolved = target && [target, target + '.js', target + '.jsx', target + '.ts'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
    refs[name] = bundle(resolved || require.resolve(name, { paths: [path.dirname(file)] }));
  }
  modules.set(file, `function(module,exports){const require=name=>load(${JSON.stringify(refs)}[name]);${code}\n}`);
  return file;
}
const file=bundle(path.resolve('components/studio/StudioView.jsx'));
const vals=bundle(path.resolve('lib/studio/vals.js'));
const react=bundle(require.resolve('react'));const client=bundle(require.resolve('react-dom/client'));
const fixtureCode="function fixture(role='manager') {\n  const D={};\n  for(const k of ['statuses','types','channels','accounts','directory','rows','tasks','ideas','brands','notifications','activity','threads','members','invitations','accountMembers','metrics','budgets','deals','invoices','payouts','automations','integrations','customFields','templates','rolePerms','roleConfigs','researchRuns','automationRuns','youtube','contentEntries','statusEvents','workloadSnaps','inbox','viewStates'])D[k]=[];\n  Object.assign(D,{ws:{id:'ws',name:'Studio'},settings:{},people:{},comments:{},assets:{},previews:{},banners:{},profileEmail:{},portalDetail:{},checklist:{},seen:{},buffer:{channels:[],posts:[]},publish:{},bufferPubs:{},nameOf:()=>'',authorLabel:()=>'',assistant:{enabled:false}});\n  D.statuses=[{id:'status',label:'Scripting',stage:'in_production',color_token:'gray',sort:1}];\n  D.types=[{id:'type',label:'YouTube Video',color_token:'blue'}];\n  const me={id:'user',name:'Tester',email:'test@example.test',dbRole:role==='admin'?'super_admin':role,uiRole:role,accounts:[],perms:new Set(['projects:view','projects:create','projects:edit','ideas:view','ideas:create','ideas:edit','ideas:approve','brands:view','brands:edit','clients:view','clients:create','clients:edit']),prefs:{}};\n  const s={role,nav:'projects',panel:true,theme:'light',view:'table',person:'All',ftype:{},fchannel:{},fstatus:{},sort:'default',hidden:{},groupBy:'stage',closed:{},q:'',menu:'',added:{}};\n  return {D,me,s,A:new Proxy({},{get:()=>()=>{}}),set:()=>{},now:new Date('2026-11-05T12:00:00Z')};\n}\n";
const script=`const process={env:{NODE_ENV:'production'}};const mods={${[...modules].map(([id,fn])=>JSON.stringify(id)+':'+fn).join(',')}};const cache={};function load(id){if(!cache[id]){cache[id]={exports:{}};mods[id](cache[id],cache[id].exports);}return cache[id].exports;}
const React=load(${JSON.stringify(react)});const root=load(${JSON.stringify(client)}).createRoot(document.getElementById('root'));const Studio=load(${JSON.stringify(file)}).default;const compute=load(${JSON.stringify(vals)}).computeVals;
${fixtureCode}
window.requests=[];window.fetch=async(url,options={})=>{window.requests.push([url,options.method||'GET']);return {ok:true,json:async()=>({workers:[],counts:{},connections:[],automations:[],runs:[],rules:[],providers:[],usage:[],rows:[]})};};
const f=fixture('admin');
f.D.directory=[{id:'editor',name:'Audit Editor',full_name:'Audit Editor',role:'editor',status:'active',color_index:0},{id:'designer',name:'Audit Designer',full_name:'Audit Designer',role:'designer',status:'active',color_index:1}];
f.D.members=f.D.directory.map(p=>({user_id:p.id,workspace_id:'ws',role:p.role,status:'active',person:p}));
f.D.people=Object.fromEntries(f.D.directory.map(p=>[p.id,p]));
f.D.rows=[{id:'project',job:'QA-1',title:'Populated mobile layout audit project',status:'Scripting',statusId:'status',g:'prod',type:'YouTube Video',editor:'Audit Editor',editorId:'editor',editStatus:'Editing',designer:'Audit Designer',designerId:'designer',thumb:'In Design',film:'Nov 5',pub:'Nov 7',editDue:'Nov 5',thumbDue:'Nov 6',iso:{film:'2026-11-05',pub:'2026-11-07',editDue:'2026-11-05',thumbDue:'2026-11-06'},cf:{}}];
f.D.rolePerms=['manager','editor','designer','sponsor','client'].flatMap(role=>['projects','ideas','brands','comments'].flatMap(resource=>['view','edit'].map(action=>({role,resource,action,allowed:true}))));
f.A.saveWorkloadSnapshot=()=>{};f.A.savePrefs=()=>{};window.renderPage=(nav)=>{f.s.nav=nav;root.render(React.createElement(Studio,{V:compute(f)}));};window.renderPage('projects');`;
const pages=['projects','daily','ideas','brand','alerts','content','perf','settings','team','roles','pm','clients','finance','auto','logs','updates','workspace'];
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort());
 const css=fs.readFileSync('app/globals.css','utf8').replace(/@import[^;]+;/g,'');
 await page.setContent('<!doctype html><html><head><style>'+css+'</style></head><body><div id="root"></div></body></html>');await page.addScriptTag({content:script});
 const results=[];
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});for(const nav of pages){await page.evaluate(nav=>window.renderPage(nav),nav);await page.waitForTimeout(60);assert.equal(errors.length,0,nav+': '+errors.join('; '));assert.equal(await page.locator('[data-studio-root]').count(),1,nav+' rendered');if(nav!=='projects')assert.notDeepEqual(await page.locator('h1').allTextContents(),['Projects'],nav+' must not fall back to projects');results.push({nav,width,headings:await page.locator('h1').allTextContents(),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)});}}
 assert.deepEqual(results.filter(x=>x.horizontalOverflow),[], 'viewport has no page-wide horizontal overflow');
 assert.deepEqual((await page.evaluate(()=>window.requests)).filter(([,method])=>method!=='GET'),[]);
 console.log(JSON.stringify({checks:results.length,errors,results},null,2));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
