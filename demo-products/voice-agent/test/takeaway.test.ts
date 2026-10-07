// The takeaway preset (presets/takeaway.md): its answers, defaults, cleaning
// and checks. The receptionist's side has its own tests as it is built.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VOICE_NAMES } from '../src/domain/voices.ts';
import { dealCandidates, dealComplete, dealSection } from '../src/presets/food/deals.ts';
import { defaultAnswers, type TakeawayAnswers } from '../src/presets/takeaway/answers.ts';
import { sanitiseTakeaway } from '../src/presets/takeaway/sanitise.ts';
import { STEPS } from '../src/presets/takeaway/steps.ts';
import { validateTakeaway } from '../src/presets/takeaway/validate.ts';

const named = (): TakeawayAnswers => {
  const a = defaultAnswers();
  a.basics.name = 'Firebird Chicken & Burgers';
  return a;
};
// The sample menu's allergens are examples until an owner checks their own: the builder always says so.
const SAMPLE = 'warning menu: The allergens are examples until you check them.';
const said = (a: TakeawayAnswers) => validateTakeaway(a).map((i) => `${i.level} ${i.step}: ${i.message}`);
const issues = (edit: (a: TakeawayAnswers) => void) => {
  const a = named();
  edit(a);
  return said(sanitiseTakeaway(a)).filter((i) => i !== SAMPLE);
};

test('takeaway: the defaults are Firebird, open late at the weekend, ready to start with a name', () => {
  const a = sanitiseTakeaway(named());
  assert.deepEqual(said(a), [SAMPLE], 'nothing missing, and only the sample allergens to check');
  a.menu.allergens_are_examples = false;
  assert.deepEqual(validateTakeaway(a), [], 'once checked, nothing at all');
  a.menu.allergens_are_examples = true;
  assert.deepEqual(sanitiseTakeaway(structuredClone(a)), a, 'stable');
  assert.deepEqual(said(sanitiseTakeaway(defaultAnswers())), ['error basics: Give the takeaway a name.', SAMPLE]);
  assert.ok(VOICE_NAMES.has(a.basics.voice));
  // Every day 12 till 11; Friday and Saturday till midnight.
  assert.deepEqual(a.hours.days.map((d) => d.services[0].close), ['23:00', '23:00', '23:00', '23:00', '23:00', '24:00', '24:00']);
  const o = a.ordering;
  assert.deepEqual([o.collection.prep_minutes, o.collection.slot_minutes, o.collection.per_slot], [15, 15, 4]);
  assert.deepEqual([o.delivery.fee_pence, o.delivery.min_order_pence, o.delivery.free_over_pence, o.delivery.extra_minutes], [250, 1200, 3000, 25]);
  assert.deepEqual(o.delivery.zones, [{ code: 'NG5', fee_pence: 350, min_order_pence: 1500 }, { code: 'NG9', fee_pence: 350, min_order_pence: 1500 }]);
  assert.deepEqual(o.delivery.drivers, ['Kai', 'Priya', 'Tom']);
  assert.equal(o.timed_orders, true);
  assert.deepEqual([a.money.payment, a.money.pay_driver, a.money.card_minimum_pence], ['either', 'cash_or_card', null]);
  assert.equal(a.policies.halal, 'chicken');
  assert.equal(a.menu.allergen_statement, "We cook in a shared kitchen and fryers, so we can't rule out traces of any allergen.");
  assert.equal(a.menu.categories.flatMap((c) => c.items).length, 33);
  assert.deepEqual(a.deals.map((d) => [d.name, d.price_pence]), [['Burger meal', 899], ['Chicken box', 799], ['Pizza night', 1999]]);
  for (const d of a.deals) assert.ok(dealComplete(a.menu, d), d.name);
  assert.deepEqual(STEPS.map((s) => s.key), ['basics', 'hours', 'ordering', 'menu', 'deals', 'money', 'policies']);
  // A fresh copy every time: a builder edits its defaults in place.
  defaultAnswers().deals[0].parts.length = 0;
  assert.equal(defaultAnswers().deals[0].parts.length, 3);
});

test('takeaway: a Burger meal is £2.50 more than a burger and £1.49 less than the three separately', () => {
  const a = defaultAnswers();
  const items = a.menu.categories.flatMap((c) => c.items);
  const price = (k: string) => items.find((i) => i.key === k)!.price_pence;
  const meal = a.deals.find((d) => d.key === 'burger_meal')!;
  assert.equal(meal.price_pence - price('classic_burger'), 250);
  assert.equal(price('classic_burger') + price('fries') + price('cola') - meal.price_pence, 149);
  assert.deepEqual(dealCandidates(a.menu, meal.parts[0]).map((i) => i.key), ['classic_burger', 'cheeseburger', 'double_cheeseburger', 'chicken_burger', 'spicy_chicken_burger', 'veggie_burger']);
  assert.deepEqual(meal.parts[0].upcharge_pence, { cheeseburger: 50, double_cheeseburger: 250, spicy_chicken_burger: 30 });
  // Every burger's bun has sesame; the fries and the cans do not.
  assert.ok(dealCandidates(a.menu, meal.parts[0]).every((i) => i.allergens.includes('sesame')));
  assert.ok([...dealCandidates(a.menu, meal.parts[1]), ...dealCandidates(a.menu, meal.parts[2])].every((i) => !i.allergens.includes('sesame')));
});

test('takeaway: cleaning survives junk, keeps the shape, and treats a missing list differently from an empty one', () => {
  for (const junk of [undefined, null, {}, 'junk', 42, [], { ordering: 'x', menu: 7, deals: 'no', money: [], policies: null }]) {
    const a = sanitiseTakeaway(junk);
    assert.deepEqual(Object.keys(a), Object.keys(defaultAnswers()), JSON.stringify(junk));
    assert.deepEqual(sanitiseTakeaway(structuredClone(a)), a, `stable from ${JSON.stringify(junk)}`);
  }
  // No deals saved at all: the sample's. Deals saved as none: none.
  assert.equal(sanitiseTakeaway({}).deals.length, 3);
  assert.deepEqual(sanitiseTakeaway({ deals: [] }).deals, []);
  const a = sanitiseTakeaway({
    money: { payment: 'bitcoin', pay_driver: 'cash', card_minimum_pence: '500' },
    policies: { halal: 'some', hygiene_rating: 9, offers: 'x'.repeat(400) },
    kitchen: { last_orders_minutes: -5, big_order_mains: 'lots' },
  });
  assert.deepEqual([a.money.payment, a.money.pay_driver, a.money.card_minimum_pence], ['either', 'cash', 500]);
  assert.deepEqual([a.policies.halal, a.policies.hygiene_rating, a.policies.offers.length], ['chicken', 5, 300]);
  assert.deepEqual(a.kitchen, { last_orders_minutes: 0, big_order_mains: 6 });
  assert.equal(sanitiseTakeaway({ money: { card_minimum_pence: null } }).money.card_minimum_pence, null);
  assert.equal(sanitiseTakeaway({ policies: { hygiene_rating: null } }).policies.hygiene_rating, null);
  // Deals are bounded: a name, at most five choices, sensible prices, keys made unique.
  const deals = sanitiseTakeaway({ deals: [
    { name: 'Meal', price_pence: 99999, parts: [{ label: 'Burger', category_key: 'burgers', choose: 9, upcharge_pence: { cheeseburger: 50, nothing_here: 20, double_cheeseburger: -5 } }] },
    { name: 'Meal', price_pence: 500, parts: [] },
    { price_pence: 500, parts: [] },
  ] }).deals;
  assert.deepEqual(deals.map((d) => [d.key, d.price_pence]), [['meal', 10000], ['meal_2', 500]]);
  assert.deepEqual(deals[0].parts[0], { label: 'Burger', category_key: 'burgers', choose: 4, upcharge_pence: { cheeseburger: 50 } });
});

test('takeaway: a menu draft that renames a section keeps its deals; one that drops it says which deal is left out', () => {
  // Drafted again, the burgers come back as "Burgers" under another key: the choice follows them on the next save.
  const a = named();
  a.menu.categories.find((c) => c.key === 'burgers')!.key = 'our_burgers';
  const relinked = sanitiseTakeaway(a);
  assert.equal(relinked.deals[0].parts[0].category_key, 'our_burgers');
  assert.equal(dealSection(relinked.menu, relinked.deals[0].parts[0])!.label, 'Burgers');
  assert.deepEqual(said(relinked), [SAMPLE]);
  // A draft with no pizzas at all: Pizza night is left out, and the builder says so on the deals step.
  const b = named();
  b.menu.categories = b.menu.categories.filter((c) => c.key !== 'pizzas');
  const cleaned = sanitiseTakeaway(b);
  const pizza = cleaned.deals.find((d) => d.key === 'pizza_night')!;
  assert.equal(pizza.parts[0].category_key, 'pizzas', 'kept, so a later draft with pizzas links it again');
  assert.equal(dealComplete(cleaned.menu, pizza), false);
  assert.deepEqual(said(cleaned), [
    SAMPLE,
    'warning deals: Pizza night: the "Pizzas" choice has nothing on the menu to choose from, so the deal is left out until you fix it.',
  ]);
});

test('takeaway: validation says what is missing, on the step it belongs to', () => {
  assert.deepEqual(issues((a) => { a.ordering.collection.enabled = false; a.ordering.delivery.enabled = false; }), ['error ordering: Turn on collection or delivery: a takeaway takes orders.']);
  assert.deepEqual(issues((a) => (a.ordering.delivery.districts = [])), ['error ordering: List the postcode districts you deliver to, like NG1.']);
  assert.deepEqual(issues((a) => (a.ordering.delivery.drivers = [])), ['warning ordering: Add your drivers, so the back office can send deliveries out.']);
  assert.deepEqual(issues((a) => (a.ordering.delivery.free_over_pence = 1000)), ['warning ordering: Free delivery starts at or below the minimum order, so every delivery is free.']);
  assert.deepEqual(issues((a) => (a.ordering.delivery.free_over_pence = null)), [], 'never free is fine');
  assert.deepEqual(issues((a) => Object.assign(a.money, { payment: 'collection', pay_driver: 'no' })), ['error money: Delivery orders need paying: take card on the phone, or let the driver take payment.']);
  assert.deepEqual(issues((a) => (a.deals[0].price_pence = 0)), ['error deals: Burger meal: give it a price.']);
  assert.deepEqual(issues((a) => (a.deals[1].parts = [])), ['error deals: Chicken box: add at least one choice, like "any burger".']);
  assert.deepEqual(issues((a) => (a.deals[0].price_pence = 1200)), ["warning deals: Burger meal costs as much as its cheapest choices bought separately, so the receptionist won't suggest it as a saving."]);
  assert.deepEqual(issues((a) => a.policies.faqs.push({ q: 'Do you do vegan cheese?', a: '' })), ['warning policies: 1 question needs both the question and its answer before the receptionist can use it.']);
});
