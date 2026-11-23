/* ============================================================
   THE MARK: the full stop holds the light

   n.abl's mark is an n and a square full stop. Here the full stop is where
   the energy lives: everything comes out of it and goes back into it.

   form   in the dark, thousands of motes spiral in to one point of light;
          it pinches down into the amber square; a breath; on the drop the
          square fires and the motes it throws land along the n, which sets
          white-hot from its right foot over the shoulder to its left foot
          and cools to cream, shedding embers, with a shockwave
   name   the rest of the name ignites stroke by stroke on the sixteenths,
          each with a white-hot head shedding sparks; agency falls into
          focus beside it; then a line of light, and AI AUTOMATION
          SPECIALISTS decodes in above it
   out    it all burns away from the right into embers that spiral back
          into the square; the square takes the light, pinches, and goes
          off with a flash, a shockwave and a streak; it cools to the
          full stop, with the address under it

   Everything is drawn by the WebGL renderer in gl.js, one frame per seek:
   the mark as exact distance fields, the type as distance-field glyphs,
   the motes as motion-blurred capsules with depth of field, then bloom,
   light shafts, shockwaves and the lens. The script is films/mark/film.py;
   the brief is films/mark/SCRIPT.md.
   ============================================================ */

import { E, M, P, TL, W, H, LAND, bell, cue, h, lerp, rng, scene } from '../../film/stage.js'
import { drop, path } from '../../film/kit.js'
import { glyphAtlas, renderer, SPREAD } from './gl.js'

const B = TL.beat
const b = k => k * B                                    // the reel is choreographed on the track's own beat

/* ---------- the beats ---------- */
const tCollapse = b(3.5), tBurst = b(4)                   // the point pinches into the square; it fires, on the drop
const tName = b(8), tAbl = [0, .25, .5, .75, 1].map(k => b(8 + k))
const tAgency = b(10), tTag = b(12), tSheenN = b(6.5), tSheenL = b(15)
const tBurn = b(19), tPinch = b(21.5), tHit = b(22), tUrl = b(23.1)

/* ---------- the mark, in the wordmark's units ---------- */
const DOT = [84.5, 75.5], MC = [54.5, 51.75]
const N_LEN = 34 + 20 * Math.PI + 34
const vN = N_LEN / b(1.5)                                  // the n sets along its path in a beat and a half
// a, a's stem, b's stem, b, l: each drawn in 0.3 s
const ABL = [[2 * Math.PI * 23.75], [60.5], [76], [2 * Math.PI * 23.75], [76]].map(([l]) => ({ len: l, v: l / .3 }))
const box = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1
const ringIn = (x, y, cx, cy, r) => Math.abs(Math.hypot(x - cx, y - cy) - r) <= 6.5
const inN = (x, y) => box(x, y, 18, 48, 31, 82) || box(x, y, 58, 48, 71, 82) || (y <= 48 && ringIn(x, y, 44.5, 48, 20))
const inAbl = (x, y) => ringIn(x, y, 128.25, 51.75, 23.75) || box(x, y, 145.5, 21.5, 158.5, 82) || box(x, y, 171.5, 6, 184.5, 82) || ringIn(x, y, 201.75, 51.75, 23.75) || box(x, y, 242, 6, 255, 82)
// how far along the n a point is, from its right foot
function nS(x, y) {
  if (x >= 58 && y >= 48) return 82 - y
  if (x <= 31 && y >= 48) return 34 + 20 * Math.PI + (y - 48)
  return 34 + 20 * Math.max(0, Math.min(Math.PI, Math.atan2(-(y - 48), x - 44.5)))
}
// a point s units along stroke i of abl (its centre line), as it is drawn
function ablAt(i, s) {
  if (i === 0) { const a = -Math.PI / 2 + s / 23.75; return [128.25 + 23.75 * Math.cos(a), 51.75 + 23.75 * Math.sin(a)] }
  if (i === 3) { const a = Math.PI + s / 23.75; return [201.75 + 23.75 * Math.cos(a), 51.75 + 23.75 * Math.sin(a)] }
  const [x, top] = { 1: [152, 21.5], 2: [178, 6], 4: [248.5, 6] }[i]
  return [x, top + s]
}

/* ---------- the type ---------- */
const AG = { name: 'ag', font: '500 PXpx "Space Grotesk"', px: 128 }
const MONO = { name: 'mo', font: '500 PXpx "JetBrains Mono"', px: 80 }
const TAG = 'AI AUTOMATION SPECIALISTS', URL = 'nabl.agency'
const NOISE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&+<>/=*'
function layout(set, str, track) {                         // pen positions in atlas px, kerned by the font, plus tracking
  const cx = document.createElement('canvas').getContext('2d'); cx.font = set.font.replace('PX', set.px)
  return { xs: [...str].map((_, i) => cx.measureText(str.slice(0, i)).width + i * track * set.px), w: cx.measureText(str).width + (str.length - 1) * track * set.px }
}

function buildReel(s) {
  document.querySelector('.vignette').style.display = 'none'   // the renderer has its own lens
  const dpr = window.devicePixelRatio || 1
  const cv = h('canvas', 'k-gl', s.root); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
  const atlas = glyphAtlas([{ ...AG, chars: 'agency' }, { ...MONO, chars: TAG + NOISE + URL }])

  // the lockup: n.abl, then agency on its baseline; the line under it
  const kAg = 40 / AG.px, kMo = 15 / MONO.px, kUrl = 12.5 / MONO.px
  const ag = layout(AG, 'agency', -.01), tg = layout(MONO, TAG, .32), ul = layout(MONO, URL, .12)
  const agX = 271, right = agX + ag.w * kAg, LW = right - 18, LC = (18 + right) / 2
  const tagY = 136, tagX = LC - tg.w * kMo / 2, urlY = 112, urlX = DOT[0] - ul.w * kUrl / 2
  const blockY = 64                                        // the middle of the name and the line under it

  // the frame: the name at two thirds of the width (more in the taller formats); the n. and the end close up
  const ppuL = Math.min((LAND ? .64 : .82) * W / LW, .56 * H / 140)
  const ppuF = ppuL * M({ land: 2.2, def: 2.45 }), ppuO = ppuL * M({ land: 2.1, def: 2.3 })
  const F = ppuL * 1000 * dpr
  const D = ppu => ppuL * 1000 / ppu                       // the camera's distance for a scale
  // [t, x, y, distance, yaw, pitch, roll]
  const keys = path([
    [0, DOT[0], DOT[1], D(ppuF) * 1.5, 14, -8, -2],
    [tCollapse, DOT[0], DOT[1], D(ppuF) * 1.04, 3, -2, 0],
    [tBurst, DOT[0] - 4, DOT[1] - 3, D(ppuF), 0, 0, 0],
    [tBurst + .9, MC[0], MC[1], D(ppuF) * 1.02, -5, 2, 0],
    [tName - .05, MC[0] + 4, MC[1], D(ppuF) * .93, -8, 3, 0],
    [tName + 1.1, LC, blockY, D(ppuL) * 1.03, 3, -1, 0],
    [tTag + .6, LC, blockY, D(ppuL), 0, 0, 0],
    [tBurn, LC, blockY, D(ppuL) * .95, -4, 1.5, 0],
    [tPinch, DOT[0], DOT[1] + 6, D(ppuO) * 1.08, 0, 0, 0],
    [tHit + .4, DOT[0], DOT[1] + 9, D(ppuO), 0, 0, 0],
    [TL.duration, DOT[0], DOT[1] + 10, D(ppuO) * .95, 1.5, -1, 0],
  ])
  const shake = t => 7 * bell(t, tBurst, tBurst + .02, tBurst + .5) + 9 * bell(t, tHit, tHit + .02, tHit + .6) + 2 * bell(t, tCollapse, tCollapse + .02, tCollapse + .25)
  function camera(t) {
    const [x, y, dist, yaw, pitch, roll] = keys(t), sk = shake(t) / ppuL
    const tx = x + Math.sin(t * 93) * sk, ty = y + Math.cos(t * 71) * sk
    const r = Math.PI / 180, cy = Math.cos(yaw * r), sy = Math.sin(yaw * r), cp = Math.cos(pitch * r), spp = Math.sin(pitch * r), cr = Math.cos(roll * r), sr = Math.sin(roll * r)
    // R = Ry(yaw) Rx(pitch) Rz(roll), column-major
    const Ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy], Rx = [1, 0, 0, 0, cp, spp, 0, -spp, cp], Rz = [cr, sr, 0, -sr, cr, 0, 0, 0, 1]
    const mul = (A, Bm) => { const o = []; for (let c = 0; c < 3; c++) for (let rr = 0; rr < 3; rr++) o[c * 3 + rr] = A[rr] * Bm[c * 3] + A[3 + rr] * Bm[c * 3 + 1] + A[6 + rr] * Bm[c * 3 + 2]; return o }
    const R = mul(mul(Ry, Rx), Rz)
    const pos = [tx + R[6] * dist, ty + R[7] * dist, R[8] * dist]
    return { cx: cv.width / 2, cy: cv.height / 2, f: F, pos, rot: new Float32Array(R), dist, aperture: 30 * dpr, focus: dist, dpr }
  }
  const toScreen = (c, p) => {                              // world → device px, for the lights and the shocks
    const q = [0, 1, 2].map(i => c.rot[i * 3] * (p[0] - c.pos[0]) + c.rot[i * 3 + 1] * (p[1] - c.pos[1]) + c.rot[i * 3 + 2] * (p[2] - c.pos[2]))
    return [c.cx + c.f * q[0] / -q[2], c.cy + c.f * q[1] / -q[2]]
  }

  /* ---------- the motes ---------- */
  const r = rng(2026), parts = []
  const add = (kind, s1, s2, bright, a1, a2, a3) => parts.push(kind, s1, s2, bright, ...a1, ...a2, ...a3)
  const rr = (a, z) => a + (z - a) * r()
  const sample = (inside, x0, y0, x1, y1) => { for (;;) { const x = rr(x0, x1), y = rr(y0, y1); if (inside(x, y)) return [x, y] } }
  // dust at every depth, drifting
  for (let i = 0; i < 560; i++) add(0, r(), r(), rr(.1, .42), [rr(-1300, 1500), rr(-950, 1050), rr(-2400, 230), 0], [0, 0, 0, 0], [0, 0, 0, rr(.5, 1.7)])
  // the gathering: from all round, spiralling into the point
  for (let i = 0; i < 2700; i++) {
    const th = rr(0, 6.283), rad = rr(140, 950) * Math.pow(r(), .35)
    const st = [DOT[0] + rad * Math.cos(th), DOT[1] + rad * Math.sin(th) * .75, rr(-900, 90)]
    const tb = rr(.02, 1.05), ta = Math.max(tb + .55, rr(.85, tCollapse - .03))
    add(1, r(), r(), rr(.8, 2), [...st, tb], [DOT[0], DOT[1], 0, Math.min(ta, tCollapse - .01)], [(r() < .88 ? 1 : -1) * rr(2.4, 6), 0, 0, rr(.3, .75)])
  }
  // thrown from the square on the drop to land along the n, from its right foot round to its left
  const lands = []
  for (let i = 0; i < 3600; i++) {
    const [x, y] = sample(inN, 18, 21, 71, 82), s = nS(x, y)
    const ta = tBurst + .14 + s / vN + rr(-.02, .02), td = Math.max(tBurst, ta - rr(.2, .4))
    const st = [DOT[0] + rr(-4, 4), DOT[1] + rr(-4, 4), 0], mid = [(st[0] + x) / 2, (st[1] + y) / 2]
    const nx = -(y - st[1]), ny = x - st[0], nl = Math.hypot(nx, ny) || 1, bend = rr(-45, 45)
    add(2, r(), r(), rr(.5, 1.3), [...st, td], [x, y, 0, ta], [mid[0] + nx / nl * bend, mid[1] + ny / nl * bend - rr(0, 40), rr(-70, 160), rr(.3, .65)])
    lands.push([x, y, ta])
  }
  // embers off the setting n
  for (let i = 0; i < 1500; i++) {
    const [x, y, ta] = lands[Math.floor(r() * lands.length)], a = rr(0, 6.283), sp = rr(15, 130)
    add(3, r(), r(), rr(1.4, 3.2), [x, y, rr(-3, 3), ta + rr(0, .05)], [Math.cos(a) * sp, Math.sin(a) * sp - rr(10, 50), rr(-60, 80), rr(.5, 1.4)], [0, 0, 0, rr(.18, .42)])
  }
  // sparks off the head of each stroke of abl as it is drawn
  ABL.forEach((st, i) => {
    for (let k = 0; k < 240; k++) {
      const s = rr(0, st.len), [x, y] = ablAt(i, s), a = rr(0, 6.283), sp = rr(20, 120)
      add(3, r(), r(), rr(1.8, 3.6), [x + rr(-5, 5), y + rr(-5, 5), 0, tAbl[i] + s / st.v], [Math.cos(a) * sp, Math.sin(a) * sp - 20, rr(-40, 90), rr(.3, .9)], [0, 0, 0, rr(.16, .38)])
    }
  })
  // burning away: the name and the type go to embers that spiral into the square
  const burnX0 = 272, burnX1 = -40, tB0 = tBurn + b(.6), tB1 = tBurn + b(3)
  const burnAt = x => tB0 + (burnX0 - x) / (burnX0 - burnX1) * (tB1 - tB0)
  const glyphBurn = (k, n, t0) => t0 + k / n * b(1.2)       // the type burns first, from its right end (k counts from there)
  const into = (x, y, z, tb) => add(1, r(), r(), rr(.8, 1.8), [x, y, z, tb], [DOT[0], DOT[1], 0, Math.max(tb + .5, tPinch - rr(0, .3))], [(r() < .85 ? -1 : 1) * rr(1.6, 3.6), 0, 0, rr(.28, .6)])
  for (let i = 0; i < 2600; i++) { const [x, y] = sample((x, y) => inN(x, y) || inAbl(x, y), 18, 6, 255, 82); into(x, y, rr(-2, 2), burnAt(x) + rr(-.03, .06)) }
  for (let i = 0; i < 700; i++) { const k = Math.floor(r() * 6); into(agX + (ag.xs[k] + rr(0, 70)) * kAg, rr(62, 82), 0, glyphBurn(5 - k, 6, tBurn) + .25) }
  for (let i = 0; i < 900; i++) { const k = Math.floor(r() * TAG.length); if (TAG[k] === ' ') continue; into(tagX + (tg.xs[k] + rr(0, 48)) * kMo, rr(tagY - 9, tagY), 0, glyphBurn(TAG.length - 1 - k, TAG.length, tBurn) + .1) }
  // and the flash: the square goes off
  for (let i = 0; i < 1000; i++) {
    const th = rr(0, 6.283), ph = Math.acos(rr(-1, 1)), sp = rr(60, 460) * Math.pow(r(), .5)
    add(3, r(), r(), rr(1.8, 4), [DOT[0], DOT[1], 0, tHit + rr(0, .04)], [sp * Math.sin(ph) * Math.cos(th), sp * Math.sin(ph) * Math.sin(th), sp * Math.cos(ph) * .6, rr(.6, 1.7)], [0, 0, 0, rr(.18, .48)])
  }
  const draw = renderer(cv, { atlas, particles: new Float32Array(parts) })

  /* ---------- the glyphs, each frame ---------- */
  const G = new Float32Array(20 * 256)
  const hsh = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
  function glyph(n, set, ch, x, y, z, k, a, blur, col, glow, burn, heat, seed) {
    const c = atlas.map[set.name + ch]; if (!c) return n
    G.set([x, y, z, k, c.x, c.y, c.w, c.h, c.ox, c.oy, a, blur, col[0], col[1], col[2], glow, burn, heat, seed, 0], n * 20)
    return n + 1
  }
  const CREAM = [.74, .68, .58], AMBER = [1.05, .52, .13], URLC = [.62, .57, .5]
  function glyphs(t) {
    let n = 0
    // agency: each letter falls out of the air into focus on the plane, and burns away with the rest
    ;[...'agency'].forEach((ch, i) => {
      const tl = tAgency + i * .055, p = P(t, tl - .5, tl, E.out)
      if (p <= 0) return
      const bt = glyphBurn(5 - i, 6, tBurn) + .25
      n = glyph(n, AG, ch, agX + ag.xs[i] * kAg, 82 - (1 - p) * 8, (1 - p) * 380, kAg, Math.min(1, p * 2.5), 0, CREAM, .12, t > bt - .3 ? P(t, bt - .3, bt + .25) : -1, .55 * bell(t, tl, tl + .03, tl + .4), i)
    })
    // the line: decoding in, a letter at a time, each with a flash as it settles
    ;[...TAG].forEach((ch, i) => {
      if (ch === ' ') return
      const ts = tTag + .18 + i * .018, tf = tTag + .3 + i * .036
      if (t < ts) return
      const real = t >= tf, gl = real ? ch : NOISE[Math.floor(hsh(i * 13 + Math.floor(t * 24)) * NOISE.length)]
      const bt = glyphBurn(TAG.length - 1 - i, TAG.length, tBurn) + .1
      n = glyph(n, MONO, gl, tagX + tg.xs[i] * kMo, tagY, 0, kMo, real ? 1 : .55 * P(t, ts, ts + .08), real ? 0 : 1.5, AMBER, .3, t > bt - .3 ? P(t, bt - .3, bt + .25) : -1, real ? .9 * bell(t, tf, tf + .02, tf + .3) : .25, i + 40)
    })
    // the address, falling into focus under the full stop
    ;[...URL].forEach((ch, i) => {
      const tl = tUrl + i * .04, p = P(t, tl - .45, tl, E.out)
      if (p <= 0) return
      n = glyph(n, MONO, ch, urlX + ul.xs[i] * kUrl, urlY - (1 - p) * 4, (1 - p) * 260, kUrl, Math.min(1, p * 2.5), 0, URLC, .08, -1, .3 * bell(t, tl, tl + .03, tl + .35), i + 80)
    })
    return G.subarray(0, n * 20)
  }

  /* ---------- the sound ---------- */
  cue('tension', .05, { d: tCollapse - .1, v: .45 })
  cue('riser', tCollapse, { d: 1.6 })
  cue('whoosh', 1.25, { d: .9, v: .45 })                    // the motes stream in
  cue('implode', tCollapse + .02, { d: .3 })                // the point pinches into the square
  drop(tCollapse, 5, { wet: .25, v: .5 })
  cue('m_gap', tCollapse + .03, { d: tBurst - tCollapse - .03 })
  cue('m_drop', tBurst)                                     // it fires
  cue('impact', tBurst + .005, { v: 1 })
  cue('shimmer', tBurst + .03, { d: 2.6, v: .5 })
  cue('whoosh', tBurst + .05, { d: .45, v: .75 })
  ;[0, 1, 2, 3].forEach(i => drop(tBurst + .16 + i * N_LEN / 4 / vN, 1 + i, { wet: .35, v: .38 }))   // the n setting, foot to foot
  cue('shimmer', tSheenN, { d: 1.1, v: .22 })
  cue('whoosh', tName + .1, { d: .6, v: .45 })              // out to the name
  tAbl.forEach((ta, i) => { drop(ta, 1 + i, { wet: .3, v: .42 }); cue('swish', ta + .05, { v: .22 }) })
  ;[...'agency'].forEach((_, i) => cue('tick', tAgency + i * .055, { v: .4 }))
  cue('scan', tTag, { d: .45 })
  cue('type', tTag + .3, { d: TAG.length * .036, v: .32 })
  cue('confirm', tTag + .3 + TAG.length * .036, { n: 2, deg: 2, v: .38 })
  cue('shimmer', tSheenL, { d: 1.3, v: .25 })
  cue('riser', tPinch, { d: 1.9 })                          // it burns away into the square
  cue('whoosh', tB0 + .3, { d: 1.2, v: .55 })
  cue('tension', tBurn + .2, { d: tHit - tBurn - .2, v: .35 })
  cue('implode', tHit, { d: .45 })
  cue('impact', tHit + .005, { v: 1 })                      // and goes off
  cue('shimmer', tHit + .03, { d: 2.4, v: .55 })
  drop(tHit, 5, { n: 2, step: 3, gap: .06, wet: .2, v: .65 })
  ;[0, 3, 6, 10].forEach(i => cue('tick', tUrl + i * .04, { v: .28 }))

  /* ---------- the frame ---------- */
  const shock = (c, at, t, size, str, dur) => {
    const a = t - at; if (a < 0 || a > dur) return null
    const [x, y] = toScreen(c, [DOT[0], DOT[1], 0]), u = a / dur
    return [x / cv.width, 1 - y / cv.height, size * (1 - Math.pow(1 - u, 2.4)) * cv.height, str * (1 - u) * (1 - u) * dpr]
  }
  return t => {
    const c = camera(t), cp = camera(t - .5 / 60)
    const sheen = t < tName ? lerp(-90, 220, P(t, tSheenN, tSheenN + .9, E.io)) : lerp(-90, 420, P(t, tSheenL, tSheenL + 1.1, E.io))
    // the square: born from the point, firing, breathing on the beat, taking the light back, going off
    const born = P(t, tCollapse - .02, tCollapse + .16, E.back)
    const beatPulse = t > tName + 1 && t < tBurn ? Math.exp(-((t - tBurst) % B) / .12) : 0
    const fill = P(t, tB0, tPinch, E.in2)
    const dotScale = t < tBurst ? lerp(.2, 1, born) * (1 + .12 * bell(t, tCollapse, tCollapse + .05, tBurst, E.out)) : lerp(1, .62, P(t, tPinch, tHit, E.in2)) * (1 + .5 * bell(t, tHit, tHit + .03, tHit + .5))
    const dotHeat = Math.max(.8 * (1 - P(t, tCollapse, tBurst + .3)), bell(t, tBurst - .02, tBurst, tBurst + .4) * .7, fill * .6 * (1 - P(t, tHit, tHit + .9)) + .7 * bell(t, tHit - .03, tHit, tHit + .9))
    const at = toScreen(c, [DOT[0], DOT[1], 0])
    const coreI = P(t, .15, tCollapse, E.in2) * (1 - P(t, tCollapse - .02, tCollapse + .06))
    const s0 = toScreen(c, [MC[0], MC[1], 0]), s1 = toScreen(cp, [MC[0], MC[1], 0])
    const mbScale = 1 + 2.5 * bell(t, tPinch - .3, tPinch, tHit)
    draw({
      t, cam: c, shutter: .5 / 60,
      frontN: (t - tBurst - .14) * vN, heatN: .55 * vN,
      frontAbl: tAbl.map((ta, i) => (t - ta) * ABL[i].v), speedAbl: ABL.map(a => a.v),
      dot: [t >= tCollapse - .02 ? 1 : 0, dotScale, Math.min(1, dotHeat), beatPulse],
      line: [LC - tg.w * kMo / 2 * P(t, tTag, tTag + .28, E.out), LC + tg.w * kMo / 2 * P(t, tTag, tTag + .28, E.out), tagY + 6, 2.2 * P(t, tTag - .01, tTag + .05) * (1 - P(t, tTag + .3, tTag + 1.3, E.io))],
      sheen, burn: t > tB0 - .1 ? lerp(burnX0 + 20, burnX1 - 30, P(t, tB0, tB1, E.lin)) : 1e4,
      core: [DOT[0], DOT[1], 0], coreI,
      haze: [t < tName ? MC[0] : LC, t < tName ? MC[1] : blockY, .35 + .65 * P(t, tBurst - .1, tBurst + .6)],
      glyphs: glyphs(t), spread: SPREAD,
      dust: P(t, .1, 1.1) * (1 - .4 * P(t, tHit, tHit + 1)),
      threshold: 1.3, bloom: .65 + .2 * bell(t, tBurst, tBurst + .03, tBurst + .7) + .25 * bell(t, tHit, tHit + .03, tHit + .9),
      rays: .4 * P(t, .3, tCollapse, E.in2) * (1 - P(t, tBurst + .2, tBurst + 1.4)) + .3 * bell(t, tPinch - .4, tHit, tHit + 1),
      rayAt: [at[0] / cv.width, 1 - at[1] / cv.height],
      streak: .55 * bell(t, tBurst, tBurst + .02, tBurst + .7) + .8 * bell(t, tHit, tHit + .02, tHit + 1.1),
      shocks: [shock(c, tCollapse, t, .35, 14, .5), shock(c, tBurst, t, 1.1, 46, 1.1), shock(c, tHit, t, 1.3, 56, 1.3)].filter(Boolean),
      shockW: 46 * dpr,
      ca: .0018 + .004 * bell(t, tBurst, tBurst + .02, tBurst + .5) + .005 * bell(t, tHit, tHit + .02, tHit + .7),
      exposure: 1 + .4 * bell(t, tBurst, tBurst + .015, tBurst + .25) + .45 * bell(t, tHit, tHit + .015, tHit + .3) + .15 * bell(t, tCollapse, tCollapse + .02, tCollapse + .2),
      mb: [(s0[0] - s1[0]) / cv.width * mbScale, -(s0[1] - s1[1]) / cv.height * mbScale],
      fade: P(t, 0, .35) * (1 - P(t, TL.duration - .5, TL.duration, E.in2)),
    })
  }
}

export default function setup() {
  scene(['form', 'name', 'out'], buildReel)
  // the ground is all the renderer's own: the stage's blooms stay dark
  const ground = [[0, .5, .5, 0, .5, .5, 0, 0], [TL.duration, .5, .5, 0, .5, .5, 0, 0]]
  return { ground, bug: ['out', 'out'] }
}
