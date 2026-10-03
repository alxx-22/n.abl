// The web's back office reads its tabs and sentences from the workspace spec
// (web/src/reception/workspace/spec.ts). For the restaurant they must come
// out exactly as the page wrote them before it read the spec.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileRestaurant } from '../src/presets/restaurant/compile.ts';
import { defaultAnswers } from '../src/presets/restaurant/answers.ts';
import { restaurantWorkspace } from '../src/presets/restaurant/preset.ts';
import { boardWorkspace } from '../src/server/state.ts';
import { fallbackSpec, focusTab, resetConfirm, resetToast, suggestionsFor, type WorkspaceSpec } from '../web/src/reception/workspace/spec.ts';
import type { LiveState } from '../web/src/reception/types.ts';

const restaurant = () => {
  const a = defaultAnswers();
  a.basics.name = 'Casa Ana';
  return compileRestaurant(a, { slug: 'casa-ana' });
};

test('workspace spec: the restaurant resets with the words it always used', () => {
  const spec = restaurantWorkspace(restaurant());
  assert.equal(resetConfirm(spec), 'Clear every booking, order, call and text, and fill the diary with a fresh sample week from your setup?');
  assert.equal(resetToast(spec, { bookings: 14, orders: 6 }), 'Reset: 14 bookings and 6 orders.');
});

test('workspace spec: Reset counts each word wherever it is, and nothing else', () => {
  const orders: WorkspaceSpec = { views: [], suggestions: [], resetLine: 'orders' };
  assert.equal(resetConfirm(orders), 'Clear every order, call and text, and make fresh sample orders from your setup?');
  assert.equal(resetToast(orders, { bookings: 3, orders: 40 }), 'Reset: 40 orders.');
  assert.equal(resetToast({ ...orders, resetLine: 'bookings today and bookings tomorrow' }, { bookings: 2 }), 'Reset: 2 bookings today and 2 bookings tomorrow.', 'every time it appears');
  assert.equal(resetToast(boardWorkspace(restaurant()), { bookings: 9, orders: 1 }), 'Reset: 9 bookings.');
  const estate: WorkspaceSpec = { views: [], suggestions: [], resetLine: 'viewings, valuations, offers and sales', bookings: { resource: 'person', resources: 'team', party: null, visit: {}, allergies: false } };
  assert.equal(resetConfirm(estate), 'Clear every viewing, valuation, offer, sale, call and text, and make fresh sample viewings, valuations, offers and sales from your setup?');
});

test('workspace spec: {ref} is filled from the latest order, or the next booking, or the line is left out', () => {
  const spec: WorkspaceSpec = { views: [], suggestions: ['Where is order {ref}?', 'Do you deliver?'], resetLine: 'orders' };
  const order = (reference: string, created_at: string, status = 'confirmed') => ({ reference, created_at, status }) as LiveState['orders'][number];
  const booking = (reference: string, starts_at: string) => ({ reference, starts_at, status: 'confirmed' }) as LiveState['bookings'][number];
  const now = '2026-10-02T18:00:00.000Z';
  assert.deepEqual(suggestionsFor(spec, { now, orders: [order('101', '2026-10-02T17:00:00Z'), order('102', '2026-10-02T17:30:00Z'), order('103', '2026-10-02T17:45:00Z', 'cancelled')], bookings: [] }), ['Where is order 102?', 'Do you deliver?']);
  assert.deepEqual(suggestionsFor(spec, { now, orders: [], bookings: [booking('OLD', '2026-10-02T12:00:00.000Z'), booking('NEXT', '2026-10-03T12:00:00.000Z')] }), ['Where is order NEXT?', 'Do you deliver?']);
  assert.deepEqual(suggestionsFor(spec, { now, orders: [], bookings: [] }), ['Do you deliver?']);
});

test("workspace spec: a state without one is drawn as the restaurant's back office", () => {
  const profile = restaurant();
  const spec = restaurantWorkspace(profile);
  const state = {
    tenant: { has_booking: Boolean(profile.booking?.services.length), has_ordering: Boolean(profile.ordering) },
    plan: profile.booking ? { areas: profile.booking.areas ?? [], tables: [], pairs: [], fixtures: [] } : null,
  } as unknown as LiveState;
  assert.deepEqual(fallbackSpec(state), spec);
  assert.deepEqual(suggestionsFor(fallbackSpec(state), { now: '', orders: [], bookings: [] }), spec.suggestions, 'no suggestion of the restaurant needs a reference');
});

test('workspace spec: a booking made on a call brings forward the first view of bookings, unless one is open', () => {
  const restaurant = [
    { id: 'floor', shows: 'bookings' }, { id: 'timeline', shows: 'bookings' }, { id: 'orders', shows: 'orders' },
    { id: 'messages', shows: null }, { id: 'calls', shows: null },
  ] as const;
  const views = restaurant.map((v) => ({ ...v }));
  assert.equal(focusTab(views, null, 'bookings'), null, 'the default view already shows bookings');
  assert.equal(focusTab(views, 'timeline', 'bookings'), 'timeline');
  for (const open of ['orders', 'messages', 'calls'] as const) assert.equal(focusTab(views, open, 'bookings'), 'floor', `from ${open}`);
  assert.equal(focusTab(views, 'floor', 'orders'), 'orders');
  // An orders-first business: its default view already shows orders; it has nothing for bookings.
  const takeaway = [{ id: 'orders', shows: 'orders' as const }, { id: 'messages', shows: null }];
  assert.equal(focusTab(takeaway, null, 'orders'), null);
  assert.equal(focusTab(takeaway, 'messages', 'orders'), 'orders');
  assert.equal(focusTab(takeaway, 'messages', 'bookings'), 'messages', 'no view shows bookings: stay');
});
