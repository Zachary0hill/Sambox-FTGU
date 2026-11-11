import { useState } from 'react';

const section = { display: 'grid', gap: 8 };
const heading = { margin: 0, fontSize: 14, fontWeight: 700 };
const muted = { margin: 0, fontSize: 13, color: 'var(--muted)' };
const list = { margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 14 };
const button = { minHeight: 38, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontWeight: 600, cursor: 'pointer' };
const cell = { padding: '8px 8px 8px 0', fontSize: 13, verticalAlign: 'top', borderTop: '1px solid var(--line)' };
const th = { ...cell, borderTop: 0, color: 'var(--muted)', textAlign: 'left', fontWeight: 600 };

// The Research tab: run status, then what the last run found.
export default function IdeaResearch({ status, error, active, canRun, runLabel, onRun, onCancel, result }) {
  return <div role="tabpanel" id="idp-research" aria-labelledby="idt-research" style={{ display: 'grid', gap: 20 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <p role="status" style={muted}>{status}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {active && canRun ? <button type="button" style={button} onClick={onCancel}>Cancel</button> : null}
        {!active && canRun ? <button type="button" style={button} onClick={onRun}>{runLabel}</button> : null}
      </div>
    </div>
    {error ? <p role="alert" style={{ margin: 0, fontSize: 14, color: 'var(--red-ink)' }}>{error}</p> : null}
    {!result ? (active ? null : <p style={muted}>Run research to check this idea against the web and score it.</p>) : <>
      <div style={section}><h3 style={heading}>Summary</h3><p style={{ margin: 0, fontSize: 14 }}>{result.summary}</p></div>
      {result.recommendation ? <div style={section}><h3 style={heading}>Recommendation: {result.recommendation}</h3><p style={muted}>{result.why}</p></div> : null}
      {result.findings.length ? <div style={section}><h3 style={heading}>Findings</h3><ul style={list}>{result.findings.map((f, n) => <li key={n}>{f}</li>)}</ul></div> : null}
      {result.rows.length ? <div style={section}>
        <h3 style={heading}>Score breakdown</h3>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th style={th}>Criterion</th><th style={th}>Score</th><th style={th}>Weight</th><th style={th}>Reason</th></tr></thead>
          <tbody>{result.rows.map((r) => <tr key={r.key}><td style={cell}>{r.label}</td><td style={cell}>{r.score}</td><td style={cell}>{r.weight}</td><td style={cell}>{r.reason}</td></tr>)}</tbody>
        </table>
      </div> : null}
      {result.nextSteps.length ? <div style={section}><h3 style={heading}>Next steps</h3><ul style={list}>{result.nextSteps.map((s, n) => <li key={n}>{s}</li>)}</ul></div> : null}
      {result.sources.length ? <div style={section}>
        <h3 style={heading}>Sources</h3>
        <ul style={{ ...list, listStyle: 'none', paddingLeft: 0 }}>{result.sources.map((s) => <li key={s.url}>
          <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)', fontWeight: 600 }}>{s.title}</a>
          <span style={{ ...muted, marginLeft: 8 }}>{s.domain}</span>
          {s.snippet ? <p style={muted}>{s.snippet}</p> : null}
        </li>)}</ul>
      </div> : null}
    </>}
  </div>;
}

// Score sliders in the side rail. A change saves when the slider is released, so dragging writes once.
export function ScoreSliders({ rows, canEdit, onCommit }) {
  const [drafts, setDrafts] = useState({});
  const commit = (key) => {
    if (drafts[key] === undefined) return;
    onCommit(key, Number(drafts[key]));
    setDrafts((d) => { const next = { ...d }; delete next[key]; return next; });
  };
  return <div style={{ display: 'grid', gap: 6 }}>
    {rows.map((r) => {
      const value = drafts[r.key] ?? r.score;
      return <label key={r.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px 28px', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ color: 'var(--ink-3)' }}>{r.label}</span>
        <input type="range" min="0" max="10" step="1" value={value} disabled={!canEdit} aria-label={r.label + ' score'}
          onChange={(e) => setDrafts((d) => ({ ...d, [r.key]: e.target.value }))} onPointerUp={() => commit(r.key)} onKeyUp={() => commit(r.key)} onBlur={() => commit(r.key)} />
        <span style={{ fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </label>;
    })}
  </div>;
}
