// A takeaway's demo over HTTP, as a prospect's browser drives it
// (presets/takeaway.md §6): Start fills today's kitchen, the back office has
// its drivers, a ready delivery waits silently for a driver, sending it out
// texts the customer that it's on its way, and Reset refills the kitchen.

import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.ts';
import { startServer, type App } from '../src/server/main.ts';

let dir: string;
let app: App;
let origin: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'va-takeaway-demo-'));
  app = await startServer({ ...loadConfig(), port: 0, pgliteDir: dir, databaseUrl: undefined, consolePassword: 'team-pass', sessionSecret: 'takeaway-demo-test', demoProxySecret: 'proxy-secret', twilio: undefined }, { sweep: false });
  origin = `http://localhost:${app.port}`;
});

after(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

function client(ip: string) {
  const jar = new Map<string, string>();
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${origin}${path}`, {
      method,
      headers: { 'content-type': 'application/json', origin, 'x-nabl-client-ip': ip, 'x-nabl-proxy': 'proxy-secret', cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const [k, v] = kv.split('=');
      if (v) jar.set(k, v);
      else jar.delete(k);
    }
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, data: type.includes('json') ? ((await res.json()) as any) : await res.text() };
  };
  return { call };
}

test('demo: a takeaway end to end: Start fills the kitchen, a delivery goes out with a driver and the customer hears, Reset refills it', async () => {
  const team = client('10.0.1.1');
  assert.equal((await team.call('POST', '/demo/api/admin/login', { password: 'team-pass' })).status, 200);
  const key = await team.call('POST', '/demo/api/admin/keys', { person_name: 'Dev Shah', company: 'Firebird Chicken & Burgers' });
  const dev = client('10.0.1.2');
  assert.equal((await dev.call('POST', '/demo/api/session', { key: key.data.key })).status, 200);
  const presets = (await dev.call('GET', '/demo/api/presets')).data;
  assert.equal(JSON.stringify(presets).includes('"takeaway"'), true);
  const made = await dev.call('POST', '/demo/api/workspaces', { preset: 'takeaway' });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  const path = `/demo/api/workspaces/${made.data.id}`;
  const answers = (await dev.call('GET', path)).data.answers;
  assert.equal(answers.deals.length, 3);
  answers.basics.name = 'Firebird Chicken & Burgers';
  assert.equal((await dev.call('PUT', `${path}/answers`, answers)).status, 200);
  assert.equal((await dev.call('POST', `${path}/start`)).status, 200);
  const state = async () => (await dev.call('GET', `${path}/state`)).data;
  const s = await state();
  assert.deepEqual(s.workspace.views.map((v: any) => v.id), ['orders', 'drivers', 'messages', 'calls']);
  assert.deepEqual([s.workspace.orders.drivers, s.workspace.orders.advance], [true, true]);
  assert.deepEqual(s.drivers, ['Kai', 'Priya', 'Tom']);
  for (const o of s.orders) assert.ok('driver' in o && 'pay_note' in o, `${o.reference} carries its driver fields`);

  // Whatever the clock says, a delivery of our own, ready and waiting for a driver.
  const t = (await app.repo.getTenantById(made.data.id))!;
  const mine = await app.repo.createOrder(t, {
    name: 'Amy Clarke', phone: '+447700900811', fulfilment: 'delivery', due_at: new Date(Date.now() + 40 * 60_000), address: '14 Larch Close', postcode: 'NG7 1AA',
    lines: [{ line: 1, item_key: 'burger_meal', name: 'Burger meal', quantity: 1, unit_pence: 899, modifiers: [] }], subtotal_pence: 899, delivery_fee_pence: 250, total_pence: 1149, allergy_notes: null, source: 'phone', call_id: null, pay_note: 'Cash: change from £20',
  });
  const texts = async () => (await dev.call('GET', `${path}/phone?number=${encodeURIComponent('+447700900811')}`)).data.messages.map((m: any) => m.body);
  const before = (await texts()).length;
  const ready = await dev.call('PATCH', `${path}/orders/${mine.reference}`, { status: 'ready' });
  assert.equal(ready.status, 200, JSON.stringify(ready.data));
  assert.equal((await texts()).length, before, 'ready on a delivery sends nothing: it waits for a driver');
  assert.equal((await dev.call('PATCH', `${path}/orders/${mine.reference}`, { status: 'out_for_delivery', driver: 'Bob' })).status, 400, 'not one of the drivers');
  const out = await dev.call('PATCH', `${path}/orders/${mine.reference}`, { status: 'out_for_delivery', driver: 'kai' });
  assert.equal(out.status, 200, JSON.stringify(out.data));
  assert.equal((await texts()).at(-1), `Firebird Chicken & Burgers: order ${mine.reference} is on its way with Kai. (Demo)`);
  assert.equal((await dev.call('PATCH', `${path}/orders/${mine.reference}`, { status: 'out_for_delivery', driver: 'Tom' })).status, 409, 'it has already gone');
  const onBoard = (await state()).orders.find((o: any) => o.reference === mine.reference);
  assert.deepEqual([onBoard.status, onBoard.driver, Boolean(onBoard.out_at), onBoard.pay_note], ['out_for_delivery', 'Kai', true, 'Cash: change from £20']);
  assert.equal((await dev.call('PATCH', `${path}/orders/${mine.reference}`, { status: 'completed' })).status, 200);
  // A collection never goes out with a driver.
  const collect = await app.repo.createOrder(t, {
    name: 'Dev', phone: '+447700900812', fulfilment: 'collection', due_at: new Date(Date.now() + 30 * 60_000), address: null, postcode: null,
    lines: [], subtotal_pence: 500, delivery_fee_pence: 0, total_pence: 500, allergy_notes: null, source: 'phone', call_id: null,
  });
  assert.equal((await dev.call('PATCH', `${path}/orders/${collect.reference}`, { status: 'out_for_delivery', driver: 'Kai' })).status, 409);

  // A caller's requests wait on the ticket: refused, the order stands; accepted, it's cancelled. The customer is texted either way.
  const asks = async (kind: 'cancel' | 'change', what: string) => app.repo.requestOnOrder(t.id, collect.reference, { kind, what, phone: '+447700900812', at: new Date().toISOString() });
  await asks('change', 'no onions');
  await asks('cancel', 'ordered twice');
  const board = (await state()).orders.find((o: any) => o.reference === collect.reference);
  assert.deepEqual(board.requests.map((r: any) => [r.kind, r.what, r.answer]), [['change', 'no onions', null], ['cancel', 'ordered twice', null]]);
  const phone2 = async () => (await dev.call('GET', `${path}/phone?number=${encodeURIComponent('+447700900812')}`)).data.messages.map((m: any) => m.body);
  assert.equal((await dev.call('PATCH', `${path}/orders/${collect.reference}`, { request: 0, answer: 'refused' })).status, 200);
  assert.equal((await phone2()).at(-1), `Firebird Chicken & Burgers: sorry, we couldn't make your change to order ${collect.reference} (no onions). (Demo)`);
  assert.equal((await dev.call('PATCH', `${path}/orders/${collect.reference}`, { request: 0, answer: 'accepted' })).status, 409, 'answered once');
  assert.equal((await dev.call('PATCH', `${path}/orders/${collect.reference}`, { request: 1, answer: 'maybe' })).status, 400);
  assert.equal((await dev.call('PATCH', `${path}/orders/${collect.reference}`, { request: 1, answer: 'accepted' })).status, 200);
  assert.equal((await phone2()).at(-1), `Firebird Chicken & Burgers: order ${collect.reference} is cancelled. (Demo)`);
  assert.equal((await app.repo.getOrder(t.id, collect.reference))!.status, 'cancelled');

  // Reset refills the kitchen from the seed, and our own orders go.
  assert.equal((await dev.call('POST', `${path}/reset`)).status, 200);
  const again = await state();
  assert.ok(!again.orders.some((o: any) => o.phone === '07700 900811'), 'the prospect\'s own orders are cleared');
  assert.deepEqual(again.drivers, ['Kai', 'Priya', 'Tom']);
});
