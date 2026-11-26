/* ============================================================
   THE DOCS REEL: n.abl's Document AI, in 20 seconds

   An ad: a story told slowly, then the answer, cut to 4 to 24 seconds of
   the supplied clip, and locked to it the whole way through. Every hit of
   the track moves something: before the drop each pluck, the build's three
   hits; after it every kick, the claps a little harder. The frame breathes
   on each hit, the camera moves in steps that land on the beats, captions
   arrive a word a beat, things land on kicks and claps, rows fill and
   counts tick on the sixteenths, and the aurora behind it all pulses with
   them. In the 2026-11 brand: Manjari, the brand demo's own aurora
   (ground.js), and three lights that keep their meaning: ember for the
   problem, amber for n.abl, ice for the AI at work. No sound but whooshes.

   box    a delivery arrives: a cream parcel drops on the swell and rocks a
          little less on each pluck; the camera leans in on the build
   desk   on the drop its note goes to the computer, set down on the clap;
          someone has to type it all in, a letter a sixteenth
   stack  then onto the stack it goes: sheets dropped on with every kick;
          then in the same shot a cursor takes the stack on a clap, the
          sheets gather under it, and it carries them a step an eighth into
          Upload documents, dropped on the next clap
   sheet  one sheet, a row a document and a column a field, a row filled
          each sixteenth; then the rest stream past, done
   count  thousands of documents read and filed, a jump each sixteenth,
          landing on a kick
   end    the name drawn on the clap, the line a word an eighth, the dot
          pulsing on every kick, then still for the breakdown
   The script is films/docs/film.py; the brief is films/docs/SCRIPT.md.
   ============================================================ */

import { E, M, P, TL, W, H, LAND, WORDMARK, bell, cue as stageCue, h, icon, lerp, put, rise, rng, scene, stage, vis } from '../../film/stage.js'
import { ground as groundLayer } from '../../film/stage.js'
import { Z0, blurIn, lens, path, shoot, widen } from '../../film/kit.js'
import { ground, mix, mk } from './ground.js'

// Manjari, before anything is measured
await Promise.all(['100 100px Manjari', '400 40px Manjari', '700 40px Manjari'].map(f => document.fonts.load(f)))

const B = TL.beat, OFF = 0.304 - 4
const bt = k => OFF + k * B                               // the supplied clip's beat k (its first is 0.304 s in; the film starts 4 s in)
const cue = (k, t, o) => { if (k === 'whoosh') stageCue(k, t, o) }   // no sound but whooshes
const CHECK = (s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const STOP = '<span class="d-stop"></span>'

/* ---------- the track's hits, in film time, and what they do to the frame ---------- */
const PLUCK = [7.5, 8, 8.5, 9, 10, 10.5, 11, 11.5, 12].map(bt)               // the plucks before the drop
const BUILD = [bt(12.5) - .015, bt(13) - .01, bt(13.5) - .01]                 // the build's three hits
const KICK = Array.from({ length: 28 }, (_, i) => bt(14 + i))                // every kick from the drop to the breakdown
const HITS = [...PLUCK.map(t => [t, .7]), ...BUILD.map(t => [t, 1.2]), ...KICK.map((t, i) => [t, i % 2 ? 1.3 : 1])]
/* how hard the track is hitting at t: a decaying kick from each hit */
function pulse(t, tau = .11) { let p = 0; for (const [b, w] of HITS) if (t >= b - .005 && t < b + .6) p += w * Math.exp(-(t - b) / tau); return p }
/* steps that land on the given hits: each eases in over the sixteenth before, so it arrives on the beat */
const steps = (t, list, pre = .1, post = .08) => list.reduce((k, b) => k + P(t, b - pre, b + post, E.io), 0)
/* the frame breathes on every hit */
const breathe = (s, t, k = 1) => { s.rig.style.transform = `scale(${(1 + .011 * k * pulse(t)).toFixed(4)})` }
const kicksIn = (a, b) => KICK.filter(k => k > a + .01 && k < b - .01)
const at16 = (from, n) => Array.from({ length: n }, (_, i) => from + i * B / 4)     // n sixteenths from a beat

/* where things sit, per frame */
const TOPY = M({ land: -428, sq: -432, tall: -548, port: -772 })      // a chip above the caption
const CAPY = M({ land: -282, sq: -268, tall: -372, port: -552 })      // the caption
const CAP = M({ land: 136, sq: 104, tall: 108, port: 112 }), CAPW = M({ land: 1720, def: 980 })

/* words keep the light off them: each visible text block is a shield for the ground */
const SH = []
function shield(e, k = .9) {
  if (+e.style.opacity < .05 || e.style.visibility === 'hidden') return
  const r = e.getBoundingClientRect(), o = stage.getBoundingClientRect()
  if (r.width < 2) return
  SH.push([r.left - o.left, r.top - o.top, r.right - o.left, r.bottom - o.top, k])
}
/* a caption: Thin cream type, centred */
function cap(parent, html, size = CAP) {
  const e = h('div', 'd-cap', parent, html)
  Object.assign(e.style, { fontSize: size + 'px', width: 'max-content', maxWidth: CAPW + 'px' })
  return e
}
/* a line that arrives a word a hit, and stays centred on what has arrived; in the narrow
   frames it breaks where it is told to (a '|' among the words) */
function wordLine(parent, words, size = CAP) {
  const rows = [[]]
  words.forEach(w => { if (w === '|') { if (!LAND) rows.push([]) } else rows[rows.length - 1].push(w) })
  const lines = rows.map(ws => {
    const e = cap(parent, ws.map(w => `<span class="w">${w}</span>`).join(' '), size)
    Object.assign(e.style, { maxWidth: 'none', whiteSpace: 'nowrap' })
    return { e, ws: [...e.querySelectorAll('.w')], WW: null }
  })
  const n = words.filter(w => w !== '|').length
  return {
    lines,
    at(t, times, { y = CAPY, o = 1 } = {}) {
      let i = 0
      lines.forEach((L, r) => {
        if (!L.WW) { const sp = L.e.offsetWidth - L.ws.reduce((a, w) => a + w.offsetWidth, 0); L.WW = L.ws.map(w => w.offsetWidth + sp / Math.max(1, L.ws.length - 1)) }
        let hid = 0
        L.ws.forEach((w, j) => { const a = times[Math.min(n - 1, i++)]; rise(w, t, a - .05, { dur: .16, dy: 22, blur: 10 }); hid += (1 - E.io(P(t, a - .05, a + .1, E.lin))) * L.WW[j] })
        put(L.e, { x: hid / 2, y: y + (r - (lines.length - 1) / 2) * size * 1.04, o })
        if (o > .3 && t > times[0]) shield(L.e)
      })
    },
  }
}
function chip(parent, html) { return h('div', 'd-chip', parent, `<span class="sq"></span><span>${html}</span>`) }

/* ---------- the delivery note: printed, plain, and still to be typed in ---------- */
function note(parent) {
  return h('div', 'd-note', parent, `
    <div class="hd"><b>DELIVERY NOTE</b><span>No. 2291</span></div>
    <div class="sup">Harbour Foods Ltd</div><div class="ad">Unit 4, Quay Road</div>
    <div class="its"><div><span>Plum tomatoes, 2.5 kg</span><b>12</b></div><div><span>Olive oil, 5 L</span><b>6</b></div><div><span>Flour, 16 kg</span><b>10</b></div></div>
    <div class="tot"><span>Total</span><b>£542.70</b></div>`)
}
/* a sheet for the stack: an invoice, a header and a few lines */
const LW = [62, 44, 90, 84, 70, 92, 58, 80, 40, 66]
const KINDS = ['INVOICE', 'DELIVERY NOTE', 'INVOICE', 'RECEIPT', 'INVOICE', 'STATEMENT', 'DELIVERY NOTE', 'ORDER']
function sheet(parent, i) {
  const lines = LW.map((w, j) => `<i class="${j === 1 || j === 8 ? 'd' : ''}" style="width:${(w + (i * 7 + j * 13) % 17) % 100}%"></i>`).join('')
  return h('div', 'd-sheet ' + ['', 'b', 'c'][i % 3], parent, `<div class="h">${KINDS[i % KINDS.length]}</div>${lines}`)
}
/* the computer: a monitor with an empty invoice form on it */
function monitor(parent) {
  return h('div', 'd-mon', parent, `<div class="scr d-glass"><div class="bar"><span class="sq"></span>New invoice</div>
    <div class="fs">${['Supplier', 'Invoice date', 'Invoice number', 'Order', 'Net', 'Total'].map(l => `<div class="fd"><div class="lb">${l}</div><div class="bx"></div></div>`).join('')}</div></div>
    <div class="neck"></div><div class="base"></div>`)
}

/* ============================================================
   BOX: a delivery arrives. It drops on the swell, rocks a little less on
   each pluck after as it settles; the camera steps in on every pluck, and
   leans in on the build
   ============================================================ */
const T_LAND = bt(10)
/* the parcel: front on, lit softly, a lid seam, tape, its note */
function parcel(parent) {
  const e = h('div', 'd-parcel', parent, '<i class="lid"></i><i class="seam"></i><i class="tape"></i><i class="sheen"></i>')
  const nt = note(e); nt.classList.add('on')
  return e
}
function buildBox(s) {
  widen(s)
  const shadow = h('div', 'd-shadow', s.cam)
  const box = parcel(s.cam)
  const line = wordLine(s.hud, ['A', 'delivery', `arrives${STOP}`])
  const BY = M({ land: 110, sq: 140, tall: 170, port: 210 }) / Z0, BK = M({ land: 1.15, def: .95 })
  const SETTLE = PLUCK.filter(p => p > T_LAND + .05)
  cue('whoosh', T_LAND, { d: .55, v: .32 })
  return t => {
    // it falls and lands on the swell, gives, then rocks a little less on each pluck
    const u = P(t, T_LAND - .32, T_LAND, E.in2), sq = bell(t, T_LAND - .01, T_LAND + .05, T_LAND + .32)
    let rock = 0; SETTLE.forEach((p, i) => { rock += (i % 2 ? -1 : 1) * (1.8 - i * .4) * bell(t, p - .03, p + .05, p + .42) })
    put(box, { y: lerp(-H / 2 - 520, BY, u) + 8 * sq, r: rock, s: BK * (1 - .015 * sq), o: t > T_LAND - .32 ? 1 : 0 })
    put(shadow, { y: BY + 190 * BK + 26, s: BK * lerp(.3, 1, u) * (1 + .05 * sq), o: .75 * u })
    line.at(t, PLUCK.slice(0, 3))
    // the camera: a step closer on each pluck, then a lean in on each build hit
    const k = steps(t, PLUCK), b = steps(t, BUILD, .05, .06)
    shoot(s, () => [40 * b, BY * .12 * b, 0, 0, 0, 0, 1 + .01 * k + .045 * b], t)
    breathe(s, t)
    lens(s, {})
  }
}

/* ============================================================
   DESK: on the drop the note goes to the computer, set down on the clap.
   Someone has to type it all in, a letter a sixteenth
   ============================================================ */
const T_PUT = bt(15), T_TYPE = bt(16)
function buildDesk(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const mon = monitor(s.cam), nt = note(s.cam)
  const sup = mon.querySelectorAll('.bx')[0]
  sup.innerHTML = '<span class="tx"></span><span class="caret"></span>'
  const tx = sup.querySelector('.tx'), caret = sup.querySelector('.caret')
  const line = wordLine(s.hud, ['Someone', 'has', 'to', '|', 'type', 'it', 'all', `in${STOP}`])
  const NAME = 'Harbour Foods Ltd'
  const MX = LAND ? 330 : 0, MY = M({ land: 60, sq: 60, tall: 50, port: -10 }) / Z0, MK = M({ land: .92, sq: .72, tall: .8, port: .88 })
  const NX = LAND ? -470 : M({ sq: -250, tall: -250, port: -210 }), NY = M({ land: 90, sq: 290, tall: 350, port: 510 }) / Z0, NK = M({ land: 1.3, def: 1 })
  const KS = kicksIn(t0, t1)
  cue('whoosh', T_PUT, { d: .5, v: .38 })
  return t => {
    // the note comes in from the side in two steps, the second set down on the clap
    const u = steps(t, [bt(14.5), T_PUT], .12, .1) / 2
    put(nt, { x: lerp(-W / 2 - 360, NX, u), y: lerp(NY - 80, NY, u), r: lerp(-14, -4, u), s: NK * (1 + .02 * bell(t, T_PUT, T_PUT + .05, T_PUT + .3)), o: 1 })
    const mi = P(t, t0, t0 + .3, E.out)
    put(mon, { x: MX, y: MY + (1 - mi) * 30, s: MK, o: mi, blur: (1 - mi) * 10 }); shield(mon, .5)
    // typed by hand, a letter a sixteenth, nowhere near done by the cut
    const n = t < T_TYPE ? 0 : Math.min(NAME.length, 1 + Math.floor((t - T_TYPE) / (B / 4) + 1e-6))
    tx.textContent = NAME.slice(0, n)
    const since = n ? t - (T_TYPE + (n - 1) * B / 4) : t - t0
    caret.style.opacity = t > T_PUT && (since < .1 || (since % .5) < .28) ? 1 : 0
    sup.classList.toggle('on', t > T_PUT)
    line.at(t, at16(T_PUT, 7))
    // the camera: a step in towards the screen on every kick
    const k = steps(t, KS)
    shoot(s, () => [MX * .06 * k, MY * .05 * k, 0, 0, (LAND ? 2.5 : 0) - .6 * k, 0, 1 + .022 * k], t)
    breathe(s, t)
    lens(s, {})
  }
}

/* ============================================================
   STACK: then onto the stack it goes; sheets dropped on with every kick,
   the claps bringing more. Then, in the same shot, Upload documents: a
   cursor takes the stack on a clap, the sheets gather under it, and it
   carries them a step an eighth into the box, dropped on the next clap
   ============================================================ */
const T_ONTO = bt(20), T_UP = bt(26)
// [beat, sheets dropped on]; the stack starts at 18 waiting, and the note lands on it at beat 20
const GROW = [[21, 5], [22, 4], [23, 6], [24, 4], [25, 7]]
const S0 = 18
const CURSOR = `<svg width="44" height="44" viewBox="0 0 40 40"><path d="M6 3 L6 31 L13.5 24 L18.5 35.5 L23.5 33.3 L18.6 22.2 L28.5 22.2 Z" fill="#FBF6EC" stroke="#0E0C0A" stroke-width="2.2" stroke-linejoin="round"/></svg>`
function cursor(parent) { const e = h('div', 'd-cur', parent, CURSOR); e.style.transformOrigin = '6px 3px'; return e }
function aim(e, x, y, o = 1, press = 0) { e.style.transform = `translate3d(${(x - 6).toFixed(1)}px,${(y - 3).toFixed(1)}px,0) scale(${(1 - .16 * press).toFixed(3)})`; vis(e, o) }
const UPLOAD = '<svg width="64" height="64" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21a6 6 0 01-.6-12A8 8 0 0123.6 11 5 5 0 0123 21"/><path d="M16 27V15M11.5 19.5L16 15l4.5 4.5"/></svg>'
const NDOC = 43
const T_GRAB = bt(27), T_DROP = bt(29)
function buildStack(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const r = rng(17)
  // the sheets, bottom to top; the note is the nineteenth
  const SP = 7                                                            // each sheet sits this much above the last
  const land = []
  for (let i = 0; i < S0; i++) land.push(-1)
  land.push(T_ONTO)
  GROW.forEach(([b, n]) => { for (let j = 0; j < n; j++) land.push(bt(b) - .01 + j * .02) })
  const shadow = h('div', 'd-shadow', s.cam)
  const cards = land.map((tl, i) => {
    const e = i === S0 ? note(s.cam) : sheet(s.cam, i)
    if (i === S0) e.classList.add('top')
    return { e, tl, x: (r() - .5) * 14, y: -i * SP, rot: (r() - .5) * 2.6, j: [(r() - .5) * 26, (r() - .5) * 20, (r() - .5) * 10], k: i === S0 ? .74 : 1 }
  })
  const ch = chip(s.hud, `<b>${S0}</b> to type in`), cb = ch.querySelector('b')
  const line = wordLine(s.hud, ['Then', 'onto', 'the', '|', 'stack', 'it', `goes${STOP}`])
  // where the stack stands: in the middle, then to one side for the upload box
  const SY = M({ land: 340, sq: 330, tall: 410, port: 590 }) / Z0, SK = M({ land: 1.15, sq: 1.05, tall: 1.15, port: 1.3 })
  const SX2 = LAND ? -430 : 0, SY2 = LAND ? SY : SY + 60 / Z0, SK2 = LAND ? .85 : .7
  // the box: beside it, or above it in the narrow frames
  const ZW = M({ land: 760, def: 760 }) / Z0, ZH = M({ land: 300, def: 280 }) / Z0
  const ZX = LAND ? 430 : 0, ZY = LAND ? -20 : M({ sq: -300, tall: -400, port: -620 }) / Z0
  const eb = h('div', 'd-eyebrow', s.cam, '<i></i><span>Document AI</span>')
  const zone = h('div', 'd-zone', s.cam, `<div class="ic">${UPLOAD}</div><div class="t">Upload documents</div><div class="s">PDFs, photos, scans</div>
    <div class="dn"><span class="dot"></span><span>Reading <b>${NDOC}</b> documents</span></div>`)
  Object.assign(zone.style, { width: ZW + 'px', height: ZH + 'px' })
  const zt = zone.querySelectorAll('.ic, .t, .s'), zd = zone.querySelector('.dn'), zdot = zone.querySelector('.dot')
  const cur = cursor(s.cam)
  const CARRY = [bt(27.5), bt(28), bt(28.5), T_DROP]
  cue('whoosh', T_ONTO, { d: .5, v: .35 })
  GROW.forEach(([b]) => cue('whoosh', bt(b), { d: .3, v: .15 }))
  cue('whoosh', T_DROP, { d: .6, v: .38 })
  return t => {
    // the stack moves aside, a step, for the box
    const mv = P(t, T_UP - .1, T_UP + .12, E.io)
    const bx = lerp(0, SX2, mv), by = lerp(SY, SY2, mv), bk = lerp(SK, SK * SK2, mv)
    // taken: the sheets gather under the cursor, ride with it a step an eighth, and drop in on the clap
    const g = P(t, T_GRAB - .02, T_GRAB + .14, E.out), m = steps(t, CARRY, .1, .06) / 4, dn = P(t, T_DROP - .03, T_DROP + .1, E.in2)
    const n = cards.length, topY = by + cards[n - 1].y * bk
    const gx = lerp(bx, ZX, m), gy = lerp(topY + 60 * bk, ZY + 10, m) - 80 * Math.sin(Math.PI * m)
    const gk = lerp(.85 * bk, .32, m) * (1 - .8 * dn)
    let count = 0
    cards.forEach((c, i) => {
      // each sheet drops on from above and lands on its hit
      const fall = c.tl < 0 ? 1 : P(t, c.tl - .14, c.tl, E.in2)
      if (c.tl >= 0 && t >= c.tl - .02) count++
      const fromNote = i === S0 ? P(t, t0 - .02, T_ONTO, E.io) : fall
      const sx = bx + c.x * bk, sy = by + c.y * bk
      let x = i === S0 ? lerp(-W / 2 - 300, sx, fromNote) : sx, y = i === S0 ? lerp(sy - 260, sy, fromNote) - 120 * Math.sin(Math.PI * fromNote) : sy - (1 - fall) * 220
      let rot = i === S0 ? lerp(-24, c.rot, fromNote) : c.rot + (1 - fall) * 10 * Math.sign(c.j[0]), k = bk * c.k
      x = lerp(x, gx + c.j[0] * gk, g); y = lerp(y, gy + c.j[1] * gk + (i - n) * 1.2 * gk, g); rot = lerp(rot, c.j[2], g); k = lerp(k, gk * c.k, g)
      put(c.e, { x, y, r: rot, s: k, o: (c.tl < 0 || t >= (i === S0 ? t0 : c.tl - .14)) ? 1 - P(dn, .6, 1, E.lin) : 0 })
    })
    put(shadow, { x: bx, y: by + 170 * bk, s: bk * 1.05 * (1 - g), o: .7 * (1 - g) })
    cb.textContent = Math.min(NDOC, S0 + count)
    const bump = GROW.reduce((a, [b]) => a + bell(t, bt(b) - .02, bt(b) + .04, bt(b) + .25), 0)
    blurIn(ch, t, t0 + .05, { y: TOPY, dur: .3, s0: 1, blur: 10, dy: -14, s: 1 + .08 * bump, o: 1 - mv }); if (mv < .5) shield(ch, .7)
    line.at(t, at16(t0, 6), { o: 1 - mv })
    // the box, and the cursor
    const z = P(t, T_UP - .05, T_UP + .25, E.out), lit = bell(t, T_DROP, T_DROP + .06, T_DROP + .5), sw = P(t, T_DROP + .06, T_DROP + .3, E.out)
    const hit = CARRY.reduce((a, b) => a + bell(t, b - .02, b + .04, b + .2), 0)
    put(zone, { x: ZX, y: ZY + (1 - z) * 30, s: (1 + .04 * lit) * (1 + .012 * hit), o: z })
    put(eb, { x: ZX, y: ZY - ZH / 2 - 46, o: z }); if (z > .3) shield(eb, .7)
    zone.style.borderColor = lit > .02 || t > T_DROP ? `rgba(124,203,255,${(.5 + .5 * lit).toFixed(3)})` : ''
    zone.style.boxShadow = `0 0 ${(80 * lit).toFixed(0)}px rgba(124,203,255,${(.35 * lit).toFixed(3)}), 0 40px 90px rgba(0,0,0,.45)`
    zt.forEach(e => { e.style.opacity = (1 - sw).toFixed(3) })
    zd.style.opacity = sw.toFixed(3); zd.style.transform = `translateY(${((1 - sw) * 20).toFixed(1)}px)`
    zdot.style.opacity = (.35 + .65 * Math.exp(-(((t - T_DROP) % (B / 2)) + B / 2) % (B / 2) / .12)).toFixed(3)
    const ci = steps(t, [bt(26.5), T_GRAB], .12, .08) / 2, co = P(t, T_DROP + .15, T_DROP + .7, E.io)
    const from = [LAND ? 760 : 420, by + 200]
    const cx = t > T_GRAB ? gx : lerp(from[0], bx + 20, ci), cy = t > T_GRAB ? gy - 30 * gk : lerp(from[1], topY - 30 * bk, ci)
    aim(cur, cx + co * 260, cy + co * 220, (t > T_UP ? 1 : 0) * (1 - co), bell(t, T_GRAB - .03, T_GRAB, T_GRAB + .12) + (t > T_GRAB && t < T_DROP ? .5 : 0))
    // the camera: back and up a step with each drop of sheets, then a step a kick
    const k = steps(t, GROW.map(([b]) => bt(b)), .06, .12), kk = steps(t, kicksIn(T_UP, t1))
    shoot(s, () => [0, -k * 5, 0, 0, 0, 0, 1.06 - k * .02 + .01 * kk], t)
    breathe(s, t)
    lens(s, {})
  }
}

/* ============================================================
   SHEET: a row a document, a column a field: a row filled each sixteenth
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
const T_FILL = bt(31), T_RUSH = bt(33)
function buildSheet(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const COLS = LAND ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 1, 7, 9]
  const GRID = LAND ? '1.25fr 1.6fr 1fr .95fr 1.35fr .9fr .75fr .95fr .95fr .85fr' : '1.3fr 1.7fr 1fr .9fr'
  const NV = M({ land: 9, sq: 9, tall: 12, port: 15 })                      // rows in view
  const NR = 40
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
  // a row each sixteenth, its cells a breath apart left to right
  const ROWAT = at16(T_FILL, NV)
  const at = (ri, ci) => ri < NV ? ROWAT[ri] - .05 + ci * .018 : -1
  const line = wordLine(s.hud, ['Every', 'field.', '|', 'Every', `document${STOP}`])
  // the rest rush past, a step a sixteenth
  const RUSH = at16(T_RUSH, 4)
  cue('whoosh', T_RUSH + .2, { d: .5, v: .4 })
  let RH = null
  return t => {
    if (!RH) { RH = sc.firstChild.offsetHeight; vp.style.height = (RH * NV) + 'px' }
    blurIn(tbl, t, t0 - .02, { y: M({ land: 120, sq: 130, tall: 140, port: 120 }) / Z0, dur: .25, s0: .96, blur: 12, dy: 30 })
    let filled = 0
    cells.forEach((row, ri) => row.forEach((c, ci) => {
      if (!c.sk) return
      const a = at(ri, ci), p = a < 0 ? 1 : P(t, a, a + .08, E.out)
      c.sk.style.opacity = (1 - p).toFixed(3); c.v.style.opacity = p.toFixed(3)
      c.v.style.color = a > 0 && t < a + .45 ? `rgba(169,220,255,${(1 - P(t, a + .1, a + .45)).toFixed(3)})` : ''
      if (ci === row.length - 1 && ri < NV && t >= a) filled++
    }))
    const r = steps(t, RUSH, .06, .06) / RUSH.length
    cn.textContent = Math.min(NDOC, filled + Math.round(r * (NDOC - NV)))
    sc.style.transform = `translateY(${(-r * RH * (NR - NV)).toFixed(1)}px)`
    const sp = (steps(t + 1 / 60, RUSH, .06, .06) / RUSH.length - r) * RH * (NR - NV)
    sc.style.filter = sp > 2 ? `blur(${Math.min(10, sp * .4).toFixed(1)}px)` : 'none'
    line.at(t, [bt(30), bt(30.5), bt(31), bt(31.5)])
    const k = steps(t, kicksIn(t0, t1))
    shoot(s, () => [0, 0, 0, 0, 0, 0, 1 + .012 * k], t)
    breathe(s, t)
    lens(s, { blur: 6 * P(t, t1 - .1, t1, E.in2) })
  }
}

/* ============================================================
   COUNT: thousands of documents, read and filed, a jump each sixteenth
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
  // the count's steps: a sixteenth apart, each a smaller jump, the last on the kick
  const ST = at16(t0 + B / 4, 8)
  const VAL = ST.map((_, i) => Math.round(N_TOTAL * (1 - Math.pow(1 - (i + 1) / ST.length, 2.2))))
  cue('whoosh', t1 - .05, { d: .4, v: .35 })
  return t => {
    let n = 0; ST.forEach((a, i) => { if (t >= a - .01) n = VAL[i] })
    big.textContent = fmtN(n)
    const bi = P(t, t0, t0 + .3, E.out), land = bell(t, tEnd, tEnd + .04, tEnd + .4)
    const tick = ST.reduce((a, b) => a + bell(t, b - .01, b + .02, b + .12), 0)
    put(big, { y: -40, s: lerp(1.25, 1, bi) * (1 + .04 * land + .012 * tick), blur: (1 - bi) * 24, o: Math.min(1, bi * 2) })
    shield(big, 1)
    blurIn(capN, t, t0 + .1, { y: M({ land: 150, def: 120 }), dur: .3, s0: 1, blur: 12, dy: 16 })
    blurIn(live, t, t0 + .05, { y: M({ land: -250, def: -200 }), dur: .3, s0: 1, blur: 10, dy: -12 })
    ldot.style.opacity = (.35 + .65 * Math.exp(-(((t - t0) % (B / 2)) + B / 2) % (B / 2) / .12)).toFixed(3)
    live.lastChild.textContent = t >= tEnd ? 'Read and filed' : 'Reading'
    const kp = pulse(t)
    tiles.forEach(d => {
      const zz = d.z + (t - t0) * 240 * d.sp
      put(d.e, { x: d.x + Math.sin(t * .7 + d.ph) * 18, y: d.y - (t - t0) * 40 * d.sp, z: zz, r: d.rot + Math.sin(t + d.ph) * 4, s: 1 + .04 * kp, o: P(t, t0, t0 + .3), blur: Math.min(14, Math.abs(zz) / 45) })
    })
    shoot(s, path([[t0, 0, 0, 60, 0, 0, 0, 1], [t1, 0, 0, 200, 0, 0, 0, 1.04]]), t)
    breathe(s, t)
    lens(s, { blur: 8 * P(t, t1 - .12, t1, E.in2) })
  }
}

/* ============================================================
   END: the name drawn on the clap; Document AI; the line a word an eighth;
   the address; the dot pulsing on every kick, then still for the breakdown
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
  const tg = wordLine(s.cam, ['Paperwork,', 'read', 'and', `filed${STOP}`], M({ land: 84, def: 72 }))
  const url = h('div', 'd-url', s.cam, 'nabl.agency')
  const yM = M({ land: -60, def: -70 })
  const top = yM + (6 - 50) * MK, base = yM + (82 - 50) * MK
  const tDot = bt(37.5), tAbl = bt(38), tEb = bt(38.5), TG = [bt(39), bt(39.5), bt(40), bt(40.5)], tUrl = bt(41)
  const PULSE = KICK.filter(k => k > tDot && k < bt(42))
  const dash = (e, d) => { e.style.opacity = d > 0 ? 1 : 0; e.style.strokeDasharray = d < 1 ? '1 2' : ''; e.style.strokeDashoffset = d < 1 ? (1 - d).toFixed(4) : '' }
  return t => {
    dash(n, P(t, t0 - .02, t0 + .22, E.out))
    abl.forEach((e, i) => dash(e, P(t, tAbl + i * .045 - .03, tAbl + i * .045 + .24, E.out)))
    const dp = P(t, tDot - .03, tDot + .22, E.back), pls = PULSE.reduce((a, k) => a + bell(t, k - .01, k + .03, k + .35), 0)
    dot.style.transformOrigin = '84.5px 75.5px'; dot.style.transform = `scale(${(dp * (1 + .14 * pls)).toFixed(3)})`; dot.style.opacity = dp > 0 ? 1 : 0
    put(wm, { y: yM, s: 1 + .02 * bell(t, t0, t0 + .04, t0 + .3) })
    blurIn(eb, t, tEb - .05, { y: top - M({ land: 80, def: 74 }), dur: .25, s0: 1, blur: 10, dy: 14 })
    tg.at(t, TG, { y: base + M({ land: 118, def: 108 }) })
    blurIn(url, t, tUrl - .05, { y: base + M({ land: 212, def: 196 }), dur: .25, s0: 1, blur: 10, dy: 12 })
    shield(wm, 1); shield(eb, .8)
    // the camera: a small step in on each kick until the breakdown, then still
    const k = steps(t, kicksIn(t0, bt(42)))
    shoot(s, () => [0, 0, 0, 0, 0, 0, 1 + .006 * k], t)
    if (t < bt(42)) breathe(s, t, .6); else s.rig.style.transform = ''
    lens(s, { o: 1 - P(t, t1 - .6, t1, E.in2) })
  }
}

/* ============================================================
   THE GROUND: the brand's aurora, and nothing else. Warm while the problem
   is told, cooling to ice as the answer runs; its curtains swing and
   brighten on every hit
   ============================================================ */
const AUR = { g: 0, f: 0, a: 1, drift: 1, shd: 1, vig: 0, tone: .45, hp: .3, sat: 1, heat: .3 }
const au = o => mk(Object.assign({}, AUR, o))
const G = {
  warm: au({ tau: .18, spread: .75, cy: .42, k: .85, pace: 3 }),
  hot: au({ tau: .26, spread: .85, cy: .5, k: 1, pace: 4 }),
  turn: au({ tau: .55, spread: .75, cy: .55, k: .95, pace: 3.5 }),
  cool: au({ tau: .82, spread: .7, cy: .6, k: .95, pace: 3 }),
  rise: au({ tau: .86, spread: .6, cy: .78, k: .82, pace: 2.2 }),
  settle: au({ tau: .92, spread: .55, cy: .82, k: .72, pace: 1.6 }),
}
function buildGround(s) {
  const at = id => TL.scenes.find(x => x.id === id).start
  const KF = [
    [0, G.warm], [at('stack') - .3, G.warm], [at('stack') + .8, G.hot], [T_UP - .02, G.hot], [T_UP + 1, G.turn],
    [at('sheet') + .3, G.cool], [at('end') - .02, G.cool], [at('end') + .6, G.rise], [TL.duration, G.settle],
  ]
  const sample = t => {
    if (t <= KF[0][0]) return KF[0][1]
    for (let j = 1; j < KF.length; j++) if (t <= KF[j][0]) { let u = (t - KF[j - 1][0]) / (KF[j][0] - KF[j - 1][0]); u = u * u * (3 - 2 * u); return mix(KF[j - 1][1], KF[j][1], u) }
    return KF[KF.length - 1][1]
  }
  // the demo's phases, accumulated on the film's clock (TA: the aurora)
  const DT = 1 / 120, NS = Math.ceil(TL.duration / DT) + 2, PH = new Float32Array(NS * 3)
  let tg = .3, ta = .25, wt = 0
  for (let i = 0; i < NS; i++) { PH[i * 3] = tg; PH[i * 3 + 1] = ta; PH[i * 3 + 2] = wt; const v = sample(i * DT); tg += DT * (.03 + .06 * v.heat) * v.pace; ta += DT * .04 * v.pace; wt += DT * v.pace }
  const phase = (t, k) => { const x = Math.max(0, t / DT), i = Math.min(NS - 2, Math.floor(x)), f = x - i; return PH[i * 3 + k] * (1 - f) + PH[(i + 1) * 3 + k] * f }
  const cv = h('div', 'layer', groundLayer)
  const draw = ground(cv, W, H)
  h('div', 'd-grain', groundLayer)
  return t => {
    const v = Object.assign({}, sample(t))
    const p = t < bt(42) ? pulse(t, .14) : 0
    v.k *= (1 + .14 * Math.min(1.6, p)) * P(t, 0, .6, E.out)
    draw(v, { T: 6 + t, TG: phase(t, 0), TA: phase(t, 1), wtime: phase(t, 2), V: Math.min(1, .45 * p) }, SH.slice(0, 3))
    SH.length = 0
  }
}

export default function setup() {
  document.querySelector('.vignette').style.display = 'none'      // the lit ground keeps its own dark
  scene(['box'], buildBox)
  scene(['desk'], buildDesk)
  scene(['stack'], buildStack)
  scene(['sheet'], buildSheet)
  scene(['count'], buildCount)
  scene(['end'], buildEnd)
  scene(['box', 'end'], buildGround, { hold: 1 })                   // last, so the words have been placed
  const ground = [[0, .5, .5, 0, .5, .5, 0, 0], [TL.duration, .5, .5, 0, .5, .5, 0, 0]]
  return { ground, bug: ['end', 'end'] }
}
