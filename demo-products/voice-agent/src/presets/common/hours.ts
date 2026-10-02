// Opening hours, said the way people say them, and turned into the profile's
// opening hours and booking windows. Every kind of business has a week of up
// to three services a day, so these take the hours block, never the answers.

import { dayName, minutesOf, spokenTime, timeOf } from '../../domain/time.ts';
import type { OpeningHours, Window } from '../../domain/types.ts';
import type { DayHours } from './types.ts';

export type { DayHours, ServicePeriod } from './types.ts';

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first, the way people say it

/** "Tuesday to Saturday", "Sunday", "Friday and Saturday", "Monday, Wednesday and Friday". */
export function dayRange(days: number[]): string {
  const sorted = DAY_ORDER.filter((d) => days.includes(d));
  if (sorted.length === 7) return 'Every day';
  const runs: number[][] = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last && DAY_ORDER.indexOf(d) === DAY_ORDER.indexOf(last[last.length - 1]) + 1) last.push(d);
    else runs.push([d]);
  }
  const parts = runs.map((r) => (r.length >= 3 ? `${dayName(r[0])} to ${dayName(r[r.length - 1])}` : r.map(dayName).join(' and ')));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

/** Groups identical entries across days: [{days:[2..6], value}]. */
export function groupByDay<T>(perDay: (T[] | null)[], key: (v: T) => string): { days: number[]; value: T }[] {
  const out = new Map<string, { days: number[]; value: T }>();
  perDay.forEach((vals, day) => {
    for (const v of vals ?? []) {
      const k = key(v);
      const g = out.get(k) ?? { days: [], value: v };
      g.days.push(day);
      out.set(k, g);
    }
  });
  return [...out.values()];
}

export function openingHours(hours: { days: DayHours[] }): OpeningHours[] {
  return groupByDay(
    hours.days.map((d) => (d.open ? d.services : null)),
    (s) => `${s.label}|${s.open}|${s.close}`,
  ).map((g) => ({ days: g.days.sort(), open: g.value.open, close: g.value.close, label: g.value.label }));
}

export function hoursSentence(hours: { days: DayHours[] }): string {
  const byPattern = groupByDay(
    hours.days.map((d) => (d.open && d.services.length ? [d.services] : null)),
    (ss) => ss.map((s) => `${s.label}|${s.open}|${s.close}`).join(','),
  );
  const parts = byPattern.map((g) => {
    const ss = g.value;
    const times = ss.length === 1
      ? `${spokenTime(ss[0].open)} till ${spokenTime(ss[0].close)}`
      : ss.map((s) => `${s.label.toLowerCase()} ${spokenTime(s.open)} till ${spokenTime(s.close)}`).join(', ');
    return `${dayRange(g.days)}: ${times}`;
  });
  const closed = hours.days.map((d, i) => (d.open ? -1 : i)).filter((i) => i >= 0);
  if (closed.length) parts.push(`Closed ${dayRange(closed)}${closed.length === 1 ? 's' : ''}`);
  return parts.map((p) => p.replace(/^./, (c) => c.toUpperCase())).join('. ') + '.';
}

/** When a booking may start: each open service, ending this many minutes before it closes. */
export function bookingWindows(hours: { days: DayHours[] }, lastStartBeforeClose: number): Window[] {
  return groupByDay(
    hours.days.map((d) =>
      d.open
        ? d.services
            .map((s) => ({ first: s.open, last: timeOf(Math.max(minutesOf(s.open), minutesOf(s.close) - lastStartBeforeClose)) }))
            .filter((w) => minutesOf(w.last) >= minutesOf(w.first))
        : null,
    ),
    (w) => `${w.first}|${w.last}`,
  ).map((g) => ({ days: g.days.sort(), first: g.value.first, last: g.value.last }));
}
