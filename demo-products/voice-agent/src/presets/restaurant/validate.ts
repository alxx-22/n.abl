// Two jobs. sanitise(): rebuild answers from whatever JSON arrived, field by
// field, with bounds and defaults, so a hand-crafted request cannot put
// anything odd into a profile. validate(): what the builder shows as still
// missing or wrong before Start.

import { bool, int, oneOf, sanitiseBasics, sanitiseClosures, sanitiseDays, sanitiseFaqs, sanitiseSources, sanitiseTheme, str } from '../common/sanitise.ts';
import type { Issue as BaseIssue } from '../common/types.ts';
import { validateBase } from '../common/validate.ts';
import { sanitiseMenu, validateMenu } from '../food/menu.ts';
import { ORDER_PAYMENTS, sanitiseOrdering, takesOrders, validateOrdering } from '../food/ordering.ts';
import { sanitiseDeposit, sanitiseSeating, validateDeposit, validateSeating } from '../seating/floor.ts';
import { VERSION, defaultAnswers, type RestaurantAnswers } from './answers.ts';

export function sanitiseRestaurant(input: unknown): RestaurantAnswers {
  const d = defaultAnswers();
  const x = (input ?? {}) as any;
  const h = x.hours ?? {};
  const s = x.serve ?? {};
  const m = x.money ?? {};
  const p = x.policies ?? {};
  return {
    version: VERSION,
    basics: sanitiseBasics(x.basics, d.basics),
    hours: {
      days: sanitiseDays(h.days, d.hours.days),
      last_booking_before_close: int(h.last_booking_before_close, 0, 240, d.hours.last_booking_before_close),
      closures: sanitiseClosures(h.closures),
    },
    serve: {
      reservations: bool(s.reservations, d.serve.reservations),
      walk_ins: bool(s.walk_ins, d.serve.walk_ins),
      ...sanitiseOrdering(s, d.serve),
    },
    seating: sanitiseSeating(x.seating, d.seating),
    menu: sanitiseMenu(x.menu, d.menu),
    money: {
      deposit: sanitiseDeposit(m.deposit, d.money.deposit),
      cancellation_policy: str(m.cancellation_policy, 300, d.money.cancellation_policy),
      takeaway_payment: oneOf(m.takeaway_payment, ORDER_PAYMENTS, d.money.takeaway_payment),
      service_charge: str(m.service_charge, 200, d.money.service_charge),
    },
    policies: {
      children: str(p.children, 200, d.policies.children),
      dogs: oneOf(p.dogs, ['inside', 'outside_only', 'no'] as const, d.policies.dogs),
      accessibility: str(p.accessibility, 300, d.policies.accessibility),
      parking: str(p.parking, 300, d.policies.parking),
      dress_code: str(p.dress_code, 200, d.policies.dress_code),
      corkage: str(p.corkage, 200, d.policies.corkage),
      cakes: str(p.cakes, 200, d.policies.cakes),
      vouchers: str(p.vouchers, 200, d.policies.vouchers),
      dietary: str(p.dietary, 300, d.policies.dietary),
      faqs: sanitiseFaqs(p.faqs),
    },
    theme: sanitiseTheme(x.theme, d.theme),
    sources: sanitiseSources(x.sources),
  };
}

/** The builder steps an issue can point at. */
export type RestaurantStep = 'basics' | 'hours' | 'serve' | 'seating' | 'floor' | 'menu' | 'money' | 'policies';
export type Issue = BaseIssue<RestaurantStep>;

export function validateRestaurant(a: RestaurantAnswers): Issue[] {
  const out: Issue[] = validateBase(a, 'restaurant');
  if (!a.serve.reservations && !takesOrders(a.serve)) {
    out.push({ step: 'serve', level: 'warning', message: 'With no bookings and no takeaway, the receptionist can only answer questions.' });
  }
  if (a.serve.reservations) out.push(...validateSeating(a.seating, { seating: 'seating', floor: 'floor' }));
  out.push(...validateMenu(a.menu, 'menu', { orderable: takesOrders(a.serve) }));
  out.push(...validateOrdering(a.serve, 'serve'));
  out.push(...validateDeposit(a.money.deposit, 'money'));
  return out;
}
