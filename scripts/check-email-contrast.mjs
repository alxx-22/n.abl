/* ============================================================
   Contrast audit for the email pack — measured, not inferred.

   Static analysis of table-based email HTML is unreliable: the
   ground a run of text sits on depends on nesting, and a regex
   walk gets it wrong often enough to bury real defects in false
   positives. So this renders each template in a real browser and
   reads the resolved colours off the DOM, walking up the ancestor
   chain for the first non-transparent background — exactly what a
   mail client composites.

   Usage: node scripts/check-email-contrast.mjs
   ============================================================ */

import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'nabl-emails')

const MEASURE = () => {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map((x) => parseFloat(x))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
  const ratio = (f, b) => {
    const [x, y] = [lum(f), lum(b)]
    const [hi, lo] = x > y ? [x, y] : [y, x]
    return (hi + 0.05) / (lo + 0.05)
  }
  // First opaque background up the ancestor chain — what actually shows through.
  const groundOf = (el) => {
    let n = el
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0.5) return c
      n = n.parentElement
    }
    return { r: 255, g: 255, b: 255, a: 1 }
  }

  const out = []
  document.querySelectorAll('body *').forEach((el) => {
    // only elements holding their own visible text
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
      .map((n) => n.textContent.trim()).join(' ')
    if (!own) return
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return
    const fg = parse(cs.color)
    if (!fg || fg.a < 0.5) return
    const bg = groundOf(el)
    const px = parseFloat(cs.fontSize) || 14
    const weight = parseInt(cs.fontWeight, 10) || 400
    const large = px >= 24 || (px >= 18.66 && weight >= 700)
    const need = large ? 3.0 : 4.5
    const r = ratio(fg, bg)
    if (r < need) {
      out.push({
        text: own.slice(0, 46),
        fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
        ratio: Math.round(r * 100) / 100, need, px: Math.round(px), weight,
      })
    }
  })
  return out
}

/* ------------------------------------------------------------------
   Logo contrast.

   MEASURE above only looks at elements holding their own text, so an
   <img> is invisible to it. That gap shipped a cream wordmark onto a
   near-white header in four templates at 1.06:1 — passing 6/6 while
   the logo could not be seen. A logo is a graphical object, so WCAG
   1.4.11 wants 3:1 against its ground.

   The artwork colour is sampled from the PNG rather than assumed from
   the filename, so a recoloured asset is measured as it actually is.
   ------------------------------------------------------------------ */
const BRAND = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'brand')

async function inkOf(page, file) {
  // Passed as a data: URI, not file://. A file:// image will not load into an
  // about:blank page at all, and even where it loads it taints the canvas so
  // getImageData throws. Either way the sample comes back empty — which is how
  // the first version of this check silently passed everything.
  const url = 'data:image/png;base64,' + readFileSync(join(BRAND, file)).toString('base64')
  return page.evaluate(async ({ url, amber }) => {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('load failed')); img.src = url })
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, c.width, c.height)
    const tally = new Map()
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue
      const k = `${data[i]},${data[i + 1]},${data[i + 2]}`
      tally.set(k, (tally.get(k) || 0) + 1)
    }
    // Two inks, not one: the letterforms and the accent dot are separately
    // capable of disappearing. An earlier version excluded the accent as
    // "meant to be amber", which is exactly how a 1.97:1 dot shipped.
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1])
    const total = ranked.reduce((n, [, v]) => n + v, 0)
    return ranked.filter(([, v]) => v / total > 0.01).slice(0, 2).map(([k]) => k)
  }, { url })
}

const MEASURE_LOGOS = (inks) => {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null
    const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }
  }
  const groundOf = (el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0.5) return c
    }
    return { r: 255, g: 255, b: 255 }
  }
  const out = []
  document.querySelectorAll('img[src]').forEach((img) => {
    const file = img.getAttribute('src').split('/').pop()
    const inkList = inks[file]; if (!inkList) return
    const bg = groundOf(img)
    inkList.forEach((ink, idx) => {
      const [r, g, b] = ink.split(',').map(Number)
      const x = lum(r, g, b), y = lum(bg.r, bg.g, bg.b)
      const [hi, lo] = x > y ? [x, y] : [y, x]
      const ratio = (hi + 0.05) / (lo + 0.05)
      if (ratio < 3) out.push({
        file, part: idx === 0 ? 'letterforms' : 'accent dot',
        ink: `rgb(${ink})`, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
        ratio: Math.round(ratio * 100) / 100,
      })
    })
  })
  return out
}

const browser = await chromium.launch()
const page = await browser.newPage()
let templates = 0, bad = 0

// Sample every brand asset the templates reference, once.
const assets = new Set()
for (const f of readdirSync(DIR).filter((n) => /^email-.*\.html$/.test(n))) {
  for (const m of readFileSync(join(DIR, f), 'utf8').matchAll(/src="[^"]*\/([^"/]+\.png)"/g)) assets.add(m[1])
}
await page.goto('about:blank')
const INKS = {}
for (const a of assets) {
  try {
    INKS[a] = await inkOf(page, a)
    if (!INKS[a] || !INKS[a].length) throw new Error('no opaque pixels sampled')
  } catch (e) {
    console.log(`  ! could not sample ${a} — ${e.message}`)
    console.log(`    logo contrast is NOT being checked for this asset`)
    bad++
  }
}

for (const f of readdirSync(DIR).filter((n) => /^email-.*\.html$/.test(n)).sort()) {
  templates++
  await page.goto(`file://${join(DIR, f)}`, { waitUntil: 'load' })
  const findings = await page.evaluate(MEASURE)
  const logos = await page.evaluate(MEASURE_LOGOS, INKS)
  if (!findings.length && !logos.length) { console.log(`  ✓ ${f}`); continue }
  bad++
  console.log(`  ✗ ${f}`)
  for (const x of findings) {
    console.log(`      ${x.ratio} (needs ${x.need})  ${x.fg} on ${x.bg}  ${x.px}px/${x.weight}`)
    console.log(`         "${x.text}"`)
  }
  for (const x of logos) {
    console.log(`      ${x.ratio} (needs 3)  ${x.part} ${x.ink} on ${x.bg}`)
    console.log(`         ${x.file} — wrong colourway for this ground`)
  }
}

await browser.close()
console.log(`\n${templates - bad}/${templates} templates pass contrast`)
process.exit(bad ? 1 : 0)
