// A believable week for a pub the prospect has just built (presets/pub.md
// §5.3): dinners busiest on Friday and Saturday evenings, Sunday lunch the
// busiest of all, a few families early, some with a dog, and a party on
// Saturday. Only tables in the bar and the dining room, at food times.
// Placed with the same slot checks the receptionist uses. Deterministic for
// a seed.

import { checkSlot, findService, type BusyInterval } from '../../domain/availability.ts';
import { addDays, minutesOf, timeOf, toLocal, weekdayOf } from '../../domain/time.ts';
import type { BookableService, TenantProfile } from '../../domain/types.ts';
import { ids, rng } from '../common/random.ts';
import type { SeedBooking, SeedMessage, SeedPlan } from '../common/types.ts';
import { PB_PEOPLE } from './personas.ts';

/** Tables a day, by weekday (0 = Sunday): Sunday lunch, then Friday and Saturday nights. */
const TABLES = [9, 2, 3, 3, 4, 7, 8];

export function planPubSeed(profile: TenantProfile, now: Date, seed: number, days = 7): SeedPlan {
  const random = rng(seed);
  const id = ids(random);
  const tz = profile.timezone;
  const today = toLocal(now, tz).date;
  const table = findService(profile, 'table');
  const resources = profile.booking?.resources ?? [];
  const reserved = new Set(Object.values(PB_PEOPLE).map((p) => p.phone));
  const phone = () => { for (;;) { const p = id.phone(); if (!reserved.has(p)) return p; } };
  const existing: BusyInterval[] = [];
  const bookings: SeedBooking[] = [];
  const until = profile.pub?.children_until ? minutesOf(profile.pub.children_until) : null;

  const place = (service: BookableService, date: string, time: string, party: number, who?: { name: string; phone: string }): SeedBooking | null => {
    const slot = checkSlot({ profile, serviceKey: service.key, date, time, partySize: party, now: new Date(0), existing }, { ...service, lead_minutes: 0 }, time);
    if (!slot) return null;
    const r = resources.find((x) => x.key === slot.resource_key)!;
    existing.push({ id: `seed-${bookings.length}`, resource_key: r.key, starts_at: slot.starts_at, ends_at: slot.ends_at });
    const b: SeedBooking = {
      reference: id.ref(), service_key: service.key, resource_key: r.key, area_key: r.area ?? null,
      starts_at: slot.starts_at, ends_at: slot.ends_at, party_size: party,
      name: who?.name ?? id.person(), phone: who?.phone ?? phone(), notes: null, allergies: null, tags: [],
      deposit_pence: 0, deposit_paid: false, visit_status: 'expected', booked_via: random() < 0.7 ? 'receptionist' : 'staff',
    };
    bookings.push(b);
    return b;
  };

  if (table) {
    // Gary's Sunday lunch for four on the coming Sunday at 1: his to move or add to.
    let sunday = addDays(today, 1);
    while (weekdayOf(sunday) !== 0) sunday = addDays(sunday, 1);
    place(table, sunday, '13:00', 4, PB_PEOPLE.regular);

    for (let d = 0; d < days; d++) {
      const date = addDays(today, d);
      const wd = weekdayOf(date);
      if (profile.closures?.some((c) => c.date === date)) continue;
      const windows = table.windows.filter((w) => w.days.includes(wd));
      const times = windows.flatMap((w) => {
        const out: string[] = [];
        for (let m = minutesOf(w.first); m <= minutesOf(w.last); m += 30) out.push(timeOf(m));
        return out;
      });
      // Sunday: lunch; other days: the evening, from 6.
      const busy = times.filter((t) => (wd === 0 ? minutesOf(t) <= 15 * 60 : minutesOf(t) >= 18 * 60));
      for (let i = 0, tries = 0; i < TABLES[wd] && busy.length && tries < 40; tries++) {
        const time = id.pick(busy);
        const party = 2 + Math.floor(random() * 5);
        const b = place(table, date, time, party);
        if (!b) continue;
        i++;
        const end = minutesOf(toLocal(b.ends_at, tz).time);
        // Families eat early: children only on a table that finishes before their hour.
        if (party >= 4 && random() < 0.35 && (until === null || end <= until)) {
          const kids = 1 + Math.floor(random() * 2);
          b.notes = `${kids} children`;
          b.tags.push('children');
        }
        if (random() < 0.2) {
          b.tags.push('dog');
          b.notes = b.notes ? `${b.notes}; a dog` : 'A dog';
        }
        if (random() < 0.12) b.allergies = id.pick(['Nut allergy', 'Coeliac: no gluten', 'Vegan', 'Shellfish allergy']);
        if (random() < 0.15) { b.tags.push('birthday'); b.notes = b.notes ? `${b.notes}; birthday` : 'Birthday'; }
      }
    }

    // A party of eight in the dining room on Saturday at 7.
    let saturday = today;
    while (weekdayOf(saturday) !== 6) saturday = addDays(saturday, 1);
    const party = place(table, saturday, '19:00', 8);
    if (party) { party.tags.push('birthday'); party.notes = 'A 50th: a cake arriving at 6:30'; }
  }

  // Today so far: finished or sitting down.
  for (const b of bookings) {
    if (b.ends_at <= now) b.visit_status = 'finished';
    else if (b.starts_at <= now) b.visit_status = 'seated';
  }
  bookings.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());

  const messages: SeedMessage[] = [
    { from_name: PB_PEOPLE.party.name, from_phone: PB_PEOPLE.party.phone, body: 'Wanting the Loft for a 40th on a Saturday in March, about 40 people, with a buffet. Please call back.' },
    { from_name: 'Trent Valley Brewery (example)', from_phone: phone(), body: 'Thursday’s delivery is moving to Friday morning, 8am.' },
  ];
  return { bookings, orders: [], messages };
}
