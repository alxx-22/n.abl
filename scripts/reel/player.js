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

const STAGE_W = 1080, STAGE_H = 1920

/* Instagram's chrome, as margins. Nothing that carries meaning goes
   outside this: the profile row and caption stack over the bottom,
   the like/comment/share rail over the right. */
const SAFE = { top: 250, bottom: 480, left: 60, right: 120 }

/* Camera framings. Full-bleed horizontally in every case — a webcam
   inset with margins reads as a video call, not as a film. */
const FULL   = { x: 0, y: 0,   w: 1080, h: 1920 }
const HALF_B = { x: 0, y: 880, w: 1080, h: 1040 }
const HALF_T = { x: 0, y: 0,   w: 1080, h: 880  }

/* Where a scene sits when one is playing. 800x608 at 1000 wide is 760
   tall, which clears the bottom safe line by 60. */
const SCENE_RECT = { x: 40, y: 620, w: 1000, h: 760 }

const TRANS = 0.66          // seconds for the camera to travel between framings

/* ------------------------------------------------------------------
   THE RUN OF SHOW

   Timed for a 50-second read at roughly three words a second. The
   shape is from what currently works on Reels: a hook that lands
   inside three seconds, a complete visual change every four at the
   outside, and the whole thing sitting in the 45-60s band that
   rewards teaching rather than the 30-40s one that does not.

   `say` is what you say out loud. `head` is what appears on screen.
   They are deliberately not the same words — reading your own caption
   aloud is the tell of a video made from a script rather than by a
   person.
   ------------------------------------------------------------------ */
const SHOW = [
  { id: 'hook', dur: 4.0, cam: FULL, text: 'upper',
    kicker: null,
    head: 'A morning a week',
    say: 'Your team loses a morning a week to work a computer should be doing.' },

  { id: 'problem', dur: 5.2, cam: HALF_B, text: 'upper',
    kicker: 'WHERE IT GOES',
    lines: ['The same order, keyed twice.', 'Timesheets, chased.', "Last month's spreadsheet, rebuilt."],
    say: "Rekeying the same order twice. Chasing timesheets. Rebuilding last month's spreadsheet." },

  { id: 'title', dur: 2.2, cam: null, text: 'centre',
    kicker: 'n.abl',
    head: 'Six things we build',
    say: "Here's what we actually build." },

  { id: 'automation', dur: 3.8, cam: null, scene: 'automation', from: 5.4, text: 'above',
    kicker: '01 · AUTOMATION',
    head: 'Set up once, left running',
    say: 'Work that repeats — set up once, then left to run.' },

  { id: 'data', dur: 3.8, cam: null, scene: 'data', from: 5.6, text: 'above',
    kicker: '02 · DATA',
    head: 'Numbers you can decide from',
    say: 'Your data cleaned up, then reporting you can actually decide from.' },

  { id: 'web', dur: 3.8, cam: null, scene: 'web', from: 5.0, text: 'above',
    kicker: '03 · WEB',
    head: 'A site that does the work',
    say: 'A site that books, sells, and takes the payment.' },

  { id: 'mid', dur: 3.4, cam: HALF_T, text: 'under',
    kicker: null,
    head: 'None of it off the shelf',
    say: "None of it's off the shelf." },

  { id: 'ai', dur: 3.8, cam: null, scene: 'ai', from: 4.8, text: 'above',
    kicker: '04 · AI',
    head: 'The answer, and where it came from',
    say: 'Answers from your own documents — and where they came from.' },

  { id: 'software', dur: 3.8, cam: null, scene: 'software', from: 7.6, text: 'above',
    kicker: '05 · SOFTWARE',
    head: 'Checks built in, not remembered',
    say: 'Checks built into the process, not remembered.' },

  { id: 'training', dur: 3.8, cam: null, scene: 'training', from: 9.8, text: 'above',
    kicker: '06 · TRAINING',
    head: 'Your work, not the manual',
    say: 'Training on your actual work, not the manual.' },

  { id: 'how', dur: 6.0, cam: HALF_B, text: 'upper',
    kicker: 'HOW IT GOES',
    lines: ['Built.', 'Handed over.', 'Explained to your team.'],
    say: "We're in Nottingham. We build it, hand it over, and show your team how to run it." },

  { id: 'cta', dur: 6.4, cam: FULL, text: 'lower',
    kicker: null,
    head: 'nabl.agency',
    sub: "What's the job that shouldn't need a person?",
    say: "If there's a job in your week that shouldn't need a person — that's the one to send me." },
]

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
  typeBox.dataset.at = s.text
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
  t = (now - originAt) / 1000
  if (t >= TOTAL) { t = TOTAL; playing = false; raf = 0; draw(t); syncPlay(); return }
  draw(t)
  raf = requestAnimationFrame(loop)
}

function play() {
  if (playing) return
  if (t >= TOTAL - 0.01) t = 0
  originAt = performance.now() - t * 1000
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
  originAt = performance.now() - t * 1000
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
$('btnGuides').addEventListener('click', () => {
  showGuides = !showGuides
  guides.hidden = !showGuides
  $('btnGuides').setAttribute('aria-pressed', String(showGuides))
})
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

fit()
setCamMode('key')
draw(0)
syncPlay()
