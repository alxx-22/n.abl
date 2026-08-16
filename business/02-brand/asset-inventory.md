# Brand asset inventory

Last checked against the repository: 2026-08-15.

What is actually in `public/brand/`, `public/fonts/` and `logos/` today, file by
file, and what is missing. This is a stock list, not a wish list. If a file is
named here it exists; if it does not exist it is in section 6.

Sizes are bytes as committed. Re-check this file whenever an asset is added,
regenerated or deleted.

---

## 1. `public/brand/` — the masters and the shipped rasters

| File | Size | Dimensions | What it is |
|---|---|---|---|
| `wordmark.svg` | 2,203 B | `viewBox 0 0 273 100` | **The master.** The full wordmark, drawn as stroked paths and one filled square. Strokes take `currentColor`; the dot takes `var(--mark-accent, #E9AC57)`. Carries the construction and the 7 / 7 / 13 / 10 spacing reasoning in comments. |
| `mark.svg` | 580 B | `viewBox 0 0 104 100` | **The master** for the short mark: the `n` and the dot only, same geometry. Used for avatars and small placements. |
| `og.png` | 308,534 B | 1200 × 630 | The social card. Espresso ground, amber and cream bloom, a noise layer at 0.035, the drawn wordmark at 270 px and a Space Grotesk headline. Referenced from `index.html` as `og:image`. Generated. |
| `wordmark-email.png` | 10,538 B | 632 × 244 | Cream wordmark on transparent, for the six email templates. Used at `width="150"`, so it has roughly 4× the pixels it needs and stays sharp on a retina mail client. |

`og.png` is regenerated with `node scripts/build-og.mjs`. That script inlines the
two woff2 files as base64 data URIs, so the card never depends on a font CDN
either.

## 2. `public/` — adjacent, and brand-owned

| File | Size | Dimensions | What it is |
|---|---|---|---|
| `favicon.svg` | 508 B | `viewBox 0 0 100 100` | The mark inset in a rounded espresso tile, `rx="22"`, ground `#0E0C0A`, stroke `#F0E7D8`, dot `#E9AC57`. The mark is placed at `translate(2 3) scale(0.86)` to sit optically centred rather than mathematically centred. The only asset drawn to survive at 16 px. |

## 3. `logos/` — generated exports for decks and documents

All six are produced by `node scripts/build-logos.mjs`, which renders
`public/brand/wordmark.svg` and `mark.svg` in a headless browser at
`deviceScaleFactor: 2`. **Nothing in that pipeline depends on a typeface being
installed or loaded.**

| File | Size | Dimensions | Ground | Use |
|---|---|---|---|---|
| `nabl-wordmark-cream.png` | 51,667 B | 2680 × 1120 | transparent | Full wordmark for dark backgrounds |
| `nabl-wordmark-espresso.png` | 52,652 B | 2680 × 1120 | transparent | Full wordmark for light backgrounds |
| `nabl-wordmark-on-espresso.png` | 55,232 B | 2960 × 1320 | `#0E0C0A` | Wordmark on the brand ground, with the amber bloom |
| `nabl-wordmark-on-cream.png` | 52,373 B | 2960 × 1320 | `#F7F2E8` | Wordmark on the light card tone |
| `nabl-mark-cream.png` | 17,373 B | 1264 × 1200 | transparent | Short mark for dark backgrounds. Avatars, favicons. |
| `nabl-mark-espresso.png` | 17,502 B | 1264 × 1200 | transparent | Short mark for light backgrounds |

Two of these are currently wrong. See item 6.1.

## 4. `public/fonts/` — the self-hosted type

| File | Size | Family | Subset |
|---|---|---|---|
| `SpaceGrotesk-latin.woff2` | 22,288 B | Space Grotesk | Latin |
| `SpaceGrotesk-latin-ext.woff2` | 18,940 B | Space Grotesk | Latin Extended |
| `InterTight-latin.woff2` | 44,872 B | Inter Tight | Latin |
| `InterTight-latin-ext.woff2` | 89,800 B | Inter Tight | Latin Extended |
| `JetBrainsMono-latin.woff2` | 31,432 B | JetBrains Mono | Latin |
| `JetBrainsMono-latin-ext.woff2` | 11,624 B | JetBrains Mono | Latin Extended |
| `fonts.css` | 7,782 B | — | 18 `@font-face` blocks |

**Total font payload: 218,956 bytes, about 214 KB.** A Latin-only page downloads
considerably less, because the subsets are split by `unicode-range`.

Every file is a variable font, which is why eighteen `@font-face` blocks are
served by six files. The blocks declare: Space Grotesk 400 / 500 / 600 / 700,
Inter Tight 400 / 500 / 600, JetBrains Mono 400 / 500, each in both subsets. No
italics ship. Every block sets `font-display: swap`.

`index.html` preloads `SpaceGrotesk-latin.woff2` and `InterTight-latin.woff2`
with `crossorigin`, and links `/fonts/fonts.css`. There is no reference to any
external font host anywhere in the repository, which is the point.

## 5. Where the brand lives in code

Not assets, but the places that must move together with them.

| Path | What it holds |
|---|---|
| `src/styles/tokens.css` | Every colour, type, spacing, radius and motion token. The implementation of the palette. |
| `src/components/ui/index.jsx` | The `Logo` component. The same paths as the SVG masters, inlined so they inherit `currentColor`, cost no extra request and stay crisp. Takes `size` and `showWord`. |
| `src/styles/components.css` | `.nabl-logo` and `.nabl-logo__dot`, including the low-opacity amber drop shadow and its hover state. |
| `src/lib/welcomeDoc.js` | Inlines the wordmark so the generated welcome document is a single self-contained file. Has its own print stylesheet. |
| `scripts/build-logos.mjs` | Generates the six PNGs in `logos/`. |
| `scripts/build-og.mjs` | Generates `public/brand/og.png`. |
| `scripts/check-email-contrast.mjs` | `npm run test:emails`. Renders each email template and measures resolved contrast against the first opaque ancestor background. |

---

## 6. What is missing or wrong

Six open items. None of them is a design decision; all of them are jobs.

### 6.1 The light-ground exports use the wrong amber — **fix first**

`scripts/build-logos.mjs` sets the dot fill once, for every variant:

```js
#t rect{fill:${AMBER}; ...}
```

`AMBER` is `#E9AC57`. That is correct for the four dark and transparent-for-dark
variants and wrong for the two light-ground ones.
`nabl-wordmark-espresso.png` is intended for light backgrounds, and
`nabl-wordmark-on-cream.png` renders on `#F7F2E8`, where `#E9AC57` measures
**1.79:1**. The square dot is the one piece of equity carried over from the old
identity and on those two files it is close to invisible.

**Fix:** make the dot colour a per-variant field, use `#B87718` wherever the
ground is light, and re-run `node scripts/build-logos.mjs`.

The same defect exists at the master level. `wordmark.svg` and `mark.svg` expose
the dot as `var(--mark-accent, #E9AC57)`, and CSS custom properties do not apply
to an SVG loaded through an `<img>` tag. So `<img src="/brand/wordmark.svg">` on
a light page renders the pale fallback. Either add a light-ground master, or
document that the masters must be inlined when the ground is light.

### 6.2 `scripts/fetch-fonts.sh` does not exist

The header of `public/fonts/fonts.css` says:

> Regenerate with scripts/fetch-fonts.sh

There is no such file. `scripts/` contains `build-logos.mjs`, `build-og.mjs`,
`check-email-contrast.mjs`, `e2e-live.mjs`, `e2e-ui.mjs`, `mock-supabase.mjs` and
`security-check.mjs`. The fonts therefore cannot be rebuilt, resubset or updated
from a documented command, and the exact subsetting used is not recorded
anywhere.

**Fix:** write the script, or amend the comment to describe how the files were
actually produced.

### 6.3 No font licences ship with the fonts

Space Grotesk, Inter Tight and JetBrains Mono are all released under the SIL Open
Font License 1.1, which requires the licence to accompany the font files. There
is no `OFL.txt`, no `LICENSE` and no attribution file anywhere in the repository,
and the woff2 files are served publicly from `nabl.agency`.

**Fix:** add the three licence texts to `public/fonts/`, with a short
`public/fonts/README.md` naming each family, its version, its source and its
licence. This is cheap and it is the kind of thing a client's IT contact asks
about.

### 6.4 No raster icon fallback

`index.html` declares only `<link rel="icon" href="/favicon.svg">`. There is no
`apple-touch-icon.png`, no PNG fallback and no web app manifest. Adding the site
to an iOS home screen produces a screenshot rather than the mark.

**Fix:** export a 180 × 180 `apple-touch-icon.png` from `favicon.svg` and declare
it. Low urgency, five minutes of work.

### 6.5 No light-ground email wordmark

`wordmark-email.png` is the cream version only. Any email panel on a cream card
that needs the wordmark has nothing to use.

**Fix:** export an espresso version at the same 632 × 244 and add it to
`public/brand/`, or confirm in `08-email-pack` that no template needs one.

### 6.6 No automated contrast check outside the email pack

`npm run test:emails` measures the six email templates properly, in a real
browser. There is no equivalent for the site tokens, the generated welcome
document or the exported logos, so the deep-amber rule is enforced by review
rather than by a test.

**Fix:** extend the contrast script, or add a small check that asserts the token
pairs in `brand-guidelines.md` section 3.1 still measure what that table claims.
This is what would have caught 6.1.

---

## 7. Stale descriptions still in the repository

The rendered output is already on the new brand. These are places where the
*words* still describe the old one. They matter because the next person to touch
the file will believe them.

| File | What it says | Reality |
|---|---|---|
| `logos/README.md` | The exports are "rendered from the same self-hosted typeface the site uses" | They are rendered from `wordmark.svg` and `mark.svg`. `build-logos.mjs` says so itself: "Nothing here depends on a typeface being installed or loaded." This is the old "set in a typeface" description surviving. |
| `nabl-emails/README.txt` line 111 | "the lime top bar ... lime/black accents" | The bars and accents are amber `#E9AC57` and `#B87718`. |
| `nabl-emails/README.txt` line 52 | "a lime action box" | Amber. |
| `nabl-emails/README.txt` line 126 | "Arial Black / Impact for headings" | Correct as a description of the email fallback stack, but it reads as a brand statement. Reword to say it is a delivery constraint, per `brand-guidelines.md` section 4.5. |
| Eight files in `nabl-emails/` | `<!-- LIME TOP BORDER -->` and `<!-- CTA BUTTON (lime) -->` | Comments only. `email-welcome`, `email-proposal`, `email-update` and `email-meeting`, in both `.html` and `.eml`. |
| `src/lib/welcomeDoc.js` | Print stylesheet sets link colour to `#8F5A0E` | A fourth amber that is not in the palette. It measures 5.77:1 on white, so it is not a contrast failure, but it is an undocumented colour. The same print block leaves the wordmark dot and the goal bullets at `#E9AC57` on a white ground. |

`src/styles/tokens.css` also contains the comment "Accent: warm amber (replaces
electric lime)". That one is fine. It records why the palette is what it is, and
it names the old colour only to say it is gone.

None of these change what a client sees today. All of them will mislead the next
person who reads the file, which is how an old identity comes back.
