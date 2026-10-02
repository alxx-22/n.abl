/* ============================================================
   THE VOICE REEL: n.abl's AI receptionist takes a booking, in 11 seconds

   The grammar of the AI reel (films/reel), from the same kit: a dark stage
   lit softly from above, a 3D camera on a smooth path smearing the frame
   along its own motion, every move on a beat of the melodic track. One
   shape carries the booking from the first frame to the last, changing
   into each next thing rather than cutting to it. The story is the one a
   prospect sees in their own demo:

   call  Luca's Trattoria's phone rings, a circle of light; on the drop the
         AI answers and the circle stretches into the live call; the caller
         asks for a table for four on Friday at half seven; the AI books it
         on the terrace, and the call folds into an amber block
   plan  the camera cranes down after it to tonight's floor plan; on the
         second drop it lands as table 12, booked by AI
   text  a copy lifts off with the whip, lands on the guest's phone and
         opens into the confirmation, then closes to a square of amber
   end   on the hit the square becomes the dot of the name as its letters
         draw; then the offer, a personalised demo
   The script is films/voice/film.py; the brief is films/voice/SCRIPT.md.
   ============================================================ */

import { E, LAND, M, P, TL, WORDMARK, bell, cue, h, icon, lerp, put, rise, rng, scene, sceneById, spark, words } from '../../film/stage.js'
import { AMB, ICE, WHITE, blurIn, bokeh, drop, lens, path, shoot, widen } from '../../film/kit.js'

const B = TL.beat
const beat = k => k * B                                   // the reel is choreographed on the track's own beat

/* ---------- captions: a few words naming each step as it happens ---------- */
const STEPS = []
const step = (t, txt) => STEPS.push([t, txt])

/* the world point at the centre of element e inside a positioned box at (bx, by) */
function centre(e, box, bx, by) {
  return [bx - box.offsetWidth / 2 + e.offsetLeft + e.offsetWidth / 2, by - box.offsetHeight / 2 + e.offsetTop + e.offsetHeight / 2]
}

/* ---------- the shape: one piece carries the booking through the reel ---------- */
const mix = (c1, c2, p) => c1.split(',').map((v, i) => Math.round(lerp(+v, +c2.split(',')[i], p))).join(',')
const DARK = '22,19,16', HOT = '246,207,148', GLASS = '64,57,50'
/* size, corners, fill and rim of a v-blk, set each frame */
function shape(e, { w, h: hh, r, fill, fa = 1, rim, ra = 1, glow = 0, gc = AMB }) {
  e.style.width = w.toFixed(1) + 'px'; e.style.height = hh.toFixed(1) + 'px'; e.style.borderRadius = r.toFixed(1) + 'px'
  e.style.background = `rgba(${fill},${fa.toFixed(3)})`; e.style.borderColor = `rgba(${rim},${ra.toFixed(3)})`
  e.style.boxShadow = glow > .01 ? `0 0 ${(60 * glow).toFixed(0)}px rgba(${gc},${(.7 * glow).toFixed(3)})` : 'none'
}

/* ============================================================
   CALL + PLAN, one shot: the phone rings as a single circle of light; on
   the drop the AI answers and the circle stretches into the live call, its
   waveform ice while the caller speaks and amber while the AI books it. The
   call folds into an amber block, the camera cranes down to tonight's floor
   plan, and on the second drop the block lands as table 12, booked by AI.
   ============================================================ */
// [number, x, y, w, h, round, booked already]: centred on the plan, inside on the left, the terrace on the right
const TABLES = [
  [1, -500, -150, 74, 74, 0, 0], [2, -380, -150, 74, 74, 0, 1], [3, -230, -150, 124, 82, 0, 0], [4, -60, -150, 124, 82, 0, 1],
  [5, -440, 50, 112, 112, 1, 1], [6, -230, 50, 124, 82, 0, 0], [7, -60, 50, 124, 82, 0, 1],
  [8, -500, 240, 74, 74, 0, 0], [9, -380, 240, 74, 74, 0, 1], [10, -170, 240, 190, 82, 0, 0],
  [11, 350, -200, 74, 74, 0, 0], [12, 510, -200, 124, 82, 0, 0], [13, 350, 20, 124, 82, 0, 1], [14, 520, 20, 74, 74, 0, 0],
  [15, 430, 230, 104, 104, 1, 1],
]
const T12 = TABLES[11]
function buildCallPlan(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1, land = LAND
  const C = [400, -1200]                                    // the call, up the floor from the plan
  const X = T12[1], Y = T12[2]
  const specksA = bokeh(s, 21, { n: 28, cx: C[0], cy: C[1] })
  const specksB = bokeh(s, 22, { w: 3000, hgt: 2200 })

  // the call: a ringing circle, its ripples, who is calling, and what is said
  const RING = 250, WIDE = M({ land: 760, sq: 680, tall: 640, port: 600 }), TALL = 132
  const rips = [0, 1, 2, 3].map(() => { const e = h('div', 'v-rip', s.cam); e.style.width = e.style.height = RING + 'px'; return e })
  const who = h('div', 'v-who', s.cam, `<div class="n">Luca’s Trattoria</div><div class="s"><span class="in">● INCOMING CALL</span><span class="on">● n.abl AI · ON THE CALL</span></div>`)
  const [inS, onS] = who.querySelectorAll('.s span')
  const says = h('div', 'v-says', s.cam)
  says.style.width = M({ land: 1150, sq: 820, tall: 760, port: 700 }) + 'px'
  const qW = words(h('div', 'v-say q', says), '“Table for four, Friday at half seven?”')
  const aW = words(h('div', 'v-say a', says), 'Booked. Friday, 7:30, on the terrace.')

  // tonight's floor plan, lying almost flat, below the call
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
  const t12 = tbs[11]
  const ring = h('div', 'abs', s.cam); Object.assign(ring.style, { width: '140px', height: '140px', borderRadius: '50%', border: `3px solid rgba(${AMB},.9)` })
  const tag = h('div', 'v-tag', s.cam, `<div class="t">Table 12 · 4 guests · 7:30 pm</div><div class="by">${spark(18)}<span>Booked by AI</span></div>`)

  // the shape itself, made last so it flies over everything
  const blk = h('div', 'v-blk', s.cam, `<span class="ph">${icon('phone')}</span><span class="wv">${'<i></i>'.repeat(36)}</span><b class="no">12</b>`)
  const ph = blk.querySelector('.ph'), wv = blk.querySelector('.wv'), bars = [...wv.children], no = blk.querySelector('.no')
  const r = rng(77), BAR = bars.map((_, i) => ({ f: 7 + r() * 9, ph: r() * 6, k: Math.pow(Math.sin(Math.PI * (i + .5) / bars.length), .6) }))
  // and the copy of it that leaves table 12 with the whip, for the guest's phone
  const carry = h('div', 'v-blk', s.cam)

  const tRing = t0 + .06, tDrop = beat(3), tQ = tDrop + .14, tA = beat(4.5), tFold = beat(7), tFly = tFold + .22, tPlan = tFold + .12
  const tHit = beat(11), tTag = tHit + .22, tLift = t1 - .24
  // the booking's flight: down the floor in an arc, turning over once, onto table 12
  const fly = t => {
    const u = P(t, tFly, tHit - .06, E.io), v = P(t, tFly, tHit, E.lin)
    return [lerp(C[0], X, u), lerp(C[1], Y, u), 300 * 4 * v * (1 - v), -360 * (1 - u)]
  }
  // a camera key looking a little down the floor from it, so it rides high in the frame with the plan coming up below
  const follow = (tk, z, rx, ry, rz, ahead) => { const b = fly(tk); return [tk, b[0], b[1] - b[2] * Math.tan(rx * Math.PI / 180) + ahead, z, rx, ry, rz, 1] }
  cue('ring', tRing, { v: .7 })                             // the restaurant's phone rings
  cue('riser', tDrop, { d: 1.4 })
  cue('m_drop', tDrop)
  cue('whoosh', tDrop - .04, { d: .45, v: .6 })             // the camera swings round
  cue('connect', tDrop, { v: .6 })                          // the AI picks up, and the circle stretches into the call
  cue('swish', tDrop + .02, { v: .35 })
  cue('type', tQ, { d: qW.length * .06 + .1, v: .18 })      // what the caller asks
  ;[0, 1, 2].forEach(i => drop(tA - .26 + i * .08, 1 + i, { wet: .45, v: .26 }))   // the AI thinks
  cue('msgin', tA, { v: .7 })                               // booked
  cue('confirm', tA + .5, { n: 2, v: .55 })
  cue('implode', tFold + .16, { d: .3 })                    // the call folds into the booking
  cue('flip', tFold + .2, { v: .4 })
  cue('zip', tFly, { d: .5 })                               // it flies
  cue('draw', tPlan + .08, { d: .5, v: .4 })                // the plan draws in under it
  cue('fall', tHit - .45, { d: .45, v: .6 })                // it falls
  drop(tHit, 0, { n: 2, step: 3, gap: .05, wet: .5, v: .85 }) // and lands as table 12
  cue('confirm', tHit + .2, { n: 2, deg: 4, v: .55 })
  cue('swish', tTag, { v: .4 })
  cue('whoosh', t1 - .16, { d: .4, v: .6 })                 // the whip to the guest's phone
  step(tDrop, 'Answers every call'); step(tA, 'Books the table'); step(tHit, 'Puts it on your floor plan')

  let cam = null, saysY = 0
  function layout() {
    saysY = C[1] + 104 + says.offsetHeight / 2             // the lines hang under the call
    const mid = (C[1] + saysY + says.offsetHeight / 2) / 2
    cam = path([
      [t0, C[0] + (land ? 110 : 44), C[1] + 60, -40, 16, land ? -24 : -15, -3, 1],
      [tDrop - .1, C[0] + (land ? 36 : 14), C[1] + 10, 150, 8, land ? -9 : -5, -1, 1],
      [tDrop + .3, C[0], C[1] + 30, 130, 2, 3, 0, 1],
      [tQ + .6, C[0], lerp(C[1], mid, .6), 160, 2, 1, 0, 1],
      [tA + .6, C[0], mid, 190, 3, -2, 0, 1],
      [tFold, C[0], C[1] + 50, 170, 6, 0, 0, 1],
      follow(tFold + .5, -60, 22, -3, -2, 110),                                   // cranes down the floor after it
      follow(tFold + .95, -160, 34, -4, -3, 170),
      follow(tFold + 1.4, -130, 42, -4, -3, 170),
      [tHit - .3, X - 10, Y + 80, -60, 46, -4, -3, 1],
      [tHit, X, Y, 90, 30, -2, 0, 1],                                             // tilts up to face table 12 on the drop
      [tHit + .55, X, Y - 40, 200, 16, 2, 0, 1],
      [t1 - .2, X + 30, Y - 50, 230, 12, 6, 0, 1],
      [t1, X + (land ? 520 : 380), Y - 50, 230, 12, 14, 0, 1],                    // and whips right
    ])
  }
  const tagY = Y - T12[4] / 2 - 92

  return t => {
    if (!cam) layout()
    specksA(t, 1 - P(t, tFold + .3, tHit))
    specksB(t, P(t, tFold, tFold + .6))
    const callO = P(t, t0, t0 + .2) * (1 - P(t, tFold - .12, tFold + .12))
    // ringing: the ripples go out on each trill; the circle answers on the drop
    rips.forEach((e, i) => {
      const ts = tRing + i * .42, p = P(t, ts, ts + 1.1, E.out)
      put(e, { x: C[0], y: C[1], s: lerp(1, 2.5, p), o: t < ts ? 0 : (1 - p) * .85 * (1 - P(t, tDrop, tDrop + .12)) })
    })
    put(who, { x: C[0], y: C[1] - 196, o: callO, blur: (1 - P(t, t0, t0 + .25)) * 10 + P(t, tFold - .12, tFold + .12) * 10 })
    inS.style.opacity = (1 - P(t, tDrop - .02, tDrop + .1)).toFixed(3)
    onS.style.opacity = P(t, tDrop, tDrop + .16).toFixed(3)
    put(says, { x: C[0], y: saysY, o: 1 - P(t, tFold - .14, tFold + .1), blur: P(t, tFold - .14, tFold + .1) * 12 })
    qW.forEach((e, i) => rise(e, t, tQ + i * .06, { dur: .26, dy: 14, blur: 12 }))
    aW.forEach((e, i) => rise(e, t, tA + i * .05, { dur: .24, dy: 12, blur: 10 }))

    // the shape: circle, then the live call, then the booking
    const pS = P(t, tDrop - .02, tDrop + .26, E.snap), pS2 = P(t, tDrop - .02, tDrop + .2)
    const pF = P(t, tFold, tFold + .26, E.snap), pF2 = P(t, tFold, tFold + .2), pFill = P(t, tFold + .02, tFold + .18)
    const trill = bell(t, tRing, tRing + .05, tRing + .3) + bell(t, tRing + .42, tRing + .47, tRing + .72)
    shape(blk, {
      w: lerp(lerp(RING, WIDE, pS), 124, pF), h: lerp(lerp(RING, TALL, pS2), 82, pF2), r: lerp(lerp(RING / 2, TALL / 2, pS2), 18, pF2),
      fill: mix(DARK, AMB, pFill), fa: lerp(.92, 1, pFill),
      rim: mix(mix(ICE, AMB, P(t, tDrop, tDrop + .2)), HOT, pFill), ra: .9,
      glow: .35 + .4 * trill + .5 * bell(t, tDrop, tDrop + .05, tDrop + .5) + .6 * pFill, gc: t < tDrop ? ICE : AMB,
    })
    ph.style.opacity = (1 - P(t, tDrop - .02, tDrop + .1)).toFixed(3)
    ph.style.transform = `rotate(${(9 * Math.sin(t * 42) * trill).toFixed(2)}deg) scale(${(1 - .4 * P(t, tDrop - .02, tDrop + .12)).toFixed(3)})`
    // the waveform: ice while the caller speaks, amber while the AI answers
    const sq = P(t, tQ, tQ + .1) * (1 - P(t, tQ + .9, tQ + 1.1)), sa = P(t, tA, tA + .1) * (1 - P(t, tFold - .4, tFold))
    const amp = Math.max(sq, sa)
    wv.style.color = `rgb(${t < tA - .05 ? ICE : AMB})`
    wv.style.opacity = (P(t, tDrop + .04, tDrop + .2) * (1 - P(t, tFold, tFold + .1))).toFixed(3)
    bars.forEach((e, i) => { const b = BAR[i]; e.style.height = (6 + amp * b.k * (22 + 66 * Math.abs(Math.sin(t * b.f + b.ph)))).toFixed(1) + 'px' })
    no.style.opacity = P(t, tFold + .14, tFold + .3).toFixed(3)
    // it flies down the floor, turning over, and drops onto table 12
    const b = fly(t)
    put(blk, {
      x: b[0], y: b[1], z: b[2], r: b[3],
      s: (1 + .06 * trill) * (1 + .1 * bell(t, tFold + .12, tFold + .2, tFold + .4)),
      o: P(t, t0, t0 + .2) * (1 - P(t, tHit - .005, tHit + .03)),
    })

    // the plan draws in under it, tables arriving across it
    put(plan, { o: P(t, tPlan, tPlan + .3), blur: (1 - P(t, tPlan, tPlan + .35)) * 10 })
    tbs.forEach((e, i) => {
      const a = tPlan + .1 + (TABLES[i][1] + 620) / 1240 * .5
      const p = P(t, a, a + .24, E.out)
      e.style.opacity = p.toFixed(3); e.style.transform = `scale(${lerp(.6, 1, p).toFixed(3)})`
    })
    // table 12 lights up, booked
    const lit = t >= tHit
    t12.classList.toggle('hot', lit)
    t12.style.transform = `scale(${(1 + .18 * bell(t, tHit, tHit + .06, tHit + .4)).toFixed(3)})`
    const rp = P(t, tHit, tHit + .6, E.out)
    put(ring, { x: X, y: Y, z: 2, s: lerp(.5, 3.4, rp), o: lit ? (1 - rp) * .9 : 0 })
    blurIn(tag, t, tTag, { x: X, y: tagY, z: 40, dur: .3, s0: .9, blur: 14, dy: 16 })
    // a copy of the booking lifts off with the whip, holding still as the world smears past
    const c = cam(t), pl = P(t, tLift, t1, E.in2)
    put(carry, { x: lerp(X, c[0], pl), y: lerp(Y, c[1], pl), z: 160 * P(t, tLift, t1, E.out), o: t >= tLift && t < t1 ? 1 : 0 })
    shape(carry, { w: 124, h: 82, r: 18, fill: AMB, rim: HOT, glow: .8 })

    const mb = shoot(s, cam, t, { shake: 5 * bell(t, tHit, tHit + .03, tHit + .22) })
    const out = P(t, t1 - .1, t1 + .2, E.in2)
    lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: out * 6, o: 1 - P(t, t1 + .02, t1 + .2), bright: 1 + .3 * bell(t, tHit, tHit + .05, tHit + .3) + .2 * bell(t, tDrop, tDrop + .04, tDrop + .3) })
  }
}

/* ============================================================
   TEXT: out of the whip, the amber booking lands on the guest's phone and
   opens into the confirmation. In the breath before the name it closes
   back down to a small square of amber.
   ============================================================ */
const SQ = 34                                             // the square the text closes into, which becomes the dot of the name
function buildText(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const specks = bokeh(s, 23, { hgt: 2400 })
  const phone = h('div', 'r-phone', s.cam, `
    <div class="isl"></div>
    <div class="clk">2:04</div><div class="dt">Wednesday 1 October</div>
    <div class="r-notes"></div>`)
  const note = h('div', 'r-note', phone.querySelector('.r-notes'), `<span class="app msg">${icon('chat')}</span><div class="tx"><div class="hd"><span>Messages</span><span>now</span></div><div class="t">Luca’s Trattoria</div><div class="b">Booked: Fri 7:30 pm, 4 people, terrace. Ref KX4Q7. To change it, call us and quote your reference.</div></div>`)
  const blk = h('div', 'v-blk', s.cam)
  const tNote = beat(13.5), tShut = t1 - beat(.5)
  cue('msgin', tNote, { v: .75 })                           // the text lands
  drop(tNote + .05, 3, { wet: .4, v: .5 })
  cue('m_gap', tShut, { d: t1 - tShut })                    // a breath before the name
  cue('implode', tShut + .2, { d: .22 })                    // and the text closes into a square
  step(tNote, 'Texts your guest')

  let cam = null, N = null
  function layout() {
    const n = centre(note, phone, 0, 0)
    N = { x: n[0], y: n[1], w: note.offsetWidth, h: note.offsetHeight }
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
    put(phone, { o: P(t, t0, t0 + .12) * (1 - P(t, tShut + .04, tShut + .22)), blur: P(t, tShut + .02, tShut + .22) * 16 })
    // the booking rides in with the whip, settles on the notification's place and opens into it
    const c = cam(t), arrive = P(t, t0 + .06, tNote, E.io)
    const pO = P(t, tNote, tNote + .3, E.snap), pO2 = P(t, tNote, tNote + .24), pG = P(t, tNote + .02, tNote + .2)
    const pC = P(t, tShut, tShut + .2, E.in2)              // and closes into the square
    const open = Math.min(pO2, 1 - pC)
    const tone = Math.max(1 - pG, P(t, tShut, tShut + .1))   // amber when it moves, glass when it is the message
    const sz = lerp(1.15, 1, arrive)
    shape(blk, {
      w: pC > 0 ? lerp(N.w, SQ, pC) : lerp(124 * sz, N.w, pO), h: pC > 0 ? lerp(N.h, SQ, pC) : lerp(82 * sz, N.h, pO2),
      r: pC > 0 ? lerp(30, 2, pC) : lerp(18, 30, open), fill: mix(GLASS, AMB, tone), fa: lerp(.78, 1, tone),
      rim: mix(WHITE, HOT, tone), ra: lerp(.09, 1, tone), glow: .8 * tone + .4 * bell(t, tNote, tNote + .1, tNote + .9),
    })
    const hold = pC > 0 ? [lerp(N.x, c[0], pC), lerp(N.y, c[1], pC)] : [lerp(c[0], N.x, arrive), lerp(c[1], N.y, arrive)]
    const msg = P(t, tNote + .16, tNote + .3) * (1 - P(t, tShut, tShut + .05))
    put(blk, { x: hold[0], y: hold[1], z: 6, o: 1 - msg })
    note.style.opacity = msg.toFixed(3)
    note.style.filter = msg < .999 ? `blur(${((1 - msg) * 8).toFixed(1)}px)` : 'none'
    const mb = shoot(s, cam, t)
    const come = 1 - P(t, t0, t0 + .2, E.out)
    lens(s, { mbX: Math.max(mb.mbX, come * 30), mbY: mb.mbY, bright: 1 + .25 * bell(t, tShut + .14, tShut + .2, t1) })
  }
}

/* ============================================================
   END: on the hit the square flies up into its place as the dot of the
   name while the letters draw themselves round it; then the offer.
   ============================================================ */
function buildEnd(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const specks = bokeh(s, 24)
  const MW = M({ land: 600, def: 560 }), MH = MW * 100 / 273, k = MW / 273
  const mark = h('div', 'r-mark', s.cam, WORDMARK()); mark.firstChild.setAttribute('width', MW)
  const strokes = [...mark.querySelectorAll('[data-k]')].filter(e => e.dataset.k !== 'dot'), dotEl = mark.querySelector('[data-k="dot"]')
  strokes.forEach(e => { e.style.strokeDasharray = '1 1' })
  const sqr = h('div', 'v-blk', s.cam)
  const tag = h('div', 'r-tagl', s.cam, 'An AI receptionist, built for your business.')
  const cta = h('div', 'v-cta', s.cam, `<div class="sheen"></div><span style="width:28px;height:28px;display:inline-flex">${spark(28)}</span><span>Book your personalised demo</span>`)
  const sheen = cta.querySelector('.sheen')
  const url = h('div', 'r-url', s.cam, '<b>nabl.agency</b>')
  const tLand = t0 + .3, tTag = t0 + beat(.75), tCta = t0 + beat(1.5)
  const yM = -150, yT = -30, yC = 90, yU = 180
  const D = [-MW / 2 + 84.5 * k, yM - MH / 2 + 75.5 * k], DS = 13 * k   // the dot of the name, in the world
  const S0 = SQ * (1800 / (1800 - 360)) / (1800 / (1800 - 220))     // the square as big as the text left it
  const cam = path([[t0, 0, -40, 220, 0, -8, 0, 1], [tCta, 0, -20, 40, 0, -2, 0, 1], [t1, 0, -10, -40, 0, 3, 0, 1]])
  cue('impact', t0 + .01, { v: .7 })                        // the name lands
  cue('shimmer', t0 + .03, { d: 1.8, v: .4 })
  cue('draw', t0 + .04, { d: .4, v: .35 })                  // the letters draw
  drop(tLand, 5, { wet: .2, v: .6 })                        // the dot clicks into place
  drop(tTag, 2, { wet: .6, v: .35 })
  cue('confirm', tCta, { n: 2, deg: 1, v: .4 })             // the offer
  return t => {
    const p = P(t, t0, t0 + .3, E.out)
    put(mark, { y: yM, s: lerp(1.06, 1, p), o: Math.min(1, p * 2), blur: (1 - p) * 10 })
    strokes.forEach((e, i) => { e.style.strokeDashoffset = (1 - P(t, t0 + .03 + i * .045, t0 + .33 + i * .045, E.out)).toFixed(4) })
    const landed = t >= tLand
    dotEl.style.opacity = landed ? 1 : 0
    mark.firstChild.style.filter = `drop-shadow(0 0 ${(40 * bell(t, tLand, tLand + .06, tLand + .9)).toFixed(1)}px rgba(${AMB},.55))`
    // the square, from the middle of the frame to its place as the dot
    const u = P(t, t0, tLand, E.io)
    shape(sqr, { w: lerp(S0, DS, u), h: lerp(S0, DS, u), r: lerp(2, 0, u), fill: AMB, rim: HOT, ra: 1 - u, glow: .9 })
    put(sqr, { x: lerp(0, D[0], u), y: lerp(-40, D[1], u), z: 140 * Math.sin(Math.PI * u), o: landed ? 0 : 1 })
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
    const pi = P(t, .25, .6, E.out), po = P(t, 2.45, 2.7, E.in2), w = chap.offsetWidth
    put(chap, { x: LAND ? pos[0] + w / 2 : pos[0], y: pos[1] + (1 - pi) * 14 - po * 10, o: pi * (1 - po), blur: (1 - pi) * 12 + po * 12 })
    list.forEach(([ta], i) => {
      const tz = i + 1 < list.length ? list[i + 1][0] : end
      const a = P(t, ta, ta + .22, E.out), z = P(t, tz - .02, tz + .14, E.in2)
      put(els[i], { x: at[0], y: at[1] + (1 - a) * 12, o: a * (1 - z), blur: (1 - a) * 10 + z * 8 })
    })
  }
}

export default function setup() {
  scene(['call', 'plan'], buildCallPlan, { hold: .2 })
  scene(['text'], buildText)
  scene(['end'], buildEnd)
  scene(['call', 'text'], buildWords)
  const sc = sceneById
  const tDrop = sc('call').start + beat(3)
  // [time, ax, ay, aStrength, cx, cy, cStrength, grid]: amber low in the middle, the light from above
  const ground = [
    [0, .5, .6, .15, .5, -.08, .6, 0],
    [tDrop, .5, .6, .3, .5, -.06, .9, 0],
    [beat(7.5), .55, .55, .4, .5, -.06, .95, 0],
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
