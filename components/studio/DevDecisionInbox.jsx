'use client';

import { useEffect, useState } from 'react';
import { readAll } from '@/lib/studio/paging';
import { decisionStates, decisionTarget, decisionTopics } from '@/lib/studio/dev-note-decisions';

const names = { assign: 'Assigned', answer: 'Answered', ready: 'Marked ready to try', accept: 'Accepted', reopen: 'Reopened' };
const label = person => person?.full_name || person?.name || 'Former reviewer';

function DecisionCard({ topic, history, notes, people, projects, sections, me, admin, save }) {
  const current = history[0];
  const def = decisionTopics[topic];
  const matches = notes.filter(n => def.match.test(n.content));
  const [selectedNote, setId] = useState(null);
  const id = current?.note_id || (selectedNote ?? (matches.length === 1 ? matches[0].id : ''));
  const [reviewer, setReviewer] = useState(current?.reviewer_id || '');
  const [project, setProject] = useState(current?.project_id || '');
  const [comment, setComment] = useState('');
  const [reassign, setReassign] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const note = notes.find(n => n.id === (current?.note_id || id));
  const candidates = people.filter(p => p.status === 'active' && (p.role === 'super_admin' || (['editor','manager','designer'].includes(p.role) && p.id === note?.created_by)));
  const reviewerName = current ? label(people.find(p => p.id === current.reviewer_id)) : '';
  const state = current?.state || 'needs_decision';
  const mine = !!current && me.id === current.reviewer_id;
  const target = decisionTarget(topic, note, current, projects, sections, me);
  const assignment = admin && (!current || reassign);
  const write = async action => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await save({ p_note: note.id, p_revision: current?.revision || 0, p_action: action, p_comment: action === 'assign' || action === 'ready' ? '' : comment.trim(),
        ...(action === 'assign' ? { p_topic: topic, p_reviewer: reviewer, p_project: project || null } : {}) });
      setComment(''); setReassign(false);
    } catch (err) { setError(err.message || String(err)); }
    finally { setBusy(false); }
  };
  return <details className="fb-decision">
    <summary>{def.title}<small>{current ? decisionStates[state] : 'Attach to a note'}</small></summary>
    <p><strong>{def.question}</strong></p><p>{def.evidence}</p>
    {note && <p>Original note · {note.content}<br />Implementation · {note.is_resolved ? 'Resolved' : 'Open'}</p>}
    {current && <p>Reviewer · {reviewerName}</p>}
    <p>Try as {def.role}<br />{target ? <><a href={target.href}>{target.label}</a>{target.reason && <small>{target.reason}</small>}</> : <small>This action is unavailable with your permissions.</small>}</p>
    {current && admin && state !== 'accepted' && <button type="button" onClick={() => { setReviewer(current.reviewer_id); setProject(current.project_id || ''); setReassign(x => !x); }}>{reassign ? 'Cancel assignment change' : 'Change assignment'}</button>}
    {assignment && <div>
      {!current && <label>Original Dev Note<select value={id} onChange={e => {setId(e.target.value);setReviewer('');}}>
        <option value="">Select a note</option>{notes.map(n => <option key={n.id} value={n.id}>{n.content}</option>)}
      </select></label>}
      <label>Decision reviewer<select value={reviewer} onChange={e => setReviewer(e.target.value)}>
        <option value="">Select a reviewer</option>{candidates.map(p => <option key={p.id} value={p.id}>{label(p)}</option>)}
      </select></label>
      {def.nav === 'projects' && <label>Try on a project (optional)<select value={project} onChange={e => setProject(e.target.value)}>
        <option value="">Use the dashboard screen</option>{projects.map(p => <option key={p.id} value={p.id}>{p.job} · {p.title}</option>)}
      </select></label>}
      <button type="button" disabled={busy || !note || !reviewer} onClick={() => write('assign')}>Save assignment</button>
    </div>}
    {current && !reassign && <>
      {mine && state === 'needs_decision' && !!def.choices.length && <label>Suggested answer<select value={def.choices.includes(comment) ? comment : ''} onChange={e => setComment(e.target.value)}>
        <option value="">Choose or write your own</option>{def.choices.map(c => <option key={c}>{c}</option>)}
      </select></label>}
      {(mine || (admin && state !== 'needs_decision')) && <label>{state === 'needs_decision' ? 'Your decision' : state === 'ready_to_try' && mine ? 'Acceptance comment or example' : 'Reason to reopen'}
        <textarea value={comment} maxLength={2000} onChange={e => setComment(e.target.value)} rows={2} /></label>}
      {mine && state === 'needs_decision' && <button disabled={busy || !comment.trim()} onClick={() => write('answer')}>Save answer</button>}
      {admin && state === 'needs_decision' && current.action === 'answer' && <button disabled={busy} onClick={() => write('ready')}>Mark ready to try</button>}
      {mine && state === 'ready_to_try' && <button disabled={busy || !comment.trim()} onClick={() => write('accept')}>Accept adjustment</button>}
      {(admin || mine) && state !== 'needs_decision' && <button disabled={busy || !comment.trim()} onClick={() => write('reopen')}>Reopen decision</button>}
      <h3>Decision history</h3><ol>{history.map(e => <li key={e.revision}>{names[e.action]} · {e.actor_name} · <time dateTime={e.created_at}>{new Date(e.created_at).toLocaleString()}</time>{e.action === 'assign' && <> · Reviewer {label(people.find(p => p.id === e.reviewer_id))}</>}{e.comment && <p>{e.comment}</p>}</li>)}</ol>
    </>}
    {error && <p role="alert">{error}</p>}
  </details>;
}

export default function DevDecisionInbox({ sb, workspaceId, notes, people, projects, sections, me, admin }) {
  const [events,setEvents] = useState(null);
  const [error,setError] = useState('');
  const [filter,setFilter] = useState('all');
  const [mine,setMine] = useState(false);
  const [attempts] = useState(() => new Map());
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    const load = async () => {
      const request = ++sequence;
      const {data,error:failure} = await readAll(() => sb.from('dev_note_decision_events').select('*').eq('workspace_id',workspaceId).order('note_id').order('revision',{ascending:false}));
      if (!active || sequence !== request) return;
      setError(failure?.message || '');
      if (!failure) setEvents(data);
    };
    load();
    const channel = sb.channel('dev-decisions-'+workspaceId).on('postgres_changes',{event:'INSERT',schema:'public',table:'dev_note_decision_events',filter:'workspace_id=eq.'+workspaceId},load).subscribe();
    return () => { active = false; sb.removeChannel(channel); };
  },[sb,workspaceId,refresh]);
  const save = async args => {
    const key = JSON.stringify(args);
    if (!attempts.has(key)) attempts.set(key,crypto.randomUUID());
    const result = await sb.rpc('record_dev_note_decision',{...args,p_request:attempts.get(key)});
    setRefresh(x => x + 1);
    if(result.error) throw Error(result.error.message);
    attempts.delete(key);
  };
  const groups = new Map();
  for (const e of events || []) {
    if(!groups.has(e.note_id)) groups.set(e.note_id,[]);
    groups.get(e.note_id).push(e);
  }
  const reviews = [...groups.values()];
  const available = notes.filter(n => !groups.has(n.id));
  const cards = Object.keys(decisionTopics).flatMap(topic => {
    const existing=reviews.filter(h => h[0].topic===topic);
    if(existing.length) return existing.map(history=>({topic,history}));
    return admin ? [{topic,history:[]}] : [];
  }).filter(({history}) => (filter === 'all' || filter === (history[0]?.state || 'needs_decision')) && (!mine || history[0]?.reviewer_id === me.id));
  return <section aria-label="Decision inbox" className="fb-decisions">
    <label>Status<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All decisions</option>{Object.entries(decisionStates).map(([key,name])=><option value={key} key={key}>{name}</option>)}</select></label>
    <label><input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)} /> Assigned to me</label>
    {error ? <p role="alert">{error} <button onClick={() => setRefresh(x => x + 1)}>Retry</button></p> : !events ? <p>Loading decisions…</p> : cards.length ? cards.map(({topic,history}) =>
      <DecisionCard key={cards.filter(card => card.topic === topic).length > 1 ? history[0].note_id : topic} {...{topic,history,people,projects,sections,me,admin,save}} notes={history.length ? notes : available} />) : <p>No decisions match this view.</p>}
  </section>;
}
