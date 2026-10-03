// Homes for sale, in words: what a listing says about itself, worked out
// in code so the receptionist only ever reads what is true on the day. Pure
// functions over the compiled profile and a listing's live row
// (voice_listings), unit tested in test/estate-agent.test.ts. The estate
// agent's compile, preview and seed use them now; the receptionist's tools
// read listings through the same functions (presets/estate-agent.md §4.2).

import type {
  BuyerPosition, CheckKey, CheckValue, HomeType, Listing, ListingState, Nation, OpeningHours, PriceQualifier, SayItem, TenantProfile, ViewingWindow,
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
  const years = l.lease ? leaseYears(l.lease.expires, today) : null;
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
