// Stage gates: what an idea needs before it moves forward. The page uses this for the live checklist and early messages;
// app.idea_gate_missing in the database is what enforces it, and uses the same labels.
import { GATED_STAGES, REQUIRED_FIELDS, type IdeasRules } from './rules-shared';

type GateIdea = { body?: string[]; refs?: string[]; findings?: unknown[]; coverPath?: string; ice?: (number | null)[]; research?: { sources?: unknown[]; score: { total: number } | null } | null };
type GateRules = Pick<IdeasRules, 'required_fields_by_stage' | 'recommendation'>;

const ORDER = ['Inbox', 'Research', 'Ready', 'Approved'];

const passes: Record<string, (i: GateIdea, r: GateRules) => boolean> = {
  notes: (i) => (i.body || []).some((p) => String(p).trim() !== ''),
  source: (i) => (i.refs || []).length > 0 || (i.findings || []).length > 0 || (i.research?.sources || []).length > 0,
  cover: (i) => !!i.coverPath,
  score: (i, r) => {
    if (i.research?.score) return i.research.score.total >= r.recommendation.pursue;
    const ice = i.ice || [];
    if (ice.length < 3 || ice.some((n) => n == null)) return false;
    return (Number(ice[0]) + Number(ice[1]) + Number(ice[2])) / 3 * 10 >= r.recommendation.pursue;
  },
  research: (i) => !!i.research,
  pursue: (i, r) => !!i.research?.score && i.research.score.total >= r.recommendation.pursue,
};

// Each item the stage requires, ticked or not, for the readiness checklist.
export function gateChecklist(idea: GateIdea, stage: (typeof GATED_STAGES)[number], rules: GateRules) {
  return rules.required_fields_by_stage[stage].map((key) => ({
    label: REQUIRED_FIELDS.find((f) => f.key === key)?.label || key,
    on: passes[key] ? passes[key](idea, rules) : true,
  }));
}

const missing = (idea: GateIdea, stage: (typeof GATED_STAGES)[number], rules: GateRules) =>
  gateChecklist(idea, stage, rules).filter((c) => !c.on).map((c) => c.label);

// Why the idea cannot move between these stages, or '' when it can. Stages are the page's labels.
export function stageBlocker(idea: GateIdea, from: string, to: string, rules: GateRules): string {
  const a = ORDER.indexOf(from), b = ORDER.indexOf(to);
  if (a < 0 || b < 0 || b <= a) return '';
  if (a < 1 && b >= 1) {
    const need = missing(idea, 'research', rules);
    if (need.length) return "Can't move to Research yet. Still needed: " + need.join(', ') + '.';
  }
  if (b >= 2) {
    const need = missing(idea, 'ready', rules);
    if (need.length) return (b === 3 ? "Can't approve yet" : "Can't move to Ready yet") + '. Still needed: ' + need.join(', ') + '.';
  }
  return '';
}
