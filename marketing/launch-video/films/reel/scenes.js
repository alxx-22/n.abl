/* ============================================================
   THE AI REEL: three AI services in 21 seconds, cut to music

   In the style of a product reel for Opal (by mc-visuals): a dark stage lit
   softly from above; glowing interface pieces that turn into each other
   through light (a booking flares into a point, the point opens into a
   pill); blur-in, rack focus, a pixel dissolve, a colour split; every
   move lands on a kick. The camera is a real 3D camera: it swings, orbits,
   tilts, pans and dollies along a smooth path, following what happens,
   with motion blur from its own speed and specks of light at every depth
   so the space reads.

   01 AI receptionist   a voice note asks for Friday at 2; the camera
                        swings round on the drop to the agent's answer;
                        "Yes please"; Booked. The booking flares into a
                        point and opens into the booking, the deposit and
                        the reminder, the camera running along them.
   02 Sales co-pilot    a point of light drops into a call; the client's
                        words are transcribed, pixel-dissolve into English;
                        an objection glows red; the camera pulls out and
                        round to the co-pilot's sidebar and reads down it:
                        the playbook, what to say next, where to pivot.
   03 Document analyser any document riffled past the camera; a tender pack
                        scanned with the camera riding the scan; what
                        matters falls into pills that count up, and the
                        camera cranes up the tree to the score.
   Then the button, pressed on the beat, and the name.
   The script is films/reel/film.py; the analysis of the reference and the
   shot list are films/reel/SCRIPT.md.
   ============================================================ */

import { E, LAND, M, P, TL, WORDMARK, bell, cue, h, icon, lerp, offs, put, rise, rng, scene, sceneById, spark, vis, words } from '../../film/stage.js'

const B = TL.beat
const WHITE = '247,242,234', ICE = '124,203,255', AMB = '233,172,87', CORAL = '240,122,106'
const Z0 = M({ land: 1, sq: 1, tall: 1.1, port: 1.22 })

/* ---------- sound: water drops, pitched on D minor pentatonic ---------- */
// deg: step of the scale from D4 up; wet 0 is dry and close, 1 is under water
const drop = (t, deg, { n = 1, step = 2, gap = .045, wet = .3, v = .6 } = {}) => cue('drop', t, { deg, n, step, gap, wet, v })

/* ---------- the lens and the camera ---------- */
function widen(s) {
  const f = s.blurEl.parentNode
  f.setAttribute('x', '-30%'); f.setAttribute('y', '-40%'); f.setAttribute('width', '160%'); f.setAttribute('height', '180%')
  f.setAttribute('color-interpolation-filters', 'sRGB')   // linear light bands the dark gradients into colours
}
function lens(s, { o = 1, blur = 0, mbX = 0, mbY = 0, bright = 1 } = {}) {
  s.rig.style.opacity = o.toFixed(4)
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
function shoot(s, cam, t, { shake = 0 } = {}) {
  const v = cam(t), w = cam(t + 1 / 60)
  const [x, y, z, rx, ry, rz, sc] = v
  const sx = shake ? Math.sin(t * 91) * shake : 0, sy = shake ? Math.cos(t * 77) * shake : 0
  s.cam.style.transform = `translateZ(${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${(sc * Z0).toFixed(4)}) translate3d(${(-x + sx).toFixed(1)}px,${(-y + sy).toFixed(1)}px,0)`
  const k = sc * Z0 * (1 + z / 1800)
  const dx = (w[0] - v[0]) * k + (w[4] - v[4]) * 17, dy = (w[1] - v[1]) * k - (w[3] - v[3]) * 17
  const smear = d => Math.min(36, Math.max(0, Math.abs(d) - 9) * .6)
  return { mbX: smear(dx), mbY: smear(dy) }
}
/* specks of light at every depth, so the camera's moves read as space */
function bokeh(s, seed, { n = 40, w = 2600, hgt = 1800, cx = 0, cy = 0 } = {}) {
  const r = rng(seed), dots = []
  for (let i = 0; i < n; i++) {
    const e = h('div', 'r-bok', s.cam)
    const size = 5 + r() * r() * 46, col = [WHITE, AMB, ICE, WHITE][Math.floor(r() * 4)]
    Object.assign(e.style, { width: size + 'px', height: size + 'px', background: `radial-gradient(circle, rgba(${col},.8), rgba(${col},0) 68%)` })
    dots.push({ e, x: cx + (r() - .5) * w, y: cy + (r() - .5) * hgt, z: -1400 + r() * 1650, o: .08 + r() * .32, ph: r() * 6 })
  }
  return (t, o = 1) => dots.forEach(d => put(d.e, { x: d.x + Math.sin(t * .5 + d.ph) * 26, y: d.y + Math.cos(t * .37 + d.ph) * 20, z: d.z, o: d.o * o }))
}

/* ---------- pieces ---------- */
function blurIn(e, t, t0, { x = 0, y = 0, z = 0, dur = .32, s0 = 1.12, blur = 22, dx = 0, dy = 0, dz = 0, s = 1, o = 1, rx = 0, ry = 0 } = {}) {
  const p = P(t, t0, t0 + dur, E.out)
  put(e, { x: x + (1 - p) * dx, y: y + (1 - p) * dy, z: z + (1 - p) * dz, s: s * lerp(s0, 1, p), o: o * Math.min(1, p * 1.6), blur: (1 - p) * blur, rx, ry })
  return p
}
function count(e, t, a, b, to, fmt = v => v) { e.textContent = fmt(Math.round(to * P(t, a, b, E.out))) }
function ringPill(parent, w, hgt, html) {
  const e = h('div', 'r-pill', parent, html)
  e.style.width = w + 'px'; e.style.height = hgt + 'px'
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('class', 'r-rim')
  svg.setAttribute('width', w + 16); svg.setAttribute('height', hgt + 16)
  const mk = cls => { const r = document.createElementNS(ns, 'rect'); r.setAttribute('x', 8); r.setAttribute('y', 8); r.setAttribute('width', w); r.setAttribute('height', hgt); r.setAttribute('rx', hgt / 2); r.setAttribute('pathLength', 1); if (cls) r.setAttribute('class', cls); svg.appendChild(r); return r }
  mk('base'); e._rim = mk('')
  e.appendChild(svg)
  return e
}
function drawRim(e, p) {
  e.lastChild.style.opacity = p > 0 ? 1 : 0
  e._rim.style.strokeDasharray = '1 1'
  e._rim.style.strokeDashoffset = (1 - p).toFixed(4)
  e.style.boxShadow = `0 0 ${(40 * p).toFixed(0)}px rgba(${WHITE},${(.16 * p).toFixed(3)})`
}
function pop(e, t, t0, { dur = .3, dy = 18, blur = 12 } = {}) {
  const p = P(t, t0, t0 + dur, E.snap)
  e.style.opacity = Math.min(1, P(t, t0, t0 + .1)).toFixed(3)
  e.style.transform = `translateY(${((1 - Math.min(1, p)) * dy).toFixed(1)}px) scale(${lerp(.86, 1, Math.min(1.04, p)).toFixed(4)})`
  const bl = (1 - P(t, t0, t0 + dur * .7)) * blur
  e.style.filter = bl > .05 ? `blur(${bl.toFixed(1)}px)` : 'none'
}
/* the world point at the centre of element e inside a positioned box placed at (bx, by) */
function centreOf(e, box, bx, by) {
  const o = offs(e, box)
  return [bx - box.offsetWidth / 2 + o.x + o.w / 2, by - box.offsetHeight / 2 + o.y + o.h / 2]
}

/* ============================================================
   01 · RECEPTIONIST: a voice note, the agent's answer on the drop,
   "Yes please", Booked. The booking flares into a point and opens into
   the booking, the deposit and the reminder.
   ============================================================ */
function buildReception(s) {
  widen(s)
  const [chat, book] = s.cuts
  const t0 = s.t0, tB = book.start, t1 = s.t1, b = k => t0 + k * B
  const tDrop = b(3)
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
  // the booking, the deposit, the reminder
  const p1 = ringPill(s.cam, 400, 110, `<span class="ic">${icon('cal')}</span><span class="txt">Fri 2:00 pm</span>`)
  const p2 = ringPill(s.cam, 330, 110, `<span class="ic">${icon('card')}</span><span class="txt">£0 paid</span>`)
  const p3 = ringPill(s.cam, 330, 110, `<span class="ic">${icon('bell')}</span><span class="txt">Thu 6 pm</span>`)
  const txt2 = p2.querySelector('.txt')
  const kids1 = [...p1.children].filter(e => e.tagName !== 'svg')
  const l1 = h('div', 'r-lab', s.cam, 'Booked'), l2 = h('div', 'r-lab', s.cam, 'Deposit'), l3 = h('div', 'r-lab', s.cam, 'Reminder sent')
  const wash = h('div', 'r-wash', s.root)

  const tVoice = t0 + .12, tPlay = [t0 + .35, tDrop - .08], tTx = t0 + .72
  const tDots = tDrop + .02, tAi = tDrop + .36, tYes = b(5), tCard = b(6), tFlare = tB - .12
  const tP2 = tB + 2 * B, tP3 = tB + 3 * B, tBack = tB + 4 * B
  // sound
  cue('riser', tDrop, { d: 1.3 })
  cue('m_drop', tDrop)
  drop(tVoice, 7, { n: 2, step: 3, wet: .35, v: .7 })
  txW.forEach((_, i) => drop(tTx + i * .06, 5 + (i % 4), { wet: .75, v: .28 }))
  cue('whoosh', tDrop - .04, { d: .42, v: .9 })
  ;[0, 1, 2].forEach(i => drop(tDots + i * .1, 8 + i, { wet: .55, v: .3 }))
  drop(tAi, 9, { n: 2, step: 2, wet: .25, v: .6 })
  drop(tYes, 6, { wet: .3, v: .6 })
  drop(tCard, 7, { n: 3, step: 2, gap: .06, wet: .2, v: .7 })
  cue('shimmer', tCard + .15, { d: 1, v: .35 })
  cue('implode', tB, { d: .28 })
  drop(tB, 4, { n: 2, step: 5, gap: .02, wet: .1, v: .9 })
  cue('draw', tB + .12, { d: .5 })
  drop(tP2, 8, { wet: .2, v: .65 }); drop(tP2 + .42, 10, { n: 2, step: 2, wet: .15, v: .5 })
  drop(tP3, 9, { wet: .2, v: .65 }); drop(tP3 + .3, 11, { wet: .5, v: .4 })
  cue('whoosh', tBack + .1, { d: .5, v: .6 })
  cue('whoosh', t1, { d: .45, v: .5 })
  drop(t1 - .2, 3, { wet: .9, v: .6 })

  let cam = null, lay = null
  function layout() {
    const c = centreOf(chip, panel, 0, 0)
    const row = LAND
    const P1 = c, P2 = row ? [c[0] + 440, c[1]] : [c[0], c[1] + 290], P3 = row ? [c[0] + 860, c[1]] : [c[0], c[1] + 580]
    const mid = row ? [c[0] + 430, c[1]] : [c[0], c[1] + 290]
    const V = centreOf(mVoice, panel, 0, 0), A = centreOf(mAi, panel, 0, 0), Y = centreOf(mYes, panel, 0, 0)
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
    // the chat, until it falls away behind the booking
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
    dots.querySelectorAll('i').forEach((d, k) => { d.style.opacity = (.35 + .65 * Math.max(0, Math.sin((t * 3 - k * .22) * Math.PI))).toFixed(3) })
    mAi.querySelector('.txt').style.display = t < tAi ? 'none' : 'inline'
    aiW.forEach((e, i) => rise(e, t, tAi + i * .035, { dur: .24, dy: 8, blur: 8 }))
    pop(mYes, t, tYes)
    pop(mCard, t, tCard)
    const glow = bell(t, tCard + .2, tFlare, tB + .05)
    chip.style.boxShadow = `0 0 ${(20 + 60 * glow).toFixed(0)}px rgba(${WHITE},${(.2 + .6 * glow).toFixed(2)})`
    chip.style.background = `rgb(${Math.round(lerp(247, 255, glow))},${Math.round(lerp(242, 255, glow))},${Math.round(lerp(234, 255, glow))})`
    // the flare becomes a point, the point the booking
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
    // the camera, and up and away into grey
    const mb = shoot(s, cam, t)
    const up = P(t, t1 - .45, t1 + .05, E.in2)
    lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: up * 16, o: 1 - up * .5, bright: 1 + .3 * bell(t, tFlare, tB, tB + .2) })
    vis(wash, P(t, t1 - .4, t1, E.in2))
  }
}

/* ============================================================
   02 · CALL + COACH: a point of light drops into a call and becomes the
   co-pilot; the client's Spanish is transcribed and dissolves into
   English; the objection glows red; the camera pulls out and round to the
   co-pilot's sidebar and reads down it.
   ============================================================ */
function buildCall(s) {
  widen(s)
  const [call, coach] = s.cuts
  const t0 = s.t0, t1 = s.t1, b = k => t0 + k * B, tC = coach.start
  const L = M({
    land: { win: [0, -70], cap: [0, 200], flag: [0, 292], side: [780, -10], badge: [0, -318] },
    def: { win: [0, -120], cap: [0, 160], flag: [0, 250], side: [0, 700], badge: [0, -368] },
  })
  const specks = bokeh(s, 5, { cx: LAND ? 400 : 0, cy: LAND ? 0 : 300, hgt: LAND ? 1800 : 2600 })
  const wash = h('div', 'r-wash', s.root)
  const glow = h('div', 'abs', s.cam)
  Object.assign(glow.style, { width: '1100px', height: '800px', borderRadius: '50%', background: `radial-gradient(closest-side, rgba(${CORAL},.75), rgba(${CORAL},.22) 45%, transparent)` })
  const win = h('div', 'r-call', s.cam, `
    <div class="r-tl"><div class="av" style="background:linear-gradient(140deg,#E9AC57,#B87718)">Y</div><div class="r-nm">You</div><div class="mic"></div></div>
    <div class="r-tl"><div class="av" style="background:linear-gradient(140deg,#7CCBFF,#3B78B8)">M</div><div class="r-nm">Client · Madrid</div><div class="mic"></div></div>`)
  const dot = h('div', 'r-dot', s.cam)
  const streak = h('div', 'abs', s.cam); Object.assign(streak.style, { width: '6px', borderRadius: '3px', background: `linear-gradient(180deg, transparent, rgba(${WHITE},.8))` })
  const badge = h('div', 'r-badge', s.cam, `${spark(18)}<span>n.abl co-pilot joined</span>`)
  const ring = h('div', 'abs', s.cam); Object.assign(ring.style, { width: '100px', height: '100px', borderRadius: '50%', border: `2px solid rgba(${WHITE},.8)` })
  const cap = h('div', 'r-cap', s.cam, `<span class="lang">ES</span><span class="line"></span>`)
  const lang = cap.querySelector('.lang'), line = cap.querySelector('.line')
  const es = words(line, 'Es un poco caro para nosotros…')
  const en = h('span', 'line', cap); en.textContent = 'It’s a bit pricey for us…'
  const flag = h('div', 'r-flag', s.cam, `<span style="color:#F07A6A">${icon('alert')}</span><span>Objection · price</span>`)
  const CVW = 1100, CVH = 150
  const cv = h('canvas', 'abs', s.cam); cv.width = CVW; cv.height = CVH
  const g = cv.getContext('2d'), SQ = 15, cols = Math.ceil(CVW / SQ), rows = Math.ceil(CVH / SQ)
  const rr = rng(5), cells = Array.from({ length: cols * rows }, () => [rr(), rr(), rr()])
  const PAL = [AMB, ICE, WHITE, '200,170,255', CORAL]
  const side = h('div', 'r-side', s.cam, `
    <div class="hd">${spark(24)}<span>n.abl co-pilot</span><span class="live">● LIVE</span></div>
    <div class="r-blk"><div class="sec">Transcript · ES → EN</div><div class="tr"><b>Client</b>It’s a bit pricey for us…</div></div>
    <div class="r-blk"><div class="sec">Playbook</div><div class="card"><div class="ic">${icon('book')}</div><div><div class="t1">Pricing objection</div><div class="t2">Reframe on value · offer a pilot</div></div></div></div>
    <div class="r-blk"><div class="sec">Say next</div><div class="say"></div></div>
    <div class="chips"><span class="chip hot">Pivot → ROI</span><span class="chip">Translate ES ⇄ EN</span></div>`)
  const blks = [...side.children]
  const say = side.querySelector('.say')
  const sayW = words(say, '“Most teams start with a 30-day pilot, so you only pay once it’s working.”')
  const tDot = b(2), tCap = b(3), tGl = b(5), tSwap = tGl + .2, tObj = b(6), tOut = tC
  const tBl = [tOut + .2, tOut + .45, tOut + 2 * B, tOut + 2 * B + .15, tOut + 4 * B]
  const tSay = tBl[3] + .12

  cue('whoosh', t0 + .05, { d: .35, v: .5 })
  drop(t0 + .3, 2, { wet: .85, v: .7 })
  cue('fall', tDot - .38, { d: .38 })
  drop(tDot, 10, { n: 3, step: -2, gap: .03, wet: .15, v: .9 })
  drop(tDot + .12, 5, { wet: .8, v: .5 })
  es.forEach((_, i) => drop(tCap + i * .07, 6 + ((i * 3) % 5), { wet: .6, v: .3 }))
  cue('glitch', tGl, { d: .42 })
  ;[0, 1, 2, 3, 4].forEach(i => drop(tGl + .04 + i * .075, 12 - i * 2, { wet: .35, v: .28 }))
  drop(tSwap + .12, 7, { n: 2, step: 3, wet: .2, v: .55 })
  cue('alert', tObj, { v: .5 })
  drop(tObj, 1, { n: 2, step: 1, gap: .09, wet: .95, v: .9 })
  cue('m_lpf', tObj + .1, { d: tOut - tObj - .1 })
  cue('whoosh', tOut + .02, { d: .4, v: 1 })
  tBl.forEach((x, i) => drop(x, 5 + i * 2, { wet: .3, v: .5 }))
  sayW.forEach((_, i) => i % 2 === 0 && drop(tSay + i * .035, 8 + (i % 5), { wet: .7, v: .22 }))

  let cam = null
  function layout() {
    const S = L.side
    const bw = blks.map(e => centreOf(e, side, S[0], S[1]))
    const W_ = L.win, C_ = L.cap
    const land = LAND
    cam = path([
      [t0, W_[0], W_[1] + 60, -420, -22, 14, 0, 1],
      [tDot - .3, W_[0], W_[1] - 10, -80, -6, 5, 0, 1],
      [tDot + .1, W_[0], W_[1] - 40, -20, 0, 0, 0, 1],
      [tCap + .15, C_[0], (W_[1] + C_[1]) / 2 + 40, 120, 6, -4, 0, 1],
      [tGl - .05, C_[0], C_[1] - 20, 300, 4, -3, 0, 1],
      [tSwap + .3, C_[0], C_[1] - 10, 330, 2, 2, 0, 1],
      [tObj + .25, W_[0], (W_[1] + C_[1]) / 2 + 20, 120, -2, 4, 2.5, 1],
      [tOut, W_[0], W_[1] + 30, 220, 0, 0, 3.5, 1],
      [tOut + .38, land ? (W_[0] + S[0]) / 2 : 0, land ? 0 : (W_[1] + S[1]) / 2, -260, land ? 6 : -10, land ? -26 : 0, 0, 1],
      [tBl[1] + .1, bw[1][0], bw[1][1] + 40, 20, land ? 8 : 4, land ? -14 : 6, 0, 1],
      [tBl[2] + .1, bw[2][0], bw[2][1] + 20, 70, 6, land ? -10 : 4, 0, 1],
      [tBl[3] + .5, bw[3][0], bw[3][1] - 10, 120, 4, land ? -8 : 2, 0, 1],
      [tBl[4] + .1, bw[4][0], bw[4][1] - 150, 70, 2, land ? -6 : 2, 0, 1],
      [t1, bw[4][0], bw[4][1] - 150, 30, 0, land ? -4 : 0, 0, 1],
    ])
  }

  return t => {
    if (!cam) layout()
    specks(t)
    vis(wash, 1 - P(t, t0, t0 + .42, E.io))
    // the call arrives from above, its colours split, and settles
    const pin = P(t, t0 + .02, b(1), E.out)
    const ch = 16 * (1 - pin) + 10 * bell(t, tGl, tGl + .08, tGl + .4)
    put(win, { x: L.win[0], y: L.win[1] - (1 - pin) * 180, s: lerp(.9, 1, pin), o: Math.min(1, pin * 1.6) })
    const wb = (1 - pin) * 24
    win.style.filter = [wb > .05 ? `blur(${wb.toFixed(2)}px)` : '',
      ch > .3 ? `drop-shadow(${(-ch).toFixed(1)}px 0 0 rgba(255,40,90,.55)) drop-shadow(${ch.toFixed(1)}px 0 0 rgba(0,220,255,.55))` : ''].join(' ').trim() || 'none'
    // the point of light drops in and becomes the co-pilot
    const fall = P(t, tDot - .38, tDot, E.in2)
    const dy = lerp(L.badge[1] - 640, L.badge[1], fall)
    put(dot, { x: 0, y: dy, o: P(t, tDot - .4, tDot - .3) * (1 - P(t, tDot + .02, tDot + .12)) })
    const sl = 140 * fall * (1 - P(t, tDot - .02, tDot + .03))
    streak.style.height = Math.max(1, sl).toFixed(0) + 'px'
    put(streak, { x: 0, y: dy - sl / 2 - 10, o: sl > 2 ? .8 : 0 })
    const rp = P(t, tDot, tDot + .5, E.out)
    put(ring, { x: L.badge[0], y: L.badge[1], s: lerp(.2, 3.2, rp), o: t >= tDot ? (1 - rp) * .8 : 0 })
    blurIn(badge, t, tDot, { x: L.badge[0], y: L.badge[1], dur: .3, s0: .4, blur: 10, o: 1 - P(t, tOut, tOut + .2) })
    // what the client says, in Spanish, then English
    put(cap, { x: L.cap[0], y: L.cap[1], o: 1 })
    const swap = t >= tSwap
    line.style.display = swap ? 'none' : 'inline-block'
    en.style.display = swap ? 'inline-block' : 'none'
    lang.textContent = swap ? 'ES → EN' : 'ES'
    vis(lang, P(t, tCap - .05, tCap + .1))
    es.forEach((e, i) => rise(e, t, tCap + i * .07, { dur: .24, dy: 14, blur: 12 }))
    const d = bell(t, tGl, tGl + .2, tGl + .44, E.out)
    g.clearRect(0, 0, CVW, CVH)
    if (d > 0) {
      const fr = Math.floor(t * 30)
      for (let j = 0; j < cells.length; j++) {
        const [a, c, k] = cells[j]
        const x = j % cols, y = Math.floor(j / cols)
        const wave = 1 - Math.abs(x / cols - P(t, tGl, tGl + .44, E.lin)) * 2.2
        if (a > d * 1.15 * Math.max(0, wave + .35)) continue
        const flick = ((j * 31 + fr * 17) % 7) / 7
        g.fillStyle = `rgba(${PAL[Math.floor((c + flick) * 5) % 5]},${(.25 + .75 * k * d).toFixed(2)})`
        g.fillRect(x * SQ, y * SQ, SQ - 2, SQ - 2)
      }
    }
    put(cv, { x: L.cap[0], y: L.cap[1], o: 1 })
    // the objection: a red glow, the rim turns coral, the music pulls away
    const ob = P(t, tObj, tObj + .3, E.out), obOn = ob * (1 - P(t, tOut, tOut + .3))
    blurIn(flag, t, tObj, { x: L.flag[0], y: L.flag[1], dur: .28, s0: .7, blur: 12, o: 1 - P(t, tOut, tOut + .15) })
    put(glow, { x: L.win[0], y: L.win[1], z: -40, s: lerp(.6, 1.05, ob), o: obOn * (.85 + .15 * Math.sin(t * 9)) })
    win.style.borderColor = `rgba(${CORAL},${(.09 + .8 * obOn).toFixed(3)})`
    win.style.boxShadow = `0 40px 120px rgba(0,0,0,.6), 0 0 ${(60 * obOn).toFixed(0)}px rgba(${CORAL},${(.45 * obOn).toFixed(3)})`
    vis(cap, 1 - P(t, tOut, tOut + .15))
    // the sidebar, block by block
    put(side, { x: L.side[0], y: L.side[1], o: P(t, tOut + .05, tOut + .2) })
    blks.forEach((e, i) => {
      const p = P(t, tBl[i], tBl[i] + .3, E.out)
      e.style.opacity = p.toFixed(3); e.style.transform = `translateY(${((1 - p) * 20).toFixed(1)}px)`; e.style.filter = p < 1 ? `blur(${((1 - p) * 10).toFixed(1)}px)` : 'none'
    })
    sayW.forEach((e, i) => rise(e, t, tSay + i * .035, { dur: .2, dy: 8, blur: 8 }))
    // the camera; a bump as the point lands
    const mb = shoot(s, cam, t, { shake: 6 * bell(t, tDot, tDot + .03, tDot + .25) })
    const rf = P(t, t1 - .08, t1 + .32, E.in2)
    lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: rf * 30, o: 1 - P(t, t1 + .08, t1 + .32) })
  }
}

/* ============================================================
   03 · DOCS: any document, riffled past the camera; a tender pack scanned
   with the camera riding the line of light; what matters falls into
   pills that count up; the camera cranes up the tree to the score.
   ============================================================ */
function buildDocs(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1, b = k => t0 + k * B
  const L = M({
    land: { doc: [0, 0], tags: 470, pills: [-400, 0, 400], py: 190, ds: 1 },
    def: { doc: [-130, 0], tags: 250, pills: [-310, 0, 310], py: 190, ds: .92 },
  })
  const specks = bokeh(s, 8, { hgt: 2400 })
  const DOCS = [['Contract', 'Service agreement'], ['Policy', 'Staff handbook'], ['Report', 'Board pack · Q3'], ['CV', 'Operations lead'], ['Tender', 'Tender pack · 64 pages']]
  const HL = { 4: `rgba(${ICE},.5)`, 9: `rgba(${CORAL},.5)`, 14: `rgba(${AMB},.55)` }
  const docs = DOCS.map(([k, tt], i) => {
    const e = h('div', 'r-doc', s.cam, `<div class="kind">${k}</div><div class="dt">${tt}</div>`)
    for (let j = 0; j < 20; j++) {
      const ln = h('div', 'ln' + (i === 4 && HL[j] ? ' hl' : ''), e)
      ln.style.width = (j % 5 === 4 ? 55 : 88 + ((j * 37) % 12)) + '%'
      if (i === 4 && HL[j]) ln.style.setProperty('--hl', HL[j])
    }
    return e
  })
  docs.slice().reverse().forEach(e => s.cam.appendChild(e))   // the first to go is drawn on top
  const doc = docs[4], hls = [...doc.querySelectorAll('.ln.hl')], lns = [...doc.querySelectorAll('.ln')]
  const beam = h('div', 'r-beam', s.cam), trail = h('div', 'r-trail', s.cam)
  beam.style.width = '600px'; trail.style.width = '520px'
  const TAGS = [
    { html: `<span style="color:#7CCBFF">${icon('clock')}</span><span><span class="k">Deadline</span><br>14 Nov, 12:00</span>`, line: 4 },
    { html: `<span style="color:#F07A6A">${icon('alert')}</span><span><span class="k">Risk</span><br>Uncapped liability</span>`, line: 9 },
    { html: `<span style="color:#E9AC57">${icon('survey')}</span><span><span class="k">Requirement</span><br>ISO 27001</span>`, line: 14 },
  ]
  const tags = TAGS.map(o => h('div', 'r-tag', s.cam, o.html))
  const lineY = j => lns[j].offsetTop + 6 - 345
  const PILLS = [['doc', 42, 'Requirements'], ['alert', 3, 'Risks'], ['clock', 2, 'Deadlines']]
  const pills = PILLS.map(([ic]) => ringPill(s.cam, M({ land: 230, def: 210 }), 100, `<span class="ic">${icon(ic)}</span><span class="txt">0</span>`))
  const labs = PILLS.map(([, , l]) => h('div', 'r-lab', s.cam, l))
  const ns = 'http://www.w3.org/2000/svg'
  const tree = document.createElementNS(ns, 'svg'); tree.setAttribute('class', 'r-tree')
  const TW = Math.abs(L.pills[2] - L.pills[0]) + 20, TH = 150
  tree.setAttribute('width', TW); tree.setAttribute('height', TH); tree.setAttribute('viewBox', `${-TW / 2} 0 ${TW} ${TH}`)
  const x0 = L.pills[0], x2 = L.pills[2]
  const pth = document.createElementNS(ns, 'path')
  pth.setAttribute('d', `M${x0} ${TH} L${x0} 72 Q${x0} 60 ${x0 + 12} 60 L${x2 - 12} 60 Q${x2} 60 ${x2} 72 L${x2} ${TH} M0 ${TH} L0 60 L0 0`)
  pth.setAttribute('pathLength', 1); tree.appendChild(pth); s.cam.appendChild(tree)
  tree.style.position = 'absolute'; tree.style.left = '50%'; tree.style.top = '50%'
  const score = h('div', 'r-score', s.cam, `<div class="k">Bid fit</div><div class="v"><span>0</span><i>▲</i></div>`)
  const sv = score.querySelector('.v span')
  const treeY = L.py - 62 - TH / 2, scoreY = treeY - TH / 2 - 92

  const tFl = [t0 + .24, t0 + .4, t0 + .56, t0 + .72]
  const tScan = [b(2), b(4) - .05]
  const tBreak = b(4), tPills = b(5), tTree = b(8)
  cue('whoosh', t0 + .02, { d: .35, v: .6 })
  tFl.forEach((x, i) => { cue('paper', x, { v: .7, pan: (i % 2 ? .4 : -.4) }); drop(x + .02, 9 - i, { wet: .5, v: .35 }) })
  drop(b(2) - .02, 4, { n: 2, step: 4, wet: .3, v: .6 })
  cue('scan', tScan[0], { d: tScan[1] - tScan[0] })
  cue('whoosh', tBreak + .02, { d: .35, v: .6 })
  ;[0, 1, 2].forEach(i => { drop(tPills + i * .15, 5 + i * 2, { wet: .2, v: .65 }); drop(tPills + i * .15 + .4, 9 + i, { n: 2, step: 2, wet: .4, v: .35 }) })
  cue('draw', tTree, { d: .45 })
  drop(tTree + .4, 7, { n: 4, step: 2, gap: .05, wet: .25, v: .6 })
  cue('shimmer', tTree + .45, { d: 1.3, v: .35 })

  let cam = null, TY = null
  function layout() {
    TY = TAGS.map(o => L.doc[1] + lineY(o.line) * L.ds)
    const D = L.doc, land = LAND
    cam = path([
      [t0, D[0] - 60, D[1], 120, 6, -30, 0, 1],
      [b(2) - .1, D[0], D[1] - 40, 60, 4, -10, 0, 1],
      [b(2) + .1, D[0] + (land ? 110 : 60), -90 * L.ds, 70, 16, -6, 0, 1],
      [tScan[1], D[0] + (land ? 170 : 80), 120 * L.ds, 90, 14, -12, 0, 1],
      [tBreak + .35, 0, L.py - 30, 60, 18, 0, 0, 1],
      [tPills + .3, L.pills[0] * (land ? 1 : .45), L.py, land ? 260 : 90, 10, 14, 0, 1],
      [tPills + 1.0, L.pills[2] * (land ? 1 : .45), L.py, land ? 260 : 90, 8, -14, 0, 1],
      [tTree + .05, 0, L.py - 60, 20, 16, 0, 0, 1],
      [tTree + .7, 0, scoreY + 60, 80, -6, 0, 0, 1],
      [t1, 0, scoreY + 40, 150, -8, 4, 0, 1],
    ])
  }

  return t => {
    if (!cam) layout()
    specks(t)
    // the riffle: documents fly past the camera, the last one ours
    const rf = P(t, t0 - .3, t0 + .3, E.out)
    const brk = P(t, tBreak - .05, tBreak + .4, E.io)
    docs.forEach((e, i) => {
      const d0 = i * 70
      if (i < 4) {
        const go = P(t, tFl[i], tFl[i] + .2, E.in2)
        put(e, { x: L.doc[0] + i * 34 + go * 900, y: L.doc[1] - i * 10, z: -d0 + go * 520, ry: -18 - go * 50, s: L.ds * lerp(1.4, 1, rf), o: Math.min(1, rf * 1.5) * (1 - P(t, tFl[i] + .1, tFl[i] + .22)), blur: (1 - rf) * 26 + go * 14 })
      } else {
        const come = P(t, tFl[3], b(2), E.out)
        put(e, { x: L.doc[0] + lerp(4 * 34, 0, come), y: L.doc[1] - lerp(40, 0, come) - brk * 200, z: lerp(-d0, 0, come) - brk * 520, rx: brk * 62, ry: lerp(-18, 0, come), s: L.ds * lerp(1.4, 1, rf), o: Math.min(1, rf * 1.5) * (1 - P(t, tBreak + .15, tBreak + .45)), blur: (1 - rf) * 26 + brk * 10 })
      }
    })
    // the scan
    const sp = P(t, tScan[0], tScan[1], E.io)
    const by = lerp(-345, 345, sp) * L.ds
    const so = bell(t, tScan[0], tScan[0] + .06, tScan[1] + .05)
    put(beam, { x: L.doc[0], y: L.doc[1] + by, z: 2, o: so })
    const trH = Math.max(1, 160 * Math.min(1, sp * 4))
    trail.style.height = trH.toFixed(0) + 'px'
    put(trail, { x: L.doc[0], y: L.doc[1] + by - trH / 2, z: 1, o: so * .8 })
    hls.forEach((e, i) => {
      const at = lerp(tScan[0], tScan[1], (lineY(TAGS[i].line) + 345) / 690)
      e.style.setProperty('--p', P(t, at, at + .15, E.out).toFixed(3))
    })
    tags.forEach((e, i) => {
      const at = lerp(tScan[0], tScan[1], (lineY(TAGS[i].line) + 345) / 690) + .03
      const p = P(t, at, at + .3, E.out)
      const fx = lerp(L.doc[0] + L.tags, L.pills[i], brk), fy = lerp(TY[i], L.py, brk)
      put(e, { x: fx - (1 - p) * 60, y: fy, z: lerp(140, 0, brk), s: lerp(.8, 1, p) * lerp(1, .6, brk), o: Math.min(1, p * 1.6) * (1 - P(t, tPills - .1, tPills + .1)), blur: (1 - p) * 14 + brk * 8 })
    })
    // what matters, counted
    pills.forEach((e, i) => {
      const a = tPills + i * .15
      blurIn(e, t, a, { x: L.pills[i], y: L.py, dur: .3, s0: .7, blur: 16 })
      drawRim(e, P(t, a + .05, a + .55, E.io))
      count(e.querySelector('.txt'), t, a + .05, a + .55, PILLS[i][1])
      blurIn(labs[i], t, a + .15, { x: L.pills[i], y: L.py + 92, dur: .3, s0: 1, blur: 10, dy: 10 })
    })
    // and added up
    put(tree, { x: 0, y: treeY, o: P(t, tTree - .01, tTree + .05) })
    pth.style.strokeDasharray = '1 1'; pth.style.strokeDashoffset = (1 - P(t, tTree, tTree + .4, E.io)).toFixed(4)
    blurIn(score, t, tTree + .2, { x: 0, y: scoreY, dur: .35, s0: .9, blur: 18, dy: 30 })
    count(sv, t, tTree + .2, tTree + .8, 86)
    const mb = shoot(s, cam, t)
    const out = P(t, t1 - .08, t1 + .3, E.in2)
    lens(s, { mbX: mb.mbX, mbY: mb.mbY, blur: out * 28, o: 1 - P(t, t1 + .06, t1 + .3) })
  }
}

/* ============================================================
   CTA: the button flies in out of focus, a light across it, pressed on
   the beat. Then the name.
   ============================================================ */
function buildCta(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1, tPress = t0 + 1.5 * B
  const specks = bokeh(s, 12)
  const btn = h('div', 'r-btn', s.cam, `<div class="sheen"></div><span style="width:34px;height:34px;display:inline-flex">${spark(34)}</span><span>Put AI to work</span>`)
  btn.style.width = M({ land: '760px', def: '720px' })
  const sheen = btn.querySelector('.sheen')
  const cam = path([[t0, 0, 0, -120, 8, 16, 0, 1], [tPress, 0, 0, 40, 0, 0, 0, 1], [t1, 0, 0, 120, 0, 0, 0, 1]])
  cue('whoosh', t0 + .04, { d: .35, v: .6 })
  cue('shimmer', t0 + .22, { d: .9, v: .35 })
  cue('click', tPress)
  drop(tPress, 3, { n: 2, step: 7, gap: .015, wet: .15, v: .9 })
  cue('m_gap', tPress, { d: t1 - tPress })
  return t => {
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
   back; the address; out.
   ============================================================ */
function buildLogo(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const specks = bokeh(s, 14)
  const MW = M({ land: 640, def: 600 })
  const mark = h('div', 'r-mark', s.cam, WORDMARK()); mark.firstChild.setAttribute('width', MW)
  const tag = h('div', 'r-tagl', s.cam, 'AI, built into your business.')
  const url = h('div', 'r-url', s.cam, 'Book a free discovery call · <b>nabl.agency</b>')
  const tTag = t0 + B, tUrl = t0 + 3 * B
  const cam = path([[t0, 0, -20, 220, 0, -10, 0, 1], [tUrl, 0, -20, 0, 0, 0, 0, 1], [t1, 0, 0, -80, 0, 4, 0, 1]])
  cue('impact', t0 + .01, { v: .8 })
  drop(t0 + .01, 0, { n: 3, step: 4, gap: .03, wet: .6, v: .8 })
  cue('shimmer', t0 + .03, { d: 2.4, v: .6 })
  drop(tTag, 7, { wet: .5, v: .4 })
  drop(tUrl, 9, { n: 2, step: 3, wet: .6, v: .4 })
  return t => {
    const p = P(t, t0, t0 + .3, E.out)
    const gone = P(t, tUrl - .15, tUrl + .15, E.in2)
    put(mark, { y: -40, s: lerp(1.14, 1, p), o: Math.min(1, p * 1.5) * (1 - gone), blur: (1 - p) * 36 + gone * 20 })
    mark.firstChild.style.filter = `drop-shadow(0 0 ${(40 * bell(t, t0, t0 + .06, t0 + .9)).toFixed(1)}px rgba(${AMB},.45))`
    blurIn(tag, t, tTag, { y: 110, dur: .35, s0: 1, blur: 14, dy: 16, o: 1 - gone })
    const u = P(t, tUrl, tUrl + .35, E.out)
    put(url, { y: 0, o: u * (1 - P(t, t1 - .8, t1 - .2, E.io)), blur: (1 - u) * 14 })
    specks(t, 1 - P(t, t1 - .8, t1 - .2))
    shoot(s, cam, t)
    lens(s, {})
  }
}

/* the chapter names, over everything */
function buildChapters(s) {
  const CH = [
    ['01', 'AI receptionist', 'Chats and calls, answered and booked.', 'chat', .3, 2.6],
    ['02', 'Sales co-pilot', 'On your calls. Tells you what to say next.', 'call', .5, 2.6],
    ['03', 'Document analyser', 'Any document in. What matters out.', 'docs', .3, 2.4],
  ]
  const pos = M({ land: [-960 + 96, -540 + 118], port: [0, -760], sq: [0, -450], tall: [0, -570] })
  const els = CH.map(([no, name, ln]) => h('div', 'abs r-chap', s.root, `<div class="eb">${spark(18)}<span>${name}</span><span style="color:#8B8175">${no}</span></div><div class="ln">${ln}</div>`))
  return t => {
    CH.forEach(([, , , a, da, len], i) => {
      const e = els[i], ta = sceneById(a).start + da, tz = ta + len
      const pi = P(t, ta, ta + .35, E.out), po = P(t, tz, tz + .25, E.in2)
      const w = e.offsetWidth
      put(e, { x: LAND ? pos[0] + w / 2 : pos[0], y: pos[1] + (1 - pi) * 14 - po * 10, o: pi * (1 - po), blur: (1 - pi) * 12 + po * 12 })
    })
  }
}

export default function setup() {
  scene(['chat', 'book'], buildReception)
  scene(['call', 'coach'], buildCall, { hold: .34 })
  scene(['docs'], buildDocs, { hold: .32 })
  scene(['cta'], buildCta)
  scene(['logo'], buildLogo)
  scene(['chat', 'logo'], buildChapters)
  const sc = sceneById
  // [time, ax, ay, aStrength, cx, cy, cStrength, grid]: amber low in the middle, the light from above
  const tDrop = sc('chat').start + 3 * B
  const ground = [
    [0, .5, .6, .15, .5, -.08, .6, 0],
    [tDrop, .5, .6, .3, .5, -.06, .9, 0],
    [sc('book').start - .1, .5, .55, .6, .5, -.06, .95, 0],
    [sc('book').start + .25, .5, .55, .35, .5, -.06, .9, 0],
    [sc('call').start, .5, .55, .2, .5, -.08, .9, 0],
    [sc('coach').start, .6, .55, .3, .5, -.08, .9, 0],
    [sc('docs').start, .5, .55, .25, .5, -.08, .9, 0],
    [sc('cta').start, .5, .55, .35, .5, -.08, .95, 0],
    [sc('logo').start - .02, .5, .5, .6, .5, -.06, 1, 0],
    [sc('logo').start + .1, .5, .5, 1.25, .5, -.06, 1, 0],
    [sc('logo').start + .8, .5, .5, .45, .5, -.08, .95, 0],
    [TL.duration - .5, .5, .5, .1, .5, -.1, .3, 0],
    [TL.duration, .5, .5, 0, .5, -.1, 0, 0],
  ]
  return { ground, bug: ['logo', 'logo'] }
}
