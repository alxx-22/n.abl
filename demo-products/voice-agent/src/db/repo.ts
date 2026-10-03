// Every query the product makes. Nothing outside this file writes SQL.
//
// Bookings and orders commit inside a transaction that first locks the
// tenant's row, so availability is re-checked and written as one step: two
// simultaneous callers can never both get the last table.

import { randomInt } from 'node:crypto';
import type { Db, Queryable } from './db.ts';
import type {
  Booking, Buyer, BuyerDetails, BuyerPosition, ListingState, Offer, OfferStatus, Order, OrderLine, Sale, Tenant, TenantProfile,
} from '../domain/types.ts';
import { checkSlot, findService, depositFor, resourceFree, type BusyInterval, type Unavailable } from '../domain/availability.ts';
import type { ListingRule } from '../domain/listings.ts';
import { addDays, normaliseTime, toLocal, zonedToUtc, isIsoDate } from '../domain/time.ts';
import type { SeedPlan } from '../presets/common/types.ts';

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  business_type: string;
  status: string;
  updated_at: Date;
}

const REF_LETTERS = 'AHJKLQRWXY'; // letters that survive a bad phone line

export function newBookingReference(): string {
  const l = () => REF_LETTERS[randomInt(REF_LETTERS.length)];
  return `${l()}${l()}${randomInt(100, 1000)}`;
}

/** "HK482" → "H, K, 4, 8, 2" so the model reads it out one character at a time. */
export function spokenReference(ref: string): string {
  return ref.split('').join(', ');
}

function mapBooking(r: any): Booking {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    reference: r.reference,
    service_key: r.service_key,
    resource_key: r.resource_key,
    starts_at: new Date(r.starts_at),
    ends_at: new Date(r.ends_at),
    party_size: Number(r.party_size),
    name: r.name,
    phone: r.phone,
    notes: r.notes,
    status: r.status,
    source: r.source,
    deposit_pence: Number(r.deposit_pence),
    deposit_paid: Boolean(r.deposit_paid),
    visit_status: r.visit_status ?? 'expected',
    allergies: r.allergies ?? null,
    tags: r.tags ?? [],
    area_key: r.area_key ?? null,
    history: r.history ?? [],
    listing_key: r.listing_key ?? null,
    details: r.details ?? {},
  };
}

const date = (v: unknown): Date | null => (v ? new Date(v as string) : null);

/**
 * A sale's columns, its dates as text: a driver turns a date column into a
 * Date at local midnight, which in British Summer Time is the day before in
 * UTC, so a completion date read back a day early.
 */
const SALE_COLUMNS = `id, listing_key, offer_ref, buyer_name, buyer_phone, agreed_pence, milestones, exchange_target::text as exchange_target,
  completion_date::text as completion_date, parties, chain, status, keys_released_at, updates, created_at`;

function mapListing(r: any): ListingState {
  return {
    listing_key: r.listing_key,
    status: r.status,
    price_pence: Number(r.price_pence),
    qualifier: r.qualifier,
    marketing_continues: Boolean(r.marketing_continues),
    best_final_at: date(r.best_final_at),
    checking: r.checking ?? [],
    blocked: r.blocked ?? [],
    sellers: r.sellers ?? [],
    marketed_at: new Date(r.marketed_at),
    back_on_market_at: date(r.back_on_market_at),
    set_from: r.set_from ?? {},
    history: r.history ?? [],
  };
}

function mapOffer(r: any): Offer {
  return {
    reference: r.reference,
    listing_key: r.listing_key,
    revises: r.revises ?? null,
    amount_pence: Number(r.amount_pence),
    buyer_names: r.buyer_names ?? [],
    phone: r.phone ?? null,
    email: r.email ?? null,
    position: r.position ?? {},
    conditions: r.conditions ?? null,
    solicitor: r.solicitor ?? null,
    flags: r.flags ?? [],
    status: r.status,
    received_at: new Date(r.received_at),
    sent_at: date(r.sent_at),
    decided_at: date(r.decided_at),
    note: r.note ?? null,
    source: r.source,
    call_id: r.call_id ?? null,
    history: r.history ?? [],
  };
}

function mapSale(r: any): Sale {
  return {
    id: r.id,
    listing_key: r.listing_key,
    offer_ref: r.offer_ref ?? null,
    buyer_name: r.buyer_name,
    buyer_phone: r.buyer_phone ?? null,
    agreed_pence: Number(r.agreed_pence),
    milestones: r.milestones ?? [],
    exchange_target: r.exchange_target ?? null,
    completion_date: r.completion_date ?? null,
    parties: r.parties ?? [],
    chain: r.chain ?? null,
    status: r.status,
    keys_released_at: date(r.keys_released_at),
    updates: r.updates ?? [],
    created_at: new Date(r.created_at),
  };
}

const mapBuyer = (r: any): Buyer => ({ phone: r.phone, name: r.name ?? null, details: r.details ?? {}, marketing_consent: Boolean(r.marketing_consent) });

const labelOf = (resources: { key: string; label: string }[], key: string) => resources.find((r) => r.key === key)?.label ?? key;

const historyEntry = (by: string, what: string) => JSON.stringify([{ at: new Date().toISOString(), by, what }]);

function mapOrder(r: any): Order {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    reference: r.reference,
    name: r.name,
    phone: r.phone,
    fulfilment: r.fulfilment,
    due_at: new Date(r.due_at),
    address: r.address,
    postcode: r.postcode,
    lines: r.lines,
    subtotal_pence: Number(r.subtotal_pence),
    delivery_fee_pence: Number(r.delivery_fee_pence),
    total_pence: Number(r.total_pence),
    allergy_notes: r.allergy_notes,
    status: r.status,
    payment_status: r.payment_status,
    created_at: new Date(r.created_at),
  };
}

/**
 * When the kitchen must have an order ready: when it is due for a
 * collection, and the delivery minutes before that for a delivery, which
 * spends them on the road. Written with every order; nothing reads it yet.
 */
export function readyAt(profile: TenantProfile, fulfilment: 'collection' | 'delivery', due: Date): Date {
  const road = fulfilment === 'delivery' ? profile.ordering?.delivery?.extra_minutes ?? 0 : 0;
  return new Date(due.getTime() - road * 60000);
}

export class Repo {
  readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  // ── Tenants ────────────────────────────────────────────────────────────

  async listTenants(): Promise<TenantSummary[]> {
    return this.db.query<TenantSummary>(
      'select id, slug, name, business_type, status, updated_at from public.voice_tenants order by name',
    );
  }

  async getTenant(slug: string): Promise<Tenant | null> {
    const rows = await this.db.query<any>('select id, slug, profile from public.voice_tenants where slug = $1', [slug]);
    return rows[0] ? { id: rows[0].id, slug: rows[0].slug, profile: rows[0].profile } : null;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    const rows = await this.db.query<any>('select id, slug, profile from public.voice_tenants where id = $1', [id]);
    return rows[0] ? { id: rows[0].id, slug: rows[0].slug, profile: rows[0].profile } : null;
  }

  async upsertTenant(profile: TenantProfile): Promise<Tenant> {
    const rows = await this.db.query<any>(
      `insert into public.voice_tenants (slug, name, business_type, status, profile)
       values ($1, $2, $3, $4, $5::jsonb)
       on conflict (slug) do update set name = excluded.name, business_type = excluded.business_type,
         status = excluded.status, profile = excluded.profile, updated_at = now()
       returning id, slug, profile`,
      [profile.slug, profile.name, profile.business_type, profile.status, JSON.stringify(profile)],
    );
    return { id: rows[0].id, slug: rows[0].slug, profile: rows[0].profile };
  }

  async deleteTenant(slug: string): Promise<void> {
    await this.db.query('delete from public.voice_tenants where slug = $1', [slug]);
  }

  // ── Phone numbers ──────────────────────────────────────────────────────

  async routeNumber(e164: string): Promise<{ tenant_id: string | null; purpose: string } | null> {
    const rows = await this.db.query<any>(
      `select tenant_id, purpose from public.voice_phone_numbers
       where e164 = $1 and (assigned_until is null or assigned_until > now())`,
      [e164],
    );
    return rows[0] ?? null;
  }

  /**
   * The business a demo line caller reaches with this PIN; a shared demo past
   * its hour is gone, even before the sweeper deletes it. `profile ?
   * 'demo_pin'` is the unique index's condition, so the lookup can use it.
   */
  async tenantForPin(pin: string): Promise<string | null> {
    const rows = await this.db.query<any>(
      `select id from public.voice_tenants where profile ? 'demo_pin' and profile->>'demo_pin' = $1 and (expires_at is null or expires_at > now()) limit 1`,
      [pin],
    );
    return rows[0]?.id ?? null;
  }

  async assignNumber(e164: string, tenantId: string | null, purpose = 'tenant', until?: Date): Promise<void> {
    await this.db.query(
      `insert into public.voice_phone_numbers (e164, tenant_id, purpose, assigned_until) values ($1, $2, $3, $4)
       on conflict (e164) do update set tenant_id = excluded.tenant_id, purpose = excluded.purpose,
         assigned_until = excluded.assigned_until`,
      [e164, tenantId, purpose, until ?? null],
    );
  }

  async listNumbers(): Promise<any[]> {
    return this.db.query('select * from public.voice_phone_numbers order by e164');
  }

  // ── Customers ──────────────────────────────────────────────────────────

  async findCustomer(tenantId: string, phone: string): Promise<{ id: string; name: string | null; notes: string | null } | null> {
    const rows = await this.db.query<any>(
      'select id, name, notes from public.voice_customers where tenant_id = $1 and phone = $2',
      [tenantId, phone],
    );
    return rows[0] ?? null;
  }

  async upsertCustomer(q: Queryable, tenantId: string, phone: string | null, name: string): Promise<string | null> {
    if (!phone) return null;
    const rows = await q.query<any>(
      `insert into public.voice_customers (tenant_id, phone, name) values ($1, $2, $3)
       on conflict (tenant_id, phone) do update set name = coalesce(excluded.name, public.voice_customers.name), updated_at = now()
       returning id`,
      [tenantId, phone, name],
    );
    return rows[0].id;
  }

  // ── Bookings ───────────────────────────────────────────────────────────

  private async busy(q: Queryable, tenantId: string, from: Date, to: Date): Promise<BusyInterval[]> {
    const rows = await q.query<any>(
      `select id, resource_key, starts_at, ends_at, buffer_minutes, listing_key from public.voice_bookings
       where tenant_id = $1 and status = 'confirmed' and starts_at < $3 and ends_at > $2`,
      [tenantId, from, to],
    );
    return rows.map((r) => ({
      id: r.id,
      resource_key: r.resource_key,
      starts_at: new Date(r.starts_at),
      ends_at: new Date(r.ends_at),
      buffer_minutes: Number(r.buffer_minutes),
      listing_key: r.listing_key ?? null,
    }));
  }

  /** Bookings that could clash with anything on `date` (local), padded a day each side. */
  async busyForDate(tenant: Tenant, date: string, q: Queryable = this.db): Promise<BusyInterval[]> {
    const tz = tenant.profile.timezone;
    return this.busy(q, tenant.id, zonedToUtc(addDays(date, -1), '00:00', tz), zonedToUtc(addDays(date, 2), '00:00', tz));
  }

  async listBookings(tenantId: string, from: Date, to: Date, includeCancelled = false): Promise<Booking[]> {
    const rows = await this.db.query<any>(
      `select * from public.voice_bookings where tenant_id = $1 and starts_at >= $2 and starts_at < $3
       ${includeCancelled ? '' : "and status = 'confirmed'"} order by starts_at`,
      [tenantId, from, to],
    );
    return rows.map(mapBooking);
  }

  async createBooking(
    tenant: Tenant,
    input: {
      service?: string; date: string; time: string; party_size: number; name: string;
      phone?: string | null; notes?: string | null; staff?: string; source: string; call_id?: string | null;
      /** Tables: a seating area, step-free access, and features the caller would like. */
      area?: string; accessible?: boolean; prefer?: string[];
      /** Tables: the one the caller asked for by number. */
      table?: string;
      allergies?: string | null; tags?: string[];
      /** Seeding only: skip the notice period, so today's earlier bookings can exist. */
      ignoreLead?: boolean;
      /** A viewing: the home's rules, checked with the rest, and its key written on the booking. */
      listing?: ListingRule;
      /** The buyer's position, or a valuation's lead. */
      details?: Record<string, unknown>;
    },
    now: Date,
  ): Promise<{ ok: true; booking: Booking } | { ok: false; reason: Unavailable | 'bad_input'; message: string }> {
    const service = findService(tenant.profile, input.service);
    if (!service) return { ok: false, reason: 'unknown_service', message: `No bookable service "${input.service}".` };
    const time = normaliseTime(input.time);
    if (!isIsoDate(input.date) || !time) return { ok: false, reason: 'bad_input', message: 'Date must be YYYY-MM-DD and time HH:MM.' };
    if (!input.name?.trim()) return { ok: false, reason: 'bad_input', message: 'A name is needed for the booking.' };
    if (service.max_party && input.party_size > service.max_party) {
      return { ok: false, reason: 'party_too_large', message: service.large_party_note ?? 'That party is too large to book by phone.' };
    }

    return this.db.tx(async (q) => {
      await q.query('select id from public.voice_tenants where id = $1 for update', [tenant.id]);
      const existing = await this.busyForDate(tenant, input.date, q);
      const slot = checkSlot(
        {
          profile: tenant.profile, serviceKey: service.key, date: input.date, time, partySize: input.party_size, staff: input.staff,
          now: input.ignoreLead ? new Date(0) : now, existing, area: input.area, accessible: input.accessible, prefer: input.prefer, only: input.table,
          listing: input.listing,
        },
        input.ignoreLead ? { ...service, lead_minutes: 0 } : service,
        time,
      );
      if (!slot) return { ok: false as const, reason: 'fully_booked' as const, message: 'That time has just gone, or is not bookable.' };
      const area = tenant.profile.booking?.resources.find((r) => r.key === slot.resource_key)?.area ?? null;
      const customerId = await this.upsertCustomer(q, tenant.id, input.phone ?? null, input.name.trim());
      const deposit = depositFor(service, input.party_size);
      for (let attempt = 0; attempt < 5; attempt++) {
        const reference = newBookingReference();
        const clash = await q.query('select 1 from public.voice_bookings where tenant_id = $1 and reference = $2', [tenant.id, reference]);
        if (clash.length) continue;
        const rows = await q.query<any>(
          `insert into public.voice_bookings
             (tenant_id, reference, service_key, resource_key, starts_at, ends_at, buffer_minutes, party_size,
              customer_id, name, phone, notes, source, deposit_pence, call_id, area_key, allergies, tags, history, listing_key, details)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21::jsonb) returning *`,
          [
            tenant.id, reference, service.key, slot.resource_key, slot.starts_at, slot.ends_at, service.buffer_minutes ?? 0,
            input.party_size, customerId, input.name.trim(), input.phone ?? null, input.notes ?? null, input.source,
            deposit, input.call_id ?? null, area, input.allergies?.trim() || null, input.tags ?? [],
            historyEntry(input.source === 'seed' ? 'seed' : input.source === 'console' ? 'staff' : 'receptionist', 'booked'),
            input.listing?.key ?? null, JSON.stringify(input.details ?? {}),
          ],
        );
        return { ok: true as const, booking: mapBooking(rows[0]) };
      }
      throw new Error('could not allocate a booking reference');
    });
  }

  async findBookings(tenantId: string, by: { reference?: string; phone?: string; name?: string }, now: Date): Promise<Booking[]> {
    const conds: string[] = ['tenant_id = $1', "status = 'confirmed'", 'ends_at > $2'];
    const params: unknown[] = [tenantId, now];
    if (by.reference) {
      params.push(by.reference.replace(/[^a-z0-9]/gi, '').toUpperCase());
      conds.push(`reference = $${params.length}`);
    } else if (by.phone) {
      params.push(by.phone);
      conds.push(`phone = $${params.length}`);
    } else if (by.name) {
      params.push(`%${by.name.trim().toLowerCase()}%`);
      conds.push(`lower(name) like $${params.length}`);
    } else {
      return [];
    }
    const rows = await this.db.query<any>(
      `select * from public.voice_bookings where ${conds.join(' and ')} order by starts_at limit 5`,
      params,
    );
    return rows.map(mapBooking);
  }

  async modifyBooking(
    tenant: Tenant,
    reference: string,
    changes: {
      date?: string; time?: string; party_size?: number; notes?: string; area?: string; accessible?: boolean; allergies?: string; tags?: string[]; name?: string; phone?: string;
      /** A viewing's home rules, which a move must still meet. */
      listing?: ListingRule;
      /** Merged into the booking's details (feedback, a buyer's position). */
      details?: Record<string, unknown>;
    },
    now: Date,
    by = 'receptionist',
  ): Promise<{ ok: true; booking: Booking } | { ok: false; message: string }> {
    return this.db.tx(async (q) => {
      await q.query('select id from public.voice_tenants where id = $1 for update', [tenant.id]);
      const rows = await q.query<any>(
        `select * from public.voice_bookings where tenant_id = $1 and reference = $2 and status = 'confirmed'`,
        [tenant.id, reference.replace(/[^a-z0-9]/gi, '').toUpperCase()],
      );
      if (!rows[0]) return { ok: false as const, message: `No confirmed booking with reference ${reference}.` };
      const b = mapBooking(rows[0]);
      const service = findService(tenant.profile, b.service_key)!;
      const local = toLocal(b.starts_at, tenant.profile.timezone);
      const date = changes.date ?? local.date;
      const time = changes.time ? normaliseTime(changes.time) : local.time;
      const party = changes.party_size ?? b.party_size;
      if (!isIsoDate(date) || !time) return { ok: false as const, message: 'Date must be YYYY-MM-DD and time HH:MM.' };
      if (service.max_party && party > service.max_party) {
        return { ok: false as const, message: service.large_party_note ?? 'That party is too large to book by phone.' };
      }
      const existing = await this.busyForDate(tenant, date, q);
      // Keep the same table and area if they still fit; otherwise find another.
      const area = changes.area ?? b.area_key ?? undefined;
      const req = { profile: tenant.profile, serviceKey: service.key, date, time, partySize: party, now, existing, excludeBookingId: b.id, area, accessible: changes.accessible, keep: b.resource_key, listing: changes.listing };
      // A new name, number or note does not move the booking, even one starting soon.
      const moves = date !== local.date || time !== local.time || party !== b.party_size || (changes.area !== undefined && changes.area !== b.area_key) || changes.accessible !== undefined;
      const slot = moves ? checkSlot(req, service, time) : { time, resource_key: b.resource_key, starts_at: b.starts_at, ends_at: b.ends_at };
      if (!slot) {
        const where = area ? tenant.profile.booking?.areas?.find((x) => x.key === area)?.label.toLowerCase() : undefined;
        return { ok: false as const, message: `That change does not fit${where ? ` in the ${where}` : ''}: the time is taken or not bookable.` };
      }
      const what = [
        changes.date || changes.time ? `moved to ${date} ${time}` : null,
        changes.party_size && changes.party_size !== b.party_size ? `party ${b.party_size} → ${party}` : null,
        slot.resource_key !== b.resource_key ? `table ${b.resource_key} → ${slot.resource_key}` : null,
        changes.name && changes.name !== b.name ? `name ${b.name} → ${changes.name}` : null,
        changes.phone && changes.phone !== b.phone ? 'phone changed' : null,
        changes.notes ? 'notes changed' : null,
        changes.allergies ? 'allergies noted' : null,
        changes.details ? 'details noted' : null,
      ].filter(Boolean).join(', ') || 'changed';
      const newArea = tenant.profile.booking?.resources.find((r) => r.key === slot.resource_key)?.area ?? b.area_key ?? null;
      const updated = await q.query<any>(
        `update public.voice_bookings set starts_at = $2, ends_at = $3, resource_key = $4, party_size = $5,
           notes = coalesce($6, notes), deposit_pence = $7, area_key = $8, allergies = coalesce($9, allergies),
           tags = coalesce($10, tags), history = history || $11::jsonb, name = coalesce($12, name), phone = coalesce($13, phone),
           details = details || $14::jsonb, updated_at = now() where id = $1 returning *`,
        [b.id, slot.starts_at, slot.ends_at, slot.resource_key, party, changes.notes ?? null, depositFor(service, party), newArea,
          changes.allergies ?? null, changes.tags ?? null, historyEntry(by, what), changes.name ?? null, changes.phone ?? null,
          JSON.stringify(changes.details ?? {})],
      );
      return { ok: true as const, booking: mapBooking(updated[0]) };
    });
  }

  async cancelBooking(tenantId: string, reference: string, by = 'receptionist'): Promise<Booking | null> {
    const rows = await this.db.query<any>(
      `update public.voice_bookings set status = 'cancelled', history = history || $3::jsonb, updated_at = now()
       where tenant_id = $1 and reference = $2 and status = 'confirmed' returning *`,
      [tenantId, reference.replace(/[^a-z0-9]/gi, '').toUpperCase(), historyEntry(by, 'cancelled')],
    );
    return rows[0] ? mapBooking(rows[0]) : null;
  }

  // ── Staff actions from the back office ─────────────────────────────────

  /** Put a booking on another table (or a pushed-together pair), keeping its time. */
  async moveBookingToTable(tenant: Tenant, reference: string, resourceKey: string): Promise<{ ok: true; booking: Booking } | { ok: false; message: string }> {
    return this.db.tx(async (q) => {
      await q.query('select id from public.voice_tenants where id = $1 for update', [tenant.id]);
      const rows = await q.query<any>(`select * from public.voice_bookings where tenant_id = $1 and reference = $2 and status = 'confirmed'`, [
        tenant.id, reference.toUpperCase(),
      ]);
      if (!rows[0]) return { ok: false as const, message: 'That booking is not in the diary any more.' };
      const b = mapBooking(rows[0]);
      const resources = tenant.profile.booking?.resources ?? [];
      const r = resources.find((x) => x.key === resourceKey);
      if (!r) return { ok: false as const, message: 'There is no such table.' };
      if (r.key === b.resource_key) return { ok: true as const, booking: b };
      if ((r.capacity ?? 0) < b.party_size) return { ok: false as const, message: `${r.label} seats ${r.capacity}; this booking is for ${b.party_size}.` };
      const date = toLocal(b.starts_at, tenant.profile.timezone).date;
      const existing = await this.busyForDate(tenant, date, q);
      if (!resourceFree(r.key, b.starts_at, b.ends_at, Number(rows[0].buffer_minutes ?? 0), existing, resources, b.id)) {
        return { ok: false as const, message: `${r.label} is taken at that time.` };
      }
      const updated = await q.query<any>(
        `update public.voice_bookings set resource_key = $2, area_key = $3, history = history || $4::jsonb, updated_at = now() where id = $1 returning *`,
        [b.id, r.key, r.area ?? b.area_key ?? null, historyEntry('staff', `moved from ${labelOf(resources, b.resource_key)} to ${r.label}`)],
      );
      return { ok: true as const, booking: mapBooking(updated[0]) };
    });
  }

  async setVisitStatus(tenantId: string, reference: string, status: NonNullable<Booking['visit_status']>): Promise<Booking | null> {
    const rows = await this.db.query<any>(
      `update public.voice_bookings set visit_status = $3, history = history || $4::jsonb, updated_at = now()
       where tenant_id = $1 and reference = $2 and status = 'confirmed' returning *`,
      [tenantId, reference.toUpperCase(), status, historyEntry('staff', `marked ${status.replace('_', '-')}`)],
    );
    return rows[0] ? mapBooking(rows[0]) : null;
  }

  async updateBookingDetails(tenantId: string, reference: string, d: { notes?: string | null; allergies?: string | null; tags?: string[] }): Promise<Booking | null> {
    const rows = await this.db.query<any>(
      `update public.voice_bookings set notes = case when $3 then $4 else notes end, allergies = case when $5 then $6 else allergies end,
         tags = coalesce($7, tags), history = history || $8::jsonb, updated_at = now()
       where tenant_id = $1 and reference = $2 returning *`,
      [tenantId, reference.toUpperCase(), d.notes !== undefined, d.notes ?? null, d.allergies !== undefined, d.allergies ?? null, d.tags ?? null,
        historyEntry('staff', 'details edited')],
    );
    return rows[0] ? mapBooking(rows[0]) : null;
  }

  async getBookingByReference(tenantId: string, reference: string): Promise<Booking | null> {
    const rows = await this.db.query<any>(
      'select * from public.voice_bookings where tenant_id = $1 and reference = $2',
      [tenantId, reference.replace(/[^a-z0-9]/gi, '').toUpperCase()],
    );
    return rows[0] ? mapBooking(rows[0]) : null;
  }

  async markDepositPaid(bookingId: string): Promise<void> {
    await this.db.query('update public.voice_bookings set deposit_paid = true, updated_at = now() where id = $1', [bookingId]);
  }

  // ── Orders ─────────────────────────────────────────────────────────────

  async createOrder(
    tenant: Tenant,
    o: {
      name: string; phone: string | null; fulfilment: 'collection' | 'delivery'; due_at: Date;
      address: string | null; postcode: string | null; lines: OrderLine[]; subtotal_pence: number;
      delivery_fee_pence: number; total_pence: number; allergy_notes: string | null; source: string; call_id: string | null;
    },
  ): Promise<Order> {
    return this.db.tx(async (q) => {
      await q.query('select id from public.voice_tenants where id = $1 for update', [tenant.id]);
      const count = await q.query<any>('select count(*)::int as n from public.voice_orders where tenant_id = $1', [tenant.id]);
      const reference = String(101 + Number(count[0].n));
      const customerId = await this.upsertCustomer(q, tenant.id, o.phone, o.name);
      const rows = await q.query<any>(
        `insert into public.voice_orders (tenant_id, reference, customer_id, name, phone, fulfilment, due_at, ready_at, address, postcode,
           lines, subtotal_pence, delivery_fee_pence, total_pence, allergy_notes, source, call_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17) returning *`,
        [
          tenant.id, reference, customerId, o.name, o.phone, o.fulfilment, o.due_at, readyAt(tenant.profile, o.fulfilment, o.due_at), o.address, o.postcode,
          JSON.stringify(o.lines), o.subtotal_pence, o.delivery_fee_pence, o.total_pence, o.allergy_notes, o.source, o.call_id,
        ],
      );
      return mapOrder(rows[0]);
    });
  }

  async getOrder(tenantId: string, reference: string): Promise<Order | null> {
    const rows = await this.db.query<any>('select * from public.voice_orders where tenant_id = $1 and reference = $2', [
      tenantId,
      reference.replace(/[^0-9]/g, ''),
    ]);
    return rows[0] ? mapOrder(rows[0]) : null;
  }

  async listOrders(tenantId: string, since: Date): Promise<Order[]> {
    const rows = await this.db.query<any>(
      'select * from public.voice_orders where tenant_id = $1 and created_at >= $2 order by created_at desc limit 50',
      [tenantId, since],
    );
    return rows.map(mapOrder);
  }

  /**
   * Every order due in [from, to), soonest first, cancelled ones included:
   * a board that shows a whole day (the takeaway's) needs all of them, where
   * listOrders gives the latest 50 taken.
   */
  async listOrdersDue(tenantId: string, from: Date, to: Date): Promise<Order[]> {
    const rows = await this.db.query<any>(
      'select * from public.voice_orders where tenant_id = $1 and due_at >= $2 and due_at < $3 order by due_at, created_at',
      [tenantId, from, to],
    );
    return rows.map(mapOrder);
  }

  /** Orders due in [from, to), for collection-slot capacity. */
  async ordersDueBetween(tenantId: string, from: Date, to: Date): Promise<number> {
    const rows = await this.db.query<any>(
      `select count(*)::int as n from public.voice_orders where tenant_id = $1 and status <> 'cancelled' and due_at >= $2 and due_at < $3`,
      [tenantId, from, to],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async setOrderStatus(tenantId: string, reference: string, status: string): Promise<void> {
    await this.db.query('update public.voice_orders set status = $3 where tenant_id = $1 and reference = $2', [tenantId, reference, status]);
  }

  async markOrderPaid(orderId: string): Promise<void> {
    await this.db.query(`update public.voice_orders set payment_status = 'paid' where id = $1`, [orderId]);
  }

  // ── Payments (demo) ────────────────────────────────────────────────────

  async recordPayment(p: {
    tenant_id: string; order_id?: string | null; booking_id?: string | null; amount_pence: number;
    card_last4: string | null; auth_code: string | null; result: 'approved' | 'declined'; call_id: string | null;
  }): Promise<void> {
    await this.db.query(
      `insert into public.voice_payments (tenant_id, order_id, booking_id, amount_pence, card_last4, auth_code, result, call_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [p.tenant_id, p.order_id ?? null, p.booking_id ?? null, p.amount_pence, p.card_last4, p.auth_code, p.result, p.call_id],
    );
  }

  // ── Calls ──────────────────────────────────────────────────────────────

  async createCall(c: { tenant_id: string; channel: string; provider_call_id?: string | null; from_number?: string | null; to_number?: string | null }): Promise<string> {
    const rows = await this.db.query<any>(
      `insert into public.voice_calls (tenant_id, channel, provider_call_id, from_number, to_number)
       values ($1,$2,$3,$4,$5) returning id`,
      [c.tenant_id, c.channel, c.provider_call_id ?? null, c.from_number ?? null, c.to_number ?? null],
    );
    return rows[0].id;
  }

  async updateCall(id: string, patch: Partial<{
    model: string; fallbacks: unknown[]; ended_at: Date; outcome: string; summary: string;
    usage: unknown; latency: unknown; guardrail_flags: number; provider_call_id: string;
  }>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      const json = k === 'fallbacks' || k === 'usage' || k === 'latency';
      params.push(json ? JSON.stringify(v) : v);
      sets.push(`${k} = $${params.length}${json ? '::jsonb' : ''}`);
    }
    if (!sets.length) return;
    await this.db.query(`update public.voice_calls set ${sets.join(', ')} where id = $1`, params);
  }

  async addEvent(callId: string, tenantId: string, kind: string, data: unknown): Promise<void> {
    await this.db.query(
      'insert into public.voice_call_events (call_id, tenant_id, kind, data) values ($1, $2, $3, $4::jsonb)',
      [callId, tenantId, kind, JSON.stringify(data)],
    );
  }

  async listCalls(tenantId: string, limit = 20): Promise<any[]> {
    return this.db.query(
      'select * from public.voice_calls where tenant_id = $1 order by started_at desc limit $2',
      [tenantId, limit],
    );
  }

  async listEvents(callId: string): Promise<any[]> {
    return this.db.query('select * from public.voice_call_events where call_id = $1 order by id', [callId]);
  }

  // ── Messages ───────────────────────────────────────────────────────────

  async addMessage(m: {
    tenant_id: string; call_id?: string | null; kind: 'sms' | 'message'; to_number?: string | null;
    from_name?: string | null; from_phone?: string | null; body: string; status: string;
    /** Who in the team it is for (a staff key), what it is about, how soon, its own reference: an estate agency's messages. */
    for_staff?: string | null; category?: string | null; urgency?: 'urgent' | 'today' | 'this_week' | null; reference?: string | null;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `insert into public.voice_messages (tenant_id, call_id, kind, to_number, from_name, from_phone, body, status, for_staff, category, urgency, reference, details)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
      [m.tenant_id, m.call_id ?? null, m.kind, m.to_number ?? null, m.from_name ?? null, m.from_phone ?? null, m.body, m.status,
        m.for_staff ?? null, m.category ?? null, m.urgency ?? null, m.reference ?? null, JSON.stringify(m.details ?? {})],
    );
  }

  async listMessages(tenantId: string, limit = 30): Promise<any[]> {
    return this.db.query(
      'select * from public.voice_messages where tenant_id = $1 order by created_at desc limit $2',
      [tenantId, limit],
    );
  }

  /** The texts one number has had from this business, oldest first: the customer's phone. */
  async listTexts(tenantId: string, to: string, limit = 50): Promise<{ id: string; body: string; status: string; created_at: Date }[]> {
    const rows = await this.db.query<any>(
      `select id, body, status, created_at from public.voice_messages
       where tenant_id = $1 and kind = 'sms' and to_number = $2 order by created_at desc limit $3`,
      [tenantId, to, limit],
    );
    return rows.reverse();
  }

  async setMessageStatus(tenantId: string, id: string, status: 'new' | 'read'): Promise<void> {
    await this.db.query(`update public.voice_messages set status = $3 where tenant_id = $1 and id = $2 and kind = 'message'`, [tenantId, id, status]);
  }

  // ── An estate agency: homes, offers, sales and buyers ──────────────────
  // presets/estate-agent.md §5. The profile holds each home's facts; these
  // rows hold what changes during the demo. Only the estate agent's tools
  // and staff actions call these.

  /** Every home's live row. */
  async listingStates(tenantId: string): Promise<ListingState[]> {
    const rows = await this.db.query<any>('select * from public.voice_listings where tenant_id = $1 order by listing_key', [tenantId]);
    return rows.map(mapListing);
  }

  async listingState(tenantId: string, key: string): Promise<ListingState | null> {
    const rows = await this.db.query<any>('select * from public.voice_listings where tenant_id = $1 and listing_key = $2', [tenantId, key]);
    return rows[0] ? mapListing(rows[0]) : null;
  }

  /**
   * A staff change to a home: its status, price, whether viewings go on
   * after a sale is agreed, a best-and-final deadline, facts being checked,
   * blocked dates. Each change is logged in its history.
   */
  async setListing(
    tenantId: string,
    key: string,
    patch: Partial<Pick<ListingState, 'status' | 'price_pence' | 'qualifier' | 'marketing_continues' | 'best_final_at' | 'checking' | 'blocked' | 'back_on_market_at'>>,
    by = 'staff',
    what?: string,
  ): Promise<ListingState | null> {
    const before = await this.listingState(tenantId, key);
    if (!before) return null;
    const said = what ?? ([
      patch.status && patch.status !== before.status ? `${before.status.replace(/_/g, ' ')} → ${patch.status.replace(/_/g, ' ')}` : null,
      patch.price_pence !== undefined && patch.price_pence !== before.price_pence ? `price ${before.price_pence / 100} → ${patch.price_pence / 100}` : null,
      patch.marketing_continues !== undefined && patch.marketing_continues !== before.marketing_continues ? (patch.marketing_continues ? 'viewings continue' : 'viewings stopped') : null,
      patch.best_final_at !== undefined ? (patch.best_final_at ? 'best and final set' : 'best and final cleared') : null,
      patch.checking ? 'facts being checked changed' : null,
      patch.blocked ? 'blocked dates changed' : null,
    ].filter(Boolean).join(', ') || 'changed');
    const rows = await this.db.query<any>(
      `update public.voice_listings set
         status = coalesce($3, status), price_pence = coalesce($4, price_pence), qualifier = coalesce($5, qualifier),
         marketing_continues = coalesce($6, marketing_continues),
         best_final_at = case when $7 then $8::timestamptz else best_final_at end,
         checking = coalesce($9, checking), blocked = coalesce($10::jsonb, blocked),
         back_on_market_at = case when $11 then $12::timestamptz else back_on_market_at end,
         history = history || $13::jsonb, updated_at = now()
       where tenant_id = $1 and listing_key = $2 returning *`,
      [tenantId, key, patch.status ?? null, patch.price_pence ?? null, patch.qualifier ?? null, patch.marketing_continues ?? null,
        patch.best_final_at !== undefined, patch.best_final_at ?? null, patch.checking ?? null, patch.blocked ? JSON.stringify(patch.blocked) : null,
        patch.back_on_market_at !== undefined, patch.back_on_market_at ?? null, historyEntry(by, said)],
    );
    return rows[0] ? mapListing(rows[0]) : null;
  }

  /**
   * After the builder recompiles a running demo: a home whose builder status
   * or price changed since the last sync takes the builder's value, a new
   * home gets a row, and a removed one loses its row. Status and price
   * changed by staff, not in the builder, are left alone.
   */
  async syncListings(tenantId: string, profile: TenantProfile, now: Date): Promise<void> {
    const listings = profile.listings ?? [];
    await this.db.tx(async (q) => {
      const rows = (await q.query<any>('select * from public.voice_listings where tenant_id = $1', [tenantId])).map(mapListing);
      const have = new Map(rows.map((r) => [r.listing_key, r]));
      const keys = listings.map((l) => l.key);
      await q.query('delete from public.voice_listings where tenant_id = $1 and not (listing_key = any($2::text[]))', [tenantId, keys]);
      for (const l of listings) {
        const row = have.get(l.key);
        const builder = { status: l.initial.status, price_pence: l.initial.price_pence };
        if (!row) {
          await q.query(
            `insert into public.voice_listings (tenant_id, listing_key, status, price_pence, qualifier, marketed_at, set_from, history)
             values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
            [tenantId, l.key, builder.status, builder.price_pence, l.initial.qualifier, now, JSON.stringify(builder), historyEntry('builder', 'added in the builder')],
          );
          continue;
        }
        const statusChanged = row.set_from.status !== builder.status;
        const priceChanged = row.set_from.price_pence !== builder.price_pence;
        if (!statusChanged && !priceChanged && row.qualifier === l.initial.qualifier) continue;
        await q.query(
          `update public.voice_listings set status = $3, price_pence = $4, qualifier = $5, set_from = $6::jsonb,
             history = history || $7::jsonb, updated_at = now() where tenant_id = $1 and listing_key = $2`,
          [tenantId, l.key, statusChanged ? builder.status : row.status, priceChanged ? builder.price_pence : row.price_pence, l.initial.qualifier,
            JSON.stringify(builder), historyEntry('builder', 'set in the builder')],
        );
      }
    });
  }

  /** The sellers of a home, to check a caller who says they are one. */
  async sellersOf(tenantId: string, key: string): Promise<{ name: string; phone: string }[]> {
    return (await this.listingState(tenantId, key))?.sellers ?? [];
  }

  /**
   * Records an offer, timestamped, under a reference no booking or offer of
   * this business has. Every offer is recorded, whatever the amount.
   */
  async createOffer(
    tenant: Tenant,
    o: {
      listing_key: string; amount_pence: number; buyer_names: string[]; phone?: string | null; email?: string | null;
      position?: BuyerPosition; conditions?: string | null; solicitor?: string | null; flags?: string[]; revises?: string | null;
      note?: string | null; source: string; call_id?: string | null; received_at?: Date;
    },
  ): Promise<Offer> {
    return this.db.tx(async (q) => {
      await q.query('select id from public.voice_tenants where id = $1 for update', [tenant.id]);
      for (let attempt = 0; attempt < 8; attempt++) {
        const reference = newBookingReference();
        const clash = await q.query(
          `select 1 from public.voice_offers where tenant_id = $1 and reference = $2
           union all select 1 from public.voice_bookings where tenant_id = $1 and reference = $2`,
          [tenant.id, reference],
        );
        if (clash.length) continue;
        const rows = await q.query<any>(
          `insert into public.voice_offers (tenant_id, reference, listing_key, revises, amount_pence, buyer_names, phone, email, position,
             conditions, solicitor, flags, received_at, note, source, call_id, history)
           values ($1,$2,$3,$4,$5,$6::text[],$7,$8,$9::jsonb,$10,$11,$12::text[],$13,$14,$15,$16,$17::jsonb) returning *`,
          [tenant.id, reference, o.listing_key, o.revises ?? null, o.amount_pence, o.buyer_names, o.phone ?? null, o.email ?? null,
            JSON.stringify(o.position ?? {}), o.conditions ?? null, o.solicitor ?? null, o.flags ?? [], o.received_at ?? new Date(), o.note ?? null,
            o.source, o.call_id ?? null, historyEntry(o.source === 'console' ? 'staff' : o.source === 'seed' ? 'seed' : 'receptionist', 'received')],
        );
        return mapOffer(rows[0]);
      }
      throw new Error('could not allocate an offer reference');
    });
  }

  /** Offers, newest first: all of them, or one home's. */
  async listOffers(tenantId: string, listingKey?: string): Promise<Offer[]> {
    const rows = await this.db.query<any>(
      `select * from public.voice_offers where tenant_id = $1 ${listingKey ? 'and listing_key = $2' : ''} order by received_at desc`,
      listingKey ? [tenantId, listingKey] : [tenantId],
    );
    return rows.map(mapOffer);
  }

  /** Offers by their reference, or every offer made from a number, newest first. */
  async findOffer(tenantId: string, by: { reference?: string; phone?: string }): Promise<Offer[]> {
    if (by.reference) {
      const rows = await this.db.query<any>('select * from public.voice_offers where tenant_id = $1 and reference = $2', [
        tenantId, by.reference.replace(/[^a-z0-9]/gi, '').toUpperCase(),
      ]);
      return rows.map(mapOffer);
    }
    if (!by.phone) return [];
    const rows = await this.db.query<any>('select * from public.voice_offers where tenant_id = $1 and phone = $2 order by received_at desc', [tenantId, by.phone]);
    return rows.map(mapOffer);
  }

  /**
   * Moves an offer on: sent to the seller, then accepted, declined,
   * countered or withdrawn. When it was sent and decided are kept, with
   * each step in its history. Returns null for an offer that does not exist.
   */
  async setOfferStatus(tenantId: string, reference: string, status: OfferStatus, opts: { note?: string | null; by?: string; at?: Date } = {}): Promise<Offer | null> {
    const at = opts.at ?? new Date();
    const decided = ['accepted', 'declined', 'countered', 'withdrawn'].includes(status);
    const rows = await this.db.query<any>(
      `update public.voice_offers set status = $3,
         sent_at = case when $3 = 'sent' then $4 else sent_at end,
         decided_at = case when $5 then $4 else decided_at end,
         note = coalesce($6, note), history = history || $7::jsonb
       where tenant_id = $1 and reference = $2 returning *`,
      [tenantId, reference.toUpperCase(), status, at, decided, opts.note ?? null,
        JSON.stringify([{ at: at.toISOString(), by: opts.by ?? 'staff', what: status === 'sent' ? 'sent to the seller' : status }])],
    );
    return rows[0] ? mapOffer(rows[0]) : null;
  }

  /** Opens a sale: from an accepted offer to the keys. */
  async createSale(tenantId: string, sale: Omit<Sale, 'id' | 'created_at' | 'keys_released_at' | 'updates' | 'status'> & Partial<Pick<Sale, 'status' | 'updates' | 'created_at'>>): Promise<Sale> {
    const rows = await this.db.query<any>(
      `insert into public.voice_sales (tenant_id, listing_key, offer_ref, buyer_name, buyer_phone, agreed_pence, milestones, exchange_target,
         completion_date, parties, chain, status, updates, created_at)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11,$12,$13::jsonb,$14) returning ${SALE_COLUMNS}`,
      [tenantId, sale.listing_key, sale.offer_ref, sale.buyer_name, sale.buyer_phone, sale.agreed_pence, JSON.stringify(sale.milestones),
        sale.exchange_target, sale.completion_date, JSON.stringify(sale.parties), sale.chain, sale.status ?? 'progressing',
        JSON.stringify(sale.updates ?? []), sale.created_at ?? new Date()],
    );
    return mapSale(rows[0]);
  }

  async listSales(tenantId: string): Promise<Sale[]> {
    const rows = await this.db.query<any>(`select ${SALE_COLUMNS} from public.voice_sales where tenant_id = $1 order by created_at`, [tenantId]);
    return rows.map(mapSale);
  }

  /** A staff change to a sale (a milestone ticked, dates set, the keys released), with a line in its updates. */
  async updateSale(
    tenantId: string,
    id: string,
    patch: Partial<Pick<Sale, 'milestones' | 'exchange_target' | 'completion_date' | 'parties' | 'chain' | 'status' | 'keys_released_at'>>,
    update?: { by: string; what: string },
  ): Promise<Sale | null> {
    const rows = await this.db.query<any>(
      `update public.voice_sales set milestones = coalesce($3::jsonb, milestones),
         exchange_target = case when $4 then $5::date else exchange_target end,
         completion_date = case when $6 then $7::date else completion_date end,
         parties = coalesce($8::jsonb, parties), chain = case when $9 then $10 else chain end, status = coalesce($11, status),
         keys_released_at = case when $12 then $13::timestamptz else keys_released_at end,
         updates = updates || $14::jsonb
       where tenant_id = $1 and id = $2 returning ${SALE_COLUMNS}`,
      [tenantId, id, patch.milestones ? JSON.stringify(patch.milestones) : null,
        patch.exchange_target !== undefined, patch.exchange_target ?? null, patch.completion_date !== undefined, patch.completion_date ?? null,
        patch.parties ? JSON.stringify(patch.parties) : null, patch.chain !== undefined, patch.chain ?? null, patch.status ?? null,
        patch.keys_released_at !== undefined, patch.keys_released_at ?? null,
        update ? historyEntry(update.by, update.what) : '[]'],
    );
    return rows[0] ? mapSale(rows[0]) : null;
  }

  /**
   * A buyer (or seller) the agency knows, one row per number: what this
   * call learned is merged over what was known. Consent to alerts is only
   * changed when `consent` is given, and its time is kept with it.
   */
  async upsertBuyer(tenantId: string, phone: string, name: string | null, details: BuyerDetails, consent?: boolean): Promise<Buyer> {
    const merged: BuyerDetails = { ...details };
    if (consent !== undefined) merged.consent_at = consent ? new Date().toISOString() : null;
    const rows = await this.db.query<any>(
      `insert into public.voice_customers (tenant_id, phone, name, details, marketing_consent) values ($1, $2, $3, $4::jsonb, coalesce($5, false))
       on conflict (tenant_id, phone) do update set name = coalesce(excluded.name, public.voice_customers.name),
         details = public.voice_customers.details || excluded.details,
         marketing_consent = coalesce($5, public.voice_customers.marketing_consent), updated_at = now()
       returning phone, name, details, marketing_consent`,
      [tenantId, phone, name, JSON.stringify(merged), consent ?? null],
    );
    return mapBuyer(rows[0]);
  }

  /** Everyone the agency knows as a buyer. */
  async listBuyers(tenantId: string): Promise<Buyer[]> {
    const rows = await this.db.query<any>(
      `select phone, name, details, marketing_consent from public.voice_customers
       where tenant_id = $1 and details ? 'roles' and details->'roles' ? 'buyer' order by updated_at desc, name`,
      [tenantId],
    );
    return rows.map(mapBuyer);
  }

  // ── Seeding a workspace ────────────────────────────────────────────────

  /**
   * Writes a planned week in a few statements (see presets/restaurant/seed.ts).
   * A field a plan leaves out gets the literal the restaurant's rows have
   * always had, so its seeded weeks are unchanged.
   */
  async insertSeed(tenantId: string, plan: SeedPlan): Promise<void> {
    await this.db.tx(async (q) => {
      for (let i = 0; i < plan.bookings.length; i += 40) {
        const chunk = plan.bookings.slice(i, i + 40);
        const params: unknown[] = [];
        const rows = chunk.map((b) => {
          const at = new Date(b.starts_at.getTime() - (2 + (b.party_size % 5)) * 86400000).toISOString();
          params.push(tenantId, b.reference, b.service_key ?? 'table', b.resource_key, b.area_key, b.starts_at, b.ends_at, b.buffer_minutes ?? 0,
            b.party_size, b.name, b.phone, b.notes, b.allergies, b.tags, b.deposit_pence, b.deposit_paid, b.visit_status,
            JSON.stringify([{ at, by: b.booked_via, what: 'booked' }]), b.listing_key ?? null, JSON.stringify(b.details ?? {}));
          const n = params.length - 20;
          const p = (k: number) => `$${n + k}`;
          return `(${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)}, ${p(6)}, ${p(7)}, ${p(8)}, ${p(9)}, ${p(10)}, ${p(11)}, ${p(12)}, ${p(13)}, ${p(14)}::text[], 'seed', ${p(15)}, ${p(16)}, ${p(17)}, ${p(18)}::jsonb, ${p(19)}, ${p(20)}::jsonb)`;
        });
        await q.query(
          `insert into public.voice_bookings (tenant_id, reference, service_key, resource_key, area_key, starts_at, ends_at, buffer_minutes, party_size,
             name, phone, notes, allergies, tags, source, deposit_pence, deposit_paid, visit_status, history, listing_key, details) values ${rows.join(', ')}`,
          params,
        );
      }
      for (const o of plan.orders) {
        const fulfilment = o.fulfilment ?? 'collection';
        await q.query(
          `insert into public.voice_orders (tenant_id, reference, name, phone, fulfilment, due_at, ready_at, address, postcode, lines, subtotal_pence,
             delivery_fee_pence, total_pence, allergy_notes, status, payment_status, source, created_at, driver, out_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16, 'seed', $17, $18, $19)`,
          [tenantId, o.reference, o.name, o.phone, fulfilment, o.due_at, o.ready_at ?? (fulfilment === 'collection' ? o.due_at : null),
            o.address ?? null, o.postcode ?? null, JSON.stringify(o.lines), o.subtotal_pence, o.delivery_fee_pence ?? 0, o.total_pence,
            o.allergy_notes, o.status ?? 'confirmed', o.payment_status ?? 'unpaid', o.created_at ?? new Date(o.due_at.getTime() - 50 * 60000),
            o.driver ?? null, o.out_at ?? null],
        );
      }
      for (const m of plan.messages) {
        await q.query(
          `insert into public.voice_messages (tenant_id, kind, from_name, from_phone, body, status, for_staff, category, urgency, reference, details, created_at)
           values ($1, 'message', $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, coalesce($11, now()))`,
          [tenantId, m.from_name, m.from_phone, m.body, m.status ?? 'new', m.for_staff ?? null, m.category ?? null, m.urgency ?? null,
            m.reference ?? null, JSON.stringify(m.details ?? {}), m.created_at ?? null],
        );
      }
      // An estate agency's homes, offers, sales, buyers and texts already sent.
      for (const l of plan.listings ?? []) {
        await q.query(
          `insert into public.voice_listings (tenant_id, listing_key, status, price_pence, qualifier, marketing_continues, best_final_at, checking,
             blocked, sellers, marketed_at, back_on_market_at, set_from, history)
           values ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::jsonb, $10::jsonb, $11, $12, $13::jsonb, $14::jsonb)`,
          [tenantId, l.listing_key, l.status, l.price_pence, l.qualifier, l.marketing_continues, l.best_final_at, l.checking, JSON.stringify(l.blocked),
            JSON.stringify(l.sellers), l.marketed_at, l.back_on_market_at, JSON.stringify(l.set_from), JSON.stringify(l.history)],
        );
      }
      for (const o of plan.offers ?? []) {
        await q.query(
          `insert into public.voice_offers (tenant_id, reference, listing_key, revises, amount_pence, buyer_names, phone, email, position, conditions,
             solicitor, flags, status, received_at, sent_at, decided_at, note, source, history)
           values ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9::jsonb, $10, $11, $12::text[], $13, $14, $15, $16, $17, 'seed', $18::jsonb)`,
          [tenantId, o.reference, o.listing_key, o.revises, o.amount_pence, o.buyer_names, o.phone, o.email, JSON.stringify(o.position), o.conditions,
            o.solicitor, o.flags, o.status, o.received_at, o.sent_at, o.decided_at, o.note, JSON.stringify(o.history)],
        );
      }
      for (const x of plan.sales ?? []) {
        await q.query(
          `insert into public.voice_sales (tenant_id, listing_key, offer_ref, buyer_name, buyer_phone, agreed_pence, milestones, exchange_target,
             completion_date, parties, chain, status, keys_released_at, updates, created_at)
           values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11, $12, $13, $14::jsonb, $15)`,
          [tenantId, x.listing_key, x.offer_ref, x.buyer_name, x.buyer_phone, x.agreed_pence, JSON.stringify(x.milestones), x.exchange_target,
            x.completion_date, JSON.stringify(x.parties), x.chain, x.status, x.keys_released_at, JSON.stringify(x.updates), x.created_at],
        );
      }
      for (const b of plan.people ?? []) {
        await q.query(
          `insert into public.voice_customers (tenant_id, phone, name, details, marketing_consent) values ($1, $2, $3, $4::jsonb, $5)
           on conflict (tenant_id, phone) do update set name = coalesce(excluded.name, public.voice_customers.name),
             details = public.voice_customers.details || excluded.details, marketing_consent = excluded.marketing_consent`,
          [tenantId, b.phone, b.name, JSON.stringify(b.details), b.marketing_consent],
        );
      }
      for (const t of plan.texts ?? []) {
        await q.query(`insert into public.voice_messages (tenant_id, kind, to_number, body, status, created_at) values ($1, 'sms', $2, $3, 'simulated', $4)`, [
          tenantId, t.to, t.body, t.created_at,
        ]);
      }
    });
  }

  // ── Demo reset ─────────────────────────────────────────────────────────

  async resetTenantData(tenantId: string): Promise<void> {
    await this.db.tx(async (q) => {
      for (const t of ['voice_payments', 'voice_orders', 'voice_bookings', 'voice_messages', 'voice_calls', 'voice_customers', 'voice_offers', 'voice_sales', 'voice_listings']) {
        await q.query(`delete from public.${t} where tenant_id = $1`, [tenantId]);
      }
    });
  }

  async ping(): Promise<boolean> {
    const r = await this.db.query<any>('select 1 as ok');
    return r[0]?.ok === 1;
  }
}
