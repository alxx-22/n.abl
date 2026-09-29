/* ============================================================
   THE SITE FILM: what n.abl's AI does, scrubbed by scroll

   Made from the launch reel (marketing/launch-video/films/reel), in the
   same grammar: a dark stage lit softly from above, glowing interface
   pieces that turn into each other through light, blur-in and rack focus,
   a real 3D camera that swings, tilts and dollies along a smooth path
   with specks of light at every depth. Colour only for meaning: ice for
   listening and reading, amber for n.abl, coral for a warning.

   01 AI receptionist   the reel's receptionist, as it is: a voice note
                        booked on the drop, the booking, deposit and
                        reminder, the owner's phone, then a customer rings
                        about an order and the agent answers.
   02 Document AI       new: an invoice is read by a light passing down
                        it, each field flies out into the record, the
                        record is matched to its order and posted.
   03 Back-office agent new: the morning run. Overdue invoices found,
                        reminders drafted, and it waits for a person to
                        approve before anything is sent. Then the week's
                        report.
   Then the button, and the name.

   The reel's sales co-pilot is not here: it is one of the cards below
   the film, and the film shows the four products being built first.

   Every name, figure and number is a prop in an interface, not a claim:
   Sarah M., £20, Order #4821, Harbour Foods, INV-2291, £2,140. The same
   rule as the reel's SCRIPT.md.

   The builders are the reel's, written against a stage context instead of
   module globals (see stage.js). There is no sound on the site, so the
   reel's sound cues are gone; everything else keeps its timing.
   ============================================================ */

import { CHECK, E, P, bell, blurIn, centreOf, count, dotsPulse, drawRim, h, icon, lerp, pop, put, ringPill, rise, rng, spark, vis, words, WORDMARK } from './stage.js'

/* the music's tempo, as in the reel: every cut lands on a beat */
export const BEAT = 60 / 117.465

export const LIST = [
  { id: 'chat', beats: 9 },     // a voice note asks for Friday at 2; the agent answers and books it
  { id: 'book', beats: 7 },     // the booking flares into a point, then booking, deposit, reminder
  { id: 'notify', beats: 5 },   // the owner's phone: the new booking lands, and the calendar
  { id: 'phone', beats: 10 },   // a customer rings about an order; the agent answers, with its status
  { id: 'docs', beats: 12 },    // an invoice is read, its fields fly into the record, matched and posted
  { id: 'office', beats: 12 },  // the morning run: overdue found, reminders drafted, approved, sent, reported
  { id: 'cta', beats: 3 },      // the button
  { id: 'logo', beats: 6 },     // the name
]

/* The words the film puts on screen, for the page that cannot or should
   not run it: a screen reader, a crawler, reduced motion. Kept here, next
   to the timings that use them, so the two cannot drift apart. */
export const CHAPTERS = [
  { no: '01', name: 'AI receptionist', line: 'Chats and calls, answered and booked.', at: 'chat',
    steps: ['Understands voice notes', 'Answers in seconds', 'Books it in', 'Takes the deposit', 'Sends the reminder', 'Tells you straight away', 'Answers your phone', 'Knows every order', 'Checks it live, mid-call'] },
  { no: '02', name: 'Document AI', line: 'Paperwork, read and filed.', at: 'docs',
    steps: ['Reads the paperwork', 'Pulls out what matters', 'Checks it against the order', 'Files it where it goes'] },
  { no: '03', name: 'Back-office agent', line: 'The admin, handled. It asks before it sends.', at: 'office',
    steps: ['Runs the admin every morning', "Chases what's overdue", 'Asks before it sends', 'Reports back every week'] },
]

const WHITE = '247,242,234', ICE = '124,203,255', AMB = '233,172,87'

export default function film(ctx) {
  const { M, LAND, TL, scene, sceneById, lite } = ctx
  const B = TL.beat
  const G = TL.grid_beat || B
  const q = (k, step = .5) => Math.round(k * G / B / step) * step * B
  const Z0 = M({ land: 1, sq: 1, tall: 1.05, port: 1.08 })

  /* ---------- captions: a few words naming each step as it happens ---------- */
  const STEPS = []
  const step = (t, txt) => STEPS.push([t, txt])

  /* ---------- the lens and the camera ---------- */
  function widen(s) {
    const f = s.blurEl.parentNode
    f.setAttribute('x', '-30%'); f.setAttribute('y', '-40%'); f.setAttribute('width', '160%'); f.setAttribute('height', '180%')
    f.setAttribute('color-interpolation-filters', 'sRGB')
  }
  function lens(s, { o = 1, blur = 0, mbX = 0, mbY = 0, bright = 1 } = {}) {
    s.rig.style.opacity = o.toFixed(4)
    // a frame the visitor has stopped on is held still, so it is held sharp
    const k = Math.min(1, ctx.speed)
    mbX *= k; mbY *= k
    s.blurEl.setAttribute('stdDeviation', `${mbX.toFixed(1)} ${mbY.toFixed(1)}`)
    let f = ''
    if (mbX > .6 || mbY > .6) f += `url(#${s.mb}) `
    if (blur > .05) f += `blur(${blur.toFixed(2)}px) `
    if (Math.abs(bright - 1) > .005) f += `brightness(${bright.toFixed(3)})`
    s.rig.style.filter = f.trim() || 'none'
  }
  /* a smooth path through keys [t, x, y, z, rx, ry, rz, sc]: cubic Hermite with
     Catmull-Rom tangents, so the camera never stops dead between keys */
  function path(K) {
    K = K.slice().sort((a, b) => a[0] - b[0]).filter((k, i, a) => !i || k[0] > a[i - 1][0])
    const n = K.length
    return t => {
      if (t <= K[0][0]) return K[0].slice(1)
      if (t >= K[n - 1][0]) return K[n - 1].slice(1)
      let i = 0; while (t >= K[i + 1][0]) i++
      const a = K[i], b = K[i + 1], hh = b[0] - a[0], u = (t - a[0]) / hh
      const pa = K[Math.max(0, i - 1)], pb = K[Math.min(n - 1, i + 2)]
      const u2 = u * u, u3 = u2 * u
      return a.slice(1).map((_, k) => {
        const j = k + 1
        const m0 = i === 0 ? 0 : (b[j] - pa[j]) / (b[0] - pa[0]) * hh
        const m1 = i + 2 >= n ? 0 : (pb[j] - a[j]) / (pb[0] - a[0]) * hh
        return (2 * u3 - 3 * u2 + 1) * a[j] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * b[j] + (u3 - u2) * m1
      })
    }
  }
  /* point the camera, and smear the frame along its motion */
  function shoot(s, cam, t) {
    const v = cam(t), w = cam(t + 1 / 60)
    const [x, y, z, rx, ry, rz, sc] = v
    s.cam.style.transform = `translateZ(${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${(sc * Z0).toFixed(4)}) translate3d(${(-x).toFixed(1)}px,${(-y).toFixed(1)}px,0)`
    const k = sc * Z0 * (1 + z / 1800)
    const dx = (w[0] - v[0]) * k + (w[4] - v[4]) * 17, dy = (w[1] - v[1]) * k - (w[3] - v[3]) * 17
    const smear = d => Math.min(36, Math.max(0, Math.abs(d) - 9) * .6)
    return { mbX: smear(dx), mbY: smear(dy) }
  }
  /* specks of light at every depth, so the camera's moves read as space */
  function bokeh(s, seed, { n = 40, w = 2600, hgt = 1800, cx = 0, cy = 0 } = {}) {
    if (lite) n = Math.round(n * .45)
    const r = rng(seed), dots = []
    for (let i = 0; i < n; i++) {
      const e = h('div', 'r-bok', s.cam)
      const size = 5 + r() * r() * 46, col = [WHITE, AMB, ICE, WHITE][Math.floor(r() * 4)]
      Object.assign(e.style, { width: size + 'px', height: size + 'px', background: `radial-gradient(circle, rgba(${col},.8), rgba(${col},0) 68%)` })
      dots.push({ e, x: cx + (r() - .5) * w, y: cy + (r() - .5) * hgt, z: -1400 + r() * 1650, o: .08 + r() * .32, ph: r() * 6 })
    }
    return (t, o = 1) => dots.forEach(d => put(d.e, { x: d.x + Math.sin(t * .5 + d.ph) * 26, y: d.y + Math.cos(t * .37 + d.ph) * 20, z: d.z, o: d.o * o }))
  }

  /* ============================================================
     01 · RECEPTIONIST: a voice note, the agent's answer on the drop,
     "Yes please", Booked. The booking flares into a point and opens into
     the booking, the deposit and the reminder.
     ============================================================ */
  function buildReception(s) {
    widen(s)
    const [, book] = s.cuts
    const t0 = s.t0, tB = book.start, t1 = s.t1, b = k => t0 + q(k)
    const tDrop = t0 + q(3, 1)
    const specks = bokeh(s, 3, { cx: 200 })
    const panel = h('div', 'r-panel', s.cam, `
      <div class="r-ph"><span class="av">${spark(26)}</span><div><div class="t">Your business</div><div class="s">AI receptionist · chat and voice</div></div><span class="on">● ONLINE</span></div>
      <div class="r-thread">
        <div class="r-m in voice"><span class="play"></span><span class="r-wv"></span><span class="len">0:03</span></div>
        <div class="r-tx"><span class="mic">VOICE</span><span class="q"></span></div>
        <div class="r-m ai a1"><span class="r-dots"><i></i><i></i><i></i></span><span class="txt"></span></div>
        <div class="r-m in yes">Yes please!</div>
        <div class="r-m ai card"><span class="ok">✓ Booked</span><span class="r-chip">${icon('cal')}<span>Fri 2:00 pm</span></span></div>
      </div>`)
    if (!LAND) panel.style.width = '760px'
    const [head] = panel.children
    const msgs = [...panel.querySelector('.r-thread').children]
    const [mVoice, mTx, mAi, mYes, mCard] = msgs
    const wv = mVoice.querySelector('.r-wv')
    const WN = 30, wr = rng(9)
    const wh = Array.from({ length: WN }, (_, i) => 8 + 34 * Math.pow(Math.abs(Math.sin(i * .7) * Math.sin(i * .23 + .5)), .6) * (.5 + .5 * wr()))
    const wbars = wh.map(hh => { const e = h('i', '', wv); e.style.height = hh.toFixed(0) + 'px'; return e })
    const txW = words(mTx.querySelector('.q'), '“Can I book in for Friday at 2?”')
    const dots = mAi.querySelector('.r-dots'), aiW = words(mAi.querySelector('.txt'), 'Friday at 2pm is free. Shall I book it?')
    const chip = mCard.querySelector('.r-chip')
    const dot = h('div', 'r-dot', s.cam)
    const p1 = ringPill(s.cam, 400, 110, `<span class="ic">${icon('cal')}</span><span class="txt">Fri 2:00 pm</span>`)
    const p2 = ringPill(s.cam, 330, 110, `<span class="ic">${icon('card')}</span><span class="txt">£0 paid</span>`)
    const p3 = ringPill(s.cam, 330, 110, `<span class="ic">${icon('bell')}</span><span class="txt">Thu 6 pm</span>`)
    const txt2 = p2.querySelector('.txt')
    const kids1 = [...p1.children].filter(e => e.tagName !== 'svg')
    const l1 = h('div', 'r-lab', s.cam, 'Booked'), l2 = h('div', 'r-lab', s.cam, 'Deposit'), l3 = h('div', 'r-lab', s.cam, 'Reminder sent')
    const wash = h('div', 'r-wash', s.root)

    const tVoice = t0 + .15, tPlay = [t0 + .4, tDrop - .1], tTx = t0 + .82
    const tDots = tDrop + .02, tAi = tDrop + .45, tYes = b(6), tCard = b(7.5), tFlare = tB - .12
    const tP2 = tB + q(2), tP3 = tB + q(3.5), tBack = tB + q(5)
    step(t0 + .35, 'Understands voice notes'); step(tAi, 'Answers in seconds'); step(tCard, 'Books it in')
    step(tP2, 'Takes the deposit'); step(tP3, 'Sends the reminder')

    let cam = null, lay = null
    function layout() {
      const c = centreOf(chip, panel, 0, 0)
      const row = LAND
      const P1 = c, P2 = row ? [c[0] + 440, c[1]] : [c[0], c[1] + 290], P3 = row ? [c[0] + 860, c[1]] : [c[0], c[1] + 580]
      const mid = row ? [c[0] + 430, c[1]] : [c[0], c[1] + 290]
      const V = centreOf(mVoice, panel, 0, 0)
      lay = { P: [P1, P2, P3], mid }
      cam = path([
        [t0, V[0] + (row ? 150 : 60), -20, 40, 20, row ? -32 : -22, -3, 1],
        [tDrop - .1, V[0] + (row ? 120 : 50), 0, 130, 13, row ? -25 : -18, -1.5, 1],
        [tDrop + .28, 0, 10, 120, 4, 6, 0, 1],
        [tYes + .2, 0, 40, 130, 3, 3, 0, 1],
        [tCard + .15, c[0] * .5, (c[1] + 40) / 2, 190, 1, 0, 0, 1],
        [tB, c[0], c[1], 380, 0, 0, 0, 1],
        [tB + .5, P1[0], P1[1], 270, 3, -6, 0, 1],
        [tP2 + .2, P2[0], P2[1], 240, 2, row ? 6 : 0, 0, 1],
        [tP3 + .2, P3[0], P3[1], 230, row ? 0 : 6, row ? 10 : 4, 0, 1],
        [tBack + .45, mid[0], mid[1], 0, 14, row ? -14 : 10, 0, 1],
        [t1, mid[0], mid[1] - 240, -140, 24, row ? -8 : 6, 0, 1],
      ])
    }

    return t => {
      if (!cam) layout()
      specks(t)
      const fall = P(t, tFlare, tB + .45, E.in2)
      put(panel, { z: -900 * fall, rx: 40 * fall, o: 1 - P(t, tB + .1, tB + .45), blur: fall * 12 })
      vis(head, P(t, t0, t0 + .3))
      pop(mVoice, t, tVoice)
      const played = P(t, tPlay[0], tPlay[1], E.lin) * WN
      wbars.forEach((e, i) => {
        const on = i < played
        e.style.background = on ? `rgb(${ICE})` : `rgba(${WHITE},.28)`
        e.style.transform = `scaleY(${(on && i > played - 3 ? 1 + .35 * Math.sin(t * 30 + i) : 1).toFixed(3)})`
      })
      vis(mTx, P(t, tTx - .05, tTx + .1))
      txW.forEach((e, i) => rise(e, t, tTx + i * .06, { dur: .25, dy: 10, blur: 10 }))
      pop(mAi, t, tDots)
      dots.style.display = t < tAi ? 'inline-flex' : 'none'
      dotsPulse(dots, t)
      mAi.querySelector('.txt').style.display = t < tAi ? 'none' : 'inline'
      aiW.forEach((e, i) => rise(e, t, tAi + i * .035, { dur: .24, dy: 8, blur: 8 }))
      pop(mYes, t, tYes)
      pop(mCard, t, tCard)
      const glow = bell(t, tCard + .2, tFlare, tB + .05)
      chip.style.boxShadow = `0 0 ${(20 + 60 * glow).toFixed(0)}px rgba(${WHITE},${(.2 + .6 * glow).toFixed(2)})`
      chip.style.background = `rgb(${Math.round(lerp(247, 255, glow))},${Math.round(lerp(242, 255, glow))},${Math.round(lerp(234, 255, glow))})`
      const [P1, P2, P3] = lay.P
      const op = P(t, tB + .02, tB + .32, E.out)
      put(dot, { x: P1[0], y: P1[1], s: 1 + 2 * bell(t, tFlare, tB, tB + .15), o: P(t, tFlare, tB - .02) * (1 - P(t, tB + .05, tB + .2)) })
      p1.style.width = lerp(26, 400, op).toFixed(1) + 'px'; p1.style.height = lerp(26, 110, op).toFixed(1) + 'px'
      put(p1, { x: P1[0], y: P1[1], o: t >= tB ? 1 : 0 })
      kids1.forEach(e => vis(e, P(t, tB + .16, tB + .32)))
      drawRim(p1, P(t, tB + .28, tB + .8, E.io))
      const LY = 96
      blurIn(l1, t, tB + .45, { x: P1[0], y: P1[1] + LY, dur: .3, s0: 1, blur: 12, dy: 10 })
      blurIn(p2, t, tP2, { x: P2[0], y: P2[1], dz: 260, s0: .9, blur: 20 })
      drawRim(p2, P(t, tP2 + .05, tP2 + .55, E.io))
      count(txt2, t, tP2 + .08, tP2 + .42, 20, v => `£${v} paid`)
      blurIn(l2, t, tP2 + .15, { x: P2[0], y: P2[1] + LY, dur: .3, s0: 1, blur: 12, dy: 10 })
      blurIn(p3, t, tP3, { x: P3[0], y: P3[1], dz: 260, s0: .9, blur: 20 })
      drawRim(p3, P(t, tP3 + .05, tP3 + .55, E.io))
      blurIn(l3, t, tP3 + .15, { x: P3[0], y: P3[1] + LY, dur: .3, s0: 1, blur: 12, dy: 10 })
      const mb = shoot(s, cam, t)
      const up = P(t, t1 - .45, t1 + .05, E.in2)
      lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: up * 16, o: 1 - up * .5, bright: 1 + .3 * bell(t, tFlare, tB, tB + .2) })
      vis(wash, P(t, t1 - .4, t1, E.in2))
    }
  }

  /* ============================================================
     01 · NOTIFY: out of the grey, the owner's phone. The new booking lands
     on the lock screen, then the calendar entry.
     ============================================================ */
  function buildNotify(s) {
    widen(s)
    const t0 = s.t0, t1 = s.t1
    const specks = bokeh(s, 6, { hgt: 2400 })
    const wash = h('div', 'r-wash', s.root)
    const phone = h('div', 'r-phone', s.cam, `
      <div class="isl"></div>
      <div class="clk">9:41</div><div class="dt">Tuesday 14 October</div>
      <div class="r-notes"></div>`)
    const list = phone.querySelector('.r-notes')
    const notes = [
      [`<span class="app">${spark(28)}</span>`, 'n.abl', 'New booking', 'Sarah M. · Fri 2:00 pm<br>£20 deposit paid'],
      [`<span class="app cal">${icon('cal')}</span>`, 'Calendar', 'Added to your calendar', 'Fri 2:00 – 3:00 pm · Sarah M.'],
    ].map(([ic, app, ttl, body]) => h('div', 'r-note', list, `${ic}<div class="tx"><div class="hd"><span>${app}</span><span>now</span></div><div class="t">${ttl}</div><div class="b">${body}</div></div>`))
    const tN = [t0 + q(1), t0 + q(2.5)]
    step(tN[0], 'Tells you straight away')

    let cam = null
    function layout() {
      const N = notes.map(e => centreOf(e, phone, 0, 0))
      cam = path([
        [t0, 0, -260, -360, 36, -6, 0, 1],
        [tN[0] - .08, N[0][0], N[0][1] + 30, 60, 12, -6, 0, 1],
        [tN[0] + .45, N[0][0], N[0][1], 250, 5, -3, 0, 1],
        [tN[1] + .35, N[1][0], N[1][1] - 20, 260, 3, 5, 0, 1],
        [t1, N[1][0], N[1][1] - 60, 140, -4, 12, 0, 1],
      ])
    }

    return t => {
      if (!cam) layout()
      specks(t)
      vis(wash, 1 - P(t, t0, t0 + .42, E.io))
      put(phone, { o: 1 })
      notes.forEach((e, i) => {
        const p = P(t, tN[i], tN[i] + .34, E.snap)
        e.style.opacity = Math.min(1, P(t, tN[i], tN[i] + .12)).toFixed(3)
        e.style.transform = `translateY(${((1 - Math.min(1, p)) * -70).toFixed(1)}px) scale(${lerp(.92, 1, Math.min(1.03, p)).toFixed(4)})`
        const bl = (1 - P(t, tN[i], tN[i] + .24)) * 14
        e.style.filter = bl > .05 ? `blur(${bl.toFixed(1)}px)` : 'none'
        e.style.boxShadow = `0 20px 50px rgba(0,0,0,.45), 0 0 ${(50 * bell(t, tN[i], tN[i] + .1, tN[i] + .9)).toFixed(0)}px rgba(${AMB},.35)`
      })
      const mb = shoot(s, cam, t)
      const rf = P(t, t1 - .12, t1 + .26, E.in2)
      lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: rf * 26, o: 1 - P(t, t1 + .04, t1 + .26) })
    }
  }

  /* ============================================================
     01 · PHONE: a customer rings about an order; the agent picks up and
     answers with where it is, and the order's status draws in beside it.
     ============================================================ */
  function buildPhone(s) {
    widen(s)
    const t0 = s.t0, t1 = s.t1, b = k => t0 + q(k)
    const L = M({
      land: { card: [-330, 0], trk: [390, 20] },
      def: { card: [0, -300], trk: [0, 330] },
    })
    const specks = bokeh(s, 7, { cx: LAND ? 200 : 0, cy: LAND ? 0 : 100, hgt: LAND ? 1800 : 2600 })
    const wash = h('div', 'r-wash', s.root)
    const card = h('div', 'r-panel', s.cam, `
      <div class="r-ph"><span class="av ph">${icon('phone')}<i></i><i></i></span><div><div class="t">Customer call</div><div class="s">+44 7700 900318 · mobile</div></div><span class="on st">● RINGING</span></div>
      <div class="r-thread">
        <div class="r-tx"><span class="mic">CALLER</span><span class="q"></span></div>
        <div class="r-m ai a1"><span class="r-dots"><i></i><i></i><i></i></span><span class="txt"></span></div>
      </div>`)
    if (!LAND) card.style.width = '760px'
    const [head] = card.children
    const av = head.querySelector('.av'), rings = [...av.querySelectorAll('i')], st = head.querySelector('.st')
    const [mQ, mA] = card.querySelector('.r-thread').children
    const qW = words(mQ.querySelector('.q'), '“Hi, has my order shipped yet?”')
    const dots = mA.querySelector('.r-dots'), aW = words(mA.querySelector('.txt'), 'It has! Order #4821 is out for delivery. It’ll be with you today by 5 pm.')
    const trk = h('div', 'r-track', s.cam, `
      <div class="hd"><span class="ic">${icon('box')}</span><div><div class="t">Order #4821</div><div class="s">Checked live, mid-call</div></div><span class="live">● LIVE</span></div>
      <div class="r-steps"><div class="ln"></div><div class="fill"></div>
        <div class="r-st"><div class="d">${CHECK('#1A1612', 18)}</div><span>Ordered</span></div>
        <div class="r-st"><div class="d">${CHECK('#1A1612', 18)}</div><span>Packed</span></div>
        <div class="r-st"><div class="d"></div><span>Out for delivery</span></div>
        <div class="r-st"><div class="d"></div><span>Delivered</span></div>
      </div>
      <div class="r-eta">${icon('clock')}<span>Arriving today, by 5 pm</span></div>`)
    const sts = [...trk.querySelectorAll('.r-st')], fill = trk.querySelector('.fill'), eta = trk.querySelector('.r-eta')
    const trkKids = [...trk.children]

    const tRing = t0 + .08, tAns = b(1.5), tQ = b(2.5), tDots = b(4.5), tA = tDots + .3, tTrk = b(6.5), tEta = b(8.5)
    const tSt = [0, 1, 2].map(i => tTrk + .25 + i * .2)
    step(t0 + .2, 'Answers your phone'); step(tA, 'Knows every order'); step(tTrk + .2, 'Checks it live, mid-call')

    let cam = null
    function layout() {
      const C = L.card, T = L.trk, land = LAND
      const H_ = centreOf(head, card, C[0], C[1]), Q = centreOf(mQ, card, C[0], C[1]), A = centreOf(mA, card, C[0], C[1])
      const E_ = centreOf(eta, trk, T[0], T[1]), S2 = centreOf(sts[2], trk, T[0], T[1])
      const mid = [(C[0] + T[0]) / 2, (C[1] + T[1]) / 2]
      cam = path([
        [t0, H_[0] + (land ? 160 : 60), H_[1] + 80, -340, 18, land ? -24 : -14, -2, 1],
        [tAns + .1, H_[0], H_[1] + 40, 140, 6, land ? -8 : -4, 0, 1],
        [tQ + .35, Q[0], Q[1], 190, 4, 4, 0, 1],
        [tA + .7, A[0], A[1], 200, 2, -3, 0, 1],
        [tTrk + .3, mid[0], mid[1], land ? -40 : -120, land ? 4 : 8, land ? -12 : 0, 0, 1],
        [tSt[2] + .3, S2[0], S2[1], 170, 3, land ? -6 : 4, 0, 1],
        [tEta + .3, E_[0], E_[1] - 20, 230, 2, land ? 6 : -4, 0, 1],
        [t1, E_[0], E_[1] - 260, -140, 24, land ? 8 : -6, 0, 1],
      ])
    }

    return t => {
      if (!cam) layout()
      specks(t)
      put(card, { x: L.card[0], y: L.card[1], o: P(t, t0, t0 + .25) })
      vis(head, P(t, t0, t0 + .3))
      const on = t >= tAns
      rings.forEach((e, i) => {
        const ph = ((((t - tRing) / .9 + i * .5) % 1) + 1) % 1
        e.style.transform = `scale(${(1 + ph * 1.1).toFixed(3)})`
        e.style.opacity = (t < tRing || on ? 0 : (1 - ph) * .7).toFixed(3)
      })
      av.style.transform = `rotate(${(on ? 0 : 9 * Math.sin(t * 42) * (P(t, tRing, tRing + .1) - P(t, tRing + .3, tRing + .42) + P(t, tRing + .42, tRing + .52) - P(t, tRing + .72, tRing + .84))).toFixed(2)}deg)`
      st.textContent = on ? '● n.abl ANSWERED' : '● RINGING'
      st.classList.toggle('ans', on)
      vis(mQ, P(t, tQ - .05, tQ + .1))
      qW.forEach((e, i) => rise(e, t, tQ + i * .06, { dur: .25, dy: 10, blur: 10 }))
      pop(mA, t, tDots)
      dots.style.display = t < tA ? 'inline-flex' : 'none'
      dotsPulse(dots, t)
      mA.querySelector('.txt').style.display = t < tA ? 'none' : 'inline'
      aW.forEach((e, i) => rise(e, t, tA + i * .035, { dur: .24, dy: 8, blur: 8 }))
      blurIn(trk, t, tTrk, { x: L.trk[0], y: L.trk[1], dz: 240, s0: .92, blur: 20 })
      trkKids.forEach((e, i) => { e.style.opacity = P(t, tTrk + .05 + i * .06, tTrk + .25 + i * .06).toFixed(3) })
      sts.forEach((e, i) => {
        const lit = i < 3 && t >= tSt[i]
        e.classList.toggle('on', lit); e.classList.toggle('now', i === 2 && lit)
        e.querySelector('.d').style.transform = `scale(${(1 + .25 * bell(t, tSt[i] || 0, (tSt[i] || 0) + .06, (tSt[i] || 0) + .3)).toFixed(3)})`
      })
      fill.style.width = `calc((100% - 120px) * ${(2 / 3 * P(t, tTrk + .2, tSt[2], E.io)).toFixed(4)})`
      const eg = bell(t, tEta, tEta + .08, tEta + 1.2)
      eta.style.boxShadow = `0 0 ${(30 + 50 * eg).toFixed(0)}px rgba(${AMB},${(.15 + .35 * eg).toFixed(2)})`
      eta.style.transform = `scale(${(1 + .04 * bell(t, tEta, tEta + .06, tEta + .35)).toFixed(4)})`
      const mb = shoot(s, cam, t)
      const up = P(t, t1 - .45, t1 + .05, E.in2), come = 1 - P(t, t0, t0 + .32, E.out)
      lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: up * 16 + come * 22, o: 1 - up * .5 })
      vis(wash, P(t, t1 - .4, t1, E.in2))
    }
  }

  /* ============================================================
     02 · DOCUMENTS: out of the grey, an invoice. A line of light passes
     down it; each field it crosses lights up and flies across into the
     record. The record is matched to its order, then posted.
     ============================================================ */
  function buildDocs(s) {
    widen(s)
    const t0 = s.t0, t1 = s.t1, b = k => t0 + q(k)
    const L = M({
      land: { paper: [-350, 10], ext: [390, 0] },
      def: { paper: [0, -430], ext: [0, 470] },
    })
    const specks = bokeh(s, 11, { cx: LAND ? 0 : 0, hgt: LAND ? 1800 : 2800 })
    const wash = h('div', 'r-wash', s.root)
    const paper = h('div', 'r-paper', s.cam, `
      <div class="top"><span class="lg"></span><div><div class="sup f">Harbour Foods Ltd</div><div class="ad">Unit 4, Quay Road</div></div><div class="kind">INVOICE</div></div>
      <div class="meta"><div><span>Invoice</span><b class="f">INV-2291</b></div><div><span>Date</span><b>3 Oct</b></div><div><span>Order</span><b>PO-0417</b></div></div>
      <div class="lines"><div><i style="width:58%"></i><em>£412.00</em></div><div><i style="width:46%"></i><em>£608.50</em></div><div><i style="width:52%"></i><em>£264.10</em></div></div>
      <div class="tot"><span>Total due</span><b class="f">£1,284.60</b></div>
      <div class="due"><span>Due by</span><b class="f">17 Oct</b></div>`)
    const fields = [...paper.querySelectorAll('.f')]
    const beam = h('div', 'r-beam', s.cam)
    const ext = h('div', 'r-ext', s.cam, `
      <div class="hd"><span class="av">${spark(24)}</span><div><div class="t">Document AI</div><div class="s">Supplier invoices</div></div><span class="st">● READING</span></div>
      <div class="rows">
        <div class="row"><span class="k">Supplier</span><span class="v">Harbour Foods Ltd</span></div>
        <div class="row"><span class="k">Invoice</span><span class="v">INV-2291</span></div>
        <div class="row"><span class="k">Total</span><span class="v">£1,284.60</span></div>
        <div class="row"><span class="k">Due</span><span class="v">17 Oct</span></div>
      </div>
      <div class="match">${CHECK('#B9D4B3', 20)}<span>Matches order PO-0417</span></div>
      <div class="post">${icon('sheet')}<span>Posted to your accounts</span></div>`)
    const st = ext.querySelector('.st')
    const rows = [...ext.querySelectorAll('.row')], vals = rows.map(r => r.querySelector('.v'))
    const match = ext.querySelector('.match'), post = ext.querySelector('.post')
    const extKids = [ext.querySelector('.hd'), ext.querySelector('.rows')]
    const flies = fields.map(f => h('div', 'r-fly', s.cam, f.textContent))

    const tScan = [b(1.5), b(5)], tMatch = b(7.5), tPost = b(9)
    let lay = null, cam = null
    function layout() {
      const Pp = L.paper, X = L.ext
      const ph = paper.offsetHeight, pw = paper.offsetWidth
      const top = Pp[1] - ph / 2 + 30, bot = Pp[1] + ph / 2 - 30
      const F = fields.map(f => centreOf(f, paper, Pp[0], Pp[1]))
      const Rw = rows.map(r => centreOf(r.querySelector('.v'), ext, X[0], X[1]))
      const hits = F.map(([, y]) => lerp(tScan[0], tScan[1], (y - top) / (bot - top)))
      const Mt = centreOf(match, ext, X[0], X[1]), Po = centreOf(post, ext, X[0], X[1])
      const mid = [(Pp[0] + X[0]) / 2, (Pp[1] + X[1]) / 2]
      lay = { F, Rw, hits, top, bot, pw }
      step(t0 + .25, 'Reads the paperwork'); step(hits[0] + .1, 'Pulls out what matters')
      step(tMatch, 'Checks it against the order'); step(tPost, 'Files it where it goes')
      cam = path([
        [t0, Pp[0] + (LAND ? 120 : 40), top + 80, -320, 26, LAND ? -26 : -14, -2, 1],
        [tScan[0], Pp[0], top + 120, 120, 12, LAND ? -12 : -6, 0, 1],
        [lerp(tScan[0], tScan[1], .5), Pp[0] + (LAND ? 60 : 0), Pp[1], 150, 6, LAND ? -4 : 0, 0, 1],
        [tScan[1] + .2, mid[0], mid[1], LAND ? -60 : -200, 4, LAND ? 6 : 0, 0, 1],
        [tMatch + .2, Mt[0], Mt[1] - 60, 160, 3, LAND ? 8 : 4, 0, 1],
        [tPost + .3, Po[0], Po[1] - 20, 230, 2, LAND ? 4 : -4, 0, 1],
        [t1, Po[0], Po[1] - 260, -140, 24, LAND ? 8 : -6, 0, 1],
      ])
    }

    return t => {
      if (!cam) layout()
      specks(t)
      // the invoice settles out of the grey
      const pin = P(t, t0 + .02, t0 + .5, E.out)
      put(paper, { x: L.paper[0], y: L.paper[1] + (1 - pin) * 60, z: (1 - pin) * -200, rx: (1 - pin) * 12, o: Math.min(1, pin * 1.6), blur: (1 - pin) * 20 })
      // the line of light, down the page
      const sp = P(t, tScan[0], tScan[1], E.io)
      const by = lerp(lay.top, lay.bot, sp)
      put(beam, { x: L.paper[0], y: by, o: P(t, tScan[0] - .15, tScan[0]) * (1 - P(t, tScan[1], tScan[1] + .25)) })
      beam.style.width = (lay.pw + 90) + 'px'
      // each field lights as the light crosses it, then flies to the record
      fields.forEach((f, i) => {
        const th = lay.hits[i]
        const lit = bell(t, th - .04, th + .06, th + .8)
        f.style.boxShadow = `0 0 0 ${(3 * P(t, th - .04, th + .06)).toFixed(1)}px rgba(${ICE},${(.25 + .5 * lit).toFixed(2)}), 0 0 ${(26 * lit).toFixed(0)}px rgba(${ICE},${(.5 * lit).toFixed(2)})`
        f.style.background = `rgba(${ICE},${(.14 * P(t, th - .04, th + .06)).toFixed(3)})`
        const fl = flies[i], a = lay.F[i], z = lay.Rw[i]
        const p = P(t, th + .12, th + .62, E.io)
        const arcY = -90 * Math.sin(Math.PI * p)
        put(fl, { x: lerp(a[0], z[0], p), y: lerp(a[1], z[1], p) + arcY, z: 80 * Math.sin(Math.PI * p), s: lerp(1, .92, p), o: (p > 0 && p < 1) ? 1 : 0, blur: 5 * Math.sin(Math.PI * p) })
        vals[i].style.opacity = P(t, th + .55, th + .7).toFixed(3)
        rows[i].classList.toggle('on', t >= th + .6)
      })
      // the record: in as the reading starts, matched, posted
      blurIn(ext, t, tScan[0] - .2, { x: L.ext[0], y: L.ext[1], dz: 220, s0: .94, blur: 18 })
      extKids.forEach((e, i) => { e.style.opacity = P(t, tScan[0] - .1 + i * .08, tScan[0] + .15 + i * .08).toFixed(3) })
      const done = t >= tMatch
      st.textContent = done ? '● READ' : '● READING'
      st.classList.toggle('ok', done)
      pop(match, t, tMatch)
      pop(post, t, tPost)
      const pg = bell(t, tPost, tPost + .08, tPost + 1.2)
      post.style.boxShadow = `0 0 ${(30 + 50 * pg).toFixed(0)}px rgba(${AMB},${(.15 + .35 * pg).toFixed(2)})`
      const mb = shoot(s, cam, t)
      const up = P(t, t1 - .45, t1 + .05, E.in2)
      lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: up * 16, o: 1 - up * .5 })
      vis(wash, Math.max(1 - P(t, t0, t0 + .42, E.io), P(t, t1 - .4, t1, E.in2)))
    }
  }

  /* ============================================================
     03 · BACK OFFICE: out of the grey, the agent's morning run. It checks
     the ledger, drafts the reminders, and stops for a person to approve
     before anything is sent. Then it sends, logs, and reports the week.
     ============================================================ */
  function buildOffice(s) {
    widen(s)
    const t0 = s.t0, t1 = s.t1, b = k => t0 + q(k)
    const L = M({
      land: { run: [-250, 0], rep: [520, 40] },
      def: { run: [0, -260], rep: [0, 560] },
    })
    const specks = bokeh(s, 13, { hgt: LAND ? 1800 : 2800 })
    const wash = h('div', 'r-wash', s.root)
    const TASKS = [
      ['inbox', 'Check the ledger for overdue invoices', '3 overdue'],
      ['mail', 'Draft a polite reminder for each', '3 drafted'],
      ['bell', 'Ask before anything is sent', 'Approved'],
      ['link', 'Send, and log it on each account', '3 sent'],
    ]
    const run = h('div', 'r-run', s.cam, `
      <div class="hd"><span class="av">${spark(24)}</span><div><div class="t">Back-office agent</div><div class="s">Morning run · 7:00</div></div><span class="st">● RUNNING</span></div>
      <div class="tasks">${TASKS.map(([ic, txt, res]) => `<div class="task"><span class="ic">${icon(ic)}</span><span class="tx">${txt}</span><span class="stt"><i class="ring"></i><i class="spin"></i><i class="ok">${CHECK('#1A1612', 16)}</i></span><span class="res">${res}</span></div>`).join('')}</div>
      <div class="ask"><div class="q">3 reminders ready to send. Send them?</div><div class="btns"><span class="no">Not yet</span><span class="yes">Approve and send</span></div></div>`)
    const st = run.querySelector('.st')
    const tasks = [...run.querySelectorAll('.task')]
    const ask = run.querySelector('.ask'), yes = ask.querySelector('.yes')
    const rep = h('div', 'r-rep', s.cam, `
      <div class="hd">${icon('chart')}<span>This week</span><span class="when">Monday report</span></div>
      <div class="big"><span class="num">£0</span><span class="lbl">collected</span></div>
      <div class="bars">${[.35, .55, .42, .8, 1].map(v => `<i style="--v:${v}"></i>`).join('')}</div>
      <div class="foot">3 reminders sent · 2 already paid</div>`)
    const num = rep.querySelector('.num'), bars = [...rep.querySelectorAll('.bars i')]

    // each task: running from a[0], done at a[1]
    const T = [[b(1), b(2.5)], [b(2.5), b(4)], [b(4), b(6)], [b(6), b(7.5)]]
    const tAsk = b(4.3), tPress = b(5.5), tRep = b(8)
    step(t0 + .25, 'Runs the admin every morning'); step(T[0][1], "Chases what's overdue")
    step(tAsk, 'Asks before it sends'); step(tRep, 'Reports back every week')

    let cam = null
    function layout() {
      const R_ = L.run, Rp = L.rep
      const Tk = tasks.map(e => centreOf(e, run, R_[0], R_[1]))
      const A = centreOf(ask, run, R_[0], R_[1])
      const mid = [(R_[0] + Rp[0]) / 2, (R_[1] + Rp[1]) / 2]
      cam = path([
        [t0, R_[0] + (LAND ? 140 : 40), R_[1] - 120, -320, 24, LAND ? -24 : -12, -2, 1],
        [T[0][0], Tk[0][0], Tk[0][1] + 40, 40, 8, LAND ? -8 : -4, 0, 1],
        [T[1][0] + .3, Tk[1][0], Tk[1][1] + 20, 80, 5, LAND ? -4 : 0, 0, 1],
        [tAsk + .3, A[0], A[1] - 40, 100, 4, LAND ? 3 : 2, 0, 1],
        [tPress + .2, A[0] + (LAND ? 90 : 60), A[1] - 10, 150, 2, LAND ? 6 : 3, 0, 1],
        [T[3][1], mid[0], mid[1], LAND ? -80 : -220, 4, LAND ? 8 : 0, 0, 1],
        [tRep + .9, Rp[0], Rp[1], 160, 3, LAND ? 6 : 0, 0, 1],
        [t1, Rp[0], Rp[1] - 260, -140, 24, LAND ? 8 : -6, 0, 1],
      ])
    }

    return t => {
      if (!cam) layout()
      specks(t)
      const pin = P(t, t0 + .02, t0 + .5, E.out)
      put(run, { x: L.run[0], y: L.run[1] + (1 - pin) * 60, z: (1 - pin) * -200, o: Math.min(1, pin * 1.6), blur: (1 - pin) * 20 })
      tasks.forEach((e, i) => {
        const [a, z] = T[i]
        const running = t >= a && t < z, done = t >= z
        e.classList.toggle('run', running); e.classList.toggle('done', done)
        e.style.opacity = (.45 + .55 * P(t, a - .15, a + .1)).toFixed(3)
        e.querySelector('.spin').style.transform = `rotate(${((t - a) * 540).toFixed(1)}deg)`
        const r = e.querySelector('.res')
        const rp = P(t, z, z + .3, E.out)
        r.style.opacity = rp.toFixed(3); r.style.transform = `translateX(${((1 - rp) * 14).toFixed(1)}px)`
      })
      // the pause: it waits for a person, and the press is theirs
      const ap = P(t, tAsk, tAsk + .35, E.out), gone = P(t, T[2][1] + .1, T[2][1] + .4)
      ask.style.opacity = (ap * (1 - gone * .6)).toFixed(3)
      ask.style.transform = `translateY(${((1 - ap) * 16).toFixed(1)}px)`
      const press = bell(t, tPress, tPress + .06, tPress + .3)
      yes.style.transform = `scale(${(1 - .06 * press).toFixed(4)})`
      yes.style.boxShadow = `0 0 ${(20 + 60 * press + 20 * bell(t, tAsk + .4, tPress, tPress + .4)).toFixed(0)}px rgba(${AMB},${(.25 + .45 * press).toFixed(2)})`
      yes.classList.toggle('pressed', t >= tPress)
      const done = t >= T[3][1]
      st.textContent = done ? '● DONE' : t >= tAsk && t < tPress ? '● WAITING FOR YOU' : '● RUNNING'
      st.classList.toggle('wait', t >= tAsk && t < tPress)
      st.classList.toggle('ok', done)
      // the week, reported
      blurIn(rep, t, tRep, { x: L.rep[0], y: L.rep[1], dz: 240, s0: .92, blur: 20 })
      count(num, t, tRep + .2, tRep + 1.1, 2140, v => `£${v.toLocaleString('en-GB')}`)
      bars.forEach((e, i) => { e.style.transform = `scaleY(${P(t, tRep + .25 + i * .08, tRep + .7 + i * .08, E.out).toFixed(3)})` })
      const mb = shoot(s, cam, t)
      const up = P(t, t1 - .45, t1 + .05, E.in2)
      lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: up * 16, o: 1 - up * .5 })
      vis(wash, Math.max(1 - P(t, t0, t0 + .42, E.io), P(t, t1 - .4, t1, E.in2)))
    }
  }

  /* ============================================================
     CTA: the button flies in out of focus, a light across it, pressed on
     the beat. Then the name.
     ============================================================ */
  function buildCta(s) {
    widen(s)
    const t0 = s.t0, t1 = s.t1, tPress = t1 - q(.5)
    const specks = bokeh(s, 12)
    const wash = h('div', 'r-wash', s.root)
    const btn = h('div', 'r-btn', s.cam, `<div class="sheen"></div><span style="width:34px;height:34px;display:inline-flex">${spark(34)}</span><span>Put AI to work</span>`)
    btn.style.width = M({ land: '760px', def: '720px' })
    const sheen = btn.querySelector('.sheen')
    const cam = path([[t0, 0, 0, -120, 8, 16, 0, 1], [tPress, 0, 0, 40, 0, 0, 0, 1], [t1, 0, 0, 120, 0, 0, 0, 1]])
    return t => {
      vis(wash, 1 - P(t, t0, t0 + .3, E.io))
      const p = P(t, t0 - .25, t0 + .35, E.out)
      const press = bell(t, tPress, tPress + .05, tPress + .2, E.out)
      const flare = P(t, tPress + .02, t1, E.in2)
      put(btn, { z: lerp(700, 0, p), s: (1 - .05 * press) * lerp(1, 1.04, flare), o: Math.min(1, p * 1.5), blur: (1 - p) * 30, bright: 1 + .5 * press + 1.6 * flare })
      btn.style.boxShadow = `0 0 ${(30 + 90 * (press + flare)).toFixed(0)}px rgba(${AMB},${(.15 + .4 * (press + flare)).toFixed(2)})`
      sheen.style.left = lerp(-70, 110, P(t, t0 + .15, tPress, E.io)).toFixed(1) + '%'
      specks(t, .8)
      const mb = shoot(s, cam, t)
      lens(s, { mbX: mb.mbX, mbY: mb.mbY, o: 1 - P(t, t1 - .04, t1 + .02) })
    }
  }

  /* ============================================================
     LOGO: the name blurs into focus under the light as the camera eases
     back, and holds: this is where the section hands back to the page.
     ============================================================ */
  function buildLogo(s) {
    widen(s)
    const t0 = s.t0, t1 = s.t1
    const specks = bokeh(s, 14)
    const MW = M({ land: 640, def: 600 })
    const mark = h('div', 'r-mark', s.cam, WORDMARK()); mark.firstChild.setAttribute('width', MW)
    const tag = h('div', 'r-tagl', s.cam, 'AI, built into your business.')
    const tTag = t0 + q(1)
    const cam = path([[t0, 0, -20, 220, 0, -10, 0, 1], [t0 + q(4), 0, 10, 0, 0, 0, 0, 1], [t1, 0, 10, -40, 0, 3, 0, 1]])
    return t => {
      const p = P(t, t0, t0 + .3, E.out)
      put(mark, { y: -40, s: lerp(1.14, 1, p), o: Math.min(1, p * 1.5), blur: (1 - p) * 36 })
      mark.firstChild.style.filter = `drop-shadow(0 0 ${(40 * bell(t, t0, t0 + .06, t0 + .9)).toFixed(1)}px rgba(${AMB},.45))`
      blurIn(tag, t, tTag, { y: 110, dur: .35, s0: 1, blur: 14, dy: 16 })
      specks(t)
      shoot(s, cam, t)
      lens(s, {})
    }
  }

  /* the chapter names, over everything */
  function buildChapters(s) {
    const CH = CHAPTERS.map(c => [c.no, c.name, c.line, c.at, .3, c.at === 'chat' ? 3.2 : 2.6])
    const pos = M({ land: [-ctx.W / 2 + 96, -ctx.H / 2 + 178], port: [0, -ctx.H / 2 + 320], sq: [0, -450], tall: [0, -ctx.H / 2 + 105] })
    const els = CH.map(([no, name, ln]) => h('div', 'f-abs r-chap', s.root, `<div class="eb">${spark(18)}<span>${name}</span><span style="color:#8B8175">${no}</span></div><div class="ln">${ln}</div>`))
    return t => {
      CH.forEach(([, , , a, da, len], i) => {
        const e = els[i], ta = sceneById(a).start + da, tz = ta + len
        const pi = P(t, ta, ta + .35, E.out), po = P(t, tz, tz + .25, E.in2)
        const w = e.offsetWidth
        put(e, { x: LAND ? pos[0] + w / 2 : pos[0], y: pos[1] + (1 - pi) * 14 - po * 10, o: pi * (1 - po), blur: (1 - pi) * 12 + po * 12 })
      })
    }
  }

  /* the step captions, low and steady, over everything: each until the next */
  function buildSteps(s) {
    const at = M({ land: [0, 420], sq: [0, 430], tall: [0, ctx.H / 2 - 155], port: [0, ctx.H / 2 - 260] })
    let list = null, els = null
    const end = sceneById('office').end - .15
    return t => {
      // the scenes register their captions as they are built, some only once
      // they have been laid out, so the list is read on the first frame
      if (!list) {
        list = STEPS.slice().sort((a, b) => a[0] - b[0])
        els = list.map(([, txt]) => h('div', 'f-abs r-step', s.root, `<span class="dot"></span><span>${txt}</span>`))
      }
      list.forEach(([ta], i) => {
        const tz = i + 1 < list.length ? list[i + 1][0] : end
        const pi = P(t, ta, ta + .22, E.out), po = P(t, tz - .02, tz + .14, E.in2)
        put(els[i], { x: at[0], y: at[1] + (1 - pi) * 12, o: pi * (1 - po), blur: (1 - pi) * 10 + po * 8 })
      })
    }
  }

  scene(['chat', 'book'], buildReception)
  scene(['notify'], buildNotify, { hold: .28 })
  scene(['phone'], buildPhone)
  scene(['docs'], buildDocs)
  scene(['office'], buildOffice)
  scene(['cta'], buildCta)
  scene(['logo'], buildLogo, { hold: 1 })
  scene(['chat', 'logo'], buildChapters)
  // built last and primed last, so every caption above is registered first
  scene(['chat', 'office'], buildSteps)

  const sc = sceneById
  const tDrop = sc('chat').start + q(3, 1)
  // [time, ax, ay, aStrength, cx, cy, cStrength]: amber low in the middle, the light from above
  ctx.setGround([
    [0, .5, .6, .15, .5, -.08, .6],
    [tDrop, .5, .6, .3, .5, -.06, .9],
    [sc('book').start - .1, .5, .55, .6, .5, -.06, .95],
    [sc('book').start + .25, .5, .55, .35, .5, -.06, .9],
    [sc('notify').start, .5, .55, .3, .5, -.08, .9],
    [sc('phone').start, .45, .55, .25, .5, -.08, .9],
    [sc('docs').start, .4, .55, .3, .5, -.08, .9],
    [sc('office').start, .55, .55, .3, .5, -.08, .9],
    [sc('cta').start, .5, .55, .35, .5, -.08, .95],
    [sc('logo').start - .02, .5, .5, .6, .5, -.06, 1],
    [sc('logo').start + .1, .5, .5, 1.25, .5, -.06, 1],
    [sc('logo').start + .8, .5, .5, .45, .5, -.08, .95],
    [TL.duration + 1, .5, .5, .4, .5, -.08, .9],
  ])
}
