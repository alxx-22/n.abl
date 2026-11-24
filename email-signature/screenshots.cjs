/* Render preview.html headlessly and capture the light/dark panels.
   node email-signature/screenshots.cjs */
const { chromium } = require('playwright')
const path = require('node:path')
const fs = require('node:fs')

const HERE = __dirname
const OUT = path.join(HERE, 'screenshots')
fs.mkdirSync(OUT, { recursive: true })

;(async () => {
  const browser = await chromium.launch()
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2, colorScheme: theme })
    await page.goto('file://' + path.join(HERE, 'preview.html'))
    await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 })
    await page.screenshot({ path: path.join(OUT, `preview-page-${theme}.png`), fullPage: true })
    if (theme === 'light') {
      const stages = await page.$$('.panel')
      await stages[0].screenshot({ path: path.join(OUT, 'signature-light.png') })
      await stages[1].screenshot({ path: path.join(OUT, 'signature-dark.png') })
    }
    await page.close()
  }
  await browser.close()
  console.log('screenshots written to email-signature/screenshots/')
})()
