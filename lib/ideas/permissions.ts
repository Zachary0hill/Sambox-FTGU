import type { Member } from '@/lib/integrations/auth';

// Call only after reading the idea through the member's session: that read
// enforces workspace and brand visibility, including client/sponsor accounts.
// Paid preparation needs the same edit permission as the eventual save.
export function mayEditIdea(member: Member, authorId: string): boolean {
  const { role, user_id } = member.ctx;
  if (role === 'super_admin' || role === 'sponsor' || role === 'client') return true;
  if (role === 'designer') return authorId === user_id;
  if (role === 'manager') {
    const perms = (member.ctx as typeof member.ctx & { perms?: [string, string][] }).perms;
    return !!perms?.some(([resource, action]) => resource === 'ideas' && action === 'edit');
  }
  return false;
}
