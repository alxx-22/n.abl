// "Where's my order?" at the takeaway (presets/takeaway.md §4.3, find_order):
// today's order by its number or the calling number, its status in words with
// its time, and never its address.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { newCallState, runTool, type Action, type ToolContext } from '../src/core/tools.ts';
import type { Order, Tenant } from '../src/domain/types.ts';
import { defaultAnswers } from '../src/presets/takeaway/answers.ts';
import { compileTakeaway } from '../src/presets/takeaway/compile.ts';
import { sanitiseTakeaway } from '../src/presets/takeaway/sanitise.ts';

const at = (hhmm: string, day = '2026-10-09') => new Date(`${day}T${hhmm}:00+01:00`);
const AMY = '+447700900322';
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

async function call(tenant: Tenant, now: Date, callerPhone: string | null) {
  const actions: Action[] = [];
  const ctx: ToolContext = {
    tenant, repo, now: () => now, callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone,
    state: newCallState(), demoCards: [], sms: { send: async () => 'simulated' }, telephony: null, action: (x) => actions.push(x),
  };
  return { ctx, run: (name: string, args: Record<string, unknown>) => runTool(name, args, ctx) as Promise<any> };
}

async function order(t: Tenant, phone: string, fulfilment: 'collection' | 'delivery', due: Date): Promise<Order> {
  return repo.createOrder(t, {
    name: 'Amy Clarke', phone, fulfilment, due_at: due, address: fulfilment === 'delivery' ? '14 Larch Close' : null, postcode: fulfilment === 'delivery' ? 'NG9 2AB' : null,
    lines: [{ line: 1, item_key: 'burger_meal', name: 'Burger meal', quantity: 2, unit_pence: 899, modifiers: [] }], subtotal_pence: 1798, delivery_fee_pence: 350, total_pence: 2148, allergy_notes: null, source: 'phone', call_id: null,
  });
}

test("where's my order: out with the driver, found by the calling number, with no address or name read back", async () => {
  const t = await firebird('tk-where');
  const o = await order(t, AMY, 'delivery', at('20:07'));
  assert.ok(await repo.sendOutOrder(t.id, o.reference, 'Kai', at('19:42')));
  const c = await call(t, at('19:50'), AMY);
  const found = await c.run('find_order', {});
  assert.equal(found.found, true);
  assert.equal(found.status, 'out with Kai since 7:42pm; it should be with them in about 15 minutes');
  assert.deepEqual([found.order_number, found.items, found.total], [o.reference, '2 Burger meal', '£21.48']);
  assert.doesNotMatch(JSON.stringify(found), /Larch|NG9|Amy|Clarke/, 'nothing that says where or who');
  assert.match(found.never, /never read the address or the name back/);
  assert.ok(c.ctx.state.found.includes(o.reference), 'talking about it is not a false claim');
  assert.deepEqual(c.ctx.state.privateAddresses, ['Larch Close'], 'its street, for the guardrail');
  // Live, 8 October: the caller's own number passed as the order number. It is that phone's order; any other phone number finds nothing.
  assert.equal((await c.run('find_order', { order_number: '07700 900322' })).order_number, o.reference);
  const someoneElse = await c.run('find_order', { order_number: '07700 900999' });
  assert.deepEqual([someoneElse.found, someoneElse.message], [false, "That's a phone number, not an order number. An order is found by its number, or by the number they're ringing from: ask for the order number."]);
  // Nearly there.
  assert.equal((await (await call(t, at('20:05'), AMY)).run('find_order', {})).status, 'out with Kai since 7:42pm; it should be with them any minute');
  // Only a delivery not yet out can go out.
  assert.equal(await repo.sendOutOrder(t.id, o.reference, 'Tom', at('19:50')), null);
});

test('paying the driver: asked once how, with the read-back, and for cash the change they need, on the order and in the text', async () => {
  const t = await firebird('tk-pay-driver');
  const sent: { to: string; body: string }[] = [];
  const c = await call(t, at('19:00'), AMY);
  c.ctx.sms = { send: async (to, body) => (sent.push({ to, body }), 'simulated') };
  await c.run('add_to_order', { item: 'Burger meal', options: ['cheeseburger', 'fries', 'coke'] });
  await c.run('add_to_order', { item: 'Six hot wings' });
  await c.run('set_fulfilment', { type: 'delivery', postcode: 'NG7 1AA', address: '3 Near Road' });
  // Asked in the same breath as the read-back, so the caller's yes places it. Live, 8 October: "yes, that's right, bye",
  // then "how will you pay?", and three orders were never placed.
  const review = await c.run('review_order', {});
  assert.equal(review.next, `Read this back word for word and, in the same breath, ask their name, if you don't have it yet, and how they'll pay: now by card on the phone, or the driver in cash or by card, and for cash, "do you need change from anything?". On yes, call confirm_order at once with pay_driver and change_from: don't ask anything new after the yes.`);
  const placed = await c.run('confirm_order', { name: 'Amy', allergy_notes: 'none', pay_driver: 'cash', change_from: '£20' });
  assert.equal(placed.placed, true, JSON.stringify(placed));
  assert.equal(placed.payment, "They're paying the driver (cash: change from £20): don't take a card on the phone.");
  assert.equal((await repo.getOrder(t.id, placed.order_number))!.pay_note, 'Cash: change from £20');
  assert.match(sent.at(-1)!.body, /Paying the driver: cash, change from £20\./);
  // The note must be one they can hand over that covers the total. Live, 8 October: never asked, the total
  // itself went in as the note, "change from £32"; a twenty for £22.49 is checked, once. Not said: no change needed.
  for (const [given, asked, note] of [
    ['£32.48', /^£32\.48 isn't a note they'd hand over: check what they'll pay the driver with, for £22\.49/, 'Cash: change from £50'],
    ['a twenty', /^£20 won't cover the £22\.49 total/, 'Cash: change from £50'],
    ['none', null, 'Cash: no change needed'],
    ['', null, 'Cash: no change needed'],
  ] as const) {
    const d = await call(t, at('19:00'), AMY);
    await d.run('add_to_order', { item: 'Pizza night', options: ['margherita', 'pepperoni', 'coke', 'fanta'] });
    await d.run('set_fulfilment', { type: 'delivery', postcode: 'NG7 1AA', address: '3 Near Road' });
    await d.run('review_order', {});
    const first = await d.run('confirm_order', { name: 'Amy', allergy_notes: 'none', pay_driver: 'cash', change_from: given });
    if (asked) {
      assert.match(first.message, asked, given);
      const p = await d.run('confirm_order', { name: 'Amy', allergy_notes: 'none', pay_driver: 'cash', change_from: '£50' });
      assert.equal((await repo.getOrder(t.id, p.order_number))!.pay_note, note, given);
    } else assert.equal((await repo.getOrder(t.id, first.order_number))!.pay_note, note, given);
  }
  // Card at the door, and paying now on the phone, which leaves nothing for the driver.
  for (const [how, note] of [['card', 'Card at the door'], ['phone', null]] as const) {
    const d = await call(t, at('19:00'), AMY);
    await d.run('add_to_order', { item: 'Pizza night', options: ['margherita', 'pepperoni', 'coke', 'fanta'] });
    await d.run('set_fulfilment', { type: 'delivery', postcode: 'NG7 1AA', address: '3 Near Road' });
    await d.run('review_order', {});
    const p = await d.run('confirm_order', { name: 'Amy', allergy_notes: 'none', pay_driver: how });
    assert.equal((await repo.getOrder(t.id, p.order_number))!.pay_note, note, how);
  }
});

test("where's my order: by its number from another phone, in the kitchen, running late, and only today's", async () => {
  const t = await firebird('tk-where-2');
  const o = await order(t, AMY, 'collection', at('19:15'));
  const other = await call(t, at('19:00'), '+447700900999');
  assert.equal((await other.run('find_order', {})).found, false, 'not from a number with no order');
  const byNumber = await other.run('find_order', { order_number: `order ${o.reference}` });
  assert.equal(byNumber.status, 'in the queue for the kitchen; ready to collect around 7:15pm');
  assert.match(byNumber.never, /^Never read the address back/);
  await repo.setOrderStatus(t.id, o.reference, 'in_kitchen');
  assert.equal((await (await call(t, at('19:35'), AMY)).run('find_order', {})).status, 'being made in the kitchen; ready to collect around 7:15pm, running about 20 minutes late');
  await repo.setOrderStatus(t.id, o.reference, 'ready');
  assert.equal((await (await call(t, at('19:20'), AMY)).run('find_order', {})).status, 'ready to collect now');
  // Tomorrow, the same number is not today's order.
  const tomorrow = await call(t, at('19:00', '2026-10-10'), null);
  assert.match((await tomorrow.run('find_order', { order_number: o.reference })).message, /^No order .* today\./);
  assert.equal((await tomorrow.run('find_order', {})).message, 'Ask for the order number.');
});

test('a delivery for someone else: their name and number for the driver, the text to the caller, and found from their phone', async () => {
  const t = await firebird('tk-for-mum');
  const sent: { to: string; body: string }[] = [];
  const c = await call(t, at('19:00'), AMY);
  c.ctx.sms = { send: async (to, body) => (sent.push({ to, body }), 'simulated') };
  await c.run('add_to_order', { item: 'Pizza night', options: ['margherita', 'pepperoni', 'coke', 'fanta'] });
  await c.run('set_fulfilment', { type: 'delivery', postcode: 'NG7 2AB', address: '3 Mill Court' });
  await c.run('review_order', {});
  const ask = await c.run('confirm_order', { name: 'Ravi', allergy_notes: 'none', pay_driver: 'phone', recipient_name: 'Margaret Shah' });
  assert.equal(ask.message, "Ask for Margaret Shah's number, for the driver, then call confirm_order again with recipient_phone. If they don't have it, call again without it.");
  const placed = await c.run('confirm_order', { name: 'Ravi', allergy_notes: 'none', pay_driver: 'phone', recipient_name: 'Margaret Shah', recipient_phone: '07700 900820' });
  assert.equal(placed.placed, true, JSON.stringify(placed));
  assert.equal(placed.recipient, 'For Margaret Shah: the driver has their name and number. The text goes to the caller.');
  const o = (await repo.getOrder(t.id, placed.order_number))!;
  assert.deepEqual([o.name, o.phone, o.recipient], ['Ravi', AMY, { name: 'Margaret Shah', phone: '+447700900820' }]);
  assert.equal(sent.at(-1)!.to, AMY);
  assert.match(sent.at(-1)!.body, new RegExp(`order ${placed.order_number} for Margaret Shah,`));
  // Margaret rings to ask where it is: found from her number, as the caller's would be.
  assert.equal((await (await call(t, at('19:30'), '+447700900820')).run('find_order', {})).order_number, placed.order_number);
});

test('a delivery for someone else, said as "to my mum": the caller is asked their own name and hers, once', async () => {
  const t = await firebird('tk-to-mum');
  const c = await call(t, at('19:00'), AMY);
  // Live, 8 October: mum's name went on the order as the caller's, and her number was never asked.
  c.ctx.state.heard.push('Can I have a Pizza night delivered to my mum, please?', "It's three Mill Court.");
  await c.run('add_to_order', { item: 'Pizza night', options: ['margherita', 'pepperoni', 'coke', 'fanta'] });
  await c.run('set_fulfilment', { type: 'delivery', postcode: 'NG7 2AB', address: '3 Mill Court' });
  const review = await c.run('review_order', {});
  assert.match(review.next, /ask the caller's own name, and the name and number of their mum, who it's for, for the driver \(recipient_name and recipient_phone\)/);
  const ask = await c.run('confirm_order', { name: 'Margaret Shah', allergy_notes: 'none', pay_driver: 'phone' });
  assert.equal(ask.message, "Not placed yet: the caller said it's for their mum. Ask the caller's own name for the order, and the name and number of their mum for the driver, then call confirm_order again with name, recipient_name and recipient_phone.");
  const placed = await c.run('confirm_order', { name: 'Ravi', allergy_notes: 'none', pay_driver: 'phone', recipient_name: 'Margaret Shah', recipient_phone: '07700 900820' });
  assert.deepEqual((await repo.getOrder(t.id, placed.order_number))!.recipient, { name: 'Margaret Shah', phone: '+447700900820' });
});

test('"my usual": the last order before today from the calling number, to add again at tonight\'s prices, never its address', async () => {
  const t = await firebird('tk-usual');
  const past = await repo.createOrder(t, {
    name: 'Leah Grant', phone: '+447700900806', fulfilment: 'delivery', due_at: at('19:30', '2026-10-02'), address: '27 Larch Close', postcode: 'NG7 2AB',
    lines: [{ line: 1, item_key: 'burger_meal', name: 'Burger meal', quantity: 1, unit_pence: 899, modifiers: [{ key: 'cheeseburger', name: 'Cheeseburger', price_pence: 50 }, { key: 'fries', name: 'Fries', price_pence: 0 }, { key: 'coca_cola', name: 'Coca-Cola', price_pence: 0 }] }],
    subtotal_pence: 949, delivery_fee_pence: 250, total_pence: 1199, allergy_notes: null, source: 'phone', call_id: null,
  });
  await repo.setOrderStatus(t.id, past.reference, 'completed');
  const c = await call(t, at('19:00'), '+447700900806');
  const usual = await c.run('find_order', { action: 'last_order' });
  assert.deepEqual([usual.found, usual.when, usual.kind, usual.items], [true, 'Friday 2026-10-02', 'delivery', ['1 × Burger meal (Cheeseburger, Fries, Coca-Cola)']]);
  assert.doesNotMatch(JSON.stringify(usual), /Larch|NG7/, 'no address');
  assert.match(usual.next, /tonight's prices, not the old ones\. For a delivery, ask them to say the address: never read it out\.$/);
  const again = await c.run('add_to_order', usual.add_again[0]);
  assert.match(again.added, /^1 × Burger meal \(Cheeseburger, Fries, Coca-Cola\) — £9\.49$/);
  assert.equal((await (await call(t, at('19:00'), '+447700900999')).run('find_order', { action: 'last_order' })).message, "No earlier order from the number they're ringing on: ask what they'd like.");
  // A caller who says they're the driver hears nothing of the customer from the order.
  assert.match((await (await call(t, at('19:00'), '+447700900998')).run('find_order', { order_number: past.reference })).message ?? '', /^No order/, "last week's isn't today's");
});
