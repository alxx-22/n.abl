/* ============================================================
   THE FILM STAGE, ON THE SITE

   The launch reel (marketing/launch-video) is an HTML page sampled by
   time: seek(t) puts every element where it belongs at t seconds, so the
   renderer can ask for any frame in any order. That is exactly what a
   scroll-driven section needs, so the site runs the same stage, with the
   scroll position standing in for the clock.

   This is the reel's film/stage.js made into a factory rather than a
   page: no globals, no query string, no fetched timeline. createStage()
   builds one stage inside a host element and hands back the helpers the
   scenes are written against, bound to that stage's size and layout.

   The frame is 1080 units on its short side in every aspect ratio, as in
   the reel, and the whole stage is scaled to the viewport with one CSS
   transform, so one unit is one CSS pixel inside the film and only the
   layout changes between a phone and a desk.

   THE ONE innerHTML WRITE

   h() is the only place the film writes markup, and security-check.mjs
   allows this file for the same reason it allows the scene host: every
   string passed to it is composed from literals in src/components/film,
   with nothing from a user, a URL or the network anywhere in it.
   ============================================================ */

import { bezier, EASE, EASE_OUT, EASE_IO, lerp } from '../scenes/engine.js'

export { lerp }

/* ---------- easing ---------- */
export const E = {
  ease: EASE, out: EASE_OUT, io: EASE_IO, lin: x => x,
  in2: x => x * x, in3: x => x * x * x, out2: x => 1 - (1 - x) * (1 - x),
  back: bezier(.34, 1.56, .64, 1), snap: bezier(.2, 1.5, .4, 1),
}
export const P = (t, a, b, e = E.out) => (t <= a ? 0 : t >= b ? 1 : e((t - a) / (b - a)))
export const bell = (t, a, b, c, e = E.out) => P(t, a, b, e) * (1 - P(t, b, c, E.io))
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }

/* ---------- DOM ---------- */
export function h(tag, cls, parent, html) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  if (parent) parent.appendChild(e)
  return e
}
export function vis(e, o) { e.style.opacity = o.toFixed(4); e.style.visibility = o <= 0.002 ? 'hidden' : 'visible' }
/* place an .f-abs element: x, y from the stage centre, in px */
export function put(e, { x = 0, y = 0, z = 0, s = 1, r = 0, rx = 0, ry = 0, o = 1, blur = 0, bright } = {}) {
  e.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})`
  vis(e, o)
  let f = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : ''
  if (bright != null && Math.abs(bright - 1) > .005) f += ` brightness(${bright.toFixed(3)})`
  e.style.filter = f || 'none'
}
export function words(parent, text) {
  return text.split(' ').map((w, i) => {
    if (i) parent.appendChild(document.createTextNode(' '))
    const s = h('span', 'f-w', parent); s.textContent = w; return s
  })
}
/* blur-in, rise: the text entrance the film uses throughout */
export function rise(e, t, t0, { dur = .4, dy = 30, blur = 16, s0 = 1 } = {}) {
  const p = P(t, t0, t0 + dur, E.out)
  e.style.transform = `translateY(${((1 - p) * dy).toFixed(2)}px) scale(${lerp(s0, 1, p).toFixed(4)})`
  vis(e, p)
  e.style.filter = p < 0.999 ? `blur(${((1 - p) * blur).toFixed(2)}px)` : 'none'
}
export function offs(e, root) {
  let x = 0, y = 0, n = e
  while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent }
  return { x, y, w: e.offsetWidth, h: e.offsetHeight }
}

/* ---------- pieces, shared by the film and the cards ---------- */
const WHITE = '247,242,234'
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
export function dotsPulse(dots, t) {
  dots.querySelectorAll('i').forEach((d, k) => { d.style.opacity = (.35 + .65 * Math.max(0, Math.sin((t * 3 - k * .22) * Math.PI))).toFixed(3) })
}
/* the world point at the centre of element e inside a positioned box placed at (bx, by) */
export function centreOf(e, box, bx, by) {
  const o = offs(e, box)
  return [bx - box.offsetWidth / 2 + o.x + o.w / 2, by - box.offsetHeight / 2 + o.y + o.h / 2]
}

/* ---------- marks and icons ---------- */
export const SPARK = 'M0 -10 C1 -2.5 2.5 -1 10 0 C2.5 1 1 2.5 0 10 C-1 2.5 -2.5 1 -10 0 C-2.5 -1 -1 -2.5 0 -10 Z'
export const spark = (size, fill = '#E9AC57') => `<svg width="${size}" height="${size}" viewBox="-10 -10 20 20" style="overflow:visible"><path d="${SPARK}" fill="${fill}"/></svg>`
export const CHECK = (c = '#B9D4B3', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
/* the wordmark, from public/brand/wordmark.svg: same paths, same 13-unit stroke */
export const WORDMARK = () => `<svg viewBox="0 0 273 100">
  <g fill="none" stroke="#FBF6EC" stroke-width="13" stroke-linecap="butt">
    <path d="M24.5 82 L24.5 48 A20 20 0 0 1 64.5 48 L64.5 82"/>
    <circle cx="128.25" cy="51.75" r="23.75" transform="rotate(-90 128.25 51.75)"/>
    <path d="M152 21.5 L152 82"/>
    <path d="M178 6 L178 82"/>
    <circle cx="201.75" cy="51.75" r="23.75" transform="rotate(90 201.75 51.75)"/>
    <path d="M248.5 6 L248.5 82"/>
  </g>
  <rect x="78" y="69" width="13" height="13" fill="#E9AC57"/>
</svg>`
/* line icons, one stroke weight */
const I = {
  cal: '<rect x="4" y="6" width="24" height="22" rx="4"/><path d="M4 13h24M11 3v6M21 3v6"/><rect x="18" y="18" width="5" height="5" rx="1" fill="currentColor" stroke="none"/>',
  alert: '<path d="M16 4l13 23H3z"/><path d="M16 12v7M16 23v.5"/>',
  doc: '<path d="M8 3h11l6 6v20H8z"/><path d="M19 3v6h6M12 15h9M12 19h9M12 23h6"/>',
  inbox: '<path d="M4 17l4-12h16l4 12v10H4z"/><path d="M4 17h7l2 3h6l2-3h7"/>',
  phone: '<path d="M8 4h5l2 6-3 2c1 3 4 6 7 7l2-3 6 2v5c0 1-1 2-2 2C14 29 3 18 4 6c0-1 1-2 2-2z"/>',
  invoice: '<path d="M7 3h18v26l-3-2-3 2-3-2-3 2-3-2-3 2z"/><path d="M12 10h8M12 15h8M12 20h5"/>',
  box: '<path d="M4 10l12-6 12 6v13l-12 6-12-6z"/><path d="M4 10l12 6 12-6M16 16v13"/>',
  chart: '<path d="M4 4v24h24"/><path d="M10 20v4M16 14v10M22 9v15"/>',
  book: '<path d="M5 5h9c2 0 2 1 2 3v19c0-2-1-3-3-3H5zM27 5h-9c-2 0-2 1-2 3v19c0-2 1-3 3-3h8z"/>',
  bell: '<path d="M8 22V14a8 8 0 0116 0v8l3 3H5z"/><path d="M13 27a3 3 0 006 0"/>',
  clock: '<circle cx="16" cy="16" r="12"/><path d="M16 9v7l5 3"/>',
  card: '<rect x="3" y="7" width="26" height="18" rx="3"/><path d="M3 13h26M8 20h6"/>',
  mail: '<rect x="4" y="7" width="24" height="18" rx="3"/><path d="M5 9l11 8 11-8"/>',
  sheet: '<rect x="5" y="4" width="22" height="24" rx="3"/><path d="M5 11h22M5 18h22M13 4v24"/>',
  scan: '<path d="M4 11V6a2 2 0 012-2h5M21 4h5a2 2 0 012 2v5M28 21v5a2 2 0 01-2 2h-5M11 28H6a2 2 0 01-2-2v-5"/><path d="M8 16h16"/>',
  link: '<path d="M13 19l6-6"/><path d="M11 14l-3 3a4 4 0 006 6l3-3M21 18l3-3a4 4 0 00-6-6l-3 3"/>',
}
export const icon = k => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`

/* The four layouts the film is composed for, by aspect ratio. */
export const modeFor = R => (R > 1.3 ? 'land' : R > 0.95 ? 'sq' : R > 0.7 ? 'tall' : 'port')

/**
 * Build a stage of W x H units inside `host`.
 *
 *   beat     seconds per beat of the grid the film is cut to
 *   list     [{ id, beats }] in order: each scene's length on the grid
 *   lite     fewer specks of light, for small screens
 *
 * Returns the context every scene builder is written against, plus seek(t)
 * and the film's duration. Nothing here runs on its own clock.
 */
export function createStage(host, { W, H, beat, list, lite = false }) {
  const R = W / H
  const MODE = modeFor(R)
  const M = o => (MODE in o ? o[MODE] : o.def)
  const LAND = MODE === 'land'

  // the timeline: each scene starts where the one before it ends
  let at = 0
  const scenes = list.map(({ id, beats }) => { const s = { id, start: at, end: at + beats * beat }; at = s.end; return s })
  const TL = { beat, grid_beat: beat, scenes, duration: at }
  const sceneById = id => TL.scenes.find(s => s.id === id)

  const stage = h('div', `f-stage m-${MODE}`, host)
  stage.style.width = W + 'px'; stage.style.height = H + 'px'
  const ground = h('div', 'f-layer f-ground', stage)
  const bloomA = h('div', 'f-bloom f-bloom--a', ground)
  const bloomC = h('div', 'f-bloom f-bloom--c', ground)
  const scenesEl = h('div', 'f-layer', stage)
  const flash = h('div', 'f-layer f-flash', stage)
  h('div', 'f-layer f-vignette', stage)
  /* directional blur for fast camera moves: one filter per scene, set per frame */
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute'
  const defs = document.createElementNS(NS, 'defs'); svg.appendChild(defs); stage.appendChild(svg)

  const SCENES = []
  const uid = `f${Math.random().toString(36).slice(2, 7)}`
  function scene(ids, build, { hold = 0 } = {}) {
    const a = sceneById(ids[0]), b = sceneById(ids[ids.length - 1])
    const root = h('div', 'f-scene', scenesEl), rig = h('div', 'f-rig', root)
    const cam = h('div', 'f-cam', rig)
    const id = `${uid}mb${SCENES.length}`
    const filter = document.createElementNS(NS, 'filter')
    filter.setAttribute('id', id)
    const blurEl = document.createElementNS(NS, 'feGaussianBlur')
    blurEl.setAttribute('stdDeviation', '0 0')
    filter.appendChild(blurEl); defs.appendChild(filter)
    const s = { id: ids.join('+'), t0: a.start, t1: b.end, hold, root, rig, cam, blurEl, mb: id, cuts: ids.map(sceneById) }
    s.render = build(s)
    SCENES.push(s)
    return s
  }

  const ctx = {
    W, H, R, MODE, M, LAND, TL, lite, stage, sceneById, scene,
    /* How fast the film is moving, in film seconds per real second. The
       reel always plays at 1; here a visitor can stop scrolling in the
       middle of a whip pan, and a frozen frame should be sharp rather than
       smeared, so the motion blur is scaled by this. */
    speed: 1,
  }

  let ground_ = () => {}
  ctx.setGround = (K) => {
    ground_ = t => {
      let i = 0; while (i < K.length - 2 && t >= K[i + 1][0]) i++
      const a = K[i], b = K[i + 1], p = P(t, a[0], b[0], E.io)
      const v = a.map((x, j) => lerp(x, b[j], p))
      const D = Math.max(W, H), da = D * 1.3, dc = D * 1.15, wob = Math.sin(t * .6) * 40
      bloomA.style.width = bloomA.style.height = da + 'px'
      bloomA.style.transform = `translate(${(v[1] * W - da / 2 + wob).toFixed(1)}px,${(v[2] * H - da / 2).toFixed(1)}px)`
      bloomA.style.opacity = Math.min(1, v[3]).toFixed(3)
      bloomC.style.width = bloomC.style.height = dc + 'px'
      bloomC.style.transform = `translate(${(v[4] * W - dc / 2 - wob).toFixed(1)}px,${(v[5] * H - dc / 2).toFixed(1)}px)`
      bloomC.style.opacity = Math.min(1, v[6]).toFixed(3)
      vis(flash, Math.max(0, v[3] - 1) * 2.2)
    }
  }

  ctx.seek = t => {
    for (const s of SCENES) {
      const on = t >= s.t0 && t < s.t1 + s.hold
      if (on) { s.root.style.display = 'block'; s.render(t) } else s.root.style.display = 'none'
    }
    ground_(t)
  }
  /* Prime every scene once, so no first frame measures an empty layout. */
  ctx.prime = () => {
    for (const s of SCENES) { s.root.style.display = 'block'; s.render(s.t0 + .01); s.root.style.display = 'none' }
  }
  ctx.destroy = () => { stage.remove() }
  return ctx
}
