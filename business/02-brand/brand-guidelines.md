# n.abl brand guidelines

Last substantive revision: 2026-11-25.

This revision changes the typeface and the colour. **The logo does not change.**
The wordmark, the mark, their construction, spacing and clear space are exactly
as they were, and section 2 is carried over unchanged apart from the misuse list.

What changed, in one table. Section 10 has the full history.

| Until 2026-11 | From 2026-11 |
|---|---|
| Space Grotesk headlines, Inter Tight text, JetBrains Mono labels | **Manjari** for everything: Thin 100 headlines, Regular 400 text and labels, Bold 700 emphasis. JetBrains Mono only for keys and codes in the product. |
| One accent, amber. "No gradients and no second accent." | **Three lights on the dark ground: ember, amber and ice.** Gradients run warm to cool. |
| A flat espresso ground with a low cream bloom | **A lit ground.** Soft glows drawn as wisps, with grain, fluted glass and aurora as the scroll moves on. |
| Filled amber buttons | **Frosted glass pills** with the three colours glowing softly inside. |

The working reference for all of it is the scroll-story demo,
[`reference/nabl-scroll-story.html`](reference/nabl-scroll-story.html). It is
the homepage as it will look, in one self-contained file: open it in a browser.
If this document and the demo disagree on a number, this document wins. If they
disagree on how something should feel, look at the demo and fix this document.

If another document, template or comment still describes the old type or the
one-accent rule, it is out of date and this file wins. The known survivors are
listed in [`README.md`](README.md).

---

## 1. What the identity has to carry

n.abl builds AI into the way a small or mid-sized business already works, and
looks after it once it is running. The identity has to look like that: warm
rather than cold, precise rather than loud, built rather than styled.

So the ground is still a warm espresso, never a flat corporate black, and the
light is still cream, never white. What is new is that light now falls on the
ground, and it has three colours that tell the same story every page and every
film tells:

- **Ember** is the problem. The cost, the heat, the job that keeps going wrong.
  The story starts here.
- **Amber** is n.abl. Our hand in the work: the full stop, the link, the focus,
  the thing being built.
- **Ice** is the AI at work. Listening, live, done. The story ends here.

Gradients are allowed because they are that story in one strip: warm to cool,
problem to fix to result. They are light on a dark ground, never decoration on
a light one.

The typeface is Manjari. It is rounded, thin and quiet. Its hairline headlines
read as precise without shouting, and its rounded terminals keep it warm. It
replaces faces that read as engineered and, in the labels, as a typewriter.

---

## 2. The logo

**Unchanged in this revision.** Changing the typeface does not touch the logo,
because the logo was never type.

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
| Espresso `#0E0C0A` or any dark surface, lit or not | Cream `#FBF6EC` | Amber `#E9AC57` |
| White, cream card, printed page | Ink `#14110E` or espresso `#0E0C0A` | **Deep amber `#B87718`** |
| Single-colour reproduction | One colour throughout, including the dot | as strokes |

**The dot is amber in every colourway.** It never takes ember or ice, and the
logo never takes a gradient, even when everything around it does.

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
2. Do not retype the name in Manjari, or in any other face, and call it the logo.
   Manjari is the typeface for everything else. It is not the wordmark.
3. Do not change the 7 / 7 / 13 / 10 spacing, and specifically do not "fix" the
   `a`/`b` gap to match the others.
4. Do not change the stroke weight, or apply a stroke to the artwork on top of
   its existing one.
5. Do not switch the caps from butt to round. Round caps overshoot the baseline
   and the x-height, and the whole construction stops lining up. Manjari's
   rounded terminals are the type's character, not the logo's.
6. Do not replace the true circles with ellipses, or condense or extend the
   artwork. Scale proportionally or not at all.
7. Do not remove the dot, and do not turn it into a circle, a diamond or a
   full stop.
8. Do not recolour the dot to anything other than the accent for the ground it is
   on, or leave it at `#E9AC57` on a light ground. Never ember, never ice.
9. Do not put the amber dot on an amber or ember background, or over the bright
   middle of a warm glow. Place the logo where the ground is dark.
10. Do not fill, stroke or tint the logo artwork with a gradient, and do not add a
    bevel, an outline, a second colour or a drop shadow used as decoration. The
    page around the logo may carry gradients and light; the logo itself does not.
    The soft amber bloom on the dot is the one permitted glow, and it is low
    opacity.
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

**Grounds and creams.** Unchanged.

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
| Cream 300 | `--cream-300` | `#DED2C0` | Ledes, secondary body | 13.10:1 |
| Cream 400 | `--cream-400` | `#C8BBA8` | Secondary text | 10.35:1 |
| Cream 600 | `--cream-600` | `#9A8F80` | Tertiary and muted text | 6.15:1 |
| Cream 800 | `--cream-800` | `#5A5249` | Disabled only | 2.55:1 |
| Ink | — | `#14110E` | Body text on cream or white | 18.81:1 on white |

**The three lights.** Each has a light step for text on dark, a main step, and a
deep step for light grounds. Amber keeps its existing tokens under `--accent-*`.

| Colour | CSS variable | Hex | Use | On ground | On surface 1 | Ink on it |
|---|---|---|---|---|---|---|
| Ember 300 | `--ember-300` | `#FF8F70` | Ember as text on dark: problem labels | 8.75:1 | 8.06:1 | 8.43:1 |
| **Ember 400** | `--ember-400` | `#FF5A36` | **Ember.** Problem markers, the heat in the ground | 6.29:1 | 5.79:1 | 6.06:1 |
| Ember 600 | `--ember-600` | `#C9381A` | Ember on light grounds | 3.78:1 | 3.48:1 | — |
| Amber 200 | `--accent-200` | `#F8D9A4` | Lightest amber tint | — | — | — |
| Amber 300 | `--accent-300` | `#F2C57E` | Amber as text on dark | 12.14:1 | 11.18:1 | 11.70:1 |
| **Amber 400** | `--accent-400` | `#E9AC57` | **The accent.** The dot, links, focus, emphasis on dark | 9.76:1 | 8.99:1 | 9.41:1 |
| Amber 500 | `--accent-500` | `#D9922F` | Mid step, fills | — | — | — |
| Amber 600 | `--accent-600` | `#B87718` | Amber on light grounds | 5.29:1 | 4.87:1 | — |
| Ice 300 | `--ice-300` | `#A9DCFF` | Ice as text on dark: live and result labels | 13.36:1 | 12.30:1 | 12.87:1 |
| **Ice 400** | `--ice-400` | `#7CCBFF` | **Ice.** Live states, the cool light in the ground | 11.01:1 | 10.14:1 | 10.61:1 |
| Ice 600 | `--ice-600` | `#3E8FCC` | Ice on light grounds, large text and marks only | 5.58:1 | 5.14:1 | — |
| Calm mid | `--calm-mid` | `#EFE2C6` | The cream that amber passes through on its way to ice | 15.21:1 | — | — |

RGB channels for building glows at an alpha: `--accent-rgb` is `233, 172, 87`,
`--ember-rgb` is `255, 90, 54`, `--ice-rgb` is `124, 203, 255`, `--cream-rgb` is
`240, 231, 216`.

**Status.** Unchanged.

| Token | CSS variable | Hex | Use | On ground |
|---|---|---|---|---|
| Danger | `--danger` | `#E0796D` | Errors on dark | 6.62:1 |
| Danger deep | `--danger-deep` | `#8E3128` | Fill behind cream text | — |
| Success | `--success` | `#9DBE97` | Success on dark | 9.53:1 |

Hairlines are cream at low alpha rather than a grey: `--line-faint` at 0.06,
`--line` at 0.11, `--line-strong` at 0.20.

**Cream 800 `#5A5249` is 2.55:1 and fails everything.** It is for disabled
controls only. It must never carry meaningful text.

### 3.2 What each colour means

The three colours carry meaning, so they are used for that meaning and nothing
else.

| Colour | Means | Where it appears |
|---|---|---|
| Ember | The problem: the cost, the heat, what needs attention | Problem bullets and labels, the "problem" row of a case, the heat that builds in the ground while the page describes what goes wrong |
| Amber | n.abl: the full stop, our hand in the work | The logo dot, the square full stop on headlines, links, the focus ring, the active step, the "fix" row of a case, the one call to action per view |
| Ice | The AI at work: listening, live, done | Live indicators (a round, softly pulsing dot), the "result" row of a case, the cool light in the ground as each fix starts running |

In a case study the rows are always **problem, fix, result**, in **ember, amber,
ice**, in that order.

Shape follows meaning too. n.abl's markers and problem markers are small squares,
after the full stop. The live marker for AI at work is the one round dot.

### 3.3 Light grounds

The colourway is built for dark grounds, where the three colours are light. On a
light ground (a printed page, a cream email card, a white document) they become
ink, and only the deep steps are used.

| Foreground | Ground | Ratio | Verdict |
|---|---|---|---|
| Amber `#E9AC57` | white `#FFFFFF` | 2.00:1 | Fails everything |
| Amber `#E9AC57` | cream card `#F7F2E8` | 1.79:1 | Fails everything |
| **Deep amber `#B87718`** | white | 3.69:1 | Large text, marks and the logo dot only |
| **Deep amber `#B87718`** | cream card | 3.31:1 | Large text, marks and the logo dot only |
| Ember `#FF5A36` | white | 3.10:1 | Do not use. Large text only, and the deep step is better |
| **Deep ember `#C9381A`** | white | 5.17:1 | Passes for text |
| **Deep ember `#C9381A`** | cream card | 4.63:1 | Passes for text |
| Ice `#7CCBFF` | white | 1.77:1 | Fails everything |
| **Deep ice `#3E8FCC`** | white | 3.50:1 | Large text and marks only |
| **Deep ice `#3E8FCC`** | cream card | 3.13:1 | Large text and marks only |

So, on a light ground:

- Body text is ink `#14110E`. Always.
- The logo dot is deep amber `#B87718`.
- Ember, amber and ice appear as marks, rules, bullets and large text, in their
  deep steps.
- Gradients do not appear on light grounds. If a printed piece needs the light,
  print an espresso panel and put the light on that.

Two measured pairs worth carrying:

- Ink `#14110E` on an amber `#E9AC57` fill is 9.76:1. That is the right way to
  build a filled button on a light ground: amber fill, ink text.
- Cream `#FBF6EC` on a deep amber `#B87718` fill is 3.43:1. Large text only.

### 3.4 How much of each

**Dark does most of the work.** The colours are light falling on a dark ground,
not paint. Measured on the reference demo's background with the page content
hidden, across eleven points in the scroll:

| Measure | Value |
|---|---|
| Share of the frame that stays dark (luminance under 0.02, roughly espresso to surface 3) | **about two thirds**: 52% in the opening, 76% at the quietest points, 65% on average |
| Warm light, ember to amber | **about 60 / 40**. Ember leads and turns into amber; they are one warm scale, not two separate colours |
| Ice, as a share of all the colour | **about one part in seven** on average. Low while the problem is described, rising to most of the light as the third fix runs, then receding |

What that rules out:

- **No frame is one colour.** A screen that is all orange, or two thirds orange
  and one third blue with a dark sliver, is wrong. The colours sit in separate
  pools with dark between them.
- **No large flat areas of any of the three.** Not a filled amber panel, not an
  ember banner, not an ice section background.
- **No body copy in any of the three.** Labels and short markers only.
- **Text never sits on the bright middle of a glow.** The ground keeps a dark
  field behind the copy (see 4.3).

### 3.5 Gradients

Gradients run **warm to cool, the way the story goes**: left to right, or bottom
to top. There are three, and they are tokens:

| Name | Token | Stops | Use |
|---|---|---|---|
| Heat | `--grad-heat` | ember → amber | Problem moments: the eyebrow over the problem chapter |
| Calm | `--grad-calm` | amber → cream `#EFE2C6` at 48% → ice | Eyebrows and labels for the fix and its results |
| Trio | `--grad-trio` | ember → amber at 42% → cream at 68% → ice | The whole journey: scroll progress lines, the border of one featured card |

Amber to ice passes through cream, the brand's own light, so the middle of the
gradient never goes grey or green.

Where gradients are used:

- **As light in the ground.** Soft glows, never hard bands. See section 4.
- **As a thin line.** Scroll progress and the journey rail, 1 to 2 px.
- **As a border.** One featured card per view, 1 px.
- **As small text.** Eyebrow labels, clipped to the letters.

Where they are not: on the logo, behind body text, as a button outline, on light
grounds, reversed (cool to warm), or as a rainbow with any other colour in it.

### 3.6 Contrast rules, stated plainly

- Body text on dark: cream 200 `#F0E7D8`. Headings: cream 100 `#FBF6EC`.
- The lightest colour permitted for meaningful text is cream 600 `#9A8F80`, which
  is 6.15:1 on the ground and 5.66:1 on surface 1. Check it against the surface
  it will actually sit on, not the page ground. On the lit ground, check it
  against the brightest point of the light behind it.
- Anything below 4.5:1 is not text. Anything below 3:1 is not a UI element
  either.
- Never rely on colour alone to carry meaning. State, errors and status need a
  word or an icon as well. **Errors keep their own red, `--danger`.** Ember never
  signals an error, and because an error always carries words and an icon, the
  two never have to be told apart by colour.
- Measure, do not assume. `npm run test:emails` renders each email template in a
  real browser and reads the resolved colours off the DOM, walking up for the
  first opaque ancestor background. The same discipline applies anywhere else.

---

## 4. Light and texture

### 4.1 The ground is lit

Behind every page there is one fixed background: the espresso ground with soft
light on it. On the website it is a single WebGL canvas; in a film it is the same
drawing rendered per frame. It is made of five things, from the bottom up:

| Layer | What it is | Notes |
|---|---|---|
| Ground | Espresso `#0E0C0A` | Always visible somewhere in the frame |
| Glows | Eight soft pools of light: three ember, two amber, three ice | Each keeps its colour. Every point in the scroll gives each one a place, a size and a strength, and they travel between those places |
| Wisps | The glows are drawn through twice-warped noise, so the light reads as smoke or silk rather than as round blobs | This is the "grain gradient" texture. It is the default |
| Fluted glass | Vertical reeds that refract the light behind them | Comes in when the fix appears. Reed widths step between 6, 26, 46, 96 and 150 px and cross-fade between neighbours, so the edges never jitter while they widen |
| Aurora | Soft vertical curtains of light, with an ember band at the base | Comes in as the work settles into running, and carries the closing chapters |

Over all of it sits a **grain**: fractal noise at 0.14 opacity, blended as
overlay. It keeps the gradients from banding and gives the dark some tooth.

### 4.2 The three textures

The three backgrounds chosen from the drafts are the same ground in three states:

| Texture | Feels like | Used for |
|---|---|---|
| **Grain gradient** | Warm smoke in a dark room | The opening, and wherever the page is talking rather than showing |
| **Fluted glass** | Looking at the light through a reeded pane | The fix: when the page shows the work being done |
| **Aurora** | Light settling, slow curtains | The work running: how we work, the cases, the close |

### 4.3 Text on the lit ground

- **Copy sits on a dark field.** A fixed vignette on the side where the copy sits
  keeps that area dark, and the glow layouts put colour above, below and beside
  the copy rather than behind it.
- Cards and panels over the light are glass: espresso at 0.62 to 0.70 alpha with
  a 10 px backdrop blur and a cream hairline. That holds text contrast whatever
  the light does behind it.
- Check contrast against the brightest light that can pass behind the text, not
  against the ground.

---

## 5. Typography

### 5.1 The family

**Manjari**, from Swathanthra Malayalam Computing, released under the SIL Open
Font License 1.1. Version 2.000, self-hosted from Google Fonts' v14 files.

One family does everything:

| Role | Weight | Setting |
|---|---|---|
| Display: headlines, big numbers, the contact line | **Thin 100** | Line height 1.0 to 1.02. Tracking −0.006em, word spacing −0.08em. Cream 100. Balanced wrapping. |
| Text: body, ledes, navigation, forms | **Regular 400** | 16.5 px, line height 1.6. Tracking +0.006em, word spacing −0.025em. Cream 200, ledes cream 300. |
| Labels and eyebrows | **Regular 400** | Capitals, about 0.72 rem (11.5 px), tracking +0.08em, word spacing normal. Cream 400, or a gradient clipped to the letters. |
| Card and step titles | **Regular 400** | About 1.3 to 1.65 rem, word spacing −0.04em. Cream 100. |
| Emphasis and the main button's label | **Bold 700** | The main button's label is cream 100, Bold, 15 px. |

There is no italic. There is no weight between 100 and 400 or between 400 and
700. Asking for 300, 500 or 600 gets a synthesised or substituted weight, which
looks wrong next to the drawn wordmark.

**JetBrains Mono stays for one job only:** keys and codes in the product, such as
portal access keys and identifiers, where every character must be read on its
own. It is never used for labels, eyebrows, numbers in prose or anything in
marketing. Space Grotesk and Inter Tight retire when the website moves to
Manjari.

### 5.2 Scale

From the reference demo, as fluid sizes:

| Role | Size |
|---|---|
| Hero and closing line | `clamp(3rem, 1.4rem + 6.4vw, 7.6rem)` |
| Section headline | `clamp(2.4rem, 1.4rem + 3.4vw, 4.6rem)` |
| Step headline | `clamp(3rem, 1.6rem + 5vw, 6.6rem)` |
| Card title | `clamp(1.3rem, 1.1rem + .7vw, 1.65rem)` |
| Lede | `clamp(1.06rem, 1rem + .3vw, 1.22rem)` |
| Body | 16.5 px |
| Small print and notes | 13.5 to 14.5 px |

Thin type needs size to hold up. **Do not set Thin 100 below about 32 px.**
Below that, use Regular.

Prose measure is capped at about 50 characters for ledes and 68 for body text.

### 5.3 The square full stop

Key headlines end with the amber square instead of a full stop: 0.2 em square,
0.06 em from the last letter, sitting on the baseline, with a soft amber bloom
(`box-shadow: 0 0 .35em` at 0.55 alpha). It is the one piece of the logo that
appears in type, and it is always amber.

### 5.4 Metrics and centring

Manjari's three weights ship with different vertical metrics (on a 2048-unit em:
Thin 1400 / −800, Regular 1500 / −750, Bold 1500 / −900). `fonts.css` overrides
all three to **ascent 85.5%, descent 26.5%, line gap 0**. That puts the weights on
one baseline grid and puts the optical middle of mixed-case text in the middle of
its line box.

Safari ignores those overrides. So anything that centres a label in a shape, such
as buttons and chips, also trims the label's box to the capital height and the
baseline:

```css
.btn > .lbl, .chip > .lbl { display: block; text-box: trim-both cap alphabetic; padding-bottom: .09em; }
@supports not (text-box: trim-both cap alphabetic) { .btn > .lbl, .chip > .lbl { padding-bottom: 0; } }
```

Measured in the demo, labels centre to within a pixel with and without the
overrides. That covers Safari 18.2 and later and current Chrome.

### 5.5 Glyphs Manjari does not have

No arrows (`→ ← ↗`) and no ticks (`✓ ✔`). Draw them as SVG icons. Typing them
lets a system font fill the gap in a different weight and style. Manjari does
have tabular figures (`font-variant-numeric: tabular-nums`), the pound and euro
signs, curly quotes, en and em dashes and the ellipsis.

### 5.6 Why the fonts are self-hosted

**They are self-hosted, and they are never loaded from a font CDN.**

The reason is not performance, though the performance is better. Requesting a
font from Google Fonts makes every visitor's browser connect to a Google server
on page load, which discloses their IP address, and their user agent, and the
page they were on, to a third party. That is a disclosable transfer under UK data
protection law, it happens before anyone has consented to anything, and it is
entirely avoidable.

Manjari's Latin files for all three weights come to 37,340 bytes, about 36 KB.
With Latin Extended, all six files total 78,604 bytes. The fonts they replace
(Space Grotesk and Inter Tight) came to about 172 KB.

The mechanics, in `public/fonts/fonts.css`:

- `font-display: swap` on every face, so text is readable while fonts load.
- Latin and Latin Extended subsets only, split by `unicode-range` so a Latin-only
  page never downloads the extended files.
- The faces used above the fold are preloaded with `crossorigin` in `index.html`.
- Each family's licence sits beside its files, and `public/fonts/README.md`
  records where every file came from.

Anyone proposing to "simplify" this by putting a Google Fonts `<link>` back in
the head is proposing to reintroduce the disclosure. The answer is no.

### 5.7 The email exception

Email clients do not load web fonts reliably. The six templates in
`nabl-emails/` fall back to installed fonts.

**That is a delivery constraint, not a brand decision.** The templates still name
a heavy fallback (`Arial Black`) from the previous type. With Manjari, the nearest
widely installed equivalent is a light weight of the system sans: Helvetica Neue
Light on Apple devices, Segoe UI Light on Windows, then Arial. Moving the
email stack over is listed in `README.md`.

The n.abl wordmark in an email is `public/brand/wordmark-email.png`, a raster of
the drawn artwork. It is not text and it is not a font fallback.

---

## 6. Components

### 6.1 The main button

**Frosted glass with light inside it.** The colour lives in the material, low and
soft under the label, rather than in an outline or a fill.

| Part | Setting |
|---|---|
| Shape | Fully rounded pill, minimum height 50 px, padding 0 1.55 rem |
| Label | Cream 100, Manjari Bold 700, 15 px, centred as in 5.4 |
| Glass | Cream from 0.10 at the top to 0.035 at the bottom, `backdrop-filter: blur(18px) saturate(140%)`, a cream hairline at 0.16, a 1 px inner highlight at the top |
| Light inside | Three soft radial glows rising from below the label: ember on the left, amber in the middle, ice on the right, blurred 12 px, at 0.58 opacity |
| Hover | The light rises and strengthens to 0.85, the hairline to 0.30, and a 90 px spot of white light at 0.14 follows the pointer across the glass |
| Press | Moves down 1 px |

No gradient outline. No solid fill. No ember-only or ice-only version.

### 6.2 The second button

Clear glass: cream at 0.035, a cream hairline at 0.14, `blur(12px)`, the label in
cream 100 at Regular 400. Hover lifts the hairline to 0.30.

### 6.3 Chips

A 34 px pill, cream hairline at 0.18, espresso at 0.55 alpha, 14 px Regular
label, with a 6 px amber square before it. A **live** chip, for AI at work, has
an ice hairline at 0.45, ice 300 text, and a round ice dot that pulses slowly
(opacity to 0.35 and back over 1.6 s).

### 6.4 Cards and panels

Radius 18 px. Espresso glass at 0.62 alpha with a 10 px backdrop blur, a cream
hairline at 0.11 (0.18 on hover), and a 2 px lift on hover. One card per view may
be featured with a 1 px trio gradient border. Markers in cards are 7 px amber
squares with a soft bloom.

### 6.5 Lines and progress

Hairlines are cream at low alpha. Progress through a pinned chapter, and the
journey rail beside the page, fill with the trio gradient, warm at the start of
the page and cool at the end.

---

## 7. Motion

### 7.1 The scroll tells the story

The page is one story told in order, and the ground tells it with the words:

| Chapter | What the words say | What the ground does |
|---|---|---|
| The opening | AI, built into your business | Grain gradient. Wisps drift slowly; all three colours are present, with dark kept behind the copy |
| See it work: the problem | Where the time goes | Heat builds: ember strengthens and moves in while the problems appear |
| See it work: the fix | The three fixes, one at a time | The fluted glass materialises in place, fine reeds first. Each fix holds its own layout while its words are on screen; ice appears as each one starts running |
| What we do | The six jobs | Glass, calmer |
| How we work | The five steps | The reeds widen step by step while the glass fades and the aurora rises |
| Cases | Problem, fix, result | Aurora, settled |
| Pricing and contact | The offer, then the conversation | The aurora sinks back to a quiet grain gradient |

### 7.2 Pace

- **Nothing snaps.** The ground eases toward where the scroll says it should be,
  every frame. Scrolling back reverses the story.
- **The ground keeps moving on its own**, slowly, so a still page is never dead.
  Scrolling moves the light on further: noticeably, never dramatically.
- **The pointer leans the light.** The glows lean slightly towards the pointer
  and brighten a little near it. It is felt rather than seen.
- **On touch screens the response is gentler**, so a fast flick never makes the
  glass or the light lurch.
- Interface motion uses the house easing, `cubic-bezier(0.22, 1, 0.36, 1)`.

### 7.3 Reduced motion and fallbacks

- With `prefers-reduced-motion`, the ground holds still apart from changing with
  the scroll, pinned chapters become ordinary sections, and interface
  transitions are instant.
- Where WebGL is unavailable, the ground is a still image of the opening layout
  in CSS gradients, so the page is never flat black.
- The ground lowers its own resolution if a device cannot hold about 45 frames a
  second, and raises it again when it can.

---

## 8. Film and video

The films and reels use the same system as the site:

- **Type:** Manjari, as section 5. Thin for statements, Regular for supporting
  lines and labels. The fonts are in `public/fonts/`.
- **Ground:** espresso with the lit ground of section 4. The shader in the
  reference demo can be lifted as it is: render it per frame and drive its state
  from the timeline instead of the scroll.
- **Colour:** the three colours keep their meaning. A film about a problem
  starts warm; the AI at work is ice; the full stop and n.abl's hand are amber.
  Dark stays the majority of every frame (section 3.4).
- **The logo** is the drawn artwork, cream with the amber dot, on a dark part of
  the frame. It never takes a gradient.

The existing foundations in [`intro-reel.md`](intro-reel.md) (tempo, safe zones,
checks) still apply. Its type and its "no gradient, no second accent" rule are
replaced by this document.

---

## 9. The reference demo

[`reference/nabl-scroll-story.html`](reference/nabl-scroll-story.html) is the
homepage, in its real chapter order, as a scroll story in the new type and
colourway. It is one self-contained file with the fonts inlined: open it in any
current browser. [`reference/README.md`](reference/README.md) explains what is in
it and which parts to lift.

---

## 10. History

### 10.1 What changed in 2026-11

| August 2026, and now wrong | Current |
|---|---|
| Space Grotesk headlines, Inter Tight body | Manjari: Thin 100, Regular 400, Bold 700 |
| JetBrains Mono labels and eyebrows | Manjari Regular in capitals, tracked +0.08em. Mono only for keys and codes in the product |
| One accent; no gradients; no second accent | Ember, amber, ice; three gradients, warm to cool |
| Flat espresso ground with a low cream bloom | Lit ground: wisps, grain, fluted glass, aurora |
| Filled amber call to action | Frosted glass pill with the three colours inside |
| `--track-tight` −0.03em display tracking | −0.006em with word spacing −0.08em, for Manjari |

Unchanged: the logo, its colours and rules; espresso and the creams; amber and
deep amber; the deep-amber light-ground rule; the square full stop; the
self-hosting rule.

### 10.2 What changed in 2026-08, from the original identity

| Old, and now wrong | Current |
|---|---|
| Pure black `#0A0A0A` | Warm espresso `#0E0C0A` |
| Electric lime `#B8FF00` | Amber `#E9AC57`, deep amber `#B87718` on light |
| White text | Cream `#F0E7D8` body, `#FBF6EC` headings |
| Arial Black / Archivo Black | Space Grotesk, Inter Tight, JetBrains Mono (themselves replaced in 2026-11) |
| A wordmark "set in a heavy black sans-serif" | Drawn artwork, 13-unit monoline stroke |
| A lime square dot | The same square dot, in amber |
| Fonts from a CDN | Self-hosted in `public/fonts/` |

The square full stop is the single piece of equity carried across both changes.
It replaces the full stop on key headlines and it sits inside the wordmark.

If you are hunting for survivors of the original identity, search for: `B8FF00`,
`0A0A0A`, `Archivo`, `Arial Black`, `lime`, `set in`, `AI automation agency`.
Survivors of the August type: `Space Grotesk`, `Inter Tight`, and `JetBrains
Mono` anywhere other than keys and codes.
