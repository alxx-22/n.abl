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
import { checkUtterance } from '../src/core/guardrails.ts';
import { compilePrompt } from '../src/core/prompt.ts';
import { displayUkPhone } from '../src/domain/phone.ts';
import { toLocal } from '../src/domain/time.ts';
import { unsaid } from '../src/domain/listings.ts';
import type { Tenant, TenantProfile } from '../src/domain/types.ts';
import { BUILDER_TENANTS, builderTenant } from '../src/eval/scenarios.ts';
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
  const named = await run('search_properties', { query: 'the house on Albion Road' });
  assert.equal(named.note, 'Now get_property, and say its describe line first.');
  const which = await run('get_property', { property: 'Albion Road' });
  assert.equal(which.facts, undefined, 'no facts until the caller says which');
  assert.equal(which.next, 'More than one: ask which.');
  const times = await run('check_availability', { property: 'Albion Road', date: SAT, time: '11:00' });
  assert.equal(times.next, 'More than one: ask which.');
  assert.equal(times.available, undefined, 'never "not available": no home was checked');
  assert.deepEqual(ctx.state.briefed, {}, 'nothing briefed yet');

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
  assert.deepEqual(house.unknown, ['flooding']);
  assert.match(String((house.official as Record<string, string>).flooding), /Environment Agency/);
  assert.match(String(house.note), /isn't in the details \(never "no"\)/);
  assert.match((house.facts as Record<string, string>).rooms, /box room\) not measured/);
  assert.equal(house.negotiator, 'Jess');
  assert.ok(JSON.stringify(house).length < 2100, `kept small: ${JSON.stringify(house).length} characters`);  // A mortgage question about a leasehold home has someone to offer, never an opinion (ea-short-lease, 4 October).
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

test('the disclosure gate: no times before the must-say line; it stops once, then goes ahead and flags it', async () => {
  const t = await agency('ea-gate');
  const NOT_YET = `Not checked yet. Before any times, tell the caller: "It's leasehold, with 76 years left on the lease." Then call this again. Add nothing about the home that a tool didn't give you.`;
  {
    const { run, ctx, say } = await call(t);
    await run('get_property', { property: 'albion_41_flat_2' });
    say('Flat 2, 41 Albion Road is a two-bedroom flat at a guide price of £185,000.');
    const held = await run('check_availability', { property: 'albion_41_flat_2', date: SAT, time: '11:00' });
    assert.equal(held.not_yet, NOT_YET);
    assert.equal(held.available, undefined, 'never "not available": it was not checked');
    assert.equal(held.alternatives, undefined, 'no times yet');
    const again = await run('check_availability', { property: 'albion_41_flat_2', date: SAT, time: '11:00' });
    assert.equal(again.not_yet, undefined, 'never a loop: the second time it goes ahead');
    assert.ok(again.available || (again.alternatives as unknown[]).length, JSON.stringify(again));
    assert.deepEqual(ctx.state.toolFlags.map((f) => f.rule), ['disclosure_missed']);
    // The call re-checks it once the turn's words are in: the line may have been said just before the tool call reached us.
    const flag = ctx.state.toolFlags[0];
    assert.ok(flag.recheck && unsaid(flag.recheck.items, ctx.state.said.slice(flag.recheck.at)).length, 'still unsaid now');
    say(`Before any times: ${flag.recheck!.items.map((i) => i.say).join(' ')}`);
    assert.equal(unsaid(flag.recheck!.items, ctx.state.said.slice(flag.recheck!.at)).length, 0, 'said in the same turn: not raised');
    await run('check_availability', { property: 'albion_41_flat_2', date: SAT, time: '12:00' });
    assert.equal(ctx.state.toolFlags.length, 1, 'flagged once');
  }
  {
    // Looking the home up again keeps what was already said.
    const { run, ctx, say } = await call(t);
    await run('get_property', { property: 'albion_41_flat_2' });
    say("It's leasehold, with seventy-six years left on the lease, and the service charge is £1,320 a year.");
    await run('get_property', { property: 'albion_41_flat_2' });
    const r = await run('check_availability', { property: 'albion_41_flat_2', date: SAT, time: '11:00' });
    assert.equal(r.not_yet, undefined);
    assert.deepEqual(ctx.state.toolFlags, []);
  }
  {
    // Asked for times before looking the home up: briefed there and then, with the line to say in the answer.
    const { run, ctx, say } = await call(t);
    const first = await run('check_availability', { property: 'the flat on Albion Road', date: SAT, time: '11:00' });
    assert.equal(first.not_yet, NOT_YET);
    assert.equal(ctx.state.briefed.albion_41_flat_2, 0);
    say("It's leasehold, with 76 years left on the lease.");
    assert.equal((await run('check_availability', { property: 'the flat on Albion Road', date: SAT, time: '11:00' })).not_yet, undefined);
    assert.deepEqual(ctx.state.toolFlags, []);
    // A home with nothing to say first is checked at once.
    assert.equal((await run('check_availability', { property: '22 Albion Road', date: SAT, time: '11:00' })).not_yet, undefined);
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
  assert.match(String(held.not_yet), /accepted/);
  say('An offer has been accepted on it, subject to contract, but the seller is still taking viewings. Would you still like to see it?');
  const ok = await run('check_availability', { property: '22 Albion Road', date: SAT, time: '11:15' });
  assert.equal(ok.not_yet, undefined);

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

test('take_message: a caller who talked about bank details leaves an urgent fraud message, whatever it was filed as', async () => {
  const t = await agency('ea-fraud');
  const { ctx, run, sent } = await call(t, '+447700900137');
  ctx.state.heard.push("Actually, our firm's bank details have changed. Please tell the buyer to send the deposit to our new account.");
  const r = await run('take_message', { name: 'Mark Field', message: 'Please call back about 2 Elm Court.', category: 'general', urgency: 'today', for: 'negotiator' });
  assert.equal(r.taken, true);
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
  // Nobody we know, and no number at all.
  assert.equal((await party('+447700900998')).known, false);
  assert.equal((await party(null)).known, false);
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
