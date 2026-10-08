// Rebuild takeaway answers from whatever JSON arrived, field by field, with
// bounds and defaults, so a hand-crafted request cannot put anything odd
// into a profile. The shared sections use the shared sanitisers; the deals
// are cleaned against the menu just cleaned, so a choice whose section a
// menu draft renamed is re-linked here, on the next save.

import { int, oneOf, sanitiseBasics, sanitiseClosures, sanitiseDays, sanitiseDraftFaqs, sanitiseSources, sanitiseTheme, str } from '../common/sanitise.ts';
import { sanitiseDeals } from '../food/deals.ts';
import { sanitiseMenu } from '../food/menu.ts';
import { ORDER_PAYMENTS, sanitiseOrdering } from '../food/ordering.ts';
import { HALAL, MISSING_ITEMS, PAY_DRIVER, VERSION, defaultAnswers, type TakeawayAnswers } from './answers.ts';

/** Null stays null ("none"); a number is kept in bounds; anything else is the default. */
function orNull(v: unknown, min: number, max: number, d: number | null): number | null {
  if (v === null) return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? int(n, min, max, min) : d;
}

export function sanitiseTakeaway(input: unknown): TakeawayAnswers {
  const d = defaultAnswers();
  const x = (input ?? {}) as any;
  const h = x.hours ?? {};
  const k = x.kitchen ?? {};
  const m = x.money ?? {};
  const af = x.after ?? {};
  const p = x.policies ?? {};
  const menu = sanitiseMenu(x.menu, d.menu);
  return {
    version: VERSION,
    basics: sanitiseBasics(x.basics, d.basics),
    hours: { days: sanitiseDays(h.days, d.hours.days), closures: sanitiseClosures(h.closures) },
    // The defaults carry zones, free delivery, drivers and timed orders, so the shared sanitiser keeps all four.
    ordering: sanitiseOrdering(x.ordering, d.ordering) as TakeawayAnswers['ordering'],
    kitchen: {
      last_orders_minutes: int(k.last_orders_minutes, 0, 120, d.kitchen.last_orders_minutes),
      big_order_mains: int(k.big_order_mains, 2, 30, d.kitchen.big_order_mains),
      catering_over_mains: int(k.catering_over_mains, 5, 100, d.kitchen.catering_over_mains),
    },
    menu,
    // A setup saved before it had deals takes the sample's; one that has deals, even none, keeps its own.
    deals: x.deals === undefined ? d.deals : sanitiseDeals(x.deals, menu),
    money: {
      payment: oneOf(m.payment, ORDER_PAYMENTS, d.money.payment),
      pay_driver: oneOf(m.pay_driver, PAY_DRIVER, d.money.pay_driver),
      card_minimum_pence: orNull(m.card_minimum_pence, 0, 2000, d.money.card_minimum_pence),
    },
    after: {
      late_after_minutes: int(af.late_after_minutes, 5, 60, d.after.late_after_minutes),
      missing_items: oneOf(af.missing_items, MISSING_ITEMS, d.after.missing_items),
      // As typed, so a number half written is kept; compile uses only the valid ones.
      pay_on_phone_numbers: Array.isArray(af.pay_on_phone_numbers)
        ? af.pay_on_phone_numbers.map((n: unknown) => str(n, 20, '')).filter(Boolean).slice(0, 30)
        : d.after.pay_on_phone_numbers,
    },
    policies: {
      halal: oneOf(p.halal, HALAL, d.policies.halal),
      hygiene_rating: orNull(p.hygiene_rating, 0, 5, d.policies.hygiene_rating),
      parking: str(p.parking, 300, d.policies.parking),
      offers: str(p.offers, 300, d.policies.offers),
      bags: str(p.bags, 200, d.policies.bags),
      careers: str(p.careers, 300, d.policies.careers),
      tips: str(p.tips, 200, d.policies.tips),
      faqs: sanitiseDraftFaqs(p.faqs),
    },
    theme: sanitiseTheme(x.theme, d.theme),
    sources: sanitiseSources(x.sources),
  };
}
