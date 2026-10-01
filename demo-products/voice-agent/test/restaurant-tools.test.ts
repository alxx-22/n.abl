// The receptionist's restaurant behaviours (DEMO-SERVICE-PLAN.md §4.2), on a
// restaurant compiled from the builder's defaults: inside or on the terrace,
// step-free tables, allergies and occasions, changes by reference that keep
// the table, collection slots the kitchen can handle, and the payment rule.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { mentionedAllergy, namedAllergy, newCallState, runTool, toolDeclarations, type Action, type ToolContext } from '../src/core/tools.ts';
import { compilePrompt } from '../src/core/prompt.ts';
import { DEFAULT_DEMO_CARDS } from '../src/domain/payments.ts';
import type { Tenant } from '../src/domain/types.ts';
import { defaultAnswers, type RestaurantAnswers } from '../src/presets/restaurant/answers.ts';
import { compileRestaurant } from '../src/presets/restaurant/compile.ts';
import { seedAll } from '../src/db/seed.ts';
import { minutesOf } from '../src/domain/time.ts';

// Friday 2 October 2026, 4pm BST.
const NOW = new Date('2026-10-02T15:00:00Z');
const SAT = '2026-10-03';
let db: Db;
let repo: Repo;

before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

async function restaurant(slug: string, edit: (a: RestaurantAnswers) => void = () => {}): Promise<Tenant> {
  const a = defaultAnswers();
  a.basics.name = 'Olive & Ember';
  edit(a);
  return repo.upsertTenant(compileRestaurant(a, { slug }));
}

async function call(tenant: Tenant, callerPhone: string | null = '+447700900123') {
  const actions: Action[] = [];
  const sent: { to: string; body: string }[] = [];
  const ctx: ToolContext = {
    tenant, repo, now: () => NOW, callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone,
    state: newCallState(), demoCards: DEFAULT_DEMO_CARDS, sms: { send: async (to, body) => (sent.push({ to, body }), 'simulated') }, telephony: null,
    action: (x) => actions.push(x),
  };
  return { ctx, actions, sent };
}

test('restaurant tools: only a restaurant is asked about areas, access, allergies and highchairs', async () => {
  const t = await restaurant('tools-decl');
  const props = (name: string, tenant: Tenant) => Object.keys((toolDeclarations(tenant).find((d) => d.name === name)!.parameters as any).properties);
  for (const k of ['area', 'accessible', 'prefer', 'allergies', 'occasion', 'highchairs']) assert.ok(props('create_booking', t).includes(k), k);
  assert.ok(props('check_availability', t).includes('area'));
  assert.ok(!props('check_availability', t).includes('allergies'));
  const [barber] = (await seedAll(repo, NOW, { diary: false })).filter((x) => x.slug === 'fade-and-co');
  assert.ok(!props('create_booking', barber).includes('area'), 'a barber has no seating areas');
  const prompt = compilePrompt(t.profile, { now: NOW, callerPhone: null, knownCustomer: null, demoCards: DEFAULT_DEMO_CARDS, canTransfer: false } as never);
  assert.match(prompt, /inside or terrace/i);
  assert.match(prompt, /allergies or dietary needs/);
  assert.match(prompt, /do not look the allergy up on the menu/, 'a booking records an allergy without a menu lookup');
  assert.match(prompt, /quote it/);
});

test('restaurant tools: inside or on the terrace, and the weather rule', async () => {
  const t = await restaurant('tools-areas');
  const { ctx, sent, actions } = await call(t);
  const both = await runTool('check_availability', { date: SAT, time: '19:30', party_size: 4 }, ctx);
  assert.equal(both.available, true);
  assert.deepEqual(both.areas_free, ['Inside', 'Terrace']);
  assert.match(String(both.next), /inside or terrace/);
  assert.equal((both.slot as any).resource_label, undefined, 'callers do not hear table numbers');

  const booked = await runTool('create_booking', { date: SAT, time: '19:30', party_size: 4, name: 'Sam Price', area: 'outside please', allergies: "Coeliac, quite severe", occasion: 'his birthday' }, ctx);
  assert.equal(booked.booked, true, JSON.stringify(booked));
  assert.equal(booked.area, 'Terrace');
  assert.match(String(booked.weather_note), /inside/i);
  const b = (await repo.getBookingByReference(t.id, String(booked.reference)))!;
  assert.equal(b.area_key, 'terrace');
  assert.equal(b.allergies, 'Coeliac, quite severe');
  assert.deepEqual(b.tags, ['birthday']);
  assert.match(b.notes ?? '', /birthday/i);
  // The text: when, where, the reference and how to change it.
  assert.match(sent[0].body, /^Olive & Ember: Booked: Saturday 3 October 7:30pm, 4 people, terrace\. Ref [A-Z0-9]+\. To change it, call us and quote your reference\./);
  assert.match(actions.find((x) => x.kind === 'booking_created')!.detail ?? '', /ALLERGY: Coeliac/);

  // Fill the terrace at 19:30: the tool offers inside at the same time first.
  for (let i = 0; i < 4; i++) {
    const r = await runTool('create_booking', { date: SAT, time: '19:30', party_size: 4, name: `Terrace ${i}`, area: 'terrace' }, ctx);
    if (!r.booked) break;
  }
  const full = await runTool('check_availability', { date: SAT, time: '19:30', party_size: 4, area: 'terrace' }, ctx);
  assert.equal(full.available, false);
  assert.deepEqual(full.other_areas_free, ['Inside']);
  assert.match(String(full.next), /inside is free at that time/i);
});

test('restaurant tools: a wheelchair gets a step-free table; wishes are kept or noted', async () => {
  const t = await restaurant('tools-access');
  const { ctx } = await call(t);
  const r = await runTool('create_booking', { date: SAT, time: '18:00', party_size: 3, name: 'Priya Shah', accessible: true, highchairs: 5, prefer: 'window' }, ctx);
  assert.equal(r.booked, true, JSON.stringify(r));
  const b = (await repo.getBookingByReference(t.id, String(r.reference)))!;
  const table = t.profile.booking!.resources.find((x) => x.key === b.resource_key)!;
  assert.equal(table.accessible, true);
  assert.ok(b.tags?.includes('wheelchair') && b.tags?.includes('highchair'));
  assert.match(String(r.note), /only have 3 highchairs/);
  assert.match(String(r.note), /window/, 'no step-free window table: noted as a request');
  const w = await runTool('create_booking', { date: SAT, time: '12:30', party_size: 2, name: 'Tom Wright', prefer: 'by the window' }, ctx);
  const wb = (await repo.getBookingByReference(t.id, String(w.reference)))!;
  assert.ok(t.profile.booking!.resources.find((x) => x.key === wb.resource_key)!.features?.includes('window'));
});

test('restaurant tools: a private room is an enquiry; an unknown area says what there is', async () => {
  const t = await restaurant('tools-private', (a) => {
    a.seating.areas.push({ key: 'private', label: 'Private dining room', kind: 'private', reservable: true, enquiry_only: true, weather_rule: null });
    a.seating.tables.push({ key: 'T20', label: 'Table 20', area: 'private', seats: 12, shape: 'rect', x: 0, y: 0, rotation: 0, accessible: false, walk_in: false, features: [], joins: [] });
  });
  const { ctx } = await call(t);
  const r = await runTool('check_availability', { date: SAT, time: '19:00', party_size: 12, area: 'the private room' }, ctx);
  assert.equal(r.available, false);
  assert.match(String(r.message), /take_message/);
  const u = await runTool('create_booking', { date: SAT, time: '19:00', party_size: 2, name: 'X', area: 'the roof' }, ctx);
  assert.equal(u.booked, false);
  assert.match(String(u.message), /Areas: Inside, Terrace, Private dining room/);
});

test('restaurant tools: changes by reference keep the table when it fits, with a new text', async () => {
  const t = await restaurant('tools-change');
  const { ctx, sent } = await call(t);
  const r = await runTool('create_booking', { date: SAT, time: '19:00', party_size: 2, name: 'Grace Wood' }, ctx);
  const before = (await repo.getBookingByReference(t.id, String(r.reference)))!;
  const later = await runTool('modify_booking', { reference: String(r.reference).toLowerCase(), time: '19:30' }, ctx);
  assert.equal(later.changed, true, JSON.stringify(later));
  const after1 = (await repo.getBookingByReference(t.id, String(r.reference)))!;
  assert.equal(after1.resource_key, before.resource_key, 'same table, half an hour later');
  const bigger = await runTool('modify_booking', { reference: String(r.reference), party_size: 5, allergies: 'Nut allergy' }, ctx);
  assert.equal(bigger.changed, true);
  const after2 = (await repo.getBookingByReference(t.id, String(r.reference)))!;
  assert.ok((t.profile.booking!.resources.find((x) => x.key === after2.resource_key)!.capacity ?? 0) >= 5, 'a table for five');
  assert.equal(after2.allergies, 'Nut allergy');
  assert.match(sent.at(-1)!.body, /^Olive & Ember: Changed: Saturday 3 October 7:30pm, 5 people, inside\. Ref .* quote your reference/);
  const found = await runTool('find_bookings', { reference: String(r.reference) }, ctx);
  assert.equal((found.bookings as any[])[0].party_size, 5);
  assert.equal((found.bookings as any[])[0].allergies, 'Nut allergy');
});

test('restaurant tools: collection slots the kitchen can handle, and pay on collection', async () => {
  const t = await restaurant('tools-slots', (a) => {
    a.serve.collection = { enabled: true, prep_minutes: 20, slot_minutes: 15, per_slot: 1, evenings_only: true };
    a.money.takeaway_payment = 'collection';
  });
  const order = async (time: string) => {
    const { ctx, sent } = await call(t);
    const item = t.profile.menu!.categories[0].items[0];
    await runTool('add_to_order', { item: item.name, quantity: 1 }, ctx);
    const f = await runTool('set_fulfilment', { type: 'collection', time }, ctx);
    return { ctx, sent, f };
  };
  const first = await order('19:10');
  assert.equal(first.f.ok, true, JSON.stringify(first.f));
  assert.equal(first.f.time, '19:15', 'on the 15-minute grid');
  const review = await runTool('review_order', {}, first.ctx);
  assert.match(String(review.payment), /Payment is on collection/);
  const placed = await runTool('confirm_order', { name: 'Ben Walker' }, first.ctx);
  assert.equal(placed.placed, true);
  assert.match(String(placed.payment), /do not take a card/);
  assert.match(first.sent.at(-1)!.body, /Pay when you collect\. Quote \d+ if you call us/);
  const pay = await runTool('take_demo_payment', { card_number: DEFAULT_DEMO_CARDS[0].number }, first.ctx);
  assert.equal(pay.result, 'not_needed');

  // The 7:15 slot now has its one order: the next caller is offered the next ones.
  const second = await order('19:15');
  assert.equal(second.f.ok, false);
  assert.match(String(second.f.message), /full at 7:15pm\. 7:30pm, 7:45pm, 8pm have room/);
  const asap = await order('asap');
  assert.equal(asap.f.ok, true);
});

test('restaurant tools: an allergy the caller mentioned is never dropped', async () => {
  assert.equal(mentionedAllergy(['Table for four please.', 'My son is coeliac, so no gluten at all.']), 'My son is coeliac, so no gluten at all.');
  assert.equal(mentionedAllergy(['No allergies, thanks.']), null);
  assert.equal(mentionedAllergy(['Saturday at seven, please.']), null);
  const t = await restaurant('tools-allergy');
  const { ctx } = await call(t);
  ctx.state.heard.push('Hi, a table for two on Saturday at eight.', 'My wife has a severe nut allergy.');
  const first = await runTool('create_booking', { date: SAT, time: '20:00', party_size: 2, name: 'Joe Doyle' }, ctx);
  assert.equal(first.booked, false);
  assert.match(String(first.message), /severe nut allergy.*allergies/);
  const second = await runTool('create_booking', { date: SAT, time: '20:00', party_size: 2, name: 'Joe Doyle', allergies: 'Severe nut allergy (wife)' }, ctx);
  assert.equal(second.booked, true);
  assert.equal((await repo.getBookingByReference(t.id, String(second.reference)))!.allergies, 'Severe nut allergy (wife)');
  // Asked once per call: "none" is accepted and stored as no allergy.
  const other = await call(t);
  other.ctx.state.heard.push('Do you do gluten-free pizza?');
  assert.equal((await runTool('create_booking', { date: SAT, time: '20:00', party_size: 2, name: 'Amy Hall' }, other.ctx)).booked, false);
  const none = await runTool('create_booking', { date: SAT, time: '20:00', party_size: 2, name: 'Amy Hall', allergies: 'none' }, other.ctx);
  assert.equal(none.booked, true);
  assert.equal((await repo.getBookingByReference(t.id, String(none.reference)))!.allergies, null);
});

// From a call on 1 October: no name was taken, the name could not be changed,
// "table 4" could not be checked, and "dairy" was looked up as a dish.

test('restaurant tools: a booking needs a real name, and the name and number can be changed later', async () => {
  const t = await restaurant('tools-names');
  const { ctx, sent } = await call(t);
  for (const stand_in of ['Caller', 'the caller', 'guest', 'N/A', '']) {
    const r = await runTool('create_booking', { date: SAT, time: '12:30', party_size: 2, name: stand_in, allergies: 'none' }, ctx);
    assert.equal(r.booked, false, stand_in);
    assert.match(String(r.message), /caller's name/);
  }
  const booked = await runTool('create_booking', { date: SAT, time: '12:30', party_size: 2, name: 'Pat', allergies: 'none' }, ctx);
  assert.equal(booked.booked, true, JSON.stringify(booked));

  // Today, twenty minutes from now: inside the notice period, so a move would be refused, but a new name is not a move.
  const soon = await repo.createBooking(t, { date: '2026-10-02', time: '16:15', party_size: 2, name: 'Caller', phone: '+447700900123', source: 'eval', ignoreLead: true, allergies: null }, NOW);
  assert.ok(soon.ok);
  const renamed = await runTool('modify_booking', { reference: soon.ok ? soon.booking.reference : '', name: 'Alex Cohen' }, ctx);
  assert.equal(renamed.changed, true, JSON.stringify(renamed));
  assert.equal(renamed.name, 'Alex Cohen');
  const b = (await repo.getBookingByReference(t.id, soon.ok ? soon.booking.reference : ''))!;
  assert.equal(b.name, 'Alex Cohen');
  assert.match(b.history?.at(-1)?.what ?? '', /name Caller → Alex Cohen/);
  assert.match(sent.at(-1)!.body, /^Olive & Ember: Changed:/);

  const renumbered = await runTool('modify_booking', { reference: b.reference, phone: '07700 900456' }, ctx);
  assert.equal(renumbered.changed, true);
  assert.equal((await repo.getBookingByReference(t.id, b.reference))!.phone, '+447700900456');
  assert.equal((await runTool('modify_booking', { reference: b.reference, phone: 'twelve' }, ctx)).changed, false);
  assert.equal((await runTool('modify_booking', { reference: b.reference, name: 'caller' }, ctx)).changed, false);
});

test('restaurant tools: a particular table by number, and the one kept for walk-ins', async () => {
  const t = await restaurant('tools-table', (a) => void (a.seating.tables.find((x) => x.key === 'T4')!.walk_in = true));
  const { ctx } = await call(t);
  const walkIn = await runTool('check_availability', { date: SAT, time: '13:00', party_size: 2, table: 'table four' }, ctx);
  assert.equal(walkIn.available, false);
  assert.match(String(walkIn.message), /Table 4 is kept for walk-ins/);
  const small = await runTool('check_availability', { date: SAT, time: '13:00', party_size: 5, table: '2' }, ctx);
  assert.match(String(small.message), /Table 2 seats 2, not 5/);
  assert.match(String((await runTool('check_availability', { date: SAT, party_size: 2, table: '99' }, ctx)).message), /no table "99"/);

  const five = await runTool('check_availability', { date: SAT, party_size: 2, table: 'T5' }, ctx);
  assert.equal(five.table, 'Table 5');
  assert.ok((five.available_ranges as string[]).length, 'how busy that table is: its free times that day');
  const at = await runTool('check_availability', { date: SAT, time: '13:00', party_size: 2, table: 'five' }, ctx);
  assert.equal(at.available, true);
  assert.equal((at.slot as any).resource_label, 'Table 5', 'they asked for it by number, so they hear it');
  assert.equal(at.next, undefined, 'no "inside or terrace?" once they have chosen a table');
  const booked = await runTool('create_booking', { date: SAT, time: '13:00', party_size: 2, name: 'Pat', table: '5', allergies: 'none' }, ctx);
  assert.equal(booked.booked, true);
  assert.equal(booked.table, 'Table 5');
  const again = await runTool('create_booking', { date: SAT, time: '13:00', party_size: 2, name: 'Sam', table: '5', allergies: 'none' }, ctx);
  assert.equal(again.booked, false, 'that table is now taken at 1pm');
});

test('restaurant tools: a saved allergy always says what it is', () => {
  const heard = ['A table for two on Sunday, please.', 'Yes, one of us has a dairy allergy.'];
  assert.equal(namedAllergy('Intolerance, not anaphylactic.', heard), 'Dairy: intolerance, not anaphylactic.');
  assert.equal(namedAllergy('Severe nut allergy', heard), 'Severe nut allergy', 'already says what it is');
  assert.equal(namedAllergy('Vegan', heard), 'Vegan');
  assert.equal(namedAllergy('Quite severe', ['No allergies here.']), 'Quite severe', 'nothing to add from');
  assert.equal(namedAllergy(undefined, heard), undefined);
});

test('restaurant tools: dairy is milk, and the menu can say which dishes are made without it', async () => {
  const t = await restaurant('tools-dairy');
  const { ctx } = await call(t);
  const asDish = await runTool('get_item_details', { item: 'dairy' }, ctx);
  assert.equal(asDish.found, false);
  assert.match(String(asDish.message), /allergy \(milk\), not a dish.*record it as the allergy/);
  const free = await runTool('get_menu', { free_from: 'dairy' }, ctx);
  assert.deepEqual(free.free_from, ['milk']);
  const menu = t.profile.menu!;
  const withMilk = menu.categories.flatMap((c) => c.items).filter((i) => i.allergens.includes('milk')).map((i) => i.name);
  assert.ok(withMilk.length, 'the default menu has dishes with milk');
  const listed = (free.dishes as { name: string }[]).map((d) => d.name);
  assert.ok(listed.length && listed.every((n) => !withMilk.includes(n)), 'no dish with milk is listed');
  assert.match(String(free.say), /Never say a dish is safe/);
  assert.match(String((await runTool('get_menu', { free_from: 'kiwi' }, ctx)).message), /not one of the 14 allergens/);
});

test('restaurant tools: a full lunch is fully booked, not closed', async () => {
  const t = await restaurant('tools-full-lunch');
  const { ctx } = await call(t);
  // Fill Saturday lunch for two: every start time, until nothing more fits.
  const svc = t.profile.booking!.services[0];
  const lunch = svc.windows.find((w) => w.days.includes(6) && w.first < '15:00')!;
  for (let m = minutesOf(lunch.first); m <= minutesOf(lunch.last); m += svc.slot_minutes) {
    const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    for (let i = 0; i < 30; i++) {
      const r = await repo.createBooking(t, { date: SAT, time, party_size: 2, name: 'Lunch filler', source: 'eval', allergies: null }, NOW);
      if (!r.ok) break;
    }
  }
  const day = await runTool('check_availability', { date: SAT, party_size: 2 }, ctx);
  assert.equal(day.available, true, 'dinner is still free');
  assert.deepEqual(day.fully_booked, ['lunch']);
  assert.match(String(day.fully_booked_note), /Fully booked, not closed: lunch\. .*never that you are closed/);
  const later = await runTool('check_availability', { date: SAT, time: lunch.first, party_size: 2 }, ctx);
  assert.equal(later.available, false);
  assert.ok((later.alternatives as unknown[]).length || (later.available_ranges as string[]).length, 'something to offer instead');
});
