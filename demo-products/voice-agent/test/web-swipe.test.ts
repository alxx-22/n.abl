// The phone's pagers (web/src/reception/DayPager.tsx): a sideways swipe moves
// a day, an area or a visit window, and nothing else does: not a tap, not a
// thumb scrolling the page on a slant (web/src/reception/swipe.ts). The day
// on screen is always one the pager can name (web/src/reception/dayList.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { farDay, withShown } from '../web/src/reception/dayList.ts';
import { SWIPE_MIN, SWIPE_RATIO, swipeDirection } from '../web/src/reception/swipe.ts';

test('swipe: a finger drawn left moves to the next one, drawn right to the previous', () => {
  assert.equal(swipeDirection(-120, 0), 1);
  assert.equal(swipeDirection(120, 0), -1);
  assert.equal(swipeDirection(-80, 12), 1, 'a little up or down on the way is still a swipe');
  assert.equal(swipeDirection(80, -12), -1);
});

test('swipe: a tap or a short wobble moves nothing', () => {
  assert.equal(swipeDirection(0, 0), 0);
  assert.equal(swipeDirection(-(SWIPE_MIN - 1), 0), 0);
  assert.equal(swipeDirection(SWIPE_MIN - 1, 0), 0);
  assert.equal(swipeDirection(-SWIPE_MIN, 0), 1, 'the threshold itself counts');
  assert.ok(SWIPE_MIN >= 40 && SWIPE_MIN <= 80, `${SWIPE_MIN}px is about a thumb's width`);
});

test('swipe: scrolling the page, straight or on a slant, moves nothing', () => {
  assert.equal(swipeDirection(0, -300), 0);
  assert.equal(swipeDirection(-60, -200), 0);
  // Just short of clearly sideways, then exactly it.
  assert.equal(swipeDirection(-100, -100 / SWIPE_RATIO - 1), 0);
  assert.equal(swipeDirection(-100, -100 / SWIPE_RATIO), 1);
  assert.equal(swipeDirection(100, 51), 0);
});

test('swipe: a gesture with no coordinates moves nothing', () => {
  assert.equal(swipeDirection(Number.NaN, 0), 0);
  assert.equal(swipeDirection(-100, Number.NaN), 0);
  assert.equal(swipeDirection(Number.POSITIVE_INFINITY, 0), 0);
});

test('pager styles: only the page’s colour variables, so it wears each business’s colours', () => {
  const css = readFileSync(new URL('../web/src/reception/pager.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(css.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|(?<![\w-])(white|black)(?![\w-])/gi) ?? [], []);
  // --ink is made to read on --accent, and on nothing else.
  const onInk = css.split('}').filter((rule) => /(^|[\s;{])color:\s*var\(--ink\)/.test(rule));
  assert.ok(onInk.length, 'the pager has text on the accent');
  for (const rule of onInk) assert.match(rule, /background:\s*var\(--accent\)/, rule.trim());
});

test('pager styles: the buttons are a thumb’s size', () => {
  const css = readFileSync(new URL('../web/src/reception/pager.css', import.meta.url), 'utf8');
  for (const sel of ['.pager > button', '.pager-list button', '.day-initials button', '.area-row .zoom button']) {
    const rule = css.slice(css.indexOf(`${sel}`)).split('}')[0];
    assert.match(rule, /(^|[\s;{])height:\s*44px/, `${sel} is 44px tall`);
  }
  assert.match(css, /grid-template-columns:\s*44px minmax\(0, 1fr\) 44px/, '‹ and › are 44px wide');
  assert.match(css, /\.area-row \.zoom button \{[^}]*(^|[\s;{])width:\s*44px/, 'the floor plan’s − and + too');
});

test('swipe areas: a swipe right is never the browser’s Back, and the page still pans when zoomed', () => {
  // Chrome on a touch screen takes a sideways swipe nothing can scroll as Back or Forward. It ends as an
  // overscroll of the page itself wherever it starts, inside a box that scrolls sideways too, so that is
  // switched off on the page while a swipe area is mounted, and given back when the last one goes.
  const src = readFileSync(new URL('../web/src/reception/useSwipe.ts', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.match(src, /html\.overscrollBehaviorX = 'none';\s*body\.overscrollBehaviorX = 'none';/);
  assert.match(src, /if \(--areas > 0\) return;\s*html\.overscrollBehaviorX = before\.html;\s*body\.overscrollBehaviorX = before\.body;/);
  assert.match(src, /const release = holdBack\(\);[\s\S]*return \(\) => \{\s*release\(\);/);
  // Taking the sideways travel from the browser on the swipe area stopped a pinch-zoomed page panning.
  assert.doesNotMatch(src, /touchAction|touch-action/);
  assert.match(src, /visualViewport\?\.scale/, 'pinch-zoomed in, a sideways finger pans the page rather than changing the day');
});

test('day lists: the day on screen is always one of them, in date order', () => {
  const week = ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];
  assert.equal(withShown(week, '2026-10-15'), week, 'a day of the week: the list as it was');
  assert.deepEqual(withShown(week, '2026-10-25'), [...week, '2026-10-25'], 'a call booked further ahead: added at the end');
  assert.deepEqual(withShown(week, '2026-10-12'), ['2026-10-12', ...week], 'a day before: added at the start');
  // The board's diary lists booking days after the week, in the order the bookings came.
  assert.deepEqual(withShown(['2026-10-13', '2026-10-30', '2026-10-20'], '2026-10-25'), ['2026-10-13', '2026-10-20', '2026-10-25', '2026-10-30']);
  assert.equal(withShown(week, ''), week, 'no day yet: nothing added');
});

test('day lists: a day beyond the week says its month', () => {
  // Browsers put a comma after the weekday where Node may not: either reads the same.
  assert.match(farDay('2026-10-25'), /^Sun,? 25 Oct$/);
  assert.match(farDay('2026-12-01'), /^Tue,? 1 Dec$/);
});
