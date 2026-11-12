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

// Decode an uploaded file: UTF-8 (with or without BOM), UTF-16 (Windows "Unicode" .txt) or Windows-1252.
export function decodeImportFile(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  // UTF-16 without a byte-order mark: mostly-Latin text has a zero in every other byte.
  const sample = bytes.subarray(0, 4000);
  let even = 0, odd = 0;
  sample.forEach((b, i) => { if (!b) { if (i % 2) odd++; else even++; } });
  if (sample.length >= 4 && odd > sample.length / 4 && even < odd / 4) return new TextDecoder('utf-16le').decode(bytes);
  if (sample.length >= 4 && even > sample.length / 4 && odd < even / 4) return new TextDecoder('utf-16be').decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  // Not valid UTF-8: an older Word/Notepad "ANSI" file. Map Windows-1252 by hand, since some runtimes
  // decode that label as Latin-1 and turn smart quotes into control characters.
  catch { return Array.from(bytes, b => b >= 0x80 && b < 0xA0 && CP1252[b - 0x80] !== ' ' ? CP1252[b - 0x80] : String.fromCharCode(b)).join(''); }
}
const CP1252 = '€ ‚ƒ„…†‡ˆ‰Š‹Œ Ž  ‘’“”•–—˜™š›œ žŸ';

const clean = text => String(text || '').replace(/\*\*/g, '').trim();
const normalized = text => clean(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const fields = /^(?:description|content|script|references?|reference links?|sources?|links?|hook|title options|thumbnail (?:brief|direction)|audience|viewer takeaway|client|brand|brand \/ client|title)$/i;
const clientLine = /^(?:[-*]\s+)?(?:\*\*)?(?:client|brand|brand\s*\/\s*client)(?:\*\*)?\s*:\s*(.+?)\s*$/i;
const titleOf = text => clean(text).replace(/^(?:(?:idea|video)\s*\d+\s*[:.\)–—-]\s*|\d+[.)]\s*)/i, '').trim();

function urls(text) {
  return [...new Set((String(text).match(/https?:\/\/[^\s<>"\]]+/gi) || []).map(url => {
    // Strip Markdown emphasis, sentence punctuation and an unbalanced closing parenthesis,
    // while preserving parentheses inside URLs.
    let previous;
    do {
      previous = url;
      url = url.replace(/[*_~`'.,;:!?]+$/, '');
      while (url.endsWith(')') && (url.match(/\)/g) || []).length > (url.match(/\(/g) || []).length) url = url.slice(0, -1);
    } while (url !== previous);
    return url;
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

export const HOOK_LIMIT = 24;
// The idea's hook is the short cover text (2–4 words). Shoot lists often write a full spoken hook instead;
// keep that in the content and leave the cover hook for review rather than rejecting the whole document.
function coverHook(value) {
  const hook = clean(value).replace(/\s+/g, ' ');
  if (hook.length <= HOOK_LIMIT) return { hook, hookWarning: '' };
  return { hook: '', hookWarning: `The hook “${hook.length > 80 ? hook.slice(0, 80) + '…' : hook}” is longer than the ${HOOK_LIMIT}-character cover limit, so it stays in the content. Add a short cover hook here or later.` };
}

function list(value) {
  if (value == null) return [];
  if (Array.isArray(value) && value.every(v => typeof v === 'string')) return value;
  if (typeof value === 'string') return value.split('\n').map(x => x.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean);
  throw new Error('References and title options must be text or a list of text values.');
}

// Matches the database: hook ≤ 24, ≤ 12 title options of ≤ 300, thumbnail brief ≤ 12,000.
const LIMITS = { title: 300, body: 30000, hook: HOOK_LIMIT, thumbnailBrief: 12000, audience: 2000, promise: 2000 };
const LABELS = { title: 'Title', body: 'Content', hook: 'Cover hook', thumbnailBrief: 'Thumbnail direction', audience: 'Audience', promise: 'Viewer takeaway' };
const MAX_OPTIONS = 12, MAX_OPTION = 300, MAX_REFS = 30;
const number = n => n.toLocaleString('en-US');
const plural = (n, one, many) => number(n) + ' ' + (n === 1 ? one : many);

export function validateImportIdea(idea) {
  for (const [key, max] of Object.entries(LIMITS)) {
    if (typeof idea[key] !== 'string') throw new Error(`${LABELS[key]} must be text.`);
    if (idea[key].length > max) throw new Error(`${LABELS[key]} is ${number(idea[key].length)} characters; the limit is ${number(max)}. Shorten it to import this idea.`);
  }
  if (!idea.title.trim()) throw new Error('Every idea needs a title.');
  if (!Array.isArray(idea.titleOptions) || idea.titleOptions.length > 12 || idea.titleOptions.some(t => typeof t !== 'string' || t.length > 300)) throw new Error('Use up to 12 title options of 300 characters each.');
  if (!Array.isArray(idea.refs) || idea.refs.filter(r => typeof r !== 'string' || r.trim()).length > 30 || idea.refs.some(r => {
    if (typeof r === 'string' && !r.trim()) return false;
    try { return typeof r !== 'string' || r.length > 4000 || !['http:', 'https:'].includes(new URL(r).protocol); } catch { return true; }
  })) throw new Error('Use up to 30 valid http or https reference links.');
  return idea;
}

function shorten(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + '…';
}
const webLink = r => { try { return r.length <= 4000 && ['http:', 'https:'].includes(new URL(r).protocol); } catch { return false; } };

// Fit one parsed idea to the limits instead of rejecting the document. Nothing is lost: text trimmed
// from a field is kept in the content, and each change is listed so the reviewer can see it.
// Anything that still cannot be saved (e.g. a 35,000-character transcript) becomes this idea's `error`.
function fitIdea(idea, context = '') {
  const warnings = [];
  let body = idea.body;
  const keep = (label, items) => {
    const missing = items.filter(t => t && !body.includes(t));
    if (missing.length) body += (body ? '\n\n' : '') + label + (missing.length === 1 ? ': ' : ':\n') + missing.join('\n');
  };
  let title = clean(idea.title).replace(/\s+/g, ' ');
  if (title.length > LIMITS.title) {
    keep('Full title', [title]); title = shorten(title, LIMITS.title);
    warnings.push(`The title was shortened to ${LIMITS.title} characters; the full title is in the content.`);
  }
  const { hook, hookWarning } = coverHook(idea.hook);
  if (hookWarning) keep('Hook', [clean(idea.hook)]);
  const options = [...new Set(idea.titleOptions.map(clean).filter(Boolean))];
  const longOptions = options.filter(t => t.length > MAX_OPTION);
  let titleOptions = options.filter(t => t.length <= MAX_OPTION);
  if (longOptions.length) {
    keep('Title notes', longOptions);
    warnings.push(`${plural(longOptions.length, 'title option was', 'title options were')} over ${MAX_OPTION} characters, so ${longOptions.length === 1 ? 'it stays' : 'they stay'} in the content.`);
  }
  if (titleOptions.length > MAX_OPTIONS) {
    keep('More title options', titleOptions.slice(MAX_OPTIONS));
    warnings.push(`Only the first ${MAX_OPTIONS} of ${number(titleOptions.length)} title options are listed; the rest are in the content.`);
    titleOptions = titleOptions.slice(0, MAX_OPTIONS);
  }
  const allRefs = [...new Set(idea.refs.map(r => String(r).trim()).filter(Boolean))];
  let refs = allRefs.filter(webLink);
  if (allRefs.length > refs.length) warnings.push(`Skipped ${plural(allRefs.length - refs.length, 'reference that is', 'references that are')} not an http or https link.`);
  if (refs.length > MAX_REFS) {
    keep('More references', refs.slice(MAX_REFS));
    warnings.push(`Only the first ${MAX_REFS} of ${number(refs.length)} links are saved as references; the rest are in the content.`);
    refs = refs.slice(0, MAX_REFS);
  }
  const text = {};
  for (const key of ['thumbnailBrief', 'audience', 'promise']) {
    text[key] = clean(idea[key]);
    if (text[key].length > LIMITS[key]) {
      keep(LABELS[key], [text[key]]); text[key] = shorten(text[key], LIMITS[key]);
      warnings.push(`${LABELS[key]} was shortened to ${number(LIMITS[key])} characters; the full text is in the content.`);
    }
  }
  // Shared notes above the first idea are copied into every idea, but only into the room left.
  if (context) {
    const label = '\n\nDocument context:\n';
    const room = LIMITS.body - body.length - label.length;
    if (room >= Math.min(context.length, 200)) {
      body += label + shorten(context, room);
      if (context.length > room) warnings.push('The shared notes above the ideas were shortened to fit this idea.');
    } else if (body.length <= LIMITS.body) warnings.push('The shared notes above the ideas did not fit in this idea.');
  }
  const fitted = { ...idea, title, body, hook, hookWarning, titleOptions, refs, ...text, warnings, error: '' };
  try { validateImportIdea(fitted); } catch (err) { fitted.error = err.message; }
  return fitted;
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
  const textField = (name, v) => { if (v != null && typeof v !== 'string') throw new Error(`${name} must be text.`); return v ?? ''; };
  return fitIdea({ title: value.title, body, hook: textField('Hook', value.hook),
    thumbnailBrief: textField('Thumbnail direction', value.thumbnailBrief ?? value.thumbnail_brief), audience: textField('Audience', value.audience), promise: textField('Viewer takeaway', value.promise),
    titleOptions: list(value.titleOptions ?? value.title_options), refs: list(value.references ?? value.refs), ...matchBrand(hint, brands, context) });
}

// Quoted fields, doubled quotes and line breaks inside quotes. Tabs work too, for rows copied out of a spreadsheet.
function parseDelimited(text) {
  const delim = text.split('\n')[0].includes('\t') ? '\t' : ',';
  const rows = [[]];
  let cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delim) { rows[rows.length - 1].push(cell); cell = ''; }
    else if (c === '\n') { rows[rows.length - 1].push(cell); cell = ''; rows.push([]); }
    else cell += c;
  }
  rows[rows.length - 1].push(cell);
  return rows.filter(r => r.some(x => x.trim()));
}

function ideasFromTable(raw, brands, filename) {
  const [head, ...rows] = parseDelimited(raw);
  const names = head.map(h => h.trim().toLowerCase());
  const col = (...keys) => names.findIndex(n => keys.includes(n));
  const [title, body, hook, client, link] = [col('title', 'idea', 'name'), col('description', 'notes', 'body', 'script'), col('hook'), col('client', 'brand'), col('reference', 'references', 'link', 'url')];
  if (title < 0) throw new Error('This CSV needs a “title” column.');
  if (!rows.length || rows.length > IDEA_LIMIT) throw new Error('Import between 1 and 100 ideas at a time.');
  const at = (row, n) => (n >= 0 ? (row[n] || '').trim() : '');
  return { ideas: rows.map((row, n) => {
    try {
      return ideaFromJson({ title: at(row, title), description: at(row, body), hook: at(row, hook), client: at(row, client), references: at(row, link) ? [at(row, link)] : [] }, '', brands, [filename]);
    } catch (err) { throw new Error(`Row ${n + 2}: ${err.message}`); }
  }), context: '' };
}

export function parseIdeaDocument(text, brands = [], filename = '') {
  // Null bytes and BOMs come from UTF-16 files read as UTF-8; non-breaking spaces from Docs/Word.
  let raw = String(text || '').replace(/\u0000/g, '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trim();
  if (!raw || raw.length > IMPORT_LIMIT) throw new Error('Choose or paste a document of 1–250,000 characters.');
  if (/^```(?:json)?\s*\n[\s\S]*\n```$/.test(raw)) raw = raw.replace(/^```(?:json)?\s*\n/, '').replace(/\n```$/, '').trim();
  if (/^[{[]/.test(raw)) {
    let value;
    try { value = JSON.parse(raw); } catch { throw new Error('This looks like JSON but could not be read. Check the JSON or use the Markdown template.'); }
    const entries = Array.isArray(value) ? value : value.ideas || [value];
    if (!Array.isArray(entries) || !entries.length || entries.length > IDEA_LIMIT) throw new Error('Import between 1 and 100 ideas at a time.');
    return { ideas: entries.map((v, n) => {
      try { return ideaFromJson(v, value.client || value.brand || '', brands, [filename]); }
      catch (err) { throw new Error(`Idea ${n + 1}${typeof v?.title === 'string' && v.title.trim() ? ` “${shorten(v.title.trim(), 60)}”` : ''}: ${err.message}`); }
    }), context: '' };
  }

  if (/\.csv$/i.test(filename) || /^"?(?:title|idea|name)"?\s*[,\t]/i.test(raw)) return ideasFromTable(raw, brands, filename);

  let defaultClient = '';
  // Minimal frontmatter support, without interpreting YAML tags or arbitrary objects.
  const frontmatter = raw.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (frontmatter) {
    defaultClient = (frontmatter[1].split('\n').map(l => l.match(clientLine)).find(Boolean) || [])[1] || '';
    defaultClient = defaultClient.replace(/^["']|["']$/g, '');
    raw = raw.slice(frontmatter[0].length);
  }
  // Text copied out of Docs/Notion loses its "#" markers. Only in a document with no headings at all, treat
  // stand-alone "Idea 1: Title" lines as ideas and known section names as their subheadings.
  const ideaLine = /^(?:idea|video)\s*\d+\s*[:.\)–—-]\s*\S/i;
  if (!raw.split('\n').some(l => /^\s{0,3}#{1,6}\s+\S/.test(l)) && raw.split('\n').some(l => ideaLine.test(l.trim()))) {
    raw = raw.split('\n').map(l => ideaLine.test(l.trim()) ? '## ' + l.trim()
      : /^(?:script|shoot notes|title options|thumbnail (?:direction|brief)|references?|description)\s*:?\s*$/i.test(l.trim()) ? '### ' + l.trim().replace(/\s*:$/, '') : l).join('\n');
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
  // A plain list: no headings at all, and every line short enough to be a title.
  const listLines = lines.map(l => l.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, '')).filter(Boolean);
  if (!headings.length && listLines.length > 1 && listLines.every(l => l.length <= 200)) {
    if (listLines.length > IDEA_LIMIT) throw new Error('Import up to 100 ideas at a time. Split this list into smaller files.');
    return { ideas: listLines.map(title => ideaFromJson({ title }, defaultClient, brands, [filename])), context: '' };
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
    return fitIdea({ title: value('title') || titleOf(start.title),
      // Retain the complete section, including unknown fields, research and script formatting.
      body,
      refs: urls(body), hook: value('hook'), thumbnailBrief: value('thumbnail direction') || value('thumbnail brief'),
      audience: value('audience'), promise: value('viewer takeaway'), titleOptions: list(value('title options')),
      ...matchBrand(hint, brands, [documentTitle, filename]) }, preamble);
  });
  return { ideas, context: preamble };
}
