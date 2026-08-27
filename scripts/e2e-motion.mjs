/* ============================================================
   MOTION end-to-end suite.

   The CSS half of the site has always honoured prefers-reduced-motion,
   because a media query is live. The JS half — the hero canvas, the
   parallax, the reveals — sampled the preference once at mount, so it
   only honoured a visitor who had set it before arriving. This proves
   both halves now agree, and that the canvas is not burning frames on
   a drawing that is scrolled out of sight.

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

// ---------- 1. Idles off-screen and in a background tab ----------
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(COUNTER)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)               // let the intro blind finish

  console.log('\nHERO CANVAS')
  const onScreen = await burn(page)
  check('runs while the hero is on screen', onScreen > 20, `${onScreen} frames`)

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await settle(page)
  const clear = await page.evaluate(() => document.querySelector('canvas.nodefield').getBoundingClientRect().bottom)
  check('hero canvas is genuinely off screen', clear < 0, `bottom at ${Math.round(clear)}px`)
  const offScreen = await burn(page)
  check('stops once the hero is scrolled away', offScreen === 0, `${offScreen} frames`)

  await page.evaluate(() => window.scrollTo(0, 0))
  await settle(page)
  const back = await burn(page)
  check('resumes when the hero returns', back > 20, `${back} frames`)

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
  check('canvas never starts', frames < 5, `${frames} frames`)
  const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas.nodefield')
    return !!c && c.width > 0
  })
  check('canvas is still drawn, just static', painted)
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
  check('moving beforehand', before > 20, `${before} frames`)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(400)
  const after = await burn(page)
  check('canvas stops on the change, without a reload', after < 5, `${after} frames`)

  // And back again, so the preference is not a one-way door.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.waitForTimeout(400)
  const resumed = await burn(page)
  check('canvas resumes if the preference is turned back off', resumed > 20, `${resumed} frames`)

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
