/* ============================================================
   check-reels — step every cut through every frame.

   Written after shipping a cut that failed halfway through on a real
   machine. It had been "tested" by sampling the frame rate at one
   timestamp, which proves only that one timestamp renders. This walks
   the whole timeline at 60fps and fails on anything that throws, on any
   NaN reaching a style, and on any card whose content outgrows its box.

     node scripts/check-reels.mjs
   ============================================================ */

import { chromium } from 'playwright'
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BUILD = join(dirname(fileURLToPath(import.meta.url)), '..', 'build')
const cuts = readdirSync(BUILD).filter((f) => f.startsWith('reel') && f.endsWith('.html'))
if (!cuts.length) { console.error('No build/reel*.html — run build-reel.mjs first.'); process.exit(1) }

const browser = await chromium.launch()
let failed = 0

for (const cut of cuts) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('crash', () => errs.push('renderer crashed'))

  await page.goto(`file://${join(BUILD, cut)}?clean=1&guides=0`)
  await page.waitForTimeout(500)

  /* Every frame, not every second. A section boundary is exactly where
     a state change goes wrong, and at 2.0s sections there are only ten
     of them in a whole cut. */
  const report = await page.evaluate(() => {
    const bad = { nan: [], overflow: [], threw: null }
    const STEP = 1 / 60
    try {
      for (let t = 0; t <= reel.TOTAL; t += STEP) {
        reel.seek(t)
        for (const el of document.querySelectorAll('[style]')) {
          if (/NaN|Infinity|undefined/.test(el.getAttribute('style'))) {
            bad.nan.push(`${t.toFixed(2)}s ${el.id || el.className}`)
            if (bad.nan.length > 4) throw new Error('too many')
          }
        }
      }
    } catch (e) { if (e.message !== 'too many') bad.threw = e.message }

    for (const s of reel.SHOW) {
      /* A collapsing card is meant to end smaller than its content. */
      if (!s.card || s.collapse) continue
      /* Identified by name, not by whichever face happens to be opaque:
         during a wipe two faces are legitimately visible at once. */
      reel.seek(s.t1 - 0.05)
      const face = document.querySelector(`.cardFace[data-card="${s.card}"]`)
      const box = document.getElementById('card')
      if (face && face.scrollHeight > box.clientHeight + 1) {
        bad.overflow.push(`${s.id} +${face.scrollHeight - box.clientHeight}px`)
      }
    }
    return { ...bad, total: +reel.TOTAL.toFixed(1), sections: reel.SHOW.length, speed: reel.speed }
  })

  /* Then run the rAF loop for real. The walk above already calls draw()
     for every frame, so this is not about coverage — it is about proving
     the loop itself survives, which seeking never exercises. Started at
     the midpoint, because that is where the reported failure was. */
  const from = Math.max(0, report.total / 2 - 2)
  await page.evaluate((t) => { reel.seek(t); reel.play() }, from)
  await page.waitForTimeout(6000)
  const landed = await page.evaluate(() => +reel.t.toFixed(1)).catch(() => null)
  /* A cut can open at its own speed — the automation one runs at a half
     so it can be sped back up in the edit — so how far six seconds of
     wall clock carries it depends on that, not on an assumed 1x. */
  const expected = Math.min(from + 5.5 * report.speed, report.total)

  const problems = [
    errs.length && `threw: ${errs.slice(0, 2).join('; ')}`,
    report.threw && `frame walk threw: ${report.threw}`,
    report.nan.length && `NaN in styles: ${report.nan.join(', ')}`,
    report.overflow.length && `card overflow: ${report.overflow.join(', ')}`,
    landed === null && 'page died during playback',
    landed !== null && landed < expected - 0.6 &&
      `playback stalled at ${landed}s (expected past ${expected.toFixed(1)}s)`,
  ].filter(Boolean)

  if (problems.length) { failed++; console.log(`  ✗ ${cut}\n      ${problems.join('\n      ')}`) }
  else console.log(`  ✓ ${cut}  ${report.sections} sections, ${report.total}s` +
    `${report.speed !== 1 ? ` at ${report.speed}x` : ''}, ${Math.round(report.total * 60)} frames clean`)

  await page.close()
}

await browser.close()
console.log(failed ? `\n${failed} of ${cuts.length} cuts failed.` : `\n${cuts.length} cuts passed.`)
process.exit(failed ? 1 : 0)
