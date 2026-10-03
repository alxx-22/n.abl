// The restaurant's baseline (PRESETS.md §0, step 1). Before any preset code
// moves, this records what today's restaurant does with a fixed corpus of
// answers, so the refactor can prove it changes nothing:
// test/restaurant-golden.test.ts recomputes every value here and compares it
// with the file.
//
//   node scripts/restaurant-goldens.ts            rewrite test/fixtures/restaurant/golden/
//   node scripts/restaurant-goldens.ts --corpus   rebuild the corpus inputs too
//
// The corpus inputs are written once and then left alone, so a change to
// defaults or to a cap shows up as a changed golden, not as a changed input.
// A golden changes only in a commit that names the change and says why.
//
// Values are compared in the form they are stored in (JSON, so dates become
// strings and undefined fields go). Object key order does not matter, because
// jsonb reorders keys; array order does, because it reaches the prompt.
// Prompts and the FAQ fact sheet are stored as lines, so a diff shows the
// line that changed.
//
// The draft requests, the every-issue and all-off inputs and the Friday 19:07
// seeds were added after the move (review findings); they were recorded by
// running this script on the code from before it (6bdd42f), which gives the
// same files.

import { existsSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultAnswers } from '../src/presets/restaurant/answers.ts';
import { compileRestaurant } from '../src/presets/restaurant/compile.ts';
import { sanitiseRestaurant, validateRestaurant } from '../src/presets/restaurant/validate.ts';
import { planRestaurantSeed } from '../src/presets/restaurant/seed.ts';
import { cleanBrief, draftFaqs, draftMenu, factSheet, menuFromDraft } from '../src/presets/restaurant/drafts.ts';
import { preview } from '../src/server/demo.ts';
import { compilePrompt, type PromptContext } from '../src/core/prompt.ts';
import { toolDeclarations } from '../src/core/tools.ts';
import { applyScan, scanView, type ScanPart } from '../src/scout/map.ts';
import type { ScanResult } from '../src/scout/scan.ts';
import { loadFixtures } from '../src/db/seed.ts';
import { DEFAULT_DEMO_CARDS } from '../src/domain/payments.ts';
import { BUILDER_TENANTS, builderTenant } from '../src/eval/scenarios.ts';
import { ALLERGENS, type TenantProfile } from '../src/domain/types.ts';
import type { Workspace } from '../src/db/demo-repo.ts';
import type { Config } from '../src/config.ts';
import { goldenFilesIn, lines, readJson, stored, withoutClock, write } from './goldens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'restaurant');
const CORPUS_DIR = join(ROOT, 'corpus');
export const GOLDEN_DIR = join(ROOT, 'golden');
const SCAN_FILE = join(ROOT, 'scan-result.json');
const REPLY_FILE = join(ROOT, 'menu-draft-reply.json');

// ── Fixed time and options ───────────────────────────────────────────────

// Start seeds a workspace from its id and the clock, and every call stamps
// the time into its prompt; the goldens pass these instead. Europe/London is
// on summer time until 25 October 2026, so they are UTC+1: Tuesday lunch,
// Friday evening, and a Sunday before opening. Those three fall on the
// 15-minute booking grid, so no booking ever starts a few minutes after now;
// Friday 19:07 does, which is the only time the seed marks a party as
// arrived, and that draw moves the dice for everything seeded after it.
const NOWS = {
  'tuesday-1230': new Date('2026-10-06T11:30:00Z'),
  'friday-1900': new Date('2026-10-09T18:00:00Z'),
  'friday-1907': new Date('2026-10-09T18:07:00Z'),
  'sunday-1000': new Date('2026-10-11T09:00:00Z'),
} as const;
const SEEDS = [1, 42, 9001] as const;
/**
 * The inputs whose seeded week is recorded: what a new workspace starts
 * with, and the one with bookings, walk-ins, collection and delivery all on.
 * Between them and the four nows, every visit status and both kinds of order
 * are seeded.
 */
const SEEDED = ['as-created', 'full'];

const PROMPTS: Record<string, PromptContext> = {
  phone: {
    now: NOWS['friday-1900'], callerPhone: '+447700900123', knownCustomer: { name: 'Sam Price' },
    demoCards: DEFAULT_DEMO_CARDS, canTransfer: true, channel: 'phone',
  },
  browser: { now: NOWS['friday-1900'], callerPhone: null, knownCustomer: null, demoCards: DEFAULT_DEMO_CARDS, canTransfer: false, channel: 'browser' },
};

const ALL_PARTS: Record<ScanPart, boolean> = { identity: true, hours: true, menu: true, theme: true, services: true, policies: true };

// The drafts never reach the model here: the request is caught as it leaves
// (see requestOf), so the model and key are placeholders that never appear
// in a golden.
const DRAFT_CONFIG = { textModel: 'text-model', keys: { text: 'golden-key' } } as unknown as Config;

/**
 * Menu briefs as the builder's Menu step sends them, between them reaching
 * every line of the draft prompt that can change: takeaway off and on, a
 * description or none, the owner's style, the restaurant's style or the
 * wording's own, each price band, and a dish count past its cap.
 */
const BRIEFS: Record<string, unknown> = {
  'budget-no-takeaway': {
    description: 'Fish and chips, battered sausages, mushy peas, homemade pies and a few puddings.',
    style: 'A seaside chippy with a sit-down room', price_level: 'budget', dishes: 12, takeaway: false,
  },
  'description-only': { description: 'Wood-fired Neapolitan pizza, about ten, fresh pasta, a few starters and two desserts.' },
  'style-only': { style: 'A Sunday roast pub with a carvery', price_level: 'mid', dishes: 6 },
  'high-no-style': { description: 'Seasonal tasting plates, local game and a cheese trolley.', style: '', price_level: 'high', dishes: 99, takeaway: true },
};

// ── The corpus ───────────────────────────────────────────────────────────

export const CORPUS = ['full', 'max', 'legacy', 'fallbacks', 'as-created', 'every-issue', 'all-off', 'empty', 'null', 'junk'] as const;

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/**
 * Every field set, valid and away from its default, except the switches that
 * keep whole branches running (bookings, walk-ins, collection); every kind of
 * area, fixture and dish detail at least once.
 */
function full(): unknown {
  const lunchDinner = () => ({ open: true, services: [{ label: 'Lunch', open: '12:00', close: '15:00' }, { label: 'Dinner', open: '18:00', close: '22:30' }] });
  const weekend = () => ({
    open: true,
    services: [{ label: 'Brunch', open: '09:30', close: '11:30' }, { label: 'Lunch', open: '12:00', close: '15:00' }, { label: 'Dinner', open: '17:00', close: '23:00' }],
  });
  const t = (key: string, area: string, seats: number, shape: string, x: number, y: number, more: Record<string, unknown> = {}) => ({
    key, label: `Table ${key}`, area, seats, shape, x, y, rotation: 0, accessible: false, walk_in: false, features: [], joins: [], ...more,
  });
  return {
    version: 1,
    basics: {
      name: 'The Copper Pot',
      style: 'Modern British small plates and Sunday roasts',
      town: 'Leeds',
      address: '14 Call Lane, Leeds LS1 6DT',
      phone_display: '0113 496 0456',
      website: 'https://www.copperpot.example',
      voice: 'Puck',
      greeting: "Good evening, you've reached The Copper Pot. I'm the AI assistant on this demo line; how can I help?",
    },
    hours: {
      days: [
        { open: true, services: [{ label: 'Roast', open: '12:00', close: '17:00' }] },
        { open: false, services: [] },
        lunchDinner(), lunchDinner(), lunchDinner(), weekend(), weekend(),
      ],
      last_booking_before_close: 45,
      // A Tuesday inside the seeded week, so the seed skips it.
      closures: [{ date: '2026-10-13', note: 'Private event' }, { date: '2026-12-25', note: 'Christmas Day' }],
    },
    serve: {
      reservations: true,
      walk_ins: true,
      collection: { enabled: true, prep_minutes: 25, slot_minutes: 10, per_slot: 6, evenings_only: false },
      delivery: { enabled: true, districts: ['LS1', 'LS2', 'LS6', 'LS11'], fee_pence: 300, min_order_pence: 2000, extra_minutes: 25 },
      delivery_apps: ['Deliveroo', 'Just Eat'],
    },
    seating: {
      areas: [
        { key: 'main', label: 'Main room', kind: 'indoor', reservable: true, enquiry_only: false, weather_rule: null },
        { key: 'courtyard', label: 'Courtyard', kind: 'outdoor', reservable: true, enquiry_only: false, weather_rule: 'own_risk' },
        { key: 'bar', label: 'Bar', kind: 'bar', reservable: false, enquiry_only: false, weather_rule: null },
        { key: 'snug', label: 'The Snug', kind: 'private', reservable: true, enquiry_only: true, weather_rule: null },
        { key: 'mezzanine', label: 'Mezzanine', kind: 'other', reservable: true, enquiry_only: false, weather_rule: null },
      ],
      tables: [
        t('M1', 'main', 2, 'round', 40, 40, { features: ['window'], joins: ['M2'] }),
        t('M2', 'main', 2, 'round', 130, 40, { features: ['window'], joins: ['M1'] }),
        t('M3', 'main', 4, 'square', 230, 40, { accessible: true }),
        t('M4', 'main', 4, 'square', 340, 40, { walk_in: true }),
        t('M5', 'main', 6, 'rect', 40, 160, { rotation: 90, features: ['booth'], joins: ['M6'] }),
        t('M6', 'main', 6, 'rect', 200, 160, { features: ['quiet'], joins: ['M5'] }),
        t('M7', 'main', 8, 'rect', 400, 160, { features: ['view', 'high_table'], joins: ['C4'] }),
        t('C1', 'courtyard', 2, 'round', 40, 40, { features: ['heated', 'covered'] }),
        t('C2', 'courtyard', 4, 'square', 140, 40, { features: ['dog_friendly'], joins: ['C3'] }),
        t('C3', 'courtyard', 4, 'square', 250, 40, { joins: ['C2'] }),
        t('C4', 'courtyard', 6, 'rect', 40, 150, { rotation: 180 }),
        t('B1', 'bar', 2, 'round', 40, 40, { features: ['high_table'] }),
        t('B2', 'bar', 2, 'round', 120, 40),
        t('S1', 'snug', 10, 'rect', 40, 40, { features: ['sofa'] }),
        t('Z1', 'mezzanine', 4, 'square', 40, 40, { accessible: true, joins: ['Z2'] }),
        t('Z2', 'mezzanine', 4, 'square', 150, 40, { joins: ['Z1'] }),
        t('Z3', 'mezzanine', 12, 'rect', 40, 160),
      ],
      fixtures: [
        { key: 'F1', area: 'main', kind: 'window', x: 30, y: 10, length: 200, rotation: 0 },
        { key: 'F2', area: 'main', kind: 'bar', x: 300, y: 300, length: 300, rotation: 0 },
        { key: 'F3', area: 'main', kind: 'door', x: 40, y: 330, length: 80, rotation: 90 },
        { key: 'F4', area: 'courtyard', kind: 'wall', x: 10, y: 10, length: 400, rotation: 180 },
        { key: 'F5', area: 'courtyard', kind: 'door', x: 420, y: 60, length: 90, rotation: 270 },
        { key: 'F6', area: 'bar', kind: 'bar', x: 40, y: 120, length: 260, rotation: 0 },
      ],
      plan: 2,
      sittings: { up_to_2: 90, up_to_4: 105, up_to_8: 135, larger: 180 },
      max_party: 14,
      notice_minutes: 60,
      horizon_days: 90,
      highchairs: 5,
      buffer_minutes: 15,
    },
    menu: {
      categories: [
        {
          key: 'small_plates', label: 'Small plates', items: [
            { key: 'whipped_feta', name: 'Whipped feta, honey and thyme', price_pence: 650, description: 'With warm flatbread', allergens: ['milk', 'gluten'], dietary: ['vegetarian'], aliases: ['feta'] },
            { key: 'crispy_squid', name: 'Crispy squid', price_pence: 850, allergens: ['molluscs', 'gluten', 'eggs'], may_contain: ['crustaceans'], modifier_groups: ['dips'] },
            { key: 'sourdough', name: 'Sourdough and cultured butter', price_pence: 450, allergens: ['gluten', 'milk'], available: false },
          ],
        },
        {
          key: 'mains', label: 'Mains', items: [
            { key: 'roast_beef', name: 'Roast sirloin of beef', price_pence: 2200, description: 'Yorkshire pudding, roast potatoes, gravy', allergens: ['gluten', 'eggs', 'milk', 'celery', 'sulphites'], modifier_groups: ['sides'] },
            { key: 'nut_roast', name: 'Chestnut and mushroom roast', price_pence: 1600, allergens: ['nuts', 'celery'], dietary: ['vegan'], modifier_groups: ['sides'] },
            { key: 'fish_pie', name: 'Smoked haddock fish pie', price_pence: 1750, allergens: [], allergens_unknown: true },
          ],
        },
        {
          key: 'puddings', label: 'Puddings', items: [
            { key: 'sticky_toffee', name: 'Sticky toffee pudding', price_pence: 750, allergens: ['gluten', 'eggs', 'milk'], aliases: ['STP', 'toffee pudding'] },
            { key: 'sorbet', name: 'Blood orange sorbet', price_pence: 600, allergens: [], dietary: ['vegan', 'gluten-free'] },
          ],
        },
      ],
      modifier_groups: {
        dips: { label: 'Dips', min: 0, max: 2, options: [
          { key: 'aioli', name: 'Aioli', price_pence: 100, allergens: ['eggs', 'mustard'] },
          { key: 'chilli_jam', name: 'Chilli jam', price_pence: 100, allergens: [] },
        ] },
        sides: { label: 'Extra sides', min: 0, max: 3, options: [
          { key: 'cauliflower_cheese', name: 'Cauliflower cheese', price_pence: 400, allergens: ['milk', 'mustard'] },
          { key: 'yorkshire', name: 'Extra Yorkshire pudding', price_pence: 200, allergens: ['gluten', 'eggs', 'milk'] },
        ] },
      },
      allergen_statement: 'We handle all 14 major allergens in one small kitchen. Tell us about any allergy when you book or order.',
      source: 'manual',
      allergens_are_examples: false,
    },
    money: {
      deposit: { mode: 'per_booking', amount_pence: 2500, min_party: 8 },
      cancellation_policy: 'Cancel up to 24 hours before for a full refund of your deposit.',
      takeaway_payment: 'phone',
      service_charge: 'A 10% service charge is added to every bill.',
    },
    policies: {
      children: 'Children are welcome until 8pm.',
      dogs: 'inside',
      accessibility: 'Level access, with a ramp at the side door and an accessible toilet.',
      parking: 'Pay and display on Swinegate, two minutes away.',
      dress_code: 'Smart casual.',
      corkage: 'Corkage is £15 a bottle, wine only.',
      cakes: 'Bring a cake and we will serve it with candles for £2 a head.',
      vouchers: 'Vouchers are sold online and at the bar.',
      dietary: 'Most dishes can be made gluten-free; tell us when you book.',
      faqs: [
        { q: 'Do you have a private room?', a: 'Yes, The Snug seats ten; ask us about it.' },
        { q: 'Is there live music?', a: 'A jazz trio plays on Thursday evenings.' },
        { q: 'Can I book the courtyard?', a: 'Yes, though we cannot promise a table inside if it rains.' },
      ],
    },
    theme: { accent: '#2f6f4e', primary: '#1b1b1b', background: '#faf7f2', font_heading: 'Playfair Display', font_body: 'Source Sans 3', logo: PNG },
    sources: { 'basics.name': 'website', 'basics.style': 'guess', 'hours.days': 'website', 'menu.categories': 'website', 'theme.accent': 'website' },
  };
}

/** Exactly n characters of words: no space at either end, since the sanitiser trims. */
function text(n: number, tag: string): string {
  let s = `${tag} `;
  while (s.length < n) s += 'lorem ipsum dolor sit amet ';
  return s.slice(0, n).replace(/\s$/, 'x');
}
/** A key of exactly n characters that the sanitiser keeps as it is. */
const longKey = (tag: string, n = 40) => `${tag}_`.padEnd(n, 'k');

/** Every list at its cap and every string at its longest, per validate.ts. */
function max(): unknown {
  const kinds = ['indoor', 'outdoor', 'bar', 'private', 'other', 'indoor', 'outdoor', 'indoor'];
  const areas = kinds.map((kind, i) => ({
    key: longKey(`area${i + 1}`), label: text(30, `Area ${i + 1}`), kind, reservable: true,
    enquiry_only: kind === 'private', weather_rule: kind === 'outdoor' ? (i === 1 ? 'own_risk' : 'walk_in_only') : null,
  }));
  const tableKey = (i: number) => `T${String(i + 1).padStart(7, '0')}`;
  const tables = Array.from({ length: 80 }, (_, i) => {
    const area = Math.floor(i / 10);
    const n = i % 10;
    return {
      key: tableKey(i), label: text(30, `Table ${i + 1}`), area: areas[area].key, seats: 20, shape: 'rect',
      x: 2000 - n * 150, y: 4000 - n * 300, rotation: 359, accessible: i % 2 === 0, walk_in: i % 10 === 9,
      features: ['window', 'booth', 'quiet', 'heated', 'covered', 'dog_friendly', 'high_table', 'sofa', 'view'],
      joins: [1, 2, 3, 4].map((d) => tableKey(area * 10 + ((n + d) % 10))),
    };
  });
  const fixtureKinds = ['bar', 'door', 'window', 'wall'] as const;
  const longest = { bar: 700, door: 140, window: 600, wall: 1000 };
  const fixtures = Array.from({ length: 60 }, (_, i) => {
    const kind = fixtureKinds[i % 4];
    return { key: `F${String(i + 1).padStart(7, '0')}`, area: areas[i % 8].key, kind, x: 2000, y: 4000, length: longest[kind], rotation: 270 };
  });
  const groups = Object.fromEntries(Array.from({ length: 30 }, (_, g) => [longKey(`group${g + 1}`), {
    label: text(40, `Group ${g + 1}`), min: 5, max: 10,
    options: Array.from({ length: 20 }, (_, o) => ({ key: longKey(`g${g + 1}opt${o + 1}`), name: text(50, `Option ${o + 1}`), price_pence: 100000, allergens: [...ALLERGENS] })),
  }]));
  const groupKeys = Object.keys(groups);
  const categories = Array.from({ length: 20 }, (_, c) => ({
    key: longKey(`cat${c + 1}`), label: text(40, `Section ${c + 1}`),
    items: Array.from({ length: 60 }, (_, i) => ({
      key: longKey(`c${c + 1}item${i + 1}`), name: text(60, `Dish ${c + 1}.${i + 1}`), price_pence: 100000,
      description: text(200, 'Described'), allergens: [...ALLERGENS], allergens_unknown: true, may_contain: [...ALLERGENS],
      dietary: [1, 2, 3, 4, 5].map((d) => text(20, `Diet${d}`)), aliases: [1, 2, 3, 4, 5].map((d) => text(40, `Alias${d}`)),
      modifier_groups: [groupKeys[(c + i) % 30], groupKeys[(c + i + 1) % 30]], available: i % 2 === 0 ? false : undefined,
    })),
  }));
  const service = (open: string, close: string, n: number) => ({ label: text(30, `Service ${n}`), open, close });
  return {
    version: 1,
    basics: {
      name: text(60, 'Name'), style: text(160, 'Style'), town: text(60, 'Town'), address: text(160, 'Address'),
      phone_display: '0115 496 0123 ext 99', website: `https://www.${'w'.repeat(170)}.example/menu`.padEnd(200, 'x'),
      voice: 'Zubenelgenubi', greeting: text(300, "Hello, I'm the AI assistant on this demo line."),
    },
    hours: {
      days: Array.from({ length: 7 }, () => ({ open: true, services: [service('06:00', '09:00', 1), service('10:00', '15:00', 2), service('16:00', '23:45', 3)] })),
      last_booking_before_close: 240,
      closures: Array.from({ length: 30 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, note: text(60, `Closed ${i + 1}`) })),
    },
    serve: {
      reservations: true, walk_ins: true,
      collection: { enabled: true, prep_minutes: 120, slot_minutes: 30, per_slot: 50, evenings_only: true },
      delivery: { enabled: true, districts: Array.from({ length: 30 }, (_, i) => `NG${10 + i}`), fee_pence: 2000, min_order_pence: 10000, extra_minutes: 120 },
      delivery_apps: [1, 2, 3, 4, 5].map((i) => text(20, `App${i}`)),
    },
    seating: {
      areas, tables, fixtures, plan: 2,
      sittings: { up_to_2: 300, up_to_4: 300, up_to_8: 360, larger: 480 },
      max_party: 60, notice_minutes: 1440, horizon_days: 365, highchairs: 30, buffer_minutes: 60,
    },
    menu: { categories, modifier_groups: groups, allergen_statement: text(600, 'Allergens'), source: 'draft', allergens_are_examples: true },
    money: {
      deposit: { mode: 'per_person', amount_pence: 50000, min_party: 60 },
      cancellation_policy: text(300, 'Cancel'), takeaway_payment: 'either', service_charge: text(200, 'Service'),
    },
    policies: {
      children: text(200, 'Children'), dogs: 'no', accessibility: text(300, 'Access'), parking: text(300, 'Parking'),
      dress_code: text(200, 'Dress'), corkage: text(200, 'Corkage'), cakes: text(200, 'Cakes'), vouchers: text(200, 'Vouchers'),
      dietary: text(300, 'Dietary'),
      faqs: Array.from({ length: 20 }, (_, i) => ({ q: text(150, `Question ${i + 1}`), a: text(500, `Answer ${i + 1}`) })),
    },
    theme: {
      accent: '#abcdef', primary: '#123456', background: '#fedcba',
      font_heading: text(60, 'Heading'), font_body: text(60, 'Body'),
      logo: `data:image/png;base64,`.padEnd(399_999, 'A'),
    },
    sources: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`s${i + 1}.`.padEnd(60, 'a'), i % 2 ? 'guess' : 'website'])),
  };
}

/** Answers saved before plan 2, fixtures, delivery extra minutes, checked allergens, walk-in tables and sources existed. */
function legacy(): unknown {
  const a = defaultAnswers() as any;
  a.basics.name = 'Trattoria Vecchia';
  a.basics.website = 'https://vecchia.example';
  a.serve.delivery.enabled = true;
  a.serve.delivery.districts = ['NG1', 'NG2'];
  delete a.serve.delivery.extra_minutes;
  // One canvas for every area: the terrace drawn in a band below the inside.
  for (const t of a.seating.tables) {
    if (t.area === 'terrace') {
      t.x += 30;
      t.y += 420;
    }
    delete t.walk_in;
  }
  a.seating.plan = 1;
  delete a.seating.fixtures;
  a.menu.source = 'draft';
  delete a.menu.allergens_are_examples;
  a.money.deposit.mode = 'card_hold';
  a.money.takeaway_payment = 'collection';
  delete a.sources;
  return a;
}

/** Empty and invalid values everywhere a default or a bound applies. */
function fallbacks(): unknown {
  return {
    version: 7,
    basics: { name: '   ', style: '', town: 42, address: null, phone_display: ['x'], website: '  https://padded.example  ', voice: 'Nobody', greeting: '' },
    hours: {
      days: [
        { open: true, services: [{ label: '', open: '9am', close: '25:00' }] },
        { open: 'yes', services: [{ open: '12:00', close: '14:00' }, { label: null, open: '18:00', close: '22:00' }] },
        { open: true, services: [] },
        { open: false },
        {},
        { open: true, services: 'all day' },
        null,
      ],
      last_booking_before_close: 'soon',
      closures: [{ date: '2026-13-45', note: 'Matches the pattern only' }, { date: 'next tuesday', note: 'Not a date' }, { note: 'No date' }, { date: '2026-11-05', note: 42 }],
    },
    serve: {
      reservations: 'true', walk_ins: 0,
      collection: { enabled: null, prep_minutes: 2, slot_minutes: 7, per_slot: -3, evenings_only: 'no' },
      delivery: { enabled: true, districts: ['ng1', 'NG 7', 'Nottingham', 'W1A', 12, 'SW1A1'], fee_pence: 99999, min_order_pence: '12.5', extra_minutes: null },
      delivery_apps: ['Deliveroo', 7, 'A name far longer than twenty characters'],
    },
    seating: {
      plan: 2,
      areas: [
        { key: 'Inside Room!', label: '', kind: 'rooftop', reservable: 'no', enquiry_only: 1 },
        { key: 'inside_room', label: 'Duplicate' },
        { label: 'Garden', kind: 'outdoor', weather_rule: 'pray' },
        { key: '!!!', kind: 'bar', weather_rule: 'own_risk' },
      ],
      tables: [
        { key: 'T1', label: '', area: 'inside_room', seats: 0, shape: 'hexagon', x: -5, y: 99999, rotation: 720, accessible: 'yes', walk_in: 1, features: ['window', 'disco', 7], joins: ['T1', 'T9', 'T2', 5] },
        { key: 'Table two', area: 'nowhere', seats: '6', joins: [] },
        { key: 'T2', seats: 4 },
        null,
        { key: 'T5', label: 'Garden table', area: 'area_3', seats: 99, shape: 'square', joins: ['T4', 'T4'] },
      ],
      fixtures: [
        { key: 'F1', area: 'inside_room', kind: 'pillar', length: 5, rotation: 100, x: 'a' },
        { key: 'F1', area: 'inside_room', kind: 'door' },
        { area: 'nowhere', kind: 'bar' },
        { key: 'bad key!', area: 'area_3', kind: 'window', length: 99999, rotation: -90 },
      ],
      sittings: { up_to_2: 5, up_to_4: 'long', up_to_8: 1000, larger: null },
      max_party: 0, notice_minutes: -1, horizon_days: 0, highchairs: 2.6, buffer_minutes: 61,
    },
    menu: {
      categories: [
        {
          label: '', items: [
            { name: '', price_pence: -100, allergens: ['gluten', 'gluten', 'peanut', 'Milk'], may_contain: [], dietary: [7, 'vegan'], modifier_groups: ['missing', 'big_extras'], aliases: [], available: 'no' },
            { key: 'dup', name: 'Dup' },
            { key: 'dup', name: 'Dup again', description: '   ' },
          ],
        },
        { key: '***', items: 'none' },
      ],
      modifier_groups: { 'Big Extras!': { label: 7, min: -1, max: 0, options: [{ name: 'Cheese', price_pence: 'free' }, null] }, '': { label: 'Empty key', options: 'none' } },
      allergen_statement: '   ',
      source: 'ai',
      allergens_are_examples: 'no',
    },
    money: { deposit: { mode: 'always', amount_pence: -5, min_party: 0 }, cancellation_policy: 5, takeaway_payment: 'cash', service_charge: '' },
    policies: {
      children: '', dogs: 'sometimes', accessibility: '   ', parking: null, dress_code: '', corkage: '', cakes: '', vouchers: '', dietary: '',
      faqs: [{ q: '', a: 'No question' }, { q: 'No answer?', a: '' }, null, { q: '  Spaced?  ', a: '  Yes.  ' }],
    },
    theme: { accent: 'red', primary: '#12345', background: '#GGGGGG', font_heading: '"@#$%', font_body: '!!!', logo: 'https://elsewhere.example/logo.png' },
    sources: { 'basics.name': 'website', 'Bad Key': 'website', 'basics.town': 'maybe', 'hours.days': 'guess' },
  };
}

/** What POST /workspaces stores before sanitising (src/server/demo.ts): the defaults, a name and a website. */
function asCreated(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'Olive & Ember'.trim().slice(0, 60);
  a.basics.website = 'https://www.oliveandember.example'.trim().slice(0, 200);
  return a;
}

/**
 * Something wrong on every step at once, so the golden records the messages
 * no other input reaches (the greeting, a service that closes before it
 * opens, delivery with no districts) and the order the steps report in:
 * basics, hours, seating, floor plan, menu, takeaway, money.
 */
function everyIssue(): unknown {
  const a = defaultAnswers() as any;
  a.basics.name = '';
  a.basics.greeting = 'Hello, thanks for calling. How can I help?';
  a.hours.days[2] = { open: true, services: [{ label: 'Lunch', open: '12:00', close: '15:00' }, { label: 'Dinner', open: '22:00', close: '18:00' }] };
  a.seating.max_party = 1;
  const [first, second] = a.seating.tables;
  Object.assign(second, { area: first.area, x: first.x + 10, y: first.y + 10 });
  delete a.menu.categories[0].items[0].price_pence;
  a.serve.collection.enabled = true;
  a.serve.delivery.enabled = true;
  a.serve.delivery.districts = ['Nottingham', 'NG 1 2AB', 'city centre'];
  a.money.deposit = { mode: 'per_person', amount_pence: 0, min_party: 6 };
  return a;
}

/** No bookings and no takeaway: the receptionist only answers questions. */
function allOff(): unknown {
  const a = defaultAnswers() as any;
  a.basics.name = 'The Quiet Room';
  a.serve.reservations = false;
  a.serve.collection.enabled = false;
  a.serve.delivery.enabled = false;
  return a;
}

function junk(): unknown {
  return {
    version: 'one', basics: 'Pizza Palace', hours: [1, 2, 3], serve: 42,
    seating: { areas: { indoor: true }, tables: 'many', fixtures: 7, plan: '1', sittings: [], max_party: {} },
    menu: ['pizza'], money: true, policies: { faqs: { q: 'a' }, dogs: ['inside'] }, theme: 'dark', sources: 'website',
    extra: { nested: [null, { deep: true }] },
  };
}

function buildCorpus(): Record<(typeof CORPUS)[number], unknown> {
  return {
    full: full(), max: max(), legacy: legacy(), fallbacks: fallbacks(), 'as-created': asCreated(),
    'every-issue': everyIssue(), 'all-off': allOff(), empty: {}, null: null, junk: junk(),
  };
}

// ── Reading and writing ──────────────────────────────────────────────────

export { readJson };

export function readCorpus(): Record<string, unknown> {
  return Object.fromEntries(CORPUS.map((name) => [name, readJson(join(CORPUS_DIR, `${name}.json`))]));
}

/** Every golden file under golden/, by path relative to it. */
export const goldenFiles = (): string[] => goldenFilesIn(GOLDEN_DIR);

// ── The goldens ──────────────────────────────────────────────────────────

const tenantOf = (profile: TenantProfile) => ({ id: 'golden', slug: profile.slug, profile });
const prompts = (profile: TenantProfile) => Object.fromEntries(Object.entries(PROMPTS).map(([k, ctx]) => [k, lines(compilePrompt(profile, ctx))]));
const tools = (profile: TenantProfile) => toolDeclarations(tenantOf(profile)).map((d) => d.name);
const RESTAURANT = { preset: 'restaurant' } as Workspace;

/**
 * The request a draft sends the text model, caught as it is sent: every
 * draft builds its prompt and calls fetch before its first await, so this is
 * synchronous. The reply never comes, so nothing after it runs. Prompt text
 * is stored as lines; the model and key are in the URL and headers, which
 * are left out.
 */
function requestOf(send: () => Promise<unknown>): unknown {
  const real = globalThis.fetch;
  let body: any = null;
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Promise<Response>(() => {});
  }) as typeof fetch;
  try {
    send().catch(() => {});
  } finally {
    globalThis.fetch = real;
  }
  if (!body) throw new Error('The draft did not ask the model before its first await: requestOf cannot catch it.');
  return { ...body, contents: body.contents.map((c: any) => ({ ...c, parts: c.parts.map((p: any) => ({ ...p, text: lines(p.text) })) })) };
}

/** Every golden, by its path under golden/, in stored form. */
export function computeGoldens(corpus = readCorpus(), scan = readJson(SCAN_FILE) as ScanResult, reply = readJson(REPLY_FILE)): Map<string, unknown> {
  return withoutClock(() => {
    const out = new Map<string, unknown>();
    const put = (path: string, value: unknown) => out.set(path, stored(value));

    put('defaults.json', defaultAnswers());

    for (const [name, input] of Object.entries(corpus)) {
      // Each step gets its own copy, as each request does: nothing here may lean on another's mutation.
      const a = sanitiseRestaurant(structuredClone(input));
      const profile = compileRestaurant(structuredClone(a), { slug: 'golden' });
      put(`${name}/sanitised.json`, a);
      put(`${name}/issues.json`, validateRestaurant(structuredClone(a)));
      put(`${name}/profile.json`, profile);
      put(`${name}/preview.json`, preview(RESTAURANT, structuredClone(profile), structuredClone(a)));
      put(`${name}/fact-sheet.json`, lines(factSheet(structuredClone(a))));
      put(`${name}/prompt.json`, prompts(profile));
      put(`${name}/tools.json`, tools(profile));
      if (SEEDED.includes(name)) {
        for (const [when, now] of Object.entries(NOWS)) {
          for (const seed of SEEDS) put(`${name}/seed/${when}-seed-${seed}.json`, planRestaurantSeed(structuredClone(profile), now, seed));
        }
      }
    }

    // The scout's findings into a new workspace, every part ticked, as POST .../scout/apply does.
    const created = sanitiseRestaurant(structuredClone(corpus['as-created']));
    const applied = applyScan(created, structuredClone(scan), ALL_PARTS);
    put('scan/applied.json', applied);
    put('scan/applied-sanitised.json', sanitiseRestaurant(structuredClone(applied)));
    put('scan/view.json', scanView({ id: 'golden', status: 'done', result: structuredClone(scan), error: null }, null));

    put('menu-draft/menu.json', menuFromDraft(structuredClone(reply) as Parameters<typeof menuFromDraft>[0]));

    // What the two drafts ask the model. The restaurant's wording is put
    // together by shared code that fills in the kind of business, so this is
    // where a later preset could change it unseen. The brief is cleaned with
    // the new workspace's style, as POST .../menu-draft does.
    const style = created.basics.style;
    for (const [name, brief] of Object.entries(BRIEFS)) {
      put(`drafts/menu-${name}.json`, requestOf(() => draftMenu(cleanBrief(structuredClone(brief), style), DRAFT_CONFIG)));
    }
    for (const name of ['as-created', 'full']) {
      put(`drafts/faq-${name}.json`, requestOf(() => draftFaqs(sanitiseRestaurant(structuredClone(corpus[name])), DRAFT_CONFIG)));
    }

    // The fixture tenants as they are loaded, and the eval's builder tenants as the eval makes them (BUILDER_TENANTS, through the preset registry).
    for (const p of loadFixtures().filter((f) => f.slug === 'lucas-trattoria' || f.slug === 'copper-kettle')) {
      put(`tenants/${p.slug}/prompt.json`, prompts(p));
      put(`tenants/${p.slug}/tools.json`, tools(p));
    }
    for (const b of BUILDER_TENANTS.filter((x) => x.preset === 'restaurant')) {
      const p = builderTenant(b).profile;
      put(`tenants/${b.slug}/profile.json`, p);
      put(`tenants/${b.slug}/prompt.json`, prompts(p));
      put(`tenants/${b.slug}/tools.json`, tools(p));
    }
    return out;
  }, { name: 'restaurant', script: 'scripts/restaurant-goldens.ts' });
}

// ── Run as a script ──────────────────────────────────────────────────────

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rebuild = process.argv.includes('--corpus');
  for (const [name, input] of Object.entries(buildCorpus())) {
    const file = join(CORPUS_DIR, `${name}.json`);
    if (rebuild || !existsSync(file)) write(file, input);
  }
  if (!existsSync(SCAN_FILE) || !existsSync(REPLY_FILE)) throw new Error('scan-result.json and menu-draft-reply.json are fixed inputs: restore them from git.');
  const goldens = computeGoldens();
  const keep = new Set(goldens.keys());
  for (const stale of goldenFiles().filter((f) => !keep.has(f))) rmSync(join(GOLDEN_DIR, stale));
  for (const [path, value] of goldens) write(join(GOLDEN_DIR, path), value);
  console.log(`${goldens.size} goldens written to ${relative(process.cwd(), GOLDEN_DIR)}/`);
}
