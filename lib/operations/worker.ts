import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
export async function observedWorker<T>(job: string, workspaceId: string | null, work: () => Promise<T>): Promise<T> {
  const admin = supabaseAdmin(), scope = workspaceId || 'scheduler';
  const started = await admin.from('worker_health').upsert({ job, scope, status: 'running', started_at: new Date().toISOString(), error: null }, { onConflict: 'job,scope' });
  if (started.error) throw new Error('Could not record worker start.');
  try {
    const result = await work();
    const at = new Date().toISOString();
    const saved = await admin.from('worker_health').update({ status: 'ok', finished_at: at, last_success_at: at, error: null }).eq('job', job).eq('scope', scope);
    if (saved.error) throw new Error('Worker finished, but its result could not be recorded.');
    return result;
  } catch (err) {
    await admin.from('worker_health').update({ status: 'failed', finished_at: new Date().toISOString(), error: 'Execution failed. Check deployment logs and the affected queue.' }).eq('job', job).eq('scope', scope);
    throw err;
  }
}
