// A barber's answers as a TenantProfile (presets/barber.md §4): the barbers
// as bookable staff with their days, own hours and nicknames, the price list
// as appointments, the deposit and notice said as the owner set them, and
// the answers callers ask for. Times, prices and who's free come only from
// the tools.

import { pounds, type BookableService, type KnowledgeEntry, type Resource, type TenantProfile } from '../../domain/types.ts';
import { spokenTime } from '../../domain/time.ts';
import { baseProfile, entry, mergeFaqs } from '../common/profile.ts';
import { bookingWindows } from '../common/hours.ts';
import { DAY_NAMES } from '../common/validate.ts';
import type { BarberAnswers, ServiceAnswer } from './answers.ts';

const money = (pence: number) => pounds(pence).replace(/\.00$/, '');
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] ?? '');
const price = (s: ServiceAnswer) => `${s.from ? 'from ' : ''}${money(s.price_pence)}`;
const named = (a: BarberAnswers) => a.team.filter((b) => b.name && b.days.length && b.services.length);
const bookable = (a: BarberAnswers) => {
  const done = new Set(named(a).flatMap((b) => b.services));
  return a.services.filter((s) => s.name && done.has(s.key));
};

/** "Marcus, Dan, Jordan and Amira", with what each is known for. */
export function teamSentence(a: BarberAnswers): string {
  const team = named(a);
  if (!team.length) return '';
  const note = (n: string) => `${n[0].toLowerCase()}${n.slice(1).replace(/\.$/, '')}`;
  const full = `Barbers: ${team.map((b) => `${b.name}${b.notes ? ` (${note(b.notes)})` : ''}`).join('; ')}.`;
  if (full.length <= 300) return full;
  // A big team in short: the knowledge entry has who does what, and each name stays bookable.
  const names = `Barbers: ${list(team.map((b) => b.name))}. Who does what: search_knowledge.`;
  return names.length <= 300 ? names : `${team.length} barbers, including ${list(team.slice(0, 3).map((b) => b.name))}. Who does what: search_knowledge.`;
}

/** The deposit and the notice, as callers hear them. */
export function depositSentence(a: BarberAnswers): string {
  const m = a.money;
  const notice = m.notice_hours ? `Free to cancel or move with ${m.notice_hours} hours' notice` : 'Free to cancel or move';
  if (!m.deposit_pence) return `${notice}.`;
  const taken = m.deposit_required
    ? `A ${money(m.deposit_pence)} deposit secures a booking and comes off the price`
    : `A ${money(m.deposit_pence)} deposit is taken when booking if they can, and comes off the price; if not, they pay in the shop`;
  return `${taken}. ${notice}${m.notice_hours ? '; later than that, the deposit is kept' : ''}.`;
}

function bookingSentence(a: BarberAnswers): string {
  return a.booking.walk_ins
    ? 'Appointments by phone, and walk-ins welcome when a chair is free: a booking comes first.'
    : 'By appointment only.';
}

const PAY: Record<BarberAnswers['money']['payment'], string> = {
  phone: 'Paid by card when booking.',
  shop: 'Paid in the shop, cash or card.',
  either: 'Paid in the shop, cash or card, or by card when booking.',
};

export function compileBooking(a: BarberAnswers): NonNullable<TenantProfile['booking']> {
  const b = a.booking;
  const services: BookableService[] = bookable(a).map((s) => ({
    key: s.key,
    label: s.name,
    kind: 'appointment',
    slot_minutes: b.slot_minutes,
    duration_minutes: s.minutes,
    price_pence: s.price_pence,
    ...(s.from ? { price_from: true } : {}),
    ...(s.description ? { description: s.description } : {}),
    windows: bookingWindows(a.hours, s.minutes),
    lead_minutes: b.lead_minutes,
    horizon_days: b.horizon_days,
    ...(a.money.deposit_pence ? { deposit: { flat_pence: a.money.deposit_pence } } : {}),
  }));
  const keys = new Set(services.map((s) => s.key));
  const resources: Resource[] = named(a).map((t) => ({
    key: t.key,
    label: t.name,
    services: t.services.filter((s) => keys.has(s)),
    days: t.days,
    kind: 'staff',
    ...(t.aliases.length ? { aliases: t.aliases } : {}),
    ...(t.hours.length ? { hours: t.hours } : {}),
  }));
  return { services, resources };
}

function knowledge(a: BarberAnswers): KnowledgeEntry[] {
  const p = a.policies;
  const team = named(a);
  const services = bookable(a);
  const textured = team.filter((b) => /afro|textured|curl/i.test(b.notes)).map((b) => b.name);
  const days = (b: (typeof team)[number]) => {
    const own = b.hours.map((h) => `${DAY_NAMES[h.day]} ${spokenTime(h.open)} to ${spokenTime(h.close)}`);
    return `${b.name}: ${list(b.days.map((d) => DAY_NAMES[d]))}${own.length ? ` (${own.join(', ')})` : ''}.`;
  };
  return mergeFaqs([
    entry('How much is a cut? What are your prices?', services.map((s) => `${s.name} ${price(s)} (${s.minutes} minutes)`).join('; ') + '.', ['price', 'prices', 'cost', 'how much', 'fade', 'cut', 'beard', 'shave']),
    ...services.filter((s) => s.description).map((s) => entry(`What is a ${s.name.toLowerCase()}?`, `${s.name}: ${s.description} About ${s.minutes} minutes, ${price(s)}.`, [s.name.toLowerCase(), ...s.name.toLowerCase().split(/\s+/)])),
    entry('Which days does each barber work?', team.map(days).join(' '), ['days', 'working', 'in today', 'when', ...team.map((b) => b.name.toLowerCase())]),
    entry('Who does what?', team.filter((b) => b.notes).map((b) => `${b.name}: ${b.notes.replace(/\.$/, '')}.`).join(' '), ['who', 'specialist', 'best', 'fade', 'shave', 'colour', ...team.map((b) => b.name.toLowerCase())]),
    entry('Can I just walk in?', a.booking.walk_ins ? "Walk-ins are welcome when a chair is free, but bookings come first, so it's worth booking a time." : "We're appointments only, so please book a time.", ['walk in', 'walk-in', 'drop in', 'queue', 'wait']),
    entry('Do you cut kids\' hair?', [a.booking.kids_under ? `Yes: the kids' price is for under-${a.booking.kids_under}s.` : 'Yes.', a.booking.under_16_with_adult ? 'Under-16s come with an adult.' : ''].join(' ').trim(), ['kids', 'children', 'child', 'son', 'daughter', 'boy', 'girl']),
    entry("Do you cut women's hair?", "Yes: the same services at the same prices as anyone, a short back and sides or a fade included.", ['women', "women's", 'ladies', 'girl', 'female', 'short hair']),
    entry('Do you do Afro and textured hair?', textured.length ? `Yes: ${list(textured)} ${textured.length > 1 ? 'specialise' : 'specialises'} in Afro and textured hair.` : 'Yes: any of our barbers.', ['afro', 'textured', 'curly', 'black hair', 'twists', 'waves']),
    entry('Is there a charge for paying by card?', "No: there's no extra charge for paying by card.", ['card', 'surcharge', 'fee', 'contactless', 'cash']),
    entry('What if I need to cancel or move my booking?', depositSentence(a), ['cancel', 'move', 'change', 'deposit', 'refund', 'notice']),
    entry("What if I'm running late?", `Up to ${a.booking.late_grace_minutes} minutes late is fine; later than that we may need to move you to the next free time.`, ['late', 'running late', 'delayed', 'traffic']),
    entry("What if I'm not happy with my cut?", p.fix_days ? `Let us know within ${p.fix_days} days and we'll put it right for free, with the same barber or another.` : 'Let us know and the owner will call you back to put it right.', ['unhappy', 'not happy', 'wrong', 'fix', 'complaint', 'redo']),
    entry('Do I need a skin test for colour?', services.some((s) => s.colour) ? `Yes: a quick skin test at least 48 hours before ${p.skin_test === 'every_time' ? 'every colour, as the dye\'s instructions say' : 'colour, every six months'}. If you've ever reacted to hair dye, we won't colour your hair: speak to your GP or pharmacist.` : "We don't do colour.", ['colour', 'dye', 'grey', 'skin test', 'patch test', 'allergy']),
    entry('Is the shop accessible?', p.access, ['wheelchair', 'access', 'step', 'disabled', 'quiet', 'autism', 'guide dog']),
    entry('Where can I park?', p.parking, ['parking', 'park', 'car']),
    entry('Do you sell products?', p.products, ['products', 'wax', 'clay', 'oil', 'balm', 'buy']),
    entry('Can I tip my barber?', p.tips, ['tip', 'tips', 'tipping']),
    entry('Are you hiring?', p.careers, ['job', 'jobs', 'hiring', 'apprentice', 'apprenticeship', 'work']),
    entry('Do you do home visits?', p.home_visits, ['home', 'visit', 'care home', 'house call']),
  ], p.faqs);
}

export function compileBarber(a: BarberAnswers, meta: { slug: string }): TenantProfile {
  return {
    ...baseProfile(a, meta, { businessType: 'barber', noun: 'barber shop', facts: [teamSentence(a), bookingSentence(a), depositSentence(a), PAY[a.money.payment]] }),
    booking: compileBooking(a),
    knowledge: knowledge(a),
    policies: {
      deposit: depositSentence(a),
      late: `More than ${a.booking.late_grace_minutes} minutes late and the next free time may be offered instead.`,
      card_payments: "There's no extra charge for paying by card.",
    },
    barber: {
      notice_hours: a.money.notice_hours,
      deposit_required: a.money.deposit_required,
      late_grace_minutes: a.booking.late_grace_minutes,
      group_max: a.booking.group_max,
      walk_ins: a.booking.walk_ins,
      kids_under: a.booking.kids_under,
      under_16_with_adult: a.booking.under_16_with_adult,
      skin_test: a.policies.skin_test,
    },
  };
}
