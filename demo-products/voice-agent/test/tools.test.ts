import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { seedAll } from '../src/db/seed.ts';
import { newCallState, runTool, toolDeclarations, type Action, type ToolContext } from '../src/core/tools.ts';
import { DEFAULT_DEMO_CARDS } from '../src/domain/payments.ts';
import type { Tenant } from '../src/domain/types.ts';

// Friday 2 October 2026, 5:30pm BST: the takeaway is open.
const NOW = new Date('2026-10-02T16:30:00Z');
let db: Db;
let repo: Repo;
let tenants: Tenant[];

before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
  tenants = await seedAll(repo, NOW, { diary: false });
});

after(async () => db.close());

function ctxFor(slug: string, callerPhone: string | null = '+447700900123') {
  const tenant = tenants.find((t) => t.slug === slug)!;
  const actions: Action[] = [];
  const sent: { to: string; body: string }[] = [];
  const ctx: ToolContext = {
    tenant, repo, now: () => NOW, callId: '', channel: 'eval', callerPhone, state: newCallState(), demoCards: DEFAULT_DEMO_CARDS,
    sms: { send: async (to, body) => (sent.push({ to, body }), 'simulated') },
    telephony: null,
    action: (a) => actions.push(a),
  };
  return { ctx, actions, sent };
}

async function withCall(slug: string, callerPhone?: string | null) {
  const x = ctxFor(slug, callerPhone);
  x.ctx.callId = await repo.createCall({ tenant_id: x.ctx.tenant.id, channel: 'eval' });
  return x;
}

test('tools on offer follow what the business does', () => {
  const names = (slug: string) => toolDeclarations(tenants.find((t) => t.slug === slug)!).map((d) => d.name);
  assert.ok(names('lucas-trattoria').includes('add_to_order'));
  assert.ok(names('lucas-trattoria').includes('create_booking'));
  assert.ok(!names('copper-kettle').includes('create_booking'), 'the café takes no bookings');
  assert.ok(!names('linden-house').includes('add_to_order'), 'the hotel takes no food orders');
  assert.ok(names('fade-and-co').includes('take_demo_payment'), 'barber deposits need payments');
  assert.ok(!names('linden-house').includes('take_demo_payment'), 'no deposits, no orders, no payments');
});

test('a table booking from availability to confirmation text', async () => {
  const { ctx, actions, sent } = await withCall('lucas-trattoria');
  const avail = await runTool('check_availability', { date: '2026-10-03', time: '19:30', party_size: 4 }, ctx);
  assert.equal(avail.available, true);
  const booked = await runTool('create_booking', { date: '2026-10-03', time: '19:30', party_size: 4, name: 'Sarah Collins' }, ctx);
  assert.equal(booked.booked, true);
  assert.equal(booked.spoken_date, 'Saturday 3 October');
  assert.equal(booked.spoken_time, '7:30pm');
  assert.equal(ctx.state.committed.length, 1);
  assert.equal(actions[0].kind, 'booking_created');
  assert.equal(sent[0].to, '+447700900123');
  assert.match(sent[0].body, /Ref [A-Z]{2}\d{3}/);
  const found = await runTool('find_bookings', {}, ctx);
  assert.equal((found.bookings as any[])[0].reference, booked.reference);
});

test('a large table carries a deposit, paid with the demo card', async () => {
  const { ctx } = await withCall('lucas-trattoria');
  const booked = await runTool('create_booking', { date: '2026-10-08', time: '19:00', party_size: 8, name: 'Office party' }, ctx);
  assert.equal(booked.deposit_due, '£80.00');
  const paid = await runTool('take_demo_payment', { for: 'deposit', card_number: '1234 5678 9012 3456', expiry: '12/34', security_code: '123' }, ctx);
  assert.equal(paid.result, 'approved');
  assert.equal(paid.amount, '£80.00');
  assert.equal((await repo.getBookingByReference(ctx.tenant.id, String(booked.reference)))?.deposit_paid, true);
});

test('an order with options: review, confirm, pay', async () => {
  const { ctx, actions } = await withCall('lucas-trattoria');
  const a = await runTool('add_to_order', { item: 'margheritas', quantity: 2 }, ctx);
  assert.match(String(a.added), /2 × Margherita — £23.00/);
  const b = await runTool('change_order_line', { line: 1, options: ['no basil'] }, ctx);
  assert.match(String(b.updated), /no basil/);
  const c = await runTool('add_to_order', { item: 'tiramisu' }, ctx);
  assert.equal(c.running_total, '£29.50');

  const early = await runTool('confirm_order', { name: 'Sam' }, ctx);
  assert.equal(early.placed, false, 'no confirmation without collection or delivery and a read-back');

  const f = await runTool('set_fulfilment', { type: 'collection', time: 'asap' }, ctx);
  assert.equal(f.ok, true);
  assert.equal(f.time, '17:50');
  const review = await runTool('review_order', {}, ctx);
  assert.equal(review.total, '£29.50');
  assert.match(String(review.read_back), /2 × Margherita \(no basil\); 1 × Tiramisu\. Total £29\.50, for collection at 5:50pm\./);

  await runTool('add_to_order', { item: 'coke' }, ctx);
  const stale = await runTool('confirm_order', { name: 'Sam' }, ctx);
  assert.equal(stale.placed, false, 'the order changed after it was read back');
  const review2 = await runTool('review_order', {}, ctx);
  assert.equal(review2.total, '£32.00');

  const placed = await runTool('confirm_order', { name: 'Sam', allergy_notes: 'nut allergy' }, ctx);
  assert.equal(placed.placed, true);
  assert.equal(placed.total, '£32.00');
  assert.ok(actions.some((x) => x.kind === 'order_placed' && /ALLERGY: nut allergy/.test(x.detail ?? '')));

  const real = await runTool('take_demo_payment', { for: 'order', card_number: '4111 1111 1111 1111' }, ctx);
  assert.equal(real.result, 'refused');
  const declined = await runTool('take_demo_payment', { for: 'order', card_number: '1234 5678 0000 0000' }, ctx);
  assert.equal(declined.result, 'declined');
  const ok = await runTool('take_demo_payment', { for: 'order', card_number: 'one two three four five six seven eight nine zero one two three four five six' }, ctx);
  assert.equal(ok.result, 'approved');
  assert.equal(ctx.state.paid.length, 1);
  const again = await runTool('take_demo_payment', { for: 'order', card_number: '1234567890123456' }, ctx);
  assert.equal(again.result, 'already_paid');

  const payments = await db.query<{ card_last4: string; result: string }>(
    'select card_last4, result from public.voice_payments where call_id = $1 order by created_at', [ctx.callId],
  );
  assert.deepEqual(payments.map((p) => p.card_last4), ['0000', '3456'], 'refused cards are never stored at all');
});

test('delivery: outside the area, under the minimum, then fine', async () => {
  const { ctx } = await withCall('lucas-trattoria');
  await runTool('add_to_order', { item: 'garlic bread' }, ctx);
  const far = await runTool('set_fulfilment', { type: 'delivery', postcode: 'DE1 1AA', address: '1 High St' }, ctx);
  assert.equal(far.ok, false);
  assert.match(String(far.message), /outside the delivery area/);
  const near = await runTool('set_fulfilment', { type: 'delivery', postcode: 'ng7 2rd', address: '5 Lenton Rd' }, ctx);
  assert.equal(near.ok, true);
  const small = await runTool('review_order', {}, ctx);
  assert.equal(small.ok, false);
  assert.match(String(small.message), /minimum order of £15\.00/);
  await runTool('add_to_order', { item: 'lasagne' }, ctx);
  const ok = await runTool('review_order', {}, ctx);
  assert.equal(ok.total, '£22.00');
  assert.match(String(ok.read_back), /Delivery £2\.50/);
});

test('ambiguous and unknown dishes come back as questions', async () => {
  const { ctx } = await withCall('lucas-trattoria');
  const unknown = await runTool('add_to_order', { item: 'chicken tikka' }, ctx);
  assert.equal(unknown.added, false);
  assert.match(String(unknown.question), /not on the menu/);
  const opt = await runTool('add_to_order', { item: 'margherita', options: ['pineapple'] }, ctx);
  assert.equal(opt.added, false);
  assert.match(String(opt.question), /Not an option/);
});

test('allergy questions return the approved wording', async () => {
  const { ctx } = await withCall('lucas-trattoria');
  const r = await runTool('get_item_details', { item: 'tiramisu' }, ctx);
  assert.match(String(r.allergen_answer), /may contain traces of nuts/);
  assert.match(String(r.allergen_answer), /can't guarantee/);
});

test('the café: a coffee needs its size', async () => {
  const { ctx } = await withCall('copper-kettle');
  const noSize = await runTool('add_to_order', { item: 'latte' }, ctx);
  assert.equal(noSize.added, false);
  assert.match(String(noSize.question), /needs a choice of Size/);
  const ok = await runTool('add_to_order', { item: 'latte', options: ['large', 'oat milk'] }, ctx);
  assert.match(String(ok.added), /Latte \(large, oat milk\) — £4\.20/);
});

test('the barber: named barber, deposit, and a knowledge answer', async () => {
  const { ctx } = await withCall('fade-and-co', null);
  const r = await runTool('check_availability', { service: 'skin fade', date: '2026-10-08', time: '18:30', staff: 'Kaz' }, ctx);
  assert.equal(r.available, true);
  assert.equal(r.with, 'Kaz');
  assert.equal(r.price, '£22.00');
  const b = await runTool('create_booking', { service: 'skin fade', date: '2026-10-08', time: '18:30', name: 'Jay', phone: '07700 900456', staff: 'Kaz' }, ctx);
  assert.equal(b.booked, true);
  assert.equal(b.with, 'Kaz');
  assert.equal(b.deposit_due, '£5.00');
  const k = await runTool('search_knowledge', { question: 'do you take walk ins' }, ctx);
  assert.match(String((k.answers as any[])[0].answer), /Appointments only/);
  const none = await runTool('search_knowledge', { question: 'do you sell petrol' }, ctx);
  assert.equal((none.answers as any[]).length, 0);
});

test('messages are stored; transfer falls back when nobody can take the call', async () => {
  const { ctx, actions } = await withCall('linden-house');
  // No phone line (browser demo): the tool is not offered at all.
  assert.match(String((await runTool('transfer_to_staff', { reason: 'wedding enquiry' }, ctx)).error), /No tool/);
  // On a phone line with a handoff number, it transfers with the one-line whisper.
  const calls: string[] = [];
  const phoneCtx = { ...ctx, telephony: { transfer: async (to: string, whisper: string) => (calls.push(`${to}|${whisper}`), true) } };
  phoneCtx.tenant = { ...ctx.tenant, profile: { ...ctx.tenant.profile, handoff_number: '+447700900999' } };
  const t = await runTool('transfer_to_staff', { reason: 'wedding enquiry' }, phoneCtx);
  assert.equal(t.transferred, true);
  assert.deepEqual(calls, ['+447700900999|wedding enquiry']);
  assert.equal(phoneCtx.state.transferRequested, true);
  const m = await runTool('take_message', { name: 'Priya Shah', phone: '07700 900789', message: 'Wedding for 60 in June 2027' }, ctx);
  assert.equal(m.taken, true);
  assert.equal(actions.at(-1)?.kind, 'message_taken');
  const rows = await repo.listMessages(ctx.tenant.id);
  assert.equal(rows[0].from_phone, '+447700900789');
});

test('unknown tools and bad input never throw into the call', async () => {
  const { ctx } = await withCall('lucas-trattoria');
  assert.match(String((await runTool('launch_rockets', {}, ctx)).error), /No tool/);
  const bad = await runTool('create_booking', { date: 'next friday', time: 'evening', name: '' }, ctx);
  assert.equal(bad.booked, false);
});
