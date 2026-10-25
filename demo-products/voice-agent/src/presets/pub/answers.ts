// The pub builder's answers (presets/pub.md §2): everything a prospect
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

/** A weekly event: live music on Saturdays at 9. */
export interface RegularEvent {
  /** 0 = Sunday. */
  day: number;
  time: string;
  title: string;
  /** Where in the pub: "the bar". */
  place: string;
  free: boolean;
}

export interface PubAnswers extends BaseAnswers {
  version: typeof VERSION;
  basics: BasicsAnswer;
  hours: {
    /** Seven entries, 0 = Sunday. */
    days: DayHours[];
    closures: ClosureAnswer[];
    /** When the kitchen serves, on every open day; Sundays (roasts) may stop earlier. */
    food: { from: string; until: string; sunday_until: string | null };
  };
  seating: SeatingAnswer;
  booking: {
    /** A table is held this long for someone running late. */
    late_grace_minutes: number;
    /** The bar's tables aren't booked during a listed match (milestone 2). */
    no_bar_bookings_for_matches: boolean;
  };
  children: {
    /** Children (under 16) welcome with an adult until this time, HH:MM; null: any time. */
    until: string | null;
  };
  /** The quiz (milestone 2): a team booking at one weekly time. */
  quiz: { offered: boolean; day: number; time: string; team_max: number; entry_pence: number; minutes: number };
  /** Weekly events (milestone 2); fixtures are added in the back office. */
  events: RegularEvent[];
  drinks: {
    /** The ales on by default; "Today" changes them for the day (milestone 2). */
    on_tap: string[];
  };
  /** The shared ordering answer: off by default (Alex, 13 October). */
  ordering: OrderingAnswer;
  menu: MenuAnswer;
  money: {
    payment: OrderPayment;
    cash: boolean;
    tips: string;
  };
  policies: {
    children: string;
    baby_changing: boolean;
    accessibility: string;
    parking: string;
    smoking: string;
    vaping: string;
    /** What ID the pub takes, and its Challenge 25. */
    id: string;
    own_cake: string;
    own_drink: string;
    /** The local taxi firm. */
    taxi: string;
    /** The room upstairs: by enquiry. */
    hire: string;
    christmas: string;
    careers: string;
    /** The food hygiene rating, 0 to 5, or null if the manager doesn't say. */
    hygiene_rating: number | null;
    faqs: FaqAnswer[];
  };
  theme: ThemeAnswer;
  sources: Sources;
}

const day = (open: string, close: string): DayHours => ({ open: true, services: [{ label: 'Open', open, close }] });

export function defaultPubAreas(): AreaAnswer[] {
  return [
    { key: 'bar', label: 'Bar', kind: 'bar', reservable: true, enquiry_only: false, weather_rule: null },
    { key: 'dining', label: 'Dining room', kind: 'indoor', reservable: true, enquiry_only: false, weather_rule: null },
    // First come, whatever the weather; smoking allowed.
    { key: 'garden', label: 'Beer garden', kind: 'outdoor', reservable: false, enquiry_only: false, weather_rule: 'walk_in_only' },
    // The room upstairs, for up to 40: a message for the manager.
    { key: 'loft', label: 'The Loft', kind: 'private', reservable: false, enquiry_only: true, weather_rule: null },
  ];
}

export function defaultPubTables(areas = defaultPubAreas()): TableAnswer[] {
  const tables = tablesFromCounts(areas, {
    bar: { 2: 2, 4: 3, 6: 0, 8: 0 },
    dining: { 2: 4, 4: 5, 6: 2, 8: 0 },
    garden: { 2: 0, 4: 6, 6: 0, 8: 0 },
    loft: { 2: 0, 4: 0, 6: 0, 8: 2 },
  });
  const t = (k: string) => tables.find((x) => x.key === k)!;
  // In the bar, the two high tables for two are first come; the three booths for four can be booked.
  for (const k of ['T1', 'T2']) { t(k).walk_in = true; t(k).features.push('high_table'); }
  for (const k of ['T3', 'T4', 'T5']) t(k).features.push('booth');
  // The dining room's two tables for six join to make eight or more; two step-free tables; a window table.
  t('T15').joins.push('T16');
  t('T16').joins.push('T15');
  t('T10').accessible = true;
  t('T15').accessible = true;
  t('T6').features.push('window');
  return tables;
}

export function defaultAnswers(): PubAnswers {
  const areas = defaultPubAreas();
  const tables = defaultPubTables(areas);
  return {
    version: VERSION,
    basics: {
      name: '',
      style: 'Cask ales, pub classics and Sunday roasts',
      town: 'Nottingham',
      address: '9 Lace Row (example), Nottingham NG1',
      phone_display: '0115 496 0823',
      website: '',
      voice: 'Charon',
      greeting: '',
    },
    hours: {
      // Sunday 12 to 10:30; Monday to Thursday 12 to 11; Friday and Saturday 12 to midnight.
      days: [day('12:00', '22:30'), day('12:00', '23:00'), day('12:00', '23:00'), day('12:00', '23:00'), day('12:00', '23:00'), day('12:00', '24:00'), day('12:00', '24:00')],
      closures: [],
      food: { from: '12:00', until: '21:00', sunday_until: '18:00' },
    },
    seating: {
      areas,
      tables,
      fixtures: defaultFixtures(tables),
      plan: 2,
      // Two hours a table, ninety minutes for two.
      sittings: { up_to_2: 90, up_to_4: 120, up_to_8: 120, larger: 150 },
      max_party: 8,
      notice_minutes: 60,
      horizon_days: 60,
      highchairs: 4,
      buffer_minutes: 0,
    },
    booking: {
      late_grace_minutes: 15,
      no_bar_bookings_for_matches: true,
    },
    children: { until: '21:00' },
    quiz: { offered: true, day: 4, time: '20:00', team_max: 6, entry_pence: 200, minutes: 150 },
    events: [{ day: 6, time: '21:00', title: 'Live music', place: 'the bar', free: true }],
    drinks: { on_tap: ['Lace Market Bitter (example)', 'Trent Pale (example)', 'Weaver’s Gold (example)', 'Castle Rock Stout (example)'] },
    ordering: {
      collection: { enabled: false, prep_minutes: 20, slot_minutes: 10, per_slot: 3 },
      delivery: { enabled: false, districts: [], fee_pence: 0, min_order_pence: 0, extra_minutes: 0 },
      delivery_apps: [],
      timed_orders: true,
    },
    menu: sampleMenu('menus/weavers-arms.json'),
    money: {
      payment: 'collection',
      cash: true,
      tips: 'Tips are never expected; any paid by card go to the team in full.',
    },
    policies: {
      children: 'Children are welcome with an adult until 9pm: there’s a children’s menu and colouring.',
      baby_changing: true,
      accessibility: 'Step-free into the bar and the dining room, with an accessible toilet. The Loft is up a flight of stairs.',
      parking: 'No parking of our own; the nearest car park is about five minutes’ walk.',
      smoking: 'Smoking in the beer garden only.',
      vaping: 'Vaping in the beer garden only, please.',
      id: 'We run Challenge 25: anyone who looks under 25 is asked for ID. A passport, a photo driving licence, a PASS card or a certified digital ID app.',
      own_cake: 'You’re welcome to bring a birthday cake.',
      own_drink: 'No drinks of your own, I’m afraid.',
      taxi: 'Lace City Cars (example) on 0115 496 0999.',
      hire: 'The Loft upstairs takes up to 40, for parties, wakes and work dos: the manager will call back to talk it through.',
      christmas: 'Our Christmas menu is served from late November: the manager will call back to arrange a party.',
      careers: 'We’re often looking for bar and kitchen staff: leave your name and number and the manager will be in touch.',
      hygiene_rating: 5,
      faqs: [],
    },
    theme: {
      accent: '#8a3b2e',
      primary: '#1f1a17',
      background: '#f4efe6',
      font_heading: 'system-ui',
      font_body: 'system-ui',
      logo: null,
    },
    sources: {},
  };
}
