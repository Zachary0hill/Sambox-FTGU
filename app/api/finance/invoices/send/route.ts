import { NextResponse } from 'next/server';
import { getMember, deny } from '@/lib/integrations/auth';
import { sendEmail } from '@/lib/email/send';
import { buildMessageEmail } from '@/lib/email/message-template';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso: string | null) => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return MONTHS[m - 1] + ' ' + d + ', ' + y; };
const money = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Finance > Client payments: emails an invoice (or a payment reminder) to the account's billing contact through
// Resend, then records the receipt on the invoice. The invoice is read and updated on the member's own session, so
// finance permissions apply; a failed send changes no status and keeps Resend's error on the invoice.
export async function POST(request: Request) {
  const m = await getMember();
  if (!m) return deny('Sign in first.', 401);
  const perms = ((m.ctx as unknown as { perms?: [string, string][] }).perms || []).map((p) => p[0] + ':' + p[1]);
  if (m.ctx.role !== 'super_admin' && !perms.includes('finance:edit')) return deny('You cannot send invoices.');
  const body = await request.json().catch(() => ({}));
  const reminder = !!body.reminder;
  const inv = await m.supabase.from('invoices').select('*, accounts(name, contact_email)').eq('id', String(body.id || '')).maybeSingle();
  if (inv.error || !inv.data) return deny('Invoice not found.', 404);
  const i = inv.data;
  const acct = (i.accounts || {}) as { name?: string; contact_email?: string };
  const to = String(i.contact_email || acct.contact_email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ sent: false, error: 'Add a billing email to the invoice or the account first.' });
  if (i.status === 'paid') return NextResponse.json({ sent: false, error: 'This invoice is already paid.' });

  const workspace = m.ctx.workspace_name || 'FTGU Studio';
  const overdue = !!i.due_date && i.due_date < new Date().toISOString().slice(0, 10);
  const tpl = buildMessageEmail({
    workspace,
    tone: reminder ? { label: overdue ? 'Payment overdue' : 'Payment reminder', bg: overdue ? '#C42B2F' : '#9A6A00' } : { label: 'Invoice', bg: '#111111' },
    subject: (reminder ? 'Reminder: invoice ' : 'Invoice ') + i.number + ' from ' + workspace,
    heading: reminder ? 'A friendly payment reminder' : 'Invoice ' + i.number,
    lead: reminder
      ? 'Invoice ' + i.number + ' for ' + money(i.amount_cents) + (i.due_date ? (overdue ? ' was due ' : ' is due ') + day(i.due_date) : '') + '. If you have already paid, thank you, and you can ignore this email.'
      : 'Here is invoice ' + i.number + ' for ' + money(i.amount_cents) + (i.due_date ? ', due ' + day(i.due_date) : '') + '.',
    cards: [{ title: acct.name || 'Invoice', rows: [
      ['Invoice', i.number], ...(i.description ? [['For', i.description] as [string, string]] : []), ['Amount', money(i.amount_cents)],
      ...(i.due_date ? [['Due', day(i.due_date)] as [string, string]] : []),
    ] }],
    cta: i.payment_url ? { label: 'Pay invoice', url: i.payment_url } : undefined,
    fine: 'Questions about this invoice? Reply to this email. ' + workspace + ' sent it from its production board.',
  });
  const res = await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
  const now = new Date().toISOString();
  const patch = res.sent
    ? { status: reminder ? 'reminder_sent' : 'sent', [reminder ? 'reminded_at' : 'sent_at']: now, delivery_id: res.id, delivery_error: null, contact_email: to }
    : { delivery_error: res.error };
  const up = await m.supabase.from('invoices').update(patch).eq('id', i.id);
  if (up.error) return deny(up.error.message, 400);
  if (res.sent) {
    await m.supabase.rpc('log_activity', {
      p_category: 'admin', p_action: reminder ? 'emailed a payment reminder for' : 'emailed invoice', p_target_label: i.number + ' to ' + to,
      p_project: null, p_idea: null, p_event: null, p_quote: null, p_external: false,
    });
  }
  return NextResponse.json(res.sent ? { sent: true, id: res.id, to } : { sent: false, error: res.error });
}
