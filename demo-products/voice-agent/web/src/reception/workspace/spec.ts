// What the back office shows, in the business's own words: the workspace
// spec the server sends with the state (PRESETS.md §2.5), and the few
// sentences the page makes from it.

import type { WorkspaceSpec } from '../../../../src/presets/index.ts';
import type { LiveState } from '../types.ts';

export type { WorkspaceSpec };

/**
 * The restaurant's back office as it was drawn before the server sent a
 * spec, for a state without one: the floor plan and timeline when there are
 * tables, the kitchen, messages and calls.
 */
export function fallbackSpec(state: LiveState): WorkspaceSpec {
  const outside = state.plan?.areas.some((a) => a.reservable && !a.enquiry_only && a.kind === 'outdoor') ?? false;
  const suggestions: string[] = [];
  if (state.tenant.has_booking) {
    suggestions.push(outside ? 'Can I book a table for four on Friday at half seven, outside if possible?' : 'Can I book a table for four on Friday at half seven?');
    suggestions.push("I've got a booking. Can we make it five people instead?");
  }
  if (state.tenant.has_ordering) suggestions.push('Can I order some food to collect at seven?');
  suggestions.push('Do you have gluten-free options?');
  return {
    views: [
      ...(state.plan ? [{ id: 'floor', label: 'Floor plan' }, { id: 'timeline', label: 'Timeline' }] as const : []),
      { id: 'orders', label: 'Kitchen' },
      { id: 'messages', label: 'Messages' },
      { id: 'calls', label: 'Calls' },
    ],
    bookings: {
      resource: 'table', resources: 'tables', party: 'Party',
      visit: { expected: 'Expected', arrived: 'Arrived', seated: 'Seated', finished: 'Finished', no_show: 'No-show' },
      allergies: true, combine: true,
    },
    orders: { board: 'Kitchen', done: { collection: 'Collected', delivery: 'Collected' }, drivers: false, advance: false },
    suggestions,
    resetLine: 'bookings and orders',
    clock: true,
  };
}

/**
 * What to try saying, with {ref} filled in: the latest order's reference, or
 * else the next booking's. A suggestion that needs a reference when there is
 * none is left out.
 */
export function suggestionsFor(spec: WorkspaceSpec, state: Pick<LiveState, 'orders' | 'bookings' | 'now'> & Partial<Pick<LiveState, 'jobs'>>): string[] {
  const order = state.orders.filter((o) => o.status !== 'cancelled').sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const booking = state.bookings.filter((b) => b.status === 'confirmed' && b.starts_at >= state.now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  // A repairs contractor's: the engineer on the way, else the next job booked.
  const jobs = state.jobs ?? [];
  const job = jobs.find((j) => j.status === 'on_the_way') ?? jobs.filter((j) => j.status === 'scheduled' && j.date).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0];
  const ref = order?.reference ?? booking?.reference ?? job?.reference ?? null;
  return spec.suggestions.flatMap((s) => (!s.includes('{ref}') ? [s] : ref ? [s.split('{ref}').join(ref)] : []));
}

/** What a view of the back office shows, so a booking or order made on a call can be brought forward. */
export type Shows = 'bookings' | 'orders' | 'jobs' | null;

/**
 * The tab to show when a call makes or changes a booking or an order: the
 * open one if it already shows that kind, else the first view that does,
 * else the open one. `open` null is the spec's first view.
 */
export function focusTab<T extends string>(views: { id: T; shows: Shows }[], open: T | null, kind: 'bookings' | 'orders' | 'jobs'): T | null {
  const shown = views.find((v) => v.id === open) ?? views[0];
  if (!shown || shown.shows === kind) return open;
  return views.find((v) => v.shows === kind)?.id ?? open;
}

/** The words in resetLine that the reset counts. */
const COUNTED = /\b(bookings|orders|jobs)\b/g;

/**
 * Reset's question: everything it clears, and what it makes again. The
 * restaurant's reads as it always has; an estate agency's names its
 * viewings, valuations, offers and sales.
 */
export function resetConfirm(spec: WorkspaceSpec): string {
  const kinds = spec.resetLine.split(/,\s*|\s+and\s+/).map((w) => w.trim().replace(/s$/, '')).filter(Boolean);
  const diary = spec.bookings && kinds.every((k) => k === 'booking' || k === 'order');
  const refill = diary ? 'fill the diary with a fresh sample week' : `make fresh sample ${spec.resetLine}`;
  return `Clear every ${[...kinds, 'call and text'].join(', ')}, and ${refill} from your setup?`;
}

/** "Reset: 14 bookings and 6 orders.": each counted word in resetLine gets its number, wherever and however often it appears. */
export function resetToast(spec: WorkspaceSpec, counts: { bookings?: number; orders?: number; jobs?: number }): string {
  return `Reset: ${spec.resetLine.replace(COUNTED, (word) => `${counts[word as keyof typeof counts] ?? 0} ${word}`)}.`;
}
