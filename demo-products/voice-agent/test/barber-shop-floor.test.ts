// The barber's shop floor (presets/barber.md §4.2 and §5, milestone 2): who
// is off today, the walk-in queue and the wait now, the waiting list, and
// the skin test 48 hours before colour; stored, read back, and cleared by
// Reset.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { checkAvailability } from '../src/domain/availability.ts';
import { profileOn, skinTestFor, waitNow, type ShopToday } from '../src/domain/shop-floor.ts';
import { defaultAnswers } from '../src/presets/barber/answers.ts';
import { compileBarber } from '../src/presets/barber/compile.ts';
import { sanitiseBarber } from '../src/presets/barber/sanitise.ts';

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
