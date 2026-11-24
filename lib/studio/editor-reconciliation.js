export function billingMonth(instant, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(instant));
  return parts.find(x => x.type === 'year').value + '-' + parts.find(x => x.type === 'month').value;
}

export function editorStatement(entries, editorId, terms) {
  const lines = entries.filter(entry => ('statement_editor_id' in entry ? entry.statement_editor_id : entry.editor_id) === editorId).map(entry => {
    if (entry.billing_reason) return { ...entry, reason: entry.billing_reason };
    let reason = 'Counted';
    if (entry.kind === 'repeat') reason = 'Reapproval · review only';
    else if (!editorId) reason = 'Missing editor';
    else if (!terms) reason = 'Awaiting contract terms';
    else if (terms.content_type_key !== '*' && terms.content_type_key !== entry.content_type_key) reason = 'Outside contract';
    return { ...entry, reason };
  });
  if (!terms || !editorId) return { lines, amounts: null };
  const units = lines.filter(line => line.reason === 'Counted').length;
  const included = Math.min(units, terms.included_units);
  const overage = units - included;
  const overageAmount = overage * terms.overage_cents;
  return { lines, amounts: { units, included, overage, overageAmount, total: terms.retainer_cents + overageAmount } };
}

export function priorBillingMonth(month) {
  const [year, number] = month.split('-').map(Number);
  return number === 1 ? (year - 1) + '-12' : year + '-' + String(number - 1).padStart(2, '0');
}

export function statementCsv(statement) {
  const { document: doc } = statement;
  const { terms, payout } = doc;
  const rows = [
    ['Billing month', statement.billing_month], ['Editor ID', statement.editor_id], ['Version', statement.version],
    ['Saved at', statement.saved_at], ['Approved by', statement.actor_name], ['Reason', statement.reason],
    ['Affected jobs', statement.affected_jobs.join(', ')], ['Version delta (USD cents)', statement.delta_cents],
    ['Covered type', terms.content_type_key], ['Allowance', terms.included_units], ['Retainer (USD cents)', terms.retainer_cents],
    ['Unit rate (USD cents)', terms.overage_cents], ['Credited units', doc.units], ['Included units', doc.included],
    ['Overage units', doc.overage], ['Overage total (USD cents)', doc.overage_cents], ['Total (USD cents)', doc.total_cents],
    ['Payout ID', payout?.id], ['Payout amount (USD cents)', payout?.amount_cents], ['Payout status', payout?.status],
    ['Payout description', payout?.description], ['Pay date', payout?.pay_date], ['Invoice', payout?.invoice_url], [],
    ['Job', 'Project ID', 'Title', 'Event', 'Recorded at', 'Event timezone', 'Captured editor ID', 'Statement editor ID', 'Billing decision', 'Decision reason'],
    ...doc.items.map(item => [item.job_code,item.project_id,item.project_title,item.kind,item.approved_at,item.timezone,item.editor_id,item.statement_editor_id,item.billing_reason,item.project_decision_reason]),
  ];
  // Project titles and operator notes may be interpreted as formulas when a CSV opens in a spreadsheet.
  return rows.map(row => row.map(value => typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? "'" + value : value));
}
