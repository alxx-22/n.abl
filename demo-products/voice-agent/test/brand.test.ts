// A business's colours on the demo's pages (web/src/reception/brand.ts):
// whatever a website's colours are, the text, buttons and badges made from
// them stay readable (WCAG AA), a light website gets a light page, and the
// brand's own accent is kept wherever it can be.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandPalette, brandStyle, contrast, modeOf, parseColour, type RGB } from '../web/src/reception/brand.ts';

const c = (v: string) => parseColour(v) as RGB;

/** Every text colour against every surface it sits on, and the fills against their text. */
function readable(vars: Record<string, string>): string[] {
  const out: string[] = [];
  const panes = ['--bg', '--surface-1', '--surface-2', '--surface-3'];
  const need: [string, number][] = [['--cream-100', 7], ['--cream-200', 7], ['--cream-400', 4.5], ['--cream-600', 4.5], ['--amber', 4.5], ['--amber-light', 4.5], ['--warn', 4.5], ['--danger', 4.5], ['--ok', 4.5], ['--info', 4.5]];
  for (const [fg, ratio] of need) {
    for (const bg of panes) {
      const r = contrast(c(vars[fg]), c(vars[bg]));
      if (r < ratio) out.push(`${fg} on ${bg}: ${r.toFixed(2)}`);
    }
  }
  for (const [fg, bg] of [['--ink', '--accent'], ['--on-primary', '--brand-primary'], ['--on-danger-ground', '--danger-ground']]) {
    const r = contrast(c(vars[fg]), c(vars[bg]));
    if (r < 4.5) out.push(`${fg} on ${bg}: ${r.toFixed(2)}`);
  }
  return out;
}

test('brand colours: the text reads on every surface, whatever the website’s colours', () => {
  // A fixed spread of colours, every channel at five levels: pale, mid, dark, greys and saturated hues.
  const levels = [0, 64, 128, 192, 255];
  const all = levels.flatMap((r) => levels.flatMap((g) => levels.map((b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`)));
  const failures: string[] = [];
  for (let i = 0; i < all.length; i++) {
    for (const background of [all[i], all[(i * 7) % all.length], '#ffffff', '#0e0c0a', '#f4efe6']) {
      const accent = all[(i * 13 + 5) % all.length];
      const primary = all[(i * 31 + 11) % all.length];
      const p = brandPalette({ accent, primary, background });
      for (const f of readable(p.vars)) failures.push(`${accent}/${primary}/${background}: ${f}`);
    }
  }
  assert.deepEqual(failures.slice(0, 10), [], `${failures.length} unreadable pairs`);
});

test('brand colours: a light website gets a light page, a dark one a dark page', () => {
  assert.equal(modeOf('#ffffff'), 'light');
  assert.equal(modeOf('#f4efe6'), 'light');
  assert.equal(modeOf('#0e0c0a'), 'dark');
  assert.equal(modeOf('#1f3347'), 'dark');
  assert.equal(modeOf(null), 'dark');
  const light = brandPalette({ accent: '#d6336c', primary: '#1b2a4a', background: '#ffffff' });
  assert.equal(light.mode, 'light');
  assert.equal(light.vars['--surface-1'], '#ffffff', "the website's own background is the panels' colour");
  assert.equal(light.vars['color-scheme'], 'light');
  assert.equal(light.vars['--brand-primary'], '#1b2a4a', 'the main colour is kept when text reads on it');
});

test('brand colours: the accent is kept as it is unless it would vanish or its text would not read', () => {
  assert.equal(brandPalette({ accent: '#e9ac57', background: '#0e0c0a' }).vars['--accent'], '#e9ac57');
  assert.equal(brandPalette({ accent: '#d6336c', background: '#ffffff' }).vars['--accent'], '#d6336c');
  // White on white would vanish: it is darkened until it shows.
  const white = brandPalette({ accent: '#ffffff', background: '#ffffff' }).vars['--accent'];
  assert.ok(contrast(c(white), c('#ffffff')) >= 1.6, white);
  // Warnings stay amber, whatever the brand: a red brand never makes a warning look like an error.
  const red = brandPalette({ accent: '#d62828', background: '#0e0c0a' }).vars;
  assert.equal(red['--warn'], '#e9ac57');
  assert.equal(red['--amber'].length, 7);
});

test('brand colours: no colours, no change: only the fonts', () => {
  assert.deepEqual(brandStyle(undefined), {});
  assert.deepEqual(brandStyle({ font_heading: 'Playfair Display' }), { '--brand-heading': '"Playfair Display", Georgia, "Times New Roman", serif' });
  const s = brandStyle({ accent: '#e9ac57', background: '#ffffff' }) as Record<string, string>;
  assert.equal(s.colorScheme, 'light');
  assert.equal(s['color-scheme'], undefined);
});
