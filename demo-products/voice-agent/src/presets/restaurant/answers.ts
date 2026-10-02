// The restaurant builder's answers: everything a prospect sets, with
// defaults good enough that "Next, Next, Next" still makes a convincing demo.
// Compiled into a TenantProfile by compile.ts; the receptionist never reads
// these directly. Field by field in DEMO-SERVICE-PLAN.md §4.1.

import type { BaseAnswers, BasicsAnswer, ClosureAnswer, DayHours, FaqAnswer, Sources, ThemeAnswer } from '../common/types.ts';
import { sampleMenu, type MenuAnswer } from '../food/menu.ts';
import type { CollectionAnswer, DeliveryAnswer, OrderPayment } from '../food/ordering.ts';
import { defaultAreas } from '../seating/areas.ts';
import { defaultFixtures } from '../seating/fixtures.ts';
import { tablesFromCounts } from '../seating/tables.ts';
import type { DepositAnswer, SeatingAnswer, TableAnswer } from '../seating/types.ts';

export type { DayHours, ServicePeriod } from '../common/types.ts';
export type { AreaAnswer, FixtureAnswer, TableAnswer } from '../seating/types.ts';
export { defaultAreas } from '../seating/areas.ts';
export { defaultFixtures } from '../seating/fixtures.ts';
export { tablesFromCounts, type TableCounts } from '../seating/tables.ts';

/** The shape of the answers today. Raise it with a migrate step (PRESETS.md §1, rule 2), so saved setups keep loading. */
export const VERSION = 1;

export interface RestaurantAnswers extends BaseAnswers {
  version: typeof VERSION;
  basics: BasicsAnswer;
  hours: {
    /** Seven entries, 0 = Sunday. */
    days: DayHours[];
    last_booking_before_close: number;
    closures: ClosureAnswer[];
  };
  serve: {
    reservations: boolean;
    walk_ins: boolean;
    collection: CollectionAnswer;
    delivery: DeliveryAnswer;
    /** Named for the FAQ only: "you'll find us on Deliveroo". */
    delivery_apps: string[];
  };
  seating: SeatingAnswer;
  menu: MenuAnswer;
  money: {
    deposit: DepositAnswer;
    cancellation_policy: string;
    takeaway_payment: OrderPayment;
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
    faqs: FaqAnswer[];
  };
  theme: ThemeAnswer;
  sources: Sources;
}

const lunchDinner = (): DayHours => ({
  open: true,
  services: [
    { label: 'Lunch', open: '12:00', close: '14:30' },
    { label: 'Dinner', open: '17:30', close: '22:00' },
  ],
});

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
  const tables = defaultTables(areas);
  return {
    version: VERSION,
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
      tables,
      fixtures: defaultFixtures(tables),
      plan: 2,
      sittings: { up_to_2: 75, up_to_4: 90, up_to_8: 120, larger: 150 },
      max_party: 10,
      notice_minutes: 30,
      horizon_days: 60,
      highchairs: 3,
      buffer_minutes: 0,
    },
    // Luca's Trattoria, the demo restaurant, complete with allergens and options.
    menu: sampleMenu('tenants/lucas-trattoria.json'),
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
