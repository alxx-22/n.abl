// What a board or back office shows for one business: the diary, orders,
// messages, calls, and for workspaces the floor plan.

import type { Repo } from '../db/repo.ts';
import type { Bus } from './bus.ts';
import type { Booking, Listing, Tenant, TenantProfile } from '../domain/types.ts';
import { pounds } from '../domain/types.ts';
import { matches, requirementsWords, shortAddress } from '../domain/listings.ts';
import { addDays, spokenDate, spokenTime, toLocal, zonedToUtc } from '../domain/time.ts';
import { displayUkPhone, normaliseUkPhone } from '../domain/phone.ts';
import { capabilities } from '../core/prompt.ts';
import type { WorkspaceSpec } from '../presets/index.ts';

/**
 * The team console's board for our own demo businesses, which have no
 * preset: its panels in its own words (web/src/pages/Board.tsx), from what
 * the business can do. A diary when it takes bookings, orders when it takes
 * them, and the board's Reset refills the diary only.
 */
export function boardWorkspace(profile: TenantProfile): WorkspaceSpec {
  const caps = capabilities(profile);
  const tables = Boolean(profile.booking?.services.some((s) => s.kind === 'table'));
  return {
    views: [
      ...(caps.booking ? [{ id: 'timeline', label: 'Diary' }] as const : []),
      ...(caps.ordering ? [{ id: 'orders', label: 'Orders' }] as const : []),
      { id: 'messages', label: 'Messages and texts' },
      { id: 'calls', label: 'Recent calls' },
    ],
    bookings: caps.booking
      ? {
          resource: tables ? 'table' : 'staff member',
          resources: tables ? 'tables' : 'staff',
          party: tables ? 'Party' : null,
          visit: tables
            ? { expected: 'Expected', arrived: 'Arrived', seated: 'Seated', finished: 'Finished', no_show: 'No-show' }
            : { expected: 'Expected', arrived: 'Arrived', finished: 'Finished', no_show: 'No-show' },
          allergies: tables,
        }
      : undefined,
    orders: caps.ordering ? { board: 'Orders', done: { collection: 'Collected', delivery: 'Delivered' }, drivers: false, advance: false } : undefined,
    suggestions: [],
    resetLine: 'bookings',
  };
}

/** `workspace`: a prospect's workspace passes its preset's; our own businesses get the board's. */
export async function tenantState(repo: Repo, t: Tenant, bus: Bus, workspace: WorkspaceSpec = boardWorkspace(t.profile)) {
  const tz = t.profile.timezone;
  const now = new Date();
  const today = toLocal(now, tz).date;
  const from = zonedToUtc(addDays(today, -1), '00:00', tz);
  const to = zonedToUtc(addDays(today, 14), '00:00', tz);
  const bookings = await repo.listBookings(t.id, from, to, true);
  const orders = await repo.listOrders(t.id, new Date(now.getTime() - 36 * 3600000));
  const resources = new Map((t.profile.booking?.resources ?? []).map((r) => [r.key, r]));
  const services = new Map((t.profile.booking?.services ?? []).map((s) => [s.key, s.label]));
  const areas = new Map((t.profile.booking?.areas ?? []).map((a) => [a.key, a.label]));
  const homes = new Map((t.profile.listings ?? []).map((l) => [l.key, shortAddress(l)]));
  return {
    tenant: {
      id: t.id, slug: t.slug, name: t.profile.name, business_type: t.profile.business_type, status: t.profile.status,
      phone_display: t.profile.phone_display, demo_pin: t.profile.demo_pin, accent: t.profile.brand?.accent, brand: t.profile.brand ?? {},
      summary: t.profile.summary, greeting: t.profile.greeting, voice: t.profile.voice, timezone: tz,
      has_booking: Boolean(t.profile.booking?.services.length), has_ordering: Boolean(t.profile.ordering),
    },
    today,
    now: now.toISOString(),
    active_calls: bus.activeFor(t.id),
    plan: t.profile.booking
      ? {
          areas: t.profile.booking.areas ?? [],
          tables: t.profile.booking.resources.filter((r) => r.layout).map((r) => ({
            key: r.key, label: r.label, area: r.area ?? null, seats: r.layout!.seats, shape: r.layout!.shape, x: r.layout!.x, y: r.layout!.y,
            rotation: r.layout!.rotation ?? 0, accessible: Boolean(r.accessible), features: r.features ?? [], bookable: r.services.length > 0,
          })),
          pairs: t.profile.booking.resources.filter((r) => r.combines).map((r) => ({ key: r.key, label: r.label, combines: r.combines!, capacity: r.capacity ?? 0, bookable: r.services.length > 0 })),
          fixtures: t.profile.booking.fixtures ?? [],
        }
      : null,
    opening_hours: t.profile.opening_hours,
    workspace,
    bookings: bookings.map((b) => {
      const l = toLocal(b.starts_at, tz);
      const e = toLocal(b.ends_at, tz);
      const r = resources.get(b.resource_key);
      return {
        id: b.id, reference: b.reference, date: l.date, day: spokenDate(l.date), time: l.time, end_time: e.time, spoken_time: spokenTime(l.time),
        starts_at: b.starts_at.toISOString(), ends_at: b.ends_at.toISOString(),
        party_size: b.party_size, name: b.name, phone: displayUkPhone(b.phone), notes: b.notes, allergies: b.allergies ?? null, tags: b.tags ?? [],
        status: b.status, visit_status: b.visit_status ?? 'expected', source: b.source, history: b.history ?? [],
        resource_key: b.resource_key, tables: r?.combines ?? [b.resource_key],
        with: r?.label ?? b.resource_key, area: b.area_key ? areas.get(b.area_key) ?? b.area_key : null,
        service: services.get(b.service_key) ?? b.service_key,
        deposit: b.deposit_pence ? pounds(b.deposit_pence) : null, deposit_paid: b.deposit_paid,
        // A viewing's home, and what a viewing or valuation knows: an estate agency's only.
        ...(b.listing_key ? { listing_key: b.listing_key, home: homes.get(b.listing_key) ?? b.listing_key } : {}),
        ...(b.details && Object.keys(b.details).length ? { details: b.details } : {}),
      };
    }),
    orders: orders.map((o) => ({
      reference: o.reference, name: o.name, phone: displayUkPhone(o.phone), fulfilment: o.fulfilment,
      due: spokenTime(toLocal(o.due_at, tz).time), due_time: toLocal(o.due_at, tz).time, due_at: o.due_at.toISOString(),
      address: o.address ? `${o.address}, ${o.postcode}` : null, lines: o.lines, total: pounds(o.total_pence),
      allergy_notes: o.allergy_notes, status: o.status, payment_status: o.payment_status, created_at: o.created_at,
    })),
    messages: (await repo.listMessages(t.id, 60)).map((m) => ({ ...m, to_number: displayUkPhone(m.to_number), from_phone: displayUkPhone(m.from_phone) })),
    calls: (await repo.listCalls(t.id, 12)).map((c) => ({
      id: c.id, channel: c.channel, started_at: c.started_at, ended_at: c.ended_at, outcome: c.outcome, summary: c.summary,
      model: c.model, guardrail_flags: c.guardrail_flags, latency: c.latency, usage: c.usage,
    })),
    ...(t.profile.listings ? await estateState(repo, t, bookings, now) : {}),
  };
}

const DAY = 86400000;

/** Price, tenure, the council tax band and the EPC: what every advert must state, at today's price. */
const partAMissing = (l: Listing, price: number) =>
  [price ? null : 'price', l.tenure !== 'unknown' ? null : 'tenure', l.local_tax ? null : 'council tax band', l.epc ? null : 'EPC'].filter((x): x is string => x !== null);

/**
 * An estate agency's homes (the owner's facts joined with the live row),
 * offers and team, for its Diary, Properties and Offers (presets/estate-agent.md §6).
 */
async function estateState(repo: Repo, t: Tenant, bookings: Booking[], now: Date) {
  const team = t.profile.team ?? [];
  const names = new Map(team.map((s) => [s.key, s.name]));
  const live = new Map((await repo.listingStates(t.id)).map((r) => [r.listing_key, r]));
  const offers = await repo.listOffers(t.id);
  const buyers = await repo.listBuyers(t.id);
  const sales = await repo.listSales(t.id);
  // Unread seller replies by home: an open offer on it shows "Seller replied by phone" until someone reads the message.
  const replies = (await repo.listMessages(t.id, 200)).filter((m: any) => m.kind === 'message' && m.status === 'new' && m.details?.seller_reply);
  // The Valuations view reaches back further than the diary: last week's appraisals are still being won or lost.
  const valuations = (await repo.listBookings(t.id, new Date(now.getTime() - 30 * DAY), new Date(now.getTime() + 30 * DAY))).filter((b) => b.service_key === 'valuation');
  const tz = t.profile.timezone;
  const homes = new Map((t.profile.listings ?? []).map((l) => [l.key, shortAddress(l)]));
  const findable = (t.profile.listings ?? []).map((l) => ({ listing: l, price_pence: live.get(l.key)?.price_pence ?? l.initial.price_pence, status: live.get(l.key)?.status ?? l.initial.status }));
  const weekOn = new Date(now.getTime() + 7 * DAY);
  return {
    // For the offer timers, which skip the nation's bank holidays.
    nation: t.profile.estate?.nation ?? 'england',
    team: team.map((s) => ({ key: s.key, name: s.name, first_name: s.first_name, role: s.role, does: s.does, days: s.days, mobile: s.mobile })),
    listings: (t.profile.listings ?? []).map((l) => {
      const r = live.get(l.key);
      const price = r?.price_pence ?? l.initial.price_pence;
      return {
        key: l.key, ref: l.ref, address: shortAddress(l), town: l.town, district: l.district, type: l.type, home: l.home, example: Boolean(l.example),
        status: r?.status ?? l.initial.status, price_pence: price, qualifier: r?.qualifier ?? l.initial.qualifier,
        days_on_market: r ? Math.max(0, Math.floor((now.getTime() - r.marketed_at.getTime()) / DAY)) : l.marketed_days_ago,
        back_on_market_at: r?.back_on_market_at?.toISOString() ?? null,
        negotiator: names.get(l.negotiator) ?? null,
        viewings_week: bookings.filter((b) => b.listing_key === l.key && b.status === 'confirmed' && b.starts_at >= now && b.starts_at < weekOn).length,
        offers: offers.filter((o) => o.listing_key === l.key && (o.status === 'received' || o.status === 'sent')).length,
        part_a_missing: partAMissing(l, price),
        unknown: l.unknown.length,
        personal_interest: Boolean(l.personal_interest),
        marketing_continues: r?.marketing_continues ?? true,
        best_final_at: r?.best_final_at?.toISOString() ?? null,
        checking: r?.checking ?? [],
        blocked: r?.blocked ?? [],
        history: (r?.history ?? []).slice(-6),
      };
    }),
    offers: offers.map((o) => ({
      reference: o.reference, listing_key: o.listing_key, home: homes.get(o.listing_key) ?? o.listing_key, revises: o.revises,
      amount_pence: o.amount_pence, buyer_names: o.buyer_names, phone: displayUkPhone(o.phone), position: o.position, conditions: o.conditions,
      flags: o.flags, status: o.status, received_at: o.received_at.toISOString(), sent_at: o.sent_at?.toISOString() ?? null,
      decided_at: o.decided_at?.toISOString() ?? null, note: o.note, source: o.source,
      seller_replied: ['received', 'sent'].includes(o.status) && replies.some((m: any) => m.details.listing === o.listing_key),
    })),
    valuations: valuations.map((b) => {
      const l = toLocal(b.starts_at, tz);
      return {
        reference: b.reference, date: l.date, day: spokenDate(l.date), time: l.time, starts_at: b.starts_at.toISOString(), ends_at: b.ends_at.toISOString(),
        valuer: names.get(b.resource_key) ?? b.resource_key, name: b.name, phone: displayUkPhone(b.phone), visit_status: b.visit_status ?? 'expected',
        details: b.details ?? {},
      };
    }),
    // The Sales progress view: every sale, newest first, with its parties and log.
    sales: sales.map((x) => ({
      id: x.id, listing_key: x.listing_key, home: homes.get(x.listing_key) ?? x.listing_key, buyer_name: x.buyer_name, buyer_phone: displayUkPhone(x.buyer_phone),
      agreed_pence: x.agreed_pence, milestones: x.milestones, exchange_target: x.exchange_target, completion_date: x.completion_date,
      parties: x.parties.map((p) => ({ ...p, phone: p.phone ? displayUkPhone(normaliseUkPhone(p.phone)) : null })), chain: x.chain, status: x.status,
      keys_released_at: x.keys_released_at?.toISOString() ?? null, updates: x.updates.slice(-8), created_at: x.created_at.toISOString(),
    })).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    // The Applicants view: everyone registered as a buyer, newest contact first, and how many homes fit them now.
    buyers: buyers.map((b) => {
      const r = b.details.requirements;
      return {
        name: b.name, phone: displayUkPhone(b.phone), position: b.details.position ?? null,
        wants: r ? requirementsWords(r) : null, timescale: r?.timescale ?? null,
        matches: r ? matches(r, findable).length : 0,
        alerts: b.marketing_consent, consent_at: b.details.consent_at ?? null,
        backup_for: (b.details.backup_for ?? []).map((k) => homes.get(k) ?? k), investor: Boolean(b.details.investor), hot: Boolean(b.details.hot),
        last_contact: b.details.last_contact ?? null, source: b.details.source ?? null,
      };
    }),
  };
}
