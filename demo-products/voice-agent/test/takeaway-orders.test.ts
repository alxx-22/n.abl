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
  // Nearly there.
  assert.equal((await (await call(t, at('20:05'), AMY)).run('find_order', {})).status, 'out with Kai since 7:42pm; it should be with them any minute');
  // Only a delivery not yet out can go out.
  assert.equal(await repo.sendOutOrder(t.id, o.reference, 'Tom', at('19:50')), null);
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
