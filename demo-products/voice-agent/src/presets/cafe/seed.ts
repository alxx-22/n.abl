// A believable week for a café the prospect has just built (presets/cafe.md
// §5.3): group tables at lunchtime, busiest at the weekend, and afternoon
// teas most days, some with a gluten-free or vegan guest. Only what a café
// books: tables for its booking size or more, and afternoon tea. Placed with
// the same slot checks the receptionist uses. Deterministic for a seed.

import { checkSlot, findService, type BusyInterval } from '../../domain/availability.ts';
import { addDays, minutesOf, timeOf, toLocal, weekdayOf } from '../../domain/time.ts';
import type { BookableService, TenantProfile } from '../../domain/types.ts';
import { ids, rng } from '../common/random.ts';
import type { SeedBooking, SeedMessage, SeedPlan } from '../common/types.ts';
import { CF_PEOPLE } from './personas.ts';

/** Group tables a day, by weekday (0 = Sunday): the weekend busiest. */
const GROUPS = [2, 0, 1, 1, 1, 1, 3];
/** Afternoon teas a day, by weekday. */
const TEAS = [2, 0, 1, 1, 2, 2, 3];

export function planCafeSeed(profile: TenantProfile, now: Date, seed: number, days = 7): SeedPlan {
  const random = rng(seed);
  const id = ids(random);
  const tz = profile.timezone;
  const today = toLocal(now, tz).date;
  const table = findService(profile, 'table');
  const tea = findService(profile, 'afternoon_tea');
  const resources = profile.booking?.resources ?? [];
  const reserved = new Set(Object.values(CF_PEOPLE).map((p) => p.phone));
  const phone = () => { for (;;) { const p = id.phone(); if (!reserved.has(p)) return p; } };
  const existing: BusyInterval[] = [];
  const bookings: SeedBooking[] = [];

  const place = (service: BookableService, date: string, time: string, party: number, who?: { name: string; phone: string }, allergies: string | null = null): SeedBooking | null => {
    const slot = checkSlot({ profile, serviceKey: service.key, date, time, partySize: party, now: new Date(0), existing }, { ...service, lead_minutes: 0 }, time);
    if (!slot) return null;
    const r = resources.find((x) => x.key === slot.resource_key)!;
    existing.push({ id: `seed-${bookings.length}`, resource_key: r.key, starts_at: slot.starts_at, ends_at: slot.ends_at });
    const b: SeedBooking = {
      reference: id.ref(), service_key: service.key, resource_key: r.key, area_key: r.area ?? null,
      starts_at: slot.starts_at, ends_at: slot.ends_at, party_size: party,
      name: who?.name ?? id.person(), phone: who?.phone ?? phone(), notes: null, allergies, tags: [],
      deposit_pence: 0, deposit_paid: false, visit_status: 'expected', booked_via: random() < 0.75 ? 'receptionist' : 'staff',
    };
    bookings.push(b);
    return b;
  };

  // Helen's afternoon tea for two on the coming Saturday at 2: hers to move or cancel.
  if (tea) {
    let saturday = addDays(today, 1);
    while (weekdayOf(saturday) !== 6) saturday = addDays(saturday, 1);
    const sitting = tea.windows.find((w) => w.days.includes(6) && w.first === '14:00')?.first ?? tea.windows.find((w) => w.days.includes(6))?.first;
    if (sitting) place(tea, saturday, sitting, 2, CF_PEOPLE.regular);
  }

  for (let d = 0; d < days; d++) {
    const date = addDays(today, d);
    const wd = weekdayOf(date);
    if (profile.closures?.some((c) => c.date === date)) continue;
    // Groups at lunchtime, on the half hour.
    if (table) {
      const open = table.windows.filter((w) => w.days.includes(wd));
      const times = open.flatMap((w) => {
        const out: string[] = [];
        for (let m = Math.max(minutesOf(w.first), 11 * 60 + 30); m <= Math.min(minutesOf(w.last), 13 * 60 + 30); m += 30) out.push(timeOf(m));
        return out;
      });
      for (let i = 0, tries = 0; i < GROUPS[wd] && times.length && tries < 20; tries++) {
        const party = 5 + Math.floor(random() * 4);
        if (place(table, date, id.pick(times), party, undefined, random() < 0.15 ? id.pick(['Nut allergy', 'Coeliac: no gluten', 'Vegan']) : null)) i++;
      }
    }
    // Afternoon teas at the day's sittings, some with a diet.
    if (tea) {
      const sittings = tea.windows.filter((w) => w.days.includes(wd)).map((w) => w.first);
      for (let i = 0, tries = 0; i < TEAS[wd] && sittings.length && tries < 20; tries++) {
        const party = 2 + Math.floor(random() * 5);
        const roll = random();
        const diet = roll < 0.2 ? 'Gluten-free afternoon tea for 1' : roll < 0.3 ? 'Vegan afternoon tea for 1' : null;
        const b = place(tea, date, id.pick(sittings), party, undefined, diet);
        if (b) {
          i++;
          if (random() < 0.25) { b.tags.push('birthday'); b.notes = 'Birthday: a candle in a scone'; }
        }
      }
    }
  }

  // Today so far: finished or sitting down.
  for (const b of bookings) {
    if (b.ends_at <= now) b.visit_status = 'finished';
    else if (b.starts_at <= now) b.visit_status = 'seated';
  }
  bookings.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());

  const messages: SeedMessage[] = [
    { from_name: id.person(), from_phone: phone(), body: "Wanting a whole chocolate cake for my mum's 70th on Saturday week, with a message on it. Please call back." },
    { from_name: 'Trent Valley Dairy', from_phone: phone(), body: 'Milk delivery moving to 7am on Mondays from next week.' },
  ];
  return { bookings, orders: [], messages };
}
