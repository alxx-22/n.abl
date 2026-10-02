// A believable week for a restaurant the prospect has just built: bookings
// shaped by their own tables, areas, hours and sittings, today's takeaway
// orders from their own menu, and a couple of messages. Planned in memory
// with the same availability rules the receptionist uses, then written in a
// few bulk inserts, so Start takes a second rather than a minute.
//
// Deterministic for a given seed, so tests can check the invariants. The
// bookings, the orders and the messages share one set of dice, drawn from in
// that order.

import type { TenantProfile } from '../../domain/types.ts';
import { ids, rng } from '../common/random.ts';
import type { SeedMessage, SeedPlan } from '../common/types.ts';
import { planOrders } from '../food/seed.ts';
import { planTableBookings } from '../seating/seed.ts';

export { rng, seedFrom } from '../common/random.ts';
export type { SeedBooking, SeedMessage, SeedOrder, SeedPlan } from '../common/types.ts';
export { occupancy } from '../seating/seed.ts';

export function planRestaurantSeed(profile: TenantProfile, now: Date, seed: number, days = 7): SeedPlan {
  const random = rng(seed);
  const id = ids(random);
  const bookings = planTableBookings(profile, now, random, id, days);
  // Takeaway: today's orders across the collection slots.
  const orders = planOrders(profile, now, random, id);

  const hasPrivate = (profile.booking?.areas ?? []).some((a) => a.kind === 'private' || a.enquiry_only);
  const messages: SeedMessage[] = [
    {
      from_name: id.person(),
      from_phone: id.phone(),
      body: hasPrivate
        ? 'Would like the private room for 16 people on a Saturday next month, for a 40th. Please call back with prices.'
        : 'Asking about a table for 14 on a Saturday next month for a 40th birthday. Please call back.',
    },
    { from_name: id.person(), from_phone: id.phone(), body: 'Left a black umbrella at table 6 last night. Will pick it up if you have it.' },
  ];
  return { bookings, orders, messages };
}
