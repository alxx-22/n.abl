// The estate agency's fortnight, anchored to the moment Start (or Reset) is
// pressed (presets/estate-agent.md §7): its homes as they stand, viewings
// for the week gone and the nine days ahead, valuations, offers, sales in
// progress, the buyers it knows, messages and texts already on phones.
//
// Deterministic for a seed. Every viewing and valuation is placed through
// the same availability check a live booking goes through, with each
// home's own rules; past ones skip only the notice period. The story is
// staged first (the busy Saturday, the seller's week, Priya's free morning)
// and the rest is filled around it. Names come from the shared lists but
// never a member of staff's; numbers from Ofcom's drama range, with 900001
// to 900009 kept for the people callers can ring as.

import { candidateTimes, checkSlot, findService, type BusyInterval } from '../../domain/availability.ts';
import {
  addWorkingDays, initialLive, insideRule, isWorkingDay, offerReceivedText, offerSentText, positionBadges, shortAddress, viewingRules, viewingText, type ListingLive,
} from '../../domain/listings.ts';
import { addDays, minutesOf, toLocal, weekdayOf, zonedToUtc } from '../../domain/time.ts';
import { SALE_MILESTONES, type Buyer, type BuyerPosition, type HomeType, type Listing, type ListingState, type Offer, type Sale, type StaffMember, type TenantProfile } from '../../domain/types.ts';
import { FIRST_NAMES, LAST_NAMES, ids, rng } from '../common/random.ts';
import type { SeedBooking, SeedMessage, SeedPlan, SeedText } from '../common/types.ts';
import { featured } from './featured.ts';

/** The people a caller can ring as (M2's Call as), and the evaluations use: fixed numbers, fixed parts. */
export const PERSONAS = {
  seller: { phone: '+447700900001', name: 'Sarah Collins' },
  sam: { phone: '+447700900002', name: 'Sam Price' },
  aisha: { phone: '+447700900003', name: 'Aisha Khan' },
  ben: { phone: '+447700900004', name: 'Ben Walker' },
  solicitor: { phone: '+447700900005', name: 'Nadia Osei' },
  chainAgent: { phone: '+447700900006', name: 'Harper & Co' },
  megan: { phone: '+447700900007', name: 'Megan Hughes' },
  liam: { phone: '+447700900008', name: 'Liam Doyle' },
  nobody: { phone: '+447700900009', name: '' },
} as const;

/** Viewers' words after a viewing, by what they mean. */
const FEEDBACK: Record<string, string[]> = {
  keen: ['Really liked it; the light in the living room is lovely.', 'Liked the area and the size of the rooms.'],
  second_viewing: ['Loved the garden; would like to see it again with family.', 'Would like a second look before deciding.'],
  likely_offer: ['Thinking about an offer; checking with the mortgage adviser.', 'Very keen; likely to make an offer this week.'],
  not_for_me: ['The garden is smaller than we need.', 'The road is busier than we expected.', 'The kitchen would need too much work.', 'Bedrooms smaller than the photos suggest.'],
};

const DAY = 86400000;
const HOUR = 3600000;

interface Person {
  name: string;
  phone: string;
  position: BuyerPosition;
  postcode: string;
  requirements: NonNullable<Buyer['details']['requirements']>;
  consent: Date | null;
  investor?: boolean;
}

export function planEstateSeed(profile: TenantProfile, now: Date, seed: number): SeedPlan {
  const random = rng(seed);
  const { pick, ref } = ids(random);
  const tz = profile.timezone;
  const today = toLocal(now, tz).date;
  const at = (date: string, time: string) => zonedToUtc(date, time, tz);
  const local = (d: Date) => toLocal(d, tz);
  const listings = profile.listings ?? [];
  const team: StaffMember[] = profile.team ?? [];
  const estate = profile.estate;
  const agency = profile.name;
  const f = featured(profile);
  const nation = estate?.nation ?? 'england';
  const firstName = (key: string) => team.find((t) => t.key === key)?.first_name ?? key;
  const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

  // ── People: never a member of staff's first name, nor a persona's ──────
  const takenFirst = new Set([...team.map((t) => t.first_name), ...Object.values(PERSONAS).map((p) => p.name.split(' ')[0])]);
  const firsts = FIRST_NAMES.filter((n) => !takenFirst.has(n));
  const usedNames = new Set<string>(Object.values(PERSONAS).map((p) => p.name));
  const usedPhones = new Set<string>([...Object.values(PERSONAS).map((p) => p.phone), ...team.map((t) => `+44${t.mobile.replace(/\D/g, '').replace(/^0/, '')}`)]);
  const newName = () => {
    for (;;) {
      const n = `${pick(firsts)} ${pick(LAST_NAMES)}`;
      if (!usedNames.has(n)) return usedNames.add(n), n;
    }
  };
  const newPhone = () => {
    for (;;) {
      const p = `+447700900${String(30 + Math.floor(random() * 970)).padStart(3, '0')}`;
      if (!usedPhones.has(p)) return usedPhones.add(p), p;
    }
  };
  const districts = estate?.districts.length ? estate.districts : ['BK1'];
  const POST = 'ABDEFGHJLNPQRSTUWXYZ';
  const postcodeIn = (d: string) => `${d} ${between(1, 9)}${POST[Math.floor(random() * POST.length)]}${POST[Math.floor(random() * POST.length)]}`;
  const prices = listings.map((l) => l.initial.price_pence).filter((p) => p > 0);
  const TYPES: HomeType[] = ['terraced', 'semi', 'detached', 'flat', 'bungalow', 'cottage'];
  const position = (): BuyerPosition => {
    const r = random();
    if (r < 0.3) return { first_time_buyer: true, selling: 'nothing', funding: random() < 0.7 ? 'mortgage_aip' : 'mortgage_not_yet' };
    if (r < 0.5) return { first_time_buyer: false, selling: 'nothing', funding: 'cash' };
    if (r < 0.8) return { first_time_buyer: false, selling: random() < 0.4 ? 'under_offer' : 'on_market', funding: random() < 0.6 ? 'mortgage_aip' : 'cash' };
    return { first_time_buyer: false, selling: 'not_on_market', funding: random() < 0.6 ? 'mortgage_aip' : 'mortgage_not_yet' };
  };
  const person = (name = newName(), phone = newPhone(), pos = position()): Person => {
    const budget = prices.length ? pick(prices) : 25_000_000;
    return {
      name, phone, position: pos, postcode: postcodeIn(pick(districts)),
      requirements: {
        areas: [...new Set([pick(districts), pick(districts)])],
        max_price_pence: Math.round((budget * (1 + random() * 0.15)) / 500000) * 500000,
        min_beds: between(1, 4),
        types: [pick(TYPES)],
        must_haves: random() < 0.4 ? [pick(['garden', 'parking', 'no chain', 'step-free'])] : [],
        timescale: pick(['as soon as possible', 'within three months', 'within six months', 'just looking']),
      },
      consent: random() < 0.5 ? new Date(now.getTime() - between(1, 60) * DAY) : null,
    };
  };
  const pool: Person[] = Array.from({ length: 40 }, () => person());
  pool[0].investor = true;
  const sam = person(PERSONAS.sam.name, PERSONAS.sam.phone, { first_time_buyer: false, selling: 'not_on_market', funding: 'mortgage_aip' });
  const aisha = person(PERSONAS.aisha.name, PERSONAS.aisha.phone, { first_time_buyer: true, selling: 'nothing', funding: 'mortgage_aip' });
  const ben = person(PERSONAS.ben.name, PERSONAS.ben.phone, { first_time_buyer: true, selling: 'nothing', funding: 'mortgage_aip' });
  const megan = person(PERSONAS.megan.name, PERSONAS.megan.phone);
  const liam = person(PERSONAS.liam.name, PERSONAS.liam.phone, { first_time_buyer: false, selling: 'under_offer', funding: 'mortgage_aip' });
  const known = new Map<string, { p: Person; last: Date; source: string; backup_for?: string[] }>();
  const met = (p: Person, when: Date, source = 'viewing') => {
    const k = known.get(p.phone);
    if (!k) known.set(p.phone, { p, last: when, source });
    else if (when > k.last) k.last = when;
  };

  // ── Homes as they stand ─────────────────────────────────────────────────
  const live = new Map<string, ListingLive>(listings.map((l) => [l.key, initialLive(l, now)]));
  const sellers = new Map<string, { name: string; phone: string }[]>();
  for (const l of listings) {
    sellers.set(l.key, l.key === f.seller?.key ? [{ name: PERSONAS.seller.name, phone: PERSONAS.seller.phone }] : [{ name: newName(), phone: newPhone() }]);
  }
  // Best and final on the second home under offer: noon on the first Friday at least two days away.
  if (f.bestFinal) {
    let d = addDays(today, 2);
    while (weekdayOf(d) !== 5) d = addDays(d, 1);
    live.get(f.bestFinal.key)!.best_final_at = at(d, '12:00');
  }
  // The chain sale exchanges next week: its seller has stopped viewings.
  if (f.chain) live.get(f.chain.key)!.marketing_continues = false;

  // ── The diary ───────────────────────────────────────────────────────────
  const bookings: SeedBooking[] = [];
  const existing: BusyInterval[] = [];
  /** Time kept clear for the story: it blocks the seed only, so the receptionist finds it free. */
  const keep = (resource: string, date: string, from: string, to: string, listing?: string) =>
    existing.push({ id: `keep-${existing.length}`, resource_key: resource, listing_key: listing ?? null, starts_at: at(date, from), ends_at: at(date, to) });
  const viewers = team.filter((t) => t.does.includes('viewings'));
  const valuers = team.filter((t) => t.does.includes('valuations'));
  const works = (t: StaffMember, date: string) => t.days.includes(weekdayOf(date));
  const viewable = (l: Listing, date: string) => {
    const s = live.get(l.key)!;
    if (s.status === 'coming_soon') return l.viewings_from_days !== null && date >= addDays(today, l.viewings_from_days);
    return s.status === 'available' || s.status === 'under_offer' || (s.status === 'sale_agreed' && s.marketing_continues);
  };

  const place = (o: {
    service: string; date: string; time: string; staff?: string; listing?: Listing; who: { name: string; phone: string }; party?: number;
    details: Record<string, unknown>; status?: SeedBooking['visit_status']; via?: SeedBooking['booked_via'];
    /** Booked well before Start, so the notice period was met then. */
    early?: boolean;
  }): SeedBooking | null => {
    const service = findService(profile, o.service);
    if (!service || service.key !== o.service) return null;
    const starts = at(o.date, o.time);
    const past = o.early || starts.getTime() < now.getTime();
    const slot = checkSlot(
      {
        profile, serviceKey: service.key, date: o.date, time: o.time, partySize: o.party ?? 1, staff: o.staff, now: past ? new Date(0) : now, existing,
        listing: o.listing ? viewingRules(o.listing, profile, service.key, live.get(o.listing.key)) : undefined,
      },
      past ? { ...service, lead_minutes: 0 } : service,
      o.time,
    );
    if (!slot) return null;
    const b: SeedBooking = {
      reference: ref(),
      service_key: service.key,
      buffer_minutes: service.buffer_minutes ?? 0,
      resource_key: slot.resource_key,
      area_key: null,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      party_size: o.party ?? 1,
      name: o.who.name,
      phone: o.who.phone,
      notes: null,
      allergies: null,
      tags: [],
      deposit_pence: 0,
      deposit_paid: false,
      visit_status: o.status ?? (slot.ends_at <= now ? 'finished' : 'expected'),
      booked_via: o.via ?? pick(['receptionist', 'receptionist', 'staff', 'online']),
      listing_key: o.listing?.key,
      details: o.details,
    };
    existing.push({ id: `seed-${bookings.length}`, resource_key: b.resource_key, starts_at: b.starts_at, ends_at: b.ends_at, buffer_minutes: b.buffer_minutes, listing_key: b.listing_key ?? null });
    bookings.push(b);
    return b;
  };

  const viewingDetails = (l: Listing, p: Person, kind = 'viewing', extra: Record<string, unknown> = {}) => ({
    kind,
    position: p.position,
    badges: [...positionBadges(p.position), ...(l.viewing.occupied === 'vacant' ? ['ID check'] : [])],
    ...(estate?.safety.take_postcode ? { postcode: p.postcode } : {}),
    ...extra,
  });
  const feedbackOf = (category: string, when: Date, words = pick(FEEDBACK[category])) => ({ feedback: { category, words, source: 'staff', at: new Date(when.getTime() + 20 * HOUR).toISOString() } });

  /** Tries the times in order until one fits. */
  const tryTimes = (times: string[], fn: (t: string) => SeedBooking | null): SeedBooking | null => {
    for (const t of times) {
      const b = fn(t);
      if (b) return b;
    }
    return null;
  };
  const shuffled = <T>(xs: T[]) => xs.map((x) => [random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const viewingTimes = (date: string, service = 'viewing') => {
    const s = findService(profile, service);
    return s ? candidateTimes(s, date) : [];
  };
  /** The next day on or after `from` when the test holds, within a fortnight. */
  const nextDay = (from: string, test: (d: string) => boolean) => {
    for (let i = 0; i < 14; i++) if (test(addDays(from, i))) return addDays(from, i);
    return null;
  };
  const viewingDay = (d: string) => weekdayOf(d) !== 0 && viewingTimes(d).length > 0 && viewers.some((t) => works(t, d));
  /** The last day on or before `from` when the test holds. */
  const lastDay = (from: string, test: (d: string) => boolean) => {
    for (let i = 0; i < 7; i++) if (test(addDays(from, -i))) return addDays(from, -i);
    return from;
  };

  // The busy Saturday: the house's negotiator shows another home at 10:30,
  // a colleague is out at 11, and the house is kept free from 11 to 12, so
  // "Saturday at 11" there gives 11:15 with the negotiator.
  const saturday = nextDay(addDays(today, 1), (d) => weekdayOf(d) === 6);
  if (saturday && f.house) {
    const lead = team.find((t) => t.key === f.house!.negotiator && works(t, saturday));
    const other = viewers.find((t) => t.key !== lead?.key && works(t, saturday));
    if (lead && f.busy) {
      const p = pick(pool);
      place({ service: 'viewing', date: saturday, time: '10:30', staff: lead.key, listing: f.busy, who: p, details: viewingDetails(f.busy, p) }) && met(p, now);
    }
    const elsewhere = f.bestFinal ?? f.flat;
    if (other && elsewhere) {
      const p = pick(pool);
      place({ service: 'viewing', date: saturday, time: '11:00', staff: other.key, listing: elsewhere, who: p, details: viewingDetails(elsewhere, p) }) && met(p, now);
    }
    keep('__house__', saturday, '11:00', '12:00', f.house.key);
    if (lead) keep(lead.key, saturday, '11:15', '12:00');
  }
  // A weekday evening at the house is left for callers.
  const evening = f.house ? nextDay(addDays(today, 1), (d) => weekdayOf(d) >= 1 && weekdayOf(d) <= 5) : null;
  if (evening && f.house) keep('__house__', evening, '17:00', '19:00', f.house.key);

  // The seller's week: nine viewings since launch, three in the last seven
  // days (two with feedback, Sam's awaited), and two on the next viewing day.
  if (f.seller) {
    const l = f.seller;
    const earlier = [8, 11, 14, 17, 21, 26].filter((d) => d <= Math.max(8, l.marketed_days_ago));
    for (const [i, d] of earlier.entries()) {
      const date = lastDay(addDays(today, -d), viewingDay);
      // Aisha viewed it a week or so ago, before her offer.
      const p = i === 0 ? aisha : pick(pool);
      const b = tryTimes(shuffled(viewingTimes(date)), (t) => place({ service: 'viewing', date, time: t, listing: l, who: p, details: viewingDetails(l, p, 'viewing', feedbackOf(p === aisha ? 'likely_offer' : pick(['keen', 'not_for_me', 'second_viewing']), at(date, t))) }));
      if (b) met(p, b.starts_at);
    }
    const lastWeek: [number, Person, Record<string, unknown>][] = [
      [5, pick(pool), { feedback: { category: 'second_viewing', words: 'Loved the garden; the kitchen feels dated.', source: 'staff' } }],
      [4, pick(pool), { feedback: { category: 'not_for_me', words: 'Price feels high for the size.', source: 'staff' } }],
      [2, sam, { awaiting_feedback: true }],
    ];
    for (const [d, p, extra] of lastWeek) {
      const date = nextDay(addDays(today, -d), viewingDay) ?? addDays(today, -d);
      if (date >= today) continue;
      const b = tryTimes(shuffled(viewingTimes(date)), (t) => place({ service: 'viewing', date, time: t, listing: l, who: p, details: viewingDetails(l, p, 'viewing', extra) }));
      if (b) {
        met(p, b.starts_at);
        const fb = (b.details as { feedback?: { at?: string } }).feedback;
        if (fb) fb.at = new Date(b.ends_at.getTime() + 20 * HOUR).toISOString();
      }
    }
    const next = nextDay(addDays(today, 1), viewingDay);
    if (next) {
      for (let i = 0; i < 2; i++) {
        const p = pick(pool);
        const b = tryTimes(shuffled(viewingTimes(next)), (t) => place({ service: 'viewing', date: next, time: t, listing: l, who: p, details: viewingDetails(l, p) }));
        if (b) met(p, now);
      }
    }
  }

  // Sam's viewing tomorrow (or the next viewing day), confirmed by text yesterday.
  const texts: SeedText[] = [];
  const samHome = [f.reduced, f.busy, f.flat].find((l): l is Listing => Boolean(l && l.key !== f.seller?.key));
  const samDay = nextDay(addDays(today, 1), viewingDay);
  if (samHome && samDay) {
    const b = tryTimes(viewingTimes(samDay).filter((t) => t >= '10:00'), (t) => place({ service: 'viewing', date: samDay, time: t, listing: samHome, who: sam, details: viewingDetails(samHome, sam), via: 'receptionist' }));
    if (b) {
      met(sam, now);
      const when = local(b.starts_at);
      texts.push({ to: sam.phone, body: viewingText(agency, 'viewing', 'booked', when, shortAddress(samHome), firstName(b.resource_key), b.reference), created_at: new Date(now.getTime() - DAY) });
    }
  }

  // A second viewing, and one today for the "nobody's at the door" call.
  const second = listings.find((l) => l.personal_interest && viewable(l, today)) ?? f.busy;
  const secondDay = nextDay(addDays(today, 2), viewingDay);
  if (second && secondDay) {
    const p = pick(pool);
    const b = tryTimes(shuffled(viewingTimes(secondDay, 'second_viewing')), (t) => place({ service: 'second_viewing', date: secondDay, time: t, listing: second, who: p, details: viewingDetails(second, p, 'second_viewing') }));
    if (b) met(p, now);
  }
  if (viewingDay(today)) {
    const soon = viewingTimes(today).filter((t) => at(today, t).getTime() >= now.getTime() + 30 * 60000);
    const home = listings.find((l) => viewable(l, today) && !l.viewing.first_in_office_hours && !l.viewing.windows.length && l.key !== f.house?.key);
    if (home) {
      const p = pick(pool);
      const b = tryTimes(soon, (t) => place({ service: 'viewing', date: today, time: t, listing: home, who: p, details: viewingDetails(home, p), status: 'expected', early: true }));
      if (b) met(p, now);
    }
  }

  // The rest, around the story: a quieter week gone, a full nine days ahead.
  const viewingMinutes = findService(profile, 'viewing')?.duration_minutes ?? 30;
  for (let d = -7; d <= 9; d++) {
    const date = addDays(today, d);
    const wd = weekdayOf(date);
    if (wd === 0 || !viewingDay(date)) continue;
    const want = d < 0 ? (wd === 6 ? between(4, 5) : between(1, 2)) : wd === 6 ? between(8, 10) : between(2, 3);
    const have = bookings.filter((b) => b.listing_key && local(b.starts_at).date === date).length;
    // The seller's week is staged in full: the seller hears exactly those counts.
    const homes = listings.filter((l) => viewable(l, date) && l.key !== f.seller?.key);
    for (let n = have, tries = 0; n < want && tries < 60 && homes.length; tries++) {
      const l = pick(homes);
      const p = pick(pool);
      // Times the seller allows: a home viewed only on Saturday mornings is not tried at noon on a Tuesday.
      const rule = viewingRules(l, profile, 'viewing', live.get(l.key));
      const t = pick(viewingTimes(date).filter((x) => insideRule(rule, date, minutesOf(x), minutesOf(x) + viewingMinutes)));
      // Earlier today counts as the week gone (done, some with feedback), so Start pressed in the evening still shows a day's work; only a viewing under way now is skipped.
      if (!t || (d === 0 && at(date, t) <= now && at(date, t).getTime() + viewingMinutes * 60000 > now.getTime())) continue;
      const done = at(date, t).getTime() + 60 * 60000 <= now.getTime();
      const extra = done && random() < 0.7 ? feedbackOf(pick(Object.keys(FEEDBACK)), at(date, t)) : {};
      const b = place({ service: 'viewing', date, time: t, listing: l, who: p, details: viewingDetails(l, p, 'viewing', extra) });
      if (b) {
        n++;
        met(p, b.starts_at < now ? b.starts_at : now);
      }
    }
  }
  // One viewer last week did not turn up.
  const missed = bookings.find((b) => b.listing_key && b.ends_at < now && b.phone !== sam.phone && b.phone !== aisha.phone && !(b.details as { feedback?: unknown }).feedback);
  if (missed) missed.visit_status = 'no_show';

  // ── Valuations ──────────────────────────────────────────────────────────
  // Priya's mornings on her next two working days are kept free, so "Thursday
  // at 10" has room; the two booked then go in the afternoon.
  const valuer = valuers[0];
  const valuerDays: string[] = [];
  if (valuer) {
    for (let d = 1; valuerDays.length < 2 && d < 14; d++) {
      const date = addDays(today, d);
      if (works(valuer, date) && isWorkingDay(date, nation)) valuerDays.push(date);
    }
    for (const date of valuerDays) keep(valuer.key, date, '10:00', '11:30');
  }
  const valuation = (date: string, times: string[], details: Record<string, unknown>, who: { name: string; phone: string }, status?: SeedBooking['visit_status']) =>
    tryTimes(times, (t) => place({ service: 'valuation', date, time: t, staff: valuer?.key, who, details: { kind: 'valuation', purpose: 'sale', capacity: 'owner', owners_agree: true, ...details }, status, via: 'receptionist' }));
  const lead = (address: string, postcode: string, extra: Record<string, unknown>) => ({ address, postcode, property_type: 'semi', bedrooms: 3, heard_from: pick(['a board', 'Rightmove', 'a friend', 'a leaflet']), ...extra });
  const pastWork = [2, 3, 4, 5, 6].map((d) => addDays(today, -d)).filter((d) => valuer && works(valuer, d) && weekdayOf(d) !== 0);
  const afternoon = ['14:00', '15:30', '13:30', '16:00'];
  const valuationService = findService(profile, 'valuation');
  const anyTime = (date: string) => shuffled(valuationService ? candidateTimes(valuationService, date) : []);
  if (valuer) {
    const done = [
      lead(f.comingSoon ? `${f.comingSoon.number} ${f.comingSoon.street}` : '19 Copse Lane', f.comingSoon ? `${f.comingSoon.district} 3RL` : 'BK4 3RL', {
        property_type: 'cottage', reason: 'retiring to the coast', timescale: 'within three months', other_agent: null, needs_to_buy: false,
        dual_fee: false, hot: true, outcome: 'instructed', became: f.comingSoon?.key ?? null,
      }),
      lead('27 Bramble Drive', 'BK2 6JD', { reason: 'upsizing', timescale: 'within six months', other_agent: 'Harper & Co, sole agency', needs_to_buy: true, dual_fee: true, hot: true, outcome: 'lost', lost_to: 'Harper & Co' }),
      lead('4 Sorrel Way', 'BK3 2NP', { reason: 'downsizing', timescale: 'within six months', other_agent: null, needs_to_buy: true, dual_fee: false, hot: false, outcome: 'thinking', follow_up: addDays(today, 14) }),
    ];
    done.forEach((d, i) => {
      const date = pastWork[i] ?? addDays(today, -(i + 2));
      const p = person();
      valuation(date, anyTime(date), d, p, 'finished') && met(p, at(date, '12:00'), 'valuation');
    });
    const soon = [
      lead('Ivy Cottage, 3 Church Lane', 'BK4 1EW', { property_type: 'cottage', bedrooms: 2, capacity: 'executor', reason: "selling their late mother's home", timescale: 'no rush', other_agent: null, needs_to_buy: false, dual_fee: false, hot: false, tone: 'Go gently. No rush.' }),
      lead('15 Foxglove Road', 'BK1 4TS', { reason: 'moving for work', timescale: 'within three months', other_agent: 'Harper & Co, six weeks into a sole agency', needs_to_buy: true, dual_fee: true, hot: true }),
    ];
    soon.forEach((d, i) => {
      const date = valuerDays[i];
      if (!date) return;
      const p = person();
      valuation(date, afternoon, d, p) && met(p, now, 'valuation');
    });
    const later = [
      lead('8 Thistle Close', 'BK5 2HB', { reason: 'separating', timescale: 'within six months', other_agent: null, needs_to_buy: false, dual_fee: false, hot: false }),
      lead('33 Linden Avenue', 'BK2 5AQ', { bedrooms: 4, property_type: 'detached', reason: 'curious what it is worth', timescale: 'just looking', other_agent: null, needs_to_buy: false, dual_fee: false, hot: false }),
    ];
    later.forEach((d, i) => {
      const date = nextDay(addDays(today, 4 + i * 2), (x) => works(valuer, x) && weekdayOf(x) !== 0);
      if (!date) return;
      const p = person();
      valuation(date, anyTime(date), d, p) && met(p, now, 'valuation');
    });
  }

  // Two mortgage appointments with the adviser, in the office.
  const adviser = team.find((t) => t.does.includes('mortgage'));
  if (adviser && findService(profile, 'mortgage')) {
    let made = 0;
    for (let d = 1; d <= 9 && made < 2; d++) {
      const date = addDays(today, d);
      if (!works(adviser, date)) continue;
      const p = pick(pool.filter((x) => x.position.funding !== 'cash'));
      const s = findService(profile, 'mortgage')!;
      if (tryTimes(shuffled(candidateTimes(s, date)), (t) => place({ service: 'mortgage', date, time: t, staff: adviser.key, who: p, details: { kind: 'mortgage', position: p.position } }))) {
        made++;
        met(p, now, 'mortgage');
      }
    }
  }

  // ── Offers ──────────────────────────────────────────────────────────────
  const offers: Omit<Offer, 'source' | 'call_id'>[] = [];
  const hist = (what: string, when: Date, by = 'staff') => ({ at: when.toISOString(), by, what });
  /** An office-hours time at least `hours` before now. */
  const officeBefore = (hours: number) => {
    const t = new Date(now.getTime() - hours * HOUR);
    const l = local(t);
    if (l.time > '17:00') return at(l.date, '16:40');
    if (l.time < '09:00') return at(addDays(l.date, -1), '16:40');
    return t;
  };
  const offer = (o: {
    l: Listing; amount: number; p: Person; received: Date; status: Offer['status']; sent?: Date | null; decided?: Date | null; conditions?: string | null; note?: string | null;
  }) => {
    const reference = ref();
    const history = [hist('received', o.received, 'receptionist')];
    if (o.sent) history.push(hist('sent to the seller', o.sent));
    if (o.decided) history.push(hist(o.status, o.decided));
    offers.push({
      reference, listing_key: o.l.key, revises: null, amount_pence: o.amount, buyer_names: [o.p.name], phone: o.p.phone, email: null, position: o.p.position,
      conditions: o.conditions ?? 'subject to survey', solicitor: null, flags: [], status: o.status, received_at: o.received, sent_at: o.sent ?? null,
      decided_at: o.decided ?? null, note: o.note ?? null, history,
    });
    met(o.p, o.received, 'offer');
    return offers[offers.length - 1];
  };
  const round = (pence: number) => Math.round(pence / 100000) * 100000;
  const priceOf = (l: Listing) => l.initial.price_pence;

  if (f.seller) {
    const received = officeBefore(44);
    const sent = officeBefore(22);
    const o = offer({ l: f.seller, amount: round(priceOf(f.seller) * 0.95), p: aisha, received, status: 'sent', sent });
    texts.push(
      { to: aisha.phone, body: offerReceivedText(agency, o.amount_pence, shortAddress(f.seller), local(received), o.conditions, o.reference), created_at: received },
      { to: aisha.phone, body: offerSentText(agency, o.amount_pence, shortAddress(f.seller), local(sent)), created_at: sent },
    );
  }
  if (f.bestFinal) {
    offer({ l: f.bestFinal, amount: round(priceOf(f.bestFinal) * 0.97), p: pick(pool), received: officeBefore(26), status: 'received' });
    offer({ l: f.bestFinal, amount: round(priceOf(f.bestFinal) * 0.99), p: pick(pool), received: officeBefore(96), status: 'sent', sent: officeBefore(90) });
  }
  if (f.house) offer({ l: f.house, amount: round(priceOf(f.house) * 0.96), p: pick(pool), received: officeBefore(2), status: 'received', conditions: 'subject to survey and mortgage' });
  if (f.reduced) offer({ l: f.reduced, amount: round(priceOf(f.reduced) * 0.88), p: pick(pool), received: officeBefore(120), status: 'declined', sent: officeBefore(118), decided: officeBefore(98), note: 'The seller felt it was too low after the reduction.' });
  const agreedOffer = f.agreed ? offer({ l: f.agreed, amount: round(priceOf(f.agreed) * 0.98), p: ben, received: officeBefore(96), status: 'accepted', sent: officeBefore(94), decided: officeBefore(48) }) : null;
  // Older: the accepted offers behind the other two sales, and the back-up buyer's on the first.
  const backup = pick(pool.filter((p) => p.position.funding === 'cash' || p.position.selling === 'nothing'));
  if (f.agreed) offer({ l: f.agreed, amount: round(priceOf(f.agreed) * 0.94), p: backup, received: officeBefore(240), status: 'declined', sent: officeBefore(238), decided: officeBefore(220), note: 'Would still buy if the sale falls through.' });
  const solicitorBuyer = person();
  const chainOffer = f.chain ? offer({ l: f.chain, amount: round(priceOf(f.chain) * 0.98), p: solicitorBuyer, received: new Date(now.getTime() - 50 * DAY), status: 'accepted', sent: new Date(now.getTime() - 50 * DAY + 3 * HOUR), decided: new Date(now.getTime() - 48 * DAY) }) : null;
  const exchangedOffer = f.exchanged ? offer({ l: f.exchanged, amount: round(priceOf(f.exchanged) * 0.97), p: liam, received: new Date(now.getTime() - 84 * DAY), status: 'accepted', sent: new Date(now.getTime() - 84 * DAY + 2 * HOUR), decided: new Date(now.getTime() - 82 * DAY) }) : null;

  // ── Sales in progress ───────────────────────────────────────────────────
  const MILESTONES = SALE_MILESTONES;
  const milestones = (done: number, from: Date) => MILESTONES.map((key, i) => ({ key, done_at: i < done ? new Date(from.getTime() + (i + 1) * 3 * DAY).toISOString() : null }));
  const solicitors = (buyerSide: { name: string; firm: string; phone: string }) => [
    { role: 'buyer_solicitor', ...buyerSide },
    { role: 'seller_solicitor', name: newName(), firm: 'Brackenford Legal (example)', phone: newPhone() },
  ];
  const sales: Omit<Sale, 'id'>[] = [];
  if (f.agreed && agreedOffer) {
    const from = agreedOffer.decided_at!;
    sales.push({
      listing_key: f.agreed.key, offer_ref: agreedOffer.reference, buyer_name: ben.name, buyer_phone: ben.phone, agreed_pence: agreedOffer.amount_pence,
      milestones: MILESTONES.map((key, i) => ({ key, done_at: i < 2 ? new Date(from.getTime() + (i + 1) * 12 * HOUR).toISOString() : null })),
      exchange_target: null, completion_date: null, parties: solicitors({ name: newName(), firm: 'Haddon Conveyancing (example)', phone: newPhone() }), chain: null,
      status: 'progressing', keys_released_at: null, updates: [hist('memorandum of sale sent to both solicitors', new Date(from.getTime() + 12 * HOUR))], created_at: from,
    });
    known.set(backup.phone, { p: backup, last: officeBefore(220), source: 'offer', backup_for: [f.agreed.key] });
    backup.consent ??= officeBefore(220);
  }
  if (f.chain && chainOffer) {
    const from = chainOffer.decided_at!;
    let exchange = addDays(today, 7);
    while (!isWorkingDay(exchange, nation)) exchange = addDays(exchange, 1);
    sales.push({
      listing_key: f.chain.key, offer_ref: chainOffer.reference, buyer_name: solicitorBuyer.name, buyer_phone: solicitorBuyer.phone, agreed_pence: chainOffer.amount_pence,
      milestones: milestones(5, from), exchange_target: exchange, completion_date: null,
      parties: [
        ...solicitors({ name: PERSONAS.solicitor.name, firm: 'Fenwick Law (example)', phone: PERSONAS.solicitor.phone }),
        { role: 'chain_agent', name: 'Harper & Co', firm: 'Harper & Co', phone: PERSONAS.chainAgent.phone },
      ],
      chain: 'Our buyer is selling 5 Ash Grove through Harper & Co; their buyer\'s mortgage valuation is booked.',
      status: 'progressing', keys_released_at: null, updates: [hist('mortgage offer received by the buyer', new Date(now.getTime() - 6 * DAY))], created_at: from,
    });
  }
  if (f.exchanged && exchangedOffer) {
    const from = exchangedOffer.decided_at!;
    sales.push({
      listing_key: f.exchanged.key, offer_ref: exchangedOffer.reference, buyer_name: liam.name, buyer_phone: liam.phone, agreed_pence: exchangedOffer.amount_pence,
      milestones: milestones(7, from), exchange_target: addDays(today, -5), completion_date: addWorkingDays(today, 2, nation),
      parties: solicitors({ name: newName(), firm: 'Coldbrook Law (example)', phone: newPhone() }), chain: null,
      status: 'exchanged', keys_released_at: null, updates: [hist('contracts exchanged', new Date(now.getTime() - 5 * DAY))], created_at: from,
    });
  }

  // ── Homes, written as Start leaves them ─────────────────────────────────
  const rows: ListingState[] = listings.map((l) => {
    const s = live.get(l.key)!;
    const history = [hist(l.initial.status === 'coming_soon' ? 'coming soon' : 'on the market', s.marketed_at, 'seed')];
    if (s.back_on_market_at) history.push(hist('back on the market', s.back_on_market_at, 'staff'));
    if (l.reduced) history.push(hist(`reduced from ${l.reduced.from_pence / 100} to ${l.initial.price_pence / 100}`, new Date(now.getTime() - l.reduced.days_ago * DAY), 'staff'));
    if (s.best_final_at) history.push(hist('best and final set', officeBefore(20), 'staff'));
    return {
      listing_key: l.key, status: s.status, price_pence: s.price_pence, qualifier: s.qualifier, marketing_continues: s.marketing_continues,
      best_final_at: s.best_final_at, checking: [], blocked: [], sellers: sellers.get(l.key)!, marketed_at: s.marketed_at,
      back_on_market_at: s.back_on_market_at, set_from: { status: l.initial.status, price_pence: l.initial.price_pence },
      history: history.sort((a, b) => a.at.localeCompare(b.at)),
    };
  });

  // ── Messages ────────────────────────────────────────────────────────────
  const manager = team.find((t) => t.role === 'manager')?.key ?? estate?.complaints_handler ?? team[0]?.key;
  const progressor = team.find((t) => t.does.includes('progression') && t.role === 'progressor')?.key ?? manager;
  const lastSaturday = nextDay(addDays(today, -7), (d) => weekdayOf(d) === 6 && d < today) ?? addDays(today, -2);
  let complaintDay = today;
  for (let n = 0; n < 5;) {
    complaintDay = addDays(complaintDay, -1);
    if (isWorkingDay(complaintDay, nation)) n++;
  }
  const complaintRef = ref();
  const vacant = listings.find((l) => l.viewing.occupied === 'vacant');
  const messages: SeedMessage[] = [
    ...(f.chain ? [{
      from_name: `${PERSONAS.solicitor.name}, Fenwick Law (example)`, from_phone: PERSONAS.solicitor.phone, for_staff: progressor, category: 'progression', urgency: 'today' as const,
      body: `Chasing replies to our enquiries on ${shortAddress(f.chain)}: the seller's solicitor still hasn't answered the boundary question. Exchange is meant to be next week.`,
      created_at: officeBefore(3),
    }] : []),
    ...(vacant ? [{
      from_name: newName(), from_phone: newPhone(), for_staff: vacant.negotiator, category: 'access', urgency: 'today' as const,
      body: `Surveyor for a buyer's lender. Would like access to ${shortAddress(vacant)} on Wednesday morning. Needs the seller's permission first.`,
      created_at: officeBefore(5),
    }] : []),
    ...(f.reduced ? [{
      from_name: sellers.get(f.reduced.key)![0].name, from_phone: sellers.get(f.reduced.key)![0].phone, for_staff: f.reduced.negotiator, category: 'seller', urgency: 'today' as const,
      body: `Seller of ${shortAddress(f.reduced)}. Wants to talk about the price after this week's offer was declined.`,
      created_at: officeBefore(20),
    }] : []),
    {
      from_name: newName(), from_phone: newPhone(), for_staff: manager, category: 'general', urgency: 'this_week',
      body: 'Neighbour on Willow Gardens: your board is still up three weeks after the sale next door completed.',
      created_at: officeBefore(50), status: 'read',
    },
    {
      from_name: newName(), from_phone: newPhone(), for_staff: manager, category: 'supplier', urgency: 'this_week',
      body: 'Sales rep from a property portal, asking to talk about advertising packages.',
      created_at: officeBefore(70), status: 'read',
    },
    {
      from_name: newName(), from_phone: newPhone(), for_staff: manager, category: 'job', urgency: 'this_week',
      body: 'Asking whether there are any negotiator jobs going; has two years in lettings.',
      created_at: officeBefore(30),
    },
    ...(f.house ? [{
      from_name: PERSONAS.megan.name, from_phone: PERSONAS.megan.phone, for_staff: f.house.negotiator, category: 'viewing', urgency: 'today' as const,
      body: `Zoopla enquiry about ${shortAddress(f.house)}: "Is there parking? We'd like to view."`,
      details: { portal: 'Zoopla', listing: f.house.key, answered: false },
      created_at: at(lastSaturday, '19:42'),
    }] : []),
    ...(f.busy ? [{
      from_name: newName(), from_phone: newPhone(), for_staff: f.busy.negotiator, category: 'viewing', urgency: 'today' as const,
      body: `Rightmove enquiry about ${shortAddress(f.busy)}: "Is it still available? Could we see it this weekend?"`,
      details: { portal: 'Rightmove', listing: f.busy.key, answered: false },
      created_at: officeBefore(24),
    }] : []),
    {
      from_name: newName(), from_phone: newPhone(), for_staff: estate?.complaints_handler ?? manager, category: 'complaint', urgency: 'this_week', reference: complaintRef,
      body: 'Complaint: unhappy that a viewing was cancelled at short notice twice. Wants a call back.',
      details: { acknowledged_at: at(addWorkingDays(complaintDay, 1, nation), '10:00').toISOString(), acknowledge_by: addWorkingDays(complaintDay, 3, nation), final_by: addWorkingDays(complaintDay, 15, nation) },
      created_at: at(complaintDay, '15:20'), status: 'read',
    },
  ];
  if (f.house) met(megan, at(lastSaturday, '19:42'), 'Zoopla');

  // ── Everyone the agency knows ───────────────────────────────────────────
  for (const p of pool.slice(0, 10)) met(p, new Date(now.getTime() - between(10, 40) * DAY), pick(['Rightmove', 'Zoopla', 'walk-in', 'a board']));
  const people: Buyer[] = [...known.values()].map(({ p, last, source, backup_for }) => ({
    phone: p.phone,
    name: p.name,
    details: {
      roles: ['buyer'],
      position: p.position,
      requirements: p.requirements,
      consent_at: p.consent?.toISOString() ?? null,
      ...(backup_for ? { backup_for } : {}),
      ...(p.investor ? { investor: true } : {}),
      ...(p === sam ? { tried_to_call: { by: team.find((t) => t.key === f.house?.negotiator && t.key !== f.seller?.negotiator)?.key ?? viewers.find((t) => t.key !== f.seller?.negotiator)?.key ?? 'tom', at: at(addDays(today, -1), '15:20').toISOString() } } : {}),
      last_contact: last.toISOString(),
      source,
    },
    marketing_consent: Boolean(p.consent),
  }));
  if (f.seller) people.push({ phone: PERSONAS.seller.phone, name: PERSONAS.seller.name, details: { roles: ['seller'], last_contact: officeBefore(30).toISOString(), source: 'seller' }, marketing_consent: false });

  return { bookings, orders: [], messages, listings: rows, offers, sales, people, texts };
}
