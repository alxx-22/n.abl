// What a takeaway's receptionist must never say (presets/takeaway.md §8), and
// its own rules in the instructions (§4.5).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkUtterance } from '../src/core/guardrails.ts';
import { compilePrompt } from '../src/core/prompt.ts';
import { newCallState } from '../src/core/tools.ts';
import { amountsIn } from '../src/domain/amounts.ts';
import { knownTimes } from '../src/domain/clock-times.ts';
import { defaultAnswers } from '../src/presets/takeaway/answers.ts';
import { compileTakeaway } from '../src/presets/takeaway/compile.ts';
import { sanitiseTakeaway } from '../src/presets/takeaway/sanitise.ts';

const firebird = () => {
  const a = defaultAnswers();
  a.basics.name = 'Firebird Chicken & Burgers';
  return compileTakeaway(sanitiseTakeaway(a), { slug: 'firebird' });
};
const prompt = () => compilePrompt(firebird(), { now: new Date('2026-10-09T18:00:00Z'), callerPhone: null, demoCards: [], canTransfer: false, channel: 'phone' });

test('takeaway guardrails: no wait, price or card fee that no tool, fact or caller gave', () => {
  const state = newCallState();
  state.takeaway = true;
  // As a call starts: what its instructions say may be said.
  state.times.push(...knownTimes(prompt()));
  state.amounts.push(...amountsIn(prompt()));
  const rules = (line: string) => checkUtterance(line, state).map((f) => f.rule);
  // Nothing checked yet: a wait from memory.
  assert.deepEqual(rules("It'll be ready about 7:30pm."), ['invented_time']);
  assert.deepEqual(rules("We're open till 11pm tonight."), [], 'from the hours');
  // What get_wait_times said may be said, however it is put.
  const wait = { collection: 'about 15 minutes, so around 7:15pm', delivery: 'about 40 minutes, so around 7:40pm' };
  state.times.push(...knownTimes(JSON.stringify(wait)));
  for (const line of ['Collection is about 15 minutes, so around quarter past seven.', 'Delivery would be around 7:40pm.']) assert.deepEqual(rules(line), [], line);
  // Prices: the facts, the tools and the caller's own.
  assert.deepEqual(rules('Delivery to NG9 is three pounds fifty.'), []);
  assert.deepEqual(rules("As a meal that's £1.20 less."), ['invented_price'], 'a saving no tool gave');
  state.amounts.push(...amountsIn(JSON.stringify({ deal_hint: "As a Burger meal, that's £1.49 less." })));
  assert.deepEqual(rules("As a Burger meal, that's one pound forty-nine less."), []);
  // No card surcharges, ever; saying there is none is right.
  assert.deepEqual(rules("There's a 50p charge for card."), ['card_surcharge']);
  assert.deepEqual(rules("There's no extra charge for card."), []);
  assert.deepEqual(rules("We don't charge extra for paying by card."), []);
  // A restaurant's calls are not checked for these.
  assert.deepEqual(checkUtterance("It'll be ready about 7:30pm, and there's a 50p charge for card.", newCallState()), []);
});

test("takeaway prompt: its own ordering rules in place of the restaurant's, and nothing about deposits or tables", () => {
  const p = prompt();
  assert.match(p, /for delivery, the postcode first \(get_wait_times says if we deliver there/);
  assert.match(p, /Waits and times come only from get_wait_times or set_fulfilment: never from memory, and never sooner when pushed\./);
  assert.match(p, /Meal deals: offer one only when add_to_order returns meal_hint or deal_hint, once/);
  assert.match(p, /Where's my order: find_order\. Never read an address back/);
  assert.match(p, /for a meal deal, choice by choice/);
  assert.match(p, /Stay on Firebird Chicken & Burgers' business\./);
  assert.doesNotMatch(p, /Deposits|table|seating|create_booking with/i);
  assert.ok(p.length < 7000, `${p.length} characters`);
  // Each fact once: how ordering, delivery and halal work are core facts, not policies too.
  assert.equal(p.match(/Our chicken is halal/g)!.length, 1);
  assert.equal(p.match(/Delivery to NG1/g)!.length, 1);
});
