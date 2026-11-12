'use client';
import { useRef, useState } from 'react';
import { CONVERT_TARGETS, COVER_HIGHLIGHTS, DEFAULT_IDEAS_RULES, GATED_STAGES, HOOK_POSITIONS, REQUIRED_FIELDS } from '../../lib/ideas/rules-shared';

const field = { width: '100%', boxSizing: 'border-box', padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--ink)', font: 'inherit' };
const button = { ...field, width: 'auto', minHeight: 44, padding: '0 14px', cursor: 'pointer' };
const primary = { ...button, background: 'var(--inv)', color: 'var(--inv-ink)', border: 0 };
const group = { margin: 0, padding: 0, border: 0, display: 'grid', gap: 12 };
const legend = { padding: 0, fontSize: 15, fontWeight: 700 };
const label = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 };
const help = { margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--muted)' };
const LISTS = [['allowed_types', 'Idea types'], ['formats', 'Formats'], ['platforms', 'Platforms'], ['pillars', 'Pillars']];
const POSITION_LABEL = { bottom: 'Bottom', center: 'Center', top: 'Top' };
const STAGE_LABEL = { research: 'Research', ready: 'Ready' };
const check = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 32, fontSize: 14 };

const toForm = (r) => ({
  ...Object.fromEntries(LISTS.map(([k]) => [k, r[k].join('\n')])),
  pursue: String(r.recommendation.pursue), park: String(r.recommendation.park),
  highlight: r.cover.highlight, hook_position: r.cover.hook_position,
  required_fields_by_stage: r.required_fields_by_stage, conversion_targets: r.conversion_targets,
  scoring: r.scoring.map((c) => c.label + ': ' + c.weight).join('\n'), research_brief: r.research_brief, max_sources: String(r.max_sources),
  auto_research: r.auto_research, designers_can_research: r.designers_can_research, run_cost_cap_usd: String(r.run_cost_cap_usd), daily_cost_cap_usd: String(r.daily_cost_cap_usd),
});
const toRules = (f) => ({
  ...Object.fromEntries(LISTS.map(([k]) => [k, f[k].split('\n')])),
  recommendation: { pursue: Number(f.pursue), park: Number(f.park) },
  cover: { highlight: f.highlight, hook_position: f.hook_position },
  required_fields_by_stage: f.required_fields_by_stage, conversion_targets: f.conversion_targets,
  scoring: f.scoring.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const at = line.lastIndexOf(':');
    return at < 0 ? { label: line, weight: NaN } : { label: line.slice(0, at), weight: Number(line.slice(at + 1)) };
  }),
  research_brief: f.research_brief, max_sources: Number(f.max_sources),
  auto_research: f.auto_research, designers_can_research: f.designers_can_research,
  run_cost_cap_usd: Number(f.run_cost_cap_usd), daily_cost_cap_usd: Number(f.daily_cost_cap_usd),
});

export default function IdeaRules({ rules, onSave, triggerStyle }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(() => toForm(rules));
  const [base, setBase] = useState(form);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));
  // Keeps the order of `all`, so ticking and unticking a box returns the form to clean.
  const toggled = (list, all, key) => all.filter((k) => (k === key ? !list.includes(k) : list.includes(k)));
  const toggleGate = (stage, key) => setForm((f) => ({ ...f, required_fields_by_stage: { ...f.required_fields_by_stage, [stage]: toggled(f.required_fields_by_stage[stage], REQUIRED_FIELDS.map((x) => x.key), key) } }));
  const flip = (key) => () => setForm((f) => ({ ...f, [key]: !f[key] }));
  const toggleTarget = (key) => setForm((f) => ({ ...f, conversion_targets: toggled(f.conversion_targets, CONVERT_TARGETS.map((x) => x.key), key) }));

  const open = () => {
    const current = toForm(rules);
    setForm(current); setBase(current); setError('');
    dialog.current.showModal();
  };
  const close = () => { if (!busy) dialog.current.close(); };
  const save = async () => {
    setBusy(true); setError('');
    try {
      await onSave(toRules(form));
      setBase(form);
      dialog.current.close();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return <>
    <button type="button" id="idea-rules-open" style={triggerStyle || button} onClick={open}>Rules</button>
    <dialog ref={dialog} aria-labelledby="idea-rules-title" onCancel={(event) => { event.preventDefault(); close(); }}
      style={{ width: 'min(520px, 100vw)', height: '100dvh', maxHeight: '100dvh', boxSizing: 'border-box', margin: '0 0 0 auto', padding: 0, border: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, padding: 24, borderBottom: '1px solid var(--line)' }}>
          <div>
            <h2 id="idea-rules-title" style={{ margin: 0 }}>Rules</h2>
            <p style={{ ...help, marginTop: 4, fontSize: 14 }}>These apply to every brand in this workspace.</p>
          </div>
          <button type="button" aria-label="Close Rules" style={button} disabled={busy} onClick={close}>Close</button>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 28, alignContent: 'start', padding: 24 }}>
          <fieldset style={group}>
            <legend style={legend}>Lists</legend>
            <p style={help}>One per line. Removing an entry leaves existing ideas as they are.</p>
            {LISTS.map(([key, name]) => <label key={key} style={label}>{name}
              <textarea rows={Math.min(6, form[key].split('\n').length + 1)} value={form[key]} onChange={set(key)} style={field} />
            </label>)}
          </fieldset>
          {GATED_STAGES.map((stage) => <fieldset key={stage} style={group}>
            <legend style={legend}>To enter {STAGE_LABEL[stage]}</legend>
            {stage === 'ready' && <p style={help}>Also checked when an idea is approved.</p>}
            <div>{REQUIRED_FIELDS.map((f) => <label key={f.key} style={check}>
              <input type="checkbox" checked={form.required_fields_by_stage[stage].includes(f.key)} onChange={() => toggleGate(stage, f.key)} />{f.label}
            </label>)}</div>
          </fieldset>)}
          <fieldset style={group}>
            <legend style={legend}>Approve can create</legend>
            <div>{CONVERT_TARGETS.map((t) => <label key={t.key} style={check}>
              <input type="checkbox" checked={form.conversion_targets.includes(t.key)} onChange={() => toggleTarget(t.key)} />{t.label}
            </label>)}</div>
          </fieldset>
          <fieldset style={group}>
            <legend style={legend}>Score thresholds</legend>
            <p style={help}>On a scale of 0 to 100.</p>
            <label style={label}>Pursue at
              <input type="number" min="0" max="100" step="1" value={form.pursue} onChange={set('pursue')} style={field} />
              <span style={help}>This score and above reads as Pursue and appears in Top scored.</span>
            </label>
            <label style={label}>Park at
              <input type="number" min="0" max="100" step="1" value={form.park} onChange={set('park')} style={field} />
              <span style={help}>This score and above reads as Park. Anything lower reads as Drop.</span>
            </label>
          </fieldset>
          <fieldset style={group}>
            <legend style={legend}>Scoring</legend>
            <p style={help}>One per line, as a name and a weight from 0 to 5. Changes apply to the next run.</p>
            <label style={label}>Criteria
              <textarea rows={6} value={form.scoring} onChange={set('scoring')} style={field} />
            </label>
          </fieldset>
          <fieldset style={group}>
            <legend style={legend}>Research</legend>
            <label style={label}>Research brief
              <textarea rows={7} value={form.research_brief} onChange={set('research_brief')} style={field} />
              <span style={help}>The first line is the web search. You can use {'{title}'}, {'{type}'}, {'{brand}'} and {'{notes}'}.</span>
            </label>
            <label style={label}>Max sources per run
              <input type="number" min="1" max="10" step="1" value={form.max_sources} onChange={set('max_sources')} style={field} />
            </label>
            <label style={label}>Limit per run (USD)
              <input type="number" min="0.01" step="0.01" value={form.run_cost_cap_usd} onChange={set('run_cost_cap_usd')} style={field} />
            </label>
            <label style={label}>Daily limit (USD)
              <input type="number" min="0.01" step="0.01" value={form.daily_cost_cap_usd} onChange={set('daily_cost_cap_usd')} style={field} />
              <span style={help}>Conservative estimates are reserved before each source, model fallback and cover. Unknown prices must be set in AI usage. Unconfirmed calls remain counted. Daily budget resets at midnight UTC; provider billing may differ.</span>
            </label>
            <div>
              <label style={check}><input type="checkbox" checked={form.auto_research} onChange={flip('auto_research')} />Research new ideas automatically</label>
              <label style={check}><input type="checkbox" checked={form.designers_can_research} onChange={flip('designers_can_research')} />Let designers run research on their own ideas</label>
            </div>
          </fieldset>
          <fieldset style={group}>
            <legend style={legend}>New idea covers</legend>
            <label style={label}>Highlight color
              <select value={form.highlight} onChange={set('highlight')} style={field}>
                {COVER_HIGHLIGHTS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
              </select>
            </label>
            <label style={label}>Hook position
              <select value={form.hook_position} onChange={set('hook_position')} style={field}>
                {HOOK_POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABEL[p]}</option>)}
              </select>
            </label>
          </fieldset>
        </div>
        <footer style={{ display: 'grid', gap: 12, padding: 24, borderTop: '1px solid var(--line)' }}>
          {error && <p role="alert" style={{ margin: 0, color: 'var(--red-ink)' }}>{error}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button type="button" style={button} disabled={busy} onClick={() => setForm(toForm(DEFAULT_IDEAS_RULES))}>Reset to defaults</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {dirty && <span role="status" style={help}>Unsaved changes</span>}
              <button type="button" style={primary} disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        </footer>
      </div>
    </dialog>
  </>;
}
