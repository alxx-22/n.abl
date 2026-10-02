// The preset framework itself: the parts kinds of business share, and the
// registry the server dispatches through (PRESETS.md §2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRESETS, answersOf, builtPreset, getPreset, type BaseAnswers, type Preset } from '../src/presets/index.ts';
import { PresetError } from '../src/presets/common/errors.ts';
import { sampleMenu } from '../src/presets/food/menu.ts';
import { compileOrdering, sanitiseOrdering, takeawaySentence, validateOrdering, type OrderingAnswer } from '../src/presets/food/ordering.ts';
import { defaultAnswers, type RestaurantAnswers } from '../src/presets/restaurant/answers.ts';
import { compileRestaurant } from '../src/presets/restaurant/compile.ts';
import { factSheet } from '../src/presets/restaurant/drafts.ts';
import { sanitiseRestaurant, validateRestaurant } from '../src/presets/restaurant/validate.ts';
import { loadConfig } from '../src/config.ts';

const corpus = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/restaurant/corpus/${name}.json`, import.meta.url), 'utf8'));
const restaurant = builtPreset('restaurant') as unknown as Preset<RestaurantAnswers>;

test('presets: the sample menu is read once, and every caller gets its own copy', () => {
  const first = defaultAnswers();
  const pristine = JSON.stringify(defaultAnswers().menu);
  // A builder edits its answers in place; that must never reach the next workspace.
  first.menu.categories[0].items[0].name = 'Changed';
  first.menu.categories.pop();
  first.menu.modifier_groups = {};
  assert.equal(JSON.stringify(defaultAnswers().menu), pristine);
  const a = sampleMenu('tenants/lucas-trattoria.json');
  const b = sampleMenu('tenants/lucas-trattoria.json');
  assert.notEqual(a.categories, b.categories);
  assert.deepEqual(a, b);
  assert.equal(a.source, 'sample');
  assert.equal(a.allergens_are_examples, true);
});

test('presets: every kind of business has its words, its type and a placeholder website', () => {
  assert.equal(new Set(PRESETS.map((p) => p.key)).size, PRESETS.length);
  for (const p of PRESETS) {
    assert.ok(p.noun && p.noun === p.noun.toLowerCase(), `${p.key}: a lower-case noun, for "Untitled ${p.noun}"`);
    assert.equal(p.business_type, p.key, `${p.key}: its profile says what it is`);
    assert.match(p.example, /^https:\/\/www\.your-[a-z-]+\.co\.uk$/, `${p.key}: a placeholder website`);
  }
});

test('presets: the catalogue and the registry agree', () => {
  for (const p of PRESETS) {
    const built = builtPreset(p.key);
    // A live card a prospect can pick must have a preset behind it; a coming-soon one is never served.
    if (p.status === 'live') assert.ok(built, `${p.key} is live but not built`);
    assert.equal(Boolean(getPreset(p.key)), p.status === 'live' && Boolean(built), p.key);
    if (built) assert.equal(built.info, p);
  }
  assert.equal(getPreset('nonsense'), null);
  assert.equal(builtPreset('nonsense'), null);
});

test('presets: the restaurant behind the registry is the restaurant', () => {
  for (const name of ['full', 'as-created', 'legacy', 'junk']) {
    const input = corpus(name);
    const a = restaurant.sanitise(structuredClone(input));
    assert.deepEqual(a, sanitiseRestaurant(structuredClone(input)), name);
    assert.equal(a.version, restaurant.VERSION);
    assert.deepEqual(answersOf(restaurant, structuredClone(input)), a, `${name}: no migration yet`);
    assert.deepEqual(restaurant.validate(a), validateRestaurant(a), name);
    const profile = restaurant.compile(a, { slug: 'x' });
    assert.deepEqual(profile, compileRestaurant(a, { slug: 'x' }), name);
    assert.equal(restaurant.factSheet(a), factSheet(a));
    assert.deepEqual(Object.keys(restaurant.preview(a, profile)), ['greeting', 'core_facts', 'hours', 'covers', 'bookable_tables', 'pairs', 'dishes'], 'today\'s preview fields, no more');
  }
  const fresh = restaurant.defaults();
  fresh.basics.name = 'Changed';
  assert.equal(restaurant.defaults().basics.name, '', 'a fresh object every call');
  assert.deepEqual(restaurant.scan.parts, ['identity', 'hours', 'menu', 'theme', 'services', 'policies']);
});

test('presets: saved answers are brought up to date before they are cleaned', () => {
  const seen: number[] = [];
  const v2: Preset = {
    ...builtPreset('restaurant')!,
    VERSION: 2,
    migrate(raw, from) {
      seen.push(from);
      return { ...(raw as object), basics: { name: `from ${from}` } };
    },
    sanitise: (x) => ({ ...(x as BaseAnswers), version: 2 }),
  };
  assert.equal(answersOf(v2, {}).basics.name, 'from 1', 'no version: the first');
  assert.equal(answersOf(v2, { version: 1 }).basics.name, 'from 1');
  assert.equal(answersOf(v2, { version: 'one' }).basics.name, 'from 1', 'a version that is not a number counts as the first');
  assert.equal((answersOf(v2, { version: 2, basics: { name: 'kept' } }) as BaseAnswers).basics.name, 'kept', 'current answers are not migrated');
  assert.equal(answersOf(v2, null).basics.name, 'from 1');
  assert.deepEqual(seen, [1, 1, 1, 1]);
});

test('presets: the restaurant workspace lists today\'s tabs', () => {
  const a = defaultAnswers();
  a.basics.name = 'Tabs';
  const spec = restaurant.workspace(compileRestaurant(a, { slug: 'tabs' }));
  assert.deepEqual(spec.views.map((v) => `${v.id}:${v.label}`), ['floor:Floor plan', 'timeline:Timeline', 'orders:Kitchen', 'messages:Messages', 'calls:Calls']);
  assert.equal(spec.suggestions[0], 'Can I book a table for four on Friday at half seven, outside if possible?');
  assert.equal(spec.resetLine, 'bookings and orders');
  a.serve.reservations = false;
  a.serve.collection.enabled = false;
  const none = restaurant.workspace(compileRestaurant(a, { slug: 'tabs' }));
  assert.deepEqual(none.views.map((v) => v.id), ['orders', 'messages', 'calls'], 'no floor plan or timeline without tables to book');
  assert.deepEqual(none.suggestions, ['Do you have gluten-free options?']);
});

test('presets: staff push two tables together, both ways, or are told why not', () => {
  const a = restaurant.sanitise(defaultAnswers());
  const joined = restaurant.combineTables!(a, 'T9', 'T10');
  assert.ok(joined.seating.tables.find((t) => t.key === 'T9')!.joins.includes('T10'));
  assert.ok(joined.seating.tables.find((t) => t.key === 'T10')!.joins.includes('T9'));
  assert.ok(!a.seating.tables.find((t) => t.key === 'T9')!.joins.includes('T10'), 'the answers passed in are left alone');
  const refused = (x: string, y: string, status: number, message: RegExp) =>
    assert.throws(() => restaurant.combineTables!(a, x, y), (e: unknown) => e instanceof PresetError && e.status === status && message.test(e.message));
  refused('T9', 'T9', 400, /two different tables/);
  refused('T9', 'T99', 400, /two different tables/);
  refused('T9', 'T12', 409, /different areas/);
  const kept = structuredClone(a);
  kept.seating.tables.find((t) => t.key === 'T10')!.walk_in = true;
  assert.throws(() => restaurant.combineTables!(kept, 'T9', 'T10'), (e: unknown) => e instanceof PresetError && e.status === 409 && /walk-ins/.test(e.message));
});

test('presets: the menu draft needs something to go on before it asks the model', async () => {
  const a = restaurant.sanitise(defaultAnswers());
  a.basics.style = '';
  await assert.rejects(restaurant.draft!.run({}, a, loadConfig()), (e: unknown) => e instanceof PresetError && e.status === 400 && e.message === 'Describe the food first.');
  assert.equal(restaurant.draft!.label, 'menu');
  assert.deepEqual(restaurant.draft!.counts(a.menu), { dishes: a.menu.categories.reduce((n, c) => n + c.items.length, 0) });
});

test('presets: the shared ordering keeps a takeaway\'s zones, drivers and timed orders, and gives the restaurant none of them', () => {
  // The takeaway's defaults as PRESETS.md §5.1 gives them: every district in one list, two of them further away.
  const takeaway: OrderingAnswer = {
    collection: { enabled: true, prep_minutes: 15, slot_minutes: 15, per_slot: 4 },
    delivery: {
      enabled: true, districts: ['NG1', 'NG2', 'NG3', 'NG5', 'NG7', 'NG9'], fee_pence: 250, min_order_pence: 1200, extra_minutes: 25,
      zones: [{ code: 'NG7', fee_pence: 350, min_order_pence: 1500 }, { code: 'NG9', fee_pence: 350, min_order_pence: 1500 }],
      free_over_pence: 3000, drivers: ['Kai', 'Priya', 'Tom'],
    },
    delivery_apps: [],
    timed_orders: true,
  };
  assert.deepEqual(sanitiseOrdering(structuredClone(takeaway), takeaway), takeaway, 'the defaults come back as they are');

  const edited = sanitiseOrdering({
    ...takeaway,
    delivery: {
      ...takeaway.delivery, districts: ['ng 7', 'NG1'],
      zones: [{ code: 'ng7', fee_pence: 400 }, { code: 'NG7', fee_pence: 1 }, { code: 'NG9', fee_pence: 350 }, { code: 'Nottingham' }, null],
      free_over_pence: null, drivers: [' Sam ', '', 7, 'Jo'],
    },
    timed_orders: false,
  }, takeaway);
  assert.deepEqual(edited.delivery.districts, ['NG7', 'NG1']);
  assert.deepEqual(edited.delivery.zones, [{ code: 'NG7', fee_pence: 400 }], 'each district once, and only districts delivered to');
  assert.equal(edited.delivery.free_over_pence, null, 'never free');
  assert.deepEqual(edited.delivery.drivers, ['Sam', 'Jo']);
  assert.equal(edited.timed_orders, false);
  assert.ok(!('evenings_only' in edited.collection), 'the restaurant\'s evenings switch is not the takeaway\'s');
  assert.deepEqual(validateOrdering(edited, 'ordering'), [], 'Start is not refused');

  // With no evenings switch, takeaway runs in every service.
  const lunch = { open: true, services: [{ label: 'Lunch', open: '12:00', close: '15:00' }] };
  assert.deepEqual(compileOrdering(edited, { days: Array.from({ length: 7 }, () => lunch) }, 'phone')!.hours.map((h) => `${h.open}-${h.close}`), ['12:00-15:00']);
  assert.doesNotMatch(takeawaySentence(edited, 'phone')!, /evenings/);

  // Answers saved before a field existed take its default.
  const older = sanitiseOrdering({ collection: {}, delivery: { enabled: true, districts: ['NG7'] } }, takeaway);
  assert.deepEqual(older.delivery.zones, [{ code: 'NG7', fee_pence: 350, min_order_pence: 1500 }]);
  assert.equal(older.delivery.free_over_pence, 3000);
  assert.deepEqual(older.delivery.drivers, ['Kai', 'Priya', 'Tom']);
  assert.equal(older.timed_orders, true);

  // The restaurant's defaults have none of these, so its answers never gain them, whatever is sent.
  const r = sanitiseRestaurant({ serve: { delivery: { enabled: true, districts: ['NG1'], zones: [{ code: 'NG1' }], free_over_pence: 100, drivers: ['Kai'] }, timed_orders: false } });
  assert.deepEqual(Object.keys(r.serve).sort(), ['collection', 'delivery', 'delivery_apps', 'reservations', 'walk_ins']);
  assert.deepEqual(Object.keys(r.serve.collection), ['enabled', 'prep_minutes', 'slot_minutes', 'per_slot', 'evenings_only']);
  assert.deepEqual(Object.keys(r.serve.delivery), ['enabled', 'districts', 'fee_pence', 'min_order_pence', 'extra_minutes']);
});
