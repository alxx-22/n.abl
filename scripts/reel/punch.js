/* ============================================================
   PUNCH — the typewriter opener and the receding word.

   Two moves lifted from the reference, and one deliberately not.

   The typewriter: characters land one at a time behind a blinking
   caret, and the sentence turns colour partway through so the claim
   separates itself from the setup without a second line of type.

   The receding word: it starts larger than the frame and shrinks the
   whole time it is on screen, travelling away from the viewer rather
   than arriving at them. That direction is the whole effect — a word
   that scales up reads as emphasis, a word that scales down reads as
   speed.

   Not lifted: the background. The reference runs saturated cyan and
   magenta light tunnels, which is the one thing the animation brief
   rules out by name. The burst below is the same *motion* — radial
   streaks rotating and warping outward — in the studio's own amber on
   espresso. Swap BURST_HUES if that call is wrong.
   ============================================================ */

const BURST_HUES = [
  'rgba(233,172,87,',    // amber-400
  'rgba(248,217,164,',   // amber-200
  'rgba(240,231,216,',   // cream
]

/* Fixed at construction so the pattern is identical on every replay —
   a burst that reshuffles each time cannot be matched across takes. */
const STREAKS = Array.from({ length: 76 }, (_, i) => {
  const r = Math.sin(i * 12.9898) * 43758.5453
  const rnd = (n) => Math.abs((r * n) % 1)
  return {
    ang: (i / 76) * Math.PI * 2 + rnd(3) * 0.32,
    r0: 0.10 + rnd(7) * 0.34,
    len: 0.06 + rnd(11) * 0.30,
    w: 1 + rnd(13) * 3.4,
    hue: BURST_HUES[i % BURST_HUES.length],
    a: 0.14 + rnd(17) * 0.5,
    spin: rnd(19) < 0.5 ? 1 : -1,
  }
})

/* Two approaches were measured before this one.

   Redrawing 108 strokes AND a full-frame radial gradient every frame:
   29fps — the gradient fill over 1080x1920 was the cost, not the
   strokes. Painting once into a 2208 square and moving it with a CSS
   transform instead: 12fps, because compositing a rotated multi-megabyte
   layer every frame is worse than drawing into a small one.

   So: the core glow is a CSS radial-gradient that only changes opacity,
   and the streaks are drawn per frame into a canvas sized to the width
   rather than the diagonal, with the rotation baked into the geometry
   so the element itself never transforms.

   The backing store is then half the displayed size. Soft radial streaks
   survive that with nothing visible lost, and it quarters the per-frame
   fill: 33fps at 1200 square, 55+ at 600 shown at 1200. */
const BURST_SIZE = 600

function drawBurst(ctx, lt, power) {
  ctx.clearRect(0, 0, BURST_SIZE, BURST_SIZE)
  if (power <= 0.004) return

  const R = BURST_SIZE / 2
  const spin = lt * 0.19
  const warp = 1 + lt * 0.26
  ctx.lineCap = 'round'

  for (const s of STREAKS) {
    const a = s.ang + spin * s.spin
    const r0 = s.r0 * R * warp
    if (r0 > R * 1.42) continue
    const r1 = (s.r0 + s.len) * R * warp
    ctx.strokeStyle = `${s.hue}${(s.a * power).toFixed(3)})`
    ctx.lineWidth = s.w * 0.5
    ctx.beginPath()
    ctx.moveTo(R + Math.cos(a) * r0, R + Math.sin(a) * r0)
    ctx.lineTo(R + Math.cos(a) * r1, R + Math.sin(a) * r1)
    ctx.stroke()
  }
}

function moveCore(core, lt, power) {
  core.style.opacity = (power * 0.9).toFixed(3)
  if (power > 0.004) core.style.transform = `translate(-50%,-50%) scale(${(1 + lt * 0.22).toFixed(4)})`
}

/* ------------------------------------------------------------------
   Typewriter. `head` is the sentence; `turn` is the character index
   where it changes colour.
   ------------------------------------------------------------------ */
function drawTypewriter(el, lt, s) {
  const chars = s.head.length
  const start = s.at ?? 0.25
  const rate = s.rate ?? 0.042            // seconds per character
  const n = clamp(Math.floor((lt - start) / rate), 0, chars)

  const turn = s.turn ?? chars
  const lead = s.head.slice(0, Math.min(n, turn))
  const rest = n > turn ? s.head.slice(turn, n) : ''

  /* Only rewritten when the count changes: this runs every frame. */
  if (el.dataset.n !== String(n)) {
    el.dataset.n = String(n)
    el.querySelector('.twLead').textContent = lead
    el.querySelector('.twRest').textContent = rest
  }

  /* The caret blinks only once typing has stopped — a caret that
     blinks mid-word looks like a dropped frame. */
  const done = n >= chars
  const caret = el.querySelector('.twCaret')
  caret.style.opacity = done
    ? (Math.floor((lt - start - chars * rate) * 2) % 2 ? '0' : '1')
    : '1'
}

/* ------------------------------------------------------------------
   The receding word. Starts past the frame edge and shrinks the whole
   time, so the shot reads as travel rather than as emphasis.
   ------------------------------------------------------------------ */
function drawWord(el, lt, s) {
  const p = seg(lt, 0, s.dur, LINEAR)
  const scale = lerp(s.from ?? 2.35, s.to ?? 0.72, EASE_IO(p))
  const inP = seg(lt, 0, 0.26, EASE_OUT)
  const outP = seg(lt, s.dur - 0.42, s.dur, EASE)

  el.style.transform = `scale(${scale.toFixed(4)})`
  el.style.opacity = ((inP - outP) * lerp(1, 0.55, p)).toFixed(3)
  /* Letter-spacing opens as it recedes, which is what stops a shrinking
     word from reading as a word that is simply getting smaller. */
  el.style.letterSpacing = `${lerp(-0.02, 0.14, p).toFixed(4)}em`
}
