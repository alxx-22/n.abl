/* ============================================================
   Render the brand asset set from the drawn wordmark.

   The wordmark is artwork, not text: public/brand/wordmark.svg and
   mark.svg are the masters, so these PNGs and the logo in the nav
   are the same paths. Nothing here depends on a typeface being
   installed or loaded.

   Usage: node scripts/build-logos.mjs
   ============================================================ */

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'logos')
mkdirSync(OUT, { recursive: true })

const wordmark = readFileSync(join(ROOT, 'public/brand/wordmark.svg'), 'utf8')
const mark = readFileSync(join(ROOT, 'public/brand/mark.svg'), 'utf8')

const ESPRESSO = '#0E0C0A'
const CREAM = '#FBF6EC'
const AMBER = '#E9AC57'

const page$ = (svg, opts) => `<!doctype html><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:${opts.bg}}
  #t{display:inline-block;padding:${opts.pad};color:${opts.fg};line-height:0}
  #t svg{width:${opts.w}px;height:auto;display:block;overflow:visible}
  #t rect{fill:${AMBER};${opts.glow ? `filter:drop-shadow(0 0 ${opts.w * 0.03}px rgba(233,172,87,.85));` : ''}}
</style>
<div id="t">${svg}</div>`

const V = [
  { file: 'nabl-wordmark-cream.png',       svg: wordmark, fg: CREAM,    bg: 'transparent', w: 1200, pad: '60px 70px', glow: false },
  { file: 'nabl-wordmark-espresso.png',    svg: wordmark, fg: ESPRESSO, bg: 'transparent', w: 1200, pad: '60px 70px', glow: false },
  { file: 'nabl-wordmark-on-espresso.png', svg: wordmark, fg: CREAM,    bg: ESPRESSO,      w: 1200, pad: '110px 140px', glow: true },
  { file: 'nabl-wordmark-on-cream.png',    svg: wordmark, fg: ESPRESSO, bg: '#F7F2E8',     w: 1200, pad: '110px 140px', glow: false },
  { file: 'nabl-mark-cream.png',           svg: mark,     fg: CREAM,    bg: 'transparent', w: 520,  pad: '50px 56px', glow: false },
  { file: 'nabl-mark-espresso.png',        svg: mark,     fg: ESPRESSO, bg: 'transparent', w: 520,  pad: '50px 56px', glow: false },
]

const browser = await chromium.launch()
for (const v of V) {
  const page = await browser.newPage({ viewport: { width: 1800, height: 800 }, deviceScaleFactor: 2 })
  await page.setContent(page$(v.svg, v), { waitUntil: 'load' })
  await page.waitForTimeout(200)
  const el = await page.$('#t')
  await el.screenshot({ path: join(OUT, v.file), omitBackground: v.bg === 'transparent' })
  await page.close()
  console.log(`  ${v.file}`)
}
await browser.close()
console.log('\nbrand assets written to logos/')
