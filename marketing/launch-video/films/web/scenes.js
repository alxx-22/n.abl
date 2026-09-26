/* ============================================================
   WEBSITES THAT WORK: the web service film

   Eight shots in 33 seconds: a website that sits there comes alive, and
   n.abl builds three kinds of them. Landing pages that bring enquiries,
   booking systems that fill the diary, web apps shaped to the business,
   then every screen, and the end card. The script is films/web/film.py;
   the brief and the shot list are films/web/SCRIPT.md.
   ============================================================ */

import {
  CHECK, E, H, LAND, M, MODE, P, TL, W, WIPES, WORDMARK, bell, camera, cue, endCard, focus, h, icon, label, lerp, lineStart, offs, pop, put, rise, rng, scene, sceneById, slot, spark, vis, we, words, wt,
} from '../../film/stage.js'

/* ---------- pieces ---------- */
const LOCK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>'
const BELL = '<svg viewBox="0 0 32 32" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22V14a8 8 0 0116 0v8l3 3H5z"/><path d="M13 27a3 3 0 006 0"/></svg>'

function browser(parent, { w, ht, url = 'yourbusiness.co.uk' }) {
  const b = h('div', 'browser', parent)
  b.style.width = w + 'px'; b.style.height = ht + 'px'
  b.innerHTML = `<div class="bbar"><i></i><i></i><i></i><div class="addr">${LOCK}<span>${url}</span></div><div class="load"></div></div><div class="bview"></div>`
  return { b, view: b.querySelector('.bview'), load: b.querySelector('.load') }
}
/* blocks: [class, left %, top %, width %, height %, extra style] */
const blocks = spec => spec.map(([c, l, t, w, ht, x = '']) => `<div class="b ${c}" style="left:${l}%;top:${t}%;width:${w}%;height:${ht}%;${x}"></div>`).join('')
const ART = 'border-radius:12px;background:linear-gradient(145deg,#F2C57E,#E9AC57 45%,#D9922F)'

/* the site that sits there, in three dated layouts: blocks only, no words */
const OLDV = [
  `<div class="onav"><i class="lg"></i><i></i><i></i><i></i><i></i></div><div class="ohero"></div><div class="oh"></div><div class="ol"></div><div class="ol" style="width:78%;margin:0 auto"></div><div class="ofoot"><i></i><i></i></div>`,
  `<div class="onav"><i class="lg"></i><i></i><i></i><i></i></div><div style="display:flex;gap:18px"><div class="ohero" style="flex:1;height:250px"></div><div style="flex:1;display:flex;flex-direction:column;gap:16px;padding-top:10px"><div class="oh" style="width:90%;margin:0"></div><div class="ol"></div><div class="ol"></div><div class="ol" style="width:60%"></div></div></div><div class="ofoot"><i></i><i></i></div>`,
  `<div class="onav"><i class="lg"></i><i></i><i></i><i></i><i></i></div><div class="oh" style="margin-top:12px"></div><div class="ol" style="width:70%;margin:0 auto"></div><div style="display:flex;gap:16px"><div class="ohero" style="flex:1;height:170px"></div><div class="ohero" style="flex:1;height:170px"></div><div class="ohero" style="flex:1;height:170px"></div></div><div class="ofoot"><i></i><i></i></div>`,
]
const NAV = `<div class="snav"><div class="logo"><i></i>Your business</div><span>Services</span><span>Prices</span><span>Contact</span><span class="nbtn">Book now</span></div>`
const SITE = `${NAV}
  <div class="hero"><div><span class="eb"><i></i>Open 24/7</span><h3>Book in seconds.</h3><div class="sub">Bookings, quotes and payments, all online.</div>
    <div class="ctas"><span class="btn go">Book now</span><span class="btn ghost">Get a quote</span></div></div>
    <div class="art"><div class="c1"></div><div class="c2"></div><div class="mini"><div class="mi">${icon('cal')}</div><div><div class="mt">Next free slot</div><div class="ms">Today · 2:00pm</div></div></div></div></div>
  <div class="feats"><div class="feat"><b>Book online</b><i></i><i style="width:60%"></i></div><div class="feat"><b>Pay a deposit</b><i></i><i style="width:70%"></i></div><div class="feat"><b>Get reminders</b><i></i><i style="width:50%"></i></div></div>`

/* ============================================================
   01 + 02 · SIT, THEN WORK: a wall of websites that sit there, and
   the camera dives into yours as it comes alive
   ============================================================ */
function buildSite(s) {
  const L = M({
    land: { b: [390, 10], bs: 1, tx: [-860, 0], fs: 88, toast: [640, -150], ts: 1, cols: 7, rows: 5, yc: [4, 2], w0: 1, t1: 0, f1: 112, sc: [1500, 560] },
    port: { b: [0, -350], bs: 1.08, tx: [0, 330], fs: 92, toast: [150, -200], ts: 1, cols: 5, rows: 9, yc: [2, 3], w0: 1.1, t1: 170, f1: 100, sc: [1150, 620] },
    sq:   { b: [0, -170], bs: .8, tx: [0, 330], fs: 74, toast: [170, -250], ts: .8, cols: 5, rows: 5, yc: [2, 1], w0: .9, t1: 170, f1: 86, sc: [1150, 560] },
    tall: { b: [0, -260], bs: .92, tx: [0, 400], fs: 82, toast: [170, -330], ts: .88, cols: 5, rows: 7, yc: [2, 2], w0: 1, t1: 170, f1: 92, sc: [1150, 600] },
  })
  const BW = 820, BH = 560, TS = .4, GX = 370, GY = 262
  // the wall: every other website, all alike, all still
  const cellAt = (c, r) => [(c - (L.cols - 1) / 2) * GX, (r - (L.rows - 1) / 2) * GY]
  const thumbs = []
  for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
    if (c === L.yc[0] && r === L.yc[1]) continue
    const e = h('div', 'browser thumb', s.cam, `<div class="bbar"><i></i><i></i><i></i><div class="addr"></div></div><div class="bview"><div class="oldsite">${OLDV[(c * 2 + r) % 3]}</div></div>`)
    e.style.width = BW + 'px'; e.style.height = BH + 'px'
    e._p = cellAt(c, r)
    thumbs.push(e)
  }
  const C = cellAt(L.yc[0], L.yc[1])
  // yours: one of them, until it is singled out
  const { b: br, view, load } = browser(s.cam, { w: BW, ht: BH })
  load.style.opacity = 0
  h('div', 'oldsite', view, OLDV[0])
  const site = h('div', 'site', view, SITE)
  const scan = h('div', '', view)
  scan.style.cssText = 'inset:auto;left:0;right:0;top:0;height:4px;background:#E9AC57;box-shadow:0 0 26px 6px rgba(233,172,87,.8)'
  // the first line, over the wall
  const scrim = h('div', 'abs', s.cam)
  Object.assign(scrim.style, { width: L.sc[0] + 'px', height: L.sc[1] + 'px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(14,12,10,.88), rgba(14,12,10,.6) 50%, rgba(14,12,10,0))' })
  const g1 = h('div', 'abs display', s.cam); g1.style.fontSize = L.f1 + 'px'; g1.style.textAlign = 'center'; g1.style.width = 'max-content'
  const g1w = [...words(h('div', 'nowrap', g1), 'Most websites'), ...words(h('div', 'nowrap', g1), 'just sit there.')]
  const zero = h('div', 'abs zero', s.cam, '<i></i><b>0</b>&nbsp;enquiries this week')
  // the second line
  const g2 = h('div', 'abs display', s.cam); g2.style.fontSize = L.fs + 'px'; g2.style.textAlign = LAND ? 'left' : 'center'; g2.style.width = 'max-content'
  const g2w = [...words(h('div', 'nowrap', g2), 'Yours should'), ...words(h('div', 'nowrap', g2), 'work for a living!')]
  const wWork = g2w[2]; wWork.style.color = '#E9AC57'; wWork.style.position = 'relative'
  const ul = h('span', 'uline', wWork)
  const t1 = ['most', 'websites', 'just', 'sit', 'there'].map(k => wt(1, k))
  const t2 = ['yours', 'should', 'work', 'for', 'a', 'living'].map(k => wt(2, k))
  const tY = wt(2, 'yours'), tW = wt(2, 'work'), tSwap = lineStart(2) - .18
  const tZero = we(1, 'there') - .15
  const tZ0 = tY - .25, tZ1 = tW - .1
  // what a working site does
  const TOASTS = [['lead', 'New enquiry', 'Quote request'], ['cal', 'Booking confirmed', 'Fri · 2:00pm'], ['card', 'Deposit paid', '£20.00'], ['bell', 'Reminder sent', 'Tomorrow · 10:30am']]
  const tT = TOASTS.map((_, i) => tW + .34 + i * .3)
  const toasts = TOASTS.map(([ic, a, b]) => h('div', 'toast', s.cam, `<div class="ti">${icon(ic)}</div><div><div class="tt">${a}</div><div class="ts">${b}</div></div><div class="now">now</div>`))
  const rings = [0, 1, 2].map(() => { const e = h('div', 'ring', s.cam); e.style.width = e.style.height = '200px'; return e })
  cue('tick', tZero + .02, { v: .6 })
  cue('pop', tY - .1, { v: .45 })
  cue('whoosh', tZ1 - .05, { d: tZ1 - tZ0, v: .7 })
  cue('riser', tW, { d: tW - s.cuts[1].start + .2 })
  cue('implode', tW - .02, { d: .45 })
  cue('impact', tW, { v: 1.1 })
  cue('shimmer', tW + .04, { d: 1.5, v: .8 })
  cue('scan', tW - .04, { d: .34 })
  tT.forEach(x => { cue('recv', x, { v: .8 }); cue('pop', x + .02, { v: .3 }) })
  cue('whoosh', s.t1 - .25, { d: .5, v: .9 })

  return t => {
    camera(s, t, { inT: 'none', outT: 'through', outDur: .3, push: 0 })
    const alive = P(t, tW - .05, tW + .4, E.out)
    const bump = bell(t, tW - .02, tW + .08, tW + .55)
    // the wall drifts, slowly; then the camera dives into yours until it is the whole browser
    const drift = P(t, 0, tZ1, E.lin)
    const Sp = L.w0 * lerp(1.05, 1, drift), Tp = [lerp(36, -36, drift), lerp(-10, 10, drift)]
    const zz = P(t, tZ0, tZ1, E.io)
    const S = Math.exp(lerp(Math.log(Sp), Math.log(L.bs / TS), zz))
    const pc = [lerp(Tp[0] + Sp * C[0], L.b[0], zz), lerp(Tp[1] + Sp * C[1], L.b[1], zz)]
    const T = [pc[0] - S * C[0], pc[1] - S * C[1]]
    const wo = .42 * (1 - P(zz, .45, .95, E.lin))
    thumbs.forEach(e => put(e, { x: T[0] + S * e._p[0], y: T[1] + S * e._p[1], s: S * TS, o: wo }))
    const pick = P(t, tY - .15, tY + .1)
    put(br, { x: pc[0], y: pc[1], s: S * TS * (1 + .05 * bump), o: lerp(.42, 1, pick) })
    const ring = pick * (1 - alive)
    br.style.boxShadow = `0 40px 90px -20px rgba(0,0,0,.7), 0 0 0 ${lerp(8, 2, zz).toFixed(2)}px rgba(233,172,87,${(.9 * ring).toFixed(3)}), 0 0 ${(80 * alive).toFixed(0)}px rgba(233,172,87,${(.28 * alive).toFixed(3)}), 0 0 0 1px rgba(233,172,87,${(.5 * bump).toFixed(3)})`
    // the new site paints itself over the old, top to bottom
    const rv = P(t, tW - .04, tW + .3, E.io)
    site.style.clipPath = `inset(0 0 ${((1 - rv) * 100).toFixed(2)}% 0)`
    scan.style.transform = `translateY(${(rv * (BH - 52)).toFixed(1)}px)`
    vis(scan, rv > 0 && rv < 1 ? 1 : 0)
    // words
    const o1 = P(t, tSwap, tSwap + .22, E.in2)
    put(scrim, { y: L.t1 + 40, o: P(t, t1[0] - .3, t1[0] + .3, E.io) * (1 - P(t, tSwap, tSwap + .3)) })
    put(g1, { y: L.t1 - o1 * 50, o: 1 - o1, blur: o1 * 14 })
    g1w.forEach((w, i) => rise(w, t, t1[i] - .06, { dur: .34, dy: 34 }))
    const zp = P(t, tZero, tZero + .3, E.snap)
    put(zero, { y: L.t1 + g1.offsetHeight / 2 + 70 - o1 * 50, s: lerp(.8, 1, zp), o: P(t, tZero, tZero + .08) * (1 - o1) })
    const lx = LAND ? L.tx[0] + g2.offsetWidth / 2 : L.tx[0]
    put(g2, { x: lx, y: L.tx[1], s: 1 + .05 * bump })
    g2w.forEach((w, i) => rise(w, t, t2[i] - .06, { dur: i === 2 ? .26 : .34, dy: i === 2 ? 60 : 34, s0: i === 2 ? 1.4 : 1 }))
    wWork.style.textShadow = `0 0 ${(50 * bump).toFixed(0)}px rgba(233,172,87,.8)`
    ul.style.transform = `scaleX(${P(t, tW + .05, tW + .4, E.ease).toFixed(4)})`
    // rings off the page as it comes alive
    rings.forEach((e, k) => {
      const p = P(t, tW + k * .08, tW + .9 + k * .15, E.out)
      put(e, { x: L.b[0], y: L.b[1], s: lerp(.4, 7 + k * 2, p), o: t >= tW + k * .08 ? (1 - p) * (k ? .45 : .8) : 0 })
    })
    // notifications stack up, newest on top
    toasts.forEach((e, k) => {
      const pin = P(t, tT[k], tT[k] + .32, E.snap)
      let slotN = 0; for (let j = k + 1; j < toasts.length; j++) slotN += P(t, tT[j], tT[j] + .3, E.out)
      put(e, { x: L.toast[0], y: L.toast[1] + slotN * 92 * L.ts - (1 - Math.min(1, pin)) * 50, s: L.ts * lerp(.8, 1, pin), o: P(t, tT[k], tT[k] + .08) })
    })
  }
}

/* ============================================================
   03 · WHAT WE BUILD: three cards, one for each thing said
   ============================================================ */
const ILL_APP = blocks([
  ['d', 0, 0, 21, 100, 'border-radius:0'],
  ...[0, 1, 2, 3].map(k => ['', 4, 14 + k * 11, 13, 5, `background:rgba(251,246,236,${k ? .18 : .55})`]),
  ...[0, 1, 2].map(k => ['m', 26 + k * 24, 7, 21, 20]),
  ...[0, 1, 2].map(k => ['d', 29 + k * 24, 16, 10, 5, 'border-radius:3px']),
  ['m', 26, 33, 69, 60],
]) + [.35, .55, .45, .7, .6, .85, .95].map((v, k) => `<div class="b${k === 6 ? ' a' : ''}" data-bar style="left:${30 + k * 9.2}%;bottom:12%;width:5.4%;height:${(v * 44).toFixed(1)}%;transform-origin:bottom;${k === 6 ? '' : 'background:rgba(26,21,18,.24)'}"></div>`).join('')
const ILL_LAND = blocks([
  ['d', 6, 7, 9, 6], ['', 56, 8, 9, 4], ['', 68, 8, 9, 4], ['d', 80, 6, 14, 8, 'border-radius:20px'],
  ['d', 6, 25, 46, 9], ['d', 6, 37, 34, 9], ['', 6, 52, 42, 4], ['', 6, 59, 32, 4],
  ['', 57, 24, 37, 62, ART],
]) + '<div class="b a" data-cta style="left:6%;top:70%;width:24%;height:12%;border-radius:8px"></div>'
const ILL_BOOK = blocks([['d', 6, 8, 30, 7], ['', 70, 8, 24, 7, 'border-radius:20px']]) +
  Array.from({ length: 20 }, (_, i) => `<div class="b m" data-cell="${i}" style="left:${6 + (i % 5) * 18}%;top:${24 + Math.floor(i / 5) * 18.5}%;width:16%;height:15%"></div>`).join('')

function buildBuilds(s) {
  const n = 3
  const L = M({
    land: { hd: [0, -330], fs: 110, cs: 1.14, C: [[-590, 110, 0], [0, 110, 0], [590, 110, 0]] },
    port: { hd: [0, -640], fs: 100, cs: .82, C: [[-150, -320, -4], [150, 60, 4], [-150, 440, -4]] },
    sq:   { hd: [0, -380], fs: 84, cs: .64, C: [[-335, 100, 0], [0, 100, 0], [335, 100, 0]] },
    tall: { hd: [0, -540], fs: 92, cs: .66, C: [[-170, -235, -4], [170, 70, 4], [-170, 375, -4]] },
  })
  const hd = h('div', 'abs display nowrap', s.cam); hd.style.fontSize = L.fs + 'px'; hd.style.width = 'max-content'
  const wm = h('span', 'w', hd, WORDMARK()); wm.firstChild.style.height = '.86em'; wm.firstChild.style.width = 'auto'; wm.firstChild.style.verticalAlign = '-.16em'
  hd.appendChild(document.createTextNode(' '))
  const wb = words(hd, 'builds')[0]
  const CARDS = [['Smart web apps', 'smart', ILL_APP], ['Landing pages', 'landing', ILL_LAND], ['Booking systems', 'booking', ILL_BOOK]]
  const cards = CARDS.map(([nm, k, ill], i) => {
    const e = h('div', 'card3', s.cam, `<div class="ill">${ill}</div><div class="cap3"><div class="no">${spark(16)}<span>0${i + 1}</span></div><div class="nm3">${nm}</div></div>`)
    e._t = wt(n, k) - .12
    return e
  })
  const bars = [...cards[0].querySelectorAll('[data-bar]')]
  const cta = cards[1].querySelector('[data-cta]')
  const cells = [...cards[2].querySelectorAll('[data-cell]')]
  const r = rng(31)
  const order = cells.map((_, i) => i).sort(() => r() - .5)
  const cellT = cells.map((_, i) => cards[2]._t + .35 + order.indexOf(i) * .03)
  const tN = wt(n, 'n.abl'), tB = wt(n, 'builds'), tEnd = we(n, 'systems')
  cue('hit', tN, { v: .45 })
  cards.forEach(e => { cue('whoosh', e._t + .1, { d: .35, v: .45 }); cue('flip', e._t + .08, { v: .6 }); cue('pop', e._t + .2, { v: .35 }) })
  cellT.forEach((x, i) => { if (i % 4 === 0) cue('blip', x, { v: .22 }) })
  cue('whip', s.t1 - .12)

  return t => {
    camera(s, t, { inT: 'rise', outT: 'whip', inDur: .3, outDur: .22 })
    focus(s, t, [[s.t0, 0, 0, 1, 7, 3], [s.t1, 0, 0, 1.04, -6, 0]])
    put(hd, { x: L.hd[0], y: L.hd[1] })
    rise(wm, t, tN - .06, { dur: .32, dy: 30 })
    rise(wb, t, tB - .06, { dur: .32, dy: 30 })
    cards.forEach((e, i) => {
      const p = P(t, e._t, e._t + .5, E.snap), q = Math.min(1, p)
      const [x, y, rr] = L.C[i]
      put(e, { x: x + (1 - q) * 160, y: y + (1 - q) * 70 - 10 * bell(t, e._t + .3, e._t + .5, e._t + 1.1), z: (1 - q) * -420, ry: (1 - p) * 100, r: rr, s: L.cs, o: P(t, e._t, e._t + .12) })
      const on = t >= e._t && (i === 2 || t < cards[i + 1]._t) || t > tEnd + .15
      e.classList.toggle('on', on)
    })
    bars.forEach((e, k) => { e.style.transform = `scaleY(${P(t, cards[0]._t + .3 + k * .05, cards[0]._t + .7 + k * .05, E.back).toFixed(3)})` })
    const cp = bell(t, cards[1]._t + .45, cards[1]._t + .6, cards[1]._t + 1) + bell(t, tEnd + .1, tEnd + .25, tEnd + .6)
    cta.style.boxShadow = `0 0 ${(26 * cp).toFixed(0)}px ${(8 * cp).toFixed(0)}px rgba(233,172,87,.55)`
    cells.forEach((e, i) => { const on = t >= cellT[i] && order.indexOf(i) < 17; e.classList.toggle('a', on); e.classList.toggle('m', !on) })
  }
}

/* ============================================================
   04 · LANDING PAGES: loads fast, turns visitors into enquiries
   ============================================================ */
const LP = `${NAV}
  <div class="hero" style="grid-template-columns:1.1fr .9fr"><div><span class="eb"><i></i>Free consultation</span><h3>Get your quote today.</h3>
    <div class="sub">Tell us what you need and we'll be in touch.</div><div class="ctas"><span class="btn go">Get my quote</span></div></div>
    <div class="form"><div class="ft">Request a quote</div><div class="fld">Name</div><div class="fld">Email</div><div class="fld">Phone</div><div class="btn go" data-send>Send enquiry</div><div class="ok"></div></div></div>
  <div class="feats"><div class="feat"><b>Fixed prices</b><i></i><i style="width:60%"></i></div><div class="feat"><b>Fully insured</b><i></i><i style="width:70%"></i></div><div class="feat"><b>Local team</b><i></i><i style="width:50%"></i></div></div>`

function buildLanding(s) {
  const n = 4
  const lab = label(s, '01', 'Landing pages', 'Visitors into enquiries', lineStart(n))
  const L = M({
    land: { br: [-250, 95], bs: 1, ib: [590, 95], is: 1, iw: 440, rows: 4, spd: [140, -205] },
    port: { br: [0, -200], bs: 1.08, ib: [0, 470], is: 1, iw: 760, rows: 3, spd: [290, -520] },
    sq:   { br: [-170, 110], bs: .66, ib: [350, 110], is: .66, iw: 440, rows: 4, spd: [60, -110] },
    tall: { br: [0, -140], bs: .92, ib: [0, 420], is: .9, iw: 760, rows: 3, spd: [260, -400] },
  })
  const BW = 900, BH = 580
  const { b: br, view, load } = browser(s.cam, { w: BW, ht: BH, url: 'yourbusiness.co.uk/quote' })
  const skel = h('div', 'skel', view, `<i style="height:34px;width:100%"></i><div style="display:grid;grid-template-columns:1.1fr .9fr;gap:26px"><div style="display:flex;flex-direction:column;gap:14px"><i style="height:28px;width:40%"></i><i style="height:52px"></i><i style="height:52px;width:70%"></i><i style="height:20px;width:80%"></i><i style="height:48px;width:40%"></i></div><i style="height:280px"></i></div><i style="height:70px"></i>`)
  const site = h('div', 'site', view, LP)
  const parts = [site.querySelector('.snav'), ...site.querySelector('.hero').children, site.querySelector('.feats')]
  const form = site.querySelector('.form'), okF = form.querySelector('.ok'), send = form.querySelector('[data-send]')
  // the speed score
  const spd = h('div', 'abs spd', s.cam, `<svg width="84" height="84" viewBox="-42 -42 84 84"><circle r="34" fill="none" stroke="rgba(240,231,216,.12)" stroke-width="8"/><circle data-arc r="34" fill="none" stroke="#9DBE97" stroke-width="8" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" transform="rotate(-90)"/></svg><div class="nv" data-n>0</div><div><div class="lb">Page speed</div><div class="lv">Fast</div></div>`)
  const sArc = spd.querySelector('[data-arc]'), sNum = spd.querySelector('[data-n]')
  // the inbox the enquiries land in
  const inbox = h('div', 'panel', s.cam)
  inbox.style.width = L.iw + 'px'
  inbox.innerHTML = `<div class="top"><div class="stile" style="color:#F2C57E">${icon('inbox').replace('<svg', '<svg width="24" height="24"')}</div><div><div class="ptitle">Enquiries</div><div class="psub">From your landing page</div></div><div class="pill amber" data-c>0 new</div></div><div class="erows"></div>`
  const erows = inbox.querySelector('.erows'), pill = inbox.querySelector('[data-c]')
  erows.style.height = (L.rows * 84 + 12) + 'px'
  const JOBS = ['Quote request', 'Callback please', 'Site visit', 'Quote request', 'Price check', 'Quote request', 'Availability', 'Quote request']
  const N = JOBS.length
  const rows = JOBS.map(j => h('div', 'erow', erows, `<div class="ea">${icon('lead')}</div><div><div class="et">New enquiry</div><div class="es">${j} · just now</div></div><div class="ec">${CHECK('#9DBE97', 20)}</div>`))
  const dots = Array.from({ length: N }, () => h('div', 'vdot', s.cam))
  const r = rng(12); dots.forEach(e => { e._y = (r() - .5) * 520; e._c = (r() - .5) * 200 })
  const tLoad = wt(n, 'load'), tFast = wt(n, 'fast'), tTurn = wt(n, 'turn')
  const tLoaded = tLoad + .3
  const tv = dots.map((_, i) => tTurn - .2 + i * .13)
  const tForm = tv.map(x => x + .5), tIn = tv.map(x => x + .9)
  cue('zip', tLoad - .05, { d: .35 }); cue('tick', tLoaded, { v: .9 })
  cue('pop', tFast, { v: .5 })
  tForm.forEach((x, i) => cue('blip', x, { v: .3 }))
  tIn.forEach((x, i) => { if (i % 2 === 0) cue('recv', x, { v: .6 }) })
  cue('whip', s.t1 - .12)
  let geo

  return t => {
    camera(s, t, { inT: 'whip', outT: 'whip', inDur: .22, outDur: .22 })
    focus(s, t, [[s.t0, 0, LAND ? 20 : 0, M({ land: 1.06, def: 1 }), -4, 1], [s.t1, 0, LAND ? 20 : 0, M({ land: 1.1, def: 1.04 }), 4, 0]])
    lab(t)
    put(br, { x: L.br[0], y: L.br[1] + (1 - P(t, s.t0, s.t0 + .4)) * 60, s: L.bs })
    put(inbox, { x: L.ib[0], y: L.ib[1] + (1 - P(t, s.t0 + .1, s.t0 + .5)) * 60, s: L.is, o: P(t, s.t0 + .1, s.t0 + .3) })
    // load: the bar runs, the page drops in
    const lp = P(t, tLoad - .05, tLoaded, E.io)
    load.style.transform = `scaleX(${lp.toFixed(4)})`
    vis(load, lp > 0 ? 1 - P(t, tLoaded + .05, tLoaded + .25) : 0)
    skel.querySelectorAll('i').forEach(e => { e.style.opacity = (.55 + .45 * Math.sin(t * 9)).toFixed(3) })
    vis(skel, 1 - P(t, tLoaded, tLoaded + .1))
    parts.forEach((e, k) => { const p = P(t, tLoaded - .12 + k * .05, tLoaded + .18 + k * .05, E.out); e.style.opacity = p.toFixed(3); e.style.transform = `translateY(${((1 - p) * 24).toFixed(1)}px)` })
    // the score
    const sp = P(t, tFast - .1, tFast + .2, E.snap), sv = P(t, tFast - .05, tFast + .45, E.out)
    put(spd, { x: L.spd[0], y: L.spd[1], s: lerp(.6, 1, sp) * M({ land: 1, sq: .8, def: .95 }), o: P(t, tFast - .1, tFast) })
    sArc.style.strokeDashoffset = (1 - sv).toFixed(4)
    sNum.textContent = Math.round(sv * 100)
    // visitors into enquiries
    if (!geo) {
      const f = offs(send, br), q = offs(erows, inbox)
      geo = { fx: L.br[0] + (f.x + f.w / 2 - BW / 2) * L.bs, fy: L.br[1] + (f.y + f.h / 2 - BH / 2) * L.bs,
        ix: L.ib[0] + (q.x + 40 - inbox.offsetWidth / 2) * L.is, iy: L.ib[1] + (q.y + 50 - inbox.offsetHeight / 2) * L.is }
    }
    let hits = 0
    dots.forEach((e, i) => {
      const a = P(t, tv[i], tForm[i], E.io), b = P(t, tForm[i] + .05, tIn[i], E.in2)
      const sx = -W / 2 - 40, sy = geo.fy + e._y
      let x = lerp(sx, geo.fx, a), y = lerp(sy, geo.fy, a) - Math.sin(a * Math.PI) * (80 + e._c)
      x = lerp(x, geo.ix, b); y = lerp(y, geo.iy, b) - Math.sin(b * Math.PI) * 120
      const amber = t >= tForm[i]
      e.classList.toggle('am', amber)
      put(e, { x, y, s: amber ? 1 + .6 * bell(t, tForm[i], tForm[i] + .06, tForm[i] + .3) : 1, o: P(t, tv[i], tv[i] + .1) * (1 - P(t, tIn[i] - .05, tIn[i])) })
      if (t >= tForm[i]) hits++
    })
    vis(okF, bell(t, tForm[0], tForm[0] + .05, tForm[N - 1] + .3) * (.6 + .4 * Math.sin(t * 24)))
    send.style.transform = `scale(${(1 - .06 * Math.max(0, Math.sin((t - tForm[0]) * 26)) * P(t, tForm[0], tForm[0] + .01) * (1 - P(t, tForm[N - 1] + .1, tForm[N - 1] + .2))).toFixed(3)})`
    let got = 0
    rows.forEach((e, k) => {
      const pin = P(t, tIn[k], tIn[k] + .3, E.snap)
      let above = 0; for (let j = k + 1; j < N; j++) above += P(t, tIn[j], tIn[j] + .3, E.out)
      e.style.transform = `translateY(${(12 + above * 84 - (1 - Math.min(1, pin)) * 30).toFixed(1)}px) scale(${lerp(.85, 1, pin).toFixed(3)})`
      vis(e, P(t, tIn[k], tIn[k] + .08) * (1 - P(above, L.rows - 1, L.rows - .4, E.lin)))
      if (t >= tIn[k]) got++
    })
    const pl = `${got} new`
    if (pill.textContent !== pl) pill.textContent = pl
  }
}

/* ============================================================
   05 · BOOKING SYSTEMS: fill the diary, take the deposit, remind
   ============================================================ */
function buildBooking(s) {
  const n = 5
  const lab = label(s, '02', 'Booking systems', 'Booked, paid, reminded', lineStart(n))
  const L = M({
    land: { ph: [-420, 95], ps: 1, dy: [290, 95], ds: 1, dw: 720 },
    port: { ph: [-255, 170], ps: 1.05, dy: [262, 170], ds: 1.04, dw: 480 },
    sq:   { ph: [-275, 105], ps: .72, dy: [205, 105], ds: .8, dw: 560 },
    tall: { ph: [-265, 130], ps: .82, dy: [225, 130], ds: .86, dw: 540 },
  })
  const TIMES = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00']
  const phone = h('div', 'phone', s.cam, `<div class="scr"><div class="notch"></div><div class="strip">
    <div class="pane"><div class="pl">Book a visit</div><div class="ph">Pick a time</div>
      <div class="days">${[['Mon', 12], ['Tue', 13], ['Wed', 14], ['Thu', 15], ['Fri', 16]].map(([d, x], i) => `<div class="day${i === 4 ? ' on' : ''}">${d}<b>${x}</b></div>`).join('')}</div>
      <div class="slots">${TIMES.map((x, i) => `<div class="sl${[0, 2].includes(i) ? ' gone' : ''}"${i === 3 ? ' data-pick' : ''}>${x}${i === 3 ? `<div class="pick">${x}</div>` : ''}</div>`).join('')}</div>
      <div class="pbtn" data-go>Continue</div></div>
    <div class="pane"><div class="pl">Deposit</div><div class="ph">Secure your slot</div>
      <div class="sum"><div class="row">Consultation<b>Fri 16, 2:00pm</b></div><div class="row">Deposit<b>£20.00</b></div><div class="row tot">Due today<b>£20.00</b></div></div>
      <div class="cardf"><i></i><span>•••• 4242</span></div>
      <div class="pbtn" data-pay>Pay £20.00<div class="paid">${CHECK('#FBF6EC', 22)}Paid</div></div></div>
    <div class="pane lock"><div class="clk">9:41</div><div class="dt">Thursday 15</div>
      <div class="ntf"><div class="ni">${icon('bell')}</div><div style="flex:1"><div class="nt">Your business<span>now</span></div><div class="nb">Reminder: your appointment is tomorrow at 2:00pm.</div></div></div></div>
    </div><div class="tap"></div></div>`)
  const scr = phone.querySelector('.scr'), strip = phone.querySelector('.strip'), tap = phone.querySelector('.tap')
  const pickEl = phone.querySelector('[data-pick]'), pick = pickEl.querySelector('.pick')
  const goBtn = phone.querySelector('[data-go]'), pay = phone.querySelector('[data-pay]'), paid = pay.querySelector('.paid')
  const ntf = phone.querySelector('.ntf')
  const cal = h('div', 'panel cal', s.cam)
  cal.style.width = L.dw + 'px'
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const BUSY = new Set(['0-0', '1-2', '2-4', '3-1', '0-5', '4-0'])
  cal.innerHTML = `<div class="top"><div class="stile">${icon('cal').replace('<svg', '<svg width="24" height="24" style="color:#F2C57E"')}</div><div><div class="ptitle">Diary</div><div class="psub">This week</div></div><div class="pill" data-p></div></div>
    <div class="grid7"><div></div>${DAYS.map(d => `<div class="dh">${d}</div>`).join('')}${TIMES.map((tm, r) => `<div class="tm">${tm}</div>${DAYS.map((d, c) => `<div class="slot${BUSY.has(c + '-' + r) ? ' busy' : ''}" data-s="${c}-${r}"></div>`).join('')}`).join('')}</div>`
  const pill = cal.querySelector('[data-p]')
  const free = [...cal.querySelectorAll('.slot:not(.busy)')]
  const first = cal.querySelector('[data-s="4-3"]')
  const r = rng(44)
  const rest = free.filter(e => e !== first).sort(() => r() - .5)
  const fillOrder = [first, ...rest.slice(0, rest.length - 2)]
  const fills = fillOrder.map(e => h('div', 'fillb', e, e === first ? CHECK('#24170A', 18) : ''))
  const tFill = wt(n, 'fill'), tTake = wt(n, 'take'), tDep = wt(n, 'deposit'), tSend = wt(n, 'send'), tRem = wt(n, 'reminders')
  const fT = fillOrder.map((_, k) => k ? tFill + .05 + k * .03 : tFill - .12)
  const T = { tap1: tFill - .3, tap2: tTake - .35, slide1: tTake - .22, tap3: tDep + .02, paid: tDep + .12, slide2: tSend - .3, ntf: tRem - .18 }
  cue('click', T.tap1); cue('pop', T.tap1 + .08, { v: .4 })
  fT.forEach((x, k) => { if (k % 3 === 0) cue('blip', x, { v: .28 }) })
  cue('click', T.tap2); cue('swish', T.slide1 + .1, { v: .5 })
  cue('click', T.tap3); cue('hit', T.paid, { v: .55 }); cue('tick', T.paid + .02, { v: .9 })
  cue('swish', T.slide2 + .1, { v: .5 })
  cue('recv', T.ntf + .05, { v: 1 }); cue('pop', T.ntf + .08, { v: .45 })
  fT.forEach((x, k) => { if (k % 4 === 0) cue('blip', tRem + .1 + k * .015, { v: .15 }) })
  cue('whip', s.t1 - .12)
  let tp

  return t => {
    camera(s, t, { inT: 'whip', outT: 'whip', inDur: .22, outDur: .22 })
    focus(s, t, [[s.t0, 0, LAND ? 20 : 0, M({ land: 1.05, def: 1 }), 5, 0], [s.t1, 0, LAND ? 20 : 0, M({ land: 1.1, def: 1.04 }), -4, 2]])
    lab(t)
    put(phone, { x: L.ph[0], y: L.ph[1] + (1 - P(t, s.t0, s.t0 + .4)) * 70, s: L.ps, r: -2 * (1 - P(t, s.t0, s.t0 + .6)) })
    put(cal, { x: L.dy[0], y: L.dy[1] + (1 - P(t, s.t0 + .08, s.t0 + .5)) * 60, s: L.ds, o: P(t, s.t0 + .08, s.t0 + .28) })
    // phone screens
    const pane = P(t, T.slide1, T.slide1 + .35, E.io) + P(t, T.slide2, T.slide2 + .35, E.io)
    strip.style.transform = `translateX(${(-pane * 33.3333).toFixed(3)}%)`
    const pk = P(t, T.tap1 + .05, T.tap1 + .2, E.snap); vis(pick, P(t, T.tap1 + .05, T.tap1 + .1)); pick.style.transform = `scale(${lerp(.7, 1, pk).toFixed(3)})`
    const pd = P(t, T.paid, T.paid + .25, E.snap); vis(paid, P(t, T.paid, T.paid + .06)); paid.style.transform = `scale(${lerp(.8, 1, pd).toFixed(3)})`
    const np = P(t, T.ntf, T.ntf + .4, E.snap)
    ntf.style.transform = `translateY(${((1 - Math.min(1, np)) * -140).toFixed(1)}px) scale(${lerp(.9, 1, np).toFixed(3)})`
    vis(ntf, P(t, T.ntf, T.ntf + .08))
    // taps
    if (!tp) {
      const c = e => { const o = offs(e, scr); return [o.x + o.w / 2, o.y + o.h / 2] }
      tp = [c(pickEl), c(goBtn), [c(pay)[0] + scr.offsetWidth, c(pay)[1]]]
    }
    const taps = [[T.tap1, tp[0]], [T.tap2, tp[1]], [T.tap3, [tp[2][0] - scr.offsetWidth, tp[2][1]]]]
    let ta = null
    for (const [x, p] of taps) if (t >= x - .15 && t < x + .35) ta = [x, p]
    if (ta) {
      const [x, [px, py]] = ta, k = P(t, x - .05, x + .3, E.out)
      tap.style.transform = `translate(${(px - 30).toFixed(1)}px,${(py - 30).toFixed(1)}px) scale(${lerp(.4, 1.3, k).toFixed(3)})`
      vis(tap, bell(t, x - .15, x, x + .35))
    } else vis(tap, 0)
    // the diary fills
    fills.forEach((e, k) => {
      const p = P(t, fT[k], fT[k] + .22, E.snap)
      vis(e, P(t, fT[k], fT[k] + .05)); e.style.transform = `scale(${lerp(.4, 1, p).toFixed(3)})`
      const rem = t >= tRem + .1 + k * .015
      if (k && e.dataset.b !== String(rem)) { e.dataset.b = String(rem); e.innerHTML = rem ? BELL : '' }
    })
    vis(first.querySelector('.fillb'), P(t, fT[0], fT[0] + .05))
    let left = free.length; fT.forEach(x => { if (t >= x) left-- })
    const pl = `${left} free`
    if (pill.textContent !== pl) pill.textContent = pl
  }
}

/* ============================================================
   06 · WEB APPS: portals, quotes, dashboards, built to fit
   ============================================================ */
const APPS = [
  ['Client portal', `<div class="pc side"><div class="lg"><i></i>Portal</div><span class="on">Overview</span><span>Projects</span><span>Files</span><span>Invoices</span><span>Messages</span></div>
    <div class="pc" style="left:222px;top:24px"><div class="muted">WELCOME BACK</div><h5>Your project</h5></div>
    <div class="pc steps" style="left:222px;top:112px;right:26px">${['Brief', 'Design', 'Build', 'Launch'].map((x, i) => `<div class="step${i === 2 ? ' cur' : ''}">${x}<i><u data-u="${i < 2 ? 1 : i === 2 ? .6 : 0}"></u></i></div>`).join('')}</div>
    <div class="pc" style="left:222px;top:200px;right:26px;display:flex;flex-direction:column;gap:10px">${[['Brief.pdf', '2 MB'], ['Designs.pdf', '8 MB'], ['Invoice 002.pdf', '140 KB']].map(([a, b]) => `<div class="file"><div class="fi"></div>${a}<span>${b}</span></div>`).join('')}</div>`],
  ['Quotes', `<div class="pc" style="left:32px;top:24px"><div class="muted">QUOTE #0142</div><h5>Kitchen refit</h5></div>
    <div class="pc" style="left:32px;top:108px;width:440px">${[['Labour', 1800], ['Materials', 2350], ['Waste removal', 180]].map(([a, v]) => `<div class="li">${a}<b data-v="${v}">£0</b></div>`).join('')}<div class="li tot">Total<b data-v="4330">£0</b></div></div>
    <div class="pc" style="right:32px;top:108px;width:236px;display:flex;flex-direction:column;gap:12px"><div class="kpi"><div class="muted">VALID FOR</div><b>30 days</b></div><div class="send">Send quote</div></div>
    <div class="pc stamp" data-stamp style="right:40px;bottom:36px">${CHECK('#4E8A47', 24)}Accepted</div>`],
  ['Dashboard', `${[['BOOKINGS', 128, '+12%'], ['ENQUIRIES', 36, '+8%'], ['REVIEWS', 4.9, '★']].map(([a, v, d], i) => `<div class="pc kpi" style="left:${28 + i * 252}px;top:22px;width:236px"><div class="muted">${a}</div><b data-v="${v}">0</b><em>${d}</em></div>`).join('')}
    <div class="pc chart" style="left:28px;top:150px;right:28px;bottom:24px">${Array.from({ length: 12 }, (_, k) => `<div class="bar${k === 11 ? ' a' : ''}" style="left:${24 + k * 58}px;height:${(60 + 150 * (.3 + .7 * Math.abs(Math.sin(k * 1.7 + 1)))).toFixed(0)}px"></div>`).join('')}
    <svg width="100%" height="100%" viewBox="0 0 744 280" preserveAspectRatio="none" style="position:absolute;inset:0"><path data-line d="M20 220 C 120 200, 160 150, 260 160 S 420 90, 520 110 S 660 40, 724 40" fill="none" stroke="#1A1512" stroke-width="4" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1"/></svg></div>`],
]

function buildApps(s) {
  const n = 6
  const lab = label(s, '03', 'Web apps', 'Built around how you work', lineStart(n))
  const L = M({
    land: { cy: 70, flat: [[-600, 70], [0, 70], [600, 70]], fs: .7, sp: 780, cs: 1, pill: 385 },
    port: { cy: -20, flat: [[0, -355], [0, 30], [0, 415]], fs: .66, sp: 800, cs: 1.12, pill: 440 },
    sq:   { cy: 40, flat: [[-205, -30], [205, -30], [0, 240]], fs: .46, sp: 600, cs: .78, pill: 330 },
    tall: { cy: 30, flat: [[0, -290], [0, 30], [0, 350]], fs: .56, sp: 680, cs: .9, pill: 390 },
  })
  const wins = APPS.map(([nm, body]) => {
    const e = h('div', 'appwin', s.cam, `<div class="abar"><i></i><i></i><i></i><b>${nm}</b></div><div class="abody">${body}</div>`)
    e._parts = [...e.querySelectorAll('.abody > .pc')].filter(x => !x.dataset.stamp)
    return e
  })
  const r = rng(51)
  wins.forEach(w => w._parts.forEach(p => { p._dx = (r() - .5) * 700; p._dy = (r() - .5) * 500; p._r = (r() - .5) * 40; p._d = r() }))
  const us = [...wins[0].querySelectorAll('[data-u]')], vals = [...wins[1].querySelectorAll('[data-v]')], stamp = wins[1].querySelector('[data-stamp]')
  const kv = [...wins[2].querySelectorAll('[data-v]')], dbars = [...wins[2].querySelectorAll('.bar')], dline = wins[2].querySelector('[data-line]')
  const capBox = h('div', 'abs', s.cam)
  const caps = ['Client portals', 'Quotes', 'Dashboards'].map(x => { const e = h('div', 'abs capill', capBox, `${spark(22)}<span>${x}</span>`); return e })
  const tBuilt = wt(n, 'built'), tWork = wt(n, 'work')
  const tF = [wt(n, 'portals'), wt(n, 'quotes'), wt(n, 'dashboards')]
  const partT = (w, p) => tBuilt - .15 + p._d * (tWork - tBuilt + .1)
  wins.forEach(w => w._parts.forEach((p, k) => { if (k % 2 === 0) cue('blip', partT(w, p) + .3, { v: .2 }) }))
  cue('whoosh', tBuilt - .1, { d: .6, v: .5 })
  tF.forEach((x, i) => { cue('swish', x - .1, { v: .6 }); cue('flip', x - .05, { v: .5 }) })
  cue('hit', tF[1] + .3, { v: .5 }); cue('tick', tF[1] + .32, { v: .8 })
  WIPES.push({ t: s.t1 })
  cue('wipe', s.t1)

  return t => {
    camera(s, t, { inT: 'whip', outT: 'none', inDur: .22 })
    focus(s, t, [[s.t0, 0, 0, 1, 0, 0], [s.t1, 0, 0, 1.03, 0, 0]])
    lab(t)
    // from all three laid out, to a carousel that turns to each as it is named
    const k = P(t, tF[0] - .4, tF[0] + .05, E.io)
    const f = P(t, tF[1] - .22, tF[1] + .1, E.io) + P(t, tF[2] - .22, tF[2] + .1, E.io)
    wins.forEach((e, i) => {
      const d = i - f, ad = Math.abs(d)
      const cf = { x: d * L.sp, y: L.cy, z: -Math.min(1.4, ad) * 420, ry: -Math.max(-1, Math.min(1, d)) * 28, s: L.cs }
      const fl = { x: L.flat[i][0], y: L.flat[i][1], z: 0, ry: 0, s: L.fs }
      const pin = P(t, s.t0 + .05 + i * .06, s.t0 + .4 + i * .06, E.out)
      put(e, { x: lerp(fl.x, cf.x, k), y: lerp(fl.y, cf.y, k) + (1 - pin) * 50, z: lerp(fl.z, cf.z, k), ry: lerp(fl.ry, cf.ry, k), s: lerp(fl.s, cf.s, k), o: pin * (1 - P(ad * k, 1.3, 1.9, E.lin)), bright: lerp(1, lerp(1, .5, Math.min(1, ad)), k) })
      e.style.zIndex = String(10 - Math.round(ad * k * 3))
      e._parts.forEach(p => {
        const a = P(t, partT(e, p), partT(e, p) + .35, E.out)
        p.style.transform = `translate(${((1 - a) * p._dx).toFixed(1)}px,${((1 - a) * p._dy).toFixed(1)}px) rotate(${((1 - a) * p._r).toFixed(1)}deg)`
        p.style.opacity = P(t, partT(e, p), partT(e, p) + .1).toFixed(3)
      })
    })
    // each app does its thing as it is named
    us.forEach(u => { u.style.transform = `scaleX(${(+u.dataset.u * P(t, tF[0], tF[0] + .5, E.out)).toFixed(3)})` })
    const qv = P(t, tF[1] - .05, tF[1] + .35, E.out)
    vals.forEach(v => { const x = Math.round(+v.dataset.v * qv); v.textContent = '£' + x.toLocaleString('en-GB') })
    const sp = P(t, tF[1] + .3, tF[1] + .5, E.snap)
    stamp.style.transform = `rotate(-8deg) scale(${lerp(1.8, 1, sp).toFixed(3)})`; vis(stamp, P(t, tF[1] + .3, tF[1] + .36))
    const dv = P(t, tF[2] - .05, tF[2] + .45, E.out)
    kv.forEach(v => { const x = +v.dataset.v; v.textContent = x % 1 ? (x * dv).toFixed(1) : Math.round(x * dv) })
    dbars.forEach((b, j) => { b.style.transform = `scaleY(${P(t, tF[2] - .05 + j * .025, tF[2] + .3 + j * .025, E.back).toFixed(3)})` })
    dline.style.strokeDashoffset = (1 - P(t, tF[2] + .1, tF[2] + .7, E.io)).toFixed(4)
    // the caption says which one
    put(capBox, { y: L.pill })
    caps.forEach((e, i) => slot(e, t, tF[i] - .08, i < 2 ? tF[i + 1] - .12 : null, { dy: 60 }))
  }
}

/* ============================================================
   07 · EVERY SCREEN: fast, sharp, and on every screen
   ============================================================ */
const DESK = blocks([
  ['d', 4, 5, 9, 5], ['', 58, 6, 7, 3], ['', 68, 6, 7, 3], ['', 78, 6, 7, 3], ['d', 88, 4.5, 8, 6, 'border-radius:20px'],
  ['d', 4, 20, 44, 8], ['d', 4, 31, 32, 8], ['', 4, 45, 40, 3.5], ['', 4, 51, 30, 3.5], ['a', 4, 60, 16, 8, 'border-radius:8px'], ['', 22, 60, 14, 8, 'border-radius:8px'],
  ['', 54, 18, 42, 52, ART], ['m', 4, 76, 29, 17], ['m', 35.5, 76, 29, 17], ['m', 67, 76, 29, 17],
])
const TAB = blocks([
  ['d', 6, 4, 16, 4], ['', 82, 4, 12, 4], ['d', 6, 13, 80, 6], ['d', 6, 21, 60, 6], ['', 6, 30, 76, 2.5], ['', 6, 35, 60, 2.5], ['a', 6, 41, 34, 6, 'border-radius:8px'],
  ['', 6, 51, 88, 26, ART], ['m', 6, 81, 42, 14], ['m', 52, 81, 42, 14],
])
const PH = blocks([
  ['d', 8, 6, 22, 3.5], ['', 76, 6, 16, 3.5], ['d', 8, 15, 84, 5], ['d', 8, 21.5, 64, 5], ['', 8, 30, 80, 2.2], ['', 8, 34, 60, 2.2], ['a', 8, 40, 84, 6, 'border-radius:8px'],
  ['', 8, 50, 84, 25, ART], ['m', 8, 79, 84, 15],
])

function buildScreens(s) {
  const n = 7
  const L = M({
    land: { tx: -390, g: 1, big: [0, 60, 1.2], D: [[-330, 20, .85], [260, 60, 1], [575, 70, 1]] },
    port: { tx: -700, g: 1, big: [0, -80, 1.15], D: [[0, -190, 1.12], [-215, 420, 1], [230, 430, 1]] },
    sq:   { tx: -390, g: 1, big: [0, 70, .95], D: [[-250, 40, .66], [185, 70, .72], [395, 75, .72]] },
    tall: { tx: -540, g: 1, big: [0, 0, 1.05], D: [[0, -170, .98], [-190, 330, .86], [200, 340, .86]] },
  })
  const devs = [['desk', DESK], ['tab', TAB], ['ph', PH]].map(([c, b]) => {
    const e = h('div', 'dev ' + c, s.cam, `<div class="scr">${b}<div class="glint"></div></div>${c === 'desk' ? '<div class="neck"></div><div class="base"></div>' : ''}`)
    e._bl = [...e.querySelectorAll('.scr > .b')]; e._scr = e.querySelector('.scr'); e._gl = e.querySelector('.glint')
    return e
  })
  const lines = Array.from({ length: 24 }, () => h('div', 'speedline2', s.cam))
  const r = rng(61); lines.forEach(e => { e._y = (r() - .5) * H * .9; e._l = 200 + r() * 500; e._v = 2800 + r() * 2200; e._p = r() })
  const dot = h('div', 'abs', s.cam); dot.style.background = '#E9AC57'; dot.style.boxShadow = '0 0 30px rgba(233,172,87,.7)'
  const DS = M({ land: 46, def: 40 }); dot.style.width = dot.style.height = DS + 'px'
  const SL = [['Fast.', 'fast'], ['Sharp.', 'sharp'], ['On every screen.', 'on'], ['Yours to keep.', 'yours']]
  const at = SL.map(([, k]) => wt(n, k))
  const slams = SL.map(([x]) => { const e = h('div', 'abs display slam', s.cam); e.textContent = x; e._y = L.tx; return e })
  const tFast = at[0], tSharp = at[1], tEvery = wt(n, 'every'), tScreen = wt(n, 'screen')
  const tIn = [tEvery - .02, tEvery + .12, tScreen + .06]
  const tGather = s.t1 - .55
  cue('zip', tFast - .08, { d: .4 }); cue('tick', tFast + .12, { v: .8 })
  cue('swish', tSharp - .02, { v: .6 }); cue('shimmer', tSharp, { d: .7, v: .45 })
  cue('whoosh', tEvery, { d: .4, v: .5 }); cue('pop', tIn[1] + .05, { v: .55 }); cue('pop', tIn[2] + .05, { v: .6 })
  at.forEach((x, i) => cue('hit', x - .02, { v: i === 3 ? .7 : .45 }))
  cue('implode', s.t1, { d: .55 })

  return t => {
    camera(s, t, { inT: 'none', outT: 'none', push: .02 })
    slams.forEach((e, i) => slot(e, t, at[i] - .06, i < 3 ? at[i + 1] - .1 : tGather, { dy: 110 }))
    const mv = P(t, tEvery - .1, tEvery + .25, E.io)
    const g = P(t, tGather, s.t1, E.in3)
    devs.forEach((e, i) => {
      const [x, y, sc] = L.D[i]
      let px, py, ps, o
      if (i === 0) { px = lerp(L.big[0], x, mv); py = lerp(L.big[1], y, mv); ps = lerp(L.big[2], sc, mv); o = 1 }
      else { const p = P(t, tIn[i], tIn[i] + .35, E.snap); px = x; py = y + (1 - Math.min(1, p)) * 80; ps = sc * lerp(.6, 1, p); o = P(t, tIn[i], tIn[i] + .08) }
      const fl = Math.sin(t * 1.6 + i * 1.3) * 6 * mv
      put(e, { x: lerp(px, 0, g), y: lerp(py + fl, 0, g), s: ps * lerp(1, .04, g), r: g * (i - 1) * 20, o: o * (1 - P(g, .7, 1, E.lin)) })
      // the page loads fast, then snaps sharp
      const ld = i === 0 ? tFast : tIn[i] + .05
      e._bl.forEach((b, k) => { const p = P(t, ld + k * .012, ld + .14 + k * .012, E.out); b.style.opacity = p.toFixed(3); b.style.transform = `scale(${lerp(.85, 1, p).toFixed(3)})` })
      const soft = i === 0 ? 4 * P(t, tFast, tFast + .1) * (1 - P(t, tSharp - .04, tSharp + .06)) : 0
      e._scr.style.filter = soft > .05 ? `blur(${soft.toFixed(2)}px)` : 'none'
      const gp = P(t, (i ? tIn[i] + .25 : tSharp - .02), (i ? tIn[i] + .65 : tSharp + .35), E.io)
      e._gl.style.left = lerp(-50, 130, gp).toFixed(1) + '%'; vis(e._gl, gp > 0 && gp < 1 ? 1 : 0)
    })
    const sp = bell(t, tFast - .12, tFast + .02, tSharp - .05)
    lines.forEach(e => {
      const x = ((e._p * 3000 - (t - tFast) * e._v) % 3000 + 3000) % 3000 - 1500
      e.style.width = e._l + 'px'
      e.style.transform = `translate(${(W / 2 + x).toFixed(1)}px,${(H / 2 + e._y).toFixed(1)}px)`
      vis(e, sp * .8)
    })
    put(dot, { s: P(g, .55, 1, E.out), o: P(g, .5, .7) })
  }
}

/* ---------- the film: its scenes, in order, and its ground ---------- */
export default function setup() {
  scene(['sit', 'work'], buildSite)
  scene(['builds'], buildBuilds)
  scene(['landing'], buildLanding)
  scene(['booking'], buildBooking)
  scene(['apps'], buildApps)
  scene(['screens'], buildScreens)
  scene(['end'], s => endCard(s, { line: 8, tag: "Let's build yours", first: "let's", last: 'yours' }))
  const sc = sceneById
  const tW = wt(2, 'work'), dotT = wt(8, 'n.abl')
  // [time, ax, ay, aStrength, cx, cy, cStrength, grid]
  const ground = [
    [0, .3, .5, .12, .7, .6, .25, 0],
    [tW - .04, .45, .5, .22, .6, .5, .3, 0],
    [tW + .06, .6, .45, 1.35, .5, .5, .7, 0],
    [sc('builds').start, .5, .4, .7, .5, .75, .45, .5],
    [sc('landing').start, .2, .3, .7, .85, .8, .5, .6],
    [sc('booking').start, .8, .3, .6, .2, .8, .45, .6],
    [sc('apps').start, .5, .35, .75, .5, .85, .5, .3],
    [sc('screens').start, .5, .5, .8, .5, .6, .5, 0],
    [sc('end').start, .5, .45, .55, .5, .7, .4, 0],
    [dotT, .5, .45, .8, .5, .7, .45, 0],
    [dotT + .12, .5, .45, 1.1, .5, .7, .55, 0],
    [TL.duration, .5, .45, .85, .5, .7, .45, 0],
  ]

  return { ground, bug: ['landing', 'end'] }
}
