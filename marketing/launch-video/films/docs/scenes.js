/* ============================================================
   THE DOCS REEL: n.abl's Document AI, in 16 seconds

   Problem, then answer, and every move on a hit of the track. The problem
   is the tedium: one document, and the fields finance, legal and ops each
   need from it, typed in one at a time. In the 2026-11 brand: Manjari, the
   lit ground (ground.js, the brand demo's own shader), and three lights
   that keep their meaning: ember for the problem, amber for n.abl, ice for
   the AI at work.

   fields One document. 47 fields to fill: the form stacks up on the plucks,
          finance, then legal, then ops, and scrolls on past the frame
   type   the track's silence: a VAT number typed a key at a time, and the
          line a word a key: One. At. A. Time.
   loop   the plucks again: Copy. Paste. Check. Repeat., a word a pluck,
          then the whole line again and again, field 8 of 47, 9, 10...
   flash  the three build hits: n.abl Document AI, flashed in and out, the
          light flaring with each and the glass coming in, fine reeds first
   fix    the drop: the same form, all of it, fills itself in one wave.
          Every field, filled. Sent to finance and legal. 47 fields. None
          typed. One line a clap; the reeds breathe on the kicks
   end    the aurora rises; the name, Document AI, Paperwork, read and
          filed., the address, held
   The script is films/docs/film.py; the brief is films/docs/SCRIPT.md.
   ============================================================ */

import { E, M, P, TL, W, H, LAND, WORDMARK, bell, cue, h, lerp, put, rise, rng, scene, stage, vis } from '../../film/stage.js'
import { ground as groundLayer } from '../../film/stage.js'
import { Z0, blurIn, lens, path, shoot, widen } from '../../film/kit.js'
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
/* a line that arrives a word at a time, on given hits, and stays centred on what has arrived */
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
/* a sheet of paper: the document */
const LW = [62, 44, 90, 84, 70, 92, 58, 80, 40, 66]
function sheet(parent, label) {
  const lines = LW.map((w, j) => `<i class="${j === 1 || j === 8 ? 'd' : ''}" style="width:${w}%"></i>`).join('')
  return h('div', 'd-sheet', parent, `<div class="h">${label}</div>${lines}`)
}

/* every field finance, legal and ops want from one supplier's paperwork (all props) */
const FORM = [
  ['Finance', [['Supplier', 'Harbour Foods Ltd'], ['Supplier ID', 'HF-0093'], ['Invoice number', 'INV-2291'], ['Invoice date', '03/10/2026'], ['Due date', '02/11/2026'],
    ['PO number', 'PO-0417'], ['VAT number', 'GB 241 7735 08'], ['Currency', 'GBP'], ['Net', '£452.25'], ['VAT', '£90.45'], ['Total', '£542.70'], ['Tax code', 'T1'],
    ['Nominal code', '5000'], ['Cost centre', 'Kitchen'], ['GL account', '5000-KIT'], ['Payment terms', '30 days'], ['Sort code', '20-45-77'], ['Account number', '••••4417'],
    ['Remittance email', 'ap@harbourfoods.co.uk'], ['Approver', 'M. Patel']]],
  ['Legal', [['Contract ref', 'SA-1182'], ['Party', 'Harbour Foods Ltd'], ['Start date', '01/04/2026'], ['Term', '12 months'], ['Renewal', '31/03/2027'], ['Auto-renew', 'Yes'],
    ['Notice period', '90 days'], ['Liability cap', '£50,000'], ['Governing law', 'England & Wales'], ['Data processing', 'DPA signed'], ['Insurance', '£2m public liability'],
    ['Termination', '30 days’ notice'], ['Signatory', 'J. Okafor'], ['Signed on', '28/03/2026']]],
  ['Ops', [['Deliver to', 'Unit 4, Quay Road'], ['Site', 'Kitchen 2'], ['Delivery date', '06/10/2026'], ['Items', '3'], ['Quantity', '14 cases'], ['SKU', 'PT-25'],
    ['Received by', 'S. Byrne'], ['Condition', 'Good'], ['Temperature', '4°C'], ['Batch', '2291-B'], ['Use by', '14/10/2026'], ['Storage', 'Chilled'], ['Allergens', 'None']]],
]
const NF = FORM.reduce((a, [, f]) => a + f.length, 0)          // 47
/* the form's sections and fields, into a parent; cols per frame */
function formBody(parent, cols) {
  const fields = [], secs = []
  FORM.forEach(([name, fs]) => {
    const sec = h('div', 'd-sec', parent, `<div class="sh"><i></i>${name}<b>${fs.length} fields</b></div>`)
    const gr = h('div', 'gr', sec); gr.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
    secs.push(sec)
    fs.forEach(([lb, v]) => {
      const e = h('div', 'd-fd', gr, `<div class="lb">${lb}</div><div class="bx"><span class="v">${v}</span><span class="ok">${CHECK(12)}</span></div>`)
      fields.push({ e, v: e.querySelector('.v'), ok: e.querySelector('.ok'), sec })
    })
  })
  return { fields, secs }
}

/* ============================================================
   FIELDS: one document, and 47 fields to fill, stacking up on the plucks
   ============================================================ */
// [beat, fields in the group]: 2, 4, 9, 14, 20 (finance done), 27, 34 (legal done), 47 (ops)
const GROUPS = [[.5, 2], [1, 2], [2, 5], [2.5, 5], [3, 6], [3.5, 7], [4, 7], [5, 13]]
function buildFields(s) {
  widen(s)
  const t0 = s.t0
  const WW = M({ land: 1100, sq: 940, tall: 960, port: 980 }) / Z0, COLS = M({ land: 3, def: 2 })
  const TOP = M({ land: -176, sq: -150, tall: -246, port: -420 }) / Z0, BOT = M({ land: 520, sq: 520, tall: 655, port: 900 }) / Z0
  const WX = LAND ? 250 : 0
  const doc = sheet(s.cam, 'Supplier pack')
  const win = h('div', 'd-win d-glass', s.cam, `<div class="bar"><span class="sq"></span><span>New supplier</span><span class="ct"><span class="n">0</span> of ${NF} fields</span></div><div class="vp"><div class="sc"></div></div>`)
  win.style.width = WW + 'px'
  const vp = win.querySelector('.vp'), sc = win.querySelector('.sc'), ctn = win.querySelector('.ct .n')
  const { fields } = formBody(sc, COLS)
  const capA = cap(s.hud, `One document${STOP}`), capB = cap(s.hud, `${NF} fields to fill${STOP}`)
  // when each field turns up
  const show = []; GROUPS.forEach(([b, n]) => { for (let j = 0; j < n; j++) show.push(bt(b) - .01 + j * .018) })
  GROUPS.forEach(([b, n], i) => { cue('pop', bt(b), { v: .3 + .02 * n }); if (n > 6) cue('tick', bt(b) + .05, { v: .25 }) })
  cue('paper', bt(0), { v: .6 })
  let LY = null
  return t => {
    if (!LY) {
      vp.style.height = (BOT - TOP - win.querySelector('.bar').offsetHeight) + 'px'
      LY = fields.map(f => f.e.offsetTop + f.e.offsetParent.offsetTop + f.e.offsetHeight)   // each field's bottom in the scroller
      LY.vh = vp.offsetHeight
    }
    // the document lands on the first pluck; in the narrow frames it goes into the form's corner as the fields start
    const dl = P(t, bt(0) - .26, bt(0), E.lin), dg = LAND ? 0 : P(t, bt(.5) - .05, bt(.5) + .25, E.io)
    const dx = LAND ? -650 : 0, dy = LAND ? 90 : MIDY
    put(doc, { x: lerp(-W / 2 - 300, dx, E.out2(dl)) + dg * (-WW / 2 + 60), y: lerp(dy + 260, dy, dl) - 200 * Math.sin(Math.PI * dl) + dg * (TOP + 40 - dy), r: lerp(-60, -5, dl) - 6 * dg,
      s: (LAND ? 1.25 : 1.35) * lerp(1, .3, dg) * (1 + .05 * bell(t, bt(0), bt(0) + .03, bt(0) + .2)), o: (t >= bt(0) - .26 ? 1 : 0) * (1 - P(dg, .7, 1, E.lin)) })
    // the form, and its fields stacking up on the plucks; it scrolls to keep the newest in view
    const wi = P(t, bt(.5) - .06, bt(.5) + .2, E.out)
    put(win, { x: WX, y: (TOP + BOT) / 2 + (1 - wi) * 40, o: wi, blur: (1 - wi) * 12 })
    let n = 0, last = 0
    fields.forEach((f, i) => {
      const a = P(t, show[i], show[i] + .16, E.out)
      f.e.style.opacity = a.toFixed(3); f.e.style.transform = `translateY(${((1 - a) * 18).toFixed(1)}px) scale(${lerp(.94, 1, a).toFixed(3)})`
      f.v.style.opacity = 0; f.ok.style.opacity = 0
      if (t >= show[i]) { n = i + 1; last = show[i] }
    })
    ctn.textContent = n
    let y = 0
    GROUPS.forEach(([b], g) => {
      const k = GROUPS.slice(0, g + 1).reduce((a, x) => a + x[1], 0) - 1
      const target = Math.max(0, LY[k] - LY.vh + 34)
      y = lerp(y, target, P(t, bt(b) - .02, bt(b) + .28, E.out))
    })
    sc.style.transform = `translateY(${(-y).toFixed(1)}px)`
    capAt(capA, t, bt(0), bt(2))
    capAt(capB, t, bt(2), null)
    // a little jolt with each group
    let jolt = 0; GROUPS.forEach(([b, nn]) => { jolt += bell(t, bt(b) - .01, bt(b) + .02, bt(b) + .2) * Math.min(1, .3 + nn * .05) })
    s.rig.style.transform = `scale(${(1 + .012 * jolt).toFixed(4)})`
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1.04], [s.t1, 0, 0, 0, 0, 0, 0, 1]]), t)
    lens(s, {})
  }
}

/* ============================================================
   TYPE: the silence. A VAT number, a key at a time; One. At. A. Time.
   ============================================================ */
function buildType(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const KEYS = [t0 + .12, t0 + .36, t0 + .6, t0 + .84], TXT = ['G', 'GB', 'GB 2', 'GB 24']
  const form = h('div', 'd-form d-glass', s.cam, `<div class="hd"><span>Field 7 of ${NF}</span><span class="pr"><i></i>By hand</span></div>
    <div class="lb">VAT number</div><div class="in"><span class="tx"></span><span class="caret"></span></div>
    <div class="gh"><div></div><div></div></div>`)
  const tx = form.querySelector('.tx'), caret = form.querySelector('.caret')
  const line = wordLine(s.hud, ['One.', 'At.', 'A.', `Time${STOP}`])
  KEYS.forEach(k => cue('key', k, { v: 2.4 }))
  return t => {
    let n = 0; KEYS.forEach(k => { if (t >= k) n++ })
    tx.textContent = n ? TXT[n - 1] : ''
    const since = n ? t - KEYS[n - 1] : t - t0
    caret.style.opacity = since < .12 || (since % .5) < .28 ? 1 : 0
    put(form, { y: MIDY + 10, s: M({ land: 1.06, def: 1 }) }); shield(form, .6)
    line.at(t, KEYS, { y: CAPY })
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 30, 0, 0, 0, 0, 1.07]]), t)
    lens(s, {})
  }
}

/* ============================================================
   LOOP: Copy. Paste. Check. Repeat., a word a pluck; then again, and again
   ============================================================ */
function buildLoop(s) {
  widen(s)
  const t0 = s.t0
  const W4 = ['Copy.', 'Paste.', 'Check.', `Repeat${STOP}`], T4 = [bt(7.5), bt(8), bt(8.5), bt(9)]
  const AGAIN = [bt(10), bt(10.5), bt(11), bt(11.5), bt(12)]
  const SZ = M({ land: 150, def: 118 }), LH = SZ * 1.16
  const ROWS = LAND ? [[0, 1, 2, 3]] : [[0, 1], [2, 3]], NR = ROWS.length, BH = NR * LH     // a block: the whole line, on one row or two
  const ry = r => (r - (NR - 1) / 2) * LH
  const first = ROWS.map(ix => wordLine(s.cam, ix.map(i => W4[i]), SZ))
  const more = AGAIN.map(() => ROWS.map(ix => { const e = cap(s.cam, ix.map(i => W4[i]).join(' '), SZ); Object.assign(e.style, { maxWidth: 'none', whiteSpace: 'nowrap' }); return e }))
  const chip = h('div', 'd-chip', s.hud, `<span class="sq"></span><span>Field <b>8</b> of ${NF}</span>`), cb = chip.querySelector('b')
  ;['click', 'pop', 'tick', 'swish'].forEach((k, i) => cue(k, T4[i], { v: .5 }))
  AGAIN.forEach(a => { cue('flip', a - .01, { v: .55 }); cue('tick', a + .02, { v: .3 }) })
  const FADE = [1, .42, .24, .14, .08, .05], fa = a => { if (a <= 0) return 1; const i = Math.min(4, Math.floor(a)); return lerp(FADE[i], FADE[i + 1], a - i) }
  return t => {
    // each repeat brings the whole line in at the bottom and pushes the rest up, dimmer
    let k = 0, push = 0
    AGAIN.forEach((a, i) => { const p = P(t, a - .03, a + .2, E.out); push += p; if (t >= a - .03) k = i + 1 })
    const Y0 = M({ land: 10, def: 0 })
    first.forEach((e, r) => e.at(t, ROWS[r].map(i => T4[i]), { y: Y0 + ry(r) - push * BH, o: fa(push) }))
    more.forEach((blk, i) => {
      const p = P(t, AGAIN[i] - .03, AGAIN[i] + .2, E.out), age = push - (i + 1)
      blk.forEach((e, r) => {
        put(e, { y: Y0 + ry(r) + BH - p * BH - Math.max(0, age) * BH, o: p * fa(age), blur: (1 - p) * 12, s: lerp(1.04, 1, p) })
        if (p > .5 && age <= .5) shield(e)
      })
    })
    cb.textContent = 8 + k
    const kb = k ? bell(t, AGAIN[k - 1] - .02, AGAIN[k - 1] + .03, AGAIN[k - 1] + .22) : 0
    blurIn(chip, t, t0 + .02, { y: TOPY, dur: .3, s0: 1, blur: 10, dy: -14, s: 1 + .1 * kb }); shield(chip, .7)
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1.02], [bt(9.5), 0, 0, 0, 0, 0, 0, 1], [s.t1, 0, 0, 0, 0, 0, 0, 1.04]]), t)
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
   FIX: the drop. The same form, all of it, fills itself in one wave;
   every field, filled; sent to finance and legal; 47 fields, none typed
   ============================================================ */
const FOLDER = '<svg viewBox="0 0 64 52"><path d="M2 8a6 6 0 016-6h14l6 7h28a6 6 0 016 6v29a6 6 0 01-6 6H8a6 6 0 01-6-6z" fill="rgba(240,231,216,.05)" stroke="#DED2C0" stroke-width="2.5"/><rect x="45" y="35" width="8" height="8" fill="#E9AC57"/></svg>'
const T_FILL = bt(15), T_SEND = bt(17), T_DONE = bt(19)
function buildFix(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const OW = M({ land: 1720, sq: 1000, tall: 1000, port: 1000 }) / Z0, OC = M({ land: 6, def: 4 })
  const ov = h('div', 'd-ov d-glass', s.cam, `<div class="bar"><span class="sq"></span><span>New supplier</span><span class="ct"><span class="n">0</span> of ${NF} fields</span></div><div class="body"></div>`)
  ov.style.width = OW + 'px'
  const ctn = ov.querySelector('.ct .n')
  const { fields } = formBody(ov.querySelector('.body'), OC)
  fields.forEach(f => f.e.classList.add('ai'))
  // the wave: a field every 1/86 of a second, top to bottom, from just after the drop
  const fillAt = i => t0 + .05 + i * (B * .95 / NF)
  const cards = FORM.map(([name, fs]) => h('div', 'd-folder d-glass', s.cam, `<div class="ic">${FOLDER}</div><div class="nm">${name}</div><div class="ct"><span class="n">${fs.length} fields</span><span class="ok">${CHECK(22)}</span></div>`))
  cards.forEach(c => { const n = c.querySelector('.n'); n.style.fontSize = '40px'; n.style.fontWeight = 400 })
  const cok = cards.map(c => c.querySelector('.ok'))
  const FK = M({ land: 1, sq: .82, tall: .84, port: 1.04 })
  const FP = M({ land: [[-420, 0], [0, 0], [420, 0]], sq: [[-330, 0], [0, 0], [330, 0]], tall: [[-330, 0], [0, 0], [330, 0]], port: [[0, -300], [0, 0], [0, 300]] }).map(([x, y]) => [x, MIDY + y + M({ land: 20, def: 30 })])
  const capA = cap(s.hud, `Every field, filled${STOP}`)
  const capB = cap(s.hud, `Sent to finance and legal${STOP}`)
  const capC = cap(s.hud, `${NF} fields. None typed${STOP}`)
  cue('whoosh', t0 + .02, { d: .4, v: .5 })
  cue('scan', t0 + .05, { d: B * .95 })
  cue('confirm', T_FILL, { n: 2, deg: 3, v: .5 })
  cue('swish', T_SEND, { v: .45 })
  FORM.forEach((_, i) => cue('pop', T_SEND + .06 * i, { v: .3 }))
  cue('confirm', T_DONE, { n: 3, deg: 2, v: .6 })
  let OH = null
  return t => {
    if (!OH) OH = ov.offsetHeight
    // the whole form, fitted to the frame below the caption
    const room = M({ land: 700, sq: 700, tall: 900, port: 1300 }) / Z0, k = Math.min(1, room / OH)
    const oy = M({ land: 175, sq: 180, tall: 210, port: 130 }) / Z0
    const jump = bell(t, t0 - .01, t0 + .05, t0 + .25), gone = P(t, T_SEND - .06, T_SEND + .2, E.in2)
    put(ov, { y: oy, s: k * (1 + .04 * jump) * lerp(1, .86, gone), o: P(t, t0 - .01, t0 + .06) * (1 - gone), blur: gone * 14 })
    // every field fills, in a wave from the top
    let n = 0
    fields.forEach((f, i) => {
      const a = fillAt(i), p = P(t, a, a + .12, E.out)
      f.v.style.opacity = p.toFixed(3); f.ok.style.opacity = p > 0 ? 1 : 0; f.ok.style.transform = `scale(${P(t, a, a + .16, E.back).toFixed(3)})`
      f.e.classList.toggle('ai', t >= a); f.e.style.opacity = 1; f.e.style.transform = ''
      if (t >= a) n = i + 1
    })
    ctn.textContent = n
    // sent: the form goes out to the people who need it
    cards.forEach((c, i) => {
      const a = T_SEND + .06 * i
      blurIn(c, t, a - .02, { x: FP[i][0], y: FP[i][1], s: FK * (1 + .05 * bell(t, T_DONE + i * .05, T_DONE + i * .05 + .04, T_DONE + i * .05 + .25)), dur: .3, s0: .9, blur: 12, dy: 40 })
      const ck = P(t, T_DONE + i * .05, T_DONE + i * .05 + .25, E.back); cok[i].style.transform = `scale(${ck.toFixed(3)})`; cok[i].style.opacity = ck > 0 ? 1 : 0
    })
    // a line a clap
    capAt(capA, t, T_FILL, T_SEND)
    capAt(capB, t, T_SEND, T_DONE)
    capAt(capC, t, T_DONE, null)
    s.rig.style.transform = `scale(${(1 + .03 * jump).toFixed(4)})`
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1.03], [T_SEND, 0, 0, 0, 0, 0, 0, 1], [T_DONE, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 0, 0, 0, 0, 0, 1.05]]), t)
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
    [0, G.open], [bt(2), G.open], [at('type') - .02, G.heat], [at('type'), G.quiet], [at('loop') - .02, G.quiet], [at('loop'), G.heat], [bt(10), G.peak], [at('flash') - .02, G.peak],
    [at('flash'), G.dark], [HITS[1] - .01, G.dark], [HITS[1] + .2, G.glassIn], [at('fix') - .02, G.glassIn],
    [at('fix') + .3, G.fix1], [T_FILL, G.fix2], [T_SEND, G.fix3], [T_DONE - .1, G.fix3], [T_DONE + .3, G.done], [at('end') - .02, G.done],
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
  scene(['fields'], buildFields)
  scene(['type'], buildType)
  scene(['loop'], buildLoop)
  scene(['flash'], buildFlash)
  scene(['fix'], buildFix)
  scene(['end'], buildEnd)
  scene(['fields', 'end'], buildGround, { hold: 1 })                   // last, so the words have been placed
  const ground = [[0, .5, .5, 0, .5, .5, 0, 0], [TL.duration, .5, .5, 0, .5, .5, 0, 0]]
  return { ground, bug: ['end', 'end'] }
}
