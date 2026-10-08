// The barber builder's answers (presets/barber.md §2): everything a prospect
// sets, with defaults good enough that "Next, Next, Next" makes a convincing
// demo of a busy city-centre shop. Compiled into a TenantProfile by
// compile.ts; the receptionist never reads these directly.

import type { BaseAnswers, BasicsAnswer, DayHours, FaqAnswer, HoursAnswer, Sources, ThemeAnswer } from '../common/types.ts';

/** The shape of the answers today. Raise it with a migrate step (PRESETS.md §1, rule 2), so saved setups keep loading. */
export const VERSION = 1;

export const PAYMENT = ['phone', 'shop', 'either'] as const;
export const SKIN_TEST = ['every_time', 'six_months'] as const;

/** A barber: who they are to callers, when they're in, and what they do. */
export interface BarberAnswer {
  key: string;
  name: string;
  /** What callers call them: "Marc". */
  aliases: string[];
  /** 0 = Sunday … 6 = Saturday: the days they work. */
  days: number[];
  /** Their own hours, where they differ from the shop's: a later start, an early finish. Empty: the shop's. */
  hours: { day: number; open: string; close: string }[];
  /** Service keys they do. */
  services: string[];
  /** What callers may hear: "Afro and textured hair, designs". */
  notes: string;
}

/** A service on the price list. */
export interface ServiceAnswer {
  key: string;
  name: string;
  minutes: number;
  price_pence: number;
  /** "From £25": the price can be more, said as "from". */
  from: boolean;
  description: string;
  /** Hair or beard colour: needs the skin test 48 hours before (milestone 2). */
  colour: boolean;
}

export interface BarberAnswers extends BaseAnswers {
  version: typeof VERSION;
  basics: BasicsAnswer;
  hours: HoursAnswer;
  team: BarberAnswer[];
  services: ServiceAnswer[];
  booking: {
    slot_minutes: number;
    /** The soonest a phone booking can start, from now. */
    lead_minutes: number;
    horizon_days: number;
    /** Walk-ins welcome when a chair is free. */
    walk_ins: boolean;
    /** More people than this in one booking call is a message for the owner. */
    group_max: number;
    /** This late and the booking still stands. */
    late_grace_minutes: number;
    /** The kids' price is for under this age; null: no kids' price. */
    kids_under: number | null;
    /** A policy, not law: under-16s come with an adult. */
    under_16_with_adult: boolean;
  };
  money: {
    /** Taken when booking and off the price; null: none. */
    deposit_pence: number | null;
    /** False: a caller who'd rather pay in the shop keeps the booking. */
    deposit_required: boolean;
    /** Free to cancel or move with this much notice; later, the deposit is kept. */
    notice_hours: number;
    payment: (typeof PAYMENT)[number];
  };
  policies: {
    /** Before colour: every time, as the dye's instructions say, or every six months. */
    skin_test: (typeof SKIN_TEST)[number];
    /** A free tidy-up within this many days if they're unhappy; null: a message for the owner. */
    fix_days: number | null;
    access: string;
    parking: string;
    products: string;
    tips: string;
    careers: string;
    home_visits: string;
    faqs: FaqAnswer[];
  };
  theme: ThemeAnswer;
  sources: Sources;
}

const day = (open: string, close: string): DayHours => ({ open: true, services: [{ label: 'Open', open, close }] });
const closed: DayHours = { open: false, services: [] };

/** The price list Kingsley's starts from: invented prices, the owner's to change. */
export const SAMPLE_SERVICES: ServiceAnswer[] = [
  { key: 'classic_cut', name: 'Classic cut', minutes: 30, price_pence: 1800, from: false, description: 'Scissors and clippers, finished with a neck shave.', colour: false },
  { key: 'skin_fade', name: 'Skin fade', minutes: 45, price_pence: 2200, from: false, description: 'Faded down to the skin at the back and sides, blended into the length on top.', colour: false },
  { key: 'cut_and_beard', name: 'Cut and beard', minutes: 50, price_pence: 2800, from: false, description: 'Any cut, with the beard shaped and lined up.', colour: false },
  { key: 'beard_trim', name: 'Beard trim', minutes: 20, price_pence: 1200, from: false, description: 'Shaped, lined up and finished with oil.', colour: false },
  { key: 'hot_towel_shave', name: 'Hot towel shave', minutes: 30, price_pence: 2000, from: false, description: 'A traditional straight-razor shave with hot towels.', colour: false },
  { key: 'kids_cut', name: "Kids' cut", minutes: 30, price_pence: 1300, from: false, description: 'For under-12s.', colour: false },
  { key: 'grey_blending', name: 'Grey blending', minutes: 45, price_pence: 2500, from: true, description: 'Softens the grey without a flat colour; needs a skin test first.', colour: true },
  { key: 'beard_colour', name: 'Beard colour', minutes: 30, price_pence: 1500, from: false, description: 'Colour for the beard; needs a skin test first.', colour: true },
];

const ALL = SAMPLE_SERVICES.map((s) => s.key);

export function defaultAnswers(): BarberAnswers {
  return {
    version: VERSION,
    basics: {
      name: '',
      style: 'Fades, classic cuts, beards and hot towel shaves',
      town: 'Nottingham',
      address: '22 Hockley Row (example), Nottingham NG1',
      phone_display: '0115 496 0789',
      website: '',
      voice: 'Charon',
      greeting: '',
    },
    // Closed Monday; Tuesday to Friday 9 till 6, Thursday till 8; Saturday 8 till 5; Sunday 10 till 3.
    hours: {
      days: [day('10:00', '15:00'), closed, day('09:00', '18:00'), day('09:00', '18:00'), day('09:00', '20:00'), day('09:00', '18:00'), day('08:00', '17:00')],
      closures: [],
    },
    team: [
      { key: 'marcus', name: 'Marcus', aliases: ['Marc'], days: [0, 2, 3, 4, 5, 6], hours: [], services: ALL, notes: 'The owner: skin fades, Afro and textured hair, designs.' },
      { key: 'dan', name: 'Dan', aliases: ['Danny'], days: [2, 3, 4, 5, 6], hours: [], services: ['classic_cut', 'skin_fade', 'cut_and_beard', 'beard_trim', 'hot_towel_shave', 'kids_cut'], notes: 'Classic cuts, beards and hot towel shaves.' },
      { key: 'jordan', name: 'Jordan', aliases: [], days: [2, 3, 4, 5, 6], hours: [{ day: 4, open: '09:00', close: '18:00' }], services: ['classic_cut', 'skin_fade', 'kids_cut'], notes: 'Cuts and kids.' },
      { key: 'amira', name: 'Amira', aliases: [], days: [5, 6], hours: [], services: ['classic_cut', 'skin_fade', 'grey_blending', 'beard_colour'], notes: 'Cuts, grey blending and beard colour.' },
    ],
    services: SAMPLE_SERVICES.map((s) => ({ ...s })),
    booking: { slot_minutes: 15, lead_minutes: 30, horizon_days: 28, walk_ins: true, group_max: 4, late_grace_minutes: 10, kids_under: 12, under_16_with_adult: true },
    money: { deposit_pence: 500, deposit_required: false, notice_hours: 24, payment: 'either' },
    policies: {
      skin_test: 'every_time',
      fix_days: 7,
      access: 'Step-free from the street, with room for a wheelchair at every chair. Ask for a quiet time and we will book one.',
      parking: "There's no parking at the shop: the Lace Market and Victoria Centre car parks are a few minutes' walk.",
      products: 'We sell the wax, clay, oils and beard balm we use in the shop.',
      tips: 'Tips are welcome, and the barbers keep all of them.',
      careers: "We're always happy to hear from barbers and apprentices: drop your details in, or leave a message.",
      home_visits: "We don't do home visits.",
      faqs: [],
    },
    theme: {
      accent: '#c8963e',
      primary: '#1c1a17',
      background: '#0f0e0c',
      font_heading: 'system-ui',
      font_body: 'system-ui',
      logo: null,
    },
    sources: {},
  };
}
