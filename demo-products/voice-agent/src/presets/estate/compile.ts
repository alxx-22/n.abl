// Estate agent answers → the receptionist's profile (presets/estate-agent.md
// §4.1). Pure: the same answers always make the same profile. It writes the
// three fields only this preset writes (listings, team, estate), and the
// staff and listing switches on the booking (Resource.days and kind,
// BookableService.needs_listing), so every new behaviour stays off for
// every other kind of business.

import {
  CHECKS, buyerFeeSentence, checkSays, fixedSayFirst, homeWords, poundsWhole, sayItem, shortAddress, viewingRule,
} from '../../domain/listings.ts';
import { CHECK_KEYS, type BookableService, type EstateSettings, type KnowledgeEntry, type Listing, type Resource, type StaffMember, type TenantProfile } from '../../domain/types.ts';
import { spokenTime } from '../../domain/time.ts';
import { bookingWindows, dayRange, openingHours } from '../common/hours.ts';
import { baseProfile, entry, greetingFor as greetingOf, mergeFaqs } from '../common/profile.ts';
import type { DayHours } from '../common/types.ts';
import type { EstateAnswers, StaffAnswer } from './answers.ts';
import type { ListingAnswer } from './listings.ts';
import { NATION_PACKS, gasFact, nationKnowledge, officialSources } from './nations.ts';

export const NOUN = 'estate agency';

export const greetingFor = (a: EstateAnswers): string => greetingOf(a.basics, NOUN);

export const firstName = (t: Pick<StaffAnswer, 'name' | 'key'>) => t.name.trim().split(/\s+/)[0] || t.key;

/** A first name for a staff key, or '' for nobody. */
export const nameOf = (a: Pick<EstateAnswers, 'team'>, k: string | null | undefined) => {
  const t = a.team.find((x) => x.key === k);
  return t ? firstName(t) : '';
};

/** "an hour", "half an hour", "45 minutes". */
export function durationWords(minutes: number): string {
  if (minutes === 30) return 'half an hour';
  if (minutes === 60) return 'an hour';
  if (minutes === 90) return 'an hour and a half';
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

/** "Monday to Friday 9am till 7pm, and Saturday 9am till 4pm". */
export function daysWords(days: DayHours[]): string {
  const spans = openingHours({ days }).map((h) => `${dayRange(h.days)} ${spokenTime(h.open)} till ${spokenTime(h.close)}`);
  return spans.length > 1 ? `${spans.slice(0, -1).join(', ')} and ${spans.at(-1)}` : spans[0] ?? 'by arrangement';
}

/** daysWords, or past `max` characters the days alone: check_availability has the times. */
export function weekWords(days: DayHours[], max = Infinity): string {
  const full = daysWords(days);
  if (full.length <= max) return full;
  const open = days.map((d, i) => (d.open && d.services.length ? i : -1)).filter((i) => i >= 0);
  return `${dayRange(open).replace(/^Every/, 'every')}, at set times (check_availability has them)`;
}

const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] ?? '');

/** "BK1 to BK5" when they run in order, else listed: past `most`, the rest counted. */
export function districtWords(districts: string[], most = Infinity): string {
  const m = districts.map((d) => /^([A-Z]+)(\d+)$/.exec(d));
  const run = districts.length > 2 && m.every((x, i) => x && x[1] === m[0]![1] && Number(x[2]) === Number(m[0]![2]) + i);
  if (run) return `${districts[0]} to ${districts.at(-1)}`;
  const more = districts.length - most;
  return more > 0 ? and([...districts.slice(0, most), `${more} more district${more === 1 ? '' : 's'}`]) : and(districts);
}

/** Towns named while they fit in `chars` (always one), up to `most`. */
function namedTowns(towns: string[], most: number, chars: number): string[] {
  const out: string[] = [];
  for (const t of towns) {
    if (out.length >= most || (out.length && [...out, t].join(', ').length > chars)) break;
    out.push(t);
  }
  return out;
}

/**
 * "We cover Brackenford, Little Haddon and Coldbrook, BK1 to BK5." With
 * `most`, the prompt's core fact names that many towns and districts (fewer
 * towns when the names are long) and counts the rest, so twenty long town
 * names and thirty districts cannot push it past its size; the searchable
 * answer lists them all.
 */
export function patchSentence(a: EstateAnswers, most = Infinity): string {
  const all = a.patch.towns;
  const named = Number.isFinite(most) ? namedTowns(all, most, 140) : all;
  const more = all.length - named.length;
  const where = and(more ? [...named, more === 1 ? 'one more town or village' : `${more} more towns and villages`] : named);
  const districts = districtWords(a.patch.districts, most);
  if (!where && !districts) return '';
  return `We cover ${[where, districts].filter(Boolean).join(', ')}.`;
}

/** "Free market appraisals take about an hour." */
export function appraisalSentence(a: EstateAnswers): string {
  const name = a.valuations.name;
  return `${name[0].toUpperCase()}${name.slice(1)}s take about ${durationWords(a.valuations.minutes)}${/free/i.test(name) ? '' : ', and are free'}.`;
}

export function compileTeam(a: EstateAnswers): StaffMember[] {
  return a.team.map((t) => ({ key: t.key, name: t.name, first_name: firstName(t), role: t.role, does: t.does, days: t.days, mobile: t.mobile }));
}

export function compileSettings(a: EstateAnswers): EstateSettings {
  return {
    nation: a.patch.nation,
    districts: a.patch.districts,
    towns: a.patch.towns,
    lettings: a.patch.lettings,
    lettings_contact: a.patch.lettings === 'message' ? a.patch.lettings_contact || null : null,
    out_of_hours_booking: a.diary.out_of_hours_booking,
    on_call: a.diary.on_call,
    viewing_hours: openingHours({ days: a.diary.viewing_days }),
    valuation_hours: openingHours({ days: a.diary.valuation_days }),
    safety: { ...a.viewings.safety },
    offers: {
      take: a.offers.take,
      buyer_fee_pence: a.offers.buyer_fee_pence,
      buyer_fee: buyerFeeSentence(a.offers.buyer_fee_pence, a.offers.buyer_fee_when),
      id_provider: a.offers.id_provider,
      best_final: a.offers.best_final,
    },
    valuations: {
      name: a.valuations.name,
      minutes: a.valuations.minutes,
      rics: { offered: a.valuations.rics.offered, fee_pence: a.valuations.rics.fee_pence, staff: a.valuations.rics.staff || null },
      say: `It's free and takes about ${durationWords(a.valuations.minutes)}.`,
    },
    mortgage: a.partners.mortgage.on ? { staff: a.partners.mortgage.staff, firm: a.partners.mortgage.firm, statement: a.partners.mortgage.statement } : null,
    gas: NATION_PACKS[a.patch.nation].gas.number,
    official: officialSources(a.patch.nation),
    redress: a.compliance.redress,
    complaints_handler: a.compliance.complaints_handler,
    data_lead: a.compliance.data_lead,
  };
}

/**
 * A home as the tools read it. The checks become sentences; what must be
 * said first is built here, never typed by the model; and whether a home
 * is empty becomes only a rule about when it can be viewed.
 */
export function compileListing(l: ListingAnswer, a: EstateAnswers, team: StaffMember[]): Listing {
  const leased = l.tenure === 'leasehold' || l.tenure === 'share_of_freehold' || l.tenure === 'shared_ownership';
  // A shared-ownership block left over from an earlier tenure is never read out for a home that isn't one.
  const lease = leased && l.lease ? (l.tenure === 'shared_ownership' ? l.lease : { ...l.lease, shared: null }) : null;
  const windows = l.viewing.windows.filter((w) => w.days.length);
  const firstInOffice = l.viewing.occupied === 'vacant' && a.viewings.safety.empty_office_hours_only;
  const notice = Math.max(l.viewing.notice_hours, a.viewings.notice_hours) * 60;
  const fee = buyerFeeSentence(a.offers.buyer_fee_pence, a.offers.buyer_fee_when);
  return {
    key: l.key,
    ref: l.ref,
    number: l.number,
    street: l.street,
    district: l.district,
    town: l.town,
    address: `${shortAddress(l)}, ${[l.town, l.district].filter(Boolean).join(' ')}`.replace(/, $/, ''),
    initial: { status: l.status, price_pence: l.price_pence, qualifier: l.qualifier },
    marketed_days_ago: l.marketed_days_ago,
    reduced: l.reduced,
    back_on_market_days_ago: l.back_on_market_days_ago,
    viewings_from_days: l.status === 'coming_soon' ? l.viewings_from_days : null,
    type: l.type,
    beds: l.beds,
    baths: l.baths,
    receptions: l.receptions,
    home: homeWords(l),
    features: l.features,
    summary: l.summary,
    rooms: l.rooms.filter((r) => r.name),
    tenure: l.tenure,
    lease,
    local_tax: l.local_tax,
    epc: l.epc,
    checks: Object.fromEntries(CHECK_KEYS.map((k) => [k, { v: l.checks[k].v, says: checkSays(k, l.checks[k].v, l.checks[k].note) }])) as Listing['checks'],
    unknown: CHECK_KEYS.filter((k) => l.checks[k].v === 'unknown').map((k) => CHECKS[k].unknown),
    say_first: fixedSayFirst({ lease, checks: l.checks, personal_interest: l.personal_interest, say_up_front: l.say_up_front }, team),
    before_offer: fee ? [sayItem(fee, [Math.round(a.offers.buyer_fee_pence / 100), 'ID'])] : [],
    seller_position: l.seller_position,
    fall_through: l.fall_through,
    viewing: {
      windows,
      notice_minutes: notice,
      occupied: l.viewing.occupied,
      key_held: l.viewing.key_held,
      first_in_office_hours: firstInOffice,
      rule: viewingRule({ windows, notice_minutes: notice, first_in_office_hours: firstInOffice }, a.viewings.notice_hours * 60),
    },
    negotiator: l.negotiator,
    personal_interest: l.personal_interest?.staff ? l.personal_interest : null,
    other_agents: l.other_agents,
    links: (['brochure', 'floorplan', 'video', 'epc'] as const).filter((k) => l.links[k]),
    ...(l.example ? { example: true } : {}),
  };
}

/**
 * Viewings, second viewings and valuations with travel kept clear either
 * side (there are no maps: a booking's buffer keeps the time after it, and
 * the next booking's own buffer the time before), and mortgage appointments
 * in the office when the partner is on.
 */
export function compileBooking(a: EstateAnswers): NonNullable<TenantProfile['booking']> {
  const v = a.viewings;
  const common = { kind: 'appointment' as const, slot_minutes: 15, lead_minutes: v.notice_hours * 60, horizon_days: v.horizon_days };
  const services: BookableService[] = [
    { ...common, key: 'viewing', label: 'viewing', duration_minutes: v.minutes, buffer_minutes: v.travel_minutes, windows: bookingWindows({ days: a.diary.viewing_days }, v.minutes), needs_listing: true },
    { ...common, key: 'second_viewing', label: 'second viewing', duration_minutes: v.second_minutes, buffer_minutes: v.travel_minutes, windows: bookingWindows({ days: a.diary.viewing_days }, v.second_minutes), needs_listing: true },
    { ...common, key: 'valuation', label: a.valuations.name, duration_minutes: a.valuations.minutes, buffer_minutes: v.travel_minutes, windows: bookingWindows({ days: a.diary.valuation_days }, a.valuations.minutes) },
  ];
  const mortgage = a.partners.mortgage.on;
  if (mortgage) services.push({ ...common, key: 'mortgage', label: 'mortgage appointment', duration_minutes: 45, buffer_minutes: 0, windows: bookingWindows(a.hours, 45) });
  const resources: Resource[] = a.team.map((t) => ({
    key: t.key,
    label: t.name || t.key,
    services: [
      ...(t.does.includes('viewings') ? ['viewing', 'second_viewing'] : []),
      ...(t.does.includes('valuations') ? ['valuation'] : []),
      ...(mortgage && t.does.includes('mortgage') ? ['mortgage'] : []),
    ],
    days: t.days,
    kind: 'staff',
  }));
  return { services, resources };
}

function feesAnswer(a: EstateAnswers): string {
  const f = a.fees;
  if (!f.quote) return `Our fees are explained at your ${a.valuations.name} and in writing before you sign anything.`;
  const amount = f.kind === 'percent' ? `${(f.percent_hundredths / 100).toString()}% of the sale price` : poundsWhole(f.fixed_pence);
  const term = f.min_weeks ? `, on a ${f.min_weeks}-week ${f.contract === 'sole_agency' ? 'sole agency' : 'multi-agency'} agreement` : '';
  return `Our fee is ${amount} including VAT${term}. ${f.includes}${f.extras ? ` Also payable: ${f.extras}` : ' There are no other charges.'}`.trim();
}

function marketingAnswer(a: EstateAnswers): string {
  const list = a.fees.marketing;
  if (!list.length) return '';
  const portals = list.filter((m) => /rightmove|zoopla|onthemarket|on the market/i.test(m));
  const rest = list.filter((m) => !portals.includes(m));
  const join = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] ?? '');
  return portals.length ? `We list homes on ${join(portals)}${rest.length ? `, with ${join(rest)}` : ''}.` : `Our marketing includes ${join(rest)}.`;
}

function knowledge(a: EstateAnswers, s: EstateSettings): KnowledgeEntry[] {
  const manager = a.team.find((t) => t.role === 'manager');
  const handler = nameOf(a, a.compliance.complaints_handler) || 'the manager';
  const mortgageStaff = a.team.find((t) => t.key === a.partners.mortgage.staff);
  const redress = a.compliance.redress === 'tpo' ? 'The Property Ombudsman' : 'the Property Redress Scheme';
  const rics = a.valuations.rics;
  return mergeFaqs([
    entry('Which areas do you cover?', patchSentence(a), ['area', 'cover', 'postcode', 'where']),
    entry('Is there parking at your office?', a.policies.parking, ['parking', 'park', 'office']),
    entry('Can I bring my children or my dog to a viewing?', a.policies.at_viewings, ['children', 'kids', 'dog', 'pet', 'viewing']),
    entry('What are your fees?', feesAnswer(a), ['fees', 'fee', 'commission', 'charge', 'cost', 'percent']),
    entry('How would you market my home?', marketingAnswer(a), ['market', 'marketing', 'rightmove', 'zoopla', 'photos', 'advertise']),
    entry('Do buyers pay you anything?', s.offers.buyer_fee ? `${s.offers.buyer_fee} The checks are done by ${s.offers.id_provider || 'our ID check provider'}.` : 'No: buyers pay us nothing.', ['buyer', 'fee', 'pay', 'id check']),
    entry('Is this ID check really from you?', s.offers.id_provider ? `Our ID checks are done by ${s.offers.id_provider}. If you're unsure about a message, call us on a number you already have before you reply.` : '', ['id', 'identity', 'check', 'genuine', 'scam']),
    entry('How does best and final work?', a.offers.best_final, ['best and final', 'sealed bid', 'highest', 'deadline']),
    entry('What do guide price and offers over mean?', 'A guide price is roughly what the seller hopes for; offers over means offers above that figure; offers in the region of means around it; and a fixed price is the asking price.', ['guide', 'offers over', 'region', 'asking price']),
    entry('What is the lowest the seller will take?', "We can't say: only the seller decides, and every offer goes to them. I can take an offer if you'd like to make one.", ['lowest', 'minimum', 'accept', 'take']),
    entry('Is a valuation free?', `Our ${a.valuations.name} is free, with no obligation, and takes about ${durationWords(a.valuations.minutes)}.`, ['valuation', 'appraisal', 'free', 'cost']),
    entry('Do you do RICS valuations?', rics.offered
      ? `Yes: ${nameOf(a, rics.staff) || 'our RICS valuer'} does RICS valuations${rics.fee_pence ? `, for ${poundsWhole(rics.fee_pence)}` : ''}. A free market appraisal is a marketing opinion, not a RICS valuation.`
      : "We don't do RICS valuations. For probate, Help to Buy, staircasing or a divorce you need a RICS Registered Valuer; our free appraisal is a marketing opinion only.",
    ['rics', 'probate', 'help to buy', 'staircasing', 'divorce', 'surveyor', 'valuer']),
    entry('Do you have a mortgage adviser?', a.partners.mortgage.on
      ? `${a.partners.mortgage.statement}${mortgageStaff ? ` ${firstName(mortgageStaff)} sees people on ${dayRange(mortgageStaff.days) || 'set days'}.` : ''}`
      : "We don't have a mortgage adviser; an independent mortgage broker can help.", ['mortgage', 'adviser', 'broker', 'lend', 'lender']),
    entry('Can you recommend a solicitor?', a.partners.conveyancing.on && a.partners.conveyancing.statement
      ? a.partners.conveyancing.statement
      : "You're free to use any solicitor or licensed conveyancer you like.", ['solicitor', 'conveyancer', 'conveyancing', 'lawyer']),
    entry('How do I make a complaint?', `Tell us what went wrong and ${handler} will look into it. We acknowledge a complaint within 3 working days and send a written answer within 15. If you're still unhappy after our final answer, or after 8 weeks, you can go to ${redress}.`, ['complain', 'complaint', 'unhappy', 'ombudsman']),
    entry('Is this call recorded?', a.compliance.recording, ['recorded', 'recording', 'transcribed', 'transcript']),
    entry('Am I talking to a real person?', "I'm an AI assistant answering for the team. If you'd rather speak to a person, I can take a message and someone will call you back.", ['real person', 'robot', 'ai', 'human']),
    entry('Can I see the data you hold about me, or stop your texts?', `${nameOf(a, a.compliance.data_lead) || 'Our data protection lead'} looks after data protection, and we reply to any request within a month. To stop our texts, just say so and we'll stop them.`, ['data', 'gdpr', 'personal information', 'stop texts', 'unsubscribe']),
    entry('Can I cancel my agreement with you?', `If you signed your agreement at home or anywhere away from our office, you usually have 14 days to cancel. For anything else, I can take a message for ${manager ? firstName(manager) : 'the manager'}.`, ['cancel', 'contract', 'agreement', 'tie-in', 'switch']),
    entry('Do you do lettings?', a.patch.lettings === 'message'
      ? `Our lettings are handled by ${nameOf(a, a.patch.lettings_contact) || 'our lettings team'}: I can take a message.`
      : "We're sales only, so we don't let homes; a local letting agent can help.", ['let', 'letting', 'lettings', 'rent', 'rental', 'landlord']),
    ...nationKnowledge(a.patch.nation),
  ], [...a.area.faqs, ...a.policies.faqs].filter((f) => f.q && f.a));
}

export function compileEstate(a: EstateAnswers, meta: { slug: string }): TenantProfile {
  const team = compileTeam(a);
  const estate = compileSettings(a);
  return {
    ...baseProfile(a, meta, {
      businessType: 'estate_agent',
      hoursMax: 200,
      noun: NOUN,
      facts: [
        `Viewings: ${weekWords(a.diary.viewing_days, 160)}. Valuations: ${weekWords(a.diary.valuation_days, 160)}.`,
        patchSentence(a, 6),
        appraisalSentence(a),
        gasFact(a.patch.nation),
      ],
    }),
    knowledge: knowledge(a, estate),
    booking: compileBooking(a),
    listings: a.listings.map((l) => compileListing(l, a, team)),
    team,
    estate,
  };
}
