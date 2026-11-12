// Collection state is independent of email delivery. ISO calendar dates use the workspace timezone.
export function invoiceState(invoice, now = new Date(), timezone = 'America/Chicago') {
  if (invoice.status === 'paid') return 'Paid';
  if (invoice.status === 'draft') return 'Draft';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(now);
  const part = k => parts.find(p => p.type === k).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  return invoice.due_date && invoice.due_date < today ? 'Overdue' : 'Invoiced';
}
