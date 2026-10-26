// Shared constants and conversions between database values and the board's display labels.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pairs = (o) => [o, Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]))];
export const [EDIT_L, EDIT_V] = pairs({ assigned: 'Assigned', editing: 'Editing', in_review: 'In Review', needs_revision: 'Needs Revision', approved: 'Approved' });
export const [THUMB_L, THUMB_V] = pairs({ not_started: 'Not Started', in_design: 'In Design', in_review: 'In Review', needs_revision: 'Needs Revision', done: 'Done' });
export const [APPROVAL_L, APPROVAL_V] = pairs({ pending: 'Pending', approved: 'Approved', changes_requested: 'Changes Requested' });
export const [DIST_L, DIST_V] = pairs({ not_yet: 'Not Yet', ongoing: 'Ongoing', drafted: 'Drafted', done: 'Done' });
export const [IDEA_TYPE_L, IDEA_TYPE_V] = pairs({ idea: 'Idea', script: 'Script', research: 'Research' });
export const [IDEA_STATUS_L, IDEA_STATUS_V] = pairs({ draft: 'Draft', in_review: 'In Review', approved: 'Approved', in_production: 'In production', archived: 'Archived' });
export const [IDEA_FORMAT_L, IDEA_FORMAT_V] = pairs({ long_form: 'Long-form', short: 'Short', reel: 'Reel', livestream: 'Livestream', podcast_clip: 'Podcast clip' });
export const [IDEA_EFFORT_L, IDEA_EFFORT_V] = pairs({ s: 'Small', m: 'Medium', l: 'Large' });
export const [DEAL_L, DEAL_V] = pairs({ contracted: 'Contracted', invoiced: 'Invoiced', paid: 'Paid', overdue: 'Overdue' });
export const [INVOICE_L, INVOICE_V] = pairs({ draft: 'Draft', sent: 'Invoiced', paid: 'Paid', overdue: 'Overdue', reminder_sent: 'Reminder sent' });
export const [PAYOUT_L, PAYOUT_V] = pairs({ pending_approval: 'Pending approval', scheduled: 'Scheduled', paid: 'Paid' });
export const [STAGE_L, STAGE_V] = pairs({ in_production: 'In Production', post_production: 'Post Production', publishing: 'Publishing' });
export const STAGE_ID = { in_production: 'prod', post_production: 'post', publishing: 'pub' };
export const FIELD_TYPE_L = { text: 'Text', number: 'Number', select: 'Select', multi_select: 'Multi select', date: 'Date', person: 'Person', url: 'URL', checkbox: 'Checkbox', files: 'Files & media' };
export const FIELD_TYPE_V = { Text: 'text', Number: 'number', Select: 'select', 'Multi select': 'multi_select', Date: 'date', Person: 'person', URL: 'url', Checkbox: 'checkbox', 'Files & media': 'files', Status: 'select', Email: 'text', Phone: 'text', Relation: 'text', Formula: 'text', 'Created time': 'date', 'Last edited by': 'person' };

// Board roles as the design names them, and the database roles behind them.
export const UI_ROLE = { super_admin: 'admin', editor: 'editor', designer: 'designer', sponsor: 'sponsor', client: 'sponsor' };
export const DB_ROLES = { admin: ['super_admin'], editor: ['editor'], designer: ['designer'], sponsor: ['sponsor', 'client'] };

// Avatar colors from the design (PEOPLE), picked by profiles.color_index.
const PALETTE_LIGHT = ['#B4365F', '#A84E24', '#7240BC', '#2F7553', '#2A2A2A', '#5F5F5F', '#2F5BD3', '#9A6A00'];
const PALETTE_DARK = ['#C23A67', '#B4572A', '#7A4AC4', '#2F805A', '#2A2A2A', '#5F5F5F', '#5B8BFF', '#B07A00'];
export const paletteColor = (i, dark) => (dark ? PALETTE_DARK : PALETTE_LIGHT)[((i % 8) + 8) % 8];

// ---------- Dates ----------
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const isoOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const dateOfIso = (iso) => { if (!iso) return null; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const labelOf = (iso) => { const d = dateOfIso(iso); return d ? MONTHS[d.getMonth()] + ' ' + d.getDate() : ''; };

// "Oct 24" labels carry no year: read them as the date nearest to today.
export function dateOfLabel(t, today) {
  const m = String(t || '').match(/^([A-Z][a-z]{2}) (\d+)/);
  if (!m) return null;
  const mo = MONTHS.indexOf(m[1]);
  if (mo < 0) return null;
  const base = today || startOfDay(new Date());
  let best = null;
  for (const y of [base.getFullYear() - 1, base.getFullYear(), base.getFullYear() + 1]) {
    const d = new Date(y, mo, Number(m[2]));
    if (!best || Math.abs(d - base) < Math.abs(best - base)) best = d;
  }
  return best;
}

export function relTime(ts, now = new Date()) {
  if (!ts) return '';
  const d = new Date(ts);
  const min = Math.round((now - d) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return min + ' min ago';
  if (min < 60 * 6) return Math.round(min / 60) + ' hr ago';
  const day = startOfDay(now), dd = startOfDay(d);
  const days = Math.round((day - dd) / 86400000);
  if (days === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  return MONTHS[d.getMonth()] + ' ' + d.getDate();
}

export function dayGroup(ts, now = new Date()) {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(ts))) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : 'earlier';
}

export const first = (name) => String(name || '').split(' ').filter(Boolean)[0] || '';
export const fmtCount = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3 >= 100 ? Math.round(n / 1e3) : (n / 1e3).toFixed(1).replace(/\.0$/, '')) + 'K' : String(n);

// Project files: images get previews in the drawer. Older rows have no mime_type, so the extension decides.
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|heic)$/i;
export const isImageFile = (a) => !!a && (/^image\//.test(a.mime_type || '') || IMAGE_EXT.test(a.storage_path || a.name || ''));
