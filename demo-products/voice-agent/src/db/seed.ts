// Demo tenants from fixtures/tenants, and a realistic diary for each one.
//
// An empty diary makes a bad demo: every time is free, so the agent never has
// to offer an alternative. seedDiary() fills roughly a third of the slots over
// the next week, busier on Friday and Saturday evenings, from a fixed seed so
// a reset always produces the same-looking week.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Repo } from './repo.ts';
import type { Tenant, TenantProfile } from '../domain/types.ts';
import { candidateTimes, checkSlot } from '../domain/availability.ts';
import { addDays, toLocal, weekdayOf } from '../domain/time.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures', 'tenants');

export function loadFixtures(): TenantProfile[] {
  return readdirSync(FIXTURES)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(FIXTURES, f), 'utf8')) as TenantProfile);
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  'Patel', 'Jones', 'Okafor', 'Smith', 'Nowak', 'Williams', 'Hughes', 'Khan', 'Taylor', 'Brown',
  'Murphy', 'Singh', 'Walker', 'Evans', 'Chen', 'Wright', 'Kowalski', 'Ahmed', 'Green', 'Clarke',
];

export async function seedDiary(repo: Repo, tenant: Tenant, now: Date, days = 7): Promise<number> {
  const services = tenant.profile.booking?.services ?? [];
  if (!services.length) return 0;
  const random = rng([...tenant.slug].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const today = toLocal(now, tenant.profile.timezone).date;
  let made = 0;
  for (let d = 0; d < days; d++) {
    const date = addDays(today, d);
    const wd = weekdayOf(date);
    const busy = wd === 5 || wd === 6 ? 0.5 : wd === 0 ? 0.35 : 0.25;
    for (const service of services) {
      for (const time of candidateTimes(service, date)) {
        const evening = Number(time.slice(0, 2)) >= 18 ? 1.3 : 1;
        if (random() > busy * evening * (service.kind === 'table' ? 1.6 : 0.8)) continue;
        const party = service.kind === 'table' ? [2, 2, 2, 3, 4, 4, 5, 6][Math.floor(random() * 8)] : 1;
        const existing = await repo.busyForDate(tenant, date);
        const slot = checkSlot(
          { profile: tenant.profile, serviceKey: service.key, date, time, partySize: party, now, existing },
          service,
          time,
        );
        if (!slot) continue;
        const r = await repo.createBooking(
          tenant,
          {
            service: service.key, date, time, party_size: party,
            name: `${'ABCDEFGHJKLMNPRSTW'[Math.floor(random() * 18)]}. ${NAMES[Math.floor(random() * NAMES.length)]}`,
            phone: null, notes: null, source: 'seed',
          },
          now,
        );
        if (r.ok) made++;
      }
    }
  }
  return made;
}

export async function seedAll(repo: Repo, now = new Date(), opts: { diary?: boolean } = {}): Promise<Tenant[]> {
  const out: Tenant[] = [];
  for (const profile of loadFixtures()) {
    const tenant = await repo.upsertTenant(profile);
    if (opts.diary !== false) {
      await repo.resetTenantData(tenant.id);
      await seedDiary(repo, tenant, now);
    }
    out.push(tenant);
  }
  return out;
}
