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
  account?: string | null; existingUser?: boolean;
}): Promise<InviteDelivery> {
  const admin = supabaseAdmin();
  let existingUser = !!opts.existingUser;
  let res = existingUser
    ? await admin.auth.admin.generateLink({ type: 'magiclink', email: opts.email })
    : await admin.auth.admin.generateLink({ type: 'invite', email: opts.email, options: { data: { full_name: opts.name } } });
  if (res.error && !existingUser) {
    // Already registered: send a sign-in link instead of an invite.
    existingUser = true;
    res = await admin.auth.admin.generateLink({ type: 'magiclink', email: opts.email });
  }
  if (res.error || !res.data.properties) throw new Error(res.error ? res.error.message : 'Could not create the invite link.');
  const p = res.data.properties;
  const params = new URLSearchParams({ token_hash: p.hashed_token, type: p.verification_type || (existingUser ? 'magiclink' : 'invite') });
  const link = opts.baseUrl.replace(/\/+$/, '') + '/auth/setup?' + params.toString();
  const tpl = buildInviteEmail({ name: opts.name, workspace: opts.workspace, role: opts.role, inviter: opts.inviter, account: opts.account, link, existingUser });
  const email = await sendEmail({ to: opts.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  if (!email.sent) console.error('Invite email failed for', opts.email, '-', email.error);
  return { link, existingUser, email };
}

export const baseUrlFor = (request: Request) => process.env.APP_BASE_URL || new URL(request.url).origin;
