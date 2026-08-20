/* ============================================================
   UI end-to-end suite.

   Drives the built app in a real browser against a mocked Supabase
   (scripts/mock-supabase.mjs). Proves the login flows, the client
   portal dashboard and team-space CRUD — including creating a
   company — without needing the live project to be awake.

   Usage:
     npm run build && npm run preview &
     node scripts/e2e-ui.mjs [baseURL]
   ============================================================ */

import { chromium } from 'playwright'
import { installMock, makeDb } from './mock-supabase.mjs'

const BASE = process.argv[2] || 'http://localhost:4173'
const PASSWORD = 'correct-horse'

let pass = 0, fail = 0
const results = []

function check(name, ok, detail = '') {
  if (ok) { pass++; results.push(`  ✓ ${name}`) }
  else { fail++; results.push(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

async function run() {
  const browser = await chromium.launch()

  /* ---------------- CLIENT PORTAL ---------------- */
  {
    const db = makeDb()
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await installMock(page, { db })

    await page.goto(`${BASE}/portal`, { waitUntil: 'networkidle' })
    results.push('\nCLIENT PORTAL')

    // wrong key
    await page.fill('.portal-key', 'WRONG-KEY-0000')
    await page.click('button.btn--accent')
    await page.waitForTimeout(900)
    const wrongMsg = (await page.textContent('.auth-error'))?.trim() || ''
    check('rejects an invalid access key', /invalid access key/i.test(wrongMsg), wrongMsg)
    check('does not blame the network for a bad key', !/unable to reach/i.test(wrongMsg), wrongMsg)

    // right key
    await page.fill('.portal-key', 'ACME-DEMO-2026')
    await page.click('button.btn--accent')
    await page.waitForTimeout(1600)
    const body = await page.evaluate(() => document.body.innerText)
    check('signs in with a valid access key', /Acme Corp/.test(body))
    check('renders the quote reference', /Q-2026-001/.test(body))
    check('formats money as GBP', /£8,400\.00/.test(body), body.match(/£[\d,.]+/)?.[0])
    check('renders project progress', /65% complete/.test(body))
    check('renders documents', /Signed service agreement/.test(body))

    // past meetings must not offer a Join button
    const joins = await page.$$eval('a', (as) =>
      as.filter((a) => /join/i.test(a.textContent || '')).length)
    check('offers Join only for upcoming meetings', joins === 1, `found ${joins}`)

    // signed URLs are minted on click, never embedded in the markup
    const staticHrefs = await page.$$eval('a[href]', (as) =>
      as.map((a) => a.getAttribute('href')).filter((h) => h && h.includes('token=')).length)
    check('does not embed signed URLs in the markup', staticHrefs === 0)

    check('no runtime errors', errors.length === 0, errors[0])
    await page.close()
  }

  /* ---------------- TEAM SPACE ---------------- */
  {
    const db = makeDb()
    const reqs = []
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('request', (r) => { if (r.url().includes('/rest/v1/')) reqs.push(r.url()) })
    await installMock(page, { db, password: PASSWORD })

    await page.goto(`${BASE}/team`, { waitUntil: 'networkidle' })
    results.push('\nTEAM SPACE')

    // wrong password
    await page.fill('input[type=email]', 'alex@nabl.agency')
    await page.fill('input[type=password]', 'nope')
    await page.click('button.btn--accent')
    await page.waitForTimeout(1200)
    const badMsg = (await page.textContent('.auth-error'))?.trim() || ''
    check('rejects a wrong password', /incorrect email or password/i.test(badMsg), badMsg)

    // correct password
    await page.fill('input[type=password]', PASSWORD)
    await page.click('button.btn--accent')
    await page.waitForTimeout(2200)
    const greeting = (await page.textContent('h1').catch(() => '')) || ''
    check('signs in with the correct password', /Hey, Alex/.test(greeting), greeting)

    const tabs = await page.$$eval('.tab', (ts) => ts.map((t) => t.textContent?.trim()))
    check('renders all five tabs', tabs.length === 5, tabs.join('|'))

    // ---- company creation ----
    await page.click('.controls button.btn--accent')
    await page.waitForTimeout(700)
    check('opens the create form', await page.isVisible('.entity-form'))

    await page.fill('#f-business_name', 'Globex Industries')
    await page.fill('#f-contact_name', 'Hank Scorpio')
    await page.fill('#f-contact_email', 'hank@globex.example')
    await page.click('.keyrow button')
    await page.waitForTimeout(250)
    const genKey = await page.inputValue('#f-access_key')
    // PREFIX-XXXX-XXXX-XXXX over a 31-glyph alphabet with O/0/I/1/L removed.
    check('generates an access key in the house format',
      /^GLOBEX-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}(-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}){2}$/.test(genKey),
      genKey)
    check('the generated key has no ambiguous glyphs',
      !/[O0I1L]/.test(genKey.split('-').slice(1).join('')), genKey)

    await page.click('.entity-form button[type=submit]')
    await page.waitForTimeout(1800)
    const created = db.clients.find((c) => c.business_name === 'Globex Industries')
    check('persists the new company to the database', !!created)
    check('persists its contact details',
      created?.contact_email === 'hank@globex.example', created?.contact_email)
    check('persists the generated access key', created?.access_key === genKey, created?.access_key)
    const afterCreate = await page.evaluate(() => document.body.innerText)
    check('shows the new company in the list', /Globex Industries/.test(afterCreate))

    // Creating a client should lead straight into its welcome pack — the step
    // that was previously left to memory.
    // Wait for it rather than sampling — the modal opens after the save and
    // refresh resolve, and an instant isVisible() check races that.
    const packModal = await page.waitForSelector('.modal--doc', { timeout: 4000 })
      .then(() => true).catch(() => false)
    check('creating a client opens its welcome pack', packModal)
    // Dismiss unconditionally: if it did open and we skip this, the overlay
    // swallows every later click in this block and the failure looks unrelated.
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForSelector('.modal--doc', { state: 'detached', timeout: 4000 }).catch(() => {})
    // And a client with no pack yet says so on its row.
    const flags = await page.$$eval('.packflag', (es) => es.map((e) => e.textContent?.trim()))
    check('a client with no welcome pack is flagged as such',
      flags.some((f) => /no welcome pack yet/i.test(f || '')), flags.join('|'))

    // ---- validation ----
    await page.click('.controls button.btn--accent')
    await page.waitForTimeout(600)
    await page.click('.entity-form button[type=submit]')
    await page.waitForTimeout(600)
    const fieldErrs = await page.$$eval('.field-error', (es) =>
      es.map((e) => e.textContent?.trim()).filter(Boolean))
    check('blocks an empty required field', fieldErrs.some((e) => /required/i.test(e)),
      fieldErrs.join('|'))
    await page.click('.entity-form button.btn--ghost')   // cancel
    await page.waitForTimeout(500)

    // ---- quotes tab: upload zone + money field ----
    await page.click('.tabs button:nth-child(2)')
    await page.waitForTimeout(1100)
    await page.click('.controls button.btn--accent')
    await page.waitForTimeout(700)
    check('quotes form exposes an upload zone', await page.isVisible('.drop'))
    const hint = (await page.textContent('.drop__hint').catch(() => '')) || ''
    check('quote upload states the PDF limit', /10MB/.test(hint) && /PDF/i.test(hint), hint)
    check('quotes form has a currency field', await page.isVisible('.money'))
    await page.click('.entity-form button.btn--ghost')
    await page.waitForTimeout(400)

    // ---- projects tab (the table with no created_at) ----
    await page.click('.tabs button:nth-child(3)')
    await page.waitForTimeout(1200)
    const projBody = await page.evaluate(() => document.body.innerText)
    check('projects tab loads', /Weekly reporting pack/.test(projBody))

    // The projects table has no created_at column, so ANY order= on it errors
    // server-side and silently empties the tab. Assert on the real requests.
    const projReqs = reqs.filter((u) => /\/rest\/v1\/projects\b/.test(u))
    check('queries the projects table', projReqs.length > 0, `${projReqs.length} requests`)
    check('never orders the projects query',
      projReqs.length > 0 && projReqs.every((u) => !/[?&]order=/.test(u)),
      projReqs.find((u) => /[?&]order=/.test(u)) || '')
    // ...while the tables that DO have their sort column still get ordered.
    const quoteReqs = reqs.filter((u) => /\/rest\/v1\/quotes\b/.test(u))
    check('still orders quotes by created_at',
      quoteReqs.some((u) => /order=created_at/.test(u)), `${quoteReqs.length} requests`)

    // ---- documents tab ----
    await page.click('.tabs button:nth-child(5)')
    await page.waitForTimeout(1200)
    await page.click('.controls button.btn--accent')
    await page.waitForTimeout(700)
    const docHint = (await page.textContent('.drop__hint').catch(() => '')) || ''
    check('document upload states the 25MB limit', /25MB/.test(docHint), docHint)
    check('document upload accepts any file type', !/PDF only/i.test(docHint), docHint)

    check('no runtime errors', errors.length === 0, errors[0])
    await page.close()
  }

  /* ---------------- SALES CRM ---------------- */
  {
    const db = makeDb()
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await installMock(page, { db, password: PASSWORD })
    results.push('\nSALES CRM')

    // signed out -> must invite sign-in, not crash
    await page.goto(`${BASE}/crm`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const signedOut = await page.evaluate(() => document.body.innerText)
    check('signed out shows a sign-in prompt, not a broken page',
      /sign in/i.test(signedOut) && !/undefined|NaN/.test(signedOut))

    // sign in through the team page, then come back
    await page.goto(`${BASE}/team`, { waitUntil: 'networkidle' })
    await page.fill('input[type=email]', 'alex@nabl.agency')
    await page.fill('input[type=password]', PASSWORD)
    await page.click('button.btn--accent')
    await page.waitForTimeout(2000)
    await page.goto(`${BASE}/crm`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    const crm = await page.evaluate(() => document.body.innerText)
    check('CRM loads for a signed-in team member', !/sign in through/i.test(crm))

    // the whole point: no AI anywhere in the visible copy
    const aiWords = (crm.match(/\b(AI|OpenAI|GPT|discovery run|regenerate research|research run)\b/gi) || [])
      .filter((w) => !/^researching$/i.test(w))
    check('no AI wording remains in the interface', aiWords.length === 0, aiWords.join(','))

    // all ten pipeline stages must be present and exact
    const STAGES = ['New Lead', 'Researching', 'Ready To Contact', 'Contacted',
      'Follow Up Required', 'Replied', 'Meeting Scheduled', 'Proposal Sent', 'Won', 'Lost']
    const missing = STAGES.filter((s) => !crm.includes(s))
    check('all ten pipeline stages render', missing.length === 0, missing.join(','))

    check('no runtime errors', errors.length === 0, errors[0])
    await page.close()
  }

  /* ---------------- ROUTES ---------------- */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await installMock(page, { db: makeDb() })
    results.push('\nROUTES')
    for (const [path, expect] of [
      ['/', /We make your business work smarter/],
      ['/privacy', /Privacy Policy/i],
      ['/terms', /Terms of Service/i],
      ['/cookies', /Cookie Policy/i],
      ['/definitely-not-a-page', /Nothing here/i],
    ]) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(700)
      const t = await page.evaluate(() => document.body.innerText)
      check(`${path} renders`, expect.test(t))
    }
    await page.close()
  }

  await browser.close()

  console.log(results.join('\n'))
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

run().catch((e) => { console.error('harness error:', e.message); process.exit(2) })
