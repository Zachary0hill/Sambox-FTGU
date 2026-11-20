// Job numbers are named after the client and the content type: CMP-RLS1, POD-LF3.
// app.job_abbrev and app.next_job_code (supabase/migrations/20261120000300_smart_job_codes.sql) are the same
// rules in the database, where approved ideas get their number. Change both together.

// 'Completeful' -> CMP, 'POD HUT' -> POD, 'JohnXSantos' -> JXS, 'Completeful Brand' -> CB.
export function jobAbbrev(name) {
  let words = String(name || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').replace(/[^A-Za-z0-9]+/g, ' ').trim().toUpperCase().split(' ');
  if (!words[0]) return '';
  if (words.length > 1 && words[0] === 'THE') words = words.slice(1);
  const w = words[0];
  if (words.length > 1) {
    // A short first word is already the name people say; otherwise use the initials.
    if (w.length >= 2 && w.length <= 3) return w;
    return words.slice(0, 4).map((x) => x[0]).join('');
  }
  if (w.length <= 4) return w;
  const short = (w[0] + w.slice(1).replace(/[AEIOU]/g, '')).slice(0, 3);
  return short.length < 3 ? w.slice(0, 3) : short;
}

const TYPE_TAG = { shortform: 'RLS', youtube_video: 'LF', youtube_live: 'LIVE' };

// Next free number for a client and content type. type is a content_types row ({ key, label }) or null.
export function smartJob(owner, type, codes) {
  const base = (jobAbbrev(owner) || 'GEN') + '-' + ((type && TYPE_TAG[type.key]) || jobAbbrev(type && type.label) || 'PJ');
  let n = 0;
  (codes || []).forEach((c) => {
    const code = String(c || '').toUpperCase();
    if (code.startsWith(base) && /^\d{1,6}$/.test(code.slice(base.length))) n = Math.max(n, Number(code.slice(base.length)));
  });
  return base + (n + 1);
}
