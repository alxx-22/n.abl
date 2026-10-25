// A home's tenure as the listings editor changes it. Kept apart from the
// component so a test can drive it.

import type { Tenure } from '../../../../../src/domain/types.ts';
import type { LeaseAnswer, ListingAnswer } from '../../../../../src/presets/estate/answers.ts';

export const blankLease = (): LeaseAnswer => ({ expires: '', service_charge: '', ground_rent: '', reserve_fund: '', event_fee: '', managing_agent: '', age_limit: null, shared: null });

const LEASED: Tenure[] = ['leasehold', 'share_of_freehold', 'shared_ownership'];

/**
 * A lease or share block hidden by another tenure is kept, not cleared: a
 * slip from shared ownership and back must not lose the share, rent and
 * provider, and compile already ignores a block the tenure hides.
 */
export function setTenure(x: ListingAnswer, v: Tenure): void {
  x.tenure = v;
  if (LEASED.includes(v) && !x.lease) x.lease = blankLease();
  if (v === 'shared_ownership' && x.lease && !x.lease.shared) x.lease.shared = { share_percent: 50, rent_pence_month: 0, provider: '', eligibility: '', nomination_weeks: 0 };
}
