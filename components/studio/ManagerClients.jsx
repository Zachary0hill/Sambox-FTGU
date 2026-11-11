import { useState } from 'react';

export default function ManagerClients({ D, A, canCreate, canEdit, canLink, openProject }) {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('client');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const field = { padding: 12, minHeight: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', font: 'inherit' };
  const run = async (fn) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await fn(); setName(''); setDraft(null); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <section aria-label="Clients and sponsors" style={{ padding: 24, display: 'grid', gap: 20, minWidth: 0 }}>
    <h1>Clients &amp; Sponsors</h1>
    {error && <p role="alert">{error}</p>}
    {canCreate && <form onSubmit={e => { e.preventDefault(); run(() => A.quickAddAccount(name.trim(), type)); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <input aria-label="Account name" required value={name} onChange={e => setName(e.target.value)} placeholder="Account name" style={field} />
      <select aria-label="Account type" value={type} onChange={e => setType(e.target.value)} style={field}><option value="client">Client</option><option value="sponsor">Sponsor</option></select>
      <button disabled={busy} style={field}>Add account</button>
    </form>}
    <input aria-label="Search accounts" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts…" style={field} />
    {(D.accounts || []).filter(a => a.name.toLowerCase().includes(search.toLowerCase())).map(a => {
      const channels = D.channels.filter(c => c.owner_account_id === a.id);
      const channel = channels[0];
      const projects = D.rows.filter(r => a.type === 'client' ? channels.some(c => r.channelId === c.id) : r.sponsor === a.name);
      return <section key={a.id} style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 16, display: 'grid', gap: 10 }}>
        <h2>{a.name}</h2><p>{a.type === 'client' ? 'Client' : 'Sponsor'} · {projects.length} projects</p>
        {projects.map(r => <button key={r.id} onClick={() => openProject(r.job)} style={field}>{r.title}</button>)}
        {canEdit && <button onClick={() => setDraft({ id: a.id, name: a.name, contact_name: a.contact_name || '', contact_email: a.contact_email || '' })} style={field}>Edit account details</button>}
        {draft?.id === a.id && <form onSubmit={e => { e.preventDefault(); run(() => A.saveAccountDetails(a, { ...draft, type: a.type })); }} style={{ display: 'grid', gap: 10 }}>
          {['name','contact_name','contact_email'].map(k => <label key={k}>{k.replaceAll('_',' ')}<input aria-label={k.replaceAll('_',' ')} type={k === 'contact_email' ? 'email' : 'text'} required={k === 'name'} value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })} style={{ ...field, width: '100%', boxSizing: 'border-box' }} /></label>)}
          <button disabled={busy} style={field}>Save details</button><button type="button" onClick={() => setDraft(null)} style={field}>Cancel</button>
        </form>}
        {canLink && (a.type === 'sponsor' || channel) && <select aria-label={'Assign project to ' + a.name} value="" disabled={busy} onChange={e => { const r = D.rows.find(p => p.id === e.target.value); if (r) run(() => a.type === 'client' ? A.setField(r,'channel',channel.name) : A.linkSponsor(a,r)); }} style={field}>
          <option value="">Assign a project…</option>{D.rows.filter(r => !r.archived && !projects.some(p => p.id === r.id)).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>}
      </section>;
    })}
  </section>;
}
