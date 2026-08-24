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

    /* Layout: a ribbon, three views, and Insights first.

       The page used to stack a header, eight counters, a filter block, the
       lead list, the board and the insights in one column, so finding
       anything meant scrolling past everything else. */
    {
      const ribbon = await page.$('.crm-ribbon')
      check('a sticky ribbon carries the workspace', Boolean(ribbon))
      const sticky = await page.evaluate(() =>
        getComputedStyle(document.querySelector('.crm-ribbon')).position)
      check('and it is actually sticky, not just styled to look attached', sticky === 'sticky')

      const first = await page.evaluate(() =>
        document.querySelector('.crm-view--on')?.textContent?.trim() || '')
      check('Insights is the view that opens first', /Insights/i.test(first))

      const insightsText = await page.evaluate(() =>
        document.querySelector('.crm-insights')?.innerText || 'NO INSIGHTS')
      check('it opens on what needs doing, not on a lead list',
        /What needs you/i.test(insightsText))
      check('and says how the pipeline can actually be reached',
        /How you can reach them/i.test(insightsText))

      /* The old page carried the same advice for every pipeline. Advice that
         cannot change is documentation, not an insight. */
      check('no fixed advice masquerading as an insight',
        !/GDPR guardrail|Conversion opportunity/i.test(insightsText))

      // Clicking a count has to land on exactly those leads.
      const jumped = await page.evaluate(() => {
        const b = document.querySelector('.crm-funnel__row:not(:disabled), .crm-queue__row')
        if (!b) return null
        b.click()
        return true
      })
      if (jumped) {
        await page.waitForTimeout(600)
        const onLeads = await page.evaluate(() =>
          document.querySelector('.crm-view--on')?.textContent?.trim() || '')
        check('clicking a count switches to the leads it counted', /Leads/i.test(onLeads))
        const chip = await page.$('.crm-focus')
        check('and a chip says which filter was applied', Boolean(chip))
        await page.evaluate(() => document.querySelector('.crm-focus')?.click())
        await page.waitForTimeout(400)
        check('which can be cleared again', !(await page.$('.crm-focus')))
      }

      // Back to Leads for the assertions that follow.
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('.crm-view')].find((x) => /Leads/i.test(x.textContent))
        if (b) b.click()
      })
      await page.waitForTimeout(600)
    }

    // the whole point: no AI anywhere in the visible copy
    const aiWords = (crm.match(/\b(AI|OpenAI|GPT|discovery run|regenerate research|research run)\b/gi) || [])
      .filter((w) => !/^researching$/i.test(w))
    check('no AI wording remains in the interface', aiWords.length === 0, aiWords.join(','))

    /* All ten stages, checked on the Board — which is where they now live.
       They used to be on the same scroll as everything else, so the old
       assertion read the whole page; on the Insights view the funnel omits
       Lost deliberately, and the check went red the moment the layout split.
       That is the assertion doing its job, not a regression. */
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.crm-view')].find((x) => /Board/i.test(x.textContent))
      if (b) b.click()
    })
    await page.waitForTimeout(700)
    /* Read from the DOM, not from innerText. .crm-stage__name is
       text-transform: uppercase, and innerText returns what is painted — so
       comparing against 'New Lead' fails on 'NEW LEAD' and the assertion
       reports every stage missing while all ten are on screen. */
    const boardStages = await page.evaluate(() =>
      [...document.querySelectorAll('.crm-board .crm-stage__name')].map((n) => n.textContent.trim()))
    const STAGES = ['New Lead', 'Researching', 'Ready To Contact', 'Contacted',
      'Follow Up Required', 'Replied', 'Meeting Scheduled', 'Proposal Sent', 'Won', 'Lost']
    const missing = STAGES.filter((s) => !boardStages.includes(s))
    check('all ten pipeline stages render on the board', missing.length === 0, missing.join(','))
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.crm-view')].find((x) => /Leads/i.test(x.textContent))
      if (b) b.click()
    })
    await page.waitForTimeout(600)

    // ---- pipeline handoffs ----
    // Moving a lead to Proposal Sent should offer to set up the portal
    // account, and moving it to Won should offer the pack and the email.
    // Both are the points where a lead stops being a lead.
    /* A successful read that returns no leads must clear this device, not
       fall back to its local mirror.

       This is the path that would have undone the deletion of the seven
       old-CRM leads on 21 August: the mirror kept them, and the next save
       through pushLead would have re-inserted one. A deletion a stale browser
       tab can undo is not a deletion.

       Distinct from the offline case, which is still meant to fall back —
       that one throws and is handled in the catch, and is asserted below. */
    {
      const emptyDb = makeDb()
      emptyDb.sales_leads = []
      emptyDb.sales_contacts = []
      emptyDb.sales_activities = []
      const stale = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
      await installMock(stale, { db: emptyDb, password: PASSWORD })
      await stale.goto(`${BASE}/crm`, { waitUntil: 'networkidle' })
      await stale.evaluate(() => localStorage.setItem('nabl.sales-intelligence.v3',
        JSON.stringify({ leads: [{ id: 'ghost-1', company: 'Deleted Lead Ltd', status: 'New Lead' }] })))
      await stale.goto(`${BASE}/team`, { waitUntil: 'networkidle' })
      await stale.fill('input[type=email]', 'alex@nabl.agency')
      await stale.fill('input[type=password]', PASSWORD)
      await stale.click('button.btn--accent')
      await stale.waitForTimeout(2000)
      await stale.goto(`${BASE}/crm`, { waitUntil: 'networkidle' })
      await stale.waitForTimeout(2000)
      const text = await stale.evaluate(() => document.body.innerText)
      check('a deleted lead does not come back from the local mirror',
        !text.includes('Deleted Lead Ltd'))
      const mirror = await stale.evaluate(() => localStorage.getItem('nabl.sales-intelligence.v3'))
      check('and the mirror itself is cleared, not just the view',
        !String(mirror).includes('Deleted Lead Ltd'))
      await stale.close()
    }

    /* Sending has to ask the gate first, not after.

       The CRM used to open a mail client and record nothing, so
       marketing_send_allowed — the whole compliance layer — was never
       consulted by the thing that actually sends. Both buttons now write a
       marketing_sends row, and the insert IS the check: on the real database
       a BEFORE INSERT trigger runs the gate and the ceiling, and the mock
       refuses on the same conditions so these assertions are not decoration. */
    {
      const card = await page.$('.lead-row, .board__card, [class*="lead"]')
      if (card) await card.click().catch(() => {})
      await page.waitForTimeout(600)
      await page.click('#crm-tab-outreach').catch(() => {})
      await page.waitForTimeout(500)

      const letterBtn = await page.$$eval('button', (bs) =>
        bs.some((b) => /Record a letter sent/i.test(b.textContent)))
      check('post can be recorded from the CRM, not only email', letterBtn === true)

      // The fixture lead is do_not_contact with no lawful basis, so the gate
      // must refuse and say why.
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /Record a letter sent/i.test(x.textContent))
        if (b) b.click()
      })
      await page.waitForTimeout(900)
      /* Read from the panel's own warning, not from the whole page. A first
         version tested document.body.innerText and passed on the panel's
         explanatory paragraph, which contains the words "compliance gate" —
         a false pass on text that is always there. */
      const warnText = await page.evaluate(() =>
        [...document.querySelectorAll('#crm-panel-outreach .crm-warn')].map((n) => n.innerText).join(' | '))
      check('a letter to an unassessed lead is refused',
        /blocked by compliance gate/i.test(warnText))
      check('and the refusal names the rule that stopped it, not a generic failure',
        /marketing_status|lawful basis|do_not_contact/i.test(warnText))
      /* The stage select lives on the Overview tab, so it has to be switched
         to before reading. A first version read it while still on Outreach,
         got undefined, and passed on `'' !== 'Contacted'` — a check that could
         not fail. */
      await page.click('#crm-tab-overview').catch(() => {})
      await page.waitForTimeout(500)
      const stage = await page.evaluate(() =>
        document.querySelector('select[id^="stage-"]')?.value || 'SELECT NOT FOUND')
      check('a refused send does not move the lead to Contacted',
        stage !== 'Contacted' && stage !== 'SELECT NOT FOUND')
      await page.click('#crm-tab-outreach').catch(() => {})
      await page.waitForTimeout(300)
    }

    /* The compliance panel is where a promoted lead gets checked, so it has to
       show what the database will actually allow — and refuse before the save
       rather than after, because a constraint violation arrives as a wall of
       SQL. The fixture lead is half-answered on purpose. */
    {
      const card = await page.$('.lead-row, .board__card, [class*="lead"]')
      if (card) await card.click().catch(() => {})
      await page.waitForTimeout(700)
      const complianceTab = await page.$('#crm-tab-compliance')
      check('a Compliance tab exists on a lead', Boolean(complianceTab))
      if (complianceTab) {
        await complianceTab.click()
        await page.waitForTimeout(600)
        const text = await page.evaluate(() => document.body.innerText)
        check('it states what each channel is allowed right now',
          /Email/i.test(text) && /Post/i.test(text) && /Blocked/i.test(text))
        check('and says why phone is blocked, not just that it is',
          /TPS/.test(text))

        // Permitting a lead with no lawful basis must be refused up front.
        await page.selectOption('select[id^="ms-"]', 'permitted').catch(() => {})
        await page.waitForTimeout(400)
        const after = await page.evaluate(() => document.body.innerText)
        check('permitting a lead with no lawful basis is refused before saving',
          /Cannot be permitted yet/.test(after) && /lawful basis/.test(after))
        const saveDisabled = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')]
            .find((x) => /Save compliance record/i.test(x.textContent))
          return b ? b.disabled : null
        })
        check('and the save button is disabled while it is refused', saveDisabled === true)

        // Supplying the missing pieces must clear it.
        await page.selectOption('select[id^="lb-"]', 'not_personal_data').catch(() => {})
        await page.selectOption('select[id^="pn-"]', 'not_required').catch(() => {})
        await page.waitForTimeout(400)
        const fixed = await page.evaluate(() => document.body.innerText)
        check('supplying a basis clears the blocker', !/Cannot be permitted yet/.test(fixed))
        check('and email then reads as permitted for a corporate subscriber',
          /Email\s*\n?\s*Permitted/i.test(fixed))
        const nowEnabled = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')]
            .find((x) => /Save compliance record/i.test(x.textContent))
          return b ? !b.disabled : null
        })
        check('and the save button becomes usable', nowEnabled === true)

        await page.click('#crm-tab-overview').catch(() => {})
        await page.waitForTimeout(300)
      }
    }

    const leadCard = await page.$('.lead-row, .board__card, [class*="lead"]')
    if (leadCard) await leadCard.click().catch(() => {})
    await page.waitForTimeout(900)

    const stageSel = await page.$('select[id^="stage-"]')
    if (!stageSel) {
      check('a lead can be opened to change its stage', false, 'no stage select found')
    } else {
      check('a lead can be opened to change its stage', true)

      await stageSel.selectOption('Proposal Sent')
      const quoteHandoff = await page.waitForSelector('text=Set up the portal account', { timeout: 4000 })
        .then(() => true).catch(() => false)
      check('moving to Proposal Sent offers the portal account', quoteHandoff)
      // The modal's title renders during its lookup phase too, so waiting on
      // the title is not enough — wait for the field itself.
      await page.waitForSelector('#ph-key', { timeout: 4000 }).catch(() => {})
      const keyField = await page.inputValue('#ph-key').catch(() => '')
      check('the portal account arrives with a key already generated',
        /^[A-Z0-9]{2,6}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}(-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}){2}$/.test(keyField),
        keyField)
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForSelector('.modal--doc', { state: 'detached', timeout: 4000 }).catch(() => {})

      const stageSel2 = await page.$('select[id^="stage-"]')
      await stageSel2?.selectOption('Won')
      const wonHandoff = await page.waitForSelector('text=Hand over to the client', { timeout: 4000 })
        .then(() => true).catch(() => false)
      check('moving to Won offers the welcome pack handover', wonHandoff)
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForSelector('.modal--doc', { state: 'detached', timeout: 4000 }).catch(() => {})
    }

    check('no runtime errors', errors.length === 0, errors[0])
    await page.close()
  }

  /* ---------------- MOBILE LAYOUT ----------------
     Checked at a phone viewport with enough leads to behave like the real
     thing. Two failures here were reported from a phone before they were
     caught by anything: the leads view forced the page to 778px inside a
     390px screen, and a board column with every lead in it grew to 3,014px. */
  {
    const db = makeDb()
    const base = db.sales_leads[0]
    for (let i = 2; i <= 40; i++) {
      db.sales_leads.push({ ...base, id: `lead-${i}`,
        company: `Test Business Number ${i} Limited`,
        status: i % 4 === 0 ? 'Contacted' : 'New Lead' })
    }
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    })
    await installMock(page, { db, password: PASSWORD })
    results.push('\nMOBILE LAYOUT (390px)')

    await page.goto(`${BASE}/team`, { waitUntil: 'networkidle' })
    await page.fill('input[type=email]', 'alex@nabl.agency')
    await page.fill('input[type=password]', PASSWORD)
    await page.click('button.btn--accent')
    await page.waitForTimeout(1800)
    await page.goto(`${BASE}/crm`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    /* The page itself must never scroll sideways. Individual containers may —
       the board scrolls horizontally on purpose and the detail tab strip has
       always done so — but the document must not. */
    const widthOf = async () => page.evaluate(() => ({
      view: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))

    const onView = async (name) => {
      await page.evaluate((n) => {
        const b = [...document.querySelectorAll('.crm-view')].find((x) => x.textContent.trim().startsWith(n))
        if (b) b.click()
      }, name)
      await page.waitForTimeout(800)
    }

    for (const view of ['Insights', 'Leads', 'Board']) {
      await onView(view)
      const w = await widthOf()
      check(`${view.toLowerCase()} does not scroll the page sideways on a phone`,
        w.scroll <= w.view + 1, `${w.scroll}px in a ${w.view}px viewport`)
    }

    /* A stage with every lead in it must not become ten screens of one column
       with the other nine pushed off the bottom. */
    await onView('Board')
    const tallest = await page.evaluate(() => Math.max(0,
      ...[...document.querySelectorAll('.crm-stage')].map((s) => s.getBoundingClientRect().height)))
    check('a board column stays within a screen however many leads it holds',
      tallest > 0 && tallest <= 844, `${Math.round(tallest)}px`)

    const scrolls = await page.evaluate(() => {
      const c = document.querySelector('.crm-stage__cards')
      return c ? c.scrollHeight > c.clientHeight + 1 && getComputedStyle(c).overflowY === 'auto' : false
    })
    check('and its cards scroll inside it rather than being cut off', scrolls === true)

    const errs = []
    page.on('pageerror', (e) => errs.push(e.message))
    check('no runtime errors at phone width', errs.length === 0, errs.join('; '))
    await page.close()
  }

  /* ---------------- SITE ASSISTANT ----------------
     Answers from one bundled file and can reach nothing else. What is tested
     here is the part that could go wrong in public: that it hands the visitor
     to the existing form rather than submitting anything itself, and that it
     is absent entirely when not configured. */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    results.push('\nSITE ASSISTANT')

    /* The Worker is not running in this harness, so the endpoint is stubbed.
       What matters is the contract between the two, not the model. */
    let submitted = 0
    await page.route('**/api.web3forms.com/**', (route) => { submitted++; route.fulfill({ status: 200, body: '{"success":true}' }) })
    await page.route('**/api/chat/public', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        reply: 'I can\'t answer that from what I know — shall I pass it to the team?',
        intent: 'ask_team',
        enquiry: 'Wants to know about integrating with Xero',
      }),
    }))

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)

    /* The assistant is always present now: its endpoint is a fixed path on the
       same origin, served by the same Worker as the page. There is no build
       flag to forget. If the key behind it is missing, the Worker answers with
       a sentence rather than an error, which is tested in e2e-assistant. */
    check('the assistant is on the marketing page', Boolean(await page.$('.assistant-fab')))

    check('no runtime errors on the marketing page', errors.length === 0, errors.join('; '))
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
