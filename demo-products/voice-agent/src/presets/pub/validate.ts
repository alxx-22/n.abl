// Two jobs, as for the restaurant and the café. sanitise(): rebuild answers
// from whatever JSON arrived, field by field, with bounds and defaults.
// validate(): what the builder shows as still missing or wrong before Start.

import { arr, bool, int, sanitiseBasics, sanitiseClosures, sanitiseDays, sanitiseDraftFaqs, sanitiseSources, sanitiseTheme, str, time } from '../common/sanitise.ts';
import type { Issue as BaseIssue } from '../common/types.ts';
import { validateBase } from '../common/validate.ts';
import { closeMinutes, minutesOf } from '../../domain/time.ts';
import { sanitiseMenu, validateMenu } from '../food/menu.ts';
import { sanitiseOrdering, sanitisePayment, validateOrdering } from '../food/ordering.ts';
import { sanitiseSeating, validateSeating } from '../seating/floor.ts';
import { VERSION, defaultAnswers, type PubAnswers, type RegularEvent } from './answers.ts';
import type { PubStep } from './steps.ts';

export type { PubStep };
export type Issue = BaseIssue<PubStep>;

function events(v: unknown, d: RegularEvent[]): RegularEvent[] {
  if (!Array.isArray(v)) return d;
  return arr(v).slice(0, 8).map((e: any): RegularEvent => ({
    day: int(e?.day, 0, 6, 6),
    time: time(e?.time, '20:00'),
    title: str(e?.title, 60, 'An event') || 'An event',
    place: str(e?.place, 40, 'the bar'),
    free: bool(e?.free, true),
  }));
}

export function sanitisePub(input: unknown): PubAnswers {
  const d = defaultAnswers();
  const x = (input ?? {}) as any;
  const h = x.hours ?? {};
  const food = h.food ?? {};
  const b = x.booking ?? {};
  const q = x.quiz ?? {};
  const m = x.money ?? {};
  const p = x.policies ?? {};
  return {
    version: VERSION,
    basics: sanitiseBasics(x.basics, d.basics),
    hours: {
      days: sanitiseDays(h.days, d.hours.days),
      closures: sanitiseClosures(h.closures),
      food: {
        from: time(food.from, d.hours.food.from),
        until: time(food.until, d.hours.food.until),
        sunday_until: food.sunday_until === null ? null : time(food.sunday_until, d.hours.food.sunday_until ?? '18:00'),
      },
    },
    seating: sanitiseSeating(x.seating, d.seating),
    booking: {
      late_grace_minutes: int(b.late_grace_minutes, 0, 60, d.booking.late_grace_minutes),
      no_bar_bookings_for_matches: bool(b.no_bar_bookings_for_matches, d.booking.no_bar_bookings_for_matches),
    },
    children: { until: x.children?.until === null ? null : time(x.children?.until, d.children.until ?? '21:00') },
    quiz: {
      offered: bool(q.offered, d.quiz.offered),
      day: int(q.day, 0, 6, d.quiz.day),
      time: time(q.time, d.quiz.time),
      team_max: int(q.team_max, 2, 12, d.quiz.team_max),
      entry_pence: int(q.entry_pence, 0, 2000, d.quiz.entry_pence),
      minutes: int(q.minutes, 60, 240, d.quiz.minutes),
    },
    events: events(x.events, d.events),
    drinks: {
      on_tap: Array.isArray(x.drinks?.on_tap) ? [...new Set(arr(x.drinks.on_tap).map((v) => str(v, 40)).filter(Boolean))].slice(0, 12) : d.drinks.on_tap,
    },
    ordering: { ...d.ordering, ...sanitiseOrdering(x.ordering, d.ordering) },
    menu: sanitiseMenu(x.menu, d.menu),
    money: {
      payment: sanitisePayment(m.payment, d.money.payment),
      cash: bool(m.cash, d.money.cash),
      tips: str(m.tips, 200, d.money.tips),
    },
    policies: {
      children: str(p.children, 200, d.policies.children),
      baby_changing: bool(p.baby_changing, d.policies.baby_changing),
      accessibility: str(p.accessibility, 300, d.policies.accessibility),
      parking: str(p.parking, 300, d.policies.parking),
      smoking: str(p.smoking, 200, d.policies.smoking),
      vaping: str(p.vaping, 200, d.policies.vaping),
      id: str(p.id, 300, d.policies.id),
      own_cake: str(p.own_cake, 200, d.policies.own_cake),
      own_drink: str(p.own_drink, 200, d.policies.own_drink),
      taxi: str(p.taxi, 120, d.policies.taxi),
      hire: str(p.hire, 300, d.policies.hire),
      christmas: str(p.christmas, 300, d.policies.christmas),
      careers: str(p.careers, 300, d.policies.careers),
      hygiene_rating: p.hygiene_rating === null ? null : int(p.hygiene_rating, 0, 5, d.policies.hygiene_rating ?? 5),
      faqs: sanitiseDraftFaqs(p.faqs),
    },
    theme: sanitiseTheme(x.theme, d.theme),
    sources: sanitiseSources(x.sources),
  };
}

export function validatePub(a: PubAnswers): Issue[] {
  const out: Issue[] = validateBase(a, 'pub');
  out.push(...validateSeating(a.seating, { seating: 'seating', floor: 'floor' }));
  const f = a.hours.food;
  if (minutesOf(f.until) <= minutesOf(f.from)) out.push({ step: 'hours', level: 'error', message: 'Food has to stop after it starts.' });
  // Food served outside the opening hours every day is never bookable.
  const fits = a.hours.days.some((d) => d.open && d.services.some((s) => minutesOf(f.from) < closeMinutes(s.close) && minutesOf(f.until) > minutesOf(s.open)));
  if (!fits) out.push({ step: 'hours', level: 'warning', message: 'The food times fall outside the opening hours, so no table can be booked.' });
  const c = a.children.until;
  if (c && minutesOf(c) <= minutesOf(f.from) + 60) out.push({ step: 'booking', level: 'warning', message: `Children are welcome only until ${c}, which leaves little time for a meal.` });
  out.push(...validateMenu(a.menu, 'menu', { orderable: a.ordering.collection.enabled }));
  out.push(...validateOrdering(a.ordering, 'menu'));
  const unanswered = a.policies.faqs.filter((q) => !q.q || !q.a).length;
  if (unanswered) out.push({ step: 'policies', level: 'warning', message: `${unanswered} question${unanswered === 1 ? ' needs' : 's need'} both the question and its answer before the receptionist can use ${unanswered === 1 ? 'it' : 'them'}.` });
  return out;
}
