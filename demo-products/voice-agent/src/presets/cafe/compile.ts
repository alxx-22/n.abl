// Café answers → the receptionist's profile (presets/cafe.md §4). Pure: the
// same answers always make the same profile. The tables are the
// restaurant's (seating/), with walk-in under the booking size; afternoon
// tea is a second table service, with sittings, a price per person and
// notice in days; the menu is the shared one, its allergen statement the
// café's cross-contact warning.

import { pounds, type BookableService, type KnowledgeEntry, type TenantProfile, type Window } from '../../domain/types.ts';
import { closeMinutes, minutesOf, spokenTime } from '../../domain/time.ts';
import { DAY_ORDER, bookingWindows } from '../common/hours.ts';
import { DAY_NAMES } from '../common/validate.ts';
import { baseProfile, entry, mergeFaqs } from '../common/profile.ts';
import { compileMenu, hasMenu, menuItems } from '../food/menu.ts';
import { compileBooking } from '../seating/floor.ts';
import type { CafeAnswers } from './answers.ts';

/** Tables are booked up to an hour before closing: a group at a quarter to four isn't a café booking. */
const LAST_TABLE_BEFORE_CLOSE = 60;

const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs.join(''));

/** What a walk-in hears: no booking under the size, the busy times, and nothing promised. */
export function walkInNote(a: CafeAnswers): string {
  return `Tables for fewer than ${a.booking.min_party} are walk-in: we don't book them, so never promise one is free or held. Say when it's usually busy: ${a.booking.busy_times}`;
}

/** The afternoon tea's sittings that fit each day the café is open long enough, as booking windows. */
function teaWindows(a: CafeAnswers): Window[] {
  const out: Window[] = [];
  for (const s of a.afternoon_tea.sittings) {
    const days = a.hours.days.flatMap((d, i) =>
      d.open && d.services.some((p) => minutesOf(s) >= minutesOf(p.open) && minutesOf(s) + a.afternoon_tea.minutes <= closeMinutes(p.close)) ? [i] : []);
    if (days.length) out.push({ days, first: s, last: s });
  }
  return out;
}

/** The afternoon tea's price, as said: "£24.50 a person, £12 for under-12s". */
export function teaPrice(a: CafeAnswers): string {
  const t = a.afternoon_tea;
  return `${pounds(t.adult_pence)} a person${t.child_pence ? `, ${pounds(t.child_pence)} for under-${t.child_under}s` : ''}`;
}

/**
 * Each sitting, with the days it runs when that isn't every open day: "2pm
 * (not Sundays)", "3:30pm (Saturdays only)". A live call (12 October) offered
 * all three sittings on a Sunday, which only has room for the first.
 */
function sittingsSaid(a: CafeAnswers): string {
  const open = DAY_ORDER.filter((d) => a.hours.days[d]?.open);
  const days = (ds: number[], join: string) => list(ds.map((d) => `${DAY_NAMES[d]}s`)).replace(/ and ([^ ]+)$/, ` ${join} $1`);
  return list(teaWindows(a).map((w) => {
    const missing = open.filter((d) => !w.days.includes(d));
    const on = open.filter((d) => w.days.includes(d));
    const when = !missing.length ? '' : missing.length <= on.length ? ` (not ${days(missing, 'or')})` : ` (${days(on, 'and')} only)`;
    return `${spokenTime(w.first)}${when}`;
  }));
}

export function teaSentence(a: CafeAnswers): string | null {
  const t = a.afternoon_tea;
  if (!t.offered) return null;
  const notice = t.notice_days === 1 ? 'a day ahead' : `${t.notice_days} days ahead`;
  const named = list(t.diets);
  const diets = t.diets.length ? ` ${named.charAt(0).toUpperCase()}${named.slice(1)} with ${t.diet_notice_days} days' notice.` : '';
  const sittings = sittingsSaid(a);
  return `Afternoon tea, ${teaPrice(a)}, booked ${notice}${sittings ? `, sittings at ${sittings}` : ''}.${diets}`;
}

export function bookingSentence(a: CafeAnswers): string {
  return `Tables for ${a.booking.min_party} or more can be booked${a.afternoon_tea.offered ? ', and afternoon tea' : ''}; smaller tables are walk-in.`;
}

function foodSentence(a: CafeAnswers): string | null {
  const parts = [
    a.hours.breakfast_until ? `Breakfast until ${spokenTime(a.hours.breakfast_until)}` : null,
    a.hours.kitchen_closes_before ? `food until ${a.hours.kitchen_closes_before} minutes before closing, drinks and cakes until close` : null,
  ].filter(Boolean);
  return parts.length ? `${parts.join('; ')}.` : null;
}

function dogsAnswer(a: CafeAnswers): string {
  const outside = a.seating.areas.find((x) => x.kind === 'outdoor');
  if (a.policies.dogs === 'inside') return 'Well-behaved dogs are welcome inside, and assistance dogs always.';
  if (a.policies.dogs === 'outside_only') return outside ? `Dogs are welcome at the tables ${outside.label.toLowerCase()}; inside, assistance dogs only.` : 'Assistance dogs only inside, I’m afraid.';
  return 'Only assistance dogs, I’m afraid.';
}

function knowledge(a: CafeAnswers): KnowledgeEntry[] {
  const p = a.policies;
  const t = a.afternoon_tea;
  const items = menuItems(a.menu);
  const plant = a.menu.modifier_groups.milk?.options.filter((o) => !/skimmed|semi|whole/i.test(o.name)) ?? [];
  const free = plant.length && plant.every((o) => !o.price_pence);
  return mergeFaqs([
    entry('Can we just turn up? Do you take bookings?', `${bookingSentence(a)} ${a.booking.busy_times}`, ['walk', 'walk-in', 'turn up', 'book', 'booking', 'reserve', 'table', 'busy']),
    ...(t.offered
      ? [entry('Do you do afternoon tea?', `Yes: ${t.description} ${teaPrice(a)}. Book ${t.notice_days === 1 ? 'a day' : `${t.notice_days} days`} ahead${t.diets.length ? `; ${list(t.diets)} with ${t.diet_notice_days} days' notice` : ''}.`, ['afternoon tea', 'high tea', 'cream tea', 'scones'])]
      : []),
    entry('When do you serve breakfast and food?', foodSentence(a) ?? 'Food is served all day.', ['breakfast', 'lunch', 'kitchen', 'food', 'serving', 'brunch']),
    entry('What milks do you have?', plant.length ? `${list(plant.map((o) => o.name))}${free ? ', at no extra cost' : ''}.` : 'Ask us on the day.', ['milk', 'oat', 'soya', 'soy', 'almond', 'dairy', 'plant', 'vegan']),
    entry('Is anything gluten-free?', "We don't call food gluten-free unless we've tested it: everything is made in one kitchen that uses flour. Some things are made without gluten ingredients; the menu says which.", ['gluten', 'gluten-free', 'coeliac', 'celiac', 'wheat']),
    ...(items.some((i) => /pre-packed/i.test(i.description ?? ''))
      ? [entry('What is in the pre-packed sandwiches?', 'They are packed here and labelled with the full ingredients, allergens in bold.', ['sandwich', 'pre-packed', 'label', 'ingredients'])]
      : []),
    entry('Can I bring my dog?', dogsAnswer(a), ['dog', 'dogs', 'pet', 'assistance']),
    entry('Can I breastfeed in the café?', 'Of course: anywhere you like.', ['breastfeed', 'breastfeeding', 'feed the baby', 'nursing']),
    entry('Are children welcome? Do you have high chairs?', [p.children, a.seating.highchairs ? `We have ${a.seating.highchairs} high chairs.` : '', p.baby_changing ? 'There’s baby changing.' : ''].filter(Boolean).join(' '), ['children', 'kids', 'child', 'high chair', 'highchair', 'baby', 'changing', 'pram', 'buggy']),
    entry('Is it accessible?', p.accessibility, ['wheelchair', 'accessible', 'disabled', 'step', 'step-free', 'toilet', 'access']),
    entry('Is there Wi-Fi? Can I work on my laptop?', `${p.wifi} ${p.laptops}`, ['wifi', 'wi-fi', 'internet', 'laptop', 'work']),
    entry('Is there parking?', p.parking, ['parking', 'car', 'park']),
    entry('Do you take cash and card?', `${a.money.cash ? 'Cash and card' : 'Card only'}, and there’s no extra charge for card. ${a.money.tips}`, ['cash', 'card', 'pay', 'payment', 'contactless', 'tip', 'tips']),
    entry('Can I have some tap water?', p.tap_water ? 'Of course, free.' : 'Ask at the counter.', ['water', 'tap water']),
    entry('Can I bring my own cup?', p.reusable_cups, ['cup', 'reusable', 'keep cup', 'mug']),
    ...(p.hygiene_rating !== null ? [entry('What is your food hygiene rating?', `${p.hygiene_rating} out of 5.`, ['hygiene', 'rating', 'scores on the doors', 'clean'])] : []),
    entry('Do you make cakes to order, or sandwich platters?', 'Not by phone yet: I can take a message and the owner will call back about it.', ['cake to order', 'birthday cake', 'whole cake', 'platter', 'catering', 'office']),
    entry('Can we hire the café?', p.hire, ['hire', 'private', 'party', 'event', 'evening']),
    entry('Are you hiring?', p.careers, ['job', 'jobs', 'hiring', 'work', 'vacancy']),
  ], p.faqs);
}

/** The profile's bookings: the shared tables with walk-in under the size, and afternoon tea at the tables inside. */
function cafeBooking(a: CafeAnswers): NonNullable<TenantProfile['booking']> {
  const booking = compileBooking(a.seating, { reservations: true, windows: bookingWindows(a.hours, LAST_TABLE_BEFORE_CLOSE), deposit: { mode: 'none', amount_pence: 0, min_party: 1 } });
  const table = booking.services[0];
  table.min_party = a.booking.min_party;
  table.walk_in_note = walkInNote(a);
  const t = a.afternoon_tea;
  const windows = t.offered ? teaWindows(a) : [];
  if (windows.length) {
    const tea: BookableService = {
      key: 'afternoon_tea',
      label: 'Afternoon tea',
      kind: 'table',
      slot_minutes: 15,
      duration_rules: [{ max_party: 100, minutes: t.minutes }],
      windows,
      max_party: t.max_party,
      large_party_note: `Afternoon tea is for up to ${t.max_party}: for more, take their name, number, the date and how many, and say the owner will call back.`,
      lead_minutes: a.seating.notice_minutes,
      horizon_days: a.seating.horizon_days,
      price_pence: t.adult_pence,
      description: t.description,
      per_person: { adult_pence: t.adult_pence, child_pence: t.child_pence, child_under: t.child_under },
      notice_days: t.notice_days,
      diet_notice_days: t.diet_notice_days,
      diets: t.diets,
      ...(t.deposit_pence ? { deposit: { min_party: 1, per_person_pence: t.deposit_pence } } : {}),
    };
    booking.services.push(tea);
    // At any table inside that takes bookings: a tea for two at a table for two.
    for (const r of booking.resources) {
      const area = a.seating.areas.find((x) => x.key === r.area);
      if (r.services.includes('table') && area?.kind === 'indoor') r.services.push('afternoon_tea');
    }
  }
  return booking;
}

export function compileCafe(a: CafeAnswers, meta: { slug: string }): TenantProfile {
  return {
    ...baseProfile(a, meta, {
      businessType: 'cafe',
      noun: 'café',
      facts: [
        bookingSentence(a),
        teaSentence(a),
        foodSentence(a),
        [a.policies.accessibility, a.seating.highchairs ? `${a.seating.highchairs} high chairs.` : ''].filter(Boolean).join(' '),
      ],
    }),
    booking: cafeBooking(a),
    knowledge: knowledge(a),
    menu: hasMenu(a.menu) ? compileMenu(a.menu) : undefined,
    policies: {
      dogs: dogsAnswer(a),
      card_payments: "There's no extra charge for paying by card.",
      ...(a.afternoon_tea.offered ? { cancellation: a.afternoon_tea.deposit_pence ? `Afternoon tea's ${pounds(a.afternoon_tea.deposit_pence)} a person deposit is refunded with 48 hours' notice.` : 'Nothing is charged to move or cancel; a day’s notice is kind.' } : {}),
    },
    cafe: {
      busy_times: a.booking.busy_times,
      breakfast_until: a.hours.breakfast_until,
      kitchen_closes_before: a.hours.kitchen_closes_before,
    },
  };
}
