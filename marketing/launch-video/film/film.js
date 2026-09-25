/* ============================================================
   AI, WHERE IT EARNS ITS PLACE: the film

   One page, sampled by time. window.seek(t) puts every element where it
   belongs at t seconds, so the renderer can ask for any frame in any
   order and get the same picture. Nothing here runs on its own clock.

   The timing comes from build/timeline.json, which vo.py writes from the
   synthesised voice: scenes start on beats, words carry their own times,
   and the animation keys off them by name ("reads", "person").

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
const STACK = MODE !== 'land'

/* ---------- easing ---------- */
const E = {
  ease: EASE, out: EASE_OUT, io: EASE_IO, lin: x => x,
  in2: x => x * x, in3: x => x * x * x, out2: x => 1 - (1 - x) * (1 - x),
  back: bezier(.34, 1.56, .64, 1), soft: bezier(.3, 1.25, .5, 1),
}
const P = (t, a, b, e = E.out) => (t <= a ? 0 : t >= b ? 1 : e((t - a) / (b - a)))
const bell = (t, a, b, c, e = E.out) => P(t, a, b, e) * (1 - P(t, b, c, E.io))

/* ---------- seeded randomness, so every render is the same film ---------- */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }

/* ---------- DOM ---------- */
function h(tag, cls, parent, html) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  if (parent) parent.appendChild(e)
  return e
}
/* place an .abs element: x, y from the stage centre, in px */
function put(e, { x = 0, y = 0, z = 0, s = 1, r = 0, rx = 0, ry = 0, o = 1, blur = 0, bright } = {}) {
  e.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})`
  vis(e, o)
  let f = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : ''
  if (bright != null && bright !== 1) f += ` brightness(${bright.toFixed(3)})`
  e.style.filter = f || 'none'
}
function vis(e, o) { e.style.opacity = o.toFixed(4); e.style.visibility = o <= 0.002 ? 'hidden' : 'visible' }
function words(parent, text) {
  return text.split(' ').map((w, i) => {
    if (i) parent.appendChild(document.createTextNode(' '))
    const s = h('span', 'w', parent); s.textContent = w; return s
  })
}
function chars(parent, text) {
  return [...text].map(c => { const s = h('span', 'ch', parent); s.textContent = c; return s })
}
/* blur-in, rise: the one text entrance the whole film uses */
function rise(e, t, t0, { dur = .5, dy = 30, blur = 16, s0 = 1 } = {}) {
  const p = P(t, t0, t0 + dur, E.out)
  const s = lerp(s0, 1, p)
  e.style.transform = `translateY(${((1 - p) * dy).toFixed(2)}px) scale(${s.toFixed(4)})`
  vis(e, p)
  e.style.filter = p < 0.999 ? `blur(${((1 - p) * blur).toFixed(2)}px)` : 'none'
}
/* positions of an element inside an ancestor, from the layout, untouched by transforms */
function offs(e, root) {
  let x = 0, y = 0, n = e
  while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent }
  return { x, y, w: e.offsetWidth, h: e.offsetHeight }
}

/* ---------- marks ---------- */
const SPARK = 'M0 -10 C1 -2.5 2.5 -1 10 0 C2.5 1 1 2.5 0 10 C-1 2.5 -2.5 1 -10 0 C-2.5 -1 -1 -2.5 0 -10 Z'
const spark = (size, fill = '#E9AC57') => `<svg width="${size}" height="${size}" viewBox="-10 -10 20 20"><path d="${SPARK}" fill="${fill}"/></svg>`
const CURSOR = '<svg class="cursor" viewBox="0 0 14 20"><path d="M1 1 L1 17.6 L5.3 13.7 L7.9 19 L10.9 17.7 L8.2 12.5 L13 12.3 Z" fill="#FBF6EC" stroke="#0E0C0A" stroke-width="1.1" stroke-linejoin="round"/></svg>'
const CHECK = (c = '#B9D4B3', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const DOCI = (c = '#F2C57E') => `<svg width="16" height="20" viewBox="0 0 16 20"><rect x="1" y="1" width="14" height="18" rx="2.5" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M4.5 7h7M4.5 11h7M4.5 15h4" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/></svg>`
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
const lineEnd = n => TL.lines[n - 1].end

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
flash.style.background = 'radial-gradient(circle at 50% 50%, rgba(233,172,87,.55), rgba(233,172,87,.12) 35%, transparent 70%)'
const bug = h('div', 'bug', fx, WORDMARK())
bug.style.width = M({ land: '132px', def: '120px' })
const vignette = h('div', 'layer vignette', stage)
/* Film grain is added at encode time by render.mjs: a full-frame blended
   layer here cost a third of every frame's render time. */

const SCENES = []
function scene(ids, build) {
  const a = TL.scenes.find(s => s.id === ids[0]), b = TL.scenes.find(s => s.id === ids[ids.length - 1])
  const root = h('div', 'scene', scenesEl), rig = h('div', 'rig', root)
  const cam = h('div', 'cam', rig), hud = h('div', 'cam', rig)
  const s = { id: ids.join('+'), t0: a.start, t1: b.end, root, rig, cam, hud, cuts: ids.map(id => TL.scenes.find(x => x.id === id)) }
  s.render = build(s)
  SCENES.push(s)
  return s
}
/* the shared entrance, drift and exit every scene rides on */
function camera(s, t, { inDur = .4, outDur = .26, push = .035, noIn = false, noOut = false, x = 0, y = 0 } = {}) {
  const lt = t - s.t0, rt = s.t1 - t, len = s.t1 - s.t0
  const pin = noIn ? 1 : P(lt, 0, inDur, E.out)
  const pout = noOut ? 0 : E.in2(1 - Math.min(1, rt / outDur))
  const sc = lerp(.93, 1, pin) * (1 + push * (lt / len)) * (1 + .12 * pout)
  const blur = (1 - pin) * 16 + pout * 20
  s.rig.style.transform = `translate(${x}px,${(y + (1 - pin) * 22 - pout * 26).toFixed(2)}px) scale(${sc.toFixed(4)})`
  s.rig.style.opacity = (Math.min(1, pin * 1.8) * (1 - pout * pout)).toFixed(4)
  s.rig.style.filter = blur > .05 ? `blur(${blur.toFixed(2)}px)` : 'none'
}
/* the camera inside a scene: keys are [time, x, y, scale], x and y the point held at the centre */
function focus(s, t, keys) {
  let i = 0; while (i < keys.length - 2 && t >= keys[i + 1][0]) i++
  const a = keys[i], b = keys[i + 1], p = P(t, a[0], b[0], E.io)
  const x = lerp(a[1], b[1], p), y = lerp(a[2], b[2], p), sc = lerp(a[3], b[3], p)
  s.cam.style.transform = `scale(${sc.toFixed(4)}) translate(${(-x).toFixed(2)}px,${(-y).toFixed(2)}px)`
}
function cursorNode(parent) {
  const c = h('div', '', parent, CURSOR).firstChild
  const rip = h('div', 'ripple', parent)
  return { c, rip }
}
/* legs: [t0, t1, from, to, bow]; clicks: times */
function driveCursor(K, t, legs, clicks, { show = [0, 0], hide = [99, 99] } = {}) {
  let p = legs[0][2]
  for (const [a, b, from, to, bow] of legs) { if (t < a) break; p = t <= b ? arc(from, to, P(t, a, b, E.ease), bow) : to }
  let dip = 1; clicks.forEach(c => { dip -= .14 * bell(t, c - .04, c + .03, c + .16) })
  const o = P(t, show[0], show[1]) * (1 - P(t, hide[0], hide[1]))
  K.c.style.transform = `translate(${(p[0] + W / 2).toFixed(2)}px,${(p[1] + H / 2).toFixed(2)}px) scale(${dip.toFixed(3)})`
  K.c.style.transformOrigin = '0 0'
  vis(K.c, o)
  let rp = 0, rs = 1
  for (const c of clicks) if (t >= c && t < c + .5) { const q = P(t, c, c + .5, E.out); rp = (1 - q) * .8; rs = lerp(.3, 1.5, q) }
  K.rip.style.transform = `translate(${(p[0] + W / 2).toFixed(2)}px,${(p[1] + H / 2).toFixed(2)}px) scale(${rs.toFixed(3)})`
  vis(K.rip, rp * o)
}

/* ============================================================
   01 · HOOK: someone reads it, then types it all out again
   ============================================================ */
function buildHook(s) {
  const n = 1
  const box = h('div', 'abs hook', s.cam)
  const kick = h('div', 'kick', box)
  const kw = words(kick, 'Somewhere in your business,')
  const l1 = h('div', 'display big l1', box)
  const w1 = words(l1, 'someone reads a document…')
  const l2 = h('div', 'display big l2 typed', box)
  const TXT = 'then types it all out again.'
  const cs = chars(l2, TXT)
  const caret = h('div', 'caret', box)
  const pos = { x: 0, y: M({ land: -20, port: 10, def: -40 }) }

  // each typed character keys off the word it belongs to
  const wl = lineWords(n).slice(-6)
  const ct = []
  let ci = 0
  TXT.split(' ').forEach((w, i) => {
    const a = wl[i].start, b = Math.max(wl[i].start + .12, wl[i].end - .05)
    for (let k = 0; k < w.length; k++) ct[ci + k] = lerp(a, b, k / w.length)
    ci += w.length
    if (ci < TXT.length) { ct[ci] = b + .01; ci++ }
  })
  ct.forEach((tc, i) => cue(TXT[i] === ' ' ? 'space' : 'key', tc, { v: .7 + .3 * ((i * 37) % 11) / 11 }))
  const echoes = []
  let geo
  const tAgain = wt(n, 'again'), tEnd = lineEnd(n)
  for (let k = 1; k <= 4; k++) cue('stamp', tAgain + .16 + k * .085, { v: 1 - k * .18 })
  cue('whoosh', s.t1 - .28, { d: .5 })

  return t => {
    if (!geo) {
      geo = { l2: offs(l2, box), ch: cs.map(c => offs(c, box)), k: offs(kick, box), ke: offs(kw[kw.length - 1], box) }
      for (let k = 1; k <= 4; k++) {
        const e = l2.cloneNode(true); e.classList.add('echo')
        e.querySelectorAll('.ch').forEach(c => c.classList.add('on'))
        e.style.top = (geo.l2.y + k * geo.l2.h * .82) + 'px'; e.style.width = geo.l2.w + 'px'
        box.appendChild(e); echoes.push(e)
      }
    }
    camera(s, t, { noIn: true, push: .05 })
    const lift = P(t, tAgain + .1, tEnd + .3, E.io)
    put(box, { ...pos, y: pos.y - lift * geo.l2.h * .9 })
    kw.forEach((w, i) => { w.style.opacity = (.55 + .45 * P(t, wt(n, norm(['somewhere', 'in', 'your', 'business,'][i])) - .06, wt(n, norm(['somewhere', 'in', 'your', 'business,'][i])) + .2)).toFixed(3); w.style.visibility = 'visible' })
    const keys = ['someone', 'reads', 'a', 'document']
    w1.forEach((w, i) => {
      const t0 = wt(n, keys[i]) - .05
      rise(w, t, t0, { dur: .5, dy: 28 })
      const hl = bell(t, t0, t0 + .18, t0 + .9)
      w.style.background = `rgba(240,231,216,${(hl * .13).toFixed(3)})`
    })
    // the typing, and the caret that does it
    let last = -1
    cs.forEach((c, i) => { const on = t >= ct[i]; c.classList.toggle('on', on); if (on) last = i })
    const typing = t >= ct[0] - .25
    let cx, cy, chh = geo.ch[0].h
    if (!typing) { cx = geo.ke.x + geo.ke.w + 8; cy = geo.k.y + 4; chh = geo.k.h - 8 }
    else if (last < 0) { cx = geo.ch[0].x; cy = geo.ch[0].y }
    else { const g = geo.ch[last]; cx = g.x + g.w + 4; cy = g.y }
    const blinkOn = (typing && t < ct[ct.length - 1] + .05) ? 1 : (Math.floor(t / .53) % 2 === 0 ? 1 : 0)
    const hideRead = t > wt(n, 'someone') - .1 && t < ct[0] - .25
    caret.style.left = cx + 'px'; caret.style.top = (cy + chh * .12) + 'px'; caret.style.height = (chh * .78) + 'px'
    vis(caret, hideRead ? 0 : blinkOn)
    echoes.forEach((e, k) => {
      const t0 = tAgain + .16 + (k + 1) * .085
      const p = P(t, t0, t0 + .3, E.out)
      e.style.transform = `translateY(${((1 - p) * -40).toFixed(1)}px)`
      vis(e, p * [.42, .26, .15, .08][k])
    })
  }
}

/* ============================================================
   02 + 03 · THE PILE, AND THE TURN
   ============================================================ */
const DOC_KINDS = [
  ['INVOICE', d => `<div class="rowx"><div class="t">Invoice</div><div class="lbl">No. 4471</div></div><div class="bar d" style="width:44%"></div><div class="bar" style="width:30%"></div><div style="height:14px"></div>${[62, 48, 70, 40].map(w => `<div class="rowx"><div class="bar" style="width:${w}%"></div><div class="bar" style="width:14%"></div></div>`).join('')}<div style="height:10px"></div><div class="rowx"><div class="lbl">Total</div><div class="t" style="font-size:17px;margin:0">£1,284.00</div></div>`],
  ['REFERRAL', d => `<div class="bar" style="width:38%"></div><div class="bar" style="width:30%"></div><div style="height:10px"></div><div class="t" style="font-size:16px">Re: referral</div>${[96, 88, 92, 70, 94, 60].map(w => `<div class="bar" style="width:${w}%"></div>`).join('')}<svg class="sig" viewBox="0 0 120 40" width="120"><path d="M4 28c10-18 16-20 18-8s6 10 14-6 10-6 12 4 10 4 18-10 8 6 16 6" fill="none" stroke="#2B2F63" stroke-width="2.2" stroke-linecap="round"/></svg>`],
  ['APPLICATION', d => `<div class="t">Application form</div>${['Full name', 'Date of birth', 'Address', 'Start date'].map(l => `<div class="lbl">${l}</div><div class="box"></div>`).join('')}`],
  ['ORDER', d => `<div class="t">Order</div>${[1, 2, 3, 4, 5].map(i => `<div class="rowx"><div style="width:14px;height:14px;border:1.5px solid rgba(20,17,14,.35);border-radius:3px"></div><div class="bar" style="flex:1;width:auto"></div><div class="bar d" style="width:16%"></div></div>`).join('')}<div class="bar" style="width:40%;margin-top:18px"></div>`],
  ['CV', d => `<div class="t" style="font-size:22px">Curriculum vitae</div><div class="rowx" style="align-items:flex-start;gap:16px"><div style="width:36%">${[90, 70, 80, 60, 75].map(w => `<div class="bar" style="width:${w}%"></div>`).join('')}</div><div style="flex:1">${[96, 88, 92, 70, 94, 60, 84, 66].map(w => `<div class="bar" style="width:${w}%"></div>`).join('')}</div></div>`],
  ['CLAIM', d => `<div class="t">Claim form</div><div class="rowx"><div style="flex:1"><div class="lbl">Policy</div><div class="box"></div></div><div style="flex:1"><div class="lbl">Date</div><div class="box"></div></div></div><div class="lbl">What happened</div><div class="box" style="height:92px"></div><div class="bar" style="width:52%"></div>`],
  ['TIMESHEET', d => `<div class="t">Timesheet</div>${[0, 1, 2, 3, 4, 5].map(() => `<div class="rowx">${[0, 1, 2, 3].map(() => `<div class="box" style="flex:1;height:22px;margin:3px 0"></div>`).join('')}</div>`).join('')}`],
  ['DELIVERY NOTE', d => `<div class="t">Delivery note</div><div class="bar" style="width:52%"></div><div class="bar" style="width:36%"></div><div style="display:flex;gap:3px;height:44px;margin:16px 0">${Array.from({ length: 34 }, (_, i) => `<div style="flex:${1 + (i * 7) % 3};background:rgba(20,17,14,${i % 4 ? .75 : 0})"></div>`).join('')}</div>${[90, 76, 84].map(w => `<div class="bar" style="width:${w}%"></div>`).join('')}`],
]
function makeDoc(parent, kind, cls = '') {
  const [tag, body] = DOC_KINDS[kind]
  const d = h('div', 'doc ' + cls, parent, `<div class="tag">${tag}</div>${body()}<div class="shine"></div>`)
  return d
}

function buildPile(s) {
  const [pile, turn] = s.cuts
  const n2 = 2, n3 = 3
  const C = M({
    land: { col: [-500, -70], pile: [440, -40], spread: [330, 240], cs: .92, week: [-500, 170], title: [0, 70], spark: [0, -250], sparkS: 1 },
    port: { col: [0, -560], pile: [0, 60], spread: [300, 230], cs: .95, week: [0, 560], title: [0, 110], spark: [0, -260], sparkS: 1 },
    sq:   { col: [0, -372], pile: [0, 60], spread: [330, 140], cs: .72, week: [0, 420], title: [0, 90], spark: [0, -230], sparkS: .85 },
    tall: { col: [0, -480], pile: [0, 40], spread: [320, 190], cs: .8, week: [0, 540], title: [0, 100], spark: [0, -250], sparkS: .9 },
  })
  const docsLayer = h('div', 'layer', s.cam)
  docsLayer.style.transformStyle = 'preserve-3d'
  const r = rng(11)
  const tIn = wt(n2, 'invoices'), tRef = wt(n2, 'referrals'), tApp = wt(n2, 'applications'), tA = wt(n2, 'a'), tTime = we(n2, 'time')
  const named = [[0, tIn], [1, tRef], [2, tApp]]
  const kinds = [3, 4, 5, 6, 7, 0, 1, 2, 3, 5, 4]
  const docs = []
  named.forEach(([k, at], i) => docs.push({ k, at, big: true }))
  kinds.forEach((k, i) => docs.push({ k, at: lerp(tA + .02, tTime - .05, i / (kinds.length - 1)) }))
  const namedPos = M({ land: [[-150, -40], [150, 30], [0, 70]], def: [[-220, -10], [220, 20], [0, 60]] })
  docs.forEach((d, i) => {
    d.el = makeDoc(docsLayer, d.k)
    d.el.style.zIndex = i < 3 ? 40 + i : 10 + i
    const [sx, sy] = C.spread
    if (d.big) { d.x = C.pile[0] + namedPos[i][0] * (sx / 330); d.y = C.pile[1] + namedPos[i][1] * (sy / 230); d.r = [-8, 7, -2][i] }
    else { d.x = C.pile[0] + (r() * 2 - 1) * sx; d.y = C.pile[1] + (r() * 2 - 1) * sy; d.r = (r() * 2 - 1) * 16 }
    const ang = (r() * .8 + .1) * Math.PI + (i % 2 ? 0 : Math.PI * .15)
    d.fx = d.x + Math.cos(ang) * 1400; d.fy = d.y + Math.abs(Math.sin(ang)) * 900 + 300
    d.fr = d.r + (r() * 2 - 1) * 50
    d.s = C.cs * (d.big ? 1.06 : .92)
    d.t0 = d.at - (d.big ? .34 : .3)
    d.imp = .02 * (i % 6) + .01 * r()
    cue('paper', d.t0 + .26, { v: d.big ? 1 : .55 + .3 * r(), pan: Math.max(-1, Math.min(1, d.x / (W / 2))) })
  })
  // words
  const col = h('div', 'abs words-col', s.cam)
  const mkWord = txt => { const e = h('div', 'display pword', col); e.style.position = 'absolute'; e.style.left = 0; e.style.right = 0; e.style.top = '50%'; e.style.transform = 'translateY(-50%)'; return { e, ws: words(e, txt) } }
  const W1 = mkWord('Invoices.'), W2 = mkWord('Referrals.'), W3 = mkWord('Applications.')
  const twoLines = (e, a, b) => [...words(h('div', '', e), a), ...words(h('div', '', e), b)]
  const S1 = h('div', 'display psent', col), s1w = twoLines(S1, 'A different layout', 'every time.')
  const S2 = h('div', 'display psent', col), s2w = twoLines(S2, 'The same hours,', 'every week.')
  ;[S1, S2].forEach(e => { e.style.position = 'absolute'; e.style.left = 0; e.style.right = 0; e.style.top = '50%'; e.style.transform = 'translateY(-50%)' })
  col.style.height = '10px'
  // week
  const week = h('div', 'abs week', s.cam)
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const days = DAYS.map(d => {
    const e = h('div', 'day', week, `<div class="d">${d}</div><div class="track"><div class="fill"></div><svg class="clock" viewBox="0 0 26 26"><circle cx="13" cy="13" r="10.5" fill="none" stroke="#FBF6EC" stroke-opacity=".7" stroke-width="1.8"/><path d="M13 7.5V13l4 2.6" fill="none" stroke="#FBF6EC" stroke-opacity=".8" stroke-width="1.8" stroke-linecap="round"/></svg></div>`)
    return { e, fill: e.querySelector('.fill') }
  })
  const tSame = wt(n2, 'the'), tWeekEnd = lineEnd(n2)
  days.forEach((d, i) => cue('tick', lerp(tSame + .15, tWeekEnd - .1, i / 4), { v: .6 }))
  // turn
  const tThat = wt(n3, "that's"), tLang = wt(n3, 'language'), tAnd = wt(n3, 'and')
  const beat = TL.beat
  const tBoom = Math.round((tAnd + .12) / beat) * beat
  const tImp = tBoom - .56
  const scrim = h('div', 'layer', s.cam)
  scrim.style.background = 'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(14,12,10,.92), rgba(14,12,10,.55) 55%, rgba(14,12,10,0) 100%)'
  const lw = h('div', 'abs display lw', s.cam); lw.style.fontSize = M({ land: '104px', port: '76px', def: '72px' }); lw.style.whiteSpace = 'nowrap'
  const lww = words(lw, "That's language work.")
  const sp = h('div', 'spark', s.cam, spark(M({ land: 170, def: 150 })))
  const ring = h('div', 'ring', s.cam); ring.style.width = ring.style.height = '240px'
  const ring2 = h('div', 'ring', s.cam); ring2.style.width = ring2.style.height = '240px'
  const title = h('div', 'abs display title', s.cam)
  const t1 = h('div', '', title), t2 = h('div', '', title)
  const tw = [...words(t1, 'AI, where it'), ...words(t2, 'earns its place')]
  const tdot = h('span', 'sqdot', t2)
  const tTitle = [wt(n3, 'ai') - .1, wt(n3, 'where'), wt(n3, 'where') + .12, wt(n3, 'earns'), wt(n3, 'its'), wt(n3, 'place')]
  const tDot = we(n3, 'place') - .05
  cue('riser', tBoom, { d: tBoom - tLang + .3 })
  cue('implode', tImp, { d: tBoom - tImp })
  cue('impact', tBoom, { v: 1 })
  cue('shimmer', tBoom + .05, { d: 2.2 })
  cue('pop', tDot, { v: .8 })
  cue('whoosh', s.t1 - .28, { d: .5 })
  cue('whoosh', pile.start - .05, { d: .35, v: .5 })
  s.boom = tBoom

  return t => {
    camera(s, t, { push: .04 })
    // cards: fly in, settle, dim at the turn, then fall into the spark
    const dim = P(t, turn.start - .05, turn.start + .5, E.io)
    docs.forEach((d, i) => {
      const p = P(t, d.t0, d.t0 + .55, E.out)
      const q = P(t, tImp + d.imp, tBoom, E.in3)
      const sx = C.spark[0], sy = C.spark[1] + 40
      const x = lerp(lerp(d.fx, d.x, p), sx, q), y = lerp(lerp(d.fy, d.y, p), sy, q)
      const rot = lerp(d.fr, d.r, p) + q * (i % 2 ? 160 : -160)
      put(d.el, {
        x, y, z: (1 - p) * 300, s: d.s * lerp(1.08, 1, p) * lerp(1, .04, q) * lerp(1, .94, dim), r: rot,
        rx: (1 - p) * 38, o: Math.min(1, p * 3) * (1 - P(q, .8, 1, E.lin)), blur: (1 - p) * 10 + q * 6,
        bright: lerp(1, .42, dim) + .5 * bell(t, tLang, tLang + .25, tLang + .9) * dim,
      })
      const sh = d.el.lastChild
      const sp0 = tLang + .05 + (i % 7) * .045
      const sp1 = P(t, sp0, sp0 + .8, E.io)
      sh.style.opacity = (sp1 > 0 && sp1 < 1 ? 1 : 0)
      sh.style.backgroundPosition = `${lerp(100, 0, sp1)}% 0`
    })
    // the words that land with them
    put(col, { x: C.col[0], y: C.col[1] })
    // each word replaces the last: in with a blur-rise, out with a blur
    const swap = (o, a, b) => {
      o.ws.forEach(w => rise(w, t, a, { dur: .38, dy: 34, blur: 18, s0: 1.06 }))
      o.e.style.transform = 'translate(0px,0px)'
      o.e.style.opacity = (1 - P(t, b, b + .22, E.in2)).toFixed(3)
      o.e.style.filter = t > b ? `blur(${(P(t, b, b + .22) * 14).toFixed(2)}px)` : 'none'
      o.e.style.visibility = t < a || t > b + .23 ? 'hidden' : 'visible'
    }
    swap(W1, tIn - .06, tRef - .12)
    swap(W2, tRef - .06, tApp - .12)
    swap(W3, tApp - .06, tA - .14)
    const keysA = ['a', 'different', 'layout', 'every', 'time']
    s1w.forEach((w, i) => rise(w, t, wt(n2, keysA[i]) - .05, { dur: .42, dy: 26 }))
    S1.style.opacity = (1 - P(t, tSame - .16, tSame + .06)).toFixed(3); S1.style.visibility = t > tSame + .07 ? 'hidden' : 'visible'
    const keysB = ['the', 'same', 'hours', 'every', 'week']
    s2w.forEach((w, i) => rise(w, t, wt(n2, keysB[i], keysB[i] === 'every' ? 1 : 0) - .05, { dur: .42, dy: 26 }))
    S2.style.opacity = (1 - P(t, turn.start - .1, turn.start + .15)).toFixed(3); S2.style.visibility = t > turn.start + .16 ? 'hidden' : 'visible'
    // the week
    const wp = P(t, tSame - .2, tSame + .3) * (1 - P(t, turn.start - .05, turn.start + .3, E.in2))
    put(week, { x: C.week[0], y: C.week[1] + (1 - wp) * 40, o: wp, blur: (1 - wp) * 8 })
    days.forEach((d, i) => {
      const t0 = lerp(tSame + .15, tWeekEnd - .1, i / 4)
      const f = P(t, t0 - .05, t0 + .35, E.out)
      d.fill.style.transform = `scaleX(${f.toFixed(4)})`
      d.e.style.opacity = (.35 + .65 * P(t, t0 - .1, t0 + .1)).toFixed(3)
    })
    // the turn
    const sc = P(t, turn.start, turn.start + .5, E.io) * (1 - P(t, tImp, tBoom, E.in2))
    vis(scrim, sc)
    const lwOut = P(t, tImp - .08, tImp + .25, E.in2)
    put(lw, { y: C.title[1] - 40 - lwOut * 30, o: 1 - lwOut, blur: lwOut * 14, s: 1 + lwOut * .06 })
    lww.forEach((w, i) => rise(w, t, [tThat, tLang, wt(n3, 'work')][i] - .06, { dur: .45, dy: 30 }))
    // spark
    const sIn = P(t, tBoom - .02, tBoom + .55, E.back)
    const up = P(t, tBoom + .55, tBoom + 1.15, E.ease)
    const pul = 1 + .05 * Math.sin((t - tBoom) * 5) * P(t, tBoom + .5, tBoom + 1)
    put(sp, { x: C.spark[0], y: lerp(C.spark[1] + 40, C.spark[1] - 10, up), s: sIn * C.sparkS * lerp(1.25, .72, up) * pul, r: (1 - sIn) * -120, o: P(t, tBoom - .02, tBoom + .05) })
    sp.style.filter = `drop-shadow(0 0 ${(28 + 40 * bell(t, tBoom, tBoom + .1, tBoom + 1.2)).toFixed(1)}px rgba(233,172,87,.75))`
    ;[ring, ring2].forEach((rg, k) => {
      const rp = P(t, tBoom + k * .09, tBoom + 1 + k * .2, E.out)
      put(rg, { x: C.spark[0], y: C.spark[1] + 40, s: lerp(.15, 4.2 + k * 1.5, rp), o: (t >= tBoom + k * .09) ? (1 - rp) * (k ? .45 : .9) : 0 })
    })
    put(title, { x: C.title[0], y: C.title[1] })
    tw.forEach((w, i) => rise(w, t, tTitle[i] - .04, { dur: .5, dy: 36, blur: 20 }))
    const dp = P(t, tDot, tDot + .35, E.back)
    tdot.style.transform = `scale(${dp.toFixed(3)})`; vis(tdot, P(t, tDot, tDot + .05))
  }
}

/* ============================================================
   UI scenes share a headline: eyebrow, then lines that swap
   ============================================================ */
function headline(s, no, label, stages) {
  const scrim = h('div', 'layer', s.hud)
  scrim.style.background = `linear-gradient(180deg, rgba(14,12,10,.97) 0%, rgba(14,12,10,.93) ${M({ land: 23, port: 21, sq: 20, tall: 18 })}%, rgba(14,12,10,0) ${M({ land: 34, port: 31, sq: 36, tall: 30 })}%)`
  const head = h('div', 'abs head', s.hud)
  h('div', 'eyebrow', head, `<span class="n">${no}</span><span>${label}</span>`)
  const ttl = h('div', 'display ttl', head)
  const st = stages.map(({ lines, at, out }) => {
    const g = h('div', '', ttl)
    const ls = lines.map(l => { const ln = h('span', 'ln', g); return words(ln, l) })
    return { g, ls, at, out }
  })
  const eb = head.firstChild
  const pos = M({ land: [0, -392], port: [0, -676], sq: [0, -440], tall: [0, -540] })
  return t => {
    put(head, { x: pos[0], y: pos[1] })
    rise(eb, t, s.t0 + .15, { dur: .5, dy: 16, blur: 8 })
    st.forEach(({ g, ls, at, out }, k) => {
      if (k) { g.style.position = 'absolute'; g.style.left = 0; g.style.right = 0; g.style.top = 0 }
      ls.forEach((ws, li) => ws.forEach((w, wi) => rise(w, t, at[li] + wi * .045, { dur: .5, dy: 24, blur: 14 })))
      const o = out ? 1 - P(t, out, out + .25, E.in2) : 1
      g.style.opacity = o.toFixed(3); g.style.filter = o < 1 ? `blur(${((1 - o) * 12).toFixed(2)}px)` : 'none'
      g.style.visibility = o < .002 ? 'hidden' : 'visible'
    })
  }
}
/* a panel sliding up out of depth into place */
function enter(e, t, t0, pos, { s = 1, dur = .7, from = 90, rx = 14 } = {}) {
  const p = P(t, t0, t0 + dur, E.out)
  put(e, { x: pos[0], y: pos[1] + (1 - p) * from, s: s * lerp(.94, 1, p), rx: (1 - p) * rx, o: P(t, t0, t0 + dur * .5), blur: (1 - p) * 12 })
}
const sparkTile = size => `<div class="tile">${spark(size || 20)}</div>`

/* ============================================================
   04 · IT READS
   ============================================================ */
function buildRead(s) {
  const n4 = 4, n5 = 5
  const head = headline(s, '01', 'Reads', [
    { lines: ['It reads the paperwork,', 'and fills in your records.'], at: [wt(n4, 'reads') - .1, wt(n4, 'and') - .05], out: wt(n5, 'anything') - .3 },
    { lines: ['Not sure? It goes', 'to a person.'], at: [wt(n5, 'anything') - .05, wt(n5, 'goes')] },
  ])
  const L = M({
    land: { doc: [-440, 124], ds: .95, rec: [420, 112], rs: 1 },
    port: { doc: [0, -150], ds: .86, rec: [0, 430], rs: 1.05 },
    sq:   { doc: [-262, 112], ds: .7, rec: [252, 104], rs: .74 },
    tall: { doc: [0, -60], ds: .62, rec: [0, 410], rs: .95 },
  })
  const doc = h('div', 'doc inv', s.cam)
  doc.innerHTML = `
    <div class="rowx" style="align-items:flex-start"><div><div class="sup" data-f="sup">Northfield Supplies Ltd</div><div class="bar" style="width:180px;margin-top:12px"></div><div class="bar" style="width:140px"></div></div><div class="ih">Invoice</div></div>
    <div class="meta">
      <div class="k">Invoice no.</div><div><span class="v" data-f="no">INV-4471</span></div>
      <div class="k">Date</div><div><span class="v" data-f="date">12 Sep 2026</span></div>
      <div class="k">PO ref</div><div><span class="hand" data-f="po">PO 77<span style="filter:blur(2.4px);opacity:.85">3</span>1</span></div>
    </div>
    <div class="items">
      <div class="it"><span>Timber, treated 47 × 100</span><span>£ 640.00</span></div>
      <div class="it"><span>Fixings, stainless</span><span>£ 310.00</span></div>
      <div class="it"><span>Delivery</span><span>£ 120.00</span></div>
    </div>
    <div class="tot">
      <div class="k">Net</div><div class="v" data-f="net">£1,070.00</div>
      <div class="k">VAT</div><div class="v" data-f="vat">£214.00</div>
      <div class="k" style="font-weight:600;color:#14110E">Total</div><div class="big" data-f="tot">£1,284.00</div>
    </div>`
  const scan = h('div', 'scan', doc)
  const rec = h('div', 'panel rec', s.cam)
  rec.style.width = '680px'
  const status = { reading: '<span class="dots3"><i></i><i></i><i></i></span>Reading', check: 'Needs a check', saved: CHECK('#B9D4B3', 15) + 'Saved' }
  rec.innerHTML = `<div class="top">${sparkTile(20)}<div><div class="ptitle">Purchase ledger</div><div class="psub">New record</div></div><div class="pill" data-p="1"></div></div><div class="rows"></div>`
  const pill = rec.querySelector('[data-p]')
  const FIELDS = [
    ['sup', 'Supplier', 'Northfield Supplies Ltd'], ['no', 'Invoice no.', 'INV-4471'], ['date', 'Date', '12 Sep 2026'],
    ['po', 'PO ref', 'PO 77?1'], ['net', 'Net', '£1,070.00'], ['vat', 'VAT', '£214.00'], ['tot', 'Total', '£1,284.00'],
  ]
  const rows = FIELDS.map(([f, k, v], i) => {
    const r = h('div', 'r', rec.querySelector('.rows'), `<div class="hl"></div><div class="k">${k}</div>`)
    const slot = h('div', 'slot', r)
    const val = h('div', 'val', r); val.style.position = 'absolute'; val.style.left = '196px'
    const cs = chars(val, v)
    const flag = h('div', 'flag', r)
    return { r, slot, val, cs, flag, hl: r.firstChild, f, v }
  })
  const po = rows[3]
  po.flag.innerHTML = '<div class="pill amber" style="padding:6px 12px;font-size:13px">Not sure</div>'
  const fixed = h('div', 'val', po.r); fixed.style.position = 'absolute'; fixed.style.left = '196px'; fixed.textContent = 'PO 7731'
  const okTick = h('div', 'flag', po.r, `<div class="tick">${CHECK()}</div>`)
  const pop = h('div', 'abs pop', s.cam, `<div class="who"><div class="av">${spark(16)}</div><span>Over to you</span></div><div class="q">Is the PO ref <b>PO 7731</b>?</div><div style="display:flex;gap:10px"><span class="btn">${CHECK('#24170A', 15)} Confirm</span><span class="btn ghost">Edit</span></div>`)
  const boxes = FIELDS.map(([f]) => h('div', 'fbox' + (f === 'po' ? ' amber' : ''), doc))
  const chipsL = h('div', 'layer', s.cam)
  const chips = FIELDS.map(([, , v]) => { const c = h('div', 'chip', chipsL); c.textContent = v; return c })
  const K = cursorNode(s.cam)

  const tReads = wt(n4, 'reads'), tRecords = we(n4, 'records')
  const scanA = tReads - .1, scanB = tReads + 1.35
  const tAny = wt(n5, 'anything'), tGoes = wt(n5, 'goes'), tPerson = wt(n5, 'person')
  const tClick = Math.max(tPerson + .12, lineEnd(n5) - .2)
  cue('whoosh', s.t0 - .02, { d: .4, v: .5 })
  cue('scan', scanA, { d: scanB - scanA })
  let geo, fT = []
  const FK = M({
    land: [[s.t0, 0, 0, 1], [scanA - .2, -100, 20, 1.04], [tRecords - .6, 120, 30, 1.04], [tAny - .15, 400, 20, 1.16], [s.t1, 400, 20, 1.19]],
    port: [[s.t0, 0, 0, 1], [scanA - .2, 0, -110, 1.08], [tRecords - .6, 0, 120, 1], [tAny - .15, 0, 330, 1.12], [s.t1, 0, 330, 1.14]],
    sq:   [[s.t0, 0, 0, 1], [scanA - .2, -120, 20, 1.08], [tRecords - .6, 80, 20, 1.04], [tAny - .15, 250, 40, 1.22], [s.t1, 250, 40, 1.24]],
    tall: [[s.t0, 0, 0, 1], [scanA - .2, 0, -40, 1.06], [tRecords - .6, 0, 120, 1], [tAny - .15, 0, 230, 1.1], [s.t1, 0, 230, 1.12]],
  })
  cue('alert', tAny + .05, { v: .8 })
  cue('pop', tGoes - .12, { v: .7 })
  cue('click', tClick)
  cue('tick', tClick + .22, { v: 1 })
  cue('whoosh', s.t1 - .28, { d: .5 })

  return t => {
    if (!geo) {
      geo = { doc: { w: doc.offsetWidth, h: doc.offsetHeight }, rec: { w: rec.offsetWidth, h: rec.offsetHeight }, f: [], v: [] }
      FIELDS.forEach(([f], i) => {
        const el = doc.querySelector(`[data-f="${f}"]`), o = offs(el, doc)
        geo.f.push(o)
        Object.assign(boxes[i].style, { left: (o.x - 8) + 'px', top: (o.y - 6) + 'px', width: (o.w + 16) + 'px', height: (o.h + 12) + 'px' })
        geo.v.push(offs(rows[i].slot, rec))
      })
      // when the scan line reaches each field, and when its value lands in the record
      fT = geo.f.map(o => lerp(scanA, scanB, (o.y + o.h) / geo.doc.h))
      const span = tRecords + .1 - (fT[0] + .15)
      fT = fT.map((ft, i) => ({ scan: ft, fly: Math.max(ft + .08, fT[0] + .15 + span * i / 6 - .35) }))
      fT.forEach((x, i) => { cue('blip', x.scan, { v: .5 }); cue('swish', x.fly, { v: .45 }); cue('type', x.fly + .5, { d: .22 }) })
      /* the cursor's path is fixed in the record's own frame */
    }
    camera(s, t)
    focus(s, t, FK)
    head(t)
    const inP = s.t0 + .15
    enter(doc, t, inP, L.doc, { s: L.ds, rx: 10 })
    enter(rec, t, inP + .12, L.rec, { s: L.rs, rx: 10 })
    const docTL = [L.doc[0] - geo.doc.w * L.ds / 2, L.doc[1] - geo.doc.h * L.ds / 2]
    const recTL = [L.rec[0] - geo.rec.w * L.rs / 2, L.rec[1] - geo.rec.h * L.rs / 2]
    // scan
    const sp = P(t, scanA, scanB, E.io)
    scan.style.top = (lerp(-120, geo.doc.h - 100, sp)) + 'px'
    vis(scan, bell(t, scanA - .1, scanA + .1, scanB + .25))
    // fields: boxed as the scan passes, then carried across
    rows.forEach((row, i) => {
      const { scan: ts, fly } = fT[i]
      const bo = P(t, ts, ts + .2, E.out) * (1 - P(t, fly + .7, fly + 1.1)) * (i === 3 ? 1 : 1)
      const keepPo = i === 3 ? P(t, tAny - .1, tAny + .15) * (1 - P(t, tClick + .1, tClick + .4)) : 0
      vis(boxes[i], Math.max(bo, keepPo))
      boxes[i].style.transform = `scale(${lerp(1.12, 1, P(t, ts, ts + .25)).toFixed(3)})`
      const f = geo.f[i]
      const from = [docTL[0] + (f.x + f.w / 2) * L.ds, docTL[1] + (f.y + f.h / 2) * L.ds]
      const v = geo.v[i]
      const to = [recTL[0] + (v.x + 80) * L.rs, recTL[1] + (v.y + v.h / 2) * L.rs]
      const fp = P(t, fly, fly + .55, E.ease)
      const pt = arc(from, to, fp, STACK ? 90 : -120)
      const co = P(t, fly, fly + .08) * (1 - P(t, fly + .5, fly + .6))
      const cw = chips[i].offsetWidth || 100, chh = chips[i].offsetHeight || 40
      chips[i].style.transform = `translate(${(pt[0] + W / 2 - cw / 2).toFixed(1)}px,${(pt[1] + H / 2 - chh / 2).toFixed(1)}px) scale(${lerp(.9, 1, Math.sin(fp * Math.PI)).toFixed(3)})`
      vis(chips[i], co)
      // the value types itself in
      const tv = fly + .5
      const k = Math.floor(P(t, tv, tv + .22, E.lin) * row.cs.length + (t >= tv ? 1 : 0))
      row.cs.forEach((c, j) => c.classList.toggle('on', j < k))
      vis(row.slot, 1 - P(t, tv - .05, tv + .1))
      if (i === 3) {
        const warn = P(t, tAny - .1, tAny + .2) * (1 - P(t, tClick + .05, tClick + .3))
        row.val.style.color = warn > .01 ? '#F2C57E' : ''
        vis(row.hl, warn)
        vis(row.flag, warn); row.flag.style.transform = `translateY(-50%) scale(${lerp(.8, 1, P(t, tAny - .1, tAny + .2, E.back)).toFixed(3)})`
        const fx2 = P(t, tClick + .08, tClick + .3)
        vis(row.val, (t >= tv ? 1 : 0) * (1 - fx2)); vis(fixed, fx2)
        vis(okTick, P(t, tClick + .15, tClick + .35)); okTick.style.transform = `translateY(-50%) scale(${lerp(.5, 1, P(t, tClick + .15, tClick + .45, E.back)).toFixed(3)})`
      }
    })
    // status
    const st = t < tAny - .1 ? 'reading' : t < tClick + .2 ? 'check' : 'saved'
    if (pill.dataset.s !== st) { pill.dataset.s = st; pill.innerHTML = status[st]; pill.className = 'pill' + (st === 'check' ? ' amber' : st === 'saved' ? ' ok' : '') }
    rec.querySelectorAll('.dots3 i').forEach((d, k) => { d.style.opacity = (.3 + .7 * Math.max(0, Math.sin((t * 1.6 - k * .22) * Math.PI))).toFixed(3) })
    const pul = 1 + .16 * Math.sin((t - scanA) * 5) * P(t, scanA, scanA + .2) * (1 - P(t, tRecords, tRecords + .3))
    rec.querySelector('.tile svg').style.transform = `scale(${pul.toFixed(3)})`
    // over to a person
    const v3 = geo.v[3]
    const popPos = [recTL[0] + (geo.rec.w - 230) * L.rs, recTL[1] + (v3.y + v3.h + 90) * L.rs]
    const pp = P(t, tGoes - .15, tGoes + .3, E.out) * (1 - P(t, tClick + .25, tClick + .5, E.in2))
    put(pop, { x: popPos[0], y: popPos[1] + (1 - pp) * 20, s: L.rs * lerp(.94, 1, pp), o: pp, blur: (1 - pp) * 8 })
    const btn = [popPos[0] - 150 * L.rs, popPos[1] + 52 * L.rs]
    driveCursor(K, t, [
      [tGoes + .1, tClick - .06, [btn[0] + 380, btn[1] + 340], btn, 60],
      [tClick + .35, tClick + 1.1, btn, [btn[0] + 300, btn[1] + 260], -40],
    ], [tClick], { show: [tGoes + .05, tGoes + .25], hide: [tClick + .6, tClick + .95] })
  }
}

/* ============================================================
   05 · IT SORTS
   ============================================================ */
function buildSort(s) {
  const n = 6
  const head = headline(s, '02', 'Sorts', [
    { lines: ['It sorts the inbox by meaning,', 'and passes it to the right desk.'], at: [wt(n, 'sorts') - .1, wt(n, 'and') - .05] },
  ])
  const L = M({
    land: { inbox: [-452, 118], is: 1, desks: [432, 118], tile: [400, 238], gap: 24 },
    port: { inbox: [0, -120], is: 1.12, desks: [0, 470], tile: [446, 196], gap: 22 },
    sq:   { inbox: [-262, 110], is: .76, desks: [262, 110], tile: [252, 196], gap: 18 },
    tall: { inbox: [0, -20], is: .88, desks: [0, 460], tile: [446, 186], gap: 20 },
  })
  const MAIL = [
    ['Sarah', 'Can we move Thursday’s booking to Friday?', '09:02', 0],
    ['Dev', 'Invoice 4471 attached', '09:05', 1],
    ['Mark', 'Quote for a rear extension?', '09:11', 2],
    ['Jo', 'The part arrived damaged', '09:14', 3],
    ['Amir', 'Is the 2pm slot still free?', '09:20', 0],
    ['Kate', 'Remittance advice, September', '09:26', 1],
    ['Liam', 'Do you work in Alcester?', '09:31', 2],
  ]
  const DESKS = ['Bookings', 'Accounts', 'Sales', 'Customer care']
  const inbox = h('div', 'panel inbox', s.cam)
  inbox.style.width = '640px'
  inbox.innerHTML = `<div class="top">${sparkTile(20)}<div><div class="ptitle">Inbox</div><div class="psub">hello@</div></div><div class="pill" data-c>7 new</div></div><div class="rows" style="position:relative"></div>`
  const rowsEl = inbox.querySelector('.rows')
  const scanbar = h('div', 'scanbar', rowsEl)
  const rows = MAIL.map(([f, sub, tm, d]) => {
    const r = h('div', 'r', rowsEl, `<div class="unread"></div><div class="av">${f[0]}</div><div class="txt"><div class="from">${f}<span class="tm">${tm}</span></div><div class="sub">${sub}</div></div>`)
    const tag = h('div', 'tagp', r); tag.textContent = DESKS[d]
    return { r, tag, d, sub }
  })
  const deskEls = DESKS.map((name, i) => {
    const e = h('div', 'desk', s.cam, `<div class="dh"><span>${name}</span><span class="cnt">0</span></div>`)
    e.style.width = L.tile[0] + 'px'; e.style.height = L.tile[1] + 'px'
    return { e, cnt: e.querySelector('.cnt'), n: 0 }
  })
  const minis = rows.map(r => { const m = h('div', 'mini', s.cam); m.textContent = r.sub; return m })
  const tSorts = wt(n, 'sorts'), tMeans = we(n, 'means'), tAnd = wt(n, 'and'), tDesk = we(n, 'desk')
  const scanT = rows.map((_, i) => lerp(tSorts + .35, tMeans - .05, i / (rows.length - 1)))
  const flyT = rows.map((_, i) => lerp(tAnd - .05, tDesk - .35, i / (rows.length - 1)))
  scanT.forEach(x => cue('blip', x + .08, { v: .45 }))
  flyT.forEach(x => { cue('swish', x, { v: .5 }); cue('tick', x + .5, { v: .45 }) })
  cue('whoosh', s.t1 - .28, { d: .5 })
  let geo
  const slotOf = rows.map((r, i) => rows.slice(0, i).filter(x => x.d === r.d).length)
  const FK = M({
    land: [[s.t0, 0, 0, 1], [scanT[0] - .3, -260, 10, 1.12], [flyT[0] - .2, -60, 40, 1], [tDesk - .2, 300, 40, 1.12], [s.t1, 300, 40, 1.15]],
    port: [[s.t0, 0, 0, 1], [scanT[0] - .3, 0, -90, 1.06], [flyT[0] - .2, 0, 60, 1], [tDesk - .2, 0, 200, 1.04], [s.t1, 0, 210, 1.05]],
    sq:   [[s.t0, 0, 0, 1], [scanT[0] - .3, -200, 20, 1.15], [flyT[0] - .2, 0, 40, 1], [tDesk - .2, 240, 40, 1.18], [s.t1, 240, 40, 1.2]],
    tall: [[s.t0, 0, 0, 1], [scanT[0] - .3, 0, 0, 1.04], [flyT[0] - .2, 0, 60, 1], [tDesk - .2, 0, 120, 1.04], [s.t1, 0, 130, 1.05]],
  })

  return t => {
    if (!geo) {
      geo = { in: { w: inbox.offsetWidth, h: inbox.offsetHeight }, r: rows.map(r => offs(r.r, inbox)) }
      rows.forEach((r, i) => { const tg = r.tag; tg.style.transform = 'translateY(-50%)' })
    }
    camera(s, t)
    focus(s, t, FK)
    head(t)
    enter(inbox, t, s.t0 + .12, L.inbox, { s: L.is })
    const tiles = DESKS.map((_, i) => {
      const cx = L.desks[0] + (i % 2 ? 1 : -1) * (L.tile[0] + L.gap) / 2
      const cy = L.desks[1] + (i < 2 ? -1 : 1) * (L.tile[1] + L.gap) / 2
      return [cx, cy]
    })
    deskEls.forEach((d, i) => enter(d.e, t, s.t0 + .22 + i * .06, tiles[i], { from: 60 }))
    const inTL = [L.inbox[0] - geo.in.w * L.is / 2, L.inbox[1] - geo.in.h * L.is / 2]
    // the spark reads each message in turn
    const sy = geo.r[0].y - 76 + 4
    let yy = 0
    for (let i = 0; i < rows.length; i++) { if (t >= scanT[i] - .14) yy = (i - 1) + P(t, scanT[i] - .14, scanT[i], E.ease) }
    scanbar.style.top = (sy + Math.max(0, yy) * 74) + 'px'
    vis(scanbar, P(t, scanT[0] - .2, scanT[0]) * (1 - P(t, scanT[6] + .2, scanT[6] + .4)))
    const pul = 1 + .16 * Math.sin((t - scanT[0]) * 5) * P(t, scanT[0] - .2, scanT[0]) * (1 - P(t, tDesk - .2, tDesk + .1))
    inbox.querySelector('.tile svg').style.transform = `scale(${pul.toFixed(3)})`
    const counts = [0, 0, 0, 0]
    rows.forEach((r, i) => {
      const tp = P(t, scanT[i], scanT[i] + .25, E.back)
      vis(r.tag, P(t, scanT[i], scanT[i] + .1)); r.tag.style.transform = `translateY(-50%) scale(${lerp(.7, 1, tp).toFixed(3)})`
      const fp = P(t, flyT[i], flyT[i] + .55, E.ease)
      vis(r.r, 1 - P(t, flyT[i], flyT[i] + .08))
      const g = geo.r[i]
      const from = [inTL[0] + (g.x + g.w / 2) * L.is, inTL[1] + (g.y + g.h / 2) * L.is]
      const tile = tiles[r.d]
      const mw = L.tile[0] - 40
      const to = [tile[0], tile[1] - L.tile[1] / 2 + 18 + 30 + 16 + 22 + slotOf[i] * 52]
      const p = arc(from, to, fp, STACK ? 60 : -80)
      const m = minis[i]
      m.style.width = lerp(g.w * L.is, mw, fp) + 'px'
      m.style.transform = `translate(${(p[0] + W / 2 - lerp(g.w * L.is, mw, fp) / 2).toFixed(1)}px,${(p[1] + H / 2 - 22).toFixed(1)}px) scale(${lerp(1.05, 1, fp).toFixed(3)})`
      vis(m, t >= flyT[i] ? 1 : 0)
      if (t >= flyT[i] + .5) counts[r.d]++
    })
    deskEls.forEach((d, i) => { if (d.cnt.textContent !== String(counts[i])) d.cnt.textContent = counts[i]; d.e.style.borderColor = counts[i] ? 'rgba(240,231,216,.28)' : '' })
    const left = rows.filter((r, i) => t < flyT[i] + .1).length
    const c = inbox.querySelector('[data-c]'); const txt = left ? `${left} new` : 'All sorted'
    if (c.textContent !== txt) { c.innerHTML = left ? txt : CHECK('#B9D4B3', 15) + txt; c.className = 'pill' + (left ? '' : ' ok') }
  }
}

/* ============================================================
   06 · IT DRAFTS, AND SHOWS ITS SOURCES
   ============================================================ */
function buildDraft(s) {
  const n = 7
  const head = headline(s, '03', 'Drafts', [
    { lines: ['It drafts from your own records,', MODE === 'land' ? 'and shows where every answer came from.' : 'and shows its sources.'], at: [wt(n, 'drafts') - .1, wt(n, 'and') - .05] },
  ])
  const L = M({
    land: { th: [-250, 124], ts: 1.06, src: [[640, -4], [640, 250]], ss: 1.04, cap: [0, 486] },
    port: { th: [0, -96], ts: 1, src: [[-236, 452], [236, 452]], ss: 1.02, cap: [0, 650] },
    sq:   { th: [0, 76], ts: .84, src: null, cap: [0, 486] },
    tall: { th: [0, -40], ts: .96, src: [[-236, 410], [236, 410]], ss: .98, cap: [0, 580] },
  })
  const th = h('div', 'panel', s.cam)
  th.style.width = M({ land: '930px', def: '940px' })
  const Q = 'Hi, do you deliver to Alcester on Saturdays? And what’s the cut-off for this week?'
  th.innerHTML = `<div class="top">${sparkTile(20)}<div><div class="ptitle">Re: Saturday delivery</div><div class="psub">Customer enquiry</div></div><div class="pill" data-p></div></div>
    <div class="msg"><div class="av">H</div><div class="body"><div class="meta">Hannah <span>09:12</span></div><div class="text">${Q}</div></div></div>
    <div class="msg reply"><div class="av" style="border-color:rgba(233,172,87,.45)">${spark(18)}</div><div class="body"><div class="meta">Draft reply <span>from your records</span></div><div class="text" data-r></div><div class="srcs"></div></div></div>
    <div class="foot"><span class="caption" style="font-size:16px;color:#9A8F80;white-space:nowrap">Nothing is sent until you say so</span><span class="btn" data-b>Review and send</span></div>`
  const rt = th.querySelector('[data-r]')
  // the reply, with the two phrases that are cited marked out
  const parts = [['Yes, we deliver to Alcester'], ['every Saturday, 8am to 1pm.', 0], ['Order by'], ['4pm Thursday', 1], ['and it arrives that weekend.']]
  const rws = [], cites = []
  parts.forEach(([txt, c], i) => {
    if (i) rt.appendChild(document.createTextNode(' '))
    const host = c != null ? h('span', 'cite', rt) : rt
    const ws = words(host, txt)
    rws.push(...ws)
    if (c != null) { const ul = h('span', 'ul', host); cites.push({ host, ul, c }) }
  })
  const srcsEl = th.querySelector('.srcs')
  const SRC = [['Delivery areas', 'p. 2'], ['Order cut-offs', 'p. 1']]
  const chipsEl = SRC.map(([a, b]) => h('span', 'src', srcsEl, `${DOCI()}${a} · ${b}`))
  const pill = th.querySelector('[data-p]')
  const btn = th.querySelector('[data-b]')
  let sdocs = []
  if (L.src) sdocs = SRC.map(([a, b], i) => {
    const e = h('div', 'sdoc', s.cam, `<div class="nm">${DOCI('#C8BBA8')}${a}<span class="pg">${b}</span></div><div class="lines">${[92, 78, 88, 60, 84].map((w, k) => `<i style="width:${w}%" class="${k === (i ? 3 : 1) ? 'hi' : ''}"></i>`).join('')}</div>`)
    e.style.width = M({ land: '360px', def: '430px' })
    return e
  })
  const wires = h('div', 'layer', s.cam, `<svg width="${W}" height="${H}" viewBox="${-W / 2} ${-H / 2} ${W} ${H}" style="overflow:visible"><path fill="none" stroke="#E9AC57" stroke-width="2" stroke-linecap="round"/><path fill="none" stroke="#E9AC57" stroke-width="2" stroke-linecap="round"/><circle r="5" fill="#E9AC57"/><circle r="5" fill="#E9AC57"/></svg>`)
  const wp = [...wires.querySelectorAll('path')], wc = [...wires.querySelectorAll('circle')]
  const cap = h('div', 'abs caption', s.hud, 'A person checks <b>anything that leaves the building.</b>')
  const K = cursorNode(s.cam)

  const tDr = wt(n, 'drafts'), tHold = we(n, 'hold'), tAnd = wt(n, 'and'), tFrom = we(n, 'from', 1)
  const wT = rws.map((_, i) => lerp(tDr + .35, tHold + .05, i / (rws.length - 1)))
  const citeT = [tAnd + .05, tAnd + .55]
  const tClick = Math.min(s.t1 - .75, tFrom + .35)
  wT.forEach((x, i) => { if (i % 2 === 0) cue('type', x, { d: .1, v: .35 }) })
  const FK = M({
    land: [[s.t0, 0, 0, 1], [tDr - .2, -240, 30, 1.14], [citeT[0] - .3, 40, 60, 1], [tClick - .8, -60, 40, 1.08], [s.t1, -60, 40, 1.1]],
    port: [[s.t0, 0, 0, 1], [tDr - .2, 0, -60, 1.08], [citeT[0] - .3, 0, 60, 1], [s.t1, 0, 80, 1.02]],
    sq:   [[s.t0, 0, 0, 1], [tDr - .2, 0, 10, 1.08], [s.t1, 0, 10, 1.1]],
    tall: [[s.t0, 0, 0, 1], [tDr - .2, 0, -60, 1.06], [citeT[0] - .3, 0, 0, 1], [s.t1, 0, 0, 1]],
  })
  citeT.forEach(x => { cue('pop', x, { v: .6 }); cue('zip', x + .05, { d: .45 }) })
  cue('click', tClick)
  cue('tick', tClick + .2, { v: .9 })
  cue('whoosh', s.t1 - .28, { d: .5 })
  let geo

  return t => {
    if (!geo) {
      geo = { th: { w: th.offsetWidth, h: th.offsetHeight }, cite: cites.map(c => offs(c.host, th)), chip: chipsEl.map(c => offs(c, th)), btn: offs(btn, th) }
    }
    camera(s, t)
    focus(s, t, FK)
    head(t)
    enter(th, t, s.t0 + .12, L.th, { s: L.ts })
    const thTL = [L.th[0] - geo.th.w * L.ts / 2, L.th[1] - geo.th.h * L.ts / 2]
    const drafting = t < wT[0] - .05 ? 'wait' : t < wT[wT.length - 1] + .2 ? 'draft' : t < tClick + .15 ? 'ready' : 'sent'
    if (pill.dataset.s !== drafting) {
      pill.dataset.s = drafting
      pill.innerHTML = { wait: '<span class="dots3"><i></i><i></i><i></i></span>Reading records', draft: '<span class="dots3"><i></i><i></i><i></i></span>Drafting', ready: 'Ready for review', sent: CHECK('#B9D4B3', 15) + 'Sent by you' }[drafting]
      pill.className = 'pill' + (drafting === 'sent' ? ' ok' : drafting === 'ready' ? ' amber' : '')
    }
    th.querySelectorAll('.dots3 i').forEach((d, k) => { d.style.opacity = (.3 + .7 * Math.max(0, Math.sin((t * 1.6 - k * .22) * Math.PI))).toFixed(3) })
    const pul = 1 + .16 * Math.sin((t - tDr) * 5) * P(t, tDr, tDr + .2) * (1 - P(t, wT[wT.length - 1], wT[wT.length - 1] + .3))
    th.querySelectorAll('.tile svg, .reply .av svg').forEach(e => { e.style.transform = `scale(${pul.toFixed(3)})` })
    rws.forEach((w, i) => rise(w, t, wT[i], { dur: .3, dy: 8, blur: 6 }))
    cites.forEach((c, i) => {
      const p = P(t, citeT[i], citeT[i] + .35, E.ease)
      c.ul.style.width = '100%'; c.ul.style.transform = `scaleX(${p.toFixed(4)})`; vis(c.ul, p > 0 ? 1 : 0)
      vis(chipsEl[i], P(t, citeT[i] + .15, citeT[i] + .4))
      chipsEl[i].style.transform = `translateY(${((1 - P(t, citeT[i] + .15, citeT[i] + .45)) * 10).toFixed(1)}px)`
    })
    // the sources themselves, and the wires from phrase to page
    sdocs.forEach((e, i) => {
      enter(e, t, citeT[i] - .25, L.src[i], { s: L.ss, from: 40 })
      e.style.borderColor = t > citeT[i] + .35 ? 'rgba(233,172,87,.6)' : ''
      const g = geo.cite[i]
      const a = [thTL[0] + (g.x + g.w) * L.ts, thTL[1] + (g.y + g.h) * L.ts]
      const sw = e.offsetWidth * L.ss, sh = e.offsetHeight * L.ss
      const b = MODE === 'land' ? [L.src[i][0] - sw / 2, L.src[i][1]] : [L.src[i][0], L.src[i][1] - sh / 2]
      const c1 = MODE === 'land' ? [a[0] + 120, a[1]] : [a[0], a[1] + 120]
      const c2 = MODE === 'land' ? [b[0] - 120, b[1]] : [b[0], b[1] - 120]
      wp[i].setAttribute('d', `M${a[0]} ${a[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${b[0]} ${b[1]}`)
      wp[i].setAttribute('pathLength', '1')
      const dp = P(t, citeT[i] + .05, citeT[i] + .5, E.ease)
      wp[i].style.strokeDasharray = '1'; wp[i].style.strokeDashoffset = (1 - dp).toFixed(4)
      wp[i].style.opacity = (dp > 0 ? .85 : 0) * (1 - P(t, tClick, tClick + .3))
      wc[i].setAttribute('cx', b[0]); wc[i].setAttribute('cy', b[1]); wc[i].style.opacity = P(t, citeT[i] + .45, citeT[i] + .55) * (1 - P(t, tClick, tClick + .3))
    })
    // a person reads it and sends it
    const bp = P(t, wT[wT.length - 1], wT[wT.length - 1] + .3)
    btn.style.opacity = (.35 + .65 * bp).toFixed(3)
    btn.style.transform = `scale(${(1 - .06 * bell(t, tClick - .02, tClick + .05, tClick + .2)).toFixed(3)})`
    const bg = geo.btn, bc = [thTL[0] + (bg.x + bg.w / 2) * L.ts, thTL[1] + (bg.y + bg.h / 2) * L.ts]
    driveCursor(K, t, [
      [tClick - .75, tClick - .05, [bc[0] + 260, bc[1] + 260], [bc[0] - 10, bc[1] + 4], 50],
      [tClick + .35, tClick + 1, [bc[0] - 10, bc[1] + 4], [bc[0] + 220, bc[1] + 240], -30],
    ], [tClick], { show: [tClick - .75, tClick - .55], hide: [tClick + .5, tClick + .8] })
    const cp = P(t, tAnd + .9, tAnd + 1.3)
    put(cap, { x: L.cap[0], y: L.cap[1] + (1 - cp) * 14, o: cp, blur: (1 - cp) * 8 })
  }
}

/* ============================================================
   07 · THE BORING VERSION
   ============================================================ */
function buildBoring(s) {
  const n8 = 8, n9 = 9
  const L = M({
    land: { col: [-452, -10], cw: 880, code: [470, 40], cs: 1, y: [-190, -50, 90], big: 92, small: 84, align: 'left' },
    port: { col: [0, -400], cw: 960, code: [0, 330], cs: 1.08, y: [-150, -20, 100], big: 96, small: 80, align: 'center' },
    sq:   { col: [0, -250], cw: 960, code: [0, 250], cs: .9, y: [-120, -20, 80], big: 80, small: 66, align: 'center' },
    tall: { col: [0, -360], cw: 960, code: [0, 290], cs: .98, y: [-140, -30, 80], big: 86, small: 72, align: 'center' },
  })
  const col = h('div', 'abs', s.cam); col.style.width = L.cw + 'px'; col.style.height = '10px'; col.style.textAlign = L.align
  const slot = (y, cls, size) => { const e = h('div', 'display ' + (cls || ''), col); Object.assign(e.style, { position: 'absolute', left: 0, right: 0, top: y + 'px', transform: 'translateY(-50%)', fontSize: size + 'px' }); return e }
  const qbox = h('div', 'abs', s.cam); qbox.style.textAlign = 'center'; qbox.style.width = '1400px'
  const qslot = (cls, size) => { const e = h('div', 'display ' + (cls || ''), qbox); e.style.fontSize = size + 'px'; return e }
  const q = qslot('', M({ land: 124, port: 94, sq: 90, tall: 94 }))
  const qw = words(q, "Doesn't need AI?")
  const qs = h('span', '', q, spark(Math.round(parseFloat(q.style.fontSize) * .62))); qs.style.display = 'inline-block'; qs.style.marginLeft = '.22em'; qs.style.verticalAlign = '-.02em'
  const tog = qslot('', 30); tog.style.margin = '44px 0 26px'
  tog.innerHTML = `<span class="toggle"><span>AI</span><span class="sw"><span class="knob"></span></span><span data-l>On</span></span>`
  const tell = qslot('muted', M({ land: 58, def: 50 })); tell.style.color = '#C8BBA8'
  const tellw = words(tell, 'We’ll tell you.')
  const bv = slot(L.y[0], '', L.big), bvw = words(bv, 'The boring version'); const bdot = h('span', 'sqdot', bv)
  const c1 = slot(L.y[1] + 14, '', L.small), c1w = words(c1, 'Cheaper.')
  const c2 = slot(L.y[2] + 22, '', L.small), c2w = words(c2, 'Breaks less often.')
  c1.style.color = c2.style.color = '#F0E7D8'
  const code = h('div', 'panel code', s.cam)
  const LINES = [
    ['cm', '# No model needed. It’s a rule.'],
    [null, '<span class="kw">for</span> invoice <span class="kw">in</span> <span class="fn">unpaid</span>():'],
    [null, '    <span class="kw">if</span> invoice.due &lt; <span class="fn">today</span>():'],
    [null, '        <span class="fn">send_reminder</span>(invoice)'],
  ]
  code.innerHTML = `<div class="top"><div class="dots"><i></i><i></i><i></i></div><span class="fname">reminders.py</span><span class="pill" style="font-size:13px;padding:6px 12px">4 lines · no AI</span></div><pre></pre>`
  const pre = code.querySelector('pre')
  // type the code character by character, keeping the markup intact
  const typed = []
  LINES.forEach(([cls, html], i) => {
    const ln = h('div', '', pre); ln.innerHTML = `<span class="ln">${i + 1}</span>`
    const tmp = document.createElement('div'); tmp.innerHTML = html
    const walk = (node, into) => {
      node.childNodes.forEach(c => {
        if (c.nodeType === 3) [...c.textContent].forEach(ch => { const sp = h('span', 'ch', into); sp.textContent = ch; typed.push(sp) })
        else { const e = h('span', c.className, into); walk(c, e) }
      })
    }
    const host = cls ? h('span', cls, ln) : ln
    walk(tmp, host)
  })
  const caret = h('div', 'caret', pre); caret.style.width = '3px'
  const tIf = wt(n8, 'and'), tTell = wt(n8, "we'll"), tBuild = wt(n8, 'build'), tBoring = wt(n8, 'boring')
  const tCheap = wt(n9, 'cheaper'), tBreaks = wt(n9, 'breaks')
  const typeA = tBuild - .05, typeB = Math.min(tCheap - .2, typeA + 1.75)
  const chT = typed.map((_, i) => lerp(typeA, typeB, i / (typed.length - 1)))
  chT.forEach((x, i) => { if (i % 2 === 0 && typed[i].textContent.trim()) cue('key', x, { v: .45 }) })
  cue('toggle', tTell + .05)
  cue('hit', tCheap, { v: .9 })
  cue('hit', tBreaks, { v: .75 })
  cue('whoosh', s.t1 - .28, { d: .5 })
  const OUT = tBuild - .25
  let geo

  return t => {
    if (!geo) geo = { ch: typed.map(c => offs(c, pre)) }
    camera(s, t)
    put(col, { x: L.col[0], y: L.col[1] })
    put(qbox, { y: M({ land: -30, port: -140, sq: -60, tall: -90 }) - P(t, OUT, OUT + .35, E.in2) * 40 })
    // the question
    qw.forEach((w, i) => rise(w, t, [tIf, wt(n8, 'job'), wt(n8, 'need')][i] - .02, { dur: .45, dy: 26 }))
    rise(qs, t, wt(n8, 'ai') - .05, { dur: .5, dy: 0, blur: 12, s0: .4 })
    const off = P(t, tTell + .05, tTell + .35, E.ease)
    qs.querySelector('path').setAttribute('fill', off > .5 ? '#5A5249' : '#E9AC57')
    qs.style.filter = `drop-shadow(0 0 ${(18 * (1 - off)).toFixed(1)}px rgba(233,172,87,.7))`
    const qo = 1 - P(t, OUT, OUT + .3, E.in2)
    q.style.opacity = qo; q.style.filter = qo < 1 ? `blur(${((1 - qo) * 14).toFixed(1)}px)` : 'none'; q.style.visibility = qo < .01 ? 'hidden' : 'visible'
    const to = P(t, wt(n8, 'need') + .1, wt(n8, 'need') + .45) * qo
    tog.style.opacity = to.toFixed(3); tog.style.visibility = to < .01 ? 'hidden' : 'visible'
    const knob = tog.querySelector('.knob'), sw = tog.querySelector('.sw')
    knob.style.transform = `translateX(${lerp(44, 0, off).toFixed(1)}px)`
    knob.style.background = off > .5 ? '#9A8F80' : '#F2C57E'
    sw.style.background = off > .5 ? 'rgba(240,231,216,.06)' : 'rgba(233,172,87,.25)'
    sw.style.borderColor = off > .5 ? 'rgba(240,231,216,.25)' : 'rgba(233,172,87,.7)'
    const lab = off > .5 ? 'Off' : 'On'; const le = tog.querySelector('[data-l]'); if (le.textContent !== lab) le.textContent = lab
    tellw.forEach((w, i) => rise(w, t, tTell + i * .08, { dur: .45, dy: 20 }))
    tell.style.opacity = qo; tell.style.visibility = qo < .01 ? 'hidden' : 'visible'
    // the boring version
    bvw.forEach((w, i) => rise(w, t, [tBuild, tBoring - .1, tBoring][i], { dur: .5, dy: 30 }))
    const dp = P(t, tBoring + .35, tBoring + .6, E.back); bdot.style.transform = `scale(${dp.toFixed(3)})`; vis(bdot, dp > 0 ? 1 : 0)
    rise(c1w[0], t, tCheap - .03, { dur: .35, dy: 40, blur: 20, s0: 1.14 })
    c2w.forEach((w, i) => rise(w, t, tBreaks - .03 + i * .1, { dur: .35, dy: 40, blur: 20, s0: 1.14 }))
    // the code
    enter(code, t, OUT - .1, L.code, { s: L.cs, from: 80 })
    let last = -1
    typed.forEach((c, i) => { const on = t >= chT[i]; c.classList.toggle('on', on); if (on) last = i })
    const g = geo.ch[Math.max(0, last)]
    caret.style.left = (last < 0 ? g.x : g.x + g.w + 2) + 'px'; caret.style.top = (g.y + 6) + 'px'; caret.style.height = (g.h - 12) + 'px'
    vis(caret, t < chT[0] - .1 ? 0 : (t < chT[chT.length - 1] + .05 ? 1 : (Math.floor(t / .53) % 2 ? 0 : 1)))
  }
}

/* ============================================================
   08 · THE TERMS
   ============================================================ */
function buildTerms(s) {
  const n = 10
  const box = h('div', 'abs terms', s.cam)
  const T = [['01', 'No retainer.', 'no'], ['02', 'A price before we start.', 'a'], ['03', 'You own what we build.', 'you']]
  const rows = T.map(([no, tx]) => {
    const r = h('div', 'term', box, `<div class="no">${no}</div>`)
    const e = h('div', 'display tx', r)
    const ws = words(e, tx)
    const rule = h('div', 'rule', r)
    return { r, no: r.firstChild, ws, rule }
  })
  const at = T.map(([, , k]) => wt(n, k))
  at.forEach(x => cue('hit', x, { v: .65 }))
  cue('whoosh', s.t1 - .28, { d: .55 })
  return t => {
    camera(s, t, { push: .03 })
    put(box, { x: M({ land: 40, def: 0 }), y: 0 })
    rows.forEach((r, i) => {
      const t0 = at[i] - .08
      rise(r.no, t, t0, { dur: .4, dy: 0, blur: 8 })
      r.ws.forEach((w, k) => rise(w, t, t0 + k * .05, { dur: .45, dy: 34, blur: 18 }))
      const rp = P(t, t0, t0 + .7, E.ease)
      r.rule.style.transform = `scaleX(${rp.toFixed(4)})`
      const nextAt = at[i + 1]
      const dim = nextAt ? P(t, nextAt - .1, nextAt + .2) * (1 - P(t, lineEnd(n) + .05, lineEnd(n) + .4)) : 0
      r.r.style.opacity = (1 - .5 * dim).toFixed(3)
    })
  }
}

/* ============================================================
   09 · END CARD: the wordmark draws itself, the dot lands
   ============================================================ */
function buildEnd(s) {
  const n = 11
  const L = M({ land: { w: 860, y: -96, tag: 176, url: 300 }, port: { w: 820, y: -170, tag: 128, url: 250 }, sq: { w: 700, y: -120, tag: 126, url: 236 }, tall: { w: 760, y: -150, tag: 128, url: 250 } })
  const mark = h('div', 'abs mark', s.cam, WORDMARK())
  mark.firstChild.setAttribute('width', L.w)
  const el = k => mark.querySelector(`[data-k="${k}"]`)
  const strokes = ['n', 'ab', 'as', 'bs', 'bb', 'l'].map(k => el(k))
  const dot = el('dot')
  const glow = h('div', 'abs', s.cam); Object.assign(glow.style, { width: '900px', height: '900px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(233,172,87,.30), rgba(233,172,87,.06) 55%, transparent)' })
  s.cam.insertBefore(glow, mark)
  const ring = h('div', 'ring', s.cam); ring.style.width = ring.style.height = '120px'
  const tag = h('div', 'abs tagline', s.cam)
  const tw = words(tag, 'AI, where it earns its place.')
  const url = h('div', 'abs url', s.cam, `<span class="cta">Book a free discovery call</span><span class="sep"></span><span>nabl.agency</span>`)
  const tDot = wt(n, 'n.abl')
  const draw = [[-1.5, -.85], [-1.28, -.62], [-1.0, -.72], [-.95, -.62], [-.85, -.3], [-.7, -.35]].map(([a, b]) => [tDot + a, tDot + b])
  const tagT = ['ai', 'where', 'it', 'earns', 'its', 'place'].map(k => wt(n, k))
  cue('draw', draw[0][0], { d: draw[5][1] - draw[0][0] })
  cue('fall', tDot - .3, { d: .3 })
  cue('thud', tDot, { v: 1 })
  cue('shimmer', tDot + .02, { d: 3, v: .7 })
  cue('pop', tagT[5] + .6, { v: .45 })
  const u = L.w / 273
  // where the dot sits on the stage, from its place in the artwork
  const dotC = [(-273 / 2 + 84.5) * u, L.y + (-50 + 75.5) * u]
  return t => {
    camera(s, t, { push: .03, noOut: true })
    const fade = P(t, s.t1 - .55, s.t1, E.in2)
    s.rig.style.opacity = (1 - fade).toFixed(4)
    const hitK = bell(t, tDot, tDot + .06, tDot + .45)
    put(mark, { y: L.y + hitK * 5 })
    strokes.forEach((e, i) => { const p = P(t, draw[i][0], draw[i][1], E.io); e.style.strokeDasharray = '1 1'; e.style.strokeDashoffset = (1 - p).toFixed(4); e.style.opacity = p > 0 ? 1 : 0 })
    const fp = P(t, tDot - .32, tDot, E.in3)
    dot.setAttribute('transform', `translate(0 ${(lerp(-150, 0, fp)).toFixed(2)})`)
    dot.style.opacity = P(t, tDot - .32, tDot - .25)
    const g = P(t, draw[0][0], tDot, E.io) * .6 + .5 * bell(t, tDot, tDot + .08, tDot + 1.4)
    put(glow, { x: dotC[0] * .2, y: L.y, s: .8 + .3 * g, o: g })
    const rp = P(t, tDot, tDot + .9, E.out)
    put(ring, { x: dotC[0], y: dotC[1], s: lerp(.2, 5, rp), o: t >= tDot ? (1 - rp) * .85 : 0 })
    mark.firstChild.style.filter = `drop-shadow(0 0 ${(30 * hitK).toFixed(1)}px rgba(233,172,87,.5))`
    put(tag, { y: L.tag })
    tw.forEach((w, i) => rise(w, t, tagT[i] - .06, { dur: .5, dy: 26, blur: 14 }))
    const up = P(t, tagT[5] + .55, tagT[5] + 1.05)
    put(url, { y: L.url + (1 - up) * 18, o: up, blur: (1 - up) * 8 })
  }
}

/* ---------- ground: blooms, grid, grain, the corner mark ---------- */
function ground_(t) {
  const sc = id => TL.scenes.find(s => s.id === id)
  const boom = SCENES[1].boom, dotT = wt(11, 'n.abl')
  // [time, ax, ay, aStrength, cx, cy, cStrength, grid]
  const K = [
    [0, .22, .18, .45, .82, .86, .5, 0],
    [sc('pile').start, .72, .28, .6, .2, .82, .55, 0],
    [boom - .02, .66, .34, .5, .22, .8, .45, 0],
    [boom + .1, .5, .44, 1.25, .5, .56, .7, 0],
    [sc('read').start, .2, .22, .7, .86, .82, .55, .75],
    [sc('sort').start, .8, .24, .7, .14, .84, .55, .75],
    [sc('draft').start, .24, .76, .7, .82, .2, .55, .75],
    [sc('boring').start, .5, .5, .35, .5, .5, .35, .35],
    [wt(9, 'cheaper') - .02, .5, .5, .35, .5, .5, .35, .35],
    [wt(9, 'cheaper') + .2, .7, .3, .75, .2, .8, .55, .2],
    [sc('terms').start, .2, .5, .7, .85, .7, .5, 0],
    [sc('end').start, .5, .45, .55, .5, .7, .4, 0],
    [dotT, .5, .45, .8, .5, .7, .45, 0],
    [dotT + .15, .5, .45, 1.1, .5, .7, .55, 0],
    [TL.duration, .5, .45, .85, .5, .7, .45, 0],
  ]
  let i = 0; while (i < K.length - 2 && t >= K[i + 1][0]) i++
  const a = K[i], b = K[i + 1]
  const p = P(t, a[0], b[0], E.io)
  const v = a.map((x, j) => lerp(x, b[j], p))
  const D = Math.max(W, H)
  const da = D * 1.3, dc = D * 1.15
  const wob = Math.sin(t * .35) * 30
  bloomA.style.width = bloomA.style.height = da + 'px'
  bloomA.style.transform = `translate(${(v[1] * W - da / 2 + wob).toFixed(1)}px,${(v[2] * H - da / 2).toFixed(1)}px)`
  bloomA.style.opacity = Math.min(1, v[3]).toFixed(3)
  bloomC.style.width = bloomC.style.height = dc + 'px'
  bloomC.style.transform = `translate(${(v[4] * W - dc / 2 - wob).toFixed(1)}px,${(v[5] * H - dc / 2).toFixed(1)}px)`
  bloomC.style.opacity = Math.min(1, v[6]).toFixed(3)
  grid.style.opacity = (v[7] * .8).toFixed(3)
  grid.style.backgroundPosition = `${(t * 6).toFixed(1)}px ${(t * 3).toFixed(1)}px`
  const fl = Math.max(0, v[3] - 1) * 1.6
  vis(flash, fl)
  // the corner mark, present everywhere but the end card
  const bo = 1 - P(t, sc('end').start - .3, sc('end').start)
  const bp = M({ land: [W / 2 - 112, H / 2 - 62], port: [0, -H / 2 + 96], def: [W / 2 - 100, H / 2 - 56] })
  put(bug, { x: bp[0], y: bp[1], o: bo * .75 })
}

/* ---------- boot ---------- */
async function boot() {
  TL = await (await fetch('/marketing/launch-video/build/timeline.json')).json()
  await document.fonts.ready
  await Promise.all(['600 100px "Space Grotesk"', '500 20px "Inter Tight"', '500 20px "JetBrains Mono"'].map(f => document.fonts.load(f)))
  scene(['hook'], buildHook)
  scene(['pile', 'turn'], buildPile)
  scene(['read'], buildRead)
  scene(['sort'], buildSort)
  scene(['draft'], buildDraft)
  scene(['boring'], buildBoring)
  scene(['terms'], buildTerms)
  scene(['end'], buildEnd)
  CUES.sort((a, b) => a.t - b.t)
  window.CUES = CUES
  window.TL = TL
  window.MODE = MODE
  window.seek = t => {
    for (const s of SCENES) {
      const on = t >= s.t0 && t < s.t1
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
