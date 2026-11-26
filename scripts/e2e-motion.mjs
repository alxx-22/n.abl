/* ============================================================
   MOTION end-to-end suite.

   The CSS half of the site has always honoured prefers-reduced-motion,
   because a media query is live. The JS half — the lit ground behind the
   page, the parallax, the reveals — sampled the preference once at mount,
   so it only honoured a visitor who had set it before arriving. This
   proves both halves now agree, and that with motion off the ground does
   no work while nothing changes.

   The ground (components/ground) replaced the hero's node canvas in the
   2026-11 brand. It is the page's background, fixed behind every section,
   so unlike the hero canvas it is never scrolled out of sight: with motion
   on it keeps drifting wherever the visitor is; with motion off it draws
   once for each change and then stops.

   Frames are counted by wrapping requestAnimationFrame, so what is
   measured is work actually done rather than intent.

   Usage:
     npm run build && npm run preview &
     node scripts/e2e-motion.mjs [baseURL]
   ============================================================ */
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://localhost:4173'
let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

// Count rAF callbacks actually executed, so we measure work done, not intent.
const COUNTER = `
  window.__rafRuns = 0
  const orig = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => orig((t) => { window.__rafRuns++; return cb(t) })
`
const runs = (page) => page.evaluate('window.__rafRuns')
// Frames burned over a fixed window. Only ever called once the page is
// stationary: the rail's scroll handler is rAF-throttled too, so measuring
// mid-scroll counts its frames as the canvas's.
async function burn(page, ms = 700) {
  const before = await runs(page)
  await page.waitForTimeout(ms)
  return (await runs(page)) - before
}

/* The stylesheet sets scroll-behavior: smooth, so a programmatic scroll keeps
   running long after the call returns — on a page this tall, well over a
   second. Wait for the position to actually stop moving rather than guessing
   at a timeout. */
async function settle(page) {
  let last = -1
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate('window.scrollY')
    if (y === last) return y
    last = y
    await page.waitForTimeout(100)
  }
  return last
}

const browser = await chromium.launch()

/* A frame count over 700ms. Not 60fps's 42: a headless browser draws the
   shader in software, at well under full speed, so "running" is measured as
   more than a handful of frames, and "stopped" as fewer than five. */
const RUNNING = 8

// ---------- 1. Runs behind the whole page ----------
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(COUNTER)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)               // let the intro blind finish

  console.log('\nTHE LIT GROUND')
  const fill = await page.evaluate(() => {
    const c = document.querySelector('canvas.ground')
    if (!c) return null
    const r = c.getBoundingClientRect(), s = getComputedStyle(c)
    return { pos: s.position, z: s.zIndex, covers: r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight, drawn: c.width > 0 }
  })
  check('the ground is there, fixed behind the page', !!fill && fill.pos === 'fixed' && fill.z === '-1', JSON.stringify(fill))
  check('and covers the screen', !!fill && fill.covers && fill.drawn, JSON.stringify(fill))
  const onScreen = await burn(page)
  check('drifts while the page is open', onScreen > RUNNING, `${onScreen} frames`)

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await settle(page)
  /* At the foot the aurora is lit as well as the wisps, which a software
     renderer draws at a few frames a second until the ground lowers its own
     resolution. What matters here is that the loop has not stopped. */
  const atFoot = await burn(page, 1400)
  check('and at the foot of the page, which it is still behind', atFoot > 2, `${atFoot} frames`)

  check('no page errors', errors.length === 0, errors[0])
  await page.close()
}

// ---------- 2. Honours the preference set before load ----------
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' })
  await page.addInitScript(COUNTER)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  console.log('\nREDUCED MOTION — SET AT LOAD')
  const frames = await burn(page)
  check('the ground does no work while nothing changes', frames < 5, `${frames} frames`)
  const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas.ground')
    return !!c && c.width > 0
  })
  check('the ground is still drawn, just static', painted)
  // a scroll changes the state it should show: it draws for that, then stops again
  await page.evaluate(() => window.scrollTo({ top: 2400, behavior: 'instant' }))
  await settle(page)
  await page.waitForTimeout(300)
  const after = await burn(page)
  check('and stops again once the scroll has settled', after < 5, `${after} frames`)
  await page.close()
}

// ---------- 3. Honours the preference turned on mid-visit ----------
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.addInitScript(COUNTER)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)

  console.log('\nREDUCED MOTION — TURNED ON MID-VISIT')
  const before = await burn(page)
  check('moving beforehand', before > RUNNING, `${before} frames`)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(400)
  const after = await burn(page)
  check('the ground stops on the change, without a reload', after < 5, `${after} frames`)

  // And back again, so the preference is not a one-way door.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.waitForTimeout(400)
  const resumed = await burn(page)
  check('the ground resumes if the preference is turned back off', resumed > RUNNING, `${resumed} frames`)

  const heroTransform = await page.evaluate(() => {
    document.querySelector('.hero__inner').style.transform = 'translateY(120px)'
    return document.querySelector('.hero__inner').style.transform
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(300)
  const cleared = await page.evaluate(() => document.querySelector('.hero__inner').style.transform)
  check('hero parallax offset is cleared, not frozen', cleared === '', `was ${heroTransform}, now "${cleared}"`)
  await page.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
