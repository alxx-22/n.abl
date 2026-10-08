// The takeaway builder's answers (presets/takeaway.md §2): everything a
// prospect sets, with defaults good enough that "Next, Next, Next" still
// makes a convincing demo of a busy Friday night. Compiled into a
// TenantProfile by compile.ts; the receptionist never reads these directly.

import type { BaseAnswers, BasicsAnswer, DayHours, FaqAnswer, HoursAnswer, Sources, ThemeAnswer } from '../common/types.ts';
import { sampleDeals, type DealAnswer } from '../food/deals.ts';
import { sampleMenu, type MenuAnswer } from '../food/menu.ts';
import type { OrderingAnswer, OrderPayment } from '../food/ordering.ts';

/** The shape of the answers today. Raise it with a migrate step (PRESETS.md §1, rule 2), so saved setups keep loading. */
export const VERSION = 1;

export const PAY_DRIVER = ['no', 'cash', 'cash_or_card'] as const;
export type PayDriver = (typeof PAY_DRIVER)[number];
export const HALAL = ['all', 'chicken', 'none'] as const;
export const MISSING_ITEMS = ['manager', 'send_out'] as const;
/** Where the shop is: Scotland's alcohol hours, and Wales's and Northern Ireland's hygiene rating rules. */
export const TK_NATIONS = ['england', 'wales', 'scotland', 'northern_ireland'] as const;
export type TkNation = (typeof TK_NATIONS)[number];

/** A drink sold only to adults, on the owner's own short list. */
export interface AlcoholItem {
  name: string;
  price_pence: number;
  description: string;
}

/** The sample list an owner starts from when they switch alcohol on: invented prices, theirs to change. */
export const SAMPLE_ALCOHOL: AlcoholItem[] = [
  { name: 'Lager four-pack', price_pence: 749, description: 'Four 330ml bottles.' },
  { name: 'Cider four-pack', price_pence: 749, description: 'Four 440ml cans.' },
  { name: 'Bottle of rosé', price_pence: 999, description: '75cl.' },
];

export interface TakeawayAnswers extends BaseAnswers {
  version: typeof VERSION;
  basics: BasicsAnswer;
  hours: HoursAnswer;
  /** The shared food ordering answer, with every optional field the takeaway has: zones, free delivery, drivers, timed orders. */
  ordering: Required<OrderingAnswer> & { delivery: Required<OrderingAnswer['delivery']> };
  kitchen: {
    /** No new orders this many minutes before closing; every order is handed over by closing (the late-night licence). */
    last_orders_minutes: number;
    /** An order with more mains than this takes two of the kitchen's slots. */
    big_order_mains: number;
    /** More mains than this is a catering order: a message for the manager, not an order on the phone. */
    catering_over_mains: number;
  };
  menu: MenuAnswer;
  /** Their own section, so a menu draft never deletes them. */
  deals: DealAnswer[];
  money: {
    payment: OrderPayment;
    /** What the driver takes at the door. */
    pay_driver: PayDriver;
    /** A minimum spend for card; never a surcharge (presets/takeaway.md §8). Null: none. */
    card_minimum_pence: number | null;
  };
  /** When something goes wrong after the order. */
  after: {
    /** This long past the time they were given, "where's my food?" goes to the manager. */
    late_after_minutes: number;
    /** An item missing from a delivery: a call from the manager, or sent out with the next driver. */
    missing_items: (typeof MISSING_ITEMS)[number];
    /** Numbers that refused a delivery: they pay on the phone, or collect. Kept as typed; compile keeps the valid ones. */
    pay_on_phone_numbers: string[];
  };
  /** Where the shop is. */
  nation: TkNation;
  /** Off by default (presets/takeaway.md, decision 2). On: these drinks, to adults only, until the last sale time. */
  alcohol: {
    on: boolean;
    /** "HH:MM": the last time alcohol is sold, by the licence. Null: whenever the shop is open. */
    until: string | null;
    items: AlcoholItem[];
  };
  policies: {
    halal: (typeof HALAL)[number];
    /** The food hygiene rating, 0 to 5, or null when not given. */
    hygiene_rating: number | null;
    parking: string;
    /** Words only: an offer never changes a total in the demo. */
    offers: string;
    bags: string;
    careers: string;
    tips: string;
    faqs: FaqAnswer[];
  };
  theme: ThemeAnswer;
  sources: Sources;
}

const MENU = 'presets/takeaway-menu.json';

const open = (close: string): DayHours => ({ open: true, services: [{ label: 'Open', open: '12:00', close }] });

export function defaultAnswers(): TakeawayAnswers {
  const menu = sampleMenu(MENU);
  return {
    version: VERSION,
    basics: {
      name: '',
      style: 'Fried chicken, burgers and pizza',
      town: 'Nottingham',
      address: '',
      phone_display: '0115 496 0456',
      website: '',
      voice: 'Achird',
      greeting: '',
    },
    // Every day 12 till 11, Friday and Saturday till midnight.
    hours: { days: [open('23:00'), open('23:00'), open('23:00'), open('23:00'), open('23:00'), open('24:00'), open('24:00')], closures: [] },
    ordering: {
      collection: { enabled: true, prep_minutes: 15, slot_minutes: 15, per_slot: 4 },
      delivery: {
        enabled: true,
        // Four districts close by, and two further out at their own fee and minimum.
        districts: ['NG1', 'NG2', 'NG3', 'NG7', 'NG5', 'NG9'],
        fee_pence: 250,
        min_order_pence: 1200,
        extra_minutes: 25,
        zones: [{ code: 'NG5', fee_pence: 350, min_order_pence: 1500 }, { code: 'NG9', fee_pence: 350, min_order_pence: 1500 }],
        free_over_pence: 3000,
        drivers: ['Kai', 'Priya', 'Tom'],
      },
      delivery_apps: ['Just Eat'],
      timed_orders: true,
    },
    kitchen: { last_orders_minutes: 15, big_order_mains: 6, catering_over_mains: 15 },
    menu,
    deals: sampleDeals(MENU, menu),
    money: { payment: 'either', pay_driver: 'cash_or_card', card_minimum_pence: null },
    // Dean Walsh (Call as) refused a delivery last month.
    after: { late_after_minutes: 15, missing_items: 'manager', pay_on_phone_numbers: ['07700 900804'] },
    nation: 'england',
    // Off, with a sample list ready for an owner who switches it on.
    alcohol: { on: false, until: '23:00', items: SAMPLE_ALCOHOL.map((i) => ({ ...i })) },
    policies: {
      halal: 'chicken',
      hygiene_rating: 5,
      parking: 'You can park in the bays out front for up to 20 minutes while you collect.',
      offers: '',
      bags: 'Your food comes in a paper bag, at no charge.',
      careers: "We're often looking for drivers and kitchen staff: ask for the manager in the shop.",
      tips: 'Tips for the drivers are welcome, and they keep all of them.',
      faqs: [],
    },
    theme: {
      accent: '#f2542d',
      primary: '#2b1a14',
      background: '#120c0a',
      font_heading: 'system-ui',
      font_body: 'system-ui',
      logo: null,
    },
    sources: {},
  };
}
