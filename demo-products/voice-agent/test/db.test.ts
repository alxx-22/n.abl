import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, migrationFiles, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { seedAll } from '../src/db/seed.ts';
import type { Tenant } from '../src/domain/types.ts';

const NOW = new Date('2026-09-29T14:00:00Z'); // Tuesday 3pm BST
let db: Db;
let repo: Repo;
let lucas: Tenant;
let fade: Tenant;

before(async () => {
  db = await openPglite();
  assert.deepEqual(await migrate(db), ['voice_0001_core', 'voice_0002_demo']);
  repo = new Repo(db);
  const tenants = await seedAll(repo, NOW, { diary: false });
  lucas = tenants.find((t) => t.slug === 'lucas-trattoria')!;
  fade = tenants.find((t) => t.slug === 'fade-and-co')!;
});

after(async () => {
  await db.close();
});

test('migrations are idempotent and recorded', async () => {
  assert.deepEqual(await migrate(db), []);
  const rows = await db.query<{ name: string }>('select name from public.voice_schema_migrations');
  assert.deepEqual(rows.map((r) => r.name).sort(), ['voice_0001_core', 'voice_0002_demo']);
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
