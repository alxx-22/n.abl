// npm run db:migrate   apply voice_ migrations (PGlite locally, or DATABASE_URL)
// npm run db:seed      load the demo tenants and a week of realistic bookings

import { loadConfig } from '../config.ts';
import { migrate, openDb } from './db.ts';
import { Repo } from './repo.ts';
import { seedAll } from './seed.ts';

const cmd = process.argv[2];
const config = loadConfig();
const db = await openDb({ databaseUrl: config.databaseUrl, pgliteDir: config.pgliteDir });
console.log(`database: ${db.kind === 'postgres' ? 'Supabase (DATABASE_URL)' : `PGlite at ${config.pgliteDir}`}`);
try {
  const applied = await migrate(db);
  console.log(applied.length ? `applied: ${applied.join(', ')}` : 'migrations: up to date');
  if (cmd === 'seed') {
    const tenants = await seedAll(new Repo(db));
    for (const t of tenants) console.log(`seeded ${t.slug} (PIN ${t.profile.demo_pin ?? '—'})`);
  }
} finally {
  await db.close();
}
