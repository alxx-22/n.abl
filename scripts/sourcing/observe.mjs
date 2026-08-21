#!/usr/bin/env node
/* Find one true, checkable thing to say about each business.

   This exists because the alternative is a template with the company name
   dropped into it, and `11-outreach/first-contact-letter.md` says in terms
   that a letter built on "businesses like yours often struggle with admin" is
   not a letter, it is a leaflet. The observation is the only part of a first
   contact that could not have been sent to anybody else.

   So each business's own homepage is read, and the draft is built from what is
   actually on it. Nothing here invents a fact: every observation below is
   either something present in the page or something the register already told
   us, and the phrasing says which.

   What it will NOT do is guess at pain. "You probably rekey orders by hand" is
   a guess dressed as an observation, and a recipient can tell. The signals
   below are all things visible from outside.

     node scripts/sourcing/observe.mjs --in .sourcing/promote-batch.json
*/

import fs from 'node:fs'
import path from 'node:path'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const IN = arg('--in', '.sourcing/promote-batch.json')
const OUT = arg('--out', '.sourcing/observations.json')
const CONCURRENCY = Number(arg('--concurrency', 12))
const UA = 'n.abl-research/1.0 (+https://nabl.agency; hello@nabl.agency)'

async function get(url) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 12000)
  try {
    const res = await fetch(url, { redirect: 'follow', signal: c.signal,
      headers: { 'user-agent': UA, accept: 'text/html' } })
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return null
    return (await res.text()).slice(0, 300_000)
  } catch { return null } finally { clearTimeout(t) }
}

const strip = (h) => h
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

/* Each signal is a thing genuinely visible on the page, and each carries the
   sentence it produces. Ordered by how specific the resulting sentence is —
   the first match wins, so the most concrete thing available gets used. */
const SIGNALS = [
  {
    /* A holding page is a real observation and a strong one: a business
       trading for years behind "Coming Soon" has decided the website is
       somebody else's job. Checked first because if it is true, nothing else
       on the page means anything. */
    key: 'placeholder_site',
    /* Anchored at both ends, deliberately. An earlier version matched a title
       merely STARTING with "home" and flagged "Home | Kharis Healthcare" and
       "Home Care & Supported Living" as holding pages — a working site, and a
       sentence that would have been plainly wrong to the person reading it.
       The thin-page fallback is likewise tightened: a JS-rendered site serves
       little text without being a placeholder, so it also has to have no
       navigation. */
    test: (html, text, title) => {
      const t = (title || '').trim()
      if (/^(coming soon|new page ?\d*|untitled|home|index of \/|welcome)$/i.test(t)) return true
      if (/(under construction|site is being (built|rebuilt)|website coming soon)/i.test(t)) return true
      const links = (html.match(/<a\s[^>]*href=/gi) || []).length
      return text.length < 200 && links < 4
    },
    say: () => 'your website is still a holding page',
  },
  {
    key: 'enquiry_form_only',
    test: (html, text) => /<form[^>]*>/i.test(html) && !/mailto:/i.test(html)
      && /(enquir|contact us|get in touch|request a (quote|callback))/i.test(text),
    say: () => 'your enquiries come in through the form on your site rather than to a named inbox',
  },
  {
    key: 'quote_request',
    test: (_h, text) => /(request a quote|get a quote|free quote|for a quotation)/i.test(text),
    say: () => 'quotes start with a form on your site',
  },
  {
    key: 'phone_booking',
    test: (_h, text) => /(call us to book|phone to book|ring us|call to arrange|book by phone)/i.test(text),
    say: () => 'bookings go through a phone call',
  },
  {
    key: 'hiring',
    test: (_h, text) => /(we'?re hiring|join our team|current vacancies|careers|job opportunit)/i.test(text),
    say: () => 'you are advertising for people on your own careers page',
  },
  {
    key: 'downloadable_pricelist',
    test: (html) => /href="[^"]*\.(pdf|xlsx?|docx?)"/i.test(html),
    say: () => 'your price list or brochure goes out as a document download',
  },
  {
    key: 'multi_site',
    test: (_h, text) => /(our (branches|depots|locations|sites)|branch locator)/i.test(text),
    say: () => 'you run more than one site',
  },
  {
    key: 'accreditations',
    test: (_h, text) => /(gas safe|niceic|checkatrade|iso ?9001|chas|constructionline|safecontractor)/i.test(text),
    /* Upper-cased: these are all initialisms or trade marks, and "chas
       accreditation" reads like a typo. */
    say: (m) => `you carry ${/iso/i.test(m) ? m.toUpperCase().replace(/\s+/, ' ') : m.toUpperCase()} accreditation, which means certificates with renewal dates to keep track of`,
    capture: /(gas safe|niceic|checkatrade|iso ?9001|chas|constructionline|safecontractor)/i,
  },
]

/* Titles are usually "Company | what they do | town". The company name is
   dropped and the longest remaining descriptive piece is kept. */
function describeFromTitle(title, company) {
  if (!title) return null
  /* Legal suffixes are stripped from BOTH sides before comparing. Without
     that, "ESB Developments Ltd" in the title did not match "ESB DEVELOPMENTS
     LIMITED" and the draft told the business what its own name was. */
  const norm = (v) => String(v).toLowerCase()
    .replace(/\b(limited|ltd|plc|llp|cic)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
  const key = norm(company)
  const parts = title.split(/[|\u2013\u2014\-\u00b7]/).map((p) => p.trim()).filter(Boolean)
  const candidates = parts
    .filter((p) => norm(p) && norm(p) !== key)
    .filter((p) => !key.includes(norm(p)) && !norm(p).includes(key))
    .filter((p) => p.split(/\s+/).length >= 2 && p.length <= 70)
  if (!candidates.length) return null
  const best = candidates.sort((a, b) => b.length - a.length)[0]
  /* Casing is left exactly as the business wrote it. Lower-casing produced
     "you're arnold dental & implant centre", which reads as a machine that
     could not be bothered. */
  return best.replace(/\s+/g, ' ').replace(/^(the|a|an)\s+/i, '')
}

async function observe(lead) {
  const out = { company: lead.company, website: lead.website || null, signal: null, observation: null }
  if (!lead.website) {
    /* No site to read. The register still gives one true thing, and saying it
       plainly is better than inventing something warmer. */
    out.signal = 'register_only'
    out.observation = lead.trading_years
      ? `you have been trading ${lead.trading_years} years and I could not find a website for you`
      : 'I could not find a website for you'
    return out
  }
  const html = await get(lead.website)
  if (!html) { out.signal = 'unreadable'; out.observation = null; return out }
  const text = strip(html)
  const title = (html.match(/<title[^>]*>([^<]*)/i) || [])[1]
    ?.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&#8211;/g, '-')
    .trim() || ''
  out.title = title.slice(0, 120) || null

  for (const s of SIGNALS) {
    const captured = s.capture ? (text.match(s.capture) || [])[1] : null
    if (s.test(html, text, title)) {
      out.signal = s.key
      out.observation = s.say(captured)
      return out
    }
  }

  /* Last resort, and still not a guess: how the business describes itself in
     its own page title. "Pneumatic Tube Systems & AGV Solutions", "Nottingham
     Coach Company", "Self-Drive Van Rental" — they wrote that, so quoting it
     back is specific and cannot be wrong. The company name is stripped out so
     the sentence does not just repeat who they are. */
  const described = describeFromTitle(title, lead.company)
  if (described) {
    out.signal = 'describes_itself'
    out.observation = `your site describes you as ${described}`
    return out
  }

  /* Genuinely nothing. Recorded as such rather than falling back to something
     generic — a lead with no observation should be written by hand or not
     written to at all. */
  out.signal = 'nothing_specific'
  out.observation = null
  return out
}

const leads = JSON.parse(fs.readFileSync(IN, 'utf8'))
console.log(`\n  reading ${leads.length} sites, ${CONCURRENCY} at a time\n`)
const results = []
const queue = [...leads]
let done = 0
async function worker() {
  while (queue.length) {
    const lead = queue.shift()
    results.push(await observe(lead))
    if (++done % 25 === 0) console.log(`  ${done}/${leads.length}`)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

const tally = {}
for (const r of results) tally[r.signal] = (tally[r.signal] || 0) + 1
fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 1))
console.log(`
  ${results.filter((r) => r.observation).length}/${results.length} have something specific to say

${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${String(v).padStart(4)}  ${k}`).join('\n')}

  -> ${path.resolve(OUT)}
`)
