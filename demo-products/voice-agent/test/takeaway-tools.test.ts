// The takeaway's kitchen through the real tools (presets/takeaway.md §4.2):
// honest waits from a queue that counts deliveries too, the postcode's zone,
// its minimum and free delivery, a time later on, and last orders before a
// midnight close.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { newCallState, runTool, toolDeclarations, type Action, type ToolContext } from '../src/core/tools.ts';
import { saidCollection } from '../src/core/kitchen.ts';
import type { Tenant } from '../src/domain/types.ts';
import { defaultAnswers } from '../src/presets/takeaway/answers.ts';
import { compileTakeaway } from '../src/presets/takeaway/compile.ts';
import { sanitiseTakeaway } from '../src/presets/takeaway/sanitise.ts';
import { compileRestaurant } from '../src/presets/restaurant/compile.ts';
import { defaultAnswers as restaurantAnswers } from '../src/presets/restaurant/answers.ts';

/** Friday 9 October 2026, 7pm BST. */
const FRIDAY_7PM = new Date('2026-10-09T18:00:00Z');
const at = (hhmm: string, day = '2026-10-09') => new Date(`${day}T${hhmm}:00+01:00`);
let db: Db;
let repo: Repo;

before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

async function firebird(slug: string): Promise<Tenant> {
  const a = defaultAnswers();
  a.basics.name = 'Firebird Chicken & Burgers';
  return repo.upsertTenant(compileTakeaway(sanitiseTakeaway(a), { slug }));
}

async function call(tenant: Tenant, now = FRIDAY_7PM) {
  const actions: Action[] = [];
  const ctx: ToolContext = {
    tenant, repo, now: () => now, callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone: '+447700900321',
    state: newCallState(), demoCards: [], sms: { send: async () => 'simulated' }, telephony: null, action: (x) => actions.push(x),
  };
  return { ctx, run: (name: string, args: Record<string, unknown>) => runTool(name, args, ctx) as Promise<any> };
}

/** An order already in the queue, as a call or the seed would have placed it. */
async function placed(t: Tenant, fulfilment: 'collection' | 'delivery', due: Date) {
  await repo.createOrder(t, {
    name: 'Queue', phone: null, fulfilment, due_at: due, address: fulfilment === 'delivery' ? '1 Test Street' : null, postcode: fulfilment === 'delivery' ? 'NG7 1AA' : null,
    lines: [{ line: 1, item_key: 'fries', name: 'Fries', quantity: 1, unit_pence: 249, modifiers: [] }], subtotal_pence: 249, delivery_fee_pence: 0, total_pence: 249, allergy_notes: null, source: 'seed', call_id: null,
  });
}

test('the kitchen: only a takeaway asks it, and the restaurant keeps its own collection slots', async () => {
  const t = await firebird('tk-decl');
  assert.ok(toolDeclarations(t).some((d) => d.name === 'get_wait_times'));
  const r = restaurantAnswers();
  r.basics.name = "Luca's";
  const restaurant = compileRestaurant(r, { slug: 'lucas' });
  assert.equal(restaurant.ordering?.kitchen, undefined);
  assert.equal(restaurant.ordering?.delivery, undefined);
  assert.ok(!toolDeclarations({ id: 'r', slug: 'lucas', profile: restaurant }).some((d) => d.name === 'get_wait_times'));
});

test('the kitchen: an honest wait that counts deliveries too, and the order keeps the time it was given', async () => {
  const t = await firebird('tk-wait');
  const c = await call(t);
  // An empty kitchen at 7pm: collection in prep time, delivery that plus the drive.
  assert.deepEqual(await c.run('get_wait_times', {}), {
    collection: 'about 15 minutes, so around 7:15pm',
    delivery: 'about 40 minutes, so around 7:40pm',
    ask: 'For the fee and minimum, ask for their postcode.',
    last_orders: '11:45pm',
    note: "These are the kitchen's real times right now. Say them as they are; never promise sooner.",
  });
  // A busy Friday: the 7:15 and 7:30 slots full, half of them deliveries leaving the kitchen then.
  for (const hhmm of ['19:15', '19:15', '19:30', '19:30']) await placed(t, 'collection', at(hhmm));
  for (const hhmm of ['19:40', '19:40', '19:55', '19:55']) await placed(t, 'delivery', at(hhmm));
  const busy = await c.run('get_wait_times', { postcode: 'NG9' });
  assert.equal(busy.collection, 'about 45 minutes, so around 7:45pm');
  assert.equal(busy.delivery, 'about 70 minutes, so around 8:10pm');
  assert.deepEqual([busy.delivery_fee, busy.minimum_order, busy.free_delivery_from], ['£3.50', '£15.00', '£30.00']);
  const set = await c.run('set_fulfilment', { type: 'delivery', postcode: 'NG9 2AB', address: '14 Larch Close' });
  assert.deepEqual([set.ok, set.spoken_time, set.wait, set.delivery_fee, set.minimum_order], [true, '8:10pm', 'about 70 minutes, so around 8:10pm', '£3.50', '£15.00']);
  // Someone else takes the 7:45 slot meanwhile: the caller keeps the time they were given.
  for (let i = 0; i < 4; i++) await placed(t, 'collection', at('19:45'));
  assert.equal((await c.run('set_fulfilment', { type: 'delivery', postcode: 'NG9 2AB', address: '14 Larch Close' })).spoken_time, '8:10pm');
});

test('the kitchen: the postcode decides the fee and minimum, the amount short is said, and delivery can be free', async () => {
  const t = await firebird('tk-zone');
  const c = await call(t);
  const outside = await c.run('set_fulfilment', { type: 'delivery', postcode: 'NG8 1AA', address: '2 Far Road' });
  assert.deepEqual([outside.ok, outside.outside], [false, true]);
  assert.match(outside.message, /NG8 is outside the delivery area\. Offer collection\./);
  assert.match((await c.run('get_wait_times', { postcode: 'NG8' })).delivery, /outside the delivery area/);
  // £12.97 in the outer zone: £2.03 short of its £15 minimum. Live, 8 October: the receptionist worked "£2.03" out itself,
  // as only get_wait_times had the postcode; now each line added says how far short it is.
  await c.run('get_wait_times', { postcode: 'NG9 2AB' });
  assert.equal((await c.run('add_to_order', { item: 'Classic beef burger' })).short_of_delivery_minimum, '£8.51');
  await c.run('change_order_line', { line: 1, quantity: 0 });
  await c.run('add_to_order', { item: 'Classic beef burger' });
  // Live, 8 October: "six hot wings" passed as six of them. The six is the dish's name: one portion.
  const wings = await c.run('add_to_order', { item: 'hot wings', quantity: 6 });
  assert.equal(wings.added, '1 × Six hot wings — £4.99');
  assert.match(wings.quantity_note, /^Taken as one Six hot wings: the number is in its name\./);
  assert.equal((await c.run('add_to_order', { item: 'Coleslaw' })).short_of_delivery_minimum, '£2.03');
  const set = await c.run('set_fulfilment', { type: 'delivery', postcode: 'NG9 2AB', address: '14 Larch Close' });
  assert.equal(set.short_by, '£2.03', JSON.stringify(set));
  assert.deepEqual([set.next, set.total_so_far], ["They're £2.03 short of the £15.00 minimum for delivery here. Tell them, and ask what they'd like to add.", undefined]);
  const review = await c.run('review_order', {});
  assert.deepEqual([review.ok, review.short_by], [false, '£2.03']);
  assert.match(review.message, /minimum order of £15\.00/);
  // Closer in, the same order meets the £12 minimum and pays £2.50.
  // With the order in, the total with delivery and the next step, so it is never added up by the model.
  const closer = await c.run('set_fulfilment', { type: 'delivery', postcode: 'NG7 1AA', address: '3 Near Road' });
  assert.deepEqual([closer.total_so_far, closer.next], ['£15.47', 'Now call review_order and read its read_back word for word.']);
  const near = await c.run('review_order', {});
  assert.equal(near.delivery_fee, '£2.50');
  assert.match(near.read_back, /Delivery £2\.50\. That's £15\.47 altogether/);
  // Over £30, delivery is free, and the read-back says so.
  await c.run('add_to_order', { item: 'Family bucket' });
  const free = await c.run('review_order', {});
  assert.equal(free.delivery_fee, undefined);
  assert.match(free.read_back, /Delivery is free\. That's £35\.96 altogether/);
  const done = await c.run('confirm_order', { name: 'Ellie', allergy_notes: 'none', pay_driver: 'phone' });
  assert.equal(done.placed, true, JSON.stringify(done));
  const order = (await repo.getOrder(t.id, done.order_number))!;
  assert.deepEqual([order.delivery_fee_pence, order.total_pence], [0, 3596]);
});

test('the kitchen: collection or delivery not yet set, the next step is said rather than asked again', async () => {
  const t = await firebird('tk-next');
  const c = await call(t);
  await c.run('add_to_order', { item: 'Chicken box', options: ['strips', 'fries', 'Sprite'] });
  // Live, 8 October: the caller had agreed to collect, and "nothing to place yet" left the order unplaced.
  const early = await c.run('confirm_order', { name: 'Rob', allergy_notes: 'none' });
  assert.equal(early.placed, false);
  assert.match(early.message, /^Not placed yet\. Collection or delivery isn't set yet\. If the caller has already said which, call set_fulfilment now .*; only if not, ask\. Then review_order/);
  assert.match((await c.run('review_order', {})).message, /^Collection or delivery isn't set yet\. If the caller has already said which, call set_fulfilment now/);
  // Live, 8 October: "I'm collecting" said, and the order stalled. Said collection last, it is set for as soon as possible.
  const said = await call(t);
  await said.run('add_to_order', { item: 'Chicken box', options: ['strips', 'fries', 'Sprite'] });
  said.ctx.state.heard.push("Actually, I'm collecting, so I don't need delivery.");
  const read = await said.run('review_order', {});
  assert.match(read.read_back, /for collection at 7:15pm\.$/);
  for (const [words, yes] of [["I'll pick it up", true], ['Collection, please', true], ['I was going to collect but can you deliver it?', false], ['Delivery please', false], ['Two burgers', false]] as const) {
    assert.equal(saidCollection([words]), yes, words);
  }
  const set = await c.run('set_fulfilment', { type: 'collection' });
  assert.deepEqual([set.total_so_far, set.next], ['£7.99', 'Now call review_order and read its read_back word for word.']);
  // Never read back is said as that, not as a change (live, 8 October: "it's changed slightly").
  assert.match((await c.run('confirm_order', { name: 'Rob' })).message, /^Not placed yet: the caller has not heard the order read back\./);
  await c.run('add_to_order', { item: 'Coleslaw' });
  assert.match((await c.run('confirm_order', { name: 'Rob' })).message, /^Not placed yet: the order has changed since it was read back\./);
});

test('the kitchen: "for 8pm" is the slot that arrives by eight, and a full one offers the times with room', async () => {
  const t = await firebird('tk-timed');
  const c = await call(t);
  const eight = await c.run('set_fulfilment', { type: 'delivery', postcode: 'NG7 1AA', address: '3 Near Road', time: '20:00' });
  assert.deepEqual([eight.ok, eight.spoken_time], [true, '7:55pm']);
  for (let i = 0; i < 4; i++) await placed(t, 'delivery', at('19:55'));
  const full = await c.run('set_fulfilment', { type: 'delivery', postcode: 'NG7 1AA', address: '3 Near Road', time: '20:00' });
  assert.equal(full.ok, false);
  assert.deepEqual(full.times_with_room, ['7:40pm', '8:10pm', '8:25pm']);
  // Sooner than the kitchen can make it: the earliest is said, not promised away.
  const soon = await c.run('set_fulfilment', { type: 'collection', time: '19:05' });
  assert.equal(soon.message, 'The earliest collection time is 7:15pm.');
});

test('the kitchen: on a Saturday, nothing is handed over after midnight, and orders stop at 11:45', async () => {
  const t = await firebird('tk-late');
  const late = await call(t, at('23:40', '2026-10-10'));
  const delivery = await late.run('set_fulfilment', { type: 'delivery', postcode: 'NG7 1AA', address: '3 Near Road' });
  assert.equal(delivery.ok, false);
  assert.equal(delivery.message, "Delivery has finished for today: an order now couldn't reach them before we close at midnight.");
  assert.equal(delivery.collection_instead, 'Collection is still possible: about 20 minutes, so around midnight.');
  const collection = await late.run('set_fulfilment', { type: 'collection' });
  assert.deepEqual([collection.ok, collection.spoken_time], [true, 'midnight']);
  const after = await call(t, at('23:50', '2026-10-10'));
  assert.equal((await after.run('set_fulfilment', { type: 'collection' })).message, "We've stopped taking orders for today: last orders were at 11:45pm. We open again tomorrow at 12 noon.");
  assert.equal((await after.run('get_wait_times', {})).collection, "We've stopped taking orders for today: last orders were at 11:45pm. We open again tomorrow at 12 noon.");
  // Before opening, the first slot after it.
  const early = await call(t, at('11:30', '2026-10-10'));
  assert.equal((await early.run('get_wait_times', {})).collection, 'about 45 minutes, so around 12:15pm');
});
