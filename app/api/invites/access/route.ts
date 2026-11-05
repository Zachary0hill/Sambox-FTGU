import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { baseUrlFor, deliverInvite } from '@/lib/email/invite';

export async function POST(request: Request) {
  const sb = await supabaseServer();
  const { data: ctx } = await sb.rpc('my_context');
  if (!ctx || ctx.role !== 'super_admin') return NextResponse.json({ error: 'Only a Super Admin can send access emails.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const member = await sb.from('workspace_members').select('user_id, role, status')
    .eq('workspace_id', ctx.workspace_id).eq('user_id', String(body.userId || '')).maybeSingle();
  if (!member.data || member.data.status !== 'active' || !['editor','designer'].includes(member.data.role)) {
    return NextResponse.json({ error: 'Choose an active editor or designer in this workspace.' }, { status: 400 });
  }
  const profile = await sb.from('profiles').select('email, full_name').eq('id', member.data.user_id).single();
  if (!profile.data?.email) return NextResponse.json({ error: 'Member email is unavailable.' }, { status: 400 });
  try {
    const result = await deliverInvite({
      workspaceId: ctx.workspace_id, actorId: ctx.user_id, baseUrl: baseUrlFor(request),
      email: profile.data.email, name: profile.data.full_name, role: member.data.role, existingUser: true,
      workspace: ctx.workspace_name, inviter: ctx.profile?.full_name || 'Your team',
    });
    return NextResponse.json({ emailSent: result.email.sent, emailError: result.email.sent ? null : result.email.error });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not send access email.' }, { status: 400 });
  }
}
