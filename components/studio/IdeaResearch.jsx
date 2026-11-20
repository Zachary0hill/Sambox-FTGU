import { useState } from 'react';

const section = { display: 'grid', gap: 8 };
const heading = { margin: 0, fontSize: 14, fontWeight: 700 };
const muted = { margin: 0, fontSize: 13, color: 'var(--muted)' };
const list = { margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 14 };
const button = { minHeight: 38, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontWeight: 600, cursor: 'pointer' };
const cell = { padding: '8px 8px 8px 0', fontSize: 13, verticalAlign: 'top', borderTop: '1px solid var(--line)' };
const th = { ...cell, borderTop: 0, color: 'var(--muted)', textAlign: 'left', fontWeight: 600 };

// The status bar heading for each run state (handoff/ideas-research-handoff-2026-11-19 § IdeaDetailDialog, Research).
const HEAD = { running: 'Research is running', queued: 'Research is queued', complete: 'Research run complete', failed: 'The last research run failed', none: 'No research run yet' };
const statBox = { display: 'grid', gap: 4, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' };
const statLabel = { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' };

// The Research tab: run status, then what the last run found.
export default function IdeaResearch({ status, error, active, canRun, runLabel, retryLabel, onRun, onCancel, result, state, views, sourceCount }) {
  const st = state || (active ? 'running' : result ? 'complete' : 'none');
  const failed = st === 'failed';
  return <div role="tabpanel" id="idp-research" aria-labelledby="idt-research" style={{ display: 'grid', gap: 20 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid ' + (failed ? 'color-mix(in srgb, var(--red-ink) 30%, transparent)' : 'var(--border)'), background: failed ? 'var(--red-soft)' : 'var(--surface)' }}>
      <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: failed ? 'var(--red-ink)' : 'var(--ink)' }}>{HEAD[st] || HEAD.none}</p>
        <p role="status" style={muted}>{status}</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {active && canRun ? <button type="button" style={button} onClick={onCancel}>Cancel</button> : null}
        {!active && canRun ? <button type="button" style={button} onClick={onRun}>{retryLabel || runLabel}</button> : null}
      </div>
    </div>
    {error ? <p role="alert" style={{ margin: 0, fontSize: 14, color: 'var(--red-ink)' }}>{error}</p> : null}
    {views !== undefined ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
      <div style={statBox}><p style={statLabel}>Short-form views</p><p style={{ margin: 0, fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{views}</p></div>
      <div style={statBox}><p style={statLabel}>Sources attached</p><p style={{ margin: 0, fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{sourceCount}</p></div>
    </div> : null}
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
