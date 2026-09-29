# Reel studio

A 9:16 marketing template you talk over, with the six service scenes
playing inside it and a camera window that moves between framings.

    node scripts/build-reel.mjs      # → build/reel*.html

Six cuts off one player. The show — a list of sections with durations,
framings and copy — is the only difference between them:

| | |
|---|---|
| `reel.html` | **Talk over it.** 50s, camera moves between full frame, top band, bottom band and absent. The six scenes play in a fixed band. |
| `reel-punch.html` | **Punch cut.** 22.6s. A typed opener with a two-tone colour turn, the three pillars as words receding through a burst, then the six services as fast cards. |
| `reel-brand.html` | **Brand cut.** 25.6s, no camera and no type outside the card. One container morphs through the mark, the three pillars and the six services. |
| `reel-automation.html` | **Automation, 25s at 0.5x.** One service, laid out across a canvas larger than the frame; the camera walks a staircase down it. |
| `reel-data.html` | **Data, 24.4s at 0.5x.** One spreadsheet at four distances — opens inside a cell that looks fine and pulls back until you can see how many are not. |
| `reel-web.html` | **Web, 24.2s at 0.5x.** Five cells on one horizontal track; the camera only goes right, or in. |

The brand cut is built after an iOS Live Activity: a compact pill grows
into a card, the content blurring while the container is in motion and
sharpening as it settles, and the container never disappears. That
continuity is the whole idea — six things cutting to each other is a
slideshow; one thing becoming six things is a product. Card states live
in `cards.js` as a size and some content; nothing there animates itself.

Open `build/reel.html` in a browser. No server, no build step — the
person recording with it is holding a webcam, not a terminal.

## Recording

URL parameters, because an OBS Browser Source cannot press buttons:

    reel.html?clean=1&guides=0&cam=key&play=1

`clean` drops the control panel, `guides` the safe-zone overlay, `cam` is
`live|key|off`, `play` starts on load, `speed` scales the timeline and
`skew=1` turns on the live skew. At a 1080x1920 browser source that
comes up at exactly 1:1 with nothing on it but the stage.

In OBS: browser source on top, webcam below it, Chroma Key (green) on the
browser source. The reel cuts the window; your face shows through it.

Guides off is the recording state, not just a cleaner preview — the
"CAMERA" label and corner ticks are dark marks painted *on* the key
colour and would survive the key as smudges over your face, so they
leave with the guides.

## What's in here

| file | |
|---|---|
| `shell.html` | markup, styles, safe-zone guides |
| `player.js` | the run of show, the timeline, the controls |
| `../build-reel.mjs` | inlines `src/components/scenes/*` into one file |

The scenes are **not** copied. The build reads `src/components/scenes`
verbatim and strips the module syntax, so a change to a scene reaches
the reel by rebuilding, and can't drift from what the site ships.

## Changing the video

Everything you'd want to edit is the `SHOW` array at the top of
`player.js` — one object per section:

```js
{ id: 'automation', dur: 3.8, cam: null, scene: 'automation', from: 5.4,
  text: 'above', kicker: '01 · AUTOMATION', head: 'Set up once, left running',
  say: 'Work that repeats — set up once, then left to run.' }
```

- `dur` — seconds. Section starts are derived, so changing one shifts
  everything after it and the total re-reports itself.
- `cam` — `FULL`, `HALF_B`, `HALF_T`, or `null` for no camera. The
  window *eases* between whatever two rects it finds, so any sequence
  of these works without further wiring.
- `scene` + `from` — which scene, and where to enter its own timeline.
  The scenes run 10.5–16.8s and each section shows about 3.8s, so
  `from` picks the window. Roughly `dur * 0.55` lands on the payoff.
- `say` — the spoken line, for the prompter. Deliberately not the same
  words as `head`: reading your own caption aloud is the tell of a
  video made from a script rather than by a person.

## The motion language

One rule, applied to everything: **things travel in one direction through
a mask.** Nothing fades in place.

- **Type** — every word gets its own mask (`.w`) and rises out of it on
  its own offset. It keeps going up and out on the way out, so a section
  change is one continuous move rather than a crossfade. `wordGroups`
  carries a start and a step per group: a two-word kicker and a six-word
  headline should not arrive at the same rate.
- **Scenes** — the band rises through `#sceneBox`, which is the mask,
  with a few degrees of `rotateX` easing off so it arrives through depth
  rather than up a flat plane. A slow sine keeps it breathing while it
  holds.
- **Light** — `#sceneGlow` blooms *after* the band lands, so it reads as
  the thing lighting up rather than a backdrop that was always on.
  `#sceneSheen` is one specular pass across the surface.
- **The six marks** — not decoration. Through six near-identical beats,
  "which one is this" is the one thing the frame cannot otherwise say.

All of it runs off the repository's own curves. `EASE_OUT` for arrivals,
`EASE_IO` for anything travelling across the frame — the sheen included,
because an arrival curve on a traverse spends its distance early and then
crawls.

## Why the numbers are what they are

`SAFE` is Instagram's chrome as margins — 250 top, 480 bottom, 60 left,
120 right. The bottom is the demanding one: profile row, caption, audio
and CTA all stack there. The right is where like/comment/share sit.

The run is 50s. Reels reward either 15–20s or 45–60s; the 30–40s band
has a documented mid-video retention dip. Nothing holds still for more
than four seconds.

`object-position: 50% 30%` on the video is not a taste call — a
bottom-half camera centres its subject at y1400, underneath the caption
overlay. It pulls the face up into the part of the band that survives.


## The canvas cuts

The three service cuts are a different idea from the card cuts. Nothing
appears or disappears: the whole argument is laid out once on a canvas
much larger than the frame, and the frame moves over it. A morph says
"and now, this"; a camera move says "these are in the same place", which
is the actual claim — the statistic, the situation and the fix are one
thing seen from three distances.

Each has its own camera language, and only one, so six reels do not all
move the same way:

| | |
|---|---|
| automation | a staircase — down a column of cells, across, down, in |
| data | one object at four distances — never leaves the spreadsheet |
| web | a single horizontal track — right, or in, and nothing else |

Cells are 1800x3100, which is the frame's own ratio at the zoom the wide
shots hold, so a cell framed is a cell filled. An early version laid the
canvas out like a web page — wide, short blocks — and every shot had a
void above and below it with the next block leaking in at the edge.

**Every camera position is measured off the built canvas, not chosen by
eye.** A first pass on the automation cut set them by eye and every one
was 240 to 260 canvas pixels out, which in a 9:16 frame is the
difference between a composed shot and a clipped one.

    node scripts/reel-frame.mjs web       # where the content lands
    node scripts/reel-sheet.mjs web       # → build/sheets/reel-web/

`reel-frame` reports, per beat, where the cell's readable content sits
in the frame against the margins Instagram covers, and fails if anything
is outside them. Beats marked `crop: true` in the show are deliberate
push-ins that frame part of a cell; they are reported, not judged.

It exists because two errors got through review by eye and were only
visible as arithmetic:

- a footnote pinned to a 3100-tall cell's floor lands at screen y1795 —
  355px inside the caption zone, on a line that is the *source
  attribution* for the statistic the reel opens on
- a cell padded 100 both sides reaches x1020, 60px under the like rail

Both are fixed in the web cut by putting every cell's content — kick,
body and footnote — inside one centred `.cvGrow`, and by padding the
cells 200 on the right instead of 100. **The automation and data cuts
still have both**, because they were signed off before the check
existed; `reel-frame automation` prints exactly where.

`reel-sheet` shoots every beat twice, once mid-arrival and once settled,
and tiles them. Fourteen stills side by side is how a clipped label or a
shot that holds nothing gets caught — none of which the frame-walk test
below can see, because they all render fine.

## Checking a cut

    npm run test:reels

Steps every cut through every frame at 60fps and fails on anything that
throws, any NaN reaching a style, any card whose content outgrows its
box, and any stall during real playback from the midpoint.

This exists because a cut shipped that failed halfway through on a real
machine. It had been "tested" by sampling the frame rate at a single
timestamp, which proves only that one timestamp renders.

## Why there is no burst

An earlier punch cut put a radial starburst behind the pillar words,
after a reference that uses saturated light tunnels. A starburst is
decorative maximalism whatever colour it is painted, and this studio's
position is the opposite — modern, minimal, anti-corporate. Recolouring
a firework amber still leaves a firework. It was also a canvas
repainting itself sixty times a second, which is the kind of thing that
falls over on a machine without GPU compositing. Gone on both counts.


## Recording slow

    reel-punch.html?clean=1&guides=0&speed=0.5&play=1

Halving the timeline while the renderer draws as fast as it can means a
60fps capture of a take twice as long carries **120fps of real sampling**
once it is sped back up 2x in the edit. Motion blur then has genuine
intermediate frames to blend rather than synthesised ones.

It also doubles the frame budget, which is what makes the skew possible
again. Measured on the punch cut:

| | render | effective after speed-up |
|---|---|---|
| default | 56.6fps | 57fps |
| `speed=0.5` | 59.9fps | **120fps** |
| `speed=0.5&skew=1` | 24.3fps | 50fps |
| `speed=0.25&skew=1` | 22.8fps | **95fps** |

So the live skew needs quarter speed, not half — at half it lands at 50,
under the 60 you want. Everything else is comfortable at 0.5.
