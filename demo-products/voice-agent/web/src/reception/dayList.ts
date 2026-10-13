// The days a screen's pager and strip offer (DayPager.tsx), kept apart from
// React so they can be tested on their own.

/** A day beyond the screen's own week, so with its month: "Sun 25 Oct". */
export function farDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * A screen's days (keys like 2026-10-10) with the day it shows added in date
 * order when it is not one of them: a caller booked further ahead than the
 * week, and the screen went to that booking's day. The pager then names the
 * day on screen and ‹ › step on from it, and the strip has it pressed.
 */
export function withShown(days: string[], shown: string): string[] {
  return !shown || days.includes(shown) ? days : [...days, shown].sort();
}
