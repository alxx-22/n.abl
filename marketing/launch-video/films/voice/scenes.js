/* ============================================================
   THE VOICE REEL: n.abl's AI receptionist takes a booking, in 11 seconds

   The grammar of the AI reel (films/reel), from the same kit: a dark stage
   lit softly from above, a 3D camera on a smooth path smearing the frame
   along its own motion, pieces that blur in and turn into each other
   through light, every move on a beat of the melodic track. One story, the
   one a prospect sees in their own demo:

   call  Luca's Trattoria's phone rings; on the drop the AI picks up; the
         caller asks for a table for four on Friday at half seven; the AI
         books it on the terrace, and its answer flares into a point
   plan  the point falls onto tonight's floor plan, lying almost flat; on
         the second drop it lands on table 12, which lights up, booked by AI,
         as the camera tilts up to face it
   text  a whip to the guest's phone: the confirmation lands
   end   the name on the hit, and the offer: a personalised demo
   The script is films/voice/film.py; the brief is films/voice/SCRIPT.md.
   ============================================================ */

import { E, LAND, M, P, TL, WORDMARK, bell, cue, h, icon, lerp, put, rise, scene, sceneById, spark, vis, words } from '../../film/stage.js'
import { AMB, WHITE, blurIn, bokeh, drop, lens, path, pop, shoot, widen } from '../../film/kit.js'

const B = TL.beat
const beat = k => k * B                                   // the reel is choreographed on the track's own beat

/* ---------- captions: a few words naming each step as it happens ---------- */
const STEPS = []
const step = (t, txt) => STEPS.push([t, txt])

/* the world point at the centre of element e inside a positioned box at (bx, by) */
function centre(e, box, bx, by) {
  return [bx - box.offsetWidth / 2 + e.offsetLeft + e.offsetWidth / 2, by - box.offsetHeight / 2 + e.offsetTop + e.offsetHeight / 2]
}

/* ============================================================
   CALL: the phone rings; the AI picks up on the drop; the caller asks; the
   AI books it, and its answer flares into a point of light.
   ============================================================ */
function buildCall(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const specks = bokeh(s, 21, { cx: 120 })
  const card = h('div', 'r-panel', s.cam, `
    <div class="r-ph"><span class="av ph">${icon('phone')}<i></i><i></i></span><div><div class="t">Luca’s Trattoria</div><div class="s">Reservations · 0115 496 0321</div></div><span class="on st">● RINGING</span></div>
    <div class="r-thread">
      <div class="r-tx"><span class="mic">CALLER</span><span class="q"></span></div>
      <div class="r-m ai a1"><span class="r-dots"><i></i><i></i><i></i></span><span class="txt"></span></div>
    </div>`)
  if (!LAND) card.style.width = '760px'
  const [head] = card.children
  const av = head.querySelector('.av'), rings = [...av.querySelectorAll('i')], st = head.querySelector('.st')
  const [mQ, mA] = card.querySelector('.r-thread').children
  const qW = words(mQ.querySelector('.q'), '“Table for four, Friday at half seven?”')
  const dots = mA.querySelector('.r-dots'), aW = words(mA.querySelector('.txt'), 'Booked: Friday, 7:30, four of you, on the terrace.')
  const dot = h('div', 'r-dot', s.cam)

  const tRing = t0 + .06, tDrop = beat(3), tQ = tDrop + .1, tDots = beat(4.5), tA = tDots + .22, tFlare = t1 - .14
  cue('ring', tRing, { v: .7 })                            // the restaurant's phone rings
  cue('riser', tDrop, { d: 1.4 })
  cue('m_drop', tDrop)
  cue('whoosh', tDrop - .04, { d: .45, v: .6 })            // the camera swings round
  cue('connect', tDrop, { v: .6 })                         // the AI picks up
  cue('type', tQ, { d: qW.length * .055 + .1, v: .25 })    // what the caller asks, transcribed
  ;[0, 1, 2].forEach(i => drop(tDots + .04 + i * .08, 1 + i, { wet: .9, v: .22 }))
  cue('msgin', tA, { v: .7 })                              // booked
  cue('confirm', tA + .5, { n: 2, v: .6 })
  cue('implode', tFlare + .1, { d: .3 })                   // the answer flares into a point
  step(tDrop, 'Answers every call'); step(tA, 'Books the table')

  let cam = null
  function layout() {
    const H = centre(head, card, 0, 0), Q = centre(mQ, card, 0, 0), A = centre(mA, card, 0, 0)
    const land = LAND, x = v => land ? v : v * .25            // a tall frame stays near the card's middle, so it keeps its edges
    cam = path([
      [t0, x(H[0]) + (land ? 180 : 70), H[1] + 70, -320, 18, land ? -30 : -18, -3, 1],
      [tDrop - .1, x(H[0]) + (land ? 120 : 40), H[1] + 40, -60, 12, land ? -22 : -14, -1.5, 1],
      [tDrop + .28, x(H[0]), H[1] + 20, 150, 4, 4, 0, 1],
      [tQ + .5, x(Q[0]), Q[1], 240, 3, 2, 0, 1],
      [tA + .5, x(A[0]), A[1], 300, 2, -3, 0, 1],
      [t1, x(A[0]), A[1] - 30, 460, 6, -2, 0, 1],
    ])
  }

  return t => {
    if (!cam) layout()
    specks(t)
    put(card, { o: P(t, t0, t0 + .2) * (1 - P(t, tFlare + .05, t1, E.in2)), blur: P(t, tFlare, t1, E.in2) * 14 })
    // ringing, then answered on the drop
    const on = t >= tDrop
    rings.forEach((e, i) => {
      const ph = ((t - tRing) / .9 + i * .5) % 1
      e.style.transform = `scale(${(1 + ph * 1.1).toFixed(3)})`
      e.style.opacity = (t < tRing || on ? 0 : (1 - ph) * .7).toFixed(3)
    })
    av.style.transform = `rotate(${(on ? 0 : 9 * Math.sin(t * 42) * (P(t, tRing, tRing + .1) - P(t, tRing + .3, tRing + .42) + P(t, tRing + .42, tRing + .52) - P(t, tRing + .72, tRing + .84))).toFixed(2)}deg)`
    st.textContent = on ? '● n.abl AI ANSWERED' : '● RINGING'
    st.classList.toggle('ans', on)
    // what they ask, and the answer
    vis(mQ, P(t, tQ - .05, tQ + .1))
    qW.forEach((e, i) => rise(e, t, tQ + i * .055, { dur: .24, dy: 10, blur: 10 }))
    pop(mA, t, tDots)
    dots.style.display = t < tA ? 'inline-flex' : 'none'
    dots.querySelectorAll('i').forEach((d, k) => { d.style.opacity = (.35 + .65 * Math.max(0, Math.sin((t * 3 - k * .22) * Math.PI))).toFixed(3) })
    mA.querySelector('.txt').style.display = t < tA ? 'none' : 'inline'
    aW.forEach((e, i) => rise(e, t, tA + i * .03, { dur: .22, dy: 8, blur: 8 }))
    // the answer glows, flares white, and is a point of light
    const glow = bell(t, tA + .3, tFlare, t1)
    mA.style.boxShadow = `0 0 ${(20 + 70 * glow).toFixed(0)}px rgba(${AMB},${(.2 + .6 * glow).toFixed(2)})`
    const A = centre(mA, card, 0, 0)
    put(dot, { x: A[0], y: A[1], s: 1 + 2.5 * bell(t, tFlare, t1 - .02, t1 + .1), o: P(t, tFlare, t1 - .04) })
    const mb = shoot(s, cam, t)
    lens(s, { mbX: mb.mbX, mbY: mb.mbY, bright: 1 + .35 * bell(t, tFlare, t1, t1 + .1) })
  }
}

/* ============================================================
   PLAN: tonight's floor plan, lying almost flat under the camera. The
   point of light falls onto it; on the second drop it lands on table 12,
   which lights up, booked by AI, as the camera tilts up to face it.
   ============================================================ */
// [number, x, y, w, h, round, booked already]: centred on the plan, inside on the left, the terrace on the right
const TABLES = [
  [1, -500, -150, 74, 74, 0, 0], [2, -380, -150, 74, 74, 0, 1], [3, -230, -150, 124, 82, 0, 0], [4, -60, -150, 124, 82, 0, 1],
  [5, -440, 50, 112, 112, 1, 1], [6, -230, 50, 124, 82, 0, 0], [7, -60, 50, 124, 82, 0, 1],
  [8, -500, 240, 74, 74, 0, 0], [9, -380, 240, 74, 74, 0, 1], [10, -170, 240, 190, 82, 0, 0],
  [11, 350, -200, 74, 74, 0, 0], [12, 510, -200, 124, 82, 0, 0], [13, 350, 20, 124, 82, 0, 1], [14, 520, 20, 74, 74, 0, 0],
  [15, 430, 230, 104, 104, 1, 1],
]
function buildPlan(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const specks = bokeh(s, 22, { w: 3000, hgt: 2200 })
  const plan = h('div', 'v-plan', s.cam, `
    <svg width="1300" height="820" viewBox="-650 -410 1300 820">
      <rect class="room" x="-620" y="-380" width="860" height="760" rx="40"/>
      <rect class="terr" x="270" y="-380" width="350" height="760" rx="40"/>
      <rect class="bar" x="-560" y="-330" width="440" height="56" rx="16"/>
      <path class="win" d="M255 -300 v120 M255 -60 v120 M255 180 v120"/>
      <text class="lbl" x="-590" y="-398">Inside</text><text class="lbl" x="290" y="-398">Terrace</text>
      <text class="lbl dim" x="-340" y="-296" text-anchor="middle">Bar</text>
    </svg>
    <div class="v-when">${icon('clock')}<span>Friday · 7:30 pm</span></div>`)
  const tbs = TABLES.map(([n, x, y, w, hh, rnd, bk]) => {
    const e = h('div', 'v-tb' + (rnd ? ' rnd' : '') + (bk ? ' bk' : ''), plan, String(n))
    Object.assign(e.style, { left: (650 + x - w / 2) + 'px', top: (410 + y - hh / 2) + 'px', width: w + 'px', height: hh + 'px' })
    return e
  })
  const T12 = TABLES[11], t12 = tbs[11]
  const ring = h('div', 'abs', s.cam); Object.assign(ring.style, { width: '140px', height: '140px', borderRadius: '50%', border: `3px solid rgba(${AMB},.9)` })
  const dot = h('div', 'r-dot', s.cam)
  const streak = h('div', 'abs', s.cam); Object.assign(streak.style, { width: '6px', borderRadius: '3px', background: `linear-gradient(180deg, transparent, rgba(${WHITE},.85))` })
  const tag = h('div', 'v-tag', s.cam, `<div class="t">Table 12 · 4 guests · 7:30 pm</div><div class="by">${spark(18)}<span>Booked by AI</span></div>`)

  const tHit = beat(11)                                     // the second drop
  const tFall = tHit - .45, tTag = tHit + .22
  cue('whoosh', t0 + .02, { d: .5, v: .5 })                 // down onto the plan
  cue('draw', t0 + .12, { d: .5, v: .4 })
  cue('fall', tFall, { d: .45, v: .6 })                     // the point falls
  drop(tHit, 0, { n: 2, step: 3, gap: .05, wet: .85, v: .8 }) // and lands on table 12
  cue('confirm', tHit + .2, { n: 2, deg: 4, v: .55 })
  cue('swish', tTag, { v: .4 })
  cue('whoosh', t1 - .16, { d: .4, v: .6 })                 // the whip to the guest's phone
  step(tHit, 'Puts it on your floor plan')

  const land = LAND, X = T12[1], Y = T12[2]
  const cam = path([
    [t0, X * .35, Y * .2 + 120, -420, 54, -6, -8, 1],
    [tFall, X * .8, Y * .8, -150, 46, -4, -4, 1],
    [tHit, X, Y, 90, 30, -2, 0, 1],
    [tHit + .55, X, Y - 40, 200, 16, 2, 0, 1],
    [t1 - .2, X + 30, Y - 50, 230, 12, 6, 0, 1],
    [t1, X + (land ? 520 : 380), Y - 50, 230, 12, 14, 0, 1],      // and whips right
  ])
  const tagY = Y - T12[4] / 2 - 92

  return t => {
    specks(t)
    // the plan draws in, tables arriving across it
    put(plan, { o: P(t, t0, t0 + .25), blur: (1 - P(t, t0, t0 + .3)) * 10 })
    tbs.forEach((e, i) => {
      const a = t0 + .08 + (TABLES[i][1] + 620) / 1240 * .5
      const p = P(t, a, a + .24, E.out)
      e.style.opacity = p.toFixed(3); e.style.transform = `scale(${lerp(.6, 1, p).toFixed(3)})`
    })
    // the point falls out of the dark onto table 12
    const f = P(t, tFall, tHit, E.in2)
    put(dot, { x: X, y: Y, z: lerp(900, 0, f), o: P(t, t0 + .02, t0 + .1) * (1 - P(t, tHit + .02, tHit + .12)) })
    const sl = 220 * f * (1 - P(t, tHit - .02, tHit + .03))
    streak.style.height = Math.max(1, sl).toFixed(0) + 'px'
    put(streak, { x: X, y: Y, z: lerp(900, 0, f) + sl / 2, rx: 90, o: sl > 2 ? .8 : 0 })
    // table 12 lights up, booked
    const lit = t >= tHit
    t12.classList.toggle('hot', lit)
    t12.style.transform = `scale(${(1 + .18 * bell(t, tHit, tHit + .06, tHit + .4)).toFixed(3)})`
    const rp = P(t, tHit, tHit + .6, E.out)
    put(ring, { x: X, y: Y, z: 2, s: lerp(.5, 3.4, rp), o: lit ? (1 - rp) * .9 : 0 })
    blurIn(tag, t, tTag, { x: X, y: tagY, z: 40, dur: .3, s0: .9, blur: 14, dy: 16 })
    const mb = shoot(s, cam, t, { shake: 5 * bell(t, tHit, tHit + .03, tHit + .22) })
    const out = P(t, t1 - .1, t1 + .2, E.in2)
    lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: out * 6, o: 1 - P(t, t1 + .02, t1 + .2), bright: 1 + .3 * bell(t, tHit, tHit + .05, tHit + .3) })
  }
}

/* ============================================================
   TEXT: whipped round to the guest's phone; the confirmation lands.
   The music breathes out before the name.
   ============================================================ */
function buildText(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const specks = bokeh(s, 23, { hgt: 2400 })
  const phone = h('div', 'r-phone', s.cam, `
    <div class="isl"></div>
    <div class="clk">2:04</div><div class="dt">Wednesday 1 October</div>
    <div class="r-notes"></div>`)
  const note = h('div', 'r-note', phone.querySelector('.r-notes'), `<span class="app msg">${icon('chat')}</span><div class="tx"><div class="hd"><span>Messages</span><span>now</span></div><div class="t">Luca’s Trattoria</div><div class="b">Booked: Fri 7:30 pm, 4 people, terrace. Ref KX4Q7. To change it, call us and quote your reference.</div></div>`)
  const tNote = beat(13.5), tGap = t1 - beat(.5)
  cue('msgin', tNote, { v: .75 })                           // the text lands
  drop(tNote + .05, 3, { wet: .75, v: .5 })
  cue('m_gap', tGap, { d: t1 - tGap })                      // a breath before the name
  step(tNote, 'Texts your guest')

  let cam = null
  function layout() {
    const n = centre(note, phone, 0, 0)
    cam = path([
      [t0, -620, n[1] + 40, 160, 4, -26, 2, 1],                     // arriving from the whip
      [t0 + .22, -60, n[1] + 20, 210, 6, -8, 0, 1],
      [tNote + .3, 0, n[1], 300, 4, -2, 0, 1],
      [t1, 10, n[1] - 10, 360, 2, 3, 0, 1],
    ])
  }

  return t => {
    if (!cam) layout()
    specks(t)
    put(phone, { o: 1 })
    const p = P(t, tNote, tNote + .34, E.snap)
    note.style.opacity = Math.min(1, P(t, tNote, tNote + .12)).toFixed(3)
    note.style.transform = `translateY(${((1 - Math.min(1, p)) * -70).toFixed(1)}px) scale(${lerp(.92, 1, Math.min(1.03, p)).toFixed(4)})`
    const bl = (1 - P(t, tNote, tNote + .24)) * 14
    note.style.filter = bl > .05 ? `blur(${bl.toFixed(1)}px)` : 'none'
    note.style.boxShadow = `0 20px 50px rgba(0,0,0,.45), 0 0 ${(50 * bell(t, tNote, tNote + .1, tNote + .9)).toFixed(0)}px rgba(${AMB},.35)`
    const mb = shoot(s, cam, t)
    const come = 1 - P(t, t0, t0 + .2, E.out)
    lens(s, { mbX: Math.max(mb.mbX, come * 30), mbY: mb.mbY, o: 1 - P(t, t1 - .04, t1 + .02) })
  }
}

/* ============================================================
   END: the name blurs into focus on the hit; then the offer.
   ============================================================ */
function buildEnd(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const specks = bokeh(s, 24)
  const MW = M({ land: 600, def: 560 })
  const mark = h('div', 'r-mark', s.cam, WORDMARK()); mark.firstChild.setAttribute('width', MW)
  const tag = h('div', 'r-tagl', s.cam, 'An AI receptionist, built for your business.')
  const cta = h('div', 'v-cta', s.cam, `<div class="sheen"></div><span style="width:28px;height:28px;display:inline-flex">${spark(28)}</span><span>Book your personalised demo</span>`)
  const sheen = cta.querySelector('.sheen')
  const url = h('div', 'r-url', s.cam, '<b>nabl.agency</b>')
  const tTag = t0 + beat(.75), tCta = t0 + beat(1.5)
  const yM = -150, yT = -30, yC = 90, yU = 180
  const cam = path([[t0, 0, -40, 220, 0, -8, 0, 1], [tCta, 0, -20, 40, 0, -2, 0, 1], [t1, 0, -10, -40, 0, 3, 0, 1]])
  cue('impact', t0 + .01, { v: .7 })                        // the name lands
  cue('shimmer', t0 + .03, { d: 1.8, v: .4 })
  drop(tTag, 2, { wet: .9, v: .35 })
  cue('confirm', tCta, { n: 2, deg: 1, v: .4 })             // the offer
  return t => {
    const p = P(t, t0, t0 + .3, E.out)
    put(mark, { y: yM, s: lerp(1.14, 1, p), o: Math.min(1, p * 1.5), blur: (1 - p) * 36 })
    mark.firstChild.style.filter = `drop-shadow(0 0 ${(40 * bell(t, t0, t0 + .06, t0 + .9)).toFixed(1)}px rgba(${AMB},.45))`
    blurIn(tag, t, tTag, { y: yT, dur: .32, s0: 1, blur: 14, dy: 14 })
    blurIn(cta, t, tCta, { y: yC, dur: .34, s0: .94, blur: 18, dy: 18 })
    sheen.style.left = lerp(-70, 110, P(t, tCta + .1, tCta + .9, E.io)).toFixed(1) + '%'
    cta.style.boxShadow = `0 0 ${(30 + 50 * bell(t, tCta + .1, tCta + .4, tCta + 1.2)).toFixed(0)}px rgba(${AMB},.3)`
    blurIn(url, t, tCta + .2, { y: yU, dur: .3, s0: 1, blur: 12, dy: 10 })
    specks(t, 1 - P(t, t1 - .5, t1))
    shoot(s, cam, t)
    lens(s, { o: 1 - P(t, t1 - .35, t1, E.in2) })
  }
}

/* the title, over the opening, and the step captions, low and steady */
function buildWords(s) {
  const pos = M({ land: [-960 + 96, -540 + 118], port: [0, -760], sq: [0, -450], tall: [0, -570] })
  const chap = h('div', 'abs r-chap', s.root, `<div class="eb">${spark(18)}<span>AI receptionist</span><span style="color:#8B8175">n.abl</span></div><div class="ln">Never miss a booking.</div>`)
  const at = M({ land: [0, 420], sq: [0, 430], tall: [0, 520], port: [0, 500] })
  const list = STEPS.slice().sort((a, b) => a[0] - b[0])
  const els = list.map(([, txt]) => h('div', 'abs r-step', s.root, `<span class="dot"></span><span>${txt}</span>`))
  const end = sceneById('text').end - .2
  return t => {
    const pi = P(t, .25, .6, E.out), po = P(t, 2.9, 3.15, E.in2), w = chap.offsetWidth
    put(chap, { x: LAND ? pos[0] + w / 2 : pos[0], y: pos[1] + (1 - pi) * 14 - po * 10, o: pi * (1 - po), blur: (1 - pi) * 12 + po * 12 })
    list.forEach(([ta], i) => {
      const tz = i + 1 < list.length ? list[i + 1][0] : end
      const a = P(t, ta, ta + .22, E.out), z = P(t, tz - .02, tz + .14, E.in2)
      put(els[i], { x: at[0], y: at[1] + (1 - a) * 12, o: a * (1 - z), blur: (1 - a) * 10 + z * 8 })
    })
  }
}

export default function setup() {
  scene(['call'], buildCall, { hold: .04 })
  scene(['plan'], buildPlan, { hold: .2 })
  scene(['text'], buildText)
  scene(['end'], buildEnd)
  scene(['call', 'text'], buildWords)
  const sc = sceneById
  const tDrop = sc('call').start + beat(3)
  // [time, ax, ay, aStrength, cx, cy, cStrength, grid]: amber low in the middle, the light from above
  const ground = [
    [0, .5, .6, .15, .5, -.08, .6, 0],
    [tDrop, .5, .6, .3, .5, -.06, .9, 0],
    [sc('plan').start, .55, .55, .4, .5, -.06, .95, 0],
    [beat(11), .6, .55, .7, .5, -.06, 1, 0],
    [beat(11) + .5, .55, .55, .4, .5, -.06, .95, 0],
    [sc('text').start, .5, .55, .3, .5, -.08, .9, 0],
    [sc('end').start - .02, .5, .5, .6, .5, -.06, 1, 0],
    [sc('end').start + .1, .5, .5, 1.25, .5, -.06, 1, 0],
    [sc('end').start + .8, .5, .5, .45, .5, -.08, .95, 0],
    [TL.duration - .3, .5, .5, .15, .5, -.1, .4, 0],
    [TL.duration, .5, .5, 0, .5, -.1, 0, 0],
  ]
  return { ground, bug: ['end', 'end'] }
}
