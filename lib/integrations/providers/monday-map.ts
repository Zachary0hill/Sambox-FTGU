// Pure mapping between monday status labels and the board's project statuses. No I/O, so it can be tested alone.

export type Pair = { monday: string; board: string };
export type Label = { id: number | string; label: string };
export type Status = { id: string; label: string };

const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// "Working on it=Editing, Done=Live" (commas or new lines) -> pairs. Entries without both sides are dropped.
export function parseStatusMap(raw: unknown): Pair[] {
  if (typeof raw !== 'string') return [];
  return raw.split(/[,\n]/).map((s) => {
    const i = s.indexOf('=');
    return i < 0 ? null : { monday: s.slice(0, i).trim(), board: s.slice(i + 1).trim() };
  }).filter((p): p is Pair => !!p && !!p.monday && !!p.board);
}

// Status column labels from `columns { settings }`. Current API versions return { labels: [{ id, label }] };
// the older settings_str shape was { labels: { "0": "Working on it" } }. Accepts either, or a JSON string of either.
export function statusLabels(settings: unknown): Label[] {
  let s = settings;
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch { return []; } }
  const labels = s && typeof s === 'object' ? (s as { labels?: unknown }).labels : null;
  if (Array.isArray(labels)) {
    return labels.filter((l) => l && typeof l.label === 'string' && l.label.trim()).map((l) => ({ id: l.id, label: l.label }));
  }
  if (labels && typeof labels === 'object') {
    return Object.entries(labels as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => ({ id: k, label: v as string }));
  }
  return [];
}

// monday label -> board status. The mapping wins, then a case-insensitive match on the status label. Null when
// nothing matches; callers report it instead of guessing.
export function toBoardStatus(mondayLabel: string, pairs: Pair[], statuses: Status[]): Status | null {
  const pair = pairs.find((p) => eq(p.monday, mondayLabel));
  const want = pair ? pair.board : mondayLabel;
  return statuses.find((s) => eq(s.label, want)) || null;
}

// Board status -> monday label, the reverse of toBoardStatus. With several monday labels mapped to one status, the
// first pair wins.
export function toMondayLabel(boardLabel: string, pairs: Pair[], labels: Label[]): Label | null {
  const pair = pairs.find((p) => eq(p.board, boardLabel));
  const want = pair ? pair.monday : boardLabel;
  return labels.find((l) => eq(l.label, want)) || null;
}

export type Item = { id: string; name: string; status: string; job: string };
export type Project = { id: string; title: string; job_code: string; status_id: string; monday_item_id: string | null };
export type Plan =
  | { kind: 'create'; item: Item; status: Status; jobCode: string; unmatched: boolean }
  | { kind: 'link'; item: Item; project: Project; patch: Record<string, string>; diff: Record<string, { from: string; to: string }> }
  | { kind: 'update'; item: Item; project: Project; patch: Record<string, string>; diff: Record<string, { from: string; to: string }> }
  | { kind: 'same'; item: Item; project: Project };

// What to do with one monday item. Linked projects match on monday_item_id; an unlinked project with the same job
// number as the item's job column is adopted; anything else becomes a new project.
export function planItem(
  item: Item, byItem: Map<string, Project>, byJob: Map<string, Project>, pairs: Pair[], statuses: Status[],
): { plan: Plan; unmatched: string | null } {
  const target = item.status ? toBoardStatus(item.status, pairs, statuses) : null;
  const unmatched = item.status && !target ? item.status : null;
  const linked = byItem.get(item.id);
  const adopt = !linked && item.job ? byJob.get(item.job.toLowerCase()) : undefined;
  const project = linked || (adopt && !adopt.monday_item_id ? adopt : undefined);
  if (!project) {
    const taken = item.job && byJob.has(item.job.toLowerCase());
    const jobCode = item.job && !taken ? item.job : 'MON-' + item.id;
    return { plan: { kind: 'create', item, status: target || statuses[0], jobCode, unmatched: !target }, unmatched };
  }
  const patch: Record<string, string> = {};
  const diff: Record<string, { from: string; to: string }> = {};
  const name = item.name.trim();
  if (name && name !== project.title) { patch.title = name; diff.title = { from: project.title, to: name }; }
  if (target && target.id !== project.status_id) {
    patch.status_id = target.id;
    diff.status = { from: (statuses.find((s) => s.id === project.status_id) || { label: '' }).label, to: target.label };
  }
  if (!linked) { patch.monday_item_id = item.id; return { plan: { kind: 'link', item, project, patch, diff }, unmatched }; }
  return { plan: Object.keys(patch).length ? { kind: 'update', item, project, patch, diff } : { kind: 'same', item, project }, unmatched };
}
