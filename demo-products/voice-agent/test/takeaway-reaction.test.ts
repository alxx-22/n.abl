// A severe allergic reaction on a takeaway's call (presets/takeaway.md §4.2):
// heard in the caller's words, 999 before anything else, every tool held
// until it is said, and a reply that puts anything else first corrected.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { checkUtterance } from '../src/core/guardrails.ts';
import { REACTION_SCRIPT, armReaction, detectReaction, noteReactionSaid, said999 } from '../src/core/reaction.ts';
import { newCallState, runTool, type ToolContext } from '../src/core/tools.ts';
import { defaultAnswers } from '../src/presets/takeaway/answers.ts';
import { compileTakeaway } from '../src/presets/takeaway/compile.ts';
import { sanitiseTakeaway } from '../src/presets/takeaway/sanitise.ts';

let db: Db;
let repo: Repo;
before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

test('a reaction: heard in what the caller says is happening now, not in a question about allergies', () => {
  for (const line of [
    "He's eaten it and his lips are swelling.",
    'Her throat feels tight and she can\'t breathe properly.',
    "My son's having an allergic reaction to the chicken.",
    'I think it\'s anaphylaxis.',
    'Should I use his EpiPen?',
    "She's got swollen lips after the burger.",
  ]) assert.equal(detectReaction(line), true, line);
  for (const line of [
    'My son is allergic to sesame. Is the Burger meal OK for him?',
    "He's not having a reaction, I just want to check the menu.",
    'His lips are fine, no swelling.',
    'Can I get a large fries?',
    'I had food poisoning last week, I think.',
  ]) assert.equal(detectReaction(line), false, line);
});

test('a reaction: 999 first, every tool held until it is said, and anything else first corrected', async () => {
  const a = defaultAnswers();
  a.basics.name = 'Firebird Chicken & Burgers';
  const tenant = await repo.upsertTenant(compileTakeaway(sanitiseTakeaway(a), { slug: 'tk-reaction' }));
  const state = newCallState();
  state.takeaway = true;
  const ctx: ToolContext = {
    tenant, repo, now: () => new Date('2026-10-09T18:00:00Z'), callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone: '+447700900805',
    state, demoCards: [], sms: { send: async () => 'simulated' }, telephony: null, action: () => {},
  };
  const line = "He's eaten the wings and his lips are swelling up";
  state.heard.push(line);
  assert.equal(armReaction(state, line), true);
  assert.equal(armReaction(state, line), false, 'once a call');
  // Every tool waits, ending the call aside.
  for (const [name, args] of [['find_order', {}], ['get_menu', {}], ['take_message', { message: 'x' }]] as const) {
    const r = await runTool(name, args, ctx);
    assert.equal(r.done, false, name);
    assert.match(String(r.message), /^This may be anaphylaxis\. Say this first, in your own words: Please call 999 now and say anaphylaxis\./, name);
  }
  // A reply that puts anything else first is corrected; the advice itself is not.
  assert.deepEqual(checkUtterance("I'm so sorry to hear that. Can I take your order number?", state).map((f) => f.rule), ['safety_delayed']);
  const advice = REACTION_SCRIPT.join(' ');
  assert.deepEqual(checkUtterance(advice, state).map((f) => f.rule), []);
  // Said: the tools open.
  state.said.push(advice);
  assert.equal(noteReactionSaid(state), true);
  assert.equal(noteReactionSaid(state), false, 'noted once');
  assert.equal((await runTool('find_order', {}, ctx)).found, false);
  assert.deepEqual(checkUtterance('Is he with you now?', state).map((f) => f.rule), []);
});

test('a reaction: 999 counts in figures or words, but not inside a price', () => {
  for (const words of ['Call 999 now.', 'Ring nine nine nine.', 'Call 9 9 9.']) assert.equal(said999(words), true, words);
  for (const words of ["That's £19.99 altogether.", 'Order 1999.', 'Pizza night is 19.99.']) assert.equal(said999(words), false, words);
});
