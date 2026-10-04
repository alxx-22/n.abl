// Homes for sale, in words: what a listing says about itself, worked out
// in code so the receptionist only ever reads what is true on the day. Pure
// functions over the compiled profile and a listing's live row
// (voice_listings), unit tested in test/estate-agent.test.ts. The estate
// agent's compile, preview and seed use them now; the receptionist's tools
// read listings through the same functions (presets/estate-agent.md §4.2).

import {
  CHECK_KEYS, type BuyerDetails, type BuyerPosition, type CheckKey, type CheckValue, type HomeType, type Listing, type ListingState, type ListingStatus, type Nation, type OpeningHours,
  type PriceQualifier, type SayItem, type TenantProfile, type ViewingWindow,
} from './types.ts';
import { addDays, closeMinutes, minutesOf, spokenDate, spokenTime, toLocal, weekdayOf, zonedToUtc } from './time.ts';

// ── Numbers and money in words ────────────────────────────────────────────

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 76 → "seventy-six": a caller hears numbers as words, and the disclosure check listens for both. */
export function numberWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) return String(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` and ${numberWords(rest)}` : ''}`;
}

/** 18500000 → "£185,000"; pence only when there are some. */
export function poundsWhole(pence: number): string {
  const whole = Math.floor(Math.abs(pence) / 100);
  const p = Math.abs(pence) % 100;
  return `${pence < 0 ? '-' : ''}£${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${p ? `.${String(p).padStart(2, '0')}` : ''}`;
}

/** "guide price £185,000", "offers over £325,000", "£110,000 for a 50% share". */
export function priceWords(price_pence: number, qualifier: PriceQualifier, sharePercent?: number | null): string {
  const p = poundsWhole(price_pence);
  switch (qualifier) {
    case 'guide': return `guide price ${p}`;
    case 'offers_over': return `offers over ${p}`;
    case 'oiro': return `offers in the region of ${p}`;
    case 'share': return sharePercent ? `${p} for a ${sharePercent}% share` : `${p} for a share`;
    default: return p;
  }
}

const TYPE_WORDS: Record<HomeType, string> = {
  flat: 'flat', maisonette: 'maisonette', terraced: 'terraced house', end_terrace: 'end-of-terrace house', semi: 'semi-detached house',
  detached: 'detached house', bungalow: 'bungalow', cottage: 'cottage', other: 'home',
};

/** "two-bedroom flat". */
export const homeKind = (l: Pick<Listing, 'type' | 'beds'>) => `${l.beds ? `${numberWords(l.beds)}-bedroom ` : ''}${TYPE_WORDS[l.type]}`;

/** "two-bedroom flat, one bathroom, one reception". */
export function homeWords(l: Pick<Listing, 'type' | 'beds' | 'baths' | 'receptions'>): string {
  const count = (n: number, one: string, many: string) => `${numberWords(n)} ${n === 1 ? one : many}`;
  return [homeKind(l), l.baths ? count(l.baths, 'bathroom', 'bathrooms') : '', l.receptions ? count(l.receptions, 'reception', 'receptions') : '']
    .filter(Boolean).join(', ');
}

/** "Flat 2, 41 Albion Road": what people call it. */
export const shortAddress = (l: Pick<Listing, 'number' | 'street'>) => `${l.number} ${l.street}`.trim();

// ── The checklist ─────────────────────────────────────────────────────────

/**
 * Each check's words: what it is when not in the details, and what yes and
 * no say. For a service (gas, water) yes means it has one; for a risk
 * (flooding, knotweed) yes means it is there; construction yes is standard.
 */
export const CHECKS: Record<CheckKey, { unknown: string; yes: string; no: string }> = {
  construction: { unknown: 'how it is built', yes: 'Standard construction', no: 'Non-standard construction' },
  heating: { unknown: 'the heating', yes: 'Central heating', no: 'No central heating' },
  mains_gas: { unknown: 'whether it has mains gas', yes: 'Mains gas', no: 'No mains gas' },
  mains_water: { unknown: 'whether it has mains water', yes: 'Mains water', no: 'No mains water' },
  mains_drainage: { unknown: 'whether it has mains drainage', yes: 'Mains drainage', no: 'No mains drainage' },
  broadband: { unknown: 'broadband speed', yes: 'Broadband', no: 'No fixed broadband' },
  mobile: { unknown: 'mobile signal', yes: 'Mobile signal', no: 'Poor mobile signal' },
  parking: { unknown: 'parking', yes: 'Parking', no: 'No off-street parking' },
  flooded: { unknown: 'flooding', yes: 'It has flooded before', no: 'The seller says it has never flooded' },
  flood_defences: { unknown: 'flood defences', yes: 'Flood defences', no: 'No flood defences' },
  coastal_erosion: { unknown: 'coastal erosion', yes: 'At risk of coastal erosion', no: 'No coastal erosion risk' },
  listed: { unknown: 'whether it is listed', yes: 'A listed building', no: 'Not listed' },
  conservation_area: { unknown: 'whether it is in a conservation area', yes: 'In a conservation area', no: 'Not in a conservation area' },
  covenants: { unknown: 'restrictive covenants', yes: 'Restrictive covenants', no: 'No restrictive covenants declared' },
  rights_of_way: { unknown: 'rights of way', yes: 'Rights of way', no: 'No rights of way declared' },
  planning: { unknown: 'planning applications', yes: 'Planning', no: 'No planning applications declared' },
  building_safety: { unknown: 'building safety', yes: 'Building safety issues', no: 'No building safety issues declared' },
  accessibility: { unknown: 'accessibility', yes: 'Accessible', no: 'Not adapted for accessibility' },
  mining: { unknown: 'mining', yes: 'In a mining area', no: 'Not in a coal mining area' },
  knotweed: { unknown: 'Japanese knotweed', yes: 'Japanese knotweed', no: 'No Japanese knotweed declared' },
  disputes: { unknown: 'disputes with neighbours', yes: 'Disputes', no: 'No disputes declared' },
  alterations: { unknown: 'alterations and building regulations', yes: 'Alterations', no: 'No alterations declared' },
  warranty: { unknown: 'a new-build warranty', yes: 'A new-build warranty', no: 'No new-build warranty' },
};

/** An owner's note as the rest of a sentence: "One allocated space." → "one allocated space" (an acronym keeps its capitals). */
export const clause = (note: string) => {
  const n = note.trim().replace(/\.$/, '');
  return /^[A-Z][a-z]/.test(n) ? n[0].toLowerCase() + n.slice(1) : n;
};

/** A check in words: "Parking: one allocated space." Unknown is empty, never "no". */
export function checkSays(k: CheckKey, v: CheckValue, note: string): string {
  if (v === 'unknown') return '';
  const n = clause(note);
  return `${CHECKS[k][v]}${n ? `: ${n}` : ''}.`;
}

// ── Leases ────────────────────────────────────────────────────────────────

/** Whole years left on a lease that ends on `expires` (YYYY-MM-DD), on `today`; null when there is no date. */
export function leaseYears(expires: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const [ey, em, ed] = expires.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const years = ey - ty - (em < tm || (em === tm && ed < td) ? 1 : 0);
  return Math.max(0, years);
}

/** Below this, a lease is short: mortgages get harder and extending costs more, so it is said first. */
export const SHORT_LEASE_YEARS = 80;

// ── What must be said, and when ───────────────────────────────────────────

/** A line to say, and what to listen for: numbers in figures and in words. */
export const sayItem = (text: string, listen: (string | number)[]): SayItem => ({
  say: text,
  listen: [...new Set(listen.flatMap((w) => (typeof w === 'number' ? [String(w), numberWords(w)] : [w.toLowerCase()])))],
});

/** The longest few words of an owner's own sentence: enough to hear that it was said. */
const keyWords = (text: string) => [...new Set(text.toLowerCase().match(/[a-z][a-z'-]{4,}/g) ?? [])].sort((a, b) => b.length - a.length).slice(0, 3);

/**
 * The must-say lines that never change for a home: an event fee, an age
 * limit, shared ownership, non-standard construction, past flooding, a
 * personal interest, and the owner's own. sayFirst adds the ones that
 * depend on the day.
 */
export function fixedSayFirst(
  l: Pick<Listing, 'lease' | 'personal_interest'> & { checks: Record<CheckKey, { v: CheckValue; note: string }>; say_up_front: string[] },
  team: { key: string; first_name: string }[],
): SayItem[] {
  const out: SayItem[] = [];
  const lease = l.lease;
  if (lease?.event_fee.trim()) out.push(sayItem(`There's an event fee: ${clause(lease.event_fee)}.`, ['event fee']));
  if (lease?.age_limit) out.push(sayItem(`It's for buyers aged ${lease.age_limit} or over.`, [lease.age_limit]));
  const s = lease?.shared;
  if (s) {
    out.push(sayItem(
      `It's shared ownership with ${s.provider || 'a housing association'}: you buy a ${s.share_percent}% share and pay rent of ${poundsWhole(s.rent_pence_month)} a month on the rest.` +
        `${s.eligibility ? ` Buyers must qualify: ${clause(s.eligibility)}.` : ''}` +
        `${s.nomination_weeks ? ` ${s.provider || 'The provider'} has ${s.nomination_weeks} weeks to find a buyer first.` : ''}`,
      ['shared ownership', s.share_percent],
    ));
  }
  if (l.checks.construction.v === 'no') {
    const note = clause(l.checks.construction.note);
    out.push(sayItem(note ? `It's of non-standard construction: ${note}.` : "It's of non-standard construction, so mortgage lenders may not lend on it.", ['non-standard']));
  }
  if (l.checks.flooded.v === 'yes') {
    const note = clause(l.checks.flooded.note);
    out.push(sayItem(`It has flooded before${note ? `: ${note}` : ''}.`, ['flooded']));
  }
  if (l.personal_interest?.wording.trim()) {
    const who = team.find((t) => t.key === l.personal_interest!.staff)?.first_name;
    out.push(sayItem(l.personal_interest.wording.trim(), who ? [who] : keyWords(l.personal_interest.wording)));
  }
  for (const t of l.say_up_front) if (t.trim()) out.push(sayItem(t.trim(), keyWords(t)));
  return out;
}

/** What a home's live row says about it now (voice_listings); the profile's initial values until Start writes one. */
export type ListingLive = Pick<ListingState, 'status' | 'price_pence' | 'qualifier' | 'marketing_continues' | 'checking' | 'blocked' | 'best_final_at' | 'marketed_at' | 'back_on_market_at'>;

/** A listing as it stands at Start, before anyone has changed it. */
export function initialLive(l: Listing, now: Date): ListingLive {
  const day = 86400000;
  return {
    status: l.initial.status,
    price_pence: l.initial.price_pence,
    qualifier: l.initial.qualifier,
    marketing_continues: true,
    checking: [],
    blocked: [],
    best_final_at: null,
    marketed_at: new Date(now.getTime() - (l.initial.status === 'coming_soon' ? 0 : l.marketed_days_ago) * day),
    back_on_market_at: l.back_on_market_days_ago === null ? null : new Date(now.getTime() - l.back_on_market_days_ago * day),
  };
}

/**
 * Everything to say before any viewing times, in order: the day's (an
 * accepted offer, coming soon, a short lease), then the home's own. `start`
 * is when the demo began, which a coming-soon home's first viewings count
 * from.
 */
export function sayFirst(l: Listing, live: ListingLive, today: string, start: Date, timezone = 'Europe/London'): SayItem[] {
  const out: SayItem[] = [];
  if (live.status === 'sale_agreed') {
    out.push(sayItem(live.marketing_continues
      ? 'An offer has been accepted on it, subject to contract, but the seller is still taking viewings.'
      : "An offer has been accepted on it, subject to contract, and the seller isn't taking more viewings.", ['accepted']));
  }
  if (live.status === 'coming_soon' && l.viewings_from_days !== null) {
    const first = firstViewingDate(l, start, timezone);
    if (first > today) out.push(sayItem(`It's coming soon: first viewings from ${spokenDate(first)}.`, ['coming soon', spokenDate(first).split(' ')[0]]));
  }
  const years = l.lease && !live.checking.includes('lease') && !live.checking.includes('tenure') ? leaseYears(l.lease.expires, today) : null;
  if (years !== null && years < SHORT_LEASE_YEARS) out.push(sayItem(`It's leasehold, with ${years} years left on the lease.`, [years]));
  return [...out, ...l.say_first];
}

/** A coming-soon home's first viewing day (local). */
export const firstViewingDate = (l: Listing, start: Date, timezone = 'Europe/London') => addDays(toLocal(start, timezone).date, l.viewings_from_days ?? 0);

/** "Buyers pay £36 including VAT each for ID checks, once an offer is accepted.", or nothing. */
export function buyerFeeSentence(feePence: number, when: string): string {
  if (!feePence) return '';
  return `Buyers pay ${poundsWhole(feePence)} including VAT each for ID checks${when.trim() ? `, ${when.trim().replace(/\.$/, '')}` : ''}.`;
}

// ── Viewing hours ─────────────────────────────────────────────────────────

const WEEKDAYS = [1, 2, 3, 4, 5];
const DAY_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

function daysWords(days: number[]): string {
  const set = [...new Set(days)].sort();
  if (set.length === 5 && WEEKDAYS.every((d) => set.includes(d))) return 'weekdays';
  if (set.length === 2 && set.includes(0) && set.includes(6)) return 'weekends';
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => set.includes(d)).map((d) => DAY_PLURAL[d]);
  return ordered.length > 1 ? `${ordered.slice(0, -1).join(', ')} and ${ordered.at(-1)}` : ordered[0] ?? '';
}

/**
 * All a caller hears about getting in: when the seller allows viewings,
 * the notice they need, and the office-hours rule for an empty home, which
 * is said as a rule and never as why.
 */
export function viewingRule(v: { windows: ViewingWindow[]; notice_minutes: number; first_in_office_hours: boolean }, defaultNoticeMinutes: number): string {
  const parts: string[] = [];
  if (v.windows.length) {
    const spans = v.windows.map((w) => {
      const evening = minutesOf(w.from) >= 17 * 60;
      const days = daysWords(w.days);
      return `${days === 'weekdays' && evening ? 'weekday evenings' : days} ${spokenTime(w.from)} to ${spokenTime(w.to)}`;
    });
    parts.push(`Viewings on ${spans.join(' and ')}.`);
  } else parts.push('Viewings any time in our viewing hours.');
  if (v.notice_minutes > defaultNoticeMinutes) {
    const hours = Math.round(v.notice_minutes / 60);
    parts.push(`Viewings need ${hours} hours' notice.`);
  }
  if (v.first_in_office_hours) parts.push('First viewings are in office hours.');
  return parts.join(' ');
}

/** What availability checks for a viewing at one home (src/domain/availability.ts SlotRequest.listing). */
export interface ListingRule {
  key: string;
  windows: ViewingWindow[];
  notice_minutes: number;
  /** Dates (YYYY-MM-DD, inclusive) the seller has blocked. */
  blocked: { from: string; to: string }[];
  /** Staff who may not show it: a personal interest. */
  exclude_staff: string[];
  /** Only inside these hours: an empty home's first viewings, in office hours. */
  office_only?: OpeningHours[];
}

/** The rules a viewing of this home is booked under, for this service, with the live row's blocked dates. */
export function viewingRules(l: Listing, profile: TenantProfile, serviceKey: string, live?: Pick<ListingLive, 'blocked'>): ListingRule {
  return {
    key: l.key,
    windows: l.viewing.windows,
    notice_minutes: l.viewing.notice_minutes,
    blocked: (live?.blocked ?? []).map((b) => ({ from: b.from, to: b.to })),
    exclude_staff: l.personal_interest ? [l.personal_interest.staff] : [],
    office_only: l.viewing.first_in_office_hours && serviceKey === 'viewing' ? profile.opening_hours : undefined,
  };
}

/** Whether a start and end (local minutes on a weekday) sit inside the rule's windows and hours. */
export function insideRule(rule: ListingRule, date: string, startMin: number, endMin: number): boolean {
  const wd = weekdayOf(date);
  if (rule.blocked.some((b) => date >= b.from && date <= b.to)) return false;
  if (rule.windows.length && !rule.windows.some((w) => w.days.includes(wd) && startMin >= minutesOf(w.from) && endMin <= closeMinutes(w.to))) return false;
  if (rule.office_only && !rule.office_only.some((h) => h.days.includes(wd) && startMin >= minutesOf(h.open) && endMin <= closeMinutes(h.close))) return false;
  return true;
}

// ── A listing in a sentence ───────────────────────────────────────────────

const PRICE_PHRASE: Record<PriceQualifier, (p: string, share?: number | null) => string> = {
  guide: (p) => `at a guide price of ${p}`,
  offers_over: (p) => `with offers over ${p}`,
  oiro: (p) => `at offers in the region of ${p}`,
  fixed: (p) => `at ${p}`,
  share: (p, share) => `at ${p}${share ? ` for a ${share}% share` : ' for a share'}`,
};

/** "It's leasehold, with 76 years left on the lease." */
export function tenureSentence(l: Pick<Listing, 'tenure' | 'lease'>, today: string): string {
  const years = l.lease ? leaseYears(l.lease.expires, today) : null;
  switch (l.tenure) {
    case 'freehold': return "It's freehold.";
    case 'leasehold': return years !== null ? `It's leasehold, with ${years} years left on the lease.` : "It's leasehold.";
    case 'share_of_freehold': return "It's leasehold with a share of the freehold.";
    case 'shared_ownership': return years !== null ? `It's shared ownership, on a lease with ${years} years left.` : "It's shared ownership.";
    default: return "The tenure isn't in the details yet.";
  }
}

/** "Council tax band B", or in Northern Ireland the rates. */
export function localTaxWords(localTax: string, nation: Nation): string {
  if (!localTax.trim()) return '';
  return nation === 'northern_ireland' ? `Rates: ${localTax.trim()}` : `Council tax band ${localTax.trim()}`;
}

/**
 * A home in two or three sentences, the way the receptionist would open:
 * the builder's preview shows one, so a prospect hears what callers will.
 */
export function listingSummary(l: Listing, live: Pick<ListingLive, 'price_pence' | 'qualifier'>, today: string, nation: Nation): string {
  const price = PRICE_PHRASE[live.qualifier](poundsWhole(live.price_pence), l.lease?.shared?.share_percent);
  const tax = localTaxWords(l.local_tax, nation);
  const epc = l.epc.trim() ? (/^exempt$/i.test(l.epc.trim()) ? 'it has no EPC rating (exempt)' : `the EPC rating is ${l.epc.trim()}`) : "the EPC isn't in yet";
  return `${shortAddress(l)} is a ${homeKind(l)} ${price}. ${tenureSentence(l, today)} ${tax ? `${tax}, and ${epc}.` : `${epc[0].toUpperCase()}${epc.slice(1)}.`}`;
}

/**
 * What get_property gives the receptionist to say first: the price, the
 * council tax band and the EPC in one sentence, then the tenure. In a live
 * call the receptionist read the first two sentences of the preview's
 * summary and stopped, so the facts every advert must state come first.
 */
export function describeLine(l: Listing, live: Pick<ListingLive, 'price_pence' | 'qualifier'>, today: string, nation: Nation): string {
  const price = PRICE_PHRASE[live.qualifier](poundsWhole(live.price_pence), l.lease?.shared?.share_percent);
  const tax = localTaxWords(l.local_tax, nation);
  const epc = l.epc.trim() ? (/^exempt$/i.test(l.epc.trim()) ? 'no EPC rating (exempt)' : `EPC rating ${l.epc.trim()}`) : "the EPC isn't in yet";
  const more = [tax ? (nation === 'northern_ireland' ? tax.replace(/^Rates/, 'rates') : tax.replace(/^Council/, 'council')) : '', epc].filter(Boolean).join(', and ');
  return `${shortAddress(l)} is a ${homeKind(l)} ${price}, ${more}. ${tenureSentence(l, today)}`;
}

// ── Working days and offer timers ─────────────────────────────────────────

/** Bank holidays as observed, 2026 and 2027; Northern Ireland adds two of its own. Wales follows England. */
const BANK_HOLIDAYS = [
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
];
const NI_HOLIDAYS = ['2026-03-17', '2026-07-13', '2027-03-17', '2027-07-12'];

export function isWorkingDay(date: string, nation: Nation): boolean {
  const wd = weekdayOf(date);
  if (wd === 0 || wd === 6) return false;
  return !BANK_HOLIDAYS.includes(date) && !(nation === 'northern_ireland' && NI_HOLIDAYS.includes(date));
}

/** The date n working days after `date` (n >= 0), skipping weekends and bank holidays. */
export function addWorkingDays(date: string, n: number, nation: Nation): string {
  let d = date;
  for (let left = n; left > 0;) {
    d = addDays(d, 1);
    if (isWorkingDay(d, nation)) left--;
  }
  return d;
}

/** How long an offer may wait for the seller: amber after a day, red at two working days. */
export const OFFER_AMBER_HOURS = 24;
export const OFFER_RED_WORKING_DAYS = 2;

/**
 * An offer not yet sent to the seller, by how long it has waited: every
 * offer must reach the seller promptly, so the back office shows the ones
 * that have not. Sent or decided offers are done.
 */
export function offerTimer(o: { status: string; received_at: Date }, now: Date, nation: Nation, timezone = 'Europe/London'): 'done' | 'fresh' | 'amber' | 'red' {
  if (o.status !== 'received') return 'done';
  const local = toLocal(o.received_at, timezone);
  const red = zonedToUtc(addWorkingDays(local.date, OFFER_RED_WORKING_DAYS, nation), local.time, timezone);
  if (now.getTime() >= red.getTime()) return 'red';
  return now.getTime() - o.received_at.getTime() >= OFFER_AMBER_HOURS * 3600000 ? 'amber' : 'fresh';
}

// ── Positions and texts ───────────────────────────────────────────────────

/**
 * A buyer's position as badges on a viewing or an offer. Cash is set here,
 * never taken from what a caller says: "we're cash" with a flat to sell is
 * a chain, not a cash buyer.
 */
export function positionBadges(p: BuyerPosition): string[] {
  const out: string[] = [];
  if (p.first_time_buyer) out.push('FTB');
  if (p.funding === 'mortgage_aip') out.push('AIP');
  if (p.funding === 'cash' && p.selling === 'nothing') out.push('Cash');
  if (p.selling && p.selling !== 'nothing') out.push('Chain');
  return out;
}

/** Every text the demo sends says it is a demo. */
export const DEMO_TEXT = '(Demo)';

/** "Hartwell & Green: viewing booked, Saturday 11:15am at 22 Albion Road, with Jess. Ref KX482." */
export function viewingText(
  agency: string,
  what: 'viewing' | 'second viewing' | string,
  change: 'booked' | 'changed' | 'cancelled',
  at: { date: string; time: string },
  address: string,
  withName: string,
  ref: string,
  extra = '',
): string {
  const when = `${spokenDate(at.date).split(' ')[0]} ${spokenTime(at.time)}`;
  const tail = change === 'cancelled' ? '' : ' To change it, call us and quote your reference.';
  return `${agency}: ${what} ${change}, ${when} at ${address}${withName ? `, with ${withName}` : ''}. Ref ${ref}.${extra ? ` ${extra.trim()}` : ''}${tail} ${DEMO_TEXT}`;
}

/** The written confirmation a buyer gets as soon as an offer is recorded. */
export function offerReceivedText(agency: string, amountPence: number, address: string, at: { date: string; time: string }, conditions: string | null, ref: string): string {
  const [, , d] = at.date.split('-').map(Number);
  const month = spokenDate(at.date).split(' ')[2];
  return `${agency}: we received your offer of ${poundsWhole(amountPence)} for ${address} at ${spokenTime(at.time)} on ${d} ${month}${conditions ? `, ${clause(conditions)}` : ''}. Ref ${ref}. We'll put it to the seller promptly and confirm in writing. ${DEMO_TEXT}`;
}

/** Sent when staff mark an offer as put to the seller. */
export function offerSentText(agency: string, amountPence: number, address: string, at: { time: string }): string {
  return `${agency}: your offer of ${poundsWhole(amountPence)} for ${address} was put to the seller at ${spokenTime(at.time)} today. We'll let you know their answer. ${DEMO_TEXT}`;
}

// ── Finding a home from what a caller said ────────────────────────────────

const NATO: Record<string, string> = {
  alpha: 'a', alfa: 'a', bravo: 'b', charlie: 'c', delta: 'd', echo: 'e', foxtrot: 'f', golf: 'g', hotel: 'h', india: 'i',
  juliet: 'j', juliett: 'j', kilo: 'k', lima: 'l', mike: 'm', november: 'n', oscar: 'o', papa: 'p', quebec: 'q', romeo: 'r',
  sierra: 's', tango: 't', uniform: 'u', victor: 'v', whiskey: 'w', whisky: 'w', xray: 'x', yankee: 'y', zulu: 'z',
};
const UNITS: Record<string, number> = Object.fromEntries([...ONES.map((w, i) => [w, i] as const), ['oh', 0]]);
const TEN_WORDS: Record<string, number> = Object.fromEntries(TENS.map((w, i) => [w, i * 10] as const).filter(([w]) => w));

/**
 * Number words to figures, the way callers say them: "twenty-two" is 22,
 * "three hundred and twenty-five thousand" is 325000, and digits read one
 * at a time ("one oh two") are 102. A lone "one" is left as a word: "the
 * one on Albion Road" names no house number.
 */
function numberRuns(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length;) {
    const isNum = (t: string | undefined) => t !== undefined && (t in UNITS || t in TEN_WORDS || t === 'hundred' || t === 'thousand' || t === 'million');
    if (!isNum(tokens[i]) || (tokens[i] === 'oh' && !isNum(tokens[i + 1]))) {
      out.push(tokens[i++]);
      continue;
    }
    const run: string[] = [];
    while (i < tokens.length && (isNum(tokens[i]) || (tokens[i] === 'and' && isNum(tokens[i + 1]) && run.length))) {
      if (tokens[i] !== 'and') run.push(tokens[i]);
      i++;
    }
    if (run.length === 1 && (run[0] === 'one' || run[0] === 'oh')) {
      out.push(run[0]);
      continue;
    }
    if (run.every((t) => t in UNITS && UNITS[t] < 10)) {
      out.push(run.map((t) => UNITS[t]).join(''));
      continue;
    }
    let total = 0;
    let current = 0;
    for (const t of run) {
      if (t in UNITS) current += UNITS[t];
      else if (t in TEN_WORDS) current += TEN_WORDS[t];
      else if (t === 'hundred') current = (current || 1) * 100;
      else if (t === 'thousand') (total += (current || 1) * 1000), (current = 0);
      else if (t === 'million') (total += (current || 1) * 1_000_000), (current = 0);
    }
    out.push(String(total + current));
  }
  return out;
}

/** What a caller said, as tokens: lower case, number words as figures, "325k" as 325000, the phonetic alphabet as letters. */
export function queryTokens(text: string): string[] {
  const s = text.toLowerCase()
    .replace(/(\d),(\d{3})\b/g, '$1$2')
    .replace(/£/g, ' ')
    .replace(/\b(\d+(?:\.\d+)?)\s?k\b/g, (_, n: string) => String(Math.round(Number(n) * 1000)))
    .replace(/\bx-ray\b/g, 'xray')
    .replace(/[^a-z0-9]+/g, ' ');
  return numberRuns(s.split(' ').filter(Boolean).map((t) => NATO[t] ?? t));
}

/** Letters and digits read a few at a time, joined: "b k 2" and "bk 2" are "bk2", "h g 102" is "hg102". */
function joinedRuns(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    let s = '';
    for (let j = i; j < tokens.length && j < i + 6 && (tokens[j].length <= 2 || /^\d+$/.test(tokens[j])); j++) {
      s += tokens[j];
      if (j > i) out.push(s);
    }
  }
  return out;
}

const SUFFIXES = new Set(['road', 'lane', 'close', 'way', 'street', 'drive', 'court', 'walk', 'rise', 'gardens', 'avenue', 'crescent', 'place', 'grove', 'view', 'row', 'terrace', 'hill', 'park', 'square', 'mews', 'green', 'house', 'flat', 'apartment', 'the']);

function lev(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** How a word sounds, roughly: "Albion" and "Albany" sound alike. */
function soundex(w: string): string {
  const code: Record<string, string> = { b: '1', f: '1', p: '1', v: '1', c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2', d: '3', t: '3', l: '4', m: '5', n: '5', r: '6' };
  let out = w[0];
  let last = code[w[0]] ?? '';
  for (const ch of w.slice(1)) {
    const c = code[ch] ?? '';
    if (c && c !== last) out += c;
    if (!'hw'.includes(ch)) last = c;
  }
  return (out + '000').slice(0, 4);
}

/** A street word heard right, or near enough: one letter out, or sounding the same. */
function wordScore(heard: string, word: string): number {
  if (heard === word) return 3;
  if (heard.length < 4 || word.length < 4) return 0;
  if (lev(heard, word) <= (word.length >= 7 ? 2 : 1)) return 2;
  return heard.slice(0, 2) === word.slice(0, 2) && soundex(heard) === soundex(word) ? 2 : 0;
}

/** Numbers easily misheard for each other on the phone. */
const sameSounding = (a: number, b: number) => a !== b && a >= 13 && b >= 13 && a <= 90 && b <= 90 && ((a % 10 === 0 && b === a / 10 + 10) || (b % 10 === 0 && a === b / 10 + 10));

const TYPE_HEARD: [RegExp, (t: HomeType) => boolean][] = [
  [/^(flat|apartment|maisonette)s?$/, (t) => t === 'flat' || t === 'maisonette'],
  [/^(house|home)s?$/, (t) => t !== 'flat' && t !== 'maisonette'],
  [/^semi$/, (t) => t === 'semi'],
  [/^detached$/, (t) => t === 'detached'],
  [/^(terrace|terraced)$/, (t) => t === 'terraced' || t === 'end_terrace'],
  [/^bungalows?$/, (t) => t === 'bungalow'],
  [/^cottages?$/, (t) => t === 'cottage'],
];

/** A home as the finder sees it: its facts and, where there is one, its live price. */
export interface Findable {
  listing: Listing;
  price_pence: number;
}

/**
 * The homes a caller means: a street heard wrongly ("Albany Road"), a
 * house number easily misheard (14 or 40), a postcode district in the
 * phonetic alphabet, the agency's reference, or "the one at 325". When
 * more than one fits as well, all of them come back, so the receptionist
 * asks which.
 */
export function findListings(homes: Findable[], words: string): Listing[] {
  const tokens = queryTokens(words);
  const joined = joinedRuns(tokens);
  const all = new Set([...tokens, ...joined]);
  const beds = /^\d+$/;
  const bedCount = tokens.flatMap((t, i) => (beds.test(t) && /^bed/.test(tokens[i + 1] ?? '') ? [Number(t)] : []));
  const numbers = tokens.filter((t, i) => beds.test(t) && !/^bed/.test(tokens[i + 1] ?? '')).map(Number);
  const scored = homes.map(({ listing: l, price_pence }) => {
    // "Wharf House" is a block of flats, and "The Bungalow" a name: words in a home's own name are not a type the caller asked for.
    const own = new Set(queryTokens(`${l.number} ${l.street}`));
    const typeTests = TYPE_HEARD.filter(([re]) => tokens.some((t) => re.test(t) && !own.has(t))).map(([, test]) => test);
    let id = 0;
    let score = 0;
    if (all.has(l.ref.toLowerCase()) || all.has(l.key)) id += 20;
    const name = queryTokens(`${l.number} ${l.street}`).filter((w) => !/^\d+$/.test(w) && !SUFFIXES.has(w));
    const street = name.reduce((s, w) => s + Math.max(0, ...tokens.map((t) => wordScore(t, w))), 0);
    id += street;
    if (street) {
      const suffix = queryTokens(l.street).find((w) => SUFFIXES.has(w));
      if (suffix && tokens.includes(suffix)) score += 1;
    }
    const pounds = Math.round(price_pence / 100);
    const price = numbers.some((n) => n >= 50 && Math.abs((n < 10000 ? n * 1000 : n) - pounds) <= Math.max(1000, pounds * 0.005));
    if (price) id += 5;
    const houseNumbers = (l.number.match(/\d+/g) ?? []).map(Number);
    for (const n of numbers) {
      if (houseNumbers.includes(n)) score += 4;
      else if (houseNumbers.some((o) => sameSounding(n, o))) score += 3;
      else if (street && !price && n < 1000) score -= 3;
    }
    for (const test of typeTests) score += test(l.type) ? 2 : -3;
    for (const b of bedCount) score += b === l.beds ? 1 : -2;
    if (tokens.includes(l.district.toLowerCase()) || joined.includes(l.district.toLowerCase())) score += 1;
    return { l, id, score: id + score };
  }).filter((x) => x.id > 0 && x.score > 0);
  const best = Math.max(0, ...scored.map((x) => x.score));
  return scored.filter((x) => x.score >= best - 1).sort((a, b) => b.score - a.score).map((x) => x.l);
}

/** The postcode districts a caller named, from those the agency covers ("bravo kilo two" is BK2). */
export function districtsIn(text: string, known: string[]): string[] {
  const tokens = queryTokens(text);
  const heard = new Set([...tokens, ...joinedRuns(tokens)]);
  return known.filter((d) => heard.has(d.toLowerCase()));
}

// ── What a buyer asked for ────────────────────────────────────────────────

/** "three-bed houses in BK2 up to £300,000, with a garden": what a buyer asked for, as their text and the team read it. */
export function requirementsWords(r: NonNullable<BuyerDetails['requirements']>): string {
  const what = `${r.min_beds ? `${r.min_beds}-bed ` : ''}${r.types?.length ? r.types.join(' or ') : 'homes'}`;
  return [
    what,
    r.areas?.length ? `in ${r.areas.join(', ')}` : '',
    r.max_price_pence ? `up to ${poundsWhole(r.max_price_pence)}` : '',
    r.must_haves?.length ? `with ${r.must_haves.join(', ')}` : '',
  ].filter(Boolean).join(' ');
}

export interface Requirements {
  max_price_pence?: number;
  min_beds?: number;
  /** Home types, or "house" / "flat" as callers say them. */
  types?: string[];
  /** Postcode districts or towns. */
  areas?: string[];
  /** garden, parking, no chain, step-free. */
  must_haves?: string[];
}

const HAS: [RegExp, (l: Listing) => boolean][] = [
  [/garden/, (l) => l.features.some((f) => /garden/i.test(f))],
  [/park|drive|garage/, (l) => l.checks.parking.v === 'yes' || l.features.some((f) => /park|drive|garage/i.test(f))],
  [/chain/, (l) => /no onward chain|no chain|no onward purchase/i.test(l.seller_position)],
  [/step|level|wheel|ground floor|access/, (l) => l.checks.accessibility.v === 'yes' || l.features.some((f) => /step-free|level access|ground floor/i.test(f))],
];

/**
 * What a buyer described in their own words ("a three-bed house with a
 * garden in Coldbrook, under 300"), for a search with nothing else to go on.
 */
export function requirementsIn(text: string, places: { districts: string[]; towns: string[] }): Requirements {
  const tokens = queryTokens(text);
  const out: Requirements = {};
  const i = tokens.findIndex((t, n) => /^\d+$/.test(t) && /^bed/.test(tokens[n + 1] ?? ''));
  if (i >= 0) out.min_beds = Number(tokens[i]);
  const cap = tokens.findIndex((t, n) => /^(under|below|max|maximum|upto|budget)$/.test(t) && /^\d+$/.test(tokens[n + 1] ?? ''));
  if (cap >= 0) {
    const n = Number(tokens[cap + 1]);
    out.max_price_pence = (n < 10000 ? n * 1000 : n) * 100;
  }
  const types = tokens.filter((t) => TYPE_HEARD.some(([re]) => re.test(t)));
  if (types.length) out.types = types;
  const lower = ` ${tokens.join(' ')} `;
  const areas = [...districtsIn(text, places.districts), ...places.towns.filter((t) => lower.includes(` ${queryTokens(t).join(' ')} `))];
  if (areas.length) out.areas = areas;
  const must = HAS.filter(([re]) => !re.test('chain') && tokens.some((t) => re.test(t))).map(([re]) => re.source);
  if (/no (onward )?chain|chain free/.test(lower)) must.push('chain');
  const named = must.map((m) => (/garden/.test(m) ? 'garden' : /park/.test(m) ? 'parking' : /chain/.test(m) ? 'no chain' : 'step-free'));
  if (named.length) out.must_haves = [...new Set(named)];
  return out;
}

/** Whether a type word ("house", "semi", "flat") fits a home. */
const typeFits = (word: string, t: HomeType) => {
  const w = word.toLowerCase().replace(/_/g, ' ').trim();
  if (w === t.replace(/_/g, ' ')) return true;
  return TYPE_HEARD.some(([re, test]) => w.split(/\s+/).some((x) => re.test(x)) && test(t));
};

/**
 * Homes for sale that fit what a buyer wants, best first: available
 * before under offer, then nearest the budget. Every requirement must be
 * met, except a price up to 5% over, which buyers usually still want to hear.
 */
export function matches(req: Requirements, homes: (Findable & { status: ListingStatus })[]): Listing[] {
  const areas = (req.areas ?? []).map((a) => a.toLowerCase().replace(/\s+/g, ''));
  return homes
    .filter((h) => h.status === 'available' || h.status === 'under_offer')
    .filter(({ listing: l, price_pence }) =>
      (!req.max_price_pence || price_pence <= req.max_price_pence * 1.05) &&
      (!req.min_beds || l.beds >= req.min_beds) &&
      (!req.types?.length || req.types.some((t) => typeFits(t, l.type))) &&
      (!areas.length || areas.some((a) => a === l.district.toLowerCase() || a === l.town.toLowerCase().replace(/\s+/g, ''))) &&
      (req.must_haves ?? []).every((m) => HAS.find(([re]) => re.test(m.toLowerCase()))?.[1](l) ?? true))
    .sort((a, b) =>
      (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1) ||
      (req.max_price_pence && (a.price_pence > req.max_price_pence ? 1 : 0) - (b.price_pence > req.max_price_pence ? 1 : 0)) ||
      b.price_pence - a.price_pence)
    .map((h) => h.listing);
}

/** Two available homes most like this one, for a caller whose home has gone: the same kind, a similar size and price, nearby. */
export function similar(l: Listing, homes: (Findable & { status: ListingStatus })[], n = 2): Listing[] {
  const flatLike = (t: HomeType) => t === 'flat' || t === 'maisonette';
  const price = Math.max(1, l.initial.price_pence);
  return homes
    .filter((h) => h.listing.key !== l.key && h.status === 'available')
    .map((h) => ({
      h,
      score: (flatLike(h.listing.type) === flatLike(l.type) ? 3 : 0) + (h.listing.type === l.type ? 1 : 0) - Math.abs(h.listing.beds - l.beds) -
        Math.abs(h.price_pence - price) / price * 10 + (h.listing.district === l.district ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.h.listing);
}

// ── A home's facts, as a caller may hear them ─────────────────────────────

export const STATUS_WORDS: Record<ListingStatus, string> = {
  coming_soon: 'coming soon', available: 'available', under_offer: 'under offer', sale_agreed: 'sale agreed, subject to contract',
  exchanged: 'sold (contracts exchanged)', completed: 'sold', withdrawn: 'no longer on the market',
};

/**
 * Checks the seller answered "no" with nothing to add, said in three short
 * lines rather than thirteen, so a home's facts stay small enough to send
 * on every question. A "no" with a note is said on its own.
 */
/** Checks whose "yes" only names the topic, so the note alone says it. */
const TOPIC_ONLY = new Set<CheckKey>(['heating', 'broadband', 'mobile', 'parking']);
const NOT_IN: Partial<Record<CheckKey, string>> = { listed: 'listed', conservation_area: 'in a conservation area', mining: 'in a coal mining area' };
const NO_RISK: Partial<Record<CheckKey, string>> = { flood_defences: 'flood defences', coastal_erosion: 'coastal erosion risk', warranty: 'new-build warranty' };
const DECLARED: Partial<Record<CheckKey, string>> = {
  covenants: 'restrictive covenants', rights_of_way: 'rights of way', planning: 'planning applications', building_safety: 'building safety issues',
  knotweed: 'Japanese knotweed', disputes: 'disputes', alterations: 'alterations',
};

/**
 * Words that tell a stranger a home is empty or how to get in. They never
 * leave the tools, whatever an owner typed into a note: the rule a caller
 * hears is "first viewings are in office hours".
 */
export const UNSAYABLE = /\b(vacant(?! possession)|empty|unoccupied|nobody lives|no one lives|keys?|key-?safe|lock-?box|alarm code)\b/i;

const orList = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}` : xs[0] ?? '');

/**
 * The facts of a home as a caller may hear them, in short sentences,
 * kept small enough to send on every question. Anything staff are
 * checking is left out and named in being_checked; anything unknown is
 * named in unknown, never said as no.
 */
/** What the facts outside the checklist are called when staff mark them as being checked. */
const CHECKING_WORDS: Record<string, string> = { price: 'the price', rooms: 'the room sizes', tenure: 'the tenure', lease: 'the lease details', local_tax: 'the council tax band', epc: 'the EPC rating' };

export function facts(l: Listing, live: Pick<ListingLive, 'checking'>, today: string, nation: Nation): { facts: Record<string, string>; unknown: string[]; being_checked: string[] } {
  const checking = new Set(live.checking);
  const out: Record<string, string> = { home: l.home };
  if (l.summary) out.summary = l.summary;
  if (l.features.length) out.features = l.features.join(', ');
  if (l.rooms.length && !checking.has('rooms')) out.rooms = l.rooms.map((r) => `${r.name} ${r.size || 'not measured'}`).join('; ');
  // A fact staff are checking is not stated: the receptionist says it is being checked.
  const leaseChecked = checking.has('tenure') || checking.has('lease');
  // The years left are the lease's: while it is checked the tenure is said without them.
  if (!checking.has('tenure')) out.tenure = clause(tenureSentence(leaseChecked ? { ...l, lease: null } : l, today).replace(/^It's /, ''));
  const lease = leaseChecked ? null : l.lease;
  if (lease) {
    if (lease.service_charge) out.service_charge = lease.service_charge;
    if (lease.ground_rent) out.ground_rent = lease.ground_rent;
    if (lease.reserve_fund) out.reserve_fund = lease.reserve_fund;
    if (lease.event_fee) out.event_fee = lease.event_fee;
    if (lease.managing_agent) out.managing_agent = lease.managing_agent;
    if (lease.age_limit) out.age_limit = `buyers aged ${lease.age_limit} or over`;
    if (lease.shared) out.shared_ownership = `${lease.shared.share_percent}% share with ${lease.shared.provider || 'a housing association'}, rent ${poundsWhole(lease.shared.rent_pence_month)} a month on the rest${lease.shared.eligibility ? `; ${clause(lease.shared.eligibility)}` : ''}`;
  }
  const tax = checking.has('local_tax') ? '' : localTaxWords(l.local_tax, nation);
  if (tax) out[nation === 'northern_ireland' ? 'rates' : 'council_tax'] = tax.replace(/^Council tax /, '');
  if (!checking.has('epc')) out.epc = l.epc.trim() ? l.epc.trim() : 'not yet available';
  const said = (k: CheckKey) => !checking.has(k) && l.checks[k].v !== 'unknown';
  const grouped = new Set<CheckKey>();
  /** The keys in a group the seller answered plainly, each taken out of the list said one by one. */
  const plain = (group: Partial<Record<CheckKey, string>>, v: CheckValue) => (Object.keys(group) as CheckKey[]).filter((k) => {
    const ok = said(k) && l.checks[k].v === v && l.checks[k].says === `${CHECKS[k][v as 'yes' | 'no']}.`;
    if (ok) grouped.add(k);
    return ok;
  });
  const mains = plain({ mains_gas: 'gas', mains_water: 'water', mains_drainage: 'drainage' }, 'yes');
  if (mains.length) out.mains = `Mains ${mains.map((k) => k.replace('mains_', '')).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
  const lines = [
    plain(NOT_IN, 'no').map((k) => NOT_IN[k]!),
    plain(NO_RISK, 'no').map((k) => NO_RISK[k]!),
    plain(DECLARED, 'no').map((k) => DECLARED[k]!),
  ];
  const none = [
    lines[0].length ? `Not ${lines[0].join(', not ').replace(/, not ([^,]*)$/, ' and not $1')}.` : '',
    lines[1].length ? `No ${orList(lines[1])}.` : '',
    lines[2].length ? `No ${orList(lines[2])} declared.` : '',
  ].filter(Boolean).join(' ');
  if (none) out.none = none;
  for (const k of CHECK_KEYS) {
    if (!said(k) || grouped.has(k)) continue;
    // "Parking: one allocated space." under the key parking says parking twice.
    out[k] = TOPIC_ONLY.has(k) && l.checks[k].v === 'yes' ? l.checks[k].says.replace(/^[^:]+: /, '') : l.checks[k].says;
  }
  for (const [k, v] of Object.entries(out)) if (UNSAYABLE.test(v)) delete out[k];
  return {
    facts: out,
    unknown: CHECK_KEYS.filter((k) => !checking.has(k) && l.checks[k].v === 'unknown').map((k) => CHECKS[k].unknown),
    being_checked: [...checking].map((k) => (k in CHECKS ? CHECKS[k as CheckKey].unknown : CHECKING_WORDS[k] ?? k.replace(/_/g, ' '))),
  };
}

/**
 * Which must-say lines the agent has not said yet, from its own words
 * since the home was briefed: any one of an item's listen words will do,
 * with hyphens and punctuation ignored ("seventy six" is "seventy-six").
 */
export function unsaid(items: SayItem[], lines: string[]): SayItem[] {
  const said = ` ${lines.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return items.filter((i) => !i.listen.some((w) => said.includes(` ${w.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `)));
}
