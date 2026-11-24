// Suggestions are local to the visible notes. An administrator explicitly attaches each topic to a note.
export const decisionTopics = {
  mentions: { title: 'Comment mentions', question: 'Who should receive a comment tag, and where should they see it?', evidence: 'A tagged Manager or assigned editor who can read a project comment receives an Inbox mention.', choices: ['Inbox mention for the tagged person', 'Also notify the assigned editor', 'Specify another delivery channel'], match: /mention|tag.{0,40}(editor|comment|notif)|notif.{0,35}tag/i, role: 'Tagged team member', nav: 'alerts', path: '/inbox' },
  revisions: { title: 'Needs Edits', question: 'Where should a reviewer request edits and where should the editor find them?', evidence: 'Request edit revision sets Editor Status to Needs Revision. The assigned editor can resubmit. Project Status is tracked separately.', choices: ['Use the existing editor revision queue', 'Change the review action wording', 'Change where revisions appear'], match: /needs? (edit|revision)|request.{0,12}revision/i, role: 'Reviewer and assigned editor', nav: 'projects', path: '/projects' },
  job_codes: { title: 'Job numbers', question: 'Which numbering convention should shorts and long-form projects use?', evidence: 'Client and format have separate sequences. Examples include CMP-RLS1 and POD-LF5.', choices: ['Use client, format and sequence', 'Specify a bucket and date convention'], match: /job.{0,15}(number|code)/i, role: 'Project manager', nav: 'projects', path: '/projects' },
  duplicates: { title: 'Duplicate a tab or board', question: 'Which object should be copied, and which content and assignments should carry over?', evidence: 'The dashboard can duplicate a custom project column, an idea or a template. Each copy has its own identity.', choices: [], match: /duplicat.{0,28}(tab|board|project)|copy.{0,15}(tab|board)/i, role: 'Super Admin', nav: 'projects', path: '/projects' },
  ideas_nav: { title: 'Ideas under Daily', question: 'Should Ideas follow Daily in the menu or appear inside the Daily screen?', evidence: 'Daily, Projects and Ideas currently appear in that order for Super Admins and permitted Managers on desktop and mobile.', choices: ['Place Ideas directly after Daily', 'Show Ideas inside Daily'], match: /idea.{0,55}daily|daily.{0,55}idea/i, role: 'Super Admin or Manager', nav: 'daily', path: '/daily' },
  manager_import: { title: 'Manager idea handoff', question: 'Can the Manager complete the client handoff with reviewed imports, or is an automated provider step needed?', evidence: 'A permitted Manager can import a written brief, choose a client, approve the idea and open the linked project with its script.', choices: ['Reviewed import meets the need', 'Specify the automated provider step'], match: /grok|claude|manager.{0,40}(board|client)/i, role: 'Manager with Ideas access', nav: 'ideas', path: '/ideas' },
};

export const decisionStates = { needs_decision: 'Needs decision', ready_to_try: 'Ready to try', accepted: 'Accepted' };

export function decisionTarget(topic, note, review, projects, sections, me) {
  const def = decisionTopics[topic];
  if (!def || !sections.includes(def.nav)) return null;
  const manager = me.uiRole === 'manager';
  if (me.uiRole !== 'admin') {
    const allowed = {
      mentions: me.perms.has('comments:view'),
      revisions: (manager || me.uiRole === 'editor') && me.perms.has('edits:edit'),
      job_codes: manager && me.perms.has('projects:view'),
      duplicates: false,
      ideas_nav: manager && sections.includes('ideas'),
      manager_import: manager && ['ideas:create','ideas:approve','projects:view'].every(key => me.perms.has(key)),
    };
    if (!allowed[topic]) return null;
  }
  const saved = String(note?.page_path || '').split('?');
  const params = new URLSearchParams(saved[0] === '/projects' ? saved[1] : '');
  const job = def.nav === 'projects' ? params.get('project') : null;
  if (def.nav === 'projects' && (review?.project_id || job)) {
    const project = projects.find(row => review?.project_id ? row.id === review.project_id : row.job === job);
    if (project && (me.uiRole !== 'editor' || project.editorId === me.id)) return { href: '/projects?project=' + encodeURIComponent(project.job), label: 'Try it on ' + project.title };
    return { href: def.path, label: 'Try it in the dashboard', reason: 'The linked project is unavailable to this account.' };
  }
  return { href: def.path, label: 'Try it' };
}
