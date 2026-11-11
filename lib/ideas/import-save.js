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

// `permanent` errors will fail the same way on retry, so the UI asks for a fix instead of a retry.
const permanent = message => Object.assign(new Error(message), { permanent: true });
function saveError(error) {
  const message = error.message || '';
  if (error.code === '42501' || /row-level security|permission denied/i.test(message)) return permanent('You do not have permission to add ideas for one or more of these clients. Ask a workspace admin for idea access, or remove those ideas.');
  if (error.code === '23514' || /check constraint/i.test(message)) return permanent('One of these ideas has a field over the allowed length. Shorten it and import again.');
  if (error.code === '23503' || /foreign key/i.test(message)) return permanent('One of the selected clients is no longer available. Choose another client and import again.');
  return new Error(message || 'The ideas could not be saved.');
}

export async function saveIdeaImport({ sb, workspaceId, userId, brands, ideas, cover }) {
  if (!workspaceId || !userId) throw permanent('Sign in before importing ideas.');
  if (!Array.isArray(ideas) || !ideas.length || ideas.length > IDEA_LIMIT) throw permanent('Select between 1 and 100 ideas.');
  const rows = [];
  for (const [n, idea] of ideas.entries()) {
    const name = `Idea ${n + 1}${typeof idea?.title === 'string' && idea.title.trim() ? ` “${idea.title.trim().slice(0, 60)}”` : ''}`;
    try { validateImportIdea(idea); } catch (err) { throw permanent(`${name}: ${err.message}`); }
    if (!brands.some(b => b.id === idea.brandId)) throw permanent(`${name}: choose an available client.`);
    // Whitelist fields: documents cannot provide authors, workspace IDs or approval state.
    const content = { brand_id: idea.brandId, title: idea.title.trim(), body: idea.body.trim() ? [idea.body.trim()] : [],
      refs: [...new Set(idea.refs.map(r => r.trim()).filter(Boolean))], hook: idea.hook.trim(), title_options: idea.titleOptions.map(t => t.trim()).filter(Boolean),
      thumbnail_brief: idea.thumbnailBrief.trim(), audience: idea.audience.trim(), promise: idea.promise.trim() };
    rows.push({ ...content, id: await importId(workspaceId, content), workspace_id: workspaceId, author_id: userId, type: 'idea', stage: 'inbox', cover_mode: 'hook', source: 'manual', ...(cover ? { cover_highlight: cover.highlight, hook_position: cover.hook_position } : {}) });
  }
  const unique = [...new Map(rows.map(row => [row.id, row])).values()];
  // One PostgreSQL statement: either all new rows pass RLS/constraints or none do.
  // Ignore conflicts, never update an existing idea (including manually edited cards).
  const { data, error } = await sb.from('ideas').upsert(unique, { onConflict: 'id', ignoreDuplicates: true }).select('id');
  if (error) throw saveError(error);
  const created = data?.length || 0;
  return { created, skipped: rows.length - created };
}
