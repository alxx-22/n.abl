// The homes an agency sells, as its owner sets them in the builder
// (presets/estate-agent.md §2.2), the sanitiser that rebuilds them from
// whatever JSON arrived, and the sample stock a new demo starts from.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECK_KEYS, type CheckKey, type CheckValue, type HomeType, type PriceQualifier, type Tenure } from '../../domain/types.ts';
import { arr, bool, closeTime, int, key, oneOf, str, time } from '../common/sanitise.ts';

/** What a home's status can be in the builder; "completed" only ever happens during a demo. */
export const LISTING_STATUSES = ['coming_soon', 'available', 'under_offer', 'sale_agreed', 'exchanged', 'withdrawn'] as const;
export type ListingAnswerStatus = (typeof LISTING_STATUSES)[number];
export const QUALIFIERS = ['guide', 'offers_over', 'oiro', 'fixed', 'share'] as const satisfies readonly PriceQualifier[];
export const HOME_TYPES = ['flat', 'maisonette', 'terraced', 'end_terrace', 'semi', 'detached', 'bungalow', 'cottage', 'other'] as const satisfies readonly HomeType[];
export const TENURES = ['freehold', 'leasehold', 'share_of_freehold', 'shared_ownership', 'unknown'] as const satisfies readonly Tenure[];
const CHECK_VALUES = ['yes', 'no', 'unknown'] as const satisfies readonly CheckValue[];

export const MAX_LISTINGS = 30;

export interface LeaseAnswer {
  /** YYYY-MM-DD; the years left are worked out in code on the day. */
  expires: string;
  service_charge: string;
  ground_rent: string;
  reserve_fund: string;
  event_fee: string;
  managing_agent: string;
  age_limit: number | null;
  shared: { share_percent: number; rent_pence_month: number; provider: string; eligibility: string; nomination_weeks: number } | null;
}

export interface ListingAnswer {
  key: string;
  /** The agency's own reference, quoted from the portals ("HG104"). */
  ref: string;
  /** "41", "Flat 2, 41", "The Bungalow, 6". */
  number: string;
  street: string;
  district: string;
  town: string;
  /** At Start; during the demo the live status is in voice_listings. */
  status: ListingAnswerStatus;
  price_pence: number;
  qualifier: PriceQualifier;
  /** Relative to Start, so the sample never goes stale. */
  marketed_days_ago: number;
  reduced: { days_ago: number; from_pence: number } | null;
  back_on_market_days_ago: number | null;
  /** Coming soon: first viewings this many days after Start. */
  viewings_from_days: number | null;
  type: HomeType;
  beds: number;
  baths: number;
  receptions: number;
  /** garden, parking, garage, step-free... */
  features: string[];
  /** One factual sentence. */
  summary: string;
  /** size '' = not measured. */
  rooms: { name: string; size: string }[];
  tenure: Tenure;
  /** Leasehold and shared ownership. */
  lease: LeaseAnswer | null;
  /** Council tax band ("C"); in Northern Ireland, the rates. */
  local_tax: string;
  /** "C", "exempt", or '' = not yet. */
  epc: string;
  checks: Record<CheckKey, { v: CheckValue; note: string }>;
  /** The owner's own must-say facts. */
  say_up_front: string[];
  /** What the seller agreed may be shared ("No onward chain"). */
  seller_position: string;
  /** The shareable reason a sale fell through, if any. */
  fall_through: string;
  viewing: {
    /** When the seller allows viewings; empty = all the agency's viewing hours. */
    windows: { days: number[]; from: string; to: string }[];
    notice_hours: number;
    occupied: 'owner' | 'tenant' | 'vacant';
    key_held: boolean;
  };
  /** A staff key. */
  negotiator: string;
  personal_interest: { staff: string; wording: string } | null;
  /** "Harper & Co, until June": buyers are asked once whether they viewed through them. */
  other_agents: string;
  links: { brochure: boolean; floorplan: boolean; video: boolean; epc: boolean };
  /** An invented sample home in the made-up town: shown as an example, never as a real address. */
  example: boolean;
}

/** "bk 2" → "BK2"; anything that is not a postcode district → ''. */
export function district(v: unknown): string {
  const d = typeof v === 'string' ? v.toUpperCase().replace(/\s+/g, '') : '';
  return /^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(d) ? d : '';
}

/** A staff member it points at, or '' for nobody. */
export const staffRef = (v: unknown): string => (typeof v === 'string' && v.trim() ? key(v, '') : '');

const isoDate = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const nullableInt = (v: unknown, min: number, max: number): number | null => (v === null || v === undefined || v === '' ? null : int(v, min, max, min));
const days = (v: unknown): number[] => [...new Set(arr(v).map((d) => int(d, -1, 7, -1)).filter((d) => d >= 0 && d <= 6))].sort();
const strings = (v: unknown, max: number, len: number): string[] => arr(v).map((x) => str(x, len)).filter(Boolean).slice(0, max);

function sanitiseLease(v: unknown): LeaseAnswer | null {
  if (!v || typeof v !== 'object') return null;
  const l = v as any;
  const s = l.shared && typeof l.shared === 'object' ? l.shared : null;
  return {
    expires: isoDate(l.expires),
    service_charge: str(l.service_charge, 200),
    ground_rent: str(l.ground_rent, 200),
    reserve_fund: str(l.reserve_fund, 200),
    event_fee: str(l.event_fee, 200),
    managing_agent: str(l.managing_agent, 100),
    age_limit: nullableInt(l.age_limit, 0, 100),
    shared: s
      ? {
          share_percent: int(s.share_percent, 1, 100, 50),
          rent_pence_month: int(s.rent_pence_month, 0, 1_000_000, 0),
          provider: str(s.provider, 100),
          eligibility: str(s.eligibility, 300),
          nomination_weeks: int(s.nomination_weeks, 0, 52, 0),
        }
      : null,
  };
}

function sanitiseChecks(v: unknown): ListingAnswer['checks'] {
  const c = (v ?? {}) as any;
  return Object.fromEntries(CHECK_KEYS.map((k) => [k, { v: oneOf(c[k]?.v, CHECK_VALUES, 'unknown'), note: str(c[k]?.note, 200) }])) as ListingAnswer['checks'];
}

/** One home, rebuilt field by field; `fallbackKey` names one that arrived without a key. */
export function sanitiseListing(v: unknown, fallbackKey: string): ListingAnswer {
  const x = (v ?? {}) as any;
  const r = x.reduced && typeof x.reduced === 'object' ? x.reduced : null;
  const view = (x.viewing ?? {}) as any;
  const pi = x.personal_interest && typeof x.personal_interest === 'object' ? x.personal_interest : null;
  const links = (x.links ?? {}) as any;
  return {
    key: key(x.key, fallbackKey),
    ref: str(x.ref, 12).toUpperCase().replace(/[^A-Z0-9]/g, ''),
    number: str(x.number, 60),
    street: str(x.street, 80),
    district: district(x.district),
    town: str(x.town, 60),
    status: oneOf(x.status, LISTING_STATUSES, 'available'),
    price_pence: int(x.price_pence, 0, 2_000_000_000, 0),
    qualifier: oneOf(x.qualifier, QUALIFIERS, 'fixed'),
    marketed_days_ago: int(x.marketed_days_ago, 0, 3650, 0),
    reduced: r ? { days_ago: int(r.days_ago, 0, 3650, 0), from_pence: int(r.from_pence, 0, 2_000_000_000, 0) } : null,
    back_on_market_days_ago: nullableInt(x.back_on_market_days_ago, 0, 3650),
    viewings_from_days: nullableInt(x.viewings_from_days, 0, 90),
    type: oneOf(x.type, HOME_TYPES, 'other'),
    beds: int(x.beds, 0, 20, 0),
    baths: int(x.baths, 0, 10, 0),
    receptions: int(x.receptions, 0, 10, 0),
    features: strings(x.features, 12, 40),
    summary: str(x.summary, 200),
    // Rows still being filled in are kept, so an autosave never takes one from under the cursor; compile leaves out what is empty.
    rooms: arr(x.rooms).slice(0, 20).map((m: any) => ({ name: str(m?.name, 40), size: str(m?.size, 30) })),
    tenure: oneOf(x.tenure, TENURES, 'unknown'),
    lease: sanitiseLease(x.lease),
    local_tax: str(x.local_tax, 30),
    epc: str(x.epc, 12),
    checks: sanitiseChecks(x.checks),
    say_up_front: arr(x.say_up_front).slice(0, 4).map((t) => str(t, 200)),
    seller_position: str(x.seller_position, 200),
    fall_through: str(x.fall_through, 200),
    viewing: {
      windows: arr(view.windows).slice(0, 6)
        .filter((w: any) => w && typeof w === 'object')
        .map((w: any) => ({ days: days(w?.days), from: time(w?.from, '09:00'), to: closeTime(w?.to, '17:00') })),
      notice_hours: int(view.notice_hours, 0, 168, 2),
      occupied: oneOf(view.occupied, ['owner', 'tenant', 'vacant'] as const, 'owner'),
      key_held: bool(view.key_held, false),
    },
    negotiator: staffRef(x.negotiator),
    personal_interest: pi ? { staff: staffRef(pi.staff), wording: str(pi.wording, 300) } : null,
    other_agents: str(x.other_agents, 120),
    links: { brochure: bool(links.brochure, true), floorplan: bool(links.floorplan, true), video: bool(links.video, false), epc: bool(links.epc, true) },
    example: bool(x.example, false),
  };
}

/** The homes in order, each key once (a copy gets _2), at most MAX_LISTINGS. */
export function sanitiseListings(v: unknown[]): ListingAnswer[] {
  const used = new Set<string>();
  return v.slice(0, MAX_LISTINGS).map((x, i) => {
    const l = sanitiseListing(x, `home_${i + 1}`);
    let k = l.key;
    for (let n = 2; used.has(k); n++) k = `${l.key.slice(0, 36)}_${n}`;
    used.add(k);
    return { ...l, key: k };
  });
}

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures');
let sample: ListingAnswer[] | null = null;

/**
 * The 18 sample homes in the made-up town of Brackenford, every one an
 * example. Read and cleaned once; every call gets its own copy, because a
 * builder edits its defaults in place.
 */
export function sampleListings(): ListingAnswer[] {
  sample ??= sanitiseListings(JSON.parse(readFileSync(join(FIXTURES, 'presets', 'estate-listings.json'), 'utf8')).listings);
  return structuredClone(sample);
}
