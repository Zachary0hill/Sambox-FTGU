import { NextResponse } from 'next/server';
import { getMember, isSuperAdmin, deny } from '@/lib/integrations/auth';
import { normalizeIdeasRules, validateIdeasRules } from '@/lib/ideas/rules-shared';

// Saves the workspace's Ideas & Research Rules. The page reads them through the board load.
export async function PUT(request: Request) {
  const m = await getMember();
  if (!isSuperAdmin(m)) return deny('Only a Super Admin can change Rules.');
  const checked = validateIdeasRules(await request.json().catch(() => null));
  if (!checked.ok) return deny(checked.errors.join(' '), 400);
  // Switching auto research on stamps the time, so only ideas captured from then on are queued.
  const { data: before } = await m.supabase.from('ideas_rules').select('rules').eq('workspace_id', m.ctx.workspace_id).maybeSingle();
  const was = normalizeIdeasRules(before?.rules);
  const rules = { ...checked.rules, auto_research_since: checked.rules.auto_research ? (was.auto_research && was.auto_research_since) || new Date().toISOString() : null };
  const { error } = await m.supabase.from('ideas_rules').upsert({ workspace_id: m.ctx.workspace_id, rules, updated_by: m.ctx.user_id });
  if (error) return deny('The Rules could not be saved.', error.code === '42501' ? 403 : 500);
  return NextResponse.json({ rules });
}
