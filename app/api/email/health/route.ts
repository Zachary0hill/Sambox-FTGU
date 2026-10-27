import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { emailHealth } from '@/lib/email/send';

// Super Admin pages warn when invites cannot reach anyone yet: no Resend key, or Resend's test sender, which only
// delivers to the Resend account owner until a sending domain is verified.
export async function GET() {
  const supabase = await supabaseServer();
  const { data: ctx } = await supabase.rpc('my_context');
  if (!ctx || ctx.role !== 'super_admin') return NextResponse.json({ error: 'Only a Super Admin can check email.' }, { status: 403 });
  return NextResponse.json(emailHealth());
}
