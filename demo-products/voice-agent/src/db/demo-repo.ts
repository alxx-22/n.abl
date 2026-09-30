// Queries for the demo service: keys, the entry throttle, usage, and the
// workspaces keys own. Like repo.ts, nothing outside src/db writes SQL.

import type { Db } from './db.ts';
import type { Tenant, TenantProfile } from '../domain/types.ts';
import { limitsFor, type Limits } from '../demo/access.ts';

export interface DemoKey {
  id: string;
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
  preset: string | null;
  config: any;
  started_at: Date | null;
  updated_at: Date;
}

export type UsageKind =
  | 'opened' | 'workspace_created' | 'config_saved' | 'scouted' | 'started' | 'reset'
  | 'call' | 'booking' | 'order' | 'menu_draft' | 'faq_draft' | 'staff_action';

function mapKey(r: any): DemoKey {
  return {
    id: r.id,
    key_prefix: r.key_prefix,
    person_name: r.person_name,
    company: r.company,
    email: r.email,
    products: r.products ?? [],
    crm_lead_id: r.crm_lead_id,
    issued_by: r.issued_by,
    limits: limitsFor(r.limits),
    notes: r.notes,
    created_at: new Date(r.created_at),
    expires_at: new Date(r.expires_at),
    revoked_at: r.revoked_at ? new Date(r.revoked_at) : null,
    last_used_at: r.last_used_at ? new Date(r.last_used_at) : null,
  };
}

function mapWorkspace(r: any): Workspace {
  return {
    tenant: { id: r.id, slug: r.slug, profile: r.profile },
    owner_key_id: r.owner_key_id,
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
    hash: string; prefix: string; person_name: string; company?: string | null; email?: string | null;
    products?: string[]; crm_lead_id?: string | null; issued_by?: string | null; limits?: Partial<Limits>;
    notes?: string | null; expires_at: Date;
  }): Promise<DemoKey> {
    const rows = await this.db.query(
      `insert into public.voice_demo_keys (key_hash, key_prefix, person_name, company, email, products, crm_lead_id, issued_by, limits, notes, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11) returning *`,
      [k.hash, k.prefix, k.person_name, k.company ?? null, k.email ?? null, k.products ?? ['reception'], k.crm_lead_id ?? null,
        k.issued_by ?? null, JSON.stringify(k.limits ?? {}), k.notes ?? null, k.expires_at.toISOString()],
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

  async listKeys(): Promise<(DemoKey & { workspaces: number; call_seconds_24h: number })[]> {
    const rows = await this.db.query(
      `select k.*,
         (select count(*) from public.voice_tenants t where t.owner_key_id = k.id)::int as workspaces,
         coalesce((select sum(extract(epoch from (coalesce(c.ended_at, now()) - c.started_at)))
            from public.voice_calls c join public.voice_tenants t on t.id = c.tenant_id
            where t.owner_key_id = k.id and c.started_at > now() - interval '1 day'), 0)::int as call_seconds_24h
       from public.voice_demo_keys k order by k.created_at desc`,
    );
    return rows.map((r) => ({ ...mapKey(r), workspaces: Number(r.workspaces), call_seconds_24h: Number(r.call_seconds_24h) }));
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

  async recordUsage(keyId: string, tenantId: string | null, kind: UsageKind, data: Record<string, unknown> = {}): Promise<void> {
    await this.db.query('insert into public.voice_demo_usage (key_id, tenant_id, kind, data) values ($1, $2, $3, $4::jsonb)', [
      keyId, tenantId, kind, JSON.stringify(data),
    ]);
  }

  async countUsage(keyId: string, kinds: UsageKind[], hours: number): Promise<number> {
    const rows = await this.db.query(
      `select count(*)::int as n from public.voice_demo_usage where key_id = $1 and kind = any($2::text[]) and at > now() - make_interval(hours => $3::int)`,
      [keyId, kinds, hours],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async listUsage(keyId: string, limit = 100): Promise<any[]> {
    return this.db.query('select at, kind, tenant_id, data from public.voice_demo_usage where key_id = $1 order by at desc limit $2', [keyId, limit]);
  }

  /** Seconds of live calls on this key's workspaces in the last 24 hours, the one in progress included. */
  async callSeconds24h(keyId: string): Promise<number> {
    const rows = await this.db.query(
      `select coalesce(sum(extract(epoch from (coalesce(c.ended_at, now()) - c.started_at))), 0)::int as s
       from public.voice_calls c join public.voice_tenants t on t.id = c.tenant_id
       where t.owner_key_id = $1 and c.started_at > now() - interval '1 day'`,
      [keyId],
    );
    return Number(rows[0]?.s ?? 0);
  }

  // ── Workspaces ──────────────────────────────────────────────────────────

  async listWorkspaces(keyId: string): Promise<Workspace[]> {
    const rows = await this.db.query(
      'select id, slug, profile, owner_key_id, preset, config, started_at, updated_at from public.voice_tenants where owner_key_id = $1 order by created_at',
      [keyId],
    );
    return rows.map(mapWorkspace);
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const rows = await this.db.query(
      'select id, slug, profile, owner_key_id, preset, config, started_at, updated_at from public.voice_tenants where id = $1',
      [id],
    );
    return rows[0] ? mapWorkspace(rows[0]) : null;
  }

  async createWorkspace(keyId: string, preset: string, profile: TenantProfile, config: unknown): Promise<Workspace> {
    const rows = await this.db.query(
      `insert into public.voice_tenants (slug, name, business_type, status, profile, owner_key_id, preset, config)
       values ($1, $2, $3, 'demo', $4::jsonb, $5, $6, $7::jsonb)
       returning id, slug, profile, owner_key_id, preset, config, started_at, updated_at`,
      [profile.slug, profile.name, profile.business_type, JSON.stringify(profile), keyId, preset, JSON.stringify(config)],
    );
    return mapWorkspace(rows[0]);
  }

  async saveWorkspace(id: string, profile: TenantProfile, config: unknown): Promise<Workspace> {
    const rows = await this.db.query(
      `update public.voice_tenants set name = $2, business_type = $3, profile = $4::jsonb, config = $5::jsonb, updated_at = now()
       where id = $1 returning id, slug, profile, owner_key_id, preset, config, started_at, updated_at`,
      [id, profile.name, profile.business_type, JSON.stringify(profile), JSON.stringify(config)],
    );
    return mapWorkspace(rows[0]);
  }

  async markStarted(id: string): Promise<void> {
    await this.db.query('update public.voice_tenants set started_at = coalesce(started_at, now()) where id = $1', [id]);
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.db.query('delete from public.voice_tenants where id = $1 and owner_key_id is not null', [id]);
  }
}
