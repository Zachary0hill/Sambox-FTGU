import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { deliverInvite, baseUrlFor } from '@/lib/email/invite';
import type { InviteRole } from '@/lib/email/invite-template';

const ROLES = ['super_admin', 'editor', 'designer', 'sponsor', 'client'];
const VIEWS = ['table', 'kanban', 'list', 'timeline', 'calendar'];

// Super Admin invites someone: save the invitation (RLS-checked RPC on the admin's session), then email it.
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: ctx } = await supabase.rpc('my_context');
  if (!ctx || ctx.role !== 'super_admin') return NextResponse.json({ error: 'Only a Super Admin can invite people.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const role = String(body.role || '');
  const views = Array.isArray(body.views) ? body.views.filter((v: string) => VIEWS.includes(v)) : [];
  const accountId = body.accountId || null;
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !ROLES.includes(role) || (!views.length && !['client', 'sponsor'].includes(role))) {
    return NextResponse.json({ error: 'Name, a valid email, a user type and at least one view are required.' }, { status: 400 });
  }

  const saved = await supabase.rpc('invite_member', { p_email: email, p_name: name, p_role: role, p_views: views.length ? views : null, p_account: accountId });
  if (saved.error) {
    // The browser may have stale invite data. Explain an older team invite here too, without changing its access.
    if (accountId && ['client', 'sponsor'].includes(role) && saved.error.message === 'That email already has a pending invite') {
      const pending = await supabase.from('invitations').select('role')
        .eq('workspace_id', ctx.workspace_id).eq('email', email).is('accepted_at', null)
        .in('role', ['super_admin', 'editor', 'designer']).limit(1);
      if (pending.data?.length) {
        return NextResponse.json({ error: email + ' has a pending team invite. Open Users to cancel it before inviting them as a client or sponsor, or use a different email.' }, { status: 409 });
      }
    }
    return NextResponse.json({ error: saved.error.message }, { status: 400 });
  }

  let account: string | null = null;
  if (accountId) {
    const a = await supabase.from('accounts').select('name').eq('id', accountId).maybeSingle();
    account = a.data ? a.data.name : null;
  }

  try {
    const d = await deliverInvite({
      baseUrl: baseUrlFor(request), email, name, role: role as InviteRole, account,
      workspace: ctx.workspace_name, inviter: (ctx.profile && ctx.profile.full_name) || 'Your team',
      existingUser: saved.data === 'added',
    });
    return NextResponse.json({ status: saved.data, emailSent: d.email.sent, emailError: d.email.sent ? null : d.email.error });
  } catch (err) {
    return NextResponse.json({ status: saved.data, emailSent: false, emailError: err instanceof Error ? err.message : 'Could not send the invite.' });
  }
}
