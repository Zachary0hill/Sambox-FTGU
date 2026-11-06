import { useRef, useState } from 'react';
import { IDEA_TEMPLATE, IMPORT_LIMIT, parseIdeaDocument, validateImportIdea } from '../../lib/ideas/import-document';

const field = { width: '100%', boxSizing: 'border-box', padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--ink)', font: 'inherit' };
const button = { ...field, width: 'auto', minHeight: 44, cursor: 'pointer' };
const stack = { display: 'grid', gap: 12 };

export default function IdeaImport({ brands, onImport, onComplete }) {
  const dialog = useRef(null);
  const running = useRef(false);
  const readVersion = useRef(0);
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [rows, setRows] = useState(null);
  const [defaultBrand, setDefaultBrand] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState(null);

  const update = (index, patch) => setRows(old => old.map((row, i) => i === index ? { ...row, ...patch } : row));
  const selected = (rows || []).filter(r => r.selected);
  const invalid = selected.some(r => {
    try { validateImportIdea(r); return !brands.some(b => b.id === r.brandId); } catch { return true; }
  });
  const close = () => {
    if (running.current) return;
    if (!result && (rows || text) && !window.confirm(attempted ? 'The last import could not be confirmed. You can retry this same document safely later. Close this preview?' : 'Close and discard this import preview?')) return;
    readVersion.current++;
    dialog.current.close();
    setText(''); setFilename(''); setRows(null); setError(''); setResult(null); setAttempted(false); setReading(false); setDefaultBrand('');
  };
  const read = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const version = ++readVersion.current;
    setError(''); setReading(true);
    try {
      if (!/\.(md|markdown|txt|json)$/i.test(file.name)) throw new Error('Choose a Markdown (.md), text (.txt), or JSON file.');
      if (file.size > IMPORT_LIMIT * 4) throw new Error('Choose a file smaller than 1 MB.');
      const content = await file.text();
      if (content.length > IMPORT_LIMIT) throw new Error('Choose a document of up to 250,000 characters.');
      if (version === readVersion.current) { setText(content); setFilename(file.name); setRows(null); }
    } catch (err) { if (version === readVersion.current) setError(err.message); }
    finally { if (version === readVersion.current) setReading(false); }
  };
  const preview = () => {
    try {
      const parsed = parseIdeaDocument(text, brands, filename);
      setRows(parsed.ideas.map(idea => ({ ...idea, selected: true })));
      setError('');
    } catch (err) { setError(err.message); }
  };
  const save = async () => {
    if (running.current || !selected.length || invalid) return;
    running.current = true; setBusy(true); setAttempted(true); setError('');
    try {
      const outcome = await onImport(selected);
      setResult(outcome);
      onComplete?.(outcome);
    } catch (err) {
      setError('Import could not be confirmed. Retry this batch; identical ideas will not be duplicated. ' + (err.message || 'Check your connection.'));
    } finally { running.current = false; setBusy(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([IDEA_TEMPLATE], { type: 'text/markdown' }));
    const link = document.createElement('a'); link.href = url; link.download = 'idea-import-template.md'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    <button type="button" style={button} onClick={() => dialog.current.showModal()}>Import ideas</button>
    <dialog ref={dialog} aria-labelledby="idea-import-title" onCancel={event => { event.preventDefault(); close(); }} style={{ width: 'min(880px, calc(100vw - 32px))', maxHeight: '90dvh', boxSizing: 'border-box', padding: 24, border: '1px solid var(--border)', borderRadius: 20, background: 'var(--surface)', color: 'var(--ink)' }}>
      <div style={stack}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
          <div><h2 id="idea-import-title" style={{ margin: 0 }}>Import ideas</h2><p>Upload or paste a shoot list. Review each idea and its client before adding drafts to the board.</p></div>
          <button type="button" aria-label="Close idea import" style={button} disabled={busy} onClick={close}>Close</button>
        </header>
        {error && <p role="alert" style={{ color: 'var(--red-ink)' }}>{error}</p>}
        {result ? <div role="status" style={stack}>
          <h3>{result.created} {result.created === 1 ? 'idea' : 'ideas'} imported</h3>
          <p>{result.skipped ? `${result.skipped} identical ideas were skipped. ` : ''}New ideas are saved as drafts. Open an idea and use “Approve & create project” when it is ready for production.</p>
          <button type="button" style={button} onClick={close}>Done</button>
        </div> : <>
          {!rows ? <>
            <label style={stack}>Upload document<input type="file" accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json" onChange={read} disabled={reading} /></label>
            {filename && <p>{filename}</p>}
            <label style={stack}>Or paste your document<textarea value={text} onChange={event => { setText(event.target.value); setFilename(''); setError(''); }} rows={10} maxLength={IMPORT_LIMIT} disabled={reading} style={field} /></label>
            <p>Use a “## Idea title” heading for each idea and “Client: POD HUT” to match a brand. Descriptions, scripts and reference links are preserved. Up to 100 ideas per import.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={download} style={button}>Download Markdown template</button>
              <button type="button" onClick={preview} disabled={reading || !text.trim()} style={button}>{reading ? 'Reading document…' : 'Preview ideas'}</button>
            </div>
          </> : <>
            <p>{rows.length} ideas found · {selected.length} selected. Review suggested clients; unknown or ambiguous names need a selection. Identical imports are skipped.</p>
            <fieldset disabled={busy || attempted} style={{ border: 0, padding: 0, minWidth: 0, ...stack }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
                <label style={{ flex: '1 1 220px', ...stack }}>Client for unassigned ideas<select style={field} value={defaultBrand} onChange={e => setDefaultBrand(e.target.value)}><option value="">Choose client</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                <button type="button" style={button} disabled={!defaultBrand} onClick={() => setRows(old => old.map(r => r.selected && !r.brandId ? { ...r, brandId: defaultBrand, brandWarning: '' } : r))}>Apply to unassigned</button>
                <button type="button" style={button} onClick={() => setRows(old => old.map(r => ({ ...r, selected: selected.length !== rows.length })))}>{selected.length === rows.length ? 'Deselect all' : 'Select all'}</button>
              </div>
              {rows.map((row, i) => <article key={i} aria-label={`Idea ${i + 1}`} style={{ ...stack, border: '1px solid var(--border)', padding: 16, borderRadius: 12 }}>
                <label><input type="checkbox" checked={row.selected} onChange={e => update(i, { selected: e.target.checked })} /> Import idea {i + 1}</label>
                <label>Title<input aria-label={`Title ${i + 1}`} style={field} value={row.title} maxLength={300} onChange={e => update(i, { title: e.target.value })} /></label>
                <label>Brand / client<select aria-label={`Client ${i + 1}`} style={field} value={row.brandId} onChange={e => update(i, { brandId: e.target.value, brandWarning: '' })}><option value="">Choose client</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                {row.brandWarning && <p style={{ margin: 0 }}>{row.brandWarning}</p>}
                <details><summary>Review content and references ({row.refs.length})</summary><div style={{ ...stack, marginTop: 12 }}>
                  <label>Content<textarea aria-label={`Content ${i + 1}`} rows={8} maxLength={30000} style={field} value={row.body} onChange={e => update(i, { body: e.target.value })} /></label>
                  <label>References (one URL per line)<textarea aria-label={`References ${i + 1}`} rows={3} style={field} value={row.refs.join('\n')} onChange={e => update(i, { refs: e.target.value.split('\n') })} /></label>
                  {row.hook && <p>Hook: {row.hook}</p>}
                  {row.titleOptions.length > 0 && <p>Title options: {row.titleOptions.join(' · ')}</p>}
                  {row.thumbnailBrief && <p>Thumbnail direction: {row.thumbnailBrief}</p>}
                </div></details>
              </article>)}
            </fieldset>
            {invalid && <p role="status">Every selected idea needs a title, an available client, and valid reference links.</p>}
            <footer style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {!attempted && <button type="button" style={button} onClick={() => { setRows(null); setError(''); }}>Back to document</button>}
              <button type="button" style={{ ...button, background: 'var(--inv)', color: 'var(--inv-ink)' }} disabled={busy || invalid || !selected.length} onClick={save}>{busy ? 'Importing…' : attempted ? 'Retry import' : `Import ${selected.length} drafts`}</button>
            </footer>
          </>}
        </>}
      </div>
    </dialog>
  </>;
}
