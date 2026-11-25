/* ============================================================
   THE PRODUCT STAGE — each product, doing its job, beside its words

   One sticky layer the height of the screen sits over the product
   chapters (sections/Products.jsx). In it, one box per product, on the
   product's own side, each holding that product's animation (the scenes
   in film/cards.js). The words scroll past on the other side.

   Scroll is turned into one number, u: 0 at the start of the first
   product, 1 at the start of the second, and so on. From u alone:

   - The product being read plays its animation, scrubbed by the scroll:
     reading forward plays it forward, scrolling back plays it back.
   - Between two products the animation hands over. The one being left
     folds down into the amber square (the full stop, holding the light),
     the square drops down the screen, across the page if the next product
     sits on the other side, and the next product blooms out of it.
   - Under a mouse the box leans towards the pointer, with a very soft
     light where the pointer is and a little shade on the far side.

   The frame eases towards the scroll position rather than jumping to it,
   so a wheel's steps read as one movement. When nothing is moving the
   loop stops, and it only runs while the chapters are near the screen.

   With reduced motion there is no scrubbing, no hand-over and no lean:
   each product shows the outcome of its animation, and changes as its
   words arrive.
   ============================================================ */

/* half the width of a hand-over, in products: the last 14% of one and the
   first 14% of the next */
const W = 0.14
/* the card scenes fade themselves in and out at the ends of their loop;
   the scrub keeps inside that, because the hand-over does the fading here */
const T_IN = 0.45, T_END = 0.55

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const ss = (x) => x * x * (3 - 2 * x)
const seg = (x, a, b) => clamp01((x - a) / (b - a))
const lerp = (a, b, t) => a + (b - a) * t

/* a point on a cubic, and the path the square travels: down from where it
   leaves, through a low point between the two, and up into where it lands */
const cub = (a, b, c, d, t) => {
  const m = 1 - t
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d
}

export function createProductStage({ track, stage, items, reduced = false }) {
  const N = items.length
  const pvs = [...stage.querySelectorAll('.pv')]
  const hosts = pvs.map((p) => p.querySelector('.pv__host'))
  const tilts = pvs.map((p) => p.querySelector('.pv__tilt'))
  const arts = [...track.querySelectorAll('.product')]
  const seed = stage.querySelector('.pv__seed')
  const trail = stage.querySelector('.pv__trail path')
  const count = stage.querySelector('.pv__count')
  const bars = [...stage.querySelectorAll('.pv__count i')]
  const NARROW = window.matchMedia('(max-width: 980px)')
  const COARSE = window.matchMedia('(pointer: coarse)').matches
  let RM = reduced

  /* ---------- layout ---------- */
  let starts = [], ends = [], vh = window.innerHeight, sw = 1, sh = 1, centres = [], drop = 0
  function measure() {
    vh = window.innerHeight
    starts = arts.map((a) => a.getBoundingClientRect().top + window.scrollY)
    ends = arts.map((a, i) => (i < N - 1 ? starts[i + 1] : starts[i] + a.offsetHeight))
    sw = stage.clientWidth; sh = stage.clientHeight
    /* Offsets, not bounding boxes: the boxes are mid-animation, scaled.
       Each box is placed by its top edge at 50% and pulled up by half its
       height with CSS translate (on a narrow screen, left by half its width
       too), which offsets do not include: so its centre is its offset top,
       and on a narrow screen its offset left. */
    const narrow = NARROW.matches
    centres = pvs.map((p) => [p.offsetLeft + (narrow ? 0 : p.offsetWidth / 2), p.offsetTop])
    drop = Math.min(sh * 0.3, 260)
    pathFor = -2
  }

  /* where the reader is: u, from the middle of the screen */
  function storyAt(y) {
    if (!starts.length) return -1
    const probe = y + vh * 0.5
    if (probe < starts[0]) return (probe - starts[0]) / Math.max(1, ends[0] - starts[0])
    for (let i = 0; i < N; i++) {
      if (probe < ends[i] || i === N - 1) return i + (probe - starts[i]) / Math.max(1, ends[i] - starts[i])
    }
    return N
  }

  /* ---------- the scenes: built just before they are needed, kept once built ---------- */
  const handles = new Array(N).fill(null)
  const lastT = new Array(N).fill(-1)
  function ensure(i) {
    if (i < 0 || i >= N || handles[i]) return
    handles[i] = items[i].scene.mount(hosts[i])
  }

  /* ---------- the hand-over path ---------- */
  let pathFor = -2, P = null, pathLen = 1
  function setPath(b) {
    if (pathFor === b) return
    pathFor = b
    // where the square leaves from and lands; above the screen before the
    // first product, below it after the last
    const B = b < N ? centres[b] : [centres[N - 1][0], sh + 60]
    const A = b > 0 ? centres[b - 1] : [B[0], -60]
    const low = Math.max(A[1], B[1]) + drop
    const mx = (A[0] + B[0]) / 2
    const k = (low - Math.min(A[1], B[1])) * 0.55
    const dx = (B[0] - A[0]) * 0.3
    if (b === 0 || b === N) {
      // in from above, or away below: a straight fall
      P = [[A, [A[0], A[1] + (B[1] - A[1]) * 0.33], [B[0], A[1] + (B[1] - A[1]) * 0.66], B]]
    } else {
      P = [
        [A, [A[0], A[1] + k], [mx - dx, low], [mx, low]],
        [[mx, low], [mx + dx, low], [B[0], B[1] + k], B],
      ]
    }
    const d = P.map((c, j) => `${j ? '' : `M${c[0][0].toFixed(1)} ${c[0][1].toFixed(1)}`}C${c[1][0].toFixed(1)} ${c[1][1].toFixed(1)} ${c[2][0].toFixed(1)} ${c[2][1].toFixed(1)} ${c[3][0].toFixed(1)} ${c[3][1].toFixed(1)}`).join('')
    trail.setAttribute('d', d)
    pathLen = trail.getTotalLength() || 1
  }
  function along(t) {
    const n = P.length, f = Math.min(n - 1e-6, t * n), j = Math.floor(f), q = f - j
    const c = P[j]
    return [cub(c[0][0], c[1][0], c[2][0], c[3][0], q), cub(c[0][1], c[1][1], c[2][1], c[3][1], q)]
  }

  /* ---------- the pointer: lean, a soft light, a little shade ---------- */
  const lean = pvs.map(() => ({ x: 0, y: 0, a: 0, tx: 0, ty: 0, ta: 0 }))
  const onMove = (e) => {
    if (e.pointerType === 'touch') return
    const i = pvs.indexOf(e.currentTarget)
    const r = e.currentTarget.getBoundingClientRect()
    lean[i].tx = ((e.clientX - r.left) / r.width) * 2 - 1
    lean[i].ty = ((e.clientY - r.top) / r.height) * 2 - 1
    lean[i].ta = 1
    kick()
  }
  const onLeave = (e) => { const i = pvs.indexOf(e.currentTarget); lean[i].tx = 0; lean[i].ty = 0; lean[i].ta = 0; kick() }
  pvs.forEach((p) => { p.addEventListener('pointermove', onMove); p.addEventListener('pointerleave', onLeave) })

  /* ---------- one frame ---------- */
  let u = null, raf = 0, last = 0, alive = true, near = false, active = -1
  function render(uu, dt) {
    let busy = false
    const live = !RM
    /* the product being read: the one whose words the middle of the screen is in */
    const cur = Math.max(0, Math.min(N - 1, Math.floor(uu)))
    for (let i = cur - 1; i <= cur + 2; i++) ensure(i)

    for (let i = 0; i < N; i++) {
      const pv = pvs[i]
      let vis, k = 1, dy = 0, blur = 0
      if (!live) {
        vis = i === cur ? 1 : 0
      } else {
        const bloom = ss(seg(seg(uu, i - W, i + W), 0.58, 1))
        const fold = ss(seg(seg(uu, i + 1 - W, i + 1 + W), 0, 0.42))
        vis = bloom * (1 - fold)
        k = lerp(0.16, 1, bloom) * lerp(1, 0.16, fold)
        dy = (1 - bloom) * drop + fold * drop * 0.25
        blur = COARSE ? 0 : (1 - bloom) * 10 + fold * 10
      }
      const show = vis > 0.002
      if (pv._show !== show) {
        pv._show = show
        pv.style.visibility = show ? 'visible' : 'hidden'
        /* the scenes set visibility on their own pieces, and a piece set
           visible shows through a hidden parent: opacity hides it all */
        if (!show) pv.style.opacity = '0'
      }
      if (!show) continue
      const L = lean[i]
      if (live) {
        const e = 1 - Math.exp(-dt * 6)
        L.x += (L.tx - L.x) * e; L.y += (L.ty - L.y) * e; L.a += (L.ta - L.a) * (1 - Math.exp(-dt * 4))
        if (Math.abs(L.tx - L.x) + Math.abs(L.ty - L.y) + Math.abs(L.ta - L.a) > 0.002) busy = true
      }
      pv.style.opacity = (vis * vis * (3 - 2 * vis)).toFixed(3)
      pv.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0) scale(${k.toFixed(4)})`
      pv.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : 'none'
      const t = tilts[i]
      if (live) {
        t.style.transform = `perspective(1400px) rotateX(${(-L.y * 5).toFixed(2)}deg) rotateY(${(L.x * 7).toFixed(2)}deg) translate3d(${(L.x * 6).toFixed(1)}px, ${(L.y * 5).toFixed(1)}px, 0)`
        t.style.setProperty('--gx', `${(50 + L.x * 50).toFixed(1)}%`)
        t.style.setProperty('--gy', `${(50 + L.y * 50).toFixed(1)}%`)
        t.style.setProperty('--ga', L.a.toFixed(3))
        t.style.setProperty('--sh', `${(Math.atan2(L.y, L.x) * 57.3 + 180).toFixed(0)}deg`)
      }
      // the animation itself, scrubbed by the reading of its words
      const h = handles[i]
      if (h) {
        const dur = items[i].scene.dur
        const p = live ? seg(uu, i + W * 0.6, i + 1 - W * 0.6) : 0.8
        const tt = live ? lerp(T_IN, dur - T_END, p) : dur * 0.8
        if (Math.abs(tt - lastT[i]) > 0.002) { lastT[i] = tt; h.render(tt) }
      }
    }

    // the square, carrying the light from one product to the next
    const b = Math.round(uu)
    const tau = seg(uu, b - W, b + W)
    const on = live && b >= 0 && b <= N && tau > 0 && tau < 1
    if (on) {
      setPath(b)
      const pres = ss(seg(tau, 0.1, 0.3)) * (1 - ss(seg(tau, 0.72, 0.9)))
      const pos = ss(seg(tau, 0.2, 0.8))
      const [x, y] = along(pos)
      seed.style.opacity = pres.toFixed(3)
      seed.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      const tail = pathLen * 0.32, at = pos * pathLen
      trail.style.strokeDasharray = `${tail.toFixed(1)} ${(pathLen * 2).toFixed(1)}`
      trail.style.strokeDashoffset = (-(at - tail)).toFixed(1)
      trail.style.opacity = (pres * 0.85).toFixed(3)
    } else if (seed._on) {
      seed.style.opacity = '0'
      trail.style.opacity = '0'
    }
    seed._on = on

    if (cur !== active) {
      active = cur
      bars.forEach((el, j) => el.classList.toggle('on', j === active))
      count.dataset.side = items[active].side
    }
    return busy
  }

  function frame(now) {
    raf = 0
    if (!alive) return
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
    last = now
    const target = storyAt(window.scrollY)
    if (u == null || RM) u = target
    else u += (target - u) * (1 - Math.exp(-dt * 7))
    if (Math.abs(target - u) < 0.0004) u = target
    let busy = false
    try { busy = render(u, dt) } catch (err) { if (!frame.warned) { frame.warned = true; console.warn(err) } }
    if (near && (busy || u !== target)) raf = requestAnimationFrame(frame)
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
  const relayout = () => { clearTimeout(rt); rt = setTimeout(() => { measure(); kick() }, 100) }
  const ro = new ResizeObserver(relayout)
  ro.observe(track)
  ro.observe(stage)
  window.addEventListener('scroll', kick, { passive: true })
  window.addEventListener('resize', relayout)

  measure()
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
      pvs.forEach((p) => { p.removeEventListener('pointermove', onMove); p.removeEventListener('pointerleave', onLeave) })
      handles.forEach((h) => h && h.destroy())
    },
  }
}
