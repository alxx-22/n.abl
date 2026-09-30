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

let app: App;
let dir: string;
let origin: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'va-demo-api-'));
  app = await startServer({ ...loadConfig(), port: 0, pgliteDir: dir, databaseUrl: undefined, consolePassword: 'team-pass', sessionSecret: 'demo-api-test', demoProxySecret: 'proxy-secret', twilio: undefined });
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
    method: 'POST', headers: { 'content-type': 'application/json', origin, 'x-nabl-client-ip': `203.0.113.${n}`, 'x-forwarded-for': `198.51.100.${n}`, 'cf-connecting-ip': `192.0.2.${n}` },
    body: JSON.stringify({ key: 'DEMO-BBBB-BBBB-BBBB' }),
  });
  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) statuses.push((await spoof(i)).status);
  assert.equal(statuses.at(-1), 429, `statuses ${statuses.join(',')}`);
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
      lines: [], subtotal_pence: 1000, delivery_fee_pence: 0, total_pence: 1000, allergy_notes: null, source: 'test', call_id: null,
    });
    o = (await sam.call('GET', `/demo/api/workspaces/${ws}/state`)).data.orders[0];
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

test('demo: limits and revoking', async () => {
  assert.equal((await sam.call('POST', '/demo/api/workspaces', { preset: 'restaurant' })).status, 201);
  const third = await sam.call('POST', '/demo/api/workspaces', { preset: 'restaurant' });
  assert.equal(third.status, 403, 'this key allows two');
  const me = await sam.call('GET', '/demo/api/me');
  assert.equal(me.data.used.workspaces, 2);

  const keys = (await team.call('GET', '/demo/api/admin/keys')).data.keys;
  const samKey = keys.find((k: any) => k.person_name === 'Sam Price');
  const usage = await team.call('GET', `/demo/api/admin/keys/${samKey.id}/usage`);
  const kinds = new Set(usage.data.usage.map((u: any) => u.kind));
  for (const k of ['opened', 'workspace_created', 'started', 'staff_action']) assert.ok(kinds.has(k), `usage has ${k}`);

  assert.equal((await team.call('POST', `/demo/api/admin/keys/${samKey.id}/revoke`)).status, 200);
  assert.equal((await sam.call('GET', '/demo/api/me')).status, 401, 'a revoked key ends the session at once');
  assert.equal((await sam.call('POST', '/demo/api/session', { key: rawKey })).status, 401);
});
