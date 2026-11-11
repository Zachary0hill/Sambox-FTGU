'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
const box={border:'1px solid var(--line)',borderRadius:16,padding:18,background:'var(--surface)',color:'var(--ink)',display:'flex',flexDirection:'column',gap:12};
const when=v=>v?new Date(v).toLocaleString():'No successful run recorded yet';
export default function OperationsPanel(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{setBusy(true);setError('');try{const r=await fetch('/api/operations',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error);setData({...j,checkedAt:Date.now()});}catch(e){setError(e.message||'Could not load operations.');}finally{setBusy(false);}},[]);
 useEffect(()=>{const timer=setTimeout(refresh,0);return()=>clearTimeout(timer);},[refresh]);
 const jobs=[['research',3],['automations',12],['notifications',35]];
 return <section aria-labelledby="operations-heading" style={box}>
  <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><h2 id="operations-heading" style={{fontSize:18,margin:0}}>Operations readiness</h2><button type="button" onClick={refresh} disabled={busy}>{busy?'Checking…':'Refresh'}</button></div>
  <p style={{margin:0,fontSize:13,color:'var(--muted)'}}>Actual worker completions and retained queue failures. Check stale or failed jobs before relying on unattended processing.</p>
  {error?<p role="alert">{error}</p>:null}
  {data?<>
   {jobs.map(([job,max])=>{const h=data.workers.find(x=>x.job===job&&x.scope==='scheduler');const stale=!h?.last_success_at || data.checkedAt-Date.parse(h.last_success_at)>max*60000;return <div key={job} style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',gap:8}}><strong style={{textTransform:'capitalize'}}>{job}</strong><span>{h?.status==='failed'?'Failed':stale?'Needs attention':h.status==='running'?'Running':'Healthy'} · {when(h?.last_success_at)}</span></div>;})}
   <div style={{display:'flex',flexWrap:'wrap',gap:16,fontSize:13}}><Link href="/admin/automations">Failed automations: {data.counts.automation}</Link><span>Failed email: {data.counts.email}</span><span>File cleanup pending: {data.counts.cleanup}</span><Link href="/ideas">Failed research: {data.counts.research}</Link><span>Assignments needing review: {data.counts.assignments}</span></div>
   {data.oldestQueued?<p style={{margin:0,fontSize:13}}>Oldest waiting automation: {when(data.oldestQueued)}</p>:null}
   <details><summary>Connection freshness</summary><ul>{data.connections.map(c=><li key={c.provider}><strong>{c.name}</strong>: {c.last_error?'Needs attention':c.status==='connected'?'Connected':'Not connected'} · {c.last_synced_at?'Last sync '+when(c.last_synced_at):c.last_checked_at?'Credentials checked '+when(c.last_checked_at):'No check recorded'}</li>)}</ul></details>
  </>:null}
 </section>;
}
