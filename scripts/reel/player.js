/* ============================================================
   REEL PLAYER

   A 1080x1920 stage, a run of show in real seconds, and one rAF loop
   that places the camera window, the scene and the type for whatever
   second it is asked about. Same contract as the site's scenes: given
   the same t it draws the same frame, so scrubbing and playing go
   through identical code and a paused frame is a real frame.

   The camera is a rectangle that moves. It is not three layouts that
   swap — it eases from one rect to the next on the repository's own
   --ease curve, which is what makes a cut from full-screen to a band
   read as one object resizing rather than two shots spliced.
   ============================================================ */

/* Absolute start times, and the rect the camera holds through a
   section where it is off (it fades in place rather than jumping to
   somewhere it was never going to be). */
let clock = 0
let lastRect = FULL
for (const s of SHOW) {
  s.t0 = clock
  clock += s.dur
  s.t1 = clock
  s.rect = s.cam || lastRect
  s.on = !!s.cam
  if (s.cam) lastRect = s.cam
}
const TOTAL = clock

/* ------------------------------------------------------------------
   Elements
   ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id)
const stage    = $('stage')
const camBox   = $('cam')
const camVideo = $('camVideo')
const sceneBox = $('sceneBox')
const sceneSlide = $('sceneSlide')
const sceneGlow = $('sceneGlow')
const sceneSheen = $('sceneSheen')
const dotRow  = $('dots')
const brand   = $('brandLayer')
const logo    = $('logo')
const logoDot = $('lg-dot')
const rule    = $('rule')
const cardWrap = $('cardWrap')
const card     = $('card')
const cardEdge = $('cardEdge')
const labelWrap = $('labelWrap')
const svcLabel = $('svcLabel')
const endWrap  = $('endWrap')
const endQ     = $('endQ')
const endUrl   = $('endUrl')
const clockWrap = $('clockWrap')
const clockRing = $('clockRing')
const clockMin  = $('clockMin')
const clockHour = $('clockHour')
const RING_LEN  = clockRing.getTotalLength ? clockRing.getTotalLength() : 2 * Math.PI * 84
clockRing.style.strokeDasharray = RING_LEN.toFixed(2)
const wordWrap = $('wordWrap')
const wordEl   = $('word')
const twWrap   = $('twWrap')
const twEl     = $('tw')
const typeBox  = $('type')
const guides   = $('guides')

const elKicker = $('tKicker')
const elHead   = $('tHead')
const elSub    = $('tSub')
const elLines  = $('tLines')

/* ------------------------------------------------------------------
   Scenes — all six mounted once, shown one at a time
   ------------------------------------------------------------------ */
const mounted = {}
for (const [name, scene] of Object.entries(SCENES)) {
  const host = document.createElement('div')
  host.className = 'sceneHost'
  host.innerHTML = scene.make()
  const svg = host.querySelector('svg')
  svg.setAttribute('viewBox', '320 146 800 608')
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  sceneSlide.appendChild(host)
  mounted[name] = { scene, host, els: scene.bind(host) }
}

/* ------------------------------------------------------------------
   The morphing card

   Every face is mounted once and stays mounted. What changes is which
   two are visible and how blurred: the container lerps its width,
   height and radius between the state it left and the state it is
   going to, and both contents are blurred by how fast that box is
   currently changing. Blur peaks halfway through the move and is zero
   at both ends, which is what makes a settled card look sharp and a
   moving one look like it is actually moving.
   ------------------------------------------------------------------ */
const HAS_CARDS = typeof CARDS !== 'undefined'
const MORPH = 0.62
const faces = {}

if (HAS_CARDS) {
  for (const [name, c] of Object.entries(CARDS)) {
    if (!c.html) continue
    const el = document.createElement('div')
    el.className = 'cardFace'
    el.dataset.card = name
    el.innerHTML = c.html
    el.style.opacity = '0'
    card.insertBefore(el, cardEdge)
    faces[name] = el
  }
}

/* Overshoot, as an excursion rather than as an easing curve.

   The first attempt put a back-ease on the box size, which cannot work:
   the overshoot is then a percentage of the distance travelled, and
   every card here is roughly the same size. A pillar at 470 becoming a
   service at 540 travels 70px, so a 7% overshoot is 5px. Correct
   arithmetic, invisible result.

   So the excursion is separate from the travel. `pop` rises late, peaks
   around 0.72 of the move and returns to exactly zero at the end, and it
   is applied as a multiplier — which makes the overshoot a fixed
   fraction of the card, not of how far the card happened to move. */
const pop = (x) => {
  const t = clamp(x, 0, 1)
  return Math.sin(Math.PI * t) * Math.pow(t, 1.6) * 2.1
}

/* Standard back-out, for the content's travel. The overshoot here IS
   meant to scale with the distance, because the content genuinely
   travels — it comes in from the right, goes past its mark, corrects. */
const backOut = (x, s = 1.9) => { const t = clamp(x, 0, 1) - 1; return t * t * ((s + 1) * t + s) + 1 }

function drawCard(lt, s, prev, time) {
  const a = CARDS[prev.card] || CARDS[s.card]
  const b = CARDS[s.card]
  const travel = seg(lt, 0, MORPH, EASE_OUT)   // the box gets there
  /* Driven by the clock, not by `travel`. EASE_OUT is front-loaded, so
     the box has effectively arrived by a third of the way through; a pop
     keyed to that peaks at the same moment and just makes the card start
     large and shrink in. Keyed to real time it peaks well after arrival,
     which is the order the eye needs: get there, go past, come back. */
  const over = pop(seg(lt, 0, MORPH, LINEAR))
  const p = seg(lt, 0, MORPH, EASE_IO)         // the wipe: even travel
  const slide = backOut(seg(lt, 0, MORPH * 1.15, LINEAR))

  /* 1.2% of the card, not 4.5%. The excursion has to be independent of
     travel distance to exist at all, but once it exists it needs to be
     small: at 4.5% a 540px card swelled 24px, which reads as a slam. */
  const swell = 1 + 0.012 * over
  /* Collapses to nothing on the closing beat. */
  const shut = s.collapse ? 1 - seg(lt, 0, 0.44, EASE) : 1

  const set = (prop, value) => { if (card.style[prop] !== value) card.style[prop] = value }
  set('width', `${(lerp(a.w, b.w, travel) * swell).toFixed(1)}px`)
  set('height', `${(lerp(a.h, b.h, travel) * swell * shut).toFixed(1)}px`)
  set('borderRadius', `${lerp(a.r, b.r, travel).toFixed(1)}px`)
  set('opacity', shut < 0.02 ? '0' : '1')

  /* Never quite still. Drift only, on two periods so it never repeats
     visibly — translate composites for free.

     No skew, and this was measured rather than assumed. Animating skewY
     costs 32fps and even a STATIC skew costs 27, because the card
     resizes every frame and a skewed box that resizes has to be
     re-rasterised rather than composited. It is the same class of
     operation as the blur that took the renderer down. A fixed skew on
     the whole clip is a two-second job in the edit, where it costs
     nothing. */
  cardWrap.style.transform =
    `translate(${(Math.sin(time * 0.47) * 7).toFixed(2)}px, ${(Math.sin(time * 0.62) * 6).toFixed(2)}px)` +
    (FLUID
      ? ` rotate(${(Math.sin(time * 0.33) * 0.6).toFixed(3)}deg)` +
        ` skewY(${(Math.sin(time * 0.41) * 0.5).toFixed(3)}deg)`
      : '')

  /* No filter: blur() anywhere near this. Blurring a card-sized subtree
     at a radius that changes every frame is re-rasterised every frame,
     and it took the renderer down. Motion blur belongs in the edit. */
  const w = (p * 100).toFixed(2)
  for (const [name, el] of Object.entries(faces)) {
    const incoming = name === s.card
    const outgoing = name === prev.card && !incoming
    if (!incoming && !outgoing) { el.style.opacity = '0'; continue }
    if (outgoing && p > 0.999) { el.style.opacity = '0'; continue }
    el.style.opacity = '1'
    el.style.clipPath = incoming
      ? `inset(0 ${(100 - p * 100).toFixed(2)}% 0 0)`
      : `inset(0 0 0 ${w}%)`
    /* 40px of entry, not 150. Enough to see it arrive and correct. */
    el.style.transform = incoming
      ? `translateX(${lerp(40, 0, slide).toFixed(1)}px)`
      : `translateX(${(-14 * travel).toFixed(1)}px)`
  }

  /* The edge rides the wipe and leaves with it, on a sine so it is zero
     at both ends and never switches. A hard 0/1 was the strobe. */
  cardEdge.style.left = `${w}%`
  cardEdge.style.opacity = Math.sin(clamp(p, 0, 1) * Math.PI).toFixed(3)

  /* Ramped in only when the card first arrives. Doing it every section
     reset the whole card to zero opacity at each boundary and faded it
     back — which is the flicker between every card. */
  cardWrap.style.opacity = prev.card ? '1' : seg(lt, 0, 0.24, EASE_OUT).toFixed(3)
}

/* ------------------------------------------------------------------
   The wordmark

   It is a monoline construction — one 13-unit stroke throughout, every
   curve a true circle — which means it can be *written* rather than
   faded in. Each stroke is dashed to its own length and its offset
   run to zero, in the order a hand would take: n, the dot, a, b, l.
   The dot is the signature, so it lands rather than draws.
   ------------------------------------------------------------------ */
const STROKES = ['lg-n', 'lg-a1', 'lg-a2', 'lg-b1', 'lg-b2', 'lg-l'].map((id) => {
  const el = $(id)
  const len = el.getTotalLength
    ? el.getTotalLength()
    : 2 * Math.PI * Number(el.getAttribute('r'))
  el.style.strokeDasharray = len.toFixed(2)
  return { el, len }
})

/* Reading order, with the dot sitting where it is written. Groups the
   two-part letters so a bowl and its stem arrive together. */
const LOGO_ORDER = [[0], [1, 2], [3, 4], [5]]

function drawLogo(lt, cfg) {
  const at = cfg.at || 0.10, step = cfg.step || 0.20, span = cfg.span || 0.58

  LOGO_ORDER.forEach((group, i) => {
    const a = at + i * step
    const q = seg(lt, a, a + span, EASE_OUT)
    for (const k of group) {
      const st = STROKES[k]
      st.el.style.strokeDashoffset = (st.len * (1 - q)).toFixed(2)
    }
  })

  /* The dot lands after the n and before the a — where it is in the
     word — and it lands rather than draws, because it is a full stop. */
  const d = seg(lt, at + step * 0.78, at + step * 0.78 + 0.42, EASE_OUT)
  logoDot.style.opacity = d.toFixed(3)
  logoDot.style.transform = `translateY(${lerp(-26, 0, d).toFixed(1)}px) scale(${lerp(0.2, 1, d).toFixed(3)})`

  const hold = seg(lt, 0, 0.30, EASE_OUT)
  const out = cfg.out ? seg(lt, cfg.out[0], cfg.out[1], EASE) : 0
  brand.style.opacity = (hold - out).toFixed(3)
  logo.style.width = `${cfg.w || 620}px`
  logo.style.transform =
    `translateY(${((cfg.y || 0) - out * 40).toFixed(1)}px) scale(${lerp(0.97, 1, hold) * (1 - out * 0.05)})`
}

/* ------------------------------------------------------------------
   State
   ------------------------------------------------------------------ */
let t = 0
let playing = false
let raf = 0
let originAt = 0
let camMode = 'key'        // live | key | off
let mirror = true
let showGuides = true
let lastSection = null

/* Wall-clock seconds per timeline second. At 0.5 the animation runs at
   half speed while the renderer still draws as fast as it can, so a
   60fps capture of a 2x-long take carries 120fps of real sampling once
   it is sped back up — which is what gives motion blur genuine
   intermediate frames to blend rather than synthesised ones.

   It also doubles the frame budget. Anything that renders at 30fps
   wall-clock is a true 60 once halved and sped up, which is why the
   skew is available again below. */
let SPEED = 1

const sectionAt = (time) => {
  for (let i = SHOW.length - 1; i >= 0; i--) if (time >= SHOW[i].t0) return i
  return 0
}

const lerpRect = (a, b, p) => ({
  x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p),
  w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p),
})

/* ------------------------------------------------------------------
   Draw one frame
   ------------------------------------------------------------------ */
function draw(time) {
  const i = sectionAt(time)
  const s = SHOW[i]
  const prev = SHOW[i - 1] || s
  const lt = time - s.t0

  /* ---- camera: rect eases, opacity crossfades ---- */
  const p = seg(lt, 0, TRANS, EASE)
  const rect = lerpRect(prev.rect, s.rect, p)
  const on = lerp(prev.on ? 1 : 0, s.on ? 1 : 0, seg(lt, 0, TRANS * 0.8, EASE_OUT))

  camBox.style.transform = `translate(${rect.x.toFixed(1)}px, ${rect.y.toFixed(1)}px)`
  camBox.style.width  = `${rect.w.toFixed(1)}px`
  camBox.style.height = `${rect.h.toFixed(1)}px`
  camBox.style.opacity = on.toFixed(3)

  /* ---- typewriter, receding word ---- */
  if (typeof drawWord === 'function') {
    if (s.word) {
      if (wordEl.textContent !== s.word) wordEl.textContent = s.word
      drawWord(wordEl, lt, s)
    } else wordEl.style.opacity = '0'

    if (s.type) {
      twWrap.style.opacity = (seg(lt, 0, 0.2, EASE_OUT) - seg(lt, s.dur - 0.34, s.dur, EASE)).toFixed(3)
      drawTypewriter(twEl, lt, s)
    } else twWrap.style.opacity = '0'
  }

  /* ---- the morphing card ---- */
  if (HAS_CARDS && s.card) drawCard(lt, s, prev, time)
  else if (HAS_CARDS) cardWrap.style.opacity = '0'

  /* ---- the service label ----
     Emerges from behind the card, alternating below and above so six
     beats do not land in the same place six times. */
  if (s.label) {
    if (svcLabel.dataset.l !== s.label) {
      svcLabel.dataset.l = s.label
      svcLabel.replaceChildren(...s.label.split(' ').map((word) => {
        const i = document.createElement('i')
        i.textContent = word
        return i
      }))
    }
    /* Read from the inline height, already in stage units — a bounding
       rect would be screen pixels and the stage is scaled. */
    const h = parseFloat(card.style.height) || 500
    const reach = (s.above ? -1 : 1) * (h / 2 + 92)

    /* Timed to the wipe, and handing off to the next label so the two
       read as one piece of text passing through the card rather than two
       labels taking turns. Every label ENTERS from behind the card
       centre and LEAVES back to it, and because the positions alternate,
       an "above" label leaving downward is followed by a "below" label
       continuing downward. The exit therefore has to finish exactly at
       the boundary the next entry starts on, or the hand-off shows. */
    const OUT_T = MORPH * 0.92
    const back = seg(lt, s.dur - OUT_T, s.dur, EASE_IO)

    for (let i = 0; i < svcLabel.children.length; i++) {
      const el = svcLabel.children[i]
      /* Still fired in sequence, but over the wipe's own duration rather
         than a third of it, and overshooting by about 25px rather than
         59 — enough to register as a correction, not as a bounce. */
      const a0 = 0.06 + i * 0.052
      const raw = seg(lt, a0, a0 + MORPH * 0.88, LINEAR)
      const q = backOut(raw, 1.05)

      /* Idle drift while it is just being a label: a degree of rotation
         and a few pixels, on periods long enough not to read as a loop,
         phase-offset per word so they never line up. Damped to nothing
         during the entry and the exit so it never fights the travel. */
      const held = Math.min(raw, 1) * (1 - back)
      const ph = i * 1.7
      const rot = Math.sin(time * 0.53 + ph) * 1.1 * held
      const dx = Math.sin(time * 0.37 + ph) * 5 * held
      const dy = Math.sin(time * 0.61 + ph) * 4 * held

      const y = lerp(0, reach, q) * (1 - back) + dy
      el.style.transform = `translate(${dx.toFixed(2)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`
      el.style.opacity = (Math.min(raw * 2.4, 1) - back).toFixed(3)
    }
    svcLabel.style.opacity = '1'
  } else svcLabel.style.opacity = '0'

  /* ---- word-by-word type, for the opening line and the closing one ----
     One renderer, because they are the same move at two ends of the
     film and matching them is what makes the reel feel closed. */
  if (s.words || s.end) {
    const text = s.words || s.end
    if (endQ.dataset.q !== text) {
      endQ.dataset.q = text
      endQ.replaceChildren(...text.split(' ').map((word) => {
        const b = document.createElement('b'); b.textContent = word; return b
      }))
    }
    endWrap.dataset.at = s.words ? 'open' : 'close'
    const at = s.wordsAt ?? 0.52
    const step = s.wordsStep ?? 0.085
    const fade = s.wordsOut ? seg(lt, s.dur - s.wordsOut, s.dur, EASE) : 0

    for (let i = 0; i < endQ.children.length; i++) {
      const q2 = seg(lt, at + i * step, at + i * step + 0.42, EASE_OUT)
      /* Same idle drift as the labels, damped in and out. */
      const held = q2 * (1 - fade)
      const ph = i * 1.3
      endQ.children[i].style.opacity = (q2 - fade).toFixed(3)
      endQ.children[i].style.transform =
        `translate(${(Math.sin(time * 0.36 + ph) * 3.5 * held).toFixed(2)}px, ` +
        `${(lerp(22, 0, q2) + Math.sin(time * 0.58 + ph) * 3 * held).toFixed(1)}px) ` +
        `rotate(${(Math.sin(time * 0.49 + ph) * 0.9 * held).toFixed(2)}deg) ` +
        `scale(${lerp(0.9, 1, q2).toFixed(3)})`
    }
    endWrap.style.opacity = '1'

    /* The address only exists on the closing beat. */
    if (s.end) {
      const u = seg(lt, at + endQ.children.length * step + 0.30, s.dur - 0.5, EASE_OUT)
      endUrl.style.opacity = u.toFixed(3)
      endUrl.style.transform = `translateY(${lerp(26, 0, u).toFixed(1)}px) scale(${lerp(0.88, 1, u).toFixed(3)})`
    } else endUrl.style.opacity = '0'
  } else endWrap.style.opacity = '0'

  /* ---- the clock ----
     Drawn in the wordmark's own construction: one monoline stroke, a
     true circle, and the house's square full stop at the centre. The
     hands accelerate rather than tick, which is the point — this is
     time going, not time being kept. */
  if (s.clock) {
    const inP = seg(lt, 0.10, 0.85, EASE_OUT)
    const outP = seg(lt, s.dur - 0.55, s.dur, EASE)
    clockWrap.style.opacity = (inP - outP).toFixed(3)
    /* Butt caps leave a hairline seam where the dash meets itself, so
       the dash is dropped altogether once the ring has closed. */
    clockRing.style.strokeDasharray = inP >= 1 ? 'none' : RING_LEN.toFixed(2)
    clockRing.style.strokeDashoffset = (RING_LEN * (1 - inP)).toFixed(2)
    /* Quadratic, so it visibly runs away with itself. */
    const spin = lt * lt * 62
    clockMin.setAttribute('transform', `rotate(${spin.toFixed(1)} 100 100)`)
    clockHour.setAttribute('transform', `rotate(${(spin / 12).toFixed(1)} 100 100)`)
    clockWrap.style.transform =
      `translateY(${(Math.sin(time * 0.5) * 5 * inP).toFixed(2)}px) scale(${lerp(0.86, 1, inP).toFixed(3)})`
  } else clockWrap.style.opacity = '0'

  /* ---- the mark ---- */
  if (s.logo) drawLogo(lt, s.logo)
  else brand.style.opacity = '0'

  /* ---- the rule under a pillar term ---- */
  if (s.rule) {
    const g = seg(lt, 0.30, 1.05, EASE_OUT)
    const o = seg(lt, s.dur - 0.36, s.dur, EASE)
    rule.style.transform = `scaleX(${g.toFixed(4)})`
    rule.style.opacity = (g - o).toFixed(3)
    rule.hidden = false
  } else rule.hidden = true

  /* ---- scene ----
     One conveyor for everything on the stage: a scene rises through its
     own mask, holds, and carries on up and out. Same grammar as the type
     below it, which is what stops twelve sections reading as twelve
     unrelated slides. */
  for (const [name, m] of Object.entries(mounted)) {
    const active = s.scene === name
    m.host.style.opacity = active ? '1' : '0'
    if (active) m.scene.render(m.els, (s.from || 0) + lt)
  }
  if (s.scene) {
    const rise = seg(lt, 0.04, 0.70, EASE_OUT)
    const leave = seg(lt, s.dur - 0.40, s.dur, EASE)
    /* Never quite still: a slow drift under the whole band, small enough
       to read as breathing rather than as movement. */
    const drift = Math.sin(time * 0.6) * 5
    /* A few degrees of tilt coming out of the mask, so the band arrives
       through depth rather than straight up a flat plane. */
    sceneSlide.style.transform =
      `translateY(${(lerp(72, 0, rise) - leave * 54 + drift).toFixed(2)}px) ` +
      `scale(${lerp(0.965, 1, rise).toFixed(4)}) ` +
      `rotateX(${lerp(5.5, 0, rise).toFixed(2)}deg)`
    sceneSlide.style.opacity = (rise - leave).toFixed(3)
    sceneBox.style.opacity = '1'
    /* The bloom arrives after the scene does, so it reads as the thing
       lighting up rather than as a backdrop that was always on. */
    sceneGlow.style.opacity = (seg(lt, 0.34, 1.10, EASE_OUT) * (1 - leave) * 0.9).toFixed(3)

    const sw = seg(lt, 0.40, 1.42, EASE_IO)
    sceneSheen.style.transform = `translateX(${lerp(-135, 265, sw).toFixed(1)}%) skewX(-12deg)`
    sceneSheen.style.opacity = (sw > 0.004 && sw < 0.996 ? 1 - leave : 0).toFixed(3)
  } else {
    sceneBox.style.opacity = '0'
    sceneGlow.style.opacity = '0'
    sceneSheen.style.opacity = '0'
  }

  /* ---- type ---- */
  if (s !== lastSection) { writeType(s); lastSection = s }
  const outP = seg(lt, s.dur - 0.42, s.dur - 0.02, EASE)
  typeBox.style.opacity = (1 - outP).toFixed(3)
  typeBox.style.setProperty('--ty', '0px')

  /* Every word is a mask with a letter-height slot. It rises in on its
     own offset and keeps going on the way out — one direction of travel,
     never a fade. */
  for (const group of wordGroups) {
    for (let k = 0; k < group.words.length; k++) {
      const a = group.at + k * group.step
      const q = seg(lt, a, a + 0.74, EASE_OUT)
      const y = (1 - q) * 108 - outP * 112
      group.words[k].style.transform = `translateY(${y.toFixed(2)}%)`
    }
  }

  /* ---- the six marks ---- */
  paintDots(time)

  paintTransport(time, i)
}

/* Split a line into per-word masks and return the movers, so draw() has
   a flat list to push and never touches the DOM shape again. */
function words(host, text) {
  host.replaceChildren()
  const movers = []
  for (const w of String(text).split(' ')) {
    const mask = document.createElement('span')
    mask.className = 'w'
    const inner = document.createElement('i')
    inner.textContent = w
    mask.appendChild(inner)
    host.appendChild(mask)
    movers.push(inner)
  }
  return movers
}

/* Rebuilt only when the section changes. Each group carries its own
   start and its own step, because a kicker of two words and a headline
   of six should not arrive at the same rate. */
let wordGroups = []

function writeType(s) {
  typeBox.dataset.at = s.text || ''
  typeBox.hidden = !s.text
  wordGroups = []

  elKicker.hidden = !s.kicker
  if (s.kicker) wordGroups.push({ words: words(elKicker, s.kicker), at: 0.06, step: 0.035 })

  elHead.hidden = !s.head
  if (s.head) wordGroups.push({ words: words(elHead, s.head), at: 0.16, step: 0.062 })

  elLines.replaceChildren()
  elLines.hidden = !s.lines
  ;(s.lines || []).forEach((line, i) => {
    const p = document.createElement('p')
    p.className = 'tLine'
    elLines.appendChild(p)
    wordGroups.push({ words: words(p, line), at: 0.24 + i * 0.34, step: 0.05 })
  })

  elSub.hidden = !s.sub
  if (s.sub) wordGroups.push({ words: words(elSub, s.sub), at: 0.52, step: 0.028 })
}

/* ------------------------------------------------------------------
   Six marks under the band. Not decoration: during a montage of six
   near-identical beats, "which one is this" is the one thing the frame
   cannot otherwise say.
   ------------------------------------------------------------------ */
const SERVICES = SHOW.filter((s) => s.scene)
for (const _ of SERVICES) dotRow.appendChild(document.createElement('i'))

function paintDots(time) {
  let any = 0
  SERVICES.forEach((s, i) => {
    const on = seg(time, s.t0 - 0.22, s.t0 + 0.34, EASE) - seg(time, s.t1 - 0.22, s.t1 + 0.34, EASE)
    any = Math.max(any, on)
    const d = dotRow.children[i]
    d.style.width = `${lerp(26, 58, on).toFixed(1)}px`
    d.style.backgroundColor = on > 0.02
      ? `rgba(${C.amberRGB},${(0.15 + 0.85 * on).toFixed(3)})`
      : `rgba(${C.creamRGB},0.15)`
  })
  dotRow.style.opacity = any.toFixed(3)
}

/* ------------------------------------------------------------------
   Transport
   ------------------------------------------------------------------ */
const bar     = $('barFill')
const tcNow   = $('tcNow')
const tcTotal = $('tcTotal')
const promptNow  = $('promptNow')
const promptNext = $('promptNext')
const promptSec  = $('promptSec')

function paintTransport(time, i) {
  bar.style.width = `${((time / TOTAL) * 100).toFixed(2)}%`
  tcNow.textContent = fmt(time)
  const s = SHOW[i]
  promptSec.textContent = `${String(i + 1).padStart(2, '0')} / ${SHOW.length}  ·  ${s.id}  ·  ${camLabel(s)}`
  promptNow.textContent = s.say
  promptNext.textContent = SHOW[i + 1] ? SHOW[i + 1].say : '—'
  for (const chip of chips) chip.classList.toggle('is-on', +chip.dataset.i === i)
}

const camLabel = (s) => (!s.cam ? 'no camera' : s.cam === FULL ? 'camera full frame' : s.cam === HALF_T ? 'camera top half' : 'camera bottom half')
const fmt = (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}.${String(Math.floor((v % 1) * 10))}`

tcTotal.textContent = fmt(TOTAL)

/* Section chips, which double as the run of show. */
const chips = []
const chipRow = $('chips')
SHOW.forEach((s, i) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'chip'
  b.dataset.i = i
  b.style.flexGrow = String(s.dur)
  b.innerHTML = `<span class="chip__n">${String(i + 1).padStart(2, '0')}</span><span class="chip__id">${s.id}</span>`
  b.setAttribute('aria-label', `${s.id}, ${s.dur} seconds, ${camLabel(s)}`)
  b.addEventListener('click', () => seek(s.t0 + 0.01))
  chipRow.appendChild(b)
  chips.push(b)
})

function loop(now) {
  t = ((now - originAt) / 1000) * SPEED
  if (t >= TOTAL) { t = TOTAL; playing = false; raf = 0; draw(t); syncPlay(); return }
  draw(t)
  raf = requestAnimationFrame(loop)
}

function play() {
  if (playing) return
  if (t >= TOTAL - 0.01) t = 0
  originAt = performance.now() - (t / SPEED) * 1000
  playing = true
  raf = requestAnimationFrame(loop)
  syncPlay()
}
function pause() {
  playing = false
  if (raf) cancelAnimationFrame(raf), raf = 0
  syncPlay()
}
function seek(to) {
  t = clamp(to, 0, TOTAL)
  originAt = performance.now() - (t / SPEED) * 1000
  draw(t)
  if (!playing) syncPlay()
}
const syncPlay = () => {
  $('btnPlay').textContent = playing ? 'Pause' : 'Play'
  $('btnPlay').setAttribute('aria-pressed', String(playing))
}

/* ------------------------------------------------------------------
   Camera
   ------------------------------------------------------------------ */
async function goLive() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
      audio: false,
    })
    camVideo.srcObject = stream
    await camVideo.play()
    setCamMode('live')
    return true
  } catch (err) {
    setCamMode('key')
    note(err && err.name === 'NotAllowedError'
      ? 'Camera blocked. Staying on key colour — record the page and key it out in your editor.'
      : 'No camera available here. Staying on key colour.')
    return false
  }
}

function setCamMode(mode) {
  camMode = mode
  camBox.dataset.mode = mode   // the stylesheet shows exactly one of the two
  for (const b of document.querySelectorAll('[data-cam]')) {
    b.setAttribute('aria-pressed', String(b.dataset.cam === mode))
  }
}

function note(msg) {
  const el = $('note')
  el.textContent = msg
  el.hidden = !msg
}

/* ------------------------------------------------------------------
   Fit the stage to whatever space it has
   ------------------------------------------------------------------ */
function fit() {
  const box = stage.parentElement.getBoundingClientRect()
  const scale = Math.min(box.width / STAGE_W, box.height / STAGE_H)
  const ox = (box.width  - STAGE_W * scale) / 2
  const oy = (box.height - STAGE_H * scale) / 2
  stage.style.transform = `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px) scale(${scale})`
}
new ResizeObserver(fit).observe(stage.parentElement)

/* ------------------------------------------------------------------
   Wiring
   ------------------------------------------------------------------ */
$('btnPlay').addEventListener('click', () => (playing ? pause() : play()))
$('btnRestart').addEventListener('click', () => { seek(0); play() })
function setGuides(on) {
  showGuides = on
  guides.hidden = !on
  document.body.classList.toggle('no-guides', !on)
  $('btnGuides').setAttribute('aria-pressed', String(on))
}
$('btnGuides').addEventListener('click', () => setGuides(!showGuides))
$('btnMirror').addEventListener('click', () => {
  mirror = !mirror
  camVideo.style.transform = mirror ? 'scaleX(-1)' : 'none'
  $('btnMirror').setAttribute('aria-pressed', String(mirror))
})
for (const b of document.querySelectorAll('[data-cam]')) {
  b.addEventListener('click', () => {
    if (b.dataset.cam === 'live') goLive()
    else { note(''); setCamMode(b.dataset.cam) }
  })
}
$('btnText').addEventListener('click', () => {
  const off = document.body.classList.toggle('no-text')
  $('btnText').setAttribute('aria-pressed', String(!off))
})
for (const b of document.querySelectorAll('[data-speed]')) {
  b.addEventListener('click', () => {
    const at = t
    SPEED = parseFloat(b.dataset.speed)
    $('speedNow').textContent = `${SPEED}x`
    for (const o of document.querySelectorAll('[data-speed]')) {
      o.setAttribute('aria-pressed', String(+o.dataset.speed === SPEED))
    }
    seek(at)
  })
}
$('btnFull').addEventListener('click', () => {
  document.body.classList.toggle('is-clean')
  fit()
})

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return
  const k = e.key.toLowerCase()
  if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play() }
  else if (k === 'arrowleft')  { e.preventDefault(); pause(); seek(t - (e.shiftKey ? 5 : 1)) }
  else if (k === 'arrowright') { e.preventDefault(); pause(); seek(t + (e.shiftKey ? 5 : 1)) }
  else if (k === 'r') { seek(0); play() }
  else if (k === 'g') $('btnGuides').click()
  else if (k === 'f') $('btnFull').click()
  else if (k === 'm') $('btnMirror').click()
})

$('bar').addEventListener('pointerdown', function scrub(e) {
  const move = (ev) => {
    const r = this.getBoundingClientRect()
    seek(((ev.clientX - r.left) / r.width) * TOTAL)
  }
  pause(); move(e)
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up) }
  addEventListener('pointermove', move)
  addEventListener('pointerup', up)
})

/* ------------------------------------------------------------------
   Guides — drawn from SAFE so they cannot drift from the constant
   ------------------------------------------------------------------ */
guides.style.setProperty('--safe-top', `${SAFE.top}px`)
guides.style.setProperty('--safe-bottom', `${SAFE.bottom}px`)
guides.style.setProperty('--safe-left', `${SAFE.left}px`)
guides.style.setProperty('--safe-right', `${SAFE.right}px`)

/* ------------------------------------------------------------------
   Script, written out so it can be read away from the screen
   ------------------------------------------------------------------ */
const sheet = $('sheet')
SHOW.forEach((s, i) => {
  const row = document.createElement('div')
  row.className = 'row'
  row.innerHTML =
    `<span class="row__t">${fmt(s.t0)}</span>` +
    `<span class="row__cam" data-on="${s.on}">${camLabel(s)}</span>` +
    `<span class="row__say"></span>`
  row.querySelector('.row__say').textContent = s.say
  row.addEventListener('click', () => seek(s.t0 + 0.01))
  sheet.appendChild(row)
})

/* A handle on the timeline, for driving this from a test or a capture
   script rather than by hand. Everything here already exists; nothing
   is computed differently because it is exposed. */
window.reel = { seek, play, pause, draw, SHOW, TOTAL, get t() { return t } }

/* ------------------------------------------------------------------
   Opening state from the URL.

   This exists for OBS. A Browser Source cannot press buttons, and a
   1080x1920 source that comes up showing the control panel and the
   safe-zone guides is not a recording surface. So:

     reel.html?clean=1&guides=0&cam=key&play=1

   comes up as nothing but the stage, at exactly 1:1, ready to capture.
   ------------------------------------------------------------------ */
const q = new URLSearchParams(location.search)

/* ?speed=0.5 halves the timeline. ?fluid=1 adds live rotation and skew
   to the card — both cost ~28fps, because rotating or skewing a box that
   also resizes every frame has to be re-rasterised rather than
   composited. 22.8fps measured, so it wants ?speed=0.25 (91 effective),
   not 0.5 (46). The labels rotate unconditionally because they are small
   enough not to matter. */
const FLUID = q.get('fluid') !== null && q.get('fluid') !== '0'
const flag = (k) => { const v = q.get(k); return v !== null && v !== '0' && v !== 'false' }

const wanted = parseFloat(q.get('speed'))
if (Number.isFinite(wanted) && wanted > 0.05 && wanted <= 4) SPEED = wanted
$('speedNow').textContent = `${SPEED}x`

if (flag('clean')) document.body.classList.add('is-clean')
setGuides(q.get('guides') === null ? true : flag('guides'))
setCamMode(['live', 'key', 'off'].includes(q.get('cam')) ? q.get('cam') : 'key')
if (camMode === 'live') goLive()

fit()
draw(0)
syncPlay()
if (flag('play')) play()
