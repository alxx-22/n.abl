/* ============================================================
   PUT AI TO WORK: the AI service film

   Ten shots in 33 seconds: the world gets a new operating system, it is
   called AI, and n.abl builds it into the business. Then three customer
   agents, a wall of everything else AI can take on, what the business
   gets, and the end card. The script is films/ai/film.py; the brief and
   the shot list are films/ai/SCRIPT.md.
   ============================================================ */

import {
  CHECK, E, H, I, LAND, M, P, R, STAR, TL, W, WIPES, WORDMARK, arc, bell, bubble, camera, chatPanel, cue, endCard, focus, grid, h, icon, label, lerp, lineStart, offs, pop, put, rise, rng, scene, sceneById, slot, spark, typingDots, vis, we, words, wt,
} from '../../film/stage.js'

/* ============================================================
   01 + 02 · BOOT: the world gets a new operating system, and it is AI
   ============================================================ */
function buildBoot(s) {
  const [boot, ai] = s.cuts
  const L = M({
    land: { g: [540, -10], R: 320, txt: [-340, 30], align: 'left', tw: 1060, chip: [-340, -230] },
    port: { g: [0, -360], R: 330, txt: [0, 330], align: 'center', tw: 980, chip: [0, 590] },
    sq:   { g: [0, -190], R: 250, txt: [0, 290], align: 'center', tw: 980, chip: [0, -460] },
    tall: { g: [0, -250], R: 280, txt: [0, 330], align: 'center', tw: 980, chip: [0, 560] },
  })
  // the globe is drawn on a canvas: a Fibonacci sphere of dots, turning
  const cv = h('canvas', 'full', s.cam); cv.width = W; cv.height = H
  const g = cv.getContext('2d')
  const N = 900, pts = []
  for (let i = 0; i < N; i++) {
    const yy = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - yy * yy), th = i * 2.399963
    pts.push([Math.cos(th) * r, yy, Math.sin(th) * r, i % 19 === 0])
  }
  const chip = h('div', 'abs chipbar', s.cam, `${spark(18)}<span data-l>Installing AI</span><span class="track"><span class="fill"></span></span><span class="pct">0%</span>`)
  const fill = chip.querySelector('.fill'), pct = chip.querySelector('.pct'), lab = chip.querySelector('[data-l]')
  const tx = h('div', 'abs', s.cam); tx.style.width = L.tw + 'px'; tx.style.textAlign = L.align
  const l1 = h('div', 'display bootline nowrap', tx), l2 = h('div', 'display bootline nowrap', tx)
  const w1 = words(l1, 'The world just got a')
  const w2a = words(l2, 'new')
  l2.appendChild(document.createTextNode(' '))
  const os = h('span', '', l2); os.style.position = 'relative'; os.style.display = 'inline-block'
  const w2b = words(os, 'operating system.')
  const ul = h('span', 'uline', os)
  // the reveal
  const ag = h('div', 'abs', s.cam); ag.style.textAlign = 'center'; ag.style.width = 'max-content'
  const called = h('div', 'display', ag); called.style.fontSize = M({ land: '64px', def: '56px' }); called.style.color = '#C8BBA8'
  called.style.marginBottom = '28px'
  const cw = words(called, "It's called")
  const aiw = h('div', 'aiword', ag); aiw.textContent = 'AI'
  const sp = h('div', 'abs', s.cam, spark(M({ land: 170, def: 140 })))
  const rays = Array.from({ length: 28 }, () => h('div', 'ray', s.cam))
  const bits = Array.from({ length: 44 }, () => h('div', 'bit', s.cam))
  const rings = [0, 1, 2].map(() => { const r = h('div', 'ring', s.cam); r.style.width = r.style.height = '200px'; return r })
  const r = rng(5)
  rays.forEach((e, i) => { e._a = (i / rays.length) * 360 + r() * 8; e._l = 380 + r() * 520; e.style.width = '10px' })
  bits.forEach(e => { e._a = r() * Math.PI * 2; e._v = 500 + r() * 1100; e._s = 6 + r() * 12; e._r = r() * 180; e.style.width = e.style.height = e._s + 'px' })

  const tNew = wt(1, 'new'), tOp = wt(1, 'operating'), tSys = we(1, 'system')
  const tIts = wt(2, "it's"), tAI = wt(2, 'ai')
  const tDone = boot.end - .12
  cue('boot', .05)
  cue('tick', tDone, { v: .9 })
  cue('riser', tAI, { d: tAI - .3 })
  cue('implode', tAI - .02, { d: tAI - ai.start })
  cue('impact', tAI, { v: 1.1 })
  cue('shimmer', tAI + .04, { d: 1.6 })
  cue('whoosh', s.t1 - .3, { d: .45, v: .9 })

  return t => {
    camera(s, t, { inT: 'none', outT: 'through', outDur: .3, push: .03 })
    // globe: grows out of a single dot, turns, then falls into the reveal
    const grow = P(t, -.5, .9, E.out)
    const fall = P(t, ai.start - .05, tAI - .02, E.in3)
    const gx = lerp(L.g[0], 0, fall), gy = lerp(L.g[1], 0, fall)
    const R0 = L.R * (1 + .03 * Math.sin(t * 2))
    const rot = t * .75, tilt = .38
    g.clearRect(0, 0, W, H)
    const cx = W / 2 + gx, cy = H / 2 + gy
    if (fall < 1) {
      g.lineWidth = 1.2
      for (const lat of [-.5, 0, .5]) {
        const rr = Math.sqrt(1 - lat * lat) * R0 * grow * (1 - fall)
        g.strokeStyle = `rgba(240,231,216,${(.10 * grow * (1 - fall)).toFixed(3)})`
        g.beginPath(); g.ellipse(cx, cy + lat * R0 * grow * Math.cos(tilt) * (1 - fall), rr, rr * Math.sin(tilt), 0, 0, Math.PI * 2); g.stroke()
      }
    }
    for (let i = 0; i < N; i++) {
      const [px, py, pz, am] = pts[i]
      const x1 = px * Math.cos(rot) + pz * Math.sin(rot), z1 = -px * Math.sin(rot) + pz * Math.cos(rot)
      const y2 = py * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = py * Math.sin(tilt) + z1 * Math.cos(tilt)
      const gi = P(grow, (i % 97) / 97 * .5, (i % 97) / 97 * .5 + .5, E.out)
      const fi = P(fall, (i % 53) / 53 * .4, 1, E.in2)
      const rr = R0 * gi * (1 - fi)
      const X = cx + x1 * rr, Y = cy + y2 * rr
      const depth = (z2 + 1) / 2
      const a = (.28 + .72 * depth) * gi
      const sz = (1.6 + 2.8 * depth) * (1 - .6 * fi)
      g.fillStyle = am ? `rgba(233,172,87,${Math.min(1, a * 1.3).toFixed(3)})` : `rgba(240,231,216,${a.toFixed(3)})`
      g.fillRect(X - sz / 2, Y - sz / 2, sz, sz)
    }
    // the installing chip
    const cp = 1 - P(t, ai.start - .05, ai.start + .15)
    put(chip, { x: L.chip[0], y: L.chip[1], o: cp })
    const prog = P(t, .05, tDone, E.io)
    fill.style.transform = `scaleX(${prog.toFixed(4)})`
    pct.textContent = Math.round(prog * 100) + '%'
    const done = t >= tDone ? 'AI installed' : 'Installing AI'
    if (lab.textContent !== done) lab.textContent = done
    // the line
    const txOut = P(t, ai.start - .05, ai.start + .2, E.in2)
    put(tx, { x: L.txt[0], y: L.txt[1] - txOut * 40, o: 1 - txOut, blur: txOut * 16 })
    const k1 = ['the', 'world', 'just', 'got', 'a']
    w1.forEach((w, i) => rise(w, t, wt(1, k1[i]) - .06, { dur: .34, dy: 34 }))
    rise(w2a[0], t, tNew - .06, { dur: .34, dy: 34 })
    w2b.forEach((w, i) => rise(w, t, [tOp, wt(1, 'system')][i] - .06, { dur: .34, dy: 34 }))
    ul.style.transform = `scaleX(${P(t, tOp, tSys, E.ease).toFixed(4)})`
    // the reveal
    const ain = P(t, tAI - .02, tAI + .32, E.out)
    put(ag, { y: M({ land: 10, def: 0 }), s: lerp(1.5, 1, ain) * (1 + .03 * P(t, tAI + .3, s.t1)), o: P(t, tIts - .08, tIts + .1) })
    cw.forEach((w, i) => rise(w, t, [tIts, wt(2, 'called')][i] - .05, { dur: .3, dy: 20 }))
    vis(aiw, P(t, tAI - .02, tAI + .06)); aiw.style.filter = ain < 1 ? `blur(${((1 - ain) * 26).toFixed(1)}px)` : 'none'
    const spin = P(t, tAI, tAI + .5, E.back)
    const aiW = aiw.offsetWidth, aiH = aiw.offsetHeight
    put(sp, { x: aiW * .52, y: -aiH * .38 + M({ land: 10, def: 0 }), s: spin * (1 + .06 * Math.sin((t - tAI) * 6) * P(t, tAI + .5, tAI + .8)), r: (1 - spin) * -140, o: P(t, tAI, tAI + .05) })
    sp.style.filter = `drop-shadow(0 0 ${(30 + 50 * bell(t, tAI, tAI + .08, tAI + 1)).toFixed(0)}px rgba(233,172,87,.8))`
    rays.forEach(e => {
      const p = P(t, tAI, tAI + .55, E.out)
      e.style.width = (e._l * p) + 'px'
      e.style.transform = `rotate(${e._a}deg) translateX(${(80 + e._l * .6 * p).toFixed(1)}px)`
      vis(e, t >= tAI ? (1 - P(t, tAI + .1, tAI + .6)) * .9 : 0)
    })
    bits.forEach(e => {
      const dt = Math.max(0, t - tAI), d = e._v * (1 - Math.exp(-dt * 3.2)) / 3.2
      e.style.transform = `translate(-50%,-50%) translate(${(Math.cos(e._a) * d).toFixed(1)}px,${(Math.sin(e._a) * d).toFixed(1)}px) rotate(${(e._r + dt * 200).toFixed(0)}deg)`
      vis(e, t >= tAI ? 1 - P(t, tAI + .25, tAI + 1.1) : 0)
    })
    rings.forEach((rg, k) => {
      const p = P(t, tAI + k * .08, tAI + .9 + k * .18, E.out)
      put(rg, { s: lerp(.2, 7 + k * 2, p), o: t >= tAI + k * .08 ? (1 - p) * (k ? .5 : .9) : 0 })
    })
  }
}

/* ============================================================
   03 · INTO YOUR BUSINESS: a flight through the business, lighting it up
   ============================================================ */
function buildInto(s) {
  const n = 3
  const TILES = [['Calendar', 'cal'], ['Inbox', 'inbox'], ['Live chat', 'chat'], ['Invoices', 'invoice'], ['Reviews', 'star'], ['CRM', 'db'], ['Phone calls', 'phone'],
    ['Orders', 'box'], ['Reports', 'chart'], ['Quotes', 'quote'], ['Payments', 'card'], ['Support', 'help'], ['Stock', 'stack'], ['Team', 'team'], ['Bookings', 'clock'], ['Leads', 'lead']]
  const Rx = M({ land: 700, port: 400, sq: 470, tall: 430 }), Ry = M({ land: 380, port: 720, sq: 400, tall: 520 })
  const field = h('div', 'plane', s.cam)
  const r = rng(21)
  const tiles = TILES.map(([nm, ic], i) => {
    const e = h('div', 'tile', field, `<div class="ic">${icon(ic)}</div><div><div class="nm">${nm}</div><div class="st"><i></i>Connected</div></div>`)
    const a = i * 2.399963 + .4
    e._x = Math.cos(a) * Rx * (.85 + .35 * r()); e._y = Math.sin(a) * Ry * (.8 + .35 * r())
    e._z = -3400 + i * 215; e._r = (r() - .5) * 16
    return e
  })
  const scrim = h('div', 'layer', s.cam)
  scrim.style.background = 'radial-gradient(ellipse 42% 30% at 50% 50%, rgba(14,12,10,.92), rgba(14,12,10,.6) 60%, rgba(14,12,10,0) 100%)'
  const tx = h('div', 'abs display', s.cam)
  tx.style.fontSize = M({ land: '100px', port: '86px', def: '80px' }); tx.style.textAlign = 'center'; tx.style.width = 'max-content'
  const a1 = h('div', 'nowrap', tx), a2 = h('div', 'nowrap', tx), a3 = LAND ? a2 : h('div', 'nowrap', tx)
  const wAnd = words(a1, 'And')[0]
  a1.appendChild(document.createTextNode(' '))
  const wm = h('span', 'w', a1, WORDMARK()); wm.firstChild.style.height = '.86em'; wm.firstChild.style.width = 'auto'; wm.firstChild.style.verticalAlign = '-.16em'
  const wb = LAND ? (a1.appendChild(document.createTextNode(' ')), words(a1, 'builds it')) : words(a2, 'builds it')
  if (!LAND) a2.appendChild(document.createTextNode(' '))
  const w2 = [...words(a2, 'into'), ...(LAND ? (a2.appendChild(document.createTextNode(' ')), []) : []), ...words(a3, 'your business.')]
  const dolly = t => lerp(0, 2900, P(t, s.t0 - .2, s.t1 + .35, E.io))
  // when each tile comes close enough to light up
  const lit = tiles.map(e => { for (let t = s.t0; t < s.t1 + .5; t += .01) if (e._z + dolly(t) > -900) return t; return 99 })
  lit.forEach(x => { if (x < s.t1) cue('blip', x, { v: .35 }) })
  cue('whoosh', s.t0 + .05, { d: 1.2, v: .6 })
  WIPES.push({ t: s.t1 })
  cue('wipe', s.t1)
  const keys = [['and', wAnd], ['builds', wb[0]], ['it', wb[1]], ['into', w2[0]], ['your', w2[1]], ['business', w2[2]]]
  const tAbl = wt(n, 'n.abl')

  return t => {
    camera(s, t, { inT: 'zoom', outT: 'none', inDur: .4 })
    const D = dolly(t)
    tiles.forEach((e, i) => {
      const z = e._z + D
      const o = P(z, -3300, -2300, E.lin) * (1 - P(z, 700, 1150, E.lin))
      put(e, { x: e._x, y: e._y, z, r: e._r, o, bright: lerp(.55, 1, P(z, -2600, -900, E.lin)) })
      e.classList.toggle('on', t >= lit[i])
    })
    put(tx, { y: 0, s: 1 + .03 * P(t, s.t0, s.t1) })
    keys.forEach(([k, w]) => rise(w, t, wt(n, k) - .06, { dur: .32, dy: 30 }))
    rise(wm, t, tAbl - .06, { dur: .32, dy: 30 })
  }
}

/* ============================================================
   04 · 05 · 06 · CUSTOMER AGENTS: bookings, questions, complaints
   ============================================================ */
function buildBook(s) {
  const n = 4
  const lab = label(s, '01', 'Customer agents', 'Books appointments', lineStart(n))
  const L = M({
    land: { chat: [-330, 70], cs: 1, cal: [430, 80], ks: 1 },
    port: { chat: [0, -120], cs: 1, cal: [0, 490], ks: 1 },
    sq:   { chat: [-262, 86], cs: .74, cal: [278, 96], ks: .72 },
    tall: { chat: [0, -110], cs: .86, cal: [0, 440], ks: .86 },
  })
  const { p: chat, msgs } = chatPanel(s.cam, 'Booking assistant', 'On your website, 24/7')
  const c1 = bubble(msgs, 'me', 'Hi! Can I book in for Friday afternoon?')
  const ty = h('div', 'typing', msgs, '<i></i><i></i><i></i>')
  const a1 = bubble(msgs, 'ai', 'Friday at <b>2pm</b> is free. Shall I book you in?')
  const c2 = bubble(msgs, 'me', 'Yes please!')
  const a2 = bubble(msgs, 'ai', `Done! You're booked in for <b>Friday, 2pm</b>. ${CHECK('#E9AC57', 18)}`)
  const cal = h('div', 'panel cal', s.cam)
  cal.style.width = M({ land: '600px', sq: '600px', tall: '900px', port: '940px' })
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], TIMES = ['10:00', '12:00', '14:00', '16:00']
  const BUSY = new Set(['0-0', '1-1', '2-2', '3-0', '4-0', '0-3', '2-1', '1-3', '3-2'])
  cal.innerHTML = `<div class="top"><div class="stile">${icon('cal').replace('<svg', '<svg width="24" height="24" style="color:#F2C57E"')}</div><div><div class="ptitle">Diary</div><div class="psub">This week</div></div><div class="pill" data-p>2 free slots</div></div><div class="grid7"><div></div>${DAYS.map(d => `<div class="dh">${d}</div>`).join('')}${TIMES.map((tm, r) => `<div class="tm">${tm}</div>${DAYS.map((d, c) => `<div class="slot${BUSY.has(c + '-' + r) ? ' busy' : ''}" data-s="${c}-${r}"></div>`).join('')}`).join('')}</div>`
  const target = cal.querySelector('[data-s="4-2"]')
  const ring2 = h('div', 'ring2', target), bk = h('div', 'bk', target, `${CHECK('#24170A', 16)}Booked`)
  const pill = cal.querySelector('[data-p]')
  const confetti = Array.from({ length: 16 }, () => h('div', 'bit', s.cam))
  const r = rng(9); confetti.forEach(e => { e._a = r() * Math.PI * 2; e._v = 180 + r() * 260; e._s = 6 + r() * 8; e.style.width = e.style.height = e._s + 'px' })
  const tC = wt(n, 'customer'), tBook = wt(n, 'book'), tAppt = wt(n, 'appointments')
  const T = { c1: tC - .1, ty: [tC + .25, tC + .62], a1: tC + .62, c2: tBook + .02, a2: tAppt + .05 }
  cue('send', T.c1); cue('recv', T.a1); cue('send', T.c2); cue('recv', T.a2); cue('hit', T.a2 + .12, { v: .55 }); cue('tick', T.a2 + .14, { v: .8 })
  cue('whip', s.t1 - .12)
  let geo

  return t => {
    camera(s, t, { inT: 'none', outT: 'whip', outDur: .22 })
    focus(s, t, [[s.t0, 0, LAND ? 20 : 0, M({ land: 1.14, sq: 1, def: 1.04 }), -5, 2], [s.t1, 0, LAND ? 20 : 0, M({ land: 1.2, sq: 1.04, def: 1.1 }), 4, 0]])
    lab(t)
    put(chat, { x: L.chat[0], y: L.chat[1] + (1 - P(t, s.t0, s.t0 + .4)) * 60, s: L.cs, o: P(t, s.t0, s.t0 + .2) })
    put(cal, { x: L.cal[0], y: L.cal[1] + (1 - P(t, s.t0 + .08, s.t0 + .5)) * 60, s: L.ks, o: P(t, s.t0 + .08, s.t0 + .28) })
    pop(c1, t, T.c1); typingDots(ty, t, T.ty[0], T.ty[1]); pop(a1, t, T.a1); pop(c2, t, T.c2); pop(a2, t, T.a2)
    vis(ring2, bell(t, T.a1, T.a1 + .1, T.a2 + .05) * (.6 + .4 * Math.sin(t * 20)))
    const bp = P(t, T.a2 + .08, T.a2 + .35, E.snap)
    vis(bk, P(t, T.a2 + .08, T.a2 + .14)); bk.style.transform = `scale(${lerp(.6, 1, bp).toFixed(3)})`
    const pl = t >= T.a2 + .1 ? '1 free slot' : '2 free slots'
    if (pill.textContent !== pl) pill.textContent = pl
    if (!geo) geo = offs(target, cal)
    const tc = [L.cal[0] + (geo.x + geo.w / 2 - cal.offsetWidth / 2) * L.ks, L.cal[1] + (geo.y + geo.h / 2 - cal.offsetHeight / 2) * L.ks]
    confetti.forEach(e => {
      const dt = Math.max(0, t - T.a2 - .1), d = e._v * (1 - Math.exp(-dt * 5))
      e.style.transform = `translate(-50%,-50%) translate(${(tc[0] + Math.cos(e._a) * d).toFixed(1)}px,${(tc[1] + Math.sin(e._a) * d + dt * dt * 300).toFixed(1)}px) rotate(${(dt * 400).toFixed(0)}deg)`
      vis(e, t >= T.a2 + .1 ? 1 - P(t, T.a2 + .5, T.a2 + .9) : 0)
    })
  }
}

function buildFaq(s) {
  const n = 5
  const lab = label(s, '02', 'Customer agents', 'Answers questions 24/7', lineStart(n))
  const L = M({
    land: { chat: [-330, 70], cs: 1, dial: [430, 10], ds: 1, clock: [430, 330] },
    port: { chat: [0, -150], cs: 1, dial: [-200, 480], ds: .74, clock: [230, 480] },
    sq:   { chat: [-262, 86], cs: .74, dial: [278, 30], ds: .66, clock: [278, 280] },
    tall: { chat: [0, -150], cs: .86, dial: [-190, 440], ds: .66, clock: [220, 440] },
  })
  const { p: chat, msgs } = chatPanel(s.cam, 'Help desk', 'Answers from your own information')
  const QA = [['Are you open on Sundays?', 'Yes, <b>10am to 4pm</b>.'], ['Do you deliver?', 'We do, free over <b>£50</b>.'], ['Where can I park?', 'Right outside, free after <b>6pm</b>.']]
  const bs = QA.flatMap(([q, a]) => [bubble(msgs, 'me', q), bubble(msgs, 'ai', a)])
  bs.forEach(b => { b.style.fontSize = M({ land: '21px', def: '22px' }); b.style.padding = '12px 18px' })
  msgs.style.gap = '10px'
  const dial = h('div', 'dial', s.cam, `<div class="sky"></div>${Array.from({ length: 14 }, () => '<div class="star"></div>').join('')}<div class="orb" data-sun></div><div class="orb" data-moon></div><div class="horizon"></div>`)
  const sky = dial.querySelector('.sky'), sun = dial.querySelector('[data-sun]'), moon = dial.querySelector('[data-moon]')
  const stars = [...dial.querySelectorAll('.star')]
  const r = rng(3); stars.forEach(e => { e.style.left = (30 + r() * 360) + 'px'; e.style.top = (30 + r() * 200) + 'px'; e._tw = r() * 6 })
  const clk = h('div', 'abs clock mc', s.cam, '<span data-c>14:00</span><small>ALWAYS ON</small>')
  const cEl = clk.querySelector('[data-c]')
  const tA = wt(n, 'answer'), tNight = wt(n, 'night')
  const bt = [tA - .08, tA + .2, tA + .48, tA + .72, tA + 1.0, tA + 1.24]
  bt.forEach((x, i) => cue(i % 2 ? 'recv' : 'send', x, { v: .7 }))
  cue('whip', s.t1 - .12)

  return t => {
    camera(s, t, { inT: 'whip', outT: 'whip', inDur: .22, outDur: .22 })
    focus(s, t, [[s.t0, 0, LAND ? 20 : 0, M({ land: 1.16, sq: 1, def: 1.06 }), 4, 0], [s.t1, 0, LAND ? 20 : 0, M({ land: 1.2, sq: 1.04, def: 1.1 }), -4, 2]])
    lab(t)
    put(chat, { x: L.chat[0], y: L.chat[1], s: L.cs })
    bs.forEach((b, i) => pop(b, t, bt[i], { dur: .24 }))
    // a day passes in two seconds
    const d = P(t, s.t0 + .1, tNight + .25, E.io)
    put(dial, { x: L.dial[0], y: L.dial[1], s: L.ds })
    const sa = Math.PI * (1 - Math.min(1, d * 1.6)), ma = Math.PI * (1 - P(d, .55, 1, E.lin))
    sun.style.transform = `translate(${(175 + Math.cos(sa) * 150).toFixed(1)}px,${(235 - Math.sin(sa) * 170).toFixed(1)}px)`
    sun.style.background = 'radial-gradient(circle, #F8D9A4, #E9AC57 60%, rgba(233,172,87,0) 72%)'
    moon.style.transform = `translate(${(175 + Math.cos(ma) * 150).toFixed(1)}px,${(235 - Math.sin(ma) * 170).toFixed(1)}px)`
    moon.style.background = 'radial-gradient(circle at 40% 40%, #FBF6EC, #DED2C0 55%, rgba(222,210,192,0) 70%)'
    vis(moon, P(d, .5, .7))
    sky.style.background = `radial-gradient(circle at 50% 70%, rgba(233,172,87,${(.45 * (1 - P(d, .3, .7))).toFixed(3)}), rgba(233,172,87,0) 70%)`
    stars.forEach(e => vis(e, P(d, .55, .85) * (.5 + .5 * Math.sin(t * 7 + e._tw))))
    const hrs = 14 + 12 * d, hh = Math.floor(hrs) % 24, mm = Math.floor((hrs % 1) * 60)
    cEl.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    put(clk, { x: L.clock[0], y: L.clock[1] })
  }
}

function buildCare(s) {
  const n = 6
  const lab = label(s, '03', 'Customer agents', 'Handles complaints and queries', lineStart(n))
  const L = M({
    land: { tk: [-300, 76], ts: 1, g: [480, 40], gs: 1 },
    port: { tk: [0, -110], ts: 1, g: [0, 520], gs: .9 },
    sq:   { tk: [-230, 90], ts: .74, g: [318, 60], gs: .7 },
    tall: { tk: [0, -110], ts: .86, g: [0, 470], gs: .8 },
  })
  const tk = h('div', 'panel ticket', s.cam)
  tk.style.width = M({ land: '760px', sq: '760px', tall: '900px', port: '940px' })
  tk.innerHTML = `<div class="top"><div class="stile">${spark(22)}</div><div><div class="ptitle">Query #2381</div><div class="psub">Email · 11:42</div></div><div class="pill" data-p></div></div>
    <div class="body"><div class="from">Jo Parker <span>jo@…</span></div><div class="text">My order arrived damaged and I need it by Saturday. Really not happy.</div>
    <div class="tags"><span class="tag bad">Complaint</span><span class="tag bad">Urgent</span><span class="tag">Order #4471</span><span class="tag amber">Replacement</span></div>
    <div class="draft"><div class="lbl">${spark(14)} REPLY</div><div class="rt"></div></div></div>`
  const pill = tk.querySelector('[data-p]')
  const tags = [...tk.querySelectorAll('.tag')]
  const rt = tk.querySelector('.rt')
  const rw = words(rt, "So sorry, Jo. A replacement ships today and arrives Friday, and we've refunded the delivery.")
  const gauge = h('div', 'gauge', s.cam, `<div class="gt">Escalation risk</div><svg width="300" height="170" viewBox="-150 -150 300 170">
    <path d="M-120 0 A120 120 0 0 1 120 0" fill="none" stroke="rgba(240,231,216,.10)" stroke-width="22" stroke-linecap="round"/>
    <path data-arc d="M-120 0 A120 120 0 0 1 120 0" fill="none" stroke="#E0796D" stroke-width="22" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1"/>
    <line data-needle x1="0" y1="0" x2="0" y2="-100" stroke="#FBF6EC" stroke-width="5" stroke-linecap="round"/><circle r="10" fill="#FBF6EC"/></svg><div class="gv" data-v>High</div>`)
  const garc = gauge.querySelector('[data-arc]'), needle = gauge.querySelector('[data-needle]'), gv = gauge.querySelector('[data-v]')
  const tHd = wt(n, 'handle'), tComp = wt(n, 'complaints'), tEsc = wt(n, 'escalate')
  const rT = rw.map((_, i) => lerp(tComp - .05, tEsc - .05, i / (rw.length - 1)))
  const tagT = tags.map((_, i) => tHd - .05 + i * .1)
  const tRes = tEsc + .15
  tagT.forEach(x => cue('pop', x, { v: .55 }))
  rw.forEach((_, i) => { if (i % 3 === 0) cue('type', rT[i], { d: .12, v: .3 }) })
  cue('hit', tRes, { v: .55 }); cue('tick', tRes + .02, { v: .9 })
  cue('whoosh', s.t1 - .2, { d: .4, v: .7 })

  return t => {
    camera(s, t, { inT: 'whip', outT: 'shrink', inDur: .22, outDur: .28 })
    focus(s, t, [[s.t0, 0, LAND ? 20 : 0, M({ land: 1.14, sq: 1, def: 1.06 }), -4, 0], [s.t1, 0, LAND ? 20 : 0, M({ land: 1.18, sq: 1.04, def: 1.1 }), 3, 2]])
    lab(t)
    put(tk, { x: L.tk[0], y: L.tk[1], s: L.ts })
    tags.forEach((e, i) => pop(e, t, tagT[i], { dur: .24 }))
    rw.forEach((w, i) => rise(w, t, rT[i], { dur: .2, dy: 8, blur: 6 }))
    const st = t < tHd ? 'new' : t < tRes ? 'work' : 'done'
    if (pill.dataset.s !== st) {
      pill.dataset.s = st
      pill.innerHTML = { new: 'New', work: '<span class="gd" style="background:#E9AC57;box-shadow:0 0 10px rgba(233,172,87,.9)"></span>Replying', done: CHECK('#B9D4B3', 15) + 'Resolved' }[st]
      pill.className = 'pill' + (st === 'done' ? ' ok' : st === 'work' ? ' amber' : ' bad')
    }
    put(gauge, { x: L.g[0], y: L.g[1] + (1 - P(t, s.t0 + .05, s.t0 + .4)) * 50, s: L.gs, o: P(t, s.t0 + .05, s.t0 + .25) })
    const v = lerp(.9, .12, P(t, tComp, tRes, E.io)) + .02 * Math.sin(t * 30) * (1 - P(t, tComp, tRes))
    garc.style.strokeDashoffset = (1 - v).toFixed(4)
    garc.setAttribute('stroke', v > .5 ? '#E0796D' : v > .3 ? '#E9AC57' : '#9DBE97')
    needle.setAttribute('transform', `rotate(${(-90 + 180 * v).toFixed(2)})`)
    const lv = v > .6 ? 'High' : v > .3 ? 'Falling' : 'Low'
    if (gv.textContent !== lv) { gv.textContent = lv; gv.style.color = v > .6 ? '#F0A69C' : v > .3 ? '#F2C57E' : '#B9D4B3' }
  }
}

/* ============================================================
   07 · THE WALL: every other job AI can take on
   ============================================================ */
function buildWall(s) {
  const n = 7
  const USES = [
    ['Appointment booking', 'cal'], ['Live chat and FAQs', 'chat'], ['Complaints and queries', 'alert'], ['Quotes and proposals', 'quote'], ['Call summaries', 'phone'], ['Order tracking', 'box'],
    ['Invoice processing', 'invoice'], ['Document reading', 'doc'], ['Review replies', 'star'], ['Reply drafting', 'pen'], ['CRM updates', 'db'], ['Weekly reports', 'chart'],
    ['Staff knowledge base', 'book'], ['Onboarding', 'wave'], ['Inbox sorting', 'inbox'], ['Data entry', 'keys'], ['Lead follow-up', 'lead'], ['Stock alerts', 'stack'],
    ['Reminders', 'bell'], ['Lead qualification', 'filter'], ['Meeting notes', 'notes'], ['Social replies', 'share'], ['Job scheduling', 'clock'], ['Customer surveys', 'survey'],
  ]
  // the four named jobs go in central slots for each grid, in the order they are said
  const NAMED = ['Document reading', 'Inbox sorting', 'Reply drafting', 'Lead follow-up']
  const SLOTS = M({ land: [7, 14, 9, 16], sq: [7, 14, 9, 16], tall: [5, 10, 6, 9], port: [7, 13, 10, 16] })
  const rest = USES.filter(u => !NAMED.includes(u[0]))
  const ORDER = USES.map((_, i) => SLOTS.includes(i) ? USES.find(u => u[0] === NAMED[SLOTS.indexOf(i)]) : rest.shift())
  const WALL = M({ land: { cols: 6, base: 1.28, px: 230, py: 0 }, sq: { cols: 6, base: 1.34, px: 520, py: 0 }, tall: { cols: 4, base: 1.12, px: 150, py: 0 }, port: { cols: 3, base: 1.2, px: 0, py: 60 } })
  const WIDE = WALL.cols > 3
  const COLS = WALL.cols, ROWS = USES.length / COLS
  const TW = 300, TH = 190, GAP = 26
  const plane = h('div', 'plane', s.cam)
  const tiles = ORDER.map(([nm, ic], i) => {
    const e = h('div', 'tile', plane, `<div class="ic">${icon(ic)}</div><div><div class="nm">${nm}</div><div class="st"><i></i><span>Ready</span></div></div>`)
    const c = i % COLS, r = Math.floor(i / COLS)
    e._x = (c - (COLS - 1) / 2) * (TW + GAP); e._y = (r - (ROWS - 1) / 2) * (TH + GAP); e._c = c; e._r = r
    e._st = e.querySelector('.st span')
    return e
  })
  const HERO = { 'Document reading': ['reads', 'Reads your paperwork'], 'Inbox sorting': ['sorts', 'Sorts your inbox'], 'Reply drafting': ['drafts', 'Drafts your replies'], 'Lead follow-up': ['chases', 'Chases every lead'] }
  const heroes = tiles.map((e, i) => HERO[ORDER[i][0]] ? { e, text: HERO[ORDER[i][0]][1], t: wt(n, HERO[ORDER[i][0]][0]) } : null).filter(Boolean).sort((a, b) => a.t - b.t)
  // the caption that says what the voice is saying
  const capPos = M({ land: [0, 392], port: [0, 640], sq: [0, 392], tall: [0, 520] })
  const box = h('div', 'abs capbox', s.hud)
  const eb = h('div', 'eyebrow', box, `${spark(18)}<span>Plus AI that</span>`)
  const lines = h('div', '', box); lines.style.position = 'relative'
  const caps = heroes.map(x => { const e = h('div', 'display cap', lines); e.textContent = x.text; return e })
  caps.forEach((e, i) => { if (i) { e.style.position = 'absolute'; e.style.left = LAND ? '0' : '50%'; e.style.top = '0' } })
  if (!LAND) { box.style.textAlign = 'center'; eb.style.justifyContent = 'center' }
  const start = tiles[ORDER.findIndex(u => u[0] === 'Complaints and queries')]
  const panX = [-WALL.px, WALL.px], panY = [-WALL.py, WALL.py]
  const base = WALL.base
  const clampX = x => Math.max(-WALL.px, Math.min(WALL.px, x)), clampY = y => Math.max(-Math.max(WALL.py, 40), Math.min(Math.max(WALL.py, 40), y))
  const tPlus = wt(n, 'plus')
  const litT = tiles.map(e => s.t0 + .45 + (WIDE ? e._c * .16 + e._r * .06 : e._r * .14 + e._c * .06))
  litT.forEach((x, i) => { if (i % 3 === 0) cue('flip', x, { v: .35 }) })
  heroes.forEach(x => { cue('pop', x.t - .02, { v: .8 }); cue('swish', x.t - .05, { v: .5 }) })
  cue('whoosh', s.t0 + .02, { d: .8, v: .7 })
  cue('whoosh', s.t1 - .3, { d: .45, v: .9 })

  return t => {
    camera(s, t, { inT: 'none', outT: 'through', outDur: .3, push: 0 })
    // pull back from one tile to the whole wall, then sweep across it
    const pull = P(t, s.t0, s.t0 + .75, E.io)
    const sweep = P(t, s.t0 + .6, s.t1, E.io)
    const K = [[s.t0 + .75, panX[0], panY[0]], ...heroes.map(x => [x.t - .22, clampX(x.e._x), clampY(x.e._y)]), [s.t1, panX[1], panY[1]]]
    let k = 0; while (k < K.length - 2 && t >= K[k + 1][0]) k++
    const kp = P(t, K[k][0], K[k + 1][0], E.io)
    const tx = lerp(K[k][1], K[k + 1][1], kp), tyy = lerp(K[k][2], K[k + 1][2], kp)
    const fx0 = lerp(start._x, tx, pull), fy0 = lerp(start._y, tyy, pull)
    const sc = lerp(2.6, base, pull) * (1 + .06 * sweep)
    s.cam.style.transform = `scale(${sc.toFixed(4)}) translate(${(-fx0).toFixed(1)}px,${(-fy0).toFixed(1)}px)`
    plane.style.transform = `translate(-50%,-50%) rotateX(${lerp(0, 16, pull).toFixed(2)}deg) rotateZ(${lerp(0, -5, pull).toFixed(2)}deg)`
    tiles.forEach((e, i) => {
      const hero = heroes.find(x => x.e === e)
      const hp = hero ? bell(t, hero.t - .05, hero.t + .12, hero.t + .9, E.snap) : 0
      put(e, { x: e._x, y: e._y, z: hp * 80, s: 1 + .12 * hp, bright: hero && t >= hero.t - .05 ? 1.15 : 1 })
      const on = t >= litT[i]
      e.classList.toggle('on', on)
      const lbl = on ? 'Running' : 'Ready'
      if (e._st.textContent !== lbl) e._st.textContent = lbl
    })
    put(box, { x: capPos[0], y: capPos[1] + (1 - P(t, tPlus - .1, tPlus + .25)) * 40, o: P(t, tPlus - .1, tPlus + .15) })
    caps.forEach((e, i) => {
      const a = heroes[i].t - .06, b = i < heroes.length - 1 ? heroes[i + 1].t - .08 : null
      const pi = P(t, a, a + .26, E.out), po = b == null ? 0 : P(t, b, b + .18, E.in2)
      const tx = LAND ? '' : 'translateX(-50%) '
      e.style.transform = `${i ? tx : ''}translateY(${((1 - pi) * 50 - po * 50).toFixed(1)}px)`
      vis(e, pi * (1 - po))
      const bl = (1 - pi) * 14 + po * 14
      e.style.filter = bl > .05 ? `blur(${bl.toFixed(1)}px)` : 'none'
    })
  }
}

/* ============================================================
   08 · WHAT YOU GET: less admin, faster answers, happier customers
   ============================================================ */
function buildGains(s) {
  const n = 8
  const ty = M({ land: 150, port: 200, sq: 190, tall: 210 }), my = M({ land: -170, port: -300, sq: -190, tall: -250 })
  const T = [['less', 'Less admin.'], ['faster', 'Faster answers.'], ['happier', 'Happier customers.']]
  const at = T.map(([k]) => wt(n, k))
  const slams = T.map(([, txt]) => { const e = h('div', 'abs display slam', s.cam); e.textContent = txt; e._y = ty; return e })
  // less: a stack of paper that empties
  const papers = Array.from({ length: 7 }, () => h('div', 'paper', s.cam, '<i style="width:60%"></i><i></i><i></i><i style="width:80%"></i><i></i><i style="width:50%"></i>'))
  // faster: speed lines and a stopwatch
  const lines = Array.from({ length: 26 }, () => h('div', 'speedline', s.cam))
  const r = rng(13); lines.forEach(e => { e._y = (r() - .5) * H * .8; e._l = 200 + r() * 500; e._v = 2600 + r() * 2200; e._p = r() })
  const watch = h('div', 'abs', s.cam, `<svg width="300" height="300" viewBox="-150 -150 300 300" style="overflow:visible"><circle r="120" fill="none" stroke="rgba(240,231,216,.18)" stroke-width="10"/><circle data-arc r="120" fill="none" stroke="#E9AC57" stroke-width="10" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" transform="rotate(-90)"/><line data-hand x1="0" y1="0" x2="0" y2="-95" stroke="#FBF6EC" stroke-width="7" stroke-linecap="round"/><circle r="11" fill="#FBF6EC"/><rect x="-22" y="-162" width="44" height="22" rx="6" fill="#FBF6EC"/></svg>`)
  const warc = watch.querySelector('[data-arc]'), hand = watch.querySelector('[data-hand]')
  // happier: five stars
  const stars = Array.from({ length: 5 }, () => h('div', 'starx', s.cam, STAR('#E9AC57')))
  const SZ = M({ land: 110, def: 96 })
  stars.forEach(e => { e.style.width = e.style.height = SZ + 'px'; e.style.filter = 'drop-shadow(0 0 18px rgba(233,172,87,.6))' })
  at.forEach(x => cue('hit', x, { v: .8 }))
  cue('whoosh', at[1] - .05, { d: .7, v: .5 })
  stars.forEach((_, i) => cue('star', at[2] + .05 + i * .09, { v: .6 + i * .08 }))
  WIPES.push({ t: s.t1 })
  cue('wipe', s.t1)

  return t => {
    camera(s, t, { inT: 'zoom', outT: 'none', inDur: .3 })
    slams.forEach((e, i) => slot(e, t, at[i] - .06, i < 2 ? at[i + 1] - .1 : null, { dy: 140 }))
    // paper
    const pIn = P(t, s.t0, s.t0 + .3), pOut = P(t, at[1] - .12, at[1] + .1, E.in2)
    papers.forEach((e, i) => {
      const gone = P(t, at[0] + .1 + i * .07, at[0] + .35 + i * .07, E.in2) * (i < 6 ? 1 : 0)
      put(e, { x: (i - 3) * 16 + gone * (i % 2 ? 700 : -700), y: my - i * 8 - gone * 200, r: (i - 3) * 3 + gone * (i % 2 ? 50 : -50), o: pIn * (1 - gone) * (1 - pOut), s: M({ land: 1, def: .9 }) })
    })
    // speed
    const sp = bell(t, at[1] - .12, at[1] + .05, at[2] - .05)
    lines.forEach(e => {
      const x = ((e._p * 3000 - (t - at[1]) * e._v) % 3000 + 3000) % 3000 - 1500
      e.style.width = e._l + 'px'
      e.style.transform = `translate(${(W / 2 + x).toFixed(1)}px,${(H / 2 + e._y).toFixed(1)}px)`
      vis(e, sp * .7)
    })
    const wp = bell(t, at[1] - .1, at[1] + .12, at[2] - .08)
    put(watch, { y: my, o: wp, s: lerp(.8, 1, wp) * M({ land: 1, def: .9 }) })
    const spin = P(t, at[1], at[2] - .1, E.out)
    warc.style.strokeDashoffset = (1 - spin).toFixed(4)
    hand.setAttribute('transform', `rotate(${(spin * 360).toFixed(1)})`)
    // stars
    stars.forEach((e, i) => {
      const t0 = at[2] + .05 + i * .09, p = P(t, t0, t0 + .3, E.snap)
      put(e, { x: (i - 2) * SZ * 1.15, y: my, s: p, r: (1 - Math.min(1, p)) * -60, o: P(t, t0, t0 + .06) })
    })
  }
}

/* ============================================================
   09 · YOURS: built for the business, then gathered into the dot
   ============================================================ */
function buildYours(s) {
  const n = 9
  const L = M({ land: { b: [430, 0], txt: [-470, 0], al: 'left' }, port: { b: [0, -330], txt: [0, 280], al: 'center' }, sq: { b: [0, -210], txt: [0, 250], al: 'center' }, tall: { b: [0, -270], txt: [0, 300], al: 'center' } })
  const C = 7, Rw = 5, SZ = M({ land: 46, def: 40 }), G = 8
  const r = rng(17)
  const blocks = Array.from({ length: C * Rw }, (_, i) => {
    const e = h('div', 'blk', s.cam)
    const c = i % C, rr = Math.floor(i / C)
    e._x = L.b[0] + (c - (C - 1) / 2) * (SZ + G); e._y = L.b[1] + (rr - (Rw - 1) / 2) * (SZ + G)
    const a = r() * Math.PI * 2; e._fx = e._x + Math.cos(a) * 1400; e._fy = e._y + Math.sin(a) * 1000; e._fr = (r() - .5) * 360
    e._am = (c + rr) % 5 === 0
    e.style.width = e.style.height = SZ + 'px'
    e._d = r()
    return e
  })
  const tx = h('div', 'abs', s.cam); tx.style.textAlign = L.al; tx.style.width = 'max-content'
  const a = h('div', 'display', tx), b = h('div', 'display', tx)
  a.style.fontSize = b.style.fontSize = M({ land: '96px', port: '88px', def: '80px' })
  const wa = words(a, 'Built for your business.'), wb = words(b, 'Yours to keep.')
  const mono = h('div', 'mono', tx); mono.style.marginTop = '26px'; mono.textContent = 'No retainers · you own everything we build'
  const tB = wt(n, 'built'), tY = wt(n, 'yours')
  const tGather = s.t1 - .5
  blocks.forEach((e, i) => { if (i % 5 === 0) cue('blip', tB - .15 + e._d * .75 + .35, { v: .25 }) })
  cue('implode', s.t1, { d: .5 })
  cue('whoosh', tB - .15, { d: .6, v: .5 })

  return t => {
    camera(s, t, { inT: 'none', outT: 'none', push: .03 })
    blocks.forEach((e, i) => {
      const t0 = tB - .15 + e._d * .75
      const p = P(t, t0, t0 + .4, E.out)
      const g = P(t, tGather + e._d * .12, s.t1, E.in3)
      const x = lerp(lerp(e._fx, e._x, p), 0, g), y = lerp(lerp(e._fy, e._y, p), 0, g)
      put(e, { x, y, r: lerp(e._fr, 0, p), o: P(t, t0, t0 + .1) * (i === 0 ? 1 : 1 - P(g, .85, 1, E.lin)), s: lerp(1, i === 0 ? 1 : .6, g) })
      const sweep = t > tY && Math.abs((t - tY) * 2.4 - .2 - ((e._x - L.b[0]) / 380 + .5)) < .14
      e.style.background = (i === 0 && g > .5) || e._am || sweep ? '#E9AC57' : 'rgba(240,231,216,.88)'
    })
    const out = P(t, tGather - .1, tGather + .2, E.in2)
    put(tx, { x: L.txt[0] + (LAND ? tx.offsetWidth / 2 - 430 : 0), y: L.txt[1], o: 1 - out, blur: out * 12 })
    wa.forEach((w, i) => rise(w, t, tB + i * .09 - .05, { dur: .32, dy: 30 }))
    wb.forEach((w, i) => rise(w, t, tY + i * .09 - .05, { dur: .32, dy: 30 }))
    rise(mono, t, tY + .3, { dur: .35, dy: 14, blur: 8 })
  }
}


/* ---------- the film: its scenes, in order, and its ground ---------- */
export default function setup() {
  scene(['boot', 'ai'], buildBoot)
  scene(['into'], buildInto)
  scene(['book'], buildBook)
  scene(['faq'], buildFaq)
  scene(['care'], buildCare)
  scene(['wall'], buildWall)
  scene(['gains'], buildGains)
  scene(['yours'], buildYours)
  scene(['end'], s => endCard(s, { line: 10, tag: 'Put AI to work', first: 'put', last: 'work' }))
  const sc = sceneById
  const tAI = wt(2, 'ai'), dotT = wt(10, 'n.abl')
  // [time, ax, ay, aStrength, cx, cy, cStrength, grid]
  const ground = [
    [0, .3, .5, .35, .75, .6, .35, 0],
    [tAI - .02, .4, .5, .45, .6, .5, .4, 0],
    [tAI + .08, .5, .5, 1.3, .5, .5, .7, 0],
    [sc('into').start, .5, .5, .8, .5, .5, .5, 0],
    [sc('book').start, .2, .25, .7, .85, .8, .5, .6],
    [sc('faq').start, .8, .3, .6, .2, .8, .45, .6],
    [sc('care').start, .25, .7, .7, .8, .25, .5, .6],
    [sc('wall').start, .5, .3, .8, .5, .85, .5, .2],
    [sc('gains').start, .5, .4, .8, .5, .7, .5, 0],
    [sc('yours').start, .7, .5, .7, .2, .5, .5, .3],
    [sc('end').start, .5, .45, .55, .5, .7, .4, 0],
    [dotT, .5, .45, .8, .5, .7, .45, 0],
    [dotT + .12, .5, .45, 1.1, .5, .7, .55, 0],
    [TL.duration, .5, .45, .85, .5, .7, .45, 0],
  ]

  return { ground, bug: ['into', 'end'] }
}
