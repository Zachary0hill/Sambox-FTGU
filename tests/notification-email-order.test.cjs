/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function harness(failFirst, finishError=false) {
  const sent=[],updates=[];
  const rows=[['1','a'],['2','a'],['3','b']].map(([id,user_id])=>({id,user_id,workspace_id:'w',project_id:'p',kind:'edit_review',event:'approval',data:{},attempts:1,created_at:new Date().toISOString()}));
  const db={rpc:async name=>({data:name==='claim_email_outbox'?rows:[],error:null}),from(table){let update=null,digest=false;const q={select(){return q;},update(v){update=v;return q;},eq(k,v){if(update){updates.push({id:v,...update});return Promise.resolve({error:finishError?{message:'write failed'}:null});}return q;},in(k){if(k==='role')digest=true;return q;},then(resolve){let data=[];if(table==='profiles')data=['a','b'].map(id=>({id,email:id+'@example.test',full_name:id,prefs:{}}));if(table==='workspace_members'&&!digest)data=['a','b'].map(user_id=>({user_id,workspace_id:'w',status:'active'}));if(table==='workspaces')data=[{id:'w',name:'Test'}];if(table==='workspace_settings')data=[{workspace_id:'w',notify_defaults:{}}];if(table==='projects')data=[{id:'p',title:'Project',job_code:'P'}];return Promise.resolve({data,error:null}).then(resolve);}};return q;}};
  const mocks={'server-only':{},'@/lib/supabase/admin':{supabaseAdmin:()=>db},'./send':{sendEmail:async ({to})=>{sent.push(to);return failFirst&&sent.length===1?{sent:false,error:'retry'}:{sent:true,id:'provider'};}},'./notification-template':{buildNotificationEmail:()=>({subject:'test',html:'test'})},'./message-template':{},'@/lib/integrations/providers/slack':{}};
  const code=ts.transpileModule(fs.readFileSync('lib/email/notifications.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const mod={exports:{}};new Function('require','module','exports','setTimeout',code)(name=>mocks[name],mod,mod.exports,fn=>fn());
  return {run:()=>mod.exports.sendQueuedEmails({workspaceId:'w',baseUrl:'https://test.example'}),sent,updates};
}
test('retry defers later messages for the same recipient without consuming an attempt',async()=>{const h=harness(true);const result=await h.run();assert.deepEqual(h.sent,['a@example.test','b@example.test']);assert.equal(result.held,1);assert.equal(result.failed,1);assert.ok(h.updates.some(x=>x.id==='2'&&x.status==='queued'&&x.attempts===0));});
test('successful batch sends every message in claim order',async()=>{const h=harness(false);assert.equal((await h.run()).sent,3);assert.deepEqual(h.sent,['a@example.test','a@example.test','b@example.test']);});
test('failed persistence stops the batch before later messages can overtake',async()=>{const h=harness(false,true);await assert.rejects(h.run(),/write failed/);assert.deepEqual(h.sent,['a@example.test']);});
