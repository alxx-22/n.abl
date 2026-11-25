/* ============================================================
   THE LIT GROUND: what the light does at each point of the page

   Pure data and one function. engine.js draws a state; this file says
   which state belongs where. Ported from the approved reference demo,
   business/02-brand/reference/nabl-scroll-story.html, where every number
   here was tuned by eye and then measured (brand-guidelines.md, 3.4 and 7).

   A state is a flat object of numbers. The ground eases from whatever it
   is showing towards the state the scroll position asks for, every frame,
   so nothing here ever snaps.
   ============================================================ */

/* Eight soft glows on espresso. Each keeps its colour: 0-2 ember, 3-4
   amber, 5-7 ice. Every point in the story gives each one a place, a size
   and a strength, and scrolling carries them from one layout to the next. */
export const NG = 8
export const GCOL = ['#FF5A36', '#FF5A36', '#FF5A36', '#E9AC57', '#E9AC57', '#7CCBFF', '#7CCBFF', '#7CCBFF']
/* how far each glow trails a fast scroll (parallax) */
export const DEPTH = [1, 0.6, 0.85, 1.2, 0.7, 0.9, 0.55, 1.1]
/* each warm glow's place on the ember (0) to amber (1) scale; ice is -1 */
export const GWARM = [0.12, 0.3, 0.2, 0.78, 0.62, -1, -1, -1]

/* g f a: the weights of the wisps (grain gradient), the fluted glass and
   the aurora · fw: reed width in CSS px · tau spread cy: the aurora's
   temperature, mix and height · heat: how lively the wisps are · k:
   overall strength · drift: how much scrolling pans the texture · tone hp
   sat: tone mapping · pace: speed of the slow drift · shd: how much the
   light dims behind the words in view · vig: the fixed fade on the copy's
   side · vside: which side the copy is on, 0 left, 1 right */
const SK = ['g', 'f', 'a', 'fw', 'tau', 'spread', 'cy', 'heat', 'k', 'drift', 'tone', 'sat', 'hp', 'pace', 'shd', 'vig', 'vside']
const GK = []
for (let i = 0; i < NG; i++) GK.push(`g${i}x`, `g${i}y`, `g${i}r`, `g${i}a`)
export const KEYS = SK.concat(GK)

const S0 = { g: 1, f: 0, a: 0, fw: 26, tau: 0.3, spread: 0.6, cy: 0.55, heat: 0.3, k: 1, drift: 1, tone: 0.45, sat: 1, hp: 0, pace: 1, shd: 1, vig: 0, vside: 0 }
for (let i = 0; i < NG; i++) Object.assign(S0, { [`g${i}x`]: 0.5, [`g${i}y`]: 0.5, [`g${i}r`]: 0.2, [`g${i}a`]: 0 })

const lay = (rows) => {
  const o = {}
  rows.forEach((r, i) => { o[`g${i}x`] = r[0]; o[`g${i}y`] = r[1]; o[`g${i}r`] = r[2]; o[`g${i}a`] = r[3] })
  return o
}
const mk = (o, rows) => Object.assign({}, S0, rows ? lay(rows) : null, o)
const dim = (rows, f) => rows.map((r) => [r[0], r[1], r[2], r[3] * f])
/* the same layout for copy on the right: the light moves to the other side */
const mirror = (rows) => rows.map((r) => [1 - r[0], r[1], r[2], r[3]])

/* Layouts: [x 0 left..1 right, y 0 bottom..1 top, radius in screen
   heights, strength] for ember, ember, ember, amber, amber, ice, ice, ice.
   Mostly dark, and kept off the side the words sit on. */
const L = {
  hero:    [[0.86, 0.16, 0.33, 0.7], [0.24, 0.97, 0.2, 0.55], [0.16, 0.04, 0.27, 0.62], [0.75, 0.52, 0.11, 0.55], [1.03, 0.66, 0.14, 0.36], [0.97, 0.92, 0.28, 0.65], [0.02, 0.55, 0.2, 0.45], [1.1, 0.32, 0.2, 0.42]],
  heat1:   [[0.82, 0.28, 0.23, 0.62], [0.46, 1.0, 0.17, 0.48], [0.18, 0.03, 0.22, 0.56], [0.68, 0.56, 0.11, 0.46], [0.99, 0.72, 0.11, 0.28], [1.03, 0.95, 0.22, 0.5], [0.01, 0.64, 0.16, 0.36], [1.1, 0.3, 0.16, 0.32]],
  heat2:   [[0.78, 0.3, 0.22, 0.62], [0.5, 1.0, 0.18, 0.5], [0.2, 0.02, 0.22, 0.58], [0.66, 0.58, 0.12, 0.5], [1.0, 0.1, 0.12, 0.3], [1.02, 0.96, 0.22, 0.48], [0.0, 0.66, 0.16, 0.34], [1.1, 0.5, 0.15, 0.3]],
  fix1:    [[0.86, 0.22, 0.27, 0.6], [0.12, 0.97, 0.17, 0.46], [0.2, 0.02, 0.24, 0.48], [0.74, 0.56, 0.16, 0.7], [0.95, 0.8, 0.12, 0.4], [1.0, 0.97, 0.23, 0.55], [0.02, 0.4, 0.19, 0.48], [1.08, 0.42, 0.19, 0.48]],
  fix2:    [[0.91, 0.1, 0.25, 0.5], [0.3, 0.98, 0.15, 0.4], [0.08, 0.01, 0.22, 0.4], [0.7, 0.46, 0.14, 0.6], [0.88, 0.87, 0.12, 0.4], [0.98, 0.7, 0.27, 0.65], [0.02, 0.5, 0.2, 0.58], [1.06, 0.29, 0.21, 0.55]],
  fix3:    [[0.95, 0.06, 0.21, 0.4], [0.36, 0.99, 0.13, 0.3], [0.1, 0.0, 0.2, 0.32], [0.68, 0.5, 0.12, 0.52], [0.84, 0.91, 0.1, 0.36], [0.92, 0.64, 0.29, 0.7], [0.02, 0.36, 0.24, 0.66], [1.04, 0.35, 0.22, 0.65]],
  cards:   [[0.66, 0.66, 0.24, 0.52], [0.79, 0.29, 0.19, 0.38], [0.42, 0.08, 0.19, 0.24], [0.56, 0.87, 0.09, 0.32], [0.91, 0.9, 0.09, 0.24], [0.14, 0.7, 0.24, 0.48], [0.97, 0.54, 0.2, 0.42], [0.3, 0.19, 0.15, 0.28]],
  step1:   [[0.7, 0.6, 0.24, 0.48], [0.86, 0.24, 0.17, 0.34], [0.46, 0.05, 0.19, 0.24], [0.6, 0.84, 0.11, 0.38], [0.93, 0.86, 0.09, 0.28], [0.18, 0.66, 0.22, 0.44], [0.98, 0.5, 0.19, 0.42], [0.34, 0.15, 0.15, 0.28]],
  step2:   [[0.74, 0.56, 0.22, 0.44], [0.9, 0.2, 0.15, 0.28], [0.5, 0.02, 0.17, 0.2], [0.64, 0.8, 0.13, 0.42], [0.95, 0.84, 0.09, 0.32], [0.22, 0.62, 0.24, 0.48], [0.98, 0.44, 0.2, 0.48], [0.38, 0.12, 0.17, 0.32]],
  pricing: [[0.9, 0.2, 0.2, 0.32], [0.08, 0.1, 0.14, 0.14], [0.5, -0.16, 0.2, 0.12], [0.8, 0.76, 0.11, 0.28], [0.2, 0.92, 0.08, 0.14], [0.12, 0.86, 0.2, 0.32], [0.97, 0.55, 0.15, 0.2], [0.6, 1.05, 0.14, 0.16]],
  contact: [[0.12, 0.2, 0.22, 0.27], [0.03, 0.7, 0.12, 0.17], [0.28, 0.99, 0.11, 0.14], [0.5, -0.12, 0.27, 0.33], [0.82, 0.07, 0.13, 0.19], [0.9, 0.83, 0.24, 0.33], [0.99, 0.4, 0.18, 0.25], [0.62, 1.06, 0.16, 0.17]],
}

/* The opening: the wisps drift at their normal pace and scrolling moves
   them on; a light fade on the copy's side keeps it clear, and the layout
   puts colour above and below it. */
const CALM = { drift: 0.22, pace: 1, shd: 0, vig: 0.2, tone: 0.45, hp: 0.3, sat: 1, k: 1, heat: 0.3 }

export const ST = {
  hero: mk(CALM, L.hero),
  heatStart: mk({ ...CALM, heat: 0.35 }, L.heat1),
  heatPeak: mk({ ...CALM, heat: 0.5 }, L.heat2),
  /* the glass materialises in place: fine reeds at nothing, then full reeds at full strength */
  glassIn: mk({ ...CALM, heat: 0.45, f: 0, fw: 8 }, L.heat2),
  fix1: mk({ ...CALM, heat: 0.35, f: 1 }, L.fix1),
  fix2: mk({ ...CALM, heat: 0.3, f: 1 }, L.fix2),
  fix3: mk({ ...CALM, heat: 0.3, f: 1 }, L.fix3),
  glass: mk({ f: 1, drift: 0.6, pace: 0.8, shd: 0.6, vig: 0.3, hp: 0.25, sat: 0.95, k: 0.85, heat: 0.25 }, L.cards),
  glassCards: mk({ f: 1, heat: 0.2, k: 0.85 }, L.cards),
  step1: mk({ f: 1, fw: 26, k: 0.92 }, L.step1),
  step2: mk({ f: 0.9, fw: 46 }, L.step2),
  step3: mk({ tau: 0.7, spread: 0.65, f: 0.45, fw: 96, g: 0.65, a: 0.6, cy: 0.7, k: 0.88 }, dim(L.step2, 0.75)),
  step4: mk({ tau: 0.84, spread: 0.6, f: 0.06, fw: 150, g: 0.3, a: 1, cy: 0.74, k: 0.8 }, dim(L.step2, 0.5)),
  step5: mk({ tau: 0.94, spread: 0.5, f: 0, g: 0.2, a: 1, cy: 0.76, k: 0.78 }, dim(L.step2, 0.4)),
  cases: mk({ tau: 0.9, spread: 0.55, g: 0.25, a: 1, cy: 0.8, k: 0.74 }, dim(L.step2, 0.4)),
  pricing: mk({ tau: 0.66, spread: 0.8, g: 0.6, a: 0.5, cy: 0.78, k: 0.8 }, L.pricing),
  /* the bands between the price and the conversation: the aurora sinking back into the wisps */
  settle: mk({ tau: 0.58, spread: 0.7, g: 0.8, a: 0.35, cy: 0.62, k: 0.76 }, dim(L.contact, 1.2)),
  contact: mk({ tau: 0.5, spread: 0.5, g: 0.9, a: 0.25, cy: 0.5 }, L.contact),
}

/* The products (sections/Products.jsx): fluted glass behind each one, the
   light on the animation's side and the dark behind the words, a different
   layout for each so the light moves as the products change. Copy on the
   right mirrors the layout and moves the fade with it. */
const PRODUCT_LAYOUTS = [L.fix1, L.fix2, L.fix1, L.fix3, L.fix2, L.fix3, L.cards]
export function productState(i, side) {
  const rows = PRODUCT_LAYOUTS[i % PRODUCT_LAYOUTS.length]
  const left = side === 'left'
  return mk({ ...CALM, f: 1, heat: 0.3, vig: 0.3, shd: 0.4, vside: left ? 1 : 0 }, left ? mirror(rows) : rows)
}

/* On a portrait screen the copy fills the width: smaller glows. */
const portraitOf = (s) => {
  const o = { ...s }
  for (let i = 0; i < NG; i++) o[`g${i}r`] *= 0.8
  return o
}

/* ------------------------------------------------------------
   The homepage, chapter by chapter (brand-guidelines.md, 7.1).

   page: { vh, maxY, portrait, sec(id) -> { top, h } | null,
           products: [{ top, h, side }] }
   Returns [[scrollY, state], ...] in order.
   ------------------------------------------------------------ */
export function homeKeyframes(page) {
  const { vh, maxY, portrait, sec, products = [] } = page
  const A = portrait ? portraitOf : (s) => s
  /* where a section sits as it passes through the screen: 0 as its top
     enters at the bottom, 1 as its bottom leaves at the top */
  const pass = (id, p) => { const s = sec(id); return s ? s.top - vh + p * (s.h + vh) : null }
  const mid = (id) => { const s = sec(id); return s ? s.top + s.h / 2 - vh / 2 : null }

  const kf = [[0, A(ST.hero)]]
  const push = (y, s) => { if (y != null && isFinite(y)) kf.push([y, A(s)]) }

  const what = sec('what-we-do')
  if (what) {
    push(what.top - vh * 0.5, ST.hero)
    /* the problems first: warm while "which of these sounds familiar" is read */
    push(what.top + vh * 0.1, ST.heatStart)
  }
  if (products.length) {
    const first = products[0]
    push(first.top - vh * 0.45, ST.heatPeak)
    /* the glass arrives with the first product */
    push(first.top - vh * 0.1, ST.glassIn)
    /* each product holds its own light while its words are read, and the
       light travels to the next one's across the hand-over */
    products.forEach((p, i) => {
      const s = productState(i, p.side)
      push(p.top + p.h * 0.12, s)
      push(p.top + p.h * 0.82, s)
    })
    const last = products[products.length - 1]
    push(last.top + last.h + vh * 0.1, ST.glass)
  }
  /* how we work: the reeds widen step by step while the glass gives way to the aurora */
  push(pass('how-we-work', 0.22), ST.step1)
  push(pass('how-we-work', 0.36), ST.step2)
  push(pass('how-we-work', 0.5), ST.step3)
  push(pass('how-we-work', 0.64), ST.step4)
  push(pass('how-we-work', 0.8), ST.step5)
  push(mid('cases'), ST.cases)
  push(mid('pricing'), ST.pricing)
  push(mid('other-services'), ST.settle)
  push(mid('about'), ST.settle)
  const c = mid('contact')
  if (c != null) push(Math.min(maxY, c), ST.contact)

  kf.sort((a, b) => a[0] - b[0])
  for (let j = 1; j < kf.length; j++) if (kf[j][0] <= kf[j - 1][0]) kf[j][0] = kf[j - 1][0] + 1
  return kf
}

/* A page with no story: the opening light, held. Other services, legal pages. */
export function stillKeyframes({ portrait }) {
  return [[0, portrait ? portraitOf(ST.hero) : ST.hero]]
}
