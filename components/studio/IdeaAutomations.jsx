'use client';
import { useRef, useState } from 'react';
import { ideaTriggers, actionsFor, actionById, triggerById, triggerText, scopeOf, triggerOf, actionsOf } from '../../lib/automations/catalog';

// Ideas > Automate: Monday-style "When this happens, do that" for ideas. Ready-made templates, a sentence builder and
// the workspace's idea automations with on/off, Test and Delete. Rows are ordinary automations (lib/automations/catalog.ts
// scope 'idea'), so they also show under Automations and their runs under Run history.

const sentence = { margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--ink-2)' };
const strong = { fontWeight: 700, color: 'var(--ink)' };
const select = { minHeight: 40, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontSize: 14, fontWeight: 600, maxWidth: '100%' };
const field = { width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--ink)', font: 'inherit', fontSize: 14 };
const ghost = { minHeight: 36, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const primary = { ...ghost, minHeight: 40, padding: '0 16px', border: 0, background: 'var(--inv)', color: 'var(--inv-ink)', fontSize: 14 };
const card = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' };
const h3 = { margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' };

export const TEMPLATES = [
  { id: 'research', name: 'Research ideas that reach Research', trig: 'idea_stage', value: 'research', act: 'idea_research', message: '' },
  { id: 'strong', name: 'Tell the owner about strong ideas', trig: 'idea_scored', value: '70', act: 'idea_email_owner', message: 'Research rates this idea highly. Worth a look.' },
  { id: 'quiet', name: 'Nudge owners on quiet ideas', trig: 'idea_stale', value: '14', act: 'idea_todo_owner', message: 'Move this idea forward or archive it' },
  { id: 'ready', name: 'Review ideas that reach Ready', trig: 'idea_stage', value: 'ready', act: 'todo_admin', message: 'Review and approve' },
  { id: 'advance', name: 'Advance top-scoring ideas', trig: 'idea_scored', value: '80', act: 'idea_stage_next', message: '' },
  { id: 'slack', name: 'Post new ideas to Slack', trig: 'idea_created', value: '', act: 'slack_admin', message: '' },
];

const lower = (s) => String(s || '').replace(/^./, (x) => x.toLowerCase());
const whenText = (key, value) => lower(triggerText(key, value));
const thenText = (key) => lower((actionById(key) || { label: key }).label);

// The automation row, built the same way as the Automations page dialog (lib/studio/vals-records.js).
export function automationRow({ name, trig, value, act, message }) {
  const a = actionById(act);
  return {
    name: String(name || '').trim() || triggerText(trig, value), category: 'custom',
    when_text: whenText(trig, value), then_text: thenText(act), app: a ? a.app : 'Ideas', flow: [['t'], ['a']],
    trigger: { key: trig, value: value || '', label: triggerText(trig, value) },
    actions: [{ key: act, label: a ? a.label : act, message: String(message || '').trim() }],
  };
}

export default function IdeaAutomations({ automations, runs, connected, sandbox, paused, onCreate, onUpdate, onDelete, onTest, openRuns, ago, triggerStyle }) {
  const dialog = useRef(null);
  const triggers = ideaTriggers();
  const [draft, setDraft] = useState({ trig: triggers[0].key, value: '', act: actionsFor(triggers[0].key)[0].key, message: '', name: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [ask, setAsk] = useState('');

  const t = triggerById(draft.trig) || triggers[0];
  const values = Array.isArray(t.values) ? t.values : null;
  const value = values ? (values.some((v) => v[0] === draft.value) ? draft.value : values[0][0]) : '';
  const fitting = actionsFor(t.key);
  const act = fitting.find((a) => a.key === draft.act) || fitting[0];
  const mine = (automations || []).filter((a) => scopeOf(triggerOf(a.trigger).key) === 'idea');
  const has = (trig, val, key) => mine.some((a) => { const x = triggerOf(a.trigger); return x.key === trig && (x.value || '') === (val || '') && actionsOf(a.actions).some((y) => y.key === key); });
  const needs = (key) => { const a = actionById(key); return a && a.needs && !(connected || {})[a.needs] ? (a.needs === 'slack' ? 'Slack' : a.needs === 'n8n' ? 'n8n' : a.needs) : ''; };

  const run = async (id, fn) => {
    setBusy(id); setError('');
    try { await fn(); } catch (err) { setError((err && err.message) || String(err)); }
    finally { setBusy(''); }
  };
  const create = (spec, id) => run(id, () => onCreate({ ...automationRow(spec), enabled: true, is_draft: !!sandbox }));
  const lastRun = (id) => (runs || []).find((r) => r.automation_id === id && !r.is_test);
  const RUN_LABEL = { done: 'Last run worked', failed: 'Last run failed', retry: 'Retrying', queued: 'Queued', running: 'Running', skipped: 'Last run skipped' };

  return (
    <>
      <button type="button" id="idea-automate-open" style={triggerStyle || ghost} onClick={() => { setError(''); setAsk(''); dialog.current.showModal(); }}>Automate</button>
      <dialog ref={dialog} aria-labelledby="idea-auto-title" onCancel={(e) => { if (busy) e.preventDefault(); }}
        style={{ width: 'min(620px, 100vw)', height: '100dvh', maxHeight: '100dvh', boxSizing: 'border-box', margin: '0 0 0 auto', padding: 0, border: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, padding: 24, borderBottom: '1px solid var(--line)' }}>
            <div>
              <h2 id="idea-auto-title" style={{ margin: 0 }}>Automate ideas</h2>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>When something happens to an idea, do something about it. Runs show under Automations.</p>
            </div>
            <button type="button" aria-label="Close Automate" style={ghost} onClick={() => dialog.current.close()}>Close</button>
          </header>
          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 28, alignContent: 'start', padding: 24 }}>
            {paused ? <p role="status" style={{ margin: 0, padding: '10px 12px', borderRadius: 10, background: 'var(--amber-soft)', color: 'var(--amber-ink)', fontSize: 14, fontWeight: 600 }}>Pause all automations is on, so nothing below runs until it is turned off in Automations &gt; Settings.</p> : null}
            {sandbox ? <p role="status" style={{ margin: 0, padding: '10px 12px', borderRadius: 10, background: 'var(--blue-soft)', color: 'var(--blue-ink)', fontSize: 14 }}>Sandbox mode is on: new automations start as drafts. Publish them in Automations.</p> : null}
            {error ? <p role="alert" style={{ margin: 0, padding: '10px 12px', borderRadius: 10, background: 'var(--red-soft)', color: 'var(--red-ink)', fontSize: 14, fontWeight: 600 }}>{error}</p> : null}

            <section aria-labelledby="ia-mine" style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h3 id="ia-mine" style={h3}>Your idea automations</h3>
                {mine.length ? <button type="button" onClick={() => { dialog.current.close(); openRuns(); }} style={{ ...ghost, border: 0, padding: 0, minHeight: 0, background: 'transparent', textDecoration: 'underline' }}>Run history</button> : null}
              </div>
              {mine.length === 0 ? <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>None yet. Start from a template or build one below.</p> : null}
              {mine.map((a) => {
                const x = triggerOf(a.trigger);
                const acts = actionsOf(a.actions);
                const last = lastRun(a.id);
                const on = a.enabled && !a.is_draft;
                const missing = acts.map((y) => needs(y.key)).filter(Boolean)[0];
                return (
                  <div key={a.id} style={{ ...card, flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                    <button type="button" role="switch" aria-checked={a.enabled ? 'true' : 'false'} aria-label={(a.enabled ? 'Turn off ' : 'Turn on ') + a.name}
                      disabled={busy === a.id} onClick={() => run(a.id, () => onUpdate(a, { enabled: !a.enabled }, a.enabled ? 'turned off the automation' : 'turned on the automation'))}
                      style={{ flex: 'none', width: 40, height: 24, marginTop: 2, padding: 2, border: 0, borderRadius: 999, background: a.enabled ? 'var(--green-ink, #22844C)' : 'var(--border-strong)', cursor: 'pointer', display: 'flex', justifyContent: a.enabled ? 'flex-end' : 'flex-start' }}>
                      <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}></span>
                    </button>
                    <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{a.name}{a.is_draft ? <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Draft</span> : null}</span>
                      <p style={{ ...sentence, fontSize: 14 }}>When <span style={strong}>{whenText(x.key, x.value)}</span>, {acts.map((y, n) => <span key={y.key}>{n ? ', then ' : ''}<span style={strong}>{thenText(y.key)}</span></span>)}.</p>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {on ? (last ? (RUN_LABEL[last.status] || last.status) + ' · ' + ago(last.created_at) : 'Has not run yet') : a.is_draft ? 'Draft, not running' : 'Off'}
                        {a.run_count ? ' · ' + a.run_count + (a.run_count === 1 ? ' run' : ' runs') : ''}
                      </span>
                      {missing ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber-ink)' }}>{missing} is not connected, so this fails until you connect it in Workspace Settings &gt; Integrations.</span> : null}
                    </div>
                    <div style={{ flex: 'none', display: 'flex', gap: 6 }}>
                      <button type="button" style={ghost} disabled={busy === a.id} onClick={() => run(a.id, () => onTest(a.id))}>{busy === a.id ? 'Working…' : 'Test'}</button>
                      <button type="button" style={{ ...ghost, color: 'var(--red-ink)', ...(ask === a.id ? { background: 'var(--red-soft)', borderColor: 'transparent' } : {}) }}
                        onClick={() => { if (ask !== a.id) return setAsk(a.id); setAsk(''); run(a.id, () => onDelete(a)); }}>{ask === a.id ? 'Confirm delete' : 'Delete'}</button>
                    </div>
                  </div>
                );
              })}
            </section>

            <section aria-labelledby="ia-build" style={{ display: 'grid', gap: 10 }}>
              <h3 id="ia-build" style={h3}>Build your own</h3>
              <div style={card}>
                <div style={{ ...sentence, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span>When</span>
                  <label style={{ display: 'contents' }}><span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Trigger</span>
                    <select value={t.key} onChange={(e) => setDraft((d) => ({ ...d, trig: e.target.value, value: '' }))} style={select}>
                      {triggers.map((x) => <option key={x.key} value={x.key}>{lower(x.label)}</option>)}
                    </select>
                  </label>
                  {values ? (
                    <label style={{ display: 'contents' }}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t.valueLabel || 'Value'}</span>
                      <select value={value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} style={select}>
                        {values.map((v) => <option key={v[0]} value={v[0]}>{v[1]}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <span>then</span>
                  <label style={{ display: 'contents' }}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Action</span>
                    <select value={act.key} onChange={(e) => setDraft((d) => ({ ...d, act: e.target.value }))} style={select}>
                      {fitting.map((x) => <option key={x.key} value={x.key}>{lower(x.label)}</option>)}
                    </select>
                  </label>
                </div>
                {act.message ? (
                  <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>{act.message} (optional)
                    <input type="text" value={draft.message} placeholder={'You can use {{idea.title}}, {{idea.stage}}, {{idea.score}} or {{idea.link}}'} onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))} style={field} />
                  </label>
                ) : null}
                <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>Name (optional)
                  <input type="text" value={draft.name} placeholder={triggerText(t.key, value)} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} style={field} />
                </label>
                {needs(act.key) ? <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber-ink)' }}>{needs(act.key)} is not connected yet, so this action will fail until you connect it.</span> : null}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" style={{ ...primary, opacity: busy === 'build' ? 0.6 : 1 }} disabled={busy === 'build'}
                    onClick={() => create({ name: draft.name, trig: t.key, value, act: act.key, message: draft.message }, 'build').then(() => setDraft((d) => ({ ...d, message: '', name: '' })))}>
                    {busy === 'build' ? 'Creating…' : 'Create automation'}
                  </button>
                  {has(t.key, value, act.key) ? <span style={{ fontSize: 13, color: 'var(--muted)' }}>You already have one like this.</span> : null}
                </div>
              </div>
            </section>

            <section aria-labelledby="ia-templates" style={{ display: 'grid', gap: 10 }}>
              <h3 id="ia-templates" style={h3}>Templates</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(250px, 100%), 1fr))', gap: 12 }}>
                {TEMPLATES.map((tp) => {
                  const added = has(tp.trig, tp.value, tp.act);
                  const off = needs(tp.act);
                  return (
                    <div key={tp.id} style={card}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{tp.name}</span>
                      <p style={{ ...sentence, flex: 1 }}>When <span style={strong}>{whenText(tp.trig, tp.value)}</span>, <span style={strong}>{thenText(tp.act)}</span>.</p>
                      {off ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>Needs {off} connected.</span> : null}
                      <button type="button" style={{ ...ghost, alignSelf: 'flex-start', ...(added ? { opacity: 0.55, cursor: 'default' } : {}) }} disabled={added || busy === tp.id}
                        onClick={() => create(tp, tp.id)}>{added ? 'Added' : busy === tp.id ? 'Adding…' : 'Use template'}</button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </dialog>
    </>
  );
}
