// The barber preset (presets/barber.md, milestone 1): the defaults compiled
// into barbers and a price list, the builder's checks, a barber's own hours
// and nicknames, the deposit and the notice on cancelling and moving, and
// the seeded week.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { checkAvailability } from '../src/domain/availability.ts';
import { newCallState, runTool, type ToolContext } from '../src/core/tools.ts';
import type { Tenant } from '../src/domain/types.ts';
import { defaultAnswers, type BarberAnswers } from '../src/presets/barber/answers.ts';
import { compileBarber } from '../src/presets/barber/compile.ts';
import { BB_PEOPLE } from '../src/presets/barber/personas.ts';
import { sanitiseBarber } from '../src/presets/barber/sanitise.ts';
import { planBarberSeed } from '../src/presets/barber/seed.ts';
import { validateBarber } from '../src/presets/barber/validate.ts';

/** Thursday 15 October 2026, 11am BST. */
const THURSDAY = new Date('2026-10-15T10:00:00Z');
let db: Db;
let repo: Repo;
before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

const named = (edit?: (a: BarberAnswers) => void) => {
  const a = defaultAnswers();
  a.basics.name = "Kingsley's Barbers";
  edit?.(a);
  return sanitiseBarber(a);
};
const profile = (edit?: (a: BarberAnswers) => void) => compileBarber(named(edit), { slug: 'kingsleys' });

async function call(tenant: Tenant, callerPhone: string, now = THURSDAY) {
  const ctx: ToolContext = {
    tenant, repo, now: () => now, callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone,
    state: newCallState(), demoCards: [], sms: { send: async () => 'simulated' }, telephony: null, action: () => {},
  };
  return { ctx, run: (name: string, args: Record<string, unknown>) => runTool(name, args, ctx) as Promise<any> };
}

test('barber: the defaults are four barbers in Nottingham city centre and a price list, with nothing to fix', () => {
  const a = named();
  assert.deepEqual(validateBarber(a), []);
  const p = compileBarber(a, { slug: 'kingsleys' });
  assert.equal(p.business_type, 'barber');
  assert.match(p.core_facts[0], /^Kingsley's Barbers: .*, at 22 Hockley Row \(example\), Nottingham NG1\.$/);
  assert.deepEqual(p.booking!.resources.map((r) => [r.label, r.days, r.aliases ?? [], r.hours ?? []]), [
    ['Marcus', [0, 2, 3, 4, 5, 6], ['Marc'], []],
    ['Dan', [2, 3, 4, 5, 6], ['Danny'], []],
    ['Jordan', [2, 3, 4, 5, 6], [], [{ day: 4, open: '09:00', close: '18:00' }]],
    ['Amira', [5, 6], [], []],
  ]);
  assert.deepEqual(p.booking!.services.map((s) => [s.key, s.duration_minutes, s.price_pence, s.deposit?.flat_pence]).slice(0, 3), [['classic_cut', 30, 1800, 500], ['skin_fade', 45, 2200, 500], ['cut_and_beard', 50, 2800, 500]]);
  assert.deepEqual(p.barber, { notice_hours: 24, deposit_required: false, late_grace_minutes: 10, group_max: 4, walk_ins: true, kids_under: 12, under_16_with_adult: true, skin_test: 'every_time' });
  assert.equal(p.knowledge!.find((k) => k.q === "Do you cut women's hair?")!.a, 'Yes: the same services at the same prices as anyone, a short back and sides or a fade included.');
  assert.match(p.core_facts.join(' '), /Free to cancel or move with 24 hours' notice; later than that, the deposit is kept\./);
});

test('barber: cleaning keeps a barber to services that exist, and the builder says what is missing', () => {
  const a = sanitiseBarber({ team: [{ name: 'Lee', days: [1, 9, 'x'], services: ['skin_fade', 'perm'], hours: [{ day: 3, open: '10:00', close: '16:00' }] }], services: [{ name: 'Skin fade', minutes: 45, price_pence: 2200 }, { name: '' }] });
  assert.deepEqual([a.team[0].key, a.team[0].days, a.team[0].services, a.team[0].hours], ['lee', [1], ['skin_fade'], []], 'hours only on their days');
  const issues = validateBarber(a).map((i) => `${i.step}: ${i.message}`);
  assert.ok(issues.includes('services: Every service needs a name.'), issues.join('\n'));
  assert.ok(issues.includes("team: Lee works Monday, when the shop is closed."), issues.join('\n'));
  assert.deepEqual(sanitiseBarber({ team: [] }).team, [], 'an empty list is the owner\'s');
  assert.equal(sanitiseBarber(null).team.length, 4, 'nothing saved takes the defaults');
});

test("barber: a barber's own hours, a nickname, and a barber who doesn't work there", () => {
  const p = profile();
  const ask = (staff: string, date: string, time: string) => checkAvailability({ profile: p, serviceKey: 'classic_cut', date, time, partySize: 1, staff, now: THURSDAY, existing: [] });
  const jordan = ask('jordan', '2026-10-15', '18:30');
  assert.equal(jordan.available, false, 'Jordan finishes at 6 on Thursdays');
  assert.deepEqual(jordan.alternatives.map((x) => x.time).slice(-1), ['17:30']);
  assert.equal(ask('Marcus', '2026-10-15', '18:30').available, true, 'the shop is open till 8');
  assert.equal(ask('Marc', '2026-10-17', '10:00').slot?.resource_key, 'marcus');
  assert.equal(ask('Mike', '2026-10-17', '10:00').reason, 'unknown_staff');
  assert.equal(ask('amira', '2026-10-15', '12:00').available, false, 'Amira works Friday and Saturday');
});

test('barber: cancelling or moving inside the notice keeps the deposit, said first; outside it, refunded', async () => {
  const t = await repo.upsertTenant(profile());
  await repo.insertSeed(t.id, planBarberSeed(t.profile, THURSDAY, 1));
  const ollie = (await repo.listBookings(t.id, THURSDAY, new Date(THURSDAY.getTime() + 2 * 86400000), true)).find((b) => b.phone === BB_PEOPLE.soon.phone)!;
  assert.ok(ollie && ollie.deposit_paid, 'Ollie has a paid booking in the next day');
  const c = await call(t, BB_PEOPLE.soon.phone);
  const first = await c.run('cancel_booking', { reference: ollie.reference });
  assert.deepEqual([first.cancelled, first.message], [false, `Not done yet: it's less than 24 hours away, so the £5.00 deposit is kept under the shop's policy if they cancel. Tell them once, plainly: never more than the deposit, never "by law". If they still want to, call cancel_booking again.`]);
  const done = await c.run('cancel_booking', { reference: ollie.reference });
  assert.deepEqual([done.cancelled, done.deposit], [true, "The £5.00 deposit is kept under the shop's policy."]);
  // Jay's, next week: refunded, and moving it is free.
  const jay = (await repo.listBookings(t.id, THURSDAY, new Date(THURSDAY.getTime() + 14 * 86400000), true)).find((b) => b.phone === BB_PEOPLE.regular.phone)!;
  const j = await call(t, BB_PEOPLE.regular.phone);
  const moved = await j.run('modify_booking', { reference: jay.reference, time: '16:00' });
  assert.notEqual(moved.message?.startsWith('Not done yet'), true, 'no notice to give a week ahead');
  assert.equal((await j.run('cancel_booking', { reference: jay.reference })).deposit, 'The £5.00 deposit is refunded (in the demo, no money moves).');
});

test('barber: one person and one service a booking, the price in the read-back, the deposit by the demo card or in the shop', async () => {
  const t = await repo.upsertTenant(compileBarber(named(), { slug: 'kingsleys-tools' }));
  const c = await call(t, '+447700900960');
  const three = await c.run('check_availability', { service: 'Classic cut', date: '2026-10-17', time: '10:00', party_size: 3 });
  assert.equal(three.available, false);
  assert.match(three.message, /^Each person is their own booking/);
  assert.equal((await c.run('create_booking', { service: 'Kids cut', date: '2026-10-17', time: '10:00', party_size: 3, name: 'Sara Ahmed' })).booked, false);
  assert.match((await c.run('check_availability', { date: '2026-10-17', time: '10:00' })).message, /^Which service\? Ask what they are having: Classic cut, Skin fade, /);
  const grey = await c.run('check_availability', { service: 'Grey blending', date: '2026-10-17', time: '10:00', staff: 'Marcus' });
  assert.deepEqual([grey.available, grey.price, grey.with], [true, 'from £25.00', 'Marcus']);
  assert.equal(grey.next, 'Read back the grey blending with Marcus, the day, the time and the price (from £25.00), and book with create_booking when they say yes. Nothing is booked and there is no reference until create_booking returns one.');
  const booked = await c.run('create_booking', { service: 'Classic cut', date: '2026-10-17', time: '10:00', name: 'Tom Reid' });
  assert.equal(booked.booked, true);
  assert.equal(booked.next, 'Offer the £5.00 deposit now by card with take_demo_payment (for "deposit"). If they would rather pay in the shop, that is fine: the booking stands.');
});

test('barber: the seeded week fills each barber on their days, Saturday busiest, with the people to ring as', () => {
  const p = profile();
  for (const seed of [1, 7]) {
    const { bookings } = planBarberSeed(p, THURSDAY, seed);
    for (const r of p.booking!.resources) {
      const mine = bookings.filter((b) => b.resource_key === r.key).sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
      for (let i = 1; i < mine.length; i++) assert.ok(mine[i].starts_at >= mine[i - 1].ends_at, `${r.key}: ${mine[i].reference} overlaps`);
      assert.ok(mine.every((b) => r.days!.includes(new Date(b.starts_at.getTime() + 3600000).getUTCDay())), `${r.key} only on their days`);
    }
    const day = (d: string) => bookings.filter((b) => b.starts_at.toISOString().startsWith(d)).length;
    assert.ok(day('2026-10-17') > day('2026-10-20'), `Saturday ${day('2026-10-17')}, Tuesday ${day('2026-10-20')}`);
    assert.equal(day('2026-10-19'), 0, 'closed Monday');
    const jay = bookings.find((b) => b.phone === BB_PEOPLE.regular.phone)!;
    const ollie = bookings.find((b) => b.phone === BB_PEOPLE.soon.phone)!;
    assert.deepEqual([jay.resource_key, jay.service_key, ollie.resource_key, ollie.deposit_paid], ['marcus', 'skin_fade', 'dan', true]);
    const hours = (ollie.starts_at.getTime() - THURSDAY.getTime()) / 3600000;
    assert.ok(hours >= 2 && hours < 24, `Ollie's is ${hours} hours away`);
    assert.ok(!bookings.some((b) => b.phone === BB_PEOPLE.parent.phone));
    assert.ok(bookings.filter((b) => b.ends_at <= THURSDAY).every((b) => b.visit_status === 'finished'));
  }
});
