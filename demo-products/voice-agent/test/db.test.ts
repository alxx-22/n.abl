import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, migrationFiles, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { DemoRepo, USAGE_KINDS } from '../src/db/demo-repo.ts';
import { seedAll } from '../src/db/seed.ts';
import type { Tenant } from '../src/domain/types.ts';

const NOW = new Date('2026-09-29T14:00:00Z'); // Tuesday 3pm BST
let db: Db;
let repo: Repo;
let lucas: Tenant;
let fade: Tenant;

before(async () => {
  db = await openPglite();
  assert.deepEqual(await migrate(db), ['voice_0001_core', 'voice_0002_demo', 'voice_0003_key_kinds', 'voice_0004_orders', 'voice_0005_estate']);
  repo = new Repo(db);
  const tenants = await seedAll(repo, NOW, { diary: false });
  lucas = tenants.find((t) => t.slug === 'lucas-trattoria')!;
  fade = tenants.find((t) => t.slug === 'fade-and-co')!;
});

after(async () => {
  await db.close();
});

/** Another business made from Luca's, without its demo line PIN: no two businesses may share one. */
function copyOfLucas(slug: string) {
  const { demo_pin: _pin, ...profile } = lucas.profile;
  return repo.upsertTenant({ ...profile, slug, name: slug });
}

test('migrations are idempotent and recorded', async () => {
  assert.deepEqual(await migrate(db), []);
  const rows = await db.query<{ name: string }>('select name from public.voice_schema_migrations');
  assert.deepEqual(rows.map((r) => r.name).sort(), ['voice_0001_core', 'voice_0002_demo', 'voice_0003_key_kinds', 'voice_0004_orders', 'voice_0005_estate']);
});

test('every migration only touches voice_ objects', () => {
  // The Supabase project is shared with the chatbot demo. Any create, alter,
  // drop, index, policy, function, trigger or publication change must name a
  // voice_ object.
  const ddl = /\b(create|alter|drop)\s+(?:unique\s+)?(table|index|view|function|trigger|type|sequence|policy|publication|extension|schema)\s+(?:if\s+(?:not\s+)?exists\s+)?([^\s(;]+)/gi;
  for (const m of migrationFiles()) {
    const sql = m.sql.replace(/--.*$/gm, '');
    for (const hit of sql.matchAll(ddl)) {
      const kind = hit[2].toLowerCase();
      const name = hit[3].replace(/^public\./, '').replace(/"/g, '');
      assert.ok(!['publication', 'extension', 'schema'].includes(kind), `${m.name}: ${kind} changes need to be agreed first`);
      assert.match(name, /^voice_/, `${m.name}: ${hit[0]}`);
    }
    for (const hit of sql.matchAll(/\binsert\s+into\s+([^\s(]+)/gi)) assert.match(hit[1].replace(/^public\./, ''), /^voice_/);
    for (const hit of sql.matchAll(/\bon\s+(public\.)?([a-z_]+)\s*\(/gi)) assert.match(hit[2], /^voice_/, `${m.name}: index on ${hit[2]}`);
    assert.match(m.name, /^voice_/);
  }
});

test('row-level security is on for every voice_ table', async () => {
  const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
    `select relname, relrowsecurity from pg_class where relkind = 'r' and relname like 'voice\\_%'`,
  );
  assert.ok(rows.length >= 10);
  for (const r of rows) assert.equal(r.relrowsecurity, true, r.relname);
});

test('a booking is made, found, moved and cancelled', async () => {
  const r = await repo.createBooking(lucas, {
    date: '2026-10-02', time: '19:30', party_size: 4, name: 'Sarah Collins', phone: '+447700900123', source: 'eval',
  }, NOW);
  assert.ok(r.ok);
  const b = (r as any).booking;
  assert.match(b.reference, /^[AHJKLQRWXY]{2}\d{3}$/);
  assert.equal(b.starts_at.toISOString(), '2026-10-02T18:30:00.000Z');
  assert.equal(b.ends_at.getTime() - b.starts_at.getTime(), 90 * 60000);

  const found = await repo.findBookings(lucas.id, { phone: '+447700900123' }, NOW);
  assert.equal(found[0].reference, b.reference);
  assert.equal((await repo.findBookings(lucas.id, { name: 'collins' }, NOW)).length, 1);
  assert.equal((await repo.findCustomer(lucas.id, '+447700900123'))?.name, 'Sarah Collins');

  const moved = await repo.modifyBooking(lucas, b.reference.toLowerCase(), { time: '20:00', party_size: 5 }, NOW);
  assert.ok(moved.ok);
  assert.equal((moved as any).booking.starts_at.toISOString(), '2026-10-02T19:00:00.000Z');
  assert.equal((moved as any).booking.party_size, 5);

  const cancelled = await repo.cancelBooking(lucas.id, b.reference);
  assert.equal(cancelled?.status, 'cancelled');
  assert.equal((await repo.findBookings(lucas.id, { reference: b.reference }, NOW)).length, 0);
});

test('the last table cannot be taken twice, even by simultaneous calls', async () => {
  // Fill every table that seats 7 to 10 on Saturday at 8pm, bar one.
  const input = { date: '2026-10-03', time: '20:00', party_size: 8, name: 'A', phone: null, source: 'eval' };
  const first = await repo.createBooking(lucas, input, NOW);
  assert.ok(first.ok);
  const results = await Promise.all([
    repo.createBooking(lucas, { ...input, name: 'B' }, NOW),
    repo.createBooking(lucas, { ...input, name: 'C' }, NOW),
  ]);
  const ok = results.filter((r) => r.ok).length;
  assert.equal(ok, 1, 'exactly one of the two simultaneous callers gets the last large table');
  const third = await repo.createBooking(lucas, { ...input, name: 'D' }, NOW);
  assert.equal(third.ok, false);
});

test('deposits: large tables and every barber appointment', async () => {
  const big = await repo.createBooking(lucas, { date: '2026-10-07', time: '19:00', party_size: 8, name: 'Big Party', source: 'eval' }, NOW);
  assert.equal((big as any).booking.deposit_pence, 8000);
  const cut = await repo.createBooking(fade, { service: 'skin fade', date: '2026-10-01', time: '10:00', party_size: 1, name: 'Jay', staff: 'Kaz', source: 'eval' }, NOW);
  assert.ok(cut.ok);
  assert.equal((cut as any).booking.deposit_pence, 500);
  assert.equal((cut as any).booking.resource_key, 'kaz');
});

test('orders are numbered, stored and paid', async () => {
  const order = await repo.createOrder(lucas, {
    name: 'Sam', phone: '+447700900456', fulfilment: 'collection', due_at: new Date('2026-09-29T17:00:00Z'), address: null, postcode: null,
    lines: [{ line: 1, item_key: 'margherita', name: 'Margherita', quantity: 2, unit_pence: 1150, modifiers: [] }],
    subtotal_pence: 2300, delivery_fee_pence: 0, total_pence: 2300, allergy_notes: null, source: 'eval', call_id: null,
  });
  assert.equal(order.reference, '101');
  assert.equal(order.lines[0].name, 'Margherita');
  await repo.recordPayment({ tenant_id: lucas.id, order_id: order.id, amount_pence: 2300, card_last4: '3456', auth_code: 'DEMO-ABCDE', result: 'approved', call_id: null });
  await repo.markOrderPaid(order.id);
  assert.equal((await repo.getOrder(lucas.id, '101'))?.payment_status, 'paid');
});

test('a seeded plan is written as planned, and what it leaves out gets the restaurant\'s literals', async () => {
  const t = await copyOfLucas('seed-columns');
  const at = (iso: string) => new Date(iso);
  const booking = {
    reference: 'AA101', resource_key: 'T1', area_key: 'indoor', starts_at: at('2026-10-02T18:00:00Z'), ends_at: at('2026-10-02T19:30:00Z'),
    party_size: 2, name: 'Ann', phone: '+447700900001', notes: null, allergies: null, tags: [], deposit_pence: 0, deposit_paid: false,
    visit_status: 'expected' as const, booked_via: 'receptionist' as const,
  };
  const lines = [{ line: 1, item_key: 'margherita', name: 'Margherita', quantity: 1, unit_pence: 1150, modifiers: [] }];
  const order = { reference: '101', name: 'Bo', phone: '+447700900002', due_at: at('2026-10-02T18:00:00Z'), lines, subtotal_pence: 1150, total_pence: 1150, allergy_notes: null };
  await repo.insertSeed(t.id, {
    bookings: [booking, { ...booking, reference: 'AA102', resource_key: 'kaz', area_key: null, service_key: 'skin_fade', buffer_minutes: 10 }],
    orders: [
      order,
      {
        ...order, reference: '102', fulfilment: 'delivery', address: '1 High Street', postcode: 'NG1 1AA', delivery_fee_pence: 250, total_pence: 1400,
        created_at: at('2026-10-02T17:20:00Z'), status: 'in_kitchen', payment_status: 'paid',
      },
      {
        ...order, reference: '103', fulfilment: 'delivery', address: '2 High Street', postcode: 'NG1 1AB', ready_at: at('2026-10-02T17:35:00Z'),
        status: 'out_for_delivery', driver: 'Kai', out_at: at('2026-10-02T17:40:00Z'),
      },
    ],
    messages: [],
  });

  const b = await db.query<any>('select reference, service_key, buffer_minutes, source from public.voice_bookings where tenant_id = $1 order by reference', [t.id]);
  assert.deepEqual(b.map((r) => [r.reference, r.service_key, r.buffer_minutes, r.source]), [['AA101', 'table', 0, 'seed'], ['AA102', 'skin_fade', 10, 'seed']]);

  const due = await repo.listOrdersDue(t.id, at('2026-10-02T00:00:00Z'), at('2026-10-03T00:00:00Z'));
  const [plain, delivery] = ['101', '102'].map((ref) => due.find((o) => o.reference === ref)!);
  assert.deepEqual(
    [plain.fulfilment, plain.address, plain.postcode, plain.delivery_fee_pence, plain.status, plain.payment_status, plain.created_at.toISOString()],
    ['collection', null, null, 0, 'confirmed', 'unpaid', '2026-10-02T17:10:00.000Z'],
    'a plan that says nothing more gets a collection, confirmed and unpaid, taken 50 minutes before it is due',
  );
  assert.deepEqual(
    [delivery.fulfilment, delivery.address, delivery.postcode, delivery.delivery_fee_pence, delivery.total_pence, delivery.status, delivery.payment_status, delivery.created_at.toISOString()],
    ['delivery', '1 High Street', 'NG1 1AA', 250, 1400, 'in_kitchen', 'paid', '2026-10-02T17:20:00.000Z'],
  );
  const extra = await db.query<any>('select reference, status, ready_at, driver, out_at from public.voice_orders where tenant_id = $1 order by reference', [t.id]);
  assert.deepEqual(
    extra.map((r) => [r.reference, r.status, r.ready_at && new Date(r.ready_at).toISOString(), r.driver, r.out_at && new Date(r.out_at).toISOString()]),
    [
      ['101', 'confirmed', '2026-10-02T18:00:00.000Z', null, null],
      ['102', 'in_kitchen', null, null, null],
      ['103', 'out_for_delivery', '2026-10-02T17:35:00.000Z', 'Kai', '2026-10-02T17:40:00.000Z'],
    ],
    'a collection is ready when it is due; a delivery when its plan says; out with a driver since when',
  );
  await repo.deleteTenant('seed-columns');
});

test('orders due in a window: all of them, soonest first, where the latest-taken list stops at 50', async () => {
  const t = await copyOfLucas('orders-due');
  const start = new Date('2026-10-02T11:00:00Z').getTime();
  const lines = [{ line: 1, item_key: 'margherita', name: 'Margherita', quantity: 1, unit_pence: 1150, modifiers: [] }];
  // Sixty orders five minutes apart, taken in the reverse order of when they are due.
  const orders = Array.from({ length: 60 }, (_, i) => ({
    reference: String(101 + i), name: `Guest ${i}`, phone: '+447700900003', due_at: new Date(start + i * 5 * 60000),
    created_at: new Date(start - i * 60000), lines, subtotal_pence: 1150, total_pence: 1150, allergy_notes: null,
  }));
  await repo.insertSeed(t.id, { bookings: [], orders, messages: [] });
  const all = await repo.listOrdersDue(t.id, new Date(start), new Date(start + 300 * 60000));
  assert.equal(all.length, 60, 'no cap');
  assert.deepEqual(all.map((o) => o.reference), orders.map((o) => o.reference), 'by due time, not by when they were taken');
  const window = await repo.listOrdersDue(t.id, new Date(start + 10 * 60000), new Date(start + 30 * 60000));
  assert.deepEqual(window.map((o) => o.reference), ['103', '104', '105', '106'], 'from inclusive, to exclusive');
  assert.equal((await repo.listOrders(t.id, new Date(0))).length, 50, 'listOrders is unchanged');
  await repo.deleteTenant('orders-due');
});

test('an order records when the kitchen must have it ready: due, less the road for a delivery', async () => {
  const base = {
    name: 'Ola', phone: '+447700900457', address: null, postcode: null, subtotal_pence: 1150, delivery_fee_pence: 0, total_pence: 1150,
    lines: [{ line: 1, item_key: 'margherita', name: 'Margherita', quantity: 1, unit_pence: 1150, modifiers: [] }],
    allergy_notes: null, source: 'eval', call_id: null,
  };
  const due = new Date('2026-09-29T18:00:00Z');
  const collect = await repo.createOrder(lucas, { ...base, fulfilment: 'collection', due_at: due });
  const deliver = await repo.createOrder(lucas, { ...base, fulfilment: 'delivery', due_at: due, address: '5 Lenton Rd', postcode: 'NG7 2RD', delivery_fee_pence: 250, total_pence: 1400 });
  const ready = async (id: string) => new Date((await db.query<any>('select ready_at from public.voice_orders where id = $1', [id]))[0].ready_at).toISOString();
  assert.equal(await ready(collect.id), '2026-09-29T18:00:00.000Z');
  assert.equal(lucas.profile.ordering?.delivery?.extra_minutes, 20);
  assert.equal(await ready(deliver.id), '2026-09-29T17:40:00.000Z', '20 minutes on the road');
});

test('a demo line PIN belongs to one business, and an ended demo answers none', async () => {
  const t = await copyOfLucas('pin-holder');
  await repo.upsertTenant({ ...t.profile, demo_pin: '4321' });
  assert.equal(await repo.tenantForPin('4321'), t.id);
  await assert.rejects(repo.upsertTenant({ ...t.profile, slug: 'pin-thief', demo_pin: '4321' }), (e: any) => e.code === '23505', 'a second business cannot take it');
  await copyOfLucas('pin-less');
  await copyOfLucas('pin-less-too');
  // A shared demo past its hour, not yet swept: its PIN reaches nobody, but stays taken until it is deleted.
  await db.query(`update public.voice_tenants set expires_at = now() - interval '1 minute' where id = $1`, [t.id]);
  assert.equal(await repo.tenantForPin('4321'), null);
  await db.query(`update public.voice_tenants set expires_at = now() + interval '1 hour' where id = $1`, [t.id]);
  assert.equal(await repo.tenantForPin('4321'), t.id, 'one still running answers');
  for (const slug of ['pin-holder', 'pin-less', 'pin-less-too']) await repo.deleteTenant(slug);
});

test('every kind of usage the code records is one the database accepts, and no more', async () => {
  const demo = new DemoRepo(db);
  const key = await demo.createKey({ hash: 'usage-kinds', prefix: 'USGE', person_name: 'Usage', company: null, expires_at: new Date(Date.now() + 86400000) });
  for (const kind of USAGE_KINDS) await demo.recordUsage(key.id, null, kind, { checked: true });
  assert.equal(await demo.countUsage(key.id, [...USAGE_KINDS], 1), USAGE_KINDS.length);
  // The other way round: the CHECK lists exactly these, so a kind dropped from the code is dropped from the database too.
  const [check] = await db.query<{ def: string }>(
    `select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.voice_demo_usage'::regclass and conname = 'voice_demo_usage_kind_check'`,
  );
  assert.deepEqual([...check.def.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort(), [...USAGE_KINDS].sort());
  await assert.rejects(demo.recordUsage(key.id, null, 'nonsense' as never), /check constraint/);
});

test('a demo reset clears one tenant and leaves the others alone', async () => {
  const before = (await repo.listBookings(fade.id, new Date('2026-09-01'), new Date('2026-12-01'))).length;
  assert.ok(before > 0);
  await repo.resetTenantData(lucas.id);
  assert.equal((await repo.listBookings(lucas.id, new Date('2026-09-01'), new Date('2026-12-01'))).length, 0);
  assert.equal((await repo.listOrders(lucas.id, new Date('2026-01-01'))).length, 0);
  assert.equal((await repo.listBookings(fade.id, new Date('2026-09-01'), new Date('2026-12-01'))).length, before);
});

test('seeding a diary makes a believable week', async () => {
  const tenants = await seedAll(repo, NOW);
  const t = tenants.find((x) => x.slug === 'lucas-trattoria')!;
  const week = await repo.listBookings(t.id, NOW, new Date(NOW.getTime() + 7 * 86400000));
  assert.ok(week.length > 20, `${week.length} bookings`);
  assert.ok(week.every((b) => b.party_size <= 10));
  const again = await seedAll(repo, NOW);
  const week2 = await repo.listBookings(again[1].id === t.id ? t.id : t.id, NOW, new Date(NOW.getTime() + 7 * 86400000));
  assert.equal(week2.length, week.length, 'the same seed gives the same week');
});

