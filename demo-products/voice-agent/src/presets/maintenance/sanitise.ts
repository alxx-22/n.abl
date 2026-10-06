// Rebuilds property maintenance answers from whatever JSON arrived, field by
// field, with bounds and defaults, so a hand-crafted request cannot put
// anything odd into a profile. Answers with no engineers or no trades at all
// (a new or junk config) get the defaults', as a missing week of hours does.

import { arr, bool, int, key, oneOf, sanitiseBasics, sanitiseClosures, sanitiseDays, sanitiseSources, sanitiseTheme, str, time } from '../common/sanitise.ts';
import type { FaqAnswer } from '../common/types.ts';
import { district } from '../estate/listings.ts';
import {
  CLIENT_KINDS, MAX_CLIENTS, MAX_ENGINEERS, MAX_TRADES, MAX_WINDOWS, MT_NATIONS, VERSION, defaultAnswers,
  type ClientAnswer, type EngineerAnswer, type MaintenanceAnswers, type Trade, type VisitWindow,
} from './answers.ts';

const days = (v: unknown): number[] => [...new Set(arr(v).map((d) => int(d, -1, 7, -1)).filter((d) => d >= 0 && d <= 6))].sort((x, y) => x - y);
const pence = (v: unknown, max: number, fallback: number) => int(v, 0, max, fallback);
const strings = (v: unknown, max: number, len: number): string[] => arr(v).map((x) => str(x, len)).filter(Boolean).slice(0, max);
/** Questions as the builder edits them: one still being written is kept, so an autosave never deletes it mid-thought. */
const draftFaqs = (v: unknown): FaqAnswer[] => arr(v).slice(0, 20).filter((f) => f && typeof f === 'object').map((f: any) => ({ q: str(f.q, 150), a: str(f.a, 500) }));

/** Keys made unique in order: "dan", "dan_2". */
function uniqueKeys<T extends { key: string }>(items: T[]): T[] {
  const used = new Set<string>();
  return items.map((x) => {
    let k = x.key;
    for (let n = 2; used.has(k); n++) k = `${x.key.slice(0, 36)}_${n}`;
    used.add(k);
    return { ...x, key: k };
  });
}

export function sanitiseTrades(v: unknown[], d: Trade[]): Trade[] {
  const standard = new Map(d.map((t) => [t.key, t]));
  return uniqueKeys(v.slice(0, MAX_TRADES).filter((t) => t && typeof t === 'object').map((t: any, i) => {
    const label = str(t.label, 50);
    const k = key(t.key ?? label, `trade_${i + 1}`);
    // Only a standard trade is gas work: a prospect cannot mark their own trade as needing no Gas Safe engineer.
    const gas = standard.get(k)?.gas ?? false;
    return { key: k, label: label || standard.get(k)?.label || 'Trade', on: bool(t.on, true), ...(gas ? { gas } : {}) };
  }));
}

export function sanitiseEngineers(v: unknown[], trades: string[], districts: string[]): EngineerAnswer[] {
  return uniqueKeys(v.slice(0, MAX_ENGINEERS).filter((e) => e && typeof e === 'object').map((e: any, i) => {
    const name = str(e.name, 60);
    return {
      key: key(e.key ?? name.split(/\s+/)[0], `engineer_${i + 1}`),
      name,
      trades: arr(e.trades).map((t) => str(t, 40)).filter((t) => trades.includes(t)),
      gas_safe: str(e.gas_safe, 30),
      niceic: bool(e.niceic, false),
      oftec: bool(e.oftec, false),
      days: days(e.days),
      districts: [...new Set(arr(e.districts).map(district).filter((x) => x && districts.includes(x)))],
      per_window: int(e.per_window, 1, 6, 2),
      mobile: str(e.mobile, 20),
    };
  }));
}

export function sanitiseClients(v: unknown[]): ClientAnswer[] {
  return uniqueKeys(v.slice(0, MAX_CLIENTS).filter((c) => c && typeof c === 'object').map((c: any, i) => {
    const name = str(c.name, 80);
    const contact = (c.contact ?? {}) as any;
    return {
      key: key(c.key ?? name, `client_${i + 1}`),
      name,
      kind: oneOf(c.kind, CLIENT_KINDS, 'landlord'),
      works_limit_pence: pence(c.works_limit_pence, 10_000_000, 0),
      emergency_authority_pence: pence(c.emergency_authority_pence, 10_000_000, 0),
      po_required: bool(c.po_required, false),
      contact: { name: str(contact.name, 60), phone: str(contact.phone, 20), email: str(contact.email, 120) },
      notice: oneOf(c.notice, ['every_job', 'over_limit', 'emergencies'] as const, 'over_limit'),
      instructions: str(c.instructions, 300),
      status: oneOf(c.status, ['active', 'on_stop'] as const, 'active'),
      min_priority: c.min_priority === 'urgent' || c.min_priority === 'emergency' ? c.min_priority : null,
      example: bool(c.example, false),
    };
  }));
}

export function sanitiseWindows(v: unknown[], d: VisitWindow[]): VisitWindow[] {
  return uniqueKeys(v.slice(0, MAX_WINDOWS).filter((w) => w && typeof w === 'object').map((w: any, i) => {
    const label = str(w.label, 30);
    return {
      key: key(w.key ?? label, `window_${i + 1}`),
      label: label || d[i]?.label || 'Window',
      from: time(w.from, '08:00'),
      to: time(w.to, '12:00'),
      premium_pence: pence(w.premium_pence, 100_000, 0),
      days: days(w.days),
    };
  }));
}

export function sanitiseMaintenance(input: unknown): MaintenanceAnswers {
  const d = defaultAnswers();
  const x = (input ?? {}) as any;
  const h = x.hours ?? {};
  const a = x.area ?? {};
  const cu = x.customers ?? {};
  const oc = x.on_call ?? {};
  const pr = x.priorities ?? {};
  const ch = x.checks ?? {};
  const vi = x.visits ?? {};
  const p = x.prices ?? {};
  const pl = x.planned ?? {};
  const co = x.compliance ?? {};
  const po = x.policies ?? {};
  const districts = Array.isArray(a.districts) ? ([...new Set(a.districts.map(district).filter(Boolean))].slice(0, 30) as string[]) : d.area.districts;
  const trades = Array.isArray(x.trades) && x.trades.length ? sanitiseTrades(x.trades, d.trades) : d.trades;
  const tradeKeys = trades.map((t) => t.key);
  const engineers = Array.isArray(x.engineers) && x.engineers.length ? sanitiseEngineers(x.engineers, tradeKeys, districts) : d.engineers;
  const engineerKeys = engineers.map((e) => e.key);
  const examples = (v: unknown, fallback: string[]) => (Array.isArray(v) ? strings(v, 8, 80) : fallback);
  return {
    version: VERSION,
    basics: sanitiseBasics(x.basics, d.basics),
    hours: { days: sanitiseDays(h.days, d.hours.days), closures: sanitiseClosures(h.closures) },
    area: {
      nation: oneOf(a.nation, MT_NATIONS, d.area.nation),
      districts,
      towns: Array.isArray(a.towns) ? strings(a.towns, 20, 60) : d.area.towns,
    },
    customers: {
      homeowners: bool(cu.homeowners, d.customers.homeowners),
      landlords: bool(cu.landlords, d.customers.landlords),
      agents: bool(cu.agents, d.customers.agents),
      blocks: bool(cu.blocks, d.customers.blocks),
      social: { on: bool(cu.social?.on, d.customers.social.on), agent_of_landlord: bool(cu.social?.agent_of_landlord, d.customers.social.agent_of_landlord) },
      commercial: bool(cu.commercial, d.customers.commercial),
      insurers: bool(cu.insurers, d.customers.insurers),
      tenant_no_client: oneOf(cu.tenant_no_client, ['contact_landlord', 'private'] as const, d.customers.tenant_no_client),
      recharge_lockouts: bool(cu.recharge_lockouts, d.customers.recharge_lockouts),
    },
    clients: Array.isArray(x.clients) ? sanitiseClients(x.clients) : d.clients,
    trades,
    dont_do: Array.isArray(x.dont_do)
      ? x.dont_do.slice(0, 8).filter((y: any) => y && typeof y === 'object').map((y: any) => ({ what: str(y.what, 60), suggest: str(y.suggest, 160) })).filter((y: { what: string }) => y.what)
      : d.dont_do,
    engineers,
    on_call: {
      nights: Array.isArray(oc.nights)
        ? [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, engineers: arr(oc.nights.find((n: any) => n?.day === day)?.engineers).map((k) => str(k, 40)).filter((k) => engineerKeys.includes(k)).slice(0, 3) }))
        : d.on_call.nights,
      escalate_minutes: int(oc.escalate_minutes, 5, 60, d.on_call.escalate_minutes),
      duty_manager: { name: str(oc.duty_manager?.name, 60, d.on_call.duty_manager.name), mobile: str(oc.duty_manager?.mobile, 20, d.on_call.duty_manager.mobile) },
    },
    priorities: {
      emergency: {
        attend_hours: int(pr.emergency?.attend_hours, 1, 24, d.priorities.emergency.attend_hours),
        make_safe_hours: int(pr.emergency?.make_safe_hours, 1, 72, d.priorities.emergency.make_safe_hours),
        examples: examples(pr.emergency?.examples, d.priorities.emergency.examples),
      },
      urgent: { working_days: int(pr.urgent?.working_days, 1, 10, d.priorities.urgent.working_days), examples: examples(pr.urgent?.examples, d.priorities.urgent.examples) },
      routine: { working_days: int(pr.routine?.working_days, 1, 60, d.priorities.routine.working_days), examples: examples(pr.routine?.examples, d.priorities.routine.examples) },
      vulnerable_uplift: bool(pr.vulnerable_uplift, d.priorities.vulnerable_uplift),
      winter_heating: bool(pr.winter_heating, d.priorities.winter_heating),
    },
    checks: {
      prepayment: bool(ch.prepayment, d.checks.prepayment),
      thermostat: bool(ch.thermostat, d.checks.thermostat),
      trip_reset: bool(ch.trip_reset, d.checks.trip_reset),
      boiler_pressure: bool(ch.boiler_pressure, d.checks.boiler_pressure),
    },
    visits: {
      windows: Array.isArray(vi.windows) ? sanitiseWindows(vi.windows, d.visits.windows) : d.visits.windows,
      notice_hours: int(vi.notice_hours, 0, 72, d.visits.notice_hours),
      horizon_days: int(vi.horizon_days, 1, 60, d.visits.horizon_days),
      adult_present: bool(vi.adult_present, d.visits.adult_present),
      call_ahead: bool(vi.call_ahead, d.visits.call_ahead),
      abortive_fee_pence: pence(vi.abortive_fee_pence, 100_000, d.visits.abortive_fee_pence),
    },
    prices: {
      vat_registered: bool(p.vat_registered, d.prices.vat_registered),
      callout_pence: pence(p.callout_pence, 1_000_000, d.prices.callout_pence),
      half_hour_pence: pence(p.half_hour_pence, 1_000_000, d.prices.half_hour_pence),
      ooh_first_hour_pence: pence(p.ooh_first_hour_pence, 1_000_000, d.prices.ooh_first_hour_pence),
      minimum_pence: pence(p.minimum_pence, 1_000_000, d.prices.minimum_pence),
      lockout_from_pence: pence(p.lockout_from_pence, 1_000_000, d.prices.lockout_from_pence),
      free_quote_over_pence: pence(p.free_quote_over_pence, 10_000_000, d.prices.free_quote_over_pence),
      card_on_booking: bool(p.card_on_booking, d.prices.card_on_booking),
      account_days: int(p.account_days, 0, 90, d.prices.account_days),
      guarantee_months: int(p.guarantee_months, 0, 120, d.prices.guarantee_months),
      cancellation: str(p.cancellation, 300, d.prices.cancellation),
    },
    planned: {
      gas_record_pence: pence(pl.gas_record_pence, 1_000_000, d.planned.gas_record_pence),
      extra_appliance_pence: pence(pl.extra_appliance_pence, 1_000_000, d.planned.extra_appliance_pence),
      boiler_service_pence: pence(pl.boiler_service_pence, 1_000_000, d.planned.boiler_service_pence),
      combined_pence: pence(pl.combined_pence, 1_000_000, d.planned.combined_pence),
      eicr_from_pence: pence(pl.eicr_from_pence, 1_000_000, d.planned.eicr_from_pence),
      reminder_weeks: int(pl.reminder_weeks, 0, 26, d.planned.reminder_weeks),
    },
    compliance: {
      gas_safe_number: str(co.gas_safe_number, 30, d.compliance.gas_safe_number),
      niceic: bool(co.niceic, d.compliance.niceic),
      napit: bool(co.napit, d.compliance.napit),
      oftec: bool(co.oftec, d.compliance.oftec),
      insurance: str(co.insurance, 160, d.compliance.insurance),
      waste_carrier: str(co.waste_carrier, 160, d.compliance.waste_carrier),
      complaints_handler: str(co.complaints_handler, 60, d.compliance.complaints_handler),
      data_lead: str(co.data_lead, 60, d.compliance.data_lead),
      recording: str(co.recording, 300, d.compliance.recording),
    },
    policies: {
      faqs: Array.isArray(po.faqs) ? draftFaqs(po.faqs) : d.policies.faqs,
      guarantee: str(po.guarantee, 300, d.policies.guarantee),
      asbestos: str(po.asbestos, 300, d.policies.asbestos),
      parking: str(po.parking, 300, d.policies.parking),
      payment: str(po.payment, 300, d.policies.payment),
      careers: str(po.careers, 300, d.policies.careers),
    },
    theme: sanitiseTheme(x.theme, d.theme),
    sources: sanitiseSources(x.sources),
  };
}
