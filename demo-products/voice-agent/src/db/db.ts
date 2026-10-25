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
import { rootCertificates } from 'node:tls';

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
// Supabase's own root certificate (public; from the dashboard's SSL settings), which signs the
// direct db.<ref>.supabase.co address. SHA-256 80:70:25:AD:…:E6:CA:FA, valid to April 2031.
const SUPABASE_ROOT = join(dirname(fileURLToPath(import.meta.url)), 'supabase-root-2021.crt');

/**
 * TLS for a database that is not on this machine, always verified, name included. The session
 * pooler's certificate is from Amazon's public authority, among the usual roots; the direct address's
 * is Supabase's own, so that root is trusted beside them.
 */
export function sslFor(url: string): false | { ca: string[]; rejectUnauthorized: true } {
  if (/@(localhost|127\.0\.0\.1)[:/]/.test(url)) return false;
  return { ca: [...rootCertificates, readFileSync(SUPABASE_ROOT, 'utf8')], rejectUnauthorized: true };
}

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

/**
 * The same address on the region's other shared poolers. Supabase puts each project on one of
 * several pooler clusters (aws-0-…, aws-1-…), and the wrong one answers "Tenant or user not found".
 */
export function otherPoolers(url: string): string[] {
  const m = /@aws-(\d+)-([a-z0-9-]+)\.pooler\.supabase\.com\b/.exec(url);
  if (!m) return [];
  return [0, 1, 2].filter((n) => String(n) !== m[1]).map((n) => url.replace(m[0], `@aws-${n}-${m[2]}.pooler.supabase.com`));
}

export async function openPostgres(url: string): Promise<Db> {
  const pgmod = await import('pg');
  const Pool = pgmod.default.Pool;
  // An sslmode in the address would replace the verified settings below.
  const open = (u: string) => new Pool({ connectionString: u.replace(/[?&]sslmode=[^&]*/g, ''), ssl: sslFor(u), max: 5 });
  let pool = open(url);
  // A pooler address on the wrong cluster fails at once: try the region's others before giving up.
  const first = await pool.query('select 1').then(() => null, (e: Error) => e);
  if (first && /tenant or user not found/i.test(first.message)) {
    let found = false;
    for (const alt of otherPoolers(url)) {
      const p = open(alt);
      if (await p.query('select 1').then(() => true, () => false)) {
        await pool.end().catch(() => {});
        pool = p;
        found = true;
        console.warn(`DATABASE_URL names the wrong Supabase pooler; this project's is ${/@([^:/@]+\.pooler\.supabase\.com)/.exec(alt)?.[1]}. Connected there; put it in DATABASE_URL to skip this check.`);
        break;
      }
      await p.end().catch(() => {});
    }
    if (!found) throw first;
  }
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
