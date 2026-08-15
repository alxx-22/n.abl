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

import { readdirSync } from 'node:fs'
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

const browser = await chromium.launch()
const page = await browser.newPage()
let templates = 0, bad = 0

for (const f of readdirSync(DIR).filter((n) => /^email-.*\.html$/.test(n)).sort()) {
  templates++
  await page.goto(`file://${join(DIR, f)}`, { waitUntil: 'load' })
  const findings = await page.evaluate(MEASURE)
  if (!findings.length) { console.log(`  ✓ ${f}`); continue }
  bad++
  console.log(`  ✗ ${f}`)
  for (const x of findings) {
    console.log(`      ${x.ratio} (needs ${x.need})  ${x.fg} on ${x.bg}  ${x.px}px/${x.weight}`)
    console.log(`         "${x.text}"`)
  }
}

await browser.close()
console.log(`\n${templates - bad}/${templates} templates pass contrast`)
process.exit(bad ? 1 : 0)
