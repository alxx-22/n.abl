// The pub preset (presets/pub.md, milestone 1): the defaults compiled into
// four rooms, food times as the booking windows, and a menu with drinks;
// children's hours on a booking; a dog noted; gluten-free only for the
// marked lager; the age and ID answers; and the seeded week. Milestone 2:
// what's on (fixtures, the weekly events, the quiz), the bar during a
// match, the quiz as a team booking, and today's ales.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { checkUtterance } from '../src/core/guardrails.ts';
import { zonedToUtc } from '../src/domain/time.ts';
import { newCallState, runTool, type ToolContext } from '../src/core/tools.ts';
import type { Tenant } from '../src/domain/types.ts';
import { defaultAnswers, type PubAnswers } from '../src/presets/pub/answers.ts';
import { compilePub } from '../src/presets/pub/compile.ts';
import { PB_PEOPLE } from '../src/presets/pub/personas.ts';
import { planPubSeed } from '../src/presets/pub/seed.ts';
import { sanitisePub, validatePub } from '../src/presets/pub/validate.ts';

/** Thursday 15 October 2026, 3pm BST. */
const THURSDAY = new Date('2026-10-15T14:00:00Z');
let db: Db;
let repo: Repo;
before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

const named = (edit?: (a: PubAnswers) => void) => {
  const a = defaultAnswers();
  a.basics.name = 'The Weaver’s Arms';
  edit?.(a);
  return sanitisePub(a);
};
const fresh = (slug: string) => repo.upsertTenant(compilePub(named(), { slug }));

async function call(tenant: Tenant, callerPhone: string) {
  const ctx: ToolContext = {
    tenant, repo, now: () => THURSDAY, callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone,
    state: newCallState(), demoCards: [], sms: { send: async () => 'simulated' }, telephony: null, action: () => {},
  };
  ctx.state.pub = true;
  return { ctx, run: (name: string, args: Record<string, unknown>) => runTool(name, args, ctx) as Promise<any> };
}

test('pub: the defaults are four rooms, tables booked at food times, and only the sample allergens to check', () => {
  const a = named();
  assert.deepEqual(validatePub(a).map((i) => i.message), ['The allergens are examples until you check them.']);
  const p = compilePub(a, { slug: 'weavers' });
  assert.equal(p.business_type, 'pub');
  assert.ok(p.core_facts.some((f) => /beer garden \(6 tables, walk-in only\)/.test(f) && /the loft \(2 tables, private hire by enquiry\)/.test(f)), p.core_facts.join('\n'));
  assert.ok(p.core_facts.includes('Food from 12 noon until 9pm; Sunday roasts until 6pm. Drinks until close.'), p.core_facts.join('\n'));
  // Booked to eat: until half an hour before food stops, earlier on a Sunday.
  assert.deepEqual(p.booking!.services[0].windows, [{ days: [0], first: '12:00', last: '17:30' }, { days: [1, 2, 3, 4, 5, 6], first: '12:00', last: '20:30' }]);
  assert.ok(p.booking!.resources.filter((r) => r.area === 'garden' || r.area === 'loft').every((r) => !r.services.length), 'the garden and the Loft are not booked');
  assert.deepEqual(p.pub, {
    children_until: '21:00', food: { from: '12:00', until: '21:00', sunday_until: '18:00' }, taxi: 'Lace City Cars (example) on 0115 496 0999.',
    events: [{ day: 6, time: '21:00', title: 'Live music', place: 'the bar', free: true }],
    on_tap: ['Lace Market Bitter (example)', 'Trent Pale (example)', 'Weaver’s Gold (example)', 'Castle Rock Stout (example)'],
    no_bar_bookings_for_matches: true,
  });
  assert.match(p.knowledge!.find((k) => k.q === 'Can my 16 or 17-year-old have a drink with a meal?')!.a, /^With a table meal, a 16 or 17-year-old may have beer, wine or cider if an adult with them buys it\./);
  assert.match(p.knowledge!.find((k) => k.q === 'What ID do you accept?')!.a, /Challenge 25.*certified digital ID app.*staff’s decision/);
  assert.match(p.knowledge!.find((k) => k.q === 'Do you have gluten-free beer?')!.a, /^Yes: Gluten-free lager \(bottle\), marked gluten-free\./);
});

test('pub on a call: a table with children finishes by 9pm; a dog is noted; gluten-free only for the marked lager', async () => {
  const t = await fresh('weavers-calls');
  const c = await call(t, '+447700900975');
  const late = await c.run('check_availability', { date: '2026-10-17', time: '20:30', party_size: 4, children: 2 });
  assert.deepEqual([late.available, late.reason, late.latest_with_children], [false, 'children_hours', '19:00']);
  assert.match(late.message, /^Children are welcome until 9pm, so a table with children has to finish by then: the latest start for 4 is 7pm\./);
  assert.notEqual((await c.run('check_availability', { date: '2026-10-17', time: '20:30', party_size: 4 })).reason, 'children_hours', 'adults only, any time');
  const booked = await c.run('create_booking', { date: '2026-10-17', time: '19:00', party_size: 4, children: 2, dog: true, area: 'dining', name: 'Gary Mills' });
  assert.equal(booked.booked, true, JSON.stringify(booked));
  const kept = (await repo.getBookingByReference(t.id, booked.reference))!;
  assert.deepEqual([kept.notes, kept.tags?.includes('children'), kept.tags?.includes('dog')], ['2 children. A dog', true, true]);  // Booked past 9 without saying: asked once whether any are under 16; adults only, then booked.
  const asked = await (await call(t, '+447700900983')).run('create_booking', { date: '2026-10-17', time: '20:30', party_size: 2, area: 'dining', name: 'Kate Moss' });
  assert.match(String(asked.message), /^Not done yet: this table runs past 9pm, when it's adults only. Ask once whether any of the party are under 16/);
  // A call that ends "booked" with nothing booked is told so, once.
  const none = await call(t, '+447700900984');
  assert.match(String((await none.run('end_call', { outcome: 'booked' })).message), /^Nothing has been booked in this call/);
  // Moved later, the children still finish by 9.
  assert.equal((await c.run('modify_booking', { reference: booked.reference, time: '20:00' })).reason, 'children_hours');
  // Gluten-free: the marked lager only.
  assert.match((await c.run('get_item_details', { item: 'gluten-free lager' })).gluten, /^Marked gluten-free/);
  assert.equal((await c.run('get_item_details', { item: 'cask ale' })).gluten, undefined, 'brewed with barley');
  // The lager, by name, may be called gluten-free; the ale still may not, though the lager was looked up first.
  assert.deepEqual(checkUtterance('Our gluten-free lager is gluten-free, yes.', c.ctx.state).map((f) => f.rule), []);
  assert.deepEqual(checkUtterance("Yes, the cask ale's gluten-free.", c.ctx.state).map((f) => f.rule), ['gluten_free_claim']);
});

test("pub what's on: the manager's fixtures, the weekly events and the quiz; never a match not listed; the bar first come during one", async () => {
  const t = await fresh('weavers-whats-on');
  await repo.addPubEvent(t.id, { starts_at: zonedToUtc('2026-10-17', '15:00', 'Europe/London'), title: 'Nottingham Forest v Arsenal (example)', kind: 'sport', place: 'the bar’s big screens', source: 'console' });
  const c = await call(t, '+447700900985');
  // Before anything is looked up, "we're showing it" is invented.
  assert.deepEqual(checkUtterance("Yes, we're showing it on the big screen.", c.ctx.state).map((x) => x.rule), ['invented_fixture']);
  const forest = await c.run('whats_on', { what: 'the Forest game' });
  assert.deepEqual([forest.listed, forest.events.length, forest.events[0].what, forest.events[0].time, forest.events[0].day], [true, 1, 'Nottingham Forest v Arsenal', '3pm', 'Saturday 17 October']);
  assert.match(forest.bar, /^During a match the bar's tables aren't booked: it's first come./);
  assert.deepEqual(checkUtterance("Yes, we're showing it at 3pm.", c.ctx.state).map((x) => x.rule), [], 'after whats_on answered');
  const leicester = await c.run('whats_on', { what: 'the Leicester game' });
  assert.equal(leicester.listed, false);
  assert.match(leicester.message, /^"the Leicester game" isn't on our list this week. Say so plainly: never that we'll probably show it/);
  const week = await c.run('whats_on', {});
  assert.deepEqual(week.events.map((e: any) => `${e.day} ${e.time} ${e.what}`), ['today 8pm The quiz', 'Saturday 17 October 3pm Nottingham Forest v Arsenal', 'Saturday 17 October 9pm Live music']);
  // The bar's tables aren't booked during the match; with no room named, the dining room, said to have no screen.
  const bar = await c.run('check_availability', { date: '2026-10-17', time: '15:30', party_size: 4, area: 'bar' });
  assert.deepEqual([bar.available, bar.reason], [false, 'match_on']);
  assert.match(bar.message, /^Nottingham Forest v Arsenal is on at 3pm, and the bar's tables aren't booked during a match: it's first come then. Offer the dining room/);
  const any = await c.run('check_availability', { date: '2026-10-17', time: '15:30', party_size: 4 });
  assert.equal(any.available, true, JSON.stringify(any));
  assert.match(any.match, /This is in the dining room, which has no screen: say so.$/);
  assert.notEqual((await c.run('check_availability', { date: '2026-10-17', time: '19:00', party_size: 4, area: 'bar' })).reason, 'match_on', 'long after the match');
});

test('pub quiz and Today: a team booked with its name and the entry; the ales on today, as the manager set them', async () => {
  const t = await fresh('weavers-quiz');
  const quiz = t.profile.booking!.services.find((s) => s.key === 'quiz')!;
  assert.deepEqual([quiz.windows, quiz.max_party, quiz.per_person], [[{ days: [4], first: '20:00', last: '20:00' }], 6, { adult_pence: 200, child_pence: 0, child_under: 0 }]);
  const c = await call(t, '+447700900986');
  const free = await c.run('check_availability', { service: 'Quiz team', date: '2026-10-22', time: '20:00', party_size: 5, children: 0 });
  assert.deepEqual([free.available, free.total], [true, '£10.00 for 5'], JSON.stringify(free));
  const team = await c.run('create_booking', { service: 'Quiz team', date: '2026-10-22', time: '20:00', party_size: 5, children: 0, team: 'The Pint Glasses', area: 'dining', name: 'Rob Kerr' });
  assert.equal(team.booked, true, JSON.stringify(team));
  assert.equal((await repo.getBookingByReference(t.id, team.reference))!.notes, 'Team: The Pint Glasses');
  assert.equal((await c.run('check_availability', { service: 'Quiz team', date: '2026-10-22', time: '20:00', party_size: 8 })).available, false, 'teams are up to six');
  // The ales: the usual list until the manager changes today's.
  assert.deepEqual((await c.run('get_menu', { category: 'ales' })).ales_on_today, ['Lace Market Bitter', 'Trent Pale', 'Weaver’s Gold', 'Castle Rock Stout']);
  await repo.setTonight(t.id, { date: '2026-10-15', sold_out: ['roast_beef'], notice: null, on_tap: ['Trent Pale (example)', 'Harvest Moon (example)'] });
  const ales = await c.run('get_menu', { category: 'ales' });
  assert.deepEqual(ales.ales_on_today, ['Trent Pale', 'Harvest Moon']);
  assert.match(ales.say, /^The ales on today: Trent Pale, Harvest Moon. Say only these.$/);
  assert.equal((await c.run('get_item_details', { item: 'roast beef' })).available, 'sold out today');
});

test("pub: the seeded week books tables at food times, children only on tables that finish by 9, Gary's Sunday lunch", () => {
  const p = compilePub(named(), { slug: 'weavers' });
  for (const seed of [1, 7]) {
    const { bookings, messages } = planPubSeed(p, THURSDAY, seed);
    assert.ok(bookings.length > 25, `${bookings.length} bookings`);
    assert.ok(bookings.every((b) => b.area_key === 'bar' || b.area_key === 'dining'), 'only the bar and the dining room');
    const nine = (b: (typeof bookings)[number]) => b.ends_at.toISOString().slice(11, 16) <= '20:00';
    assert.ok(bookings.filter((b) => b.tags.includes('children')).every(nine), 'children finish by 9pm (8pm UTC)');
    const gary = bookings.find((b) => b.phone === PB_PEOPLE.regular.phone)!;
    assert.deepEqual([gary.party_size, gary.starts_at.toISOString()], [4, '2026-10-18T12:00:00.000Z']);
    assert.ok(messages.some((m) => /Loft/.test(m.body)));
    // Two fixtures in the coming week, real clubs marked as examples; quiz teams on Thursday.
    const { events } = planPubSeed(p, THURSDAY, seed);
    assert.deepEqual(events!.map((e) => `${e.starts_at.toISOString()} ${e.title}`), ['2026-10-17T14:00:00.000Z Nottingham Forest v Arsenal (example)', '2026-10-18T15:30:00.000Z Liverpool v Manchester City (example)']);
    assert.ok(bookings.filter((b) => b.service_key === 'quiz').every((b) => /^Team: /.test(b.notes ?? '')), 'every team named');
  }
});
