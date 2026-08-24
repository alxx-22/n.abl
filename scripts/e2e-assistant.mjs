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

  /* Closing has to be animated too, which means the panel outlives the click.
     Unmounting on the same tick would read as the box being deleted rather
     than put away. Done here, before the handoff opens a dialog over the
     page and takes the launcher out of reach. */
  await page.click('.assistant-fab')
  await page.waitForTimeout(60)
  check('closing keeps the panel on screen to animate out',
    Boolean(await page.$('#site-assistant.assistant--closing')))
  await page.waitForTimeout(500)
  check('and then it is gone', (await page.$$('#site-assistant')).length === 0)
  await page.click('.assistant-fab')
  await page.waitForTimeout(450)
  check('and it opens again afterwards, not stuck half-closed',
    Boolean(await page.$('#site-assistant')) && !(await page.$('.assistant--closing')))

  /* The box is a textarea so that shift+Enter can break a line and the height
     can follow the text. Measure it empty, then with enough text to wrap. */
  const emptyHeight = await page.evaluate(
    () => document.querySelector('#site-assistant textarea')?.getBoundingClientRect().height || 0)
  await page.fill('#site-assistant textarea',
    'Do you integrate with Xero, and if so how long does that sort of thing usually take to set up end to end?')
  await page.waitForTimeout(120)
  const grownHeight = await page.evaluate(
    () => document.querySelector('#site-assistant textarea')?.getBoundingClientRect().height || 0)
  check('the input grows as the text wraps', grownHeight > emptyHeight + 8,
    `${emptyHeight} -> ${grownHeight}`)

  await page.fill('#site-assistant textarea', 'Do you integrate with Xero?')
  await page.waitForTimeout(120)
  const shrunkHeight = await page.evaluate(
    () => document.querySelector('#site-assistant textarea')?.getBoundingClientRect().height || 0)
  /* And back down again. A box that can only ever get taller is the bug this
     guards: scrollHeight of an already-tall element includes its own height,
     so the reset to auto has to happen first. */
  check('and shrinks again when the text does', shrunkHeight < grownHeight - 4,
    `${grownHeight} -> ${shrunkHeight}`)

  check('there is an AI mark on the launcher', Boolean(await page.$('.assistant-fab .spark')))

  /* It turns for as long as the cursor is on the launcher rather than once
     and stopping, so a hover that lingers keeps moving. */
  await page.hover('.assistant-fab')
  await page.waitForTimeout(150)
  const spin = await page.evaluate(() => {
    const el = document.querySelector('.assistant-fab .spark')
    const cs = getComputedStyle(el)
    return { count: cs.animationIterationCount, name: cs.animationName }
  })
  check('and it keeps turning while hovered', spin.count === 'infinite' && /spark-turn/.test(spin.name),
    JSON.stringify(spin))
  check('and no disclaimer paragraph in the panel — the legal pages carry that',
    (await page.$$('#site-assistant .assistant__note')).length === 0)

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
