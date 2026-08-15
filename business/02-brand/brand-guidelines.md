# n.abl brand guidelines

Last substantive revision: 2026-08-15.

This document replaces the previous brand guidelines completely. The old pack
described a lime-and-black identity, with the wordmark described as being set in
a heavy black sans-serif. Nothing in it survives except the square full stop, and
that has changed colour.

If another document, template or comment still describes the old identity, it is
out of date and this file wins. The known survivors are listed in
[`asset-inventory.md`](asset-inventory.md).

---

## 1. What the identity has to carry

n.abl is a technology implementation partner for small businesses. It finds the
expensive, repetitive or fragile part of a business and builds the most
appropriate fix. AI is one tool among several. If the best answer is not AI, AI
is not forced into it.

The identity has to look like that: warm rather than cold, precise rather than
loud, built rather than styled.

So the ground is a warm espresso, never a flat corporate black. The light is a
cream, not a white. There is one accent colour, an amber, used sparingly. The
logo is drawn from circles and straight lines, which is why it reads as an object
someone made rather than a font someone chose. There are no gradients and no
second accent, because a business whose whole claim is that it does not force the
wrong tool into a problem should not decorate a page with elements that are not
doing any work.

---

## 2. The logo

### 2.1 It is drawn artwork

**The wordmark is drawn. It is not set in a typeface, and it must never be
described as being set in one.**

This is not pedantry. It used to be text in the display face with a square
`<span>` for the dot, and the two halves disagreed. A typeface's lowercase `n`
has a squarer, slightly tapered shoulder, and that shoulder competed with the
square dot instead of contrasting with it. Redrawing the `n` with a true
semicircular shoulder is what makes the dot read as a deliberate signature rather
than a stray glyph.

The practical consequences of it being artwork:

- It needs no font to be installed, loaded or licensed at the point of use.
- It is identical in the nav, the favicon, the social card, an email and a deck,
  because every one of them renders the same paths.
- It stays crisp at any size.
- Nobody can "recreate" it by typing the name and picking a weight.

### 2.2 Construction

One construction throughout: **a 13-unit monoline stroke, butt caps, and every
curve a true circle.**

Because the caps are butt rather than round, a stroke endpoint *is* the outer
edge. Stems and bowls therefore land on exactly the same baseline and x-height
with no optical correction required.

The wordmark master is `public/brand/wordmark.svg`, `viewBox="0 0 273 100"`.

| Quantity | Value |
|---|---|
| Stroke width | 13 units |
| Cap style | butt |
| Baseline | y = 82 |
| x-height | y = 21.5 to 82 |
| Ascender top | y = 6 |
| Curve construction | true circles only, no ellipses, no bezier corrections |

The five drawn elements, plus the dot:

| Element | Geometry |
|---|---|
| `n` | Left stem at x = 24.5 rising from y = 82 to y = 48, a semicircular shoulder of radius 20, then a right stem at x = 64.5 back down to y = 82. Drawn as one continuous path so the weight stays optically even. |
| `a` | A circular bowl, centre (128.25, 51.75), radius 23.75, with a full x-height stem at x = 152 tangent to its right. |
| `b` | An ascender stem at x = 178 from y = 6 to y = 82, with the same circular bowl, centre (201.75, 51.75), radius 23.75, tangent to its right. |
| `l` | A single stem at x = 248.5 from y = 6 to y = 82. |
| The dot | A 13 × 13 square at x = 78, y = 69, sitting on the baseline. Filled with the accent, not the stroke colour. |

The bowls are radius 23.75 with a 13-unit stroke, so each one spans y = 21.5 to
82 at its outer edge. That is the x-height exactly, which is why the `a` and `b`
sit level with the `n` without being nudged.

The short mark, `public/brand/mark.svg`, `viewBox="0 0 104 100"`, is the `n` and
the dot only, on the same geometry.

### 2.3 Optical spacing

Spacing is optical, not uniform. The measured gaps between **outer edges** are:

| Gap | Units | What is facing what |
|---|---|---|
| `n` → dot | **7** | stem \| square |
| dot → `a` | **7** | square \| bowl |
| `a` → `b` | **13** | stem \| stem |
| `b` → `l` | **10** | bowl \| stem |

**7 / 7 / 13 / 10.** Two things are load-bearing here.

The two 7s match deliberately. Equal gaps on both sides of the dot make it belong
to the whole word, rather than reading as punctuation attached only to the `n`.

The `a`/`b` gap is the widest, and that is not a mistake. Two flat verticals
facing each other read tighter than a curve facing a vertical, because a curve
recedes from the eye at its extreme. Setting both pairs to the same number makes
the straight pair look cramped, which is exactly what an equal 10 / 10 did before
it was corrected.

### 2.4 Colour of the logo

The strokes take `currentColor`. The dot takes the accent, exposed in the master
as `var(--mark-accent, #E9AC57)`.

| Ground | Strokes | Dot |
|---|---|---|
| Espresso `#0E0C0A` or any dark surface | Cream `#FBF6EC` | Amber `#E9AC57` |
| White, cream card, printed page | Ink `#14110E` or espresso `#0E0C0A` | **Deep amber `#B87718`** |
| Single-colour reproduction | One colour throughout, including the dot | as strokes |

The light-ground row is the one people get wrong. See section 3.2.

One caveat worth knowing: CSS custom properties do not apply to an SVG loaded
through an `<img>` tag, so `<img src="/brand/wordmark.svg">` on a light page will
render the `#E9AC57` fallback and the dot will be too pale. Inline the SVG, or
use a light-ground export.

### 2.5 Clear space

**Clear space is one dot on every side.** The square full stop is 13 × 13 units,
which is exactly one stroke unit square, so it is a measure that is always
available and never needs a ruler.

Nothing enters that space. Not text, not a rule, not an image, not the edge of a
card or a page.

| Measure | Wordmark | Mark |
|---|---|---|
| Minimum clear space | 13 units on all sides of the ink | 13 units |
| Preferred | 26 units, two dots | 26 units |
| As a fraction of rendered width | ≈ 5% minimum, 10% preferred | ≈ 12.5% minimum |

The wordmark's ink occupies x = 18 to 255 and y = 6 to 82 inside a 273 × 100
viewBox. So the master already carries 18 units of margin at the left, right and
bottom, which is about 1.4 dots, but only 6 units above, which is about half a
dot. **The top is the side that needs padding added.** Laying the element out
flush and assuming the viewBox has done the work will crowd the ascenders.

### 2.6 Minimum sizes

The binding constraint is not the stroke, it is the 7-unit gap either side of the
dot. Below a certain size the dot merges with the `n` and the identity turns into
a smudge. In a wordmark rendered *W* wide, that gap measures 7W/273.

| Asset | Minimum | Recommended floor |
|---|---|---|
| Wordmark, screen | 80 px wide | 120 px wide |
| Wordmark, print | 16 mm wide | 25 mm wide |
| Mark, screen | 32 px wide | 48 px wide |
| Mark, print | 6 mm wide | 10 mm wide |
| Favicon | use `public/favicon.svg` | the only asset drawn to survive at 16 px |

These floors are derived from the artwork's geometry, on the rule that the 7-unit
gap should render at 2 px or more on screen and 0.4 mm or more in print. **They
have not been verified against a physical print proof.** Do that before the first
printed job.

Below 32 px, do not shrink the mark. Use `favicon.svg`, which insets the mark in
a rounded tile at `translate(2 3) scale(0.86)` and is drawn for that size.

### 2.7 Misuse

Numbered so they can be cited in a review.

1. Do not describe the wordmark as "set in" any typeface. Not in a deck, not in a
   README, not in conversation with a client.
2. Do not retype the name in Space Grotesk and call it the logo. Space Grotesk is
   the display face for headings. It is not the wordmark.
3. Do not change the 7 / 7 / 13 / 10 spacing, and specifically do not "fix" the
   `a`/`b` gap to match the others.
4. Do not change the stroke weight, or apply a stroke to the artwork on top of
   its existing one.
5. Do not switch the caps from butt to round. Round caps overshoot the baseline
   and the x-height, and the whole construction stops lining up.
6. Do not replace the true circles with ellipses, or condense or extend the
   artwork. Scale proportionally or not at all.
7. Do not remove the dot, and do not turn it into a circle, a diamond or a
   full stop.
8. Do not recolour the dot to anything other than the accent for the ground it is
   on, or leave it at `#E9AC57` on a light ground.
9. Do not put the amber dot on an amber or near-amber background.
10. Do not add a gradient, a bevel, an outline, a drop shadow used as decoration,
    or a second accent colour. The soft amber bloom on the dot in the nav and on
    the social card is the one permitted glow, and it is low opacity.
11. Do not place the wordmark on a busy photograph. If there is no flat area, put
    it on an espresso or cream panel.
12. Do not rotate it, arc it, or set it vertically.
13. Do not enclose it in a box, a circle or a badge, other than the favicon tile
    that already exists.
14. Do not add a strapline, a registered mark or a tagline inside the clear space.
15. Do not reintroduce lime `#B8FF00`, pure black `#0A0A0A`, Arial Black or
    Archivo Black anywhere near it.

---

## 3. Colour

### 3.1 The palette

These values are the same ones in `src/styles/tokens.css`. That file is the
implementation; this table is the specification. If they ever disagree, one of
them is a bug.

Contrast figures are measured against the page ground `#0E0C0A` unless stated.

| Token | CSS variable | Hex | Use | On ground |
|---|---|---|---|---|
| Ground | `--bg` | `#0E0C0A` | Page ground. Warm espresso, never flat corporate black. | — |
| Ground alt | `--bg-alt` | `#13100E` | Alternating band | — |
| Surface 1 | `--surface-1` | `#1A1613` | Cards, panels | — |
| Surface 2 | `--surface-2` | `#221D18` | Raised, hover | — |
| Surface 3 | `--surface-3` | `#2B241E` | Inputs, active | — |
| Surface 4 | `--surface-4` | `#362D25` | Strongest raise | — |
| Cream 100 | `--cream-100` | `#FBF6EC` | Headings on dark | 18.12:1 |
| Cream 200 | `--cream-200` | `#F0E7D8` | Body text on dark | 15.92:1 |
| Cream 300 | `--cream-300` | `#DED2C0` | — | 13.10:1 |
| Cream 400 | `--cream-400` | `#C8BBA8` | Secondary text | 10.35:1 |
| Cream 600 | `--cream-600` | `#9A8F80` | Tertiary and muted text | 6.15:1 |
| Cream 800 | `--cream-800` | `#5A5249` | Disabled only | 2.55:1 |
| Amber 200 | `--accent-200` | `#F8D9A4` | Lightest accent tint | — |
| Amber 300 | `--accent-300` | `#F2C57E` | Accent on dark, light variant | 12.14:1 |
| Amber 400 | `--accent-400` | `#E9AC57` | **The accent.** The dot, links, emphasis on dark. | 9.76:1 |
| Amber 500 | `--accent-500` | `#D9922F` | Mid step, fills | — |
| Amber 600 | `--accent-600` | `#B87718` | **Accent on light grounds** | 5.29:1 |
| Ink | — | `#14110E` | Body text on cream or white | 18.81:1 on white |
| Danger | `--danger` | `#E0796D` | Errors on dark | 6.62:1 |
| Danger deep | `--danger-deep` | `#8E3128` | Fill behind cream text | — |
| Success | `--success` | `#9DBE97` | Success on dark | 9.53:1 |

Hairlines are cream at low alpha rather than a grey: `--line-faint` at 0.06,
`--line` at 0.11, `--line-strong` at 0.20. Glows are cream or amber at 0.05 to
0.20 opacity. They are a bloom, not a neon tube.

**Cream 800 `#5A5249` is 2.55:1 and fails everything.** It is for disabled
controls only. It must never carry meaningful text.

### 3.2 The deep-amber light-ground rule

**On any light ground, the accent is deep amber `#B87718`. Never `#E9AC57`.**

This is the rule most likely to be broken by someone reusing a dark-mode
component on a printed page or a cream email card. The measurements:

| Foreground | Ground | Ratio | Verdict |
|---|---|---|---|
| `#E9AC57` | near-white `#FDFDFD` | **1.97:1** | Fails everything |
| `#E9AC57` | pure white `#FFFFFF` | 2.00:1 | Fails everything |
| `#E9AC57` | cream card `#F7F2E8` | 1.79:1 | Fails everything |
| `#B87718` | pure white `#FFFFFF` | 3.69:1 | Passes 3:1 |
| `#B87718` | cream card `#F7F2E8` | 3.31:1 | Passes 3:1 |

And the honest limit of the rule, which matters just as much:

**Deep amber on a light ground passes 3:1, not 4.5:1.** So it is fine for large
text (24 px, or 18.66 px bold and above), for icons, rules, bullets and other
non-text elements, and for the logo dot. It is **not** fine for body copy. Small
text on a light ground is ink `#14110E`, which is 18.81:1 on white and 16.86:1 on
a cream card, and there is no reason to use anything else.

Two more measured pairs worth carrying:

- Cream `#FBF6EC` on a deep amber `#B87718` fill is 3.43:1. Large text only.
- Ink `#14110E` on an amber `#E9AC57` fill is 9.76:1. **This is the right way to
  build a filled accent button on a light ground:** amber fill, ink text.

### 3.3 How the accent is used

One accent, used sparingly. If the amber is everywhere it stops meaning
anything.

Legitimate uses: the square dot, one call to action per view, a live or active
state, an eyebrow label, a small bullet, a link.

Not legitimate: large filled areas of amber on dark, amber body copy, amber as a
second brand colour, two different ambers in the same component.

### 3.4 Contrast rules, stated plainly

- Body text on dark: cream 200 `#F0E7D8`. Headings: cream 100 `#FBF6EC`.
- The lightest colour permitted for meaningful text is cream 600 `#9A8F80`, which
  is 6.15:1 on the ground and 5.66:1 on surface 1. Check it against the surface
  it will actually sit on, not the page ground.
- Anything below 4.5:1 is not text. Anything below 3:1 is not a UI element
  either.
- Never rely on colour alone to carry meaning. State, errors and status need a
  word or an icon as well.
- Measure, do not assume. `npm run test:emails` renders each email template in a
  real browser and reads the resolved colours off the DOM, walking up for the
  first opaque ancestor background. That is the only reliable way to audit a
  nested table layout, and the same discipline applies anywhere else.

---

## 4. Typography

### 4.1 The stack

Three families, defined in `src/styles/tokens.css`:

| Role | Token | Stack |
|---|---|---|
| Display | `--font-display` | `'Space Grotesk', 'Inter Tight', system-ui, sans-serif` |
| UI and body | `--font-sans` | `'Inter Tight', system-ui, -apple-system, sans-serif` |
| Keys and figures | `--font-mono` | `'JetBrains Mono', ui-monospace, 'SF Mono', monospace` |

Space Grotesk sets headlines and display copy. Inter Tight sets everything else:
body, navigation, forms, tables. JetBrains Mono is for things that are read
character by character rather than as words, which in practice means portal
access keys, identifiers, code and figures in a table where the digits should
line up.

Do not add a fourth family. Do not use the display face for body copy, and do not
use the mono face for prose.

### 4.2 The weights that actually ship

Only these exist in `public/fonts/`. Asking for a weight not on this list gets
you a synthesised approximation, which looks wrong next to the drawn wordmark.

| Family | Weights | Files |
|---|---|---|
| Space Grotesk | 400, 500, 600, 700 | `SpaceGrotesk-latin.woff2`, `SpaceGrotesk-latin-ext.woff2` |
| Inter Tight | 400, 500, 600 | `InterTight-latin.woff2`, `InterTight-latin-ext.woff2` |
| JetBrains Mono | 400, 500 | `JetBrainsMono-latin.woff2`, `JetBrainsMono-latin-ext.woff2` |

Each file is a **variable font**, so one file serves every weight in its range.
That is why several `@font-face` blocks in `fonts.css` legitimately share a `src`
and differ only in the declared weight. Eighteen blocks, six files.

There are no italics. There is no bold above 700. If a design needs one, it is
the design that changes.

### 4.3 Scale and tracking

The scale is fluid, defined once as tokens:

| Token | Value |
|---|---|
| `--t-xs` | `0.75rem` |
| `--t-sm` | `0.875rem` |
| `--t-base` | `1rem` |
| `--t-lg` | `1.125rem` |
| `--t-xl` | `clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)` |
| `--t-2xl` | `clamp(1.6rem, 1.3rem + 1.4vw, 2.25rem)` |
| `--t-3xl` | `clamp(2.1rem, 1.6rem + 2.4vw, 3.25rem)` |
| `--t-4xl` | `clamp(2.8rem, 1.9rem + 4.2vw, 5rem)` |
| `--t-5xl` | `clamp(3.4rem, 2.0rem + 6.4vw, 7rem)` |

Tracking: `--track-tight` at `-0.03em` for large display headings,
`--track-snug` at `-0.015em` for mid-size headings, `--track-wide` at `0.14em`
for uppercase eyebrow labels. Body copy is untracked.

Use the tokens. A hard-coded `font-size: 42px` is a defect, because it will not
move with the scale and it will not respond on a small screen.

Prose measure is capped at `--maxw-prose`, 68 characters.

### 4.4 Why the fonts are self-hosted

**They are self-hosted, and they are never loaded from a font CDN.**

The reason is not performance, though the performance is better. Requesting a
font from Google Fonts makes every visitor's browser connect to a Google server
on page load, which discloses their IP address, and their user agent, and the
page they were on, to a third party. That is a disclosable transfer under UK data
protection law, it happens before anyone has consented to anything, and it is
entirely avoidable.

The whole set is 214 KB across six files, subset to Latin and Latin Extended.
That is smaller than one unoptimised hero image. There is no trade to make.

Second-order reasons, which matter but are not the point:

- No third-party single point of failure in the critical render path.
- No extra DNS lookup, TLS handshake and cross-origin connection.
- Nothing changes under us when a foundry ships a new version.
- No cookie banner conversation about it.

The mechanics, in `index.html` and `public/fonts/fonts.css`:

- `font-display: swap` on every face, so text is readable while fonts load.
- The two faces used above the fold, `SpaceGrotesk-latin.woff2` and
  `InterTight-latin.woff2`, are preloaded with `crossorigin`.
- Latin and Latin Extended subsets only, split by `unicode-range` so a
  Latin-only page never downloads the extended file.

Anyone proposing to "simplify" this by putting a Google Fonts `<link>` back in
the head is proposing to reintroduce the disclosure. The answer is no.

### 4.5 The email exception

Email clients do not load web fonts reliably. The six templates in
`nabl-emails/` therefore fall back to a stack that names `Arial Black`.

**That is a delivery constraint, not a brand decision, and it does not make Arial
Black a brand typeface.** It is the closest widely installed face to the display
role and it only ever renders in a client that has refused the real one. If you
copy an email template into a web page or a document, replace the stack with the
tokens.

The n.abl wordmark in an email is `public/brand/wordmark-email.png`, a raster of
the drawn artwork. It is not text and it is not a font fallback.

---

## 5. What changed from the old identity

For anyone holding an old file and wondering whether it is current.

| Old, and now wrong | Current |
|---|---|
| Pure black `#0A0A0A` | Warm espresso `#0E0C0A` |
| Electric lime `#B8FF00` | Amber `#E9AC57`, deep amber `#B87718` on light |
| White text | Cream `#F0E7D8` body, `#FBF6EC` headings |
| Arial Black / Archivo Black | Space Grotesk, Inter Tight, JetBrains Mono |
| A wordmark "set in a heavy black sans-serif" | Drawn artwork, 13-unit monoline stroke |
| A lime square dot | The same square dot, in amber |
| Fonts from a CDN | Self-hosted in `public/fonts/` |

The square full stop is the single piece of equity carried across. It replaces
the full stop on key headlines and it sits inside the wordmark. It is amber now,
not lime, but it is still the mark.

If you are hunting for survivors, search for: `B8FF00`, `0A0A0A`, `Archivo`,
`Arial Black`, `lime`, `set in`, `AI automation agency`.
