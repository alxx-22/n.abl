// Wall-clock time in a tenant's timezone, without a date library.
//
// Bookings are stored as UTC instants and spoken as local times. The two
// conversions below are the only place that knows about offsets, and both are
// tested across the October and March clock changes.

export interface LocalParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  weekday: number; // 0 = Sunday
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function parts(ms: number, tz: string) {
  const out: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) out[p.type] = p.value;
  return out;
}

/** Minutes the zone is ahead of UTC at the given instant (60 in British Summer Time). */
export function offsetMinutes(ms: number, tz: string): number {
  const p = parts(ms, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

export function toLocal(d: Date, tz: string): LocalParts {
  const p = parts(d.getTime(), tz);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday: WEEKDAYS[p.weekday] };
}

/** A local date and time in `tz`, as a UTC instant. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = offsetMinutes(guess, tz);
  let t = guess - first * 60000;
  const second = offsetMinutes(t, tz);
  if (second !== first) t = guess - second * 60000;
  return new Date(t);
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Accepts "19:30", "7:30", "1930", "7.30pm", "7pm", "half seven" is left to the model. */
export function normaliseTime(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim().toLowerCase().replace(/\s+/g, '');
  const m = /^(\d{1,2})(?:[:.]?(\d{2}))?(am|pm)?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * A business that shuts at midnight closes at '24:00', the end of its own day,
 * so that day's hours stay in order and on one date ('00:00' would be its
 * start). Only a closing time may be '24:00'; nothing starts then, so the
 * last minute anything can start is LAST_START. Closing after midnight
 * (01:00) is not supported.
 */
export const MIDNIGHT = '24:00';
export const LAST_START = 24 * 60 - 1;

/** Minutes into the day a service closes: 1440 for midnight. */
export function closeMinutes(close: string): number {
  return close === MIDNIGHT ? 24 * 60 : minutesOf(close);
}

export function timeOf(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function dayName(weekday: number): string {
  return DAY_NAMES[weekday];
}

/** "Friday 2 October" */
export function spokenDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${DAY_NAMES[weekdayOf(date)]} ${d} ${MONTH_NAMES[m - 1]}`;
}

/** "7:30pm", "12 noon", "9am" */
export function spokenTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (h === 12 && m === 0) return '12 noon';
  if ((h === 0 || h === 24) && m === 0) return 'midnight';
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}
