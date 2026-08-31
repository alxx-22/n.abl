# The introduction reel

A brand film for n.abl. One idea, eight bars, no cuts.

This file is the plan and the specification. It sits in `02-brand` because a
reel is the identity moving, and the identity is specified here. Everything it
uses is already decided elsewhere in this folder: the palette in
[`brand-guidelines.md`](brand-guidelines.md) section 3, the type stack in
section 4, the logo construction in section 2, the pillars in
[`brand-promise.md`](brand-promise.md) section 2, the words in
[`voice-and-tone.md`](voice-and-tone.md).

Nothing new is invented here. No new colour, no fourth typeface, no second
accent, no gradient. The only design tokens the film uses are the colours, the
fonts and the contrast rules already in this folder.

Status: planned, not built. One input is still missing, and it is named in
section 2 so nobody starts work assuming it was measured.

Written 2026-08-31.

---

## 1. What the film has to do

Twenty seconds, vertical, sound off by default. It has to leave three things
behind:

1. The mark, recognised.
2. The three pillars, in order.
3. One sentence a person could repeat.

It also has to look like the thing it is selling. n.abl builds precise systems
out of ordinary parts and does not decorate them. A film full of glow, drift and
easing-for-its-own-sake would contradict the pitch. So the film is built from
the logo's own geometry and nothing else, and every number in it is derived
rather than chosen.

---

## 2. The music, and the one thing not yet measured

The track is **Magic Clipper by Peter Spacey**, licensed through Artlist. Two
versions exist: `109797` is the vocal, `109795` is the instrumental.

**Use the instrumental.** Eighty-five per cent of vertical video is watched with
the sound off, so the film carries burned-in type throughout, and burned-in type
fighting a vocal is the most common way a competent reel ends up looking cheap.
A vocal also dates a brand film faster than anything else in it.

### 2.1 What is established about the track

Peter Spacey is a Tel Aviv producer. The track sits in his beat-tape catalogue
and is tagged as spaced-out funk and funky soul grooves, described as uplifting
electronic. That is a beat-tape groove: a kick anchoring the bar, a backbeat, and
a hi-hat carrying the sub-grid.

### 2.2 What has not been measured

**The tempo has not been measured, and nothing in this file assumes a value for
it.** The track is behind a login on Artlist and could not be analysed. Anyone
who writes a BPM into a timeline before doing section 2.3 is guessing, and the
whole film is cut to that number.

Everything below is written in bars and beats. One constant, `BPM`, resolves the
entire timeline. That is deliberate: the structure survives whatever the
measurement turns out to be, and the film can be re-rendered against a corrected
tempo in one command rather than re-cut by hand.

### 2.3 Locking the grid. Three minutes, once

1. Open the instrumental in any editor.
2. Find the first downbeat of the first full groove, after the intro. Call it
   `t0`. This is the film's bar 1 beat 1, not the start of the file.
3. Tap 32 beats from `t0`. Take the mean. Round to the nearest 0.5.
4. Verify rather than trust the tap. Place a marker on the downbeat 32 beats
   later and measure the elapsed time. It should be `32 x 60 / BPM` seconds, to
   within one frame at 60 fps, which is 0.0167 s.
5. If step 4 drifts by more than a frame, the track is played rather than
   quantised. Beat-map it and export a marker list instead of a single tempo.
   The timeline in section 10 accepts a marker list as well as a constant.
6. Write `BPM` and `t0` into the reel config. Re-render.

Record both numbers in this file when they are known, so the next person does not
repeat the measurement.

### 2.4 Runtime, resolved

The film is 8 bars of 4/4. A bar is `240 / BPM` seconds.

| BPM | Bar | 8 bars | Verdict |
|---|---|---|---|
| 90 | 2.667 s | 21.3 s | Fine |
| 96 | 2.500 s | 20.0 s | Fine |
| 100 | 2.400 s | 19.2 s | Fine |
| 105 | 2.286 s | 18.3 s | Fine |
| 110 | 2.182 s | 17.5 s | Fine |
| 120 | 2.000 s | 16.0 s | Fine |

Anything from 90 to 120 lands the film between 16 and 21 seconds, which is inside
the band where vertical video holds completion. The structure does not need
changing. If the track turns out to be half-time or double-time, for example 85 or
170, use 8 bars at 85 and 16 bars at 170. The bar count changes; nothing else does.

### 2.5 Frame rate, and the drift trap

Render at **60 fps**. The film has whip moves that read as smear at 30.

Frames per beat is `frame rate x 60 / BPM`. At 60 fps and 100 BPM that is 36
frames, a whole number. At 110 BPM it is 32.73, which is not.

This is the trap. An editor snaps a cut to a whole frame, but the beat does not
land on one, and the rounding error accumulates. Over 32 beats a quarter-frame
error becomes eight frames, and the last hit of the film is visibly late.

**The fix is not to pick a convenient tempo. It is to never author in frames.**
Author the timeline in seconds as floating point, sample it once per frame at
render time, and let the sampler round. The error then never accumulates, because
every frame is computed from absolute time rather than from the frame before it.

This repository already works that way, and says why, in
`src/components/scenes/engine.js`:

> The six service scenes are timelines in real seconds, sampled per frame, not
> CSS keyframes: a keyframe cannot be asked where it is at 4.31s.

That is the same problem and the same answer. Section 12 uses that engine rather
than reinventing it.

### 2.6 The hit map

What each layer of the groove drives. Confirm against the real track at step 2.3.

| In the music | In the film |
|---|---|
| Kick on beat 1 of each bar | The ground inverts. One frame, hard. |
| Backbeat on 2 and 4 | Type arrives and leaves. |
| Hi-hat on the eighths | The six capabilities, bar 5. Six eighths, three beats. |
| The phrase turnaround before bar 6 | The contraction. The film's one big move. |
| The last downbeat | The dot lands. |

If the track has no audible turnaround at bar 6, move the film's `t0` earlier or
later by four bars until it does. Cutting the film to a phrase boundary matters
more than starting at a tidy timecode.

---

## 3. The idea: one stroke

> **The dot is the pen.**
>
> The square full stop is 13 by 13 units, which is exactly one stroke unit
> square. Anywhere it is dragged it leaves a stroke of the correct weight, and
> because it is square it leaves butt caps. So the film does not animate the
> logo. It draws the logo with its own full stop, and then the pen stops being a
> pen and sits down as the full stop again.

That is the whole film, and it comes out of the construction rather than being
applied to it. From `brand-guidelines.md` section 2.2: a 13-unit monoline stroke,
butt caps, and every curve a true circle. The dot is one stroke unit square. Those
two facts were already written down. The film is what happens when you notice they
fit.

Three consequences, and they are the reason to make this film rather than a
different one.

**One.** A single amber square is on screen from the first frame to the last. It
never leaves. Everything else inverts around it. The film has exactly one
continuous object, which is the strongest form a twenty-second brand film can
take.

**Two.** The `n` is tangent-continuous. The left stem is vertical, and the
leftmost point of a circle has a vertical tangent, so the stem meets the shoulder
with no corner. A pen can run stem, shoulder, stem in one move without stopping.
The letter is already a path. That is where the fluidity comes from, and it is
free.

**Three.** The pillars can be located on the letter. The pen climbs the left
stem, turns over the shoulder and comes down the right stem. Three segments,
three pillars, in the order they are always written. The film ends by contracting
that giant letter into the real mark, so the mark is not a sign-off card. It is
what the three pillars turn into.

---

## 4. The options that were considered, and why this one

The starting idea was to move the `n` around three pillar texts. That is close,
but it puts the wrong element in motion. The evaluation:

| Option | What moves | Against it | For it |
|---|---|---|---|
| **A. The `n` travels between three pillar texts** | The letter `n`, as an object, moving around the frame | Breaks misuse rule 12: the artwork is not rotated or repositioned as decoration. Half the mark wandering around a frame reads as a sticker. The letter is also the least mobile part of the identity, because its whole value is that it sits still and is recognised. | It is the obvious reading of the brand. |
| **B. The `n` stays still and the world moves through its counter** | The ground, masked by the letter's negative space | On its own it is static, and it cannot carry three pillars in order because the letter has no sequence in it. | Cheap to build, and the mask is genuinely good. |
| **C. Three pillar cards with wipes, then the logo** | Nothing that belongs to the brand | Any agency could make it. The brand contributes only its colours. | Two days of work, and it would be fine. |
| **D. The dot travels the letter, and the pillars are its three segments** | The dot, which is the signature, along the letter's own path | Needs the geometry handled properly, including the wrinkle in section 6.3. | The moving element is the one thing in the identity that is already described as a signature. Motion path, pillar order, colour rule and the ending all come out of one decision. |

**Take D.** Use B's mask for the six capabilities in bar 5, where a letterform
window is exactly right and the letter is standing still anyway. Keep C written
down as the fallback if the schedule collapses.

Option D also answers the original idea properly. The `n` still carries the three
pillars. It is just that the pillars are stations on the letter rather than
places the letter visits, and the pillar words ride with the pen rather than
sitting in a grid. Section 10.2 has the detail.

---

## 5. The motion grammar

Six rules. They apply to this film and to anything else n.abl animates. Together
they are the reason the film looks designed rather than animated.

**5.1 Straight lines and true circles only.** Every move in the film is either a
straight translation or an arc of a true circle. No bezier swooshes, no arcs that
are nearly circles, no ellipses. This is `brand-guidelines.md` 2.2 promoted from
drawing to movement, and it is the single rule that does the most work.

**5.2 Nothing fades.** There are no dissolves and no opacity ramps anywhere in
the film. Things arrive by mask and leave by hard cut. A fade is what you reach
for when you have not decided how something should arrive.

**5.3 Every mask edge is a stroke unit.** Wipes and reveals travel at 13 units,
or a whole multiple of 13. The film has one unit of measure and it is the same
unit the logo is built from.

**5.4 Motion is continuous, colour is percussive.** The pen never stops between
bars 2 and 4. The ground inverts in one frame on the downbeat. Fluid movement
with hard colour hits is what makes a fast film feel expensive rather than busy.
It is also what makes it legible with the sound off, because the rhythm is
carried by luminance rather than by audio.

**5.5 Use the repository's own curves.** They are already solved in
`src/components/scenes/engine.js` and they are the literal values of `--ease` and
`--ease-out` in `tokens.css`.

| Curve | Value | Use in the film |
|---|---|---|
| `EASE` | `cubic-bezier(0.22, 1, 0.36, 1)` | Arrivals. The contraction. The dot landing. |
| `EASE_OUT` | `cubic-bezier(0.16, 1, 0.3, 1)` | The fastest arrivals. Type masks. |
| `EASE_IO` | `cubic-bezier(0.5, 0, 0.5, 1)` | Accumulation, not arrival. The pen leaving and rejoining rest. |
| `LINEAR` | | The pen mid-travel. |

`EASE` and `EASE_OUT` are arrival curves. They spend most of their travel early,
which is right for something coming to rest and wrong for anything building up.
The engine says so already, and the same caution applies here.

**5.6 The brand's durations are the beat, near enough.** `--dur-slow` is 0.6 s,
which is exactly one beat at 100 BPM. `--dur` at 0.32 s is a half beat at 94 BPM,
and `--dur-fast` at 0.18 s is a quarter beat at 83 BPM, so those two are close
rather than exact. If the measured tempo lands near 100, use the tokens directly
and the film and the product will be running on the same numbers. If it lands
elsewhere, derive from the beat and note the deviation. Do not bend the tempo to
suit the tokens.

---

## 6. Colour, and the inversion

### 6.1 The five values in the film

That is all of them.

| Role | Value | Where it comes from |
|---|---|---|
| Dark ground | `#0E0C0A` | `--bg` |
| Light ground | `#F7F2E8` | The cream card tone. Chosen because its contrast pairs are already measured in `brand-guidelines.md` 3.2, so nothing has to be re-derived. |
| Ink on light | `#14110E` | The ink value. 16.86:1 on `#F7F2E8`. |
| Cream on dark | `#FBF6EC` | `--cream-100`. 18.12:1 on `--bg`. |
| The accent | `#E9AC57` on dark, `#B87718` on light | `--accent-400` and `--accent-600` |

No gradient. No second accent. One low-opacity amber bloom, once, on the dot
landing, which is the one glow the guidelines permit.

### 6.2 The inversion rule

> **The ground inverts on every bar line until the lock-up. One frame. No
> dissolve.**

Bars 1 to 7 alternate: dark, light, dark, light, dark, light, dark. Bars 7 and 8
are both dark, and that repetition is what makes the ending feel like it settles
rather than stopping.

Everything inverts together: the ground, the ink, and the stroke already drawn.
It is one boolean applied to a palette, not six animated properties.

**The accent inverts with it, and this is the rule most likely to be missed.**
Plain amber `#E9AC57` measures 1.79:1 on the cream card and fails outright. On
every light bar the pen and the dot are deep amber `#B87718`, which measures
3.31:1 and passes 3:1. So it is fine for the dot, the pen, rules and display type
at 24 px and above, and it is never used for small text in this film or anywhere
else. Small type on a light bar is ink.

The swap is a hard cut on the same frame as the ground. Do not tween the accent
between the two values, because for the duration of the tween the accent is a
colour that is in neither palette.

### 6.3 The wrinkle, and what to do about it

A square dragged along a straight line sweeps a band exactly 13 units wide with
butt caps. That is the whole trick, and it is exact.

A square dragged around a curve is not. If it stays square to the frame, the
band it sweeps is up to 41 per cent wider at the diagonals, because a square
presents its diagonal to the direction of travel at 45 degrees. If instead it
rotates to stay square to the path, then at 45 degrees it is a diamond, and
misuse rule 7 says the dot is never a diamond.

So the dot does not rotate, and it does not act as the pen on the shoulder.
Instead:

- **On the two stems** the pen is the dot. A filled square, axis aligned, at the
  leading edge of the stroke it is drawing. It is exactly the stroke end.
- **On the shoulder** the pen is a 13-unit segment of the stroke itself, in the
  accent, travelling at the head of the reveal. Butt caps, on the true circle,
  correct weight by construction.
- **The changeover happens at the tangent points**, where the stem meets the
  circle, and it is invisible because at that instant a 13-unit square and a
  13-unit segment of a vertical stroke are the same shape.

The dot and the stroke are the same substance, 13 units of it, changing state at
the two points where the two states look identical. Nothing rotates, nothing
distorts, nothing becomes a diamond, and the drawn letter is geometrically the
real letter at every frame.

Implementation is ordinary: reveal the path with `stroke-dasharray` and
`stroke-dashoffset`, and run a second dash of length 13 in the accent at the head
of the reveal. Both take butt caps.

---

## 7. Type

Three families, already decided, and only the weights that ship.

| Role in the film | Family and weight | Treatment |
|---|---|---|
| Pillar terms | Space Grotesk 700 | Uppercase, `--track-tight` at -0.03em |
| The promise, the rule, the six | Space Grotesk 600 | Sentence case, `--track-snug` at -0.015em |
| Definitions and the descriptor | Inter Tight 400 and 500 | Sentence case, untracked |
| Index numbers and the URL | JetBrains Mono 500 | Uppercase where it is a label, `--track-wide` at 0.14em |

No italics ship, so there are none. No weight above 700. The display face never
sets body copy and the mono face never sets prose. The six capability names are
labels rather than prose, and they are set in the display face because they are
at headline scale; their `01` to `06` index numbers are mono, because a number
read digit by digit is what the mono face is for.

**Type arrives by mask and leaves by cut**, per rule 5.2. The mask is a band that
travels along the baseline at 13 units, in the direction the text reads.

The wordmark is never set in Space Grotesk. It is drawn artwork, and the film
renders `public/brand/wordmark.svg` itself. This is worth stating in a motion
brief because a reel is where somebody usually retypes the name in the display
face and calls it the logo.

---

## 8. Layout

### 8.1 The primary frame, 9:16 at 1080 x 1920, 60 fps

Platform furniture takes the top 250 px and the bottom 340 px, and the safe
horizontal band is the centre 80 per cent. So:

- **Safe box: x from 108 to 972, y from 250 to 1580.** 864 by 1330.
- Nothing that has to be read leaves it. The drawn stroke may.

The giant `n` is scaled at **15 px per unit**. Its ink box is 53 units wide by
60.5 tall, which gives 795 by 908 px, and a stroke and dot of 195 px. Place its
baseline at y = 1210 and its left ink edge at x = 143, which centres it
horizontally and leaves the lower third for the type block.

Type block: a fixed rectangle from x = 108 to 972, y from 1300 to 1560. The
definition, the rule and the six all land in it. Only the pillar term leaves it,
because the pillar term rides with the pen.

### 8.2 The other two ratios

The film is one timeline with three layouts, not three films.

| Ratio | Size | What changes |
|---|---|---|
| 9:16 | 1080 x 1920 | Primary. As above. |
| 1:1 | 1080 x 1080 | LinkedIn and the feed, where vertical is not favoured. The `n` drops to 11 px per unit and moves left; the type block becomes a right-hand column. |
| 16:9 | 1920 x 1080 | Site hero, deck opener, email header still. Same as 1:1 but wider, and the pillar term stops riding with the pen and sits in the type block, because there is not enough vertical travel for the ride to read. |

That is the only place the two treatments of the pillar term both exist, and the
16:9 exception is the reason to keep the static variant specified at all.

---

## 9. The words

Exact copy. British English. Nothing here is new; every line already exists in
this folder or on the site.

| Where | Words | Source |
|---|---|---|
| Hook | Tell us what isn't working | `brand-promise.md` 4.2, the approved substitution |
| Pillar 1 | INNOVATION / Find better ways to do things. | `brand-promise.md` 2 |
| Pillar 2 | AUTOMATION / Take repetitive work off people's hands. | `brand-promise.md` 2 |
| Pillar 3 | OPTIMISATION / Get more from the people, processes, systems and data you already have. | `brand-promise.md` 2 |
| The six | 01 Save time / 02 Understand your data / 03 Build something new / 04 Find the answer / 05 Reduce mistakes / 06 Train your team | `src/components/sections/Problems.jsx` |
| The rule | Start with the problem, not the technology. | `src/components/sections/Pillars.jsx` |
| The promise | We make your business work smarter | `brand-promise.md` 1 |
| Descriptor | Technology implementation for small businesses | `src/components/sections/Hero.jsx` |
| Terms | No retainer. You own what we build. | Positioning, long form |
| Call to action | Book a free discovery call / nabl.agency | Site |

The pillar definition for OPTIMISATION runs long for a lower third. Set it on two
lines and hold it for the full bar. Do not shorten it; it is the pillar that most
needs its own words, because "optimisation" on its own is the vaguest of the
three.

Two things the film must not say, both from `voice-and-tone.md`: it must not call
n.abl an AI automation agency, and it must not grade the visitor's problem before
hearing it. The hook is the approved wording for exactly that reason.

---

## 10. The beat sheet

Eight bars of 4/4. Beats are written `bar.beat`, so `3.2` is bar 3 beat 2.
Sub-beats are eighths, written `3.2+`.

### Bar 1. The hook. Ground: dark

| Beat | What happens |
|---|---|
| 1.1 | Hard on, no fade. "Tell us what isn't working" in Space Grotesk 600, cream, centred in the safe box, punctuated by the amber square. The square is at true full-stop scale, 13 units, small. |
| 1.2 | Held. Nothing moves. Three quarters of a second of stillness is the most confident thing a reel can do at the top, and it makes the next move land. |
| 1.3 | The type leaves. A 13-unit mask travels right to left along the baseline and takes the words with it. The square stays. |
| 1.4 | The square scales up, uniformly, from 13 units to 195 px, `EASE`, one beat. It does not rotate. It moves to the base of the left stem. It is now the pen. |

The first two seconds have already stated the film: this square is the full stop,
and it is about to become the instrument.

### Bars 2 to 4. The three pillars. Twelve beats of continuous travel

The pen does not stop for twelve beats. Grounds invert on 2.1, 3.1 and 4.1.

| Segment | Beats | Path | Length | Speed |
|---|---|---|---|---|
| Left stem, up | 2.1 to 2.4 | y 82 to 48 | 34 units | 11.33 units per beat |
| Shoulder | 2.4 to 3.4 | semicircle, r 20 | 62.83 units | 10.47 units per beat |
| Right stem, down | 3.4 to 4.4 | y 48 to 82 | 34 units | 11.33 units per beat |

Three, six and three beats. The `n` divides almost exactly one to two to one by
arc length, so a 3/6/3 allocation gives a pen speed that varies by 8 per cent
across the whole move, and the slow part is the turn. That is the right way round.
It reads as an ease through the corner and it was not designed in, it fell out of
the letter.

Do not try to make it exactly constant. Exactly constant needs 5.54 beats on the
shoulder, and then nothing lands on a downbeat, which costs far more than an 8 per
cent variation gains.

| Beat | What happens |
|---|---|
| 2.1 | Ground inverts to light. Ink stroke, deep amber pen. INNOVATION masks in, riding the pen. Its definition masks into the type block. |
| 2.1 to 2.4 | The pen climbs, drawing the left stem. |
| 3.1 | Ground inverts to dark. AUTOMATION replaces INNOVATION, hard cut, no dissolve. Definition swaps in the type block. |
| 2.4 to 3.4 | The pen runs the shoulder as a 13-unit accent segment at the head of the reveal, per 6.3. |
| 4.1 | Ground inverts to light. OPTIMISATION. This is the strongest hit of the first half: the inversion, the word and the top of the descent all land together. |
| 3.4 to 4.4 | The pen comes down the right stem. |
| 4.4 | The pen arrives at the baseline and stops for the first time since 1.4. The giant `n` is drawn. |

**The riding term.** The pillar term is set at 96 px, Space Grotesk 700,
uppercase, and anchored two dot-widths from the pen, always horizontal, never
rotated, never scaled. It travels because the pen travels. It sits on whichever
side of the pen has more room inside the safe box, and it may only change side on
a bar line, never mid-segment. If a term would leave the safe box at any frame of
its bar, it sits static in the type block for that bar instead. Check
OPTIMISATION first; it is twelve characters and it is the one that will fail.

The definition never rides. It stays in the type block and swaps on the downbeat.
The big word carries the energy, the sentence carries the meaning, and separating
them is what keeps the bar readable at speed.

### Bar 5. The six. Ground: dark

The fastest bar. The giant `n` stands still, and its counter, the negative space
under the arch, becomes a window. This is option B from section 4, used where it
belongs.

| Beat | What happens |
|---|---|
| 5.1 | 01 Save time |
| 5.1+ | 02 Understand your data |
| 5.2 | 03 Build something new |
| 5.2+ | 04 Find the answer |
| 5.3 | 05 Reduce mistakes |
| 5.3+ | 06 Train your team |
| 5.4 | Rest. Nothing. This beat is the wind-up for the contraction. |

Six eighths, three beats, then a beat of air. Each item masks in through the
letter's counter and cuts out on the next eighth. The index number is mono, the
name is display. The dot pulses on each of the six, scaling 1.0 to 1.12 and back
inside an eighth, which keeps the amber as the film's metronome.

The counter is 27 units wide by about 47.5 tall, so 405 by 713 px at 15 px per
unit. Two or three lines of type fit. Set them to fit the window rather than
scaling the window to the type.

### Bar 6. The rule, and the contraction. Ground: light

| Beat | What happens |
|---|---|
| 6.1 | Ground inverts to light. "Start with the problem, not the technology." masks into the type block, Space Grotesk 600, ink. |
| 6.2 | Held. |
| 6.3 to 6.4 | **The contraction.** The giant `n`, the pen and the type block scale down together, uniformly, about a single point, `EASE`, two beats, arriving at true wordmark scale and at the wordmark's final position. |

The contraction is the film's one big move and it is the only place the whole
frame changes scale. Because the pillar type is a child of the same transform, the
three pillars visibly collapse into the letter. That is the argument of the film
made as a move rather than as a claim, and it is the frame to grade most
carefully.

Uniform scale only. No rotation, no non-uniform scale, no bounce past the final
size. The mark does not overshoot.

### Bar 7. The wordmark completes. Ground: dark

| Beat | What happens |
|---|---|
| 7.1 | Ground inverts to dark, and stays dark to the end. The `a`, `b` and `l` reveal by mask, staggered an eighth apart, a quarter beat each, in reading order. They are revealed rather than drawn: the pen is not available, because the pen is about to be the full stop. |
| 7.2 | **The dot lands** in the full-stop position, 7 units from the `n` and 7 from the `a`. Hard arrival on the beat. The one permitted amber bloom, `--glow-accent` at 0 0 32px rgba(233,172,87,0.20), rises over half a beat and stays. This is the film's loudest frame and it should carry a single transient in the audio if one can be placed there. |
| 7.3 | "We make your business work smarter" masks in below the wordmark, Space Grotesk 600, cream. |
| 7.4 | Held. |

**The promise line carries no full stop in this film.** On the site the h1 takes
the square dot, and here it would put two amber squares on screen at the moment
the whole film has been about one. The wordmark above it already carries the
signature. This is a deliberate departure from the site treatment, and the reason
is written down so nobody corrects it back.

### Bar 8. The lock-up. Ground: dark

| Beat | What happens |
|---|---|
| 8.1 | The descriptor masks in, Inter Tight 400, cream 400: "Technology implementation for small businesses". Then "No retainer. You own what we build." |
| 8.2 | "Book a free discovery call" and `nabl.agency`, mono, cream 200. |
| 8.3 to 8.4 | Held. Nothing moves. |

Hold the final frame for at least one full bar so it survives the platform loop
and so a viewer who arrives late still sees the mark. The last frame is also the
poster and the still export.

---

## 11. How to build it

**Build it in this repository, in the scene engine that already exists.** Not in
After Effects.

This is not a preference. It is the difference between a film that is on brand
and a film that is a copy of the brand:

- The colours are the tokens, imported, not sampled from a screenshot.
- The curves are `EASE` and `EASE_OUT` from `engine.js`, which are the literal
  values of `--ease` and `--ease-out`, solved with Newton-Raphson so JavaScript
  evaluates what CSS interpolates.
- The wordmark is `public/brand/wordmark.svg` itself, the same paths the nav
  renders, so the film cannot drift from the master.
- The fonts are the six self-hosted `woff2` files. Nothing is requested from a
  font CDN, which is rule 3 of the four that must never be broken.
- The timeline is in real seconds and sampled per frame, so section 2.5's drift
  cannot happen.
- One `BPM` constant re-cuts the whole film.
- One `ratio` constant renders 9:16, 1:1 and 16:9 from the same timeline.
- One `invert` boolean produces the mirrored cut described in section 13.

The repository already renders brand artwork in a headless browser at
`deviceScaleFactor: 2`, in `scripts/build-logos.mjs` and `scripts/build-og.mjs`,
and `build-og.mjs` already inlines the woff2 files as base64 so the card never
depends on a font CDN. The reel pipeline is the same pipeline with a clock.

### Files

| Path | What it is |
|---|---|
| `scripts/reel/timeline.js` | The film. Bars, beats, positions, the palette boolean. Imports `bezier`, `seg`, `lerp`, `arc` and `C` from `src/components/scenes/engine.js`. Exports `frameAt(t)`. |
| `scripts/reel/layout.js` | The three ratios. Safe boxes, the units-per-pixel scale, the type block. |
| `scripts/reel/render.html` | One page. An SVG at the target size, driven by a clock the renderer sets rather than by `requestAnimationFrame`. |
| `scripts/build-reel.mjs` | Headless Chromium. Sets the clock to `n / 60` seconds, screenshots, repeats. Then ffmpeg. |
| `business/02-brand/intro-reel.md` | This file. |

### Capture

Do not screen record. Drive the clock, screenshot each frame, encode. At 60 fps
and 100 BPM that is 1152 frames for the 9:16 cut, which takes a few minutes and
is exactly reproducible. A screen recording drops frames under load and cannot be
reproduced, which means it cannot be reviewed against a fix.

Encode with ffmpeg to H.264, yuv420p, and a bit rate high enough that a flat
espresso ground does not band. Flat dark areas are where cheap encoding shows,
and this film is mostly flat dark areas. Check the first frame of bar 3 at full
size before signing anything off.

### Order of work

1. Do section 2.3. Write `BPM` and `t0` into the config. Nothing else can start.
2. Build `layout.js` and check the safe boxes against a real handset, with a real
   caption and a real profile bubble on screen.
3. Build the pen: the path, the reveal, the state change at the tangent points.
   This is the only technically awkward part of the film and it should be
   working before any type exists.
4. Add the inversion. Check the accent swaps to `#B87718` on the same frame as
   the ground and does not tween.
5. Add the type. Test OPTIMISATION riding, per section 10.
6. Build the contraction.
7. Add the lock-up.
8. Render, watch it silent, then watch it with sound.

Step 8 in that order matters. If it does not work silent, it does not work.

---

## 12. Deliverables

From one timeline.

| Cut | Size | Length | For |
|---|---|---|---|
| Full, 9:16 | 1080 x 1920 | 8 bars | Reels, TikTok, Shorts, Stories |
| Full, 1:1 | 1080 x 1080 | 8 bars | LinkedIn, feed |
| Full, 16:9 | 1920 x 1080 | 8 bars | Site hero, deck opener |
| Cutdown | all three | Bars 1, 6, 7, 8 | Pre-roll and bumper |
| Stinger | all three | 7.1 to 8.1 | End cards on any other video |
| Cream cut | all three | 8 bars | The inversion boolean flipped. For light-ground placements and print-adjacent work. |
| End frame | 1200 x 630 and 1080 x 1080 | still | Poster, and a candidate replacement for `og.png` |
| Captions | `.srt` | | Platform captions, in addition to the burned-in type |

---

## 13. The checks

Run these before anything is published. This folder measures rather than asserts,
and a film is no exception.

**Contrast.** Sample the actual rendered frames, not the intended values. Every
text pair in the film, on the ground it actually sits on. Expected:
cream `#FBF6EC` on `#0E0C0A` is 18.12:1, ink `#14110E` on `#F7F2E8` is 16.86:1,
deep amber `#B87718` on `#F7F2E8` is 3.31:1 and is used only for the dot, the pen
and display type at 24 px and above. If plain `#E9AC57` appears on any light
frame, the render is wrong; it measures 1.79:1 there.

**Flashing.** The general flash threshold is three per second. The film inverts
once per bar, which at 100 BPM is 0.42 per second, and at 120 BPM is 0.5. It
passes with a wide margin. Re-check if anyone proposes inverting on the backbeat
as well, because that would be 0.83 per second and still passing, but it is the
change that would start eating the margin.

**Safe zones.** Screenshot the final frame with a real profile bubble, a real
caption tray and a real call-to-action button over it. Do this on a handset, not
in a mock-up.

**Silent.** Watch it once with the sound off, on a phone, at arm's length. If the
three pillars are not readable, the riding term is too big or moving too far.

**Drift.** Put the audio under the render and check the last downbeat lands on
the dot. If it is late, section 2.5 was not followed.

**The mark.** At the last frame, overlay `public/brand/wordmark.svg` at the same
size and check they are identical. Gaps 7 / 7 / 13 / 10, stroke 13, butt caps.
If the film's wordmark disagrees with the master by a pixel, the master wins and
the film is wrong.

---

## 14. Open decisions

Two, and neither blocks a start on section 11 step 2.

1. **The tempo.** Section 2.3. Three minutes of somebody's time.
2. **The licence.** Confirm the Artlist licence in force covers paid promotion,
   not only organic posting, before any of this is put behind spend.

---

## 15. Sources

Brand facts come from this folder and from the repository. The outside reading
behind sections 2.5, 5 and 8:

- [BPM and Picture: How Editors Cut to Music](https://www.toolsforfilm.com/blog/bpm-and-picture-editors-guide)
- [BPM to FPS calculator](https://www.silvermansound.com/bpm-to-fps-calculator)
- [Social media video specs, 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/)
- [Social media video sizes, 2026](https://socialbee.com/blog/social-media-video-sizes/)
- [Building a motion identity](https://www.dawncreative.co.uk/insight/building-a-motion-identity/)
- [Motion brand guidelines](https://www.everything.design/blog/motion-brand-guidelines)
- [Logo animation trends, 2026](https://www.renderforest.com/blog/logo-animation-trends)
- [SVG line drawing with stroke-dashoffset](https://animationpatterns.art/animations/signature-line-drawing-illusion-overview/)
- [Magic Clipper, Peter Spacey, on Artlist](https://artlist.io/royalty-free-music/song/magic-clipper/109797)
