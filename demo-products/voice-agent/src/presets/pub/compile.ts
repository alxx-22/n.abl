// The pub's answers compiled into a TenantProfile (presets/pub.md §4). The
// same answers always make the same profile. The facts say what every call
// needs (the rooms, food times); the rest is knowledge, found when asked:
// age and ID, measures, smoking, dogs, the room upstairs.

import type { BookableService, KnowledgeEntry, TenantProfile } from '../../domain/types.ts';
import { closeMinutes, minutesOf, spokenTime, timeOf } from '../../domain/time.ts';
import { bookingWindows } from '../common/hours.ts';
import type { DayHours } from '../common/types.ts';
import { baseProfile, entry, mergeFaqs } from '../common/profile.ts';
import { compileMenu, hasMenu, menuItems } from '../food/menu.ts';
import { compileBooking, seatingSentence } from '../seating/floor.ts';
import type { PubAnswers } from './answers.ts';

/** The last table is booked this long before food stops. */
const LAST_TABLE_BEFORE_FOOD_STOPS = 30;

/** When food stops on a day: Sundays may stop earlier (roasts). */
const foodUntil = (a: PubAnswers, weekday: number) => (weekday === 0 && a.hours.food.sunday_until ? a.hours.food.sunday_until : a.hours.food.until);

/** The kitchen's hours, day by day, inside the opening hours: tables are booked to eat. */
export function foodDays(a: PubAnswers): DayHours[] {
  return a.hours.days.map((d, i) => {
    if (!d.open) return d;
    const from = minutesOf(a.hours.food.from);
    const until = minutesOf(foodUntil(a, i));
    const services = d.services
      .map((s) => ({ label: 'Food', open: timeOf(Math.max(from, minutesOf(s.open))), close: timeOf(Math.min(until, closeMinutes(s.close))) }))
      .filter((s) => minutesOf(s.close) > minutesOf(s.open));
    return services.length ? { open: true, services } : { open: false, services: [] };
  });
}

export function foodSentence(a: PubAnswers): string {
  const f = a.hours.food;
  const sunday = f.sunday_until && f.sunday_until !== f.until ? `; Sunday roasts until ${spokenTime(f.sunday_until)}` : '';
  return `Food from ${spokenTime(f.from)} until ${spokenTime(f.until)}${sunday}. Drinks until close.`;
}

const pounds = (p: number) => `£${(p / 100).toFixed(p % 100 ? 2 : 0)}`;

function knowledge(a: PubAnswers): KnowledgeEntry[] {
  const p = a.policies;
  const items = menuItems(a.menu);
  const glutenFree = items.filter((i) => i.dietary?.some((d) => /gluten[- ]free/i.test(d))).map((i) => i.name);
  const until = a.children.until;
  const garden = a.seating.areas.find((x) => x.kind === 'outdoor');
  return mergeFaqs([
    entry('Can we just turn up?', `${garden ? `The ${garden.label.toLowerCase()} and some of the bar are first come; ` : 'Some of the bar is first come; '}tables can be booked for food. Weekend evenings and Sunday lunch are the busiest, so booking is best then.`, ['walk', 'walk-in', 'turn up', 'book', 'busy', 'drinks']),
    ...(garden ? [entry('Can we sit in the beer garden?', `It’s first come, weather permitting: garden tables aren’t booked. ${p.smoking}`, ['garden', 'outside', 'beer garden', 'sun', 'weather'])] : []),
    entry('When is food served?', foodSentence(a), ['food', 'kitchen', 'serving', 'lunch', 'dinner', 'roast', 'sunday']),
    entry('Can we bring the children?', until ? `${p.children} After ${spokenTime(until)} it’s adults only, so a table with children finishes by then.` : p.children, ['children', 'kids', 'child', 'family', 'baby', 'high chair']),
    entry('Can we bring the dog?', 'Dogs are very welcome everywhere, with water bowls in the bar. Assistance dogs always.', ['dog', 'dogs', 'pet', 'puppy', 'assistance']),
    entry('Can my 16 or 17-year-old have a drink with a meal?', 'With a table meal, a 16 or 17-year-old may have beer, wine or cider if an adult with them buys it. Never spirits, never at the bar, and they can’t buy it themselves. Staff will check ID on the night.', ['17', '16', 'seventeen', 'sixteen', 'teenager', 'under 18', 'drink with a meal', 'pint with dinner']),
    entry('What ID do you accept?', `${p.id} It’s the staff’s decision on the night.`, ['id', 'identification', 'challenge 25', 'passport', 'driving licence', 'proof of age', 'digital id', 'pass card', 'served', 'serve', 'age', 'app', 'old enough']),
    entry('Do you do half pints, small wines and tap water?', 'Yes: half pints, single 25ml measures and 125ml glasses of wine are always available, and tap water is free.', ['half', 'half pint', 'small wine', '125', 'measure', 'tap water', 'water', 'single']),
    entry('Do you have gluten-free beer?', glutenFree.length ? `Yes: ${glutenFree.join(' and ')}, marked gluten-free. Our ales, lagers and stout are brewed with barley or wheat, so they aren’t.` : 'Not marked gluten-free, I’m afraid: our ales, lagers and stout are brewed with barley or wheat.', ['gluten', 'gluten-free', 'coeliac', 'celiac', 'beer', 'lager']),
    entry('Is anything on the food menu gluten-free?', "We don’t call food gluten-free unless it’s tested: the kitchen uses flour. Some dishes are made without gluten ingredients; the menu says which.", ['gluten', 'gluten-free', 'coeliac', 'celiac', 'wheat', 'food']),
    entry('Can I smoke or vape?', `${p.smoking} ${p.vaping}`, ['smoke', 'smoking', 'vape', 'vaping', 'cigarette']),
    entry('Can we bring a birthday cake or our own drinks?', `${p.own_cake} ${p.own_drink}`, ['cake', 'birthday', 'own drink', 'corkage', 'bring']),
    entry('Do you show the football?', `The big games are on the bar’s screens: ask and I’ll check this week’s list.${a.booking.no_bar_bookings_for_matches ? ' The bar is first come during a match; the dining room can be booked, but has no screen.' : ''}`, ['football', 'sport', 'match', 'game', 'screen', 'rugby', 'cricket', 'boxing', 'sky', 'tnt']),
    entry('Can you call me a taxi?', `We don’t book them, but ${p.taxi}`, ['taxi', 'cab', 'uber', 'lift home']),
    entry('Can we hire the room upstairs?', p.hire, ['hire', 'room', 'upstairs', 'loft', 'function', 'party', 'wake', 'christening', 'private']),
    entry('Do you do Christmas parties?', p.christmas, ['christmas', 'xmas', 'festive', 'office party', 'work do']),
    entry('Is it accessible?', p.accessibility, ['wheelchair', 'accessible', 'disabled', 'step', 'step-free', 'toilet', 'access', 'stairs']),
    entry('Is there parking?', p.parking, ['parking', 'car', 'park']),
    entry('Do you take cash and card?', `${a.money.cash ? 'Cash and card' : 'Card only'}, and there’s no extra charge for card. ${a.money.tips}`, ['cash', 'card', 'pay', 'payment', 'contactless', 'tip', 'tips']),
    entry('What if we’re running late?', `We hold a table for ${a.booking.late_grace_minutes} minutes; give us a ring if you’ll be later.`, ['late', 'running late', 'delayed', 'stuck']),
    ...(p.baby_changing ? [entry('Is there baby changing?', 'Yes, and breastfeeding is welcome anywhere.', ['baby', 'changing', 'nappy', 'breastfeed', 'breastfeeding'])] : []),
    ...(p.hygiene_rating !== null ? [entry('What is your food hygiene rating?', `${p.hygiene_rating} out of 5.`, ['hygiene', 'rating', 'scores on the doors', 'clean'])] : []),
    entry('Are you hiring?', p.careers, ['job', 'jobs', 'hiring', 'work', 'vacancy', 'bar staff']),
    ...(a.quiz.offered ? [entry('Do you do a quiz?', `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][a.quiz.day]} at ${spokenTime(a.quiz.time)}: teams of up to ${a.quiz.team_max}, ${pounds(a.quiz.entry_pence)} a head.`, ['quiz', 'pub quiz', 'team', 'trivia'])] : []),
  ], p.faqs);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The quiz as a team booking: one weekly time, a price a head, at any table that takes bookings (presets/pub.md §4.2). */
function quizService(a: PubAnswers): BookableService | null {
  const q = a.quiz;
  if (!q.offered || !a.hours.days[q.day]?.open) return null;
  return {
    key: 'quiz',
    label: 'Quiz team',
    kind: 'table',
    slot_minutes: 15,
    duration_rules: [{ max_party: 100, minutes: q.minutes }],
    windows: [{ days: [q.day], first: q.time, last: q.time }],
    max_party: q.team_max,
    large_party_note: `Quiz teams are up to ${q.team_max}: a bigger group makes two teams, booked one after the other.`,
    lead_minutes: a.seating.notice_minutes,
    horizon_days: a.seating.horizon_days,
    price_pence: q.entry_pence,
    description: `The quiz, ${DAYS[q.day]}s at ${spokenTime(q.time)}: ${pounds(q.entry_pence)} a head, paid on the night.`,
    per_person: { adult_pence: q.entry_pence, child_pence: 0, child_under: 0 },
  };
}

export function compilePub(a: PubAnswers, meta: { slug: string }): TenantProfile {
  const booking = compileBooking(a.seating, {
    reservations: true,
    windows: bookingWindows({ days: foodDays(a) }, LAST_TABLE_BEFORE_FOOD_STOPS),
    deposit: { mode: 'none', amount_pence: 0, min_party: 1 },
  });
  const quiz = quizService(a);
  if (quiz) {
    booking.services.push(quiz);
    // A team sits at any table that takes bookings, in the bar or the dining room.
    for (const r of booking.resources) if (r.services.includes('table')) r.services.push('quiz');
  }
  return {
    ...baseProfile(a, meta, {
      businessType: 'pub',
      noun: 'pub',
      hoursMax: 220,
      facts: [
        seatingSentence(a.seating, { reservations: true, walk_ins: true }),
        foodSentence(a),
      ],
    }),
    booking,
    knowledge: knowledge(a),
    menu: hasMenu(a.menu) ? compileMenu(a.menu) : undefined,
    policies: {
      cancellation: 'Nothing is charged to move or cancel; a call to let us know is kind.',
    },
    pub: {
      children_until: a.children.until,
      food: { ...a.hours.food },
      taxi: a.policies.taxi,
      events: a.events.map((e) => ({ ...e })),
      on_tap: [...a.drinks.on_tap],
      no_bar_bookings_for_matches: a.booking.no_bar_bookings_for_matches,
    },
  };
}
