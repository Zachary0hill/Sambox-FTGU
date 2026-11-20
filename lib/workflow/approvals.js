// Approvals waiting on a Super Admin (the data contract's Approval). There is no table of their own: an approval
// step parks its run (lib/automations/run.ts), so a waiting approval is a run with status "retry" whose output holds
// the pending approval. Its id is the run's id. Oldest first, so the queue is worked in order.
export const approvalOf = (r) => (r && r.status === 'retry' && r.output && r.output.waiting && r.output.approval ? r.output.approval : null);

export function approvalsOf(D) {
  const names = {};
  (D.automations || []).forEach((a) => { names[a.id] = a.name; });
  return (D.automationRuns || []).filter((r) => !r.is_test && approvalOf(r)).map((r) => {
    const a = approvalOf(r);
    return {
      id: r.id, runId: r.id, workflowId: r.automation_id, workflow: names[r.automation_id] || 'Deleted workflow', stepId: a.stepId,
      title: (a.draft && a.draft.subject) || a.title, draft: a.draft || null, context: a.context || [], reason: a.reason || '', after: a.after || '',
      waitingSince: a.askedAt, expiresAt: a.expiresAt || null,
    };
  }).sort((x, y) => new Date(x.waitingSince) - new Date(y.waitingSince));
}

// "8 min", "3 hours", "2 days": how long between two instants.
export function span(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return 'under a minute';
  if (m < 60) return m + ' min';
  const h = Math.round(m / 60);
  if (h < 48) return h + (h === 1 ? ' hour' : ' hours');
  const d = Math.round(h / 24);
  return d + ' days';
}
