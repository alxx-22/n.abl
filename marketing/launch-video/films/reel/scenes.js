/* ============================================================
   THE AI REEL: three AI services in 17 seconds, cut to music

   In the style of a product reel for Opal (by mc-visuals): one continuous
   virtual camera over a dark stage lit softly from above; glowing
   interface pieces that turn into each other through light (a bar flares
   and becomes a point, the point opens into a pill); depth of field,
   blur-in and rack focus instead of cuts; every move lands on a kick.

   01 AI receptionist   a chat and a call lie flat and tilt up to face us on
                        the drop; the voice is understood; the booking, the
                        deposit and the reminder.
   02 Sales co-pilot    a point of light drops into a call; the client's
                        words are transcribed, pixel-dissolve into English,
                        an objection glows red; pull out to the co-pilot's
                        sidebar: the playbook and what to say next.
   03 Document analyser any document riffled in and scanned; what matters
                        lifts out, counts up and adds up to a score.
   Then the button, pressed on the beat, and the name.
   The script is films/reel/film.py; the analysis of the reference and the
   shot list are films/reel/SCRIPT.md.
   ============================================================ */

import { CHECK, E, LAND, M, P, TL, W, H, WORDMARK, bell, cue, h, icon, lerp, put, rise, rng, scene, sceneById, spark, vis, words } from '../../film/stage.js'

const B = TL.beat
const WHITE = '247,242,234', ICE = '124,203,255', AMB = '233,172,87', CORAL = '240,122,106'

/* the whole scene's lens: opacity, blur, motion blur along either axis */
function lens(s, { o = 1, blur = 0, mbX = 0, mbY = 0, bright = 1 } = {}) {
  s.rig.style.opacity = o.toFixed(4)
  s.blurEl.setAttribute('stdDeviation', `${mbX.toFixed(1)} ${mbY.toFixed(1)}`)
  let f = ''
  if (mbX > .3 || mbY > .3) f += `url(#${s.mb}) `
  if (blur > .05) f += `blur(${blur.toFixed(2)}px) `
  if (Math.abs(bright - 1) > .005) f += `brightness(${bright.toFixed(3)})`
  s.rig.style.filter = f.trim() || 'none'
}
/* the camera: the world point (x, y) held at the centre, at scale sc */
const Z0 = M({ land: 1, sq: 1, tall: 1.1, port: 1.22 })
function look(s, x, y, sc = 1, rz = 0) {
  sc *= Z0
  s.cam.style.transform = `scale(${sc.toFixed(4)}) rotate(${rz.toFixed(2)}deg) translate(${(-x).toFixed(2)}px,${(-y).toFixed(2)}px)`
}
function widen(s) {             // the motion-blur filter needs room to smear vertically too
  const f = s.blurEl.parentNode
  f.setAttribute('x', '-30%'); f.setAttribute('y', '-40%'); f.setAttribute('width', '160%'); f.setAttribute('height', '180%')
  f.setAttribute('color-interpolation-filters', 'sRGB')   // linear light bands the dark gradients into colours
}
const keys = (t, K) => {        // [time, ...values] keyframes, eased in and out
  let i = 0; while (i < K.length - 2 && t >= K[i + 1][0]) i++
  const a = K[i], b = K[i + 1], p = P(t, a[0], b[0], E.io)
  return a.slice(1).map((v, j) => lerp(v, b[j + 1], p))
}
/* blur in: the entrance everything uses, from soft and large to sharp */
function blurIn(e, t, t0, { x = 0, y = 0, dur = .32, s0 = 1.12, blur = 22, dx = 0, dy = 0, s = 1, o = 1 } = {}) {
  const p = P(t, t0, t0 + dur, E.out)
  put(e, { x: x + (1 - p) * dx, y: y + (1 - p) * dy, s: s * lerp(s0, 1, p), o: o * Math.min(1, p * 1.6), blur: (1 - p) * blur })
  return p
}
function count(e, t, a, b, to, fmt = v => v) {
  const v = Math.round(to * P(t, a, b, E.out))
  e.textContent = fmt(v)
}
/* a pill with a rim that draws itself around */
function ringPill(parent, w, hgt, html) {
  const e = h('div', 'r-pill', parent, html)
  e.style.width = w + 'px'; e.style.height = hgt + 'px'
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('class', 'r-rim')
  svg.setAttribute('width', w + 16); svg.setAttribute('height', hgt + 16)
  const mk = cls => { const r = document.createElementNS(ns, 'rect'); r.setAttribute('x', 8); r.setAttribute('y', 8); r.setAttribute('width', w); r.setAttribute('height', hgt); r.setAttribute('rx', hgt / 2); r.setAttribute('pathLength', 1); if (cls) r.setAttribute('class', cls); svg.appendChild(r); return r }
  mk('base'); const rim = mk('')
  e.appendChild(svg)
  e._rim = rim
  return e
}
function drawRim(e, p) {
  e.lastChild.style.opacity = p > 0 ? 1 : 0
  e._rim.style.strokeDasharray = '1 1'
  e._rim.style.strokeDashoffset = (1 - p).toFixed(4)
  e._rim.style.opacity = p > 0 ? 1 : 0
  e.style.boxShadow = `0 0 ${(40 * p).toFixed(0)}px rgba(${WHITE},${(.16 * p).toFixed(3)})`
}

/* ============================================================
   01a · CHAT: a conversation lying flat, a voice streaming through it;
   the camera glides over it and tilts it up to face us on the drop.
   The voice is understood as it rises, flares white, becomes a point.
   ============================================================ */
function buildChat(s) {
  widen(s)
  const t0 = s.t0, tDrop = t0 + 3 * B, t1 = s.t1
  const PW = M({ land: 1500, def: 1000 }), PH = 900
  const plane = h('div', 'r-plane', s.cam)
  plane.style.width = PW + 'px'; plane.style.height = PH + 'px'
  plane.innerHTML = `<div class="ttl"><div class="s">AI receptionist · Friday</div><div class="b">1 call · 2 chats</div></div>
    <div class="r-msgs"><div class="r-bub in">Hi! Any chance of Friday?</div><div class="r-bub ai">Friday at 2pm is free. Shall I book it?</div></div>
    <div class="bars"></div><div class="axis"><span>0:00</span><span>0:02</span><span>0:04</span><span>0:06</span><span>live</span></div>`
  if (!LAND) Object.assign(plane.querySelector('.r-msgs').style, { left: '70px', right: 'auto', top: '220px', alignItems: 'flex-start' })
  const barsEl = plane.querySelector('.bars'), NB = LAND ? 70 : 46, step = (PW - 140) / NB
  const r = rng(11)
  const amp = Array.from({ length: NB }, (_, i) => .12 + .88 * Math.pow(Math.abs(Math.sin(i * .83) * Math.sin(i * .29 + .6)), .7) * (.55 + .45 * r()))
  const bars = amp.map((_, i) => { const e = h('i', '', barsEl); e.style.left = (i * step + (step - 12) / 2).toFixed(1) + 'px'; return e })
  // depth of field: soft near and far, sharp through the middle
  const dofT = h('div', 'layer', s.hud), dofB = h('div', 'layer', s.hud)
  Object.assign(dofT.style, { WebkitMaskImage: 'linear-gradient(180deg,#000 0%,#000 18%,transparent 46%)' })
  Object.assign(dofB.style, { WebkitMaskImage: 'linear-gradient(0deg,#000 0%,#000 10%,transparent 34%)' })

  // the close-up: the voice as seven levels, the one now rising in ice and amber
  const close = h('div', 'abs', s.cam)
  const CW = M({ land: 118, def: 100 }), GAP = M({ land: 46, def: 30 }), BASE = M({ land: 250, def: 300 })
  const hs = [210, 290, 240, 0, 270, 200, 250]
  const cbars = hs.map((hh, i) => { const e = h('div', 'r-cbar', close); return e })
  const now = cbars[3]
  const dash = h('div', 'r-dash', close, '<span>intent</span>'); dash.style.width = (7 * CW + 6 * GAP + 40) + 'px'
  const DASH_Y = BASE - 330
  const said = h('div', 'abs r-said', s.cam)
  if (!LAND) Object.assign(said.style, { whiteSpace: 'normal', width: '900px', textAlign: 'center', fontSize: '56px', lineHeight: '1.1' })
  const sw = words(said, '“Can I book in for Friday at 2?”')
  const tNowA = tDrop + .06, tNowB = t0 + 1.98, tFlash = t0 + 2.02, tCollapse = t1 - .09
  cue('riser', tDrop, { d: 1.25 })
  cue('m_drop', tDrop)
  cue('whoosh', tDrop - .03, { d: .34, v: 1 })
  cue('shimmer', tNowA + .25, { d: 1.2, v: .45 })
  cue('implode', t1 - .01, { d: .24 })

  return t => {
    // the glide over the plane, then the tilt up to face-on, landing on the drop
    const pg = P(t, t0, tDrop - .3, E.lin), pt = P(t, tDrop - .3, tDrop + .02, E.io)
    const rx = lerp(lerp(72, 58, pg), 0, pt)
    const S = lerp(1, M({ land: 2.2, def: 2.0 }), pt)
    const target = PH / 2 - 280
    const Y = lerp(lerp(M({ land: 330, def: 230 }), M({ land: 110, def: 10 }), pg), -target * S, pt), Z = lerp(lerp(-420, -60, pg), 0, pt)
    plane.style.transform = `translate(-50%,-50%) translate3d(0px,${Y.toFixed(1)}px,${Z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) scale(${S.toFixed(4)})`
    const swap = P(t, tDrop - .08, tDrop + .08, E.lin)       // under the blur, the plane gives way to the close-up
    vis(plane, (1 - swap) * P(t, t0, t0 + .25))
    // (the depth of field is off while the camera moves fast: the smear covers it)
    const dof = 10 * (1 - P(t, tDrop - .34, tDrop - .26))
    dofT.style.backdropFilter = dofB.style.backdropFilter = dof > .1 ? `blur(${dof.toFixed(1)}px)` : 'none'
    vis(dofT, dof > .1 ? 1 : 0); vis(dofB, dof > .1 ? 1 : 0)
    // the voice streams in from the left, newest bars brightest
    const front = P(t, t0 + .05, tDrop, E.lin) * (NB + 6)
    bars.forEach((e, i) => {
      const age = front - i
      if (age <= 0) { e.style.height = '8px'; e.style.background = `rgba(${WHITE},.10)`; e.style.boxShadow = 'none'; return }
      const g = Math.min(1, age / 3), hh = 8 + 350 * amp[i] * g * (.86 + .14 * Math.sin(t * 11 + i * 1.7))
      e.style.height = hh.toFixed(1) + 'px'
      const lit = Math.max(0, 1 - age / 14)
      if (lit > 0) {
        e.style.background = `linear-gradient(0deg, rgba(${ICE},${(.35 + .65 * lit).toFixed(2)}), rgba(${i % 9 === 4 ? AMB : ICE},${(.25 + .75 * lit).toFixed(2)}))`
        e.style.boxShadow = `0 0 ${(18 * lit).toFixed(0)}px rgba(${ICE},${(.5 * lit).toFixed(2)})`
      } else { e.style.background = `rgba(${ICE},.22)`; e.style.boxShadow = 'none' }
    })
    // the close-up
    const co = swap * (1 - P(t, tFlash, tFlash + .12))
    const pushC = lerp(1.08, 1, P(t, tDrop - .05, tDrop + .35, E.out)) * lerp(1, 1.05, P(t, tDrop, t1, E.lin))
    put(close, { s: pushC * Z0, o: 1 })
    cbars.forEach((e, i) => {
      if (i === 3) return
      const x = (i - 3) * (CW + GAP), hh = hs[i]
      Object.assign(e.style, { width: CW + 'px', height: hh + 'px' })
      put(e, { x, y: BASE - hh / 2, o: co })
    })
    put(dash, { y: DASH_Y, o: co * .9 })
    // the level now: ice as it rises, amber once it crosses the line, white-hot, then a point
    const fillP = P(t, tNowA, tNowB, E.out)
    let hh = 20 + 380 * fillP, w = CW, cx = 0, cy = BASE - hh / 2, rad = 26
    const hot = P(t, tFlash, tFlash + .1, E.out)
    const col = P(t, tCollapse, t1, E.in2)
    if (col > 0) { w = lerp(CW, 26, col); hh = lerp(hh, 26, col); cy = lerp(cy, 0, col); rad = lerp(26, 13, col) }
    Object.assign(now.style, { width: w.toFixed(1) + 'px', height: hh.toFixed(1) + 'px', borderRadius: rad.toFixed(1) + 'px' })
    const amberTop = Math.max(0, (hh - (BASE - DASH_Y)) / hh)
    now.style.background = hot > 0
      ? `rgb(${Math.round(lerp(233, 255, hot))},${Math.round(lerp(210, 255, hot))},${Math.round(lerp(170, 255, hot))})`
      : `linear-gradient(0deg, rgb(${ICE}) 0%, rgb(${ICE}) ${((1 - amberTop) * 100 - 6).toFixed(1)}%, rgb(${AMB}) ${((1 - amberTop) * 100 + 6).toFixed(1)}%, rgb(${AMB}) 100%)`
    now.style.boxShadow = `0 0 ${(40 + 120 * hot).toFixed(0)}px ${(8 + 30 * hot).toFixed(0)}px rgba(${hot > .5 ? WHITE : ICE},${(.35 + .4 * hot).toFixed(2)})`
    put(now, { x: cx, y: cy, o: swap })
    // the words, as they are understood
    put(said, { y: M({ land: -300, sq: -300, def: -390 }) * Z0, s: Z0, o: swap * (1 - P(t, tFlash - .04, tFlash + .1)), blur: P(t, tFlash - .04, tFlash + .1) * 14 })
    sw.forEach((e, i) => rise(e, t, tNowA + .02 + i * .075, { dur: .28, dy: 18, blur: 14 }))
    lens(s, { mbY: 46 * bell(t, tDrop - .26, tDrop - .08, tDrop + .08, E.in2), bright: 1 + .25 * hot })
  }
}

/* ============================================================
   01b · BOOK: the point opens into the booking; the deposit and the
   reminder join it; then the light goes grey for the next thing.
   ============================================================ */
function buildBook(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1, b = k => t0 + k * B
  const row = LAND
  const pos = row ? [[-440, 0], [0, 0], [420, 0]] : [[0, -300], [0, -20], [0, 260]]
  const LY = row ? 100 : 86
  const p1 = ringPill(s.cam, 400, 110, `<span class="ic">${icon('cal')}</span><span class="txt">Mon 9:00 am</span>`)
  const p2 = ringPill(s.cam, 330, 110, `<span class="ic">${icon('card')}</span><span class="txt">£0 paid</span>`)
  const p3 = ringPill(s.cam, 330, 110, `<span class="ic">${icon('bell')}</span><span class="txt">Thu 6 pm</span>`)
  const txt1 = p1.querySelector('.txt'), txt2 = p2.querySelector('.txt')
  const kids1 = [...p1.children].filter(e => e.tagName !== 'svg')
  const l1 = h('div', 'r-lab', s.cam, 'Booked'), l2 = h('div', 'r-lab', s.cam, 'Deposit'), l3 = h('div', 'r-lab', s.cam, 'Reminder sent')
  const dot = h('div', 'r-dot', s.cam)
  const wash = h('div', 'r-wash', s.root)
  const ROLL = ['Mon 9:00 am', 'Tue 11:30 am', 'Wed 4:15 pm', 'Thu 10:00 am', 'Fri 9:30 am', 'Fri 2:00 pm']
  const tr = k => t0 + .2 + k * .075
  cue('pop', t0 + .01, { v: .7 })
  ROLL.forEach((_, k) => k && cue('tick', tr(k), { v: .5 + k * .08 }))
  cue('blip', tr(5) + .02, { v: .9 })
  cue('pop', b(2), { v: .55 }); cue('pop', b(3), { v: .55 })
  cue('blip', b(2) + .42, { v: .7 })
  cue('whoosh', t1, { d: .4, v: .6 })

  return t => {
    // the point opens into the pill
    const op = P(t, t0, t0 + .3, E.out)
    const move = P(t, b(2) - .05, b(2) + .3, E.io)
    const base = [lerp(0, pos[0][0], move), lerp(0, pos[0][1], move)]
    put(dot, { x: 0, y: 0, s: 1 + op * 1.5, o: 1 - P(t, t0 + .04, t0 + .18) })
    const w = lerp(26, 400, op), hh = lerp(26, 110, op)
    p1.style.width = w.toFixed(1) + 'px'; p1.style.height = hh.toFixed(1) + 'px'
    put(p1, { x: base[0], y: base[1], o: 1 })
    kids1.forEach(e => vis(e, P(t, t0 + .14, t0 + .3)))
    drawRim(p1, P(t, t0 + .27, t0 + .8, E.io))
    const k = Math.min(ROLL.length - 1, Math.max(0, Math.floor((t - t0 - .2) / .075) + 1))
    txt1.textContent = t < tr(1) ? ROLL[0] : ROLL[k]
    const rollB = t < tr(5) + .05 ? 1 : 0
    txt1.style.filter = rollB ? 'blur(1.4px)' : 'none'
    blurIn(l1, t, t0 + .42, { x: base[0], y: base[1] + LY, dur: .3, s0: 1, blur: 12, dy: 10 })
    // the deposit and the reminder, each on its beat
    blurIn(p2, t, b(2), { x: pos[1][0], y: pos[1][1], dx: row ? 160 : 0, dy: row ? 0 : 120, s0: .9, blur: 20 })
    drawRim(p2, P(t, b(2) + .05, b(2) + .55, E.io))
    count(txt2, t, b(2) + .08, b(2) + .42, 20, v => `£${v} paid`)
    blurIn(l2, t, b(2) + .15, { x: pos[1][0], y: pos[1][1] + LY, dur: .3, s0: 1, blur: 12, dy: 10 })
    blurIn(p3, t, b(3), { x: pos[2][0], y: pos[2][1], dx: row ? 160 : 0, dy: row ? 0 : 120, s0: .9, blur: 20 })
    drawRim(p3, P(t, b(3) + .05, b(3) + .55, E.io))
    blurIn(l3, t, b(3) + .15, { x: pos[2][0], y: pos[2][1] + LY, dur: .3, s0: 1, blur: 12, dy: 10 })
    // the drift: slowly out, then up and away into grey
    const up = P(t, b(4) - .1, t1 + .05, E.in2)
    look(s, 0, lerp(0, row ? 0 : 20, move) - up * 120, lerp(1.06, 1, P(t, t0, b(2) + .3, E.out)) * lerp(1, .94, up))
    lens(s, { blur: up * 16, o: 1 - up * .5 })
    vis(wash, P(t, b(4) + .05, t1, E.in2))
  }
}

/* ============================================================
   02 · CALL + COACH: the co-pilot drops into a call as a point of light,
   transcribes the client, dissolves Spanish into English, flags the
   objection; pull out to its sidebar: the playbook and what to say next.
   ============================================================ */
function buildCall(s) {
  widen(s)
  const [call, coach] = s.cuts
  const t0 = s.t0, t1 = s.t1, b = k => t0 + k * B, tC = coach.start
  const L = M({
    land: { win: [0, -70], cap: [0, 200], flag: [0, 292], side: [760, -10], zoom: [372, -24, .92], badge: [0, -318] },
    sq: { win: [0, -120], cap: [0, 160], flag: [0, 250], side: [0, 660], zoom: [0, 290, .7], badge: [0, -368] },
    def: { win: [0, -120], cap: [0, 160], flag: [0, 250], side: [0, 660], zoom: [0, 220, .86], badge: [0, -368] },
  })
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
  // the pixel dissolve, on a canvas over the caption
  const CVW = 1100, CVH = 150
  const cv = h('canvas', 'abs', s.cam); cv.width = CVW; cv.height = CVH
  const g = cv.getContext('2d'), SQ = 15, cols = Math.ceil(CVW / SQ), rows = Math.ceil(CVH / SQ)
  const rr = rng(5), cells = Array.from({ length: cols * rows }, () => [rr(), rr(), rr()])
  const PAL = [AMB, ICE, WHITE, '200,170,255', CORAL]
  // the sidebar
  const side = h('div', 'r-side', s.cam, `
    <div class="hd">${spark(24)}<span>n.abl co-pilot</span><span class="live">● LIVE</span></div>
    <div class="r-blk"><div class="sec">Transcript · ES → EN</div><div class="tr"><b>Client</b>It’s a bit pricey for us…</div></div>
    <div class="r-blk"><div class="sec">Playbook</div><div class="card"><div class="ic">${icon('book')}</div><div><div class="t1">Pricing objection</div><div class="t2">Reframe on value · offer a pilot</div></div></div></div>
    <div class="r-blk"><div class="sec">Say next</div><div class="say"></div></div>
    <div class="chips"><span class="chip hot">Pivot → ROI</span><span class="chip">Translate ES ⇄ EN</span></div>`)
  const blks = [...side.children]
  const say = side.querySelector('.say')
  const sayW = words(say, '“Most teams start with a 30-day pilot, so you only pay once it’s working.”')
  const tDot = b(2), tCap = b(2) + .12, tGl = b(3), tSwap = b(3) + .2, tObj = b(4) + .08, tOut = tC

  cue('whoosh', t0 + .05, { d: .3, v: .5 })
  cue('fall', tDot - .38, { d: .38 })
  cue('pop', tDot, { v: .8 })
  es.forEach((_, i) => cue('key', tCap + i * .06, { v: .5 }))
  cue('glitch', tGl, { d: .42 })
  cue('alert', tObj, { v: .6 })
  cue('hit', tObj, { v: .7 })
  cue('m_lpf', tObj + .1, { d: tOut - tObj - .1 })
  cue('whoosh', tOut + .02, { d: .34, v: 1 })
  cue('pop', b(7), { v: .5 }); cue('pop', b(8), { v: .5 })
  sayW.forEach((_, i) => i % 2 === 0 && cue('key', b(7) + .2 + i * .035, { v: .35 }))

  return t => {
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
    const dy = lerp(-640, L.badge[1], fall)
    put(dot, { x: 0, y: dy, s: 1, o: P(t, tDot - .4, tDot - .3) * (1 - P(t, tDot + .02, tDot + .12)) })
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
    es.forEach((e, i) => rise(e, t, tCap + i * .06, { dur: .24, dy: 14, blur: 12 }))
    // the dissolve: squares of colour sweep through the words and leave the translation behind
    const d = bell(t, tGl, tGl + .2, tGl + .44, E.out)
    g.clearRect(0, 0, CVW, CVH)
    if (d > 0) {
      const fr = Math.floor(t * 30)
      for (let j = 0; j < cells.length; j++) {
        const [a, c, k] = cells[j]
        const x = (j % cols), y = Math.floor(j / cols)
        const wave = 1 - Math.abs(x / cols - P(t, tGl, tGl + .44, E.lin)) * 2.2
        if (a > d * 1.15 * Math.max(0, wave + .35)) continue
        const flick = ((j * 31 + fr * 17) % 7) / 7
        g.fillStyle = `rgba(${PAL[Math.floor(((c + flick) * 5)) % 5]},${(.25 + .75 * k * d).toFixed(2)})`
        g.fillRect(x * SQ, y * SQ, SQ - 2, SQ - 2)
      }
    }
    put(cv, { x: L.cap[0], y: L.cap[1], o: 1 })
    // the objection: a red glow, the music pulls away, the camera leans in
    const ob = P(t, tObj, tObj + .3, E.out)
    blurIn(flag, t, tObj, { x: L.flag[0], y: L.flag[1], dur: .28, s0: .7, blur: 12 })
    const obOn = ob * (1 - P(t, tOut, tOut + .3))
    put(glow, { x: L.win[0], y: L.win[1], s: lerp(.6, 1.05, ob), o: obOn * (.85 + .15 * Math.sin(t * 9)) })
    win.style.borderColor = `rgba(${CORAL},${(.09 + .8 * obOn).toFixed(3)})`
    win.style.boxShadow = `0 40px 120px rgba(0,0,0,.6), 0 0 ${(60 * obOn).toFixed(0)}px rgba(${CORAL},${(.45 * obOn).toFixed(3)})`
    // pull out to the sidebar, with a vertical smear
    const zo = P(t, tOut, tOut + .34, E.io)
    const lean = lerp(1, 1.07, P(t, tObj, tOut, E.io))
    const Z = L.zoom
    look(s, lerp(0, Z[0], zo), lerp(0, Z[1], zo), lerp(lean, Z[2], zo))
    vis(cap, 1 - P(t, tOut, tOut + .15)); vis(flag, (1 - P(t, tOut, tOut + .15)) * Math.min(1, ob * 2))
    put(side, { x: L.side[0], y: L.side[1], o: P(t, tOut + .05, tOut + .2) })
    blks.forEach((e, i) => {
      const at = [tOut + .1, tOut + .2, b(7), b(7) + .12, b(8)][i]
      const p = P(t, at, at + .3, E.out)
      e.style.opacity = p.toFixed(3); e.style.transform = `translateY(${((1 - p) * 20).toFixed(1)}px)`; e.style.filter = p < 1 ? `blur(${((1 - p) * 10).toFixed(1)}px)` : 'none'
    })
    sayW.forEach((e, i) => rise(e, t, b(7) + .2 + i * .035, { dur: .2, dy: 8, blur: 8 }))
    // out of focus into the next thing
    const rf = P(t, t1 - .08, t1 + .32, E.in2)
    lens(s, { mbY: 50 * bell(t, tOut, tOut + .12, tOut + .32, E.in2), blur: rf * 30, o: 1 - P(t, t1 + .08, t1 + .32) })
  }
}

/* ============================================================
   03 · DOCS: any document, riffled in; one is scanned and what matters
   lifts out of it, counts up and adds up to a score.
   ============================================================ */
function buildDocs(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1, b = k => t0 + k * B
  const L = M({
    land: { doc: [0, 0], tags: 470, pills: [-400, 0, 400], py: 190, tree: 80, score: -150, ds: 1 },
    def: { doc: [-130, 0], tags: 250, pills: [-310, 0, 310], py: 190, tree: 80, score: -150, ds: .92 },
  })
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
  const doc = docs[4], hls = [...doc.querySelectorAll('.ln.hl')]
  const beam = h('div', 'r-beam', s.cam), trail = h('div', 'r-trail', s.cam)
  beam.style.width = '600px'; trail.style.width = '520px'
  const TAGS = [
    { html: `<span style="color:#7CCBFF">${icon('clock')}</span><span><span class="k">Deadline</span><br>14 Nov, 12:00</span>`, line: 4 },
    { html: `<span style="color:#F07A6A">${icon('alert')}</span><span><span class="k">Risk</span><br>Uncapped liability</span>`, line: 9 },
    { html: `<span style="color:#E9AC57">${icon('survey')}</span><span><span class="k">Requirement</span><br>ISO 27001</span>`, line: 14 },
  ]
  const tags = TAGS.map(o => h('div', 'r-tag', s.cam, o.html))
  const lns = [...doc.querySelectorAll('.ln')]
  const lineY = j => lns[j].offsetTop + 6 - 345                        // the centre of line j, from the doc's centre
  const PILLS = [['doc', 42, 'Requirements'], ['alert', 3, 'Risks'], ['clock', 2, 'Deadlines']]
  const pills = PILLS.map(([ic, n]) => ringPill(s.cam, M({ land: 230, def: 210 }), 100, `<span class="ic">${icon(ic)}</span><span class="txt">0</span>`))
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

  const tFl = [t0 + .22, t0 + .31, t0 + .4, t0 + .49]
  const tScan = [b(1) - .02, b(2) + .22]
  const tBreak = b(3), tTree = b(5)
  cue('whoosh', t0 + .02, { d: .3, v: .6 })
  tFl.forEach((x, i) => cue('paper', x, { v: .7, pan: (i % 2 ? .4 : -.4) }))
  cue('hit', b(1), { v: .5 })
  cue('scan', tScan[0], { d: tScan[1] - tScan[0] })
  cue('whoosh', tBreak + .02, { d: .3, v: .6 })
  ;[0, 1, 2].forEach(i => cue('pop', tBreak + .08 + i * .1, { v: .55 }))
  cue('draw', tTree, { d: .45 })
  cue('blip', tTree + .5, { v: .9 })

  return t => {
    // a riffle of documents, the last one ours: in from out of focus
    const rf = P(t, t0 - .3, t0 + .28, E.out)
    const settle = P(t, tFl[3], b(1), E.out)
    const brk = P(t, tBreak - .05, tBreak + .32, E.io)
    docs.forEach((e, i) => {
      if (i < 4) {
        const a = i === 0 ? t0 - .3 : tFl[i - 1], z = tFl[i]
        const pin = P(t, a, a + .12, E.out), pout = P(t, z, z + .14, E.in2)
        put(e, { x: L.doc[0] + (1 - pin) * 260 - pout * 520, y: L.doc[1] + (i % 2 ? 12 : -12), r: (i % 2 ? 3 : -4) * (1 - pin) - pout * 10, s: L.ds * lerp(1.5, 1, rf), o: Math.min(1, pin * 2) * (1 - pout), blur: (1 - rf) * 30 + pout * 12 })
      } else {
        const pin = P(t, tFl[3], tFl[3] + .14, E.out)
        put(e, { x: L.doc[0] + (1 - pin) * 260, y: L.doc[1] - brk * 260, s: L.ds * lerp(1.04, 1, settle) * lerp(1, .5, brk), o: Math.min(1, pin * 2) * (1 - brk), blur: brk * 14 })
      }
    })
    // the scan: a line of light down the page, marking what matters as it passes
    const sp = P(t, tScan[0], tScan[1], E.io)
    const by = lerp(-345, 345, sp) * L.ds
    put(beam, { x: L.doc[0], y: L.doc[1] + by, o: bell(t, tScan[0], tScan[0] + .06, tScan[1] + .05) })
    const trH = Math.max(1, 160 * Math.min(1, sp * 4))
    trail.style.height = trH.toFixed(0) + 'px'
    put(trail, { x: L.doc[0], y: L.doc[1] + by - trH / 2, o: bell(t, tScan[0], tScan[0] + .06, tScan[1] + .05) * .8 })
    hls.forEach((e, i) => {
      const at = lerp(tScan[0], tScan[1], (lineY(TAGS[i].line) + 345) / 690)
      e.style.setProperty('--p', P(t, at, at + .15, E.out).toFixed(3))
    })
    tags.forEach((e, i) => {
      const at = lerp(tScan[0], tScan[1], (lineY(TAGS[i].line) + 345) / 690) + .03
      const ty = L.doc[1] + lineY(TAGS[i].line) * L.ds
      const p = P(t, at, at + .3, E.out)
      // they fly down into the pills as the page goes
      const px = L.pills[i], py = L.py
      const fx = lerp(L.doc[0] + L.tags, px, brk), fy = lerp(ty, py, brk)
      put(e, { x: fx + (1 - p) * -60, y: fy, s: lerp(.8, 1, p) * lerp(1, .6, brk), o: Math.min(1, p * 1.6) * (1 - P(t, tBreak + .1, tBreak + .3)), blur: (1 - p) * 14 + brk * 8 })
    })
    // what matters, counted
    pills.forEach((e, i) => {
      const a = tBreak + .08 + i * .1
      blurIn(e, t, a, { x: L.pills[i], y: L.py, dur: .3, s0: .7, blur: 16 })
      drawRim(e, P(t, a + .05, a + .55, E.io))
      count(e.querySelector('.txt'), t, a + .05, a + .5, PILLS[i][1])
      blurIn(labs[i], t, a + .15, { x: L.pills[i], y: L.py + 92, dur: .3, s0: 1, blur: 10, dy: 10 })
    })
    // and added up
    const treeY = L.py - 62 - TH / 2
    put(tree, { x: 0, y: treeY, o: 1 })
    pth.style.strokeDasharray = '1 1'; pth.style.strokeDashoffset = (1 - P(t, tTree, tTree + .4, E.io)).toFixed(4)
    vis(tree, P(t, tTree - .01, tTree + .05))
    blurIn(score, t, tTree + .15, { x: 0, y: treeY - TH / 2 - 92, dur: .35, s0: .9, blur: 18, dy: 30 })
    count(sv, t, tTree + .15, tTree + .75, 86)
    // the camera: close on the page, then drifting up as the answer arrives
    const zp = M({ land: 1.14, def: 1 })
    const cy = keys(t, [[t0, 0, 1.04], [b(1), 0, 1], [tBreak, 0, 1], [tBreak + .4, 70, zp], [tTree, 70, zp], [t1, -20, zp * 1.05]])
    look(s, 0, cy[0], cy[1])
    const out = P(t, t1 - .08, t1 + .3, E.in2)
    lens(s, { blur: out * 28, o: 1 - P(t, t1 + .06, t1 + .3) })
  }
}

/* ============================================================
   CTA: the button, out of focus into focus, a light across it, pressed
   on the beat. Then the name.
   ============================================================ */
function buildCta(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1, tPress = t0 + 1.5 * B
  const btn = h('div', 'r-btn', s.cam, `<div class="sheen"></div><span style="width:34px;height:34px;display:inline-flex">${spark(34)}</span><span>Put AI to work</span>`)
  btn.style.width = M({ land: '760px', def: '720px' })
  const sheen = btn.querySelector('.sheen')
  cue('whoosh', t0 + .04, { d: .3, v: .6 })
  cue('shimmer', t0 + .22, { d: .9, v: .35 })
  cue('click', tPress)
  cue('m_gap', tPress, { d: t1 - tPress })
  return t => {
    const p = P(t, t0 - .3, t0 + .3, E.out)
    const press = bell(t, tPress, tPress + .05, tPress + .2, E.out)
    const flare = P(t, tPress + .02, t1, E.in2)
    put(btn, { s: lerp(1.6, 1, p) * (1 - .05 * press) * lerp(1, 1.04, flare), o: Math.min(1, p * 1.5), blur: (1 - p) * 30, bright: 1 + .5 * press + 1.6 * flare })
    btn.style.boxShadow = `0 0 ${(30 + 90 * (press + flare)).toFixed(0)}px rgba(${AMB},${(.15 + .4 * (press + flare)).toFixed(2)})`
    const sp = P(t, t0 + .15, tPress, E.io)
    sheen.style.left = lerp(-70, 110, sp).toFixed(1) + '%'
    look(s, 0, 0, 1)
    lens(s, { o: 1 - P(t, t1 - .04, t1 + .02) })
  }
}

/* ============================================================
   LOGO: the name blurs into focus under the light; the address; out.
   ============================================================ */
function buildLogo(s) {
  widen(s)
  const t0 = s.t0, t1 = s.t1
  const MW = M({ land: 640, def: 600 })
  const mark = h('div', 'r-mark', s.cam, WORDMARK()); mark.firstChild.setAttribute('width', MW)
  const tag = h('div', 'r-tagl', s.cam, 'AI, built into your business.')
  const url = h('div', 'r-url', s.cam, 'Book a free discovery call · <b>nabl.agency</b>')
  const tUrl = t0 + 4 * B
  cue('impact', t0 + .01, { v: .8 })
  cue('shimmer', t0 + .03, { d: 2.4, v: .6 })
  cue('pop', t0 + 1.2 * B, { v: .3 })
  return t => {
    const p = P(t, t0, t0 + .3, E.out)
    const gone = P(t, tUrl - .15, tUrl + .15, E.in2)
    put(mark, { y: -40, s: lerp(1.14, 1, p) * lerp(1, 1.035, P(t, t0, tUrl, E.lin)), o: Math.min(1, p * 1.5) * (1 - gone), blur: (1 - p) * 36 + gone * 20 })
    mark.firstChild.style.filter = `drop-shadow(0 0 ${(40 * bell(t, t0, t0 + .06, t0 + .9)).toFixed(1)}px rgba(${AMB},.45))`
    blurIn(tag, t, t0 + 1.2 * B, { y: 110, dur: .35, s0: 1, blur: 14, dy: 16, o: 1 - gone })
    const u = P(t, tUrl, tUrl + .35, E.out)
    put(url, { y: 0, o: u * (1 - P(t, t1 - 1.1, t1 - .3, E.io)), blur: (1 - u) * 14 })
    look(s, 0, 0, 1)
    lens(s, {})
  }
}

/* the chapter names, over everything */
function buildChapters(s) {
  const CH = [
    ['01', 'AI receptionist', 'Chats and calls, answered and booked.', 'chat', .45, 'book', -.3],
    ['02', 'Sales co-pilot', 'On your calls. Tells you what to say next.', 'call', .5, 'coach', -.12],
    ['03', 'Document analyser', 'Any document in. What matters out.', 'docs', .45, 'docs', -.4],
  ]
  const pos = M({ land: [-960 + 96, -540 + 118], port: [0, -760], sq: [0, -450], tall: [0, -570] })
  const els = CH.map(([no, name, ln]) => {
    const e = h('div', 'abs r-chap', s.root, `<div class="eb">${spark(18)}<span>${name}</span><span style="color:#8B8175">${no}</span></div><div class="ln">${ln}</div>`)
    return e
  })
  return t => {
    CH.forEach(([, , , a, da, z, dz], i) => {
      const e = els[i], ta = sceneById(a).start + da, tz = sceneById(z).end + dz
      const pi = P(t, ta, ta + .35, E.out), po = P(t, tz, tz + .25, E.in2)
      const w = e.offsetWidth
      put(e, { x: LAND ? pos[0] + w / 2 : pos[0], y: pos[1] + (1 - pi) * 14 - po * 10, o: pi * (1 - po), blur: (1 - pi) * 12 + po * 12 })
    })
  }
}

export default function setup() {
  scene(['chat'], buildChat)
  scene(['book'], buildBook)
  scene(['call', 'coach'], buildCall, { hold: .34 })
  scene(['docs'], buildDocs, { hold: .32 })
  scene(['cta'], buildCta)
  scene(['logo'], buildLogo)
  scene(['chat', 'logo'], buildChapters)
  const sc = sceneById
  // [time, ax, ay, aStrength, cx, cy, cStrength, grid]: amber low in the middle, the light from above
  const tDrop = sc('chat').start + 3 * B
  const ground = [
    [0, .5, .6, .15, .5, -.08, .55, 0],
    [tDrop, .5, .6, .3, .5, -.06, .9, 0],
    [sc('book').start - .1, .5, .55, .55, .5, -.06, .95, 0],
    [sc('book').start + .2, .5, .55, .35, .5, -.06, .9, 0],
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
