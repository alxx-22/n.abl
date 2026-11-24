/* ============================================================
   THE DOCS REEL: n.abl's Document AI, in 16 seconds

   Daylight: warm paper, ink, the amber of the full stop, and the product's
   interface drawn in the site's own type and driven by a cursor. Each
   moment hands its shape to the next.

   hook   the site's line, kinetic: a highlighted word rolls through
          Invoices, Delivery notes, Forms, and lands on Paperwork, as
          ", read and filed." builds beside it and ends on the square stop
   drop   three documents dragged into Drop in your paperwork; on the
          track's silent beat the drop zone folds into Reading 3 documents
   read   the pill opens into the invoice; a line of light reads it, its
          fields light up and fly into the record; matched to the order;
          the handwritten +2 is flagged, and a person approves it
   table  on the drop the camera slams back: the record is row one of the
          paperwork, and the rest read and file on the sixteenths
   count  into the counter: the documents read, files floating past
   brand  the n. drawn a stroke a beat over four backdrops
   end    the name, Document AI, Paperwork, read and filed., the address
   The script is films/docs/film.py; the brief is films/docs/SCRIPT.md.
   ============================================================ */

import { E, M, P, TL, LAND, WORDMARK, bell, cue, h, icon, lerp, offs, put, rise, scene, vis } from '../../film/stage.js'
import { blurIn, drop, lens, path, shoot, widen } from '../../film/kit.js'

const B = TL.beat, OFF = 0.304
const bt = k => OFF + k * B                               // the track's own beat k (its first is 0.304 s in)
const PORT = !LAND
const paper = (s, grey) => { const e = h('div', 'layer d-paper' + (grey ? ' grey' : '')); s.root.insertBefore(e, s.rig); return e }
const CURSOR = `<svg width="40" height="40" viewBox="0 0 40 40"><path d="M6 3 L6 31 L13.5 24 L18.5 35.5 L23.5 33.3 L18.6 22.2 L28.5 22.2 Z" fill="#17130F" stroke="#FBF8F2" stroke-width="2.4" stroke-linejoin="round"/></svg>`
/* the cursor, its tip at (x, y) from the middle; pressed, it shrinks to its tip */
function cursor(parent) { const e = h('div', 'd-cur', parent, CURSOR); e.style.transformOrigin = '6px 3px'; return e }
function aim(e, x, y, o = 1, press = 0) {
  e.style.transform = `translate3d(${(x - 6).toFixed(1)}px,${(y - 3).toFixed(1)}px,0) scale(${(1 - .16 * press).toFixed(3)})`
  vis(e, o)
}
/* the centre of an element inside a box placed (by put) at (bx, by) with scale k, in the world */
const at = (e, box, bx, by, k = 1) => { const o = offs(e, box); return [bx + (o.x + o.w / 2 - box.offsetWidth / 2) * k, by + (o.y + o.h / 2 - box.offsetHeight / 2) * k] }
const CHECK = '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/* ============================================================
   HOOK: the site's line, with its first word rolling
   ============================================================ */
function buildHook(s) {
  widen(s); paper(s)
  const t0 = s.t0, t1 = s.t1
  const WORDS = ['Invoices', 'Delivery notes', 'Forms', 'Paperwork'], REST = ['read', 'and', 'filed']
  const line = h('div', 'd-line', s.cam); line.style.fontSize = M({ land: 108, sq: 92, tall: 96, port: 92 }) + 'px'
  if (PORT) line.style.flexDirection = 'column'
  const rowA = h('span', 'w', line), rowB = h('span', 'w', line)
  ;[rowA, rowB].forEach(r => Object.assign(r.style, { display: 'inline-flex', alignItems: 'center', gap: '.26em' }))
  if (LAND) rowB.style.display = 'none'
  const chip = h('span', 'd-chip', rowA, `<span class="bg"></span><span class="ic">${icon('doc')}</span><span class="win"><span class="strip">${WORDS.map(w => `<div style="width:max-content">${w}</div>`).join('')}</span></span>`)
  const comma = h('span', 'w', rowA, ','); comma.style.marginLeft = '-.3em'
  const ws = REST.map(w => h('span', 'w', LAND ? rowA : rowB, w))
  const stop = h('span', 'd-stop', ws[2])
  const bg = chip.querySelector('.bg'), win = chip.querySelector('.win'), strip = chip.querySelector('.strip'), ic = chip.querySelector('.ic')
  const tw = [bt(1), bt(2), bt(3)]                         // the word rolls on these beats, and a word of the line lands
  cue('pop', t0 + .1, { v: .4 })
  tw.forEach((t, i) => { cue('tick', t, { v: .5 }); cue('swish', t + .02, { v: .2 }) })
  drop(bt(3) + .14, 4, { wet: .25, v: .5 })                // the full stop
  cue('whoosh', t1 - .05, { d: .4, v: .35 })
  let L = null
  return t => {
    if (!L) L = { lh: win.offsetHeight, w: [...strip.children].map(d => d.offsetWidth), ww: ws.map(e => e.offsetWidth), gap: parseFloat(getComputedStyle(rowA).columnGap) || 0 }
    // the strip rolls up a word on each beat, settling with a little overshoot; the window fits the word
    let k = 0; tw.forEach(b => { k += P(t, b - .03, b + .26, E.snap) })
    strip.style.transform = `translateY(${(-k * L.lh).toFixed(1)}px)`
    const i = Math.min(2, Math.floor(k)), f = k - i
    win.style.width = lerp(L.w[i], L.w[Math.min(3, i + 1)], Math.min(1, f)).toFixed(1) + 'px'
    strip.style.filter = bell(t, tw[0] - .03, tw[0] + .05, tw[0] + .2) + bell(t, tw[1] - .03, tw[1] + .05, tw[1] + .2) + bell(t, tw[2] - .03, tw[2] + .05, tw[2] + .2) > .05 ? 'blur(2px)' : 'none'
    // the words of the line arrive on the same beats; the line stays centred on what is showing
    let hidden = 0
    ws.forEach((e, j) => { const a = P(t, tw[j] - .02, tw[j] + .3, E.out); rise(e, t, tw[j] - .02, { dur: .3, dy: 26, blur: 12 }); hidden += (1 - E.io(Math.min(1, a))) * (L.ww[j] + L.gap) })
    const sp = P(t, bt(3) + .12, bt(3) + .42, E.back); stop.style.transform = `scale(${sp.toFixed(3)})`; vis(stop, sp > 0 ? 1 : 0)
    bg.style.opacity = (1 - .85 * P(t, bt(3.5), bt(4) - .1)).toFixed(3)
    ic.style.opacity = (1 - P(t, bt(3.5), bt(4) - .1)).toFixed(3)
    const out = P(t, t1 - .22, t1, E.in2)
    put(line, { x: LAND ? hidden / 2 : 0, y: (1 - P(t, t0, t0 + .35, E.out)) * 18, s: lerp(.96, 1, P(t, t0, t0 + .4, E.out)) * (1 + .06 * out), o: Math.min(1, P(t, t0, t0 + .25) * 1.5) * (1 - out), blur: (1 - P(t, t0, t0 + .3)) * 14 + out * 16 })
    if (PORT) rowB.style.transform = `translateX(${(hidden / 2).toFixed(1)}px)`
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 0, 30, 0, 0, 0, 1]]), t)
    lens(s, {})
  }
}

/* ============================================================
   DROP: three documents into the drop zone; on the silent beat, it folds
   into the reading pill
   ============================================================ */
const PILL = [470, 92]
function buildDrop(s) {
  widen(s); paper(s)
  const t0 = s.t0, t1 = s.t1
  const ZW = M({ land: 780, def: 700 }), ZH = 330
  const zone = h('div', 'd-zone', s.cam, `<div class="t">Drop in your paperwork</div><div class="s">Invoices, delivery notes, forms</div>
    <div class="t n" style="position:absolute">3 documents</div><div class="pill"><span class="d-spin"></span><span>Reading 3 documents</span></div>`)
  const [zt, zs, zn] = zone.querySelectorAll('.t, .s'), pill = zone.querySelector('.pill'), spin = zone.querySelector('.d-spin')
  const lines = (n, a) => Array.from({ length: n }, (_, i) => `<i class="${i === a ? 'a' : ''}" style="width:${[92, 70, 84, 58, 76, 64, 88][i % 7]}%"></i>`).join('')
  const docs = [['INVOICE', -9, -34, 14], ['DELIVERY NOTE', 4, 10, -6], ['FORM', 13, 44, 10]].map(([k, r, dx, dy]) => ({ e: h('div', 'd-doc', s.cam, `<div class="h">${k}</div>${lines(9, 3)}`), r, dx, dy }))
  const cur = cursor(s.cam)
  const tIn = t0 + .05, tDrop = bt(5.5), tFold = bt(6)
  const from = M({ land: [760, 420], sq: [520, 520], tall: [520, 600], port: [500, 760] })
  cue('whoosh', tIn + .2, { d: .6, v: .35 })
  cue('paper', tIn + .35, { v: .5 })
  cue('pop', tDrop, { v: .5 }); drop(tDrop + .03, 3, { wet: .3, v: .45 })
  cue('confirm', tDrop + .22, { n: 2, deg: 2, v: .3 })
  cue('swish', tFold + .05, { v: .25 })                     // the zone folds into the pill, in the track's silence
  return t => {
    // the zone, and how far it has folded into the pill
    const z = blurIn(zone, t, tIn, { dur: .4, s0: .94, blur: 14, dy: 16 })
    const fo = P(t, tFold, tFold + .4, E.io)
    const lit = bell(t, tDrop, tDrop + .06, tDrop + .5)
    Object.assign(zone.style, { width: lerp(ZW, PILL[0], fo) + 'px', height: lerp(ZH, PILL[1], fo) + 'px', borderRadius: lerp(28, PILL[1] / 2, fo) + 'px',
      borderColor: `rgba(${Math.round(lerp(227, 233, lit))},${Math.round(lerp(218, 172, lit))},${Math.round(lerp(203, 87, lit))},1)`,
      background: lit > .02 ? `rgb(${Math.round(lerp(242, 248, lit))},${Math.round(lerp(236, 227, lit))},${Math.round(lerp(226, 189, lit))})` : '' })
    const sw = P(t, tDrop + .08, tDrop + .3, E.out)
    ;[zt, zs].forEach(e => { e.style.opacity = ((1 - sw) * (1 - fo)).toFixed(3); e.style.transform = `translateY(${(-sw * 30).toFixed(1)}px)` })
    zn.style.opacity = (sw * (1 - P(t, tFold, tFold + .15))).toFixed(3); zn.style.transform = `translateY(${((1 - sw) * 30).toFixed(1)}px)`
    pill.style.opacity = P(t, tFold + .2, tFold + .4).toFixed(3)
    spin.style.transform = `rotate(${(t * 420).toFixed(1)}deg)`
    // the stack, carried in on the cursor and dropped
    const m = P(t, tIn + .1, tDrop, E.io), dp = P(t, tDrop, tDrop + .28, E.in2)
    const cx = lerp(from[0], 0, m), cy = lerp(from[1], 0, m) - 60 * Math.sin(Math.PI * m)
    docs.forEach((d, i) => put(d.e, { x: cx + d.dx * (1 - dp), y: cy + d.dy * (1 - dp) + dp * 20, r: d.r * (1 - .5 * dp) + 4 * Math.sin(t * 2 + i) * (1 - m), s: lerp(1, .35, dp), o: P(t, tIn, tIn + .2) * (1 - dp) }))
    const leave = P(t, tDrop + .05, tDrop + .55, E.io)
    aim(cur, cx + 30 + leave * 300, cy - 60 + leave * 240, P(t, tIn + .05, tIn + .25) * (1 - P(t, tDrop + .3, tDrop + .55)), bell(t, tDrop - .02, tDrop, tDrop + .12))
    put(zone, { y: 16 * (1 - z), s: lerp(.94, 1, z) * (1 + .04 * lit) * (1 + .5 * P(t, t1 - .1, t1, E.in2)), o: Math.min(1, z * 1.6), blur: (1 - z) * 14 })
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [tFold, 0, 0, 40, 0, 0, 0, 1], [t1, 0, 0, 60, 0, 0, 0, 1]]), t)
    lens(s, {})
  }
}

/* ============================================================
   READ: the invoice, read by a line of light, its fields into the record;
   matched to the order; a person approves the line it was unsure of
   ============================================================ */
const INV = `
  <div class="top"><div><div class="sup f" data-k="sup">Harbour Foods Ltd</div><div class="ad">Unit 4, Quay Road</div></div><div class="kind">INVOICE</div></div>
  <div class="meta"><div><span>Invoice</span><b class="f" data-k="no">INV-2291</b></div><div><span>Date</span><b class="f" data-k="date">3 Oct 2026</b></div><div><span>Order</span><b class="f" data-k="po">PO-0417</b></div></div>
  <div class="it"><span>Plum tomatoes, 2.5 kg</span><span class="f" data-k="qty">12 cases</span><b>£186.00</b><span class="hw">+2</span></div>
  <div class="it"><span>Olive oil, 5 L</span><span>6 tins</span><b>£214.20</b></div>
  <div class="it"><span>Flour, 16 kg</span><span>10 sacks</span><b>£142.50</b></div>
  <div class="tot"><div>Net<b>£542.70</b></div><div>VAT<b>£0.00</b></div><div class="g">Total<b class="f" data-k="tot">£542.70</b></div></div>`
const REC = [['sup', 'Supplier', 'Harbour Foods Ltd', ''], ['no', 'Invoice', 'INV-2291', 'm'], ['date', 'Date', '3 Oct 2026', ''], ['po', 'Order', 'PO-0417', 'm'], ['tot', 'Total', '£542.70', 'm'], ['qty', 'Quantity', '14 cases', '']]
function buildRead(s) {
  widen(s); paper(s)
  const t0 = s.t0, t1 = s.t1
  const inv = h('div', 'd-inv', s.cam, INV)
  const rec = h('div', 'd-rec', s.cam, `
    <div class="hd"><span class="av"><svg width="20" height="20" viewBox="-10 -10 20 20"><path d="M0 -10 C1 -2.5 2.5 -1 10 0 C2.5 1 1 2.5 0 10 C-1 2.5 -2.5 1 -10 0 C-2.5 -1 -1 -2.5 0 -10 Z" fill="#E9AC57"/></svg></span>
      <div><div class="t">Document AI</div><div class="s">Supplier invoices</div></div><span class="st d-tag read">READING</span></div>
    ${REC.map(([k, l, v, m]) => `<div class="row" data-k="${k}"><span class="k">${l}</span><span class="v ${m}"><span class="sk"></span><span class="val" style="opacity:0">${v}</span></span><span class="ck">${CHECK}</span></div>`).join('')}
    <div class="flag"><span class="q">Handwritten: +2 cases</span><span class="n">Not sure. Is it 14?</span><span class="btn">Approve</span></div>`)
  const st = rec.querySelector('.st'), flag = rec.querySelector('.flag'), btn = flag.querySelector('.btn'), fq = flag.querySelector('.q'), fn = flag.querySelector('.n')
  const rows = REC.map(([k]) => { const r = rec.querySelector(`[data-k="${k}"]`); return { k, r, sk: r.querySelector('.sk'), val: r.querySelector('.val'), ck: r.querySelector('.ck') } })
  const fields = REC.map(([k]) => inv.querySelector(`.f[data-k="${k}"]`))
  const hls = fields.map(() => h('div', 'd-hl', inv)); hls.forEach(e => inv.insertBefore(e, inv.firstChild))
  const scan = h('div', 'd-scan', inv)
  const flys = REC.map(([, , v]) => h('div', 'd-fly', s.cam, v))
  const qtyRow = rows[5]
  const cur = cursor(s.cam)
  // side by side, except in the tallest frame, where the record sits under the invoice
  const IX = M({ land: -400, sq: -232, tall: -222, port: 0 }), IY = M({ land: 0, sq: 0, tall: 0, port: -410 }), RX = M({ land: 380, sq: 228, tall: 218, port: 0 }), RY = M({ land: 0, sq: 0, tall: 0, port: 440 })
  const IK = M({ land: 1.18, sq: .74, tall: .7, port: 1 }), RK = M({ land: 1.18, sq: .78, tall: .74, port: 1.06 })
  const tScan0 = bt(7.5), tScan1 = bt(9), tFly = bt(9.1), tMatch = bt(11), tFlag = bt(10.6), tClick = bt(12)
  cue('swish', t0 + .02, { v: .3 })
  cue('scan', tScan0, { d: tScan1 - tScan0 })
  cue('whoosh', tFly - .05, { d: .5, v: .25 })
  REC.forEach((_, i) => cue('blip', tFly + i * B / 4 + .3, { v: .35 }))
  cue('confirm', tMatch, { n: 2, deg: 3, v: .45 })
  cue('tick', tFlag, { v: .4 })
  cue('click', tClick)
  drop(tClick + .06, 5, { wet: .3, v: .5 })
  let L = null
  function layout() {
    const iw = inv.offsetWidth, ih = inv.offsetHeight
    L = {
      ih, hl: fields.map(f => { const o = offs(f, inv); return [o.x - 6, o.y - 3, o.w + 12, o.h + 6] }),
      from: fields.map(f => at(f, inv, IX, IY, IK)),
      to: rows.map(r => at(r.val, rec, RX, RY, RK)),
      btn: at(btn, rec, RX, RY, RK),
    }
    L.hl.forEach((b, i) => Object.assign(hls[i].style, { left: b[0] + 'px', top: b[1] + 'px', width: b[2] + 'px', height: b[3] + 'px' }))
    L.camA = [IX * .9, IY * .9]
  }
  return t => {
    if (!L) layout()
    // the invoice opens out of the pill; the record slides in beside it
    const op = P(t, t0, t0 + .42, E.out)
    put(inv, { x: IX * lerp(.0, 1, op), y: IY * lerp(.0, 1, op), s: IK * lerp(.35, 1, op), o: Math.min(1, op * 2.5), blur: (1 - op) * 6 })
    blurIn(rec, t, t0 + .22, { x: RX, y: RY, s: RK, dur: .4, s0: .96, blur: 14, dx: RX ? 60 : 0, dy: RX ? 0 : 60 })
    // the line of light reads down the page; each field lights as it passes
    const sp = P(t, tScan0, tScan1, E.io)
    scan.style.top = (lerp(-90, L.ih, sp)).toFixed(1) + 'px'; scan.style.opacity = (P(t, tScan0, tScan0 + .08) * (1 - P(t, tScan1 - .1, tScan1))).toFixed(3)
    L.hl.forEach((b, i) => {
      const ta = tScan0 + (b[1] + b[3]) / (L.ih + 90) * (tScan1 - tScan0)
      const a = P(t, ta, ta + .12, E.out) * (1 - .55 * P(t, tFly + i * B / 4 + .3, tFly + i * B / 4 + .6))
      hls[i].style.opacity = a.toFixed(3); hls[i].style.transform = `scale(${lerp(.85, 1, P(t, ta, ta + .15, E.back)).toFixed(3)})`
    })
    // the values fly across into the record, one a sixteenth
    REC.forEach((_, i) => {
      const a = tFly + i * B / 4, u = P(t, a, a + .32, E.io)
      const f = L.from[i], g = L.to[i]
      put(flys[i], { x: lerp(f[0], g[0], u), y: lerp(f[1], g[1], u) - 50 * Math.sin(Math.PI * u), s: lerp(IK, RK, u) * (1 + .12 * Math.sin(Math.PI * u)), o: t >= a && u < 1 ? 1 : 0 })
      const done = t >= a + .32
      rows[i].sk.style.display = done ? 'none' : ''; rows[i].val.style.opacity = done ? 1 : 0
      const c = P(t, a + .32, a + .5, E.back); rows[i].ck.style.transform = `scale(${c.toFixed(3)})`; rows[i].ck.style.opacity = c > 0 ? 1 : 0
      if (i === 5) rows[i].ck.style.background = t >= tClick + .04 ? '' : '#F8E3BD', rows[i].ck.style.color = t >= tClick + .04 ? '' : '#8A5A12'
    })
    // matched to the order
    const mt = t >= tMatch
    st.className = 'st d-tag ' + (mt ? 'ok' : 'read'); st.innerHTML = mt ? `${CHECK} MATCHED TO PO-0417` : 'READING'
    st.style.transform = `scale(${(1 + .12 * bell(t, tMatch, tMatch + .05, tMatch + .35)).toFixed(3)})`
    // the line it is unsure of, flagged; a person approves it
    const fl = P(t, tFlag, tFlag + .3, E.out)
    flag.style.opacity = fl.toFixed(3); flag.style.transform = `translateY(${((1 - fl) * 14).toFixed(1)}px)`
    const ok = t >= tClick + .04
    flag.style.background = ok ? '#DCEBD8' : ''
    fq.textContent = ok ? 'Approved: 14 cases' : 'Handwritten: +2 cases'; fq.style.color = ok ? '#3F7A45' : ''
    fn.textContent = ok ? 'Checked by you, filed with the invoice' : 'Not sure. Is it 14?'
    btn.style.opacity = ok ? 0 : 1
    btn.style.transform = `scale(${(1 - .08 * bell(t, tClick - .03, tClick, tClick + .15)).toFixed(3)})`
    qtyRow.r.style.background = ok ? '' : (t > tFly + 5 * B / 4 + .3 ? 'rgba(248,227,189,.35)' : '')
    // the cursor comes up to Approve and clicks it on the beat
    const cm = P(t, bt(11.1), tClick - .04, E.io)
    const st0 = [L.btn[0] + 260, L.btn[1] + 240]
    aim(cur, lerp(st0[0], L.btn[0] + 10, cm), lerp(st0[1], L.btn[1] + 8, cm), P(t, bt(11.1), bt(11.1) + .15) * (1 - P(t, tClick + .35, tClick + .55)), bell(t, tClick - .03, tClick, tClick + .14))
    // the camera: close on the invoice, across to both, in on the record, then back for the drop
    const cam = path([
      [t0, L.camA[0], L.camA[1], 120, 0, 0, 0, 1],
      [bt(9), L.camA[0] * .5, L.camA[1] * .5, 70, 0, 2, 0, 1],
      [bt(10.5), RX * .25, RY * .25, 40, 0, -1, 0, 1],
      [tClick, RX * .5, RY * .5, 110, 0, -2, 0, 1],
      [t1, RX * .35, RY * .35, 40, 0, 0, 0, 1],
    ])
    const mb = shoot(s, cam, t)
    lens(s, { mbX: mb.mbX, mbY: mb.mbY })
  }
}

/* ============================================================
   TABLE: on the drop, pulled back: the record is row one of the paperwork,
   and the rest read and file in on the sixteenths
   ============================================================ */
const ROWS = [
  ['INV-2291', 'invoice', 'Harbour Foods Ltd', '£542.70', 'ok', 'Matched', 'Accounts / Purchases'],
  ['Delivery note', 'doc', 'Harbour Foods Ltd', '14 cases', 'ok', 'Matched', 'Stock / Deliveries'],
  ['INV-0318', 'invoice', 'Clearway Logistics', '£2,310.00', 'chk', 'Check', 'Accounts / Purchases'],
  ['New starter form', 'notes', 'People', '—', 'ok', 'Filed', 'HR / Starters'],
  ['INV-7742', 'invoice', 'Mill Lane Bakery', '£412.80', 'ok', 'Matched', 'Accounts / Purchases'],
  ['Delivery note', 'doc', 'Northgate Supplies', '9 items', 'ok', 'Matched', 'Stock / Deliveries'],
  ['Supplier form', 'notes', 'Clearway Logistics', '—', 'ok', 'Filed', 'Suppliers'],
  ['INV-1190', 'invoice', 'Parkside Print', '£96.00', 'ok', 'Matched', 'Accounts / Purchases'],
  ['Delivery note', 'doc', 'Mill Lane Bakery', '6 trays', 'ok', 'Matched', 'Stock / Deliveries'],
]
const N0 = 1204
const fmtN = n => n.toLocaleString('en-GB')
function buildTable(s) {
  widen(s); paper(s)
  const t0 = s.t0, t1 = s.t1
  const TW = M({ land: 1640, sq: 990, tall: 990, port: 970 })
  const COLS = LAND ? '2fr 1.7fr 1fr 1.1fr 1.5fr' : '1.9fr 1.1fr 1.05fr'
  const tbl = h('div', 'd-tbl', s.cam, `
    <div class="hd"><span class="t">Paperwork</span><span class="cnt"><b>${fmtN(N0)}</b> read this month</span></div>
    <div class="tabs"><span class="on">All</span><span>Invoices</span><span>Delivery notes</span><span>Forms</span></div>
    <div class="th" style="grid-template-columns:${COLS}"><span>Document</span>${LAND ? '<span>From</span>' : ''}<span>Amount</span><span>Status</span>${LAND ? '<span>Filed to</span>' : ''}</div>
    ${ROWS.map(([d, ic, f, a, k, sl, to]) => `<div class="tr" style="grid-template-columns:${COLS}"><span class="doc"><span class="ic">${icon(ic)}</span>${d}</span>${LAND ? `<span class="g fr">${f}</span>` : ''}
      <span class="m am">${a}</span><span class="stc"><span class="d-tag ${k}">${k === 'ok' ? CHECK : ''}${sl}</span></span>${LAND ? `<span class="g to">${to}</span>` : ''}
      <span class="rd" style="position:absolute;right:0"><i></i>Reading…</span></div>`).join('')}`)
  tbl.style.width = TW + 'px'
  const trs = [...tbl.querySelectorAll('.tr')], cnt = tbl.querySelector('.cnt b'), cntEl = tbl.querySelector('.cnt')
  const parts = trs.map(r => ({ r, vals: [...r.querySelectorAll('.fr, .am, .stc, .to')], rd: r.querySelector('.rd'), tag: r.querySelector('.d-tag') }))
  const tRow = i => i === 0 ? t0 - 1 : t0 + .06 + i * B / 4, tVal = i => i === 0 ? t0 - 1 : tRow(i) + B * .75
  cue('whoosh', t0 + .02, { d: .5, v: .6 })
  ROWS.forEach((_, i) => { if (i) { cue('tick', tRow(i), { v: .3 }); cue('pop', tVal(i), { v: .25 }) } })
  cue('whoosh', t1 - .08, { d: .45, v: .4 })
  let L = null
  return t => {
    if (!L) L = { r0: at(trs[0], tbl, 0, 0), cnt: at(cntEl, tbl, 0, 0), h: tbl.offsetHeight }
    put(tbl, { o: 1 })
    let filed = 0
    parts.forEach((p, i) => {
      const a = P(t, tRow(i), tRow(i) + .2, E.out), v = P(t, tVal(i), tVal(i) + .2, E.out)
      p.r.style.opacity = a.toFixed(3); p.r.style.transform = `translateY(${((1 - a) * 14).toFixed(1)}px)`
      p.vals.forEach(e => { e.style.opacity = v.toFixed(3) })
      p.rd.style.opacity = (a * (1 - v)).toFixed(3)
      p.tag.style.transform = `scale(${P(t, tVal(i), tVal(i) + .25, E.back).toFixed(3)})`
      p.r.style.background = i === 0 ? `rgba(248,227,189,${(.5 * (1 - P(t, t0 + .3, t0 + 1))).toFixed(3)})` : ''
      if (t >= tVal(i)) filed++
    })
    cnt.textContent = fmtN(N0 + filed - 1)
    // the camera: slammed back from row one, then down the page and into the counter
    const cam = path([
      [t0, L.r0[0] * .6, L.r0[1], 0, 0, 0, 0, 2.3],
      [t0 + .55, 0, -L.h * .06, 0, 4, 0, 0, M({ land: 1.12, def: 1.04 })],
      [bt(16), 0, L.h * .08, 0, 6, 0, 0, M({ land: 1.16, def: 1.08 })],
      [t1, L.cnt[0], L.cnt[1], 0, 0, 0, 0, 2.6],
    ])
    const mb = shoot(s, cam, t)
    lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: 6 * P(t, t1 - .12, t1, E.in2) })
  }
}

/* ============================================================
   COUNT: into the counter: the documents read, files floating past
   ============================================================ */
function buildCount(s) {
  widen(s); paper(s, true)
  const t0 = s.t0, t1 = s.t1
  const big = h('div', 'd-big', s.cam, fmtN(N0)); big.style.fontSize = M({ land: 300, def: 230 }) + 'px'
  const cap = h('div', 'd-cap', s.cam, 'documents read and filed')
  const KINDS = [['PDF', 'doc'], ['JPG', 'notes'], ['XLSX', 'chart'], ['DOCX', 'doc'], ['EML', 'inbox'], ['PNG', 'notes'], ['PDF', 'invoice'], ['CSV', 'chart']]
  const r = (n => () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296)(42)
  const SPREAD = M({ land: [860, 430], sq: [470, 470], tall: [470, 560], port: [450, 760] })
  const tiles = Array.from({ length: 18 }, (_, i) => {
    const [k, ic] = KINDS[i % KINDS.length]
    const e = h('div', 'd-tile' + (i % 6 === 2 ? ' a' : ''), s.cam, `${icon(ic)}<b>${k}</b>`)
    let x = (r() * 2 - 1) * SPREAD[0], y = (r() * 2 - 1) * SPREAD[1]
    if (Math.abs(x) < 360 && Math.abs(y) < 170) x += Math.sign(x || 1) * 380
    return { e, x, y, z: -650 + r() * 900, rot: (r() - .5) * 24, ph: r() * 6, sp: .4 + r() * .6 }
  })
  const toast = h('div', 'd-toast', s.cam, `<span class="d-spin"></span><div><div>64 new documents</div><div class="s">Reading and filing</div></div>`)
  const tSpin = toast.querySelector('.d-spin')
  const tc0 = bt(17.25), tc1 = bt(20.5)
  cue('type', tc0, { d: tc1 - tc0, v: .28 })
  cue('confirm', tc1, { n: 2, deg: 3, v: .4 })
  cue('whoosh', t1 - .1, { d: .5, v: .45 })
  return t => {
    const n = Math.round(lerp(N0, N0 + 64, P(t, tc0, tc1, E.out)))
    big.textContent = fmtN(n)
    const bi = P(t, t0, t0 + .5, E.out)
    put(big, { y: -40, s: lerp(1.35, 1, bi) * (1 + .03 * bell(t, tc1, tc1 + .05, tc1 + .4)), blur: (1 - bi) * 30, o: Math.min(1, bi * 2) })
    blurIn(cap, t, bt(17.6), { y: M({ land: 140, def: 110 }), dur: .4, s0: 1, blur: 12, dy: 16 })
    tiles.forEach(d => {
      const zz = d.z + (t - t0) * 60 * d.sp
      put(d.e, { x: d.x + Math.sin(t * .7 + d.ph) * 18, y: d.y - (t - t0) * 30 * d.sp, z: zz, r: d.rot + Math.sin(t + d.ph) * 4, o: P(t, t0 + .1, t0 + .5), blur: Math.min(14, Math.abs(zz) / 45) })
    })
    blurIn(toast, t, bt(18), { x: M({ land: -560, def: -150 }), y: M({ land: 330, sq: 380, tall: 470, port: 640 }), dur: .35, s0: .94, blur: 10, dy: 16 })
    tSpin.style.transform = `rotate(${(t * 420).toFixed(1)}deg)`
    const cam = path([[t0, 0, 0, 60, 0, 0, 0, 1], [bt(21.25), 0, 0, 160, 2, -2, 0, 1], [t1, 0, -40, 900, 0, 0, 0, 1]])
    const mb = shoot(s, cam, t)
    lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: 10 * P(t, t1 - .15, t1, E.in2) })
  }
}

/* ============================================================
   BRAND: the n. drawn a stroke a beat, over four backdrops cut on the beat
   ============================================================ */
const WMW = M({ land: 680, def: 600 })                     // the whole name's width at the end; the n. here is the same size
const MK = WMW / 273                                       // px to a unit of the wordmark
const BIG = M({ land: 1.7, def: 1.6 })                     // the n. in the brand shots, against its size in the name
function buildBrand(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const bds = [0, 1, 2, 3].map(i => h('div', 'd-bd' + (i === 2 ? ' amb' : i === 3 ? ' dark' : ''), s.root))
  bds.forEach(e => s.root.insertBefore(e, s.rig))
  // the first two are the reel's own paper, close and soft: the invoice, the table
  bds[0].innerHTML = `<div class="d-paper layer"></div><div class="d-inv" style="transform:translate(-50%,-50%) rotate(-7deg) scale(2.4);filter:blur(5px)">${INV}</div><div class="tint" style="background:rgba(233,172,87,.22)"></div>`
  bds[1].innerHTML = `<div class="d-paper layer grey"></div><div class="d-tbl" style="width:1500px;transform:translate(-50%,-50%) rotate(5deg) scale(2.2);filter:blur(6px)"><div class="hd"><span class="t">Paperwork</span></div>${ROWS.slice(0, 5).map(([d, , f, a]) => `<div class="tr" style="grid-template-columns:2fr 1.7fr 1fr"><span class="doc">${d}</span><span class="g">${f}</span><span class="m">${a}</span></div>`).join('')}</div><div class="tint" style="background:rgba(23,19,15,.18)"></div>`
  const mark = h('div', 'd-mark', s.cam, `<svg width="${104 * MK * BIG}" height="${100 * MK * BIG}" viewBox="0 0 104 100">
    <g fill="none" stroke-width="13" stroke-linecap="butt">
      <path class="p" d="M24.5 82 L24.5 48" pathLength="1"/><path class="p" d="M24.5 48 A20 20 0 0 1 64.5 48" pathLength="1"/><path class="p" d="M64.5 48 L64.5 82" pathLength="1"/>
    </g><rect class="dot" x="78" y="69" width="13" height="13" fill="#E9AC57"/></svg>`)
  const ps = [...mark.querySelectorAll('.p')], dot = mark.querySelector('.dot'), svg = mark.firstChild
  const cuts = [0, 1, 2, 3].map(i => bt(22 + i))
  cuts.forEach((c, i) => { cue('whoosh', c + .02, { d: .3, v: .35 }); if (i < 3) drop(c + .02, 1 + 2 * i, { wet: .35, v: .45 }) })
  cue('pop', cuts[3] + .02, { v: .5 }); drop(cuts[3] + .04, 5, { n: 2, step: 3, gap: .06, wet: .2, v: .55 })
  const yM = M({ land: -50, def: -60 })
  return t => {
    const k = Math.min(3, Math.max(0, Math.floor((t - cuts[0]) / B + 1e-6)))
    bds.forEach((e, i) => { e.style.display = i === k ? 'block' : 'none' })
    const ck = P(t, cuts[k], cuts[k] + .45, E.out)
    bds[k].style.transform = `scale(${lerp(1.1, 1, ck).toFixed(4)})`
    bds[k].style.filter = ck < .99 ? `blur(${((1 - ck) * 8).toFixed(1)}px)` : 'none'
    const col = k === 3 ? '#F0E7D8' : '#FFFDF9'
    ps.forEach((p, i) => {
      const d = P(t, cuts[i], cuts[i] + .3, E.out)
      p.style.stroke = col
      p.style.strokeDasharray = d < 1 ? '1 2' : ''; p.style.strokeDashoffset = d < 1 ? (1 - d).toFixed(4) : ''
      p.style.opacity = d > 0 ? 1 : 0
    })
    const dp = P(t, cuts[3], cuts[3] + .35, E.back)
    dot.style.transformOrigin = '84.5px 75.5px'; dot.style.transform = `scale(${dp.toFixed(3)})`; dot.style.opacity = dp > 0 ? 1 : 0
    svg.style.filter = k < 3 ? 'drop-shadow(0 8px 24px rgba(23,19,15,.35))' : 'drop-shadow(0 0 30px rgba(233,172,87,.25))'
    const pulse = bell(t, cuts[k], cuts[k] + .05, cuts[k] + .35)
    put(mark, { x: (52 - 54.5) * MK * BIG, y: yM + (50 - 51.75) * MK * BIG, s: 1 + .04 * pulse })
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 0, 40, 0, 0, 0, 1]]), t)
    lens(s, {})
  }
}

/* ============================================================
   END: on paper, the n. becomes the name; Document AI; the line; the address
   ============================================================ */
function buildEnd(s) {
  widen(s); paper(s)
  const t0 = s.t0, t1 = s.t1
  const wm = h('div', 'd-mark', s.cam, WORDMARK()); wm.firstChild.setAttribute('width', 273 * MK)
  wm.querySelector('g').setAttribute('stroke', '#17130F')
  const abl = ['ab', 'as', 'bs', 'bb', 'l'].map(k => wm.querySelector(`[data-k="${k}"]`))
  const eb = h('div', 'd-eyebrow', s.cam, `<svg width="20" height="20" viewBox="-10 -10 20 20"><path d="M0 -10 C1 -2.5 2.5 -1 10 0 C2.5 1 1 2.5 0 10 C-1 2.5 -2.5 1 -10 0 C-2.5 -1 -1 -2.5 0 -10 Z" fill="#E9AC57"/></svg><span>Document AI</span>`)
  const tg = h('div', 'd-tag2', s.cam, 'Paperwork, read and filed<span class="d-stop" style="display:inline-block;width:.2em;height:.2em;margin-left:.04em"></span>')
  const url = h('div', 'd-url', s.cam, 'nabl.agency')
  const yM = M({ land: -50, def: -60 })
  const tA = t0 + .12, tS = t0 + .1
  cue('draw', tA, { d: .5, v: .3 })
  cue('shimmer', tA + .4, { d: 1.6, v: .3 })
  drop(t0 + B * 1.25, 2, { wet: .5, v: .35 })
  return t => {
    // the n. where the mark was, sliding left as the rest of the name draws in
    const sl = P(t, tS, tS + .55, E.io)
    const ax = lerp(54.5, 136.5, sl), ay = lerp(51.75, 44, sl)
    const k = lerp(BIG, 1, sl)
    put(wm, { x: (136.5 - ax) * MK * k, y: yM + (50 - ay) * MK * k, s: k })
    abl.forEach((e, i) => {
      const d = P(t, tA + i * .07, tA + i * .07 + .4, E.out)
      e.style.opacity = d > 0 ? 1 : 0; e.style.strokeDasharray = d < 1 ? '1 2' : ''; e.style.strokeDashoffset = d < 1 ? (1 - d).toFixed(4) : ''
    })
    const top = yM + (6 - 44) * MK, base = yM + (82 - 44) * MK
    blurIn(eb, t, t0 + B * .9, { y: top - M({ land: 64, def: 60 }), dur: .35, s0: 1, blur: 10, dy: 12 })
    blurIn(tg, t, t0 + B * 1.25, { y: base + M({ land: 96, def: 90 }), dur: .4, s0: 1, blur: 14, dy: 16 })
    blurIn(url, t, t0 + B * 1.75, { y: base + M({ land: 178, def: 168 }), dur: .35, s0: 1, blur: 10, dy: 10 })
    shoot(s, path([[t0, 0, 0, 0, 0, 0, 0, 1], [t1, 0, 0, 50, 0, 0, 0, 1]]), t)
    lens(s, { o: 1 - P(t, t1 - .4, t1, E.in2) })
  }
}

export default function setup() {
  document.querySelector('.vignette').style.display = 'none'     // daylight: no vignette
  scene(['hook'], buildHook)
  scene(['drop'], buildDrop)
  scene(['read'], buildRead)
  scene(['table'], buildTable)
  scene(['count'], buildCount)
  scene(['brand'], buildBrand)
  scene(['end'], buildEnd)
  const ground = [[0, .5, .5, 0, .5, .5, 0, 0], [TL.duration, .5, .5, 0, .5, .5, 0, 0]]
  return { ground, bug: ['end', 'end'] }
}
