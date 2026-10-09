// The barber's seeded week (presets/barber.md §5.3), anchored to Start: each
// barber's chairs filled on the days they work, Saturdays about three
// quarters full and Thursday evenings busier, today's earlier cuts done; and
// the people a prospect can ring as, with their own bookings. Deterministic
// for a seed: the people's bookings are placed first, then everything else
// is drawn in the same order every time.

import type { BookableService, Resource, TenantProfile } from '../../domain/types.ts';
import { addDays, closeMinutes, minutesOf, timeOf, toLocal, weekdayOf, zonedToUtc } from '../../domain/time.ts';
import { ids, rng } from '../common/random.ts';
import type { SeedBooking, SeedMessage, SeedPlan } from '../common/types.ts';
import { SKIN_TEST_KEY } from '../../domain/shop-floor.ts';
import { BB_PEOPLE } from './personas.ts';

const MIN = 60000;
/** How full each day is, by weekday (0 = Sunday): Saturday the busiest. */
const FILL = [0.5, 0, 0.4, 0.4, 0.45, 0.55, 0.75];

export function planBarberSeed(profile: TenantProfile, now: Date, seed: number): SeedPlan {
  const random = rng(seed);
  const id = ids(random);
  const tz = profile.timezone;
  // The price list: a skin test is never part of the fill.
  const services = (profile.booking?.services ?? []).filter((s) => s.key !== SKIN_TEST_KEY);
  const team = (profile.booking?.resources ?? []).filter((r) => r.kind === 'staff');
  const reserved = new Set(Object.values(BB_PEOPLE).map((p) => p.phone));
  const phone = () => { for (;;) { const p = id.phone(); if (!reserved.has(p)) return p; } };
  const today = toLocal(now, tz).date;
  const bookings: SeedBooking[] = [];
  const busy = (r: string, s: Date, e: Date) => bookings.some((b) => b.resource_key === r && b.starts_at < e && s < b.ends_at);
  const deposit = (s: BookableService) => s.deposit?.flat_pence ?? 0;

  /** The hours a barber works on a date, in minutes, or null. */
  const hoursOn = (r: Resource, date: string): [number, number] | null => {
    const wd = weekdayOf(date);
    if (r.days && !r.days.includes(wd)) return null;
    const shop = (profile.opening_hours ?? []).find((h) => h.days.includes(wd));
    if (!shop) return null;
    const own = r.hours?.find((h) => h.day === wd);
    return [Math.max(minutesOf(shop.open), own ? minutesOf(own.open) : 0), Math.min(closeMinutes(shop.close), own ? closeMinutes(own.close) : 24 * 60)];
  };
  const add = (r: Resource, s: BookableService, starts: Date, who?: { name: string; phone: string }, paid?: boolean) => {
    const ends = new Date(starts.getTime() + (s.duration_minutes ?? 30) * MIN);
    const past = ends.getTime() <= now.getTime();
    bookings.push({
      reference: id.ref(), service_key: s.key, resource_key: r.key, area_key: null, starts_at: starts, ends_at: ends, party_size: 1,
      name: who?.name ?? id.person(), phone: who?.phone ?? phone(), notes: null, allergies: null, tags: [],
      deposit_pence: deposit(s), deposit_paid: Boolean(deposit(s)) && (past || (paid ?? random() < 0.6)),
      visit_status: past ? 'finished' : 'expected', booked_via: random() < 0.7 ? 'receptionist' : 'online',
    });
  };
  const service = (key: string) => services.find((s) => s.key === key);
  /** The first time on a barber's day, from `from` minutes, where a service fits and the chair is free. */
  const firstFree = (r: Resource, s: BookableService, date: string, from: number): Date | null => {
    const h = hoursOn(r, date);
    if (!h) return null;
    for (let t = Math.max(h[0], from); t + (s.duration_minutes ?? 30) <= h[1]; t += 15) {
      const starts = zonedToUtc(date, timeOf(t), tz);
      if (starts.getTime() > now.getTime() + 30 * MIN && !busy(r.key, starts, new Date(starts.getTime() + (s.duration_minutes ?? 30) * MIN))) return starts;
    }
    return null;
  };

  // Jay's skin fade with Marcus next week, at half five or the nearest after: his to move.
  const marcus = team.find((r) => r.key === 'marcus') ?? team[0];
  const fade = service('skin_fade') ?? services[0];
  if (marcus && fade) {
    for (let d = 6; d < 13; d++) {
      const at = firstFree(marcus, fade, addDays(today, d), 17 * 60 + 30) ?? firstFree(marcus, fade, addDays(today, d), 0);
      if (at) { add(marcus, fade, at, BB_PEOPLE.regular, true); break; }
    }
  }
  // Ollie's cut with Dan in the next day, the deposit paid: inside the notice period.
  const dan = team.find((r) => r.key === 'dan') ?? team[1] ?? team[0];
  const cut = service('classic_cut') ?? services[0];
  if (dan && cut) {
    // The latest free time between 2 and 22 hours from now, so cancelling it is inside the notice period.
    const minutes = cut.duration_minutes ?? 30;
    const [from, to] = [now.getTime() + 2 * 60 * MIN, now.getTime() + 22 * 60 * MIN];
    let at: Date | null = null;
    for (let d = 0; d < 2; d++) {
      const date = addDays(today, d);
      const h = hoursOn(dan, date);
      for (let t = h?.[0] ?? 0; h && t + minutes <= h[1]; t += 15) {
        const starts = zonedToUtc(date, timeOf(t), tz);
        if (starts.getTime() >= from && starts.getTime() <= to) at = starts;
      }
    }
    // A night before a closed day: the first free time after.
    for (let d = 0; !at && d < 7; d++) at = firstFree(dan, cut, addDays(today, d), 0);
    if (at) add(dan, cut, at, BB_PEOPLE.soon, true);
  }

  // Everyone else: each barber's days, filled to the day's level.
  for (let d = 0; d < 7; d++) {
    const date = addDays(today, d);
    const wd = weekdayOf(date);
    for (const r of team) {
      const h = hoursOn(r, date);
      if (!h) continue;
      const mine = services.filter((s) => r.services.includes(s.key));
      if (!mine.length) continue;
      const step = mine[0].slot_minutes || 15;
      let t = Math.ceil(h[0] / step) * step;
      while (t < h[1]) {
        const p = wd === 4 && t >= 17 * 60 ? 0.8 : FILL[wd];
        const s = id.pick(mine);
        const minutes = s.duration_minutes ?? 30;
        if (t + minutes > h[1]) break;
        const starts = zonedToUtc(date, timeOf(t), tz);
        const ends = new Date(starts.getTime() + minutes * MIN);
        if (random() < p && !busy(r.key, starts, ends)) {
          add(r, s, starts);
          // The next start on the service's grid: a 50-minute cut and beard frees the chair at the next quarter hour.
          t = Math.ceil((t + minutes) / step) * step;
        } else t += step;
      }
    }
  }

  const messages: SeedMessage[] = [
    { from_name: id.person(), from_phone: phone(), body: "Asking if you're taking on an apprentice: finishing college in the summer." },
    { from_name: 'Barber Supplies Ltd', from_phone: phone(), body: 'Your order of clipper blades and neck strips will be with you on Thursday morning.' },
  ];
  bookings.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
  return { bookings, orders: [], messages };
}
