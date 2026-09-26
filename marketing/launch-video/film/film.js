/* ============================================================
   PUT AI TO WORK: the film

   One page, sampled by time. window.seek(t) puts every element where it
   belongs at t seconds, so the renderer can ask for any frame in any
   order and get the same picture. Nothing here runs on its own clock.

   The timing comes from build/timeline.json, which vo.py writes from the
   synthesised voice: scenes start on beats, words carry their own times,
   and the animation keys off them by name ("appointments", "escalate").

   Every frame is 1080 px on its short side, so one CSS pixel is one unit
   in all four aspect ratios and only the layout changes between them.

   The curves are the site's own: EASE and EASE_OUT are --ease and
   --ease-out from src/styles/tokens.css.
   ============================================================ */

import { bezier, EASE, EASE_OUT, EASE_IO, lerp, arc } from '/src/components/scenes/engine.js'

const Q = new URLSearchParams(location.search)
const W = +(Q.get('w') || 1920), H = +(Q.get('h') || 1080)
const R = W / H
const MODE = R > 1.3 ? 'land' : R > 0.95 ? 'sq' : R > 0.7 ? 'tall' : 'port'
const M = o => (MODE in o ? o[MODE] : o.def)
const LAND = MODE === 'land'

/* ---------- easing ---------- */
const E = {
  ease: EASE, out: EASE_OUT, io: EASE_IO, lin: x => x,
  in2: x => x * x, in3: x => x * x * x, out2: x => 1 - (1 - x) * (1 - x),
  back: bezier(.34, 1.56, .64, 1), snap: bezier(.2, 1.5, .4, 1),
}
const P = (t, a, b, e = E.out) => (t <= a ? 0 : t >= b ? 1 : e((t - a) / (b - a)))
const bell = (t, a, b, c, e = E.out) => P(t, a, b, e) * (1 - P(t, b, c, E.io))
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }

/* ---------- DOM ---------- */
function h(tag, cls, parent, html) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  if (parent) parent.appendChild(e)
  return e
}
function vis(e, o) { e.style.opacity = o.toFixed(4); e.style.visibility = o <= 0.002 ? 'hidden' : 'visible' }
/* place an .abs element: x, y from the stage centre, in px */
function put(e, { x = 0, y = 0, z = 0, s = 1, r = 0, rx = 0, ry = 0, o = 1, blur = 0, bright } = {}) {
  e.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})`
  vis(e, o)
  let f = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : ''
  if (bright != null && Math.abs(bright - 1) > .005) f += ` brightness(${bright.toFixed(3)})`
  e.style.filter = f || 'none'
}
function words(parent, text) {
  return text.split(' ').map((w, i) => {
    if (i) parent.appendChild(document.createTextNode(' '))
    const s = h('span', 'w', parent); s.textContent = w; return s
  })
}
/* blur-in, rise: the text entrance the film uses throughout */
function rise(e, t, t0, { dur = .4, dy = 30, blur = 16, s0 = 1 } = {}) {
  const p = P(t, t0, t0 + dur, E.out)
  e.style.transform = `translateY(${((1 - p) * dy).toFixed(2)}px) scale(${lerp(s0, 1, p).toFixed(4)})`
  vis(e, p)
  e.style.filter = p < 0.999 ? `blur(${((1 - p) * blur).toFixed(2)}px)` : 'none'
}
/* in on one beat, out on another: the slot-machine swap */
function slot(e, t, a, b, { dy = 120, dur = .3, out = .22 } = {}) {
  const pi = P(t, a, a + dur, E.out), po = b == null ? 0 : P(t, b, b + out, E.in2)
  const y = (1 - pi) * dy - po * dy
  e.style.transform = `translate(-50%,-50%) translate(${e._x || 0}px,${((e._y || 0) + y).toFixed(2)}px) scale(${(lerp(.9, 1, pi) * lerp(1, 1.06, po)).toFixed(4)})`
  vis(e, pi * (1 - po))
  const bl = (1 - pi) * 18 + po * 18
  e.style.filter = bl > .05 ? `blur(${bl.toFixed(2)}px)` : 'none'
}
function offs(e, root) {
  let x = 0, y = 0, n = e
  while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent }
  return { x, y, w: e.offsetWidth, h: e.offsetHeight }
}

/* ---------- marks and icons ---------- */
const SPARK = 'M0 -10 C1 -2.5 2.5 -1 10 0 C2.5 1 1 2.5 0 10 C-1 2.5 -2.5 1 -10 0 C-2.5 -1 -1 -2.5 0 -10 Z'
const spark = (size, fill = '#E9AC57') => `<svg width="${size}" height="${size}" viewBox="-10 -10 20 20" style="overflow:visible"><path d="${SPARK}" fill="${fill}"/></svg>`
const CHECK = (c = '#B9D4B3', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const STAR = c => `<svg viewBox="-12 -12 24 24" width="100%" height="100%"><path d="M0 -11 L3.2 -3.6 L11 -3.2 L5 2 L7 10 L0 5.6 L-7 10 L-5 2 L-11 -3.2 L-3.2 -3.6 Z" fill="${c}"/></svg>`
/* the wordmark, from public/brand/wordmark.svg: same paths, same 13-unit stroke */
const WORDMARK = (cls = '') => `<svg class="${cls}" viewBox="0 0 273 100">
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
const I = {
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
const icon = k => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`

/* ---------- the timeline ---------- */
let TL
const CUES = []
const cue = (type, t, o = {}) => { CUES.push({ type, t: +t.toFixed(4), ...o }) }
const norm = s => s.toLowerCase().replace(/[“”"…,?!:;]/g, '').replace(/\.$/, '')
function lineWords(n) { return TL.lines[n - 1].sentences.flatMap(s => s.words) }
function wt(n, key, k = 0, end = false) {
  let c = 0
  for (const w of lineWords(n)) if (norm(w.w) === key) { if (c++ === k) return end ? w.end : w.start }
  throw new Error(`no "${key}" in line ${n}`)
}
const we = (n, key, k = 0) => wt(n, key, k, true)
const lineStart = n => TL.lines[n - 1].start

/* ---------- the stage ---------- */
const stage = document.getElementById('stage')
stage.style.width = W + 'px'; stage.style.height = H + 'px'
document.body.classList.add('m-' + MODE)
const ground = h('div', 'layer', stage)
const bloomA = h('div', 'bloom bloom--a', ground)
const bloomC = h('div', 'bloom bloom--c', ground)
const grid = h('div', 'layer grid', ground)
const scenesEl = h('div', 'layer', stage)
const fx = h('div', 'layer', stage)
const flash = h('div', 'layer', fx)
flash.style.background = 'radial-gradient(circle at 50% 50%, rgba(233,172,87,.6), rgba(233,172,87,.14) 38%, transparent 72%)'
/* the square wipe: a solid square that covers, then a square hole that reveals */
const wipeSolid = h('div', 'abs', fx); Object.assign(wipeSolid.style, { width: '100px', height: '100px', background: '#E9AC57' })
const wipeHole = h('div', 'abs', fx); Object.assign(wipeHole.style, { width: '100px', height: '100px', boxShadow: '0 0 0 4000px #E9AC57' })
const bug = h('div', 'bug', fx, WORDMARK())
bug.style.width = M({ land: '132px', def: '120px' })
h('div', 'layer vignette', stage)
/* directional blur for whip pans: one filter per scene, set per frame */
const defs = h('div', '', stage, '<svg width="0" height="0" style="position:absolute"><defs></defs></svg>').querySelector('defs')

const SCENES = []
const WIPES = []
function scene(ids, build, { hold = 0 } = {}) {
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
function camera(s, t, { inT = 'rise', outT = 'rise', inDur = .32, outDur = .24, push = .04 } = {}) {
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
function focus(s, t, keys) {
  let i = 0; while (i < keys.length - 2 && t >= keys[i + 1][0]) i++
  const a = keys[i], b = keys[i + 1], p = P(t, a[0], b[0], E.io)
  const v = k => lerp(a[k] || 0, b[k] || 0, p)
  const sc = lerp(a[3] ?? 1, b[3] ?? 1, p)
  s.cam.style.transform = `rotateY(${v(4).toFixed(2)}deg) rotateX(${v(5).toFixed(2)}deg) scale(${sc.toFixed(4)}) translate(${(-v(1)).toFixed(2)}px,${(-v(2)).toFixed(2)}px)`
}
/* the label that names each agent */
function label(s, no, eyebrow, title, at) {
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
function bubble(parent, cls, html) { return h('div', 'bub ' + cls, parent, html) }
function pop(e, t, t0, { dur = .28 } = {}) {
  const p = P(t, t0, t0 + dur, E.snap)
  e.style.transform = `translateY(${((1 - Math.min(1, p)) * 16).toFixed(1)}px) scale(${lerp(.7, 1, p).toFixed(4)})`
  vis(e, P(t, t0, t0 + .08))
}
function typingDots(e, t, a, b) {
  vis(e, P(t, a, a + .06) * (1 - P(t, b - .04, b)))
  e.style.display = t >= a && t < b ? 'flex' : 'none'
  e.querySelectorAll('i').forEach((d, k) => { d.style.opacity = (.3 + .7 * Math.max(0, Math.sin((t * 2.6 - k * .22) * Math.PI))).toFixed(3) })
}

/* ============================================================
   01 + 02 · BOOT: the world gets a new operating system, and it is AI
   ============================================================ */
function buildBoot(s) {
  const [boot, ai] = s.cuts
  const L = M({
    land: { g: [540, -10], R: 320, txt: [-340, 30], align: 'left', tw: 1060, chip: [-340, -230] },
    port: { g: [0, -360], R: 330, txt: [0, 330], align: 'center', tw: 980, chip: [0, 590] },
    sq:   { g: [0, -190], R: 250, txt: [0, 290], align: 'center', tw: 980, chip: [0, -460] },
    tall: { g: [0, -250], R: 280, txt: [0, 330], align: 'center', tw: 980, chip: [0, 560] },
  })
  // the globe is drawn on a canvas: a Fibonacci sphere of dots, turning
  const cv = h('canvas', 'full', s.cam); cv.width = W; cv.height = H
  const g = cv.getContext('2d')
  const N = 900, pts = []
  for (let i = 0; i < N; i++) {
    const yy = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - yy * yy), th = i * 2.399963
    pts.push([Math.cos(th) * r, yy, Math.sin(th) * r, i % 19 === 0])
  }
  const chip = h('div', 'abs chipbar', s.cam, `${spark(18)}<span data-l>Installing AI</span><span class="track"><span class="fill"></span></span><span class="pct">0%</span>`)
  const fill = chip.querySelector('.fill'), pct = chip.querySelector('.pct'), lab = chip.querySelector('[data-l]')
  const tx = h('div', 'abs', s.cam); tx.style.width = L.tw + 'px'; tx.style.textAlign = L.align
  const l1 = h('div', 'display bootline nowrap', tx), l2 = h('div', 'display bootline nowrap', tx)
  const w1 = words(l1, 'The world just got a')
  const w2a = words(l2, 'new')
  l2.appendChild(document.createTextNode(' '))
  const os = h('span', '', l2); os.style.position = 'relative'; os.style.display = 'inline-block'
  const w2b = words(os, 'operating system.')
  const ul = h('span', 'uline', os)
  // the reveal
  const ag = h('div', 'abs', s.cam); ag.style.textAlign = 'center'; ag.style.width = 'max-content'
  const called = h('div', 'display', ag); called.style.fontSize = M({ land: '64px', def: '56px' }); called.style.color = '#C8BBA8'
  called.style.marginBottom = '28px'
  const cw = words(called, "It's called")
  const aiw = h('div', 'aiword', ag); aiw.textContent = 'AI'
  const sp = h('div', 'abs', s.cam, spark(M({ land: 170, def: 140 })))
  const rays = Array.from({ length: 28 }, () => h('div', 'ray', s.cam))
  const bits = Array.from({ length: 44 }, () => h('div', 'bit', s.cam))
  const rings = [0, 1, 2].map(() => { const r = h('div', 'ring', s.cam); r.style.width = r.style.height = '200px'; return r })
  const r = rng(5)
  rays.forEach((e, i) => { e._a = (i / rays.length) * 360 + r() * 8; e._l = 380 + r() * 520; e.style.width = '10px' })
  bits.forEach(e => { e._a = r() * Math.PI * 2; e._v = 500 + r() * 1100; e._s = 6 + r() * 12; e._r = r() * 180; e.style.width = e.style.height = e._s + 'px' })

  const tNew = wt(1, 'new'), tOp = wt(1, 'operating'), tSys = we(1, 'system')
  const tIts = wt(2, "it's"), tAI = wt(2, 'ai')
  const tDone = boot.end - .12
  cue('boot', .05)
  cue('tick', tDone, { v: .9 })
  cue('riser', tAI, { d: tAI - .3 })
  cue('implode', tAI - .02, { d: tAI - ai.start })
  cue('impact', tAI, { v: 1.1 })
  cue('shimmer', tAI + .04, { d: 1.6 })
  cue('whoosh', s.t1 - .3, { d: .45, v: .9 })
  s.flashAt = tAI

  return t => {
    camera(s, t, { inT: 'none', outT: 'through', outDur: .3, push: .03 })
    // globe: grows out of a single dot, turns, then falls into the reveal
    const grow = P(t, -.5, .9, E.out)
    const fall = P(t, ai.start - .05, tAI - .02, E.in3)
    const gx = lerp(L.g[0], 0, fall), gy = lerp(L.g[1], 0, fall)
    const R0 = L.R * (1 + .03 * Math.sin(t * 2))
    const rot = t * .75, tilt = .38
    g.clearRect(0, 0, W, H)
    const cx = W / 2 + gx, cy = H / 2 + gy
    if (fall < 1) {
      g.lineWidth = 1.2
      for (const lat of [-.5, 0, .5]) {
        const rr = Math.sqrt(1 - lat * lat) * R0 * grow * (1 - fall)
        g.strokeStyle = `rgba(240,231,216,${(.10 * grow * (1 - fall)).toFixed(3)})`
        g.beginPath(); g.ellipse(cx, cy + lat * R0 * grow * Math.cos(tilt) * (1 - fall), rr, rr * Math.sin(tilt), 0, 0, Math.PI * 2); g.stroke()
      }
    }
    for (let i = 0; i < N; i++) {
      const [px, py, pz, am] = pts[i]
      const x1 = px * Math.cos(rot) + pz * Math.sin(rot), z1 = -px * Math.sin(rot) + pz * Math.cos(rot)
      const y2 = py * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = py * Math.sin(tilt) + z1 * Math.cos(tilt)
      const gi = P(grow, (i % 97) / 97 * .5, (i % 97) / 97 * .5 + .5, E.out)
      const fi = P(fall, (i % 53) / 53 * .4, 1, E.in2)
      const rr = R0 * gi * (1 - fi)
      const X = cx + x1 * rr, Y = cy + y2 * rr
      const depth = (z2 + 1) / 2
      const a = (.28 + .72 * depth) * gi
      const sz = (1.6 + 2.8 * depth) * (1 - .6 * fi)
      g.fillStyle = am ? `rgba(233,172,87,${Math.min(1, a * 1.3).toFixed(3)})` : `rgba(240,231,216,${a.toFixed(3)})`
      g.fillRect(X - sz / 2, Y - sz / 2, sz, sz)
    }
    // the installing chip
    const cp = 1 - P(t, ai.start - .05, ai.start + .15)
    put(chip, { x: L.chip[0], y: L.chip[1], o: cp })
    const prog = P(t, .05, tDone, E.io)
    fill.style.transform = `scaleX(${prog.toFixed(4)})`
    pct.textContent = Math.round(prog * 100) + '%'
    const done = t >= tDone ? 'AI installed' : 'Installing AI'
    if (lab.textContent !== done) lab.textContent = done
    // the line
    const txOut = P(t, ai.start - .05, ai.start + .2, E.in2)
    put(tx, { x: L.txt[0], y: L.txt[1] - txOut * 40, o: 1 - txOut, blur: txOut * 16 })
    const k1 = ['the', 'world', 'just', 'got', 'a']
    w1.forEach((w, i) => rise(w, t, wt(1, k1[i]) - .06, { dur: .34, dy: 34 }))
    rise(w2a[0], t, tNew - .06, { dur: .34, dy: 34 })
    w2b.forEach((w, i) => rise(w, t, [tOp, wt(1, 'system')][i] - .06, { dur: .34, dy: 34 }))
    ul.style.transform = `scaleX(${P(t, tOp, tSys, E.ease).toFixed(4)})`
    // the reveal
    const ain = P(t, tAI - .02, tAI + .32, E.out)
    put(ag, { y: M({ land: 10, def: 0 }), s: lerp(1.5, 1, ain) * (1 + .03 * P(t, tAI + .3, s.t1)), o: P(t, tIts - .08, tIts + .1) })
    cw.forEach((w, i) => rise(w, t, [tIts, wt(2, 'called')][i] - .05, { dur: .3, dy: 20 }))
    vis(aiw, P(t, tAI - .02, tAI + .06)); aiw.style.filter = ain < 1 ? `blur(${((1 - ain) * 26).toFixed(1)}px)` : 'none'
    const spin = P(t, tAI, tAI + .5, E.back)
    const aiW = aiw.offsetWidth, aiH = aiw.offsetHeight
    put(sp, { x: aiW * .52, y: -aiH * .38 + M({ land: 10, def: 0 }), s: spin * (1 + .06 * Math.sin((t - tAI) * 6) * P(t, tAI + .5, tAI + .8)), r: (1 - spin) * -140, o: P(t, tAI, tAI + .05) })
    sp.style.filter = `drop-shadow(0 0 ${(30 + 50 * bell(t, tAI, tAI + .08, tAI + 1)).toFixed(0)}px rgba(233,172,87,.8))`
    rays.forEach(e => {
      const p = P(t, tAI, tAI + .55, E.out)
      e.style.width = (e._l * p) + 'px'
      e.style.transform = `rotate(${e._a}deg) translateX(${(80 + e._l * .6 * p).toFixed(1)}px)`
      vis(e, t >= tAI ? (1 - P(t, tAI + .1, tAI + .6)) * .9 : 0)
    })
    bits.forEach(e => {
      const dt = Math.max(0, t - tAI), d = e._v * (1 - Math.exp(-dt * 3.2)) / 3.2
      e.style.transform = `translate(-50%,-50%) translate(${(Math.cos(e._a) * d).toFixed(1)}px,${(Math.sin(e._a) * d).toFixed(1)}px) rotate(${(e._r + dt * 200).toFixed(0)}deg)`
      vis(e, t >= tAI ? 1 - P(t, tAI + .25, tAI + 1.1) : 0)
    })
    rings.forEach((rg, k) => {
      const p = P(t, tAI + k * .08, tAI + .9 + k * .18, E.out)
      put(rg, { s: lerp(.2, 7 + k * 2, p), o: t >= tAI + k * .08 ? (1 - p) * (k ? .5 : .9) : 0 })
    })
  }
}

/* ============================================================
   03 · INTO YOUR BUSINESS: a flight through the business, lighting it up
   ============================================================ */
function buildInto(s) {
  const n = 3
  const TILES = [['Calendar', 'cal'], ['Inbox', 'inbox'], ['Live chat', 'chat'], ['Invoices', 'invoice'], ['Reviews', 'star'], ['CRM', 'db'], ['Phone calls', 'phone'],
    ['Orders', 'box'], ['Reports', 'chart'], ['Quotes', 'quote'], ['Payments', 'card'], ['Support', 'help'], ['Stock', 'stack'], ['Team', 'team'], ['Bookings', 'clock'], ['Leads', 'lead']]
  const Rx = M({ land: 700, port: 400, sq: 470, tall: 430 }), Ry = M({ land: 380, port: 720, sq: 400, tall: 520 })
  const field = h('div', 'plane', s.cam)
  const r = rng(21)
  const tiles = TILES.map(([nm, ic], i) => {
    const e = h('div', 'tile', field, `<div class="ic">${icon(ic)}</div><div><div class="nm">${nm}</div><div class="st"><i></i>Connected</div></div>`)
    const a = i * 2.399963 + .4
    e._x = Math.cos(a) * Rx * (.85 + .35 * r()); e._y = Math.sin(a) * Ry * (.8 + .35 * r())
    e._z = -3400 + i * 215; e._r = (r() - .5) * 16
    return e
  })
  const scrim = h('div', 'layer', s.cam)
  scrim.style.background = 'radial-gradient(ellipse 42% 30% at 50% 50%, rgba(14,12,10,.92), rgba(14,12,10,.6) 60%, rgba(14,12,10,0) 100%)'
  const tx = h('div', 'abs display', s.cam)
  tx.style.fontSize = M({ land: '100px', port: '86px', def: '80px' }); tx.style.textAlign = 'center'; tx.style.width = 'max-content'
  const a1 = h('div', 'nowrap', tx), a2 = h('div', 'nowrap', tx), a3 = LAND ? a2 : h('div', 'nowrap', tx)
  const wAnd = words(a1, 'And')[0]
  a1.appendChild(document.createTextNode(' '))
  const wm = h('span', 'w', a1, WORDMARK()); wm.firstChild.style.height = '.86em'; wm.firstChild.style.width = 'auto'; wm.firstChild.style.verticalAlign = '-.16em'
  const wb = LAND ? (a1.appendChild(document.createTextNode(' ')), words(a1, 'builds it')) : words(a2, 'builds it')
  if (!LAND) a2.appendChild(document.createTextNode(' '))
  const w2 = [...words(a2, 'into'), ...(LAND ? (a2.appendChild(document.createTextNode(' ')), []) : []), ...words(a3, 'your business.')]
  const dolly = t => lerp(0, 2900, P(t, s.t0 - .2, s.t1 + .35, E.io))
  // when each tile comes close enough to light up
  const lit = tiles.map(e => { for (let t = s.t0; t < s.t1 + .5; t += .01) if (e._z + dolly(t) > -900) return t; return 99 })
  lit.forEach(x => { if (x < s.t1) cue('blip', x, { v: .35 }) })
  cue('whoosh', s.t0 + .05, { d: 1.2, v: .6 })
  WIPES.push({ t: s.t1 })
  cue('wipe', s.t1)
  const keys = [['and', wAnd], ['builds', wb[0]], ['it', wb[1]], ['into', w2[0]], ['your', w2[1]], ['business', w2[2]]]
  const tAbl = wt(n, 'n.abl')

  return t => {
    camera(s, t, { inT: 'zoom', outT: 'none', inDur: .4 })
    const D = dolly(t)
    tiles.forEach((e, i) => {
      const z = e._z + D
      const o = P(z, -3300, -2300, E.lin) * (1 - P(z, 700, 1150, E.lin))
      put(e, { x: e._x, y: e._y, z, r: e._r, o, bright: lerp(.55, 1, P(z, -2600, -900, E.lin)) })
      e.classList.toggle('on', t >= lit[i])
    })
    put(tx, { y: 0, s: 1 + .03 * P(t, s.t0, s.t1) })
    keys.forEach(([k, w]) => rise(w, t, wt(n, k) - .06, { dur: .32, dy: 30 }))
    rise(wm, t, tAbl - .06, { dur: .32, dy: 30 })
  }
}

/* ============================================================
   04 · 05 · 06 · CUSTOMER AGENTS: bookings, questions, complaints
   ============================================================ */
function chatPanel(parent, title, sub) {
  const p = h('div', 'panel', parent)
  p.style.width = M({ land: '660px', sq: '660px', tall: '900px', port: '940px' })
  p.innerHTML = `<div class="top"><div class="stile">${spark(22)}</div><div><div class="ptitle">${title}</div><div class="psub">${sub}</div></div><div class="pill"><span class="gd"></span>Online</div></div><div class="msgs"></div>`
  return { p, msgs: p.querySelector('.msgs') }
}

function buildBook(s) {
  const n = 4
  const lab = label(s, '01', 'Customer agents', 'Books appointments', lineStart(n))
  const L = M({
    land: { chat: [-330, 70], cs: 1, cal: [430, 80], ks: 1 },
    port: { chat: [0, -120], cs: 1, cal: [0, 490], ks: 1 },
    sq:   { chat: [-262, 86], cs: .74, cal: [278, 96], ks: .72 },
    tall: { chat: [0, -110], cs: .86, cal: [0, 440], ks: .86 },
  })
  const { p: chat, msgs } = chatPanel(s.cam, 'Booking assistant', 'On your website, 24/7')
  const c1 = bubble(msgs, 'me', 'Hi! Can I book in for Friday afternoon?')
  const ty = h('div', 'typing', msgs, '<i></i><i></i><i></i>')
  const a1 = bubble(msgs, 'ai', 'Friday at <b>2pm</b> is free. Shall I book you in?')
  const c2 = bubble(msgs, 'me', 'Yes please!')
  const a2 = bubble(msgs, 'ai', `Done! You're booked in for <b>Friday, 2pm</b>. ${CHECK('#E9AC57', 18)}`)
  const cal = h('div', 'panel cal', s.cam)
  cal.style.width = M({ land: '600px', sq: '600px', tall: '900px', port: '940px' })
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], TIMES = ['10:00', '12:00', '14:00', '16:00']
  const BUSY = new Set(['0-0', '1-1', '2-2', '3-0', '4-0', '0-3', '2-1', '1-3', '3-2'])
  cal.innerHTML = `<div class="top"><div class="stile">${icon('cal').replace('<svg', '<svg width="24" height="24" style="color:#F2C57E"')}</div><div><div class="ptitle">Diary</div><div class="psub">This week</div></div><div class="pill" data-p>2 free slots</div></div><div class="grid7"><div></div>${DAYS.map(d => `<div class="dh">${d}</div>`).join('')}${TIMES.map((tm, r) => `<div class="tm">${tm}</div>${DAYS.map((d, c) => `<div class="slot${BUSY.has(c + '-' + r) ? ' busy' : ''}" data-s="${c}-${r}"></div>`).join('')}`).join('')}</div>`
  const target = cal.querySelector('[data-s="4-2"]')
  const ring2 = h('div', 'ring2', target), bk = h('div', 'bk', target, `${CHECK('#24170A', 16)}Booked`)
  const pill = cal.querySelector('[data-p]')
  const confetti = Array.from({ length: 16 }, () => h('div', 'bit', s.cam))
  const r = rng(9); confetti.forEach(e => { e._a = r() * Math.PI * 2; e._v = 180 + r() * 260; e._s = 6 + r() * 8; e.style.width = e.style.height = e._s + 'px' })
  const tC = wt(n, 'customer'), tBook = wt(n, 'book'), tAppt = wt(n, 'appointments')
  const T = { c1: tC - .1, ty: [tC + .25, tC + .62], a1: tC + .62, c2: tBook + .02, a2: tAppt + .05 }
  cue('send', T.c1); cue('recv', T.a1); cue('send', T.c2); cue('recv', T.a2); cue('hit', T.a2 + .12, { v: .55 }); cue('tick', T.a2 + .14, { v: .8 })
  cue('whip', s.t1 - .12)
  let geo

  return t => {
    camera(s, t, { inT: 'none', outT: 'whip', outDur: .22 })
    focus(s, t, [[s.t0, 0, LAND ? 20 : 0, M({ land: 1.14, sq: 1, def: 1.04 }), -5, 2], [s.t1, 0, LAND ? 20 : 0, M({ land: 1.2, sq: 1.04, def: 1.1 }), 4, 0]])
    lab(t)
    put(chat, { x: L.chat[0], y: L.chat[1] + (1 - P(t, s.t0, s.t0 + .4)) * 60, s: L.cs, o: P(t, s.t0, s.t0 + .2) })
    put(cal, { x: L.cal[0], y: L.cal[1] + (1 - P(t, s.t0 + .08, s.t0 + .5)) * 60, s: L.ks, o: P(t, s.t0 + .08, s.t0 + .28) })
    pop(c1, t, T.c1); typingDots(ty, t, T.ty[0], T.ty[1]); pop(a1, t, T.a1); pop(c2, t, T.c2); pop(a2, t, T.a2)
    vis(ring2, bell(t, T.a1, T.a1 + .1, T.a2 + .05) * (.6 + .4 * Math.sin(t * 20)))
    const bp = P(t, T.a2 + .08, T.a2 + .35, E.snap)
    vis(bk, P(t, T.a2 + .08, T.a2 + .14)); bk.style.transform = `scale(${lerp(.6, 1, bp).toFixed(3)})`
    const pl = t >= T.a2 + .1 ? '1 free slot' : '2 free slots'
    if (pill.textContent !== pl) pill.textContent = pl
    if (!geo) geo = offs(target, cal)
    const tc = [L.cal[0] + (geo.x + geo.w / 2 - cal.offsetWidth / 2) * L.ks, L.cal[1] + (geo.y + geo.h / 2 - cal.offsetHeight / 2) * L.ks]
    confetti.forEach(e => {
      const dt = Math.max(0, t - T.a2 - .1), d = e._v * (1 - Math.exp(-dt * 5))
      e.style.transform = `translate(-50%,-50%) translate(${(tc[0] + Math.cos(e._a) * d).toFixed(1)}px,${(tc[1] + Math.sin(e._a) * d + dt * dt * 300).toFixed(1)}px) rotate(${(dt * 400).toFixed(0)}deg)`
      vis(e, t >= T.a2 + .1 ? 1 - P(t, T.a2 + .5, T.a2 + .9) : 0)
    })
  }
}

function buildFaq(s) {
  const n = 5
  const lab = label(s, '02', 'Customer agents', 'Answers questions 24/7', lineStart(n))
  const L = M({
    land: { chat: [-330, 70], cs: 1, dial: [430, 10], ds: 1, clock: [430, 330] },
    port: { chat: [0, -150], cs: 1, dial: [-200, 480], ds: .74, clock: [230, 480] },
    sq:   { chat: [-262, 86], cs: .74, dial: [278, 30], ds: .66, clock: [278, 280] },
    tall: { chat: [0, -150], cs: .86, dial: [-190, 440], ds: .66, clock: [220, 440] },
  })
  const { p: chat, msgs } = chatPanel(s.cam, 'Help desk', 'Answers from your own information')
  const QA = [['Are you open on Sundays?', 'Yes, <b>10am to 4pm</b>.'], ['Do you deliver?', 'We do, free over <b>£50</b>.'], ['Where can I park?', 'Right outside, free after <b>6pm</b>.']]
  const bs = QA.flatMap(([q, a]) => [bubble(msgs, 'me', q), bubble(msgs, 'ai', a)])
  bs.forEach(b => { b.style.fontSize = M({ land: '21px', def: '22px' }); b.style.padding = '12px 18px' })
  msgs.style.gap = '10px'
  const dial = h('div', 'dial', s.cam, `<div class="sky"></div>${Array.from({ length: 14 }, () => '<div class="star"></div>').join('')}<div class="orb" data-sun></div><div class="orb" data-moon></div><div class="horizon"></div>`)
  const sky = dial.querySelector('.sky'), sun = dial.querySelector('[data-sun]'), moon = dial.querySelector('[data-moon]')
  const stars = [...dial.querySelectorAll('.star')]
  const r = rng(3); stars.forEach(e => { e.style.left = (30 + r() * 360) + 'px'; e.style.top = (30 + r() * 200) + 'px'; e._tw = r() * 6 })
  const clk = h('div', 'abs clock mc', s.cam, '<span data-c>14:00</span><small>ALWAYS ON</small>')
  const cEl = clk.querySelector('[data-c]')
  const tA = wt(n, 'answer'), tNight = wt(n, 'night')
  const bt = [tA - .08, tA + .2, tA + .48, tA + .72, tA + 1.0, tA + 1.24]
  bt.forEach((x, i) => cue(i % 2 ? 'recv' : 'send', x, { v: .7 }))
  cue('whip', s.t1 - .12)

  return t => {
    camera(s, t, { inT: 'whip', outT: 'whip', inDur: .22, outDur: .22 })
    focus(s, t, [[s.t0, 0, LAND ? 20 : 0, M({ land: 1.16, sq: 1, def: 1.06 }), 4, 0], [s.t1, 0, LAND ? 20 : 0, M({ land: 1.2, sq: 1.04, def: 1.1 }), -4, 2]])
    lab(t)
    put(chat, { x: L.chat[0], y: L.chat[1], s: L.cs })
    bs.forEach((b, i) => pop(b, t, bt[i], { dur: .24 }))
    // a day passes in two seconds
    const d = P(t, s.t0 + .1, tNight + .25, E.io)
    put(dial, { x: L.dial[0], y: L.dial[1], s: L.ds })
    const sa = Math.PI * (1 - Math.min(1, d * 1.6)), ma = Math.PI * (1 - P(d, .55, 1, E.lin))
    sun.style.transform = `translate(${(175 + Math.cos(sa) * 150).toFixed(1)}px,${(235 - Math.sin(sa) * 170).toFixed(1)}px)`
    sun.style.background = 'radial-gradient(circle, #F8D9A4, #E9AC57 60%, rgba(233,172,87,0) 72%)'
    moon.style.transform = `translate(${(175 + Math.cos(ma) * 150).toFixed(1)}px,${(235 - Math.sin(ma) * 170).toFixed(1)}px)`
    moon.style.background = 'radial-gradient(circle at 40% 40%, #FBF6EC, #DED2C0 55%, rgba(222,210,192,0) 70%)'
    vis(moon, P(d, .5, .7))
    sky.style.background = `radial-gradient(circle at 50% 70%, rgba(233,172,87,${(.45 * (1 - P(d, .3, .7))).toFixed(3)}), rgba(233,172,87,0) 70%)`
    stars.forEach(e => vis(e, P(d, .55, .85) * (.5 + .5 * Math.sin(t * 7 + e._tw))))
    const hrs = 14 + 12 * d, hh = Math.floor(hrs) % 24, mm = Math.floor((hrs % 1) * 60)
    cEl.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    put(clk, { x: L.clock[0], y: L.clock[1] })
  }
}

function buildCare(s) {
  const n = 6
  const lab = label(s, '03', 'Customer agents', 'Handles complaints and queries', lineStart(n))
  const L = M({
    land: { tk: [-300, 76], ts: 1, g: [480, 40], gs: 1 },
    port: { tk: [0, -110], ts: 1, g: [0, 520], gs: .9 },
    sq:   { tk: [-230, 90], ts: .74, g: [318, 60], gs: .7 },
    tall: { tk: [0, -110], ts: .86, g: [0, 470], gs: .8 },
  })
  const tk = h('div', 'panel ticket', s.cam)
  tk.style.width = M({ land: '760px', sq: '760px', tall: '900px', port: '940px' })
  tk.innerHTML = `<div class="top"><div class="stile">${spark(22)}</div><div><div class="ptitle">Query #2381</div><div class="psub">Email · 11:42</div></div><div class="pill" data-p></div></div>
    <div class="body"><div class="from">Jo Parker <span>jo@…</span></div><div class="text">My order arrived damaged and I need it by Saturday. Really not happy.</div>
    <div class="tags"><span class="tag bad">Complaint</span><span class="tag bad">Urgent</span><span class="tag">Order #4471</span><span class="tag amber">Replacement</span></div>
    <div class="draft"><div class="lbl">${spark(14)} REPLY</div><div class="rt"></div></div></div>`
  const pill = tk.querySelector('[data-p]')
  const tags = [...tk.querySelectorAll('.tag')]
  const rt = tk.querySelector('.rt')
  const rw = words(rt, "So sorry, Jo. A replacement ships today and arrives Friday, and we've refunded the delivery.")
  const gauge = h('div', 'gauge', s.cam, `<div class="gt">Escalation risk</div><svg width="300" height="170" viewBox="-150 -150 300 170">
    <path d="M-120 0 A120 120 0 0 1 120 0" fill="none" stroke="rgba(240,231,216,.10)" stroke-width="22" stroke-linecap="round"/>
    <path data-arc d="M-120 0 A120 120 0 0 1 120 0" fill="none" stroke="#E0796D" stroke-width="22" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1"/>
    <line data-needle x1="0" y1="0" x2="0" y2="-100" stroke="#FBF6EC" stroke-width="5" stroke-linecap="round"/><circle r="10" fill="#FBF6EC"/></svg><div class="gv" data-v>High</div>`)
  const garc = gauge.querySelector('[data-arc]'), needle = gauge.querySelector('[data-needle]'), gv = gauge.querySelector('[data-v]')
  const tHd = wt(n, 'handle'), tComp = wt(n, 'complaints'), tEsc = wt(n, 'escalate')
  const rT = rw.map((_, i) => lerp(tComp - .05, tEsc - .05, i / (rw.length - 1)))
  const tagT = tags.map((_, i) => tHd - .05 + i * .1)
  const tRes = tEsc + .15
  tagT.forEach(x => cue('pop', x, { v: .55 }))
  rw.forEach((_, i) => { if (i % 3 === 0) cue('type', rT[i], { d: .12, v: .3 }) })
  cue('hit', tRes, { v: .55 }); cue('tick', tRes + .02, { v: .9 })
  cue('whoosh', s.t1 - .2, { d: .4, v: .7 })

  return t => {
    camera(s, t, { inT: 'whip', outT: 'shrink', inDur: .22, outDur: .28 })
    focus(s, t, [[s.t0, 0, LAND ? 20 : 0, M({ land: 1.14, sq: 1, def: 1.06 }), -4, 0], [s.t1, 0, LAND ? 20 : 0, M({ land: 1.18, sq: 1.04, def: 1.1 }), 3, 2]])
    lab(t)
    put(tk, { x: L.tk[0], y: L.tk[1], s: L.ts })
    tags.forEach((e, i) => pop(e, t, tagT[i], { dur: .24 }))
    rw.forEach((w, i) => rise(w, t, rT[i], { dur: .2, dy: 8, blur: 6 }))
    const st = t < tHd ? 'new' : t < tRes ? 'work' : 'done'
    if (pill.dataset.s !== st) {
      pill.dataset.s = st
      pill.innerHTML = { new: 'New', work: '<span class="gd" style="background:#E9AC57;box-shadow:0 0 10px rgba(233,172,87,.9)"></span>Replying', done: CHECK('#B9D4B3', 15) + 'Resolved' }[st]
      pill.className = 'pill' + (st === 'done' ? ' ok' : st === 'work' ? ' amber' : ' bad')
    }
    put(gauge, { x: L.g[0], y: L.g[1] + (1 - P(t, s.t0 + .05, s.t0 + .4)) * 50, s: L.gs, o: P(t, s.t0 + .05, s.t0 + .25) })
    const v = lerp(.9, .12, P(t, tComp, tRes, E.io)) + .02 * Math.sin(t * 30) * (1 - P(t, tComp, tRes))
    garc.style.strokeDashoffset = (1 - v).toFixed(4)
    garc.setAttribute('stroke', v > .5 ? '#E0796D' : v > .3 ? '#E9AC57' : '#9DBE97')
    needle.setAttribute('transform', `rotate(${(-90 + 180 * v).toFixed(2)})`)
    const lv = v > .6 ? 'High' : v > .3 ? 'Falling' : 'Low'
    if (gv.textContent !== lv) { gv.textContent = lv; gv.style.color = v > .6 ? '#F0A69C' : v > .3 ? '#F2C57E' : '#B9D4B3' }
  }
}

/* ============================================================
   07 · THE WALL: every other job AI can take on
   ============================================================ */
function buildWall(s) {
  const n = 7
  const USES = [
    ['Appointment booking', 'cal'], ['Live chat and FAQs', 'chat'], ['Complaints and queries', 'alert'], ['Quotes and proposals', 'quote'], ['Call summaries', 'phone'], ['Order tracking', 'box'],
    ['Invoice processing', 'invoice'], ['Document reading', 'doc'], ['Review replies', 'star'], ['Reply drafting', 'pen'], ['CRM updates', 'db'], ['Weekly reports', 'chart'],
    ['Staff knowledge base', 'book'], ['Onboarding', 'wave'], ['Inbox sorting', 'inbox'], ['Data entry', 'keys'], ['Lead follow-up', 'lead'], ['Stock alerts', 'stack'],
    ['Reminders', 'bell'], ['Lead qualification', 'filter'], ['Meeting notes', 'notes'], ['Social replies', 'share'], ['Job scheduling', 'clock'], ['Customer surveys', 'survey'],
  ]
  // the four named jobs go in central slots for each grid, in the order they are said
  const NAMED = ['Document reading', 'Inbox sorting', 'Reply drafting', 'Lead follow-up']
  const SLOTS = M({ land: [7, 14, 9, 16], sq: [7, 14, 9, 16], tall: [5, 10, 6, 9], port: [7, 13, 10, 16] })
  const rest = USES.filter(u => !NAMED.includes(u[0]))
  const ORDER = USES.map((_, i) => SLOTS.includes(i) ? USES.find(u => u[0] === NAMED[SLOTS.indexOf(i)]) : rest.shift())
  const WALL = M({ land: { cols: 6, base: 1.28, px: 230, py: 0 }, sq: { cols: 6, base: 1.34, px: 520, py: 0 }, tall: { cols: 4, base: 1.12, px: 150, py: 0 }, port: { cols: 3, base: 1.2, px: 0, py: 60 } })
  const WIDE = WALL.cols > 3
  const COLS = WALL.cols, ROWS = USES.length / COLS
  const TW = 300, TH = 190, GAP = 26
  const plane = h('div', 'plane', s.cam)
  const tiles = ORDER.map(([nm, ic], i) => {
    const e = h('div', 'tile', plane, `<div class="ic">${icon(ic)}</div><div><div class="nm">${nm}</div><div class="st"><i></i><span>Ready</span></div></div>`)
    const c = i % COLS, r = Math.floor(i / COLS)
    e._x = (c - (COLS - 1) / 2) * (TW + GAP); e._y = (r - (ROWS - 1) / 2) * (TH + GAP); e._c = c; e._r = r
    e._st = e.querySelector('.st span')
    return e
  })
  const HERO = { 'Document reading': ['reads', 'Reads your paperwork'], 'Inbox sorting': ['sorts', 'Sorts your inbox'], 'Reply drafting': ['drafts', 'Drafts your replies'], 'Lead follow-up': ['chases', 'Chases every lead'] }
  const heroes = tiles.map((e, i) => HERO[ORDER[i][0]] ? { e, text: HERO[ORDER[i][0]][1], t: wt(n, HERO[ORDER[i][0]][0]) } : null).filter(Boolean).sort((a, b) => a.t - b.t)
  // the caption that says what the voice is saying
  const capPos = M({ land: [0, 392], port: [0, 640], sq: [0, 392], tall: [0, 520] })
  const box = h('div', 'abs capbox', s.hud)
  const eb = h('div', 'eyebrow', box, `${spark(18)}<span>Plus AI that</span>`)
  const lines = h('div', '', box); lines.style.position = 'relative'
  const caps = heroes.map(x => { const e = h('div', 'display cap', lines); e.textContent = x.text; return e })
  caps.forEach((e, i) => { if (i) { e.style.position = 'absolute'; e.style.left = LAND ? '0' : '50%'; e.style.top = '0' } })
  if (!LAND) { box.style.textAlign = 'center'; eb.style.justifyContent = 'center' }
  const start = tiles[ORDER.findIndex(u => u[0] === 'Complaints and queries')]
  const panX = [-WALL.px, WALL.px], panY = [-WALL.py, WALL.py]
  const base = WALL.base
  const clampX = x => Math.max(-WALL.px, Math.min(WALL.px, x)), clampY = y => Math.max(-Math.max(WALL.py, 40), Math.min(Math.max(WALL.py, 40), y))
  const tPlus = wt(n, 'plus')
  const litT = tiles.map(e => s.t0 + .45 + (WIDE ? e._c * .16 + e._r * .06 : e._r * .14 + e._c * .06))
  litT.forEach((x, i) => { if (i % 3 === 0) cue('flip', x, { v: .35 }) })
  heroes.forEach(x => { cue('pop', x.t - .02, { v: .8 }); cue('swish', x.t - .05, { v: .5 }) })
  cue('whoosh', s.t0 + .02, { d: .8, v: .7 })
  cue('whoosh', s.t1 - .3, { d: .45, v: .9 })

  return t => {
    camera(s, t, { inT: 'none', outT: 'through', outDur: .3, push: 0 })
    // pull back from one tile to the whole wall, then sweep across it
    const pull = P(t, s.t0, s.t0 + .75, E.io)
    const sweep = P(t, s.t0 + .6, s.t1, E.io)
    const K = [[s.t0 + .75, panX[0], panY[0]], ...heroes.map(x => [x.t - .22, clampX(x.e._x), clampY(x.e._y)]), [s.t1, panX[1], panY[1]]]
    let k = 0; while (k < K.length - 2 && t >= K[k + 1][0]) k++
    const kp = P(t, K[k][0], K[k + 1][0], E.io)
    const tx = lerp(K[k][1], K[k + 1][1], kp), tyy = lerp(K[k][2], K[k + 1][2], kp)
    const fx0 = lerp(start._x, tx, pull), fy0 = lerp(start._y, tyy, pull)
    const sc = lerp(2.6, base, pull) * (1 + .06 * sweep)
    s.cam.style.transform = `scale(${sc.toFixed(4)}) translate(${(-fx0).toFixed(1)}px,${(-fy0).toFixed(1)}px)`
    plane.style.transform = `translate(-50%,-50%) rotateX(${lerp(0, 16, pull).toFixed(2)}deg) rotateZ(${lerp(0, -5, pull).toFixed(2)}deg)`
    tiles.forEach((e, i) => {
      const hero = heroes.find(x => x.e === e)
      const hp = hero ? bell(t, hero.t - .05, hero.t + .12, hero.t + .9, E.snap) : 0
      put(e, { x: e._x, y: e._y, z: hp * 80, s: 1 + .12 * hp, bright: hero && t >= hero.t - .05 ? 1.15 : 1 })
      const on = t >= litT[i]
      e.classList.toggle('on', on)
      const lbl = on ? 'Running' : 'Ready'
      if (e._st.textContent !== lbl) e._st.textContent = lbl
    })
    put(box, { x: capPos[0], y: capPos[1] + (1 - P(t, tPlus - .1, tPlus + .25)) * 40, o: P(t, tPlus - .1, tPlus + .15) })
    caps.forEach((e, i) => {
      const a = heroes[i].t - .06, b = i < heroes.length - 1 ? heroes[i + 1].t - .08 : null
      const pi = P(t, a, a + .26, E.out), po = b == null ? 0 : P(t, b, b + .18, E.in2)
      const tx = LAND ? '' : 'translateX(-50%) '
      e.style.transform = `${i ? tx : ''}translateY(${((1 - pi) * 50 - po * 50).toFixed(1)}px)`
      vis(e, pi * (1 - po))
      const bl = (1 - pi) * 14 + po * 14
      e.style.filter = bl > .05 ? `blur(${bl.toFixed(1)}px)` : 'none'
    })
  }
}

/* ============================================================
   08 · WHAT YOU GET: less admin, faster answers, happier customers
   ============================================================ */
function buildGains(s) {
  const n = 8
  const ty = M({ land: 150, port: 200, sq: 190, tall: 210 }), my = M({ land: -170, port: -300, sq: -190, tall: -250 })
  const T = [['less', 'Less admin.'], ['faster', 'Faster answers.'], ['happier', 'Happier customers.']]
  const at = T.map(([k]) => wt(n, k))
  const slams = T.map(([, txt]) => { const e = h('div', 'abs display slam', s.cam); e.textContent = txt; e._y = ty; return e })
  // less: a stack of paper that empties
  const papers = Array.from({ length: 7 }, () => h('div', 'paper', s.cam, '<i style="width:60%"></i><i></i><i></i><i style="width:80%"></i><i></i><i style="width:50%"></i>'))
  // faster: speed lines and a stopwatch
  const lines = Array.from({ length: 26 }, () => h('div', 'speedline', s.cam))
  const r = rng(13); lines.forEach(e => { e._y = (r() - .5) * H * .8; e._l = 200 + r() * 500; e._v = 2600 + r() * 2200; e._p = r() })
  const watch = h('div', 'abs', s.cam, `<svg width="300" height="300" viewBox="-150 -150 300 300" style="overflow:visible"><circle r="120" fill="none" stroke="rgba(240,231,216,.18)" stroke-width="10"/><circle data-arc r="120" fill="none" stroke="#E9AC57" stroke-width="10" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" transform="rotate(-90)"/><line data-hand x1="0" y1="0" x2="0" y2="-95" stroke="#FBF6EC" stroke-width="7" stroke-linecap="round"/><circle r="11" fill="#FBF6EC"/><rect x="-22" y="-162" width="44" height="22" rx="6" fill="#FBF6EC"/></svg>`)
  const warc = watch.querySelector('[data-arc]'), hand = watch.querySelector('[data-hand]')
  // happier: five stars
  const stars = Array.from({ length: 5 }, () => h('div', 'starx', s.cam, STAR('#E9AC57')))
  const SZ = M({ land: 110, def: 96 })
  stars.forEach(e => { e.style.width = e.style.height = SZ + 'px'; e.style.filter = 'drop-shadow(0 0 18px rgba(233,172,87,.6))' })
  at.forEach(x => cue('hit', x, { v: .8 }))
  cue('whoosh', at[1] - .05, { d: .7, v: .5 })
  stars.forEach((_, i) => cue('star', at[2] + .05 + i * .09, { v: .6 + i * .08 }))
  WIPES.push({ t: s.t1 })
  cue('wipe', s.t1)

  return t => {
    camera(s, t, { inT: 'zoom', outT: 'none', inDur: .3 })
    slams.forEach((e, i) => slot(e, t, at[i] - .06, i < 2 ? at[i + 1] - .1 : null, { dy: 140 }))
    // paper
    const pIn = P(t, s.t0, s.t0 + .3), pOut = P(t, at[1] - .12, at[1] + .1, E.in2)
    papers.forEach((e, i) => {
      const gone = P(t, at[0] + .1 + i * .07, at[0] + .35 + i * .07, E.in2) * (i < 6 ? 1 : 0)
      put(e, { x: (i - 3) * 16 + gone * (i % 2 ? 700 : -700), y: my - i * 8 - gone * 200, r: (i - 3) * 3 + gone * (i % 2 ? 50 : -50), o: pIn * (1 - gone) * (1 - pOut), s: M({ land: 1, def: .9 }) })
    })
    // speed
    const sp = bell(t, at[1] - .12, at[1] + .05, at[2] - .05)
    lines.forEach(e => {
      const x = ((e._p * 3000 - (t - at[1]) * e._v) % 3000 + 3000) % 3000 - 1500
      e.style.width = e._l + 'px'
      e.style.transform = `translate(${(W / 2 + x).toFixed(1)}px,${(H / 2 + e._y).toFixed(1)}px)`
      vis(e, sp * .7)
    })
    const wp = bell(t, at[1] - .1, at[1] + .12, at[2] - .08)
    put(watch, { y: my, o: wp, s: lerp(.8, 1, wp) * M({ land: 1, def: .9 }) })
    const spin = P(t, at[1], at[2] - .1, E.out)
    warc.style.strokeDashoffset = (1 - spin).toFixed(4)
    hand.setAttribute('transform', `rotate(${(spin * 360).toFixed(1)})`)
    // stars
    stars.forEach((e, i) => {
      const t0 = at[2] + .05 + i * .09, p = P(t, t0, t0 + .3, E.snap)
      put(e, { x: (i - 2) * SZ * 1.15, y: my, s: p, r: (1 - Math.min(1, p)) * -60, o: P(t, t0, t0 + .06) })
    })
  }
}

/* ============================================================
   09 · YOURS: built for the business, then gathered into the dot
   ============================================================ */
function buildYours(s) {
  const n = 9
  const L = M({ land: { b: [430, 0], txt: [-470, 0], al: 'left' }, port: { b: [0, -330], txt: [0, 280], al: 'center' }, sq: { b: [0, -210], txt: [0, 250], al: 'center' }, tall: { b: [0, -270], txt: [0, 300], al: 'center' } })
  const C = 7, Rw = 5, SZ = M({ land: 46, def: 40 }), G = 8
  const r = rng(17)
  const blocks = Array.from({ length: C * Rw }, (_, i) => {
    const e = h('div', 'blk', s.cam)
    const c = i % C, rr = Math.floor(i / C)
    e._x = L.b[0] + (c - (C - 1) / 2) * (SZ + G); e._y = L.b[1] + (rr - (Rw - 1) / 2) * (SZ + G)
    const a = r() * Math.PI * 2; e._fx = e._x + Math.cos(a) * 1400; e._fy = e._y + Math.sin(a) * 1000; e._fr = (r() - .5) * 360
    e._am = (c + rr) % 5 === 0
    e.style.width = e.style.height = SZ + 'px'
    e._d = r()
    return e
  })
  const tx = h('div', 'abs', s.cam); tx.style.textAlign = L.al; tx.style.width = 'max-content'
  const a = h('div', 'display', tx), b = h('div', 'display', tx)
  a.style.fontSize = b.style.fontSize = M({ land: '96px', port: '88px', def: '80px' })
  const wa = words(a, 'Built for your business.'), wb = words(b, 'Yours to keep.')
  const mono = h('div', 'mono', tx); mono.style.marginTop = '26px'; mono.textContent = 'No retainers · you own everything we build'
  const tB = wt(n, 'built'), tY = wt(n, 'yours')
  const tGather = s.t1 - .5
  blocks.forEach((e, i) => { if (i % 5 === 0) cue('blip', tB - .15 + e._d * .75 + .35, { v: .25 }) })
  cue('implode', s.t1, { d: .5 })
  cue('whoosh', tB - .15, { d: .6, v: .5 })

  return t => {
    camera(s, t, { inT: 'none', outT: 'none', push: .03 })
    blocks.forEach((e, i) => {
      const t0 = tB - .15 + e._d * .75
      const p = P(t, t0, t0 + .4, E.out)
      const g = P(t, tGather + e._d * .12, s.t1, E.in3)
      const x = lerp(lerp(e._fx, e._x, p), 0, g), y = lerp(lerp(e._fy, e._y, p), 0, g)
      put(e, { x, y, r: lerp(e._fr, 0, p), o: P(t, t0, t0 + .1) * (i === 0 ? 1 : 1 - P(g, .85, 1, E.lin)), s: lerp(1, i === 0 ? 1 : .6, g) })
      const sweep = t > tY && Math.abs((t - tY) * 2.4 - .2 - ((e._x - L.b[0]) / 380 + .5)) < .14
      e.style.background = (i === 0 && g > .5) || e._am || sweep ? '#E9AC57' : 'rgba(240,231,216,.88)'
    })
    const out = P(t, tGather - .1, tGather + .2, E.in2)
    put(tx, { x: L.txt[0] + (LAND ? tx.offsetWidth / 2 - 430 : 0), y: L.txt[1], o: 1 - out, blur: out * 12 })
    wa.forEach((w, i) => rise(w, t, tB + i * .09 - .05, { dur: .32, dy: 30 }))
    wb.forEach((w, i) => rise(w, t, tY + i * .09 - .05, { dur: .32, dy: 30 }))
    rise(mono, t, tY + .3, { dur: .35, dy: 14, blur: 8 })
  }
}

/* ============================================================
   10 · END CARD: the dot finds its place and the wordmark draws around it
   ============================================================ */
function buildEnd(s) {
  const n = 10
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
  const tw = words(tag, 'Put AI to work')
  const tdot = h('span', 'sqdot', tag)
  const url = h('div', 'abs url', s.cam, `<span class="cta">Book a free discovery call</span><span class="sep"></span><span>nabl.agency</span>`)
  const tN = wt(n, 'n.abl'), tPut = wt(n, 'put'), tWork = we(n, 'work')
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
function ground_(t) {
  const sc = id => TL.scenes.find(s => s.id === id)
  const tAI = SCENES[0].flashAt, dotT = wt(10, 'n.abl')
  // [time, ax, ay, aStrength, cx, cy, cStrength, grid]
  const K = [
    [0, .3, .5, .35, .75, .6, .35, 0],
    [tAI - .02, .4, .5, .45, .6, .5, .4, 0],
    [tAI + .08, .5, .5, 1.3, .5, .5, .7, 0],
    [sc('into').start, .5, .5, .8, .5, .5, .5, 0],
    [sc('book').start, .2, .25, .7, .85, .8, .5, .6],
    [sc('faq').start, .8, .3, .6, .2, .8, .45, .6],
    [sc('care').start, .25, .7, .7, .8, .25, .5, .6],
    [sc('wall').start, .5, .3, .8, .5, .85, .5, .2],
    [sc('gains').start, .5, .4, .8, .5, .7, .5, 0],
    [sc('yours').start, .7, .5, .7, .2, .5, .5, .3],
    [sc('end').start, .5, .45, .55, .5, .7, .4, 0],
    [dotT, .5, .45, .8, .5, .7, .45, 0],
    [dotT + .12, .5, .45, 1.1, .5, .7, .55, 0],
    [TL.duration, .5, .45, .85, .5, .7, .45, 0],
  ]
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
  const bo = P(t, sc('into').start, sc('into').start + .3) * (1 - P(t, sc('end').start - .2, sc('end').start))
  const bp = M({ land: [W / 2 - 112, H / 2 - 62], port: [0, -H / 2 + 96], def: [W / 2 - 100, H / 2 - 56] })
  put(bug, { x: bp[0], y: bp[1], o: bo * .75 })
}

/* ---------- boot ---------- */
async function boot() {
  TL = await (await fetch('/marketing/launch-video/build/timeline.json')).json()
  await document.fonts.ready
  await Promise.all(['600 100px "Space Grotesk"', '700 100px "Space Grotesk"', '500 20px "Inter Tight"', '600 20px "Inter Tight"', '500 20px "JetBrains Mono"'].map(f => document.fonts.load(f)))
  scene(['boot', 'ai'], buildBoot)
  scene(['into'], buildInto)
  scene(['book'], buildBook)
  scene(['faq'], buildFaq)
  scene(['care'], buildCare)
  scene(['wall'], buildWall)
  scene(['gains'], buildGains)
  scene(['yours'], buildYours)
  scene(['end'], buildEnd)
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
