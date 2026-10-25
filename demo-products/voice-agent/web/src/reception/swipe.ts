// Swipes for the pagers (DayPager.tsx): a finger or pen drawn sideways across
// a day's screen moves a day back or forward, as a phone's own apps do. The
// decision is kept apart from the browser so it can be tested on its own.

/** How far a finger must travel sideways, in CSS pixels, before it counts: a tap or a wobble never does. */
export const SWIPE_MIN = 50;

/** How many times further sideways than up or down: a thumb scrolling the page on a slant is not a swipe. */
export const SWIPE_RATIO = 2;

/**
 * Which way a finished gesture moves the pager: 1 to the next (the finger
 * went left, pulling the next one in), -1 to the previous, 0 for neither.
 * `dx` and `dy` are where the finger lifted, less where it went down.
 */
export function swipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  if (Math.abs(dx) < SWIPE_MIN) return 0;
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return 0;
  return dx < 0 ? 1 : -1;
}

/**
 * Where a swipe must never start: something dragged to move it (a booking's
 * bar, a table, a job), a box to type in or a slider to slide, or anything a
 * screen marks with data-no-swipe.
 */
export const NO_SWIPE_FROM = '[data-no-swipe], input, select, textarea, [contenteditable="true"], [draggable="true"], .tl-bar, svg .table';
