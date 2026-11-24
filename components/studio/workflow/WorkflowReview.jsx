'use client';
import { useState } from 'react';
import { Dialog, inputStyle } from './ui';
import { css } from '@/lib/studio/css';
import { revisionReview } from '@/lib/workflow/review';

export function Clarifications({ choices, apply }) {
  if (!choices.length) return null;
  return <section aria-label="Clarify instructions" style={{padding:12,display:'grid',gap:10}}>
    <strong>Clarify instructions</strong>
    {choices.map(c => <label key={c.id}>{c.label} · {c.request}
      <select aria-label={'Clarify '+c.label} value="" style={css(inputStyle)} onChange={e => apply(c,c.options[Number(e.target.value)])}>
        <option value="">Choose what this means</option>
        {c.options.map((o,i) => <option key={i} value={i}>{o.label}</option>)}
      </select></label>)}
  </section>;
}

export function RevisionChanges({ origin, graph, D }) {
  const review = revisionReview(origin,graph,D);
  return <section aria-label="Live workflow changes" style={{padding:'8px 20px',overflow:'auto',maxHeight:'32vh'}}>
    <strong>Changes to {origin.name}</strong>
    {review.publicChange && <p role="alert"><strong>Public publishing replaces or extends Buffer drafts.</strong> Approved sends can reach the public publishing queue.</p>}
    <table style={{width:'100%',textAlign:'left',fontSize:13}}><thead><tr><th>Setting</th><th>Live at draft creation</th><th>Proposed</th></tr></thead>
      <tbody>{review.rows.map(r => <tr key={r.label}><th>{r.label}</th><td style={{whiteSpace:'pre-line'}}>{r.before}</td><td style={{whiteSpace:'pre-line'}}>{r.changed?r.after:'Unchanged'}</td></tr>)}</tbody></table>
  </section>;
}

export function CompareProjects({ rows, firstId, onRun, onClose }) {
  const [ids,setIds] = useState(() => [firstId || rows[0]?.id || '', rows.find(r=>r.id!==(firstId || rows[0]?.id))?.id || '']);
  const [busy,setBusy] = useState(false);
  const [results,setResults] = useState(null);
  async function run() {
    setBusy(true);
    try { setResults(await onRun(ids)); } finally { setBusy(false); }
  }
  return <Dialog id="wf-compare" actionOnly eyebrow="Test run" title="Compare projects" state="dirty" saveLabel={busy?'Testing…':'Preview samples'}
    saveOff={busy || !ids[0] || !ids[1] || ids[0]===ids[1]} onSave={run} onClose={() => {if (!busy) onClose();}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(220px,100%),1fr))',gap:14,padding:18}}>
      {ids.map((id,i) => <div key={i}><label>Sample {i+1}<select value={id} disabled={busy} style={css(inputStyle)} onChange={e=>{setResults(null);setIds(ids.map((v,j)=>i===j?e.target.value:v));}}>
        <option value="">Select project</option>{rows.map(r=><option key={r.id} disabled={r.id===ids[1-i]} value={r.id}>{r.job} · {r.title}</option>)}</select></label>
        {results?.[i] && <div aria-live="polite"><h3>{results[i].label}</h3>{results[i].details.map((line,index)=><p key={index}>{line}</p>)}</div>}
      </div>)}
    </div>
  </Dialog>;
}
