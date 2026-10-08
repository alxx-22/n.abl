import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, migrationFiles, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { DemoRepo, USAGE_KINDS } from '../src/db/demo-repo.ts';
import { seedAll } from '../src/db/seed.ts';
import type { Tenant } from '../src/domain/types.ts';
import { builtPreset, answersOf } from '../src/presets/index.ts';
import { planEstateSeed } from '../src/presets/estate/seed.ts';
import { viewingRules } from '../src/domain/listings.ts';
import { sampleProperties } from '../src/presets/maintenance/properties.ts';
import { planMaintenanceSeed } from '../src/presets/maintenance/seed.ts';

const NOW = new Date('2026-09-29T14:00:00Z'); // Tuesday 3pm BST
let db: Db;
let repo: Repo;
let lucas: Tenant;
let fade: Tenant;

before(async () => {
  db = await openPglite();
  assert.deepEqual(await migrate(db), ['voice_0001_core', 'voice_0002_demo', 'voice_0003_key_kinds', 'voice_0004_orders', 'voice_0005_estate', 'voice_0006_maintenance', 'voice_0007_mt_money', 'voice_0008_mt_blocks', 'voice_0009_takeaway']);
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
  assert.deepEqual(rows.map((r) => r.name).sort(), ['voice_0001_core', 'voice_0002_demo', 'voice_0003_key_kinds', 'voice_0004_orders', 'voice_0005_estate', 'voice_0006_maintenance', 'voice_0007_mt_money', 'voice_0008_mt_blocks', 'voice_0009_takeaway']);
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

// ── The estate agent's records (presets/estate-agent.md §5) ──────────────

/** Hartwell & Green, compiled through the registry, without a demo line PIN. */
async function estateTenant(slug: string): Promise<Tenant> {
  const preset = builtPreset('estate_agent')!;
  const a = preset.defaults();
  a.basics.name = 'Hartwell & Green';
  return repo.upsertTenant(preset.compile(answersOf(preset, a), { slug }));
}

const ESTATE_TABLES = ['voice_listings', 'voice_offers', 'voice_sales'];
const count = async (table: string, tenantId: string) => Number((await db.query<{ n: number }>(`select count(*)::int as n from public.${table} where tenant_id = $1`, [tenantId]))[0].n);

test('estate: a seeded fortnight reads back as planned', async () => {
  const t = await estateTenant('estate-seed');
  const now = new Date('2026-10-07T10:00:00Z');
  const plan = planEstateSeed(t.profile, now, 7);
  await repo.insertSeed(t.id, plan);
  const listings = await repo.listingStates(t.id);
  assert.equal(listings.length, 18);
  const mill = listings.find((l) => l.listing_key === 'mill_31')!;
  assert.deepEqual(mill, plan.listings!.find((l) => l.listing_key === 'mill_31'), 'a home row, field for field');
  assert.deepEqual(await repo.sellersOf(t.id, 'larkspur_14'), [{ name: 'Sarah Collins', phone: '+447700900001' }]);
  const offers = await repo.listOffers(t.id);
  assert.equal(offers.length, 9);
  const planned = plan.offers!.find((o) => o.phone === '+447700900003')!;
  const stored = offers.find((o) => o.reference === planned.reference)!;
  assert.deepEqual({ ...stored, source: undefined, call_id: undefined }, { ...planned, source: undefined, call_id: undefined });
  assert.equal(stored.source, 'seed');
  const sales = await repo.listSales(t.id);
  const byHome = <T extends { listing_key: string }>(xs: T[]) => [...xs].sort((a, b) => a.listing_key.localeCompare(b.listing_key));
  assert.deepEqual(byHome(sales.map(({ id: _id, ...x }) => x)), byHome(plan.sales!));
  const bookings = await repo.listBookings(t.id, new Date('2026-09-01'), new Date('2026-11-01'));
  assert.equal(bookings.length, plan.bookings.length);
  const viewing = plan.bookings.find((b) => b.listing_key === 'albion_22')!;
  const back = bookings.find((b) => b.reference === viewing.reference)!;
  assert.deepEqual([back.listing_key, back.details, back.service_key], [viewing.listing_key, viewing.details, 'viewing']);
  const buyers = await repo.listBuyers(t.id);
  assert.equal(buyers.length, plan.people!.filter((x) => x.details.roles?.includes('buyer')).length);
  const sam = buyers.find((b) => b.phone === '+447700900002')!;
  assert.deepEqual(sam, plan.people!.find((x) => x.phone === '+447700900002'));
  const messages = await repo.listMessages(t.id, 60);
  const complaint = messages.find((m) => m.category === 'complaint');
  assert.ok(complaint && complaint.reference && complaint.for_staff === 'rachel' && complaint.urgency === 'this_week' && complaint.details.final_by);
  assert.equal(messages.filter((m) => m.kind === 'message').length, 9);
  assert.equal((await repo.listTexts(t.id, '+447700900003')).length, 2, "the offer texts on Aisha's phone");
  await repo.deleteTenant('estate-seed');
});

test('estate: homes, offers and sales go with their business, and Reset clears them', async () => {
  const keep = await estateTenant('estate-keep');
  const gone = await estateTenant('estate-gone');
  const now = new Date('2026-10-07T10:00:00Z');
  for (const t of [keep, gone]) await repo.insertSeed(t.id, planEstateSeed(t.profile, now, 3));
  for (const table of ESTATE_TABLES) assert.ok((await count(table, gone.id)) > 0, table);
  await repo.resetTenantData(gone.id);
  for (const table of ESTATE_TABLES) assert.equal(await count(table, gone.id), 0, `${table} is reset`);
  assert.equal((await repo.listBuyers(gone.id)).length, 0);
  await repo.insertSeed(gone.id, planEstateSeed(gone.profile, now, 4));
  await repo.deleteTenant('estate-gone');
  for (const table of ESTATE_TABLES) assert.equal(await count(table, gone.id), 0, `${table} goes with its business`);
  for (const table of ESTATE_TABLES) assert.ok((await count(table, keep.id)) > 0, `${table}: the other business keeps its rows`);
  // Every estate table names its business and goes with it.
  const fks = await db.query<{ table_name: string; delete_rule: string }>(
    `select tc.table_name, rc.delete_rule from information_schema.table_constraints tc
     join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
     join information_schema.constraint_column_usage cu on cu.constraint_name = tc.constraint_name
     where tc.constraint_type = 'FOREIGN KEY' and cu.table_name = 'voice_tenants' and tc.table_name = any($1::text[])`,
    [ESTATE_TABLES],
  );
  assert.deepEqual(fks.map((f) => `${f.table_name}:${f.delete_rule}`).sort(), ESTATE_TABLES.map((x) => `${x}:CASCADE`).sort());
  await repo.deleteTenant('estate-keep');
});

test('estate: staff change a home, the builder syncs it, and both are logged', async () => {
  const t = await estateTenant('estate-sync');
  const now = new Date('2026-10-07T10:00:00Z');
  await repo.insertSeed(t.id, planEstateSeed(t.profile, now, 5));
  const reduced = await repo.setListing(t.id, 'albion_22', { price_pence: 31_500_000, blocked: [{ from: '2026-10-10', to: '2026-10-11', note: 'Away' }] });
  assert.equal(reduced!.price_pence, 31_500_000);
  assert.deepEqual(reduced!.blocked, [{ from: '2026-10-10', to: '2026-10-11', note: 'Away' }]);
  assert.match(reduced!.history.at(-1)!.what, /price 325000 → 315000, blocked dates changed/);
  const agreed = await repo.setListing(t.id, 'albion_22', { status: 'sale_agreed', marketing_continues: false, best_final_at: null });
  assert.deepEqual([agreed!.status, agreed!.marketing_continues, agreed!.best_final_at], ['sale_agreed', false, null]);
  assert.equal(await repo.setListing(t.id, 'nowhere', { status: 'available' }), null);
  // The builder: a price changed there wins; a status staff changed stays; a new home appears; a removed one goes.
  const preset = builtPreset('estate_agent')!;
  const a = preset.defaults() as any;
  a.basics.name = 'Hartwell & Green';
  a.listings.find((l: any) => l.key === 'albion_22').price_pence = 33_000_000;
  a.listings = a.listings.filter((l: any) => l.key !== 'meadow_view_10');
  a.listings.push({ ...structuredClone(a.listings[0]), key: 'new_home', street: 'New Street', number: '1' });
  await repo.syncListings(t.id, preset.compile(answersOf(preset, a), { slug: 'estate-sync' }), now);
  const rows = await repo.listingStates(t.id);
  const albion = rows.find((r) => r.listing_key === 'albion_22')!;
  assert.deepEqual([albion.price_pence, albion.status], [33_000_000, 'sale_agreed']);
  assert.equal(albion.history.at(-1)!.what, 'set in the builder');
  assert.ok(rows.some((r) => r.listing_key === 'new_home' && r.status === 'available'));
  assert.ok(!rows.some((r) => r.listing_key === 'meadow_view_10'));
  const untouched = rows.find((r) => r.listing_key === 'larkspur_14')!;
  assert.equal(untouched.history.length, 1, 'a home the builder did not change is left alone');
  await repo.deleteTenant('estate-sync');
});

test('estate: an offer is recorded, sent, decided, and opens a sale; a buyer is remembered', async () => {
  const t = await estateTenant('estate-offer');
  const o = await repo.createOffer(t, {
    listing_key: 'albion_22', amount_pence: 32_000_000, buyer_names: ['Sam Price', 'Alex Price'], phone: '+447700900002',
    position: { first_time_buyer: true, selling: 'nothing', funding: 'mortgage_aip' }, conditions: 'subject to survey', source: 'browser',
  });
  assert.match(o.reference, /^[AHJKLQRWXY]{2}\d{3}$/);
  assert.deepEqual([o.status, o.sent_at, o.history[0].what, o.history[0].by], ['received', null, 'received', 'receptionist']);
  assert.equal((await repo.findOffer(t.id, { reference: o.reference.toLowerCase() }))[0].amount_pence, 32_000_000);
  assert.equal((await repo.findOffer(t.id, { phone: '+447700900002' })).length, 1);
  assert.deepEqual(await repo.findOffer(t.id, {}), []);
  const sentAt = new Date('2026-10-07T14:10:00Z');
  const sent = await repo.setOfferStatus(t.id, o.reference, 'sent', { at: sentAt });
  assert.deepEqual([sent!.status, sent!.sent_at?.toISOString(), sent!.decided_at], ['sent', sentAt.toISOString(), null]);
  const accepted = await repo.setOfferStatus(t.id, o.reference, 'accepted', { note: 'Viewings continue' });
  assert.ok(accepted!.decided_at && accepted!.sent_at?.toISOString() === sentAt.toISOString());
  assert.deepEqual(accepted!.history.map((h) => h.what), ['received', 'sent to the seller', 'accepted']);
  assert.equal(await repo.setOfferStatus(t.id, 'ZZ999', 'sent'), null);
  const sale = await repo.createSale(t.id, {
    listing_key: 'albion_22', offer_ref: o.reference, buyer_name: 'Sam Price', buyer_phone: '+447700900002', agreed_pence: 32_000_000,
    milestones: [{ key: 'memorandum_sent', done_at: null }], exchange_target: null, completion_date: null, parties: [], chain: null,
  });
  assert.equal(sale.status, 'progressing');
  const ticked = await repo.updateSale(t.id, sale.id!, { milestones: [{ key: 'memorandum_sent', done_at: '2026-10-08T09:00:00.000Z' }], completion_date: '2026-11-20' }, { by: 'staff', what: 'memorandum sent' });
  assert.deepEqual([ticked!.milestones[0].done_at, ticked!.completion_date, ticked!.updates.at(-1)!.what], ['2026-10-08T09:00:00.000Z', '2026-11-20', 'memorandum sent']);
  // A buyer: what a call learns is merged over what was known, and consent keeps its time.
  await repo.upsertBuyer(t.id, '+447700900002', 'Sam Price', { roles: ['buyer'], position: { funding: 'cash' } });
  const merged = await repo.upsertBuyer(t.id, '+447700900002', null, { requirements: { min_beds: 3 } }, true);
  assert.deepEqual([merged.name, merged.details.position, merged.details.requirements, merged.marketing_consent], ['Sam Price', { funding: 'cash' }, { min_beds: 3 }, true]);
  assert.ok(merged.details.consent_at);
  const off = await repo.upsertBuyer(t.id, '+447700900002', null, {}, false);
  assert.deepEqual([off.marketing_consent, off.details.consent_at], [false, null]);
  assert.equal((await repo.listBuyers(t.id)).length, 1);
  await repo.deleteTenant('estate-offer');
});

test('estate: a viewing is booked under its home\'s rules and carries the home and the buyer', async () => {
  const t = await estateTenant('estate-viewing');
  const now = new Date('2026-10-07T10:00:00Z');
  const house = t.profile.listings!.find((l) => l.key === 'albion_22')!;
  const rule = viewingRules(house, t.profile, 'viewing');
  const details = { kind: 'viewing', position: { funding: 'mortgage_aip', selling: 'not_on_market' }, badges: ['AIP', 'Chain'] };
  const r = await repo.createBooking(t, { service: 'viewing', date: '2026-10-10', time: '11:15', party_size: 2, name: 'Sam Price', phone: '+447700900002', source: 'browser', listing: rule, details }, now);
  assert.ok(r.ok, JSON.stringify(r));
  const b = (r as any).booking;
  assert.deepEqual([b.listing_key, b.details, b.resource_key, b.ends_at.toISOString()], ['albion_22', details, 'jess', '2026-10-10T10:45:00.000Z']);
  // The same home at the same time, even with Tom free: refused.
  const clash = await repo.createBooking(t, { service: 'viewing', date: '2026-10-10', time: '11:30', party_size: 1, name: 'Ann Lee', source: 'browser', listing: rule, staff: 'tom' }, now);
  assert.equal(clash.ok, false);
  // Outside the seller's hours: refused; a move must keep to them too.
  assert.equal((await repo.createBooking(t, { service: 'viewing', date: '2026-10-08', time: '12:00', party_size: 1, name: 'Ann Lee', source: 'browser', listing: rule }, now)).ok, false);
  assert.equal((await repo.modifyBooking(t, b.reference, { time: '14:00', listing: rule }, now)).ok, false);
  const moved = await repo.modifyBooking(t, b.reference, { time: '12:00', listing: rule, details: { feedback: { category: 'keen', words: 'Lovely garden.' } } }, now);
  assert.ok(moved.ok);
  assert.deepEqual((moved as any).booking.details, { ...details, feedback: { category: 'keen', words: 'Lovely garden.' } });
  // A message for someone, about something, urgent.
  await repo.addMessage({ tenant_id: t.id, kind: 'message', from_name: 'Sam Price', from_phone: '+447700900002', body: 'Running late.', status: 'new', for_staff: 'jess', category: 'viewing', urgency: 'urgent', details: { property: 'albion_22' } });
  const [m] = await repo.listMessages(t.id, 1);
  assert.deepEqual([m.for_staff, m.category, m.urgency, m.reference, m.details], ['jess', 'viewing', 'urgent', null, { property: 'albion_22' }]);
  await assert.rejects(repo.addMessage({ tenant_id: t.id, kind: 'message', body: 'x', status: 'new', urgency: 'whenever' as never }), /check constraint/);
  await repo.deleteTenant('estate-viewing');
});

test('property maintenance: properties, jobs, certificates and safety calls go with their business, and Reset clears them', async () => {
  const preset = builtPreset('property_maintenance')!;
  const a = preset.defaults();
  a.basics.name = 'Fernhill Property Care';
  const t = await repo.upsertTenant(preset.compile(answersOf(preset, a), { slug: 'mt-rows' }));
  const props = sampleProperties();
  const elm = props.find((p) => p.key === 'elm_14')!;
  await repo.insertSeed(t.id, {
    bookings: [], orders: [], messages: [],
    properties: props,
    jobs: [{
      reference: 'HK101', property_key: 'elm_14', client_key: 'whitfield', reporter: { name: 'Sam Ortiz', phone: elm.occupant.phone, role: 'occupant' }, trade: 'plumbing', priority: 'urgent',
      reason: 'Urgent: a leak under the sink', description: 'Leak under the kitchen sink', kind: 'repair', status: 'on_the_way', visit_date: '2026-10-07', window_key: 'am', attend_by: null,
      engineer_key: 'marek', eta_minutes: 20, on_the_way_at: new Date('2026-10-07T09:40:00Z'), po: null, claim_ref: null, price_pence: null, clocks: [], reporters: [], flags: [], access_attempts: 0, waiting_for: null, notes: null,
      history: [{ at: '2026-10-06T15:00:00.000Z', by: 'staff', what: 'raised' }], source: 'seed', created_at: new Date('2026-10-06T15:00:00Z'), done_at: null,
    }],
    certificates: [{ property_key: 'elm_14', kind: 'gas_record', issued: '2025-11-14', expires: '2026-11-14', remedials: [], booked_job: null }],
    incidents: [{ property_key: null, kind: 'gas', advice_version: 1, advised_at: new Date('2026-10-05T19:02:10Z'), caller_phone: '+447700900599', follow_up_job: null, notes: null, source: 'seed', created_at: new Date('2026-10-05T19:02:00Z') }],
  });
  const stored = await repo.listMtProperties(t.id);
  assert.equal(stored.length, 90);
  assert.deepEqual(await repo.getMtProperty(t.id, 'elm_14'), elm, 'a property reads back as it was planned');
  // A job, by its reference however it is said, and from the occupant's number even though someone else reported it.
  const [job] = await repo.listJobs(t.id, { reference: 'h k 1 0 1' });
  assert.deepEqual([job.status, job.visit_date, job.window_key, job.engineer_key, job.eta_minutes], ['on_the_way', '2026-10-07', 'am', 'marek', 20]);
  assert.equal((await repo.listJobs(t.id, { phone: elm.occupant.phone! })).length, 1);
  assert.equal((await repo.listJobs(t.id, { phone: '+447700900999' })).length, 0, 'a stranger\'s number finds nothing');
  // A new job never reuses a reference; a status change is guarded and logged.
  const made = await repo.createJob(t, { trade: 'electrical', priority: 'routine', description: 'Socket not working', kind: 'repair', property_key: 'elm_14', status: 'scheduled', visit_date: '2026-10-09', window_key: 'pm', engineer_key: 'priya', source: 'browser' });
  assert.notEqual(made.reference, 'HK101');
  assert.match(made.reference, /^[A-Z]{2}\d{3}$/);
  const onWay = await repo.updateJob(t.id, made.reference, { status: 'on_the_way', eta_minutes: 25 }, 'on the way', { from: ['scheduled'] });
  assert.deepEqual([onWay!.status, onWay!.eta_minutes, onWay!.history.at(-1)!.what], ['on_the_way', 25, 'on the way']);
  assert.equal(await repo.updateJob(t.id, made.reference, { status: 'on_the_way' }, 'again', { from: ['scheduled'] }), null, 'two clicks cannot both dispatch it');
  // Certificates read back with their dates as days; booking one marks it.
  await repo.setCertificateBooked(t.id, 'elm_14', 'gas_record', made.reference);
  assert.deepEqual(await repo.listCertificates(t.id, 'elm_14'), [{ property_key: 'elm_14', kind: 'gas_record', issued: '2025-11-14', expires: '2026-11-14', remedials: [], booked_job: made.reference }]);
  // A safety call is logged, then marked when the advice was said.
  const inc = await repo.logIncident(t.id, { property_key: 'elm_14', kind: 'gas', advice_version: 1, advised_at: null, caller_phone: elm.occupant.phone, follow_up_job: null, notes: null, source: 'browser' });
  const said = await repo.updateIncident(t.id, inc.id, { advised_at: new Date('2026-10-07T10:00:05Z') });
  assert.equal(said!.advised_at!.toISOString(), '2026-10-07T10:00:05.000Z');
  assert.equal((await repo.listIncidents(t.id)).length, 2);
  // Reset clears them all; the business stays.
  await repo.resetTenantData(t.id);
  assert.deepEqual([(await repo.listMtProperties(t.id)).length, (await repo.listJobs(t.id)).length, (await repo.listCertificates(t.id)).length, (await repo.listIncidents(t.id)).length], [0, 0, 0, 0]);
  await repo.deleteTenant('mt-rows');
});

test('property maintenance: a seeded week is written whole and reads back as planned', async () => {
  const preset = builtPreset('property_maintenance')!;
  const a = preset.defaults();
  a.basics.name = 'Fernhill Property Care';
  const t = await repo.upsertTenant(preset.compile(answersOf(preset, a), { slug: 'mt-week' }));
  const plan = planMaintenanceSeed(t.profile, new Date('2026-10-07T10:00:00Z'), 7);
  await repo.insertSeed(t.id, plan);
  const jobs = await repo.listJobs(t.id);
  assert.equal(jobs.length, plan.jobs!.length);
  const elm = jobs.find((j) => j.property_key === 'elm_14')!;
  const planned = plan.jobs!.find((j) => j.property_key === 'elm_14')!;
  assert.deepEqual({ ...elm, id: undefined }, { ...planned, id: undefined, source: 'seed' });
  assert.equal((await repo.listCertificates(t.id)).length, plan.certificates!.length);
  assert.equal((await repo.listIncidents(t.id)).length, 1);
  assert.equal((await repo.listMtProperties(t.id)).length, 90);
  await repo.deleteTenant('mt-week');
});
