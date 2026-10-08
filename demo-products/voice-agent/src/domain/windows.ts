// Visit windows for a repairs contractor (presets/property-maintenance.md
// §4.2): a job is booked into a window on a date ("Thursday morning, 8 to
// 12"), not a minute. Pure, so the seed, the tools, dispatch and the tests
// all ask the same questions: which engineers can do this work, how full
// their window is, and when the next free windows are.

import { addDays, minutesOf, weekdayOf } from './time.ts';
import type { Job, MaintenanceSettings, MtEngineer, MtWindow, TenantProfile } from './types.ts';

/** Shares time with another window: an all-day window holds the morning and the afternoon. */
export const overlaps = (a: Pick<MtWindow, 'from' | 'to'>, b: Pick<MtWindow, 'from' | 'to'>) =>
  minutesOf(a.from) < minutesOf(b.to) && minutesOf(b.from) < minutesOf(a.to);

export const windowOf = (m: MaintenanceSettings, key: string | null | undefined) => m.windows.find((w) => w.key === key);

/** The windows offered on a date, earliest first. */
export const windowsOn = (m: MaintenanceSettings, date: string) =>
  m.windows.filter((w) => w.days.includes(weekdayOf(date))).sort((a, b) => minutesOf(a.from) - minutesOf(b.from));

/** A trade is gas work: only a Gas Safe registered engineer may do it. */
export const isGasTrade = (m: MaintenanceSettings, trade: string) => Boolean(m.trades.find((t) => t.key === trade)?.gas);

export interface WorkQuery {
  trade: string;
  /** Gas work, whatever the trade: a job flagged gas needs a Gas Safe engineer too. */
  gas?: boolean;
  /** The property's postcode district. */
  district?: string | null;
}

/** Why an engineer can't take this work, or null when they can (any day, any window). */
export function unable(m: MaintenanceSettings, e: MtEngineer, q: WorkQuery): string | null {
  if (!e.trades.includes(q.trade)) return `${e.first_name} doesn't do ${q.trade.replace(/_/g, ' ')}`;
  if ((q.gas || isGasTrade(m, q.trade)) && !e.gas_safe) return `${e.first_name} isn't Gas Safe registered`;
  if (q.district && e.districts.length && !e.districts.includes(q.district)) return `${e.first_name} doesn't cover ${q.district}`;
  return null;
}

/** Jobs that hold a place in an engineer's diary: everything given a window, but cancelled ones. */
const holds = (j: Job | Omit<Job, 'id'>) => j.status !== 'cancelled' && j.visit_date !== null && j.window_key !== null && j.engineer_key !== null;

/** How many jobs an engineer already has in windows that share time with this one, that day. */
export function windowLoad(m: MaintenanceSettings, jobs: readonly (Job | Omit<Job, 'id'>)[], engineer: string, date: string, window: MtWindow, exclude?: string): number {
  return jobs.filter((j) => holds(j) && j.reference !== exclude && j.engineer_key === engineer && j.visit_date === date && overlaps(windowOf(m, j.window_key) ?? window, window)).length;
}

export type WindowCheck =
  | { ok: true; window: MtWindow; engineers: MtEngineer[] }
  | { ok: false; reason: 'no_window' | 'not_that_day' | 'nobody' | 'full'; window?: MtWindow };

/**
 * Who can take this work in this window on this date: engineers who do the
 * trade, are Gas Safe for gas, cover the district, work that weekday and
 * have room (fewer than their jobs per window). `engineer` asks about one.
 */
export function checkWindow(m: MaintenanceSettings, jobs: readonly (Job | Omit<Job, 'id'>)[], q: WorkQuery & { date: string; window: string; engineer?: string; exclude?: string }): WindowCheck {
  const window = windowOf(m, q.window);
  if (!window) return { ok: false, reason: 'no_window' };
  const weekday = weekdayOf(q.date);
  if (!window.days.includes(weekday)) return { ok: false, reason: 'not_that_day', window };
  const able = m.engineers.filter((e) => (!q.engineer || e.key === q.engineer) && e.days.includes(weekday) && !absentOn(m, e.key, q.date) && !unable(m, e, q));
  if (!able.length) return { ok: false, reason: 'nobody', window };
  const free = able.filter((e) => windowLoad(m, jobs, e.key, q.date, window, q.exclude) < e.per_window);
  return free.length ? { ok: true, window, engineers: free } : { ok: false, reason: 'full', window };
}

export interface FreeWindow {
  date: string;
  window: MtWindow;
  engineers: MtEngineer[];
}

/**
 * The next free windows from `from`, earliest first, up to `limit`, within
 * the business's horizon. `now` (the business's local date and time) skips
 * windows that start inside the notice period.
 */
export function freeWindows(
  m: MaintenanceSettings,
  jobs: readonly (Job | Omit<Job, 'id'>)[],
  q: WorkQuery & { from: string; now?: { date: string; time: string }; limit?: number; days?: number; exclude?: string },
): FreeWindow[] {
  const out: FreeWindow[] = [];
  const limit = q.limit ?? 3;
  const notice = q.now ? minutesOf(q.now.time) + m.visits.notice_hours * 60 : 0;
  const days = Math.min(q.days ?? m.visits.horizon_days, m.visits.horizon_days);
  for (let i = 0; i <= days && out.length < limit; i++) {
    const date = addDays(q.from, i);
    if (q.now && date < q.now.date) continue;
    for (const w of windowsOn(m, date)) {
      if (q.now && date === q.now.date && minutesOf(w.from) < notice) continue;
      const c = checkWindow(m, jobs, { ...q, date, window: w.key });
      if (c.ok) out.push({ date, window: w, engineers: c.engineers });
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** The window a time falls in on a date, if any: where an engineer on the way is now. */
export const windowAt = (m: MaintenanceSettings, date: string, time: string) =>
  windowsOn(m, date).find((w) => minutesOf(w.from) <= minutesOf(time) && minutesOf(time) < minutesOf(w.to));

/**
 * Who is on call at a moment: the night belongs to the evening it starts,
 * so 2am on Tuesday is Monday night's pair.
 */
export function onCallAt(m: MaintenanceSettings, date: string, time: string): MtEngineer[] {
  const night = minutesOf(time) < 12 * 60 ? addDays(date, -1) : date;
  const keys = m.on_call.nights.find((n) => n.day === weekdayOf(night))?.engineers ?? [];
  return keys.filter((k) => !absentOn(m, k, night)).map((k) => m.engineers.find((e) => e.key === k)).filter((e): e is MtEngineer => e !== undefined);
}

/** Out of the office's hours at a local moment: nights, days it's closed, and its closures. */
export function officeShut(p: Pick<TenantProfile, 'opening_hours' | 'closures'>, date: string, time: string): boolean {
  if (p.closures?.some((c) => c.date === date)) return true;
  const wd = weekdayOf(date);
  return !p.opening_hours.some((h) => h.days.includes(wd) && minutesOf(h.open) <= minutesOf(time) && minutesOf(time) < minutesOf(h.close));
}

/**
 * Who an emergency can be paged to at a moment: out of hours, the night's
 * on-call pair; in the office's hours, whoever works that day and isn't off.
 */
export function pageable(m: MaintenanceSettings, shut: boolean, date: string, time: string): MtEngineer[] {
  return shut ? onCallAt(m, date, time) : m.engineers.filter((e) => e.days.includes(weekdayOf(date)) && !absentOn(m, e.key, date));
}

/** Why an engineer is off on a date (the back office's absences), if they are. */
export const absentOn = (m: Pick<MaintenanceSettings, 'absent'>, engineer: string, date: string) =>
  (m.absent ?? []).find((a) => a.engineer === engineer && a.from <= date && date <= a.to);
