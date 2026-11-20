// Workflow builder copy for SantosStudios (handoff HANDOFF.md, Rule 6): the agent's name, the status words, the step
// library, the trigger list and the templates. Feature code reads words from here so the same screens can ship in the
// other two apps with a different copy file.

import { scheduleText } from '../automations/schedule';

export const AGENT = 'Studio Assistant';
export const AGENT_SHORT = 'Assistant';

// Stored status → the word on screen.
export const STATUS = { live: 'Live', off: 'Off', draft: 'Draft' };
export const RUN_STATUS = { passed: 'Passed', failed: 'Failed', retry: 'Retrying', running: 'Running', waiting: 'Waiting', skipped: 'Skipped' };
export const CONNECTOR_STATUS = { connected: 'Connected', not_connected: 'Not connected', expired: 'Sign-in expired' };

// Step kind → the label in a card's eyebrow ("Step 2 · Logic").
export const KIND_LABEL = { trigger: 'Trigger', data: 'Board', action: 'Action', logic: 'Logic', ai: AGENT_SHORT, human: 'Approval' };

export const HUB = {
  desc: 'Workflows first. Templates, run history, approvals and connectors live in their own tabs.',
  tabs: { workflows: 'Workflows', templates: 'Templates', runs: 'Run history', approvals: 'Approvals', connectors: 'Connectors', settings: 'Settings' },
  filters: { all: 'All', live: 'Live', off: 'Off', draft: 'Draft', assistant: 'From ' + AGENT_SHORT },
  search: 'Search workflows',
  none: 'No workflows match. Clear the search or pick another status.',
  clear: 'Clear filters',
  noWorkflows: 'No workflows yet. Start from a template below, or build one with New flow.',
  templatesTitle: 'Start from a template',
  templatesSub: 'Each template starts as a draft. Check the steps, run a test, then turn it on.',
  setUp: 'Set up', use: 'Use',
  noApprovals: 'Nothing waiting. Approvals show here when a workflow pauses for sign off.',
  noRuns: 'No runs yet. A run appears here when a live workflow’s trigger happens, or when you test a workflow.',
  connectorsNote: 'Apps your automations sign in to. Open one to test it, see what uses it, or fix a sign-in.',
  manageConnectors: 'Manage connectors',
  paused: 'All automations are paused. Nothing runs until you resume.',
};

// Trigger list: the title and one line shown in the step library and trigger setup.
export const TRIGGER_COPY = {
  status: ['Status changes', 'A project reaches a stage'],
  edit_status: ['Editor Status changes', 'An edit is in review or needs changes'],
  thumb_status: ['Thumbnail changes', 'A thumbnail moves along'],
  approval: ['Sponsor Approval changes', 'A sponsor approves or asks for changes'],
  mention_admin: ['A comment mentions a Super Admin', 'A comment asks a Super Admin for help'],
  publish_soon: ['Publishing date is coming up', 'Remind people before a video goes out'],
  schedule: ['On a schedule', 'Runs at set times, with no project'],
  webhook: ['A request arrives', 'Another system calls this workflow’s address'],
  idea_created: ['An idea is captured', 'A new idea lands in Ideas & Research'],
  idea_stage: ['An idea changes stage', 'An idea moves to Research, Ready or Approved'],
  idea_scored: ['Research scores an idea', 'An idea reaches a score'],
  idea_stale: ['An idea goes quiet', 'An idea has not changed for a while'],
};

// The short name on a preview chip. Schedules and values read as plain words, never a rule or a path.
export function triggerChip(key, value) {
  const v = String(value || '');
  if (!key) return 'Pick a trigger';
  if (key === 'status') return v ? v : 'Status changes';
  if (key === 'edit_status') return { needs_revision: 'Edit needs changes', in_review: 'Edit in review', approved: 'Edit approved', editing: 'Editing starts', assigned: 'Editor assigned' }[v] || 'Editor status';
  if (key === 'thumb_status') return { in_review: 'Thumbnail ready', needs_revision: 'Thumbnail needs changes', done: 'Thumbnail done', in_design: 'Thumbnail in design' }[v] || 'Thumbnail status';
  if (key === 'approval') return { approved: 'Sponsor approved', changes_requested: 'Sponsor asks for changes', pending: 'Sponsor approval' }[v] || 'Sponsor approval';
  if (key === 'mention_admin') return 'Super Admin mention';
  if (key === 'schedule') return scheduleText(v);
  if (key === 'webhook') return 'Webhook request';
  if (key === 'publish_soon') return v ? 'Publish in ' + v + (v === '1' ? ' day' : ' days') : 'Publish date soon';
  if (key === 'idea_created') return 'Idea captured';
  if (key === 'idea_stage') return v ? 'Idea to ' + v.charAt(0).toUpperCase() + v.slice(1) : 'Idea changes stage';
  if (key === 'idea_scored') return v ? 'Idea scores ' + v + '+' : 'Idea scored';
  if (key === 'idea_stale') return v ? 'Idea quiet ' + v + ' days' : 'Idea goes quiet';
  return 'Trigger';
}

// Step library: the action ids behind each entry stay the catalog keys (lib/automations/catalog.ts).
export const STEP_COPY = {
  slack_admin: { kind: 'action', title: 'Notify Super Admin in Slack', chip: 'Slack Super Admin', desc: 'Post a message to the admin channel' },
  email_editor: { kind: 'action', title: 'Email the assigned editor', chip: 'Email the editor', desc: 'Send the editor a note about the project' },
  email_designer: { kind: 'action', title: 'Email the assigned designer', chip: 'Email the designer', desc: 'Send the designer a note about the project' },
  status_next: { kind: 'data', title: 'Move Status to the next step', chip: 'Move to next stage', desc: 'Advance the project one stage on the board' },
  todo_admin: { kind: 'action', title: 'Create a To-Do for Super Admin', chip: 'Add to Inbox', desc: 'Drop a To-Do in the Super Admin Inbox' },
  webhook_n8n: { kind: 'action', title: 'Send a webhook to n8n', chip: 'Send to n8n', desc: 'Hand the project to an n8n workflow' },
  buffer_publish: { kind: 'action', title: 'Publish to Buffer', chip: 'Publish to Buffer', desc: 'Send the project’s social post to Buffer', outward: true },
  idea_research: { kind: 'ai', title: 'Run research on the idea', chip: 'Research the idea', desc: 'Score the idea and gather sources' },
  idea_stage_next: { kind: 'data', title: 'Move the idea to the next stage', chip: 'Advance the idea', desc: 'Move the idea one stage forward' },
  idea_email_owner: { kind: 'action', title: 'Email the idea owner', chip: 'Email the owner', desc: 'Send the owner a note about the idea' },
  idea_todo_owner: { kind: 'action', title: 'Create a To-Do for the idea owner', chip: 'To-Do for owner', desc: 'Drop a To-Do in the owner’s Inbox' },
};
export const NODE_COPY = {
  delay: { kind: 'logic', title: 'Wait', desc: 'Wait before the next step' },
  split: { kind: 'logic', title: 'Branch', desc: 'Send work down the Yes or No path' },
  task: { kind: 'human', title: 'Task', desc: 'A To-Do for someone on the team', label: 'Task' },
  note: { kind: 'human', title: 'Note', desc: 'A note on the map; never runs', label: 'Note' },
  data: { kind: 'data', title: 'Get project', desc: 'Title, stage, owner, sponsor and comments' },
  ai: { kind: 'ai', title: 'Ask ' + AGENT, desc: AGENT + ' writes or summarizes from the data above' },
  approval: { kind: 'human', title: 'Approval', desc: 'Pause until a Super Admin approves' },
};

// Data tokens a message can carry, by the name shown on its chip (the stored token never shows).
export const VAR_LABEL = {
  'project.title': 'Project title', 'project.job': 'Job number', 'project.status': 'Project stage', 'project.channel': 'Channel',
  'project.publish_date': 'Publishing date', 'project.link': 'Project link', 'project.sponsor': 'Sponsor', 'project.editor': 'Editor name',
  'project.designer': 'Designer name', trigger: 'What happened', 'flow.name': 'Workflow name', 'workspace.name': 'Workspace',
  'idea.title': 'Idea title', 'idea.stage': 'Idea stage', 'idea.score': 'Idea score', 'idea.link': 'Idea link',
};

// Templates. `steps` is the stored graph a draft starts from (lib/automations/graph.ts); the preview and the
// "Needs" line are derived from it. `n` builds a node; ids are assigned when the template is used.
const act = (key, message) => ({ type: 'action', key, message: message || '' });
export const TEMPLATES = [
  {
    id: 'sponsor-follow-up', name: 'Sponsor follow-up', category: 'sponsor',
    desc: 'When a sponsor asks for changes, ' + AGENT + ' drafts a reply with the notes. You approve it before it sends.',
    trigger: { key: 'approval', value: 'changes_requested' }, chip: 'Sponsor approval',
    steps: [{ type: 'ai', title: 'Draft reply', note: 'Reply to the sponsor with the notes addressed' }, { type: 'approval', title: 'Approval' }, { type: 'action', key: '', title: 'Send email' }],
    needs: ['Board', 'Gmail'],
  },
  {
    id: 'thumbnail-ready', name: 'Thumbnail ready', category: 'production',
    desc: 'When a thumbnail moves to Ready, ping the Super Admin in Slack to pick a winner.',
    trigger: { key: 'thumb_status', value: 'in_review' },
    steps: [act('slack_admin', '{{project.title}} has a thumbnail ready to review: {{project.link}}')],
    needs: ['Board', 'Slack'],
  },
  {
    id: 'publishing-countdown', name: 'Publishing countdown', category: 'publishing',
    desc: 'Two days before a video goes out, check every stage is done and add a task for any gap.',
    trigger: { key: 'publish_soon', value: '2' },
    steps: [{ type: 'data', key: 'get_project', title: 'Get project' }, { type: 'split', name: 'All stages done?', paths: [
      { name: 'Yes', when: [{ field: 'edit_status', op: 'is', value: 'approved' }, { field: 'approval', op: 'is_not', value: 'changes_requested' }], steps: [] },
      { name: 'No', when: [], steps: [{ type: 'task', title: 'Add task', note: 'Close the gaps before {{project.title}} publishes' }] },
    ] }],
    needs: ['Board'],
  },
  {
    id: 'mention-to-inbox', name: 'Mention to Inbox', category: 'production',
    desc: 'When a comment mentions a Super Admin, drop it in their Inbox with the project link.',
    trigger: { key: 'mention_admin', value: '' },
    steps: [act('todo_admin', 'You were mentioned on {{project.title}}: {{project.link}}')],
    needs: ['Board'],
  },
  {
    id: 'weekly-recap', name: 'Weekly production recap', category: 'production',
    desc: 'Every Friday, summarize what moved stages this week and post it to the team channel.',
    trigger: { key: 'schedule', value: 'weekly:5@16:00' },
    steps: [{ type: 'data', key: 'get_projects', title: 'Get projects' }, { type: 'ai', title: 'Summarize', note: 'What moved stages this week' }, { ...act('slack_admin', ''), title: 'Post to Slack' }],
    needs: ['Board', 'Slack'],
  },
  {
    id: 'editor-handoff', name: 'Editor handoff', category: 'production',
    desc: 'When filming wraps, assign the next free editor and set a due date.',
    trigger: { key: 'status', value: 'Post Production' }, chip: 'Post Production',
    steps: [{ type: 'task', title: 'Assign editor', note: 'Pick the next free editor for {{project.title}}' }, { type: 'data', key: 'set_due', title: 'Set due date' }],
    needs: ['Board'],
  },
];
