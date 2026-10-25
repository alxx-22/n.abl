// After the order at the takeaway (presets/takeaway.md §4.3, M2): an allergy
// told later, a cancellation or change as a request for staff, a complaint
// for the manager, never a promise; and the numbers that pay on the phone.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { PHONE_ONLY } from '../src/core/kitchen.ts';
import { newCallState, runTool, type ToolContext } from '../src/core/tools.ts';
import type { Order, Tenant } from '../src/domain/types.ts';
import { defaultAnswers, type TakeawayAnswers } from '../src/presets/takeaway/answers.ts';
import { compileTakeaway } from '../src/presets/takeaway/compile.ts';
import { sanitiseTakeaway } from '../src/presets/takeaway/sanitise.ts';
import { validateTakeaway } from '../src/presets/takeaway/validate.ts';

const at = (hhmm: string, day = '2026-10-09') => new Date(`${day}T${hhmm}:00+01:00`);
const CHRIS = '+447700900405';
let db: Db;
let repo: Repo;

before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

async function firebird(slug: string, edit?: (a: TakeawayAnswers) => void): Promise<Tenant> {
  const a = defaultAnswers();
  a.basics.name = 'Firebird Chicken & Burgers';
  edit?.(a);
  return repo.upsertTenant(compileTakeaway(sanitiseTakeaway(a), { slug }));
}

async function call(tenant: Tenant, now: Date, callerPhone: string | null) {
  const ctx: ToolContext = {
    tenant, repo, now: () => now, callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone,
    state: newCallState(), demoCards: [], sms: { send: async () => 'simulated' }, telephony: null, action: () => {},
  };
  return { ctx, run: (name: string, args: Record<string, unknown>) => runTool(name, args, ctx) as Promise<any> };
}

async function order(t: Tenant, fulfilment: 'collection' | 'delivery', due: Date, phone = CHRIS): Promise<Order> {
  return repo.createOrder(t, {
    name: 'Chris Bell', phone, fulfilment, due_at: due, address: fulfilment === 'delivery' ? '9 Mill Lane' : null, postcode: fulfilment === 'delivery' ? 'NG7 2AB' : null,
    lines: [{ line: 1, item_key: 'burger_meal', name: 'Burger meal', quantity: 1, unit_pence: 899, modifiers: [] }], subtotal_pence: 899, delivery_fee_pence: 250, total_pence: 1149,
    allergy_notes: null, source: 'phone', call_id: null,
  });
}

const messages = async (t: Tenant) => (await repo.listMessages(t.id)).filter((m) => m.kind === 'message');

test('after the order: an allergy goes on the ticket while it is still to be made; once made, the manager rings first', async () => {
  const t = await firebird('tk-after-allergy');
  const o = await order(t, 'delivery', at('19:40'));
  const c = await call(t, at('19:00'), CHRIS);
  assert.match((await c.run('find_order', { action: 'add_allergy' })).message, /^Ask what the allergy is/);
  const added = await c.run('find_order', { action: 'add_allergy', details: 'sesame, for my son' });
  assert.equal(added.say, "It's on the order now and marked for the kitchen.");
  assert.match(added.never, /Never say the food will be safe/);
  const now = (await repo.getOrder(t.id, o.reference))!;
  assert.deepEqual([now.allergy_notes, now.flags], ['sesame, for my son', ['allergy']]);
  // Already out with the driver: nothing taken out of it, and not to be eaten until the manager has called.
  const out = await order(t, 'delivery', at('19:20'), '+447700900406');
  await repo.sendOutOrder(t.id, out.reference, 'Kai', at('18:58'));
  const late = await (await call(t, at('19:05'), '+447700900406')).run('find_order', { action: 'add_allergy', details: 'peanuts' });
  assert.equal(late.added, false);
  assert.match(late.say, /^The order is already made, so it can't be changed now\. Ask them not to eat it until the manager has called them back, tonight, before we close at midnight./);
  const [m] = await messages(t);
  assert.deepEqual([m.category, m.urgency, m.reference], ['allergy', 'urgent', out.reference]);
  assert.match(m.body, /Call them before they eat it\./);
});

test('after the order: a cancellation or change is a request for staff, never done on the call', async () => {
  const t = await firebird('tk-after-cancel');
  const o = await order(t, 'collection', at('19:30'));
  const c = await call(t, at('19:00'), CHRIS);
  const asked = await c.run('find_order', { action: 'request_cancel', details: 'ordered twice by mistake' });
  assert.equal(asked.requested, true);
  assert.equal(asked.say, "It's with the kitchen to cancel; they'll text this number to say.");
  assert.match(asked.never, /^Never say it is cancelled, changed or refunded/);
  assert.equal((await repo.getOrder(t.id, o.reference))!.status, 'confirmed', 'nothing cancelled yet');
  // Asked twice: one request, and the caller is told it is with staff.
  assert.match((await c.run('find_order', { action: 'request_cancel' })).message, /already with staff/);
  assert.deepEqual((await c.run('find_order', {})).waiting_for_staff, ['Cancel: ordered twice by mistake']);
  // A change while it is being made: asked for, with the warning that it may be too late.
  await repo.setOrderStatus(t.id, o.reference, 'in_kitchen');
  const change = await c.run('find_order', { action: 'request_change', details: 'no onions on the burger' });
  assert.match(change.say, /already being made, so they may not be able to/);
  assert.match((await c.run('find_order', { action: 'request_change' })).message, /^Ask what they would like changed/);
  // Staff accept the cancellation: only now is it cancelled; a request is answered once.
  const done = await repo.answerRequest(t.id, o.reference, 0, 'accepted', at('19:02'));
  assert.equal(done!.order.status, 'cancelled');
  assert.equal(await repo.answerRequest(t.id, o.reference, 0, 'refused', at('19:03')), null);
  // Out with the driver: no changes; delivered: a problem, not a cancellation.
  const out = await order(t, 'delivery', at('19:20'), '+447700900407');
  await repo.sendOutOrder(t.id, out.reference, 'Kai', at('18:58'));
  assert.match((await (await call(t, at('19:05'), '+447700900407')).run('find_order', { action: 'request_change', details: 'add a Coke' })).message, /already out with the driver/);
  await repo.setOrderStatus(t.id, out.reference, 'completed');
  assert.match((await (await call(t, at('19:30'), '+447700900407')).run('find_order', { action: 'request_cancel' })).message, /^It has been delivered\. If something is wrong with it, use report_problem\./);
});

test('after the order: a problem goes to the manager, with the health line for illness, and a missing item sent out only if the owner says so', async () => {
  const t = await firebird('tk-after-problem');
  const o = await order(t, 'delivery', at('18:40'));
  await repo.setOrderStatus(t.id, o.reference, 'completed');
  const c = await call(t, at('19:00'), CHRIS);
  const missing = await c.run('find_order', { action: 'report_problem', problem: 'missing', details: 'the fries' });
  assert.equal(missing.say, "It's with the manager, who will call them back tonight, before we close at midnight.");
  assert.match(missing.never, /they will get their money back/);
  let [m] = await messages(t);
  assert.deepEqual([m.category, m.urgency, m.reference, m.body], ['complaint', 'today', o.reference, `Missing, order ${o.reference}: the fries`]);
  assert.equal(c.ctx.state.messageTaken, true);
  const ill = await c.run('find_order', { action: 'report_problem', problem: 'ill', details: 'sick since eating' });
  assert.match(ill.health, /GP or NHS 111, or call 999 if it's severe\. Ask them to keep any food that's left, and its packaging\./);
  [m] = await messages(t);
  assert.deepEqual([m.urgency, m.body], ['urgent', `Ill after eating, order ${o.reference}: sick since eating`]);
  assert.match((await c.run('find_order', { action: 'report_problem', problem: 'hair in it' })).message, /^problem is one of/);
  // The owner's choice: missing items sent out with the next driver, once staff accept.
  const s = await firebird('tk-after-send', (a) => void (a.after.missing_items = 'send_out'));
  const so = await order(s, 'delivery', at('18:40'));
  await repo.setOrderStatus(s.id, so.reference, 'completed');
  const sent = await (await call(s, at('19:00'), CHRIS)).run('find_order', { action: 'report_problem', problem: 'missing', details: 'the fries' });
  assert.match(sent.say, /^The kitchen will send the missing the fries out with the next driver/);
  assert.deepEqual((await repo.getOrder(s.id, so.reference))!.requests!.map((r) => [r.kind, r.what, r.answer]), [['send_missing', 'the fries', null]]);
});

test('after the order: late only counts past the time given, by the owner\'s minutes', async () => {
  const t = await firebird('tk-after-late');
  const o = await order(t, 'delivery', at('19:00'));
  const early = await (await call(t, at('19:10'), CHRIS)).run('find_order', { action: 'report_problem', problem: 'late' });
  assert.deepEqual([early.logged, early.say], [false, 'Not late enough to pass on yet: it was due around 7pm. Give them the status.']);
  assert.equal((await messages(t)).length, 0);
  const late = await (await call(t, at('19:20'), CHRIS)).run('find_order', { action: 'report_problem', problem: 'late' });
  assert.equal(late.logged, true);
  const [m] = await messages(t);
  assert.match(m.body, new RegExp(`^Order ${o.reference} is 20 minutes late`));
});

test('pay on the phone only: a number on the list is asked for a card now, never the driver, and told nothing of why', async () => {
  const t = await firebird('tk-pay-phone', (a) => void (a.after.pay_on_phone_numbers = ['07700 900804', 'not a number']));
  assert.deepEqual(t.profile.ordering!.pay_on_phone, ['+447700900804'], 'only the valid number, as dialled');
  assert.deepEqual(validateTakeaway(sanitiseTakeaway({ ...defaultAnswers(), after: { ...defaultAnswers().after, pay_on_phone_numbers: ['07700 9008'] } })).filter((i) => /pay-on-the-phone/.test(i.message)).map((i) => i.step), ['money']);
  const c = await call(t, at('19:00'), '+447700900804');
  await c.run('add_to_order', { item: 'Pizza night', options: ['margherita', 'pepperoni', 'coke', 'fanta'] });
  const set = await c.run('set_fulfilment', { type: 'delivery', postcode: 'NG7 1AA', address: '3 Near Road' });
  assert.equal(set.pay, PHONE_ONLY);
  await c.run('review_order', {});
  const placed = await c.run('confirm_order', { name: 'Dean', allergy_notes: 'none', pay_driver: 'cash' });
  assert.equal(placed.placed, true, 'never asked how they will pay the driver');
  assert.equal(placed.payment, PHONE_ONLY);
  assert.equal((await repo.getOrder(t.id, placed.order_number))!.pay_note, 'Pay on the phone only');
  // Anyone else still pays the driver as they like.
  const other = await call(t, at('19:00'), '+447700900999');
  await other.run('add_to_order', { item: 'Pizza night', options: ['margherita', 'pepperoni', 'coke', 'fanta'] });
  assert.equal((await other.run('set_fulfilment', { type: 'delivery', postcode: 'NG7 1AA', address: '3 Near Road' })).pay, undefined);
});
