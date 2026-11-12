/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loader}=require('./planning-workflow.test.cjs');

test('invoice aging follows unpaid due date in workspace timezone',()=>{
 const {invoiceState}=loader()('lib/studio/finance-state.js');const now=new Date('2026-11-11T01:00:00Z');
 assert.equal(invoiceState({status:'sent',due_date:'2026-11-09'},now),'Overdue');
 assert.equal(invoiceState({status:'reminder_sent',due_date:'2026-11-12'},now),'Invoiced');
 assert.equal(invoiceState({status:'sent',due_date:'2026-11-10'},now),'Invoiced');
 assert.equal(invoiceState({status:'paid',due_date:'2026-01-01'},now),'Paid');
 assert.equal(invoiceState({status:'draft',due_date:'2026-01-01'},now),'Draft');
});
test('paging reaches records beyond API page size and fails visibly on a later page',async()=>{
 const {readAll}=loader()('lib/studio/paging.js');const rows=Array.from({length:1234},(_,id)=>({id}));
 const result=await readAll(()=>({range:async(a,b)=>({data:rows.slice(a,b+1)})}));
 assert.equal(result.data.length,1234);assert.equal(result.data.at(-1).id,1233);
 const failed=await readAll(()=>({range:async(a,b)=>a>=500?{error:{message:'offline'}}:{data:rows.slice(a,b+1)}}));
 assert.equal(failed.data,null);assert.equal(failed.error.message,'offline');
});
function automationFixture({effect=null,dbFailure=false,ambiguous=false}={}){
 const run={id:'run',automation_id:'auto',workspace_id:'ws',project_id:null,status:'running',attempts:1,is_test:false,output:{}};
 const journals=effect?[{run_id:'run',step_id:'todo_admin',...effect}]:[];const tasks=[];
 const tables={automations:[{id:'auto',workspace_id:'ws',name:'Test',enabled:true,is_draft:false,trigger:{key:'status'},actions:[{key:ambiguous?'slack_admin':'todo_admin'}],run_count:0}],workspace_settings:[{workspace_id:'ws',automation:{failAlert:false,retry:true}}],workspaces:[{id:'ws',name:'Test'}],automation_runs:[run],automation_effects:journals,project_statuses:[],workspace_members:[{workspace_id:'ws',user_id:'user',role:'super_admin',status:'active'}],profiles:[{id:'user',full_name:'Admin',email:'qa@example.test'}],tasks};
 function from(t){let filters=[],op='read',payload;const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},in:(k,v)=>{filters.push([k,v]);return q;},order:()=>q,limit:()=>q,insert:p=>{op='insert';payload=p;return q;},update:p=>{op='update';payload=p;return q;},delete:()=>{op='delete';return q;},single:()=>Promise.resolve(exec(true)),maybeSingle:()=>Promise.resolve(exec(true)),then:f=>Promise.resolve(exec()).then(f)};
 function exec(single=false){const all=tables[t]||[];const matching=all.filter(x=>filters.every(([k,v])=>Array.isArray(v)?v.includes(x[k]):x[k]===v));if(op==='insert'){if(t==='automation_effects'&&journals.length)return{error:{code:'23505'}};if(t==='tasks'&&dbFailure)return{error:{message:'Database unavailable'}};all.push(...(Array.isArray(payload)?payload:[payload]));}if(op==='update')matching.forEach(x=>Object.assign(x,payload));if(op==='delete')matching.forEach(x=>all.splice(all.indexOf(x),1));return{data:single?matching[0]||null:matching,error:null};}return q;}
 const admin={from,rpc:async(name)=>({data:name==='claim_automation_runs'?[run]:0,error:null})};
 const {runAutomations}=loader({'@/lib/supabase/admin':{supabaseAdmin:()=>admin},'@/lib/integrations/secrets':{getIntegration:async()=>({})},'@/lib/integrations/providers/slack':{postSlackAlert:async()=>{throw new Error('Network outcome unknown');}},'@/lib/integrations/providers/n8n':{},'@/lib/integrations/buffer-publish':{},'@/lib/email/send':{sendEmail:async()=>{throw new Error('Unexpected email');}}})('lib/automations/run.ts');
 return{run,journals,tasks,execute:()=>runAutomations({workspaceId:'ws',baseUrl:'https://example.test'})};
}
test('reclaimed run skips a completed effect despite lost run checkpoint',async()=>{const f=automationFixture({effect:{status:'done',detail:'Already done'}});await f.execute();assert.equal(f.tasks.length,0);assert.equal(f.run.status,'done');});
test('uncertain interrupted effect is held without replay',async()=>{const f=automationFixture({effect:{status:'started'}});await f.execute();assert.equal(f.tasks.length,0);assert.equal(f.run.status,'failed');assert.match(f.run.error,/already have taken effect/);});
test('definite database failure retries and releases step claim',async()=>{const f=automationFixture({dbFailure:true});await f.execute();assert.equal(f.run.status,'retry');assert.equal(f.journals.length,0);});
test('ambiguous external error keeps effect journal and requires review',async()=>{const f=automationFixture({ambiguous:true});await f.execute();assert.equal(f.run.status,'failed');assert.equal(f.journals[0].status,'uncertain');});
