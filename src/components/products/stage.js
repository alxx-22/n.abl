/* ============================================================
   THE PRODUCT STAGE — each product, doing its job, beside its words

   Two layouts, one story (sections/Products.jsx, styles/products.css).

   WIDE (desktop): one sticky layer the height of the screen sits over the
   product chapters. In it, one box per product on the product's own side,
   each holding that product's animation (the scenes in film/cards.js);
   the words scroll past on the other side. Scroll is turned into one
   number, u: 0 at the start of the first product, 1 at the start of the
   second, and so on. From u alone:
   - the product being read plays its animation, scrubbed by the scroll;
   - between two products the animation folds into the amber square (the
     full stop, holding the light), the square drops down the screen,
     across the page if the next product sits on the other side, and the
     next product blooms out of it;
   - under a mouse the box leans towards the pointer, with a very soft wide
     light where the pointer is and a little shade on the far side.
   The frame eases towards the scroll position, so a wheel's steps read as
   one movement.

   NARROW (phones): each product's animation sits in the page above its
   words. It plays as it passes up the screen, blooms out of the square as
   it arrives and folds back into it as it leaves at the top; the square
   then runs down the left edge of the screen and lands where the next
   product blooms. The same story, without pinning anything over the words.

   Either way the loop stops when nothing is moving and only runs while the
   chapters are near the screen. With reduced motion there is no scrubbing,
   no hand-over and no lean: each product shows the outcome of its
   animation.
   ============================================================ */

/* wide: half the width of a hand-over, in products */
const W = 0.14
/* the card scenes fade themselves in and out at the ends of their loop;
   the scrub keeps inside that, because the hand-over does the fading here */
const T_IN = 0.45, T_END = 0.55

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const ss = (x) => x * x * (3 - 2 * x)
const seg = (x, a, b) => clamp01((x - a) / (b - a))
const lerp = (a, b, t) => a + (b - a) * t

export function createProductStage({ track, stage, items, reduced = false, narrow = false }) {
  const N = items.length
  const arts = [...track.querySelectorAll('.product')]
  /* the boxes the animations live in, and the element each one moves */
  const boxes = narrow ? arts.map((a) => a.querySelector('.product__visual')) : [...stage.querySelectorAll('.pv')]
  const fxs = boxes.map((b) => (narrow ? b.querySelector('.pv__tilt') : b))
  const tilts = boxes.map((b) => b.querySelector('.pv__tilt'))
  const hosts = boxes.map((b) => b.querySelector('.pv__host'))
  const seed = stage.querySelector('.pv__seed')
  const trail = stage.querySelector('.pv__trail path')
  const count = stage.querySelector('.pv__count')
  const bars = [...stage.querySelectorAll('.pv__count i')]
  const COARSE = window.matchMedia('(pointer: coarse)').matches
  let RM = reduced

  /* ---------- the scenes: built just before they are needed, kept once built ---------- */
  const handles = new Array(N).fill(null)
  const lastT = new Array(N).fill(-1)
  const ensure = (i) => {
    if (i < 0 || i >= N || handles[i]) return
    handles[i] = items[i].scene.mount(hosts[i])
  }
  const scrub = (i, p) => {
    const h = handles[i]
    if (!h) return
    const dur = items[i].scene.dur
    const t = RM ? dur * 0.8 : lerp(T_IN, dur - T_END, p)
    if (Math.abs(t - lastT[i]) > 0.002) { lastT[i] = t; h.render(t) }
  }
  /* shown or not; the scenes set visibility on their own pieces, and a piece
     set visible shows through a hidden parent, so opacity hides it all */
  const showBox = (i, show) => {
    const f = fxs[i]
    if (f._show === show) return
    f._show = show
    f.style.visibility = show ? 'visible' : 'hidden'
    if (!show) f.style.opacity = '0'
  }
  const place = (i, vis, k, dy, blur) => {
    const f = fxs[i]
    f.style.opacity = (vis * vis * (3 - 2 * vis)).toFixed(3)
    f.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0) scale(${k.toFixed(4)})`
    f.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : 'none'
  }

  /* ---------- the pointer: lean, a wide soft light, a little shade ---------- */
  const lean = boxes.map(() => ({ x: 0, y: 0, a: 0, tx: 0, ty: 0, ta: 0 }))
  const onMove = (e) => {
    if (e.pointerType === 'touch') return
    const i = boxes.indexOf(e.currentTarget)
    const r = e.currentTarget.getBoundingClientRect()
    lean[i].tx = ((e.clientX - r.left) / r.width) * 2 - 1
    lean[i].ty = ((e.clientY - r.top) / r.height) * 2 - 1
    lean[i].ta = 1
    kick()
  }
  const onLeave = (e) => { const i = boxes.indexOf(e.currentTarget); lean[i].tx = 0; lean[i].ty = 0; lean[i].ta = 0; kick() }
  boxes.forEach((b) => { b.addEventListener('pointermove', onMove); b.addEventListener('pointerleave', onLeave) })
  /* returns whether the lean is still settling */
  const leanTo = (i, dt, tiltIt) => {
    const L = lean[i], t = tilts[i]
    const e = 1 - Math.exp(-dt * 6)
    L.x += (L.tx - L.x) * e; L.y += (L.ty - L.y) * e; L.a += (L.ta - L.a) * (1 - Math.exp(-dt * 4))
    if (tiltIt) t.style.transform = `perspective(1400px) rotateX(${(-L.y * 5).toFixed(2)}deg) rotateY(${(L.x * 7).toFixed(2)}deg) translate3d(${(L.x * 6).toFixed(1)}px, ${(L.y * 5).toFixed(1)}px, 0)`
    t.style.setProperty('--gx', `${(50 + L.x * 50).toFixed(1)}%`)
    t.style.setProperty('--gy', `${(50 + L.y * 50).toFixed(1)}%`)
    t.style.setProperty('--ga', L.a.toFixed(3))
    t.style.setProperty('--sh', `${(Math.atan2(L.y, L.x) * 57.3 + 180).toFixed(0)}deg`)
    return Math.abs(L.tx - L.x) + Math.abs(L.ty - L.y) + Math.abs(L.ta - L.a) > 0.002
  }

  /* ---------- the square and its trail ---------- */
  let pathLen = 1, pathD = ''
  function drawPath(P) {
    const d = P.map((c, j) => `${j ? '' : `M${c[0][0].toFixed(1)} ${c[0][1].toFixed(1)}`}C${c[1][0].toFixed(1)} ${c[1][1].toFixed(1)} ${c[2][0].toFixed(1)} ${c[2][1].toFixed(1)} ${c[3][0].toFixed(1)} ${c[3][1].toFixed(1)}`).join('')
    if (d !== pathD) { pathD = d; trail.setAttribute('d', d); pathLen = trail.getTotalLength() || 1 }
  }
  function showSeed(P, pres, pos) {
    drawPath(P)
    /* by distance along the drawn path, so the square keeps an even speed
       however long each piece of the path is */
    const pt = trail.getPointAtLength(pos * pathLen), x = pt.x, y = pt.y
    seed.style.opacity = pres.toFixed(3)
    seed.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    const tail = pathLen * 0.32, at = pos * pathLen
    trail.style.strokeDasharray = `${tail.toFixed(1)} ${(pathLen * 2).toFixed(1)}`
    trail.style.strokeDashoffset = (-(at - tail)).toFixed(1)
    trail.style.opacity = (pres * 0.85).toFixed(3)
    seed._on = true
  }
  function hideSeed() {
    if (!seed._on) return
    seed._on = false
    seed.style.opacity = '0'
    trail.style.opacity = '0'
  }

  /* ============================================================
     WIDE
     ============================================================ */
  let starts = [], ends = [], vh = window.innerHeight, sh = 1, centres = [], drop = 0
  function measureWide() {
    vh = window.innerHeight
    starts = arts.map((a) => a.getBoundingClientRect().top + window.scrollY)
    ends = arts.map((a, i) => (i < N - 1 ? starts[i + 1] : starts[i] + a.offsetHeight))
    sh = stage.clientHeight
    /* Offsets, not bounding boxes: the boxes are mid-animation, scaled. Each
       box is placed by its top edge at 50% and pulled up by half its height
       with CSS translate, which offsets do not include: its centre is its
       offset top. */
    centres = boxes.map((p) => [p.offsetLeft + p.offsetWidth / 2, p.offsetTop])
    drop = Math.min(sh * 0.3, 260)
    pathFor = -2
  }
  function storyAt(y) {
    if (!starts.length) return -1
    const probe = y + vh * 0.5
    if (probe < starts[0]) return (probe - starts[0]) / Math.max(1, ends[0] - starts[0])
    for (let i = 0; i < N; i++) {
      if (probe < ends[i] || i === N - 1) return i + (probe - starts[i]) / Math.max(1, ends[i] - starts[i])
    }
    return N
  }
  let pathFor = -2, P = null
  function wavePath(b) {
    if (pathFor === b) return P
    pathFor = b
    // where the square leaves and lands; above the screen before the first, below it after the last
    const B = b < N ? centres[b] : [centres[N - 1][0], sh + 60]
    const A = b > 0 ? centres[b - 1] : [B[0], -60]
    if (b === 0 || b === N) {
      P = [[A, [A[0], A[1] + (B[1] - A[1]) * 0.33], [B[0], A[1] + (B[1] - A[1]) * 0.66], B]]
    } else {
      const low = Math.max(A[1], B[1]) + drop
      const mx = (A[0] + B[0]) / 2
      const k = (low - Math.min(A[1], B[1])) * 0.55
      const dx = (B[0] - A[0]) * 0.3
      P = [
        [A, [A[0], A[1] + k], [mx - dx, low], [mx, low]],
        [[mx, low], [mx + dx, low], [B[0], B[1] + k], B],
      ]
    }
    return P
  }

  let u = null, active = -1
  function renderWide(dt) {
    const target = storyAt(window.scrollY)
    if (u == null || RM) u = target
    else u += (target - u) * (1 - Math.exp(-dt * 7))
    if (Math.abs(target - u) < 0.0004) u = target
    let busy = u !== target
    const live = !RM
    /* the product being read: the one whose words the middle of the screen is in */
    const cur = Math.max(0, Math.min(N - 1, Math.floor(u)))
    for (let i = cur - 1; i <= cur + 2; i++) ensure(i)

    for (let i = 0; i < N; i++) {
      let vis, k = 1, dy = 0, blur = 0
      if (!live) vis = i === cur ? 1 : 0
      else {
        const bloom = ss(seg(seg(u, i - W, i + W), 0.58, 1))
        const fold = ss(seg(seg(u, i + 1 - W, i + 1 + W), 0, 0.42))
        vis = bloom * (1 - fold)
        k = lerp(0.16, 1, bloom) * lerp(1, 0.16, fold)
        dy = (1 - bloom) * drop + fold * drop * 0.25
        blur = COARSE ? 0 : (1 - bloom) * 10 + fold * 10
      }
      const show = vis > 0.002
      showBox(i, show)
      if (!show) continue
      place(i, vis, k, dy, blur)
      if (live && leanTo(i, dt, true)) busy = true
      scrub(i, seg(u, i + W * 0.6, i + 1 - W * 0.6))
    }

    const b = Math.round(u)
    const tau = seg(u, b - W, b + W)
    if (live && b >= 0 && b <= N && tau > 0 && tau < 1) {
      showSeed(wavePath(b), ss(seg(tau, 0.1, 0.3)) * (1 - ss(seg(tau, 0.72, 0.9))), ss(seg(tau, 0.2, 0.8)))
    } else hideSeed()

    if (cur !== active) {
      active = cur
      bars.forEach((el, j) => el.classList.toggle('on', j === active))
      count.dataset.side = items[active].side
    }
    return busy
  }

  /* ============================================================
     NARROW
     ============================================================ */
  function renderNarrow(dt) {
    vh = window.innerHeight
    const live = !RM
    let busy = false
    /* where each animation's centre is on the screen (s: 0 at the top, 1 at
       the bottom), and in the overlay the square is drawn in (at) */
    const st = stage.getBoundingClientRect()
    const rects = boxes.map((b) => b.getBoundingClientRect())
    const s = rects.map((r) => (r.top + r.height / 2) / vh)
    const at = rects.map((r) => [r.left + r.width / 2 - st.left, r.top + r.height / 2 - st.top])

    for (let i = 0; i < N; i++) {
      // a box anywhere near the screen gets its scene built
      if (s[i] > -0.6 && s[i] < 1.8) ensure(i)
      let vis = 1, k = 1, blur = 0
      if (live) {
        const bloom = i === 0 ? ss(seg(s[i], 1.05, 0.7)) : ss(seg(s[i], 0.78, 0.5))
        const fold = i === N - 1 ? 0 : ss(seg(s[i], 0.2, -0.05))
        vis = bloom * (1 - fold)
        k = lerp(0.16, 1, bloom) * lerp(1, 0.16, fold)
        blur = COARSE ? 0 : (1 - bloom) * 8 + fold * 8
      }
      const show = vis > 0.002
      showBox(i, show)
      if (!show) continue
      place(i, vis, k, 0, blur)
      // the box itself is what blooms and folds here, so it does not also lean
      if (live && leanTo(i, dt, false)) busy = true
      scrub(i, seg(s[i], 0.78, 0.05))
    }

    /* The square: from the box folding at the top, out to the left edge, down
       it beside the words (and behind them), and in to the box blooming
       below. It belongs to whichever pair is mid-way. */
    let shown = false
    if (live) {
      const gx = 7
      for (let i = 0; i < N - 1 && !shown; i++) {
        // from the moment box i starts to fold to the moment box i + 1 starts to bloom
        const a0 = 0.2, b0 = 0.74
        const ki = (a0 - s[i]) / Math.max(1e-3, (a0 - s[i]) + (s[i + 1] - b0))
        if (s[i] > a0 || s[i + 1] < b0 - 0.02) continue
        const k = clamp01(ki)
        const A = at[i], B = at[i + 1]
        const h = Math.min(140, Math.max(40, (B[1] - A[1]) * 0.18))
        const G1 = [gx, A[1] + h], G2 = [gx, B[1] - h]
        const P2 = [
          [A, [A[0], A[1] + h * 0.7], [gx, A[1] + h * 0.3], G1],
          [G1, [gx, lerp(G1[1], G2[1], 0.33)], [gx, lerp(G1[1], G2[1], 0.66)], G2],
          [G2, [gx, B[1] - h * 0.3], [B[0], B[1] - h * 0.7], B],
        ]
        const pres = ss(seg(k, 0, 0.12)) * (1 - ss(seg(k, 0.9, 1)))
        if (pres > 0.002) { showSeed(P2, pres, ss(k)); shown = true }
      }
    }
    if (!shown) hideSeed()
    return busy
  }

  /* ---------- the loop ---------- */
  let raf = 0, last = 0, alive = true, near = false
  function frame(now) {
    raf = 0
    if (!alive) return
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
    last = now
    let busy = false
    try { busy = narrow ? renderNarrow(dt) : renderWide(dt) } catch (err) { if (!frame.warned) { frame.warned = true; console.warn(err) } }
    if (near && busy) raf = requestAnimationFrame(frame)
  }
  function kick() {
    if (raf || !alive || !near) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  /* only while the chapters are anywhere near the screen */
  const io = new IntersectionObserver(([e]) => {
    near = e.isIntersecting
    if (near) kick()
    else if (raf) { cancelAnimationFrame(raf); raf = 0 }
  }, { rootMargin: '60% 0px 60% 0px' })
  io.observe(track)

  let rt = 0
  const relayout = () => { clearTimeout(rt); rt = setTimeout(() => { if (!narrow) measureWide(); kick() }, 100) }
  const ro = new ResizeObserver(relayout)
  ro.observe(track)
  ro.observe(stage)
  window.addEventListener('scroll', kick, { passive: true })
  window.addEventListener('resize', relayout)

  if (!narrow) measureWide()
  ensure(0); ensure(1)
  kick()

  return {
    setReduced(r) { RM = !!r; lastT.fill(-1); kick() },
    destroy() {
      alive = false
      if (raf) cancelAnimationFrame(raf)
      clearTimeout(rt)
      io.disconnect(); ro.disconnect()
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', relayout)
      boxes.forEach((b) => { b.removeEventListener('pointermove', onMove); b.removeEventListener('pointerleave', onLeave) })
      handles.forEach((h) => h && h.destroy())
      fxs.forEach((f) => { f.style.cssText = '' })
      hideSeed()
    },
  }
}
