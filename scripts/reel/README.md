# Reel studio

A 9:16 marketing template you talk over, with the six service scenes
playing inside it and a camera window that moves between framings.

    node scripts/build-reel.mjs      # → build/reel.html

Open `build/reel.html` in a browser. No server, no build step — the
person recording with it is holding a webcam, not a terminal.

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
