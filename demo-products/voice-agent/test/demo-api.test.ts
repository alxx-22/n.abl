// The demo service end to end over HTTP, without a browser or a model: the
// team issues a key, a prospect enters it, builds a restaurant, presses
// Start, and works the back office. Uses a throwaway PGlite database.

import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { loadConfig } from '../src/config.ts';
import { startServer, type App } from '../src/server/main.ts';
import { sweep } from '../src/demo/sweeper.ts';
import { signSession } from '../src/demo/access.ts';
import { clientIp } from '../src/server/http.ts';
import type { IncomingMessage } from 'node:http';

let app: App;
let dir: string;
let origin: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'va-demo-api-'));
  app = await startServer({ ...loadConfig(), port: 0, pgliteDir: dir, databaseUrl: undefined, consolePassword: 'team-pass', sessionSecret: 'demo-api-test', demoProxySecret: 'proxy-secret', twilio: undefined }, { sweep: false });
  origin = `http://localhost:${app.port}`;
});

after(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A tiny cookie-keeping client, as a browser would be. */
function client(ip: string) {
  const jar = new Map<string, string>();
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${origin}${path}`, {
      method,
      headers: {
        // As the site's Worker sends them: the visitor's address, vouched for by the shared secret.
        'content-type': 'application/json', origin, 'x-nabl-client-ip': ip, 'x-nabl-proxy': 'proxy-secret',
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      },
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
    return { status: res.status, headers: res.headers, data: type.includes('json') ? ((await res.json()) as any) : await res.text() };
  };
  return { call, jar };
}

const team = client('10.0.0.1');
const sam = client('10.0.0.2');
let rawKey = '';
let ws = '';

test('demo: the root leads to the console, and nothing under /demo is indexed', async () => {
  const r = await fetch(`${origin}/`, { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/demo/admin');
  assert.equal((await fetch(`${origin}/demo`, { redirect: 'manual' })).headers.get('location'), '/demo/');
  const robots = await fetch(`${origin}/demo/robots.txt`);
  assert.match(await robots.text(), /Disallow: \//);
  assert.equal(robots.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal((await fetch(`${origin}/demo/healthz`)).status, 200);
});

test('demo: the team signs in and issues a key, shown once', async () => {
  assert.equal((await team.call('GET', '/demo/api/admin/keys')).status, 401);
  assert.equal((await team.call('POST', '/demo/api/admin/login', { password: 'nope' })).status, 401);
  assert.equal((await team.call('POST', '/demo/api/admin/login', { password: 'team-pass' })).status, 200);
  const r = await team.call('POST', '/demo/api/admin/keys', { person_name: 'Sam Price', company: "Sam's Kitchen", days: 14, limits: { workspaces: 2 } });
  assert.equal(r.status, 201);
  rawKey = r.data.key;
  assert.match(rawKey, /^DEMO-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(r.data.magic_link.endsWith(`/demo/reception#key=${rawKey}`), true);
  const list = await team.call('GET', '/demo/api/admin/keys');
  assert.equal(list.data.keys.length, 1);
  assert.equal(list.data.keys[0].key_hash, undefined, 'the hash never leaves the server');
  assert.ok(!JSON.stringify(list.data).includes(rawKey.slice(5)), 'nor the key');
});

test('demo: a wrong key is refused, and the throttle stops an address guessing', async () => {
  const guesser = client('10.9.9.9');
  assert.equal((await guesser.call('GET', '/demo/api/me')).status, 401);
  for (let i = 0; i < 10; i++) {
    const r = await guesser.call('POST', '/demo/api/session', { key: `DEMO-AAAA-AAAA-AA${'ABCDEFGHJK'[i]}${'ABCDEFGHJK'[i]}` });
    assert.equal(r.status, 401);
  }
  const blocked = await guesser.call('POST', '/demo/api/session', { key: rawKey });
  assert.equal(blocked.status, 429, 'even the right key, from an address that has been guessing');
});

test('demo: an address claimed without the proxy secret is not believed', async () => {
  // Straight to the server, pretending to be many visitors: all one address to the throttle.
  const spoof = (n: number) => fetch(`${origin}/demo/api/session`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin, 'x-nabl-client-ip': `203.0.113.${n}`, 'x-forwarded-for': `198.51.100.${n}`, 'cf-connecting-ip': `192.0.2.${n}`, 'x-real-ip': `192.0.2.${n + 50}`, 'fly-client-ip': `192.0.2.${n + 100}` },
    body: JSON.stringify({ key: 'DEMO-BBBB-BBBB-BBBB' }),
  });
  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) statuses.push((await spoof(i)).status);
  assert.equal(statuses.at(-1), 429, `statuses ${statuses.join(',')}`);
});

test('demo: the visitor address comes from the Worker with its secret, else the front proxy\'s own header, else the socket', () => {
  const req = (headers: Record<string, string>) => ({ headers, socket: { remoteAddress: '172.18.0.3' } }) as unknown as IncomingMessage;
  const viaWorker = { 'x-nabl-proxy': 'proxy-secret', 'x-nabl-client-ip': '203.0.113.7', 'x-real-ip': '104.16.0.1' };
  assert.equal(clientIp(req(viaWorker), 'proxy-secret', 'x-real-ip'), '203.0.113.7');
  assert.equal(clientIp(req({ ...viaWorker, 'x-nabl-proxy': 'wrong-secret' }), 'proxy-secret', 'x-real-ip'), '104.16.0.1');
  assert.equal(clientIp(req({ 'x-real-ip': '198.51.100.9' }), 'proxy-secret', 'x-real-ip'), '198.51.100.9');
  // Without a front proxy, nothing a client writes counts.
  assert.equal(clientIp(req({ 'x-real-ip': '198.51.100.9', 'fly-client-ip': '198.51.100.10', 'x-forwarded-for': '198.51.100.11' }), 'proxy-secret'), '172.18.0.3');
});

test('demo: the right key opens a session, forgiving case and spaces', async () => {
  const r = await sam.call('POST', '/demo/api/session', { key: ` ${rawKey.toLowerCase().replace(/-/g, ' ')} ` });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.person_name, 'Sam Price');
  assert.equal(r.data.limits.workspaces, 2);
  assert.ok(sam.jar.get('demo_s'));
  const me = await sam.call('GET', '/demo/api/me');
  assert.equal(me.data.company, "Sam's Kitchen");
  assert.deepEqual(me.data.workspaces, []);
  // A cross-site request with the cookie is refused.
  const cross = await fetch(`${origin}/demo/api/workspaces`, { method: 'POST', headers: { origin: 'https://evil.example', cookie: `demo_s=${sam.jar.get('demo_s')}` }, body: '{"preset":"restaurant"}' });
  assert.equal(cross.status, 403);
});

test('demo: pick the restaurant, build it, press Start', async () => {
  const presets = await sam.call('GET', '/demo/api/presets');
  assert.equal(presets.data.presets.find((p: any) => p.key === 'restaurant').status, 'live');
  assert.equal((await sam.call('POST', '/demo/api/workspaces', { preset: 'barber' })).status, 400, 'not built yet');

  const made = await sam.call('POST', '/demo/api/workspaces', { preset: 'restaurant', website: 'https://sams-kitchen.example' });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  ws = made.data.id;
  assert.equal(made.data.name, "Sam's Kitchen", 'named after the company on the key');
  assert.equal(made.data.answers.basics.website, 'https://sams-kitchen.example');
  assert.equal(made.data.started_at, null);
  assert.match(made.data.slug, /^demo-[a-z2-9]{4}-sam-s-kitchen-[0-9a-f]{4}$/);

  // Not started: no calls yet.
  const early = await new Promise<string>((resolve) => {
    const s = new WebSocket(`ws://localhost:${app.port}/demo/ws/talk?workspace=${ws}`, { headers: { origin, cookie: `demo_s=${sam.jar.get('demo_s')}` } });
    s.on('message', (m) => resolve(JSON.parse(String(m)).message));
    s.on('error', () => resolve('error'));
  });
  assert.match(early, /Press Start first/);

  // Edit: deposits for six or more, terrace off, a name that needs escaping.
  const a = made.data.answers;
  a.basics.name = 'Sam’s <Kitchen>';
  a.money.deposit.min_party = 6;
  a.seating.areas = a.seating.areas.filter((x: any) => x.key !== 'terrace');
  const saved = await sam.call('PUT', `/demo/api/workspaces/${ws}/answers`, a);
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.answers.seating.tables.every((t: any) => t.area === 'indoor'), true, 'terrace tables moved into a real area');
  assert.match(saved.data.preview.greeting, /\bAI\b/);
  assert.equal(saved.data.preview.covers.length, 1);

  const started = await sam.call('POST', `/demo/api/workspaces/${ws}/start`);
  assert.equal(started.status, 200, JSON.stringify(started.data));
  assert.ok(started.data.bookings > 20, `seeded ${started.data.bookings} bookings`);
  assert.ok(started.data.workspace.started_at);

  const state = await sam.call('GET', `/demo/api/workspaces/${ws}/state`);
  assert.equal(state.status, 200);
  assert.equal(state.data.tenant.name, 'Sam’s <Kitchen>');
  assert.ok(state.data.plan.tables.length >= 10);
  assert.ok(state.data.bookings.length > 20);
  assert.ok(state.data.bookings.some((b: any) => b.source === 'seed'));
});

test('demo: the back office moves, combines, seats and cancels, with texts', async () => {
  const state = (await sam.call('GET', `/demo/api/workspaces/${ws}/state`)).data;
  const b = state.bookings.find((x: any) => x.status === 'confirmed' && x.party_size <= 2 && x.date > state.today);
  assert.ok(b, 'a small booking in the coming days');

  // Onto a table that is free at that time and big enough.
  const busy = new Set(state.bookings.filter((x: any) => x.status === 'confirmed' && x.starts_at < b.ends_at && x.ends_at > b.starts_at).flatMap((x: any) => x.tables));
  const free = state.plan.tables.find((t: any) => t.bookable && !busy.has(t.key) && t.key !== b.resource_key && t.seats >= b.party_size);
  assert.ok(free, 'a free table to move to');
  {
    const moved = await sam.call('PATCH', `/demo/api/workspaces/${ws}/bookings/${b.reference}`, { action: 'move', table: free.key });
    assert.equal(moved.status, 200, JSON.stringify(moved.data));
    const after = (await sam.call('GET', `/demo/api/workspaces/${ws}/state`)).data.bookings.find((x: any) => x.reference === b.reference);
    assert.equal(after.resource_key, free.key);
    assert.match(after.history.at(-1).what, /moved from/);
  }
  const tooSmall = state.plan.tables.find((t: any) => t.seats < b.party_size);
  if (tooSmall) assert.equal((await sam.call('PATCH', `/demo/api/workspaces/${ws}/bookings/${b.reference}`, { action: 'move', table: tooSmall.key })).status, 409);

  const details = await sam.call('PATCH', `/demo/api/workspaces/${ws}/bookings/${b.reference}`, { action: 'details', allergies: 'Coeliac', notes: 'Wheelchair user', tags: ['birthday'] });
  assert.equal(details.status, 200);
  assert.equal((await sam.call('PATCH', `/demo/api/workspaces/${ws}/bookings/${b.reference}`, { action: 'visit', status: 'arrived' })).status, 200);
  assert.equal((await sam.call('PATCH', `/demo/api/workspaces/${ws}/bookings/${b.reference}`, { action: 'visit', status: 'dancing' })).status, 400);

  assert.equal((await sam.call('PATCH', `/demo/api/workspaces/${ws}/bookings/${b.reference}`, { action: 'feedback', category: 'keen' })).status, 400, 'a restaurant booking has no viewing feedback');
  const cancelled = await sam.call('PATCH', `/demo/api/workspaces/${ws}/bookings/${b.reference}`, { action: 'cancel' });
  assert.equal(cancelled.status, 200);
  const phone = await sam.call('GET', `/demo/api/workspaces/${ws}/phone?number=${encodeURIComponent(b.phone)}`);
  assert.equal(phone.status, 200);
  assert.match(phone.data.messages.at(-1).body, new RegExp(`cancel your booking ${b.reference}`));
  assert.equal(phone.data.messages.at(-1).status, 'simulated', 'never really sent');
  assert.equal((await sam.call('PATCH', `/demo/api/workspaces/${ws}/bookings/${b.reference}`, { action: 'cancel' })).status, 409);
});

test('demo: pushing two tables together that were never joined', async () => {
  const state = (await sam.call('GET', `/demo/api/workspaces/${ws}/state`)).data;
  const joined = new Set(state.plan.pairs.flatMap((p: any) => p.combines));
  const loose = state.plan.tables.filter((t: any) => t.bookable && !joined.has(t.key) && t.seats === 4);
  assert.ok(loose.length >= 2);
  // A booking for 6 to 8 from later days, which needs a big table; find one free pair slot by trying.
  const big = state.bookings.find((x: any) => x.status === 'confirmed' && x.party_size >= 5 && x.party_size <= 8 && x.date > state.today);
  assert.ok(big, 'a large booking in the coming days');
  const r = await sam.call('PATCH', `/demo/api/workspaces/${ws}/bookings/${big.reference}`, { action: 'combine', tables: [loose[0].key, loose[1].key] });
  assert.ok(r.status === 200 || r.status === 409, JSON.stringify(r.data));
  const after = (await sam.call('GET', `/demo/api/workspaces/${ws}/state`)).data;
  assert.ok(after.plan.pairs.some((p: any) => p.combines.includes(loose[0].key) && p.combines.includes(loose[1].key)), 'the pair now exists in the setup');
});

test('demo: the kitchen board sends the ready text', async () => {
  // Which of today's seeded orders are still in the kitchen depends on the clock; put one back first.
  const state = (await sam.call('GET', `/demo/api/workspaces/${ws}/state`)).data;
  let o = state.orders.find((x: any) => x.phone);
  if (!o) {
    const t = (await app.repo.getTenantById(ws))!;
    await app.repo.createOrder(t, {
      name: 'Test Order', phone: '+447700900555', fulfilment: 'collection', due_at: new Date(Date.now() + 3600000), address: null, postcode: null,
      lines: [], subtotal_pence: 1000, delivery_fee_pence: 0, total_pence: 1000, allergy_notes: null, source: 'console', call_id: null,
    });
    o = (await sam.call('GET', `/demo/api/workspaces/${ws}/state`)).data.orders.find((x: any) => x.phone);
  }
  assert.equal((await sam.call('PATCH', `/demo/api/workspaces/${ws}/orders/${o.reference}`, { status: 'in_kitchen' })).status, 200);
  assert.equal((await sam.call('PATCH', `/demo/api/workspaces/${ws}/orders/${o.reference}`, { status: 'ready' })).status, 200);
  const phone = await sam.call('GET', `/demo/api/workspaces/${ws}/phone?number=${encodeURIComponent(o.phone)}`);
  assert.match(phone.data.messages.at(-1).body, /ready to collect/);
});

test('demo: another key cannot see this workspace; the team can', async () => {
  const k2 = await team.call('POST', '/demo/api/admin/keys', { person_name: 'Other Person' });
  const other = client('10.0.0.3');
  assert.equal((await other.call('POST', '/demo/api/session', { key: k2.data.key })).status, 200);
  assert.equal((await other.call('GET', `/demo/api/workspaces/${ws}`)).status, 404);
  assert.equal((await other.call('GET', `/demo/api/workspaces/${ws}/state`)).status, 404);
  const s = await new Promise<number>((resolve) => {
    const sock = new WebSocket(`ws://localhost:${app.port}/demo/ws/talk?workspace=${ws}`, { headers: { origin, cookie: `demo_s=${other.jar.get('demo_s')}` } });
    sock.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
    sock.on('open', () => resolve(101));
  });
  assert.equal(s, 403);
  assert.equal((await team.call('GET', `/demo/api/workspaces/${ws}`)).status, 200);
  // The team's list of our own businesses leaves prospects' workspaces out.
  const tenants = (await team.call('GET', '/demo/api/admin/tenants')).data.tenants;
  assert.ok(!tenants.some((t: any) => t.slug.startsWith('demo-')));
});

test('demo: private keys: another demo beyond the limit replaces one, with its data', async () => {
  assert.equal((await sam.call('POST', '/demo/api/workspaces', { preset: 'restaurant' })).status, 201);
  const third = await sam.call('POST', '/demo/api/workspaces', { preset: 'restaurant', name: 'Third Place' });
  assert.equal(third.status, 409, 'this key allows two at once');
  assert.equal(third.data.code, 'replace');
  assert.equal(third.data.workspaces.length, 2);
  const me = await sam.call('GET', '/demo/api/me');
  assert.equal(me.data.kind, 'private');
  assert.equal(me.data.used.workspaces, 2);
  assert.equal(me.data.workspaces.find((w: any) => w.id === ws).expires_at, null, 'a private demo is kept');

  // Replace the started one: it goes, bookings and all.
  const before = await app.repo.db.query<any>('select count(*)::int as n from public.voice_bookings where tenant_id = $1', [ws]);
  assert.ok(before[0].n > 0);
  const replaced = await sam.call('POST', '/demo/api/workspaces', { preset: 'restaurant', name: 'Third Place', replace: ws });
  assert.equal(replaced.status, 201, JSON.stringify(replaced.data));
  assert.equal((await sam.call('GET', `/demo/api/workspaces/${ws}`)).status, 404);
  const after = await app.repo.db.query<any>('select count(*)::int as n from public.voice_bookings where tenant_id = $1', [ws]);
  assert.equal(after[0].n, 0, 'its bookings went with it');
  assert.equal((await sam.call('GET', '/demo/api/me')).data.workspaces.length, 2);
});

test('demo: usage, and revoking', async () => {
  const keys = (await team.call('GET', '/demo/api/admin/keys')).data.keys;
  const samKey = keys.find((k: any) => k.person_name === 'Sam Price');
  assert.equal(samKey.kind, 'private');
  const usage = await team.call('GET', `/demo/api/admin/keys/${samKey.id}/usage`);
  const kinds = new Set(usage.data.usage.map((u: any) => u.kind));
  for (const k of ['opened', 'workspace_created', 'started', 'staff_action', 'reset']) assert.ok(kinds.has(k), `usage has ${k}`);

  assert.equal((await team.call('POST', `/demo/api/admin/keys/${samKey.id}/revoke`)).status, 200);
  assert.equal((await sam.call('GET', '/demo/api/me')).status, 401, 'a revoked key ends the session at once');
  assert.equal((await sam.call('POST', '/demo/api/session', { key: rawKey })).status, 401);
});

test('demo: a shared key gives each person their own demo, deleted an hour after Start', async () => {
  const issued = await team.call('POST', '/demo/api/admin/keys', { person_name: 'Hospitality expo', kind: 'shared' });
  assert.equal(issued.status, 201);
  assert.equal(issued.data.record.kind, 'shared');
  assert.equal(issued.data.record.limits.workspaces, 1);
  const shared = issued.data.key;
  const ann = client('10.0.1.1');
  const ben = client('10.0.1.2');
  assert.equal((await ann.call('POST', '/demo/api/session', { key: shared })).status, 200);
  const meBen = await ben.call('POST', '/demo/api/session', { key: shared });
  assert.equal(meBen.data.kind, 'shared');
  assert.equal(meBen.data.shared.demo_minutes, 60);

  // Ann builds and starts; Ben sees none of it.
  const a = await ann.call('POST', '/demo/api/workspaces', { preset: 'restaurant', name: "Ann's Bistro" });
  assert.equal(a.status, 201);
  const draftLeft = new Date(a.data.expires_at).getTime() - Date.now();
  assert.ok(draftLeft > 110 * 60000 && draftLeft <= 120 * 60000, 'a draft is kept two hours');
  assert.deepEqual((await ben.call('GET', '/demo/api/me')).data.workspaces, []);
  assert.equal((await ben.call('GET', `/demo/api/workspaces/${a.data.id}`)).status, 404);
  const started = await ann.call('POST', `/demo/api/workspaces/${a.data.id}/start`);
  assert.equal(started.status, 200);
  const left = new Date(started.data.workspace.expires_at).getTime() - Date.now();
  assert.ok(left > 58 * 60000 && left <= 60 * 60000, `deleted an hour after Start (${Math.round(left / 60000)} min)`);
  // Reset makes new data but does not extend the hour.
  const reset = await ann.call('POST', `/demo/api/workspaces/${a.data.id}/reset`);
  assert.equal(reset.data.workspace.expires_at, started.data.workspace.expires_at);

  // Entering the key again in the same browser keeps the same demo.
  assert.equal((await ann.call('POST', '/demo/api/session', { key: shared })).status, 200);
  assert.equal((await ann.call('GET', '/demo/api/me')).data.workspaces.length, 1);

  // Ben has his own, and the key's list shows two people.
  assert.equal((await ben.call('POST', '/demo/api/workspaces', { preset: 'restaurant', name: "Ben's Grill" })).status, 201);
  const row = (await team.call('GET', '/demo/api/admin/keys')).data.keys.find((k: any) => k.kind === 'shared');
  assert.equal(row.people, 2);
  assert.equal(row.workspaces, 2);

  // An hour later (moved on in the database): the demo has ended, and the sweeper deletes it and everything it made.
  await app.repo.db.query(`update public.voice_tenants set expires_at = now() - interval '1 second' where id = $1`, [a.data.id]);
  assert.equal((await ann.call('GET', `/demo/api/workspaces/${a.data.id}/state`)).status, 410);
  const counts = async () => (await app.repo.db.query<any>(
    `select (select count(*) from public.voice_bookings where tenant_id = $1)::int as b, (select count(*) from public.voice_orders where tenant_id = $1)::int as o,
            (select count(*) from public.voice_tenants where id = $1)::int as t`, [a.data.id]))[0];
  assert.ok((await counts()).b > 0);
  const gone = await sweep({ demo: app.demo, bus: app.bus });
  assert.deepEqual(gone, [a.data.id]);
  assert.deepEqual(await counts(), { b: 0, o: 0, t: 0 });
  assert.deepEqual((await ann.call('GET', '/demo/api/me')).data.workspaces, []);
  assert.equal((await ben.call('GET', '/demo/api/me')).data.workspaces.length, 1, "Ben's is untouched");

  // A forged session for the shared key without a person opens nothing.
  const forged = signSession({ keyId: row.id, exp: Date.now() + 60000 }, 'demo-api-test');
  const f = await fetch(`${origin}/demo/api/me`, { headers: { cookie: `demo_s=${forged}` } });
  assert.equal(f.status, 401);
});

test('demo: private demos are deleted 30 days after their key ends, not before', async () => {
  const k = await team.call('POST', '/demo/api/admin/keys', { person_name: 'Old Prospect' });
  const old = client('10.0.2.1');
  assert.equal((await old.call('POST', '/demo/api/session', { key: k.data.key })).status, 200);
  const w = (await old.call('POST', '/demo/api/workspaces', { preset: 'restaurant' })).data;
  await app.repo.db.query(`update public.voice_demo_keys set expires_at = now() - interval '29 days' where id = $1`, [k.data.record.id]);
  assert.ok(!(await sweep({ demo: app.demo, bus: app.bus })).includes(w.id), 'kept for 30 days after the key expires');
  await app.repo.db.query(`update public.voice_demo_keys set expires_at = now() - interval '31 days' where id = $1`, [k.data.record.id]);
  assert.ok((await sweep({ demo: app.demo, bus: app.bus })).includes(w.id));
});

test('demo: an estate agency: Start, then offers, homes and feedback from the back office, each with its text', async () => {
  {
    assert.equal((await team.call('POST', '/demo/api/admin/login', { password: 'team-pass' })).status, 200);
    const key = await team.call('POST', '/demo/api/admin/keys', { person_name: 'Jo Green', company: 'Hartwell & Green' });
    const jo = client('10.0.0.9');
    assert.equal((await jo.call('POST', '/demo/api/session', { key: key.data.key })).status, 200);
    const made = await jo.call('POST', '/demo/api/workspaces', { preset: 'estate_agent' });
    assert.equal(made.status, 201, JSON.stringify(made.data));
    const path = `/demo/api/workspaces/${made.data.id}`;
    const defaults = await jo.call('GET', `${path}/defaults`);
    assert.equal(defaults.data.answers.listings.length, 18, 'the sample homes, for "Start from the sample"');
    const started = await jo.call('POST', `${path}/start`);
    assert.equal(started.status, 200, JSON.stringify(started.data));

    const state = async () => (await jo.call('GET', `${path}/state`)).data;
    const s = await state();
    assert.equal(s.listings.length, 18);
    assert.equal(s.team.length, 6);
    assert.ok(s.offers.length >= 3, `${s.offers.length} offers`);
    assert.ok(s.listings.every((l: any) => l.example), 'every sample home is an example');
    // The Applicants view: the buyers the seed knows, what they want, and whether they said yes to alerts.
    assert.ok(s.buyers.length >= 10, `${s.buyers.length} buyers`);
    assert.ok(s.buyers.some((b: any) => b.alerts && b.consent_at && b.wants && b.matches >= 0));
    assert.ok(s.buyers.some((b: any) => b.backup_for.length), 'the back-up buyer');
    // The Valuations view: the seed's seven, last week's won, lost and thinking among them.
    assert.equal(s.valuations.length, 7, JSON.stringify(s.valuations.map((v: any) => v.details.address)));
    assert.deepEqual(s.valuations.map((v: any) => v.details.outcome).filter(Boolean).sort(), ['instructed', 'lost', 'thinking']);
    // An outcome set from the Valuations view: thinking gets a day to follow up; a viewing has none.
    const pending = s.valuations.find((v: any) => !v.details.outcome);
    const set = await jo.call('PATCH', `${path}/bookings/${pending.reference}`, { action: 'outcome', outcome: 'thinking' });
    assert.equal(set.status, 200, JSON.stringify(set.data));
    assert.match(set.data.message, /^Thinking: follow up on \d{4}-\d{2}-\d{2}\.$/);
    assert.equal((await jo.call('PATCH', `${path}/bookings/${pending.reference}`, { action: 'outcome', outcome: 'lost', lost_to: 'Harper & Co' })).data.message, 'Lost to Harper & Co.');
    assert.equal((await jo.call('PATCH', `${path}/bookings/${s.bookings.find((b: any) => b.listing_key).reference}`, { action: 'outcome', outcome: 'lost' })).status, 400);
    const viewing = s.bookings.find((b: any) => b.listing_key && b.status === 'confirmed' && b.starts_at > s.now);
    assert.ok(viewing?.home, 'a viewing knows its home');
    const texts = async (phone: string) => (await jo.call('GET', `${path}/phone?number=${encodeURIComponent(phone)}`)).data.messages.map((m: any) => m.body);
    // Applicants' actions: hot, matches texted only with a yes to alerts, alerts stopped with one text.
    // The seed is random: if no buyer with alerts has a home that fits, one is added who fits anything.
    let keen = s.buyers.find((b: any) => b.alerts && b.matches > 0);
    if (!keen) {
      await app.repo.upsertBuyer(made.data.id, '+447700900775', 'Ali Keen', { roles: ['buyer'], requirements: { min_beds: 1 } }, true);
      keen = (await state()).buyers.find((b: any) => b.phone === '07700 900775');
    }
    const digits = (b: any) => b.phone.replace(/\s/g, '');
    assert.match((await jo.call('PATCH', `${path}/buyers/${digits(keen)}`, { action: 'hot' })).data.message, /marked hot/);
    const sentMatches = await jo.call('PATCH', `${path}/buyers/${digits(keen)}`, { action: 'send_matches' });
    assert.equal(sentMatches.status, 200, JSON.stringify(sentMatches.data));
    assert.match((await texts(keen.phone)).at(-1), /homes that fit what you asked for: .*To stop these texts, call us\. \(Demo\)$/);
    assert.equal((await jo.call('PATCH', `${path}/buyers/${digits(keen)}`, { action: 'unsubscribe' })).status, 200);
    assert.match((await texts(keen.phone)).at(-1), /stopped texting you about new homes/);
    assert.equal((await jo.call('PATCH', `${path}/buyers/${digits(keen)}`, { action: 'send_matches' })).status, 409, 'no yes, no texts');
    const again = (await state()).buyers.find((b: any) => b.phone === keen.phone);
    assert.deepEqual([again.hot, again.alerts], [true, false]);
    assert.equal((await jo.call('PATCH', `${path}/buyers/07700900998`, { action: 'hot' })).status, 404);

    // An offer goes to the seller, then is accepted: sale agreed, a sale opens, the buyer and every other bidder hear (each once).
    const openOn = (key: string) => s.offers.filter((o: any) => o.listing_key === key && ['received', 'sent'].includes(o.status) && o.phone);
    const offer = s.offers.find((o: any) => o.status === 'received' && o.phone && openOn(o.listing_key).some((x: any) => x.phone !== o.phone));
    assert.ok(offer, 'a received offer on a home with another bidder (the seed\'s best and final)');
    assert.equal((await jo.call('PATCH', `${path}/offers/${offer.reference}`, { action: 'sent' })).status, 200);
    assert.match((await texts(offer.phone)).at(-1), /Your offer of £[\d,]+ for .+ was put to the seller at \d/);
    assert.equal((await jo.call('PATCH', `${path}/offers/${offer.reference}`, { action: 'sent' })).status, 409, 'already sent');
    const rivals = openOn(offer.listing_key).filter((o: any) => o.reference !== offer.reference && o.phone !== offer.phone);
    assert.ok(rivals.length > 0, 'someone else to tell');
    const accepted = await jo.call('PATCH', `${path}/offers/${offer.reference}`, { action: 'accept', viewings_continue: false });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
    assert.match(accepted.data.message, /other buyers? (?:has|have) been told/);
    assert.match((await texts(offer.phone)).at(-1), /accepted your offer of £[\d,]+ for .+, subject to contract\. \w+ will confirm it in writing/);
    for (const r of rivals) assert.match((await texts(r.phone)).at(-1), /has accepted another offer, subject to contract/);
    const after = await state();
    const home = after.listings.find((l: any) => l.key === offer.listing_key);
    assert.equal(home.status, 'sale_agreed');
    assert.equal(home.marketing_continues, false);
    assert.equal(after.offers.find((o: any) => o.reference === offer.reference).status, 'accepted');
    const sales = await app.repo.listSales(made.data.id);
    assert.ok(sales.some((x) => x.offer_ref === offer.reference && x.milestones.length === 8 && x.milestones.every((m) => !m.done_at)), 'a sale opened, its milestones still to come');
    assert.equal((await jo.call('PATCH', `${path}/offers/${offer.reference}`, { action: 'decline' })).status, 409, 'already decided');
    assert.equal((await jo.call('PATCH', `${path}/offers/${offer.reference}`, { action: 'dance' })).status, 400);
    assert.equal((await jo.call('PATCH', `${path}/offers/ZZ999`, { action: 'sent' })).status, 404);

    // One sale at a time: a rival on the same home cannot be accepted while the sale stands, nor a new offer on a home the seed made sale agreed.
    assert.equal((await jo.call('PATCH', `${path}/offers/${rivals[0].reference}`, { action: 'accept' })).status, 409);
    const tenant = (await app.repo.getTenantById(made.data.id))!;
    const agreedHome = after.listings.find((l: any) => l.status === 'sale_agreed' && l.key !== offer.listing_key);
    const late = await app.repo.createOffer(tenant, { listing_key: agreedHome.key, amount_pence: 30_000_000, buyer_names: ['Lee Late'], phone: '+447700900771', source: 'console' });
    assert.equal((await jo.call('PATCH', `${path}/offers/${late.reference}`, { action: 'accept' })).status, 409);
    // Back on the market, the sale has fallen through, and the rival can be accepted.
    const back = await jo.call('PATCH', `${path}/listings/${offer.listing_key}`, { action: 'status', status: 'available' });
    assert.match(back.data.message, /fallen through/);
    assert.equal((await app.repo.listSales(made.data.id)).find((x) => x.offer_ref === offer.reference)!.status, 'fell_through');
    assert.equal((await jo.call('PATCH', `${path}/offers/${rivals[0].reference}`, { action: 'accept' })).status, 200);

    // A raised offer: accepting it closes the buyer's earlier one, and that buyer never hears that "another offer" was accepted.
    const quiet = [...after.listings].reverse().find((l: any) => l.status === 'available' && !openOn(l.key).length && l.key !== viewing.listing_key);
    const earlier = await app.repo.createOffer(tenant, { listing_key: quiet.key, amount_pence: 25_000_000, buyer_names: ['Rae Lowe'], phone: '+447700900772', source: 'console' });
    const raised = await app.repo.createOffer(tenant, { listing_key: quiet.key, amount_pence: 26_000_000, buyer_names: ['Rae Lowe'], phone: '+447700900772', source: 'console', revises: earlier.reference });
    const took = await jo.call('PATCH', `${path}/offers/${raised.reference}`, { action: 'accept' });
    assert.equal(took.status, 200, JSON.stringify(took.data));
    assert.doesNotMatch(took.data.message, /other buyer/);
    assert.ok(!(await texts('07700 900772')).some((x: string) => /another offer/.test(x)));
    assert.equal((await app.repo.findOffer(made.data.id, { reference: earlier.reference }))[0].status, 'withdrawn');
    // A "raise" naming someone else's offer (the reference is the caller's word) replaces nothing: that buyer's stays open and is told.
    const calm = [...after.listings].reverse().find((l: any) => l.status === 'available' && !openOn(l.key).length && l.key !== viewing.listing_key && l.key !== quiet.key);
    const theirs = await app.repo.createOffer(tenant, { listing_key: calm.key, amount_pence: 25_000_000, buyer_names: ['Ida Moss'], phone: '+447700900773', source: 'console' });
    const wrong = await app.repo.createOffer(tenant, { listing_key: calm.key, amount_pence: 26_000_000, buyer_names: ['Ned Ray'], phone: '+447700900779', source: 'console', revises: theirs.reference });
    const won = await jo.call('PATCH', `${path}/offers/${wrong.reference}`, { action: 'accept' });
    assert.equal(won.status, 200, JSON.stringify(won.data));
    assert.match(won.data.message, /1 other buyer has been told/);
    assert.match((await texts('07700 900773')).at(-1), /accepted another offer/);
    assert.equal((await app.repo.findOffer(made.data.id, { reference: theirs.reference }))[0].status, 'received');

    const other = (await state()).offers.find((o: any) => ['received', 'sent'].includes(o.status) && o.phone);
    if (other) {
      assert.equal((await jo.call('PATCH', `${path}/offers/${other.reference}`, { action: 'decline', note: 'Too low' })).status, 200);
      assert.match((await texts(other.phone)).at(-1), /decided not to accept your offer/);
    }

    // A home: reduced, dates blocked (naming the viewings booked then), a fact being checked, withdrawn.
    const avail = after.listings.find((l: any) => l.status === 'available' && l.key === viewing.listing_key) ?? after.listings.find((l: any) => l.status === 'available');
    const lower = avail.price_pence - 1_000_000;
    const priced = await jo.call('PATCH', `${path}/listings/${avail.key}`, { action: 'price', price_pence: lower });
    assert.equal(priced.status, 200, JSON.stringify(priced.data));
    assert.match(priced.data.message, /reduced to £/);
    assert.equal((await jo.call('PATCH', `${path}/listings/${avail.key}`, { action: 'price', price_pence: 5 })).status, 400);
    const vhome = after.listings.find((l: any) => l.key === viewing.listing_key);
    const blocked = await jo.call('PATCH', `${path}/listings/${vhome.key}`, { action: 'block', from: viewing.date, to: viewing.date, note: 'Seller away' });
    assert.equal(blocked.status, 200, JSON.stringify(blocked.data));
    assert.ok(blocked.data.affected.some((x: string) => x.includes(viewing.reference)), 'the viewing booked that day is named');
    assert.equal((await jo.call('PATCH', `${path}/listings/${vhome.key}`, { action: 'block', from: '2026-13-01' })).status, 400);
    assert.equal((await jo.call('PATCH', `${path}/listings/${avail.key}`, { action: 'checking', fact: 'parking' })).status, 200);
    assert.equal((await jo.call('PATCH', `${path}/listings/${avail.key}`, { action: 'checking', fact: 'gossip' })).status, 400);
    // The deadline is the agency's own time (London, summer time here), wherever the browser is.
    assert.equal((await jo.call('PATCH', `${path}/listings/${avail.key}`, { action: 'best_final', date: '2026-10-09', time: '25:00' })).status, 400);
    const bf = await jo.call('PATCH', `${path}/listings/${avail.key}`, { action: 'best_final', date: '2026-10-09', time: '12:00' });
    assert.equal(bf.status, 200);
    assert.match(bf.data.message, /Friday 9 October at 12 noon/);
    let now = await state();
    let h = now.listings.find((l: any) => l.key === avail.key);
    assert.equal(h.price_pence, lower);
    assert.match(h.history.map((x: any) => x.what).join(' | '), /price reduced from £/);
    assert.deepEqual(h.checking, ['parking']);
    assert.equal(h.best_final_at, '2026-10-09T11:00:00.000Z');
    assert.equal(now.nation, 'england');
    assert.equal(now.listings.find((l: any) => l.key === vhome.key).blocked[0].note, 'Seller away');
    assert.equal((await jo.call('PATCH', `${path}/listings/${vhome.key}`, { action: 'unblock', index: 0 })).status, 200);
    assert.equal((await jo.call('PATCH', `${path}/listings/${avail.key}`, { action: 'status', status: 'withdrawn' })).status, 200);
    assert.equal((await jo.call('PATCH', `${path}/listings/${avail.key}`, { action: 'status', status: 'gone' })).status, 400);
    assert.equal((await jo.call('PATCH', `${path}/listings/no_such_home`, { action: 'status', status: 'available' })).status, 404);
    now = await state();
    assert.deepEqual(now.listings.find((l: any) => l.key === vhome.key).blocked, []);
    assert.equal(now.listings.find((l: any) => l.key === avail.key).status, 'withdrawn');

    // Feedback on a viewing, from the agent who showed it.
    assert.equal((await jo.call('PATCH', `${path}/bookings/${viewing.reference}`, { action: 'feedback', category: 'keen', words: 'Loved the garden' })).status, 200);
    assert.equal((await jo.call('PATCH', `${path}/bookings/${viewing.reference}`, { action: 'feedback', category: 'meh' })).status, 400);
    const valuation = s.bookings.find((b: any) => !b.listing_key && b.status === 'confirmed');
    assert.equal((await jo.call('PATCH', `${path}/bookings/${valuation.reference}`, { action: 'feedback', category: 'keen' })).status, 400, 'only a viewing has feedback');
    const fb = (await state()).bookings.find((b: any) => b.reference === viewing.reference);
    assert.equal(fb.details.feedback.category, 'keen');
    assert.equal(fb.details.feedback.words, 'Loved the garden');

    // The builder after Start: a home repriced, one added and one removed reach the back office.
    const answers = (await jo.call('GET', path)).data.answers;
    const [first, gone] = answers.listings.filter((x: any) => ![avail.key, vhome.key, offer.listing_key, quiet.key].includes(x.key));
    first.price_pence += 500_000;
    const orphan = await app.repo.createOffer(tenant, { listing_key: gone.key, amount_pence: 20_000_000, buyer_names: ['Gil Gone'], phone: '+447700900773', source: 'console' });
    answers.listings = answers.listings.filter((x: any) => x.key !== gone.key);
    answers.listings.push({ ...structuredClone(first), key: 'new_home', number: '99', ref: 'HG199' });
    const saved = await jo.call('PUT', `${path}/answers`, answers);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const synced = (await state()).listings;
    assert.equal(synced.find((l: any) => l.key === first.key).price_pence, first.price_pence);
    assert.ok(synced.some((l: any) => l.key === 'new_home'));
    assert.ok(!synced.some((l: any) => l.key === gone.key));
    // Its offers stay on record, but nothing more can happen to them.
    assert.equal((await jo.call('PATCH', `${path}/offers/${orphan.reference}`, { action: 'accept' })).status, 409);

    // Reset puts every home back as Start made it.
    assert.equal((await jo.call('POST', `${path}/reset`)).status, 200);
    h = (await state()).listings.find((l: any) => l.key === avail.key);
    assert.equal(h.status, 'available');
    assert.equal(h.price_pence, avail.price_pence);
    assert.deepEqual(h.checking, []);
    assert.equal((await state()).listings.find((l: any) => l.key === first.key).price_pence, first.price_pence, 'the builder\'s price now');
  }
});

test('demo: an estate agency\'s sales: milestones, dates, updates, keys on completion day, and a sale that falls through', async () => {
  assert.equal((await team.call('POST', '/demo/api/admin/login', { password: 'team-pass' })).status, 200);
  const key = await team.call('POST', '/demo/api/admin/keys', { person_name: 'Dan Fletcher', company: 'Hartwell & Green' });
  const dan = client('10.0.0.12');
  assert.equal((await dan.call('POST', '/demo/api/session', { key: key.data.key })).status, 200);
  const made = await dan.call('POST', '/demo/api/workspaces', { preset: 'estate_agent' });
  const path = `/demo/api/workspaces/${made.data.id}`;
  assert.equal((await dan.call('POST', `${path}/start`)).status, 200);
  const sales = async () => app.repo.listSales(made.data.id);
  const texts = async (phone: string) => (await dan.call('GET', `${path}/phone?number=${encodeURIComponent(phone)}`)).data.messages.map((m: any) => m.body);
  const act = (id: string, body: Record<string, unknown>) => dan.call('PATCH', `${path}/sales/${id}`, body);
  const listing = async (k: string) => (await app.repo.listingState(made.data.id, k))!;

  // A milestone ticked, dates set, an update logged; completion only through the keys.
  const ben = (await sales()).find((x) => x.listing_key === 'kingfisher_3')!;
  assert.equal((await act(ben.id!, { action: 'milestone', key: 'searches' })).status, 200);
  assert.equal((await act(ben.id!, { action: 'milestone', key: 'completion' })).status, 400);
  assert.equal((await act(ben.id!, { action: 'dates', exchange_target: '2026-10-20', completion_date: '2026-10-15' })).status, 400, 'completion before exchange');
  assert.equal((await act(ben.id!, { action: 'dates', exchange_target: '2026-10-20', completion_date: '2026-10-30' })).status, 200);
  assert.equal((await act(ben.id!, { action: 'update', from: 'seller_solicitor', what: 'Replies to enquiries sent today.' })).status, 200);
  let now = (await sales()).find((x) => x.id === ben.id)!;
  assert.ok(now.milestones.find((m) => m.key === 'searches')!.done_at);
  assert.deepEqual([now.exchange_target, now.completion_date], ['2026-10-20', '2026-10-30']);
  assert.deepEqual(now.updates.at(-1), { ...now.updates.at(-1), by: 'seller_solicitor', what: 'Replies to enquiries sent today.' });
  // Keys: refused before completion day.
  assert.equal((await act(ben.id!, { action: 'release_keys' })).status, 409);

  // Exchanged, then completion day: keys released, the buyer texted, the home completed.
  const liam = (await sales()).find((x) => x.listing_key === 'willow_gardens_8')!;
  const today = new Date().toISOString().slice(0, 10);
  await app.repo.updateSale(made.data.id, liam.id!, { completion_date: today });
  const keys = await act(liam.id!, { action: 'release_keys' });
  assert.equal(keys.status, 200, JSON.stringify(keys.data));
  assert.match((await texts(liam.buyer_phone!)).at(-1), /completion has gone through on 8 Willow Gardens\. Your keys are ready to collect/);
  assert.equal((await listing('willow_gardens_8')).status, 'completed');
  assert.equal((await act(liam.id!, { action: 'milestone', key: 'survey' })).status, 409, 'a completed sale is done with');

  // Exchange ticked: the home is exchanged; a sale that has exchanged cannot simply fall through.
  const elm = (await sales()).find((x) => x.listing_key === 'elm_court_2')!;
  await act(elm.id!, { action: 'milestone', key: 'exchange' });
  assert.equal((await listing('elm_court_2')).status, 'exchanged');
  assert.equal((await act(elm.id!, { action: 'fell_through', reason: 'x', back_on_market: true })).status, 409);

  // Ben's mortgage refused: back on the market, and the back-up buyer hears.
  const backup = (await app.repo.listBuyers(made.data.id)).find((b) => (b.details.backup_for ?? []).includes('kingfisher_3'))!;
  assert.equal((await act(ben.id!, { action: 'fell_through', back_on_market: true })).status, 400, 'a reason is needed');
  const fell = await act(ben.id!, { action: 'fell_through', reason: "the buyer's mortgage was refused", back_on_market: true });
  assert.equal(fell.status, 200, JSON.stringify(fell.data));
  assert.match(fell.data.message, /back on the market, and \d+ buyers? (?:has|have) been texted/);
  assert.match((await texts(backup.phone)).at(-1), /3 Kingfisher Way is back on the market, .+ Call us if you'd like to view it/);
  assert.equal((await listing('kingfisher_3')).status, 'available');
  assert.ok((await listing('kingfisher_3')).back_on_market_at);
  assert.equal((await sales()).find((x) => x.id === ben.id)!.status, 'fell_through');
  assert.equal((await act(ben.id!, { action: 'milestone', key: 'survey' })).status, 409);
  assert.equal((await act('00000000-0000-0000-0000-000000000000', { action: 'milestone', key: 'survey' })).status, 404);

  // A reduction: the buyers who said yes to alerts and whose search it fits hear; one who said no does not.
  await app.repo.upsertBuyer(made.data.id, '+447700900781', 'Yes Please', { roles: ['buyer'], requirements: { min_beds: 1 } }, true);
  await app.repo.upsertBuyer(made.data.id, '+447700900782', 'No Thanks', { roles: ['buyer'], requirements: { min_beds: 1 } }, false);
  const station = await listing('station_27');
  const cut = await dan.call('PATCH', `${path}/listings/station_27`, { action: 'price', price_pence: station.price_pence - 500_000 });
  assert.match(cut.data.message, /reduced to £[\d,]+\. \d+ buyers? (?:has|have) been texted\./);
  assert.match((await texts('07700 900781')).at(-1), /27 Station Road has been reduced: now .+ To stop these texts, call us\./);
  assert.equal((await texts('07700 900782')).length, 0);

  // Describe your stock: a description first; then the drafted homes come back, and nothing is saved.
  const before = (await dan.call('GET', path)).data.answers.listings;
  const empty = await dan.call('POST', `${path}/menu-draft`, {});
  assert.deepEqual([empty.status, empty.data.error], [400, 'Describe the homes you sell first.']);
  const reply = JSON.stringify({ homes: [
    { street: 'Acorn Close', number: '3', type: 'semi', beds: 3, price_pounds: 285_000, tenure: 'freehold', local_tax: 'C', epc: 'D', summary: 'A semi with a long garden.', features: ['garden', 'parking'] },
    { street: 'Juniper Court', number: 'Flat 4, 12', type: 'flat', beds: 1, price_pounds: 142_000, tenure: 'leasehold', lease_years_left: 110, local_tax: 'A', epc: 'C', summary: 'A first-floor flat.' },
  ] });
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    String(input).startsWith('https://generativelanguage.googleapis.com/')
      ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: reply }] } }] }), { headers: { 'content-type': 'application/json' } })
      : real(input, init)) as typeof fetch;
  try {
    const drafted = await dan.call('POST', `${path}/menu-draft`, { description: 'Family semis and a few flats', homes: 2 });
    assert.equal(drafted.status, 200, JSON.stringify(drafted.data));
    assert.deepEqual(Object.keys(drafted.data), ['listings']);
    assert.deepEqual(drafted.data.listings.map((l: any) => `${l.number} ${l.street}`), ['3 Acorn Close', 'Flat 4, 12 Juniper Court']);
    assert.ok(drafted.data.listings.every((l: any) => l.example && Object.values(l.checks).every((c: any) => c.v === 'unknown')));
  } finally {
    globalThis.fetch = real;
  }
  assert.deepEqual((await dan.call('GET', path)).data.answers.listings, before, 'the saved homes are untouched');
});
