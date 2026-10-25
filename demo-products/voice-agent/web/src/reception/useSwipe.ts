// Listens for sideways swipes on an element (swipe.ts decides them).
//
// Touch events rather than pointer events: a finger or a stylus sends them on
// phones and tablets and a mouse never does, and they keep coming while the
// browser scrolls the page, where a pointer is cancelled as soon as it starts
// to move. Listening passively means the page scrolls, pans and zooms exactly
// as before: a swipe is only ever read, never taken from the browser.
//
// Chrome on a touch screen reads a sideways swipe that nothing can scroll as
// Back or Forward, so a flick right to yesterday could leave the demo. Every
// such swipe ends as an overscroll of the page itself, wherever it started
// (a box that scrolls sideways hands it on at its end), so while a swipe area
// is on screen the page's own sideways overscroll is switched off. Not
// touch-action on the swipe area: Chrome lets a box inside it take sideways
// pans again, and a pinch-zoomed page could no longer be panned to read it.

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

/** Pinch-zoomed in: a sideways finger pans the page to read it, as everywhere else, rather than changing the day. */
const zoomedIn = () => (window.visualViewport?.scale ?? 1) > 1.01;

// How many swipe areas are mounted, so the page's Back swipe comes back only once the last one goes.
let areas = 0;
let before = { html: '', body: '' };
function holdBack(): () => void {
  const html = document.documentElement.style;
  const body = document.body.style;
  if (areas++ === 0) {
    before = { html: html.overscrollBehaviorX, body: body.overscrollBehaviorX };
    html.overscrollBehaviorX = 'none';
    body.overscrollBehaviorX = 'none';
  }
  return () => {
    if (--areas > 0) return;
    html.overscrollBehaviorX = before.html;
    body.overscrollBehaviorX = before.body;
  };
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
      if (t && el && !zoomedIn() && !el.closest(NO_SWIPE_FROM) && !inSidewaysScroll(el, root)) from = { x: t.clientX, y: t.clientY };
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
    const release = holdBack();
    root.addEventListener('touchstart', down, { passive: true });
    root.addEventListener('touchmove', move, { passive: true });
    root.addEventListener('touchend', up, { passive: true });
    root.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      release();
      root.removeEventListener('touchstart', down);
      root.removeEventListener('touchmove', move);
      root.removeEventListener('touchend', up);
      root.removeEventListener('touchcancel', cancel);
    };
  }, [enabled]);
}
