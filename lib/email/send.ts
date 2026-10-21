import 'server-only';
import { Resend } from 'resend';

const DEFAULT_FROM = 'YouTube Studio <onboarding@resend.dev>';

export type SendResult = { sent: true; id: string } | { sent: false; error: string };

// Sends through Resend. Never throws: callers decide how to report a failed send.
export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: 'RESEND_API_KEY is not set.' };
  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({ from: process.env.EMAIL_FROM || DEFAULT_FROM, to, subject, html, text });
    if (error) return { sent: false, error: error.message };
    return { sent: true, id: data ? data.id : '' };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Resend request failed.' };
  }
}
