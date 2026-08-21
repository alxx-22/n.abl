#!/usr/bin/env node
/* Find and confirm a candidate's website.

   There is no free search API left. Bing's was retired in 2025, Google's
   Custom Search is closed to new customers and shuts on 1 January 2027, and
   Brave's free tier ended in February 2026. So this guesses domains from the
   company name and then proves or disproves each guess.

   Guessing is cheap only if it is done in the right order. Nine name-and-TLD
   combinations per company over HTTP would be 75,000 requests for the first
   triage band alone. A DNS lookup is a few milliseconds and no load on anyone
   else's server, so every guess is resolved first and only the ones that exist
   are ever fetched.

   Confirmation matters more than discovery. `parkvalley.co.uk` resolving tells
   you a domain exists, not that it belongs to Park Valley Management Ltd — it
   might be a parking page, a squatter, or a different firm entirely. A guess
   is only accepted when the page itself carries the company name, its
   postcode, or its company number.

     node scripts/sourcing/find-websites.mjs --sample 500
     node scripts/sourcing/find-websites.mjs --band first
*/

import fs from 'node:fs'
import path from 'node:path'
import dns from 'node:dns/promises'
import { nameKey } from './lib.mjs'

const DIR = '.sourcing'
const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const IN = arg('--in', path.join(DIR, 'triaged.json'))
const BAND = arg('--band', 'first')
const SAMPLE = Number(arg('--sample', 0)) || 0
const OUT = arg('--out', path.join(DIR, `websites-${BAND}${SAMPLE ? `-sample${SAMPLE}` : ''}.json`))
const CONCURRENCY = Number(arg('--concurrency', 6))

/* Identifies us, and gives a human somewhere to complain to. A crawler that
   will not say who it is has already decided it is doing something it should
   not. */
const UA = 'n.abl-research/1.0 (+https://nabl.agency; hello@nabl.agency)'
const TIMEOUT = 12000

/* Words that carry no identity and only make a domain guess worse. */
const NOISE = new Set(['THE', 'AND', 'OF', 'GROUP', 'HOLDINGS', 'UK', 'SERVICES', 'SERVICE'])

function domainGuesses(name) {
  const key = nameKey(name)
  const words = key.split(' ').filter((w) => w && !NOISE.has(w))
  if (!words.length) return []
  const joined = words.join('').toLowerCase().replace(/[^a-z0-9]/g, '')
  const hyphen = words.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '')
  const short = words.slice(0, 2).join('').toLowerCase().replace(/[^a-z0-9]/g, '')

  /* Every combination, but ORDERED by how likely each is to be the business
     rather than somebody else. The loop stops at the first confirmed hit, so
     ordering is what decides how many requests a typical company costs, while
     the length of the list decides how many we find at all.

     Both halves of that were learned the hard way. A first version generated
     the combinations in an arbitrary order and spent requests on parked .com
     domains; a second version fixed the order but also DROPPED the less
     likely guesses on the same politeness argument, and confirmations on a
     40-company sample fell from 12 to 8. A third of the yield, given away for
     a saving that only applies to companies we were failing to find anyway.
     Cheap first, but keep looking. */
  const ok = (s) => s.length >= 4 && s.length <= 63
  const stems = [joined, hyphen, short].filter(ok)
  const out = []
  for (const tld of ['co.uk', 'com', 'uk']) for (const stem of stems) out.push(`${stem}.${tld}`)
  return [...new Set(out)]
}

/* A domain can resolve, serve 200, and still be nobody's website. Naming the
   difference matters: "they are parked" and "we guessed the wrong domain" and
   "they have no site" are three different answers and only one of them means
   stop looking. */
const PARKED = /domain (may be|is) (available|for sale)|buy this domain|parked (free )?(at|by)|protected domain holder|this domain is for sale|domain parking/i

function pageKind(body) {
  if (body.length < 400) return 'stub'
  /* Matched against the <title> alone, not the whole page. Scanning the body
     caught real sites: a footer reading "hosted by GoDaddy", or a "coming
     soon" banner over one section of an otherwise working site, both flagged
     the whole domain as parked. A parking page says so in its title. */
  const title = (body.match(/<title[^>]*>([^<]*)/i) || [])[1] || ''
  if (PARKED.test(title)) return 'parked'
  return 'live'
}

async function resolves(host) {
  try { await dns.resolve4(host); return true } catch { /* fall through to v6 */ }
  try { await dns.resolve6(host); return true } catch { return false }
}

/* One retry, once, on the failures that are about the moment rather than the
   site. Two identical runs over the same 40 companies differed by four
   confirmations purely on timeouts and 503s, which means a single attempt
   measures the network as much as it measures the businesses. A second try a
   second and a half later is well within what any server would consider
   polite and removes most of that noise. 403 is not retried: that is an
   answer, not a hiccup. */
async function getWithRetry(url) {
  const first = await get(url)
  if (first.ok || first.status === 403 || first.status === 404) return first
  if (!(first.error === 'timeout' || (first.status >= 500 && first.status < 600))) return first
  await new Promise((r) => setTimeout(r, 1500))
  const second = await get(url)
  return second.ok ? { ...second, retried: true } : first
}

async function get(url) {
  const control = new AbortController()
  const timer = setTimeout(() => control.abort(), TIMEOUT)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: control.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    })
    const type = res.headers.get('content-type') || ''
    if (!res.ok || !type.includes('html')) return { ok: false, status: res.status }
    const body = (await res.text()).slice(0, 400_000)
    return { ok: true, status: res.status, url: res.url, body }
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : e.message }
  } finally { clearTimeout(timer) }
}

/* Only the two questions that matter: may we fetch, and how slowly. Not a
   full robots parser — it errs toward disallowing, which is the safe way for
   a parser to be wrong. */
async function robots(host) {
  const res = await get(`https://${host}/robots.txt`).catch(() => null)
  const rules = { allowed: true, delay: 0 }
  if (!res?.ok || !res.body) return rules
  let applies = false
  for (const raw of res.body.split('\n')) {
    const line = raw.split('#')[0].trim()
    if (!line) continue
    const [field, ...rest] = line.split(':')
    const value = rest.join(':').trim()
    const key = field.trim().toLowerCase()
    if (key === 'user-agent') {
      applies = value === '*' || value.toLowerCase().includes('n.abl')
    } else if (applies && key === 'disallow' && value === '/') {
      rules.allowed = false
    } else if (applies && key === 'crawl-delay') {
      rules.delay = Math.min(Number(value) || 0, 10) * 1000
    }
  }
  return rules
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

/* The whole point. A resolving domain is not a match; a page that names the
   company, its postcode or its company number is. */
const POSTCODE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s?\d[A-Z]{2}\b/g
const AREA_LETTERS = (outward) => (String(outward).match(/^[A-Z]{1,2}/) || [''])[0]

/* A name match alone is not identity. Two firms share a name often enough that
   it costs nothing to check, and the sample that first ran this found two in
   thirteen: carltonfinancial.co.uk is a Norwich business and our candidate is
   a Nottinghamshire one; sensorylearning.com answers a Colorado phone number.
   Both passed on the name and both were the wrong company.

   So a weak match has to survive a contradiction test. If the page states
   where it is and that is nowhere near our candidate, the name is a
   coincidence. A page that says nothing about where it is cannot contradict
   anything, and is left to the weak match. */
function contradicts(body, candidate) {
  const ours = new Set([candidate.area, candidate.registered_postcode, candidate.declared_postcode,
                        candidate.trading_postcode]
    .filter(Boolean).map((v) => AREA_LETTERS(String(v).toUpperCase())).filter(Boolean))
  if (!ours.size) return null

  const onPage = [...String(body).toUpperCase().matchAll(POSTCODE)].map((m) => AREA_LETTERS(m[1]))
  if (onPage.length && !onPage.some((a) => ours.has(a))) {
    return `the page's addresses are all in ${[...new Set(onPage)].slice(0, 3).join('/')}, not ${[...ours].join('/')}`
  }

  /* A UK business publishes a UK number. A North American one on the only
     phone on the page is the same signal as a foreign postcode. */
  const uk = /(\+44|\b0[12378]\d{8,9}\b|\b0\d{4}\s?\d{6}\b)/.test(body)
  const northAmerican = /\b(?:\+1[\s-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(body)
  if (northAmerican && !uk) return 'the only phone numbers on the page are North American'
  return null
}

function confirms(body, candidate) {
  const page = norm(body)
  const strong = []
  const weak = []
  const key = nameKey(candidate.name)
  const words = key.split(' ').filter((w) => w.length > 3 && !NOISE.has(w))

  /* Strong: it could only be them. A full postcode or a company number is
     unique to one business, so no contradiction test is needed. */
  for (const pc of [candidate.contact_postcode, candidate.registered_postcode,
                    candidate.declared_postcode, candidate.trading_postcode]) {
    if (pc && norm(pc).length >= 5 && page.includes(norm(pc))) { strong.push('postcode'); break }
  }
  if (candidate.company_number && page.includes(norm(candidate.company_number))) strong.push('company number')

  // Weak: a name, which other businesses may also have.
  if (key.length >= 6 && page.includes(norm(key))) weak.push('company name')
  else if (words.length >= 2 && words.every((w) => page.includes(norm(w)))) weak.push('every word of the name')

  if (strong.length) return { reasons: [...strong, ...weak] }
  if (!weak.length) return { reasons: [] }

  const conflict = contradicts(body, candidate)
  return conflict ? { reasons: [], conflict } : { reasons: weak }
}

async function investigate(candidate) {
  const guesses = domainGuesses(candidate.name)
  const record = { name: candidate.name, area: candidate.area, guesses: guesses.length,
                   resolved: [], website: null, confirmed_by: [], outcome: 'no domain found' }
  if (!guesses.length) { record.outcome = 'name gave no usable domain'; return record }

  const live = []
  for (const host of guesses) if (await resolves(host)) live.push(host)
  record.resolved = live
  if (!live.length) return record

  for (const host of live) {
    const rules = await robots(host)
    if (!rules.allowed) { record.outcome = 'robots.txt disallows'; continue }
    if (rules.delay) await new Promise((r) => setTimeout(r, rules.delay))

    const page = await getWithRetry(`https://${host}/`)
    if (!page.ok) { record.outcome = `unreachable (${page.error || page.status})`; continue }

    const kind = pageKind(page.body)
    if (kind !== 'live') { record.outcome = `the domain is ${kind === 'parked' ? 'parked or for sale' : 'a placeholder page'}`; continue }

    const { reasons, conflict } = confirms(page.body, candidate)
    if (reasons.length) {
      record.website = page.url
      record.confirmed_by = reasons
      record.outcome = 'confirmed'
      record.html_bytes = page.body.length
      return record
    }
    record.outcome = conflict
      ? `a different company with the same name — ${conflict}`
      : 'resolved but the page does not mention them'
  }
  return record
}

/* ---- run ---- */
const data = JSON.parse(fs.readFileSync(IN, 'utf8'))
let pool = data.candidates.filter((c) => c.triage === BAND)
if (SAMPLE) {
  // Evenly spaced rather than the first N: the file is sorted, so the head is
  // not representative of the band.
  const step = Math.max(1, Math.floor(pool.length / SAMPLE))
  pool = pool.filter((_, i) => i % step === 0).slice(0, SAMPLE)
}

console.log(`\n  ${pool.length.toLocaleString()} candidates from band "${BAND}"`)
console.log(`  ${CONCURRENCY} at a time, ${UA}\n`)

const results = []
let done = 0
const started = Date.now()
const queue = [...pool]

async function worker() {
  while (queue.length) {
    const candidate = queue.shift()
    results.push(await investigate(candidate))
    done++
    if (done % 25 === 0) {
      const rate = done / ((Date.now() - started) / 1000)
      const hits = results.filter((r) => r.outcome === 'confirmed').length
      console.log(`  ${done}/${pool.length}  confirmed ${hits} (${(hits / done * 100).toFixed(0)}%)  ${rate.toFixed(1)}/s`)
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

const by = {}
for (const r of results) by[r.outcome] = (by[r.outcome] || 0) + 1
const confirmed = results.filter((r) => r.outcome === 'confirmed')

fs.writeFileSync(OUT, JSON.stringify({
  generated_at: new Date().toISOString(),
  band: BAND, sampled: SAMPLE || null,
  attempted: results.length,
  confirmed: confirmed.length,
  hit_rate: results.length ? confirmed.length / results.length : 0,
  outcomes: by,
  results,
}, null, 1))

console.log(`
  ${results.length.toLocaleString()} attempted, ${confirmed.length.toLocaleString()} confirmed (${(confirmed.length / results.length * 100).toFixed(1)}%)

${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${String(v).padStart(5)}  ${k}`).join('\n')}

  confirmed by: ${Object.entries(confirmed.flatMap((c) => c.confirmed_by)
    .reduce((a, r) => ({ ...a, [r]: (a[r] || 0) + 1 }), {}))
    .map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}

  -> ${path.resolve(OUT)}
`)
