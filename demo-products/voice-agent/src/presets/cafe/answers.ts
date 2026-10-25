// The café builder's answers (presets/cafe.md §2): everything a prospect
// sets, with defaults good enough that "Next, Next, Next" still makes a
// convincing demo. Compiled into a TenantProfile by compile.ts; the
// receptionist never reads these directly.

import type { BaseAnswers, BasicsAnswer, ClosureAnswer, DayHours, FaqAnswer, Sources, ThemeAnswer } from '../common/types.ts';
import { sampleMenu, type MenuAnswer } from '../food/menu.ts';
import type { OrderPayment, OrderingAnswer } from '../food/ordering.ts';
import { defaultFixtures } from '../seating/fixtures.ts';
import { tablesFromCounts } from '../seating/tables.ts';
import type { AreaAnswer, SeatingAnswer, TableAnswer } from '../seating/types.ts';

/** The shape of the answers today. Raise it with a migrate step (PRESETS.md §1, rule 2), so saved setups keep loading. */
export const VERSION = 1;

export interface CafeAnswers extends BaseAnswers {
  version: typeof VERSION;
  basics: BasicsAnswer;
  hours: {
    /** Seven entries, 0 = Sunday. */
    days: DayHours[];
    closures: ClosureAnswer[];
    /** Breakfast is served until this time, HH:MM; null: all day. */
    breakfast_until: string | null;
    /** Food stops this many minutes before closing; drinks and cakes until close. */
    kitchen_closes_before: number;
  };
  seating: SeatingAnswer;
  booking: {
    /** Tables for this many or more are booked; smaller ones are walk-in. */
    min_party: number;
    /** Said to a walk-in: "Saturday 11 till 2 is our busiest". */
    busy_times: string;
  };
  afternoon_tea: {
    offered: boolean;
    adult_pence: number;
    child_pence: number;
    /** Children's price up to this age. */
    child_under: number;
    description: string;
    /** Days ahead it must be booked; a gluten-free or vegan version needs `diet_notice_days`. */
    notice_days: number;
    diet_notice_days: number;
    /** The versions the kitchen makes ("gluten-free", "vegan"). */
    diets: string[];
    /** Sitting times, HH:MM; each fits only on days the café is open long enough. */
    sittings: string[];
    minutes: number;
    max_party: number;
    /** Per person, off the bill; 0 is none (Alex, 12 October). */
    deposit_pence: number;
  };
  /** The shared ordering answer: collection only by default. */
  ordering: OrderingAnswer;
  menu: MenuAnswer;
  money: {
    /** An order to collect: paid by card on the phone, when collecting, or either. */
    payment: OrderPayment;
    cash: boolean;
    tips: string;
  };
  policies: {
    dogs: 'inside' | 'outside_only' | 'no';
    children: string;
    baby_changing: boolean;
    accessibility: string;
    wifi: string;
    laptops: string;
    parking: string;
    tap_water: boolean;
    /** The food hygiene rating, 0 to 5, or null if the owner doesn't say. */
    hygiene_rating: number | null;
    reusable_cups: string;
    careers: string;
    hire: string;
    faqs: FaqAnswer[];
  };
  theme: ThemeAnswer;
  sources: Sources;
}

const day = (open: string, close: string): DayHours => ({ open: true, services: [{ label: 'All day', open, close }] });

export function defaultCafeAreas(): AreaAnswer[] {
  return [
    { key: 'indoor', label: 'Inside', kind: 'indoor', reservable: true, enquiry_only: false, weather_rule: null },
    // Three tables for two, first come first served whatever the weather.
    { key: 'outside', label: 'Outside', kind: 'outdoor', reservable: false, enquiry_only: false, weather_rule: 'walk_in_only' },
  ];
}

export function defaultCafeTables(areas = defaultCafeAreas()): TableAnswer[] {
  const tables = tablesFromCounts(areas, { indoor: { 2: 4, 4: 3, 6: 0, 8: 1 }, outside: { 2: 3, 4: 0, 6: 0, 8: 0 } });
  const t = (k: string) => tables.find((x) => x.key === k)!;
  // The big table for eight by the window; two four-tops push together for a group; step-free at the big table and one four.
  t('T8').features.push('window');
  t('T8').accessible = true;
  t('T5').accessible = true;
  t('T6').joins.push('T7');
  t('T7').joins.push('T6');
  t('T1').features.push('sofa');
  return tables;
}

export function defaultAnswers(): CafeAnswers {
  const areas = defaultCafeAreas();
  const tables = defaultCafeTables(areas);
  return {
    version: VERSION,
    basics: {
      name: '',
      style: 'Coffee, breakfast, light lunches and homemade cakes',
      town: 'Nottingham',
      address: '14 Wren Street (example), Nottingham NG1',
      phone_display: '0115 496 0812',
      website: '',
      voice: 'Aoede',
      greeting: '',
    },
    hours: {
      // Sunday 10 to 3; Monday to Friday 8 to 4; Saturday 9 to 5.
      days: [day('10:00', '15:00'), day('08:00', '16:00'), day('08:00', '16:00'), day('08:00', '16:00'), day('08:00', '16:00'), day('08:00', '16:00'), day('09:00', '17:00')],
      closures: [],
      breakfast_until: '11:30',
      kitchen_closes_before: 30,
    },
    seating: {
      areas,
      tables,
      fixtures: defaultFixtures(tables),
      plan: 2,
      // A café sitting is shorter than a restaurant's; afternoon tea has its own length.
      sittings: { up_to_2: 60, up_to_4: 75, up_to_8: 90, larger: 105 },
      max_party: 8,
      notice_minutes: 60,
      horizon_days: 30,
      highchairs: 3,
      buffer_minutes: 0,
    },
    booking: {
      min_party: 5,
      busy_times: 'Saturday from 11 till 2 is our busiest; weekday mornings and mid-afternoons are quieter.',
    },
    afternoon_tea: {
      offered: true,
      adult_pence: 2450,
      child_pence: 1200,
      child_under: 12,
      description: 'Finger sandwiches, scones with jam and clotted cream, a selection of cakes, and a pot of tea or a coffee each.',
      notice_days: 1,
      diet_notice_days: 2,
      diets: ['gluten-free', 'vegan'],
      sittings: ['12:00', '14:00', '15:30'],
      minutes: 90,
      max_party: 8,
      deposit_pence: 0,
    },
    ordering: {
      collection: { enabled: true, prep_minutes: 10, slot_minutes: 5, per_slot: 4 },
      delivery: { enabled: false, districts: [], fee_pence: 0, min_order_pence: 0, extra_minutes: 0 },
      delivery_apps: [],
      timed_orders: true,
    },
    menu: sampleMenu('menus/wren-street-cafe.json'),
    money: {
      payment: 'collection',
      cash: true,
      tips: 'Tips are never expected; any paid by card go to the team in full.',
    },
    policies: {
      dogs: 'inside',
      children: 'Children are very welcome: there’s a children’s menu and babyccinos.',
      baby_changing: true,
      accessibility: 'Step-free from the street, with an accessible toilet.',
      wifi: 'Free Wi-Fi; the password is on the counter.',
      laptops: 'Laptops are welcome, except at weekend lunchtimes when we need the tables.',
      parking: 'No parking of our own; the nearest car park is about five minutes’ walk.',
      tap_water: true,
      hygiene_rating: 5,
      reusable_cups: 'Bring your own cup and we’ll happily fill it.',
      careers: 'We sometimes have weekend roles: leave your name and number and the owner will be in touch.',
      hire: 'The café can be hired in the evenings for parties: the owner will call back to talk it through.',
      faqs: [],
    },
    theme: {
      accent: '#c9814a',
      primary: '#2b2420',
      background: '#f7f1ea',
      font_heading: 'system-ui',
      font_body: 'system-ui',
      logo: null,
    },
    sources: {},
  };
}
