// Automation triggers and actions, shared by the Automations page and the runner (lib/automations/run.ts).
// A workflow stores trigger { key, value, label } and actions [{ key, label, message }]. The database queues runs for
// event triggers (supabase/migrations/20261025000100_workflow_completion.sql); publish_soon is checked on every tick.

export type Choice = [string, string];

export type TriggerDef = { key: string; label: string; values?: Choice[] | 'statuses'; valueLabel?: string };
export type ActionDef = { key: string; label: string; app: string; needs?: 'slack' | 'n8n' | 'buffer'; message?: string };

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
];

export const ACTIONS: ActionDef[] = [
  { key: 'slack_admin', label: 'Notify Super Admin in Slack', app: 'Slack', needs: 'slack', message: 'Slack message' },
  { key: 'email_editor', label: 'Email the assigned editor', app: 'Email', message: 'Email note' },
  { key: 'email_designer', label: 'Email the assigned designer', app: 'Email', message: 'Email note' },
  { key: 'status_next', label: 'Move Status to the next step', app: 'Board' },
  { key: 'todo_admin', label: 'Create a To-Do for Super Admin', app: 'In-app', message: 'To-Do text' },
  { key: 'webhook_n8n', label: 'Send a webhook to n8n', app: 'n8n', needs: 'n8n' },
  // Posts the project's Social post (caption, cut, chosen Buffer channels); see lib/integrations/buffer-publish.ts.
  { key: 'buffer_publish', label: 'Publish to Buffer', app: 'Buffer', needs: 'buffer' },
];

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
