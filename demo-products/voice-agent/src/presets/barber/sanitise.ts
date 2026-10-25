// Rebuild barber answers from whatever JSON arrived, field by field, with
// bounds and defaults, so a hand-crafted request cannot put anything odd
// into a profile. The services are cleaned first, so each barber keeps only
// services that exist; a list saved, even an empty one, is the owner's.

import { arr, bool, closeTime, int, key, oneOf, sanitiseBasics, sanitiseClosures, sanitiseDays, sanitiseDraftFaqs, sanitiseSources, sanitiseTheme, str, time } from '../common/sanitise.ts';
import { PAYMENT, SKIN_TEST, VERSION, defaultAnswers, type BarberAnswer, type BarberAnswers, type ServiceAnswer } from './answers.ts';

/** A weekday, 0 (Sunday) to 6: anything else is dropped, never moved to another day. */
const isDay = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 6;

/** Keys made unique in order: a second "Classic cut" becomes classic_cut_2. */
function unique<T extends { key: string }>(xs: T[]): T[] {
  const seen = new Set<string>();
  return xs.map((x) => {
    let k = x.key;
    for (let n = 2; seen.has(k); n++) k = `${x.key}_${n}`;
    seen.add(k);
    return { ...x, key: k };
  });
}

function sanitiseServices(v: unknown, d: ServiceAnswer[]): ServiceAnswer[] {
  if (!Array.isArray(v)) return d.map((s) => ({ ...s }));
  return unique(arr(v).slice(0, 30).map((x: any, i) => {
    const name = str(x?.name, 60, '');
    return {
      key: key(x?.key ?? name, `service_${i + 1}`),
      name,
      minutes: int(x?.minutes, 5, 240, 30),
      price_pence: int(x?.price_pence, 0, 50000, 0),
      from: bool(x?.from, false),
      description: str(x?.description, 200, ''),
      colour: bool(x?.colour, false),
    };
  }));
}

function sanitiseTeam(v: unknown, d: BarberAnswer[], services: Set<string>): BarberAnswer[] {
  const list = Array.isArray(v) ? arr(v).slice(0, 12) : d;
  return unique(list.map((x: any, i) => {
    const name = str(x?.name, 30, '');
    const days = [...new Set(arr(x?.days).filter(isDay))].sort();
    return {
      key: key(x?.key ?? name, `barber_${i + 1}`),
      name,
      aliases: [...new Set(arr(x?.aliases).map((a) => str(a, 30, '')).filter(Boolean))].slice(0, 4),
      days,
      hours: arr(x?.hours)
        .map((h: any) => ({ day: isDay(h?.day) ? h.day : -1, open: time(h?.open, ''), close: closeTime(h?.close, '') }))
        .filter((h) => h.day >= 0 && h.open && h.close && days.includes(h.day))
        .slice(0, 7),
      services: [...new Set(arr(x?.services).map((s) => str(s, 40, '')).filter((s) => services.has(s)))],
      notes: str(x?.notes, 160, ''),
    };
  }));
}

export function sanitiseBarber(input: unknown): BarberAnswers {
  const d = defaultAnswers();
  const x = (input ?? {}) as any;
  const h = x.hours ?? {};
  const b = x.booking ?? {};
  const m = x.money ?? {};
  const p = x.policies ?? {};
  const services = sanitiseServices(x.services, d.services);
  return {
    version: VERSION,
    basics: sanitiseBasics(x.basics, d.basics),
    hours: { days: sanitiseDays(h.days, d.hours.days), closures: sanitiseClosures(h.closures) },
    team: sanitiseTeam(x.team, d.team, new Set(services.map((s) => s.key))),
    services,
    booking: {
      slot_minutes: [10, 15, 20, 30].includes(Number(b.slot_minutes)) ? Number(b.slot_minutes) : d.booking.slot_minutes,
      lead_minutes: int(b.lead_minutes, 0, 24 * 60, d.booking.lead_minutes),
      horizon_days: int(b.horizon_days, 1, 90, d.booking.horizon_days),
      walk_ins: bool(b.walk_ins, d.booking.walk_ins),
      group_max: int(b.group_max, 1, 12, d.booking.group_max),
      late_grace_minutes: int(b.late_grace_minutes, 0, 30, d.booking.late_grace_minutes),
      kids_under: b.kids_under === null ? null : int(b.kids_under, 2, 16, d.booking.kids_under ?? 12),
      under_16_with_adult: bool(b.under_16_with_adult, d.booking.under_16_with_adult),
    },
    money: {
      deposit_pence: m.deposit_pence === null ? null : int(m.deposit_pence, 0, 5000, d.money.deposit_pence ?? 500),
      deposit_required: bool(m.deposit_required, d.money.deposit_required),
      notice_hours: int(m.notice_hours, 0, 72, d.money.notice_hours),
      payment: oneOf(m.payment, PAYMENT, d.money.payment),
    },
    policies: {
      skin_test: oneOf(p.skin_test, SKIN_TEST, d.policies.skin_test),
      fix_days: p.fix_days === null ? null : int(p.fix_days, 1, 30, d.policies.fix_days ?? 7),
      access: str(p.access, 300, d.policies.access),
      parking: str(p.parking, 300, d.policies.parking),
      products: str(p.products, 200, d.policies.products),
      tips: str(p.tips, 200, d.policies.tips),
      careers: str(p.careers, 300, d.policies.careers),
      home_visits: str(p.home_visits, 200, d.policies.home_visits),
      faqs: sanitiseDraftFaqs(p.faqs),
    },
    theme: sanitiseTheme(x.theme, d.theme),
    sources: sanitiseSources(x.sources),
  };
}
