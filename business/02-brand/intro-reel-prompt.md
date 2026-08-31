# Master prompt: build the n.abl introduction reel in After Effects

Hand this whole file to a fresh session that has an After Effects MCP attached.
It is written to be read cold. Everything needed to start is in it.

Two files in this repository are the authority behind it and should be read
before any keyframe is set:

- `business/02-brand/brand-guidelines.md`. Palette with measured contrast, the
  deep-amber light-ground rule, type, the logo's construction, misuse.
- `business/02-brand/intro-reel.md`. The tempo grid, the safe zones, the
  acceptance checks. Its **film concept is superseded by this file**. Its
  measurement protocol, palette, type, layout and checks all still stand.

Written 2026-08-31.

---

## 0. The one-line brief

> A single flowing ribbon travels across one enormous flat map. The camera flies
> with it. It passes the three pillars, then the six things we build, then the
> place we work from, and at the end it whips into the wordmark and asks a
> question.

Fast, continuous, no cuts. The ribbon is the only thing that draws, and the
camera is the only thing that moves.

---

## 1. Non-negotiables

Break any of these and the film is off brand, however good it looks.

1. **The ribbon is a 13-unit monoline with butt caps.** Not round caps. Not a
   tapered stroke. Not a gradient along its length.
2. **Every curve in the film is a true circle.** The ribbon flows freely, but it
   flows as a chain of circular arcs joined tangentially. No freehand beziers, no
   S-curves that are not two arcs, no ellipses. This is the logo's own
   construction rule promoted to a flight path, and it is what stops the ribbon
   reading as generic motion-graphics pasta.
3. **No gradients, no bevels, no glows, no drop shadows, no second accent
   colour.** One exception, once: a low-opacity amber bloom on the dot landing.
4. **The wordmark is drawn artwork.** It is never set in Space Grotesk. Rebuild
   it from the geometry in section 8, as live shape-layer strokes.
5. **On a light frame the accent is deep amber `#B87718`.** Plain amber
   `#E9AC57` measures 1.79:1 on the cream card and fails outright.
6. **The dot never rotates and never becomes a diamond.** See section 5.3.
7. **British English throughout.** No em dashes in any on-screen copy.

---

## 2. Do this first, before opening After Effects

**The tempo has not been measured.** The track is Magic Clipper by Peter Spacey,
Artlist, and you want the **instrumental**, id `109795`, not the vocal `109797`.
Eighty-five per cent of vertical video is watched muted, the film carries burned
type throughout, and a vocal fights burned type.

1. Find the first downbeat of the first full groove, after the intro. Call it
   `t0`. That is bar 1 beat 1, not the start of the file.
2. Tap 32 beats. Take the mean. Round to the nearest 0.5.
3. Verify rather than trust the tap: the downbeat 32 beats later should land at
   `32 x 60 / BPM` seconds, within one frame at 60 fps, which is 0.0167 s.
4. If it drifts by more than a frame the track is played rather than quantised.
   Beat-map it, export markers, and build the grid from the markers instead.
5. Write `BPM` and `t0` into section 6 of this file and commit that change.

**Never place a keyframe by eye.** Import the audio, generate a marker every beat
from the measured tempo, and snap to markers. A bar is `240 / BPM` seconds.

---

## 3. What was wrong with the previous cut, so it is not repeated

An earlier version ran 8 bars with the pen drawing one letter over 12 of its 32
beats. It read at half speed: roughly ten events in nineteen seconds, which is
brand-film pace, not reel pace.

**The rule for this cut: nothing on screen may hold unchanged for longer than two
beats.** Something arrives, leaves, moves or inverts on at least every second
beat, and through the services bar it is every beat. The camera is what carries
the energy between the type events, so the camera is never parked.

---

## 4. The map

The film is **one flat drawing far larger than the frame**, and a 3D camera flies
over it. Nothing cuts. Nothing dissolves.

- Every artwork layer is a 3D layer sitting at **Z = 0**, except the background
  objects in section 9, which sit behind it.
- **World scale: 1 brand unit = 9 px.** So the ribbon stroke, 13 units, is
  **117 px** wide in world space, always, everywhere.
- The camera's distance is what changes the ribbon's apparent weight. During the
  flight the camera sits between 1.0x and 1.6x out, so the ribbon reads 73 to
  117 px in a 1080-wide frame, which is 7 to 11 per cent of the width. Confident,
  not a hair.
- At the lock-up the camera sits at **3.41x out**, which puts the wordmark's ink
  at 625 px wide and the stroke at 34 px. That is the same lock-up as the still
  brand assets, so the last frame can be checked against `logos/`.

The map runs roughly four frame-widths across and seven frame-heights down. Lay
the stations out along the ribbon in the order in section 6 and let the ribbon
find them; do not force a grid.

---

## 5. The ribbon

### 5.1 What it is

One shape layer. One path. A stroke of 117 px, **Line Cap: Butt**, Line Join:
Round, no fill. **Trim Paths** on the same group, with `End` animated. That is
the whole rig, and it is the After Effects equivalent of the SVG technique the
site already uses.

### 5.2 Drawing arcs, not freehand

To keep rule 1.2, build the path as circular arcs. Converting a circular arc of
radius `r` and sweep `θ` radians to a bezier segment, the tangent handles have
length:

```
h = (4/3) · tan(θ/4) · r
```

So a 90 degree arc of radius 500 px takes handles of `(4/3)(tan 22.5°)(500)` =
276.1 px, laid along the tangent at each end. Keep every sweep at or under 90
degrees and split anything larger into two. Where two arcs meet, the handles must
be colinear through the join, or the ribbon will kink and the whole conceit goes.

Vary the radius, not the curve type. Tight turns of 250 to 400 px feel urgent;
long sweeps of 1500 px and up feel like travel. Alternate them.

### 5.3 The head

Duplicate the ribbon layer. On the copy, set the stroke to the accent and set
Trim Paths so `Start = End − (117 / pathLength) × 100`. That leaves a 117 px
length of accent riding at the head of the reveal, and it is correct everywhere:

- On a straight run it renders as a **117 px square with butt caps**, which is
  the brand's square full stop at exactly the right size.
- On a curve it renders as a **117 px arc segment**, correct weight by
  construction.

This is why the head is never a separate rotating square. A square dragged round
a curve sweeps a band 41 per cent too wide at the diagonals, and a square rotated
to follow the path is a diamond at 45 degrees, which misuse rule 7 forbids. The
trim solves both by never making the head a separate object.

### 5.4 Speed

**Constant.** The ribbon's head advances the same number of pixels per beat for
the whole flight. Use linear keyframes on Trim Paths `End`, and use
`pathLength` rather than percentage when spacing station arrivals, because equal
percentages are not equal distances on a path with varying radii.

The camera eases. The ribbon does not. That contrast is most of the feel.

---

## 6. The cut

**Twelve bars of 4/4, in three four-bar phrases.** At 110 BPM that is 26.2
seconds; at 120 BPM, 24.0. Fill in the resolved seconds once section 2 is done.

Beats are written `bar.beat`. Sub-beats are eighths, written `5.2+`.

### Phrase A, bars 1 to 4. Ignition and the pillars

| Beat | Picture | Copy | Ground |
|---|---|---|---|
| 1.1 | Camera close on empty espresso. A single amber square, at true full-stop size, hard on. No fade. | | dark |
| 1.2 | The square stretches into the ribbon and the head starts to run. Camera pulls back to 1.0x and begins to track. | | dark |
| 1.3 to 1.4 | The ribbon runs. Camera banks into the first turn. | | dark |
| 2.1 | **Ground inverts.** Station 1. | INNOVATION / Find better ways to do things. | light |
| 2.3 | The definition swaps out. Camera leads the head into the next arc. | | light |
| 3.1 | **Ground inverts.** Station 2. | AUTOMATION / Take repetitive work off people's hands. | dark |
| 4.1 | **Ground inverts.** Station 3. | OPTIMISATION / Get more from the people, processes, systems and data you already have. | light |
| 4.4 | Camera whips ahead of the head, anticipating the services. | | light |

The pillar term rides at the head's height across the full frame, always
horizontal, never rotated, and **inverts where the ribbon crosses it**: ink on the
ground, ground colour where it passes over the ribbon. In After Effects that is a
duplicate of the text layer with a Track Matte set to the ribbon layer, in the
ground colour, sitting above both. Set the matte to Alpha, not Luma.

The definition never rides. It sits in a fixed lower type block and hard-swaps on
the downbeat.

### Phrase B, bars 5 to 8. The six, and the place

Two beats each. This is the fastest passage in the film and the camera does not
stop once.

| Beat | Station | Copy |
|---|---|---|
| 5.1 | 01 | Save time |
| 5.3 | 02 | Understand your data |
| 6.1 | 03 | Build something new |
| 6.3 | 04 | Find the answer |
| 7.1 | 05 | Reduce mistakes |
| 7.3 | 06 | Train your team |

The index number is JetBrains Mono, large, in the accent. The name is Space
Grotesk 600 in the ink colour. The ground inverts every bar, so 5.1 dark, 6.1
light, 7.1 dark. The head pulses, scaling 1.0 to 1.12 and back inside an eighth,
on each of the six. It is the film's metronome and it is the only thing that
never leaves the screen.

These six are the customer-problem categories, and their exact wording, order and
capability labels are in `src/components/sections/Problems.jsx`. Take them from
there rather than from memory, and if that file changes, this list follows it.

| Beat | Picture | Copy | Ground |
|---|---|---|---|
| 8.1 | **The pull-out.** Camera dollies hard from 1.6x to about 9x in two beats, easing out. The whole flown ribbon is revealed at once, a single continuous line across the map. | Based in the East Midlands. | light |
| 8.3 | A dot grid resolves under the ribbon. One amber square marks the location. Concentric circular arcs, true circles, radiate from it and keep going past the frame edge. | Working with businesses anywhere. | light |

The pull-out is the film's biggest single move and the only place the camera
travels faster than the ribbon. It earns the two beats.

**One thing to check before you commit that copy.** The positioning statement in
`business/01-positioning/positioning-statement.md` says Nottingham **and
Alcester**. Alcester is Warwickshire, not the East Midlands. Either the copy
becomes "Nottingham and Alcester" or the positioning statement is what changes.
Do not quietly drop one of the two places to make a line scan better. Ask.

### Phrase C, bars 9 to 12. The resolve and the question

| Beat | Picture | Copy | Ground |
|---|---|---|---|
| 9.1 | **The whip.** The ribbon retracts and reforms into the true `n`: left stem, semicircular shoulder, right stem, on the exact geometry in section 8. Camera dives back in from 9x to 3.41x. Two beats, `EASE`. | | dark |
| 9.3 | The `n` settles at lock-up scale and position. Camera stops moving and does not move again. | | dark |
| 10.1 | The `a`, `b` and `l` reveal by Trim Paths, staggered an eighth apart, a quarter beat each, in reading order. | | dark |
| 10.3 | **The dot lands.** A straight horizontal slide of 20 units into the full-stop position. It is already at the right height: a 13-unit head resting with its leading edge on the baseline has its centre 6.5 units up, and the full stop's centre sits at 6.5 units. It never has to rise. One amber bloom, `0 0 32px rgba(233,172,87,0.20)`, over half a beat. The loudest frame in the film. | | dark |
| 11.1 | The question masks in below the wordmark. | Is your business ready to work smarter? | dark |
| 11.3 | | Technology implementation for small businesses. No retainer. You own what we build. | dark |
| 12.1 | | Book a free discovery call · nabl.agency | dark |
| 12.2 to 12.4 | Held. Nothing moves. | | dark |

The end card carries **one amber square only**, the wordmark's dot. The question
takes no full stop of its own, because the whole film has been about a single
square and putting a second one under it halves its value. This is a deliberate
departure from the site's h1 treatment. Do not correct it back.

**Why that question.** The promise is *we make your business work smarter*. The
end card asks the same sentence back. That is the only place in the film where
the brand's own line appears, and it appears as a question, which is the correct
register: we know how to help you find the answer, not we know the answer.

Hold the last frame at least one full bar so it survives the platform loop, and
export it as the still.

---

## 7. The camera

The camera is a character. Give it rules.

- **One camera.** 35 mm preset, so the flight feels quick. Parent it to a null
  and animate the null. Leave the camera itself at the origin of its parent.
- **Three moves only:** track in X and Y, dolly in Z, and a bank of at most
  4 degrees into a turn. No Dutch angles that are not a bank. No whip pans that
  are not the ribbon turning.
- **The camera moves on the bar and settles on the beat.** It arrives at each
  station a half beat before the type does, so the type lands into a settled
  frame rather than a moving one.
- **Easing:** use the repository's own curves, which are in
  `src/components/scenes/engine.js` and are the literal values of `--ease` and
  `--ease-out` in `tokens.css`. In After Effects, set them by hand in the graph
  editor: `--ease` is `cubic-bezier(0.22, 1, 0.36, 1)` and `--ease-out` is
  `cubic-bezier(0.16, 1, 0.3, 1)`. Both are arrival curves. For the pull-out at
  8.1, which is an accumulation rather than an arrival, use
  `cubic-bezier(0.5, 0, 0.5, 1)`.
- **Motion blur on**, shutter angle 180, shutter phase −90, samples 32. Check the
  services bar at full size; that is where it will smear if the samples are low.
- **Depth of field off** on the ribbon and on all type. A slight defocus is
  permitted on background objects only, and only at low strength. This is a flat
  brand, and photographic bokeh is decoration.

---

## 8. The wordmark geometry

Rebuild it as native shape layers with strokes. Do not import the SVG, and do not
trace it. Live strokes are what makes Trim Paths available for the reveal, and
the numbers below are exact.

One construction throughout: **13-unit stroke, butt caps, every curve a true
circle.** Master viewBox is 273 x 100. Baseline y = 82, x-height 21.5 to 82,
ascender top y = 6.

| Element | Geometry |
|---|---|
| `n` | Left stem x = 24.5 from y = 82 up to y = 48, semicircular shoulder radius 20, right stem x = 64.5 back down to y = 82. One continuous path. |
| `a` | Circle centre (128.25, 51.75) radius 23.75, plus a stem at x = 152 from y = 21.5 to 82. |
| `b` | Stem at x = 178 from y = 6 to 82, plus a circle centre (201.75, 51.75) radius 23.75. |
| `l` | Stem at x = 248.5 from y = 6 to 82. |
| The dot | A 13 x 13 square at x = 78, y = 69. Accent fill, not stroke. |

Spacing between outer edges is **7 / 7 / 13 / 10**. Do not adjust it, and
specifically do not "fix" the `a` to `b` gap to match the others. It is wider on
purpose, because two flat verticals facing each other read tighter than a curve
facing a vertical.

At the end of the film, overlay `public/brand/wordmark.svg` at the same size and
check they are identical. If they disagree by a pixel, the master wins.

---

## 9. Background objects

This is what makes the stations feel like one world rather than a slideshow.

Behind the ribbon, at **Z between +400 and +1200**, sits a field of large, slow
geometric objects. They parallax as the camera passes, which is where the sense
of depth and travel comes from.

**Build them from the vocabulary the product already uses.** Open
`src/components/Visuals.jsx` and translate `CategoryGlyph` into shape layers. Six
glyphs exist and they map one to one onto the six services:

| Service | Glyph | What it is |
|---|---|---|
| Save time | `time` | A clock with the wasted wedge lifted out of it |
| Understand your data | `data` | Bars you already have, and the one reading that is the answer |
| Build something new | `build` | Parts assembling into one thing |
| Find the answer | `answer` | A document with the one thing that answers the question picked out |
| Reduce mistakes | `accuracy` | A run of steps, one of which was wrong and is now right |
| Train your team | `train` | One point of understanding spreading to several people |

For the three pillars, use the node field from the same file: drifting points with
links that brighten as they shorten. It already means "separate tools becoming one
system", which is the pillars exactly.

Rules for the field:

- **They are hairlines.** Cream stroke at 6 to 11 per cent opacity, which are the
  `--line-faint` and `--line` values from `tokens.css`. They are never solid, and
  they never carry the accent.
- **Scale them up hard.** Each glyph is authored in a 64 unit box. Blow it up to
  1500 to 2500 px in world space so the camera passes through the drawing rather
  than looking at an icon.
- **The active station's object comes forward.** For its two or four beats it
  moves to Z ≈ +150 and rises to 20 per cent, then falls back. That is the only
  thing that distinguishes it, and it is enough.
- **They animate on their own slow loop**, independent of the beat: a rotation of
  a few degrees, a stroke that draws and redraws over eight bars. If they hit the
  beat as well as everything else the frame turns to noise. They are the room, not
  the performance.
- **Never let one sit directly behind type.** Check every type frame at full size
  against its background object, not against a flat card.

---

## 10. Colour and type

Five values. That is all of them.

| Role | Value | Note |
|---|---|---|
| Dark ground | `#0E0C0A` | |
| Light ground | `#F7F2E8` | The cream card tone, because its contrast pairs are already measured |
| Cream on dark | `#FBF6EC` | 18.12:1 |
| Ink on light | `#14110E` | 16.86:1 |
| Accent, dark frames | `#E9AC57` | 9.76:1 |
| Accent, light frames | `#B87718` | 3.31:1, so display type and non-text only, never small text |

**The ground inverts on the bar line, in one frame, with no dissolve.** Everything
inverts together: ground, ink, the ribbon already drawn. The accent inverts with
it and the swap is a hard cut, never a tween, because a tween spends its duration
in a colour that is in neither palette.

Type: Space Grotesk 700 for pillar terms, 600 for the six and the question, Inter
Tight 400 and 500 for definitions and the descriptor, JetBrains Mono 500 for index
numbers and the URL. Only those weights ship. There are no italics. Tracking is
−0.03em on large display, −0.015em on mid, +0.14em on uppercase mono labels.

**Type arrives by mask and leaves by hard cut.** No fades anywhere in the film. A
fade is what you reach for when you have not decided how something should arrive.

---

## 11. Comp setup

- 1080 x 1920, **60 fps**, square pixels. Duration: 12 bars plus one second.
- Safe box: x from 108 to 972, y from 250 to 1580. Nothing that has to be read
  leaves it. The ribbon may.
- Also deliver 1080 x 1080 and 1920 x 1080. Build them by re-framing the same map
  with a second and third camera, not by rebuilding the film. In the 16:9 cut the
  pillar term stops riding and sits in the type block, because there is not enough
  vertical travel for the ride to read.
- Render H.264, yuv420p, and give it enough bit rate that a flat espresso ground
  does not band. This film is mostly flat dark areas, which is exactly where cheap
  encoding shows. Check the first frame of bar 3 at full size.

---

## 12. Deliverables

| Cut | Length | For |
|---|---|---|
| Full 9:16 | 12 bars | Reels, TikTok, Shorts, Stories |
| Full 1:1 | 12 bars | LinkedIn and the feed |
| Full 16:9 | 12 bars | Site hero, deck opener |
| Cutdown | bars 1, 9 to 12 | Pre-roll and bumper |
| Stinger | 10.3 to 12.1 | End card on any other video |
| Cream cut | 12 bars | Every ground inverted, for light placements |
| End frame | still | Poster, and a candidate replacement for `public/brand/og.png` |
| Captions | `.srt` | In addition to the burned type |

---

## 13. Acceptance checks

Run all of them. This folder measures rather than asserts.

- **Contrast.** Sample rendered frames, not intended values. Every text pair on
  the ground it actually sits on. If plain `#E9AC57` appears on any light frame,
  the render is wrong.
- **Flashing.** The general threshold is three per second. One inversion per bar
  at 110 BPM is 0.46 per second. It passes wide. Re-check if anyone adds an
  inversion on the backbeat.
- **Pace.** Scrub the timeline and find the longest interval with no change of
  any kind. If it is longer than two beats, section 3 has been broken.
- **Safe zones.** Screenshot the end frame on a real handset with a real profile
  bubble, caption tray and call-to-action button over it. Not in a mock-up.
- **Silent.** Watch it once muted, on a phone, at arm's length. If the three
  pillars are not readable, the riding term is too big or travelling too far.
- **Drift.** Put the audio under the render and check the last downbeat lands on
  the dot. If it is late, the grid was built in frames instead of from markers.
- **The mark.** Overlay `public/brand/wordmark.svg` on the last frame at the same
  size. Gaps 7 / 7 / 13 / 10, stroke 13, butt caps.
- **The arcs.** Open the ribbon path and check every handle pair through every
  join is colinear. One kink is visible at speed and gives the whole film away.

---

## 14. Do not

- Do not add a fourth typeface, a second accent, a gradient, a bevel, a lens
  flare, or a particle system.
- Do not use a stock transition preset. The only transitions in this film are the
  camera and the colour inversion.
- Do not put the wordmark on a moving background. It sits on a flat ground.
- Do not rotate, arc, condense, extend or enclose the wordmark.
- Do not call n.abl an AI automation agency, and do not write copy that grades the
  visitor's problem before hearing it. Both are banned in
  `business/02-brand/voice-and-tone.md`.
- Do not invent a client count, a track record or a scale the business does not
  have.
- Do not guess the tempo. Section 2.

---

## 15. If you get blocked

- **The fonts are not installed.** They are in `public/fonts/` as woff2. Convert
  to otf or install the same families. Do not substitute, and do not let After
  Effects silently fall back.
- **The ribbon path is unmanageably long.** Split it into three shape layers, one
  per phrase, each with its own Trim Paths, and butt them end to end at a tangent.
  The joins are invisible if the handles are colinear.
- **The camera flight fights the ribbon.** Build the ribbon and the camera first,
  with no type and no background at all, and get that thirty seconds feeling right
  on its own. Everything else is decoration on top of it and can be added in an
  hour. If the flight is not good, no amount of type will save it.
- **A copy line does not fit.** The line is right and the layout is wrong. Change
  the layout. The exception is the OPTIMISATION definition, which is long on
  purpose and is set on two lines.
