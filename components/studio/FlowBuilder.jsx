'use client';
// Workflow builder: Automations > New flow, or a workflow card. A full-screen canvas (handoff Santos-Builder): the top
// bar, the step library on the left, the flow in one column with a + between cards, and the inspector on the right.
// A branch is one card with its paths as lanes; the steps inside a path are edited from the branch's inspector.
//
// The same canvas maps processes and ideas: kind 'process' or 'idea' never runs, so it can hold manual tasks and notes
// alongside the actions it would take. Every card, and the flow itself, can be tagged with dashboard data (projects,
// ideas, clients, people, statuses, channels, brands) and connector data (connectors, YouTube videos, Buffer channels).
// Messages take data tokens ({{project.title}}) that the runner fills in; on screen a token is always a named chip
// (workflow/RichField.jsx). The graph model and runner rules are in lib/automations/graph.ts; saving goes through
// A.saveFlow (lib/studio/actions.js). Drafts save on their own; a live automation waits for Save.
/* eslint-disable react-hooks/exhaustive-deps */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { ACTIONS, actionById, triggerById, triggerText, projectTriggers, fits, scopeOf } from '@/lib/automations/catalog';
import { KINDS, TAG_TYPES, FIELDS, OPS, TOKENS, emptyGraph, graphOf, issuesOf, newId, walk, stepCount, plural, cannotRunYet } from '@/lib/automations/graph';
import { T, KIND, R, H, SHADOW, FONT, WF_CSS } from '@/lib/workflow/theme';
import { AGENT, AGENT_SHORT, STATUS, STEP_COPY, NODE_COPY, TRIGGER_COPY, VAR_LABEL } from '@/lib/workflow/copy';
import { stepOf, fieldOf } from '@/lib/workflow/graph';
import { Svg, ICON, KindTile, Seg, btn, inputStyle, labelStyle, srOnly, useModal, Dialog } from './workflow/ui';
import RichField, { RICH_CSS } from './workflow/RichField';
import StepFinder from './workflow/StepFinder';
import DigestInspector from './workflow/DigestInspector';
import SettingsModal from './workflow/SettingsModal';
import TriggerModal from './workflow/TriggerModal';
import ConditionModal from './workflow/ConditionModal';
import TestDrawer, { rowState } from './workflow/TestDrawer';
import ReviewModal from './workflow/ReviewModal';
import { clarificationChoices, applyClarification, comparableTrigger } from '@/lib/workflow/review';
import { CompareProjects, RevisionChanges, Clarifications } from './workflow/WorkflowReview';
import { draftWorkflow, workflowConnections } from '@/lib/workflow/authoring';

// Unsaved changes in the open builder. Studio.jsx checks it on browser Back and asks instead of closing the builder.
export const flowGuard = { dirty: false, url: '', ask: null };

// ---------- Icons ----------
const IC = {
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  next: 'M5 12h14M13 6l6 6-6 6',
  todo: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  split: 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9',
  task: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 11l2 2 4-4',
  note: 'M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', close: 'M18 6 6 18M6 6l12 12', back: 'M15 18l-6-6 6-6', chev: 'M6 9l6 6 6-6', right: 'M9 18l6-6-6-6',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
  play: 'M6 4l14 8-14 8V4z', pencil: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  fit: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M19 12l-7 7-7-7', check: 'M20 6 9 17l-5-5', warn: 'M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01', grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  panel: 'M3 3h18v18H3zM9 3v18', data: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
};
const Ico = ({ d, size = 16, sw = 1.8, style }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={css(style)}><path d={d} /></svg>
);

const STEP_DEF = {
  delay: { label: 'Time delay', icon: IC.clock, tone: 'gray', desc: 'Wait before the next step' },
  split: { label: 'Split', icon: IC.split, tone: 'gray', desc: 'Send work down different paths' },
  task: { label: 'Task', icon: IC.task, tone: 'green', desc: 'A To-Do for someone on the team' },
  note: { label: 'Note', icon: IC.note, tone: 'amber', desc: 'An idea or a sticky note; never runs' },
  // Step types from workflow templates (lib/workflow/copy.js).
  data: { label: 'Board data', icon: IC.data, tone: 'blue', desc: 'Reads the project from the board' },
  ai: { label: 'Assistant', icon: IC.note, tone: 'violet', desc: 'Studio Assistant writes or summarizes' },
  approval: { label: 'Approval', icon: IC.task, tone: 'gray', desc: 'Pauses until a Super Admin approves' },
};
const toneBg = (t) => (t === 'gray' ? 'var(--chip-2)' : 'var(--' + t + '-soft)');
const toneInk = (t) => (t === 'gray' ? 'var(--ink-3)' : 'var(--' + t + '-ink)');
const RING = '#2F5BD3';

// ---------- Shared styles ----------
const S = {
  btn: 'display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; padding: 0 14px; box-sizing: border-box; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit;',
  ghost: 'border: 1px solid var(--border-2); background: var(--surface); color: var(--ink);',
  primary: 'border: 1px solid var(--inv); background: var(--inv); color: var(--inv-ink);',
  icon: 'display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; flex: none; padding: 0; border: 0; border-radius: 10px; background: transparent; color: var(--ink-3); cursor: pointer;',
  label: labelStyle,
  input: inputStyle,
  area: 'width: 100%; min-height: 96px; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--border-2); border-radius: 10px; background: var(--surface); color: var(--ink); font-size: 14px; line-height: 1.5; font-family: inherit; resize: vertical;',
  muted: 'margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted);',
  pop: 'position: absolute; z-index: 30; min-width: 240px; max-height: 360px; overflow-y: auto; padding: 6px; box-sizing: border-box; background: var(--surface); border: 1px solid var(--line-4); border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.16);',
  item: 'display: flex; align-items: center; gap: 10px; width: 100%; min-height: 38px; padding: 0 10px; box-sizing: border-box; border: 0; border-radius: 9px; background: transparent; color: var(--ink); font-size: 14px; text-align: left; cursor: pointer; font-family: inherit;',
  head: 'margin: 0; padding: 8px 10px 4px; font-size: 12px; font-weight: 600; color: var(--muted-2);',
};

// ---------- Tags: dashboard and connector data ----------
export function tagSources(D) {
  const live = (D.integrations || []).filter((g) => g.status === 'connected');
  const out = [
    ...(D.rows || []).filter((r) => !r.archived).map((r) => ({ type: 'project', id: r.id, label: r.job ? r.job + ' · ' + r.title : r.title })),
    ...(D.ideas || []).map((i) => ({ type: 'idea', id: i.id, label: i.title || 'Untitled idea' })),
    ...(D.accounts || []).map((a) => ({ type: 'client', id: a.id, label: a.name })),
    ...(D.members || []).filter((m) => m.status === 'active').map((m) => ({ type: 'person', id: m.user_id, label: (m.person && (m.person.full_name || m.person.name)) || 'Member' })),
    ...(D.statuses || []).map((x) => ({ type: 'status', id: x.id, label: x.label })),
    ...(D.channels || []).map((x) => ({ type: 'channel', id: x.id, label: x.name })),
    ...(D.brands || []).map((x) => ({ type: 'brand', id: x.id, label: x.name })),
    ...(D.integrations || []).map((g) => ({ type: 'connector', id: g.provider, label: g.name + (g.status === 'connected' ? '' : ' (not connected)') })),
    ...(D.youtube || []).slice(0, 60).map((v) => ({ type: 'video', id: v.video_id || v.id, label: v.title || v.video_id })),
    ...((D.buffer && D.buffer.channels) || []).map((c) => ({ type: 'buffer', id: c.channel_id || c.id, label: (c.display_name || c.name) + (c.service ? ' · ' + c.service : '') })),
  ];
  return { list: out.filter((t) => t.label), connectedCount: live.length };
}

function TagChips({ tags, max = 3, small }) {
  if (!tags || !tags.length) return null;
  const shown = tags.slice(0, max);
  const chip = (tone) => 'display: inline-flex; align-items: center; gap: 4px; max-width: 150px; height: ' + (small ? 22 : 24) + 'px; padding: 0 8px; box-sizing: border-box; border-radius: 999px; background: ' + toneBg(tone) + '; color: ' + toneInk(tone) + '; font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
  return (
    <span style={css('display: inline-flex; flex-wrap: wrap; gap: 4px; min-width: 0;')}>
      {shown.map((t) => (
        <span key={t.type + t.id} title={TAG_TYPES[t.type].label.replace(/s$/, '') + ': ' + t.label} style={css(chip((TAG_TYPES[t.type] || {}).tone || 'blue'))}>
          <span style={css('overflow: hidden; text-overflow: ellipsis;')}>{t.label}</span>
        </span>
      ))}
      {tags.length > max ? <span style={css(chip('gray'))}>+{tags.length - max}</span> : null}
    </span>
  );
}

// "Select tags" field, grouped by source with a search box. Like Klaviyo's tag select: shows "N selected" when set.
// The list opens inline, not as an overlay, so dialogs and side panels (scroll containers) never clip it.
function TagSelect({ id, value, onChange, sources, label = 'Tags' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [only, setOnly] = useState('');
  const sel = new Set((value || []).map((t) => t.type + ':' + t.id));
  const ql = q.trim().toLowerCase();
  const hits = sources.filter((t) => (!only || t.type === only) && (!ql || t.label.toLowerCase().includes(ql)));
  const groups = Object.keys(TAG_TYPES).map((k) => ({ k, items: hits.filter((t) => t.type === k).slice(0, ql || only ? 60 : 8) })).filter((g) => g.items.length);
  const present = Object.keys(TAG_TYPES).filter((k) => sources.some((t) => t.type === k));
  const flip = (t) => onChange(sel.has(t.type + ':' + t.id) ? value.filter((x) => !(x.type === t.type && x.id === t.id)) : (value || []).concat([{ type: t.type, id: t.id, label: t.label }]));
  return (
    <div style={css('position: relative; display: flex; flex-direction: column; gap: 6px;')} onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}>
      <label htmlFor={id} style={css(S.label)}>{label}</label>
      <button type="button" id={id} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}
        style={css(S.input + ' display: flex; align-items: center; gap: 8px; cursor: pointer; text-align: left; padding-right: 8px;')}>
        {value && value.length ? (
          <span style={css('display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 6px 0 10px; border-radius: 6px; background: var(--chip); font-size: 13px; color: var(--ink-2);')}>
            {value.length} selected
            <span role="button" tabIndex={0} aria-label="Clear tags" onClick={(e) => { e.stopPropagation(); onChange([]); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChange([]); } }} style={css('display: inline-flex; color: var(--muted);')}><Ico d={IC.close} size={12} sw={2.2} /></span>
          </span>
        ) : <span style={css('color: var(--muted-2);')}>Select tags</span>}
        <span style={css('flex: 1;')} />
        <Ico d={IC.chev} />
      </button>
      {value && value.length ? <TagChips tags={value} max={6} small /> : null}
      {open ? (
        <>
          <button type="button" tabIndex={-1} aria-label="Close tags" onClick={() => setOpen(false)} style={css('position: fixed; inset: 0; z-index: 29; border: 0; background: transparent; cursor: default;')} />
          <div role="listbox" aria-multiselectable="true" aria-label={label} style={css(S.pop + ' position: relative; max-height: 320px;')}>
            <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, people, connectors…" aria-label="Search tags" style={css(S.input + ' min-height: 36px; margin-bottom: 6px;')} />
            <div style={css('display: flex; flex-wrap: wrap; gap: 4px; padding: 0 2px 6px;')}>
              {[''].concat(present).map((k) => (
                <button key={k || 'all'} type="button" aria-pressed={only === k} onClick={() => setOnly(k)}
                  style={css('height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid ' + (only === k ? 'var(--ink)' : 'var(--line-4)') + '; background: ' + (only === k ? 'var(--ink)' : 'transparent') + '; color: ' + (only === k ? 'var(--surface)' : 'var(--ink-3)') + '; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;')}>
                  {k ? TAG_TYPES[k].label : 'All'}
                </button>
              ))}
            </div>
            {groups.length ? groups.map((g) => (
              <Fragment key={g.k}>
                <p style={css(S.head)}>{TAG_TYPES[g.k].label}</p>
                {g.items.map((t) => {
                  const on = sel.has(t.type + ':' + t.id);
                  return (
                    <button key={t.type + t.id} type="button" role="option" aria-selected={on} onClick={() => flip(t)} className="mitem" style={css(S.item)}>
                      <span style={css('width: 18px; height: 18px; flex: none; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; border: 1.5px solid ' + (on ? RING : 'var(--border-strong)') + '; background: ' + (on ? RING : 'transparent') + '; color: #FFFFFF;')}>{on ? <Ico d={IC.check} size={12} sw={3} /> : null}</span>
                      <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{t.label}</span>
                    </button>
                  );
                })}
              </Fragment>
            )) : <p style={css(S.muted + ' padding: 10px;')}>Nothing matches.</p>}
          </div>
        </>
      ) : null}
    </div>
  );
}

// A plain select styled like the board's fields.
function Pick({ id, label, value, onChange, options, placeholder }) {
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px; min-width: 0;')}>
      {label ? <label htmlFor={id} style={css(S.label)}>{label}</label> : null}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label ? undefined : placeholder} style={css(S.input + ' padding-right: 8px; cursor: pointer;')}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
      </select>
    </div>
  );
}

// ---------- Graph edits (immutable: clone, change, return) ----------
const clone = (g) => JSON.parse(JSON.stringify(g));
// The list a path id names (null: the top level), and the node and list for a node id.
function listOf(g, pathId) {
  if (!pathId) return g.steps;
  let found = null;
  walk(g.steps, (n) => { if (!found && n.type === 'split') (n.paths || []).forEach((p) => { if (p.id === pathId) found = p.steps; }); });
  return found;
}
function locate(g, id) {
  const look = (list, pathId) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.id === id) return { list, index: i, node: n, pathId };
      if (n.type === 'split') for (const p of n.paths || []) {
        if (p.id === id) return { path: p, split: n, list: p.steps, pathId: p.id };
        const r = look(p.steps, p.id);
        if (r) return r;
      }
    }
    return null;
  };
  return look(g.steps, null);
}
function makeNode(spec) {
  const base = { id: newId(), tags: [] };
  if (spec.type === 'action') return { ...base, type: 'action', key: spec.key, message: '' };
  if (spec.type === 'delay') return { ...base, type: 'delay', amount: 1, unit: 'days' };
  if (spec.type === 'task') return { ...base, type: 'task', title: '', owner: '', note: '' };
  if (spec.type === 'note') return { ...base, type: 'note', title: '', note: '' };
  if (spec.type === 'data') return { ...base, type: 'data', key: spec.key || 'get_project', title: spec.title || '' };
  if (spec.type === 'approval') return { ...base, type: 'approval', title: 'Approval', note: '', timeoutHours: 24 };
  // A branch: work takes Yes when its rule matches, No otherwise, then the main line carries on below.
  return { ...base, type: 'split', name: '', paths: [
    { id: newId('p'), name: 'Yes', when: [], steps: [] },
    { id: newId('p'), name: 'No', when: [], steps: [] },
  ] };
}
// The card on the main line that holds a nested step or path ('' when the id is on the main line itself).
function ownerOf(g, id) {
  for (const n of g.steps) {
    if (n.id === id) return '';
    if (n.type !== 'split') continue;
    let hit = false;
    const look = (s) => (s.paths || []).forEach((p) => { if (p.id === id) hit = true; p.steps.forEach((c) => { if (c.id === id) hit = true; if (c.type === 'split') look(c); }); });
    look(n);
    if (hit) return n.id;
  }
  return '';
}
// The branch a path belongs to.
function splitOf(g, pathId) {
  const at = locate(g, pathId);
  return at && at.split ? at.split.id : '';
}
// A copy of a step with fresh ids all the way down.
function reId(n) {
  n.id = newId();
  if (n.type === 'split') (n.paths || []).forEach((p) => { p.id = newId('p'); p.steps.forEach(reId); });
  return n;
}

// ---------- Create flow dialog ----------
const promptExample = 'Create a Buffer draft when a project reaches Scheduled in Publishing';
function WorkflowPrompt({ value, onChange, optional }) {
  return <label style={css('display: grid; gap: 6px; font-size: 14px; font-weight: 600;')}>
    {optional ? 'Describe the workflow (optional)' : 'Describe the workflow'}
    <textarea rows={3} maxLength={2000} value={value} onChange={e => onChange(e.target.value)} placeholder={promptExample}
      style={css(inputStyle + ' padding: 10px 12px; line-height: 1.5; resize: vertical;')} />
  </label>;
}

export function CreateFlowDialog({ D, A, onCreated, onClose }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('automation');
  const [prompt, setPrompt] = useState('');
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const sources = useMemo(() => tagSources(D).list, [D]);
  const layer = useRef(null);
  useModal(layer, '#cf-name');
  const create = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const graph = kind === 'automation' && prompt.trim() ? draftWorkflow(prompt, D) : emptyGraph(kind);
    graph.tags = tags;
    const row = await A.saveFlow(null, graph, { name: name.trim() });
    setBusy(false);
    if (row) onCreated(row);
  };
  return (
    <div ref={layer} style={css('position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(0,0,0,0.45);')} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="cf-title" onSubmit={create}
        style={css('width: 560px; max-width: 100%; max-height: calc(100vh - 32px); overflow-y: auto; box-sizing: border-box; padding: 28px 32px; background: var(--surface); border-radius: 20px; box-shadow: 0 24px 80px rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 20px; color: var(--ink); font-family: var(--font-main);')}>
        <div style={css('display: flex; align-items: center; gap: 12px;')}>
          <h2 id="cf-title" style={css('flex: 1; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.01em;')}>Create flow</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={css(S.icon)}><Ico d={IC.close} size={18} /></button>
        </div>
        <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
          <label htmlFor="cf-name" style={css(S.label)}>Name</label>
          <input id="cf-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Filming kickoff, Sponsor review process" style={css(S.input + ' min-height: 44px;')} />
        </div>
        <fieldset style={css('margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 6px;')}>
          <legend style={css(S.label + ' margin-bottom: 6px;')}>Type</legend>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;')}>
            {KINDS.map((k) => (
              <label key={k[0]} style={css('display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: 12px; cursor: pointer; border: ' + (kind === k[0] ? '2px solid ' + RING : '1px solid var(--border-2)') + '; margin: ' + (kind === k[0] ? '0' : '1px') + ';')}>
                <span style={css('display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600;')}>
                  <input type="radio" name="cf-kind" value={k[0]} checked={kind === k[0]} onChange={() => setKind(k[0])} style={css('margin: 0; accent-color: ' + RING + ';')} />
                  {k[1]}
                </span>
                <span style={css('font-size: 12px; line-height: 1.4; color: var(--muted);')}>{k[2]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {kind === 'automation' ? <WorkflowPrompt optional value={prompt} onChange={setPrompt} /> : null}
        <TagSelect id="cf-tags" value={tags} onChange={setTags} sources={sources} />
        <div style={css('display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px;')}>
          <button type="button" onClick={onClose} style={css(S.btn + S.ghost + ' min-height: 44px;')}>Cancel</button>
          <button type="submit" disabled={!name.trim() || busy} style={css(S.btn + S.primary + ' min-height: 44px;' + (!name.trim() || busy ? ' opacity: 0.45; cursor: default;' : ''))}>{busy ? 'Creating…' : 'Create flow'}</button>
        </div>
      </form>
    </div>
  );
}

// ---------- The builder ----------
const GROUP = { trigger: 'Trigger', data: 'Board', action: 'Action', logic: 'Logic', ai: AGENT_SHORT, human: 'Team' };
const KIND_ORDER = ['trigger', 'data', 'action', 'logic', 'ai', 'human'];
const lower = (x) => String(x || '').replace(/^./, (c) => c.toLowerCase());
const stamp = () => new Date().toISOString();
const cardStyle = (on) => 'width: 380px; max-width: calc(100vw - 48px); text-align: left; font-family: inherit; background: ' + T.surface + '; border: ' + (on ? '1.5px solid ' + T.ring : '1px solid ' + T.chipLine) + '; border-radius: ' + R.card + 'px; box-shadow: ' + (on ? '0 0 0 3px rgba(47,91,234,.14)' : SHADOW.card) + '; color: ' + T.ink + '; padding: ' + (on ? '13.5px 15.5px' : '14px 16px') + '; display: flex; flex-direction: column; gap: 10px; cursor: pointer;';
const pillStyle = (fg, bg) => 'flex: none; display: flex; align-items: center; gap: 4px; background: ' + bg + '; color: ' + fg + '; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 600; white-space: nowrap;';
const tagStyle = 'background: ' + T.ground2 + '; border: 1px solid ' + T.line + '; border-radius: 999px; padding: 3px 9px; font-size: 12px; font-weight: 500; color: ' + T.ink3 + ';';
const wire = <span aria-hidden="true" style={css('width: 1.5px; height: 16px; flex: none; background: ' + T.wire + ';')} />;

function TopBtn({ cls, icon, label, onClick, off }) {
  return <button type="button" className={'wf-h fbx-btn ' + cls} aria-label={label} title={label} disabled={off} onClick={onClick} style={css(btn('ghost') + (off ? ' opacity: .55;' : ''))}><Svg d={icon} size={16} /><span className="fbx-lbl">{label}</span></button>;
}

export default function FlowBuilder({ D, A, row, onClose, onOpenDraft, goConnect, goHub, review }) {
  const [g, setG] = useState(() => graphOf(row));
  const [name, setName] = useState(row.name);
  const [category, setCategory] = useState(row.category || 'custom');
  // Edits made and edits saved, as counters: the flow is unsaved while they differ.
  const [ver, setVer] = useState(0);
  const [savedVer, setSavedVer] = useState(0);
  const dirty = ver !== savedVer;
  const [sel, pickSel] = useState(() => (graphOf(row).kind === 'automation' && !graphOf(row).trigger.key ? 'trigger' : ''));
  const [finder, setFinder] = useState(null); // the + that opened the step finder: { pathId, index, afterTitle, afterKind }
  const [left, setLeft] = useState('steps'); // left panel tab: steps | overview
  const [lq, setLq] = useState('');
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState('');
  // review (turn on) | update (save a live automation) | leave | delete:<split id> | delpath:<path id>
  const [confirm, setConfirm] = useState(review ? 'review' : '');
  // The test run in the drawer: { phase: 'wait' | 'play' | 'done', rows, shown, stop, error, token } (workflow/TestDrawer.jsx).
  const [test, setTest] = useState(null);
  const [compareOpen,setCompareOpen] = useState(false);
  const [sampleProjectId, setSampleProjectId] = useState('');
  const [prompt, setPrompt] = useState(null);
  const [ack, setAck] = useState(false); // Review: "I have checked what this sends" for steps that send outside
  const [focusField, setFocusField] = useState('');
  const [peek, setPeek] = useState(false);
  const [ins, setIns] = useState(null); // a data chip to put in the focused message field: { token, n }
  const setSel = (id) => { pickSel(id); setFocusField(''); setPeek(false); setIns(null); };
  const [toast, setToast] = useState('');
  const [autoFail, setAutoFail] = useState(false);
  // The open dialog, kept in the URL (?panel=settings | trigger | condition&step=<branch id>).
  const [panel, setPanel] = useState(() => {
    const q = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
    const nm = q ? q.get('panel') : '';
    return nm === 'settings' || nm === 'trigger' ? { name: nm } : nm === 'condition' && q.get('step') ? { name: nm, step: q.get('step') } : null;
  });
  const canvas = useRef(null);
  const content = useRef(null);
  const pan = useRef(null);
  const root = useRef(null);
  const toastTimer = useRef(null);
  useModal(root, 'button[data-back]');

  const sources = useMemo(() => tagSources(D).list, [D]);
  const connected = useMemo(() => workflowConnections(D), [D.integrations, D.buffer]);
  const issues = useMemo(() => issuesOf(g, connected), [g, connected]);
  const warns = issues.filter((x) => x.level === 'warn');
  const paused = !!((D.settings || {}).automation || {}).paused;
  const runs = g.kind === 'automation';
  const live = runs && row.enabled && !row.is_draft;
  const status = !runs ? '' : row.is_draft ? 'draft' : row.enabled ? 'live' : 'off';
  const scope = scopeOf(g.trigger.key);

  const say = (text) => { setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4000); };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Any edit clears the last test result (handoff Rule 4) and marks the flow unsaved.
  const touch = () => { setVer((v) => v + 1); setAutoFail(false); };
  const edit = (fn) => { setG((prev) => { const next = clone(prev); fn(next); if (next.lastTest) next.lastTest = null; return next; }); setTest(null); touch(); };
  const blankDraft = row.is_draft && !g.trigger.key && !g.steps.length && !g.description;
  const generateDraft = async () => {
    if (!prompt?.trim() || busy || dirty) return;
    const generated = draftWorkflow(prompt, D);
    setBusy('assistant');
    try {
      if (blankDraft) {
        const next = { ...g, ...generated, tags: g.tags, settings: g.settings, lastTest: null };
        const saved = await A.saveFlow(row, next, { name, category, status: 'draft' });
        if (!saved) return;
        setG(next); setTest(null); setSel(next.steps[0]?.id || 'trigger');
      } else {
        const saved = await A.saveFlow(null, generated, { name: name + ' · Assistant draft', status: 'draft', revisionSource:live ? row.id : row.revision_source_id });
        if (!saved) return;
        onOpenDraft(saved);
      }
      setPrompt(null);
    } finally { setBusy(''); }
  };
  const editNode = (id, patch) => edit((x) => { const at = locate(x, id); if (at && at.node) Object.assign(at.node, patch); });
  const add = (pathId, index, spec) => {
    const node = makeNode(spec);
    edit((x) => { const list = listOf(x, pathId); if (list) list.splice(Math.min(index, list.length), 0, node); });
    setSel(node.id); setFinder(null);
  };
  const pickTrigger = (tr) => {
    edit((x) => { x.trigger.key = tr.key; x.trigger.value = tr.values === 'statuses' ? ((D.statuses || [])[0] || {}).label || '' : tr.values ? tr.values[0][0] : ''; });
    setSel('trigger');
  };
  const remove = (id) => {
    const at = locate(g, id);
    edit((x) => { const a2 = locate(x, id); if (a2 && a2.node) a2.list.splice(a2.index, 1); });
    setSel(at && at.pathId ? splitOf(g, at.pathId) : ''); setConfirm('');
  };
  const duplicate = (id) => {
    const at = locate(g, id);
    if (!at || !at.node) return;
    const copy = reId(clone(at.node));
    edit((x) => { const a2 = locate(x, id); a2.list.splice(a2.index + 1, 0, copy); });
    setSel(copy.id);
  };
  const move = (id, dir) => edit((x) => {
    const at = locate(x, id);
    if (!at || !at.node) return;
    const j = at.index + dir;
    if (j < 0 || j >= at.list.length) return;
    const [n] = at.list.splice(at.index, 1);
    at.list.splice(j, 0, n);
  });

  // quiet: the autosave of a draft, with no Activity Log entry.
  // over: a graph or name a dialog has just produced, saved before the state update lands.
  const save = async (mode, quiet, over) => {
    if (busy) return null;
    const v = ver;
    setBusy(mode === 'live' ? 'live' : 'save');
    const saved = await A.saveFlow(row, (over && over.graph) || g, { name: ((over && over.name) || name).trim() || row.name, category, status: mode, quiet: !!quiet });
    setBusy('');
    if (saved) setSavedVer(v);
    if (!saved && quiet) setAutoFail(true);
    return saved;
  };
  // Drafts, turned-off flows and maps save on their own a moment after the last edit. A live automation waits for
  // Save, which asks first: saving it changes what the next runs do.
  useEffect(() => {
    if (!dirty || live || busy || confirm || autoFail || panel) return undefined;
    const t = setTimeout(() => { save(undefined, true); }, 1500);
    return () => clearTimeout(t);
  }, [g, name, category, dirty, live, busy, confirm, autoFail, panel]);

  // A dialog's Save: the change lands in the builder and, unless the workflow is live, is saved straight away. A
  // live workflow keeps it as an unsaved change until Save in the top bar, which asks first.
  const commit = async (fn, nm) => {
    const next = clone(g);
    fn(next);
    setG(next);
    if (nm) setName(nm);
    if (live) { touch(); return true; }
    return !!(await save(undefined, false, { graph: next, name: nm }));
  };
  const saveSettings = (x) => commit((n2) => { n2.owner = x.owner; n2.description = x.description; n2.settings = x.settings; }, x.name);
  const saveTrigger = (x) => { setTest(null); return commit((n2) => { Object.assign(n2.trigger, x); n2.lastTest = null; }); };
  const saveBranch = (node) => { setTest(null); return commit((n2) => { const a2 = locate(n2, node.id); if (a2 && a2.node) a2.list[a2.index] = node; n2.lastTest = null; }); };
  useEffect(() => {
    const u = new URL(window.location.href);
    ['panel', 'step'].forEach((k) => u.searchParams.delete(k));
    if (panel) { u.searchParams.set('panel', panel.name); if (panel.step) u.searchParams.set('step', panel.step); }
    if (u.search !== window.location.search) window.history.replaceState(window.history.state, '', u.pathname + u.search);
  }, [panel]);

  const dialog = confirm === 'update' || confirm === 'leave' ? confirm : '';
  // Test run: the runner describes every step on the newest project and sends nothing (the graph on screen, saved or
  // not, so testing never changes a live automation). The drawer then plays the result card by card and stops at the
  // first broken step: one that needs setup, or one the runner could not do. `plan` is the cards in order with what is
  // in the way of each (testPlan below).
  const runTest = async (plan) => {
    if (busy) return;
    const at = g, token = at; // the graph being tested marks this run: an edit replaces it, and a late result is dropped
    setConfirm(''); setBusy('test');
    setTest({ token, phase: 'wait', shown: 0, stop: plan.length, error: '', rows: plan.map((c) => ({ id: c.id, n: c.n, title: c.title, out: '', final: '' })) });
    let run = null, error = '';
    try { run = await A.testAutomation(row.id, g, hasDraftAction || comparableTrigger(g.trigger.key) ? sampleRow?.id : undefined); } catch (err) { error = err.message || String(err); }
    setBusy('');
    const out = (run && run.output) || {};
    if (out.sampleSkipped) {
      const info = (out.checks || []).map(c=>c.detail).join(' ');
      setTest({token,phase:'done',shown:1,stop:1,skipped:true,rows:[{id:'trigger',n:'T',title:'Sample skipped',out:info,final:'skip'}]});
      setG(prev => prev===at ? {...prev,lastTest:{ok:false,skipped:true,at:stamp()}} : prev);
      if (!live) setVer(v=>v+1);
      return;
    }
    const done = {};
    (out.steps || []).forEach((x) => { const k = x.id === 'trigger' ? 'trigger' : ownerOf(at, x.id) || x.id; (done[k] = done[k] || []).push(x); });
    let stop = plan.length, failed = false;
    const rows = plan.map((c, i) => {
      if (failed) return { id: c.id, n: c.n, title: c.title, out: '', final: '' };
      const got = done[c.id] || [];
      const bad = got.find((x) => !x.ok);
      const fix = c.fix || (bad ? bad.detail : '');
      if (fix) { failed = true; stop = i + 1; return { id: c.id, n: c.n, title: c.title, out: fix, final: 'fail' }; }
      const said = got.map((x) => x.detail).join(' ');
      return { id: c.id, n: c.n, title: c.title, final: 'ok', out: said || (c.id === 'trigger' ? (out.project ? 'On ' + out.project.job + ' · ' + out.project.title : out.idea ? 'On ' + out.idea.title : 'No project to test on yet') : 'Ready') };
    });
    if (!run && !failed) error = error || 'The test could not run.';
    else if (run && run.error && !failed) error = run.error;
    const ok = !failed && !error;
    setTest((cur) => (cur && cur.token === token ? { token, phase: 'play', shown: 0, stop, error, rows } : cur));
    // A passing test is remembered with the flow (Review needs one); any edit clears it. A live flow keeps it in the
    // builder only, so testing never marks it unsaved.
    setG((prev) => (prev === at ? { ...prev, lastTest: { ok, at: stamp() } } : prev));
    if (!live) setVer((v) => v + 1);
  };
  // Plays the result: one card at a time.
  useEffect(() => {
    if (!test || test.phase !== 'play') return undefined;
    const t = setTimeout(() => setTest((x) => (x && x.phase === 'play' ? { ...x, shown: x.shown + 1, phase: x.shown + 1 >= x.stop ? 'done' : 'play' } : x)), 380);
    return () => clearTimeout(t);
  }, [test]);
  const leave = () => { if (dirty) setConfirm('leave'); else onClose(); };
  // Leaving for Run history or Connectors: a draft saves first; a live flow with changes asks.
  const exitTo = async (go) => {
    if (dirty && live) { setConfirm('leave'); return; }
    if (dirty && !(await save(undefined, true))) return;
    go();
  };
  const setStatus = (next) => {
    if (next === status || busy) return;
    if (next === 'live') { if (ready && !row.revision_source_id) turnOn(); else setConfirm('review'); } else save(next).then((ok) => { if (ok) say(name + (next === 'off' ? ' is off' : ' is a draft')); });
  };

  useEffect(() => {
    flowGuard.dirty = dirty;
    flowGuard.ask = () => setConfirm('leave');
    if (!flowGuard.url) flowGuard.url = window.location.pathname + window.location.search;
  }, [dirty]);
  useEffect(() => () => { flowGuard.dirty = false; flowGuard.ask = null; flowGuard.url = ''; }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || finder || panel) return;
      if (confirm) { setConfirm(''); return; }
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (test && test.phase === 'done') { setTest(null); return; }
      if (sel) { setSel(''); return; }
      leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm, finder, panel, test, sel, dirty]);
  useEffect(() => {
    const before = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [dirty]);

  // ---------- What each card shows ----------
  const optionsFor = (source) => {
    if (source === 'status') return (D.statuses || []).map((x) => [x.label, x.label]);
    if (source === 'channel') return (D.channels || []).map((x) => [x.id, x.name]);
    if (source === 'type') return (D.types || []).map((x) => [x.id, x.label]);
    if (source === 'client') return (D.accounts || []).map((x) => [x.id, x.name]);
    if (source === 'person') return (D.members || []).filter((m) => m.status === 'active').map((m) => [m.user_id, (m.person && (m.person.full_name || m.person.name)) || 'Member']);
    if (source === 'approval') return [['pending', 'Pending'], ['approved', 'Approved'], ['changes_requested', 'Changes Requested']];
    if (source === 'edit_status') return [['assigned', 'Assigned'], ['editing', 'Editing'], ['in_review', 'In Review'], ['needs_revision', 'Needs Revision'], ['approved', 'Approved']];
    return [];
  };
  const critText = (c) => {
    const f = FIELDS.find((x) => x.key === c.field);
    if (!f) return '';
    const v = c.op === 'set' || c.op === 'empty' ? '' : ' ' + ((optionsFor(f.source).find((o) => o[0] === c.value) || [c.value, c.value || '…'])[1]);
    return f.label + ' ' + OPS[c.op] + v;
  };
  const personName = (id) => { const m = (D.members || []).find((x) => x.user_id === id); return m ? (m.person && (m.person.full_name || m.person.name)) || 'a teammate' : ''; };
  // The card an issue belongs to: its own on the main line, or the branch that holds it.
  const cardOf = (id) => (id === 'trigger' || id === 'end' ? id : ownerOf(g, id) || id);
  const fixCards = new Set(warns.map((x) => cardOf(x.id)));
  // Each card's state in the test run on screen: 'wait' | 'run' | 'ok' | 'fail', or nothing when no test is showing.
  const tested = {};
  if (test) test.rows.forEach((r, i) => { tested[r.id] = rowState(test, i); });

  const viewOf = (n, i) => {
    const v = stepOf(n);
    const paths = n.paths || [];
    return {
      id: n.id, kind: v.kind, title: v.title, eyebrow: (i === null ? '' : 'Step ' + (i + 1) + ' · ') + v.kindLabel,
      detail: n.type === 'delay' ? 'Waits, then carries on with the next step'
        : n.type === 'split' ? (paths[0] && paths[0].when.length ? paths[0].when.map(critText).join(paths[0].match === 'any' ? ' or ' : ' and ') + ((paths[0].or || []).length ? ', or ' + plural(paths[0].or.length, 'other group') : '') : 'Add a rule to decide which path work takes')
          : n.type === 'task' ? (n.owner ? 'For ' + personName(n.owner) : runs ? 'For Super Admins' : 'Unassigned') + (n.note ? ' · ' + fieldOf('', n.note).value : '')
            : n.type === 'action' && !n.key ? 'Choose what this step does' : v.desc,
      lanes: n.type === 'split' ? paths.map((p, pi) => ({ label: paths.length === 2 ? (pi === 0 ? 'If yes' : 'If no') : p.name, yes: pi === 0, text: p.steps.length ? stepOf(p.steps[0]).title + (p.steps.length > 1 ? ' +' + (p.steps.length - 1) + ' more' : '') : 'Continue' })) : null,
      app: v.app, needConn: runs && !!v.needs && !connected[v.needs], outward: v.outward, issue: fixCards.has(n.id), test: tested[n.id],
    };
  };
  const trig = {
    id: 'trigger', kind: 'trigger', eyebrow: runs ? 'Trigger' : g.kind === 'process' ? 'Start' : 'Spark',
    title: runs ? (g.trigger.key ? (TRIGGER_COPY[g.trigger.key] || [triggerText(g.trigger.key, '')])[0] : 'Pick a trigger') : g.kind === 'process' ? 'How it starts' : 'The spark',
    detail: runs ? (g.trigger.key ? (g.trigger.key === 'schedule' ? triggerText('schedule', g.trigger.value) : 'When ' + lower(triggerText(g.trigger.key, g.trigger.value))) + (g.trigger.filters || []).map((c) => ' and ' + lower(critText(c))).join('') : 'Choose what starts this workflow from the Steps list') : g.trigger.text || (g.kind === 'process' ? 'Describe how this process starts' : 'What sparks this idea?'),
    app: runs ? (g.trigger.key === 'schedule' ? 'Schedule' : g.trigger.key === 'webhook' ? 'Webhook' : 'Board') : KINDS.find((k) => k[0] === g.kind)[1], issue: fixCards.has('trigger'), lanes: null, test: tested.trigger,
  };
  const cards = [trig].concat(g.steps.map((n, i) => viewOf(n, i)));

  const stepCard = (c) => (
    <button type="button" className="wf-card" onClick={(e) => { e.stopPropagation(); setSel(c.id); }} aria-pressed={sel === c.id} aria-label={'Select ' + c.title} style={css(cardStyle(sel === c.id))}>
      <span style={css('display: flex; align-items: center; gap: 12px; width: 100%;')}>
        <KindTile kind={c.kind} size={38} />
        <span style={css('display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;')}>
          <span style={css('font-size: 12px; font-weight: 600; color: ' + KIND[c.kind].ink + ';')}>{c.eyebrow}</span>
          <span style={css('font-weight: 700; font-size: 16px; line-height: 1.3; overflow-wrap: anywhere;')}>{c.title}</span>
        </span>
        {c.test === 'run' ? <span className="wf-pulse" style={css(pillStyle(T.varInk, T.varBg))}>Running</span>
          : c.test === 'fail' ? <span style={css(pillStyle(T.error, T.errorBg))}>Failed</span>
            : c.test === 'ok' ? <span style={css(pillStyle(T.live, T.liveBg))}>Passed</span>
              : c.test === 'wait' ? <span style={css(pillStyle(T.sub, T.count))}>Waiting</span>
                : c.issue ? <span style={css(pillStyle(T.warnInk, T.warnBg))}><Svg d={ICON.warn} size={12} sw={2.2} />Needs setup</span> : null}
      </span>
      {c.detail ? <span style={css('font-size: 14px; color: ' + T.sub + '; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;')}>{c.detail}</span> : null}
      {c.lanes ? (
        <span style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%;')}>
          {c.lanes.map((l, i) => (
            <span key={i} style={css('border-radius: 10px; background: ' + (l.yes ? T.liveBg : T.ground2) + '; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; min-width: 0;')}>
              <span style={css('font-size: 12px; font-weight: 700; color: ' + (l.yes ? T.live : T.sub) + '; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{l.label}</span>
              <span style={css('font-size: 13px; color: ' + T.ink2 + '; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{l.text}</span>
            </span>
          ))}
        </span>
      ) : null}
      <span style={css('display: flex; gap: 6px; flex-wrap: wrap;')}>
        {c.app ? <span style={css(tagStyle)}>{c.app}</span> : null}
        {c.needConn ? <span style={css(tagStyle + ' display: flex; align-items: center; gap: 5px; background: ' + T.surface + '; color: ' + T.warnInk + ';')}><span aria-hidden="true" style={css('width: 6px; height: 6px; border-radius: 999px; background: ' + T.warn + ';')} />Not connected</span> : null}
        {c.outward ? <span style={css('background: ' + T.accent + '; color: ' + T.accentInk + '; border-radius: 999px; padding: 3px 9px; font-size: 12px; font-weight: 600;')}>Sends outside</span> : null}
      </span>
    </button>
  );

  // ---------- Step library (left panel) ----------
  const lib = [];
  if (runs) projectTriggers().forEach((tr) => lib.push({ id: 't:' + tr.key, kind: 'trigger', title: (TRIGGER_COPY[tr.key] || [tr.label])[0], desc: (TRIGGER_COPY[tr.key] || ['', ''])[1], app: 'Board', trigger: tr }));
  if (scope === 'project') lib.push({ id: 'data:get_project', kind: 'data', title: NODE_COPY.data.title, desc: NODE_COPY.data.desc, app: 'Board', spec: { type: 'data', key: 'get_project', title: NODE_COPY.data.title } });
  ACTIONS.filter((a) => fits(a, scope)).forEach((a) => {
    const c = STEP_COPY[a.key] || { kind: 'action', title: a.label, desc: '' };
    lib.push({ id: a.key, kind: c.kind, title: c.title, desc: c.desc, app: a.app, spec: { type: 'action', key: a.key }, off: runs && !!a.needs && !connected[a.needs] });
  });
  lib.push({ id: 'split', kind: 'logic', title: NODE_COPY.split.title, desc: 'Split into yes and no paths', app: 'Logic', spec: { type: 'split' } });
  lib.push({ id: 'delay', kind: 'logic', title: 'Wait', desc: 'Wait minutes, hours or days', app: 'Logic', spec: { type: 'delay' } });
  if (runs) lib.push({ id: 'approval', kind: 'human', title: NODE_COPY.approval.title, desc: NODE_COPY.approval.desc, app: 'Team', spec: { type: 'approval' } });
  lib.push({ id: 'task', kind: 'human', title: 'Task', desc: NODE_COPY.task.desc, app: 'Team', spec: { type: 'task' } });
  if (!runs) lib.push({ id: 'note', kind: 'human', title: 'Note', desc: 'An idea or a sticky note; never runs', app: 'Team', spec: { type: 'note' } });
  const lql = lq.trim().toLowerCase();
  const libShown = lib.filter((it) => !lql || (it.title + ' ' + it.desc + ' ' + it.app + ' ' + GROUP[it.kind]).toLowerCase().includes(lql));

  const libItem = (it) => (
    <button key={it.id} type="button" className="wf-li" aria-label={it.trigger ? 'Use trigger ' + it.title : 'Add ' + it.title + ' at the end'} aria-pressed={it.trigger ? g.trigger.key === it.trigger.key : undefined}
      onClick={() => (it.trigger ? pickTrigger(it.trigger) : add(null, g.steps.length, it.spec))}
      style={css('text-align: left; display: flex; gap: 10px; align-items: flex-start; padding: 10px; border-radius: 12px; background: ' + T.surface + '; border: 1px solid ' + (it.trigger && g.trigger.key === it.trigger.key ? T.ring : T.line) + '; color: ' + T.ink + ';')}>
      <KindTile kind={it.kind} size={30} />
      <span style={css('display: flex; flex-direction: column; gap: 2px; min-width: 0;')}>
        <span style={css('font-weight: 600; font-size: 14px;')}>{it.title}</span>
        <span style={css('font-size: 13px; color: ' + T.muted + '; line-height: 1.4;')}>{it.desc}</span>
        {it.off ? <span style={css('font-size: 12px; font-weight: 600; color: ' + T.warnInk + ';')}>{it.app} is not connected</span> : null}
      </span>
    </button>
  );
  const fact = (k, v, color) => (
    <div key={k} style={css('border: 1px solid ' + T.line + '; border-radius: 12px; padding: 12px;')}>
      <div style={css('font-size: 12px; font-weight: 500; color: ' + T.muted + ';')}>{k}</div>
      <div style={css('font-family: ' + FONT.display + '; font-weight: 900; font-size: 20px; margin-top: 4px; color: ' + (color || T.ink) + ';')}>{v}</div>
    </div>
  );
  const lastTest = g.lastTest ? (g.lastTest.ok ? 'Passed' : g.lastTest.skipped ? 'Skipped' : 'Failed') : 'Not run';
  const overview = () => (
    <div className="wf-sc" style={css('flex: 1; overflow: auto; padding: 4px 16px 16px; display: flex; flex-direction: column; gap: 14px;')}>
      <label htmlFor="fb-desc" style={css(labelStyle)}>What it does</label>
      <textarea id="fb-desc" rows={3} value={g.description || ''} onChange={(e) => edit((x) => { x.description = e.target.value; })} placeholder="One or two lines for the team"
        style={css('margin-top: -8px; border-radius: 12px; background: ' + T.ground2 + '; border: 1px solid ' + T.border + '; color: ' + T.ink + '; padding: 12px; font-family: inherit; font-size: 14px; line-height: 1.5; resize: vertical;')} />
      <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;')}>
        {fact('Steps', stepCount(g))}
        {fact('To fix', warns.length, warns.length ? T.warnInk : T.ink)}
        {runs ? fact('Runs', row.run_count || 0) : null}
        {runs ? fact('Last test', lastTest, lastTest === 'Failed' ? T.error : lastTest === 'Passed' ? T.live : T.ink) : null}
      </div>
      <Pick id="fb-kind" label="Type" value={g.kind} onChange={(v) => edit((x) => { x.kind = v; if (v !== 'automation' && !x.trigger.key) x.trigger.key = 'manual'; if (v === 'automation' && x.trigger.key === 'manual') x.trigger.key = ''; })} options={KINDS.map((k) => [k[0], k[1]])} />
      <Pick id="fb-cat" label="Section" value={category} onChange={(v) => { setCategory(v); touch(); }} options={[['production', 'Production'], ['sponsor', 'Sponsors & clients'], ['publishing', 'Publishing & distribution'], ['custom', 'Custom']]} />
      <TagSelect id="fb-ftags" value={g.tags} onChange={(v) => edit((x) => { x.tags = v; })} sources={sources} />
      <div style={css('background: ' + T.ground2 + '; border-radius: 12px; padding: 12px; font-size: 13px; line-height: 1.55; color: ' + T.ink2 + ';')}>
        {runs ? 'Runs on its own when the trigger fires. Steps marked Sends outside reach people outside the team, so check them before you turn the workflow on.' : KINDS.find((k) => k[0] === g.kind)[2] + '.'}
        {g.kind !== 'automation' && row.enabled && !row.is_draft ? ' Saving as a ' + g.kind + ' turns the automation off.' : ''}
      </div>
    </div>
  );

  // ---------- Inspector (right panel) ----------
  const at = sel && sel !== 'trigger' ? locate(g, sel) : null;
  const tokens = scope === 'idea' ? ['idea.title', 'idea.stage', 'idea.score', 'idea.link', 'trigger', 'flow.name'] : TOKENS.map((t) => t[0]);
  const sampleProjects = (D.rows || []).filter(r => !r.archived);
  let hasDraftAction = false;
  walk(g.steps, n => { if (n.type === 'action' && n.key === 'buffer_draft') hasDraftAction = true; });
  const mappedBrands = new Set((D.buffer?.channels || []).filter(c => !c.is_locked && !c.is_disconnected).map(c => c.draft_brand_id));
  const draftSample = hasDraftAction && (sampleProjects.find(r => r.id === sampleProjectId) || sampleProjects.find(r => {
    const setup = D.publish?.[r.id];
    return r.editStatus === 'Approved' && setup?.draft_asset_id && setup.draft_brand_id && mappedBrands.has(setup.draft_brand_id);
  }));
  const sampleRow = draftSample || sampleProjects[0] || null;
  const sample = sampleRow ? [['Project', sampleRow.title], ['Job', sampleRow.job], ['Stage', sampleRow.status], ['Channel', sampleRow.channel], ['Editor', sampleRow.editor], ['Designer', sampleRow.designer]].filter((x) => x[1]) : [];
  const text = (id, label, value, onChange, placeholder, required) => (
    <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
      <label htmlFor={id} style={css(labelStyle)}>{label}{required ? <span aria-hidden="true" style={css('color: ' + T.error + ';')}> *</span> : null}</label>
      <input id={id} autoComplete="off" aria-required={required ? 'true' : undefined} value={value || ''} onChange={(e) => onChange(e.target.value)} onFocus={() => setFocusField('')} placeholder={placeholder} style={css(inputStyle)} />
    </div>
  );
  const help = (t) => <p style={css('margin: 0; font-size: 13px; line-height: 1.5; color: ' + T.muted + ';')}>{t}</p>;
  const addData = (label) => (
    <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
      <div style={css('font-size: 13px; font-weight: 600; color: ' + T.ink3 + ';')}>Add data to {label}</div>
      <div style={css('display: flex; flex-wrap: wrap; gap: 6px;')}>
        {tokens.map((k) => (
          <button key={k} type="button" className="wf-h" onMouseDown={(e) => e.preventDefault()} onClick={() => setIns({ token: k, n: Date.now() })}
            style={css('min-height: 34px; padding: 0 12px 0 9px; border-radius: 999px; background: ' + T.varBg + '; border: 1px solid ' + T.chipLine + '; color: ' + T.varInk + '; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;')}>
            <Svg d={ICON.plus} size={11} sw={2.6} />{VAR_LABEL[k] || k}
          </button>
        ))}
      </div>
    </div>
  );
  const head = (kind, eyebrow, title, app, extra) => (
    <div style={css('padding: 18px; border-bottom: 1px solid ' + T.line + '; display: flex; gap: 12px; align-items: flex-start;')}>
      <KindTile kind={kind} size={42} />
      <div style={css('display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;')}>
        <div style={css('font-size: 12px; font-weight: 600; color: ' + KIND[kind].ink + ';')}>{eyebrow}</div>
        <h2 style={css('margin: 0; font-size: 18px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere;')}>{title}</h2>
        {app ? <div style={css('font-size: 13px; color: ' + T.muted + ';')}>{app}</div> : null}
      </div>
      {extra}
    </div>
  );
  const fixNote = (id) => issues.filter((x) => x.id === id && !/^Connect /.test(x.title)).map((x, i) => (
    <div key={i} role="status" style={css('background: ' + T.warnBg + '; border-radius: 12px; padding: 12px; font-size: 14px; line-height: 1.5; color: ' + T.warnInk + ';')}><strong>{x.title}.</strong> {x.body}</div>
  ));
  const iconBtn = (label, d, onClick, off) => (
    <button type="button" className="wf-h" aria-label={label} title={label} disabled={off} onClick={onClick} style={css('width: 34px; height: 34px; flex: none; border: 0; border-radius: 9px; background: transparent; color: ' + T.ink3 + '; display: flex; align-items: center; justify-content: center;' + (off ? ' opacity: .35;' : ''))}><Svg d={d} size={15} /></button>
  );

  const triggerBody = () => {
    if (!runs) return (
      <>
        <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
          <label htmlFor="fb-start" style={css(labelStyle)}>{g.kind === 'process' ? 'Starts when' : 'The spark'}</label>
          <textarea id="fb-start" rows={3} value={g.trigger.text} onChange={(e) => edit((x) => { x.trigger.text = e.target.value; })} placeholder={g.kind === 'process' ? 'A sponsor signs, a video is greenlit…' : 'What if we…'} style={css(inputStyle + ' padding: 10px 12px; line-height: 1.5; resize: vertical;')} />
        </div>
        <TagSelect id="fb-ttags" value={g.trigger.tags} onChange={(v) => edit((x) => { x.trigger.tags = v; })} sources={sources} />
      </>
    );
    const t = triggerById(g.trigger.key);
    return (
      <>
        {fixNote('trigger')}
        <div style={css('background: ' + T.ground2 + '; border-radius: 12px; padding: 12px 14px; font-size: 14px; line-height: 1.5; color: ' + T.ink2 + ';')}>
          {t ? <>Work enters the flow <strong>{lower(trig.detail)}</strong>.</> : 'Pick a trigger from the Steps list, or set one up with a schedule or a webhook. A workflow has one trigger; picking another replaces it.'}
        </div>
        <button type="button" className="wf-k" onClick={() => setPanel({ name: 'trigger' })} style={css(btn('primary') + ' border-radius: 10px;')}>{t ? 'Edit trigger' : 'Set up the trigger'}</button>
        <TagSelect id="fb-ttags" value={g.trigger.tags} onChange={(v) => edit((x) => { x.trigger.tags = v; })} sources={sources} />
      </>
    );
  };

  const pathBlock = (n, p, i) => {
    const lastP = i === n.paths.length - 1;
    const label = n.paths.length === 2 ? (i === 0 ? 'If yes' : 'If no') : lastP ? 'Otherwise' : 'Path ' + (i + 1);
    return (
      <div key={p.id} style={css('border: 1px solid ' + T.line + '; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px;')}>
        <div style={css('display: flex; align-items: center; gap: 8px;')}>
          <span style={css('font-size: 12px; font-weight: 700; color: ' + (i === 0 ? T.live : T.sub) + ';')}>{label}</span>
          <span style={css('flex: 1; min-width: 0; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{p.name}</span>
          <button type="button" className="wf-h" onClick={() => (lastP ? setSel(p.id) : setPanel({ name: 'condition', step: n.id, path: p.id }))} style={css(btn('ghost', 32) + ' padding: 0 10px; font-size: 13px;')}>{lastP ? 'Rename' : 'Edit rule'}</button>
        </div>
        <div style={css('font-size: 13px; color: ' + (fixCards.has(n.id) && !lastP && issues.some((x) => x.id === p.id) ? T.warnInk : T.muted) + ';')}>{lastP ? 'Everything the paths before did not take' : p.when.length ? p.when.map(critText).join(p.match === 'any' ? ' or ' : ' and ') + ((p.or || []).length ? ', or ' + plural(p.or.length, 'other group') : '') : 'No rule yet, so nothing takes this path'}</div>
        {p.steps.map((c) => {
          const v = stepOf(c);
          return (
            <button key={c.id} type="button" className="wf-li" onClick={() => setSel(c.id)} aria-label={'Select ' + v.title} style={css('display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; background: ' + T.surface + '; border: 1px solid ' + T.line + '; color: ' + T.ink + '; text-align: left;')}>
              <KindTile kind={v.kind} size={24} />
              <span style={css('flex: 1; min-width: 0; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{v.title}</span>
              <Svg d={ICON.chev} size={13} color={T.muted} />
            </button>
          );
        })}
        <button type="button" className="wf-h" aria-label={'Add a step to ' + p.name} onClick={() => setFinder({ pathId: p.id, index: p.steps.length, afterTitle: p.steps.length ? stepOf(p.steps[p.steps.length - 1]).title : stepOf(n).title, afterKind: p.steps.length ? stepOf(p.steps[p.steps.length - 1]).kind : 'logic' })}
          style={css('height: 34px; border-radius: 10px; background: transparent; border: 1px dashed ' + T.inputLine + '; color: ' + T.ink3 + '; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;')}><Svg d={ICON.plus} size={13} />Add step</button>
      </div>
    );
  };

  const mappedChannels = (D.buffer?.channels || []).filter(c => c.draft_brand_id).map(c => {
    const brand = (D.brands || []).find(b => b.id === c.draft_brand_id);
    return (brand?.name || 'Mapped brand') + ' → ' + (c.display_name || c.name || c.channel_id);
  });
  const nodeBody = (n) => {
    const def = n.type === 'action' ? actionById(n.key) : null;
    const delAsk = confirm === 'delete:' + n.id;
    const inner = n.type === 'split' ? (n.paths || []).reduce((c, p) => { let k = 0; walk(p.steps, () => { k++; }); return c + k; }, 0) : 0;
    const richLabel = n.type === 'action' && n.key !== 'slack_production_digest' && def && def.message ? def.message : n.type === 'task' ? 'Notes' : '';
    return (
      <>
        {def && def.needs && runs && !connected[def.needs] ? (
          <div style={css('background: ' + T.warnBg + '; border: 1px solid ' + T.chipLine + '; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px;')}>
            <div style={css('font-size: 14px; color: ' + T.warnInk + ';')}>{def.app} is not connected. This step fails until it is.</div>
            <button type="button" className="wf-k" onClick={() => exitTo(() => goConnect(def.needs))} style={css(btn('primary') + ' border-radius: 10px;')}>Connect {def.app}</button>
            <button type="button" className="wf-l" onClick={() => exitTo(() => goHub('connectors'))} style={css('min-height: 36px; border: 0; background: transparent; font-size: 13px; font-weight: 600; color: ' + T.link + '; text-decoration: underline;')}>Manage all connectors</button>
          </div>
        ) : null}
        {fixNote(n.id)}
        {n.type === 'action' ? (
          <>
            <Pick id="fb-act" label="Action" value={n.key || ''} placeholder={n.key ? undefined : 'Choose an action'} onChange={(v) => editNode(n.id, { key: v, ...(n.title === 'Manual setup' ? { title: '', note: '' } : {}) })} options={ACTIONS.filter((a) => fits(a, scope)).map((a) => [a.key, (STEP_COPY[a.key] || {}).title || a.label])} />
            {n.key === 'buffer_draft' && sampleProjects.length > 0 ? <Pick id="fb-buffer-sample" label="Preview project" value={sampleRow?.id || ''} options={sampleProjects.map(r => [r.id, r.job + ' · ' + r.title])}
              onChange={id => { setSampleProjectId(id); setTest(null); setG(prev => ({ ...prev, lastTest: null })); if (!live) touch(); }} /> : null}
            {n.key === 'slack_production_digest' ? <DigestInspector key={n.id} trigger={g.trigger} workspaceZone={D.settings?.timezone}
              channel={n.message || ''} onChange={value => editNode(n.id, { message: value })} connected={connected.slack} live={live} /> : def && def.message ? <RichField key={n.id} id="fb-msg" label={def.message} value={n.message} onChange={(v) => editNode(n.id, { message: v })} onFocus={() => setFocusField(def.message)} focused={focusField === def.message} insert={ins} rows={3} placeholder="Leave empty to send the standard message" /> : null}
            {def && !def.message ? help(def.key === 'status_next' || def.key === 'idea_stage_next' ? 'Moves it to the stage after its current one, with the board’s approval and lock rules.' : def.key === 'buffer_draft' ? 'Uses the approved Final video and brand channels configured under Social post → Buffer drafts.' + (mappedChannels.length ? ' Current mappings: ' + mappedChannels.join(', ') + '.' : '') : def.key === 'buffer_publish' ? 'Posts the project’s Social post to the Buffer channels chosen in the project drawer.' : def.key === 'idea_research' ? 'Scores the idea and gathers sources, the same as Research in Ideas.' : 'Sends the run and its project to your n8n workflow.') : null}
          </>
        ) : null}
        {n.type === 'task' ? (
          <>
            {text('fb-ttl', 'Task', n.title, (v) => editNode(n.id, { title: v }), 'Book the studio')}
            <Pick id="fb-own" label="Owner" value={n.owner || ''} onChange={(v) => editNode(n.id, { owner: v })} placeholder={runs ? 'Every Super Admin' : 'Unassigned'}
              options={(D.members || []).filter((m) => m.status === 'active').map((m) => [m.user_id, (m.person && (m.person.full_name || m.person.name)) || 'Member'])} />
            <RichField key={n.id} id="fb-tnote" label="Notes" value={n.note} onChange={(v) => editNode(n.id, { note: v })} onFocus={() => setFocusField('Notes')} focused={focusField === 'Notes'} insert={ins} rows={3} placeholder="Checklist, links, who to ask" />
            {runs ? help('When the flow runs, this adds a To-Do on the owner’s Daily page.') : null}
          </>
        ) : null}
        {n.type === 'note' ? (
          <>
            {text('fb-nt', 'Title', n.title, (v) => editNode(n.id, { title: v }), 'Try a teaser cut')}
            <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
              <label htmlFor="fb-nn" style={css(labelStyle)}>Note</label>
              <textarea id="fb-nn" rows={6} value={n.note || ''} onChange={(e) => editNode(n.id, { note: e.target.value })} placeholder="Thinking out loud is welcome here." style={css(inputStyle + ' padding: 10px 12px; line-height: 1.5; resize: vertical;')} />
            </div>
            {help('Notes never run. They keep ideas next to the steps they are about.')}
          </>
        ) : null}
        {n.type === 'delay' ? (
          <div style={css('display: grid; grid-template-columns: 1fr 1fr; gap: 10px;')}>
            <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
              <label htmlFor="fb-amt" style={css(labelStyle)}>Wait</label>
              <input id="fb-amt" type="number" min={0} max={365} value={n.amount} onChange={(e) => editNode(n.id, { amount: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })} style={css(inputStyle)} />
            </div>
            <Pick id="fb-unit" label="Unit" value={n.unit || 'days'} onChange={(v) => editNode(n.id, { unit: v })} options={[['minutes', 'Minutes'], ['hours', 'Hours'], ['days', 'Days']]} />
          </div>
        ) : null}
        {n.type === 'split' ? (
          <>
            {text('fb-sn', 'Question', n.name, (v) => editNode(n.id, { name: v }), 'Sponsored video?')}
            <button type="button" className="wf-k" onClick={() => setPanel({ name: 'condition', step: n.id })} style={css(btn('primary') + ' border-radius: 10px;')}>Edit condition</button>
            {help('Work takes the first path whose rule it matches. The last path takes everything else, then the flow carries on below.')}
            {n.paths.map((p, i) => pathBlock(n, p, i))}
            <button type="button" className="wf-h" disabled={n.paths.length >= 6} onClick={() => edit((x) => { const s2 = locate(x, n.id).node; s2.paths.splice(s2.paths.length - 1, 0, { id: newId('p'), name: 'Path ' + s2.paths.length, when: [], steps: [] }); })}
              style={css(btn('ghost', 40) + (n.paths.length >= 6 ? ' opacity: .4;' : ''))}><Svg d={ICON.plus} size={14} />Add a path</button>
          </>
        ) : null}
        {n.type === 'approval' ? (
          <>
            {text('fb-at', 'Name', n.title, (v) => editNode(n.id, { title: v }), 'Approval')}
            <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
              <label htmlFor="fb-an" style={css(labelStyle)}>Why it needs a person</label>
              <textarea id="fb-an" rows={3} value={n.note || ''} onChange={(e) => editNode(n.id, { note: e.target.value })} placeholder="Anything that leaves the studio waits for a Super Admin." style={css(inputStyle + ' padding: 10px 12px; line-height: 1.5; resize: vertical;')} />
            </div>
            <Pick id="fb-ato" label="If nobody decides" value={String(n.timeoutHours == null ? 24 : n.timeoutHours)} onChange={(v) => editNode(n.id, { timeoutHours: Number(v) })} options={[['4', 'Reject after 4 hours'], ['24', 'Reject after 24 hours'], ['72', 'Reject after 3 days'], ['0', 'Keep waiting']]} />
            {help('The run pauses here and every Super Admin is told. Approving lets the step below run; rejecting stops the run.')}
            <button type="button" className="wf-h" onClick={() => exitTo(() => goHub('approvals'))} style={css(btn('ghost') + ' border-radius: 10px;')}>Open approvals</button>
          </>
        ) : null}
        {n.type === 'data' || n.type === 'ai' ? (
          <>
            {text('fb-xt', 'Name', n.title, (v) => editNode(n.id, { title: v }), STEP_DEF[n.type].label)}
            {help(n.type === 'data' && (n.key || 'get_project') === 'get_project' ? 'Loads the project this run is about, so later steps can use its title, stage, people and dates.' : STEP_DEF[n.type].desc + '.')}
          </>
        ) : null}
        {richLabel ? addData(richLabel) : null}
        <div style={css('border: 1px solid ' + T.line + '; border-radius: 12px; overflow: hidden;')}>
          <button type="button" className="wf-h" aria-expanded={peek} onClick={() => setPeek(!peek)} style={css('width: 100%; height: 44px; display: flex; justify-content: space-between; align-items: center; padding: 0 12px; background: ' + T.surface + '; border: 0; color: ' + T.ink + '; font-weight: 600; font-size: 14px;')}>Sample data<span style={css('color: ' + T.muted + '; font-weight: 500;')}>{peek ? 'Hide' : 'Show'}</span></button>
          {peek ? (
            <div style={css('padding: 0 12px 12px; display: flex; flex-direction: column; gap: 6px; font-size: 13px;')}>
              {sample.length ? sample.map((ln) => <div key={ln[0]} style={css('display: flex; justify-content: space-between; gap: 12px;')}><span style={css('color: ' + T.muted + ';')}>{ln[0]}</span><span style={css('color: ' + T.ink + '; font-weight: 500; text-align: right; overflow-wrap: anywhere;')}>{ln[1]}</span></div>) : <span style={css('color: ' + T.muted + ';')}>No project to sample yet.</span>}
              {sample.length ? <span style={css('color: ' + T.muted + ';')}>{hasDraftAction ? 'Test run uses the preview project selected in the Buffer draft step.' : 'From the newest project. Test run uses the same one.'}</span> : null}
            </div>
          ) : null}
        </div>
        <TagSelect id="fb-ntags" value={n.tags} onChange={(v) => editNode(n.id, { tags: v })} sources={sources} />
        <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;')}>
          <button type="button" className="wf-h" onClick={() => duplicate(n.id)} style={css(btn('ghost') + ' border-radius: 10px;')}>Duplicate</button>
          <button type="button" className="wf-h" onClick={() => (n.type === 'split' && inner > 0 && !delAsk ? setConfirm('delete:' + n.id) : remove(n.id))} style={css(btn('danger') + ' border-radius: 10px; white-space: normal; line-height: 1.2;' + (delAsk ? ' background: ' + T.errorBg + ';' : ''))}>
            {delAsk ? 'Delete it and ' + plural(inner, 'step') + '?' : 'Delete'}
          </button>
        </div>
      </>
    );
  };

  const pathBody = (p, split) => {
    const idx = split.paths.findIndex((x) => x.id === p.id);
    const lastP = idx === split.paths.length - 1;
    const editPath = (fn) => edit((x) => { const at2 = locate(x, p.id); if (at2 && at2.path) fn(at2.path, at2.split); });
    const inner = stepCount({ steps: p.steps });
    return (
      <>
        {fixNote(p.id)}
        {text('fb-pn', 'Path name', p.name, (v) => editPath((pp) => { pp.name = v; }))}
        {lastP ? help('Everything the paths before this one did not take comes here.') : (
          <>
            <div style={css('background: ' + T.ground2 + '; border-radius: 12px; padding: 12px 14px; font-size: 14px; line-height: 1.5; color: ' + T.ink2 + ';')}>{p.when.length ? 'Taken when ' + lower(p.when.map(critText).join(p.match === 'any' ? ' or ' : ' and ')) + '.' : 'No rule yet, so nothing takes this path.'}</div>
            <button type="button" className="wf-k" onClick={() => setPanel({ name: 'condition', step: split.id, path: p.id })} style={css(btn('primary') + ' border-radius: 10px;')}>Edit condition</button>
          </>
        )}
        {!lastP && split.paths.length > 2 ? (
          <button type="button" className="wf-h" onClick={() => {
            if (inner && confirm !== 'delpath:' + p.id) { setConfirm('delpath:' + p.id); return; }
            edit((x) => { const s2 = locate(x, split.id).node; s2.paths = s2.paths.filter((q) => q.id !== p.id); }); setSel(split.id); setConfirm('');
          }} style={css(btn('danger') + ' border-radius: 10px;' + (confirm === 'delpath:' + p.id ? ' background: ' + T.errorBg + ';' : ''))}>{confirm === 'delpath:' + p.id ? 'Delete path and ' + plural(inner, 'step') + '?' : 'Delete path'}</button>
        ) : null}
      </>
    );
  };

  const backTo = (id, title) => (
    <button type="button" className="wf-h" onClick={() => setSel(id)} style={css('align-self: flex-start; height: 36px; margin: 12px 0 -6px 12px; padding: 0 10px 0 6px; border: 0; border-radius: 9px; background: transparent; color: ' + T.ink + '; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 4px;')}><Svg d={ICON.back} size={15} />{title}</button>
  );
  const inspector = () => {
    if (sel === 'trigger') return (<>{head('trigger', trig.eyebrow, trig.title, trig.app)}<div style={css('padding: 18px; display: flex; flex-direction: column; gap: 16px;')}>{triggerBody()}</div></>);
    if (at && at.node) {
      const n = at.node, v = stepOf(n), mainIdx = at.pathId ? -1 : at.index;
      const parent = at.pathId ? splitOf(g, at.pathId) : '';
      return (
        <>
          {parent ? backTo(parent, stepOf(locate(g, parent).node).title) : null}
          {head(v.kind, (mainIdx >= 0 ? 'Step ' + (mainIdx + 1) + ' · ' : '') + v.kindLabel, v.title, v.app, (
            <div style={css('display: flex; flex: none;')}>
              {iconBtn('Move up', ICON.up, () => move(n.id, -1), at.index === 0)}
              {iconBtn('Move down', ICON.down, () => move(n.id, 1), at.index === at.list.length - 1)}
            </div>
          ))}
          <div style={css('padding: 18px; display: flex; flex-direction: column; gap: 16px;')}>{nodeBody(n)}</div>
        </>
      );
    }
    if (at && at.path) return (
      <>
        {backTo(at.split.id, stepOf(at.split).title)}
        {head('logic', 'Path', at.path.name, 'Logic')}
        <div style={css('padding: 18px; display: flex; flex-direction: column; gap: 16px;')}>{pathBody(at.path, at.split)}</div>
      </>
    );
    return (
      <div style={css('padding: 18px; display: flex; flex-direction: column; gap: 14px;')}>
        <h2 style={css('margin: 0; font-size: 18px; font-weight: 700;')}>{warns.length ? plural(warns.length, 'thing') + ' to fix' : 'Step settings'}</h2>
        {help(warns.length ? 'Fix these before the workflow can turn on.' : 'Select a step on the canvas to set it up.')}
        {warns.map((x, i) => (
          <button key={i} type="button" className="wf-li" onClick={() => (x.id === 'end' ? setFinder({ pathId: null, index: g.steps.length, afterTitle: cards[cards.length - 1].title, afterKind: cards[cards.length - 1].kind }) : setSel(x.id))}
            style={css('text-align: left; padding: 12px; border-radius: 12px; background: ' + T.surface + '; border: 1px solid ' + T.line + '; color: ' + T.ink + '; display: flex; flex-direction: column; gap: 2px;')}>
            <span style={css('font-size: 14px; font-weight: 600;')}>{x.title}</span>
            <span style={css('font-size: 13px; line-height: 1.45; color: ' + T.muted + ';')}>{x.body}</span>
          </button>
        ))}
      </div>
    );
  };

  // ---------- Layout ----------
  const branchAt = panel && panel.name === 'condition' ? (() => { const a2 = locate(g, panel.step); return a2 && a2.node && a2.node.type === 'split' ? a2 : null; })() : null;
  const steps = stepCount(g);
  const zoomBy = (d) => setZoom((z) => Math.min(1.5, Math.max(0.3, Math.round((z + d) * 10) / 10)));
  const fit = () => {
    const el = canvas.current, box = content.current;
    if (!el || !box) return;
    const r = box.getBoundingClientRect();
    const z = Math.min(1, (el.clientWidth - 48) / (r.width / zoom), (el.clientHeight - 120) / (r.height / zoom));
    setZoom(Math.max(0.3, Math.floor(z * 10) / 10));
    requestAnimationFrame(() => { el.scrollTop = 0; });
  };
  // Drag the background to pan; a click on it clears the selection. Touch keeps the browser's own scrolling.
  const onBg = (t) => !(t instanceof Element && t.closest('button, input, textarea, select, a'));
  const onPanDown = (e) => {
    if (e.button !== 0 || !onBg(e.target)) return;
    pan.current = { x: e.clientX, y: e.clientY, l: canvas.current.scrollLeft, t: canvas.current.scrollTop, moved: false, touch: e.pointerType === 'touch' };
    if (!pan.current.touch) e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPanMove = (e) => {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) p.moved = true;
    if (!p.touch) { canvas.current.scrollLeft = p.l - dx; canvas.current.scrollTop = p.t - dy; }
  };
  const onPanUp = () => { const p = pan.current; pan.current = null; if (p && !p.moved) setSel(''); };
  const onPanCancel = () => { pan.current = null; };
  const jumpToFix = () => { const x = warns[0]; if (!x) return; setSel(x.id === 'end' ? '' : x.id); };
  // What the test run walks: the cards in order, each with whatever is in the way of it.
  const testPlan = cards.map((c, i) => ({ id: c.id, n: i ? String(i) : 'T', title: c.title, fix: (warns.find((x) => cardOf(x.id) === c.id) || {}).title || '' }));
  // Review and turn on: four checks; Live stays locked until all pass (handoff Rules 2 to 5).
  const stepFixes = warns.filter((x) => x.id !== 'trigger');
  const passed = !!(g.lastTest && g.lastTest.ok);
  const loose = []; // steps that send outside the team with no approval step above them
  let outN = 0, looseId = '';
  const handoffs = new Set();
  const scan = (list, covered) => {
    let hasApproval = covered;
    for (const n of list) {
      if (n.type === 'approval') hasApproval = true;
      if (n.key === 'buffer_draft') handoffs.add('The approved Final video goes to Buffer as an editable draft on channels mapped to the project’s brand. Scheduling stays in Buffer.');
      if (n.key === 'slack_production_digest') handoffs.add('The production digest posts to ' + (n.message || 'the selected channel') + ' in Slack.');
      const step = stepOf(n);
      if (step.outward) {
        outN += 1;
        if (!hasApproval) { loose.push(step.title); if (!looseId) looseId = n.id; }
      }
      if (n.type === 'split') for (const path of n.paths || []) scan(path.steps, hasApproval);
    }
  };
  scan(g.steps, false);
  const handoffText = Array.from(handoffs).join(' ');
  // Until approval steps can run, the Super Admin turning the workflow on signs off on what it sends instead.
  const canApprove = !cannotRunYet({ type: 'approval' });
  let approvalSummary = '';
  if (outN) {
    if (!loose.length) approvalSummary = 'A Super Admin approves the external steps.';
    else if (canApprove) approvalSummary = 'Add an Approval step above ' + loose.join(', ') + '.';
    else approvalSummary = 'Confirm that you have checked ' + loose.join(', ') + '.';
  }
  const destinationSummary = [approvalSummary, handoffText].filter(Boolean).join(' ') || 'Nobody outside the team sees anything from this workflow.';
  const trigOk = !!g.trigger.key && !warns.some((x) => x.id === 'trigger');
  const closeReview = (then) => () => { setConfirm(''); then(); };
  const sourceRow = row.revision_source_id && (D.automations || []).find(a => a.id === row.revision_source_id);
  const staleRevision = row.revision_baseline && (!sourceRow || Object.entries(row.revision_baseline).some(([key,value]) => JSON.stringify(sourceRow[key])!==JSON.stringify(value)));
  const checks = [
    ...(row.revision_source_id ? [{ok:!!sourceRow && !staleRevision && !row.revision_applied_at,
      label:row.revision_applied_at ? 'Revision already applied' : staleRevision ? 'Original workflow changed or was removed' : 'Original version confirmed',
      detail:staleRevision ? 'Start a revision from the current live workflow.' : 'Applying updates the existing workflow and retains its run history.'}] : []),
    { ok: trigOk, label: trigOk ? 'Trigger is set' : g.trigger.key ? 'The trigger needs a fix' : 'Pick a trigger', detail: trigOk ? trig.detail : (warns.find((x) => x.id === 'trigger') || {}).body || '', fixLabel: 'Set trigger', fix: closeReview(() => setPanel({ name: 'trigger' })) },
    { ok: !stepFixes.length, label: stepFixes.length ? plural(stepFixes.length, 'step') + (stepFixes.length === 1 ? ' needs' : ' need') + ' setup' : 'Every step is set up', detail: stepFixes.length ? stepFixes.map((x) => x.title).join(', ') : plural(steps, 'step') + ', nothing missing', fixLabel: 'Go to step', fix: closeReview(() => setSel(stepFixes[0].id === 'end' ? '' : stepFixes[0].id)) },
    { ok: passed, label: passed ? 'Test run passed' : g.lastTest?.skipped ? 'Test a matching project' : g.lastTest ? 'The last test failed' : 'Run a test first', detail: passed ? 'A matching sample passed the preview.' : 'Runs every step on sample data. Nothing is sent.', fixLabel: 'Test run', fix: () => runTest(testPlan) },
    { ok: !loose.length || (!canApprove && ack), label: outN ? plural(outN, 'step') + (outN === 1 ? ' sends' : ' send') + ' outside' + (loose.length ? (canApprove ? ', no approval' : '') : ', approval covers it') : handoffs.size ? 'Connected app destinations' : 'Nothing leaves the team',
      detail: destinationSummary,
      fixLabel: 'Add approval', fix: canApprove && loose.length ? closeReview(() => { const at2 = locate(g, looseId); if (at2) { const before = at2.index ? stepOf(at2.list[at2.index - 1]) : null; setFinder({ pathId: at2.pathId, index: at2.index, afterTitle: before ? before.title : at2.pathId ? 'the path starts' : trig.title, afterKind: before ? before.kind : 'trigger' }); } }) : null,
      ack: loose.length && !canApprove ? { on: ack, set: setAck, label: 'I have checked what this sends' } : null },
  ];
  const ready = checks.every((c) => c.ok);
  async function createRevision() {
    if (busy || dirty) return;
    setBusy('revision');
    try {
      const saved = await A.saveFlow(null,{...g,lastTest:null},{name:name+' · Revision',category,status:'draft',revisionSource:row.id});
      if (saved) onOpenDraft(saved);
    } finally { setBusy(''); }
  }
  const turnOn = async () => {
    const saved = await save('live');
    if (!saved) return;
    setConfirm('');
    if (row.revision_source_id) onOpenDraft(saved);
    else say(name + ' is live');
  };
  async function compareSamples(ids) {
    const at = g;
    const results = await Promise.all(ids.map(async id => {
      try {
        const run = await A.testAutomation(row.id,at,id);
        if (!run) throw new Error('Could not load the test result.');
        const output = run.output || {};
        const details = (output.checks || []).map(c => c.label + (c.matches ? ' matched · ' : ' skipped · ') + c.detail);
        if (output.sampleSkipped) return {label:'Skipped',details:[...details,'Actions and brand routing were skipped.']};
        for (const step of output.steps || []) details.push(step.detail);
        const error = run.error || (output.steps || []).find(s => !s.ok)?.detail;
        return {label:error || warns.length ? 'Needs setup' : 'Matched',details:[...details,...(error?[error]:[]),...warns.map(w => w.body)]};
      } catch (e) { return {label:'Preview unavailable',details:[e.message || String(e)]}; }
    }));
    const ok = results.some(r => r.label==='Matched') && results.every(r=>['Matched','Skipped'].includes(r.label));
    setG(prev => prev===at ? {...prev,lastTest:{ok,skipped:results.every(r=>r.label==='Skipped'),at:stamp()}} : prev);
    if (!live) touch();
    return results;
  }
  const saveText = busy === 'save' || busy === 'live' ? 'Saving…' : dirty ? (autoFail ? 'Not saved' : 'Unsaved') : 'Saved';


  return (
    <div ref={root} className="fbx wf" role="dialog" aria-modal="true" aria-label={'Workflow builder: ' + name}
      style={css('position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; background: ' + T.page + '; color: ' + T.ink + '; font-family: ' + FONT.body + ';')}>
      <style>{WF_CSS + '\n' + RICH_CSS + `
        .fbx .mitem:hover { background: var(--hover); }
        .wf-li:hover { border-color: ${T.borderHover} !important; background: ${T.ground} !important; }
        .wf-sc { scrollbar-width: thin; scrollbar-color: ${T.borderHover} transparent; }
        .wf-pulse { animation: wf-pulse 1s ease-in-out infinite; }
        .wf-pop { animation: wf-pop 150ms ease-out; }
        @keyframes wf-pop { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: none; } }
        .fbx-top { flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 16px; }
        .fbx-body { flex: 1; display: flex; gap: 12px; padding: 0 12px 12px; min-height: 0; }
        .fbx-left { width: 300px; } .fbx-right { width: 340px; }
        @media (max-width: 1500px) { .fbx-opt .fbx-lbl { display: none; } .fbx-opt { width: 42px; padding: 0 !important; } }
        @media (max-width: 1240px) { .fbx-opt2 .fbx-lbl { display: none; } .fbx-opt2 { width: 42px; padding: 0 !important; } .fbx-left { width: 260px; } .fbx-right { width: 300px; } }
        @media (max-width: 720px) { .wf-dlg { padding: 0 !important; } .wf-dlg-box { width: 100% !important; max-height: none !important; min-height: 100vh; border-radius: 0 !important; } .wf-two { grid-template-columns: minmax(0, 1fr) !important; } .wf-two > aside { border-left: 0 !important; border-top: 1px solid ${T.line}; } }
        @media (max-width: 900px) {
          .fbx { overflow-y: auto; }
          .fbx-top { flex-wrap: wrap; }
          .fbx-body { flex-direction: column; flex: none; }
          .fbx-left, .fbx-right { width: auto; flex: none !important; }
          .fbx-left { max-height: 360px; }
          .fbx-canvas { min-height: 620px; flex: none !important; }
          .fbx-btn { min-height: 44px; }
        }
      `}</style>

      <header className="fbx-top" inert={!!dialog}>
        <button type="button" data-back="" className="wf-h" onClick={leave} aria-label="Back to automations" style={css('height: 42px; flex: none; display: flex; align-items: center; gap: 6px; padding: 0 12px 0 8px; border: 0; border-radius: 10px; background: transparent; color: ' + T.ink + '; font-weight: 600; font-size: 14px;')}><Svg d={ICON.back} size={16} /><span className="fbx-lbl">Automations</span></button>
        <label htmlFor="fb-name" style={css(srOnly)}>Workflow name</label>
        <input id="fb-name" autoComplete="off" value={name} onChange={(e) => { setName(e.target.value); touch(); }} className="wf-h" style={css('height: 42px; flex: 0 1 250px; min-width: 110px; background: transparent; border: 1px solid transparent; border-radius: 10px; color: ' + T.ink + '; font-family: inherit; font-weight: 700; font-size: 18px; padding: 0 8px; text-overflow: ellipsis;')} />
        {runs ? <Seg label="Status" options={[['live', STATUS.live], ['off', STATUS.off], ['draft', STATUS.draft]]} value={status} onChange={setStatus} />
          : <span style={css(pillStyle(KIND.ai.ink, KIND.ai.bg) + ' padding: 6px 10px;')}>{KINDS.find((k) => k[0] === g.kind)[1]}</span>}
        <span aria-live="polite" style={css('display: flex; align-items: center; gap: 10px; flex: none;')}>
          {warns.length ? <button type="button" onClick={jumpToFix} title="Show what to fix" style={css('border: 0; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 600; color: ' + T.warnInk + '; background: ' + T.warnBg + '; white-space: nowrap;')}>{warns.length} to fix</button> : null}
          <span style={css('font-size: 13px; color: ' + (autoFail && dirty ? T.error : T.muted) + '; white-space: nowrap;')}>{saveText}</span>
        </span>
        <span style={css('flex: 1; min-width: 0;')} />
        {runs ? <TopBtn cls="fbx-opt" icon={ICON.history} label="Run history" onClick={() => exitTo(() => goHub('runs'))} /> : null}
        <TopBtn cls="fbx-opt" icon={ICON.settings} label="Settings" onClick={() => setPanel({ name: 'settings' })} />
        {runs ? <button type="button" className="fbx-btn fbx-opt2" aria-label={'Ask ' + AGENT_SHORT} title={'Ask ' + AGENT} disabled={!!busy} onClick={() => dirty ? say('Save your current changes before opening the assistant.') : setPrompt('')} style={css(btn('ghost') + ' background: ' + KIND.ai.bg + '; border-color: transparent; color: ' + KIND.ai.ink + ';')}><Svg d={KIND.ai.icon} size={16} /><span className="fbx-lbl">Ask {AGENT_SHORT}</span></button> : null}
        {live ? <TopBtn cls="fbx-opt2" icon={ICON.plus} label="Create revision" onClick={createRevision} off={!!busy || dirty} /> : null}
        {runs && comparableTrigger(g.trigger.key) && sampleProjects.length>1 ? <TopBtn cls="fbx-opt2" icon={ICON.play} label="Compare samples" onClick={() => setCompareOpen(true)} off={!!busy} /> : null}
        {runs ? <TopBtn cls="" icon={ICON.play} label={busy === 'test' ? 'Testing…' : 'Test run'} onClick={() => runTest(testPlan)} off={!!busy} /> : null}
        <button type="button" className="wf-h fbx-btn" onClick={() => (live ? setConfirm('update') : save())} disabled={!dirty || !!busy} style={css(btn('quiet') + (!dirty || busy ? ' opacity: .5; cursor: default;' : ''))}>Save</button>
        {runs && !live ? <button type="button" className="wf-k fbx-btn" onClick={() => setConfirm('review')} disabled={!!busy} style={css(btn('primary') + ' padding: 0 16px;')}>Review and turn on</button> : null}
      </header>

      <div className="fbx-body" inert={!!dialog}>
        <aside className="fbx-left" aria-label="Step library" style={css('flex: none; background: ' + T.surface + '; border-radius: ' + R.card + 'px; display: flex; flex-direction: column; min-height: 0; overflow: hidden;')}>
          <Clarifications choices={clarificationChoices(g,D)} apply={(choice,option)=>edit(next=>applyClarification(next,choice,option))} />
          <div role="tablist" aria-label="Left panel" style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; margin: 12px; background: ' + T.count + '; border-radius: 12px; padding: 4px;')}>
            {[['steps', 'Steps'], ['overview', 'Overview']].map((t) => (
              <button key={t[0]} type="button" role="tab" id={'fb-tab-' + t[0]} aria-selected={left === t[0]} aria-controls="fb-left-panel" onClick={() => setLeft(t[0])}
                style={css('height: 38px; border-radius: 9px; background: ' + (left === t[0] ? T.surface : 'transparent') + '; color: ' + (left === t[0] ? T.ink : T.sub) + '; border: 0; font-weight: 600; font-size: 14px; box-shadow: ' + (left === t[0] ? '0 1px 2px rgba(0,0,0,.08)' : 'none') + ';')}>{t[1]}</button>
            ))}
          </div>
          <div id="fb-left-panel" role="tabpanel" aria-labelledby={'fb-tab-' + left} style={css('flex: 1; min-height: 0; display: flex; flex-direction: column;')}>
            {left === 'overview' ? overview() : (
              <>
                <div style={css('padding: 0 14px 8px;')}>
                  <label htmlFor="fb-lq" style={css(srOnly)}>Search steps</label>
                  <input id="fb-lq" type="search" autoComplete="off" value={lq} onChange={(e) => setLq(e.target.value)} placeholder="Search steps" style={css('width: 100%; height: 42px; border-radius: 12px; background: ' + T.ground2 + '; border: 1px solid ' + T.line + '; color: ' + T.ink + '; padding: 0 12px; font-family: inherit; font-size: 14px;')} />
                  <div style={css('font-size: 13px; color: ' + T.muted + '; margin-top: 8px;')}>Click to add at the end. Use + on the canvas to add between steps.</div>
                </div>
                <div className="wf-sc" style={css('flex: 1; overflow: auto; padding: 4px 14px 16px; display: flex; flex-direction: column; gap: 14px;')}>
                  {KIND_ORDER.filter((k) => libShown.some((it) => it.kind === k)).map((k) => (
                    <div key={k} role="group" aria-label={GROUP[k]} style={css('display: flex; flex-direction: column; gap: 6px;')}>
                      <div style={css('font-size: 13px; font-weight: 700; color: ' + T.ink2 + '; padding: 4px 2px;')}>{GROUP[k]}</div>
                      {libShown.filter((it) => it.kind === k).map(libItem)}
                    </div>
                  ))}
                  {!libShown.length ? <div style={css('padding: 20px; text-align: center; color: ' + T.muted + '; font-size: 14px; border: 1.5px dashed ' + T.pillOn + '; border-radius: 12px;')}>No steps match.</div> : null}
                </div>
              </>
            )}
          </div>
        </aside>

        <main className="fbx-canvas" aria-label="Workflow canvas" style={css('flex: 1; min-width: 0; position: relative; display: flex; border-radius: ' + R.card + 'px; overflow: hidden;')}>
          <div ref={canvas} className="wf-sc" onPointerDown={onPanDown} onPointerMove={onPanMove} onPointerUp={onPanUp} onPointerCancel={onPanCancel} onLostPointerCapture={onPanCancel}
            style={css('flex: 1; overflow: auto; cursor: grab; background-color: ' + T.ground + '; background-image: radial-gradient(' + T.dot + ' 1px, transparent 1px); background-size: 20px 20px;')}>
            <div style={css('min-width: 100%; width: max-content; padding: 40px 24px 220px; display: flex; justify-content: center; zoom: ' + zoom + ';')}>
              <div ref={content} style={css('display: flex; flex-direction: column; align-items: center;')}>
                {cards.map((c, i) => (
                  <div key={c.id} style={css('display: flex; flex-direction: column; align-items: center;')}>
                    {stepCard(c)}
                    {wire}
                    <button type="button" className="wf-h" aria-label={'Add a step after ' + c.title} onClick={() => setFinder({ pathId: null, index: i, afterTitle: c.title, afterKind: c.kind })}
                      style={css('width: ' + H.plus + 'px; height: ' + H.plus + 'px; flex: none; border-radius: 999px; background: ' + T.surface + '; border: 1px solid ' + T.inputLine + '; color: ' + T.ink + '; display: flex; align-items: center; justify-content: center;')}><Svg d={ICON.plus} size={15} /></button>
                    {wire}
                  </div>
                ))}
                <span style={css('padding: 4px 12px; border-radius: 999px; background: ' + T.count + '; color: ' + T.sub + '; font-size: 13px; font-weight: 500;')}>End</span>
              </div>
            </div>
          </div>
          {test ? <TestDrawer test={test} onFix={(id) => setSel(id)} onAgain={() => runTest(testPlan)} onClose={() => setTest(null)} /> : null}
          <div role="group" aria-label="Zoom" style={css('position: absolute; right: 12px; bottom: 12px; z-index: 5; display: flex; flex-direction: column; align-items: center; background: ' + T.surface + '; border: 1px solid ' + T.border + '; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.06);')}>
            <button type="button" className="wf-h" aria-label="Zoom in" onClick={() => zoomBy(0.1)} style={css('width: 40px; height: 38px; border-radius: 12px 12px 0 0; background: transparent; border: 0; color: ' + T.ink + '; font-size: 18px;')}>+</button>
            <span style={css('font-size: 12px; font-weight: 600; padding: 4px 0;')}>{Math.round(zoom * 100)}%</span>
            <button type="button" className="wf-h" aria-label="Zoom out" onClick={() => zoomBy(-0.1)} style={css('width: 40px; height: 38px; background: transparent; border: 0; color: ' + T.ink + '; font-size: 18px;')}>−</button>
            <button type="button" className="wf-h" aria-label="Fit to screen" title="Fit to screen" onClick={fit} style={css('width: 40px; height: 38px; border-radius: 0 0 12px 12px; background: transparent; border: 0; border-top: 1px solid ' + T.line + '; color: ' + T.ink + '; display: flex; align-items: center; justify-content: center;')}><Svg d={ICON.fit} size={15} /></button>
          </div>
          <div aria-live="polite" style={css('position: absolute; left: 12px; bottom: 12px; z-index: 5; background: ' + T.surface + '; border: 1px solid ' + T.border + '; border-radius: 12px; padding: 7px 12px; font-size: 13px; color: ' + T.ink3 + '; font-weight: 500;')}>{plural(steps, 'step')}{warns.length ? ' · ' + warns.length + ' to fix' : ''}</div>
        </main>

        <aside className="fbx-right wf-sc" aria-label="Step settings" style={css('flex: none; background: ' + T.surface + '; border-radius: ' + R.card + 'px; overflow: auto; display: flex; flex-direction: column;')}>
          {inspector()}
        </aside>
      </div>

      {finder ? <StepFinder items={lib.filter((it) => !it.trigger)} groupLabel={GROUP} afterTitle={finder.afterTitle} afterKind={finder.afterKind} onAdd={(spec) => add(finder.pathId, finder.index, spec)} onClose={() => setFinder(null)} /> : null}

      {compareOpen ? <CompareProjects rows={sampleProjects} firstId={sampleRow?.id} onRun={compareSamples} onClose={()=>setCompareOpen(false)} /> : null}
      {prompt !== null ? <Dialog id="wf-assistant" eyebrow={AGENT} title="Draft a workflow" state={prompt.trim() ? 'dirty' : ''}
        saveLabel={busy === 'assistant' ? 'Creating…' : 'Create draft'} saveOff={!!busy} onSave={generateDraft} onClose={() => { if (!busy) setPrompt(null); }}>
        <div style={css('padding: 20px 24px; display: grid; gap: 12px;')}>
          <WorkflowPrompt value={prompt} onChange={setPrompt} />
          <p style={css('margin: 0; font-size: 14px; color: ' + T.muted + ';')}>{blankDraft ? 'Review the generated steps here before testing and turning them on.' : 'The assistant opens a separate draft so you can review its steps.'}</p>
        </div>
      </Dialog> : null}
      {panel && panel.name === 'settings' ? <SettingsModal g={g} name={name} D={D} live={live} slackOn={!!connected.slack} onSave={saveSettings} onClose={() => setPanel(null)} goConnectors={() => exitTo(() => goHub('connectors'))} /> : null}
      {panel && panel.name === 'trigger' && runs ? <TriggerModal g={g} name={name} D={D} rowId={row.id} live={live} optionsFor={optionsFor} critText={critText} onSave={saveTrigger} onClose={() => setPanel(null)} /> : null}
      {panel && panel.name === 'condition' && branchAt ? (
        <ConditionModal key={panel.step} node={branchAt.node} stepNo={branchAt.pathId ? '' : branchAt.index + 1} pathId={panel.path} sampleRow={sampleRow} optionsFor={optionsFor} lib={lib.filter((it) => !it.trigger)} groupLabel={GROUP} makeNode={makeNode} onSave={saveBranch} onClose={() => setPanel(null)} />
      ) : null}

      <div aria-live="polite" style={css('position: fixed; left: 50%; bottom: 24px; z-index: 80; transform: translateX(-50%); max-width: calc(100vw - 32px);')}>
        {toast ? (
          <div style={css('display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 16px; border-radius: 12px; background: ' + T.accent + '; color: ' + T.accentInk + '; font-size: 14px; font-weight: 500; box-shadow: ' + SHADOW.toast + ';')}>
            <span>{toast}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setToast('')} style={css('width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: inherit; display: flex; align-items: center; justify-content: center;')}><Svg d={ICON.close} size={14} /></button>
          </div>
        ) : null}
      </div>

      {confirm === 'review' ? <ReviewModal name={name} checks={checks} paused={paused} busy={busy === 'live'} revision={!!row.revision_source_id} onTurnOn={turnOn} onClose={() => setConfirm('')}>{row.revision_baseline && <RevisionChanges origin={row.revision_baseline} graph={g} D={D} />}</ReviewModal> : null}

      {/* Confirmations: saving a live automation, and leaving with unsaved changes */}
      {dialog ? (
        <div style={css('position: fixed; inset: 0; z-index: 75; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(17,17,17,.36);')}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="fb-cf-t" aria-describedby="fb-cf-d" className="wf-pop" style={css('width: 520px; max-width: 100%; padding: 24px; background: ' + T.surface + '; border-radius: 20px; box-shadow: ' + SHADOW.modal + '; display: flex; flex-direction: column; gap: 16px;')}>
            <div style={css('display: flex; align-items: center;')}>
              <h2 id="fb-cf-t" style={css('flex: 1; margin: 0; font-family: ' + FONT.display + '; font-size: 20px; font-weight: 900;')}>{dialog === 'leave' ? 'Leave without saving?' : 'Update the live automation?'}</h2>
              <button type="button" className="wf-h" aria-label="Close" onClick={() => setConfirm('')} style={css('width: 40px; height: 40px; border: 0; border-radius: 10px; background: transparent; color: ' + T.ink + '; display: flex; align-items: center; justify-content: center;')}><Svg d={ICON.close} size={18} /></button>
            </div>
            <p id="fb-cf-d" style={css('margin: 0; font-size: 15px; line-height: 1.5; color: ' + T.ink3 + ';')}>
              {dialog === 'leave' ? 'Your changes to this workflow are not saved yet.' : 'This workflow is live. Saving changes what the next runs do; runs already waiting on a delay carry on from where they are.'}
            </p>
            {dialog === 'update' && warns.length ? <p role="alert" style={css('margin: 0; font-size: 14px; color: ' + T.error + ';')}>Fix {plural(warns.length, 'thing')} first: {warns.map((x) => x.title).join(', ')}.</p> : null}
            <div style={css('display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px;')}>
              {dialog === 'leave' ? (
                <>
                  <button type="button" className="wf-h" onClick={onClose} style={css(btn('danger'))}>Discard changes</button>
                  <button type="button" className="wf-k" autoFocus onClick={async () => { if (await save(live && warns.length ? 'off' : undefined)) onClose(); }} style={css(btn('primary'))}>{live && warns.length ? 'Save and turn off' : 'Save and leave'}</button>
                </>
              ) : (
                <>
                  <button type="button" className="wf-h" autoFocus onClick={() => setConfirm('')} style={css(btn('ghost'))}>Cancel</button>
                  <button type="button" className="wf-k" disabled={!!warns.length || !!busy} onClick={async () => { if (await save()) setConfirm(''); }} style={css(btn('primary') + (warns.length || busy ? ' opacity: .45; cursor: default;' : ''))}>{busy ? 'Saving…' : 'Save changes'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FlowLayer({ D, A, open, review, back, set }) {
  const leaveTo = (more) => set({ flowOpen: '', flowReview: false, ...more });
  if (open === 'new') return <CreateFlowDialog D={D} A={A} onCreated={(row) => set({ flowOpen: row.id })} onClose={() => set({ flowOpen: '' })} />;
  if (!open) {
    const ret = (D.automations || []).find((a) => a.id === back);
    if (!ret) return null;
    return (
      <div role="region" aria-label="Back to flow" style={css('position: fixed; z-index: 55; left: 50%; bottom: 20px; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; padding: 6px; max-width: calc(100vw - 32px); box-sizing: border-box; border-radius: 14px; background: var(--inv); color: var(--inv-ink); box-shadow: 0 12px 40px rgba(0,0,0,0.25); font-family: var(--font-main);')}>
        <button type="button" onClick={() => set({ nav: 'auto', flowOpen: ret.id, flowReturn: '' })} style={css(S.btn + ' border: 0; background: transparent; color: inherit; min-width: 0;')}>
          <Ico d={IC.back} /> <span style={css('overflow: hidden; text-overflow: ellipsis;')}>Back to {ret.name}</span>
        </button>
        <button type="button" aria-label="Dismiss" onClick={() => set({ flowReturn: '' })} style={css(S.icon + ' width: 34px; height: 34px; color: inherit;')}><Ico d={IC.close} size={16} /></button>
      </div>
    );
  }
  const entry = (D.automations || []).find((a) => a.id === open);
  const row = entry?.revision_applied_at ? (D.automations || []).find(a => a.id===entry.revision_source_id) : entry;
  if (!row) return null;
  return <FlowBuilder key={row.id} D={D} A={A} row={row} review={review} onOpenDraft={(saved) => set({ flowOpen: saved.id, flowReview: false })} onClose={() => leaveTo({})}
    goHub={(tab) => leaveTo(tab === 'connectors' ? { nav: 'auto', autoConn: true } : { nav: 'auto', autoTab: tab })}
    goConnect={(provider) => leaveTo({ flowReturn: row.id, nav: 'workspace', wsTab: 'integ', integFocus: provider, integExpanded: provider })} />;
}
