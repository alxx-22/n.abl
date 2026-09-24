/* How much scrolling does the CRM actually demand?

   The complaint was "there is way too much scrolling", made on a phone, and
   nothing in this repo could answer it. check-css-tokens.mjs proves the
   colours resolve, check-seo.mjs proves the markup is right, e2e-ui.mjs
   proves the buttons work — all of them on one desktop viewport, and a
   layout that is four thousand pixels tall passes every one of them. The
   only measurement anybody had was somebody's thumb.

   So this measures the thing being complained about: the height of the
   document as a multiple of the viewport it is being read on. "This screen
   is 6.2 viewports tall" is a number two people can argue about. "It feels
   long" is not. Alongside it go the four other things that make a small
   screen unusable and that a desktop check cannot see — sideways overflow,
   tap targets too small to hit, text too small to read, and a sticky header
   eating a short viewport.

   TWO WAYS IN, because /crm is behind a Supabase team sign-in:

     --url <origin>   Drive a running server. /crm renders the "Team sign-in
                      needed" gate rather than the CRM, which is still worth
                      measuring — the gate is a screen people meet — and any
                      public route can be pointed at the same way.

     --harness        The one that measures the CRM itself. Renders a single
                      component against a fixture in a throwaway Vite project,
                      with src/lib/supabase.js aliased to a stub, so no auth
                      is involved and none is attempted.

   Usage:
     npm run build && npm run preview &
     node scripts/check-crm-usability.mjs --url http://localhost:4173
     node scripts/check-crm-usability.mjs --url http://localhost:4173 --route /portal

     node scripts/check-crm-usability.mjs --harness
     node scripts/check-crm-usability.mjs --harness --fixture ./outreach.json
     node scripts/check-crm-usability.mjs --harness --expand
     node scripts/check-crm-usability.mjs --harness --component leadgen --expand
     node scripts/check-crm-usability.mjs --harness --component leads --expand
     node scripts/check-crm-usability.mjs --harness --component argument --sheet
     node scripts/check-crm-usability.mjs --harness --screenshots ./shots --json

   Exits non-zero when a threshold below is breached, like every other
   checker here, so it can sit in front of a deploy.
*/

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/* ============================================================
   VIEWPORTS

   Real devices and real aspect ratios. Round numbers hide problems:
   a layout can be clean at 375×667 and broken at 360×800 because the
   breakpoint sits between them. Edit this list freely — it is the
   only place sizes are stated.
   ============================================================ */
const VIEWPORTS = [
  { name: 'iPhone 14',      w: 390,  h: 844,  kind: 'phone',   note: '19.5:9' },
  { name: 'iPhone Pro Max', w: 430,  h: 932,  kind: 'phone',   note: '19.5:9' },
  { name: 'Android',        w: 360,  h: 800,  kind: 'phone',   note: 'narrowest realistic phone' },
  { name: 'iPad portrait',  w: 768,  h: 1024, kind: 'tablet',  note: '4:3' },
  { name: 'iPad landscape', w: 1024, h: 768,  kind: 'tablet',  note: '4:3' },
  { name: 'iPad Air',       w: 820,  h: 1180, kind: 'tablet',  note: '' },
  { name: 'Laptop 16:10',   w: 1280, h: 800,  kind: 'desktop', note: '16:10' },
  { name: 'Laptop 1440',    w: 1440, h: 900,  kind: 'desktop', note: '16:10' },
  { name: 'Desktop 1080p',  w: 1920, h: 1080, kind: 'desktop', note: '16:9' },
  { name: 'Ultrawide',      w: 2560, h: 1080, kind: 'desktop', note: '21:9' },
  { name: 'Short laptop',   w: 1280, h: 600,  kind: 'desktop', note: 'short and wide — where sticky headers hurt' },
]

/* ============================================================
   THRESHOLDS

   Defaults, not laws. Two of them are standards; the rest are
   judgement, and the judgement is written down so it can be argued
   with rather than guessed at.
   ============================================================ */

/* WCAG 2.2 Success Criterion 2.5.8 Target Size (Minimum), Level AA:
   a pointer target must be at least 24×24 CSS pixels, unless spacing,
   an equivalent control, inline text or user-agent default rescues it.
   This is a published standard, not a preference. */
const MIN_TAP_PX = 24

/* 12px is the floor below which body text stops being readable at arm's
   length on a phone. There is no SC for absolute size — 1.4.4 is about
   zoom — so this one is judgement, set low deliberately so that only
   genuinely tiny text trips it. */
const MIN_FONT_PX = 12

/* A JUDGEMENT CALL, and the one most worth arguing about. Four viewports
   of scrolling on a phone is roughly four thumb flicks to reach the
   bottom of a screen somebody opens twenty times a day. Below 4× the
   page reads as a screen; well above it, as a document. Nothing sacred
   about the number — move it, but move it on purpose. */
const MAX_PAGE_VIEWPORTS_PHONE = 4

/* Anything wider than the viewport means a sideways scrollbar and a
   layout that drifts under the thumb. One pixel of tolerance for
   sub-pixel rounding in the layout engine. */
const OVERFLOW_TOLERANCE_PX = 1

/* A viewport this short or shorter is treated as "short" for the sticky
   check: a laptop with browser chrome, or a phone in landscape. */
const SHORT_VIEWPORT_PX = 700

/* A sticky header is rent paid on every screenful. A quarter of a short
   viewport is the point at which it stops being a convenience. */
const STICKY_MAX_SHARE = 0.25

/* Anything this wide or narrower is judged by the phone rules. */
const PHONE_MAX_WIDTH = 500

/* Where the primary action should sit, in viewports from the top. Past
   this, the main thing the screen is for is below the fold twice over. */
const PRIMARY_ACTION_MAX_VIEWPORTS = 1.5

/* ---------------- arguments ---------------- */
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name, fallback = null) => {
  const i = argv.indexOf(name)
  return i === -1 || i === argv.length - 1 ? fallback : argv[i + 1]
}

const MODE_URL = value('--url')
const MODE_HARNESS = flag('--harness')
const AS_JSON = flag('--json')
const SHOT_DIR = value('--screenshots')
const FIXTURE = value('--fixture')
const ROUTE = value('--route', '/crm')
/* The one control the screen exists to reach. In the outreach log that is
   the Run settings button; on the sign-in gate it is the submit button. */
const PRIMARY = value('--primary', '.ol-counts__btn, .btn--accent, button[type="submit"]')
/* The landing state of a screen is its shortest state. Somebody who is
   actually working has the run panel open and a lead selected, and that is
   the state the complaint was made about, so it is worth measuring too. */
const EXPAND = flag('--expand')
/* Which CRM tab the harness renders. Both lay out on the same .ol- classes
   and both have been measured on the same phones. */
const COMPONENTS = {
  argument: { file: 'components/OutreachLog.jsx', name: 'OutreachLog', tab: 'Argument log' },
  leadgen: { file: 'components/LeadGen.jsx', name: 'LeadGen', tab: 'Lead gen' },
  /* The whole CRM page, real ribbon and all, switched to its Leads view.
     Its tables are read through the stub's from(), which answers from
     the fixture's "tables". */
  leads: { file: 'pages/Crm.jsx', name: 'Crm', tab: 'Leads', page: true },
}
const COMPONENT = COMPONENTS[value('--component', 'argument')]
if (!COMPONENT) {
  console.error(`--component is one of: ${Object.keys(COMPONENTS).join(', ')}`)
  process.exit(2)
}

if (!MODE_URL && !MODE_HARNESS) {
  console.error(`
  Usage: node scripts/check-crm-usability.mjs --harness
         node scripts/check-crm-usability.mjs --url http://localhost:4173 [--route /crm]

  Options: --component argument|leadgen|leads  --sheet  --fixture <f.json>  --screenshots <dir>  --primary <selector>  --expand  --json
`)
  process.exit(2)
}

/* ============================================================
   THE FIXTURE

   Shaped like one page of public.outreach_dashboard(): the whole
   screen as one jsonb document. Small on purpose — a fixture this
   thin is the best case, so every number below is a floor, not a
   worst case. Pass a real export with --fixture for the true shape.
   ============================================================ */
const BUILTIN_FIXTURE = {
  status: { waiting: 412, assessed: 180, written: 64, given_up: 11 },
  send_blockers: [
    { what: 'No postal address configured', why: 'PECR requires one in every message' },
    { what: 'Unsubscribe endpoint unverified', why: 'the one-click route has not answered a test' },
  ],
  towns: [
    { key: 'Nottingham', n: 120 }, { key: 'Alcester', n: 44 }, { key: 'Derby', n: 61 },
    { key: 'Leicester', n: 38 }, { key: 'Mansfield', n: 22 }, { key: 'Redditch', n: 17 },
  ],
  sectors: [
    { key: 'manufacturing', n: 71 }, { key: 'professional_services', n: 58 },
    { key: 'logistics', n: 33 }, { key: 'hospitality', n: 27 }, { key: 'retail', n: 44 },
  ],
  capability_terms: [
    { term: 'automation', label: 'Automation' }, { term: 'data', label: 'Data and analytics' },
    { term: 'web', label: 'Web' }, { term: 'ai', label: 'AI' },
  ],
  targets: [{
    id: 'tgt-1', name: 'Nottingham manufacturing', towns: ['Nottingham'],
    sectors: ['manufacturing'], capabilities: ['automation'], min_score: 55,
    is_default: true, sending_enabled: false,
  }],
  models: [
    { model: 'gemini-2.5-flash', key_secret: 'GEMINI_MAIN_API_KEY', used: 1420, exhausted: false, observed_rpd: null },
    { model: 'gemini-2.5-pro', key_secret: 'GEMINI_SPARE_API_KEY', used: 96, exhausted: true, observed_rpd: 100 },
  ],
  leads: Array.from({ length: 24 }, (_, i) => ({
    id: `lead-${i}`,
    company: `Example Works ${i + 1} Limited`,
    registered: `Example Works ${i + 1} Ltd`,
    town: ['Nottingham', 'Alcester', 'Derby', 'Leicester'][i % 4],
    sector: ['manufacturing', 'logistics', 'retail', 'professional_services'][i % 4],
    score: 40 + ((i * 7) % 55),
    band: i % 3 === 0 ? 'strong' : 'fair',
    presence: 'brochure_site',
    credit: 'no_adverse',
    state: ['waiting', 'drafted', 'no_clause', 'given_up'][i % 4],
    assessed: i % 4 !== 0,
    caps_any: ['automation'],
    suppressed: false,
    summary: 'A long-established family firm running quoting and scheduling on spreadsheets, with three people re-keying the same job numbers.',
    clause: i % 2 === 0 ? 'Your quote-to-job handover is typed twice, and the second typing is where the numbers drift.' : null,
    evidence: i % 2 === 0 ? 'we still do our scheduling on a whiteboard and a spreadsheet' : null,
    basis: 'site',
    letter: i % 2 === 0 ? {
      subject: 'The second typing',
      body: 'Dear owner,\n\nYou publish that scheduling runs on a whiteboard.\n\nThat is the fix.',
      approved_at: null,
      tension: 'They are proud of the whiteboard and wary of software.',
      recognition: 'The re-keying is the part they complain about.',
      must_not_imply: 'That the way they work today is foolish.',
    } : null,
    moves: [
      { agent: 'scout', decision: 'accept', angle: 'operations', reason: 'A public page names the manual step.', model: 'gemini-2.5-flash' },
      { agent: 'strategist', decision: 'draft', angle: 'double entry', reason: 'One clause, one piece of evidence.', model: 'gemini-2.5-pro' },
    ],
  })),
}

/* One reply as a model sends it: JSON with a "say" field. Long on
   purpose - the transcript is the part of these screens most likely to
   push a phone off its width. */
const reply = (say, extra = {}) => JSON.stringify({ say, ...extra })

/* Shaped like public.outreach_argument(p_lead_id). */
BUILTIN_FIXTURE.outreach_argument = [
  { round: 1, agent: 'scout', to: 'strategist', decision: 'accept', angle: 'operations', model: 'gemini-2.5-flash',
    said: reply('Their own page says scheduling runs on a whiteboard and a spreadsheet, and three people re-key the same job numbers. That is the hook: https://example.invalid/about-us/our-long-history-of-making-things-by-hand', { verdict: 'accept' }), reason: null },
  { round: 2, agent: 'strategist', to: 'writer', decision: 'draft', angle: 'double entry', model: 'gemini-2.5-pro',
    said: reply('One clause, one piece of evidence. Do not tell them the whiteboard is wrong.'), reason: null },
  { round: 3, agent: 'gate', to: null, decision: 'rejected', angle: null, model: 'none', said: null, reason: 'quote was not on the page' },
]

/* Shaped like public.prospect_dashboard() and prospect_transcript(id),
   keyed by RPC name because the lead-gen tab calls both. */
const LEADGEN_FIXTURE = {
  prospect_dashboard: {
    targets: [{ id: 'pt-1', name: 'Nottingham software', towns: ['Nottingham', 'Derby'], sic_codes: ['62', '7022'],
      incorporated_from: '2015-01-01', incorporated_to: null, running: true, pulled: 40, cursor: {}, exhausted_towns: [] }],
    counts: { queued: 22, working: 1, scored: 9, disputed: 3, no_fit: 4, failed: 1, promoted: 2, researching: 118 },
    services: [{ key: 'ai', label: 'AI' }, { key: 'automation', label: 'Automation' },
      { key: 'data_analytics', label: 'Data and analytics' }, { key: 'software', label: 'Software' }, { key: 'web', label: 'Web' }],
    models: [{ model: 'gemini-2.5-flash', used: 212, exhausted: false, observed_rpd: null, project: 'discovery' },
      { model: 'gemini-2.5-flash', used: 40, exhausted: false, observed_rpd: null, project: 'research' },
      { model: 'gemini-2.5-pro', used: 100, exhausted: true, observed_rpd: 100 }],
    chains: { prospect_research: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'], prospect_specialist: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
    last_run: { id: 7, started_at: '2026-09-23T09:00:00Z', finished_at: '2026-09-23T09:02:00Z', pulled: 0, stages: 4, finished: 1,
      error: 'GEMINI_DISCOVERY_API_KEY is not set: add it in Supabase, Edge Functions, Secrets' },
    last_lookup: { id: 8, started_at: '2026-09-23T09:02:00Z', finished_at: '2026-09-23T09:04:00Z', pulled: 0, stages: 0, finished: 2, detail: { mode: 'lookup' }, error: null },
    candidates: Array.from({ length: 24 }, (_, i) => ({
      id: `cand-${i}`, company: `Example Systems ${i + 1} Limited`, number: String(10000000 + i),
      town: ['Nottingham', 'Derby'][i % 2], activity: 'Business and domestic software development',
      incorporated_on: '2018-04-02', company_type: 'ltd', website: `https://example-systems-${i}.invalid`,
      website_confirmed_by: ['name', 'town'],
      website_outcome: i % 8 === 6 ? `3 of 12 guessed domains exist, none confirmed as theirs — example-systems-${i}ltd.co.uk: exists but turned us away (403); example.com: a placeholder page` : 'confirmed',
      status: ['scored', 'disputed', 'working', 'queued', 'no_fit', 'promoted', i % 16 === 6 ? 'researching' : 'no_site', 'refused'][i % 8], stage: 'specialists', lookup_attempts: i % 16 === 6 ? 1 : 0,
      note: i % 8 === 6 ? 'No website found (none of 12 guessed domains exists). Add it to have the agents read it.'
        : i % 8 === 7 ? 'Refused before any agent: its last accounts were filed as dormant, so it is not trading.' : null,
      cautions: i % 8 === 1 ? ['its accounts are overdue'] : null,
      score: i % 6 === 0 ? 70 + (i % 20) : null,
      services: i % 6 < 2 ? [
        { service: 'automation', status: 'agreed', score: 72, sales_last: 72, specialist_last: 72, turns: 3,
          confirm_question: 'How many hours a week go on re-keying orders from email into the stock system?',
          walk_away_if: 'They already run an integration platform someone maintains.' },
        { service: 'data_analytics', status: 'disputed', score: null, sales_last: 60, specialist_last: 35, turns: 6,
          confirm_question: 'Who builds the monthly numbers, and how long does it take?', walk_away_if: null },
      ] : null,
      error: i % 6 === 4 ? 'No service fits the signals.' : null, attempts: 1, promoted_lead_id: null, moves: 14,
    })),
  },
  prospect_transcript: [
    { seq: 1, stage: 'research', from: 'research', to: 'signals', model: 'gemini-2.5-flash', decision: 'facts',
      said: reply('Found five facts on their own site. F1: they quote by email and re-key orders into a separate stock system. https://example.invalid/services/bespoke-integration-and-order-processing', { facts: [{ id: 'F1' }] }), guard: 'struck F4: quote not on the page' },
    { seq: 2, stage: 'signals', from: 'signals', to: 'research', model: 'gemini-2.5-flash', decision: 'signals',
      said: reply('S1 (strong): manual order re-keying between two systems, rests on F1.'), guard: null },
    { seq: 3, stage: 'specialists', from: 'specialist:automation', to: 'sales', model: 'gemini-2.5-pro', decision: 'counter',
      said: reply('I would put this at 72, not 80: they have one system to connect, not four.', { score: 72 }), guard: null },
    { seq: 4, stage: 'specialists', from: 'sales', to: 'specialist:automation', model: 'gemini-2.5-flash', decision: 'agree',
      said: reply('72 then. Agreed.', { score: 72 }), guard: null },
  ],
}

/* The Leads view reads sales_leads and friends through from(); the
   Service fit and Argument log sections read the outreach dashboard and
   outreach_argument, so both are here too, keyed to the same ids. */
const LEADS_FIXTURE = {
  tables: {
    sales_leads: BUILTIN_FIXTURE.leads.map((l, i) => ({
      id: l.id, company: l.company, website: 'https://example.invalid', industry: nice(l.sector),
      location: l.town, estimated_size: '11-50', business_type: 'SME', lead_score: l.score,
      status: ['New Lead', 'Researching', 'Contacted', 'Replied'][i % 4], owner_name: 'Harness',
      signals: 'Scheduling on a whiteboard.', notes: '', subscriber_type: 'corporate',
      created_at: '2026-09-01T09:00:00Z', updated_at: '2026-09-20T09:00:00Z',
    })),
    sales_contacts: [], sales_activities: [], sales_email_drafts: [],
  },
  outreach_dashboard: {
    ...BUILTIN_FIXTURE,
    leads: BUILTIN_FIXTURE.leads.map((l) => ({
      ...l,
      services: [{ category: 'operations', capability: 'automation', fit: 'strong', confidence: 70,
        rationale: 'Orders are re-keyed from email into the stock system by hand.',
        evidence: 'we still do our scheduling on a whiteboard and a spreadsheet',
        ask: 'How many hours a week go on re-keying?', walk_away_if: 'They already run an integration platform.' }],
    })),
  },
  outreach_argument: BUILTIN_FIXTURE.outreach_argument,
}
function nice(s) { return String(s || '').replace(/_/g, ' ') }

/* ============================================================
   THE MEASUREMENT

   Runs inside the page. Everything it reports carries a selector,
   because a finding nobody can locate is a finding nobody fixes.
   ============================================================ */
async function measure(page, primarySelector) {
  return page.evaluate(({ primarySelector, limits }) => {
    const { MIN_TAP_PX, MIN_FONT_PX, OVERFLOW_TOLERANCE_PX } = limits

    /* A path short enough to paste into devtools and specific enough to
       land on one element. */
    const selectorFor = (el) => {
      const bits = []
      let node = el
      for (let depth = 0; node && node.nodeType === 1 && depth < 4; depth++) {
        let bit = node.tagName.toLowerCase()
        if (node.id) { bits.unshift(`#${node.id}`); break }
        const cls = String(node.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)
        if (cls.length) bit += '.' + cls.slice(0, 2).join('.')
        bits.unshift(bit)
        node = node.parentElement
      }
      return bits.join(' > ')
    }

    const text = (el) => String(el.innerText || el.value || el.getAttribute('aria-label') || '')
      .replace(/\s+/g, ' ').trim().slice(0, 40)

    const visible = (el, rect) => {
      if (rect.width === 0 && rect.height === 0) return false
      const cs = getComputedStyle(el)
      return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
    }

    const doc = document.documentElement
    const vh = window.innerHeight
    const vw = window.innerWidth
    const scrollHeight = Math.max(doc.scrollHeight, document.body.scrollHeight)
    const scrollWidth = Math.max(doc.scrollWidth, document.body.scrollWidth)

    const all = Array.from(document.querySelectorAll('body *'))

    /* ---- horizontal overflow, element by element ----
       An element inside a deliberately side-scrolling container is not a
       page overflow — a wide table in its own scroller is a design, not a
       bug — so those are skipped. */
    const inScroller = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true
      }
      return false
    }
    const wide = []
    for (const el of all) {
      const r = el.getBoundingClientRect()
      if (!visible(el, r)) continue
      const right = r.right + window.scrollX
      if (right <= vw + OVERFLOW_TOLERANCE_PX) continue
      if (inScroller(el)) continue
      wide.push({ selector: selectorFor(el), right: Math.round(right), over: Math.round(right - vw), text: text(el) })
    }
    /* Only the outermost offender of a nested run is worth reporting —
       fixing the parent almost always fixes the children. */
    const overflowing = wide
      .filter((w, i) => !wide.some((o, j) => j !== i && w.selector.startsWith(o.selector + ' >')))
      .sort((a, b) => b.over - a.over).slice(0, 12)

    /* ---- tap targets ----
       WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA: 24×24 CSS px.
       The "Inline" exception applies to a link sitting inside a run of
       text, where the target is sized by the line it is in — those are
       counted separately and do not fail the run. */
    const taps = []
    const INTERACTIVE = 'button, a, input, select, [role=tab], [role=button]'
    for (const el of document.querySelectorAll(INTERACTIVE)) {
      if (el.type === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (!visible(el, r)) continue
      const w = Math.round(r.width), h = Math.round(r.height)
      if (w >= MIN_TAP_PX && h >= MIN_TAP_PX) continue
      /* inline link: an <a> whose parent holds text either side of it */
      const p = el.parentElement
      const inline = el.tagName === 'A' && p
        && getComputedStyle(el).display.startsWith('inline')
        && String(p.textContent || '').trim().length > String(el.textContent || '').trim().length
      taps.push({ selector: selectorFor(el), w, h, text: text(el), inline: Boolean(inline) })
    }

    /* ---- text smaller than the floor ----
       Only elements that actually render their own words. An empty span
       used as a rule or a dot is decorative and is not judged. */
    const small = []
    const seen = new Set()
    for (const el of all) {
      if (el.getAttribute('aria-hidden') === 'true') continue
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
        .map((n) => n.textContent.trim()).join(' ')
      if (!own) continue
      const r = el.getBoundingClientRect()
      if (!visible(el, r)) continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (!(size < MIN_FONT_PX)) continue
      const key = selectorFor(el) + '|' + Math.round(size * 10)
      if (seen.has(key)) continue
      seen.add(key)
      small.push({ selector: selectorFor(el), px: Math.round(size * 10) / 10, text: own.replace(/\s+/g, ' ').slice(0, 40) })
    }

    /* ---- the primary action ---- */
    let primary = null
    for (const sel of primarySelector.split(',').map((s) => s.trim()).filter(Boolean)) {
      const el = document.querySelector(sel)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (!visible(el, r)) continue
      primary = { selector: sel, y: Math.round(r.top + window.scrollY), viewports: Math.round(((r.top + window.scrollY) / vh) * 100) / 100, text: text(el) }
      break
    }

    /* ---- a sticky or fixed header pinned to the top ---- */
    let sticky = null
    for (const el of all) {
      const cs = getComputedStyle(el)
      if (cs.position !== 'sticky' && cs.position !== 'fixed') continue
      const r = el.getBoundingClientRect()
      if (!visible(el, r)) continue
      if (r.top > vh * 0.2) continue          // not a header
      if (r.height < 8) continue              // a hairline, not a bar
      /* A fixed layer as tall as the window is a backdrop — the grain
         canvas on the marketing pages is one — and reporting it as a
         header that eats the whole viewport is nonsense. */
      if (r.height > vh * 0.5) continue
      const h = Math.round(r.height)
      if (!sticky || h > sticky.height) {
        sticky = { selector: selectorFor(el), height: h, share: Math.round((h / vh) * 1000) / 1000, position: cs.position }
      }
    }

    return {
      vw, vh, scrollHeight, scrollWidth,
      viewportsTall: Math.round((scrollHeight / vh) * 100) / 100,
      horizontalOverflowPx: Math.max(0, scrollWidth - vw),
      overflowing, taps, small, primary, sticky,
      title: document.title,
      heading: (document.querySelector('h1, h2, h3') || {}).innerText || '',
    }
  }, { primarySelector, limits: { MIN_TAP_PX, MIN_FONT_PX, OVERFLOW_TOLERANCE_PX } })
}

/* ============================================================
   THE HARNESS

   A throwaway Vite project inside the repo (it has to be inside, or
   react and the plugin do not resolve), rendering one component in the
   real CRM shell against a fixture.

   THE ALIAS IS A REGEX, AND IT MATCHES THE IMPORT SPECIFIER. An alias
   keyed on the absolute path of src/lib/supabase.js does not match what
   OutreachLog.jsx actually writes, which is '../lib/supabase.js'; the
   build then falls through to the real client, sits on a network call
   and renders an error state, silently and with no warning at all. That
   cost an hour. /^\.\.\/lib\/supabase\.js$/ is the thing that works.
   ============================================================ */
function harnessFiles(dir, fixture) {
  const stub = `/* Stands in for src/lib/supabase.js. No network, no auth, no keys.
   The fixture is read from the page so it can be swapped without a rebuild. */
const doc = JSON.parse(document.getElementById('crm-fixture').textContent)
const reply = (name) => Promise.resolve({
  data: name in doc ? doc[name] : doc, error: null,
})
/* from(table).anything().anything() - every call returns the chain, and
   awaiting it answers with the fixture's rows for that table. */
const table = (name) => {
  const result = { data: (doc.tables && doc.tables[name]) || [], error: null }
  const chain = new Proxy(function chain() {}, {
    get: (_, prop) => (prop === 'then'
      ? (ok, bad) => Promise.resolve(result).then(ok, bad)
      : () => chain),
  })
  return chain
}
const session = { user: { id: 'harness', email: 'harness@local', user_metadata: { full_name: 'Harness' } } }
export const SUPABASE_URL = 'http://harness.invalid'
export const SUPABASE_ANON_KEY = 'harness'
export function teamClient() {
  return {
    rpc: (name) => reply(name),
    from: (name) => table(name),
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
  }
}
export const portalClient = () => teamClient()
export const signedUrl = async () => null
export const friendlyError = (err, fallback) => fallback
`

  /* The ribbon is copied as static markup rather than imported, because the
     real one needs a router and a live lead count. It carries the same
     classes, so it is the same sticky height the CRM really has. */
  const entry = COMPONENT.page ? `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../src/styles/global.css'
import ${COMPONENT.name} from '../src/${COMPONENT.file}'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MemoryRouter initialEntries={['/crm']}>
      <${COMPONENT.name} />
    </MemoryRouter>
  </StrictMode>,
)
` : `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/styles/global.css'
import '../src/styles/crm.css'
import ${COMPONENT.name} from '../src/${COMPONENT.file}'
import { Logo } from '../src/components/ui/index.jsx'
import { useRibbonHeight } from '../src/components/ui/Workspace.jsx'

function Ribbon() {
  const ref = useRibbonHeight()
  return (
      <div className="crm-ribbon" ref={ref}>
        <a className="crm-ribbon__brand" href="/" aria-label="n.abl home"><Logo size={20} /></a>
        <nav className="crm-views" role="tablist" aria-label="Workspace">
          <button type="button" role="tab" aria-selected="false" className="crm-view">Insights</button>
          <button type="button" role="tab" aria-selected="false" className="crm-view">Leads<span className="crm-view__count">24</span></button>
          <button type="button" role="tab" aria-selected="false" className="crm-view">Board</button>
${['Argument log', 'Lead gen'].map((t) => `          <button type="button" role="tab" aria-selected="${t === COMPONENT.tab}" className="crm-view${t === COMPONENT.tab ? ' crm-view--on' : ''}">${t}</button>`).join('\n')}
        </nav>
        <div className="crm-ribbon__right">
          <input className="input crm-ribbon__search" type="search" aria-label="Search leads" placeholder="Search leads" />
          <button type="button" className="btn btn--accent btn--sm">+ Lead</button>
          <a className="btn btn--ghost btn--sm crm-ribbon__team" href="/team">Team</a>
        </div>
      </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div className="grain">
      <Ribbon />
      <div className="shell crm-shell crm-shell--fit">
        <${COMPONENT.name} />
      </div>
    </div>
  </StrictMode>,
)
`

  const html = `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CRM usability harness</title>
    <link rel="stylesheet" href="/fonts/fonts.css" />
    <script type="application/json" id="crm-fixture">${JSON.stringify(fixture).replace(/</g, '\\u003c')}</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/entry.jsx"></script>
  </body>
</html>
`

  const config = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: ${JSON.stringify(dir)},
  publicDir: ${JSON.stringify(join(ROOT, 'public'))},
  resolve: {
    alias: [
      /* Matches the SPECIFIER, not the resolved path. See the note above. */
      { find: /^\\.\\.\\/lib\\/supabase\\.js$/, replacement: ${JSON.stringify(join(dir, 'supabase-stub.js'))} },
      { find: /^\\.\\.\\/\\.\\.\\/lib\\/supabase\\.js$/, replacement: ${JSON.stringify(join(dir, 'supabase-stub.js'))} },
    ],
  },
  plugins: [react()],
  server: { host: '127.0.0.1', strictPort: true },
})
`

  writeFileSync(join(dir, 'supabase-stub.js'), stub)
  writeFileSync(join(dir, 'entry.jsx'), entry)
  writeFileSync(join(dir, 'index.html'), html)
  writeFileSync(join(dir, 'vite.harness.config.mjs'), config)
}

/* THE SHEET. With --sheet the run settings are opened too, and what is
   measured is the sheet: it covers the page, so its own width and tap
   targets are what matter, not the height of what is under it. */
const SHEET = flag('--sheet')

/* Everything the harness leaves on disk or in the process table goes here,
   and this runs on success, on failure and on Ctrl-C. A checker that leaves
   a vite server holding port 5199 is a checker nobody runs twice. */
const cleanups = []
let cleaned = false
function cleanUp() {
  if (cleaned) return
  cleaned = true
  for (const fn of cleanups.reverse()) { try { fn() } catch { /* nothing left to do */ } }
}
process.on('exit', cleanUp)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { cleanUp(); process.exit(130) })
}

async function startHarness() {
  const fixture = FIXTURE
    ? JSON.parse(readFileSync(resolve(FIXTURE), 'utf8'))
    : ({ LeadGen: LEADGEN_FIXTURE, Crm: LEADS_FIXTURE }[COMPONENT.name] || BUILTIN_FIXTURE)

  /* Inside the repo, or vite resolves neither react nor the plugin. */
  const dir = mkdtempSync(join(ROOT, '.crm-usability-'))
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
  harnessFiles(dir, fixture)

  const port = 5100 + (process.pid % 400)
  const child = spawn(
    process.execPath,
    [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--config', join(dir, 'vite.harness.config.mjs'), '--port', String(port)],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  cleanups.push(() => { try { child.kill('SIGKILL') } catch { /* already gone */ } })

  const log = []
  child.stdout.on('data', (d) => log.push(String(d)))
  child.stderr.on('data', (d) => log.push(String(d)))

  const origin = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 30000
  for (;;) {
    if (child.exitCode !== null) throw new Error(`vite exited (${child.exitCode}):\n${log.join('')}`)
    try {
      const res = await fetch(origin + '/', { signal: AbortSignal.timeout(1500) })
      if (res.ok) break
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error(`vite did not start within 30s:\n${log.join('')}`)
    await new Promise((r) => setTimeout(r, 250))
  }
  return { origin, path: '/', log }
}

/* ---------------- run ---------------- */
const tick = '✓', cross = '✗', dash = '—'
const fmtX = (n) => `${n.toFixed(1)}×`

async function run() {
  let origin, path, label
  if (MODE_HARNESS) {
    const h = await startHarness()
    origin = h.origin; path = h.path
    label = `harness · src/${COMPONENT.file}${FIXTURE ? ` · ${FIXTURE}` : ' · built-in fixture'}${EXPAND ? ' · a record open' : ' · as it lands'}${SHEET ? ' · settings open' : ''}`
  } else {
    origin = MODE_URL.replace(/\/$/, ''); path = ROUTE
    label = `${origin}${path}`
  }

  if (SHOT_DIR) mkdirSync(resolve(SHOT_DIR), { recursive: true })

  /* CHROMIUM_PATH: for a machine whose installed browser is not the build
     this playwright expects (a CI image, a cloud sandbox). */
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  cleanups.push(() => { try { browser.close() } catch { /* already gone */ } })

  const rows = []
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(origin + path, { waitUntil: 'networkidle' })
    /* Fonts change every height on this page, so wait for them before
       measuring anything — a measurement taken mid-swap is fiction. */
    await page.evaluate(() => document.fonts && document.fonts.ready)
    await page.waitForTimeout(250)

    if (COMPONENT.page) {
      await page.locator('.crm-view', { hasText: COMPONENT.tab }).first().click({ timeout: 5000 })
      await page.waitForTimeout(400)
    }

    if (EXPAND) {
      /* One pass only — opening a disclosure that opens another is a
         different screen, not a longer version of this one. */
      for (const el of await page.$$('[aria-expanded="false"]')) {
        await el.click({ timeout: 2000 }).catch(() => { /* moved or covered */ })
      }
      const lead = await page.$('.crm-leadbtn, .ol-list button')
      if (lead) await lead.click({ timeout: 2000 }).catch(() => { /* nothing selectable */ })
      await page.waitForTimeout(400)
    }

    if (SHEET) {
      const opener = await page.$('[aria-haspopup="dialog"]')
      if (opener) await opener.click({ timeout: 2000 }).catch(() => { /* nothing to open */ })
      await page.waitForTimeout(300)
    }

    const m = await measure(page, PRIMARY)
    m.name = vp.name; m.kind = vp.kind; m.note = vp.note; m.errors = errors

    if (SHOT_DIR) {
      const file = join(resolve(SHOT_DIR), `${vp.w}x${vp.h}-${vp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`)
      await page.screenshot({ path: file, fullPage: true })
      m.screenshot = file
    }
    await page.close()
    rows.push(m)
  }

  /* ---------------- judgement ---------------- */
  const findings = []
  let fail = 0
  const isPhone = (r) => r.vw <= PHONE_MAX_WIDTH

  for (const r of rows) {
    const where = `${r.vw}×${r.vh} ${r.name}`

    if (r.horizontalOverflowPx > OVERFLOW_TOLERANCE_PX || r.overflowing.length) {
      fail++
      findings.push(`${cross} ${where} — scrolls sideways by ${r.horizontalOverflowPx}px`)
      for (const o of r.overflowing.slice(0, 5)) {
        findings.push(`     ${o.selector}  +${o.over}px past the edge${o.text ? `  "${o.text}"` : ''}`)
      }
    }

    const hardTaps = r.taps.filter((t) => !t.inline)
    if (hardTaps.length) {
      fail++
      findings.push(`${cross} ${where} — ${hardTaps.length} tap target${hardTaps.length === 1 ? '' : 's'} under ${MIN_TAP_PX}×${MIN_TAP_PX} (WCAG 2.2 SC 2.5.8)`)
      for (const t of hardTaps.slice(0, 5)) {
        findings.push(`     ${t.selector}  ${t.w}×${t.h}${t.text ? `  "${t.text}"` : ''}`)
      }
    }
    const inlineTaps = r.taps.filter((t) => t.inline)
    if (inlineTaps.length) {
      findings.push(`${dash} ${where} — ${inlineTaps.length} small inline link${inlineTaps.length === 1 ? '' : 's'}, exempt under the SC 2.5.8 inline exception`)
    }

    if (isPhone(r) && r.viewportsTall > MAX_PAGE_VIEWPORTS_PHONE) {
      fail++
      findings.push(`${cross} ${where} — ${fmtX(r.viewportsTall)} viewports tall, over the ${MAX_PAGE_VIEWPORTS_PHONE}× phone limit (${r.scrollHeight}px of page in a ${r.vh}px window)`)
    }

    if (r.small.length) {
      findings.push(`${dash} ${where} — ${r.small.length} element${r.small.length === 1 ? '' : 's'} under ${MIN_FONT_PX}px`)
      for (const s of r.small.slice(0, 4)) findings.push(`     ${s.selector}  ${s.px}px  "${s.text}"`)
    }

    if (r.sticky && r.vh <= SHORT_VIEWPORT_PX && r.sticky.share > STICKY_MAX_SHARE) {
      findings.push(`${dash} ${where} — ${r.sticky.position} ${r.sticky.selector} takes ${Math.round(r.sticky.share * 100)}% of a ${r.vh}px viewport`)
    }

    if (r.primary && r.primary.viewports > PRIMARY_ACTION_MAX_VIEWPORTS) {
      findings.push(`${dash} ${where} — the primary action sits ${fmtX(r.primary.viewports)} viewports down (${r.primary.y}px)`)
    }
    if (!r.primary) findings.push(`${dash} ${where} — no primary action matched "${PRIMARY}"`)

    if (r.errors.length) findings.push(`${dash} ${where} — page error: ${r.errors[0].slice(0, 90)}`)
  }

  if (AS_JSON) {
    console.log(JSON.stringify({
      target: label,
      thresholds: { MIN_TAP_PX, MIN_FONT_PX, MAX_PAGE_VIEWPORTS_PHONE, STICKY_MAX_SHARE, SHORT_VIEWPORT_PX, PRIMARY_ACTION_MAX_VIEWPORTS },
      viewports: rows,
      failures: fail,
    }, null, 2))
    cleanUp()
    process.exit(fail ? 1 : 0)
  }

  console.log(`\n  ${label}\n`)
  console.log('  viewport        device            tall    sideways  taps<24  text<12  sticky  primary')
  console.log('  ' + '─'.repeat(84))
  for (const r of rows) {
    const tall = fmtX(r.viewportsTall)
    const tallMark = isPhone(r) && r.viewportsTall > MAX_PAGE_VIEWPORTS_PHONE ? cross : tick
    const side = (r.horizontalOverflowPx > OVERFLOW_TOLERANCE_PX || r.overflowing.length)
      ? `${cross} ${r.horizontalOverflowPx}px` : `${tick} none`
    const hardTaps = r.taps.filter((t) => !t.inline).length
    const stickyCell = r.sticky
      ? `${r.sticky.share > STICKY_MAX_SHARE && r.vh <= SHORT_VIEWPORT_PX ? cross : tick} ${Math.round(r.sticky.share * 100)}%`
      : `${dash}`
    console.log(
      '  ' + `${r.vw}×${r.vh}`.padEnd(16) +
      r.name.padEnd(18) +
      `${tallMark} ${tall}`.padEnd(8) +
      side.padEnd(10) +
      (hardTaps ? `${cross} ${hardTaps}` : `${tick} 0`).padEnd(9) +
      (r.small.length ? `${dash} ${r.small.length}` : `${tick} 0`).padEnd(9) +
      stickyCell.padEnd(8) +
      (r.primary ? fmtX(r.primary.viewports) : dash),
    )
  }

  const phones = rows.filter(isPhone)
  if (phones.length) {
    const worst = phones.reduce((a, b) => (b.viewportsTall > a.viewportsTall ? b : a))
    console.log(`\n  On a phone the page runs ${fmtX(Math.min(...phones.map((p) => p.viewportsTall)))} to ${fmtX(worst.viewportsTall)} viewports;`)
    console.log(`  worst is ${worst.vw}×${worst.vh} at ${worst.scrollHeight}px of page in a ${worst.vh}px window.`)
  }

  console.log(`\n  FINDINGS\n`)
  if (!findings.length) console.log(`  ${tick} nothing to report at any of the ${VIEWPORTS.length} viewports`)
  for (const f of findings) console.log(`  ${f}`)

  if (SHOT_DIR) console.log(`\n  ${rows.length} screenshots written to ${resolve(SHOT_DIR)}`)

  console.log(`\n  ${fail} failure${fail === 1 ? '' : 's'} against the thresholds ` +
    `(no sideways scroll, ${MIN_TAP_PX}px taps, ${MAX_PAGE_VIEWPORTS_PHONE}× page on a phone).\n`)
  cleanUp()
  process.exit(fail ? 1 : 0)
}

run().catch((err) => {
  cleanUp()
  console.error(`\n  ${cross} ${err && err.message ? err.message : err}\n`)
  process.exit(2)
})
