// The seating section as a whole: cleaned, checked, and compiled into the
// profile's table bookings, with the sentences a caller hears about it. Each
// function takes the seating answers and what it needs from elsewhere
// (whether bookings are on, the booking windows, the deposit, the builder
// steps), never a path.

import type { BookableService, TenantProfile, Window } from '../../domain/types.ts';
import { pounds } from '../../domain/types.ts';
import { int, oneOf } from '../common/sanitise.ts';
import type { Issue } from '../common/types.ts';
import { compileAreas, sanitiseAreas, weatherSentence } from './areas.ts';
import { sanitiseFixtures } from './fixtures.ts';
import { intoRooms } from './layout.ts';
import { compileTables, sanitiseTables, tableBookable } from './tables.ts';
import type { DepositAnswer, SeatingAnswer } from './types.ts';

/** Whether the business takes bookings and walk-ins at all. */
export interface SeatingServe {
  reservations: boolean;
  walk_ins: boolean;
}

export function sanitiseSeating(v: unknown, d: SeatingAnswer): SeatingAnswer {
  const st = (v ?? {}) as any;
  const areas = sanitiseAreas(st.areas, d.areas);
  const areaKeys = new Set(areas.map((a) => a.key));
  return {
    areas,
    // A plan from before areas had their own rooms moves into them, once.
    tables: st.tables !== undefined && st.plan !== 2 ? intoRooms(areas, sanitiseTables(st.tables, areaKeys, d.tables)) : sanitiseTables(st.tables, areaKeys, d.tables),
    fixtures: sanitiseFixtures(st.fixtures, areaKeys, st.tables !== undefined && st.fixtures === undefined ? [] : d.fixtures),
    plan: 2,
    sittings: {
      up_to_2: int(st.sittings?.up_to_2, 30, 300, d.sittings.up_to_2),
      up_to_4: int(st.sittings?.up_to_4, 30, 300, d.sittings.up_to_4),
      up_to_8: int(st.sittings?.up_to_8, 30, 360, d.sittings.up_to_8),
      larger: int(st.sittings?.larger, 30, 480, d.sittings.larger),
    },
    max_party: int(st.max_party, 1, 60, d.max_party),
    notice_minutes: int(st.notice_minutes, 0, 1440, d.notice_minutes),
    horizon_days: int(st.horizon_days, 1, 365, d.horizon_days),
    highchairs: int(st.highchairs, 0, 30, d.highchairs),
    buffer_minutes: int(st.buffer_minutes, 0, 60, d.buffer_minutes),
  };
}

export function sanitiseDeposit(v: unknown, d: DepositAnswer): DepositAnswer {
  const x = (v ?? {}) as any;
  return {
    // "Card details to secure" was offered but no card was ever taken, though the policy said one would be: a saved one reads as none.
    mode: x.mode === 'card_hold' ? 'none' : oneOf(x.mode, ['none', 'per_person', 'per_booking'] as const, d.mode),
    amount_pence: int(x.amount_pence, 0, 50000, d.amount_pence),
    min_party: int(x.min_party, 1, 60, d.min_party),
  };
}

/** Bookings are on and at least one table can be booked. */
export const takesBookings = (s: SeatingAnswer, serve: SeatingServe) => serve.reservations && s.tables.some((t) => tableBookable(s, t));

export function tableService(s: SeatingAnswer, windows: Window[], d: DepositAnswer): BookableService {
  return {
    key: 'table',
    label: 'table',
    kind: 'table',
    slot_minutes: 15,
    duration_rules: [
      { max_party: 2, minutes: s.sittings.up_to_2 },
      { max_party: 4, minutes: s.sittings.up_to_4 },
      { max_party: 8, minutes: s.sittings.up_to_8 },
      { max_party: 100, minutes: s.sittings.larger },
    ],
    windows,
    max_party: s.max_party,
    large_party_note: `For more than ${s.max_party} people, take their name, number, preferred date and time, and say the manager will call back.`,
    lead_minutes: s.notice_minutes,
    horizon_days: s.horizon_days,
    buffer_minutes: s.buffer_minutes || undefined,
    deposit:
      d.mode === 'per_person' ? { min_party: d.min_party, per_person_pence: d.amount_pence }
      : d.mode === 'per_booking' ? { min_party: d.min_party, flat_pence: d.amount_pence }
      : undefined,
  };
}

/** The profile's table bookings: one 'table' service, the tables and pairs, the areas and the room shapes. */
export function compileBooking(s: SeatingAnswer, opts: { reservations: boolean; windows: Window[]; deposit: DepositAnswer }): NonNullable<TenantProfile['booking']> {
  return {
    services: [tableService(s, opts.windows, opts.deposit)],
    resources: compileTables(s, opts.reservations),
    areas: compileAreas(s.areas),
    highchairs: s.highchairs,
    fixtures: s.fixtures.length ? s.fixtures : undefined,
  };
}

export function depositSentence(d: DepositAnswer): string | null {
  if (d.mode === 'per_person') return `Tables of ${d.min_party} or more pay a ${pounds(d.amount_pence)} a head deposit when booking, taken off the bill on the night.`;
  if (d.mode === 'per_booking') return `Bookings for ${d.min_party} or more pay a ${pounds(d.amount_pence)} deposit when booking, taken off the bill on the night.`;
  return null;
}

/** One core fact: the areas and their tables, the weather outside, and walk-ins. */
export function seatingSentence(s: SeatingAnswer, serve: SeatingServe): string | null {
  if (!serve.reservations) return serve.walk_ins ? 'We don’t take bookings; it’s walk-in only.' : null;
  const counts = s.areas
    .map((x) => ({ x, n: s.tables.filter((t) => t.area === x.key).length }))
    .filter((c) => c.n > 0)
    .map(({ x, n }) => `${x.label.toLowerCase()} (${n} tables${x.enquiry_only ? ', private hire by enquiry' : !x.reservable || x.weather_rule === 'walk_in_only' ? ', walk-in only' : ''})`);
  const outdoor = s.areas.find((x) => x.kind === 'outdoor' && x.weather_rule);
  const kept = s.tables.some((t) => t.walk_in);
  const walk = serve.walk_ins ? (kept ? ' We keep some tables back for walk-ins.' : ' Walk-ins are welcome when a table is free.') : '';
  return `Seating: ${counts.join(' and ')}.${outdoor ? ` ${weatherSentence(outdoor)}` : ''}${walk}`;
}

/** The answer to "Do you take walk-ins?". */
export function walkInsAnswer(s: SeatingAnswer, walkIns: boolean): string {
  if (!walkIns) return 'We’re bookings only, I’m afraid.';
  return s.tables.some((t) => t.walk_in) ? 'Yes, we keep some tables for walk-ins, though booking is safest at busy times.' : 'Yes, if there’s a table free, though booking is safest at busy times.';
}

/** For a business that takes bookings: something to book, and a table or pair for most parties. */
export function validateSeating<S extends string, F extends string>(s: SeatingAnswer, steps: { seating: S; floor: F }): Issue<S | F>[] {
  const out: Issue<S | F>[] = [];
  const err = (message: string) => out.push({ step: steps.seating, level: 'error', message });
  if (!s.areas.length) err('Add at least one seating area.');
  if (!s.tables.some((t) => tableBookable(s, t))) err('Nothing is bookable: add tables to an area that takes bookings.');
  if (s.max_party < 2) err('Allow bookings for at least two people.');
  const biggest = Math.max(0, ...s.tables.filter((t) => tableBookable(s, t)).map((t) => t.seats));
  const pair = Math.max(0, ...s.tables.flatMap((t) => t.joins.map((j) => t.seats + (s.tables.find((u) => u.key === j)?.seats ?? 0))));
  const top = Math.max(biggest, pair);
  // With no table at all, "Nothing is bookable" says it already.
  if (top > 0 && top < s.max_party) {
    // Parties between the biggest table and the limit get the manager's callback too (the engine gives it), so say which.
    const between = top + 1 === s.max_party ? `${s.max_party}` : top + 2 === s.max_party ? `${top + 1} or ${s.max_party}` : `${top + 1} to ${s.max_party}`;
    out.push({ step: steps.seating, level: 'warning', message: `No table or pair of tables seats ${s.max_party}: parties of ${between} will be offered a callback, as bigger ones are.` });
  }
  for (const t of s.tables) {
    const clash = s.tables.find((u) => u !== t && u.area === t.area && Math.abs(u.x - t.x) < 30 && Math.abs(u.y - t.y) < 30);
    if (clash && t.key < clash.key) out.push({ step: steps.floor, level: 'warning', message: `${t.label} and ${clash.label} overlap on the floor plan.` });
  }
  return out;
}

export function validateDeposit<K extends string>(d: DepositAnswer, step: K): Issue<K>[] {
  return d.mode !== 'none' && d.amount_pence <= 0 ? [{ step, level: 'error', message: 'Set the deposit amount.' }] : [];
}
