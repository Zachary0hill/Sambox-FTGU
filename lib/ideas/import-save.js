import { IDEA_LIMIT, validateImportIdea } from './import-document';

// Stable UUIDs let a lost response or a second upload retry without duplicating cards.
// Identity includes the workspace and reviewed content, not the importing user.
async function importId(workspaceId, value) {
  const bytes = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(['idea-document-v1', workspaceId, value]))));
  bytes[6] = (bytes[6] & 15) | 128; // RFC 9562 UUIDv8 (application-defined hash)
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function saveIdeaImport({ sb, workspaceId, userId, brands, ideas }) {
  if (!workspaceId || !userId) throw new Error('Sign in before importing ideas.');
  if (!Array.isArray(ideas) || !ideas.length || ideas.length > IDEA_LIMIT) throw new Error('Select between 1 and 100 ideas.');
  const rows = [];
  for (const idea of ideas) {
    validateImportIdea(idea);
    if (!brands.some(b => b.id === idea.brandId)) throw new Error('Choose an available client for every selected idea.');
    // Whitelist fields: documents cannot provide authors, workspace IDs or approval state.
    const content = { brand_id: idea.brandId, title: idea.title.trim(), body: idea.body.trim() ? [idea.body.trim()] : [],
      refs: [...new Set(idea.refs.map(r => r.trim()).filter(Boolean))], hook: idea.hook.trim(), title_options: idea.titleOptions.map(t => t.trim()).filter(Boolean),
      thumbnail_brief: idea.thumbnailBrief.trim(), audience: idea.audience.trim(), promise: idea.promise.trim() };
    rows.push({ ...content, id: await importId(workspaceId, content), workspace_id: workspaceId, author_id: userId, type: 'idea', status: 'draft', cover_mode: 'hook', source: 'manual' });
  }
  const unique = [...new Map(rows.map(row => [row.id, row])).values()];
  // One PostgreSQL statement: either all new rows pass RLS/constraints or none do.
  // Ignore conflicts, never update an existing idea (including manually edited cards).
  const { data, error } = await sb.from('ideas').upsert(unique, { onConflict: 'id', ignoreDuplicates: true }).select('id');
  if (error) throw new Error(error.message || 'The ideas could not be saved.');
  const created = data?.length || 0;
  return { created, skipped: rows.length - created };
}
