// What a board or back office shows for one business: the diary, orders,
// messages, calls, and for workspaces the floor plan.

import type { Repo } from '../db/repo.ts';
import type { Bus } from './bus.ts';
import type { Tenant, TenantProfile } from '../domain/types.ts';
import { pounds } from '../domain/types.ts';
import { addDays, spokenDate, spokenTime, toLocal, zonedToUtc } from '../domain/time.ts';
import { displayUkPhone } from '../domain/phone.ts';
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
  };
}
