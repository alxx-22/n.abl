// A day's grid (the Timeline, the Diary) is wider than a phone, and opened at
// its left edge it showed the morning's empty rows with the day's bookings
// off to the right (windows, 12 October). It opens where the day is instead:
// now, on today, or the first booking on another day.

import { useLayoutEffect, type RefObject } from 'react';

/** The minute a day's grid opens at: now on today while the grid's day runs, else the first booking, else none. */
export function openingMinute(o: { isToday: boolean; now: number; lo: number; hi: number; starts: number[] }): number | null {
  if (o.isToday && o.now >= o.lo && o.now <= o.hi) return o.now;
  return o.starts.length ? Math.min(...o.starts) : null;
}

/**
 * How far to scroll the grid sideways so `frac` of the way along a track `track` pixels wide sits a little in from
 * the left of the part on screen (`visible` pixels), with what came just before it still in view.
 */
export function openingScroll(frac: number, track: number, visible: number): number {
  const lead = Math.min(64, visible / 4);
  return Math.max(0, Math.round(frac * track - lead));
}

/**
 * Scrolls `grid` to `minute` each time another day is shown, and not as the day's bookings change under it, so
 * a scroll of the owner's own is kept. Only the grid moves: scrollIntoView would move the page as well.
 */
export function useOpenAt(grid: RefObject<HTMLElement | null>, day: string, minute: number | null, lo: number, hi: number) {
  useLayoutEffect(() => {
    const el = grid.current;
    const track = el?.querySelector<HTMLElement>('.tl-row .tl-track');
    // Not laid out (a hidden tab): nothing to measure, so the grid is left where it is.
    if (!el || !track || !track.offsetWidth) return;
    if (minute === null || hi <= lo) {
      el.scrollLeft = 0;
      return;
    }
    // Where the tracks start inside the grid: the rows' names sit before them, and stay put as it scrolls.
    const start = track.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    el.scrollLeft = openingScroll((minute - lo) / (hi - lo), track.offsetWidth, el.clientWidth - start);
  }, [day]);
}
