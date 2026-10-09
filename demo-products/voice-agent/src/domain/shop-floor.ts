// A barber's shop floor (presets/barber.md §4.2, M2): who is off today, the
// walk-in queue and the wait now, and the skin test before colour. Pure: the
// repo stores these, and the tools and the back office read them. For any
// profile with `barber` (the hair salon writes it too).

import { candidateTimes, checkSlot, findService, type BusyInterval } from './availability.ts';
import { minutesOf, weekdayOf, zonedToUtc } from './time.ts';
import type { BookableService, TenantProfile } from './types.ts';

/** Today, from the back office: the barbers off, and one line for callers. Another day's reads as everyone in. */
export interface ShopToday {
  date: string;
  off: string[];
  notice: string | null;
}

export interface WalkIn {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  service_key: string;
  /** A barber they're waiting for, or null for whoever is free. */
  resource_key: string | null;
  joined_at: Date;
  served_at: Date | null;
  booking_id: string | null;
  left_at: Date | null;
  source: string;
}

export interface WaitlistEntry {
  id: string;
  tenant_id: string;
  date: string;
  service_key: string;
  resource_key: string | null;
  name: string;
  phone: string | null;
  created_at: Date;
  notified_at: Date | null;
  removed_at: Date | null;
  source: string;
  call_id: string | null;
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** The profile as it stands on a date: a barber off today doesn't work it. Any other date's is the profile. */
export function profileOn(p: TenantProfile, date: string, today: ShopToday): TenantProfile {
  if (!p.booking || !today.off.length || date !== today.date) return p;
  const wd = weekdayOf(date);
  return {
    ...p,
    booking: {
      ...p.booking,
      resources: p.booking.resources.map((r) => (today.off.includes(r.key) ? { ...r, days: (r.days ?? EVERY_DAY).filter((d) => d !== wd) } : r)),
    },
  };
}

/** Whether a barber is in on a date: works that weekday and isn't off today. */
export function inOn(p: TenantProfile, key: string, date: string, today: ShopToday): boolean {
  const r = p.booking?.resources.find((x) => x.key === key);
  if (!r || (r.days && !r.days.includes(weekdayOf(date)))) return false;
  return !(date === today.date && today.off.includes(key));
}

export interface ChairFree {
  resource_key: string;
  with: string;
  /** HH:MM local, and minutes from now. */
  free_at: string;
  minutes: number;
}

/**
 * When each barber in today could start a walk-in's service: after whoever is
 * in the chair, the walk-ins already waiting (first in first, each to their
 * barber or the soonest free who does their service), and any booking it
 * would run into. An estimate: only a booking holds a chair.
 */
export function waitNow(o: {
  profile: TenantProfile; now: Date; date: string; nowMinutes: number; serviceKey?: string;
  existing: BusyInterval[]; queue: WalkIn[]; today: ShopToday;
}): ChairFree[] {
  const p = profileOn(o.profile, o.date, o.today);
  const busy = [...o.existing];
  const soonest = (service: BookableService, staff?: string) => {
    // Walk-ins start when a chair is free, not on the booking grid, and need no notice.
    const s = { ...service, slot_minutes: 5, lead_minutes: 0 };
    const out: { key: string; at: number; starts: Date; ends: Date }[] = [];
    for (const r of p.booking?.resources ?? []) {
      if (r.kind !== 'staff' || (staff && r.key !== staff) || !inOn(p, r.key, o.date, o.today)) continue;
      if (r.services && !r.services.includes(service.key)) continue;
      for (const time of candidateTimes(s, o.date)) {
        if (minutesOf(time) < o.nowMinutes) continue;
        const slot = checkSlot({ profile: p, serviceKey: service.key, date: o.date, time, partySize: 1, staff: r.key, now: new Date(0), existing: busy }, s, time);
        if (slot) {
          out.push({ key: r.key, at: minutesOf(time), starts: slot.starts_at, ends: slot.ends_at });
          break;
        }
      }
    }
    return out.sort((a, b) => a.at - b.at);
  };
  for (const w of o.queue) {
    const s = findService(p, w.service_key);
    const first = s ? soonest(s, w.resource_key ?? undefined)[0] : undefined;
    if (first) busy.push({ resource_key: first.key, starts_at: first.starts, ends_at: first.ends });
  }
  const service = findService(p, o.serviceKey);
  if (!service) return [];
  const label = (k: string) => p.booking?.resources.find((r) => r.key === k)?.label ?? k;
  return soonest(service).map((x) => ({
    resource_key: x.key, with: label(x.key),
    free_at: `${String(Math.floor(x.at / 60)).padStart(2, '0')}:${String(x.at % 60).padStart(2, '0')}`,
    minutes: Math.max(0, x.at - o.nowMinutes),
  }));
}

/** The skin test's service key, added to a profile whose shop does colour. */
export const SKIN_TEST_KEY = 'skin_test';

/** The gap a skin test needs before colour (presets/barber-use-cases.md, "Colour"). */
export const SKIN_TEST_HOURS = 48;
const SIX_MONTHS_DAYS = 183;

/**
 * Whether colour starting at `start` has its skin test: taken or booked here
 * 48 hours or more before; for `every_time`, since the last colour visit; for
 * `six_months`, within six months. When the only test is too close, the
 * earliest the colour could be.
 */
export function skinTestFor(
  rule: 'every_time' | 'six_months', start: Date, tests: Date[], lastColour: Date | null,
): { ok: true; test: Date } | { ok: false; earliest: Date | null } {
  const gap = SKIN_TEST_HOURS * 3600000;
  const fresh = tests.filter((t) => (rule === 'every_time' ? !lastColour || t > lastColour : start.getTime() - t.getTime() <= SIX_MONTHS_DAYS * 86400000));
  const good = fresh.filter((t) => t.getTime() <= start.getTime() - gap).sort((a, b) => b.getTime() - a.getTime())[0];
  if (good) return { ok: true, test: good };
  const close = fresh.filter((t) => t.getTime() > start.getTime() - gap).sort((a, b) => a.getTime() - b.getTime())[0];
  return { ok: false, earliest: close ? new Date(close.getTime() + gap) : null };
}

/** A service that needs a skin test first. */
export const isColour = (s: BookableService | undefined) => Boolean(s?.colour);

/** HH:MM to the start of that minute on a local date. */
export const localAt = (p: TenantProfile, date: string, time: string) => zonedToUtc(date, time, p.timezone);
