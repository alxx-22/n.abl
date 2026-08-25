/* The portal assistant, tested against a build that has it.

   The assertion the whole design exists for is the last one: the model
   proposes a request, and until the client presses the button, nothing has
   been written. Everything else here is in service of being able to make that
   claim honestly — a test that never reaches the proposal state would pass it
   for the wrong reason.

   The edge function is stubbed at the network boundary. What is being tested
   is this component's contract with it: what it sends, when it sends, and
   what it refuses to send on its own.

   Usage: npm run build && npx vite preview --port 4173 & node scripts/e2e-portal-assistant.mjs
*/

import { chromium } from 'playwright'
import { installMock, makeDb } from './mock-supabase.mjs'

const BASE = process.argv[2] || 'http://localhost:4173'
const KEY = 'ACME-DEMO-2026'

let pass = 0
let fail = 0
function check(label, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

/* Every call the component makes to the edge function, in order. The test
   reads this rather than trusting the UI, because "no row was written" is a
   claim about what left the browser. */
const calls = []

try {
  await installMock(page, { db: makeDb() })

  await page.route('**/functions/v1/portal-assistant', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    calls.push(body)

    if (body.action === 'raise') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ raised: true, id: 'test-request-id' }),
      })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        reply: 'I can put that to the team — here is what I would send.',
        intent: 'raise',
        request: {
          kind: 'call',
          subject: 'Call about the Q-1001 quote',
          body: 'Client would like a call to talk through the quote before deciding.',
          quote_reference: 'Q-1001',
        },
      }),
    })
  })

  console.log('\nPORTAL ASSISTANT')

  await page.goto(`${BASE}/portal`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('signed out, there is no assistant', (await page.$$('.assistant-fab')).length === 0)

  /* Sign in with a pasted key carrying whitespace, which is what happens when
     someone copies it out of an email. The input uppercases as you type but
     does not trim; login trims before sending and then threw that away, so
     the assistant would have been handed the untrimmed version. */
  await page.fill('.portal-key', `  ${KEY} `)
  await page.click('.auth-form button')
  await page.waitForTimeout(1200)

  check('signing in shows the assistant', Boolean(await page.$('.assistant-fab')))

  await page.click('.assistant-fab')
  await page.waitForTimeout(500)
  check('opening it shows the panel', Boolean(await page.$('#portal-assistant')))

  await page.fill('#portal-assistant textarea', 'Can someone call me about my quote?')
  await page.click('#portal-assistant button[type=submit]')
  await page.waitForTimeout(900)

  check('the question reaches the endpoint', calls[0]?.message === 'Can someone call me about my quote?')
  check('and it carries the trimmed access key, not what was pasted',
    calls[0]?.key === KEY, `sent "${calls[0]?.key}"`)

  const panel = await page.evaluate(() => document.querySelector('#portal-assistant')?.innerText || '')
  check('the reply is shown', /put that to the team/i.test(panel))

  /* The client must be able to read what would be sent on their behalf
     before it is. A confirm button over a summary they cannot see is not
     consent. */
  check('the proposal shows its subject verbatim', /Call about the Q-1001 quote/.test(panel))
  check('and its body verbatim', /talk through the quote before deciding/.test(panel))
  check('and which quote it is about', /Q-1001/.test(panel))
  check('and what kind of request it is', /call request/i.test(panel))

  /* THE assertion. One call so far — the question. Nothing raised. */
  check('nothing has been raised yet', calls.filter((c) => c.action === 'raise').length === 0,
    `${calls.length} call(s): ${calls.map((c) => c.action || 'ask').join(', ')}`)

  /* Declining must also write nothing, and must clear the card. */
  await page.click('#portal-assistant .assistant__proposal-actions button:nth-child(2)')
  await page.waitForTimeout(300)
  check('declining raises nothing', calls.filter((c) => c.action === 'raise').length === 0)
  check('and the proposal is dismissed', (await page.$$('.assistant__proposal')).length === 0)

  /* Ask again, then confirm properly. */
  await page.fill('#portal-assistant textarea', 'Actually yes please, call me')
  await page.click('#portal-assistant button[type=submit]')
  await page.waitForTimeout(900)
  await page.click('#portal-assistant .assistant__proposal-actions button:nth-child(1)')
  await page.waitForTimeout(700)

  const raised = calls.filter((c) => c.action === 'raise')
  check('confirming raises exactly one request', raised.length === 1, `${raised.length}`)
  check('with the proposal it showed, unchanged',
    raised[0]?.request?.subject === 'Call about the Q-1001 quote' &&
    raised[0]?.request?.kind === 'call')
  check('labelled as drafted by the assistant, not typed by the client',
    raised[0]?.raised_via === 'assistant')
  check('and the client is told it was raised',
    /raised/i.test(await page.evaluate(() => document.querySelector('#portal-assistant')?.innerText || '')))

  check('no runtime errors', errors.length === 0, errors.join('; '))
} finally {
  await browser.close()
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
