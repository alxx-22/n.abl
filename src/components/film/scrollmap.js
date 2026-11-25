import { BEAT, LIST, HOLDS } from './reel.js'

/* ============================================================
   THE FILM'S SCROLL MAP

   How far the page scrolls for each second of the See it work film. It
   lives here, not in FilmSection, because two things need the same
   answer: the film, to know which frame to show, and the lit ground
   behind the page (LitGround), to know where each of the film's
   chapters sits on the page so the light can change with them.

   Scroll distance per second of film, between the important moments. A
   wheel notch is about 100px, so roughly one notch a second, which is the
   reel's pace. A phone swipe covers more ground, so it gets less. At the
   moments in HOLDS (reel.js) the same scroll moves time several times
   slower, so those take more scrolling to get past.
   ============================================================ */
export const PX_DESK = 105, PX_TOUCH = 90

/* The film's length is known before anything is built, so the section can
   take its height on the first render. */
export const DUR = LIST.reduce((n, s) => n + s.beats, 0) * BEAT + 0.6

/* Film time to scroll distance, and back. Monotonic, so the way back is a
   bisection: thirty halvings of a thirty-second film is far finer than a
   frame. */
export function pxAt(t, px) {
  let p = t * px
  for (const [a, b, k] of HOLDS) p += Math.max(0, Math.min(t, b) - a) * (k - 1) * px
  return p
}
export function tAt(p, px) {
  let lo = 0, hi = DUR
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (pxAt(m, px) < p) lo = m; else hi = m }
  return (lo + hi) / 2
}

/* When each scene of the film starts, in film seconds. */
export function startOf(id) {
  let t = 0
  for (const s of LIST) { if (s.id === id) return t; t += s.beats * BEAT }
  return t
}

/* The film's own scroll rate on this device: the same test FilmSection
   makes when it builds the stage. */
export const filmPx = () =>
  (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) ? PX_TOUCH : PX_DESK
