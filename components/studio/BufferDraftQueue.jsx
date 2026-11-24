'use client';
import { useState } from 'react';

const button = { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)' };

export function DraftReadiness({ reasons, open }) {
  if (!reasons) return null;
  return <div style={{ position: 'relative', zIndex: 1, fontSize: 12 }}>
    {reasons.length ? <details>
      <summary>Buffer draft · {reasons.length} to resolve</summary>
      <ul style={{ paddingLeft: 15, margin: '6px 0' }}>{reasons.map(r =>
        <li key={r.control + r.label}><button type="button" onClick={() => open(r.control)} style={button}>{r.label}</button></li>)}</ul>
    </details> : <span>Buffer draft ready</span>}
  </div>;
}

function Review({ row, decide, open }) {
  const [guiding, setGuiding] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const record = async choice => {
    setBusy(true); setError('');
    try { await decide(row, choice); setGuiding(false); setAck(false); }
    catch (e) { setError(e.message || 'Could not save the decision.'); }
    finally { setBusy(false); }
  };
  return <div style={{display:'grid',gap:8}}>
    {!guiding ? <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      {row.last?.decision !== 'keep' || row.last.assetId !== row.selectedId ? <button type="button" style={button} disabled={busy} onClick={() => record('keep')}>Keep current draft</button> : null}
      {row.autoReplace && <button type="button" style={button} onClick={() => setGuiding('auto')}>Replace draft media</button>}
      <button type="button" style={button} onClick={() => setGuiding('manual')}>Update manually in Buffer</button>
    </div> : guiding === 'auto' ? <>
      <p>Replace the media on Buffer draft {row.postId} with {row.selected}? This edits the existing post and preserves its caption and schedule.</p>
      <div><button type="button" style={button} disabled={busy} onClick={() => record('replace')}>Confirm media replacement</button> <button type="button" style={button} disabled={busy} onClick={() => setGuiding(false)}>Cancel</button></div>
    </> : <>
      <p>Open Drafts for {row.destination} and locate post {row.postId}. Replace its media with {row.selected}, preserve the caption, and save as a draft.</p>
      <div><button type="button" style={button} onClick={() => open(row.project, 'files')}>Open project files</button> · <a href="https://publish.buffer.com/" target="_blank" rel="noopener noreferrer">Open Buffer</a></div>
      <label><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} /> I verified this same post has the selected Final, its existing caption and its draft status.</label>
      <div><button type="button" style={button} disabled={!ack || busy} onClick={() => record('updated_in_buffer')}>Record verified update</button> <button type="button" style={button} disabled={busy} onClick={() => {setGuiding(false); setAck(false);}}>Cancel</button></div>
    </>}
    {error && <p role="alert">{error}</p>}
  </div>;
}

export default function BufferDraftQueue({ queue }) {
  const [attention, setAttention] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rows = attention ? queue.rows.filter(r => r.attention) : queue.rows;
  return <section aria-label="Buffer draft queue">
    <button type="button" style={button} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Buffer draft queue</button>
    {expanded && <div style={{border:'1px solid var(--border)',borderRadius:12,padding:14,marginTop:8}}>
      <label><input type="checkbox" checked={attention} onChange={e => setAttention(e.target.checked)} /> Needs attention</label>
      {!rows.length && <p>{attention ? 'No handoffs need attention.' : 'No visible projects.'}</p>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:10,marginTop:12}}>
        {rows.map(r => <article key={r.key} style={{borderTop:'1px solid var(--border)',padding:'10px 0',display:'grid',gap:5,alignContent:'start'}}>
          <span>{r.client}{r.brand && r.brand !== r.client ? ' · ' + r.brand : ''}</span>
          <button type="button" style={button} onClick={() => queue.open(r.project,'asset')}>{r.project.job} · {r.project.title}</button>
          <strong>{r.destination}{r.service && ' · ' + r.service}</strong>
          <span>{r.result}</span>
          {r.postId && <small>Buffer post {r.postId}</small>}
          {r.submitted && <small>Submitted Final · {r.submitted}</small>}
          {r.effective && r.effective !== r.submitted && <small>Verified draft media · {r.effective}</small>}
          <small>Project Final · {r.selected || 'Unselected'}</small>
          {r.last && <small>{r.last.decision === 'keep' ? 'Kept current draft' : 'Verified update in Buffer'} · {r.last.name} · V{r.last.version}</small>}
          {r.error && <small>{r.error}</small>}
          {r.reasons.length > 0 && <DraftReadiness reasons={r.reasons} open={control => queue.open(r.project,control)} />}
          {r.reviewable && queue.canReview && <Review key={r.key + r.selectedId + r.reviewCount} row={r} decide={queue.decide} open={queue.open} />}
        </article>)}
      </div>
    </div>}
  </section>;
}
