// Listens for sideways swipes on an element (swipe.ts decides them).
//
// Touch events rather than pointer events: a finger or a stylus sends them on
// phones and tablets and a mouse never does, and they keep coming while the
// browser scrolls the page, where a pointer is cancelled as soon as it starts
// to move. Listening passively means the page scrolls exactly as before.
//
// The swipe area takes the finger's sideways travel from the browser (touch-action),
// because Chrome on a touch screen reads a sideways swipe the page cannot scroll as
// Back or Forward: a flick right to yesterday could leave the demo. Up and down still
// scroll the page and a pinch still zooms, and a box inside that scrolls sideways (the
// timeline on a phone) still scrolls, as Chrome lets each scroller take its own pans.

import { useCallback, useEffect, useRef } from 'react';
import { NO_SWIPE_FROM, swipeDirection } from './swipe.ts';

/** A touch the innermost swipe area has taken, so an outer one (the day's screen around an area pager) leaves it alone. */
const taken = new WeakSet<Event>();

/** Whether `el`, or a box around it inside `root`, scrolls sideways: the finger is scrolling that box, not the day. */
function inSidewaysScroll(el: Element, root: Element): boolean {
  for (let e: Element | null = el; e; e = e.parentElement) {
    if (e instanceof HTMLElement) {
      const ox = getComputedStyle(e).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && e.scrollWidth > e.clientWidth + 1) return true;
    }
    if (e === root) break;
  }
  return false;
}

/**
 * A callback ref: put it on the element to swipe across. `onSwipe` gets 1
 * for the next one and -1 for the previous.
 */
export function useSwipe(onSwipe: (step: -1 | 1) => void, enabled = true) {
  const latest = useRef(onSwipe);
  useEffect(() => {
    latest.current = onSwipe;
  });
  return useCallback((root: HTMLElement | null) => {
    if (!root || !enabled) return;
    let from: { x: number; y: number } | null = null;
    const down = (e: TouchEvent) => {
      from = null;
      if (taken.has(e)) return;
      taken.add(e);
      const t = e.touches.length === 1 ? e.touches[0] : null;
      const el = e.target instanceof Element ? e.target : null;
      if (t && el && !el.closest(NO_SWIPE_FROM) && !inSidewaysScroll(el, root)) from = { x: t.clientX, y: t.clientY };
    };
    // A second finger is a pinch, not a swipe.
    const move = (e: TouchEvent) => {
      if (e.touches.length > 1) from = null;
    };
    const up = (e: TouchEvent) => {
      const start = from;
      const t = e.changedTouches[0];
      from = null;
      if (!start || !t || e.touches.length) return;
      const step = swipeDirection(t.clientX - start.x, t.clientY - start.y);
      if (step) latest.current(step);
    };
    const cancel = () => {
      from = null;
    };
    const touchAction = root.style.touchAction;
    root.style.touchAction = 'pan-y pinch-zoom';
    root.addEventListener('touchstart', down, { passive: true });
    root.addEventListener('touchmove', move, { passive: true });
    root.addEventListener('touchend', up, { passive: true });
    root.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      root.style.touchAction = touchAction;
      root.removeEventListener('touchstart', down);
      root.removeEventListener('touchmove', move);
      root.removeEventListener('touchend', up);
      root.removeEventListener('touchcancel', cancel);
    };
  }, [enabled]);
}
