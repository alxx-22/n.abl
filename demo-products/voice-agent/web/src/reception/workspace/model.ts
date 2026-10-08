// The back office's view of the diary: what each table is doing at a given
// minute, which tables a booking could move to, and local times in the
// restaurant's own timezone (the browser may be elsewhere).

import type { TableLook } from '../FloorPlan.tsx';
import type { LiveBooking, LiveState, PlanTable } from '../types.ts';

export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function localNow(tz: string, at = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: Number(g('hour')) * 60 + Number(g('minute')) };
}

export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** The services open on a date, in order: Lunch 12:00 to 14:30, Dinner 17:30 to 22:00. */
export function servicesOn(state: LiveState, date: string): { label: string; open: number; close: number }[] {
  const wd = weekday(date);
  return state.opening_hours
    .filter((h) => h.days.includes(wd))
    .map((h) => ({ label: h.label || 'Open', open: toMin(h.open), close: toMin(h.close) }))
    .sort((a, b) => a.open - b.open);
}

export function span(b: LiveBooking): [number, number] {
  const s = toMin(b.time);
  let e = toMin(b.end_time);
  if (e <= s) e += 24 * 60;
  return [s, e];
}

const live = (b: LiveBooking) => b.status === 'confirmed' && b.visit_status !== 'finished' && b.visit_status !== 'no_show';

/** Each table's state at one minute of one day, for the floor plan. */
/** nowMinute: the real time when the date is today (lateness is about the clock, not the slider), else null. */
export function looksAt(state: LiveState, date: string, minute: number, nowMinute: number | null, flash: Set<string>): Record<string, TableLook> {
  const out: Record<string, TableLook> = {};
  const day = state.bookings.filter((b) => b.date === date && live(b));
  for (const t of state.plan?.tables ?? []) {
    const mine = day.filter((b) => b.tables.includes(t.key)).sort((a, b) => a.time.localeCompare(b.time));
    const now = mine.find((b) => {
      const [s, e] = span(b);
      return s <= minute && minute < e;
    });
    const next = mine.find((b) => span(b)[0] > minute);
    const b = now ?? (next && span(next)[0] - minute <= 30 ? next : undefined);
    let state_: TableLook['state'] = 'free';
    if (now) {
      if (now.visit_status === 'seated' || now.visit_status === 'arrived') state_ = 'seated';
      else if (nowMinute !== null && nowMinute - span(now)[0] >= 15 && minute <= nowMinute) state_ = 'late';
      else state_ = 'booked';
    } else if (b) state_ = 'arriving';
    else if (next) state_ = 'later';
    const pair = b && b.tables.length > 1 ? b.tables.find((k) => k !== t.key) : undefined;
    out[t.key] = {
      state: state_,
      caption: b ? `${b.time} · ${b.party_size}` : next ? `next ${next.time}` : undefined,
      badges: b ? badgesFor(b) : [],
      pairedWith: pair,
      draggable: Boolean(b),
      flash: flash.has(t.key),
    };
  }
  return out;
}

export function badgesFor(b: LiveBooking): NonNullable<TableLook['badges']> {
  const out: NonNullable<TableLook['badges']> = [];
  const text = `${b.notes ?? ''} ${b.tags.join(' ')}`.toLowerCase();
  if (b.allergies) out.push('allergy');
  if (/wheelchair|step-free|step free|access/.test(text)) out.push('access');
  if (/birthday|anniversary|occasion|celebrat/.test(text)) out.push('occasion');
  if (/highchair/.test(text)) out.push('highchair');
  if (b.deposit) out.push('deposit');
  return out;
}

/** The booking a table is showing at that minute (seated now, or arriving soon). */
export function bookingOn(state: LiveState, table: string, date: string, minute: number): LiveBooking | null {
  const mine = state.bookings.filter((b) => b.date === date && live(b) && b.tables.includes(table)).sort((a, b) => a.time.localeCompare(b.time));
  return mine.find((b) => span(b)[0] <= minute && minute < span(b)[1]) ?? mine.find((b) => span(b)[0] > minute && span(b)[0] - minute <= 30) ?? null;
}

/** Tables and pairs this booking could move to: big enough and free for its whole time. */
export function moveOptions(state: LiveState, b: LiveBooking): { key: string; label: string; seats: number; area: string | null; accessible: boolean }[] {
  const plan = state.plan;
  if (!plan) return [];
  const [s, e] = span(b);
  const others = state.bookings.filter((x) => x.id !== b.id && x.date === b.date && x.status === 'confirmed');
  const busy = (keys: string[]) => others.some((x) => {
    const [xs, xe] = span(x);
    return xs < e && s < xe && x.tables.some((k) => keys.includes(k));
  });
  const tables = plan.tables.filter((t) => t.seats >= b.party_size && t.key !== b.resource_key && !busy([t.key]))
    .map((t) => ({ key: t.key, label: t.label, seats: t.seats, area: t.area, accessible: t.accessible }));
  const byKey = new Map(plan.tables.map((t) => [t.key, t]));
  const pairs = plan.pairs.filter((p) => p.capacity >= b.party_size && p.key !== b.resource_key && !busy(p.combines))
    .map((p) => ({ key: p.key, label: p.label, seats: p.capacity, area: byKey.get(p.combines[0])?.area ?? null, accessible: p.combines.some((k) => byKey.get(k)?.accessible) }));
  return [...tables, ...pairs];
}

/**
 * The people a booking could move to: in the team, doing its service, working that day and free then, with each
 * booking's gap after it kept, and never whoever has a personal interest in the home. The server checks again.
 */
export function personOptions(state: LiveState, b: LiveBooking): { key: string; label: string }[] {
  const team = state.team ?? [];
  if (b.status !== 'confirmed' || !team.some((m) => m.key === b.resource_key)) return [];
  const wd = weekday(b.date);
  const [s, e] = span(b);
  const others = state.bookings.filter((x) => x.id !== b.id && x.date === b.date && x.status === 'confirmed');
  const busy = (key: string) => others.some((x) => {
    if (x.resource_key !== key) return false;
    const [xs, xe] = span(x);
    return xs < e + (b.buffer_minutes ?? 0) && s < xe + (x.buffer_minutes ?? 0);
  });
  // Never to whoever has a personal interest in the home (the walkthrough, 8 October: offered, then refused by the server).
  const interest = b.listing_key ? state.listings?.find((l) => l.key === b.listing_key)?.interest_staff : null;
  return team
    .filter((m) => m.key !== b.resource_key && m.key !== interest && m.days.includes(wd) && (!b.service_key || (m.services ?? []).includes(b.service_key)) && !busy(m.key))
    .map((m) => ({ key: m.key, label: m.name }));
}

/** Tables in the same area that could be pushed against this booking's table. */
export function combineOptions(state: LiveState, b: LiveBooking): PlanTable[] {
  const plan = state.plan;
  if (!plan || b.tables.length !== 1) return [];
  const mine = plan.tables.find((t) => t.key === b.tables[0]);
  if (!mine) return [];
  const [s, e] = span(b);
  const others = state.bookings.filter((x) => x.id !== b.id && x.date === b.date && x.status === 'confirmed');
  return plan.tables.filter((t) => t.key !== mine.key && t.area === mine.area && !others.some((x) => {
    const [xs, xe] = span(x);
    return xs < e && s < xe && x.tables.includes(t.key);
  }));
}

export const SOURCE: Record<string, string> = {
  seed: 'Sample booking (made up for the demo)',
  browser: 'The AI receptionist, on a call from this page',
  phone: 'The AI receptionist, on a phone call',
  staff: 'Staff',
};
