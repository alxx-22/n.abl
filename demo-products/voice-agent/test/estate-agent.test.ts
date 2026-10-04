// The estate agent preset, M1 (presets/estate-agent.md): its answers, the
// compiled profile field by field, validation, the listing words built in
// code, the availability rules a viewing adds, and the seeded fortnight.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAvailability, checkSlot, findService, type BusyInterval } from '../src/domain/availability.ts';
import {
  addWorkingDays, checkSays, districtsIn, facts, findListings, initialLive, isWorkingDay, leaseYears, listingSummary, matches, numberWords, offerTimer, positionBadges,
  priceWords, queryTokens, requirementsIn, sayFirst, similar, unsaid, viewingRule, viewingRules,
} from '../src/domain/listings.ts';
import { toLocal, weekdayOf } from '../src/domain/time.ts';
import type { Listing, TenantProfile } from '../src/domain/types.ts';
import { answersOf, builtPreset, getPreset } from '../src/presets/index.ts';
import { defaultAnswers, type EstateAnswers } from '../src/presets/estate/answers.ts';
import { compileEstate, compileListing, patchSentence, weekWords } from '../src/presets/estate/compile.ts';
import { featured } from '../src/presets/estate/featured.ts';
import { sampleListings } from '../src/presets/estate/listings.ts';
import { estatePreview, estateWorkspace, factSheet } from '../src/presets/estate/preset.ts';
import { sanitiseEstate } from '../src/presets/estate/sanitise.ts';
import { PERSONAS, planEstateSeed } from '../src/presets/estate/seed.ts';
import { STEPS } from '../src/presets/estate/steps.ts';
import { validateEstate } from '../src/presets/estate/validate.ts';

const named = (): EstateAnswers => {
  const a = defaultAnswers();
  a.basics.name = 'Hartwell & Green';
  return a;
};
const compile = (a: EstateAnswers) => compileEstate(sanitiseEstate(structuredClone(a)), { slug: 'hartwell' });
const home = (p: TenantProfile, key: string) => p.listings!.find((l) => l.key === key)!;
/** Wednesday 7 October 2026, 11am. */
const WEDNESDAY = new Date('2026-10-07T10:00:00Z');
const TODAY = '2026-10-07';

test('estate agent: the defaults compile to a working agency', () => {
  const p = compile(named());
  assert.equal(p.business_type, 'estate_agent');
  assert.match(p.greeting, /Hartwell & Green.*\bAI\b.*demo/);
  assert.deepEqual(p.core_facts, [
    'Hartwell & Green: Independent estate agency, sales only, at 12 High Street, Brackenford BK1 2AB.',
    'Monday to Friday: 9am till 5:30pm. Saturday: 9am till 4pm. Closed Sundays.',
    'Viewings: Monday to Friday 9am till 7pm and Saturday 9am till 4pm. Valuations: Monday to Friday 9am till 6pm and Saturday 9am till 1pm.',
    'We cover Brackenford, Little Haddon and Coldbrook, BK1 to BK5.',
    'Free market appraisals take about an hour.',
    'Gas emergency: call the National Gas Emergency Service on 0800 111 999.',
  ]);
  assert.deepEqual(p.booking!.services.map((s) => [s.key, s.duration_minutes, s.buffer_minutes, s.needs_listing ?? false]), [
    ['viewing', 30, 15, true], ['second_viewing', 45, 15, true], ['valuation', 60, 15, false], ['mortgage', 45, 0, false],
  ]);
  const viewing = p.booking!.services[0];
  assert.deepEqual([viewing.lead_minutes, viewing.horizon_days], [120, 21]);
  assert.deepEqual(viewing.windows, [{ days: [1, 2, 3, 4, 5], first: '09:00', last: '18:30' }, { days: [6], first: '09:00', last: '15:30' }]);
  assert.deepEqual(p.booking!.resources.map((r) => [r.key, r.kind, r.days!.join(''), r.services.join(',')]), [
    ['rachel', 'staff', '12345', ''], ['jess', 'staff', '123456', 'viewing,second_viewing'], ['tom', 'staff', '23456', 'viewing,second_viewing'],
    ['priya', 'staff', '123456', 'valuation'], ['dan', 'staff', '12345', ''], ['mark', 'staff', '24', 'mortgage'],
  ]);
  assert.equal(p.listings!.length, 18);
  assert.equal(home(p, 'albion_41_flat_2').address, 'Flat 2, 41 Albion Road, Brackenford BK2');
  assert.deepEqual(p.team!.map((t) => t.first_name), ['Rachel', 'Jess', 'Tom', 'Priya', 'Dan', 'Mark']);
  assert.equal(p.estate!.offers.buyer_fee, 'Buyers pay £36 including VAT each for ID checks, once an offer is accepted.');
  assert.equal(p.estate!.gas, '0800 111 999');
  assert.equal(p.estate!.valuations.say, "It's free and takes about an hour.");
  assert.equal(p.policies, undefined, 'the agency\'s policies are knowledge, so the prompt lists none');
  assert.equal(p.menu, undefined);
  assert.equal(p.ordering, undefined);
  assert.ok(p.knowledge.some((k) => /explained at your free market appraisal/.test(k.a)), 'fees are explained at the appraisal by default');
  assert.deepEqual(validateEstate(sanitiseEstate(named())), [], 'the defaults and a name are ready to start, with nothing to warn about');
});

test('estate agent: the sample homes are invented, in a made-up town, and every one is an example', () => {
  const homes = sampleListings();
  assert.equal(homes.length, 18);
  assert.ok(homes.every((l) => l.example), 'every sample home is marked as an example');
  assert.ok(homes.every((l) => /^BK[1-5]$/.test(l.district)), 'BK is not a real postcode area');
  assert.ok(homes.every((l) => ['Brackenford', 'Little Haddon', 'Coldbrook'].includes(l.town)));
  const statuses = homes.reduce<Record<string, number>>((n, l) => ((n[l.status] = (n[l.status] ?? 0) + 1), n), {});
  assert.deepEqual(statuses, { available: 11, under_offer: 2, sale_agreed: 2, exchanged: 1, coming_soon: 1, withdrawn: 1 });
  // A town the prospect scans in never moves the sample homes there.
  const a = named();
  a.basics.town = 'Nottingham';
  assert.ok(compile(a).listings!.every((l) => /Brackenford|Little Haddon|Coldbrook/.test(l.address)));
  // Read once, a fresh copy each time.
  homes[0].street = 'Changed';
  assert.equal(sampleListings()[0].street, 'Albion Road');
});

test('estate agent: every builder field changes what it claims to', () => {
  const cases: [string, (a: EstateAnswers) => void, (p: TenantProfile) => boolean][] = [
    ['name', (a) => (a.basics.name = 'Fenn & Co'), (p) => p.name === 'Fenn & Co' && p.greeting.includes('Fenn & Co')],
    ['nation', (a) => (a.patch.nation = 'northern_ireland'), (p) => p.estate!.gas === '0800 002 001' && p.knowledge.some((k) => /domestic rates/.test(k.a)) && !p.knowledge.some((k) => /Land Registry/.test(k.a))],
    ['wales', (a) => (a.patch.nation = 'wales'), (p) => p.knowledge.some((k) => /Land Transaction Tax/.test(k.a))],
    ['districts', (a) => (a.patch.districts = ['BK1', 'BK3']), (p) => p.estate!.districts.join() === 'BK1,BK3' && p.core_facts.some((f) => f.includes('BK1 and BK3'))],
    ['towns', (a) => (a.patch.towns = ['Brackenford']), (p) => p.core_facts.some((f) => f.startsWith('We cover Brackenford, BK1'))],
    ['lettings', (a) => Object.assign(a.patch, { lettings: 'message', lettings_contact: 'rachel' }), (p) => p.estate!.lettings_contact === 'rachel' && p.knowledge.some((k) => /handled by Rachel/.test(k.a))],
    ['office hours', (a) => (a.hours.days[6] = { open: false, services: [] }), (p) => /Closed Saturdays and Sundays|Closed Saturday and Sunday/.test(p.core_facts[1]) && p.booking!.services[3].windows.every((w) => !w.days.includes(6))],
    ['viewing hours', (a) => (a.diary.viewing_days[1].services[0].close = '20:00'), (p) => p.booking!.services[0].windows.some((w) => w.days.includes(1) && w.last === '19:30')],
    ['valuation hours', (a) => (a.diary.valuation_days[6] = { open: false, services: [] }), (p) => p.booking!.services[2].windows.every((w) => !w.days.includes(6)) && p.estate!.valuation_hours.every((h) => !h.days.includes(6))],
    ['out of hours', (a) => (a.diary.out_of_hours_booking = false), (p) => p.estate!.out_of_hours_booking === false],
    ['on call', (a) => (a.diary.on_call = 'dan'), (p) => p.estate!.on_call === 'dan'],
    ['a person', (a) => a.team.push({ key: 'zoe', name: 'Zoe Hart', role: 'negotiator', does: ['viewings'], days: [6], mobile: '07700 900026' }), (p) => p.booking!.resources.some((r) => r.key === 'zoe' && r.days!.join() === '6') && p.team!.some((t) => t.first_name === 'Zoe')],
    ['what they do', (a) => (a.team[0].does = ['valuations']), (p) => p.booking!.resources[0].services.join() === 'valuation'],
    ['their days', (a) => (a.team[1].days = [1, 3]), (p) => p.booking!.resources[1].days!.join() === '1,3'],
    ['a home', (a) => (a.listings[0].price_pence = 17_500_000), (p) => p.listings![0].initial.price_pence === 17_500_000],
    ['viewing length', (a) => (a.viewings.minutes = 45), (p) => p.booking!.services[0].duration_minutes === 45],
    ['second viewing', (a) => (a.viewings.second_minutes = 60), (p) => p.booking!.services[1].duration_minutes === 60],
    ['travel', (a) => (a.viewings.travel_minutes = 20), (p) => p.booking!.services[0].buffer_minutes === 20 && p.booking!.services[2].buffer_minutes === 20],
    ['notice', (a) => (a.viewings.notice_hours = 24), (p) => p.booking!.services[0].lead_minutes === 1440 && p.listings![0].viewing.notice_minutes === 1440],
    ['horizon', (a) => (a.viewings.horizon_days = 14), (p) => p.booking!.services[0].horizon_days === 14],
    ['empty homes any time', (a) => (a.viewings.safety.empty_office_hours_only = false), (p) => !home(p, 'mill_6_bungalow').viewing.first_in_office_hours],
    ['postcode', (a) => (a.viewings.safety.take_postcode = false), (p) => p.estate!.safety.take_postcode === false],
    ['offers as a message', (a) => (a.offers.take = 'message'), (p) => p.estate!.offers.take === 'message'],
    ['no buyer fee', (a) => (a.offers.buyer_fee_pence = 0), (p) => p.estate!.offers.buyer_fee === '' && p.listings!.every((l) => !l.before_offer.length) && p.knowledge.some((k) => k.a === 'No: buyers pay us nothing.')],
    ['ID provider', (a) => (a.offers.id_provider = 'Checkwise'), (p) => p.knowledge.some((k) => k.a.includes('Checkwise'))],
    ['best and final', (a) => (a.offers.best_final = 'Sealed bids by noon.'), (p) => p.estate!.offers.best_final === 'Sealed bids by noon.'],
    ['valuation name', (a) => (a.valuations.name = 'market appraisal'), (p) => p.core_facts.includes('Market appraisals take about an hour, and are free.') && p.booking!.services[2].label === 'market appraisal'],
    ['valuation length', (a) => (a.valuations.minutes = 90), (p) => p.booking!.services[2].duration_minutes === 90 && /an hour and a half/.test(p.estate!.valuations.say)],
    ['RICS', (a) => (a.valuations.rics = { offered: true, fee_pence: 45000, staff: 'priya' }), (p) => p.knowledge.some((k) => /Priya does RICS valuations, for £450/.test(k.a))],
    ['fees quoted', (a) => (a.fees.quote = true), (p) => p.knowledge.some((k) => /1\.2% of the sale price including VAT, on a 12-week sole agency agreement/.test(k.a))],
    ['fixed fee', (a) => Object.assign(a.fees, { quote: true, kind: 'fixed', fixed_pence: 199_500 }), (p) => p.knowledge.some((k) => /Our fee is £1,995 including VAT/.test(k.a))],
    ['marketing', (a) => (a.fees.marketing = ['Rightmove', 'drone photos']), (p) => p.knowledge.some((k) => k.a === 'We list homes on Rightmove, with drone photos.')],
    ['no mortgage partner', (a) => (a.partners.mortgage.on = false), (p) => !p.booking!.services.some((s) => s.key === 'mortgage') && p.estate!.mortgage === null],
    ['conveyancing', (a) => (a.partners.conveyancing = { on: true, statement: 'We work with Brackenford Legal.' }), (p) => p.knowledge.some((k) => k.a === 'We work with Brackenford Legal.')],
    ['redress', (a) => (a.compliance.redress = 'prs'), (p) => p.estate!.redress === 'prs' && p.knowledge.some((k) => /Property Redress Scheme/.test(k.a))],
    ['complaints', (a) => (a.compliance.complaints_handler = 'dan'), (p) => p.estate!.complaints_handler === 'dan' && p.knowledge.some((k) => /Dan will look into it/.test(k.a))],
    ['recording', (a) => (a.compliance.recording = 'Calls are recorded for training.'), (p) => p.knowledge.some((k) => k.a === 'Calls are recorded for training.')],
    ['area guide', (a) => (a.area.faqs = [{ q: 'Is there a cinema?', a: 'Yes, on Mill Lane.' }]), (p) => p.knowledge.some((k) => k.q === 'Is there a cinema?')],
    ['parking', (a) => (a.policies.parking = 'Park on the street.'), (p) => p.knowledge.some((k) => k.a === 'Park on the street.')],
    ['at viewings', (a) => (a.policies.at_viewings = 'Dogs welcome.'), (p) => p.knowledge.some((k) => k.a === 'Dogs welcome.')],
    ['faq', (a) => (a.policies.faqs = [{ q: 'Do you open on bank holidays?', a: 'No.' }]), (p) => p.knowledge.some((k) => k.q === 'Do you open on bank holidays?')],
  ];
  const base = JSON.stringify(compile(named()));
  for (const [what, edit, check] of cases) {
    const a = named();
    edit(a);
    const p = compile(a);
    assert.ok(check(p), what);
    assert.notEqual(JSON.stringify(p), base, `${what} changes the profile`);
  }
});

test('estate agent: a home in code: the lease left on the day, what is said first, and an empty home only as a rule', () => {
  const p = compile(named());
  const flat = home(p, 'albion_41_flat_2');
  assert.equal(leaseYears(flat.lease!.expires, TODAY), 76);
  const first = sayFirst(flat, initialLive(flat, WEDNESDAY), TODAY, WEDNESDAY);
  assert.deepEqual(first.map((x) => x.say), ["It's leasehold, with 76 years left on the lease."]);
  assert.deepEqual(first[0].listen, ['76', 'seventy-six']);
  assert.equal(sayFirst(home(p, 'wharf_house_9'), initialLive(home(p, 'wharf_house_9'), WEDNESDAY), TODAY, WEDNESDAY).filter((x) => /years left/.test(x.say)).length, 0, '112 years is not short');
  // The retirement flat, shared ownership, the concrete house, the connected seller.
  const first_ = (key: string) => sayFirst(home(p, key), initialLive(home(p, key), WEDNESDAY), TODAY, WEDNESDAY).map((x) => x.say).join(' ');
  assert.match(first_('beechwood_court_12'), /event fee: 1% of the sale price/);
  assert.match(first_('beechwood_court_12'), /aged 60 or over/);
  assert.match(first_('heron_18'), /shared ownership with Meadow Homes: you buy a 50% share and pay rent of £458 a month.*8 weeks/);
  assert.match(first_('orchard_7'), /non-standard construction: concrete panel.*cash buyers only/);
  assert.equal(first_('kingfisher_9'), 'The seller is the brother of Tom Bennett, one of our negotiators.');
  assert.deepEqual(home(p, 'kingfisher_9').say_first[0].listen, ['tom']);
  assert.match(first_('wharf_house_9'), /tenant in place/);
  assert.match(first_('copse_lane_19'), /coming soon: first viewings from Monday 12 October/);
  assert.match(first_('kingfisher_3'), /offer has been accepted.*still taking viewings/);
  assert.equal(first_('albion_22'), '', 'nothing to say first about the house');
  // The buyer's fee before any offer.
  assert.deepEqual(flat.before_offer, [{ say: 'Buyers pay £36 including VAT each for ID checks, once an offer is accepted.', listen: ['36', 'thirty-six', 'id'] }]);
  // An empty home is only ever a rule about when to view it.
  const bungalow = home(p, 'mill_6_bungalow');
  assert.equal(bungalow.viewing.rule, 'Viewings any time in our viewing hours. First viewings are in office hours.');
  const said = (x: unknown): string[] => (typeof x === 'string' ? [x] : x && typeof x === 'object' ? Object.values(x).flatMap(said) : []);
  const words = said({ ...bungalow, key: null, viewing: { ...bungalow.viewing, occupied: null } }).join(' | ');
  assert.doesNotMatch(words, /\b(empty|vacant|keys?|key-held)\b/i, 'nothing a tool reads out gives the home away as empty');
  // What isn't in the details is never said as no.
  const house = home(p, 'albion_22');
  assert.deepEqual(house.unknown, ['flooding']);
  assert.equal(house.checks.flooded.says, '');
  assert.equal(house.rooms.find((r) => /box room/.test(r.name))!.size, '', 'the box room is not measured');
  assert.equal(house.viewing.rule, 'Viewings on Saturdays 10am to 1pm and weekday evenings 5pm to 7pm.');
  assert.equal(home(p, 'wharf_house_9').viewing.rule, "Viewings any time in our viewing hours. Viewings need 24 hours' notice.");
  assert.deepEqual(house.links, ['brochure', 'floorplan', 'epc']);
  assert.equal(listingSummary(flat, initialLive(flat, WEDNESDAY), TODAY, 'england'),
    "Flat 2, 41 Albion Road is a two-bedroom flat at a guide price of £185,000. It's leasehold, with 76 years left on the lease. Council tax band B, and the EPC rating is C.");
});

test('estate agent: words for numbers, prices, checks and positions', () => {
  assert.deepEqual([0, 7, 15, 20, 76, 100, 112, 999].map(numberWords), ['zero', 'seven', 'fifteen', 'twenty', 'seventy-six', 'one hundred', 'one hundred and twelve', 'nine hundred and ninety-nine']);
  assert.equal(priceWords(32_500_000, 'offers_over'), 'offers over £325,000');
  assert.equal(priceWords(36_500_000, 'oiro'), 'offers in the region of £365,000');
  assert.equal(priceWords(11_000_000, 'share', 50), '£110,000 for a 50% share');
  assert.equal(priceWords(24_500_050, 'fixed'), '£245,000.50');
  assert.equal(checkSays('parking', 'yes', 'One allocated space.'), 'Parking: one allocated space.');
  assert.equal(checkSays('flooded', 'no', ''), 'The seller says it has never flooded.');
  assert.equal(checkSays('flooded', 'unknown', 'Seller unsure'), '', 'unknown is never said as no');
  assert.equal(checkSays('construction', 'no', 'EWS1 not needed'), 'Non-standard construction: EWS1 not needed.', 'an acronym keeps its capitals');
  assert.equal(leaseYears('2102-12-24', '2102-12-23'), 0);
  assert.equal(leaseYears('2100-06-01', '2026-06-01'), 74);
  assert.equal(leaseYears('2100-06-01', '2026-06-02'), 73);
  assert.equal(leaseYears('', '2026-06-02'), null);
  // "We're cash" with a flat to sell is a chain, never a Cash badge.
  assert.deepEqual(positionBadges({ funding: 'cash', selling: 'not_on_market' }), ['Chain']);
  assert.deepEqual(positionBadges({ funding: 'cash', selling: 'nothing' }), ['Cash']);
  assert.deepEqual(positionBadges({ first_time_buyer: true, selling: 'nothing', funding: 'mortgage_aip' }), ['FTB', 'AIP']);
  assert.equal(viewingRule({ windows: [{ days: [0, 6], from: '10:00', to: '12:00' }], notice_minutes: 120, first_in_office_hours: false }, 120), 'Viewings on weekends 10am to 12 noon.');
});

test('estate agent: working days skip weekends and bank holidays, and an unsent offer turns amber then red', () => {
  assert.equal(addWorkingDays('2026-12-24', 1, 'england'), '2026-12-29', 'Christmas Day and the Boxing Day holiday on the 28th');
  assert.equal(addWorkingDays('2026-10-09', 2, 'england'), '2026-10-13');
  assert.equal(addWorkingDays('2026-07-10', 1, 'northern_ireland'), '2026-07-14', 'the Twelfth falls on a Sunday in 2026, so Monday 13th is the holiday');
  assert.equal(addWorkingDays('2026-07-10', 1, 'england'), '2026-07-13');
  assert.equal(isWorkingDay('2026-03-17', 'northern_ireland'), false);
  assert.equal(isWorkingDay('2026-03-17', 'wales'), true);
  const received = new Date('2026-10-05T09:00:00Z'); // Monday 10am
  const timer = (h: number, status = 'received') => offerTimer({ status, received_at: received }, new Date(received.getTime() + h * 3600000), 'england');
  assert.equal(timer(23), 'fresh');
  assert.equal(timer(24), 'amber');
  assert.equal(timer(47), 'amber');
  assert.equal(timer(48), 'red', 'Wednesday 10am: two working days');
  assert.equal(timer(48, 'sent'), 'done');
  const friday = new Date('2026-10-09T15:00:00Z');
  assert.equal(offerTimer({ status: 'received', received_at: friday }, new Date('2026-10-12T15:00:00Z'), 'england'), 'amber', 'a weekend does not count');
  assert.equal(offerTimer({ status: 'received', received_at: friday }, new Date('2026-10-13T15:00:00Z'), 'england'), 'red');
});

test('estate agent: a viewing keeps to its home\'s own rules, and a person to their working days', () => {
  const p = compile(named());
  const viewing = findService(p, 'viewing')!;
  const house = home(p, 'albion_22');
  const ask = (listing: Listing, date: string, time: string, existing: BusyInterval[] = [], extra: Record<string, unknown> = {}) =>
    checkSlot({ profile: p, serviceKey: 'viewing', date, time, partySize: 1, now: WEDNESDAY, existing, listing: viewingRules(listing, p, 'viewing'), ...extra }, viewing, time);
  // Saturday 10 to 1 and weekday evenings 5 to 7, finishing inside.
  assert.ok(ask(house, '2026-10-10', '10:00'));
  assert.ok(ask(house, '2026-10-10', '12:30'));
  assert.equal(ask(house, '2026-10-10', '12:45'), null, 'would finish after 1pm');
  assert.equal(ask(house, '2026-10-08', '12:00'), null, 'weekdays only in the evening');
  assert.ok(ask(house, '2026-10-08', '18:30'));
  // Notice: the tenanted flat needs a day.
  const tenanted = home(p, 'wharf_house_9');
  assert.equal(ask(tenanted, TODAY, '15:00'), null);
  assert.ok(ask(tenanted, '2026-10-08', '15:00'));
  // Two viewings of one home never overlap, whoever shows them.
  const jess = { id: 'x', resource_key: 'jess', starts_at: new Date('2026-10-10T09:00:00Z'), ends_at: new Date('2026-10-10T09:30:00Z'), buffer_minutes: 15, listing_key: 'albion_22' };
  const at10 = ask(house, '2026-10-10', '10:15', [jess]);
  assert.equal(at10, null, 'Tom is free, but the house is not');
  assert.equal(ask(house, '2026-10-10', '10:30', [jess])?.resource_key, 'tom', 'Jess is still travelling; Tom can');
  // Blocked dates.
  assert.equal(checkSlot({ profile: p, serviceKey: 'viewing', date: '2026-10-10', time: '10:00', partySize: 1, now: WEDNESDAY, existing: [], listing: viewingRules(house, p, 'viewing', { blocked: [{ from: '2026-10-09', to: '2026-10-11' }] }) }, viewing, '10:00'), null);
  // The connected seller's brother never shows it, even when asked for.
  const connected = home(p, 'kingfisher_9');
  assert.equal(ask(connected, '2026-10-10', '10:00')?.resource_key, 'jess');
  assert.equal(ask(connected, '2026-10-10', '10:00', [], { staff: 'tom' }), null);
  // An empty home's first viewings are in office hours; a second viewing need not be.
  const bungalow = home(p, 'mill_6_bungalow');
  assert.equal(ask(bungalow, '2026-10-08', '18:00'), null);
  assert.ok(ask(bungalow, '2026-10-08', '17:00'));
  const second = findService(p, 'second_viewing')!;
  assert.ok(checkSlot({ profile: p, serviceKey: 'second_viewing', date: '2026-10-08', time: '18:00', partySize: 1, now: WEDNESDAY, existing: [], listing: viewingRules(bungalow, p, 'second_viewing') }, second, '18:00'));
  // Tom does not work Mondays: on Monday only Jess shows homes.
  assert.equal(ask(house, '2026-10-12', '17:00', [], { staff: 'tom' }), null);
  assert.equal(ask(house, '2026-10-12', '17:00')?.resource_key, 'jess');
  // Valuations: Priya, with travel kept clear after one.
  const valuation = findService(p, 'valuation')!;
  const busy = [{ id: 'v', resource_key: 'priya', starts_at: new Date('2026-10-08T09:00:00Z'), ends_at: new Date('2026-10-08T10:00:00Z'), buffer_minutes: 15 }];
  const val = (time: string) => checkSlot({ profile: p, serviceKey: 'valuation', date: '2026-10-08', time, partySize: 1, now: WEDNESDAY, existing: busy }, valuation, time);
  assert.equal(val('11:00'), null);
  assert.equal(val('11:15')?.resource_key, 'priya');
});

test('estate agent: the sanitiser bounds hostile input, keeps Scotland out, and is stable', () => {
  const a = sanitiseEstate({
    patch: { nation: 'scotland', districts: ['bk 1', 'BK1', 'not a district', 7], towns: ['  Brackenford ', ''], lettings: 'everything' },
    team: [{ name: 'Jess Morgan', role: 'boss', does: ['viewings', 'magic'], days: [1, 9, 1, 'x'] }, { name: 'Jess Lane', does: [] }, null],
    listings: [{ key: 'Albion Road!', status: 'sold', price_pence: -5, tenure: 'freehold', checks: { flooded: { v: 'maybe' } }, viewing: { windows: [{ days: [6], from: '25:00', to: '24:00' }, { days: [] }] } }, { key: 'albion_road' }],
    viewings: { minutes: 600, notice_hours: -1 },
    offers: { take: 'shout', buyer_fee_pence: 1e9 },
  });
  assert.equal(a.patch.nation, 'england', 'Scotland is not offered');
  assert.deepEqual(a.patch.districts, ['BK1']);
  assert.deepEqual(a.patch.towns, ['Brackenford']);
  assert.equal(a.patch.lettings, 'none');
  assert.deepEqual(a.team.map((t) => [t.key, t.role, t.does.join(), t.days.join()]), [['jess', 'other', 'viewings', '1'], ['jess_2', 'other', '', ''], ['person_3', 'other', '', '']]);
  assert.deepEqual(a.listings.map((l) => l.key), ['albion_road', 'albion_road_2'], 'each key once');
  assert.equal(a.listings[0].status, 'available');
  assert.equal(a.listings[0].price_pence, 0);
  assert.equal(a.listings[0].checks.flooded.v, 'unknown');
  assert.equal(a.listings[0].checks.heating.v, 'unknown', 'a check that never arrived is unknown, not no');
  // A window with no days yet is kept, so the builder never loses one mid-edit; compile leaves it out.
  assert.deepEqual(a.listings[0].viewing.windows, [{ days: [6], from: '09:00', to: '24:00' }, { days: [], from: '09:00', to: '17:00' }]);
  assert.deepEqual(compileListing(a.listings[0], a, []).viewing.windows, [{ days: [6], from: '09:00', to: '24:00' }]);
  assert.equal(a.listings[0].example, false, 'a prospect\'s own home is not an example');
  assert.equal(a.viewings.minutes, 90);
  assert.equal(a.viewings.notice_hours, 0);
  assert.equal(a.offers.take, 'record');
  assert.equal(a.offers.buyer_fee_pence, 100_000);
  assert.deepEqual(sanitiseEstate(structuredClone(a)), a, 'stable');
  // Nothing at all: the defaults' team and homes, as a missing week of hours gets the defaults'.
  const blank = sanitiseEstate({});
  assert.equal(blank.team.length, 6);
  assert.equal(blank.listings.length, 18);
  assert.deepEqual(sanitiseEstate({ team: [], listings: [] }).listings, [], 'an emptied list stays empty');
});

test('estate agent: validation says what is missing, on the step it belongs to', () => {
  const issues = (edit: (a: EstateAnswers) => void) => {
    const a = named();
    edit(a);
    return validateEstate(sanitiseEstate(a)).map((i) => `${i.level} ${i.step}: ${i.message}`);
  };
  assert.deepEqual(issues((a) => (a.team = a.team.filter((t) => t.key !== 'priya'))), ['error team: Someone in the team must do valuations.']);
  assert.ok(issues((a) => a.team.forEach((t) => (t.does = t.does.filter((d) => d !== 'viewings')))).includes('error team: Someone in the team must do viewings.'));
  assert.deepEqual(issues((a) => (a.team[4].days = [])), ['error team: Dan Fletcher works no days: pick at least one.']);
  assert.deepEqual(issues((a) => (a.patch.districts = [])), ['error patch: Add at least one postcode district you cover.']);
  assert.deepEqual(issues((a) => (a.listings[0].negotiator = 'nobody')), ['error listings: Flat 2, 41 Albion Road: choose its negotiator from the team.']);
  assert.deepEqual(issues((a) => (a.listings[0].lease = null)), ['error listings: Flat 2, 41 Albion Road: add the lease details.']);
  assert.deepEqual(issues((a) => a.listings.push({ ...structuredClone(a.listings[1]), key: 'again' })), ['error listings: 22 Albion Road is listed twice.']);
  assert.deepEqual(issues((a) => (a.diary.on_call = 'nobody')), ['error hours: The person on call is not in the team.']);
  assert.deepEqual(issues((a) => (a.diary.on_call = null)), [], 'nobody on call is allowed');
  assert.deepEqual(issues((a) => (a.compliance.complaints_handler = 'nobody')), ['error services: Choose who handles complaints from the team.']);
  assert.deepEqual(issues((a) => (a.compliance.data_lead = '')), ['error services: Choose who leads on data protection from the team.']);
  assert.deepEqual(issues((a) => (a.listings[0].epc = '')), ['warning listings: Flat 2, 41 Albion Road is missing its EPC.']);
  assert.deepEqual(issues((a) => (a.listings[16].epc = '')), [], 'a home coming soon may not have its EPC yet');
  assert.deepEqual(issues((a) => (['flooded', 'broadband', 'mobile', 'parking', 'mining', 'planning'] as const).forEach((k) => (a.listings[2].checks[k].v = 'unknown'))),
    ['warning listings: 14 Larkspur Close has 6 checks still unknown: callers will hear "that isn\'t in the details".']);
  assert.deepEqual(issues((a) => (a.listings[3].personal_interest!.wording = '')), ['warning listings: 9 Kingfisher Way: say how the personal interest is disclosed to buyers.']);
  assert.deepEqual(issues((a) => (a.partners.mortgage.statement = '')), ['warning services: Add the mortgage partner\'s approved sentence, with its FCA status.']);
  assert.deepEqual(issues((a) => Object.assign(a.fees, { quote: true, min_weeks: 0 })), ['warning services: Fees are quoted: add the minimum term of the agreement.']);
  // Viewing hours with no days ticked are left out by compile; with none left, viewings fall back to any time in the viewing hours.
  assert.deepEqual(issues((a) => (a.listings[1].viewing.windows[1].days = [])), ['warning listings: 22 Albion Road: one set of viewing hours has no days ticked, so it is left out.']);
  assert.deepEqual(issues((a) => a.listings[1].viewing.windows.forEach((w) => (w.days = []))),
    ['warning listings: 22 Albion Road: its viewing hours have no days ticked, so viewings can be booked any time in your viewing hours.']);
  const steps = new Set<string>(STEPS.map((s) => s.key));
  for (const i of validateEstate(sanitiseEstate({ team: [], listings: [{}], patch: { districts: [] } }))) assert.ok(steps.has(i.step), i.step);
});

test('estate agent: the builder\'s preview, the fact sheet and the back office', () => {
  const a = sanitiseEstate(named());
  const p = compileEstate(a, { slug: 'hartwell' });
  assert.deepEqual(estatePreview(a, p, WEDNESDAY).lines, [
    "Hello, you're through to Hartwell & Green. I'm the AI assistant on this demo line. How can I help?",
    '18 listings: 11 available, 2 under offer, 2 sale agreed, 1 exchanged, 1 coming soon, 1 withdrawn.',
    'Viewings: 30 minutes, with 15 minutes to travel; Jess and Tom show homes; Priya values.',
    "Flat 2, 41 Albion Road is a two-bedroom flat at a guide price of £185,000. It's leasehold, with 76 years left on the lease. Council tax band B, and the EPC rating is C.",
  ]);
  a.listings[0].epc = '';
  a.listings[1].local_tax = '';
  assert.ok(estatePreview(a, p, WEDNESDAY).lines.includes('2 listings are missing Part A facts.'));
  const sheet = factSheet(a);
  assert.match(sheet, /Team: Rachel \(manager\), Jess \(negotiator: viewings\)/);
  assert.match(sheet, /Fees: explained at the free market appraisal, not on the phone/);
  assert.doesNotMatch(sheet, /Albion/, 'no homes in the fact sheet');
  const spec = estateWorkspace(p);
  assert.deepEqual(spec.views.map((v) => `${v.id}:${v.label}`), ['timeline:Diary', 'properties:Properties', 'offers:Offers', 'messages:Messages', 'calls:Calls']);
  assert.equal(spec.views[0].of, 'staff');
  assert.equal(spec.bookings!.property, true);
  assert.equal(spec.bookings!.allergies, false);
  assert.deepEqual(spec.teamPhones!.map((t) => t.name), ['Rachel', 'Jess', 'Tom', 'Priya', 'Dan', 'Mark']);
  assert.deepEqual(spec.suggestions, [
    'Tell me about the flat on Albion Road.', 'Can I view 22 Albion Road on Saturday at 11?', "What's my house worth? Next door went for four hundred.",
    "I'd like to make an offer on 22 Albion Road.", "I've got a viewing, reference {ref}. Can I move it?",
  ]);
  assert.equal(spec.resetLine, 'viewings, valuations, offers and sales');
  // The story follows the homes: without the Albion Road house, the next one that fits takes its part.
  const fewer = sanitiseEstate(named());
  fewer.listings = fewer.listings.filter((l) => l.key !== 'albion_22');
  const f = featured(compileEstate(fewer, { slug: 'x' }));
  assert.ok(f.house && f.house.key !== 'albion_22' && f.house.initial.status === 'available');
  const preset = builtPreset('estate_agent')!;
  assert.deepEqual(preset.scan.parts, ['identity', 'hours', 'theme'], 'homes are never read from a website');
  assert.equal(getPreset('estate_agent')?.info.key, 'estate_agent', 'live: prospects can pick it');
  assert.deepEqual(answersOf(preset, { version: 1, basics: { name: 'Kept' } }).basics.name, 'Kept');
});

test('estate agent: a website read fills basics, hours and theme, and nothing else', () => {
  const preset = builtPreset('estate_agent')!;
  const a = preset.sanitise(named()) as EstateAnswers;
  const scan = {
    url: 'https://agency.example/', identity: { name: 'Fenn & Co', address: '3 Bridge Street', town: 'Ely', phone: '01353 000000', style: 'Estate agents', logo: null },
    hours: [{ open: false, services: [] }, ...Array.from({ length: 5 }, () => ({ open: true, services: [{ label: 'Open', open: '09:00', close: '17:00' }] })), { open: false, services: [] }],
    theme: { accent: '#112233', primary: '#223344', background: '#ffffff', font_heading: 'Lato', font_body: 'Lato' },
    menu: { categories: [{ key: 'x', label: 'Pizza', items: [] }] }, services: { reservations: true, takeaway: true, delivery_apps: [], providers: [] }, policies: { parking: 'No.' }, faqs: [{ q: 'Q?', a: 'A.' }], signals: [],
  };
  const all = { identity: true, hours: true, menu: true, theme: true, services: true, policies: true };
  const b = preset.sanitise(preset.scan.apply(a, scan as never, all)) as EstateAnswers;
  assert.equal(b.basics.name, 'Fenn & Co');
  assert.equal(b.hours.days[6].open, false);
  assert.equal(b.theme.accent, '#112233');
  assert.deepEqual(b.listings, a.listings, 'homes are never imported');
  assert.equal(b.policies.parking, a.policies.parking);
  assert.deepEqual(b.policies.faqs, []);
  assert.deepEqual(b.sources, { 'basics.name': 'website', 'basics.address': 'website', 'basics.town': 'website', 'basics.phone_display': 'website', 'basics.style': 'guess', 'hours.days': 'website', 'theme.accent': 'website', 'theme.fonts': 'website' });
});

// ── The seeded fortnight ──────────────────────────────────────────────────

const PROFILE = compile(named());
const plan = (now = WEDNESDAY, seed = 7) => planEstateSeed(PROFILE, now, seed);
const busyOf = (bookings: ReturnType<typeof plan>['bookings']): BusyInterval[] =>
  bookings.map((b) => ({ id: b.reference, resource_key: b.resource_key, starts_at: b.starts_at, ends_at: b.ends_at, buffer_minutes: b.buffer_minutes, listing_key: b.listing_key ?? null }));
const localOf = (d: Date) => toLocal(d, 'Europe/London');

test('seed: the busy Saturday gives 11:15 with Jess for "22 Albion Road on Saturday at 11"', () => {
  for (const [now, seed] of [[WEDNESDAY, 7], [WEDNESDAY, 99], [new Date('2026-10-12T08:00:00Z'), 3], [new Date('2026-10-09T16:00:00Z'), 11]] as const) {
    const p = plan(now, seed);
    const saturday = [1, 2, 3, 4, 5, 6, 7].map((d) => localOf(new Date(now.getTime() + d * 86400000)).date).find((d) => weekdayOf(d) === 6)!;
    const on = (time: string) => p.bookings.find((b) => b.listing_key && localOf(b.starts_at).date === saturday && localOf(b.starts_at).time === time);
    assert.equal(on('10:30')?.resource_key, 'jess', 'Jess has a viewing at 10:30');
    assert.equal(on('10:30')?.listing_key, 'riverside_5');
    assert.equal(on('11:00')?.resource_key, 'tom', 'Tom is out at 11');
    assert.equal(on('11:00')?.listing_key, 'mill_31');
    const house = home(PROFILE, 'albion_22');
    const row = p.listings!.find((l) => l.listing_key === 'albion_22');
    const r = checkAvailability({ profile: PROFILE, serviceKey: 'viewing', date: saturday, time: '11:00', partySize: 1, now, existing: busyOf(p.bookings), listing: viewingRules(house, PROFILE, 'viewing', row) });
    assert.equal(r.available, false, 'nothing at 11:00');
    assert.ok(r.alternatives.some((x) => x.time === '11:15'), JSON.stringify(r.alternatives));
    const slot = checkSlot({ profile: PROFILE, serviceKey: 'viewing', date: saturday, time: '11:15', partySize: 1, now, existing: busyOf(p.bookings), listing: viewingRules(house, PROFILE, 'viewing', row) }, findService(PROFILE, 'viewing')!, '11:15');
    assert.equal(slot?.resource_key, 'jess', `11:15 with Jess, started ${now.toISOString()}`);
  }
});

test('seed: Priya keeps her next two working mornings free for a valuation at 10', () => {
  const p = plan();
  const valuation = findService(PROFILE, 'valuation')!;
  for (const date of ['2026-10-08', '2026-10-09']) {
    const slot = checkSlot({ profile: PROFILE, serviceKey: 'valuation', date, time: '10:00', partySize: 1, now: WEDNESDAY, existing: busyOf(p.bookings) }, valuation, '10:00');
    assert.equal(slot?.resource_key, 'priya', date);
  }
  const vals = p.bookings.filter((b) => b.service_key === 'valuation');
  assert.equal(vals.length, 7);
  const done = vals.filter((b) => b.starts_at < WEDNESDAY).map((b) => (b.details as { outcome: string }).outcome).sort();
  assert.deepEqual(done, ['instructed', 'lost', 'thinking']);
  const next = vals.filter((b) => ['2026-10-08', '2026-10-09'].includes(localOf(b.starts_at).date));
  assert.equal(next.length, 2, 'two in the next two working days');
  assert.ok(next.some((b) => (b.details as { capacity: string }).capacity === 'executor'), 'one is an executor');
  assert.ok(vals.some((b) => (b.details as { dual_fee: boolean }).dual_fee && b.starts_at > WEDNESDAY), 'one is already with another agent');
});

test('seed: the best-and-final home always has two different bidders, whatever the seed', () => {
  // The demo's estate API test needs a rival on another phone; the same buyer twice made it fail about 1 run in 40.
  for (let seed = 0; seed < 300; seed++) {
    const p = plan(WEDNESDAY, seed);
    const home = p.listings!.find((l) => l.best_final_at)!;
    const phones = p.offers!.filter((o) => o.listing_key === home.listing_key && ['received', 'sent'].includes(o.status)).map((o) => o.phone);
    assert.equal(new Set(phones).size, 2, `seed ${seed}: ${phones.join(', ')}`);
  }
});

test('seed: offers this week, one waiting too long, three sales, and the people callers can ring as', () => {
  const p = plan();
  const week = p.offers!.filter((o) => o.received_at.getTime() > WEDNESDAY.getTime() - 7 * 86400000);
  assert.equal(week.length, 6, 'six offers this week');
  assert.equal(p.offers!.length, 9);
  assert.deepEqual(p.offers!.map((o) => offerTimer(o, WEDNESDAY, 'england')).filter((t) => t === 'amber' || t === 'red'), ['amber'], 'one offer waiting more than a day');
  const aisha = p.offers!.find((o) => o.phone === PERSONAS.aisha.phone)!;
  assert.deepEqual([aisha.listing_key, aisha.amount_pence, aisha.status], ['larkspur_14', 28_500_000, 'sent']);
  assert.equal(p.offers!.find((o) => o.phone === PERSONAS.ben.phone)!.status, 'accepted');
  assert.deepEqual(p.sales!.map((s) => [s.listing_key, s.status]), [['kingfisher_3', 'progressing'], ['elm_court_2', 'progressing'], ['willow_gardens_8', 'exchanged']]);
  assert.equal(p.sales![2].completion_date, '2026-10-09', 'completes in two working days');
  assert.ok(p.sales![1].parties.some((x) => x.phone === PERSONAS.solicitor.phone && x.role === 'buyer_solicitor'));
  assert.ok(p.sales![1].parties.some((x) => x.phone === PERSONAS.chainAgent.phone));
  const rows = p.listings!;
  assert.equal(rows.length, 18);
  assert.deepEqual(rows.find((r) => r.listing_key === 'larkspur_14')!.sellers, [{ name: 'Sarah Collins', phone: PERSONAS.seller.phone }]);
  const bestFinal = rows.find((r) => r.listing_key === 'mill_31')!.best_final_at!;
  assert.deepEqual([weekdayOf(localOf(bestFinal).date), localOf(bestFinal).time, localOf(bestFinal).date], [5, '12:00', '2026-10-09']);
  assert.equal(rows.find((r) => r.listing_key === 'elm_court_2')!.marketing_continues, false);
  assert.deepEqual(rows.find((r) => r.listing_key === 'fernbank_11')!.history.map((h) => h.what), ['on the market', 'reduced from 225000 to 215000']);
  // Sam viewed the seller's home two days ago, awaits feedback, and has a viewing tomorrow confirmed by text.
  const sam = p.bookings.filter((b) => b.phone === PERSONAS.sam.phone);
  assert.ok(sam.some((b) => b.listing_key === 'larkspur_14' && b.starts_at < WEDNESDAY && (b.details as { awaiting_feedback?: boolean }).awaiting_feedback));
  assert.ok(sam.some((b) => localOf(b.starts_at).date === '2026-10-08'));
  assert.ok(p.texts!.some((t) => t.to === PERSONAS.sam.phone && /viewing booked, Thursday .* Ref [A-Z]{2}\d{3}\..*\(Demo\)$/.test(t.body)));
  assert.deepEqual(p.texts!.filter((t) => t.to === PERSONAS.aisha.phone).map((t) => /received your offer/.test(t.body) ? 'received' : /put to the seller/.test(t.body) ? 'sent' : '?'), ['received', 'sent']);
  // The seller's week: feedback in their own words, nine viewings since launch, two on the next viewing day.
  const larkspur = p.bookings.filter((b) => b.listing_key === 'larkspur_14');
  const words = larkspur.map((b) => (b.details as { feedback?: { words: string } }).feedback?.words).filter(Boolean);
  assert.ok(words.includes('Loved the garden; the kitchen feels dated.') && words.includes('Price feels high for the size.'));
  assert.equal(larkspur.filter((b) => b.starts_at < WEDNESDAY).length, 9);
  assert.equal(larkspur.filter((b) => localOf(b.starts_at).date === '2026-10-08').length, 2);
  // Nine messages, each for someone, about something.
  assert.equal(p.messages.length, 9);
  assert.ok(p.messages.every((m) => m.for_staff && m.category && m.urgency));
  const complaint = p.messages.find((m) => m.category === 'complaint')!;
  assert.match(complaint.reference!, /^[A-Z]{2}\d{3}$/);
  assert.ok((complaint.details as { final_by: string }).final_by > TODAY);
  assert.ok(p.messages.some((m) => m.from_phone === PERSONAS.megan.phone && /Zoopla/.test(m.body)));
  // Nobody invented shares a name with the team, and every number is in the drama range.
  const staff = new Set(PROFILE.team!.map((t) => t.first_name));
  for (const who of [...p.bookings.map((b) => b.name), ...p.people!.map((x) => x.name ?? ''), ...p.offers!.flatMap((o) => o.buyer_names)]) assert.ok(!staff.has(who.split(' ')[0]), who);
  for (const phone of [...p.bookings.map((b) => b.phone), ...p.people!.map((x) => x.phone)]) assert.match(phone, /^\+447700900\d{3}$/);
  const randomPhones = p.people!.map((x) => x.phone).filter((x) => !Object.values(PERSONAS).some((q) => q.phone === x));
  assert.ok(randomPhones.every((x) => Number(x.slice(-3)) >= 30), 'random numbers start at 900030');
  assert.ok(p.people!.length >= 40, `${p.people!.length} people the agency knows`);
  assert.ok(p.people!.some((x) => x.details.investor));
  assert.ok(p.people!.find((x) => x.phone === PERSONAS.sam.phone)!.details.tried_to_call?.by === 'tom');
  assert.deepEqual(p.people!.find((x) => x.details.backup_for)?.details.backup_for, ['kingfisher_3']);
});

test('seed: a full fortnight, none on Sundays, the same for the same seed', () => {
  const p = plan();
  const viewings = p.bookings.filter((b) => b.listing_key);
  const lastWeek = viewings.filter((b) => b.starts_at < WEDNESDAY && b.starts_at.getTime() > WEDNESDAY.getTime() - 7 * 86400000);
  const ahead = viewings.filter((b) => b.starts_at >= WEDNESDAY);
  assert.ok(lastWeek.length >= 10 && lastWeek.length <= 20, `${lastWeek.length} in the week gone`);
  assert.ok(ahead.length >= 20 && ahead.length <= 35, `${ahead.length} in the nine days ahead`);
  assert.ok(viewings.every((b) => weekdayOf(localOf(b.starts_at).date) !== 0), 'none on a Sunday');
  assert.ok(viewings.some((b) => b.service_key === 'second_viewing'));
  assert.ok(viewings.some((b) => localOf(b.starts_at).date === TODAY && b.starts_at > WEDNESDAY), 'one later today');
  assert.equal(viewings.filter((b) => b.visit_status === 'no_show').length, 1);
  const past = viewings.filter((b) => b.ends_at < WEDNESDAY && b.visit_status === 'finished');
  const withFeedback = past.filter((b) => (b.details as { feedback?: unknown }).feedback).length;
  assert.ok(withFeedback / past.length > 0.5, `${withFeedback} of ${past.length} with feedback`);
  // No viewing of a home that cannot be viewed; the bungalow's are in office hours; badges from the position.
  const off = new Set(['exchanged', 'withdrawn']);
  assert.ok(viewings.every((b) => !off.has(home(PROFILE, b.listing_key!).initial.status)));
  assert.ok(viewings.filter((b) => b.listing_key === 'copse_lane_19').every((b) => localOf(b.starts_at).date >= '2026-10-12'), 'coming soon until Monday');
  for (const b of viewings.filter((x) => x.listing_key === 'mill_6_bungalow')) assert.ok((b.details as { badges: string[] }).badges.includes('ID check'));
  // The house keeps a weekday evening free for callers.
  assert.equal(viewings.filter((b) => b.listing_key === 'albion_22' && localOf(b.starts_at).date === '2026-10-08').length, 0);
  assert.deepEqual(plan(), p, 'the same seed plans the same fortnight');
  assert.notDeepEqual(plan(WEDNESDAY, 8).bookings.map((b) => b.reference), p.bookings.map((b) => b.reference));
});

// ── Finding homes from what callers say (presets/estate-agent.md §4.2) ────

const FINDABLE = compile(named()).listings!.map((l) => ({ listing: l, price_pence: l.initial.price_pence, status: l.initial.status }));
const found = (words: string) => findListings(FINDABLE, words).map((l) => l.key);

test('finding homes: two on one street come back together, so the receptionist asks which', () => {
  assert.deepEqual(found('the one on Albion Road').sort(), ['albion_22', 'albion_41_flat_2']);
  assert.deepEqual(found('Albany Road').sort(), ['albion_22', 'albion_41_flat_2'], 'misheard, it still sounds like Albion');
  assert.deepEqual(found('Mill Road').sort(), ['mill_31', 'mill_6_bungalow'], 'the wrong kind of street still finds the right street');
  assert.deepEqual(found('the flat on Albion Road'), ['albion_41_flat_2'], 'the kind of home narrows it');
  assert.deepEqual(found('the house on Albion Road'), ['albion_22']);
  assert.deepEqual(found('the three-bed on Mill Lane'), ['mill_31']);
  assert.deepEqual(found('the bungalow on Mill Lane'), ['mill_6_bungalow']);
  assert.deepEqual(found('Wharf House'), ['wharf_house_9'], 'a building\'s name is not a kind of home');
});

test('finding homes: numbers as figures or words, misheard numbers, references and prices', () => {
  assert.deepEqual(found('22 Albion Road'), ['albion_22']);
  assert.deepEqual(found('twenty-two Albion'), ['albion_22']);
  assert.deepEqual(found('41 Albion Road'), ['albion_41_flat_2']);
  assert.deepEqual(found('forty Larkspur Close'), ['larkspur_14'], '40 is easily misheard for 14');
  assert.deepEqual(found('nine Kingfisher Way'), ['kingfisher_9']);
  assert.deepEqual(found('HG102'), ['albion_22']);
  assert.deepEqual(found('h g one oh two'), ['albion_22'], 'a reference read a character at a time');
  assert.deepEqual(found('the one at 325'), ['albion_22']);
  assert.deepEqual(found('the one at three hundred and twenty-five thousand'), ['albion_22']);
  assert.deepEqual(found('12 Hawthorn Way'), [], 'not one of ours');
  assert.deepEqual(found('three bed house with a garden'), [], 'a description is a search, not an address');
  assert.deepEqual(queryTokens('bravo kilo two, £325k'), ['b', 'k', '2', '325000']);
  assert.deepEqual(districtsIn('bravo kilo two or BK 3', ['BK1', 'BK2', 'BK3']), ['BK2', 'BK3']);
});

test('finding homes: what a buyer wants, and two homes like one that has gone', () => {
  const places = { districts: ['BK1', 'BK2', 'BK3', 'BK4', 'BK5'], towns: ['Brackenford', 'Little Haddon', 'Coldbrook'] };
  assert.deepEqual(requirementsIn('a three-bed house with a garden in Coldbrook or bravo kilo two, under 350', places), {
    min_beds: 3, max_price_pence: 35000000, types: ['house'], areas: ['BK2', 'Coldbrook'], must_haves: ['garden'],
  });
  assert.deepEqual(requirementsIn('anything with no chain, two bedrooms', places), { min_beds: 2, must_haves: ['no chain'] });
  const fit = matches({ max_price_pence: 35000000, min_beds: 3, areas: ['BK2', 'BK3'], must_haves: ['garden'] }, FINDABLE);
  assert.ok(fit.length >= 2, fit.map((l) => l.key).join());
  for (const l of fit) {
    assert.ok(['BK2', 'BK3'].includes(l.district) && l.beds >= 3 && l.features.some((f) => /garden/.test(f)), l.key);
    assert.ok(['available', 'under_offer'].includes(l.initial.status), `${l.key} is for sale`);
  }
  assert.ok(matches({ types: ['flat'] }, FINDABLE).every((l) => l.type === 'flat'));
  assert.deepEqual(matches({ min_beds: 9 }, FINDABLE), []);
  const gone = FINDABLE.find((h) => h.listing.key === 'meadow_view_10')!.listing;
  const like = similar(gone, FINDABLE);
  assert.equal(like.length, 2);
  for (const l of like) assert.ok(l.type !== 'flat' && FINDABLE.find((h) => h.listing.key === l.key)!.status === 'available', l.key);
});

test('a home\'s facts: short words, unknowns named and never said as no, nothing being checked', () => {
  const p = compile(named());
  const house = home(p, 'albion_22');
  const f = facts(house, { checking: [] }, TODAY, 'england');
  assert.deepEqual(f.unknown, ['flooding']);
  assert.equal(f.facts.flooded, undefined, 'flooding unknown is not a fact');
  assert.equal(f.facts.tenure, 'freehold');
  assert.equal(f.facts.council_tax, 'band C');
  assert.match(f.facts.rooms, /Bedroom 3 \(box room\) not measured/);
  assert.match(f.facts.none, /No restrictive covenants, .* or alterations declared\./);
  assert.equal(f.facts.parking, 'driveway for two cars and a single garage.');
  const flat = facts(home(p, 'albion_41_flat_2'), { checking: [] }, TODAY, 'england');
  assert.equal(flat.facts.tenure, 'leasehold, with 76 years left on the lease');
  assert.match(flat.facts.service_charge, /£1,320 a year/);
  assert.match(flat.facts.ground_rent, /£250 a year, doubling every 25 years/);
  const checking = facts(house, { checking: ['parking', 'rooms'] }, TODAY, 'england');
  assert.equal(checking.facts.parking, undefined);
  assert.equal(checking.facts.rooms, undefined);
  assert.deepEqual(checking.being_checked, ['parking', 'the room sizes']);
  // The main facts too: none is stated while staff check it.
  const main = facts(home(p, 'albion_41_flat_2'), { checking: ['tenure', 'local_tax', 'epc'] }, TODAY, 'england');
  for (const k of ['tenure', 'service_charge', 'ground_rent', 'council_tax', 'epc']) assert.equal(main.facts[k], undefined, k);
  assert.deepEqual(main.being_checked, ['the tenure', 'the council tax band', 'the EPC rating']);
  // The lease being checked: the tenure is said without the years left, which are the lease's.
  const lease = facts(home(p, 'albion_41_flat_2'), { checking: ['lease'] }, TODAY, 'england');
  assert.equal(lease.facts.tenure, 'leasehold');
  assert.equal(lease.facts.service_charge, undefined);
  // An owner's note that gives away an empty home never leaves the facts.
  const noted = structuredClone(house);
  noted.checks.parking = { v: 'yes', says: 'Parking: keys for the garage are in the office.' };
  assert.equal(facts(noted, { checking: [] }, TODAY, 'england').facts.parking, undefined);
});

test('the disclosure check hears a line said in figures or words, and nothing else', () => {
  const p = compile(named());
  const flat = home(p, 'albion_41_flat_2');
  const lines = sayFirst(flat, initialLive(flat, WEDNESDAY), TODAY, WEDNESDAY);
  assert.equal(unsaid(lines, []).length, 1);
  assert.deepEqual(unsaid(lines, ["It's leasehold, with seventy six years left."]), []);
  assert.deepEqual(unsaid(lines, ['Seventy-six years are left on the lease.']), []);
  assert.deepEqual(unsaid(lines, ['It has 76 years left.']), []);
  assert.equal(unsaid(lines, ["It's a lovely flat, guide price £185,000."]).length, 1);
  assert.deepEqual(unsaid(flat.before_offer, ['Buyers pay thirty-six pounds each for ID checks.']), []);
  assert.equal(unsaid(flat.before_offer, ["I'd like to take your offer."]).length, 1);
});

test('a leftover shared-ownership block is never read out for a home that is no longer one', () => {
  const a = sanitiseEstate(named());
  const flat = structuredClone(a.listings.find((l) => l.key === 'albion_41_flat_2')!);
  flat.lease!.shared = { share_percent: 50, rent_pence_month: 0, provider: '', eligibility: '', nomination_weeks: 0 };
  const compiled = compileListing(flat, a, []);
  assert.equal(compiled.lease?.shared, null, 'leasehold: no share');
  assert.ok(!compiled.say_first.some((i) => /shared ownership/i.test(i.say)));
  flat.tenure = 'shared_ownership';
  assert.ok(compileListing(flat, a, []).lease?.shared, 'shared ownership keeps it');
  // Rooms, questions and up-front lines still being written are left out of what the receptionist reads.
  flat.tenure = 'leasehold';
  flat.rooms.push({ name: '', size: '3m x 2m' });
  flat.say_up_front.push('');
  assert.ok(compileListing(flat, a, []).rooms.every((r) => r.name));
  assert.ok(compileListing(flat, a, []).say_first.every((i) => i.say.trim()));
});

test("the prompt's areas and viewing times stay short however the agency fills them in; the searchable answer keeps everything", () => {
  const a = defaultAnswers();
  a.patch.towns = ['Brackenford', 'Little Haddon', 'Coldbrook', 'Pentre', 'Aberllyn', 'Hatherleigh', 'Wickham'];
  assert.match(patchSentence(a, 6), /Aberllyn, Hatherleigh and one more town or village, BK1 to BK5\.$/);
  assert.match(patchSentence(a), /Hatherleigh and Wickham, BK1 to BK5\.$/);
  a.patch.towns = Array.from({ length: 8 }, (_, i) => `Town ${i} ${'long '.repeat(10).trim()}`);
  a.patch.districts = ['BK1', 'BK3', 'BK5', 'BK7', 'BK9', 'BK11', 'BK13', 'BK15'];
  assert.equal(patchSentence(a, 6), `We cover ${a.patch.towns[0]}, ${a.patch.towns[1]} and 6 more towns and villages, BK1, BK3, BK5, BK7, BK9, BK11 and 2 more districts.`);
  assert.match(patchSentence(a), /BK13 and BK15\.$/);
  // Three periods a day, different every day: the days alone, and the tool for the times.
  const week = a.diary.viewing_days.map((d, i) => ({ open: i !== 0, services: [0, 1, 2].map((k) => ({ label: 'Viewings', open: `${9 + k * 3}:0${i}`, close: `${10 + k * 3}:30` })) }));
  assert.equal(weekWords(week, 160), 'Monday to Saturday, at set times (check_availability has them)');
  assert.equal(weekWords(a.diary.viewing_days, 160), weekWords(a.diary.viewing_days));
});
