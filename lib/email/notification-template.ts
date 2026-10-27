// Notification emails in the same look as the invite: grey page, white card, Montserrat title, black button, and a
// square block in the event's tone. Tables and inline styles only, for email clients.

export type NotificationKind =
  | 'edit_assigned' | 'thumb_assigned' | 'edit_revision' | 'thumb_revision' | 'sponsor_changes'
  | 'edit_review' | 'thumb_review' | 'edit_approved' | 'thumb_approved' | 'sponsor_requested' | 'sponsor_reminder' | 'sponsor_approved'
  | 'edit_due' | 'thumb_due';

const TONE = {
  assignment: { label: 'Assignment', bg: '#9A6A00' },
  revision: { label: 'Revision', bg: '#C42B2F' },
  review: { label: 'Review', bg: '#7A45C4' },
  approved: { label: 'Approved', bg: '#22844C' },
  deadline: { label: 'Deadline', bg: '#C42B2F' },
} as const;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export type NotificationEmailInput = {
  kind: NotificationKind;
  name: string;
  workspace: string;
  // Who made the change: a first name, or the sponsor account for sponsor decisions.
  actor: string;
  // The editor or designer a review is for, when someone else moved it to review.
  person?: string;
  account?: string;
  note?: string;
  version?: number;
  project: { title: string; job: string; due?: string; publish?: string };
  link: string;
  settingsLink: string;
};

type Copy = { tone: keyof typeof TONE; subject: string; heading: string; lead: string; dueLabel?: string };

function copyFor(o: NotificationEmailInput): Copy {
  const t = o.project.title;
  const acct = o.account || 'The sponsor';
  const who = o.person || o.actor;
  switch (o.kind) {
    case 'edit_assigned':
      return { tone: 'assignment', subject: 'New edit: ' + t, heading: "You're editing " + t, lead: o.actor + ' assigned you to edit ' + t + '.', dueLabel: 'Edit due' };
    case 'thumb_assigned':
      return { tone: 'assignment', subject: 'New thumbnail: ' + t, heading: "You're designing " + t, lead: o.actor + ' assigned you the thumbnail for ' + t + '.', dueLabel: 'Thumbnail due' };
    case 'edit_revision':
      return { tone: 'revision', subject: 'Revisions requested: ' + t, heading: 'Your edit needs changes', lead: o.actor + ' asked for revisions on ' + t + '. The notes are in the project comments.', dueLabel: 'Edit due' };
    case 'thumb_revision':
      return { tone: 'revision', subject: 'Thumbnail revisions: ' + t, heading: 'Your thumbnail needs changes', lead: o.actor + ' asked for revisions on the thumbnail for ' + t + '. The notes are in the project comments.', dueLabel: 'Thumbnail due' };
    case 'sponsor_changes':
      return { tone: 'revision', subject: acct + ' requested changes: ' + t, heading: acct + ' requested changes', lead: acct + ' reviewed ' + t + ' and asked for changes before it can be scheduled.' };
    case 'edit_review':
      return { tone: 'review', subject: 'Ready for review: ' + t, heading: 'An edit is ready for review', lead: who + ' sent ' + (o.version ? 'draft v' + o.version + ' of ' : '') + t + ' for review.' };
    case 'thumb_review':
      return { tone: 'review', subject: 'Thumbnail ready for review: ' + t, heading: 'A thumbnail is ready for review', lead: who + ' sent the thumbnail for ' + t + ' for review.' };
    case 'edit_approved':
      return { tone: 'approved', subject: 'Edit approved: ' + t, heading: 'Your edit was approved', lead: o.actor + ' approved your edit of ' + t + '.' };
    case 'thumb_approved':
      return { tone: 'approved', subject: 'Thumbnail approved: ' + t, heading: 'Your thumbnail is done', lead: o.actor + ' marked your thumbnail for ' + t + ' as done.' };
    case 'sponsor_requested':
      return { tone: 'review', subject: 'Approval needed: ' + t, heading: 'Your approval is needed', lead: o.workspace + ' sent ' + t + ' to ' + acct + ' for approval. Review the draft, then approve it or request changes.' };
    case 'sponsor_reminder':
      return { tone: 'review', subject: 'Reminder: approval needed for ' + t, heading: 'Your approval is still needed', lead: o.workspace + ' is waiting on ' + acct + ' to approve ' + t + '. Review the draft, then approve it or request changes.' };
    case 'sponsor_approved':
      return { tone: 'approved', subject: acct + ' approved ' + t, heading: acct + ' approved', lead: acct + ' approved ' + t + '. It can move to Scheduled.' };
    case 'edit_due':
      return { tone: 'deadline', subject: 'Edit due tomorrow: ' + t, heading: 'Your edit is due tomorrow', lead: 'Your edit of ' + t + ' is due tomorrow' + (o.project.due ? ', ' + o.project.due : '') + '.', dueLabel: 'Edit due' };
    case 'thumb_due':
      return { tone: 'deadline', subject: 'Thumbnail due tomorrow: ' + t, heading: 'Your thumbnail is due tomorrow', lead: 'The thumbnail for ' + t + ' is due tomorrow' + (o.project.due ? ', ' + o.project.due : '') + '.', dueLabel: 'Thumbnail due' };
  }
}

export function buildNotificationEmail(o: NotificationEmailInput) {
  const c = copyFor(o);
  const tone = TONE[c.tone];
  const first = (o.name || '').trim().split(' ')[0] || 'there';
  const facts: [string, string][] = [['Job', o.project.job]];
  if (c.dueLabel && o.project.due) facts.push([c.dueLabel, o.project.due]);
  if (o.project.publish) facts.push(['Publishing', o.project.publish]);
  const fine = "You get this email because you're on the " + o.workspace + ' production board. You can turn off email alerts in Settings.';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#EBEBEB;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EBEBEB;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:28px;font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:#111111;">
<tr><td style="padding:32px 32px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:36px;height:36px;background:#111111;border-radius:10px;color:#FFFFFF;font-size:14px;font-weight:700;text-align:center;vertical-align:middle;">${esc(o.workspace.slice(0, 1).toUpperCase())}</td>
    <td style="padding-left:12px;"><div style="font-size:15px;font-weight:700;line-height:1.25;">${esc(o.workspace)}</div><div style="font-size:13px;line-height:1.3;color:#707070;">Production board</div></td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 32px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${tone.bg};color:#FFFFFF;font-size:12px;font-weight:600;padding:6px 10px;">${tone.label}</td></tr></table>
  <h1 style="margin:16px 0 0;font-family:Montserrat,'Arial Black',Arial,sans-serif;font-size:28px;font-weight:900;line-height:1.15;letter-spacing:-0.03em;color:#111111;">${esc(c.heading)}</h1>
  <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#4A4A4A;">${esc(c.lead)}</p>
</td></tr>${o.note ? `
<tr><td style="padding:16px 32px 0;">
  <div style="border-left:3px solid #D4D4D4;padding:4px 0 4px 14px;font-size:14px;line-height:1.6;color:#4A4A4A;white-space:pre-line;">${esc(o.note)}</div>
</td></tr>` : ''}
<tr><td style="padding:20px 32px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F6;border-radius:16px;">
    <tr><td style="padding:16px 18px 4px;font-size:15px;font-weight:700;line-height:1.35;color:#111111;">${esc(o.project.title)}</td></tr>
    ${facts.map(([k, v]) => `<tr><td style="padding:4px 18px;font-size:13px;line-height:1.5;color:#4A4A4A;"><span style="color:#707070;">${esc(k)}</span>&nbsp;&nbsp;${esc(v)}</td></tr>`).join('\n    ')}
    <tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
  </table>
</td></tr>
<tr><td style="padding:28px 32px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#111111;border-radius:14px;">
    <a href="${esc(o.link)}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Open the project</a>
  </td></tr></table>
</td></tr>
<tr><td style="padding:24px 32px 32px;"><div style="border-top:1px solid #F0F0F0;padding-top:16px;font-size:12px;line-height:1.5;color:#8A8A8A;">${esc(fine)} <a href="${esc(o.settingsLink)}" style="color:#4A4A4A;">Email settings</a></div></td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    'Hi ' + first + ',', '', c.lead, ...(o.note ? ['', '"' + o.note + '"'] : []), '',
    o.project.title, ...facts.map(([k, v]) => k + ': ' + v), '',
    'Open the project: ' + o.link, '', fine, 'Email settings: ' + o.settingsLink,
  ].join('\n');

  return { subject: c.subject, html, text };
}
