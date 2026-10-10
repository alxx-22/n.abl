// A business's colours on the demo's pages (web/src/reception/brand.ts):
// whatever a website's colours are, the text, buttons and badges made from
// them stay readable (WCAG AA), a light website gets a light page, and the
// brand's own accent is kept wherever it can be.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brandPalette, brandStyle, contrast, luminance, modeOf, parseColour, type RGB } from '../web/src/reception/brand.ts';

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
  for (const [fg, bg] of [['--ink', '--accent'], ['--on-accent', '--accent-hover'], ['--on-primary', '--brand-primary'], ['--on-danger-ground', '--danger-ground']]) {
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

test('brand colours: a dark website keeps its own background; a mid-tone one is deepened until text reads', () => {
  const navy = brandPalette({ accent: '#04bbb1', primary: '#00344b', background: '#00344b' }).vars;
  assert.equal(navy['--bg'], '#00344b', 'a navy site’s page is its own navy');
  assert.equal(navy['--accent'], '#04bbb1');
  const mid = brandPalette({ accent: '#04bbb1', background: '#4a6b8a' });
  assert.equal(mid.mode, 'dark');
  assert.ok(luminance(c(mid.vars['--bg'])) <= 0.035, mid.vars['--bg']);
});

test('brand colours: a fill under --ink text is the accent itself, never its text shade', () => {
  // --ink is made to read on --accent; --amber is the accent darkened or lightened for text, so --ink may not read on it.
  const css = ['web/src/styles.css', 'web/src/reception/reception.css'].map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  const bad = css.split('}').filter((rule) => /background:\s*var\(--amber/.test(rule) && /(^|[\s;{])color:\s*var\(--ink\)/.test(rule));
  assert.deepEqual(bad.map((r) => r.trim().split('{')[0].trim()), []);
});

// The floor plan (reception.css) mixes its colours from the page's palette. These read its definitions and work
// them out for each brand, as the browser would, so a change there that leaves a table's text unreadable fails here.
const css = readFileSync(new URL('../web/src/reception/reception.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const floorSection = css.slice(css.indexOf(':root, .builder-page, .workspace-page {'), css.indexOf('.workspace {'));

/** Splits a function's arguments at its top-level commas. */
const args = (s: string) => {
  const out: string[] = [];
  let depth = 0, from = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) { out.push(s.slice(from, i).trim()); from = i + 1; }
  }
  return [...out, s.slice(from).trim()];
};

/** The colour an expression of var() and color-mix(in srgb) comes to (opaque colours only). */
function resolve(expr: string, vars: Record<string, string>): RGB {
  const e = expr.trim();
  const v = /^var\((--[\w-]+)\)$/.exec(e);
  if (v) {
    assert.ok(vars[v[1]], `${v[1]} is not defined`);
    return resolve(vars[v[1]], vars);
  }
  const fn = /^([\w-]+)\(([\s\S]*)\)$/.exec(e);
  if (fn?.[1] === 'color-mix') {
    const [space, a, b] = args(fn[2]);
    assert.equal(space, 'in srgb');
    const pa = /\s(\d+)%$/.exec(a);
    const t = pa ? Number(pa[1]) / 100 : 0.5;
    const ca = resolve(pa ? a.slice(0, pa.index) : a, vars);
    const cb = resolve(b, vars);
    return ca.map((x, i) => x * t + cb[i] * (1 - t)) as RGB;
  }
  const c = parseColour(e);
  assert.ok(c, `can't work out ${e}`);
  return c;
}

test('floor plan: no fixed colours, so it wears the business’s', () => {
  assert.ok(floorSection.includes('.table .top') && floorSection.includes('.legend .l-free'), 'the floor plan section is where the test expects it');
  const fixed = floorSection.match(/#[0-9a-f]{3,8}\b|rgba?\(\s*\d|hsla?\(|\b(white|black)\b/gi) ?? [];
  assert.deepEqual(fixed, []);
  // The build rewrites light-dark() to follow the stylesheet's colour scheme, so a light website's plan would come out dark.
  assert.ok(!floorSection.includes('light-dark('), 'light-dark() in the floor plan');
});

test('floor plan: the text on every table and tag reads (WCAG AA), whatever the website’s colours', () => {
  const block = /:root, \.builder-page, \.workspace-page \{([^}]*)\}/.exec(css);
  assert.ok(block, 'the floor plan’s colour block');
  const planVars = Object.fromEntries([...block[1].matchAll(/(--plan-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  // What sits on what, as in reception.css: [text, ground]. The captions are drawn at 90% opacity.
  const cap = 'color-mix(in srgb, var(--cream) 90%, var(--plan-table))';
  const pairs: [string, string][] = [
    ['var(--heading)', 'var(--plan-table)'], [cap, 'var(--plan-table)'], ['var(--muted)', 'var(--plan-table)'],
    ['var(--heading)', 'var(--plan-walk-in)'], ['var(--cream)', 'var(--plan-walk-in)'],
    ['var(--ink)', 'var(--accent)'],
    ...['--plan-arriving', '--plan-seated', '--plan-late'].flatMap((g): [string, string][] => [['var(--heading)', `var(${g})`], ['var(--cream)', `var(${g})`]]),
    ['var(--surface-1)', 'var(--info)'],
    ...['--danger', '--info', '--ok', '--warn'].map((g): [string, string] => ['var(--surface-1)', `var(${g})`]),
    ['var(--surface-1)', 'color-mix(in srgb, var(--danger) 50%, var(--info))'],
    ['var(--heading)', 'var(--danger-ground)'],
    ['var(--cream)', 'var(--plan-bar)'],
  ];
  const levels = [0, 96, 192, 255];
  const spread = levels.flatMap((r) => levels.flatMap((g) => levels.map((b) => `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`)));
  const brands: [string | null, string | null, string | null][] = [
    [null, null, null],
    ['#ffe066', '#ffffff', '#ffffff'], ['#1b2a4a', '#1b2a4a', '#ffffff'], ['#d6336c', '#1b2a4a', '#ffffff'], ['#2ec4b6', '#0b3c49', '#06141b'],
    ...spread.flatMap((x, i): [string, string, string][] => [[x, spread[(i * 7) % spread.length], spread[(i * 11 + 3) % spread.length]], [x, x, '#ffffff'], [x, x, '#0e0c0a']]),
  ];
  const failures: string[] = [];
  for (const [accent, primary, background] of brands) {
    const p = brandPalette({ accent, primary, background });
    const vars = { ...p.vars, ...planVars };
    for (const [fg, bg] of pairs) {
      const r = contrast(resolve(fg, vars), resolve(bg, vars));
      if (r < 4.5) failures.push(`${accent}/${primary}/${background}: ${fg} on ${bg}: ${r.toFixed(2)}`);
    }
  }
  assert.deepEqual(failures.slice(0, 10), [], `${failures.length} unreadable pairs`);
});
