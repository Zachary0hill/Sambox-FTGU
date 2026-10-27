'use client';
// Flow builder: Automations > New flow, or Edit on a workflow card. A full-screen canvas in the spirit of Klaviyo's
// flow editor: a trigger card, then steps joined by + connectors (click for a menu, or drag a step in from the Actions
// panel), splits that branch into paths, and End. Selecting a card opens its details in the left panel.
//
// The same canvas maps processes and ideas: kind 'process' or 'idea' never runs, so it can hold manual tasks and notes
// alongside the actions it would take. Every card, and the flow itself, can be tagged with dashboard data (projects,
// ideas, clients, people, statuses, channels, brands) and connector data (connectors, YouTube videos, Buffer channels).
// Messages take data tokens ({{project.title}}) that the runner fills in. The graph model and runner rules are in
// lib/automations/graph.ts; saving goes through A.saveFlow (lib/studio/actions.js).
/* eslint-disable react-hooks/exhaustive-deps */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { TRIGGERS, ACTIONS, actionById, triggerById, triggerText } from '@/lib/automations/catalog';
import {
  KINDS, TAG_TYPES, FIELDS, OPS, TOKENS, ACTION_GROUPS, emptyGraph, graphOf, compile, issuesOf, newId, walk,
} from '@/lib/automations/graph';

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

const ACTION_IC = { slack_admin: IC.chat, email_editor: IC.mail, email_designer: IC.mail, status_next: IC.next, todo_admin: IC.todo, webhook_n8n: IC.link, buffer_publish: IC.send };
const ACTION_TONE = { slack_admin: 'blue', email_editor: 'blue', email_designer: 'blue', status_next: 'coral', todo_admin: 'coral', webhook_n8n: 'violet', buffer_publish: 'violet' };
const STEP_DEF = {
  delay: { label: 'Time delay', icon: IC.clock, tone: 'gray', desc: 'Wait before the next step' },
  split: { label: 'Split', icon: IC.split, tone: 'gray', desc: 'Send work down different paths' },
  task: { label: 'Task', icon: IC.task, tone: 'green', desc: 'A To-Do for someone on the team' },
  note: { label: 'Note', icon: IC.note, tone: 'amber', desc: 'An idea or a sticky note; never runs' },
};
const TRIGGER_DESC = {
  status: ['Move work forward', 'Alert people when a project reaches a stage'], edit_status: ['Track the edit', 'React when an edit is in review or needs changes'],
  thumb_status: ['Track the thumbnail', 'React when a thumbnail moves along'], approval: ['Sponsor decisions', 'Follow up when a sponsor approves or asks for changes'],
  mention_admin: ['Mentions', 'When a comment asks a Super Admin for help'], publish_soon: ['Publishing countdown', 'Remind people before a video goes out'],
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
  label: 'font-size: 13px; font-weight: 600; color: var(--ink-2);',
  input: 'width: 100%; min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border-2); border-radius: 10px; background: var(--surface); color: var(--ink); font-size: 14px; font-family: inherit;',
  area: 'width: 100%; min-height: 96px; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--border-2); border-radius: 10px; background: var(--surface); color: var(--ink); font-size: 14px; line-height: 1.5; font-family: inherit; resize: vertical;',
  muted: 'margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted);',
  pop: 'position: absolute; z-index: 30; min-width: 240px; max-height: 360px; overflow-y: auto; padding: 6px; box-sizing: border-box; background: var(--surface); border: 1px solid var(--line-4); border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.16);',
  item: 'display: flex; align-items: center; gap: 10px; width: 100%; min-height: 38px; padding: 0 10px; box-sizing: border-box; border: 0; border-radius: 9px; background: transparent; color: var(--ink); font-size: 14px; text-align: left; cursor: pointer; font-family: inherit;',
  head: 'margin: 0; padding: 8px 10px 4px; font-size: 12px; font-weight: 600; color: var(--muted-2);',
  card: 'position: relative; width: 300px; max-width: calc(100vw - 48px); box-sizing: border-box; border-radius: 16px; background: var(--surface); text-align: left; cursor: pointer; font-family: inherit; color: var(--ink);',
};
const cardRing = (on, warn) => 'border: ' + (on ? '2px solid ' + RING : '1px solid var(--line-4)') + '; padding: ' + (on ? '13px 15px' : '14px 16px') + '; box-shadow: ' + (on ? '0 0 0 4px rgba(47,91,211,0.12)' : '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)') + ';' + (warn && !on ? ' border-color: var(--amber-ink);' : '');
const tile = (tone, size = 32) => 'width: ' + size + 'px; height: ' + size + 'px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: ' + toneBg(tone) + '; color: ' + toneInk(tone) + ';';

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

// Message box with an Insert data menu for runner tokens.
function MessageField({ id, label, value, onChange, placeholder, rows = 4 }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const insert = (k) => {
    const el = ref.current;
    const tok = '{{' + k + '}}';
    const v = value || '';
    const at = el && typeof el.selectionStart === 'number' ? el.selectionStart : v.length;
    onChange(v.slice(0, at) + tok + v.slice(at));
    setOpen(false);
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(at + tok.length, at + tok.length); } });
  };
  return (
    <div style={css('position: relative; display: flex; flex-direction: column; gap: 6px;')}>
      <div style={css('display: flex; align-items: center; gap: 8px;')}>
        <label htmlFor={id} style={css(S.label + ' flex: 1;')}>{label}</label>
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} style={css('display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 8px; border: 0; border-radius: 8px; background: var(--chip); color: var(--ink-2); font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;')}>
          <Ico d={IC.data} size={13} /> Insert data
        </button>
      </div>
      <textarea id={id} ref={ref} rows={rows} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={css(S.area)} />
      {open ? (
        <>
          <button type="button" tabIndex={-1} aria-label="Close data menu" onClick={() => setOpen(false)} style={css('position: fixed; inset: 0; z-index: 29; border: 0; background: transparent; cursor: default;')} />
          <div role="menu" aria-label="Insert data" style={css(S.pop + ' top: 34px; right: 0;')}>
            {TOKENS.map((t) => (
              <button key={t[0]} type="button" role="menuitem" className="mitem" onClick={() => insert(t[0])} style={css(S.item)}>
                <span style={css('flex: 1;')}>{t[1]}</span>
                <code style={css('font-size: 11px; color: var(--muted-2);')}>{'{{' + t[0] + '}}'}</code>
              </button>
            ))}
          </div>
        </>
      ) : null}
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
  return { ...base, type: 'split', name: '', paths: [
    { id: newId('p'), name: 'Path #1', when: [], steps: [] },
    { id: newId('p'), name: 'Everyone else', when: [], steps: [] },
  ] };
}
// Inserting a split moves the steps after it into its first path, so nothing hangs below a branch.
function insertAt(g, pathId, index, spec) {
  const next = clone(g);
  const list = listOf(next, pathId);
  if (!list) return { g, id: null };
  const node = makeNode(spec);
  if (node.type === 'split') node.paths[0].steps = list.splice(index);
  list.splice(index, 0, node);
  return { g: next, id: node.id };
}
// Where a click in the Actions panel adds a step: after the selected card, else at the end (inside the last path when
// the flow ends in a split).
function defaultSpot(g, selId) {
  const at = selId ? locate(g, selId) : null;
  if (at && at.node && at.node.type !== 'split') return { pathId: at.pathId, index: at.index + 1 };
  if (at && at.path) return { pathId: at.path.id, index: at.path.steps.length };
  let list = g.steps, pathId = null;
  for (;;) {
    const last = list[list.length - 1];
    if (!last || last.type !== 'split') return { pathId, index: list.length };
    const p = last.paths[last.paths.length - 1];
    list = p.steps; pathId = p.id;
  }
}

// ---------- Create flow dialog ----------
export function CreateFlowDialog({ D, A, onCreated, onClose }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('automation');
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const sources = useMemo(() => tagSources(D).list, [D]);
  const create = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const row = await A.saveFlow(null, emptyGraph(kind, tags), { name: name.trim() });
    setBusy(false);
    if (row) onCreated(row);
  };
  return (
    <div style={css('position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(0,0,0,0.45);')} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="cf-title" onSubmit={create}
        style={css('width: 560px; max-width: 100%; max-height: calc(100vh - 32px); overflow-y: auto; box-sizing: border-box; padding: 28px 32px; background: var(--surface); border-radius: 20px; box-shadow: 0 24px 80px rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 20px; color: var(--ink); font-family: var(--font-main);')}>
        <div style={css('display: flex; align-items: center; gap: 12px;')}>
          <h2 id="cf-title" style={css('flex: 1; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.01em;')}>Create flow</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={css(S.icon)}><Ico d={IC.close} size={18} /></button>
        </div>
        <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
          <label htmlFor="cf-name" style={css(S.label)}>Name</label>
          <input id="cf-name" autoFocus autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Filming kickoff, Sponsor review process" style={css(S.input + ' min-height: 44px;')} />
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
export default function FlowBuilder({ D, A, row, onClose, goConnect }) {
  const [g, setG] = useState(() => graphOf(row));
  const [name, setName] = useState(row.name);
  const [category, setCategory] = useState(row.category || 'custom');
  const [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState(() => (graphOf(row).kind === 'automation' && !graphOf(row).trigger.key ? 'trigger' : ''));
  const [menu, setMenu] = useState(''); // the + connector whose menu is open: pathId|index
  const [side, setSide] = useState(''); // right panel: alerts | test
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(''); // review | leave | delete:<id>
  const [testRun, setTestRun] = useState(null);
  const [dropAt, setDropAt] = useState('');
  // The Actions panel starts hidden on narrow screens, where it would cover the canvas.
  const [palette, setPalette] = useState(() => typeof window === 'undefined' || window.innerWidth > 860);
  const canvas = useRef(null);
  const pan = useRef(null);

  const sources = useMemo(() => tagSources(D).list, [D]);
  const connected = useMemo(() => Object.fromEntries((D.integrations || []).map((x) => [x.provider, x.status === 'connected'])), [D.integrations]);
  const issues = useMemo(() => issuesOf(g, connected), [g, connected]);
  const warnIds = useMemo(() => new Set(issues.filter((x) => x.level === 'warn').map((x) => x.id)), [issues]);
  const paused = !!((D.settings || {}).automation || {}).paused;
  const runs = g.kind === 'automation';
  const status = !runs ? KINDS.find((k) => k[0] === g.kind)[1] : row.is_draft ? 'Draft' : row.enabled ? (paused ? 'Paused' : 'Live') : 'Off';
  const statusTone = status === 'Live' ? 'green' : status === 'Draft' || status === 'Off' ? 'gray' : status === 'Paused' ? 'amber' : g.kind === 'idea' ? 'amber' : 'violet';

  const edit = (fn) => { setG((prev) => { const next = clone(prev); fn(next); return next; }); setDirty(true); };
  const editNode = (id, patch) => edit((x) => { const at = locate(x, id); if (at && at.node) Object.assign(at.node, patch); });
  const add = (pathId, index, spec) => {
    const r = insertAt(g, pathId, index, spec);
    if (!r.id) return;
    setG(r.g); setDirty(true); setSel(r.id); setMenu('');
  };
  const addDefault = (spec) => { const at = defaultSpot(g, sel); add(at.pathId, at.index, spec); };
  const remove = (id) => {
    edit((x) => { const at = locate(x, id); if (at && at.node) at.list.splice(at.index, 1); });
    setSel(''); setConfirm('');
  };
  const duplicate = (id) => {
    const at = locate(g, id);
    if (!at || !at.node || at.node.type === 'split') return;
    const copy = { ...clone(at.node), id: newId() };
    edit((x) => { const a2 = locate(x, id); a2.list.splice(a2.index + 1, 0, copy); });
    setSel(copy.id);
  };
  const move = (id, dir) => edit((x) => {
    const at = locate(x, id);
    if (!at || !at.node) return;
    const j = at.index + dir;
    if (j < 0 || j >= at.list.length || at.list[j].type === 'split' || at.node.type === 'split') return;
    const [n] = at.list.splice(at.index, 1);
    at.list.splice(j, 0, n);
  });

  const save = async (mode) => {
    if (busy) return null;
    setBusy(mode === 'live' ? 'live' : 'save');
    const saved = await A.saveFlow(row, g, { name: name.trim() || row.name, category, status: mode });
    setBusy('');
    if (saved) setDirty(false);
    return saved;
  };
  const runTest = async () => {
    if (dirty && !(await save())) return;
    setBusy('test'); setSide('test'); setTestRun(null);
    try { setTestRun(await A.testAutomation(row.id)); } catch (err) { setTestRun({ error: err.message || String(err), output: {} }); }
    setBusy('');
  };
  const leave = () => { if (dirty) setConfirm('leave'); else onClose(); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (confirm) { setConfirm(''); return; }
      if (menu) { setMenu(''); return; }
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (sel) { setSel(''); return; }
      leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm, menu, sel, dirty]);
  // Start centred on the trigger: a wide split makes the canvas scroll sideways.
  useEffect(() => {
    const el = canvas.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);
  useEffect(() => {
    const before = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [dirty]);

  // Numbered titles in reading order: Email #1, Email #2, Split #1.
  const titles = useMemo(() => {
    const n = {}, out = {};
    walk(g.steps, (x) => {
      const base = x.type === 'action' ? ((actionById(x.key) || {}).app || 'Action') : STEP_DEF[x.type].label;
      n[base] = (n[base] || 0) + 1;
      out[x.id] = x.type === 'split' && x.name ? x.name : (x.type === 'task' || x.type === 'note') && x.title ? x.title : base + ' #' + n[base];
    });
    return out;
  }, [g]);

  const statusName = (v) => v;
  const trigText = runs
    ? (g.trigger.key ? 'When ' + triggerText(g.trigger.key, g.trigger.value, statusName).replace(/^./, (c) => c.toLowerCase()) : 'Select a trigger')
    : (g.trigger.text || (g.kind === 'process' ? 'Describe how this process starts' : 'What sparks this idea?'));

  // ---------- Canvas pieces ----------
  // Canvas pieces are plain functions, not components: a component declared in render remounts on every change,
  // which would swap out a drop target in the middle of a drag.
  const plusAt = (pathId, index) => {
    const key = (pathId || 'root') + '|' + index;
    const open = menu === key;
    const hot = dropAt === key;
    const items = [
      ...ACTION_GROUPS.map((grp) => ({ head: grp.label, list: grp.keys.map((k) => ({ spec: { type: 'action', key: k }, label: actionById(k).label, icon: ACTION_IC[k], tone: ACTION_TONE[k], off: actionById(k).needs && !connected[actionById(k).needs] })) })),
      { head: 'Logic', list: ['delay', 'split'].map((t) => ({ spec: { type: t }, label: STEP_DEF[t].label, icon: STEP_DEF[t].icon, tone: STEP_DEF[t].tone })) },
      { head: 'Planning', list: ['task', 'note'].map((t) => ({ spec: { type: t }, label: STEP_DEF[t].label, icon: STEP_DEF[t].icon, tone: STEP_DEF[t].tone })) },
    ];
    if (!runs) items.unshift(items.pop());
    return (
      <div key={'plus-' + key} style={css('position: relative; display: flex; flex-direction: column; align-items: center;')}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('text/x-flow-step')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (dropAt !== key) setDropAt(key); } }}
        onDragLeave={() => { if (dropAt === key) setDropAt(''); }}
        onDrop={(e) => { e.preventDefault(); setDropAt(''); try { add(pathId, index, JSON.parse(e.dataTransfer.getData('text/x-flow-step'))); } catch { /* not a step */ } }}>
        <span style={css('width: 2px; height: 18px; background: var(--border-2);')} />
        <button type="button" aria-label={open ? 'Close step menu' : 'Add a step here'} aria-haspopup="menu" aria-expanded={open} onClick={() => setMenu(open ? '' : key)}
          style={css('width: ' + (hot ? 48 : 40) + 'px; height: ' + (hot ? 48 : 40) + 'px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: width 120ms, height 120ms; ' + (hot ? 'border: 2px dashed ' + RING + '; background: rgba(47,91,211,0.08); color: ' + RING + ';' : 'border: 1px solid var(--line-4); background: var(--surface); color: var(--ink-2); box-shadow: 0 1px 2px rgba(0,0,0,0.06);'))}>
          <Ico d={open ? IC.close : IC.plus} size={18} />
        </button>
        <span style={css('width: 2px; height: 18px; background: var(--border-2);')} />
        {open ? (
          <div role="menu" aria-label="Add a step" style={css(S.pop + ' top: 64px; left: calc(50% + 4px); width: 280px;')}>
            {items.map((grp) => (
              <Fragment key={grp.head}>
                <p style={css(S.head)}>{grp.head}</p>
                {grp.list.map((it) => (
                  <button key={it.label} type="button" role="menuitem" className="mitem" onClick={() => add(pathId, index, it.spec)} style={css(S.item)}>
                    <span style={css(tile(it.tone, 26))}><Ico d={it.icon} size={14} /></span>
                    <span style={css('flex: 1;')}>{it.label}</span>
                    {it.off ? <span title="Not connected" style={css('width: 7px; height: 7px; border-radius: 99px; background: var(--amber-ink);')} /> : null}
                  </button>
                ))}
              </Fragment>
            ))}
          </div>
        ) : null}
      </div>
    );
  };
  const endPill = () => <span key="end" style={css('padding: 4px 12px; border-radius: 999px; background: var(--chip); color: var(--ink-3); font-size: 13px; font-weight: 500;')}>End</span>;

  const nodeCard = (n) => {
    const on = sel === n.id;
    const def = n.type === 'action' ? actionById(n.key) : null;
    const tone = n.type === 'action' ? ACTION_TONE[n.key] || 'blue' : STEP_DEF[n.type].tone;
    const icon = n.type === 'action' ? ACTION_IC[n.key] || IC.bolt : STEP_DEF[n.type].icon;
    const owner = n.type === 'task' && n.owner ? (D.members || []).find((m) => m.user_id === n.owner) : null;
    const sub = n.type === 'action' ? (n.message ? n.message : def ? def.label : 'Choose an action')
      : n.type === 'delay' ? 'Wait ' + (n.amount || 0) + ' ' + (n.unit || 'days')
      : n.type === 'task' ? (owner ? 'For ' + ((owner.person && (owner.person.full_name || owner.person.name)) || 'a teammate') : 'For Super Admins') + (n.note ? ' · ' + n.note : '')
      : n.type === 'note' ? n.note || 'Write the idea down'
      : (n.paths || []).length + ' paths';
    const needs = def && def.needs;
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); setSel(n.id); setMenu(''); }} aria-pressed={on} aria-label={titles[n.id] + ': ' + sub}
        style={css(S.card + cardRing(on, warnIds.has(n.id)) + (n.type === 'note' ? ' background: var(--amber-soft);' : ''))}>
        <span style={css('display: flex; align-items: center; gap: 10px;')}>
          <span style={css(tile(tone))}><Ico d={icon} /></span>
          <span style={css('flex: 1; min-width: 0; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>{titles[n.id]}</span>
          {warnIds.has(n.id) ? <span title="Needs attention" style={css('color: var(--amber-ink); display: inline-flex;')}><Ico d={IC.warn} /></span> : null}
        </span>
        {n.type !== 'split' ? <span style={css('display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 10px; font-size: 14px; line-height: 1.45; color: var(--ink-3);')}>{sub}</span> : null}
        {(n.tags && n.tags.length) || needs ? (
          <span style={css('display: flex; align-items: center; gap: 6px; margin-top: 12px;')}>
            <TagChips tags={n.tags} small />
            <span style={css('flex: 1;')} />
            {needs ? <span style={css('display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--line-4); font-size: 12px; color: var(--ink-3);')}><span style={css('width: 7px; height: 7px; border-radius: 99px; background: ' + (connected[needs] ? '#2BA24C' : 'var(--amber-ink)') + ';')} />{connected[needs] ? def.app : 'Not connected'}</span> : null}
          </span>
        ) : null}
      </button>
    );
  };

  const pathHead = (p, i, last) => {
    const on = sel === p.id;
    const crit = p.when.map((c) => critText(c)).join(' and ');
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); setSel(p.id); setMenu(''); }} aria-pressed={on} aria-label={p.name + (last ? '' : crit ? ': ' + crit : ': no criteria yet')}
        style={css(S.card + ' width: 260px;' + cardRing(on, warnIds.has(p.id)))}>
        <span style={css('display: flex; align-items: center; gap: 10px;')}>
          <span style={css('width: 22px; height: 22px; flex: none; border-radius: 999px; background: var(--chip); display: inline-flex; align-items: center; justify-content: center; font-size: 12px; color: var(--ink-3);')}>{i + 1}</span>
          <span style={css('flex: 1; min-width: 0; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>{p.name}</span>
        </span>
        {!last ? (
          crit ? <span style={css('display: block; margin-top: 10px; font-size: 13px; line-height: 1.45; color: var(--ink-3);')}>{crit}</span>
            : <span style={css('display: flex; align-items: center; justify-content: center; margin-top: 12px; height: 40px; border: 1px dashed var(--border-strong); border-radius: 10px; font-size: 14px; color: var(--ink-3);')}>Add path criteria</span>
        ) : <span style={css('display: block; margin-top: 8px; font-size: 13px; color: var(--muted);')}>Anything the paths before did not take</span>}
      </button>
    );
  };

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
  function critText(c) {
    const f = FIELDS.find((x) => x.key === c.field);
    if (!f) return '';
    const v = c.op === 'set' || c.op === 'empty' ? '' : ' ' + ((optionsFor(f.source).find((o) => o[0] === c.value) || [c.value, c.value || '…'])[1]);
    return f.label + ' ' + OPS[c.op] + v;
  }

  const column = (list, pathId) => {
    const last = list[list.length - 1];
    return (
      <div style={css('display: flex; flex-direction: column; align-items: center;')}>
        {list.map((n, i) => (
          <Fragment key={n.id}>
            {plusAt(pathId, i)}
            {n.type === 'split' ? splitBlock(n) : nodeCard(n)}
          </Fragment>
        ))}
        {!last || last.type !== 'split' ? (<>{plusAt(pathId, list.length)}{endPill()}</>) : null}
      </div>
    );
  };
  const splitBlock = (n) => (
    <div style={css('display: flex; flex-direction: column; align-items: center;')}>
      {nodeCard(n)}
      <span style={css('width: 2px; height: 24px; background: var(--border-2);')} />
      <div style={css('display: flex; align-items: flex-start;')}>
        {n.paths.map((p, i) => {
          const first = i === 0, lastP = i === n.paths.length - 1;
          return (
            <div key={p.id} style={css('display: flex; flex-direction: column; align-items: center; padding: 0 20px;')}>
              <div style={css('align-self: stretch; display: flex; height: 2px; margin: 0 -20px;')}>
                <span style={css('flex: 1; background: ' + (first ? 'transparent' : 'var(--border-2)') + ';')} />
                <span style={css('flex: 1; background: ' + (lastP ? 'transparent' : 'var(--border-2)') + ';')} />
              </div>
              <span style={css('width: 2px; height: 16px; background: var(--border-2);')} />
              <span style={css('padding: 3px 12px; border-radius: 999px; background: ' + RING + '; color: #FFFFFF; font-size: 12px; font-weight: 600;')}>{lastP ? 'Otherwise' : first ? 'Check first' : 'Then check'}</span>
              <span style={css('width: 2px; height: 12px; background: var(--border-2);')} />
              {pathHead(p, i, lastP)}
              {column(p.steps, p.id)}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ---------- Left panel ----------
  const at = sel && sel !== 'trigger' && sel !== 'flow' ? locate(g, sel) : null;
  const panelTitle = sel === 'trigger' ? (runs ? (g.trigger.key ? 'Set up trigger' : 'Select a trigger') : 'How it starts')
    : sel === 'flow' ? 'Flow details' : at && at.node ? (at.node.type === 'action' ? 'Action details' : STEP_DEF[at.node.type].label + ' details') : at && at.path ? 'Path details' : 'Actions';
  const panelIcon = sel === 'trigger' ? IC.bolt : sel === 'flow' ? IC.pencil : at && at.node ? (at.node.type === 'action' ? ACTION_IC[at.node.key] : STEP_DEF[at.node.type].icon) : at && at.path ? IC.split : null;

  const palettePanel = () => {
    const groups = [
      ...ACTION_GROUPS.map((grp) => ({ head: grp.label, list: grp.keys.map((k) => ({ spec: { type: 'action', key: k }, label: actionById(k).label.replace(/^Notify Super Admin in /, '').replace(/^Email the assigned /, 'Email '), icon: ACTION_IC[k], tone: ACTION_TONE[k], off: actionById(k).needs && !connected[actionById(k).needs] })) })),
      { head: 'Logic', list: ['delay', 'split'].map((t) => ({ spec: { type: t }, label: STEP_DEF[t].label, icon: STEP_DEF[t].icon, tone: STEP_DEF[t].tone })) },
      { head: 'Planning', list: ['task', 'note'].map((t) => ({ spec: { type: t }, label: STEP_DEF[t].label, icon: STEP_DEF[t].icon, tone: STEP_DEF[t].tone })) },
    ];
    if (!runs) groups.unshift(groups.pop());
    return (
      <div style={css('display: flex; flex-direction: column; gap: 4px;')}>
        <p style={css(S.muted + ' padding: 0 2px 6px;')}>Drag a step onto a + in the flow, or click to add it {sel ? 'after the selected card' : 'at the end'}.</p>
        {groups.map((grp) => (
          <Fragment key={grp.head}>
            <p style={css('margin: 10px 0 2px; font-size: 13px; color: var(--muted-2);')}>{grp.head}</p>
            {grp.list.map((it) => (
              <button key={it.label} type="button" draggable onDragStart={(e) => { e.dataTransfer.setData('text/x-flow-step', JSON.stringify(it.spec)); e.dataTransfer.effectAllowed = 'copy'; }}
                onClick={() => addDefault(it.spec)} className="mitem" title={it.off ? 'Not connected yet' : undefined}
                style={css(S.item + ' min-height: 44px; cursor: grab;')}>
                <span style={css(tile(it.tone, 28))}><Ico d={it.icon} size={15} /></span>
                <span style={css('flex: 1; font-weight: 500;')}>{it.label}</span>
                {it.off ? <span style={css('font-size: 11px; color: var(--amber-ink);')}>Not connected</span> : null}
                <span style={css('color: var(--faint); display: inline-flex;')}><Ico d={IC.grip} size={14} sw={2.4} /></span>
              </button>
            ))}
          </Fragment>
        ))}
      </div>
    );
  };

  const triggerPanel = () => {
    if (!runs) return (
      <div style={css('display: flex; flex-direction: column; gap: 16px;')}>
        <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
          <label htmlFor="fb-start" style={css(S.label)}>{g.kind === 'process' ? 'Starts when' : 'The spark'}</label>
          <textarea id="fb-start" rows={3} value={g.trigger.text} onChange={(e) => edit((x) => { x.trigger.text = e.target.value; })} placeholder={g.kind === 'process' ? 'A sponsor signs, a video is greenlit…' : 'What if we…'} style={css(S.area)} />
        </div>
        <TagSelect id="fb-ttags" value={g.trigger.tags} onChange={(v) => edit((x) => { x.trigger.tags = v; })} sources={sources} />
      </div>
    );
    const t = triggerById(g.trigger.key);
    const vals = t && t.values ? (t.values === 'statuses' ? (D.statuses || []).map((x) => [x.label, x.label]) : t.values) : null;
    return (
      <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
        <p style={css(S.muted)}>Work enters the flow when this happens.</p>
        {TRIGGERS.map((tr) => {
          const on = g.trigger.key === tr.key;
          return (
            <button key={tr.key} type="button" aria-pressed={on} onClick={() => edit((x) => { x.trigger.key = tr.key; x.trigger.value = tr.values === 'statuses' ? ((D.statuses || [])[0] || {}).label || '' : tr.values ? tr.values[0][0] : ''; })}
              style={css('display: flex; flex-direction: column; gap: 4px; padding: ' + (on ? '13px 15px' : '14px 16px') + '; border-radius: 14px; text-align: left; cursor: pointer; font-family: inherit; color: var(--ink); background: var(--surface); border: ' + (on ? '2px solid ' + RING : '1px solid var(--line-4)') + ';')}>
              <span style={css('display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600;')}><span style={css(tile('amber', 26))}><Ico d={IC.bolt} size={14} /></span>{tr.label.replace(/ becomes$/, ' changes').replace(/ is$/, ' is coming up')}</span>
              <span style={css('padding-left: 36px; font-size: 13px; line-height: 1.45; color: var(--ink-3);')}>{(TRIGGER_DESC[tr.key] || ['', ''])[1]}</span>
            </button>
          );
        })}
        {vals ? <div style={css('margin-top: 6px;')}><Pick id="fb-tval" label={t.valueLabel || 'Value'} value={g.trigger.value} onChange={(v) => edit((x) => { x.trigger.value = v; })} options={vals} /></div> : null}
        <div style={css('margin-top: 6px;')}><TagSelect id="fb-ttags" value={g.trigger.tags} onChange={(v) => edit((x) => { x.trigger.tags = v; })} sources={sources} /></div>
      </div>
    );
  };

  const nodePanel = (n) => {
    const def = n.type === 'action' ? actionById(n.key) : null;
    const delAsk = confirm === 'delete:' + n.id;
    const inner = n.type === 'split' ? (n.paths || []).reduce((c, p) => { let k = 0; walk(p.steps, () => { k++; }); return c + k; }, 0) : 0;
    return (
      <div style={css('display: flex; flex-direction: column; gap: 16px;')}>
        {n.type === 'action' ? (
          <>
            <Pick id="fb-act" label="Action" value={n.key} onChange={(v) => editNode(n.id, { key: v })} options={ACTIONS.map((a) => [a.key, a.label])} />
            {def && def.needs ? (
              <div style={css('display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; background: ' + (connected[def.needs] ? 'var(--green-soft)' : 'var(--amber-soft)') + '; color: ' + (connected[def.needs] ? 'var(--green-ink)' : 'var(--amber-ink)') + '; font-size: 13px; font-weight: 600;')}>
                <span style={css('flex: 1;')}>{connected[def.needs] ? def.app + ' is connected.' : def.app + ' is not connected yet.'}</span>
                {!connected[def.needs] ? <button type="button" onClick={async () => { if (dirty && !(await save())) return; goConnect(def.needs); }} style={css(S.btn + S.ghost + ' min-height: 32px; font-size: 13px;')}>Connect</button> : null}
              </div>
            ) : null}
            {def && def.message ? <MessageField id="fb-msg" label={def.message} value={n.message} onChange={(v) => editNode(n.id, { message: v })} placeholder={'Add a note. Insert data like {{project.title}}.'} /> : null}
            {def && !def.message ? <p style={css(S.muted)}>{def.key === 'status_next' ? 'Moves the project to the status after its current one, with the board’s approval and lock rules.' : def.key === 'buffer_publish' ? 'Posts the project’s Social post to the Buffer channels chosen in the project drawer.' : 'Sends the run (flow, trigger and project) as JSON to your n8n webhook.'}</p> : null}
          </>
        ) : null}
        {n.type === 'task' ? (
          <>
            <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
              <label htmlFor="fb-ttl" style={css(S.label)}>Task</label>
              <input id="fb-ttl" value={n.title || ''} onChange={(e) => editNode(n.id, { title: e.target.value })} placeholder="Book the studio" style={css(S.input)} />
            </div>
            <Pick id="fb-own" label="Owner" value={n.owner || ''} onChange={(v) => editNode(n.id, { owner: v })} placeholder="Every Super Admin"
              options={(D.members || []).filter((m) => m.status === 'active').map((m) => [m.user_id, (m.person && (m.person.full_name || m.person.name)) || 'Member'])} />
            <MessageField id="fb-tnote" label="Notes" rows={3} value={n.note} onChange={(v) => editNode(n.id, { note: v })} placeholder="Checklist, links, who to ask…" />
            {runs ? <p style={css(S.muted)}>When the flow runs, this adds a To-Do on the owner’s Daily page.</p> : null}
          </>
        ) : null}
        {n.type === 'note' ? (
          <>
            <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
              <label htmlFor="fb-nt" style={css(S.label)}>Title</label>
              <input id="fb-nt" value={n.title || ''} onChange={(e) => editNode(n.id, { title: e.target.value })} placeholder="Try a teaser cut" style={css(S.input)} />
            </div>
            <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
              <label htmlFor="fb-nn" style={css(S.label)}>Note</label>
              <textarea id="fb-nn" rows={6} value={n.note || ''} onChange={(e) => editNode(n.id, { note: e.target.value })} placeholder="Thinking out loud is welcome here." style={css(S.area)} />
            </div>
            <p style={css(S.muted)}>Notes never run. They keep ideas next to the steps they are about.</p>
          </>
        ) : null}
        {n.type === 'delay' ? (
          <div style={css('display: grid; grid-template-columns: 1fr 1fr; gap: 10px;')}>
            <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
              <label htmlFor="fb-amt" style={css(S.label)}>Wait</label>
              <input id="fb-amt" type="number" min={0} max={365} value={n.amount} onChange={(e) => editNode(n.id, { amount: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })} style={css(S.input)} />
            </div>
            <Pick id="fb-unit" label="Unit" value={n.unit || 'days'} onChange={(v) => editNode(n.id, { unit: v })} options={[['minutes', 'Minutes'], ['hours', 'Hours'], ['days', 'Days']]} />
          </div>
        ) : null}
        {n.type === 'split' ? (
          <>
            <p style={css(S.muted)}>Define criteria for each path. Work goes down the first path it matches; the last path takes everything else.</p>
            <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
              <label htmlFor="fb-sn" style={css(S.label)}>Split name</label>
              <input id="fb-sn" value={n.name || ''} onChange={(e) => editNode(n.id, { name: e.target.value })} placeholder={titles[n.id]} style={css(S.input)} />
            </div>
            <div style={css('display: flex; align-items: center;')}>
              <span style={css('flex: 1; font-size: 15px; font-weight: 600;')}>Paths ({n.paths.length} of 6)</span>
              <button type="button" disabled={n.paths.length >= 6} onClick={() => edit((x) => { const s2 = locate(x, n.id).node; s2.paths.splice(s2.paths.length - 1, 0, { id: newId('p'), name: 'Path #' + s2.paths.length, when: [], steps: [] }); })}
                style={css(S.btn + ' border: 0; background: transparent; color: var(--ink); padding: 0 6px;' + (n.paths.length >= 6 ? ' opacity: 0.4;' : ''))}><Ico d={IC.plus} /> Add path</button>
            </div>
            {n.paths.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setSel(p.id)} style={css('display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--line-4); border-radius: 12px; background: var(--surface); text-align: left; cursor: pointer; font-family: inherit; color: var(--ink);')}>
                <span style={css('width: 22px; height: 22px; flex: none; border-radius: 99px; background: var(--chip); display: inline-flex; align-items: center; justify-content: center; font-size: 12px;')}>{i + 1}</span>
                <span style={css('flex: 1; min-width: 0;')}>
                  <span style={css('display: block; font-size: 14px; font-weight: 600;')}>{p.name}</span>
                  <span style={css('display: block; font-size: 12px; color: var(--muted);')}>{i === n.paths.length - 1 ? 'Otherwise' : p.when.length ? p.when.map(critText).join(' and ') : 'No criteria yet'}</span>
                </span>
                <Ico d={IC.right} />
              </button>
            ))}
          </>
        ) : null}
        <TagSelect id="fb-ntags" value={n.tags} onChange={(v) => editNode(n.id, { tags: v })} sources={sources} />
        <div style={css('display: flex; flex-wrap: wrap; gap: 8px; padding-top: 8px; border-top: 1px solid var(--line);')}>
          {n.type !== 'split' ? (
            <>
              <button type="button" onClick={() => move(n.id, -1)} aria-label="Move up" title="Move up" style={css(S.btn + S.ghost + ' padding: 0 10px;')}><Ico d={IC.up} /></button>
              <button type="button" onClick={() => move(n.id, 1)} aria-label="Move down" title="Move down" style={css(S.btn + S.ghost + ' padding: 0 10px;')}><Ico d={IC.down} /></button>
              <button type="button" onClick={() => duplicate(n.id)} style={css(S.btn + S.ghost)}><Ico d={IC.copy} /> Duplicate</button>
            </>
          ) : null}
          <span style={css('flex: 1;')} />
          <button type="button" onClick={() => (n.type === 'split' && inner > 0 && !delAsk ? setConfirm('delete:' + n.id) : remove(n.id))}
            style={css(S.btn + ' border: 0; background: ' + (delAsk ? 'var(--red-soft)' : 'transparent') + '; color: var(--red-ink);')}>
            <Ico d={IC.trash} /> {delAsk ? 'Delete split and ' + inner + ' step' + (inner === 1 ? '' : 's') + '?' : 'Delete'}
          </button>
        </div>
      </div>
    );
  };

  const pathPanel = (p, split) => {
    const idx = split.paths.findIndex((x) => x.id === p.id);
    const last = idx === split.paths.length - 1;
    const editPath = (fn) => edit((x) => { const at2 = locate(x, p.id); if (at2 && at2.path) fn(at2.path, at2.split); });
    return (
      <div style={css('display: flex; flex-direction: column; gap: 16px;')}>
        <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
          <label htmlFor="fb-pn" style={css(S.label)}>Path name</label>
          <input id="fb-pn" value={p.name} onChange={(e) => editPath((pp) => { pp.name = e.target.value; })} style={css(S.input)} />
        </div>
        {last ? <p style={css(S.muted)}>Everything the paths before this one did not take comes here.</p> : (
          <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
            <span style={css('font-size: 15px; font-weight: 600;')}>Path criteria</span>
            {p.when.map((c, ci) => {
              const f = FIELDS.find((x) => x.key === c.field) || FIELDS[0];
              const needsValue = c.op === 'is' || c.op === 'is_not';
              return (
                <div key={ci} role="group" aria-label={'Condition ' + (ci + 1)} style={css('display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--line-4); border-radius: 12px;')}>
                  {ci > 0 ? <span style={css('font-size: 12px; font-weight: 600; color: var(--muted-2);')}>AND</span> : null}
                  <Pick id={'fb-cf' + ci} placeholder="Field" value={c.field} onChange={(v) => editPath((pp) => { const nf = FIELDS.find((x) => x.key === v); pp.when[ci] = { field: v, op: nf.ops[0], value: '' }; })} options={FIELDS.map((x) => [x.key, x.label])} />
                  <div style={css('display: grid; grid-template-columns: ' + (needsValue ? '120px 1fr' : '1fr') + '; gap: 8px;')}>
                    <Pick id={'fb-co' + ci} placeholder="Operator" value={c.op} onChange={(v) => editPath((pp) => { pp.when[ci].op = v; })} options={f.ops.map((o) => [o, OPS[o]])} />
                    {needsValue ? <Pick id={'fb-cv' + ci} placeholder="Choose…" value={c.value} onChange={(v) => editPath((pp) => { pp.when[ci].value = v; })} options={optionsFor(f.source)} /> : null}
                  </div>
                  <button type="button" onClick={() => editPath((pp) => { pp.when.splice(ci, 1); })} style={css(S.btn + ' align-self: flex-end; min-height: 30px; border: 0; background: transparent; color: var(--red-ink); font-size: 13px;')}><Ico d={IC.trash} size={14} /> Remove</button>
                </div>
              );
            })}
            <button type="button" onClick={() => editPath((pp) => { pp.when.push({ field: 'status', op: 'is', value: ((D.statuses || [])[0] || {}).label || '' }); })} style={css(S.btn + S.primary + ' align-self: flex-start;')}>
              <Ico d={IC.plus} /> {p.when.length ? 'Add condition' : 'Add path criteria'}
            </button>
          </div>
        )}
        <div style={css('display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid var(--line);')}>
          <button type="button" onClick={() => setSel(split.id)} style={css(S.btn + S.ghost)}><Ico d={IC.back} /> Split</button>
          <span style={css('flex: 1;')} />
          {!last && split.paths.length > 2 ? (
            <button type="button" onClick={() => { edit((x) => { const s2 = locate(x, split.id).node; s2.paths = s2.paths.filter((q) => q.id !== p.id); }); setSel(split.id); }} style={css(S.btn + ' border: 0; background: transparent; color: var(--red-ink);')}>
              <Ico d={IC.trash} /> Delete path
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const flowPanel = () => (
    <div style={css('display: flex; flex-direction: column; gap: 16px;')}>
      <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
        <label htmlFor="fb-name" style={css(S.label)}>Name</label>
        <input id="fb-name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} style={css(S.input)} />
      </div>
      <Pick id="fb-kind" label="Type" value={g.kind} onChange={(v) => edit((x) => { x.kind = v; if (v !== 'automation' && !x.trigger.key) x.trigger.key = 'manual'; if (v === 'automation' && x.trigger.key === 'manual') x.trigger.key = ''; })} options={KINDS.map((k) => [k[0], k[1] + ' — ' + k[2]])} />
      <Pick id="fb-cat" label="Section" value={category} onChange={(v) => { setCategory(v); setDirty(true); }} options={[['production', 'Production'], ['sponsor', 'Sponsors & clients'], ['publishing', 'Publishing & distribution'], ['custom', 'Custom']]} />
      <TagSelect id="fb-ftags" value={g.tags} onChange={(v) => edit((x) => { x.tags = v; })} sources={sources} />
      {g.kind !== 'automation' && row.enabled && !row.is_draft ? <p style={css(S.muted)}>Saving as a {g.kind} turns the automation off.</p> : null}
    </div>
  );

  // ---------- Layout ----------
  const steps = (() => { let k = 0; walk(g.steps, () => { k++; }); return k; })();
  const warns = issues.filter((x) => x.level === 'warn').length;
  const zoomBy = (d) => setZoom((z) => Math.min(1.5, Math.max(0.4, Math.round((z + d) * 10) / 10)));
  const fit = () => {
    const el = canvas.current;
    if (!el) return;
    const inner = el.firstChild;
    const w = inner ? inner.scrollWidth : el.clientWidth;
    setZoom(Math.min(1, Math.max(0.4, Math.floor(((el.clientWidth - 48) / w) * 10) / 10)));
    el.scrollTo({ top: 0, left: 0 });
  };
  const onPanDown = (e) => {
    if (e.button !== 0 || e.target !== e.currentTarget && !(e.target instanceof Element && e.target.dataset.pan)) return;
    pan.current = { x: e.clientX, y: e.clientY, l: canvas.current.scrollLeft, t: canvas.current.scrollTop, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPanMove = (e) => {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) p.moved = true;
    canvas.current.scrollLeft = p.l - dx; canvas.current.scrollTop = p.t - dy;
  };
  const onPanUp = () => { const p = pan.current; pan.current = null; if (p && !p.moved) { setSel(''); setMenu(''); } };

  const showPanel = palette || !!sel;
  return (
    <div className="fbx" role="dialog" aria-modal="true" aria-label={'Flow builder: ' + name}
      style={css('position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; background: var(--page); color: var(--ink); font-family: var(--font-main);')}>
      <style>{`
        .fbx .mitem:hover { background: var(--hover); }
        .fbx-body { display: flex; flex: 1 1 auto; min-height: 0; gap: 12px; padding: 0 12px 12px; }
        .fbx-side { width: 340px; flex: none; display: flex; flex-direction: column; min-height: 0; background: var(--surface); border: 1px solid var(--line-4); border-radius: 18px; overflow: hidden; }
        .fbx-right { width: 320px; flex: none; }
        .fbx-hide-sm { display: inline-flex; }
        @media (max-width: 860px) {
          .fbx-body { flex-direction: column; overflow-y: auto; }
          .fbx-side, .fbx-right { width: auto; max-height: 55vh; }
          .fbx-canvas { min-height: 60vh; flex: none !important; }
          .fbx-hide-sm { display: none; }
        }
      `}</style>

      {/* Top bar */}
      <header style={css('flex: none; display: flex; align-items: center; gap: 8px; min-height: 60px; padding: 8px 12px; box-sizing: border-box; flex-wrap: wrap;')}>
        <button type="button" onClick={leave} aria-label="Back to automations" title="Back to automations" style={css(S.icon)}><Ico d={IC.back} size={20} /></button>
        <button type="button" onClick={() => setSel('flow')} title="Flow details" style={css('display: inline-flex; align-items: center; gap: 8px; min-width: 0; max-width: 46vw; height: 38px; padding: 0 8px; border: 0; border-radius: 10px; background: transparent; color: var(--ink); cursor: pointer; font-family: inherit;')}>
          <span style={css('font-size: 17px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>{name || 'Untitled flow'}</span>
          <Ico d={IC.chev} />
        </button>
        <span style={css('display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; background: ' + toneBg(statusTone) + '; color: ' + toneInk(statusTone) + '; font-size: 13px; font-weight: 600;')}>
          <span style={css('width: 7px; height: 7px; border-radius: 99px; background: currentColor;')} />{status}
        </span>
        {g.tags.length ? <span className="fbx-hide-sm" style={css('min-width: 0;')}><TagChips tags={g.tags} max={3} small /></span> : null}
        {dirty ? <span style={css('font-size: 13px; color: var(--muted);')}>Unsaved changes</span> : null}
        <span style={css('flex: 1;')} />
        <button type="button" onClick={() => setSide(side === 'alerts' ? '' : 'alerts')} aria-pressed={side === 'alerts'} aria-label={'Alerts, ' + issues.length} title="Alerts"
          style={css(S.icon + ' position: relative;' + (side === 'alerts' ? ' background: var(--blue-soft); color: var(--blue-ink);' : ''))}>
          <Ico d={IC.bell} size={18} />
          {issues.length ? <span style={css('position: absolute; top: 3px; right: 2px; min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box; border-radius: 99px; background: ' + (warns ? '#C42B2F' : 'var(--ink-3)') + '; color: #FFFFFF; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;')}>{issues.length}</span> : null}
        </button>
        {runs ? <button type="button" onClick={runTest} disabled={!!busy} style={css(S.btn + S.ghost + (busy ? ' opacity: 0.6;' : ''))}><Ico d={IC.play} size={14} /> {busy === 'test' ? 'Testing…' : 'Test run'}</button> : null}
        <button type="button" onClick={() => save()} disabled={!dirty || !!busy} style={css(S.btn + S.ghost + (!dirty || busy ? ' opacity: 0.5; cursor: default;' : ''))}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
        {runs ? (
          row.enabled && !row.is_draft
            ? <button type="button" onClick={() => save('off')} disabled={!!busy} style={css(S.btn + S.primary)}>Turn off</button>
            : <button type="button" onClick={() => setConfirm('review')} disabled={!!busy} style={css(S.btn + S.primary)}>Review and turn on</button>
        ) : null}
      </header>

      <div className="fbx-body">
        {/* Left panel: Actions palette, or the selected card's details */}
        {showPanel ? (
          <aside className="fbx-side" aria-label={panelTitle}>
            <div style={css('display: flex; align-items: center; gap: 12px; padding: 18px 16px 14px 20px; border-bottom: 1px solid var(--line);')}>
              {panelIcon ? <span style={css(tile(sel === 'trigger' ? 'gray' : at && at.node && at.node.type === 'action' ? ACTION_TONE[at.node.key] : at && at.node ? STEP_DEF[at.node.type].tone : 'gray', 40) + ' border-radius: 12px;')}><Ico d={panelIcon} size={18} /></span> : null}
              <h2 style={css('flex: 1; margin: 0; font-size: 19px; font-weight: 700;')}>{panelTitle}</h2>
              <button type="button" aria-label={sel ? 'Close details' : 'Hide actions'} title={sel ? 'Close' : 'Hide panel'} onClick={() => (sel ? setSel('') : setPalette(false))} style={css(S.icon)}><Ico d={sel ? IC.close : IC.panel} size={18} /></button>
            </div>
            <div key={sel || 'palette'} style={css('flex: 1; min-height: 0; overflow-y: auto; padding: 16px 20px 24px;')}>
              {sel === 'trigger' ? triggerPanel() : sel === 'flow' ? flowPanel() : at && at.node ? nodePanel(at.node) : at && at.path ? pathPanel(at.path, at.split) : palettePanel()}
            </div>
          </aside>
        ) : null}

        {/* Canvas */}
        <main className="fbx-canvas" style={css('position: relative; flex: 1 1 auto; min-width: 0; display: flex; background: var(--surface-2); border: 1px solid var(--line-4); border-radius: 18px; overflow: hidden;')}>
          {!showPanel ? (
            <button type="button" onClick={() => setPalette(true)} aria-label="Show actions" title="Show actions" style={css(S.btn + S.ghost + ' position: absolute; z-index: 5; top: 12px; left: 12px;')}><Ico d={IC.panel} /> Actions</button>
          ) : null}
          <div ref={canvas} onPointerDown={onPanDown} onPointerMove={onPanMove} onPointerUp={onPanUp}
            style={css('flex: 1; overflow: auto; cursor: grab; background-image: radial-gradient(var(--line-4) 1px, transparent 1px); background-size: 20px 20px;')}>
            <div data-pan="1" style={css('min-width: 100%; width: max-content; padding: 64px 24px 160px; box-sizing: border-box; display: flex; justify-content: center; zoom: ' + zoom + ';')}>
              <div data-pan="1" style={css('display: flex; flex-direction: column; align-items: center;')}>
                <button type="button" onClick={(e) => { e.stopPropagation(); setSel('trigger'); setMenu(''); }} aria-pressed={sel === 'trigger'} aria-label={'Trigger: ' + trigText}
                  style={css(S.card + ' width: 340px;' + cardRing(sel === 'trigger', warnIds.has('trigger')))}>
                  <span style={css('display: flex; align-items: center; gap: 10px;')}>
                    <span style={css('width: 32px; height: 32px; flex: none; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--ink-3); color: var(--surface);')}><Ico d={IC.bolt} /></span>
                    <span style={css('flex: 1; font-size: 15px; font-weight: 600;')}>{runs ? 'Trigger' : g.kind === 'process' ? 'Start' : 'Spark'}</span>
                  </span>
                  <span style={css('display: block; margin-top: 12px; font-size: 15px; line-height: 1.45; color: ' + (runs && !g.trigger.key ? 'var(--muted)' : 'var(--ink-2)') + ';')}>{trigText}</span>
                  {g.trigger.tags.length ? <span style={css('display: block; margin-top: 12px;')}><TagChips tags={g.trigger.tags} small /></span> : null}
                </button>
                {column(g.steps, null)}
              </div>
            </div>
          </div>
          {/* Zoom controls */}
          <div role="group" aria-label="Zoom" style={css('position: absolute; right: 12px; bottom: 12px; display: flex; flex-direction: column; align-items: center; padding: 4px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);')}>
            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(0.1)} style={css(S.icon + ' width: 34px; height: 34px;')}><Ico d={IC.plus} /></button>
            <button type="button" aria-label="Reset zoom" onClick={() => setZoom(1)} style={css('border: 0; background: transparent; padding: 4px 0; font-size: 12px; font-family: ui-monospace, monospace; color: var(--ink-2); cursor: pointer;')}>{Math.round(zoom * 100)}%</button>
            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(-0.1)} style={css(S.icon + ' width: 34px; height: 34px;')}><Ico d={IC.minus} /></button>
            <span style={css('width: 24px; height: 1px; margin: 4px 0; background: var(--line-4);')} />
            <button type="button" aria-label="Fit to screen" title="Fit" onClick={fit} style={css(S.icon + ' width: 34px; height: 34px;')}><Ico d={IC.fit} /></button>
          </div>
          <p style={css('position: absolute; left: 14px; bottom: 12px; margin: 0; font-size: 12px; color: var(--muted-2);')}>{steps} step{steps === 1 ? '' : 's'}</p>
        </main>

        {/* Right panel: alerts or the last test run */}
        {side ? (
          <aside className="fbx-side fbx-right" aria-label={side === 'alerts' ? 'Alerts' : 'Test run'}>
            <div style={css('display: flex; align-items: center; gap: 8px; padding: 18px 12px 0 20px;')}>
              <h2 style={css('flex: 1; margin: 0; font-size: 19px; font-weight: 700;')}>{side === 'alerts' ? 'Alerts' : 'Test run'}</h2>
              <button type="button" aria-label="Close panel" onClick={() => setSide('')} style={css(S.icon)}><Ico d={IC.close} size={18} /></button>
            </div>
            <div role="tablist" aria-label="Panel" style={css('display: flex; gap: 20px; padding: 0 20px; border-bottom: 1px solid var(--line);')}>
              {[['alerts', 'Alerts', issues.length], runs ? ['test', 'Test run', null] : null].filter(Boolean).map((t) => (
                <button key={t[0]} type="button" role="tab" aria-selected={side === t[0]} onClick={() => setSide(t[0])}
                  style={css('min-height: 44px; padding: 0 2px; border: 0; border-bottom: 2px solid ' + (side === t[0] ? 'var(--ink)' : 'transparent') + '; background: transparent; font-size: 14px; font-weight: 600; color: ' + (side === t[0] ? 'var(--ink)' : 'var(--muted)') + '; cursor: pointer; font-family: inherit;')}>
                  {t[1]}{t[2] != null ? <span style={css('margin-left: 6px; padding: 1px 7px; border-radius: 99px; background: var(--chip); font-size: 12px;')}>{t[2]}</span> : null}
                </button>
              ))}
            </div>
            <div style={css('flex: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;')}>
              {side === 'alerts' ? (issues.length ? issues.map((x, i) => (
                <div key={i} style={css('display: flex; gap: 12px; padding: 16px; border: 1px solid var(--line-4); border-radius: 16px;')}>
                  <span style={css('flex: none; color: ' + (x.level === 'warn' ? 'var(--amber-ink)' : 'var(--blue-ink)') + ';')}><Ico d={x.level === 'warn' ? IC.warn : IC.info} size={18} /></span>
                  <div style={css('flex: 1; display: flex; flex-direction: column; gap: 6px;')}>
                    <strong style={css('font-size: 15px;')}>{x.title}</strong>
                    <p style={css(S.muted + ' color: var(--ink-3);')}>{x.body}</p>
                    {x.id !== 'end' ? <button type="button" onClick={() => setSel(x.id)} style={css(S.btn + S.ghost + ' align-self: flex-end; min-height: 32px; font-size: 13px;')}>Review</button> : null}
                  </div>
                </div>
              )) : <p style={css(S.muted)}>No alerts. This flow is ready.</p>) : null}
              {side === 'test' ? (
                busy === 'test' ? <p role="status" style={css(S.muted)}>Running a test on the newest project…</p>
                  : testRun ? (
                    <>
                      <p style={css(S.muted)}>{(testRun.output && testRun.output.project) ? 'On ' + testRun.output.project.job + ' · ' + testRun.output.project.title + '. Nothing was sent or changed.' : 'Nothing was sent or changed.'}</p>
                      {((testRun.output || {}).steps || []).map((x, i) => (
                        <div key={i} style={css('display: flex; gap: 10px; padding: 12px 14px; border-radius: 12px; background: ' + (x.ok ? 'var(--green-soft)' : 'var(--red-soft)') + '; color: ' + (x.ok ? 'var(--green-ink)' : 'var(--red-ink)') + '; font-size: 13px; line-height: 1.45;')}>
                          <Ico d={x.ok ? IC.check : IC.close} size={15} sw={2.4} style="flex: none; margin-top: 2px;" />
                          <span>{x.detail}</span>
                        </div>
                      ))}
                      {testRun.error && !((testRun.output || {}).steps || []).some((x) => !x.ok) ? <p role="alert" style={css(S.muted + ' color: var(--red-ink);')}>{testRun.error}</p> : null}
                    </>
                  ) : <p style={css(S.muted)}>Test run describes what each step would do on the newest project, without sending or changing anything.</p>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {/* Confirmations */}
      {confirm === 'review' || confirm === 'leave' ? (
        <div style={css('position: fixed; inset: 0; z-index: 75; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,0.45);')}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="fb-cf-t" style={css('width: 520px; max-width: 100%; box-sizing: border-box; padding: 28px 32px; background: var(--surface); border-radius: 20px; box-shadow: 0 24px 80px rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 16px;')}>
            <div style={css('display: flex; align-items: center;')}>
              <h2 id="fb-cf-t" style={css('flex: 1; margin: 0; font-size: 21px; font-weight: 700;')}>{confirm === 'leave' ? 'Leave without saving?' : 'Review and turn on'}</h2>
              <button type="button" aria-label="Close" onClick={() => setConfirm('')} style={css(S.icon)}><Ico d={IC.close} size={18} /></button>
            </div>
            {confirm === 'leave' ? <p style={css('margin: 0; font-size: 15px; line-height: 1.5; color: var(--ink-3);')}>Your changes to this flow are not saved yet.</p> : (
              <>
                <p style={css('margin: 0; font-size: 15px; line-height: 1.5; color: var(--ink-3);')}>Once it is on, the flow runs each time its trigger fires. You can turn it off any time.</p>
                <div style={css('padding: 14px 16px; border-radius: 12px; background: var(--surface-2); display: flex; flex-direction: column; gap: 6px; font-size: 14px;')}>
                  <span><strong>Trigger:</strong> {g.trigger.key ? triggerText(g.trigger.key, g.trigger.value, statusName) : 'none yet'}</span>
                  <span><strong>Steps:</strong> {steps}{compile(g).actions.length ? ' (' + compile(g).actions.map((a) => a.label).join(', ') + ')' : ''}</span>
                  {paused ? <span style={css('color: var(--amber-ink);')}>Pause all automations is on, so nothing runs until you resume.</span> : null}
                </div>
                {warns ? <p role="alert" style={css('margin: 0; font-size: 14px; color: var(--red-ink);')}>Fix {warns} alert{warns === 1 ? '' : 's'} first: {issues.filter((x) => x.level === 'warn').map((x) => x.title).join(', ')}.</p> : null}
              </>
            )}
            <div style={css('display: flex; justify-content: flex-end; gap: 10px;')}>
              {confirm === 'leave' ? (
                <>
                  <button type="button" onClick={onClose} style={css(S.btn + S.ghost + ' color: var(--red-ink);')}>Discard changes</button>
                  <button type="button" onClick={async () => { if (await save()) onClose(); }} style={css(S.btn + S.primary)}>Save and leave</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setConfirm('')} style={css(S.btn + S.ghost)}>Cancel</button>
                  <button type="button" disabled={!!warns || !!busy} onClick={async () => { if (await save('live')) setConfirm(''); }} style={css(S.btn + S.primary + (warns || busy ? ' opacity: 0.45; cursor: default;' : ''))}>{busy === 'live' ? 'Turning on…' : 'Turn on'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Mounted by Studio.jsx while s.flowOpen is set: the Create flow dialog ('new'), then the builder for that flow.
export function FlowLayer({ D, A, open, set }) {
  if (open === 'new') return <CreateFlowDialog D={D} A={A} onCreated={(row) => set({ flowOpen: row.id })} onClose={() => set({ flowOpen: '' })} />;
  const row = (D.automations || []).find((a) => a.id === open);
  if (!row) return null;
  return <FlowBuilder key={row.id} D={D} A={A} row={row} onClose={() => set({ flowOpen: '' })}
    goConnect={(provider) => set({ flowOpen: '', nav: 'workspace', wsTab: 'integ', integFocus: provider })} />;
}
