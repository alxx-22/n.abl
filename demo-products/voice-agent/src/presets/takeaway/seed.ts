// A takeaway's day so far, anchored to Start. For now today's collection
// orders from its own menu (the shared food seed, as the restaurant's) and
// a couple of messages; the Friday-night rush with deliveries, drivers and a
// full kitchen (presets/takeaway.md §7) replaces it as the kitchen is built.

import type { TenantProfile } from '../../domain/types.ts';
import { ids, rng } from '../common/random.ts';
import type { SeedPlan } from '../common/types.ts';
import { planOrders } from '../food/seed.ts';

export function planTakeawaySeed(profile: TenantProfile, now: Date, seed: number): SeedPlan {
  const random = rng(seed);
  const id = ids(random);
  const orders = planOrders(profile, now, random, id);
  return {
    bookings: [],
    orders,
    messages: [
      { from_name: id.person(), from_phone: id.phone(), body: 'Wanting 30 wraps and some fries for an office lunch next Friday. Please call back with a price.' },
      { from_name: id.person(), from_phone: id.phone(), body: 'Asking whether you are hiring delivery drivers for weekends.' },
    ],
  };
}
