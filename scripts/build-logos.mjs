/* ============================================================
   Render the brand asset set from the live design tokens.

   The previous logo files were flat PNGs with no alpha and an
   off-white background baked in, so they could only ever be used
   on a light page. These are rendered transparent, at 3x, from
   the same self-hosted typeface the site uses — so the wordmark
   in a deck matches the wordmark in the nav.

   Usage: node scripts/build-logos.mjs
   ============================================================ */

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'logos')
mkdirSync(OUT, { recursive: true })

const ESPRESSO = '#0E0C0A'
const CREAM = '#F0E7D8'
const CREAM_BRIGHT = '#FBF6EC'
const AMBER = '#E9AC57'

// Inline the woff2 so the render never depends on the network.
const fontData = readFileSync(join(ROOT, 'public/fonts/SpaceGrotesk-latin.woff2')).toString('base64')

const page$ = (opts) => `<!doctype html><meta charset="utf-8">
<style>
  @font-face{font-family:'Space Grotesk';font-style:normal;font-weight:400 700;
    src:url(data:font/woff2;base64,${fontData}) format('woff2')}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:${opts.bg};}
  .wrap{display:inline-flex;align-items:flex-end;padding:${opts.pad};
        font-family:'Space Grotesk';font-weight:700;letter-spacing:-.045em;
        line-height:1;font-size:${opts.size}px;color:${opts.fg};white-space:nowrap}
  .sq{width:.2em;height:.2em;background:${AMBER};margin:0 .09em .1em;flex:0 0 auto;
      ${opts.glow ? `box-shadow:0 0 ${opts.size * 0.35}px rgba(233,172,87,.55);` : ''}}
</style>
<div class="wrap" id="t">${opts.short ? 'n<i class="sq"></i>' : 'n<i class="sq"></i>abl'}</div>`

const VARIANTS = [
  { file: 'nabl-wordmark-cream.png',            fg: CREAM_BRIGHT, bg: 'transparent', size: 220, pad: '40px 48px', glow: false },
  { file: 'nabl-wordmark-espresso.png',         fg: ESPRESSO,     bg: 'transparent', size: 220, pad: '40px 48px', glow: false },
  { file: 'nabl-wordmark-on-espresso.png',      fg: CREAM_BRIGHT, bg: ESPRESSO,      size: 220, pad: '64px 80px', glow: true },
  { file: 'nabl-wordmark-on-cream.png',         fg: ESPRESSO,     bg: '#F7F2E8',     size: 220, pad: '64px 80px', glow: false },
  { file: 'nabl-mark-cream.png',   short: true, fg: CREAM_BRIGHT, bg: 'transparent', size: 300, pad: '40px 44px', glow: false },
  { file: 'nabl-mark-espresso.png',short: true, fg: ESPRESSO,     bg: 'transparent', size: 300, pad: '40px 44px', glow: false },
]

const browser = await chromium.launch()
for (const v of VARIANTS) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 700 },
    deviceScaleFactor: 3,
    // Transparent background only works when the page itself is transparent.
    ...(v.bg === 'transparent' ? {} : {}),
  })
  await page.setContent(page$(v), { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250)
  const el = await page.$('#t')
  await el.screenshot({
    path: join(OUT, v.file),
    omitBackground: v.bg === 'transparent',
  })
  await page.close()
  console.log(`  ${v.file}`)
}
await browser.close()
console.log('\nbrand assets written to logos/')
