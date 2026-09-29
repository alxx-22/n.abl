// The booking engine: tables, treatments and chairs are the same problem.
// A service needs a resource for a length of time, inside a window, under rules.
//
// Pure functions over the profile and the existing bookings. The repository
// calls checkSlot() again inside the booking transaction, with the tenant row
// locked, so two callers can never take the last table between check and commit.

import type { BookableService, Resource, TenantProfile } from './types.ts';
import {
  addDays, isIsoDate, minutesOf, normaliseTime, spokenDate, spokenTime, timeOf, toLocal, weekdayOf, zonedToUtc,
} from './time.ts';

export interface BusyInterval {
  id?: string;
  resource_key: string;
  starts_at: Date;
  ends_at: Date;
  buffer_minutes?: number;
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
  slot?: { time: string; spoken: string; resource_key: string; resource_label: string; duration_minutes: number };
  alternatives: { time: string; spoken: string }[];
  available_ranges?: string[];
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
    for (let t = minutesOf(w.first); t <= minutesOf(w.last); t += service.slot_minutes) set.add(t);
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
): Resource[] | 'unknown_staff' {
  let list = resources.filter((r) => r.services.includes(service.key));
  if (service.kind === 'table') {
    list = list.filter((r) => (r.capacity ?? 0) >= party && (r.min ?? 1) <= party);
    list.sort((a, b) => (a.capacity ?? 0) - (b.capacity ?? 0));
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
  const res = suitableResources(service, resources, req.partySize, req.staff);
  if (res === 'unknown_staff') return null;
  const starts = zonedToUtc(req.date, time, profile.timezone);
  const minutes = durationFor(service, req.partySize);
  const ends = new Date(starts.getTime() + minutes * 60000);
  const lead = (service.lead_minutes ?? 0) * 60000;
  if (starts.getTime() < req.now.getTime() + lead) return null;
  for (const r of res) {
    if (isFree(r.key, starts, ends, service.buffer_minutes ?? 0, req.existing, resources, req.excludeBookingId)) {
      return { time, resource_key: r.key, starts_at: starts, ends_at: ends };
    }
  }
  return null;
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
  const res = suitableResources(service, profile.booking?.resources ?? [], req.partySize, req.staff);
  if (res === 'unknown_staff') return no('unknown_staff', `Nobody called "${req.staff}" does ${service.label}.`);
  if (!res.length) return no('no_suitable_resource', `Nothing suits a party of ${req.partySize}.`);

  const times = candidateTimes(service, req.date);
  if (!times.length) return no('closed', `No ${service.label} bookings on ${base.spoken_date}.`);

  const free = times.filter((t) => checkSlot(req, service, t) !== null);
  const result: AvailabilityResult = { ...base, available: false, alternatives: [] };

  if (!requested) {
    result.available = free.length > 0;
    result.available_ranges = ranges(free, service.slot_minutes);
    if (!free.length) {
      result.reason = 'fully_booked';
      result.message = `Nothing left on ${base.spoken_date}.`;
    }
    return result;
  }

  result.requested_time = requested;
  const slot = times.includes(requested) ? checkSlot(req, service, requested) : null;
  if (slot) {
    const r = profile.booking!.resources.find((x) => x.key === slot.resource_key)!;
    result.available = true;
    result.slot = {
      time: requested,
      spoken: spokenTime(requested),
      resource_key: r.key,
      resource_label: r.label,
      duration_minutes: durationFor(service, req.partySize),
    };
    return result;
  }

  // Two nearest free times either side, never a list of ten.
  // Within three hours of the request: lunch is not an alternative to dinner.
  const target = minutesOf(requested);
  const near = free.filter((t) => Math.abs(minutesOf(t) - target) <= 180);
  const before = near.filter((t) => minutesOf(t) < target).slice(-2);
  const after = near.filter((t) => minutesOf(t) > target).slice(0, 2);
  result.alternatives = [...before, ...after].map((t) => ({ time: t, spoken: spokenTime(t) }));
  result.reason = times.includes(requested) ? 'fully_booked' : 'outside_hours';
  result.message = times.includes(requested)
    ? `${spokenTime(requested)} is taken.`
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
