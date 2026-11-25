/* ============================================================
   THE DOCS REEL: n.abl's Document AI, in 16 seconds

   A story up to the drop, then the answer, every move on a hit of the
   track. In the 2026-11 brand: Manjari, the lit ground (ground.js, the
   brand demo's own shader), and three lights that keep their meaning:
   ember for the problem, amber for n.abl, ice for the AI at work.

   box    a delivery arrives: the box drops on the first pluck, its
          paperwork taped to the front
   paper  the slip comes off and goes to the desk by the computer; closer
          on each pluck: scrawled, crossed out, a coffee ring on it
   squint the track's silence: Is that a 7? Or a 1? Typed, deleted, typed,
          deleted, a key at a time
   pile   onto the pile it goes, with all the others, tossed on with the
          plucks
   flash  the three build hits: n.abl Document AI, flashed in and out
   upload the drop: a cursor picks the pile up and drops it into Upload
          documents, on the clap
   sheet  one sheet, a row a document and a column a field, filling in one
          wave; then the rest stream past, done
   count  thousands of documents read and filed, counted up to the clap
   end    the aurora rises; the name, Document AI, Paperwork, read and
          filed., the address, held
   The script is films/docs/film.py; the brief is films/docs/SCRIPT.md.
   ============================================================ */

import { E, M, P, TL, W, H, LAND, WORDMARK, bell, cue, h, icon, lerp, offs, put, rise, rng, scene, stage, vis } from '../../film/stage.js'
import { ground as groundLayer } from '../../film/stage.js'
import { Z0, blurIn, drop, lens, path, shoot, widen } from '../../film/kit.js'
import { L, dim, ground, mix, mk } from './ground.js'

// Manjari, before anything is measured
await Promise.all(['100 100px Manjari', '400 40px Manjari', '700 40px Manjari'].map(f => document.fonts.load(f)))

const B = TL.beat, OFF = 0.304
const bt = k => OFF + k * B                               // the track's own beat k (its first is 0.304 s in)
const CHECK = (s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const STOP = '<span class="d-stop"></span>'

/* where things sit, per frame */
const TOPY = M({ land: -428, sq: -432, tall: -548, port: -772 })      // a chip above the caption
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
/* a line that arrives a piece at a time, on given hits, and stays centred on what has arrived */
function wordLine(parent, words, size) {
  const e = cap(parent, words.map(w => `<span class="w">${w}</span>`).join(' '), size)
  Object.assign(e.style, { maxWidth: 'none', whiteSpace: 'nowrap' })
  const ws = [...e.querySelectorAll('.w')]
  let WW = null
  e.at = (t, times, { y = 0, o = 1, x = 0, s = 1 } = {}) => {
    if (!WW) { const sp = e.offsetWidth - ws.reduce((a, w) => a + w.offsetWidth, 0); WW = ws.map(w => w.offsetWidth + sp / Math.max(1, ws.length - 1)) }
    let hid = 0
    times.forEach((a, i) => { rise(ws[i], t, a - .03, { dur: .2, dy: 28, blur: 12 }); hid += (1 - E.io(P(t, a - .03, a + .17, E.lin))) * WW[i] })
    put(e, { x: x + hid / 2, y, o, s })
    if (o > .3 && t > times[0]) shield(e)
  }
  return e
}
/* a chip for the problem: ember */
function chip(parent, html) { return h('div', 'd-chip', parent, `<span class="sq"></span><span>${html}</span>`) }

/* ---------- handwriting, drawn: no font, just a pen ---------- */
const INK = '#2A2420'
/* cursive scrawl: loops along a line, word by word, with the odd tall stroke */
function scrawl(w, hh, seed, { words = 3, sw = 1.7 } = {}) {
  const r = rng(seed), mid = hh * .62
  let d = '', x = 2
  const per = (w - 4) / words
  for (let k = 0; k < words; k++) {
    const len = per * (.55 + .35 * r()), n = Math.max(2, Math.round(len / 11)), T = Math.PI * 2 * n
    let first = true
    for (let tt = 0; tt <= T; tt += .32) {
      const tall = Math.sin(tt * .5 + k * 2.3 + seed) > .82 ? 1.9 : 1
      const a = hh * .3 * (.7 + .5 * Math.abs(Math.sin(tt * .37 + seed))) * tall
      let py = mid - a * (.5 - .5 * Math.cos(tt)), px = x + tt / T * len - 3.4 * Math.sin(tt)
      px += (mid - py) * .28
      d += (first ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1); first = false
    }
    x += len + per * .14 + r() * per * .1
  }
  return `<svg width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}" style="overflow:visible"><path d="${d}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}
/* digits by hand: the 7 that might be a 1 is the point */
const GL = {
  '£': [[[8, 3], [6, .5], [3.5, 2], [3.5, 13], [1, 15], [9, 15]], [[.5, 8], [6.5, 8]]],
  '?': [[[2.6, 3.8], [7.8, 1.6], [7.2, 3.2], [4.6, 15.2]]],
  '4': [[[6.5, 15], [6.5, 1], [.5, 10], [9, 10]]],
  '5': [[[8, 1], [2, 1.2], [1.6, 7], [6, 6], [8.6, 10], [6, 15], [1, 14]]],
  '0': [[[5, 1], [1.6, 4], [1, 11], [4.5, 15], [8, 12], [8.4, 5], [5, 1]]],
  '.': [[[4.4, 14.2], [5.2, 15]]],
}
function digits(str, k, seed) {
  const r = rng(seed); let d = '', x = 0
  for (const ch of str) {
    for (const ln of GL[ch]) ln.forEach(([gx, gy], i) => { d += (i ? 'L' : 'M') + ((x + gx + (r() - .5) * .9 - gy * .12) * k).toFixed(1) + ' ' + ((gy + (r() - .5) * .9) * k).toFixed(1) })
    x += ch === '.' ? 7 : 11
  }
  return `<svg width="${(x + 2) * k}" height="${17 * k}" style="overflow:visible"><path d="${d}" fill="none" stroke="${INK}" stroke-width="${(1.5 * k / 2.4).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}
/* the delivery note: printed labels, everything else by hand, crossed out, ringed with coffee */
function slip(parent) {
  return h('div', 'd-slip', parent, `
    <div class="hd"><b>DELIVERY NOTE</b><span>No. ${scrawl(70, 26, 3, { words: 1 })}</span></div>
    <div class="rw"><span>Supplier</span>${scrawl(190, 30, 7, { words: 2 })}</div>
    <div class="rw"><span>Date</span>${scrawl(110, 30, 11, { words: 2 })}</div>
    <div class="its"><span>Items</span>
      <div>${scrawl(170, 28, 13, { words: 3 })}${scrawl(34, 28, 17, { words: 1 })}</div>
      <div>${scrawl(150, 28, 19, { words: 2 })}${scrawl(30, 28, 23, { words: 1 })}</div>
      <div class="x">${scrawl(160, 28, 29, { words: 3 })}${scrawl(30, 28, 31, { words: 1 })}</div>
    </div>
    <div class="nt">${scrawl(230, 28, 37, { words: 4 })}${scrawl(160, 28, 41, { words: 3 })}</div>
    <div class="tot"><span>Total</span><span class="dg">${digits('£?4.50', 2.4, 5)}</span></div>
    <i class="ring"></i>`)
}
/* the computer: a monitor with an empty invoice form on it */
function monitor(parent) {
  return h('div', 'd-mon', parent, `<div class="scr d-glass"><div class="bar"><span class="sq"></span>New invoice</div>
    <div class="fs">${['Supplier', 'Invoice date', 'Invoice number', 'Order', 'Net', 'Total'].map(l => `<div class="fd"><div class="lb">${l}</div><div class="bx"></div></div>`).join('')}</div></div>
    <div class="neck"></div><div class="base"></div>`)
}
/* a sheet of paper for the pile */
const LW = [62, 44, 90, 84, 70, 92, 58, 80, 40, 66]
const KINDS = ['INVOICE', 'DELIVERY NOTE', 'INVOICE', 'RECEIPT', 'INVOICE', 'STATEMENT', 'DELIVERY NOTE', 'ORDER']
function sheet(parent, i) {
  const lines = LW.map((w, j) => `<i class="${j === 1 || j === 8 ? 'd' : ''}" style="width:${(w + (i * 7 + j * 13) % 17) % 100}%"></i>`).join('')
  return h('div', 'd-sheet ' + ['', 'b', 'c'][i % 3], parent, `<div class="h">${KINDS[i % KINDS.length]}</div>${lines}`)
}

/* the pile: where each sheet sits. Heaped up from the bottom, and short of the words */
const NP = 44
const YMIN = M({ land: 40, sq: 96, tall: -10, port: -190 })
const HEAP = (() => {
  const r = rng(11), out = []
  for (let i = 0; i < NP; i++) {
    const f = i / (NP - 1)
    const top = H / 2 - 70 - Math.pow(f, .85) * (H / 2 - 70 - YMIN)
    const spread = lerp(360, W / 2 + 40, Math.pow(f, .5))
    out.push({ x: (r() * 2 - 1) * spread, y: top + r() * 150, r: (r() - .5) * 56, s: .86 + r() * .34 })
  }
  return out
})()

/* ============================================================
   BOX: a delivery arrives, on the first pluck
   ============================================================ */
const BOX = `<svg width="640" height="520" viewBox="0 0 640 520">
  <defs><linearGradient id="bxf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A7052"/><stop offset="1" stop-color="#6B553D"/></linearGradient>
  <linearGradient id="bxt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A88A66"/><stop offset="1" stop-color="#957856"/></linearGradient>
  <linearGradient id="bxs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5C4833"/><stop offset="1" stop-color="#4A3A29"/></linearGradient></defs>
  <path d="M40 150 L120 70 L620 70 L540 150 Z" fill="url(#bxt)"/>
  <path d="M540 150 L620 70 L620 440 L540 520 Z" fill="url(#bxs)"/>
  <rect x="40" y="150" width="500" height="370" fill="url(#bxf)"/>
  <path d="M290 150 L370 70" stroke="#6E5638" stroke-width="2"/>
  <path d="M255 150 L335 70 L405 70 L325 150 Z" fill="rgba(240,231,216,.34)"/>
  <rect x="255" y="150" width="70" height="110" fill="rgba(240,231,216,.28)"/>
</svg>`
function buildBox(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1, tl = bt(0)
  const shadow = h('div', 'd-shadow', s.cam)
  const box = h('div', 'd-box', s.cam, BOX)
  const sl = slip(box); sl.classList.add('on')
  const dust = Array.from({ length: 14 }, (_, i) => ({ e: h('div', 'd-dust', s.cam), a: (i / 14) * Math.PI + Math.PI, v: 120 + (i * 37) % 160, sz: 8 + (i * 13) % 18 }))
  const capA = cap(s.hud, `A delivery arrives${STOP}`)
  const BY = M({ land: 150, sq: 170, tall: 190, port: 210 }) / Z0, BK = M({ land: 1, def: .9 })
  cue('whoosh', tl, { d: .32, v: .3 })
  cue('paper', tl, { v: 1 })
  cue('stamp', tl + .02, { v: .7 })
  ;[bt(.5), bt(1)].forEach(a => cue('tick', a, { v: .22 }))
  return t => {
    // it falls and lands on the beat, squashes, settles
    const u = P(t, tl - .3, tl, E.in2), sq = bell(t, tl, tl + .03, tl + .2)
    put(box, { y: lerp(-H / 2 - 600, BY, u), s: BK, o: 1 })
    box.firstChild.style.transform = `scale(${(1 + .04 * sq).toFixed(3)}, ${(1 - .06 * sq).toFixed(3)})`; box.firstChild.style.transformOrigin = '50% 100%'
    // the slip on its front lifts a little at each corner on the next two plucks
    const fl = bell(t, bt(.5), bt(.5) + .05, bt(.5) + .3) + bell(t, bt(1), bt(1) + .05, bt(1) + .3)
    sl.style.transform = `rotate(${(-4 + 2.5 * fl).toFixed(2)}deg) translateY(${(-6 * fl).toFixed(1)}px) scale(.7)`
    put(shadow, { y: BY + 250 * BK, s: BK * lerp(.4, 1, u), o: .7 * u })
    dust.forEach(d => {
      const p = P(t, tl, tl + .7, E.out)
      put(d.e, { x: Math.cos(d.a) * d.v * p * 2.4, y: BY + 250 * BK - 10 + Math.sin(d.a) * d.v * p * .5 - p * 30, s: d.sz / 10 * (1 + p), o: t >= tl ? .5 * (1 - p) : 0 })
    })
    capAt(capA, t, tl, null)
    // the camera eases in on the slip
    const sx = M({ land: -34, def: -30 }), sy = BY + 70 * BK
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [tl + .2, 0, 0, 0, 0, 0, 0, 1], [t1, sx * .5, sy * .4, 0, 0, 0, 0, 1.16]]), t)
    lens(s, {})
  }
}

/* ============================================================
   PAPER: off the box, to the computer; closer on each pluck
   ============================================================ */
function buildPaper(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const mon = monitor(s.cam), sl = slip(s.cam)
  const capA = cap(s.hud, `Now, to type it in${STOP}`), capB = cap(s.hud, `If you can read it${STOP}`)
  // where the monitor and the slip sit: side by side, or the slip below in the narrow frames
  const MX = LAND ? 330 : 0, MY = M({ land: 60, sq: -10, tall: -40, port: -150 }) / Z0, MK = M({ land: .92, sq: .78, tall: .82, port: .88 })
  const SX = LAND ? -470 : M({ sq: -250, tall: -250, port: -210 }), SY = M({ land: 90, sq: 250, tall: 300, port: 420 }) / Z0, SK = M({ land: 1.3, def: 1 })
  const tFly = bt(2), tLand = bt(3)
  // close on the scrawl: the whole slip, its items, its total
  const ZOOM = [[bt(3.5), 0, -40, 1.5], [bt(4), -10, 30, 2.1], [bt(5), 30, 150, 2.7]]
  cue('swish', tFly + .05, { v: .4 })
  cue('paper', tLand, { v: .7 })
  ZOOM.forEach(([a]) => cue('tick', a, { v: .3 }))
  return t => {
    // the slip comes off the box (from where the last shot left it) and lands by the computer
    const u = P(t, tFly - .02, tLand, E.io), arc = Math.sin(Math.PI * u)
    put(sl, { x: lerp(SX * .2, SX, u), y: lerp(SY + 300, SY, u) - 180 * arc, r: lerp(-4, -5, u) + 18 * arc, s: SK * lerp(.9, 1, u) * (1 + .03 * bell(t, tLand, tLand + .03, tLand + .2)), o: 1 })
    put(mon, { x: MX, y: MY + (1 - P(t, t0, t0 + .35, E.out)) * 40, s: MK, o: P(t, t0, t0 + .2) })
    capAt(capA, t, t0 + .01, ZOOM[0][0])
    capAt(capB, t, ZOOM[0][0], null)
    // the camera: wide on both, then a push on the slip at each pluck
    let cx = 0, cy = 0, cs = 1
    ZOOM.forEach(([a, dx, dy, k]) => { const p = P(t, a - .02, a + .22, E.out); cx = lerp(cx, SX + dx * SK, p); cy = lerp(cy, SY + dy * SK, p); cs = lerp(cs, k, p) })
    shoot(s, () => [cx, cy, 0, 0, 0, 0, cs], t)
    lens(s, {})
  }
}

/* ============================================================
   SQUINT: the silence. Is that a 7? Or a 1?
   ============================================================ */
function buildSquint(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const KEYS = [t0 + .12, t0 + .38, t0 + .62, t0 + .86], TXT = ['£7', '£', '£1', '£']
  const sl = slip(s.cam)
  const form = h('div', 'd-form d-glass', s.cam, `<div class="hd"><span>Invoice 1 of 43</span><span class="pr"><i></i>By hand</span></div>
    <div class="lb">Total</div><div class="in"><span class="tx">£</span><span class="caret"></span></div>`)
  const tx = form.querySelector('.tx'), caret = form.querySelector('.caret')
  const line = wordLine(s.hud, ['Is that a 7?', `Or a 1${STOP}`])
  cue('key', KEYS[0], { v: 2.4 }); cue('space', KEYS[1], { v: 1 }); cue('key', KEYS[2], { v: 2.4 }); cue('space', KEYS[3], { v: 1 })
  // the total, close: the slip big, its total in the middle of the frame
  const SX = LAND ? -330 : 0, SY = LAND ? 60 : M({ sq: -40, tall: -80, port: -160 }) / Z0, SK = M({ land: 2.6, def: 2.2 })
  const FX = LAND ? 470 : 0, FY = LAND ? 110 : M({ sq: 300, tall: 360, port: 470 }) / Z0, FK = M({ land: .82, def: .9 })
  return t => {
    let n = 0; KEYS.forEach(k => { if (t >= k) n++ })
    tx.textContent = n ? TXT[n - 1] : '£'
    const since = n ? t - KEYS[n - 1] : t - t0
    caret.style.opacity = since < .12 || (since % .5) < .28 ? 1 : 0
    // the slip, held close on its total, drifting a little
    put(sl, { x: SX - 30 * SK, y: SY - 150 * SK + (t - t0) * 10, r: -5, s: SK })
    put(form, { x: FX, y: FY, s: FK }); shield(form, .6)
    line.at(t, [KEYS[0], KEYS[2]], { y: CAPY })
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 0, 0, 0, 0, 0, 1.05]]), t)
    lens(s, {})
  }
}

/* ============================================================
   PILE: onto the pile it goes, with all the others
   ============================================================ */
// [beat, sheets tossed on]; the pile starts at 18 and the slip lands on it at beat 8
const TOSS = [[8.5, 3], [9, 3], [10, 4], [10.5, 3], [11, 4], [11.5, 3], [12, 4]]
const P0 = 18
function buildPile(s) {
  widen(s)
  const t0 = s.t0
  const r = rng(5)
  const land = []
  for (let k = 0; k < P0; k++) land.push(-1)
  const tSlip = bt(8)
  let k = P0
  TOSS.forEach(([b, n]) => { for (let j = 0; j < n; j++) land.push(bt(b) - .012 + j * .022) })
  const sheets = HEAP.slice(0, P0).map((p, i) => ({ e: sheet(s.cam, i), p, tl: -1 }))
  // the slip, on top of the first lot
  const sp = { x: 30, y: HEAP[P0 - 1].y + 30, r: -8, s: 1.1 }
  const sl = slip(s.cam)
  TOSS.forEach(([b, n]) => { for (let j = 0; j < n; j++, k++) { const p = HEAP[k], side = Math.sign(p.x || 1) * (r() < .8 ? 1 : -1); sheets.push({ e: sheet(s.cam, k), p, tl: land[k], x0: side * (W / 2 + 260 + r() * 200), y0: p.y + 140 + r() * 260, arc: 160 + r() * 180, r0: p.r - side * (60 + r() * 90), fall: .28 + r() * .06 }) } })
  const total = P0 + 1 + TOSS.reduce((a, [, n]) => a + n, 0)   // 43
  const ch = chip(s.hud, `<b>${P0}</b> to type in`), cb = ch.querySelector('b')
  const capA = cap(s.hud, `Onto the pile it goes${STOP}`), capB = cap(s.hud, `With all the others${STOP}`)
  cue('paper', tSlip, { v: .8 })
  TOSS.forEach(([b, n]) => { for (let j = 0; j < Math.min(2, n); j++) cue('paper', bt(b) + j * .03, { v: .5 + n * .04, pan: (j - .5) * .6 }) })
  return t => {
    sheets.forEach(d => {
      if (d.tl < 0) { put(d.e, { x: d.p.x, y: d.p.y, r: d.p.r, s: d.p.s }); return }
      const ts = d.tl - d.fall, u = P(t, ts, d.tl, E.lin), st = bell(t, d.tl, d.tl + .03, d.tl + .2)
      put(d.e, { x: lerp(d.x0, d.p.x, E.out2(u)), y: lerp(d.y0, d.p.y, u) - d.arc * Math.sin(Math.PI * u), r: lerp(d.r0, d.p.r, P(t, ts, d.tl, E.out)), s: d.p.s * (1 + .05 * st), o: t >= ts ? 1 : 0 })
    })
    // the slip drops on from above the frame, on its pluck
    const u = P(t, t0, tSlip, E.in2)
    put(sl, { x: lerp(0, sp.x, u), y: lerp(-H / 2 - 420, sp.y, u), r: lerp(10, sp.r, u), s: sp.s * (1 + .04 * bell(t, tSlip, tSlip + .03, tSlip + .2)) })
    let n = P0 + (t >= tSlip - .02 ? 1 : 0), kb = 0
    TOSS.forEach(([b, nn]) => { if (t >= bt(b) - .02) { n += nn; kb = bell(t, bt(b) - .02, bt(b) + .03, bt(b) + .25) } })
    cb.textContent = Math.min(total, n)
    blurIn(ch, t, t0 + .02, { y: TOPY, dur: .3, s0: 1, blur: 10, dy: -14, s: 1 + .1 * kb }); shield(ch, .7)
    capAt(capA, t, t0 + .02, bt(10))
    capAt(capB, t, bt(10), null)
    let jolt = 0; TOSS.forEach(([b, nn]) => { jolt += bell(t, bt(b) - .01, bt(b) + .02, bt(b) + .2) * Math.min(1, .3 + nn * .08) })
    s.rig.style.transform = `scale(${(1 + .015 * jolt).toFixed(4)})`
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1.08], [bt(10), 0, 0, 0, 0, 0, 0, 1.02], [s.t1, 0, 0, 0, 0, 0, 0, .96]]), t)
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
   UPLOAD: the drop. A cursor picks the pile up and drops it in
   ============================================================ */
const CURSOR = `<svg width="44" height="44" viewBox="0 0 40 40"><path d="M6 3 L6 31 L13.5 24 L18.5 35.5 L23.5 33.3 L18.6 22.2 L28.5 22.2 Z" fill="#FBF6EC" stroke="#0E0C0A" stroke-width="2.2" stroke-linejoin="round"/></svg>`
function cursor(parent) { const e = h('div', 'd-cur', parent, CURSOR); e.style.transformOrigin = '6px 3px'; return e }
function aim(e, x, y, o = 1, press = 0) { e.style.transform = `translate3d(${(x - 6).toFixed(1)}px,${(y - 3).toFixed(1)}px,0) scale(${(1 - .16 * press).toFixed(3)})`; vis(e, o) }
const UPLOAD = '<svg width="64" height="64" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21a6 6 0 01-.6-12A8 8 0 0123.6 11 5 5 0 0123 21"/><path d="M16 27V15M11.5 19.5L16 15l4.5 4.5"/></svg>'
const NDOC = 43
const T_GRAB = bt(14.25), T_DROP = bt(15)
function buildUpload(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const r = rng(9)
  // the pile, as the last shot left it, at the bottom; the drop zone above it
  const pile = HEAP.slice(0, NDOC).map((p, i) => ({ e: sheet(s.cam, i), p, d: r() * .06, j: [(r() - .5) * 30, (r() - .5) * 24, (r() - .5) * 14] }))
  const ZW = M({ land: 820, def: 760 }) / Z0, ZH = M({ land: 300, def: 280 }) / Z0
  const ZX = 0, ZY = M({ land: -300, sq: -320, tall: -430, port: -640 }) / Z0
  const zone = h('div', 'd-zone', s.cam, `<div class="ic">${UPLOAD}</div><div class="t">Upload documents</div><div class="s">PDFs, photos, scans</div>
    <div class="dn"><span class="dot"></span><span>Reading <b>${NDOC}</b> documents</span></div>`)
  Object.assign(zone.style, { width: ZW + 'px', height: ZH + 'px' })
  const zt = zone.querySelectorAll('.ic, .t, .s'), zd = zone.querySelector('.dn'), zdot = zone.querySelector('.dot')
  const cur = cursor(s.cam)
  // the stack, gathered up under the cursor
  const GX = 0, GY = M({ land: 230, sq: 250, tall: 300, port: 420 }) / Z0
  cue('whoosh', t0 + .02, { d: .4, v: .4 })
  cue('click', T_GRAB)
  cue('swish', T_GRAB + .1, { v: .4 })
  cue('pop', T_DROP, { v: .6 }); drop(T_DROP + .02, 3, { wet: .3, v: .5 })
  cue('confirm', T_DROP + .27, { n: 2, deg: 3, v: .45 })
  return t => {
    const jump = bell(t, t0 - .01, t0 + .05, t0 + .25)
    // picked up: the pile gathers to the cursor, then rides it into the zone and goes in
    const g = P(t, T_GRAB - .02, T_GRAB + .14, E.out), m = P(t, T_GRAB + .04, T_DROP, E.io), dn = P(t, T_DROP - .04, T_DROP + .14, E.in2)
    const cx = lerp(GX, ZX, m), cy = lerp(GY, ZY, m) - 120 * Math.sin(Math.PI * m)
    pile.forEach((q, i) => {
      const hx = lerp(q.p.x, cx + q.j[0], g), hy = lerp(q.p.y - 40 * jump, cy + q.j[1] + 20, g)
      put(q.e, { x: hx, y: hy, r: lerp(q.p.r, q.j[2], g), s: lerp(q.p.s * (1 + .05 * jump), .62, g) * lerp(1, .2, dn), o: 1 - P(dn, .6, 1, E.lin) })
    })
    // the zone lights as they go in, and starts reading
    const z = P(t, t0, t0 + .3, E.out), lit = bell(t, T_DROP, T_DROP + .06, T_DROP + .5), sw = P(t, T_DROP + .06, T_DROP + .3, E.out)
    put(zone, { x: ZX, y: ZY + (1 - z) * 30, s: (1 + .05 * lit) * (1 + .06 * bell(t, T_GRAB + .2, T_DROP - .05, T_DROP + .1)), o: z })
    zone.style.borderColor = lit > .02 || t > T_DROP ? `rgba(124,203,255,${(.5 + .5 * lit).toFixed(3)})` : ''
    zone.style.boxShadow = `0 0 ${(80 * lit).toFixed(0)}px rgba(124,203,255,${(.35 * lit).toFixed(3)}), 0 40px 90px rgba(0,0,0,.45)`
    zt.forEach(e => { e.style.opacity = (1 - sw).toFixed(3) })
    zd.style.opacity = sw.toFixed(3); zd.style.transform = `translateY(${((1 - sw) * 20).toFixed(1)}px)`
    zdot.style.opacity = (.35 + .65 * (.5 + .5 * Math.cos((t - T_DROP) * Math.PI * 2 / 1.6))).toFixed(3)
    // the cursor: in from the corner, a click on the pile, across, and off again
    const ci = P(t, t0 - .05, T_GRAB - .02, E.out), co = P(t, T_DROP + .1, T_DROP + .45, E.io)
    const from = [M({ land: 700, def: 420 }), GY + 320]
    aim(cur, lerp(from[0], cx + 20, ci) + co * 260, lerp(from[1], cy - 10, ci) + co * 220, (1 - co), bell(t, T_GRAB - .03, T_GRAB, T_GRAB + .12) * 1 + (t > T_GRAB && t < T_DROP ? .6 : 0))
    s.rig.style.transform = `scale(${(1 + .03 * jump).toFixed(4)})`
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1.03], [T_DROP, 0, 0, 0, 0, 0, 0, 1], [t1, 0, ZY * .3, 0, 0, 0, 0, 1.08]]), t)
    lens(s, {})
  }
}

/* ============================================================
   SHEET: a row a document, a column a field, filled in one wave
   ============================================================ */
const ROWS = [
  ['IMG_2291.jpg', 'Harbour Foods Ltd', '03/10/2026', 'INV-2291', 'GB 241 7735 08', '£452.25', '£90.45', '£542.70', 'Kitchen'],
  ['delivery note.pdf', 'Clearway Logistics', '03/10/2026', 'CL-88140', 'GB 318 2290 41', '£1,925.00', '£385.00', '£2,310.00', 'Ops'],
  ['scan_0012.pdf', 'Mill Lane Bakery', '04/10/2026', '7742', 'GB 102 4418 63', '£344.00', '£68.80', '£412.80', 'Kitchen'],
  ['photo 4.jpg', 'Northgate Supplies', '04/10/2026', 'NS-3307', 'GB 556 0193 27', '£210.40', '£42.08', '£252.48', 'Bar'],
  ['invoice (1).pdf', 'Parkside Print', '05/10/2026', 'PP-1190', 'GB 771 3302 19', '£80.00', '£16.00', '£96.00', 'Marketing'],
  ['IMG_2302.jpg', 'Quay Fish Co.', '05/10/2026', 'QF-5521', 'GB 290 8815 74', '£612.50', '£0.00', '£612.50', 'Kitchen'],
  ['statement.pdf', 'Riverside Dairy', '06/10/2026', 'RD-0934', 'GB 433 6627 05', '£188.20', '£0.00', '£188.20', 'Kitchen'],
  ['scan_0013.pdf', 'Oak & Ash Builders', '06/10/2026', 'OA-212', 'GB 845 1176 30', '£2,400.00', '£480.00', '£2,880.00', 'Premises'],
  ['note.jpg', 'Bright Spark Electrical', '07/10/2026', 'BS-7718', 'GB 190 5523 88', '£365.00', '£73.00', '£438.00', 'Premises'],
  ['Fenwick Linen.pdf', 'Fenwick Linen', '07/10/2026', 'FL-0456', 'GB 627 4401 92', '£142.00', '£28.40', '£170.40', 'Rooms'],
  ['IMG_2310.jpg', 'Harbour Foods Ltd', '08/10/2026', 'INV-2304', 'GB 241 7735 08', '£398.10', '£79.62', '£477.72', 'Kitchen'],
  ['scan_0014.pdf', 'Clearway Logistics', '08/10/2026', 'CL-88177', 'GB 318 2290 41', '£1,410.00', '£282.00', '£1,692.00', 'Ops'],
  ['receipt.jpg', 'Mill Lane Bakery', '09/10/2026', '7790', 'GB 102 4418 63', '£296.00', '£59.20', '£355.20', 'Kitchen'],
  ['order 88.pdf', 'Northgate Supplies', '09/10/2026', 'NS-3341', 'GB 556 0193 27', '£174.90', '£34.98', '£209.88', 'Bar'],
]
const HEAD = ['Document', 'Supplier', 'Date', 'Invoice no.', 'VAT number', 'Net', 'VAT', 'Total', 'Cost centre', 'Status']
const T_WAVE = bt(16.25), T_RUSH = bt(18)
function buildSheet(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  // the columns each frame has room for
  const COLS = LAND ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 1, 7, 9]
  const GRID = LAND ? '1.25fr 1.6fr 1fr .95fr 1.35fr .9fr .75fr .95fr .95fr .85fr' : '1.3fr 1.7fr 1fr .9fr'
  const NV = M({ land: 9, sq: 9, tall: 12, port: 15 })                      // rows in view
  const NR = 40                                                          // rows in all: the rest stream past, done
  const rows = Array.from({ length: NR }, (_, i) => ROWS[i % ROWS.length])
  const TW = M({ land: 1780, def: 1000 }) / Z0
  const tbl = h('div', 'd-tbl d-glass', s.cam, `<div class="hd"><span class="sq"></span><span class="t">Invoices</span><span class="cnt"><span class="n">0</span> of ${NDOC} filled</span></div>
    <div class="th" style="grid-template-columns:${GRID}">${COLS.map(c => `<span>${HEAD[c]}</span>`).join('')}</div>
    <div class="vp"><div class="sc">${rows.map(rw => `<div class="tr" style="grid-template-columns:${GRID}">${COLS.map(c => c === 9
      ? `<span class="c st"><i class="sk"></i><span class="v"><span class="ok">${CHECK(12)}</span>Filed</span></span>`
      : `<span class="c${c === 0 ? ' doc' : ''}">${c === 0 ? `<span class="v">${rw[0]}</span>` : `<i class="sk"></i><span class="v">${rw[c]}</span>`}</span>`).join('')}</div>`).join('')}</div></div>`)
  tbl.style.width = TW + 'px'
  const vp = tbl.querySelector('.vp'), sc = tbl.querySelector('.sc'), cn = tbl.querySelector('.cnt .n')
  const cells = [...tbl.querySelectorAll('.tr')].map(tr => [...tr.querySelectorAll('.c')].map(c => ({ sk: c.querySelector('.sk'), v: c.querySelector('.v') })))
  // the wave: a cell fills when the diagonal reaches it
  const at = (ri, ci) => ri < NV ? T_WAVE + ri * .045 + ci * .035 : -1
  const capA = cap(s.hud, `Every field. Every document${STOP}`)
  cue('scan', T_WAVE, { d: .8 })
  cue('type', T_WAVE, { d: .8, v: .3 })
  cue('confirm', bt(17.75), { n: 2, deg: 4, v: .45 })
  cue('whoosh', T_RUSH + .35, { d: .6, v: .45 })
  let RH = null
  return t => {
    if (!RH) { RH = sc.firstChild.offsetHeight; vp.style.height = (RH * NV) + 'px' }
    blurIn(tbl, t, t0 - .02, { y: M({ land: 120, sq: 130, tall: 140, port: 120 }) / Z0, dur: .3, s0: .96, blur: 12, dy: 30 })
    let filled = 0
    cells.forEach((row, ri) => row.forEach((c, ci) => {
      if (!c.sk) return
      const a = at(ri, ci), p = a < 0 ? 1 : P(t, a, a + .12, E.out)
      c.sk.style.opacity = (1 - p).toFixed(3); c.v.style.opacity = p.toFixed(3)
      c.v.style.color = a > 0 && t < a + .5 ? `rgba(169,220,255,${(1 - P(t, a + .15, a + .5)).toFixed(3)})` : ''
      if (ci === row.length - 1 && ri < NV && t >= a) filled++
    }))
    const extra = Math.round(P(t, T_RUSH, t1, E.in2) * (NDOC - NV))
    cn.textContent = Math.min(NDOC, filled + extra)
    // then the rest of the documents rush past, already done
    const rush = P(t, T_RUSH, t1 + .05, E.in2)
    sc.style.transform = `translateY(${(-rush * RH * (NR - NV)).toFixed(1)}px)`
    const sp = (P(t + 1 / 60, T_RUSH, t1 + .05, E.in2) - rush) * RH * (NR - NV)
    sc.style.filter = sp > 2 ? `blur(${Math.min(10, sp * .5).toFixed(1)}px)` : 'none'
    capAt(capA, t, t0 + .02, null)
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [T_RUSH, 0, 0, 0, 0, 0, 0, 1.03], [t1, 0, 0, 0, 0, 0, 0, 1.12]]), t)
    lens(s, { blur: 6 * P(t, t1 - .1, t1, E.in2) })
  }
}

/* ============================================================
   COUNT: thousands of documents, read and filed, counted to the clap
   ============================================================ */
const N_TOTAL = 12480
const fmtN = n => n.toLocaleString('en-GB')
function buildCount(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1, tEnd = bt(21)
  const big = h('div', 'd-big', s.cam, '0'); big.style.fontSize = M({ land: 320, def: 230 }) + 'px'
  const capN = h('div', 'd-cap2', s.cam, 'documents read and filed')
  const live = h('div', 'd-live', s.cam, '<span class="dot"></span>Reading')
  const ldot = live.querySelector('.dot')
  const KINDS = [['PDF', 'doc'], ['JPG', 'notes'], ['PNG', 'notes'], ['PDF', 'invoice'], ['XLSX', 'chart'], ['EML', 'inbox'], ['DOCX', 'doc'], ['HEIC', 'notes']]
  const r = rng(42)
  const SPREAD = M({ land: [880, 440], sq: [470, 470], tall: [470, 560], port: [450, 760] })
  const tiles = Array.from({ length: 18 }, (_, i) => {
    const [k, ic] = KINDS[i % KINDS.length]
    const e = h('div', 'd-tile d-glass', s.cam, `${icon(ic)}<b>${k}</b>`)
    let x = (r() * 2 - 1) * SPREAD[0], y = (r() * 2 - 1) * SPREAD[1]
    if (Math.abs(x) < 380 && Math.abs(y) < 190) x += Math.sign(x || 1) * 400
    return { e, x, y, z: -700 + r() * 900, rot: (r() - .5) * 24, ph: r() * 6, sp: .4 + r() * .6 }
  })
  cue('type', t0 + .05, { d: tEnd - t0 - .1, v: .26 })
  cue('confirm', tEnd, { n: 3, deg: 2, v: .55 })
  cue('whoosh', t1 - .05, { d: .4, v: .4 })
  return t => {
    const c = P(t, t0, tEnd, x => 1 - Math.pow(1 - x, 2.4))
    big.textContent = fmtN(Math.round(N_TOTAL * c))
    const bi = P(t, t0, t0 + .35, E.out), land = bell(t, tEnd, tEnd + .04, tEnd + .4)
    put(big, { y: -40, s: lerp(1.3, 1, bi) * (1 + .04 * land), blur: (1 - bi) * 24, o: Math.min(1, bi * 2) })
    shield(big, 1)
    blurIn(capN, t, t0 + .12, { y: M({ land: 150, def: 120 }), dur: .35, s0: 1, blur: 12, dy: 16 })
    blurIn(live, t, t0 + .05, { y: M({ land: -250, def: -200 }), dur: .3, s0: 1, blur: 10, dy: -12 })
    ldot.style.opacity = (.35 + .65 * (.5 + .5 * Math.cos((t - t0) * Math.PI * 2 / 1.2))).toFixed(3)
    live.lastChild.textContent = t >= tEnd ? 'Read and filed' : 'Reading'
    tiles.forEach(d => {
      const zz = d.z + (t - t0) * 260 * d.sp
      put(d.e, { x: d.x + Math.sin(t * .7 + d.ph) * 18, y: d.y - (t - t0) * 40 * d.sp, z: zz, r: d.rot + Math.sin(t + d.ph) * 4, o: P(t, t0, t0 + .3), blur: Math.min(14, Math.abs(zz) / 45) })
    })
    shoot(s, path([[t0, 0, 0, 60, 0, 0, 0, 1], [t1, 0, 0, 200, 0, 0, 0, 1.04]]), t)
    lens(s, { blur: 8 * P(t, t1 - .12, t1, E.in2) })
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
    [0, G.open], [bt(2), G.open], [at('squint') - .02, G.heat], [at('squint'), G.quiet], [at('pile') - .02, G.quiet], [at('pile'), G.heat], [bt(10), G.peak], [at('flash') - .02, G.peak],
    [at('flash'), G.dark], [HITS[1] - .01, G.dark], [HITS[1] + .2, G.glassIn], [at('upload') - .02, G.glassIn],
    [at('upload') + .3, G.fix1], [at('sheet'), G.fix2], [T_WAVE + .5, G.fix3], [at('count') - .05, G.fix3], [at('count') + .3, G.done], [at('end') - .02, G.done],
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
  scene(['box'], buildBox)
  scene(['paper'], buildPaper)
  scene(['squint'], buildSquint)
  scene(['pile'], buildPile)
  scene(['flash'], buildFlash)
  scene(['upload'], buildUpload)
  scene(['sheet'], buildSheet)
  scene(['count'], buildCount)
  scene(['end'], buildEnd)
  scene(['box', 'end'], buildGround, { hold: 1 })                   // last, so the words have been placed
  const ground = [[0, .5, .5, 0, .5, .5, 0, 0], [TL.duration, .5, .5, 0, .5, .5, 0, 0]]
  return { ground, bug: ['end', 'end'] }
}
