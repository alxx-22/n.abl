// A barber's back office on the server (presets/barber.md §6, M2): the
// Diary's rows and marks, the walk-in queue and the wait now, today's
// barbers off and the notice, and the waiting list; and the staff actions on
// them. Only for a profile with `barber` (the hair salon writes it too). The
// shape is the one agreed on SESSIONS.md (9 October, 21:28).

import type { Repo } from '../db/repo.ts';
import { findService } from '../domain/availability.ts';
import { displayUkPhone, normaliseUkPhone } from '../domain/phone.ts';
import { SKIN_TEST_KEY, inOn, waitNow, type ShopToday } from '../domain/shop-floor.ts';
import { minutesOf, spokenDate, toLocal } from '../domain/time.ts';
import type { Booking, Tenant } from '../domain/types.ts';
import { HttpError } from './http.ts';

const minutesSince = (from: Date, now: Date) => Math.max(0, Math.round((now.getTime() - from.getTime()) / 60000));

/** The barbers as the Diary's rows, and the shop floor (`state.barber`). */
export async function barberState(repo: Repo, t: Tenant, now: Date, today: string) {
  const p = t.profile;
  const barbers = (p.booking?.resources ?? []).filter((r) => r.kind === 'staff');
  const label = (k: string | null) => (k ? barbers.find((r) => r.key === k)?.label ?? k : null);
  const service = (k: string) => findService(p, k)?.label ?? k;
  const shop = await repo.getToday(t.id, today);
  const queue = await repo.listWaitingWalkIns(t.id);
  // The wait now for the first thing on the price list (a classic cut, as it comes).
  const first = p.booking?.services.find((s) => s.key !== SKIN_TEST_KEY);
  const wait = first
    ? waitNow({ profile: p, now, date: today, nowMinutes: minutesOf(toLocal(now, p.timezone).time), serviceKey: first.key, existing: await repo.busyForDate(t, today), queue, today: shop })
    : [];
  return {
    team: barbers.map((r) => ({ key: r.key, name: r.label, first_name: r.label, role: 'other' as const, does: [], days: r.days ?? [0, 1, 2, 3, 4, 5, 6], mobile: '', services: r.services })),
    barber: {
      today: shop,
      // What a walk-in can have, for "Add a walk-in" (ui's ask, SESSIONS.md 9 October).
      services: (p.booking?.services ?? []).map((s) => ({ key: s.key, label: s.label })),
      queue: queue.map((w) => ({
        id: w.id, name: w.name, phone: displayUkPhone(w.phone), service: service(w.service_key), service_key: w.service_key,
        resource_key: w.resource_key, with: label(w.resource_key), joined_at: w.joined_at.toISOString(), waited_minutes: minutesSince(w.joined_at, now),
      })),
      wait_now: wait,
      waitlist: (await repo.listWaitlist(t.id, today)).map((e) => ({
        id: e.id, date: e.date, spoken_date: spokenDate(e.date), service: service(e.service_key), service_key: e.service_key,
        resource_key: e.resource_key, with: label(e.resource_key), name: e.name, phone: displayUkPhone(e.phone),
        created_at: e.created_at.toISOString(), notified_at: e.notified_at?.toISOString() ?? null,
      })),
    },
  };
}

/** A booking's Diary marks: running late (a caller rang), and needing a new time (today, with a barber off). */
export function barberMarks(b: Booking, date: string, shop: ShopToday): { late?: { minutes: number; note: string; at: string }; needs_new_time?: true } {
  const late = b.details?.late as { minutes: number; note: string; at: string } | undefined;
  const needs = b.status === 'confirmed' && date === shop.date && shop.off.includes(b.resource_key) && (b.visit_status ?? 'expected') === 'expected';
  return { ...(late ? { late } : {}), ...(needs ? { needs_new_time: true as const } : {}) };
}

/**
 * The back office's shop-floor actions: today's barbers off and notice, a
 * walk-in added, served into a chair or gone, and the waiting list. The
 * message for staff, or null when the request isn't one of these.
 */
export async function barberAction(repo: Repo, t: Tenant, o: { sub: string; id: string | null; method: string; body: any; now: Date }): Promise<string | null> {
  const p = t.profile;
  if (!p.barber) return null;
  const { sub, id, method, body: b, now } = o;
  const today = toLocal(now, p.timezone).date;
  const barbers = (p.booking?.resources ?? []).filter((r) => r.kind === 'staff');
  const barber = (k: unknown) => barbers.find((r) => r.key === k);

  if (sub === 'today' && !id && method === 'PATCH') {
    const off = Array.isArray(b.off) ? [...new Set((b.off as unknown[]).map(String))] : null;
    if (!off || off.some((k) => !barber(k))) throw new HttpError(400, 'Off today: barbers in the team only.');
    const notice = b.notice === null || b.notice === undefined || String(b.notice).trim() === '' ? null : String(b.notice).trim();
    if (notice && notice.length > 160) throw new HttpError(400, 'The notice is one line, 160 characters at most.');
    await repo.setToday(t.id, { date: today, off, notice });
    const day = await repo.listBookings(t.id, new Date(now.getTime() - 86400000), new Date(now.getTime() + 2 * 86400000));
    const moving = day.filter((x) => toLocal(x.starts_at, p.timezone).date === today && off.includes(x.resource_key) && (x.visit_status ?? 'expected') === 'expected').length;
    const who = off.map((k) => barber(k)!.label);
    return off.length
      ? `Off today: ${who.join(' and ')}.${moving ? ` ${moving} booking${moving === 1 ? ' needs' : 's need'} a new time.` : ''}`
      : 'Everyone is in today.';
  }

  if (sub === 'walkins' && !id && method === 'POST') {
    const name = String(b.name ?? '').trim();
    if (!name || name.length > 40) throw new HttpError(400, 'A name for the walk-in, 40 characters at most.');
    const service = findService(p, String(b.service_key ?? ''));
    if (!service) throw new HttpError(400, 'A service from the price list.');
    const chair = b.resource_key === null || b.resource_key === undefined || b.resource_key === '' ? null : barber(b.resource_key);
    if (chair === undefined) throw new HttpError(400, 'A barber in the team, or anyone.');
    if (chair && !chair.services.includes(service.key)) throw new HttpError(400, `${chair.label} doesn't do a ${service.label.toLowerCase()}.`);
    await repo.addWalkIn(t.id, { name, phone: normaliseUkPhone(String(b.phone ?? '')) ?? null, service_key: service.key, resource_key: chair?.key ?? null, source: 'console', joined_at: now });
    return `${name} is waiting${chair ? ` for ${chair.label}` : ''}.`;
  }

  if (sub === 'walkins' && id && method === 'PATCH') {
    const w = await repo.getWalkIn(t.id, id);
    if (!w || w.served_at || w.left_at) throw new HttpError(404, "That walk-in isn't waiting.");
    if (b.action === 'left') {
      await repo.closeWalkIn(t.id, id, { left_at: now });
      return `${w.name} has gone.`;
    }
    if (b.action !== 'serve') throw new HttpError(400, 'Serve or left.');
    const chair = barber(b.resource_key);
    if (!chair) throw new HttpError(400, 'Which barber?');
    const shop = await repo.getToday(t.id, today);
    if (!inOn(p, chair.key, today, shop)) throw new HttpError(409, `${chair.label} isn't in today.`);
    if (!chair.services.includes(w.service_key)) throw new HttpError(409, `${chair.label} doesn't do that.`);
    const r = await repo.createBooking(t, {
      service: w.service_key, date: today, time: toLocal(now, p.timezone).time, party_size: 1, name: w.name, phone: w.phone,
      staff: chair.key, source: 'console', ignoreLead: true, tags: ['walk_in'],
    }, now);
    if (!r.ok) throw new HttpError(409, `${chair.label}'s chair isn't free now.`);
    await repo.setVisitStatus(t.id, r.booking.reference, 'arrived');
    await repo.closeWalkIn(t.id, id, { served_at: now, booking_id: r.booking.id });
    return `${w.name} is in ${chair.label}'s chair.`;
  }

  if (sub === 'waitlist' && id && method === 'PATCH') {
    if (b.action !== 'remove') throw new HttpError(400, 'Remove only.');
    if (!(await repo.removeFromWaitlist(t.id, id, now))) throw new HttpError(404, "That isn't on the waiting list.");
    return 'Taken off the waiting list.';
  }
  return null;
}
