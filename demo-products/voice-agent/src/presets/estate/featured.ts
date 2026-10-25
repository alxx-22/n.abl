// Which homes play which part in the demo's story (presets/estate-agent.md
// §7): the seller who rings for an update, the flat with a short lease, the
// house a caller views on Saturday and offers on. Picked by rule rather
// than by key, so a prospect who deletes one of the sample homes gets the
// next that fits, and the seed, the suggestions and the evaluations agree.

import type { Listing, TenantProfile } from '../../domain/types.ts';

export interface Featured {
  /** The seller who rings for an update: a home under offer. */
  seller: Listing | null;
  /** A leasehold flat for sale: its lease is said first. */
  flat: Listing | null;
  /** The house a caller views on Saturday and offers on: freehold, with the seller's own viewing hours. */
  house: Listing | null;
  /** The busy Saturday's other home, shown at 10:30 by the house's negotiator. */
  busy: Listing | null;
  /** A second home under offer, with best and final. */
  bestFinal: Listing | null;
  /** Sales in progress: the first sale agreed, the second, and the one exchanged. */
  agreed: Listing | null;
  chain: Listing | null;
  exchanged: Listing | null;
  /** A price reduced this week, with an offer declined. */
  reduced: Listing | null;
  comingSoon: Listing | null;
}

const doesViewings = (profile: TenantProfile, key: string) => Boolean(profile.team?.some((t) => t.key === key && t.does.includes('viewings')));

export function featured(profile: TenantProfile): Featured {
  const all = profile.listings ?? [];
  const is = (l: Listing, ...s: string[]) => s.includes(l.initial.status);
  const taken = new Set<string>();
  const pick = (test: (l: Listing) => boolean, ...fallbacks: ((l: Listing) => boolean)[]): Listing | null => {
    for (const t of [test, ...fallbacks]) {
      const l = all.find((x) => !taken.has(x.key) && t(x));
      if (l) return taken.add(l.key), l;
    }
    return null;
  };
  const flat = pick((l) => is(l, 'available') && l.type === 'flat' && l.tenure === 'leasehold' && !l.viewing.first_in_office_hours && !l.personal_interest);
  const house = pick(
    (l) => is(l, 'available') && l.tenure === 'freehold' && l.type !== 'flat' && l.viewing.windows.some((w) => w.days.includes(6)) && doesViewings(profile, l.negotiator),
    (l) => is(l, 'available') && l.tenure === 'freehold' && !l.say_first.length && !l.viewing.first_in_office_hours && doesViewings(profile, l.negotiator),
  );
  const seller = pick((l) => is(l, 'under_offer'), (l) => is(l, 'available') && !l.say_first.length);
  const busy = pick(
    (l) => is(l, 'available') && l.marketed_days_ago === 0 && !l.say_first.length && !l.viewing.first_in_office_hours,
    (l) => is(l, 'available') && !l.say_first.length && !l.viewing.first_in_office_hours && !l.viewing.windows.length,
  );
  const bestFinal = pick((l) => is(l, 'under_offer'));
  const agreed = pick((l) => is(l, 'sale_agreed'));
  const chain = pick((l) => is(l, 'sale_agreed'));
  const exchanged = pick((l) => is(l, 'exchanged'));
  const reduced = pick((l) => is(l, 'available') && Boolean(l.reduced) && l.back_on_market_days_ago === null);
  const comingSoon = pick((l) => is(l, 'coming_soon'));
  return { seller, flat, house, busy, bestFinal, agreed, chain, exchanged, reduced, comingSoon };
}

/** What the call panel suggests saying, from the homes the demo actually has. */
export function suggestions(profile: TenantProfile): string[] {
  const f = featured(profile);
  const name = (l: Listing) => `${l.number} ${l.street}`.trim();
  const out: string[] = [];
  if (f.flat) out.push(`Tell me about the flat on ${f.flat.street}.`);
  if (f.house) out.push(`Can I view ${name(f.house)} on Saturday at 11?`);
  out.push("What's my house worth? Next door went for four hundred.");
  if (f.house) out.push(`I'd like to make an offer on ${name(f.house)}.`);
  out.push("I've got a viewing, reference {ref}. Can I move it?");
  // M2: the people the agency knows (Call as Sarah for the first; anyone for the second).
  if (f.seller) out.push(`Calling as Sarah: how's it going at ${f.seller.street}?`);
  out.push("Put me on your list: a three-bed with a garden, and text me when one comes up.");
  return out;
}
