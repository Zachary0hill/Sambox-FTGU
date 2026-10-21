import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Secret-key client for server-only work: auth admin calls (minting invite links), reading integration keys from
// Vault, and system writes from integration syncs. Never import from client code, and never use it for reads made
// on a member's behalf: those stay on the member's session so RLS applies.
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set. Add the Supabase secret key to the server environment to send invites.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
