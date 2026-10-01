/* ============================================================
   reel-frame — where a canvas cut's content actually lands.

     node scripts/reel-frame.mjs web

   Every beat of a canvas cut is a camera position over a canvas much
   larger than the frame, so "does this shot hold what it is meant to
   hold" is arithmetic, not taste — and it was repeatedly got wrong by
   eye. This reads the built page and reports, per beat, where the
   cell's readable content sits in the 1080x1920 frame against the
   margins Instagram covers with its own UI.

   Two findings that came out of it, both invisible in a preview:
     - a footnote pinned to a 3100-tall cell's floor lands at screen
       y1795, 355px inside the caption zone
     - a cell padded 100 both sides reaches x1020, under the like rail

   Beats marked `crop: true` in the show are deliberate push-ins that
   frame part of a cell; they are reported but not judged.
   ============================================================ */

import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const name = process.argv[2] || 'web'
const file = join(ROOT, 'build', name.startsWith('reel') ? `${name}.html` : `reel-${name}.html`)
if (!existsSync(file)) throw new Error(`${file} — run: node scripts/build-reel.mjs`)

/* Instagram's chrome, as the band that is left. Same numbers as SAFE in
   scripts/reel/frame.js. */
const BAND = { top: 250, bottom: 1440, left: 60, right: 960 }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto(pathToFileURL(file).href + '?guides=0')
await page.evaluate(() => document.fonts.ready)

/* Line wrapping is what this measures, and line wrapping is decided by
   the webfonts. A run in system-ui measures a layout that never ships. */
const fonts = await page.evaluate(() =>
  ['700 400px "Space Grotesk"', '500 96px "Inter Tight"', '400 46px "JetBrains Mono"']
    .map((f) => document.fonts.check(f)))
if (fonts.some((x) => !x)) throw new Error(`webfonts did not load: ${JSON.stringify(fonts)}`)
await page.waitForTimeout(300)

const beats = await page.evaluate(() => {
  const canvas = document.getElementById('canvas')
  if (!canvas) return null
  const cRect = canvas.getBoundingClientRect()
  const scale = cRect.width / canvas.offsetWidth

  /* offsetParent walking is exact for the HTML boxes. SVG elements have
     no offsetLeft, so those come off getBoundingClientRect and convert
     back through the canvas transform. */
  const at = (el) => {
    if (!(el instanceof HTMLElement)) {
      const r = el.getBoundingClientRect()
      return { x: (r.left - cRect.left) / scale, y: (r.top - cRect.top) / scale,
        w: r.width / scale, h: r.height / scale }
    }
    let x = 0, y = 0, n = el
    while (n && n !== canvas) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight }
  }

  /* Horizontally, measure INK rather than boxes: a .cvLine box is the
     cell's full inner width whatever the sentence is, so checking the
     box against the right-hand rail flags every cell and means nothing.
     The per-word masks the player builds are ink-tight. */
  const ink = (el) => {
    const ws = [...el.querySelectorAll('.cvW')]
    return ws.length ? ws.map(at) : [at(el)]
  }

  return window.reel.SHOW.filter((s) => s.cell && s.cam).map((s) => {
    const cell = canvas.querySelector(`[data-cell="${s.cell}"]`)
    const kids = [...cell.querySelectorAll('.cvKick, .cvHuge, .cvLine, .cvFoot, .wList, .cvScene, .cvMark')]
      .filter((e) => !e.closest('.wRow'))
    const sy = (v) => (v - s.cam.y) * s.cam.z + 960
    const sx = (v) => (v - s.cam.x) * s.cam.z + 540
    let top = Infinity, bot = -Infinity, left = Infinity, right = -Infinity
    const lines = kids.map((k) => {
      const r = at(k)
      top = Math.min(top, r.y); bot = Math.max(bot, r.y + r.h)
      for (const w of ink(k)) { left = Math.min(left, w.x); right = Math.max(right, w.x + w.w) }
      return { c: (k.getAttribute('class') || '').split(' ')[0],
        t: Math.round(sy(r.y)), b: Math.round(sy(r.y + r.h)),
        txt: (k.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 46) }
    })
    return { id: s.id, cell: s.cell, z: s.cam.z, crop: !!s.crop,
      top: Math.round(sy(top)), bot: Math.round(sy(bot)),
      left: Math.round(sx(left)), right: Math.round(sx(right)), lines }
  })
})

if (!beats) { console.log(`${name}: not a canvas cut — nothing to frame.`); await browser.close(); process.exit(0) }

let bad = 0
for (const r of beats) {
  const out = r.crop ? [] : [
    r.top < BAND.top && `top ${r.top} above ${BAND.top}`,
    r.bot > BAND.bottom && `bottom ${r.bot} below ${BAND.bottom}`,
    r.left < BAND.left && `left ${r.left} outside ${BAND.left}`,
    r.right > BAND.right && `right ${r.right} under the rail at ${BAND.right}`,
  ].filter(Boolean)
  if (out.length) bad++
  console.log(`${out.length ? '✗' : r.crop ? '·' : '✓'} ${r.id.padEnd(7)} z${String(r.z).padEnd(6)}` +
    ` y ${String(r.top).padStart(5)}..${String(r.bot).padStart(5)}` +
    ` x ${String(r.left).padStart(5)}..${String(r.right).padStart(5)}` +
    (r.crop ? '   (crop)' : ''))
  if (out.length) {
    console.log(`      ${out.join('; ')}`)
    for (const l of r.lines) console.log(`      ${String(l.t).padStart(5)}..${String(l.b).padStart(5)}  ${l.c.padEnd(9)} ${l.txt}`)
  }
}
if (errs.length) { console.log(`\npage errors:\n  ${errs.join('\n  ')}`); bad++ }
console.log(`\n${beats.length} beats, ${bad} outside the band.`)
await browser.close()
process.exit(bad ? 1 : 0)
