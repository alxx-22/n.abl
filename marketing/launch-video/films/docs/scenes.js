/* ============================================================
   THE DOCS REEL: n.abl's Document AI, in 16 seconds

   Problem, then answer, and every move on a hit of the track. In the
   2026-11 brand: Manjari, the lit ground (ground.js, the brand demo's own
   shader), and three lights that keep their meaning: ember for the problem,
   amber for n.abl, ice for the AI at work. Paper is the one light thing.

   pile   Monday, 9am. The paperwork lands on every pluck: one invoice,
          two, three, then by the dozen, by the hundred. Ember builds
   type   the track's silence: one supplier's name typed in by hand, a key
          at a time. Invoice 1 of 500. The light drops low
   week   the plucks again: the calendar flips Tuesday to Friday, the count
          barely moves; a whole week, gone. Ember at its height
   flash  the three build hits: n.abl Document AI, flashed in and out, the
          light flaring with each and the glass coming in, fine reeds first
   fix    the drop: Monday, 9am again. The pile goes into Document AI;
          read, checked, filed, one word a clap, the reeds breathing on the
          kicks and ice rising as it works; done by 9:02
   end    the aurora rises; the name, Document AI, Paperwork, read and
          filed., the address, held
   The script is films/docs/film.py; the brief is films/docs/SCRIPT.md.
   ============================================================ */

import { E, M, P, TL, W, H, WORDMARK, bell, cue, h, lerp, put, rise, rng, scene, stage, vis } from '../../film/stage.js'
import { ground as groundLayer } from '../../film/stage.js'
import { blurIn, lens, path, shoot, widen } from '../../film/kit.js'
import { L, dim, ground, mix, mk } from './ground.js'

// Manjari, before anything is measured
await Promise.all(['100 100px Manjari', '400 40px Manjari', '700 40px Manjari', '500 26px "JetBrains Mono"'].map(f => document.fonts.load(f)))

const B = TL.beat, OFF = 0.304
const bt = k => OFF + k * B                               // the track's own beat k (its first is 0.304 s in)
const CHECK = (s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const STOP = '<span class="d-stop"></span>'

/* where things sit, per frame */
const TOPY = M({ land: -428, sq: -432, tall: -548, port: -772 })      // the clock
const CAPY = M({ land: -282, sq: -268, tall: -372, port: -552 })      // the caption
const MIDY = M({ land: 112, sq: 118, tall: 130, port: 110 })          // what it is about
const CAP = M({ land: 136, sq: 104, tall: 108, port: 112 }), CAPW = M({ land: 1720, def: 980 })

/* words keep the light off them: each visible text block is a shield for the ground */
const SH = []
function shield(e, k = .9) {
  if (+e.style.opacity < .05 || e.style.visibility === 'hidden') return
  const r = e.getBoundingClientRect(), o = stage.getBoundingClientRect()
  if (r.width < 2) return
  SH.push([r.left - o.left, r.top - o.top, r.right - o.left, r.bottom - o.top, k])
}

/* a caption: Thin cream type, centred, wrapping in the narrow frames */
function cap(parent, html, size = CAP) {
  const e = h('div', 'd-cap', parent, html)
  Object.assign(e.style, { fontSize: size + 'px', width: 'max-content', maxWidth: CAPW + 'px' })
  return e
}
/* in on a hit (fast, so it lands with it), out on another */
function capAt(e, t, a, b, { y = CAPY, x = 0, dy = 36 } = {}) {
  const pi = P(t, a - .03, a + .2, E.out), po = b == null ? 0 : P(t, b - .1, b + .02, E.in2)
  put(e, { x, y: y + (1 - pi) * dy - po * 24, s: lerp(.94, 1, pi) * lerp(1, 1.03, po), o: pi * (1 - po), blur: (1 - pi) * 14 + po * 14 })
  if (pi * (1 - po) > .3) shield(e)
}
/* the clock: a face, a day and a time; set(day, minutes after midnight) */
function clock(parent) {
  const e = h('div', 'd-clock d-glass', parent, '<span class="face"><i class="h"></i><i class="m"></i></span><span class="day">MON</span><span class="tm">09:00</span>')
  const [hh, mm] = e.querySelectorAll('.face i'), day = e.querySelector('.day'), tm = e.querySelector('.tm')
  e.set = (d, mins) => {
    hh.style.transform = `rotate(${(mins / 720 * 360).toFixed(1)}deg)`; mm.style.transform = `rotate(${(mins / 60 * 360).toFixed(1)}deg)`
    day.textContent = d
    const m = Math.round(mins); tm.textContent = `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  }
  e.set('MON', 540)
  return e
}
/* a sheet of paper */
const KINDS = ['INVOICE', 'DELIVERY NOTE', 'INVOICE', 'FORM', 'INVOICE', 'STATEMENT', 'INVOICE', 'RECEIPT']
const LW = [62, 44, 90, 84, 70, 92, 58, 80, 40, 66]
function sheet(parent, i) {
  const lines = LW.map((w, j) => `<i class="${j === 1 || j === 8 ? 'd' : ''}" style="width:${(w + (i * 7 + j * 13) % 17) % 100}%"></i>`).join('')
  return h('div', 'd-sheet ' + ['', 'b', 'c'][i % 3], parent, `<div class="h">${KINDS[i % KINDS.length]}</div>${lines}`)
}
/* the pile: where each sheet lands. The first three big and in the middle;
   the rest heap up from the bottom, wider and higher as it grows, and stop
   short of the words: copy sits on a dark field, never on the paper */
const N = 46
const YMIN = M({ land: 40, sq: 96, tall: -10, port: -190 })        // the highest a sheet's centre comes
const HEAP = (() => {
  const r = rng(11), out = []
  const first = [[0, 150, -4, 1.24], [46, 128, 6, 1.24], [-38, 110, -9, 1.24]]
  for (let i = 0; i < N; i++) {
    if (i < 3) { const [x, y, rot, s] = first[i]; out.push({ x, y, r: rot, s }); continue }
    const f = (i - 3) / (N - 4)
    const top = H / 2 - 70 - Math.pow(f, .85) * (H / 2 - 70 - YMIN)
    const spread = lerp(320, W / 2 + 40, Math.pow(f, .5))
    out.push({ x: (r() * 2 - 1) * spread, y: top + r() * 150, r: (r() - .5) * 56, s: .86 + r() * .34 })
  }
  return out
})()

/* ============================================================
   PILE: Monday, 9am, and the paperwork lands on every pluck
   ============================================================ */
// [beat, sheets in the burst, the count it brings the pile to]
const BURSTS = [[0, 1, 1], [.5, 1, 2], [1, 1, 3], [2, 3, 12], [2.5, 4, 40], [3, 6, 95], [3.5, 7, 180], [4, 9, 320], [5, 14, 500]]
function buildPile(s) {
  widen(s)
  const t0 = s.t0
  const r = rng(5)
  const sheets = [], land = []
  let i = 0
  BURSTS.forEach(([b, n]) => { for (let j = 0; j < n; j++, i++) land.push(bt(b) - .012 + j * .022) })
  for (let k = 0; k < N; k++) {
    const p = HEAP[k], e = sheet(s.cam, k)
    // tossed in from the sides, arcing up and landing on the pile on the pluck
    const side = p.x === 0 ? -1 : Math.sign(p.x) * (r() < .8 ? 1 : -1)
    sheets.push({ e, p, tl: land[k], x0: side * (W / 2 + 260 + r() * 200), y0: p.y + 140 + r() * 260, arc: 160 + r() * 180, r0: p.r - side * (60 + r() * 90), fall: k < 3 ? .34 : .28 + r() * .06 })
  }
  const row = h('div', 'd-row', s.hud), clk = clock(row)
  const cnt = h('div', 'd-count', row, '<span class="sq"></span><span><b>1</b> <span class="u">document</span></span>'), cn = cnt.querySelector('b'), cw = cnt.querySelector('.u')
  const capA = cap(s.hud, `Monday, 9am${STOP}`), capB = cap(s.hud, `Here comes the paperwork${STOP}`)
  BURSTS.forEach(([b, n]) => { for (let j = 0; j < Math.min(3, n); j++) cue('paper', bt(b) + j * .03, { v: Math.min(.85, .45 + n * .03), pan: (j - 1) * .5 }) })
  return t => {
    // each sheet falls in and lands on its pluck, with a little settle
    sheets.forEach(d => {
      const ts = d.tl - d.fall, u = P(t, ts, d.tl, E.lin), st = bell(t, d.tl, d.tl + .03, d.tl + .2)
      put(d.e, { x: lerp(d.x0, d.p.x, E.out2(u)), y: lerp(d.y0, d.p.y, u) - d.arc * Math.sin(Math.PI * u), r: lerp(d.r0, d.p.r, P(t, ts, d.tl, E.out)), s: d.p.s * (1 + .05 * st), o: t >= ts ? 1 : 0 })
    })
    // the count jumps with each burst
    let n = 0, k = -1; BURSTS.forEach(([b, , c], j) => { if (t >= bt(b) - .02) { n = c; k = j } })
    cn.textContent = n; cw.textContent = n === 1 ? 'document' : 'documents'
    const kb = k < 0 ? 0 : bell(t, bt(BURSTS[k][0]) - .02, bt(BURSTS[k][0]) + .03, bt(BURSTS[k][0]) + .25)
    cnt.style.transform = `scale(${(1 + .12 * kb).toFixed(3)})`; cnt.style.opacity = n ? 1 : 0
    blurIn(row, t, t0 + .02, { y: TOPY, dur: .3, s0: 1, blur: 10, dy: -14 })
    shield(row, .7)
    capAt(capA, t, bt(0), bt(2))
    capAt(capB, t, bt(2), null)
    // the camera pulls back as the pile grows, and jolts with each burst
    let jolt = 0; BURSTS.forEach(([b, nn]) => { jolt += bell(t, bt(b) - .01, bt(b) + .02, bt(b) + .22) * Math.min(1, .25 + nn * .06) })
    s.rig.style.transform = `scale(${(1 + .018 * jolt).toFixed(4)}) translateY(${(jolt * 4).toFixed(1)}px)`
    shoot(s, path([[t0, 0, 30, 0, 0, 0, 0, 1.06], [bt(2), 0, 20, 0, 0, 0, 0, 1.04], [s.t1, 0, 0, 0, 0, 0, 0, .94]]), t)
    lens(s, {})
  }
}

/* ============================================================
   TYPE: the silence. One name, typed in by hand, a key at a time
   ============================================================ */
function buildType(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const KEYS = [t0 + .12, t0 + .36, t0 + .6, t0 + .84], TXT = ['H', 'Ha', 'Har', 'Harb']
  const form = h('div', 'd-form d-glass', s.cam, `<div class="hd"><span>Invoice 1 of 500</span><span class="pr"><i></i>By hand</span></div>
    <div class="lb">Supplier name</div><div class="in"><span class="tx"></span><span class="caret"></span></div>
    <div class="gh"><div></div><div></div></div>`)
  const tx = form.querySelector('.tx'), caret = form.querySelector('.caret')
  const capA = cap(s.hud, `<span class="w">Typed in.</span> <span class="w">By hand${STOP}</span>`)
  const [wa, wb] = capA.querySelectorAll('.w')
  KEYS.forEach(k => cue('key', k, { v: 2.4 }))
  return t => {
    let n = 0; KEYS.forEach(k => { if (t >= k) n++ })
    tx.textContent = n ? TXT[n - 1] : ''
    const since = n ? t - KEYS[n - 1] : t - t0
    caret.style.opacity = since < .12 || (since % .5) < .28 ? 1 : 0
    put(form, { y: MIDY + 10, s: M({ land: 1.06, def: 1 }) })
    put(capA, { y: CAPY }); shield(capA)
    rise(wa, t, t0 + .01, { dur: .22, dy: 26, blur: 12 })
    rise(wb, t, KEYS[2] - .02, { dur: .22, dy: 26, blur: 12 })
    shield(form, .6)
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 30, 0, 0, 0, 0, 1.07]]), t)
    lens(s, {})
  }
}

/* ============================================================
   WEEK: the calendar flips on the plucks; a whole week, gone
   ============================================================ */
function buildWeek(s) {
  widen(s)
  const t0 = s.t0
  const DAYS = ['Tue', 'Wed', 'Thu', 'Fri'], FLIP = [bt(8), bt(8.5), bt(9)], DONE = [6, 11, 15, 19]
  const cal = h('div', 'd-cal', s.cam)
  const pages = DAYS.map((d, i) => { const p = h('div', 'pg', cal, `<div class="bar"><i></i>THIS WEEK</div><div class="dn">${d}</div>`); p.style.zIndex = 10 - i; return p })
  const prog = h('div', 'd-prog', s.cam, '<div class="tx"><span>Typed in</span><span class="n"><b>6</b> of 500</span></div><div class="tr"><i></i></div>')
  const pn = prog.querySelector('b'), bar = prog.querySelector('.tr i')
  const capA = cap(s.cam, `<span class="w">A whole week,</span> <span class="w">gone${STOP}</span>`, M({ land: 164, def: 120 }))
  const [wa, wb] = capA.querySelectorAll('.w')
  const CY = M({ land: -40, sq: -60, tall: -70, port: -90 }), CK = M({ land: .92, sq: .9, tall: 1, port: 1.12 })
  const PY = CY + 260 * CK + 64, PY2 = M({ land: 170, def: 190 })
  FLIP.forEach(f => cue('flip', f - .02, { v: .7 }))
  cue('whoosh', bt(10), { d: .4, v: .35 })
  return t => {
    // each page tears up and away on its pluck
    pages.forEach((p, i) => {
      const f = i < FLIP.length ? P(t, FLIP[i] - .1, FLIP[i] + .06, E.in2) : 0
      p.style.transform = `rotateX(${(f * 110).toFixed(1)}deg) translateY(${(-f * 40).toFixed(1)}px)`
      p.style.opacity = f < .95 ? 1 : 0
    })
    let k = 0; FLIP.forEach(f => { if (t >= f - .02) k++ })
    pn.textContent = DONE[k]; bar.style.width = (DONE[k] / 500 * 100).toFixed(2) + '%'
    const kb = k ? bell(t, FLIP[k - 1] - .02, FLIP[k - 1] + .02, FLIP[k - 1] + .22) : 0
    // on the swell the calendar drops away, and the line takes its place
    const gone = P(t, bt(10) - .08, bt(10) + .3, E.in2)
    put(cal, { y: CY + gone * 700, s: CK * (1 + .03 * kb), r: gone * 8, o: (1 - P(t, bt(10) + .1, bt(10) + .3)), blur: gone * 6 })
    const pm = P(t, bt(10), bt(10) + .35, E.out)
    put(prog, { y: lerp(PY, PY2, pm), s: CK, o: P(t, t0, t0 + .15) })
    put(capA, { y: M({ land: -50, def: -60 }), s: 1 + .03 * P(t, bt(12) - .02, s.t1, E.out) })
    rise(wa, t, bt(10) - .02, { dur: .26, dy: 40, blur: 16 })
    rise(wb, t, bt(11) - .02, { dur: .26, dy: 40, blur: 16, s0: 1.2 })
    if (t > bt(10)) shield(capA)
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1.02], [bt(10), 0, 0, 0, 0, 0, 0, 1], [s.t1, 0, 0, 0, 0, 0, 0, 1.05]]), t)
    lens(s, {})
  }
}

/* ============================================================
   FLASH: the three build hits, n.abl Document AI on each
   ============================================================ */
const HITS = [bt(12.5) - .015, bt(13) - .01, bt(13.5) - .01]
function buildFlash(s) {
  widen(s)
  const SC = [1, 1.25, 1.55]
  const lock = h('div', 'd-lock', s.cam, `${WORDMARK()}<div class="ai">Document AI</div>`)
  const svg = lock.querySelector('svg'), ww = M({ land: 700, def: 600 }); svg.setAttribute('width', ww); svg.setAttribute('height', ww * 100 / 273)
  svg.style.filter = 'drop-shadow(0 0 30px rgba(251,246,236,.18))'
  return t => {
    let k = 0; HITS.forEach((a, i) => { if (t >= a) k = i })
    const dt = Math.max(0, t - HITS[k]), l = dt < .22 ? Math.exp(-dt / .07) * (1 - dt / .22) : 0
    put(lock, { s: SC[k] * (1 + .06 * dt / .27), o: l, blur: dt > .08 ? (dt - .08) * 40 : 0 })
    if (l > .3) shield(lock, 1)
    shoot(s, path([[s.t0, 0, 0, 0, 0, 0, 0, 1], [s.t1, 0, 0, 0, 0, 0, 0, 1]]), t)
    lens(s, {})
  }
}

/* ============================================================
   FIX: the drop. Monday, 9am again: the pile goes in; read, checked,
   filed; done by 9:02
   ============================================================ */
const INV = `
  <div class="top"><div class="f" data-k="sup"><span class="hl"></span><span class="sup">Harbour Foods Ltd</span></div><div class="kind">INVOICE</div></div>
  <div class="meta"><div><span class="k">Invoice</span><div class="f" data-k="no"><span class="hl"></span><b>INV-2291</b></div></div><div><span class="k">Order</span><b>PO-0417</b></div></div>
  <div class="it"><span>Plum tomatoes, 2.5 kg</span><b>£186.00</b></div>
  <div class="it"><span>Olive oil, 5 L</span><b>£214.20</b></div>
  <div class="it"><span>Flour, 16 kg</span><b>£142.50</b></div>
  <div class="tot">Total<div class="f" data-k="tot"><span class="hl"></span><b>£542.70</b></div></div>`
const FOLDER = '<svg viewBox="0 0 64 52"><path d="M2 8a6 6 0 016-6h14l6 7h28a6 6 0 016 6v29a6 6 0 01-6 6H8a6 6 0 01-6-6z" fill="rgba(240,231,216,.05)" stroke="#DED2C0" stroke-width="2.5"/><rect x="45" y="35" width="8" height="8" fill="#E9AC57"/></svg>'
const FOLDERS = [['Accounts', 312], ['Deliveries', 141], ['People', 47]]
const T_IN = bt(15), T_HL = [bt(15.25), bt(15.5), bt(15.75)], T_STAMP = bt(16), T_FILE = bt(17), T_DONE = bt(19)
function buildFix(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const r = rng(23)
  // the pile, from the first shot, goes into Document AI on the drop
  const pile = HEAP.slice(N - 30).map((p, j) => ({ e: sheet(s.cam, N - 30 + j), p, d: .004 * j + r() * .03 }))
  const pill = h('div', 'd-pill', s.cam, '<span class="dot"></span><span>Reading <b>500</b> documents</span>')
  const pdot = pill.querySelector('.dot')
  const inv = h('div', 'd-inv', s.cam, INV)
  const hls = ['sup', 'no', 'tot'].map(k => inv.querySelector(`.f[data-k="${k}"] .hl`))
  const stamp = h('div', 'd-stampx', inv, `<span class="ck">${CHECK(28)}</span>Matched to order`)
  const fl = FOLDERS.map(([nm]) => h('div', 'd-folder d-glass', s.cam, `<div class="ic">${FOLDER}</div><div class="nm">${nm}</div><div class="ct"><span class="n">0</span><span class="ok">${CHECK(22)}</span></div>`))
  const fn = fl.map(e => e.querySelector('.n')), fok = fl.map(e => e.querySelector('.ok'))
  const FK = M({ land: 1, sq: .82, tall: .84, port: 1.04 })
  const FP = M({ land: [[-420, 0], [0, 0], [420, 0]], sq: [[-330, 0], [0, 0], [330, 0]], tall: [[-330, 0], [0, 0], [330, 0]], port: [[0, -300], [0, 0], [0, 300]] }).map(([x, y]) => [x, MIDY + y + M({ land: 20, def: 30 })])
  const minis = Array.from({ length: 18 }, (_, j) => ({ e: h('div', 'd-mini', s.cam), f: j % 3, a: bt(17.25) + j * B / 8, x0: (r() < .5 ? -1 : 1) * (W / 2 + 80), y0: (r() - .5) * H * .8, rot: (r() - .5) * 60 }))
  const row = h('div', 'd-row', s.hud), clk = clock(row)
  const capM = cap(s.hud, `Monday, 9am${STOP}`)
  const capR = cap(s.hud, '<span class="w">Read.</span> <span class="w">Checked.</span> <span class="w">Filed.</span>', M({ land: 136, sq: 100, tall: 100, port: 96 }))
  Object.assign(capR.style, { maxWidth: 'none', whiteSpace: 'nowrap' })
  const ws = [...capR.querySelectorAll('.w')]
  const capD = cap(s.hud, `Done by 9:02${STOP}`)
  const IK = M({ land: 1.12, sq: .9, tall: .96, port: 1.14 })
  let WW = null
  cue('whoosh', t0 + .26, { d: .45, v: .55 })
  cue('pop', t0 + .34, { v: .5 })
  cue('pop', T_IN, { v: .45 })
  T_HL.forEach(a => cue('blip', a, { v: .55 }))
  cue('stamp', T_STAMP, { v: 1 })
  cue('swish', T_FILE + .05, { v: .4 })
  minis.forEach((m, j) => { if (j % 2 === 0) cue('tick', m.a + .32, { v: .28 }) })
  cue('confirm', T_DONE, { n: 2, deg: 3, v: .6 })
  return t => {
    // on the drop the whole pile jumps, then is pulled into the live chip, the top of it last
    const jump = bell(t, t0 - .01, t0 + .05, t0 + .22)
    pile.forEach(q => {
      const u = P(t, t0 + .02 + q.d, t0 + .02 + q.d + .3, E.in2)
      put(q.e, { x: lerp(q.p.x, 0, u), y: lerp(q.p.y - 46 * jump, MIDY, u), r: lerp(q.p.r * (1 + .4 * jump), 0, u), s: lerp(q.p.s * (1 + .07 * jump), .1, u), o: 1 - P(u, .8, 1, E.lin), blur: u * 4 })
    })
    s.rig.style.transform = `scale(${(1 + .035 * jump).toFixed(4)})`
    const pin = P(t, t0, t0 + .28, E.back), pout = P(t, T_IN - .05, T_IN + .08, E.in2)
    const gulp = bell(t, t0 + .3, t0 + .36, t0 + .56)
    put(pill, { y: MIDY, s: lerp(.6, 1, pin) * (1 + .08 * gulp) * lerp(1, 1.3, pout), o: Math.min(1, pin * 2) * (1 - pout) })
    pdot.style.opacity = (.35 + .65 * (.5 + .5 * Math.cos((t - t0) * Math.PI * 2 / 1.6))).toFixed(3)
    // the invoice opens out of the chip and is read, a field a sixteenth
    const iin = P(t, T_IN - .05, T_IN + .18, E.out), go = P(t, T_FILE, T_FILE + .32, E.in2)
    put(inv, { x: lerp(0, FP[0][0], go), y: lerp(MIDY, FP[0][1], go), s: IK * lerp(.4, 1, iin) * lerp(1, .12, go), o: Math.min(1, iin * 2) * (1 - P(go, .8, 1, E.lin)), blur: (1 - iin) * 8 })
    hls.forEach((e, i) => { const a = P(t, T_HL[i] - .02, T_HL[i] + .1, E.out); e.style.opacity = a.toFixed(3); e.style.transform = `scale(${lerp(.7, 1, P(t, T_HL[i] - .02, T_HL[i] + .16, E.back)).toFixed(3)})` })
    // checked: the stamp slams down on the beat
    const sm = P(t, T_STAMP - .09, T_STAMP, E.in2), sb = bell(t, T_STAMP, T_STAMP + .03, T_STAMP + .2)
    put(stamp, { y: 24, r: -6, s: lerp(2.2, 1, sm) * (1 - .04 * sb), o: sm > 0 ? Math.min(1, sm * 3) : 0 })
    // filed: the folders, and the rest of the pile into them
    const got = [0, 0, 0]
    minis.forEach(m => {
      const u = P(t, m.a, m.a + .34, E.io), [fx, fy] = FP[m.f]
      put(m.e, { x: lerp(m.x0, fx, u), y: lerp(m.y0, fy - 20, u) - 120 * Math.sin(Math.PI * u), r: lerp(m.rot, 0, u), s: lerp(1.2, .5, u), o: t >= m.a && u < 1 ? 1 : 0 })
      if (u >= 1) got[m.f]++
    })
    fl.forEach((e, i) => {
      const td = T_DONE + i * .05
      blurIn(e, t, T_FILE - .04 + i * .05, { x: FP[i][0], y: FP[i][1], s: FK * (1 + .05 * bell(t, td, td + .04, td + .25)), dur: .3, s0: .9, blur: 12, dy: 40 })
      fn[i].textContent = Math.round(FOLDERS[i][1] * Math.min(1, (got[i] + (t >= T_FILE + .3 && i === 0 ? 1 : 0)) / 6))
      const c = P(t, td, td + .25, E.back); fok[i].style.transform = `scale(${c.toFixed(3)})`; fok[i].style.opacity = c > 0 ? 1 : 0
    })
    // the clock: nine o'clock, then two minutes past, in ice
    const tk = P(t, T_DONE - .12, T_DONE + .05, E.io)
    clk.set('MON', 540 + 2 * tk); clk.classList.toggle('ice', t >= T_DONE - .02)
    blurIn(row, t, t0 + .04, { y: TOPY, dur: .3, s0: 1, blur: 10, dy: -14, s: 1 + .08 * bell(t, T_DONE - .03, T_DONE + .05, T_DONE + .4) })
    shield(row, .7)
    // the words, one a clap
    capAt(capM, t, t0 + .03, T_IN)
    // the line stays centred on the words showing so far
    if (!WW) { const sp = capR.offsetWidth - ws.reduce((a, e) => a + e.offsetWidth, 0); WW = ws.map(e => e.offsetWidth + sp / 2) }
    let hid = 0
    ;[T_IN, T_STAMP, T_FILE].forEach((a, i) => { rise(ws[i], t, a - .03, { dur: .22, dy: 30, blur: 12 }); hid += (1 - E.io(P(t, a - .03, a + .19, E.lin))) * WW[i] })
    put(capR, { x: hid / 2, y: CAPY, o: 1 - P(t, T_DONE - .1, T_DONE + .02) })
    if (t > T_IN && t < T_DONE) shield(capR)
    capAt(capD, t, T_DONE, null)
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1.04], [T_FILE, 0, 0, 0, 0, 0, 0, 1], [T_DONE, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 0, 0, 0, 0, 0, 1.05]]), t)
    lens(s, {})
  }
}

/* ============================================================
   END: the name, drawn on the new phrase; Document AI; the line; the address
   ============================================================ */
function buildEnd(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const WMW = M({ land: 760, def: 640 }), MK = WMW / 273
  const wm = h('div', 'd-mark', s.cam, WORDMARK()); wm.firstChild.setAttribute('width', WMW); wm.firstChild.setAttribute('height', 100 * MK)
  const n = wm.querySelector('[data-k="n"]'), dot = wm.querySelector('[data-k="dot"]')
  dot.style.filter = 'drop-shadow(0 0 6px rgba(233,172,87,.5))'
  const abl = ['ab', 'as', 'bs', 'bb', 'l'].map(k => wm.querySelector(`[data-k="${k}"]`))
  const eb = h('div', 'd-eyebrow', s.cam, '<i></i><span>Document AI</span>')
  const tg = h('div', 'd-tag2', s.cam, `Paperwork, read and filed${STOP}`)
  const url = h('div', 'd-url', s.cam, 'nabl.agency')
  const yM = M({ land: -60, def: -70 })
  const top = yM + (6 - 50) * MK, base = yM + (82 - 50) * MK
  const tN = t0, tDot = t0 + .2, tAbl = bt(22.5), tEb = bt(23), tTg = bt(24), tUrl = bt(25)
  cue('draw', tN, { d: .3 })
  cue('pop', tDot, { v: .45 })
  cue('draw', tAbl, { d: .45 })
  cue('pop', tEb, { v: .3 })
  cue('shimmer', tTg, { d: 1.8, v: .28 })
  const dash = (e, d) => { e.style.opacity = d > 0 ? 1 : 0; e.style.strokeDasharray = d < 1 ? '1 2' : ''; e.style.strokeDashoffset = d < 1 ? (1 - d).toFixed(4) : '' }
  return t => {
    dash(n, P(t, tN - .02, tN + .24, E.out))
    abl.forEach((e, i) => dash(e, P(t, tAbl + i * .06 - .02, tAbl + i * .06 + .32, E.out)))
    const dp = P(t, tDot - .02, tDot + .26, E.back), pulse = bell(t, bt(25), bt(25) + .04, bt(25) + .4) + bell(t, bt(27), bt(27) + .04, bt(27) + .4)
    dot.style.transformOrigin = '84.5px 75.5px'; dot.style.transform = `scale(${(dp * (1 + .15 * pulse)).toFixed(3)})`; dot.style.opacity = dp > 0 ? 1 : 0
    put(wm, { y: yM, s: 1 + .025 * bell(t, tN, tN + .04, tN + .3) })
    blurIn(eb, t, tEb - .03, { y: top - M({ land: 80, def: 74 }), dur: .3, s0: 1, blur: 10, dy: 14 })
    blurIn(tg, t, tTg - .03, { y: base + M({ land: 118, def: 108 }), dur: .34, s0: 1, blur: 14, dy: 18 })
    blurIn(url, t, tUrl - .03, { y: base + M({ land: 212, def: 196 }), dur: .3, s0: 1, blur: 10, dy: 12 })
    shield(wm, 1); shield(tg); shield(eb, .8)
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 0, 0, 0, 0, 0, 1.04]]), t)
    lens(s, { o: 1 - P(t, t1 - .4, t1, E.in2) })
  }
}

/* ============================================================
   THE GROUND: the brand's lit ground, its state on the timeline.
   Rendered after the scenes in each frame, so it knows where their words are
   ============================================================ */
const CALM = { drift: .22, shd: 1, vig: 0, tone: .45, hp: .3, sat: 1, heat: .3 }
const st = (o, rows) => mk(Object.assign({}, CALM, o), rows)
const boost = (rows, ember, amber = 1, ice = 1) => rows.map((r, i) => [r[0], r[1], r[2], r[3] * (i < 3 ? ember : i < 5 ? amber : ice)])
const G = {
  open: st({ heat: .35, k: .8, pace: 3 }, boost(L.heat1, 1, 1, .5)),
  heat: st({ heat: .5, k: 1, pace: 4 }, boost(L.heat2, 1.25, 1, .4)),
  quiet: st({ heat: .3, k: .4, pace: 1.5 }, boost(L.heat2, 1, 1, .3)),
  peak: st({ heat: .6, k: 1.1, pace: 5 }, boost(L.heat2, 1.5, 1, .25)),
  dark: st({ heat: .4, k: .25, pace: 3 }, L.hero),
  glassIn: st({ heat: .45, f: .6, fw: 6, k: .5, pace: 3 }, L.hero),
  fix1: st({ heat: .35, f: 1, fw: 26, k: 1, pace: 2.5 }, L.fix1),
  fix2: st({ heat: .3, f: 1, fw: 26, k: 1, pace: 2.5 }, L.fix2),
  fix3: st({ heat: .3, f: 1, fw: 46, k: 1, pace: 2.5 }, L.fix3),
  done: st({ heat: .25, f: 1, fw: 46, k: .95, pace: 2 }, boost(L.fix3, .6, 1, 1.25)),
  rise: st({ tau: .84, spread: .6, f: .06, fw: 150, g: .3, a: 1, cy: .78, k: .8, pace: 2 }, dim(L.step2, .5)),
  settle: st({ tau: .9, spread: .55, f: 0, fw: 150, g: .25, a: 1, cy: .82, k: .72, pace: 1.6 }, dim(L.step2, .4)),
}
function buildGround(s) {
  const at = id => TL.scenes.find(x => x.id === id).start
  const KF = [
    [0, G.open], [bt(2), G.open], [at('type') - .02, G.heat], [at('type'), G.quiet], [at('week') - .02, G.quiet], [at('week'), G.heat], [bt(10), G.peak], [at('flash') - .02, G.peak],
    [at('flash'), G.dark], [HITS[1] - .01, G.dark], [HITS[1] + .2, G.glassIn], [at('fix') - .02, G.glassIn],
    [at('fix') + .3, G.fix1], [T_STAMP, G.fix2], [T_FILE, G.fix3], [T_DONE - .1, G.fix3], [T_DONE + .3, G.done], [at('end') - .02, G.done],
    [at('end') + .5, G.rise], [TL.duration, G.settle],
  ]
  const sample = t => {
    if (t <= KF[0][0]) return KF[0][1]
    for (let j = 1; j < KF.length; j++) if (t <= KF[j][0]) { let u = (t - KF[j - 1][0]) / (KF[j][0] - KF[j - 1][0]); u = u * u * (3 - 2 * u); return mix(KF[j - 1][1], KF[j][1], u) }
    return KF[KF.length - 1][1]
  }
  // the demo's phases, accumulated on the film's clock (TG: the wisps; TA: the aurora; wtime: the glows' wander)
  const DT = 1 / 120, NS = Math.ceil(TL.duration / DT) + 2, PH = new Float32Array(NS * 3)
  let tg = .3, ta = .25, wt = 0
  for (let i = 0; i < NS; i++) { PH[i * 3] = tg; PH[i * 3 + 1] = ta; PH[i * 3 + 2] = wt; const v = sample(i * DT); tg += DT * (.03 + .06 * v.heat) * v.pace; ta += DT * .04 * v.pace; wt += DT * v.pace }
  const phase = (t, k) => { const x = Math.max(0, t / DT), i = Math.min(NS - 2, Math.floor(x)), f = x - i; return PH[i * 3 + k] * (1 - f) + PH[(i + 1) * 3 + k] * f }
  // the light answers the track: it lifts on each pluck and burst, flares on the three build hits,
  // and after the drop the reeds and the aurora breathe on every kick
  const PLUCKS = [0, .5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 7.5, 8, 8.5, 9, 10, 10.5, 11, 11.5, 12].map(bt)
  const KICKS = Array.from({ length: 16 }, (_, i) => bt(14 + i))
  const cv = h('div', 'layer', groundLayer)
  const draw = ground(cv, W, H)
  h('div', 'd-grain', groundLayer)
  return t => {
    const v = Object.assign({}, sample(t))
    let lift = 0; for (const p of PLUCKS) if (t >= p - .01 && t < p + .6) lift += Math.exp(-(t - p) / .16)
    let flare = 0; for (const p of HITS) if (t >= p) flare += Math.exp(-(t - p) / .09)
    let kick = 0; for (const p of KICKS) if (t >= p - .01 && t < p + .5) kick += Math.exp(-(t - p) / .12)
    v.k *= (1 + .16 * Math.min(1.2, lift)) * (1 + 2.4 * Math.min(1, flare)) * (1 + .1 * kick) * P(t, 0, .5, E.out)
    if (flare > .02) v.heat += .3 * flare
    draw(v, { T: 6 + t, TG: phase(t, 0), TA: phase(t, 1), wtime: phase(t, 2), V: Math.min(1, .5 * kick + .6 * flare) }, SH.slice(0, 3))
    SH.length = 0
  }
}

export default function setup() {
  document.querySelector('.vignette').style.display = 'none'      // the lit ground keeps its own dark
  scene(['pile'], buildPile)
  scene(['type'], buildType)
  scene(['week'], buildWeek)
  scene(['flash'], buildFlash)
  scene(['fix'], buildFix)
  scene(['end'], buildEnd)
  scene(['pile', 'end'], buildGround, { hold: 1 })                   // last, so the words have been placed
  const ground = [[0, .5, .5, 0, .5, .5, 0, 0], [TL.duration, .5, .5, 0, .5, .5, 0, 0]]
  return { ground, bug: ['end', 'end'] }
}
