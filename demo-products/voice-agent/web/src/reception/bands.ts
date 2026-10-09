// The window sizes the demo is laid out for, the same bands as the top of
// reception.css: a screen that rearranges itself (the builder's steps, the
// workspace's panels) asks which band it is in rather than guessing from a
// width of its own.

import { useEffect, useState } from 'react';

export type Band = 'desktop' | 'laptop' | 'tablet' | 'phone';

const FLOORS: [Band, string][] = [
  ['desktop', '(min-width: 1280px)'],
  ['laptop', '(min-width: 1024px)'],
  ['tablet', '(min-width: 641px)'],
];

export function bandNow(): Band {
  if (typeof matchMedia !== 'function') return 'desktop';
  return FLOORS.find(([, q]) => matchMedia(q).matches)?.[0] ?? 'phone';
}

export function useBand(): Band {
  const [band, setBand] = useState(bandNow);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const lists = FLOORS.map(([, q]) => matchMedia(q));
    const on = () => setBand(bandNow());
    for (const l of lists) l.addEventListener('change', on);
    return () => {
      for (const l of lists) l.removeEventListener('change', on);
    };
  }, []);
  return band;
}

/** A tablet or a phone: one thing at a time, with the rest a tap away. */
export const narrowBand = (b: Band) => b === 'tablet' || b === 'phone';

/**
 * Scrolls a sideways strip just enough to show `el`, leaving the page where
 * it is (scrollIntoView would move the page too).
 */
export function keepInStrip(el: Element | null | undefined, strip: Element | null | undefined = el?.parentElement) {
  if (!el || !strip) return;
  const s = strip.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (!s.width || !r.width) return;
  if (r.left < s.left) strip.scrollLeft -= s.left - r.left + 24;
  else if (r.right > s.right) strip.scrollLeft += r.right - s.right + 24;
}
