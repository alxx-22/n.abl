// The estate agent's receptionist (presets/estate-agent.md §4 and §8, M1),
// through runTool on an agency made as a prospect makes it: the builder's
// defaults and a name, compiled through the registry and seeded by its
// preset, on Wednesday 7 October 2026 at 11am. The signature moments: the
// honest listing answer, a viewing booked properly, a valuation with no
// figure, an offer passed on in writing, and the guardrails.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { newCallState, record, runTool, toolDeclarations, unsaidReference, type Action, type ToolContext } from '../src/core/tools.ts';
import { checkUtterance, referencesIn } from '../src/core/guardrails.ts';
import { compilePrompt } from '../src/core/prompt.ts';
import { displayUkPhone } from '../src/domain/phone.ts';
import { toLocal } from '../src/domain/time.ts';
import { knownTimes, rangesIn } from '../src/domain/clock-times.ts';
import { unsaid, viewingRules } from '../src/domain/listings.ts';
import type { Tenant, TenantProfile } from '../src/domain/types.ts';
import { BUILDER_TENANTS, builderTenant } from '../src/eval/scenarios.ts';
import { tenantState } from '../src/server/state.ts';
import type { Bus } from '../src/server/bus.ts';
import { defaultAnswers } from '../src/presets/restaurant/answers.ts';
import { compileRestaurant } from '../src/presets/restaurant/compile.ts';

/** Wednesday 7 October 2026, 11am BST. */
const NOW = new Date('2026-10-07T10:00:00Z');
const THU = '2026-10-08';
const SAT = '2026-10-10';
const TUE = '2026-10-13';
const CALLER = '+447700900123';
const JESS = '+447700900021';
let db: Db;
let repo: Repo;

before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

/** The agency as a prospect makes it, seeded for the fortnight around NOW. */
async function agency(slug: string, edit: (p: TenantProfile) => void = () => {}): Promise<Tenant> {
  const { preset, profile } = builderTenant(BUILDER_TENANTS.find((b) => b.slug === 'ea-hartwell')!);
  edit(profile);
  const t = await repo.upsertTenant({ ...profile, slug });
  await repo.insertSeed(t.id, preset.seed(t.profile, NOW, 7));
  return t;
}

async function call(tenant: Tenant, callerPhone: string | null = CALLER) {
  const actions: Action[] = [];
  const sent: { to: string; body: string }[] = [];
  const state = newCallState();
  // As a call to an estate agency starts (src/core/call.ts).
  state.estate = Boolean(tenant.profile.estate);
  const ctx: ToolContext = {
    tenant, repo, now: () => NOW, callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone,
    state, demoCards: [], sms: { send: async (to, body) => (sent.push({ to, body }), 'simulated') }, telephony: null, action: (x) => actions.push(x),
  };
  /** The receptionist says a line to the caller. */
  const say = (line: string) => ctx.state.said.push(line);
  return { ctx, actions, sent, say, run: (name: string, args: Record<string, unknown>) => runTool(name, args, ctx) };
}

const callMessages = (callId: string) => db.query<any>(`select * from public.voice_messages where call_id = $1 and kind = 'message' order by created_at`, [callId]);

test('estate tools: only an estate agency has them; a viewing names its home and takes the buyer\'s position', async () => {
  const t = await agency('ea-decl');
  const decls = toolDeclarations(t);
  const names = decls.map((d) => d.name);
  for (const n of ['search_properties', 'get_property', 'send_property_details', 'book_valuation', 'record_offer']) assert.ok(names.includes(n), n);
  const props = (name: string) => Object.keys((decls.find((d) => d.name === name)!.parameters as any).properties);
  assert.ok(props('check_availability').includes('property') && props('check_availability').includes('postcode'));
  for (const k of ['property', 'postcode', 'email', 'first_time_buyer', 'selling', 'funding']) assert.ok(props('create_booking').includes(k), k);
  assert.ok(!props('create_booking').includes('party_size'), 'a viewing is for the caller, not a party');
  for (const k of ['for', 'category', 'urgency', 'property']) assert.ok(props('take_message').includes(k), k);
  assert.match(decls.find((d) => d.name === 'get_opening_hours')!.description, /viewing and valuation hours/);

  const a = defaultAnswers();
  a.basics.name = 'Olive & Ember';
  const restaurant = await repo.upsertTenant(compileRestaurant(a, { slug: 'ea-decl-restaurant' }));
  const theirs = toolDeclarations(restaurant);
  assert.ok(!theirs.some((d) => ['search_properties', 'get_property', 'send_property_details', 'book_valuation', 'record_offer'].includes(d.name)));
  const rProps = (name: string) => Object.keys((theirs.find((d) => d.name === name)!.parameters as any).properties);
  assert.ok(!rProps('create_booking').includes('property') && rProps('create_booking').includes('party_size'));
  assert.deepEqual(rProps('take_message'), ['name', 'phone', 'message']);
});

test('the honest listing answer: "the one on Albion Road" asks which; the flat says its short lease first', async () => {
  const t = await agency('ea-albion');
  const { run, ctx } = await call(t);
  const both = await run('search_properties', { query: 'the one on Albion Road' });
  assert.deepEqual((both.matches as any[]).map((m) => m.property).sort(), ['albion_22', 'albion_41_flat_2']);
  assert.equal(both.note, 'More than one: ask which, then get_property.');
  assert.match(JSON.stringify(both.matches), /22 Albion Road: three-bedroom semi-detached house/);
  // No price for a home the caller named: it is said in get_property's describe line, with the council tax band and EPC (a live call, 4 October).
  assert.ok(!JSON.stringify(both.matches).includes('£'), JSON.stringify(both.matches));
  // One home: its details come back with the search, so they are never guessed (live, 6 October: get_property skipped, details invented).
  const named = await run('search_properties', { query: 'the house on Albion Road' });
  assert.deepEqual([(named.matches as unknown[]).length, named.property], [1, 'albion_22']);
  assert.match(String(named.describe), /^22 Albion Road is a three-bedroom semi-detached house/);
  const which = await run('get_property', { property: 'Albion Road' });
  assert.equal(which.facts, undefined, 'no facts until the caller says which');
  assert.equal(which.next, 'More than one: ask which.');
  const times = await run('check_availability', { property: 'Albion Road', date: SAT, time: '11:00' });
  assert.equal(times.next, 'More than one: ask which.');
  assert.equal(times.available, undefined, 'never "not available": no home was checked');
  assert.deepEqual(Object.keys(ctx.state.briefed), ['albion_22'], 'only the house found by name is briefed yet');

  const flat = await run('get_property', { property: 'the flat on Albion Road' });
  assert.equal(flat.property, 'albion_41_flat_2');
  assert.equal(flat.price, 'guide price £185,000');
  assert.deepEqual(flat.say_first, ["It's leasehold, with 76 years left on the lease."]);
  const f = flat.facts as Record<string, string>;
  assert.match(f.service_charge, /£1,320 a year/);
  assert.match(f.ground_rent, /£250 a year, doubling every 25 years/);
  assert.equal(f.council_tax, 'band B');
  assert.equal(f.epc, 'C');
  assert.equal(ctx.state.briefed.albion_41_flat_2, 0);

  const house = await run('get_property', { property: '22 Albion Road' });
  assert.equal(house.price, 'offers over £325,000');
  assert.equal((house.facts as Record<string, string>).tenure, 'freehold');
  assert.deepEqual(Object.keys(house.if_asked as object), ['flooding']);
  // Said as it comes: what isn't known, the official service, and who can find out.
  assert.equal((house.if_asked as Record<string, string>).flooding, "Flooding isn't in the details we have. The Environment Agency's long-term flood risk service on GOV.UK can tell you more. I can ask Jess to find out.");
  assert.match(String(house.note), /the if_asked line, never "no"/);
  assert.match((house.facts as Record<string, string>).rooms, /box room\) not measured/);
  assert.equal(house.negotiator, 'Jess');
  assert.ok(JSON.stringify(house).length < 2150, `kept small: ${JSON.stringify(house).length} characters`);  // A mortgage question about a leasehold home has someone to offer, never an opinion (ea-short-lease, 4 October).
  const leasehold = await run('get_property', { property: '41 Albion Road' });
  assert.equal(leasehold.mortgage_question, "Can't advise: offer Mark, our mortgage adviser, and their solicitor for the lease.");
  assert.equal(house.mortgage_question, undefined);
});

test('get_property never says a seller\'s number, that a home is empty, keys, or why anyone is selling', async () => {
  const t = await agency('ea-private');
  const { run } = await call(t);
  const rows = await repo.listingStates(t.id);
  assert.equal(rows.length, 18);
  for (const l of t.profile.listings!) {
    const out = JSON.stringify(await run('get_property', { property: l.key }));
    const sellers = rows.find((r) => r.listing_key === l.key)!.sellers;
    assert.ok(sellers.length, `${l.key} has a seller on file`);
    for (const s of sellers) {
      assert.ok(!out.includes(s.phone) && !out.includes(displayUkPhone(s.phone)) && !out.includes(s.phone.slice(-6)), `${l.key}: the seller's number`);
      assert.ok(!out.includes(s.name), `${l.key}: the seller's name`);
    }
    assert.doesNotMatch(out, /vacant|\bempty\b|unoccupied|\bkeys?\b|key-?safe/i, l.key);
    assert.doesNotMatch(out, /divorc|separat|probate|\bdied\b|death|debt|repossess|bereave/i, `${l.key}: a reason for selling`);
    assert.doesNotMatch(out, /viewings? (this|last) week|\d+ viewings|offers? of £/i, `${l.key}: no counts or offers for buyers`);
  }
  // The empty, key-held bungalow says only a rule about when it can be viewed.
  const bungalow = await run('get_property', { property: 'the bungalow on Mill Lane' });
  assert.equal(bungalow.viewing, 'Viewings any time in our viewing hours. First viewings are in office hours.');
});

test('the disclosure line: the times come with it, a time said without it is flagged, and the booking waits for it', async () => {
  const t = await agency('ea-gate');
  const FIRST = `Before any of these times, tell the caller: "It's leasehold, with 76 years left on the lease."`;
  {
    // Live, 6 and 8 October: with the times held back until the line was said, they were guessed, again and again.
    const { run, ctx, say } = await call(t);
    await run('get_property', { property: 'albion_41_flat_2' });
    say('Flat 2, 41 Albion Road is a two-bedroom flat at a guide price of £185,000.');
    const r = await run('check_availability', { property: 'albion_41_flat_2', date: SAT, time: '11:00' });
    assert.equal(r.say_first, FIRST);
    assert.ok(r.available || (r.alternatives as unknown[]).length, `real times, with the line: ${JSON.stringify(r)}`);
    assert.equal(r.not_yet, undefined);
    // Held for the turn's end: raised only if a time was said without the line (call.ts).
    assert.deepEqual(ctx.state.toolFlags.map((f) => [f.rule, f.recheck?.ifTimes]), [['disclosure_missed', true]]);
    const flag = ctx.state.toolFlags[0];
    assert.ok(unsaid(flag.recheck!.items, ctx.state.said.slice(flag.recheck!.at)).length, 'still unsaid now');
    say(`Before any times: ${flag.recheck!.items.map((i) => i.say).join(' ')}`);
    assert.equal(unsaid(flag.recheck!.items, ctx.state.said.slice(flag.recheck!.at)).length, 0, 'said in the same turn: not raised');
    const again = await run('check_availability', { property: 'albion_41_flat_2', date: SAT, time: '12:00' });
    assert.equal(again.say_first, undefined, 'said: nothing owed');
    assert.equal(ctx.state.toolFlags.length, 1, 'held once');
  }
  {
    // Looking the home up again keeps what was already said.
    const { run, ctx, say } = await call(t);
    await run('get_property', { property: 'albion_41_flat_2' });
    say("It's leasehold, with seventy-six years left on the lease, and the service charge is £1,320 a year.");
    await run('get_property', { property: 'albion_41_flat_2' });
    const r = await run('check_availability', { property: 'albion_41_flat_2', date: SAT, time: '11:00' });
    assert.equal(r.say_first, undefined);
    assert.deepEqual(ctx.state.toolFlags, []);
  }
  {
    // Asked for times before looking the home up: briefed there and then, with the line and get_property in the answer.
    const { run, ctx, say } = await call(t);
    const first = await run('check_availability', { property: 'the flat on Albion Road', date: SAT, time: '11:00' });
    assert.equal(first.say_first, `Call get_property for it too: its details come from there. ${FIRST}`);
    assert.equal(ctx.state.briefed.albion_41_flat_2, 0);
    say("It's leasehold, with 76 years left on the lease.");
    assert.equal((await run('check_availability', { property: 'the flat on Albion Road', date: SAT, time: '11:00' })).say_first, undefined);
    // A home with nothing to say first has nothing owed.
    assert.equal((await run('check_availability', { property: '22 Albion Road', date: SAT, time: '11:00' })).say_first, undefined);
  }
  {
    // A line said before the briefing does not count: it was not about this home.
    const { run, say } = await call(t);
    say('We have 76 homes on our books.');
    await run('get_property', { property: 'albion_41_flat_2' });
    assert.ok((await run('create_booking', { property: 'albion_41_flat_2', date: SAT, time: '11:00', name: 'Sam Price', postcode: 'BK3 4RT' })).not_yet);
  }
});

test('a viewing booked properly: "Saturday at 11" gives 11:15 with Jess; the buyer\'s position and a valuation offered once', async () => {
  const t = await agency('ea-saturday');
  const { run, ctx, sent, actions } = await call(t);
  await run('get_property', { property: '22 Albion Road' });
  const eleven = await run('check_availability', { property: '22 Albion Road', date: SAT, time: '11:00' });
  assert.equal(eleven.available, false, 'nothing at 11');
  assert.equal(eleven.where, '22 Albion Road');
  const alts = eleven.alternatives as { time: string; with?: string }[];
  assert.ok(alts.some((a) => a.time === '11:15' && a.with === 'Jess'), JSON.stringify(alts));
  assert.doesNotMatch(JSON.stringify(eleven), /Morgan|Bennett/, 'first names only');
  const at11 = await run('create_booking', { property: '22 Albion Road', date: SAT, time: '11:00', name: 'Sam Price', postcode: 'BK3 4RT' });
  assert.equal(at11.booked, false);

  const asked = await run('create_booking', { property: '22 Albion Road', date: SAT, time: '11:15', name: 'Sam Price', selling: 'a flat, not on the market yet', funding: 'mortgage agreed in principle' });
  assert.equal(asked.booked, false, 'the viewer\'s own postcode first');
  assert.match(String(asked.message), /postcode/);
  const booked = await run('create_booking', {
    property: '22 Albion Road', date: SAT, time: '11:15', name: 'Sam Price', postcode: 'bk3 4rt', first_time_buyer: false,
    selling: 'a flat, not on the market yet', funding: 'mortgage agreed in principle', email: 'sam@example.com',
  });
  assert.equal(booked.booked, true, JSON.stringify(booked));
  assert.equal(booked.with, 'Jess');
  assert.equal(booked.where, '22 Albion Road');
  assert.equal(booked.next, 'Offer a free valuation of their own home, once, without pressure.');
  assert.equal(ctx.state.lastBookingRef, booked.reference);
  assert.equal(ctx.state.owed, booked.reference);
  const b = (await repo.getBookingByReference(t.id, String(booked.reference)))!;
  assert.equal(b.listing_key, 'albion_22');
  assert.equal(b.resource_key, 'jess');
  assert.equal(toLocal(b.starts_at, 'Europe/London').time, '11:15');
  const d = b.details as { position: { selling: string; funding: string }; badges: string[]; postcode: string };
  assert.deepEqual(d.position, { first_time_buyer: false, selling: 'not_on_market', funding: 'mortgage_aip' });
  assert.deepEqual(d.badges, ['AIP', 'Chain'], 'not Cash: there is a flat to sell');
  assert.equal(d.postcode, 'BK3 4RT');
  const buyer = (await repo.listBuyers(t.id)).find((x) => x.phone === CALLER)!;
  assert.equal(buyer.details.position?.selling, 'not_on_market');
  assert.equal(buyer.details.email, 'sam@example.com');
  const text = sent.find((s) => s.to === CALLER)!.body;
  assert.equal(text, `Hartwell & Green: viewing booked, Saturday 11:15am at 22 Albion Road, with Jess. Ref ${b.reference}. To change it, call us and quote your reference. (Demo)`);
  assert.match(actions.find((a) => a.kind === 'booking_created')!.detail!, /22 Albion Road · Sam Price with Jess · AIP, Chain/);

  // A second viewing in the same call: the valuation is not offered again.
  await run('get_property', { property: '5 Riverside Walk' });
  const second = await run('create_booking', { property: '5 Riverside Walk', date: TUE, time: '17:30', name: 'Sam Price', postcode: 'BK3 4RT', selling: 'not on the market' });
  assert.equal(second.booked, true, JSON.stringify(second));
  assert.equal(second.next, undefined);

  // "We're cash" with a flat to sell is a chain, never a cash buyer.
  const { run: run2 } = await call(t, '+447700900124');
  await run2('get_property', { property: '5 Riverside Walk' });
  const cash = await run2('create_booking', { property: '5 Riverside Walk', date: TUE, time: '18:15', name: 'Ali Reza', postcode: 'BK1 1AA', funding: 'cash', selling: 'on the market' });
  const cb = (await repo.getBookingByReference(t.id, String(cash.reference)))!;
  assert.deepEqual((cb.details as { badges: string[] }).badges, ['Chain']);
});

test('a viewing moves only within its home\'s rules, and every change is texted', async () => {
  const t = await agency('ea-move');
  const { run, sent } = await call(t);
  await run('get_property', { property: '22 Albion Road' });
  const b = await run('create_booking', { property: '22 Albion Road', date: SAT, time: '11:15', name: 'Sam Price', postcode: 'BK3 4RT' });
  assert.equal(b.booked, true);
  const noon = await run('modify_booking', { reference: b.reference, date: TUE, time: '12:00' });
  assert.equal(noon.changed, false, 'the sellers allow weekday evenings only');
  const evening = await run('modify_booking', { reference: b.reference, date: TUE, time: '17:30' });
  assert.equal(evening.changed, true, JSON.stringify(evening));
  assert.equal(evening.property, '22 Albion Road');
  assert.match(sent.at(-1)!.body, /viewing changed, Tuesday 5:30pm at 22 Albion Road/);
  const found = await run('find_bookings', {});
  assert.equal((found.bookings as any[])[0].property, '22 Albion Road');
  const gone = await run('cancel_booking', { reference: b.reference });
  assert.equal(gone.cancelled, true);
  assert.match(sent.at(-1)!.body, /viewing cancelled, Tuesday 5:30pm at 22 Albion Road, with \w+\. Ref [A-Z]{2}\d{3}\. \(Demo\)$/);
});

test('a viewing on a home withdrawn or sold is never moved to a new day: the caller hears why, and is offered others', async () => {
  const t = await agency('ea-move-gone');
  const { run } = await call(t);
  await run('get_property', { property: '22 Albion Road' });
  const b = await run('create_booking', { property: '22 Albion Road', date: SAT, time: '11:15', name: 'Sam Price', postcode: 'BK3 4RT' });
  assert.equal(b.booked, true);
  for (const [live, words] of [[{ status: 'withdrawn' }, "It's no longer on the market."], [{ status: 'exchanged' }, "It's sold."], [{ status: 'sale_agreed', marketing_continues: false }, /isn't taking more viewings/]] as const) {
    await repo.setListing(t.id, 'albion_22', live);
    const moved = await run('modify_booking', { reference: b.reference, date: TUE, time: '17:30' });
    assert.equal(moved.changed, false, JSON.stringify(moved));
    if (typeof words === 'string') assert.equal(moved.message, words);
    else assert.match(String(moved.message), words);
    assert.ok((moved.similar as unknown[]).length > 0);
    assert.match(String(moved.next), /cancel_booking/);
  }
  assert.equal((await repo.getBookingByReference(t.id, String(b.reference)))!.starts_at.toISOString().slice(0, 10), SAT, 'still on its day, never moved');
});

test('status first: off the market offers two others, a sale agreed is said before any times, coming soon gives its first day', async () => {
  const t = await agency('ea-status');
  const { run, ctx, say } = await call(t);
  await run('get_property', { property: '10 Meadow View' });
  const gone = await run('check_availability', { property: '10 Meadow View', date: SAT });
  assert.equal(gone.available, false);
  assert.equal(gone.message, "It's no longer on the market.");
  assert.equal((gone.similar as unknown[]).length, 2);

  await repo.setListing(t.id, 'albion_22', { status: 'sale_agreed', marketing_continues: true });
  const agreed = await run('get_property', { property: '22 Albion Road' });
  assert.equal(agreed.status, 'sale agreed, subject to contract');
  assert.match((agreed.say_first as string[])[0], /An offer has been accepted on it, subject to contract, but the seller is still taking viewings/);
  assert.ok(ctx.state.seen.accepted.includes('albion_22'), 'the guardrail knows this was real news');
  const held = await run('check_availability', { property: '22 Albion Road', date: SAT, time: '11:15' });
  assert.match(String(held.say_first), /^Before any of these times, tell the caller: "An offer has been accepted/);
  say('An offer has been accepted on it, subject to contract, but the seller is still taking viewings. Would you still like to see it?');
  const ok = await run('check_availability', { property: '22 Albion Road', date: SAT, time: '11:15' });
  assert.equal(ok.say_first, undefined);

  await repo.setListing(t.id, 'albion_22', { marketing_continues: false });
  const stopped = await run('check_availability', { property: '22 Albion Road', date: SAT, time: '11:15' });
  assert.equal(stopped.available, false);
  assert.match(String(stopped.next), /comes back on the market/);

  await run('get_property', { property: '19 Copse Lane' });
  const soon = await run('check_availability', { property: '19 Copse Lane', date: THU });
  assert.equal(soon.message, "It's coming soon: first viewings from Monday 12 October.");
});

test('a personal interest: the line is said first, and the member of staff never shows the home', async () => {
  const t = await agency('ea-interest');
  const { run, say } = await call(t);
  const home = await run('get_property', { property: '9 Kingfisher Way' });
  assert.ok((home.say_first as string[]).includes("The seller is the brother of Tom Bennett, one of our negotiators."));
  say("Before we go on, I should tell you the seller is the brother of Tom, one of our negotiators.");
  const tom = await run('check_availability', { property: '9 Kingfisher Way', date: SAT, time: '10:00', staff: 'Tom' });
  assert.equal(tom.message, "Tom can't show this home; offer Jess.");
  const monday = await run('check_availability', { service: 'viewing', property: '22 Albion Road', date: '2026-10-12', staff: 'Tom' });
  assert.equal(monday.message, "Tom doesn't work on Mondays. Offer another day, or someone else.", 'not "fully booked"');
  const mondayBooking = await run('create_booking', { property: '22 Albion Road', date: '2026-10-12', time: '17:30', name: 'Ola Nowak', postcode: 'BK2 1AA', staff: 'Tom' });
  assert.equal(mondayBooking.booked, false);
  assert.match(String(mondayBooking.message), /^Tom doesn't work on Mondays/);
  const any = await run('check_availability', { property: '9 Kingfisher Way', date: SAT });
  assert.equal(any.available, true);
  for (const time of ['09:00', '12:00', '14:00']) {
    const r = await run('check_availability', { property: '9 Kingfisher Way', date: SAT, time });
    assert.notEqual(r.with, 'Tom', time);
  }
  const two = await run('check_availability', { property: '9 Kingfisher Way', date: SAT, time: '14:00' });
  const time = two.available ? '14:00' : (two.alternatives as { time: string }[])[0].time;
  const b = await run('create_booking', { property: '9 Kingfisher Way', date: SAT, time, name: 'Ola Nowak', postcode: 'BK2 1AA' });
  assert.equal(b.booked, true, JSON.stringify(b));
  assert.equal(b.with, 'Jess');
});

test('an empty home: first viewings in office hours, and no booking without a number we can see', async () => {
  const t = await agency('ea-empty');
  const { run, say } = await call(t, null);
  await run('get_property', { property: 'The Bungalow, 6 Mill Lane' });
  const late = await run('check_availability', { property: 'The Bungalow, 6 Mill Lane', date: TUE, time: '18:00' });
  assert.equal(late.available, false);
  assert.match(String(late.message), /First viewings are in office hours/);
  assert.doesNotMatch(JSON.stringify(late), /vacant|empty|keys?\b/i);
  say('That works.');
  const b = await run('create_booking', { property: 'The Bungalow, 6 Mill Lane', date: TUE, time: '11:00', name: 'Kim Lee', phone: '07700 900555' });
  assert.equal(b.booked, false);
  assert.match(String(b.message), /number we can see.*call back from Jess/);
  assert.doesNotMatch(String(b.message), /vacant|empty|keys?\b/i);
  const withNumber = await call(t);
  await withNumber.run('get_property', { property: 'The Bungalow, 6 Mill Lane' });
  const ok = await withNumber.run('create_booking', { property: 'The Bungalow, 6 Mill Lane', date: TUE, time: '11:00', name: 'Kim Lee', postcode: 'BK1 3XY' });
  assert.equal(ok.booked, true, JSON.stringify(ok));
  const row = (await repo.getBookingByReference(t.id, String(ok.reference)))!;
  assert.ok((row.details as { badges: string[] }).badges.includes('ID check'));
});

test('a valuation with no figure: outside the area, Help to Buy and a lender are refused; Thursday at 10 is Priya\'s', async () => {
  const t = await agency('ea-valuation');
  const { run, ctx, sent } = await call(t);
  const away = await run('book_valuation', { date: THU, time: '10:00', name: 'Jo Bloggs', address: '1 Long Lane', postcode: 'ZZ1 1AA' });
  assert.equal(away.booked, false);
  assert.equal(away.message, "That's outside the area we cover: say so kindly. No booking.");
  const htb = await run('book_valuation', { date: THU, time: '10:00', name: 'Jo Bloggs', address: '1 Long Lane', postcode: 'BK1 1AA', purpose: 'Help to Buy redemption' });
  assert.equal(htb.booked, false);
  assert.match(String(htb.message), /RICS Registered Valuer who is independent/);
  assert.match(String(htb.message), /free sale appraisal too/);
  const check = await run('check_availability', { service: 'valuation', date: THU, time: '10:00', postcode: 'ZZ9 9ZZ' });
  assert.equal(check.available, false, 'check_availability refuses a postcode we do not cover at once');
  const lender = await run('book_valuation', { date: THU, time: '10:00', name: 'Northern Bank', address: '1 Long Lane', postcode: 'BK1 1AA', capacity: 'lender' });
  assert.equal(lender.booked, false);
  assert.ok(sent.some((s) => s.to === '+447700900020' && /URGENT/.test(s.body)), 'the manager is texted');

  const avail = await run('check_availability', { service: 'valuation', date: THU, time: '10:00', postcode: 'BK3 7XY' });
  assert.equal(avail.available, true);
  assert.equal(avail.with, 'Priya');
  const booked = await run('book_valuation', {
    date: THU, time: '10:00', name: 'Jo Bloggs', address: '12 Hawthorn Way', postcode: 'bk3 7xy', purpose: 'sale', reason: 'moving for work',
    timescale: 'within three months', other_agent: 'Harper & Co, six weeks into a sole agency', needs_to_buy: true, property_type: 'semi', bedrooms: 3,
  });
  assert.equal(booked.booked, true, JSON.stringify(booked));
  assert.equal(booked.with, 'Priya');
  assert.equal(booked.say, "It's free and takes about an hour.");
  assert.match(String(booked.next), /note what they want to buy/);
  assert.match(String(booked.next), /two fees.*Say nothing about the other agent/);
  assert.doesNotMatch(JSON.stringify(booked), /£|worth|value of/i, 'no figure anywhere');
  const b = (await repo.getBookingByReference(t.id, String(booked.reference)))!;
  assert.equal(b.resource_key, 'priya');
  const d = b.details as Record<string, unknown>;
  assert.equal(d.reason, 'moving for work');
  assert.equal(d.timescale, 'within three months');
  assert.equal(d.other_agent, 'Harper & Co, six weeks into a sole agency');
  assert.equal(d.dual_fee, true);
  assert.equal(d.hot, true);
  assert.equal(d.postcode, 'BK3 7XY');
  assert.equal(ctx.state.valuationOffered, true);
  assert.equal(sent.at(-1)!.body, `Hartwell & Green: valuation booked, Thursday 10am at 12 Hawthorn Way, with Priya. Ref ${b.reference}. It's free and takes about an hour. To change it, call us and quote your reference. (Demo)`);

  let time = '';
  for (const at of ['09:00', '11:00', '13:00', '15:00', '16:00']) if (!time && (await run('check_availability', { service: 'valuation', date: TUE, time: at })).available) time = at;
  const executor = await run('book_valuation', { date: TUE, time, name: 'Ruth Ames', address: '3 Church Lane', postcode: 'BK4 1EW', capacity: 'executor', reason: "my late father's home" });
  assert.equal(executor.booked, true, JSON.stringify(executor));
  assert.equal(executor.tone, 'Go gently. No rush.');
  const sunday = await run('book_valuation', { date: '2026-10-11', time: '10:00', name: 'Ruth Ames', address: '3 Church Lane', postcode: 'BK4 1EW', staff: 'Priya' });
  assert.equal(sunday.message, "Priya doesn't work on Sundays. Offer another day, or someone else.");
  const viaBooking = await run('create_booking', { service: 'valuation', date: THU, time: '16:00', name: 'Jo Bloggs' });
  assert.match(String(viaBooking.message), /book_valuation/);
});

test('an offer on a home in best and final: the buyer hears the deadline, and that they may improve their offer before it', async () => {
  const t = await agency('ea-offer-bf');
  // Best and final by Friday at noon.
  await repo.setListing(t.id, 'albion_22', { best_final_at: new Date('2026-10-09T11:00:00Z') });
  const { run, say } = await call(t);
  await run('get_property', { property: '22 Albion Road' });
  const args = { property: '22 Albion Road', amount: 325000, buyer_names: ['Sam Price'], conditions: 'none', first_time_buyer: true, funding: 'cash' };
  await run('record_offer', args);
  say('Before I take it: buyers pay thirty-six pounds including VAT each for ID checks, once an offer is accepted.');
  const r = await run('record_offer', args);
  assert.equal(r.recorded, true, JSON.stringify(r));
  assert.match(String(r.best_and_final), /^The seller has asked for best and final offers by Friday at 12 noon/);
  // After the deadline: no deadline to speak of, and the offer still goes to the seller.
  await repo.setListing(t.id, 'albion_22', { best_final_at: new Date('2026-10-06T11:00:00Z') });
  const late = await run('record_offer', { ...args, amount: 326000 });
  assert.equal(late.recorded, true);
  assert.equal(late.best_and_final, undefined);
});

test('an offer, end to end: the fee first, then recorded whatever it is, confirmed in writing to the buyer, and Jess alerted', async () => {
  const t = await agency('ea-offer');
  const before = await repo.listOffers(t.id, 'albion_22');
  assert.ok(before.length, 'the seed has an offer on 22 Albion Road already');
  const { run, ctx, sent, say, actions } = await call(t);
  await run('get_property', { property: '22 Albion Road' });
  const args = { property: '22 Albion Road', amount: '320k', buyer_names: ['Sam Price', 'Alex Price'], conditions: 'subject to survey', first_time_buyer: true, funding: 'mortgage agreed in principle' };
  const fee = await run('record_offer', args);
  assert.equal(fee.recorded, false);
  assert.equal(fee.not_yet, 'Not recorded yet. Before taking the offer, tell the caller: "Buyers pay £36 including VAT each for ID checks, once an offer is accepted." Then call this again. Add nothing about the home that a tool didn\'t give you.');
  say('Before I take it: buyers pay thirty-six pounds including VAT each for ID checks, once an offer is accepted.');
  const r = await run('record_offer', args);
  assert.equal(r.recorded, true, JSON.stringify(r));
  assert.equal(r.read_back, 'An offer of £320,000 for 22 Albion Road from Sam and Alex Price, subject to survey. First-time buyers, mortgage agreed in principle.');
  // The seed's offer on the house is there: that others exist may be said, never who or how much (TPO 9f).
  assert.equal(r.other_offers, 'There are other offers on this home; we never share amounts.');
  assert.match(String(r.say), /goes to the seller promptly/);
  for (const o of before) assert.ok(!JSON.stringify(r).includes(String(o.amount_pence / 100).slice(0, 3)) || o.amount_pence === 32000000, 'no other offer\'s amount');
  assert.doesNotMatch(JSON.stringify(r), /other offer of|accept(ed)? it|likely|good offer|low/i);
  assert.equal(ctx.state.lastOfferRef, r.reference);
  assert.equal(unsaidReference(ctx.state, 'Thanks, goodbye.'), r.reference, 'the reference is owed to the caller');
  assert.ok(actions.some((a) => a.kind === 'offer_recorded'));

  const row = (await repo.findOffer(t.id, { reference: String(r.reference) }))[0];
  assert.equal(row.amount_pence, 32000000);
  assert.deepEqual(row.buyer_names, ['Sam Price', 'Alex Price']);
  assert.equal(row.conditions, 'subject to survey');
  assert.deepEqual(row.position, { first_time_buyer: true, selling: 'nothing', funding: 'mortgage_aip' });
  assert.equal(row.status, 'received');
  assert.equal(row.received_at.getTime(), NOW.getTime());
  assert.equal(row.phone, CALLER);
  assert.equal(row.source, 'eval');
  const buyerText = sent.find((s) => s.to === CALLER)!.body;
  assert.equal(buyerText, `Hartwell & Green: we received your offer of £320,000 for 22 Albion Road at 11am on 7 October, subject to survey. Ref ${r.reference}. We'll put it to the seller promptly and confirm in writing. (Demo)`);
  const alert = sent.find((s) => s.to === JESS)!.body;
  assert.match(alert, /^URGENT from the AI receptionist: Offer of £320,000 on 22 Albion Road from Sam and Alex Price/);
  const [message] = await callMessages(ctx.callId);
  assert.equal(message.for_staff, 'jess');
  assert.equal(message.category, 'offer');
  assert.equal(message.urgency, 'urgent');
  assert.equal(message.reference, r.reference);

  // A sale agreed still takes offers until exchange; a sold or withdrawn home does not.
  await repo.setListing(t.id, 'albion_22', { status: 'sale_agreed' });
  const late = await run('record_offer', { ...args, amount: 330000 });
  assert.equal(late.recorded, true);
  assert.match(String(late.note), /until contracts are exchanged/);
  await run('get_property', { property: '8 Willow Gardens' });
  assert.equal((await run('record_offer', { property: '8 Willow Gardens', amount: 400000, buyer_names: 'Sam Price' })).recorded, false);

  // An agency that passes every offer to a person takes a message instead.
  const byHand = await agency('ea-offer-message', (p) => void (p.estate!.offers.take = 'message'));
  const c2 = await call(byHand);
  const m = await c2.run('record_offer', { property: '22 Albion Road', amount: 320000, buyer_names: 'Sam Price' });
  assert.equal(m.recorded, false);
  assert.match(String(m.message), /urgent message for Jess \(category offer\)/);
});

test('an offer\'s terms: asked for once when not given; the caller\'s own "subject to survey" is kept; a valuation keeps why and when they move', async () => {
  const t = await agency('ea-offer-terms');
  const fee = 'Buyers pay thirty-six pounds including VAT each for ID checks, once an offer is accepted.';
  const offer = { property: '22 Albion Road', amount: 320000, buyer_names: 'Alex Moran and Jamie Moran', first_time_buyer: true, funding: 'mortgage agreed in principle' };
  // Live, 6 October: "£320,000" taken, and "subject to survey" never asked for or heard.
  const a = await call(t);
  await a.run('get_property', { property: '22 Albion Road' });
  await a.run('record_offer', offer);
  a.say(fee);
  const ask = await a.run('record_offer', offer);
  assert.equal(ask.recorded, false);
  assert.match(String(ask.not_yet), /subject to anything/);
  const none = await a.run('record_offer', offer);
  assert.equal(none.recorded, true, 'asked once, never in a loop');
  assert.equal((await repo.findOffer(t.id, { reference: String(none.reference) }))[0].conditions, null);
  // Said by the caller but left out by the receptionist: kept as said.
  const b = await call(t, '+447700900141');
  await b.run('get_property', { property: '22 Albion Road' });
  b.ctx.state.heard.push("It's three hundred and twenty thousand, subject to survey. We're first-time buyers.");
  await b.run('record_offer', offer);
  b.say(fee);
  const kept = await b.run('record_offer', offer);
  assert.equal(kept.recorded, true, JSON.stringify(kept));
  assert.equal((await repo.findOffer(t.id, { reference: String(kept.reference) }))[0].conditions, 'subject to survey');
  // A valuation: "within three months" from the caller's own words when the receptionist leaves it out.
  const c = await call(t, '+447700900142');
  c.ctx.state.heard.push("Yes, I'm looking to sell, moving for work within three months.");
  const v = await c.run('book_valuation', { date: THU, time: '10:00', name: 'Jo Bloggs', address: '12 Hawthorn Way', postcode: 'BK3 7XY', purpose: 'sale', other_agent: 'none' });
  assert.equal(v.booked, true, JSON.stringify(v));
  const d = (await repo.getBookingByReference(t.id, String(v.reference)))!.details as Record<string, unknown>;
  // ...and why they're moving, without the when.
  assert.deepEqual([d.timescale, d.hot, d.reason], ['within three months', true, 'moving for work']);
});

test('messages reach one person: urgent ones text them; a complaint gets its reference and process; a compliance note stays private', async () => {
  const t = await agency('ea-messages');
  const { run, ctx, sent } = await call(t);
  const flood = await run('take_message', { name: 'Sam Price', message: 'Has 22 Albion Road ever flooded?', for: 'negotiator', property: '22 Albion Road', category: 'viewing', urgency: 'today' });
  assert.equal(flood.for, 'Jess');
  assert.equal(ctx.state.messageTaken, true);
  const late = await run('take_message', { name: 'Kim Lee', message: 'Running ten minutes late for the viewing.', for: 'Jess', category: 'viewing', urgency: 'urgent' });
  assert.match(String(late.note), /urgent message.*Never say where Jess is/);
  assert.ok(sent.some((s) => s.to === JESS && /^URGENT from the AI receptionist: Kim Lee \(07700 900123\): Running ten minutes late/.test(s.body)));
  const complaint = await run('take_message', { name: 'Kim Lee', message: 'Unhappy that my viewing was cancelled twice.', category: 'complaint' });
  assert.equal(complaint.for, 'Rachel');
  assert.match(String(complaint.reference), /^[A-Z]{2}\d{3}$/);
  assert.match(String(complaint.process), /3 working days.*15.*8 weeks.*The Property Ombudsman/);
  assert.ok(sent.some((s) => s.to === CALLER && s.body.includes(`complaint, ref ${complaint.reference}`)));
  const before = sent.length;
  const quiet = await run('take_message', { name: 'Kim Lee', message: 'Wanted to pay the deposit in cash from abroad.', category: 'compliance', urgency: 'urgent' });
  assert.equal(sent.length, before, 'never texted');
  assert.equal(quiet.for, undefined, 'never says who it is for');
  const data = await run('take_message', { name: 'Kim Lee', message: 'Wants a copy of her data.', category: 'data' });
  assert.match(String(data.note), /within a month/);
  const rows = await callMessages(ctx.callId);
  assert.deepEqual(rows.map((m: any) => [m.for_staff, m.category]), [['jess', 'viewing'], ['jess', 'viewing'], ['rachel', 'complaint'], ['rachel', 'compliance'], ['rachel', 'data']]);
  assert.equal(rows[2].reference, complaint.reference);
  assert.ok(rows[2].details.final_by > '2026-10-20');
  assert.equal(rows[3].details.private, true);
});

test('hours, details by text, and a search by what a buyer wants', async () => {
  const t = await agency('ea-misc');
  const { run, sent } = await call(t);
  const sunday = await run('get_opening_hours', { date: '2026-10-11' });
  assert.deepEqual((sunday.days as any[])[0], { date: '2026-10-11', spoken_date: 'Sunday 11 October', open: ['closed'], viewings: ['none'], valuations: ['none'] });
  const tuesday = (await run('get_opening_hours', { date: TUE })).days as any[];
  assert.deepEqual(tuesday[0].viewings, ['9am to 7pm'], 'later than the office');
  const sentDetails = await run('send_property_details', { property: '22 Albion Road', what: 'the floorplan and a video' });
  assert.equal(sentDetails.sent, true);
  assert.equal(sentDetails.missing, 'No video tour for this home.');
  assert.match(sent.at(-1)!.body, /^Hartwell & Green: 22 Albion Road, Brackenford BK2, offers over £325,000\. Floorplan: https:\/\/.*\/hg102\/floorplan \(demo link\) \(Demo\)$/);
  const search = await run('search_properties', { query: 'a three-bed house with a garden in BK2 or BK3, under 350' });
  const keys = (search.matches as any[]).map((m) => m.property);
  assert.ok(keys.length >= 2 && keys.length <= 3, keys.join());
  assert.ok(keys.includes('albion_22'));
  assert.doesNotMatch(JSON.stringify(search), /seller|vacant|keys?\b/i);
  // A home asked for by name that is no longer for sale: said so, with the closest homes still on the market.
  const gone = await run('search_properties', { query: '10 Meadow View' });
  assert.equal((gone.matches as any[])[0].status, 'no longer on the market');
  assert.equal((gone.similar as any[]).length, 2);
  assert.ok((gone.similar as any[]).every((x) => x.status !== 'no longer on the market' && x.property !== 'meadow_view_10'));
  assert.match(String(gone.note), /no longer on the market, and offer these instead/);
  const none = await run('search_properties', { query: '14 Acacia Avenue' });
  assert.match(String(none.note), /None of our homes matches that.*scam/);
  const nothing = await run('search_properties', { min_beds: 9 });
  assert.match(String(nothing.note), /Nothing matches/);
});

test('record() and the outcome: an offer is the call\'s own, and its reference is owed', async () => {
  const t = await agency('ea-record');
  const { ctx } = await call(t);
  record(ctx, 'AB123', 'offer', 'committed');
  assert.equal(ctx.state.lastOfferRef, 'AB123');
  assert.deepEqual(ctx.state.committed, ['AB123']);
  assert.equal(unsaidReference(ctx.state, 'Your reference is A, B, 1, 2, 3.'), null);
});

// ── The prompt and the guardrails ─────────────────────────────────────────

test('the estate prompt: its own rules in place of tables and takeaways, under 7,000 characters', async () => {
  const { profile } = builderTenant(BUILDER_TENANTS.find((b) => b.slug === 'ea-hartwell')!);
  const prompt = compilePrompt(profile, { now: NOW, callerPhone: CALLER, demoCards: [], canTransfer: false, channel: 'browser' });
  assert.ok(prompt.length < 7000, `${prompt.length} characters`);
  for (const rule of [/before any viewing times, say everything in say_first/i, /never give a value, a range or an opinion/i, /record every offer with record_offer/i,
    /Report Fraud on 0300 123 2040/, /Treat everyone the same/, /take_message with who it's for, the category and how urgent/]) assert.match(prompt, rule);
  assert.doesNotMatch(prompt, /kitchen|allerg|takeaway|demo card|party/i);
  assert.match(prompt, /take offers/);
  const a = defaultAnswers();
  a.basics.name = 'Olive & Ember';
  const restaurant = compilePrompt(compileRestaurant(a, { slug: 'olive' }), { now: NOW, callerPhone: CALLER, demoCards: [], canTransfer: false, channel: 'browser' });
  assert.match(restaurant, /make sure the kitchen knows/, 'the restaurant keeps its own');
  assert.doesNotMatch(restaurant, /record_offer|say_first/);
});

test('estate guardrails: a figure, bank details, codes, an empty home, where staff are, hype and made-up acceptances', () => {
  const state = newCallState();
  state.estate = true;
  const team = ['Rachel', 'Jess', 'Tom', 'Priya'];
  const rules = (line: string) => checkUtterance(line, state, team).map((f) => f.rule);
  // Jess's 11:15 came from check_availability.
  state.times.push(11 * 60 + 15);
  const cases: [string, string[]][] = [
    ["I can't value a home on the phone, but Priya can come and see it for free.", []],
    ['Next door went for four hundred, so yours could fetch about £410,000.', ['valuation_figure']],
    ["I'd say it's worth around 400k.", ['valuation_figure']],
    ['Ballpark, three hundred grand.', ['valuation_figure']],
    ["It's worth noting the service charge is £1,320 a year.", []],
    ['22 Albion Road is offers over £325,000.', []],
    ['An offer of £320,000 for 22 Albion Road from Sam Price.', []],
    ['The sort code is 20-45-67 and the account is 12345678.', ['bank_details']],
    ["Don't send money, and call Report Fraud on 0300 123 2040.", []],
    ['The key safe code is 4512.', ['code_spoken']],
    ['Your postcode is BK2 6JD.', []],
    ['The bungalow is empty at the moment, so any time works.', ['vacancy_said']],
    ["It's sold with vacant possession.", []],
    ['We hold the keys, so Jess can let you in.', ['vacancy_said']],
    // Lived in is as private as empty (live, 6 October: "there's a tenant currently living there").
    ["Before we look at times, there's a tenant currently living there.", ['vacancy_said']],
    ["It's currently occupied, so viewings need notice.", ['vacancy_said']],
    ['Jess is out on a viewing right now.', ['staff_whereabouts']],
    ['Tom is on holiday this week.', ['staff_whereabouts']],
    ['Jess is free at 11:15.', []],
    ["There's been a lot of interest, so it won't last.", ['invented_interest']],
    ['Good news, the seller has accepted your offer!', ['unconfirmed_acceptance']],
    ["I can't say whether it'll be accepted: only the seller decides.", []],
    ['Buyers pay £36 including VAT each for ID checks, once an offer is accepted.', []],
    ["I've recorded your offer.", ['unconfirmed_claim']],
  ];
  for (const [line, want] of cases) assert.deepEqual(rules(line), want, line);
  // Once a message is taken, "I've recorded that" is true; an offer still needs record_offer's reference.
  state.messageTaken = true;
  assert.deepEqual(rules("I've passed your details to Rachel, and I've recorded that this was about bank details for 2 Elm Court."), []);
  assert.deepEqual(rules("I've recorded your offer."), ['unconfirmed_claim']);
  // ...and an offer said with its amount, or "sent to the seller", is never covered by an earlier message.
  assert.deepEqual(rules("Thank you. £320,000 for 22 Albion Road: I've logged that and it's been sent to the seller."), ['unconfirmed_claim']);
  assert.deepEqual(rules("Lovely, three hundred and twenty thousand, that's now recorded."), ['unconfirmed_claim']);
  state.messageTaken = false;
  state.seen.accepted.push('albion_22');
  assert.deepEqual(rules('An offer has been accepted on it, subject to contract.'), [], 'the tools said so');
  state.committed.push('XY889');
  assert.deepEqual(rules("I've recorded your offer."), []);

  // A restaurant's calls are checked as they always were.
  const restaurant = newCallState();
  for (const [line] of cases) assert.ok(checkUtterance(line, restaurant, team).every((f) => ['unconfirmed_claim', 'unpaid_claim', 'said_safe_for_allergy', 'narrated', 'untaken_message'].includes(f.rule)), line);
});

test('estate guardrails: a time offered must come from the instructions, a tool or the caller', () => {
  const state = newCallState();
  state.estate = true;
  const rules = (line: string) => checkUtterance(line, state).map((f) => f.rule);
  // Live, 6 October: times offered for a viewing before anything was checked; 9am was taken.
  state.times.push(...knownTimes('Saturday: 9am till 4pm.'));
  assert.deepEqual(rules("I've got availability at 9am or 10:30am this Saturday, which works for you?"), ['invented_time']);
  assert.deepEqual(rules("We're open from 9am on Saturday."), [], 'from the instructions');
  // A tool's exact times and anything inside its ranges may be offered, however the time is written or transcribed.
  const result = JSON.stringify({ available_ranges: ['10am to 10:15am', '11:15am to 12:30pm'], alternatives: [{ time: '14:00', spoken: '2pm' }] });
  state.times.push(...knownTimes(result));
  state.timeRanges.push(...rangesIn(result));
  for (const line of ['We have 10 am to 10 15 am, or 11:15am to 12:30pm.', 'How about 11:30am?', 'I could do 2pm with Tom.', 'Would midday suit?', "That's Flat 4 10am, then.", 'Shall I book ten fifteen?', 'Or half past eleven?', "Two o'clock with Tom?"]) assert.deepEqual(rules(line), [], line);
  assert.deepEqual(rules('Or there is 3:45pm.'), ['invented_time']);
  // Said in words, as a live call on 6 October did after being corrected once.
  assert.deepEqual(rules('Okay, we have Thursday at quarter past four, or Friday at half past nine.'), ['invented_time']);
  // The caller's own time may be said back.
  state.heard.push('Could you do quarter to five, say 4:45pm?');
  assert.deepEqual(rules('Let me check 4:45pm for you.'), []);
  // A repairs contractor's and a restaurant's calls are not checked for times.
  assert.deepEqual(checkUtterance("I've got 9am or 10:30am.", newCallState()), []);
});

test('guardrails: a reference read out must come from a tool or the caller', () => {
  const s = newCallState();
  const rules = (line: string) => checkUtterance(line, s).map((f) => f.rule);
  // Live, 6 October: no tool was used at all, and the valuation "booked" with reference 13579.
  assert.deepEqual(rules("So that's Thursday at 10am. The reference is 13579. Anything else?"), ['invented_reference']);
  s.references.push(...referencesIn(JSON.stringify({ booked: true, reference: 'QK379', quote: 'Q-2291' })));
  for (const line of ['Your booking reference is Q, K, 3, 7, 9. Thank you!', 'Your reference is QK379.', 'That was quote reference Q 2 2 9 1.']) assert.deepEqual(rules(line), [], line);
  assert.deepEqual(rules('Your reference is Q K 3 7 8.'), ['invented_reference'], 'one character out is still made up');
  // Live, 8 October: a real reference ran on into the next sentence's "A", was called made up, and the viewing was booked twice.
  assert.deepEqual(rules('Your reference is Q K 3 7 9. A confirmation text is on its way.'), []);
  assert.deepEqual(rules('Your reference is RS678.'), ['invented_reference']);
  // The caller's own reference, read back to them.
  s.heard.push('My reference is X R 8 9 1.');
  assert.deepEqual(rules("Thanks: that's reference XR891."), []);
});

test('take_message: a caller who talked about bank details leaves an urgent fraud message, whatever it was filed as', async () => {
  const t = await agency('ea-fraud');
  const { ctx, run, sent } = await call(t, '+447700900137');
  ctx.state.heard.push("Actually, our firm's bank details have changed. Please tell the buyer to send the deposit to our new account.");
  const r = await run('take_message', { name: 'Mark Field', message: 'Please call back about 2 Elm Court.', category: 'general', urgency: 'today', for: 'negotiator' });
  assert.equal(r.taken, true);
  // The advice goes with it: a live call on 6 October took the message and never gave it.
  assert.match(String(r.say), /don't pay anything or act on changed bank details.*own solicitor, on a number you already have.*Report Fraud on 0300 123 2040/);
  const m = (await repo.listMessages(t.id, 500)).find((x) => x.from_name === 'Mark Field')!;
  assert.equal(m.category, 'fraud');
  assert.equal(ctx.state.fraudReported, true, 'the call knows a fraud message is taken (no reminder needed)');
  assert.equal(m.urgency, 'urgent');
  assert.ok(sent.some((x) => x.body.startsWith('URGENT from the AI receptionist: Mark Field')), 'the person it is for is texted');
  // A caller who never mentioned money keeps the category the receptionist chose.
  const plain = await call(t, '+447700900138');
  plain.ctx.state.heard.push('Could someone call me about the garden at 22 Albion Road?');
  await plain.run('take_message', { name: 'Ruth Lane', message: 'About the garden.', category: 'general', urgency: 'today' });
  assert.equal((await repo.listMessages(t.id, 500)).find((x) => x.from_name === 'Ruth Lane')!.category, 'general');
});

test('get_property: the facts every advert must state come first, in one sentence; left out while staff check them', async () => {
  const t = await agency('ea-describe');
  const { run } = await call(t);
  const r = await run('get_property', { property: '22 Albion Road' });
  assert.equal(r.describe, '22 Albion Road is a three-bedroom semi-detached house with offers over £325,000, council tax band C, and EPC rating D. It\'s freehold.');
  assert.match(String(r.note), /^Say describe first/);
  await repo.setListing(t.id, 'albion_22', { checking: ['local_tax'] });
  const checking = await (await call(t)).run('get_property', { property: '22 Albion Road' });
  assert.equal(checking.describe, undefined, 'a fact being checked is not stated');
  // Nor is the fact itself, anywhere in the answer.
  for (const [fact, gone] of [['price', 'price'], ['tenure', 'tenure'], ['local_tax', 'council_tax'], ['epc', 'epc']] as const) {
    await repo.setListing(t.id, 'albion_22', { checking: [fact] });
    const r = await (await call(t)).run('get_property', { property: '22 Albion Road' });
    const facts = r.facts as Record<string, string>;
    assert.equal(fact === 'price' ? r.price : facts[gone], undefined, `${fact} withheld while it is checked`);
    assert.ok((r.being_checked as string[]).length === 1, fact);
  }
  // A price being checked is not given by the other tools either: not in a search, nor in the text of the details.
  await repo.setListing(t.id, 'albion_22', { checking: ['price'] });
  const c = await call(t);
  const listed = await c.run('search_properties', { min_beds: 3 });
  const match = (listed.matches as Record<string, unknown>[]).find((m) => m.property === 'albion_22')!;
  assert.equal(match.price, undefined);
  assert.deepEqual(match.being_checked, ['the price']);
  assert.ok(!JSON.stringify(listed).includes('325,000'), JSON.stringify(listed));
  assert.ok((listed.matches as Record<string, unknown>[]).some((m) => m.price), 'other homes keep theirs');
  const sent = await c.run('send_property_details', { property: '22 Albion Road', what: 'brochure' });
  assert.equal(sent.sent, true);
  assert.ok(!c.sent.at(-1)!.body.includes('£'), c.sent.at(-1)!.body);
  await repo.setListing(t.id, 'albion_22', { checking: [] });
});

test('end_call: an estate call ending "booked" with nothing booked is stopped once', async () => {
  const t = await agency('ea-end-booked');
  const { run } = await call(t);
  const first = await run('end_call', { outcome: 'booked' });
  assert.equal(first.ok, false);
  assert.match(String(first.message), /Nothing has been booked in this call/);
  assert.equal((await run('end_call', { outcome: 'booked' })).ok, true, 'never twice');
  assert.equal((await (await call(t)).run('end_call', { outcome: 'answered' })).ok, true, 'only a call said to be booked');
});

test('find_party: who the calling number is to us, from their own records; never a seller\'s address or why someone rang', async () => {
  const t = await agency('ea-party');
  const party = async (phone: string | null) => (await call(t, phone)).run('find_party', {});
  // The seller: told they sell with us, not where.
  const sarah = await party('+447700900001');
  assert.equal(sarah.known, true);
  assert.match(String(sarah.seller), /get_marketing_update/);
  assert.ok(!/Larkspur/i.test(JSON.stringify(sarah)), JSON.stringify(sarah));
  // A Zoopla enquiry nobody answered: said, with sorry, until a viewing is booked from it.
  const megan = await party('+447700900007');
  const asked = (megan.is as string[]).find((x) => x.startsWith('enquired on Zoopla'))!;
  assert.match(asked, /: "Is there parking\? We'd like to view\." \(not answered yet\)$/);
  assert.match(String(megan.note), /sorry nobody got back to them/);
  const key = (await repo.messagesFrom(t.id, '+447700900007'))[0].details.listing as string;
  const c = await call(t, '+447700900007');
  const booked = await c.run('create_booking', { property: key, date: SAT, time: '11:30', name: 'Megan Hughes', postcode: 'BK2 9PL', first_time_buyer: true, selling: 'nothing', funding: 'mortgage_aip' });
  assert.equal(booked.booked, true, JSON.stringify(booked));
  const after = await party('+447700900007');
  assert.ok((after.is as string[]).some((x) => x.startsWith('enquired on Zoopla') && !x.includes('not answered')), JSON.stringify(after.is));
  assert.ok((after.is as string[]).some((x) => x.startsWith('viewing: Saturday')), JSON.stringify(after.is));
  // A missed call from the team: who and when, never why.
  const sam = await party('+447700900002');
  assert.match(String(sam.tried_to_call), /^[A-Z][a-z]+ tried to call yesterday afternoon$/);
  assert.match(String(sam.note), /never why/);
  // An offer: named with its reference, its status left to get_offer_status.
  const aisha = await party('+447700900003');
  assert.ok((aisha.is as string[]).some((x) => /^made an offer on 14 Larkspur Close, ref [A-Z]{2}\d{3}: get_offer_status says where it stands$/.test(x)), JSON.stringify(aisha.is));
  // Nobody we know, and no number at all.
  assert.equal((await party('+447700900998')).known, false);
  assert.equal((await party(null)).known, false);
});

test('get_marketing_update: an offer the seller came back on is waiting for the buyer, never "about to be put to you"', async () => {
  const t = await agency('ea-vendor-countered');
  const larkspur = (await repo.listOffers(t.id)).find((o) => o.status === 'sent' && o.amount_pence === 28_500_000)!;
  await repo.setOfferStatus(t.id, larkspur.reference, 'countered', { note: 'Seller would take £295,000', from: ['sent'] });
  const u = await (await call(t, '+447700900001')).run('get_marketing_update', { property: 'Larkspur Close' });
  assert.match(String(u.say), /An offer of £285,000 from a first-time buyer, mortgage agreed in principle: you came back to them, and we're waiting for their answer\.$/);
  assert.doesNotMatch(String(u.say), /about to be put to you/);
});

test('get_marketing_update: the seller of that home only, checked by number; viewings, feedback and offers by position, never names', async () => {
  const t = await agency('ea-vendor');
  const sarah = await call(t, '+447700900001');
  const u = await sarah.run('get_marketing_update', { property: 'Larkspur Close' });
  assert.equal(u.verified, true, JSON.stringify(u));
  const v = u.viewings as { last_7_days: number; since_launch: number; upcoming: string[] };
  assert.ok(v.last_7_days >= 2 && v.since_launch >= v.last_7_days, JSON.stringify(v));
  assert.equal(v.upcoming.length, 2, JSON.stringify(v.upcoming));
  const said = (u.feedback as { said: string }[]).map((f) => f.said);
  for (const words of ['Loved the garden; the kitchen feels dated.', 'Price feels high for the size.']) assert.ok(said.includes(words), JSON.stringify(said));
  const offer = (u.offers as { amount: string; status: string; buyer: string }[])[0];
  assert.deepEqual([offer.amount, offer.buyer], ['£285,000', 'First-time buyer, mortgage agreed in principle']);
  assert.match(offer.status, /^with you to consider since /);
  assert.ok(!/Aisha|Khan|07700|\+447/.test(JSON.stringify(u)), 'no buyer named or numbered');
  assert.match(String(u.next), /urgent message for \w+/);
  // A sentence to open with: the counts, the week's feedback in their words, and the offer by position.
  assert.match(String(u.say), /^[A-Z][a-z]+ viewings? in the last seven days, [a-z]+ viewings? since it went on the market, and two more booked: tomorrow\. /);
  assert.match(String(u.say), /"Loved the garden; the kitchen feels dated\."/);
  assert.match(String(u.say), /An offer of £285,000 from a first-time buyer, mortgage agreed in principle, with you to consider\.$/);
  // Her number, another home: not hers to hear about.
  assert.equal((await sarah.run('get_marketing_update', { property: '22 Albion Road' })).verified, false);
  // A stranger: the same refusal each time, and after three misses no more tries this call.
  const stranger = await call(t, '+447700900009');
  for (let i = 0; i < 3; i++) {
    const r = await stranger.run('get_marketing_update', { property: 'Larkspur Close' });
    assert.deepEqual([r.verified, r.property, r.viewings], [false, undefined, undefined]);
    assert.match(String(r.say), /can't go through a sale without checking who's calling/);
  }
  assert.match(String((await stranger.run('get_marketing_update', { property: 'Larkspur Close' })).next), /No more tries/);
  // No calling number: never verified.
  assert.equal((await (await call(t, null)).run('get_marketing_update', { property: 'Larkspur Close' })).verified, false);
});

test('get_offer_status: a buyer\'s own offer as recorded, only for the number it was made from; others exist, never how much', async () => {
  const t = await agency('ea-offer-status');
  const aisha = await call(t, '+447700900003');
  const mine = await aisha.run('get_offer_status', { property: 'Larkspur Close' });
  assert.equal(mine.verified, true, JSON.stringify(mine));
  assert.equal(mine.amount, '£285,000');
  assert.match(String(mine.status), /^put to the seller yesterday at .+; waiting for their decision$/);
  assert.equal(mine.other_offers, undefined, 'hers is the only one');
  assert.match(String(mine.say), /will confirm any decision in writing/);
  // Accepted, as the tool says: the receptionist may say so without a false-acceptance flag.
  const ben = await call(t, '+447700900004');
  const won = await ben.run('get_offer_status', {});
  assert.match(String(won.status), /^accepted .+, subject to contract$/);
  assert.equal(checkUtterance('Good news: your offer has been accepted, subject to contract.', ben.ctx.state).filter((f) => f.rule === 'unconfirmed_acceptance').length, 0);
  // Someone else with Aisha's reference: nothing, not even that it exists.
  const stranger = await call(t, '+447700900009');
  const theirs = await stranger.run('get_offer_status', { reference: String(mine.reference) });
  assert.deepEqual([theirs.verified, theirs.amount, theirs.status], [false, undefined, undefined]);
  // Best and final, with a rival bid: the deadline and that others exist.
  const home = (await repo.listingStates(t.id)).find((l) => l.best_final_at)!;
  const bidder = (await repo.listOffers(t.id, home.listing_key)).find((o) => o.phone && ['received', 'sent'].includes(o.status))!;
  const bf = await (await call(t, bidder.phone)).run('get_offer_status', {});
  assert.match(String(bf.best_and_final), /^best and final offers by /);
  assert.equal(bf.other_offers, 'There are other offers on this home; we never share amounts.');
  const rival = (await repo.listOffers(t.id, home.listing_key)).find((o) => o.phone !== bidder.phone && ['received', 'sent'].includes(o.status))!;
  assert.ok(!JSON.stringify(bf).includes((rival.amount_pence / 100).toLocaleString('en-GB')), 'never the rival\'s amount');
});

test('record_viewing_feedback: the caller\'s own past viewing only; it reaches the seller\'s update', async () => {
  const t = await agency('ea-feedback');
  const sam = await call(t, '+447700900002');
  const before = await (await call(t, '+447700900001')).run('get_marketing_update', { property: 'Larkspur Close' });
  assert.equal(before.feedback_awaited, 1, "Sam's is awaited");
  const r = await sam.run('record_viewing_feedback', { category: 'keen', words: 'Lovely garden, a bit small upstairs.' });
  assert.equal(r.recorded, true, JSON.stringify(r));
  assert.equal(r.property, '14 Larkspur Close');
  assert.match(String(r.next), /second viewing or to take an offer, once/);
  assert.equal(sam.actions.at(-1)?.kind, 'booking_changed');
  const after = await (await call(t, '+447700900001')).run('get_marketing_update', { property: 'Larkspur Close' });
  assert.ok((after.feedback as { said: string }[]).some((f) => f.said === 'Lovely garden, a bit small upstairs.'), JSON.stringify(after.feedback));
  assert.equal(after.feedback_awaited, undefined);
  // Someone else's viewing, or no viewing at all: a message instead.
  const other = (await repo.listBookings(t.id, new Date(NOW.getTime() - 14 * 86400000), NOW)).find((b) => b.listing_key && b.phone && b.phone !== '+447700900002')!;
  assert.equal((await sam.run('record_viewing_feedback', { reference: other.reference, category: 'not for me', words: 'Too dark.' })).recorded, false);
  const stranger = await (await call(t, '+447700900009')).run('record_viewing_feedback', { category: 'keen', words: 'Nice.' });
  assert.match(String(stranger.message), /message for the negotiator/);
  assert.equal((await sam.run('record_viewing_feedback', { words: 'Nice.' })).recorded, false, 'how keen is asked, never assumed');
});

test('register_buyer and stop_alerts: requirements and position kept, alerts only when asked, a summary text; stopped at once', async () => {
  const t = await agency('ea-register');
  const kim = await call(t, '+447700900150');
  const args = { name: 'Kim Hale', areas: 'bk2, Brackenford', max_price: '300k', min_beds: 2, types: 'house', first_time_buyer: true, funding: 'mortgage agreed in principle' };
  // Never on a name alone: what they want, then their position, then alerts (a live call registered "cash buyers" on their name).
  assert.match(String((await kim.run('register_buyer', { name: 'Kim Hale', funding: 'cash', alerts: true })).message), /Ask what they are looking for/);
  assert.match(String((await kim.run('register_buyer', { name: 'Kim Hale', areas: 'BK2', funding: 'cash', alerts: true })).message), /whether they have a home to sell/);
  assert.equal(await repo.findBuyer(t.id, '+447700900150'), null, 'nothing written until then');
  assert.match(String((await kim.run('register_buyer', args)).message), /never assume/);
  const r = await kim.run('register_buyer', { ...args, alerts: true });
  assert.equal(r.registered, true, JSON.stringify(r));
  assert.equal(r.looking_for, '2-bed house in BK2, Brackenford up to £300,000');
  assert.ok((r.matches as unknown[]).length <= 3);
  assert.match(String(r.next), /Never promise a first look/);
  assert.match(kim.sent.at(-1)!.body, /registered with us as a buyer, looking for 2-bed house .*To stop these texts, call us\. \(Demo\)$/);
  const row = (await repo.findBuyer(t.id, '+447700900150'))!;
  assert.deepEqual([row.marketing_consent, Boolean(row.details.consent_at), row.details.position?.first_time_buyer, row.details.requirements?.max_price_pence], [true, true, true, 30_000_000]);
  assert.equal(kim.actions.at(-1)?.kind, 'buyer_registered');
  // Stopped at once, with one text; asked again, nothing more is sent.
  const stop = await kim.run('stop_alerts', {});
  assert.equal(stop.stopped, true);
  assert.match(kim.sent.at(-1)!.body, /stopped texting you about new homes/);
  assert.equal((await repo.findBuyer(t.id, '+447700900150'))!.marketing_consent, false);
  const texts = kim.sent.length;
  assert.match(String((await kim.run('stop_alerts', {})).say), /isn't getting alerts/);
  assert.equal(kim.sent.length, texts);
  // A seller buying too stays a seller; a home to sell not yet on the market gets one valuation offer; a back-up buyer is noted.
  const sarah = await call(t, '+447700900001');
  const s = await sarah.run('register_buyer', { name: 'Sarah Collins', areas: 'Brackenford', min_beds: 3, alerts: false, selling: 'not on the market', backup_for: '3 Kingfisher Way' });
  assert.equal(s.registered, true, JSON.stringify(s));
  assert.match(String(s.next), /Offer a free valuation of their own home, once/);
  assert.deepEqual(s.backup_for, ['3 Kingfisher Way']);
  const both = (await repo.findBuyer(t.id, '+447700900001'))!;
  assert.deepEqual([...both.details.roles!].sort(), ['buyer', 'seller']);
  assert.equal(both.marketing_consent, false);
  assert.match(sarah.sent.at(-1)!.body, /won't text you about new homes unless you ask/);
});

test('a seller answering an offer by phone: an urgent message, and "Seller replied by phone" on the offer until it is read', async () => {
  const t = await agency('ea-seller-reply');
  const bus = { activeFor: () => [] } as unknown as Bus;
  const aishas = async () => ((await tenantState(repo, t, bus)) as any).offers.find((o: any) => o.phone === '07700 900003');
  assert.equal((await aishas()).seller_replied, false);
  // Anyone else saying the same is just a message.
  const stranger = await call(t, '+447700900009');
  await stranger.run('take_message', { name: 'Sarah', message: 'We accept the offer on Larkspur Close.', category: 'offer', property: 'Larkspur Close' });
  assert.equal((await aishas()).seller_replied, false);
  // The seller: urgent, texted to the negotiator, and shown on the offer.
  const sarah = await call(t, '+447700900001');
  await sarah.run('take_message', { name: 'Sarah Collins', message: "We'd like to accept the first-time buyer's offer.", category: 'offer', property: 'Larkspur Close', urgency: 'today' });
  const m = (await repo.messagesFrom(t.id, '+447700900001'))[0];
  assert.equal(m.details.seller_reply, true);
  assert.ok(sarah.sent.some((x) => /^URGENT from the AI receptionist: Sarah Collins/.test(x.body)), 'the negotiator is texted');
  assert.ok(!sarah.sent.some((x) => x.to === '+447700900003'), 'the buyer hears nothing until staff confirm');
  assert.equal((await aishas()).seller_replied, true);
  await repo.setMessageStatus(t.id, m.id, 'read');
  assert.equal((await aishas()).seller_replied, false);
});

test('get_sale_progress: each party hears their part, checked by number; anyone else nothing; never a date not recorded', async () => {
  const t = await agency('ea-progress');
  const sales = await repo.listSales(t.id);
  const ask = async (phone: string | null, property: string) => (await call(t, phone)).run('get_sale_progress', { property });
  const home = (key: string) => t.profile.listings!.find((l) => l.key === key)!;
  const words = (key: string) => `${home(key).number} ${home(key).street}`;
  // Ben, buying 3 Kingfisher Way: the milestones, no dates yet, keys on completion day.
  const ben = await ask('+447700900004', words('kingfisher_3'));
  assert.equal(ben.verified, true, JSON.stringify(ben));
  assert.equal(ben.role, 'the buyer');
  assert.deepEqual(ben.done, ['memorandum of sale sent', 'solicitors instructed']);
  assert.equal(ben.exchange, 'no exchange date recorded yet');
  assert.equal(ben.completion, 'no completion date recorded yet');
  assert.match(String(ben.keys), /^released on completion day/);
  assert.match(String(ben.next), /Never predict a date/);
  // Liam, exchanged: the completion date as recorded.
  const liam = await ask('+447700900008', words('willow_gardens_8'));
  assert.equal(liam.exchange, 'contracts have been exchanged');
  assert.match(String(liam.completion), /^completion is set for Friday 9 October$/);
  // The buyer's solicitor on 2 Elm Court: the milestones and who takes requests, no dates or keys.
  const nadia = await ask('+447700900005', words('elm_court_2'));
  assert.equal(nadia.role, "the buyer's solicitor");
  assert.ok((nadia.done as string[]).length === 5);
  assert.equal(nadia.keys, undefined);
  assert.match(String(nadia.next), /^Requests and paperwork go to \w+: take a message/);
  // The agent in the chain: the chain line only.
  const harper = await ask('+447700900006', words('elm_court_2'));
  assert.equal(harper.role, 'an agent in the chain');
  assert.match(String(harper.chain), /Harper & Co/);
  assert.equal(harper.done, undefined);
  // A broker added to the file: the agreed price and the memorandum date only.
  const sale = sales.find((s) => s.listing_key === 'kingfisher_3')!;
  await repo.updateSale(t.id, sale.id!, { parties: [...sale.parties, { role: 'broker', name: 'Pat Broker', firm: 'Clear Mortgages', phone: '07700 900160' }] });
  const broker = await ask('+447700900160', words('kingfisher_3'));
  assert.deepEqual([broker.role, broker.agreed_price, broker.done], ["the buyer's broker", `£${(sale.agreed_pence / 100).toLocaleString('en-GB')}`, undefined]);
  assert.match(String(broker.memorandum), /^sent [A-Z][a-z]+day \d+ [A-Z][a-z]+$/);
  // Ben asking about someone else's sale, and a stranger: the same refusal; three misses end the tries.
  assert.equal((await ask('+447700900004', words('elm_court_2'))).verified, false);
  const stranger = await call(t, '+447700900009');
  for (let i = 0; i < 3; i++) assert.equal((await stranger.run('get_sale_progress', { property: words('kingfisher_3') })).verified, false);
  assert.match(String((await stranger.run('get_sale_progress', { property: words('kingfisher_3') })).next), /No more tries/);
  // A home with no sale: nothing said about whether there is one.
  const none = await ask('+447700900004', '22 Albion Road');
  assert.deepEqual([none.verified, none.done], [false, undefined]);
});

test('a message from the buyer or seller in a sale under way is the progressor\'s, and pulling out is urgent', async () => {
  const t = await agency('ea-sale-message');
  const msg = async (phone: string, args: Record<string, unknown>) => {
    const c = await call(t, phone);
    await c.run('take_message', { name: 'Caller', ...args });
    return (await repo.messagesFrom(t.id, phone))[0];
  };
  // Ben, buying 3 Kingfisher Way: filed as general for the manager by the model, it reaches Dan, urgent.
  const ben = await msg('+447700900004', { message: "Our mortgage has been refused; we'll have to pull out.", category: 'general', for: 'manager' });
  assert.deepEqual([ben.category, ben.for_staff, ben.urgency, ben.details.listing], ['progression', 'dan', 'urgent', 'kingfisher_3']);
  // Asking for someone by name is respected.
  const named = await msg('+447700900004', { message: 'Please ask Jess to call me.', category: 'general', for: 'Jess' });
  assert.equal(named.for_staff, 'jess');
  // A complaint stays a complaint; someone not in a sale is routed as before.
  assert.equal((await msg('+447700900004', { message: 'I want to complain about the delays.', category: 'complaint' })).category, 'complaint');
  assert.equal((await msg('+447700900161', { message: "Our mortgage has been refused.", category: 'general' })).category, 'general');
});

test('a viewing moved to someone else never goes to the one with a personal interest in the home', async () => {
  // The move generalised from tables to people (HANDOFF.md, known items): the home's rule holds there too.
  const t = await agency('ea-move-interest');
  const home = t.profile.listings!.find((l) => l.personal_interest)!;
  const interested = home.personal_interest!.staff;
  const other = t.profile.booking!.resources.find((r) => r.kind === 'staff' && r.key !== interested && r.services.includes('viewing') && (!r.days || r.days.includes(2)))!;
  const made = await repo.createBooking(t, { service: 'viewing', date: TUE, time: '15:00', party_size: 1, name: 'Ivy Lane', phone: '+447700900321', staff: other.key, source: 'console', listing: viewingRules(home, t.profile, 'viewing') }, NOW);
  assert.ok(made.ok, JSON.stringify(made));
  const r = await repo.moveBooking(t, made.booking.reference, interested);
  assert.equal(r.ok, false);
  assert.match((r as { message: string }).message, /has a personal interest in this home, so can't show it/);
});

test('live slips, 8 October: the position from the caller\'s words, "Thursday" is the nearest one, and why they\'re moving asked once', async () => {
  const t = await agency('ea-slips-8oct');
  // The buyer's position said, and left out of the booking: taken from their words, and a valuation offered for the flat to sell.
  {
    const { run, ctx } = await call(t, '+447700900133');
    ctx.state.heard.push('My name is Joe Carter. My postcode is BK3 4RT. I have a flat to sell that isn\'t on the market yet, and a mortgage agreed in principle.');
    const r = await run('create_booking', { property: 'albion_22', date: SAT, time: '11:15', name: 'Joe Carter', postcode: 'BK3 4RT' });
    assert.equal(r.booked, true, JSON.stringify(r));
    const row = (await repo.getBookingByReference(t.id, String(r.reference)))!;
    assert.deepEqual((row.details as any).position, { selling: 'not_on_market', funding: 'mortgage_aip' });
    assert.match(String(r.next), /Offer a free valuation/);
  }
  {
    const { run, ctx } = await call(t, '+447700900135');
    ctx.state.heard.push("I'm a first-time buyer, paying cash.");
    const r = await run('create_booking', { property: 'albion_22', date: SAT, time: '12:00', name: 'Ada Fox', postcode: 'BK3 4RT', funding: 'mortgage not yet' });
    assert.equal(r.booked, true, JSON.stringify(r));
    const row = (await repo.getBookingByReference(t.id, String(r.reference)))!;
    assert.deepEqual((row.details as any).position, { first_time_buyer: true, selling: 'nothing', funding: 'mortgage_not_yet' }, 'what the model passed wins');
  }
  // "Thursday at 10" on a Wednesday is tomorrow: next week's is checked once; "next Thursday" or "the 15th" is not.
  {
    const { run, ctx } = await call(t, '+447700900136');
    ctx.state.heard.push("I'm looking for a valuation. Could we do Thursday at 10 am? I'm moving for work within three months.");
    const v = { date: '2026-10-15', time: '10:00', name: 'Jo Bloggs', address: '12 Hawthorn Way', postcode: 'BK3 7XY', other_agent: 'none' };
    const first = await run('book_valuation', v);
    assert.equal(first.booked, false);
    assert.match(String(first.message), /they said Thursday, and the nearest Thursday is Thursday 8 October \(tomorrow\), not Thursday 15 October/);
    assert.equal((await run('book_valuation', v)).booked, true, 'asked once, never in a loop');
    const later = await call(t, '+447700900137');
    later.ctx.state.heard.push('Could we do next Thursday at 10 am? We are moving for work in a few months.');
    assert.equal((await later.run('book_valuation', { ...v, time: '11:30', name: 'Al Ray' })).booked, true);
  }
  // Neither why nor when: asked once.
  {
    const { run, ctx } = await call(t, '+447700900138');
    ctx.state.heard.push('I want a valuation of 3 Elm Close please.');
    const v = { date: THU, time: '15:30', name: 'Bea Holt', address: '3 Elm Close', postcode: 'BK3 7XY' };
    const asked = await run('book_valuation', v);
    assert.equal(asked.booked, false);
    assert.match(String(asked.message), /what's prompting the move and roughly when they'd like to be moved, and whether their home is on the market with another agent/);
    // A placeholder is no name (live, 8 October: booked for "[Caller's Name]").
    assert.match(String((await run('book_valuation', { ...v, name: "[Caller's Name]" })).message), /name/i);
    const anyway = await run('book_valuation', v);
    assert.equal(anyway.booked, true, `if they would rather not say: ${JSON.stringify(anyway)}`);
  }
});

test('a known buyer who books a valuation of their own home stays a buyer, with the position they gave before', async () => {
  const t = await agency('ea-keep-roles');
  const phone = '+447700900777';
  await repo.upsertBuyer(t.id, phone, 'Kit Lane', { roles: ['buyer'], position: { first_time_buyer: false, selling: 'not_on_market', funding: 'mortgage_aip' }, last_contact: NOW.toISOString(), source: 'phone' }, true);
  const { run } = await call(t, phone);
  const booked = await run('book_valuation', { date: THU, time: '11:00', name: 'Kit Lane', address: '4 Linnet Way', postcode: 'BK2 3QT', purpose: 'sale', reason: 'moving up', timescale: 'within six months', other_agent: 'none' });
  assert.equal(booked.booked, true, JSON.stringify(booked));
  const kit = (await repo.findBuyer(t.id, phone))!;
  assert.deepEqual([...(kit.details.roles ?? [])].sort(), ['buyer', 'seller']);
  assert.ok((await repo.listBuyers(t.id)).some((b) => b.phone === phone), 'still in Applicants');
  // A viewing booked without any position words keeps what they said before.
  const viewing = await run('check_availability', { property: 'albion_22', date: SAT, time: '11:00' });
  assert.ok(viewing.available !== undefined);
  await run('create_booking', { property: 'albion_22', date: SAT, time: '11:15', name: 'Kit Lane', phone: '07700 900777' });
  assert.equal((await repo.findBuyer(t.id, phone))!.details.position?.funding, 'mortgage_aip');
});
