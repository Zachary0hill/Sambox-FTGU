// Invite email in the board's light theme: grey page, white card, Montserrat title, black button,
// square role block in the role's tone. Tables and inline styles only, for email clients.

const ROLE = {
  super_admin: { label: 'Super Admin', bg: '#111111', fg: '#FFFFFF', blurb: 'the full board, every admin page and every setting' },
  editor: { label: 'Editor', bg: '#2F5BD3', fg: '#FFFFFF', blurb: 'your edit queue across longform and shortform' },
  designer: { label: 'Designer', bg: '#7A45C4', fg: '#FFFFFF', blurb: 'your design queue, thumbnail status and due dates' },
  sponsor: { label: 'Sponsor', bg: '#9A6A00', fg: '#FFFFFF', blurb: 'status, publishing dates and review links for your projects' },
  client: { label: 'Client', bg: '#9A6A00', fg: '#FFFFFF', blurb: 'every project on your channel, with status and publishing dates' },
} as const;

export type InviteRole = keyof typeof ROLE;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function buildInviteEmail(opts: {
  name: string; workspace: string; role: InviteRole; inviter: string; account?: string | null; link: string; existingUser: boolean;
}) {
  const r = ROLE[opts.role] || ROLE.editor;
  const first = (opts.name || '').trim().split(' ')[0] || 'there';
  const scope = opts.account ? r.blurb + ' for ' + opts.account : r.blurb;
  const cta = opts.existingUser ? 'Open the board' : 'Set your password';
  const subject = opts.existingUser
    ? opts.inviter + ' added you to ' + opts.workspace
    : opts.inviter + ' invited you to ' + opts.workspace + ' — set your password';
  const lead = opts.existingUser
    ? opts.inviter + ' added you to the ' + opts.workspace + ' production board. Sign in with your existing account to see ' + scope + '.'
    : opts.inviter + ' invited you to the ' + opts.workspace + ' production board. Set a password to see ' + scope + '.';
  const fine = opts.existingUser
    ? 'If you did not expect this, you can ignore this email.'
    : 'This link works once and expires soon. If it stops working, ask ' + opts.inviter + ' to resend your invite. If you did not expect this, you can ignore this email.';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#EBEBEB;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EBEBEB;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:28px;font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:#111111;">
<tr><td style="padding:32px 32px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:36px;height:36px;background:#111111;border-radius:10px;color:#FFFFFF;font-size:14px;font-weight:700;text-align:center;vertical-align:middle;">${esc(opts.workspace.slice(0, 1).toUpperCase())}</td>
    <td style="padding-left:12px;"><div style="font-size:15px;font-weight:700;line-height:1.25;">${esc(opts.workspace)}</div><div style="font-size:13px;line-height:1.3;color:#707070;">Production board</div></td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 32px 0;">
  <h1 style="margin:0;font-family:Montserrat,'Arial Black',Arial,sans-serif;font-size:28px;font-weight:900;line-height:1.15;letter-spacing:-0.03em;color:#111111;">Hi ${esc(first)}, you're in.</h1>
  <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#4A4A4A;">${esc(lead)}</p>
</td></tr>
<tr><td style="padding:20px 32px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="font-size:13px;font-weight:600;color:#707070;padding-right:10px;">Your access</td>
    <td style="background:${r.bg};color:${r.fg};font-size:12px;font-weight:600;padding:6px 10px;">${esc(r.label)}</td>
    ${opts.account ? `<td style="padding-left:8px;font-size:13px;color:#4A4A4A;">${esc(opts.account)}</td>` : ''}
  </tr></table>
</td></tr>
<tr><td style="padding:28px 32px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#111111;border-radius:14px;">
    <a href="${esc(opts.link)}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">${cta}</a>
  </td></tr></table>
  <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#707070;">Button not working? Paste this link into your browser:<br><a href="${esc(opts.link)}" style="color:#4A4A4A;word-break:break-all;">${esc(opts.link)}</a></p>
</td></tr>
<tr><td style="padding:24px 32px 32px;"><div style="border-top:1px solid #F0F0F0;padding-top:16px;font-size:12px;line-height:1.5;color:#8A8A8A;">${esc(fine)}</div></td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    'Hi ' + first + ',', '', lead, '', 'Your access: ' + r.label + (opts.account ? ' (' + opts.account + ')' : ''), '',
    cta + ': ' + opts.link, '', fine,
  ].join('\n');

  return { subject, html, text };
}
