import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { deliverInvite, baseUrlFor } from '@/lib/email/invite';
import type { InviteRole } from '@/lib/email/invite-template';

// Super Admin resends a pending invite with a fresh link and a renewed expiry.
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: ctx } = await supabase.rpc('my_context');
  if (!ctx || ctx.role !== 'super_admin') return NextResponse.json({ error: 'Only a Super Admin can resend invites.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const inv = await supabase.from('invitations').select('id, email, full_name, role, account_id, accepted_at, accounts(name)').eq('id', String(body.invitationId || '')).maybeSingle();
  if (inv.error || !inv.data) return NextResponse.json({ error: 'Invite not found.' }, { status: 404 });
  if (inv.data.accepted_at) return NextResponse.json({ error: 'This invite was already accepted.' }, { status: 409 });

  const renewed = await supabase.from('invitations')
    .update({ resent_at: new Date().toISOString(), expires_at: new Date(Date.now() + 14 * 86400000).toISOString() })
    .eq('id', inv.data.id);
  if (renewed.error) return NextResponse.json({ error: renewed.error.message }, { status: 400 });

  const acct = inv.data.accounts as unknown as { name: string } | null;
  try {
    const d = await deliverInvite({
      baseUrl: baseUrlFor(request), email: inv.data.email, name: inv.data.full_name, role: inv.data.role as InviteRole,
      account: acct ? acct.name : null, workspace: ctx.workspace_name, inviter: (ctx.profile && ctx.profile.full_name) || 'Your team',
    });
    return NextResponse.json({ emailSent: d.email.sent, emailError: d.email.sent ? null : d.email.error });
  } catch (err) {
    return NextResponse.json({ emailSent: false, emailError: err instanceof Error ? err.message : 'Could not send the invite.' });
  }
}
