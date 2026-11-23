# The full stop: the mark reel

A 13-second reel (12.9 s) that reveals n.abl's mark, the **n.**, then the
name, *n.abl agency*, and what it does, *AI automation specialists*. Cut to
music with no voice, in every social format from one timeline: 16:9, 1:1,
4:5 and 9:16.

## 1. The brief

Three parts and nothing else: the n. animates in; *n.abl agency* shows,
followed by *AI automation specialists*; an outro. With far more motion
blur, depth of field, glow and particles than the other reels, and with its
own ideas rather than borrowed ones. (A first cut followed a reference reel
of logo reveals too closely, a typed headline, close-ups of the strokes and
a pendant lamp, and was thrown away.)

## 2. The idea: the full stop holds the light

The mark (`public/brand/mark.svg`) is an n and a square full stop, and the
brand notes say the square is the signature: the round shoulder of the n is
there to play against it. So in this reel the full stop is where the energy
lives. **Everything comes out of the square and goes back into it**: light
gathers into it, it fires the n, and at the end the whole name burns back
into it and it goes off. The reel opens and closes on the full stop.

## 3. The reel

The tempo is the music's, 120.5 BPM; every move lands on its beat.

| Time | Part | What happens | Camera |
|---|---|---|---|
| 0.00 | **Gather** | Out of the dark, thousands of motes spiral in from every depth towards one point of light, faster as they near it, each a streak of its own motion; out of focus, the near and far ones open into soft discs. The point brightens and throws light shafts. | Drifts in from a low angle towards the point. |
| 1.74 | **The square** | The point pinches down into the amber square, with a small shockwave. Then a breath: the music stops for half a beat. | Settles on it. |
| 1.99 | **The n** | On the drop the square fires: a flash, a shockwave that bends the frame, an anamorphic streak. Its motes fly out in arcs and land along the n, which sets white-hot where they land, from its right foot up and over the shoulder to its left foot (2.88), and cools to cream, shedding embers. A light runs along it (3.24). | Shakes with the shot, then eases round to frame the n. and pushes in. |
| 3.98 | **n.abl** | The rest of the name ignites on the sixteenths: the a's bowl, its stem, the b's stem, its bowl, the l, each drawn in 0.3 s with a white-hot head that sheds sparks and cools behind it. | Pulls back and across to the whole name. |
| 4.98 | **agency** | *agency* falls out of the air beside the name, letter by letter, out of focus near the camera and sharpening as it lands on the plane. | |
| 5.97 | **AI automation specialists** | On the brightest part of the track a line of light draws out under the name, and *AI AUTOMATION SPECIALISTS* decodes in above it, each letter cycling through others before it settles with a flash; the line fades. A light runs across the name (7.47); the full stop glows on each beat. | Holds, drifting. |
| 9.46 | **Burn** | It all burns away from the right, the line first, then *agency*, then the name, with a hot edge eating through it; every bit turns to embers that spiral back into the square, which glows hotter as it takes them in. | Pushes in on the square. |
| 10.95 | **Out** | The square pinches and goes off: a flash, a shockwave, a streak and a burst of sparks. It cools back to the amber full stop, and the address, *nabl.agency*, falls into focus under it (11.50). | Settles; out at 12.94. |

All the words are the brand's: the name, *agency*, the address.

## 4. The look

The reel is drawn by its own WebGL renderer (`films/mark/gl.js`), one frame
per seek like every other film here, so it renders frame by frame in the
same pipeline and in every format:

- **The mark** is drawn as exact signed distance fields of the wordmark's
  own geometry (a 13-unit monoline of segments and true circles, butt-ended
  on the baseline), on a plane seen by a real perspective camera. So it is
  crisp at 4K, blurs by depth of field, glows, sets, draws itself on and
  burns away analytically.
- **The type** is distance-field glyphs made at load from the site's own
  fonts (Space Grotesk for *agency*, JetBrains Mono for the line and the
  address), so it blurs, glows and burns the same way.
- **The particles**, about 14,000, are each drawn as a capsule from where
  they were half a frame ago to where they are, so every one carries its
  own motion blur; out of focus they open into bokeh discs and dim to keep
  their light.
- **The lens**: an HDR frame with bloom down and back up a mip chain, light
  shafts from the square, an anamorphic streak and shockwaves on the hits,
  chromatic aberration, camera motion blur, a hue-preserving filmic tone
  curve (so the cream and amber stay the site's #F0E7D8 and #E9AC57, and
  only real highlights go to white) and a vignette; render.mjs adds grain.

## 5. Sound

**Music**: its own track, dark minimal tech house in D minor at 120.5 BPM,
made with Lyria RealTime (`films/mark/music/mark-1.wav`, its plan in
`music/plans/mark.json`; two more takes from the same plan are kept beside
it). The take's beat 8 (4.065 s) lands on the drop as the square fires.
- **Under the gathering** the take with its low end held back and a filter
  slowly opening.
- **A breath** of half a beat as the point becomes the square, then the
  drop and a low hit as it fires.
- **The brightest section** of the take under the line, from 5.97 s.
- **Under the burn and the end** it thins to pads and fades out over the
  last two seconds.

**Effects**, drowned under the music as in the other reels, with the dry
click on the front of every water drop: a low swell, a riser and a stream
of air as the light gathers, an implosion and a drop as it becomes the
square; an impact, shimmer and whoosh as it fires, and four drops climbing
as the n sets; a drop for each stroke of the name, rising, and a swish; a
tick for each letter of *agency*; a scan for the line of light, typing as
the letters decode and a chime as they settle; a riser, a swell and a
stream of air as it burns back into the square, then an implosion, an
impact, shimmer and a double drop as it goes off; ticks for the address.

**Mix**: the music about 1 dB over the effects; −14 LUFS integrated, true
peak below −1 dBTP on the delivered AAC.

## 6. Delivery

Rendered at twice the size: each format at its usual size (scaled down from
the large frames) and as `-4k`; H.264 High, 60 fps, AAC 256k.
