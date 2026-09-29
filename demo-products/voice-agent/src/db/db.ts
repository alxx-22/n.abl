// One small database interface over two drivers.
//
//   DATABASE_URL set   → node-postgres against the Supabase project
//   otherwise          → PGlite (Postgres compiled to WASM, in-process)
//
// The same SQL runs on both, so tests exercise the real queries without ever
// writing into the shared Supabase project.

import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export interface Queryable {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  readonly kind: 'pglite' | 'postgres';
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function openPglite(dir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dir) mkdirSync(dir, { recursive: true });
  const pg = await PGlite.create(dir ?? 'memory://');
  const wrap = (q: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): Queryable => ({
    async query<T>(sql: string, params?: unknown[]) {
      return (await q.query(sql, params ?? [])).rows as T[];
    },
  });
  const base = wrap(pg);
  return {
    kind: 'pglite',
    query: base.query,
    async tx(fn) {
      return pg.transaction(async (t) => fn(wrap(t)));
    },
    async exec(sql) {
      await pg.exec(sql);
    },
    async close() {
      await pg.close();
    },
  };
}

export async function openPostgres(url: string): Promise<Db> {
  const pgmod = await import('pg');
  const Pool = pgmod.default.Pool;
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const clean = url.replace(/[?&]sslmode=[^&]*/g, '');
  // Supabase requires TLS. The pooler's certificate chain is Supabase's own CA,
  // so verification is off here; the connection is still encrypted.
  const pool = new Pool({ connectionString: clean, ssl: local ? false : { rejectUnauthorized: false }, max: 5 });
  const base: Queryable = {
    async query<T>(sql: string, params?: unknown[]) {
      return (await pool.query(sql, params as unknown[])).rows as T[];
    },
  };
  return {
    kind: 'postgres',
    query: base.query,
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await fn({
          async query<T>(sql: string, params?: unknown[]) {
            return (await client.query(sql, params as unknown[])).rows as T[];
          },
        });
        await client.query('commit');
        return out;
      } catch (err) {
        await client.query('rollback').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

export async function openDb(opts: { databaseUrl?: string; pgliteDir?: string }): Promise<Db> {
  return opts.databaseUrl ? openPostgres(opts.databaseUrl) : openPglite(opts.pgliteDir);
}

export function migrationFiles(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ name: f.replace(/\.sql$/, ''), sql: readFileSync(join(MIGRATIONS_DIR, f), 'utf8') }));
}

/** Apply any migration not yet recorded in voice_schema_migrations. */
export async function migrate(db: Db): Promise<string[]> {
  const exists = await db.query<{ ok: boolean }>(
    `select to_regclass('public.voice_schema_migrations') is not null as ok`,
  );
  const done = new Set<string>();
  if (exists[0]?.ok) {
    for (const r of await db.query<{ name: string }>('select name from public.voice_schema_migrations')) done.add(r.name);
  }
  const applied: string[] = [];
  for (const m of migrationFiles()) {
    if (done.has(m.name)) continue;
    await db.exec(m.sql);
    await db.query('insert into public.voice_schema_migrations (name) values ($1) on conflict do nothing', [m.name]);
    applied.push(m.name);
  }
  return applied;
}
