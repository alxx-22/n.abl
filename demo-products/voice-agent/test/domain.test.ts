import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFixtures } from '../src/db/seed.ts';
import { checkAvailability, blockingKeys, findService } from '../src/domain/availability.ts';
import { resolveItem, resolveModifiers, allergenAnswer, lineTotal } from '../src/domain/menu.ts';
import { searchKnowledge } from '../src/domain/knowledge.ts';
import { processDemoPayment, parseDemoCards, DEFAULT_DEMO_CARDS, digitsOf } from '../src/domain/payments.ts';
import { redactCardNumbers, REDACTED } from '../src/core/redact.ts';
import { PROMISED_MESSAGE, checkUtterance } from '../src/core/guardrails.ts';
import { newCallState, record, unsaidReference, type ToolContext } from '../src/core/tools.ts';
import { readFileSync } from 'node:fs';
import { normaliseUkPhone, displayUkPhone } from '../src/domain/phone.ts';
import { zonedToUtc } from '../src/domain/time.ts';
import { compilePrompt } from '../src/core/prompt.ts';

const fixtures = loadFixtures();
const lucas = fixtures.find((f) => f.slug === 'lucas-trattoria')!;
const fade = fixtures.find((f) => f.slug === 'fade-and-co')!;
const NOW = new Date('2026-09-29T14:00:00Z'); // Tuesday, 3pm BST

test('fixtures: every tenant is well formed', () => {
  assert.equal(fixtures.length, 4);
  for (const f of fixtures) {
    assert.match(f.slug, /^[a-z0-9-]+$/);
    assert.ok(f.greeting.includes('AI assistant'), `${f.slug} greeting must disclose the AI`);
    assert.ok(f.greeting.toLowerCase().includes('demo'), `${f.slug} greeting must say it is a demo`);
    for (const s of f.booking?.services ?? []) {
      for (const w of s.windows) assert.ok(w.first <= w.last, `${f.slug}/${s.key} window`);
    }
    for (const c of f.menu?.categories ?? []) {
      for (const i of c.items) {
        for (const g of i.modifier_groups ?? []) assert.ok(f.menu!.modifier_groups[g], `${f.slug}/${i.key} group ${g}`);
      }
    }
  }
});

test('availability: an empty Sunday evening offers the requested time', () => {
  const r = checkAvailability({ profile: lucas, date: '2026-10-04', time: '19:00', partySize: 4, now: NOW, existing: [] });
  assert.equal(r.available, true);
  assert.equal(r.slot?.resource_key, 'T4');
  assert.equal(r.slot?.duration_minutes, 90);
});

test('availability: closed Monday, past dates, the horizon and party limits', () => {
  assert.equal(checkAvailability({ profile: lucas, date: '2026-10-05', time: '19:00', partySize: 2, now: NOW, existing: [] }).reason, 'closed');
  assert.equal(checkAvailability({ profile: lucas, date: '2026-09-28', time: '19:00', partySize: 2, now: NOW, existing: [] }).reason, 'in_the_past');
  assert.equal(checkAvailability({ profile: lucas, date: '2027-03-01', time: '19:00', partySize: 2, now: NOW, existing: [] }).reason, 'too_far_ahead');
  assert.equal(checkAvailability({ profile: lucas, date: '2026-10-02', time: '19:00', partySize: 12, now: NOW, existing: [] }).reason, 'party_too_large');
  assert.equal(checkAvailability({ profile: lucas, date: '2026-12-25', time: '19:00', partySize: 2, now: NOW, existing: [] }).reason, 'closed');
});

test('availability: the lead time stops a booking for twenty minutes from now', () => {
  const tenPastFive = new Date('2026-09-29T16:10:00Z'); // 17:10 BST
  const soon = checkAvailability({ profile: lucas, date: '2026-09-29', time: '17:30', partySize: 2, now: tenPastFive, existing: [] });
  assert.equal(soon.available, false);
  const later = checkAvailability({ profile: lucas, date: '2026-09-29', time: '17:45', partySize: 2, now: tenPastFive, existing: [] });
  assert.equal(later.available, true);
});

test('availability: when every four-top is taken, the nearest times either side of it', () => {
  const at = (t: string) => zonedToUtc('2026-10-02', t, 'Europe/London');
  const existing = ['T4', 'T5', 'T6', 'T7', 'T8', 'T9'].map((k) => ({
    resource_key: k, starts_at: at('19:00'), ends_at: new Date(at('19:00').getTime() + 120 * 60000),
  }));
  const r = checkAvailability({ profile: lucas, date: '2026-10-02', time: '19:30', partySize: 4, now: NOW, existing });
  assert.equal(r.available, false);
  assert.equal(r.reason, 'fully_booked');
  // A 90-minute sitting must end by 19:00 or start at 21:00; lunch is not an alternative to dinner.
  assert.deepEqual(r.alternatives.map((a) => a.time), ['17:30', '21:00', '21:15']);
});

test('availability: a combined table blocks its parts and the other way round', () => {
  const keys = blockingKeys('T4+T5', lucas.booking!.resources);
  assert.ok(keys.has('T4') && keys.has('T5'));
  assert.ok(blockingKeys('T4', lucas.booking!.resources).has('T4+T5'));
  const at = zonedToUtc('2026-10-02', '19:00', 'Europe/London');
  const existing = [{ resource_key: 'T4+T5', starts_at: at, ends_at: new Date(at.getTime() + 120 * 60000) }];
  const r = checkAvailability({ profile: lucas, date: '2026-10-02', time: '19:00', partySize: 4, now: NOW, existing });
  assert.equal(r.slot?.resource_key, 'T6');
});

test('availability: appointments respect the named barber and their skills', () => {
  const svc = findService(fade, 'kids cut');
  assert.equal(svc?.key, 'kids_cut');
  const kaz = checkAvailability({ profile: fade, serviceKey: 'kids_cut', date: '2026-10-01', time: '10:00', partySize: 1, staff: 'Kaz', now: NOW, existing: [] });
  assert.equal(kaz.available, false, 'Kaz does not do kids’ cuts');
  const dan = checkAvailability({ profile: fade, serviceKey: 'kids_cut', date: '2026-10-01', time: '10:00', partySize: 1, staff: 'Dan', now: NOW, existing: [] });
  assert.equal(dan.slot?.resource_label, 'Dan');
  const late = checkAvailability({ profile: fade, serviceKey: 'skin_fade', date: '2026-10-01', time: '19:00', partySize: 1, now: NOW, existing: [] });
  assert.equal(late.available, true, 'Thursday is late night');
});

test('availability: without a time, a day is summarised as ranges', () => {
  const r = checkAvailability({ profile: lucas, date: '2026-10-04', partySize: 2, now: NOW, existing: [] });
  assert.deepEqual(r.available_ranges, ['12 noon to 2:30pm', '5pm to 7:45pm']);
});

test('menu: callers’ words resolve to dishes, or to a question', () => {
  const menu = lucas.menu!;
  const ok = (q: string) => {
    const r = resolveItem(menu, q);
    assert.ok(r.ok, `"${q}" should resolve`);
    return (r as { value: { key: string } }).value.key;
  };
  assert.equal(ok('margheritas'), 'margherita');
  assert.equal(ok('margarita'), 'margherita');
  assert.equal(ok('a tiramisu'), 'tiramisu');
  assert.equal(ok('pepperoni pizza'), 'diavola');
  assert.equal(ok('mushroom pizza'), 'funghi');
  assert.equal(ok('diet coke'), 'coke');
  assert.equal(resolveItem(menu, 'sushi').ok, false);
});

test('menu: options match, unknown options are refused, groups enforce their limits', () => {
  const menu = lucas.menu!;
  const marg = menu.categories[1].items[0];
  const r = resolveModifiers(menu, marg, ['no basil', 'extra mozzarella']);
  assert.ok(r.ok);
  const line = { line: 1, item_key: 'margherita', name: 'Margherita', quantity: 2, unit_pence: 1150, modifiers: (r as any).value, notes: undefined };
  assert.equal(lineTotal(line), 2 * (1150 + 150));
  const bad = resolveModifiers(menu, marg, ['pineapple']);
  assert.equal(bad.ok, false);
  assert.match((bad as any).question, /Not an option/);
});

test('menu: allergen wording is data plus the caveat, never "safe"', () => {
  const menu = lucas.menu!;
  const tiramisu = menu.categories[3].items[0];
  const a = allergenAnswer(menu, tiramisu);
  assert.match(a, /contains gluten, eggs, milk/);
  assert.match(a, /may contain traces of nuts/);
  assert.match(a, /can't guarantee/);
  assert.doesNotMatch(a, /\bsafe\b/i);
});

test('knowledge: finds the business’s own answer, or nothing', () => {
  const hits = searchKnowledge(lucas.knowledge, 'where can I park the car');
  assert.match(hits[0].a, /Broad Marsh/);
  assert.match(searchKnowledge(lucas.knowledge, 'can I bring my dog')[0].a, /dogs are welcome/i);
  assert.match(searchKnowledge(lucas.knowledge, 'wheelchair access')[0].a, /step-free/);
  assert.equal(searchKnowledge(lucas.knowledge, 'do you sell petrol').length, 0);
});

test('payments: demo cards approve and decline, anything else is refused', () => {
  const ok = processDemoPayment('1234 5678 9012 3456', DEFAULT_DEMO_CARDS);
  assert.equal(ok.result, 'approved');
  assert.match((ok as any).auth_code, /^DEMO-[A-Z0-9]{5}$/);
  assert.equal(processDemoPayment('one two three four five six seven eight nine oh one two three four five six', DEFAULT_DEMO_CARDS).result, 'approved');
  assert.equal(processDemoPayment('1234-5678-0000-0000', DEFAULT_DEMO_CARDS).result, 'declined');
  const refused = processDemoPayment('4111 1111 1111 1111', DEFAULT_DEMO_CARDS);
  assert.equal(refused.result, 'refused');
  assert.equal(digitsOf('double oh seven'), '007');
  assert.throws(() => parseDemoCards('12:bad'));
});

test('redaction: real card numbers go, demo cards and phone numbers stay', () => {
  const r = redactCardNumbers('My card is 4111 1111 1111 1111 and my number is 07700 900123', DEFAULT_DEMO_CARDS);
  assert.equal(r.redacted, 1);
  assert.equal(r.text, `My card is ${REDACTED} and my number is 07700 900123`);
  assert.equal(redactCardNumbers('Use 1234 5678 9012 3456 please', DEFAULT_DEMO_CARDS).redacted, 0);
  const words = redactCardNumbers('it is four one one one one one one one one one one one one one one one', DEFAULT_DEMO_CARDS);
  assert.equal(words.redacted, 1);
});

test('guardrail: "confirmed" with no reference in the call is flagged', () => {
  const s = newCallState();
  assert.equal(checkUtterance("Yes, that's confirmed for you. A table for four at 7pm.", s)[0]?.rule, 'unconfirmed_claim');
  assert.equal(checkUtterance("Great, you're all booked in.", s)[0]?.rule, 'unconfirmed_claim');
  assert.equal(checkUtterance('Shall I go ahead and book that for you?', s).length, 0);
  assert.equal(checkUtterance("Once it's confirmed I'll text you.", s).length, 0);
  assert.equal(checkUtterance("Lovely, I've passed that on to the reservations team for you.", s)[0]?.rule, 'untaken_message');
  assert.equal(checkUtterance("I'll pass that on to the team.", s).length, 0, 'a promise, not a claim');
  // ...but a promise the call follows up, so the message is taken while the caller is still there.
  assert.ok(PROMISED_MESSAGE.test("Got that. I'll pass your details on to the reservations team and ask them to give you a call."));
  assert.ok(PROMISED_MESSAGE.test("I'll let the manager know."));
  assert.ok(!PROMISED_MESSAGE.test('If you give me your name and number, I can ask them to call you back.'), 'an offer, before the details');
  assert.equal(checkUtterance("I haven't passed that on yet.", s).length, 0);
  assert.equal(checkUtterance("I've passed that on.", { ...s, messageTaken: true }).length, 0);
  assert.equal(checkUtterance("It isn't booked yet.", s).length, 0);
  s.committed.push('HK482');
  assert.equal(checkUtterance("That's booked, reference H K four eight two.", s).length, 0);
});

test('records: every booking and order a call makes or finds goes through record()', () => {
  const ctx = { state: newCallState() } as ToolContext;
  const s = ctx.state;
  const seen = () => ({ committed: [...s.committed], found: [...s.found], booking: s.lastBookingRef, order: s.lastOrderRef, owed: s.owed });
  record(ctx, 'AH101', 'booking', 'found');
  assert.deepEqual(seen(), { committed: [], found: ['AH101'], booking: null, order: null, owed: null }, 'found: talking about it is no false claim, and nothing is owed');
  record(ctx, 'AH101', 'change', 'committed');
  assert.deepEqual(seen(), { committed: ['AH101'], found: ['AH101'], booking: 'AH101', order: null, owed: null }, 'changed: still the call\'s booking, under the reference the caller has');
  record(ctx, 'JK202', 'cancellation', 'committed');
  assert.deepEqual(seen(), { committed: ['AH101', 'JK202'], found: ['AH101'], booking: 'AH101', order: null, owed: null }, 'cancelled: done with');
  record(ctx, 'HK482', 'booking', 'committed');
  assert.deepEqual(seen(), { committed: ['AH101', 'JK202', 'HK482'], found: ['AH101'], booking: 'HK482', order: null, owed: 'HK482' }, 'made: the caller must hear it');
  assert.equal(unsaidReference(s, 'Your reference is H, K, 4, 8, 2.'), null);
  record(ctx, '104', 'order', 'committed');
  assert.deepEqual(seen(), { committed: ['AH101', 'JK202', 'HK482', '104'], found: ['AH101'], booking: 'HK482', order: '104', owed: '104' });
  assert.equal(checkUtterance("That's all ordered, number one oh four.", s).length, 0);

  // Only record() writes them: a tool that set them itself could forget one.
  for (const file of ['../src/core/tools.ts', '../src/core/call.ts']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8').replace(/export function record\([\s\S]*?\n}\n/, '');
    assert.doesNotMatch(src, /\.(committed|found)\.push\(|\.(lastBookingRef|lastOrderRef)\s*=\s*[^=\s]|\.owed\s*=\s*(?!null\b)[^=\s]/, file);
  }
});

test('guardrail: payment and allergy claims', () => {
  const s = newCallState();
  assert.equal(checkUtterance("Lovely, that payment's gone through.", s)[0]?.rule, 'unpaid_claim');
  assert.equal(checkUtterance("It's safe for your son with his nut allergy.", s)[0]?.rule, 'said_safe_for_allergy');
});

test('guardrail: reading out a note about the caller instead of talking to them', () => {
  const s = newCallState();
  // What a receptionist said aloud on 1 October.
  assert.equal(checkUtterance('user said to person in room "five past seven" and said to you "what about for four people?"', s)[0]?.rule, 'narrated');
  assert.equal(checkUtterance('The caller wants a table for four.', s)[0]?.rule, 'narrated');
  assert.equal(checkUtterance('[thinking] they asked about Tuesday', s)[0]?.rule, 'narrated');
  for (const fine of ['Did you say five past seven?', 'Was that for four people?', "Sorry, I misheard you there. What would you like?", 'Of course, take your time.', 'I said 7pm, sorry if that was unclear.']) {
    assert.equal(checkUtterance(fine, s).length, 0, fine);
  }
});

test('phone numbers as callers say them', () => {
  assert.equal(normaliseUkPhone('07700 900123'), '+447700900123');
  assert.equal(normaliseUkPhone('oh seven seven double oh nine double oh one two three'), '+447700900123');
  assert.equal(normaliseUkPhone('+44 7700 900123'), '+447700900123');
  assert.equal(normaliseUkPhone('0115 496 0321'), '+441154960321');
  assert.equal(normaliseUkPhone('123'), null);
  assert.equal(displayUkPhone('+447700900123'), '07700 900123');
});

test('prompt: discloses the AI and the demo, names the demo card, stays small', () => {
  const p = compilePrompt(lucas, { now: NOW, callerPhone: '+447700900123', demoCards: DEFAULT_DEMO_CARDS, canTransfer: false, channel: 'phone' });
  assert.match(p, /AI assistant and this is a demo line/);
  assert.match(p, /1234 5678 9012 3456/);
  assert.match(p, /07700 900123/);
  assert.match(p, /Tue 2026-09-29 \(today\)/);
  assert.match(p, /Only say a booking or order is confirmed/);
  assert.ok(p.length < 7000, `prompt is ${p.length} characters`);
  const hotel = compilePrompt(fixtures.find((f) => f.slug === 'linden-house')!, { now: NOW, callerPhone: null, demoCards: DEFAULT_DEMO_CARDS, canTransfer: false, channel: 'browser' });
  assert.doesNotMatch(hotel, /review_order/, 'no ordering rules for a hotel with no menu');
  assert.match(hotel, /Ask for a contact number/);
});

test('menu: a dish with unpublished allergens is never described as allergen-free', () => {
  const menu = structuredClone(lucas.menu!);
  const item = { ...menu.categories[0].items[0], allergens: [], allergens_unknown: true };
  const a = allergenAnswer(menu, item);
  assert.match(a, /don't have allergen information/);
  assert.doesNotMatch(a, /none of the 14/);
});
