// The booking engine: tables, treatments and chairs are the same problem.
// A service needs a resource for a length of time, inside a window, under rules.
//
// Pure functions over the profile and the existing bookings. The repository
// calls checkSlot() again inside the booking transaction, with the tenant row
// locked, so two callers can never take the last table between check and commit.

import type { BookableService, Resource, TenantProfile } from './types.ts';
import { insideRule, type ListingRule } from './listings.ts';
import {
  LAST_START, addDays, closeMinutes, isIsoDate, minutesOf, normaliseTime, spokenDate, spokenTime, timeOf, toLocal, weekdayOf, zonedToUtc,
} from './time.ts';

export interface BusyInterval {
  id?: string;
  resource_key: string;
  starts_at: Date;
  ends_at: Date;
  buffer_minutes?: number;
  /** A viewing's home: two viewings of one home never overlap, whoever shows them. */
  listing_key?: string | null;
}

export interface SlotRequest {
  profile: TenantProfile;
  serviceKey?: string;
  date: string;
  time?: string;
  partySize: number;
  staff?: string;
  now: Date;
  existing: BusyInterval[];
  /** When moving a booking, its own interval does not block it. */
  excludeBookingId?: string;
  /** Tables: only this seating area (inside, terrace). */
  area?: string;
  /** Tables: step-free with room for a wheelchair. A hard requirement. */
  accessible?: boolean;
  /** Tables: nice to have (window, booth, quiet); tables with more of them are tried first. */
  prefer?: string[];
  /** When changing a booking: its current table, kept if it still fits. */
  keep?: string;
  /** Tables: only this one (the caller asked for "table 4"). */
  only?: string;
  /**
   * A viewing: the home's own rules on top of the service's (its windows,
   * notice, blocked dates, who may not show it, office hours for an empty
   * home). Only the estate agent's tools pass it; without it nothing changes.
   */
  listing?: ListingRule;
}

export interface Slot {
  time: string;
  resource_key: string;
  starts_at: Date;
  ends_at: Date;
}

export type Unavailable =
  | 'unknown_service'
  | 'bad_date'
  | 'bad_time'
  | 'closed'
  | 'in_the_past'
  | 'too_far_ahead'
  | 'party_too_large'
  | 'no_suitable_resource'
  | 'unknown_staff'
  | 'outside_hours'
  | 'fully_booked';

export interface AvailabilityResult {
  available: boolean;
  service: string;
  date: string;
  spoken_date: string;
  party_size: number;
  requested_time?: string;
  slot?: {
    time: string; spoken: string; resource_key: string; resource_label: string; duration_minutes: number;
    /** Tables in a business with seating areas. */
    area?: string;
    weather_note?: string;
    accessible?: boolean;
    features?: string[];
  };
  alternatives: { time: string; spoken: string }[];
  available_ranges?: string[];
  /** More than one area has a table free at that time: ask which the caller would like. */
  areas_free?: string[];
  /** The asked-for area is full then, but these are not. */
  other_areas_free?: string[];
  /** Sittings that day with nothing left ("lunch"): full, not closed. */
  fully_booked?: string[];
  reason?: Unavailable;
  message?: string;
}

export function findService(profile: TenantProfile, key?: string): BookableService | undefined {
  const services = profile.booking?.services ?? [];
  if (!key) return services[0];
  const k = key.trim().toLowerCase();
  return (
    services.find((s) => s.key.toLowerCase() === k) ??
    services.find((s) => s.label.toLowerCase() === k) ??
    services.find((s) => s.label.toLowerCase().includes(k) || k.includes(s.label.toLowerCase())) ??
    services.find((s) => k.split(/\s+/).some((w) => w.length > 3 && s.label.toLowerCase().includes(w)))
  );
}

export function durationFor(service: BookableService, party: number): number {
  if (service.kind === 'appointment') return service.duration_minutes ?? service.slot_minutes;
  const rules = [...(service.duration_rules ?? [])].sort((a, b) => a.max_party - b.max_party);
  for (const r of rules) if (party <= r.max_party) return r.minutes;
  return rules.length ? rules[rules.length - 1].minutes : 90;
}

export function candidateTimes(service: BookableService, date: string): string[] {
  const wd = weekdayOf(date);
  const set = new Set<number>();
  for (const w of service.windows) {
    if (!w.days.includes(wd)) continue;
    // Nothing starts at midnight: that is the next day's first minute.
    for (let t = minutesOf(w.first); t <= Math.min(minutesOf(w.last), LAST_START); t += service.slot_minutes) set.add(t);
  }
  return [...set].sort((a, b) => a - b).map(timeOf);
}

/** A resource blocks itself, everything it combines, and every combination it is part of. */
export function blockingKeys(key: string, resources: Resource[]): Set<string> {
  const out = new Set<string>([key]);
  const r = resources.find((x) => x.key === key);
  for (const part of r?.combines ?? []) out.add(part);
  for (const other of resources) {
    if (other.combines?.includes(key)) out.add(other.key);
    if (r?.combines && other.combines?.some((p) => r.combines!.includes(p))) out.add(other.key);
  }
  return out;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Staff moves: is this table free for this interval (pushed-together pairs and their parts count)? */
export function resourceFree(
  key: string, start: Date, end: Date, buffer: number, existing: BusyInterval[], resources: Resource[], excludeId?: string,
): boolean {
  return isFree(key, start, end, buffer, existing, resources, excludeId);
}

function isFree(
  key: string,
  start: Date,
  end: Date,
  buffer: number,
  existing: BusyInterval[],
  resources: Resource[],
  excludeId?: string,
): boolean {
  const keys = blockingKeys(key, resources);
  const s = start.getTime();
  const e = end.getTime() + buffer * 60000;
  for (const b of existing) {
    if (excludeId && b.id === excludeId) continue;
    if (!keys.has(b.resource_key)) continue;
    const bEnd = b.ends_at.getTime() + (b.buffer_minutes ?? 0) * 60000;
    if (overlaps(s, e, b.starts_at.getTime(), bEnd)) return false;
  }
  return true;
}

export function suitableResources(
  service: BookableService,
  resources: Resource[],
  party: number,
  staff?: string,
  needs: { area?: string; accessible?: boolean; prefer?: string[]; only?: string; weekday?: number } = {},
): Resource[] | 'unknown_staff' {
  let list = resources.filter((r) => r.services.includes(service.key));
  // Someone who works only some days cannot be booked on the others.
  if (needs.weekday !== undefined) list = list.filter((r) => !r.days || r.days.includes(needs.weekday!));
  if (service.kind === 'table') {
    if (needs.only) list = list.filter((r) => r.key === needs.only);
    list = list.filter((r) => (r.capacity ?? 0) >= party && (r.min ?? 1) <= party);
    if (needs.area) list = list.filter((r) => r.area === needs.area);
    if (needs.accessible) list = list.filter((r) => r.accessible);
    const liked = (r: Resource) => (needs.prefer ?? []).filter((f) => r.features?.includes(f)).length;
    // Most wanted features first, then the smallest table that fits, then single tables before pushed-together pairs.
    list.sort((a, b) => liked(b) - liked(a) || (a.capacity ?? 0) - (b.capacity ?? 0) || (a.combines ? 1 : 0) - (b.combines ? 1 : 0));
  } else if (staff && !/^any/i.test(staff.trim())) {
    const s = staff.trim().toLowerCase();
    const named = list.filter((r) => r.key.toLowerCase() === s || r.label.toLowerCase().startsWith(s));
    if (!named.length) return 'unknown_staff';
    list = named;
  }
  return list;
}

/** Is this exact time bookable? Returns the resource it would use. */
export function checkSlot(req: SlotRequest, service: BookableService, time: string): Slot | null {
  const { profile } = req;
  const resources = profile.booking?.resources ?? [];
  const rule = req.listing;
  // Only the estate agent's people carry working days, so for anyone else this filters nothing.
  const res = suitableResources(service, resources, req.partySize, req.staff, { ...req, weekday: weekdayOf(req.date) });
  if (res === 'unknown_staff') return null;
  const starts = zonedToUtc(req.date, time, profile.timezone);
  const minutes = durationFor(service, req.partySize);
  const ends = new Date(starts.getTime() + minutes * 60000);
  const lead = (service.lead_minutes ?? 0) * 60000;
  if (starts.getTime() < req.now.getTime() + lead) return null;
  if (rule) {
    if (!insideRule(rule, req.date, minutesOf(time), minutesOf(time) + minutes)) return null;
    if (starts.getTime() < req.now.getTime() + rule.notice_minutes * 60000) return null;
    const home = req.existing.some((b) => b.listing_key === rule.key && b.id !== req.excludeBookingId && overlaps(starts.getTime(), ends.getTime(), b.starts_at.getTime(), b.ends_at.getTime()));
    if (home) return null;
  }
  const order = req.keep ? [...res.filter((r) => r.key === req.keep), ...res.filter((r) => r.key !== req.keep)] : res;
  for (const r of order) {
    if (rule?.exclude_staff.includes(r.key)) continue;
    if (isFree(r.key, starts, ends, service.buffer_minutes ?? 0, req.existing, resources, req.excludeBookingId)) {
      return { time, resource_key: r.key, starts_at: starts, ends_at: ends };
    }
  }
  return null;
}

/** Bookable areas with a table free at that time, when a business has more than one ("inside or on the terrace?"). */
export function areasFreeAt(req: SlotRequest, service: BookableService, time: string): string[] {
  const areas = (req.profile.booking?.areas ?? []).filter((a) => a.reservable && !a.enquiry_only);
  if (areas.length < 2) return [];
  return areas.filter((a) => checkSlot({ ...req, area: a.key }, service, time)).map((a) => a.label);
}

function ranges(times: string[], step: number): string[] {
  const out: string[] = [];
  let start: string | null = null;
  let prev = -Infinity;
  for (const t of times) {
    const m = minutesOf(t);
    if (start === null) {
      start = t;
    } else if (m - prev !== step) {
      out.push(start === timeOf(prev) ? spokenTime(start) : `${spokenTime(start)} to ${spokenTime(timeOf(prev))}`);
      start = t;
    }
    prev = m;
  }
  if (start !== null) out.push(start === timeOf(prev) ? spokenTime(start) : `${spokenTime(start)} to ${spokenTime(timeOf(prev))}`);
  return out;
}

export function checkAvailability(req: SlotRequest): AvailabilityResult {
  const { profile } = req;
  const service = findService(profile, req.serviceKey);
  const base = {
    service: service?.key ?? String(req.serviceKey ?? ''),
    date: req.date,
    spoken_date: isIsoDate(req.date) ? spokenDate(req.date) : req.date,
    party_size: req.partySize,
    alternatives: [] as { time: string; spoken: string }[],
  };
  const no = (reason: Unavailable, message: string): AvailabilityResult => ({ ...base, available: false, reason, message });

  if (!service) return no('unknown_service', `There is no bookable service called "${req.serviceKey}".`);
  if (!isIsoDate(req.date)) return no('bad_date', 'The date must be YYYY-MM-DD.');
  const requested = req.time === undefined || req.time === '' ? undefined : normaliseTime(req.time);
  if (req.time && !requested) return no('bad_time', 'The time must be HH:MM, 24-hour.');

  const today = toLocal(req.now, profile.timezone).date;
  if (req.date < today) return no('in_the_past', 'That date has already passed.');
  const closure = profile.closures?.find((c) => c.date === req.date);
  if (closure) return no('closed', `Closed that day${closure.note ? `: ${closure.note}` : ''}.`);
  if (req.date > addDays(today, service.horizon_days ?? 90)) {
    return no('too_far_ahead', `Bookings open ${service.horizon_days ?? 90} days ahead.`);
  }
  if (service.max_party && req.partySize > service.max_party) {
    return no('party_too_large', service.large_party_note ?? `Phone bookings are for up to ${service.max_party}.`);
  }
  const res = suitableResources(service, profile.booking?.resources ?? [], req.partySize, req.staff, req);
  if (res === 'unknown_staff') return no('unknown_staff', `Nobody called "${req.staff}" does ${service.label}.`);
  if (!res.length) {
    const where = req.area ? profile.booking?.areas?.find((a) => a.key === req.area)?.label.toLowerCase() : undefined;
    const what = [req.accessible ? 'a step-free table' : null, where ? `the ${where}` : null].filter(Boolean).join(' in ');
    return no('no_suitable_resource', what ? `There is no ${what} for a party of ${req.partySize}.` : `Nothing suits a party of ${req.partySize}.`);
  }

  const times = candidateTimes(service, req.date);
  if (!times.length) return no('closed', `No ${service.label} bookings on ${base.spoken_date}.`);

  const free = times.filter((t) => checkSlot(req, service, t) !== null);
  const result: AvailabilityResult = { ...base, available: false, alternatives: [] };

  // Each sitting that has nothing left, by its name ("lunch"), so a full lunch is never mistaken for a closed one.
  // Today, a sitting already over is over, not full: "lunch is fully booked" at 3pm misled every caller about tonight.
  const wd = weekdayOf(req.date);
  const earliest = req.date === today ? minutesOf(toLocal(req.now, profile.timezone).time) + (service.lead_minutes ?? 0) : -1;
  const full = service.windows
    .filter((w) => w.days.includes(wd) && minutesOf(w.last) >= earliest)
    .filter((w) => !free.some((t) => t >= w.first && t <= w.last))
    .map((w) => {
      const first = minutesOf(w.first);
      const h = profile.opening_hours.find((x) => x.days.includes(wd) && minutesOf(x.open) <= first && first < closeMinutes(x.close));
      return h?.label && !/all day/i.test(h.label) ? h.label.toLowerCase() : `${spokenTime(w.first)} to ${spokenTime(w.last)}`;
    });
  if (full.length && free.length) result.fully_booked = full;

  if (!requested) {
    result.available = free.length > 0;
    result.available_ranges = ranges(free, service.slot_minutes);
    if (!free.length) {
      result.reason = 'fully_booked';
      result.message = `Fully booked on ${base.spoken_date} (open, but nothing left).`;
    }
    return result;
  }

  result.requested_time = requested;
  const slot = times.includes(requested) ? checkSlot(req, service, requested) : null;
  if (slot) {
    const r = profile.booking!.resources.find((x) => x.key === slot.resource_key)!;
    const area = r.area ? profile.booking?.areas?.find((a) => a.key === r.area) : undefined;
    result.available = true;
    result.slot = {
      time: requested,
      spoken: spokenTime(requested),
      resource_key: r.key,
      resource_label: r.label,
      duration_minutes: durationFor(service, req.partySize),
      area: area?.label,
      weather_note: area?.weather_note,
      accessible: r.accessible || undefined,
      features: r.features?.length ? r.features : undefined,
    };
    if (!req.area) {
      const free = areasFreeAt(req, service, requested);
      if (free.length > 1) result.areas_free = free;
    }
    return result;
  }

  // The asked-for area is full at that time: say which other areas are free then, before other times.
  if (req.area && times.includes(requested)) {
    const others = areasFreeAt({ ...req, area: undefined }, service, requested);
    if (others.length) result.other_areas_free = others;
  }
  // Two nearest free times either side, never a list of ten.
  // Within three hours of the request: lunch is not an alternative to dinner.
  const target = minutesOf(requested);
  const near = free.filter((t) => Math.abs(minutesOf(t) - target) <= (req.accessible ? 360 : 180));
  const before = near.filter((t) => minutesOf(t) < target).slice(-2);
  const after = near.filter((t) => minutesOf(t) > target).slice(0, 2);
  result.alternatives = [...before, ...after].map((t) => ({ time: t, spoken: spokenTime(t) }));
  // Nothing close: say what is free that day, rather than nothing.
  if (!result.alternatives.length && free.length) result.available_ranges = ranges(free, service.slot_minutes);
  result.reason = times.includes(requested) ? 'fully_booked' : 'outside_hours';
  const kind = [req.accessible ? 'step-free' : null].filter(Boolean).join(' ');
  const areaInfo = req.area ? profile.booking?.areas?.find((a) => a.key === req.area) : undefined;
  const where = !areaInfo ? '' : areaInfo.kind === 'indoor' ? ' inside' : areaInfo.kind === 'outdoor' ? ` on the ${areaInfo.label.toLowerCase()}` : ` in the ${areaInfo.label.toLowerCase()}`;
  result.message = times.includes(requested)
    ? `${spokenTime(requested)} is taken${kind || where ? ` for a ${kind ? `${kind} ` : ''}table${where}` : ''}.`
    : `${spokenTime(requested)} is not a bookable time for ${service.label} on ${base.spoken_date}.`;
  if (!free.length) result.message += ` Nothing else is free that day either.`;
  return result;
}

export function depositFor(service: BookableService, party: number): number {
  const d = service.deposit;
  if (!d) return 0;
  if (d.min_party && party < d.min_party) return 0;
  return (d.flat_pence ?? 0) + (d.per_person_pence ?? 0) * party;
}
