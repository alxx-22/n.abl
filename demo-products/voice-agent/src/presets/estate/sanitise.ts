// Rebuilds estate agent answers from whatever JSON arrived, field by field,
// with bounds and defaults, so a hand-crafted request cannot put anything
// odd into a profile. Answers that arrive with no team or no homes at all
// (a new or junk config) get the defaults', as a missing week of hours does.

import { arr, bool, int, key, oneOf, sanitiseBasics, sanitiseClosures, sanitiseDays, sanitiseFaqs, sanitiseSources, sanitiseTheme, str } from '../common/sanitise.ts';
import { MAX_TEAM, NATIONS, STAFF_DUTIES, STAFF_ROLES, VERSION, defaultAnswers, type EstateAnswers, type StaffAnswer } from './answers.ts';
import { district, sanitiseListings, staffRef } from './listings.ts';

const days = (v: unknown): number[] => [...new Set(arr(v).map((d) => int(d, -1, 7, -1)).filter((d) => d >= 0 && d <= 6))].sort();

export function sanitiseTeam(v: unknown[]): StaffAnswer[] {
  const used = new Set<string>();
  return v.slice(0, MAX_TEAM).map((x: any, i) => {
    const name = str(x?.name, 60);
    const base = key(x?.key ?? name.split(/\s+/)[0], `person_${i + 1}`);
    let k = base;
    for (let n = 2; used.has(k); n++) k = `${base.slice(0, 36)}_${n}`;
    used.add(k);
    return {
      key: k,
      name,
      role: oneOf(x?.role, STAFF_ROLES, 'other'),
      does: STAFF_DUTIES.filter((d) => arr(x?.does).includes(d)),
      days: days(x?.days),
      mobile: str(x?.mobile, 20),
    };
  });
}

export function sanitiseEstate(input: unknown): EstateAnswers {
  const d = defaultAnswers();
  const x = (input ?? {}) as any;
  const h = x.hours ?? {};
  const p = x.patch ?? {};
  const di = x.diary ?? {};
  const v = x.viewings ?? {};
  const o = x.offers ?? {};
  const va = x.valuations ?? {};
  const f = x.fees ?? {};
  const pa = x.partners ?? {};
  const c = x.compliance ?? {};
  const po = x.policies ?? {};
  return {
    version: VERSION,
    basics: sanitiseBasics(x.basics, d.basics),
    hours: { days: sanitiseDays(h.days, d.hours.days), closures: sanitiseClosures(h.closures) },
    patch: {
      nation: oneOf(p.nation, NATIONS, d.patch.nation),
      districts: Array.isArray(p.districts) ? [...new Set(p.districts.map(district).filter(Boolean))].slice(0, 30) as string[] : d.patch.districts,
      towns: Array.isArray(p.towns) ? [...new Set(p.towns.map((t: unknown) => str(t, 60)).filter(Boolean))].slice(0, 20) as string[] : d.patch.towns,
      lettings: oneOf(p.lettings, ['none', 'message'] as const, d.patch.lettings),
      lettings_contact: staffRef(p.lettings_contact),
    },
    diary: {
      viewing_days: sanitiseDays(di.viewing_days, d.diary.viewing_days),
      valuation_days: sanitiseDays(di.valuation_days, d.diary.valuation_days),
      out_of_hours_booking: bool(di.out_of_hours_booking, d.diary.out_of_hours_booking),
      on_call: di.on_call === null ? null : staffRef(di.on_call ?? d.diary.on_call) || null,
    },
    team: Array.isArray(x.team) ? sanitiseTeam(x.team) : d.team,
    listings: Array.isArray(x.listings) ? sanitiseListings(x.listings) : d.listings,
    viewings: {
      minutes: int(v.minutes, 15, 90, d.viewings.minutes),
      second_minutes: int(v.second_minutes, 15, 120, d.viewings.second_minutes),
      travel_minutes: int(v.travel_minutes, 0, 60, d.viewings.travel_minutes),
      notice_hours: int(v.notice_hours, 0, 72, d.viewings.notice_hours),
      horizon_days: int(v.horizon_days, 1, 60, d.viewings.horizon_days),
      safety: {
        take_postcode: bool(v.safety?.take_postcode, d.viewings.safety.take_postcode),
        empty_office_hours_only: bool(v.safety?.empty_office_hours_only, d.viewings.safety.empty_office_hours_only),
      },
    },
    offers: {
      take: oneOf(o.take, ['record', 'message'] as const, d.offers.take),
      buyer_fee_pence: int(o.buyer_fee_pence, 0, 100_000, d.offers.buyer_fee_pence),
      buyer_fee_when: str(o.buyer_fee_when, 100, d.offers.buyer_fee_when),
      id_provider: str(o.id_provider, 80, d.offers.id_provider),
      best_final: str(o.best_final, 300, d.offers.best_final),
    },
    valuations: {
      name: str(va.name, 60, d.valuations.name) || d.valuations.name,
      minutes: int(va.minutes, 15, 180, d.valuations.minutes),
      rics: {
        offered: bool(va.rics?.offered, d.valuations.rics.offered),
        fee_pence: int(va.rics?.fee_pence, 0, 1_000_000, d.valuations.rics.fee_pence),
        staff: staffRef(va.rics?.staff),
      },
    },
    fees: {
      quote: bool(f.quote, d.fees.quote),
      kind: oneOf(f.kind, ['percent', 'fixed'] as const, d.fees.kind),
      percent_hundredths: int(f.percent_hundredths, 0, 1000, d.fees.percent_hundredths),
      fixed_pence: int(f.fixed_pence, 0, 10_000_000, d.fees.fixed_pence),
      min_weeks: int(f.min_weeks, 0, 52, d.fees.min_weeks),
      contract: oneOf(f.contract, ['sole_agency', 'multi_agency'] as const, d.fees.contract),
      includes: str(f.includes, 300, d.fees.includes),
      extras: str(f.extras, 300, d.fees.extras),
      marketing: Array.isArray(f.marketing) ? f.marketing.map((m: unknown) => str(m, 60)).filter(Boolean).slice(0, 12) : d.fees.marketing,
    },
    partners: {
      mortgage: {
        on: bool(pa.mortgage?.on, d.partners.mortgage.on),
        staff: pa.mortgage?.staff === undefined ? d.partners.mortgage.staff : staffRef(pa.mortgage.staff),
        firm: str(pa.mortgage?.firm, 80, d.partners.mortgage.firm),
        statement: str(pa.mortgage?.statement, 400, d.partners.mortgage.statement),
      },
      conveyancing: {
        on: bool(pa.conveyancing?.on, d.partners.conveyancing.on),
        statement: str(pa.conveyancing?.statement, 400, d.partners.conveyancing.statement),
      },
    },
    compliance: {
      redress: oneOf(c.redress, ['tpo', 'prs'] as const, d.compliance.redress),
      complaints_handler: c.complaints_handler === undefined ? d.compliance.complaints_handler : staffRef(c.complaints_handler),
      data_lead: c.data_lead === undefined ? d.compliance.data_lead : staffRef(c.data_lead),
      recording: str(c.recording, 300, d.compliance.recording),
    },
    area: { faqs: x.area && Array.isArray(x.area.faqs) ? sanitiseFaqs(x.area.faqs) : d.area.faqs },
    policies: {
      faqs: sanitiseFaqs(po.faqs),
      parking: str(po.parking, 300, d.policies.parking),
      at_viewings: str(po.at_viewings, 300, d.policies.at_viewings),
    },
    theme: sanitiseTheme(x.theme, d.theme),
    sources: sanitiseSources(x.sources),
  };
}
