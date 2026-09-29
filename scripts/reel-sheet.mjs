/* ============================================================
   reel-sheet — a contact sheet of a cut.

     node scripts/reel-sheet.mjs web  [outdir]

   Every beat twice: once mid-arrival, once settled. Looking at
   fourteen stills side by side is how a clipped label, a shot that
   holds nothing, or type that never landed gets caught — none of which
   the frame-walk test can see, because they all render fine.

   Composed in the browser; there is no ffmpeg on this machine.
   ============================================================ */

import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const name = process.argv[2] || 'web'
const cut = name.startsWith('reel') ? name : `reel-${name}`
const file = join(ROOT, 'build', `${cut}.html`)
if (!existsSync(file)) throw new Error(`${file} — run: node scripts/build-reel.mjs`)

const OUT = process.argv[3] || join(ROOT, 'build', 'sheets', cut)
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 0.5 })
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
await page.goto(pathToFileURL(file).href + '?guides=0')
await page.evaluate(() => document.fonts.ready)
const fonts = await page.evaluate(() =>
  ['700 400px "Space Grotesk"', '500 96px "Inter Tight"', '400 46px "JetBrains Mono"']
    .map((f) => document.fonts.check(f)))
if (fonts.some((x) => !x)) throw new Error(`webfonts did not load — a sheet shot in system-ui is a sheet of a layout that will never ship`)
await page.waitForTimeout(200)

const beats = await page.evaluate(() => window.reel.SHOW.map((s) => ({ id: s.id, t0: s.t0, dur: s.dur })))
const shots = []
for (const s of beats) {
  for (const [tag, t] of [['a', s.t0 + 0.55], ['b', s.t0 + s.dur * 0.62]]) {
    await page.evaluate((tt) => window.reel.seek(tt), t)
    await page.waitForTimeout(140)
    const f = `${String(shots.length + 1).padStart(2, '0')}-${s.id}-${tag}.png`
    await page.locator('#stage').screenshot({ path: join(OUT, f) })
    shots.push({ f, label: `${s.id} ${tag}  ${t.toFixed(2)}s` })
  }
}

const COLS = Math.min(7, Math.ceil(shots.length / 2))
const ROWS = Math.ceil(shots.length / COLS)
const W = 300, H = Math.round(W * 1920 / 1080)
writeFileSync(join(OUT, 'sheet.html'), `<!doctype html><meta charset="utf8">
<style>
 body{margin:0;background:#141414;font:11px ui-monospace,monospace;color:#8a8378;
      display:grid;grid-template-columns:repeat(${COLS},${W}px);gap:10px;padding:12px}
 figure{margin:0} img{display:block;width:${W}px;height:${H}px;background:#000}
 figcaption{padding:5px 2px 0}
</style>
${shots.map((s) => `<figure><img src="${s.f}"><figcaption>${s.label}</figcaption></figure>`).join('\n')}`)

const sheet = await browser.newPage({ viewport: { width: COLS * (W + 10) + 14, height: ROWS * (H + 30) + 24 } })
await sheet.goto(pathToFileURL(join(OUT, 'sheet.html')).href)
await sheet.waitForTimeout(400)
const out = join(OUT, `${cut}-sheet.png`)
await sheet.screenshot({ path: out, fullPage: true })
await browser.close()
console.log(`${shots.length} frames → ${out}`)
