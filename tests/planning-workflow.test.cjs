/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file,mod);
    const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{ compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX} }).outputText;
    new Function('require','module','exports',code)((name) => {
      if (name === 'server-only') return {};
      if (mocks[name]) return mocks[name];
      if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
      const target = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file),name);
      const resolved = [target,target+'.js',target+'.ts',target+'.jsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (!resolved) throw new Error('Cannot load '+target);
      return load(resolved);
    },mod,mod.exports);
    return mod.exports;
  }
  return load;
}

test('brief import preserves script and planning while never accepting a supplied brand or approval', () => {
  const { importBrief } = loader()('lib/ideas/import-brief.js');
  const value = importBrief(JSON.stringify({ title:'Test',body:['Scene one','Scene two'],titleOptions:['A','B'],thumbnailBrief:'Split screen',brandId:'wrong-brand',status:'approved' }));
  assert.equal(value.body,'Scene one\n\nScene two'); assert.equal(value.titleOptions,'A\nB'); assert.equal(value.thumbnailBrief,'Split screen');
  assert.equal(value.brandId,undefined); assert.equal(value.status,undefined);
  assert.equal(importBrief('# Working title\nOriginal full script').body,'# Working title\nOriginal full script');
  assert.throws(() => importBrief('{bad json'),/JSON/);
  assert.throws(() => importBrief('x'.repeat(30001)),/30,000/);
});

function approveFixture({ signedIn=true, denied=false, failUpload=false, existing=false }={}) {
  const project={id:'project',job:'IDEA-1',workspaceId:'workspace',package:{coverPath:'workspace/00000000-0000-0000-0000-000000000041/cover.png'}};
  let uploads=0, inserts=0, rpc=0;
  const admin={ from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:existing?{id:'asset'}:null})})})}),insert:async()=>{inserts++;existing=true;return {};}}), storage:{from:()=>({upload:async()=>{uploads++;return failUpload?{error:{message:'network failed'}}:{};}})} };
  const member={ctx:{user_id:'user'},supabase:{rpc:async()=>{rpc++;return denied?{error:{code:'42501',message:'Denied'}}:{data:project};},storage:{from:()=>({download:async()=>({data:new Blob(['image'],{type:'image/png'})})})}}};
  const {POST}=loader({'@/lib/integrations/auth':{getMember:async()=>signedIn?member:null,deny:(error,status=403)=>Response.json({error},{status})},'@/lib/supabase/admin':{supabaseAdmin:()=>admin},'next/server':{NextResponse:{json:Response.json}}})('app/api/ideas/approve/route.ts');
  return {send:()=>POST(new Request('https://studio.example/api/ideas/approve',{method:'POST',body:JSON.stringify({ideaId:'00000000-0000-0000-0000-000000000041'})})),counts:()=>({uploads,inserts,rpc}),recover:()=>{failUpload=false;}};
}
test('approval endpoint rejects unauthenticated/unauthorized calls before touching storage',async()=>{
  for(const options of [{signedIn:false},{denied:true}]){const f=approveFixture(options);assert.equal((await f.send()).status,options.denied?403:401);assert.equal(f.counts().uploads,0);}
});
test('asset transfer retries the same project and does not duplicate an existing asset',async()=>{
  const f=approveFixture({failUpload:true});const first=await (await f.send()).json();assert.equal(first.project.id,'project');assert.match(first.warning,/Retry asset transfer/);assert.equal(f.counts().inserts,0);
  f.recover();const retry=await(await f.send()).json();assert.equal(retry.project.id,first.project.id);assert.equal(retry.warning,undefined);assert.equal(f.counts().inserts,1);
  await f.send();assert.equal(f.counts().inserts,1);assert.equal(f.counts().uploads,2);
});

function fixture(role='manager') {
  const D={};
  for(const k of ['statuses','types','channels','accounts','directory','rows','tasks','ideas','brands','notifications','activity','threads','members','invitations','accountMembers','metrics','budgets','deals','invoices','payouts','automations','integrations','customFields','templates','rolePerms','roleConfigs','researchRuns','automationRuns','youtube','contentEntries','statusEvents','workloadSnaps','inbox','viewStates'])D[k]=[];
  Object.assign(D,{ws:{id:'ws',name:'Studio'},settings:{},people:{},comments:{},assets:{},previews:{},banners:{},profileEmail:{},portalDetail:{},checklist:{},seen:{},buffer:{channels:[],posts:[]},publish:{},bufferPubs:{},nameOf:()=>'',authorLabel:()=>'',assistant:{enabled:false}});
  D.statuses=[{id:'status',label:'Scripting',stage:'in_production',color_token:'gray',sort:1}];
  D.types=[{id:'type',label:'YouTube Video',color_token:'blue'}];
  const me={id:'user',name:'Tester',email:'test@example.test',dbRole:role==='admin'?'super_admin':role,uiRole:role,accounts:[],perms:new Set(['projects:view','projects:create','projects:edit','ideas:view','ideas:create','ideas:edit','ideas:approve','brands:view','brands:edit','clients:view','clients:create','clients:edit']),prefs:{}};
  const s={role,nav:'projects',panel:true,theme:'light',view:'table',person:'All',ftype:{},fchannel:{},fstatus:{},sort:'default',hidden:{},groupBy:'stage',closed:{},q:'',menu:'',added:{}};
  return {D,me,s,A:new Proxy({},{get:()=>()=>{}}),set:()=>{},now:new Date('2026-11-05T12:00:00Z')};
}
test('Manager shell renders with operational navigation, no admin pages, and revocable creation',()=>{
  const {computeVals}=loader()('lib/studio/vals.js'); const f=fixture();
  const view=computeVals(f);assert.equal(view.hasAdminNav,false);assert.ok(view.navItems.some(n=>n.label==='Clients & Sponsors'));assert.equal(view.canCreateProject,true);
  f.me.perms.delete('projects:create');assert.equal(computeVals(f).canCreateProject,false);
  f.s.nav='clients';assert.ok(computeVals(f).managerClients);assert.equal(computeVals(f).showPage,false);
  f.s.nav='workspace';assert.equal(computeVals(f).showAdmin,false);
});
test('Super Admin permissions grid includes Manager without losing existing roles',()=>{
  const {computeVals}=loader()('lib/studio/vals.js');const f=fixture('admin');f.s.nav='roles';
  const view=computeVals(f);assert.equal(view.showAdmin,true);assert.ok(view.nuTypes.some(r=>r.label==='Manager'));
});

module.exports={loader,fixture};

test('new ideas require a deliberate brand choice and import preserves long scripts',()=>{
  const {computeVals}=loader()('lib/studio/vals.js');const f=fixture('admin');
  f.D.brands=[{id:'a',name:'Client A',kind:'channel'},{id:'b',name:'Client B',kind:'channel'}];
  f.s.ideaModal=true;f.s.ni={title:'Working title'};let patch;
  f.set=p=>{patch=p;};
  const v=computeVals(f);assert.equal(v.ids.ni.brand,'');v.ids.ni.create();assert.match(patch.ni.err,/Choose a brand/);
  const {importBrief}=loader()('lib/ideas/import-brief.js');const script='x'.repeat(18000);assert.equal(importBrief(JSON.stringify({title:'Long brief',body:script})).body,script);
  assert.throws(()=>importBrief(JSON.stringify({title:'Brief',hook:'x'.repeat(25)})),/Hook exceeds/);
});
test('Grok lists language models and uses the chat completions adapter',async()=>{
  const prior=global.fetch;let endpoint;
  try {
    global.fetch=async url=>{endpoint=url;return Response.json({models:[{id:'grok-example',created:1}]});};
    const provider=loader()('lib/integrations/providers/xai.ts').default;
    assert.deepEqual(await provider.listModels({apiKey:'test'}),[{id:'grok-example',label:'grok-example'}]);
    assert.equal(endpoint,'https://api.x.ai/v1/language-models');
    assert.equal(await provider.verify({apiKey:'test'},{model:'grok-example'}),null);
    assert.equal(endpoint,'https://api.x.ai/v1/language-models/grok-example');
    let config;
    const {buildModel}=loader({'@/lib/integrations/secrets':{},'@/lib/supabase/admin':{},'@ai-sdk/openai':{createOpenAI:c=>{config=c;return {chat:id=>({modelId:id})};}}})('lib/ai/model.ts');
    assert.equal(buildModel('xai','test','grok-example').model.modelId,'grok-example');assert.equal(config.baseURL,'https://api.x.ai/v1');
  } finally {global.fetch=prior;}
});
