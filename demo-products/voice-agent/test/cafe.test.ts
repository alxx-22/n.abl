// The café preset (presets/cafe.md, milestone 1): the defaults compiled into
// tables, afternoon tea and a menu; walk-in under the booking size;
// afternoon tea's notice, longer for a diet, and its price per person; the
// gluten-free wording and its guardrail; and the seeded week. Milestone 2:
// orders to collect, breakfast's end, and Today (sold out, a busy notice).
// Milestone 3: after the visit, and other callers.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { checkUtterance } from '../src/core/guardrails.ts';
import { capabilities } from '../src/core/prompt.ts';
import { armReaction } from '../src/core/reaction.ts';
import { newCallState, runTool, type ToolContext } from '../src/core/tools.ts';
import type { Tenant } from '../src/domain/types.ts';
import { defaultAnswers, type CafeAnswers } from '../src/presets/cafe/answers.ts';
import { compileCafe } from '../src/presets/cafe/compile.ts';
import { CF_PEOPLE } from '../src/presets/cafe/personas.ts';
import { planCafeSeed } from '../src/presets/cafe/seed.ts';
import { sanitiseCafe, validateCafe } from '../src/presets/cafe/validate.ts';

/** Thursday 15 October 2026, 11am BST. */
const THURSDAY = new Date('2026-10-15T10:00:00Z');
let db: Db;
let repo: Repo;
before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

const named = (edit?: (a: CafeAnswers) => void) => {
  const a = defaultAnswers();
  a.basics.name = 'Wren Street Café';
  edit?.(a);
  return sanitiseCafe(a);
};
const fresh = (slug: string) => repo.upsertTenant(compileCafe(named(), { slug }));

async function call(tenant: Tenant, callerPhone: string, now = THURSDAY) {
  const ctx: ToolContext = {
    tenant, repo, now: () => now, callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone,
    state: newCallState(), demoCards: [], sms: { send: async () => 'simulated' }, telephony: null, action: () => {},
  };
  ctx.state.cafe = true;
  return { ctx, run: (name: string, args: Record<string, unknown>) => runTool(name, args, ctx) as Promise<any> };
}

test('café: the defaults are tables, afternoon tea and a menu in Nottingham city centre, with only the sample allergens to check', () => {
  const a = named();
  assert.deepEqual(validateCafe(a).map((i) => i.message), ['The allergens are examples until you check them.']);
  const p = compileCafe(a, { slug: 'wren' });
  assert.equal(p.business_type, 'cafe');
  assert.match(p.core_facts[0], /^Wren Street Café: .*, at 14 Wren Street \(example\), Nottingham NG1\.$/);
  // The booking size is a prompt rule, not a fact as well; the knowledge says it with the busy times.
  assert.match(p.knowledge!.find((k) => k.q === 'Can we just turn up? Do you take bookings?')!.a, /^Tables for 5 or more can be booked, and afternoon tea; smaller tables are walk-in. Saturday/);
  const [table, tea] = p.booking!.services;
  assert.deepEqual([table.key, table.min_party, tea.key, tea.notice_days, tea.diet_notice_days, tea.per_person], ['table', 5, 'afternoon_tea', 1, 2, { adult_pence: 2450, child_pence: 1200, child_under: 12 }]);
  // 2pm doesn't fit a Sunday (closes at 3); 3:30 only fits a Saturday (closes at 5).
  assert.deepEqual(tea.windows, [{ days: [0, 1, 2, 3, 4, 5, 6], first: '12:00', last: '12:00' }, { days: [1, 2, 3, 4, 5, 6], first: '14:00', last: '14:00' }, { days: [6], first: '15:30', last: '15:30' }]);
  assert.ok(p.core_facts.some((f) => f.includes('sittings at 12 noon, 2pm (not Sundays) and 3:30pm (Saturdays only).')), p.core_facts.join('\n'));
  assert.ok(p.booking!.resources.filter((r) => r.area === 'outside').every((r) => !r.services.length), 'outside is walk-in');
  assert.equal(p.knowledge!.find((k) => k.q === 'Can I breastfeed in the café?')!.a, 'Of course: anywhere you like.');
  assert.match(p.menu!.allergen_statement, /one kitchen that uses nuts, gluten, milk and eggs/);
  assert.deepEqual(p.cafe, { busy_times: 'Saturday from 11 till 2 is our busiest; weekday mornings and mid-afternoons are quieter.', breakfast_until: '11:30', kitchen_closes_before: 30 });
});

test('café: cleaning keeps diet notice at least the notice, sittings tidy, and the builder says what is wrong', () => {
  const a = sanitiseCafe({ afternoon_tea: { notice_days: 3, diet_notice_days: 1, sittings: ['16:30', '12:00', 'noon', '12:00'] }, booking: { min_party: 12 } });
  assert.deepEqual([a.afternoon_tea.diet_notice_days, a.afternoon_tea.sittings], [3, ['12:00', '16:30']]);
  const issues = validateCafe(a).map((i) => `${i.step}: ${i.message}`);
  assert.ok(issues.includes("booking: The 16:30 sitting runs past closing every day, so it can't be booked."), issues.join('\n'));
  assert.ok(issues.includes('booking: Bookings start at 12, more than the largest party you take (8), so no table can be booked.'), issues.join('\n'));
});

test('café on a call: two are walk-in, six are booked; afternoon tea needs a day, gluten-free two, priced per person', async () => {
  const t = await fresh('wren-calls');
  const c = await call(t, '+447700900940');
  const two = await c.run('check_availability', { date: '2026-10-17', time: '12:00', party_size: 2 });
  assert.deepEqual([two.available, two.reason], [false, 'walk_in']);
  assert.match(two.message, /^Tables for fewer than 5 are walk-in: we don't book them, so never promise one is free or held\. Say when it's usually busy: Saturday from 11 till 2/);
  const six = await c.run('create_booking', { date: '2026-10-17', time: '12:00', party_size: 6, name: 'Kate Lowe', accessible: true });
  assert.equal(six.booked, true, six.message);
  // Afternoon tea: today is too soon; tomorrow is fine; a coeliac guest needs two days.
  const today = await c.run('check_availability', { service: 'Afternoon tea', date: '2026-10-15', time: '14:00', party_size: 2 });
  assert.deepEqual([today.available, today.reason, today.earliest], [false, 'notice', '2026-10-16']);
  const fri = await c.run('check_availability', { service: 'Afternoon tea', date: '2026-10-16', time: '14:00', party_size: 4, children: 1 });
  assert.deepEqual([fri.available, fri.price, fri.total], [true, '£24.50 a person, £12.00 for under-12s', '£85.50 for 4, 1 of them children']);
  assert.match(fri.next, /^Read back the afternoon tea: the day, the sitting, how many \(children too\), the total \(£85\.50 for 4, 1 of them children\)/);
  c.ctx.state.heard.push("One of us is coeliac.");
  const coeliac = await c.run('check_availability', { service: 'Afternoon tea', date: '2026-10-16', time: '14:00', party_size: 4 });
  assert.deepEqual([coeliac.reason, coeliac.earliest], ['notice', '2026-10-17']);
  assert.match(coeliac.message, /^Afternoon tea needs booking 2 days ahead for a gluten-free version: the earliest is Saturday 17 October\. Offer that, or the standard afternoon tea on the day they asked for the rest of the table/);
  // The diet covers the coeliac guest: booked at once, the caller's words kept for the kitchen.
  const sat = await c.run('create_booking', { service: 'Afternoon tea', date: '2026-10-17', time: '14:00', party_size: 4, name: 'Helen Ward', diet: 'gluten-free for 1' });
  assert.deepEqual([sat.booked, sat.total], [true, '£98.00 for 4'], JSON.stringify(sat));
  assert.match(sat.next, /^Say the total, £98.00 for 4, paid on the day/);
  const kept = (await repo.getBookingByReference(t.id, sat.reference))!;
  assert.deepEqual([kept.notes, /coeliac/i.test(kept.allergies ?? '')], ['Diet: gluten-free for 1', true], kept.allergies ?? 'no allergies');
  // Moving a group down to four makes it a walk-in table.
  assert.equal((await c.run('modify_booking', { reference: six.reference, party_size: 3 })).reason, 'walk_in');
  // A sitting the day doesn't have is never booked or moved to, even unchecked: Sunday shuts at 3, so only noon.
  const sunday = await c.run('create_booking', { service: 'Afternoon tea', date: '2026-10-18', time: '14:00', party_size: 2, name: 'Helen Ward' });
  assert.deepEqual([sunday.booked, sunday.reason, sunday.message], [false, 'outside_hours', '2pm is not a bookable time for Afternoon tea on Sunday 18 October. That day: 12 noon.']);
  const moved = await c.run('modify_booking', { reference: sat.reference, date: '2026-10-18' });
  assert.deepEqual([moved.changed, moved.reason], [false, 'outside_hours']);
  assert.equal((await c.run('modify_booking', { reference: sat.reference, date: '2026-10-18', time: '12:00' })).changed, true);
});

test('café: "gluten-free" only for marked food, the menu says so, and the guardrail catches the claim; a reaction is 999 first', async () => {
  const t = await fresh('wren-gluten');
  const c = await call(t, '+447700900941');
  const brownie = await c.run('get_item_details', { item: 'brownie' });
  assert.equal(brownie.gluten, 'Made without gluten ingredients, but in a kitchen that uses flour: say exactly that, and never call it gluten-free.');
  assert.equal((await c.run('get_item_details', { item: 'carrot cake' })).gluten, undefined, 'it has gluten');
  assert.match((await c.run('get_menu', { free_from: 'gluten' })).say, /Never call any of them gluten-free: the kitchen uses flour\. Say just that: no disclaimer of your own\.$/);
  const nuts = await c.run('get_menu', { free_from: 'nuts' });
  assert.ok(!nuts.dishes.some((d: any) => d.name === 'Carrot cake'));
  assert.deepEqual(checkUtterance("Yes, the brownie's completely gluten-free.", c.ctx.state).map((f) => f.rule), ['gluten_free_claim']);
  assert.deepEqual(checkUtterance("We can't call it gluten-free: it's made without gluten ingredients.", c.ctx.state).map((f) => f.rule), []);
  assert.equal(armReaction(c.ctx.state, "My daughter's lips are swelling after the cake"), true);
});

test('café orders to collect: oat milk free, a real time, paid on collection; breakfast stops at 11:30; Today sells out and slows', async () => {
  const t = await fresh('wren-orders');
  const o = t.profile.ordering!;
  assert.deepEqual([o.collection, o.payment, o.prep_minutes, o.delivery], [true, 'collection', 10, undefined]);
  // Orders stop when food does, half an hour before closing.
  assert.ok(o.hours.some((h) => h.days.includes(4) && h.close === '15:30'), JSON.stringify(o.hours));
  assert.equal(capabilities(t.profile).payments, false, 'nothing is ever paid on the phone');
  const c = await call(t, '+447700900942');
  for (const args of [{ item: 'flat white', options: ['oat milk'] }, { item: 'flat white' }, { item: 'bacon sandwich' }]) {
    const r = await c.run('add_to_order', args);
    assert.equal(typeof r.added, 'string', JSON.stringify(r));
  }
  const when = await c.run('set_fulfilment', { type: 'collection', time: 'asap' });
  assert.deepEqual([when.ok, when.time, when.busy], [true, '11:10', undefined]);
  assert.match(JSON.stringify(await c.run('review_order', {})), /£12.10/, 'two flat whites and a bacon sandwich, the oat milk free');
  // Half an hour said as +00:30 is understood; a time after food stops is out of hours, never full (a live call, 12 October).
  assert.equal((await c.run('set_fulfilment', { type: 'collection', time: '+00:30' })).time, '11:30');
  assert.equal((await c.run('set_fulfilment', { type: 'collection', time: '22:45' })).message, 'Orders are only taken for 8am to 3:30pm today. It is 11am now.');
  // At 11:45 breakfast is over.
  const late = await call(t, '+447700900943', new Date('2026-10-15T10:45:00Z'));
  assert.match((await late.run('add_to_order', { item: 'bacon sandwich' })).message, /^Breakfast is served until 11:30am./);
  // Today: carrot cake sold out, said for the day with the other cakes; a busy notice puts the time back.
  await repo.setTonight(t.id, { date: '2026-10-15', sold_out: ['carrot_cake'], notice: { kind: 'long_waits', minutes: 30 } });
  assert.match((await late.run('add_to_order', { item: 'carrot cake' })).message, /^Carrot cake is sold out today. Other cakes and bakes today: Victoria sponge, Chocolate brownie, Scone with jam and cream./);
  assert.equal((await late.run('get_item_details', { item: 'carrot cake' })).available, 'sold out today');
  const busy = await late.run('set_fulfilment', { type: 'collection' });
  assert.deepEqual([busy.time, busy.busy], ['12:15', "We're busy today: orders are taking about 30 minutes. Say so with the time."]);
});

test("café after the visit: ill after eating is the owner's today, with NHS 111; never advice, a guess at the cause, or fault", async () => {
  const t = await fresh('wren-after');
  const c = await call(t, CF_PEOPLE.unwell.phone);
  const ill = await c.run('take_message', { name: 'Chris Hall', message: 'Ill in the night after the tuna melt at lunch yesterday.', category: 'unwell' });
  assert.deepEqual([ill.taken, ill.category, ill.urgency], [true, 'unwell', 'today']);
  assert.match(ill.note, /your GP or NHS 111, or 999 if it's serious/);
  assert.equal((await c.run('take_message', { name: 'Sophie Hart', message: 'Off sick today.', category: 'staff' })).urgency, 'urgent');
  assert.match((await c.run('take_message', { name: 'Rachel Green', message: 'A whole carrot cake for next Thursday.', category: 'cake_order' })).note, /Never promise it or give a price/);
  const rows = await db.query<any>(`select category, urgency from public.voice_messages where call_id = $1 and kind = 'message' order by created_at`, [c.ctx.callId]);
  assert.deepEqual(rows.map((r) => `${r.category} ${r.urgency}`), ['unwell today', 'staff urgent', 'cake_order null']);
  const rules = (s: string) => checkUtterance(s, c.ctx.state).map((x) => x.rule);
  assert.deepEqual(rules('It sounds like a stomach bug, so drink plenty of water.'), ['medical_advice']);
  assert.deepEqual(rules("It couldn't have been our food."), ['cause_guessed']);
  assert.deepEqual(rules('It was probably the tuna.'), ['cause_guessed']);
  assert.deepEqual(rules("It's our fault, and we'll pay for it."), ['liability_admitted']);
  assert.deepEqual(rules("I'm so sorry. If you're still unwell, do call your GP or NHS 111, or 999 if it's serious."), []);
  assert.deepEqual(rules("I can't say what caused it: the owner will look into it."), []);
  assert.deepEqual(rules('Their medical disclaimer: Not medical advice or diagnosis, see a healthcare professional or seek care.'), ['disclaimer'], 'a live call, 13 October');
  // The caller's own "half twelve" may be said back as twelve thirty; a time nobody said may not.
  c.ctx.state.heard.push('A table for two on Saturday at half twelve, please.');
  assert.deepEqual(rules("That twelve thirty time is when we're busiest."), []);
  assert.deepEqual(rules('Come at half one instead.'), ['invented_time']);
  // Which cakes are nut-free: the cakes only, with the kitchen warning and no disclaimer.
  const nutFree = await c.run('get_menu', { category: 'cakes', free_from: 'nuts' });
  assert.deepEqual(nutFree.dishes.map((d: any) => d.name), ['Victoria sponge', 'Chocolate brownie', 'Scone with jam and cream', 'Vegan banana bread']);
  assert.match(nutFree.say, /one kitchen that uses nuts.*Say just that: no disclaimer of your own\.$/);
});

test("café: the seeded week books only groups and afternoon teas, Helen's tea on Saturday", () => {
  const p = compileCafe(named(), { slug: 'wren' });
  for (const seed of [1, 7]) {
    const { bookings } = planCafeSeed(p, THURSDAY, seed);
    assert.ok(bookings.length > 10);
    assert.ok(bookings.filter((b) => b.service_key === 'table').every((b) => b.party_size >= 5), 'only groups at tables');
    assert.ok(bookings.filter((b) => b.service_key === 'afternoon_tea').every((b) => ['11:00', '13:00', '14:30'].includes(b.starts_at.toISOString().slice(11, 16))), 'teas at the sittings');
    const helen = bookings.find((b) => b.phone === CF_PEOPLE.regular.phone)!;
    // Today's orders to collect, and none with breakfast after 11:30.
    const { orders } = planCafeSeed(p, THURSDAY, seed);
    assert.ok(orders.length >= 5, `${orders.length} orders`);
    const breakfast = new Set(p.menu!.categories.find((x) => x.key === 'breakfast')!.items.map((i) => i.key));
    assert.ok(orders.every((o) => o.due_at.toISOString().slice(11, 16) < '10:30' || o.lines.every((l) => !breakfast.has(l.item_key))), 'breakfast after 11:30');
    assert.deepEqual([helen.service_key, helen.starts_at.toISOString()], ['afternoon_tea', '2026-10-17T13:00:00.000Z']);
    for (const r of p.booking!.resources) {
      const mine = bookings.filter((b) => b.resource_key === r.key).sort((a, b) => +a.starts_at - +b.starts_at);
      for (let i = 1; i < mine.length; i++) assert.ok(mine[i].starts_at >= mine[i - 1].ends_at, `${r.key} overlaps`);
    }
  }
});
