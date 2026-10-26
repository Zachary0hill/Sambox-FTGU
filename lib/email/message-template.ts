// General emails (automation emails, the daily digest, invoices and reminders) in the notification look: grey page,
// white card, a tone block, Montserrat heading, a fact card and one black button. Tables and inline styles only.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export type MessageEmailInput = {
  workspace: string;
  tone: { label: string; bg: string };
  subject: string;
  heading: string;
  lead: string;
  note?: string;
  // A card with a title and label/value rows. Several cards stack (the digest uses one per section).
  cards?: { title: string; rows: [string, string][] }[];
  cta?: { label: string; url: string };
  fine: string;
  fineLink?: { label: string; url: string };
};

export function buildMessageEmail(o: MessageEmailInput) {
  const cards = (o.cards || []).filter((c) => c.title || c.rows.length);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.subject)}</title></head>
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
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${o.tone.bg};color:#FFFFFF;font-size:12px;font-weight:600;padding:6px 10px;">${esc(o.tone.label)}</td></tr></table>
  <h1 style="margin:16px 0 0;font-family:Montserrat,'Arial Black',Arial,sans-serif;font-size:28px;font-weight:900;line-height:1.15;letter-spacing:-0.03em;color:#111111;">${esc(o.heading)}</h1>
  <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#4A4A4A;">${esc(o.lead)}</p>
</td></tr>${o.note ? `
<tr><td style="padding:16px 32px 0;">
  <div style="border-left:3px solid #D4D4D4;padding:4px 0 4px 14px;font-size:14px;line-height:1.6;color:#4A4A4A;white-space:pre-line;">${esc(o.note)}</div>
</td></tr>` : ''}${cards.map((c) => `
<tr><td style="padding:20px 32px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F6;border-radius:16px;">
    ${c.title ? `<tr><td style="padding:16px 18px 4px;font-size:15px;font-weight:700;line-height:1.35;color:#111111;">${esc(c.title)}</td></tr>` : '<tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>'}
    ${c.rows.map(([k, v]) => `<tr><td style="padding:4px 18px;font-size:13px;line-height:1.5;color:#4A4A4A;"><span style="color:#707070;">${esc(k)}</span>&nbsp;&nbsp;${esc(v)}</td></tr>`).join('\n    ')}
    <tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
  </table>
</td></tr>`).join('')}${o.cta ? `
<tr><td style="padding:28px 32px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#111111;border-radius:14px;">
    <a href="${esc(o.cta.url)}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">${esc(o.cta.label)}</a>
  </td></tr></table>
</td></tr>` : ''}
<tr><td style="padding:24px 32px 32px;"><div style="border-top:1px solid #F0F0F0;padding-top:16px;font-size:12px;line-height:1.5;color:#8A8A8A;">${esc(o.fine)}${o.fineLink ? ` <a href="${esc(o.fineLink.url)}" style="color:#4A4A4A;">${esc(o.fineLink.label)}</a>` : ''}</div></td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    o.heading, '', o.lead, ...(o.note ? ['', o.note] : []),
    ...cards.flatMap((c) => ['', ...(c.title ? [c.title] : []), ...c.rows.map(([k, v]) => k + ': ' + v)]),
    ...(o.cta ? ['', o.cta.label + ': ' + o.cta.url] : []), '', o.fine, ...(o.fineLink ? [o.fineLink.label + ': ' + o.fineLink.url] : []),
  ].join('\n');
  return { subject: o.subject, html, text };
}
