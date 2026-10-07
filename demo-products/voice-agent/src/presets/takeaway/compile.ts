// Takeaway answers → the receptionist's profile. Pure: the same answers
// always make the same profile. The facts say how ordering and paying work
// and where it delivers, but never how long anything takes: a wait comes
// only from the kitchen's queue, through the tools (presets/takeaway.md §4.5).

import { pounds, type KnowledgeEntry, type TenantProfile } from '../../domain/types.ts';
import { baseProfile, entry, mergeFaqs } from '../common/profile.ts';
import { compileMenu } from '../food/menu.ts';
import { compileOrdering, deliveryAppsEntry } from '../food/ordering.ts';
import { compileDeals, dealComplete } from '../food/deals.ts';
import type { TakeawayAnswers } from './answers.ts';

/** "£2.50", "£12". */
const money = (pence: number) => pounds(pence).replace(/\.00$/, '');
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] ?? '');

/** How an order is paid for, from the money answers: "by card on the phone, when you collect, or to the driver in cash or by card". */
export function paySentence(a: TakeawayAnswers): string {
  const { payment, pay_driver } = a.money;
  const ways = [
    payment !== 'collection' ? 'by card on the phone' : null,
    payment !== 'phone' && a.ordering.collection.enabled ? 'when you collect' : null,
    payment !== 'phone' && a.ordering.delivery.enabled && pay_driver !== 'no' ? `to the driver ${pay_driver === 'cash' ? 'in cash' : 'in cash or by card'}` : null,
  ].filter((x): x is string => Boolean(x));
  const said = ways.length > 2 ? `${ways.slice(0, -1).join(', ')}, or ${ways.at(-1)}` : ways.join(' or ');
  return said ? `Orders are paid ${said}.` : '';
}

/** Where it delivers and for what: each zone's fee and minimum, then free delivery. */
export function deliverySentence(a: TakeawayAnswers): string {
  const d = a.ordering.delivery;
  if (!d.enabled || !d.districts.length) return '';
  const groups = new Map<string, string[]>();
  for (const code of d.districts) {
    const zone = d.zones.find((z) => z.code === code);
    const price = `${zone?.fee_pence ?? d.fee_pence}|${zone?.min_order_pence ?? d.min_order_pence}`;
    groups.set(price, [...(groups.get(price) ?? []), code]);
  }
  // "to NG1 and NG2 is £2.50, with a £12 minimum; to NG5, £3.50 with a £15 minimum".
  const parts = [...groups].map(([price, codes], i) => {
    const [fee, min] = price.split('|').map(Number);
    const cost = fee ? money(fee) : 'free';
    const least = min ? ` with a ${money(min)} minimum` : '';
    return i === 0 ? `to ${list(codes)} is ${cost}${least ? `,${least}` : ''}` : `to ${list(codes)}, ${cost}${least}`;
  });
  const free = d.free_over_pence !== null && d.free_over_pence > 0 ? ` Delivery is free on orders of ${money(d.free_over_pence)} or more.` : '';
  return `Delivery ${parts.join('; ')}.${free}`;
}

export function halalSentence(a: TakeawayAnswers): string {
  return { all: 'All our meat is halal.', chicken: 'Our chicken is halal; our other meat is not.', none: 'None of our meat is halal.' }[a.policies.halal];
}

function ordersSentence(a: TakeawayAnswers): string {
  const o = a.ordering;
  const kinds = [o.collection.enabled ? 'collection' : null, o.delivery.enabled ? 'delivery' : null].filter(Boolean).join(' and ');
  return kinds ? `We take orders by phone for ${kinds}, for today${o.timed_orders ? ', as soon as possible or for a time later on' : ''}. ${paySentence(a)}`.trim() : '';
}

function cardAnswer(a: TakeawayAnswers): string {
  const min = a.money.card_minimum_pence;
  return `There's no extra charge for paying by card.${min ? ` The minimum spend on a card is ${money(min)}.` : ''}`;
}

function dealsAnswer(a: TakeawayAnswers): string {
  const live = a.deals.filter((d) => dealComplete(a.menu, d));
  return live.map((d) => `${d.name}, ${money(d.price_pence)}${d.description ? `: ${d.description.replace(/\.$/, '')}` : ''}.`).join(' ');
}

function knowledge(a: TakeawayAnswers): KnowledgeEntry[] {
  const p = a.policies;
  return mergeFaqs([
    entry('Do you deliver to me?', deliverySentence(a), ['deliver', 'delivery', 'postcode', 'area', 'fee', 'minimum', 'free delivery']),
    entry('Do you have any meal deals?', dealsAnswer(a), ['deal', 'deals', 'meal', 'combo', 'box']),
    entry('Is your food halal?', halalSentence(a), ['halal', 'meat', 'chicken', 'beef', 'pork']),
    entry('Can you cater for allergies?', a.menu.allergen_statement ? `${a.menu.allergen_statement} Ask about any item and I'll tell you its allergens.` : '', ['allergy', 'allergies', 'allergen', 'intolerance', 'coeliac']),
    entry('Do you charge for paying by card?', cardAnswer(a), ['card', 'surcharge', 'fee', 'contactless', 'pay']),
    entry('Is there parking?', p.parking, ['parking', 'car', 'park']),
    entry('Do you have any offers or discounts?', p.offers, ['offer', 'offers', 'discount', 'student', 'code', 'voucher']),
    entry('Do you charge for bags?', p.bags, ['bag', 'bags', 'carrier']),
    entry('Are you hiring?', p.careers, ['job', 'jobs', 'work', 'hiring', 'vacancy', 'apply', 'driver']),
    entry('Can I tip the driver?', p.tips, ['tip', 'tips', 'tipping', 'driver']),
    entry('What is your food hygiene rating?', p.hygiene_rating === null ? '' : `Our food hygiene rating is ${p.hygiene_rating}. You can check it on the Food Standards Agency's ratings website.`, ['hygiene', 'rating', 'clean', 'inspection', 'fsa']),
    deliveryAppsEntry(a.ordering),
  ], p.faqs);
}

export function compileTakeaway(a: TakeawayAnswers, meta: { slug: string }): TenantProfile {
  const orders = ordersSentence(a);
  const delivery = deliverySentence(a);
  const ordering = compileOrdering(a.ordering, a.hours, a.money.payment);
  // Meal deals first, as a takeaway's menu shows them, each choice an option group (food/deals.ts).
  const menu = compileMenu(a.menu);
  const dealMenu = compileDeals(a.menu, a.deals);
  // How ordering, delivery and halal work are already core facts; only what isn't goes here, so the prompt says each once.
  const policies: Record<string, string> = { card_payments: cardAnswer(a) };
  return {
    ...baseProfile(a, meta, { businessType: 'takeaway', noun: 'takeaway', facts: [orders, delivery, halalSentence(a), a.menu.allergen_statement] }),
    knowledge: knowledge(a),
    menu: dealMenu ? { ...menu, categories: [dealMenu.category, ...menu.categories], modifier_groups: { ...menu.modifier_groups, ...dealMenu.groups }, deals: dealMenu.deals } : menu,
    // The kitchen counts every order by when it must be ready (core/kitchen.ts).
    ordering: ordering && {
      ...ordering, kitchen: { last_orders_minutes: a.kitchen.last_orders_minutes },
      ...(a.ordering.delivery.enabled && a.money.payment !== 'phone' ? { pay_driver: a.money.pay_driver } : {}),
    },
    policies,
  };
}
