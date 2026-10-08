import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultAnswers, tablesFromCounts, defaultAreas, defaultTables, type RestaurantAnswers } from '../src/presets/restaurant/answers.ts';
import { autoLayout, fixtureRect, footprint, freeSpot, intoRooms, overlaps, roomBounds, snap, tableRect } from '../src/presets/restaurant/layout.ts';
import { compileRestaurant, dayRange, hoursSentence } from '../src/presets/restaurant/compile.ts';
import { sanitiseRestaurant, validateRestaurant } from '../src/presets/restaurant/validate.ts';
import { planRestaurantSeed, seedFrom } from '../src/presets/restaurant/seed.ts';
import { blockingKeys, candidateTimes, checkSlot } from '../src/domain/availability.ts';
import { addDays, toLocal, weekdayOf } from '../src/domain/time.ts';
import { openPglite, migrate } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { DemoRepo } from '../src/db/demo-repo.ts';
import { generateKey, hashKey, normaliseKey, prefixOf, readSession, signSession, KEY_ENTROPY_BITS } from '../src/demo/access.ts';

const named = (): RestaurantAnswers => {
  const a = defaultAnswers();
  a.basics.name = 'Lucas Kitchen';
  return a;
};
const compile = (a: RestaurantAnswers) => compileRestaurant(a, { slug: 'demo-test' });
const NOW = new Date('2026-10-02T17:45:00Z'); // Friday, 6:45pm BST

test('restaurant: the defaults compile to a working restaurant', () => {
  const p = compile(named());
  assert.equal(p.name, 'Lucas Kitchen');
  assert.match(p.greeting, /\bAI\b.*\bdemo\b/);
  const res = p.booking!.resources;
  assert.equal(res.filter((r) => !r.combines).length, 15);
  assert.deepEqual(res.filter((r) => r.combines).map((r) => r.key), ['T1+T2', 'T3+T4', 'T7+T8', 'T13+T14']);
  assert.ok(res.every((r) => r.services.length), 'no table is kept for walk-ins unless the owner says so');
  assert.match(p.core_facts.join(' '), /Walk-ins are welcome when a table is free/);
  assert.equal(res.find((r) => r.key === 'T5')!.accessible, true);
  assert.deepEqual(p.booking!.areas!.map((a) => a.key), ['indoor', 'terrace']);
  assert.match(p.booking!.areas![1].weather_note!, /move you inside/);
  assert.equal(p.ordering!.slot_capacity, 4);
  assert.equal(p.ordering!.payment, 'either');
  assert.ok(p.menu!.categories.length >= 4);
  assert.ok(p.core_facts.length <= 6);
  assert.deepEqual(validateRestaurant(named()).filter((i) => i.level === 'error'), []);
});

test('restaurant: every builder field changes what it claims to', () => {
  const cases: [string, (a: RestaurantAnswers) => void, (p: ReturnType<typeof compile>) => boolean][] = [
    ['name', (a) => (a.basics.name = 'Trattoria Nova'), (p) => p.name === 'Trattoria Nova' && p.greeting.includes('Trattoria Nova')],
    ['style', (a) => (a.basics.style = 'Sichuan hot pot'), (p) => p.summary.includes('Sichuan hot pot') && p.core_facts[0].includes('Sichuan')],
    ['address', (a) => (a.basics.address = '12 Market Street, Leeds'), (p) => p.address === '12 Market Street, Leeds'],
    ['phone', (a) => (a.basics.phone_display = '0113 496 0000'), (p) => p.phone_display === '0113 496 0000'],
    ['voice', (a) => (a.basics.voice = 'Puck'), (p) => p.voice === 'Puck'],
    ['greeting', (a) => (a.basics.greeting = 'Ciao! You have reached the AI assistant on this demo line.'), (p) => p.greeting.startsWith('Ciao')],
    ['a day closed', (a) => (a.hours.days[2] = { open: false, services: [] }), (p) => !p.booking!.services[0].windows.some((w) => w.days.includes(2)) && /Closed/.test(p.core_facts[1])],
    ['last booking', (a) => (a.hours.last_booking_before_close = 30), (p) => p.booking!.services[0].windows.some((w) => w.last === '21:30')],
    ['closure', (a) => (a.hours.closures = [{ date: '2026-12-25', note: 'Christmas' }]), (p) => p.closures![0].date === '2026-12-25'],
    ['no reservations', (a) => (a.serve.reservations = false), (p) => p.booking === undefined],
    ['no walk-ins', (a) => (a.serve.walk_ins = false), (p) => p.knowledge.some((k) => /bookings only/.test(k.a))],
    ['no takeaway', (a) => (a.serve.collection.enabled = false), (p) => p.ordering === undefined],
    ['prep time', (a) => (a.serve.collection.prep_minutes = 35), (p) => p.ordering!.prep_minutes === 35],
    ['orders per slot', (a) => (a.serve.collection.per_slot = 2), (p) => p.ordering!.slot_capacity === 2],
    ['slot size', (a) => (a.serve.collection.slot_minutes = 10), (p) => p.ordering!.slot_minutes === 10],
    ['delivery', (a) => Object.assign(a.serve.delivery, { enabled: true, districts: ['NG1', 'NG7'] }), (p) => p.ordering!.delivery!.districts.join() === 'NG1,NG7'],
    ['delivery apps', (a) => (a.serve.delivery_apps = ['Deliveroo']), (p) => p.knowledge.some((k) => k.a.includes('Deliveroo'))],
    ['weather rule', (a) => (a.seating.areas[1].weather_rule = 'own_risk'), (p) => /cannot promise/.test(p.booking!.areas![1].weather_note!)],
    ['area not bookable', (a) => (a.seating.areas[1].reservable = false), (p) => p.booking!.resources.filter((r) => r.area === 'terrace').every((r) => r.services.length === 0)],
    ['private room', (a) => a.seating.areas.push({ key: 'private', label: 'Private room', kind: 'private', reservable: true, enquiry_only: true, weather_rule: null }), (p) => p.booking!.areas!.find((x) => x.key === 'private')!.enquiry_only === true],
    ['accessible table', (a) => (a.seating.tables.find((t) => t.key === 'T9')!.accessible = true), (p) => p.booking!.resources.find((r) => r.key === 'T9')!.accessible === true],
    ['table feature', (a) => a.seating.tables.find((t) => t.key === 'T9')!.features.push('window'), (p) => p.booking!.resources.find((r) => r.key === 'T9')!.features!.includes('window')],
    ['walk-in table', (a) => (a.seating.tables.find((t) => t.key === 'T9')!.walk_in = true), (p) => p.booking!.resources.find((r) => r.key === 'T9')!.services.length === 0],
    ['join', (a) => { a.seating.tables.find((t) => t.key === 'T9')!.joins.push('T10'); a.seating.tables.find((t) => t.key === 'T10')!.joins.push('T9'); }, (p) => p.booking!.resources.some((r) => r.key === 'T9+T10' && r.capacity === 10)],
    ['sittings', (a) => (a.seating.sittings.up_to_4 = 105), (p) => p.booking!.services[0].duration_rules!.find((r) => r.max_party === 4)!.minutes === 105],
    ['max party', (a) => (a.seating.max_party = 6), (p) => p.booking!.services[0].max_party === 6],
    ['notice', (a) => (a.seating.notice_minutes = 120), (p) => p.booking!.services[0].lead_minutes === 120],
    ['horizon', (a) => (a.seating.horizon_days = 14), (p) => p.booking!.services[0].horizon_days === 14],
    ['highchairs', (a) => (a.seating.highchairs = 5), (p) => p.booking!.highchairs === 5],
    ['menu', (a) => (a.menu.categories[0].items[0].name = 'Burrata'), (p) => p.menu!.categories[0].items[0].name === 'Burrata'],
    ['deposit per booking', (a) => (a.money.deposit = { mode: 'per_booking', amount_pence: 2500, min_party: 8 }), (p) => p.booking!.services[0].deposit!.flat_pence === 2500 && /£25\.00 deposit/.test(p.policies!.deposit)],
    ['no deposit', (a) => (a.money.deposit.mode = 'none'), (p) => p.booking!.services[0].deposit === undefined && !p.policies!.deposit],
    ['takeaway payment', (a) => (a.money.takeaway_payment = 'collection'), (p) => p.ordering!.payment === 'collection' && /paid when you collect/.test(p.policies!.takeaway)],
    ['service charge', (a) => (a.money.service_charge = 'No service charge.'), (p) => p.policies!.service_charge === 'No service charge.'],
    ['dogs', (a) => (a.policies.dogs = 'no'), (p) => /Only assistance dogs/.test(p.knowledge.find((k) => /dog/.test(k.q))!.a)],
    ['parking', (a) => (a.policies.parking = 'Free parking behind the building.'), (p) => p.knowledge.some((k) => k.a === 'Free parking behind the building.')],
    ['faq', (a) => (a.policies.faqs = [{ q: 'Do you do bottomless brunch?', a: 'Saturdays, 11 till 3.' }]), (p) => p.knowledge.some((k) => k.q === 'Do you do bottomless brunch?')],
    ['accent', (a) => (a.theme.accent = '#123456'), (p) => p.brand!.accent === '#123456'],
  ];
  const base = JSON.stringify(compile(named()));
  for (const [name, change, check] of cases) {
    const a = named();
    change(a);
    const p = compile(sanitiseRestaurant(a));
    assert.ok(check(p), `${name}: not reflected in the profile`);
    assert.notEqual(JSON.stringify(p), base, `${name}: changed nothing`);
  }
});

test('restaurant: days and hours read the way people say them', () => {
  assert.equal(dayRange([2, 3, 4, 5, 6]), 'Tuesday to Saturday');
  assert.equal(dayRange([5, 6]), 'Friday and Saturday');
  assert.equal(dayRange([0, 1, 2, 3, 4, 5, 6]), 'Every day');
  assert.equal(dayRange([1, 3, 5]), 'Monday, Wednesday and Friday');
  assert.equal(hoursSentence(named()), 'Sunday: 12 noon till 8pm. Tuesday to Saturday: lunch 12 noon till 2:30pm, dinner 5:30pm till 10pm. Closed Mondays.');
});

test('restaurant: the sanitiser bounds hostile input and is stable', () => {
  const evil: any = named();
  evil.basics.name = '<script>alert(1)</script>'.repeat(10);
  evil.basics.voice = 'NotAVoice';
  evil.seating.tables[0].seats = 999;
  evil.seating.tables[1].area = 'nowhere';
  evil.seating.tables[2].joins = ['T2', 'T99', 'T3'];
  evil.theme.logo = 'javascript:alert(1)';
  evil.theme.accent = 'red; background:url(x)';
  evil.menu.categories[0].items[0].allergens = ['gluten', 'plutonium'];
  evil.serve.delivery.districts = ['NG1', 'DROP TABLE', 'ng7 '];
  evil.sources = { 'basics.name': 'website', '__proto__': 'website', 'x': 'evil' };
  const s = sanitiseRestaurant(evil);
  assert.equal(s.basics.name.length, 60);
  assert.equal(s.basics.voice, 'Kore');
  assert.equal(s.seating.tables[0].seats, 20);
  assert.equal(s.seating.tables[1].area, 'indoor');
  assert.deepEqual(s.seating.tables[2].joins.sort(), ['T2', 'T4'], 'joins only to real tables, never itself, and both ways (T4 already joined T3)');
  assert.equal(s.theme.logo, null);
  assert.equal(s.theme.accent, '#e9ac57');
  assert.deepEqual(s.menu.categories[0].items[0].allergens, ['gluten']);
  assert.deepEqual(s.serve.delivery.districts, ['NG1', 'NG7']);
  assert.deepEqual(Object.keys(s.sources), ['basics.name']);
  assert.equal(JSON.stringify(sanitiseRestaurant(s)), JSON.stringify(s), 'sanitising twice changes nothing');
  assert.equal(JSON.stringify(sanitiseRestaurant(null)), JSON.stringify(sanitiseRestaurant({})));
});

test('restaurant: validation says what is missing', () => {
  const a = defaultAnswers();
  const msgs = (x: RestaurantAnswers) => validateRestaurant(x).filter((i) => i.level === 'error').map((i) => i.message).join(' | ');
  assert.match(msgs(a), /name/);
  const b = named();
  b.basics.greeting = 'Hello, how can I help?';
  assert.match(msgs(b), /AI assistant/);
  const c = named();
  c.serve.delivery.enabled = true;
  assert.match(msgs(c), /postcode districts/);
  const d = named();
  d.menu.categories = [];
  assert.match(msgs(d), /needs a menu/);
  const e = named();
  e.seating.areas.forEach((x) => (x.reservable = false));
  assert.match(msgs(e), /Nothing is bookable/);
});

test('restaurant: tables from counts are laid out without overlapping', () => {
  const t = tablesFromCounts(defaultAreas(), { indoor: { 2: 6, 4: 8, 6: 3, 8: 1 }, terrace: { 2: 2, 4: 6, 6: 0, 8: 0 } });
  assert.equal(t.length, 26);
  for (const x of t) for (const y of t) if (x !== y && x.area === y.area) assert.ok(!overlaps(tableRect(x), tableRect(y), 20), `${x.key} overlaps ${y.key}`);
  assert.ok(t.every((x) => x.x > 0 && x.y > 0 && x.x + footprint(x).w <= 1000));
});

test('floor plan: each area is its own room, and a table added to one leaves the others alone', () => {
  const areas = defaultAreas();
  let tables = defaultTables(areas);
  const terrace = JSON.stringify(tables.filter((x) => x.area === 'terrace'));
  assert.deepEqual(roomBounds('terrace', tables)!.x, 40, 'the terrace starts at the top left of its own room');
  // Twelve more inside, one at a time, as the builder's + button does.
  for (let n = 0; n < 12; n++) {
    const k = 16 + n;
    tables.push({ key: `T${k}`, label: `Table ${k}`, area: 'indoor', seats: n % 3 === 0 ? 6 : 4, shape: n % 3 === 0 ? 'rect' : 'square', x: 0, y: 0, rotation: n % 4 === 0 ? 90 : 0, accessible: false, walk_in: false, features: [], joins: [] });
    tables = autoLayout(areas, tables);
    const inside = tables.filter((x) => x.area === 'indoor');
    for (const x of inside) for (const y of inside) if (x !== y) assert.ok(!overlaps(tableRect(x), tableRect(y), 0), `${x.key} overlaps ${y.key} after adding T${k}`);
  }
  assert.equal(JSON.stringify(tables.filter((x) => x.area === 'terrace')), terrace, 'the terrace did not move');
  assert.ok(tables.every((x) => x.x + footprint(x).w <= 1000));
  assert.deepEqual(footprint({ seats: 6, shape: 'rect', rotation: 90 }), { w: 70, h: 162 }, 'a long table turned sideways is tall');
});

test('floor plan: lining up, the nearest clear space, and plans from before areas had rooms', () => {
  // Within eight units of a neighbour's top and left: lined up exactly, with the guides to draw.
  const s = snap({ x: 205, y: 43, w: 76, h: 76 }, [{ x: 100, y: 40, w: 76, h: 76 }, { x: 200, y: 200, w: 76, h: 76 }]);
  assert.deepEqual([s.x, s.y], [200, 40]);
  assert.deepEqual(s.guides, [{ x: 200 }, { y: 40 }]);
  // Nowhere near: the grid.
  const g = snap({ x: 503, y: 617, w: 56, h: 56 }, [{ x: 100, y: 40, w: 76, h: 76 }]);
  assert.deepEqual([g.x, g.y, g.guides.length], [500, 620, 0]);
  // Dropped on top of another table: the closest spot clear of it.
  const others = [{ x: 100, y: 100, w: 76, h: 76 }];
  const spot = freeSpot({ w: 76, h: 76 }, { x: 110, y: 110 }, others);
  assert.ok(!overlaps({ ...spot, w: 76, h: 76 }, others[0], 4));
  assert.ok(Math.hypot(spot.x - 110, spot.y - 110) <= 90, `went far: ${JSON.stringify(spot)}`);
  assert.deepEqual(freeSpot({ w: 76, h: 76 }, { x: 400, y: 400 }, others), { x: 400, y: 400 }, 'a clear drop stays put');

  // A plan saved with every area on one canvas (the terrace in a band below):
  // each area moves to the top left of its own room, keeping its shape.
  const old: any = named();
  const terrace = old.seating.tables.filter((t: any) => t.area === 'terrace');
  terrace.forEach((t: any, i: number) => Object.assign(t, { x: 60 + i * 110, y: 420 }));
  delete old.seating.plan;
  delete old.seating.fixtures;
  const moved = sanitiseRestaurant(old);
  assert.equal(moved.seating.plan, 2);
  assert.deepEqual(moved.seating.tables.filter((t) => t.area === 'terrace').map((t) => [t.x, t.y]), [[40, 40], [150, 40], [260, 40], [370, 40]]);
  assert.deepEqual(moved.seating.fixtures, [], 'no room shapes are invented for a plan that had none');
  assert.equal(JSON.stringify(sanitiseRestaurant(moved)), JSON.stringify(moved), 'moved once only');
  assert.deepEqual(intoRooms(defaultAreas(), defaultTables()).map((t) => [t.x, t.y]), defaultTables().map((t) => [t.x, t.y]), 'a plan already in rooms stays put');

  // Room shapes: kept to their area, their kinds and sensible sizes.
  const f: any = named();
  f.seating.fixtures = [
    { key: 'F1', area: 'indoor', kind: 'bar', x: 100, y: 300, length: 99999, rotation: 95 },
    { key: 'F2', area: 'nowhere', kind: 'door', x: 1, y: 1, length: 70, rotation: 0 },
    { key: 'F3', area: 'terrace', kind: 'trapdoor', x: 1, y: 1, length: 70, rotation: 180 },
  ];
  const fx = sanitiseRestaurant(f).seating.fixtures;
  assert.deepEqual(fx.map((x) => [x.key, x.kind, x.length, x.rotation]), [['F1', 'bar', 700, 90], ['F3', 'wall', 70, 180]]);
  assert.deepEqual(fixtureRect(fx[0]), { x: 100, y: 300, w: 46, h: 700 }, 'a bar turned sideways runs down the room');
  // The sample room has a bar, a door and a window, and they compile into the profile for the board.
  assert.deepEqual(named().seating.fixtures.map((x) => x.kind).sort(), ['bar', 'door', 'window']);
  assert.equal(compile(named()).booking!.fixtures!.length, 3);
});

function checkPlan(a: RestaurantAnswers, seed: number) {
  const p = compile(sanitiseRestaurant(a));
  const plan = planRestaurantSeed(p, NOW, seed);
  const res = p.booking?.resources ?? [];
  const svc = p.booking?.services[0];
  for (const b of plan.bookings) {
    const r = res.find((x) => x.key === b.resource_key)!;
    assert.ok(r && r.services.includes('table'), `${b.reference} on an unbookable table ${b.resource_key}`);
    assert.ok(b.party_size <= (r.capacity ?? 0), `${b.reference}: ${b.party_size} on a ${r.capacity}-top`);
    const l = toLocal(b.starts_at, p.timezone);
    const w = svc!.windows.filter((x) => x.days.includes(weekdayOf(l.date)));
    assert.ok(w.some((x) => l.time >= x.first && l.time <= x.last), `${b.reference} at ${l.date} ${l.time} is outside the windows`);
    for (const o of plan.bookings) {
      if (o === b) continue;
      if (!blockingKeys(b.resource_key, res).has(o.resource_key)) continue;
      assert.ok(o.ends_at <= b.starts_at || o.starts_at >= b.ends_at, `${b.reference} and ${o.reference} clash on ${b.resource_key}/${o.resource_key}`);
    }
  }
  assert.equal(new Set(plan.bookings.map((b) => b.reference)).size, plan.bookings.length, 'references are unique');
  // A prospect's first call works: every bookable time on every day, the
  // weekend included, keeps a table for two and one for four, inside where it
  // has one that size.
  if (svc) {
    const inside = (p.booking?.areas ?? []).find((x) => x.kind === 'indoor' && x.reservable)?.key;
    const roomFor = (n: number) => (inside && res.some((r) => r.services.includes(svc.key) && r.area === inside && (r.capacity ?? 0) >= n && (r.min ?? 1) <= n) ? inside : undefined);
    const existing = plan.bookings.map((b, i) => ({ id: `b${i}`, resource_key: b.resource_key, starts_at: b.starts_at, ends_at: b.ends_at }));
    const biggest = Math.max(...res.filter((r) => r.services.includes(svc.key)).map((r) => r.capacity ?? 0));
    for (let d = 0; d < 7; d++) {
      const date = addDays(toLocal(NOW, p.timezone).date, d);
      for (const t of candidateTimes(svc, date)) {
        for (const n of [2, 4].filter((x) => x <= biggest)) {
          const ok = checkSlot({ profile: p, serviceKey: svc.key, date, time: t, partySize: n, now: new Date(0), existing, area: roomFor(n) }, { ...svc, lead_minutes: 0 }, t);
          assert.ok(ok, `no table for ${n}${roomFor(n) ? ' inside' : ''} left at ${date} ${t}`);
        }
      }
    }
  }
  const cap = p.ordering?.slot_capacity;
  if (cap) {
    const per = new Map<number, number>();
    for (const o of plan.orders) per.set(o.due_at.getTime(), (per.get(o.due_at.getTime()) ?? 0) + 1);
    for (const n of per.values()) assert.ok(n <= cap - 1 || cap <= 1, 'every slot keeps room for the prospect');
  }
  return { p, plan };
}

test('seed: a week that obeys the rules, for the defaults and twenty varied restaurants', () => {
  const { plan, p } = checkPlan(named(), 42);
  assert.ok(plan.bookings.length > 60, `only ${plan.bookings.length} bookings`);
  assert.ok(plan.bookings.some((b) => b.allergies), 'some allergies');
  assert.ok(plan.bookings.some((b) => b.tags.includes('birthday') || b.tags.includes('anniversary')));
  assert.ok(plan.bookings.some((b) => b.resource_key.includes('+')), 'a pushed-together table');
  assert.ok(plan.bookings.some((b) => b.area_key === 'terrace'));
  const kept = named();
  kept.seating.tables.find((t) => t.key === 'T4')!.walk_in = true;
  assert.ok(checkPlan(kept, 42).plan.bookings.every((b) => !['T4', 'T3+T4'].includes(b.resource_key)), 'a walk-in table stays free');
  const today = plan.bookings.filter((b) => toLocal(b.starts_at, p.timezone).date === '2026-10-02');
  assert.ok(today.some((b) => b.visit_status === 'finished') && today.some((b) => b.visit_status === 'seated'), 'tonight is under way');
  assert.ok(plan.orders.length >= 6 && plan.orders.some((o) => o.status === 'completed') && plan.orders.some((o) => o.status === 'confirmed'));
  assert.equal(plan.messages.length, 2);
  assert.equal(JSON.stringify(planRestaurantSeed(p, NOW, 42)), JSON.stringify(plan), 'the same seed gives the same week');

  for (let i = 0; i < 20; i++) {
    const a = named();
    const r = (n: number) => (seedFrom(`v${i}`) >>> n) % 7;
    a.seating.tables = tablesFromCounts(a.seating.areas, { indoor: { 2: r(1), 4: 1 + r(3), 6: r(5) % 3, 8: r(7) % 2 }, terrace: { 2: r(9) % 3, 4: r(11) % 5, 6: 0, 8: 0 } });
    if (i % 3 === 0) a.seating.tables.forEach((t, j) => j % 4 === 0 && (t.accessible = true));
    if (i % 4 === 1) a.hours.days[5] = { open: true, services: [{ label: 'Dinner', open: '18:00', close: '23:00' }] };
    if (i % 5 === 2) a.money.takeaway_payment = 'phone';
    if (i % 6 === 3) a.serve.collection.per_slot = 2;
    checkPlan(a, seedFrom(`seed${i}`));
  }
});

test('seed: the defaults look like a busy neighbourhood restaurant, not a full one', () => {
  for (const seed of [42, 7, 1234]) {
    const { plan, p } = checkPlan(named(), seed);
    const res = p.booking!.resources;
    const tables = res.filter((r) => !r.combines && r.services.length).length;
    const day = (date: string) => plan.bookings.filter((b) => toLocal(b.starts_at, p.timezone).date === date);
    // Tables in use at a moment, counting a pushed-together pair as two.
    const inUse = (date: string, time: string) =>
      day(date)
        .filter((b) => toLocal(b.starts_at, p.timezone).time <= time && toLocal(b.ends_at, p.timezone).time > time)
        .reduce((n, b) => n + (res.find((r) => r.key === b.resource_key)!.combines?.length ?? 1), 0);
    const busiest = (date: string, from: string, to: string) =>
      Math.max(...candidateTimes(p.booking!.services[0], date).filter((t) => t >= from && t <= to).map((t) => inUse(date, t)));
    // NOW is a Friday: Saturday is the busiest evening, Tuesday the quietest.
    const sat = busiest('2026-10-03', '18:00', '21:00');
    const tue = busiest('2026-10-06', '18:00', '21:00');
    assert.ok(sat >= tables * 0.7, `seed ${seed}: Saturday evening only reaches ${sat} of ${tables} tables`);
    assert.ok(sat < tables, `seed ${seed}: Saturday evening is full`);
    assert.ok(tue < sat, `seed ${seed}: Tuesday (${tue}) is as busy as Saturday (${sat})`);
    assert.ok(day('2026-10-06').length < day('2026-10-03').length, `seed ${seed}: more bookings on Tuesday than Saturday`);
    assert.equal(day('2026-10-05').length, 0, 'closed on Monday');
    // No lumps: no more than four tables arrive at once (a kitchen paces them), and the opening time
    // is not where draws that missed the service were piled up.
    for (const b of plan.bookings) {
      const l = toLocal(b.starts_at, p.timezone);
      const same = plan.bookings.filter((o) => o.starts_at.getTime() === b.starts_at.getTime()).length;
      assert.ok(same <= 4, `seed ${seed}: ${same} bookings arrive at ${l.date} ${l.time}`);
    }
    // Most people book on the hour or the half hour.
    const round = plan.bookings.filter((b) => toLocal(b.starts_at, p.timezone).time.endsWith(':00') || toLocal(b.starts_at, p.timezone).time.endsWith(':30'));
    assert.ok(round.length > plan.bookings.length * 0.6, `seed ${seed}: only ${round.length} of ${plan.bookings.length} on the hour or half hour`);
  }
});

test('access: keys, hashing and sessions', () => {
  const k = generateKey();
  assert.match(k, /^DEMO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.ok(KEY_ENTROPY_BITS > 59);
  const n = normaliseKey(k)!;
  assert.equal(normaliseKey(k.toLowerCase().replace(/-/g, ' ')), n, 'case, spaces and dashes forgiven');
  assert.equal(normaliseKey(n), n, 'the DEMO- prefix is optional');
  assert.equal(normaliseKey('DEMO-O0I1-XXXX-XXXX'), null, 'ambiguous glyphs are never issued, so never accepted');
  assert.equal(normaliseKey('short'), null);
  assert.notEqual(hashKey(n), hashKey(normaliseKey(generateKey())!));
  assert.equal(prefixOf(n).length, 4);
  const token = signSession({ keyId: 'abc', exp: Date.now() + 60000 }, 'secret');
  assert.deepEqual(readSession(token, 'secret')?.keyId, 'abc');
  assert.equal(readSession(token, 'other'), null, 'another secret');
  assert.equal(readSession(token.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 'secret'), null, 'tampered');
  assert.equal(readSession(signSession({ keyId: 'abc', exp: Date.now() - 1 }, 'secret'), 'secret'), null, 'expired');
});

test('workspace: a key owns a workspace that seeds into the database', async () => {
  const db = await openPglite();
  await migrate(db);
  const repo = new Repo(db);
  const demo = new DemoRepo(db);
  const n = normaliseKey(generateKey())!;
  const key = await demo.createKey({ hash: hashKey(n), prefix: prefixOf(n), person_name: 'Sam Taylor', company: 'Lucas Kitchen', expires_at: new Date(Date.now() + 86400000) });
  assert.equal((await demo.keyByHash(hashKey(n)))?.id, key.id);
  const profile = compile(named());
  const ws = await demo.createWorkspace(key.id, 'restaurant', profile, named());
  assert.equal((await demo.listWorkspaces(key.id)).length, 1);
  const plan = planRestaurantSeed(profile, NOW, 7);
  await repo.insertSeed(ws.tenant.id, plan);
  const rows = await repo.listBookings(ws.tenant.id, new Date(0), new Date('2100-01-01'), true);
  assert.equal(rows.length, plan.bookings.length);
  assert.ok(rows.some((b) => b.allergies) && rows.every((b) => (b.history ?? []).length === 1));
  // A staff move is checked like a call: onto a free table of the right size.
  const b = rows.find((x) => x.party_size <= 2 && x.resource_key === 'T1')!;
  if (b) {
    const moved = await repo.moveBooking(ws.tenant, b.reference, 'T9');
    assert.ok(!moved.ok || moved.booking.resource_key === 'T9');
    const tooSmall = await repo.moveBooking(ws.tenant, rows.find((x) => x.party_size >= 5)?.reference ?? b.reference, 'T2');
    assert.equal(tooSmall.ok, false);
  }
  await repo.resetTenantData(ws.tenant.id);
  assert.equal((await repo.listBookings(ws.tenant.id, new Date(0), new Date('2100-01-01'), true)).length, 0);
  await demo.revokeKey(key.id);
  assert.ok((await demo.keyById(key.id))!.revoked_at);
  await db.close();
});

test("restaurant builder: a half-filled question survives autosave, is warned about, and isn't given to the receptionist", () => {
  const a = defaultAnswers();
  a.basics.name = 'Olive & Ember';
  a.policies.faqs = [{ q: 'Do you do bottomless brunch?', a: '' }, { q: 'Is there a kids menu?', a: 'Yes, until 7pm.' }];
  const kept = sanitiseRestaurant(structuredClone(a));
  assert.deepEqual(kept.policies.faqs.map((f) => f.q), ['Do you do bottomless brunch?', 'Is there a kids menu?'], 'kept while the answer is being written');
  assert.ok(validateRestaurant(kept).some((i) => i.step === 'policies' && /1 question needs both the question and its answer/.test(i.message)));
  const p = compileRestaurant(kept, { slug: 'olive' });
  assert.ok(p.knowledge.some((k) => k.q === 'Is there a kids menu?'));
  assert.ok(!p.knowledge.some((k) => k.q === 'Do you do bottomless brunch?'), 'an unanswered question is never given to callers');
});
