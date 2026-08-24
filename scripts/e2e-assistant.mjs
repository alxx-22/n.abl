/* The site assistant, tested against a build that actually has it enabled.

   Separate from the main e2e run because it stubs the Worker endpoint and
   drives a full exchange. What it tests is the claim the whole design rests
   on:

     the assistant hands the visitor to the existing enquiry form,
     it does not submit anything itself.

   The Worker is stubbed. What is under test is the contract between the page
   and the endpoint, not the model behind it.

   Usage: node scripts/e2e-assistant.mjs
*/

import { execFileSync, spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4199
const BASE = `http://localhost:${PORT}`
let pass = 0, fail = 0
const ok = (n) => { pass++; console.log(`  ✓ ${n}`) }
const bad = (n, d = '') => { fail++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`) }
const check = (n, cond, d) => (cond ? ok(n) : bad(n, d))

console.log('\n  building…')
execFileSync('npm', ['run', 'build'], { stdio: 'pipe' })

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], { stdio: 'ignore' })
const browser = await chromium.launch()

try {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE); break } catch { await new Promise((r) => setTimeout(r, 250)) }
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  /* Anything reaching Web3Forms is a submission. The assistant must cause
     none — the visitor pressing Send in the real form is the only path. */
  let submissions = 0
  await page.route('**api.web3forms.com**', (route) => {
    submissions++
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })
  })

  let sentToEndpoint = null
  await page.route('**/api/chat/public', (route) => {
    sentToEndpoint = JSON.parse(route.request().postData() || '{}')
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        reply: "I can't answer that from what I know — shall I pass it to the team?",
        intent: 'ask_team',
        enquiry: 'Wants to know about integrating with Xero',
      }),
    })
  })

  console.log('\nSITE ASSISTANT')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  check('the launcher is present', Boolean(await page.$('.assistant-fab')))

  await page.click('.assistant-fab')
  await page.waitForTimeout(400)
  check('opening it shows the panel', Boolean(await page.$('#site-assistant')))
  const opener = await page.evaluate(() => document.querySelector('.assistant__log')?.innerText || '')
  check('and it says up front that it will hand over when it cannot answer',
    /pass it to the team|can't answer/i.test(opener))

  await page.fill('#site-assistant input', 'Do you integrate with Xero?')
  await page.click('#site-assistant button[type=submit]')
  await page.waitForTimeout(800)

  check('the question reaches the endpoint', sentToEndpoint?.message === 'Do you integrate with Xero?')
  /* The opener is ours, not the model's. Sending it back would put a message
     nobody wrote into every request. */
  check('and the canned opener is not sent back as history',
    Array.isArray(sentToEndpoint?.history) && sentToEndpoint.history.length === 0)

  const log = await page.evaluate(() => document.querySelector('.assistant__log')?.innerText || '')
  check('the reply is shown', /shall I pass it to the team/i.test(log))
  check('and a handoff is offered rather than performed', /Ask the team/i.test(log))
  check('nothing has been submitted at this point', submissions === 0)

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.assistant__handoff button')][0]
    if (b) b.click()
  })
  await page.waitForTimeout(600)

  const dialog = await page.evaluate(() => document.body.innerText)
  check('accepting the handoff opens the enquiry form', /getting in the way/i.test(dialog))

  const prefilled = await page.evaluate(() => document.querySelector('#d-challenge')?.value || '')
  check('with what they asked already filled in', /Xero/i.test(prefilled))

  const editable = await page.evaluate(() => {
    const t = document.querySelector('#d-challenge')
    if (!t) return false
    return !t.readOnly && !t.disabled
  })
  check('and still editable, because it is a draft not a submission', editable)

  /* The assertion the whole design exists for. */
  check('the assistant submitted nothing itself', submissions === 0)

  check('no runtime errors', errors.length === 0, errors.join('; '))
} finally {
  await browser.close()
  server.kill()
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
