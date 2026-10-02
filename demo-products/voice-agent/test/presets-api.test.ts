// The server's side of the preset registry over HTTP: every route that
// recompiles a workspace keeps its demo line PIN and call settings, and the
// preset hooks answer as the restaurant always has. Uses a throwaway PGlite
// database and no model.

import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { loadConfig } from '../src/config.ts';
import { startServer, type App } from '../src/server/main.ts';

let app: App;
let dir: string;
let origin: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'va-presets-api-'));
  app = await startServer({ ...loadConfig(), port: 0, pgliteDir: dir, databaseUrl: undefined, consolePassword: 'team-pass', sessionSecret: 'presets-api-test', demoProxySecret: 'proxy-secret', twilio: undefined }, { sweep: false });
  origin = `http://localhost:${app.port}`;
});

after(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

function client(ip: string) {
  const jar = new Map<string, string>();
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${origin}${path}`, {
      method,
      headers: {
        'content-type': 'application/json', origin, 'x-nabl-client-ip': ip, 'x-nabl-proxy': 'proxy-secret',
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [k, v] = c.split(';')[0].split('=');
      if (v) jar.set(k, v);
      else jar.delete(k);
    }
    return { status: res.status, data: (res.headers.get('content-type') ?? '').includes('json') ? ((await res.json()) as any) : await res.text() };
  };
}

test('presets over HTTP: the PIN and call settings survive every rebuild', async () => {
  const team = client('10.1.0.1');
  const kim = client('10.1.0.2');
  assert.equal((await team('POST', '/demo/api/admin/login', { password: 'team-pass' })).status, 200);
  const key = await team('POST', '/demo/api/admin/keys', { person_name: 'Kim Lee', company: 'Kim Lee', days: 7 });
  assert.equal(key.status, 201);
  assert.equal((await kim('POST', '/demo/api/session', { key: key.data.key })).status, 200);

  const presets = (await kim('GET', '/demo/api/presets')).data.presets;
  assert.deepEqual(
    [presets[0].noun, presets[0].business_type, presets[0].example],
    ['restaurant', 'restaurant', 'https://www.your-restaurant.co.uk'],
  );

  // No name: the slug falls back to one made from the preset's key.
  const made = await kim('POST', '/demo/api/workspaces', { preset: 'restaurant', name: '' });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  assert.match(made.data.slug, /^demo-[a-z2-9]{4}-restaurant-[0-9a-f]{4}$/);
  const ws = made.data.id;
  const path = `/demo/api/workspaces/${ws}`;
  const unnamed = await kim('POST', `${path}/start`);
  assert.equal(unnamed.status, 400);
  assert.equal(unnamed.data.error, 'Give the restaurant a name.');

  assert.equal((await kim('PATCH', `${path}/settings`, { reply_speed: 'patient' })).status, 200);
  const named = made.data.answers;
  named.basics.name = 'Kim’s Kitchen';
  assert.equal((await kim('PUT', `${path}/answers`, named)).status, 200);
  const started = await kim('POST', `${path}/start`);
  assert.equal(started.status, 200, JSON.stringify(started.data));
  const pin = started.data.workspace.profile.demo_pin;
  assert.match(pin, /^\d{4}$/);
  const kept = (w: any, what: string) => {
    assert.equal(w.profile.demo_pin, pin, `${what} kept the PIN`);
    assert.equal(w.profile.reply_speed, 'patient', `${what} kept the call settings`);
  };
  kept(started.data.workspace, 'Start');

  named.basics.style = 'Small plates';
  await wait(850); // saves are paced per workspace
  const saved = await kim('PUT', `${path}/answers`, named);
  assert.equal(saved.status, 200);
  kept(saved.data, 'a save');

  const voiced = await kim('PATCH', `${path}/settings`, { voice: 'Puck' });
  assert.equal(voiced.status, 200);
  assert.equal(voiced.data.answers.basics.voice, 'Puck', 'the voice is a builder answer too');
  kept(voiced.data, 'a settings change');

  // Pushing two loose tables together recompiles the setup.
  const state = (await kim('GET', `${path}/state`)).data;
  const pairs = new Set(state.plan.pairs.flatMap((p: any) => p.combines));
  const loose = state.plan.tables.filter((t: any) => t.area === 'indoor' && t.bookable && !pairs.has(t.key));
  const booking = state.bookings.find((b: any) => b.status === 'confirmed' && b.date > state.today);
  assert.ok(loose.length >= 2 && booking);
  assert.equal((await kim('PATCH', `${path}/bookings/${booking.reference}`, { action: 'combine', tables: [loose[0].key, loose[0].key] })).status, 400);
  const combined = await kim('PATCH', `${path}/bookings/${booking.reference}`, { action: 'combine', tables: [loose[0].key, loose[1].key] });
  assert.ok(combined.status === 200 || combined.status === 409, JSON.stringify(combined.data));
  const afterJoin = (await kim('GET', path)).data;
  assert.ok(afterJoin.answers.seating.tables.find((t: any) => t.key === loose[0].key).joins.includes(loose[1].key));
  kept(afterJoin, 'pushing tables together');

  const reset = await kim('POST', `${path}/reset`);
  assert.equal(reset.status, 200);
  kept(reset.data.workspace, 'Reset');

  // The menu draft asks for a description before it spends anything on the model.
  named.basics.style = '';
  await wait(850);
  assert.equal((await kim('PUT', `${path}/answers`, named)).status, 200);
  const empty = await kim('POST', `${path}/menu-draft`, {});
  assert.equal(empty.status, 400);
  assert.equal(empty.data.error, 'Describe the food first.');

  // A draft sends back the menu and nothing else, and saves nothing: the
  // builder puts it in place and its next autosave keeps it. The model's
  // reply is the canned one the restaurant's goldens use.
  const reply = readFileSync(new URL('./fixtures/restaurant/menu-draft-reply.json', import.meta.url), 'utf8');
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    String(input).startsWith('https://generativelanguage.googleapis.com/')
      ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: reply }] } }] }), { headers: { 'content-type': 'application/json' } })
      : real(input, init)) as typeof fetch;
  try {
    const drafted = await kim('POST', `${path}/menu-draft`, { description: 'Pizza, pasta and a few starters' });
    assert.equal(drafted.status, 200, JSON.stringify(drafted.data));
    assert.deepEqual(Object.keys(drafted.data), ['menu']);
    assert.deepEqual(drafted.data.menu, JSON.parse(readFileSync(new URL('./fixtures/restaurant/golden/menu-draft/menu.json', import.meta.url), 'utf8')));
  } finally {
    globalThis.fetch = real;
  }
  assert.deepEqual((await kim('GET', path)).data.answers.menu, named.menu, 'the saved menu is untouched');
});

test('presets over HTTP: the back office says what to show, in the business\'s own words, and loses nothing', async () => {
  const team = client('10.1.1.1');
  const ana = client('10.1.1.2');
  assert.equal((await team('POST', '/demo/api/admin/login', { password: 'team-pass' })).status, 200);
  const key = await team('POST', '/demo/api/admin/keys', { person_name: 'Ana Ruiz', company: 'Casa Ana', days: 7 });
  assert.equal((await ana('POST', '/demo/api/session', { key: key.data.key })).status, 200);
  const made = await ana('POST', '/demo/api/workspaces', { preset: 'restaurant', name: 'Casa Ana' });
  assert.equal(made.status, 201);
  const path = `/demo/api/workspaces/${made.data.id}`;
  assert.deepEqual(Object.keys(made.data.preview), ['greeting', 'core_facts', 'hours', 'covers', 'bookable_tables', 'pairs', 'dishes'], 'the restaurant\'s preview: today\'s fields, and no lines');
  assert.equal((await ana('POST', `${path}/start`)).status, 200);

  const state = (await ana('GET', `${path}/state`)).data;
  for (const k of ['tenant', 'today', 'now', 'active_calls', 'plan', 'opening_hours', 'bookings', 'orders', 'messages', 'calls', 'started_at', 'expires_at']) {
    assert.ok(k in state, `/state still has ${k}`);
  }
  // Today's tabs, words and suggestions, as web/src/reception/workspace draws them.
  assert.deepEqual(state.workspace, {
    views: [
      { id: 'floor', label: 'Floor plan' }, { id: 'timeline', label: 'Timeline' }, { id: 'orders', label: 'Kitchen' },
      { id: 'messages', label: 'Messages' }, { id: 'calls', label: 'Calls' },
    ],
    bookings: {
      resource: 'table', resources: 'tables', party: 'Party',
      visit: { expected: 'Expected', arrived: 'Arrived', seated: 'Seated', finished: 'Finished', no_show: 'No-show' }, allergies: true,
    },
    orders: { board: 'Kitchen', done: { collection: 'Collected', delivery: 'Collected' }, drivers: false, advance: false },
    suggestions: [
      'Can I book a table for four on Friday at half seven, outside if possible?',
      "I've got a booking. Can we make it five people instead?",
      'Can I order some food to collect at seven?',
      'Do you have gluten-free options?',
    ],
    resetLine: 'bookings and orders',
  });

  // Our own businesses on the team's board: from what each can do.
  const board = async (slug: string) => (await team('GET', `/demo/api/admin/tenants/${slug}/state`)).data.workspace;
  const lucas = await board('lucas-trattoria');
  assert.deepEqual(lucas.views.map((v: any) => v.label), ['Diary', 'Orders', 'Messages and texts', 'Recent calls']);
  assert.equal(lucas.bookings.party, 'Party');
  const fade = await board('fade-and-co');
  assert.deepEqual(fade.views.map((v: any) => v.id), ['timeline', 'messages', 'calls'], 'a barber takes no orders');
  assert.equal(fade.bookings.party, null);
  assert.equal(fade.orders, undefined);
  const kettle = await board('copper-kettle');
  assert.deepEqual(kettle.views.map((v: any) => v.id), ['orders', 'messages', 'calls'], 'a café that takes no bookings has no diary');
  assert.equal(kettle.bookings, undefined);
});
