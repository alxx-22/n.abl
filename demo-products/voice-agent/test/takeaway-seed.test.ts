// The takeaway's seeded evening (presets/takeaway.md §7): a busy kitchen
// whenever Start is pressed in opening hours, deliveries out with drivers,
// and seeded orders moving on with the clock.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { newCallState, runTool, type ToolContext } from '../src/core/tools.ts';
import { lineTotal } from '../src/domain/menu.ts';
import type { Tenant } from '../src/domain/types.ts';
import { defaultAnswers } from '../src/presets/takeaway/answers.ts';
import { compileTakeaway } from '../src/presets/takeaway/compile.ts';
import { sanitiseTakeaway } from '../src/presets/takeaway/sanitise.ts';
import { planTakeawaySeed } from '../src/presets/takeaway/seed.ts';
import { TK_PEOPLE } from '../src/presets/takeaway/personas.ts';

const at = (hhmm: string, day = '2026-10-09') => new Date(`${day}T${hhmm}:00+01:00`);
const FRIDAY_7PM = at('19:00');
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
  a.basics.name = 'Firebird Chicken & Burgers';
  return compileTakeaway(sanitiseTakeaway(a), { slug: 'firebird' });
};

async function started(slug: string, now: Date, seed: number): Promise<Tenant> {
  const t = await repo.upsertTenant({ ...profile(), slug });
  await repo.insertSeed(t.id, planTakeawaySeed(t.profile, now, seed));
  return t;
}

async function wait(t: Tenant, now: Date, args: Record<string, unknown> = {}) {
  const ctx: ToolContext = {
    tenant: t, repo, now: () => now, callId: await repo.createCall({ tenant_id: t.id, channel: 'eval' }), channel: 'eval', callerPhone: null,
    state: newCallState(), demoCards: [], sms: { send: async () => 'simulated' }, telephony: null, action: () => {},
  };
  return runTool('get_wait_times', args, ctx) as Promise<any>;
}

const minutesIn = (words: string) => Number(/about (\d+) minutes/.exec(words)?.[1]);

test('the seeded evening: a Friday at 7pm is busy, honest about it, and every delivery is a real one', async () => {
  const p = profile();
  const zones = new Map(p.ordering!.delivery!.zones!.map((z) => [z.code, z]));
  for (const seed of [1, 7, 42]) {
    const plan = planTakeawaySeed(p, FRIDAY_7PM, seed);
    const orders = plan.orders;
    assert.ok(orders.length >= 35 && orders.length <= 70, `${orders.length} orders by 7pm and the hour after`);
    const deliveries = orders.filter((o) => o.fulfilment === 'delivery');
    assert.ok(deliveries.length / orders.length >= 0.55, `${deliveries.length} of ${orders.length} deliveries`);
    assert.deepEqual(orders.map((o) => o.reference), orders.map((_, i) => String(101 + i)), 'from 101, no gaps');
    for (const o of orders) {
      assert.ok(o.created_at!.getTime() < FRIDAY_7PM.getTime(), `${o.reference} was taken before Start`);
      assert.equal(o.subtotal_pence, o.lines.reduce((s, l) => s + lineTotal(l), 0), o.reference);
      assert.equal(o.total_pence, o.subtotal_pence + (o.delivery_fee_pence ?? 0), o.reference);
      if (o.fulfilment !== 'delivery') {
        assert.equal(o.pay_note, null, `${o.reference}: no driver note on a collection`);
        continue;
      }
      assert.ok(['Kai', 'Priya', 'Tom'].includes(o.driver!), `${o.reference}: a driver`);
      const district = o.postcode!.split(' ')[0];
      assert.ok(p.ordering!.delivery!.districts.includes(district), `${o.reference}: ${district} is delivered to`);
      assert.match(o.address!, /\(example\)$/);
      const zone = zones.get(district);
      assert.ok(o.subtotal_pence >= (zone?.min_order_pence ?? 1200), `${o.reference}: over its minimum`);
      assert.equal(o.delivery_fee_pence, o.subtotal_pence >= 3000 ? 0 : zone?.fee_pence ?? 250, `${o.reference}: its zone's fee`);
      if (o.payment_status === 'unpaid') assert.match(o.pay_note!, /^Cash: change from £(20|50)$|^Card at the door$/);
      assert.ok(o.status !== 'out_for_delivery' || (o.out_at && o.ready_at && o.out_at >= o.ready_at), `${o.reference}: out once ready`);
    }
    assert.ok(orders.some((o) => o.lines.some((l) => ['burger_meal', 'chicken_box', 'pizza_night'].includes(l.item_key))), 'meal deals among them');
    // Amy, whom the prospect can ring as, has a delivery out with Kai.
    const amy = orders.find((o) => o.phone === TK_PEOPLE.amy.phone)!;
    assert.deepEqual([amy.status, amy.driver, amy.fulfilment], ['out_for_delivery', 'Kai', 'delivery']);
    // Chris's delivery came twenty minutes ago or more (his fries weren't in the bag).
    const chris = orders.filter((o) => o.phone === TK_PEOPLE.delivered.phone);
    assert.deepEqual(chris.map((o) => [o.status, o.fulfilment]), [['completed', 'delivery']]);
    assert.ok(chris[0].due_at.getTime() <= FRIDAY_7PM.getTime() - 20 * 60000, `delivered at ${chris[0].due_at.toISOString()}`);
    assert.equal(orders.filter((o) => [TK_PEOPLE.parent, TK_PEOPLE.outer, TK_PEOPLE.refused].some((p) => o.phone === p.phone)).length, 0, 'the other numbers are free');
    // One change waits on a ticket not yet started, for staff to accept or refuse.
    const asked = orders.filter((o) => o.requests?.length);
    assert.deepEqual(asked.map((o) => [o.status, o.requests![0].kind, o.requests![0].what, o.requests![0].answer]), [['confirmed', 'change', 'no onions on the burger, please', null]]);
    // Straight after Start, "how long tonight?" is about 45 to 50 minutes for collection.
    const t = await started(`tk-seed-${seed}`, FRIDAY_7PM, seed);
    const w = await wait(t, FRIDAY_7PM);
    assert.ok(minutesIn(w.collection) >= 40 && minutesIn(w.collection) <= 55, `seed ${seed}: ${w.collection}`);
    assert.equal(minutesIn(w.delivery), minutesIn(w.collection) + 25, `seed ${seed}: ${w.delivery}`);
  }
});

test('the seeded evening: before opening a few orders for opening time; after closing, everything done', async () => {
  const early = planTakeawaySeed(profile(), at('11:30', '2026-10-10'), 1);
  assert.ok(early.orders.length <= 4, `${early.orders.length} pre-orders`);
  for (const o of early.orders) assert.ok(o.ready_at!.getTime() <= at('12:30', '2026-10-10').getTime() && o.status === 'confirmed');
  assert.equal((await wait(await started('tk-seed-early', at('11:30', '2026-10-10'), 1), at('11:30', '2026-10-10'))).collection, 'about 45 minutes, so around 12:15pm');
  // Sunday after its 11pm close.
  const late = planTakeawaySeed(profile(), at('23:30', '2026-10-11'), 1);
  assert.ok(late.orders.length > 20);
  assert.ok(late.orders.every((o) => o.status === 'completed' && o.payment_status === 'paid'));
  // Saturday at 11:40pm: the last half hour is never full, so a late caller can still collect by midnight.
  assert.equal((await wait(await started('tk-seed-late', at('23:40', '2026-10-10'), 1), at('23:40', '2026-10-10'))).collection, 'about 20 minutes, so around midnight');
});

test("the seeded evening: seeded orders move on with the clock; the prospect's own wait for the prospect", async () => {
  const t = await started('tk-seed-move', FRIDAY_7PM, 7);
  const mine = await repo.createOrder(t, {
    name: 'Prospect', phone: '+447700900804', fulfilment: 'collection', due_at: at('19:20'), address: null, postcode: null,
    lines: [{ line: 1, item_key: 'fries', name: 'Fries', quantity: 1, unit_pence: 249, modifiers: [] }], subtotal_pence: 249, delivery_fee_pence: 0, total_pence: 249, allergy_notes: null, source: 'phone', call_id: null,
  });
  const half = at('19:30');
  await repo.advanceSeedOrders(t.id, half, 15);
  const orders = await repo.listOrdersDue(t.id, at('00:00'), at('23:59'));
  for (const o of orders.filter((x) => x.reference !== mine.reference)) {
    const ready = o.ready_at!.getTime();
    if (o.fulfilment === 'delivery' && o.due_at.getTime() + 5 * 60_000 < half.getTime()) assert.equal(o.status, 'completed', `${o.reference} delivered`);
    else if (o.fulfilment === 'delivery' && ready <= half.getTime()) assert.deepEqual([o.status, Boolean(o.out_at), Boolean(o.driver)], ['out_for_delivery', true, true], o.reference);
    else if (ready - 15 * 60_000 <= half.getTime() && ready > half.getTime()) assert.ok(['in_kitchen', 'ready'].includes(o.status), `${o.reference}: ${o.status}`);
  }
  // Amy's delivery was due at 7:10: delivered by 7:30.
  assert.equal(orders.find((o) => o.phone === TK_PEOPLE.amy.phone)!.status, 'completed');
  assert.equal(orders.find((o) => o.reference === mine.reference)!.status, 'confirmed', 'the prospect moves their own');
});
