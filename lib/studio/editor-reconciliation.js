export function billingMonth(instant, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(instant));
  return parts.find(x => x.type === 'year').value + '-' + parts.find(x => x.type === 'month').value;
}

export function editorStatement(entries, editorId, terms) {
  const lines = entries.filter(entry => entry.editor_id === editorId).map(entry => {
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
