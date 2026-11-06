// Script beats on an idea. The saved script (ideas.script: {beats: [{time, label, text}], source, model, updatedAt})
// wins; ideas written before it existed read their beats out of the body paragraphs: "0:20 The problem: text",
// "Cold open: text", or a plain paragraph. Used by the Ideas page (Script tab) and the project modal (Script card).

const isUrl = (r) => /^https?:\/\//i.test(String(r || '').trim());

export const beatsOfBody = (body) => (body || []).map((p, n) => {
  let m = p.match(/^(\d{1,2}:\d{2})\s+([^:]{1,48}?)\s*[:–—-]\s+([\s\S]+)$/);
  if (m) return { time: m[1], label: m[2], text: m[3] };
  m = p.match(/^([^:\n]{2,40}):\s+([\s\S]+)$/);
  if (m && !isUrl(p)) return { time: '', label: m[1], text: m[2] };
  return { time: '', label: 'Beat ' + (n + 1), text: p };
});

export const cleanBeat = (b, n) => ({
  time: String((b && b.time) || '').trim().slice(0, 8),
  label: String((b && b.label) || '').trim().slice(0, 80) || 'Beat ' + (n + 1),
  text: String((b && b.text) || '').trim().slice(0, 6000),
});

export const hasSavedScript = (i) => !!(i && i.script && Array.isArray(i.script.beats) && i.script.beats.length);

// Beats to show for an idea: the saved script, else the legacy read of the body.
export const scriptBeats = (i) => (hasSavedScript(i) ? i.script.beats.map(cleanBeat) : beatsOfBody(i && i.body));

// Rough spoken length at ~150 words a minute, as "m:ss".
export const readTime = (beats) => {
  const words = (beats || []).reduce((n, b) => n + String(b.text || '').split(/\s+/).filter(Boolean).length, 0);
  if (!words) return '';
  const s = Math.round(words / 2.5);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
