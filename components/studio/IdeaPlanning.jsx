export default function IdeaPlanning({ value, onChange, brands, brand, onBrand, imported, onImportText, onImport }) {
  const field = { width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', color: 'var(--ink)', font: 'inherit' };
  return <section aria-label="Production planning" style={{ display: 'grid', gap: 12 }}>
    {brands && <label>Brand / client<select aria-label="Brand / client" value={brand || ''} onChange={e => onBrand(e.target.value)} style={field}><option value="" disabled>Choose a brand</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
    {onImport && <details><summary>Import a brief from Claude or Grok</summary><p>Paste text or one JSON idea. Review the fields and choose the brand before saving.</p><textarea aria-label="Brief to import" value={imported || ''} onChange={e => onImportText(e.target.value)} maxLength={30000} rows={5} style={field} /><button type="button" onClick={onImport} style={{ ...field, width: 'auto', minHeight: 44 }}>Preview imported brief</button></details>}
    <label>Title options <span style={{ color: 'var(--muted)' }}>(one per line, up to 12)</span><textarea aria-label="Title options" rows={3} value={value.titleOptions || ''} onChange={e => onChange({ titleOptions: e.target.value })} style={field} /></label>
    <label>Thumbnail direction<textarea aria-label="Thumbnail direction" placeholder="Concepts, visual references, text treatments and the preferred direction" rows={4} maxLength={12000} value={value.thumbnailBrief || ''} onChange={e => onChange({ thumbnailBrief: e.target.value })} style={field} /></label>
    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Approval creates a project with this brief and a copy of the cover as a thumbnail concept. The main title remains the working title.</p>
  </section>;
}
