/* eslint-disable @typescript-eslint/no-require-imports -- Local provider contract harness. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loader} = require('./planning-workflow.test.cjs');

function endpoint(t, { status = 'draft', loseResponse = false, auth = true, media = 'old', changeStatus = false, returnedMedia = 'new' } = {}) {
  const calls = [], finish = [], removed = [];
  const job = { token: 'token', workspace:'studio', channel:'channel', post:'post', sourcePath:'private/final', expectedPath:'old', mediaPath:'new' };
  const key = '00000000-0000-0000-0000-000000000001';
  const member={supabase:{rpc:async()=>({data:job})}};
  const mock = {
    '@/lib/integrations/auth':{ getMember:async()=>auth ? member : null, deny:(error,status)=>Response.json({error},{status}) },
    '@/lib/integrations/secrets':{getIntegration:async()=>({secret:{apiKey:'simulation'}})},
    '@/lib/supabase/admin':{supabaseAdmin:()=>({
      storage:{from:()=>({copy:async()=>({}),getPublicUrl:path=>({data:{publicUrl:'https://media.example/'+path}}),remove:async paths=>{removed.push(...paths);return {};}})},
      rpc:async(_name,p)=>{finish.push(p.p_state);return {};},
    })},
  };
  t.mock.method(globalThis,'fetch',async(_url,options)=>{
    const {query,variables:{input}}=JSON.parse(options.body);
    calls.push(input);
    if (query.startsWith('query')) return Response.json({data:{post:{id:'post',channelId:'channel',status,assets:[{source:'https://media.example/'+media}]}}});
    if (loseResponse) throw new Error('Timeout');
    return Response.json({data:{editPost:{__typename:'PostActionSuccess',post:{id:'post',channelId:'channel',status:changeStatus?'scheduled':'draft',assets:[{source:'https://media.example/'+returnedMedia}]}}}});
  });
  const {POST}=loader(mock)('app/api/integrations/buffer/draft-media/route.ts');
  return {call:()=>POST(new Request('http://localhost/check',{method:'POST',body:JSON.stringify({publication:key,asset:key,expectedReviews:0})})),calls,finish,removed};
}
test('operator update calls editPost with only the existing post ID and a single ordered video asset',async t=>{
 const f=endpoint(t); assert.equal((await f.call()).status,200);
 assert.deepEqual(f.calls,[{id:'post'},{id:'post',assets:[{video:{url:'https://media.example/new'}}]}]); assert.deepEqual(f.finish,['done']);
});
for(const options of [{status:'scheduled'},{media:'newer-manual'}]) test('changed remote status or source blocks the edit '+JSON.stringify(options),async t=>{
 const f=endpoint(t,options); assert.equal((await f.call()).status,409); assert.equal(f.calls.length,1); assert.deepEqual(f.removed,['new']);assert.deepEqual(f.finish,['failed']);
});
for(const options of [{loseResponse:true},{changeStatus:true},{returnedMedia:'old'}]) test('ambiguous post-edit outcome is held '+JSON.stringify(options),async t=>{
 const f=endpoint(t,options);assert.equal((await f.call()).status,409);assert.deepEqual(f.removed,[]);assert.deepEqual(f.finish,['review']);
});
test('unsigned callers cannot prepare or send a replacement',async t=>{
 const f=endpoint(t,{auth:false});assert.equal((await f.call()).status,401);assert.deepEqual(f.calls,[]);
});
test('queue preserves partial outcomes and missing legacy versions; only accessible supplied projects appear',()=>{
 const {bufferDraftQueue}=loader()('lib/studio/buffer-draft-queue.js');
 const project={id:'p',title:'Movie',channelId:'brand-channel'};
 const input={brand_id:'brand',edit_approved:true,asset_id:'a2',asset_name:'Final',asset_version:2,asset_created_at:'2026-11-23',connected:true,workflow_live:true};
 const D={bufferReadiness:{p:input},buffer:{channels:['one','two'].map(channel_id=>({channel_id,name:channel_id,service:'youtube',draft_brand_id:'brand'}))},
 bufferPubs:{p:[{id:'success',channel_id:'one',status:'draft_created',buffer_post_id:'p1'},{id:'failed',channel_id:'two',status:'draft_review',error:'Unknown outcome'}]}};
 const q=bufferDraftQueue(D,[project]); assert.equal(q.rows.length,2);assert.deepEqual(q.readiness.p,[]);
 assert.equal(q.rows[0].submitted,'Version not recorded');assert.equal(q.rows[0].autoReplace,false);assert.ok(q.rows.every(r=>r.attention));assert.equal(q.rows[1].error,'Unknown outcome');
 assert.equal(bufferDraftQueue(D,[]).rows.length,0);
});
