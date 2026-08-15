/* ============================================================
   Render the 1200x630 social card.

   The wordmark is the drawn artwork, not text — the card a link
   preview shows must carry the same letterforms as the site it
   links to. Headline copy is set in the real typeface, self-hosted
   so this never depends on a font CDN.

   Usage: node scripts/build-og.mjs
   ============================================================ */

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const wordmark = readFileSync(join(ROOT, 'public/brand/wordmark.svg'), 'utf8')
const display = readFileSync(join(ROOT, 'public/fonts/SpaceGrotesk-latin.woff2')).toString('base64')
const body = readFileSync(join(ROOT, 'public/fonts/InterTight-latin.woff2')).toString('base64')

const html = `<!doctype html><meta charset="utf-8">
<style>
  @font-face{font-family:'Display';src:url(data:font/woff2;base64,${display}) format('woff2');font-weight:100 900}
  @font-face{font-family:'Body';src:url(data:font/woff2;base64,${body}) format('woff2');font-weight:100 900}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#0E0C0A;font-family:'Body',sans-serif;color:#F0E7D8;
       display:flex;flex-direction:column;justify-content:space-between;
       padding:74px 80px;position:relative;overflow:hidden}
  .bloom{position:absolute;inset:-30% -10% auto;height:110%;
    background:radial-gradient(46ch 30ch at 24% 22%, rgba(233,172,87,.16), transparent 64%),
               radial-gradient(52ch 34ch at 78% 6%, rgba(240,231,216,.10), transparent 66%)}
  .grain{position:absolute;inset:0;opacity:.035;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
  .mark{position:relative;width:270px;color:#FBF6EC;line-height:0}
  .mark svg{width:100%;height:auto;display:block;overflow:visible}
  .mark rect{fill:#E9AC57;filter:drop-shadow(0 0 18px rgba(233,172,87,.8))}
  h1{position:relative;font-family:'Display',sans-serif;font-weight:700;font-size:86px;line-height:1.03;
     letter-spacing:-.035em;color:#FBF6EC;max-width:17ch;text-shadow:0 0 80px rgba(240,231,216,.14)}
  h1 i{display:inline-block;width:.16em;height:.16em;background:#E9AC57;margin-left:.06em;
       box-shadow:0 0 30px rgba(233,172,87,.85)}
  .foot{position:relative;display:flex;justify-content:space-between;align-items:center;
        font-size:23px;color:#9A8F80}
  .eyebrow{display:flex;align-items:center;gap:11px;font-size:20px;letter-spacing:.16em;
           text-transform:uppercase;color:#E9AC57}
  .eyebrow b{width:8px;height:8px;background:#E9AC57;box-shadow:0 0 16px rgba(233,172,87,.9)}
</style>
<div class="bloom"></div><div class="grain"></div>
<div class="mark">${wordmark}</div>
<h1>We make your business work smarter<i></i></h1>
<div class="foot">
  <span class="eyebrow"><b></b>Automation studio</span>
  <span>nabl.agency</span>
</div>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(300)
await page.screenshot({ path: join(ROOT, 'public/brand/og.png') })
await browser.close()
console.log('public/brand/og.png written (1200x630)')
