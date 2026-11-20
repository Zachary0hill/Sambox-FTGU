// Schedule triggers (the builder's Trigger setup > Schedule). A workflow stores a rule and a timezone; the screen only
// ever shows the rule in words (scheduleText), never the stored string.
//
//   daily@16:00          every day at 4:00 PM
//   weekdays@09:00       Monday to Friday at 9:00 AM
//   weekly:1,5@16:00     Mondays and Fridays at 4:00 PM (0 Sunday … 6 Saturday)
//
// The runner (lib/automations/run.ts) queues one run for each slot that has passed, once.

export type Rule = { freq: 'daily' | 'weekdays' | 'weekly'; days: number[]; hour: number; minute: number };

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_NAMES = DAY;
export const DEFAULT_RULE = 'weekdays@09:00';

export function parseRule(value: string | null | undefined): Rule | null {
  const m = /^(daily|weekdays|weekly)(?::([0-6](?:,[0-6])*))?@(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const hour = Number(m[3]), minute = Number(m[4]);
  if (hour > 23 || minute > 59) return null;
  const days = m[1] === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : m[1] === 'weekdays' ? [1, 2, 3, 4, 5]
    : Array.from(new Set((m[2] || '').split(',').filter(Boolean).map(Number))).sort();
  if (!days.length) return null;
  return { freq: m[1] as Rule['freq'], days, hour, minute };
}

export function ruleString(r: { freq: Rule['freq']; days?: number[]; hour: number; minute: number }) {
  const at = '@' + String(r.hour).padStart(2, '0') + ':' + String(r.minute).padStart(2, '0');
  return r.freq === 'weekly' ? 'weekly:' + Array.from(new Set(r.days || [])).sort().join(',') + at : r.freq + at;
}

export const timeText = (hour: number, minute: number) => ((hour + 11) % 12 + 1) + ':' + String(minute).padStart(2, '0') + ' ' + (hour < 12 ? 'AM' : 'PM');

// "Every day at 4:00 PM", "Weekdays at 9:00 AM", "Mondays and Fridays at 4:00 PM".
export function scheduleText(value: string | null | undefined) {
  const r = parseRule(value);
  if (!r) return 'On a schedule';
  const at = ' at ' + timeText(r.hour, r.minute);
  if (r.freq === 'daily' || r.days.length === 7) return 'Every day' + at;
  if (r.freq === 'weekdays') return 'Weekdays' + at;
  const names = r.days.map((d) => DAY[d] + 's');
  return (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]) + at;
}

// The wall clock in a timezone for an instant.
function wall(ts: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(ts));
  const n = (t: string) => Number((parts.find((p) => p.type === t) || { value: '0' }).value);
  return { y: n('year'), m: n('month'), d: n('day'), hh: n('hour'), mm: n('minute'), ss: n('second') };
}
// The instant of a wall-clock time in a timezone.
function instant(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const w = wall(guess, tz);
  return guess - (Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm, w.ss) - guess);
}
const safeTz = (tz: string | null | undefined) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC' }); return tz || 'UTC'; } catch { return 'UTC'; } };

// The rule's slots near `now`: from 8 days back to `ahead` days forward, oldest first.
function slots(r: Rule, tzIn: string, now: number, ahead: number) {
  const tz = safeTz(tzIn);
  const today = wall(now, tz);
  const out: number[] = [];
  for (let i = -8; i <= ahead; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    if (!r.days.includes(day.getUTCDay())) continue;
    out.push(instant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), r.hour, r.minute, tz));
  }
  return out;
}
// The most recent slot at or before now, or null.
export function lastSlot(value: string, tz: string, now = Date.now()) {
  const r = parseRule(value);
  if (!r) return null;
  const past = slots(r, tz, now, 0).filter((t) => t <= now);
  return past.length ? past[past.length - 1] : null;
}
// The next n slots after now.
export function nextSlots(value: string, tz: string, n = 3, now = Date.now()) {
  const r = parseRule(value);
  if (!r) return [];
  return slots(r, tz, now, 15).filter((t) => t > now).slice(0, n);
}
