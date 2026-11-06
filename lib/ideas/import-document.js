// Documents are data, never prompts. Parsing stays local and does not call an AI provider.
export const IMPORT_LIMIT = 250000;
export const IDEA_LIMIT = 100;
export const IDEA_TEMPLATE = `# POD HUT shoot list
Client: POD HUT

## Idea 1: Why your podcast sounds different
Description: Explain three ways to improve a home recording setup.
Reference: https://www.youtube.com/watch?v=example
Hook: BETTER SOUND

### Script
Open with a before-and-after sound comparison.

### Title options
- Three fixes for better podcast audio
- Make your home studio sound better

### Thumbnail direction
Before-and-after studio setup, with the microphone highlighted.

## Idea 2: A studio tour in 60 seconds
Description: Walk through the recording space and show the equipment.
Reference: https://example.com/studio-tour
`;

const clean = text => String(text || '').replace(/\*\*/g, '').trim();
const normalized = text => clean(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const fields = /^(?:description|content|script|references?|reference links?|sources?|links?|hook|title options|thumbnail (?:brief|direction)|audience|viewer takeaway|client|brand|brand \/ client|title)$/i;
const clientLine = /^(?:[-*]\s+)?(?:\*\*)?(?:client|brand|brand\s*\/\s*client)(?:\*\*)?\s*:\s*(.+?)\s*$/i;
const titleOf = text => clean(text).replace(/^(?:(?:idea|video)\s*\d+\s*[:.\)–—-]\s*|\d+[.)]\s*)/i, '').trim();

function urls(text) {
  return [...new Set((String(text).match(/https?:\/\/[^\s<>"\]]+/gi) || []).map(url => {
    // Strip Markdown's closing parenthesis, while preserving parentheses inside URLs.
    while (url.endsWith(')') && (url.match(/\)/g) || []).length > (url.match(/\(/g) || []).length) url = url.slice(0, -1);
    return url.replace(/[.,;]+$/, '');
  }))];
}

function matchBrand(hint, brands, context) {
  if (hint) {
    const matches = brands.filter(b => normalized(b.name) === normalized(hint));
    return { brandId: matches.length === 1 ? matches[0].id : '', brandHint: hint,
      brandWarning: matches.length === 1 ? '' : `Choose a client: “${hint}” ${matches.length ? 'matches more than one brand' : 'was not found'}.` };
  }
  // Only infer from the document title / filename, never from incidental mentions in a script.
  const matches = brands.filter(b => {
    const name = normalized(b.name);
    const prefix = new RegExp('^' + Array.from(name).join('[^\\p{L}\\p{N}]*') + '(?=$|[^\\p{L}\\p{N}])', 'iu');
    return name.length >= 4 && context.some(c => prefix.test(clean(c).normalize('NFKC')));
  });
  return { brandId: matches.length === 1 ? matches[0].id : '', brandHint: '',
    brandWarning: matches.length === 1 ? `Client suggested from the document name: ${matches[0].name}. Please review.` : 'Choose a client before importing.' };
}

function list(value) {
  if (value == null) return [];
  if (Array.isArray(value) && value.every(v => typeof v === 'string')) return value;
  if (typeof value === 'string') return value.split('\n').map(x => x.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean);
  throw new Error('References and title options must be text or a list of text values.');
}

export function validateImportIdea(idea) {
  const limits = { title: 300, body: 30000, hook: 24, thumbnailBrief: 12000, audience: 2000, promise: 2000 };
  for (const [key, max] of Object.entries(limits)) {
    if (typeof idea[key] !== 'string' || idea[key].length > max) throw new Error(`${key} must be text of up to ${max.toLocaleString('en-US')} characters.`);
  }
  if (!idea.title.trim()) throw new Error('Every idea needs a title.');
  if (!Array.isArray(idea.titleOptions) || idea.titleOptions.length > 12 || idea.titleOptions.some(t => typeof t !== 'string' || t.length > 300)) throw new Error('Use up to 12 title options of 300 characters each.');
  if (!Array.isArray(idea.refs) || idea.refs.filter(r => typeof r !== 'string' || r.trim()).length > 30 || idea.refs.some(r => {
    if (typeof r === 'string' && !r.trim()) return false;
    try { return typeof r !== 'string' || r.length > 4000 || !['http:', 'https:'].includes(new URL(r).protocol); } catch { return true; }
  })) throw new Error('Use up to 30 valid http or https reference links.');
  return idea;
}

function ideaFromJson(value, defaults, brands, context) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || typeof value.title !== 'string') throw new Error('Each JSON idea needs a title.');
  const sections = ['body', 'description', 'script'].filter(key => value[key] != null).map(key => {
    const content = value[key];
    if (typeof content !== 'string' && !(Array.isArray(content) && content.every(x => typeof x === 'string'))) throw new Error('Idea content must be text.');
    return { key, text: Array.isArray(content) ? content.join('\n\n') : content };
  });
  const body = sections.map(s => sections.length > 1 ? s.key + ':\n' + s.text : s.text).join('\n\n');
  const hint = value.client ?? value.brand ?? defaults;
  if (hint && typeof hint !== 'string') throw new Error('Use a client or brand name as text.');
  return validateImportIdea({ title: value.title.trim(), body,
    hook: value.hook ?? '', thumbnailBrief: value.thumbnailBrief ?? value.thumbnail_brief ?? '', audience: value.audience ?? '', promise: value.promise ?? '',
    titleOptions: list(value.titleOptions ?? value.title_options), refs: list(value.references ?? value.refs), ...matchBrand(hint, brands, context) });
}

export function parseIdeaDocument(text, brands = [], filename = '') {
  let raw = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!raw || raw.length > IMPORT_LIMIT) throw new Error('Choose or paste a document of 1–250,000 characters.');
  if (/^```(?:json)?\s*\n[\s\S]*\n```$/.test(raw)) raw = raw.replace(/^```(?:json)?\s*\n/, '').replace(/\n```$/, '').trim();
  if (/^[{[]/.test(raw)) {
    let value;
    try { value = JSON.parse(raw); } catch { throw new Error('This looks like JSON but could not be read. Check the JSON or use the Markdown template.'); }
    const entries = Array.isArray(value) ? value : value.ideas || [value];
    if (!Array.isArray(entries) || !entries.length || entries.length > IDEA_LIMIT) throw new Error('Import between 1 and 100 ideas at a time.');
    return { ideas: entries.map(v => ideaFromJson(v, value.client || value.brand || '', brands, [filename])), context: '' };
  }

  let defaultClient = '';
  // Minimal frontmatter support, without interpreting YAML tags or arbitrary objects.
  const frontmatter = raw.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (frontmatter) {
    defaultClient = (frontmatter[1].split('\n').map(l => l.match(clientLine)).find(Boolean) || [])[1] || '';
    defaultClient = defaultClient.replace(/^["']|["']$/g, '');
    raw = raw.slice(frontmatter[0].length);
  }
  const lines = raw.split('\n');
  const headings = [];
  let fence = null;
  lines.forEach((line, i) => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      return;
    }
    if (fence) return;
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) headings.push({ i, level: m[1].length, title: clean(m[2]) });
  });
  const candidates = headings.filter(h => !fields.test(h.title) && !clientLine.test(h.title));
  const numbered = candidates.filter(h => /^(?:(?:idea|video)\s*\d+\s*[:.\)–—-]|\d+[.)]\s)/i.test(h.title));
  let starts;
  if (numbered.length) starts = numbered;
  else {
    const top = candidates.length ? Math.min(...candidates.map(h => h.level)) : 0;
    const peers = candidates.filter(h => h.level === top);
    // A single H1 is the document title when it contains idea headings.
    starts = top === 1 && peers.length === 1 && candidates.some(h => h.level > 1)
      ? candidates.filter(h => h.level === Math.min(...candidates.filter(h => h.level > 1).map(h => h.level))) : peers;
  }
  if (!starts.length) throw new Error('No idea headings found. Use a separate “## Idea title” heading for each idea, or download the template.');
  if (starts.length > IDEA_LIMIT) throw new Error('Import up to 100 ideas at a time. Split this document into smaller files.');
  const preamble = lines.slice(0, starts[0].i).join('\n').trim();
  const documentTitle = headings.find(h => h.i < starts[0].i)?.title || '';
  defaultClient = (preamble.split('\n').map(l => l.match(clientLine)).find(Boolean) || [])[1] || defaultClient;
  const ideas = starts.map((start, n) => {
    const body = lines.slice(start.i + 1, starts[n + 1]?.i ?? lines.length).join('\n').trim();
    const values = {};
    let current = '';
    let inFence = null;
    for (const line of body.split('\n')) {
      const marker = line.match(/^\s*(`{3,}|~{3,})/);
      if (marker) {
        if (!inFence) inFence = marker[1];
        else if (marker[1][0] === inFence[0] && marker[1].length >= inFence.length) inFence = null;
        continue;
      }
      if (inFence) continue;
      const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
      const labeled = line.match(/^(?:[-*]\s+)?(?:\*\*)?([^:*]+?)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.*)$/);
      const key = clean(heading?.[1] || labeled?.[1] || '').toLowerCase();
      if (fields.test(key)) { current = key; values[key] = labeled?.[2] || ''; }
      else if (heading) current = '';
      else if (current && !labeled && !/^(?:client|brand|brand \/ client|hook|title)$/.test(current)) values[current] += '\n' + line;
    }
    const value = key => clean(values[key]);
    const hint = value('client') || value('brand') || value('brand / client') || clean(defaultClient);
    return validateImportIdea({ title: value('title') || titleOf(start.title),
      // Retain the complete section, including unknown fields, research and script formatting.
      body: body + (preamble ? '\n\nDocument context:\n' + preamble : ''),
      refs: urls(body), hook: value('hook'), thumbnailBrief: value('thumbnail direction') || value('thumbnail brief'),
      audience: value('audience'), promise: value('viewer takeaway'), titleOptions: list(value('title options')),
      ...matchBrand(hint, brands, [documentTitle, filename]) });
  });
  return { ideas, context: preamble };
}
