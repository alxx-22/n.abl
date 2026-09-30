// A believable week for a restaurant the prospect has just built: bookings
// shaped by their own tables, areas, hours and sittings, today's takeaway
// orders from their own menu, and a couple of messages. Planned in memory
// with the same availability rules the receptionist uses, then written in a
// few bulk inserts, so Start takes a second rather than a minute.
//
// Deterministic for a given seed, so tests can check the invariants.

import type { Resource, TenantProfile, OrderLine, MenuItem } from '../../domain/types.ts';
import { candidateTimes, checkSlot, depositFor, durationFor, findService, type BusyInterval } from '../../domain/availability.ts';
import { addDays, minutesOf, toLocal, weekdayOf, zonedToUtc } from '../../domain/time.ts';

export interface SeedBooking {
  reference: string;
  resource_key: string;
  area_key: string | null;
  starts_at: Date;
  ends_at: Date;
  party_size: number;
  name: string;
  phone: string;
  notes: string | null;
  allergies: string | null;
  tags: string[];
  deposit_pence: number;
  deposit_paid: boolean;
  visit_status: 'expected' | 'arrived' | 'seated' | 'finished' | 'no_show';
  booked_via: 'receptionist' | 'staff' | 'online';
}

export interface SeedOrder {
  reference: string;
  name: string;
  phone: string;
  due_at: Date;
  lines: OrderLine[];
  subtotal_pence: number;
  total_pence: number;
  allergy_notes: string | null;
  status: 'confirmed' | 'in_kitchen' | 'ready' | 'completed';
  payment_status: 'unpaid' | 'paid';
}

export interface SeedMessage {
  from_name: string;
  from_phone: string;
  body: string;
}

export interface SeedPlan {
  bookings: SeedBooking[];
  orders: SeedOrder[];
  messages: SeedMessage[];
}

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export const seedFrom = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

const FIRST = [
  'Sarah', 'James', 'Priya', 'Tom', 'Aisha', 'Daniel', 'Hannah', 'Mohammed', 'Emily', 'Oliver', 'Grace', 'Liam', 'Chloe', 'Ben',
  'Amara', 'Jack', 'Sophie', 'Ravi', 'Lucy', 'Callum', 'Zara', 'Ethan', 'Megan', 'Kwame', 'Holly', 'Adam', 'Niamh', 'Sam', 'Isla', 'Joe',
];
const LAST = [
  'Collins', 'Patel', 'Walker', 'Okafor', 'Hughes', 'Khan', 'Wright', 'Murphy', 'Nowak', 'Jones', 'Clarke', 'Singh', 'Brown', 'Evans',
  'Taylor', 'Ahmed', 'Green', 'Mensah', 'Kelly', 'Robinson', 'Hall', 'Shah', 'Wood', 'Lewis', 'Begum', 'Price', 'Doyle', 'Chen',
];
const ALLERGIES = ['Coeliac', 'Severe nut allergy', 'Dairy-free', 'Shellfish allergy', 'Vegan', 'Gluten intolerant', 'Sesame allergy'];
const REF_LETTERS = 'AHJKLQRWXY';

/** How full each service gets, by day and time of day. */
function targetFor(weekday: number, evening: boolean, allDay: boolean): number {
  if (allDay) return weekday === 0 ? 0.62 : 0.4;
  if (!evening) return weekday === 6 ? 0.5 : weekday === 5 ? 0.38 : 0.28;
  return { 0: 0.45, 1: 0.35, 2: 0.4, 3: 0.48, 4: 0.6, 5: 0.82, 6: 0.85 }[weekday] ?? 0.5;
}

export function planRestaurantSeed(profile: TenantProfile, now: Date, seed: number, days = 7): SeedPlan {
  const random = rng(seed);
  const pick = <T>(xs: T[]): T => xs[Math.floor(random() * xs.length)];
  const tz = profile.timezone;
  const today = toLocal(now, tz).date;
  const service = findService(profile, 'table');
  const resources = profile.booking?.resources ?? [];
  const bookable = resources.filter((r) => service && r.services.includes(service.key));
  const areas = profile.booking?.areas ?? [];
  const usedRefs = new Set<string>();
  const usedPhones = new Set<string>();
  const ref = () => {
    for (;;) {
      const r = `${REF_LETTERS[Math.floor(random() * 10)]}${REF_LETTERS[Math.floor(random() * 10)]}${100 + Math.floor(random() * 900)}`;
      if (!usedRefs.has(r)) return usedRefs.add(r), r;
    }
  };
  const phone = () => {
    for (;;) {
      const p = `+447700900${String(Math.floor(random() * 1000)).padStart(3, '0')}`;
      if (!usedPhones.has(p)) return usedPhones.add(p), p;
    }
  };
  const person = () => `${pick(FIRST)} ${pick(LAST)}`;

  const bookings: SeedBooking[] = [];
  const existing: BusyInterval[] = [];

  if (service && bookable.length) {
    const outdoor = new Set(areas.filter((a) => a.kind === 'outdoor').map((a) => a.key));
    const maxParty = Math.min(service.max_party ?? 8, Math.max(...bookable.map((r) => r.capacity ?? 0)));
    const parties = [2, 2, 2, 2, 2, 3, 3, 4, 4, 4, 4, 5, 6, 6, 7, 8].filter((p) => p <= maxParty);

    for (let d = 0; d < days; d++) {
      const date = addDays(today, d);
      const weekday = weekdayOf(date);
      if (profile.closures?.some((c) => c.date === date)) continue;
      const windows = service.windows.filter((w) => w.days.includes(weekday));
      for (const w of windows) {
        const allDay = minutesOf(w.last) - minutesOf(w.first) > 5 * 60;
        const evening = minutesOf(w.first) >= minutesOf('16:00');
        const target = targetFor(weekday, evening, allDay);
        const times = candidateTimes(service, date).filter((t) => t >= w.first && t <= w.last);
        if (!times.length) continue;
        // Table-minutes on offer in this service, and how many to fill.
        const span = minutesOf(w.last) - minutesOf(w.first) + 90;
        const singles = bookable.filter((r) => !r.combines);
        const capacity = singles.length * span;
        let filled = 0;
        let tries = 0;
        // Peak times first: half seven for dinner, one o'clock for lunch.
        const peak = evening ? minutesOf('19:30') : minutesOf('13:00');
        while (filled < target * capacity && tries < 400) {
          tries++;
          // Busiest round the peak, but the whole service fills: early tables at half five are normal.
          const spread = allDay ? 240 : Math.max(90, (minutesOf(w.last) - minutesOf(w.first)) * 0.6);
          // Two draws averaged: a gentle hump round the peak rather than a flat spread.
          const want = peak + ((random() + random()) / 2 - 0.5) * 2 * spread;
          const t = times.reduce((best, x) => (Math.abs(minutesOf(x) - want) < Math.abs(minutesOf(best) - want) ? x : best), times[0]);
          const party = pick(parties);
          const roll = random();
          const accessible = roll < 0.03;
          const prefer = roll > 0.95 ? ['window'] : roll > 0.92 ? ['booth'] : [];
          // The terrace fills more slowly than inside.
          const areaChoice = outdoor.size && random() < 0.28 ? [...outdoor][0] : undefined;
          const slot =
            checkSlot({ profile, serviceKey: service.key, date, time: t, partySize: party, now: new Date(0), existing, area: areaChoice, accessible, prefer }, { ...service, lead_minutes: 0 }, t)
            ?? (areaChoice ? checkSlot({ profile, serviceKey: service.key, date, time: t, partySize: party, now: new Date(0), existing, accessible, prefer }, { ...service, lead_minutes: 0 }, t) : null);
          if (!slot) continue;
          const r = resources.find((x) => x.key === slot.resource_key)!;
          const minutes = durationFor(service, party);
          existing.push({ id: `seed-${bookings.length}`, resource_key: r.key, starts_at: slot.starts_at, ends_at: slot.ends_at });
          filled += minutes * (r.combines?.length ?? 1);

          const extras = random();
          const tags: string[] = [];
          let notes: string | null = null;
          let allergies: string | null = null;
          if (extras < 0.1) allergies = pick(ALLERGIES);
          else if (extras < 0.15) {
            tags.push(random() < 0.7 ? 'birthday' : 'anniversary');
            notes = tags[0] === 'birthday' ? 'Birthday: bringing a cake' : 'Anniversary';
          } else if (extras < 0.2 && party >= 3) {
            tags.push('highchair');
            notes = '1 highchair';
          }
          if (accessible) {
            tags.push('wheelchair');
            notes = [notes, 'Wheelchair user, step-free table'].filter(Boolean).join('. ');
          }
          if (prefer.length && r.features?.includes(prefer[0])) notes = [notes, `Asked for a ${prefer[0]} table`].filter(Boolean).join('. ');
          const deposit = depositFor(service, party);
          bookings.push({
            reference: ref(),
            resource_key: r.key,
            area_key: r.area ?? null,
            starts_at: slot.starts_at,
            ends_at: slot.ends_at,
            party_size: party,
            name: person(),
            phone: phone(),
            notes,
            allergies,
            tags,
            deposit_pence: deposit,
            deposit_paid: deposit > 0 && random() < 0.85,
            visit_status: 'expected',
            booked_via: pick(['receptionist', 'receptionist', 'staff', 'online']),
          });
        }
      }
    }
    // Today, the evening so far: finished, seated, one no-show.
    let noShow = false;
    for (const b of bookings) {
      if (b.ends_at <= now) {
        if (!noShow && random() < 0.08) {
          b.visit_status = 'no_show';
          noShow = true;
        } else b.visit_status = 'finished';
      } else if (b.starts_at <= now) b.visit_status = 'seated';
      else if (b.starts_at.getTime() - now.getTime() < 10 * 60000 && random() < 0.4) b.visit_status = 'arrived';
    }
  }

  // Takeaway: today's orders across the collection slots.
  const orders: SeedOrder[] = [];
  const o = profile.ordering;
  const items = (profile.menu?.categories ?? []).flatMap((c) => c.items).filter((i) => i.available !== false && i.price_pence > 0);
  if (o?.collection && items.length) {
    const weekday = weekdayOf(today);
    const periods = o.hours.filter((h) => h.days.includes(weekday));
    const slot = o.slot_minutes ?? 15;
    const slots: Date[] = [];
    for (const p of periods) {
      for (let m = minutesOf(p.open) + (o.prep_minutes ?? 20); m <= minutesOf(p.close); m += slot) {
        slots.push(zonedToUtc(today, `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, tz));
      }
    }
    const count = Math.min(slots.length * 2, 8 + Math.floor(random() * 5));
    const perSlot = new Map<number, number>();
    const cap = o.slot_capacity ?? 99;
    for (let i = 0; i < count && slots.length; i++) {
      const due = slots[Math.min(slots.length - 1, Math.floor(random() * slots.length))];
      const n = perSlot.get(due.getTime()) ?? 0;
      if (n >= Math.max(1, cap - 1)) continue; // leave room in every slot for the prospect's own call
      perSlot.set(due.getTime(), n + 1);
      const lines: OrderLine[] = [];
      const picks = 1 + Math.floor(random() * 3);
      for (let l = 0; l < picks; l++) {
        const it: MenuItem = pick(items);
        const existingLine = lines.find((x) => x.item_key === it.key);
        if (existingLine) existingLine.quantity++;
        else lines.push({ line: lines.length + 1, item_key: it.key, name: it.name, quantity: 1, unit_pence: it.price_pence, modifiers: [] });
      }
      const subtotal = lines.reduce((s, x) => s + x.quantity * x.unit_pence, 0);
      const mins = (due.getTime() - now.getTime()) / 60000;
      const status: SeedOrder['status'] = mins < -10 ? 'completed' : mins < 5 ? 'ready' : mins < (o.prep_minutes ?? 20) ? 'in_kitchen' : 'confirmed';
      const paid = o.payment === 'phone' ? true : o.payment === 'collection' ? status === 'completed' : random() < 0.5 || status === 'completed';
      orders.push({
        reference: '',
        name: person(),
        phone: phone(),
        due_at: due,
        lines,
        subtotal_pence: subtotal,
        total_pence: subtotal,
        allergy_notes: random() < 0.1 ? pick(ALLERGIES) : null,
        status,
        payment_status: paid ? 'paid' : 'unpaid',
      });
    }
    orders.sort((a, b) => a.due_at.getTime() - b.due_at.getTime());
    orders.forEach((x, i) => (x.reference = String(101 + i)));
  }

  const hasPrivate = areas.some((a) => a.kind === 'private' || a.enquiry_only);
  const messages: SeedMessage[] = [
    {
      from_name: person(),
      from_phone: phone(),
      body: hasPrivate
        ? 'Would like the private room for 16 people on a Saturday next month, for a 40th. Please call back with prices.'
        : 'Asking about a table for 14 on a Saturday next month for a 40th birthday. Please call back.',
    },
    { from_name: person(), from_phone: phone(), body: 'Left a black umbrella at table 6 last night. Will pick it up if you have it.' },
  ];
  return { bookings, orders, messages };
}

/** The share of bookable table time that is booked, per day: for tests and the back office header. */
export function occupancy(plan: SeedPlan, resources: Resource[]): number {
  const singles = resources.filter((r) => !r.combines && r.services.length).length || 1;
  const minutes = plan.bookings.reduce((s, b) => s + (b.ends_at.getTime() - b.starts_at.getTime()) / 60000, 0);
  return minutes / (singles * 60 * 24);
}
