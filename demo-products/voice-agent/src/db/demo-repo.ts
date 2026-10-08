// Queries for the demo service: keys, the entry throttle, usage, and the
// workspaces keys own. Like repo.ts, nothing outside src/db writes SQL.

import type { Db } from './db.ts';
import type { Tenant, TenantProfile } from '../domain/types.ts';
import { mapTenant } from './repo.ts';
import { limitsFor, type KeyKind, type Limits } from '../demo/access.ts';

export interface DemoKey {
  id: string;
  kind: KeyKind;
  key_prefix: string;
  person_name: string;
  company: string | null;
  email: string | null;
  products: string[];
  crm_lead_id: string | null;
  issued_by: string | null;
  limits: Limits;
  notes: string | null;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  last_used_at: Date | null;
}

export interface Workspace {
  tenant: Tenant;
  owner_key_id: string | null;
  /** Shared keys: the person (browser) the workspace belongs to. */
  owner_visitor: string | null;
  /** When it is deleted; null keeps it (private keys, our own businesses). */
  expires_at: Date | null;
  created_at: Date;
  preset: string | null;
  config: any;
  started_at: Date | null;
  updated_at: Date;
}

/**
 * Every kind of usage row, as a list so a test can insert each one: a kind
 * added here but not to voice_demo_usage's CHECK (in a migration) would
 * fail only when a prospect first did that thing (PRESETS.md §1, rule 6).
 */
export const USAGE_KINDS = [
  'opened', 'workspace_created', 'config_saved', 'scouted', 'started', 'reset',
  'call', 'booking', 'order', 'menu_draft', 'faq_draft', 'staff_action',
] as const;
export type UsageKind = (typeof USAGE_KINDS)[number];

function mapKey(r: any): DemoKey {
  const kind: KeyKind = r.kind === 'shared' ? 'shared' : 'private';
  return {
    id: r.id,
    kind,
    key_prefix: r.key_prefix,
    person_name: r.person_name,
    company: r.company,
    email: r.email,
    products: r.products ?? [],
    crm_lead_id: r.crm_lead_id,
    issued_by: r.issued_by,
    limits: limitsFor(r.limits, kind),
    notes: r.notes,
    created_at: new Date(r.created_at),
    expires_at: new Date(r.expires_at),
    revoked_at: r.revoked_at ? new Date(r.revoked_at) : null,
    last_used_at: r.last_used_at ? new Date(r.last_used_at) : null,
  };
}

const WS_COLUMNS = 'id, slug, profile, clock_offset_ms, owner_key_id, owner_visitor, expires_at, preset, config, started_at, created_at, updated_at';

function mapWorkspace(r: any): Workspace {
  return {
    tenant: mapTenant(r),
    owner_key_id: r.owner_key_id,
    owner_visitor: r.owner_visitor ?? null,
    expires_at: r.expires_at ? new Date(r.expires_at) : null,
    created_at: new Date(r.created_at ?? r.updated_at),
    preset: r.preset,
    config: r.config,
    started_at: r.started_at ? new Date(r.started_at) : null,
    updated_at: new Date(r.updated_at),
  };
}

export class DemoRepo {
  readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  // ── Keys ────────────────────────────────────────────────────────────────

  async createKey(k: {
    hash: string; prefix: string; person_name: string; kind?: KeyKind; company?: string | null; email?: string | null;
    products?: string[]; crm_lead_id?: string | null; issued_by?: string | null; limits?: Partial<Limits>;
    notes?: string | null; expires_at: Date;
  }): Promise<DemoKey> {
    const rows = await this.db.query(
      `insert into public.voice_demo_keys (key_hash, key_prefix, person_name, company, email, products, crm_lead_id, issued_by, limits, notes, expires_at, kind)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12) returning *`,
      [k.hash, k.prefix, k.person_name, k.company ?? null, k.email ?? null, k.products ?? ['reception'], k.crm_lead_id ?? null,
        k.issued_by ?? null, JSON.stringify(k.limits ?? {}), k.notes ?? null, k.expires_at.toISOString(), k.kind ?? 'private'],
    );
    return mapKey(rows[0]);
  }

  async keyByHash(hash: string): Promise<DemoKey | null> {
    const rows = await this.db.query('select * from public.voice_demo_keys where key_hash = $1', [hash]);
    return rows[0] ? mapKey(rows[0]) : null;
  }

  async keyById(id: string): Promise<DemoKey | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const rows = await this.db.query('select * from public.voice_demo_keys where id = $1', [id]);
    return rows[0] ? mapKey(rows[0]) : null;
  }

  async listKeys(): Promise<(DemoKey & { workspaces: number; call_seconds_24h: number; people: number })[]> {
    const rows = await this.db.query(
      `select k.*,
         (select count(*) from public.voice_tenants t where t.owner_key_id = k.id)::int as workspaces,
         (select count(distinct u.visitor) from public.voice_demo_usage u where u.key_id = k.id and u.kind = 'opened')::int as people,
         coalesce((select sum((u.data->>'seconds')::int) from public.voice_demo_usage u
            where u.key_id = k.id and u.kind = 'call' and u.at > now() - interval '1 day'), 0)::int as call_seconds_24h
       from public.voice_demo_keys k order by k.created_at desc`,
    );
    return rows.map((r) => ({ ...mapKey(r), workspaces: Number(r.workspaces), call_seconds_24h: Number(r.call_seconds_24h), people: Number(r.people) }));
  }

  async revokeKey(id: string): Promise<void> {
    await this.db.query('update public.voice_demo_keys set revoked_at = now() where id = $1 and revoked_at is null', [id]);
  }

  async extendKey(id: string, days: number): Promise<void> {
    await this.db.query(
      `update public.voice_demo_keys set expires_at = greatest(expires_at, now()) + make_interval(days => $2::int) where id = $1`,
      [id, days],
    );
  }

  async touchKey(id: string): Promise<void> {
    await this.db.query('update public.voice_demo_keys set last_used_at = now() where id = $1', [id]);
  }

  // ── The entry throttle ──────────────────────────────────────────────────

  async recordAttempt(ipHash: string, prefix: string, ok: boolean): Promise<void> {
    await this.db.query('insert into public.voice_demo_attempts (ip_hash, key_prefix, ok) values ($1, $2, $3)', [ipHash, prefix, ok]);
  }

  async recentMisses(ipHash: string, prefix: string, minutes: number): Promise<{ ip: number; prefix: number }> {
    const rows = await this.db.query(
      `select count(*) filter (where ip_hash = $1)::int as ip, count(*) filter (where key_prefix = $2)::int as prefix
       from public.voice_demo_attempts where not ok and at > now() - make_interval(mins => $3::int)`,
      [ipHash, prefix, minutes],
    );
    return { ip: Number(rows[0]?.ip ?? 0), prefix: Number(rows[0]?.prefix ?? 0) };
  }

  async pruneAttempts(): Promise<void> {
    await this.db.query(`delete from public.voice_demo_attempts where at < now() - interval '1 day'`);
  }

  // ── Usage ───────────────────────────────────────────────────────────────

  async recordUsage(keyId: string, tenantId: string | null, kind: UsageKind, data: Record<string, unknown> = {}, visitor: string | null = null): Promise<void> {
    await this.db.query('insert into public.voice_demo_usage (key_id, tenant_id, kind, data, visitor) values ($1, $2, $3, $4::jsonb, $5)', [
      keyId, tenantId, kind, JSON.stringify(data), visitor,
    ]);
  }

  /** On a shared key, pass the visitor: its limits are per person. */
  async countUsage(keyId: string, kinds: UsageKind[], hours: number, visitor: string | null = null): Promise<number> {
    const rows = await this.db.query(
      `select count(*)::int as n from public.voice_demo_usage where key_id = $1 and kind = any($2::text[]) and at > now() - make_interval(hours => $3::int)
         and ($4::text is null or visitor = $4)`,
      [keyId, kinds, hours, visitor],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async listUsage(keyId: string, limit = 100): Promise<any[]> {
    return this.db.query('select at, kind, tenant_id, data from public.voice_demo_usage where key_id = $1 order by at desc limit $2', [keyId, limit]);
  }

  /** Seconds of live calls on this key's workspaces in the last 24 hours, the one in progress included. */
  async callSeconds24h(keyId: string, visitor: string | null = null): Promise<number> {
    // Calls are counted from usage once they end (a shared demo's calls go when it is deleted), plus any still running.
    const rows = await this.db.query(
      `select
         coalesce((select sum((data->>'seconds')::int) from public.voice_demo_usage
           where key_id = $1 and kind = 'call' and at > now() - interval '1 day' and ($2::text is null or visitor = $2)), 0)
         + coalesce((select sum(extract(epoch from (now() - c.started_at))) from public.voice_calls c join public.voice_tenants t on t.id = c.tenant_id
           where t.owner_key_id = $1 and c.ended_at is null and c.started_at > now() - interval '1 day' and ($2::text is null or t.owner_visitor = $2)), 0) as s`,
      [keyId, visitor],
    );
    return Math.round(Number(rows[0]?.s ?? 0));
  }

  // ── Workspaces ──────────────────────────────────────────────────────────

  /** A key's workspaces; on a shared key, pass the visitor to get only theirs. */
  async listWorkspaces(keyId: string, visitor: string | null = null): Promise<Workspace[]> {
    const rows = await this.db.query(
      `select ${WS_COLUMNS} from public.voice_tenants
       where owner_key_id = $1 and ($2::text is null or owner_visitor = $2) and (expires_at is null or expires_at > now()) order by created_at`,
      [keyId, visitor],
    );
    return rows.map(mapWorkspace);
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const rows = await this.db.query(`select ${WS_COLUMNS} from public.voice_tenants where id = $1`, [id]);
    return rows[0] ? mapWorkspace(rows[0]) : null;
  }

  async createWorkspace(keyId: string, preset: string, profile: TenantProfile, config: unknown, opts: { visitor?: string | null; expiresAt?: Date | null } = {}): Promise<Workspace> {
    const rows = await this.db.query(
      `insert into public.voice_tenants (slug, name, business_type, status, profile, owner_key_id, preset, config, owner_visitor, expires_at)
       values ($1, $2, $3, 'demo', $4::jsonb, $5, $6, $7::jsonb, $8, $9)
       returning ${WS_COLUMNS}`,
      [profile.slug, profile.name, profile.business_type, JSON.stringify(profile), keyId, preset, JSON.stringify(config), opts.visitor ?? null, opts.expiresAt ?? null],
    );
    return mapWorkspace(rows[0]);
  }

  async setExpiry(id: string, at: Date | null): Promise<void> {
    await this.db.query('update public.voice_tenants set expires_at = $2 where id = $1', [id, at]);
  }

  async saveWorkspace(id: string, profile: TenantProfile, config: unknown): Promise<Workspace> {
    const rows = await this.db.query(
      `update public.voice_tenants set name = $2, business_type = $3, profile = $4::jsonb, config = $5::jsonb, updated_at = now()
       where id = $1 returning ${WS_COLUMNS}`,
      [id, profile.name, profile.business_type, JSON.stringify(profile), JSON.stringify(config)],
    );
    return mapWorkspace(rows[0]);
  }

  /**
   * Whether any business holds this demo line PIN, an ended demo not yet
   * deleted included: the unique index counts it too. `profile ? 'demo_pin'`
   * is the index's own condition, so the lookup can use it.
   */
  async pinTaken(pin: string): Promise<boolean> {
    const rows = await this.db.query(`select 1 from public.voice_tenants where profile ? 'demo_pin' and profile->>'demo_pin' = $1 limit 1`, [pin]);
    return rows.length > 0;
  }

  async markStarted(id: string): Promise<void> {
    await this.db.query('update public.voice_tenants set started_at = coalesce(started_at, now()) where id = $1', [id]);
  }

  /**
   * Deletes a prospect's workspace and everything it generated: bookings,
   * orders, payments, calls and their events, texts and customers go with it
   * (on delete cascade), and so does its website read, unless another live
   * workspace uses the same one. Usage counts stay, without the workspace.
   */
  async deleteWorkspace(id: string): Promise<void> {
    await this.db.tx(async (q) => {
      const rows = await q.query<any>(`select config->'scan'->>'id' as scan from public.voice_tenants where id = $1 and owner_key_id is not null`, [id]);
      if (!rows[0]) return;
      await q.query('delete from public.voice_tenants where id = $1 and owner_key_id is not null', [id]);
      const scan = rows[0].scan;
      if (scan && /^[0-9a-f-]{36}$/.test(scan)) {
        const others = await q.query(`select 1 from public.voice_tenants where config->'scan'->>'id' = $1 limit 1`, [scan]);
        if (!others.length) await q.query('delete from public.voice_site_scans where id = $1', [scan]);
      }
    });
  }

  /**
   * Workspaces due for deletion: shared demos past their hour, and private
   * demos whose key expired or was switched off more than the retention ago.
   */
  async workspacesDue(retentionDays: number): Promise<{ id: string; reason: 'expired' | 'retention' }[]> {
    const rows = await this.db.query<any>(
      `select t.id, case when t.expires_at is not null and t.expires_at <= now() then 'expired' else 'retention' end as reason
       from public.voice_tenants t join public.voice_demo_keys k on k.id = t.owner_key_id
       where (t.expires_at is not null and t.expires_at <= now())
          or k.expires_at < now() - make_interval(days => $1::int)
          or (k.revoked_at is not null and k.revoked_at < now() - make_interval(days => $1::int))`,
      [retentionDays],
    );
    return rows.map((r) => ({ id: r.id, reason: r.reason }));
  }

  // ── The website scout's cache ───────────────────────────────────────────

  async cachedPage(url: string, kind: 'html' | 'pdf' | 'rendered', maxAgeDays: number): Promise<{ status: number; text: string | null; signals: any; fetched_at: Date } | null> {
    const rows = await this.db.query<any>(
      `select status, text, signals, fetched_at from public.voice_site_pages
       where url = $1 and kind = $2 and fetched_at > now() - make_interval(days => $3::int)`,
      [url, kind, maxAgeDays],
    );
    return rows[0] ? { ...rows[0], fetched_at: new Date(rows[0].fetched_at) } : null;
  }

  async cachePage(p: { site: string; url: string; kind: 'html' | 'pdf' | 'rendered'; status: number; text: string | null; signals: unknown; hash: string | null }): Promise<void> {
    await this.db.query(
      `insert into public.voice_site_pages (site, url, kind, status, text, signals, content_hash)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7)
       on conflict (url, kind) do update set fetched_at = now(), status = excluded.status, text = excluded.text,
         signals = excluded.signals, content_hash = excluded.content_hash`,
      [p.site, p.url, p.kind, p.status, p.text, JSON.stringify(p.signals ?? {}), p.hash],
    );
  }

  async createScan(site: string, keyId: string | null): Promise<string> {
    const rows = await this.db.query(`insert into public.voice_site_scans (site, key_id) values ($1, $2) returning id`, [site, keyId]);
    return rows[0].id;
  }

  async finishScan(id: string, r: { status: 'done' | 'failed'; result?: unknown; requests: number; tokens: number; error?: string | null }): Promise<void> {
    await this.db.query(
      `update public.voice_site_scans set finished_at = now(), status = $2, result = $3::jsonb, requests = $4, tokens = $5, error = $6 where id = $1`,
      [id, r.status, JSON.stringify(r.result ?? {}), r.requests, r.tokens, r.error ?? null],
    );
  }

  async getScan(id: string): Promise<{ id: string; site: string; status: 'running' | 'done' | 'failed'; result: any; error: string | null; started_at: Date } | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const rows = await this.db.query<any>('select id, site, status, result, error, started_at from public.voice_site_scans where id = $1', [id]);
    return rows[0] ? { ...rows[0], started_at: new Date(rows[0].started_at) } : null;
  }

  /** A finished scan of this site young enough to reuse. */
  async recentScan(site: string, maxAgeDays: number): Promise<string | null> {
    const rows = await this.db.query(
      `select id from public.voice_site_scans where site = $1 and status = 'done' and finished_at > now() - make_interval(days => $2::int)
       order by finished_at desc limit 1`,
      [site, maxAgeDays],
    );
    return rows[0]?.id ?? null;
  }

  /** Scans left running by a restart are marked failed at start-up. */
  async failStaleScans(): Promise<void> {
    await this.db.query(`update public.voice_site_scans set status = 'failed', finished_at = now(), error = 'The server restarted during the scan.' where status = 'running'`);
  }
}
