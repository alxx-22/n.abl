// Table bookings for a seeded week, shaped by the business's own tables,
// areas, hours and sittings, planned in memory with the same availability
// rules the receptionist uses. Draws from the plan's shared dice, so it must
// keep drawing in the same order: the restaurant's recorded weeks depend on
// it.

import type { Resource, TenantProfile } from '../../domain/types.ts';
import { candidateTimes, checkSlot, depositFor, durationFor, findService, type BusyInterval } from '../../domain/availability.ts';
import { addDays, minutesOf, toLocal, weekdayOf } from '../../domain/time.ts';
import { ALLERGIES, type Ids } from '../common/random.ts';
import type { SeedBooking, SeedPlan } from '../common/types.ts';

/**
 * How full each service gets, as a share of its table time: a neighbourhood
 * restaurant with a quiet start to the week and a busy weekend. A table for
 * two and one for four always stay free (see roomAt), so even the busiest
 * evening stops short of full.
 */
function targetFor(weekday: number, evening: boolean, allDay: boolean): number {
  if (allDay) return weekday === 0 ? 0.4 : 0.32;
  if (!evening) return weekday === 6 || weekday === 0 ? 0.45 : weekday === 5 ? 0.32 : 0.22;
  return { 0: 0.35, 1: 0.3, 2: 0.32, 3: 0.4, 4: 0.5, 5: 0.7, 6: 0.75 }[weekday] ?? 0.4;
}

/**
 * When people ask to come, as humps over a service: dinner round half seven,
 * lunch round a quarter to one, and an all-day Sunday with a big lunch and a smaller early
 * evening. Each hump is a centre and how far either side it reaches.
 */
function humpsFor(first: number, last: number, evening: boolean, allDay: boolean): { at: number; reach: number; weight: number }[] {
  const within = (m: number) => Math.min(last, Math.max(first, m));
  if (evening) return [{ at: within(19 * 60 + 30), reach: Math.max(90, (last - first) * 0.6), weight: 1 }];
  const lunch = first <= 12 * 60 + 45 && 12 * 60 + 45 <= last ? 12 * 60 + 45 : (first + last) / 2;
  if (!allDay) return [{ at: within(lunch), reach: Math.max(75, (last - first) * 0.6), weight: 1 }];
  const humps = [{ at: within(lunch + 30), reach: 105, weight: 0.75 }];
  if (last >= 17 * 60 + 30) humps.push({ at: within(18 * 60), reach: 75, weight: 0.25 });
  return humps;
}

/** The week's table bookings from today, then today's visits marked: finished, seated, the odd no-show. */
export function planTableBookings(profile: TenantProfile, now: Date, random: () => number, { pick, ref, phone, person }: Ids, days = 7): SeedBooking[] {
  const tz = profile.timezone;
  const today = toLocal(now, tz).date;
  const service = findService(profile, 'table');
  const resources = profile.booking?.resources ?? [];
  const bookable = resources.filter((r) => service && r.services.includes(service.key));
  const areas = profile.booking?.areas ?? [];

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
        const first = minutesOf(w.first);
        const last = minutesOf(w.last);
        const allDay = last - first > 5 * 60;
        const evening = first >= minutesOf('16:00');
        const target = targetFor(weekday, evening, allDay);
        const times = candidateTimes(service, date).filter((t) => t >= w.first && t <= w.last);
        if (!times.length) continue;
        // Table-minutes on offer in this service, and how many to fill.
        const span = last - first + 90;
        const singles = bookable.filter((r) => !r.combines);
        const capacity = singles.length * span;
        let filled = 0;
        let tries = 0;
        const humps = humpsFor(first, last, evening, allDay);
        // A caller should always be able to book a table for two or for four,
        // inside where there is one that size, at any time on any day: a
        // restaurant that is full for everyone at half seven on a Saturday
        // isn't one a prospect recognises, and "that's taken" for a couple
        // makes the demo look broken.
        const inside = areas.find((a) => a.kind === 'indoor' && a.reservable)?.key;
        const roomFor = (n: number) => (inside && bookable.some((r) => r.area === inside && (r.capacity ?? 0) >= n && (r.min ?? 1) <= n) ? inside : undefined);
        const roomAt = (t: string) =>
          [2, 4].every((n) => n > maxParty || checkSlot({ profile, serviceKey: service.key, date, time: t, partySize: n, now: new Date(0), existing, area: roomFor(n) }, { ...service, lead_minutes: 0 }, t));
        // A time from the humps. Draws that fall outside the service are drawn
        // again rather than pinned to its edge, which piled bookings up at the
        // opening time. Most people book on the hour or the half hour.
        const draw = (): string | null => {
          for (let i = 0; i < 20; i++) {
            const h = humps.length > 1 && random() > humps[0].weight ? humps[1] : humps[0];
            // Two draws averaged: a gentle hump rather than a flat spread.
            const want = h.at + ((random() + random()) / 2 - 0.5) * 2 * h.reach;
            if (want < first - 7 || want > last + 7) continue;
            const step = random() < 0.7 ? 30 : service.slot_minutes;
            const m = Math.min(last, Math.max(first, Math.round(want / step) * step));
            return times.reduce((best, x) => (Math.abs(minutesOf(x) - m) < Math.abs(minutesOf(best) - m) ? x : best), times[0]);
          }
          return null;
        };
        // A kitchen paces its arrivals: no more than four tables sit down at once.
        const arriving = new Map<string, number>();
        while (filled < target * capacity && tries < 400) {
          tries++;
          const t = draw();
          if (!t || (arriving.get(t) ?? 0) >= 4) continue;
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
          // Every time this booking overlaps must still have room (see roomAt).
          const reach = minutesOf(t) - 150;
          const until = minutesOf(t) + minutes + (service.buffer_minutes ?? 0);
          if (!times.filter((x) => minutesOf(x) > reach && minutesOf(x) < until).every(roomAt)) {
            existing.pop();
            continue;
          }
          filled += minutes * (r.combines?.length ?? 1);
          arriving.set(t, (arriving.get(t) ?? 0) + 1);

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
  return bookings;
}

/** The share of bookable table time that is booked, per day: for tests and the back office header. */
export function occupancy(plan: SeedPlan, resources: Resource[]): number {
  const singles = resources.filter((r) => !r.combines && r.services.length).length || 1;
  const minutes = plan.bookings.reduce((s, b) => s + (b.ends_at.getTime() - b.starts_at.getTime()) / 60000, 0);
  return minutes / (singles * 60 * 24);
}
