/* ============================================================
   Render the 1200x630 social card.

   The card is the homepage's opening, as a still: the lit ground (the
   site's own shader, src/components/ground, drawn here in a headless
   browser), the drawn wordmark, and the hero's line in Manjari Thin.

   The wordmark is the drawn artwork, not text: the card a link preview
   shows must carry the same letterforms as the site it links to. The
   type is the self-hosted Manjari, inlined, so this never depends on a
   font CDN. The ground's code is read from the site's own modules, so
   the card's light is the site's light, not a copy of it.

   Usage: node scripts/build-og.mjs
   ============================================================ */

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const font = (w) => readFileSync(join(ROOT, `public/fonts/Manjari-${w}-latin.woff2`)).toString('base64')
const wordmark = read('public/brand/wordmark.svg')

/* The ground's two modules as one classic script: drop the imports and the
   export keywords, and the names resolve between them. */
const unmodule = (src) => src.replace(/^import .*$/gm, '').replace(/^export (const|function) /gm, '$1 ')
const ground = unmodule(read('src/components/ground/story.js')) + '\n' + unmodule(read('src/components/ground/engine.js'))

const face = (w, name) => `@font-face{font-family:'Manjari';font-weight:${w};src:url(data:font/woff2;base64,${font(name)}) format('woff2');
  ascent-override:85.5%;descent-override:26.5%;line-gap-override:0%}`

const html = `<!doctype html><meta charset="utf-8">
<style>
  ${face(100, 'Thin')} ${face(400, 'Regular')} ${face(700, 'Bold')}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#0E0C0A;font-family:'Manjari',sans-serif;color:#F0E7D8;
       position:relative;overflow:hidden;-webkit-font-smoothing:antialiased}
  #ground{position:absolute;left:0;top:0;width:1200px;height:630px;display:block}
  .grain{position:absolute;inset:0;opacity:.14;mix-blend-mode:overlay;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
  .card{position:absolute;inset:0;padding:70px 80px 64px;display:flex;flex-direction:column;justify-content:space-between}
  .mark{width:210px;color:#FBF6EC;line-height:0}
  .mark svg{width:100%;height:auto;display:block;overflow:visible}
  .mark rect{fill:#E9AC57;filter:drop-shadow(0 0 14px rgba(233,172,87,.7))}
  h1{font-weight:100;font-size:108px;line-height:1.02;letter-spacing:-.006em;word-spacing:-.08em;color:#FBF6EC;max-width:11.5ch}
  h1 i{display:inline-block;width:.2em;height:.2em;background:#E9AC57;margin-left:.06em;box-shadow:0 0 .35em rgba(233,172,87,.6)}
  .foot{display:flex;justify-content:space-between;align-items:center;font-size:24px;color:#C8BBA8}
  .eyebrow{display:flex;align-items:center;gap:14px;font-size:19px;letter-spacing:.08em;text-transform:uppercase}
  .eyebrow span{background:linear-gradient(90deg,#F2C57E,#EFE2C6 55%,#A9DCFF);-webkit-background-clip:text;background-clip:text;color:transparent}
  .eyebrow b{width:9px;height:9px;background:#E9AC57;box-shadow:0 0 14px rgba(233,172,87,.8)}
</style>
<canvas id="ground"></canvas><div class="grain"></div>
<div class="card">
  <div class="mark">${wordmark}</div>
  <h1>AI, built into your business<i></i></h1>
  <div class="foot">
    <span class="eyebrow"><b></b><span>AI implementation for small and mid-sized businesses</span></span>
    <span>nabl.agency</span>
  </div>
</div>
<script>
${ground}
window.__ok = false
const g = createGround(document.getElementById('ground'), { reduced: true })
if (g) { g.setStory(() => [[0, ST.hero]]); window.__ok = true }
</script>`

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(900)
if (!(await page.evaluate(() => window.__ok))) {
  await browser.close()
  throw new Error('WebGL was not available, so the card has no ground. Nothing was written.')
}
await page.screenshot({ path: join(ROOT, 'public/brand/og.png') })
await browser.close()
console.log('public/brand/og.png written (1200x630)')
