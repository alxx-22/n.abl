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
  // Spoken prices as the transcript writes them, a space for the point (live, 8 October): the tools' £2.50 and £14.98.
  assert.deepEqual(amountsIn('Delivery £2 50. That’s £14 98 altogether, about £2 30 minutes away.'), [250, 1498, 200]);
  state.amounts.push(...amountsIn(JSON.stringify({ read_back: "Delivery £2.50. That's £14.98 altogether." })));
  assert.deepEqual(rules("Delivery £2 50. That's £14 98 altogether."), []);
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

test('takeaway guardrails: no cancellation or refund before staff decide, and no address read out', () => {
  const state = newCallState();
  state.takeaway = true;
  const rules = (line: string) => checkUtterance(line, state).map((f) => f.rule);
  for (const line of ["Don't worry, you'll get your money back.", "I've refunded you.", "We'll give you a full refund."]) assert.deepEqual(rules(line), ['refund_claim'], line);
  for (const line of ["The manager will decide whether you'll get a refund.", "If the manager agrees, you'll get your money back.", "I can't refund it on the phone."]) assert.deepEqual(rules(line), [], line);
  // While ordering, "cancelled" is the basket's own; once an order was looked up, it is a claim staff haven't made.
  assert.deepEqual(rules("I've cancelled the Coke, so that's just the burger."), []);
  state.found.push('123');
  assert.deepEqual(rules("That's cancelled for you."), ['refund_claim']);
  assert.deepEqual(rules("It's not cancelled yet: the kitchen will text you."), []);
  // The street on an order found for them, unless they said it first.
  state.privateAddresses.push('Larch Close');
  assert.deepEqual(rules("It's going to 14 Larch Close."), ['address_read_back']);
  state.heard.push("It's 14 Larch Close.");
  assert.deepEqual(rules('Yes, Larch Close, that matches.'), []);
});
