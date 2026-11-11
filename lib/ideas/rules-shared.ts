// Ideas & Research Rules: one row per workspace in ideas_rules (jsonb `rules`). Shared by the page, the API route and
// the server jobs, with no imports so tests can load it directly. Each group is added by the phase that first reads it.

export const COVER_HIGHLIGHTS = [
  ['#FFE14D', 'Yellow highlight'],
  ['#FFFFFF', 'White highlight'],
  ['#16FFDE', 'Mint highlight'],
  ['none', 'No highlight'],
] as const;
export const HOOK_POSITIONS = ['bottom', 'center', 'top'] as const;
export const GATED_STAGES = ['research', 'ready'] as const;
// The labels must match app.idea_gate_missing in the database.
export const REQUIRED_FIELDS = [
  { key: 'notes', label: 'Notes written' },
  { key: 'source', label: 'At least one source' },
  { key: 'cover', label: 'Cover image set' },
  { key: 'score', label: 'Score at the Pursue threshold' },
  { key: 'research', label: 'Research finished' },
  { key: 'pursue', label: 'Research says Pursue' },
] as const;
export const CONVERT_TARGETS = [
  { key: 'project', label: 'Project', help: 'A production project with the brief and cover copied in.' },
  { key: 'task', label: 'Task', help: "A task for the idea's owner." },
  { key: 'social', label: 'Social post', help: 'A scheduled card on the Content page with the notes and cover.' },
] as const;

const LIST_ITEM_MAX = 60;
const LIST_MAX = 30;
const LIST_GROUPS = [
  ['allowed_types', 'Idea types', 1],
  ['formats', 'Formats', 0],
  ['platforms', 'Platforms', 0],
  ['pillars', 'Pillars', 0],
] as const;

export type IdeasRules = {
  allowed_types: string[];
  formats: string[];
  platforms: string[];
  pillars: string[];
  recommendation: { pursue: number; park: number };
  cover: { highlight: string; hook_position: (typeof HOOK_POSITIONS)[number] };
  required_fields_by_stage: Record<(typeof GATED_STAGES)[number], string[]>;
  conversion_targets: string[];
  scoring: { key: string; label: string; weight: number }[];
  research_brief: string;
  max_sources: number;
  auto_research: boolean;
  // Set by the server when auto research is switched on, so only ideas captured from then on are queued.
  auto_research_since: string | null;
  designers_can_research: boolean;
  run_cost_cap_usd: number;
  daily_cost_cap_usd: number;
};

export const DEFAULT_IDEAS_RULES: IdeasRules = {
  allowed_types: ['Idea', 'Script', 'Research'],
  formats: ['Long-form', 'Short', 'Reel', 'Livestream', 'Podcast clip'],
  platforms: ['YouTube', 'Shorts', 'TikTok', 'Instagram', 'Facebook'],
  pillars: ['Education', 'Behind the scenes', 'Product', 'Story', 'Trend'],
  recommendation: { pursue: 70, park: 45 },
  cover: { highlight: '#FFE14D', hook_position: 'bottom' },
  required_fields_by_stage: { research: [], ready: ['notes'] },
  conversion_targets: ['project', 'task', 'social'],
  scoring: [
    { key: 'audience_demand', label: 'Audience demand', weight: 5 },
    { key: 'hook_strength', label: 'Hook strength', weight: 4 },
    { key: 'brand_fit', label: 'Brand fit', weight: 4 },
    { key: 'production_ease', label: 'Production ease', weight: 3 },
    { key: 'sponsor_fit', label: 'Sponsor fit', weight: 2 },
  ],
  research_brief: [
    '{title} {type} YouTube',
    'Research this {type} idea for {brand}, a YouTube and short-form channel: who watches it, what top videos on the topic already do, view counts and outliers, hook angles, and what a stronger version needs.',
    'Team notes: {notes}',
  ].join('\n'),
  max_sources: 6,
  auto_research: false,
  auto_research_since: null,
  designers_can_research: false,
  run_cost_cap_usd: 0.5,
  daily_cost_cap_usd: 5,
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const defaults = () => JSON.parse(JSON.stringify(DEFAULT_IDEAS_RULES)) as IdeasRules;
const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;

// Trims, drops blanks and removes repeats, keeping the order the operator typed.
function cleanList(list: unknown[]): string[] {
  const seen = new Set<string>();
  return list.map((x) => String(x).trim()).filter((x) => {
    const key = x.toLowerCase();
    if (!x || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Strict check for a save. Missing groups keep their defaults, and every problem is returned in plain words.
export function validateIdeasRules(input: unknown): { ok: true; rules: IdeasRules } | { ok: false; errors: string[] } {
  if (!isObj(input)) return { ok: false, errors: ['Rules must be an object.'] };
  const errors: string[] = [];
  const out = defaults();

  for (const [key, label, min] of LIST_GROUPS) {
    if (input[key] === undefined) continue;
    if (!Array.isArray(input[key])) { errors.push(label + ' must be a list.'); continue; }
    const list = cleanList(input[key] as unknown[]);
    const long = list.find((x) => x.length > LIST_ITEM_MAX);
    if (list.length < min) errors.push('Add at least one entry to ' + label + '.');
    else if (list.length > LIST_MAX) errors.push(label + ' can have up to ' + LIST_MAX + ' entries.');
    else if (long) errors.push('"' + long.slice(0, 30) + '…" in ' + label + ' is longer than ' + LIST_ITEM_MAX + ' characters.');
    else out[key] = list;
  }

  if (input.recommendation !== undefined) {
    const r = input.recommendation;
    if (!isObj(r) || !isScore(r.pursue) || !isScore(r.park)) errors.push('Score thresholds must be whole numbers from 0 to 100.');
    else if (r.pursue <= r.park) errors.push('The Pursue score must be higher than the Park score.');
    else out.recommendation = { pursue: r.pursue, park: r.park };
  }

  if (input.cover !== undefined) {
    const c = input.cover;
    const highlight = isObj(c) ? COVER_HIGHLIGHTS.find((h) => h[0] === c.highlight) : undefined;
    const position = isObj(c) ? HOOK_POSITIONS.find((p) => p === c.hook_position) : undefined;
    if (!highlight || !position) errors.push('Choose a cover highlight and a hook position from the list.');
    else out.cover = { highlight: highlight[0], hook_position: position };
  }

  if (input.required_fields_by_stage !== undefined) {
    const r = input.required_fields_by_stage;
    const known: string[] = REQUIRED_FIELDS.map((f) => f.key);
    const lists = isObj(r) ? GATED_STAGES.map((s) => r[s]) : [];
    if (lists.length !== GATED_STAGES.length || !lists.every((l) => Array.isArray(l) && l.every((f) => known.includes(String(f))))) {
      errors.push('Choose stage requirements from the list.');
    } else {
      GATED_STAGES.forEach((s, n) => { out.required_fields_by_stage[s] = known.filter((f) => (lists[n] as unknown[]).includes(f)); });
    }
  }

  if (input.conversion_targets !== undefined) {
    const t = input.conversion_targets;
    const known: string[] = CONVERT_TARGETS.map((x) => x.key);
    if (!Array.isArray(t) || !t.every((x) => known.includes(String(x)))) errors.push('Choose approval targets from the list.');
    else if (!t.length) errors.push('Keep at least one approval target.');
    else out.conversion_targets = known.filter((x) => t.includes(x));
  }

  if (input.scoring !== undefined) {
    const list = Array.isArray(input.scoring) ? input.scoring.filter(isObj) : [];
    const rows = list.map((c) => ({ key: String(c.label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), label: String(c.label || '').trim(), weight: c.weight as number }));
    const bad = rows.find((c) => !c.label || c.label.length > LIST_ITEM_MAX || !c.key || !Number.isInteger(c.weight) || c.weight < 0 || c.weight > 5);
    if (!rows.length || rows.length !== (input.scoring as unknown[]).length) errors.push('Add at least one scoring criterion.');
    else if (rows.length > 10) errors.push('Scoring can have up to 10 criteria.');
    else if (bad) errors.push('Each scoring line needs a name and a whole-number weight from 0 to 5, like "Brand fit: 4".');
    else if (new Set(rows.map((c) => c.key)).size !== rows.length) errors.push('Each scoring criterion needs its own name.');
    else out.scoring = rows;
  }

  if (input.research_brief !== undefined) {
    const b = typeof input.research_brief === 'string' ? input.research_brief.trim() : '';
    if (!b.includes('{title}')) errors.push('The research brief must include {title} so each run searches for its own idea.');
    else if (b.length > 4000) errors.push('The research brief can be up to 4000 characters.');
    else out.research_brief = b;
  }

  if (input.max_sources !== undefined) {
    const v = input.max_sources;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 10) errors.push('Max sources must be a whole number from 1 to 10.');
    else out.max_sources = v;
  }

  for (const key of ['auto_research', 'designers_can_research'] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'boolean') errors.push('Research switches must be on or off.');
    else out[key] = input[key] as boolean;
  }
  if (typeof input.auto_research_since === 'string' && !Number.isNaN(Date.parse(input.auto_research_since))) out.auto_research_since = input.auto_research_since;

  for (const [key, max, label] of [['run_cost_cap_usd', 20, 'The per-run limit'], ['daily_cost_cap_usd', 500, 'The daily limit']] as const) {
    if (input[key] === undefined) continue;
    const v = input[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > max) errors.push(label + ' must be a dollar amount above 0 and up to ' + max + '.');
    else out[key] = v;
  }
  if (input.run_cost_cap_usd !== undefined && input.daily_cost_cap_usd !== undefined && out.run_cost_cap_usd > out.daily_cost_cap_usd) errors.push('The per-run limit cannot be higher than the daily limit.');

  return errors.length ? { ok: false, errors } : { ok: true, rules: out };
}

// Lenient read: a stored value that no longer validates falls back on its own, so a bad row never breaks the page.
export function normalizeIdeasRules(input: unknown): IdeasRules {
  const out = defaults();
  if (!isObj(input)) return out;
  for (const key of Object.keys(out) as (keyof IdeasRules)[]) {
    if (input[key] === undefined) continue;
    const one = validateIdeasRules({ [key]: input[key] });
    if (one.ok) (out as Record<string, unknown>)[key] = one.rules[key];
  }
  return out;
}
