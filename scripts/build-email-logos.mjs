/* ============================================================
   Render the two email wordmark assets from the drawn master.

   Email needs a PNG: SVG does not render in Outlook, and the drawn
   n cannot be rebuilt in email-safe CSS without border-radius,
   which Outlook also ignores.

   Two colourways, identical geometry so they are drop-in swaps:

     wordmark-email.png      cream  #FBF6EC — for espresso headers
     wordmark-email-ink.png  ink    #0E0C0A — for cream/white headers

   The ink one exists because four templates put the logo on the
   light card, where the cream artwork measured 1.06:1 against
   #FFFDF9 and was effectively invisible. Pick the colourway to
   match the ground the logo actually sits on.

   Usage: node scripts/build-email-logos.mjs
   ============================================================ */

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/brand')
const wordmark = readFileSync(join(ROOT, 'public/brand/wordmark.svg'), 'utf8')

const AMBER = '#E9AC57'
// Geometry matches the cream asset that shipped first, so swapping one
// file for the other never moves the logo by a pixel.
const W = 300, PAD = '8px 10px'

const V = [
  { file: 'wordmark-email.png',     fg: '#FBF6EC' },
  { file: 'wordmark-email-ink.png', fg: '#0E0C0A' },
]

const html = (fg) => `<!doctype html><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:transparent}
  #t{display:inline-block;padding:${PAD};color:${fg};line-height:0}
  #t svg{width:${W}px;height:auto;display:block;overflow:visible}
  #t rect{fill:${AMBER}}
</style>
<div id="t">${wordmark}</div>`

const browser = await chromium.launch()
for (const v of V) {
  const page = await browser.newPage({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 2 })
  await page.setContent(html(v.fg), { waitUntil: 'load' })
  await page.waitForTimeout(150)
  const el = await page.$('#t')
  await el.screenshot({ path: join(OUT, v.file), omitBackground: true })
  await page.close()
  console.log(`  ${v.file}  (${v.fg})`)
}
await browser.close()
