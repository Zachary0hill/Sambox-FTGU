import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail, type SendResult } from './send';
import { buildInviteEmail, type InviteRole } from './invite-template';

export type InviteDelivery = { link: string; existingUser: boolean; email: SendResult };

// Mints a one-time Supabase token and emails our own /auth/setup link built from its hash, the same way
// ZZMEDIA-DASHBOARD does. Supabase's action_link is never emailed, so link scanners cannot spend the token:
// it is only verified when the person submits the setup form.
export async function deliverInvite(opts: {
  baseUrl: string; email: string; name: string; role: InviteRole; workspace: string; inviter: string;
  account?: string | null; existingUser?: boolean; workspaceId: string; actorId: string;
}): Promise<InviteDelivery> {
  const admin = supabaseAdmin();
  const reservation = await admin.rpc('reserve_invite_delivery', {
    p_ws: opts.workspaceId, p_email: opts.email, p_actor: opts.actorId, p_purpose: opts.existingUser ? 'access' : 'invite',
  });
  if (reservation.error) throw new Error(reservation.error.message);
  const attemptId = reservation.data;
  let submitted = false;
  try {
    let existingUser = !!opts.existingUser;
    let res = existingUser
      ? await admin.auth.admin.generateLink({ type: 'magiclink', email: opts.email })
      : await admin.auth.admin.generateLink({ type: 'invite', email: opts.email, options: { data: { full_name: opts.name } } });
    if (res.error && !existingUser && ['email_exists', 'user_already_exists'].includes(res.error.code || '')) {
      // Already registered: send a sign-in link instead of an invite.
      existingUser = true;
      res = await admin.auth.admin.generateLink({ type: 'magiclink', email: opts.email });
    }
    if (res.error || !res.data.properties) throw new Error(res.error ? res.error.message : 'Could not create the invite link.');
    existingUser = !!res.data.user?.email_confirmed_at;
    const p = res.data.properties;
    const params = new URLSearchParams({ token_hash: p.hashed_token, type: p.verification_type || (existingUser ? 'magiclink' : 'invite') });
    if (!existingUser) params.set('setup', 'password');
    const link = opts.baseUrl.replace(/\/+$/, '') + '/auth/setup?' + params.toString();
    const tpl = buildInviteEmail({ name: opts.name, workspace: opts.workspace, role: opts.role, inviter: opts.inviter, account: opts.account, link, existingUser });
    const email = await sendEmail({ to: opts.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    submitted = email.sent;
    const recorded = await admin.rpc('finish_invite_delivery', {
      p_id: attemptId, p_provider: email.sent ? email.id : null,
      p_error: email.sent ? null : 'The email provider did not accept this message. Check email configuration and retry.',
    });
    if (recorded.error) throw new Error('Delivery status could not be saved. Check the provider before retrying.');
    return { link, existingUser, email };
  } catch (error) {
    // Never persist tokens, provider payloads, or raw authentication error messages.
    if (!submitted) await admin.from('invite_deliveries').update({ status: 'failed', error_summary: 'Invite preparation or delivery failed. Check email configuration and retry.' })
      .eq('id', attemptId).eq('status', 'queued');
    throw error;
  }
}

export const baseUrlFor = (request: Request) => process.env.APP_BASE_URL || new URL(request.url).origin;
