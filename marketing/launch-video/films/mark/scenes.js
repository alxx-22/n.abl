/* ============================================================
   THE MARK: n.abl's mark, the n and its square full stop, in 13 seconds

   The mark is one 13-unit stroke and a 13-unit square, so the square,
   dragged along the n's path, draws the n exactly. The reel is that:

   line   on a cream page the site's headline types out behind a square
          amber caret, AI, built into your business, and the caret comes
          to rest as its full stop; the camera dives into it
   write  on the drop, close up on a dark stage, the full stop draws the n:
          up the stem, over the shoulder, down the other stem, the camera
          turning with it so it always runs up the frame, the stroke hot
          behind it and cooling to cream; at the foot it flips over into
          its place as the camera slams back, spinning, and in the breath
          before the hit the whole mark arrives
   light  a pendant lamp swings in from above, clicks on, and its beam
          sweeps the mark back and forth, lighting it gold where it lands,
          until it hangs still over it
   name   under the lamp the rest of the name draws in round the mark, and
          the address
   The script is films/mark/film.py; the brief and the study of the
   reference are films/mark/SCRIPT.md.
   ============================================================ */

import { E, M, P, TL, H, WORDMARK, bell, cue, h, lerp, put, scene, sceneById, vis } from '../../film/stage.js'
import { AMB, Z0, blurIn, bokeh, drop, lens, path, widen } from '../../film/kit.js'

const B = TL.beat
const beat = k => k * B                                   // the reel is choreographed on the track's own beat

/* ---------- the mark, in its own units (public/brand/mark.svg) ---------- */
const N_D = 'M24.5 82 L24.5 48 A20 20 0 0 1 64.5 48 L64.5 82'
const STEM = 34, ARC = 20 * Math.PI, LEN = STEM + ARC + STEM
const MC = [54.5, 51.75]                                   // the middle of the mark, the n and its full stop
const DOT = [84.5, 75.5]                                   // the full stop's centre
/* the point s units along the n, and the way it runs there (radians, y down) */
function along(s) {
  s = Math.min(LEN, Math.max(0, s))
  if (s <= STEM) return [24.5, 82 - s, -Math.PI / 2]
  if (s <= STEM + ARC) { const f = Math.PI + (s - STEM) / 20; return [44.5 + 20 * Math.cos(f), 48 + 20 * Math.sin(f), f - 1.5 * Math.PI] }
  return [64.5, 48 + (s - STEM - ARC), Math.PI / 2]
}
/* the way it runs, averaged over a stretch, so the camera turns into the shoulder rather than snapping */
function heading(s, w = 9) { let a = 0; for (let i = -4; i <= 4; i++) a += along(s + i * w / 4)[2]; return a / 9 }

/* point the camera ([x, y, z, rx, ry, rz, sc] at t and a frame later) and
   smear the frame along the world's motion across it, in screen axes: the
   camera turns, so the world's motion is turned with it */
function aim(s, v, w, shake = 0, t = 0) {
  const [x, y, z, rx, ry, rz, sc] = v
  const sx = shake ? Math.sin(t * 91) * shake : 0, sy = shake ? Math.cos(t * 77) * shake : 0
  s.cam.style.transform = `translateZ(${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${(sc * Z0).toFixed(5)}) translate3d(${(-x + sx).toFixed(1)}px,${(-y + sy).toFixed(1)}px,0)`
  const a = w[5] * Math.PI / 180, k = w[6] * Z0 * (1 + w[2] / 1800)
  const dx0 = (x - w[0]) * k, dy0 = (y - w[1]) * k
  const dx = dx0 * Math.cos(a) - dy0 * Math.sin(a), dy = dx0 * Math.sin(a) + dy0 * Math.cos(a)
  const smear = d => Math.min(40, Math.max(0, Math.abs(d) - 8) * .6)
  return { mbX: smear(dx), mbY: smear(dy), zoom: Math.abs(Math.log(w[6] / sc)) }
}

/* ============================================================
   LINE: the headline types out behind a square caret, which comes to rest
   as its full stop; the camera dives into it.
   ============================================================ */
const K = 26                                              // px to a unit, close up: the nib is 338 px
const NIB0 = .9                                           // the camera's scale as the close-up opens
const LINES = M({ land: ['AI, built into your business'], def: ['AI, built into', 'your business'] })
function buildLine(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const page = h('div', 'layer k-page'); s.root.insertBefore(page, s.rig)
  const line = h('div', 'k-line', s.cam)
  line.style.fontSize = M({ land: 116, sq: 104, tall: 96, port: 90 }) + 'px'   // the taller frames are scaled up (Z0)
  const chars = []
  LINES.forEach((txt, li) => {
    const ln = h('div', 'ln', line)
    ;[...txt].forEach(c => chars.push(h('span', 'c', ln, c === ' ' ? '&nbsp;' : c)))
    if (li === LINES.length - 1) h('span', 'stop', ln)
  })
  const stop = line.querySelector('.stop')
  const cur = h('div', 'k-cur', s.cam)
  // each word starts on an eighth note, its letters typed quickly after
  const tType = t0 + beat(.75), tStop = t0 + beat(3), tDive = t0 + beat(3.4)
  const at = []                                            // when each letter is typed
  let word = 0, nth = 0
  chars.forEach((c, i) => {
    if (c.textContent === '\u00a0') { word++; nth = 0; at[i] = tType + word * beat(.5) - .01; return }
    at[i] = tType + word * beat(.5) + nth++ * .032
  })
  cue('tick', t0 + .02, { v: .5 }); cue('tick', t0 + beat(.5), { v: .35 })        // the caret blinks
  chars.forEach((c, i) => { if (c.textContent !== ' ') cue('key', at[i], { v: .7 }) })
  drop(tStop, 3, { wet: .2, v: .6 })                       // and comes to rest as the full stop
  cue('riser', t1, { d: beat(1.6) })
  cue('whoosh', t1 - .02, { d: .45, v: .7 })               // the dive

  let L = null, cam = null
  function layout() {
    // where the caret sits after each letter, and where the full stop sits, from the middle of the line
    const lw = line.offsetWidth, lh = line.offsetHeight, fs = parseFloat(line.style.fontSize)
    const sz = stop.offsetWidth, lns = [...line.children], last = lns[lns.length - 1]
    const base = ln => ln.offsetTop + (stop.offsetTop + stop.offsetHeight - last.offsetTop)   // a line's baseline
    const gap = .08 * fs + sz / 2
    const pos = chars.map(c => [c.offsetLeft + c.offsetWidth + gap - lw / 2, base(c.parentNode) - sz / 2 - lh / 2])
    const home = [chars[0].offsetLeft + sz / 2 - lw / 2, base(lns[0]) - sz / 2 - lh / 2]
    const end = [stop.offsetLeft + sz / 2 - lw / 2, stop.offsetTop + sz / 2 - lh / 2]
    L = { pos, home, end, sz, dive: 13 * K * NIB0 / sz }    // the dive ends with the full stop as big as the nib it becomes
    cam = path([
      [t0, 0, 10, 0, 0, 0, 0, 1],
      [tStop, end[0] * .12, 0, 30, 0, 0, 0, 1],
      [tDive, end[0] * .2, end[1] * .2, 60, 0, 0, 0, 1],
    ])
  }

  return t => {
    if (!cam) layout()
    // the caret: blinking at the start of the line, then riding the end of what is typed, then the full stop
    let n = -1; chars.forEach((c, i) => { const on = t >= at[i]; vis(c, on ? 1 : 0); if (on) n = i })
    const p = t >= tStop ? L.end : n < 0 ? L.home : L.pos[n]
    const blink = t < tType ? (Math.floor((t - t0) / beat(.5)) % 2 === 0 ? 1 : 0) : 1
    const land = bell(t, tStop, tStop + .05, tStop + .3)
    // the camera: a slow push, then the dive, accelerating into the full stop until it fills the frame
    // (the full stop's offset from the middle of the frame shrinks to nothing as it grows, so it is dead
    // centre, and as big as the nib, on the cut)
    const view = tt => {
      const c = cam(tt), u = P(tt, tDive, t1, E.in3), k = Math.exp(lerp(0, Math.log(L.dive), u)), m = 1 - E.io(P(tt, tDive, t1 - .03))
      return [L.end[0] - (L.end[0] - c[0]) * m / k, L.end[1] - (L.end[1] - c[1]) * m / k, c[2] * (1 - u), 0, 0, 0, k]
    }
    const v = view(t), w = view(t + 1 / 60)
    put(line, { o: 1 - P(t, tDive + .12, t1 - .04), blur: P(t, tDive, t1) * 10 })
    put(cur, { x: p[0], y: p[1] - land * 6, s: 1 + .25 * land, o: blink })
    cur.style.width = cur.style.height = L.sz + 'px'
    page.style.opacity = (1 - P(t, t1 - .034, t1)).toFixed(3)   // the page holds to the cut, then the dark
    const mb = aim(s, v, w)
    lens(s, { blur: Math.min(8, mb.zoom * 40) * (1 - P(t, t1 - .1, t1)) })
  }
}

/* ============================================================
   WRITE: close up, the full stop draws the n. The camera rides with it,
   turning so it always runs up the frame; then it flips into its place as
   the camera slams back to the whole mark.
   ============================================================ */
const K2 = M({ land: 4.2, def: 3.8 })                     // px to a unit, the whole mark
function buildWrite(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const specks = bokeh(s, 31, { n: 54, w: 5200, hgt: 5000 })
  const glow = h('div', 'k-glow', s.cam)
  const box = h('div', 'k-n', s.cam, `<svg width="${104 * K}" height="${100 * K}" viewBox="0 0 104 100" style="overflow:visible">
    <defs>
      <filter id="kHot" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter>
      <filter id="kHalo" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="4"/></filter>
    </defs>
    <path class="ink" d="${N_D}" pathLength="1"/>
    <g filter="url(#kHot)">${[0, 1, 2].map(i => `<path class="hot" d="${N_D}" pathLength="${LEN.toFixed(4)}"/>`).join('')}</g>
    <rect class="halo" x="-6.5" y="-6.5" width="13" height="13" filter="url(#kHalo)"/>
    <rect class="nib" x="-6.5" y="-6.5" width="13" height="13"/>
  </svg>`)
  put(box, { x: (52 - MC[0]) * K, y: (50 - MC[1]) * K })
  const ink = box.querySelector('.ink'), hots = [...box.querySelectorAll('.hot')], halo = box.querySelector('.halo'), nib = box.querySelector('.nib')
  const HOT = [[12, .8], [26, .5], [48, .25]]              // the stroke behind the nib, hot and cooling: [length, strength]

  const tArc = t0 + beat(1.5), tDown = t0 + beat(4.5), tEnd = t0 + beat(6)
  const tPull = t0 + beat(6.25), tHop = t0 + beat(6.5), tLand = t0 + beat(7.75)
  const run = path([[t0, 0], [tArc, STEM], [tDown, STEM + ARC], [tEnd, LEN]])   // from rest to rest, smoothly
  const sAt = t => Math.min(LEN, Math.max(0, run(t)[0]))
  const sEnd = K2 / K
  cue('m_drop', t0)
  cue('impact', t0 + .01, { v: .45 })
  cue('draw', t0 + .05, { d: tEnd - t0 })                   // the full stop drawing
  drop(tArc, 2, { wet: .4, v: .45 }); drop(tDown, 4, { wet: .4, v: .45 })   // into the shoulder, out of it
  drop(tEnd, 1, { n: 2, step: 3, gap: .06, wet: .3, v: .55 }) // the foot
  cue('flip', tHop + .05, { v: .45 })                        // it flips over
  cue('riser', t1 - beat(.75), { d: beat(2.5) })
  cue('m_gap', t1 - beat(.75), { d: beat(.75) })             // a breath before the mark
  cue('whoosh', t1 - .03, { d: .7, v: .9 })                  // the camera slams back
  drop(tLand, 5, { wet: .2, v: .7 })                         // and the full stop drops into its place

  // the camera, riding with the nib: looking a little ahead of it, turned so it runs up the frame, the floor tilted away
  function follow(t) {
    const sn = sAt(t), [ux, uy] = along(sn), hd = heading(sn)
    const ld = 140 * P(t, t0, t0 + .5, E.io)
    return [(ux - MC[0]) * K + Math.cos(hd) * ld, (uy - MC[1]) * K + Math.sin(hd) * ld, 0,
      22 * P(t, t0, t0 + .6, E.io), 0, -90 - hd * 180 / Math.PI, lerp(NIB0, 1, P(t, t0, t0 + 1.4, E.io))]
  }
  const fP = follow(tPull)
  function camAt(t) {
    if (t <= tPull) return follow(t)
    const u = P(t, tPull, t1, E.lin), q = Math.pow(u, 2.2), m = E.io(u)
    return [lerp(fP[0], 0, m), lerp(fP[1], 0, m), 0, lerp(fP[3], 0, E.io(Math.min(1, u * 1.4))), 0, lerp(fP[5], -360, m), Math.exp(lerp(Math.log(fP[6]), Math.log(sEnd), q))]
  }

  return t => {
    const c = camAt(t), mb = aim(s, c, camAt(t + 1 / 60))
    specks(t, P(t, t0, t0 + .2) * (1 - P(t, tPull, tLand - .2)))
    // the stroke, drawn as far as the nib, by a dash longer than the path with a gap longer again (a gap
    // only as long as the path leaves a hairline at its far end); once whole it drops its dash, so the n
    // is the untouched path
    const sn = sAt(t), whole = sn >= LEN - 1e-3
    ink.style.strokeDasharray = whole ? '' : '1 2'; ink.style.strokeDashoffset = whole ? '' : (1 - sn / LEN).toFixed(5)
    const cool = 1 - P(t, tEnd, tEnd + .5)
    hots.forEach((e, i) => {
      const [l, k] = HOT[i], a = Math.max(0, sn - l)
      e.style.strokeDasharray = `${(sn - a).toFixed(3)} ${(LEN * 2).toFixed(1)}`; e.style.strokeDashoffset = (-a).toFixed(3)
      e.style.opacity = (k * cool * P(t, t0, t0 + .15)).toFixed(3)
    })
    // the nib: along the n, square to its way; then up and over into its place, turning over once
    let [nx, ny, nr] = along(sn), rot = nr * 180 / Math.PI + 90, sq = 1
    if (t > tHop) {
      const u = P(t, tHop, tLand, E.io)
        nx = lerp(64.5, DOT[0], u); ny = DOT[1] - 26 * Math.sin(Math.PI * u); rot = 180 - 270 * u
    } else if (t > tEnd) ny = lerp(ny, 82 - 6.5, P(t, tEnd, tHop, E.io))   // first it backs up onto the stroke, leaving its end square
    sq = 1 + .2 * bell(t, tLand, tLand + .04, tLand + .25)    // and squashes as it lands
    const tf = `translate(${nx.toFixed(3)} ${ny.toFixed(3)}) scale(${sq.toFixed(4)} ${(1 / sq).toFixed(4)}) rotate(${rot.toFixed(2)})`
    nib.setAttribute('transform', tf); halo.setAttribute('transform', tf + ' scale(1.5)')
    halo.style.opacity = (.75 * (1 - .5 * P(t, tLand, t1))).toFixed(3)
    put(glow, { x: (nx - MC[0]) * K, y: (ny - MC[1]) * K, o: .9 * (1 - .6 * P(t, tPull, t1)) })
    lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: Math.min(9, mb.zoom * 50), bright: 1 + .35 * bell(t, t0, t0 + .03, t0 + .4) })
  }
}

/* ============================================================
   LIGHT and NAME: a pendant lamp swings in over the mark, clicks on, and
   its beam sweeps across it, lighting it gold, until it hangs still; then
   the rest of the name draws in under it, and the address.
   ============================================================ */
function buildLight(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1, tName = sceneById('name').start
  const K3 = M({ land: 3.0, def: 2.7 })                   // the whole name
  const specks = bokeh(s, 32, { n: 30, w: 2600, hgt: 2000 })
  const pool = h('div', 'k-pool', s.cam)
  const mark = h('div', 'k-mark', s.cam, WORDMARK()), gold = h('div', 'k-mark k-gold', s.cam, WORDMARK())
  ;[mark, gold].forEach(e => e.firstChild.setAttribute('width', 273 * K2))
  const ABL = ['ab', 'as', 'bs', 'bb', 'l']
  const strokes = [mark, gold].map(e => ABL.map(k => e.querySelector(`[data-k="${k}"]`)))
  const url = h('div', 'k-url', s.cam, 'nabl.agency')
  // the lamp: a cord from above the frame, the shade, its beam and the dust in it
  const RIM = 118, BW = 760, BH = 1400                      // the opening's half-width, the beam's half-width at its foot, its length
  const beam = h('div', 'k-beam', s.cam, '<div class="core"></div>')
  const dust = h('div', 'k-dust', s.cam)
  ;[beam.firstChild, dust].forEach(e => { e.style.clipPath = `polygon(${BW - RIM}px 0, ${BW + RIM}px 0, ${2 * BW}px 100%, 0 100%)` })
  ;[beam, dust].forEach(e => { e.style.width = 2 * BW + 'px'; e.style.height = BH + 'px'; e.style.transformOrigin = `${BW}px 0` })
  const motes = Array.from({ length: 60 }, (_, i) => { const e = h('i', '', dust); const r = Math.sin(i * 12.9898) * 43758.5453; return { e, f: r - Math.floor(r), g: (i * .618) % 1, z: .4 + ((i * .37) % .6) } })
  const cord = h('div', 'k-cord', s.cam)
  const lamp = h('div', 'k-lamp', s.cam, `<svg width="300" height="160" viewBox="-150 -140 300 160" style="overflow:visible">
    <defs>
      <linearGradient id="kShade" x1="-130" y1="0" x2="130" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6A5D50"/><stop offset=".3" stop-color="#3D342C"/><stop offset=".7" stop-color="#27211C"/><stop offset="1" stop-color="#4A3F35"/></linearGradient>
      <radialGradient id="kOpen" cx="0" cy="0" r="1" gradientTransform="translate(0 -3) scale(130 14)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFF4DE"/><stop offset=".55" stop-color="#F6CF94"/><stop offset="1" stop-color="#E9AC57"/></radialGradient>
      <filter id="kBulb" x="-50%" y="-300%" width="200%" height="700%"><feGaussianBlur stdDeviation="9"/></filter>
    </defs>
    <rect x="-9" y="-140" width="18" height="20" rx="3" fill="#3A3129"/>
    <path d="M-16 -122 L16 -122 L132 -4 L-132 -4 Z" fill="url(#kShade)"/>
    <path d="M-16 -122 L16 -122 L22 -116 L-22 -116 Z" fill="#5A5249"/>
    <path class="edge" d="M-132 -4 L-16 -122 M132 -4 L16 -122" stroke="#F6CF94" stroke-width="2.2" fill="none"/>
    <ellipse class="glow" cx="0" cy="-3" rx="132" ry="16" fill="#F6CF94" filter="url(#kBulb)"/>
    <ellipse class="open" cx="0" cy="-3" rx="132" ry="12" fill="url(#kOpen)"/>
  </svg>`)
  const opening = lamp.querySelector('.open'), bulb = lamp.querySelector('.glow'), edge = lamp.querySelector('.edge')

  const yLamp = M({ land: -470, sq: -480, tall: -520, port: -600 })   // where the shade hangs at rest, the cord's foot
  const yPivot = -(H / 2) / Z0 - 600                       // the cord's top, above the frame
  const yView = M({ land: -70, sq: -80, tall: -110, port: -150 })     // the camera's aim, once the lamp is in
  const tIn = t0 + beat(.5), tOn = t0 + beat(.85), tStill = t0 + beat(7)
  const A0 = 34, TAU = 1.7, W = Math.PI / B                 // the swing: crossing the middle on each beat, dying away
  const swing = t => t < tIn ? A0 : A0 * Math.exp(-(t - tIn) / TAU) * Math.cos(W * (t - tIn)) * (1 - P(t, tStill - beat(2), tStill, E.io))
  const cam = path([[t0, 0, 0, 0, 0, 0, 0, 1], [t0 + beat(1.5), 0, yView * .7, 20, 0, 0, 0, 1], [tName, 0, yView, 40, 0, 0, 0, 1], [t1, 0, yView, -20, 0, 0, 0, 1]])
  cue('impact', t0 + .005, { v: .9 })                        // the mark
  cue('shimmer', t0 + .03, { d: 2.4, v: .5 })
  cue('whoosh', tIn + .25, { d: .6, v: .45 })                // the lamp swings in
  cue('click', tOn)                                          // and clicks on
  ;[1, 2, 3, 4].forEach(i => cue('whoosh', t0 + beat(i), { d: .45, v: .4 * Math.exp(-(i - .5) * B / TAU) }))   // each pass of the beam
  drop(t0 + beat(1), 4, { wet: .5, v: .4 })                  // the beam finds the full stop
  cue('confirm', tStill - beat(.5), { n: 2, deg: 2, v: .35 })
  cue('draw', tName + .08, { d: .7 })                        // the name draws in
  drop(tName + .95, 5, { wet: .3, v: .5 })
  drop(tName + beat(2), 2, { wet: .55, v: .35 })             // the address

  return t => {
    const c = cam(t)
    const mb = aim(s, c, cam(t + 1 / 60), 9 * bell(t, t0, t0 + .02, t0 + .3), t)
    specks(t, P(t, t0, t0 + .6) * (1 - P(t, t1 - .5, t1)))
    // the lockup: the mark at the middle, then sliding left as the name draws in round it, a little smaller
    const pS = P(t, tName, tName + beat(1.5), E.io), k = lerp(K2, K3, pS)
    const ax = lerp(MC[0], 136.5, pS), ay = lerp(MC[1], 44, pS)
    const mx = (136.5 - ax) * k, my = (50 - ay) * k
    ;[mark, gold].forEach(e => put(e, { x: mx, y: my, s: k / K2 }))
    strokes.forEach(set => set.forEach((e, i) => {
      const a = tName + .1 + i * .09, d = P(t, a, a + .45, E.out)
      e.style.opacity = d > 0 ? 1 : 0
      e.style.strokeDasharray = d < 1 ? '1 2' : ''; e.style.strokeDashoffset = d < 1 ? (1 - d).toFixed(4) : ''
    }))
    blurIn(url, t, tName + beat(2), { y: my + (82 - 44) * K3 + 74, dur: .34, s0: 1, blur: 12, dy: 12 })
    // the lamp: down from above the frame, swinging; on the click its light comes on, with a flicker
    const th = swing(t), r = th * Math.PI / 180
    const len = lerp(yLamp - yPivot - 520, yLamp - yPivot, P(t, tIn - .05, tIn + beat(1), E.out))
    const fx = len * Math.sin(r), fy = yPivot + len * Math.cos(r)
    const on = t < tOn ? 0 : Math.min(1, P(t, tOn, tOn + .05) * (t > tOn + .07 && t < tOn + .11 ? .3 : 1))
    lamp.style.transform = `translate(-150px,0) translate3d(${fx.toFixed(1)}px,${fy.toFixed(1)}px,0) rotate(${(-th).toFixed(2)}deg)`
    lamp.style.opacity = P(t, tIn - .05, tIn + .1).toFixed(3); lamp.style.visibility = t < tIn - .05 ? 'hidden' : 'visible'
    cord.style.height = (len + 4).toFixed(1) + 'px'
    cord.style.transform = `translate(-1px,0) translate3d(0px,${yPivot.toFixed(1)}px,0) rotate(${(-th).toFixed(2)}deg)`
    cord.style.visibility = lamp.style.visibility
    opening.style.opacity = (.25 + .75 * on).toFixed(3); bulb.style.opacity = on.toFixed(3); edge.style.opacity = (.15 + .45 * on).toFixed(3)
    // the beam, from the opening along the shade's axis
    const ox = fx + 137 * Math.sin(r), oy = fy + 137 * Math.cos(r)
    const bt = `translate(-${BW}px,0) translate3d(${ox.toFixed(1)}px,${oy.toFixed(1)}px,0) rotate(${(-th).toFixed(2)}deg)`
    beam.style.transform = dust.style.transform = bt
    beam.style.opacity = (.95 * on).toFixed(3); dust.style.opacity = on.toFixed(3)
    motes.forEach(m => {
      const yy = ((m.f + t * .035 * m.z) % 1) * BH, xx = BW + (m.g - .5) * 2 * lerp(RIM, BW, yy / BH) * .9 + Math.sin(t * .8 + m.f * 9) * 14
      m.e.style.transform = `translate(${xx.toFixed(1)}px,${yy.toFixed(1)}px)`
      m.e.style.opacity = (m.z * (.35 + .65 * Math.abs(Math.sin(t * 1.3 + m.g * 7))) * (1 - yy / BH) ** .6).toFixed(3)
    })
    // where the beam lands on the mark's plane, the mark lights gold, and the floor round it glows
    const lam = (my - oy) / Math.cos(r), hx = ox + lam * Math.sin(r), hw = RIM + lam * (BW - RIM) / BH
    const sc = k / K2, lx = (hx - mx) / sc + 273 * K2 / 2, ly = 50 * K2
    gold.style.webkitMaskImage = gold.style.maskImage = `radial-gradient(${(hw / sc).toFixed(0)}px ${(70 * K2).toFixed(0)}px at ${lx.toFixed(0)}px ${ly.toFixed(0)}px, #000 0%, rgba(0,0,0,.8) 40%, transparent 100%)`
    gold.style.opacity = on.toFixed(3)
    put(pool, { x: hx, y: my + 40, s: lerp(.8, 1.1, P(t, tName, tName + beat(1.5), E.io)), o: on * .9 })
    lens(s, { mbX: mb.mbX, mbY: mb.mbY, o: 1 - P(t, t1 - .45, t1, E.in2), bright: 1 + .3 * bell(t, t0, t0 + .02, t0 + .5) })
  }
}

export default function setup() {
  scene(['line'], buildLine)
  scene(['write'], buildWrite)
  scene(['light', 'name'], buildLight)
  const sc = sceneById
  const tW = sc('write').start, tL = sc('light').start
  // [time, ax, ay, aStrength, cx, cy, cStrength, grid]: amber low in the middle, the light from above
  const ground = [
    [0, .5, .6, 0, .5, -.08, 0, 0],
    [tW - .02, .5, .6, 0, .5, -.08, 0, 0],
    [tW + .02, .5, .55, 1.1, .5, -.06, .6, 0],                // the dive: a flash of warmth
    [tW + .5, .5, .55, .35, .5, -.06, .45, 0],
    [tL - .5, .5, .5, .3, .5, -.06, .4, 0],
    [tL - .02, .5, .5, .15, .5, -.08, .25, 0],                 // the breath
    [tL + .05, .5, .5, 1.3, .5, -.06, .9, 0],                  // the mark: a flash
    [tL + .7, .5, .55, .3, .5, -.08, .6, 0],
    [tL + beat(2), .5, .6, .35, .5, -.12, .95, 0],             // the lamp's light from above
    [TL.duration - .4, .5, .6, .3, .5, -.12, .8, 0],
    [TL.duration, .5, .6, 0, .5, -.12, 0, 0],
  ]
  return { ground, bug: ['name', 'name'] }
}
