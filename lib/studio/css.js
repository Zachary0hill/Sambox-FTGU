// Turns the design's inline style strings into React style objects. Results are cached by string.
const cache = new Map();

const camel = (prop) => {
  if (prop.startsWith('--')) return prop;
  const p = prop.startsWith('-webkit-') ? 'Webkit-' + prop.slice(8) : prop.startsWith('-moz-') ? 'Moz-' + prop.slice(5) : prop;
  return p.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
};

export function css(text) {
  if (!text) return undefined;
  if (typeof text !== 'string') return text;
  let out = cache.get(text);
  if (out) return out;
  out = {};
  for (const decl of text.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const key = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!key || !val) continue;
    out[camel(key)] = val;
  }
  if (cache.size > 5000) cache.clear();
  cache.set(text, out);
  return out;
}
