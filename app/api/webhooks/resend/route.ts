import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/admin';

const statuses: Record<string, string> = {
  'email.sent': 'submitted', 'email.delivered': 'delivered', 'email.delivery_delayed': 'delayed',
  'email.failed': 'failed', 'email.suppressed': 'failed', 'email.bounced': 'bounced', 'email.complained': 'complained',
};
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  let event;
  try {
    event = new Resend(process.env.RESEND_API_KEY || 'verification-only').webhooks.verify({
      payload: await request.text(), webhookSecret: secret,
      headers: { id: request.headers.get('svix-id') || '', timestamp: request.headers.get('svix-timestamp') || '', signature: request.headers.get('svix-signature') || '' },
    });
  } catch { return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 }); }
  const status = statuses[event.type];
  if (!status || !('email_id' in event.data)) return NextResponse.json({ ok: true });
  const result = await supabaseAdmin().rpc('record_invite_delivery_event', {
    p_event: request.headers.get('svix-id'), p_provider: event.data.email_id, p_status: status, p_time: event.created_at,
  });
  if (result.error) return NextResponse.json({ error: 'Could not record delivery event.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
