// The takeaway's meal deals through the real tools (presets/takeaway.md §4.2):
// sold as menu items with their choices, an allergy answered choice by
// choice, each offer made once and a no that stands, and a deal taking the
// place of the lines it is made of.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { newCallState, runTool, type Action, type ToolContext } from '../src/core/tools.ts';
import { DECLINED } from '../src/domain/deals.ts';
import { allergyQuestionDish } from '../src/core/kitchen.ts';
import type { Tenant } from '../src/domain/types.ts';
import { defaultAnswers } from '../src/presets/takeaway/answers.ts';
import { compileTakeaway } from '../src/presets/takeaway/compile.ts';
import { sanitiseTakeaway } from '../src/presets/takeaway/sanitise.ts';

const FRIDAY_7PM = new Date('2026-10-09T18:00:00Z');
let db: Db;
let repo: Repo;

before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

async function firebird(slug: string): Promise<Tenant> {
  const a = defaultAnswers();
  a.basics.name = 'Firebird Chicken & Burgers';
  return repo.upsertTenant(compileTakeaway(sanitiseTakeaway(a), { slug }));
}

async function call(tenant: Tenant) {
  const actions: Action[] = [];
  const ctx: ToolContext = {
    tenant, repo, now: () => FRIDAY_7PM, callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone: '+447700900321',
    state: newCallState(), demoCards: [], sms: { send: async () => 'simulated' }, telephony: null, action: (x) => actions.push(x),
  };
  return { ctx, run: (name: string, args: Record<string, unknown>) => runTool(name, args, ctx) as Promise<any> };
}

const CAVEAT = "We cook in a shared kitchen and fryers, so we can't rule out traces of any allergen.";

test('meal deals: sold as menu items, each choice an option group, listing every allergen any choice has', async () => {
  const t = await firebird('tk-deal-menu');
  const menu = t.profile.menu!;
  assert.deepEqual(menu.categories[0].items.map((i) => [i.name, i.price_pence]), [['Burger meal', 899], ['Chicken box', 799], ['Pizza night', 1999]]);
  const meal = menu.categories[0].items[0];
  assert.deepEqual(meal.modifier_groups, ['burger_meal_1', 'burger_meal_2', 'burger_meal_3', 'burger_extras']);
  assert.deepEqual(menu.modifier_groups.burger_meal_1.options.map((o) => [o.name, o.price_pence]), [
    ['Classic beef burger', 0], ['Cheeseburger', 50], ['Double cheeseburger', 250], ['Crispy chicken burger', 0], ['Firebird spicy burger', 30], ['Veggie burger', 0],
  ]);
  assert.deepEqual([menu.modifier_groups.burger_meal_3.min, menu.modifier_groups.burger_meal_3.max], [1, 1]);
  assert.deepEqual(menu.modifier_groups.burger_meal_3.options[0].aliases, ['coke', 'cola']);
  assert.ok(meal.allergens.includes('sesame') && meal.allergens.includes('soya'));
  assert.deepEqual(menu.deals!.find((d) => d.item_key === 'pizza_night')!.includes, ['garlic_bread']);
  // "What's sesame-free?" never lists a deal any of whose choices has it.
  const c = await call(t);
  const free = await c.run('get_menu', { free_from: 'sesame' });
  assert.ok(!JSON.stringify(free).includes('Burger meal'), JSON.stringify(free).slice(0, 300));
});

test('meal deals: an allergy question is answered choice by choice, with the caveat, never "safe"', async () => {
  const t = await firebird('tk-deal-allergy');
  const c = await call(t);
  c.ctx.state.heard.push("My son's allergic to sesame. Is the Burger meal OK?");
  const meal = await c.run('get_item_details', { item: 'Burger meal' });
  assert.equal(meal.allergen_answer, `Burger meal, choice by choice. Burger: every choice contains sesame. Side: Fries doesn't contain sesame as an ingredient. Drink: none of the choices contains sesame as an ingredient. ${CAVEAT}`);
  assert.doesNotMatch(meal.allergen_answer, /\bsafe\b/);
  // Sesame still in mind and gluten asked too: each allergen answered on its own, so "gluten or sesame" never reads as both.
  c.ctx.state.heard.push('And what about gluten in Pizza night?');
  const both = await c.run('get_item_details', { item: 'Pizza night' });
  assert.match(both.allergen_answer, /Pizzas: every choice contains gluten; none of the choices contains sesame as an ingredient\./);
  const g = await call(t);
  g.ctx.state.heard.push('Is there gluten in Pizza night?');
  const pizza = await g.run('get_item_details', { item: 'Pizza night' });
  assert.equal(pizza.allergen_answer, `Pizza night, choice by choice. Pizzas: every choice contains gluten. Drinks: none of the choices contains gluten as an ingredient. Always included: Garlic bread contains gluten. ${CAVEAT}`);
  // Milk in the Chicken box: every chicken choice has it; of the sides, onion rings do and fries may have traces.
  const fresh = await call(t);
  fresh.ctx.state.heard.push('Is there milk in the Chicken box?');
  const box = await fresh.run('get_item_details', { item: 'Chicken box' });
  assert.match(box.allergen_answer, /^Chicken box, choice by choice\. Chicken: every choice contains milk\. Side: Onion rings contains milk; Fries doesn't, as an ingredient\. Fries may contain traces\./);
  assert.deepEqual(box.choices, ['Chicken: Six hot wings, Three chicken strips, Popcorn chicken, Two pieces of chicken', 'Side: Fries, Onion rings', 'Drink: Coca-Cola, Diet Coke, Fanta Orange, Sprite']);
});

test('meal deals: offered once as a meal, once as a saving, and taken as one line with its extras', async () => {
  const t = await firebird('tk-deal-offer');
  const c = await call(t);
  const burger = await c.run('add_to_order', { item: 'Classic beef burger', options: ['extra cheese'] });
  assert.equal(burger.meal_hint, 'Make it a Burger meal for £2.50 more: any burger with regular fries and a can.');
  assert.deepEqual(burger.swap, { deal: 'Burger meal', options: ['Classic beef burger'], replaces: [1] });
  assert.deepEqual(burger.still_to_choose, ['Side', 'Drink']);
  // The caller carries on ordering: once fries and a can are in, the saving is said instead.
  assert.equal((await c.run('add_to_order', { item: 'Fries', options: ['regular'] })).meal_hint, undefined);
  const can = await c.run('add_to_order', { item: 'Coke', options: ['can'] });
  assert.equal(can.deal_hint, "As a Burger meal, that's £1.49 less.");
  assert.deepEqual(can.swap, { deal: 'Burger meal', options: ['Classic beef burger', 'Fries', 'Coca-Cola'], replaces: [1, 2, 3] });
  c.ctx.state.heard.push('Oh go on then, make it a meal.');
  const taken = await c.run('add_to_order', { item: 'Burger meal', options: can.swap.options, replaces: can.swap.replaces });
  assert.deepEqual(taken.replaced, [1, 2, 3]);
  assert.deepEqual(c.ctx.state.lines.map((l) => [l.name, l.modifiers.map((m) => m.name)]), [['Burger meal', ['Classic beef burger', 'Fries', 'Coca-Cola', 'extra cheese']]]);
  assert.equal(taken.running_total, '£9.79', 'the meal, and the extra cheese kept from the burger');
  // A deal in the order: nothing more is offered.
  const more = await c.run('add_to_order', { item: 'Classic beef burger' });
  assert.equal(more.meal_hint ?? more.deal_hint, undefined);
});

test('meal deals: a no stands for the rest of the call; "no onions" is an order, not a no', async () => {
  const t = await firebird('tk-deal-no');
  const c = await call(t);
  assert.ok((await c.run('add_to_order', { item: 'Classic beef burger' })).meal_hint);
  c.ctx.state.heard.push('No thanks, just the burger.');
  assert.equal((await c.run('add_to_order', { item: 'Fries', options: ['regular'] })).deal_hint, undefined);
  assert.equal((await c.run('add_to_order', { item: 'Coke', options: ['can'] })).deal_hint, undefined, 'never offered again');
  assert.equal(c.ctx.state.lines.length, 3);
  const d = await call(t);
  await d.run('add_to_order', { item: 'Cheeseburger' });
  d.ctx.state.heard.push('No onions on that, please. And fries and a Coke.');
  await d.run('add_to_order', { item: 'Fries', options: ['regular'] });
  assert.ok((await d.run('add_to_order', { item: 'Coke', options: ['can'] })).deal_hint, 'still offered');
  for (const no of ['No.', 'no thanks', 'Nah, just as it is', 'No, I\'m fine', 'not the meal, thanks']) assert.match(no, DECLINED, no);
  for (const order of ['No onions please', 'Not too spicy', 'Nothing else', 'Now a Coke']) assert.doesNotMatch(order, DECLINED, order);
});

test('meal deals: two meals with different choices, an extra charged, and a missing choice asked for', async () => {
  const t = await firebird('tk-deal-choices');
  const c = await call(t);
  const first = await c.run('add_to_order', { item: 'Burger meal', options: ['cheeseburger', 'fries', 'fanta'] });
  assert.match(first.added, /Burger meal \(Cheeseburger, Fries, Fanta Orange\) — £9\.49/);
  const second = await c.run('add_to_order', { item: 'Burger meal', options: ['spicy chicken burger', 'fries', 'coke', 'extra cheese'] });
  assert.match(second.added, /Burger meal \(Firebird spicy burger, Fries, Coca-Cola, extra cheese\) — £10\.09/);
  assert.equal(second.running_total, '£19.58');
  const missing = await c.run('add_to_order', { item: 'Burger meal', options: ['double cheeseburger', 'fries'] });
  assert.equal(missing.added, false);
  assert.equal(missing.question, 'Burger meal needs a choice of Drink: Coca-Cola, Diet Coke, Fanta Orange, Sprite.');
});

test('meal deals: "a cheeseburger meal" is the Burger meal with a cheeseburger, and a burger "with fries" points to the meal', async () => {
  const t = await firebird('tk-deal-named');
  const c = await call(t);
  // Live, 8 October: "cheeseburger meal" went in as a Cheeseburger, its fries and Fanta refused as options.
  const named = await c.run('add_to_order', { item: 'cheeseburger meal', options: ['fries', 'Fanta'] });
  assert.match(named.added, /^1 × Burger meal \(Cheeseburger, Fries, Fanta Orange\) — £9\.49$/);
  assert.match((await c.run('add_to_order', { item: 'veggie burger meal', options: ['Veggie burger', 'fries', 'coke'] })).added, /^1 × Burger meal \(Veggie burger, Fries, Coca-Cola\)/, 'the choice said twice, taken once');
  assert.match((await c.run('add_to_order', { item: 'Burger meal', options: ['classic beef burger', 'fries', 'sprite'] })).added, /^1 × Burger meal \(Classic beef burger/);
  assert.equal((await c.run('get_item_details', { item: 'the cheeseburger meal' })).name, 'Burger meal');
  assert.match((await c.run('add_to_order', { item: 'cheeseburger' })).added, /^1 × Cheeseburger — £6\.99$/, 'a cheeseburger on its own is still a cheeseburger');
  // Live, 8 October: a spicy burger "with fries" was refused, and the fries went in on their own.
  const side = await c.run('add_to_order', { item: 'Firebird spicy burger', options: ['extra cheese', 'fries'] });
  assert.equal(side.added, false);
  assert.equal(side.as_a_meal, `fries comes with the Burger meal. Ask if they'd like it as a Burger meal, or the items on their own. For the meal: add_to_order with item "Burger meal" and options ["Firebird spicy burger","extra cheese","fries"].`);
  const meal = await c.run('add_to_order', { item: 'Burger meal', options: JSON.parse(side.as_a_meal.match(/options (\[.*\])\.$/)![1]) });
  assert.equal(meal.question, 'Burger meal needs a choice of Drink: Coca-Cola, Diet Coke, Fanta Orange, Sprite.');
});

test('ordering: a size already in the words is taken; a missing one is asked for, and nothing is added until it is', async () => {
  const t = await firebird('tk-choices-in-words');
  const c = await call(t);
  // Live, 8 October: "regular fries" and "Coke" were each asked about, and neither reached the order.
  assert.match((await c.run('add_to_order', { item: 'regular fries' })).added, /Fries \(regular\) — £2\.49/);
  assert.match((await c.run('add_to_order', { item: 'a can of Coke' })).added, /Coca-Cola \(can\) — £1\.50/);
  assert.match((await c.run('add_to_order', { item: '12 inch margherita' })).added, /Margherita \(12 inch\) — £11\.99/);
  assert.match((await c.run('add_to_order', { item: 'large fries', options: ['large'] })).added, /Fries \(large\) — £3\.49/, 'said twice, taken once');
  const ask = await c.run('add_to_order', { item: 'fries' });
  assert.deepEqual([ask.added, ask.question], [false, 'Fries needs a choice of Size: regular, large.']);
  assert.match(ask.nothing_added, /^Nothing was added yet\. Ask the caller this/);
  assert.equal(c.ctx.state.lines.length, 4);
});

test('meal deals: a deal missing a choice is asked for and added again as the same deal, never as separate items', async () => {
  const t = await firebird('tk-deal-missing');
  const c = await call(t);
  // Live, 8 October: a Pizza night without its drinks became two 12 inch pizzas and two cans.
  const ask = await c.run('add_to_order', { item: 'Pizza night', options: ['Margherita', 'Pepperoni'] });
  assert.equal(ask.question, 'Pizza night needs a choice of Drinks: Coca-Cola, Diet Coke, Fanta Orange, Sprite.');
  assert.equal(ask.nothing_added, 'Nothing was added yet. Ask the caller this, then call add_to_order again with item "Pizza night" and options ["Margherita","Pepperoni"] plus their answer: it is all one Pizza night, never separate items.');
  assert.match((await c.run('add_to_order', { item: 'Pizza night', options: ['Margherita', 'Pepperoni', 'coke', 'fanta'] })).added, /^1 × Pizza night \(Margherita, Pepperoni, Coca-Cola, Fanta Orange\) — £19\.99$/);
});

test('meal deals: an allergy question about a dish is sent to get_item_details, and "no cheese" is not one', async () => {
  const menu = (await firebird('tk-allergy-q')).profile.menu!;
  // Live, 8 October: "Is the Burger meal OK for him?" was answered from memory, never looked up.
  assert.equal(allergyQuestionDish(menu, 'My son is allergic to sesame. Is the Burger meal OK for him?'), 'Burger meal');
  assert.equal(allergyQuestionDish(menu, 'Does the double cheeseburger contain gluten?'), 'Double cheeseburger');
  assert.equal(allergyQuestionDish(menu, 'Two cheeseburgers, no cheese on one.'), null);
  assert.equal(allergyQuestionDish(menu, "I'm allergic to nuts. What can I have?"), null, 'no dish named');
});
