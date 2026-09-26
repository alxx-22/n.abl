/* ============================================================
   THE STAGE: what every film shares

   One page, sampled by time. window.seek(t) puts every element where it
   belongs at t seconds, so the renderer can ask for any frame in any
   order and get the same picture. Nothing here runs on its own clock.

   ?film=<id> picks the film: its timeline comes from
   build/<id>/timeline.json (written by vo.py from the synthesised voice),
   its scenes from films/<id>/scenes.js and any styles of its own from
   films/<id>/scenes.css. Scenes start on beats, words carry their own
   measured times, and the animation keys off them by name.

   Every frame is 1080 px on its short side, so one CSS pixel is one unit
   in all four aspect ratios and only the layout changes between them.

   The curves are the site's own: EASE and EASE_OUT are --ease and
   --ease-out from src/styles/tokens.css.
   ============================================================ */

import { bezier, EASE, EASE_OUT, EASE_IO, lerp, arc } from '/src/components/scenes/engine.js'
export { lerp, arc }
export const Q = new URLSearchParams(location.search)
export const W = +(Q.get('w') || 1920), H = +(Q.get('h') || 1080)
export const R = W / H
export const MODE = R > 1.3 ? 'land' : R > 0.95 ? 'sq' : R > 0.7 ? 'tall' : 'port'
export const M = o => (MODE in o ? o[MODE] : o.def)
export const LAND = MODE === 'land'

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
/* place an .abs element: x, y from the stage centre, in px */
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
    const s = h('span', 'w', parent); s.textContent = w; return s
  })
}
/* blur-in, rise: the text entrance the film uses throughout */
export function rise(e, t, t0, { dur = .4, dy = 30, blur = 16, s0 = 1 } = {}) {
  const p = P(t, t0, t0 + dur, E.out)
  e.style.transform = `translateY(${((1 - p) * dy).toFixed(2)}px) scale(${lerp(s0, 1, p).toFixed(4)})`
  vis(e, p)
  e.style.filter = p < 0.999 ? `blur(${((1 - p) * blur).toFixed(2)}px)` : 'none'
}
/* in on one beat, out on another: the slot-machine swap */
export function slot(e, t, a, b, { dy = 120, dur = .3, out = .22 } = {}) {
  const pi = P(t, a, a + dur, E.out), po = b == null ? 0 : P(t, b, b + out, E.in2)
  const y = (1 - pi) * dy - po * dy
  e.style.transform = `translate(-50%,-50%) translate(${e._x || 0}px,${((e._y || 0) + y).toFixed(2)}px) scale(${(lerp(.9, 1, pi) * lerp(1, 1.06, po)).toFixed(4)})`
  vis(e, pi * (1 - po))
  const bl = (1 - pi) * 18 + po * 18
  e.style.filter = bl > .05 ? `blur(${bl.toFixed(2)}px)` : 'none'
}
export function offs(e, root) {
  let x = 0, y = 0, n = e
  while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent }
  return { x, y, w: e.offsetWidth, h: e.offsetHeight }
}

/* ---------- marks and icons ---------- */
export const SPARK = 'M0 -10 C1 -2.5 2.5 -1 10 0 C2.5 1 1 2.5 0 10 C-1 2.5 -2.5 1 -10 0 C-2.5 -1 -1 -2.5 0 -10 Z'
export const spark = (size, fill = '#E9AC57') => `<svg width="${size}" height="${size}" viewBox="-10 -10 20 20" style="overflow:visible"><path d="${SPARK}" fill="${fill}"/></svg>`
export const CHECK = (c = '#B9D4B3', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
export const STAR = c => `<svg viewBox="-12 -12 24 24" width="100%" height="100%"><path d="M0 -11 L3.2 -3.6 L11 -3.2 L5 2 L7 10 L0 5.6 L-7 10 L-5 2 L-11 -3.2 L-3.2 -3.6 Z" fill="${c}"/></svg>`
/* the wordmark, from public/brand/wordmark.svg: same paths, same 13-unit stroke */
export const WORDMARK = (cls = '') => `<svg class="${cls}" viewBox="0 0 273 100">
  <g fill="none" stroke="#FBF6EC" stroke-width="13" stroke-linecap="butt">
    <path data-k="n" pathLength="1" d="M24.5 82 L24.5 48 A20 20 0 0 1 64.5 48 L64.5 82"/>
    <circle data-k="ab" pathLength="1" cx="128.25" cy="51.75" r="23.75" transform="rotate(-90 128.25 51.75)"/>
    <path data-k="as" pathLength="1" d="M152 21.5 L152 82"/>
    <path data-k="bs" pathLength="1" d="M178 6 L178 82"/>
    <circle data-k="bb" pathLength="1" cx="201.75" cy="51.75" r="23.75" transform="rotate(90 201.75 51.75)"/>
    <path data-k="l" pathLength="1" d="M248.5 6 L248.5 82"/>
  </g>
  <rect data-k="dot" x="78" y="69" width="13" height="13" fill="#E9AC57"/>
</svg>`
/* line icons, one stroke weight, for the tiles */
export const I = {
  cal: '<rect x="4" y="6" width="24" height="22" rx="4"/><path d="M4 13h24M11 3v6M21 3v6"/><rect x="18" y="18" width="5" height="5" rx="1" fill="currentColor" stroke="none"/>',
  chat: '<path d="M5 7h22v14H14l-6 5v-5H5z"/><path d="M10 13h12M10 17h7"/>',
  alert: '<path d="M16 4l13 23H3z"/><path d="M16 12v7M16 23v.5"/>',
  lead: '<circle cx="13" cy="11" r="5"/><path d="M4 27c1-6 5-9 9-9s8 3 9 9M25 9v8M21 13h8"/>',
  doc: '<path d="M8 3h11l6 6v20H8z"/><path d="M19 3v6h6M12 15h9M12 19h9M12 23h6"/>',
  inbox: '<path d="M4 17l4-12h16l4 12v10H4z"/><path d="M4 17h7l2 3h6l2-3h7"/>',
  pen: '<path d="M6 26l3-8L22 5l5 5-13 13z"/><path d="M19 8l5 5"/>',
  quote: '<rect x="5" y="4" width="22" height="24" rx="3"/><path d="M11 11h10M11 16h10M11 21h6"/><path d="M22 21h1"/>',
  phone: '<path d="M8 4h5l2 6-3 2c1 3 4 6 7 7l2-3 6 2v5c0 1-1 2-2 2C14 29 3 18 4 6c0-1 1-2 2-2z"/>',
  invoice: '<path d="M7 3h18v26l-3-2-3 2-3-2-3 2-3-2-3 2z"/><path d="M12 10h8M12 15h8M12 20h5"/>',
  star: '<path d="M16 4l3.6 7.6 8.4 1-6.2 5.8 1.6 8.2L16 22.6 8.6 26.6l1.6-8.2L4 12.6l8.4-1z"/>',
  box: '<path d="M4 10l12-6 12 6v13l-12 6-12-6z"/><path d="M4 10l12 6 12-6M16 16v13"/>',
  db: '<ellipse cx="16" cy="7" rx="11" ry="4"/><path d="M5 7v18c0 2 5 4 11 4s11-2 11-4V7M5 16c0 2 5 4 11 4s11-2 11-4"/>',
  chart: '<path d="M4 4v24h24"/><path d="M10 20v4M16 14v10M22 9v15"/>',
  book: '<path d="M5 5h9c2 0 2 1 2 3v19c0-2-1-3-3-3H5zM27 5h-9c-2 0-2 1-2 3v19c0-2 1-3 3-3h8z"/>',
  wave: '<path d="M4 20c3-8 6-8 8 0s5 8 8 0 6-8 8 0"/><circle cx="16" cy="8" r="3"/>',
  keys: '<rect x="3" y="8" width="26" height="16" rx="3"/><path d="M8 13h1M12 13h1M16 13h1M20 13h1M24 13h1M9 19h14"/>',
  stack: '<path d="M4 11l12-6 12 6-12 6z"/><path d="M4 16l12 6 12-6M4 21l12 6 12-6"/>',
  bell: '<path d="M8 22V14a8 8 0 0116 0v8l3 3H5z"/><path d="M13 27a3 3 0 006 0"/>',
  filter: '<path d="M4 5h24l-9 11v9l-6 3V16z"/>',
  notes: '<rect x="6" y="4" width="20" height="24" rx="3"/><path d="M11 11h10M11 16h10M11 21h6"/>',
  share: '<circle cx="8" cy="16" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="24" cy="24" r="3"/><path d="M11 15l10-5M11 17l10 5"/>',
  clock: '<circle cx="16" cy="16" r="12"/><path d="M16 9v7l5 3"/>',
  survey: '<rect x="5" y="4" width="22" height="24" rx="3"/><path d="M10 11l2 2 4-4M10 20l2 2 4-4M19 12h4M19 21h4"/>',
  card: '<rect x="3" y="7" width="26" height="18" rx="3"/><path d="M3 13h26M8 20h6"/>',
  help: '<circle cx="16" cy="16" r="12"/><path d="M12.5 12.5a3.5 3.5 0 117 0c0 3-3.5 3-3.5 6M16 23v.5"/>',
  team: '<circle cx="11" cy="11" r="4"/><circle cx="22" cy="12" r="3.4"/><path d="M3 26c1-5 4-8 8-8s7 3 8 8M18 19c4 0 7 2 8 6"/>',
}
export const icon = k => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`

/* ---------- the timeline ---------- */
export let TL
export const CUES = []
export const cue = (type, t, o = {}) => { CUES.push({ type, t: +t.toFixed(4), ...o }) }
export const norm = s => s.toLowerCase().replace(/[“”"…,?!:;]/g, '').replace(/\.$/, '')
export function lineWords(n) { return TL.lines[n - 1].sentences.flatMap(s => s.words) }
export function wt(n, key, k = 0, end = false) {
  let c = 0
  for (const w of lineWords(n)) if (norm(w.w) === key) { if (c++ === k) return end ? w.end : w.start }
  throw new Error(`no "${key}" in line ${n}`)
}
export const we = (n, key, k = 0) => wt(n, key, k, true)
export const lineStart = n => TL.lines[n - 1].start

/* ---------- the stage ---------- */
export const stage = document.getElementById('stage')
stage.style.width = W + 'px'; stage.style.height = H + 'px'
document.body.classList.add('m-' + MODE)
export const ground = h('div', 'layer', stage)
export const bloomA = h('div', 'bloom bloom--a', ground)
export const bloomC = h('div', 'bloom bloom--c', ground)
export const grid = h('div', 'layer grid', ground)
export const scenesEl = h('div', 'layer', stage)
export const fx = h('div', 'layer', stage)
export const flash = h('div', 'layer', fx)
flash.style.background = 'radial-gradient(circle at 50% 50%, rgba(233,172,87,.6), rgba(233,172,87,.14) 38%, transparent 72%)'
/* the square wipe: a solid square that covers, then a square hole that reveals */
export const wipeSolid = h('div', 'abs', fx); Object.assign(wipeSolid.style, { width: '100px', height: '100px', background: '#E9AC57' })
export const wipeHole = h('div', 'abs', fx); Object.assign(wipeHole.style, { width: '100px', height: '100px', boxShadow: '0 0 0 4000px #E9AC57' })
export const bug = h('div', 'bug', fx, WORDMARK())
bug.style.width = M({ land: '132px', def: '120px' })
h('div', 'layer vignette', stage)
/* directional blur for whip pans: one filter per scene, set per frame */
export const defs = h('div', '', stage, '<svg width="0" height="0" style="position:absolute"><defs></defs></svg>').querySelector('defs')

export const SCENES = []
export const WIPES = []
export function scene(ids, build, { hold = 0 } = {}) {
  const a = TL.scenes.find(s => s.id === ids[0]), b = TL.scenes.find(s => s.id === ids[ids.length - 1])
  const root = h('div', 'scene', scenesEl), rig = h('div', 'rig', root)
  const cam = h('div', 'cam', rig), hud = h('div', 'cam', rig)
  const id = 'mb' + SCENES.length
  defs.insertAdjacentHTML('beforeend', `<filter id="${id}" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="0 0"/></filter>`)
  const s = { id: ids.join('+'), t0: a.start, t1: b.end, hold, root, rig, cam, hud, blurEl: defs.lastChild.firstChild, mb: id, cuts: ids.map(id => TL.scenes.find(x => x.id === id)) }
  s.render = build(s)
  SCENES.push(s)
  return s
}
/* the shared entrance, drift and exit every scene rides on */
export function camera(s, t, { inT = 'rise', outT = 'rise', inDur = .32, outDur = .24, push = .04 } = {}) {
  const lt = t - s.t0, rt = s.t1 - t, len = s.t1 - s.t0
  let x = 0, y = 0, sc = 1 + push * Math.min(1, lt / len), o = 1, blur = 0, mb = 0
  const pin = P(lt, 0, inDur, E.out)
  if (inT === 'rise') { sc *= lerp(.92, 1, pin); y += (1 - pin) * 30; o *= Math.min(1, pin * 1.8); blur += (1 - pin) * 14 }
  else if (inT === 'whip') { x += (1 - pin) * W * .45; mb += (1 - pin) * 70; o *= Math.min(1, pin * 2.5) }
  else if (inT === 'zoom') { sc *= lerp(.5, 1, pin); blur += (1 - pin) * 22; o *= Math.min(1, pin * 2) }
  const pout = rt < outDur ? E.in2(1 - rt / outDur) : 0
  if (outT === 'rise') { sc *= 1 + .12 * pout; y -= pout * 30; blur += pout * 20; o *= 1 - pout * pout }
  else if (outT === 'whip') { x -= pout * W * .45; mb += pout * 70; o *= 1 - P(pout, .55, 1, E.lin) }
  else if (outT === 'through') { sc *= 1 + 5 * pout * pout; blur += pout * 26; o *= 1 - P(pout, .45, 1, E.lin) }
  else if (outT === 'shrink') { sc *= 1 - .45 * pout; blur += pout * 10; o *= 1 - pout }
  s.rig.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${sc.toFixed(4)})`
  s.rig.style.opacity = o.toFixed(4)
  s.blurEl.setAttribute('stdDeviation', `${mb.toFixed(1)} 0`)
  const f = (mb > .3 ? `url(#${s.mb}) ` : '') + (blur > .05 ? `blur(${blur.toFixed(2)}px)` : '')
  s.rig.style.filter = f || 'none'
}
/* the camera inside a scene: keys are [time, x, y, scale, rotY, rotX], x and y the point held at the centre */
export function focus(s, t, keys) {
  let i = 0; while (i < keys.length - 2 && t >= keys[i + 1][0]) i++
  const a = keys[i], b = keys[i + 1], p = P(t, a[0], b[0], E.io)
  const v = k => lerp(a[k] || 0, b[k] || 0, p)
  const sc = lerp(a[3] ?? 1, b[3] ?? 1, p)
  s.cam.style.transform = `rotateY(${v(4).toFixed(2)}deg) rotateX(${v(5).toFixed(2)}deg) scale(${sc.toFixed(4)}) translate(${(-v(1)).toFixed(2)}px,${(-v(2)).toFixed(2)}px)`
}
/* the label that names each agent */
export function label(s, no, eyebrow, title, at) {
  const e = h('div', 'abs label', s.hud)
  const eb = h('div', 'eyebrow', e, `${spark(20)}<span>${eyebrow}</span><span style="color:#9A8F80">${no}</span>`)
  const tt = h('div', 'display ttl', e)
  const ws = words(tt, title)
  const pos = M({ land: [-960 + 100, -400], port: [0, -690], sq: [0, -420], tall: [0, -530] })
  if (!LAND) { e.style.textAlign = 'center'; eb.style.justifyContent = 'center' }
  return t => {
    const w = e.offsetWidth
    put(e, { x: LAND ? pos[0] + w / 2 : pos[0], y: pos[1] })
    rise(eb, t, at - .12, { dur: .3, dy: 12, blur: 8 })
    ws.forEach((x, i) => rise(x, t, at + i * .05, { dur: .34, dy: 26, blur: 14 }))
  }
}
export function bubble(parent, cls, html) { return h('div', 'bub ' + cls, parent, html) }
export function pop(e, t, t0, { dur = .28 } = {}) {
  const p = P(t, t0, t0 + dur, E.snap)
  e.style.transform = `translateY(${((1 - Math.min(1, p)) * 16).toFixed(1)}px) scale(${lerp(.7, 1, p).toFixed(4)})`
  vis(e, P(t, t0, t0 + .08))
}
export function typingDots(e, t, a, b) {
  vis(e, P(t, a, a + .06) * (1 - P(t, b - .04, b)))
  e.style.display = t >= a && t < b ? 'flex' : 'none'
  e.querySelectorAll('i').forEach((d, k) => { d.style.opacity = (.3 + .7 * Math.max(0, Math.sin((t * 2.6 - k * .22) * Math.PI))).toFixed(3) })
}


export function chatPanel(parent, title, sub) {
  const p = h('div', 'panel', parent)
  p.style.width = M({ land: '660px', sq: '660px', tall: '900px', port: '940px' })
  p.innerHTML = `<div class="top"><div class="stile">${spark(22)}</div><div><div class="ptitle">${title}</div><div class="psub">${sub}</div></div><div class="pill"><span class="gd"></span>Online</div></div><div class="msgs"></div>`
  return { p, msgs: p.querySelector('.msgs') }
}


/* ============================================================
   END CARD: the dot finds its place and the wordmark draws around it

   line   the voiceover line that says the name and the tagline
   tag    the tagline as set, first and last the words it keys off
   The dot starts at the centre, where the scene before leaves it.
   ============================================================ */
export function endCard(s, { line: n, tag: tagText, first, last }) {
  const L = M({ land: { w: 860, y: -110, tag: 150, url: 280 }, port: { w: 820, y: -170, tag: 110, url: 240 }, sq: { w: 700, y: -130, tag: 110, url: 230 }, tall: { w: 760, y: -150, tag: 110, url: 240 } })
  const glow = h('div', 'abs', s.cam); Object.assign(glow.style, { width: '1000px', height: '1000px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(233,172,87,.30), rgba(233,172,87,.06) 55%, transparent)' })
  const mark = h('div', 'abs mark', s.cam, WORDMARK())
  mark.firstChild.setAttribute('width', L.w)
  const el = k => mark.querySelector(`[data-k="${k}"]`)
  const strokes = ['n', 'ab', 'as', 'bs', 'bb', 'l'].map(k => el(k))
  el('dot').style.display = 'none'
  const u = L.w / 273
  const dot = h('div', 'abs', s.cam); Object.assign(dot.style, { width: 13 * u + 'px', height: 13 * u + 'px', background: '#E9AC57', boxShadow: '0 0 30px rgba(233,172,87,.7)' })
  const ring = h('div', 'ring', s.cam); ring.style.width = ring.style.height = '120px'
  const tag = h('div', 'abs tagline', s.cam)
  const tw = words(tag, tagText)
  const tdot = h('span', 'sqdot', tag)
  const url = h('div', 'abs url', s.cam, `<span class="cta">Book a free discovery call</span><span class="sep"></span><span>nabl.agency</span>`)
  const tN = wt(n, 'n.abl'), tPut = wt(n, first), tWork = we(n, last)
  const dotC = [(-273 / 2 + 84.5) * u, L.y + (-50 + 75.5) * u]
  const startS = M({ land: 46, def: 40 }) / (13 * u)
  const draw = [[.15, .75], [.3, .85], [.55, .85], [.55, .8], [.65, 1.0], [.75, 1.0]].map(([a, b]) => [s.t0 + a, s.t0 + b])
  cue('draw', draw[0][0], { d: 1.0 })
  cue('thud', tN, { v: 1 })
  cue('shimmer', tN + .02, { d: 2.5, v: .7 })
  cue('pop', tPut, { v: .35 })
  cue('pop', tWork + .35, { v: .45 })

  return t => {
    camera(s, t, { inT: 'none', outT: 'none', push: .025 })
    vis(s.rig, 1 - P(t, s.t1 - .5, s.t1, E.in2))
    const hitK = bell(t, tN, tN + .05, tN + .4)
    put(mark, { y: L.y + hitK * 5 })
    // a finished stroke drops its dash: a dash ending where it began leaves a hairline seam on the bowls
    strokes.forEach((e, i) => { const p = P(t, draw[i][0], draw[i][1], E.io); e.style.strokeDasharray = p >= 1 ? 'none' : '1 1'; e.style.strokeDashoffset = p >= 1 ? '0' : (1 - p).toFixed(4); e.style.opacity = p > 0 ? 1 : 0 })
    const mv = P(t, s.t0 + .1, tN - .05, E.io)
    const land = bell(t, tN - .02, tN + .06, tN + .35, E.out)
    put(dot, { x: lerp(0, dotC[0], mv), y: lerp(0, dotC[1], mv), s: lerp(startS, 1, mv) * (1 + .5 * land) })
    const g = .5 + .5 * bell(t, tN, tN + .08, tN + 1.4)
    put(glow, { x: dotC[0] * .3, y: L.y, s: .8 + .3 * g, o: g })
    const rp = P(t, tN, tN + .9, E.out)
    put(ring, { x: dotC[0], y: dotC[1], s: lerp(.2, 6, rp), o: t >= tN ? (1 - rp) * .85 : 0 })
    mark.firstChild.style.filter = `drop-shadow(0 0 ${(30 * hitK).toFixed(1)}px rgba(233,172,87,.5))`
    put(tag, { y: L.tag })
    tw.forEach((w, i) => rise(w, t, tPut + i * .1 - .06, { dur: .34, dy: 30, blur: 16 }))
    const dp = P(t, tWork, tWork + .3, E.back); tdot.style.transform = `scale(${dp.toFixed(3)})`; vis(tdot, dp > 0 ? 1 : 0)
    const up = P(t, tWork + .3, tWork + .7)
    put(url, { y: L.url + (1 - up) * 18, o: up, blur: (1 - up) * 8 })
  }
}

/* ---------- ground: blooms, grid, flash, wipes, the corner mark ---------- */

export const sceneById = id => TL.scenes.find(s => s.id === id)
let FILM = null
function ground_(t) {
  const sc = sceneById
  const K = FILM.ground
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
  grid.style.opacity = (v[7] * .8).toFixed(3)
  grid.style.backgroundPosition = `${(t * 14).toFixed(1)}px ${(t * 7).toFixed(1)}px`
  vis(flash, Math.max(0, v[3] - 1) * 2.2)
  // square wipes: cover, then open a square hole onto the next scene
  const diag = Math.hypot(W, H) * 1.05
  let so = 0, ss = 0, ho = 0, hs = 0
  for (const w of WIPES) {
    if (t >= w.t - .2 && t < w.t) { so = 1; ss = diag * E.in2(P(t, w.t - .2, w.t, E.lin)) }
    if (t >= w.t && t < w.t + .3) { ho = 1; hs = diag * P(t, w.t, w.t + .3, E.out) }
  }
  put(wipeSolid, { s: ss / 100, r: 45, o: so })
  put(wipeHole, { s: Math.max(.001, hs / 100), r: 45, o: ho })
  // the corner mark, from the business onwards and never on the end card
  const [b0, b1] = FILM.bug.map(sc)
  const bo = P(t, b0.start, b0.start + .3) * (1 - P(t, b1.start - .2, b1.start))
  const bp = M({ land: [W / 2 - 112, H / 2 - 62], port: [0, -H / 2 + 96], def: [W / 2 - 100, H / 2 - 56] })
  put(bug, { x: bp[0], y: bp[1], o: bo * .75 })
}

/* ---------- boot ---------- */

/* ---------- boot ---------- */
export const FILM_ID = Q.get('film') || 'ai'
async function boot() {
  TL = await (await fetch(`/marketing/launch-video/build/${FILM_ID}/timeline.json`)).json()
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `/marketing/launch-video/films/${FILM_ID}/scenes.css`
  await new Promise(r => { css.onload = r; css.onerror = r; document.head.appendChild(css) })
  await document.fonts.ready
  await Promise.all(['600 100px "Space Grotesk"', '700 100px "Space Grotesk"', '500 20px "Inter Tight"', '600 20px "Inter Tight"', '500 20px "JetBrains Mono"'].map(f => document.fonts.load(f)))
  // the film registers its scenes and hands back its ground: bloom keyframes and the corner mark's span
  const mod = await import(`/marketing/launch-video/films/${FILM_ID}/scenes.js`)
  FILM = mod.default()
  CUES.sort((a, b) => a.t - b.t)
  window.CUES = CUES
  window.TL = TL
  window.MODE = MODE
  window.seek = t => {
    for (const s of SCENES) {
      const on = t >= s.t0 && t < s.t1 + s.hold
      if (on) { s.root.style.display = 'block'; s.render(t) } else s.root.style.display = 'none'
    }
    ground_(t)
  }
  // prime every scene once so first frames never measure an empty layout
  for (const s of SCENES) { s.root.style.display = 'block'; s.render(s.t0 + .01); s.root.style.display = 'none' }
  window.seek(+(Q.get('t') || 0))
  window.READY = true
}
boot().catch(e => { window.ERROR = String(e && e.stack || e); console.error(e) })
