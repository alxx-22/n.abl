// Restaurant answers → the receptionist's profile. Pure: the same answers
// always make the same profile, and every field the builder offers changes
// something here (test/restaurant.test.ts checks each one).

import type { KnowledgeEntry, TenantProfile } from '../../domain/types.ts';
import { bookingWindows, hoursSentence as sayHours } from '../common/hours.ts';
import { baseProfile, entry, greetingFor as greetingOf, mergeFaqs } from '../common/profile.ts';
import type { DayHours } from '../common/types.ts';
import { compileMenu, hasMenu } from '../food/menu.ts';
import { compileOrdering, deliveryAppsEntry, takeawaySentence } from '../food/ordering.ts';
import { compileBooking, depositSentence, seatingSentence, takesBookings, walkInsAnswer } from '../seating/floor.ts';
import { tableBookable as seatingTableBookable } from '../seating/tables.ts';
import type { RestaurantAnswers, TableAnswer } from './answers.ts';

export { dayRange } from '../common/hours.ts';

export const hoursSentence = (a: { hours: { days: DayHours[] } }): string => sayHours(a.hours);

export const tableBookable = (a: RestaurantAnswers, t: TableAnswer) => a.serve.reservations && seatingTableBookable(a.seating, t);

function dogsAnswer(a: RestaurantAnswers): string {
  const outside = a.seating.areas.find((x) => x.kind === 'outdoor');
  if (a.policies.dogs === 'inside') return 'Dogs are welcome inside and out; we have water bowls.';
  if (a.policies.dogs === 'outside_only') {
    return outside ? `Dogs are welcome on the ${outside.label.toLowerCase()}, but not inside, apart from assistance dogs.` : 'Only assistance dogs inside, I’m afraid.';
  }
  return 'Only assistance dogs, I’m afraid.';
}

function knowledge(a: RestaurantAnswers): KnowledgeEntry[] {
  const p = a.policies;
  return mergeFaqs([
    entry('Can I bring my dog?', dogsAnswer(a), ['dog', 'dogs', 'pet']),
    entry('Is there parking?', p.parking, ['parking', 'car', 'park']),
    entry('Is it accessible for wheelchairs?', p.accessibility, ['wheelchair', 'accessible', 'disabled', 'step free', 'accessibility', 'toilet']),
    entry('Is there a dress code?', p.dress_code, ['dress', 'code', 'smart', 'wear']),
    entry('Can I bring my own wine?', p.corkage, ['byo', 'corkage', 'wine', 'bring']),
    entry('Can I bring a birthday cake?', p.cakes, ['cake', 'birthday', 'cakeage']),
    entry('Do you sell gift vouchers?', p.vouchers, ['voucher', 'gift', 'present']),
    entry('Do you have vegan or gluten-free options?', p.dietary, ['vegan', 'vegetarian', 'gluten', 'coeliac', 'dairy', 'dietary']),
    entry('Are children welcome?', `${p.children}${a.seating.highchairs ? ` We have ${a.seating.highchairs} highchairs.` : ''}`, ['children', 'kids', 'child', 'highchair', 'baby']),
    entry('Is there a service charge?', a.money.service_charge, ['service', 'charge', 'tip', 'gratuity']),
    entry('What is your cancellation policy?', a.money.cancellation_policy, ['cancel', 'cancellation', 'refund', 'deposit']),
    entry('Do you take walk-ins?', walkInsAnswer(a.seating, a.serve.walk_ins), ['walk', 'walk-in', 'without booking', 'turn up']),
    deliveryAppsEntry(a.serve),
  ], p.faqs);
}

export const greetingFor = (a: RestaurantAnswers): string => greetingOf(a.basics, 'restaurant');

export function compileRestaurant(a: RestaurantAnswers, meta: { slug: string }): TenantProfile {
  const policies: Record<string, string> = {};
  const dep = depositSentence(a.money.deposit);
  if (dep) policies.deposit = dep;
  if (a.money.cancellation_policy.trim()) policies.cancellation = a.money.cancellation_policy.trim();
  if (a.money.service_charge.trim()) policies.service_charge = a.money.service_charge.trim();
  const tk = takeawaySentence(a.serve, a.money.takeaway_payment);
  if (tk) policies.takeaway = tk;
  policies.dogs = dogsAnswer(a);

  const menu = hasMenu(a.menu);

  return {
    ...baseProfile(a, meta, {
      businessType: 'restaurant',
      noun: 'restaurant',
      facts: [
        seatingSentence(a.seating, a.serve),
        tk,
        [a.policies.accessibility, a.policies.children, a.seating.highchairs ? `${a.seating.highchairs} highchairs.` : ''].filter(Boolean).join(' '),
        a.policies.parking,
      ],
    }),
    knowledge: knowledge(a),
    booking: takesBookings(a.seating, a.serve)
      ? compileBooking(a.seating, { reservations: a.serve.reservations, windows: bookingWindows(a.hours, a.hours.last_booking_before_close), deposit: a.money.deposit })
      : undefined,
    menu: menu ? compileMenu(a.menu) : undefined,
    ordering: menu ? compileOrdering(a.serve, a.hours, a.money.takeaway_payment) : undefined,
    policies,
  };
}
