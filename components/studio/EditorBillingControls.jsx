'use client';

import { useState } from 'react';
import { priorBillingMonth, statementCsv } from '../../lib/studio/editor-reconciliation';

const dollars = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const localTime = (stamp, zone) => new Date(stamp).toLocaleString('en-US', { timeZone: zone, timeZoneName: 'short' });

const fieldDefs = [
  ['content','Covered content','content_type_key'],
  ['allowance','Included units','included_units'],
  ['retainer','Retainer (USD)','retainer_cents'],
  ['overage','Per overage unit (USD)','overage_cents'],
];
export function ContractTerms({ month, prior, types, saveTerms, saving }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(fieldDefs.map(([key,,column]) => {
    const value = prior?.[column];
    return [key,value == null ? '' : column.endsWith('_cents') ? (value / 100).toFixed(2) : String(value)];
  })));
  const typeName = key => key === '*' ? 'All project types' : types.find(type => type.key === key)?.label || key;
  return <details open>
    <summary>Missing monthly contract terms</summary>
    <form onSubmit={saveTerms}>
      <p className="fb-recon-notice">{prior ? 'Review the prior month’s terms and confirm the values for this month.' : 'No confirmed terms for ' + priorBillingMonth(month) + '. Enter the agreed terms for this month.'}</p>
      <div className="fb-recon-scroll"><table><thead><tr><th>Term</th>{prior && <th>{priorBillingMonth(month)}</th>}<th>{month}</th></tr></thead>
        <tbody>{fieldDefs.map(([key,label,column]) => {
          const raw = prior?.[column];
          const previous = raw == null ? '' : key === 'content' ? typeName(raw) : column.endsWith('_cents') ? dollars(raw) : raw;
          const changed = prior && (key === 'content' ? draft[key] !== raw : draft[key] === '' || Number(draft[key]) !== (column.endsWith('_cents') ? raw/100 : raw));
          const control = { name: key, 'aria-label': label, required: true, value: draft[key],
            onChange: event => setDraft({ ...draft, [key]: event.target.value }) };
          return <tr key={key}><th scope="row">{label}</th>{prior && <td>{previous}</td>}<td>
            {key === 'content' ? <select {...control}><option value="" disabled>Choose coverage</option><option value="*">All project types</option>{types.map(type => <option key={type.id} value={type.key}>{type.label}</option>)}</select>
              : <input {...control} type="number" min="0" max={key === 'allowance' ? '2147483647' : '21474836.47'} step={key === 'allowance' ? '1' : '0.01'} />}
            {changed && <strong className="fb-recon-changed">Changed</strong>}</td></tr>;
        })}</tbody>
      </table></div>
      <label className="fb-recon-confirm"><input type="checkbox" required />I confirm these terms for {month}. Credit the editor on the first recorded approval once per project. Review reapprovals and later reassignments individually.</label>
      <button disabled={saving}>Confirm monthly terms</button>
    </form>
  </details>;
}

export function BillingExceptions({ data, selected, editors, report, save, saving }) {
  const [all, setAll] = useState(false);
  const [selection, setSelection] = useState('');
  const [choice, setChoice] = useState('retain');
  const rows = data.entries.filter(row => row.editor_id === selected || row.statement_editor_id === selected || (selected && row.previous_editor_id === selected));
  const pending = rows.filter(row => !row.reviewed_decision_id && (row.kind !== 'first' || row.missing_terms || !row.editor_id));
  const visible = all ? rows : pending;
  const entry = visible.find(row => row.id === selection) || visible[0];
  const creditOptions = data.terms.filter(t => t.content_type_key === '*' || t.content_type_key === entry?.content_type_key);
  const decisions = data.decisions.filter(d => rows.some(row => row.project_id === d.project_id));
  const submit = event => save(event, fields => report.decideCredit({
    p_entry: entry.id, p_choice: choice, p_editor: choice === 'credit' ? fields.get('recipient') : null,
    p_reason: fields.get('reason'), p_expected_decision: entry.latest_decision_id || 0,
  }));
  return <details><summary>Billing exceptions · {pending.length} awaiting review</summary>
    <label className="fb-recon-confirm"><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} />Show all credit records for this editor</label>
    {entry ? <form onSubmit={submit}>
      <label>Job and event<select aria-label="Job and event" value={entry.id} onChange={event => { setSelection(event.target.value); setChoice('retain'); }}>
        {visible.map(row => <option key={row.id} value={row.id}>{row.job_code} · {row.project_title} · {row.kind === 'reassigned' ? 'Editor changed' : row.kind === 'repeat' ? 'Reapproval' : row.missing_terms ? 'Missing terms' : 'Approval'} · {localTime(row.approved_at,row.timezone)}</option>)}
      </select></label>
      <p>This event is marked {entry.billing_reason}. {entry.previous_editor_id ? 'Previous editor · ' + (editors.get(entry.previous_editor_id) || entry.previous_editor_id) + '. ' : ''}Recorded editor · {editors.get(entry.editor_id) || entry.editor_name || 'Unassigned'}.</p>
      <label>Decision<select aria-label="Decision" value={choice} onChange={event => setChoice(event.target.value)}>
        <option value="retain">Keep existing project credit</option><option value="credit">Credit this event to one editor</option><option value="exclude">Exclude this job from billing</option>
      </select></label>
      {choice === 'credit' && <><label>Credited editor<select aria-label="Credited editor" name="recipient" required defaultValue="">
        <option value="" disabled>Choose editor</option>{creditOptions.map(t => <option key={t.editor_id} value={t.editor_id}>{editors.get(t.editor_id) || t.editor_id}</option>)}
      </select></label><p className="fb-recon-notice">This replaces any previous credit for this job, including in another month. The selected editor needs confirmed terms covering this content type.</p></>}
      {choice === 'exclude' && <p className="fb-recon-notice">This removes the job’s credit across all editors and months. Previously saved statements keep their original figures.</p>}
      <label>Decision reason<input name="reason" required maxLength={2000} /></label>
      <button disabled={saving || (choice === 'credit' && !creditOptions.length)}>Record billing decision</button>
    </form> : <p>No pending billing exceptions for this editor.</p>}
    {!!decisions.length && <ul>{decisions.map(d => <li key={d.id}>{rows.find(r => r.project_id === d.project_id)?.job_code} · {d.choice} · {d.reason} · {d.actor_name} · {localTime(d.decided_at,report.timezone)}</li>)}</ul>}
  </details>;
}

function JobsTable({ items }) {
  if (!items.length) return <p>No recorded jobs in this version.</p>;
  return <div className="fb-recon-scroll"><table><thead><tr><th>Job</th><th>Event</th><th>Billing decision</th></tr></thead><tbody>
    {items.map(item => <tr key={item.id}><td>{item.job_code} · {item.project_title}</td><td>{item.kind} · {localTime(item.approved_at,item.timezone)}</td><td>{item.billing_reason}{item.project_decision_reason && ' · ' + item.project_decision_reason}</td></tr>)}
  </tbody></table></div>;
}

export function MonthStatements({ report, month, selected, statements, save, saving }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const latest = statements[0];
  const unchanged = !!latest && !!preview && JSON.stringify(latest.document) === JSON.stringify(preview);
  const params = { p_workspace: report.ws, p_editor: selected, p_month: month + '-01' };
  async function prepare() {
    setLoading(true); setError('');
    try {
      const result = await report.previewStatement(params);
      if (result.error || !result.data) throw new Error(result.error?.message || 'Confirm monthly terms first.');
      setPreview(result.data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return <details><summary>Month-end statements · {statements.length} saved</summary>
    <button type="button" onClick={prepare} disabled={loading || saving}>{latest ? 'Review a correction' : 'Review month-end statement'}</button>
    {error && <p role="alert">{error}</p>}
    {unchanged && <p>The live report matches saved version {latest.version}.</p>}
    {preview && !unchanged && <form onSubmit={event => save(event, fields => report.saveStatement({
      ...params, p_document: preview, p_version: latest?.version || 0, p_reason: fields.get('reason'),
    }))}>
      <h3>{latest ? 'Correction to version ' + latest.version : 'Statement preview'}</h3>
      <p>{preview.units} credited · {preview.included} included · {preview.overage} overage · {dollars(preview.total_cents)} total{latest && ' · Change ' + dollars(preview.total_cents - latest.document.total_cents)}</p>
      <p>{preview.payout ? 'Payout ' + dollars(preview.payout.amount_cents) + ' · ' + preview.payout.invoice_url : 'No linked payout or invoice'}</p>
      <JobsTable items={preview.items} />
      <label>{latest ? 'Correction reason' : 'Statement approval note'}<input name="reason" required maxLength={2000} /></label>
      <label className="fb-recon-confirm"><input type="checkbox" required />I approve saving these figures for {month}.</label>
      <button disabled={saving}>{latest ? 'Save approved correction' : 'Save approved statement'}</button>
    </form>}
    {statements.map(statement => <details key={statement.version}>
      <summary>Version {statement.version} · {dollars(statement.document.total_cents)} · {localTime(statement.saved_at,report.timezone)}</summary>
      <p>{statement.reason} · {statement.actor_name}{statement.version > 1 && ' · Change ' + dollars(statement.delta_cents)}</p>
      <p>Affected jobs · {statement.affected_jobs.join(', ') || 'Statement references only'}</p>
      <p>{statement.document.terms.included_units} included · {dollars(statement.document.terms.retainer_cents)} retainer · {dollars(statement.document.terms.overage_cents)} per overage unit</p>
      {statement.document.payout && <p>Recorded payout {dollars(statement.document.payout.amount_cents)} · <a href={statement.document.payout.invoice_url} target="_blank" rel="noreferrer">Saved invoice reference</a></p>}
      <JobsTable items={statement.document.items} />
      <button type="button" onClick={() => report.exportCsv(statementCsv(statement), 'editor-' + statement.editor_id + '-' + month + '-v' + statement.version)}>Download version {statement.version} CSV</button>
    </details>)}
  </details>;
}
