'use client';

import { useEffect, useRef, useState } from 'react';
import { scriptBeats } from '../../lib/studio/script';

function Dialog({ title, close, busy, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="idea-handoff-dialog" aria-label={title}
    onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <header><h2>{title}</h2><button type="button" disabled={busy} onClick={close}>Close</button></header>
    {children}
  </dialog>;
}

export function ArchiveProjectLink({ project }) {
  if (!project) return null;
  return <button type="button" className="idea-archive-project" onClick={project.open}>
    {project.job} · {project.title}{project.client ? ' · ' + project.client : ''}
  </button>;
}

export function HandoffPreview({ data, busy, close, confirm }) {
  const {destination, package: pack} = data;
  const beats = scriptBeats(pack);
  const summary = typeof pack.research?.summary === 'string' ? pack.research.summary : '';
  const sources = [ ...(pack.references || []), ...(Array.isArray(pack.research?.sources) ? pack.research.sources.map(x => x?.url) : []),
    ...(Array.isArray(pack.findings) ? pack.findings.map(x => x?.url) : []) ];
  const urls = [...new Set(sources.filter(x => typeof x === 'string' && /^https?:\/\/\S+$/i.test(x)))];
  return <Dialog title="Preview editor package" close={close} busy={busy}>
    <h3>{destination.title}</h3>
    <dl>{Object.entries({Client: destination.client || 'Unassigned', Channel: destination.channel || 'Unassigned',
      Sponsor: destination.sponsor, Stage: 'In Production', Status: destination.status, 'Content type': destination.contentType})
      .filter(([,value]) => value).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    <h3>Production brief and shoot notes</h3><p className="idea-handoff-text">{data.brief}</p>
    <h3>Script</h3>{beats.length ? <ol>{beats.map((beat,index) =>
      <li key={index}><strong>{[beat.time,beat.label].filter(Boolean).join(' · ')}</strong> {beat.text}</li>)}</ol> : <p>No script beats.</p>}
    <h3>Research and references</h3>
    {summary && <p className="idea-handoff-text">{summary}</p>}
    {urls.length ? <ul>{urls.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul>
      : !summary && <p>No research or reference links.</p>}
    <footer><button type="button" onClick={confirm} disabled={busy}>{busy ? 'Approving…' : 'Approve and create project'}</button></footer>
  </Dialog>;
}

const groups = [
  ['eligible','Eligible linked approvals'],
  ['missing','Missing projects'],
  ['review','Handoffs needing review'],
];

export function HistoricalHandoffs({ load, archive }) {
  const [open,setOpen] = useState(false);
  const [rows,setRows] = useState([]);
  const [selected,setSelected] = useState({});
  const [confirm,setConfirm] = useState(false);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  async function refresh() {
    setBusy(true); setError(''); setConfirm(false); setSelected({}); setRows([]);
    try { setRows(await load()); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); setError('');
    try {
      const count = await archive(selected);
      setNotice('Archived ' + count + (count === 1 ? ' handoff.' : ' handoffs.'));
      await refresh();
    } catch (e) { setError(e.message); setConfirm(false); setBusy(false); }
  }
  const chosen = Object.keys(selected).length;
  return <>
    <button type="button" className="idea-archive-project" onClick={() => {setOpen(true); setNotice(''); refresh();}}>Review historical handoffs</button>
    {open && <Dialog title="Historical handoff review" busy={busy} close={() => setOpen(false)}>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error} <button type="button" onClick={refresh} disabled={busy}>Refresh review</button></p>}
      {busy && !rows.length ? <p role="status">Loading handoffs…</p> : groups.map(([group,label]) => {
        const matches = rows.filter(r => r.group === group);
        return <section key={group}><h3>{label} ({matches.length})</h3>{matches.map(r => <article key={r.id}>
          {group === 'eligible' && <label><input type="checkbox" aria-label={'Select '+r.title}
            checked={!!selected[r.id]} disabled={busy || confirm}
            onChange={event => setSelected(prev => {const next = {...prev}; if (event.target.checked) next[r.id] = r.projectId; else delete next[r.id]; return next;})} />Select</label>}
          <details><summary>{r.title}</summary>
            <p>Source idea · {r.id}</p><p>Brand · {r.brand || 'Unassigned'}</p>
            {r.approvedAt && <p>Approved · {new Date(r.approvedAt).toLocaleString()}</p>}
            {r.job && <p>Project · {r.job} · {r.projectTitle}</p>}
            {group === 'missing' && <p>A linked project could not be found in this workspace.</p>}
            {group === 'review' && <p>The project snapshot {r.snapshotSource ? 'names another source idea.' : 'has no source idea ID.'}</p>}
          </details></article>)}</section>;
      })}
      {confirm ? <footer><p>Archive {chosen} selected {chosen === 1 ? 'idea' : 'ideas'}? The linked projects keep their production packages.</p>
        <button type="button" disabled={busy} onClick={submit}>Confirm archive</button>{' '}
        <button type="button" disabled={busy} onClick={() => setConfirm(false)}>Back</button></footer>
        : <footer><button type="button" disabled={!chosen || busy} onClick={() => setConfirm(true)}>Archive selected ({chosen})</button></footer>}
    </Dialog>}
  </>;
}
