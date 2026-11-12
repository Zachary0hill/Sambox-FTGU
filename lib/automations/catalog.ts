// Automation triggers and actions, shared by the Automations page and the runner (lib/automations/run.ts).
// A workflow stores trigger { key, value, label } and actions [{ key, label, message }]. The database queues runs for
// event triggers (supabase/migrations/20261025000100_workflow_completion.sql); publish_soon is checked on every tick.
// Idea triggers (scope 'idea') are queued by supabase/migrations/20261111010000_idea_automations.sql and run on the
// idea, not a project. An action's scope says which triggers it fits: 'project', 'idea' or 'any' (both).

export type Choice = [string, string];

export type Scope = 'project' | 'idea' | 'any';
export type TriggerDef = { key: string; label: string; values?: Choice[] | 'statuses'; valueLabel?: string; scope?: 'project' | 'idea' };
export type ActionDef = { key: string; label: string; app: string; needs?: 'slack' | 'n8n' | 'buffer'; message?: string; scope?: Scope };

export const TRIGGERS: TriggerDef[] = [
  { key: 'status', label: 'Status becomes', values: 'statuses', valueLabel: 'Status' },
  { key: 'edit_status', label: 'Editor Status becomes', valueLabel: 'Editor Status',
    values: [['assigned', 'Assigned'], ['editing', 'Editing'], ['in_review', 'In Review'], ['needs_revision', 'Needs Revision'], ['approved', 'Approved']] },
  { key: 'thumb_status', label: 'Thumbnail becomes', valueLabel: 'Thumbnail',
    values: [['not_started', 'Not Started'], ['in_design', 'In Design'], ['in_review', 'In Review'], ['needs_revision', 'Needs Revision'], ['done', 'Done']] },
  { key: 'approval', label: 'Sponsor Approval becomes', valueLabel: 'Approval',
    values: [['pending', 'Pending'], ['approved', 'Approved'], ['changes_requested', 'Changes Requested']] },
  { key: 'mention_admin', label: 'A comment mentions a Super Admin' },
  { key: 'publish_soon', label: 'Publishing date is', valueLabel: 'Days before',
    values: [['1', '1 day away'], ['2', '2 days away'], ['3', '3 days away'], ['7', '7 days away']] },
  // Ideas & Research
  { key: 'idea_created', label: 'An idea is captured', scope: 'idea' },
  { key: 'idea_stage', label: 'An idea moves to', valueLabel: 'Stage', scope: 'idea',
    values: [['inbox', 'Inbox'], ['research', 'Research'], ['ready', 'Ready'], ['approved', 'Approved']] },
  { key: 'idea_scored', label: 'Research scores an idea', valueLabel: 'Score', scope: 'idea',
    values: [['60', '60 or more'], ['70', '70 or more'], ['80', '80 or more'], ['90', '90 or more']] },
  { key: 'idea_stale', label: 'An idea has not changed for', valueLabel: 'Days', scope: 'idea',
    values: [['7', '7 days'], ['14', '14 days'], ['30', '30 days']] },
];

export const ACTIONS: ActionDef[] = [
  { key: 'slack_admin', label: 'Notify Super Admin in Slack', app: 'Slack', needs: 'slack', message: 'Slack message', scope: 'any' },
  { key: 'email_editor', label: 'Email the assigned editor', app: 'Email', message: 'Email note' },
  { key: 'email_designer', label: 'Email the assigned designer', app: 'Email', message: 'Email note' },
  { key: 'status_next', label: 'Move Status to the next step', app: 'Board' },
  { key: 'todo_admin', label: 'Create a To-Do for Super Admin', app: 'In-app', message: 'To-Do text', scope: 'any' },
  { key: 'webhook_n8n', label: 'Send a webhook to n8n', app: 'n8n', needs: 'n8n', scope: 'any' },
  // Posts the project's Social post (caption, cut, chosen Buffer channels); see lib/integrations/buffer-publish.ts.
  { key: 'buffer_publish', label: 'Publish to Buffer', app: 'Buffer', needs: 'buffer' },
  // Ideas & Research
  { key: 'idea_research', label: 'Run research on the idea', app: 'Research', scope: 'idea' },
  { key: 'idea_stage_next', label: 'Move the idea to the next stage', app: 'Ideas', scope: 'idea' },
  { key: 'idea_email_owner', label: 'Email the idea owner', app: 'Email', message: 'Email note', scope: 'idea' },
  { key: 'idea_todo_owner', label: 'Create a To-Do for the idea owner', app: 'In-app', message: 'To-Do text', scope: 'idea' },
];

// Which side a trigger runs on, and the actions that fit it.
export const scopeOf = (triggerKey: string): 'project' | 'idea' => (triggerById(triggerKey)?.scope === 'idea' ? 'idea' : 'project');
export const fits = (a: ActionDef, scope: 'project' | 'idea') => (a.scope || 'project') === scope || a.scope === 'any';
// Idea triggers list the idea actions first; project triggers keep the original order (Slack stays the default).
export const actionsFor = (triggerKey: string) => {
  const scope = scopeOf(triggerKey);
  const list = ACTIONS.filter((a) => fits(a, scope));
  return scope === 'idea' ? list.filter((a) => a.scope === 'idea').concat(list.filter((a) => a.scope !== 'idea')) : list;
};
export const projectTriggers = () => TRIGGERS.filter((t) => t.scope !== 'idea');
export const ideaTriggers = () => TRIGGERS.filter((t) => t.scope === 'idea');

export const triggerById = (k: string) => TRIGGERS.find((t) => t.key === k);
export const actionById = (k: string) => ACTIONS.find((a) => a.key === k);

// "Status becomes Filming", "Publishing date is 3 days away".
export function triggerText(key: string, value: string | null | undefined, statusLabel?: (v: string) => string) {
  const t = triggerById(key);
  if (!t) return key;
  if (!t.values || !value) return t.label;
  const shown = t.values === 'statuses' ? (statusLabel ? statusLabel(value) : value) : (t.values.find((v) => v[0] === value) || [value, value])[1];
  return t.label + ' ' + shown;
}

// Saved workflows from before structured triggers keep only labels.
export function triggerOf(raw: { key?: string; value?: string; label?: string } | null | undefined) {
  const r = raw || {};
  if (r.key) return { key: r.key, value: r.value || '' };
  const legacy: Record<string, [string, string]> = {
    'Status becomes Filming': ['status', 'Filming'], 'Editor Status becomes Needs Revision': ['edit_status', 'needs_revision'],
    'Thumbnail becomes In Review': ['thumb_status', 'in_review'], 'Sponsor Approval becomes Approved': ['approval', 'approved'],
    'A comment mentions Super Admin': ['mention_admin', ''], 'Publishing date is 3 days away': ['publish_soon', '3'],
  };
  const hit = legacy[r.label || ''];
  return hit ? { key: hit[0], value: hit[1] } : { key: '', value: '' };
}

export function actionsOf(raw: unknown): { key: string; message: string }[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((a) => {
    const x = (a || {}) as { key?: string; label?: string; message?: string };
    const key = x.key || (ACTIONS.find((d) => d.label === x.label) || { key: '' }).key;
    return { key, message: x.message || '' };
  }).filter((a) => !!a.key);
}
