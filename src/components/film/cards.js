/* ============================================================
   CARD SCENES: what each solution looks like, in the film's grammar

   The solution cards wipe across to "what we would build" on hover, as
   the problem cards always did. What they wipe to is now drawn the way
   the launch reel is: cream interface pieces on a dark stage under a
   soft light, blur-in, glowing rims, colour only where something
   happens. Each is a short loop on a small stage of its own, built with
   the same helpers as the film.

   A scene here is { dur, mount(host) }: mount builds it into the card
   and returns { render(t), destroy() }. CardWipe drives render through
   the page's one shared animation loop, and destroys it when the card
   closes, so a closed card holds nothing.

   Every name and figure is a prop, as in the film.
   ============================================================ */

import { CHECK, E, P, bell, blurIn, count, createStage, dotsPulse, drawRim, h, icon, lerp, pop, put, ringPill, rise, rng, spark, vis, words } from './stage.js'

const WHITE = '247,242,234', ICE = '124,203,255', AMB = '233,172,87', CORAL = '240,122,106'

/* A card scene, looped inside a card.

   W x H is the area the scene is composed in, and it always fits. The
   stage itself is then widened or heightened to the card's own shape, so
   it fills the card edge to edge: the scene's light and specks reach every
   side, and there are no bars where a fixed-shape stage met a card of a
   different shape. It is drawn with zoom rather than a transform, for the
   same reason as the film (see FilmSection.jsx): drawn at the size shown,
   not drawn large and shrunk. If the card changes shape while open, the
   stage is rebuilt to match and carries on from the same moment.

   A scene with more than one composition passes `design`, which is given
   the card's aspect and returns the area to fit ({ W, H }) and anything
   the builder needs to choose its layout (`compact`). */
let LITE = false
function cardScene(dur, build, { W = 800, H = 600, design = null } = {}) {
  return {
    dur,
    mount(host) {
      LITE = window.matchMedia('(pointer: coarse)').matches
      const box = h('div', 'f-card', host)
      let ctx = null, shape = '', last = 0
      const make = () => {
        const hw = host.clientWidth, hh = host.clientHeight
        if (!hw || !hh) return
        const d = design ? design(hw / hh) : { W, H }
        const k = Math.min(hw / d.W, hh / d.H)
        const w = Math.ceil(hw / k), hgt = Math.ceil(hh / k)
        box.style.zoom = String(k)
        if (`${w}x${hgt}` === shape) return
        shape = `${w}x${hgt}`
        if (ctx) ctx.destroy()
        ctx = createStage(box, { W: w, H: hgt, beat: dur, list: [{ id: 's', beats: 1 }] })
        ctx.setGround([[0, .5, .75, .45, .5, -.1, .85], [dur, .5, .75, .45, .5, -.1, .85]])
        ctx.scene(['s'], s => build(s, { ...d, W: w, H: hgt, dur }))
        ctx.prime()
        ctx.seek(last)
      }
      make()
      const ro = new ResizeObserver(make)
      ro.observe(host)
      return {
        render: t => { last = ((t % dur) + dur) % dur; if (ctx) ctx.seek(last) },
        destroy: () => { ro.disconnect(); if (ctx) ctx.destroy(); box.remove() },
      }
    },
  }
}

/* the camera: a slow drift through a few keys [t, x, y, z, rx, ry] */
function drift(s, keys) {
  return t => {
    let i = 0; while (i < keys.length - 2 && t >= keys[i + 1][0]) i++
    const a = keys[i], b = keys[i + 1], p = P(t, a[0], b[0], E.io)
    const v = k => lerp(a[k], b[k], p)
    s.cam.style.transform = `translateZ(${v(3).toFixed(1)}px) rotateX(${v(4).toFixed(2)}deg) rotateY(${v(5).toFixed(2)}deg) translate3d(${(-v(1)).toFixed(1)}px,${(-v(2)).toFixed(1)}px,0)`
  }
}
/* in from soft at the top of the loop, out to soft at the end, so it restarts cleanly */
function loopLens(s, t, dur) {
  const i = P(t, 0, .35, E.out), o = P(t, dur - .45, dur, E.in2)
  s.rig.style.opacity = (i * (1 - o)).toFixed(3)
  if (LITE) { s.rig.style.filter = 'none'; return }
  const b = (1 - i) * 14 + o * 14
  s.rig.style.filter = b > .05 ? `blur(${b.toFixed(1)}px)` : 'none'
}
function specks(s, seed, n = 12, w = 1100, hgt = 800) {
  const r = rng(seed), dots = []
  for (let i = 0; i < n; i++) {
    const e = h('div', 'r-bok', s.cam)
    const size = 6 + r() * r() * 40, col = [WHITE, AMB, ICE, WHITE][Math.floor(r() * 4)]
    Object.assign(e.style, { width: size + 'px', height: size + 'px', background: `radial-gradient(circle, rgba(${col},.8), rgba(${col},0) 68%)` })
    dots.push({ e, x: (r() - .5) * w, y: (r() - .5) * hgt, z: -900 + r() * 1000, o: .06 + r() * .25, ph: r() * 6 })
  }
  return t => dots.forEach(d => put(d.e, { x: d.x + Math.sin(t * .6 + d.ph) * 22, y: d.y + Math.cos(t * .45 + d.ph) * 16, z: d.z, o: d.o }))
}
/* A pill as wide as its words. Estimated widths ran short on some fonts
   and "Replies in your tone" spilled out of its rim; the text is measured
   in the face and size the pill draws it in. */
let measurer = null
function textWidth(text, font) {
  measurer = measurer || document.createElement('canvas').getContext('2d')
  measurer.font = font
  return measurer.measureText(text).width
}
function typeIn(e, text, t, a, b) {
  const n = Math.round(text.length * P(t, a, b, E.lin))
  e.textContent = text.slice(0, n)
}

/* ---------- 01 voice: the phone rings, n.abl answers, moves the appointment ---------- */
export const voice = cardScene(7, (s, { dur }) => {
  const sp = specks(s, 21)
  const card = h('div', 'r-panel c-panel', s.cam, `
    <div class="r-ph"><span class="av ph">${icon('phone')}<i></i><i></i></span><div><div class="t">Incoming call</div><div class="s">+44 7700 900412 · mobile</div></div><span class="on st">● RINGING</span></div>
    <div class="c-wave"></div>
    <div class="r-thread">
      <div class="r-tx"><span class="mic">CALLER</span><span class="q"></span></div>
      <div class="r-m ai"><span class="r-dots"><i></i><i></i><i></i></span><span class="txt"></span></div>
      <div class="c-done"><span class="r-chip">${CHECK('#1A1612', 22)}<span>Moved · Thu 10:00</span></span></div>
    </div>`)
  const av = card.querySelector('.av'), rings = [...av.querySelectorAll('i')], st = card.querySelector('.st')
  const wave = card.querySelector('.c-wave'), wr = rng(4)
  const bars = Array.from({ length: 44 }, () => { const e = h('i', '', wave); e._h = 10 + 40 * wr(); return e })
  const [mQ, mA, done] = card.querySelector('.r-thread').children
  const qW = words(mQ.querySelector('.q'), '“Can I move my appointment to Thursday?”')
  const dots = mA.querySelector('.r-dots'), aW = words(mA.querySelector('.txt'), 'Thursday at 10 is free. I’ve moved you over.')
  const tAns = 1, tQ = 1.4, tDots = 3, tA = 3.4, tDone = 5
  const cam = drift(s, [[0, 24, -24, -30, 10, -8], [tA, 0, 6, 10, 4, -2], [dur, 0, 20, 24, 2, 3]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    put(card, { o: 1 })
    const on = t >= tAns
    rings.forEach((e, i) => {
      const ph = ((((t) / .9 + i * .5) % 1) + 1) % 1
      e.style.transform = `scale(${(1 + ph * 1.1).toFixed(3)})`
      e.style.opacity = (on ? 0 : (1 - ph) * .7).toFixed(3)
    })
    st.textContent = on ? '● n.abl ANSWERED' : '● RINGING'
    st.classList.toggle('ans', on)
    // the line: ice while the caller talks, amber while n.abl does
    const caller = t > tQ && t < tQ + 1.4, agent = t > tA && t < tA + 1.3
    bars.forEach((e, i) => {
      const live = caller || agent
      const k = live ? .35 + .65 * Math.abs(Math.sin(t * 9 + i * .7) * Math.sin(t * 3.1 + i * .23)) : .12
      e.style.height = (e._h * k + 4).toFixed(1) + 'px'
      e.style.background = caller ? `rgba(${ICE},.9)` : agent ? `rgba(${AMB},.9)` : `rgba(${WHITE},.2)`
    })
    vis(mQ, P(t, tQ - .05, tQ + .1))
    qW.forEach((e, i) => rise(e, t, tQ + i * .07, { dur: .25, dy: 10, blur: 10 }))
    pop(mA, t, tDots)
    dots.style.display = t < tA ? 'inline-flex' : 'none'
    dotsPulse(dots, t)
    mA.querySelector('.txt').style.display = t < tA ? 'none' : 'inline'
    aW.forEach((e, i) => rise(e, t, tA + i * .045, { dur: .24, dy: 8, blur: 8 }))
    pop(done, t, tDone)
    const g = bell(t, tDone, tDone + .1, tDone + 1.2)
    done.firstChild.style.boxShadow = `0 0 ${(20 + 50 * g).toFixed(0)}px rgba(${WHITE},${(.2 + .5 * g).toFixed(2)})`
  }
})

/* ---------- 02 chat: questions answered, a table booked, on every channel ---------- */
export const chat = cardScene(7.5, (s, { dur }) => {
  const sp = specks(s, 22)
  const card = h('div', 'r-panel c-panel', s.cam, `
    <div class="r-ph"><span class="av">${spark(26)}</span><div><div class="t">Your business</div><div class="s">Web chat · WhatsApp · Instagram</div></div><span class="on">● ONLINE</span></div>
    <div class="c-clip"><div class="r-thread">
      <div class="r-m in">Do you do gluten-free?</div>
      <div class="r-m ai a1"><span class="r-dots"><i></i><i></i><i></i></span><span class="txt"></span></div>
      <div class="r-m in">Great. Table for 4, Saturday at 7?</div>
      <div class="r-m ai card"><span class="ok">✓ Booked</span><span class="r-chip">${icon('cal')}<span>Sat 7:00 pm · 4</span></span></div>
    </div></div>`)
  const thread = card.querySelector('.r-thread')
  const [m1, m2, m3, m4] = thread.children
  const dots = m2.querySelector('.r-dots'), aW = words(m2.querySelector('.txt'), 'We do. Most of our mains can be made gluten-free.')
  const T = [.4, 1.2, 3.1, 4.4], tA = 1.7
  const cam = drift(s, [[0, -30, -30, -40, 10, 10], [dur, 10, 20, 40, 2, -4]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    put(card, { o: 1 })
    pop(m1, t, T[0]); pop(m2, t, T[1]); pop(m3, t, T[2]); pop(m4, t, T[3])
    dots.style.display = t < tA ? 'inline-flex' : 'none'
    dotsPulse(dots, t)
    m2.querySelector('.txt').style.display = t < tA ? 'none' : 'inline'
    aW.forEach((e, i) => rise(e, t, tA + i * .04, { dur: .24, dy: 8, blur: 8 }))
    // the thread scrolls as it fills
    thread.style.transform = `translateY(${(-90 * P(t, T[2] - .1, T[3] + .2, E.io)).toFixed(1)}px)`
    const g = bell(t, T[3] + .1, T[3] + .2, T[3] + 1.4)
    m4.querySelector('.r-chip').style.boxShadow = `0 0 ${(20 + 50 * g).toFixed(0)}px rgba(${WHITE},${(.2 + .5 * g).toFixed(2)})`
  }
})

/* ---------- 03 documents: an invoice read by a line of light, filed ---------- */
export const documents = cardScene(7, (s, { dur }) => {
  const sp = specks(s, 23)
  const paper = h('div', 'r-paper c-paper', s.cam, `
    <div class="top"><span class="lg"></span><div><div class="sup f">Harbour Foods Ltd</div><div class="ad">Unit 4, Quay Road</div></div></div>
    <div class="lines"><div><i style="width:58%"></i><em>£412.00</em></div><div><i style="width:46%"></i><em>£608.50</em></div><div><i style="width:52%"></i><em>£264.10</em></div></div>
    <div class="tot"><span>Total due</span><b class="f">£1,284.60</b></div>
    <div class="due"><span>Due by</span><b class="f">17 Oct</b></div>`)
  const fields = [...paper.querySelectorAll('.f')]
  const beam = h('div', 'r-beam', s.cam)
  const chips = ['Harbour Foods Ltd', '£1,284.60', 'Due 17 Oct'].map(txt => h('div', 'r-fly c-got', s.cam, txt))
  const post = h('div', 'c-post', s.cam, `${icon('sheet')}<span>Posted to your accounts</span>`)
  const PX = -170, CX = 230, tS = [.7, 3.2], tPost = 4.9
  let lay = null
  const cam = drift(s, [[0, -80, 0, -30, 6, -14], [3.4, 20, 0, 0, 3, -4], [dur, 90, 0, 30, 2, 4]])
  return t => {
    if (!lay) {
      const ph = paper.offsetHeight, top = -ph / 2 + 30, bot = ph / 2 - 30
      const F = fields.map(f => { let y = 0, x = 0, n = f; while (n && n !== paper) { y += n.offsetTop; x += n.offsetLeft; n = n.offsetParent } return [PX - paper.offsetWidth / 2 + x + f.offsetWidth / 2, -ph / 2 + y + f.offsetHeight / 2] })
      lay = { top, bot, F, hits: F.map(([, y]) => lerp(tS[0], tS[1], (y - top) / (bot - top))), pw: paper.offsetWidth }
    }
    sp(t); cam(t); loopLens(s, t, dur)
    put(paper, { x: PX, y: 0, ry: 8, o: 1 })
    const by = lerp(lay.top, lay.bot, P(t, tS[0], tS[1], E.io))
    beam.style.width = (lay.pw + 60) + 'px'
    put(beam, { x: PX, y: by, o: P(t, tS[0] - .15, tS[0]) * (1 - P(t, tS[1], tS[1] + .25)) })
    const slots = [-120, -30, 60]
    fields.forEach((f, i) => {
      const th = lay.hits[i], lit = bell(t, th - .04, th + .06, th + .8)
      f.style.boxShadow = `0 0 0 ${(3 * P(t, th - .04, th + .06)).toFixed(1)}px rgba(${ICE},${(.25 + .5 * lit).toFixed(2)}), 0 0 ${(26 * lit).toFixed(0)}px rgba(${ICE},${(.5 * lit).toFixed(2)})`
      f.style.background = `rgba(${ICE},${(.14 * P(t, th - .04, th + .06)).toFixed(3)})`
      const a = lay.F[i], p = P(t, th + .1, th + .7, E.io)
      put(chips[i], { x: lerp(a[0], CX, p), y: lerp(a[1], slots[i], p) - 70 * Math.sin(Math.PI * p), z: 60 * Math.sin(Math.PI * p), o: P(t, th + .1, th + .2), blur: 4 * Math.sin(Math.PI * p) })
    })
    blurIn(post, t, tPost, { x: CX, y: 160, dz: 160, s0: .9, blur: 16 })
    const g = bell(t, tPost, tPost + .1, tPost + 1.2)
    post.style.boxShadow = `0 0 ${(30 + 50 * g).toFixed(0)}px rgba(${AMB},${(.15 + .35 * g).toFixed(2)})`
  }
})

/* ---------- 04 back office: the run, and the pause for a person ---------- */
export const office = cardScene(7.5, (s, { dur }) => {
  const sp = specks(s, 24)
  const TASKS = [['inbox', 'Find overdue invoices', '3 overdue'], ['mail', 'Draft the reminders', '3 drafted'], ['link', 'Send and log them', '3 sent']]
  const run = h('div', 'r-run c-run', s.cam, `
    <div class="hd"><span class="av">${spark(24)}</span><div><div class="t">Back-office agent</div><div class="s">Morning run · 7:00</div></div><span class="st">● RUNNING</span></div>
    <div class="tasks">${TASKS.map(([ic, txt, res]) => `<div class="task"><span class="ic">${icon(ic)}</span><span class="tx">${txt}</span><span class="stt"><i class="ring"></i><i class="spin"></i><i class="ok">${CHECK('#1A1612', 16)}</i></span><span class="res">${res}</span></div>`).join('')}</div>
    <div class="ask"><div class="q">3 reminders ready. Send them?</div><div class="btns"><span class="no">Not yet</span><span class="yes">Approve and send</span></div></div>`)
  const st = run.querySelector('.st'), tasks = [...run.querySelectorAll('.task')]
  const ask = run.querySelector('.ask'), yes = ask.querySelector('.yes')
  const T = [[.5, 1.5], [1.5, 2.6], [4.3, 5.2]], tAsk = 2.8, tPress = 3.9
  const cam = drift(s, [[0, 0, -24, -30, 8, -6], [tAsk, 0, 4, 0, 4, -2], [dur, 0, 16, 14, 2, 3]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    put(run, { o: 1 })
    tasks.forEach((e, i) => {
      const [a, z] = T[i]
      e.classList.toggle('run', t >= a && t < z); e.classList.toggle('done', t >= z)
      e.style.opacity = (.45 + .55 * P(t, a - .15, a + .1)).toFixed(3)
      e.querySelector('.spin').style.transform = `rotate(${((t - a) * 540).toFixed(1)}deg)`
      const r = e.querySelector('.res'), rp = P(t, z, z + .3, E.out)
      r.style.opacity = rp.toFixed(3); r.style.transform = `translateX(${((1 - rp) * 14).toFixed(1)}px)`
    })
    const ap = P(t, tAsk, tAsk + .35, E.out)
    ask.style.opacity = ap.toFixed(3); ask.style.transform = `translateY(${((1 - ap) * 16).toFixed(1)}px)`
    const press = bell(t, tPress, tPress + .06, tPress + .3)
    yes.style.transform = `scale(${(1 - .06 * press).toFixed(4)})`
    yes.style.boxShadow = `0 0 ${(20 + 60 * press).toFixed(0)}px rgba(${AMB},${(.25 + .45 * press).toFixed(2)})`
    yes.classList.toggle('pressed', t >= tPress)
    const wait = t >= tAsk && t < tPress
    st.textContent = t >= T[2][1] ? '● DONE' : wait ? '● WAITING FOR YOU' : '● RUNNING'
    st.classList.toggle('wait', wait); st.classList.toggle('ok', t >= T[2][1])
  }
}, { W: 800, H: 640 })

/* ---------- 05 co-pilot: on the call, translated, the objection caught ----------
   Stacked to fit a card of any shape: the call and its badge, what the
   client said, the objection, and then what to say next, which takes the
   objection's place rather than landing on top of it. */
export const copilot = cardScene(7.5, (s, { dur }) => {
  const sp = specks(s, 25)
  const glow = h('div', 'f-abs', s.cam)
  Object.assign(glow.style, { width: '620px', height: '420px', borderRadius: '50%', background: `radial-gradient(closest-side, rgba(${CORAL},.6), rgba(${CORAL},.18) 45%, transparent)` })
  const win = h('div', 'r-call c-call', s.cam, `
    <div class="r-tl"><div class="av" style="background:linear-gradient(140deg,#E9AC57,#B87718)">Y</div><div class="r-nm">You</div><div class="mic"></div></div>
    <div class="r-tl"><div class="av" style="background:linear-gradient(140deg,#7CCBFF,#3B78B8)">M</div><div class="r-nm">Client · Madrid</div><div class="mic"></div></div>`)
  const badge = h('div', 'r-badge', s.cam, `${spark(18)}<span>n.abl co-pilot</span>`)
  const cap = h('div', 'r-cap', s.cam, `<span class="lang">ES</span><span class="line"></span>`)
  const lang = cap.querySelector('.lang'), line = cap.querySelector('.line')
  const es = words(line, 'Es un poco caro para nosotros…')
  const en = h('span', 'line', cap); en.textContent = 'It’s a bit pricey for us…'
  const flag = h('div', 'r-flag', s.cam, `<span style="color:#F07A6A">${icon('alert')}</span><span>Objection · price</span>`)
  const say = h('div', 'c-say', s.cam, `<div class="sec">Say next</div><div class="txt"></div>`)
  const sayW = words(say.querySelector('.txt'), '“Most teams start with a 30-day pilot, so you only pay once it’s working.”')
  const tCap = .7, tSwap = 2.1, tObj = 3, tSay = 4.3
  const cam = drift(s, [[0, 0, -24, -30, 6, 4], [tObj, 0, 0, 0, 2, -2], [dur, 0, 18, 10, 3, 2]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    put(win, { y: -122, s: .66 })
    put(badge, { y: -244, o: 1 })
    const swap = t >= tSwap
    line.style.display = swap ? 'none' : 'inline-block'; en.style.display = swap ? 'inline-block' : 'none'
    lang.textContent = swap ? 'ES → EN' : 'ES'
    es.forEach((e, i) => rise(e, t, tCap + i * .07, { dur: .24, dy: 14, blur: 12 }))
    const sw = bell(t, tSwap - .12, tSwap, tSwap + .25)
    put(cap, { y: 52, o: P(t, tCap - .05, tCap + .1), blur: sw * 8 })
    const ob = P(t, tObj, tObj + .3, E.out), gone = P(t, tSay - .2, tSay + .1)
    blurIn(flag, t, tObj, { y: 122, dur: .28, s0: .7, blur: 12, o: 1 - gone })
    put(glow, { y: -122, z: -40, s: lerp(.6, 1, ob), o: ob * (.8 + .2 * Math.sin(t * 9)) * (1 - P(t, tSay + .6, tSay + 1.2)) })
    win.style.borderColor = `rgba(${CORAL},${(.09 + .8 * ob * (1 - P(t, tSay + .6, tSay + 1.2))).toFixed(3)})`
    blurIn(say, t, tSay, { y: 186, dz: 160, s0: .94, blur: 14 })
    sayW.forEach((e, i) => rise(e, t, tSay + .2 + i * .04, { dur: .2, dy: 8, blur: 8 }))
  }
}, { W: 760, H: 600 })

/* ---------- 06 knowledge: asked in plain words, answered from your own documents, sourced ---------- */
export const knowledge = cardScene(7.5, (s, { dur }) => {
  const sp = specks(s, 26)
  const Q = 'What’s our refund policy on deposits?'
  const ask = h('div', 'c-ask', s.cam, `<span class="sp">${spark(22)}</span><span class="q"></span><span class="caret"></span>`)
  const q = ask.querySelector('.q'), caret = ask.querySelector('.caret')
  const ans = h('div', 'c-ans', s.cam, `
    <div class="txt">Deposits are refunded in full if the booking is cancelled <mark>at least 48 hours before</mark>. Inside 48 hours they are kept.</div>
    <div class="src"><span class="srcchip">${icon('doc')}<span>Staff handbook · p.12</span></span><span class="srcchip">${icon('doc')}<span>Booking terms · §4</span></span></div>`)
  const mark = ans.querySelector('mark'), srcs = [...ans.querySelectorAll('.srcchip')]
  const page = h('div', 'c-page', s.cam, `<div class="ttl">Staff handbook</div><i style="width:86%"></i><i style="width:72%"></i><div class="hl">Refunds: deposits are returned in full up to 48 hours before the booking.</div><i style="width:80%"></i><i style="width:64%"></i>`)
  const hl = page.querySelector('.hl')
  const tQ = [.3, 1.9], tAns = 2.4, tSrc = 3.6, tPage = 4.3
  const cam = drift(s, [[0, 0, -110, -40, 8, 0], [tAns + .4, -30, -10, -10, 4, -4], [tPage + .6, 40, 20, 0, 2, 6], [dur, 50, 30, 20, 2, 8]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    put(ask, { x: -60, y: -185, o: 1 })
    typeIn(q, Q, t, tQ[0], tQ[1])
    caret.style.opacity = t < tQ[1] + .3 ? (Math.sin(t * 16) > 0 ? 1 : 0) : 0
    blurIn(ans, t, tAns, { x: -130, y: 30, dz: 180, s0: .95, blur: 16 })
    const mg = P(t, tAns + .5, tAns + .9)
    mark.style.backgroundSize = `${(mg * 100).toFixed(1)}% 100%`
    srcs.forEach((e, i) => pop(e, t, tSrc + i * .18))
    blurIn(page, t, tPage, { x: 300, y: 70, z: -60, ry: -14, dx: 60, dz: 200, s0: .96, blur: 16 })
    const hg = P(t, tPage + .3, tPage + .7)
    hl.style.backgroundSize = `${(hg * 100).toFixed(1)}% 100%`
    hl.style.boxShadow = `0 0 ${(30 * bell(t, tPage + .3, tPage + .6, tPage + 1.6)).toFixed(0)}px rgba(${ICE},.35)`
    srcs[0].style.borderColor = `rgba(${ICE},${(.25 + .6 * hg).toFixed(2)})`
  }
}, { W: 960, H: 600 })

/* ---------- 07 built for you: a process of yours, joined up, with n.abl in the middle ----------
   Across the card when it spans the row; top to bottom when it is a card
   like the others, on a phone, where across would leave a thin strip. */
export const bespoke = cardScene(8, (s, { dur, compact }) => {
  const sp = specks(s, 27, 16, compact ? 900 : 1500, compact ? 900 : 600)
  const NAMES = [['inbox', 'New enquiry'], ['spark', 'n.abl'], ['cal', 'Checks the diary'], ['invoice', 'Prices the job'], ['mail', 'Replies in your tone'], ['bell', 'You approve']]
  const HGT = 74
  const width = ([, txt]) => Math.ceil(textWidth(txt, '600 26px "Inter Tight", sans-serif')) + 30 + 12 + 60
  const Wd = NAMES.map(width)
  const POS = compact
    ? [[0, -300], [0, -185], [0, -62], [0, 38], [0, 138], [0, 272]]
    : [[-470, 0], [-170, 0], [170, -115], [170, 0], [170, 115], [500, 0]]
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  const VW = compact ? 800 : 1300, VH = compact ? 720 : 500
  svg.setAttribute('class', 'c-wires'); svg.setAttribute('width', VW); svg.setAttribute('height', VH)
  svg.setAttribute('viewBox', `${-VW / 2} ${-VH / 2} ${VW} ${VH}`)
  Object.assign(svg.style, { width: VW + 'px', height: VH + 'px' })
  s.cam.appendChild(svg)
  const half = i => Wd[i] / 2, [x, y] = [i => POS[i][0], i => POS[i][1]]
  const D = compact ? [
    // straight down the spine, and out round the sides for the jobs that run alongside
    `M0 ${y(0) + HGT / 2} L0 ${y(1) - HGT / 2}`,
    `M0 ${y(1) + HGT / 2} L0 ${y(2) - HGT / 2}`,
    `M${-half(1)} ${y(1)} C-300 ${y(1)} -300 ${y(3)} ${-half(3)} ${y(3)}`,
    `M${-half(1)} ${y(1)} C-360 ${y(1)} -360 ${y(4)} ${-half(4)} ${y(4)}`,
    `M${half(2)} ${y(2)} C340 ${y(2)} 340 ${y(5)} ${half(5)} ${y(5)}`,
    `M${half(3)} ${y(3)} C290 ${y(3)} 290 ${y(5)} ${half(5)} ${y(5)}`,
    `M0 ${y(4) + HGT / 2} L0 ${y(5) - HGT / 2}`,
  ] : [[0, 1], [1, 2], [1, 3], [1, 4], [2, 5], [3, 5], [4, 5]].map(([a, b]) => {
    const mx = (x(a) + x(b)) / 2
    return `M${x(a)} ${y(a)} C${mx} ${y(a)} ${mx} ${y(b)} ${x(b)} ${y(b)}`
  })
  const wires = D.map(d => {
    const p = document.createElementNS(NS, 'path')
    p.setAttribute('d', d); p.setAttribute('pathLength', 1)
    svg.appendChild(p)
    return p
  })
  const pills = NAMES.map(([ic, txt], i) => {
    const e = ringPill(s.cam, Wd[i], HGT, `<span class="ic">${ic === 'spark' ? spark(30) : icon(ic)}</span><span class="txt">${txt}</span>`)
    e.classList.add('c-node'); if (i === 1) e.classList.add('c-core')
    e._x = POS[i][0]; e._y = POS[i][1]
    return e
  })
  const at = [.4, 1.1, 2.1, 2.3, 2.5, 3.6]
  const wireAt = [.75, 1.6, 1.75, 1.9, 3, 3.1, 3.2]
  // a short move: the stage is only as big as the process around it, so a
  // long one carried the ends of it out of frame
  const cam = compact
    ? drift(s, [[0, 0, -30, -40, 6, 4], [2.2, 0, 0, -70, 3, 0], [dur, 0, 20, -60, 2, -3]])
    : drift(s, [[0, -70, 0, -60, 6, 10], [2.2, 0, 0, -120, 4, 0], [dur, 60, 0, -100, 2, -6]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    pills.forEach((e, i) => {
      blurIn(e, t, at[i], { x: e._x, y: e._y, dz: 200, s0: .9, blur: 18 })
      drawRim(e, P(t, at[i] + .05, at[i] + .5, E.io))
    })
    wires.forEach((p, i) => {
      const k = P(t, wireAt[i], wireAt[i] + .45, E.io)
      p.style.strokeDasharray = '1 1'; p.style.strokeDashoffset = (1 - k).toFixed(4)
      p.style.opacity = k > 0 ? 1 : 0
    })
    const core = pills[1], g = .5 + .5 * Math.sin(t * 3)
    core.style.boxShadow = `0 0 ${(30 + 20 * g).toFixed(0)}px rgba(${AMB},${(.25 + .15 * g).toFixed(2)})`
    const done = bell(t, 4.1, 4.3, 5.8)
    pills[5].style.boxShadow = `0 0 ${(20 + 60 * done).toFixed(0)}px rgba(${AMB},${(.15 + .45 * done).toFixed(2)})`
  }
}, { design: a => (a >= 1.9 ? { W: 1420, H: 430, compact: false } : { W: 800, H: 720, compact: true }) })

/* ============================================================
   HOW WE WORK: one scene for each step, in the same grammar

   The step cards are the narrowest on the page (five to a row on a
   desk), so these are composed in a small, near-square area with big
   type and few words, and fill the card around it like the others.
   ============================================================ */
const STEP = { W: 540, H: 540 }
const pillW = (txt, px = 28) => Math.ceil(textWidth(txt, `600 ${px}px "Inter Tight", sans-serif`)) + 32 + 12 + 56

/* ---------- 01 listen: a discovery call on video, and n.abl's notes on where the time goes ----------
   A meeting window with both of you on camera, tilted in space; you talk
   (the ring and the level on your tile), and n.abl's notes float in front
   of the call, one line at a time. */
export const listen = cardScene(7.5, (s, { dur }) => {
  const sp = specks(s, 31, 12, 900, 760)
  const meet = h('div', 'c-meet', s.cam, `
    <div class="bar"><span class="rec"></span><span class="t">Discovery call</span><span class="time">00:00</span></div>
    <div class="tiles">
      <div class="tile you"><div class="av" style="background:linear-gradient(140deg,#E9AC57,#B87718)">Y</div><div class="nm">You</div><div class="lv"><i></i><i></i><i></i><i></i></div></div>
      <div class="tile nabl"><div class="av sp">${spark(40)}</div><div class="nm">n.abl</div><div class="lv"><i></i><i></i><i></i><i></i></div></div>
    </div>
    <div class="ctl"><span>${icon('mic')}</span><span>${icon('cam')}</span><span class="end">${icon('phone')}</span></div>`)
  const time = meet.querySelector('.time'), you = meet.querySelector('.tile.you'), nb = meet.querySelector('.tile.nabl')
  const lvY = [...you.querySelectorAll('.lv i')], lvN = [...nb.querySelectorAll('.lv i')]
  const notes = h('div', 'c-notes', s.cam, `
    <div class="hd">${spark(20)}<span>n.abl notes</span></div>
    <div class="note"><i></i><span>Missed calls after 5 pm</span></div>
    <div class="note"><i></i><span>Invoices typed by hand</span></div>
    <div class="note"><i></i><span>Chasing late payments</span></div>
    <div class="sum">3 places the time goes</div>`)
  const lines = [...notes.querySelectorAll('.note')], sum = notes.querySelector('.sum')
  const T = [1.9, 2.8, 3.7], tNotes = 1.5, tSum = 4.6
  // you talk, n.abl asks now and then
  const youTalk = t => (t > .5 && t < 1.6) || (t > 2 && t < 3.3) || (t > 3.5 && t < 4.4)
  const nbTalk = t => (t > 1.6 && t < 2) || (t > 3.3 && t < 3.5)
  const cam = drift(s, [[0, -10, -30, -40, 10, 12], [tNotes, 0, 0, -10, 6, 4], [dur, 10, 16, 16, 4, -6]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    put(meet, { x: -20, y: -84, rx: 6, ry: 10, o: 1 })
    time.textContent = `00:${String(12 + Math.floor(t * 2)).padStart(2, '0')}`
    const talkY = youTalk(t), talkN = nbTalk(t)
    you.classList.toggle('talk', talkY); nb.classList.toggle('talk', talkN)
    const lv = (els, on, ph) => els.forEach((e, i) => { e.style.transform = `scaleY(${(on ? .3 + .7 * Math.abs(Math.sin(t * 11 + i * 1.3 + ph)) : .15).toFixed(3)})` })
    lv(lvY, talkY, 0); lv(lvN, talkN, 2)
    blurIn(notes, t, tNotes, { x: 62, y: 146, z: 90, ry: -10, rx: 4, dz: 200, s0: .92, blur: 16 })
    lines.forEach((e, i) => pop(e, t, T[i]))
    pop(sum, t, tSum)
    const g = bell(t, tSum, tSum + .1, tSum + 1.3)
    sum.style.boxShadow = `0 0 ${(20 + 50 * g).toFixed(0)}px rgba(${AMB},${(.15 + .4 * g).toFixed(2)})`
  }
}, { W: 620, H: 600 })

/* ---------- 02 map: how the work flows today, traced, and where it sticks ---------- */
export const map = cardScene(7, (s, { dur }) => {
  const sp = specks(s, 32, 10, 900, 700)
  const NODES = [['phone', 'Calls', -130, -120], ['inbox', 'Inbox', 130, -120], ['doc', 'Paperwork', -130, 50], ['sheet', 'Accounts', 130, 50]]
  const HGT = 76, Wd = NODES.map(([, txt]) => pillW(txt))
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'c-wires'); svg.setAttribute('width', 600); svg.setAttribute('height', 500)
  svg.setAttribute('viewBox', '-300 -250 600 500')
  Object.assign(svg.style, { width: '600px', height: '500px' })
  s.cam.appendChild(svg)
  const [c, i, d, a] = NODES
  const D = [
    `M${c[2] + Wd[0] / 2} ${c[3]} L${i[2] - Wd[1] / 2} ${i[3]}`,
    `M${i[2]} ${i[3] + HGT / 2} C${i[2]} ${i[3] + 90} ${d[2]} ${d[3] - 90} ${d[2]} ${d[3] - HGT / 2}`,
    `M${d[2] + Wd[2] / 2} ${d[3]} L${a[2] - Wd[3] / 2} ${a[3]}`,
  ]
  const wires = D.map(dd => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', dd); svg.appendChild(p); return p })
  const lens = wires.map(p => p.getTotalLength() || 1)
  const pills = NODES.map(([ic, txt, x, y], k) => {
    const e = ringPill(s.cam, Wd[k], HGT, `<span class="ic">${icon(ic)}</span><span class="txt">${txt}</span>`)
    e.classList.add('c-node', 'c-mapnode'); e._x = x; e._y = y
    return e
  })
  const dot = h('div', 'r-dot', s.cam)
  const flag = h('div', 'r-flag c-flag', s.cam, `<span style="color:#F07A6A">${icon('clock')}</span><span>4 h a week, by hand</span>`)
  const at = [.4, .8, 1.2, 1.6], wireAt = [1, 1.4, 1.8], tRun = [2.3, 3.5], tStuck = 3.6
  const cam = drift(s, [[0, 0, -20, -40, 8, 6], [tStuck, 0, 10, 0, 3, 0], [dur, 0, 20, 10, 2, -4]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    pills.forEach((e, k) => {
      blurIn(e, t, at[k], { x: e._x, y: e._y, dz: 180, s0: .9, blur: 16 })
      drawRim(e, P(t, at[k] + .05, at[k] + .5, E.io))
    })
    wires.forEach((p, k) => {
      const q = P(t, wireAt[k], wireAt[k] + .4, E.io)
      p.style.strokeDasharray = `${lens[k]} ${lens[k]}`; p.style.strokeDashoffset = (lens[k] * (1 - q)).toFixed(1)
      p.style.opacity = q > 0 ? 1 : 0
    })
    // a light traces the work from the first call to the accounts, and stops where it sticks
    const run = P(t, tRun[0], tRun[1], E.io) * 3, seg = Math.min(2, Math.floor(run))
    const pt = wires[seg].getPointAtLength(lens[seg] * Math.min(1, run - seg))
    const onP = t >= tRun[0] && t < tStuck + .1
    put(dot, { x: pt.x, y: pt.y, o: onP ? 1 : 0 })
    const stuck = P(t, tStuck, tStuck + .3, E.out)
    const paper = pills[2]
    paper.classList.toggle('stuck', t >= tStuck)
    paper.style.boxShadow = `0 0 ${(50 * stuck * (.75 + .25 * Math.sin(t * 8))).toFixed(0)}px rgba(${CORAL},${(.5 * stuck).toFixed(2)})`
    blurIn(flag, t, tStuck + .2, { x: d[2] + 90, y: d[3] + 88, dur: .28, s0: .7, blur: 12 })
  }
}, STEP)

/* ---------- 03 build around you: its tone set, tested on real cases, checked ---------- */
export const buildIt = cardScene(7.5, (s, { dur }) => {
  const sp = specks(s, 33, 10, 900, 700)
  const TESTS = ['Table for 4, Sat 7 pm', 'Move me to Thursday', 'Can I get a refund?']
  const panel = h('div', 'c-step', s.cam, `
    <div class="hd"><span class="ic amb">${spark(26)}</span><span class="t">Your AI</span><span class="st amb">● TESTING</span></div>
    <div class="tone"><span class="k">Tone</span><span class="ch">Warm</span><span class="ch">Brief</span><span class="ch off">Formal</span></div>
    <div class="tests">${TESTS.map(txt => `<div class="test"><span class="tx">${txt}</span><span class="stt"><i class="ring"></i><i class="spin"></i><i class="ok">${CHECK('#1A1612', 16)}</i></span></div>`).join('')}</div>
    <div class="pass"><span>Checks passed</span><b>0 / 24</b></div>`)
  const st = panel.querySelector('.st'), chips = [...panel.querySelectorAll('.tone .ch')]
  const tests = [...panel.querySelectorAll('.test')], pass = panel.querySelector('.pass'), num = pass.querySelector('b')
  const tTone = [.5, .8], T = [[1.5, 2.2], [2.2, 2.9], [2.9, 3.6]], tPass = 3.9
  const cam = drift(s, [[0, 0, -24, -30, 8, 6], [tPass, 0, 6, 0, 3, 0], [dur, 0, 18, 12, 2, -4]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    put(panel, { o: 1 })
    chips.slice(0, 2).forEach((e, k) => e.classList.toggle('on', t >= tTone[k]))
    tests.forEach((e, k) => {
      const [a, z] = T[k]
      e.style.opacity = (.35 + .65 * P(t, a - .2, a)).toFixed(3)
      e.classList.toggle('run', t >= a && t < z); e.classList.toggle('done', t >= z)
      e.querySelector('.spin').style.transform = `rotate(${((t - a) * 540).toFixed(1)}deg)`
    })
    pop(pass, t, tPass)
    count(num, t, tPass + .1, tPass + .9, 24, v => `${v} / 24`)
    const done = t >= tPass + .9
    st.textContent = done ? '● READY' : '● TESTING'
    st.classList.toggle('ok', done)
    const g = bell(t, tPass + .9, tPass + 1, tPass + 2)
    pass.style.boxShadow = `0 0 ${(20 + 50 * g).toFixed(0)}px rgba(157,190,151,${(.15 + .35 * g).toFixed(2)})`
  }
}, STEP)

/* ---------- 04 launch: switched on beside your team, with a person in the loop ---------- */
export const launch = cardScene(7.5, (s, { dur }) => {
  const sp = specks(s, 34, 10, 900, 700)
  const live = h('div', 'c-step c-live', s.cam, `
    <div class="row"><span class="t">AI receptionist</span><span class="sw"><i></i></span></div>
    <div class="state"><span class="led"></span><span class="lbl">Off</span></div>`)
  const sw = live.querySelector('.sw'), lbl = live.querySelector('.lbl'), stDot = live.querySelector('.led')
  const ask = h('div', 'c-step c-review', s.cam, `
    <div class="hd"><span class="ic coral">${icon('bell')}</span><span class="t">Needs your OK</span></div>
    <div class="msg">Refund of £60 requested</div>
    <div class="btns"><span class="no">Not yet</span><span class="yes">Approve</span></div>`)
  const yes = ask.querySelector('.yes')
  const loop = h('div', 'r-badge c-loop', s.cam, `${spark(18)}<span>Person in the loop</span>`)
  const tOn = 1, tAsk = 2.3, tPress = 3.7, tLoop = 4.4
  const cam = drift(s, [[0, 0, -28, -30, 8, -6], [tAsk, 0, 0, 0, 4, 0], [dur, 0, 20, 10, 2, 4]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    put(live, { y: -140, o: 1 })
    const on = P(t, tOn, tOn + .35, E.snap)
    sw.style.setProperty('--on', Math.min(1, on).toFixed(3))
    sw.classList.toggle('is-on', t >= tOn)
    lbl.textContent = t >= tOn + .2 ? 'Live, alongside your team' : 'Off'
    stDot.classList.toggle('is-on', t >= tOn + .2)
    const g = bell(t, tOn, tOn + .15, tOn + 1.2)
    live.style.boxShadow = `0 40px 120px rgba(0,0,0,.6), 0 0 ${(70 * g).toFixed(0)}px rgba(${AMB},${(.35 * g).toFixed(2)})`
    blurIn(ask, t, tAsk, { y: 58, dz: 180, s0: .94, blur: 16 })
    const press = bell(t, tPress, tPress + .06, tPress + .3)
    yes.style.transform = `scale(${(1 - .06 * press).toFixed(4)})`
    yes.classList.toggle('pressed', t >= tPress)
    yes.textContent = t >= tPress ? '✓ Approved by you' : 'Approve'
    blurIn(loop, t, tLoop, { y: 196, dur: .3, s0: .7, blur: 12 })
  }
}, STEP)

/* ---------- 05 run and improve: the month's report, talked through on a call ----------
   The report is a screen being shared, tilted in space with its line
   standing off it; n.abl's tile sits in front, speaking over it, with the
   words captioned, and what comes next lands in front of both. */
export const improve = cardScene(8, (s, { dur }) => {
  const sp = specks(s, 35, 14, 900, 760)
  const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'], VALS = [86, 89, 91, 94, 97]
  const CW = 380, CH = 150, lo = 82, hi = 100
  const px = k => (k / (MONTHS.length - 1)) * CW, py = v => CH - ((v - lo) / (hi - lo)) * CH
  const pts = VALS.map((v, k) => [px(k), py(v)])
  const line = pts.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const share = h('div', 'c-share', s.cam, `
    <div class="hd"><span class="live">● SHARING</span><span class="t">Monthly report</span></div>
    <div class="k">Calls answered</div>
    <svg class="chart" viewBox="-14 -14 ${CW + 28} ${CH + 48}" style="width:${CW + 28}px;height:${CH + 48}px;display:block;overflow:visible">
      ${[0, 1, 2, 3].map(g => `<line class="grid" x1="0" x2="${CW}" y1="${(CH * g / 3).toFixed(1)}" y2="${(CH * g / 3).toFixed(1)}"/>`).join('')}
      <path class="area" d="${line} L${CW} ${CH} L0 ${CH} Z"/>
      <path class="ln" d="${line}"/>
      ${pts.map(([x, y]) => `<circle class="pt" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7"/>`).join('')}
      ${MONTHS.map((m, k) => `<text class="mo" x="${px(k).toFixed(1)}" y="${CH + 30}">${m}</text>`).join('')}
    </svg>`)
  const ln = share.querySelector('.ln'), area = share.querySelector('.area'), dots = [...share.querySelectorAll('.pt')]
  const L = ln.getTotalLength() || 1
  // the latest figure stands off the screen, in front of it
  const tag = h('div', 'c-tag', s.cam, `<b>97%</b><span>up from 86%</span>`)
  const pres = h('div', 'c-pres', s.cam, `<div class="av">${spark(46)}</div><div class="nm">n.abl</div><div class="lv"><i></i><i></i><i></i><i></i></div>`)
  const lvP = [...pres.querySelectorAll('.lv i')]
  const cc = h('div', 'c-cc', s.cam, `<span class="a"></span><span class="b"></span>`)
  const ccA = words(cc.querySelector('.a'), '“Calls answered are up to 97% this month.”')
  const ccB = words(cc.querySelector('.b'), '“Next, we add after-hours bookings.”')
  const next = h('div', 'c-chip amb', s.cam, `${spark(20)}<span>Next: after-hours bookings</span>`)
  const meet = h('div', 'c-chip', s.cam, `${icon('cal')}<span>Next session · Thu 10:00</span>`)
  const tLine = [.6, 2.2], tTag = 2.3, tA = 1.1, tB = 3.4, tNext = 3.9, tMeet = 4.6
  const talking = t => (t > 1 && t < 3) || (t > 3.3 && t < 4.6)
  const cam = drift(s, [[0, -20, -20, -60, 12, 16], [tTag, 0, 0, -10, 7, 4], [dur, 16, 14, 10, 5, -10]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    blurIn(share, t, .1, { x: 20, y: -124, rx: 8, ry: -14, dz: 200, s0: .95, blur: 16 })
    const q = P(t, tLine[0], tLine[1], E.io)
    ln.style.strokeDasharray = `${L} ${L}`; ln.style.strokeDashoffset = (L * (1 - q)).toFixed(1)
    area.style.opacity = (.9 * q).toFixed(3)
    dots.forEach((e, k) => { e.style.opacity = q * (MONTHS.length - 1) >= k - .01 ? 1 : 0 })
    blurIn(tag, t, tTag, { x: 172, y: -196, z: 90, ry: -14, dz: 160, s0: .8, blur: 12 })
    const tg = bell(t, tTag, tTag + .1, tTag + 1.4)
    tag.style.boxShadow = `0 20px 60px rgba(0,0,0,.5), 0 0 ${(30 + 50 * tg).toFixed(0)}px rgba(${AMB},${(.25 + .35 * tg).toFixed(2)})`
    blurIn(pres, t, .5, { x: -180, y: 120, z: 80, ry: 8, dz: 200, s0: .9, blur: 14 })
    const on = talking(t)
    pres.classList.toggle('talk', on)
    lvP.forEach((e, i) => { e.style.transform = `scaleY(${(on ? .3 + .7 * Math.abs(Math.sin(t * 11 + i * 1.3)) : .15).toFixed(3)})` })
    // the caption: the first line, then the second in its place
    const swap = t >= tB
    put(cc, { x: 108, y: 92, z: 80, o: P(t, tA - .05, tA + .1) })
    cc.querySelector('.a').style.display = swap ? 'none' : 'inline'
    cc.querySelector('.b').style.display = swap ? 'inline' : 'none'
    ccA.forEach((e, i) => rise(e, t, tA + i * .07, { dur: .22, dy: 8, blur: 8 }))
    ccB.forEach((e, i) => rise(e, t, tB + i * .07, { dur: .22, dy: 8, blur: 8 }))
    blurIn(next, t, tNext, { x: 108, y: 168, z: 80, dz: 160, s0: .92, blur: 14 })
    blurIn(meet, t, tMeet, { x: 108, y: 222, z: 80, dz: 160, s0: .92, blur: 14 })
  }
}, { W: 660, H: 640 })
