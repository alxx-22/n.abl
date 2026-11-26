/* ============================================================
   THE KIT: the camera, the lens and the pieces the reels are made of.
   A real 3D camera on a smooth path through keyframes, smearing the frame
   along its own motion; specks of light at every depth; pieces that blur
   in, rims that draw round pills, and water drops for sound. Shared by
   films/reel and films/voice.
   ============================================================ */

import { E, M, P, cue, h, lerp, offs, put, rng } from './stage.js'

export const WHITE = '247,242,234', ICE = '124,203,255', AMB = '233,172,87', CORAL = '240,122,106'
export const Z0 = M({ land: 1, sq: 1, tall: 1.1, port: 1.22 })

/* ---------- sound: water drops, pitched on D minor pentatonic ---------- */
// deg: step of the scale from D4 up; wet 0 is dry and close, 1 is under water
export const drop = (t, deg, { n = 1, step = 2, gap = .045, wet = .3, v = .6 } = {}) => cue('drop', t, { deg, n, step, gap, wet, v })

/* ---------- the lens and the camera ---------- */
export function widen(s) {
  const f = s.blurEl.parentNode
  f.setAttribute('x', '-30%'); f.setAttribute('y', '-40%'); f.setAttribute('width', '160%'); f.setAttribute('height', '180%')
  f.setAttribute('color-interpolation-filters', 'sRGB')   // linear light bands the dark gradients into colours
}
export function lens(s, { o = 1, blur = 0, mbX = 0, mbY = 0, bright = 1 } = {}) {
  s.rig.style.opacity = o.toFixed(4)
  s.blurEl.setAttribute('stdDeviation', `${mbX.toFixed(1)} ${mbY.toFixed(1)}`)
  let f = ''
  if (mbX > .6 || mbY > .6) f += `url(#${s.mb}) `
  if (blur > .05) f += `blur(${blur.toFixed(2)}px) `
  if (Math.abs(bright - 1) > .005) f += `brightness(${bright.toFixed(3)})`
  s.rig.style.filter = f.trim() || 'none'
}
/* a smooth path through keys [t, x, y, z, rx, ry, rz, sc]: cubic Hermite with
   Catmull-Rom tangents, so the camera never stops dead between keys */
export function path(K) {
  // keys timed from different beats can cross at another tempo, and a key
  // behind the one before it throws the camera: say so, and put them in order
  K.forEach((k, i) => { if (i && k[0] <= K[i - 1][0]) console.error(`camera keys out of order at ${k[0].toFixed(3)}s`) })
  K = K.slice().sort((a, b) => a[0] - b[0]).filter((k, i, a) => !i || k[0] > a[i - 1][0])
  const n = K.length
  return t => {
    if (t <= K[0][0]) return K[0].slice(1)
    if (t >= K[n - 1][0]) return K[n - 1].slice(1)
    let i = 0; while (t >= K[i + 1][0]) i++
    const a = K[i], b = K[i + 1], hh = b[0] - a[0], u = (t - a[0]) / hh
    const pa = K[Math.max(0, i - 1)], pb = K[Math.min(n - 1, i + 2)]
    const u2 = u * u, u3 = u2 * u
    return a.slice(1).map((_, k) => {
      const j = k + 1
      const m0 = i === 0 ? 0 : (b[j] - pa[j]) / (b[0] - pa[0]) * hh
      const m1 = i + 2 >= n ? 0 : (pb[j] - a[j]) / (pb[0] - a[0]) * hh
      return (2 * u3 - 3 * u2 + 1) * a[j] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * b[j] + (u3 - u2) * m1
    })
  }
}
/* point the camera, and smear the frame along its motion */
export function shoot(s, cam, t, { shake = 0 } = {}) {
  const v = cam(t), w = cam(t + 1 / 60)
  const [x, y, z, rx, ry, rz, sc] = v
  const sx = shake ? Math.sin(t * 91) * shake : 0, sy = shake ? Math.cos(t * 77) * shake : 0
  s.cam.style.transform = `translateZ(${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${(sc * Z0).toFixed(4)}) translate3d(${(-x + sx).toFixed(1)}px,${(-y + sy).toFixed(1)}px,0)`
  const k = sc * Z0 * (1 + z / 1800)
  const dx = (w[0] - v[0]) * k + (w[4] - v[4]) * 17, dy = (w[1] - v[1]) * k - (w[3] - v[3]) * 17
  const smear = d => Math.min(36, Math.max(0, Math.abs(d) - 9) * .6)
  return { mbX: smear(dx), mbY: smear(dy) }
}
/* specks of light at every depth, so the camera's moves read as space */
export function bokeh(s, seed, { n = 40, w = 2600, hgt = 1800, cx = 0, cy = 0 } = {}) {
  const r = rng(seed), dots = []
  for (let i = 0; i < n; i++) {
    const e = h('div', 'r-bok', s.cam)
    const size = 5 + r() * r() * 46, col = [WHITE, AMB, ICE, WHITE][Math.floor(r() * 4)]
    Object.assign(e.style, { width: size + 'px', height: size + 'px', background: `radial-gradient(circle, rgba(${col},.8), rgba(${col},0) 68%)` })
    dots.push({ e, x: cx + (r() - .5) * w, y: cy + (r() - .5) * hgt, z: -1400 + r() * 1650, o: .08 + r() * .32, ph: r() * 6 })
  }
  return (t, o = 1) => dots.forEach(d => put(d.e, { x: d.x + Math.sin(t * .5 + d.ph) * 26, y: d.y + Math.cos(t * .37 + d.ph) * 20, z: d.z, o: d.o * o }))
}

/* ---------- pieces ---------- */
export function blurIn(e, t, t0, { x = 0, y = 0, z = 0, dur = .32, s0 = 1.12, blur = 22, dx = 0, dy = 0, dz = 0, s = 1, o = 1, rx = 0, ry = 0 } = {}) {
  const p = P(t, t0, t0 + dur, E.out)
  put(e, { x: x + (1 - p) * dx, y: y + (1 - p) * dy, z: z + (1 - p) * dz, s: s * lerp(s0, 1, p), o: o * Math.min(1, p * 1.6), blur: (1 - p) * blur, rx, ry })
  return p
}
export function count(e, t, a, b, to, fmt = v => v) { e.textContent = fmt(Math.round(to * P(t, a, b, E.out))) }
export function ringPill(parent, w, hgt, html) {
  const e = h('div', 'r-pill', parent, html)
  e.style.width = w + 'px'; e.style.height = hgt + 'px'
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('class', 'r-rim')
  svg.setAttribute('width', w + 16); svg.setAttribute('height', hgt + 16)
  const mk = cls => { const r = document.createElementNS(ns, 'rect'); r.setAttribute('x', 8); r.setAttribute('y', 8); r.setAttribute('width', w); r.setAttribute('height', hgt); r.setAttribute('rx', hgt / 2); r.setAttribute('pathLength', 1); if (cls) r.setAttribute('class', cls); svg.appendChild(r); return r }
  mk('base'); e._rim = mk('')
  e.appendChild(svg)
  return e
}
export function drawRim(e, p) {
  e.lastChild.style.opacity = p > 0 ? 1 : 0
  e._rim.style.strokeDasharray = '1 1'
  e._rim.style.strokeDashoffset = (1 - p).toFixed(4)
  e.style.boxShadow = `0 0 ${(40 * p).toFixed(0)}px rgba(${WHITE},${(.16 * p).toFixed(3)})`
}
export function pop(e, t, t0, { dur = .3, dy = 18, blur = 12 } = {}) {
  const p = P(t, t0, t0 + dur, E.snap)
  e.style.opacity = Math.min(1, P(t, t0, t0 + .1)).toFixed(3)
  e.style.transform = `translateY(${((1 - Math.min(1, p)) * dy).toFixed(1)}px) scale(${lerp(.86, 1, Math.min(1.04, p)).toFixed(4)})`
  const bl = (1 - P(t, t0, t0 + dur * .7)) * blur
  e.style.filter = bl > .05 ? `blur(${bl.toFixed(1)}px)` : 'none'
}
/* the world point at the centre of element e inside a positioned box placed at (bx, by) */
export function centreOf(e, box, bx, by) {
  const o = offs(e, box)
  return [bx - box.offsetWidth / 2 + o.x + o.w / 2, by - box.offsetHeight / 2 + o.y + o.h / 2]
}
