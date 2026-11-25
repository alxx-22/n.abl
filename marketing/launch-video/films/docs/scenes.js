/* ============================================================
   THE DOCS REEL: n.abl's Document AI, in 16 seconds

   Problem, then answer, and every move on a hit of the track. In the site's
   brand: espresso, cream, the amber of the square full stop; paper is the
   one light thing in it.

   pile   Monday, 9am. The paperwork lands on every pluck: one invoice,
          two, three, then by the dozen, by the hundred, piling up the frame
   type   the track's silence: one supplier's name typed in by hand, a key
          at a time. Invoice 1 of 500
   week   the plucks again: the calendar flips Tuesday to Friday, the count
          barely moves; a whole week, gone
   flash  the three build hits: n.abl Document AI, flashed in and out
   fix    the drop: Monday, 9am again. The pile goes into Document AI;
          read, checked, filed, one word a clap; done by 9:02
   end    the name, Document AI, Paperwork, read and filed., the address
   The script is films/docs/film.py; the brief is films/docs/SCRIPT.md.
   ============================================================ */

import { E, M, P, TL, W, H, WORDMARK, bell, cue, h, icon, lerp, put, rise, rng, scene, vis } from '../../film/stage.js'
import { blurIn, lens, path, shoot, widen } from '../../film/kit.js'

const B = TL.beat, OFF = 0.304
const bt = k => OFF + k * B                               // the track's own beat k (its first is 0.304 s in)
const CHECK = (s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const STOP = '<span class="d-stop"></span>'
const SPARK = s => `<svg width="${s}" height="${s}" viewBox="-10 -10 20 20"><path d="M0 -10 C1 -2.5 2.5 -1 10 0 C2.5 1 1 2.5 0 10 C-1 2.5 -2.5 1 -10 0 C-2.5 -1 -1 -2.5 0 -10 Z" fill="#E9AC57"/></svg>`

/* where things sit, per frame */
const TOPY = M({ land: -432, sq: -436, tall: -552, port: -776 })      // the clock
const CAPY = M({ land: -292, sq: -278, tall: -380, port: -560 })      // the caption
const MIDY = M({ land: 112, sq: 118, tall: 130, port: 110 })          // what it is about
const CAP = M({ land: 112, sq: 88, tall: 92, port: 96 }), CAPW = M({ land: 1720, def: 960 })

/* a caption: big cream type, centred, wrapping in the narrow frames */
function cap(parent, html, size = CAP) {
  const e = h('div', 'd-cap', parent, html)
  Object.assign(e.style, { fontSize: size + 'px', width: 'max-content', maxWidth: CAPW + 'px' })
  return e
}
/* in on a hit (fast, so it lands with it), out on another */
function capAt(e, t, a, b, { y = CAPY, x = 0, dy = 36 } = {}) {
  const pi = P(t, a - .03, a + .2, E.out), po = b == null ? 0 : P(t, b - .1, b + .02, E.in2)
  put(e, { x, y: y + (1 - pi) * dy - po * 24, s: lerp(.94, 1, pi) * lerp(1, 1.03, po), o: pi * (1 - po), blur: (1 - pi) * 14 + po * 14 })
}
/* the clock: a face and a day and time; set(day, minutes after midnight) */
function clock(parent) {
  const e = h('div', 'd-clock', parent, '<span class="face"><i class="h"></i><i class="m"></i></span><span class="day">MON</span><span class="tm">09:00</span>')
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
   the rest heap up from the bottom, wider and higher as it grows */
const N = 46
const HEAP = (() => {
  const r = rng(11), out = []
  const first = [[0, 140, -4, 1.28], [46, 118, 6, 1.28], [-38, 100, -9, 1.28]]
  for (let i = 0; i < N; i++) {
    if (i < 3) { const [x, y, rot, s] = first[i]; out.push({ x, y, r: rot, s }); continue }
    const f = (i - 3) / (N - 4)
    const top = H / 2 - 70 - Math.pow(f, .85) * H * .6
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
    sheets.push({ e, p, tl: land[k], x0: p.x * .6 + (r() - .5) * 500, y0: -H / 2 - 260 - r() * 260, r0: p.r + (r() - .5) * 110, fall: k < 3 ? .3 : .24 + r() * .06 })
  }
  const row = h('div', 'd-row', s.cam), clk = clock(row)
  const cnt = h('div', 'd-count', row, '<b>1</b> <span>document</span>'), cn = cnt.querySelector('b'), cw = cnt.querySelector('span')
  const capA = cap(s.cam, `Monday, 9am${STOP}`), capB = cap(s.cam, `Here comes the paperwork${STOP}`)
  BURSTS.forEach(([b, n]) => { for (let j = 0; j < Math.min(3, n); j++) cue('paper', bt(b) + j * .03, { v: Math.min(.85, .45 + n * .03), pan: (j - 1) * .5 }) })
  return t => {
    // each sheet falls in and lands on its pluck, with a little settle
    sheets.forEach(d => {
      const ts = d.tl - d.fall, u = P(t, ts, d.tl, E.in2), st = bell(t, d.tl, d.tl + .03, d.tl + .2)
      put(d.e, { x: lerp(d.x0, d.p.x, u), y: lerp(d.y0, d.p.y, u), r: lerp(d.r0, d.p.r, P(t, ts, d.tl, E.out)), s: d.p.s * (1 + .05 * st), o: t >= ts ? 1 : 0 })
    })
    // the count jumps with each burst
    let n = 0, k = -1; BURSTS.forEach(([b, , c], j) => { if (t >= bt(b) - .02) { n = c; k = j } })
    cn.textContent = n; cw.textContent = n === 1 ? 'document' : 'documents'
    const kb = k < 0 ? 0 : bell(t, bt(BURSTS[k][0]) - .02, bt(BURSTS[k][0]) + .03, bt(BURSTS[k][0]) + .25)
    cnt.style.transform = `scale(${(1 + .12 * kb).toFixed(3)})`; cnt.style.opacity = n ? 1 : 0
    blurIn(row, t, t0 + .02, { y: TOPY, dur: .3, s0: 1, blur: 10, dy: -14 })
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
  const form = h('div', 'd-form', s.cam, `<div class="hd"><span>INVOICE <b>1</b> OF 500</span><span>BY HAND</span></div>
    <div class="lb">Supplier name</div><div class="in"><span class="tx"></span><span class="caret"></span></div>
    <div class="gh"><div></div><div></div></div>`)
  const tx = form.querySelector('.tx'), caret = form.querySelector('.caret')
  const capA = cap(s.cam, `<span class="w">Typed in.</span> <span class="w">By hand${STOP}</span>`)
  const [wa, wb] = capA.querySelectorAll('.w')
  KEYS.forEach(k => cue('key', k, { v: 2.4 }))
  return t => {
    let n = 0; KEYS.forEach(k => { if (t >= k) n++ })
    tx.textContent = n ? TXT[n - 1] : ''
    const since = n ? t - KEYS[n - 1] : t - t0
    caret.style.opacity = since < .12 || (since % .5) < .28 ? 1 : 0
    put(form, { y: MIDY + 10, s: M({ land: 1.06, def: 1 }) })
    put(capA, { y: CAPY })
    rise(wa, t, t0 + .01, { dur: .22, dy: 26, blur: 12 })
    rise(wb, t, KEYS[2] - .02, { dur: .22, dy: 26, blur: 12 })
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
  const pages = DAYS.map((d, i) => { const p = h('div', 'pg', cal, `<div class="bar">THIS WEEK<i></i></div><div class="dn">${d}</div>`); p.style.zIndex = 10 - i; return p })
  const prog = h('div', 'd-prog', s.cam, '<div class="tx"><span>Typed in</span><span><b>6</b> of 500</span></div><div class="tr"><i></i></div>')
  const pn = prog.querySelector('b'), bar = prog.querySelector('.tr i')
  const capA = cap(s.cam, `<span class="w">A whole week,</span> <span class="w">gone${STOP}</span>`, M({ land: 132, def: 104 }))
  const [wa, wb] = capA.querySelectorAll('.w')
  const CY = M({ land: -40, sq: -60, tall: -70, port: -90 }), CK = M({ land: .92, sq: .9, tall: 1, port: 1.12 })
  const PY = CY + 260 * CK + 60, PY2 = M({ land: 150, def: 170 })
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
    pn.style.color = kb > .05 ? '#F2C57E' : ''
    put(capA, { y: M({ land: -50, def: -60 }), s: 1 + .03 * P(t, bt(12) - .02, s.t1, E.out) })
    rise(wa, t, bt(10) - .02, { dur: .26, dy: 40, blur: 16 })
    rise(wb, t, bt(11) - .02, { dur: .26, dy: 40, blur: 16, s0: 1.2 })
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1.02], [bt(10), 0, 0, 0, 0, 0, 0, 1], [s.t1, 0, 0, 0, 0, 0, 0, 1.05]]), t)
    lens(s, {})
  }
}

/* ============================================================
   FLASH: the three build hits, n.abl Document AI on each
   ============================================================ */
function lockup(parent, ink) {
  const e = h('div', 'd-lock', parent, `${WORDMARK()}<div class="ai">DOCUMENT AI</div>`)
  const svg = e.querySelector('svg'); svg.setAttribute('width', M({ land: 760, def: 640 })); svg.setAttribute('height', M({ land: 760, def: 640 }) * 100 / 273)
  svg.querySelector('g').setAttribute('stroke', ink ? '#14110E' : '#FBF6EC')
  svg.querySelector('[data-k="dot"]').setAttribute('fill', ink ? '#B87718' : '#E9AC57')
  e.querySelector('.ai').style.color = ink ? '#14110E' : '#F2C57E'
  if (!ink) svg.style.filter = 'drop-shadow(0 0 40px rgba(233,172,87,.35))'
  return e
}
function buildFlash(s) {
  widen(s)
  const HITS = [s.t0, bt(13) - .01, bt(13.5) - .01], SC = [1, 1.28, 1.62]
  const flood = h('div', 'd-flood', s.root); s.root.insertBefore(flood, s.rig)
  const ink = lockup(s.cam, true), cr = lockup(s.cam, false)
  return t => {
    let k = 0; HITS.forEach((a, i) => { if (t >= a) k = i })
    const dt = t - HITS[k], f = Math.exp(-dt / .075), l = Math.exp(-dt / .13)
    const light = k !== 1
    vis(flood, light ? f : 0)
    put(ink, { s: SC[k] * (1 + .05 * dt / .27), o: light ? l : 0, blur: dt > .12 ? (dt - .12) * 30 : 0 })
    put(cr, { s: SC[k] * (1 + .05 * dt / .27), o: light ? 0 : l, blur: dt > .12 ? (dt - .12) * 30 : 0 })
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
const FOLDER = '<svg viewBox="0 0 64 52"><path d="M2 8a6 6 0 016-6h14l6 7h28a6 6 0 016 6v29a6 6 0 01-6 6H8a6 6 0 01-6-6z" fill="rgba(233,172,87,.16)" stroke="#E9AC57" stroke-width="2.5"/></svg>'
const FOLDERS = [['Accounts', 312], ['Deliveries', 141], ['People', 47]]
function buildFix(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const r = rng(23)
  const flood = h('div', 'd-flood', s.root); s.root.insertBefore(flood, s.rig)
  // the pile, from the first shot, goes into Document AI on the drop
  const pile = HEAP.slice(N - 30).map((p, j) => ({ e: sheet(s.cam, N - 30 + j), p, d: .012 * j + r() * .05 }))
  const pill = h('div', 'd-pill', s.cam, '<span class="sq"></span><span>Reading <span class="n">500</span> documents</span><span class="sp"></span>')
  const spin = pill.querySelector('.sp')
  const inv = h('div', 'd-inv', s.cam, INV)
  const hls = ['sup', 'no', 'tot'].map(k => inv.querySelector(`.f[data-k="${k}"] .hl`))
  const stamp = h('div', 'd-stampx', inv, `<span class="ck">${CHECK(26)}</span>Matched to order`)
  stamp.style.fontSize = '28px'
  const fl = FOLDERS.map(([nm]) => h('div', 'd-folder', s.cam, `<div class="ic">${FOLDER}</div><div class="nm">${nm}</div><div class="ct"><span class="n">0</span><span class="ok">${CHECK(20)}</span></div>`))
  const fn = fl.map(e => e.querySelector('.n')), fok = fl.map(e => e.querySelector('.ok'))
  const FK = M({ land: 1, sq: .82, tall: .84, port: 1.04 })
  const FP = M({ land: [[-420, 0], [0, 0], [420, 0]], sq: [[-330, 0], [0, 0], [330, 0]], tall: [[-330, 0], [0, 0], [330, 0]], port: [[0, -290], [0, 0], [0, 290]] }).map(([x, y]) => [x, MIDY + y + M({ land: 20, def: 30 })])
  const minis = Array.from({ length: 18 }, (_, j) => ({ e: h('div', 'd-mini', s.cam), f: j % 3, a: bt(17.25) + j * B / 8, x0: (r() < .5 ? -1 : 1) * (W / 2 + 80), y0: (r() - .5) * H * .8, rot: (r() - .5) * 60 }))
  const row = h('div', 'd-row', s.cam), clk = clock(row)
  const capM = cap(s.cam, `Monday, 9am${STOP}`)
  const capR = cap(s.cam, '<span class="w">Read.</span> <span class="w">Checked.</span> <span class="w">Filed.</span>')
  const ws = capR.querySelectorAll('.w')
  const capD = cap(s.cam, `Done by 9:02${STOP}`)
  const IK = M({ land: 1, sq: .9, tall: .96, port: 1.16 })
  const tIn = bt(15), tHl = [bt(15.25), bt(15.5), bt(15.75)], tStamp = bt(16), tFile = bt(17), tDone = bt(19)
  cue('whoosh', t0 + .3, { d: .55, v: .55 })
  cue('pop', t0 + .42, { v: .5 })
  cue('pop', tIn, { v: .45 })
  tHl.forEach(a => cue('blip', a, { v: .55 }))
  cue('stamp', tStamp, { v: 1 })
  cue('swish', tFile + .05, { v: .4 })
  minis.forEach((m, j) => { if (j % 2 === 0) cue('tick', m.a + .32, { v: .28 }) })
  cue('confirm', tDone, { n: 2, deg: 3, v: .6 })
  return t => {
    vis(flood, Math.exp(-Math.max(0, t - t0) / .09) * .9)
    // the pile lifts and is pulled into the pill, the outermost last
    pile.forEach(q => {
      const u = P(t, t0 + q.d, t0 + q.d + .34, E.in2)
      put(q.e, { x: lerp(q.p.x, 0, u), y: lerp(q.p.y, MIDY, u), r: lerp(q.p.r, 0, u), s: lerp(q.p.s, .1, u), o: 1 - P(u, .8, 1, E.lin), blur: u * 4 })
    })
    const pin = P(t, t0, t0 + .28, E.back), pout = P(t, tIn - .05, tIn + .08, E.in2)
    const gulp = bell(t, t0 + .36, t0 + .42, t0 + .62)
    put(pill, { y: MIDY, s: lerp(.6, 1, pin) * (1 + .08 * gulp) * lerp(1, 1.3, pout), o: Math.min(1, pin * 2) * (1 - pout) })
    spin.style.transform = `rotate(${(t * 480).toFixed(1)}deg)`
    // the invoice opens out of the pill and is read, a field a sixteenth
    const iin = P(t, tIn - .05, tIn + .18, E.out), go = P(t, tFile, tFile + .32, E.in2)
    put(inv, { x: lerp(0, FP[0][0], go), y: lerp(MIDY, FP[0][1], go), s: IK * lerp(.4, 1, iin) * lerp(1, .12, go), o: Math.min(1, iin * 2) * (1 - P(go, .8, 1, E.lin)), blur: (1 - iin) * 8 })
    hls.forEach((e, i) => { const a = P(t, tHl[i] - .02, tHl[i] + .1, E.out); e.style.opacity = a.toFixed(3); e.style.transform = `scale(${lerp(.7, 1, P(t, tHl[i] - .02, tHl[i] + .16, E.back)).toFixed(3)})` })
    // checked: the stamp slams down on the beat
    const sm = P(t, tStamp - .09, tStamp, E.in2), sb = bell(t, tStamp, tStamp + .03, tStamp + .2)
    put(stamp, { y: 22, r: -7, s: lerp(2.2, 1, sm) * (1 - .04 * sb), o: sm > 0 ? Math.min(1, sm * 3) : 0 })
    // filed: the folders, and the rest of the pile into them
    let got = [0, 0, 0]
    minis.forEach(m => {
      const u = P(t, m.a, m.a + .34, E.io), [fx, fy] = FP[m.f]
      put(m.e, { x: lerp(m.x0, fx, u), y: lerp(m.y0, fy - 20, u) - 120 * Math.sin(Math.PI * u), r: lerp(m.rot, 0, u), s: lerp(1.2, .5, u), o: t >= m.a && u < 1 ? 1 : 0 })
      if (u >= 1) got[m.f]++
    })
    fl.forEach((e, i) => {
      blurIn(e, t, tFile - .04 + i * .05, { x: FP[i][0], y: FP[i][1], s: FK * (1 + .05 * bell(t, tDone + i * .05, tDone + i * .05 + .04, tDone + i * .05 + .25)), dur: .3, s0: .9, blur: 12, dy: 40 })
      fn[i].textContent = Math.round(FOLDERS[i][1] * Math.min(1, (got[i] + (t >= tFile + .3 && i === 0 ? 1 : 0)) / 6))
      const c = P(t, tDone + i * .05, tDone + i * .05 + .25, E.back); fok[i].style.transform = `scale(${c.toFixed(3)})`; fok[i].style.opacity = c > 0 ? 1 : 0
    })
    // the clock: nine o'clock, then two minutes past
    const tk = P(t, tDone - .12, tDone + .05, E.io)
    clk.set('MON', 540 + 2 * tk)
    const glow = bell(t, tDone - .05, tDone + .05, tDone + .6)
    clk.style.borderColor = glow > .01 ? `rgba(233,172,87,${(.2 + .7 * glow).toFixed(3)})` : ''
    blurIn(row, t, t0 + .04, { y: TOPY, dur: .3, s0: 1, blur: 10, dy: -14, s: 1 + .08 * bell(t, tDone - .03, tDone + .05, tDone + .4) })
    // the words, one a clap
    capAt(capM, t, t0 + .03, tIn)
    put(capR, { y: CAPY, o: 1 - P(t, tDone - .1, tDone + .02) })
    ;[tIn, tStamp, tFile].forEach((a, i) => rise(ws[i], t, a - .03, { dur: .22, dy: 30, blur: 12 }))
    capAt(capD, t, tDone, null)
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1.04], [tFile, 0, 0, 0, 0, 0, 0, 1], [tDone, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 0, 0, 0, 0, 0, 1.05]]), t)
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
  wm.firstChild.style.filter = 'drop-shadow(0 0 40px rgba(251,246,236,.08))'
  const n = wm.querySelector('[data-k="n"]'), dot = wm.querySelector('[data-k="dot"]')
  const abl = ['ab', 'as', 'bs', 'bb', 'l'].map(k => wm.querySelector(`[data-k="${k}"]`))
  const eb = h('div', 'd-eyebrow', s.cam, `${SPARK(22)}<span>Document AI</span>`)
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
    blurIn(eb, t, tEb - .03, { y: top - M({ land: 76, def: 70 }), dur: .3, s0: 1, blur: 10, dy: 14 })
    blurIn(tg, t, tTg - .03, { y: base + M({ land: 110, def: 100 }), dur: .34, s0: 1, blur: 14, dy: 18 })
    blurIn(url, t, tUrl - .03, { y: base + M({ land: 192, def: 180 }), dur: .3, s0: 1, blur: 10, dy: 12 })
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 0, 0, 0, 0, 0, 1.04]]), t)
    lens(s, { o: 1 - P(t, t1 - .4, t1, E.in2) })
  }
}

export default function setup() {
  scene(['pile'], buildPile)
  scene(['type'], buildType)
  scene(['week'], buildWeek)
  scene(['flash'], buildFlash)
  scene(['fix'], buildFix)
  scene(['end'], buildEnd)
  const at = id => TL.scenes.find(x => x.id === id).start
  // the ground: [t, amber x, y, o, cream x, y, o, grid]. Low and warm through the problem,
  // nothing under the flashes, amber behind the answer and the name
  const ground = [
    [0, .5, .3, .35, .5, .7, .5, 0],
    [at('type'), .5, .3, .35, .5, .7, .5, 0], [at('type') + .01, .5, .5, .12, .5, .5, .3, 0],
    [at('week') - .01, .5, .5, .12, .5, .5, .3, 0], [at('week'), .5, .4, .3, .5, .6, .45, 0],
    [at('flash') - .01, .5, .4, .3, .5, .6, .45, 0], [at('flash'), .5, .5, 0, .5, .5, 0, 0],
    [at('fix') - .01, .5, .5, 0, .5, .5, 0, 0], [at('fix'), .5, .5, .55, .5, .5, .35, .3],
    [at('end') - .01, .5, .5, .55, .5, .5, .35, .3], [at('end'), .5, .45, .7, .5, .55, .3, 0],
    [TL.duration, .5, .45, .7, .5, .55, .3, 0],
  ]
  return { ground, bug: ['end', 'end'] }
}
