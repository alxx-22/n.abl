// A business's look in its builder and workspace: its own colours and fonts.
// The website scan (or the Basics step) gives three colours: the accent, the
// main colour and the background. From them comes every colour the page
// uses: a light page for a light website, a dark one for a dark website, the
// accent on buttons, links and headings, the main colour on the header band,
// and text that always passes WCAG AA, however pale or dark the brand is.
// Warnings, errors and success keep their own colours, so a red brand never
// makes a warning look like an error. Fonts are named, never loaded: if the
// visitor has the font it shows, otherwise the nearest system fallback does.

import type { CSSProperties } from 'react';

const STACK = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  slab: 'Rockwell, "Roboto Slab", Georgia, serif',
  script: '"Brush Script MT", cursive',
  mono: 'ui-monospace, monospace',
  display: 'Impact, "Arial Narrow", system-ui, sans-serif',
};

function category(name: string): keyof typeof STACK {
  const n = name.toLowerCase();
  if (/mono|code|courier/.test(n)) return 'mono';
  if (/script|hand|brush|pacifico|dancing|caveat|satisfy|sacramento|great vibes|allura|parisienne/.test(n)) return 'script';
  if (/slab|rockwell|arvo|zilla|bitter|crete/.test(n)) return 'slab';
  if (/bebas|oswald|anton|league gothic|abril|alfa|ultra|fjalla|archivo black|bungee/.test(n)) return 'display';
  if (/serif(?!.*sans)|garamond|playfair|lora|merriweather|baskerville|caslon|didot|bodoni|georgia|times|cormorant|crimson|spectral|prata|domine|cardo|gilda|marcellus|cinzel|trajan|freight|tiempos|canela|recoleta|ogg/.test(n)) return 'serif';
  return 'sans';
}

export function fontFamily(name: string | undefined | null): string | undefined {
  if (!name || name === 'system-ui') return undefined;
  const safe = name.replace(/[^A-Za-z0-9 \-]/g, '');
  return `"${safe}", ${STACK[category(safe)]}`;
}

// ── Colour arithmetic (sRGB, WCAG 2 contrast) ─────────────────────────────

export type RGB = [number, number, number];

/** "#abc", "#aabbcc", "#aabbccdd" or "rgb(a)(…)": the colour, or null. */
export function parseColour(c: string | null | undefined): RGB | null {
  const s = (c ?? '').trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return m[1].split('').map((x) => parseInt(x + x, 16)) as RGB;
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s);
  if (m) {
    const h = m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
  }
  m = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/.exec(s);
  if (m) return [m[1], m[2], m[3]].map((x) => Math.min(255, Math.round(Number(x)))) as RGB;
  return null;
}

export const hex = (c: RGB) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const rgbList = (c: RGB) => c.map((v) => Math.round(v)).join(', ');
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;

export function luminance(c: RGB): number {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** `c` moved towards `to` in small steps until it reaches `ratio` against each of `against`. */
function until(c: RGB, to: RGB, against: RGB[], ratio: number): RGB {
  let x = c;
  for (let i = 0; i < 60 && against.some((b) => contrast(x, b) < ratio); i++) x = mix(x, to, 0.08);
  return against.some((b) => contrast(x, b) < ratio) ? to : x;
}

/** The colour's hue at full brightness: what tints the greys, so they belong to the brand. */
function hueOf(c: RGB): RGB {
  const top = Math.max(...c);
  return top < 8 ? [255, 255, 255] : (c.map((v) => (v * 255) / top) as RGB);
}

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
/** n.abl's own: the warm near-black ground and the amber. */
const NABL_GROUND: RGB = [14, 12, 10];
const NABL_AMBER: RGB = [233, 172, 87];

export type Mode = 'light' | 'dark';

export interface BrandColours {
  accent?: string | null;
  primary?: string | null;
  background?: string | null;
}

/** Light for a light website (its background past this luminance), dark otherwise. */
export const modeOf = (background: string | null | undefined): Mode => {
  const bg = parseColour(background);
  return bg && luminance(bg) > 0.4 ? 'light' : 'dark';
};

/**
 * Every colour variable the demo's pages read, made from a business's three
 * colours. The page's text, lines, buttons and badges read only these, so
 * setting them on the page's root re-colours all of it.
 */
export function brandPalette(t: BrandColours): { mode: Mode; vars: Record<string, string> } {
  const accentIn = parseColour(t.accent) ?? NABL_AMBER;
  const bgIn = parseColour(t.background) ?? NABL_GROUND;
  const primaryIn = parseColour(t.primary);
  const mode = modeOf(hex(bgIn));
  const light = mode === 'light';
  // Greys lean towards the background's hue on a dark page, and the text towards the main colour's on a light one.
  const tint = hueOf(light ? primaryIn ?? bgIn : bgIn);

  // The ground and the surfaces on it.
  let ground: RGB, surfaces: RGB[], bgAlt: RGB, ink: RGB[];
  if (light) {
    // The website's own background on the panels; the ground a shade deeper, so panels stand out.
    let page = bgIn;
    for (let i = 0; i < 30 && luminance(page) < 0.86; i++) page = mix(page, WHITE, 0.12);
    const inkBase = mix(BLACK, tint, 0.13);
    ground = mix(page, inkBase, 0.04);
    bgAlt = mix(page, inkBase, 0.02);
    surfaces = [page, mix(page, inkBase, 0.045), mix(page, inkBase, 0.075), mix(page, inkBase, 0.12)];
    const panes = [ground, ...surfaces.slice(0, 3)];
    ink = [0, 0.1, 0.22, 0.34, 0.48, 0.66].map((t2, i) => {
      const c = mix(inkBase, page, t2);
      // Headlines and body text clear 7:1; secondary and muted text clear AA; the disabled shade is left faint.
      return i === 5 ? c : until(c, BLACK, panes, i < 2 ? 7 : 4.5);
    });
  } else {
    // A dark website's own background, as it is when cream text reads on it and on the panels lifted from it
    // (a navy or charcoal site keeps its colour); a mid-tone one is deepened until it does.
    let deep = bgIn;
    for (let i = 0; i < 40 && luminance(deep) > 0.035; i++) deep = mix(deep, BLACK, 0.14);
    // Panels are lifted towards the background's own hue (n.abl's warm brown, a navy site's blue), not towards grey.
    const lift = mix(tint, WHITE, 0.35);
    const cream = mix(WHITE, tint, 0.12);
    ground = deep;
    bgAlt = mix(deep, lift, 0.02);
    surfaces = [0.05, 0.08, 0.115, 0.155].map((t2) => mix(deep, lift, t2));
    const panes = [ground, ...surfaces.slice(0, 3)];
    ink = [0, 0.06, 0.15, 0.24, 0.42, 0.66].map((t2, i) => {
      const c = mix(cream, deep, t2);
      return i === 5 ? c : until(c, WHITE, panes, i < 2 ? 7 : 4.5);
    });
  }
  const textPanes = [ground, surfaces[0], surfaces[1], surfaces[2]];

  // The accent: the brand's own colour on buttons and fills, nudged only when it would vanish on the page.
  const away = light ? BLACK : WHITE;
  let fill = until(accentIn, away, [surfaces[0]], 1.6);
  const onDark: RGB = mix(BLACK, tint, 0.09);
  let onAccent = contrast(onDark, fill) >= contrast(WHITE, fill) ? onDark : WHITE;
  fill = until(fill, onAccent === WHITE ? BLACK : WHITE, [onAccent], 4.5);
  const accentText = until(fill, away, textPanes, 4.5);
  const accentTextSoft = until(mix(accentText, away, light ? 0.12 : 0.22), away, textPanes, 4.5);

  // The main colour: the header band, with text that reads on it.
  let primary = primaryIn ?? (light ? mix(fill, BLACK, 0.35) : surfaces[1]);
  const onPrimaryDark = mix(BLACK, hueOf(primary), 0.09);
  const onPrimary = contrast(onPrimaryDark, primary) >= contrast(WHITE, primary) ? onPrimaryDark : WHITE;
  primary = until(primary, onPrimary === WHITE ? BLACK : WHITE, [onPrimary], 4.5);

  // Warnings, errors, success and information keep their meaning in either mode.
  // n.abl's own on a dark page, kept unless a tinted surface needs them lighter.
  const keep = (dark: RGB, lightOne: RGB) => until(light ? lightOne : dark, away, textPanes, 4.5);
  const warn = keep(NABL_AMBER, [183, 121, 31]);
  const warnSoft = light ? warn : until([242, 197, 126], away, textPanes, 4.5);
  const danger = keep([224, 121, 109], [196, 50, 38]);
  const ok = keep([157, 190, 151], [56, 120, 64]);
  const info = keep([143, 184, 224], [40, 100, 160]);
  const dangerGround: RGB = light ? mix(surfaces[0], danger, 0.1) : [58, 29, 23];
  const onDangerGround = light ? until(mix(danger, BLACK, 0.3), BLACK, [dangerGround], 7) : ([255, 217, 207] as RGB);
  const errorGround: RGB = light ? mix(surfaces[0], danger, 0.06) : [42, 21, 18];

  const lineRgb = rgbList(ink[1]);
  const a = (v: number) => `rgba(${lineRgb}, ${v})`;
  const accentRgb = rgbList(fill);
  return {
    mode,
    vars: {
      '--bg': hex(ground), '--ground': hex(ground), '--bg-rgb': rgbList(ground), '--bg-alt': hex(bgAlt),
      '--surface': hex(surfaces[0]), '--surface-1': hex(surfaces[0]), '--surface-2': hex(surfaces[1]), '--surface-3': hex(surfaces[2]), '--surface-4': hex(surfaces[3]),
      '--surface-2-rgb': rgbList(surfaces[1]),
      '--cream-100': hex(ink[0]), '--cream-200': hex(ink[1]), '--cream-300': hex(ink[2]), '--cream-400': hex(ink[3]), '--cream-600': hex(ink[4]), '--cream-800': hex(ink[5]),
      '--heading': hex(ink[0]), '--cream': hex(ink[1]), '--muted': hex(ink[3]), '--dim': hex(ink[4]),
      '--cream-rgb': lineRgb,
      '--line-faint': a(light ? 0.08 : 0.06), '--line': a(light ? 0.16 : 0.11), '--line-strong': a(light ? 0.3 : 0.2),
      '--glow-xs': `0 0 12px ${a(light ? 0.06 : 0.05)}`, '--glow-sm': light ? `0 1px 3px ${a(0.08)}` : `0 0 24px ${a(0.07)}`,
      '--glow-md': light ? `0 4px 16px ${a(0.1)}` : `0 0 48px ${a(0.1)}`, '--glow-lg': light ? `0 8px 30px ${a(0.12)}` : `0 0 96px ${a(0.13)}`,
      '--glow-inset': `inset 0 1px 0 ${a(light ? 0.03 : 0.06)}`,
      '--accent': hex(fill), '--accent-rgb': accentRgb, '--glow-accent': `0 0 32px rgba(${accentRgb}, ${light ? 0.25 : 0.2})`,
      '--ink': hex(onAccent), '--on-accent': hex(onAccent),
      '--amber': hex(accentText), '--amber-light': hex(accentTextSoft),
      '--brand-primary': hex(primary), '--on-primary': hex(onPrimary), '--on-primary-rgb': rgbList(onPrimary),
      '--warn': hex(warn), '--warn-light': hex(warnSoft), '--warn-pale': hex(light ? warn : until([248, 217, 164], away, textPanes, 4.5)), '--warn-rgb': rgbList(warn),
      '--danger': hex(danger), '--danger-rgb': rgbList(danger), '--danger-soft': `rgba(${rgbList(danger)}, ${light ? 0.1 : 0.13})`,
      '--danger-ground': hex(dangerGround), '--on-danger-ground': hex(onDangerGround), '--error-ground': hex(errorGround),
      '--ok': hex(ok), '--success': hex(ok), '--ok-rgb': rgbList(ok),
      '--info': hex(info), '--info-rgb': rgbList(info),
      'color-scheme': mode,
    },
  };
}

/** The style for a page in the business's colours and fonts. */
export function brandStyle(theme: (BrandColours & { font_heading?: string | null; font_body?: string | null }) | undefined): CSSProperties {
  const s: Record<string, string> = {};
  if (theme && (theme.accent || theme.primary || theme.background)) Object.assign(s, brandPalette(theme).vars);
  const h = fontFamily(theme?.font_heading);
  const b = fontFamily(theme?.font_body);
  if (h) s['--brand-heading'] = h;
  if (b) s['--brand-body'] = b;
  if (s['color-scheme']) {
    (s as Record<string, string>).colorScheme = s['color-scheme'];
    delete s['color-scheme'];
  }
  return s as CSSProperties;
}
