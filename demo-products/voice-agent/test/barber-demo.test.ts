// A barber's demo over HTTP, as a prospect's browser drives it
// (presets/barber.md §6, milestone 2): the shop floor on the state, a barber
// off today with their bookings needing a new time, a walk-in added and
// served into a free chair, one who leaves, and the waiting list.

import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.ts';
import { addDays, toLocal, weekdayOf } from '../src/domain/time.ts';
import { startServer, type App } from '../src/server/main.ts';

let dir: string;
let app: App;
let origin: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'va-barber-demo-'));
  app = await startServer({ ...loadConfig(), port: 0, pgliteDir: dir, databaseUrl: undefined, consolePassword: 'team-pass', sessionSecret: 'barber-demo-test', demoProxySecret: 'proxy-secret', twilio: undefined }, { sweep: false });
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

test("demo: a barber's shop floor: Dan off today, a walk-in served into a free chair, one gone, the waiting list", async () => {
  const team = client('10.0.2.1');
  assert.equal((await team.call('POST', '/demo/api/admin/login', { password: 'team-pass' })).status, 200);
  const key = await team.call('POST', '/demo/api/admin/keys', { person_name: 'Marcus Kingsley', company: "Kingsley's Barbers" });
  const marcus = client('10.0.2.2');
  assert.equal((await marcus.call('POST', '/demo/api/session', { key: key.data.key })).status, 200);
  const made = await marcus.call('POST', '/demo/api/workspaces', { preset: 'barber' });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  const path = `/demo/api/workspaces/${made.data.id}`;
  const answers = (await marcus.call('GET', path)).data.answers;
  answers.basics.name = "Kingsley's Barbers";
  assert.equal((await marcus.call('PUT', `${path}/answers`, answers)).status, 200);
  // Saturday at 10, the busiest morning, whatever day the test runs.
  let saturday = toLocal(new Date(), 'Europe/London').date;
  while (weekdayOf(saturday) !== 6) saturday = addDays(saturday, 1);
  assert.equal((await marcus.call('POST', `${path}/clock`, { date: saturday, time: '10:00' })).status, 200);
  assert.equal((await marcus.call('POST', `${path}/start`)).status, 200);
  const state = async () => (await marcus.call('GET', `${path}/state`)).data;

  const s = await state();
  assert.deepEqual(s.barber.today, { date: saturday, off: [], notice: null });
  assert.deepEqual(s.barber.services.slice(0, 2), [{ key: 'classic_cut', label: 'Classic cut' }, { key: 'skin_fade', label: 'Skin fade' }]);
  assert.deepEqual(s.team.map((m: any) => m.first_name), ['Marcus', 'Dan', 'Jordan', 'Amira']);
  assert.ok(s.barber.wait_now.length >= 1 && s.barber.wait_now.every((x: any) => /^\d\d:\d\d$/.test(x.free_at)), JSON.stringify(s.barber.wait_now));

  // Dan off today: his bookings still to come today need a new time; the notice is kept; someone not in the team is refused.
  assert.equal((await marcus.call('PATCH', `${path}/today`, { off: ['mike'], notice: null })).status, 400);
  const off = await marcus.call('PATCH', `${path}/today`, { off: ['dan'], notice: 'Card machine down: cash only today.' });
  assert.equal(off.status, 200, JSON.stringify(off.data));
  assert.match(off.data.message, /^Off today: Dan\./);
  const s2 = await state();
  assert.deepEqual([s2.barber.today.off, s2.barber.today.notice], [['dan'], 'Card machine down: cash only today.']);
  const dans = s2.bookings.filter((b: any) => b.date === saturday && b.resource_key === 'dan' && b.status === 'confirmed' && b.visit_status === 'expected');
  assert.ok(dans.length > 0 && dans.every((b: any) => b.needs_new_time === true), `${dans.length} of Dan's`);
  assert.ok(!s2.bookings.some((b: any) => b.resource_key !== 'dan' && b.needs_new_time));
  assert.ok(!s2.barber.wait_now.some((x: any) => x.resource_key === 'dan'), 'Dan is not in the wait now');

  // A walk-in: refused without a real service; added; Dan can't take them; served into Jordan's chair once it's free.
  assert.equal((await marcus.call('POST', `${path}/walkins`, { name: 'Kai', service_key: 'perm', resource_key: null })).status, 400);
  assert.equal((await marcus.call('POST', `${path}/walkins`, { name: 'Kai', service_key: 'classic_cut', resource_key: null })).status, 200);
  const kai = (await state()).barber.queue[0];
  assert.deepEqual([kai.name, kai.service, kai.with, kai.waited_minutes], ['Kai', 'Classic cut', null, 0]);
  assert.equal((await marcus.call('PATCH', `${path}/walkins/${kai.id}`, { action: 'serve', resource_key: 'dan' })).status, 409, 'Dan is off');
  const tenAt = (b: any) => b.date === saturday && b.resource_key === 'jordan' && b.status === 'confirmed' && b.time < '10:30' && b.end_time > '10:00';
  for (const b of s2.bookings.filter(tenAt)) assert.equal((await marcus.call('PATCH', `${path}/bookings/${b.reference}`, { action: 'cancel', notify: false })).status, 200);
  const served = await marcus.call('PATCH', `${path}/walkins/${kai.id}`, { action: 'serve', resource_key: 'jordan' });
  assert.equal(served.status, 200, JSON.stringify(served.data));
  assert.equal(served.data.message, "Kai is in Jordan's chair.");
  const s3 = await state();
  assert.equal(s3.barber.queue.length, 0);
  const chair = s3.bookings.find((b: any) => b.name === 'Kai');
  assert.deepEqual([chair.resource_key, chair.time, chair.visit_status, chair.tags], ['jordan', '10:00', 'arrived', ['walk_in']]);
  assert.equal((await marcus.call('PATCH', `${path}/walkins/${kai.id}`, { action: 'left' })).status, 404, 'served once');

  // One who gives up waiting.
  await marcus.call('POST', `${path}/walkins`, { name: 'Leo', service_key: 'classic_cut', resource_key: 'marcus' });
  const leo = (await state()).barber.queue[0];
  assert.deepEqual([leo.name, leo.with], ['Leo', 'Marcus']);
  assert.equal((await marcus.call('PATCH', `${path}/walkins/${leo.id}`, { action: 'left' })).data.message, 'Leo has gone.');
  assert.equal((await state()).barber.queue.length, 0);

  assert.deepEqual((await state()).barber.waitlist, []);
  assert.equal((await marcus.call('PATCH', `${path}/waitlist/00000000-0000-0000-0000-000000000000`, { action: 'remove' })).status, 404);
});
