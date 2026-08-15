# n.abl brand assets

Regenerate with `node scripts/build-logos.mjs`. They are rendered from the
same self-hosted typeface the site uses, so the wordmark in a deck matches the
wordmark in the nav.

| File | Use |
|---|---|
| `nabl-wordmark-cream.png` | Full wordmark, transparent — for dark backgrounds |
| `nabl-wordmark-espresso.png` | Full wordmark, transparent — for light backgrounds |
| `nabl-wordmark-on-espresso.png` | Wordmark on the brand ground, with the accent bloom |
| `nabl-wordmark-on-cream.png` | Wordmark on the light card tone |
| `nabl-mark-cream.png` | Short mark (n + dot), transparent — avatars, favicons |
| `nabl-mark-espresso.png` | Short mark, transparent, for light backgrounds |

Vector masters live in `public/`: `favicon.svg` (rounded tile) and
`brand/mark.svg` (the mark, drawn as paths so it needs no font). The social
card is `public/brand/og.png` at 1200x630.

## Colours

| Token | Hex | Use |
|---|---|---|
| Espresso | `#0E0C0A` | Page ground |
| Surface | `#1A1613` | Raised panels |
| Cream | `#F0E7D8` | Body text on dark |
| Cream bright | `#FBF6EC` | Headings on dark |
| Muted cream | `#9A8F80` | Secondary text on dark |
| Amber | `#E9AC57` | Accent, the square dot |
| Amber deep | `#B87718` | Accent on light grounds — plain amber fails contrast there |
| Ink | `#14110E` | Body text on light |

Typefaces: **Space Grotesk** (display) and **Inter Tight** (UI), with
**JetBrains Mono** for keys and figures. All self-hosted in `public/fonts/`;
loading them from Google would disclose every visitor's IP to a third party.

## The dot

The square full stop is the one piece of equity carried over from the previous
identity. It replaces the full stop on key headlines and sits inside the
wordmark. It is amber now, not lime — but it is still the mark.
