# Reference demo: the scroll story

`nabl-scroll-story.html` is the homepage, in its real chapter order, drawn in the
2026-11 brand: Manjari, the ember, amber and ice colourway, the lit ground and the
glass components. It is the working reference behind
[`../brand-guidelines.md`](../brand-guidelines.md). Where the two disagree on a
number, the guidelines win; where they disagree on how something feels, the demo
is what was approved.

It is one self-contained file. The three Manjari weights are inlined, there are no
external requests, and it opens straight from disk in any current browser.

## What to look at

Scroll it top to bottom on a laptop and on a phone. The ground changes with the
story (section 7.1 of the guidelines):

1. **Opening**: grain gradient, wisps drifting, all three colours with dark
   behind the copy.
2. **See it work** (pinned): heat builds while the problems appear, then the
   fluted glass materialises and the three fixes play one at a time, each with
   its own layout of light.
3. **What we do**: the six jobs as glass cards.
4. **How we work** (pinned): five steps; the reeds widen while the aurora rises.
5. **Cases**: problem, fix, result in ember, amber, ice.
6. **Pricing and contact**: the light settles back to a quiet grain gradient.

The **Story controls** panel, bottom right, is a demo tool and not part of the
design:

| Control | What it does |
|---|---|
| Hero ground | Swaps the opening between grain, glass and aurora |
| Scroll story | Off holds the opening ground for the whole page, for comparison |
| Motion | Off stops the drift, so a frame can be compared like for like |
| Stats | Frame rate, canvas size and the quality level |
| Colourway and type | Opens a one-page spec: the swatches, gradients, measured contrast and the type |

## Where things are in the file

Line numbers are for the committed file.

| What | Where |
|---|---|
| Fonts, inlined, with the metric overrides | the first `<style>`, top of the file |
| Colour, gradient and type tokens | `:root`, just below the fonts |
| Buttons, chips, cards, nav, journey rail | the same `<style>`, by section comment |
| The page itself | `<header class="nav">` to the footer |
| The glows' colours: three ember, two amber, three ice | `const GCOL`, line 684 |
| Where each glow sits at each point of the story | `const L`, line 702 |
| The state at each point: glass, aurora, heat, reed width | `const HEROES` and `const ST`, lines 718 and 723 |
| Scroll position to state | `layout()` and `sample(y)`, around line 788 |
| The shader: wisps and glows | `glowsL`, line 824 |
| The shader: aurora | `auroraL`, line 859 |
| The shader: fluted glass | `reedAt`, line 885, and `main`, line 890 |
| Ember-into-amber split and the ice level | `let WARM` and `let ICE`, line 956 |
| The reed widths it steps between | `const REEDS`, line 972 |
| Uploading a state to the shader | `draw(s)`, line 982 |
| The frame loop: easing, drift, pointer, adaptive quality | `frame(now)`, line 1118 |

## Lifting it into a film

The ground is a pure function of a state object and time. To use it in a film,
take the shader and `draw(s)` as they are, and instead of `sample(window.scrollY)`
interpolate between the same named states (`ST.heatPeak`, `ST.fix1`,
`ST.step4` and so on) on the film's timeline. Render with motion on, at a fixed
time step, so every frame is reproducible.

Keep dark the majority of the frame, keep the logo on a dark part of it, and keep
the colours to their meanings: ember for the problem, amber for n.abl, ice for
the AI at work.
