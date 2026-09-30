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
   stage is rebuilt to match and carries on from the same moment. */
let LITE = false
function cardScene(dur, build, { W = 800, H = 560 } = {}) {
  return {
    dur,
    mount(host) {
      LITE = window.matchMedia('(pointer: coarse)').matches
      const box = h('div', 'f-card', host)
      let ctx = null, shape = '', last = 0
      const make = () => {
        const hw = host.clientWidth, hh = host.clientHeight
        if (!hw || !hh) return
        const k = Math.min(hw / W, hh / H)
        const w = Math.ceil(hw / k), hgt = Math.ceil(hh / k)
        box.style.zoom = String(k)
        if (`${w}x${hgt}` === shape) return
        shape = `${w}x${hgt}`
        if (ctx) ctx.destroy()
        ctx = createStage(box, { W: w, H: hgt, beat: dur, list: [{ id: 's', beats: 1 }] })
        ctx.setGround([[0, .5, .75, .45, .5, -.1, .85], [dur, .5, .75, .45, .5, -.1, .85]])
        ctx.scene(['s'], s => build(s, { W: w, H: hgt, dur }))
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
  const cam = drift(s, [[0, 30, -40, -40, 12, -10], [tA, 0, 10, 20, 4, -2], [dur, 0, 40, 50, 2, 3]])
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
  const cam = drift(s, [[0, 0, -60, -40, 10, -8], [tAsk, 0, 10, 10, 4, -2], [dur, 0, 30, 30, 2, 4]])
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
})

/* ---------- 05 co-pilot: on the call, translated, the objection caught ---------- */
export const copilot = cardScene(7.5, (s, { dur }) => {
  const sp = specks(s, 25)
  const glow = h('div', 'f-abs', s.cam)
  Object.assign(glow.style, { width: '760px', height: '520px', borderRadius: '50%', background: `radial-gradient(closest-side, rgba(${CORAL},.6), rgba(${CORAL},.18) 45%, transparent)` })
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
  const tCap = .7, tSwap = 2.1, tObj = 3, tSay = 4.2
  const cam = drift(s, [[0, 0, -60, -40, 8, 6], [tObj, 0, 0, 0, 2, -2], [dur, 0, 70, 20, 4, 2]])
  return t => {
    sp(t); cam(t); loopLens(s, t, dur)
    put(win, { y: -110, s: .78 })
    put(badge, { y: -262, o: 1 })
    const swap = t >= tSwap
    line.style.display = swap ? 'none' : 'inline-block'; en.style.display = swap ? 'inline-block' : 'none'
    lang.textContent = swap ? 'ES → EN' : 'ES'
    es.forEach((e, i) => rise(e, t, tCap + i * .07, { dur: .24, dy: 14, blur: 12 }))
    const sw = bell(t, tSwap - .12, tSwap, tSwap + .25)
    put(cap, { y: 70, o: P(t, tCap - .05, tCap + .1), blur: sw * 8 })
    const ob = P(t, tObj, tObj + .3, E.out)
    blurIn(flag, t, tObj, { y: 140, dur: .28, s0: .7, blur: 12 })
    put(glow, { y: -110, z: -40, s: lerp(.6, 1, ob), o: ob * (.8 + .2 * Math.sin(t * 9)) * (1 - P(t, tSay + .6, tSay + 1.2)) })
    win.style.borderColor = `rgba(${CORAL},${(.09 + .8 * ob).toFixed(3)})`
    blurIn(say, t, tSay, { y: 225, dz: 160, s0: .94, blur: 14 })
    sayW.forEach((e, i) => rise(e, t, tSay + .2 + i * .04, { dur: .2, dy: 8, blur: 8 }))
  }
})

/* ---------- 06 knowledge: asked in plain words, answered from your own documents, sourced ---------- */
export const knowledge = cardScene(7.5, (s, { dur }) => {
  const sp = specks(s, 26)
  const Q = 'What’s our refund policy on deposits?'
  const ask = h('div', 'c-ask', s.cam, `<span class="sp">${spark(22)}</span><span class="q"></span><span class="caret"></span>`)
  const q = ask.querySelector('.q'), caret = ask.querySelector('.caret')
  const ans = h('div', 'c-ans', s.cam, `
    <div class="txt">Deposits are refunded in full if the booking is cancelled <mark>at least 48 hours before</mark>. Inside 48 hours they are kept.</div>
    <div class="src"><span class="chip">${icon('doc')}<span>Staff handbook · p.12</span></span><span class="chip">${icon('doc')}<span>Booking terms · §4</span></span></div>`)
  const mark = ans.querySelector('mark'), srcs = [...ans.querySelectorAll('.chip')]
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

/* ---------- 07 built for you: a process of yours, joined up, with n.abl in the middle ---------- */
export const bespoke = cardScene(8, (s, { dur }) => {
  const sp = specks(s, 27, 16, 1500, 600)
  const NODES = [
    ['inbox', 'New enquiry', -470, 0],
    ['spark', 'n.abl', -170, 0],
    ['cal', 'Checks the diary', 170, -115],
    ['invoice', 'Prices the job', 170, 0],
    ['mail', 'Replies in your tone', 170, 115],
    ['bell', 'You approve', 500, 0],
  ]
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'c-wires'); svg.setAttribute('width', 1300); svg.setAttribute('height', 500); svg.setAttribute('viewBox', '-650 -250 1300 500')
  s.cam.appendChild(svg)
  const LINKS = [[0, 1], [1, 2], [1, 3], [1, 4], [2, 5], [3, 5], [4, 5]]
  const wires = LINKS.map(([a, b]) => {
    const [, , x1, y1] = NODES[a], [, , x2, y2] = NODES[b]
    const p = document.createElementNS(NS, 'path')
    const mx = (x1 + x2) / 2
    p.setAttribute('d', `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`)
    p.setAttribute('pathLength', 1)
    svg.appendChild(p)
    return p
  })
  const pills = NODES.map(([ic, txt, x, y], i) => {
    const w = i === 1 ? 190 : 250
    const e = ringPill(s.cam, w, 74, `<span class="ic">${ic === 'spark' ? spark(30) : icon(ic)}</span><span class="txt">${txt}</span>`)
    e.classList.add('c-node'); if (i === 1) e.classList.add('c-core')
    e._x = x; e._y = y
    return e
  })
  const at = [.4, 1.1, 2.1, 2.3, 2.5, 3.6]
  const wireAt = [.75, 1.6, 1.75, 1.9, 3, 3.1, 3.2]
  // a short pan: on a narrow card the stage is only as wide as the process,
  // so a long one carried the ends of it out of frame
  const cam = drift(s, [[0, -70, 0, -60, 6, 10], [2.2, 0, 0, -120, 4, 0], [dur, 60, 0, -100, 2, -6]])
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
}, { W: 1420, H: 430 })
