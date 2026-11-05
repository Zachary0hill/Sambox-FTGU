import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMember, deny } from '@/lib/integrations/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const m = await getMember();
  if (!m) return deny('Sign in to approve ideas.', 401);
  const body = await request.json().catch(() => null);
  if (!body || !/^[0-9a-f-]{36}$/i.test(body.ideaId || '')) return deny('Choose an idea.', 400);
  const { data: project, error } = await m.supabase.rpc('approve_idea_project', { p_idea: body.ideaId });
  if (error) return deny(error.message, error.code === '42501' ? 403 : 400);
  // The RPC has authorized and atomically linked this exact project. Copy only
  // its frozen cover, never a caller-supplied object or destination.
  const source = project.package?.coverPath;
  if (!source) return NextResponse.json({ project });
  try {
    if (!source.startsWith(project.workspaceId + '/' + body.ideaId + '/')) throw new Error('Invalid cover path');
    const admin = supabaseAdmin();
    const existing = await admin.from('project_assets').select('id').eq('project_id', project.id).eq('source_idea_id', body.ideaId).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) {
      const original = await m.supabase.storage.from('idea-covers').download(source);
      if (original.error || !original.data) throw original.error || new Error('Cover unavailable');
      const digest = createHash('sha256').update(source).digest('hex').slice(0, 20);
      const ext = source.split('.').pop()?.toLowerCase();
      if (!ext || !/^(png|jpg|jpeg|webp|gif|avif)$/.test(ext)) throw new Error('Unsupported cover');
      const path = project.workspaceId + '/' + project.id + '/idea-cover-' + digest + '.' + ext;
      const upload = await admin.storage.from('project-assets').upload(path, original.data, { contentType: original.data.type, upsert: false });
      if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw upload.error;
      const asset = await admin.from('project_assets').insert({ project_id: project.id, source_idea_id: body.ideaId,
        kind: 'other', name: 'Approved thumbnail concept.' + ext, storage_path: path,
        mime_type: original.data.type, size_bytes: original.data.size, uploaded_by: m.ctx.user_id, external_visible: false });
      if (asset.error && asset.error.code !== '23505') throw asset.error;
    }
    return NextResponse.json({ project });
  } catch {
    // A retry uses the same project and cover path. Do not misreport a committed
    // project as a failed approval or make another project on the next click.
    return NextResponse.json({ project, warning: 'Project created, but the thumbnail concept could not copy. Use Retry asset transfer on the idea.' });
  }
}
