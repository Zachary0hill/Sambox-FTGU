// Import is a local preview. The chosen brand and Save action remain explicit.
export function importBrief(text) {
  const raw = String(text || '').trim();
  if (!raw || raw.length > 30000) throw new Error('Paste a brief of up to 30,000 characters.');
  if (raw.startsWith('{') || raw.startsWith('```')) {
    let value;
    try { value = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
    catch { throw new Error('The JSON could not be read. Paste one idea object or plain text.'); }
    if (!value || Array.isArray(value) || typeof value !== 'object' || typeof value.title !== 'string') throw new Error('Import one idea with a title at a time.');
    const titles = value.titleOptions || value.title_options || [];
    const body = value.body || value.script || '';
    const limits = [[value.title, 300, 'Title'], [value.hook, 24, 'Hook'], [value.thumbnailBrief || value.thumbnail_brief, 12000, 'Thumbnail direction'], [value.audience, 2000, 'Audience'], [value.promise, 2000, 'Viewer takeaway']];
    for (const [text, limit, label] of limits) if (String(text || '').length > limit) throw new Error(label + ' exceeds ' + limit + ' characters. Shorten that field before importing.');
    const titleList = Array.isArray(titles) ? titles : String(titles).split('\n');
    if (titleList.length > 12 || titleList.some(t => String(t).length > 300)) throw new Error('Use up to 12 title options of 300 characters each.');
    if (Array.isArray(value.references) && value.references.length > 30) throw new Error('Use up to 30 references.');
    return {
      title: value.title.slice(0, 300), hook: String(value.hook || '').slice(0, 24),
      titleOptions: (Array.isArray(titles) ? titles : String(titles).split('\n')).slice(0, 12).map(x => String(x).slice(0, 300)).join('\n'),
      thumbnailBrief: String(value.thumbnailBrief || value.thumbnail_brief || '').slice(0, 12000),
      body: (Array.isArray(body) ? body.join('\n\n') : String(body)),
      audience: String(value.audience || '').slice(0, 2000), promise: String(value.promise || '').slice(0, 2000),
      refs: (Array.isArray(value.references) ? value.references : []).filter(x => typeof x === 'string').slice(0, 30), mode: 'full',
    };
  }
  return { title: raw.split('\n')[0].replace(/^#+\s*/, '').slice(0, 300), body: raw, mode: 'full' };
}
