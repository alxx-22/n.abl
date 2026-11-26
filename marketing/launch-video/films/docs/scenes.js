/* ============================================================
   THE DOCS REEL: n.abl's Document AI, in 20 seconds

   A story, told slowly, then the answer, cut to 4 to 24 seconds of the
   supplied clip. The music sits inside the story rather than cutting it:
   things settle on plucks, lean in on the build, land on kicks and claps,
   type on the sixteenths. In the 2026-11 brand: Manjari, the lit ground
   (ground.js, the brand demo's own shader), and three lights that keep
   their meaning: ember for the problem, amber for n.abl, ice for the AI at
   work. No sound but whooshes, under the track.

   box    a delivery arrives: a cream box settles on a pluck; the camera
          leans in on the three build hits
   desk   on the drop its note goes to the computer, put down on the clap;
          someone has to type it all in, a letter a sixteenth
   pile   then onto the pile it goes, and more on top, a toss a beat
   flash  n.abl Document AI, flashed in and out on three hits, the last held
   upload a cursor picks the pile up on a clap and drops it into Upload
          documents on the next
   sheet  one sheet, a row a document and a column a field, filling in one
          wave from a clap; then the rest stream past, done
   count  thousands of documents read and filed, counted up to a kick
   end    the aurora rises; the name, Document AI, Paperwork, read and
          filed., the address, held into the breakdown
   The script is films/docs/film.py; the brief is films/docs/SCRIPT.md.
   ============================================================ */

import { E, M, P, TL, W, H, LAND, WORDMARK, bell, cue as stageCue, h, icon, lerp, offs, put, rise, rng, scene, stage, vis } from '../../film/stage.js'
import { ground as groundLayer } from '../../film/stage.js'
import { Z0, blurIn, lens, path, shoot, widen } from '../../film/kit.js'
import { L, dim, ground, mix, mk } from './ground.js'

// Manjari, before anything is measured
await Promise.all(['100 100px Manjari', '400 40px Manjari', '700 40px Manjari'].map(f => document.fonts.load(f)))

const B = TL.beat, OFF = 0.304 - 4
const bt = k => OFF + k * B                               // the supplied clip's beat k (its first is 0.304 s in; the film starts 4 s in)
const cue = (k, t, o) => { if (k === 'whoosh') stageCue(k, t, o) }   // no sound but whooshes
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

/* ---------- the delivery note: printed, plain, and still to be typed in ---------- */
function note(parent) {
  return h('div', 'd-note', parent, `
    <div class="hd"><b>DELIVERY NOTE</b><span>No. 2291</span></div>
    <div class="sup">Harbour Foods Ltd</div><div class="ad">Unit 4, Quay Road</div>
    <div class="its"><div><span>Plum tomatoes, 2.5 kg</span><b>12</b></div><div><span>Olive oil, 5 L</span><b>6</b></div><div><span>Flour, 16 kg</span><b>10</b></div></div>
    <div class="tot"><span>Total</span><b>£542.70</b></div>`)
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
   BOX: a delivery arrives. It settles on a pluck; the camera leans in on
   the three build hits; the note comes off on the drop
   ============================================================ */
const BOX = `<svg width="640" height="520" viewBox="0 0 640 520">
  <defs><linearGradient id="bxf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EAE1D1"/><stop offset="1" stop-color="#D2C5AF"/></linearGradient>
  <linearGradient id="bxt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F1E6"/><stop offset="1" stop-color="#ECE4D5"/></linearGradient>
  <linearGradient id="bxs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#BDAF98"/><stop offset="1" stop-color="#A89A83"/></linearGradient></defs>
  <path d="M40 150 L120 70 L620 70 L540 150 Z" fill="url(#bxt)"/>
  <path d="M540 150 L620 70 L620 440 L540 520 Z" fill="url(#bxs)"/>
  <rect x="40" y="150" width="500" height="370" fill="url(#bxf)"/>
  <path d="M290 150 L370 70" stroke="#D8CDBA" stroke-width="2"/>
  <path d="M255 150 L335 70 L405 70 L325 150 Z" fill="rgba(201,186,160,.5)"/>
  <rect x="255" y="150" width="70" height="96" fill="rgba(201,186,160,.42)"/>
</svg>`
const T_SET = bt(9), T_BUILD = [bt(12.5) - .015, bt(13) - .01, bt(13.5) - .01], T_DROP0 = bt(14)
function buildBox(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const shadow = h('div', 'd-shadow', s.cam)
  const box = h('div', 'd-box', s.cam, BOX)
  const nt = note(box); nt.classList.add('on')
  const capA = cap(s.hud, `A delivery arrives${STOP}`)
  const BY = M({ land: 150, sq: 170, tall: 190, port: 210 }) / Z0, BK = M({ land: 1, def: .9 })
  cue('whoosh', T_SET, { d: .7, v: .3 })
  return t => {
    // it comes down out of the dark and settles on the pluck, with a little give
    const u = P(t, t0 + .1, T_SET, E.io), sq = bell(t, T_SET - .02, T_SET + .06, T_SET + .4)
    put(box, { y: lerp(-H / 2 - 520, BY, u), s: BK, o: 1 })
    box.firstChild.style.transform = `scale(${(1 + .02 * sq).toFixed(4)}, ${(1 - .035 * sq).toFixed(4)})`; box.firstChild.style.transformOrigin = '50% 100%'
    // the note on its front stirs on the swell
    const fl = bell(t, bt(10), bt(10) + .08, bt(10) + .5)
    nt.style.transform = `rotate(${(-3 + 2 * fl).toFixed(2)}deg) translateY(${(-5 * fl).toFixed(1)}px) scale(.7)`
    put(shadow, { y: BY + 250 * BK, s: BK * lerp(.5, 1, u), o: .65 * u })
    capAt(capA, t, bt(8) + .1, null)
    // the camera: still, then a small lean in on each build hit, towards the note
    let k = 0; T_BUILD.forEach(a => { k += P(t, a - .02, a + .16, E.out) })
    const sx = M({ land: -34, def: -30 }) * BK, sy = BY + 60 * BK
    shoot(s, () => [sx * k / 3 * .6, sy * k / 3 * .45, 0, 0, 0, 0, 1 + .035 * k + .015 * P(t, t0, T_BUILD[0], E.io)], t)
    lens(s, {})
  }
}

/* ============================================================
   DESK: the note brought to the computer. Someone has to type it all in,
   a letter a sixteenth
   ============================================================ */
const T_PUT = bt(15), T_TYPE = bt(16)
function buildDesk(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const mon = monitor(s.cam), nt = note(s.cam)
  const sup = mon.querySelectorAll('.bx')[0]
  sup.innerHTML = '<span class="tx"></span><span class="caret"></span>'
  const tx = sup.querySelector('.tx'), caret = sup.querySelector('.caret')
  const capA = cap(s.hud, `Someone has to type it all in${STOP}`)
  const NAME = 'Harbour Foods Ltd'
  const MX = LAND ? 330 : 0, MY = M({ land: 60, sq: 60, tall: 50, port: -10 }) / Z0, MK = M({ land: .92, sq: .72, tall: .8, port: .88 })
  const NX = LAND ? -470 : M({ sq: -250, tall: -250, port: -210 }), NY = M({ land: 90, sq: 290, tall: 350, port: 510 }) / Z0, NK = M({ land: 1.3, def: 1 })
  cue('whoosh', t0 + .25, { d: .5, v: .4 })
  return t => {
    // the note comes off the box and is put down by the computer, on the clap
    const u = P(t, t0 - .02, T_PUT, E.io)
    put(nt, { x: lerp(-W / 2 - 360, NX, u), y: lerp(NY - 120, NY, u) - 60 * Math.sin(Math.PI * u), r: lerp(-16, -4, u), s: NK * (1 + .015 * bell(t, T_PUT, T_PUT + .05, T_PUT + .35)), o: 1 })
    put(mon, { x: MX, y: MY + (1 - P(t, t0, t0 + .6, E.out)) * 30, s: MK, o: P(t, t0, t0 + .4) }); shield(mon, .5)
    // typed by hand, a letter a sixteenth, and nowhere near done by the cut
    const n = t < T_TYPE ? 0 : Math.min(NAME.length, 1 + Math.floor((t - T_TYPE) / (B / 4)))
    tx.textContent = NAME.slice(0, n)
    const since = n ? t - (T_TYPE + (n - 1) * B / 4) : t - t0
    caret.style.opacity = t > T_PUT && (since < .1 || (since % .5) < .28) ? 1 : 0
    sup.classList.toggle('on', t > T_PUT)
    capAt(capA, t, t0 + .15, null)
    // one slow push in, towards the screen
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [t1, MX * .25, MY * .2, 0, 0, 0, 0, 1.1]]), t)
    lens(s, {})
  }
}

/* ============================================================
   PILE: then onto the pile it goes, and more on top, a toss a beat
   ============================================================ */
// [beat, sheets tossed on]; the pile starts at 18 and the note lands on it at beat 20
const TOSS = [[21, 5], [22, 6], [23, 7], [23.5, 6]]
const P0 = 18
function buildPile(s) {
  widen(s)
  const t0 = s.t0
  const r = rng(5)
  const land = []
  for (let k = 0; k < P0; k++) land.push(-1)
  const tNote = bt(20)
  let k = P0
  TOSS.forEach(([b, n]) => { for (let j = 0; j < n; j++) land.push(bt(b) - .012 + j * .03) })
  const sheets = HEAP.slice(0, P0).map((p, i) => ({ e: sheet(s.cam, i), p, tl: -1 }))
  // the note, on top of the first lot
  const sp = { x: 30, y: HEAP[P0 - 1].y + 30, r: -8, s: 1.1 }
  const nt = note(s.cam)
  TOSS.forEach(([b, n]) => { for (let j = 0; j < n; j++, k++) { const p = HEAP[k], side = Math.sign(p.x || 1) * (r() < .8 ? 1 : -1); sheets.push({ e: sheet(s.cam, k), p, tl: land[k], x0: side * (W / 2 + 260 + r() * 200), y0: p.y + 140 + r() * 260, arc: 160 + r() * 180, r0: p.r - side * (60 + r() * 90), fall: .4 + r() * .08 }) } })
  const total = P0 + 1 + TOSS.reduce((a, [, n]) => a + n, 0)   // 43
  const ch = chip(s.hud, `<b>${P0}</b> to type in`), cb = ch.querySelector('b')
  const capA = cap(s.hud, `Then onto the pile it goes${STOP}`)
  cue('whoosh', tNote, { d: .5, v: .35 })
  TOSS.forEach(([b]) => cue('whoosh', bt(b), { d: .35, v: .18 }))
  return t => {
    sheets.forEach(d => {
      if (d.tl < 0) { put(d.e, { x: d.p.x, y: d.p.y, r: d.p.r, s: d.p.s }); return }
      const ts = d.tl - d.fall, u = P(t, ts, d.tl, E.lin), st = bell(t, d.tl, d.tl + .04, d.tl + .3)
      put(d.e, { x: lerp(d.x0, d.p.x, E.out2(u)), y: lerp(d.y0, d.p.y, u) - d.arc * Math.sin(Math.PI * u), r: lerp(d.r0, d.p.r, P(t, ts, d.tl, E.out)), s: d.p.s * (1 + .04 * st), o: t >= ts ? 1 : 0 })
    })
    // the note drops on from above, on its kick
    const u = P(t, t0, tNote, E.io)
    put(nt, { x: lerp(-60, sp.x, u), y: lerp(-H / 2 - 420, sp.y, u), r: lerp(12, sp.r, u), s: sp.s * (1 + .03 * bell(t, tNote, tNote + .04, tNote + .3)) })
    let n = P0 + (t >= tNote - .02 ? 1 : 0), kb = 0
    TOSS.forEach(([b, nn]) => { if (t >= bt(b) - .02) { n += nn; kb = bell(t, bt(b) - .02, bt(b) + .04, bt(b) + .3) } })
    cb.textContent = Math.min(total, n)
    blurIn(ch, t, t0 + .1, { y: TOPY, dur: .4, s0: 1, blur: 10, dy: -14, s: 1 + .08 * kb }); shield(ch, .7)
    capAt(capA, t, t0 + .1, null)
    let jolt = 0; TOSS.forEach(([b, nn]) => { jolt += bell(t, bt(b) - .01, bt(b) + .03, bt(b) + .3) * Math.min(1, .3 + nn * .08) })
    s.rig.style.transform = `scale(${(1 + .01 * jolt).toFixed(4)})`
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1.06], [s.t1, 0, 0, 0, 0, 0, 0, .97]]), t)
    lens(s, {})
  }
}

/* ============================================================
   FLASH: the three build hits, n.abl Document AI on each
   ============================================================ */
const HITS = [bt(24), bt(24.5), bt(25)]
function buildFlash(s) {
  widen(s)
  const SC = [1, 1.25, 1.55]
  const lock = h('div', 'd-lock', s.cam, `${WORDMARK()}<div class="ai">Document AI</div>`)
  const svg = lock.querySelector('svg'), ww = M({ land: 700, def: 600 }); svg.setAttribute('width', ww); svg.setAttribute('height', ww * 100 / 273)
  svg.style.filter = 'drop-shadow(0 0 30px rgba(251,246,236,.18))'
  return t => {
    let k = 0; HITS.forEach((a, i) => { if (t >= a) k = i })
    const dt = Math.max(0, t - HITS[k]), hold = k === 2, L = hold ? .62 : .22
    const l = dt < L ? (hold ? 1 - P(dt, .3, L, E.in2) : Math.exp(-dt / .07) * (1 - dt / L)) : 0
    put(lock, { s: SC[k] * (1 + (hold ? .03 : .06) * dt / .27), o: l, blur: hold ? P(dt, .35, L, E.in2) * 16 : dt > .08 ? (dt - .08) * 40 : 0 })
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
const T_GRAB = bt(27), T_DROP = bt(29)
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
  cue('whoosh', T_DROP, { d: .7, v: .35 })
  return t => {
    const jump = 0
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
    const ci = P(t, t0, T_GRAB - .02, E.io), co = P(t, T_DROP + .15, T_DROP + .7, E.io)
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
const T_WAVE = bt(31), T_RUSH = bt(33)
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
  const t0 = s.t0, t1 = s.t1, tEnd = bt(36)
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
  const tN = t0, tDot = t0 + .2, tAbl = bt(37.5), tEb = bt(38), tTg = bt(39), tUrl = bt(40)
  const dash = (e, d) => { e.style.opacity = d > 0 ? 1 : 0; e.style.strokeDasharray = d < 1 ? '1 2' : ''; e.style.strokeDashoffset = d < 1 ? (1 - d).toFixed(4) : '' }
  return t => {
    dash(n, P(t, tN - .02, tN + .24, E.out))
    abl.forEach((e, i) => dash(e, P(t, tAbl + i * .06 - .02, tAbl + i * .06 + .32, E.out)))
    const dp = P(t, tDot - .02, tDot + .26, E.back), pulse = bell(t, bt(39), bt(39) + .04, bt(39) + .4) + bell(t, bt(41), bt(41) + .04, bt(41) + .4)
    dot.style.transformOrigin = '84.5px 75.5px'; dot.style.transform = `scale(${(dp * (1 + .15 * pulse)).toFixed(3)})`; dot.style.opacity = dp > 0 ? 1 : 0
    put(wm, { y: yM, s: 1 + .025 * bell(t, tN, tN + .04, tN + .3) })
    blurIn(eb, t, tEb - .03, { y: top - M({ land: 80, def: 74 }), dur: .3, s0: 1, blur: 10, dy: 14 })
    blurIn(tg, t, tTg - .03, { y: base + M({ land: 118, def: 108 }), dur: .34, s0: 1, blur: 14, dy: 18 })
    blurIn(url, t, tUrl - .03, { y: base + M({ land: 212, def: 196 }), dur: .3, s0: 1, blur: 10, dy: 12 })
    shield(wm, 1); shield(tg); shield(eb, .8)
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 0, 0, 0, 0, 0, 1.04]]), t)
    lens(s, { o: 1 - P(t, t1 - .6, t1, E.in2) })
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
    [0, G.open], [at('desk') - .02, G.open], [at('desk') + .6, G.heat], [at('pile'), G.heat], [at('pile') + 1, G.peak], [at('flash') - .02, G.peak],
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
  const PLUCKS = [7.5, 8, 8.5, 9, 10, 10.5, 11, 11.5, 12].map(bt)
  const BUILD = [bt(12.5) - .015, bt(13) - .01, bt(13.5) - .01]
  const KICKS = Array.from({ length: 28 }, (_, i) => bt(14 + i))
  const cv = h('div', 'layer', groundLayer)
  const draw = ground(cv, W, H)
  h('div', 'd-grain', groundLayer)
  return t => {
    const v = Object.assign({}, sample(t))
    let lift = 0; for (const p of PLUCKS) if (t >= p - .01 && t < p + .6) lift += Math.exp(-(t - p) / .16)
    let flare = 0; for (const p of HITS) if (t >= p) flare += Math.exp(-(t - p) / .09)
    for (const p of BUILD) if (t >= p) lift += 1.6 * Math.exp(-(t - p) / .12)
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
  scene(['desk'], buildDesk)
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
