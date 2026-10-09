// The barber's shop floor (presets/barber.md §4.2 and §5, milestone 2): who
// is off today, the walk-in queue and the wait now, the waiting list, and
// the skin test 48 hours before colour; stored, read back, and cleared by
// Reset.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { checkUtterance } from '../src/core/guardrails.ts';
import { newCallState, runTool, type ToolContext } from '../src/core/tools.ts';
import { checkAvailability } from '../src/domain/availability.ts';
import type { Tenant } from '../src/domain/types.ts';
import { profileOn, skinTestFor, waitNow, type ShopToday } from '../src/domain/shop-floor.ts';
import { defaultAnswers } from '../src/presets/barber/answers.ts';
import { compileBarber } from '../src/presets/barber/compile.ts';
import { BB_PEOPLE } from '../src/presets/barber/personas.ts';
import { sanitiseBarber } from '../src/presets/barber/sanitise.ts';
import { planBarberSeed } from '../src/presets/barber/seed.ts';

/** Thursday 15 October 2026, 11am BST. */
const THURSDAY = new Date('2026-10-15T10:00:00Z');
const H = 3600000;
let db: Db;
let repo: Repo;
before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

const profile = () => {
  const a = defaultAnswers();
  a.basics.name = "Kingsley's Barbers";
  return compileBarber(sanitiseBarber(a), { slug: 'kingsleys-floor' });
};

test('shop floor: today, the walk-ins, the waiting list and skin tests are kept, and Reset clears them', async () => {
  const t = await repo.upsertTenant(profile());
  assert.deepEqual(await repo.getToday(t.id, '2026-10-15'), { date: '2026-10-15', off: [], notice: null });
  await repo.setToday(t.id, { date: '2026-10-15', off: ['dan'], notice: 'Card machine down: cash only today.' });
  assert.deepEqual((await repo.getToday(t.id, '2026-10-15')).off, ['dan']);
  assert.deepEqual(await repo.getToday(t.id, '2026-10-16'), { date: '2026-10-16', off: [], notice: null }, "yesterday's switch is gone the next day");

  const first = await repo.addWalkIn(t.id, { name: 'Kai', phone: null, service_key: 'skin_fade', resource_key: null, source: 'console', joined_at: new Date(THURSDAY.getTime() - 20 * 60000) });
  await repo.addWalkIn(t.id, { name: 'Leo', phone: '+447700900970', service_key: 'classic_cut', resource_key: 'marcus', source: 'console', joined_at: THURSDAY });
  assert.deepEqual((await repo.listWaitingWalkIns(t.id)).map((w) => [w.name, w.resource_key]), [['Kai', null], ['Leo', 'marcus']]);
  assert.ok(await repo.closeWalkIn(t.id, first.id, { left_at: THURSDAY }));
  assert.equal(await repo.closeWalkIn(t.id, first.id, { left_at: THURSDAY }), null, 'gone once');
  assert.deepEqual((await repo.listWaitingWalkIns(t.id)).map((w) => w.name), ['Leo']);

  const w = await repo.addToWaitlist(t.id, { date: '2026-10-17', service_key: 'skin_fade', resource_key: 'marcus', name: 'Sam', phone: '+447700900971', source: 'phone' });
  await repo.addToWaitlist(t.id, { date: '2026-10-14', service_key: 'classic_cut', resource_key: null, name: 'Old', phone: null, source: 'phone' });
  assert.deepEqual((await repo.listWaitlist(t.id, '2026-10-15')).map((e) => [e.name, e.date]), [['Sam', '2026-10-17']], 'from today on');
  await repo.markWaitlistNotified(t.id, w.id, THURSDAY);
  assert.deepEqual((await repo.listWaitlist(t.id, '2026-10-15'))[0].notified_at, THURSDAY);
  assert.equal(await repo.removeFromWaitlist(t.id, w.id), true);
  assert.equal((await repo.listWaitlist(t.id, '2026-10-15')).length, 0);

  assert.equal(await repo.getSkinTest(t.id, '+447700900971'), null);
  await repo.setSkinTest(t.id, '+447700900971', 'Sam', new Date(THURSDAY.getTime() - 50 * H));
  assert.deepEqual(await repo.getSkinTest(t.id, '+447700900971'), new Date(THURSDAY.getTime() - 50 * H));

  await repo.resetTenantData(t.id);
  assert.equal((await repo.listWaitingWalkIns(t.id)).length, 0);
  assert.equal((await repo.listWaitlist(t.id, '2026-01-01')).length, 0);
  assert.deepEqual((await repo.getToday(t.id, '2026-10-15')).off, []);
  assert.equal(await repo.getSkinTest(t.id, '+447700900971'), null);
});

test("shop floor: a barber off today isn't booked today, and is the next week", () => {
  const p = profile();
  const today: ShopToday = { date: '2026-10-15', off: ['dan'], notice: null };
  const ask = (date: string, staff?: string) => checkAvailability({ profile: profileOn(p, date, today), serviceKey: 'classic_cut', date, time: '14:00', partySize: 1, staff, now: THURSDAY, existing: [] });
  assert.equal(ask('2026-10-15', 'dan').available, false);
  assert.notEqual(ask('2026-10-15').slot?.resource_key, 'dan');
  assert.equal(ask('2026-10-22', 'dan').available, true, 'next Thursday he is in');
  assert.equal(profileOn(p, '2026-10-22', today), p);
});

test('shop floor: the wait now counts who is in the chair and the walk-ins ahead, and never a barber off', () => {
  const p = profile();
  const today: ShopToday = { date: '2026-10-15', off: [], notice: null };
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 15, h - 1, m));
  // Marcus has a cut in the chair till 11:30; two walk-ins wait for anyone.
  const existing = [{ resource_key: 'marcus', starts_at: at(11), ends_at: at(11, 30) }];
  const queue = ['Kai', 'Leo'].map((name, i) => ({ id: String(i), tenant_id: 't', name, phone: null, service_key: 'classic_cut', resource_key: null, joined_at: THURSDAY, served_at: null, booking_id: null, left_at: null, source: 'console' }));
  const wait = waitNow({ profile: p, now: THURSDAY, date: '2026-10-15', nowMinutes: 11 * 60, serviceKey: 'classic_cut', existing, queue, today });
  assert.deepEqual(wait.map((x) => [x.with, x.free_at, x.minutes]), [['Marcus', '11:30', 30], ['Dan', '11:30', 30], ['Jordan', '11:30', 30]].sort((a, b) => String(a[1]).localeCompare(String(b[1]))));
  const off = waitNow({ profile: p, now: THURSDAY, date: '2026-10-15', nowMinutes: 11 * 60, serviceKey: 'classic_cut', existing: [], queue: [], today: { ...today, off: ['dan'] } });
  assert.deepEqual(off.map((x) => [x.with, x.minutes]), [['Marcus', 0], ['Jordan', 0]], 'Amira works Friday and Saturday; Dan is off');
});

test('shop floor: colour needs a skin test here 48 hours before; every time since the last colour, or within six months', () => {
  const start = new Date('2026-10-16T13:00:00Z');
  const before = (h: number) => new Date(start.getTime() - h * H);
  assert.deepEqual(skinTestFor('every_time', start, [before(72)], null), { ok: true, test: before(72) });
  assert.deepEqual(skinTestFor('every_time', start, [before(24)], null), { ok: false, earliest: new Date(before(24).getTime() + 48 * H) }, 'too close: the colour moves');
  assert.deepEqual(skinTestFor('every_time', start, [], null), { ok: false, earliest: null });
  assert.equal(skinTestFor('every_time', start, [before(24 * 40)], before(24 * 10)).ok, false, 'used by the last colour');
  assert.equal(skinTestFor('six_months', start, [before(24 * 40)], before(24 * 10)).ok, true, 'good for six months');
  assert.equal(skinTestFor('six_months', start, [before(24 * 200)], null).ok, false);
});

// ── On a call ─────────────────────────────────────────────────────────────

async function call(tenant: Tenant, callerPhone: string, sent: { to: string; body: string }[] = [], now = THURSDAY) {
  const ctx: ToolContext = {
    tenant, repo, now: () => now, callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone,
    state: newCallState(), demoCards: [], sms: { send: async (to: string, body: string) => (sent.push({ to, body }), 'simulated') }, telephony: null, action: () => {},
  };
  return { ctx, run: (name: string, args: Record<string, unknown>) => runTool(name, args, ctx) as Promise<any> };
}
const fresh = async (slug: string) => repo.upsertTenant(compileBarber(sanitiseBarber({ ...defaultAnswers(), basics: { ...defaultAnswers().basics, name: "Kingsley's Barbers" } }), { slug }));

test("on a call: Dan off today is off, never why; his booking today needs a new time; the next Thursday he's in", async () => {
  const t = await fresh('kingsleys-off');
  const c = await call(t, '+447700900980');
  const dans = await c.run('create_booking', { service: 'Classic cut', staff: 'Dan', date: '2026-10-15', time: '15:00', name: 'Ali Khan' });
  assert.equal(dans.booked, true);
  await repo.setToday(t.id, { date: '2026-10-15', off: ['dan'], notice: null });
  const ask = await c.run('check_availability', { service: 'Classic cut', staff: 'Danny', date: '2026-10-15', time: '16:00' });
  assert.deepEqual([ask.available, ask.reason, ask.message], [false, 'off_today', "Dan's off today. Say just that, never why. In today: Marcus, Jordan; offer them, or Dan on another day."]);
  assert.notEqual((await c.run('check_availability', { service: 'Classic cut', date: '2026-10-15', time: '16:00' })).slot?.resource_label, 'Dan');
  assert.equal((await c.run('create_booking', { service: 'Classic cut', staff: 'Dan', date: '2026-10-15', time: '16:00', name: 'Ali Khan' })).reason, 'off_today');
  assert.equal((await c.run('check_availability', { service: 'Classic cut', staff: 'Dan', date: '2026-10-22', time: '16:00' })).available, true);
  const found = await c.run('find_bookings', { reference: dans.reference });
  assert.match(found.note, new RegExp(`^Dan is off today, so ${dans.reference} needs a new time\\. Say Dan's off today, never why`));
});

test('on a call: colour only 48 hours after a skin test here, booked first; every time since the last colour', async () => {
  const t = await fresh('kingsleys-skin');
  const c = await call(t, '+447700900981');
  const none = await c.run('create_booking', { service: 'Beard colour', date: '2026-10-16', time: '11:00', name: 'Sam Lee' });
  assert.deepEqual([none.booked, none.reason], [false, 'skin_test_needed']);
  assert.match(none.message, /Book the skin test now \(service "Skin test": 10 minutes, free\), then the colour at least 48 hours after it\. Offer no colour times until the test is booked: check_availability gives them then\. The dye maker says/);
  const test1 = await c.run('create_booking', { service: 'Skin test', date: '2026-10-15', time: '12:00', name: 'Sam Lee' });
  assert.deepEqual([test1.booked, test1.with], [true, 'Marcus'], 'whoever does colour does the test');
  const soon = await c.run('check_availability', { service: 'Beard colour', date: '2026-10-16', time: '11:00' });
  assert.deepEqual([soon.available, soon.reason], [false, 'skin_test_too_close']);
  assert.match(soon.message, /The colour can be from Saturday 17 October at 12 noon/);
  const colour = await c.run('create_booking', { service: 'Beard colour', date: '2026-10-17', time: '13:00', name: 'Sam Lee' });
  assert.equal(colour.booked, true, colour.message);
  assert.equal((await c.run('create_booking', { service: 'Beard colour', date: '2026-10-24', time: '13:00', name: 'Sam Lee' })).reason, 'skin_test_needed', 'every time: the last colour used it');
});

test('on a call: the wait now, the waiting list texted when a slot comes up, and running late', async () => {
  const t = await fresh('kingsleys-wait');
  const sent: { to: string; body: string }[] = [];
  const c = await call(t, '+447700900982', sent);
  const wait = await c.run('get_wait_now', { service: 'Skin fade' });
  assert.deepEqual([wait.waiting_now, wait.soonest[0]], [0, { with: 'Marcus', from: '11am', minutes: 0 }]);
  assert.match(wait.next, /^Say Marcus is free now, as an estimate, and that only a booking holds a chair\./);
  await repo.setToday(t.id, { date: '2026-10-15', off: ['dan'], notice: null });
  assert.equal((await c.run('get_wait_now', { staff: 'Dan' })).reason, 'off_today');

  // Saturday's waiting list: Kim wants Marcus for a skin fade; a cut with Marcus is cancelled; Kim hears.
  const kim = await call(t, '+447700900983', sent);
  const joined = await kim.run('join_waiting_list', { date: '2026-10-17', service: 'Skin fade', staff: 'Marcus', name: 'Kim Patel' });
  assert.equal(joined.message, "On the waiting list for Saturday 17 October, skin fade with Marcus. Tell them it isn't a booking: if a slot comes up they'll get a text, and the first to call gets it.");
  await kim.run('join_waiting_list', { date: '2026-10-17', service: 'Skin fade', staff: 'Marcus', name: 'Kim Patel' });
  assert.equal((await repo.listWaitlist(t.id, '2026-10-17')).length, 1, 'once');
  const cut = await c.run('create_booking', { service: 'Cut and beard', staff: 'Marcus', date: '2026-10-17', time: '10:00', name: 'Joe Bloggs' });
  await c.run('end_call', { outcome: 'booked' });
  sent.length = 0;
  const c2 = await call(t, '+447700900982', sent);
  assert.equal((await c2.run('cancel_booking', { reference: cut.reference })).cancelled, true);
  assert.deepEqual(sent.find((x) => x.to === '+447700900983')?.body, "Kingsley's Barbers: a slot's come up on Saturday 17 October at 10am with Marcus, for your skin fade. Call us to book it: the first to call gets it. (Demo)");
  assert.ok((await repo.listWaitlist(t.id, '2026-10-17'))[0].notified_at);

  // Running late today: 5 minutes is within the shop's 10; 25 runs into Marcus's next.
  const mine = await c2.run('create_booking', { service: 'Classic cut', staff: 'Marcus', date: '2026-10-15', time: '12:00', name: 'Joe Bloggs' });
  await c2.run('create_booking', { service: 'Classic cut', staff: 'Marcus', date: '2026-10-15', time: '12:30', name: 'Ann Next', phone: '07700 900984' });
  assert.deepEqual(await c2.run('running_late', { reference: mine.reference, minutes: 5 }), { noted: true, kept: true, minutes: 5, message: "Kept: within the shop's 10 minutes. Tell them that's fine, and Marcus knows." });
  const late = await c2.run('running_late', { reference: mine.reference, minutes: 25, note: 'Stuck on the tram' });
  assert.equal(late.kept, false);
  assert.match(late.message, /^Later than the shop's 10 minutes, and Marcus has someone at 12:30pm, so Marcus may only fit a shorter classic cut\./);
  assert.deepEqual(((await repo.getBookingByReference(t.id, mine.reference))!.details as any).late, { minutes: 25, note: 'Stuck on the tram', at: THURSDAY.toISOString() });
});

test("the seed: Priya booked later today, someone already running late, Ben's skin test, two walk-ins if open, Saturday's waiting list", async () => {
  const p = profile();
  const plan = planBarberSeed(p, THURSDAY, 1);
  const priya = plan.bookings.find((b) => b.phone === BB_PEOPLE.late.phone)!;
  assert.ok(priya.starts_at.getTime() >= THURSDAY.getTime() + 30 * 60000 && priya.starts_at.getTime() < THURSDAY.getTime() + 4 * H, `Priya at ${priya.starts_at.toISOString()}`);
  const late = plan.bookings.filter((b) => (b.details as any)?.late);
  assert.equal(late.length, 1);
  assert.deepEqual((late[0].details as any).late.minutes, 10);
  const ben = plan.bookings.find((b) => b.phone === BB_PEOPLE.tested.phone)!;
  assert.deepEqual([ben.service_key, ben.visit_status], ['skin_test', 'finished']);
  assert.deepEqual(plan.skinTests, [{ ...BB_PEOPLE.tested, at: ben.starts_at }]);
  assert.ok(THURSDAY.getTime() - ben.starts_at.getTime() >= 48 * H, 'two days or more ago');
  assert.deepEqual(plan.walkins!.map((w) => [w.service_key, w.resource_key]), [['classic_cut', null], ['skin_fade', 'marcus']]);
  assert.deepEqual(plan.waitlist!.map((e) => [e.date, e.service_key]), [['2026-10-17', 'skin_fade'], ['2026-10-17', 'classic_cut']]);
  assert.ok(!plan.bookings.some((b) => b.phone === BB_PEOPLE.colour.phone), 'Femi has nothing booked');
  assert.equal(planBarberSeed(p, new Date('2026-10-18T18:00:00Z'), 1).walkins!.length, 0, 'Sunday evening, closed: no one waiting');
  // Written and read back.
  const t = await repo.upsertTenant(compileBarber(sanitiseBarber({ ...defaultAnswers(), basics: { ...defaultAnswers().basics, name: "Kingsley's Barbers" } }), { slug: 'kingsleys-seed' }));
  await repo.insertSeed(t.id, plan);
  assert.equal((await repo.listWaitingWalkIns(t.id)).length, 2);
  assert.equal((await repo.listWaitlist(t.id, '2026-10-15')).length, 2);
  assert.deepEqual(await repo.getSkinTest(t.id, BB_PEOPLE.tested.phone), ben.starts_at);
});

test("on a call: a time no tool gave is flagged, and a booking found today says how to note running late", async () => {
  // A live call, 9 October: "Dan has time at quarter past two or quarter past four", with nothing checked.
  const t = await fresh('kingsleys-guard');
  const c = await call(t, BB_PEOPLE.late.phone);
  c.ctx.state.barber = true;
  assert.deepEqual(checkUtterance('Okay, Dan has time at quarter past two or quarter past four.', c.ctx.state).map((f) => f.rule), ['invented_time']);
  const free = await c.run('check_availability', { service: 'Classic cut', staff: 'Jordan', date: '2026-10-15', time: '13:45' });
  assert.equal(free.available, true);
  assert.deepEqual(checkUtterance('Jordan has a quarter to two.', c.ctx.state), [], 'a time the tool gave');
  // Priya's booking today, found: the next step names the tool.
  const mine = await c.run('create_booking', { service: 'Classic cut', staff: 'Marcus', date: '2026-10-15', time: '14:15', name: 'Priya Shah' });
  const found = await c.run('find_bookings', { reference: mine.reference });
  assert.equal(found.next, `If they're running late for ${mine.reference}, call running_late with it and the minutes, and say what it returns: nothing is noted for the barber until it does.`);
});

test('on a call: who else is free at that time, colour offered only from 48 hours after the test, the caller\'s own booking only, and running late passes it on', async () => {
  const t = await fresh('kingsleys-fixes');
  const c = await call(t, BB_PEOPLE.late.phone);
  // Two kids and their dad at 10 on Saturday: Marcus, and Dan and Jordan free then too.
  const kids = await c.run('check_availability', { service: "Kids' cut", date: '2026-10-17', time: '10:00' });
  assert.deepEqual([kids.with, kids.also_free_then], ['Marcus', ['Dan', 'Jordan']]);
  // Coming in now is the walk-in's question.
  assert.equal((await c.run('check_availability', { service: 'Skin fade', date: '2026-10-15', time: '11:20' })).walk_in, 'If they mean coming in now, get_wait_now gives the walk-in wait.');
  // A skin test today at noon: Saturday's colour times start at noon, not at 8.
  await c.run('create_booking', { service: 'Skin test', date: '2026-10-15', time: '12:00', name: 'Priya Shah' });
  const sat = await c.run('check_availability', { service: 'Beard colour', date: '2026-10-17' });
  assert.equal(sat.colour_from, 'Colour only from Saturday 17 October at 12 noon, 48 hours after their skin test.');
  assert.ok(!/^8am/.test(sat.available_ranges[0]), sat.available_ranges.join(', '));
  // Another Priya booked today, and Priya Shah's own: only hers, by name, from her number.
  const other = await call(t, '+447700900990');
  await other.run('create_booking', { service: 'Kids\' cut', date: '2026-10-15', time: '12:30', name: 'Priya Jones' });
  const mine = await c.run('create_booking', { service: 'Classic cut', date: '2026-10-15', time: '14:15', name: 'Priya Shah' });
  const found = await c.run('find_bookings', { name: 'Priya' });
  assert.deepEqual(found.bookings.map((b: any) => b.reference).sort(), [mine.reference, ...found.bookings.filter((b: any) => b.service === 'Skin test').map((b: any) => b.reference)].sort());
  assert.ok(!found.bookings.some((b: any) => b.name === 'Priya Jones'), "another customer's booking is never read out");
  assert.equal((await c.run('running_late', { reference: mine.reference, minutes: 5 })).noted, true);
  assert.equal(c.ctx.state.messageTaken, true, '"passed on" is true');
});
