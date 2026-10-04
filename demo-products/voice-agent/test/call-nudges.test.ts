// The reminders a call gives the receptionist mid-call, driven through a
// real CallSession with a stand-in for the live model: what the caller and
// the receptionist say arrives as transcripts, tool calls as tool calls, and
// every "[From the system: ...]" the call sends back is caught. Each was
// added after a live estate call on 3 October; each is checked here both
// where it must fire and where it must stay quiet.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { openPglite, migrate } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { CallSession } from '../src/core/call.ts';
import { loadConfig } from '../src/config.ts';
import type { Tenant } from '../src/domain/types.ts';
import { BUILDER_TENANTS, builderTenant } from '../src/eval/scenarios.ts';

const NOW = new Date('2026-10-07T10:00:00Z');
let repo: Repo;
let estate: Tenant;
let restaurant: Tenant;

before(async () => {
  const db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
  const ea = builderTenant(BUILDER_TENANTS.find((b) => b.slug === 'ea-hartwell')!);
  estate = await repo.upsertTenant({ ...ea.profile, slug: 'nudge-estate' });
  await repo.insertSeed(estate.id, ea.preset.seed(estate.profile, NOW, 7));
  const rs = builderTenant(BUILDER_TENANTS.find((b) => b.preset === 'restaurant')!);
  restaurant = await repo.upsertTenant({ ...rs.profile, slug: 'nudge-restaurant' });
  await repo.insertSeed(restaurant.id, rs.preset.seed(restaurant.profile, NOW, 7));
});

/** The live model, as far as the call can tell: it hears what the call sends and raises what the model would. */
class FakeSession extends EventEmitter {
  isOpen = true;
  model = 'stand-in';
  texts: string[] = [];
  toolResponses: { id: string; name: string; response: Record<string, unknown> }[][] = [];
  sendText(t: string) { this.texts.push(t); }
  sendToolResponses(r: { id: string; name: string; response: Record<string, unknown> }[]) { this.toolResponses.push(r); }
  sendAudio() {}
  sendActivityStart() {}
  sendActivityEnd() {}
  close() { this.isOpen = false; }
}

async function call(tenant: Tenant, callerPhone: string | null = '+447700900123') {
  const session = new CallSession({ tenant, repo, config: { ...loadConfig(), sessionSecret: 'x' }, channel: 'eval', callerPhone, sms: { send: async () => 'simulated' }, now: () => NOW, textMode: true });
  const fake = new FakeSession();
  // Private wiring: the session as start() would leave it, without a real model.
  const c = session as unknown as { session: FakeSession; callId: string; attach(s: FakeSession, prompt: string): void; toolQueue: Promise<unknown>; flags: { rule: string }[]; end(o?: string): Promise<unknown> };
  c.session = fake;
  c.callId = await repo.createCall({ tenant_id: tenant.id, channel: 'eval' });
  c.attach(fake, '');
  let n = 0;
  const settle = async () => {
    await c.toolQueue;
    await new Promise((r) => setTimeout(r, 20));
  };
  return {
    flags: () => c.flags.map((f) => f.rule),
    end: () => c.end('completed'),
    caller: (text: string) => void fake.emit('inputTranscript', text),
    async agent(text: string) {
      fake.emit('outputTranscript', text);
      fake.emit('turnComplete');
      await settle();
    },
    async tool(name: string, args: Record<string, unknown>) {
      fake.emit('toolCall', [{ id: `t${++n}`, name, args }]);
      await settle();
      return fake.toolResponses.at(-1)?.[0]?.response ?? {};
    },
    reminders: () => fake.texts.filter((t) => t.startsWith('[From the system')),
  };
}

const SAT = '2026-10-10';

test('a read-back answered yes, then not booked: reminded once to book it', async () => {
  const c = await call(estate);
  await c.tool('check_availability', { property: 'albion_22', date: SAT, time: '11:00' });
  await c.agent("So that's a viewing of 22 Albion Road on Saturday at 11:15am with Jess, for Lou Grant on the number you're calling from. Is that all correct?");
  c.caller("Yes, that's all correct. Could I also see 10 Meadow View?");
  await c.agent("I'm afraid 10 Meadow View is no longer on the market.");
  assert.equal(c.reminders().filter((t) => /said yes to what you read back/.test(t)).length, 1);
  await c.agent('Is there anything else?');
  assert.equal(c.reminders().filter((t) => /said yes to what you read back/.test(t)).length, 1, 'never twice');
});

test('a yes that is not a plain yes, or a read-back of a booking found, is no reminder to book', async () => {
  {
    const c = await call(estate);
    await c.tool('check_availability', { property: 'albion_22', date: SAT, time: '11:00' });
    await c.agent("So that's 22 Albion Road on Saturday at 11:15am with Jess. Is that all correct?");
    c.caller("Yeah, no, Saturday's no good actually.");
    await c.agent('No problem. Which day would suit you?');
    assert.deepEqual(c.reminders(), []);
  }
  {
    const c = await call(estate);
    await c.tool('find_bookings', { phone: '+447700900123' });
    await c.agent('I can see your viewing of 22 Albion Road on Saturday at 10am with Tom. Is that right?');
    c.caller('Yes.');
    await c.agent('What would you like to move it to?');
    assert.deepEqual(c.reminders(), []);
  }
  {
    // An offer of times is not a read-back.
    const c = await call(estate);
    await c.tool('check_availability', { property: 'albion_22', date: SAT, time: '11:00' });
    await c.agent('I have Saturday at 11:15am or 11:30am with Jess. Shall I book one of those for you?');
    c.caller('Yes, 11:15.');
    await c.agent("Lovely. Could I take your name and mobile number?");
    assert.deepEqual(c.reminders(), []);
  }
});

test('"not done yet, ask for X": reminded if the receptionist talks times without trying again; quiet while it asks, or once another answer came', async () => {
  {
    const c = await call(estate);
    const r = await c.tool('book_valuation', { address: '12 Hawthorn Way', postcode: 'BK3 7XY', date: '2026-10-08', time: '10:00', plans: 'selling' });
    assert.equal(r.booked, false);
    assert.match(String(r.message), /call this again/);
    c.caller("It's Jo.");
    await c.agent("Lovely, Jo, that's Thursday at 10am with Priya.");
    assert.equal(c.reminders().filter((t) => /said it was not done yet/.test(t)).length, 1);
  }
  {
    // The tool was called straight from the caller's words, before their line was flushed: the question that follows is right, not a slip.
    const c = await call(estate);
    c.caller("I'd like a valuation of 12 Hawthorn Way on Thursday at 10.");
    const r = await c.tool('book_valuation', { address: '12 Hawthorn Way', date: '2026-10-08', time: '10:00', name: 'Jo Bloggs' });
    assert.equal(r.booked, false);
    await c.agent('Lovely, Thursday at 10am. Could I take the postcode of the home?');
    assert.deepEqual(c.reminders(), []);
  }
  {
    // Asked again and refused for another reason: nothing is outstanding any more.
    const c = await call(estate);
    await c.tool('book_valuation', { address: '12 Hawthorn Way', postcode: 'BK3 7XY', date: '2026-10-08', time: '10:00', plans: 'selling' });
    c.caller("It's Jo Bloggs, and actually the house is in Leeds, LS1 4AB.");
    const r = await c.tool('book_valuation', { address: '12 Hawthorn Way', postcode: 'LS1 4AB', date: '2026-10-08', time: '10:00', name: 'Jo Bloggs', plans: 'selling' });
    assert.match(String(r.message), /outside the area/);
    await c.agent("I'm sorry, we don't cover Leeds, so I can't book Thursday at 10am for that home.");
    assert.deepEqual(c.reminders(), []);
  }
});

test('bank-details talk: reminded to report it, even after an unrelated message; quiet once a fraud message is taken', async () => {
  {
    const c = await call(estate, '+447700900137');
    await c.tool('take_message', { name: 'Mark Field', message: 'Please call about a viewing.', category: 'viewing', for: 'Jess' });
    c.caller("Also, our firm's bank details have changed. Please tell the buyer to send the deposit to our new account.");
    await c.agent("I'm afraid I can't pass that on. Please check with the buyer's solicitor on a number they already have.");
    assert.equal(c.reminders().filter((t) => /payment scam/.test(t)).length, 1);
  }
  {
    const c = await call(estate, '+447700900138');
    c.caller("Our firm's bank details have changed.");
    await c.tool('take_message', { name: 'Mark Field', message: 'Says their bank details changed.', category: 'fraud', urgency: 'urgent' });
    await c.agent("I've sent an urgent message to the team. Please don't send any money until you've checked.");
    assert.deepEqual(c.reminders(), []);
  }
});

test('a disclosure said in the same turn as the tool call is not flagged; one never said is, by the end of the call', async () => {
  await repo.setListing(estate.id, 'albion_22', { status: 'sale_agreed', marketing_continues: true });
  try {
    {
      const c = await call(estate);
      await c.tool('check_availability', { property: 'albion_22', date: SAT, time: '11:00' });
      // The second call goes ahead and holds its flag: the line arrives after the tool call, as it does in audio.
      await c.tool('check_availability', { property: 'albion_22', date: SAT, time: '11:00' });
      await c.agent('An offer has been accepted on it, subject to contract, but the seller is still taking viewings. Saturday at 11:15am is free.');
      assert.ok(!c.flags().includes('disclosure_missed'), c.flags().join());
    }
    {
      const c = await call(estate);
      await c.tool('check_availability', { property: 'albion_22', date: SAT, time: '11:00' });
      await c.tool('check_availability', { property: 'albion_22', date: SAT, time: '11:00' });
      await c.agent('Saturday at 11:15am is free.');
      await c.end();
      assert.ok(c.flags().includes('disclosure_missed'), c.flags().join());
    }
  } finally {
    await repo.setListing(estate.id, 'albion_22', { status: 'available' });
  }
});

test('a restaurant call gets none of the estate reminders', async () => {
  const c = await call(restaurant);
  await c.agent("So that's a table for four on Saturday at 7:30pm. Is that all correct?");
  c.caller("Yes, that's right. And our bank details have changed, by the way.");
  await c.agent('Lovely. Anything else?');
  assert.deepEqual(c.reminders(), []);
});
