// A business's look in the workspace: its accent colour, and its fonts by
// name with the nearest system fallback. We never load their font files; if
// the visitor happens to have the font, it shows, otherwise the fallback does.

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

/** CSS variables for a page in the business's colours and fonts. */
export function brandStyle(theme: { accent?: string | null; font_heading?: string | null; font_body?: string | null } | undefined): CSSProperties {
  const s: Record<string, string> = {};
  if (theme?.accent) s['--accent'] = theme.accent;
  const h = fontFamily(theme?.font_heading);
  const b = fontFamily(theme?.font_body);
  if (h) s['--brand-heading'] = h;
  if (b) s['--brand-body'] = b;
  return s as CSSProperties;
}
