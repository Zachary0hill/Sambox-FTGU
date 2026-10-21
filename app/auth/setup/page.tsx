import type { EmailOtpType } from '@supabase/supabase-js';
import SetupForm from './SetupForm';

export default async function SetupPage({ searchParams }: PageProps<'/auth/setup'>) {
  const sp = await searchParams;
  const tokenHash = typeof sp.token_hash === 'string' ? sp.token_hash : '';
  const type = (sp.type === 'magiclink' ? 'magiclink' : 'invite') as EmailOtpType;
  return <SetupForm tokenHash={tokenHash} type={type} />;
}
