// The restaurant builder's answers: everything a prospect sets, with
// defaults good enough that "Next, Next, Next" still makes a convincing demo.
// Compiled into a TenantProfile by compile.ts; the receptionist never reads
// these directly. Field by field in DEMO-SERVICE-PLAN.md §4.1.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MenuCategory, ModifierGroup } from '../../domain/types.ts';
import { autoLayout } from './layout.ts';

export interface ServicePeriod {
  label: string;
  open: string;
  close: string;
}

export interface DayHours {
  open: boolean;
  services: ServicePeriod[];
}

export interface AreaAnswer {
  key: string;
  label: string;
  kind: 'indoor' | 'outdoor' | 'bar' | 'private' | 'other';
  reservable: boolean;
  /** A private room: take details for a callback rather than book. */
  enquiry_only: boolean;
  /** Outdoor only. */
  weather_rule: 'move_inside' | 'own_risk' | 'walk_in_only' | null;
}

export interface TableAnswer {
  key: string;
  label: string;
  area: string;
  seats: number;
  shape: 'round' | 'square' | 'rect';
  x: number;
  y: number;
  rotation: number;
  accessible: boolean;
  /** Kept back for walk-ins: shown on the plan, never booked by phone. */
  walk_in: boolean;
  features: string[];
  /** Tables this one pushes together with (both ways). */
  joins: string[];
}

export interface RestaurantAnswers {
  version: 1;
  basics: {
    name: string;
    /** "Neapolitan pizza and fresh pasta": drives the menu draft and the greeting's tone. */
    style: string;
    town: string;
    address: string;
    phone_display: string;
    website: string;
    voice: string;
    /** Empty: generated from the name. */
    greeting: string;
  };
  hours: {
    /** Seven entries, 0 = Sunday. */
    days: DayHours[];
    last_booking_before_close: number;
    closures: { date: string; note: string }[];
  };
  serve: {
    reservations: boolean;
    walk_ins: boolean;
    collection: { enabled: boolean; prep_minutes: number; slot_minutes: number; per_slot: number; evenings_only: boolean };
    delivery: { enabled: boolean; districts: string[]; fee_pence: number; min_order_pence: number; extra_minutes: number };
    /** Named for the FAQ only: "you'll find us on Deliveroo". */
    delivery_apps: string[];
  };
  seating: {
    areas: AreaAnswer[];
    tables: TableAnswer[];
    /** Minutes a table is held, by party size. */
    sittings: { up_to_2: number; up_to_4: number; up_to_8: number; larger: number };
    max_party: number;
    notice_minutes: number;
    horizon_days: number;
    highchairs: number;
    buffer_minutes: number;
  };
  menu: {
    categories: MenuCategory[];
    modifier_groups: Record<string, ModifierGroup>;
    allergen_statement: string;
    source: 'sample' | 'draft' | 'website' | 'manual';
    /** Drafted allergens are illustrations until the owner checks them. */
    allergens_are_examples: boolean;
  };
  money: {
    deposit: { mode: 'none' | 'per_person' | 'per_booking' | 'card_hold'; amount_pence: number; min_party: number };
    cancellation_policy: string;
    takeaway_payment: 'phone' | 'collection' | 'either';
    service_charge: string;
  };
  policies: {
    children: string;
    dogs: 'inside' | 'outside_only' | 'no';
    accessibility: string;
    parking: string;
    dress_code: string;
    corkage: string;
    cakes: string;
    vouchers: string;
    dietary: string;
    faqs: { q: string; a: string }[];
  };
  theme: {
    accent: string;
    primary: string;
    background: string;
    font_heading: string;
    font_body: string;
    logo: string | null;
  };
  /** Where each field came from, by path ("basics.name"): the scout marks what it found or guessed. */
  sources: Record<string, 'website' | 'guess'>;
}

const HERE = dirname(fileURLToPath(import.meta.url));

/** The sample menu: Luca's Trattoria, the demo restaurant, complete with allergens and options. */
function sampleMenu(): RestaurantAnswers['menu'] {
  const p = JSON.parse(readFileSync(join(HERE, '..', '..', '..', 'fixtures', 'tenants', 'lucas-trattoria.json'), 'utf8'));
  return {
    categories: p.menu.categories,
    modifier_groups: p.menu.modifier_groups,
    allergen_statement: p.menu.allergen_statement,
    source: 'sample',
    allergens_are_examples: true,
  };
}

const lunchDinner = (): DayHours => ({
  open: true,
  services: [
    { label: 'Lunch', open: '12:00', close: '14:30' },
    { label: 'Dinner', open: '17:30', close: '22:00' },
  ],
});

export function defaultAreas(): AreaAnswer[] {
  return [
    { key: 'indoor', label: 'Inside', kind: 'indoor', reservable: true, enquiry_only: false, weather_rule: null },
    { key: 'terrace', label: 'Terrace', kind: 'outdoor', reservable: true, enquiry_only: false, weather_rule: 'move_inside' },
  ];
}

/** Table counts by size, per area: the builder's "how many tables" step. */
export type TableCounts = Record<string, { 2: number; 4: number; 6: number; 8: number }>;

export function tablesFromCounts(areas: AreaAnswer[], counts: TableCounts): TableAnswer[] {
  const tables: TableAnswer[] = [];
  let n = 1;
  for (const a of areas) {
    const c = counts[a.key] ?? { 2: 0, 4: 0, 6: 0, 8: 0 };
    for (const seats of [2, 4, 6, 8] as const) {
      for (let i = 0; i < c[seats]; i++) {
        tables.push({
          key: `T${n}`, label: `Table ${n}`, area: a.key, seats,
          shape: seats === 2 ? 'round' : seats === 4 ? 'square' : 'rect',
          x: 0, y: 0, rotation: 0, accessible: false, walk_in: false, features: [], joins: [],
        });
        n++;
      }
    }
  }
  return autoLayout(areas, tables);
}

export function defaultTables(areas = defaultAreas()): TableAnswer[] {
  const tables = tablesFromCounts(areas, { indoor: { 2: 4, 4: 5, 6: 2, 8: 0 }, terrace: { 2: 0, 4: 4, 6: 0, 8: 0 } });
  const t = (k: string) => tables.find((x) => x.key === k)!;
  // Window two-tops that push together; two step-free four-tops; a booth.
  t('T1').features.push('window');
  t('T2').features.push('window');
  t('T1').joins.push('T2');
  t('T2').joins.push('T1');
  t('T3').joins.push('T4');
  t('T4').joins.push('T3');
  t('T5').accessible = true;
  t('T6').accessible = true;
  t('T7').joins.push('T8');
  t('T8').joins.push('T7');
  t('T10').features.push('booth');
  t('T11').features.push('quiet');
  for (const k of ['T12', 'T13', 'T14', 'T15']) t(k).features.push('heated');
  t('T13').joins.push('T14');
  t('T14').joins.push('T13');
  // No table is kept for walk-ins unless the owner marks one: a table that is
  // never booked looked like a bug to a prospect (Alex, 1 October).
  return tables;
}

export function defaultAnswers(): RestaurantAnswers {
  const areas = defaultAreas();
  return {
    version: 1,
    basics: {
      name: '',
      style: 'Neapolitan pizza, fresh pasta and Italian small plates',
      town: 'Nottingham',
      address: '',
      phone_display: '0115 496 0123',
      website: '',
      voice: 'Kore',
      greeting: '',
    },
    hours: {
      // Closed Monday; lunch and dinner Tuesday to Saturday; Sunday all day.
      days: [
        { open: true, services: [{ label: 'All day', open: '12:00', close: '20:00' }] },
        { open: false, services: [] },
        lunchDinner(), lunchDinner(), lunchDinner(), lunchDinner(), lunchDinner(),
      ],
      last_booking_before_close: 60,
      closures: [],
    },
    serve: {
      reservations: true,
      walk_ins: true,
      collection: { enabled: true, prep_minutes: 20, slot_minutes: 15, per_slot: 4, evenings_only: true },
      delivery: { enabled: false, districts: [], fee_pence: 250, min_order_pence: 1500, extra_minutes: 20 },
      delivery_apps: [],
    },
    seating: {
      areas,
      tables: defaultTables(areas),
      sittings: { up_to_2: 75, up_to_4: 90, up_to_8: 120, larger: 150 },
      max_party: 10,
      notice_minutes: 30,
      horizon_days: 60,
      highchairs: 3,
      buffer_minutes: 0,
    },
    menu: sampleMenu(),
    money: {
      deposit: { mode: 'per_person', amount_pence: 1000, min_party: 7 },
      cancellation_policy: "Please give 48 hours' notice to cancel or change. Deposits are refunded with 48 hours' notice.",
      takeaway_payment: 'either',
      service_charge: 'A discretionary 12.5% service charge is added for tables of six or more.',
    },
    policies: {
      children: 'Children are very welcome, with highchairs and a kids’ menu.',
      dogs: 'outside_only',
      accessibility: 'Step-free entrance, level floor throughout the ground floor, and an accessible toilet.',
      parking: 'No car park of our own; the nearest multi-storey is about five minutes’ walk.',
      dress_code: 'No dress code.',
      corkage: 'We don’t allow bring your own.',
      cakes: 'You’re welcome to bring a birthday cake; there’s no cakeage charge.',
      vouchers: 'Gift vouchers are available in the restaurant.',
      dietary: 'Plenty of vegetarian dishes, several vegan, and gluten-free pizza bases.',
      faqs: [],
    },
    theme: {
      accent: '#e9ac57',
      primary: '#2a2217',
      background: '#0e0c0a',
      font_heading: 'system-ui',
      font_body: 'system-ui',
      logo: null,
    },
    sources: {},
  };
}
