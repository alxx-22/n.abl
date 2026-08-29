# Reel studio

A 9:16 marketing template you talk over, with the six service scenes
playing inside it and a camera window that moves between framings.

    node scripts/build-reel.mjs      # → build/reel.html
                                     #   build/reel-brand.html

Two cuts off one player:

| | |
|---|---|
| `reel.html` | **Talk over it.** 50s, camera moves between full frame, top band, bottom band and absent. The six scenes play in a fixed band. |
| `reel-punch.html` | **Punch cut.** 22.6s. A typed opener with a two-tone colour turn, the three pillars as words receding through a burst, then the six services as fast cards. |
| `reel-brand.html` | **Brand cut.** 25.6s, no camera and no type outside the card. One container morphs through the mark, the three pillars and the six services. |

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
`live|key|off`, `play` starts on load. At a 1080x1920 browser source that
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


## A note on the punch cut's background

Its reference runs saturated cyan and magenta light tunnels — the one
thing the animation brief rules out by name (no neon, no SaaS blue, no
purple gradients). `punch.js` reproduces the *motion* — radial streaks
rotating and warping outward — in amber on espresso instead. If that
call is wrong, `BURST_HUES` at the top of the file is the whole change.

Performance is the reason the burst looks the way it does. Three
versions were measured at 1080x1920:

| | fps |
|---|---|
| Streaks + a full-frame radial gradient, redrawn each frame | 29 |
| Painted once into a 2208 square, moved by CSS transform | 12 |
| Streaks redrawn into a 600 backing store, core glow in CSS | 57 |

A `text-shadow: 0 0 70px` on the receding word cost a further 18fps on
its own — a blur re-rasterises at every scale — so the bloom behind the
word is `#burstCore`, which only changes opacity.
