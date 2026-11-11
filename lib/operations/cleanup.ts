import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
// Only the database deletion triggers can enqueue objects. Workers cannot accept browser-supplied paths.
export async function cleanupDeletedFiles(workspaceId: string | null) {
  const admin = supabaseAdmin();
  let query = admin.from('storage_cleanup').select('*').is('completed_at', null).lt('attempts', 10).order('created_at').limit(50);
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let removed = 0;
  for (const item of data || []) {
    const parts = String(item.path).split('/');
    const valid = ['project-assets','brand-assets'].includes(item.bucket) && parts[0] === item.workspace_id && /^[0-9a-f-]{36}$/i.test(parts[1] || '') && parts.length >= 3;
    const lookup = item.bucket === 'brand-assets'
      ? await admin.from('brand_kits').select('id').contains('assets', [{ path: item.path }]).limit(1)
      : await admin.from('project_assets').select('id').eq('storage_path', item.path).limit(1);
    if (lookup.error) {
      await admin.from('storage_cleanup').update({ attempts: item.attempts + 1, error: 'Reference check failed; file retained.' }).eq('id', item.id);
      continue;
    }
    if (!valid || lookup.data?.length) {
      await admin.from('storage_cleanup').update({ completed_at: new Date().toISOString(), error: !valid ? 'Invalid path; file retained.' : 'Still referenced; file retained.' }).eq('id', item.id);
      continue;
    }
    const result = await admin.storage.from(item.bucket).remove([item.path]);
    const saved = await admin.from('storage_cleanup').update({ attempts: item.attempts + 1, error: result.error?.message || null, completed_at: result.error ? null : new Date().toISOString() }).eq('id', item.id);
    if (saved.error) throw new Error(saved.error.message);
    if (!result.error) removed++;
  }
  return removed;
}
