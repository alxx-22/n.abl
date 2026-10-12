// Two jobs, as for the restaurant. sanitise(): rebuild answers from whatever
// JSON arrived, field by field, with bounds and defaults. validate(): what
// the builder shows as still missing or wrong before Start.

import { arr, bool, int, oneOf, sanitiseBasics, sanitiseClosures, sanitiseDays, sanitiseDraftFaqs, sanitiseSources, sanitiseTheme, str, time } from '../common/sanitise.ts';
import type { Issue as BaseIssue } from '../common/types.ts';
import { validateBase } from '../common/validate.ts';
import { closeMinutes, minutesOf } from '../../domain/time.ts';
import { sanitiseMenu, validateMenu } from '../food/menu.ts';
import { sanitiseOrdering, sanitisePayment, validateOrdering } from '../food/ordering.ts';
import { sanitiseSeating, validateSeating } from '../seating/floor.ts';
import { VERSION, defaultAnswers, type CafeAnswers } from './answers.ts';
import type { CafeStep } from './steps.ts';

export type { CafeStep };
export type Issue = BaseIssue<CafeStep>;

/** Sitting times, HH:MM, once each, in order, at most four. */
function sittings(v: unknown, d: string[]): string[] {
  if (!Array.isArray(v)) return d;
  return [...new Set(arr(v).map((x) => time(x, '')).filter(Boolean))].sort().slice(0, 4);
}

export function sanitiseCafe(input: unknown): CafeAnswers {
  const d = defaultAnswers();
  const x = (input ?? {}) as any;
  const h = x.hours ?? {};
  const b = x.booking ?? {};
  const t = x.afternoon_tea ?? {};
  const m = x.money ?? {};
  const p = x.policies ?? {};
  const notice = int(t.notice_days, 0, 14, d.afternoon_tea.notice_days);
  return {
    version: VERSION,
    basics: sanitiseBasics(x.basics, d.basics),
    hours: {
      days: sanitiseDays(h.days, d.hours.days),
      closures: sanitiseClosures(h.closures),
      breakfast_until: h.breakfast_until === null ? null : time(h.breakfast_until, d.hours.breakfast_until ?? '11:30'),
      kitchen_closes_before: int(h.kitchen_closes_before, 0, 120, d.hours.kitchen_closes_before),
    },
    seating: sanitiseSeating(x.seating, d.seating),
    booking: {
      min_party: int(b.min_party, 1, 20, d.booking.min_party),
      busy_times: str(b.busy_times, 200, d.booking.busy_times),
    },
    afternoon_tea: {
      offered: bool(t.offered, d.afternoon_tea.offered),
      adult_pence: int(t.adult_pence, 0, 10_000, d.afternoon_tea.adult_pence),
      child_pence: int(t.child_pence, 0, 10_000, d.afternoon_tea.child_pence),
      child_under: int(t.child_under, 1, 17, d.afternoon_tea.child_under),
      description: str(t.description, 300, d.afternoon_tea.description),
      notice_days: notice,
      // A version for a diet never needs less notice than the tea itself.
      diet_notice_days: Math.max(notice, int(t.diet_notice_days, 0, 14, d.afternoon_tea.diet_notice_days)),
      diets: Array.isArray(t.diets) ? [...new Set(arr(t.diets).map((v) => str(v, 30)).filter(Boolean))].slice(0, 4) : d.afternoon_tea.diets,
      sittings: sittings(t.sittings, d.afternoon_tea.sittings),
      minutes: int(t.minutes, 30, 240, d.afternoon_tea.minutes),
      max_party: int(t.max_party, 1, 20, d.afternoon_tea.max_party),
      deposit_pence: int(t.deposit_pence, 0, 5000, d.afternoon_tea.deposit_pence),
    },
    ordering: { ...d.ordering, ...sanitiseOrdering(x.ordering, d.ordering) },
    menu: sanitiseMenu(x.menu, d.menu),
    money: {
      payment: sanitisePayment(m.payment, d.money.payment),
      cash: bool(m.cash, d.money.cash),
      tips: str(m.tips, 200, d.money.tips),
    },
    policies: {
      dogs: oneOf(p.dogs, ['inside', 'outside_only', 'no'] as const, d.policies.dogs),
      children: str(p.children, 200, d.policies.children),
      baby_changing: bool(p.baby_changing, d.policies.baby_changing),
      accessibility: str(p.accessibility, 300, d.policies.accessibility),
      wifi: str(p.wifi, 200, d.policies.wifi),
      laptops: str(p.laptops, 200, d.policies.laptops),
      parking: str(p.parking, 300, d.policies.parking),
      tap_water: bool(p.tap_water, d.policies.tap_water),
      hygiene_rating: p.hygiene_rating === null ? null : int(p.hygiene_rating, 0, 5, d.policies.hygiene_rating ?? 5),
      reusable_cups: str(p.reusable_cups, 200, d.policies.reusable_cups),
      careers: str(p.careers, 300, d.policies.careers),
      hire: str(p.hire, 300, d.policies.hire),
      faqs: sanitiseDraftFaqs(p.faqs),
    },
    theme: sanitiseTheme(x.theme, d.theme),
    sources: sanitiseSources(x.sources),
  };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function validateCafe(a: CafeAnswers): Issue[] {
  const out: Issue[] = validateBase(a, 'café');
  out.push(...validateSeating(a.seating, { seating: 'seating', floor: 'floor' }));
  if (a.booking.min_party > a.seating.max_party) {
    out.push({ step: 'booking', level: 'warning', message: `Bookings start at ${a.booking.min_party}, more than the largest party you take (${a.seating.max_party}), so no table can be booked.` });
  }
  const tea = a.afternoon_tea;
  if (tea.offered) {
    if (!tea.sittings.length) out.push({ step: 'booking', level: 'error', message: 'Add at least one afternoon tea sitting.' });
    if (!tea.adult_pence) out.push({ step: 'booking', level: 'error', message: 'Afternoon tea needs a price.' });
    // A sitting that ends after closing every day is never bookable.
    const fits = (s: string) => a.hours.days.some((d) => d.open && d.services.some((p) => minutesOf(s) >= minutesOf(p.open) && minutesOf(s) + tea.minutes <= closeMinutes(p.close)));
    for (const s of tea.sittings.filter((x) => !fits(x))) {
      out.push({ step: 'booking', level: 'warning', message: `The ${s} sitting runs past closing every day, so it can't be booked.` });
    }
    const short = a.hours.days.map((d, i) => (d.open && !tea.sittings.some((s) => d.services.some((p) => minutesOf(s) >= minutesOf(p.open) && minutesOf(s) + tea.minutes <= closeMinutes(p.close))) ? DAY_NAMES[i] : null)).filter(Boolean);
    if (short.length && short.length < 7 && tea.sittings.length) {
      out.push({ step: 'booking', level: 'warning', message: `No afternoon tea sitting fits on ${short.join(' and ')}.` });
    }
  }
  out.push(...validateMenu(a.menu, 'menu', { orderable: a.ordering.collection.enabled }));
  out.push(...validateOrdering(a.ordering, 'ordering'));
  const unanswered = a.policies.faqs.filter((f) => !f.q || !f.a).length;
  if (unanswered) out.push({ step: 'policies', level: 'warning', message: `${unanswered} question${unanswered === 1 ? ' needs' : 's need'} both the question and its answer before the receptionist can use ${unanswered === 1 ? 'it' : 'them'}.` });
  return out;
}
