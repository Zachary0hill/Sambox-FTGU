'use client';

import { useEffect, useState } from 'react';
import { ContractTerms, BillingExceptions, MonthStatements } from './EditorBillingControls';
import { billingMonth, editorStatement } from '../../lib/studio/editor-reconciliation';

const dollars = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const dateTime = (stamp, zone) => new Date(stamp).toLocaleString('en-US', { timeZone: zone, timeZoneName: 'short' });

function MonthlyReport({ report, month, editor, setEditor }) {
  const { ws, readMonth, timezone, startedAt, types, directory, payouts, currentJobs } = report;
  const [data, setData] = useState(null);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    readMonth(ws, month).then(value => {
      if (active) { setData(value); setLoadError(''); }
    }).catch(error => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, [ws, month, revision, readMonth]);
  const refresh = () => { setData(null); setLoadError(''); setRevision(current => current + 1); };
  if (loadError) return <p role="alert">Could not load reconciliation. {loadError} <button onClick={refresh}>Retry</button></p>;
  if (!data) return <p role="status">Loading monthly approvals…</p>;

  const editors = new Map(directory.map(person => [person.id, person.name]));
  for (const entry of data.entries) {
    if (entry.editor_id && !editors.has(entry.editor_id)) editors.set(entry.editor_id, entry.editor_name || 'Former editor · ' + entry.editor_id);
  }
  for (const term of data.terms) if (!editors.has(term.editor_id)) editors.set(term.editor_id, 'Former editor · ' + term.editor_id);
  const unassigned = data.entries.some(e => !e.editor_id);
  const selected = editor === 'unassigned' ? null : editors.has(editor) ? editor : editors.keys().next().value || null;
  const terms = data.terms.find(term => term.editor_id === selected);
  const link = data.links.find(item => item.editor_id === selected);
  const availablePayouts = payouts.filter(item => item.user_id === selected && item.role === 'editor');
  const linkedPayout = availablePayouts.find(item => item.id === link?.payout_id);
  const { lines, amounts } = editorStatement(data.entries, selected, terms);
  const partial = !startedAt || month <= billingMonth(startedAt, timezone);
  const identity = { workspace_id: ws, editor_id: selected, billing_month: month + '-01' };

  async function save(event, operation) {
    event.preventDefault();
    if (saving) return;
    const fields = new FormData(event.currentTarget);
    setSaving(true);
    setSaveError('');
    try {
      const result = await operation(fields);
      if (result.error) throw new Error(result.error.message);
      refresh();
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  }
  const saveTerms = event => save(event, fields => report.saveTerms({
    ...identity, content_type_key: fields.get('content'), included_units: Number(fields.get('allowance')),
    retainer_cents: Math.round(Number(fields.get('retainer')) * 100), overage_cents: Math.round(Number(fields.get('overage')) * 100),
  }));
  const saveLink = event => save(event, fields => report.saveLink({
    ...identity, payout_id: fields.get('payout'), invoice_url: String(fields.get('invoice')).trim(),
  }));

  return <div className="fb-recon-body">
    <label>Editor
      <select aria-label="Editor" value={selected || 'unassigned'} disabled={saving} onChange={event => { setEditor(event.target.value); setSaveError(''); }}>
        {Array.from(editors, ([id, name]) => <option key={id} value={id}>{name}</option>)}
        {(unassigned || !editors.size) && <option value="unassigned">Unassigned approvals</option>}
      </select>
    </label>
    <button type="button" disabled={saving} onClick={refresh}>Refresh approvals</button>
    {unassigned && selected && <p className="fb-recon-notice">This month includes approvals without a credited editor. Select Unassigned approvals to review them.</p>}
    {partial && <p className="fb-recon-notice">Approval tracking {startedAt ? 'started ' + dateTime(startedAt, timezone) : 'has an unconfirmed start date'}. Reconcile earlier work manually before accepting this month’s total.</p>}
    {selected && !terms && <ContractTerms key={selected + ':terms'} month={month} prior={data.previousTerms.find(term => term.editor_id === selected)} types={types} saveTerms={saveTerms} saving={saving} />}
    <BillingExceptions key={selected || 'unassigned'} data={data} selected={selected} editors={editors} report={report} save={save} saving={saving} />
    {amounts && <>
      <p>Confirmed contract for {terms.content_type_key === '*' ? 'all project types' : types.find(type => type.key === terms.content_type_key)?.label || terms.content_type_key}, {terms.included_units} included at {dollars(terms.retainer_cents)} per month and {dollars(terms.overage_cents)} per additional unit.</p>
      <dl>{[['Counted videos',amounts.units],['Included units used',amounts.included],['Overage units',amounts.overage],['Retainer',dollars(terms.retainer_cents)],['Overage amount',dollars(amounts.overageAmount)],[partial ? 'Tracked subtotal' : 'Total owed',dollars(amounts.total)]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </>}
    <h3>Approval history</h3>
    {lines.length ? <div className="fb-recon-scroll"><table><thead><tr><th>Video</th><th>Approved</th><th>Content type</th><th>Billing decision</th></tr></thead><tbody>
      {lines.map(line => <tr key={line.id}><td>{currentJobs[line.project_id] ? <a href={'/projects?project=' + encodeURIComponent(currentJobs[line.project_id])}>{line.project_title}</a> : line.project_title} · {line.job_code}</td>
        <td>{dateTime(line.approved_at, line.timezone)}</td><td>{types.find(type => type.key === line.content_type_key)?.label || line.content_type_key || 'Unspecified'}</td><td>{line.reason}</td></tr>)}
    </tbody></table></div> : <p>No tracked approvals for this editor and month.</p>}
    {terms && <details key={selected + ':link'} open={!!link}><summary>Payout and Payoneer invoice</summary>
      {linkedPayout && <p>Recorded payout {dollars(linkedPayout.amount_cents)} · Difference from report {dollars(linkedPayout.amount_cents - amounts.total)} · <a href={link.invoice_url} target="_blank" rel="noreferrer">Open invoice</a></p>}
      {availablePayouts.length ? <form onSubmit={saveLink}>
        <div className="fb-recon-group">
          <label>Existing payout<select aria-label="Existing payout" required name="payout" defaultValue={link?.payout_id || ''}><option value="">Choose payout</option>{availablePayouts.map(p => <option key={p.id} value={p.id}>{p.description || p.pay_date || p.id} · {dollars(p.amount_cents)}</option>)}</select></label>
          <label>Payoneer invoice URL<input type="url" pattern="https://.+" required name="invoice" defaultValue={link?.invoice_url || ''} /></label>
        </div><button disabled={saving}>Save invoice and payout link</button>
      </form> : <p>Add an editor payout in Contractor payouts to link this report.</p>}
    </details>}
    {terms && <MonthStatements key={selected + ':statements'} report={report} month={month} selected={selected} statements={data.statements.filter(item => item.editor_id === selected)} save={save} saving={saving} />}
    {saveError && <p role="alert" className="fb-recon-error">{saveError}</p>}
  </div>;
}

export default function EditorReconciliation({ report }) {
  const [month, setMonth] = useState(() => billingMonth(Date.now(), report.timezone));
  const [editor, setEditor] = useState(report.initialEditor || report.directory[0]?.id || '');
  return <section className="fb-recon-panel" aria-label="Editor payment reconciliation">
    <div className="fb-recon-group"><h2>Editor payment reconciliation</h2>
      <label>Approval month<input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>
    </div>
    {/^\d{4}-\d{2}$/.test(month) && <MonthlyReport key={report.ws + ':' + month + ':' + report.initialEditor} report={report} month={month} editor={editor} setEditor={setEditor} />}
  </section>;
}
