// What the back office marks so the owner can tell things apart at a glance
// (web/src/reception/workspace/marks.ts), and where a day's grid opens
// (openAt.ts): windows's asks of 12 and 13 October. A café's afternoon tea is
// named on its bar, the restaurant's one kind of booking isn't; a message says
// how soon and what about; a quiet appointment says so; the Timeline and the
// Diary open at now on today, or at the day's first booking.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import type { Bus } from '../src/server/bus.ts';
import { tenantState } from '../src/server/state.ts';
import { defaultAnswers as cafeAnswers } from '../src/presets/cafe/answers.ts';
import { compileCafe } from '../src/presets/cafe/compile.ts';
import { sanitiseCafe } from '../src/presets/cafe/validate.ts';
import { defaultAnswers as restaurantAnswers } from '../src/presets/restaurant/answers.ts';
import { compileRestaurant } from '../src/presets/restaurant/compile.ts';
import { isQuiet, messageTags, shortService } from '../web/src/reception/workspace/marks.ts';
import { openingMinute, openingScroll } from '../web/src/reception/workspace/openAt.ts';

let db: Db;
let repo: Repo;
before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

const bus = { activeFor: () => [] } as unknown as Bus;

test('timeline: the live plan lists what can be booked, the plain booking first', async () => {
  const cafe = await repo.upsertTenant(compileCafe(sanitiseCafe(cafeAnswers()), { slug: 'marks-cafe' }));
  const c = (await tenantState(repo, cafe, bus)) as any;
  assert.deepEqual(c.plan.services, [{ key: 'table', label: 'table' }, { key: 'afternoon_tea', label: 'Afternoon tea' }]);
  // A café without afternoon tea, like the restaurant, has one kind, so its bars stay as they were.
  const noTea = cafeAnswers();
  noTea.afternoon_tea.offered = false;
  const plain = await repo.upsertTenant(compileCafe(sanitiseCafe(noTea), { slug: 'marks-cafe-plain' }));
  assert.equal(((await tenantState(repo, plain, bus)) as any).plan.services.length, 1);
  const rest = await repo.upsertTenant(compileRestaurant(restaurantAnswers(), { slug: 'marks-restaurant' }));
  assert.equal(((await tenantState(repo, rest, bus)) as any).plan.services.length, 1);
});

test("timeline: a bar names its kind in a word: the thing itself, or a short name whole", () => {
  assert.equal(shortService('Afternoon tea'), 'Tea');
  assert.equal(shortService('Sunday roast'), 'Roast');
  assert.equal(shortService('table'), 'Table');
  assert.equal(shortService('  Brunch '), 'Brunch');
});

test('diary: a quiet appointment is the booking tagged quiet, however staff typed it', () => {
  assert.equal(isQuiet({ tags: ['quiet'] }), true);
  assert.equal(isQuiet({ tags: ['regular', ' Quiet '] }), true);
  assert.equal(isQuiet({ tags: [] }), false);
  assert.equal(isQuiet({ tags: ['quiet table by the window'] }), false, 'a note that mentions it is not the mark');
});

test('messages: how soon first, then what about, in words; an older message has neither', () => {
  assert.deepEqual(messageTags({ category: 'staff', urgency: 'urgent' }), [{ label: 'Urgent', tone: 'bad' }, { label: 'Staff', tone: null }]);
  assert.deepEqual(messageTags({ category: 'unwell', urgency: 'today' }), [{ label: 'Today', tone: 'warn' }, { label: 'Felt unwell', tone: null }]);
  // This week is the usual pace: no marker.
  assert.deepEqual(messageTags({ category: 'cake_order', urgency: 'this_week' }), [{ label: 'Cake order', tone: null }]);
  assert.deepEqual(messageTags({ category: 'lost_property', urgency: null }), [{ label: 'Lost property', tone: null }]);
  assert.deepEqual(messageTags({ category: 'careers' }), [{ label: 'Job enquiry', tone: null }]);
  assert.deepEqual(messageTags({ category: 'group', urgency: 'today' })[1], { label: 'Group booking', tone: null });
  // "Other" and "general" say nothing to sort by.
  assert.deepEqual(messageTags({ category: 'other', urgency: 'urgent' }), [{ label: 'Urgent', tone: 'bad' }]);
  assert.deepEqual(messageTags({ category: 'general', urgency: 'this_week' }), []);
  assert.deepEqual(messageTags({}), []);
  assert.deepEqual(messageTags({ category: null, urgency: null }), []);
});

test('timeline: a day opens at now on today, while its day runs; otherwise at the first booking', () => {
  const day = { lo: 7 * 60 + 30, hi: 18 * 60 + 30, starts: [13 * 60, 12 * 60] };
  assert.equal(openingMinute({ ...day, isToday: true, now: 14 * 60 }), 14 * 60);
  // Before opening or after closing, now is off the grid: the day's bookings are what to see.
  assert.equal(openingMinute({ ...day, isToday: true, now: 23 * 60 }), 12 * 60);
  assert.equal(openingMinute({ ...day, isToday: true, now: 6 * 60 }), 12 * 60);
  assert.equal(openingMinute({ ...day, isToday: false, now: 14 * 60 }), 12 * 60, 'another day: its first booking');
  assert.equal(openingMinute({ ...day, starts: [], isToday: false, now: 14 * 60 }), null, 'nothing booked: the start of the day');
});

test('timeline: it scrolls so that minute sits a little in from the left, never past the start', () => {
  // Half-way along a 1200px day, with 240px on screen: 60px of what came before still shows.
  assert.equal(openingScroll(0.5, 1200, 240), 540);
  // A wide screen keeps at most 64px before it.
  assert.equal(openingScroll(0.5, 1200, 900), 536);
  assert.equal(openingScroll(0.01, 1200, 240), 0);
});
