// A seeded week replayed through the availability check (PRESETS.md §4):
// sorted by start, each booking must be what checkSlot gives with the
// earlier ones already booked, at a time its service offers, on the same
// table or person, under its home's rules for a viewing, and an estate
// agency's buyer at one home at a time. The seed skips only the notice
// period, as it does for rows already in the past.

import { candidateTimes, checkSlot, findService, type BusyInterval } from '../src/domain/availability.ts';
import { viewingRules } from '../src/domain/listings.ts';
import { toLocal } from '../src/domain/time.ts';
import type { TenantProfile } from '../src/domain/types.ts';
import type { SeedPlan } from '../src/presets/common/types.ts';

/** What does not replay, in words: empty when every booking does. */
export function replaySeed(profile: TenantProfile, plan: SeedPlan): string[] {
  const out: string[] = [];
  const existing: BusyInterval[] = [];
  const sorted = [...plan.bookings].sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime() || a.reference.localeCompare(b.reference));
  for (const b of sorted) {
    const service = findService(profile, b.service_key ?? 'table');
    const l = toLocal(b.starts_at, profile.timezone);
    const say = `${b.reference} (${b.service_key ?? 'table'} ${l.date} ${l.time} on ${b.resource_key}${b.listing_key ? ` at ${b.listing_key}` : ''})`;
    if (!service) {
      out.push(`${say}: no such service`);
      continue;
    }
    if (!candidateTimes(service, l.date).includes(l.time)) out.push(`${say}: not a time the service offers`);
    const listing = b.listing_key ? profile.listings?.find((x) => x.key === b.listing_key) : undefined;
    if (b.listing_key && !listing) out.push(`${say}: no such home`);
    const row = plan.listings?.find((r) => r.listing_key === b.listing_key);
    const slot = checkSlot(
      {
        profile, serviceKey: service.key, date: l.date, time: l.time, partySize: b.party_size, now: new Date(0), existing,
        ...(service.kind === 'table' ? { only: b.resource_key, area: b.area_key ?? undefined } : { staff: b.resource_key }),
        listing: listing ? viewingRules(listing, profile, service.key, row) : undefined,
      },
      { ...service, lead_minutes: 0 },
      l.time,
    );
    if (!slot) out.push(`${say}: not free, or not allowed`);
    else if (slot.resource_key !== b.resource_key || slot.ends_at.getTime() !== b.ends_at.getTime()) out.push(`${say}: checkSlot gives ${slot.resource_key} until ${slot.ends_at.toISOString()}`);
    // An estate agency's buyer is at one place at a time, travel included: the longer of the two bookings' travel times.
    const gapAfter = (x: typeof b) => Math.max(b.buffer_minutes ?? 0, x.buffer_minutes ?? 0) * 60000;
    const clash = profile.listings && b.phone ? sorted.find((x) => x !== b && x.phone === b.phone && x.starts_at <= b.starts_at && b.starts_at.getTime() < x.ends_at.getTime() + gapAfter(x)) : undefined;
    if (clash) out.push(`${say}: ${b.name} is still at ${clash.reference}`);
    existing.push({ id: b.reference, resource_key: b.resource_key, starts_at: b.starts_at, ends_at: b.ends_at, buffer_minutes: b.buffer_minutes ?? 0, listing_key: b.listing_key ?? null });
  }
  return out;
}
